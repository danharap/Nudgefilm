import { SiteHeader } from "@/components/layout/SiteHeader";
import { APP_NAME } from "@/config/brand";
import { getConfiguredOrigin, getMetadataBase } from "@/lib/site-url";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: `${APP_NAME} — quick picks & your watch log`,
  description:
    `${APP_NAME}: strict genre-aware suggestions from TMDb, plus watchlist and watched history in Supabase.`,
  applicationName: APP_NAME,
  openGraph: {
    type: "website",
    locale: "en",
    url: getConfiguredOrigin(),
    siteName: APP_NAME,
    title: `${APP_NAME} — quick picks & your watch log`,
    description:
      `${APP_NAME}: strict genre-aware suggestions from TMDb, plus watchlist and watched history in Supabase.`,
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — quick picks & your watch log`,
    description:
      `${APP_NAME}: strict genre-aware suggestions from TMDb, plus watchlist and watched history in Supabase.`,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#09090b" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('nudge-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}else{document.documentElement.setAttribute('data-theme','dark');}}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();",
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col antialiased`}
      >
        <SiteHeader />
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
        <Toaster
          position="top-right"
          richColors
          toastOptions={{
            style: {
              background: "var(--surface-1)",
              border: "1px solid var(--surface-border)",
              color: "var(--text-primary)",
              backdropFilter: "blur(20px)",
              borderRadius: "14px",
              fontSize: "13px",
              padding: "12px 14px",
            },
            className: "shadow-2xl shadow-indigo-950/50",
          }}
        />
        <footer className="border-t border-[var(--surface-border)] py-8 text-center text-xs text-tertiary">
          Data provided by{" "}
          <a
            href="https://www.themoviedb.org/"
            className="text-secondary underline-offset-2 hover:text-primary hover:underline"
          >
            TMDb
          </a>
          . Not endorsed or certified by TMDb.
        </footer>
        <Analytics />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
