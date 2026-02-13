
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error("Missing keys");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function fixRoster() {
    console.log("🔧 Fixing Roster Names...");

    const updates = [
        { old: "Andres Jimenez", new: "Santi Jimenez" },
        { old: "Christian McCarty", new: "Jameson McCarthy" },
        { old: "Eryk", new: "Bryce" }, // Fuzzy match validation needed? Assuming full name contains this
        { old: "Julian Gonzalez", new: "Manny Gonzalez" },
        { old: "Kason", new: "Kayden" }, // Fuzzy match
        { old: "Tanishq", new: "Santiago" } // Fuzzy match
    ];

    // 1. Fetch all players to find IDs
    const { data: players, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'player');

    if (error) {
        console.error("Error fetching players:", error);
        return;
    }

    for (const update of updates) {
        // Find player matching "old" name (partial match if needed)
        const player = players.find(p => p.full_name.includes(update.old));

        if (player) {
            console.log(`Found ${player.full_name}, Rename to -> ${update.new}`);
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ full_name: update.new })
                .eq('id', player.id);

            if (updateError) console.error(`Failed to update ${player.full_name}:`, updateError);
            else console.log(`✅ Updated: ${update.new}`);
        } else {
            console.warn(`⚠️ Could not find player matching "${update.old}"`);
        }
    }

    // 2. Restore Bo Tipp (Demo Player)
    // We assume the user logging in as 'isaac@firefc.com' (seeded from seed_roster.js) is the "Demo Player".
    // Or we simply check for "Isaac Martinez" and rename him to "Bo Tipp".
    // The user said "Put Bo's information and pic back on the demo pager".

    // Let's find "Isaac Martinez" (from original seed)
    const demoPlayer = players.find(p => p.full_name.includes("Isaac Martinez"));
    if (demoPlayer) {
        console.log("Restoring Bo Tipp identity to:", demoPlayer.id);
        const { error: boError } = await supabase
            .from('profiles')
            .update({
                full_name: "Bo Tipp",
                avatar_url: "/players/bo_tipp_enhanced.png" // Ensure this matches what user wants
            })
            .eq('id', demoPlayer.id);

        if (boError) console.error("Failed to restore Bo:", boError);
        else console.log("✅ Restored Bo Tipp!");
    } else {
        // Double check if he is already Bo Tipp
        const boAlready = players.find(p => p.full_name === "Bo Tipp");
        if (boAlready) console.log("✅ Bo Tipp already exists.");
        else console.warn("⚠️ Could not find Isaac Martinez to convert to Bo Tipp.");
    }

    console.log("🎉 Roster Fixes Complete.");
}

fixRoster();
