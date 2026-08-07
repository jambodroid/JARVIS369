create table if not exists public.trading_journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null unique,
  traded boolean not null,
  summary text,
  pnl numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trading_journal_entries enable row level security;

-- Same deny-all pattern as every other table: no policies, service role bypasses.
