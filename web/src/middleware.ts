import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /*
   * Only run session refresh middleware on routes that actually need
   * server-side auth state. Public discovery pages (movie, show, person,
   * browse, recommend, search) load user state client-side, so they do
   * NOT need middleware — keeping them out cuts ~80% of middleware invocations.
   */
  matcher: [
    "/profile/:path*",
    "/watchlist/:path*",
    "/watched/:path*",
    "/friends/:path*",
    "/social/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/import/:path*",
    "/onboarding/:path*",
    "/auth/:path*",
    "/blend/:path*",
  ],
};
