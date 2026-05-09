import { Avatar } from "@/components/ui/Avatar";
import type { MemberDiaryHighlight } from "@/features/profile/memberDiaryHighlight";
import Link from "next/link";

export function MemberDiaryHighlightCard({ highlight: h }: { highlight: MemberDiaryHighlight }) {
  const profileHref = h.username ? `/user/${encodeURIComponent(h.username)}` : "#";

  return (
    <div className="mt-6 rounded-2xl border border-indigo-400/25 bg-indigo-950/30 px-4 py-4 ring-1 ring-white/5">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-indigo-300/90">
        From their diary
      </p>
      <div className="flex gap-3">
        <Link href={profileHref} className="shrink-0 self-start">
          <Avatar url={h.avatar_url} name={h.displayName} size={40} />
        </Link>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <Link
              href={profileHref}
              className="text-sm font-semibold text-white hover:text-indigo-200"
            >
              {h.displayName}
            </Link>
            {h.user_rating != null ? (
              <span className="text-sm font-semibold tabular-nums text-indigo-300">
                {h.user_rating}/10
              </span>
            ) : null}
          </div>
          {h.notes ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{h.notes}</p>
          ) : h.user_rating != null ? (
            <p className="text-sm italic text-zinc-500">No written notes for this title.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
