/**
 * Comprehensive Test: Admin API Endpoints & Cross-Device Sync
 */
const http = require('http');
const serverSupabase = require('../server-supabase');

function makeRequest(port, method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING COMPREHENSIVE ADMIN SYNC & API TESTS ---');

  // Spawn HTTP server on test port
  process.env.PORT = '45678';
  const server = require('../server');

  await new Promise(r => setTimeout(r, 800));

  // 1. Get an admin token for testing
  const authRes = await makeRequest(45678, 'POST', '/api/check-admin', {}, {
    // Test signed admin token generator directly
  });

  const crypto = require('crypto');
  const SERVER_SECRET = process.env.SERVER_SECRET || process.env.SUPABASE_ANON_KEY || 'honesty-store-cryptographic-token-salt-2026';
  const adminEmail = 'godson107111@gmail.com';
  const payload = {
    email: adminEmail,
    role: 'admin',
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 3600 * 1000
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SERVER_SECRET).update(body).digest('base64url');
  const adminToken = `admin_sess_${body}.${sig}`;

  console.log('\n[Test 1] Testing POST /api/admin/update-order-status security...');
  
  // 1a. Call without auth
  const unauthRes = await makeRequest(45678, 'POST', '/api/admin/update-order-status', {}, {
    orderId: 'ORD_123',
    status: 'COMPLETED'
  });
  console.log('  Unauthenticated request status:', unauthRes.status);
  if (unauthRes.status !== 401) throw new Error(`Expected 401 but got ${unauthRes.status}`);
  console.log('✓ Test 1a Passed: Unauthenticated call correctly blocked (HTTP 401)');

  // 1b. Call with forged token
  const forgedRes = await makeRequest(45678, 'POST', '/api/admin/update-order-status', {
    'Authorization': 'Bearer admin_sess_forged.signature'
  }, {
    orderId: 'ORD_123',
    status: 'COMPLETED'
  });
  console.log('  Forged token request status:', forgedRes.status);
  if (forgedRes.status !== 401) throw new Error(`Expected 401 but got ${forgedRes.status}`);
  console.log('✓ Test 1b Passed: Forged token correctly blocked (HTTP 401)');

  // 1c. Create test order and update status with valid admin token
  const testOrderId = 'TEST_HTTP_' + Date.now();
  await serverSupabase.createOrder({
    id: testOrderId,
    amount: 25,
    items: [{ id: 'oreo', qty: 2 }],
    status: 'PENDING'
  });

  const authUpdateRes = await makeRequest(45678, 'POST', '/api/admin/update-order-status', {
    'Authorization': `Bearer ${adminToken}`
  }, {
    orderId: testOrderId,
    status: 'COMPLETED'
  });
  console.log('  Authorized update status:', authUpdateRes.status, authUpdateRes.body);
  if (authUpdateRes.status !== 200 || !authUpdateRes.body.success) {
    throw new Error(`Expected 200 success but got ${authUpdateRes.status}`);
  }
  if (authUpdateRes.body.order.status !== 'COMPLETED') {
    throw new Error(`Expected status COMPLETED but got ${authUpdateRes.body.order.status}`);
  }
  console.log('✓ Test 1c Passed: Authorized admin updated order status to COMPLETED (HTTP 200)');

  // 1d. Update status to PAID
  const paidUpdateRes = await makeRequest(45678, 'POST', '/api/admin/update-order-status', {
    'Authorization': `Bearer ${adminToken}`
  }, {
    orderId: testOrderId,
    status: 'PAID'
  });
  if (paidUpdateRes.status !== 200 || paidUpdateRes.body.order.status !== 'PAID') {
    throw new Error(`Failed to update status to PAID`);
  }
  console.log('✓ Test 1d Passed: Admin updated order status to PAID (HTTP 200)');

  // 2. Test GET /api/admin/products
  console.log('\n[Test 2] Testing GET /api/admin/products...');
  const prodRes = await makeRequest(45678, 'GET', '/api/admin/products', {
    'Authorization': `Bearer ${adminToken}`
  });
  console.log(`  Fetched ${prodRes.body.products.length} products`);
  if (prodRes.status !== 200 || !prodRes.body.success) throw new Error('Failed to get admin products');
  console.log('✓ Test 2 Passed: Admin products retrieved successfully');

  // 3. Test POST /api/admin/adjust-stock
  console.log('\n[Test 3] Testing POST /api/admin/adjust-stock...');
  const adjustRes = await makeRequest(45678, 'POST', '/api/admin/adjust-stock', {
    'Authorization': `Bearer ${adminToken}`
  }, {
    productId: 'oreo',
    newStockLevel: 44,
    auditNote: 'Test adjustment',
    auditedBy: 'godson107111@gmail.com'
  });
  if (adjustRes.status !== 200 || !adjustRes.body.success) {
    throw new Error('Failed to adjust stock');
  }
  console.log('✓ Test 3 Passed: Admin stock adjustment succeeded (HTTP 200)');

  console.log('\n🎉 ALL TESTS PASSED WITH 100% SUCCESS!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
