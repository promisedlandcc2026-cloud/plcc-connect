-- =============================================================================
-- PLCC Connect — Celebrations (birthdays & anniversaries) + anniversary type
-- =============================================================================
-- Additive only. Paste into Supabase → SQL Editor and run once (safe to re-run).
--
--   * members.anniversary_kind  ('wedding' | 'other')  + members.anniversary_label
--   * get_my_anniversary_kind() / update_my_anniversary_kind(kind, label)
--   * list_member_celebrations(days)  — "Celebrating this week" on member Home
--   * list_member_anniversary_kinds() — "Wedding anniversary" labels in Directory
--
-- Privacy: the same rules as the Member Directory. Only verified, opted-in
-- adults appear; birthdays only if show_birthday, anniversaries only if
-- show_anniversary, photos only if show_photo. Month/day only — never a year.
-- Does NOT change any existing function.
-- =============================================================================

BEGIN;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS anniversary_kind text,
  ADD COLUMN IF NOT EXISTS anniversary_label text;

DO $$
BEGIN
  ALTER TABLE public.members
    ADD CONSTRAINT members_anniversary_kind_check
    CHECK (anniversary_kind IS NULL OR anniversary_kind IN ('wedding', 'other'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.members.anniversary_kind IS
  'Connect — what members.anniversary celebrates: wedding | other (see anniversary_label).';
COMMENT ON COLUMN public.members.anniversary_label IS
  'Connect — member-chosen name when anniversary_kind = other (e.g. Salvation, Baptism, Joined PLCC).';

-- ---------------------------------------------------------------------------
-- Helper: the caller's verified member id (NULL when not linked)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.celebrations_my_member_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT l.member_id
  FROM public.user_member_links l
  WHERE l.user_id = auth.uid()
    AND l.status = 'verified'
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- Helper: days from p_today until the next p_month/p_day (0 = today).
-- Feb 29 is celebrated on Feb 28 in non-leap years.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.celebrations_days_until(p_today date, p_month integer, p_day integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_year integer := extract(year FROM p_today)::integer;
  v_next date;
  v_last integer;
BEGIN
  IF p_month IS NULL OR p_day IS NULL OR p_month < 1 OR p_month > 12 OR p_day < 1 OR p_day > 31 THEN
    RETURN NULL;
  END IF;
  FOR i IN 0..1 LOOP
    v_last := extract(day FROM (make_date(v_year + i, p_month, 1) + interval '1 month - 1 day'))::integer;
    v_next := make_date(v_year + i, p_month, least(p_day, v_last));
    IF v_next >= p_today THEN
      RETURN v_next - p_today;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- My anniversary type (My Profile)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_anniversary_kind()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_member uuid;
  v_kind text;
  v_label text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;
  v_member := public.celebrations_my_member_id();
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'not_linked' USING ERRCODE = 'P0001';
  END IF;
  SELECT anniversary_kind, anniversary_label INTO v_kind, v_label FROM public.members WHERE id = v_member;
  RETURN jsonb_build_object('kind', v_kind, 'label', v_label);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_my_anniversary_kind(p_kind text, p_label text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_member uuid;
  v_kind text := nullif(lower(trim(coalesce(p_kind, ''))), '');
  v_label text := nullif(regexp_replace(trim(coalesce(p_label, '')), '\s+', ' ', 'g'), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;
  v_member := public.celebrations_my_member_id();
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'not_linked' USING ERRCODE = 'P0001';
  END IF;
  IF v_kind IS NOT NULL AND v_kind NOT IN ('wedding', 'other') THEN
    RAISE EXCEPTION 'invalid_anniversary_kind' USING ERRCODE = 'P0001';
  END IF;
  IF v_kind IS DISTINCT FROM 'other' THEN
    v_label := NULL;
  ELSIF v_label IS NOT NULL AND char_length(v_label) > 40 THEN
    RAISE EXCEPTION 'anniversary_label_too_long' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.members
  SET anniversary_kind = v_kind,
      anniversary_label = v_label
  WHERE id = v_member;

  RETURN jsonb_build_object('kind', v_kind, 'label', v_label);
END;
$$;

-- ---------------------------------------------------------------------------
-- Celebrating this week (member Home + Directory)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_member_celebrations(p_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_days integer := greatest(0, least(coalesce(p_days, 7), 14));
  v_today date := (now() AT TIME ZONE 'Africa/Kampala')::date;
  v_items jsonb := '[]'::jsonb;
  v_date date;
  v_away integer;
  v_display text;
  v_avatar text;
  r record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_member_links l WHERE l.user_id = v_uid AND l.status = 'verified'
  ) THEN
    RAISE EXCEPTION 'not_linked' USING ERRCODE = 'P0001';
  END IF;

  FOR r IN
    SELECT DISTINCT ON (m.id)
      m.id, m.preferred_name, m.first_name, m.last_name, m.avatar_url,
      m.birthday, m.anniversary, m.anniversary_kind, m.anniversary_label,
      p.show_birthday, p.show_anniversary, p.show_photo,
      l.user_id AS partner_user_id
    FROM public.members m
    JOIN public.member_directory_privacy p ON p.member_id = m.id AND p.directory_opt_in = true
    JOIN public.user_member_links l ON l.member_id = m.id AND l.status = 'verified'
    WHERE (p.show_birthday OR p.show_anniversary)
      AND l.user_id <> v_uid
      AND public.member_directory_is_eligible(m.id)
    ORDER BY m.id, l.user_id
  LOOP
    v_display := public.member_profile_display_name(r.preferred_name, r.first_name, r.last_name);
    v_avatar := CASE WHEN r.show_photo THEN nullif(trim(coalesce(r.avatar_url, '')), '') ELSE NULL END;

    IF r.show_birthday THEN
      BEGIN
        v_date := r.birthday::date;
      EXCEPTION WHEN others THEN
        v_date := NULL;
      END;
      IF v_date IS NOT NULL THEN
        v_away := public.celebrations_days_until(v_today, extract(month FROM v_date)::integer, extract(day FROM v_date)::integer);
        IF v_away IS NOT NULL AND v_away <= v_days THEN
          v_items := v_items || jsonb_build_array(jsonb_build_object(
            'directoryId', r.id::text,
            'partnerUserId', r.partner_user_id::text,
            'displayName', v_display,
            'avatarUrl', v_avatar,
            'occasion', 'birthday',
            'anniversaryKind', NULL,
            'anniversaryLabel', NULL,
            'monthDay', to_char(v_date, 'MM-DD'),
            'daysAway', v_away
          ));
        END IF;
      END IF;
    END IF;

    IF r.show_anniversary THEN
      BEGIN
        v_date := r.anniversary::date;
      EXCEPTION WHEN others THEN
        v_date := NULL;
      END;
      IF v_date IS NOT NULL THEN
        v_away := public.celebrations_days_until(v_today, extract(month FROM v_date)::integer, extract(day FROM v_date)::integer);
        IF v_away IS NOT NULL AND v_away <= v_days THEN
          v_items := v_items || jsonb_build_array(jsonb_build_object(
            'directoryId', r.id::text,
            'partnerUserId', r.partner_user_id::text,
            'displayName', v_display,
            'avatarUrl', v_avatar,
            'occasion', 'anniversary',
            'anniversaryKind', r.anniversary_kind,
            'anniversaryLabel', CASE WHEN r.anniversary_kind = 'other' THEN r.anniversary_label ELSE NULL END,
            'monthDay', to_char(v_date, 'MM-DD'),
            'daysAway', v_away
          ));
        END IF;
      END IF;
    END IF;
  END LOOP;

  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'daysAway')::integer, lower(x->>'displayName')), '[]'::jsonb)
  INTO v_items
  FROM jsonb_array_elements(v_items) x;

  RETURN jsonb_build_object('items', v_items, 'today', to_char(v_today, 'YYYY-MM-DD'), 'days', v_days);
END;
$$;

-- ---------------------------------------------------------------------------
-- Anniversary types for Directory labels ("Wedding anniversary Jun 14")
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_member_anniversary_kinds()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;
  IF public.celebrations_my_member_id() IS NULL THEN
    RAISE EXCEPTION 'not_linked' USING ERRCODE = 'P0001';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'directoryId', m.id::text,
      'kind', m.anniversary_kind,
      'label', CASE WHEN m.anniversary_kind = 'other' THEN m.anniversary_label ELSE NULL END
    ))
    FROM public.members m
    JOIN public.member_directory_privacy p ON p.member_id = m.id
    WHERE p.directory_opt_in AND p.show_anniversary
      AND m.anniversary_kind IS NOT NULL
      AND public.member_directory_is_eligible(m.id)
  ), '[]'::jsonb);
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants — signed-in members only
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.celebrations_my_member_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.celebrations_days_until(date, integer, integer) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_my_anniversary_kind() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_my_anniversary_kind(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_member_celebrations(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_member_anniversary_kinds() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_my_anniversary_kind() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_my_anniversary_kind(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_member_celebrations(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_member_anniversary_kinds() TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
