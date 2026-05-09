/**
 * Human-readable URL segments for movie/show pages (Letterboxd-style slug + TMDb id).
 * Format: `/movie/my-neighbor-totoro-8392` — trailing `-{id}` is the canonical TMDb id.
 */

export function titleToSlug(title: string): string {
  const s = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return s.length > 0 ? s : "title";
}

/** Path segment only, e.g. `my-neighbor-totoro-8392`. */
export function movieDetailSegment(title: string, tmdbId: number): string {
  return `${titleToSlug(title)}-${tmdbId}`;
}

export function movieDetailPath(title: string, tmdbId: number): string {
  return `/movie/${movieDetailSegment(title, tmdbId)}`;
}

export function tvDetailSegment(seriesName: string, tmdbId: number): string {
  return `${titleToSlug(seriesName)}-${tmdbId}`;
}

export function tvDetailPath(seriesName: string, tmdbId: number): string {
  return `/show/${tvDetailSegment(seriesName, tmdbId)}`;
}

/** Browse / search cards: unified title + id + media type. */
export function browseMediaPath(
  title: string,
  tmdbId: number,
  mediaType: "movie" | "tv" | undefined,
): string {
  if (mediaType === "tv") return tvDetailPath(title, tmdbId);
  return movieDetailPath(title, tmdbId);
}

/**
 * Resolve TMDb id from the dynamic route param.
 * Accepts legacy `/movie/8392` (digits only) or `/movie/name-8392`.
 */
export function parseTrailingTmdbIdFromSlugParam(raw: string): number | null {
  const decoded = decodeURIComponent(raw.trim());
  if (/^\d+$/.test(decoded)) {
    const n = parseInt(decoded, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const m = decoded.match(/-(\d+)$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
