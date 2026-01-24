import { supabase } from './supabaseClient';

export const seedDemoData = async () => {
    console.log("Starting U11 Roster Seed (RPC)...");

    try {
        const { data, error } = await supabase.rpc('seed_u11_roster');

        if (error) throw error;

        console.log("Seeding Result:", data);
        alert(`U11 Roster Seeded Successfully!\n\n15 Players Updated (Corrected Names).\n\nLogin Support:\n- Coach Mike (FIRE-2026)\n- Demo Parent\n- Demo Manager\n- All Players (PIN: 1234)`);

    } catch (err) {
        console.error("Seeding Failed:", err);
        alert("Seeding Failed: " + err.message);
    }
};
