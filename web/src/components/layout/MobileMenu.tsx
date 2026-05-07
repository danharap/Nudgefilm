"use client";

import { signOut } from "@/app/actions/auth";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string };

type Props = {
  user: { id: string } | null;
  avatarUrl: string | null;
  displayName: string | null;
  isAdmin: boolean;
  publicLinks: NavLink[];
  authedLinks: NavLink[];
  pendingRequestCount: number;
};

export function MobileMenu({
  user,
  avatarUrl,
  displayName,
  isAdmin,
  publicLinks,
  authedLinks,
  pendingRequestCount,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  // Must be mounted before we can portal to document.body
  useEffect(() => setMounted(true), []);

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const allLinks = [...publicLinks, ...(user ? authedLinks : [])];
  const effectiveNotificationCount = pathname.startsWith("/friends") ? 0 : pendingRequestCount;
  const bottomLinks = user
    ? [
        { href: "/", label: "Home" },
        { href: "/recommend", label: "Vibes" },
        { href: "/browse", label: "Browse" },
        { href: "/watchlist", label: "Watchlist" },
        { href: "/profile", label: "Profile" },
      ]
    : [
        { href: "/", label: "Home" },
        { href: "/recommend", label: "Vibes" },
        { href: "/browse", label: "Browse" },
        { href: "/login", label: "Log in" },
        { href: "/signup", label: "Sign up" },
      ];
  const mobileInboxLink = user ? { href: "/friends", label: "Notifications", count: effectiveNotificationCount } : null;

  const drawer = (
    <>
      {/* Dark backdrop — click to close */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-[9998] bg-black/70 transition-opacity duration-300 md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Drawer — portalled to <body> so it is never clipped by the header's
          backdrop-filter stacking context (iOS Safari bug) */}
      <div
        id="mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`fixed inset-y-0 right-0 z-[9999] flex w-[min(80vw,300px)] flex-col border-l border-[var(--surface-border)] shadow-2xl transition-transform duration-300 ease-out md:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ backgroundColor: "var(--surface-1)" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--surface-border)] px-5 py-4">
          <Link
            href="/"
            className="text-sm font-semibold text-indigo-500"
            onClick={() => setOpen(false)}
          >
            Nudge Film
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-tertiary transition hover:text-primary"
            aria-label="Close menu"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Nav links — fills remaining height */}
        <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-2">
          <div className="space-y-0.5">
            {mobileInboxLink ? (
              <Link
                href={mobileInboxLink.href}
                onClick={() => setOpen(false)}
                className="mb-1 flex items-center justify-between rounded-xl bg-indigo-500/12 px-4 py-3 text-[15px] font-medium text-indigo-500 transition hover:bg-indigo-500/20"
              >
                <span>{mobileInboxLink.label}</span>
                {mobileInboxLink.count > 0 ? (
                  <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-xs font-semibold text-white">
                    {mobileInboxLink.count > 9 ? "9+" : mobileInboxLink.count}
                  </span>
                ) : null}
              </Link>
            ) : null}
            {allLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`flex items-center rounded-xl px-4 py-3.5 text-[15px] font-medium transition ${
                  pathname === l.href
                    ? "bg-indigo-500/15 text-indigo-500"
                    : "text-secondary hover:bg-[var(--surface-2)] hover:text-primary"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {isAdmin && (
            <>
              <div className="my-3 h-px bg-[var(--surface-border)]" />
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl bg-indigo-500/10 px-4 py-3.5 text-[15px] font-medium text-indigo-500 transition hover:bg-indigo-500/20"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-500/20">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-300" aria-hidden>
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                Admin
              </Link>
            </>
          )}
        </nav>

        {/* Footer — profile / auth */}
        <div className="shrink-0 border-t border-[var(--surface-border)] p-4">
          {user ? (
            <div className="space-y-2">
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-[var(--surface-2)]"
              >
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-zinc-800 ring-1 ring-white/10">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={displayName ?? ""}
                      fill
                      className="object-cover"
                      sizes="36px"
                      unoptimized
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-sm font-bold text-indigo-300 select-none">
                      {(displayName ?? "?").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-primary">{displayName}</p>
                  <p className="text-xs text-tertiary">View profile →</p>
                </div>
              </Link>
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-center rounded-xl border border-[var(--surface-border)] py-2.5 text-sm text-secondary transition hover:text-primary"
              >
                Settings
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="w-full rounded-xl border border-[var(--surface-border)] py-2.5 text-sm text-secondary transition hover:text-primary"
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-2">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-center rounded-xl border border-[var(--surface-border)] py-2.5 text-sm text-secondary transition hover:text-primary"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className="btn-brand flex w-full items-center justify-center rounded-xl py-2.5 text-sm font-semibold"
              >
                Sign up free
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );

  const bottomDock = (
    <nav
      className="fixed inset-x-3 z-[60] rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-1)]/95 px-2 py-1.5 backdrop-blur-xl md:hidden"
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <ul className="grid grid-cols-5 gap-1">
        {bottomLinks.map((l) => {
          const active = pathname === l.href;
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`flex min-h-10 items-center justify-center rounded-xl px-1 text-[11px] font-medium transition ${
                  active ? "bg-indigo-500/16 text-indigo-500" : "text-secondary hover:text-primary"
                }`}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <>
      {/* Hamburger — visible only on mobile */}
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--surface-border)] bg-[var(--surface-2)] text-secondary transition hover:text-primary md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-drawer"
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
          <path d="M1.5 3.5h12M1.5 7.5h12M1.5 11.5h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Portal drawer to <body> to escape header's backdrop-filter stacking context */}
      {mounted && createPortal(drawer, document.body)}
      {mounted && createPortal(bottomDock, document.body)}
    </>
  );
}
