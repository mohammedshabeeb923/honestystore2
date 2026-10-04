/**
 * Honesty Store - Main Application Coordinator
 * Handles view switching, admin authentication, and global modal bindings
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Applications
  window.customerApp = new CustomerApp();
  window.adminApp = new AdminApp();

  const stage = document.getElementById('master-stage');
  const viewBtns = document.querySelectorAll('.view-btn');
  const adminAuthModal = document.getElementById('admin-auth-modal');
  let pendingAdminMode = null;

  function isAdminLoggedIn() {
    return Boolean(
      (window.authManager && window.authManager.isAdmin()) || 
      (localStorage.getItem('honesty_admin_token') && localStorage.getItem('honesty_admin_auth') === 'true')
    );
  }

  async function ensureAdminSession() {
    const token = localStorage.getItem('honesty_admin_token') || (window.authManager && window.authManager.getAccessToken());
    if (token) {
      try {
        const res = await fetch('/api/check-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const data = await res.json();
        if (data && data.isAdmin && data.adminToken) {
          localStorage.setItem('honesty_admin_token', data.adminToken);
          localStorage.setItem('honesty_admin_auth', 'true');
          if (window.authManager) window.authManager.isAdminUser = true;
        } else {
          localStorage.removeItem('honesty_admin_token');
          localStorage.removeItem('honesty_admin_auth');
          if (window.authManager) window.authManager.isAdminUser = false;
        }
      } catch (e) {}
    }
  }

  // Switch View Mode (Customer / Admin / Dual)
  function setViewMode(mode) {
    if ((mode === 'admin' || mode === 'dual') && !isAdminLoggedIn()) {
      pendingAdminMode = mode;
      const errEl = document.getElementById('admin-login-error');
      if (errEl) errEl.style.display = 'none';

      // If user is already logged in with Google, but not registered as admin:
      if (window.authManager && window.authManager.isLoggedIn && !window.authManager.isAdmin()) {
        if (errEl) {
          errEl.innerHTML = '<strong>Access Denied:</strong> This account does not have administrator privileges.';
          errEl.style.display = 'block';
        }
      }

      if (adminAuthModal) adminAuthModal.classList.add('active');
      return;
    }

    stage.className = `master-stage mode-${mode}`;
    viewBtns.forEach(btn => {
      if (btn.dataset.mode === mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    localStorage.setItem('honesty_store_view_mode', mode);

    if (mode === 'admin' || mode === 'dual') {
      ensureAdminSession();
      if (window.storeDB && typeof window.storeDB.loadAdminOrders === 'function') {
        window.storeDB.loadAdminOrders();
      }
      if (window.adminApp && typeof window.adminApp.render === 'function') {
        window.adminApp.render();
      }
    }
  }

  window.setViewMode = setViewMode;

  viewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      setViewMode(btn.dataset.mode);
    });
  });

  // Handle Admin Logout button
  const btnAdminLogout = document.getElementById('btn-admin-logout');
  if (btnAdminLogout) {
    btnAdminLogout.addEventListener('click', () => {
      localStorage.removeItem('honesty_admin_auth');
      localStorage.removeItem('honesty_admin_token');
      if (window.authManager) {
        window.authManager.isAdminUser = false;
      }
      if (window.showToast) window.showToast('Admin Console has been locked.', 'info');
      setViewMode('customer');
    });
  }

  // Handle mobile shortcuts to Admin Console
  const btnHeaderAdmin = document.getElementById('btn-header-admin');
  if (btnHeaderAdmin) {
    btnHeaderAdmin.addEventListener('click', () => {
      setViewMode('admin');
    });
  }

  const btnSplashAdmin = document.getElementById('btn-splash-admin');
  if (btnSplashAdmin) {
    btnSplashAdmin.addEventListener('click', () => {
      setViewMode('admin');
    });
  }

  // Handle Switch to Customer Store button inside Admin
  const btnAdminSwitchStore = document.getElementById('btn-admin-switch-store');
  if (btnAdminSwitchStore) {
    btnAdminSwitchStore.addEventListener('click', () => {
      setViewMode('customer');
    });
  }

  // Load preferred mode or check URL parameters (e.g. ?view=admin)
  const urlParams = new URLSearchParams(window.location.search);
  let savedMode = localStorage.getItem('honesty_store_view_mode') || 'customer';
  if (urlParams.has('admin') || urlParams.get('view') === 'admin') {
    savedMode = 'admin';
  }

  if ((savedMode === 'admin' || savedMode === 'dual') && !isAdminLoggedIn()) {
    stage.className = 'master-stage mode-customer';
    viewBtns.forEach(btn => {
      if (btn.dataset.mode === 'customer') btn.classList.add('active');
      else btn.classList.remove('active');
    });
  } else {
    setViewMode(savedMode);
  }

  // Handle Cashfree redirect return_url (?order_id=...)
  if (urlParams.has('order_id')) {
    const returnOrderId = urlParams.get('order_id');
    console.log('[Cashfree Return URL]: Checking order', returnOrderId);
    
    // Show confirming state
    if (window.showToast) window.showToast('Confirming your payment...', 'info');

    // Clean up URL immediately (remove ?order_id= from address bar)
    try {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    } catch(e) {}

    const verifyReturnOrder = async (attempt = 1) => {
      try {
        const r = await fetch('/api/verify-cashfree-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: returnOrderId })
        });
        const data = await r.json();
        
        if (data.isPaid && window.cashfreeClient) {
          window.cashfreeClient.handlePaymentSuccess(data.order || { id: returnOrderId, amount: data.orderAmount || 1, items: [] });
          if (window.showToast) window.showToast('Payment confirmed! Thank you.', 'success');
        } else if ((data.orderStatus === 'PENDING' || !data.orderStatus) && attempt <= 3) {
          // Webhook may still be in transit — retry after delay
          const delay = attempt * 4000; // 4s, 8s, 12s
          setTimeout(() => verifyReturnOrder(attempt + 1), delay);
          if (attempt === 1 && window.showToast) window.showToast('Payment verification in progress... Please wait.', 'info');
        } else if (data.orderStatus === 'FAILED') {
          if (window.showToast) window.showToast('Payment was not completed. Please try again if amount was deducted.', 'error');
        } else {
          if (window.showToast) window.showToast('Payment status: ' + (data.orderStatus || 'Processing') + '. Check your order history shortly.', 'info');
        }
      } catch(e) {
        console.warn('[Return URL] Verification error:', e);
        if (window.showToast) window.showToast('Could not verify payment status. Please check your order history.', 'error');
      }
    };
    
    verifyReturnOrder();
  }

  // Close modals when clicking overlay
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });

  // Modal Close buttons
  document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      if (modal) modal.classList.remove('active');
    });
  });

  // Reset demo data button
  const btnReset = document.getElementById('btn-reset-demo');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (confirm('Reset store data back to initial showcase values from screenshots?')) {
        window.storeDB.resetToDefault();
      }
    });
  }

  // Shelf Scanner simulation button inside scanner modal
  const btnSimulateScan = document.getElementById('btn-simulate-shelf-scan');
  if (btnSimulateScan) {
    btnSimulateScan.addEventListener('click', () => {
      if (window.customerApp && typeof window.customerApp.closeScannerModal === 'function') {
        window.customerApp.closeScannerModal();
      } else {
        const modal = document.getElementById('scanner-modal');
        if (modal) modal.classList.remove('active');
      }
      if (window.customerApp && typeof window.customerApp.switchScreen === 'function') {
        window.customerApp.switchScreen('screen-catalog');
        window.customerApp.playSuccessTone();
      }
      if (window.showToast) window.showToast('Shelf QR verified! Shelf unlocked.', 'success');
    });
  }
});
