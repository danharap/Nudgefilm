import { UserSearch } from "./UserSearch";
import { FriendButton } from "@/components/social/FriendButton";
import { Avatar } from "@/components/ui/Avatar";
import { getFriends, getPendingRequests, getSocialActivity } from "@/features/users/service";
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

  const [friends, pending, activity] = await Promise.all([
    getFriends(user.id),
    getPendingRequests(user.id),
    getSocialActivity(user.id, 18),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <header className="mb-8 space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-300/70">
          Social
        </p>
        <h1 className="text-3xl font-semibold text-white">Friends</h1>
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

      {/* Pending requests */}
      {pending.length > 0 ? (
        <section id="inbox" className="mb-10 scroll-mt-24">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            Friend Requests
            <span className="rounded-full bg-indigo-400/20 px-2 py-0.5 text-xs text-indigo-300">
              {pending.length}
            </span>
          </h2>
          <ul className="space-y-2">
            {pending.map((p) => {
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
                    {p.username ? (
                      <p className="text-xs text-zinc-500">@{p.username}</p>
                    ) : null}
                  </div>
                  <FriendButton
                    targetId={p.requesterId}
                    initial="pending_received"
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Search */}
      <section id="activity" className="mb-10 scroll-mt-24">
        <h2 className="mb-3 text-sm font-semibold text-white">
          Find People
        </h2>
        <UserSearch />
      </section>

      {/* Friends / Following recent activity */}
      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
          <span className="text-xs text-zinc-500">
            Friends + people you follow
          </span>
        </div>
        {activity.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-zinc-900/30 px-6 py-10 text-center">
            <p className="text-sm text-zinc-400">
              No recent activity yet.
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Once friends log movies, you&apos;ll see their latest watches here.
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

      {/* Friends list */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-white">
          Your Friends ({friends.length})
        </h2>
        {friends.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-zinc-900/30 px-6 py-12 text-center">
            <p className="text-sm text-zinc-400">
              No friends yet — search for people above.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {friends.map((f) => {
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
                  <FriendButton targetId={f.id} initial="accepted" />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
