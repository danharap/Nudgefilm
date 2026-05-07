"use client";

import { useCallback, useEffect, useState } from "react";
import { WelcomeStep } from "./WelcomeStep";
import { UploadStep } from "./UploadStep";
import { MatchingStep, type MatchedData } from "./MatchingStep";
import { SummaryStep } from "./SummaryStep";
import type { ParsedImport } from "@/lib/letterboxd/parser";

type WizardStep = "welcome" | "upload" | "preview" | "matching" | "summary";

const DRAFT_KEY = "lbd_import_draft";

interface DraftState {
  parsed: ParsedImport;
  savedAt: string;
}

function loadDraft(): DraftState | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DraftState;
  } catch {
    return null;
  }
}

function saveDraft(parsed: ParsedImport) {
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ parsed, savedAt: new Date().toISOString() } satisfies DraftState),
    );
  } catch {
    // localStorage unavailable — continue silently
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

// Step order for the breadcrumb indicator
const STEPS: { key: WizardStep; label: string }[] = [
  { key: "welcome", label: "Guide" },
  { key: "upload", label: "Upload" },
  { key: "matching", label: "Match" },
  { key: "summary", label: "Done" },
];

export function ImportWizard() {
  const [step, setStep] = useState<WizardStep>("welcome");
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [matchedData, setMatchedData] = useState<MatchedData | null>(null);
  const [resumeBanner, setResumeBanner] = useState(false);

  useEffect(() => {
    const draft = loadDraft();
    if (draft && draft.parsed) {
      setResumeBanner(true);
    }
  }, []);

  const handleResume = () => {
    const draft = loadDraft();
    if (draft?.parsed) {
      setParsed(draft.parsed);
      setStep("matching");
    }
    setResumeBanner(false);
  };

  const handleDismissResume = () => {
    clearDraft();
    setResumeBanner(false);
  };

  const handleParsed = useCallback((data: ParsedImport) => {
    setParsed(data);
    saveDraft(data);
    setStep("matching");
  }, []);

  const handleMatched = useCallback((data: MatchedData) => {
    setMatchedData(data);
    setStep("summary");
  }, []);

  const handleStartOver = useCallback(() => {
    clearDraft();
    setParsed(null);
    setMatchedData(null);
    setStep("welcome");
  }, []);

  // Breadcrumb step (collapse preview into matching)
  const displayStep: WizardStep =
    step === "preview" ? "matching" : step;

  const crumbIndex = STEPS.findIndex((s) => s.key === displayStep);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      {/* Resume banner */}
      {resumeBanner && (
        <div className="sticky top-0 z-10 border-b border-indigo-400/20 bg-indigo-500/10 px-4 py-3 backdrop-blur-sm">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-4">
            <p className="text-sm text-indigo-500">
              You have an unfinished import. Want to pick up where you left off?
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={handleResume}
                className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-medium text-indigo-300 hover:bg-indigo-400/30 transition"
              >
                Resume
              </button>
              <button
                onClick={handleDismissResume}
                className="rounded-full px-3 py-1 text-xs text-tertiary hover:text-primary transition"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step breadcrumbs */}
      {step !== "welcome" && (
        <div className="border-b border-[var(--surface-border)] bg-[var(--surface-2)] px-4 py-3">
          <div className="mx-auto flex max-w-xl items-center justify-center gap-0">
            {STEPS.map((s, i) => {
              const done = i < crumbIndex;
              const active = i === crumbIndex;
              return (
                <div key={s.key} className="flex items-center">
                  <div
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                      active
                        ? "bg-indigo-400/15 text-indigo-400"
                        : done
                          ? "text-secondary"
                          : "text-tertiary"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                        active
                          ? "bg-indigo-400 text-zinc-900"
                          : done
                            ? "bg-zinc-600 text-zinc-200"
                            : "bg-zinc-500 text-zinc-200"
                      }`}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    {s.label}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`mx-1 h-px w-6 ${i < crumbIndex ? "bg-zinc-500" : "bg-zinc-400"}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step content */}
      <div className="flex flex-1 flex-col items-center justify-start px-4 py-10">
        {step === "welcome" && (
          <WelcomeStep onContinue={() => setStep("upload")} />
        )}

        {step === "upload" && (
          <UploadStep onParsed={handleParsed} />
        )}

        {step === "matching" && parsed && (
          <>
            {/* Preview summary before matching starts */}
            <ParsedPreview parsed={parsed} />
            <MatchingStep parsed={parsed} onMatched={handleMatched} />
          </>
        )}

        {step === "summary" && matchedData && (
          <SummaryStep matchedData={matchedData} onStartOver={handleStartOver} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline preview summary shown above the matching step
// ---------------------------------------------------------------------------

function ParsedPreview({ parsed }: { parsed: ParsedImport }) {
  const items = [
    { label: "Watched films", value: parsed.watched.length, show: parsed.watched.length > 0 },
    {
      label: "With ratings",
      value: parsed.watched.filter((w) => w.rating !== null).length,
      show: parsed.watched.some((w) => w.rating !== null),
    },
    {
      label: "With reviews",
      value: parsed.watched.filter((w) => w.review !== null).length,
      show: parsed.watched.some((w) => w.review !== null),
    },
    {
      label: "Watchlist",
      value: parsed.watchlist.length,
      show: parsed.watchlist.length > 0,
    },
    {
      label: "Liked films",
      value: parsed.likedFilms.length,
      show: parsed.likedFilms.length > 0,
    },
  ].filter((i) => i.show);

  if (items.length === 0) return null;

  return (
    <div className="surface-card-subtle mx-auto mb-8 w-full max-w-xl rounded-xl p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-tertiary">
        Found in your export
      </p>
      <div className="flex flex-wrap gap-4">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <div className="text-lg font-bold text-primary">{item.value.toLocaleString()}</div>
            <div className="text-xs text-tertiary">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
