"use server";

import { createClient } from "@/lib/supabase/server";
import { browseCanonicalTmdbId } from "@/lib/tmdb/constants";

export async function getBrowseUserLibrary(): Promise<{
  isLoggedIn: boolean;
  watchedIds: number[];
  watchlistIds: number[];
  showMatureContent: boolean;
  is18Plus: boolean;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { isLoggedIn: false, watchedIds: [], watchlistIds: [], showMatureContent: false, is18Plus: false };

    const [{ data: watched }, { data: watchlist }, { data: profile }] = await Promise.all([
      supabase.from("watched_movies").select("movies ( tmdb_id )").eq("user_id", user.id).limit(2000),
      supabase.from("watchlist").select("movies ( tmdb_id )").eq("user_id", user.id).limit(2000),
      supabase.from("profiles").select("show_mature_content, is_18_plus").eq("id", user.id).maybeSingle(),
    ]);

    const watchedIds = (watched ?? []).flatMap((r) => {
      const m = r.movies as { tmdb_id: number } | { tmdb_id: number }[] | null;
      if (!m) return [];
      const ids = Array.isArray(m) ? m.map((x) => x.tmdb_id) : [m.tmdb_id];
      return ids.map((dbId) => browseCanonicalTmdbId(dbId)).filter((id): id is number => id != null);
    });

    const watchlistIds = (watchlist ?? []).flatMap((r) => {
      const m = r.movies as { tmdb_id: number } | { tmdb_id: number }[] | null;
      if (!m) return [];
      const ids = Array.isArray(m) ? m.map((x) => x.tmdb_id) : [m.tmdb_id];
      return ids.map((dbId) => browseCanonicalTmdbId(dbId)).filter((id): id is number => id != null);
    });

    return {
      isLoggedIn: true,
      watchedIds,
      watchlistIds,
      showMatureContent: (profile?.show_mature_content as boolean) ?? false,
      is18Plus: (profile?.is_18_plus as boolean) ?? false,
    };
  } catch {
    return { isLoggedIn: false, watchedIds: [], watchlistIds: [], showMatureContent: false, is18Plus: false };
  }
}

export async function toggleBrowseMatureContent(enable: boolean): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("profiles").update({ show_mature_content: enable }).eq("id", user.id);
}
