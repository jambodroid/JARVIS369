alter table public.tasks
  add column category text not null default 'general'
    check (category in ('general', 'trading', 'social', 'health')),
  add column due_time time,
  add column google_event_id text;

alter table public.tasks alter column due_date drop not null;

create table if not exists public.google_auth (
  id int primary key default 1,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint google_auth_singleton check (id = 1)
);

alter table public.google_auth enable row level security;

-- Same deny-all pattern as tasks: no policies, service role bypasses.
