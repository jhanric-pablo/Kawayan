import { GeneratedPost } from '../types';

// Types mimicking Facebook/Instagram Graph API responses
export interface SocialMetric {
  date: string;
  value: number;
}

export interface SocialPlatformData {
  platform: 'facebook' | 'instagram' | 'tiktok';
  connected: boolean;
  followers: number;
  engagement: number;
  reach: SocialMetric[]; // Time series data
}

// Simulates a real API Service
class SocialMediaService {
  private static STORAGE_KEY = 'kawayan_social_connections';

  private getConnections() {
    return JSON.parse(localStorage.getItem(SocialMediaService.STORAGE_KEY) || '{}');
  }

  private saveConnections(data: any) {
    localStorage.setItem(SocialMediaService.STORAGE_KEY, JSON.stringify(data));
  }

  // 1. Connect Account (Simulates OAuth Flow)
  async connectAccount(platform: 'facebook' | 'instagram' | 'tiktok'): Promise<boolean> {
    console.log(`Connecting to ${platform}...`);
    // In a real app, this would redirect to: https://www.facebook.com/v12.0/dialog/oauth?...
    
    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 1500));

    const connections = this.getConnections();
    connections[platform] = {
      connected: true,
      token: `mock_token_${Date.now()}`, // Store a "token"
      connectedAt: new Date().toISOString()
    };
    this.saveConnections(connections);
    return true;
  }

  // 2. Disconnect
  async disconnectAccount(platform: string): Promise<boolean> {
    const connections = this.getConnections();
    delete connections[platform];
    this.saveConnections(connections);
    return true;
  }

  // 3. Fetch Insights (The "Legit" Data Fetcher)
  async getInsights(platform: 'facebook' | 'instagram' | 'tiktok'): Promise<SocialPlatformData | null> {
    const connections = this.getConnections();
    
    // LEGIT CHECK: If not connected, return NULL. Don't fake it.
    if (!connections[platform] || !connections[platform].connected) {
      return null;
    }

    // Simulate API Call to Graph API
    await new Promise(resolve => setTimeout(resolve, 800));

    // Since we don't have a real FB Page ID, we GENERATE data based on the *token* timestamp 
    // to keep it consistent (it won't change randomly on refresh, making it feel real).
    // In a real production app, this would be: axios.get(`graph.facebook.com/${pageId}/insights...`)
    
    const seed = new Date(connections[platform].connectedAt).getTime();
    const baseFollowers = Math.floor(seed % 5000) + 500; // Deterministic based on connect time

    return {
      platform,
      connected: true,
      followers: baseFollowers,
      engagement: parseFloat((Math.random() * 5 + 1).toFixed(2)), // Dynamic daily fluctuation
      reach: Array.from({length: 7}, (_, i) => ({
        date: new Date(Date.now() - (6-i) * 86400000).toLocaleDateString(),
        value: Math.floor(Math.random() * 1000) + 100
      }))
    };
  }

  // 4. Get All Connected Status
  getConnectionStatus() {
    const conns = this.getConnections();
    return {
      facebook: !!conns.facebook,
      instagram: !!conns.instagram,
      tiktok: !!conns.tiktok
    };
  }
}

export const socialService = new SocialMediaService();
