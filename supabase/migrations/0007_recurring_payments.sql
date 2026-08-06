create table if not exists public.recurring_payments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  amount numeric not null,
  day_of_month int not null check (day_of_month between 1 and 31),
  account text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recurring_payments enable row level security;

-- Same deny-all pattern as every other table: no policies, service role bypasses.

-- Seeded from the real HSBC current account + credit card statements
-- uploaded this session (Jan-Jul 2026). Day-of-month uses the most common
-- collection day observed; actual dates shift a few days around weekends
-- and bank holidays. Variable-amount items (e.g. E.ON Next energy) are
-- deliberately left out -- add manually if you want them tracked.
insert into public.recurring_payments (name, amount, day_of_month, account) values
  ('Lendable', 144.25, 9, 'HSBC Current Account'),
  ('MBNA Loans', 172.10, 29, 'HSBC Current Account'),
  ('Oodle Car Finance', 215.26, 3, 'HSBC Current Account'),
  ('First Central Insurance', 91.21, 12, 'HSBC Current Account'),
  ('DVLA Car Tax', 17.06, 1, 'HSBC Current Account'),
  ('JD Gyms', 29.99, 29, 'HSBC Current Account'),
  ('Virgin Media', 27.99, 22, 'HSBC Current Account'),
  ('NWL & ESW Water', 19.27, 15, 'HSBC Current Account'),
  ('TradingView (Standing Order)', 21.70, 25, 'HSBC Current Account'),
  ('Rent - Parkinson Property', 500.00, 1, 'HSBC Current Account'),
  ('Sky Mobile', 42.00, 29, 'HSBC Current Account'),
  ('Google One', 2.49, 8, 'HSBC Credit Card'),
  ('Amazon Prime', 8.99, 9, 'HSBC Credit Card'),
  ('Spotify', 12.99, 26, 'HSBC Credit Card'),
  ('TradingView', 8.40, 28, 'HSBC Credit Card'),
  ('Linktree', 8.00, 26, 'HSBC Credit Card'),
  ('YouTube Premium', 12.99, 24, 'HSBC Credit Card')
on conflict (name) do nothing;
