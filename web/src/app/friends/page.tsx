import { UserSearch } from "./UserSearch";
import { FollowButton } from "@/components/social/FollowButton";
import { Avatar } from "@/components/ui/Avatar";
import { getFollowers, getFollowing, getSocialActivity } from "@/features/users/service";
import { posterUrl } from "@/lib/tmdb/constants";
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
  const params = await searchParams;
  const activeTab = params.tab === "activity" ? "activity" : "inbox";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/friends");

  const [following, followers, activity] = await Promise.all([
    getFollowing(user.id),
    getFollowers(user.id),
    getSocialActivity(user.id, 18),
  ]);
  const followingIds = new Set(following.map((f) => f.id));

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <header className="mb-8 space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-300/70">
          Social
        </p>
        <h1 className="text-3xl font-semibold text-white">Following</h1>
      </header>

      <div className="mb-6 flex gap-2">
        <Link
          href="/friends?tab=inbox"
          className={`rounded-full px-4 py-1.5 text-sm transition ${
            activeTab === "inbox"
              ? "bg-indigo-500/20 text-indigo-100"
              : "border border-white/10 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Inbox
        </Link>
        <Link
          href="/friends?tab=activity"
          className={`rounded-full px-4 py-1.5 text-sm transition ${
            activeTab === "activity"
              ? "bg-indigo-500/20 text-indigo-100"
              : "border border-white/10 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Activity
        </Link>
      </div>

      <section id="inbox" className="mb-10 scroll-mt-24">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Notifications</h2>
          <span className="rounded-full bg-indigo-400/20 px-2 py-0.5 text-xs text-indigo-300">
            {followers.length}
          </span>
        </div>
        {followers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-zinc-900/30 px-6 py-10 text-center">
            <p className="text-sm text-zinc-400">No notifications yet.</p>
            <p className="mt-1 text-xs text-zinc-500">
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
                  className="flex items-center gap-3 rounded-xl border border-indigo-400/12 bg-zinc-900/40 p-3"
                >
                  <Link href={`/user/${p.username ?? p.id}`}>
                    <Avatar url={p.avatar_url} name={name} size={40} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/user/${p.username ?? p.id}`}
                      className="block truncate text-sm font-medium text-white hover:text-indigo-200"
                    >
                      {name}
                    </Link>
                    <p className="text-xs text-zinc-500">
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
        <h2 className="mb-3 text-sm font-semibold text-white">
          Find People
        </h2>
        <UserSearch />
      </section>

      {/* Following recent activity */}
      <section id="activity" className="mb-10 scroll-mt-24">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
          <span className="text-xs text-zinc-500">
            People you follow
          </span>
        </div>
        {activity.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-zinc-900/30 px-6 py-10 text-center">
            <p className="text-sm text-zinc-400">
              No recent activity yet.
            </p>
            <p className="mt-1 text-xs text-zinc-500">
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
                    href={`/movie/${item.movie.tmdb_id}`}
                    className="group relative block aspect-[2/3] overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-900"
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
                  <div className="mt-2 rounded-lg border border-white/[0.06] bg-zinc-900/50 px-2 py-1.5">
                    <Link
                      href={`/user/${item.user.username ?? item.user.id}`}
                      className="block truncate text-xs font-medium text-zinc-200 hover:text-indigo-200"
                    >
                      {name}
                    </Link>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
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
        <h2 className="mb-3 text-sm font-semibold text-white">
          Following ({following.length})
        </h2>
        {following.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-zinc-900/30 px-6 py-12 text-center">
            <p className="text-sm text-zinc-400">
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
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/40 p-3"
                >
                  <Link href={`/user/${f.username ?? f.id}`}>
                    <Avatar url={f.avatar_url} name={name} size={40} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/user/${f.username ?? f.id}`}
                      className="block truncate text-sm font-medium text-white hover:text-indigo-200"
                    >
                      {name}
                    </Link>
                    {f.username ? (
                      <p className="text-xs text-zinc-500">@{f.username}</p>
                    ) : null}
                    {f.bio ? (
                      <p className="line-clamp-1 text-xs text-zinc-500">
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
