import { MovieActions } from "./MovieActions";
import { MemberDiaryHighlightCard } from "@/components/social/MemberDiaryHighlightCard";
import { Avatar } from "@/components/ui/Avatar";
import { loadMemberDiaryHighlight } from "@/features/profile/memberDiaryHighlight";
import {
  getMovieCredits,
  getMovieDetails,
  getMovieExternalIds,
  getMovieVideos,
  getMovieWatchProviders,
} from "@/lib/tmdb/client";
import { TMDB_IMAGE_BASE, posterUrl } from "@/lib/tmdb/constants";
import { getConfiguredOrigin } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import TmdbImage from "@/components/ui/TmdbImage";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import {
  movieDetailSegment,
  parseTrailingTmdbIdFromSlugParam,
} from "@/lib/media-slug";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string; reviewedBy?: string; libraryMovieId?: string }>;
};

const MOVIE_TABS = ["cast", "crew", "details", "genres", "availability"] as const;
type MovieTab = (typeof MOVIE_TABS)[number];

function isMovieTab(value: string | undefined): value is MovieTab {
  return !!value && (MOVIE_TABS as readonly string[]).includes(value);
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

export default async function MovieDetailPage({ params, searchParams }: Props) {
  const { slug: rawSlug } = await params;
  const raw = decodeURIComponent(rawSlug);
  const { tab: tabParam, reviewedBy: reviewedByParam, libraryMovieId: libraryMovieIdParam } =
    await searchParams;
  const tmdbId = parseTrailingTmdbIdFromSlugParam(raw);
  if (tmdbId === null) notFound();
  const activeTab: MovieTab = isMovieTab(tabParam) ? tabParam : "cast";

  let movie;
  let credits;
  let videos;
  let externalIds;
  let watchProviders;
  try {
    [movie, credits, videos, externalIds, watchProviders] = await Promise.all([
      getMovieDetails(tmdbId),
      getMovieCredits(tmdbId),
      getMovieVideos(tmdbId),
      getMovieExternalIds(tmdbId),
      getMovieWatchProviders(tmdbId),
    ]);
  } catch {
    notFound();
  }

  const canonicalSegment = movieDetailSegment(movie.title, tmdbId);
  if (raw !== canonicalSegment) {
    const sp = new URLSearchParams();
    if (tabParam) sp.set("tab", tabParam);
    if (reviewedByParam?.trim()) sp.set("reviewedBy", reviewedByParam.trim());
    if (libraryMovieIdParam?.trim()) sp.set("libraryMovieId", libraryMovieIdParam.trim());
    const qs = sp.toString();
    permanentRedirect(`/movie/${canonicalSegment}${qs ? `?${qs}` : ""}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Load existing diary entry + friends' ratings for this movie.
  let existing: { user_rating: number | null; notes: string | null } | null = null;
  let inWatchlist = false;
  type FriendRating = { name: string; username: string | null; avatar_url: string | null; rating: number };
  let friendRatings: FriendRating[] = [];
  type Review = {
    name: string;
    username: string | null;
    avatar_url: string | null;
    rating: number | null;
    notes: string;
  };
  let recentReviews: Review[] = [];

  const { data: movieRow } = await supabase
    .from("movies")
    .select("id")
    .eq("tmdb_id", tmdbId)
    .maybeSingle();

  const memberDiaryHighlight = await loadMemberDiaryHighlight(
    supabase,
    reviewedByParam,
    libraryMovieIdParam,
    movieRow?.id ?? null,
  );
  const showMemberDiaryHighlight =
    memberDiaryHighlight != null &&
    (!user || memberDiaryHighlight.memberId !== user.id);

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
      const p = (r.profiles as unknown) as { display_name: string | null; username: string | null; avatar_url: string | null } | null;
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
        // Friends who watched this movie and left a rating
        supabase
          .from("friendships")
          .select(
            "requester_id, addressee_id",
          )
          .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
          .eq("status", "accepted"),
      ]);
      inWatchlist = !!watchlistRow?.id;

      if (entry) {
        existing = {
          user_rating: entry.user_rating as number | null,
          notes: entry.notes as string | null,
        };
      }

      if (friendRows && friendRows.length > 0) {
        const friendIds = friendRows.map((f) =>
          f.requester_id === user.id ? f.addressee_id : f.requester_id,
        );
        const { data: ratingsRows } = await supabase
          .from("watched_movies")
          .select(
            "user_id, user_rating, profiles!watched_movies_user_id_fkey(display_name, username, avatar_url)",
          )
          .eq("movie_id", movieRow.id)
          .in("user_id", friendIds)
          .not("user_rating", "is", null);

        friendRatings = (ratingsRows ?? []).map((r) => {
          const p = (r.profiles as unknown) as { display_name: string | null; username: string | null; avatar_url: string | null } | null;
          return {
            name: p?.display_name?.trim() || p?.username || "Friend",
            username: p?.username ?? null,
            avatar_url: p?.avatar_url ?? null,
            rating: r.user_rating as number,
          };
        });
      }
  }

  const backdrop = posterUrl(movie.backdrop_path, "w1280");
  const poster = posterUrl(movie.poster_path, "w500");
  const providerRegion = watchProviders.results?.CA ?? null;
  const trailerUrl = pickTrailer(videos.results ?? []);
  const similarHref = `/recommend?source=movie&title=${encodeURIComponent(movie.title)}&genres=${encodeURIComponent(movie.genres.map((g) => g.id).join(","))}&fromTmdbId=${tmdbId}`;
  const director = credits.crew.find((m) => m.job === "Director");
  const directors = credits.crew.filter((m) => m.job === "Director");
  const writers = credits.crew.filter((m) => m.job === "Writer" || m.job === "Screenplay");
  const producers = credits.crew.filter((m) => m.job === "Producer");
  const shareUrl = `${getConfiguredOrigin()}/movie/${canonicalSegment}`;

  const loginRedirectPath = (() => {
    const sp = new URLSearchParams();
    if (reviewedByParam?.trim()) sp.set("reviewedBy", reviewedByParam.trim());
    if (libraryMovieIdParam?.trim()) sp.set("libraryMovieId", libraryMovieIdParam.trim());
    const qs = sp.toString();
    return `/movie/${canonicalSegment}${qs ? `?${qs}` : ""}`;
  })();

  const tabHref = (tab: MovieTab) => {
    const sp = new URLSearchParams();
    sp.set("tab", tab);
    const rb = reviewedByParam?.trim();
    const lm = libraryMovieIdParam?.trim();
    if (rb) sp.set("reviewedBy", rb);
    if (lm) sp.set("libraryMovieId", lm);
    return `/movie/${canonicalSegment}?${sp.toString()}`;
  };
  const links = {
    tmdb: `https://www.themoviedb.org/movie/${tmdbId}`,
    imdb: externalIds.imdb_id ? `https://www.imdb.com/title/${externalIds.imdb_id}` : null,
    homepage: movie.homepage || null,
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
              <TmdbImage
                src={poster}
                alt={movie.title}
                fill
                className="object-cover"
                sizes="208px"
              />
            ) : null}
          </div>
          <div className="space-y-4 text-center lg:text-left">
            <h1 className="text-2xl font-semibold text-white sm:text-3xl md:text-4xl lg:text-5xl">
              {movie.title}
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-zinc-300/90 lg:justify-start">
              <span>{movie.release_date?.slice(0, 4)}</span>
              {director ? <span>· Directed by <Link href={`/person/${director.id}`} className="text-zinc-100 hover:text-indigo-300">{director.name}</Link></span> : null}
              <span>
                ★ {movie.vote_average?.toFixed(1)}{" "}
                <span className="text-zinc-500">
                  ({movie.vote_count?.toLocaleString()} votes)
                </span>
              </span>
              <span>·</span>
              <span>{movie.runtime ?? "—"} min</span>
            </div>
            {existing?.user_rating ? (
              <p className="text-sm text-indigo-200/80">
                Your rating:{" "}
                <span className="font-semibold">{existing.user_rating}/10</span>
              </p>
            ) : null}
            <div className="flex flex-wrap justify-center gap-2 md:justify-start">
              {movie.genres.map((g) => (
                <Link
                  key={g.id}
                  href={`/recommend?genres=${g.id}`}
                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-zinc-300"
                >
                  {g.name}
                </Link>
              ))}
            </div>
            <p className="max-w-3xl text-sm leading-relaxed text-zinc-300">
              {movie.overview || "No synopsis available."}
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
            <MovieActions
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
                to log, rate, and save this film.
              </p>
            ) : null}
          </div>
        </section>
        <section className="mt-8 sm:mt-10">
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto border-b border-white/10 px-1 pt-1 pb-3">
            {MOVIE_TABS.map((tab) => (
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
                <Link
                  key={`${member.id}-${member.character ?? ""}`}
                  href={`/person/${member.id}`}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-zinc-200 transition hover:border-indigo-400/30"
                >
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
                <div className="space-y-2">
                  {directors.length > 0 ? directors.map((d) => (
                    <Link key={`director-${d.id}`} href={`/person/${d.id}`} className="block text-sm text-zinc-200 hover:text-indigo-300">{d.name}</Link>
                  )) : <p className="text-sm text-zinc-500">No data</p>}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Writers</p>
                <div className="space-y-2">
                  {writers.slice(0, 12).length > 0 ? writers.slice(0, 12).map((w) => (
                    <p key={`writer-${w.id}-${w.job}`} className="text-sm text-zinc-200">{w.name} <span className="text-zinc-500">({w.job})</span></p>
                  )) : <p className="text-sm text-zinc-500">No data</p>}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Producers</p>
                <div className="space-y-2">
                  {producers.slice(0, 12).length > 0 ? producers.slice(0, 12).map((p) => (
                    <p key={`producer-${p.id}-${p.job}`} className="text-sm text-zinc-200">{p.name}</p>
                  )) : <p className="text-sm text-zinc-500">No data</p>}
                </div>
              </div>
            </div>
          ) : null}
          {activeTab === "details" ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">Runtime: {movie.runtime ?? "—"} min</div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">Language: {movie.spoken_languages?.map((l) => l.english_name).join(", ") || movie.original_language || "—"}</div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">Release: {movie.release_date || "—"}</div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">Countries: {movie.production_countries?.map((c) => c.name).join(", ") || "—"}</div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">Companies: {movie.production_companies?.slice(0, 4).map((c) => c.name).join(", ") || "—"}</div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">Status: {movie.status || "—"} · TMDb {movie.vote_average?.toFixed(1)} ({movie.vote_count?.toLocaleString()})</div>
            </div>
          ) : null}
          {activeTab === "genres" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {movie.genres.map((g) => (
                <Link key={g.id} href={`/recommend?genres=${g.id}`} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-zinc-200 hover:border-indigo-400/30">
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
                              href={providerRegion.link || links.tmdb}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-sm text-zinc-200 hover:border-indigo-400/30"
                            >
                              {p.logo_path ? (
                                <TmdbImage src={`${TMDB_IMAGE_BASE}/w92${p.logo_path}`} alt="" width={20} height={20} className="rounded" />
                              ) : null}
                              {p.provider_name}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-500">No options listed.</p>
                      )}
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

        {existing?.notes ? (
          <div className="mt-6 rounded-xl border border-white/10 bg-zinc-900/40 px-4 py-3">
            <p className="text-xs text-zinc-500">Your notes</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-300">{existing.notes}</p>
          </div>
        ) : null}

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          {friendRatings.length > 0 ? (
            <div className="rounded-2xl border border-white/10 bg-zinc-900/30 p-4">
              <p className="mb-3 text-xs font-medium text-zinc-400">Friends who watched this</p>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {friendRatings.map((f) => (
                  <Link
                    key={f.name}
                    href={f.username ? `/user/${f.username}` : "#"}
                    className="flex min-h-11 items-center gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2 transition hover:border-white/10"
                  >
                    <Avatar url={f.avatar_url} name={f.name} size={28} />
                    <div>
                      <p className="text-xs font-medium text-white">{f.name}</p>
                      <p className="text-xs text-indigo-300/80">{f.rating}/10</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          {recentReviews.length > 0 ? (
            <div className="rounded-2xl border border-white/10 bg-zinc-900/30 p-4">
              <p className="mb-3 text-xs font-medium text-zinc-400">Recent reviews</p>
              <div className="space-y-3">
                {recentReviews.map((r, i) => (
                  <div key={`${r.username ?? r.name}-${i}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <Avatar url={r.avatar_url} name={r.name} size={22} />
                      <p className="text-xs text-zinc-200">{r.name}</p>
                      {r.rating != null ? <span className="text-xs text-indigo-300">{r.rating}/10</span> : null}
                    </div>
                    <p className="line-clamp-3 text-sm text-zinc-300">{r.notes}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </article>
  );
}
