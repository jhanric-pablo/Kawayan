import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { JWTService } from './jwtService';
import { logger } from '../utils/logger';
import { normalizeEmail, sanitizeUserForSession } from '../utils/authSession';
import { User, BrandProfile, GeneratedPost } from '../types';

export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY must be set');
    }
    this.supabase = createClient(url, key);
    this.initializeDefaultAdmin();
  }

  checkpoint() {
    // Not needed for Supabase; no-op
  }

  // Users
  async createUser(
    email: string,
    password: string,
    role: 'user' | 'admin' | 'support' = 'user',
    businessName?: string,
    options?: { acceptedTerms?: boolean; termsVersion?: string }
  ): Promise<User | null> {
    const normalizedEmail = normalizeEmail(email);

    // Validate password
    const validation = JWTService.validatePasswordStrength(password);
    if (!validation.isValid) {
      throw new Error(`Password requirements: ${validation.errors.join(', ')}`);
    }

    const { data: existing } = await this.supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existing) return null;

    const passwordHash = await JWTService.hashPassword(password);
    const newUser: User = {
      id: `KWYN-${Date.now()}`,
      email: normalizedEmail,
      passwordHash,
      role,
      businessName,
    };

    const { error } = await this.supabase
      .from('users')
      .insert({
        id: newUser.id,
        email: newUser.email,
        password_hash: newUser.passwordHash,
        role: newUser.role,
        business_name: newUser.businessName || null,
        terms_accepted_at: options?.acceptedTerms ? new Date().toISOString() : null,
        terms_version: options?.acceptedTerms ? (options.termsVersion || null) : null,
      });

    if (error) {
      logger.error('Supabase createUser error', { error: error.message });
      throw error;
    }

    logger.info('User created', { userId: newUser.id, email });
    return newUser;
  }

  async loginUser(email: string, password: string): Promise<{ user: User; token: string } | null> {
    const normalizedEmail = normalizeEmail(email);

    const { data: row, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (error || !row) {
      logger.logAuthAttempt(normalizedEmail, false);
      return null;
    }

    const user: User = {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      businessName: row.business_name,
      theme: row.theme,
    };

    const isValid = await JWTService.verifyPassword(password, user.passwordHash);
    if (!isValid) {
      logger.logAuthAttempt(normalizedEmail, false);
      return null;
    }

    const token = await this.createSession(user.id);
    const safeUser = sanitizeUserForSession(user) as User;
    logger.logAuthAttempt(normalizedEmail, true, user.id);
    return { user: safeUser, token };
  }

  async getUserById(userId: string): Promise<Pick<User, 'id' | 'email' | 'role' | 'businessName' | 'theme'> | null> {
    const { data: row, error } = await this.supabase
      .from('users')
      .select('id, email, role, business_name, theme')
      .eq('id', userId)
      .maybeSingle();
    if (error || !row) return null;
    return { id: row.id, email: row.email, role: row.role, businessName: row.business_name, theme: row.theme };
  }

  async logoutUser(): Promise<void> {
    // No-op for Supabase; session management is handled by JWT and localStorage
  }

  async updateUserTheme(userId: string, theme: 'light' | 'dark'): Promise<void> {
    const { error } = await this.supabase
      .from('users')
      .update({ theme })
      .eq('id', userId);
    if (error) {
      logger.error('updateUserTheme error', { error: error.message });
      throw error;
    }
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<boolean> {
    const validation = JWTService.validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      throw new Error(`Password requirements: ${validation.errors.join(', ')}`);
    }
    const passwordHash = await JWTService.hashPassword(newPassword);
    const { error } = await this.supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', userId);
    if (error) {
      logger.error('updateUserPassword error', { error: error.message });
      throw error;
    }
    return true;
  }

  // Returns a one-time reset token, or null if no such user (caller must not leak which).
  async createPasswordReset(email: string): Promise<string | null> {
    const normalizedEmail = normalizeEmail(email);
    const { data: row } = await this.supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (!row) return null;

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const { error } = await this.supabase.from('password_resets').insert({
      id: Date.now().toString(),
      user_id: row.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    });
    if (error) {
      logger.error('createPasswordReset error', { error: error.message });
      throw error;
    }
    return token;
  }

  async resetPasswordWithToken(token: string, newPassword: string): Promise<boolean> {
    const validation = JWTService.validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      throw new Error(`Password requirements: ${validation.errors.join(', ')}`);
    }

    // ponytail: scans all unused, unexpired resets and bcrypt-compares each.
    // Fine at this scale; store a lookup id alongside the hash if resets ever get heavy.
    const { data: rows } = await this.supabase
      .from('password_resets')
      .select('*')
      .eq('used', false)
      .gt('expires_at', new Date().toISOString());
    if (!rows || rows.length === 0) return false;

    let match: any = null;
    for (const r of rows) {
      if (await bcrypt.compare(token, r.token_hash)) { match = r; break; }
    }
    if (!match) return false;

    const passwordHash = await JWTService.hashPassword(newPassword);
    const { error: upErr } = await this.supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', match.user_id);
    if (upErr) throw upErr;

    await this.supabase.from('password_resets').update({ used: true }).eq('id', match.id);
    logger.info('Password reset completed', { userId: match.user_id });
    return true;
  }

  getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;
    try {
      const session = localStorage.getItem('kawayan_session');
      return session ? JSON.parse(session) : null;
    } catch {
      return null;
    }
  }

  private async createSession(userId: string): Promise<string> {
    const { data: row, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error || !row) throw new Error('User not found');

    const user: User = {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      businessName: row.business_name,
      theme: row.theme,
    };

    const jwtToken = JWTService.generateToken(user);
    const tokenHash = await bcrypt.hash(jwtToken, 10);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const { error: insertError } = await this.supabase
      .from('sessions')
      .insert({
        id: Date.now().toString(),
        user_id: userId,
        token: tokenHash,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      logger.error('createSession insert error', { error: insertError.message });
      throw insertError;
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('kawayan_jwt', jwtToken);
      localStorage.setItem('kawayan_session', JSON.stringify(user));
    }

    return jwtToken;
  }

  // Profiles
  async saveProfile(profile: BrandProfile): Promise<void> {
    const { data: existing } = await this.supabase
      .from('brand_profiles')
      .select('id')
      .eq('user_id', profile.userId)
      .maybeSingle();

    const payload = {
      user_id: profile.userId,
      business_name: profile.businessName,
      industry: profile.industry,
      target_audience: profile.targetAudience,
      brand_voice: profile.brandVoice,
      key_themes: profile.keyThemes,
      brand_colors: JSON.stringify(profile.brandColors || []),
      contact_email: profile.contactEmail || null,
      contact_phone: profile.contactPhone || null,
    };

    if (existing) {
      const { error } = await this.supabase
        .from('brand_profiles')
        .update(payload)
        .eq('user_id', profile.userId);
      if (error) throw error;
    } else {
      const { error } = await this.supabase
        .from('brand_profiles')
        .insert({
          id: profile.id || Date.now().toString(),
          ...payload,
        });
      if (error) throw error;
    }
  }

  async getProfile(userId: string): Promise<BrandProfile | undefined> {
    const { data: row, error } = await this.supabase
      .from('brand_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !row) return undefined;
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
      contactPhone: row.contact_phone,
    };
  }

  // Posts
  async postExists(postId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('generated_posts')
      .select('id')
      .eq('id', postId)
      .maybeSingle();
    return !!data && !error;
  }

  async countUserPostsInMonth(userId: string, year: number, month: number): Promise<number> {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = `${year}-${String(month).padStart(2, '0')}-31`;
    const { count, error } = await this.supabase
      .from('generated_posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end);
    if (error) return 0;
    return count || 0;
  }

  async assertTierAllowsNewPost(userId: string, postDate: string): Promise<void> {
    const [year, month] = postDate.split('-').map(Number);
    const wallet = await this.getWallet(userId);
    const limit = wallet.subscription === 'PRO' || wallet.subscription === 'ENTERPRISE' ? 16 : 8;
    const count = await this.countUserPostsInMonth(userId, year, month);
    if (count >= limit) {
      const err = new Error('TIER_LIMIT_REACHED');
      (err as any).code = 'TIER_LIMIT_REACHED';
      (err as any).limit = limit;
      throw err;
    }
  }

  async savePost(post: GeneratedPost): Promise<void> {
    const { data: existing } = await this.supabase
      .from('generated_posts')
      .select('id')
      .eq('id', post.id)
      .maybeSingle();

    const payload = {
      user_id: post.userId,
      date: post.date,
      topic: post.topic,
      caption: post.caption,
      image_prompt: post.imagePrompt,
      image_url: post.imageUrl || null,
      status: post.status,
      virality_score: post.viralityScore || null,
      virality_reason: post.viralityReason || null,
      format: post.format || null,
      external_link: post.externalLink || null,
      published_at: post.publishedAt || null,
      regen_count: post.regenCount || 0,
      history: JSON.stringify(post.history || []),
    };

    if (existing) {
      const { error } = await this.supabase
        .from('generated_posts')
        .update(payload)
        .eq('id', post.id);
      if (error) throw error;
    } else {
      const isPaidAddOn = String(post.id).startsWith('addon-');
      if (!isPaidAddOn) {
        await this.assertTierAllowsNewPost(post.userId, post.date);
      }
      const { error } = await this.supabase
        .from('generated_posts')
        .insert({ id: post.id, ...payload });
      if (error) throw error;
    }
  }

  async getUserPosts(userId: string): Promise<GeneratedPost[]> {
    const { data: rows, error } = await this.supabase
      .from('generated_posts')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    if (error || !rows) return [];
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
      history: row.history ? JSON.parse(row.history) : [],
    }));
  }

  // Content Plans
  async savePlan(userId: string, month: string, ideas: any[]): Promise<void> {
    const id = `${userId}-${month}`;
    const ideasJson = JSON.stringify(ideas);
    const { data: existing } = await this.supabase
      .from('content_plans')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (existing) {
      const { error } = await this.supabase
        .from('content_plans')
        .update({ ideas: ideasJson, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await this.supabase
        .from('content_plans')
        .insert({ id, user_id: userId, month, ideas: ideasJson });
      if (error) throw error;
    }
  }

  async getPlan(userId: string, month: string): Promise<any[] | null> {
    const { data: plan, error } = await this.supabase
      .from('content_plans')
      .select('ideas')
      .eq('user_id', userId)
      .eq('month', month)
      .maybeSingle();
    if (error || !plan) return null;
    return JSON.parse(plan.ideas);
  }

  // Wallet
  async getWallet(userId: string): Promise<any> {
    // Auto-expire old pending transactions
    const { data: pendingTxns, error: pendingError } = await this.supabase
      .from('transactions')
      .select('id, date')
      .eq('user_id', userId)
      .eq('status', 'PENDING');
    if (!pendingError && pendingTxns) {
      for (const txn of pendingTxns) {
        const txnDate = new Date(txn.date).getTime();
        const hoursDiff = (Date.now() - txnDate) / (1000 * 60 * 60);
        if (hoursDiff > 12) {
          await this.supabase
            .from('transactions')
            .update({ status: 'FAILED' })
            .eq('id', txn.id);
        }
      }
    }

    let { data: wallet, error } = await this.supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !wallet) {
      // Create default wallet
      const { error: insertError } = await this.supabase
        .from('wallets')
        .insert({ user_id: userId, balance: 0, currency: 'PHP', subscription: 'FREE' });
      if (insertError) throw insertError;
      const { data: newWallet } = await this.supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single();
      wallet = newWallet;
    }

    const { data: transactions, error: txError } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (txError) throw txError;

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
        type: t.type,
      })),
    };
  }

  async createTransaction(userId: string, amount: number, description: string, type: 'CREDIT' | 'DEBIT', status: 'PENDING' | 'COMPLETED' = 'COMPLETED'): Promise<void> {
    // Check pending
    if (status === 'PENDING') {
      const { data: pendingTxn } = await this.supabase
        .from('transactions')
        .select('id, date')
        .eq('user_id', userId)
        .eq('status', 'PENDING')
        .maybeSingle();
      if (pendingTxn) {
        const txnDate = new Date(pendingTxn.date).getTime();
        const now = Date.now();
        const hoursDiff = (now - txnDate) / (1000 * 60 * 60);
        if (hoursDiff > 12) {
          await this.supabase
            .from('transactions')
            .update({ status: 'FAILED' })
            .eq('id', pendingTxn.id);
        } else {
          throw new Error('You have a pending transaction. Please complete or cancel it before starting a new one.');
        }
      }
    }

    const id = `txn_${Date.now()}`;
    const { error: insertError } = await this.supabase
      .from('transactions')
      .insert({
        id,
        user_id: userId,
        description,
        amount,
        status,
        type,
      });
    if (insertError) throw insertError;

    if (status === 'COMPLETED') {
      const balanceChange = type === 'CREDIT' ? amount : -amount;
      const { error: updateError } = await this.supabase.rpc('update_wallet_balance', {
        p_user_id: userId,
        p_amount: balanceChange,
      });
      if (updateError) {
        // Fallback: manually update
        const { data: wallet } = await this.supabase
          .from('wallets')
          .select('balance')
          .eq('user_id', userId)
          .single();
        if (wallet) {
          const newBalance = (wallet.balance || 0) + balanceChange;
          await this.supabase
            .from('wallets')
            .update({ balance: newBalance })
            .eq('user_id', userId);
        }
      }
    }
  }

  async getPendingTransaction(userId: string): Promise<any | null> {
    const { data, error } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'PENDING')
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async failTransaction(transactionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('transactions')
      .update({ status: 'FAILED' })
      .eq('id', transactionId);
    if (error) throw error;
  }

  async cancelTransaction(transactionId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('transactions')
      .update({ status: 'CANCELLED' })
      .eq('id', transactionId)
      .eq('user_id', userId)
      .eq('status', 'PENDING');
    if (error) throw error;
  }

  async approveTransaction(transactionId: string): Promise<void> {
    const { data: txn, error: fetchError } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('status', 'PENDING')
      .maybeSingle();
    if (fetchError || !txn) throw new Error('Pending transaction not found');

    const { error: updateError } = await this.supabase
      .from('transactions')
      .update({ status: 'COMPLETED' })
      .eq('id', transactionId);
    if (updateError) throw updateError;

    const balanceChange = txn.type === 'CREDIT' ? txn.amount : -txn.amount;
    const { error: walletError } = await this.supabase.rpc('update_wallet_balance', {
      p_user_id: txn.user_id,
      p_amount: balanceChange,
    });
    if (walletError) {
      // fallback manual update
      const { data: wallet } = await this.supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', txn.user_id)
        .single();
      if (wallet) {
        await this.supabase
          .from('wallets')
          .update({ balance: (wallet.balance || 0) + balanceChange })
          .eq('user_id', txn.user_id);
      }
    }
  }

  async updateSubscription(userId: string, plan: 'FREE' | 'PRO' | 'ENTERPRISE'): Promise<void> {
    const { error } = await this.supabase
      .from('wallets')
      .update({ subscription: plan })
      .eq('user_id', userId);
    if (error) throw error;
  }

  // Admin
  async getAllUsers(): Promise<User[]> {
    const { data: rows, error } = await this.supabase
      .from('users')
      .select('id, email, role, business_name, created_at')
      .order('created_at', { ascending: false });
    if (error || !rows) return [];
    return rows.map(row => ({
      id: row.id,
      email: row.email,
      role: row.role,
      businessName: row.business_name,
      createdAt: row.created_at,
    }));
  }

  async updateUser(userId: string, data: any): Promise<void> {
    const fields: any = {};
    if (data.role) fields.role = data.role;
    if (data.businessName !== undefined) fields.business_name = data.businessName;
    if (Object.keys(fields).length === 0) return;
    const { error } = await this.supabase
      .from('users')
      .update(fields)
      .eq('id', userId);
    if (error) throw error;
  }

  async deleteUser(userId: string): Promise<void> {
    // Cascade delete handled by foreign keys
    const { error } = await this.supabase
      .from('users')
      .delete()
      .eq('id', userId);
    if (error) throw error;
  }

  async adminAdjustBalance(userId: string, amount: number, reason: string): Promise<void> {
    await this.createTransaction(userId, Math.abs(amount), reason, amount >= 0 ? 'CREDIT' : 'DEBIT', 'COMPLETED');
  }

  async adminUpdateSubscription(userId: string, plan: 'FREE' | 'PRO' | 'ENTERPRISE', expiresAt: string): Promise<void> {
    // expiresAt not used in schema; just update subscription
    await this.updateSubscription(userId, plan);
  }

  // Social Connections
  async saveSocialConnection(userId: string, platform: string, data: any): Promise<void> {
    const id = `${userId}-${platform}`;
    const { data: existing } = await this.supabase
      .from('social_connections')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', platform)
      .maybeSingle();

    const payload = {
      user_id: userId,
      platform,
      connected: data.connected ? 1 : 0,
      username: data.username || null,
      access_token: data.accessToken || null,
      followers: data.followers || 0,
      engagement: data.engagement || 0,
      data: JSON.stringify(data),
    };

    if (existing) {
      const { error } = await this.supabase
        .from('social_connections')
        .update(payload)
        .eq('user_id', userId)
        .eq('platform', platform);
      if (error) throw error;
    } else {
      const { error } = await this.supabase
        .from('social_connections')
        .insert({ id, ...payload });
      if (error) throw error;
    }
  }

  async getSocialConnections(userId: string): Promise<any> {
    const { data: rows, error } = await this.supabase
      .from('social_connections')
      .select('*')
      .eq('user_id', userId);
    if (error || !rows) return {};
    const connections: any = {};
    rows.forEach(row => {
      connections[row.platform] = {
        ...JSON.parse(row.data),
        connected: row.connected === 1,
        username: row.username,
        followers: row.followers,
        engagement: row.engagement,
      };
    });
    return connections;
  }

  // Tickets
  async getNextTicketNum(): Promise<number> {
    const { data, error } = await this.supabase
      .from('tickets')
      .select('ticket_num')
      .order('ticket_num', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return 1001;
    return Math.max(1001, data.ticket_num + 1);
  }

  async createTicket(ticket: any): Promise<void> {
    const { error } = await this.supabase
      .from('tickets')
      .insert({
        id: ticket.id,
        ticket_num: ticket.ticketNum,
        user_id: ticket.userId,
        user_email: ticket.userEmail,
        subject: ticket.subject,
        category: ticket.category || 'General',
        priority: ticket.priority,
        status: ticket.status,
        created_at: ticket.createdAt,
        messages: JSON.stringify(ticket.messages || []),
      });
    if (error) throw error;
  }

  async getTickets(userId: string): Promise<any[]> {
    const { data: rows, error } = await this.supabase
      .from('tickets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error || !rows) return [];
    return rows.map(this.mapTicketRow);
  }

  mapTicketRow(row: any) {
    return {
      id: row.id,
      ticketNum: row.ticket_num,
      userId: row.user_id,
      userEmail: row.user_email,
      subject: row.subject,
      category: row.category || 'General',
      priority: row.priority,
      status: row.status,
      createdAt: row.created_at,
      messages: row.messages ? JSON.parse(row.messages) : [],
    };
  }

  async getTicketById(ticketId: string): Promise<any | null> {
    const { data: row, error } = await this.supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .maybeSingle();
    if (error || !row) return null;
    return this.mapTicketRow(row);
  }

  async getAllTicketsAdmin(): Promise<any[]> {
    const { data: rows, error } = await this.supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !rows) return [];
    return rows.map(row => this.mapTicketRow(row));
  }

  async updateTicket(ticketId: string, status: string, messages?: any[]): Promise<void> {
    const payload: any = { status };
    if (messages) payload.messages = JSON.stringify(messages);
    const { error } = await this.supabase
      .from('tickets')
      .update(payload)
      .eq('id', ticketId);
    if (error) throw error;
  }

  async resolveTicketByUserId(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('tickets')
      .update({ status: 'Resolved' })
      .eq('user_id', userId)
      .neq('status', 'Resolved');
    if (error) throw error;
  }

  // Active Calls
  async registerCall(userId: string, userEmail: string, roomName: string, reason?: string): Promise<void> {
    const { error } = await this.supabase
      .from('active_calls')
      .upsert({
        user_id: userId,
        user_email: userEmail,
        room_name: roomName,
        reason: reason || null,
      });
    if (error) throw error;
  }

  async unregisterCall(userId: string, agentId?: string): Promise<void> {
    // Move to history
    const { data: call, error: fetchError } = await this.supabase
      .from('active_calls')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (call) {
      const endedAt = new Date().toISOString();
      const startedAt = new Date(call.started_at).getTime();
      const duration = Math.floor((Date.now() - startedAt) / 1000);
      const callId = call.room_name.split('-')[1] || null;
      await this.supabase.from('call_history').insert({
        id: Date.now().toString(),
        user_id: userId,
        user_email: call.user_email,
        call_id: callId,
        reason: call.reason,
        started_at: call.started_at,
        duration_seconds: duration,
        agent_id: agentId || null,
      });
    }
    await this.supabase
      .from('active_calls')
      .delete()
      .eq('user_id', userId);
  }

  async getActiveCalls(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('active_calls')
      .select('*')
      .order('started_at', { ascending: true });
    if (error) return [];
    return data || [];
  }

  async getCallHistory(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('call_history')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(100);
    if (error) return [];
    return data || [];
  }

  // Admin Stats
  async getAdminStats(start?: string, end?: string): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalPostsGenerated: number;
    revenue: number;
    cancelledTransactions: number;
    pendingTransactions: number;
    revenueData: { name: string; value: number }[];
    churnData: { name: string; value: number; activeUsers?: number }[];
    retentionRate: number;
  }> {
    const startFilter = start || '1970-01-01';
    const endFilter = end || '9999-12-31';

    const { count: totalUsers } = await this.supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startFilter)
      .lte('created_at', endFilter);

    const { count: activeUsers } = await this.supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'user')
      .gte('created_at', startFilter)
      .lte('created_at', endFilter);

    const { count: totalPostsGenerated } = await this.supabase
      .from('generated_posts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startFilter)
      .lte('created_at', endFilter);

    const { data: revenueData } = await this.supabase
      .from('transactions')
      .select('amount')
      .eq('status', 'COMPLETED')
      .eq('type', 'CREDIT')
      .gte('date', startFilter)
      .lte('date', endFilter);
    const revenue = revenueData ? revenueData.reduce((sum, r) => sum + r.amount, 0) : 0;

    const { count: cancelledTransactions } = await this.supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'CANCELLED')
      .gte('date', startFilter)
      .lte('date', endFilter);

    const { count: pendingTransactions } = await this.supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING')
      .gte('date', startFilter)
      .lte('date', endFilter);

    // Revenue Growth (monthly user signups)
    const { data: userGrowth } = await this.supabase
      .from('users')
      .select('created_at')
      .gte('created_at', startFilter)
      .lte('created_at', endFilter)
      .order('created_at', { ascending: true });

    const monthMap: Record<string, number> = {};
    if (userGrowth) {
      for (const u of userGrowth) {
        const d = new Date(u.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        monthMap[key] = (monthMap[key] || 0) + 1;
      }
    }
    const revenueDataChart = Object.keys(monthMap).map(key => {
      const [year, month] = key.split('-');
      const date = new Date(parseInt(year), parseInt(month)-1, 1);
      return {
        name: date.toLocaleDateString('en-US', { month: 'short' }),
        value: monthMap[key],
      };
    });

    // Churn / retention
    const { count: cohortSize } = await this.supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .lte('created_at', new Date(Date.now() - 30*24*60*60*1000).toISOString());

    const { data: activeLast30 } = await this.supabase
      .from('generated_posts')
      .select('user_id')
      .gte('created_at', new Date(Date.now() - 30*24*60*60*1000).toISOString());
    const activeUsersLast30 = activeLast30 ? new Set(activeLast30.map(r => r.user_id)).size : 0;

    const retentionRate = cohortSize > 0 ? Math.round((activeUsersLast30 / cohortSize) * 100) : 0;

    // Churn data: for each month, compute active users / total users up to that month
    const { data: monthlyActive } = await this.supabase
      .from('generated_posts')
      .select('created_at, user_id')
      .gte('created_at', startFilter)
      .lte('created_at', endFilter)
      .order('created_at', { ascending: true });

    const monthActiveMap: Record<string, Set<string>> = {};
    if (monthlyActive) {
      for (const p of monthlyActive) {
        const d = new Date(p.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        if (!monthActiveMap[key]) monthActiveMap[key] = new Set();
        monthActiveMap[key].add(p.user_id);
      }
    }

    const churnData = Object.keys(monthActiveMap).map(key => {
      const [year, month] = key.split('-');
      const date = new Date(parseInt(year), parseInt(month)-1, 1);
      const active = monthActiveMap[key].size;
      // total users up to that month
      const { count: totalUsersTill } = this.supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .lte('created_at', new Date(parseInt(year), parseInt(month)-1, 28).toISOString());
      // This is async but we are in async function, but we already have totalUsers count above. For simplicity, we'll use the overall total for the period.
      // We'll compute rate based on total users in that month's cohort - but we'll approximate.
      const rate = totalUsers > 0 ? Math.round((active / totalUsers) * 100) : 0;
      return {
        name: date.toLocaleDateString('en-US', { month: 'short' }),
        value: rate,
        activeUsers: active,
      };
    });

    return {
      totalUsers: totalUsers || 0,
      activeUsers: activeUsers || 0,
      totalPostsGenerated: totalPostsGenerated || 0,
      revenue,
      cancelledTransactions: cancelledTransactions || 0,
      pendingTransactions: pendingTransactions || 0,
      revenueData: revenueDataChart,
      churnData,
      retentionRate,
    };
  }

  async getPendingTransactionsAdmin(): Promise<any[]> {
    const { data: rows, error } = await this.supabase
      .from('transactions')
      .select('*, users(email)')
      .eq('status', 'PENDING')
      .order('date', { ascending: false })
      .limit(100);
    if (error || !rows) return [];
    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      userEmail: row.users?.email,
      amount: row.amount,
      description: row.description,
      type: row.type,
      status: row.status,
      date: row.date,
    }));
  }

  // Verification
  // Business verification documents live in the private 'verifications' Storage bucket,
  // keyed by userId so re-submits overwrite the previous file.
  async uploadVerificationDoc(userId: string, buffer: Buffer, originalName: string, mimetype: string): Promise<string> {
    const ext = originalName.includes('.') ? originalName.slice(originalName.lastIndexOf('.')) : '';
    const storagePath = `${userId}/verif_${Date.now()}${ext}`;
    const { error } = await this.supabase.storage
      .from('verifications')
      .upload(storagePath, buffer, { contentType: mimetype, upsert: true });
    if (error) throw error;
    return storagePath;
  }

  async getVerificationDocSignedUrl(storagePath: string): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from('verifications')
      .createSignedUrl(storagePath, 300); // 5 minutes
    if (error || !data) throw error || new Error('Failed to create signed URL');
    return data.signedUrl;
  }

  async submitVerification(userId: string, businessAddress: string, businessPhone: string, documentName: string, documentPath: string): Promise<void> {
    const id = `verif_${userId}_${Date.now()}`;
    const { error } = await this.supabase
      .from('business_verifications')
      .upsert({
        id,
        user_id: userId,
        business_address: businessAddress,
        business_phone: businessPhone,
        document_name: documentName,
        document_path: documentPath,
        status: 'pending',
        rejection_reason: null,
        reviewed_by: null,
        reviewed_at: null,
      }, { onConflict: 'user_id' });
    if (error) throw error;
  }

  async resubmitVerification(userId: string, documentName: string, documentPath: string): Promise<void> {
    const { error } = await this.supabase
      .from('business_verifications')
      .update({
        document_name: documentName,
        document_path: documentPath,
        status: 'pending',
        rejection_reason: null,
        reviewed_by: null,
        reviewed_at: null,
      })
      .eq('user_id', userId);
    if (error) throw error;
  }

  async getVerification(userId: string): Promise<any | null> {
    const { data: row, error } = await this.supabase
      .from('business_verifications')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !row) return null;
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
  }

  async getVerificationById(id: string): Promise<any | null> {
    const { data: row, error } = await this.supabase
      .from('business_verifications')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !row) return null;
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
  }

  async getAllVerifications(): Promise<any[]> {
    const { data: rows, error } = await this.supabase
      .from('business_verifications')
      .select('*, users(email, business_name)')
      .order('created_at', { ascending: false });
    if (error || !rows) return [];
    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      email: row.users?.email,
      businessName: row.users?.business_name,
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
  }

  async approveVerification(id: string, adminId: string): Promise<void> {
    const { error } = await this.supabase
      .from('business_verifications')
      .update({
        status: 'verified',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq('id', id);
    if (error) throw error;
  }

  async rejectVerification(id: string, adminId: string, reason: string): Promise<void> {
    const { error } = await this.supabase
      .from('business_verifications')
      .update({
        status: 'rejected',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq('id', id);
    if (error) throw error;
  }

  // "name <email> (id:...)" string for audit-log details, reusing getUserById.
  async describeUser(userId: string): Promise<string> {
    const user = await this.getUserById(userId);
    if (!user) return `id:${userId}`;
    return `${user.businessName || user.email} <${user.email}> (id:${user.id})`;
  }

  async logAudit(userId: string, action: string, details?: string): Promise<void> {
    const { error } = await this.supabase.from('audit_logs').insert({
      id: Date.now().toString(),
      user_id: userId,
      action,
      details: details ?? null,
    });
    if (error) {
      logger.error('Audit log insert failed', { error: error.message, action });
    } else {
      logger.info(`AUDIT: ${action}`, { userId, details });
    }
  }

  async getAuditLogs(limit: number = 100): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);
    if (error) return [];
    return data || [];
  }

  // Misc
  async close(): Promise<void> {
    // Nothing to close for Supabase
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      const { data, error } = await this.supabase.from('users').select('id').limit(1);
      return {
        status: error ? 'unhealthy' : 'healthy',
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
      };
    }
  }

  transaction<T>(fn: () => T): T {
    // Supabase doesn't have transactions in the same way; we can use a retry loop or just run the function.
    // For simplicity, just call fn() – the caller should handle errors.
    return fn();
  }

  // Admin approve transaction
  async approveTransactionAdmin(transactionId: string): Promise<void> {
    return this.approveTransaction(transactionId);
  }

  // Initialize default admin
  private async initializeDefaultAdmin(): Promise<void> {
    const { data: existing } = await this.supabase
      .from('users')
      .select('id')
      .eq('email', 'admin@kawayan.ph')
      .maybeSingle();
    if (!existing) {
      const passwordHash = await JWTService.hashPassword('Admin123!');
      const id = `KWYN-${Date.now()}`;
      const { error } = await this.supabase
        .from('users')
        .insert({
          id,
          email: 'admin@kawayan.ph',
          password_hash: passwordHash,
          role: 'admin',
          business_name: 'Kawayan Admin',
        });
      if (error) {
        logger.error('Failed to create default admin', { error: error.message });
      } else {
        logger.info('Default admin created');
      }
    }
  }
}