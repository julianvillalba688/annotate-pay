-- =============================================================================
-- AnnotatePay - onboarding status
-- =============================================================================
-- The profile-level status is persisted in Supabase so it follows the user
-- across devices. TEXT plus a CHECK constraint keeps the state extensible:
-- future states can be introduced by a follow-up migration.

-- -----------------------------------------------------------------------------
-- Onboarding state
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_status TEXT NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_onboarding_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_onboarding_status_check
      CHECK (onboarding_status IN ('pending', 'skipped', 'completed'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.profiles.onboarding_status IS
  'Persisted onboarding state: pending, skipped, or completed. Stored as TEXT so future states can be added by migration.';

-- The existing profiles_select_own and profiles_update_own policies continue
-- to restrict access to the authenticated user''s own profile row.
