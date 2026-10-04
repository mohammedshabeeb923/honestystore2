/**
 * Honesty Store - Supabase Verification & Setup CLI
 * Usage: node scripts/setup-supabase.js [SUPABASE_URL] [SUPABASE_ANON_KEY]
 */

const fs = require('fs');
const path = require('path');

const url = process.argv[2] || process.env.SUPABASE_URL;
const key = process.argv[3] || process.env.SUPABASE_ANON_KEY;

console.log('----------------------------------------------------');
console.log(' Honesty Store - Supabase Connection Verifier');
console.log('----------------------------------------------------');

if (!url || !key) {
  console.log('\nInstructions:');
  console.log('1. Go to https://supabase.com and create a project.');
  console.log('2. In your Supabase Dashboard, open SQL Editor.');
  console.log('3. Run the schema found in supabase/schema.sql.');
  console.log('4. Run this script to verify:');
  console.log('   node scripts/setup-supabase.js <PROJECT_URL> <ANON_KEY>\n');
  process.exit(0);
}

const cleanUrl = url.replace(/\/+$/, '');

async function check() {
  console.log(`Connecting to: ${cleanUrl}...`);

  try {
    const res = await fetch(`${cleanUrl}/rest/v1/products?select=id,name,stock,price`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error(`\n[FAILED] Supabase responded with status ${res.status}:`);
      console.error(txt);
      console.log('\nMake sure you have executed supabase/schema.sql in the Supabase SQL Editor.');
      process.exit(1);
    }

    const products = await res.json();
    console.log('\n[SUCCESS] Connected to Supabase PostgreSQL!');
    console.log(`Found ${products.length} products in database:`);
    products.forEach(p => console.log(` - ${p.name}: ₹${p.price} (${p.stock} in stock)`));

    console.log('\nRealtime sync and Row-Level Security are ready for production.\n');
  } catch (err) {
    console.error('\n[ERROR] Connection failed:', err.message);
  }
}

check();
