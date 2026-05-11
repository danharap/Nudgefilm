-- Age-gate and mature-content preference columns.
-- New users default to false (restricted) and set their preference during onboarding.
-- All accounts that existed before this feature is introduced are backfilled to true
-- so they keep the unrestricted experience they always had.

-- ────────────────────────────────────────────────────────────────
-- 1. Add columns (nullable so the backfill below can distinguish
--    "never set" from "explicitly set to false").
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_18_plus        boolean,
  ADD COLUMN IF NOT EXISTS show_mature_content boolean;

COMMENT ON COLUMN public.profiles.is_18_plus IS
  'User confirmed they are 18+. Set during onboarding; pre-feature accounts backfilled to true.';

COMMENT ON COLUMN public.profiles.show_mature_content IS
  'Whether to surface mature/R-rated content in recommendations and browse. '
  'Defaults to false for new users; pre-feature accounts backfilled to true.';

-- ────────────────────────────────────────────────────────────────
-- 2. Backfill: existing users get unrestricted access (grandfathered).
--    COALESCE leaves any value that was already explicitly set untouched.
--    onboarding_completed_at is also filled so pre-feature accounts are
--    never routed into the new content-preference onboarding wizard on
--    their next login (post-login route redirects to /onboarding when NULL).
-- ────────────────────────────────────────────────────────────────
UPDATE public.profiles
SET
  is_18_plus              = COALESCE(is_18_plus, true),
  show_mature_content     = COALESCE(show_mature_content, true),
  onboarding_completed_at = COALESCE(onboarding_completed_at, created_at)
WHERE
  is_18_plus IS NULL
  OR show_mature_content IS NULL
  OR onboarding_completed_at IS NULL;

-- ────────────────────────────────────────────────────────────────
-- 3. Set column defaults for new accounts.
--    New users start restricted and unlock mature content after
--    completing the onboarding content-preference step.
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ALTER COLUMN is_18_plus          SET DEFAULT false,
  ALTER COLUMN show_mature_content SET DEFAULT false;
