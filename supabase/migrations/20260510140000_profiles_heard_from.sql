-- How the user first heard about the app (optional onboarding question).
alter table public.profiles
  add column if not exists heard_from text
    check (
      heard_from is null
      or heard_from in ('friend', 'social', 'search', 'other')
    );

comment on column public.profiles.heard_from is
  'First-run onboarding: how the user heard about the app (friend, social, search, other).';
