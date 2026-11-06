-- =============================================================================
-- PLCC Connect — attendance plans ("I'll be there" on the Home Next-up ticket)
-- =============================================================================
-- Shared Supabase schema (Canaan-owned). Review, then paste into the SQL editor.
-- Additive only. Self-only RLS, same pattern as public.sermon_notes.
--
--   plan_key  'event:<events.id>'  for a calendar event
--             'sunday:YYYY-MM-DD'  for the regular Sunday service
--
-- Staff headcount: public.attendance_plan_count(plan_key) returns a number only,
-- never names, so Canaan can show "42 planning to come" later.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.attendance_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_key text NOT NULL,
  event_id uuid NULL REFERENCES public.events(id) ON DELETE CASCADE,
  service_date date NOT NULL,
  title text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_plans_key_chk
    CHECK (plan_key ~ '^(event:[0-9a-f-]{36}|sunday:[0-9]{4}-[0-9]{2}-[0-9]{2})$'),
  CONSTRAINT attendance_plans_title_len_chk
    CHECK (title IS NULL OR char_length(title) <= 200),
  CONSTRAINT attendance_plans_one_per_service UNIQUE (user_id, plan_key)
);

CREATE INDEX IF NOT EXISTS attendance_plans_key_idx
  ON public.attendance_plans (plan_key);

ALTER TABLE public.attendance_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attendance_plans_select_own ON public.attendance_plans;
CREATE POLICY attendance_plans_select_own ON public.attendance_plans
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS attendance_plans_insert_own ON public.attendance_plans;
CREATE POLICY attendance_plans_insert_own ON public.attendance_plans
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS attendance_plans_delete_own ON public.attendance_plans;
CREATE POLICY attendance_plans_delete_own ON public.attendance_plans
  FOR DELETE TO authenticated USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON TABLE public.attendance_plans TO authenticated;
GRANT ALL ON TABLE public.attendance_plans TO service_role;
REVOKE ALL ON TABLE public.attendance_plans FROM PUBLIC;
REVOKE ALL ON TABLE public.attendance_plans FROM anon;

CREATE OR REPLACE FUNCTION public.attendance_plan_count(p_plan_key text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM public.attendance_plans WHERE plan_key = p_plan_key;
$$;

REVOKE ALL ON FUNCTION public.attendance_plan_count(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attendance_plan_count(text) TO authenticated, service_role;

COMMIT;
