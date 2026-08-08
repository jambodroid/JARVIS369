create table if not exists public.health_metrics (
  metric_date date primary key,
  steps integer,
  sleep_hours numeric,
  workouts jsonb,
  updated_at timestamptz not null default now()
);

alter table public.health_metrics enable row level security;

-- Same deny-all pattern as every other table: no policies, service role bypasses.
-- One row per day, upserted on metric_date -- Health Auto Export re-sends
-- the day's data on every automation trigger, not just new data.
