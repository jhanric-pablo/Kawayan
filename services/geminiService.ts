import { BrandProfile, ContentIdea } from "../types";
import { ValidationService } from "./validationService";
import { logger } from "../utils/logger";

const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';

// --- LOCAL AI ENGINE (OLLAMA PROXIED) ---
// This calls the Ollama server running locally in your Codespace via the Backend Proxy.
const callLocalAI = async (prompt: string, system?: string): Promise<string> => {
  try {
    console.log("Gemini Unavailable. Switching to Local AI (Ollama - qwen2.5:7b)...");
    const response = await fetch('/api/ai/local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:7b',
        prompt: prompt,
        system: system || 'You are Kawayan AI Support. Friendly, Taglish, concise.',
        stream: false,
        options: {
          temperature: 0.5
        }
      })
    });

    if (!response.ok) throw new Error("Local AI Unreachable");
    const data = await response.json();
    return data.response || "";
  } catch (e) {
    console.error("Local AI failed:", e);
    return "";
  }
};

// --- STABLE GEMINI FETCH ---
const callGeminiDirect = async (prompt: string, model: string = 'gemini-1.5-flash'): Promise<string> => {
  if (!apiKey) throw new Error("API Key missing");
  // Using v1beta as the models are often not found in v1 yet
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Gemini Error");
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

const TAGLISH_SYSTEM_INSTRUCTION = `
You are a helpful AI assistant for a Philippine business.
Reply in Taglish (Tagalog and English mix).
Keep your answers short, friendly, and helpful.
`;

const MODELS = ['gemini-1.5-flash', 'gemini-1.5-pro'];

const generateWithFallback = async (prompt: string) => {
  let lastError;
  
  // 1. Try Gemini Models first
  for (const model of MODELS) {
    try {
      console.log(`Attempting Gemini (${model})...`);
      return await callGeminiDirect(prompt, model);
    } catch (error: any) {
      console.warn(`${model} failed:`, error.message);
      lastError = error;
    }
  }

  // 2. FALLBACK TO LOCAL AI (Ollama)
  const localRes = await callLocalAI(prompt, TAGLISH_SYSTEM_INSTRUCTION);
  if (localRes) return localRes;

  throw new Error("All AI engines exhausted");
};

export const generateContentPlan = async (profile: BrandProfile, month: string): Promise<ContentIdea[]> => {
  const prompt = `Create a 7-item social media calendar for ${month} for "${profile.businessName}" (${profile.industry}) in Taglish. Return ONLY a JSON array with properties: day, title, topic, format.`;
  try {
    const res = await generateWithFallback(prompt);
    const jsonStr = res.match(/.*\]/s)?.[0] || res;
    return ValidationService.validateContentIdeas(JSON.parse(jsonStr));
  } catch (e) {
    return ValidationService.createFallbackContentIdeas(month);
  }
};

export const generatePostCaptionAndImagePrompt = async (profile: BrandProfile, topic: string): Promise<any> => {
  const prompt = `Write a social media post for "${topic}" for business "${profile.businessName}". Return ONLY JSON with: caption (Taglish), imagePrompt (English), viralityScore (0-100), viralityReason.`;
  try {
    const res = await generateWithFallback(prompt);
    const jsonStr = res.match(/.*\}/s)?.[0] || res;
    return ValidationService.validatePostResponse(JSON.parse(jsonStr));
  } catch (e) {
    return ValidationService.createFallbackPostResponse(topic);
  }
};

export const generateImageFromPrompt = async (prompt: string): Promise<string | null> => {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1080&height=1080&nologo=true`;
};

export const getTrendingTopicsPH = async (industry?: string): Promise<string[]> => {
  const prompt = `List 5 trending topics in the Philippines for ${industry || 'general'} industry. Return ONLY a JSON string array.`;
  try {
    const res = await generateWithFallback(prompt);
    const jsonStr = res.match(/.*\]/s)?.[0] || res;
    return ValidationService.validateTrendingTopics(JSON.parse(jsonStr));
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