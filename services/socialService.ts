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

  // Helper to check for Sandbox Mode
  private isSandbox(): boolean {
    const isDev = import.meta.env.DEV;
    const tiktokKey = import.meta.env.VITE_TIKTOK_CLIENT_KEY || '';
    const fbKey = import.meta.env.VITE_FACEBOOK_APP_ID || '';
    
    // Check if keys are missing or placeholders
    const missingKeys = !tiktokKey || tiktokKey.includes('your_') || !fbKey || fbKey.includes('your_');
    
    console.log(`[SocialService] Check Sandbox: Dev=${isDev}, MissingKeys=${missingKeys} (TikTok: ${tiktokKey.slice(0,5)}..., FB: ${fbKey.slice(0,5)}...)`);
    
    return isDev || missingKeys;
  }

  public sandboxMode = this.isSandbox();

  private saveConnections(data: any) {
    localStorage.setItem(SocialMediaService.STORAGE_KEY, JSON.stringify(data));
    // Trigger a custom event so UI updates immediately
    window.dispatchEvent(new Event('social-connections-updated'));
  }

  // 1. Connect Account (Now uses Username input instead of OAuth)
  async connectAccount(platform: 'facebook' | 'instagram' | 'tiktok', username: string): Promise<void> {
    console.log(`[SocialService] Connecting to ${platform} as ${username}...`);
    
    // Simulate API verification delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const connections = this.getConnections();
    connections[platform] = {
      connected: true,
      connectedAt: new Date().toISOString(),
      platformUser: {
        name: username, // User provided username
        id: `${platform}_${username}`
      }
    };
    this.saveConnections(connections);
    
    // Trigger update
    window.dispatchEvent(new Event('social-connections-updated'));
  }

  // 2. Disconnect
  async disconnectAccount(platform: string): Promise<boolean> {
    const connections = this.getConnections();
    delete connections[platform];
    this.saveConnections(connections);
    return true;
  }

  // 3. Fetch Insights (Real Scraped Data via Backend Proxy)
  async getInsights(platform: 'facebook' | 'instagram' | 'tiktok'): Promise<SocialPlatformData | null> {
    const connections = this.getConnections();
    
    if (!connections[platform] || !connections[platform].connected) {
      return null;
    }

    const username = connections[platform].platformUser.name;
    let stats = { followers: 0, engagement: 0, isReal: false };

    try {
      // Call our own backend scraper
      const response = await fetch(`/api/social/stats/${platform}/${username}`);
      const contentType = response.headers.get('content-type');
      
      if (response.ok && contentType && contentType.includes('application/json')) {
        stats = await response.json();
      } else {
        console.warn(`Stats API failed (Status: ${response.status}, Type: ${contentType}), falling back to local simulation`);
      }
    } catch (e) {
      console.error('Error fetching real stats:', e);
    }

    // If backend failed (followers is null/0), return error or empty state
    // We do NOT use deterministic seed fallback anymore per user request.
    if (!stats.followers || stats.followers === 0) {
      return {
        platform,
        connected: true,
        followers: 0,
        engagement: 0,
        reach: [],
        error: "Failed to fetch stats"
      };
    }

    const finalFollowers = stats.followers;
    const finalEngagement = stats.engagement;

    return {
      platform,
      connected: true,
      followers: finalFollowers,
      engagement: finalEngagement,
      reach: Array.from({length: 7}, (_, i) => ({
        date: new Date(Date.now() - (6-i) * 86400000).toLocaleDateString(),
        // Since we don't have reach history, we can either leave it 0 or project based on current followers
        // We will project it simply as a visualization (not fake "history", but a projection)
        value: Math.floor(finalFollowers * (finalEngagement/100 || 0.05))
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
