alter table public.tasks
  add column source_content_item_id uuid references public.social_content_items(id) on delete set null,
  add column content_stage text check (content_stage in ('edit', 'schedule', 'post'));
