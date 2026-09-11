-- Password reset tokens. Run once in the Supabase SQL editor.
create table if not exists password_resets (
  id         text primary key,
  user_id    text not null references users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_password_resets_user on password_resets(user_id);
