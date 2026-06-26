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

    // Migration for users
    const userInfo = this.db.prepare("PRAGMA table_info(users)").all() as any[];
    if (!userInfo.some(col => col.name === 'theme')) {
      console.log('Migration: Adding theme to users');
      this.db.exec("ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'light'");
    }
    
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
        status TEXT NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED')),
        type TEXT NOT NULL CHECK (type IN ('CREDIT', 'DEBIT')),
        FOREIGN KEY (user_id) REFERENCES wallets(user_id) ON DELETE CASCADE
      )
    `);

    // Migration for transactions status
    const txnTableInfo = this.db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='transactions'").get() as { sql: string };
    if (txnTableInfo && !txnTableInfo.sql.includes('CANCELLED')) {
      console.log('Migration: Updating transactions status constraint to include CANCELLED');
      this.db.transaction(() => {
        // 1. Rename old table
        this.db.exec("ALTER TABLE transactions RENAME TO transactions_old");
        // 2. Create new table with correct constraint
        this.db.exec(`
          CREATE TABLE transactions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED')),
            type TEXT NOT NULL CHECK (type IN ('CREDIT', 'DEBIT')),
            FOREIGN KEY (user_id) REFERENCES wallets(user_id) ON DELETE CASCADE
          )
        `);
        // 3. Copy data
        this.db.exec("INSERT INTO transactions SELECT * FROM transactions_old");
        // 4. Drop old table
        this.db.exec("DROP TABLE transactions_old");
        // 5. Recreate index
        this.db.exec("CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)");
      })();
    }

    // Tickets table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        ticket_num INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        priority TEXT NOT NULL CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
        status TEXT NOT NULL CHECK (status IN ('Open', 'Pending', 'Resolved')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        messages TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Active Calls table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS active_calls (
        user_id TEXT PRIMARY KEY,
        user_email TEXT NOT NULL,
        room_name TEXT NOT NULL,
        reason TEXT,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Migration for active_calls reason
    const callTableInfo = this.db.prepare("PRAGMA table_info(active_calls)").all() as any[];
    if (!callTableInfo.some(col => col.name === 'reason')) {
      console.log('Migration: Adding reason column to active_calls');
      this.db.exec("ALTER TABLE active_calls ADD COLUMN reason TEXT");
    }

    // Migration for tickets category
    const ticketTableInfo = this.db.prepare("PRAGMA table_info(tickets)").all() as any[];
    if (!ticketTableInfo.some(col => col.name === 'category')) {
      console.log('Migration: Adding category column to tickets');
      this.db.exec("ALTER TABLE tickets ADD COLUMN category TEXT NOT NULL DEFAULT 'General'");
    }

    // Call History table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS call_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        call_id TEXT,
        reason TEXT,
        started_at DATETIME NOT NULL,
        ended_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        duration_seconds INTEGER,
        agent_id TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Migration for call_history call_id
    const historyTableInfo = this.db.prepare("PRAGMA table_info(call_history)").all() as any[];
    if (!historyTableInfo.some(col => col.name === 'call_id')) {
      this.db.exec("ALTER TABLE call_history ADD COLUMN call_id TEXT");
    }

    // Social Connections table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS social_connections (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'tiktok')),
        connected INTEGER DEFAULT 0,
        username TEXT,
        access_token TEXT,
        followers INTEGER DEFAULT 0,
        engagement REAL DEFAULT 0.0,
        data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, platform)
      )
    `);

    // Business Verifications table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS business_verifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        business_address TEXT NOT NULL,
        business_phone TEXT NOT NULL,
        document_name TEXT NOT NULL,
        document_path TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
        rejection_reason TEXT,
        reviewed_by TEXT,
        reviewed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Audit Logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
      CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
      CREATE INDEX IF NOT EXISTS idx_social_connections_user_id ON social_connections(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_business_verifications_user_id ON business_verifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_business_verifications_status ON business_verifications(status);
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

      CREATE TRIGGER IF NOT EXISTS update_tickets_timestamp 
        AFTER UPDATE ON tickets
        BEGIN
          UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;

      CREATE TRIGGER IF NOT EXISTS update_social_connections_timestamp 
        AFTER UPDATE ON social_connections
        BEGIN
          UPDATE social_connections SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;

      CREATE TRIGGER IF NOT EXISTS update_business_verifications_timestamp
        AFTER UPDATE ON business_verifications
        BEGIN
          UPDATE business_verifications SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
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