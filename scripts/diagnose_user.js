
// scripts/diagnose_user.js
// Run with: node scripts/diagnose_user.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const TARGET_EMAIL = 'tippjr@yahoo.com';

async function diagnose() {
    console.log(`--- DIAGNOSIS FOR: ${TARGET_EMAIL} ---`);

    // 1. Check Auth User
    const { data: { users }, error: uError } = await supabase.auth.admin.listUsers();
    if (uError) throw uError;

    const user = users.find(u => u.email.toLowerCase() === TARGET_EMAIL.toLowerCase());

    if (!user) {
        console.error("❌ Auth User NOT FOUND.");
        return;
    }
    console.log(`✅ Auth User Found: ${user.id}`);
    console.log(`   - Last Class: ${user.updated_at}`);

    // 2. Check Profile
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (!profile) {
        console.error("❌ Profile Row NOT FOUND.");
    } else {
        console.log(`✅ Profile Found:`);
        console.log(`   - ID: ${profile.id}`);
        console.log(`   - Role: ${profile.role}`);
        console.log(`   - Team ID (in profile): ${profile.team_id}`);
    }

    // 3. Check Team
    const { data: teams } = await supabase.from('teams').select('*'); // Get all teams to see what's there
    console.log(`\n--- TEAMS AVAILBLE ---`);
    let myTeam = null;

    for (const t of teams) {
        const isMyTeam = t.coach_id === user.id;
        console.log(`[${t.name}]`);
        console.log(`   - ID: ${t.id}`);
        console.log(`   - Coach ID: ${t.coach_id}`);
        console.log(`   - Is Linked to User? ${isMyTeam ? 'YES ✅' : 'NO ❌'}`);

        if (isMyTeam) myTeam = t;
    }

    if (myTeam) {
        console.log(`\n✅ CONCLUSION: Database looks CORRECT. User is coach of "${myTeam.name}".`);
    } else {
        console.error(`\n❌ CONCLUSION: User is NOT linked as coach of any team.`);
    }
}

diagnose().catch(console.error);
