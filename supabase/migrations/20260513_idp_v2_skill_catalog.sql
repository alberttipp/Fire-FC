-- ============================================================
-- 20260513_idp_v2_skill_catalog.sql
-- IDP v2: skill-based 90-day plans (3 × 30-day blocks)
-- ============================================================
-- Adds:
--   • skills            — catalog of 20 named moves (10 offense + 10 defense)
--   • idp_skill_progress — per-skill, per-block mastery rows
--   • tagged_skills col on drills (TEXT[]) — links library drills to skills
--   • current_block / block_duration_days on player_idps
--   • Seeds 20 badges (one per move) under new category 'Skill Move'
--   • Backfills tagged_skills on existing library drills via name match
--   • Trigger: idp_skill_progress.status → 'mastered' awards matching badge
--
-- Doesn't touch existing data. Old IDPs still work (focus_areas TEXT[] is
-- kept for backward compat). Existing badges + auto-award triggers stay.
--
-- ROLLBACK: 20260513_idp_v2_skill_catalog_ROLLBACK.sql.
-- Revert point pre-IDP: git tag pre-idp-rewrite at commit d2618f5.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. skills catalog
-- ============================================================
CREATE TABLE IF NOT EXISTS public.skills (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('offense','defense')),
    description TEXT,
    icon TEXT,
    badge_id TEXT,
    sort_order INT DEFAULT 0,
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view skills" ON public.skills;
CREATE POLICY "Anyone authenticated can view skills"
ON public.skills FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_skills_category_sort ON public.skills(category, sort_order);

-- ============================================================
-- 2. Seed badges (one per move) — category 'Skill Move'
-- ============================================================
INSERT INTO public.badges (id, name, description, icon, category, org_id) VALUES
  ('move_step_over',             'Step-Over Specialist', 'Fake direction with the step-over.',         '🦶', 'Skill Move', NULL),
  ('move_cruyff_turn',           'Cruyff Master',        'Drag and go — Total Football turn.',         '🌀', 'Skill Move', NULL),
  ('move_body_feint',            'Shoulder Drop',        'Sell direction with body shape.',            '🤺', 'Skill Move', NULL),
  ('move_la_croqueta',           'La Croqueta',          'Inside-outside slide between defenders.',    '⚡', 'Skill Move', NULL),
  ('move_drag_back',             'Drag-Back Pro',        'Pull, push, gone.',                          '🔁', 'Skill Move', NULL),
  ('move_roulette',              'Marseille Master',     'Spin past pressure.',                        '🌪️', 'Skill Move', NULL),
  ('move_elastico',              'Elastico',             'Outside-inside flick in one motion.',        '🪄', 'Skill Move', NULL),
  ('move_heel_flick',            'Heel Flick',           'Surprise the press behind your back.',       '👟', 'Skill Move', NULL),
  ('move_first_touch_setup',     'First-Touch Magician', 'First touch sets the next play.',            '✨', 'Skill Move', NULL),
  ('move_one_v_one_finishing',   '1v1 Finisher',         'Cold-blooded vs the keeper.',                '🎯', 'Skill Move', NULL),
  ('move_jockeying',             'The Wall',             'Force them where you want them.',            '🧱', 'Skill Move', NULL),
  ('move_block_tackle',          'Block Tackle Ace',     'Plant the foot, win it clean.',              '🛡️', 'Skill Move', NULL),
  ('move_one_v_one_containment', '1v1 Lockdown',         'No way through.',                            '🔒', 'Skill Move', NULL),
  ('move_pressing_trigger',      'Pressing Pro',         'Read the cue, win it back.',                 '🐺', 'Skill Move', NULL),
  ('move_defensive_header',      'Head Shot Defense',    'Get high, clear far.',                       '🪖', 'Skill Move', NULL),
  ('move_tracking_runs',         'Shadow Tracker',       'Stay with the runner all the way back.',     '👣', 'Skill Move', NULL),
  ('move_marking',               'Marker',               'Always know who you''ve got.',               '📍', 'Skill Move', NULL),
  ('move_safe_clearance',        'Safe Hands',           'Long, wide, away from danger.',              '🧤', 'Skill Move', NULL),
  ('move_recovery_run',          'Recovery Engine',      'Sprint back hard, every time.',              '🏃', 'Skill Move', NULL),
  ('move_interception',          'The Reader',           'Read the pass, step in.',                    '👁️', 'Skill Move', NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. Seed skills (referencing the badges)
-- ============================================================
INSERT INTO public.skills (slug, name, category, description, icon, badge_id, sort_order, org_id) VALUES
  ('step_over',             'Step-Over',          'offense', 'Step over the ball to fake direction.',                '🦶', 'move_step_over',             10,  NULL),
  ('cruyff_turn',           'Cruyff Turn',        'offense', 'Fake the pass, drag behind the standing leg.',         '🌀', 'move_cruyff_turn',           20,  NULL),
  ('body_feint',            'Body Feint',         'offense', 'Drop the shoulder, then go the other way.',            '🤺', 'move_body_feint',            30,  NULL),
  ('la_croqueta',           'La Croqueta',        'offense', 'One foot in, the other out — slide between defenders.', '⚡', 'move_la_croqueta',           40,  NULL),
  ('drag_back',             'Drag-Back',          'offense', 'Pull the ball back to change direction fast.',         '🔁', 'move_drag_back',             50,  NULL),
  ('roulette',              'Marseille Turn',     'offense', 'Spin around the defender with the ball.',              '🌪️', 'move_roulette',              60,  NULL),
  ('elastico',              'Elastico',           'offense', 'Outside-then-inside flick in one motion.',             '🪄', 'move_elastico',              70,  NULL),
  ('heel_flick',            'Heel Flick',         'offense', 'Flick the ball back with the heel.',                   '👟', 'move_heel_flick',            80,  NULL),
  ('first_touch_setup',     'First-Touch Setup',  'offense', 'Take the first touch into the space you need.',        '✨', 'move_first_touch_setup',     90,  NULL),
  ('one_v_one_finishing',   '1v1 Finishing',      'offense', 'Beat the keeper one-on-one.',                          '🎯', 'move_one_v_one_finishing',   100, NULL),
  ('jockeying',             'Jockeying',          'defense', 'Stay low, on your toes, force them outside.',          '🧱', 'move_jockeying',             110, NULL),
  ('block_tackle',          'Block Tackle',       'defense', 'Plant the foot, time it, win the ball clean.',         '🛡️', 'move_block_tackle',          120, NULL),
  ('one_v_one_containment', '1v1 Containment',    'defense', 'Delay, contain, force the mistake.',                   '🔒', 'move_one_v_one_containment', 130, NULL),
  ('pressing_trigger',      'Pressing Trigger',   'defense', 'Read the bad touch or back pass — go press.',          '🐺', 'move_pressing_trigger',      140, NULL),
  ('defensive_header',      'Defensive Header',   'defense', 'Get high, clear far.',                                 '🪖', 'move_defensive_header',      150, NULL),
  ('tracking_runs',         'Tracking Runs',      'defense', 'Stick with the runner all the way to your goal.',      '👣', 'move_tracking_runs',         160, NULL),
  ('marking',               'Marking',            'defense', 'Know who you''ve got. Stay touch-tight.',              '📍', 'move_marking',               170, NULL),
  ('safe_clearance',        'Safe Clearance',     'defense', 'Long, wide, away from danger.',                        '🧤', 'move_safe_clearance',        180, NULL),
  ('recovery_run',          'Recovery Run',       'defense', 'Sprint back hard every time.',                         '🏃', 'move_recovery_run',          190, NULL),
  ('interception',          'Interception',       'defense', 'Read the pass, step into the lane.',                   '👁️', 'move_interception',          200, NULL)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 4. idp_skill_progress — per-skill, per-block mastery
-- ============================================================
CREATE TABLE IF NOT EXISTS public.idp_skill_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    idp_id UUID NOT NULL REFERENCES public.player_idps(id) ON DELETE CASCADE,
    block_number INT NOT NULL CHECK (block_number IN (1,2,3)),
    skill_slug TEXT NOT NULL REFERENCES public.skills(slug),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','mastered')),
    mastered_at TIMESTAMPTZ,
    mastered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(idp_id, block_number, skill_slug)
);

CREATE INDEX IF NOT EXISTS idx_idp_skill_progress_idp ON public.idp_skill_progress(idp_id, block_number);

ALTER TABLE public.idp_skill_progress ENABLE ROW LEVEL SECURITY;

-- Staff (any coach/manager role on the player's team) can CRUD
DROP POLICY IF EXISTS "Staff manage idp skill progress" ON public.idp_skill_progress;
CREATE POLICY "Staff manage idp skill progress"
ON public.idp_skill_progress FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.player_idps pi
        JOIN public.players p ON p.id = pi.player_id
        WHERE pi.id = idp_skill_progress.idp_id
          AND has_team_role(auth.uid(), p.team_id, 'team_staff')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.player_idps pi
        JOIN public.players p ON p.id = pi.player_id
        WHERE pi.id = idp_skill_progress.idp_id
          AND has_team_role(auth.uid(), p.team_id, 'team_staff')
    )
);

-- Guardian + fan + the player themself can SELECT (read-only)
DROP POLICY IF EXISTS "Family and self read idp skill progress" ON public.idp_skill_progress;
CREATE POLICY "Family and self read idp skill progress"
ON public.idp_skill_progress FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.player_idps pi
        JOIN public.players p ON p.id = pi.player_id
        WHERE pi.id = idp_skill_progress.idp_id
          AND (
              is_guardian(auth.uid(), p.id)
              OR is_fan(auth.uid(), p.id)
              OR p.user_id = auth.uid()
          )
    )
);

-- ============================================================
-- 5. Extend player_idps
-- ============================================================
ALTER TABLE public.player_idps
    ADD COLUMN IF NOT EXISTS current_block INT DEFAULT 1 CHECK (current_block IN (1,2,3)),
    ADD COLUMN IF NOT EXISTS block_duration_days INT DEFAULT 30;

-- ============================================================
-- 6. Extend drills: tagged_skills[]
-- ============================================================
ALTER TABLE public.drills
    ADD COLUMN IF NOT EXISTS tagged_skills TEXT[];

CREATE INDEX IF NOT EXISTS idx_drills_tagged_skills ON public.drills USING GIN (tagged_skills);

-- ============================================================
-- 7. Backfill tagged_skills on existing library drills via name match
-- ============================================================
UPDATE public.drills SET tagged_skills = ARRAY['step_over']                                                        WHERE name = 'Step-Over Reps';
UPDATE public.drills SET tagged_skills = ARRAY['cruyff_turn']                                                      WHERE name = 'Cruyff Turn Reps';
UPDATE public.drills SET tagged_skills = ARRAY['step_over','cruyff_turn','la_croqueta','first_touch_setup']        WHERE name = 'Skill Move Showcase (4 Moves)';
UPDATE public.drills SET tagged_skills = ARRAY['body_feint']                                                       WHERE name = 'Scissors Reps';
UPDATE public.drills SET tagged_skills = ARRAY['la_croqueta']                                                      WHERE name IN ('Inside–Outside Touches (Same Foot)','Coerver Cuts (Inside Cut Line)','Coerver Cuts (Outside Cut Line)','Inside Cut + Outside Cut Alternation');
UPDATE public.drills SET tagged_skills = ARRAY['drag_back']                                                        WHERE name IN ('Drag Back (Sole) + Go','Sole Pull + Outside Push','Sole Roll + Pullback Turn','V-Pulls','L-Turn Reps');
UPDATE public.drills SET tagged_skills = ARRAY['roulette']                                                         WHERE name = 'Maradona Spins (Turn Reps)';
UPDATE public.drills SET tagged_skills = ARRAY['elastico']                                                         WHERE name = 'Ronaldo Chop Reps';
UPDATE public.drills SET tagged_skills = ARRAY['first_touch_setup']                                                WHERE name IN ('Receive Across Body (Pairs)','Receive on Back Foot (Open Touch)','Half-Turn Receiving Line','Receive + 2-Touch Direction Change','First Touch Into Gate','Aerial Control (Toss + Set)','Bounce Touch – One Bounce Control','Wall Receive Half-Turn','Turn & Receive (Check Away, Check To)','Receive Under Pressure (Shadow)','Pressure Touch Escape (3-Second Rule)','Wall Pass Control (One Touch)','Wall Pass – Two Touch Rhythm');
UPDATE public.drills SET tagged_skills = ARRAY['one_v_one_finishing']                                              WHERE name IN ('1v1 Breakaway Finish','1v1 Endline to Goal','Central 1v1 + Finish','Dribble + Shoot','Finishing Through Cones (Gate Shot)','1v1 to Two Goals','2v1 Transition (Small Goal)');
UPDATE public.drills SET tagged_skills = ARRAY['jockeying']                                                        WHERE name IN ('Defensive Shuffle Footwork','Partner Mirror Footwork');
UPDATE public.drills SET tagged_skills = ARRAY['block_tackle']                                                     WHERE name = 'Tackling Technique (Poke/Block)';
UPDATE public.drills SET tagged_skills = ARRAY['one_v_one_containment']                                            WHERE name IN ('1v1 Defending Channel','Close-Out & Contain','Block the Shot Lane');
UPDATE public.drills SET tagged_skills = ARRAY['pressing_trigger']                                                 WHERE name IN ('Pressing Triggers Walkthrough','Counterpress 5-Second Rule','Defensive Press Waves','Curved Runs (Pressing Angles)');
UPDATE public.drills SET tagged_skills = ARRAY['tracking_runs']                                                    WHERE name = 'Backpedal + Turn Sprint';
UPDATE public.drills SET tagged_skills = ARRAY['recovery_run','tracking_runs']                                     WHERE name IN ('Defensive Transition 3v2','Delay & Recover (2v2)');
UPDATE public.drills SET tagged_skills = ARRAY['interception']                                                     WHERE name = 'Intercepting Passing Lanes';

-- ============================================================
-- 8. Trigger: skill mastered → award matching badge
-- ============================================================
-- player_badges has no unique constraint on (player_user_id, badge_id),
-- so we do the idempotency check in the function body rather than via
-- ON CONFLICT.
CREATE OR REPLACE FUNCTION public.award_badge_on_skill_mastery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    target_player_user UUID;
    target_player_id UUID;
    target_badge TEXT;
BEGIN
    IF NEW.status = 'mastered' AND (OLD.status IS DISTINCT FROM 'mastered') THEN
        SELECT p.user_id, p.id, s.badge_id
          INTO target_player_user, target_player_id, target_badge
          FROM public.player_idps pi
          JOIN public.players p ON p.id = pi.player_id
          JOIN public.skills s ON s.slug = NEW.skill_slug
         WHERE pi.id = NEW.idp_id;

        IF target_player_user IS NOT NULL AND target_badge IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.player_badges
                WHERE player_user_id = target_player_user
                  AND badge_id = target_badge
            ) THEN
                INSERT INTO public.player_badges (
                    player_user_id, player_id, badge_id, awarded_by, awarded_at
                ) VALUES (
                    target_player_user, target_player_id, target_badge,
                    NEW.mastered_by, COALESCE(NEW.mastered_at, now())
                );
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_badge_on_skill_mastery ON public.idp_skill_progress;
CREATE TRIGGER trg_award_badge_on_skill_mastery
AFTER UPDATE OF status ON public.idp_skill_progress
FOR EACH ROW
EXECUTE FUNCTION public.award_badge_on_skill_mastery();

NOTIFY pgrst, 'reload schema';

COMMIT;
