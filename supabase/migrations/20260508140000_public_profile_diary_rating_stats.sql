-- Aggregate diary ratings in the database so public profiles stay accurate for
-- heavy raters (PostgREST caps row payloads; avoids fetching every user_rating).

create or replace function public.public_profile_watched_rating_stats(p_user_id uuid)
returns table (avg_rating numeric, rated_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    avg(wm.user_rating)::numeric,
    count(*)::bigint
  from public.watched_movies wm
  where wm.user_id = p_user_id
    and wm.user_rating is not null;
$$;

comment on function public.public_profile_watched_rating_stats(uuid) is
  'Avg rating + rated count for a user diary; RLS on watched_movies restricts to visible rows.';

grant execute on function public.public_profile_watched_rating_stats(uuid) to anon, authenticated;
