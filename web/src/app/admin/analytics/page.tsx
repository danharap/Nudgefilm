import { getEventChart, getHeardFromBreakdown, getUserGrowthChart } from "@/app/actions/admin";
import { DailyEventsChart, TopEventsChart, UserGrowthChart } from "./AnalyticsCharts";

export const dynamic = "force-dynamic";

const HEARD_FROM_ROWS = [
  { key: "friend" as const, label: "Friend / word of mouth" },
  { key: "social" as const, label: "Social media" },
  { key: "search" as const, label: "Found online" },
  { key: "other" as const, label: "Other" },
  { key: "unset" as const, label: "Not answered (skipped or before this question)" },
];

function HeardFromBreakdown({
  counts,
}: {
  counts: Awaited<ReturnType<typeof getHeardFromBreakdown>>;
}) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <section className="rounded-2xl border border-white/8 bg-zinc-900/40 p-5">
      <h2 className="text-sm font-semibold text-white">How users heard about Nudge Film</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Optional answer from first-run onboarding, across all accounts.
      </p>
      <ul className="mt-4 space-y-3">
        {HEARD_FROM_ROWS.map(({ key, label }) => {
          const n = counts[key];
          const pct = total ? Math.round((n / total) * 100) : 0;
          return (
            <li key={key}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-zinc-300">{label}</span>
                <span className="tabular-nums text-zinc-500">
                  {n} ({pct}%)
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-indigo-400/70 transition-[width]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default async function AdminAnalyticsPage() {
  const [growth, events, heardFrom] = await Promise.all([
    getUserGrowthChart(30),
    getEventChart(14),
    getHeardFromBreakdown(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="mt-1 text-sm text-zinc-500">
          User growth and app activity for the last 30 days.
        </p>
      </div>

      <HeardFromBreakdown counts={heardFrom} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <UserGrowthChart data={growth} />
        <DailyEventsChart data={events.daily} />
      </div>

      <TopEventsChart data={events.topEvents} />

      {events.topEvents.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/15 py-12 text-center">
          <p className="text-sm text-zinc-500">
            No analytics events tracked yet. Events are recorded automatically as users interact
            with the app.
          </p>
        </div>
      )}
    </div>
  );
}
