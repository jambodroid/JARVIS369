alter table public.recurring_payments add column is_debt boolean not null default false;

update public.recurring_payments
set is_debt = true
where name in ('Lendable', 'MBNA Loans', 'Oodle Car Finance');
