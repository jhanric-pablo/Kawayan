import { ContentIdea, GeneratedPost, AIResponseSchema } from '../types';

export class ValidationService {
  // Validate AI content ideas response
  static validateContentIdeas(data: any): ContentIdea[] {
    try {
      if (!Array.isArray(data)) {
        throw new Error('Response is not an array');
      }
      
      const validIdeas: ContentIdea[] = [];
      
      for (const item of data) {
        if (AIResponseSchema.contentIdea(item)) {
          // Additional validation
          if (item.day >= 1 && item.day <= 31 &&
              item.title.trim().length > 0 &&
              item.topic.trim().length > 0) {
            validIdeas.push(item);
          } else {
            console.warn('Invalid content idea data:', item);
          }
        } else {
          console.warn('Content idea failed schema validation:', item);
        }
      }
      
      if (validIdeas.length === 0) {
        throw new Error('No valid content ideas found in response');
      }
      
      return validIdeas;
    } catch (error) {
      console.error('Content ideas validation failed:', error);
      throw new Error(`Invalid AI response: ${error.message}`);
    }
  }
  
  // Validate AI post response
  static validatePostResponse(data: any): {
    caption: string;
    imagePrompt: string;
    viralityScore: number;
    viralityReason: string;
  } {
    try {
      if (!AIResponseSchema.postResponse(data)) {
        throw new Error('Response does not match expected schema');
      }
      
      // Additional validation
      if (data.caption.trim().length < 10) {
        throw new Error('Caption is too short');
      }
      
      if (data.imagePrompt.trim().length < 5) {
        throw new Error('Image prompt is too short');
      }
      
      if (data.viralityScore < 0 || data.viralityScore > 100) {
        throw new Error('Virality score must be between 0 and 100');
      }
      
      if (data.viralityReason.trim().length < 5) {
        throw new Error('Virality reason is too short');
      }
      
      return data;
    } catch (error) {
      console.error('Post response validation failed:', error);
      throw new Error(`Invalid AI response: ${error.message}`);
    }
  }
  
  // Validate trending topics response
  static validateTrendingTopics(data: any): string[] {
    try {
      if (!Array.isArray(data)) {
        throw new Error('Response is not an array');
      }
      
      const validTopics: string[] = [];
      
      for (const topic of data) {
        if (typeof topic === 'string' && topic.trim().length > 0) {
          validTopics.push(topic.trim());
        }
      }
      
      if (validTopics.length === 0) {
        throw new Error('No valid trending topics found');
      }
      
      return validTopics;
    } catch (error) {
      console.error('Trending topics validation failed:', error);
      throw new Error(`Invalid AI response: ${error.message}`);
    }
  }
  
  // Sanitize user inputs
  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') return '';
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove potential JS protocols
      .replace(/on\w+=/gi, ''); // Remove potential event handlers
  }
  
  // Validate email format
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  // Validate password strength
  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  // Validate brand profile
  static validateBrandProfile(profile: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    const fields = [
      { key: 'businessName', name: 'Business name', minLength: 2 },
      { key: 'industry', name: 'Industry', minLength: 2 },
      { key: 'targetAudience', name: 'Target audience', minLength: 2 },
      { key: 'brandVoice', name: 'Brand voice', minLength: 2 },
      { key: 'keyThemes', name: 'Key themes', minLength: 2 }
    ];
    
    for (const field of fields) {
      const value = profile[field.key];
      if (!value || typeof value !== 'string' || value.trim().length < field.minLength) {
        errors.push(`${field.name} must be at least ${field.minLength} characters long`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  // Create fallback content when AI fails
  static createFallbackContentIdeas(month: string, itemCount: number = 8): ContentIdea[] {
    const templates = [
      { title: 'New Month Kickoff', topic: `Fresh start for ${month} — showcase what makes us unique`, format: 'Image' as const },
      { title: 'Behind the Scenes', topic: 'Peek sa araw-araw na hustle ng team namin', format: 'Carousel' as const },
      { title: 'Customer Love', topic: 'Real stories mula sa mga loyal customers namin', format: 'Image' as const },
      { title: 'Product Spotlight', topic: 'Ito ang bestseller namin at bakit sulit siya', format: 'Video' as const },
      { title: 'Weekend Vibes', topic: 'Weekend promo at deals na hindi pwedeng palampasin', format: 'Carousel' as const },
      { title: 'Tips & Tricks', topic: 'Practical tips related sa aming industry', format: 'Text' as const },
      { title: 'Community Shoutout', topic: 'Taglish appreciation post para sa community namin', format: 'Image' as const },
      { title: 'Mid-Month Momentum', topic: 'Halfway through the month — ano ang next big thing', format: 'Video' as const },
      { title: 'Team Feature', topic: 'Meet the people behind the brand', format: 'Image' as const },
      { title: 'Seasonal Hook', topic: `Seasonal angle for ${month} na relevant sa audience`, format: 'Carousel' as const },
      { title: 'FAQ Breakdown', topic: 'Sagot sa pinakamadalas itanong ng customers', format: 'Text' as const },
      { title: 'Social Proof', topic: 'Reviews at testimonials na pinaka-impactful', format: 'Image' as const },
      { title: 'Limited Offer', topic: 'Time-sensitive deal na kailangan i-grab ngayon', format: 'Carousel' as const },
      { title: 'Culture Post', topic: 'Values namin at bakit ito matters sa inyo', format: 'Video' as const },
      { title: 'Collab Tease', topic: 'Sneak peek ng upcoming partnership o collab', format: 'Image' as const },
      { title: 'Month Wrap-Up', topic: 'Thank you post at preview ng next month', format: 'Carousel' as const },
    ];

    const count = Math.max(1, itemCount);
    return Array.from({ length: count }, (_, i) => {
      const tpl = templates[i % templates.length];
      const day = Math.min(28, Math.max(1, Math.round(((i + 1) / (count + 1)) * 28)));
      return {
        day,
        title: tpl.title,
        topic: tpl.topic,
        format: tpl.format,
      };
    });
  }
  
  static createFallbackPostResponse(topic: string): {
    caption: string;
    imagePrompt: string;
    viralityScore: number;
    viralityReason: string;
  } {
    return {
      caption: `Check out our amazing ${topic}! 🎉 Perfect for you. #Quality #MustHave`,
      imagePrompt: `Clean product photography of ${topic}, bright lighting, professional style`,
      viralityScore: 65,
      viralityReason: 'Standard product post with good engagement potential'
    };
  }
  
  static createFallbackTrendingTopics(): string[] {
    return ['Sale', 'Weekend', 'Food Trip', 'Payday', 'New Arrival'];
  }
}