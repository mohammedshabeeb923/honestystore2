/**
 * Live Supabase Connection and Permissions Diagnostic
 */
const fs = require('fs');
const path = require('path');

const serverSupabase = require('../server-supabase.js');

async function testSupabase() {
  console.log('--- TESTING LIVE SUPABASE CONNECTION & PERMISSIONS ---');
  const env = serverSupabase.getEnv();
  console.log('Supabase URL:', env.url);
  console.log('Supabase Key Prefix:', env.key.slice(0, 20) + '...');
  
  // 1. Test reading products from Supabase directly
  try {
    const products = await serverSupabase.fetchApi('products', { query: '?select=*&limit=5' });
    console.log(`✓ Read products success: found ${products.length} products`);
    if (products.length > 0) {
      console.log('  Sample product:', products[0].id, products[0].name, 'Stock:', products[0].stock, 'Price:', products[0].price);
    }
  } catch (err) {
    console.error('✕ Failed to read products from Supabase:', err.message);
  }

  // 2. Test reading orders from Supabase directly
  try {
    const orders = await serverSupabase.fetchApi('orders', { query: '?select=*&limit=5' });
    console.log(`✓ Read orders success: found ${orders ? orders.length : 0} orders`);
  } catch (err) {
    console.error('✕ Failed to read orders from Supabase:', err.message);
  }

  // 3. Test writing/patching a product in Supabase directly
  try {
    const testPatch = await serverSupabase.fetchApi('products', {
      method: 'PATCH',
      query: '?id=eq.lays',
      body: { updated_at: new Date().toISOString() }
    });
    console.log('✓ PATCH product in Supabase success:', testPatch);
  } catch (err) {
    console.error('✕ Failed to PATCH product in Supabase:', err.message);
  }

  // 4. Test reading admin_users
  try {
    const admins = await serverSupabase.fetchApi('admin_users', { query: '?select=*' });
    console.log(`✓ Read admin_users success: found ${admins ? admins.length : 0} admins`);
    if (admins) {
      console.log('  Admins count:', admins.length);
    }
  } catch (err) {
    console.error('✕ Failed to read admin_users from Supabase:', err.message);
  }
}

testSupabase().catch(console.error);
