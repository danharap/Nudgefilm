import { ShowActions } from "./ShowActions";
import { SeasonRater } from "./SeasonRater";
import { getTVDetails } from "@/lib/tmdb/client";
import { posterUrl, toTVStoredId, toTVSeasonStoredId } from "@/lib/tmdb/constants";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ tmdbId: string }> };

export default async function ShowDetailPage({ params }: Props) {
  const { tmdbId: raw } = await params;
  const tmdbId = Number(raw);
  if (!Number.isFinite(tmdbId)) notFound();

  let show;
  try {
    show = await getTVDetails(tmdbId);
  } catch {
    notFound();
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  type DiaryEntry = { user_rating: number | null; notes: string | null };

  // Load show-level diary entry
  let existing: DiaryEntry | null = null;
  let inWatchlist = false;
  // Load per-season ratings: keyed by the season's own TMDb ID
  const seasonRatings: Record<number, DiaryEntry> = {};

  if (user) {
    const showStoredId = toTVStoredId(tmdbId);

    // Season stored IDs (exclude season 0 / Specials)
    const relevantSeasons = (show.seasons ?? []).filter((s) => s.season_number > 0);
    const seasonStoredIds = relevantSeasons.map((s) => toTVSeasonStoredId(s.id));

    // Batch: fetch show row + all season rows in one go
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
        const entry: DiaryEntry = {
          user_rating: row.user_rating as number | null,
          notes: row.notes as string | null,
        };
        if (n === showStoredId) {
          existing = entry;
        } else {
          // Recover original season TMDb ID
          const seasonTmdbId = n - 20_000_000;
          seasonRatings[seasonTmdbId] = entry;
        }
      }
    }
  }

  const backdrop = posterUrl(show.backdrop_path, "original");
  const poster = posterUrl(show.poster_path, "w500");
  const similarHref = `/recommend?source=tv&title=${encodeURIComponent(show.name)}&genres=${encodeURIComponent((show.genres ?? []).map((g) => g.id).join(","))}&fromTmdbId=${tmdbId}`;
  const year = show.first_air_date?.slice(0, 4);
  const runtime =
    show.episode_run_time?.length > 0
      ? `~${show.episode_run_time[0]} min / ep`
      : null;

  // Filter out "Specials" (season 0) from the main list
  const seasons = (show.seasons ?? []).filter((s) => s.season_number > 0);

  return (
    <article>
      {/* Backdrop */}
      <div className="relative h-56 w-full overflow-hidden sm:h-72 md:h-96">
        {backdrop ? (
          <Image
            src={backdrop}
            alt=""
            fill
            className="object-cover opacity-60"
            priority
            sizes="100vw"
            aria-hidden
          />
        ) : (
          <div className="h-full bg-zinc-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#070708] via-[#070708]/80 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 pb-20 sm:px-6">
        {/* Poster + meta */}
        <div className="-mt-24 flex flex-col gap-6 md:flex-row md:items-end">
          <div className="relative mx-auto aspect-[2/3] w-44 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-2xl md:mx-0 md:w-52">
            {poster ? (
              <Image src={poster} alt={show.name} fill className="object-cover" sizes="208px" />
            ) : null}
          </div>

          <div className="flex-1 space-y-3 text-center md:pb-2 md:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
              <span className="rounded-full bg-violet-600/20 px-2.5 py-0.5 text-xs font-semibold text-violet-300 ring-1 ring-violet-500/20">
                TV Series
              </span>
              {show.status && (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                  show.status === "Ended"
                    ? "bg-zinc-800 text-zinc-400 ring-white/10"
                    : "bg-green-500/15 text-green-400 ring-green-500/20"
                }`}>
                  {show.status}
                </span>
              )}
            </div>

            <h1 className="text-3xl font-semibold text-white md:text-4xl">{show.name}</h1>

            {show.tagline && (
              <p className="text-sm italic text-zinc-500">&ldquo;{show.tagline}&rdquo;</p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-zinc-400 md:justify-start">
              {year && <span>{year}</span>}
              {year && <span>·</span>}
              <span>★ {show.vote_average?.toFixed(1)}</span>
              <span className="text-zinc-600">({show.vote_count?.toLocaleString()} votes)</span>
              <span>·</span>
              <span>{show.number_of_seasons} season{show.number_of_seasons !== 1 ? "s" : ""}</span>
              <span>·</span>
              <span>{show.number_of_episodes} episodes</span>
              {runtime && (
                <>
                  <span>·</span>
                  <span>{runtime}</span>
                </>
              )}
            </div>

            {/* Genres */}
            <div className="flex flex-wrap justify-center gap-2 md:justify-start">
              {(show.genres ?? []).map((g) => (
                <span
                  key={g.id}
                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-zinc-300"
                >
                  {g.name}
                </span>
              ))}
            </div>

            {/* Networks */}
            {show.networks?.length > 0 && (
              <p className="text-xs text-zinc-500">
                {show.networks.map((n) => n.name).join(", ")}
              </p>
            )}
          </div>
        </div>

        {/* Overview */}
        <p className="mx-auto mt-10 max-w-3xl text-sm leading-relaxed text-zinc-400 md:text-base">
          {show.overview || "No synopsis available."}
        </p>

        {/* Seasons */}
        {seasons.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-5 text-lg font-semibold text-white">
              Seasons ({seasons.length})
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {seasons.map((season) => {
                const seasonPoster = posterUrl(season.poster_path, "w342");
                const airYear = season.air_date?.slice(0, 4);
                const seasonEntry = seasonRatings[season.id] ?? null;
                return (
                  <div
                    key={season.id}
                    className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-zinc-900/50 p-4"
                  >
                    <div className="flex gap-4">
                      <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                        {seasonPoster ? (
                          <Image
                            src={seasonPoster}
                            alt={season.name}
                            fill
                            className="object-cover"
                            sizes="56px"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-white">{season.name}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {season.episode_count} episodes
                          {airYear ? ` · ${airYear}` : ""}
                        </p>
                        {season.overview && (
                          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                            {season.overview}
                          </p>
                        )}
                      </div>
                    </div>
                    <SeasonRater
                      seasonTmdbId={season.id}
                      showTmdbId={tmdbId}
                      showName={show.name}
                      seasonName={season.name}
                      posterPath={season.poster_path}
                      airDate={season.air_date}
                      episodeRunTime={show.episode_run_time?.[0] ?? null}
                      isLoggedIn={!!user}
                      existing={seasonEntry}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Log / Rate */}
        <ShowActions
          tmdbId={tmdbId}
          isLoggedIn={!!user}
          existing={existing}
          inWatchlist={inWatchlist}
          similarHref={similarHref}
        />

        {!user && (
          <p className="mt-4 text-center text-xs text-zinc-600 md:text-left">
            <Link href={`/login?redirect=/show/${tmdbId}`} className="text-zinc-500 underline-offset-2 hover:underline">
              Sign in
            </Link>{" "}
            to log this show, rate it, and add it to your watchlist.
          </p>
        )}

        {/* Browse back */}
        <div className="mt-12">
          <Link
            href="/browse?type=tv"
            className="text-sm text-zinc-500 transition hover:text-zinc-300"
          >
            ← Browse more TV shows
          </Link>
        </div>
      </div>
    </article>
  );
}
