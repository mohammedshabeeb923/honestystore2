/**
 * Comprehensive Automated Verification Suite for:
 * 1. Drinks Category
 * 2. Immutable Item-level Sales Snapshots
 * 3. Authoritative Sales & Payment Analytics
 * 4. Daily Reconciled Reports
 * 5. "Who Took What" Customer Audit Trail
 * 6. Exclusion of Failed/Pending Orders from Revenue
 */

const assert = require('assert');
const serverSupabase = require('../server-supabase');

async function runTests() {
  console.log('====================================================');
  console.log('HONESTY STORE — SALES, PAYMENTS & DRINKS TEST SUITE');
  console.log('====================================================\n');

  // TEST 1: CATEGORY RETRIEVAL (Includes Drinks)
  console.log('TEST 1: Dynamic Categories Retrieval...');
  const categories = await serverSupabase.getCategories();
  console.log('Categories returned:', categories);
  assert(categories.includes('Chips'), 'Missing Chips category');
  assert(categories.includes('Biscuits'), 'Missing Biscuits category');
  assert(categories.includes('Chocolates'), 'Missing Chocolates category');
  assert(categories.includes('Drinks'), 'Missing Drinks category');
  console.log('✓ PASS: All 4 standard categories (Chips, Biscuits, Chocolates, Drinks) verified.\n');

  // TEST 2: DAILEE MANGO PRODUCT VERIFICATION
  console.log('TEST 2: Dailee Mango Category & Pricing Verification...');
  const dailee = await serverSupabase.getProduct('dailee_mango');
  assert(dailee, 'dailee_mango product not found in database/catalog');
  assert.strictEqual(dailee.category, 'Drinks', `Expected category 'Drinks', got '${dailee.category}'`);
  assert(Number(dailee.selling_price || dailee.sellingPrice) > 0, 'Dailee Mango must have a valid selling price');
  console.log(`✓ PASS: Dailee Mango verified with category '${dailee.category}' and selling price ₹${dailee.selling_price || dailee.sellingPrice}.\n`);

  // TEST 3: ORDER CREATION WITH IMMUTABLE ITEM SNAPSHOTS
  console.log('TEST 3: Creating Order with Immutable Item Snapshots...');
  const testOrderId = 'test_order_' + Date.now();
  const testCustomer = {
    customerName: 'Test Student',
    customerEmail: 'test.student@example.com',
    customerPhone: '9876543210'
  };

  const testItems = [
    {
      id: 'dailee_mango',
      name: 'Dailee Mango',
      category: 'Drinks',
      price: 10.00,
      sellingPrice: 10.00,
      qty: 2
    },
    {
      id: 'lays',
      name: 'Lays',
      category: 'Chips',
      price: 5.00,
      sellingPrice: 5.00,
      qty: 3
    }
  ];

  const createdOrder = await serverSupabase.createOrder({
    orderId: testOrderId,
    items: testItems,
    orderAmount: 35.00,
    ...testCustomer
  });

  assert(createdOrder, 'Order creation failed');
  assert(createdOrder.order_number, 'Missing formatted order_number');
  console.log(`Created Order Number: ${createdOrder.order_number}`);

  // Verify item snapshots in created order
  const savedItems = createdOrder.items || [];
  assert.strictEqual(savedItems.length, 2, 'Expected 2 items saved');
  
  const daileeSnapshot = savedItems.find(i => i.id === 'dailee_mango');
  assert(daileeSnapshot, 'Dailee Mango snapshot not found');
  assert.strictEqual(daileeSnapshot.product_name_snapshot, 'Dailee Mango');
  assert.strictEqual(daileeSnapshot.product_category_snapshot, 'Drinks');
  assert.strictEqual(Number(daileeSnapshot.unit_price), 10.00);
  assert.strictEqual(Number(daileeSnapshot.quantity), 2);
  assert.strictEqual(Number(daileeSnapshot.item_total), 20.00);

  const laysSnapshot = savedItems.find(i => i.id === 'lays');
  assert(laysSnapshot, 'Lays snapshot not found');
  assert.strictEqual(laysSnapshot.product_name_snapshot, 'Lays');
  assert.strictEqual(laysSnapshot.product_category_snapshot, 'Chips');
  assert.strictEqual(Number(laysSnapshot.unit_price), 5.00);
  assert.strictEqual(Number(laysSnapshot.quantity), 3);
  assert.strictEqual(Number(laysSnapshot.item_total), 15.00);

  console.log('✓ PASS: Order created with immutable item snapshots and customer details.\n');

  // TEST 4: CONFIRM PAYMENT & EXCLUDE UNPAID ORDERS FROM REVENUE
  console.log('TEST 4: Authoritative Revenue Verification (Excluding Unpaid)...');
  
  // Before confirming, analytics should treat this order as pending
  const preAnalytics = await serverSupabase.getSalesAnalytics({ period: 'today' });
  const preRev = preAnalytics.summary.confirmedRevenue;
  
  // Create another order that remains FAILED
  const failedOrderId = 'test_failed_' + Date.now();
  await serverSupabase.createOrder({
    orderId: failedOrderId,
    items: [{ id: 'oreo', name: 'Oreo', category: 'Biscuits', price: 10, sellingPrice: 10, qty: 5 }],
    orderAmount: 50.00,
    customerName: 'Failed Attempt User',
    customerPhone: '9998887776'
  });
  await serverSupabase.markOrderAsFailed(failedOrderId, 'Bank Declined', 'cf_pay_failed_123');

  // Confirm the first order as PAID
  const confirmed = await serverSupabase.confirmOrderPayment(testOrderId, 'cf_pay_success_123', 'cf_order_test_123');
  assert.strictEqual(confirmed.order.status, 'PAID');
  assert.strictEqual(confirmed.order.order_status, 'COMPLETED');
  assert.strictEqual(confirmed.order.payment_status, 'PAID');
  assert.strictEqual(confirmed.order.payment_reference, 'cf_pay_success_123');

  // Check sales analytics now
  const postAnalytics = await serverSupabase.getSalesAnalytics({ period: 'today' });
  const postRev = postAnalytics.summary.confirmedRevenue;

  console.log(`Pre-confirmation Revenue: ₹${preRev}`);
  console.log(`Post-confirmation Revenue: ₹${postRev}`);
  assert.strictEqual(postRev - preRev, 35.00, `Expected exactly +₹35.00 confirmed revenue, got ₹${postRev - preRev}`);
  assert(postAnalytics.summary.failedPayments.count >= 1, 'Failed order must be recorded in failed payments count');
  console.log('✓ PASS: Confirmed revenue strictly counts PAID orders and excludes FAILED/PENDING orders.\n');

  // TEST 5: CATEGORY SALES REPORTING (Drinks, Chips, Biscuits, Chocolates)
  console.log('TEST 5: Category Breakdown & Percentage Share...');
  const catReport = postAnalytics.categories;
  console.log('Categories report:', catReport);
  
  const drinksCat = catReport.find(c => c.category === 'Drinks');
  assert(drinksCat, 'Drinks category not found in sales report');
  assert(drinksCat.itemsSold >= 2, `Expected at least 2 Drinks units sold, got ${drinksCat.itemsSold}`);
  assert(drinksCat.revenue >= 20.00, `Expected at least ₹20.00 Drinks revenue, got ${drinksCat.revenue}`);
  assert(drinksCat.share > 0, 'Drinks category share % should be greater than 0');

  const chipsCat = catReport.find(c => c.category === 'Chips');
  assert(chipsCat, 'Chips category not found in sales report');
  assert(chipsCat.itemsSold >= 3, `Expected at least 3 Chips units sold, got ${chipsCat.itemsSold}`);
  assert(chipsCat.revenue >= 15.00, `Expected at least ₹15.00 Chips revenue, got ${chipsCat.revenue}`);

  console.log('✓ PASS: Category sales accurately reflect items sold, revenue, and % share.\n');

  // TEST 6: "WHO TOOK WHAT" - PRODUCT SALES AUDIT TRAIL
  console.log('TEST 6: "Who Took What" Product Traceability Audit...');
  const whoTookDailee = await serverSupabase.getProductSalesHistory('dailee_mango');
  assert(whoTookDailee, 'Product sales history failed');
  assert(whoTookDailee.totalUnitsSold >= 2, 'Total units sold mismatch');
  assert(whoTookDailee.totalRevenue >= 20.00, 'Total revenue mismatch');

  const daileeTx = whoTookDailee.transactions.find(t => t.orderId === testOrderId);
  assert(daileeTx, 'Purchase transaction not found in product audit trail');
  assert.strictEqual(daileeTx.customerName, 'Test Student');
  assert.strictEqual(daileeTx.customerEmail, 'test.student@example.com');
  assert.strictEqual(daileeTx.customerPhone, '9876543210');
  assert.strictEqual(daileeTx.quantity, 2);
  assert.strictEqual(daileeTx.unitPrice, 10.00);
  assert.strictEqual(daileeTx.itemTotal, 20.00);
  assert.strictEqual(daileeTx.paymentStatus, 'PAID');
  console.log('✓ PASS: "Who Took What" successfully traces customer name, phone, email, and snapshot price.\n');

  // TEST 7: DAILY REPORT SUMMARY
  console.log('TEST 7: Daily End-of-Day Sales Report...');
  const todayStr = new Date().toISOString().split('T')[0];
  const dailyReport = await serverSupabase.getDailyReport(todayStr);
  assert(dailyReport, 'Daily report failed');
  assert.strictEqual(dailyReport.date, todayStr);
  assert(dailyReport.summary.confirmedRevenue >= 35.00);
  assert(dailyReport.summary.totalItemsSold >= 5);
  assert(Array.isArray(dailyReport.products), 'Daily report missing products breakdown');
  assert(Array.isArray(dailyReport.categories), 'Daily report missing categories breakdown');
  assert(Array.isArray(dailyReport.orders), 'Daily report missing orders list');
  console.log('✓ PASS: Daily end-of-day report verified with gross, net, products, categories, and orders.\n');

  console.log('====================================================');
  console.log('🎉 ALL SALES TRACKING & DRINKS TESTS PASSED 100%!');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILURE:', err);
  process.exit(1);
});
