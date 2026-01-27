#!/usr/bin/env node

/**
 * Auto Seed Permanent Data (Drills & Badges)
 * Uses Supabase service role key to execute SQL
 *
 * Run with: node scripts/auto_seed_permanent.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Missing environment variables!');
    console.error('   VITE_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', SERVICE_ROLE_KEY ? '✓' : '✗');
    console.error('\nCheck your .env file');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

console.log('');
console.log('🔒 AUTO SEED PERMANENT DATA');
console.log('='.repeat(60));
console.log('');

async function seedDrills() {
    console.log('📦 Seeding 156 drills...');

    const sqlPath = path.join(__dirname, '../supabase/seed/seed_permanent.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Extract just the drills INSERT statement
    const drillsMatch = sql.match(/INSERT INTO drills[\s\S]*?ON CONFLICT \(id\) DO NOTHING;/);

    if (!drillsMatch) {
        throw new Error('Could not find drills INSERT statement in SQL file');
    }

    const { error } = await supabase.rpc('exec_sql', { sql_query: drillsMatch[0] });

    if (error) {
        console.error('❌ Error seeding drills:', error);
        throw error;
    }

    const { count } = await supabase.from('drills').select('*', { count: 'exact', head: true });
    console.log(`✅ Drills seeded successfully! Total count: ${count}`);
}

async function seedBadges() {
    console.log('🏆 Seeding 15 badges...');

    const sqlPath = path.join(__dirname, '../supabase/seed/seed_permanent.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Extract just the badges INSERT statement
    const badgesMatch = sql.match(/INSERT INTO badges[\s\S]*?ON CONFLICT \(id\) DO NOTHING;/);

    if (!badgesMatch) {
        throw new Error('Could not find badges INSERT statement in SQL file');
    }

    const { error } = await supabase.rpc('exec_sql', { sql_query: badgesMatch[0] });

    if (error) {
        console.error('❌ Error seeding badges:', error);
        throw error;
    }

    const { count } = await supabase.from('badges').select('*', { count: 'exact', head: true });
    console.log(`✅ Badges seeded successfully! Total count: ${count}`);
}

async function main() {
    try {
        await seedDrills();
        await seedBadges();

        console.log('');
        console.log('🎉 PERMANENT DATA SEEDED SUCCESSFULLY!');
        console.log('');
        console.log('Verification:');

        const { count: drillCount } = await supabase.from('drills').select('*', { count: 'exact', head: true });
        const { count: badgeCount } = await supabase.from('badges').select('*', { count: 'exact', head: true });

        console.log(`  • Drills: ${drillCount} (expected: 156)`);
        console.log(`  • Badges: ${badgeCount} (expected: 15)`);
        console.log('');

        if (drillCount !== 156 || badgeCount !== 15) {
            console.warn('⚠️  Counts do not match expected values. Some inserts may have been skipped (ON CONFLICT).');
        }

    } catch (error) {
        console.error('');
        console.error('❌ SEED FAILED:', error.message);
        console.error('');
        console.error('Falling back to manual seed:');
        console.error('  1. Open Supabase Dashboard → SQL Editor');
        console.error('  2. Copy contents of: supabase/seed/seed_permanent.sql');
        console.error('  3. Paste and click "Run"');
        console.error('');
        process.exit(1);
    }
}

main();
