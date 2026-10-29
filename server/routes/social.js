// Social publishing via Zernio (docs.zernio.com).
// Each Kawayan user maps to one Zernio profile found by name, and each Zernio post
// carries the Kawayan post id in `title` — so no extra DB columns are needed.
import { Router } from 'express';
import { z } from 'zod';
import { dbService, authenticateToken, validate, id, sendUpstreamError, originOf } from '../shared.js';

const router = Router();

const ZERNIO_API = 'https://zernio.com/api/v1';
const SOCIAL_PLATFORMS = ['facebook', 'instagram'];
const zernioProfileIds = new Map();

const publishSchema = z.object({
  postId: id,
  accountIds: z.array(z.string().max(100), 'Pick at least one account to post to.').min(1, 'Pick at least one account to post to.').max(10),
  scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, 'scheduledFor must be YYYY-MM-DDTHH:mm:ss').optional(),
  timezone: z.string().max(64).optional(),
});

async function zernio(path, { method = 'GET', body } = {}) {
  const key = process.env.ZERNIO_API_KEY;
  if (!key) throw Object.assign(new Error('Social posting is not set up yet (ZERNIO_API_KEY is missing).'), { status: 503 });
  const res = await fetch(`${ZERNIO_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Never pass Zernio's 401/403 through: the client treats those as an expired Kawayan session.
    const status = [400, 409, 422].includes(res.status) ? 400 : 502;
    throw Object.assign(new Error(data.message || data.error || `Zernio request failed (${res.status})`), { status });
  }
  return data;
}

async function getZernioProfileId(userId) {
  if (zernioProfileIds.has(userId)) return zernioProfileIds.get(userId);
  const name = `kawayan:${userId}`;
  const { profiles = [] } = await zernio(`/profiles?name=${encodeURIComponent(name)}`);
  const id = profiles.find((p) => p.name === name)?._id
    || (await zernio('/profiles', { method: 'POST', body: { name } })).profile._id;
  zernioProfileIds.set(userId, id);
  return id;
}

async function listSocialAccounts(userId) {
  const profileId = await getZernioProfileId(userId);
  const { accounts = [] } = await zernio(`/accounts?profileId=${profileId}`);
  return accounts
    .filter((a) => SOCIAL_PLATFORMS.includes(a.platform))
    .map((a) => ({ id: a._id, platform: a.platform, username: a.username, displayName: a.displayName, isActive: a.isActive }));
}

// Zernio needs a public HTTPS media URL; our AI images are stored as base64 data URLs.
async function toPublicMediaUrl(imageUrl, postId) {
  if (!imageUrl) return null;
  if (!imageUrl.startsWith('data:')) return imageUrl;
  const match = /^data:([^;]+);base64,(.+)$/.exec(imageUrl);
  if (!match) return null;
  const [, contentType, b64] = match;
  const ext = contentType.split('/')[1] || 'png';
  const { uploadUrl, publicUrl } = await zernio('/media/presign', {
    method: 'POST',
    body: { filename: `kawayan-${postId}.${ext}`, contentType },
  });
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: Buffer.from(b64, 'base64') });
  if (!put.ok) throw Object.assign(new Error(`Image upload failed (${put.status})`), { status: 502 });
  return publicUrl;
}

const firstPlatformUrl = (zPost) => zPost.platforms?.find((p) => p.platformPostUrl)?.platformPostUrl;

router.get('/api/social/accounts', authenticateToken, async (req, res) => {
  try {
    res.json(await listSocialAccounts(req.user.userId));
  } catch (error) {
    sendUpstreamError(res, error, 'Failed to load social accounts');
  }
});

router.get('/api/social/connect/:platform', authenticateToken, async (req, res) => {
  const { platform } = req.params;
  if (!SOCIAL_PLATFORMS.includes(platform)) return res.status(400).json({ error: 'Unsupported platform' });
  try {
    const profileId = await getZernioProfileId(req.user.userId);
    const redirect = encodeURIComponent(`${originOf(req)}/?social=${platform}`);
    const { authUrl } = await zernio(`/connect/${platform}?profileId=${profileId}&redirect_url=${redirect}`);
    res.json({ authUrl });
  } catch (error) {
    sendUpstreamError(res, error, 'Failed to start account connection');
  }
});

router.delete('/api/social/accounts/:accountId', authenticateToken, async (req, res) => {
  try {
    const account = (await listSocialAccounts(req.user.userId)).find((a) => a.id === req.params.accountId);
    if (!account) return res.status(404).json({ error: 'Account not found' });
    await zernio(`/accounts/${account.id}`, { method: 'DELETE' });
    const who = await dbService.describeUser(req.user.userId);
    await dbService.logAudit(req.user.userId, 'disconnect_social', `${who} disconnected ${account.platform} @${account.username}`);
    res.json({ message: 'Disconnected' });
  } catch (error) {
    sendUpstreamError(res, error, 'Failed to disconnect account');
  }
});

// Publish now, or schedule when `scheduledFor` (local "YYYY-MM-DDTHH:mm:ss" in `timezone`) is given.
router.post('/api/social/publish', authenticateToken, validate(publishSchema), async (req, res) => {
  const { postId, accountIds, scheduledFor, timezone } = req.body;
  try {
    const post = (await dbService.getUserPosts(req.user.userId)).find((p) => p.id === postId);
    if (!post) return res.status(404).json({ error: 'Post not found. Save it first.' });
    const accounts = (await listSocialAccounts(req.user.userId)).filter((a) => accountIds.includes(a.id));
    if (accounts.length !== accountIds.length) return res.status(400).json({ error: 'One of the selected accounts is no longer connected.' });

    const mediaUrl = await toPublicMediaUrl(post.imageUrl, post.id);
    const { post: zPost } = await zernio('/posts', {
      method: 'POST',
      body: {
        title: post.id,
        content: post.caption,
        ...(mediaUrl ? { mediaItems: [{ url: mediaUrl, type: 'image' }] } : {}),
        platforms: accounts.map((a) => ({ platform: a.platform, accountId: a.id })),
        ...(scheduledFor ? { scheduledFor, timezone: timezone || 'Asia/Manila' } : { publishNow: true }),
      },
    });

    const published = zPost.status === 'published' || zPost.status === 'partial';
    const updated = published
      ? { ...post, status: 'Published', publishedAt: zPost.publishedAt || new Date().toISOString(), externalLink: firstPlatformUrl(zPost) || post.externalLink }
      : { ...post, status: 'Scheduled' };
    await dbService.savePost(updated);

    const who = await dbService.describeUser(req.user.userId);
    const where = accounts.map((a) => `${a.platform} @${a.username}`).join(', ');
    await dbService.logAudit(
      req.user.userId,
      published ? 'publish_post' : 'schedule_post',
      `${who} ${published ? 'published' : `scheduled for ${scheduledFor} (${timezone || 'Asia/Manila'})`} "${post.topic}" to ${where} (post:${post.id})`
    );
    res.json(updated);
  } catch (error) {
    sendUpstreamError(res, error, 'Failed to publish post');
  }
});

// Pull back publish results for scheduled posts (matched by Zernio post title = Kawayan post id).
router.post('/api/social/sync', authenticateToken, async (req, res) => {
  try {
    const scheduled = (await dbService.getUserPosts(req.user.userId)).filter((p) => p.status === 'Scheduled');
    if (scheduled.length === 0) return res.json({ published: 0, failed: 0, failedIds: [] });
    const profileId = await getZernioProfileId(req.user.userId);
    const { posts: zPosts = [] } = await zernio(`/posts?profileId=${profileId}&limit=500`);
    let published = 0;
    const failedIds = [];
    // The outcome goes in the audit trail too, so the admin dispatch table can show it.
    let who;
    const logOutcome = async (action, post, what) => {
      who ??= await dbService.describeUser(req.user.userId);
      await dbService.logAudit(req.user.userId, action, `${who} — scheduled post "${post.topic}" ${what} (post:${post.id})`);
    };
    for (const post of scheduled) {
      const z = zPosts.find((zp) => zp.title === post.id);
      if (!z) continue;
      if (z.status === 'published' || z.status === 'partial') {
        await dbService.savePost({ ...post, status: 'Published', publishedAt: z.publishedAt || new Date().toISOString(), externalLink: firstPlatformUrl(z) || post.externalLink });
        published++;
        await logOutcome('post_published', post, 'went live');
      } else if (z.status === 'failed') {
        await dbService.savePost({ ...post, status: 'Draft' });
        failedIds.push(post.id);
        await logOutcome('post_failed', post, 'failed to publish and went back to Draft');
      }
    }
    res.json({ published, failed: failedIds.length, failedIds });
  } catch (error) {
    sendUpstreamError(res, error, 'Failed to sync post status');
  }
});

export default router;
