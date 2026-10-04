/**
 * Honesty Store - Cashfree Payment Gateway Client SDK Integration
 * Production UPI, Dynamic QR, Netbanking, and Card checkout
 */

class CashfreeClient {
  constructor() {
    this.sdkLoaded = false;
    this.cashfree = null;
    this.loadSDK();
  }

  loadSDK() {
    if (window.Cashfree) {
      this.initCashfree();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.async = true;
    script.onload = () => {
      this.initCashfree();
    };
    script.onerror = () => {
      console.warn('Cashfree SDK script failed to load from CDN.');
    };
    document.head.appendChild(script);
  }

  initCashfree() {
    try {
      const env = (window.AppConfig && window.AppConfig.cashfree && window.AppConfig.cashfree.environment) || 'PRODUCTION';
      const mode = env.toLowerCase() === 'production' ? 'production' : 'sandbox';
      if (typeof window.Cashfree === 'function') {
        this.cashfree = window.Cashfree({ mode });
        this.sdkLoaded = true;
        console.log('[Cashfree Client] SDK initialized in', mode, 'mode');
      }
    } catch (e) {
      console.warn('[Cashfree Client] Initialization warning:', e);
    }
  }

  async initiatePayment(orderData = {}) {
    const cart = window.storeDB.getCart();

    if (!cart || cart.length === 0) {
      if (window.showToast) window.showToast('Your tray is empty! Please add snacks or beverages before paying.', 'info');
      return;
    }

    const { total } = window.storeDB.getCartTotal();

    // Verify valid 10-digit Indian mobile number required by Cashfree PG & UPI
    const phone = window.authManager ? window.authManager.getUserPhone() : (localStorage.getItem('honesty_customer_phone') || '');
    const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);
    const isValidPhone = Boolean(cleanPhone && /^[6-9]\d{9}$/.test(cleanPhone));

    const email = (window.authManager ? window.authManager.getUserEmail() : (localStorage.getItem('honesty_customer_email') || '')).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValidEmail = Boolean(email && emailRegex.test(email));

    const customerName = window.authManager ? window.authManager.getUserName() : (localStorage.getItem('honesty_customer_name') || '');

    // BOTH Mobile Number and Email ID are strictly COMPULSORY
    if (!isValidPhone || !isValidEmail) {
      this.promptForCustomerDetails(orderData, total);
      return;
    }

    const orderId = orderData.id || `HS${Date.now().toString().slice(-6)}`;

    // Show loading indicator on Pay button
    const btnPay = document.getElementById('btn-cart-fullpage-pay');
    const originalText = btnPay ? btnPay.innerHTML : '';
    if (btnPay) {
      btnPay.innerText = 'Connecting to Cashfree Gateway...';
      btnPay.disabled = true;
    }

    try {
      // 1. Authoritative order initiation on backend with item validation & stock check
      const authToken = window.authManager ? window.authManager.getAccessToken() : '';
      const reqHeaders = { 'Content-Type': 'application/json' };
      if (authToken) {
        reqHeaders['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch('/api/create-cashfree-order', {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({
          orderId,
          items: cart.map(i => ({ id: i.id, qty: i.qty })),
          orderAmount: total,
          customerPhone: cleanPhone,
          customerEmail: email,
          customerName: customerName || email.split('@')[0],
          userId: window.authManager ? window.authManager.getUserId() : null
        })
      });

      const session = await response.json();

      if (!session.success) {
        throw new Error(session.error || 'Failed to initialize payment session');
      }

      // If Cashfree SDK is ready, launch standard Cashfree Checkout Modal
      if (session.paymentSessionId) {
        // Guarantee Cashfree SDK mode matches backend session environment exactly (prevents 'session invalid' error)
        const targetMode = (session.environment || 'PRODUCTION').toLowerCase() === 'production' ? 'production' : 'sandbox';
        if (typeof window.Cashfree === 'function') {
          this.cashfree = window.Cashfree({ mode: targetMode });
          this.sdkLoaded = true;
          console.log(`[Cashfree Client] Re-initialized SDK in ${targetMode} mode for session`);
        }

        if (this.cashfree) {
          const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
          const checkoutOptions = {
            paymentSessionId: session.paymentSessionId,
            redirectTarget: isMobile ? '_self' : '_modal'
          };

          this.cashfree.checkout(checkoutOptions).then(async (result) => {
            if (result && result.error) {
              console.warn('[Cashfree Checkout]:', result.error.message || 'Payment cancelled');
              // Even if there's a reported error, still verify server-side
              // (race condition: user may have paid right as modal closed)
            }
            // Always verify server-side — the webhook is the source of truth,
            // but this immediate check catches the case where webhook hasn't fired yet
            await this.verifyAndCompletePayment(orderId, session.orderAmount || total, cart);
          }).catch(cErr => {
            console.warn('[Cashfree Checkout Catch]:', cErr);
            // Still attempt verification on caught errors
            this.verifyAndCompletePayment(orderId, session.orderAmount || total, cart)
              .catch(vErr => console.warn('[Post-error verify]:', vErr));
          });
        } else {
          // If Cashfree JS SDK is blocked by browser, redirect to Cashfree checkout directly
          window.location.href = `https://payments.cashfree.com/order/#${session.paymentSessionId}`;
        }
      }
    } catch (err) {
      console.error('[Cashfree Checkout Error]:', err);
      if (window.showToast) window.showToast('Payment Notice: ' + err.message, 'error');
    } finally {
      if (btnPay) {
        btnPay.innerHTML = originalText || `PAY ₹${total} →`;
        btnPay.disabled = false;
      }
    }
  }

  async verifyAndCompletePayment(orderId, expectedAmount, fallbackItems) {
    try {
      const authToken = window.authManager ? window.authManager.getAccessToken() : '';
      const reqHeaders = { 'Content-Type': 'application/json' };
      if (authToken) {
        reqHeaders['Authorization'] = `Bearer ${authToken}`;
      }

      const verifyRes = await fetch('/api/verify-cashfree-order', {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({ orderId })
      });
      const verifyData = await verifyRes.json();

      if (verifyData.success && verifyData.isPaid) {
        this.handlePaymentSuccess(verifyData.order || {
          id: orderId,
          amount: expectedAmount,
          items: fallbackItems,
          status: 'Paid',
          payment_method: 'Cashfree UPI'
        });
      } else if (verifyData.orderStatus === 'FAILED') {
        if (window.showToast) window.showToast('Payment failed or was cancelled. No amount was charged.', 'error');
      } else {
        // Payment is processing — webhook will confirm it in the background
        if (window.showToast) window.showToast('Payment verification in progress. Checking again in 5 seconds...', 'info');
        // One retry after 5 seconds
        setTimeout(async () => {
          try {
            const r2 = await fetch('/api/verify-cashfree-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId })
            });
            const d2 = await r2.json();
            if (d2.success && d2.isPaid) {
              this.handlePaymentSuccess(d2.order || { id: orderId, amount: expectedAmount, items: fallbackItems, status: 'Paid', payment_method: 'Cashfree UPI' });
            } else {
              if (window.showToast) window.showToast('Payment processing. Check your order history in a moment.', 'info');
            }
          } catch(e) {
            console.warn('[Cashfree] Retry verify error:', e);
          }
        }, 5000);
      }
    } catch (vErr) {
      console.warn('[Cashfree Client] Verification error:', vErr);
      if (window.showToast) window.showToast('Could not verify payment status with server. Please check your order history.', 'error');
    }
  }

  handlePaymentSuccess(order) {
    // 1. Record confirmed order in store database
    const confirmed = window.storeDB.recordConfirmedOrder(order);

    // 2. Synchronize store with Supabase
    window.storeDB.syncWithServer();

    // 3. Show Verified Screen in Customer Mobile App
    if (window.customerApp) {
      window.customerApp.showVerifiedScreen(confirmed);
    }
  }

  promptForPhone(orderData, total) {
    return this.promptForCustomerDetails(orderData, total);
  }

  promptForCustomerDetails(orderData, total) {
    const modal = document.getElementById('phone-collection-modal');
    const form = document.getElementById('phone-collection-form');
    const inputPhone = document.getElementById('checkout-phone-input');
    const inputEmail = document.getElementById('checkout-email-input');
    const inputName = document.getElementById('checkout-name-input');
    const errEl = document.getElementById('phone-collection-error');
    const submitText = document.getElementById('phone-modal-submit-text');
    const btnCancel = document.getElementById('btn-cancel-phone-modal');

    if (!modal) {
      const promptedPhone = window.prompt('Compulsory: Please enter your 10-digit Indian mobile number for Cashfree & UPI:');
      const promptedEmail = window.prompt('Compulsory: Please enter your Email ID for receipt & payment tracking:');
      const cleanP = (promptedPhone || '').replace(/\D/g, '').slice(-10);
      const cleanE = (promptedEmail || '').trim().toLowerCase();
      if (/^[6-9]\d{9}$/.test(cleanP) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanE)) {
        if (window.authManager) window.authManager.setCustomerDetails(cleanP, cleanE);
        else {
          localStorage.setItem('honesty_customer_phone', cleanP);
          localStorage.setItem('honesty_customer_email', cleanE);
        }
        this.initiatePayment(orderData);
      }
      return;
    }

    if (inputPhone) {
      const existingPhone = window.authManager ? window.authManager.getUserPhone() : (localStorage.getItem('honesty_customer_phone') || '');
      inputPhone.value = existingPhone || '';
      if (!existingPhone) {
        setTimeout(() => inputPhone.focus(), 150);
      }
    }

    if (inputEmail) {
      const existingEmail = window.authManager ? window.authManager.getUserEmail() : (localStorage.getItem('honesty_customer_email') || '');
      inputEmail.value = existingEmail || '';
      if (inputPhone && inputPhone.value && !existingEmail) {
        setTimeout(() => inputEmail.focus(), 150);
      }
    }

    if (inputName) {
      const existingName = window.authManager ? window.authManager.getUserName() : (localStorage.getItem('honesty_customer_name') || '');
      if (existingName && !existingName.toLowerCase().includes('customer') && !existingName.toLowerCase().includes('honesty')) {
        inputName.value = existingName;
      }
    }

    if (errEl) errEl.style.display = 'none';
    if (submitText) submitText.innerText = `Confirm & Pay ₹${total} →`;

    if (btnCancel) {
      btnCancel.onclick = () => modal.classList.remove('active');
    }

    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        const rawPhone = inputPhone ? inputPhone.value.trim() : '';
        const rawEmail = inputEmail ? inputEmail.value.trim().toLowerCase() : '';
        const rawName = inputName ? inputName.value.trim() : '';
        const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);

        if (!cleanPhone || !/^[6-9]\d{9}$/.test(cleanPhone)) {
          if (errEl) {
            errEl.innerText = 'Mobile number is compulsory. Please enter a valid 10-digit Indian number starting with 6, 7, 8, or 9.';
            errEl.style.display = 'block';
          }
          if (inputPhone) inputPhone.focus();
          return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!rawEmail || !emailRegex.test(rawEmail)) {
          if (errEl) {
            errEl.innerText = 'Email ID is compulsory. Please enter a valid email address (e.g. rahul@gmail.com).';
            errEl.style.display = 'block';
          }
          if (inputEmail) inputEmail.focus();
          return;
        }

        try {
          if (window.authManager && typeof window.authManager.setCustomerDetails === 'function') {
            window.authManager.setCustomerDetails(cleanPhone, rawEmail, rawName);
          } else {
            localStorage.setItem('honesty_customer_phone', cleanPhone);
            localStorage.setItem('honesty_customer_email', rawEmail);
            if (rawName) {
              localStorage.setItem('honesty_customer_name', rawName);
            } else {
              localStorage.setItem('honesty_customer_name', rawEmail.split('@')[0]);
            }
          }
          modal.classList.remove('active');
          if (window.showToast) window.showToast('Customer details saved successfully.', 'success');
          // Resume payment seamlessly
          this.initiatePayment(orderData);
        } catch (err) {
          if (errEl) {
            errEl.innerText = err.message;
            errEl.style.display = 'block';
          }
        }
      };
    }

    modal.classList.add('active');
  }
}

window.cashfreeClient = new CashfreeClient();
