-- Ensure user-linked rows are removed when auth.users / profiles are deleted (admin delete account).

-- Analytics: delete events for this user instead of leaving orphaned rows with user_id = NULL.
alter table public.analytics_events
  drop constraint if exists analytics_events_user_id_fkey;

alter table public.analytics_events
  add constraint analytics_events_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

-- Recommendation sessions: remove sessions tied to the deleted profile.
alter table public.recommendation_sessions
  drop constraint if exists recommendation_sessions_user_id_fkey;

alter table public.recommendation_sessions
  add constraint recommendation_sessions_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;
