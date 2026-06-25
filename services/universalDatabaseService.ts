// Universal database service that works in both browser and Node.js environments
import { User, BrandProfile, GeneratedPost } from '../types';
import { logger } from '../utils/logger';

// Dynamic import for better-sqlite3 (only works in Node.js)
const isNodeEnvironment = typeof window === 'undefined';

class DatabaseServiceFactory {
  static async createService() {
    if (isNodeEnvironment) {
      // Node.js environment - use SQLite
      const { DatabaseService } = await import('./databaseService');
      return new DatabaseService();
    } else {
      // Browser environment - use localStorage
      const { ClientDatabaseService } = await import('./clientDatabaseService');
      return new ClientDatabaseService();
    }
  }
}

export class UniversalDatabaseService {
  private service: any;

  constructor() {
    // Store promise that resolves to the appropriate service
    this.initializeService();
  }

  private async initializeService() {
    try {
      this.service = await DatabaseServiceFactory.createService();
      logger.info(`Database service initialized`, { 
        environment: isNodeEnvironment ? 'Node.js/SQLite' : 'Browser/LocalStorage' 
      });
    } catch (error) {
      logger.error('Failed to initialize database service', { error, environment: isNodeEnvironment ? 'Node.js' : 'Browser' });
      // Fallback to localStorage if SQLite fails
      if (isNodeEnvironment) {
        const { ClientDatabaseService } = await import('./clientDatabaseService');
        this.service = new ClientDatabaseService();
      }
    }
  }

  private async getService() {
    if (!this.service) {
      await this.initializeService();
    }
    return this.service;
  }

  // --- Wrapper Methods ---
  async createUser(email: string, password: string, role: 'user' | 'admin' = 'user', businessName?: string): Promise<User | null> {
    const service = await this.getService();
    return service.createUser(email, password, role, businessName);
  }

  async loginUser(email: string, password: string): Promise<{ user: User; token: string } | null> {
    const service = await this.getService();
    
    // Handle old service format that might return just User
    const result = await service.loginUser(email, password);
    
    if (result && result.user && result.token) {
      return result;
    } else if (result && result.email) {
      // Old format - convert to new format
      return { user: result, token: 'client_token' };
    }
    
    return null;
  }

  async logoutUser(): Promise<void> {
    const service = await this.getService();
    return service.logoutUser();
  }

  async updateUserTheme(userId: string, theme: 'light' | 'dark'): Promise<void> {
    const service = await this.getService();
    return service.updateUserTheme(userId, theme);
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<void> {
    const service = await this.getService();
    return service.updateUserPassword(userId, newPassword);
  }

  getCurrentUser(): User | null {
    if (isNodeEnvironment) {
      // Node.js - need to handle async
      logger.warn('getCurrentUser called in Node.js environment - should be async');
      return null;
    } else {
      // Browser - can use localStorage directly
      const session = localStorage.getItem('kawayan_session');
      return session ? JSON.parse(session) : null;
    }
  }

  async getCurrentUserAsync(): Promise<User | null> {
    const service = await this.getService();
    if (service.getCurrentUserAsync) {
      return service.getCurrentUserAsync();
    }
    return this.getCurrentUser();
  }

  async saveProfile(profile: BrandProfile): Promise<void> {
    const service = await this.getService();
    return service.saveProfile(profile);
  }

  async getProfile(userId: string): Promise<BrandProfile | undefined> {
    const service = await this.getService();
    return service.getProfile(userId);
  }

  async savePost(post: GeneratedPost): Promise<void> {
    const service = await this.getService();
    return service.savePost(post);
  }

  async getUserPosts(userId: string): Promise<GeneratedPost[]> {
    const service = await this.getService();
    return service.getUserPosts(userId);
  }

  async savePlan(userId: string, month: string, ideas: any[]): Promise<void> {
    const service = await this.getService();
    return service.savePlan(userId, month, ideas);
  }

  async getPlan(userId: string, month: string): Promise<any[] | null> {
    const service = await this.getService();
    return service.getPlan(userId, month);
  }

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
    const service = await this.getService();
    return service.getAdminStats(start, end);
  }

  async getAllUsers(): Promise<User[]> {
    const service = await this.getService();
    return service.getAllUsers();
  }

  async getAllTicketsAdmin(): Promise<any[]> {
    const service = await this.getService();
    return service.getAllTicketsAdmin();
  }

  async updateUser(userId: string, data: any): Promise<void> {
    const service = await this.getService();
    return service.updateUser(userId, data);
  }

  async deleteUser(userId: string): Promise<void> {
    const service = await this.getService();
    return service.deleteUser(userId);
  }

  async adminAdjustBalance(userId: string, amount: number, reason: string): Promise<void> {
    const service = await this.getService();
    return service.adminAdjustBalance(userId, amount, reason);
  }

  async adminUpdateSubscription(userId: string, plan: string, expiresAt: string): Promise<void> {
    const service = await this.getService();
    return service.adminUpdateSubscription(userId, plan, expiresAt);
  }

  async getAuditLogs(limit: number = 100): Promise<any[]> {
    const service = await this.getService();
    return service.getAuditLogs(limit);
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const service = await this.getService();
    return service.healthCheck();
  }

  async getVerificationStatus(userId: string): Promise<any> {
    const service = await this.getService();
    if (service.getVerificationStatus) return service.getVerificationStatus(userId);
    if (service.getVerification) return service.getVerification(userId) ?? { status: 'none' };
    return { status: 'none' };
  }

  async getAllVerifications(): Promise<any[]> {
    const service = await this.getService();
    return service.getAllVerifications ? service.getAllVerifications() : [];
  }

  async approveVerification(id: string): Promise<void> {
    const service = await this.getService();
    return service.approveVerification(id);
  }

  async rejectVerification(id: string, reason: string): Promise<void> {
    const service = await this.getService();
    return service.rejectVerification(id, reason);
  }

  async close(): Promise<void> {
    const service = await this.getService();
    if (service.close) {
      return service.close();
    }
  }

  static isClientEnvironment(): boolean {
    return !isNodeEnvironment;
  }
}

// Export the universal service
export default UniversalDatabaseService;