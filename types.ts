export interface User {
  id: string;
  email: string;
  passwordHash: string; // In a real app, never store plain text. We'll mock this.
  role: 'user' | 'admin' | 'support';
  businessName?: string;
  theme?: 'light' | 'dark';
}

export interface BrandProfile {
  id?: string;
  userId: string;
  businessName: string;
  industry: string;
  targetAudience: string;
  brandVoice: string; 
  keyThemes: string;
  brandColors?: string[]; // Array of HEX codes
  contactEmail?: string;
  contactPhone?: string;
}

export interface ContentIdea {
  day: number;
  title: string;
  topic: string;
  format: 'Image' | 'Carousel' | 'Text' | 'Video';
}

export interface PostVersion {
  caption: string;
  imagePrompt: string;
  viralityScore?: number;
  createdAt: string;
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
  // New fields for governance
  regenCount: number;
  history: PostVersion[]; // Store previous versions
  externalLink?: string;
  publishedAt?: string;
}

export interface Ticket {
  id: string;
  ticketNum: number;
  userId: string;
  userEmail: string;
  subject: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'Pending' | 'Resolved';
  createdAt: string;
  messages: {sender: 'user'|'agent', text: string, timestamp: string}[];
}

export enum ViewState {
  LANDING = 'LANDING',
  LOGIN = 'LOGIN',
  SIGNUP = 'SIGNUP',
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  SURVEY = 'SURVEY',
  CALENDAR = 'CALENDAR',
  SETTINGS = 'SETTINGS',
  INSIGHTS = 'INSIGHTS', // New view
  BILLING = 'BILLING',   // New view
  SUPPORT_DASHBOARD = 'SUPPORT_DASHBOARD',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD'
}

export interface ChartData {
  name: string;
  value: number;
}

// Validation schemas using Zod
export const UserSchema = {
  email: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  password: (password: string) => password.length >= 6,
  role: (role: string) => ['user', 'admin'].includes(role)
};

export const BrandProfileSchema = {
  businessName: (name: string) => name.trim().length >= 2,
  industry: (industry: string) => industry.trim().length >= 2,
  targetAudience: (audience: string) => audience.trim().length >= 2,
  brandVoice: (voice: string) => voice.trim().length >= 2,
  keyThemes: (themes: string) => themes.trim().length >= 2
};

export const GeneratedPostSchema = {
  topic: (topic: string) => topic.trim().length >= 2,
  caption: (caption: string) => caption.trim().length >= 10,
  imagePrompt: (prompt: string) => prompt.trim().length >= 5,
  status: (status: string) => ['Draft', 'Scheduled', 'Published'].includes(status),
  viralityScore: (score: number) => score >= 0 && score <= 100
};

export const AIResponseSchema = {
  contentIdea: (idea: any): idea is ContentIdea => {
    return typeof idea.day === 'number' &&
           typeof idea.title === 'string' &&
           typeof idea.topic === 'string' &&
           ['Image', 'Carousel', 'Text', 'Video'].includes(idea.format);
  },
  postResponse: (response: any): response is {
    caption: string;
    imagePrompt: string;
    viralityScore: number;
    viralityReason: string;
  } => {
    return typeof response.caption === 'string' &&
           typeof response.imagePrompt === 'string' &&
           typeof response.viralityScore === 'number' &&
           response.viralityScore >= 0 && response.viralityScore <= 100 &&
           typeof response.viralityReason === 'string';
  }
};
