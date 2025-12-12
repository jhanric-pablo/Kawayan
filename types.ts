export interface User {
  id: string;
  email: string;
  passwordHash: string; // In a real app, never store plain text. We'll mock this.
  role: 'user' | 'admin';
  businessName?: string;
}

export interface BrandProfile {
  id?: string;
  userId: string;
  businessName: string;
  industry: string;
  targetAudience: string;
  brandVoice: string; 
  keyThemes: string;
}

export interface ContentIdea {
  day: number;
  title: string;
  topic: string;
  format: 'Image' | 'Carousel' | 'Text' | 'Video';
}

export interface GeneratedPost {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  topic: string;
  caption: string;
  imagePrompt: string;
  imageUrl?: string;
  status: 'Draft' | 'Scheduled' | 'Published';
  viralityScore?: number;
  viralityReason?: string;
  format?: string;
}

export enum ViewState {
  LANDING = 'LANDING',
  LOGIN = 'LOGIN',
  SIGNUP = 'SIGNUP',
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  SURVEY = 'SURVEY',
  CALENDAR = 'CALENDAR',
  SETTINGS = 'SETTINGS',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD'
}

export interface ChartData {
  name: string;
  value: number;
}
