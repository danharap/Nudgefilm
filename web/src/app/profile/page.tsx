import { AvatarUpload } from "./AvatarUpload";
import { EditProfileForm } from "./EditProfileForm";
import { FavouritesPicker } from "./FavouritesPicker";
import { FilmsSection } from "./FilmsSection";
import { ProfileConnections } from "./ProfileConnections";
import { ProfileListsSection } from "./ProfileListsSection";
import { FeedbackForm } from "@/app/feedback/FeedbackForm";
import { getOwnFeedback } from "@/features/feedback/service";
import { posterUrl, TV_TMDB_OFFSET, TV_SEASON_OFFSET } from "@/lib/tmdb/constants";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Genre = { id: number; name: string };

type MovieRow = {
  id: number;
  tmdb_id: number;
  title: string;
  release_year: number | null;
  poster_path: string | null;
  vote_average: number | null;
  vote_count: number | null;
  genres: Genre[] | null;
};

type ListMovieRow = {
  id: number;
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  vote_count: number | null;
};

type ConnectionProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

async function loadProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [
    { data: profile },
    { data: watchedRows },
    { data: watchlistRows },
    { data: favouriteRows },
    { data: friendCount },
    { count: followingCount },
    { count: followersCount },
    { data: listsRows },
    { data: followingRows },
    { data: followersRows },
    ownReview,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "display_name, email, username, bio, avatar_url, banner_url, profile_background_url, is_public, watchlist_public",
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("watched_movies")
      .select(
        "watched_at, user_rating, notes, movies ( id, tmdb_id, title, release_year, poster_path, vote_average, vote_count, genres )",
      )
      .eq("user_id", user.id)
      .order("watched_at", { ascending: false }),
    supabase
      .from("watchlist")
      .select(
        "created_at, movies ( id, tmdb_id, title, release_year, poster_path, vote_average )",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("favourite_movies")
      .select("position, movies ( id, tmdb_id, title, poster_path )")
      .eq("user_id", user.id)
      .order("position", { ascending: true }),
    supabase
      .from("friendships")
      .select("id", { count: "exact" })
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq("status", "accepted"),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", user.id),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", user.id),
    supabase
      .from("profile_lists")
      .select(
        "id, name, emoji, description, is_public, position, profile_list_movies ( position, movies ( id, tmdb_id, title, poster_path, vote_count ) )",
      )
      .eq("user_id", user.id)
      .order("position", { ascending: true }),
    supabase
      .from("follows")
      .select("following_id, profiles!follows_following_id_fkey(id, username, display_name, avatar_url, bio)")
      .eq("follower_id", user.id),
    supabase
      .from("follows")
      .select("follower_id, profiles!follows_follower_id_fkey(id, username, display_name, avatar_url, bio)")
      .eq("following_id", user.id),
    getOwnFeedback(user.id),
  ]);

  const watched = (watchedRows ?? []).flatMap((r) => {
    const m = r.movies as MovieRow | MovieRow[] | null;
    if (!m) return [];
    const movie = Array.isArray(m) ? m[0] : m;
    return movie
      ? [{
          movie,
          watched_at: r.watched_at as string | null,
          user_rating: r.user_rating as number | null,
          notes: r.notes as string | null,
        }]
      : [];
  });

  const rated = watched.filter((w) => w.user_rating != null);
  const avgRating =
    rated.length > 0
      ? rated.reduce((s, w) => s + (w.user_rating ?? 0), 0) / rated.length
      : null;

  const movieCount = watched.filter((w) => w.movie.tmdb_id < TV_TMDB_OFFSET).length;
  // Count whole-show entries + individual season entries both toward "Series"
  const showCount = watched.filter((w) => w.movie.tmdb_id >= TV_TMDB_OFFSET).length;

  const watchlist = (watchlistRows ?? []).flatMap((r) => {
    const m = r.movies as MovieRow | MovieRow[] | null;
    if (!m) return [];
    const movie = Array.isArray(m) ? m[0] : m;
    return movie ? [{ movie }] : [];
  });

  type FavRow = {
    position: number;
    movies: { id: number; tmdb_id: number; title: string; poster_path: string | null } | null;
  };
  const favouriteSlots = [1, 2, 3, 4].map((pos) => {
    const row = (favouriteRows as FavRow[] | null)?.find((r) => r.position === pos);
    const m = row?.movies;
    return {
      position: pos as 1 | 2 | 3 | 4,
      tmdb_id: m?.tmdb_id ?? null,
      title: m?.title ?? null,
      poster_path: m?.poster_path ?? null,
    };
  });

  // Profile lists with their movies
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

  const profileLists = (listsRows as ListRaw[] ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    emoji: l.emoji,
    description: l.description,
    is_public: l.is_public,
    position: l.position,
    movies: (l.profile_list_movies ?? []).flatMap((pm) => {
      const m = pm.movies as ListMovieRow | ListMovieRow[] | null;
      if (!m) return [];
      const movie = Array.isArray(m) ? m[0] : m;
      return movie ? [{ movie, position: pm.position }] : [];
    }),
  }));

  const followingProfiles = (followingRows ?? []).flatMap((r) => {
    const p = r.profiles as ConnectionProfile | ConnectionProfile[] | null;
    if (!p) return [];
    return [Array.isArray(p) ? p[0] : p];
  });
  const followerProfiles = (followersRows ?? []).flatMap((r) => {
    const p = r.profiles as ConnectionProfile | ConnectionProfile[] | null;
    if (!p) return [];
    return [Array.isArray(p) ? p[0] : p];
  });

  return {
    user,
    profile: profile ?? null,
    watched,
    watchlist,
    favouriteSlots,
    profileLists,
    ownReview,
    stats: {
      totalWatched: watched.length,
      movieCount,
      showCount,
      avgRating,
      following: followingCount ?? 0,
      followers: followersCount ?? 0,
    },
    connections: {
      followers: followerProfiles,
      following: followingProfiles,
    },
    friendCount: friendCount?.length ?? 0,
  };
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ connections?: string }>;
}) {
  const q = await searchParams;
  const data = await loadProfile();

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold text-white">Your Profile</h1>
        <p className="mt-4 text-sm text-zinc-400">
          <Link href="/login" className="text-indigo-300 underline underline-offset-2 hover:text-indigo-200">
            Sign in
          </Link>{" "}
          to view and manage your profile.
        </p>
      </div>
    );
  }

  const { user, profile, watched, watchlist, favouriteSlots, profileLists, ownReview, stats } = data;
  const initialConnectionsTab =
    q.connections === "following" ? "following" : "followers";

  const displayName =
    (profile?.display_name as string | null)?.trim() ||
    (profile?.email as string | null)?.split("@")[0] ||
    "Film fan";

  const username = (profile?.username as string | null) ?? null;
  const bio = (profile?.bio as string | null) ?? null;
  const avatarUrl = (profile?.avatar_url as string | null) ?? null;
  const isPublic = (profile?.is_public as boolean) ?? true;
  const watchlistPublic = (profile?.watchlist_public as boolean) ?? true;
  const bannerUrl = (profile?.banner_url as string | null) ?? null;
  const profileBackgroundUrl = (profile?.profile_background_url as string | null) ?? null;

  const recent = watched.slice(0, 6);

  return (
    <div className="relative isolate min-h-screen">
      {/* Optional full-page backdrop */}
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
      {/* ── Banner: edge-to-edge on mobile (Pinterest-style); card layout sm+ ── */}
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
        <AvatarUpload userId={user.id} currentUrl={avatarUrl} displayName={displayName} />

        <div className="flex-1 space-y-3 text-center sm:text-left">
          <div>
            <h1 className="text-2xl font-bold text-white">{displayName}</h1>
            {username ? (
              <p className="text-sm text-zinc-500">@{username}</p>
            ) : (
              <p className="text-xs text-indigo-300/50">Set a username to make your profile discoverable</p>
            )}
          </div>
          {bio ? (
            <p className="max-w-md text-sm leading-relaxed text-zinc-400">{bio}</p>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-zinc-500 sm:justify-start">
            <Link href="/profile?connections=following#connections" className="hover:text-zinc-300">
              <span className="font-semibold text-white">{stats.following}</span> following
            </Link>
            <Link href="/profile?connections=followers#connections" className="hover:text-zinc-300">
              <span className="font-semibold text-white">{stats.followers}</span> followers
            </Link>
            <Link href="/friends" className="hover:text-zinc-300">
              <span className="font-semibold text-white">{data.friendCount}</span> friends
            </Link>
            {!isPublic ? (
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-zinc-600">
                Private
              </span>
            ) : null}
          </div>
          <EditProfileForm
            userId={user.id}
            username={username}
            displayName={displayName}
            bio={bio}
            isPublic={isPublic}
            watchlistPublic={watchlistPublic}
            bannerUrl={bannerUrl}
            profileBackgroundUrl={profileBackgroundUrl}
          />
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="mb-10 grid grid-cols-3 gap-3">
        {[
          { label: "Films", value: stats.movieCount },
          { label: "Series", value: stats.showCount },
          { label: "Avg Rating", value: stats.avgRating != null ? `${stats.avgRating.toFixed(1)}` : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-white/[0.07] bg-zinc-900/40 px-4 py-5 text-center">
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="mt-1 text-xs text-zinc-500">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Followers / Following ── */}
      <ProfileConnections
        followers={data.connections.followers}
        following={data.connections.following}
        initialTab={initialConnectionsTab}
      />

      {/* ── Top 4 Favourites ── */}
      <section className="mb-12">
        <h2 className="mb-1 text-lg font-semibold text-white">Top 4 Favourites</h2>
        <p className="mb-4 text-xs text-zinc-500">Click a slot to pick or change a favourite film.</p>
        <FavouritesPicker slots={favouriteSlots} />
      </section>

      {/* ── Recently Watched (quick 6-poster row) ── */}
      {recent.length > 0 ? (
        <section className="mb-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Recently Watched</h2>
            {watched.length > 6 ? (
              <Link href="/watched" className="text-xs text-indigo-300/70 transition hover:text-indigo-200">
                View diary →
              </Link>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {recent.map(({ movie, user_rating }) => {
              const poster = posterUrl(movie.poster_path, "w342");
              const href =
                movie.tmdb_id >= TV_SEASON_OFFSET
                  ? movie.vote_count != null
                    ? `/show/${movie.vote_count}`
                    : "/browse?type=tv"
                  : movie.tmdb_id >= TV_TMDB_OFFSET
                    ? `/show/${movie.tmdb_id - TV_TMDB_OFFSET}`
                    : `/movie/${movie.tmdb_id}`;
              return (
                <div key={movie.id} className="group relative">
                  <Link
                    href={href}
                    className="relative block aspect-[2/3] overflow-hidden rounded-xl bg-zinc-800 ring-0 transition hover:ring-1 hover:ring-indigo-400/30"
                  >
                    {poster ? (
                      <Image
                        src={poster}
                        alt={movie.title}
                        fill
                        className="object-cover transition duration-300 group-hover:scale-[1.04]"
                        sizes="(max-width:640px) 33vw, 120px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-1">
                        <span className="line-clamp-3 text-center text-[9px] text-zinc-500">{movie.title}</span>
                      </div>
                    )}
                  </Link>
                  {user_rating != null ? (
                    <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-200 ring-1 ring-white/10">
                      {user_rating}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ── Films (sortable + genre-filterable grid) ── */}
      <FilmsSection films={watched} />

      {/* ── My Lists ── */}
      <ProfileListsSection
        initialLists={profileLists}
        watched={watched.map((w) => ({ movie: { id: w.movie.id, tmdb_id: w.movie.tmdb_id, title: w.movie.title, poster_path: w.movie.poster_path } }))}
      />

      {/* ── Watchlist ── */}
      <section className="mb-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Watchlist{" "}
            <span className="text-sm font-normal text-zinc-500">({watchlist.length})</span>
          </h2>
          {watchlist.length > 0 ? (
            <Link href="/watchlist" className="text-xs text-indigo-300/70 transition hover:text-indigo-200">
              Manage →
            </Link>
          ) : null}
        </div>
        {watchlist.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-900/30 px-6 py-12 text-center">
            <p className="text-sm text-zinc-400">Nothing queued up.</p>
            <Link href="/browse" className="mt-4 inline-block text-sm font-medium text-indigo-300 transition hover:text-indigo-200">
              Browse films →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {watchlist.slice(0, 12).map(({ movie }) => {
              const poster = posterUrl(movie.poster_path, "w342");
              const wHref = movie.tmdb_id >= TV_TMDB_OFFSET
                ? `/show/${movie.tmdb_id - TV_TMDB_OFFSET}`
                : `/movie/${movie.tmdb_id}`;
              return (
                <Link
                  key={movie.id}
                  href={wHref}
                  className="group relative block aspect-[2/3] overflow-hidden rounded-xl bg-zinc-800 ring-0 transition hover:ring-1 hover:ring-indigo-400/30"
                >
                  {poster ? (
                    <Image
                      src={poster}
                      alt={movie.title}
                      fill
                      className="object-cover transition duration-300 group-hover:scale-[1.04]"
                      sizes="(max-width:640px) 33vw, 120px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center p-1">
                      <span className="line-clamp-3 text-center text-[9px] text-zinc-500">{movie.title}</span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Rate This App ── */}
      <section className="rounded-2xl border border-white/10 bg-zinc-900/30 p-6">
        <div className="mb-4 space-y-1">
          <h2 className="text-base font-semibold text-white">Rate Nudge Film</h2>
          <p className="text-xs text-zinc-500">
            Share what you think of the app — not a movie review.{" "}
            <Link href="/feedback" className="text-indigo-300/70 hover:text-indigo-200">
              Read all reviews →
            </Link>
          </p>
        </div>
        <FeedbackForm existing={ownReview} compact />
      </section>
      </div>
      </div>
    </div>
  );
}
