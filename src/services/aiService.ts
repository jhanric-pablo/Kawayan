import { BrandProfile, ContentIdea } from "../types";
import { ValidationService } from "./validationService";
import { logger } from "../utils/logger";
import { normalizeIdeasToBatchCount } from "../utils/tierLimits";
import { storePostImage } from "../utils/postImage";
import { industryLabel } from '../constants/industries';

// The AI routes need a login: they spend the app's free AI allowance.
const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('kawayan_jwt');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

// --- Text AI (server-proxied, so provider keys never reach the browser; see /api/ai/text) ---
const callTextAI = async (prompt: string): Promise<string> => {
  const response = await fetch('/api/ai/text', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ prompt })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return data.text || "";
};

const stripThinking = (text: string) => {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
};

const extractJson = (text: string) => {
  const cleaned = stripThinking(text);
  // Try to find a JSON block (array or object)
  const jsonMatch = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("Failed to parse extracted JSON:", e);
      // Fallback to basic parse if regex-based extraction fails
      return JSON.parse(cleaned);
    }
  }
  return JSON.parse(cleaned);
};

export const generateContentPlan = async (
  profile: BrandProfile,
  month: string,
  itemCount: number = 8,
  /** The owner's focus for the month, e.g. "Promo / limited-time sale". */
  focus = '',
  /** Optional extras from the Month planner page; older callers leave them out. */
  extras: { formats?: string[]; dates?: { day: number; name: string }[]; notes?: string } = {}
): Promise<ContentIdea[]> => {
    const focusRule = focus.trim()
      ? `- THIS MONTH'S FOCUS, set by the owner: "${focus.trim()}". Build most ideas around it, mixed with a few evergreen posts.`
      : '';
    const formatRule = extras.formats?.length
      ? `- Use only these formats: ${extras.formats.join(', ')}.`
      : '';
    const datesRule = extras.dates?.length
      ? `- The owner picked these dates to post about (day: occasion): ${extras.dates.map((d) => `${d.day}: ${d.name}`).join('; ')}. Put one idea on each of these days, tied to the occasion.`
      : '';
    const notesRule = extras.notes?.trim()
      ? `- The owner's notes for this month: "${extras.notes.trim().slice(0, 600)}". Respect them (for example, don't plan posts on days they say they're closed).`
      : '';
    const prompt = `
    Analyze the following brand profile:
    - Business Name: ${profile.businessName}
    - Industry: ${industryLabel(profile.industry)}
    - Target Audience: ${profile.targetAudience}
    - Brand Voice: ${profile.brandVoice}
    - Key Themes: ${profile.keyThemes}

    Based on this profile, create a ${itemCount}-item social media content plan for the month of ${month}.
    You MUST return exactly ${itemCount} unique content ideas — no fewer, no more.
    The plan should be diverse and align with the brand's voice and goals.
    
    CRITICAL INSTRUCTIONS:
    - NO GENERIC CONTENT. Avoid phrases like "Start the month right" or "Check out our products".
    - BE SPECIFIC. Create content that only makes sense for THIS brand.
    - USE TAGLISH. The 'title' and 'topic' must be in natural, modern Taglish (mix of Tagalog/English) or Filipino.
    - PHILIPPINE CONTEXT. Tie ideas to Philippine seasons, events and paydays (15th and 30th). Never use holidays Filipinos don't celebrate, like Thanksgiving.
    ${focusRule}
    ${formatRule}
    ${datesRule}
    ${notesRule}
    - NO MADE-UP OFFERS. Unless the owner's focus names them, never invent prices, percentages, "buy X get Y" deals, freebies or giveaways. Say "a special promo" or "a bundle deal" and let the owner add the details.
    - Spread 'day' values evenly across the month (1–28), starting from today when planning the current month.
    - OUTPUT ONLY JSON. No explanation before or after.
    
    The output must be ONLY a valid JSON array of exactly ${itemCount} objects:
    [{"day": number, "title": "string", "topic": "string", "format": "Image"}]
  `;
  try {
    logger.info("Generating content plan with prompt:", prompt);
    const res = await callTextAI(prompt);
    const data = extractJson(res);
    logger.info("Received and parsed content plan:", data);
    const validated = ValidationService.validateContentIdeas(data);
    return normalizeIdeasToBatchCount(validated, itemCount);
  } catch (e: any) {
    logger.error("Error generating content plan:", e.message);
    // Let the caller decide how to handle this (e.g. show a quota-exceeded
    // message) rather than silently returning generic fallback ideas that
    // look identical to a successful AI generation.
    throw e;
  }
};

export const generatePostCaptionAndImagePrompt = async (profile: BrandProfile, topic: string): Promise<any> => {
  const industry = industryLabel(profile.industry);
  const languageInstruction = profile.language === 'English'
    ? 'clear, friendly Philippine English (no Tagalog)'
    : profile.language === 'Filipino'
      ? 'natural Filipino (Tagalog), with English only for brand or product names'
      : 'natural, modern Taglish (mix of Tagalog and English)';
  const prompt = `
You are an expert social media strategist and visual creative director for "${profile.businessName}" (${industry}), specializing in creating engaging, locally relevant social media content for Filipino MSMEs.

Create one Facebook/Instagram post about: "${topic}".

BRAND IDENTITY:
- Business Name: ${profile.businessName}
- Industry: ${industry}
- Target Audience: ${profile.targetAudience}
- Brand Voice: ${profile.brandVoice}
- Key Themes: ${profile.keyThemes}${profile.city ? `\n- Location: ${profile.city}` : ''}

Your task is to generate an engaging caption, a highly specific AI image-generation prompt, and an estimated content virality score.

1. CAPTION

Write a compelling, natural, high-engagement caption in ${languageInstruction}.

Follow these requirements:
- Capture attention in the opening line with a relatable observation, interesting hook, storytelling, question, humor, or hugot that fits the topic.
- Match the business's established brand voice. Do not force humor or slang when they do not fit.
- Write naturally, as a Filipino business owner would communicate with their customers.
- Avoid generic marketing phrases such as "Check out our amazing...", "Perfect for you", and "Don't miss out!"
- Use at most 2 emojis. Place them naturally at the end of a line, never randomly in the middle of a sentence or several in a row.
- Include a natural conversational question or call to action when appropriate. Do not force one into every post.
- End with 3–5 relevant Philippine or local hashtags. Use the provided city and audience context when choosing local hashtags. Never invent a neighborhood or location.
- Keep the content culturally relevant to the Philippines. Use local events, seasons, occasions and humor when appropriate. Never introduce holidays Filipinos do not generally celebrate, such as Thanksgiving.
- Never invent prices, discounts, percentages, buy-one-get-one offers, freebies, giveaways, limited-time offers, opening hours or other promotional details unless explicitly stated in the topic or brand information.
- Do not make unsupported claims about product quality, health benefits or business services.

2. IMAGE PROMPT

Act as a professional advertising art director creating the visual direction for this specific social media post.

Generate ONE detailed, production-ready image prompt for an AI image generator.

IMPORTANT OUTPUT REQUIREMENTS:
- Write the entire imagePrompt in ENGLISH, regardless of the caption language.
- Use ONE continuous paragraph. No bullet points, headings, quotation marks or multiple alternatives.
- Aim for approximately 60–90 words.
- The FIRST SENTENCE must immediately describe the main subject and its setting. Do not start with vague phrases such as "A beautiful image of..." or "Create an eye-catching post..."
- Put the most important visual information in the first 75 words, because some image generators may pay less attention to later instructions.
- Describe one clear focal subject, its appearance, relevant supporting objects, and the surrounding environment.
- Include the appropriate visual style, composition, lighting, colour mood and realistic details.
- Create one coherent scene, not a collage of unrelated images.

CHOOSE THE APPROPRIATE VISUAL STYLE:
Do not automatically use professional photography for every post. Choose the visual treatment that best communicates the topic:

- Product or food posts: Use realistic, appetizing product or editorial photography with believable textures, natural presentation and attractive lighting.
- Service or experience posts: Use realistic lifestyle or commercial photography showing the service in a believable, welcoming environment.
- Educational, awareness or informational posts: Use polished editorial illustration or a clean conceptual visual when it communicates the idea better than a photograph.
- Inspirational or community-related posts: Use a suitable lifestyle photograph or thoughtfully designed illustration.
- Simple promotional or announcement topics: Use a clean, visually engaging graphic-style composition when appropriate, without requiring any written text.

Select ONE suitable style per image. Do not combine unrelated visual styles.

FILIPINO VISUAL AUTHENTICITY:
- Make the scene appropriate for a Filipino audience and the business's Philippine setting.
- When relevant, depict contemporary Filipino adults with natural, believable appearances, everyday clothing and authentic expressions.
- Use locally plausible food presentation, interiors, storefront environments, objects and surroundings appropriate to the industry.
- If a city is provided, incorporate subtle local context where it naturally fits. Do not force recognizable landmarks into unrelated scenes.
- Avoid stereotypical, exaggerated or tourist-oriented representations of Filipino culture.
- Make the setting feel authentic rather than like a generic foreign stock photograph.

BRAND IDENTITY IN THE IMAGE:
- Translate the brand voice and key themes into the visual mood, atmosphere, styling and subject selection.
- Use the actual products, services and business context implied by the topic and brand information.
- Let the subject's natural colours guide the colour palette. Do not invent specific brand colours, logos, uniforms, packaging or store designs that the owner has not provided.
- Prioritize recognizable products and relevant business details over decorative elements.

IMAGE CLEANLINESS AND ACCURACY:
- DO NOT generate readable text, captions, letters, numbers, typography, signage, menu boards, price tags, labels, logos, watermarks, QR codes or social media interface elements.
- DO NOT display the business name or invent a business logo.
- NEVER include prices, discounts, phone numbers, promotional claims, free items or other invented offer details.
- Use plain, unbranded packaging whenever packaging is necessary.
- Avoid misspelled words, fake branding, distorted objects, excessive decorations and irrelevant background elements.
- Do not add products, ingredients, equipment or services that are inconsistent with the business or post topic.

COMPOSITION:
- Design specifically for a 1:1 square Facebook/Instagram feed image.
- Give the main subject a clear visual presence and enough space to remain recognizable at mobile-screen size.
- Use balanced framing, intentional foreground and background details, and appropriate lighting.
- Keep the composition visually clean, attractive and immediately understandable.

The final imagePrompt should read like a concise professional creative brief that an image-generation model can execute directly. Do not include explanations or references to these instructions.

3. VIRALITY SCORE

Give an estimated content virality score from 0 to 100.

Consider:
- Relevance to the specified target audience.
- Strength of the opening hook and emotional appeal.
- Potential for comments, reactions and conversations.
- Potential for sharing or saving.
- Relevance to Philippine culture, timing, seasons and local occasions.

Use realistic judgment. Do not automatically assign high scores to every post. This is an estimate of content potential, not a guaranteed prediction of actual reach.

4. VIRALITY REASON

Write one brief sentence in ENGLISH explaining why the post received its score. Mention its strongest engagement opportunity.

OUTPUT REQUIREMENTS:

Return ONLY one valid JSON object. No Markdown, code fences, introduction or explanations.

Use EXACTLY these four keys:
{"caption": "string", "imagePrompt": "string", "viralityScore": number from 0 to 100, "viralityReason": "string"}

Ensure imagePrompt is one English paragraph and all JSON strings are properly escaped. Never omit a key or introduce additional keys.
`;
  try {
    logger.info("Generating post with prompt:", prompt);
    const res = await callTextAI(prompt);
    const data = extractJson(res);
    logger.info("Received and parsed post:", data);
    return ValidationService.validatePostResponse(data);
  } catch (e: any) {
    logger.error("Error generating post caption and image prompt:", e.message);
    // Let the caller decide how to handle this (e.g. show a quota-exceeded
    // message, or stop a batch run) rather than silently returning a generic
    // fallback caption that looks identical to a successful AI generation.
    throw e;
  }
};

export interface CaptionRewrite {
  caption: string;
  viralityScore?: number;
  viralityReason?: string;
}

/** One targeted edit of an existing caption ("make it shorter"), re-scored. */
export const rewriteCaption = async (profile: BrandProfile, caption: string, instruction: string): Promise<CaptionRewrite> => {
  const prompt = `
    You are the social media manager for "${profile.businessName}" (${industryLabel(profile.industry)}).
    Brand voice: ${profile.brandVoice}. Audience: ${profile.targetAudience}.

    Rewrite the caption below. Instruction: ${instruction}

    Rules:
    - Keep natural, modern Taglish unless the instruction says otherwise.
    - Keep it Philippine: local context only, never holidays Filipinos don't celebrate.
    - Don't invent prices, dates or promos that aren't in the caption or the instruction.
    - Then rate the new caption's virality from 0 to 100 with a one-sentence English reason.

    Caption:
    <<<
    ${caption}
    >>>

    OUTPUT ONLY JSON. Format: {"caption": "string", "viralityScore": number, "viralityReason": "string"}
  `;
  const data = extractJson(await callTextAI(prompt));
  if (typeof data?.caption !== 'string' || !data.caption.trim()) throw new Error('The AI did not return a caption');
  const score = Number(data.viralityScore);
  return {
    caption: data.caption.trim(),
    viralityScore: Number.isFinite(score) && score >= 0 && score <= 100 ? Math.round(score) : undefined,
    viralityReason: typeof data.viralityReason === 'string' && data.viralityReason.trim() ? data.viralityReason.trim() : undefined,
  };
};

// The server tries Azure FLUX.2-pro, then Cloudflare Workers AI (SDXL); see /api/ai/cloudflare-image.
// Falls back to Pollinations.ai (free, no key) if both fail.
export const generateImageFromPrompt = async (prompt: string): Promise<string | null> => {
  try {
    const response = await fetch('/api/ai/cloudflare-image', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ prompt }),
    });
    if (!response.ok) throw new Error(`Cloudflare image proxy error: ${response.status}`);
    const data = await response.json();
    if (data.imageUrl) return await storePostImage(data.imageUrl);
    throw new Error('No image returned');
  } catch (e: any) {
    logger.error("Cloudflare image generation failed, falling back to Pollinations:", e.message);
    // Pollinations draws the picture only when the link is first loaded, so wait for it here:
    // the post then gets an image that's really there, not a link that shows up only after a refresh.
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1080&height=1080&nologo=true&seed=${Date.now()}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Pollinations error: ${res.status}`);
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      return await storePostImage(dataUrl);
    } catch {
      return (await preloadImage(url)) ? url : null;
    }
  }
};

/** Resolves true once the browser has the image, false if it fails or takes over 60 s. */
export const preloadImage = (url: string, timeoutMs = 60_000): Promise<boolean> =>
  new Promise((resolve) => {
    const img = new Image();
    const t = window.setTimeout(() => resolve(false), timeoutMs);
    img.onload = () => { window.clearTimeout(t); resolve(true); };
    img.onerror = () => { window.clearTimeout(t); resolve(false); };
    img.src = url;
  });

// --- Kawi, the help bot: answers from the Kawayan fact sheet + the owner's account (see /api/ai/kawi) ---
export type KawiAction = 'open_calendar' | 'open_planner' | 'open_studio' | 'open_channels' | 'open_billing' | 'open_settings' | 'open_insights' | 'talk_to_person';
export interface KawiTurn { role: 'user' | 'assistant'; text: string }
export interface KawiAnswer { reply: string; actions: KawiAction[]; handoff: boolean }

const kawiCall = async (body: object) => {
  const response = await fetch('/api/ai/kawi', { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Kawi error: ${response.status}`);
  return response.json();
};

/** One answer from Kawi. `account` is a short plain-text summary of the owner's plan, pages and posts. */
export const askKawi = (message: string, history: KawiTurn[], account = ''): Promise<KawiAnswer> =>
  kawiCall({ mode: 'answer', message, history: history.slice(-12), account });

/** Two or three bullets for the support agent taking over; null if the AI can't write them right now. */
export const summarizeKawi = async (history: KawiTurn[]): Promise<string | null> => {
  try {
    const { summary } = await kawiCall({ mode: 'summary', history: history.slice(-24) });
    return typeof summary === 'string' && summary.trim() ? summary.trim() : null;
  } catch {
    return null;
  }
};

/** The help panel's Assistant tab: same Kawi, without the account summary. */
export const chatWithSupportBot = async (message: string, history: {sender: 'user'|'bot', text: string}[]): Promise<string> => {
  try {
    const { reply } = await askKawi(message, history.map((h) => ({ role: h.sender === 'user' ? 'user' : 'assistant', text: h.text })));
    return reply;
  } catch {
    // Tell the owner to talk to a person instead of making up an answer.
    return "The assistant can't answer right now. Tap **Talk to a person instead** below, or message or call our team from Home.";
  }
};