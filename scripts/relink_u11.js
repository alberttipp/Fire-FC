
// scripts/relink_u11.js
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
    console.log(`Relinking U11 Players to ${EMAIL}'s Team...`);

    // 1. Get User's Team
    const { data: profiles } = await supabase.from('profiles').select('id, team_id').eq('email', EMAIL);
    if (!profiles || profiles.length === 0) {
        console.error("User profile not found.");
        return;
    }
    const myTeamId = profiles[0].team_id;
    console.log(`Target Team ID: ${myTeamId}`);

    // Double check team name
    const { data: team } = await supabase.from('teams').select('name').eq('id', myTeamId).single();
    console.log(`Team Name: ${team?.name}`);

    // 2. Find the Players (by name)
    const playerNames = ['Isaac', 'Bryce', 'Amir', 'Charlie', 'Samuel', 'Oliver', 'Rory', 'Ethan', 'Izaiah', 'Ty', 'Liam', 'Santiago', 'Kai', 'Luke', 'Mason'];

    // We'll search for them globally and move them
    for (const name of playerNames) {
        const { data: existing } = await supabase
            .from('players')
            .select('id, first_name, team_id')
            .eq('first_name', name)
            .limit(1);

        if (existing && existing.length > 0) {
            const p = existing[0];
            if (p.team_id !== myTeamId) {
                console.log(`Moving ${p.first_name} from ${p.team_id} -> ${myTeamId}`);
                await supabase.from('players').update({ team_id: myTeamId }).eq('id', p.id);
            } else {
                console.log(`${p.first_name} is already in the correct team.`);
            }
        } else {
            console.log(`⚠️ Player ${name} not found in DB at all.`);
        }
    }

    console.log("✅ Relink Complete.");
}

run();
