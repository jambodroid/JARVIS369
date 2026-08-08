create table if not exists public.webauthn_credentials (
  id text primary key,
  -- base64-encoded, not bytea -- avoids PostgREST's bytea hex-string
  -- encoding entirely and reads/writes as plain text via supabase-js.
  public_key text not null,
  counter bigint not null default 0,
  device_type text not null,
  backed_up boolean not null default false,
  transports text[],
  created_at timestamptz not null default now()
);

alter table public.webauthn_credentials enable row level security;

-- Same deny-all pattern as every other table: no policies, service role bypasses.
-- No user_id column -- single-tenant app, this is just the list of passkeys
-- registered for the one person who uses it.
