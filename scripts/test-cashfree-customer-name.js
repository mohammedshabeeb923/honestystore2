/**
 * Test Suite: Cashfree Customer Name, Gmail ID & Payment Payer Resolution
 */

const assert = require('assert');
const serverSupabase = require('../server-supabase');

async function runTests() {
  console.log('====================================================');
  console.log('CASHFREE CUSTOMER NAME & GMAIL ID TRACKING TEST');
  console.log('====================================================\n');

  // TEST 1: Order created with Gmail ID (extracts username, never Honesty Customer)
  console.log('TEST 1: Creating order with Gmail ID (mohammedshabeeb923@gmail.com)...');
  const gmailOrder = await serverSupabase.createOrder({
    id: 'test_cf_gmail_' + Date.now(),
    customerEmail: 'mohammedshabeeb923@gmail.com',
    customerPhone: '9876543210',
    amount: 25,
    items: [
      { id: 'dailee_mango', name: 'Dailee Mango', qty: 2, price: 10, category: 'Drinks' },
      { id: 'lays', name: 'Lays', qty: 1, price: 5, category: 'Chips' }
    ]
  });

  assert(gmailOrder.customer_name === 'mohammedshabeeb923', `Expected 'mohammedshabeeb923', got '${gmailOrder.customer_name}'`);
  assert(!gmailOrder.customer_name.toLowerCase().includes('honesty'), 'customer_name must not include honesty');
  console.log(`✓ PASS: Gmail ID converted to customer name: "${gmailOrder.customer_name}"\n`);

  // TEST 2: Order created with custom Name & Gmail
  console.log('TEST 2: Creating order with custom Name & Email...');
  const namedOrder = await serverSupabase.createOrder({
    id: 'test_cf_name_' + Date.now(),
    customerName: 'Shibinsha Live',
    customerEmail: 'shibinsha@example.com',
    customerPhone: '9876543211',
    amount: 10,
    items: [{ id: 'dailee_mango', name: 'Dailee Mango', qty: 1, price: 10, category: 'Drinks' }]
  });

  assert(namedOrder.customer_name === 'Shibinsha Live', `Expected 'Shibinsha Live', got '${namedOrder.customer_name}'`);
  console.log(`✓ PASS: Customer real name preserved: "${namedOrder.customer_name}"\n`);

  // TEST 3: Order created with Phone only (no Gmail, no custom name)
  console.log('TEST 3: Creating order with Phone only (e.g. 9123456780)...');
  const phoneOnlyOrder = await serverSupabase.createOrder({
    id: 'test_cf_phone_' + Date.now(),
    customerPhone: '9123456780',
    amount: 10,
    items: [{ id: 'lays', name: 'Lays', qty: 2, price: 5, category: 'Chips' }]
  });

  assert(phoneOnlyOrder.customer_name === 'Customer 9123456780', `Expected 'Customer 9123456780', got '${phoneOnlyOrder.customer_name}'`);
  assert(!phoneOnlyOrder.customer_name.toLowerCase().includes('honesty'), 'customer_name must not include honesty');
  console.log(`✓ PASS: Phone-only order resolved to: "${phoneOnlyOrder.customer_name}"\n`);

  // TEST 4: Payment Confirmation with UPI Payer Info from Cashfree
  console.log('TEST 4: Confirming payment with Cashfree UPI payer info (shibinsha@oksbi)...');
  const confirmed = await serverSupabase.confirmOrderPayment(
    phoneOnlyOrder.id,
    'cf_pay_998877',
    'cf_ord_998877',
    {
      payerInfo: 'shibinsha@oksbi',
      paymentMethod: 'UPI'
    }
  );

  assert(confirmed.order.customer_name === 'shibinsha (shibinsha@oksbi)', `Expected 'shibinsha (shibinsha@oksbi)', got '${confirmed.order.customer_name}'`);
  console.log(`✓ PASS: Order customer name updated from payment payer info: "${confirmed.order.customer_name}"\n`);

  // TEST 5: Verify getSalesAnalytics & Payment Tracking reflects real names
  console.log('TEST 5: Verifying Sales Analytics & Payment Tracking displays real names...');
  const analytics = await serverSupabase.getSalesAnalytics({ period: 'today' });
  const paymentRecord = analytics.payments.find(p => p.orderId === phoneOnlyOrder.id);
  assert(paymentRecord, 'Payment record must exist');
  assert(paymentRecord.customer === 'shibinsha (shibinsha@oksbi)', `Expected payment customer to be 'shibinsha (shibinsha@oksbi)', got '${paymentRecord.customer}'`);
  console.log(`✓ PASS: Payment Tracking displays real customer name: "${paymentRecord.customer}"\n`);

  // TEST 6: Verify Product Sales ("Who Took What") displays real names
  console.log('TEST 6: Verifying Product Sales buyer audit displays real names...');
  const buyersReport = await serverSupabase.getProductSalesHistory('dailee_mango');
  const buyerTx = buyersReport.transactions.find(t => t.orderId === gmailOrder.id);
  assert(buyerTx, 'Buyer transaction must exist');
  assert(buyerTx.customerName === 'mohammedshabeeb923', `Expected 'mohammedshabeeb923', got '${buyerTx.customerName}'`);
  console.log(`✓ PASS: Buyer audit displays real customer name: "${buyerTx.customerName}"\n`);

  console.log('====================================================');
  console.log('🎉 ALL CASHFREE CUSTOMER NAME & GMAIL TESTS PASSED 100%!');
  console.log('====================================================\n');
}

runTests().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
