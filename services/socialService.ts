import { GeneratedPost } from '../types';

// Types mimicking Facebook/Instagram Graph API responses
export interface SocialMetric {
  date: string;
  value: number;
}

export interface SocialPlatformData {
  platform: 'facebook' | 'instagram' | 'tiktok';
  connected: boolean;
  username?: string; // Added username
  followers: number;
  following?: number;
  likes?: number;
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

  // 3. Fetch Insights (Check Cache -> Then Backend Proxy)
  async getInsights(platform: 'facebook' | 'instagram' | 'tiktok'): Promise<SocialPlatformData | null> {
    const connections = this.getConnections();
    
    if (!connections[platform] || !connections[platform].connected) {
      return null;
    }

    const username = connections[platform].platformUser.name;
    const cachedStats = connections[platform].lastStats;

    // Return cached stats if available (persisted from Extension update)
    if (cachedStats) {
       return {
         platform,
         connected: true,
         username: username,
         ...cachedStats,
         reach: [] 
       };
    }

    // No cache? Try backend scraper once
    let stats = { followers: 0, engagement: 0, isReal: false, following: 0, likes: 0 };

    try {
      const response = await fetch(`/api/social/stats/${platform}/${username}`);
      const contentType = response.headers.get('content-type');
      
      if (response.ok && contentType && contentType.includes('application/json')) {
        stats = await response.json();
        
        // If scraper succeeded, save it to cache immediately so next load is fast
        if (stats.followers > 0) {
           this.updateStats(platform, stats);
        }
      }
    } catch (e) {
      console.error('Error fetching real stats:', e);
    }

    // Even if backend fails, return the object with username so UI doesn't break
    return {
      platform,
      connected: true,
      username: username, // Critical for UI "Update" button
      followers: stats.followers || 0,
      following: stats.following,
      likes: stats.likes,
      engagement: stats.engagement || 0,
      reach: [],
      error: (stats.followers > 0) ? undefined : "No data yet"
    };
  }

  // 5. Update Stats (Called by Dashboard when Extension scrapes data)
  updateStats(platform: string, stats: any) {
    const connections = this.getConnections();
    if (connections[platform]) {
      // Keep existing data, overwrite with new stats fields
      connections[platform].lastStats = {
        followers: stats.followers,
        following: stats.following,
        likes: stats.likes,
        posts: stats.posts,
        engagement: stats.engagement,
        reach: stats.reach
      };
      connections[platform].lastStatsAt = new Date().toISOString();
      this.saveConnections(connections);
    }
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
