"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const QUICK_VIBES = [
  { value: "cozy", label: "Cozy" },
  { value: "funny", label: "Funny" },
  { value: "dark", label: "Dark" },
  { value: "intense", label: "Intense" },
  { value: "mind bending", label: "Mind-bending" },
  { value: "romantic", label: "Romantic" },
  { value: "adventurous", label: "Adventurous" },
  { value: "emotional", label: "Emotional" },
];

export function BrowseDiscoveryHero() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="relative mb-10 overflow-hidden rounded-2xl border border-indigo-500/20 bg-[var(--surface-1)]"
    >
      {/* Ambient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-950/35 via-transparent to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-indigo-600/10 blur-3xl"
      />

      <div className="relative px-6 py-7 sm:px-8 sm:py-8">
        <div className="mb-5 max-w-lg space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-400/70">
            Recommendations
          </p>
          <h2 className="text-xl font-semibold tracking-tight text-primary sm:text-2xl">
            Not sure what to watch?
          </h2>
          <p className="text-sm leading-relaxed text-secondary">
            Pick a vibe and we&apos;ll build a tight shortlist — no endless scrolling.
          </p>
        </div>

        {/* Quick vibe chips */}
        <div className="mb-6 flex flex-wrap gap-2">
          {QUICK_VIBES.map(({ value, label }, i) => (
            <motion.div
              key={value}
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.22, delay: 0.08 + i * 0.03, ease: "easeOut" }}
            >
              <Link
                href={`/recommend?vibes=${encodeURIComponent(value)}`}
                className="inline-block rounded-full border border-[var(--surface-border)] bg-[var(--surface-2)] px-3.5 py-1.5 text-xs font-medium text-secondary transition-all duration-200 hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-indigo-300 hover:shadow-[0_0_10px_rgba(99,102,241,0.12)]"
              >
                {label}
              </Link>
            </motion.div>
          ))}
        </div>

        <Link
          href="/recommend"
          className="btn-brand group inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
        >
          Get recommendations
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          >
            <path
              d="M5 12h14M12 5l7 7-7 7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>
    </motion.section>
  );
}
