create table if not exists public.self_entries (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null check (entry_type in ('journal', 'goal', 'habit', 'idea')),
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.self_entries enable row level security;

-- Same deny-all pattern as every other table: no policies, service role bypasses.
