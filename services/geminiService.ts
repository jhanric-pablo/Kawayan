import { BrandProfile, ContentIdea } from "../types";
import { ValidationService } from "./validationService";
import { logger } from "../utils/logger";
import { normalizeIdeasToBatchCount } from "../utils/tierLimits";

// --- UNSLOTH LLM API (BACKEND PROXIED) ---
const callUnslothLLM = async (prompt: string): Promise<string> => {
  const response = await fetch('/api/ai/unsloth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: prompt }
      ],
      stream: false
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Unsloth Proxy Error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
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

const generateWithFallback = async (prompt: string) => {
  console.log("Attempting Unsloth LLM API...");
  return await callUnslothLLM(prompt);
};

export const generateContentPlan = async (
  profile: BrandProfile,
  month: string,
  itemCount: number = 8
): Promise<ContentIdea[]> => {
    const prompt = `
    Analyze the following brand profile:
    - Business Name: ${profile.businessName}
    - Industry: ${profile.industry}
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
    - Spread 'day' values evenly across the month (1–28).
    - OUTPUT ONLY JSON. No explanation before or after.
    
    The output must be ONLY a valid JSON array of exactly ${itemCount} objects:
    [{"day": number, "title": "string", "topic": "string", "format": "string"}]
  `;
  try {
    logger.info("Generating content plan with prompt:", prompt);
    const res = await generateWithFallback(prompt);
    const data = extractJson(res);
    logger.info("Received and parsed content plan:", data);
    const validated = ValidationService.validateContentIdeas(data);
    return normalizeIdeasToBatchCount(validated, itemCount);
  } catch (e: any) {
    logger.error("Error generating content plan:", e.message);
    return normalizeIdeasToBatchCount(
      ValidationService.createFallbackContentIdeas(month, itemCount),
      itemCount
    );
  }
};

export const generatePostCaptionAndImagePrompt = async (profile: BrandProfile, topic: string): Promise<any> => {
  const prompt = `
    As an expert social media manager for "${profile.businessName}" (${profile.industry}), generate a post about: "${topic}".

    Brand Identity:
    - Target Audience: ${profile.targetAudience}
    - Brand Voice: ${profile.brandVoice}
    - Key Themes: ${profile.keyThemes}

    Instructions:
    1.  **Caption:** Write a compelling, high-engagement caption in natural, modern Taglish (mix of Tagalog and English). 
        - DO NOT use generic phrases like "Check out our amazing..." or "Perfect for you".
        - BE CREATIVE. Use "Hugot", storytelling, or relatable humor that matches the brand voice.
        - Include relevant emojis and 3-5 hyper-local hashtags.
    2.  **Image Prompt:** Detailed English prompt for an AI image generator. Specific style, lighting, and composition.
    3.  **Virality Score:** 0-100.
    4.  **Virality Reason:** Brief English explanation.

    OUTPUT ONLY JSON. Format: {"caption": "string", "imagePrompt": "string", "viralityScore": number, "viralityReason": "string"}
  `;
  try {
    logger.info("Generating post with prompt:", prompt);
    const res = await generateWithFallback(prompt);
    const data = extractJson(res);
    logger.info("Received and parsed post:", data);
    return ValidationService.validatePostResponse(data);
  } catch (e: any) {
    logger.error("Error generating post caption and image prompt:", e.message);
    return ValidationService.createFallbackPostResponse(topic);
  }
};

export const generateImageFromPrompt = async (prompt: string): Promise<string | null> => {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1080&height=1080&nologo=true`;
};

export const getTrendingTopicsPH = async (industry?: string): Promise<string[]> => {
  const prompt = `List 5 trending topics in the Philippines for ${industry || 'general'} industry. Return ONLY a JSON string array like ["topic1", "topic2"].`;
  try {
    const res = await generateWithFallback(prompt);
    const data = extractJson(res);
    return ValidationService.validateTrendingTopics(data);
  } catch (error) {
    return ValidationService.createFallbackTrendingTopics();
  }
};

export const chatWithSupportBot = async (message: string, history: {sender: 'user'|'bot', text: string}[]): Promise<string> => {
  const fullPrompt = `History:\n${history.map(h => `${h.sender}: ${h.text}`).join('\n')}\nUser: ${message}\nResponse (Taglish, concise):`;
  try {
    return await generateWithFallback(fullPrompt);
  } catch (e) {
    // FINAL REDUNDANCY: Tell user to talk to human instead of fake replies
    return "I apologize, my AI systems are currently overloaded. Please click 'New Ticket' above or use the 'Call Us' button to speak with a human agent directly!";
  }
};