import { GoogleGenAI, Type, Schema } from "@google/genai";
import { BrandProfile, ContentIdea } from "../types";
import { ValidationService } from "./validationService";
import { logger } from "../utils/logger";

const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';

// Mock AI client if key is missing to prevent SDK crash
const ai = apiKey 
  ? new GoogleGenAI({ apiKey }) 
  : { 
      models: { 
        generateContent: async () => { throw new Error("Gemini API Key is missing"); } 
      } 
    };

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second base delay

// Error types
class AIServiceError extends Error {
  constructor(message: string, public readonly originalError?: any) {
    super(message);
    this.name = 'AIServiceError';
  }
}

// Retry helper with exponential backoff
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  operation: string = 'AI operation'
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      console.error(`${operation} attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        throw new AIServiceError(
          `${operation} failed after ${maxRetries} attempts`,
          error
        );
      }
      
      // Exponential backoff with jitter
      const delay = RETRY_DELAY_BASE * Math.pow(2, attempt - 1) + Math.random() * 1000;
      await sleep(delay);
    }
  }
  
  throw new AIServiceError(`${operation} failed unexpectedly`);
};

const TAGLISH_SYSTEM_INSTRUCTION = `
You are an expert social media manager for Philippine MSMEs. 
Your specialty is creating "Taglish" (Tagalog-English code-switching) content that resonates deeply with local Filipinos.
You understand concepts like "hugot" (emotional pull), "diskarte" (hustle), "sweldo" (payday) humor, and Filipino pop culture.
Always ensure the tone matches the brand's voice.
When asked for JSON, return ONLY valid JSON.
`;

const MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-pro'];

// Helper to generate content with model fallback
const generateWithFallback = async (params: any) => {
  let lastError;
  for (const model of MODELS) {
    try {
      // Create a specific config for this attempt
      const attemptConfig = {
        ...params,
        model: model 
      };
      
      console.log(`Attempting AI generation with model: ${model}`);
      
      // Use the retry logic for *this specific model* (network glitches)
      // If it's a 429/Quota, we might want to skip retry and go to next model immediately,
      // but simple backoff covers both.
      return await retryWithBackoff(async () => {
        return await ai.models.generateContent(attemptConfig);
      }, 2, `AI Gen (${model})`); // Reduced retries per model to speed up fallback

    } catch (error: any) {
      console.warn(`Model ${model} failed:`, error.message);
      lastError = error;
      
      // If it's a content safety block, switching models might not help, but for Quota/Overload it will.
      // Continue to next model
    }
  }
  throw new AIServiceError("All AI models failed", lastError);
};

export const generateContentPlan = async (profile: BrandProfile, month: string): Promise<ContentIdea[]> => {
  const action = 'generateContentPlan';
  
  if (!apiKey) {
    logger.logAIResponse(action, false, 0, undefined, 'API Key missing');
    return ValidationService.createFallbackContentIdeas(month);
  }

  // Validate inputs
  const validation = ValidationService.validateBrandProfile(profile);
  if (!validation.isValid) {
    console.warn("Invalid profile data, using fallback content:", validation.errors);
    return ValidationService.createFallbackContentIdeas(month);
  }

  const prompt = `
    Create a 7-item sample social media content calendar for ${month} for a business with these details:
    Name: ${ValidationService.sanitizeInput(profile.businessName)}
    Industry: ${ValidationService.sanitizeInput(profile.industry)}
    Target Audience: ${ValidationService.sanitizeInput(profile.targetAudience)}
    Voice: ${ValidationService.sanitizeInput(profile.brandVoice)}
    Themes: ${ValidationService.sanitizeInput(profile.keyThemes)}

    Ensure a mix of promotional, engagement, and educational content.
    Return a list of content ideas distributed throughout the month.
  `;

  logger.logAIRequest(action, prompt);

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        day: { type: Type.INTEGER, description: "Day of the month (1-30)" },
        title: { type: Type.STRING, description: "Short catchy title" },
        topic: { type: Type.STRING, description: "Description of the content topic" },
        format: { type: Type.STRING, enum: ['Image', 'Carousel', 'Video'] }
      },
      required: ["day", "title", "topic", "format"]
    }
  };

  try {
    const response = await generateWithFallback({
      contents: prompt,
      config: {
        systemInstruction: TAGLISH_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    // Parse and validate response
    let parsedData;
    try {
      parsedData = JSON.parse(response.text || '[]');
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      throw new AIServiceError("Invalid JSON response from AI", parseError);
    }

    // Validate the parsed data
    const validatedData = ValidationService.validateContentIdeas(parsedData);
    logger.logAIResponse(action, true, JSON.stringify(validatedData).length);
    return validatedData;
    
  } catch (error) {
    logger.logAIResponse(action, false, undefined, undefined, error);
    
    if (error instanceof AIServiceError) {
      logger.error("AI Service Error Details", { originalError: error.originalError });
    }
    
    // Return fallback content on any error
    return ValidationService.createFallbackContentIdeas(month);
  }
};

export const generatePostCaptionAndImagePrompt = async (
  profile: BrandProfile,
  topic: string
): Promise<{ caption: string; imagePrompt: string; viralityScore: number; viralityReason: string }> => {
  if (!apiKey) {
    console.warn("API Key missing, using fallback post generation");
    return ValidationService.createFallbackPostResponse(topic);
  }

  // Validate inputs
  const validation = ValidationService.validateBrandProfile(profile);
  if (!validation.isValid) {
    console.warn("Invalid profile data, using fallback post:", validation.errors);
    return ValidationService.createFallbackPostResponse(topic);
  }

  const sanitizedTopic = ValidationService.sanitizeInput(topic);
  if (sanitizedTopic.length < 2) {
    console.warn("Invalid topic, using fallback post");
    return ValidationService.createFallbackPostResponse(topic);
  }

  const prompt = `
    Task: Write a social media post for this topic: "${sanitizedTopic}".
    Business: ${ValidationService.sanitizeInput(profile.businessName)} (${ValidationService.sanitizeInput(profile.industry)}).
    Voice: ${ValidationService.sanitizeInput(profile.brandVoice)}.
    Target Audience: ${ValidationService.sanitizeInput(profile.targetAudience)}.
    Brand Colors: ${profile.brandColors?.join(', ') || 'N/A'}.
    Contact: ${profile.contactEmail || ''} ${profile.contactPhone || ''}.

    1. Caption: Natural, conversational Taglish. Include emojis and 3-5 hashtags. Mention contact info if relevant.
    2. Image Prompt: Detailed English prompt for an image generator. Use the brand's color palette (${profile.brandColors?.join(', ') || 'aesthetic colors'}) where appropriate. High aesthetic.
    3. Virality Analysis: Rate from 0-100 how engaging/viral this post might be for Filipinos and explain why in one short sentence.
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      caption: { type: Type.STRING, description: "The social media caption in Taglish" },
      imagePrompt: { type: Type.STRING, description: "Detailed prompt for image generation" },
      viralityScore: { type: Type.INTEGER, description: "Score 0-100 based on engagement potential" },
      viralityReason: { type: Type.STRING, description: "Short reason why it will be effective" }
    },
    required: ["caption", "imagePrompt", "viralityScore", "viralityReason"]
  };

  try {
    const response = await generateWithFallback({
      contents: prompt,
      config: {
        systemInstruction: TAGLISH_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    // Parse and validate response
    let parsedData;
    try {
      parsedData = JSON.parse(response.text || '{}');
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      throw new AIServiceError("Invalid JSON response from AI", parseError);
    }

    // Validate the parsed data
    return ValidationService.validatePostResponse(parsedData);
    
  } catch (error) {
    console.error("Error generating post caption and image prompt:", error);
    
    if (error instanceof AIServiceError) {
      console.error("AI Service Error Details:", error.originalError);
    }
    
    // Return fallback content on any error
    return ValidationService.createFallbackPostResponse(topic);
  }
};

export const generateImageFromPrompt = async (prompt: string): Promise<string | null> => {
  // "Nanobanana" / Pollinations.ai implementation for unlimited free images
  const sanitizedPrompt = ValidationService.sanitizeInput(prompt);
  if (sanitizedPrompt.length < 2) return null;

  try {
    console.log("Generating image via Pollinations (Unlimited)...");
    const encodedPrompt = encodeURIComponent(sanitizedPrompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1080&height=1080&nologo=true&seed=${Math.floor(Math.random() * 10000)}`;
    
    // Verify reachability (optional, but good for error handling)
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Pollinations API unavailable');
    
    return imageUrl; // Return the URL directly
  } catch (error) {
    console.error("Pollinations image generation failed:", error);
    
    // Fallback to Gemini if Pollinations fails (rare)
    if (apiKey) {
      try {
        console.log("Falling back to Gemini Flash Image...");
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: [{ text: sanitizedPrompt }]
        });
        const part = response.candidates?.[0]?.content?.parts?.[0];
        if (part?.inlineData?.data) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      } catch (geminiError) {
        console.error("Gemini image fallback failed:", geminiError);
      }
    }
    return null; 
  }
};

export const getTrendingTopicsPH = async (industry?: string): Promise<string[]> => {
  if (!apiKey) {
    console.warn("API Key missing, using fallback trending topics");
    return ValidationService.createFallbackTrendingTopics();
  }
  
  let prompt = "List 5 generic but currently relevant trending topics, events, or seasons in the Philippines right now (e.g., Christmas, Summer, Back to School, Payday, Viral Memes). Return just the topics as a simple list.";
  
  if (industry) {
    prompt = `List 5 currently relevant trending topics, events, or seasons in the Philippines right now, specifically tailored for the "${industry}" industry. Include general Filipino trends if relevant. Return just the topics as a simple list.`;
  }
  
  const schema: Schema = {
    type: Type.ARRAY,
    items: { type: Type.STRING }
  };

  try {
    const response = await generateWithFallback({
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    // Parse and validate response
    let parsedData;
    try {
      parsedData = JSON.parse(response.text || '[]');
    } catch (parseError) {
      console.error("Failed to parse trending topics response as JSON:", parseError);
      throw new AIServiceError("Invalid JSON response from AI", parseError);
    }

    // Validate the parsed data
    return ValidationService.validateTrendingTopics(parsedData);
    
  } catch (error) {
    console.error("Error getting trending topics:", error);
    
    if (error instanceof AIServiceError) {
      console.error("AI Service Error Details:", error.originalError);
    }
    
    // Return fallback content on any error
    return ValidationService.createFallbackTrendingTopics();
  }
};

export const getRealTrendingTopics = async (): Promise<string[]> => {
  try {
    const response = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://trends.google.com/trends/trendingsearches/daily/rss?geo=PH');
    const data = await response.json();
    
    if (data.status === 'ok' && data.items) {
      return data.items.slice(0, 7).map((item: any) => item.title);
    }
    throw new Error('Failed to fetch RSS');
  } catch (error) {
    console.warn("RSS fetch failed, falling back to AI trends", error);
    return getTrendingTopicsPH(); // Fallback to AI
  }
};

export const chatWithSupportBot = async (message: string, history: {sender: 'user'|'bot', text: string}[]): Promise<string> => {
  if (!apiKey) return "I'm having trouble connecting to my brain. Please try again later.";

  const systemPrompt = `
    You are the friendly and helpful Support Agent for Kawayan AI, a social media management platform for Philippine MSMEs.
    
    Your knowledge base:
    - Kawayan AI helps businesses generate 'Taglish' content, schedule posts, and track insights.
    - Features: Content Calendar, Batch Generation (up to 16 posts/month for Pro), AI Image Generation, Analytics.
    - Pricing: Free Trial (8 posts), Pro (₱499/mo, 16 posts), Add-ons (₱150/post).
    - Payment: We support GCash, Maya, and Cards via Xendit.
    - User Issues: If they have technical problems, ask for details or tell them you've created a ticket.
    
    Tone: Professional but warm, Filipino-friendly (you can use occasional 'po' or 'opo' but keep it English/Taglish).
    Keep responses concise (under 3 sentences).
  `;

  try {
    const chatSession = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        ...history.map(h => ({
          role: h.sender === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }]
        })),
        { role: 'user', parts: [{ text: message }] }
      ]
    });
    
    return chatSession.text || "I didn't catch that. Could you rephrase?";
  } catch (error) {
    console.error("Chat error:", error);
    return "Sorry, I'm experiencing high traffic. Please try again or email support@kawayan.ph";
  }
};
