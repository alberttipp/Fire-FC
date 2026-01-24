
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

// Load .env manual parsing because dotenv might not find it in root easily without config if run from weird path
const envPath = resolve('./.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Valid Hex UUIDs (0-9, a-f)
// Pattern: 00eebc99-9c0b-4ef8-bb6d-6bb9bd3800[NUM]
const roster = [
    { id: '00eebc99-9c0b-4ef8-bb6d-6bb9bd380070', email: 'isaac@firefc.com', full_name: 'Isaac Martinez', role: 'player', avatar_url: '/branding/roster_photo.jpg', number: '70', xp: 450, level: 2 },
    { id: '00eebc99-9c0b-4ef8-bb6d-6bb9bd380045', email: 'andres@firefc.com', full_name: 'Andres Jimenez', role: 'player', avatar_url: '/branding/roster_photo.jpg', number: '45', xp: 520, level: 3 },
    { id: '00eebc99-9c0b-4ef8-bb6d-6bb9bd380087', email: 'julian@firefc.com', full_name: 'Julian Gonzalez', role: 'player', avatar_url: '/branding/roster_photo.jpg', number: '87', xp: 300, level: 1 },
    { id: '00eebc99-9c0b-4ef8-bb6d-6bb9bd380010', email: 'izan@firefc.com', full_name: 'Izan Garcia', role: 'player', avatar_url: '/branding/roster_photo.jpg', number: '10', xp: 890, level: 4 },
    { id: '00eebc99-9c0b-4ef8-bb6d-6bb9bd380006', email: 'christian@firefc.com', full_name: 'Christian McCarty', role: 'player', avatar_url: '/branding/roster_photo.jpg', number: '6', xp: 410, level: 2 },
    { id: '00eebc99-9c0b-4ef8-bb6d-6bb9bd380041', email: 'kason@firefc.com', full_name: 'Kason Watkins', role: 'player', avatar_url: '/branding/roster_photo.jpg', number: '41', xp: 600, level: 3 },
    { id: '00eebc99-9c0b-4ef8-bb6d-6bb9bd380004', email: 'masen@firefc.com', full_name: 'Masen Dennis', role: 'player', avatar_url: '/branding/roster_photo.jpg', number: '4', xp: 350, level: 2 },
    { id: '00eebc99-9c0b-4ef8-bb6d-6bb9bd380044', email: 'eryk@firefc.com', full_name: 'Eryk Anderson', role: 'player', avatar_url: '/branding/roster_photo.jpg', number: '44', xp: 480, level: 2 },
    { id: '00eebc99-9c0b-4ef8-bb6d-6bb9bd380053', email: 'charlie@firefc.com', full_name: 'Charlie Judd', role: 'player', avatar_url: '/branding/roster_photo.jpg', number: '53', xp: 720, level: 3 },
    { id: '00eebc99-9c0b-4ef8-bb6d-6bb9bd380026', email: 'oliver@firefc.com', full_name: 'Oliver Schrohm', role: 'player', avatar_url: '/branding/roster_photo.jpg', number: '26', xp: 290, level: 1 },
    { id: '00eebc99-9c0b-4ef8-bb6d-6bb9bd380016', email: 'ethan@firefc.com', full_name: 'Ethan Grajales', role: 'player', avatar_url: '/branding/roster_photo.jpg', number: '16', xp: 550, level: 3 },
    { id: '00eebc99-9c0b-4ef8-bb6d-6bb9bd380042', email: 'ty@firefc.com', full_name: 'Ty Carroll', role: 'player', avatar_url: '/branding/roster_photo.jpg', number: '42', xp: 630, level: 3 },
    { id: '00eebc99-9c0b-4ef8-bb6d-6bb9bd380011', email: 'tanishq@firefc.com', full_name: 'Tanishq Agurre', role: 'player', avatar_url: '/branding/roster_photo.jpg', number: '11', xp: 810, level: 4 },
    { id: '00eebc99-9c0b-4ef8-bb6d-6bb9bd380036', email: 'luke@firefc.com', full_name: 'Luke Anderson', role: 'player', avatar_url: '/branding/roster_photo.jpg', number: '36', xp: 320, level: 2 },
    // Adding Bo Tipp explicitly to ensure stats update
    { id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', email: 'bo@firefc.com', full_name: 'Bo Tipp', role: 'player', avatar_url: '/players/bo_tipp_enhanced.png', number: '58', xp: 1250, level: 5 }
];


const teamId = '11eebc99-9c0b-4ef8-bb6d-6bb9bd380055';
const coachId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// Helper to ensure Auth user exists
async function ensureAuthUser(id, email, password = 'firefc123') {
    // Check if exists (by retrieving, or just try verify)
    // createUser with explicit ID works in Supabase Admin API
    const { data, error } = await supabase.auth.admin.createUser({
        id: id,
        email: email,
        password: password,
        email_confirm: true
    });

    if (error) {
        // If error is "User already registered", that's fine, we proceed.
        if (error.message.includes('already registered') || error.status === 422) {
            console.log(`ℹ️ Auth User exists: ${email}`);
            return true;
        }
        console.error(`❌ Auth Error (${email}):`, error.message);
        return false;
    }
    console.log(`✅ Created Auth User: ${email}`);
    return true;
}

async function seed() {
    console.log('🌱 Starting Roster Seed...');
    console.log('🔌 Connecting to:', supabaseUrl);

    // 1. Create Coach & Team
    console.log('--- Setting up Coach & Team ---');
    await ensureAuthUser(coachId, 'coach@firefc.com');

    // Upsert Coach Profile
    const { error: coachError } = await supabase.from('profiles').upsert({
        id: coachId,
        email: 'coach@firefc.com',
        full_name: 'Coach Mike',
        role: 'coach',
        avatar_url: 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
    });
    if (coachError) console.error('Coach Profile Error:', coachError.message);

    // Upsert Team
    const { error: teamError } = await supabase.from('teams').upsert({
        id: teamId,
        name: 'Fire FC U10',
        age_group: 'U10 Boys',
        coach_id: coachId
    });
    if (teamError) console.error('Team Error:', teamError);
    else console.log('✅ Team Synced');

    // 2. Roster
    console.log('--- Seeding Players ---');
    for (const p of roster) {
        // a. Ensure Auth
        const authOk = await ensureAuthUser(p.id, p.email);
        if (!authOk) continue;

        // b. Profile
        const { error: profError } = await supabase.from('profiles').upsert({
            id: p.id,
            email: p.email,
            full_name: p.full_name,
            role: p.role,
            avatar_url: p.avatar_url,
            team_id: teamId
        });

        if (profError) {
            console.error(`❌ Profile Error (${p.full_name}):`, profError.message);
            continue;
        }

        // c. Stats
        const { error: statError } = await supabase.from('player_stats').upsert({
            player_id: p.id,
            number: p.number,
            xp: p.xp,
            level: p.level,
            messi_mode_unlocked: p.id.includes('b0eebc99') // Only Bo starts unlocked
        }, { onConflict: 'player_id' });

        if (statError) console.error(`❌ Stats Error (${p.full_name}):`, statError.message);
        else console.log(`✅ Seeded: ${p.full_name} (#${p.number})`);
    }

    console.log('🏁 Seeding Complete!');
}

seed();
