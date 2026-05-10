"use client";

import { APP_NAME } from "@/config/brand";
import { browseMediaPath } from "@/lib/media-slug";
import { posterUrl } from "@/lib/tmdb/constants";
import type { MotionValue } from "framer-motion";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

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

const seedCommunityReviews: Review[] = [
  {
    id: -101,
    user_id: "seed-user-1",
    reviewer_display_name: "Danyeul",
    rating: 5,
    body: "Finally a movie app that helps me pick in five minutes instead of forty.",
    created_at: "2026-05-01T20:00:00.000Z",
  },
  {
    id: -102,
    user_id: "seed-user-2",
    reviewer_display_name: "Mika",
    rating: 4,
    body: "The shortlist is tight and the friend activity actually makes watchlists useful.",
    created_at: "2026-04-28T20:00:00.000Z",
  },
  {
    id: -103,
    user_id: "seed-user-3",
    reviewer_display_name: "Jules",
    rating: 5,
    body: "Mood filters plus runtime is exactly what I wanted for weeknight picks.",
    created_at: "2026-04-25T20:00:00.000Z",
  },
  {
    id: -104,
    user_id: "seed-user-4",
    reviewer_display_name: "Sam",
    rating: 4,
    body: "Clean UI, fast decisions, and no pointless scrolling. Super solid.",
    created_at: "2026-04-21T20:00:00.000Z",
  },
];

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

/**
 * Mirrors Framer's useScroll target offset ["start center","end center"] using native scroll events.
 * Some Windows browsers report unreliable scroll progress when multiple useScroll targets exist.
 */
function useManualSectionScrollProgress(element: HTMLElement | null) {
  const progress = useMotionValue(0);
  useLayoutEffect(() => {
    if (!element) return;
    function tick() {
      const rect = element.getBoundingClientRect();
      const vh = window.innerHeight;
      const h = Math.max(rect.height, 1);
      const p = (vh / 2 - rect.top) / h;
      progress.set(Math.min(1, Math.max(0, p)));
    }
    tick();
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    return () => {
      window.removeEventListener("scroll", tick);
      window.removeEventListener("resize", tick);
    };
  }, [element, progress]);
  return progress;
}

/** Scroll-scrubbed reveal (avoids whileInView / IntersectionObserver gaps on some Windows browsers). */
function ProductDemoScrollReveal({
  progress,
  reduceMotion,
  start,
  end,
  y: yShift = 12,
  className,
  onHoverStart,
  as = "div",
  children,
}: {
  progress: MotionValue<number>;
  reduceMotion: boolean;
  start: number;
  end: number;
  y?: number;
  className?: string;
  onHoverStart?: () => void;
  as?: "div" | "article";
  children: ReactNode;
}) {
  const opacity = useTransform(
    progress,
    reduceMotion ? [0, 1] : [start, end],
    reduceMotion ? [1, 1] : [0, 1],
  );
  const y = useTransform(
    progress,
    reduceMotion ? [0, 1] : [start, end],
    reduceMotion ? [0, 0] : [yShift, 0],
  );
  const MotionTag = as === "article" ? motion.article : motion.div;
  return (
    <MotionTag style={{ opacity, y }} className={className} onHoverStart={onHoverStart}>
      {children}
    </MotionTag>
  );
}

export function HomeLandingClient({ user, reviews, heroMovies, suggestionsByVibe }: Props) {
  const reduceMotion = useReducedMotion();
  const hasReviewed = user ? reviews.some((r) => r.user_id === user.id) : false;
  const communityReviews = useMemo(() => {
    const real = reviews.slice(0, 4);
    if (real.length >= 4) return real;
    const needed = 4 - real.length;
    return [...real, ...seedCommunityReviews.slice(0, needed)];
  }, [reviews]);
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
  const demoShortlist = useMemo(
    () => (horrorShowcase.length ? horrorShowcase.slice(0, 4) : showcased.slice(0, 4)),
    [horrorShowcase, showcased],
  );
  const [selectedDemoMovieId, setSelectedDemoMovieId] = useState<number | null>(null);

  useEffect(() => {
    setSelectedDemoMovieId(demoShortlist[0]?.id ?? null);
  }, [demoShortlist]);

  const selectedDemoMovie =
    demoShortlist.find((movie) => movie.id === selectedDemoMovieId) ?? demoShortlist[0] ?? null;

  const scrollSectionRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: scrollSectionRef,
    offset: ["start center", "end center"],
  });
  /** Eases steppy wheel / scrollbar input so demo motion stays fluid (esp. Windows). */
  const demoScrollProgress = useSpring(scrollYProgress, {
    stiffness: reduceMotion ? 10_000 : 95,
    damping: reduceMotion ? 500 : 30,
    mass: reduceMotion ? 0.05 : 0.38,
  });
  const reduceMotionBg = reduceMotion;
  const cardScale = useTransform(demoScrollProgress, [0, 1], [0.96, 1.02]);
  const cardY = useTransform(demoScrollProgress, [0, 1], [40, -40]);
  const cardOpacity = useTransform(demoScrollProgress, [0, 1], [0.7, 1]);

  const [communityScrollRoot, setCommunityScrollRoot] = useState<HTMLElement | null>(null);
  const communityScrollRaw = useManualSectionScrollProgress(communityScrollRoot);
  const communityScrollProgress = useSpring(communityScrollRaw, {
    stiffness: reduceMotion ? 10_000 : 95,
    damping: reduceMotion ? 500 : 30,
    mass: reduceMotion ? 0.05 : 0.38,
  });

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
              Pick the vibe. Get a shortlist.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-secondary sm:text-base">
              Fast recommendations for tonight. No endless browse loop.
            </p>
          </div>
        </div>

        <div className="relative mt-6">
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
            className="surface-card mx-2 max-w-7xl rounded-3xl px-4 py-4 shadow-2xl sm:mx-auto sm:px-5 sm:py-5 lg:px-6 lg:py-6"
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.58fr)]">
              {/* Left: vibe + filters */}
              <div className="space-y-3 border-b border-[var(--surface-border)] pb-4 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-indigo-500/85">
                  Tonight&apos;s setup
                </p>
                <ProductDemoScrollReveal
                  progress={demoScrollProgress}
                  reduceMotion={Boolean(reduceMotionBg)}
                  start={0.02}
                  end={0.14}
                  y={8}
                  className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-2)]/90 p-2.5"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-400/90">
                    Mood
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {["Horror", "Late Night", "Intense", "Weird"].map((label, idx) => (
                      <ProductDemoScrollReveal
                        key={label}
                        progress={demoScrollProgress}
                        reduceMotion={Boolean(reduceMotionBg)}
                        start={0.06 + idx * 0.045}
                        end={0.2 + idx * 0.045}
                        y={6}
                        className="inline-flex"
                      >
                        <span className="accent-selected inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400/95" />
                          {label}
                        </span>
                      </ProductDemoScrollReveal>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-tertiary">
                    Dread-heavy picks with sharp tension, minimal comedy breaks, and a focused
                    late-night tone.
                  </p>
                </ProductDemoScrollReveal>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-2)]/90 p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-400/90">
                      Recommendation mode
                    </p>
                    <p className="mt-1 text-xs text-secondary">Strict TMDb match · low-noise curation</p>
                    <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-tertiary">
                      <div className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-1)] px-2 py-1.5">
                        Streaming: <span className="font-medium text-secondary">Netflix/Hulu</span>
                      </div>
                      <div className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-1)] px-2 py-1.5">
                        Runtime: <span className="font-medium text-secondary">95-130m</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-2)]/90 p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-400/90">
                      Selection guardrails
                    </p>
                    <ul className="mt-2 space-y-1 text-[11px] text-tertiary">
                      <li>• Avoid already watched: <span className="font-medium text-secondary">Enabled</span></li>
                      <li>• Friend taste included: <span className="font-medium text-secondary">3 friends</span></li>
                      <li>• Min rating floor: <span className="font-medium text-secondary">7.0+</span></li>
                    </ul>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-2)]/90 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-400/90">
                    Flow
                  </p>
                  <div className="mt-2 grid gap-1 text-[11px] text-tertiary">
                    {["1. Pick vibe", "2. Add filters", "3. Get shortlist", "4. Save or rate"].map((step, idx) => (
                      <div
                        key={step}
                        className={`rounded-md border px-2 py-1.5 ${
                          idx < 3
                            ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-100"
                            : "border-[var(--surface-border)] bg-[var(--surface-1)]"
                        }`}
                      >
                        {step}
                      </div>
                    ))}
                  </div>
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
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
                    {demoShortlist.map((movie, i) => {
                      const image = posterUrl(movie.poster_path, "w342");
                      const href = browseMediaPath(
                        movie.title,
                        movie.id,
                        movie.mediaType,
                      );
                      const isSelected = selectedDemoMovie?.id === movie.id;
                      return (
                        <ProductDemoScrollReveal
                          key={`${movie.id}-${i}`}
                          progress={demoScrollProgress}
                          reduceMotion={Boolean(reduceMotionBg)}
                          start={0.12 + i * 0.065}
                          end={0.28 + i * 0.065}
                          y={16}
                          className={`group overflow-hidden rounded-xl border bg-[var(--surface-1)] transition ${
                            isSelected
                              ? "border-indigo-400/65 shadow-[0_0_26px_rgba(99,102,241,0.42)]"
                              : "border-[var(--surface-border)] hover:border-indigo-400/35"
                          }`}
                          onHoverStart={() => setSelectedDemoMovieId(movie.id)}
                        >
                          <Link href={href} className="block" onFocus={() => setSelectedDemoMovieId(movie.id)}>
                            <div className="relative aspect-[2/3] overflow-hidden">
                              {image ? (
                                <Image
                                  src={image}
                                  alt={movie.title}
                                  fill
                                  className="object-cover transition duration-500 group-hover:scale-[1.05]"
                                  sizes="(max-width:640px) 42vw, (max-width:1024px) 25vw, 220px"
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
                                  ★ {movie.vote_average?.toFixed(1) ?? "—"} · Runtime fit · Friends 4.3
                                </p>
                              </div>
                            </div>
                          </Link>
                        </ProductDemoScrollReveal>
                      );
                    })}
                    {demoShortlist.length === 0 &&
                      [1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="skeleton overflow-hidden rounded-xl border border-[var(--surface-border)]"
                        />
                      ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
                  <ProductDemoScrollReveal
                    progress={demoScrollProgress}
                    reduceMotion={Boolean(reduceMotionBg)}
                    start={0.36}
                    end={0.52}
                    y={10}
                    className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-2)]/90 p-3 sm:p-4"
                  >
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
                        • Logged by <span className="font-medium text-secondary">3 friends</span>,
                        and weighted to your shared taste.
                      </li>
                      <li>
                        • <span className="font-medium text-secondary">{selectedDemoMovie?.title ?? "Top pick"}</span>{" "}
                        is highlighted for strongest vibe fit and watch momentum.
                      </li>
                    </ul>
                  </ProductDemoScrollReveal>
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
                    <ProductDemoScrollReveal
                      progress={demoScrollProgress}
                      reduceMotion={Boolean(reduceMotionBg)}
                      start={0.5}
                      end={0.68}
                      y={12}
                      className="pointer-events-none relative w-full rounded-2xl border border-indigo-400/35 bg-[var(--surface-1)] px-3 py-2.5 text-left text-[11px] shadow-lg shadow-indigo-950/40"
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
                    </ProductDemoScrollReveal>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Social proof + community — same width + horizontal rhythm as product demo card */}
      <section ref={setCommunityScrollRoot} className="py-14 sm:py-16">
        <div className="mx-2 max-w-7xl px-4 sm:mx-auto sm:px-5 lg:px-6">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500/75">
                Community
              </p>
              <h3 className="mt-3 text-2xl font-bold text-primary sm:text-3xl">
                See what your friends are watching.
              </h3>
              <p className="mt-2 text-sm text-secondary">
                Ratings, quick notes, and watchlists in one place.
              </p>
            </div>
            <Link
              href={user ? "/feedback" : "/login?redirect=/feedback"}
              className="rounded-full border border-indigo-400/45 bg-indigo-500/20 px-4 py-2 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/30"
            >
              {hasReviewed ? "Edit your review" : "Add a review"}
            </Link>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
            <div className="grid gap-3 sm:grid-cols-2">
              {communityReviews.map((r, i) => (
                <ProductDemoScrollReveal
                  key={`${r.id}-${i}`}
                  as="article"
                  progress={communityScrollProgress}
                  reduceMotion={Boolean(reduceMotion)}
                  start={0.06 + i * 0.07}
                  end={0.22 + i * 0.07}
                  y={18}
                  className="surface-card-subtle rounded-2xl p-4"
                >
                  <div className="flex items-center gap-2">
                    <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/15 text-xs font-semibold text-indigo-300">
                      {r.reviewer_display_name.slice(0, 1).toUpperCase()}
                    </div>
                    <p className="text-xs font-medium text-primary">{r.reviewer_display_name}</p>
                    <p className="text-[11px] text-tertiary">{formatDate(r.created_at)}</p>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Stars rating={r.rating} />
                    <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] text-secondary">
                      Logged tonight
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-tertiary">{r.body}</p>
                </ProductDemoScrollReveal>
              ))}
            </div>

            <div className="grid gap-3">
              <ProductDemoScrollReveal
                as="article"
                progress={communityScrollProgress}
                reduceMotion={Boolean(reduceMotion)}
                start={0.32}
                end={0.5}
                y={20}
                className="surface-card rounded-2xl p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500/75">
                  Friends feed
                </p>
                <div className="mt-3 space-y-2">
                  {["Jules rated The Shining ★★★★☆", "Mika added Psycho to watchlist", "Sam reviewed Cure: 'cold and precise'"].map((itemText) => (
                    <div
                      key={itemText}
                      className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-2)] px-2.5 py-2 text-xs text-secondary"
                    >
                      {itemText}
                    </div>
                  ))}
                </div>
              </ProductDemoScrollReveal>

              <ProductDemoScrollReveal
                as="article"
                progress={communityScrollProgress}
                reduceMotion={Boolean(reduceMotion)}
                start={0.42}
                end={0.62}
                y={20}
                className="surface-card rounded-2xl p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500/75">
                  Your profile
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full border border-indigo-500/35 bg-indigo-500/10" />
                  <div>
                    <p className="text-sm font-semibold text-primary">nudgefilm_user</p>
                    <p className="text-xs text-tertiary">124 watched · 38 watchlist</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-2)] px-2 py-2 text-center">
                    <p className="text-sm font-semibold text-primary">4.2</p>
                    <p className="text-[10px] text-tertiary">Avg rating</p>
                  </div>
                  <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-2)] px-2 py-2 text-center">
                    <p className="text-sm font-semibold text-primary">19</p>
                    <p className="text-[10px] text-tertiary">Reviews</p>
                  </div>
                  <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-2)] px-2 py-2 text-center">
                    <p className="text-sm font-semibold text-primary">7</p>
                    <p className="text-[10px] text-tertiary">Friends</p>
                  </div>
                </div>
              </ProductDemoScrollReveal>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--surface-border)] bg-[var(--surface-2)]/55 py-12 sm:py-16">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-4 text-center sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500/75">
            Ready when you are
          </p>
          <h3 className="mt-2.5 text-xl font-bold text-primary sm:mt-3 sm:text-3xl">
            Pick faster tonight. Leave a quick review after.
          </h3>
          <p className="mt-2 max-w-xl text-sm text-secondary sm:max-w-2xl">
            Keep your diary up to date and help friends decide what to watch.
          </p>
          <div className="mt-5 flex w-full max-w-sm flex-col gap-2.5 sm:mt-6 sm:max-w-none sm:w-auto sm:flex-row sm:gap-3">
            <Link href="/recommend" className="btn-brand rounded-full px-6 py-2.5 text-sm font-semibold">
              Find a film tonight
            </Link>
            <Link
              href={user ? "/feedback" : "/login?redirect=/feedback"}
              className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-1)] px-6 py-2.5 text-sm font-semibold text-primary transition hover:bg-[var(--surface-2)]"
            >
              {hasReviewed ? "Edit your review" : "Leave a review"}
            </Link>
          </div>
        </div>
      </section>

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
