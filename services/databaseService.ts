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

    // Validate password strength before DB operations
    const passwordValidation = JWTService.validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      throw new Error(`Password requirements: ${passwordValidation.errors.join(', ')}`);
    }
    
    try {
      // Check if user already exists
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existingUser) return null;
      
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
      throw error; // Rethrow unexpected DB errors so controller can handle (or return null if we really want to hide DB errors, but validation must throw)
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

  async updateUserPassword(userId: string, newPassword: string): Promise<boolean> {
    const db = this.dbConfig.getDatabase();
    try {
      // Validate password strength again (double check)
      const passwordValidation = JWTService.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        throw new Error(`Password requirements: ${passwordValidation.errors.join(', ')}`);
      }
      
      const passwordHash = await JWTService.hashPassword(newPassword);
      
      const result = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
      return result.changes > 0;
    } catch (error) {
      logger.logDatabaseError('updateUserPassword', error, userId);
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
  async postExists(postId: string): Promise<boolean> {
    const db = this.dbConfig.getDatabase();
    try {
      const row = db.prepare('SELECT id FROM generated_posts WHERE id = ?').get(postId);
      return !!row;
    } catch {
      return false;
    }
  }

  async countUserPostsInMonth(userId: string, year: number, month: number): Promise<number> {
    const db = this.dbConfig.getDatabase();
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    try {
      const row = db.prepare(
        `SELECT COUNT(*) as count FROM generated_posts WHERE user_id = ? AND date LIKE ?`
      ).get(userId, `${prefix}%`) as { count: number };
      return row?.count ?? 0;
    } catch (error) {
      console.error('Error counting monthly posts:', error);
      return 0;
    }
  }

  async assertTierAllowsNewPost(userId: string, postDate: string): Promise<void> {
    const [year, month] = postDate.split('-').map(Number);
    const wallet = await this.getWallet(userId);
    const limit =
      wallet.subscription === 'PRO' || wallet.subscription === 'ENTERPRISE' ? 16 : 8;
    const count = await this.countUserPostsInMonth(userId, year, month);
    if (count >= limit) {
      const err = new Error('TIER_LIMIT_REACHED');
      (err as any).code = 'TIER_LIMIT_REACHED';
      (err as any).limit = limit;
      throw err;
    }
  }

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
        const isPaidAddOn = String(post.id).startsWith('addon-');
        if (!isPaidAddOn) {
          await this.assertTierAllowsNewPost(post.userId, post.date);
        }
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
      // Auto-expire old pending transactions
      db.transaction(() => {
        const pendingTxns = db.prepare("SELECT id, date FROM transactions WHERE user_id = ? AND status = 'PENDING'").all(userId) as any[];
        for (const txn of pendingTxns) {
          const txnDate = new Date(txn.date).getTime();
          const hoursDiff = (Date.now() - txnDate) / (1000 * 60 * 60);
          if (hoursDiff > 12) {
            db.prepare("UPDATE transactions SET status = 'FAILED' WHERE id = ?").run(txn.id);
          }
        }
      });

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
        // Check for existing pending transactions
        if (status === 'PENDING') {
          const pendingTxn = db.prepare("SELECT id, date FROM transactions WHERE user_id = ? AND status = 'PENDING'").get(userId) as any;
          
          if (pendingTxn) {
            const txnDate = new Date(pendingTxn.date).getTime();
            const now = Date.now();
            const hoursDiff = (now - txnDate) / (1000 * 60 * 60);
            
            if (hoursDiff > 12) {
              // Expired, mark as FAILED
              db.prepare("UPDATE transactions SET status = 'FAILED' WHERE id = ?").run(pendingTxn.id);
            } else {
              // Still valid, prevent new transaction
              throw new Error("You have a pending transaction. Please complete or cancel it before starting a new one.");
            }
          }
        }

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

  async cancelTransaction(transactionId: string, userId: string): Promise<void> {
    const db = this.dbConfig.getDatabase();
    try {
      const result = db.prepare("UPDATE transactions SET status = 'CANCELLED' WHERE id = ? AND user_id = ? AND status = 'PENDING'").run(transactionId, userId);
      if (result.changes === 0) {
        throw new Error("Transaction not found or not pending");
      }
    } catch (error) {
      console.error('Error cancelling transaction:', error);
      throw error;
    }
  }

  async approveTransaction(transactionId: string): Promise<void> {
    const db = this.dbConfig.getDatabase();
    try {
      db.transaction(() => {
        const txn = db.prepare("SELECT * FROM transactions WHERE id = ? AND status = 'PENDING'").get(transactionId) as any;
        if (!txn) throw new Error("Pending transaction not found");

        db.prepare("UPDATE transactions SET status = 'COMPLETED' WHERE id = ?").run(transactionId);
        
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
  
  async getAllUsers(): Promise<User[]> {
    const db = this.dbConfig.getDatabase();
    try {
      const rows = db.prepare(`
        SELECT u.id, u.email, u.role, u.business_name as businessName, u.created_at as createdAt, w.balance
        FROM users u
        LEFT JOIN wallets w ON u.id = w.user_id
        ORDER BY u.created_at DESC
      `).all() as any[];
      return rows.map(row => ({
        id: row.id,
        email: row.email,
        role: row.role,
        businessName: row.businessName,
        createdAt: row.createdAt,
        balance: row.balance || 0
      }));
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }

  async updateUser(userId: string, data: any): Promise<void> {
    const db = this.dbConfig.getDatabase();
    try {
      const fields = [];
      const values = [];
      if (data.role) { fields.push('role = ?'); values.push(data.role); }
      if (data.businessName !== undefined) { fields.push('business_name = ?'); values.push(data.businessName); }
      
      if (fields.length === 0) return;
      
      values.push(userId);
      db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    const db = this.dbConfig.getDatabase();
    try {
      db.transaction(() => {
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        db.prepare('DELETE FROM wallets WHERE user_id = ?').run(userId);
        db.prepare('DELETE FROM transactions WHERE user_id = ?').run(userId);
        db.prepare('DELETE FROM brand_profiles WHERE user_id = ?').run(userId);
        db.prepare('DELETE FROM generated_posts WHERE user_id = ?').run(userId);
        db.prepare('DELETE FROM tickets WHERE user_id = ?').run(userId);
      })();
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  async adminAdjustBalance(userId: string, amount: number, reason: string): Promise<void> {
    try {
      await this.createTransaction(userId, Math.abs(amount), reason, amount >= 0 ? 'CREDIT' : 'DEBIT', 'COMPLETED');
    } catch (error) {
      console.error('Error adjusting balance:', error);
      throw error;
    }
  }

  async adminUpdateSubscription(userId: string, plan: 'FREE' | 'PRO' | 'ENTERPRISE', expiresAt: string): Promise<void> {
    const db = this.dbConfig.getDatabase();
    try {
      db.prepare('UPDATE wallets SET subscription = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(plan, userId);
      // If we had an expires_at column in wallets, we'd update it here too.
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw error;
    }
  }

  // --- Social Media Connections ---
  async saveSocialConnection(userId: string, platform: string, data: any): Promise<void> {
    const db = this.dbConfig.getDatabase();
    const id = `${userId}-${platform}`;
    
    try {
      const existing = db.prepare('SELECT id FROM social_connections WHERE user_id = ? AND platform = ?').get(userId, platform);
      
      if (existing) {
        db.prepare(`
          UPDATE social_connections 
          SET connected = ?, username = ?, access_token = ?, followers = ?, engagement = ?, data = ?, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND platform = ?
        `).run(
          data.connected ? 1 : 0,
          data.username || null,
          data.accessToken || null,
          data.followers || 0,
          data.engagement || 0,
          JSON.stringify(data),
          userId,
          platform
        );
      } else {
        db.prepare(`
          INSERT INTO social_connections (id, user_id, platform, connected, username, access_token, followers, engagement, data)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          userId,
          platform,
          data.connected ? 1 : 0,
          data.username || null,
          data.accessToken || null,
          data.followers || 0,
          data.engagement || 0,
          JSON.stringify(data)
        );
      }
    } catch (error) {
      console.error('Error saving social connection:', error);
      throw error;
    }
  }

  async getSocialConnections(userId: string): Promise<any> {
    const db = this.dbConfig.getDatabase();
    try {
      const rows = db.prepare('SELECT * FROM social_connections WHERE user_id = ?').all(userId) as any[];
      
      // Convert to object keyed by platform
      const connections: any = {};
      rows.forEach(row => {
        connections[row.platform] = {
          ...JSON.parse(row.data),
          connected: row.connected === 1,
          username: row.username,
          followers: row.followers,
          engagement: row.engagement
        };
      });
      
      return connections;
    } catch (error) {
      console.error('Error getting social connections:', error);
      return {};
    }
  }

  // --- Support Tickets ---
  async createTicket(ticket: any): Promise<void> {
    const db = this.dbConfig.getDatabase();
    
    try {
      db.prepare(`
        INSERT INTO tickets (id, ticket_num, user_id, user_email, subject, priority, status, created_at, messages)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ticket.id,
        ticket.ticketNum,
        ticket.userId,
        ticket.userEmail,
        ticket.subject,
        ticket.priority,
        ticket.status,
        ticket.createdAt,
        JSON.stringify(ticket.messages || [])
      );
    } catch (error) {
      console.error('Error creating ticket:', error);
      throw error;
    }
  }

  async getTickets(userId: string): Promise<any[]> {
    const db = this.dbConfig.getDatabase();
    try {
      const rows = db.prepare('SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC').all(userId) as any[];
      return rows.map(row => ({
        id: row.id,
        ticketNum: row.ticket_num,
        userId: row.user_id,
        userEmail: row.user_email,
        subject: row.subject,
        priority: row.priority,
        status: row.status,
        createdAt: row.created_at,
        messages: JSON.parse(row.messages || '[]')
      }));
    } catch (error) {
      console.error('Error getting tickets:', error);
      return [];
    }
  }

  async getAllTicketsAdmin(): Promise<any[]> {
    const db = this.dbConfig.getDatabase();
    try {
      const rows = db.prepare('SELECT * FROM tickets ORDER BY created_at DESC').all() as any[];
      return rows.map(row => ({
        id: row.id,
        ticketNum: row.ticket_num,
        userId: row.user_id,
        userEmail: row.user_email,
        subject: row.subject,
        priority: row.priority,
        status: row.status,
        createdAt: row.created_at,
        messages: JSON.parse(row.messages || '[]')
      }));
    } catch (error) {
      console.error('Error getting all tickets:', error);
      return [];
    }
  }

  async updateTicket(ticketId: string, status: string, messages?: any[]): Promise<void> {
    const db = this.dbConfig.getDatabase();
    try {
      if (messages) {
        db.prepare('UPDATE tickets SET status = ?, messages = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, JSON.stringify(messages), ticketId);
      } else {
        db.prepare('UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, ticketId);
      }
    } catch (error) {
      console.error('Error updating ticket:', error);
      throw error;
    }
  }

  async resolveTicketByUserId(userId: string): Promise<void> {
    const db = this.dbConfig.getDatabase();
    try {
      db.prepare("UPDATE tickets SET status = 'Resolved', updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND status != 'Resolved'").run(userId);
    } catch (error) {
      console.error('Error resolving user tickets:', error);
      throw error;
    }
  }

  // --- Active Calls ---
  async registerCall(userId: string, userEmail: string, roomName: string, reason?: string): Promise<void> {
    const db = this.dbConfig.getDatabase();
    try {
      logger.info('Registering active call', { userId, userEmail, roomName, reason });
      db.prepare(`
        INSERT OR REPLACE INTO active_calls (user_id, user_email, room_name, reason)
        VALUES (?, ?, ?, ?)
      `).run(userId, userEmail, roomName, reason || null);
    } catch (error) {
      console.error('Error registering call:', error);
      throw error;
    }
  }

  async unregisterCall(userId: string, agentId?: string): Promise<void> {
    const db = this.dbConfig.getDatabase();
    try {
      logger.info('Unregistering active call', { userId });
      
      // Get call info before deleting to log it
      const call = db.prepare('SELECT * FROM active_calls WHERE user_id = ?').get(userId) as any;
      if (call) {
        const endedAt = new Date().toISOString();
        const startedAt = new Date(call.started_at).getTime();
        const duration = Math.floor((Date.now() - startedAt) / 1000);
        const callId = call.room_name.split('-')[1] || null;
        
        db.prepare(`
          INSERT INTO call_history (id, user_id, user_email, call_id, reason, started_at, duration_seconds, agent_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(Date.now().toString(), userId, call.user_email, callId, call.reason, call.started_at, duration, agentId || null);
      }

      db.prepare('DELETE FROM active_calls WHERE user_id = ?').run(userId);
    } catch (error) {
      console.error('Error unregistering call:', error);
      throw error;
    }
  }

  async getActiveCalls(): Promise<any[]> {
    const db = this.dbConfig.getDatabase();
    try {
      return db.prepare('SELECT * FROM active_calls ORDER BY started_at ASC').all();
    } catch (error) {
      console.error('Error getting active calls:', error);
      return [];
    }
  }

  async getCallHistory(): Promise<any[]> {
    const db = this.dbConfig.getDatabase();
    try {
      return db.prepare('SELECT * FROM call_history ORDER BY started_at DESC LIMIT 100').all();
    } catch (error) {
      console.error('Error getting call history:', error);
      return [];
    }
  }

  // --- Admin Stats ---
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
    const db = this.dbConfig.getDatabase();
    
    try {
      const startFilter = start ? start : '1970-01-01';
      const endFilter = end ? end : '9999-12-31';

      const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users WHERE created_at BETWEEN ? AND ?').get(startFilter, endFilter) as { count: number }).count;
      const activeUsers = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'user' AND created_at BETWEEN ? AND ?").get(startFilter, endFilter) as { count: number }).count;
      const totalPostsGenerated = (db.prepare('SELECT COUNT(*) as count FROM generated_posts WHERE created_at BETWEEN ? AND ?').get(startFilter, endFilter) as { count: number }).count;
      const revenue = (db.prepare("SELECT SUM(amount) as total FROM transactions WHERE status = 'COMPLETED' AND type = 'CREDIT' AND date BETWEEN ? AND ?").get(startFilter, endFilter) as { total: number }).total || 0;
      const cancelledTransactions = (db.prepare("SELECT COUNT(*) as count FROM transactions WHERE status = 'CANCELLED' AND date BETWEEN ? AND ?").get(startFilter, endFilter) as { count: number }).count;
      const pendingTransactions = (db.prepare("SELECT COUNT(*) as count FROM transactions WHERE status = 'PENDING' AND date BETWEEN ? AND ?").get(startFilter, endFilter) as { count: number }).count;
      
      // Calculate Revenue Growth
      const userGrowth = db.prepare(`
        SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count 
        FROM users 
        WHERE created_at BETWEEN ? AND ?
        GROUP BY month 
        ORDER BY month ASC
      `).all(startFilter, endFilter) as { month: string; count: number }[];
      
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
        cancelledTransactions,
        pendingTransactions,
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
        cancelledTransactions: 0,
        pendingTransactions: 0,
        revenueData: [],
        churnData: []
      };
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Business Verification Methods
  // ─────────────────────────────────────────────────────────────────────────

  async submitVerification(userId: string, businessAddress: string, businessPhone: string, documentName: string, documentPath: string): Promise<void> {
    const db = this.dbConfig.getDatabase();
    const id = `verif_${Date.now()}`;
    try {
      // Upsert: if a previous record exists (e.g. rejected), replace it
      db.prepare(`
        INSERT INTO business_verifications (id, user_id, business_address, business_phone, document_name, document_path, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
        ON CONFLICT(user_id) DO UPDATE SET
          business_address = excluded.business_address,
          business_phone = excluded.business_phone,
          document_name = excluded.document_name,
          document_path = excluded.document_path,
          status = 'pending',
          rejection_reason = NULL,
          reviewed_by = NULL,
          reviewed_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      `).run(id, userId, businessAddress, businessPhone, documentName, documentPath);
    } catch (error) {
      console.error('Error submitting verification:', error);
      throw error;
    }
  }

  async resubmitVerification(userId: string, documentName: string, documentPath: string): Promise<void> {
    const db = this.dbConfig.getDatabase();
    try {
      const updated = db.prepare(`
        UPDATE business_verifications SET
          document_name = ?, document_path = ?,
          status = 'pending', rejection_reason = NULL,
          reviewed_by = NULL, reviewed_at = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(documentName, documentPath, userId);
      if (updated.changes === 0) throw new Error('No verification record found to update');
    } catch (error) {
      console.error('Error resubmitting verification:', error);
      throw error;
    }
  }

  async getVerification(userId: string): Promise<any | null> {
    const db = this.dbConfig.getDatabase();
    try {
      const row = db.prepare('SELECT * FROM business_verifications WHERE user_id = ?').get(userId) as any;
      if (!row) return null;
      return {
        id: row.id,
        userId: row.user_id,
        businessAddress: row.business_address,
        businessPhone: row.business_phone,
        documentName: row.document_name,
        documentPath: row.document_path,
        status: row.status,
        rejectionReason: row.rejection_reason,
        reviewedBy: row.reviewed_by,
        reviewedAt: row.reviewed_at,
        createdAt: row.created_at,
      };
    } catch (error) {
      console.error('Error getting verification:', error);
      return null;
    }
  }

  async getVerificationById(id: string): Promise<any | null> {
    const db = this.dbConfig.getDatabase();
    try {
      const row = db.prepare('SELECT * FROM business_verifications WHERE id = ?').get(id) as any;
      if (!row) return null;
      return {
        id: row.id,
        userId: row.user_id,
        businessAddress: row.business_address,
        businessPhone: row.business_phone,
        documentName: row.document_name,
        document_path: row.document_path,
        status: row.status,
        rejectionReason: row.rejection_reason,
      };
    } catch (error) {
      console.error('Error getting verification by id:', error);
      return null;
    }
  }

  async getAllVerifications(): Promise<any[]> {
    const db = this.dbConfig.getDatabase();
    try {
      const rows = db.prepare(`
        SELECT bv.*, u.email, u.business_name
        FROM business_verifications bv
        JOIN users u ON bv.user_id = u.id
        ORDER BY bv.created_at DESC
      `).all() as any[];
      return rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        email: row.email,
        businessName: row.business_name,
        businessAddress: row.business_address,
        businessPhone: row.business_phone,
        documentName: row.document_name,
        documentPath: row.document_path,
        status: row.status,
        rejectionReason: row.rejection_reason,
        reviewedBy: row.reviewed_by,
        reviewedAt: row.reviewed_at,
        createdAt: row.created_at,
      }));
    } catch (error) {
      console.error('Error getting all verifications:', error);
      return [];
    }
  }

  async approveVerification(id: string, adminId: string): Promise<void> {
    const db = this.dbConfig.getDatabase();
    try {
      db.prepare(`
        UPDATE business_verifications SET
          status = 'verified',
          reviewed_by = ?,
          reviewed_at = CURRENT_TIMESTAMP,
          rejection_reason = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(adminId, id);
    } catch (error) {
      console.error('Error approving verification:', error);
      throw error;
    }
  }

  async rejectVerification(id: string, adminId: string, reason: string): Promise<void> {
    const db = this.dbConfig.getDatabase();
    try {
      db.prepare(`
        UPDATE business_verifications SET
          status = 'rejected',
          reviewed_by = ?,
          reviewed_at = CURRENT_TIMESTAMP,
          rejection_reason = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(adminId, reason, id);
    } catch (error) {
      console.error('Error rejecting verification:', error);
      throw error;
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
  
  async getAuditLogs(limit: number = 100): Promise<any[]> {
    const db = this.dbConfig.getDatabase();
    try {
      return db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?').all(limit);
    } catch (error) {
      console.error('Error getting audit logs:', error);
      return [];
    }
  }

  // --- Database Management ---
  async close(): Promise<void> {
    this.dbConfig.close();
  }
  
  // Transaction helper
  transaction<T>(fn: () => T): T {
    return this.dbConfig.transaction(() => {
      return fn();
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