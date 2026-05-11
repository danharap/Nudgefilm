import { ShowActions } from "./ShowActions";
import { SeasonRater } from "./SeasonRater";
import { MemberDiaryHighlightCard } from "@/components/social/MemberDiaryHighlightCard";
import { loadMemberDiaryHighlight } from "@/features/profile/memberDiaryHighlight";
import {
  getTVCredits,
  getTVDetails,
  getTVExternalIds,
  getTVVideos,
  getTVWatchProviders,
} from "@/lib/tmdb/client";
import { TMDB_IMAGE_BASE, posterUrl, toTVStoredId, toTVSeasonStoredId } from "@/lib/tmdb/constants";
import { getConfiguredOrigin } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import TmdbImage from "@/components/ui/TmdbImage";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import {
  parseTrailingTmdbIdFromSlugParam,
  tvDetailSegment,
} from "@/lib/media-slug";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string; reviewedBy?: string; libraryMovieId?: string }>;
};

const SHOW_TABS = ["cast", "crew", "details", "genres", "availability"] as const;
type ShowTab = (typeof SHOW_TABS)[number];

function isShowTab(value: string | undefined): value is ShowTab {
  return !!value && (SHOW_TABS as readonly string[]).includes(value);
}

function pickTrailer(videos: Array<{ key: string; site: string; type: string; official: boolean }>) {
  const yt = videos.filter((v) => v.site === "YouTube");
  const best =
    yt.find((v) => v.official && v.type === "Trailer") ??
    yt.find((v) => v.type === "Trailer") ??
    yt.find((v) => v.type === "Teaser") ??
    yt[0];
  return best ? `https://www.youtube.com/watch?v=${best.key}` : null;
}

export default async function ShowDetailPage({ params, searchParams }: Props) {
  const { slug: rawSlug } = await params;
  const raw = decodeURIComponent(rawSlug);
  const { tab: tabParam, reviewedBy: reviewedByParam, libraryMovieId: libraryMovieIdParam } =
    await searchParams;
  const tmdbId = parseTrailingTmdbIdFromSlugParam(raw);
  if (tmdbId === null) notFound();
  const activeTab: ShowTab = isShowTab(tabParam) ? tabParam : "cast";

  let show;
  let credits;
  let videos;
  let externalIds;
  let watchProviders;
  try {
    [show, credits, videos, externalIds, watchProviders] = await Promise.all([
      getTVDetails(tmdbId),
      getTVCredits(tmdbId),
      getTVVideos(tmdbId),
      getTVExternalIds(tmdbId),
      getTVWatchProviders(tmdbId),
    ]);
  } catch {
    notFound();
  }

  const canonicalSegment = tvDetailSegment(show.name, tmdbId);
  if (raw !== canonicalSegment) {
    const sp = new URLSearchParams();
    if (tabParam) sp.set("tab", tabParam);
    if (reviewedByParam?.trim()) sp.set("reviewedBy", reviewedByParam.trim());
    if (libraryMovieIdParam?.trim()) sp.set("libraryMovieId", libraryMovieIdParam.trim());
    const qs = sp.toString();
    permanentRedirect(`/show/${canonicalSegment}${qs ? `?${qs}` : ""}`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const showStoredIdForHighlight = toTVStoredId(tmdbId);
  const { data: showMovieRowForHighlight } = await supabase
    .from("movies")
    .select("id")
    .eq("tmdb_id", showStoredIdForHighlight)
    .maybeSingle();

  const memberDiaryHighlight = await loadMemberDiaryHighlight(
    supabase,
    reviewedByParam,
    libraryMovieIdParam,
    showMovieRowForHighlight?.id ?? null,
  );
  const showMemberDiaryHighlight =
    memberDiaryHighlight != null &&
    (!user || memberDiaryHighlight.memberId !== user.id);

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

  const backdrop = posterUrl(show.backdrop_path, "w1280");
  const poster = posterUrl(show.poster_path, "w500");
  const providerRegion = watchProviders.results?.CA ?? null;
  const trailerUrl = pickTrailer(videos.results ?? []);
  const shareUrl = `${getConfiguredOrigin()}/show/${canonicalSegment}`;
  const directors = credits.crew.filter((m) => m.job === "Director");
  const creators = credits.crew.filter((m) => m.job === "Executive Producer" || m.job === "Producer");
  const writers = credits.crew.filter((m) => m.job === "Writer" || m.job === "Screenplay");
  const similarHref = `/recommend?source=tv&title=${encodeURIComponent(show.name)}&genres=${encodeURIComponent((show.genres ?? []).map((g) => g.id).join(","))}&fromTmdbId=${tmdbId}`;
  const year = show.first_air_date?.slice(0, 4);
  const runtime =
    show.episode_run_time?.length > 0
      ? `~${show.episode_run_time[0]} min / ep`
      : null;

  // Filter out "Specials" (season 0) from the main list
  const seasons = (show.seasons ?? []).filter((s) => s.season_number > 0);
  const loginRedirectPath = (() => {
    const sp = new URLSearchParams();
    if (reviewedByParam?.trim()) sp.set("reviewedBy", reviewedByParam.trim());
    if (libraryMovieIdParam?.trim()) sp.set("libraryMovieId", libraryMovieIdParam.trim());
    const qs = sp.toString();
    return `/show/${canonicalSegment}${qs ? `?${qs}` : ""}`;
  })();

  const tabHref = (tab: ShowTab) => {
    const sp = new URLSearchParams();
    sp.set("tab", tab);
    const rb = reviewedByParam?.trim();
    const lm = libraryMovieIdParam?.trim();
    if (rb) sp.set("reviewedBy", rb);
    if (lm) sp.set("libraryMovieId", lm);
    return `/show/${canonicalSegment}?${sp.toString()}`;
  };

  const links = {
    tmdb: `https://www.themoviedb.org/tv/${tmdbId}`,
    imdb: externalIds.imdb_id ? `https://www.imdb.com/title/${externalIds.imdb_id}` : null,
    homepage: show.homepage || null,
  };

  return (
    <article className="pb-16">
      <div className="relative h-[48vh] min-h-[280px] w-full overflow-hidden sm:h-[56vh] sm:min-h-[360px]">
        {backdrop ? (
          <TmdbImage
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
        <div className="absolute inset-0 bg-gradient-to-t from-[#050507] via-[#070708]/88 to-[#070708]/30" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-[#070708]" />
      </div>

      <div className="relative z-10 mx-auto -mt-24 max-w-6xl px-4 sm:-mt-32 sm:px-6 lg:-mt-40">
        <section className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)_340px] lg:items-start">
          <div className="relative mx-auto aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl sm:w-52 lg:mx-0">
            {poster ? (
              <TmdbImage src={poster} alt={show.name} fill className="object-cover" sizes="208px" />
            ) : null}
          </div>

          <div className="space-y-4 text-center lg:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
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

            <h1 className="text-2xl font-semibold text-white sm:text-3xl md:text-4xl lg:text-5xl">{show.name}</h1>

            {show.tagline && (
              <p className="text-sm italic text-zinc-500">&ldquo;{show.tagline}&rdquo;</p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-zinc-300/90 lg:justify-start">
              {year && <span>{year}</span>}
              {year && <span>·</span>}
              <span>
                ★ {show.vote_average?.toFixed(1)}{" "}
                <span className="text-zinc-500">
                  ({show.vote_count?.toLocaleString()} votes)
                </span>
              </span>
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

            {existing?.user_rating ? (
              <p className="text-sm text-indigo-200/80">
                Your rating:{" "}
                <span className="font-semibold">{existing.user_rating}/10</span>
              </p>
            ) : null}

            <div className="flex flex-wrap justify-center gap-2 md:justify-start">
              {(show.genres ?? []).map((g) => (
                <Link
                  key={g.id}
                  href={`/recommend?source=tv&genres=${g.id}`}
                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-zinc-300"
                >
                  {g.name}
                </Link>
              ))}
            </div>

            {show.networks && show.networks.length > 0 ? (
              <p className="text-xs text-zinc-500">
                {show.networks.map((n) => n.name).join(", ")}
              </p>
            ) : null}

            <p className="max-w-3xl text-sm leading-relaxed text-zinc-300">
              {show.overview || "No synopsis available."}
            </p>

            {showMemberDiaryHighlight && memberDiaryHighlight ? (
              <MemberDiaryHighlightCard highlight={memberDiaryHighlight} />
            ) : null}

            <div className="flex flex-wrap justify-center gap-2 text-xs text-zinc-400 lg:justify-start">
              <a href={links.tmdb} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/10 px-3 py-1 hover:text-white">TMDb</a>
              {links.imdb ? <a href={links.imdb} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/10 px-3 py-1 hover:text-white">IMDb</a> : null}
              {links.homepage ? <a href={links.homepage} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/10 px-3 py-1 hover:text-white">Official Site</a> : null}
              {trailerUrl ? <a href={trailerUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-indigo-200">Trailer</a> : null}
            </div>
          </div>

          <div className="lg:sticky lg:top-20">
            <ShowActions
              tmdbId={tmdbId}
              loginRedirectPath={loginRedirectPath}
              isLoggedIn={!!user}
              existing={existing}
              inWatchlist={inWatchlist}
              similarHref={similarHref}
              trailerUrl={trailerUrl}
              shareUrl={shareUrl}
            />
            {!user ? (
              <p className="mt-3 text-center text-xs text-zinc-500 lg:text-left">
                <Link
                  href={`/login?redirect=${encodeURIComponent(loginRedirectPath)}`}
                  className="underline-offset-2 hover:underline"
                >
                  Sign in
                </Link>{" "}
                to log, rate, and save this show.
              </p>
            ) : null}
          </div>
        </section>

        <section className="mt-8 sm:mt-10">
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto border-b border-white/10 px-1 pt-1 pb-3">
            {SHOW_TABS.map((tab) => (
              <Link
                key={tab}
                href={tabHref(tab)}
                scroll={false}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium capitalize transition ${
                  activeTab === tab
                    ? "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/30"
                    : "bg-white/5 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {tab}
              </Link>
            ))}
          </div>
          {activeTab === "cast" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {(credits.cast ?? []).slice(0, 36).map((member) => (
                <Link key={`${member.id}-${member.character ?? ""}`} href={`/person/${member.id}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-zinc-200 hover:border-indigo-400/30">
                  <span className="font-medium">{member.name}</span>
                  {member.character ? <span className="ml-1 text-zinc-400">as {member.character}</span> : null}
                </Link>
              ))}
            </div>
          ) : null}
          {activeTab === "crew" ? (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Directors</p>
                {directors.length > 0 ? directors.map((d) => (
                  <Link key={`d-${d.id}`} href={`/person/${d.id}`} className="block text-sm text-zinc-200 hover:text-indigo-300">{d.name}</Link>
                )) : <p className="text-sm text-zinc-500">No data</p>}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Writers</p>
                {writers.slice(0, 12).length > 0 ? writers.slice(0, 12).map((w) => (
                  <p key={`w-${w.id}-${w.job}`} className="text-sm text-zinc-200">{w.name}</p>
                )) : <p className="text-sm text-zinc-500">No data</p>}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Production</p>
                {creators.slice(0, 12).length > 0 ? creators.slice(0, 12).map((p) => (
                  <p key={`p-${p.id}-${p.job}`} className="text-sm text-zinc-200">{p.name}</p>
                )) : <p className="text-sm text-zinc-500">No data</p>}
              </div>
            </div>
          ) : null}
          {activeTab === "details" ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">Runtime: {runtime ?? "—"}</div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">Language: {show.spoken_languages?.map((l) => l.english_name).join(", ") || show.original_language || "—"}</div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">First air date: {show.first_air_date || "—"}</div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">Countries: {show.production_countries?.map((c) => c.name).join(", ") || "—"}</div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">Companies: {show.production_companies?.slice(0, 4).map((c) => c.name).join(", ") || "—"}</div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">Status: {show.status || "—"} · TMDb {show.vote_average?.toFixed(1)} ({show.vote_count?.toLocaleString()})</div>
            </div>
          ) : null}
          {activeTab === "genres" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {(show.genres ?? []).map((g) => (
                <Link key={g.id} href={`/recommend?source=tv&genres=${g.id}`} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-zinc-200 hover:border-indigo-400/30">
                  {g.name}
                </Link>
              ))}
            </div>
          ) : null}
          {activeTab === "availability" ? (
            <div className="mt-4 space-y-4">
              {providerRegion ? (
                <>
                  {(["flatrate", "rent", "buy"] as const).map((k) => (
                    <div key={k} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="mb-3 text-xs uppercase tracking-wide text-zinc-500">{k === "flatrate" ? "Stream" : k === "rent" ? "Rent" : "Buy"}</p>
                      {(providerRegion[k] ?? []).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {providerRegion[k]?.map((p) => (
                            <a
                              key={`${k}-${p.provider_id}`}
                              href={providerRegion.link || `https://www.themoviedb.org/tv/${tmdbId}/watch`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-sm text-zinc-200 hover:border-indigo-400/30"
                            >
                              {p.logo_path ? <TmdbImage src={`${TMDB_IMAGE_BASE}/w92${p.logo_path}`} alt="" width={20} height={20} className="rounded" /> : null}
                              {p.provider_name}
                            </a>
                          ))}
                        </div>
                      ) : <p className="text-sm text-zinc-500">No options listed.</p>}
                    </div>
                  ))}
                </>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">
                  No streaming options found for your region.
                </div>
              )}
            </div>
          ) : null}
        </section>

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
                    <div className="flex gap-3 sm:gap-4">
                      <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                        {seasonPoster ? (
                          <TmdbImage
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
