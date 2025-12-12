import { GoogleGenAI, Type, Schema } from "@google/genai";
import { BrandProfile, ContentIdea } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const TAGLISH_SYSTEM_INSTRUCTION = `
You are an expert social media manager for Philippine MSMEs. 
Your specialty is creating "Taglish" (Tagalog-English code-switching) content that resonates deeply with local Filipinos.
You understand concepts like "hugot", "diskarte", and Filipino humor.
Always ensure the tone matches the brand's voice.
When asked for JSON, return ONLY valid JSON.
`;

export const generateContentPlan = async (profile: BrandProfile, month: string): Promise<ContentIdea[]> => {
  if (!apiKey) throw new Error("API Key missing");

  const prompt = `
    Create a 5-item sample social media content calendar for ${month} for a business with these details:
    Name: ${profile.businessName}
    Industry: ${profile.industry}
    Target Audience: ${profile.targetAudience}
    Voice: ${profile.brandVoice}
    Themes: ${profile.keyThemes}

    Return a list of 5 content ideas spread across the month.
  `;

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        day: { type: Type.INTEGER, description: "Day of the month (1-30)" },
        title: { type: Type.STRING, description: "Short catchy title" },
        topic: { type: Type.STRING, description: "Description of the content topic" },
        format: { type: Type.STRING, enum: ['Image', 'Carousel', 'Text'] }
      },
      required: ["day", "title", "topic", "format"]
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: TAGLISH_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    return JSON.parse(response.text || '[]') as ContentIdea[];
  } catch (error) {
    console.error("Error generating plan:", error);
    return [];
  }
};

export const generatePostCaptionAndImagePrompt = async (
  profile: BrandProfile,
  topic: string
): Promise<{ caption: string; imagePrompt: string }> => {
  if (!apiKey) throw new Error("API Key missing");

  const prompt = `
    Write a Facebook/Instagram caption for this topic: "${topic}".
    Business: ${profile.businessName} (${profile.industry}).
    Audience: ${profile.targetAudience}.
    Voice: ${profile.brandVoice}.

    1. The caption MUST be in natural, conversational Taglish suitable for the Philippines.
    2. Include 3-5 relevant hashtags.
    3. Also provide a detailed English prompt to generate a high-quality image for this post.
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      caption: { type: Type.STRING, description: "The social media caption in Taglish" },
      imagePrompt: { type: Type.STRING, description: "A detailed prompt for an image generator" }
    },
    required: ["caption", "imagePrompt"]
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: TAGLISH_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const result = JSON.parse(response.text || '{}');
    return {
      caption: result.caption || "Error generating caption.",
      imagePrompt: result.imagePrompt || "Error generating prompt."
    };
  } catch (error) {
    console.error("Error generating post:", error);
    throw error;
  }
};

export const generateImageFromPrompt = async (prompt: string): Promise<string | null> => {
  if (!apiKey) throw new Error("API Key missing");

  try {
    // Using gemini-2.5-flash-image for generation as requested/standard for this setup
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [
        { text: prompt }
      ],
      config: {
         // flash-image doesn't strictly need aspect ratio config in the same way imagen does via generateImages, 
         // but we send the prompt directly. 
         // If we were using Imagen we would use ai.models.generateImages.
         // Let's use the generateContent method which works for flash-image.
      }
    });

    // Check for inline data in parts
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Error generating image:", error);
    return null; 
  }
};
