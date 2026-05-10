import { MarkSocialInboxSeen } from "./MarkSocialInboxSeen";
import { UserSearch } from "./UserSearch";
import { FollowButton } from "@/components/social/FollowButton";
import { Avatar } from "@/components/ui/Avatar";
import { getFollowers, getFollowing, getSocialActivity } from "@/features/users/service";
import { detailHrefFromStoredMovie, posterUrl } from "@/lib/tmdb/constants";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/friends");

  const { data: inboxProfile } = await supabase
    .from("profiles")
    .select("social_inbox_last_read_at")
    .eq("id", user.id)
    .maybeSingle();
  const inboxLastRead = (inboxProfile?.social_inbox_last_read_at as string | null | undefined) ?? null;
  let unreadFollowsQuery = supabase
    .from("follows")
    .select("follower_id", { count: "exact", head: true })
    .eq("following_id", user.id);
  if (inboxLastRead) {
    unreadFollowsQuery = unreadFollowsQuery.gt("created_at", inboxLastRead);
  }
  const { count: unreadFollowCount } = await unreadFollowsQuery;

  const [following, followers, activity] = await Promise.all([
    getFollowing(user.id),
    getFollowers(user.id),
    getSocialActivity(user.id, 18),
  ]);
  const followingIds = new Set(following.map((f) => f.id));

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <MarkSocialInboxSeen />
      <header className="mb-8 space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-500/75">
          Social
        </p>
        <h1 className="text-3xl font-semibold text-primary">Following</h1>
      </header>

      <section id="inbox" className="mb-10 scroll-mt-24">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-primary">Notifications</h2>
          <span className="rounded-full bg-indigo-400/20 px-2 py-0.5 text-xs text-indigo-500">
            {unreadFollowCount ?? 0}
          </span>
        </div>
        {followers.length === 0 ? (
          <div className="surface-card-subtle rounded-2xl border border-dashed px-6 py-10 text-center">
            <p className="text-sm text-secondary">No notifications yet.</p>
            <p className="mt-1 text-xs text-tertiary">
              New followers will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {followers.map((p) => {
              const name = p.display_name?.trim() || p.username || "User";
              return (
                <li
                  key={p.id}
                  className="surface-card-subtle flex items-center gap-3 rounded-xl p-3"
                >
                  <Link href={`/user/${p.username ?? p.id}`}>
                    <Avatar url={p.avatar_url} name={name} size={40} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/user/${p.username ?? p.id}`}
                      className="block truncate text-sm font-medium text-primary hover:text-indigo-500"
                    >
                      {name}
                    </Link>
                    <p className="text-xs text-tertiary">
                      {p.username ? `@${p.username} ` : ""}followed you
                    </p>
                  </div>
                  <FollowButton targetId={p.id} initialFollowing={followingIds.has(p.id)} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Search */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold text-primary">
          Find People
        </h2>
        <UserSearch />
      </section>

      {/* Following recent activity */}
      <section id="activity" className="mb-10 scroll-mt-24">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-primary">Recent Activity</h2>
          <span className="text-xs text-tertiary">
            People you follow
          </span>
        </div>
        {activity.length === 0 ? (
          <div className="surface-card-subtle rounded-2xl border border-dashed px-6 py-10 text-center">
            <p className="text-sm text-secondary">
              No recent activity yet.
            </p>
            <p className="mt-1 text-xs text-tertiary">
              Once people you follow log movies, you&apos;ll see their latest watches here.
            </p>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {activity.map((item, i) => {
              if (!item.movie || !item.user) return null;
              const name = item.user.display_name?.trim() || item.user.username || "Friend";
              const poster = posterUrl(item.movie.poster_path, "w342");
              const watchedDate = item.watched_at
                ? new Date(item.watched_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "2-digit",
                  })
                : null;

              return (
                <article
                  key={`${item.user.id}-${item.movie.tmdb_id}-${item.watched_at ?? i}`}
                  className="fade-up w-36 shrink-0"
                  style={{ animationDelay: `${Math.min(i * 0.03, 0.2)}s` }}
                >
                  <Link
                    href={detailHrefFromStoredMovie({
                      tmdb_id: item.movie.tmdb_id,
                      title: item.movie.title,
                    })}
                    className="group relative block aspect-[2/3] overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[var(--surface-1)]"
                  >
                    {poster ? (
                      <Image
                        src={poster}
                        alt={item.movie.title}
                        fill
                        className="object-cover transition duration-300 group-hover:scale-[1.03]"
                        sizes="144px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-2 text-center text-[11px] text-zinc-500">
                        {item.movie.title}
                      </div>
                    )}
                  </Link>
                  <div className="mt-2 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-2)] px-2 py-1.5">
                    <Link
                      href={`/user/${item.user.username ?? item.user.id}`}
                      className="block truncate text-xs font-medium text-secondary hover:text-indigo-500"
                    >
                      {name}
                    </Link>
                    <p className="mt-0.5 text-[11px] text-tertiary">
                      {item.user_rating != null ? `${item.user_rating}/10` : "Logged"}
                      {watchedDate ? ` · ${watchedDate}` : ""}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Following list */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-primary">
          Following ({following.length})
        </h2>
        {following.length === 0 ? (
          <div className="surface-card-subtle rounded-2xl border border-dashed px-6 py-12 text-center">
            <p className="text-sm text-secondary">
              You&apos;re not following anyone yet — search for people above.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {following.map((f) => {
              const name = f.display_name?.trim() || f.username || "User";
              return (
                <li
                  key={f.id}
                  className="surface-card-subtle flex items-center gap-3 rounded-xl p-3"
                >
                  <Link href={`/user/${f.username ?? f.id}`}>
                    <Avatar url={f.avatar_url} name={name} size={40} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/user/${f.username ?? f.id}`}
                      className="block truncate text-sm font-medium text-primary hover:text-indigo-500"
                    >
                      {name}
                    </Link>
                    {f.username ? (
                      <p className="text-xs text-tertiary">@{f.username}</p>
                    ) : null}
                    {f.bio ? (
                      <p className="line-clamp-1 text-xs text-tertiary">
                        {f.bio}
                      </p>
                    ) : null}
                  </div>
                  <FollowButton targetId={f.id} initialFollowing />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
