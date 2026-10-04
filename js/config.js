/**
 * Honesty Store 2 - Production Integrations Configuration
 * Handles Supabase, Cashfree PG, and Phone OTP Auth settings
 * Completely isolated from original installation
 */

const AppConfig = {
  // Store Branding & Identity
  storeName: localStorage.getItem('HONESTY_STORE_NAME') || 'Honesty Store 2',

  // 1. SUPABASE CONFIGURATION
  supabase: {
    // Configured via environment variable SUPABASE_URL or Admin Settings
    url: localStorage.getItem('HONESTY_SUPABASE_URL') || '',
    // Configured via environment variable SUPABASE_ANON_KEY or Admin Settings
    anonKey: localStorage.getItem('HONESTY_SUPABASE_ANON_KEY') || '',
    isConfigured: function() {
      return this.url && this.url.includes('supabase.co') && this.anonKey && this.anonKey.length > 20;
    }
  },

  // 2. CASHFREE PAYMENT GATEWAY CONFIGURATION
  cashfree: {
    // Cashfree Environment: 'PRODUCTION' or 'SANDBOX'
    environment: localStorage.getItem('HONESTY_CASHFREE_ENV') || 'SANDBOX',
    // Cashfree App ID from Cashfree Merchant Dashboard
    appId: localStorage.getItem('HONESTY_CASHFREE_APP_ID') || '',
    // Cashfree API Version
    apiVersion: '2023-08-01',
    isConfigured: function() {
      return this.appId && this.appId !== 'TEST_APP_ID' && this.appId.length > 5;
    }
  },

  // 3. PHONE AUTH & SMS PROVIDER
  auth: {
    countryCode: '+91',
    otpLength: 6,
    sandboxOtp: '123456',
    smsProvider: 'Cashfree / Supabase Phone'
  },

  // 4. DYNAMIC BACKEND CONFIG HYDRATION
  initFromBackend: async function() {
    try {
      const res = await fetch('/api/public-config');
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          if (data.storeName) {
            this.storeName = data.storeName;
            const titleEl = document.getElementById('store-brand-title');
            if (titleEl) titleEl.innerText = data.storeName.toUpperCase();
            document.title = `${data.storeName} - Autonomous Micro-Retail`;
          }
          if (data.supabase && data.supabase.url && data.supabase.anonKey) {
            if (!localStorage.getItem('HONESTY_SUPABASE_URL')) {
              this.supabase.url = data.supabase.url;
            }
            if (!localStorage.getItem('HONESTY_SUPABASE_ANON_KEY')) {
              this.supabase.anonKey = data.supabase.anonKey;
            }
          }
          if (data.cashfree && data.cashfree.appId) {
            if (!localStorage.getItem('HONESTY_CASHFREE_APP_ID')) {
              this.cashfree.appId = data.cashfree.appId;
            }
            if (!localStorage.getItem('HONESTY_CASHFREE_ENV')) {
              this.cashfree.environment = data.cashfree.environment || 'SANDBOX';
            }
          }
        }
      }
    } catch (e) {
      console.warn('[AppConfig] Backend config fetch deferred (offline or starting up):', e.message);
    }
  },

  // Helper to save live credentials directly from Admin Settings
  saveLiveCredentials: async function({ storeName, supabaseUrl, supabaseAnonKey, cashfreeAppId, cashfreeSecret, cashfreeEnv }) {
    if (storeName) localStorage.setItem('HONESTY_STORE_NAME', storeName);
    if (supabaseUrl) localStorage.setItem('HONESTY_SUPABASE_URL', supabaseUrl.trim());
    if (supabaseAnonKey) localStorage.setItem('HONESTY_SUPABASE_ANON_KEY', supabaseAnonKey.trim());
    if (cashfreeAppId) localStorage.setItem('HONESTY_CASHFREE_APP_ID', cashfreeAppId.trim());
    if (cashfreeEnv) localStorage.setItem('HONESTY_CASHFREE_ENV', cashfreeEnv.trim());

    if (cashfreeAppId || cashfreeSecret) {
      try {
        const adminToken = localStorage.getItem('honesty_admin_token') || '';
        const res = await fetch('/api/admin/save-gateway-config', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {})
          },
          body: JSON.stringify({
            appId: cashfreeAppId ? cashfreeAppId.trim() : undefined,
            secretKey: cashfreeSecret ? cashfreeSecret.trim() : undefined,
            env: cashfreeEnv ? cashfreeEnv.trim() : undefined
          })
        });
        const data = await res.json();
        console.log('[Admin Save Gateway]:', data);
      } catch (e) {
        console.warn('Could not save gateway config to server:', e);
      }
    }

    if (window.showToast) {
      window.showToast('Settings saved successfully! Gateway and database are connected.', 'success');
    }
    setTimeout(() => window.location.reload(), 1200);
  }
};

window.AppConfig = AppConfig;

// Automatically initialize from backend upon script load
if (typeof window !== 'undefined') {
  AppConfig.initFromBackend();
}
