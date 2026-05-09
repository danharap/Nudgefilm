-- Allow visitors to read library rows for users whose profile is public,
-- so /user/[username] shows correct films/watchlist for non-admin viewers.
-- Also scope profile reads: anon = public profiles only; authenticated = any profile (search + private shell).

drop policy if exists "profiles_select_anon_public" on public.profiles;
create policy "profiles_select_anon_public"
  on public.profiles for select
  to anon
  using (is_public = true);

drop policy if exists "profiles_select_authenticated_all" on public.profiles;
create policy "profiles_select_authenticated_all"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "watched_select_public_profile" on public.watched_movies;
create policy "watched_select_public_profile"
  on public.watched_movies for select
  using (
    exists (
      select 1 from public.profiles pr
      where pr.id = watched_movies.user_id
        and pr.is_public = true
    )
  );

drop policy if exists "watchlist_select_public_owner" on public.watchlist;
create policy "watchlist_select_public_owner"
  on public.watchlist for select
  using (
    exists (
      select 1 from public.profiles pr
      where pr.id = watchlist.user_id
        and pr.is_public = true
        and pr.watchlist_public = true
    )
  );

drop policy if exists "favourite_select_public_profile" on public.favourite_movies;
create policy "favourite_select_public_profile"
  on public.favourite_movies for select
  using (
    exists (
      select 1 from public.profiles pr
      where pr.id = favourite_movies.user_id
        and pr.is_public = true
    )
  );
