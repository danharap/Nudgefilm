import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ImportWizard } from "./ImportWizard";

export const metadata = {
  title: "Import from Letterboxd",
  description:
    "Move your watch history, ratings, reviews, and watchlist from Letterboxd in a few clicks.",
};

export default async function ImportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/import");
  }

  return (
    <main className="min-h-screen">
      <div className="border-b border-[var(--surface-border)] bg-gradient-to-b from-[var(--surface-1)] to-transparent px-4 py-8 text-center">
        <div className="mx-auto max-w-xl">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-500">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Letterboxd Import
          </div>
          <h1 className="mt-2 text-2xl font-bold text-primary sm:text-3xl">
            Letterboxd import
          </h1>
          <p className="mt-2 text-sm text-secondary">
            Upload your export zip and we&apos;ll match films to your library.
          </p>
        </div>
      </div>
      <ImportWizard userId={user.id} signedInEmail={user.email ?? null} />
    </main>
  );
}
