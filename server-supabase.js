/**
 * Honesty Store - Server-Side Supabase & PostgreSQL Data Layer
 * Handles authoritative database operations: products, orders, inventory, metrics, and profiles.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}
const FALLBACK_DB_FILE = path.join(DATA_DIR, 'db-fallback.json');

// Initial Product Master (from packing slip: Gross ₹1,914.38, Net ₹1,914.50)
const DEFAULT_PRODUCTS = [
  {
    id: 'lays',
    name: 'Lays',
    reference_name: 'LAYS RS 5',
    variant: 'Classic Potato Chips (₹5)',
    category: 'Chips',
    price: 5.00,
    purchase_price: 4.38,
    selling_price: 5.00,
    stock: 110,
    expected_stock: 110,
    physical_stock: 110,
    low_stock_threshold: 10,
    image_url: 'assets/lays.jpg',
    is_active: true,
    is_available: true,
    description: 'Classic salted crispy potato chips. Reference: LAYS RS 5 @ ₹4.38'
  },
  {
    id: 'dailee_mango',
    name: 'Dailee Mango',
    reference_name: 'DAILEE [MANGO 12]',
    variant: 'Mango Drink (12 Pack)',
    category: 'Drinks',
    price: 10.00,
    purchase_price: 7.00,
    selling_price: 10.00,
    stock: 22,
    expected_stock: 22,
    physical_stock: 22,
    low_stock_threshold: 5,
    image_url: 'assets/dailee_mango.jpg',
    is_active: true,
    is_available: true,
    description: 'Refreshing mango fruit juice drink. Reference: DAILEE [MANGO 12] @ ₹7.00'
  },
  {
    id: 'oreo',
    name: 'Oreo',
    reference_name: 'OREO RS 10',
    variant: 'Vanilla Creme Cookies (₹10)',
    category: 'Biscuits',
    price: 10.00,
    purchase_price: 8.86,
    selling_price: 10.00,
    stock: 44,
    expected_stock: 44,
    physical_stock: 44,
    low_stock_threshold: 8,
    image_url: 'assets/oreo.jpg',
    is_active: true,
    is_available: true,
    description: 'Rich chocolate cookies with sweet vanilla creme. Reference: OREO RS 10 @ ₹8.86'
  },
  {
    id: 'munch',
    name: 'Munch',
    reference_name: 'MUNCH RS 10 [BOX]',
    variant: 'Chocolate Coated Wafer Box',
    category: 'Chocolates',
    price: 209.00,
    purchase_price: 209.00,
    selling_price: null, // Requires Admin Input
    stock: 1,
    expected_stock: 1,
    physical_stock: 1,
    low_stock_threshold: 1,
    image_url: 'assets/munch.jpg',
    is_active: true,
    is_available: true,
    description: 'Crispy chocolate wafer box. Reference: MUNCH RS 10 [BOX] @ ₹209.00. Selling price requires admin input.'
  },
  {
    id: 'snickers',
    name: 'Snickers',
    reference_name: 'SNICKERS [10] 40PES',
    variant: 'Peanut & Caramel (₹10)',
    category: 'Chocolates',
    price: 10.00,
    purchase_price: 7.88,
    selling_price: 10.00,
    stock: 58,
    expected_stock: 58,
    physical_stock: 58,
    low_stock_threshold: 10,
    image_url: 'assets/snickers.jpg',
    is_active: true,
    is_available: true,
    description: 'Milk chocolate bar with roasted peanuts and caramel. Reference: SNICKERS [10] 40PES @ ₹7.88'
  },
  {
    id: 'bournvita_biscuit',
    name: 'Bournvita Biscuit',
    reference_name: 'BOURNVITA BISCUIT [10]',
    variant: 'Malted Chocolate Cookies (₹10)',
    category: 'Biscuits',
    price: 10.00,
    purchase_price: 8.50,
    selling_price: 10.00,
    stock: 9,
    expected_stock: 9,
    physical_stock: 9,
    low_stock_threshold: 4,
    image_url: 'assets/bournvita.jpg',
    is_active: true,
    is_available: true,
    description: 'Wholesome malted chocolate cookies. Reference: BOURNVITA BISCUIT [10] @ ₹8.50'
  },
  {
    id: 'chocos',
    name: 'Chocos',
    reference_name: 'CHOCOS RS 10',
    variant: 'Chocolate Cereal Snack (₹10)',
    category: 'Snacks',
    price: 10.00,
    purchase_price: 8.60,
    selling_price: 10.00,
    stock: 17,
    expected_stock: 17,
    physical_stock: 17,
    low_stock_threshold: 5,
    image_url: 'assets/chocos.jpg',
    is_active: true,
    is_available: true,
    description: 'Crunchy chocolate flavoured snack. Reference: CHOCOS RS 10 @ ₹8.60'
  },
  {
    id: 'upitest',
    name: '₹1 Live UPI Test',
    reference_name: 'GATEWAY VERIFICATION ITEM',
    variant: 'Gateway Verification Item',
    category: 'Chips',
    price: 1.00,
    purchase_price: 1.00,
    selling_price: 1.00,
    stock: 99,
    expected_stock: 99,
    physical_stock: 99,
    low_stock_threshold: 5,
    image_url: 'assets/lays.png',
    is_active: true,
    is_available: true,
    description: 'Live ₹1 gateway testing item.'
  }
];

function resolveProductImage(img, id = '') {
  const s = String(img || '').toLowerCase();
  const idStr = String(id || '').toLowerCase();
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) {
    return img;
  }
  if (s.includes('bournvita') || idStr.includes('bournvita')) return 'assets/bournvita.jpg';
  if (s.includes('chocos') || idStr.includes('chocos')) return 'assets/chocos.jpg';
  if (s.includes('dailee') || idStr.includes('dailee')) return 'assets/dailee_mango.jpg';
  if (s.includes('munch') || idStr.includes('munch')) return 'assets/munch.jpg';
  if (s.includes('snickers') || idStr.includes('snickers')) return 'assets/snickers.jpg';
  if (s.includes('oreo') || idStr.includes('oreo')) return 'assets/oreo.jpg';
  if (s.includes('lays') || s.includes('lay') || idStr.includes('lays')) return 'assets/lays.jpg';
  if (s.includes('dairymilk') || idStr.includes('dairymilk')) return 'assets/dairymilk.png';
  if (s.includes('parleg') || idStr.includes('parleg')) return 'assets/parleg.png';
  return img || 'assets/lays.jpg';
}

function normalizeCategory(cat) {
  if (!cat) return 'Chips';
  const c = String(cat).trim().toLowerCase();
  if (['drinks', 'beverages', 'drink', 'beverage'].includes(c)) return 'Drinks';
  if (['biscuits', 'biscuit'].includes(c)) return 'Biscuits';
  if (['chocolates', 'chocolate'].includes(c)) return 'Chocolates';
  if (['chips', 'chip', 'snacks', 'snack'].includes(c)) return 'Chips';
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

class ServerSupabase {
  constructor() {
    this.fallbackData = this.loadFallback();
    this.seedInitialMaster();
    this.syncAdminUsers().catch(() => {});
  }

  async syncAdminUsers(adminEmails = null) {
    try {
      const emails = adminEmails || (process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase()).filter(Boolean) : []);
      if (emails.length === 0) return;
      for (const email of emails) {
        await this.fetchApi('admin_users', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
          body: { email: email.toLowerCase().trim(), role: 'admin' }
        });
      }
    } catch (e) {
      // Table may not exist yet or offline
    }
  }

  getEnv() {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const anonKey = process.env.SUPABASE_ANON_KEY || '';
    const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
    return {
      url,
      key: serviceRoleKey || anonKey,
      isServiceRole: Boolean(serviceRoleKey && serviceRoleKey.length > 20),
      isConfigured: Boolean(url && (serviceRoleKey || anonKey) && url.includes('supabase.co'))
    };
  }

  loadFallback() {
    let data = null;
    try {
      if (fs.existsSync(FALLBACK_DB_FILE)) {
        data = JSON.parse(fs.readFileSync(FALLBACK_DB_FILE, 'utf-8'));
      }
    } catch (e) {}
    if (!data) {
      data = {
        products: DEFAULT_PRODUCTS,
        orders: [],
        profiles: [],
        stock_audits: [],
        store_visits: [],
        community_metrics: { sales_today: 0, store_visits: 0, completed_payments: 0 }
      };
    }
    if (!Array.isArray(data.deleted_product_ids)) {
      data.deleted_product_ids = [];
    }
    if (!Array.isArray(data.store_visits)) {
      data.store_visits = [];
    }
    return data;
  }

  saveFallback() {
    try {
      fs.writeFileSync(FALLBACK_DB_FILE, JSON.stringify(this.fallbackData, null, 2));
    } catch (e) {}
  }

  seedInitialMaster() {
    if (!this.fallbackData.products) this.fallbackData.products = [];
    const deletedIds = new Set(this.fallbackData.deleted_product_ids || []);

    // Ensure products from packing slip master exist unless explicitly deleted by admin
    for (const master of DEFAULT_PRODUCTS) {
      if (deletedIds.has(master.id)) continue;

      const idx = this.fallbackData.products.findIndex(p => p.id === master.id);
      if (idx >= 0) {
        const cur = this.fallbackData.products[idx];
        this.fallbackData.products[idx] = {
          ...cur,
          name: cur.name || master.name,
          reference_name: cur.reference_name || master.reference_name,
          purchase_price: cur.purchase_price !== undefined ? cur.purchase_price : master.purchase_price,
          selling_price: cur.selling_price !== undefined ? cur.selling_price : master.selling_price,
          price: cur.price !== undefined ? cur.price : master.price,
          stock: cur.stock !== undefined ? cur.stock : master.stock,
          expected_stock: cur.expected_stock !== undefined ? cur.expected_stock : master.stock,
          physical_stock: cur.physical_stock !== undefined ? cur.physical_stock : master.stock,
          image_url: cur.image_url || master.image_url,
          is_active: cur.is_active !== undefined ? cur.is_active : true,
          is_available: cur.is_available !== undefined ? cur.is_available : true,
          description: cur.description || master.description
        };
      } else {
        this.fallbackData.products.push({ ...master });
      }
    }
    this.saveFallback();
  }

  async fetchApi(table, options = {}) {
    const { url, key, isConfigured } = this.getEnv();
    if (!isConfigured) {
      throw new Error('Supabase is not configured. Using local isolated data layer.');
    }
    const endpoint = `${url}/rest/v1/${table}${options.query || ''}`;
    const authHeader = options.token ? `Bearer ${options.token}` : (options.headers?.Authorization || `Bearer ${key}`);
    const headers = {
      'apikey': key,
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const res = await fetch(endpoint, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!res.ok) {
      const errText = await res.text();
      const err = new Error(`Supabase [${table}] HTTP ${res.status}: ${errText}`);
      err.status = res.status;
      err.body = errText;
      throw err;
    }

    if (res.status === 204) return null;
    const text = await res.text();
    if (!text || text.trim() === '') return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  async callRpc(functionName, params = {}) {
    const { url, key, isConfigured } = this.getEnv();
    if (!isConfigured) {
      throw new Error('Supabase is not configured. Using local isolated data layer.');
    }
    const endpoint = `${url}/rest/v1/rpc/${functionName}`;
    const headers = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(params)
    });

    if (!res.ok) {
      const errText = await res.text();
      const err = new Error(`Supabase RPC [${functionName}] HTTP ${res.status}: ${errText}`);
      err.status = res.status;
      err.body = errText;
      throw err;
    }

    const text = await res.text();
    if (!text || text.trim() === '') return true;
    try {
      return JSON.parse(text);
    } catch (e) {
      return true;
    }
  }

  // 1. GET ALL PRODUCTS (OPTIONAL ARCHIVED INCLUSION)
  async getProducts(includeArchived = false) {
    const deletedIds = new Set(this.fallbackData.deleted_product_ids || []);
    try {
      const query = includeArchived 
        ? '?select=*&order=name.asc' 
        : '?select=*&is_active=eq.true&order=name.asc';
      const products = await this.fetchApi('products', { query });
      if (products && Array.isArray(products) && products.length > 0) {
        // Remote Supabase is strictly authoritative
        const merged = products
          .filter(remoteP => !deletedIds.has(remoteP.id))
          .map(remoteP => {
            const master = DEFAULT_PRODUCTS.find(d => d.id === remoteP.id);
            const resolvedImg = resolveProductImage(remoteP.image_url || (master && master.image_url), remoteP.id);

            const stockVal = remoteP.stock !== undefined ? Number(remoteP.stock) : (master ? master.stock : 0);
            const expectedStockVal = remoteP.expected_stock !== undefined ? Number(remoteP.expected_stock) : stockVal;
            const physicalStockVal = remoteP.physical_stock !== undefined ? Number(remoteP.physical_stock) : stockVal;
            const sellingPriceVal = (remoteP.selling_price !== undefined && remoteP.selling_price !== null) 
              ? Number(remoteP.selling_price) 
              : (master ? master.selling_price : null);
            const purchasePriceVal = (remoteP.purchase_price !== undefined && remoteP.purchase_price !== null) 
              ? Number(remoteP.purchase_price) 
              : (master ? master.purchase_price : null);
            const priceVal = (remoteP.price !== undefined && remoteP.price !== null) 
              ? Number(remoteP.price) 
              : (master ? master.price : 10);
            const isActiveVal = remoteP.is_active !== undefined ? Boolean(remoteP.is_active) : (master ? master.is_active : true);
            const isAvailableVal = remoteP.is_available !== undefined ? Boolean(remoteP.is_available) : (master ? master.is_available : true);

            return {
              ...(master || {}),
              ...remoteP,
              id: remoteP.id,
              name: remoteP.name || (master ? master.name : ''),
              reference_name: remoteP.reference_name || (master ? master.reference_name : null),
              variant: remoteP.variant || (master ? master.variant : ''),
              category: normalizeCategory(remoteP.category || (master ? master.category : 'Chips')),
              description: remoteP.description || (master ? master.description : ''),
              price: priceVal,
              purchase_price: purchasePriceVal,
              selling_price: sellingPriceVal,
              stock: stockVal,
              expected_stock: expectedStockVal,
              physical_stock: physicalStockVal,
              is_active: isActiveVal,
              is_available: isAvailableVal,
              image_url: resolvedImg,
              low_stock_threshold: remoteP.low_stock_threshold || (master ? master.low_stock_threshold : 5)
            };
          });

        // Mirror authoritative Supabase data to local fallback cache
        this.fallbackData.products = merged;
        this.saveFallback();
        return includeArchived ? merged : merged.filter(p => p.is_active !== false);
      }
    } catch (err) {
      console.warn('[ServerSupabase] getProducts fallback to local cache:', err.message);
    }
    const fallbackList = (this.fallbackData.products || DEFAULT_PRODUCTS).filter(p => !deletedIds.has(p.id));
    return includeArchived ? fallbackList : fallbackList.filter(p => p.is_active !== false);
  }

  // 2. GET SINGLE PRODUCT
  async getProduct(productId) {
    if ((this.fallbackData.deleted_product_ids || []).includes(productId)) {
      return null;
    }
    try {
      const res = await this.fetchApi('products', {
        query: `?id=eq.${productId}&select=*`
      });
      if (res && res.length > 0) {
        const remoteP = res[0];
        const master = DEFAULT_PRODUCTS.find(d => d.id === remoteP.id);
        const resolvedImg = resolveProductImage(
          remoteP.image_url || (master && master.image_url),
          remoteP.id
        );
        const catVal = normalizeCategory(remoteP.category || (master ? master.category : 'Chips'));
        return {
          ...(master || {}),
          ...remoteP,
          id: remoteP.id,
          category: catVal,
          image_url: resolvedImg
        };
      }
    } catch (err) {
      console.warn(`[ServerSupabase] getProduct(${productId}) fallback:`, err.message);
    }
    const localMatch = (this.fallbackData.products || []).find(p => p.id === productId);
    return localMatch || null;
  }

  // 2b. ADD NEW PRODUCT (ADMIN)
  async addProduct(productData, userToken = null) {
    const id = productData.id || ('prod_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6));
    const price = Math.max(0.5, Number(productData.price) || 10);
    const sellingPrice = (productData.selling_price !== undefined && productData.selling_price !== null && productData.selling_price !== '') 
      ? Number(productData.selling_price) 
      : ((productData.sellingPrice !== undefined && productData.sellingPrice !== null && productData.sellingPrice !== '') ? Number(productData.sellingPrice) : null);
    const purchasePrice = (productData.purchase_price !== undefined && productData.purchase_price !== null && productData.purchase_price !== '')
      ? Number(productData.purchase_price)
      : ((productData.purchasePrice !== undefined && productData.purchasePrice !== null && productData.purchasePrice !== '') ? Number(productData.purchasePrice) : null);
    const stock = Math.max(0, parseInt(productData.stock, 10) || 0);

    const record = {
      id,
      name: (productData.name || 'Snack Item').trim(),
      reference_name: (productData.reference_name || productData.referenceName || '').trim() || null,
      description: (productData.description || '').trim(),
      variant: (productData.variant || '').trim(),
      category: productData.category || 'Chips',
      price: price,
      purchase_price: purchasePrice,
      selling_price: sellingPrice,
      stock: stock,
      expected_stock: stock,
      physical_stock: stock,
      low_stock_threshold: Math.max(1, parseInt(productData.low_stock_threshold || productData.lowStockThreshold, 10) || 5),
      image_url: productData.image_url || productData.imageUrl || productData.image || 'assets/lays.png',
      storage_path: productData.storage_path || productData.storagePath || null,
      is_active: productData.is_active !== undefined ? Boolean(productData.is_active) : (productData.isActive !== undefined ? Boolean(productData.isActive) : true),
      is_available: productData.is_available !== undefined ? Boolean(productData.is_available) : (productData.isAvailable !== undefined ? Boolean(productData.isAvailable) : true),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Update local fallback
    if (!this.fallbackData.products) this.fallbackData.products = [];
    const idx = this.fallbackData.products.findIndex(p => p.id === id);
    if (idx >= 0) this.fallbackData.products[idx] = record;
    else this.fallbackData.products.push(record);
    this.saveFallback();

    // Persist to Supabase
    try {
      const res = await this.fetchApi('products', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        token: userToken,
        body: record
      });
      console.log(`[ServerSupabase] Product added in Supabase: ${record.name} (${record.id})`);
      return (Array.isArray(res) && res.length > 0) ? res[0] : (res && !Array.isArray(res) ? res : record);
    } catch (err) {
      console.warn(`[ServerSupabase] addProduct remote error:`, err.message);
      // Fallback: If migration has not yet run in Supabase SQL editor, retry with base schema columns
      if (err.message && err.message.includes('Could not find the') && err.message.includes('column')) {
        try {
          const baseRecord = {
            id: record.id,
            name: record.name,
            variant: record.variant,
            category: record.category,
            price: record.price,
            stock: record.stock,
            expected_stock: record.expected_stock,
            physical_stock: record.physical_stock,
            low_stock_threshold: record.low_stock_threshold,
            image_url: record.image_url,
            is_active: record.is_active,
            updated_at: record.updated_at
          };
          const retryRes = await this.fetchApi('products', {
            method: 'POST',
            headers: { 'Prefer': 'return=representation' },
            token: userToken,
            body: baseRecord
          });
          console.log(`[ServerSupabase] Product added with base schema: ${record.name}`);
          return { ...record, ...(Array.isArray(retryRes) && retryRes.length > 0 ? retryRes[0] : {}) };
        } catch (e2) {
          console.warn(`[ServerSupabase] addProduct base schema retry warning:`, e2.message);
        }
      }
      return record;
    }
  }

  // 2c. UPDATE PRODUCT (ADMIN)
  async updateProduct(productId, updates, userToken = null) {
    const existing = await this.getProduct(productId);
    if (!existing) throw new Error(`Product ${productId} not found`);

    const patchPayload = {
      updated_at: new Date().toISOString()
    };

    if (updates.name !== undefined) patchPayload.name = updates.name.trim();
    if (updates.reference_name !== undefined) patchPayload.reference_name = updates.reference_name ? updates.reference_name.trim() : null;
    if (updates.referenceName !== undefined) patchPayload.reference_name = updates.referenceName ? updates.referenceName.trim() : null;
    if (updates.description !== undefined) patchPayload.description = updates.description.trim();
    if (updates.variant !== undefined) patchPayload.variant = updates.variant.trim();
    if (updates.category !== undefined) patchPayload.category = updates.category;
    if (updates.price !== undefined) patchPayload.price = Math.max(0.5, Number(updates.price));
    if (updates.purchase_price !== undefined) patchPayload.purchase_price = (updates.purchase_price !== null && updates.purchase_price !== '') ? Number(updates.purchase_price) : null;
    if (updates.purchasePrice !== undefined) patchPayload.purchase_price = (updates.purchasePrice !== null && updates.purchasePrice !== '') ? Number(updates.purchasePrice) : null;
    if (updates.selling_price !== undefined) patchPayload.selling_price = (updates.selling_price !== null && updates.selling_price !== '') ? Number(updates.selling_price) : null;
    if (updates.sellingPrice !== undefined) patchPayload.selling_price = (updates.sellingPrice !== null && updates.sellingPrice !== '') ? Number(updates.sellingPrice) : null;
    if (updates.stock !== undefined) {
      const st = Math.max(0, parseInt(updates.stock, 10));
      patchPayload.stock = st;
      patchPayload.expected_stock = st;
      patchPayload.physical_stock = st;
    }
    if (updates.low_stock_threshold !== undefined) patchPayload.low_stock_threshold = Number(updates.low_stock_threshold);
    if (updates.lowStockThreshold !== undefined) patchPayload.low_stock_threshold = Number(updates.lowStockThreshold);
    if (updates.image_url !== undefined) patchPayload.image_url = updates.image_url;
    if (updates.imageUrl !== undefined) patchPayload.image_url = updates.imageUrl;
    if (updates.storage_path !== undefined) patchPayload.storage_path = updates.storage_path;
    if (updates.storagePath !== undefined) patchPayload.storage_path = updates.storagePath;
    if (updates.is_active !== undefined) patchPayload.is_active = Boolean(updates.is_active);
    if (updates.isActive !== undefined) patchPayload.is_active = Boolean(updates.isActive);
    if (updates.is_available !== undefined) patchPayload.is_available = Boolean(updates.is_available);
    if (updates.isAvailable !== undefined) patchPayload.is_available = Boolean(updates.isAvailable);

    // Update in fallback
    const idx = (this.fallbackData.products || []).findIndex(p => p.id === productId);
    if (idx >= 0) {
      this.fallbackData.products[idx] = { ...this.fallbackData.products[idx], ...patchPayload };
      this.saveFallback();
    }

    // Persist to Supabase
    try {
      const res = await this.fetchApi('products', {
        method: 'PATCH',
        query: `?id=eq.${productId}`,
        headers: { 'Prefer': 'return=representation' },
        token: userToken,
        body: patchPayload
      });

      if (Array.isArray(res) && res.length === 0) {
        // If 0 rows updated, verify if product exists in Supabase. If not, insert it (upsert)
        console.warn(`[ServerSupabase] PATCH products?id=eq.${productId} returned 0 rows. Attempting upsert.`);
        const upsertRecord = {
          ...existing,
          ...patchPayload,
          id: productId
        };
        const upsertRes = await this.fetchApi('products', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
          token: userToken,
          body: upsertRecord
        });
        if (Array.isArray(upsertRes) && upsertRes.length > 0) {
          console.log(`[ServerSupabase] Product upserted in Supabase: ${productId}`);
          return upsertRes[0];
        }
      }

      console.log(`[ServerSupabase] Product updated in Supabase: ${productId}`);
      return (Array.isArray(res) && res.length > 0) ? res[0] : { ...existing, ...patchPayload };
    } catch (err) {
      console.warn(`[ServerSupabase] updateProduct remote warning:`, err.message);
      if (err.message && err.message.includes('Could not find the') && err.message.includes('column')) {
        try {
          const safePayload = { ...patchPayload };
          delete safePayload.reference_name;
          delete safePayload.purchase_price;
          delete safePayload.selling_price;
          delete safePayload.is_available;
          delete safePayload.description;
          delete safePayload.storage_path;
          delete safePayload.created_at;
          const retryRes = await this.fetchApi('products', {
            method: 'PATCH',
            query: `?id=eq.${productId}`,
            headers: { 'Prefer': 'return=representation' },
            token: userToken,
            body: safePayload
          });
          console.log(`[ServerSupabase] Product updated with base columns: ${productId}`);
          return { ...existing, ...patchPayload, ...(Array.isArray(retryRes) && retryRes.length > 0 ? retryRes[0] : {}) };
        } catch (e2) {}
      }
      return { ...existing, ...patchPayload };
    }
  }

  // 2d. ARCHIVE / TOGGLE AVAILABILITY (ADMIN)
  async archiveProduct(productId, isActive = false, userToken = null) {
    return await this.updateProduct(productId, { is_active: Boolean(isActive) }, userToken);
  }

  // 2e. CHECK IF PRODUCT CAN BE SAFELY DELETED
  async canDeleteProduct(productId) {
    try {
      // Check RPC function
      const canDel = await this.callRpc('can_delete_product', { p_product_id: productId });
      if (typeof canDel === 'boolean') return canDel;
    } catch (e) {}

    // Fallback: check orders table
    try {
      const orders = await this.fetchApi('orders', { query: `?select=items` });
      if (Array.isArray(orders)) {
        for (const o of orders) {
          const items = Array.isArray(o.items) ? o.items : [];
          if (items.some(i => i.id === productId)) return false;
        }
      }
    } catch (e) {}

    return true;
  }

  // 2f. PERMANENTLY DELETE PRODUCT (ADMIN)
  async deleteProduct(productId, userToken = null) {
    const existing = await this.getProduct(productId);
    if (!existing) throw new Error(`Product ${productId} not found`);

    const isSafe = await this.canDeleteProduct(productId);
    if (!isSafe) {
      throw new Error(`Cannot permanently delete "${existing.name}" because it is referenced in past orders. Please Archive this product instead to safely hide it from the catalog.`);
    }

    // Safely remove storage image if exists
    if (existing.storage_path) {
      await this.deleteStorageImage(existing.storage_path);
    }

    // Track permanently deleted product ID so it is never re-seeded or resurrected
    if (!Array.isArray(this.fallbackData.deleted_product_ids)) {
      this.fallbackData.deleted_product_ids = [];
    }
    if (!this.fallbackData.deleted_product_ids.includes(productId)) {
      this.fallbackData.deleted_product_ids.push(productId);
    }

    // Remove from local fallback
    this.fallbackData.products = (this.fallbackData.products || []).filter(p => p.id !== productId);
    this.saveFallback();

    // Delete in Supabase
    try {
      await this.fetchApi('products', {
        method: 'DELETE',
        query: `?id=eq.${productId}`,
        token: userToken
      });
      console.log(`[ServerSupabase] Product deleted permanently: ${productId}`);
    } catch (err) {
      console.warn(`[ServerSupabase] deleteProduct remote error:`, err.message);
    }

    return { success: true, id: productId };
  }

  // 2g. SUPABASE STORAGE: UPLOAD PRODUCT IMAGE
  async uploadStorageImage(buffer, fileName, contentType = 'image/jpeg') {
    const { url, key } = this.getEnv();
    const endpoint = `${url}/storage/v1/object/product-images/${fileName}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': contentType,
        'x-upsert': 'true'
      },
      body: buffer
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase Storage upload HTTP ${res.status}: ${errText}`);
    }

    const publicUrl = `${url}/storage/v1/object/public/product-images/${fileName}`;
    return {
      publicUrl,
      storagePath: fileName
    };
  }

  // 2h. SUPABASE STORAGE: DELETE PRODUCT IMAGE
  async deleteStorageImage(storagePath) {
    if (!storagePath) return;
    const { url, key } = this.getEnv();
    const cleanPath = storagePath.replace(/^product-images\//, '');
    const endpoint = `${url}/storage/v1/object/product-images`;

    try {
      await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prefixes: [cleanPath] })
      });
      console.log(`[ServerSupabase] Deleted storage object: ${cleanPath}`);
    } catch (e) {
      console.warn(`[ServerSupabase] Could not delete storage image:`, e.message);
    }
  }

  // 3. CREATE ORDER (PENDING)
  async createOrder(orderData) {
    const rawId = orderData.id || orderData.orderId || ('order_' + Date.now());
    const safeSeq = String(rawId).replace(/\D/g, '').slice(-6) || Math.floor(100000 + Math.random() * 900000);
    const orderNumber = orderData.orderNumber || orderData.order_number || `HS-${safeSeq}`;

    // Normalize and enrich items with immutable snapshot
    const rawItems = Array.isArray(orderData.items) ? orderData.items : [];
    const itemsSnapshot = [];
    let computedSubtotal = 0;

    for (const item of rawItems) {
      const qty = Math.max(1, Number(item.qty || item.quantity) || 1);
      const unitPrice = Number(item.unit_price !== undefined ? item.unit_price : (item.price !== undefined ? item.price : 10));
      const itemTotal = Number(item.item_total !== undefined ? item.item_total : (unitPrice * qty));
      computedSubtotal += itemTotal;

      let cat = item.category || item.product_category_snapshot || 'Chips';
      if (['drinks', 'beverages', 'drink', 'beverage'].includes(cat.toLowerCase())) cat = 'Drinks';
      else if (['biscuits', 'biscuit'].includes(cat.toLowerCase())) cat = 'Biscuits';
      else if (['chocolates', 'chocolate'].includes(cat.toLowerCase())) cat = 'Chocolates';

      itemsSnapshot.push({
        id: item.id || item.product_id,
        product_id: item.id || item.product_id,
        name: item.name || item.product_name_snapshot || 'Item',
        product_name_snapshot: item.name || item.product_name_snapshot || 'Item',
        variant: item.variant || '',
        category: cat,
        product_category_snapshot: cat,
        unit_price: unitPrice,
        price: unitPrice,
        qty: qty,
        quantity: qty,
        item_total: itemTotal,
        image: item.image || item.image_url || null
      });
    }

    const subtotal = Number(orderData.subtotal !== undefined ? orderData.subtotal : (computedSubtotal || orderData.amount || 0));
    const discount = Number(orderData.discount || 0);
    const totalAmount = Number(orderData.total_amount !== undefined ? orderData.total_amount : (orderData.amount || subtotal - discount));

    let custEmail = orderData.customerEmail || orderData.customer_email || null;
    if (custEmail) custEmail = String(custEmail).trim().toLowerCase();

    let custName = orderData.customerName || orderData.customer_name || '';
    const custPhone = orderData.customerPhone || orderData.customer_phone || '';
    const cleanPh = custPhone ? String(custPhone).replace(/\D/g, '').slice(-10) : '';

    if (!custName || custName.toLowerCase().includes('honesty') || custName.toLowerCase().includes('shopper')) {
      if (custEmail) {
        custName = custEmail.split('@')[0];
      } else if (cleanPh) {
        custName = `Customer ${cleanPh}`;
      } else {
        custName = 'Customer';
      }
    }

    const customerIdentifier = orderData.customerIdentifier || orderData.customer_identifier || (custName ? (cleanPh ? `${custName} (+91 ${cleanPh})` : custName) : (cleanPh || custEmail || 'Guest'));

    const candidateUserId = orderData.userId || orderData.user_id || null;
    const isCandidateValidUuid = typeof candidateUserId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidateUserId);
    const resolvedUserId = isCandidateValidUuid ? candidateUserId : null;

    const record = {
      id: rawId,
      order_number: orderNumber,
      user_id: resolvedUserId,
      customer_email: custEmail,
      customer_name: custName,
      customer_phone: cleanPh || null,
      customer_identifier: customerIdentifier,
      subtotal: subtotal,
      discount: discount,
      total_amount: totalAmount,
      amount: totalAmount,
      item_count: itemsSnapshot.reduce((acc, i) => acc + i.quantity, 0) || Number(orderData.itemCount || 1),
      items: itemsSnapshot,
      status: orderData.status || 'PENDING',
      payment_status: orderData.paymentStatus || orderData.payment_status || 'PENDING',
      order_status: orderData.orderStatus || orderData.order_status || orderData.status || 'PENDING',
      payment_method: orderData.paymentMethod || orderData.payment_method || 'UPI',
      payment_gateway: orderData.paymentGateway || orderData.payment_gateway || 'Cashfree',
      payment_reference: orderData.paymentReference || orderData.payment_reference || orderData.cashfreePaymentId || rawId,
      cashfree_order_id: orderData.cashfreeOrderId || orderData.cashfree_order_id || null,
      cashfree_payment_id: orderData.cashfreePaymentId || orderData.cashfree_payment_id || null,
      time_label: orderData.timeLabel || 'TODAY',
      created_at: orderData.createdAt || orderData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Save locally first for guaranteed resilience
    const existingIdx = (this.fallbackData.orders || []).findIndex(o => o.id === record.id);
    if (existingIdx >= 0) {
      this.fallbackData.orders[existingIdx] = record;
    } else {
      this.fallbackData.orders.unshift(record);
    }

    // Also persist order_items in fallback
    if (!this.fallbackData.order_items) this.fallbackData.order_items = [];
    const crypto = require('crypto');
    const orderItemRecords = itemsSnapshot.map(item => ({
      id: crypto.randomUUID(),
      order_id: record.id,
      product_id: item.product_id,
      product_name_snapshot: item.product_name_snapshot,
      product_category_snapshot: item.product_category_snapshot,
      unit_price: item.unit_price,
      quantity: item.quantity,
      item_total: item.item_total,
      created_at: record.created_at
    }));

    this.fallbackData.order_items = [
      ...orderItemRecords,
      ...this.fallbackData.order_items.filter(oi => oi.order_id !== record.id)
    ];
    this.saveFallback();

    // Persist to Supabase orders table
    try {
      await this.fetchApi('orders', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
        body: record
      });
      console.log(`[ServerSupabase] Order ${record.id} (${record.order_number}) created in Supabase (Status: ${record.status}, User: ${record.user_id || 'guest'})`);
    } catch (err) {
      console.warn(`[ServerSupabase] createOrder(${record.id}) remote warning:`, err.message);
      if (err.message && err.message.includes('Could not find the') && err.message.includes('column')) {
        // Fallback to base columns if migrations not yet applied on Supabase
        try {
          const baseRecord = {
            id: record.id,
            user_id: record.user_id,
            customer_email: record.customer_email,
            customer_name: record.customer_name,
            customer_phone: record.customer_phone,
            amount: record.amount,
            item_count: record.item_count,
            items: record.items,
            status: record.status,
            payment_method: record.payment_method,
            time_label: record.time_label,
            created_at: record.created_at,
            updated_at: record.updated_at
          };
          await this.fetchApi('orders', {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates' },
            body: baseRecord
          });
          console.log(`[ServerSupabase] Order ${record.id} created with base schema in Supabase.`);
        } catch (e2) {}
      }
    }

    // Persist to Supabase order_items table
    if (orderItemRecords.length > 0) {
      try {
        await this.fetchApi('order_items', {
          method: 'POST',
          body: orderItemRecords
        });
      } catch (err) {
        // Ignored if table not yet migrated on remote
      }
    }

    return record;
  }

  // 4. VERIFY & CONFIRM ORDER PAYMENT (ATOMIC INVENTORY & METRICS UPDATE)
  async confirmOrderPayment(orderId, cfPaymentId, cfOrderId, paymentMeta = {}) {
    let order = (this.fallbackData.orders || []).find(o => o.id === orderId);

    // Try fetching from Supabase
    try {
      const remoteOrders = await this.fetchApi('orders', { query: `?id=eq.${orderId}&select=*` });
      if (remoteOrders && remoteOrders.length > 0) {
        const rem = remoteOrders[0];
        order = {
          ...(order || {}),
          ...rem,
          customer_phone: rem.customer_phone || (order ? order.customer_phone : null),
          customer_name: rem.customer_name || (order ? order.customer_name : null),
          customer_email: rem.customer_email || (order ? order.customer_email : null),
          order_number: rem.order_number || (order ? order.order_number : null),
          items: (Array.isArray(rem.items) && rem.items.length > 0 && rem.items[0].product_name_snapshot) 
            ? rem.items 
            : (order && Array.isArray(order.items) ? order.items : (rem.items || []))
        };
      }
    } catch (e) {}

    if (!order) {
      throw new Error(`Order ${orderId} not found in database`);
    }

    // Capture payment details & payer name from payment for easy tracking
    if (paymentMeta) {
      const payerCandidate = paymentMeta.payerInfo || paymentMeta.customerDetails?.customer_name;
      const emailCandidate = paymentMeta.customerDetails?.customer_email;

      if (payerCandidate && typeof payerCandidate === 'string' && payerCandidate.trim()) {
        let cleanPayer = payerCandidate.trim();
        if (!cleanPayer.toLowerCase().includes('honesty') && !cleanPayer.toLowerCase().includes('shopper')) {
          if (!order.customer_name || order.customer_name.toLowerCase().includes('honesty') || order.customer_name.startsWith('Customer ') || cleanPayer.length > 2) {
            if (cleanPayer.includes('@')) {
              const vpaHandle = cleanPayer.split('@')[0];
              order.customer_name = `${vpaHandle} (${cleanPayer})`;
            } else {
              order.customer_name = cleanPayer;
            }
          }
        }
      }

      if (emailCandidate && !order.customer_email) {
        order.customer_email = emailCandidate.toLowerCase().trim();
      }

      if (paymentMeta.paymentMethod) {
        order.payment_method = String(paymentMeta.paymentMethod).toUpperCase();
      }
    }

    // Sanitize customer_name: NEVER leave "Honesty Customer" or "Honesty Shopper"
    if (!order.customer_name || order.customer_name.toLowerCase().includes('honesty') || order.customer_name.toLowerCase().includes('shopper')) {
      if (order.customer_email) {
        order.customer_name = order.customer_email.split('@')[0];
      } else if (order.customer_phone) {
        order.customer_name = `Customer ${order.customer_phone}`;
      } else {
        order.customer_name = 'Customer';
      }
    }

    const cleanPh = order.customer_phone ? String(order.customer_phone).replace(/\D/g, '').slice(-10) : '';
    order.customer_identifier = order.customer_name + (cleanPh ? ` (+91 ${cleanPh})` : '');

    // Idempotency: If already marked Paid, don't double-deduct inventory
    if (order.status === 'PAID' || order.payment_status === 'PAID') {
      console.log(`[ServerSupabase] Order ${orderId} is already confirmed as PAID.`);
      return { order, alreadyPaid: true };
    }

    const verifiedAt = new Date().toISOString();
    order.status = 'PAID';
    order.order_status = 'COMPLETED';
    order.payment_status = 'PAID';
    order.payment_reference = cfPaymentId || cfOrderId || order.payment_reference || orderId;
    order.cashfree_payment_id = cfPaymentId || order.cashfree_payment_id;
    order.cashfree_order_id = cfOrderId || order.cashfree_order_id;
    order.verified_at = verifiedAt;
    order.updated_at = verifiedAt;

    // Update in fallback
    const idx = (this.fallbackData.orders || []).findIndex(o => o.id === orderId);
    if (idx >= 0) this.fallbackData.orders[idx] = order;
    this.saveFallback();

    // 1. Update Order in Supabase
    try {
      await this.fetchApi('orders', {
        method: 'PATCH',
        query: `?id=eq.${orderId}`,
        body: {
          status: 'PAID',
          order_status: 'COMPLETED',
          payment_status: 'PAID',
          customer_name: order.customer_name,
          customer_email: order.customer_email,
          customer_identifier: order.customer_identifier,
          payment_reference: order.payment_reference,
          cashfree_payment_id: cfPaymentId,
          cashfree_order_id: cfOrderId,
          verified_at: verifiedAt,
          paid_at: verifiedAt,
          updated_at: verifiedAt
        }
      });
      console.log(`[ServerSupabase] Order ${orderId} marked as PAID/COMPLETED in Supabase (Customer: ${order.customer_name}).`);
    } catch (e) {
      console.warn(`[ServerSupabase] Could not update order ${orderId} in Supabase:`, e.message);
      if (e.message && e.message.includes('Could not find the') && e.message.includes('column')) {
        try {
          await this.fetchApi('orders', {
            method: 'PATCH',
            query: `?id=eq.${orderId}`,
            body: {
              status: 'PAID',
              customer_name: order.customer_name,
              customer_email: order.customer_email,
              updated_at: verifiedAt
            }
          });
          console.log(`[ServerSupabase] Order ${orderId} marked as PAID with base schema in Supabase.`);
        } catch (e2) {}
      }
    }

    // 2. Atomically Deduct Inventory in Supabase using PostgreSQL RPC (Row-locked)
    const items = Array.isArray(order.items) ? order.items : [];
    let rpcDeducted = false;
    try {
      await this.callRpc('deduct_inventory', {
        p_items: items.map(i => ({ id: i.id, qty: Number(i.qty) || 1 }))
      });
      rpcDeducted = true;
      console.log(`[ServerSupabase] Inventory atomically deducted via deduct_inventory RPC for order ${orderId}`);
    } catch (rpcErr) {
      console.warn('[ServerSupabase] deduct_inventory RPC warning, falling back to direct deduction:', rpcErr.message);
    }

    if (!rpcDeducted) {
      for (const item of items) {
        await this.deductProductStock(item.id, Number(item.qty) || 1);
      }
    }

    // 3. Update Community Metrics in Supabase & Fallback
    await this.incrementCommunitySales(Number(order.amount) || 0);

    // 4. Update Customer Profile
    if (order.customer_phone) {
      await this.recordCustomerOrder(order.customer_phone, Number(order.amount) || 0, order.customer_email, order.customer_name);
    }

    return { order, alreadyPaid: false };
  }

  // 5. ATOMICALLY DEDUCT INVENTORY
  async deductProductStock(productId, qty) {
    // 1. Update in local fallback atomically
    const localProd = (this.fallbackData.products || []).find(p => p.id === productId);
    let newStock = 0;
    if (localProd) {
      localProd.stock = Math.max(0, (localProd.stock || 0) - qty);
      localProd.physical_stock = Math.max(0, (localProd.physical_stock || 0) - qty);
      localProd.expected_stock = localProd.stock;
      newStock = localProd.stock;
      this.saveFallback();
    }

    // 2. Try atomic RPC deduction (row-locked, prevents race conditions)
    try {
      await this.callRpc('deduct_inventory', {
        p_items: [{ id: productId, qty: Number(qty) || 1 }]
      });
      console.log(`[ServerSupabase] Atomically deducted ${qty} units of ${productId} via RPC`);
    } catch (rpcErr) {
      console.warn(`[ServerSupabase] deductProductStock RPC failed for ${productId}:`, rpcErr.message);
      // Do NOT fall back to racy read-then-write. Log and continue.
      // The fallback data has already been updated above.
    }
  }

  // 6. UPDATE COMMUNITY METRICS
  async incrementCommunitySales(amount) {
    if (!this.fallbackData.community_metrics) {
      this.fallbackData.community_metrics = { sales_today: 0, store_visits: 0, completed_payments: 0 };
    }
    this.fallbackData.community_metrics.sales_today += amount;
    this.fallbackData.community_metrics.completed_payments += 1;
    this.saveFallback();

    const todayDate = new Date().toISOString().split('T')[0];
    try {
      // Check if row for today exists
      const existing = await this.fetchApi('community_metrics', { query: `?date=eq.${todayDate}&select=*` });
      if (existing && existing.length > 0) {
        const cur = existing[0];
        await this.fetchApi('community_metrics', {
          method: 'PATCH',
          query: `?date=eq.${todayDate}`,
          body: {
            sales_today: (Number(cur.sales_today) || 0) + amount,
            completed_payments: (Number(cur.completed_payments) || 0) + 1
          }
        });
      } else {
        await this.fetchApi('community_metrics', {
          method: 'POST',
          body: {
            date: todayDate,
            sales_today: amount,
            completed_payments: 1,
            store_visits: 1,
            pledges_count: 0
          }
        });
      }
    } catch (err) {
      console.warn('[ServerSupabase] incrementCommunitySales remote warning:', err.message);
    }
  }

  // 6b. RECORD PERSISTENT STORE VISIT (TOTAL & UNIQUE VISITORS WITH 30-MIN DEBOUNCE)
  async recordVisit(visitorId, sessionId = null) {
    if (!visitorId) return { recorded: false, error: 'visitorId required' };
    const cleanVisitorId = String(visitorId).trim().slice(0, 80);
    const cleanSessionId = sessionId ? String(sessionId).trim().slice(0, 80) : null;
    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Maintain in local fallback with 30-min debounce
    if (!Array.isArray(this.fallbackData.store_visits)) {
      this.fallbackData.store_visits = [];
    }
    const cutoff30m = now.getTime() - 30 * 60 * 1000;
    const lastVisit = this.fallbackData.store_visits
      .filter(v => v.visitor_id === cleanVisitorId)
      .sort((a, b) => new Date(b.visited_at).getTime() - new Date(a.visited_at).getTime())[0];

    let recorded = false;
    if (!lastVisit || new Date(lastVisit.visited_at).getTime() < cutoff30m) {
      this.fallbackData.store_visits.push({
        id: 'v_' + Date.now(),
        visitor_id: cleanVisitorId,
        session_id: cleanSessionId,
        visited_at: nowIso
      });
      if (this.fallbackData.community_metrics) {
        this.fallbackData.community_metrics.store_visits = (this.fallbackData.community_metrics.store_visits || 0) + 1;
      }
      this.saveFallback();
      recorded = true;
    }

    // 2. Persist to Supabase
    try {
      // Try atomic RPC function first
      const rpcResult = await this.callRpc('record_store_visit', {
        p_visitor_id: cleanVisitorId,
        p_session_id: cleanSessionId
      });
      if (rpcResult && typeof rpcResult === 'object') {
        return {
          recorded: Boolean(rpcResult.recorded),
          totalVisits: Number(rpcResult.total_visits) || 0,
          uniqueVisitors: Number(rpcResult.unique_visitors) || 0,
          todayVisits: Number(rpcResult.today_visits) || 0
        };
      }
    } catch (rpcErr) {
      // Fallback: direct table insert
      if (recorded) {
        try {
          await this.fetchApi('store_visits', {
            method: 'POST',
            body: {
              visitor_id: cleanVisitorId,
              session_id: cleanSessionId,
              visited_at: nowIso
            }
          });
        } catch (tableErr) {
          // Table may be migrating, fallbackData preserves visits
        }
      }
    }

    const currentMetrics = await this.getVisitMetrics();
    return {
      recorded,
      ...currentMetrics
    };
  }

  // 6c. GET VISIT METRICS (AGGREGATED FROM SUPABASE & LOCAL FALLBACK)
  async getVisitMetrics() {
    try {
      const rpcMetrics = await this.callRpc('get_visit_metrics');
      if (rpcMetrics && typeof rpcMetrics === 'object') {
        return {
          totalVisits: Number(rpcMetrics.total_visits) || 0,
          uniqueVisitors: Number(rpcMetrics.unique_visitors) || 0,
          todayVisits: Number(rpcMetrics.today_visits) || 0,
          todayUniques: Number(rpcMetrics.today_uniques) || 0
        };
      }
    } catch (e) {}

    try {
      const visits = await this.fetchApi('store_visits', { query: '?select=visitor_id,visited_at&order=visited_at.desc' });
      if (visits && Array.isArray(visits)) {
        const uniqueSet = new Set(visits.map(v => v.visitor_id));
        const todayStr = new Date().toISOString().split('T')[0];
        const todayVisits = visits.filter(v => (v.visited_at || '').startsWith(todayStr));
        const todayUniqueSet = new Set(todayVisits.map(v => v.visitor_id));
        return {
          totalVisits: visits.length,
          uniqueVisitors: uniqueSet.size,
          todayVisits: todayVisits.length,
          todayUniques: todayUniqueSet.size
        };
      }
    } catch (tableErr) {}

    // Fallback to local
    const localVisits = this.fallbackData.store_visits || [];
    const uniqueSet = new Set(localVisits.map(v => v.visitor_id));
    const todayStr = new Date().toISOString().split('T')[0];
    const todayVisits = localVisits.filter(v => (v.visited_at || '').startsWith(todayStr));
    const todayUniqueSet = new Set(todayVisits.map(v => v.visitor_id));
    const commVisits = Math.max(localVisits.length, this.fallbackData.community_metrics?.store_visits || 0);

    return {
      totalVisits: commVisits,
      uniqueVisitors: Math.max(uniqueSet.size, commVisits > 0 ? 1 : 0),
      todayVisits: todayVisits.length,
      todayUniques: todayUniqueSet.size
    };
  }

  // 7. RECORD CUSTOMER VISIT & ORDERS
  async recordCustomerOrder(phone, amount, email = null, fullName = null) {
    const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    const cleanName = fullName ? String(fullName).trim() : null;

    const existing = (this.fallbackData.profiles || []).find(p => p.phone === cleanPhone);
    if (existing) {
      existing.total_orders = (existing.total_orders || 0) + 1;
      existing.total_spent = (existing.total_spent || 0) + amount;
      existing.last_visit = new Date().toISOString();
      if (cleanEmail) existing.email = cleanEmail;
      if (cleanName && (!existing.full_name || existing.full_name.includes('Customer'))) existing.full_name = cleanName;
    } else {
      this.fallbackData.profiles.push({
        phone: cleanPhone,
        email: cleanEmail,
        full_name: cleanName || (cleanEmail ? cleanEmail.split('@')[0] : `Customer ${cleanPhone}`),
        total_orders: 1,
        total_spent: amount,
        last_visit: new Date().toISOString()
      });
    }
    this.saveFallback();

    try {
      const profileBody = {
        phone: cleanPhone,
        total_orders: existing ? (existing.total_orders + 1) : 1,
        total_spent: existing ? (existing.total_spent + amount) : amount
      };
      if (cleanEmail) profileBody.email = cleanEmail;
      if (cleanName) profileBody.full_name = cleanName;

      await this.fetchApi('profiles', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
        body: profileBody
      });
    } catch (err) {
      // Ignored if RLS restricts anon profile upsert
    }
  }

  // 7b. GET CUSTOMER PROFILE BY PHONE
  async getProfile(phone) {
    const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
    try {
      const res = await this.fetchApi('profiles', {
        query: `?phone=eq.${cleanPhone}&select=*`
      });
      if (res && res.length > 0) return res[0];
    } catch (err) {
      // Fallback
    }
    return (this.fallbackData.profiles || []).find(p => p.phone === cleanPhone);
  }

  // 7b-2. GET ALL PROFILES (ADMIN)
  async getProfiles() {
    try {
      const res = await this.fetchApi('profiles', {
        query: '?select=*&order=created_at.desc'
      });
      if (res && Array.isArray(res) && res.length > 0) {
        this.fallbackData.profiles = res;
        this.saveFallback();
        return res;
      }
    } catch (err) {
      console.warn('[ServerSupabase] getProfiles fallback:', err.message);
    }
    return this.fallbackData.profiles || [];
  }

  // 7c. REGISTER USER PROFILE (PHONE + PASSWORD HASH)
  async registerUser(name, phone, passwordHash) {
    const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
    const crypto = require('crypto');
    const profileRecord = {
      id: crypto.randomUUID(),
      phone: cleanPhone,
      full_name: name,
      password_hash: passwordHash,
      trust_score: 100.0,
      total_orders: 0,
      total_spent: 0.0,
      pledge_signed: false,
      created_at: new Date().toISOString()
    };

    if (!this.fallbackData.profiles) this.fallbackData.profiles = [];
    const existingIdx = this.fallbackData.profiles.findIndex(p => p.phone === cleanPhone);
    if (existingIdx >= 0) {
      this.fallbackData.profiles[existingIdx] = { ...this.fallbackData.profiles[existingIdx], ...profileRecord };
    } else {
      this.fallbackData.profiles.push(profileRecord);
    }
    this.saveFallback();

    // Persist to Supabase
    try {
      await this.fetchApi('profiles', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
        body: profileRecord
      });
      console.log(`[ServerSupabase] Profile for +91 ${cleanPhone} saved to Supabase.`);
    } catch (err) {
      console.warn(`[ServerSupabase] registerUser(${cleanPhone}) remote warning:`, err.message);
    }

    return profileRecord;
  }


  // 8. GET ORDERS FOR CUSTOMER OR ADMIN (STRICT ISOLATION)
  async getOrders(filter = {}) {
    // Backwards compatibility if passed as a single string (phone or userId)
    let userId = typeof filter === 'object' && filter !== null ? filter.userId : null;
    let phone = typeof filter === 'object' && filter !== null ? filter.phone : null;
    let email = typeof filter === 'object' && filter !== null ? filter.email : null;
    let isAdmin = typeof filter === 'object' && filter !== null ? Boolean(filter.isAdmin) : false;

    if (typeof filter === 'string') {
      if (filter.length > 20 || filter.includes('-')) {
        userId = filter;
      } else {
        phone = filter;
      }
    }

    if (typeof userId === 'string' && userId.startsWith('cust_') && !phone) {
      phone = userId.replace('cust_', '');
    }

    const isValidUuid = typeof userId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    let cleanPhone = phone ? String(phone).replace(/\D/g, '').slice(-10) : null;
    let cleanEmail = email ? String(email).trim().toLowerCase() : null;

    try {
      let query;
      if (isAdmin) {
        query = '?select=*&order=created_at.desc&limit=200';
      } else if (isValidUuid && cleanPhone) {
        query = `?select=*&or=(user_id.eq.${userId},customer_phone.like.*${cleanPhone})&order=created_at.desc`;
      } else if (isValidUuid) {
        query = `?select=*&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`;
      } else if (cleanPhone && cleanEmail) {
        query = `?select=*&or=(customer_phone.like.*${cleanPhone},customer_email.eq.${encodeURIComponent(cleanEmail)})&order=created_at.desc`;
      } else if (cleanPhone) {
        query = `?select=*&customer_phone.like.*${cleanPhone}&order=created_at.desc`;
      } else if (cleanEmail) {
        query = `?select=*&customer_email.eq.${encodeURIComponent(cleanEmail)}&order=created_at.desc`;
      } else {
        // STRICT SECURITY: Do NOT return all orders to unauthenticated caller!
        return [];
      }

      const remote = await this.fetchApi('orders', { query });
      if (remote && Array.isArray(remote)) {
        const localMap = new Map((this.fallbackData.orders || []).map(o => [o.id, o]));
        return remote.map(rem => {
          const loc = localMap.get(rem.id);
          let custName = rem.customer_name || (loc ? loc.customer_name : null);
          let custEmail = rem.customer_email || (loc ? loc.customer_email : null);
          let custPhone = rem.customer_phone || (loc ? loc.customer_phone : null);

          if (!custName || custName.toLowerCase().includes('honesty') || custName.toLowerCase().includes('shopper')) {
            if (custEmail) {
              custName = custEmail.split('@')[0];
            } else if (custPhone) {
              custName = `Customer ${custPhone}`;
            } else {
              custName = 'Customer';
            }
          }

          return {
            ...(loc || {}),
            ...rem,
            customer_phone: custPhone,
            customer_name: custName,
            customer_email: custEmail,
            order_number: rem.order_number || (loc ? loc.order_number : null),
            payment_status: rem.payment_status || (loc ? loc.payment_status : rem.status),
            order_status: rem.order_status || (loc ? loc.order_status : rem.status),
            items: (Array.isArray(rem.items) && rem.items.length > 0 && rem.items[0].product_name_snapshot) 
              ? rem.items 
              : ((loc && Array.isArray(loc.items)) ? loc.items : (rem.items || []))
          };
        });
      }
    } catch (e) {
      console.warn('[ServerSupabase] getOrders fallback:', e.message);
    }

    let orders = (this.fallbackData.orders || []).map(o => {
      let custName = o.customer_name;
      if (!custName || custName.toLowerCase().includes('honesty') || custName.toLowerCase().includes('shopper')) {
        if (o.customer_email) custName = o.customer_email.split('@')[0];
        else if (o.customer_phone) custName = `Customer ${o.customer_phone}`;
        else custName = 'Customer';
      }
      return { ...o, customer_name: custName };
    });
    if (isAdmin) return orders;
    return orders.filter(o => {
      if (isValidUuid && o.user_id === userId) return true;
      if (cleanPhone && o.customer_phone && o.customer_phone.includes(cleanPhone)) return true;
      if (cleanEmail && o.customer_email && o.customer_email.toLowerCase() === cleanEmail) return true;
      return false;
    });
  }

  // 9. ADJUST STOCK & RECORD AUDIT LOG (ADMIN)
  async adjustStock(productId, newStockLevel, auditNote = '', auditedBy = 'Admin', userToken = null) {
    const prod = await this.getProduct(productId);
    const expected = prod ? (prod.expected_stock !== undefined ? prod.expected_stock : prod.stock) : 0;
    const numStock = Math.max(0, Number(newStockLevel) || 0);
    const discrepancy = numStock - expected;
    const unitPrice = prod ? Number(prod.price) : 0;
    const shrinkageValue = Math.abs(discrepancy) * unitPrice;

    // 1. Update in local fallback
    const localProd = (this.fallbackData.products || []).find(p => p.id === productId);
    if (localProd) {
      localProd.stock = numStock;
      localProd.expected_stock = numStock;
      localProd.physical_stock = numStock;
      this.saveFallback();
    }

    // 2. Update Product in Supabase
    try {
      const res = await this.fetchApi('products', {
        method: 'PATCH',
        query: `?id=eq.${productId}`,
        headers: { 'Prefer': 'return=representation' },
        token: userToken,
        body: {
          stock: numStock,
          expected_stock: numStock,
          physical_stock: numStock,
          updated_at: new Date().toISOString()
        }
      });
      if (Array.isArray(res) && res.length === 0) {
        console.warn(`[ServerSupabase] adjustStock(${productId}) returned 0 rows. Attempting upsert.`);
        const upsertRecord = {
          ...(prod || {}),
          id: productId,
          stock: numStock,
          expected_stock: numStock,
          physical_stock: numStock,
          updated_at: new Date().toISOString()
        };
        await this.fetchApi('products', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
          token: userToken,
          body: upsertRecord
        });
      }
      console.log(`[ServerSupabase] Stock adjusted for ${productId} to ${numStock}`);
    } catch (e) {
      console.warn(`[ServerSupabase] adjustStock(${productId}) product update warning:`, e.message);
    }

    // 3. Insert Audit Log in Supabase
    const auditRecord = {
      product_id: productId,
      expected_units: expected,
      physical_units: numStock,
      discrepancy,
      shrinkage_value: shrinkageValue,
      audit_note: auditNote || 'Manual stock adjustment',
      audited_by: auditedBy,
      created_at: new Date().toISOString()
    };

    if (!this.fallbackData.stock_audits) this.fallbackData.stock_audits = [];
    this.fallbackData.stock_audits.unshift(auditRecord);
    this.saveFallback();

    try {
      await this.fetchApi('stock_audits', {
        method: 'POST',
        token: userToken,
        body: auditRecord
      });
    } catch (e) {
      // Ignored if RLS restricts
    }

    return { product: localProd || prod, audit: auditRecord };
  }

  // 9b. UPDATE PHYSICAL SHELF STOCK (ADMIN)
  async updatePhysicalStock(productId, physicalStock, userToken = null) {
    const numPhysical = Math.max(0, Number(physicalStock) || 0);
    const localProd = (this.fallbackData.products || []).find(p => p.id === productId);
    if (localProd) {
      localProd.physical_stock = numPhysical;
      localProd.updated_at = new Date().toISOString();
      this.saveFallback();
    }
    try {
      await this.fetchApi('products', {
        method: 'PATCH',
        query: `?id=eq.${productId}`,
        token: userToken,
        body: { physical_stock: numPhysical, updated_at: new Date().toISOString() }
      });
    } catch (e) {}
    return { success: true, productId, physicalStock: numPhysical };
  }

  // 10. UPDATE ORDER STATUS (ADMIN - CROSS-DEVICE REALTIME SYNC)
  async updateOrderStatus(orderId, newStatus, userToken = null) {
    const validStatuses = ['PENDING', 'PAID', 'COMPLETED', 'CANCELLED'];
    const statusUpper = String(newStatus || '').toUpperCase().trim();
    if (!validStatuses.includes(statusUpper)) {
      throw new Error(`Invalid order status: "${newStatus}". Must be one of: ${validStatuses.join(', ')}`);
    }

    // Update in local fallback
    const idx = (this.fallbackData.orders || []).findIndex(o => o.id === orderId);
    let currentOrder = null;
    if (idx >= 0) {
      this.fallbackData.orders[idx].status = statusUpper;
      this.fallbackData.orders[idx].updated_at = new Date().toISOString();
      currentOrder = this.fallbackData.orders[idx];
      this.saveFallback();
    }

    // Persist to Supabase
    try {
      const res = await this.fetchApi('orders', {
        method: 'PATCH',
        query: `?id=eq.${orderId}`,
        headers: { 'Prefer': 'return=representation' },
        token: userToken,
        body: {
          status: statusUpper,
          updated_at: new Date().toISOString()
        }
      });
      console.log(`[ServerSupabase] Order ${orderId} status updated to ${statusUpper} in Supabase.`);
      if (Array.isArray(res) && res.length > 0) {
        return res[0];
      }
    } catch (err) {
      console.warn(`[ServerSupabase] updateOrderStatus(${orderId}) remote warning:`, err.message);
      throw err;
    }

    return currentOrder || { id: orderId, status: statusUpper };
  }


  // 11. REAL DASHBOARD METRICS AGGREGATION
  async getDashboardMetrics() {
    const orders = await this.getOrders({ isAdmin: true });
    const paidOrders = orders.filter(o => o.status === 'PAID' || o.status === 'Paid' || o.payment_status === 'PAID');
    const visitMetrics = await this.getVisitMetrics();

    const totalRevenue = paidOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
    const totalOrdersCount = paidOrders.length;

    // Calculate today's metrics
    const todayStr = new Date().toISOString().split('T')[0];
    const todayOrders = paidOrders.filter(o => (o.created_at || '').startsWith(todayStr));
    const salesToday = todayOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
    const todayOrdersCount = todayOrders.length;

    // Total items sold
    let totalItemsSold = 0;
    const productCounts = {};

    paidOrders.forEach(o => {
      const items = Array.isArray(o.items) ? o.items : [];
      items.forEach(item => {
        const qty = Number(item.qty || item.quantity) || 1;
        totalItemsSold += qty;
        productCounts[item.name || item.product_name_snapshot || item.id] = (productCounts[item.name || item.product_name_snapshot || item.id] || 0) + qty;
      });
    });

    // Top selling products sorted
    const topProducts = Object.entries(productCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      salesToday,
      todayOrdersCount,
      totalRevenue,
      totalOrdersCount,
      totalItemsSold,
      completedPayments: totalOrdersCount,
      totalVisits: visitMetrics.totalVisits,
      uniqueVisitors: visitMetrics.uniqueVisitors,
      todayVisits: visitMetrics.todayVisits,
      todayUniques: visitMetrics.todayUniques,
      topProducts,
      recentOrders: paidOrders.slice(0, 10)
    };
  }

  // 12. MARK ORDER AS FAILED
  async markOrderAsFailed(orderId, failureReason = 'Payment Failed', cfPaymentId = null) {
    let order = (this.fallbackData.orders || []).find(o => o.id === orderId);
    if (!order) return null;
    const nowIso = new Date().toISOString();
    order.status = 'FAILED';
    order.order_status = 'FAILED';
    order.payment_status = 'FAILED';
    order.failure_reason = failureReason;
    if (cfPaymentId) order.payment_reference = cfPaymentId;
    order.updated_at = nowIso;
    this.saveFallback();

    try {
      await this.fetchApi('orders', {
        method: 'PATCH',
        query: `?id=eq.${orderId}`,
        body: {
          status: 'FAILED',
          order_status: 'FAILED',
          payment_status: 'FAILED',
          payment_reference: cfPaymentId || order.payment_reference,
          updated_at: nowIso
        }
      });
    } catch (e) {
      if (e.message && e.message.includes('Could not find the') && e.message.includes('column')) {
        try {
          await this.fetchApi('orders', {
            method: 'PATCH',
            query: `?id=eq.${orderId}`,
            body: {
              status: 'FAILED',
              updated_at: nowIso
            }
          });
        } catch (e2) {}
      }
    }
    return order;
  }

  // 13. DYNAMIC CATEGORIES RETRIEVAL
  async getCategories() {
    const defaultCategories = ['Chips', 'Biscuits', 'Chocolates', 'Drinks'];
    try {
      const prods = await this.getProducts(true);
      const dbCategories = (prods || [])
        .map(p => {
          let cat = (p.category || '').trim();
          if (['drinks', 'beverages', 'drink', 'beverage'].includes(cat.toLowerCase())) return 'Drinks';
          if (['biscuits', 'biscuit'].includes(cat.toLowerCase())) return 'Biscuits';
          if (['chocolates', 'chocolate'].includes(cat.toLowerCase())) return 'Chocolates';
          if (['chips', 'chip', 'snacks', 'snack'].includes(cat.toLowerCase())) return 'Chips';
          return cat ? (cat.charAt(0).toUpperCase() + cat.slice(1)) : null;
        })
        .filter(Boolean);

      return Array.from(new Set([...defaultCategories, ...dbCategories]));
    } catch (e) {
      return defaultCategories;
    }
  }

  // 14. AUTHORITATIVE SALES ANALYTICS & REPORTING
  async getSalesAnalytics(options = {}) {
    const {
      period = 'today',
      startDate = null,
      endDate = null,
      status = 'ALL',
      paymentStatus = 'ALL',
      category = 'ALL',
      paymentMethod = 'ALL',
      search = ''
    } = options;

    const allOrders = await this.getOrders({ isAdmin: true });
    const allProducts = await this.getProducts(true);

    // 1. Determine Date Range
    const now = new Date();
    let rangeStart = null;
    let rangeEnd = null;

    if (period === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      rangeStart = new Date(`${todayStr}T00:00:00.000Z`);
      rangeEnd = new Date(`${todayStr}T23:59:59.999Z`);
    } else if (period === 'yesterday') {
      const yDate = new Date(now.getTime() - 24 * 3600 * 1000);
      const yStr = yDate.toISOString().split('T')[0];
      rangeStart = new Date(`${yStr}T00:00:00.000Z`);
      rangeEnd = new Date(`${yStr}T23:59:59.999Z`);
    } else if (period === '7days') {
      rangeStart = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      rangeEnd = now;
    } else if (period === 'month') {
      const monthStartStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
      rangeStart = new Date(`${monthStartStr}T00:00:00.000Z`);
      rangeEnd = now;
    } else if (period === 'custom' && (startDate || endDate)) {
      if (startDate) rangeStart = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) rangeEnd = new Date(`${endDate}T23:59:59.999Z`);
    }

    // 2. Filter orders by date range
    let filteredOrders = allOrders.filter(o => {
      const orderDate = new Date(o.created_at || o.createdAt || Date.now());
      if (rangeStart && orderDate < rangeStart) return false;
      if (rangeEnd && orderDate > rangeEnd) return false;
      return true;
    });

    // 3. Filter by search query
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filteredOrders = filteredOrders.filter(o => {
        const idMatch = (o.id || '').toLowerCase().includes(q) || (o.order_number || '').toLowerCase().includes(q);
        const nameMatch = (o.customer_name || '').toLowerCase().includes(q);
        const emailMatch = (o.customer_email || '').toLowerCase().includes(q);
        const phoneMatch = (o.customer_phone || '').includes(q);
        const itemMatch = (Array.isArray(o.items) ? o.items : []).some(i => (i.name || i.product_name_snapshot || '').toLowerCase().includes(q));
        return idMatch || nameMatch || emailMatch || phoneMatch || itemMatch;
      });
    }

    // 4. Filter by paymentStatus
    if (paymentStatus && paymentStatus !== 'ALL') {
      filteredOrders = filteredOrders.filter(o => {
        const ps = (o.payment_status || (o.status === 'PAID' ? 'PAID' : o.status) || '').toUpperCase();
        return ps === paymentStatus.toUpperCase();
      });
    }

    // 5. Filter by orderStatus
    if (status && status !== 'ALL') {
      filteredOrders = filteredOrders.filter(o => {
        const st = (o.order_status || o.status || '').toUpperCase();
        return st === status.toUpperCase();
      });
    }

    // 6. Filter by paymentMethod
    if (paymentMethod && paymentMethod !== 'ALL') {
      filteredOrders = filteredOrders.filter(o => {
        const pm = (o.payment_method || '').toUpperCase();
        return pm === paymentMethod.toUpperCase();
      });
    }

    // 7. Filter by Category
    if (category && category !== 'ALL') {
      const targetCat = category.toLowerCase();
      filteredOrders = filteredOrders.filter(o => {
        const items = Array.isArray(o.items) ? o.items : [];
        return items.some(i => {
          let ic = (i.category || i.product_category_snapshot || '').toLowerCase();
          if (['drinks', 'beverages', 'drink', 'beverage'].includes(ic)) ic = 'drinks';
          return ic === targetCat;
        });
      });
    }

    // 8. Aggregations (Only confirmed PAID / COMPLETED transactions count toward confirmed revenue)
    let confirmedRevenue = 0;
    let confirmedOrdersCount = 0;
    let totalItemsSold = 0;
    let grossSales = 0;
    let totalDiscounts = 0;
    let successfulPaymentsCount = 0;
    let successfulPaymentsAmount = 0;
    let pendingPaymentsCount = 0;
    let pendingPaymentsAmount = 0;
    let failedPaymentsCount = 0;
    let failedPaymentsAmount = 0;

    const productStats = {};
    const categoryStats = {
      'Chips': { category: 'Chips', itemsSold: 0, revenue: 0 },
      'Biscuits': { category: 'Biscuits', itemsSold: 0, revenue: 0 },
      'Chocolates': { category: 'Chocolates', itemsSold: 0, revenue: 0 },
      'Drinks': { category: 'Drinks', itemsSold: 0, revenue: 0 }
    };

    allProducts.forEach(p => {
      let pCat = p.category || 'Chips';
      if (['drinks', 'beverages', 'drink', 'beverage'].includes(pCat.toLowerCase())) pCat = 'Drinks';
      productStats[p.id] = {
        id: p.id,
        name: p.name,
        category: pCat,
        currentStock: Number(p.stock) || 0,
        unitPrice: Number(p.selling_price || p.price) || 0,
        unitsSold: 0,
        revenue: 0,
        ordersCount: 0
      };
    });

    filteredOrders.forEach(o => {
      const amt = Number(o.total_amount !== undefined ? o.total_amount : o.amount) || 0;
      const sub = Number(o.subtotal !== undefined ? o.subtotal : amt) || amt;
      const disc = Number(o.discount || 0);
      const isPaid = (o.payment_status === 'PAID' || o.status === 'PAID' || o.order_status === 'COMPLETED');
      const isPending = (o.payment_status === 'PENDING' || o.status === 'PENDING');
      const isFailed = (o.payment_status === 'FAILED' || o.status === 'FAILED' || o.status === 'CANCELLED');

      if (isPaid) {
        successfulPaymentsCount += 1;
        successfulPaymentsAmount += amt;
        confirmedRevenue += amt;
        confirmedOrdersCount += 1;
        grossSales += sub;
        totalDiscounts += disc;

        const items = Array.isArray(o.items) ? o.items : [];
        const seenInThisOrder = new Set();

        items.forEach(item => {
          const pid = item.id || item.product_id;
          const qty = Math.max(1, Number(item.qty || item.quantity) || 1);
          const unitPrice = Number(item.unit_price !== undefined ? item.unit_price : (item.price !== undefined ? item.price : 0));
          const lineTotal = Number(item.item_total !== undefined ? item.item_total : (unitPrice * qty));

          totalItemsSold += qty;

          let cat = item.category || item.product_category_snapshot || 'Chips';
          if (['drinks', 'beverages', 'drink', 'beverage'].includes(cat.toLowerCase())) cat = 'Drinks';
          else if (['biscuits', 'biscuit'].includes(cat.toLowerCase())) cat = 'Biscuits';
          else if (['chocolates', 'chocolate'].includes(cat.toLowerCase())) cat = 'Chocolates';

          if (!categoryStats[cat]) {
            categoryStats[cat] = { category: cat, itemsSold: 0, revenue: 0 };
          }
          categoryStats[cat].itemsSold += qty;
          categoryStats[cat].revenue += lineTotal;

          if (!productStats[pid]) {
            productStats[pid] = {
              id: pid,
              name: item.name || item.product_name_snapshot || pid,
              category: cat,
              currentStock: 0,
              unitPrice: unitPrice,
              unitsSold: 0,
              revenue: 0,
              ordersCount: 0
            };
          }
          productStats[pid].unitsSold += qty;
          productStats[pid].revenue += lineTotal;
          if (!seenInThisOrder.has(pid)) {
            seenInThisOrder.add(pid);
            productStats[pid].ordersCount += 1;
          }
        });
      } else if (isPending) {
        pendingPaymentsCount += 1;
        pendingPaymentsAmount += amt;
      } else if (isFailed) {
        failedPaymentsCount += 1;
        failedPaymentsAmount += amt;
      }
    });

    // Category percentage share
    const categoriesArray = Object.values(categoryStats).map(c => ({
      ...c,
      share: confirmedRevenue > 0 ? Number(((c.revenue / confirmedRevenue) * 100).toFixed(1)) : 0
    }));

    // Product breakdown sorted by revenue descending
    const productsArray = Object.values(productStats).sort((a, b) => b.revenue - a.revenue);

    // Payments transaction list
    const paymentsList = filteredOrders.map(o => {
      let cust = o.customer_name;
      if (!cust || cust.toLowerCase().includes('honesty') || cust.toLowerCase().includes('shopper')) {
        if (o.customer_email) cust = o.customer_email.split('@')[0];
        else if (o.customer_phone) cust = `Customer ${o.customer_phone}`;
        else cust = 'Customer';
      }

      return {
        paymentId: o.payment_reference || o.cashfree_payment_id || o.id,
        orderId: o.id,
        orderNumber: o.order_number || ('HS-' + (o.id.replace(/\D/g, '').slice(-6) || '000000')),
        amount: Number(o.total_amount !== undefined ? o.total_amount : o.amount) || 0,
        method: o.payment_method || 'UPI',
        status: o.payment_status || (o.status === 'PAID' ? 'PAID' : o.status) || 'PENDING',
        customer: cust,
        customerEmail: o.customer_email || '',
        customerPhone: o.customer_phone || '',
        timestamp: o.created_at || o.createdAt
      };
    });

    return {
      period,
      startDate: rangeStart ? rangeStart.toISOString() : null,
      endDate: rangeEnd ? rangeEnd.toISOString() : null,
      summary: {
        confirmedRevenue,
        confirmedOrdersCount,
        totalItemsSold,
        grossSales,
        discounts: totalDiscounts,
        netSales: confirmedRevenue,
        successfulPayments: { count: successfulPaymentsCount, amount: successfulPaymentsAmount },
        pendingPayments: { count: pendingPaymentsCount, amount: pendingPaymentsAmount },
        failedPayments: { count: failedPaymentsCount, amount: failedPaymentsAmount }
      },
      products: productsArray,
      categories: categoriesArray,
      orders: filteredOrders,
      payments: paymentsList
    };
  }

  // 15. DAILY END-OF-DAY REPORT
  async getDailyReport(dateStr) {
    const targetDate = dateStr || new Date().toISOString().split('T')[0];
    const analytics = await this.getSalesAnalytics({
      period: 'custom',
      startDate: targetDate,
      endDate: targetDate
    });

    return {
      date: targetDate,
      ...analytics
    };
  }

  // 16. "WHO TOOK WHAT" - PRODUCT PURCHASE TRACEABILITY
  async getProductSalesHistory(productId) {
    const orders = await this.getOrders({ isAdmin: true });
    const product = await this.getProduct(productId);

    const transactions = [];
    let totalUnitsSold = 0;
    let totalRevenue = 0;

    orders.forEach(o => {
      const isPaid = (o.payment_status === 'PAID' || o.status === 'PAID' || o.order_status === 'COMPLETED');
      const items = Array.isArray(o.items) ? o.items : [];
      const matchingItems = items.filter(i => (i.id === productId || i.product_id === productId));

      matchingItems.forEach(item => {
        const qty = Math.max(1, Number(item.qty || item.quantity) || 1);
        const unitPrice = Number(item.unit_price !== undefined ? item.unit_price : (item.price !== undefined ? item.price : (product ? product.price : 10)));
        const itemTotal = Number(item.item_total !== undefined ? item.item_total : (unitPrice * qty));

        if (isPaid) {
          totalUnitsSold += qty;
          totalRevenue += itemTotal;
        }

        transactions.push({
          orderId: o.id,
          orderNumber: o.order_number || ('HS-' + (o.id.replace(/\D/g, '').slice(-6) || '000000')),
          customerName: (o.customer_name && !o.customer_name.toLowerCase().includes('honesty') && !o.customer_name.toLowerCase().includes('shopper'))
            ? o.customer_name
            : (o.customer_email ? o.customer_email.split('@')[0] : (o.customer_phone ? `Customer ${o.customer_phone}` : 'Customer')),
          customerEmail: o.customer_email || '',
          customerPhone: o.customer_phone || '',
          quantity: qty,
          unitPrice,
          itemTotal,
          date: o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Today',
          time: o.created_at ? new Date(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '',
          timestamp: o.created_at,
          paymentMethod: o.payment_method || 'UPI',
          paymentReference: o.payment_reference || o.cashfree_payment_id || o.id,
          paymentStatus: o.payment_status || (o.status === 'PAID' ? 'PAID' : o.status) || 'PENDING',
          orderStatus: o.order_status || o.status || 'PENDING'
        });
      });
    });

    transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
      product: product || { id: productId, name: productId },
      totalUnitsSold,
      totalRevenue,
      transactions
    };
  }
}

module.exports = new ServerSupabase();
