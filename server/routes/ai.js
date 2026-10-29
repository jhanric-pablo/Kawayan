// Text and image generation for content plans, captions, post images, and the support bot.
import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../../src/utils/logger.ts';
import { authenticateToken, validate, text } from '../shared.js';

const router = Router();

const promptSchema = z.object({ prompt: text('prompt is required', 30000) });

// Any OpenAI-compatible chat API works. Providers are tried in order and the next one takes
// over on a quota error, outage or timeout, so one free tier running dry doesn't stop a demo.
// Default: OpenAI's open-weight gpt-oss-120b on Cloudflare Workers AI, the same account the
// images use (about 100 month plans a day on the free allocation). Setting GROQ_API_KEY puts
// Groq first: same model, a few times faster, with its own free daily limit.
const TEXT_AI_PROVIDERS = [
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

router.post('/api/ai/text', authenticateToken, validate(promptSchema), async (req, res) => {
  const { prompt } = req.body;
  if (TEXT_AI_PROVIDERS.length === 0) return res.status(503).json({ error: 'AI service not configured', degraded: true });

  let rateLimited = false;
  for (const provider of TEXT_AI_PROVIDERS) {
    try {
      const response = await fetch(provider.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${provider.key}`, 'Content-Type': 'application/json' },
        // Cloudflare stops at 256 tokens unless told otherwise, which cuts a month plan mid-JSON.
        body: JSON.stringify({ model: provider.model, messages: [{ role: 'user', content: prompt }], max_tokens: 4096 }),
        signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS) || 45000),
      });
      if (!response.ok) {
        rateLimited ||= response.status === 429;
        throw new Error(`${response.status} ${(await response.text().catch(() => '')).slice(0, 200)}`);
      }
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('Empty response');
      return res.json({ text });
    } catch (error) {
      logger.warn('Text AI provider failed', { provider: provider.name, message: error?.message });
    }
  }
  // Every provider failed. The calendar shows its daily-limit notice when the error mentions "quota".
  res.status(rateLimited ? 429 : 503).json({ error: rateLimited ? 'AI quota reached for today' : 'AI service unavailable', degraded: true });
});

// Cloudflare Workers AI image proxy (post images, free tier)
router.post('/api/ai/cloudflare-image', authenticateToken, validate(promptSchema), async (req, res) => {
  const { prompt } = req.body;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) return res.status(503).json({ error: 'Image service not configured', degraded: true });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.CLOUDFLARE_TIMEOUT_MS) || 30000);

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Cloudflare Workers AI error: ${response.status} - ${errText}`);
    }

    // Success returns the raw image bytes (image/png), not JSON.
    const buffer = Buffer.from(await response.arrayBuffer());
    res.json({ imageUrl: `data:image/png;base64,${buffer.toString('base64')}` });
  } catch (error) {
    const aborted = error?.name === 'AbortError';
    logger.warn('Cloudflare image proxy error', { aborted, message: error?.message });
    res.status(503).json({ error: aborted ? 'Image request timed out' : 'Image service unavailable', degraded: true });
  } finally {
    clearTimeout(timeout);
  }
});

export default router;
