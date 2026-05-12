-- ============================================================
-- Capture parent profile during guardian-code signup.
--
-- Adds full_name / phone / relationship_label to family_members
-- so when a parent links to a kid, we record who they are and
-- how to reach them. Lets coaches contact the right person
-- without a separate addressbook.
--
-- relationship_label is the human-readable role (Mom / Dad /
-- Guardian / Grandparent / Step-parent / Other). The existing
-- `relationship` column stays as access level ('guardian' = full
-- access, 'fan' = read-only).
-- ============================================================

ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS full_name          text,
  ADD COLUMN IF NOT EXISTS phone              text,
  ADD COLUMN IF NOT EXISTS relationship_label text;

-- Extend join_player_family to optionally capture profile fields in
-- the same call. Falls back to original behavior when only the code
-- is passed (legacy clients keep working).
CREATE OR REPLACE FUNCTION public.join_player_family(
  input_code            text,
  p_full_name           text DEFAULT NULL,
  p_phone               text DEFAULT NULL,
  p_relationship_label  text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_player_id   UUID;
    v_player_name TEXT;
    v_user_id     UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    SELECT id, first_name || ' ' || last_name
      INTO v_player_id, v_player_name
      FROM players
     WHERE UPPER(guardian_code) = UPPER(input_code);

    IF v_player_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Invalid code');
    END IF;

    IF EXISTS (SELECT 1 FROM family_members
               WHERE user_id = v_user_id AND player_id = v_player_id) THEN
        UPDATE family_members
           SET full_name          = COALESCE(NULLIF(trim(p_full_name), ''), full_name),
               phone              = COALESCE(NULLIF(trim(p_phone), ''), phone),
               relationship_label = COALESCE(NULLIF(trim(p_relationship_label), ''), relationship_label)
         WHERE user_id = v_user_id AND player_id = v_player_id;
        RETURN json_build_object('success', false, 'message', 'Already linked to this player');
    END IF;

    INSERT INTO family_members (user_id, player_id, relationship, full_name, phone, relationship_label)
    VALUES (v_user_id, v_player_id, 'guardian',
            NULLIF(trim(p_full_name), ''),
            NULLIF(trim(p_phone), ''),
            NULLIF(trim(p_relationship_label), ''));

    RETURN json_build_object(
        'success', true,
        'player_id', v_player_id,
        'player_name', v_player_name,
        'relationship', 'guardian'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.join_player_family(text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.join_player_family(text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_guardian_profile(
  p_player_id           uuid,
  p_full_name           text DEFAULT NULL,
  p_phone               text DEFAULT NULL,
  p_relationship_label  text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  UPDATE family_members
     SET full_name          = COALESCE(NULLIF(trim(p_full_name), ''), full_name),
         phone              = COALESCE(NULLIF(trim(p_phone), ''), phone),
         relationship_label = COALESCE(NULLIF(trim(p_relationship_label), ''), relationship_label)
   WHERE user_id = v_uid AND player_id = p_player_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'No link to this player');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.update_guardian_profile(uuid, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_guardian_profile(uuid, text, text, text) TO authenticated;
