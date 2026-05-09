-- Custom diary / favourite poster overrides + reliable TV season → show links

alter table public.watched_movies
  add column if not exists custom_poster_url text;

alter table public.favourite_movies
  add column if not exists custom_poster_url text;

alter table public.movies
  add column if not exists parent_show_tmdb_id int;

comment on column public.watched_movies.custom_poster_url is
  'Optional user-uploaded poster (HTTPS / Storage URL); overrides TMDB poster in UI.';
comment on column public.favourite_movies.custom_poster_url is
  'Optional user-uploaded poster for this favourite slot.';
comment on column public.movies.parent_show_tmdb_id is
  'For TV season cache rows (tmdb_id >= 20M), parent series TMDB id for /show/[id] links.';

-- Season rows historically stored parent show id in vote_count; copy to dedicated column.
update public.movies
set parent_show_tmdb_id = vote_count
where tmdb_id >= 20000000
  and vote_count is not null
  and (parent_show_tmdb_id is null);
