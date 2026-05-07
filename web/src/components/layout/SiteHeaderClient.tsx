"use client";

import { signOut } from "@/app/actions/auth";
import { APP_NAME } from "@/config/brand";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
  useMotionValueEvent(scrollY, "change", (v) => setElevated(v > 8));

  return (
    <motion.header
      className="sticky top-0 z-30 border-b border-white/[0.06] backdrop-blur-xl"
      animate={{
        backgroundColor: elevated ? "rgba(6,8,15,0.92)" : "rgba(8,10,18,0.75)",
        borderColor: elevated ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.06)",
      }}
      transition={{ duration: 0.35 }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="shrink-0 text-base font-semibold tracking-tight text-white transition hover:opacity-90 sm:text-lg">
          <span className="text-indigo-300">{APP_NAME}</span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex">
          {publicLinks.map((l) => (
            <Link key={l.href} href={l.href} className={`rounded-lg px-3 py-1.5 text-sm transition ${pathname === l.href ? "bg-white/[0.08] text-white" : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"}`}>
              {l.label}
            </Link>
          ))}
          {user && authedLinks.map((l) => (
            <Link key={l.href} href={l.href} className={`rounded-lg px-3 py-1.5 text-sm transition ${pathname === l.href ? "bg-white/[0.08] text-white" : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"}`}>
              {l.label}
            </Link>
          ))}
          {isAdmin && <Link href="/admin" className="ml-1 rounded-lg bg-indigo-500/10 px-3 py-1.5 text-sm font-medium text-indigo-300 transition hover:bg-indigo-500/20">Admin</Link>}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <Link
                href="/friends?tab=inbox"
                className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] text-zinc-300 transition hover:border-white/20 hover:text-white"
                aria-label={`Notifications${pendingRequestCount > 0 ? ` (${pendingRequestCount})` : ""}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 3a7 7 0 0 1 7 7v3.7l1.2 2.3c.3.7-.2 1.5-1 1.5H4.8c-.8 0-1.3-.8-1-1.5L5 13.7V10a7 7 0 0 1 7-7z" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M9.5 19a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                {pendingRequestCount > 0 ? (
                  <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-indigo-500 px-1 text-center text-[10px] font-semibold text-white">
                    {pendingRequestCount > 9 ? "9+" : pendingRequestCount}
                  </span>
                ) : null}
              </Link>
              <Link href="/profile" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition hover:bg-white/[0.04]">
                <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-zinc-800 ring-1 ring-white/10">
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt={displayName ?? ""} fill className="object-cover" sizes="28px" unoptimized />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-bold text-indigo-300 select-none">
                      {(displayName ?? "?").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="max-w-[120px] truncate text-sm font-medium text-zinc-200">{displayName}</span>
              </Link>
              <form action={signOut}>
                <button type="submit" className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-zinc-400 transition hover:border-white/20 hover:text-white">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:text-white">Log in</Link>
              <Link href="/signup" className="rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-400">Sign up</Link>
            </>
          )}
        </div>
        <MobileMenu {...props} />
      </div>
    </motion.header>
  );
}
