import NextImage, { type ImageProps } from "next/image";

/**
 * Thin wrapper around next/image for TMDB CDN images.
 *
 * TMDB already serves correctly-sized, optimized images from their global CDN
 * (w92, w342, w500, w1280, etc.). Routing those through Vercel's image optimizer
 * adds no quality improvement and consumes free-tier transformation credits.
 * Setting unoptimized={true} bypasses Vercel's optimizer so images are served
 * directly from the TMDB CDN — zero transformations counted.
 *
 * All standard next/image props are supported; callers only need to change the import.
 */
export default function TmdbImage(props: ImageProps) {
  return <NextImage unoptimized {...props} />;
}
