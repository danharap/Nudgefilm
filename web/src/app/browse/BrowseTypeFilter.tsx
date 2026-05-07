"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const OPTIONS = [
  { value: "all", label: "All" },
  { value: "movies", label: "Movies" },
  { value: "tv", label: "TV Shows" },
] as const;

type ContentType = "all" | "movies" | "tv";

export function BrowseTypeFilter({ current }: { current: ContentType }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function select(value: ContentType) {
    const next = new URLSearchParams(params.toString());
    if (value === "all") {
      next.delete("type");
    } else {
      next.set("type", value);
    }
    startTransition(() => {
      router.push(`/browse?${next.toString()}`, { scroll: false });
    });
  }

  return (
    <div
      role="group"
      aria-label="Content type filter"
      className="inline-flex rounded-xl border border-[var(--surface-border)] bg-[var(--surface-1)] p-1"
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === current;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => select(opt.value)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
              active
                ? "bg-indigo-500 text-white shadow-sm"
                : "text-secondary hover:text-primary"
            }`}
            aria-pressed={active}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
