"use client";

import { signOut } from "@/app/actions/auth";
import { APP_NAME } from "@/config/brand";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  useMotionValueEvent(scrollY, "change", (v) => setElevated(v > 8));
  useEffect(() => {
    if (pathname.startsWith("/friends")) setNotificationsCleared(true);
  }, [pathname]);
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
          <span className="text-indigo-500">{APP_NAME}</span>
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
              <Link
                href="/settings"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--surface-border)] bg-[var(--surface-2)] text-secondary transition hover:text-primary"
                aria-label="Settings"
                title="Settings"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M19.4 13.5a1.7 1.7 0 0 0 .03-3l-1.2-.43a6.8 6.8 0 0 0-.5-1.2l.55-1.15a1.7 1.7 0 0 0-.3-1.97l-.03-.03a1.7 1.7 0 0 0-1.98-.3l-1.14.55a6.8 6.8 0 0 0-1.2-.5l-.43-1.2a1.7 1.7 0 0 0-3 0l-.43 1.2a6.8 6.8 0 0 0-1.2.5l-1.14-.55a1.7 1.7 0 0 0-1.98.3l-.03.03a1.7 1.7 0 0 0-.3 1.97l.55 1.15a6.8 6.8 0 0 0-.5 1.2l-1.2.43a1.7 1.7 0 0 0 0 3l1.2.43c.12.42.28.82.5 1.2l-.55 1.14c-.36.75-.2 1.64.4 2.22l.03.03c.58.6 1.47.76 2.22.4l1.14-.55c.38.22.78.38 1.2.5l.43 1.2a1.7 1.7 0 0 0 3 0l.43-1.2c.42-.12.82-.28 1.2-.5l1.14.55c.75.36 1.64.2 2.22-.4l.03-.03c.6-.58.76-1.47.4-2.22l-.55-1.14c.22-.38.38-.78.5-1.2l1.2-.43Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </Link>
              <Link href="/profile" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition hover:bg-[var(--surface-2)]">
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
              </Link>
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
