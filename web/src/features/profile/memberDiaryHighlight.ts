import type { SupabaseClient } from "@supabase/supabase-js";

import { getProfileByUsername } from "@/features/users/service";

export type MemberDiaryHighlight = {
  memberId: string;
  displayName: string;
  username: string | null;
  avatar_url: string | null;
  user_rating: number | null;
  notes: string | null;
};

/** Diary row for a member when opened from their profile (?reviewedBy=&libraryMovieId=). */
export async function loadMemberDiaryHighlight(
  supabase: SupabaseClient,
  reviewedByUsername: string | undefined,
  libraryMovieIdParam: string | undefined,
  fallbackMoviePk: number | null,
): Promise<MemberDiaryHighlight | null> {
  const u = reviewedByUsername?.trim();
  if (!u) return null;

  const profile = await getProfileByUsername(u);
  if (!profile?.is_public) return null;

  let moviePk: number | null = null;
  if (libraryMovieIdParam) {
    const n = Number(libraryMovieIdParam);
    if (Number.isFinite(n) && n > 0) moviePk = Math.floor(n);
  }
  if (moviePk == null) moviePk = fallbackMoviePk;
  if (moviePk == null) return null;

  const { data: row } = await supabase
    .from("watched_movies")
    .select("user_rating, notes")
    .eq("user_id", profile.id)
    .eq("movie_id", moviePk)
    .maybeSingle();

  if (!row) return null;

  const notes = String(row.notes ?? "").trim();
  const ratingRaw = row.user_rating;
  const user_rating =
    ratingRaw != null && ratingRaw !== "" ? Number(ratingRaw) : null;

  const hasRating = user_rating != null && Number.isFinite(user_rating);
  if (!notes && !hasRating) return null;

  return {
    memberId: profile.id,
    displayName: profile.display_name?.trim() || profile.username || "Member",
    username: profile.username,
    avatar_url: profile.avatar_url,
    user_rating: hasRating ? user_rating : null,
    notes: notes || null,
  };
}
