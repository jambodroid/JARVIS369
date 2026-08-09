alter table public.recurring_payments
  add column net_worth_account_id uuid references public.net_worth_accounts(id) on delete set null,
  add column last_deducted_date date;
