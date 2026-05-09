import { FollowButton } from "@/components/social/FollowButton";
import { Avatar } from "@/components/ui/Avatar";
import {
  countMutualFriendsForProfile,
  getFollowStatus,
  type PublicProfile,
} from "@/features/users/service";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export async function PrivateProfileView({
  target,
  currentUserId,
}: {
  target: PublicProfile;
  currentUserId: string | null;
}) {
  const supabase = await createClient();
  const [
    followStatus,
    isFollowingResult,
    { count: followingCount },
    { count: followersCount },
  ] = await Promise.all([
    currentUserId ? getFollowStatus(currentUserId, target.id) : Promise.resolve("none" as const),
    currentUserId
      ? supabase
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("follower_id", currentUserId)
          .eq("following_id", target.id)
      : Promise.resolve({ count: 0 }),
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
  const mutualFriendsCount = await countMutualFriendsForProfile(supabase, target.id);
  const displayName = target.display_name?.trim() || target.username || "Film fan";
  const slug = target.username ?? "";
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

        <div className="px-4 pb-12 pt-6 sm:px-6">
          <div className="mb-10 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <Avatar url={target.avatar_url} name={displayName} size={80} />

            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div>
                <h1 className="text-2xl font-bold text-white">{displayName}</h1>
                {target.username ? (
                  <p className="text-sm text-zinc-500">@{target.username}</p>
                ) : null}
              </div>

              <p className="max-w-md text-sm text-zinc-400">
                This account is private. Follow to see their activity when they share it publicly.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-zinc-500 sm:justify-start">
                {slug ? (
                  <>
                    <Link
                      href={`/user/${slug}/following`}
                      className="hover:text-zinc-300"
                    >
                      <span className="font-semibold text-white">{followingCount ?? 0}</span>{" "}
                      following
                    </Link>
                    <Link
                      href={`/user/${slug}/followers`}
                      className="hover:text-zinc-300"
                    >
                      <span className="font-semibold text-white">{followersCount ?? 0}</span>{" "}
                      followers
                    </Link>
                    <span>
                      <span className="font-semibold text-white">{mutualFriendsCount}</span> friends
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      <span className="font-semibold text-white">{followingCount ?? 0}</span>{" "}
                      following
                    </span>
                    <span>
                      <span className="font-semibold text-white">{followersCount ?? 0}</span>{" "}
                      followers
                    </span>
                    <span>
                      <span className="font-semibold text-white">{mutualFriendsCount}</span> friends
                    </span>
                  </>
                )}
              </div>

              {currentUserId ? (
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <FollowButton
                    targetId={target.id}
                    initialFollowing={followStatus === "following" || isFollowing}
                  />
                </div>
              ) : (
                <Link
                  href="/login"
                  className="inline-block rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs text-zinc-300 hover:text-white"
                >
                  Sign in to follow
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
