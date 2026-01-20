import { DatabaseConfig } from '../config/database';
import { User, BrandProfile, GeneratedPost } from '../types';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger';
import { JWTService } from './jwtService';

export class DatabaseService {
  private dbConfig: DatabaseConfig;
  
  constructor() {
    this.dbConfig = new DatabaseConfig();
    this.initializeDefaultAdmin();
  }
  
  // --- Users (Auth) ---
  async createUser(email: string, password: string, role: 'user' | 'admin' | 'support' = 'user', businessName?: string): Promise<User | null> {
    const db = this.dbConfig.getDatabase();
    
    try {
      // Check if user already exists
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existingUser) return null;
      
      // Validate password strength
      const passwordValidation = JWTService.validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        throw new Error(`Password requirements: ${passwordValidation.errors.join(', ')}`);
      }
      
      // Hash password with JWT service
      const passwordHash = await JWTService.hashPassword(password);
      
      const newUser: User = {
        id: Date.now().toString(),
        email,
        passwordHash,
        role,
        businessName
      };
      
      db.prepare(`
        INSERT INTO users (id, email, password_hash, role, business_name)
        VALUES (?, ?, ?, ?, ?)
      `).run(newUser.id, newUser.email, newUser.passwordHash, newUser.role, newUser.businessName || null);
      
      logger.info('User created successfully', { userId: newUser.id, email, role });
      return newUser;
    } catch (error) {
      logger.logDatabaseError('createUser', error, email);
      return null;
    }
  }
  
async loginUser(email: string, password: string): Promise<{ user: User; token: string } | null> {
    const db = this.dbConfig.getDatabase();
    
    try {
      const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
      
      if (!row) return null;

      const user: User = {
        id: row.id,
        email: row.email,
        passwordHash: row.password_hash,
        role: row.role,
        businessName: row.business_name,
        theme: row.theme
      };
      
      // Verify password with JWT service
      const isValidPassword = await JWTService.verifyPassword(password, user.passwordHash);
      if (!isValidPassword) {
        logger.logAuthAttempt(email, false);
        return null;
      }
      
      // Create JWT session
      const token = await this.createSession(user.id);
      
      logger.logAuthAttempt(email, true, user.id);
      return { user, token };
    } catch (error) {
      logger.logDatabaseError('loginUser', error, email);
      return null;
    }
  }

  
  async logoutUser(): Promise<void> {
    const db = this.dbConfig.getDatabase();
    
    try {
      // Delete current session (simplified - in production you'd use session token)
      if (typeof window !== 'undefined') {
        const sessionData = localStorage.getItem('kawayan_session');
        if (sessionData) {
          const user = JSON.parse(sessionData) as User;
          db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
        }
      }
      
      if (typeof window !== 'undefined') {
        localStorage.removeItem('kawayan_session');
      }
    } catch (error) {
      console.error('Error logging out user:', error);
    }
  }

  async updateUserTheme(userId: string, theme: 'light' | 'dark'): Promise<void> {
    const db = this.dbConfig.getDatabase();
    try {
      db.prepare('UPDATE users SET theme = ? WHERE id = ?').run(theme, userId);
    } catch (error) {
      console.error('Error updating user theme:', error);
      throw error;
    }
  }
  
  getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const session = localStorage.getItem('kawayan_session');
      return session ? JSON.parse(session) : null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }
  
  private async createSession(userId: string): Promise<string> {
    const db = this.dbConfig.getDatabase();
    
    try {
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      if (!row) throw new Error('User not found');

      const user: User = {
        id: row.id,
        email: row.email,
        passwordHash: row.password_hash,
        role: row.role,
        businessName: row.business_name,
        theme: row.theme
      };
      
      // Generate JWT token
      const jwtToken = JWTService.generateToken(user);
      
      // Store session in database for tracking
      const sessionId = Date.now().toString();
      const tokenHash = await bcrypt.hash(jwtToken, 10);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour session
      
      db.prepare(`
        INSERT INTO sessions (id, user_id, token, expires_at)
        VALUES (?, ?, ?, ?)
      `).run(sessionId, userId, tokenHash, expiresAt.toISOString());
      
      // Store JWT in localStorage for client-side access
      if (typeof window !== 'undefined') {
        localStorage.setItem('kawayan_jwt', jwtToken);
        localStorage.setItem('kawayan_session', JSON.stringify(user));
      }
      
      return jwtToken;
    } catch (error) {
      logger.error('Error creating session', { userId, error });
      throw error;
    }
  }
  
  // --- Profiles ---
  async saveProfile(profile: BrandProfile): Promise<void> {
    const db = this.dbConfig.getDatabase();
    
    try {
      const existingProfile = db.prepare('SELECT id FROM brand_profiles WHERE user_id = ?').get(profile.userId);
      
      if (existingProfile) {
        // Update existing profile
        db.prepare(`
          UPDATE brand_profiles 
          SET business_name = ?, industry = ?, target_audience = ?, brand_voice = ?, key_themes = ?,
              brand_colors = ?, contact_email = ?, contact_phone = ?
          WHERE user_id = ?
        `).run(
          profile.businessName,
          profile.industry,
          profile.targetAudience,
          profile.brandVoice,
          profile.keyThemes,
          JSON.stringify(profile.brandColors || []),
          profile.contactEmail || null,
          profile.contactPhone || null,
          profile.userId
        );
      } else {
        // Insert new profile
        db.prepare(`
          INSERT INTO brand_profiles (id, user_id, business_name, industry, target_audience, brand_voice, key_themes, brand_colors, contact_email, contact_phone)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          profile.id || Date.now().toString(),
          profile.userId,
          profile.businessName,
          profile.industry,
          profile.targetAudience,
          profile.brandVoice,
          profile.keyThemes,
          JSON.stringify(profile.brandColors || []),
          profile.contactEmail || null,
          profile.contactPhone || null
        );
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      throw error;
    }
  }
  
  async getProfile(userId: string): Promise<BrandProfile | undefined> {
    const db = this.dbConfig.getDatabase();
    
    try {
      const row = db.prepare('SELECT * FROM brand_profiles WHERE user_id = ?').get(userId) as any;
      if (!row) return undefined;

      return {
        id: row.id,
        userId: row.user_id,
        businessName: row.business_name,
        industry: row.industry,
        targetAudience: row.target_audience,
        brandVoice: row.brand_voice,
        keyThemes: row.key_themes,
        brandColors: row.brand_colors ? JSON.parse(row.brand_colors) : [],
        contactEmail: row.contact_email,
        contactPhone: row.contact_phone
      };
    } catch (error) {
      console.error('Error getting profile:', error);
      return undefined;
    }
  }
  
  // --- Posts ---
  async savePost(post: GeneratedPost): Promise<void> {
    const db = this.dbConfig.getDatabase();
    
    try {
      const existingPost = db.prepare('SELECT id FROM generated_posts WHERE id = ?').get(post.id);
      
      if (existingPost) {
        // Update existing post
        db.prepare(`
          UPDATE generated_posts 
          SET date = ?, topic = ?, caption = ?, image_prompt = ?, image_url = ?, 
              status = ?, virality_score = ?, virality_reason = ?, format = ?,
              external_link = ?, published_at = ?, regen_count = ?, history = ?
          WHERE id = ?
        `).run(
          post.date,
          post.topic,
          post.caption,
          post.imagePrompt,
          post.imageUrl || null,
          post.status,
          post.viralityScore || null,
          post.viralityReason || null,
          post.format || null,
          post.externalLink || null,
          post.publishedAt || null,
          post.regenCount || 0,
          JSON.stringify(post.history || []),
          post.id
        );
      } else {
        // Insert new post
        db.prepare(`
          INSERT INTO generated_posts (id, user_id, date, topic, caption, image_prompt, image_url, status, virality_score, virality_reason, format, external_link, published_at, regen_count, history)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          post.id,
          post.userId,
          post.date,
          post.topic,
          post.caption,
          post.imagePrompt,
          post.imageUrl || null,
          post.status,
          post.viralityScore || null,
          post.viralityReason || null,
          post.format || null,
          post.externalLink || null,
          post.publishedAt || null,
          post.regenCount || 0,
          JSON.stringify(post.history || [])
        );
      }
    } catch (error) {
      console.error('Error saving post:', error);
      throw error;
    }
  }
  
  async getUserPosts(userId: string): Promise<GeneratedPost[]> {
    const db = this.dbConfig.getDatabase();
    
    try {
      const rows = db.prepare('SELECT * FROM generated_posts WHERE user_id = ? ORDER BY date DESC').all(userId) as any[];
      return rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        date: row.date,
        topic: row.topic,
        caption: row.caption,
        imagePrompt: row.image_prompt,
        imageUrl: row.image_url,
        status: row.status,
        viralityScore: row.virality_score,
        viralityReason: row.virality_reason,
        format: row.format,
        externalLink: row.external_link,
        publishedAt: row.published_at,
        regenCount: row.regen_count || 0,
        history: row.history ? JSON.parse(row.history) : []
      }));
    } catch (error) {
      console.error('Error getting user posts:', error);
      return [];
    }
  }

  // --- Content Plans ---
  async savePlan(userId: string, month: string, ideas: any[]): Promise<void> {
    const db = this.dbConfig.getDatabase();
    const id = `${userId}-${month}`;
    const ideasJson = JSON.stringify(ideas);
    
    try {
      const existingPlan = db.prepare('SELECT id FROM content_plans WHERE id = ?').get(id);
      
      if (existingPlan) {
        db.prepare('UPDATE content_plans SET ideas = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(ideasJson, id);
      } else {
        db.prepare('INSERT INTO content_plans (id, user_id, month, ideas) VALUES (?, ?, ?, ?)').run(id, userId, month, ideasJson);
      }
    } catch (error) {
      console.error('Error saving plan:', error);
      throw error;
    }
  }

  async getPlan(userId: string, month: string): Promise<any[] | null> {
    const db = this.dbConfig.getDatabase();
    try {
      const plan = db.prepare('SELECT ideas FROM content_plans WHERE user_id = ? AND month = ?').get(userId, month) as { ideas: string } | undefined;
      return plan ? JSON.parse(plan.ideas) : null;
    } catch (error) {
      console.error('Error getting plan:', error);
      return null;
    }
  }

  // --- Wallet & Transactions ---
  async getWallet(userId: string): Promise<any> {
    const db = this.dbConfig.getDatabase();
    try {
      let wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(userId) as any;
      
      if (!wallet) {
        // Create default wallet
        db.prepare('INSERT INTO wallets (user_id, balance, currency, subscription) VALUES (?, ?, ?, ?)').run(userId, 0, 'PHP', 'FREE');
        wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(userId);
      }

      const transactions = db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC').all(userId) as any[];

      return {
        balance: wallet.balance,
        currency: wallet.currency,
        subscription: wallet.subscription,
        transactions: transactions.map(t => ({
          id: t.id,
          date: t.date,
          description: t.description,
          amount: t.amount,
          status: t.status,
          type: t.type
        }))
      };
    } catch (error) {
      console.error('Error getting wallet:', error);
      throw error;
    }
  }

  async createTransaction(userId: string, amount: number, description: string, type: 'CREDIT' | 'DEBIT', status: 'PENDING' | 'COMPLETED' = 'COMPLETED'): Promise<void> {
    const db = this.dbConfig.getDatabase();
    const id = `txn_${Date.now()}`;
    
    try {
      db.transaction(() => {
        // Add transaction record
        db.prepare(`
          INSERT INTO transactions (id, user_id, description, amount, status, type)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, userId, description, amount, status, type);

        // Update wallet balance ONLY if COMPLETED
        if (status === 'COMPLETED') {
          if (type === 'CREDIT') {
            db.prepare('UPDATE wallets SET balance = balance + ? WHERE user_id = ?').run(amount, userId);
          } else {
            db.prepare('UPDATE wallets SET balance = balance - ? WHERE user_id = ?').run(amount, userId);
          }
        }
      })();
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  }

  async approveTransaction(transactionId: string): Promise<void> {
    const db = this.dbConfig.getDatabase();
    try {
      db.transaction(() => {
        const txn = db.prepare('SELECT * FROM transactions WHERE id = ? AND status = "PENDING"').get(transactionId) as any;
        if (!txn) throw new Error("Pending transaction not found");

        db.prepare('UPDATE transactions SET status = "COMPLETED" WHERE id = ?').run(transactionId);
        
        if (txn.type === 'CREDIT') {
          db.prepare('UPDATE wallets SET balance = balance + ? WHERE user_id = ?').run(txn.amount, txn.user_id);
        } else {
          db.prepare('UPDATE wallets SET balance = balance - ? WHERE user_id = ?').run(txn.amount, txn.user_id);
        }
      })();
    } catch (error) {
      console.error('Error approving transaction:', error);
      throw error;
    }
  }

  async updateSubscription(userId: string, plan: 'FREE' | 'PRO' | 'ENTERPRISE'): Promise<void> {
    const db = this.dbConfig.getDatabase();
    try {
      db.prepare('UPDATE wallets SET subscription = ? WHERE user_id = ?').run(plan, userId);
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw error;
    }
  }
  
  // --- Admin Stats ---
  async getAdminStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalPostsGenerated: number;
    revenue: number;
    revenueData: { name: string; value: number }[];
    churnData: { name: string; value: number }[];
  }> {
    const db = this.dbConfig.getDatabase();
    
    try {
      const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
      const activeUsers = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'user'").get() as { count: number }).count;
      const totalPostsGenerated = (db.prepare('SELECT COUNT(*) as count FROM generated_posts').get() as { count: number }).count;
      const revenue = totalUsers * 500; // Mock revenue: 500 PHP per user
      
      // Calculate Revenue Growth (Users per month * 500)
      const userGrowth = db.prepare(`
        SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count 
        FROM users 
        WHERE created_at >= date('now', '-6 months')
        GROUP BY month 
        ORDER BY month ASC
      `).all() as { month: string; count: number }[];
      
      const revenueData = userGrowth.map(item => {
        const date = new Date(item.month + '-01');
        return {
          name: date.toLocaleDateString('en-US', { month: 'short' }),
          value: item.count * 500 // Cumulative would be better but this shows monthly "sales"
        };
      });

      // Mock Churn (we don't have deleted_at yet, so return 0s or minimal)
      // Legitimately, we have 0 churn in this schema.
      const churnData = revenueData.map(d => ({ name: d.name, value: 0 }));

      return {
        totalUsers,
        activeUsers,
        totalPostsGenerated,
        revenue,
        revenueData,
        churnData
      };
    } catch (error) {
      console.error('Error getting admin stats:', error);
      return {
        totalUsers: 0,
        activeUsers: 0,
        totalPostsGenerated: 0,
        revenue: 0,
        revenueData: [],
        churnData: []
      };
    }
  }
  
  // --- Helper Methods ---
  private async initializeDefaultAdmin(): Promise<void> {
    const db = this.dbConfig.getDatabase();
    
    try {
      // Check if admin user exists
      const existingAdmin = db.prepare("SELECT id FROM users WHERE email = 'admin@kawayan.ph'").get();
      
      if (!existingAdmin) {
        // Create default admin user
        const adminId = Date.now().toString();
        const passwordHash = await JWTService.hashPassword('Admin123!');
        
        db.prepare(`
          INSERT INTO users (id, email, password_hash, role, business_name)
          VALUES (?, ?, ?, ?, ?)
        `).run(adminId, 'admin@kawayan.ph', passwordHash, 'admin', 'Kawayan Admin');
        
        console.log('Default admin user created');
      }
    } catch (error) {
      console.error('Error initializing default admin:', error);
    }
  }
  
  // --- Database Management ---
  async close(): Promise<void> {
    this.dbConfig.close();
  }
  
  // Transaction helper
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return this.dbConfig.transaction(async () => {
      return await fn();
    });
  }
  
  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const db = this.dbConfig.getDatabase();
    
    try {
      const result = db.prepare('SELECT 1 as test').get();
      return {
        status: result ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString()
      };
    }
  }
}