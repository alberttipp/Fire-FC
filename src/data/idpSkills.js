// Static mirror of the `skills` DB catalog (20260513_idp_v2_skill_catalog).
// Used by the skill picker UI so it doesn't have to fetch on every open.
// Keep in sync with the SQL seed when adding/changing skills.

export const IDP_SKILLS = [
    // Offense (10)
    { slug: 'step_over',             name: 'Step-Over',          category: 'offense', icon: '🦶', badge_id: 'move_step_over',             description: 'Step over the ball to fake direction.' },
    { slug: 'cruyff_turn',           name: 'Cruyff Turn',        category: 'offense', icon: '🌀', badge_id: 'move_cruyff_turn',           description: 'Fake the pass, drag behind the standing leg.' },
    { slug: 'body_feint',            name: 'Body Feint',         category: 'offense', icon: '🤺', badge_id: 'move_body_feint',            description: 'Drop the shoulder, then go the other way.' },
    { slug: 'la_croqueta',           name: 'La Croqueta',        category: 'offense', icon: '⚡', badge_id: 'move_la_croqueta',           description: 'One foot in, the other out — slide between defenders.' },
    { slug: 'drag_back',             name: 'Drag-Back',          category: 'offense', icon: '🔁', badge_id: 'move_drag_back',             description: 'Pull the ball back to change direction fast.' },
    { slug: 'roulette',              name: 'Marseille Turn',     category: 'offense', icon: '🌪️', badge_id: 'move_roulette',              description: 'Spin around the defender with the ball.' },
    { slug: 'elastico',              name: 'Elastico',           category: 'offense', icon: '🪄', badge_id: 'move_elastico',              description: 'Outside-then-inside flick in one motion.' },
    { slug: 'heel_flick',            name: 'Heel Flick',         category: 'offense', icon: '👟', badge_id: 'move_heel_flick',            description: 'Flick the ball back with the heel.' },
    { slug: 'first_touch_setup',     name: 'First-Touch Setup',  category: 'offense', icon: '✨', badge_id: 'move_first_touch_setup',     description: 'Take the first touch into the space you need.' },
    { slug: 'one_v_one_finishing',   name: '1v1 Finishing',      category: 'offense', icon: '🎯', badge_id: 'move_one_v_one_finishing',   description: 'Beat the keeper one-on-one.' },

    // Defense (10)
    { slug: 'jockeying',             name: 'Jockeying',          category: 'defense', icon: '🧱', badge_id: 'move_jockeying',             description: 'Stay low, on your toes, force them outside.' },
    { slug: 'block_tackle',          name: 'Block Tackle',       category: 'defense', icon: '🛡️', badge_id: 'move_block_tackle',          description: 'Plant the foot, time it, win the ball clean.' },
    { slug: 'one_v_one_containment', name: '1v1 Containment',    category: 'defense', icon: '🔒', badge_id: 'move_one_v_one_containment', description: 'Delay, contain, force the mistake.' },
    { slug: 'pressing_trigger',      name: 'Pressing Trigger',   category: 'defense', icon: '🐺', badge_id: 'move_pressing_trigger',      description: 'Read the bad touch or back pass — go press.' },
    { slug: 'defensive_header',      name: 'Defensive Header',   category: 'defense', icon: '🪖', badge_id: 'move_defensive_header',      description: 'Get high, clear far.' },
    { slug: 'tracking_runs',         name: 'Tracking Runs',      category: 'defense', icon: '👣', badge_id: 'move_tracking_runs',         description: 'Stick with the runner all the way to your goal.' },
    { slug: 'marking',               name: 'Marking',            category: 'defense', icon: '📍', badge_id: 'move_marking',               description: "Know who you've got. Stay touch-tight." },
    { slug: 'safe_clearance',        name: 'Safe Clearance',     category: 'defense', icon: '🧤', badge_id: 'move_safe_clearance',        description: 'Long, wide, away from danger.' },
    { slug: 'recovery_run',          name: 'Recovery Run',       category: 'defense', icon: '🏃', badge_id: 'move_recovery_run',          description: 'Sprint back hard every time.' },
    { slug: 'interception',          name: 'Interception',       category: 'defense', icon: '👁️', badge_id: 'move_interception',          description: 'Read the pass, step into the lane.' },
];

// Quick lookup helpers
export const SKILL_BY_SLUG = Object.fromEntries(IDP_SKILLS.map((s) => [s.slug, s]));

export const OFFENSE_SKILLS = IDP_SKILLS.filter((s) => s.category === 'offense');
export const DEFENSE_SKILLS = IDP_SKILLS.filter((s) => s.category === 'defense');

export function getSkill(slug) {
    return SKILL_BY_SLUG[slug] || null;
}
