// Text and image generation for content plans, captions, post images, and the support bot.
import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../../src/utils/logger.ts';
import { authenticateToken, validate, text } from '../shared.js';
import { KAWI_ACTIONS, KAWI_SUMMARY_PROMPT, kawiSystemPrompt } from '../kawiFacts.js';

const router = Router();

const promptSchema = z.object({ prompt: text('prompt is required', 30000) });

// Any OpenAI-compatible chat API works. Providers are tried in order and the next one takes
// over on a quota error, outage or timeout, so one free tier running dry doesn't stop a demo.
// Default: OpenAI's open-weight gpt-oss-120b on Cloudflare Workers AI, the same account the
// images use (about 100 month plans a day on the free allocation). Setting GROQ_API_KEY puts
// Groq first: same model, a few times faster, with its own free daily limit.
// Tolerate stray spaces, quotes or <angle brackets> left from pasting into .env.
const clean = (v) => v?.trim().replace(/^["'<]+|["'>]+$/g, '');
const azureEndpoint = clean(process.env.AZURE_OPENAI_ENDPOINT), azureKey = clean(process.env.AZURE_OPENAI_API_KEY);
const azureTextModel = clean(process.env.AZURE_TEXT_MODEL); // the deployment name, e.g. kawayan-text

const TEXT_AI_PROVIDERS = [
  // Azure first when a text deployment is set: same key and resource as the FLUX images.
  azureEndpoint && azureKey && azureTextModel && {
    name: 'Azure',
    url: `${new URL(azureEndpoint).origin}/openai/v1/chat/completions`,
    key: azureKey,
    model: azureTextModel,
    azure: true,
  },
  process.env.GROQ_API_KEY && {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  },
  process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN && {
    name: 'Cloudflare Workers AI',
    url: `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions`,
    key: process.env.CLOUDFLARE_API_TOKEN,
    model: process.env.CLOUDFLARE_TEXT_MODEL || '@cf/openai/gpt-oss-120b',
  },
].filter(Boolean);

/** One chat completion, trying each provider in order. Throws with .status (429 quota, 503 down) when all fail. */
async function chatComplete(messages) {
  if (TEXT_AI_PROVIDERS.length === 0) throw Object.assign(new Error('AI service not configured'), { status: 503 });
  let rateLimited = false;
  for (const provider of TEXT_AI_PROVIDERS) {
    try {
      const response = await fetch(provider.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${provider.key}`, 'api-key': provider.key, 'Content-Type': 'application/json' },
        // Cloudflare stops at 256 tokens unless told otherwise, which cuts a month plan mid-JSON.
        // gpt-oss "thinks" before answering; low effort cuts a caption from ~19 s to ~6 s with the same JSON.
        // Azure's GPT-5 family wants max_completion_tokens; non-reasoning models (gpt-4.1) reject reasoning_effort.
        body: JSON.stringify({
          model: provider.model,
          messages,
          [provider.azure ? 'max_completion_tokens' : 'max_tokens']: 4096,
          ...(!provider.azure || /gpt-5|^o\d/i.test(provider.model) ? { reasoning_effort: process.env.AI_REASONING_EFFORT || 'low' } : {}),
        }),
        signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS) || 45000),
      });
      if (!response.ok) {
        rateLimited ||= response.status === 429;
        throw new Error(`${response.status} ${(await response.text().catch(() => '')).slice(0, 200)}`);
      }
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('Empty response');
      return text;
    } catch (error) {
      logger.warn('Text AI provider failed', { provider: provider.name, message: error?.message });
    }
  }
  // Every provider failed. The calendar shows its daily-limit notice when the error mentions "quota".
  throw Object.assign(new Error(rateLimited ? 'AI quota reached for today' : 'AI service unavailable'), { status: rateLimited ? 429 : 503 });
}

router.post('/api/ai/text', authenticateToken, validate(promptSchema), async (req, res) => {
  try {
    res.json({ text: await chatComplete([{ role: 'user', content: req.body.prompt }]) });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message, degraded: true });
  }
});

// Kawi, the in-app help bot: answers from the Kawayan fact sheet plus the owner's account summary
// (sent by the app), or writes the handoff notes for the support agent who takes over.
const kawiSchema = z.object({
  mode: z.enum(['answer', 'summary']).default('answer'),
  message: z.string().trim().max(1000).default(''),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(4000) })).max(24).default([]),
  account: z.string().max(2000).default(''),
});
const stripThinking = (s) => s.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

/** The model's JSON, kept to known actions; plain text still works as a reply. */
const parseKawi = (raw) => {
  const text = stripThinking(raw);
  try {
    const data = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '');
    const reply = typeof data.reply === 'string' ? data.reply.trim() : '';
    if (reply) {
      const actions = (Array.isArray(data.actions) ? data.actions : []).filter((a) => KAWI_ACTIONS.includes(a)).slice(0, 2);
      return { reply, actions, handoff: data.handoff === true };
    }
  } catch { /* not JSON: use the text as is */ }
  return text
    ? { reply: text, actions: [], handoff: false }
    : { reply: 'Sorry, I couldn’t answer that. A person from our team can help.', actions: ['talk_to_person'], handoff: true };
};

// Each Kawi answer is a paid AI call, so one account gets 40 every 10 minutes.
// ponytail: in memory per server instance; move to the database if Kawayan runs on several instances.
const KAWI_LIMIT = 40, KAWI_WINDOW_MS = 10 * 60 * 1000;
const kawiCalls = new Map();
const kawiAllowed = (userId) => {
  const now = Date.now();
  const recent = (kawiCalls.get(userId) || []).filter((t) => now - t < KAWI_WINDOW_MS);
  const ok = recent.length < KAWI_LIMIT;
  if (ok) recent.push(now);
  kawiCalls.set(userId, recent);
  return ok;
};

router.post('/api/ai/kawi', authenticateToken, validate(kawiSchema), async (req, res) => {
  const { mode, message, history, account } = req.body;
  if (!kawiAllowed(req.user.userId)) return res.status(429).json({ error: 'Too many questions in a short time. Try again in a few minutes.' });
  try {
    if (mode === 'summary') {
      const transcript = history.map((h) => `${h.role === 'user' ? 'Owner' : 'Kawi'}: ${h.text}`).join('\n');
      const summary = await chatComplete([{ role: 'system', content: KAWI_SUMMARY_PROMPT }, { role: 'user', content: transcript || '(empty)' }]);
      return res.json({ summary: stripThinking(summary) });
    }
    if (!message) return res.status(400).json({ error: 'message is required', field: 'message' });
    const raw = await chatComplete([
      { role: 'system', content: kawiSystemPrompt(account) },
      ...history.slice(-12).map((h) => ({ role: h.role, content: h.text })),
      { role: 'user', content: message },
    ]);
    res.json(parseKawi(raw));
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message, degraded: true });
  }
});

// Post images. Azure FLUX.2 [pro] first when it's set up (paid from the Azure credit, sharper and
// more realistic), then Cloudflare Workers AI SDXL (free tier). Each returns a data: URL, which the
// browser compresses and stores, so the post never depends on a provider link that expires.
const toDataUrl = (buffer, type = 'image/png') => `data:${type};base64,${buffer.toString('base64')}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Azure FLUX via the Black Forest Labs route; see learn.microsoft.com "Deploy and use FLUX models in Microsoft Foundry". */
async function azureFluxImage(prompt) {
  const endpoint = azureEndpoint, key = azureKey;
  if (!endpoint || !key) return null;
  // Accept the bare resource URL or the full Target URI pasted from the portal.
  const base = new URL(endpoint).origin;
  const path = process.env.AZURE_IMAGE_MODEL_PATH || 'flux-2-pro';
  const body = JSON.stringify({
    model: process.env.AZURE_IMAGE_MODEL || 'FLUX.2-pro', // the deployment name
    prompt,
    width: 1024,
    height: 1024,
    output_format: 'jpeg',
    num_images: 1,
    safety_tolerance: 2,
  });
  // One retry when Azure says it's busy (FLUX.2 pro allows 15 requests a minute on the low tier).
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(`${base}/providers/blackforestlabs/v1/${path}?api-version=preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'api-key': key },
      body,
      signal: AbortSignal.timeout(Number(process.env.AZURE_IMAGE_TIMEOUT_MS) || 90000),
    });
    if (response.status === 429 && attempt === 0) {
      await sleep(Math.min(20, Number(response.headers.get('retry-after')) || 6) * 1000);
      continue;
    }
    if (!response.ok) throw new Error(`Azure FLUX ${response.status} ${(await response.text().catch(() => '')).slice(0, 200)}`);
    const data = await response.json();
    // The docs promise "a URL or base64 image data"; take whichever came back.
    const item = data.data?.[0] ?? data.images?.[0] ?? data.result ?? data;
    const b64 = item?.b64_json ?? item?.b64 ?? item?.image ?? (typeof item === 'string' && !item.startsWith('http') ? item : null);
    if (b64) return b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`;
    const url = item?.url ?? item?.sample ?? (typeof item === 'string' ? item : null);
    if (!url) throw new Error(`Azure FLUX: no image in response (keys: ${Object.keys(data).join(', ')})`);
    const img = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!img.ok) throw new Error(`Azure FLUX image download ${img.status}`);
    return toDataUrl(Buffer.from(await img.arrayBuffer()), img.headers.get('content-type') || 'image/jpeg');
  }
  throw new Error('Azure FLUX still busy after retry');
}

async function cloudflareImage(prompt) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID, token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) return null;
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(Number(process.env.CLOUDFLARE_TIMEOUT_MS) || 30000),
    },
  );
  if (!response.ok) throw new Error(`Cloudflare ${response.status} ${(await response.text().catch(() => '')).slice(0, 200)}`);
  // Success returns the raw image bytes (image/png), not JSON.
  return toDataUrl(Buffer.from(await response.arrayBuffer()));
}

const IMAGE_PROVIDERS = [['Azure FLUX', azureFluxImage], ['Cloudflare Workers AI', cloudflareImage]];

// The route keeps its old name so the browser code doesn't change.
router.post('/api/ai/cloudflare-image', authenticateToken, validate(promptSchema), async (req, res) => {
  const { prompt } = req.body;
  let configured = false;
  for (const [name, generate] of IMAGE_PROVIDERS) {
    try {
      const imageUrl = await generate(prompt);
      if (imageUrl === null) continue; // not set up
      configured = true;
      return res.json({ imageUrl, provider: name });
    } catch (error) {
      configured = true;
      logger.warn('Image provider failed', { provider: name, aborted: error?.name === 'TimeoutError', message: error?.message });
    }
  }
  res.status(503).json({ error: configured ? 'Image service unavailable' : 'Image service not configured', degraded: true });
});

export default router;
