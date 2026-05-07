import { FollowButton } from "@/components/social/FollowButton";
import { Avatar } from "@/components/ui/Avatar";
import { getFollowStatus, getProfileByUsername } from "@/features/users/service";
import { posterUrl } from "@/lib/tmdb/constants";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type MovieRow = {
  id: number;
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  vote_average: number | null;
};

type FavRow = {
  position: number;
  movies: { id: number; tmdb_id: number; title: string; poster_path: string | null } | null;
};

type ListMovieRow = {
  id: number;
  tmdb_id: number;
  title: string;
  poster_path: string | null;
};

type ListRaw = {
  id: string;
  name: string;
  emoji: string | null;
  description: string | null;
  is_public: boolean;
  position: number;
  profile_list_movies: Array<{
    position: number;
    movies: ListMovieRow | ListMovieRow[] | null;
  }>;
};

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const target = await getProfileByUsername(username);

  if (!target || !target.is_public) notFound();

  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  const isSelf = currentUser?.id === target.id;

  if (isSelf) {
    const { redirect } = await import("next/navigation");
    redirect("/profile");
  }

  const [
    followStatus,
    isFollowingResult,
    { data: watchedRows },
    { data: favouriteRows },
    { data: watchlistRows },
    { data: listsRows },
    { count: followingCount },
    { count: followersCount },
  ] = await Promise.all([
    currentUser
      ? getFollowStatus(currentUser.id, target.id)
      : Promise.resolve("none" as const),
    // Is the current user following this profile?
    currentUser
      ? supabase
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("follower_id", currentUser.id)
          .eq("following_id", target.id)
      : Promise.resolve({ count: 0 }),
    supabase
      .from("watched_movies")
      .select("user_rating, movies ( id, tmdb_id, title, poster_path, vote_average )")
      .eq("user_id", target.id)
      .order("watched_at", { ascending: false })
      .limit(48),
    supabase
      .from("favourite_movies")
      .select("position, movies ( id, tmdb_id, title, poster_path )")
      .eq("user_id", target.id)
      .order("position"),
    target.watchlist_public
      ? supabase
          .from("watchlist")
          .select("movies ( id, tmdb_id, title, poster_path )")
          .eq("user_id", target.id)
          .order("created_at", { ascending: false })
          .limit(12)
      : Promise.resolve({ data: null }),
    supabase
      .from("profile_lists")
      .select(
        "id, name, emoji, description, is_public, position, profile_list_movies ( position, movies ( id, tmdb_id, title, poster_path ) )",
      )
      .eq("user_id", target.id)
      .eq("is_public", true)
      .order("position", { ascending: true }),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", target.id),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", target.id),
  ]);

  const isFollowing = (isFollowingResult as { count: number | null }).count === 1;

  const watched = (watchedRows ?? []).flatMap((r) => {
    const m = r.movies as MovieRow | MovieRow[] | null;
    if (!m) return [];
    const movie = Array.isArray(m) ? m[0] : m;
    return movie ? [{ movie, user_rating: r.user_rating as number | null }] : [];
  });

  const favourites = [1, 2, 3, 4].map((pos) => {
    const row = (favouriteRows as FavRow[] | null)?.find((r) => r.position === pos);
    return { position: pos, movie: row?.movies ?? null };
  });

  const watchlist = target.watchlist_public
    ? (watchlistRows ?? []).flatMap((r) => {
        const m = r.movies as MovieRow | MovieRow[] | null;
        if (!m) return [];
        const movie = Array.isArray(m) ? m[0] : m;
        return movie ? [movie] : [];
      })
    : [];

  const rated = watched.filter((w) => w.user_rating != null);
  const avgRating =
    rated.length > 0
      ? rated.reduce((sum, w) => sum + (w.user_rating ?? 0), 0) / rated.length
      : null;

  const profileLists = (listsRows as ListRaw[] ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    emoji: l.emoji,
    description: l.description,
    movies: (l.profile_list_movies ?? []).flatMap((pm) => {
      const m = pm.movies as ListMovieRow | ListMovieRow[] | null;
      if (!m) return [];
      const movie = Array.isArray(m) ? m[0] : m;
      return movie ? [{ movie, position: pm.position }] : [];
    }),
  }));

  const displayName = target.display_name?.trim() || target.username || "Film fan";
  const bannerUrl = target.banner_url ?? null;
  const profileBackgroundUrl = target.profile_background_url ?? null;

  return (
    <div className="relative isolate min-h-screen">
      {profileBackgroundUrl ? (
        <>
          <div
            aria-hidden
            className="fixed inset-0 -z-20 bg-zinc-950 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${profileBackgroundUrl})` }}
          />
          <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-zinc-950/55 via-zinc-950/78 to-zinc-950/[0.94]" />
        </>
      ) : null}

      <div className="relative z-10 mx-auto w-full max-w-4xl">
      <div className="px-4 pt-4 sm:px-6 sm:pt-8">
        <Link
          href="/friends"
          className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/25 hover:text-white"
        >
          ← Back to Social
        </Link>
      </div>
      {bannerUrl ? (
        <div className="relative mb-5 aspect-[8/3] w-full overflow-hidden bg-zinc-900 sm:mx-6 sm:mb-8 sm:mt-12 sm:rounded-2xl sm:border sm:border-white/[0.08] sm:shadow-lg sm:shadow-black/40">
          <Image
            src={bannerUrl}
            alt=""
            fill
            className="object-cover object-center"
            priority
            sizes="100vw"
            unoptimized
          />
        </div>
      ) : null}

      <div
        className={
          bannerUrl
            ? "px-4 pb-12 pt-6 sm:px-6 sm:pt-0"
            : "px-4 py-12 sm:px-6"
        }
      >
      {/* ── Header ── */}
      <div className="mb-10 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <Avatar url={target.avatar_url} name={displayName} size={80} />

        <div className="flex-1 space-y-3 text-center sm:text-left">
          <div>
            <h1 className="text-2xl font-bold text-white">{displayName}</h1>
            {target.username ? (
              <p className="text-sm text-zinc-500">@{target.username}</p>
            ) : null}
          </div>
          {target.bio ? (
            <p className="max-w-md text-sm leading-relaxed text-zinc-400">{target.bio}</p>
          ) : null}

          {/* Inline stats */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-zinc-500 sm:justify-start">
            <span>
              <span className="font-semibold text-white">{followingCount ?? 0}</span> following
            </span>
            <span>
              <span className="font-semibold text-white">{followersCount ?? 0}</span> followers
            </span>
            <span>
              <span className="font-semibold text-white">{watched.length}</span> films
            </span>
          </div>

          {/* Social actions */}
          {currentUser && !isSelf ? (
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <FollowButton targetId={target.id} initialFollowing={followStatus === "following" || isFollowing} />
            </div>
          ) : !currentUser ? (
            <Link
              href="/login"
              className="inline-block rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs text-zinc-300 hover:text-white"
            >
              Sign in to follow
            </Link>
          ) : null}
        </div>
      </div>

      {/* ── Stats ── */}
      {(watched.length > 0 || profileLists.length > 0) && (
        <div className="mb-10 grid grid-cols-3 gap-3">
          {[
            { label: "Films", value: watched.length },
            { label: "Lists", value: profileLists.length },
            { label: "Avg Rating", value: avgRating != null ? avgRating.toFixed(1) : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-zinc-900/40 px-4 py-5 text-center">
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="mt-1 text-xs text-zinc-500">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Top 4 Favourites ── */}
      {favourites.some((f) => f.movie) ? (
        <section className="mb-12">
          <h2 className="mb-4 text-lg font-semibold text-white">Top 4 Favourites</h2>
          <div className="grid grid-cols-4 gap-3">
            {favourites.map(({ position, movie }) => {
              const poster = movie ? posterUrl(movie.poster_path, "w342") : null;
              return (
                <div key={position}>
                  {movie ? (
                    <Link
                      href={`/movie/${movie.tmdb_id}`}
                      className="group relative block aspect-[2/3] overflow-hidden rounded-xl bg-zinc-800"
                    >
                      {poster ? (
                        <Image
                          src={poster}
                          alt={movie.title}
                          fill
                          className="object-cover transition group-hover:scale-[1.03]"
                          sizes="(max-width:640px) 25vw, 120px"
                        />
                      ) : null}
                    </Link>
                  ) : (
                    <div className="aspect-[2/3] rounded-xl bg-zinc-800/40" />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ── Public Lists ── */}
      {profileLists.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 text-lg font-semibold text-white">Lists</h2>
          <div className="space-y-4">
            {profileLists.map((list) => (
              <div key={list.id} className="rounded-2xl border border-white/8 bg-zinc-900/40 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-lg">{list.emoji ?? "🎬"}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{list.name}</p>
                    {list.description ? (
                      <p className="text-xs text-zinc-500">{list.description}</p>
                    ) : null}
                  </div>
                  <span className="ml-auto text-xs text-zinc-600">
                    {list.movies.length} film{list.movies.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {list.movies.length > 0 && (
                  <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                    {list.movies
                      .slice()
                      .sort((a, b) => a.position - b.position)
                      .slice(0, 16)
                      .map(({ movie }) => {
                        const poster = posterUrl(movie.poster_path, "w342");
                        return (
                          <Link
                            key={movie.id}
                            href={`/movie/${movie.tmdb_id}`}
                            title={movie.title}
                            className="group relative block aspect-[2/3] overflow-hidden rounded-lg bg-zinc-800"
                          >
                            {poster ? (
                              <Image
                                src={poster}
                                alt={movie.title}
                                fill
                                className="object-cover transition group-hover:scale-[1.03]"
                                sizes="(max-width:640px) 16vw, 10vw"
                              />
                            ) : null}
                          </Link>
                        );
                      })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Recent Watched ── */}
      {watched.length > 0 ? (
        <section className="mb-12">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Films <span className="text-sm font-normal text-zinc-500">({watched.length})</span>
          </h2>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
            {watched.map(({ movie, user_rating }) => {
              const poster = posterUrl(movie.poster_path, "w342");
              return (
                <div key={movie.id} className="group relative">
                  <Link
                    href={`/movie/${movie.tmdb_id}`}
                    title={movie.title}
                    className="relative block aspect-[2/3] overflow-hidden rounded-lg bg-zinc-800"
                  >
                    {poster ? (
                      <Image
                        src={poster}
                        alt={movie.title}
                        fill
                        className="object-cover transition group-hover:scale-[1.03]"
                        sizes="(max-width:640px) 25vw, 12vw"
                      />
                    ) : null}
                  </Link>
                  {user_rating != null ? (
                    <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[9px] font-semibold text-indigo-300 ring-1 ring-white/10">
                      {user_rating}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="mb-12">
          <h2 className="mb-4 text-lg font-semibold text-white">Films</h2>
          <p className="text-sm text-zinc-500">No films logged yet.</p>
        </section>
      )}

      {/* ── Watchlist (if public) ── */}
      {target.watchlist_public && watchlist.length > 0 ? (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">
            Watchlist ({watchlist.length})
          </h2>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {watchlist.map((movie) => {
              const poster = posterUrl(movie.poster_path, "w342");
              return (
                <Link
                  key={movie.id}
                  href={`/movie/${movie.tmdb_id}`}
                  className="group relative block aspect-[2/3] overflow-hidden rounded-lg bg-zinc-800"
                >
                  {poster ? (
                    <Image
                      src={poster}
                      alt={movie.title}
                      fill
                      className="object-cover transition group-hover:scale-[1.03]"
                      sizes="(max-width:640px) 25vw, 12vw"
                    />
                  ) : null}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
      </div>
      </div>
    </div>
  );
}
