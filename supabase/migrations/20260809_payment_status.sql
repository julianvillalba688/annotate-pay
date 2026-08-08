-- =============================================================================
-- AnnotatePay - per-task-log payment status
-- =============================================================================
-- Payment status is tracked per task log because a project may be paid in
-- multiple installments. This is self-reported bookkeeping; it does not verify
-- payment with an external processor.

-- -----------------------------------------------------------------------------
-- Payment fields
-- -----------------------------------------------------------------------------
ALTER TABLE public.task_logs
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE public.task_logs
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.task_logs'::regclass
      AND conname = 'task_logs_payment_status_check'
  ) THEN
    ALTER TABLE public.task_logs
      ADD CONSTRAINT task_logs_payment_status_check
      CHECK (payment_status IN ('pending', 'paid'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.task_logs.payment_status IS
  'Self-reported payment bookkeeping: pending means not marked paid and paid means marked paid by the user; this does not verify payment with an external processor.';

COMMENT ON COLUMN public.task_logs.paid_at IS
  'Timestamp for the user-reported paid status; this is bookkeeping only and does not verify payment with an external processor.';

-- Composite indexes support the common per-user and per-project payment views.
CREATE INDEX IF NOT EXISTS task_logs_user_id_payment_status_idx
  ON public.task_logs (user_id, payment_status);

CREATE INDEX IF NOT EXISTS task_logs_project_id_payment_status_idx
  ON public.task_logs (project_id, payment_status);

-- -----------------------------------------------------------------------------
-- Payment normalization on INSERT
-- -----------------------------------------------------------------------------
-- Preserve the 20260808 snapshot/rate/earnings behavior while also ensuring a
-- row inserted directly as paid receives a timestamp. The normal application
-- path defaults new rows to pending.
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

  -- Keep payment status and timestamp consistent for direct paid inserts too.
  IF NEW.payment_status = 'paid' THEN
    NEW.paid_at := COALESCE(NEW.paid_at, now());
  ELSIF NEW.payment_status = 'pending' THEN
    NEW.paid_at := NULL;
  END IF;

  -- AHT is in minutes: hours = weighted minutes / 60.
  v_hours := (
    (NEW.tasks_attempter::NUMERIC * NEW.snapshot_aht_attempter)
    + (NEW.tasks_reviewer::NUMERIC * NEW.snapshot_aht_reviewer)
  ) / 60.0;

  -- Earnings snapshots are trigger-owned; client-supplied values are ignored.
  NEW.calculated_earnings := v_hours * NEW.hourly_rate_used;
  NEW.calculated_earnings_usd := NEW.calculated_earnings;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Minutes/USD task-log update trigger
-- -----------------------------------------------------------------------------
-- BEFORE UPDATE: date/tasks_* and payment fields are mutable; identity,
-- snapshots, and accounting values remain protected. Earnings are recalculated
-- from the existing minute-based snapshots, never from current project data.
CREATE OR REPLACE FUNCTION public.task_logs_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hours NUMERIC;
BEGIN
  -- Immutable identity and ownership fields.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'task_logs id, user_id, project_id, and created_at are immutable';
  END IF;

  -- Immutable AHT and accounting metadata snapshots.
  IF NEW.snapshot_aht_attempter IS DISTINCT FROM OLD.snapshot_aht_attempter
     OR NEW.snapshot_aht_reviewer IS DISTINCT FROM OLD.snapshot_aht_reviewer
     OR NEW.hourly_rate_used IS DISTINCT FROM OLD.hourly_rate_used
     OR NEW.currency_code IS DISTINCT FROM OLD.currency_code
     OR NEW.fx_rate_to_usd IS DISTINCT FROM OLD.fx_rate_to_usd THEN
    RAISE EXCEPTION
      'task_logs snapshots, hourly_rate_used, currency_code, and fx_rate_to_usd are immutable';
  END IF;

  -- Defense in depth: restore every immutable snapshot from OLD.
  NEW.snapshot_aht_attempter := OLD.snapshot_aht_attempter;
  NEW.snapshot_aht_reviewer := OLD.snapshot_aht_reviewer;
  NEW.hourly_rate_used := OLD.hourly_rate_used;
  NEW.currency_code := OLD.currency_code;
  NEW.fx_rate_to_usd := OLD.fx_rate_to_usd;

  -- Keep payment status and timestamp consistent. NEW.paid_at contains the
  -- existing value when the client does not change it.
  IF NEW.payment_status = 'paid' THEN
    NEW.paid_at := COALESCE(NEW.paid_at, now());
  ELSIF NEW.payment_status = 'pending' THEN
    NEW.paid_at := NULL;
  END IF;

  -- Recalculate from EXISTING minute-based snapshots, never current project AHT.
  v_hours := (
    (NEW.tasks_attempter::NUMERIC * NEW.snapshot_aht_attempter)
    + (NEW.tasks_reviewer::NUMERIC * NEW.snapshot_aht_reviewer)
  ) / 60.0;

  -- Earnings snapshots are trigger-owned; client-supplied values are ignored.
  NEW.calculated_earnings := v_hours * NEW.hourly_rate_used;
  NEW.calculated_earnings_usd := NEW.calculated_earnings;

  RETURN NEW;
END;
$$;
