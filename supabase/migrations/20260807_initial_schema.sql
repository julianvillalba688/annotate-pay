-- =============================================================================
-- AnnotatePay — Initial schema
-- =============================================================================
-- Earnings formula (immutable snapshots):
--   hours = (tasks_attempter * snapshot_aht_attempter
--          + tasks_reviewer  * snapshot_aht_reviewer) / 3600.0
--   calculated_earnings = hours * hourly_rate_used
--
-- AHT values are in seconds. On INSERT, snapshot_aht_* and hourly_rate_used are
-- frozen from the project/profile at that moment (client values overwritten).
-- On UPDATE of tasks_*/date only, earnings are recalculated using the EXISTING
-- row snapshots — never re-read from current project AHT or profile rate.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- updated_at helper
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- profiles (extends auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  global_hourly_rate NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (global_hourly_rate >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, COALESCE(NEW.email, ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------------
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  current_aht_attempter NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (current_aht_attempter >= 0),
  current_aht_reviewer NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (current_aht_reviewer >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX projects_user_id_idx ON public.projects (user_id);

CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- task_logs
-- -----------------------------------------------------------------------------
-- zeros allowed for both task counts (at-least-context constraint is a no-op)
CREATE TABLE public.task_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT (CURRENT_DATE),
  tasks_attempter INTEGER NOT NULL DEFAULT 0 CHECK (tasks_attempter >= 0),
  tasks_reviewer INTEGER NOT NULL DEFAULT 0 CHECK (tasks_reviewer >= 0),
  snapshot_aht_attempter NUMERIC(12,4) NOT NULL CHECK (snapshot_aht_attempter >= 0),
  snapshot_aht_reviewer NUMERIC(12,4) NOT NULL CHECK (snapshot_aht_reviewer >= 0),
  hourly_rate_used NUMERIC(12,4) NOT NULL CHECK (hourly_rate_used >= 0),
  calculated_earnings NUMERIC(14,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT task_logs_at_least_context CHECK (true)
);

CREATE INDEX task_logs_user_id_date_idx ON public.task_logs (user_id, date);
CREATE INDEX task_logs_project_id_idx ON public.task_logs (project_id);

-- BEFORE INSERT: freeze snapshots from project + profile; enforce ownership; compute earnings
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

  -- Ownership: task log user must own the project
  IF NEW.user_id IS DISTINCT FROM v_project.user_id THEN
    RAISE EXCEPTION 'user_id must match project.user_id';
  END IF;

  -- Prefer auth.uid() when present (client inserts)
  IF auth.uid() IS NOT NULL AND NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'user_id must equal auth.uid()';
  END IF;

  SELECT global_hourly_rate INTO v_rate
  FROM public.profiles
  WHERE id = v_project.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile % not found', v_project.user_id;
  END IF;

  -- Freeze snapshots (overwrite any client-supplied values)
  NEW.user_id := v_project.user_id;
  NEW.snapshot_aht_attempter := v_project.current_aht_attempter;
  NEW.snapshot_aht_reviewer := v_project.current_aht_reviewer;
  NEW.hourly_rate_used := v_rate;

  -- hours = (tasks_a * aht_a + tasks_r * aht_r) / 3600
  v_hours := (
    (NEW.tasks_attempter::NUMERIC * NEW.snapshot_aht_attempter)
    + (NEW.tasks_reviewer::NUMERIC * NEW.snapshot_aht_reviewer)
  ) / 3600.0;

  NEW.calculated_earnings := v_hours * NEW.hourly_rate_used;

  RETURN NEW;
END;
$$;

CREATE TRIGGER task_logs_before_insert
  BEFORE INSERT ON public.task_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.task_logs_before_insert();

-- BEFORE UPDATE: only date/tasks_* mutable; snapshots immutable; recalc from EXISTING snapshots
CREATE OR REPLACE FUNCTION public.task_logs_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hours NUMERIC;
BEGIN
  -- Immutable identity / snapshot fields
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'task_logs id, user_id, project_id, and created_at are immutable';
  END IF;

  IF NEW.snapshot_aht_attempter IS DISTINCT FROM OLD.snapshot_aht_attempter
     OR NEW.snapshot_aht_reviewer IS DISTINCT FROM OLD.snapshot_aht_reviewer
     OR NEW.hourly_rate_used IS DISTINCT FROM OLD.hourly_rate_used THEN
    RAISE EXCEPTION 'task_logs snapshot columns and hourly_rate_used are immutable';
  END IF;

  -- Force snapshot values from OLD (defense in depth)
  NEW.snapshot_aht_attempter := OLD.snapshot_aht_attempter;
  NEW.snapshot_aht_reviewer := OLD.snapshot_aht_reviewer;
  NEW.hourly_rate_used := OLD.hourly_rate_used;

  -- Recalculate earnings from EXISTING snapshots (never re-read project AHT)
  v_hours := (
    (NEW.tasks_attempter::NUMERIC * NEW.snapshot_aht_attempter)
    + (NEW.tasks_reviewer::NUMERIC * NEW.snapshot_aht_reviewer)
  ) / 3600.0;

  NEW.calculated_earnings := v_hours * NEW.hourly_rate_used;

  RETURN NEW;
END;
$$;

CREATE TRIGGER task_logs_before_update
  BEFORE UPDATE ON public.task_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.task_logs_before_update();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_logs ENABLE ROW LEVEL SECURITY;

-- profiles: SELECT/UPDATE own; INSERT via handle_new_user (security definer)
CREATE POLICY profiles_select_own
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY profiles_update_own
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- projects: full CRUD on own rows
CREATE POLICY projects_select_own
  ON public.projects FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY projects_insert_own
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY projects_update_own
  ON public.projects FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY projects_delete_own
  ON public.projects FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- task_logs: full CRUD on own rows
CREATE POLICY task_logs_select_own
  ON public.task_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY task_logs_insert_own
  ON public.task_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY task_logs_update_own
  ON public.task_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY task_logs_delete_own
  ON public.task_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
