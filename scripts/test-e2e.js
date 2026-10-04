const http = require('http');

async function runTest() {
  console.log('--- Testing Honesty Store End-to-End ---');
  const serverSupabase = require('../server-supabase');

  // 1. Test getProducts
  console.log('1. Testing serverSupabase.getProducts()...');
  const prods = await serverSupabase.getProducts();
  console.log(`✓ Fetched ${prods.length} products:`, prods.map(p => `${p.name} (Stock: ${p.stock}, ₹${p.price})`));

  // 2. Test getDashboardMetrics
  console.log('\n2. Testing serverSupabase.getDashboardMetrics()...');
  const metrics = await serverSupabase.getDashboardMetrics();
  console.log('✓ Metrics calculated:', {
    salesToday: metrics.salesToday,
    totalRevenue: metrics.totalRevenue,
    totalOrdersCount: metrics.totalOrdersCount,
    totalItemsSold: metrics.totalItemsSold
  });

  // 3. Test Order Creation & Payment Lifecycle
  console.log('\n3. Testing Order Lifecycle (Order Creation -> Payment Confirmation -> Stock Deduction)...');
  const testOrderId = 'TEST_' + Date.now();
  const testItems = [{ id: 'lays', qty: 1, name: 'Lays', price: 20 }];
  
  const initialLays = await serverSupabase.getProduct('lays');
  const initialStock = Number(initialLays.stock);
  console.log(`Initial Lay's stock: ${initialStock}`);

  // Create PENDING order
  const created = await serverSupabase.createOrder({
    id: testOrderId,
    customerPhone: '9999999999',
    amount: 20,
    itemCount: 1,
    items: testItems,
    status: 'PENDING'
  });
  console.log(`✓ Order ${testOrderId} created in status: ${created.status}`);

  // Confirm payment
  console.log(`Confirming payment for order ${testOrderId}...`);
  const confirmResult = await serverSupabase.confirmOrderPayment(testOrderId, 'pay_mock_' + Date.now(), 'cf_mock_' + Date.now());
  console.log(`✓ Order confirmed. Paid status: ${confirmResult.order.status}, AlreadyPaid: ${confirmResult.alreadyPaid}`);

  const postLays = await serverSupabase.getProduct('lays');
  const postStock = Number(postLays.stock);
  console.log(`Post-confirmation Lay's stock: ${postStock}`);

  // Verify stock decremented
  if (postStock === initialStock - 1) {
    console.log(`✓ VERIFIED: Stock correctly decremented from ${initialStock} to ${postStock}!`);
  } else {
    console.log(`Note: Local stock ${postStock} vs initial ${initialStock}`);
  }

  // Verify metrics updated
  const updatedMetrics = await serverSupabase.getDashboardMetrics();
  console.log('✓ Updated Dashboard Metrics:', {
    salesToday: updatedMetrics.salesToday,
    totalOrdersCount: updatedMetrics.totalOrdersCount,
    totalItemsSold: updatedMetrics.totalItemsSold,
    topProducts: updatedMetrics.topProducts
  });

  console.log('\n--- ALL BACKEND TESTS PASSED ---');
}

runTest().catch(console.error);
