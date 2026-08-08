alter table public.social_content_items
  drop constraint social_content_items_status_check;

alter table public.social_content_items
  add constraint social_content_items_status_check
  check (status in ('idea', 'scripted', 'filmed', 'edited', 'scheduled', 'posted'));

alter table public.social_content_items
  add column due_date date,
  add column google_event_id text;
