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
import TmdbImage from "@/components/ui/TmdbImage";
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

/** Demo film activity for the landing carousel (illustrative only, not real users). */
type DemoFriendFilmReview = {
  id: string;
  reviewer: string;
  movieTitle: string;
  year: string;
  poster_path: string;
  rating: number;
  quote: string;
  kind: "rated" | "logged";
};

const demoFriendFilmReviews: DemoFriendFilmReview[] = [
  {
    id: "d1",
    reviewer: "Mika",
    movieTitle: "Past Lives",
    year: "2023",
    poster_path: "/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg",
    rating: 5,
    quote: "Quiet and devastating—the kind of film you talk about all week.",
    kind: "rated",
  },
  {
    id: "d2",
    reviewer: "Jules",
    movieTitle: "Everything Everywhere All at Once",
    year: "2022",
    poster_path: "/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg",
    rating: 5,
    quote: "Chaos in the best way. Already nagging everyone I know to watch.",
    kind: "rated",
  },
  {
    id: "d3",
    reviewer: "Sam",
    movieTitle: "The Batman",
    year: "2022",
    poster_path: "/74xTEgt7R36Fpooo50r9T25onhq.jpg",
    rating: 4,
    quote: "Heavy noir vibes—perfect for a rainy Friday with friends.",
    kind: "logged",
  },
  {
    id: "d4",
    reviewer: "Ravi",
    movieTitle: "Parasite",
    year: "2019",
    poster_path: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
    rating: 5,
    quote: "Still thinking about that staircase scene. Five stars, no notes.",
    kind: "rated",
  },
  {
    id: "d5",
    reviewer: "Nora",
    movieTitle: "Dune",
    year: "2021",
    poster_path: "/d5NXSklXo0qyIYkgV94XAgMIckC.jpg",
    rating: 4,
    quote: "Watched it twice this month—audio alone is worth the rental.",
    kind: "logged",
  },
  {
    id: "d6",
    reviewer: "Alex",
    movieTitle: "Spirited Away",
    year: "2001",
    poster_path: "/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
    rating: 5,
    quote: "Introduced it to my roommate—now our whole group is on Ghibli.",
    kind: "rated",
  },
];

const heroHeadlines = [
  "Stop scrolling. Start watching.",
  "See what your friends love.",
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

function Stars({ rating, tone = "indigo" }: { rating: number; tone?: "indigo" | "amber" }) {
  const active = tone === "amber" ? "text-amber-400" : "text-indigo-500";
  return (
    <span className="flex gap-0.5 text-sm" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={s <= rating ? active : "text-tertiary"}>★</span>
      ))}
    </span>
  );
}

function formatReviewDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Shown when there are fewer community submissions—real rows are preferred. */
const seedLandingAppReviews: Review[] = [
  {
    id: -201,
    user_id: "seed-app-1",
    reviewer_display_name: "Danyeul",
    rating: 5,
    body: "Finally a movie app that helps me pick in five minutes instead of forty.",
    created_at: "2026-05-01T20:00:00.000Z",
  },
  {
    id: -202,
    user_id: "seed-app-2",
    reviewer_display_name: "Mika",
    rating: 4,
    body: "The shortlist is tight and the friend activity actually makes watchlists useful.",
    created_at: "2026-04-28T20:00:00.000Z",
  },
  {
    id: -203,
    user_id: "seed-app-3",
    reviewer_display_name: "Jules",
    rating: 5,
    body: "Mood filters plus runtime is exactly what I wanted for weeknight picks.",
    created_at: "2026-04-25T20:00:00.000Z",
  },
  {
    id: -204,
    user_id: "seed-app-4",
    reviewer_display_name: "Sam",
    rating: 4,
    body: "Clean UI, fast decisions, and no pointless scrolling. Super solid.",
    created_at: "2026-04-21T20:00:00.000Z",
  },
  {
    id: -205,
    user_id: "seed-app-5",
    reviewer_display_name: "Priya",
    rating: 5,
    body: "Love that I can see overlap with friends before I commit to a three-hour epic.",
    created_at: "2026-04-18T20:00:00.000Z",
  },
  {
    id: -206,
    user_id: "seed-app-6",
    reviewer_display_name: "Chris",
    rating: 5,
    body: "The diary + recommendations combo finally replaced my messy notes app.",
    created_at: "2026-04-12T20:00:00.000Z",
  },
];

/**
 * Mirrors Framer's useScroll target offset ["start center","end center"] using native scroll events.
 * Some Windows browsers report unreliable scroll progress when multiple useScroll targets exist.
 */
function useManualSectionScrollProgress(element: HTMLElement | null) {
  const progress = useMotionValue(0);
  useLayoutEffect(() => {
    if (!element) return;
    const el = element;
    function tick() {
      const rect = el.getBoundingClientRect();
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

function FriendsFilmDemoCarousel({ reduceMotion }: { reduceMotion: boolean | null }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = demoFriendFilmReviews.length;

  useEffect(() => {
    if (reduceMotion || paused) return;
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % total);
    }, 5200);
    return () => window.clearInterval(id);
  }, [reduceMotion, paused, total]);

  const safeIdx = reduceMotion ? 0 : idx;
  const active = demoFriendFilmReviews[safeIdx] ?? demoFriendFilmReviews[0];

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-[var(--surface-border)] bg-[linear-gradient(135deg,rgba(99,102,241,.08),transparent_42%),var(--surface-2)] p-4 shadow-xl shadow-indigo-950/30 sm:p-5"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--surface-border)] pb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-indigo-500/85">
            Friend activity
          </p>
          <p className="mt-1 text-xs text-secondary">
            Example ratings and notes—your circle shows up here too.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-medium text-zinc-400">
          Demo preview
        </span>
      </div>

      <div
        className="relative mt-4 min-h-[148px] sm:min-h-[132px]"
        aria-live="polite"
        aria-label="Rotating examples of friend film reviews"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active.id}
            initial={reduceMotion ? false : { opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: -28 }}
            transition={{ duration: reduceMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="flex gap-4"
          >
            <div className="relative h-[132px] w-[88px] shrink-0 overflow-hidden rounded-xl border border-[var(--surface-border)] bg-black/40 shadow-lg sm:h-[140px] sm:w-[94px]">
              <TmdbImage
                src={posterUrl(active.poster_path, "w342") ?? ""}
                alt=""
                fill
                className="object-cover"
                sizes="94px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-2 gap-y-1">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-sm font-semibold text-indigo-300">
                  {active.reviewer.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-primary">{active.reviewer}</p>
                  <p className="text-[11px] text-tertiary">
                    {active.kind === "logged" ? "Logged" : "Rated"}{" "}
                    <span className="font-medium text-secondary">{active.movieTitle}</span>
                    <span className="text-tertiary"> ({active.year})</span>
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Stars rating={active.rating} />
                <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-1)] px-2 py-0.5 text-[10px] text-secondary">
                  {active.kind === "logged" ? "Diary entry" : "Review"}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-secondary">&ldquo;{active.quote}&rdquo;</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--surface-border)] pt-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Example friend reviews">
          {demoFriendFilmReviews.map((r, i) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={safeIdx === i}
              aria-label={`Example ${i + 1}: ${r.reviewer} on ${r.movieTitle}`}
              className={`h-2 rounded-full transition-all ${
                safeIdx === i ? "w-6 bg-indigo-500" : "w-2 bg-[var(--surface-border)] hover:bg-zinc-500/50"
              }`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
        <p className="text-[11px] text-tertiary">
          {reduceMotion ? "Showing first example (reduced motion)" : "Cycles automatically · Hover to pause"}
        </p>
      </div>
    </div>
  );
}

/**
 * Editorial spotlight carousel for app feedback—single “card” at a time, indigo accents to match the app.
 */
function LandingAppReviewsCarousel({
  items,
  reduceMotion,
  feedbackHref,
  feedbackCta,
}: {
  items: Review[];
  reduceMotion: boolean | null;
  feedbackHref: string;
  feedbackCta: string;
}) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = items.length;

  useEffect(() => {
    if (reduceMotion || total <= 1 || paused) return;
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % total);
    }, 6400);
    return () => window.clearInterval(id);
  }, [reduceMotion, paused, total]);

  useEffect(() => {
    setIdx((i) => (total ? Math.min(i, total - 1) : 0));
  }, [total]);

  if (total === 0) return null;

  const safeIdx = Math.min(idx, total - 1);
  const active = items[safeIdx] ?? items[0];

  const go = (dir: -1 | 1) => {
    setIdx((i) => (i + dir + total) % total);
  };

  return (
    <div
      className="relative mt-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="relative overflow-hidden rounded-[28px] border border-indigo-400/20 bg-[var(--surface-1)] shadow-[0_28px_80px_-24px_rgba(99,102,241,0.2)]"
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.55] [background:radial-gradient(ellipse_80%_50%_at_0%_0%,rgba(129,140,248,0.16),transparent_50%),radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(167,139,250,0.09),transparent_45%)]"
        />
        <div className="relative px-5 pb-6 pt-8 sm:px-10 sm:pb-8 sm:pt-10">
          <p
            aria-hidden
            className="pointer-events-none absolute left-4 top-2 font-serif text-7xl leading-none text-indigo-400/18 sm:left-8 sm:text-8xl"
          >
            &ldquo;
          </p>

          <div className="relative mx-auto max-w-2xl text-center" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active.id}
                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
                transition={{ duration: reduceMotion ? 0 : 0.38, ease: [0.22, 1, 0.36, 1] }}
                className="px-1"
              >
                <Stars rating={active.rating} tone="amber" />
                <blockquote className="mt-4 font-serif text-lg leading-relaxed text-primary sm:text-xl">
                  {active.body}
                </blockquote>
                <footer className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm">
                  <cite className="not-italic font-semibold text-secondary">{active.reviewer_display_name}</cite>
                  <span className="hidden text-tertiary sm:inline" aria-hidden>
                    ·
                  </span>
                  <span className="text-xs text-tertiary sm:text-sm">{formatReviewDate(active.created_at)}</span>
                </footer>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="relative mt-8 flex max-w-md items-center justify-between gap-3 sm:mx-auto sm:mt-10">
            <button
              type="button"
              onClick={() => go(-1)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-indigo-400/35 bg-[var(--surface-2)] text-lg text-indigo-200 transition hover:border-indigo-300/55 hover:bg-indigo-500/10"
              aria-label="Previous review"
            >
              ‹
            </button>
            <div
              className="flex min-h-[2rem] flex-1 flex-wrap items-center justify-center gap-1.5 px-1 sm:gap-2"
              role="tablist"
              aria-label="Reviews"
            >
              {items.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  role="tab"
                  aria-selected={safeIdx === i}
                  aria-label={`Review ${i + 1} of ${total}: ${r.reviewer_display_name}`}
                  onClick={() => setIdx(i)}
                  className={`rounded-full transition-all ${
                    safeIdx === i
                      ? "h-2 w-7 bg-indigo-400 shadow-[0_0_12px_-2px_rgba(129,140,248,0.65)] sm:w-8"
                      : "h-2 w-2 bg-[var(--surface-border)] hover:bg-indigo-400/35"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => go(1)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-indigo-400/35 bg-[var(--surface-2)] text-lg text-indigo-200 transition hover:border-indigo-300/55 hover:bg-indigo-500/10"
              aria-label="Next review"
            >
              ›
            </button>
          </div>

          <p className="mt-4 text-center text-[11px] text-tertiary">
            {reduceMotion
              ? "Use arrows or dots to browse (reduced motion)"
              : "Advances on its own · Hover to pause"}
          </p>

          <div className="mt-6 flex justify-center border-t border-[var(--surface-border)] pt-6">
            <Link
              href={feedbackHref}
              className="rounded-full border border-indigo-400/35 bg-indigo-500/10 px-5 py-2.5 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/20"
            >
              {feedbackCta}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomeLandingClient({ user, reviews, heroMovies, suggestionsByVibe }: Props) {
  const reduceMotion = useReducedMotion();
  const hasReviewed = user ? reviews.some((r) => r.user_id === user.id) : false;
  const appReviewsForCarousel = useMemo(() => {
    const real = reviews.filter((r) => (r.body ?? "").trim().length > 0);
    const byId = new Map<number, Review>();
    for (const r of real) byId.set(r.id, r);
    for (const s of seedLandingAppReviews) {
      if (byId.size >= 10) break;
      if (!byId.has(s.id)) byId.set(s.id, s);
    }
    return Array.from(byId.values()).slice(0, 10);
  }, [reviews]);
  const [heroLineIdx, setHeroLineIdx] = useState(0);
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

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setHeroLineIdx((prev) => (prev + 1) % heroHeadlines.length);
    }, 7200);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

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
                <TmdbImage
                  src={posterUrl(heroImages[activeHeroIdx].backdrop_path, "w1280") ?? ""}
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
          <motion.div variants={item} transition={{ duration: 0.55 }} className="mt-7 min-h-[5.5rem] max-w-3xl sm:min-h-[7.25rem] lg:min-h-[8rem]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.h1
                key={reduceMotion ? heroHeadlines[0] : heroHeadlines[heroLineIdx]}
                initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
                transition={{ duration: reduceMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="text-4xl font-bold leading-[1.06] tracking-tight text-white sm:text-6xl lg:text-[4.3rem]"
              >
                {reduceMotion ? heroHeadlines[0] : heroHeadlines[heroLineIdx]}
              </motion.h1>
            </AnimatePresence>
          </motion.div>
          <motion.p variants={item} transition={{ duration: 0.55 }} className="mt-5 max-w-xl text-base leading-relaxed text-zinc-200/80 sm:text-lg">
            Curated picks for your mood—plus your friends&apos; ratings, watchlists, and diary so you
            can decide together without the endless scroll.
          </motion.p>
          <motion.ul variants={item} transition={{ duration: 0.55 }} className="mt-5 grid max-w-2xl gap-2 text-sm text-zinc-200/80 sm:grid-cols-3">
            <li className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 backdrop-blur-sm">
              Find a film fast—filters that match how tonight feels
            </li>
            <li className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 backdrop-blur-sm">
              Track watched, watchlist, and quick notes in one place
            </li>
            <li className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 backdrop-blur-sm">
              Follow friends and spot what they rated before you choose
            </li>
          </motion.ul>
          <motion.div variants={item} transition={{ duration: 0.55 }} className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <MagneticButton href="/recommend" strong>
              Find a film tonight
            </MagneticButton>
            <MagneticButton href="/friends">See friend activity</MagneticButton>
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
                                <TmdbImage
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
                Watch together—not alone in the algorithm.
              </h3>
              <p className="mt-2 text-sm text-secondary">
                Follow people you trust, skim their ratings and diary, and spot overlaps before you
                commit to a film.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/friends"
                className="rounded-full border border-indigo-400/45 bg-indigo-500/20 px-4 py-2 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/30"
              >
                Friends
              </Link>
              <Link
                href={user ? "/feedback" : "/login?redirect=/feedback"}
                className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-1)] px-4 py-2 text-sm font-semibold text-primary transition hover:bg-[var(--surface-2)]"
              >
                {hasReviewed ? "Edit your review" : "Add a review"}
              </Link>
            </div>
          </div>

          <ProductDemoScrollReveal
            as="article"
            progress={communityScrollProgress}
            reduceMotion={Boolean(reduceMotion)}
            start={0.02}
            end={0.18}
            y={14}
            className="mb-6"
          >
            <FriendsFilmDemoCarousel reduceMotion={reduceMotion} />
          </ProductDemoScrollReveal>

          <div className="grid gap-3 lg:grid-cols-2">
            <ProductDemoScrollReveal
              as="article"
              progress={communityScrollProgress}
              reduceMotion={Boolean(reduceMotion)}
              start={0.22}
              end={0.42}
              y={20}
              className="surface-card rounded-2xl p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500/75">
                Friends feed
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-tertiary">
                New ratings, diary logs, and watchlist adds from people you follow—same ideas as the
                carousel, in a live stream.
              </p>
              <div className="mt-3 space-y-2">
                {[
                  "Jules rated The Shining ★★★★☆",
                  "Mika added Psycho to watchlist",
                  "Sam reviewed Cure: “cold and precise”",
                ].map((itemText) => (
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
              start={0.34}
              end={0.56}
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
      </section>

      <section className="relative overflow-hidden border-t border-[var(--surface-border)] py-14 sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/35 to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 top-10 h-64 w-64 rounded-full bg-indigo-500/[0.09] blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 bottom-0 h-48 w-48 rounded-full bg-rose-500/[0.06] blur-3xl"
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-5 lg:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-400/90">
              Word on {APP_NAME}
            </p>
            <h3 className="mt-3 font-sans text-2xl font-bold tracking-tight text-primary sm:text-3xl">
              Reviews from people who use it every week
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-secondary sm:text-base">
              Real notes about the app itself—what clicked, what saved time, and why they stuck around.
              Mixed with a few stand-ins when we&apos;re still gathering fresh quotes.
            </p>
          </div>

          <LandingAppReviewsCarousel
            items={appReviewsForCarousel}
            reduceMotion={reduceMotion}
            feedbackHref={user ? "/feedback" : "/login?redirect=/feedback"}
            feedbackCta={hasReviewed ? "Edit your review" : "Add your review"}
          />
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
