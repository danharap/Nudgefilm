"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "nudge-theme";
type ThemeMode = "dark" | "light";

function applyTheme(mode: ThemeMode) {
  document.documentElement.setAttribute("data-theme", mode);
}

export function ThemeModeSettings() {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") {
      setMode(saved);
      applyTheme(saved);
      return;
    }
    applyTheme("dark");
  }, []);

  function update(next: ThemeMode) {
    setMode(next);
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <section className="surface-card rounded-2xl p-5">
      <h2 className="text-lg font-semibold text-primary">Appearance</h2>
      <p className="mt-1 text-sm text-secondary">
        Dark mode matches your current cinematic style. Light mode gives a brighter look.
      </p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => update("dark")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            mode === "dark"
              ? "btn-brand text-white"
              : "border border-[var(--surface-border)] bg-[var(--surface-2)] text-secondary hover:text-primary"
          }`}
        >
          Dark
        </button>
        <button
          type="button"
          onClick={() => update("light")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            mode === "light"
              ? "btn-brand text-white"
              : "border border-[var(--surface-border)] bg-[var(--surface-2)] text-secondary hover:text-primary"
          }`}
        >
          Light
        </button>
      </div>
    </section>
  );
}
