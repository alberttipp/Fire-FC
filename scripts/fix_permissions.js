
// scripts/fix_permissions.js
// Run with: node scripts/fix_permissions.js

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
const TARGET_TEAM_NAME = 'Rockford Fire';

async function fixPermissions() {
    console.log(`Fixing permissions for ${TARGET_EMAIL}...`);

    // 1. Find the User (Auth & Profile)
    // We need the User ID. Since we can't query auth.users easily with just filtering in all versions, 
    // we'll try to find the profile first. If they logged in, a profile trigger likely created a row.

    // Check Profile
    let { data: profile, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', TARGET_EMAIL)
        .single();

    if (!profile) {
        console.log("Profile not found via standard query. Searching Auth Admin...");
        const { data: { users }, error: uError } = await supabase.auth.admin.listUsers();
        if (uError) throw uError;

        const user = users.find(u => u.email.toLowerCase() === TARGET_EMAIL.toLowerCase());
        if (!user) {
            console.error(`❌ User ${TARGET_EMAIL} not found! Did you sign up?`);
            return;
        }

        console.log(`Found Auth User: ${user.id}`);
        // Ensure profile exists
        const { data: newProfile, error: npError } = await supabase
            .from('profiles')
            .upsert({
                id: user.id,
                email: TARGET_EMAIL,
                full_name: 'Coach',
                role: 'coach'
            })
            .select()
            .single();

        if (npError) throw npError;
        profile = newProfile;
    }

    console.log(`User ID: ${profile.id}`);

    // 2. Find the Team
    const { data: team, error: tError } = await supabase
        .from('teams')
        .select('*')
        .eq('name', TARGET_TEAM_NAME)
        .single();

    if (!team) {
        console.error(`❌ Team '${TARGET_TEAM_NAME}' not found. Run the seed script first.`);
        return;
    }

    console.log(`Team: ${team.name} (ID: ${team.id})`);

    // 3. Update Team Coach
    console.log("Making you the Head Coach...");
    await supabase.from('teams').update({ coach_id: profile.id }).eq('id', team.id);

    // 4. Update Profile
    console.log("Updating your profile...");
    await supabase.from('profiles').update({
        role: 'coach',
        team_id: team.id,
        full_name: 'Coach Tipp' // Optional, just nice
    }).eq('id', profile.id);

    console.log("✅ Permissions Fixed! Refresh the page.");
    console.log("You should now see the U11 Roster.");
}

fixPermissions().catch(err => {
    console.error("Failed:", err);
});
