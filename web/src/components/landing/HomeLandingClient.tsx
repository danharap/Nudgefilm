"use client";

import { APP_NAME } from "@/config/brand";
import { posterUrl } from "@/lib/tmdb/constants";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

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
      vote_average: number;
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
        <span key={s} className={s <= rating ? "text-indigo-500" : "text-tertiary"}>★</span>
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
  const horrorShowcase = useMemo(
    () => suggestionsByVibe["Late Night"] ?? [],
    [suggestionsByVibe],
  );

  const scrollSectionRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: scrollSectionRef,
    offset: ["start center", "end center"],
  });
  const reduceMotionBg = reduceMotion;
  const cardScale = useTransform(scrollYProgress, [0, 1], [0.96, 1.02]);
  const cardY = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const cardOpacity = useTransform(scrollYProgress, [0, 1], [0.7, 1]);

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

      {/* Product scroll reveal */}
      <section ref={scrollSectionRef} className="relative py-14 sm:py-16">
        <div className="mx-auto max-w-7xl px-3 sm:px-5">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500/75">
              Product demo
            </p>
            <h2 className="mt-3 text-2xl font-bold text-primary sm:text-3xl">
              Tell us the vibe. We&apos;ll narrow the night.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-secondary sm:text-base">
              A calmer way to go from endless scrolling to a tight shortlist. Scroll to see how
              Nudge Film turns a feeling into a focused set of picks.
            </p>
          </div>
        </div>

        <div className="relative mt-6 h-[66vh] sm:h-[74vh]">
          <motion.div
            style={
              reduceMotionBg
                ? undefined
                : {
                    scale: cardScale,
                    y: cardY,
                    opacity: cardOpacity,
                  }
            }
            className="surface-card sticky top-10 mx-2 max-w-7xl rounded-3xl px-4 py-4 shadow-2xl sm:top-14 sm:mx-auto sm:px-5 sm:py-5 lg:px-6 lg:py-6"
          >
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1.3fr)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
              {/* Left: vibe + filters */}
              <div className="space-y-4 border-b border-[var(--surface-border)] pb-4 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-500/80">
                  Tonight&apos;s setup
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["Horror", "Late Night", "Intense"].map((label) => (
                    <span
                      key={label}
                      className="accent-selected inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-400/95" />
                      {label}
                    </span>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-secondary">Genres</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["Horror", "Thriller", "Mystery"].map((label) => (
                      <span key={label} className="chip rounded-full px-3 py-1 text-xs">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-secondary">Filters</p>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-tertiary">
                    <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-2)] px-2 py-1.5">
                      Min rating: <span className="font-semibold text-secondary">7.0+</span>
                    </div>
                    <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-2)] px-2 py-1.5">
                      Runtime: <span className="font-semibold text-secondary">95-130m</span>
                    </div>
                    <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-2)] px-2 py-1.5">
                      Era: <span className="font-semibold text-secondary">1998-2024</span>
                    </div>
                    <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-2)] px-2 py-1.5">
                      Language: <span className="font-semibold text-secondary">EN</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-medium text-secondary">Guardrails</p>
                  <ul className="space-y-1 text-[11px] text-tertiary">
                    <li>• No algorithmic noise or infinite carousels</li>
                    <li>• Filters for runtime, era, streaming availability</li>
                    <li>• Strict genre + vibe matching from TMDb</li>
                  </ul>
                </div>
              </div>

              {/* Right: shortlist + explanation */}
              <div className="grid gap-4">
                <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-2)]/90 p-3 sm:p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500/75">
                        Shortlist
                      </p>
                      <p className="text-xs text-tertiary">
                        Because you picked <span className="font-medium text-secondary">Horror</span>{" "}
                        + <span className="font-medium text-secondary">Thriller</span> with{" "}
                        <span className="font-medium text-secondary">7.0+ ratings</span>.
                      </p>
                    </div>
                    <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium text-indigo-500">
                      6 matches
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                    {(horrorShowcase.length ? horrorShowcase.slice(0, 3) : showcased.slice(0, 3)).map((movie, i) => {
                      const image = posterUrl(movie.poster_path, "w342");
                      const href =
                        movie.mediaType === "tv" ? `/show/${movie.id}` : `/movie/${movie.id}`;
                      return (
                        <motion.div
                          key={`${movie.id}-${i}`}
                          initial={reduceMotionBg ? false : { opacity: 0, y: 16 }}
                          whileInView={reduceMotionBg ? undefined : { opacity: 1, y: 0 }}
                          viewport={{ once: true, amount: 0.4 }}
                          transition={{ duration: 0.4, delay: i * 0.05 }}
                          className="group overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[var(--surface-1)]"
                        >
                          <Link href={href} className="block">
                            <div className="relative aspect-[2/3] overflow-hidden">
                              {image ? (
                                <Image
                                  src={image}
                                  alt={movie.title}
                                  fill
                                  className="object-cover transition duration-500 group-hover:scale-[1.04]"
                                  sizes="(max-width:640px) 30vw, 160px"
                                />
                              ) : (
                                <div className="skeleton h-full w-full" />
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                              <div className="absolute inset-x-1.5 bottom-1.5">
                                <p className="line-clamp-2 text-[11px] font-medium text-white">
                                  {movie.title}
                                </p>
                                <p className="mt-0.5 text-[10px] text-zinc-300/90">
                                  ★ {movie.vote_average?.toFixed(1) ?? "—"} · Min 7.0 matched · Friends 4.3
                                </p>
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      );
                    })}
                    {showcased.length === 0 &&
                      [1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="skeleton overflow-hidden rounded-xl border border-[var(--surface-border)]"
                        />
                      ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
                  <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-2)]/90 p-3 sm:p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500/75">
                      Why this fits
                    </p>
                    <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-tertiary">
                      <li>
                        • High-tension pacing and{" "}
                        <span className="font-medium text-secondary">dread-forward atmosphere</span>.
                      </li>
                      <li>
                        • Rated <span className="font-medium text-secondary">7.0+</span> with strong
                        vote counts and low-noise picks.
                      </li>
                      <li>
                        • Logged by <span className="font-medium text-secondary">3 friends</span> in
                        the last month.
                      </li>
                      <li>• Runtime kept near 2 hours for a focused horror night.</li>
                    </ul>
                  </div>
                  <div className="relative space-y-3">
                    <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-2)]/90 p-3 sm:p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500/75">
                        One tap actions
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-full border border-indigo-400/35 bg-indigo-500/15 px-3 py-1.5 text-[11px] font-medium text-indigo-500"
                        >
                          ★ Rate &amp; log
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-1)] px-3 py-1.5 text-[11px] font-medium text-secondary"
                        >
                          + Add to watchlist
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-1)] px-3 py-1.5 text-[11px] font-medium text-secondary"
                        >
                          Share with friends
                        </button>
                      </div>
                    </div>
                    {/* Toast preview */}
                    <motion.div
                      initial={reduceMotionBg ? false : { opacity: 0, y: 12 }}
                      whileInView={reduceMotionBg ? undefined : { opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.4 }}
                      transition={{ duration: 0.45, delay: 0.15 }}
                      className="pointer-events-none absolute -bottom-2 right-1 w-[min(240px,70vw)] rounded-2xl border border-indigo-400/35 bg-[var(--surface-1)] px-3 py-2.5 text-left text-[11px] shadow-lg shadow-indigo-950/40"
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/90 text-[10px] font-bold text-black">
                          ✓
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-secondary">
                            Added to your diary
                          </p>
                          <p className="truncate text-[10px] text-tertiary">
                            Rating saved · Watchlist updated
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Guided story strip */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-8 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500/75">
              Why it works
            </p>
            <h3 className="mt-3 text-2xl font-bold text-primary sm:text-3xl">
              A simple movie night flow, designed to finish.
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              {
                title: "Stop scrolling",
                desc: "Skip endless catalogs and start from mood instead of volume.",
                badge: "01",
              },
              {
                title: "Pick the vibe",
                desc: "Cozy, funny, emotional, intense - choose what tonight feels like.",
                badge: "02",
              },
              {
                title: "Get a shortlist",
                desc: "Receive a focused set of strong matches with real reasons.",
                badge: "03",
              },
              {
                title: "Track your taste",
                desc: "Rate, log, and keep your diary and watchlist in sync.",
                badge: "04",
              },
              {
                title: "Share with friends",
                desc: "See what friends rated and swap recommendations naturally.",
                badge: "05",
              },
            ].map((step, i) => (
              <motion.article
                key={step.title}
                initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
                whileHover={reduceMotion ? undefined : { y: -4 }}
                className="premium-card surface-card-subtle rounded-2xl p-4"
              >
                <span className="inline-flex rounded-full bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-500">
                  {step.badge}
                </span>
                <p className="mt-3 text-sm font-semibold text-primary">{step.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-tertiary">{step.desc}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative border-y border-[var(--surface-border)] bg-[var(--surface-2)]/80 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500/75">How it works</p>
            <h2 className="mt-3 text-2xl font-bold text-primary sm:text-3xl">Pick the vibe. Get better recommendations.</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-secondary">
              Start with a feeling — cozy, intense, emotional — and we&apos;ll build a shortlist
              around it so you can press play faster.
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
            {vibeOptions.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setActiveVibe(v)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${
                  activeVibe === v
                    ? "border-indigo-400/45 bg-indigo-400/15 text-indigo-500"
                    : "border-[var(--surface-border)] bg-[var(--surface-2)] text-secondary hover:text-primary"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-tertiary">
            Because you picked{" "}
            <span className="font-medium text-secondary">
              {activeVibe}
            </span>
            , here&apos;s a tight, rewatchable set of titles — no endless scroll.
          </p>
          <motion.div
            layout
            className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
          >
            {showcased.map((movie) => {
              const image = posterUrl(movie.poster_path, "w342");
              const href = movie.mediaType === "tv" ? `/show/${movie.id}` : `/movie/${movie.id}`;
              return (
                <motion.div
                  key={`${activeVibe}-${movie.id}`}
                  layout
                  initial={reduceMotion ? undefined : { opacity: 0, y: 18, scale: 0.98 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  whileHover={reduceMotion ? undefined : { y: -4, scale: 1.02 }}
                  className="group overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-1)] shadow-sm shadow-black/20"
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
        <section className="border-t border-[var(--surface-border)] bg-[var(--surface-2)]/50 px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-5xl">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500/75">Reviews</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-primary sm:text-3xl">What people are saying</h2>
              </div>
              {avgRating !== null && (
                <div className="surface-card rounded-2xl px-5 py-3 text-center">
                  <p className="text-3xl font-bold text-primary">{avgRating.toFixed(1)}</p>
                  <Stars rating={Math.round(avgRating)} />
                </div>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {preview.map((r) => (
                <div key={r.id} className="surface-card rounded-2xl p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-400/10 text-xs font-bold text-indigo-300">
                      {r.reviewer_display_name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-primary">{r.reviewer_display_name}</p>
                      <p className="text-xs text-tertiary">{formatDate(r.created_at)}</p>
                    </div>
                    <Stars rating={r.rating} />
                  </div>
                  <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-secondary">{r.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex justify-center">
              {user ? (
                <Link href="/feedback" className="btn-brand rounded-full px-6 py-2.5 text-sm font-semibold">
                  {hasReviewed ? "Edit your review" : "Leave a review"}
                </Link>
              ) : (
                <Link href="/login?redirect=/feedback" className="btn-brand rounded-full px-6 py-2.5 text-sm font-semibold">
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
            ? "btn-brand"
            : "border border-[var(--surface-border)] bg-[var(--surface-2)] text-primary backdrop-blur-md hover:bg-[var(--surface-1)]"
        }`}
      >
        {children}
      </Link>
    </motion.div>
  );
}
