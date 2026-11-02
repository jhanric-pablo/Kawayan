-- Support inbox: assignment, snooze, reply targets, ratings, private notes and saved replies.
-- Run once in Supabase → SQL Editor. Safe to run again (every change is "if not exists").

-- Tickets: who has it, labels, snooze, timing for reply targets and reports, and the owner's rating.
alter table tickets add column if not exists assignee_id text references users(id) on delete set null;
alter table tickets add column if not exists assignee_name text;
alter table tickets add column if not exists labels text[] not null default '{}';
alter table tickets add column if not exists snoozed_until timestamptz;
alter table tickets add column if not exists first_response_at timestamptz;
alter table tickets add column if not exists resolved_at timestamptz;
alter table tickets add column if not exists rating smallint check (rating between 1 and 5);
create index if not exists idx_tickets_assignee on tickets(assignee_id);

-- Notes only staff see, plus the ticket's history ("Marco assigned it to themselves").
create table if not exists ticket_notes (
  id text primary key default gen_random_uuid()::text,
  ticket_id text not null references tickets(id) on delete cascade,
  author_id text references users(id) on delete set null,
  author_name text not null,
  kind text not null default 'note' check (kind in ('note', 'activity')),
  body text not null,
  created_at timestamptz default now()
);
create index if not exists idx_ticket_notes_ticket on ticket_notes(ticket_id, created_at);

-- Saved replies agents insert by typing "/shortcut".
create table if not exists canned_replies (
  id text primary key default gen_random_uuid()::text,
  shortcut text not null unique check (shortcut ~ '^[a-z0-9-]{2,30}$'),
  title text not null,
  body text not null,
  created_by text references users(id) on delete set null,
  created_at timestamptz default now()
);

-- Only our server (service role key, which bypasses RLS) reads these. RLS with no policies
-- blocks the public anon key from them.
alter table ticket_notes enable row level security;
alter table canned_replies enable row level security;

-- A few to start with; edit or delete them from the Support dashboard.
insert into canned_replies (shortcut, title, body) values
  ('reconnect', 'Reconnect your Facebook Page', 'Your Facebook connection has expired, so posts can''t go out yet. Go to Social → Facebook → Reconnect and sign in again. Your scheduled posts will publish as normal after that.'),
  ('pro', 'What Pro includes', 'Pro gives you 16 posts a month instead of 8, for ₱499 a month. You can upgrade from Billing → Upgrade to Pro, and pay with GCash, Maya or card.'),
  ('topup', 'Wallet top-ups', 'You can top up your wallet from Billing → Add funds with GCash, Maya or a card through PayMongo. Funds show up as soon as the payment is confirmed.'),
  ('thanks', 'Closing message', 'Glad that''s sorted! I''ll mark this as resolved. If anything else comes up, just message us here.')
on conflict (shortcut) do nothing;
