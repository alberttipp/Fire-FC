-- ============================================================
-- Auto-generate guardian_code for every player.
--
-- WHY: The "Link to Your Player" parent flow validates against
-- players.guardian_code via the join_player_family() RPC.
-- Before this migration only Bo had a code (set manually); the
-- other 3 rostered kids were NULL, and any newly added player
-- got NULL too — meaning the parent linking flow was silently
-- broken for them.
--
-- A unique index on players.guardian_code already exists, so
-- collisions are caught structurally; the generator uses an
-- unambiguous alphabet (no 0/O/1/I/L) so codes are easy to
-- read aloud and easy to type on a phone keypad.
-- ============================================================

CREATE OR REPLACE FUNCTION public.gen_guardian_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_chars    text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code     text;
  v_attempts int := 0;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(v_chars, (floor(random() * length(v_chars)))::int + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.players WHERE guardian_code = v_code);
    v_attempts := v_attempts + 1;
    IF v_attempts > 20 THEN
      RAISE EXCEPTION 'Could not generate unique guardian_code after 20 attempts';
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_player_guardian_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.guardian_code IS NULL OR length(trim(NEW.guardian_code)) = 0 THEN
    NEW.guardian_code := public.gen_guardian_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_players_ensure_guardian_code ON public.players;
CREATE TRIGGER trg_players_ensure_guardian_code
BEFORE INSERT ON public.players
FOR EACH ROW
EXECUTE FUNCTION public.ensure_player_guardian_code();

-- Backfill existing NULL codes one row at a time so each generation
-- can see prior INSERTs' codes via the unique index.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.players
           WHERE guardian_code IS NULL OR length(trim(guardian_code)) = 0
  LOOP
    UPDATE public.players
      SET guardian_code = public.gen_guardian_code()
      WHERE id = r.id;
  END LOOP;
END $$;
