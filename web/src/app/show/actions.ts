"use server";

import { loadMemberDiaryHighlight } from "@/features/profile/memberDiaryHighlight";
import { createClient } from "@/lib/supabase/server";
import { toTVStoredId, toTVSeasonStoredId } from "@/lib/tmdb/constants";

type DiaryEntry = { user_rating: number | null; notes: string | null };

export async function getShowUserState(
  tmdbId: number,
  seasonIds: number[],
  reviewedBy?: string | null,
  libraryMovieId?: string | null,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const showStoredIdForHighlight = toTVStoredId(tmdbId);
  const { data: showMovieRowForHighlight } = await supabase
    .from("movies")
    .select("id")
    .eq("tmdb_id", showStoredIdForHighlight)
    .maybeSingle();

  const memberDiaryHighlight = await loadMemberDiaryHighlight(
    supabase,
    reviewedBy ?? undefined,
    libraryMovieId ?? undefined,
    showMovieRowForHighlight?.id ?? null,
  );
  const showMemberDiaryHighlight =
    memberDiaryHighlight != null && (!user || memberDiaryHighlight.memberId !== user.id);

  let existing: DiaryEntry | null = null;
  let inWatchlist = false;
  const seasonRatings: Record<number, DiaryEntry> = {};

  if (user) {
    const showStoredId = toTVStoredId(tmdbId);
    const seasonStoredIds = seasonIds.map((id) => toTVSeasonStoredId(id));
    const allStoredIds = [showStoredId, ...seasonStoredIds];

    const { data: movieRows } = await supabase
      .from("movies")
      .select("id, tmdb_id")
      .in("tmdb_id", allStoredIds);

    const rowMap = Object.fromEntries(
      (movieRows ?? []).map((r) => [Number(r.tmdb_id), Number(r.id)]),
    );
    const movieIds = Object.values(rowMap);
    const showMovieId = rowMap[showStoredId];

    if (movieIds.length > 0) {
      const [{ data: watchedRows }, { data: watchlistRow }] = await Promise.all([
        supabase
          .from("watched_movies")
          .select("movie_id, user_rating, notes")
          .eq("user_id", user.id)
          .in("movie_id", movieIds),
        showMovieId
          ? supabase
              .from("watchlist")
              .select("id")
              .eq("user_id", user.id)
              .eq("movie_id", showMovieId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      inWatchlist = !!(watchlistRow as { id?: number } | null)?.id;

      for (const row of watchedRows ?? []) {
        const storedId = Object.entries(rowMap).find(([, id]) => id === Number(row.movie_id))?.[0];
        if (!storedId) continue;
        const n = Number(storedId);
        const entry: DiaryEntry = { user_rating: row.user_rating as number | null, notes: row.notes as string | null };
        if (n === showStoredId) {
          existing = entry;
        } else {
          const seasonTmdbId = n - 20_000_000;
          seasonRatings[seasonTmdbId] = entry;
        }
      }
    }
  }

  return {
    isLoggedIn: !!user,
    existing,
    inWatchlist,
    seasonRatings,
    memberDiaryHighlight: showMemberDiaryHighlight ? memberDiaryHighlight : null,
  };
}
