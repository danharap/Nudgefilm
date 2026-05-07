import { FeedbackForm } from "./FeedbackForm";
import { getOwnFeedback, listFeedback } from "@/features/feedback/service";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STARS = [1, 2, 3, 4, 5] as const;

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span
      className="flex gap-0.5 text-indigo-400/90"
      aria-label={`${rating} out of 5 stars`}
    >
      {STARS.map((s) => (
        <span key={s} className={s <= rating ? "opacity-100" : "opacity-20"}>
          ★
        </span>
      ))}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function FeedbackPage() {
  let user: { id: string } | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (e) {
    console.error("[feedback] auth error:", e);
  }

  const [reviews, ownReview] = await Promise.all([
    listFeedback(1),
    user ? getOwnFeedback(user.id) : Promise.resolve(null),
  ]);

  const othersReviews = reviews.filter((r) => r.user_id !== user?.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <header className="mb-10 space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-500/75">
          Community
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-primary">
          App Reviews
        </h1>
        <p className="text-sm text-secondary">
          What people think of Nudge Film.
          {!user ? (
            <>
              {" "}
              <Link
                href="/login?redirect=/feedback"
                className="text-indigo-500 underline underline-offset-2 hover:text-indigo-600"
              >
                Sign in
              </Link>{" "}
              to leave your own review.
            </>
          ) : null}
        </p>
      </header>

      {/* Write / edit review — logged-in only */}
      {user ? (
        <div className="mb-10">
          <FeedbackForm existing={ownReview} />
        </div>
      ) : null}

      {/* Review list */}
      {reviews.length === 0 ? (
        <div className="surface-card-subtle rounded-2xl border border-dashed px-6 py-16 text-center">
          <p className="text-secondary">No reviews yet — be the first!</p>
          {!user ? (
            <Link
              href="/login?redirect=/feedback"
              className="mt-6 inline-block text-sm font-medium text-indigo-500 hover:text-indigo-600"
            >
              Sign in to review →
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-5">
          {ownReview ? (
            <li className="surface-card space-y-2 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-primary">
                    {ownReview.reviewer_display_name}{" "}
                    <span className="ml-1.5 rounded-full border border-indigo-400/15 bg-indigo-400/10 px-2 py-0.5 text-xs text-indigo-300/80">
                      You
                    </span>
                  </p>
                  <p className="text-xs text-tertiary">
                    {ownReview.updated_at !== ownReview.created_at
                      ? `Updated ${formatDate(ownReview.updated_at)}`
                      : formatDate(ownReview.created_at)}
                  </p>
                </div>
                <StarDisplay rating={ownReview.rating} />
              </div>
              <p className="text-sm leading-relaxed text-secondary">
                {ownReview.body}
              </p>
            </li>
          ) : null}

          {othersReviews.map((r) => (
            <li
              key={r.id}
              className="surface-card space-y-2 rounded-2xl p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-primary">
                    {r.reviewer_display_name}
                  </p>
                  <p className="text-xs text-tertiary">
                    {r.updated_at !== r.created_at
                      ? `Updated ${formatDate(r.updated_at)}`
                      : formatDate(r.created_at)}
                  </p>
                </div>
                <StarDisplay rating={r.rating} />
              </div>
              <p className="text-sm leading-relaxed text-secondary">{r.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
