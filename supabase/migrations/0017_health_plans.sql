create table if not exists public.health_plans (
  kind text primary key check (kind in ('gym', 'diet')),
  content text not null,
  updated_at timestamptz not null default now()
);

alter table public.health_plans enable row level security;
