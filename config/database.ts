import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export class DatabaseConfig {
  private db: Database.Database;
  
  constructor(dbPath: string = process.env.DB_PATH || './kawayan.db') {
    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initializeSchema();
  }
  
  private initializeSchema() {
    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'admin', 'support')),
        business_name TEXT,
        theme TEXT DEFAULT 'light',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Brand profiles table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS brand_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        business_name TEXT NOT NULL,
        industry TEXT NOT NULL,
        target_audience TEXT NOT NULL,
        brand_voice TEXT NOT NULL,
        key_themes TEXT NOT NULL,
        brand_colors TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Migration for brand_profiles
    const profileInfo = this.db.prepare("PRAGMA table_info(brand_profiles)").all() as any[];
    if (!profileInfo.some(col => col.name === 'brand_colors')) {
      console.log('Migration: Adding brand_colors to brand_profiles');
      this.db.exec("ALTER TABLE brand_profiles ADD COLUMN brand_colors TEXT");
    }
    if (!profileInfo.some(col => col.name === 'contact_email')) {
      console.log('Migration: Adding contact_email to brand_profiles');
      this.db.exec("ALTER TABLE brand_profiles ADD COLUMN contact_email TEXT");
    }
    if (!profileInfo.some(col => col.name === 'contact_phone')) {
      console.log('Migration: Adding contact_phone to brand_profiles');
      this.db.exec("ALTER TABLE brand_profiles ADD COLUMN contact_phone TEXT");
    }

    
    // Generated posts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS generated_posts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        topic TEXT NOT NULL,
        caption TEXT NOT NULL,
        image_prompt TEXT NOT NULL,
        image_url TEXT,
        status TEXT NOT NULL CHECK (status IN ('Draft', 'Scheduled', 'Published')),
        virality_score INTEGER CHECK (virality_score >= 0 AND virality_score <= 100),
        virality_reason TEXT,
        format TEXT,
        external_link TEXT,
        published_at DATETIME,
        regen_count INTEGER DEFAULT 0,
        history TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Migration: Add columns if they don't exist
    const tableInfo = this.db.prepare("PRAGMA table_info(generated_posts)").all() as any[];
    const hasExternalLink = tableInfo.some(col => col.name === 'external_link');
    const hasPublishedAt = tableInfo.some(col => col.name === 'published_at');
    const hasRegenCount = tableInfo.some(col => col.name === 'regen_count');
    const hasHistory = tableInfo.some(col => col.name === 'history');

    if (!hasExternalLink) this.db.exec("ALTER TABLE generated_posts ADD COLUMN external_link TEXT");
    if (!hasPublishedAt) this.db.exec("ALTER TABLE generated_posts ADD COLUMN published_at DATETIME");
    if (!hasRegenCount) this.db.exec("ALTER TABLE generated_posts ADD COLUMN regen_count INTEGER DEFAULT 0");
    if (!hasHistory) this.db.exec("ALTER TABLE generated_posts ADD COLUMN history TEXT");
    
    // Sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Content Plans table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS content_plans (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        month TEXT NOT NULL,
        ideas TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Wallets table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS wallets (
        user_id TEXT PRIMARY KEY,
        balance REAL DEFAULT 0.0,
        currency TEXT DEFAULT 'PHP',
        subscription TEXT DEFAULT 'FREE' CHECK (subscription IN ('FREE', 'PRO', 'ENTERPRISE')),
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Transactions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
        type TEXT NOT NULL CHECK (type IN ('CREDIT', 'DEBIT')),
        FOREIGN KEY (user_id) REFERENCES wallets(user_id) ON DELETE CASCADE
      )
    `);
    
    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_brand_profiles_user_id ON brand_profiles(user_id);
      CREATE INDEX IF NOT EXISTS idx_generated_posts_user_id ON generated_posts(user_id);
      CREATE INDEX IF NOT EXISTS idx_generated_posts_date ON generated_posts(date);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_content_plans_user_month ON content_plans(user_id, month);
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
    `);
    
    // Create triggers for updated_at timestamps
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
        AFTER UPDATE ON users
        BEGIN
          UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
        
      CREATE TRIGGER IF NOT EXISTS update_brand_profiles_timestamp 
        AFTER UPDATE ON brand_profiles
        BEGIN
          UPDATE brand_profiles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
        
      CREATE TRIGGER IF NOT EXISTS update_generated_posts_timestamp 
        AFTER UPDATE ON generated_posts
        BEGIN
          UPDATE generated_posts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;

      CREATE TRIGGER IF NOT EXISTS update_wallets_timestamp 
        AFTER UPDATE ON wallets
        BEGIN
          UPDATE wallets SET updated_at = CURRENT_TIMESTAMP WHERE user_id = NEW.user_id;
        END;
    `);
  }
  
  getDatabase(): Database.Database {
    return this.db;
  }
  
  close() {
    this.db.close();
  }
  
  // Transaction helper
  transaction<T>(fn: () => T): T {
    const transaction = this.db.transaction(fn);
    return transaction();
  }
}