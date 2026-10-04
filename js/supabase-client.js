/**
 * Honesty Store - Supabase Client & Realtime Sync Layer (Production Ready)
 * Handles Google OAuth, PostgreSQL queries, Realtime subscriptions, and Atomic RPCs.
 */

class SupabaseClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.realtimeChannels = {};
    this.listeners = {
      productChange: [],
      orderChange: [],
      metricChange: []
    };
    this.init();
  }

  async init() {
    if (window.AppConfig && window.AppConfig.supabase.isConfigured()) {
      await this.loadSDK();
    }
  }

  async loadSDK() {
    if (window.supabase) {
      this.initClient();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.async = true;
    script.onload = () => {
      this.initClient();
    };
    script.onerror = () => {
      console.warn('[SupabaseClient] Could not load Supabase SDK from CDN.');
    };
    document.head.appendChild(script);
  }

  initClient() {
    try {
      const { url, anonKey } = window.AppConfig.supabase;
      this.client = window.supabase.createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage
        }
      });
      this.isConnected = true;
      console.log('[SupabaseClient] Connected to Supabase PostgreSQL at:', url);

      this.subscribeRealtime();
    } catch (err) {
      console.warn('[SupabaseClient] Initialization warning:', err);
    }
  }

  // ============================================================
  // AUTHENTICATION: GOOGLE OAUTH & SESSION MANAGEMENT
  // ============================================================

  async signInWithGoogle(options = {}) {
    if (!this.client) {
      throw new Error('Supabase client is not initialized. Check internet connection and configuration.');
    }
    const currentOrigin = window.location.origin;
    const cleanPath = window.location.pathname.replace(/\/index\.html$/i, '').replace(/\/+$/, '');
    const redirectTo = options.redirectTo || `${currentOrigin}${cleanPath}/`;

    console.log('[SupabaseClient] Initiating Google OAuth with redirect to:', redirectTo);
    const { data, error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account'
        }
      }
    });

    if (error) {
      console.error('[SupabaseClient] Google OAuth Error:', error);
      throw error;
    }
    return data;
  }

  async signOut() {
    if (!this.client) return;
    try {
      await this.client.auth.signOut();
    } catch (e) {
      console.warn('[SupabaseClient] Error signing out:', e);
    }
  }

  async getSession() {
    if (!this.client) return null;
    try {
      const { data } = await this.client.auth.getSession();
      return data ? data.session : null;
    } catch (e) {
      return null;
    }
  }

  async getUser() {
    if (!this.client) return null;
    try {
      const { data } = await this.client.auth.getUser();
      return data ? data.user : null;
    } catch (e) {
      return null;
    }
  }

  onAuthStateChange(callback) {
    if (!this.client) return null;
    return this.client.auth.onAuthStateChange(callback);
  }

  /**
   * Check if a given user has Administrator privileges.
   * Authoritative check:
   * Securely verifies admin status with the server-side whitelist.
   * Admin emails are kept strictly private on the server and are never exposed in client scripts.
   */
  async checkIsAdmin(user) {
    if (!user) {
      localStorage.removeItem('honesty_admin_token');
      localStorage.removeItem('honesty_admin_auth');
      return false;
    }

    try {
      const liveSession = await this.getSession();
      const token = (liveSession && liveSession.access_token)
        || (window.authManager && typeof window.authManager.getAccessToken === 'function' ? window.authManager.getAccessToken() : null)
        || user.token
        || user.access_token
        || localStorage.getItem('honesty_admin_token')
        || '';

      if (token) {
        const res = await fetch('/api/check-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.isAdmin) {
            if (data.adminToken) {
              localStorage.setItem('honesty_admin_token', data.adminToken);
            }
            localStorage.setItem('honesty_admin_auth', 'true');
            return true;
          }
        }
      }
    } catch (e) {
      console.warn('[SupabaseClient] checkIsAdmin server check error:', e);
    }

    // Direct Supabase RPC fallback if available
    if (this.client) {
      try {
        const { data, error } = await this.client.rpc('is_admin');
        if (!error && typeof data === 'boolean' && data) {
          localStorage.setItem('honesty_admin_auth', 'true');
          return true;
        }
      } catch (e) {}
    }

    localStorage.removeItem('honesty_admin_token');
    localStorage.removeItem('honesty_admin_auth');
    return false;
  }

  // ============================================================
  // REALTIME CHANNELS
  // ============================================================

  subscribeRealtime() {
    if (!this.client) return;

    // 1. Realtime channel for products & stock changes
    this.realtimeChannels.products = this.client
      .channel('public:products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        console.log('[Supabase Realtime] Product change:', payload.eventType, payload.new || payload.old);
        if (window.storeDB && typeof window.storeDB.handleRealtimeProductUpdate === 'function') {
          window.storeDB.handleRealtimeProductUpdate(payload);
        }
        this.listeners.productChange.forEach(cb => {
          try { cb(payload); } catch (e) {}
        });
      })
      .subscribe();

    // 2. Realtime channel for orders
    this.realtimeChannels.orders = this.client
      .channel('public:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        console.log('[Supabase Realtime] Order event:', payload.eventType, payload.new || payload.old);
        if (window.storeDB && typeof window.storeDB.handleRealtimeOrderUpdate === 'function') {
          window.storeDB.handleRealtimeOrderUpdate(payload);
        }
        this.listeners.orderChange.forEach(cb => {
          try { cb(payload); } catch (e) {}
        });
      })
      .subscribe();

    // 3. Realtime channel for community metrics
    this.realtimeChannels.metrics = this.client
      .channel('public:community_metrics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_metrics' }, (payload) => {
        console.log('[Supabase Realtime] Community metrics updated:', payload.new);
        if (payload.new && window.storeDB) {
          window.storeDB.data.community.salesToday = Number(payload.new.sales_today) || 0;
          window.storeDB.data.community.storeVisits = Number(payload.new.store_visits) || 0;
          window.storeDB.data.community.completedPayments = Number(payload.new.completed_payments) || 0;
          window.storeDB.notify();
        }
        this.listeners.metricChange.forEach(cb => {
          try { cb(payload); } catch (e) {}
        });
      })
      .subscribe();
  }

  // ============================================================
  // DATABASE QUERIES (PRODUCTS, ORDERS, INVENTORY, METRICS)
  // ============================================================

  /**
   * Fetch active catalog products from Supabase
   */
  async fetchProducts() {
    if (!this.client) return [];
    try {
      const { data, error } = await this.client
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        console.warn('[SupabaseClient] Error fetching products:', error);
        return [];
      }
      return data || [];
    } catch (e) {
      console.warn('[SupabaseClient] fetchProducts exception:', e);
      return [];
    }
  }

  /**
   * Fetch orders strictly belonging to a specific customer (RLS enforced)
   */
  async getUserOrders(userId) {
    if (!this.client || !userId) return [];
    try {
      const { data, error } = await this.client
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[SupabaseClient] Error fetching user orders:', error);
        return [];
      }
      return data || [];
    } catch (e) {
      console.warn('[SupabaseClient] getUserOrders exception:', e);
      return [];
    }
  }

  /**
   * Fetch all store orders (Admin only - RLS is_admin() enforced)
   */
  async getAllOrders() {
    if (!this.client) return [];
    try {
      const { data, error } = await this.client
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[SupabaseClient] Error fetching admin orders:', error);
        return [];
      }
      return data || [];
    } catch (e) {
      console.warn('[SupabaseClient] getAllOrders exception:', e);
      return [];
    }
  }

  /**
   * Record a new order in Supabase
   */
  async createOrder(order) {
    if (!this.client) return null;
    try {
      const user = await this.getUser();
      const payload = {
        id: order.id,
        user_id: user ? user.id : (order.userId || null),
        customer_phone: order.customerPhone || null,
        customer_email: user ? user.email : (order.customerEmail || null),
        customer_name: user ? (user.user_metadata?.full_name || user.user_metadata?.name || user.email) : (order.customerName || null),
        amount: order.amount,
        item_count: order.itemCount || (Array.isArray(order.items) ? order.items.length : 1),
        items: order.items || [],
        status: order.status || 'PAID',
        payment_method: order.paymentMethod || 'UPI',
        payment_gateway: order.paymentGateway || 'Cashfree',
        cashfree_order_id: order.cashfreeOrderId || order.id,
        time_label: order.timeLabel || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      const { data, error } = await this.client
        .from('orders')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.warn('[SupabaseClient] createOrder error:', error);
        return null;
      }
      return data;
    } catch (e) {
      console.warn('[SupabaseClient] createOrder exception:', e);
      return null;
    }
  }

  /**
   * Admin: Update order status in Supabase
   */
  async updateOrderStatus(orderId, status) {
    const statusUpper = String(status || '').toUpperCase().trim();
    if (this.client) {
      try {
        const { data, error } = await this.client
          .from('orders')
          .update({ status: statusUpper, updated_at: new Date().toISOString() })
          .eq('id', orderId)
          .select()
          .single();

        if (!error && data) return data;
      } catch (e) {
        console.warn('[SupabaseClient] Direct updateOrderStatus warning, falling back to server API:', e);
      }
    }

    const headers = window.getAdminHeaders ? window.getAdminHeaders() : { 'Content-Type': 'application/json' };
    const res = await fetch('/api/admin/update-order-status', {
      method: 'POST',
      headers,
      body: JSON.stringify({ orderId, status: statusUpper })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update order status');
    return result.order;
  }

  /**
   * Deduct inventory atomically using PostgreSQL RPC with row locks
   */
  async deductInventoryRPC(items) {
    if (!this.client || !items || items.length === 0) return false;
    try {
      const formattedItems = items.map(i => ({
        id: i.id,
        qty: Number(i.qty) || 1
      }));
      const { data, error } = await this.client.rpc('deduct_inventory', {
        p_items: formattedItems
      });

      if (error) {
        console.error('[SupabaseClient] deduct_inventory RPC error:', error);
        return false;
      }
      return data === true;
    } catch (e) {
      console.warn('[SupabaseClient] deductInventoryRPC exception:', e);
      return false;
    }
  }

  /**
   * Optimize product photo client-side before upload
   * Resizes image to maxDimension (default 1024px) keeping aspect ratio,
   * compresses to JPEG quality ~0.82 to keep file size under 150KB.
   */
  async optimizeImage(file, maxDimension = 1024, quality = 0.82) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        return reject(new Error('Please select a valid image file (JPG, PNG, or WebP)'));
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const outputType = 'image/jpeg';
          canvas.toBlob((blob) => {
            if (!blob) {
              return reject(new Error('Canvas compression failed'));
            }
            const dataUrl = canvas.toDataURL(outputType, quality);
            resolve({
              blob,
              dataUrl,
              base64: dataUrl,
              width,
              height,
              size: blob.size,
              type: outputType
            });
          }, outputType, quality);
        };
        img.onerror = () => reject(new Error('Failed to load image for processing'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file from device'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Upload product image to Supabase Storage bucket 'product-images'
   * Tries direct Supabase Storage SDK upload first, falls back to server proxy.
   */
  async uploadProductImage(file, productId = '') {
    const optimized = await this.optimizeImage(file);
    const cleanId = (productId || 'prod_' + Date.now()).replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${cleanId}_${Date.now()}.jpg`;

    // 1. Try Direct Supabase Storage Upload if user is authenticated with Supabase
    if (this.client && this.client.storage) {
      try {
        const { data, error } = await this.client.storage
          .from('product-images')
          .upload(fileName, optimized.blob, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (!error && data) {
          const { data: urlData } = this.client.storage
            .from('product-images')
            .getPublicUrl(fileName);
          return {
            publicUrl: urlData.publicUrl,
            storagePath: fileName,
            optimized
          };
        }
      } catch (err) {
        console.warn('[SupabaseClient] Direct storage upload failed, using server proxy:', err.message);
      }
    }

    // 2. Reliable Server Proxy Upload
    const headers = window.getAdminHeaders ? window.getAdminHeaders() : { 'Content-Type': 'application/json' };
    const res = await fetch('/api/admin/upload-product-image', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fileName,
        contentType: 'image/jpeg',
        base64Data: optimized.base64,
        productId: cleanId
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Could not upload image to server');
    }

    const data = await res.json();
    return {
      publicUrl: data.imageUrl,
      storagePath: data.storagePath,
      optimized
    };
  }

  /**
   * Delete product image from Supabase Storage
   */
  async deleteProductImage(storagePath) {
    if (!storagePath) return;
    if (this.client && this.client.storage) {
      try {
        await this.client.storage.from('product-images').remove([storagePath]);
      } catch (e) {}
    }
  }

  /**
   * Admin: Add new product to Supabase
   */
  async addProduct(product) {
    const payload = {
      id: product.id || ('prod_' + Date.now()),
      name: product.name,
      reference_name: product.reference_name || product.referenceName || null,
      description: product.description || '',
      variant: product.variant || '',
      category: product.category || 'Chips',
      price: Number(product.price) || 0,
      purchase_price: (product.purchase_price !== undefined && product.purchase_price !== null && product.purchase_price !== '') ? Number(product.purchase_price) : ((product.purchasePrice !== undefined && product.purchasePrice !== null && product.purchasePrice !== '') ? Number(product.purchasePrice) : null),
      selling_price: (product.selling_price !== undefined && product.selling_price !== null && product.selling_price !== '') ? Number(product.selling_price) : ((product.sellingPrice !== undefined && product.sellingPrice !== null && product.sellingPrice !== '') ? Number(product.sellingPrice) : null),
      stock: Number(product.stock) || 0,
      expected_stock: Number(product.stock) || 0,
      physical_stock: Number(product.stock) || 0,
      image_url: product.image_url || product.imageUrl || product.image || 'assets/lays.png',
      storage_path: product.storage_path || product.storagePath || null,
      low_stock_threshold: product.low_stock_threshold || product.lowStockThreshold || 5,
      is_active: product.is_active !== undefined ? Boolean(product.is_active) : (product.isActive !== undefined ? Boolean(product.isActive) : true),
      is_available: product.is_available !== undefined ? Boolean(product.is_available) : (product.isAvailable !== undefined ? Boolean(product.isAvailable) : true)
    };

    if (this.client) {
      try {
        const { data, error } = await this.client
          .from('products')
          .insert([payload])
          .select()
          .single();

        if (!error && data) return data;
      } catch (e) {
        console.warn('[SupabaseClient] Direct addProduct warning, falling back to server API:', e);
      }
    }

    // Fallback to server endpoint
    const headers = window.getAdminHeaders ? window.getAdminHeaders() : { 'Content-Type': 'application/json' };
    const res = await fetch('/api/admin/add-product', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to add product');
    return result.product;
  }

  /**
   * Admin: Update product details / stock in Supabase
   */
  async updateProduct(id, updates) {
    const patchPayload = { ...updates };
    if (patchPayload.referenceName !== undefined && patchPayload.reference_name === undefined) {
      patchPayload.reference_name = patchPayload.referenceName;
    }
    if (patchPayload.purchasePrice !== undefined && patchPayload.purchase_price === undefined) {
      patchPayload.purchase_price = patchPayload.purchasePrice;
    }
    if (patchPayload.sellingPrice !== undefined && patchPayload.selling_price === undefined) {
      patchPayload.selling_price = patchPayload.sellingPrice;
    }
    if (patchPayload.imageUrl !== undefined && patchPayload.image_url === undefined) {
      patchPayload.image_url = patchPayload.imageUrl;
    }
    if (patchPayload.storagePath !== undefined && patchPayload.storage_path === undefined) {
      patchPayload.storage_path = patchPayload.storagePath;
    }
    if (patchPayload.isActive !== undefined && patchPayload.is_active === undefined) {
      patchPayload.is_active = patchPayload.isActive;
    }
    if (patchPayload.isAvailable !== undefined && patchPayload.is_available === undefined) {
      patchPayload.is_available = patchPayload.isAvailable;
    }
    if (patchPayload.lowStockThreshold !== undefined && patchPayload.low_stock_threshold === undefined) {
      patchPayload.low_stock_threshold = patchPayload.lowStockThreshold;
    }

    // Remove camelCase helpers before Supabase PostgREST update
    delete patchPayload.referenceName;
    delete patchPayload.purchasePrice;
    delete patchPayload.sellingPrice;
    delete patchPayload.imageUrl;
    delete patchPayload.storagePath;
    delete patchPayload.isActive;
    delete patchPayload.isAvailable;
    delete patchPayload.lowStockThreshold;
    delete patchPayload.expectedStock;
    delete patchPayload.physicalStock;

    if (this.client) {
      try {
        const { data, error } = await this.client
          .from('products')
          .update(patchPayload)
          .eq('id', id)
          .select()
          .single();

        if (!error && data) return data;
      } catch (e) {
        console.warn('[SupabaseClient] Direct updateProduct warning, falling back to server API:', e);
      }
    }

    const headers = window.getAdminHeaders ? window.getAdminHeaders() : { 'Content-Type': 'application/json' };
    const res = await fetch('/api/admin/update-product', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id, ...patchPayload })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update product');
    return result.product;
  }

  /**
   * Admin: Archive / restore product
   */
  async archiveProduct(id, isActive = false) {
    const headers = window.getAdminHeaders ? window.getAdminHeaders() : { 'Content-Type': 'application/json' };
    const res = await fetch('/api/admin/archive-product', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id, isActive })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update product status');
    return result.product;
  }

  /**
   * Admin: Check if product can be safely deleted (not referenced in orders)
   */
  async canDeleteProduct(id) {
    const headers = window.getAdminHeaders ? window.getAdminHeaders() : { 'Content-Type': 'application/json' };
    const res = await fetch('/api/admin/can-delete-product', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id })
    });
    const result = await res.json();
    return result.canDelete !== false;
  }

  /**
   * Admin: Permanently delete product
   */
  async deleteProduct(id) {
    const headers = window.getAdminHeaders ? window.getAdminHeaders() : { 'Content-Type': 'application/json' };
    const res = await fetch('/api/admin/delete-product', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to delete product');
    return result;
  }

  /**
   * Admin: Perform physical stock reconciliation audit
   */
  async recordStockAudit(audit) {
    if (!this.client) return null;
    try {
      const user = await this.getUser();
      const { data, error } = await this.client
        .from('stock_audits')
        .insert([{
          product_id: audit.productId,
          expected_stock: audit.expectedStock,
          physical_stock: audit.physicalStock,
          discrepancy: audit.discrepancy,
          discrepancy_value: audit.discrepancyValue,
          status: audit.status || (audit.discrepancy < 0 ? 'SHRINKAGE' : (audit.discrepancy > 0 ? 'EXCESS' : 'BALANCED')),
          notes: audit.notes || '',
          audited_by: user ? user.email : 'admin'
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (e) {
      console.error('[SupabaseClient] recordStockAudit error:', e);
      throw e;
    }
  }
}

window.supabaseClient = new SupabaseClient();
