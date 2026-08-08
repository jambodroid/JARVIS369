create table if not exists public.health_entries (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null check (entry_type in ('meal', 'training', 'sleep')),
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.health_entries enable row level security;

-- Same deny-all pattern as every other table: no policies, service role bypasses.
