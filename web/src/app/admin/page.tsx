import {
  getDashboardStats,
  getRecentActivity,
  getRecentSignups,
} from "@/app/actions/admin";
import Link from "next/link";

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent
          ? "border-indigo-400/20 bg-indigo-400/5"
          : "border-white/[0.06] bg-zinc-900/50"
      }`}
    >
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs font-medium text-zinc-400">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-600">{sub}</p>}
    </div>
  );
}

const HEARD_FROM_SHORT: Record<string, string> = {
  friend: "Friend",
  social: "Social",
  search: "Online",
  other: "Other",
};

const EVENT_LABELS: Record<string, string> = {
  movie_watched: "Logged film",
  watchlist_add: "Added to watchlist",
  movie_rated: "Rated film",
  feedback_submitted: "Left feedback",
  recommendation_generated: "Got recommendation",
  letterboxd_import_completed: "Imported from Letterboxd",
  list_created: "Created list",
  list_movie_added: "Added to list",
  follow_user: "Followed user",
  friend_request_sent: "Friend request",
  profile_updated: "Updated profile",
};

export default async function AdminOverviewPage() {
  const [stats, recentSignups, recentActivity] = await Promise.all([
    getDashboardStats(),
    getRecentSignups(8),
    getRecentActivity(12),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          App health, user activity, and key metrics.
        </p>
      </div>

      {/* ── Primary stats ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Total Users" value={stats.totalUsers} accent />
        <StatCard label="New Today" value={stats.newToday} />
        <StatCard label="New This Week" value={stats.newThisWeek} />
        <StatCard label="New This Month" value={stats.newThisMonth} />
        <StatCard label="Films Logged" value={stats.totalWatched} />
        <StatCard label="Watchlist Entries" value={stats.totalWatchlist} />
        <StatCard label="Ratings Given" value={stats.totalRatings} />
        <StatCard label="App Reviews" value={stats.totalFeedback} />
        <StatCard
          label="Active This Week"
          value={stats.activeThisWeek}
          sub="Users who logged a film"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Recent signups ── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Recent Signups</h2>
            <Link href="/admin/users" className="text-xs text-indigo-300/70 hover:text-indigo-200">
              View all →
            </Link>
          </div>
          <div className="rounded-2xl border border-white/8 bg-zinc-900/40 divide-y divide-white/5">
            {recentSignups.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-zinc-500">No signups yet.</p>
            ) : (
              recentSignups.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-indigo-300">
                    {((u.display_name as string | null) ?? (u.email as string | null) ?? "?")
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {(u.display_name as string | null) ?? (u.email as string | null) ?? "Unknown"}
                    </p>
                    <p className="text-xs text-zinc-500">
                      @{(u.username as string | null) ?? "—"} ·{" "}
                      {new Date(u.created_at as string).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {(u.heard_from as string | null) &&
                        ` · Heard: ${HEARD_FROM_SHORT[u.heard_from as string] ?? u.heard_from}`}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      u.role === "super_admin"
                        ? "bg-purple-900/40 text-purple-300"
                        : u.role === "admin"
                          ? "bg-indigo-900/40 text-indigo-300"
                          : u.role === "moderator"
                            ? "bg-blue-900/40 text-blue-300"
                            : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {u.role as string}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── Recent activity ── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
            <Link href="/admin/analytics" className="text-xs text-indigo-300/70 hover:text-indigo-200">
              Analytics →
            </Link>
          </div>
          <div className="rounded-2xl border border-white/8 bg-zinc-900/40 divide-y divide-white/5">
            {recentActivity.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-zinc-500">
                No analytics events recorded yet.
              </p>
            ) : (
              recentActivity.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                    {EVENT_LABELS[e.event_name as string] ?? (e.event_name as string)}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-zinc-600">
                    {new Date(e.created_at as string).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
