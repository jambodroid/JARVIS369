create table if not exists public.truelayer_app_auth (
  id int primary key default 1,
  refresh_token text,
  access_token text,
  access_token_expires_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint truelayer_app_auth_singleton check (id = 1)
);

alter table public.truelayer_app_auth enable row level security;

create table if not exists public.net_worth_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null check (kind in ('asset', 'liability')),
  source text not null check (source in ('manual', 'truelayer')),
  external_account_id text,
  balance numeric not null default 0,
  currency text not null default 'GBP',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.net_worth_accounts enable row level security;

create table if not exists public.net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,
  total numeric not null,
  breakdown jsonb,
  created_at timestamptz not null default now()
);

alter table public.net_worth_snapshots enable row level security;

-- Same deny-all pattern as tasks/google_auth: no policies, service role bypasses.

insert into public.net_worth_accounts (name, kind, source, balance)
values ('AMP Trading', 'asset', 'manual', 0)
on conflict (name) do nothing;
