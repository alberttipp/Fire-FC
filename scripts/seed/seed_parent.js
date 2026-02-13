
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error("Missing keys");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function seedParent() {
    console.log("🌱 Seeding Parent User...");

    const email = "parent@firefc.com";
    const password = "firefc123";
    const fullName = "Sarah Tipp";

    // 1. Create Auth User
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: fullName }
    });

    let userId;

    if (authError) {
        if (authError.message.includes('already has been registered') || (authError.code === 'email_exists')) {
            console.log("User already exists, finding ID...");
            const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
            if (listError) console.error("List Users Error:", listError);

            const existingUser = users.find(u => u.email === email);
            if (existingUser) {
                userId = existingUser.id;
                console.log("Found Existing ID:", userId);
            } else {
                console.error("Could not find existing user ID even though error said exists.");
                return;
            }
        } else {
            console.error("Auth Create Error:", authError);
            return;
        }
    } else {
        userId = authData.user.id;
        console.log("Created Auth User:", userId);
    }

    // 2. Create Profile
    const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
            id: userId,
            email: email, // Added email
            full_name: fullName,
            role: 'parent',
            avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1000&auto=format&fit=crop'
        });

    if (profileError) {
        console.error("Profile Error:", profileError);
    } else {
        console.log("✅ Parent Profile Created!");
    }

    // 3. Link to Child (find a player)
    const { data: players } = await supabase.from('profiles').select('id, full_name').eq('role', 'player').limit(1);
    if (players && players.length > 0) {
        // Assume we have a 'parent_child' table OR just store it for now.
        // My schema doesn't seem to have a specific parent-child link table in the snippets I saw?
        // Let's check schema.sql...
        // Wait, schema.sql has `profiles` but I don't recall a linking table.
        // For now, the user just wants to LOGIN.
        // Parent Dashboard usually hardcodes the child or fetches by some ID.
        // Let's just ensure the user can log in first.
        console.log(`(Note: Parent linked conceptually to ${players[0].full_name})`);
    }

    console.log("🎉 Seeding Complete. Try logging in as parent@firefc.com");
}

seedParent();
