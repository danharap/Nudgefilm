import { createClient } from "@/lib/supabase/server";

export type PublicProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  profile_background_url: string | null;
  is_public: boolean;
  watchlist_public: boolean;
};

export type FollowStatus = "none" | "following";
// Legacy friend-request status type kept for compatibility with old components.
export type FriendshipStatus =
  | "none"
  | "pending_sent"
  | "pending_received"
  | "accepted";

export type SocialActivityItem = {
  watched_at: string | null;
  user_rating: number | null;
  movie: {
    tmdb_id: number;
    title: string;
    poster_path: string | null;
  } | null;
  user: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

/** Search profiles by username prefix (includes private accounts so users are discoverable; full profile visibility stays gated on the profile page). */
export async function searchUsers(
  query: string,
  currentUserId?: string,
): Promise<(PublicProfile & { followStatus: FollowStatus })[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, username, display_name, bio, avatar_url, banner_url, profile_background_url, is_public, watchlist_public",
      )
      .ilike("username", `${q}%`)
      .neq("id", currentUserId ?? "00000000-0000-0000-0000-000000000000")
      .limit(20);

    if (error) {
      console.error("[users] searchUsers:", error.code, error.message);
      return [];
    }

    const profiles = (data ?? []) as PublicProfile[];
    if (!currentUserId || profiles.length === 0) {
      return profiles.map((p) => ({ ...p, followStatus: "none" as FollowStatus }));
    }

    // Batch-fetch follow statuses
    const ids = profiles.map((p) => p.id);
    const { data: follows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", currentUserId)
      .in("following_id", ids);
    const followingIds = new Set((follows ?? []).map((f) => f.following_id as string));

    return profiles.map((p) => ({
      ...p,
      followStatus: followingIds.has(p.id) ? "following" : "none",
    }));
  } catch (e) {
    console.error("[users] searchUsers unexpected:", e);
    return [];
  }
}

/** Load a public profile by username */
export async function getProfileByUsername(
  username: string,
): Promise<PublicProfile | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select(
        "id, username, display_name, bio, avatar_url, banner_url, profile_background_url, is_public, watchlist_public",
      )
      .eq("username", username.toLowerCase())
      .maybeSingle();
    return (data as PublicProfile | null) ?? null;
  } catch {
    return null;
  }
}

/** Is current user following target profile */
export async function getFollowStatus(
  currentUserId: string,
  targetId: string,
): Promise<FollowStatus> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", currentUserId)
      .eq("following_id", targetId)
      .maybeSingle();
    return data ? "following" : "none";
  } catch {
    return "none";
  }
}

/** Profiles the user follows */
export async function getFollowing(userId: string): Promise<PublicProfile[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId);

    if (!data || data.length === 0) return [];
    const followingIds = data.map((f) => f.following_id);

    const { data: profiles } = await supabase
      .from("profiles")
      .select(
        "id, username, display_name, bio, avatar_url, banner_url, profile_background_url, is_public, watchlist_public",
      )
      .in("id", followingIds);

    return (profiles ?? []) as PublicProfile[];
  } catch (e) {
    console.error("[users] getFollowing:", e);
    return [];
  }
}

/** Users following this account (used as inbox/notifications feed) */
export async function getFollowers(userId: string): Promise<PublicProfile[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", userId);
    if (!data || data.length === 0) return [];
    const followerIds = data.map((f) => f.follower_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select(
        "id, username, display_name, bio, avatar_url, banner_url, profile_background_url, is_public, watchlist_public",
      )
      .in("id", followerIds);
    return (profiles ?? []) as PublicProfile[];
  } catch (e) {
    console.error("[users] getFollowers:", e);
    return [];
  }
}

/** Recent watched activity from people you follow */
export async function getSocialActivity(
  userId: string,
  limit = 24,
): Promise<SocialActivityItem[]> {
  try {
    const supabase = await createClient();
    const { data: follows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId);
    const ids = (follows ?? []).map((f) => f.following_id as string);
    if (ids.length === 0) return [];

    const { data: rows, error } = await supabase
      .from("watched_movies")
      .select(
        "watched_at, user_rating, user_id, movies!watched_movies_movie_id_fkey(tmdb_id, title, poster_path), profiles!watched_movies_user_id_fkey(id, username, display_name, avatar_url)",
      )
      .in("user_id", ids)
      .order("watched_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[users] getSocialActivity:", error.code, error.message);
      return [];
    }

    return (rows ?? []).map((r) => {
      const movieRaw = r.movies as
        | { tmdb_id: number; title: string; poster_path: string | null }
        | { tmdb_id: number; title: string; poster_path: string | null }[]
        | null;
      const movie = Array.isArray(movieRaw) ? movieRaw[0] : movieRaw;

      const userRaw = r.profiles as
        | { id: string; username: string | null; display_name: string | null; avatar_url: string | null }
        | { id: string; username: string | null; display_name: string | null; avatar_url: string | null }[]
        | null;
      const actor = Array.isArray(userRaw) ? userRaw[0] : userRaw;

      return {
        watched_at: r.watched_at as string | null,
        user_rating: r.user_rating as number | null,
        movie: movie
          ? {
              tmdb_id: movie.tmdb_id,
              title: movie.title,
              poster_path: movie.poster_path,
            }
          : null,
        user: actor
          ? {
              id: actor.id,
              username: actor.username,
              display_name: actor.display_name,
              avatar_url: actor.avatar_url,
            }
          : null,
      };
    });
  } catch (e) {
    console.error("[users] getSocialActivity unexpected:", e);
    return [];
  }
}
