import { User, BrandProfile, GeneratedPost } from '../types';
import { logger } from '../utils/logger';

export class ClientDatabaseService {
  private baseUrl = '/api';

  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('kawayan_jwt');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }

  // --- Users (Auth) ---
  async createUser(email: string, password: string, role: 'user' | 'admin' = 'user', businessName?: string): Promise<User | null> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role, businessName })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Registration failed');
      }

      const { user, token } = await response.json();
      
      // Store session
      localStorage.setItem('kawayan_jwt', token);
      localStorage.setItem('kawayan_session', JSON.stringify(user));
      
      return user;
    } catch (error) {
      logger.error('Error creating user (api)', { email, error });
      throw error;
    }
  }

  async loginUser(email: string, password: string): Promise<{ user: User; token: string } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Login failed');
      }

      const { user, token } = await response.json();
      
      // Store session
      localStorage.setItem('kawayan_jwt', token);
      localStorage.setItem('kawayan_session', JSON.stringify(user));
      
      return { user, token };
    } catch (error) {
      logger.error('Error logging in user (api)', { email, error });
      throw error;
    }
  }

  async logoutUser(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/auth/logout`, {
        method: 'POST',
        headers: this.getHeaders()
      });
    } catch (error) {
      logger.error('Error logging out (api)', { error });
    } finally {
      localStorage.removeItem('kawayan_session');
      localStorage.removeItem('kawayan_jwt');
    }
  }

  async updateUserTheme(userId: string, theme: 'light' | 'dark'): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/theme`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ userId, theme })
      });

      if (!response.ok) throw new Error('Failed to update theme');
      
      // Update local session
      const session = this.getCurrentUser();
      if (session && session.id === userId) {
        session.theme = theme;
        localStorage.setItem('kawayan_session', JSON.stringify(session));
      }
    } catch (error) {
      logger.error('Error updating theme (api)', { userId, theme, error });
      throw error;
    }
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/password`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ userId, newPassword })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update password');
      }
    } catch (error) {
      logger.error('Error updating password (api)', { userId, error });
      throw error;
    }
  }

  // Helper for synchronous access, kept for compatibility
  getCurrentUser(): User | null {
    try {
      const session = localStorage.getItem('kawayan_session');
      return session ? JSON.parse(session) : null;
    } catch (error) {
      return null;
    }
  }

  async getCurrentUserAsync(): Promise<User | null> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/me`, {
        headers: this.getHeaders()
      });
      if (!response.ok) return null;
      const user = await response.json();
      // Sync local cache
      localStorage.setItem('kawayan_session', JSON.stringify(user));
      return user;
    } catch (error) {
      return null;
    }
  }

  // --- Profiles ---
  async saveProfile(profile: BrandProfile): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/profiles`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(profile)
      });

      if (!response.ok) throw new Error('Failed to save profile');
    } catch (error) {
      logger.error('Error saving profile (api)', { userId: profile.userId, error });
      throw error;
    }
  }

  async getProfile(userId: string): Promise<BrandProfile | undefined> {
    try {
      const response = await fetch(`${this.baseUrl}/profiles/${userId}`, {
        headers: this.getHeaders()
      });

      if (response.status === 404) return undefined;
      if (!response.ok) throw new Error('Failed to fetch profile');

      return await response.json();
    } catch (error) {
      logger.error('Error getting profile (api)', { userId, error });
      return undefined;
    }
  }

  // --- Posts ---
  async savePost(post: GeneratedPost): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/posts`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(post)
      });

      if (response.status === 403) {
        const body = await response.json().catch(() => ({}));
        if (body.error === 'TIER_LIMIT_REACHED') {
          throw new Error('TIER_LIMIT_REACHED');
        }
      }

      if (!response.ok) throw new Error('Failed to save post');
    } catch (error) {
      logger.error('Error saving post (api)', { postId: post.id, error });
      throw error;
    }
  }

  async getUserPosts(userId: string): Promise<GeneratedPost[]> {
    try {
      const response = await fetch(`${this.baseUrl}/posts/user/${userId}`, {
        headers: this.getHeaders()
      });

      if (!response.ok) throw new Error('Failed to fetch posts');
      return await response.json();
    } catch (error) {
      logger.error('Error getting user posts (api)', { userId, error });
      return [];
    }
  }

  async savePlan(userId: string, month: string, ideas: any[]): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/plans`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ userId, month, ideas })
      });

      if (!response.ok) throw new Error('Failed to save plan');
    } catch (error) {
      logger.error('Error saving plan (api)', { userId, month, error });
      throw error;
    }
  }

  async getPlan(userId: string, month: string): Promise<any[] | null> {
    try {
      const response = await fetch(`${this.baseUrl}/plans/${userId}/${month}`, {
        headers: this.getHeaders()
      });

      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      logger.error('Error getting plan (api)', { userId, month, error });
      return null;
    }
  }

  // --- Admin Methods ---
  async getAdminStats(start?: string, end?: string): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalPostsGenerated: number;
    revenue: number;
    cancelledTransactions: number;
    pendingTransactions: number;
    revenueData: { name: string; value: number }[];
    churnData: { name: string; value: number }[];
  }> {
    try {
      const query = start && end ? `?start=${start}&end=${end}` : '';
      const response = await fetch(`${this.baseUrl}/admin/stats${query}`, {
        headers: this.getHeaders()
      });

      if (!response.ok) throw new Error('Failed to fetch stats');
      return await response.json();
    } catch (error) {
      logger.error('Error getting admin stats (api)', { error });
      return {
        totalUsers: 0,
        activeUsers: 0,
        totalPostsGenerated: 0,
        revenue: 0,
        cancelledTransactions: 0,
        pendingTransactions: 0,
        revenueData: [],
        churnData: []
      };
    }
  }

  async getAuditLogs(limit: number = 100): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/logs?limit=${limit}`, {
        headers: this.getHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch logs');
      return await response.json();
    } catch (error) {
      logger.error('Error getting audit logs (api)', { error });
      return [];
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/users`, {
        headers: this.getHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      return await response.json();
    } catch (error) {
      logger.error('Error getting all users (api)', { error });
      return [];
    }
  }

  async getAllTicketsAdmin(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/tickets`, {
        headers: this.getHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch tickets');
      return await response.json();
    } catch (error) {
      logger.error('Error getting all tickets (api)', { error });
      return [];
    }
  }

  async updateUser(userId: string, data: any): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/users/${userId}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update user');
    } catch (error) {
      logger.error('Error updating user (api)', { userId, error });
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      if (!response.ok) throw new Error('Failed to delete user');
    } catch (error) {
      logger.error('Error deleting user (api)', { userId, error });
      throw error;
    }
  }

  async adminAdjustBalance(userId: string, amount: number, reason: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/balance`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ userId, amount, reason })
      });
      if (!response.ok) throw new Error('Failed to adjust balance');
    } catch (error) {
      logger.error('Error adjusting balance (api)', { userId, error });
      throw error;
    }
  }

  async adminUpdateSubscription(userId: string, plan: string, expiresAt: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/subscription`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ userId, plan, expiresAt })
      });
      if (!response.ok) throw new Error('Failed to update subscription');
    } catch (error) {
      logger.error('Error updating subscription (api)', { userId, error });
      throw error;
    }
  }

  // --- Business Verification ---
  async getVerificationStatus(userId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/verification/status/${userId}`, {
        headers: this.getHeaders()
      });
      if (!response.ok) return { status: 'none' };
      return await response.json();
    } catch (error) {
      logger.error('Error getting verification status (api)', { userId, error });
      return { status: 'none' };
    }
  }

  async getAllVerifications(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/verifications`, {
        headers: this.getHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch verifications');
      return await response.json();
    } catch (error) {
      logger.error('Error getting verifications (api)', { error });
      return [];
    }
  }

  async approveVerification(id: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/verifications/${id}/approve`, {
        method: 'POST',
        headers: this.getHeaders()
      });
      if (!response.ok) throw new Error('Failed to approve verification');
    } catch (error) {
      logger.error('Error approving verification (api)', { id, error });
      throw error;
    }
  }

  async rejectVerification(id: string, reason: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/verifications/${id}/reject`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ reason })
      });
      if (!response.ok) throw new Error('Failed to reject verification');
    } catch (error) {
      logger.error('Error rejecting verification (api)', { id, error });
      throw error;
    }
  }

  // --- Health Check ---
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return await response.json();
    } catch (error) {
      return { status: 'unhealthy', timestamp: new Date().toISOString() };
    }
  }

  // --- Client Detection ---
  static isClientEnvironment(): boolean {
    return typeof window !== 'undefined';
  }
}
