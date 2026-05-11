"use client";

import { completeOnboarding } from "@/app/onboarding/actions";
import { useRouter } from "next/navigation";
import { ChevronRight, Download, ExternalLink } from "lucide-react";
import { useState } from "react";

type Step = "welcome" | "referral" | "letterboxd" | "letterboxd-guide" | "allset";

const REFERRAL_OPTIONS = [
  { id: "friend", label: "A friend told me" },
  { id: "social", label: "Social media" },
  { id: "search", label: "Found it online" },
  { id: "other", label: "Other" },
];

const LETTERBOXD_STEPS = [
  { n: 1, text: "Go to letterboxd.com and sign in." },
  {
    n: 2,
    text: (
      <>
        Click your avatar in the top-right, then choose{" "}
        <strong className="text-zinc-200">Settings</strong>.
      </>
    ),
  },
  {
    n: 3,
    text: (
      <>
        In the left sidebar, click the{" "}
        <strong className="text-zinc-200">Data</strong> tab.
      </>
    ),
  },
  {
    n: 4,
    text: (
      <>
        Click <strong className="text-zinc-200">Export Your Data</strong>. Letterboxd will
        email you a download link within a few minutes.
      </>
    ),
  },
  {
    n: 5,
    text: "Download the ZIP — then come back here to import it. No unzipping needed.",
  },
];

export function OnboardingWizard({ displayName }: { displayName: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [referral, setReferral] = useState<string | null>(null);

  const finishToProfile = async () => {
    await completeOnboarding(referral);
    router.push("/profile");
  };

  const finishToImport = async () => {
    await completeOnboarding(referral);
    router.push("/import");
  };

  // ── Welcome ────────────────────────────────────────────────────────────────
  if (step === "welcome") {
    return (
      <WizardCard>
        <div className="text-center">
          <div className="mb-4 text-4xl">🎬</div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            Welcome, {displayName}!
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Nudge Film helps you stop endlessly scrolling and actually pick something to watch.
            Tell us your mood, get a tight shortlist — done.
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            This takes about 30 seconds to set up.
          </p>
        </div>
        <button
          onClick={() => setStep("referral")}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-white transition hover:bg-indigo-300"
        >
          Let&apos;s go <ChevronRight className="h-4 w-4" />
        </button>
      </WizardCard>
    );
  }

  // ── Referral ───────────────────────────────────────────────────────────────
  if (step === "referral") {
    return (
      <WizardCard progress={1 / 3}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-300/60">
            Quick question
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            How did you hear about Nudge Film?
          </h2>
          <p className="mt-1 text-sm text-zinc-500">Totally optional — just curious.</p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {REFERRAL_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setReferral(opt.id)}
              className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                referral === opt.id
                  ? "border-indigo-400/30 bg-indigo-400/10 text-indigo-200"
                  : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => setStep("letterboxd")}
            className="flex-1 rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-white transition hover:bg-indigo-300"
          >
            Next
          </button>
        </div>
        <button
          onClick={() => setStep("letterboxd")}
          className="mt-3 w-full text-center text-xs text-zinc-600 hover:text-zinc-400 transition"
        >
          Skip
        </button>
      </WizardCard>
    );
  }

  // ── Letterboxd question ────────────────────────────────────────────────────
  if (step === "letterboxd") {
    return (
      <WizardCard progress={2 / 3}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-300/60">
            Import
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Do you have a Letterboxd account?
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-500">
            Letterboxd is a popular movie diary app. If you use it, we can import your entire
            watch history, ratings, and watchlist into Nudge Film in a few clicks.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => setStep("letterboxd-guide")}
            className="flex flex-col items-center gap-2 rounded-xl border border-indigo-400/15 bg-indigo-300/8 px-5 py-5 text-sm transition hover:bg-indigo-300/12"
          >
            <span className="text-2xl">✓</span>
            <span className="font-semibold text-indigo-200">Yes, I have Letterboxd</span>
            <span className="text-xs text-zinc-500">I want to import my films</span>
          </button>

          <button
            onClick={() => setStep("allset")}
            className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-5 text-sm transition hover:border-white/20 hover:bg-white/[0.06]"
          >
            <span className="text-2xl">✗</span>
            <span className="font-semibold text-zinc-200">No, I don&apos;t</span>
            <span className="text-xs text-zinc-500">Start fresh</span>
          </button>
        </div>
      </WizardCard>
    );
  }

  // ── Letterboxd export guide ────────────────────────────────────────────────
  if (step === "letterboxd-guide") {
    return (
      <WizardCard progress={3 / 3}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-300/60">
            Almost there
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Export your Letterboxd data
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Here&apos;s exactly how to get your data — it only takes a minute.
          </p>
        </div>

        {/* Steps */}
        <ol className="mt-6 space-y-3">
          {LETTERBOXD_STEPS.map((s) => (
            <li key={s.n} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-400/15 text-xs font-bold text-indigo-400">
                {s.n}
              </span>
              <span className="text-sm leading-relaxed text-zinc-400">{s.text}</span>
            </li>
          ))}
        </ol>

        {/* Quick link */}
        <a
          href="https://letterboxd.com/settings/data/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400 transition hover:border-white/20 hover:text-zinc-200"
        >
          <ExternalLink className="h-4 w-4 shrink-0 text-zinc-600" />
          Open Letterboxd data settings
        </a>

        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => void finishToImport()}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-white transition hover:bg-indigo-300"
          >
            <Download className="h-4 w-4" />
            I have my file — import now
          </button>
          <button
            type="button"
            onClick={() => void finishToProfile()}
            className="rounded-xl border border-white/10 py-3 text-sm text-zinc-400 transition hover:border-white/20 hover:text-zinc-200"
          >
            I&apos;ll import later — take me to my profile
          </button>
        </div>
      </WizardCard>
    );
  }

  // ── All set (no Letterboxd) ────────────────────────────────────────────────
  return (
    <WizardCard>
      <div className="text-center">
        <div className="mb-4 text-4xl">🍿</div>
        <h2 className="text-2xl font-bold text-white">You&apos;re all set!</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Ready to find something to watch? Tell us your mood and we&apos;ll build you
          a shortlist in seconds.
        </p>
      </div>
      <button
        type="button"
        onClick={() => void finishToProfile()}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-white transition hover:bg-indigo-300"
      >
        Go to my profile <ChevronRight className="h-4 w-4" />
      </button>
    </WizardCard>
  );
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

function WizardCard({
  children,
  progress,
}: {
  children: React.ReactNode;
  progress?: number; // 0–1
}) {
  return (
    <div className="w-full max-w-md">
      {/* Progress bar */}
      {progress !== undefined && (
        <div className="mb-6 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-indigo-400 transition-all duration-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-7 shadow-xl backdrop-blur-sm">
        {children}
      </div>
    </div>
  );
}
