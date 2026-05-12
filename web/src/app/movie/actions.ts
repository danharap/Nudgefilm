"use server";

import { addToWatchlist, markWatched } from "@/app/actions/library";
import { loadMemberDiaryHighlight } from "@/features/profile/memberDiaryHighlight";
import { createClient } from "@/lib/supabase/server";

export async function markSeenFromForm(formData: FormData) {
  const tmdbId = Number(formData.get("tmdbId"));
  if (!Number.isFinite(tmdbId)) return;
  await markWatched(tmdbId);
}

export async function queueFilmFromForm(formData: FormData) {
  const tmdbId = Number(formData.get("tmdbId"));
  if (!Number.isFinite(tmdbId)) return;
  await addToWatchlist(tmdbId);
}

type FriendRating = { name: string; username: string | null; avatar_url: string | null; rating: number };
type Review = { name: string; username: string | null; avatar_url: string | null; rating: number | null; notes: string };

export async function getMovieUserState(
  tmdbId: number,
  reviewedBy?: string | null,
  libraryMovieId?: string | null,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: movieRow } = await supabase
    .from("movies")
    .select("id")
    .eq("tmdb_id", tmdbId)
    .maybeSingle();

  const memberDiaryHighlight = await loadMemberDiaryHighlight(
    supabase,
    reviewedBy ?? undefined,
    libraryMovieId ?? undefined,
    movieRow?.id ?? null,
  );
  const showMemberDiaryHighlight =
    memberDiaryHighlight != null && (!user || memberDiaryHighlight.memberId !== user.id);

  let existing: { user_rating: number | null; notes: string | null } | null = null;
  let inWatchlist = false;
  let friendRatings: FriendRating[] = [];
  let recentReviews: Review[] = [];

  if (movieRow?.id) {
    const { data: publicRows } = await supabase
      .from("watched_movies")
      .select("user_rating, notes, profiles!watched_movies_user_id_fkey(display_name, username, avatar_url)")
      .eq("movie_id", movieRow.id)
      .not("notes", "is", null)
      .order("watched_at", { ascending: false })
      .limit(8);

    recentReviews = (publicRows ?? []).flatMap((r) => {
      const notes = String(r.notes ?? "").trim();
      if (!notes) return [];
      const p = r.profiles as unknown as { display_name: string | null; username: string | null; avatar_url: string | null } | null;
      return [{
        name: p?.display_name?.trim() || p?.username || "Film fan",
        username: p?.username ?? null,
        avatar_url: p?.avatar_url ?? null,
        rating: (r.user_rating as number | null) ?? null,
        notes,
      }];
    });
  }

  if (user && movieRow?.id) {
    const [{ data: entry }, { data: watchlistRow }, { data: friendRows }] = await Promise.all([
      supabase
        .from("watched_movies")
        .select("user_rating, notes")
        .eq("user_id", user.id)
        .eq("movie_id", movieRow.id)
        .maybeSingle(),
      supabase
        .from("watchlist")
        .select("id")
        .eq("user_id", user.id)
        .eq("movie_id", movieRow.id)
        .maybeSingle(),
      supabase
        .from("friendships")
        .select("requester_id, addressee_id")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq("status", "accepted"),
    ]);
    inWatchlist = !!watchlistRow?.id;
    if (entry) existing = { user_rating: entry.user_rating as number | null, notes: entry.notes as string | null };

    if (friendRows && friendRows.length > 0 && movieRow?.id) {
      const friendIds = friendRows.map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id));
      const { data: ratingsRows } = await supabase
        .from("watched_movies")
        .select("user_id, user_rating, profiles!watched_movies_user_id_fkey(display_name, username, avatar_url)")
        .eq("movie_id", movieRow.id)
        .in("user_id", friendIds)
        .not("user_rating", "is", null);

      friendRatings = (ratingsRows ?? []).map((r) => {
        const p = r.profiles as unknown as { display_name: string | null; username: string | null; avatar_url: string | null } | null;
        return {
          name: p?.display_name?.trim() || p?.username || "Friend",
          username: p?.username ?? null,
          avatar_url: p?.avatar_url ?? null,
          rating: r.user_rating as number,
        };
      });
    }
  }

  return {
    isLoggedIn: !!user,
    existing,
    inWatchlist,
    friendRatings,
    recentReviews,
    memberDiaryHighlight: showMemberDiaryHighlight ? memberDiaryHighlight : null,
  };
}
