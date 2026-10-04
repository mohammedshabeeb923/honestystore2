/**
 * Honesty Store - Supabase Google OAuth Authentication Module
 * Manages user sessions, Google OAuth sign-in, RLS identity, and Admin authorization.
 */

class AuthManager {
  constructor() {
    this.user = null;
    this.session = null;
    this.isLoggedIn = false;
    this.isAdminUser = false;
    this.authCallback = null;
    this.isInitialized = false;

    // Immediately restore persistent session from localStorage for instant, zero-flicker UI
    this.restorePersistentSession();

    this.init();
  }

  restorePersistentSession() {
    try {
      const cached = JSON.parse(localStorage.getItem('honesty_customer_user') || 'null');
      const savedPhone = (localStorage.getItem('honesty_customer_phone') || (cached ? cached.phone : '') || '').replace(/\D/g, '').slice(-10);
      const savedEmail = (localStorage.getItem('honesty_customer_email') || (cached ? cached.email : '') || '').trim().toLowerCase();
      const savedName = localStorage.getItem('honesty_customer_name') || (cached ? cached.fullName : '') || '';
      const hasAdminAuth = localStorage.getItem('honesty_admin_auth') === 'true' && Boolean(localStorage.getItem('honesty_admin_token'));
      this.isAdminUser = hasAdminAuth;

      const validPhone = Boolean(savedPhone && /^[6-9]\d{9}$/.test(savedPhone));
      const validEmail = Boolean(savedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(savedEmail));

      if (validPhone && validEmail) {
        let cleanName = savedName || savedEmail.split('@')[0];
        if (cleanName.toLowerCase().includes('honesty') || cleanName.toLowerCase().includes('shopper')) {
          cleanName = savedEmail.split('@')[0];
        }

        this.user = {
          id: (cached && cached.id && !cached.id.startsWith('guest_')) ? cached.id : ('cust_' + savedPhone),
          email: savedEmail,
          fullName: cleanName,
          avatarUrl: (cached && cached.avatarUrl) || 'assets/avatar.png',
          phone: savedPhone
        };
        this.isLoggedIn = true;
        console.log('[AuthManager] Restored verified customer session for:', this.user.fullName, `(${this.user.email}, +91 ${this.user.phone})`);
      } else {
        // No guest or unverified sessions allowed per store policy
        this.user = null;
        this.isLoggedIn = false;
        localStorage.removeItem('honesty_customer_user');
      }
    } catch (e) {
      console.warn('[AuthManager] Session restore warning:', e);
    }
  }

  async init() {
    // Wait for Supabase Client SDK
    this.pollForSupabase();
  }

  pollForSupabase(attempts = 0) {
    if (window.supabaseClient && window.supabaseClient.client) {
      this.setupAuthListener();
      this.checkCurrentSession();
      this.bindDOM();
    } else if (attempts < 30) {
      setTimeout(() => this.pollForSupabase(attempts + 1), 100);
    } else {
      console.warn('[AuthManager] Supabase Client could not be found after 3 seconds.');
      this.bindDOM();
    }
  }

  setupAuthListener() {
    if (!window.supabaseClient || !window.supabaseClient.client) return;

    window.supabaseClient.onAuthStateChange(async (event, session) => {
      console.log('[AuthManager] Supabase Auth State Change:', event, session?.user?.email);
      this.session = session;
      if (session && session.user) {
        await this.handleUserSignedIn(session.user);
      } else if (event === 'SIGNED_OUT') {
        this.handleUserSignedOut();
      }
    });
  }

  async checkCurrentSession() {
    if (!window.supabaseClient) return;
    try {
      const session = await window.supabaseClient.getSession();
      if (session && session.user) {
        this.session = session;
        await this.handleUserSignedIn(session.user);
      }
    } catch (e) {
      console.warn('[AuthManager] Error checking current session:', e);
    } finally {
      this.isInitialized = true;
    }
  }

  async handleUserSignedIn(authUser) {
    const meta = authUser.user_metadata || {};
    let fullName = meta.full_name || meta.name || '';
    if (!fullName || fullName.toLowerCase().includes('honesty') || fullName.toLowerCase().includes('shopper')) {
      if (authUser.email) {
        fullName = authUser.email.split('@')[0];
      }
    }
    const avatarUrl = meta.avatar_url || meta.picture || 'assets/avatar.png';
    const savedPhone = (localStorage.getItem('honesty_customer_phone') || authUser.phone || meta.phone || '').replace(/\D/g, '').slice(-10);
    const validPhone = Boolean(savedPhone && /^[6-9]\d{9}$/.test(savedPhone));
    const email = (authUser.email || '').trim().toLowerCase();

    this.user = {
      id: authUser.id,
      email: email,
      fullName: fullName || (email ? email.split('@')[0] : 'Customer'),
      avatarUrl,
      phone: validPhone ? savedPhone : ''
    };

    if (validPhone && email) {
      this.isLoggedIn = true;
      try {
        localStorage.setItem('honesty_customer_user', JSON.stringify(this.user));
        if (this.user.fullName) localStorage.setItem('honesty_customer_name', this.user.fullName);
        if (this.user.email) localStorage.setItem('honesty_customer_email', this.user.email);
        localStorage.setItem('honesty_customer_phone', savedPhone);
      } catch (e) {}

      // Verify Admin Status
      this.isAdminUser = await window.supabaseClient.checkIsAdmin(authUser);
      if (this.isAdminUser) {
        localStorage.setItem('honesty_admin_auth', 'true');
      } else {
        localStorage.removeItem('honesty_admin_auth');
        localStorage.removeItem('honesty_admin_token');
      }

      this.updateUI();

      // Trigger user-specific order load in storeDB
      if (window.storeDB && typeof window.storeDB.loadUserOrders === 'function') {
        window.storeDB.loadUserOrders(authUser.id);
      }

      this.closeAuthModal();

      // Auto-advance screen from splash when customer signs in
      if (window.customerApp && window.customerApp.currentScreen === 'screen-splash') {
        window.customerApp.switchScreen('screen-catalog');
      }

      // Execute callback if pending
      if (typeof this.authCallback === 'function') {
        const cb = this.authCallback;
        this.authCallback = null;
        cb(this.user);
      }
    } else {
      // Missing compulsory phone number! Prompt customer to provide phone number to enter store
      this.isLoggedIn = false;
      this.openAuthModal();
      const phoneInput = document.getElementById('signin-customer-phone');
      const emailInput = document.getElementById('signin-customer-email');
      const nameInput = document.getElementById('signin-customer-name');
      const errLogin = document.getElementById('login-error-msg');
      if (emailInput) emailInput.value = email;
      if (nameInput) nameInput.value = fullName;
      if (errLogin) {
        errLogin.innerText = 'Google account verified! Please enter your 10-digit mobile number (compulsory) to enter the store.';
        errLogin.style.display = 'block';
        errLogin.style.color = '#2563eb';
        errLogin.style.background = '#eff6ff';
        errLogin.style.borderColor = '#bfdbfe';
      }
      if (phoneInput) setTimeout(() => phoneInput.focus(), 150);
    }
  }

  handleUserSignedOut() {
    this.isLoggedIn = false;
    this.isAdminUser = false;
    this.user = null;
    this.session = null;
    localStorage.removeItem('honesty_customer_user');
    localStorage.removeItem('honesty_customer_token');
    localStorage.removeItem('honesty_customer_phone');
    localStorage.removeItem('honesty_customer_email');
    localStorage.removeItem('honesty_customer_name');
    localStorage.removeItem('honesty_admin_auth');
    localStorage.removeItem('honesty_admin_token');

    this.updateUI();

    // Clear user-specific orders
    if (window.storeDB && typeof window.storeDB.clearUserOrders === 'function') {
      window.storeDB.clearUserOrders();
    }
  }

  // ============================================================
  // AUTH ACTIONS: GOOGLE LOGIN, LOGOUT
  // ============================================================

  async loginWithGoogle() {
    const errEl = document.getElementById('login-error-msg');
    const btnSubmit = document.getElementById('btn-google-signin');

    if (errEl) errEl.style.display = 'none';
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.style.opacity = '0.7';
    }

    try {
      if (!window.supabaseClient || !window.supabaseClient.isConnected) {
        throw new Error('Supabase is not connected. Please check configuration.');
      }
      await window.supabaseClient.signInWithGoogle();
    } catch (err) {
      console.error('[AuthManager] Google Sign In Failed:', err);
      const msg = err.message && err.message.toLowerCase().includes('provider')
        ? 'Google Sign-In is not enabled yet in your Supabase Dashboard. Please enable the Google provider under Authentication > Providers in Supabase.'
        : (err.message || 'Could not initiate Google sign in. Please try again.');
      
      if (errEl) {
        errEl.innerText = msg;
        errEl.style.display = 'block';
      } else if (window.showToast) {
        window.showToast(msg, 'error');
      }
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.style.opacity = '1';
      }
    }
  }

  async adminLoginWithGoogle() {
    const errEl = document.getElementById('admin-login-error');
    const btnSubmit = document.getElementById('btn-admin-google-signin');

    if (errEl) errEl.style.display = 'none';

    // If already logged in, check if current user is admin
    if (this.isLoggedIn && this.user) {
      const isAuthAdmin = await window.supabaseClient.checkIsAdmin(this.user);
      if (isAuthAdmin) {
        this.isAdminUser = true;
        localStorage.setItem('honesty_admin_auth', 'true');
        const modal = document.getElementById('admin-auth-modal');
        if (modal) modal.classList.remove('active');
        if (window.adminApp && typeof window.adminApp.render === 'function') {
          window.adminApp.render();
        }
        if (window.showToast) window.showToast('Welcome to Admin Console.', 'success');
        return;
      } else {
        this.isAdminUser = false;
        localStorage.removeItem('honesty_admin_auth');
        localStorage.removeItem('honesty_admin_token');
        if (errEl) {
          errEl.innerHTML = '<strong>Access Denied:</strong> This Google account does not have administrator privileges.';
          errEl.style.display = 'block';
        }
        return;
      }
    }

    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.style.opacity = '0.7';
    }

    try {
      await window.supabaseClient.signInWithGoogle();
    } catch (err) {
      console.error('[AuthManager] Admin Google Sign In Failed:', err);
      if (errEl) {
        errEl.innerText = err.message || 'Google sign in failed.';
        errEl.style.display = 'block';
      }
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.style.opacity = '1';
      }
    }
  }

  async verifyAdminEmail(email) {
    const errEl = document.getElementById('admin-login-error');
    const btnSubmit = document.getElementById('btn-verify-admin-email');

    if (errEl) errEl.style.display = 'none';
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      if (errEl) {
        errEl.innerText = 'Please enter a valid Gmail address.';
        errEl.style.display = 'block';
      }
      return;
    }

    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerText = 'Verifying authorization...';
      btnSubmit.style.opacity = '0.7';
    }

    try {
      const res = await fetch('/api/admin/verify-admin-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });
      const data = await res.json();
      if (res.ok && data.success && data.adminToken) {
        localStorage.setItem('honesty_admin_token', data.adminToken);
        localStorage.setItem('honesty_admin_auth', 'true');
        this.isAdminUser = true;

        const modal = document.getElementById('admin-auth-modal');
        if (modal) modal.classList.remove('active');

        if (window.setViewMode) {
          window.setViewMode('admin');
        } else {
          const stage = document.getElementById('master-stage');
          if (stage) stage.className = 'master-stage mode-admin';
          document.querySelectorAll('.view-btn').forEach(btn => {
            if (btn.dataset.mode === 'admin') btn.classList.add('active');
            else btn.classList.remove('active');
          });
          localStorage.setItem('honesty_store_view_mode', 'admin');
        }

        if (window.storeDB && typeof window.storeDB.loadAdminOrders === 'function') {
          window.storeDB.loadAdminOrders();
        }
        if (window.adminApp && typeof window.adminApp.render === 'function') {
          window.adminApp.render();
        }
        if (window.showToast) {
          window.showToast('Administrator access verified.', 'success');
        }
      } else {
        throw new Error(data.message || 'Access Denied: This account is not authorized for administrator access.');
      }
    } catch (err) {
      if (errEl) {
        errEl.innerHTML = `<strong>Access Denied:</strong> ${err.message}`;
        errEl.style.display = 'block';
      }
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerText = 'Verify & Access Admin Console';
        btnSubmit.style.opacity = '1';
      }
    }
  }

  loginAsGuest() {
    // Guest login is strictly disabled per store policy - must provide Gmail & Phone
    this.openAuthModal();
  }

  async logout() {
    try {
      if (window.supabaseClient) {
        await window.supabaseClient.signOut();
      }
    } catch (e) {
      console.warn('[AuthManager] Sign out exception:', e);
    }
    this.handleUserSignedOut();
    this.closeAuthModal();

    if (window.showToast) {
      window.showToast('You have been signed out.', 'info');
    }

    // Return to splash welcome view if in customer app
    if (window.customerApp && typeof window.customerApp.switchScreen === 'function') {
      window.customerApp.switchScreen('screen-splash');
    }
  }

  // ============================================================
  // UI & MODAL MANAGEMENT
  // ============================================================

  openAuthModal(options = {}) {
    this.authCallback = options.onSuccess || null;
    const modal = document.getElementById('auth-modal');
    if (!modal) return;

    const signinView = document.getElementById('auth-view-signin');
    const profileView = document.getElementById('auth-step-profile');
    const errLogin = document.getElementById('login-error-msg');
    if (errLogin) errLogin.style.display = 'none';

    if (this.isLoggedIn && this.hasMandatoryCustomerDetails()) {
      if (signinView) signinView.style.display = 'none';
      if (profileView) profileView.style.display = 'block';

      const profName = document.getElementById('profile-modal-name');
      const profEmail = document.getElementById('profile-modal-email');
      const profAvatar = document.getElementById('profile-modal-avatar');

      if (profName) profName.innerText = this.user.fullName;
      if (profEmail) profEmail.innerText = this.user.email;
      if (profAvatar && this.user.avatarUrl) profAvatar.src = this.user.avatarUrl;

      const phoneInput = document.getElementById('profile-phone-input');
      if (phoneInput) {
        phoneInput.value = this.getUserPhone();
      }
      const phoneMsg = document.getElementById('profile-phone-msg');
      if (phoneMsg) phoneMsg.style.display = 'none';

      const emailInput = document.getElementById('profile-email-input');
      if (emailInput) {
        emailInput.value = this.getUserEmail();
      }
      const emailMsg = document.getElementById('profile-email-msg');
      if (emailMsg) emailMsg.style.display = 'none';
    } else {
      if (signinView) signinView.style.display = 'block';
      if (profileView) profileView.style.display = 'none';

      const emailInput = document.getElementById('signin-customer-email');
      const phoneInput = document.getElementById('signin-customer-phone');
      const nameInput = document.getElementById('signin-customer-name');

      const savedEmail = this.getUserEmail();
      const savedPhone = this.getUserPhone();
      const savedName = this.getUserName();

      if (emailInput && savedEmail) emailInput.value = savedEmail;
      if (phoneInput && savedPhone) phoneInput.value = savedPhone;
      if (nameInput && savedName && !savedName.toLowerCase().includes('customer')) nameInput.value = savedName;

      setTimeout(() => {
        if (emailInput && !emailInput.value) emailInput.focus();
        else if (phoneInput && !phoneInput.value) phoneInput.focus();
      }, 150);
    }

    this.updateUI();
    modal.classList.add('active');
  }

  closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('active');
  }

  updateUI() {
    // 1. Status dot in header
    const dot = document.getElementById('auth-status-dot');
    if (dot) {
      if (this.isLoggedIn) {
        dot.style.background = '#10b981';
        dot.title = `Signed in as ${this.user?.fullName} (${this.user?.email})`;
      } else {
        dot.style.background = '#94a3b8';
        dot.title = 'Not signed in. Click to authenticate with Google.';
      }
    }

    // 2. Header Avatars
    const avatarImgs = document.querySelectorAll('.header-avatar img, .cart-avatar-wrap img');
    avatarImgs.forEach(img => {
      if (this.isLoggedIn && this.user?.avatarUrl && !this.user.avatarUrl.includes('assets/avatar.png')) {
        img.src = this.user.avatarUrl;
      }
    });

    // 3. User status badges
    const statusBadges = document.querySelectorAll('.auth-user-status');
    statusBadges.forEach(el => {
      if (this.isLoggedIn) {
        el.innerText = this.user?.fullName || this.user?.email || 'Customer';
        el.title = `Signed in as ${this.user?.email}`;
      } else {
        el.innerText = 'Sign In';
      }
    });

    // 4. Phone status badge in profile view
    const phoneBadge = document.getElementById('profile-phone-status-badge');
    if (phoneBadge) {
      const phone = this.getUserPhone();
      const isValid = Boolean(phone && /^[6-9]\d{9}$/.test(phone));
      if (isValid) {
        phoneBadge.style.background = '#dcfce7';
        phoneBadge.style.color = '#15803d';
        phoneBadge.innerText = '✓ Verified Ready';
      } else {
        phoneBadge.style.background = '#fee2e2';
        phoneBadge.style.color = '#b91c1c';
        phoneBadge.innerText = '⚠️ Compulsory';
      }
    }

    // 5. Email status badge in profile view
    const emailBadge = document.getElementById('profile-email-status-badge');
    if (emailBadge) {
      const email = this.getUserEmail();
      const isValid = Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
      if (isValid) {
        emailBadge.style.background = '#dcfce7';
        emailBadge.style.color = '#15803d';
        emailBadge.innerText = '✓ Verified Ready';
      } else {
        emailBadge.style.background = '#fee2e2';
        emailBadge.style.color = '#b91c1c';
        emailBadge.innerText = '⚠️ Compulsory';
      }
    }
  }

  bindDOM() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.bindDOM());
      return;
    }

    // Header avatar clicks
    const avatarBtns = document.querySelectorAll('.header-avatar, .cart-avatar-wrap');
    avatarBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.openAuthModal();
      });
    });

    // Google Sign-In button
    const btnGoogle = document.getElementById('btn-google-signin');
    if (btnGoogle) {
      btnGoogle.addEventListener('click', () => {
        this.loginWithGoogle();
      });
    }

    // Customer sign-in/sign-up form (Compulsory Gmail + Phone)
    const customerSigninForm = document.getElementById('customer-signin-form');
    if (customerSigninForm) {
      customerSigninForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = document.getElementById('login-error-msg');
        if (errEl) {
          errEl.style.display = 'none';
          errEl.innerText = '';
        }

        const emailInput = document.getElementById('signin-customer-email');
        const phoneInput = document.getElementById('signin-customer-phone');
        const nameInput = document.getElementById('signin-customer-name');
        const submitBtn = document.getElementById('btn-customer-signin-submit');

        const rawEmail = (emailInput?.value || '').trim();
        const rawPhone = (phoneInput?.value || '').trim();
        const rawName = (nameInput?.value || '').trim();

        // 1. Validate compulsory Gmail / Email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!rawEmail || !emailRegex.test(rawEmail)) {
          if (errEl) {
            errEl.innerText = 'Please enter a valid Gmail ID / Email Address (e.g. rahul@gmail.com).';
            errEl.style.display = 'block';
            errEl.style.color = '#ef4444';
            errEl.style.background = '#fef2f2';
            errEl.style.borderColor = '#fee2e2';
          }
          if (emailInput) emailInput.focus();
          return;
        }

        // 2. Validate compulsory 10-digit Indian Mobile Number
        const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);
        if (!cleanPhone || !/^[6-9]\d{9}$/.test(cleanPhone)) {
          if (errEl) {
            errEl.innerText = 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.';
            errEl.style.display = 'block';
            errEl.style.color = '#ef4444';
            errEl.style.background = '#fef2f2';
            errEl.style.borderColor = '#fee2e2';
          }
          if (phoneInput) phoneInput.focus();
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span>Entering Store...</span>';
        }

        try {
          this.setCustomerDetails(cleanPhone, rawEmail, rawName);
          this.isLoggedIn = true;

          // Sync customer profile with backend API
          try {
            const resp = await fetch('/api/customer/quick-auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                phone: cleanPhone,
                email: rawEmail.toLowerCase(),
                fullName: this.getUserName()
              })
            });
            const data = await resp.json();
            if (data?.token) {
              localStorage.setItem('honesty_customer_token', data.token);
            }
          } catch (netErr) {
            console.warn('[AuthManager] Quick-auth API network sync warning:', netErr);
          }

          this.updateUI();
          this.closeAuthModal();

          if (window.showToast) {
            window.showToast(`Welcome to Honesty Store, ${this.getUserName()}!`, 'success');
          }

          if (typeof this.authCallback === 'function') {
            const cb = this.authCallback;
            this.authCallback = null;
            cb();
          } else if (window.customerApp && typeof window.customerApp.switchScreen === 'function') {
            window.customerApp.switchScreen('screen-catalog');
          }
        } catch (err) {
          console.error('[AuthManager] Signin submission error:', err);
          if (errEl) {
            errEl.innerText = err.message || 'Failed to complete sign in. Please verify your details.';
            errEl.style.display = 'block';
            errEl.style.color = '#ef4444';
            errEl.style.background = '#fef2f2';
            errEl.style.borderColor = '#fee2e2';
          }
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Continue &amp; Enter Store &rarr;</span>';
          }
        }
      });
    }

    // Admin Google Sign-In button
    const btnAdminGoogle = document.getElementById('btn-admin-google-signin');
    if (btnAdminGoogle) {
      btnAdminGoogle.addEventListener('click', () => {
        this.adminLoginWithGoogle();
      });
    }

    // Admin email verify form
    const adminEmailForm = document.getElementById('admin-email-verify-form');
    const adminEmailInput = document.getElementById('admin-verify-email-input');
    if (adminEmailForm && adminEmailInput) {
      adminEmailForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = adminEmailInput.value.trim();
        await this.verifyAdminEmail(email);
      });
    }

    // Save phone number inside profile modal
    const btnSavePhone = document.getElementById('btn-save-profile-phone');
    const phoneInput = document.getElementById('profile-phone-input');
    const phoneMsg = document.getElementById('profile-phone-msg');

    if (btnSavePhone && phoneInput) {
      btnSavePhone.addEventListener('click', () => {
        const val = phoneInput.value.trim();
        try {
          const saved = this.setUserPhone(val);
          if (phoneMsg) {
            phoneMsg.style.color = '#16a34a';
            phoneMsg.innerText = `✓ Saved mobile number: +91 ${saved}`;
            phoneMsg.style.display = 'block';
          }
          if (window.showToast) window.showToast(`Phone number +91 ${saved} saved.`, 'success');
        } catch (err) {
          if (phoneMsg) {
            phoneMsg.style.color = '#dc2626';
            phoneMsg.innerText = err.message;
            phoneMsg.style.display = 'block';
          }
        }
      });
    }

    // Save email inside profile modal
    const btnSaveEmail = document.getElementById('btn-save-profile-email');
    const emailInput = document.getElementById('profile-email-input');
    const emailMsg = document.getElementById('profile-email-msg');

    if (btnSaveEmail && emailInput) {
      btnSaveEmail.addEventListener('click', () => {
        const val = emailInput.value.trim();
        try {
          const saved = this.setUserEmail(val);
          if (emailMsg) {
            emailMsg.style.color = '#16a34a';
            emailMsg.innerText = `✓ Saved Email ID: ${saved}`;
            emailMsg.style.display = 'block';
          }
          if (window.showToast) window.showToast(`Email ID ${saved} saved.`, 'success');
        } catch (err) {
          if (emailMsg) {
            emailMsg.style.color = '#dc2626';
            emailMsg.innerText = err.message;
            emailMsg.style.display = 'block';
          }
        }
      });
    }

    // Sign out button in profile view
    const btnLogout = document.getElementById('btn-auth-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        this.logout();
      });
    }
  }

  // ============================================================
  // GETTERS & SETTERS
  // ============================================================

  getUserId() {
    return this.user?.id || null;
  }

  getUserEmail() {
    return this.user?.email || localStorage.getItem('honesty_customer_email') || '';
  }

  getUserName() {
    if (this.user?.fullName && !this.user.fullName.toLowerCase().includes('honesty') && !this.user.fullName.toLowerCase().includes('shopper')) {
      return this.user.fullName.trim();
    }
    if (this.user?.email) {
      return this.user.email.split('@')[0].trim();
    }
    const savedName = localStorage.getItem('honesty_customer_name');
    if (savedName && !savedName.toLowerCase().includes('honesty') && !savedName.toLowerCase().includes('shopper')) {
      return savedName.trim();
    }
    const savedEmail = localStorage.getItem('honesty_customer_email');
    if (savedEmail) {
      return savedEmail.split('@')[0].trim();
    }
    const phone = this.getUserPhone();
    if (phone) {
      return `Customer ${phone}`;
    }
    return '';
  }

  getUserPhone() {
    return this.user?.phone || localStorage.getItem('honesty_customer_phone') || '';
  }

  hasValidPhone() {
    const ph = this.getUserPhone();
    const clean = String(ph || '').replace(/\D/g, '').slice(-10);
    return Boolean(clean && /^[6-9]\d{9}$/.test(clean));
  }

  hasValidEmail() {
    const em = (this.getUserEmail() || '').trim().toLowerCase();
    return Boolean(em && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em));
  }

  hasMandatoryCustomerDetails() {
    return this.hasValidPhone() && this.hasValidEmail();
  }

  setCustomerDetails(phone, emailOrName = '', optionalNameOrEmail = '') {
    const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);
    if (!cleanPhone || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      throw new Error('A valid 10-digit Indian mobile number (starting with 6, 7, 8, or 9) is compulsory.');
    }

    let resolvedEmail = '';
    let resolvedName = '';

    const arg1 = String(emailOrName || '').trim();
    const arg2 = String(optionalNameOrEmail || '').trim();

    if (arg1.includes('@')) {
      resolvedEmail = arg1.toLowerCase();
      resolvedName = arg2;
    } else if (arg2.includes('@')) {
      resolvedEmail = arg2.toLowerCase();
      resolvedName = arg1;
    } else {
      resolvedName = arg1;
      resolvedEmail = (this.getUserEmail() || '').trim().toLowerCase();
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!resolvedEmail || !emailRegex.test(resolvedEmail)) {
      throw new Error('A valid Email ID (e.g. yourname@gmail.com) is compulsory.');
    }

    if (!resolvedName || resolvedName.toLowerCase().includes('honesty') || resolvedName.toLowerCase().includes('shopper')) {
      const emailUser = resolvedEmail.split('@')[0];
      resolvedName = emailUser.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim() || emailUser;
    }

    if (this.user) {
      this.user.phone = cleanPhone;
      this.user.email = resolvedEmail;
      this.user.fullName = resolvedName;
    } else {
      this.user = {
        id: 'cust_' + cleanPhone,
        email: resolvedEmail,
        fullName: resolvedName,
        phone: cleanPhone
      };
    }
    this.isLoggedIn = true;

    try {
      localStorage.setItem('honesty_customer_user', JSON.stringify(this.user));
      localStorage.setItem('honesty_customer_phone', cleanPhone);
      localStorage.setItem('honesty_customer_email', resolvedEmail);
      localStorage.setItem('honesty_customer_name', resolvedName);
    } catch (e) {}

    // Sync phone with Supabase if logged in
    if (window.supabaseClient && window.supabaseClient.client && this.isLoggedIn) {
      window.supabaseClient.client.auth.updateUser({
        data: { phone: cleanPhone, full_name: resolvedName }
      }).catch(err => console.warn('[AuthManager] Supabase metadata sync warning:', err));
    }

    this.updateUI();
    return { phone: cleanPhone, email: resolvedEmail, name: resolvedName };
  }

  setUserPhone(phone) {
    const clean = String(phone || '').replace(/\D/g, '').slice(-10);
    if (!clean || !/^[6-9]\d{9}$/.test(clean)) {
      throw new Error('Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).');
    }

    const existingEmail = this.getUserEmail() || '';
    const existingName = this.getUserName() || `Customer ${clean}`;

    if (!existingEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(existingEmail)) {
      if (this.user) this.user.phone = clean;
      localStorage.setItem('honesty_customer_phone', clean);
      this.updateUI();
      return clean;
    }

    return this.setCustomerDetails(clean, existingEmail, existingName).phone;
  }

  setUserEmail(email) {
    const clean = String(email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!clean || !emailRegex.test(clean)) {
      throw new Error('Please enter a valid Email ID (e.g. yourname@gmail.com).');
    }

    const existingPhone = this.getUserPhone() || '';
    const existingName = this.getUserName() || clean.split('@')[0];

    if (!existingPhone || !/^[6-9]\d{9}$/.test(existingPhone.replace(/\D/g, '').slice(-10))) {
      if (this.user) this.user.email = clean;
      localStorage.setItem('honesty_customer_email', clean);
      this.updateUI();
      return clean;
    }

    return this.setCustomerDetails(existingPhone, clean, existingName).email;
  }

  getAccessToken() {
    return this.session?.access_token || localStorage.getItem('honesty_customer_token') || null;
  }

  isAuthenticated() {
    return Boolean(this.isLoggedIn && (this.user?.id || this.user?.email || this.user?.phone));
  }

  isAdmin() {
    const hasToken = Boolean(localStorage.getItem('honesty_admin_token'));
    const isAuth = localStorage.getItem('honesty_admin_auth') === 'true';
    return Boolean((this.isAdminUser || isAuth) && hasToken);
  }
}

window.authManager = new AuthManager();
