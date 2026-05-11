# Nudge Film — App Overview

> Drop this file into a chat with ChatGPT (or any other assistant) so it has full context on what the product is, how it’s built, and how the pieces fit together. Updated as features ship. Last reviewed: onboarding acquisition (`heard_from`), routes, and admin analytics (May 2026).

---

## 1. Elevator pitch

**Nudge Film** helps indecisive viewers stop scrolling and pick something to watch. The user describes a vibe (cozy, tense, weird, funny, etc.) and an optional set of constraints (genre, era, runtime, hidden-gem mode, language) and the app returns a **tight curated shortlist** instead of an endless wall of results.

Around that core loop there’s a full social movie-tracker: **watchlist**, **watch diary** with ratings + notes, **friends and follows**, **profile lists**, **TV shows + seasons**, **Letterboxd import**, and an **admin panel** for moderation and analytics.

Production: <https://www.nudgefilm.com> (custom domain on Vercel).

---

## 2. Tech stack

- **Framework:** Next.js 15 (App Router, RSC + Server Actions, Turbopack dev), React 19, TypeScript.
- **Styling:** Tailwind CSS v4.
- **State:** Redux Toolkit (admin UI + a few UI slices) + React component state. Most server data flows through RSC and Server Actions.
- **Auth + DB:** Supabase — Auth (email + password, **Google OAuth**), Postgres, Row-Level Security, Storage (avatars, banners, backdrops).
- **External data:** TMDb (movies, TV shows, seasons, search, genres, posters, backdrops).
- **Optional LLM re-rank:** OpenAI Chat Completions (only if `OPENAI_API_KEY` is set; falls back gracefully).
- **PWA:** `@ducanh2912/next-pwa` (installable, offline shell).
- **Deployment:** Vercel (Production + Previews). Root Directory must be `web/`.
- **Toasts:** sonner (most pages) and a tiny in-house Redux-driven toast in admin.
- **Charts:** Recharts (admin analytics).
- **Imports:** PapaParse + fflate (Letterboxd ZIP/CSV parsing).
- **Cropping:** react-easy-crop (avatar / banner / backdrop).

---

## 3. Repo layout

```
Nudgefilm/                       # repository root (or your local clone name)
├─ web/                          # Next.js 15 app (the deployed product)
│  └─ src/
│     ├─ app/                    # Routes (App Router)
│     ├─ components/             # Shared UI (header, mobile menu, social, ui)
│     ├─ config/                 # Brand strings, mood mappings, TMDb genres
│     ├─ features/               # Domain logic (recommendations, users, feedback)
│     ├─ lib/                    # Supabase clients, TMDb client, RBAC, Letterboxd parser, analytics
│     └─ store/                  # Redux store + slices (admin, ui, etc.)
├─ supabase/
│  ├─ migrations/                # SQL migrations (in order) — source of truth for schema
│  └─ README.md
├─ archive/                      # Old FastAPI backend (not deployed; reference only)
├─ OVERVIEW.md                   # ← this file
└─ README.md                     # Setup + deploy instructions
```

Branding is centralised in `web/src/config/brand.ts` (`APP_NAME = "Nudge Film"`).

---

## 4. Routes (App Router)

### Public

| Path | What it is |
|---|---|
| `/` | Landing page (`HomeLanding`) — pitch, feature highlights, CTAs. Also forwards `?code=` PKCE confirms into `/auth/callback`. |
| `/login` | Email + password sign-in, optional **Continue with Google** (`GoogleOAuthSection`). Shows messages like “email_verified”. |
| `/signup` | Sign-up: **Display name + Username + Email + Password** and/or Google. Server validates username (3–24 chars, `a–z 0–9 _`), pre-checks uniqueness, redirects to `?message=check_email` for email flow. |
| `/auth/callback` | Exchanges `?code=` for a session. **Email confirm** links use `post_verify=login` → session is created, user is **signed out**, redirect to `/login?message=email_verified`. **OAuth (e.g. Google)** uses `next=/auth/post-login` (or another safe path) → session kept, redirect to `next`; `syncProfileFromAuthUser` runs for OAuth users. |
| `/auth/post-login` | Post-login router: if `profiles.onboarding_completed_at` is null → `/onboarding`, otherwise `/profile`. |
| `/recommend` | The core “pick a vibe” form (`RecommendClient`). Submits to `/api/recommendations`. |
| `/results` | Renders the curated shortlist returned from the recommendation API. |
| `/browse` | Trending / popular / now-playing for **movies** and **TV** (TMDb). Cards show watched/watchlisted state and toggle add/remove. |
| `/movie/[slug]` | Film detail — URL uses a readable **slug** with a trailing TMDb movie id (see `lib/media-slug`). Poster, backdrop, synopsis, cast/crew tabs, friends’ ratings, diary entry, watchlist toggle, log/rate form. |
| `/show/[slug]` | TV show detail — same slug pattern for the **show** TMDb id. Seasons list; each season rateable via `SeasonRater` (season rows use the **20M+** id offset in `movies`). |
| `/person/[tmdbPersonId]` | Person (actor/director/writer) detail from TMDb — filmography with sort/filter, links back to movie/show pages. |
| `/feedback` | App-level reviews + a form for new submissions. |
| `/user/[username]` | Public profile (banner, avatar, lists, films, friends button). Respects `is_public` and `watchlist_public`. |
| `/user/[username]/followers` · `/user/[username]/following` | Public follower/following lists for that profile. |

### Authenticated (gated by middleware)

| Path | What it is |
|---|---|
| `/onboarding` | First-run wizard: **welcome → “how did you hear about us?” (optional) → Letterboxd question → guide or all-set**. On finish, `completeOnboarding` sets `profiles.onboarding_completed_at` and, if the user picked an option, **`profiles.heard_from`** (`friend` \| `social` \| `search` \| `other`) — only written once (skips stay null). |
| `/profile` | Your own profile: banner + avatar + edit form, favourites picker, films (movies + series tabs), profile lists, recent activity. |
| `/profile/followers` · `/profile/following` | Your social lists (who follows you / who you follow). |
| `/settings` | **Account hub** — email/providers, profile look (avatar/banner/backdrop crops), privacy (`is_public`, `watchlist_public`), discovery preferences. **Not** listed in middleware `PROTECTED`; the page redirects to `/login?redirect=/settings` if signed out. |
| `/watchlist` | Your watchlist (films you’ve queued). |
| `/watched` | Your watch diary (films you’ve logged, with rating/notes). |
| `/friends` | Friends list, pending requests, social activity, user search. |
| `/import` | Multi-step Letterboxd import wizard: **welcome → upload ZIP → match/preview → summary** (APIs persist matches + optional fix-ratings). |
| `/admin` | Admin dashboard — gated by role check (`admin` or `super_admin`). Sub-routes: `users`, `analytics`, `feedback`, `logs`. |

### API routes

- `POST /api/recommendations` — runs the recommendation engine (TMDb discover + scoring) and an optional LLM re-rank. Logs the session into `recommendation_sessions` for the user.
- `POST /api/movies/search` — TMDb search proxy.
- `POST /api/users/search` — Username/display-name search for the friend finder.
- `POST /api/import/match` — Match parsed Letterboxd rows against TMDb.
- `POST /api/import/save` — Persist matched rows into `watched_movies` / `watchlist`.
- `POST /api/import/fix-ratings` — Backfill ratings for already-imported titles.

Session refresh lives in `web/src/lib/supabase/middleware.ts` (called from `web/src/middleware.ts`). Unauthenticated users are redirected to `/login?redirect=…` for: `/watchlist`, `/watched`, `/profile`, `/friends`, `/import`, `/onboarding`, `/admin` (including subpaths like `/admin/users`). Other authenticated pages (e.g. `/settings`) enforce auth inside the route.

---

## 5. Core feature flows

### 5.1 Recommendation engine (the headline feature)

1. User picks vibes (multi-select chips), optional genres, era window, runtime range, min vote average, hidden-gem toggle, language.
2. `runRecommendationEngine`:
   - Translates vibes into TMDb genre buckets via `config/moodMappings`.
   - Detects **conflicts** (e.g. “cozy” + “dark” genre) using `config/recommendationSignals`. In conflict mode, **bridge films** (dual-tagged) get a boost.
   - Calls TMDb `/discover/movie` with composed filters and pulls back candidates.
   - Scores each candidate with a **composite score** (genre fit, vibe fit, vote average, popularity, hidden-gem floor) and shuffles tied items deterministically.
   - Excludes any TMDb IDs from the user’s watched + dismissed history.
3. Optional `llmRerank` (OpenAI): given the candidate list, returns 4–8 picks plus an optional `conflictExplanation`. **It cannot invent movies** — only re-orders/filters the candidates we send it. Falls back to engine output if the call fails or no key is set.
4. `recommendation_sessions` row is inserted (input payload + result IDs) so we can show history and audit.
5. `/results` renders the shortlist with a “why this pick” reason per item, watch / watchlist actions, and a “find similar” link per movie.

### 5.2 Movie detail / TV detail

- Server component fetches:
  - TMDb details (title, poster, backdrop, runtime, votes, genres).
  - Existing diary entry (rating + notes) if logged in.
  - **Watchlist membership** (so the watchlist button can toggle to “Remove”).
  - Friends’ ratings on this title (joins `friendships` + `watched_movies` + `profiles`).
- `MovieActions` / `ShowActions` (client) handle:
  - Log/rate inline with notes.
  - Watchlist **add/remove toggle** with optimistic UI.
- TV pages additionally render `SeasonRater` per season; seasons are stored as separate rows with a **20M ID offset** so they don’t collide with movie IDs.

### 5.3 Browse

- Three tabs: All / Movies / TV. Each pulls trending + popular + now-playing/airing from TMDb in parallel.
- Cards (`BrowseMovieCard`) reflect your library: **Watched** badge if logged, **Queued — Remove** if on watchlist (toggle in place).
- Has a search bar (`BrowseSearch`) hitting `/api/movies/search`.

### 5.4 Watchlist + Watched

- `/watchlist`: cards list with a Remove button per item.
- `/watched`: chronological diary with rating, notes, watched-at date.
- Both are revalidated via `revalidatePath` whenever a server action mutates their underlying tables (e.g. `markWatched`, `addToWatchlist`, `removeFromWatchlist`).

### 5.5 Profile

- Banner (8:3 strip, edge-to-edge on mobile), avatar, display name, `@username`, bio, follow stats, edit-profile drawer.
- Sections: **Stats** (films watched, series watched, average rating), **Favourites picker** (4 slots), **Films** (movies/series tabs), **Profile lists** (custom themed lists with poster grids and reorderable items).
- Public profile at `/user/[username]` mirrors the same shape but respects `is_public` and `watchlist_public` flags.

### 5.6 Friends + social

- Friend requests (`friendships` table with `pending` / `accepted`). Either side can accept.
- Follows (`follows` table — directional, e.g. like Instagram).
- Activity feed: friends’ recent watches, ratings, and watchlist additions.
- User search by username prefix and display name.

### 5.7 Letterboxd import

- Wizard steps: **Welcome → Upload → Matching** (with optional preview) **→ Summary**.
- Accepts the official Letterboxd ZIP **without unzipping** (parsed with `fflate` + `papaparse`).
- Pulls watched, ratings, reviews, watchlist, liked films from the included CSVs.
- Matches each title against TMDb (with year disambiguation) and saves into `watched_movies` and `watchlist`. Rewrites are idempotent; you can re-run a fix-ratings pass.
- Surfaces import progress and a final summary.

### 5.8 Admin (admin / super_admin only)

- Sidebar layout (`/admin`) gated in `app/admin/layout.tsx`.
- **Overview**: total users, signups by day/week/month, totals for watched, watchlist, ratings, feedback; recent signups (with **Heard:** when `heard_from` is set), recent activity feed.
- **Users**: full table, filter by role/status/search, **“Heard from”** column (onboarding acquisition), change role (super_admin only), suspend/ban, edit admin notes inline, and **permanently delete** an account via Supabase Auth admin (cascades to `profiles` and dependent tables; logs to `role_audit_logs`).
- **Analytics**: **“How users heard about Nudge Film”** breakdown (counts + % from `profiles.heard_from`, including not answered); charts of signups and event volume from `analytics_events` (recharts).
- **Feedback**: list, sort, delete moderation actions.
- **Audit logs**: read-only role/admin action history.

A small in-house toast (`AdminToast`) handles success/error feedback in admin and **auto-dismisses after 4.5 s**.

---

## 6. Data model (Supabase Postgres)

All migrations live in `supabase/migrations/` and are the source of truth. Highlights:

- `profiles` — 1:1 with `auth.users` (cascade on delete). Columns: `id`, `email`, `display_name`, `username` (unique, regex `^[a-z0-9_]{3,24}$`), `bio`, `avatar_url`, `banner_url`, `profile_background_url`, `is_public`, `watchlist_public`, `role` (`user | moderator | admin | super_admin`), `status` (`active | suspended | banned`), `admin_notes`, `last_active_at`, `onboarding_completed_at`, **`heard_from`** (nullable; `friend` \| `social` \| `search` \| `other` — set once from onboarding when the user answers), **`social_inbox_last_read_at`** (social inbox read cursor). RLS allows: own-read/write, public-read when `is_public`, admin/super_admin read+update on others. A trigger blocks role changes by anyone except the service role.
- `movies` — TMDb cache: `tmdb_id` unique, title, year, poster, backdrop, overview, runtime, vote_average, vote_count, genres jsonb. Reused for both films and TV (with offsets):
  - `tmdb_id < 10_000_000` → movie
  - `tmdb_id` in `[10M, 20M)` → TV show (offset 10M)
  - `tmdb_id ≥ 20M` → TV season (offset 20M); `vote_count` stores the parent show TMDb ID so we can link back to `/show/[id]`.
- `watched_movies` — diary: `(user_id, movie_id)` unique, `user_rating`, `notes`, `watched_at`.
- `watchlist` — `(user_id, movie_id)` unique.
- `dismissed_movies` — items the user wants excluded from future recs.
- `favourite_movies` — 4 ordered slots per user (`position` 1–4, unique with `user_id`).
- `friendships` — `(requester_id, addressee_id)` with `status` `pending|accepted`.
- `follows` — directional `(follower_id, following_id)`.
- `profile_lists` + `profile_list_movies` — user-defined themed lists (name, emoji, public flag, ordered items).
- `app_feedback` — 1 row per user (rating + body, `reviewer_display_name` snapshot).
- `recommendation_sessions` — saved input + result IDs per recommendation run.
- `letterboxd_imports` — one row per import attempt (`status`, `stats` jsonb) for progress/audit; film rows still live in `watched_movies` / `watchlist`.
- `user_preferences` — favourite genres, default runtime, language, tone preferences.
- `analytics_events` — append-only event log (event_name, user_id, properties jsonb). Authenticated users may insert their own.
- `role_audit_logs` — admin actions (role changes, suspensions, deletions).

RLS is enabled on every table. The signup trigger `handle_new_user()` copies `display_name` and `username` from `raw_user_meta_data` into `profiles` when a new auth user is created.

---

## 7. Auth flow

**Email + password**

1. User submits the sign-up form (`/signup` → `signUpWithEmail` action).
2. Server validates the username regex, **pre-checks uniqueness** in `profiles`, then calls `supabase.auth.signUp` with metadata `{ display_name, username }`.
3. Supabase emails a confirmation link → `/auth/callback?post_verify=login`.
4. Callback exchanges the code, then **signs the user out** so they log in deliberately.
5. `/login` form authenticates and routes to `/auth/post-login`, which sends them to `/onboarding` (first run) or `/profile`.

**Google OAuth** — user starts from `/login` or `/signup` via `GoogleOAuthSection`; Supabase handles the provider flow and callback. No separate “check your email” step; profile/onboarding routing still goes through `/auth/post-login` when that’s the `redirect` target.

If the username collides at insert time (race), the signup error is mapped to “That username was just taken — pick another” and the form re-populates the user’s typed values.

---

## 8. Roles + RBAC

- `user` (default) — normal app access.
- `moderator` — currently a **reserved label**. Database policies and `requireAdmin()` do not grant moderator access; the admin layout blocks them. (UI consistency note: `SiteHeader` includes moderators in `isAdmin`, which is a small mismatch we’ll align later.)
- `admin` — full admin dashboard, can change user status, edit notes, moderate feedback, view analytics + logs.
- `super_admin` — everything `admin` does, plus role changes and **permanent account deletion**.

`web/src/lib/admin/rbac.ts` exposes `getSessionWithRole`, `requireRole`, `requireAdmin`, `requireSuperAdmin`. Server actions in `app/actions/admin.ts` always start with one of these guards.

---

## 9. Key files (cheat sheet)

- **Recommendation engine:** `web/src/features/recommendations/engine.ts`, `llmRank.ts`, `schema.ts`
- **TMDb client:** `web/src/lib/tmdb/client.ts`, `lib/tmdb/constants.ts` (offsets + URL helpers)
- **Supabase clients:** `web/src/lib/supabase/{server,client,middleware,admin}.ts`
- **Auth actions:** `web/src/app/actions/auth.ts`
- **OAuth callback + profile sync:** `web/src/app/auth/callback/route.ts`, `web/src/features/profile/syncProfileFromAuthUser.ts`
- **Library actions (watch/watchlist/dismiss/favs/TV):** `web/src/app/actions/library.ts`
- **Social actions (friends, follows, profile updates):** `web/src/app/actions/social.ts`
- **Admin actions:** `web/src/app/actions/admin.ts`
- **Letterboxd parser:** `web/src/lib/letterboxd/parser.ts`
- **Analytics tracker:** `web/src/lib/analytics/track.ts`
- **Site header / mobile nav:** `web/src/components/layout/SiteHeader.tsx`, `MobileMenu.tsx`
- **Movie detail UI:** `web/src/app/movie/[slug]/{page,MovieActions}.tsx`
- **Show detail UI:** `web/src/app/show/[slug]/{page,ShowActions,SeasonRater}.tsx`
- **Person detail:** `web/src/app/person/[tmdbPersonId]/page.tsx`
- **Settings:** `web/src/app/settings/{page,SettingsHub}.tsx`
- **Onboarding:** `web/src/app/onboarding/{page,OnboardingWizard}.tsx`, `web/src/app/onboarding/actions.ts` (`completeOnboarding`)
- **Admin UI:** `web/src/app/admin/**`

---

## 10. Environments + deployment

- **Production:** Vercel project `nudgefilm` → custom domain `nudgefilm.com` (and `www`). Production branch: `main`. Root Directory must be `web/`.
- **Required env vars (Vercel + `web/.env.local`):**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy JWT — match the JS client)
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only — used for admin role/delete actions)
  - `TMDB_READ_ACCESS_TOKEN` *or* `TMDB_API_KEY`
  - `NEXT_PUBLIC_SITE_URL` (e.g. `https://nudgefilm.com` or `http://localhost:3000`)
  - Optional: `OPENAI_API_KEY` (enables LLM re-rank)
- **Supabase Auth → URL configuration:** add localhost + production + each preview to redirect URLs.

---

## 11. PWA

- `next-pwa` is enabled (aggressive front-end nav caching) so the app is installable and survives flaky networks.
- `manifest.ts` defines name, icons, shortcuts to “Get a Recommendation” and “My Watchlist”.
- After deploys, a stale service worker can occasionally pin an old build — clearing site data or hard-reloading fixes it.

---

## 12. Conventions + style

- Prefer **Server Actions** for mutations; use API routes only when an external system calls us or when streaming-style work makes sense (recommendations are still POST API for clearer caching control).
- Always validate inputs with Zod at the boundary (recommendation input, feedback, etc.).
- Wrap potentially-failing actions with a small `run()` helper in client components for optimistic state + error toasts.
- Tailwind utility classes only; no global stylesheets beyond `app/globals.css`.
- All new SQL goes through a fresh `supabase/migrations/<timestamp>_<name>.sql` file.

---

## 13. Known small TODOs

- Align `SiteHeader.isAdmin` with the actual admin route gate (currently includes `moderator` even though `/admin` blocks them).
- Add an explicit “moderator” permission tier server-side once we want a lighter-weight admin role.
- Consider trimming RLS recheck overhead per Supabase advisor warnings (`auth.<fn>()` → `(select auth.<fn>())`).
- Cache `SiteHeader` profile lookup with a short tag invalidated on profile updates to drop a Supabase round-trip per nav.
