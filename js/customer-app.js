/**
 * Customer Mobile Application Controller
 */

class CustomerApp {
  constructor() {
    this.currentScreen = 'screen-splash';
    this.activeCategory = 'All';
    this.scannerStream = null;
    this.initElements();
    this.bindEvents();
    this.subscribeToStore();
    this.renderCatalog();
    this.renderOrders();
    this.renderCommunity();
    this.updateCartUI();

    // Auto-bypass splash screen if user is already authenticated
    if (window.authManager && window.authManager.isAuthenticated()) {
      this.switchScreen('screen-catalog');
    }
  }

  initElements() {
    this.screens = {
      splash: document.getElementById('screen-splash'),
      catalog: document.getElementById('screen-catalog'),
      cart: document.getElementById('screen-cart'),
      verified: document.getElementById('screen-verified'),
      orders: document.getElementById('screen-orders'),
      honesty: document.getElementById('screen-honesty')
    };

    this.navTabs = document.querySelectorAll('.nav-tab-item');
    this.cartDrawer = document.getElementById('cart-drawer');
    this.cartItemsList = document.getElementById('cart-items-list');
    this.cartTotalAmount = document.getElementById('cart-total-amount');
    this.cartBadge = document.getElementById('cart-nav-badge');
    this.productsGrid = document.getElementById('products-grid');
    this.categoryChips = document.querySelectorAll('.category-chip');

    // Fullpage Cart Elements
    this.cartFullItemsList = document.getElementById('cart-fullpage-items-list');
    this.cartFullSubtotal = document.getElementById('cart-fullpage-subtotal');
    this.cartFullTotal = document.getElementById('cart-fullpage-total');
    this.cartPayBtn = document.getElementById('btn-cart-fullpage-pay');
  }

  bindEvents() {
    // Enter Store from splash - Requires compulsory Gmail & Phone sign in / sign up
    const btnEnter = document.getElementById('btn-enter-store');
    if (btnEnter) {
      btnEnter.addEventListener('click', () => {
        if (window.authManager && window.authManager.hasMandatoryCustomerDetails()) {
          window.storeDB.logVisit();
          this.switchScreen('screen-catalog');
        } else {
          window.authManager.openAuthModal({
            onSuccess: () => {
              window.storeDB.logVisit();
              this.switchScreen('screen-catalog');
            }
          });
        }
      });
    }

    // Stepper Scan click (Interactive Shelf QR Scanner)
    const scanStep = document.getElementById('step-scan-shelf');
    if (scanStep) {
      scanStep.addEventListener('click', () => {
        this.openScannerModal();
      });
    }

    const btnCloseScanner = document.getElementById('btn-close-scanner');
    if (btnCloseScanner) {
      btnCloseScanner.addEventListener('click', () => {
        this.closeScannerModal();
      });
    }

    // Category chips
    this.categoryChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        this.categoryChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activeCategory = chip.dataset.category || 'All';
        this.renderCatalog();
      });
    });

    // Bottom Navigation
    this.navTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = tab.dataset.target;
        if (target === 'cart') {
          this.renderFullCart();
          this.switchScreen('screen-cart');
        } else {
          this.navTabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          this.switchScreen(target);
        }
      });
    });

    // Back button in fullpage Cart
    const btnCartBack = document.getElementById('btn-cart-back');
    if (btnCartBack) {
      btnCartBack.addEventListener('click', () => {
        this.switchScreen('screen-catalog');
      });
    }

    // Fullpage Cart Pay Button
    if (this.cartPayBtn) {
      this.cartPayBtn.addEventListener('click', () => {
        const { total } = window.storeDB.getCartTotal();
        if (total <= 0) return;

        // Launch Cashfree Payment Gateway
        // (Cashfree client automatically prompts for 10-digit mobile number if not yet saved)
        if (window.cashfreeClient) {
          window.cashfreeClient.initiatePayment({ amount: total });
        }
      });
    }

    // Done button on Verified Screen
    const btnVerifiedDone = document.getElementById('btn-verified-done');
    if (btnVerifiedDone) {
      btnVerifiedDone.addEventListener('click', () => {
        this.switchScreen('screen-orders');
      });
    }

    // Cart Close Button in Drawer
    const btnCloseCart = document.getElementById('btn-close-cart');
    if (btnCloseCart) {
      btnCloseCart.addEventListener('click', () => this.toggleCartDrawer(false));
    }

    // Checkout Trigger from Drawer
    const btnPayNow = document.getElementById('btn-pay-now');
    if (btnPayNow) {
      btnPayNow.addEventListener('click', () => {
        this.openPaymentModal();
      });
    }

    // Pledge Button in Our Honesty screen
    const btnPledge = document.getElementById('btn-sign-pledge');
    if (btnPledge) {
      btnPledge.addEventListener('click', () => {
        window.storeDB.signHonorPledge();
        btnPledge.innerText = '✓ Honor Pledge Signed!';
        btnPledge.style.background = '#0ca678';
        btnPledge.style.color = '#ffffff';
        if (window.showToast) {
          window.showToast('Thank you for upholding community trust! Your pledge makes this store possible.', 'success');
        }
      });
    }
  }

  subscribeToStore() {
    window.storeDB.subscribe((data) => {
      this.renderCatalog();
      this.renderFullCart();
      this.renderOrders();
      this.renderCommunity();
      this.updateCartUI();
    });
  }

  switchScreen(screenId) {
    if (screenId !== 'screen-splash') {
      const isAuth = window.authManager && typeof window.authManager.hasMandatoryCustomerDetails === 'function'
        ? window.authManager.hasMandatoryCustomerDetails()
        : false;
      if (!isAuth) {
        if (window.authManager && typeof window.authManager.openAuthModal === 'function') {
          window.authManager.openAuthModal({
            onSuccess: () => {
              this.switchScreen(screenId);
            }
          });
        }
        return;
      }
    }

    this.currentScreen = screenId;
    Object.values(this.screens).forEach(screen => {
      if (screen) screen.classList.remove('active');
    });

    const activeEl = document.getElementById(screenId);
    if (activeEl) {
      activeEl.classList.add('active');
    }

    // Update bottom nav highlighting
    this.navTabs.forEach(tab => {
      if (tab.dataset.target === screenId || (screenId === 'screen-cart' && tab.dataset.target === 'cart')) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Show or hide header and bottom nav based on screen
    const bottomNav = document.getElementById('mobile-bottom-nav');
    const appHeader = document.getElementById('mobile-app-header');

    if (screenId === 'screen-splash' || screenId === 'screen-cart' || screenId === 'screen-verified') {
      if (appHeader) appHeader.style.display = 'none';
    } else {
      if (appHeader) appHeader.style.display = 'flex';
    }

    if (screenId === 'screen-splash' || screenId === 'screen-verified') {
      if (bottomNav) bottomNav.style.display = 'none';
    } else {
      if (bottomNav) bottomNav.style.display = 'flex';
    }

    if (screenId === 'screen-orders' && window.storeDB && typeof window.storeDB.loadUserOrders === 'function') {
      window.storeDB.loadUserOrders();
    }
  }

  renderCatalog() {
    if (!this.productsGrid) return;
    const isCatalogLoading = window.storeDB ? window.storeDB.isCatalogLoading : false;
    const products = window.storeDB ? window.storeDB.getProducts(this.activeCategory) : [];
    const cart = window.storeDB ? window.storeDB.getCart() : [];

    if (isCatalogLoading && (!products || products.length === 0)) {
      this.productsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 16px; color: #64748b;">
          <div class="spinner" style="margin: 0 auto 12px; width: 34px; height: 34px; border: 3px solid #e2e8f0; border-top-color: #0ca678; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
          <p style="font-size: 14px; font-weight: 700; color: #0f172a;">Loading fresh shelf products...</p>
          <p style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Connecting to live store inventory</p>
        </div>
      `;
      return;
    }

    this.productsGrid.innerHTML = products.map(prod => {
      const isOutOfStock = prod.stock <= 0;
      const isLowStock = prod.stock > 0 && prod.stock <= (prod.lowStockThreshold || 5);
      const isUnavailable = prod.isAvailable === false || prod.isActive === false;
      const cartItem = cart.find(i => i.id === prod.id);
      const cartQty = cartItem ? cartItem.qty : 0;
      
      // Strict separation of Purchase Price and Selling Price:
      // Customers must NEVER see purchase_price or reference rates.
      const hasValidSellingPrice = prod.sellingPrice !== null && prod.sellingPrice !== undefined && Number(prod.sellingPrice) > 0;
      const hasDiscount = hasValidSellingPrice && prod.price && Number(prod.sellingPrice) < Number(prod.price);
      const displayPrice = hasValidSellingPrice 
        ? (Number(prod.sellingPrice) % 1 === 0 ? Number(prod.sellingPrice).toFixed(0) : Number(prod.sellingPrice).toFixed(2))
        : null;
      const mrpPrice = (prod.price && Number(prod.price) > 0)
        ? (Number(prod.price) % 1 === 0 ? Number(prod.price).toFixed(0) : Number(prod.price).toFixed(2))
        : null;

      const canPurchase = hasValidSellingPrice && !isOutOfStock && !isUnavailable;

      return `
        <div class="product-card ${!canPurchase ? 'out-of-stock' : ''}" data-id="${prod.id}">
          <div class="card-img-wrap">
            ${isUnavailable ? '<span class="badge-low-stock" style="background:#ef4444; color:#fff;">UNAVAILABLE</span>' : (isLowStock ? '<span class="badge-low-stock">LOW STOCK</span>' : '')}
            <img src="${window.resolveProductImage ? window.resolveProductImage(prod.image, prod.id) : (prod.image || 'assets/lays.jpg')}" 
                 alt="${prod.name}" 
                 loading="lazy" 
                 onerror="this.onerror=null;this.src='assets/lays.jpg';" />
          </div>
          <div class="product-name" title="${prod.name}">${prod.name}</div>
          <div class="product-variant-line">${prod.variant || '&nbsp;'}</div>
          <div class="product-stock-line ${isLowStock ? 'warning' : ''}">
            ${isUnavailable 
              ? '<span style="color:#ef4444; font-weight:700;">Temporarily Unavailable</span>'
              : (isLowStock ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block; vertical-align:-1px; margin-right:3px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' : '') + `${prod.stock} IN STOCK`}
          </div>
          <div class="product-bottom-row">
            <div class="product-price">
              ${hasValidSellingPrice ? `
                <span class="price-val">₹${displayPrice}</span>
                ${hasDiscount ? `<span class="price-mrp" style="font-size:11px; text-decoration:line-through; color:#94a3b8; margin-left:3px; font-weight:400;">₹${mrpPrice}</span>` : ''}
              ` : `
                <span class="badge-tag muted price-unavail-badge">Price unavailable</span>
              `}
            </div>
            ${!canPurchase ? `
              <button class="btn-add-item disabled" disabled title="${!hasValidSellingPrice ? 'Price unavailable - Awaiting admin input' : (isUnavailable ? 'Unavailable' : 'Out of stock')}">
                ⊘
              </button>
            ` : (cartQty > 0 ? `
              <div class="product-stepper">
                <button class="stepper-btn minus" onclick="window.customerApp.reduceCartItem('${prod.id}')" title="Reduce quantity">
                  −
                </button>
                <span class="stepper-count">${cartQty}</span>
                <button class="stepper-btn plus" onclick="window.customerApp.addToCart('${prod.id}')" title="Add one more">+</button>
              </div>
            ` : `
              <button class="btn-add-item" 
                      onclick="window.customerApp.addToCart('${prod.id}')"
                      title="Add to cart">
                +
              </button>
            `)}
          </div>
        </div>
      `;
    }).join('');
  }

  addToCart(productId) {
    const prod = window.storeDB.getProduct(productId);
    if (prod) {
      if (prod.isAvailable === false || prod.isActive === false) {
        if (window.showToast) window.showToast('This item is currently unavailable.', 'warning');
        return;
      }
      if (!prod.sellingPrice || Number(prod.sellingPrice) <= 0) {
        if (window.showToast) window.showToast('Price unavailable - Awaiting admin input.', 'warning');
        return;
      }
    }
    const success = window.storeDB.addToCart(productId);
    if (!success) {
      if (window.showToast) window.showToast('This item is out of stock or maximum limit reached.', 'error');
      return;
    }
    // Haptic / visual feedback
    this.playChime();
    this.updateCartUI();
    this.renderCatalog();
    this.renderFullCart();
  }

  reduceCartItem(productId) {
    window.storeDB.updateCartQty(productId, -1);
    this.updateCartUI();
    this.renderCatalog();
    this.renderFullCart();
  }

  increaseCartItem(productId) {
    this.addToCart(productId);
  }

  removeCartItem(productId) {
    window.storeDB.updateCartQty(productId, -999);
    this.updateCartUI();
    this.renderCatalog();
    this.renderFullCart();
  }

  updateCartUI() {
    const cart = window.storeDB.getCart();
    const { total, count } = window.storeDB.getCartTotal();

    if (this.cartBadge) {
      this.cartBadge.innerText = count;
      this.cartBadge.style.display = count > 0 ? 'flex' : 'none';
    }

    if (this.cartTotalAmount) {
      this.cartTotalAmount.innerText = `₹${total}`;
    }

    if (this.cartItemsList) {
      if (cart.length === 0) {
        this.cartItemsList.innerHTML = `
          <div style="text-align:center; padding: 30px 10px; color: #94a3b8;">
            <div style="margin-bottom: 8px; display: flex; justify-content: center;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.7"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            </div>
            <p style="font-size: 14px; font-weight: 600;">Your cart is empty</p>
            <p style="font-size: 12px; margin-top: 4px;">Pick snacks from the shelf to begin</p>
          </div>
        `;
      } else {
        this.cartItemsList.innerHTML = cart.map(item => {
          const itemImg = window.resolveProductImage ? window.resolveProductImage(item.image, item.id) : (item.image || 'assets/lays.jpg');
          return `
          <div class="cart-row-item">
            <div class="cart-item-info">
              <img src="${itemImg}" class="cart-item-img" alt="${item.name}" onerror="this.onerror=null;this.src='assets/lays.jpg';" />
              <div class="cart-item-text">
                <h4>${item.name}</h4>
                <p>₹${item.price} each</p>
              </div>
            </div>
            <div class="cart-qty-ctrls">
              <button class="qty-btn" onclick="window.customerApp.reduceCartItem('${item.id}')" title="Reduce quantity">−</button>
              <span style="font-weight: 700; font-size: 14px; min-width: 16px; text-align: center;">${item.qty}</span>
              <button class="qty-btn" onclick="window.customerApp.increaseCartItem('${item.id}')" title="Add one more">+</button>
              <div style="font-weight: 800; font-size: 14px; margin-left: 8px;">₹${item.price * item.qty}</div>
            </div>
          </div>
        `;
        }).join('');
      }
    }
  }

  toggleCartDrawer(open) {
    if (!this.cartDrawer) return;
    if (open) {
      this.cartDrawer.classList.add('open');
    } else {
      this.cartDrawer.classList.remove('open');
    }
  }

  renderOrders() {
    const listEl = document.getElementById('orders-history-list');
    if (!listEl) return;

    if (!window.authManager || !window.authManager.isAuthenticated()) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 44px 16px; color: #64748b;">
          <div style="width: 52px; height: 52px; border-radius: 50%; background: #f1f5f9; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          </div>
          <p style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">Sign in to view your orders</p>
          <p style="font-size: 12px; color: #94a3b8; margin-bottom: 16px; line-height: 1.4;">Your purchase receipts and order history are privately protected by Supabase RLS.</p>
          <button onclick="window.authManager.openAuthModal()" style="background: #0f172a; color: #fff; border: none; padding: 11px 20px; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;">
            <svg width="15" height="15" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
            Sign In with Google / Phone
          </button>
        </div>
      `;
      return;
    }

    if (window.storeDB && window.storeDB.userOrdersLoading) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 44px 16px; color: #64748b;">
          <div class="spinner" style="margin: 0 auto 12px; width: 34px; height: 34px; border: 3px solid #e2e8f0; border-top-color: #0ca678; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
          <p style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">Loading your order history...</p>
          <p style="font-size: 12px; color: #94a3b8;">Fetching your verified receipts from Supabase</p>
        </div>
      `;
      return;
    }

    if (window.storeDB && window.storeDB.userOrdersError) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 44px 16px; color: #ef4444;">
          <div style="width: 52px; height: 52px; border-radius: 50%; background: #fef2f2; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px; border: 1px solid #fee2e2;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          </div>
          <p style="font-size: 15px; font-weight: 800; color: #991b1b; margin-bottom: 4px;">Unable to load your history. Please try again.</p>
          <p style="font-size: 12px; color: #64748b; margin-bottom: 16px;">${window.storeDB.userOrdersError}</p>
          <button onclick="window.storeDB.loadUserOrders()" style="background: #0f172a; color: #fff; border: none; padding: 9px 18px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer;">
            Retry Loading
          </button>
        </div>
      `;
      return;
    }

    const orders = window.storeDB.getUserOrders();
    if (!orders || orders.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 44px 16px; color: #64748b;">
          <div style="width: 52px; height: 52px; border-radius: 50%; background: #f8fafc; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px; border: 1px dashed #cbd5e1;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
          </div>
          <p style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">No purchases yet.</p>
          <p style="font-size: 12px; color: #94a3b8;">When you buy snacks or drinks, your verified receipts will appear here.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = orders.map(order => {
      const isPaid = order.status === 'PAID' || order.status === 'Paid' || order.paymentStatus === 'PAID';
      const isFailed = order.status === 'FAILED' || order.paymentStatus === 'FAILED';
      const badgeClass = isPaid ? 'background: #e6fcf5; color: #0ca678;' : (isFailed ? 'background: #fee2e2; color: #dc2626;' : 'background: #fef3c7; color: #d97706;');
      const badgeIcon = isPaid ? '✓' : (isFailed ? '✕' : '⏳');
      const itemsListText = (order.items && order.items.length > 0)
        ? order.items.map(i => `${i.qty}× ${i.name} (₹${i.price})`).join(', ')
        : `${order.itemCount} items`;

      return `
        <div class="order-history-card" onclick="window.customerApp.viewReceipt('${order.id}')" style="display: flex; flex-direction: column; gap: 8px; align-items: stretch;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div class="order-card-meta">
              <div class="order-date-label">${order.timeLabel}</div>
              <div class="order-code-title">Order #${order.orderNumber || order.id}</div>
            </div>
            <div class="order-card-amount">₹${order.amount}</div>
          </div>
          <div style="font-size: 12px; color: #475569; background: #f8fafc; padding: 6px 10px; border-radius: 8px; border: 1px solid #f1f5f9;">
            ${itemsListText}
          </div>
          <div class="order-status-row" style="justify-content: space-between; margin-top: 2px;">
            <span class="badge-paid" style="${badgeClass}">
              ${badgeIcon} ${order.status}
            </span>
            <div style="font-size: 11px; color: #94a3b8; display: flex; align-items: center; gap: 4px;">
              ${order.paidAt ? `<span>Paid ${new Date(order.paidAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span> • ` : ''}
              <span style="color: #0ca678; font-weight: 600;">View Bill →</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderCommunity() {
    const comm = window.storeDB.data.community;
    const salesEl = document.getElementById('community-sales-today');
    const visitsEl = document.getElementById('community-visits-count');
    const paymentsEl = document.getElementById('community-payments-count');

    if (salesEl) salesEl.innerText = `₹${comm.salesToday.toLocaleString('en-IN')}`;
    if (visitsEl) visitsEl.innerText = comm.storeVisits;
    if (paymentsEl) paymentsEl.innerText = comm.completedPayments;
  }

  openPaymentModal() {
    const { total, count } = window.storeDB.getCartTotal();
    if (total <= 0) {
      if (window.showToast) window.showToast('Please add snacks or beverages to your cart first!', 'info');
      return;
    }

    const modal = document.getElementById('payment-modal');
    const amountSpan = document.getElementById('pay-modal-amount');
    if (amountSpan) amountSpan.innerText = `₹${total}`;
    if (modal) modal.classList.add('active');
  }

  renderFullCart() {
    if (!this.cartFullItemsList) return;
    const cart = window.storeDB.getCart();
    const { total, count } = window.storeDB.getCartTotal();

    if (cart.length === 0) {
      this.cartFullItemsList.innerHTML = `
        <div style="text-align:center; padding: 40px 10px;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: #f8fafc; border: 1px solid #edf2f7; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.8"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          </div>
          <h3 style="font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">Your cart is waiting</h3>
          <p style="font-size: 13px; color: #64748b; margin-bottom: 20px;">Discover fresh snacks and beverages in the store.</p>
          <button onclick="window.customerApp.switchScreen('screen-catalog')" 
                  style="background: #000; color: #fff; border:none; padding: 10px 24px; border-radius: 20px; font-weight: 700; cursor: pointer;">
            Start Shopping
          </button>
        </div>
      `;
      if (this.cartFullSubtotal) this.cartFullSubtotal.innerText = '₹0';
      if (this.cartFullTotal) this.cartFullTotal.innerText = '₹0';
      if (this.cartPayBtn) {
        this.cartPayBtn.style.display = 'none';
      }
      return;
    }

    if (this.cartPayBtn) {
      this.cartPayBtn.style.display = 'flex';
      this.cartPayBtn.innerHTML = `PAY ₹${total} <span style="font-size: 16px;">→</span>`;
    }

    if (this.cartFullSubtotal) this.cartFullSubtotal.innerText = `₹${total}`;
    if (this.cartFullTotal) this.cartFullTotal.innerText = `₹${total}`;

    this.cartFullItemsList.innerHTML = cart.map(item => {
      const itemImg = window.resolveProductImage ? window.resolveProductImage(item.image, item.id) : (item.image || 'assets/lays.jpg');
      return `
      <div class="cart-item-card">
        <div class="cart-item-card-left">
          <div class="cart-item-card-thumb">
            <img src="${itemImg}" alt="${item.name}" onerror="this.onerror=null;this.src='assets/lays.jpg';" />
          </div>
          <div class="cart-item-card-meta">
            <h4>${item.name}</h4>
            <p>₹${item.price} each</p>
          </div>
        </div>
        <div class="cart-item-card-right" style="display: flex; align-items: center; gap: 8px;">
          <div class="cart-qty-pill">
            <button class="cart-qty-btn minus" onclick="window.reduceCartItem('${item.id}')" title="Reduce quantity">
              −
            </button>
            <span class="cart-qty-val">${item.qty}</span>
            <button class="cart-qty-btn plus" onclick="window.increaseCartItem('${item.id}')" title="Add one more">
              +
            </button>
          </div>
          <button class="cart-del-btn" onclick="window.removeCartItem('${item.id}')" title="Remove from tray" style="width: 32px; height: 32px; border-radius: 8px; border: 1px solid #fee2e2; background: #fff1f2; color: #dc2626; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
          <div class="cart-item-card-price" style="min-width: 50px; text-align: right;">₹${item.price * item.qty}</div>
        </div>
      </div>
    `;
    }).join('');
  }

  confirmPayment(method = 'UPI') {
    if (method.includes('Cashfree') || method === 'UPI') {
      const payModal = document.getElementById('payment-modal');
      if (payModal) payModal.classList.remove('active');
      this.toggleCartDrawer(false);
      window.cashfreeClient.initiatePayment();
      return;
    }

    const { total } = window.storeDB.getCartTotal();
    if (total <= 0) return;
    const cart = window.storeDB.getCart();

    const newOrder = {
      id: `HS${Date.now().toString().slice(-6)}`,
      amount: total,
      itemCount: cart.reduce((s, i) => s + i.qty, 0),
      items: JSON.parse(JSON.stringify(cart)),
      status: 'Paid',
      payment_method: method
    };

    const confirmed = window.storeDB.recordConfirmedOrder(newOrder);
    this.showVerifiedScreen(confirmed);
  }

  showVerifiedScreen(order) {
    if (!order) return;

    const payModal = document.getElementById('payment-modal');
    if (payModal) payModal.classList.remove('active');
    this.toggleCartDrawer(false);

    // Populate Verified Screen (Matches media_1788895850084.jpg)
    const verifiedAmount = document.getElementById('verified-amount-val');
    const verifiedOrderNo = document.getElementById('verified-order-no');
    const verifiedItemsList = document.getElementById('verified-items-list-container');

    if (verifiedAmount) verifiedAmount.innerText = `₹${order.amount}`;
    if (verifiedOrderNo) verifiedOrderNo.innerText = `#${order.id}`;

    if (verifiedItemsList && Array.isArray(order.items)) {
      verifiedItemsList.innerHTML = order.items.map(item => `
        <div class="verified-item-row">
          <span>${item.name}</span>
          <span class="verified-item-qty">x${item.qty}</span>
        </div>
      `).join('');
    }

    this.switchScreen('screen-verified');
    this.playSuccessTone();
    this.updateCartUI();
    this.renderCatalog();
    this.renderFullCart();
    this.renderOrders();
  }


  viewReceipt(orderId) {
    const userOrders = window.storeDB.getUserOrders ? window.storeDB.getUserOrders() : [];
    const adminOrders = window.storeDB.getAdminOrders ? window.storeDB.getAdminOrders() : [];
    const order = userOrders.find(o => o.id === orderId) || adminOrders.find(o => o.id === orderId);
    if (!order) return;

    const receiptModal = document.getElementById('receipt-modal');
    const receiptContent = document.getElementById('receipt-modal-body');

    if (receiptContent) {
      const isPaid = order.status === 'PAID' || order.status === 'Paid' || order.paymentStatus === 'PAID';
      receiptContent.innerHTML = `
        <div style="text-align: center; margin-bottom: 16px;">
          <div style="font-size: 13px; color: #64748b;">${order.timeLabel}</div>
          <h3 style="font-size: 20px; font-weight: 800; margin: 4px 0;">Order #${order.orderNumber || order.id}</h3>
          <span class="badge-paid" style="display:inline-flex; margin-top: 4px; ${isPaid ? 'background:#e6fcf5;color:#0ca678;' : 'background:#fee2e2;color:#dc2626;'}">
            ${isPaid ? '✓ Verified Honor Payment' : '⏳ Status: ' + order.status}
          </span>
        </div>
        <div style="border-top: 1px dashed #cbd5e1; border-bottom: 1px dashed #cbd5e1; padding: 14px 0; margin: 14px 0;">
          ${(order.items || []).map(item => `
            <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px;">
              <span>${item.qty}x ${item.name} (${item.price ? '₹' + item.price : ''})</span>
              <span style="font-weight: 700;">₹${item.itemTotal || (item.price * item.qty)}</span>
            </div>
          `).join('')}
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 17px; font-weight: 800;">
          <span>Total Paid</span>
          <span>₹${order.amount}</span>
        </div>
        <div style="margin-top: 14px; font-size: 12px; color: #475569; background: #f8fafc; border-radius: 8px; padding: 10px; line-height: 1.6; border: 1px solid #f1f5f9; text-align: left;">
          <div><strong>Payment Method:</strong> ${order.paymentMethod || 'Cashfree UPI'}</div>
          ${order.paymentReference ? `<div><strong>Reference / Payment ID:</strong> ${order.paymentReference}</div>` : ''}
          ${order.paidAt ? `<div><strong>Paid At:</strong> ${new Date(order.paidAt).toLocaleString('en-IN')}</div>` : ''}
          <div><strong>Order Status:</strong> ${order.orderStatus || 'COMPLETED'}</div>
        </div>
        <div style="text-align: center; font-size: 11px; color: #64748b; margin-top: 16px;">
          "Take what you need. Pay what you take."<br/>Thank you for your honesty!
        </div>
      `;
    }
    if (receiptModal) receiptModal.classList.add('active');
  }

  openScannerModal() {
    const scannerModal = document.getElementById('scanner-modal');
    if (scannerModal) scannerModal.classList.add('active');
    this.startScannerCamera();
  }

  closeScannerModal() {
    const scannerModal = document.getElementById('scanner-modal');
    if (scannerModal) scannerModal.classList.remove('active');
    this.stopScannerCamera();
  }

  async startScannerCamera() {
    const video = document.getElementById('scanner-video');
    const fallback = document.getElementById('scanner-fallback-msg');
    if (!video) return;
    if (fallback) fallback.style.display = 'none';

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } }
        });
        this.scannerStream = stream;
        video.srcObject = stream;
        video.play().catch(() => {});
      } else {
        if (fallback) fallback.style.display = 'block';
      }
    } catch (e) {
      console.warn('[Scanner] Camera access not available:', e);
      if (fallback) fallback.style.display = 'block';
    }
  }

  stopScannerCamera() {
    if (this.scannerStream) {
      try {
        this.scannerStream.getTracks().forEach(t => t.stop());
      } catch (e) {}
      this.scannerStream = null;
    }
    const video = document.getElementById('scanner-video');
    if (video) video.srcObject = null;
  }


  playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch(e) {}
  }

  playSuccessTone() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + idx * 0.08 + 0.2);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.22);
      });
    } catch(e) {}
  }
}

window.CustomerApp = CustomerApp;

// Global Cart Actions
window.reduceCartItem = function(productId) {
  if (window.customerApp) {
    window.customerApp.reduceCartItem(productId);
  } else if (window.storeDB) {
    window.storeDB.updateCartQty(productId, -1);
  }
};

window.increaseCartItem = function(productId) {
  if (window.customerApp) {
    window.customerApp.addToCart(productId);
  } else if (window.storeDB) {
    window.storeDB.addToCart(productId);
  }
};

window.removeCartItem = function(productId) {
  if (window.customerApp) {
    window.customerApp.removeCartItem(productId);
  } else if (window.storeDB) {
    window.storeDB.updateCartQty(productId, -999);
  }
};

window.clearTray = function() {
  if (window.storeDB) {
    window.storeDB.clearCart();
  }
  if (window.customerApp) {
    window.customerApp.updateCartUI();
    window.customerApp.renderCatalog();
    window.customerApp.renderFullCart();
  }
};
