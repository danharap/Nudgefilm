import withPWAInit from "@ducanh2912/next-pwa";
import type { NextConfig } from "next";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  // Disabled: aggressiveFrontEndNavCaching caused the service worker to
  // proactively fetch every linked page on load, generating millions of
  // Vercel Observability events per day across all users.
  aggressiveFrontEndNavCaching: false,
  // Disabled: reloadOnOnline triggered a full-page reload + re-fetch cascade
  // every time a user came back online, each hit counting as an event.
  reloadOnOnline: false,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
      {
        // Supabase Storage (covers all project subdomains)
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default withPWA(nextConfig);
