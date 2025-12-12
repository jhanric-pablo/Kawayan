export interface BrandProfile {
  businessName: string;
  industry: string;
  targetAudience: string;
  brandVoice: string; // e.g., "Professional", "Makulit (Playful)", "Inspirational"
  keyThemes: string;
}

export interface ContentIdea {
  day: number;
  title: string;
  topic: string;
  format: 'Image' | 'Carousel' | 'Text';
}

export interface GeneratedPost {
  id: string;
  date: string; // YYYY-MM-DD
  topic: string;
  caption: string;
  imagePrompt: string;
  imageUrl?: string;
  status: 'Draft' | 'Scheduled' | 'Published';
}

export enum ViewState {
  LANDING = 'LANDING',
  SURVEY = 'SURVEY',
  CALENDAR = 'CALENDAR',
  ADMIN = 'ADMIN'
}

export interface ChartData {
  name: string;
  value: number;
}
