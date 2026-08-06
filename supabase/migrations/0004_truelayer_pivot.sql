-- 0003_networth.sql was originally run back when this table/constraint used
-- GoCardless's naming (GoCardless has since closed new signups; we pivoted
-- to TrueLayer). This migration brings an already-applied 0003 up to date.

alter table public.net_worth_accounts drop constraint if exists net_worth_accounts_source_check;
alter table public.net_worth_accounts add constraint net_worth_accounts_source_check
  check (source in ('manual', 'truelayer'));

create table if not exists public.truelayer_app_auth (
  id int primary key default 1,
  refresh_token text,
  access_token text,
  access_token_expires_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint truelayer_app_auth_singleton check (id = 1)
);

alter table public.truelayer_app_auth enable row level security;

drop table if exists public.gocardless_app_auth;
