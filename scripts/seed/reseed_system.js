
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error("Missing keys");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const DEMO_USERS = [
    { email: 'coach@firefc.com', name: 'Coach Mike', role: 'coach' },
    { email: 'bo@firefc.com', name: 'Bo Tipp', role: 'player' },
    { email: 'parent@firefc.com', name: 'Sarah Tipp', role: 'parent' },
    { email: 'manager@firefc.com', name: 'Club Director', role: 'manager' }
];

const ROSTER = [
    { name: 'Isaac Martinez', number: '70' },
    { name: 'Santi Jimenez', number: '45' },
    { name: 'Manny Gonzalez', number: '87' },
    { name: 'Izan Garcia', number: '10' },
    { name: 'Jameson McCarthy', number: '06' },
    { name: 'Kayden Watkins', number: '41' },
    { name: 'Masen Dennis', number: '04' },
    { name: 'Bryce Anderson', number: '44' },
    { name: 'Charlie Judd', number: '53' },
    { name: 'Oliver Schrohm', number: '26' },
    { name: 'Ethan Grajales', number: '16' },
    { name: 'Ty Carroll', number: '42' },
    { name: 'Santiago Agurre', number: '11' },
    { name: 'Luke Anderson', number: '36' }
];

async function seed() {
    console.log("🌱 Starting Full Database Seed...");

    // 1. Clean Up Old Users (Dangerous in Prod, fine for Dev)
    // Note: This won't clean profiles if FKs exist, but we dropped tables in schema.sql
    // We will just try to create. If exists, we'll fetch ID.

    const userMap = {}; // email -> id

    // 2. Create/Get Core Demo Users
    for (const u of DEMO_USERS) {
        let userId;
        // Try to verify exists
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const existing = users.find(x => x.email === u.email);

        if (existing) {
            userId = existing.id;
            console.log(`User exists: ${u.email} (${userId})`);
        } else {
            console.log(`Creating user: ${u.email}`);
            const { data, error } = await supabase.auth.admin.createUser({
                email: u.email,
                password: 'password123', // Hardcoded for demo
                email_confirm: true,
                user_metadata: { full_name: u.name, role: u.role }
            });
            if (error) { console.error("Error creating user:", error); continue; }
            userId = data.user.id;
        }
        userMap[u.role] = userId; // Store by role for easy access (last one wins if duplicates)
        userMap[u.email] = userId;

        // Create Profile
        await supabase.from('profiles').upsert({
            id: userId,
            email: u.email,
            full_name: u.name,
            role: u.role,
            avatar_url: u.role === 'player' ? '/players/bo_tipp_enhanced.png' : null
        });
    }

    // 3. Create Team
    const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .insert({
            name: 'Fire FC U10',
            age_group: 'U10 Boys',
            coach_id: userMap['coach']
        })
        .select()
        .single();

    if (teamError) console.error("Team Error:", teamError);
    const teamId = teamData?.id;
    console.log("Team Created:", teamId);

    // Update Coach & Bo Team FK
    if (teamId) {
        await supabase.from('profiles').update({ team_id: teamId }).eq('id', userMap['coach']);
        await supabase.from('profiles').update({ team_id: teamId }).eq('id', userMap['bo@firefc.com']);
    }

    // 4. Seed Roster (Players)
    for (const p of ROSTER) {
        const email = p.name.split(' ')[0].toLowerCase() + '@firefc.com';
        let userId;

        // Check/Create
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const existing = users.find(x => x.email === email);

        if (existing) {
            userId = existing.id;
        } else {
            const { data } = await supabase.auth.admin.createUser({
                email,
                password: 'password123',
                email_confirm: true,
                user_metadata: { full_name: p.name }
            });
            userId = data?.user?.id;
        }

        if (userId) {
            // Profile
            await supabase.from('profiles').upsert({
                id: userId,
                email: email,
                full_name: p.name,
                role: 'player',
                team_id: teamId,
                avatar_url: '/branding/roster_photo.jpg'
            });

            // Stats
            await supabase.from('player_stats').upsert({
                player_id: userId,
                number: p.number,
                level: Math.floor(Math.random() * 5) + 1,
                xp: Math.floor(Math.random() * 1000)
            }, { onConflict: 'player_id' });
        }
    }

    // 5. Seed Events
    console.log("📅 Seeding Events...");
    const events = [
        {
            team_id: teamId,
            title: 'U10 Boys Practice',
            type: 'practice',
            start_time: new Date(Date.now() + 86400000).toISOString(), // +1 day
            end_time: new Date(Date.now() + 93600000).toISOString(),
            location_name: 'Field 4',
            kit_color: 'red',
            created_by: userMap['coach']
        },
        {
            team_id: teamId,
            title: 'Fire FC vs Tigers',
            type: 'game',
            start_time: new Date(Date.now() + 259200000).toISOString(), // +3 days
            end_time: new Date(Date.now() + 266400000).toISOString(),
            location_name: 'Away Field',
            kit_color: 'white',
            created_by: userMap['coach']
        }
    ];

    const { data: eventData } = await supabase.from('events').insert(events).select();

    // 6. Seed RSVPs
    // Make Bo Tipp Going to both
    if (eventData && userMap['bo@firefc.com']) {
        for (const ev of eventData) {
            await supabase.from('event_rsvps').insert({
                event_id: ev.id,
                player_id: userMap['bo@firefc.com'],
                status: 'going'
            });
        }
    }

    console.log("✅ Database Reseed Complete!");
}

seed();
