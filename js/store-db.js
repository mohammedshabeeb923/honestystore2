/**
 * Honesty Store - Reactive Data Layer & Supabase State Store
 * Synchronizes state between Customer Mobile App, Supabase PostgreSQL, and Admin Console.
 * STRICT ISOLATION: User orders are private to each authenticated user (auth.uid()).
 */

const UI_STORAGE_KEY = 'honesty_store_client_state_v4';

function resolveProductImage(img, id = '') {
  const s = String(img || '').toLowerCase();
  const idStr = String(id || '').toLowerCase();

  // If already an absolute URL (e.g. Supabase Storage), return as-is
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
window.resolveProductImage = resolveProductImage;

function getAdminHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  let token = localStorage.getItem('honesty_admin_token') || '';
  if (!token && window.authManager && typeof window.authManager.getAccessToken === 'function') {
    token = window.authManager.getAccessToken() || '';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-admin-token'] = token;
  }
  if (window.authManager && typeof window.authManager.getAccessToken === 'function') {
    const sbToken = window.authManager.getAccessToken();
    if (sbToken && !sbToken.startsWith('admin_')) {
      headers['x-supabase-token'] = sbToken;
    }
  }
  return headers;
}
window.getAdminHeaders = getAdminHeaders;

const DEFAULT_PRODUCTS = [
  {
    id: 'lays',
    name: 'Lays',
    referenceName: 'LAYS RS 5',
    variant: 'Classic Potato Chips (₹5)',
    category: 'Chips',
    price: 5,
    purchasePrice: 4.38,
    sellingPrice: 5,
    stock: 110,
    expectedStock: 110,
    physicalStock: 110,
    image: 'assets/lays.jpg',
    imageUrl: 'assets/lays.jpg',
    badge: '',
    lowStockThreshold: 10,
    isActive: true,
    isAvailable: true,
    description: 'Classic salted crispy potato chips. Reference: LAYS RS 5 @ ₹4.38'
  },
  {
    id: 'dailee_mango',
    name: 'Dailee Mango',
    referenceName: 'DAILEE [MANGO 12]',
    variant: 'Mango Drink (12 Pack)',
    category: 'Drinks',
    price: 10,
    purchasePrice: 7.00,
    sellingPrice: 10,
    stock: 22,
    expectedStock: 22,
    physicalStock: 22,
    image: 'assets/dailee_mango.jpg',
    imageUrl: 'assets/dailee_mango.jpg',
    badge: '',
    lowStockThreshold: 5,
    isActive: true,
    isAvailable: true,
    description: 'Refreshing mango fruit juice drink. Reference: DAILEE [MANGO 12] @ ₹7.00'
  },
  {
    id: 'oreo',
    name: 'Oreo',
    referenceName: 'OREO RS 10',
    variant: 'Vanilla Creme Cookies (₹10)',
    category: 'Biscuits',
    price: 10,
    purchasePrice: 8.86,
    sellingPrice: 10,
    stock: 44,
    expectedStock: 44,
    physicalStock: 44,
    image: 'assets/oreo.jpg',
    imageUrl: 'assets/oreo.jpg',
    badge: '',
    lowStockThreshold: 8,
    isActive: true,
    isAvailable: true,
    description: 'Rich chocolate cookies with sweet vanilla creme. Reference: OREO RS 10 @ ₹8.86'
  },
  {
    id: 'munch',
    name: 'Munch',
    referenceName: 'MUNCH RS 10 [BOX]',
    variant: 'Chocolate Coated Wafer Box',
    category: 'Chocolates',
    price: 10,
    purchasePrice: 8.50,
    sellingPrice: 10,
    stock: 25,
    expectedStock: 25,
    physicalStock: 25,
    image: 'assets/munch.jpg',
    imageUrl: 'assets/munch.jpg',
    badge: '',
    lowStockThreshold: 5,
    isActive: true,
    isAvailable: true,
    description: 'Crispy chocolate wafer bar.'
  },
  {
    id: 'snickers',
    name: 'Snickers',
    referenceName: 'SNICKERS [10] 40PES',
    variant: 'Peanut & Caramel (₹10)',
    category: 'Chocolates',
    price: 10,
    purchasePrice: 7.88,
    sellingPrice: 10,
    stock: 58,
    expectedStock: 58,
    physicalStock: 58,
    image: 'assets/snickers.jpg',
    imageUrl: 'assets/snickers.jpg',
    badge: '',
    lowStockThreshold: 10,
    isActive: true,
    isAvailable: true,
    description: 'Milk chocolate bar with roasted peanuts and caramel. Reference: SNICKERS [10] 40PES @ ₹7.88'
  },
  {
    id: 'bournvita_biscuit',
    name: 'Bournvita Biscuit',
    referenceName: 'BOURNVITA BISCUIT [10]',
    variant: 'Malted Chocolate Cookies (₹10)',
    category: 'Biscuits',
    price: 10,
    purchasePrice: 8.50,
    sellingPrice: 10,
    stock: 9,
    expectedStock: 9,
    physicalStock: 9,
    image: 'assets/bournvita.jpg',
    imageUrl: 'assets/bournvita.jpg',
    badge: '',
    lowStockThreshold: 4,
    isActive: true,
    isAvailable: true,
    description: 'Wholesome malted chocolate cookies. Reference: BOURNVITA BISCUIT [10] @ ₹8.50'
  },
  {
    id: 'chocos',
    name: 'Chocos',
    referenceName: 'CHOCOS RS 10',
    variant: 'Chocolate Cereal Snack (₹10)',
    category: 'Snacks',
    price: 10,
    purchasePrice: 8.60,
    sellingPrice: 10,
    stock: 17,
    expectedStock: 17,
    physicalStock: 17,
    image: 'assets/chocos.jpg',
    imageUrl: 'assets/chocos.jpg',
    badge: '',
    lowStockThreshold: 5,
    isActive: true,
    isAvailable: true,
    description: 'Crunchy chocolate flavoured snack. Reference: CHOCOS RS 10 @ ₹8.60'
  },
  {
    id: 'upitest',
    name: '₹1 Live UPI Test',
    referenceName: 'GATEWAY VERIFICATION ITEM',
    variant: 'Gateway Verification Item',
    category: 'Chips',
    price: 1,
    purchasePrice: 1.00,
    sellingPrice: 1,
    stock: 99,
    expectedStock: 99,
    physicalStock: 99,
    image: 'assets/lays.png',
    imageUrl: 'assets/lays.png',
    badge: 'TEST ₹1',
    lowStockThreshold: 5,
    isActive: true,
    isAvailable: true,
    description: 'Live ₹1 gateway testing item.'
  }
];

class StoreDB {
  constructor() {
    this.listeners = [];
    this.userOrders = [];       // Private orders for currently authenticated customer
    this.allAdminOrders = [];   // Store-wide orders for authorized admins only

    // Client transient UI state (cart, active filters)
    this.uiState = this.loadUIState();

    // Cache key for live Supabase products to prevent old mock UI flash
    let cachedProducts = [];
    try {
      const rawCached = localStorage.getItem('honesty_cached_products_v3');
      if (rawCached) {
        cachedProducts = JSON.parse(rawCached);
      }
    } catch (e) {}

    this.isCatalogLoading = cachedProducts.length === 0;
    this.userOrdersLoading = false;
    this.userOrdersError = null;

    this.data = {
      products: cachedProducts.length > 0 ? cachedProducts : [],
      get orders() {
        // Backwards compatibility: returns current user's isolated orders
        return window.storeDB ? window.storeDB.userOrders : [];
      },
      set orders(val) {
        if (window.storeDB) window.storeDB.userOrders = val;
      },
      community: {
        salesToday: 0,
        storeVisits: 0,
        uniqueVisitors: 0,
        completedPayments: 0,
        pledgesCount: 0,
        storeLocation: 'Floor 3, Innovation Hub'
      },
      cart: this.uiState.cart || [],
      activeCategory: this.uiState.activeCategory || 'All',
      selectedAuditProductId: this.uiState.selectedAuditProductId || 'lays'
    };

    // Clean up old legacy shared orders storage if present
    try {
      localStorage.removeItem('honesty_store_v1');
    } catch (e) {}

    this.trackVisit();
    this.syncWithServer();
  }

  loadUIState() {
    try {
      const raw = localStorage.getItem(UI_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          cart: Array.isArray(parsed.cart) ? parsed.cart : [],
          activeCategory: parsed.activeCategory || 'All',
          selectedAuditProductId: parsed.selectedAuditProductId || 'lays'
        };
      }
    } catch (e) {
      console.warn('[StoreDB] Could not load client state:', e);
    }
    return { cart: [], activeCategory: 'All', selectedAuditProductId: 'lays' };
  }

  save() {
    try {
      // Save only transient UI state to localStorage
      const toSave = {
        cart: this.data.cart,
        activeCategory: this.data.activeCategory,
        selectedAuditProductId: this.data.selectedAuditProductId
      };
      localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.error('[StoreDB] Could not save UI state:', e);
    }
    this.notify();
  }

  // ============================================================
  // AUTHORITATIVE SYNCHRONIZATION WITH SUPABASE
  // ============================================================

  async syncWithServer() {
    try {
      // 1. Fetch live products from Supabase
      await this.fetchProductsFromSupabase();

      // 2. Fetch community metrics
      await this.fetchCommunityMetrics();

      // 3. If a customer is logged in, fetch ONLY their private orders
      const isCustomerAuthed = window.authManager && typeof window.authManager.isAuthenticated === 'function' 
        ? window.authManager.isAuthenticated() 
        : false;
      if (isCustomerAuthed) {
        await this.loadUserOrders();
      } else {
        this.userOrders = [];
        this.userOrdersLoading = false;
        this.userOrdersError = null;
      }

      // 4. If admin console is open and user is admin, fetch all admin orders
      if (window.authManager && window.authManager.isAdmin()) {
        await this.loadAdminOrders();
      }

      this.notify();
    } catch (err) {
      console.warn('[StoreDB] Sync with server skipped (offline or booting):', err.message);
    }
  }

  async fetchProductsFromSupabase() {
    try {
      let products = [];
      const isAdminMode = localStorage.getItem('honesty_store_view_mode') === 'admin' || localStorage.getItem('honesty_admin_auth') === 'true' || (window.authManager && window.authManager.isAdmin());

      // If in admin mode, fetch all catalog products (including archived)
      if (isAdminMode) {
        try {
          const res = await fetch('/api/admin/products', { headers: getAdminHeaders() });
          if (res.ok) {
            const body = await res.json();
            if (body.success && Array.isArray(body.products)) {
              products = body.products;
            }
          }
        } catch (e) {}
      }

      if (!products || products.length === 0) {
        if (window.supabaseClient && window.supabaseClient.isConnected) {
          products = await window.supabaseClient.fetchProducts();
        }
      }

      if (!products || products.length === 0) {
        const res = await fetch('/api/products');
        if (res.ok) {
          const body = await res.json();
          if (body.success && Array.isArray(body.products)) {
            products = body.products;
          }
        }
      }

      if (Array.isArray(products) && products.length > 0) {
        this.data.products = products.map(p => {
          const resolvedImg = resolveProductImage(p.image_url || p.imageUrl || p.image, p.id);
          return {
            id: p.id,
            name: p.name,
            referenceName: p.reference_name || p.referenceName || '',
            description: p.description || '',
            variant: p.variant || '',
            category: p.category || 'Chips',
            price: Number(p.price) || 0,
            purchasePrice: (p.purchase_price !== null && p.purchase_price !== undefined) ? Number(p.purchase_price) : (p.purchasePrice !== undefined ? Number(p.purchasePrice) : null),
            sellingPrice: (p.selling_price !== null && p.selling_price !== undefined) ? Number(p.selling_price) : (p.sellingPrice !== undefined ? Number(p.sellingPrice) : null),
            stock: Number(p.stock) || 0,
            expectedStock: Number(p.expected_stock !== undefined ? p.expected_stock : p.stock) || 0,
            physicalStock: Number(p.physical_stock !== undefined ? p.physical_stock : p.stock) || 0,
            image: resolvedImg,
            imageUrl: resolvedImg,
            storagePath: p.storage_path || p.storagePath || null,
            isActive: p.is_active !== undefined ? Boolean(p.is_active) : (p.isActive !== undefined ? Boolean(p.isActive) : true),
            isAvailable: p.is_available !== undefined ? Boolean(p.is_available) : (p.is_active !== undefined ? Boolean(p.is_active) : (p.isActive !== undefined ? Boolean(p.isActive) : true)),
            badge: Number(p.stock) <= 0 ? 'OUT OF STOCK' : (Number(p.stock) <= (p.low_stock_threshold || 5) ? 'LOW STOCK' : ''),
            lowStockThreshold: p.low_stock_threshold || p.lowStockThreshold || 5,
            createdAt: p.created_at || null,
            updatedAt: p.updated_at || null
          };
        });

        this.isCatalogLoading = false;
        try {
          localStorage.setItem('honesty_cached_products_v3', JSON.stringify(this.data.products));
        } catch (e) {}
      }
    } catch (e) {
      console.warn('[StoreDB] Could not sync products:', e);
    }
  }

  async fetchCommunityMetrics() {
    try {
      const metricRes = await fetch('/api/community-metrics');
      if (metricRes.ok) {
        const metricData = await metricRes.json();
        if (metricData.success && metricData.metrics) {
          const m = metricData.metrics;
          this.data.community.salesToday = Number(m.sales_today) || 0;
          this.data.community.storeVisits = Number(m.store_visits) || 0;
          this.data.community.uniqueVisitors = Number(m.unique_visitors) || 0;
          this.data.community.completedPayments = Number(m.completed_payments) || 0;
        }
      }
    } catch (e) {}
  }

  /**
   * Load orders strictly belonging to the authenticated customer from Supabase
   */
  async loadUserOrders() {
    const isCustomerAuthed = window.authManager && typeof window.authManager.isAuthenticated === 'function' 
      ? window.authManager.isAuthenticated() 
      : false;

    if (!isCustomerAuthed) {
      this.userOrders = [];
      this.userOrdersLoading = false;
      this.userOrdersError = null;
      this.notify();
      return;
    }

    this.userOrdersLoading = true;
    this.userOrdersError = null;
    this.notify();

    try {
      let rawOrders = [];
      const token = window.authManager ? window.authManager.getAccessToken() : '';
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      const currentPhone = window.authManager ? window.authManager.getUserPhone() : '';
      const currentEmail = window.authManager ? window.authManager.getUserEmail() : '';
      const params = new URLSearchParams();
      if (currentPhone) params.set('phone', currentPhone);
      if (currentEmail) params.set('email', currentEmail);

      const url = '/api/orders' + (params.toString() ? `?${params.toString()}` : '');
      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to fetch order history`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        rawOrders = data.orders;
        this.userOrders = rawOrders.map(o => this.formatOrder(o));
        this.userOrdersLoading = false;
        this.userOrdersError = null;
      } else {
        throw new Error(data.error || 'Failed to load orders');
      }
    } catch (e) {
      console.error('[StoreDB] Error loading user orders from Supabase:', e);
      this.userOrdersLoading = false;
      this.userOrdersError = e.message || 'Unable to load your history. Please try again.';
    }
    this.notify();
  }

  clearUserOrders() {
    this.userOrders = [];
    this.userOrdersLoading = false;
    this.userOrdersError = null;
    this.notify();
  }

  /**
   * Load all orders for store administrators (Admin console)
   */
  async loadAdminOrders() {
    try {
      let rawOrders = [];
      if (window.supabaseClient && window.supabaseClient.isConnected) {
        rawOrders = await window.supabaseClient.getAllOrders();
      }

      if (!rawOrders || rawOrders.length === 0) {
        const adminToken = localStorage.getItem('honesty_admin_token') || (window.authManager ? window.authManager.getAccessToken() : '');
        const headers = adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {};
        const res = await fetch('/api/admin/orders', { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.orders)) {
            rawOrders = data.orders;
          }
        }
      }

      this.allAdminOrders = (rawOrders || []).map(o => this.formatOrder(o));
      this.notify();
    } catch (e) {
      console.warn('[StoreDB] Could not load admin orders:', e);
    }
  }

  formatOrder(o) {
    const createdAt = o.created_at || new Date().toISOString();
    const paidAt = o.paid_at || o.verified_at || (o.status === 'PAID' ? createdAt : null);

    // Normalize items array
    let items = [];
    if (Array.isArray(o.items)) {
      items = o.items.map(i => ({
        id: i.id || i.product_id,
        name: i.product_name_snapshot || i.name || 'Store Item',
        qty: Number(i.quantity || i.qty) || 1,
        price: Number(i.unit_price || i.price) || 0,
        itemTotal: Number(i.item_total) || ((Number(i.unit_price || i.price) || 0) * (Number(i.quantity || i.qty) || 1))
      }));
    }

    const orderNum = o.order_number || o.id;

    return {
      id: o.id,
      orderNumber: orderNum,
      userId: o.user_id,
      customerEmail: o.customer_email || '',
      customerName: o.customer_name || '',
      customerPhone: o.customer_phone || '',
      timeLabel: o.time_label || new Date(createdAt).toLocaleDateString('en-IN', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      }),
      createdAt,
      paidAt,
      amount: Number(o.amount || o.total_amount) || 0,
      itemCount: Number(o.item_count) || items.reduce((s, i) => s + i.qty, 0) || 1,
      status: String(o.status || o.payment_status || 'PAID').toUpperCase(),
      paymentStatus: String(o.payment_status || o.status || 'PAID').toUpperCase(),
      orderStatus: String(o.order_status || 'COMPLETED').toUpperCase(),
      paymentMethod: o.payment_method || 'Cashfree UPI',
      paymentGateway: o.payment_gateway || 'Cashfree',
      paymentReference: o.payment_reference || o.cashfree_payment_id || o.id,
      items
    };
  }

  // ============================================================
  // REALTIME EVENT HANDLERS
  // ============================================================

  handleRealtimeProductUpdate(payload) {
    if (!payload) return;

    // Handle product deletion
    if (payload.eventType === 'DELETE' && payload.old && payload.old.id) {
      this.data.products = this.data.products.filter(p => p.id !== payload.old.id);
      this.save();
      this.notify();
      return;
    }

    const newProd = payload.new;
    if (!newProd) return;

    const existing = this.getProduct(newProd.id);
    const resolvedImg = resolveProductImage(newProd.image_url || newProd.imageUrl || newProd.image, newProd.id);
    const stockVal = Number(newProd.stock) || 0;
    const priceVal = Number(newProd.price) || 0;
    const sellingPriceVal = (newProd.selling_price !== undefined && newProd.selling_price !== null) ? Number(newProd.selling_price) : null;
    const purchasePriceVal = (newProd.purchase_price !== undefined && newProd.purchase_price !== null) ? Number(newProd.purchase_price) : null;

    if (existing) {
      existing.name = newProd.name || existing.name;
      existing.referenceName = newProd.reference_name || existing.referenceName || '';
      existing.variant = newProd.variant !== undefined ? newProd.variant : existing.variant;
      existing.category = newProd.category || existing.category;
      existing.description = newProd.description !== undefined ? newProd.description : existing.description;
      existing.price = priceVal;
      if (sellingPriceVal !== null) existing.sellingPrice = sellingPriceVal;
      if (purchasePriceVal !== null) existing.purchasePrice = purchasePriceVal;
      existing.stock = stockVal;
      existing.expectedStock = Number(newProd.expected_stock !== undefined ? newProd.expected_stock : stockVal);
      existing.physicalStock = Number(newProd.physical_stock !== undefined ? newProd.physical_stock : stockVal);
      existing.isActive = newProd.is_active !== undefined ? Boolean(newProd.is_active) : existing.isActive;
      existing.isAvailable = newProd.is_available !== undefined ? Boolean(newProd.is_available) : existing.isAvailable;
      existing.image = resolvedImg;
      existing.imageUrl = resolvedImg;
      existing.storagePath = newProd.storage_path || existing.storagePath;
      existing.lowStockThreshold = newProd.low_stock_threshold || existing.lowStockThreshold || 5;
      existing.badge = stockVal <= 0 ? 'OUT OF STOCK' : (stockVal <= existing.lowStockThreshold ? 'LOW STOCK' : '');
    } else {
      this.data.products.push({
        id: newProd.id,
        name: newProd.name,
        referenceName: newProd.reference_name || '',
        variant: newProd.variant || '',
        category: newProd.category || 'Chips',
        description: newProd.description || '',
        price: priceVal,
        sellingPrice: sellingPriceVal,
        purchasePrice: purchasePriceVal,
        stock: stockVal,
        expectedStock: Number(newProd.expected_stock !== undefined ? newProd.expected_stock : stockVal),
        physicalStock: Number(newProd.physical_stock !== undefined ? newProd.physical_stock : stockVal),
        image: resolvedImg,
        imageUrl: resolvedImg,
        storagePath: newProd.storage_path || null,
        isActive: newProd.is_active !== undefined ? Boolean(newProd.is_active) : true,
        isAvailable: newProd.is_available !== undefined ? Boolean(newProd.is_available) : true,
        badge: stockVal <= 0 ? 'OUT OF STOCK' : (stockVal <= (newProd.low_stock_threshold || 5) ? 'LOW STOCK' : ''),
        lowStockThreshold: newProd.low_stock_threshold || 5
      });
    }
    this.notify();
  }

  handleRealtimeOrderUpdate(payload) {
    if (!payload || !payload.new) return;
    const formatted = this.formatOrder(payload.new);

    // 1. If order belongs to current user, update or prepend to customer order history
    const currentUserId = window.authManager ? window.authManager.getUserId() : null;
    if (currentUserId && formatted.userId === currentUserId) {
      const idx = this.userOrders.findIndex(o => o.id === formatted.id);
      if (idx >= 0) {
        this.userOrders[idx] = formatted;
      } else {
        this.userOrders.unshift(formatted);
      }
    }

    // 2. Update or prepend to admin orders list
    const adminIdx = this.allAdminOrders.findIndex(o => o.id === formatted.id);
    if (adminIdx >= 0) {
      this.allAdminOrders[adminIdx] = formatted;
    } else {
      this.allAdminOrders.unshift(formatted);
    }

    // 3. Update Community Metrics in memory
    if (formatted.status === 'PAID' && payload.eventType === 'INSERT') {
      this.data.community.salesToday += formatted.amount;
      this.data.community.completedPayments += 1;
    }

    this.notify();
  }

  // ============================================================
  // OBSERVER PATTERN
  // ============================================================

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notify() {
    this.listeners.forEach(cb => {
      try {
        cb(this.data);
      } catch (err) {
        console.error('[StoreDB] Listener error:', err);
      }
    });
  }

  // ============================================================
  // CATALOG & CART METHODS
  // ============================================================

  getProducts(category = 'All', includeArchived = false) {
    let list = this.data.products || [];
    if (!includeArchived) {
      list = list.filter(p => p.isActive !== false);
    }
    if (!category || category === 'All') return list;
    return list.filter(p => (p.category || '').toLowerCase() === category.toLowerCase());
  }

  getProduct(id) {
    return this.data.products.find(p => p.id === id);
  }

  async addProduct(newProduct) {
    const id = newProduct.id || ('prod_' + Date.now());
    const product = {
      id,
      name: newProduct.name,
      reference_name: newProduct.referenceName || newProduct.reference_name || null,
      description: newProduct.description || '',
      variant: newProduct.variant || '',
      category: newProduct.category || 'Chips',
      price: Number(newProduct.price) || 10,
      purchase_price: (newProduct.purchasePrice !== undefined && newProduct.purchasePrice !== null && newProduct.purchasePrice !== '') ? Number(newProduct.purchasePrice) : ((newProduct.purchase_price !== undefined && newProduct.purchase_price !== null && newProduct.purchase_price !== '') ? Number(newProduct.purchase_price) : null),
      selling_price: (newProduct.sellingPrice !== undefined && newProduct.sellingPrice !== null && newProduct.sellingPrice !== '') ? Number(newProduct.sellingPrice) : ((newProduct.selling_price !== undefined && newProduct.selling_price !== null && newProduct.selling_price !== '') ? Number(newProduct.selling_price) : null),
      stock: Math.max(0, parseInt(newProduct.stock, 10) || 0),
      expected_stock: Math.max(0, parseInt(newProduct.stock, 10) || 0),
      physical_stock: Math.max(0, parseInt(newProduct.stock, 10) || 0),
      image_url: newProduct.image || newProduct.imageUrl || newProduct.image_url || 'assets/lays.jpg',
      storage_path: newProduct.storagePath || newProduct.storage_path || null,
      low_stock_threshold: parseInt(newProduct.lowStockThreshold || newProduct.low_stock_threshold, 10) || 5,
      is_active: newProduct.isActive !== undefined ? Boolean(newProduct.isActive) : true,
      is_available: newProduct.isAvailable !== undefined ? Boolean(newProduct.isAvailable) : true
    };

    // Optimistic local add
    const mapped = {
      ...product,
      image: resolveProductImage(product.image_url, product.id),
      imageUrl: resolveProductImage(product.image_url, product.id),
      isActive: product.is_active,
      isAvailable: product.is_available,
      purchasePrice: product.purchase_price,
      sellingPrice: product.selling_price,
      lowStockThreshold: product.low_stock_threshold,
      expectedStock: product.expected_stock,
      physicalStock: product.physical_stock
    };
    this.data.products.push(mapped);
    this.save();
    this.notify();

    try {
      const res = await fetch('/api/admin/add-product', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify(product)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || 'Failed to add product');
      }
    } catch (e) {
      console.warn('[StoreDB] addProduct network error:', e.message);
    }

    await this.fetchProductsFromSupabase();
    this.notify();
    return this.getProduct(id) || mapped;
  }

  async updateProduct(id, updates) {
    const prod = this.getProduct(id);
    if (prod) {
      // Optimistic in-memory update
      if (updates.name !== undefined) prod.name = updates.name;
      if (updates.variant !== undefined) prod.variant = updates.variant;
      if (updates.category !== undefined) prod.category = updates.category;
      if (updates.description !== undefined) prod.description = updates.description;
      if (updates.price !== undefined) prod.price = Number(updates.price);
      if (updates.purchasePrice !== undefined) prod.purchasePrice = Number(updates.purchasePrice);
      if (updates.purchase_price !== undefined) prod.purchasePrice = Number(updates.purchase_price);
      if (updates.sellingPrice !== undefined) prod.sellingPrice = Number(updates.sellingPrice);
      if (updates.selling_price !== undefined) prod.sellingPrice = Number(updates.selling_price);
      if (updates.stock !== undefined) {
        prod.stock = Math.max(0, parseInt(updates.stock, 10));
        prod.badge = prod.stock <= 0 ? 'OUT OF STOCK' : (prod.stock <= (prod.lowStockThreshold || 5) ? 'LOW STOCK' : '');
      }
      if (updates.expected_stock !== undefined) prod.expectedStock = Number(updates.expected_stock);
      if (updates.expectedStock !== undefined) prod.expectedStock = Number(updates.expectedStock);
      if (updates.physical_stock !== undefined) prod.physicalStock = Number(updates.physical_stock);
      if (updates.physicalStock !== undefined) prod.physicalStock = Number(updates.physicalStock);
      if (updates.lowStockThreshold !== undefined) prod.lowStockThreshold = Number(updates.lowStockThreshold);
      if (updates.low_stock_threshold !== undefined) prod.lowStockThreshold = Number(updates.low_stock_threshold);
      if (updates.isActive !== undefined) prod.isActive = Boolean(updates.isActive);
      if (updates.is_active !== undefined) prod.isActive = Boolean(updates.is_active);
      if (updates.isAvailable !== undefined) prod.isAvailable = Boolean(updates.isAvailable);
      if (updates.is_available !== undefined) prod.isAvailable = Boolean(updates.is_available);
      if (updates.imageUrl || updates.image_url || updates.image) {
        const rawImg = updates.imageUrl || updates.image_url || updates.image;
        prod.image = resolveProductImage(rawImg, id);
        prod.imageUrl = prod.image;
      }
      this.save();
      this.notify();
    }

    try {
      const res = await fetch('/api/admin/update-product', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ id, ...updates })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || 'Failed to update product');
      }
    } catch (e) {
      console.warn('[StoreDB] updateProduct backend error:', e.message);
    }

    await this.fetchProductsFromSupabase();
    this.notify();
    return this.getProduct(id);
  }

  async archiveProduct(id, isActive = false) {
    const prod = this.getProduct(id);
    if (prod) {
      prod.isActive = Boolean(isActive);
      prod.is_active = Boolean(isActive);
      this.save();
      this.notify();
    }

    try {
      const res = await fetch('/api/admin/archive-product', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ id, isActive })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || 'Failed to archive product');
      }
    } catch (e) {
      console.warn('[StoreDB] archiveProduct backend error:', e.message);
    }

    await this.fetchProductsFromSupabase();
    this.notify();
    return this.getProduct(id);
  }

  async canDeleteProduct(id) {
    try {
      const res = await fetch('/api/admin/can-delete-product', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        const result = await res.json();
        return result.canDelete !== false;
      }
    } catch (e) {}
    // Fallback: check orders locally
    const orders = (this.userOrders || []).concat(this.allAdminOrders || []);
    for (const o of orders) {
      if ((o.items || []).some(i => i.id === id)) return false;
    }
    return true;
  }

  async deleteProduct(id) {
    this.data.products = (this.data.products || []).filter(p => p.id !== id);
    this.save();
    this.notify();

    try {
      const res = await fetch('/api/admin/delete-product', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ id })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || 'Failed to delete product');
      }
    } catch (e) {
      console.warn('[StoreDB] deleteProduct backend error:', e.message);
      throw e;
    }

    await this.fetchProductsFromSupabase();
    this.notify();
    return { success: true, id };
  }

  getCart() {
    return this.data.cart || [];
  }

  async quickAddStock(productId, unitsToAdd) {
    const product = this.getProduct(productId);
    if (!product) throw new Error('Product not found');
    const add = parseInt(unitsToAdd, 10) || 0;
    if (add <= 0) return;
    const newStock = Math.max(0, (product.stock || 0) + add);
    const newPhysical = Math.max(0, (product.physicalStock || product.stock || 0) + add);
    const newExpected = Math.max(0, (product.expectedStock || product.stock || 0) + add);

    return await this.updateProduct(productId, {
      stock: newStock,
      physical_stock: newPhysical,
      expected_stock: newExpected
    });
  }

  addToCart(productId) {
    const product = this.getProduct(productId);
    if (!product || product.stock <= 0 || product.isActive === false || product.isAvailable === false) return false;

    // Selling price must be configured and > 0. Procurement rate is never used.
    const unitPrice = (product.sellingPrice !== null && product.sellingPrice !== undefined && Number(product.sellingPrice) > 0)
      ? Number(product.sellingPrice)
      : (product.price && Number(product.price) > 0 ? Number(product.price) : 0);

    if (unitPrice <= 0) {
      console.warn(`[StoreDB] Cannot add ${product.name} to cart: price unavailable`);
      return false;
    }

    let cartItem = this.data.cart.find(item => item.id === productId);
    if (cartItem) {
      if (cartItem.qty < product.stock) {
        cartItem.qty += 1;
      } else {
        return false;
      }
    } else {
      this.data.cart.push({
        id: product.id,
        name: product.name,
        variant: product.variant,
        price: unitPrice,
        originalPrice: product.price,
        image: product.image,
        qty: 1
      });
    }
    this.save();
    return true;
  }

  updateCartQty(productId, delta) {
    const cartItem = this.data.cart.find(item => item.id === productId);
    const product = this.getProduct(productId);
    if (!cartItem) return;

    cartItem.qty += delta;
    if (cartItem.qty <= 0) {
      this.data.cart = this.data.cart.filter(item => item.id !== productId);
    } else if (product && cartItem.qty > product.stock) {
      cartItem.qty = product.stock;
    }
    this.save();
  }

  clearCart() {
    this.data.cart = [];
    this.save();
  }

  getCartTotal() {
    const total = this.data.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const count = this.data.cart.reduce((sum, item) => sum + item.qty, 0);
    return { total, count };
  }

  // ============================================================
  // ORDERS MANAGEMENT
  // ============================================================

  getUserOrders() {
    return this.userOrders;
  }

  getAdminOrders() {
    return this.allAdminOrders;
  }

  async updateOrderStatus(orderId, newStatus) {
    const statusUpper = String(newStatus || '').toUpperCase().trim();

    // Optimistic local update
    const adminIdx = this.allAdminOrders.findIndex(o => o.id === orderId);
    if (adminIdx >= 0) {
      this.allAdminOrders[adminIdx].status = statusUpper;
    }
    const userIdx = this.userOrders.findIndex(o => o.id === orderId);
    if (userIdx >= 0) {
      this.userOrders[userIdx].status = statusUpper;
    }
    this.notify();

    try {
      const res = await fetch('/api/admin/update-order-status', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ orderId, status: statusUpper })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || 'Failed to update order status');
      }
    } catch (e) {
      console.warn('[StoreDB] updateOrderStatus network warning:', e.message);
      if (window.supabaseClient && window.supabaseClient.isConnected) {
        await window.supabaseClient.updateOrderStatus(orderId, statusUpper);
      } else {
        throw e;
      }
    }

    await this.loadAdminOrders();
    this.notify();
  }

  /**
   * Called locally after successful Cashfree payment confirmation
   */
  recordConfirmedOrder(serverOrder) {
    if (!serverOrder) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    const formattedOrder = {
      id: serverOrder.id,
      userId: serverOrder.user_id || (window.authManager ? window.authManager.getUserId() : null),
      customerEmail: serverOrder.customer_email || (window.authManager ? window.authManager.getUserEmail() : ''),
      customerName: serverOrder.customer_name || (window.authManager ? window.authManager.getUserName() : ''),
      timeLabel: `TODAY, ${timeStr.toUpperCase()}`,
      createdAt: serverOrder.created_at || now.toISOString(),
      amount: Number(serverOrder.amount),
      itemCount: Number(serverOrder.item_count || (serverOrder.items ? serverOrder.items.length : 1)),
      status: 'PAID',
      paymentMethod: serverOrder.payment_method || 'Cashfree UPI',
      paymentGateway: 'Cashfree',
      items: serverOrder.items || []
    };

    // Deduct stock in memory immediately
    if (Array.isArray(formattedOrder.items)) {
      formattedOrder.items.forEach(item => {
        const prod = this.getProduct(item.id);
        if (prod) {
          prod.stock = Math.max(0, prod.stock - item.qty);
          prod.expectedStock = prod.stock;
          prod.physicalStock = Math.max(0, prod.physicalStock - item.qty);
          prod.badge = prod.stock === 0 ? 'OUT OF STOCK' : (prod.stock <= prod.lowStockThreshold ? 'LOW STOCK' : '');
        }
      });
    }

    // Add only to the current user's isolated orders
    if (!this.userOrders.some(o => o.id === formattedOrder.id)) {
      this.userOrders.unshift(formattedOrder);
    }

    // Clear user cart
    this.data.cart = [];
    this.save();

    return formattedOrder;
  }

  // ============================================================
  // AUDITS & STOCK RECONCILIATIONS
  // ============================================================

  getSelectedAuditProduct() {
    const id = this.data.selectedAuditProductId || 'lays';
    return this.getProduct(id) || this.data.products[0];
  }

  setSelectedAuditProduct(id) {
    this.data.selectedAuditProductId = id;
    this.save();
  }

  async updatePhysicalStock(productId, physicalCount) {
    const prod = this.getProduct(productId);
    if (!prod) throw new Error('Product not found');
    const numVal = Math.max(0, Number(physicalCount) || 0);

    prod.physicalStock = numVal;
    this.save();
    this.notify();

    try {
      const res = await fetch('/api/admin/update-physical-stock', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ productId, physicalStock: numVal })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || 'Failed to update physical stock');
      }
    } catch (e) {
      console.warn('[StoreDB] updatePhysicalStock backend warning:', e.message);
    }

    await this.fetchProductsFromSupabase();
    this.notify();
    return prod;
  }

  async adjustStock(productId, newStockLevel, auditNote = '') {
    const prod = this.getProduct(productId);
    if (!prod) throw new Error('Product not found');
    const numVal = Math.max(0, Number(newStockLevel) || 0);

    prod.stock = numVal;
    prod.expectedStock = numVal;
    prod.physicalStock = numVal;
    prod.badge = prod.stock === 0 ? 'OUT OF STOCK' : (prod.stock <= prod.lowStockThreshold ? 'LOW STOCK' : '');

    this.save();
    this.notify();

    try {
      const res = await fetch('/api/admin/adjust-stock', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          productId,
          newStockLevel: numVal,
          auditNote,
          auditedBy: window.authManager ? window.authManager.getUserEmail() : 'Admin'
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || 'Failed to adjust stock');
      }
    } catch (e) {
      console.warn('[StoreDB] adjustStock backend warning:', e.message);
    }

    await this.fetchProductsFromSupabase();
    this.notify();
    return prod;
  }

  async trackVisit() {
    try {
      let visitorId = localStorage.getItem('hs_visitor_id');
      if (!visitorId) {
        visitorId = 'v_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        localStorage.setItem('hs_visitor_id', visitorId);
      }

      let sessionId = sessionStorage.getItem('hs_session_id');
      if (!sessionId) {
        sessionId = 's_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        sessionStorage.setItem('hs_session_id', sessionId);
      }

      const lastRecorded = parseInt(sessionStorage.getItem('hs_visit_recorded_at') || '0', 10);
      const now = Date.now();
      if (now - lastRecorded < 30 * 60 * 1000) {
        return; // Debounced for 30 minutes in current session
      }

      sessionStorage.setItem('hs_visit_recorded_at', String(now));

      const res = await fetch('/api/record-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId, sessionId })
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.metrics) {
          this.data.community.storeVisits = Number(data.metrics.totalVisits || data.metrics.total_visits) || this.data.community.storeVisits;
          this.data.community.uniqueVisitors = Number(data.metrics.uniqueVisitors || data.metrics.unique_visitors) || 0;
          this.notify();
        }
      }
    } catch (e) {
      console.warn('[StoreDB] Visit tracking notice:', e.message);
    }
  }

  logVisit() {
    this.trackVisit();
  }

  signHonorPledge() {
    this.data.community.pledgesCount = (this.data.community.pledgesCount || 0) + 1;
    this.save();
  }
}

window.storeDB = new StoreDB();
