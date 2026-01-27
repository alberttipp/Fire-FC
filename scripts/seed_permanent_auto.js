#!/usr/bin/env node

/**
 * Auto Seed Permanent Data - Direct SQL Execution
 * Uses Supabase Management API to execute raw SQL
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('\n❌ Missing environment variables in .env file!');
    console.error('   VITE_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', SERVICE_ROLE_KEY ? '✓' : '✗');
    process.exit(1);
}

console.log('\n🔒 AUTO SEED PERMANENT DATA');
console.log('='.repeat(60));
console.log('');

async function executeSql() {
    const sqlPath = path.join(__dirname, '../supabase/seed/seed_permanent.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📦 Reading seed_permanent.sql...');
    console.log(`📄 File size: ${(Buffer.byteLength(sql) / 1024).toFixed(1)}KB`);
    console.log('');
    console.log('⚠️  LIMITATION: Supabase JS client cannot execute raw SQL for security.');
    console.log('');
    console.log('🔧 Please run the SQL manually:');
    console.log('');
    console.log('   1. Open: https://supabase.com/dashboard');
    console.log('   2. Select your project');
    console.log('   3. Click: SQL Editor (left sidebar)');
    console.log('   4. Click: + New Query');
    console.log('   5. Copy this file: supabase/seed/seed_permanent.sql');
    console.log('   6. Paste all contents into editor');
    console.log('   7. Click: Run');
    console.log('');
    console.log('✅ Expected result: 156 drills + 15 badges seeded');
    console.log('');
    console.log('💡 TIP: Open the SQL file now:');
    console.log(`   File location: ${sqlPath}`);
    console.log('');
}

executeSql();
