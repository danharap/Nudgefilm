"use client";

import { Download } from "lucide-react";

interface WelcomeStepProps {
  onContinue: () => void;
}

export function WelcomeStep({ onContinue }: WelcomeStepProps) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col rounded-2xl border border-white/10 bg-zinc-900/60 p-6 sm:p-8">
        <div className="mb-5 flex shrink-0 justify-center">
          <Download className="h-8 w-8 text-indigo-400" />
        </div>
        <h2 className="mb-4 shrink-0 text-center text-xl font-semibold text-white sm:text-2xl">
          Export from Letterboxd
        </h2>
        <div className="space-y-3 text-zinc-300">
          <p className="text-center text-sm text-zinc-400">
            Use a <strong className="text-zinc-200">computer</strong> — mobile export is unreliable.
          </p>
          <ol className="space-y-3">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-400/20 text-xs font-bold text-indigo-400">
                1
              </span>
              <span>
                Open{" "}
                <strong className="text-white">letterboxd.com</strong> and sign in.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-400/20 text-xs font-bold text-indigo-400">
                2
              </span>
              <span>
                Go to <strong className="text-white">Settings</strong> (avatar menu → Settings).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-400/20 text-xs font-bold text-indigo-400">
                3
              </span>
              <span>
                In the <strong className="text-white">top tab bar</strong>, open{" "}
                <strong className="text-white">Data</strong> (not the sidebar).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-400/20 text-xs font-bold text-indigo-400">
                4
              </span>
              <span>
                Under <strong className="text-white">Export your data</strong>, click{" "}
                <strong className="text-white">Export</strong>. Letterboxd emails you a download link.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-400/20 text-xs font-bold text-indigo-400">
                5
              </span>
              <span>
                Download the <strong className="text-white">.zip</strong> — upload it on the next
                screen as-is (no need to unzip).
              </span>
            </li>
          </ol>
        </div>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="w-full rounded-full bg-indigo-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400"
      >
        Continue to upload →
      </button>
    </div>
  );
}
