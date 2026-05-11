-- Track when the user last opened the social inbox so notification badge = new followers only.
alter table public.profiles
  add column if not exists social_inbox_last_read_at timestamptz;

comment on column public.profiles.social_inbox_last_read_at is
  'Last time the user viewed social notifications; follows with created_at after this count as unread for the header badge.';
