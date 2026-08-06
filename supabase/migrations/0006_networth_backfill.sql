-- One-time backfill of Net Worth history from uploaded HSBC current account,
-- HSBC credit card, and AMP Trading statements (Jan-Aug 2026).
-- HSBC figures are exact statement closing balances. AMP Trading figures are
-- Net Liquidating Value (USD) converted to GBP using each statement's own
-- spot rate (an approximation, not live FX). Between statement dates, each
-- account's balance is carried forward to the next known value so the
-- running Total reflects best-available knowledge at each date.

insert into public.net_worth_snapshots (snapshot_date, total, breakdown) values
('2026-01-08', 1147.77, '{"HSBC Current Account": 1147.77}'),
('2026-01-28', 574.41, '{"HSBC Current Account": 1147.77, "HSBC Credit Card": 573.36}'),
('2026-02-08', -192.40, '{"HSBC Current Account": 380.96, "HSBC Credit Card": 573.36}'),
('2026-02-28', -323.30, '{"HSBC Current Account": 380.96, "HSBC Credit Card": 704.26}'),
('2026-03-08', 119.10, '{"HSBC Current Account": 823.36, "HSBC Credit Card": 704.26}'),
('2026-03-29', 380.56, '{"HSBC Current Account": 823.36, "HSBC Credit Card": 442.80}'),
('2026-04-08', 185.06, '{"HSBC Current Account": 627.86, "HSBC Credit Card": 442.80}'),
('2026-04-28', 551.14, '{"HSBC Current Account": 627.86, "HSBC Credit Card": 76.72}'),
('2026-05-08', 629.42, '{"HSBC Current Account": 706.14, "HSBC Credit Card": 76.72}'),
('2026-05-28', 139.12, '{"HSBC Current Account": 706.14, "HSBC Credit Card": 567.02}'),
('2026-05-29', 934.01, '{"HSBC Current Account": 706.14, "HSBC Credit Card": 567.02, "AMP Trading": 794.89}'),
('2026-06-08', 1135.22, '{"HSBC Current Account": 907.35, "HSBC Credit Card": 567.02, "AMP Trading": 794.89}'),
('2026-06-28', 1107.59, '{"HSBC Current Account": 907.35, "HSBC Credit Card": 594.65, "AMP Trading": 794.89}'),
('2026-06-30', 2680.33, '{"HSBC Current Account": 907.35, "HSBC Credit Card": 594.65, "AMP Trading": 2367.63}'),
('2026-07-08', 2885.53, '{"HSBC Current Account": 1112.55, "HSBC Credit Card": 594.65, "AMP Trading": 2367.63}'),
('2026-07-28', 3297.55, '{"HSBC Current Account": 1112.55, "HSBC Credit Card": 182.63, "AMP Trading": 2367.63}'),
('2026-07-31', 2867.45, '{"HSBC Current Account": 1112.55, "HSBC Credit Card": 182.63, "AMP Trading": 1937.53}'),
('2026-08-03', 2865.67, '{"HSBC Current Account": 1112.55, "HSBC Credit Card": 182.63, "AMP Trading": 1935.75}'),
('2026-08-06', 2762.14, '{"HSBC Current Account": 1257.29, "HSBC Credit Card": 430.90, "AMP Trading": 1935.75}')
on conflict (snapshot_date) do update set total = excluded.total, breakdown = excluded.breakdown;

update public.net_worth_accounts set balance = 1257.29, updated_at = now() where name = 'HSBC Current Account';
update public.net_worth_accounts set balance = 430.90, updated_at = now() where name = 'HSBC Credit Card';
update public.net_worth_accounts set balance = 1935.75, updated_at = now() where name = 'AMP Trading';
