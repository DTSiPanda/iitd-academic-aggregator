-- Run this in the Supabase SQL Editor:
-- Dashboard > SQL Editor > New query > paste > Run

create table if not exists authorized_users (
  telegram_id  bigint      primary key,
  name         text        not null default '',
  added_at     timestamptz not null default now(),
  added_by     bigint      references authorized_users(telegram_id)
);

-- Pre-populate with your two existing authorized users
-- Replace the IDs below with your actual Telegram user IDs
insert into authorized_users (telegram_id, name) values
  (YOUR_OWNER_TELEGRAM_ID,  'Owner'),
  (8727557578,              'Sahil')
on conflict (telegram_id) do nothing;

-- Only the service role (bot) can write; anyone can read (for the auth check)
alter table authorized_users enable row level security;

create policy "Service role has full access"
  on authorized_users for all
  using (true)
  with check (true);
