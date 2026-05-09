"use server";

import { getMovieDetails, getTVDetails } from "@/lib/tmdb/client";
import { createClient } from "@/lib/supabase/server";
import { trackServerEvent } from "@/lib/analytics/track";
import { toTVStoredId, toTVSeasonStoredId } from "@/lib/tmdb/constants";
import { revalidatePath } from "next/cache";

async function ensureMovieRow(tmdbId: number): Promise<number> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("movies")
    .select("id")
    .eq("tmdb_id", tmdbId)
    .maybeSingle();
  if (existing?.id) return Number(existing.id);

  const d = await getMovieDetails(tmdbId);
  const year =
    d.release_date && d.release_date.length >= 4
      ? Number(d.release_date.slice(0, 4))
      : null;

  const row = {
    tmdb_id: tmdbId,
    title: d.title,
    release_year: Number.isFinite(year) ? year : null,
    poster_path: d.poster_path,
    backdrop_path: d.backdrop_path,
    overview: d.overview,
    runtime: d.runtime,
    vote_average: d.vote_average,
    vote_count: d.vote_count,
    genres: d.genres,
  };

  const { data, error } = await supabase
    .from("movies")
    .upsert(row, { onConflict: "tmdb_id" })
    .select("id")
    .single();

  if (error) {
    console.error("[library] ensureMovieRow upsert error:", error.code, error.message);
    throw new Error("Failed to save movie. Please try again.");
  }
  return Number(data.id);
}

export async function markWatched(
  tmdbId: number,
  rating?: number | null,
  notes?: string | null,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to save your watch history.");

  const movieId = await ensureMovieRow(tmdbId);
  const { error } = await supabase.from("watched_movies").upsert(
    {
      user_id: user.id,
      movie_id: movieId,
      user_rating: rating ?? null,
      notes: notes ?? null,
      watched_at: new Date().toISOString(),
    },
    { onConflict: "user_id,movie_id" },
  );
  if (error) {
    console.error("[library] markWatched error:", error.code, error.message);
    throw new Error("Failed to save to diary. Please try again.");
  }
  void trackServerEvent("movie_watched", { tmdbId, rating: rating ?? null }, user.id);
  revalidatePath("/watched");
  revalidatePath("/watchlist");
  revalidatePath("/browse");
  revalidatePath("/results");
  revalidatePath("/profile");
}

export async function removeFromWatched(tmdbId: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: movie } = await supabase
    .from("movies")
    .select("id")
    .eq("tmdb_id", tmdbId)
    .maybeSingle();
  if (!movie?.id) return;

  const { error } = await supabase
    .from("watched_movies")
    .delete()
    .eq("user_id", user.id)
    .eq("movie_id", movie.id);
  if (error) {
    console.error("[library] removeFromWatched error:", error.code, error.message);
    throw new Error("Failed to remove from diary.");
  }
  revalidatePath("/watched");
  revalidatePath("/profile");
}

/** Remove show-level diary row (stored `tmdb_id` uses TV offset). */
export async function removeTVFromWatched(tmdbId: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const storedId = toTVStoredId(tmdbId);
  const { data: movie } = await supabase
    .from("movies")
    .select("id")
    .eq("tmdb_id", storedId)
    .maybeSingle();
  if (!movie?.id) return;

  const { error } = await supabase
    .from("watched_movies")
    .delete()
    .eq("user_id", user.id)
    .eq("movie_id", movie.id);
  if (error) {
    console.error("[library] removeTVFromWatched error:", error.code, error.message);
    throw new Error("Failed to remove from diary.");
  }
  revalidatePath("/watched");
  revalidatePath("/profile");
  revalidatePath("/browse");
}

export async function addToWatchlist(tmdbId: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to use your watchlist.");

  const movieId = await ensureMovieRow(tmdbId);
  const { error } = await supabase.from("watchlist").upsert(
    { user_id: user.id, movie_id: movieId },
    { onConflict: "user_id,movie_id" },
  );
  if (error) {
    console.error("[library] addToWatchlist error:", error.code, error.message);
    throw new Error("Failed to add to watchlist.");
  }
  void trackServerEvent("watchlist_add", { tmdbId }, user.id);
  revalidatePath("/watchlist");
  revalidatePath("/browse");
}

/** Remove by `movies.tmdb_id` (movie/show browse cards, detail pages). */
export async function removeFromWatchlist(tmdbId: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: movie } = await supabase
    .from("movies")
    .select("id")
    .eq("tmdb_id", tmdbId)
    .maybeSingle();
  if (!movie?.id) {
    console.warn("[library] removeFromWatchlist: no movie row for tmdb_id", tmdbId);
    throw new Error("Could not find that title — try refreshing the page.");
  }

  const { error } = await supabase
    .from("watchlist")
    .delete()
    .eq("user_id", user.id)
    .eq("movie_id", movie.id);
  if (error) {
    console.error("[library] removeFromWatchlist:", error.code, error.message);
    throw new Error("Failed to remove from watchlist.");
  }

  void trackServerEvent("watchlist_remove", { tmdbId }, user.id);
  revalidatePath("/watchlist");
  revalidatePath("/browse");
}

/** Remove by watchlist row id — preferred on /watchlist (no movie lookup mismatch). */
export async function removeWatchlistEntry(watchlistRowId: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to manage your watchlist.");

  const { error } = await supabase
    .from("watchlist")
    .delete()
    .eq("id", watchlistRowId)
    .eq("user_id", user.id);

  if (error) {
    console.error("[library] removeWatchlistEntry:", error.code, error.message);
    throw new Error("Failed to remove from watchlist.");
  }

  void trackServerEvent("watchlist_remove", { watchlistRowId }, user.id);
  revalidatePath("/watchlist");
  revalidatePath("/browse");
}

export async function dismissMovie(tmdbId: number, reason?: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to tune future picks.");

  const movieId = await ensureMovieRow(tmdbId);
  const { error } = await supabase.from("dismissed_movies").upsert(
    { user_id: user.id, movie_id: movieId, reason: reason ?? null },
    { onConflict: "user_id,movie_id" },
  );
  if (error) throw new Error("Failed to dismiss movie.");
  revalidatePath("/results");
}

export async function setFavouriteMovie(tmdbId: number, position: 1 | 2 | 3 | 4) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to set favourites.");

  const movieId = await ensureMovieRow(tmdbId);

  // Remove any existing favourite at this position first
  await supabase
    .from("favourite_movies")
    .delete()
    .eq("user_id", user.id)
    .eq("position", position);

  // Remove this movie from any other position to avoid duplicate constraint
  await supabase
    .from("favourite_movies")
    .delete()
    .eq("user_id", user.id)
    .eq("movie_id", movieId);

  const { error } = await supabase.from("favourite_movies").insert({
    user_id: user.id,
    movie_id: movieId,
    position,
  });
  if (error) {
    console.error("[library] setFavourite error:", error.code, error.message);
    throw new Error("Failed to set favourite.");
  }
  revalidatePath("/profile");
}

export async function removeFavouriteMovie(position: 1 | 2 | 3 | 4) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  await supabase
    .from("favourite_movies")
    .delete()
    .eq("user_id", user.id)
    .eq("position", position);
  revalidatePath("/profile");
}

// ---------------------------------------------------------------------------
// TV Show actions — stored with TV_TMDB_OFFSET to avoid movie ID collisions
// ---------------------------------------------------------------------------

async function ensureTVRow(tmdbId: number): Promise<number> {
  const storedId = toTVStoredId(tmdbId);
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("movies")
    .select("id")
    .eq("tmdb_id", storedId)
    .maybeSingle();
  if (existing?.id) return Number(existing.id);

  const show = await getTVDetails(tmdbId);
  const year =
    show.first_air_date && show.first_air_date.length >= 4
      ? Number(show.first_air_date.slice(0, 4))
      : null;

  const row = {
    tmdb_id: storedId,
    title: show.name,
    release_year: Number.isFinite(year) ? year : null,
    poster_path: show.poster_path,
    backdrop_path: show.backdrop_path,
    overview: show.overview,
    runtime: show.episode_run_time?.[0] ?? null,
    vote_average: show.vote_average,
    vote_count: show.vote_count,
    genres: show.genres,
  };

  const { data, error } = await supabase
    .from("movies")
    .upsert(row, { onConflict: "tmdb_id" })
    .select("id")
    .single();

  if (error) {
    console.error("[library] ensureTVRow upsert error:", error.code, error.message);
    throw new Error("Failed to save show. Please try again.");
  }
  return Number(data.id);
}

export async function markTVWatched(
  tmdbId: number,
  rating?: number | null,
  notes?: string | null,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to save your watch history.");

  const movieId = await ensureTVRow(tmdbId);
  const { error } = await supabase.from("watched_movies").upsert(
    {
      user_id: user.id,
      movie_id: movieId,
      user_rating: rating ?? null,
      notes: notes ?? null,
      watched_at: new Date().toISOString(),
    },
    { onConflict: "user_id,movie_id" },
  );
  if (error) {
    console.error("[library] markTVWatched error:", error.code, error.message);
    throw new Error("Failed to save to diary. Please try again.");
  }
  void trackServerEvent("tv_watched", { tmdbId, rating: rating ?? null }, user.id);
  revalidatePath("/watched");
  revalidatePath("/browse");
  revalidatePath("/profile");
}

export async function addTVToWatchlist(tmdbId: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to use your watchlist.");

  const movieId = await ensureTVRow(tmdbId);
  const { error } = await supabase.from("watchlist").upsert(
    { user_id: user.id, movie_id: movieId },
    { onConflict: "user_id,movie_id" },
  );
  if (error) {
    console.error("[library] addTVToWatchlist error:", error.code, error.message);
    throw new Error("Failed to add to watchlist.");
  }
  void trackServerEvent("tv_watchlist_add", { tmdbId }, user.id);
  revalidatePath("/watchlist");
  revalidatePath("/browse");
}

export async function removeTVFromWatchlist(tmdbId: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const storedId = toTVStoredId(tmdbId);
  const { data: movie } = await supabase
    .from("movies")
    .select("id")
    .eq("tmdb_id", storedId)
    .maybeSingle();
  if (!movie?.id) return;

  await supabase
    .from("watchlist")
    .delete()
    .eq("user_id", user.id)
    .eq("movie_id", movie.id);
  revalidatePath("/watchlist");
  revalidatePath("/browse");
}

// ---------------------------------------------------------------------------
// Individual TV Season actions
// ---------------------------------------------------------------------------

async function ensureTVSeasonRow(
  seasonTmdbId: number,
  showName: string,
  seasonName: string,
  posterPath: string | null,
  airDate: string | null,
  episodeRunTime: number | null,
  showTmdbId: number | null,
): Promise<number> {
  const storedId = toTVSeasonStoredId(seasonTmdbId);
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("movies")
    .select("id")
    .eq("tmdb_id", storedId)
    .maybeSingle();
  if (existing?.id) return Number(existing.id);

  const year = airDate && airDate.length >= 4 ? Number(airDate.slice(0, 4)) : null;

  // vote_count stores the parent show's original TMDb ID so the profile can
  // generate a correct /show/[id] link without a separate lookup.
  const row = {
    tmdb_id: storedId,
    title: `${showName} — ${seasonName}`,
    release_year: Number.isFinite(year) ? year : null,
    poster_path: posterPath,
    backdrop_path: null,
    overview: null,
    runtime: episodeRunTime,
    vote_average: null,
    vote_count: showTmdbId ?? null,
    parent_show_tmdb_id: showTmdbId ?? null,
    genres: [],
  };

  const { data, error } = await supabase
    .from("movies")
    .upsert(row, { onConflict: "tmdb_id" })
    .select("id")
    .single();

  if (error) {
    console.error("[library] ensureTVSeasonRow upsert error:", error.code, error.message);
    throw new Error("Failed to save season. Please try again.");
  }
  return Number(data.id);
}

export async function markTVSeasonWatched(
  seasonTmdbId: number,
  showName: string,
  seasonName: string,
  posterPath: string | null,
  airDate: string | null,
  episodeRunTime: number | null,
  rating?: number | null,
  notes?: string | null,
  showTmdbId?: number | null,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to save your watch history.");

  const movieId = await ensureTVSeasonRow(seasonTmdbId, showName, seasonName, posterPath, airDate, episodeRunTime, showTmdbId ?? null);
  const { error } = await supabase.from("watched_movies").upsert(
    {
      user_id: user.id,
      movie_id: movieId,
      user_rating: rating ?? null,
      notes: notes ?? null,
      watched_at: new Date().toISOString(),
    },
    { onConflict: "user_id,movie_id" },
  );
  if (error) {
    console.error("[library] markTVSeasonWatched error:", error.code, error.message);
    throw new Error("Failed to save to diary. Please try again.");
  }
  void trackServerEvent("tv_watched", { tmdbId: seasonTmdbId, rating: rating ?? null }, user.id);
  revalidatePath("/watched");
  revalidatePath("/profile");
}

export async function setWatchedEntryCustomPoster(
  watchedRowId: number,
  publicUrl: string | null,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to edit your diary.");

  const { error } = await supabase
    .from("watched_movies")
    .update({ custom_poster_url: publicUrl })
    .eq("id", watchedRowId)
    .eq("user_id", user.id);
  if (error) {
    console.error("[library] setWatchedEntryCustomPoster:", error.code, error.message);
    throw new Error("Could not update cover.");
  }
  revalidatePath("/profile");
  revalidatePath("/watched");
}

export async function setFavouriteEntryCustomPoster(
  position: 1 | 2 | 3 | 4,
  publicUrl: string | null,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to edit favourites.");

  const { error } = await supabase
    .from("favourite_movies")
    .update({ custom_poster_url: publicUrl })
    .eq("user_id", user.id)
    .eq("position", position);
  if (error) {
    console.error("[library] setFavouriteEntryCustomPoster:", error.code, error.message);
    throw new Error("Could not update cover.");
  }
  revalidatePath("/profile");
}

export async function saveUserPreferences(payload: {
  favorite_genres?: unknown;
  default_runtime_min?: number | null;
  default_runtime_max?: number | null;
  language_preferences?: unknown;
  tone_preferences?: unknown;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: existing } = await supabase
    .from("user_preferences")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("user_preferences")
      .update(payload)
      .eq("user_id", user.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("user_preferences").insert({
      user_id: user.id,
      ...payload,
    });
    if (error) throw error;
  }
  revalidatePath("/profile");
}
