#!/usr/bin/env node

/**
 * Seed Permanent Data (Drills & Badges)
 *
 * Run with: npm run seed:permanent
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlPath = path.join(__dirname, '../supabase/seed/seed_permanent.sql');

console.log('');
console.log('🔒 PERMANENT DATA SEED');
console.log('='.repeat(60));
console.log('');
console.log('This will seed permanent data:');
console.log('  • 156 Drills');
console.log('  • 15 Badge definitions');
console.log('');
console.log('⚠️  The Supabase JS client cannot execute raw SQL for security.');
console.log('    Please run the SQL file manually using one of these methods:');
console.log('');
console.log('📍 FILE LOCATION:');
console.log('   ' + sqlPath);
console.log('');
console.log('🔧 OPTION 1 - Supabase Dashboard (Recommended):');
console.log('   1. Open Supabase Dashboard > SQL Editor');
console.log('   2. Copy contents of: supabase/seed/seed_permanent.sql');
console.log('   3. Paste and click "Run"');
console.log('');
console.log('🔧 OPTION 2 - psql Command Line:');
console.log('   psql "<YOUR_DB_CONNECTION_STRING>" -f supabase/seed/seed_permanent.sql');
console.log('');
console.log('✅ Safe to run multiple times (uses ON CONFLICT DO NOTHING)');
console.log('');

// Verify file exists
if (fs.existsSync(sqlPath)) {
    const stats = fs.statSync(sqlPath);
    const lines = fs.readFileSync(sqlPath, 'utf8').split('\n').length;
    console.log(`📄 File verified: ${lines} lines, ${(stats.size / 1024).toFixed(1)}KB`);
} else {
    console.error('❌ File not found!');
    process.exit(1);
}

console.log('');
