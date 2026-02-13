import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error("❌ Missing Keys in .env");
    process.exit(1);
}

// 1. Admin Client (Bypasses RLS)
const adminClient = createClient(supabaseUrl, serviceKey);
// 2. Public Client (Respects RLS)
const publicClient = createClient(supabaseUrl, anonKey);

async function diagnose() {
    console.log("🕵️ STARTING DEEP DIAGNOSIS 🕵️");
    console.log("--------------------------------");

    // A. Check PROFILES (Admin)
    const { data: profiles, error: pError } = await adminClient.from('profiles').select('id, full_name, role').limit(5);
    if (pError) console.error("❌ Admin accessing profiles failed:", pError.message);
    else console.log(`✅ Admin sees ${profiles.length} profiles (Sample: ${profiles[0]?.full_name})`);

    // B. Check TEAMS (Admin)
    const { data: teams, error: tError } = await adminClient.from('teams').select('*').limit(5);
    if (tError) console.error("❌ Admin accessing teams failed:", tError.message);
    else console.log(`✅ Admin sees ${teams.length} teams`);

    // C. Check RELATION profiles -> player_stats
    const { data: relCheck, error: relError } = await adminClient
        .from('profiles')
        .select('full_name, player_stats(xp)')
        .eq('role', 'player')
        .limit(1);

    if (relError) console.error("❌ Relation Check Failed (profiles -> player_stats):", relError.message);
    else {
        if (relCheck.length > 0) {
            console.log("✅ Relation Exists (admin):", JSON.stringify(relCheck[0]));
        } else {
            console.log("⚠️ No players found in profiles to check relation.");
        }
    }

    // D. CHECK PARENT User
    console.log("\n👨‍👩‍👧 CHECKING PARENT USER 👨‍👩‍👧");
    const { data: parentProfile, error: parentError } = await adminClient
        .from('profiles')
        .select('*')
        .eq('role', 'parent')
        .limit(1);

    if (parentProfile && parentProfile.length > 0) {
        console.log(`✅ Found Parent Profile: ${parentProfile[0].full_name} (ID: ${parentProfile[0].id})`);
    } else {
        console.error("❌ NO PARENT PROFILE FOUND! The login is failing because this user does not exist.");
    }

    // E. TEST RLS (Public Access)
    console.log("\n🔒 TESTING PUBLIC ACCESS (RLS) 🔒");

    const { data: publicProfiles, error: rlsError } = await publicClient.from('profiles').select('id, full_name').limit(5);
    if (rlsError) {
        console.error("❌ RLS BLOCKING PROFILES:", rlsError.message);
        console.error("   -> This means the 'ENABLE ROW LEVEL SECURITY' is ON but no Policy allows SELECT.");
    } else {
        console.log(`✅ Public Client sees ${publicProfiles.length} profiles.`);
        if (publicProfiles.length === 0 && profiles.length > 0) {
            console.error("❌ RLS IS HIDING DATA! (Admin sees rows, Public sees 0)");
        }
    }

    console.log("--------------------------------");
    console.log("Diagnosis Complete.");
}

diagnose();
