
// scripts/diagnose_simple.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const EMAIL = 'tippjr@yahoo.com';

async function run() {
    console.log(`\n\n=== DIAGNOSING ${EMAIL} ===`);

    // 1. Profile?
    const { data: profiles, error: pErr } = await supabase.from('profiles').select('*').eq('email', EMAIL);
    if (pErr) console.error("Profile Error:", pErr);

    if (!profiles || profiles.length === 0) {
        console.log("❌ NO PROFILE FOUND for " + EMAIL);
    } else {
        const p = profiles[0];
        console.log(`✅ Profile Found: ${p.id}`);
        console.log(`   Role: ${p.role}`);
        console.log(`   Team ID in Profile: ${p.team_id}`);

        // 2. Is this user a Coach of the Fire?
        const { data: teams, error: tErr } = await supabase.from('teams').select('*').eq('coach_id', p.id);
        if (tErr) console.error("Team Query Error:", tErr);

        if (teams && teams.length > 0) {
            console.log(`✅ User is Coach of: ${teams[0].name} (ID: ${teams[0].id})`);

            // 3. Are there players?
            const { count } = await supabase.from('players').select('*', { count: 'exact', head: true }).eq('team_id', teams[0].id);
            console.log(`   Player Count: ${count}`);
        } else {
            console.log("❌ User is NOT set as coach_id on any team.");
            // Who is the coach of Fire?
            const { data: fireTeams } = await supabase.from('teams').select('*').eq('name', 'Rockford Fire');
            if (fireTeams && fireTeams.length > 0) {
                console.log(`   "Rockford Fire" exists. Coach ID is: ${fireTeams[0].coach_id}`);
                console.log(`   (Your ID is ${p.id})`);
            }
        }
    }
    console.log("=== END ===\n");
}

run();
