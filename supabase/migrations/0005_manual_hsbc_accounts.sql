-- Real Open Banking access to HSBC turned out to require a paid, sales-led
-- contract with every provider checked (TrueLayer, Enable Banking, Plaid,
-- Salt Edge) -- disproportionate for a personal dashboard. Falling back to
-- manual entry, same pattern as AMP Trading. If a real sync path opens up
-- later, these rows just get upserted onto by name (source flips to the
-- provider) -- no rework needed.

insert into public.net_worth_accounts (name, kind, source, balance)
values
  ('HSBC Current Account', 'asset', 'manual', 0),
  ('HSBC Credit Card', 'liability', 'manual', 0)
on conflict (name) do nothing;

-- These two rows may already exist from earlier TrueLayer sandbox testing --
-- flip them to manual (keeping their current balance) so they're editable.
update public.net_worth_accounts
set source = 'manual', external_account_id = null
where name in ('HSBC Current Account', 'HSBC Credit Card') and source = 'truelayer';
