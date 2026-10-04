// Test verification for Initial Honesty Store Product Master based on packing slip
const serverSupabase = require('../server-supabase');

async function verifyInitialMaster() {
  console.log('--- VERIFYING INITIAL PRODUCT MASTER & PACKING SLIP ---');

  const products = await serverSupabase.getProducts();
  console.log(`Loaded ${products.length} products from store database.\n`);

  const expectedList = [
    { id: 'lays', ref: 'LAYS RS 5', rate: 4.38, stock: 110 },
    { id: 'dailee_mango', ref: 'DAILEE [MANGO 12]', rate: 7.00, stock: 22 },
    { id: 'oreo', ref: 'OREO RS 10', rate: 8.86, stock: 44 },
    { id: 'munch', ref: 'MUNCH RS 10 [BOX]', rate: 209.00, stock: 1 },
    { id: 'snickers', ref: 'SNICKERS [10] 40PES', rate: 7.88, stock: 58 },
    { id: 'bournvita_biscuit', ref: 'BOURNVITA BISCUIT [10]', rate: 8.50, stock: 9 },
    { id: 'chocos', ref: 'CHOCOS RS 10', rate: 8.60, stock: 17 }
  ];

  let grossTotal = 0;
  let allFound = true;

  for (const exp of expectedList) {
    const prod = products.find(p => p.id === exp.id || p.reference_name === exp.ref);
    if (!prod) {
      console.error(`❌ Missing product: ${exp.ref} (${exp.id})`);
      allFound = false;
      continue;
    }

    const cost = (prod.stock || 0) * (prod.purchase_price || 0);
    grossTotal += cost;

    const rateMatch = Math.abs((prod.purchase_price || 0) - exp.rate) < 0.001;
    const stockMatch = (prod.stock || 0) === exp.stock;

    console.log(`✓ [${prod.reference_name}] -> Clean Name: "${prod.name}" | Stock: ${prod.stock} (exp: ${exp.stock}) | Purchase: ₹${prod.purchase_price} (exp: ₹${exp.rate}) | Selling: ${prod.selling_price ? '₹' + prod.selling_price : 'PRICE UNAVAILABLE (Pending Admin)'} | Line Total: ₹${cost.toFixed(2)}`);

    if (!rateMatch || !stockMatch) {
      console.error(`  ⚠️ Rate or stock mismatch for ${exp.ref}`);
      allFound = false;
    }
  }

  const roundedGross = Math.round(grossTotal * 100) / 100;
  const netTotal = Math.round((roundedGross + 0.12) * 100) / 100;

  console.log('\n--- PACKING SLIP RECONCILIATION ---');
  console.log(`Calculated Gross Procurement Amount: ₹${roundedGross.toFixed(2)} (Expected: ₹1,914.38)`);
  console.log(`Adjusted Rounding Diff:               ₹0.12`);
  console.log(`Calculated Net Amount:                ₹${netTotal.toFixed(2)} (Expected: ₹1,914.50)`);

  const grossMatches = Math.abs(roundedGross - 1914.38) < 0.01;
  const netMatches = Math.abs(netTotal - 1914.50) < 0.01;

  if (allFound && grossMatches && netMatches) {
    console.log('\n🎉 ALL INITIAL PRODUCT MASTER REQUIREMENTS & INVENTORY AUDITS PASSED PERFECTLY!');
  } else {
    console.error('\n❌ Verification failed.');
    process.exit(1);
  }
}

verifyInitialMaster().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
