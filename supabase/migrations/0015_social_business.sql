create table if not exists public.social_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.social_content_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.social_clients(id) on delete set null,
  title text not null,
  status text not null default 'idea' check (status in ('idea', 'scripted', 'filmed', 'edited', 'posted')),
  platform text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.social_clients enable row level security;
alter table public.social_content_items enable row level security;

-- Same deny-all pattern as every other table: no policies, service role bypasses.
