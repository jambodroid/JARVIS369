alter table public.recurring_payments
  add column original_amount numeric,
  add column remaining_balance numeric,
  add column total_payable numeric,
  add column paid_so_far numeric,
  add column interest_rate numeric,
  add column term_months_total int,
  add column term_months_remaining int,
  add column balance_as_of date;
