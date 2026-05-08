"use client";

import { signOut } from "@/app/actions/auth";
import { APP_NAME } from "@/config/brand";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MobileMenu } from "./MobileMenu";

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

export function SiteHeaderClient(props: Props) {
  const { user, avatarUrl, displayName, isAdmin, publicLinks, authedLinks, pendingRequestCount } = props;
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const [elevated, setElevated] = useState(false);
  const [notificationsCleared, setNotificationsCleared] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  useMotionValueEvent(scrollY, "change", (v) => setElevated(v > 8));
  useEffect(() => {
    if (pathname.startsWith("/friends")) setNotificationsCleared(true);
  }, [pathname]);
  useEffect(() => setProfileMenuOpen(false), [pathname]);
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!profileMenuRef.current) return;
      if (!profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    if (profileMenuOpen) document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [profileMenuOpen]);
  const effectiveNotificationCount = notificationsCleared || pathname.startsWith("/friends")
    ? 0
    : pendingRequestCount;

  return (
    <motion.header
      className="glass-nav sticky top-0 z-30"
      animate={{
        backgroundColor: elevated ? "var(--surface-1)" : "var(--surface-2)",
        borderColor: "var(--surface-border)",
      }}
      transition={{ duration: 0.35 }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="shrink-0 text-base font-semibold tracking-tight text-primary transition hover:opacity-90 sm:text-lg">
          <span style={{ color: "var(--accent)" }}>{APP_NAME}</span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex">
          {publicLinks.map((l) => (
            <Link key={l.href} href={l.href} className={`rounded-lg px-3 py-1.5 text-sm transition ${pathname === l.href ? "bg-[var(--surface-3)] text-primary" : "text-secondary hover:bg-[var(--surface-2)] hover:text-primary"}`}>
              {l.label}
            </Link>
          ))}
          {user && authedLinks.map((l) => (
            <Link key={l.href} href={l.href} className={`rounded-lg px-3 py-1.5 text-sm transition ${pathname === l.href ? "bg-[var(--surface-3)] text-primary" : "text-secondary hover:bg-[var(--surface-2)] hover:text-primary"}`}>
              {l.label}
            </Link>
          ))}
          {isAdmin && <Link href="/admin" className="ml-1 rounded-lg bg-indigo-500/10 px-3 py-1.5 text-sm font-medium text-indigo-500 transition hover:bg-indigo-500/20">Admin</Link>}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <Link
                href="/friends"
                onClick={() => setNotificationsCleared(true)}
                className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--surface-border)] bg-[var(--surface-2)] text-secondary transition hover:text-primary"
                aria-label={`Notifications${effectiveNotificationCount > 0 ? ` (${effectiveNotificationCount})` : ""}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 3a7 7 0 0 1 7 7v3.7l1.2 2.3c.3.7-.2 1.5-1 1.5H4.8c-.8 0-1.3-.8-1-1.5L5 13.7V10a7 7 0 0 1 7-7z" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M9.5 19a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                {effectiveNotificationCount > 0 ? (
                  <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-indigo-500 px-1 text-center text-[10px] font-semibold text-white">
                    {effectiveNotificationCount > 9 ? "9+" : effectiveNotificationCount}
                  </span>
                ) : null}
              </Link>
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition hover:bg-[var(--surface-2)]"
                  aria-haspopup="menu"
                  aria-expanded={profileMenuOpen}
                  aria-label="Open account menu"
                >
                  <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-zinc-800 ring-1 ring-[var(--surface-border)]">
                    {avatarUrl ? (
                      <Image src={avatarUrl} alt={displayName ?? ""} fill className="object-cover" sizes="28px" unoptimized />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs font-bold text-indigo-300 select-none">
                        {(displayName ?? "?").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="max-w-[120px] truncate text-sm font-medium text-primary">{displayName}</span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                    className={`text-tertiary transition ${profileMenuOpen ? "rotate-180" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {profileMenuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+8px)] min-w-[170px] rounded-xl border border-[var(--surface-border)] bg-[var(--surface-1)] p-1.5 shadow-2xl"
                  >
                    <Link
                      href="/profile"
                      role="menuitem"
                      className="block rounded-lg px-3 py-2 text-sm text-secondary transition hover:bg-[var(--surface-2)] hover:text-primary"
                    >
                      Profile
                    </Link>
                    <Link
                      href="/settings"
                      role="menuitem"
                      className="block rounded-lg px-3 py-2 text-sm text-secondary transition hover:bg-[var(--surface-2)] hover:text-primary"
                    >
                      Settings
                    </Link>
                  </div>
                ) : null}
              </div>
              <form action={signOut}>
                <button type="submit" className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-2)] px-3 py-1.5 text-sm text-secondary transition hover:text-primary">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-lg px-3 py-1.5 text-sm text-secondary transition hover:text-primary">Log in</Link>
              <Link href="/signup" className="btn-brand rounded-lg px-3 py-1.5 text-sm font-medium">Sign up</Link>
            </>
          )}
        </div>
        <MobileMenu {...props} />
      </div>
    </motion.header>
  );
}
