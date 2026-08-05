create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  due_date date not null,
  priority text not null default 'med' check (priority in ('low', 'med', 'high')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

-- No policies are defined, so RLS denies all access to the anon/authenticated
-- roles by default. The app talks to this table only via the service role
-- key (server-side API routes), which bypasses RLS entirely.
