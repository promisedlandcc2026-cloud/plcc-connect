-- Connect: expose desk/kiosk 4-digit members.access_code on guardian child cards.
-- Apply in Supabase SQL editor after connect_phase_2_6d_dependent_digital_cards.sql.
-- Safe for Connect DependentDigitalCard "Check-in code" display.

CREATE OR REPLACE FUNCTION public.dependent_digital_card_dto(
  p_card public.dependent_digital_cards,
  p_display_name text,
  p_access_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'cardRef', p_card.card_ref,
    'displayName', coalesce(nullif(trim(p_display_name), ''), 'PLCC Child Member'),
    'label', 'PLCC Child Member',
    'cardNumber', p_card.card_number,
    'cardStatus', p_card.status,
    'qrPayload', p_card.qr_token,
    'issuedAt', p_card.issued_at,
    'rotatedAt', p_card.rotated_at,
    'accessCode', CASE
      WHEN p_access_code IS NOT NULL AND trim(p_access_code) ~ '^[0-9]{4}$'
        THEN trim(p_access_code)
      ELSE NULL
    END
    -- omit: id, member_id, qr_token_hash, avatar, DOB, guardian/household IDs
  );
$$;

COMMENT ON FUNCTION public.dependent_digital_card_dto(public.dependent_digital_cards, text, text) IS
  'Phase 2.6D.1+ — member-safe dependent card DTO with optional 4-digit desk accessCode. No raw IDs or hashes.';

-- Drop old 2-arg overload if present (Postgres keeps both otherwise).
DROP FUNCTION IF EXISTS public.dependent_digital_card_dto(public.dependent_digital_cards, text);

CREATE OR REPLACE FUNCTION public.get_my_guardian_child_cards()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_self_member_id uuid;
  v_out jsonb := '[]'::jsonb;
  r record;
  v_card public.dependent_digital_cards%ROWTYPE;
  v_tok record;
  v_number text;
  v_ref text;
  v_display text;
  v_attempts integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_uid) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT l.member_id
  INTO v_self_member_id
  FROM public.user_member_links l
  WHERE l.user_id = v_uid
    AND l.status = 'verified';

  IF v_self_member_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  FOR r IN
    SELECT
      m.id AS member_id,
      m.first_name,
      m.last_name,
      m.access_code
    FROM public.guardian_relationships gr
    JOIN public.members m ON m.id = gr.child_member_id
    WHERE gr.guardian_user_id = v_uid
      AND gr.status = 'active'
      AND gr.can_view_card = true
    ORDER BY m.last_name NULLS LAST, m.first_name NULLS LAST
  LOOP
    v_display := nullif(trim(coalesce(r.first_name, '') || ' ' || coalesce(r.last_name, '')), '');
    IF v_display IS NULL THEN
      v_display := 'PLCC Child Member';
    END IF;

    SELECT *
    INTO v_card
    FROM public.dependent_digital_cards c
    WHERE c.member_id = r.member_id;

    IF NOT FOUND THEN
      v_attempts := 0;
      LOOP
        v_attempts := v_attempts + 1;
        SELECT * INTO v_tok FROM public.member_digital_card_new_token();
        v_number := public.member_digital_card_alloc_number();
        v_ref := public.dependent_digital_card_new_ref();

        BEGIN
          INSERT INTO public.dependent_digital_cards (
            member_id,
            card_ref,
            card_number,
            status,
            qr_token,
            qr_token_hash,
            qr_token_prefix
          ) VALUES (
            r.member_id,
            v_ref,
            v_number,
            'active',
            v_tok.token,
            v_tok.token_hash,
            v_tok.token_prefix
          )
          ON CONFLICT (member_id) DO NOTHING
          RETURNING * INTO v_card;

          EXIT;
        EXCEPTION
          WHEN unique_violation THEN
            IF v_attempts >= 5 THEN
              RAISE;
            END IF;
        END;
      END LOOP;

      IF v_card.id IS NULL THEN
        SELECT * INTO v_card
        FROM public.dependent_digital_cards c
        WHERE c.member_id = r.member_id;
      END IF;
    END IF;

    IF v_card.id IS NULL THEN
      CONTINUE;
    END IF;

    v_out := v_out || jsonb_build_array(
      public.dependent_digital_card_dto(v_card, v_display, r.access_code::text)
    );
  END LOOP;

  RETURN v_out;
END;
$$;

COMMENT ON FUNCTION public.get_my_guardian_child_cards() IS
  'Guardian child cards for auth.uid(); includes optional 4-digit members.access_code as accessCode. Lazy-mints Family Pass when needed.';

REVOKE ALL ON FUNCTION public.dependent_digital_card_dto(public.dependent_digital_cards, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dependent_digital_card_dto(public.dependent_digital_cards, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.dependent_digital_card_dto(public.dependent_digital_cards, text, text) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_guardian_child_cards() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_guardian_child_cards() TO service_role;

-- Also mirrored on Lexar: awc-vault-main/supabase/migrations/connect_dependent_card_access_code.sql
