"use client";

import { APP_NAME } from "@/config/brand";
import { posterUrl } from "@/lib/tmdb/constants";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type HeroMovie = {
  id: number;
  title: string;
  overview: string;
  backdrop_path: string | null;
  poster_path: string | null;
  release_date: string;
  genre_ids?: number[];
};

type Review = {
  id: number;
  user_id: string;
  reviewer_display_name: string;
  rating: number;
  body: string;
  created_at: string;
};

type Props = {
  user: { id: string } | null;
  reviews: Review[];
  heroMovies: HeroMovie[];
  suggestionsByVibe: Record<
    LandingVibe,
    Array<{
      id: number;
      title: string;
      poster_path: string | null;
      genre_ids: number[];
      mediaType: "movie" | "tv";
    }>
  >;
};

const heroHeadlines = [
  "Stop scrolling. Start watching.",
  "The right movie for tonight.",
  "Tell us the vibe. We do the rest.",
];

const vibeOptions = ["Cozy", "Funny", "Emotional", "Intense", "Adventurous", "Romantic", "Late Night"] as const;
type LandingVibe = (typeof vibeOptions)[number];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
};

const item = {
  hidden: { opacity: 0, y: 18, filter: "blur(8px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)" },
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5 text-sm" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={s <= rating ? "text-indigo-300" : "text-zinc-700"}>★</span>
      ))}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function HomeLandingClient({ user, reviews, heroMovies, suggestionsByVibe }: Props) {
  const reduceMotion = useReducedMotion();
  const preview = reviews.slice(0, 3);
  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  const hasReviewed = user ? reviews.some((r) => r.user_id === user.id) : false;
  const [activeVibe, setActiveVibe] = useState<LandingVibe>("Cozy");
  const [activeHeroIdx, setActiveHeroIdx] = useState(0);

  const heroImages = useMemo(
    () => heroMovies.filter((m) => m.backdrop_path).slice(0, 5),
    [heroMovies],
  );

  useEffect(() => {
    if (reduceMotion || heroImages.length <= 1) return;
    const id = window.setInterval(() => {
      setActiveHeroIdx((prev) => (prev + 1) % heroImages.length);
    }, 9500);
    return () => window.clearInterval(id);
  }, [heroImages.length, reduceMotion]);

  const showcased = useMemo(
    () => suggestionsByVibe[activeVibe] ?? [],
    [activeVibe, suggestionsByVibe],
  );

  return (
    <div className="relative overflow-x-hidden">
      <section className="relative min-h-[92vh] overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[#06080f]" />
          <AnimatePresence mode="wait">
            {heroImages[activeHeroIdx] ? (
              <motion.div
                key={heroImages[activeHeroIdx].id}
                className="absolute inset-0"
                initial={{ opacity: 0, scale: 1.03 }}
                animate={reduceMotion ? { opacity: 1, scale: 1.03 } : { opacity: 1, scale: 1.08 }}
                exit={{ opacity: 0 }}
                transition={{ opacity: { duration: 1.45 }, scale: { duration: 9.4, ease: "linear" } }}
              >
                <Image
                  src={posterUrl(heroImages[activeHeroIdx].backdrop_path, "original") ?? ""}
                  alt=""
                  fill
                  priority={activeHeroIdx === 0}
                  className="object-cover"
                  sizes="100vw"
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(87,92,255,.24),transparent_45%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/55 to-[#05060c]" />
          <motion.div
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,.55)_100%)]"
            animate={reduceMotion ? undefined : { opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY }}
          />
          <div className="absolute inset-0 opacity-[0.08] mix-blend-soft-light [background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22 viewBox=%220 0 200 200%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22200%22 height=%22200%22 filter=%22url(%23n)%22 opacity=%22.35%22/%3E%3C/svg%3E')]" />
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="mx-auto flex min-h-[92vh] max-w-6xl flex-col justify-center px-4 pb-20 pt-24 sm:px-6 lg:pt-28"
        >
          <motion.p variants={item} transition={{ duration: 0.55 }} className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-black/35 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-200/90 backdrop-blur-md">
            {APP_NAME}
          </motion.p>
          <motion.h1 variants={item} transition={{ duration: 0.55 }} className="mt-7 max-w-3xl text-4xl font-bold leading-[1.04] tracking-tight text-white sm:text-6xl lg:text-[4.3rem]">
            {heroHeadlines[0]}
          </motion.h1>
          <motion.p variants={item} transition={{ duration: 0.55 }} className="mt-5 max-w-xl text-base leading-relaxed text-zinc-200/80 sm:text-lg">
            Curated films for your exact mood. No algorithmic noise. No endless browsing.
          </motion.p>
          <motion.ul variants={item} transition={{ duration: 0.55 }} className="mt-5 grid max-w-2xl gap-2 text-sm text-zinc-200/80 sm:grid-cols-3">
            <li className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 backdrop-blur-sm">Track films and shows you watched</li>
            <li className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 backdrop-blur-sm">Save what you want to watch next</li>
            <li className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 backdrop-blur-sm">Share with friends and style your profile</li>
          </motion.ul>
          <motion.div variants={item} transition={{ duration: 0.55 }} className="mt-9 flex flex-col gap-3 sm:flex-row">
            <MagneticButton href="/recommend" strong>
              Find a film tonight
            </MagneticButton>
            {!user ? <MagneticButton href="/signup">Create free account</MagneticButton> : null}
          </motion.div>
        </motion.div>
      </section>

      <section className="relative border-y border-white/5 bg-[#070a12]/85 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300/70">How it works</p>
            <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">Pick the vibe. Get better recommendations.</h2>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
            {vibeOptions.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setActiveVibe(v)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${
                  activeVibe === v
                    ? "border-indigo-400/45 bg-indigo-400/15 text-indigo-100"
                    : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/25"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <motion.div layout className="mt-6 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {showcased.map((movie) => {
              const image = posterUrl(movie.poster_path, "w342");
              const href = movie.mediaType === "tv" ? `/show/${movie.id}` : `/movie/${movie.id}`;
              return (
                <motion.div
                  key={`${activeVibe}-${movie.id}`}
                  layout
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="group overflow-hidden rounded-2xl border border-white/10 bg-black/35"
                >
                  <Link href={href} className="block">
                    <div className="relative aspect-[2/3] overflow-hidden">
                      {image ? (
                        <Image src={image} alt={movie.title} fill className="object-cover transition duration-500 group-hover:scale-105" sizes="(max-width:640px) 46vw, 20vw" />
                      ) : (
                        <div className="skeleton h-full w-full" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-2">
                        <p className="line-clamp-2 text-xs font-medium text-white">{movie.title}</p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {(preview.length > 0 || !user) && (
        <section className="border-t border-white/[0.05] bg-black/10 px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-5xl">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300/70">Reviews</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">What people are saying</h2>
              </div>
              {avgRating !== null && (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-3 text-center">
                  <p className="text-3xl font-bold text-white">{avgRating.toFixed(1)}</p>
                  <Stars rating={Math.round(avgRating)} />
                </div>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {preview.map((r) => (
                <div key={r.id} className="rounded-2xl border border-white/[0.07] bg-zinc-900/50 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-400/10 text-xs font-bold text-indigo-300">
                      {r.reviewer_display_name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{r.reviewer_display_name}</p>
                      <p className="text-xs text-zinc-600">{formatDate(r.created_at)}</p>
                    </div>
                    <Stars rating={r.rating} />
                  </div>
                  <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-zinc-400">{r.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex justify-center">
              {user ? (
                <Link href="/feedback" className="rounded-full bg-indigo-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400">
                  {hasReviewed ? "Edit your review" : "Leave a review"}
                </Link>
              ) : (
                <Link href="/login?redirect=/feedback" className="rounded-full bg-indigo-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400">
                  Sign in to leave a review
                </Link>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function MagneticButton({
  href,
  children,
  strong = false,
}: {
  href: string;
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <motion.div whileHover={{ y: -2, scale: 1.01 }} whileTap={{ scale: 0.98 }}>
      <Link
        href={href}
        className={`inline-flex min-h-12 items-center justify-center rounded-2xl px-7 py-3.5 text-base font-semibold transition ${
          strong
            ? "bg-indigo-500 text-white shadow-xl shadow-indigo-950/50 hover:bg-indigo-400"
            : "border border-white/15 bg-white/[0.04] text-zinc-100 backdrop-blur-md hover:border-white/30"
        }`}
      >
        {children}
      </Link>
    </motion.div>
  );
}
