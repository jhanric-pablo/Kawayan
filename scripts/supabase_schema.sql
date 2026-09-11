-- Kawayan: Postgres schema for Supabase, translated from config/database.ts (sqlite).
-- Run once in the Supabase SQL editor (Project -> SQL Editor -> New query -> paste -> Run).
-- Safe to re-run: every statement is IF NOT EXISTS / OR REPLACE.

-- ── users ───────────────────────────────────────────────────────────
create table if not exists users (
  id text primary key,
  email text unique not null,
  password_hash text not null,
  role text not null check (role in ('user', 'admin', 'support')),
  business_name text,
  theme text default 'light',
  terms_accepted_at timestamptz,
  terms_version text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_users_email on users(email);

-- ── brand_profiles ──────────────────────────────────────────────────
create table if not exists brand_profiles (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  business_name text not null,
  industry text not null,
  target_audience text not null,
  brand_voice text not null,
  key_themes text not null,
  brand_colors text,
  contact_email text,
  contact_phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_brand_profiles_user_id on brand_profiles(user_id);

-- ── generated_posts ─────────────────────────────────────────────────
create table if not exists generated_posts (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  date text not null,
  topic text not null,
  caption text not null,
  image_prompt text not null,
  image_url text,
  status text not null check (status in ('Draft', 'Scheduled', 'Published')),
  virality_score integer check (virality_score >= 0 and virality_score <= 100),
  virality_reason text,
  format text,
  external_link text,
  published_at timestamptz,
  regen_count integer default 0,
  history text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_generated_posts_user_id on generated_posts(user_id);
create index if not exists idx_generated_posts_date on generated_posts(date);

-- ── sessions ────────────────────────────────────────────────────────
create table if not exists sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);
create index if not exists idx_sessions_user_id on sessions(user_id);
create index if not exists idx_sessions_token on sessions(token);
create index if not exists idx_sessions_expires_at on sessions(expires_at);

-- ── content_plans ───────────────────────────────────────────────────
create table if not exists content_plans (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  month text not null,
  ideas text not null,
  updated_at timestamptz default now()
);
create index if not exists idx_content_plans_user_month on content_plans(user_id, month);

-- ── wallets ─────────────────────────────────────────────────────────
create table if not exists wallets (
  user_id text primary key references users(id) on delete cascade,
  balance double precision default 0.0,
  currency text default 'PHP',
  subscription text default 'FREE' check (subscription in ('FREE', 'PRO', 'ENTERPRISE')),
  updated_at timestamptz default now()
);

-- ── transactions ────────────────────────────────────────────────────
create table if not exists transactions (
  id text primary key,
  user_id text not null references wallets(user_id) on delete cascade,
  date timestamptz default now(),
  description text not null,
  amount double precision not null,
  status text not null check (status in ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  type text not null check (type in ('CREDIT', 'DEBIT'))
);
create index if not exists idx_transactions_user_id on transactions(user_id);

-- ── tickets ─────────────────────────────────────────────────────────
create table if not exists tickets (
  id text primary key,
  ticket_num integer not null,
  user_id text not null references users(id) on delete cascade,
  user_email text not null,
  subject text not null,
  priority text not null check (priority in ('Low', 'Medium', 'High', 'Critical')),
  status text not null check (status in ('Open', 'Pending', 'Resolved')),
  category text not null default 'General',
  messages text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_tickets_user_id on tickets(user_id);

-- ── active_calls ────────────────────────────────────────────────────
create table if not exists active_calls (
  user_id text primary key references users(id) on delete cascade,
  user_email text not null,
  room_name text not null,
  reason text,
  started_at timestamptz default now()
);

-- ── call_history ────────────────────────────────────────────────────
create table if not exists call_history (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  user_email text not null,
  call_id text,
  reason text,
  started_at timestamptz not null,
  ended_at timestamptz default now(),
  duration_seconds integer,
  agent_id text
);

-- ── social_connections ──────────────────────────────────────────────
create table if not exists social_connections (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  platform text not null check (platform in ('facebook', 'instagram', 'tiktok')),
  connected boolean default false,
  username text,
  access_token text,
  followers integer default 0,
  engagement double precision default 0.0,
  data text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, platform)
);
create index if not exists idx_social_connections_user_id on social_connections(user_id);

-- ── business_verifications ──────────────────────────────────────────
create table if not exists business_verifications (
  id text primary key,
  user_id text not null unique references users(id) on delete cascade,
  business_address text not null,
  business_phone text not null,
  document_name text not null,
  document_path text not null,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  rejection_reason text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_business_verifications_user_id on business_verifications(user_id);
create index if not exists idx_business_verifications_status on business_verifications(status);

-- ── audit_logs ──────────────────────────────────────────────────────
create table if not exists audit_logs (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  action text not null,
  details text,
  timestamp timestamptz default now()
);
create index if not exists idx_audit_logs_user_id on audit_logs(user_id);
create index if not exists idx_audit_logs_timestamp on audit_logs(timestamp);

-- ── password_resets (from scripts/password_resets.sql) ─────────────
create table if not exists password_resets (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_password_resets_user on password_resets(user_id);

-- ── updated_at triggers (Postgres has no "AFTER UPDATE ... SET" shorthand,
--    so one trigger function + one trigger per table) ─────────────────
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at before update on users
  for each row execute function set_updated_at();

drop trigger if exists trg_brand_profiles_updated_at on brand_profiles;
create trigger trg_brand_profiles_updated_at before update on brand_profiles
  for each row execute function set_updated_at();

drop trigger if exists trg_generated_posts_updated_at on generated_posts;
create trigger trg_generated_posts_updated_at before update on generated_posts
  for each row execute function set_updated_at();

drop trigger if exists trg_wallets_updated_at on wallets;
create trigger trg_wallets_updated_at before update on wallets
  for each row execute function set_updated_at();

drop trigger if exists trg_tickets_updated_at on tickets;
create trigger trg_tickets_updated_at before update on tickets
  for each row execute function set_updated_at();

drop trigger if exists trg_social_connections_updated_at on social_connections;
create trigger trg_social_connections_updated_at before update on social_connections
  for each row execute function set_updated_at();

drop trigger if exists trg_business_verifications_updated_at on business_verifications;
create trigger trg_business_verifications_updated_at before update on business_verifications
  for each row execute function set_updated_at();

-- ── atomic wallet balance update (used by supabaseService.approveTransaction;
--    falls back to a non-atomic read/update if this RPC is missing) ─────────
create or replace function update_wallet_balance(p_user_id text, p_amount double precision)
returns void as $$
begin
  update wallets set balance = balance + p_amount where user_id = p_user_id;
end;
$$ language plpgsql;
