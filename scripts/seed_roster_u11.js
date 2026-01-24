
// scripts/seed_roster_u11.js
// Run with: node scripts/seed_roster_u11.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
}

// Create a Supabase client with the SERVICE ROLE KEY
// This bypasses RLS policies.
const supabase = createClient(supabaseUrl, serviceRoleKey);

const TEAM_NAME = "Rockford Fire";
const TEAM_CODE = "FIRE-2026";
const COACH_EMAIL = "coach@firefc.com";

// UPDATED ROSTER (Based on User Feedback)
const ROSTER = [
    { number: '70', first: 'Isaac', last: 'Martinez' },
    { number: '44', first: 'Bryce', last: 'Anderson' },
    { number: '45', first: 'Santi', last: 'Jimenez' },
    { number: '53', first: 'Charlie', last: 'Judd' },
    { number: '87', first: 'Manny', last: 'Gonzales' },
    { number: '26', first: 'Oliver', last: 'Schrom' },
    { number: '58', first: 'Bo', last: 'Tipp' },
    { number: '16', first: 'Esteban', last: 'Grajeles' },
    { number: '10', first: 'Izzan', last: 'Garcia' },
    { number: '42', first: 'Ty', last: 'Carroll' },
    { number: '6', first: 'Jameson', last: 'McCarthy' },
    { number: '11', first: 'Santiago', last: 'Aguirre' },
    { number: '41', first: 'Kayden', last: 'Watkins' },
    { number: '36', first: 'Luke', last: 'Anderson' },
    { number: '4', first: 'Mason', last: 'Dennis' }
];

async function seed() {
    console.log(`Starting Seed for ${TEAM_NAME}...`);

    // 1. Get or Create Coach
    console.log("Upserting Coach...");
    const coachId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

    const { error: coachError } = await supabase
        .from('profiles')
        .upsert({
            id: coachId,
            email: COACH_EMAIL,
            full_name: 'Coach Mike',
            role: 'coach',
            avatar_url: 'https://ui-avatars.com/api/?name=Coach+Mike'
        });

    if (coachError) {
        console.error("Error creating coach profile:", coachError);
    }

    // 2. Get or Create Team
    console.log("Upserting Team...");
    let teamId;

    // Check by Coach ID OR Join Code
    const { data: existingTeamByCoach } = await supabase.from('teams').select('id, join_code').eq('coach_id', coachId).maybeSingle();
    const { data: existingTeamByCode } = await supabase.from('teams').select('id, coach_id').eq('join_code', TEAM_CODE).maybeSingle();

    if (existingTeamByCoach) {
        teamId = existingTeamByCoach.id;
        console.log(`Found Team by Coach: ${teamId}`);
        await supabase.from('teams').update({
            name: TEAM_NAME,
            age_group: 'U11 Boys',
            join_code: TEAM_CODE
        }).eq('id', teamId);
    } else if (existingTeamByCode) {
        teamId = existingTeamByCode.id;
        console.log(`Found Team by Code: ${teamId} (Coach ID: ${existingTeamByCode.coach_id})`);

        // Update the team to belong to our Seed Coach if needed
        await supabase.from('teams').update({
            name: TEAM_NAME,
            age_group: 'U11 Boys',
            coach_id: coachId
        }).eq('id', teamId);
    } else {
        console.log("Creating New Team...");
        const { data: newTeam, error: teamError } = await supabase.from('teams').insert({
            name: TEAM_NAME,
            age_group: 'U11 Boys',
            join_code: TEAM_CODE,
            coach_id: coachId
        }).select().single();

        if (teamError) throw teamError;
        teamId = newTeam.id;
    }

    await supabase.from('profiles').update({ team_id: teamId }).eq('id', coachId);

    // 3. Upsert Players
    console.log(`Seeding ${ROSTER.length} Players...`);

    for (const p of ROSTER) {
        // MATCH BY NUMBER for Updates (To fix names)
        const { data: existingPlayer } = await supabase
            .from('players')
            .select('id')
            .eq('team_id', teamId)
            .eq('number', p.number)
            .maybeSingle();

        const playerData = {
            team_id: teamId,
            first_name: p.first,
            last_name: p.last,
            number: p.number,
            pin_code: '1234',
            avatar_url: `https://ui-avatars.com/api/?name=${p.first}+${p.last}&background=random`,
            stats: { xp: 0, level: 1 }
        };

        if (existingPlayer) {
            console.log(`Updating #${p.number}: ${p.first} ${p.last}`);
            await supabase.from('players').update(playerData).eq('id', existingPlayer.id);
        } else {
            console.log(`Creating #${p.number}: ${p.first} ${p.last}`);
            await supabase.from('players').insert(playerData);
        }
    }

    console.log("✅ Seeding Complete!");
}

seed().catch(console.error);
