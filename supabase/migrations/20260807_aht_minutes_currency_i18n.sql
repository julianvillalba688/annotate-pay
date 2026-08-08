-- =============================================================================
-- AnnotatePay - AHT minutes, currency, and i18n follow-up
-- =============================================================================
-- AHT is stored in MINUTES in both projects.current_aht_* and the task log
-- snapshot_aht_* columns. The earnings formula is:
--   hours = (tasks_attempter * snapshot_aht_attempter_minutes
--          + tasks_reviewer  * snapshot_aht_reviewer_minutes) / 60.0
--   calculated_earnings = hours * hourly_rate_used
--
-- USD is the canonical accounting currency. global_hourly_rate,
-- hourly_rate_used, calculated_earnings, and calculated_earnings_usd are USD
-- amounts. preferred_currency is a display preference only; UI conversion may
-- use current FX rates and must not rewrite historical USD accounting values.
--
-- The aht_unit app_meta row is a once-only migration guard. Existing seconds
-- are divided by 60 before that row is inserted, and calculated_earnings is
-- deliberately left unchanged because the formula conversion is equivalent.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Internal migration/application metadata
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- app_meta is server/internal only. No public read policy is created here.
ALTER TABLE public.app_meta ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.app_meta IS
  'Internal metadata; RLS is enabled and no public read policy is provided.';

-- ----------------------------------------------------------------------------
-- Display preferences
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_locale TEXT NOT NULL DEFAULT 'en';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_currency TEXT NOT NULL DEFAULT 'USD';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_preferred_locale_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_preferred_locale_check
      CHECK (preferred_locale IN ('en', 'es'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_preferred_currency_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_preferred_currency_check
      CHECK (preferred_currency ~ '^[A-Z]{3}$');
  END IF;
END;
$$;

COMMENT ON COLUMN public.profiles.preferred_locale IS
  'Display locale only; currently en or es.';
COMMENT ON COLUMN public.profiles.preferred_currency IS
  'Display currency preference only; stored accounting remains canonical USD.';
COMMENT ON COLUMN public.profiles.global_hourly_rate IS
  'Canonical USD hourly rate used for new task-log accounting snapshots.';

-- ----------------------------------------------------------------------------
-- Explicit task-log accounting metadata
-- ----------------------------------------------------------------------------
ALTER TABLE public.task_logs
  ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE public.task_logs
  ADD COLUMN IF NOT EXISTS fx_rate_to_usd NUMERIC(18,8) NOT NULL DEFAULT 1;

ALTER TABLE public.task_logs
  ADD COLUMN IF NOT EXISTS calculated_earnings_usd NUMERIC(14,4) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.task_logs'::regclass
      AND conname = 'task_logs_currency_code_check'
  ) THEN
    ALTER TABLE public.task_logs
      ADD CONSTRAINT task_logs_currency_code_check
      CHECK (currency_code ~ '^[A-Z]{3}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.task_logs'::regclass
      AND conname = 'task_logs_fx_rate_to_usd_check'
  ) THEN
    ALTER TABLE public.task_logs
      ADD CONSTRAINT task_logs_fx_rate_to_usd_check
      CHECK (fx_rate_to_usd > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.task_logs'::regclass
      AND conname = 'task_logs_calculated_earnings_usd_check'
  ) THEN
    ALTER TABLE public.task_logs
      ADD CONSTRAINT task_logs_calculated_earnings_usd_check
      CHECK (calculated_earnings_usd >= 0);
  END IF;
END;
$$;

COMMENT ON COLUMN public.task_logs.currency_code IS
  'Immutable accounting/export currency snapshot; inserts are canonical USD, not the display preference.';
COMMENT ON COLUMN public.task_logs.fx_rate_to_usd IS
  'Immutable accounting/export FX snapshot; canonical USD inserts use 1. UI display FX is current-rate only.';
COMMENT ON COLUMN public.task_logs.calculated_earnings_usd IS
  'Immutable canonical USD earnings snapshot, equal to calculated_earnings.';
COMMENT ON COLUMN public.task_logs.hourly_rate_used IS
  'Immutable canonical USD hourly-rate snapshot.';
COMMENT ON COLUMN public.task_logs.calculated_earnings IS
  'Immutable canonical USD earnings result, recalculated only when mutable task data changes.';

-- ----------------------------------------------------------------------------
-- Once-only AHT conversion and historical USD backfill
-- ----------------------------------------------------------------------------
-- The old update trigger rejects snapshot changes. It is disabled only for the
-- controlled backfill/conversion below, then restored before the new functions
-- are installed. The transaction rolls back the disabled state on failure.
DO $$
DECLARE
  v_aht_unit TEXT;
BEGIN
  -- Serialize concurrent migration attempts so the conversion can happen once.
  LOCK TABLE public.app_meta IN EXCLUSIVE MODE;

  ALTER TABLE public.task_logs DISABLE TRIGGER task_logs_before_update;

  -- Fill the explicit USD export field without changing existing earnings.
  UPDATE public.task_logs
  SET calculated_earnings_usd = calculated_earnings;

  SELECT value
  INTO v_aht_unit
  FROM public.app_meta
  WHERE key = 'aht_unit'
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Existing AHT values are seconds. Convert them exactly once to minutes.
    UPDATE public.projects
    SET current_aht_attempter = current_aht_attempter / 60.0,
        current_aht_reviewer = current_aht_reviewer / 60.0;

    UPDATE public.task_logs
    SET snapshot_aht_attempter = snapshot_aht_attempter / 60.0,
        snapshot_aht_reviewer = snapshot_aht_reviewer / 60.0;

    INSERT INTO public.app_meta (key, value)
    VALUES ('aht_unit', 'minutes');
  ELSIF v_aht_unit <> 'minutes' THEN
    RAISE EXCEPTION
      'app_meta.aht_unit is %, expected minutes; refusing a second AHT conversion',
      v_aht_unit;
  END IF;

  ALTER TABLE public.task_logs ENABLE TRIGGER task_logs_before_update;
END;
$$;

COMMENT ON COLUMN public.projects.current_aht_attempter IS
  'Current attempter AHT in minutes.';
COMMENT ON COLUMN public.projects.current_aht_reviewer IS
  'Current reviewer AHT in minutes.';
COMMENT ON COLUMN public.task_logs.snapshot_aht_attempter IS
  'Immutable attempter AHT snapshot in minutes.';
COMMENT ON COLUMN public.task_logs.snapshot_aht_reviewer IS
  'Immutable reviewer AHT snapshot in minutes.';
COMMENT ON COLUMN public.app_meta.value IS
  'The aht_unit=minutes row records that the seconds-to-minutes conversion ran once.';

-- ----------------------------------------------------------------------------
-- Minutes-based task-log accounting triggers
-- ----------------------------------------------------------------------------
-- BEFORE INSERT: freeze snapshots from project + profile; enforce ownership;
-- force canonical USD metadata; compute earnings from minute-based AHT.
CREATE OR REPLACE FUNCTION public.task_logs_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.projects%ROWTYPE;
  v_rate NUMERIC(12,4);
  v_hours NUMERIC;
BEGIN
  SELECT * INTO v_project
  FROM public.projects
  WHERE id = NEW.project_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'project % not found', NEW.project_id;
  END IF;

  -- Ownership: task log user must own the project.
  IF NEW.user_id IS DISTINCT FROM v_project.user_id THEN
    RAISE EXCEPTION 'user_id must match project.user_id';
  END IF;

  -- Prefer auth.uid() when present (client inserts).
  IF auth.uid() IS NOT NULL AND NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'user_id must equal auth.uid()';
  END IF;

  SELECT global_hourly_rate INTO v_rate
  FROM public.profiles
  WHERE id = v_project.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile % not found', v_project.user_id;
  END IF;

  -- Freeze snapshots and canonical USD accounting values (overwrite clients).
  NEW.user_id := v_project.user_id;
  NEW.snapshot_aht_attempter := v_project.current_aht_attempter;
  NEW.snapshot_aht_reviewer := v_project.current_aht_reviewer;
  NEW.hourly_rate_used := v_rate;
  NEW.currency_code := 'USD';
  NEW.fx_rate_to_usd := 1;

  -- AHT is in minutes: hours = weighted minutes / 60.
  v_hours := (
    (NEW.tasks_attempter::NUMERIC * NEW.snapshot_aht_attempter)
    + (NEW.tasks_reviewer::NUMERIC * NEW.snapshot_aht_reviewer)
  ) / 60.0;

  NEW.calculated_earnings := v_hours * NEW.hourly_rate_used;
  NEW.calculated_earnings_usd := NEW.calculated_earnings;

  RETURN NEW;
END;
$$;

-- BEFORE UPDATE: only date/tasks_* are mutable; recalculate from existing
-- minute-based snapshots and preserve all accounting/identity snapshots.
CREATE OR REPLACE FUNCTION public.task_logs_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hours NUMERIC;
BEGIN
  -- Immutable identity, ownership, and snapshot fields.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'task_logs id, user_id, project_id, and created_at are immutable';
  END IF;

  IF NEW.snapshot_aht_attempter IS DISTINCT FROM OLD.snapshot_aht_attempter
     OR NEW.snapshot_aht_reviewer IS DISTINCT FROM OLD.snapshot_aht_reviewer
     OR NEW.hourly_rate_used IS DISTINCT FROM OLD.hourly_rate_used
     OR NEW.currency_code IS DISTINCT FROM OLD.currency_code
     OR NEW.fx_rate_to_usd IS DISTINCT FROM OLD.fx_rate_to_usd THEN
    RAISE EXCEPTION
      'task_logs snapshots, hourly_rate_used, currency_code, and fx_rate_to_usd are immutable';
  END IF;

  -- Defense in depth: restore every immutable accounting snapshot from OLD.
  NEW.snapshot_aht_attempter := OLD.snapshot_aht_attempter;
  NEW.snapshot_aht_reviewer := OLD.snapshot_aht_reviewer;
  NEW.hourly_rate_used := OLD.hourly_rate_used;
  NEW.currency_code := OLD.currency_code;
  NEW.fx_rate_to_usd := OLD.fx_rate_to_usd;

  -- Recalculate from EXISTING minute-based snapshots, never current project AHT.
  v_hours := (
    (NEW.tasks_attempter::NUMERIC * NEW.snapshot_aht_attempter)
    + (NEW.tasks_reviewer::NUMERIC * NEW.snapshot_aht_reviewer)
  ) / 60.0;

  NEW.calculated_earnings := v_hours * NEW.hourly_rate_used;
  NEW.calculated_earnings_usd := NEW.calculated_earnings;

  RETURN NEW;
END;
$$;
