// Brand profiles, posts, and monthly content plans.
import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../../src/utils/logger.ts';
import { dbService, authenticateToken, validate, id, isStaff, isSelfOrAdmin } from '../shared.js';

const router = Router();

const optionalText = (max) => z.string().max(max).nullish();

const profileSchema = z.object({
  userId: id,
  businessName: z.string().trim().max(200),
  industry: z.string().max(200),
  targetAudience: z.string().max(2000),
  brandVoice: z.string().max(200),
  keyThemes: z.string().max(2000),
  brandColors: z.array(z.string().max(20)).max(20).optional(),
  contactEmail: optionalText(254),
  contactPhone: optionalText(50),
});

const postSchema = z.object({
  id,
  userId: id,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  topic: z.string().max(500).optional(),
  caption: z.string().max(5000).optional(),
  imagePrompt: z.string().max(2000).optional(),
  imageUrl: optionalText(8_000_000), // AI images are stored as base64 data URLs (~1 MB)
  status: z.enum(['Draft', 'Scheduled', 'Published']),
  viralityScore: z.number().nullish(),
  viralityReason: optionalText(2000),
  format: optionalText(50),
  externalLink: optionalText(2000),
  publishedAt: optionalText(50),
  regenCount: z.number().int().min(0).optional(),
  history: z.array(z.looseObject({})).max(50).optional(),
});

const planSchema = z.object({
  userId: id,
  month: z.string().trim().min(1).max(20),
  ideas: z.array(z.looseObject({ day: z.number().int().min(1).max(31), title: z.string().max(500), topic: z.string().max(500) })).max(100),
});

// Brand profiles
router.post('/api/profiles', authenticateToken, validate(profileSchema), async (req, res) => {
  const profile = req.body;
  if (!isSelfOrAdmin(req.user, profile.userId)) return res.status(403).json({ error: 'Unauthorized' });

  try {
    await dbService.saveProfile(profile);
    res.json({ message: 'Profile saved successfully' });
  } catch (error) {
    logger.error('Save profile error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/profiles/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  if (!isSelfOrAdmin(req.user, userId) && !isStaff(req.user)) return res.status(403).json({ error: 'Unauthorized' });

  try {
    const profile = await dbService.getProfile(userId);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json(profile);
  } catch (error) {
    logger.error('Get profile error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Posts
router.post('/api/posts', authenticateToken, validate(postSchema), async (req, res) => {
  const post = req.body;
  if (!isSelfOrAdmin(req.user, post.userId)) return res.status(403).json({ error: 'Unauthorized' });

  try {
    await dbService.savePost(post);
    res.json({ message: 'Post saved successfully' });
  } catch (error) {
    if (error.code === 'TIER_LIMIT_REACHED') {
      return res.status(403).json({
        error: 'TIER_LIMIT_REACHED',
        message: `Monthly post limit of ${error.limit} reached for your subscription tier.`,
        limit: error.limit,
      });
    }
    if (error.code === 'ADDON_NOT_PAID') return res.status(402).json({ error: 'Pay for the extra post from your wallet first.' });
    if (error.code === 'FORBIDDEN') return res.status(403).json({ error: 'Unauthorized' });
    logger.error('Save post error', { error: error.message });
    res.status(500).json({ error: 'Failed to save post' });
  }
});

router.get('/api/posts/user/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  if (!isSelfOrAdmin(req.user, userId) && !isStaff(req.user)) return res.status(403).json({ error: 'Unauthorized' });

  try {
    res.json(await dbService.getUserPosts(userId));
  } catch (error) {
    logger.error('Get posts error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Plans
router.post('/api/plans', authenticateToken, validate(planSchema), async (req, res) => {
  const { userId, month, ideas } = req.body;
  if (!isSelfOrAdmin(req.user, userId)) return res.status(403).json({ error: 'Unauthorized' });

  try {
    await dbService.savePlan(userId, month, ideas);
    res.json({ message: 'Plan saved successfully' });
  } catch (error) {
    logger.error('Save plan error', { error: error.message });
    res.status(500).json({ error: 'Failed to save plan' });
  }
});

router.get('/api/plans/:userId/:month', authenticateToken, async (req, res) => {
  const { userId, month } = req.params;
  if (!isSelfOrAdmin(req.user, userId) && !isStaff(req.user)) return res.status(403).json({ error: 'Unauthorized' });

  try {
    res.json(await dbService.getPlan(userId, month));
  } catch (error) {
    logger.error('Get plan error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch plan' });
  }
});

export default router;
