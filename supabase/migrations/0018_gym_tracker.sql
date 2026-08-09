create table if not exists public.gym_sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null unique,
  day_label text not null,
  attended boolean not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_exercise_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.gym_sessions(id) on delete cascade,
  exercise_name text not null,
  sets int,
  reps int,
  weight_kg numeric,
  created_at timestamptz not null default now()
);

create index if not exists gym_exercise_logs_session_id_idx on public.gym_exercise_logs(session_id);
create index if not exists gym_exercise_logs_exercise_name_idx on public.gym_exercise_logs(exercise_name);

alter table public.gym_sessions enable row level security;
alter table public.gym_exercise_logs enable row level security;
