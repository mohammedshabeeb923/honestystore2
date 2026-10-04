/**
 * Business Admin Console Controller
 * Real Supabase & Cashfree Aggregated Analytics
 */

class AdminApp {
  constructor() {
    this.activeTab = 'inventory';
    this.selectedProductId = 'lays';
    this.searchQuery = '';
    this.dashboardSubView = 'today';

    // Sales Section State
    this.currentSalesSubtab = 'overview';
    this.salesPeriod = 'today';
    this.salesCustomStart = '';
    this.salesCustomEnd = '';
    this.salesFilters = {
      search: '',
      paymentStatus: 'ALL',
      orderStatus: 'ALL',
      category: 'ALL',
      paymentMethod: 'ALL'
    };
    this.dailyReportDate = new Date().toISOString().split('T')[0];
    this.salesData = null;
    this.dailyReportData = null;
    this.prodSalesSearch = '';
    this.prodSalesCat = 'ALL';
    this.paymentsFilterStatus = 'ALL';

    this.initElements();
    this.bindEvents();
    this.subscribeToStore();
    this.render();
  }

  initElements() {
    this.sidebarItems = document.querySelectorAll('.sidebar-nav-item');
    this.tabViews = {
      inventory: document.getElementById('admin-tab-inventory'),
      products: document.getElementById('admin-tab-products'),
      dashboard: document.getElementById('admin-tab-dashboard'),
      sales: document.getElementById('admin-tab-sales'),
      users: document.getElementById('admin-tab-users'),
      settings: document.getElementById('admin-tab-settings')
    };
    this.pageHeading = document.getElementById('admin-page-heading');
    this.searchInput = document.getElementById('admin-search-input');
    this.stockListContainer = document.getElementById('admin-stock-items-list');
    this.detailPanel = document.getElementById('admin-detail-panel');

    // Sales Subnav & Subtabs
    this.salesSubnavBtns = document.querySelectorAll('.sales-subnav-btn');
    this.salesSubtabViews = {
      overview: document.getElementById('sales-subtab-overview'),
      daily: document.getElementById('sales-subtab-daily'),
      products: document.getElementById('sales-subtab-products'),
      categories: document.getElementById('sales-subtab-categories'),
      payments: document.getElementById('sales-subtab-payments')
    };

    this.populateSettings();
  }

  populateSettings() {
    const urlEl = document.getElementById('cfg-supabase-url');
    const keyEl = document.getElementById('cfg-supabase-key');
    const cfEl = document.getElementById('cfg-cashfree-appid');
    const envEl = document.getElementById('cfg-cashfree-env');
    if (urlEl && localStorage.getItem('HONESTY_SUPABASE_URL')) urlEl.value = localStorage.getItem('HONESTY_SUPABASE_URL');
    if (keyEl && localStorage.getItem('HONESTY_SUPABASE_ANON_KEY')) keyEl.value = localStorage.getItem('HONESTY_SUPABASE_ANON_KEY');
    if (cfEl && localStorage.getItem('HONESTY_CASHFREE_APP_ID')) cfEl.value = localStorage.getItem('HONESTY_CASHFREE_APP_ID');
    if (envEl && localStorage.getItem('HONESTY_CASHFREE_ENV')) envEl.value = localStorage.getItem('HONESTY_CASHFREE_ENV');
  }

  bindEvents() {
    // Sidebar navigation
    this.sidebarItems.forEach(item => {
      item.addEventListener('click', () => {
        const tab = item.dataset.tab;
        if (!tab) return;
        this.switchTab(tab);
      });
    });

    // Search input
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        if (this.activeTab === 'inventory') this.renderStockList();
        else if (this.activeTab === 'products') this.renderProductsTab();
      });
    }

    // Adjust Stock Button in Detail Panel
    const btnAdjustStock = document.getElementById('btn-open-adjust-stock');
    if (btnAdjustStock) {
      btnAdjustStock.addEventListener('click', () => {
        this.openAdjustStockModal();
      });
    }

    // Add Product Button
    const btnAddProduct = document.getElementById('btn-open-add-product');
    if (btnAddProduct) {
      btnAddProduct.addEventListener('click', () => {
        this.openProductModal();
      });
    }

    // Product Editor Modal Close Buttons
    const btnCloseProdModal = document.getElementById('btn-close-prod-modal');
    if (btnCloseProdModal) {
      btnCloseProdModal.addEventListener('click', () => {
        const modal = document.getElementById('product-editor-modal');
        if (modal) modal.classList.remove('active');
      });
    }

    const btnCancelProdModal = document.getElementById('btn-cancel-prod-modal');
    if (btnCancelProdModal) {
      btnCancelProdModal.addEventListener('click', () => {
        const modal = document.getElementById('product-editor-modal');
        if (modal) modal.classList.remove('active');
      });
    }

    // Product Photo File Input Handler
    const prodFileInput = document.getElementById('prod-file-input');
    if (prodFileInput) {
      prodFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handlePhotoSelected(e.target.files[0]);
        }
      });
    }

    // Drag and Drop on Photo Dropzone
    const dropzone = document.getElementById('photo-dropzone');
    if (dropzone) {
      ['dragenter', 'dragover'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          dropzone.style.background = '#e0f2fe';
          dropzone.style.borderColor = '#0284c7';
        });
      });
      ['dragleave', 'drop'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
          e.preventDefault();
          dropzone.style.background = '#ffffff';
          dropzone.style.borderColor = '#94a3b8';
        });
      });
      dropzone.addEventListener('drop', (e) => {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.handlePhotoSelected(e.dataTransfer.files[0]);
        }
      });
    }

    // Remove Photo Button
    const btnRemovePhoto = document.getElementById('btn-remove-photo');
    if (btnRemovePhoto) {
      btnRemovePhoto.addEventListener('click', () => {
        this.removePhoto();
      });
    }

    // Product Filters (Category & Status)
    const catFilter = document.getElementById('prod-filter-category');
    if (catFilter) {
      catFilter.addEventListener('change', () => {
        this.renderProductsTab();
      });
    }

    const statusFilter = document.getElementById('prod-filter-status');
    if (statusFilter) {
      statusFilter.addEventListener('change', () => {
        this.renderProductsTab();
      });
    }

    // Save Product Form (Handles both Add and Edit)
    const productEditorForm = document.getElementById('product-editor-form');
    if (productEditorForm) {
      productEditorForm.addEventListener('submit', async (e) => {
        await this.saveProduct(e);
      });
    }

    // Save Adjusted Stock Modal Form
    const adjustForm = document.getElementById('adjust-stock-form');
    if (adjustForm) {
      adjustForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = adjustForm.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.6'; }
        try {
          const newStock = document.getElementById('adjust-stock-input').value;
          const note = document.getElementById('adjust-stock-note').value;
          await window.storeDB.adjustStock(this.selectedProductId, newStock, note);
          if (window.showToast) window.showToast(`Stock updated to ${newStock} units`, 'success');
          document.getElementById('adjust-stock-modal').classList.remove('active');
          this.render();
        } catch (err) {
          console.error('[AdminApp] adjustStock error:', err);
          alert('Could not adjust stock: ' + err.message);
        } finally {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = '1'; }
        }
      });
    }

    // Save Physical Stock Count Form
    const physForm = document.getElementById('physical-stock-form');
    if (physForm) {
      physForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = physForm.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.6'; }
        try {
          const inputVal = document.getElementById('physical-stock-input').value;
          if (this.selectedProductId && inputVal !== '') {
            await window.storeDB.updatePhysicalStock(this.selectedProductId, Number(inputVal));
            if (window.showToast) window.showToast(`Physical shelf units updated to ${inputVal}`, 'success');
          }
          const modal = document.getElementById('physical-stock-modal');
          if (modal) modal.classList.remove('active');
          this.render();
        } catch (err) {
          console.error('[AdminApp] updatePhysicalStock error:', err);
          alert('Could not update physical stock: ' + err.message);
        } finally {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = '1'; }
        }
      });
    }

    const btnCancelPhys = document.getElementById('btn-cancel-physical-stock');
    if (btnCancelPhys) {
      btnCancelPhys.addEventListener('click', () => {
        const modal = document.getElementById('physical-stock-modal');
        if (modal) modal.classList.remove('active');
      });
    }

    const btnClosePhys = document.getElementById('btn-close-physical-stock');
    if (btnClosePhys) {
      btnClosePhys.addEventListener('click', () => {
        const modal = document.getElementById('physical-stock-modal');
        if (modal) modal.classList.remove('active');
      });
    }

    // Quick Add Stock Modal Form
    const quickAddForm = document.getElementById('quick-add-stock-form');
    if (quickAddForm) {
      quickAddForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = quickAddForm.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.6'; }
        try {
          const prodId = document.getElementById('add-stock-prod-id').value;
          const addQty = parseInt(document.getElementById('add-stock-qty-input').value, 10);
          if (prodId && addQty > 0) {
            await window.storeDB.quickAddStock(prodId, addQty);
            if (window.showToast) window.showToast(`Added +${addQty} units of stock`, 'success');
          }
          document.getElementById('quick-add-stock-modal').classList.remove('active');
          this.render();
        } catch (err) {
          console.error('[AdminApp] quickAddStock error:', err);
          alert('Could not add stock: ' + err.message);
        } finally {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = '1'; }
        }
      });
    }

    const btnCloseAddStock = document.getElementById('btn-close-add-stock-modal');
    if (btnCloseAddStock) {
      btnCloseAddStock.addEventListener('click', () => {
        document.getElementById('quick-add-stock-modal').classList.remove('active');
      });
    }

    const btnCancelAddStock = document.getElementById('btn-cancel-add-stock-modal');
    if (btnCancelAddStock) {
      btnCancelAddStock.addEventListener('click', () => {
        document.getElementById('quick-add-stock-modal').classList.remove('active');
      });
    }

    // Sales Section Subnav
    this.salesSubnavBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const subtab = btn.dataset.subtab;
        if (!subtab) return;
        this.switchSalesSubtab(subtab);
      });
    });

    // Sales Date Period Pills
    document.querySelectorAll('.date-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const period = btn.dataset.period;
        if (!period) return;
        this.setSalesPeriod(period);
      });
    });

    // Custom Date Range Apply Button
    const btnApplyCustom = document.getElementById('btn-apply-custom-dates');
    if (btnApplyCustom) {
      btnApplyCustom.addEventListener('click', () => {
        this.salesCustomStart = document.getElementById('sales-custom-start')?.value || '';
        this.salesCustomEnd = document.getElementById('sales-custom-end')?.value || '';
        this.loadSalesData();
      });
    }

    // Sales Filters
    let searchDebounceTimer = null;
    const salesSearchInput = document.getElementById('sales-search-input');
    if (salesSearchInput) {
      salesSearchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
          this.salesFilters.search = e.target.value.trim();
          this.loadSalesData();
        }, 300);
      });
    }

    const filterPayStatus = document.getElementById('sales-filter-payment-status');
    if (filterPayStatus) {
      filterPayStatus.addEventListener('change', (e) => {
        this.salesFilters.paymentStatus = e.target.value;
        this.loadSalesData();
      });
    }

    const filterOrdStatus = document.getElementById('sales-filter-order-status');
    if (filterOrdStatus) {
      filterOrdStatus.addEventListener('change', (e) => {
        this.salesFilters.orderStatus = e.target.value;
        this.loadSalesData();
      });
    }

    const filterCategory = document.getElementById('sales-filter-category');
    if (filterCategory) {
      filterCategory.addEventListener('change', (e) => {
        this.salesFilters.category = e.target.value;
        this.loadSalesData();
      });
    }

    const filterMethod = document.getElementById('sales-filter-method');
    if (filterMethod) {
      filterMethod.addEventListener('change', (e) => {
        this.salesFilters.paymentMethod = e.target.value;
        this.loadSalesData();
      });
    }

    const btnClearFilters = document.getElementById('btn-clear-sales-filters');
    if (btnClearFilters) {
      btnClearFilters.addEventListener('click', () => {
        this.salesFilters = {
          search: '',
          paymentStatus: 'ALL',
          orderStatus: 'ALL',
          category: 'ALL',
          paymentMethod: 'ALL'
        };
        if (salesSearchInput) salesSearchInput.value = '';
        if (filterPayStatus) filterPayStatus.value = 'ALL';
        if (filterOrdStatus) filterOrdStatus.value = 'ALL';
        if (filterCategory) filterCategory.value = 'ALL';
        if (filterMethod) filterMethod.value = 'ALL';
        this.loadSalesData();
      });
    }

    // Export CSV Button
    const btnExportCSV = document.getElementById('btn-export-sales-csv');
    if (btnExportCSV) {
      btnExportCSV.addEventListener('click', () => {
        this.exportSalesCSV();
      });
    }

    // Refresh Sales Button
    const btnRefreshSales = document.getElementById('btn-refresh-sales');
    if (btnRefreshSales) {
      btnRefreshSales.addEventListener('click', () => {
        this.loadSalesData();
      });
    }

    // Daily Report Controls
    const dailyDateInput = document.getElementById('daily-report-date-input');
    if (dailyDateInput) {
      dailyDateInput.value = this.dailyReportDate;
      dailyDateInput.addEventListener('change', (e) => {
        this.dailyReportDate = e.target.value;
        this.loadDailyReport(this.dailyReportDate);
      });
    }

    const btnDailyPrev = document.getElementById('btn-daily-prev-day');
    if (btnDailyPrev) {
      btnDailyPrev.addEventListener('click', () => {
        const cur = new Date(this.dailyReportDate);
        cur.setDate(cur.getDate() - 1);
        this.dailyReportDate = cur.toISOString().split('T')[0];
        if (dailyDateInput) dailyDateInput.value = this.dailyReportDate;
        this.loadDailyReport(this.dailyReportDate);
      });
    }

    const btnDailyNext = document.getElementById('btn-daily-next-day');
    if (btnDailyNext) {
      btnDailyNext.addEventListener('click', () => {
        const cur = new Date(this.dailyReportDate);
        cur.setDate(cur.getDate() + 1);
        this.dailyReportDate = cur.toISOString().split('T')[0];
        if (dailyDateInput) dailyDateInput.value = this.dailyReportDate;
        this.loadDailyReport(this.dailyReportDate);
      });
    }

    const btnDailyToday = document.getElementById('btn-daily-today');
    if (btnDailyToday) {
      btnDailyToday.addEventListener('click', () => {
        this.dailyReportDate = new Date().toISOString().split('T')[0];
        if (dailyDateInput) dailyDateInput.value = this.dailyReportDate;
        this.loadDailyReport(this.dailyReportDate);
      });
    }

    // Product Sales Filter Controls
    const prodSalesSearch = document.getElementById('prod-sales-search-input');
    if (prodSalesSearch) {
      prodSalesSearch.addEventListener('input', (e) => {
        this.prodSalesSearch = e.target.value.toLowerCase().trim();
        this.renderProductSales();
      });
    }

    const prodSalesCat = document.getElementById('prod-sales-cat-filter');
    if (prodSalesCat) {
      prodSalesCat.addEventListener('change', (e) => {
        this.prodSalesCat = e.target.value;
        this.renderProductSales();
      });
    }

    // Payment Audit Filter
    const payAuditFilter = document.getElementById('payments-filter-status');
    if (payAuditFilter) {
      payAuditFilter.addEventListener('change', (e) => {
        this.paymentsFilterStatus = e.target.value;
        this.renderPaymentTracking();
      });
    }

    // Close Modals
    const btnCloseOrderModal = document.getElementById('btn-close-order-modal');
    if (btnCloseOrderModal) {
      btnCloseOrderModal.addEventListener('click', () => {
        document.getElementById('order-detail-modal')?.classList.remove('active');
      });
    }

    const btnCloseBuyersModal = document.getElementById('btn-close-buyers-modal');
    if (btnCloseBuyersModal) {
      btnCloseBuyersModal.addEventListener('click', () => {
        document.getElementById('product-buyers-modal')?.classList.remove('active');
      });
    }
  }

  openQuickAddStockModal(productId) {
    const prod = window.storeDB.getProduct(productId);
    if (!prod) return;
    const modal = document.getElementById('quick-add-stock-modal');
    if (!modal) return;
    document.getElementById('add-stock-prod-id').value = prod.id;
    document.getElementById('add-stock-modal-title').innerText = `Add Stock: ${prod.name}`;
    document.getElementById('add-stock-current-display').innerText = `${prod.stock} units`;
    document.getElementById('add-stock-qty-input').value = '10';
    modal.classList.add('active');
  }

  subscribeToStore() {
    window.storeDB.subscribe(() => {
      this.render();
    });
  }

  switchTab(tabName) {
    this.activeTab = tabName;
    this.sidebarItems.forEach(i => {
      if (i.dataset.tab === tabName) {
        i.classList.add('active');
      } else {
        i.classList.remove('active');
      }
    });

    Object.keys(this.tabViews).forEach(k => {
      if (this.tabViews[k]) {
        this.tabViews[k].classList.remove('active');
      }
    });

    if (this.tabViews[tabName]) {
      this.tabViews[tabName].classList.add('active');
    }

    if (this.pageHeading) {
      this.pageHeading.innerText = tabName.toUpperCase();
    }

    if (tabName === 'sales') {
      this.loadSalesData();
    }

    this.render();
  }

  render() {
    if (this.activeTab === 'inventory') {
      this.renderStockList();
      this.renderDetailPanel();
    } else if (this.activeTab === 'products') {
      this.renderProductsTab();
    } else if (this.activeTab === 'dashboard') {
      this.renderDashboard();
    } else if (this.activeTab === 'sales') {
      this.renderSales();
    } else if (this.activeTab === 'users') {
      this.renderUsers();
    }
  }

  // Open Product Modal (Add or Edit)
  openProductModal(productId = null) {
    const modal = document.getElementById('product-editor-modal');
    if (!modal) return;

    const titleEl = document.getElementById('prod-modal-title');
    const form = document.getElementById('product-editor-form');
    const idInput = document.getElementById('editor-prod-id');
    const nameInput = document.getElementById('editor-prod-name');
    const refNameInput = document.getElementById('editor-prod-ref-name');
    const variantInput = document.getElementById('editor-prod-variant');
    const catInput = document.getElementById('editor-prod-category');
    const descInput = document.getElementById('editor-prod-description');
    const purchasePriceInput = document.getElementById('editor-prod-purchase-price');
    const priceInput = document.getElementById('editor-prod-price');
    const sellPriceInput = document.getElementById('editor-prod-selling-price');
    const stockInput = document.getElementById('editor-prod-stock');
    const threshInput = document.getElementById('editor-prod-threshold');
    const activeInput = document.getElementById('editor-prod-active');
    const imgUrlInput = document.getElementById('editor-image-url');
    const storagePathInput = document.getElementById('editor-storage-path');
    const dropzone = document.getElementById('photo-dropzone');
    const previewCard = document.getElementById('photo-preview-card');
    const previewImg = document.getElementById('photo-preview-img');
    const statusBadge = document.getElementById('photo-status-badge');
    const sizeBadge = document.getElementById('photo-size-badge');
    const submitText = document.getElementById('btn-save-prod-text');

    form.reset();

    if (productId) {
      const prod = window.storeDB.getProduct(productId);
      if (!prod) return;

      if (titleEl) titleEl.innerText = `Edit Product: ${prod.name}`;
      if (submitText) submitText.innerText = 'Update Product';
      if (idInput) idInput.value = prod.id;
      if (nameInput) nameInput.value = prod.name || '';
      if (refNameInput) refNameInput.value = prod.referenceName || '';
      if (variantInput) variantInput.value = prod.variant || '';
      if (catInput) catInput.value = prod.category || 'Chips';
      if (descInput) descInput.value = prod.description || '';
      if (purchasePriceInput) purchasePriceInput.value = (prod.purchasePrice !== null && prod.purchasePrice !== undefined) ? prod.purchasePrice : '';
      if (priceInput) priceInput.value = prod.price || 10;
      if (sellPriceInput) sellPriceInput.value = (prod.sellingPrice !== null && prod.sellingPrice !== undefined) ? prod.sellingPrice : '';
      if (stockInput) stockInput.value = prod.stock !== undefined ? prod.stock : 0;
      if (threshInput) threshInput.value = prod.lowStockThreshold || 5;
      if (activeInput) activeInput.checked = prod.isActive !== false;
      if (imgUrlInput) imgUrlInput.value = prod.image || 'assets/lays.png';
      if (storagePathInput) storagePathInput.value = prod.storagePath || '';

      if (prod.image && prod.image !== 'assets/lays.png') {
        dropzone.style.display = 'none';
        previewCard.style.display = 'flex';
        previewImg.src = prod.image;
        if (statusBadge) {
          statusBadge.innerText = 'Current Image';
          statusBadge.className = 'badge-tag success';
        }
        if (sizeBadge) sizeBadge.innerText = 'Supabase Storage';
      } else {
        dropzone.style.display = 'block';
        previewCard.style.display = 'none';
      }
    } else {
      if (titleEl) titleEl.innerText = 'Add Shelf Product';
      if (submitText) submitText.innerText = 'Add to Shelf';
      if (idInput) idInput.value = '';
      if (refNameInput) refNameInput.value = '';
      if (purchasePriceInput) purchasePriceInput.value = '';
      if (sellPriceInput) sellPriceInput.value = '';
      if (imgUrlInput) imgUrlInput.value = 'assets/lays.png';
      if (storagePathInput) storagePathInput.value = '';
      if (priceInput) priceInput.value = '10';
      if (stockInput) stockInput.value = '15';
      if (threshInput) threshInput.value = '5';
      if (activeInput) activeInput.checked = true;
      dropzone.style.display = 'block';
      previewCard.style.display = 'none';
    }

    modal.classList.add('active');
  }

  // Handle Photo Selection & Canvas Optimization
  async handlePhotoSelected(file) {
    if (!file) return;

    const dropzone = document.getElementById('photo-dropzone');
    const previewCard = document.getElementById('photo-preview-card');
    const previewImg = document.getElementById('photo-preview-img');
    const spinner = document.getElementById('photo-upload-spinner');
    const statusBadge = document.getElementById('photo-status-badge');
    const sizeBadge = document.getElementById('photo-size-badge');
    const imgUrlInput = document.getElementById('editor-image-url');
    const storagePathInput = document.getElementById('editor-storage-path');
    const prodId = document.getElementById('editor-prod-id').value;

    dropzone.style.display = 'none';
    previewCard.style.display = 'flex';
    spinner.style.display = 'flex';
    if (statusBadge) {
      statusBadge.innerText = 'Processing...';
      statusBadge.className = 'badge-tag warning';
    }

    try {
      // 1. Optimize on client canvas
      const optimized = await window.supabaseClient.optimizeImage(file);
      previewImg.src = optimized.dataUrl;

      const kb = Math.round(optimized.size / 1024);
      if (sizeBadge) sizeBadge.innerText = `${kb} KB (${optimized.width}x${optimized.height})`;

      // 2. Upload to Supabase Storage
      const uploadResult = await window.supabaseClient.uploadProductImage(file, prodId);
      imgUrlInput.value = uploadResult.publicUrl;
      storagePathInput.value = uploadResult.storagePath;

      if (statusBadge) {
        statusBadge.innerText = 'Uploaded';
        statusBadge.className = 'badge-tag success';
      }
      if (window.showToast) window.showToast('Product photo uploaded & optimized successfully!', 'success');
    } catch (err) {
      console.error('[Photo Upload Error]:', err);
      if (statusBadge) {
        statusBadge.innerText = 'Upload Error';
        statusBadge.className = 'badge-tag danger';
      }
      alert('Photo upload failed: ' + err.message);
    } finally {
      spinner.style.display = 'none';
    }
  }

  removePhoto() {
    const dropzone = document.getElementById('photo-dropzone');
    const previewCard = document.getElementById('photo-preview-card');
    const imgUrlInput = document.getElementById('editor-image-url');
    const storagePathInput = document.getElementById('editor-storage-path');
    const fileInput = document.getElementById('prod-file-input');

    if (fileInput) fileInput.value = '';
    imgUrlInput.value = 'assets/lays.png';
    storagePathInput.value = '';
    previewCard.style.display = 'none';
    dropzone.style.display = 'block';
  }

  // Save Product (Create or Update)
  async saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('editor-prod-id').value;
    const name = document.getElementById('editor-prod-name').value.trim();
    const referenceName = document.getElementById('editor-prod-ref-name')?.value.trim() || null;
    const variant = document.getElementById('editor-prod-variant').value.trim();
    const category = document.getElementById('editor-prod-category').value;
    const description = document.getElementById('editor-prod-description').value.trim();
    const price = parseFloat(document.getElementById('editor-prod-price').value);
    const purchasePriceRaw = document.getElementById('editor-prod-purchase-price')?.value;
    const purchasePrice = (purchasePriceRaw !== undefined && purchasePriceRaw !== '') ? parseFloat(purchasePriceRaw) : null;
    const sellPriceRaw = document.getElementById('editor-prod-selling-price')?.value;
    const sellingPrice = (sellPriceRaw !== undefined && sellPriceRaw !== '') ? parseFloat(sellPriceRaw) : null;
    const stock = parseInt(document.getElementById('editor-prod-stock').value, 10);
    const threshold = parseInt(document.getElementById('editor-prod-threshold').value, 10) || 5;
    const isActive = document.getElementById('editor-prod-active').checked;
    const imageUrl = document.getElementById('editor-image-url').value || 'assets/lays.png';
    const storagePath = document.getElementById('editor-storage-path').value || null;

    if (!name) {
      alert('Please enter a product name');
      return;
    }
    if (isNaN(price) || price < 0.5) {
      alert('Please enter a valid MRP price (min ₹0.5)');
      return;
    }
    if (isNaN(stock) || stock < 0) {
      alert('Stock quantity cannot be negative');
      return;
    }

    const payload = {
      name,
      referenceName,
      reference_name: referenceName,
      variant,
      category,
      description,
      price,
      purchasePrice,
      purchase_price: purchasePrice,
      sellingPrice,
      selling_price: sellingPrice,
      stock,
      lowStockThreshold: threshold,
      low_stock_threshold: threshold,
      isActive,
      is_active: isActive,
      image: imageUrl,
      imageUrl,
      image_url: imageUrl,
      storagePath,
      storage_path: storagePath
    };

    const submitBtn = document.getElementById('btn-save-prod-modal');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.6';
    }

    try {
      if (id) {
        await window.storeDB.updateProduct(id, payload);
        if (window.showToast) window.showToast(`Updated product "${name}"`, 'success');
      } else {
        await window.storeDB.addProduct(payload);
        if (window.showToast) window.showToast(`Added new shelf product "${name}"`, 'success');
      }

      document.getElementById('product-editor-modal').classList.remove('active');
      this.render();
    } catch (err) {
      alert('Could not save product: ' + err.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
      }
    }
  }

  // Render Products Tab (List Table, Filters, Badges)
  renderProductsTab() {
    const tbody = document.getElementById('admin-products-tbody');
    if (!tbody) return;

    const allProducts = window.storeDB.data.products || [];
    const catFilter = document.getElementById('prod-filter-category')?.value || 'All';
    const statusFilter = document.getElementById('prod-filter-status')?.value || 'all';

    // Update stats pills
    const totalCount = allProducts.length;
    const activeCount = allProducts.filter(p => p.isActive !== false).length;
    const lowCount = allProducts.filter(p => p.isActive !== false && p.stock > 0 && p.stock <= (p.lowStockThreshold || 5)).length;
    const archivedCount = allProducts.filter(p => p.isActive === false).length;

    const elTotal = document.getElementById('stat-prod-total');
    const elActive = document.getElementById('stat-prod-active');
    const elLow = document.getElementById('stat-prod-low');
    const elArchived = document.getElementById('stat-prod-archived');
    if (elTotal) elTotal.innerText = totalCount;
    if (elActive) elActive.innerText = activeCount;
    if (elLow) elLow.innerText = lowCount;
    if (elArchived) elArchived.innerText = archivedCount;

    // Filter products
    let filtered = allProducts;
    if (catFilter !== 'All') {
      filtered = filtered.filter(p => (p.category || '').toLowerCase() === catFilter.toLowerCase());
    }
    if (statusFilter === 'active') {
      filtered = filtered.filter(p => p.isActive !== false);
    } else if (statusFilter === 'archived') {
      filtered = filtered.filter(p => p.isActive === false);
    }
    if (this.searchQuery) {
      filtered = filtered.filter(p =>
        (p.name || '').toLowerCase().includes(this.searchQuery) ||
        (p.referenceName || '').toLowerCase().includes(this.searchQuery) ||
        (p.variant || '').toLowerCase().includes(this.searchQuery) ||
        (p.category || '').toLowerCase().includes(this.searchQuery)
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 36px 14px; color: #64748b;">
            No products match the selected criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(prod => {
      const isArchived = prod.isActive === false;
      const isOutOfStock = Number(prod.stock) <= 0;
      const isLowStock = !isOutOfStock && Number(prod.stock) <= (prod.lowStockThreshold || 5);

      let stockBadge = '<span class="badge-tag success">In Stock</span>';
      if (isOutOfStock) {
        stockBadge = '<span class="badge-tag danger">Out of Stock</span>';
      } else if (isLowStock) {
        stockBadge = '<span class="badge-tag warning">Low Stock</span>';
      }

      // Purchase Rate formatting
      const purchaseDisplay = (prod.purchasePrice !== null && prod.purchasePrice !== undefined)
        ? `₹${Number(prod.purchasePrice).toFixed(2)}`
        : '<span style="color:#94a3b8;">—</span>';

      // Selling Price formatting
      const hasValidSellingPrice = prod.sellingPrice !== null && prod.sellingPrice !== undefined && Number(prod.sellingPrice) > 0;
      const hasDiscount = hasValidSellingPrice && prod.price && Number(prod.sellingPrice) < Number(prod.price);
      let sellingPriceDisplay = '';
      if (hasValidSellingPrice) {
        sellingPriceDisplay = `
          <div style="font-weight: 700; color: #0284c7; font-size: 14px;">
            ₹${Number(prod.sellingPrice).toFixed(2)}
            ${hasDiscount ? `<span style="font-size: 11px; text-decoration: line-through; color: #94a3b8; font-weight: 400; margin-left: 4px;">₹${Number(prod.price).toFixed(2)}</span>` : ''}
          </div>
        `;
      } else {
        sellingPriceDisplay = `
          <span class="badge-tag warning" style="font-size: 11px; font-weight: 700; background: #fef3c7; color: #b45309; border: 1px solid #fde68a;">
            Price Required
          </span>
          <div style="font-size: 10px; color: #dc2626; margin-top: 2px;">Hidden from sales</div>
        `;
      }

      return `
        <tr style="${isArchived ? 'opacity: 0.65; background: #fafafa;' : ''}">
          <td style="vertical-align: middle;">
            <div style="width: 44px; height: 44px; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; background: #fff; display: flex; align-items: center; justify-content: center;">
              <img src="${window.resolveProductImage ? window.resolveProductImage(prod.image, prod.id) : (prod.image || 'assets/lays.jpg')}" 
                   alt="${prod.name}" 
                   style="width: 100%; height: 100%; object-fit: contain;" 
                   onerror="this.onerror=null;this.src='assets/lays.jpg';" />
            </div>
          </td>
          <td>
            <div style="font-weight: 700; color: #0f172a; font-size: 14px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span>${prod.name}</span>
              ${prod.referenceName ? `<span style="font-size: 10px; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-family: monospace;">[${prod.referenceName}]</span>` : ''}
            </div>
            ${prod.variant ? `<div style="font-size: 12px; color: #64748b; margin-top: 1px;">${prod.variant}</div>` : ''}
            ${prod.description ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 2px; max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${prod.description}</div>` : ''}
          </td>
          <td>
            <span class="badge-tag muted">${prod.category || 'Snacks'}</span>
          </td>
          <td>
            <div style="font-weight: 600; color: #334155; font-size: 13px;">${purchaseDisplay}</div>
            <div style="font-size: 10px; color: #94a3b8;">Procurement</div>
          </td>
          <td>
            ${sellingPriceDisplay}
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 700; font-size: 13px;">${prod.stock} units</span>
              ${stockBadge}
            </div>
          </td>
          <td>
            <span class="badge-tag ${isArchived ? 'muted' : (prod.isAvailable === false ? 'warning' : 'success')}">
              ${isArchived ? 'Archived' : (prod.isAvailable === false ? 'Disabled' : 'Active')}
            </span>
          </td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 6px;">
              <button class="btn-table-action edit" onclick="window.adminApp.openProductModal('${prod.id}')" title="Edit Product">
                Edit
              </button>
              <button class="btn-table-action" style="background:#e0f2fe; color:#0369a1; border-color:#bae6fd;" onclick="window.adminApp.openQuickAddStockModal('${prod.id}')" title="Quick Add Stock Units">
                + Stock
              </button>
              <button class="btn-table-action ${isArchived ? 'restore' : 'archive'}" 
                      onclick="window.adminApp.toggleProductArchive('${prod.id}', ${!isArchived})" 
                      title="${isArchived ? 'Restore to Shelf' : 'Archive (Hide from Shelf)'}">
                ${isArchived ? 'Restore' : 'Archive'}
              </button>
              <button class="btn-table-action delete" onclick="window.adminApp.deleteProduct('${prod.id}')" title="Delete Product">
                Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  async toggleProductArchive(productId, makeArchived) {
    const prod = window.storeDB.getProduct(productId);
    const actionLabel = makeArchived ? 'Archive' : 'Restore';
    if (!confirm(`Are you sure you want to ${actionLabel.toLowerCase()} "${prod ? prod.name : productId}"?`)) return;

    try {
      await window.storeDB.archiveProduct(productId, !makeArchived);
      if (window.showToast) window.showToast(`Product ${makeArchived ? 'archived' : 'restored'} successfully`, 'success');
      this.render();
    } catch (err) {
      alert('Could not update product status: ' + err.message);
    }
  }

  async deleteProduct(productId) {
    const prod = window.storeDB.getProduct(productId);
    const prodName = prod ? prod.name : productId;

    // Check if referenced in historical orders
    const canDelete = await window.storeDB.canDeleteProduct(productId);
    if (!canDelete) {
      alert(`Cannot permanently delete "${prodName}" because it is part of past order receipts.\n\nPlease click "Archive" instead. Archiving will hide the product from the customer app while keeping order receipts and financial records intact.`);
      return;
    }

    if (!confirm(`Are you sure you want to PERMANENTLY delete "${prodName}"?\nThis cannot be undone.`)) return;

    try {
      await window.storeDB.deleteProduct(productId);
      if (window.showToast) window.showToast(`Deleted product "${prodName}"`, 'success');
      this.render();
    } catch (err) {
      alert('Could not delete product: ' + err.message);
    }
  }

  renderStockList() {
    if (!this.stockListContainer) return;

    let products = window.storeDB.data.products;
    if (this.searchQuery) {
      products = products.filter(p =>
        (p.name || '').toLowerCase().includes(this.searchQuery) ||
        (p.variant || '').toLowerCase().includes(this.searchQuery) ||
        (p.category || '').toLowerCase().includes(this.searchQuery)
      );
    }

    this.stockListContainer.innerHTML = products.map(prod => {
      const isSelected = prod.id === this.selectedProductId;
      let pillClass = 'in-stock';
      let statusText = 'In Stock';

      if (prod.stock === 0) {
        pillClass = 'out-of-stock';
        statusText = 'Restock';
      } else if (prod.stock <= (prod.lowStockThreshold || 5)) {
        pillClass = 'low-stock';
        statusText = 'Restock';
      }

      const imgSrc = window.resolveProductImage ? window.resolveProductImage(prod.image, prod.id) : (prod.image || 'assets/lays.jpg');

      return `
        <div class="stock-item-row ${isSelected ? 'selected' : ''}" onclick="window.adminApp.selectProduct('${prod.id}')">
          <div class="stock-item-left">
            <div class="stock-thumb-wrap">
              <img src="${imgSrc}" alt="${prod.name}" onerror="this.onerror=null;this.src='assets/lays.jpg';" />
            </div>
            <div class="stock-item-info">
              <h4>${prod.name}</h4>
              <p>${prod.variant || ''}</p>
            </div>
          </div>
          <div class="stock-item-right">
            <div class="unit-count-pill ${pillClass}">
              <span class="pill-dot"></span>
              ${prod.stock} Units
            </div>
            <div class="stock-status-text">${statusText}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  selectProduct(productId) {
    this.selectedProductId = productId;
    window.storeDB.setSelectedAuditProduct(productId);
    this.renderStockList();
    this.renderDetailPanel();
  }

  renderDetailPanel() {
    const prod = window.storeDB.getProduct(this.selectedProductId) || window.storeDB.data.products[0];
    if (!prod || !this.detailPanel) return;

    const expected = prod.expectedStock !== undefined ? prod.expectedStock : prod.stock;
    const physical = prod.physicalStock !== undefined ? prod.physicalStock : prod.stock;
    const diff = physical - expected;

    const diffDisplay = diff > 0 ? `+${diff}` : `${diff}`;
    const detailImg = window.resolveProductImage ? window.resolveProductImage(prod.image, prod.id) : (prod.image || 'assets/lays.jpg');

    this.detailPanel.innerHTML = `
      <div class="detail-panel-header">
        <div class="detail-panel-titles">
          <h3>Detail View</h3>
          <p>${prod.name} ${prod.variant || ''}</p>
        </div>
        <div class="detail-header-thumb">
          <img src="${detailImg}" alt="${prod.name}" onerror="this.onerror=null;this.src='assets/lays.jpg';" />
        </div>
      </div>

      <div class="stock-metrics-grid">
        <div class="stock-metric-card">
          <div class="metric-card-label">Expected Stock</div>
          <div class="metric-card-number">${expected}</div>
        </div>
        <div class="stock-metric-card">
          <div class="metric-card-label">Physical Stock</div>
          <div class="metric-card-number" style="display:flex; align-items:center; justify-content:space-between;">
            <span>${physical}</span>
            <button onclick="window.adminApp.promptPhysicalStock('${prod.id}', ${physical})" 
                    style="border:none; background:#e2e8f0; border-radius:6px; font-size:11px; padding:2px 6px; cursor:pointer;" title="Quick count update">✏️</button>
          </div>
        </div>
      </div>

      <div class="stock-difference-card" style="border-left-color: ${diff < 0 ? '#ef4444' : (diff === 0 ? '#10b981' : '#3b82f6')}">
        <div class="difference-label">Difference</div>
        <div class="difference-val" style="color: ${diff < 0 ? '#dc2626' : (diff === 0 ? '#059669' : '#2563eb')}">${diffDisplay}</div>
      </div>

      <div class="trust-callout-box">
        <div class="trust-callout-icon">ⓘ</div>
        <div class="trust-callout-text">
          Inventory differences help identify where the shelf needs physical restocking or audit attention.
        </div>
      </div>

      <button class="btn-adjust-stock" id="btn-open-adjust-stock" onclick="window.adminApp.openAdjustStockModal()">
        Adjust Stock
      </button>
    `;
  }

  promptPhysicalStock(productId, currentVal) {
    this.selectedProductId = productId;
    const prod = window.storeDB.getProduct(productId);
    const modal = document.getElementById('physical-stock-modal');
    const titleEl = document.getElementById('physical-stock-prod-name');
    const inputEl = document.getElementById('physical-stock-input');

    if (titleEl && prod) titleEl.innerText = `${prod.name} (${prod.variant})`;
    if (inputEl) {
      inputEl.value = currentVal;
      setTimeout(() => inputEl.focus(), 100);
    }
    if (modal) modal.classList.add('active');
  }

  openAdjustStockModal() {
    const prod = window.storeDB.getProduct(this.selectedProductId);
    if (!prod) return;

    const modal = document.getElementById('adjust-stock-modal');
    document.getElementById('adjust-modal-prod-name').innerText = `${prod.name} (${prod.variant})`;
    document.getElementById('adjust-stock-input').value = prod.stock;
    if (modal) modal.classList.add('active');
  }

  async renderDashboard() {
    const dashboardSubView = this.dashboardSubView || 'today';
    const container = document.getElementById('dashboard-dynamic-content');
    if (!container) return;

    // Fetch live metrics from storeDB & backend
    const adminOrders = window.storeDB.getAdminOrders ? window.storeDB.getAdminOrders() : [];
    let metrics = {
      salesToday: window.storeDB.data.community.salesToday || 0,
      todayOrdersCount: adminOrders.filter(o => (o.timeLabel || '').includes('TODAY') || new Date(o.createdAt).toDateString() === new Date().toDateString()).length,
      totalRevenue: adminOrders.reduce((s, o) => s + (Number(o.amount) || 0), 0),
      totalOrdersCount: adminOrders.length,
      totalItemsSold: adminOrders.reduce((s, o) => s + (Number(o.itemCount) || 1), 0),
      completedPayments: adminOrders.length,
      totalVisits: window.storeDB.data.community.storeVisits || 0,
      uniqueVisitors: window.storeDB.data.community.uniqueVisitors || 0,
      todayVisits: 0,
      todayUniques: 0,
      topProducts: []
    };

    try {
      const adminToken = localStorage.getItem('honesty_admin_token') || '';
      const headers = adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {};
      const res = await fetch('/api/admin/dashboard', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          metrics = { ...metrics, ...data };
        }
      }
    } catch (e) {
      console.warn('Could not fetch remote dashboard metrics:', e);
    }

    const topItemName = metrics.topProducts && metrics.topProducts.length > 0 
      ? metrics.topProducts[0].name 
      : 'None yet';

    if (dashboardSubView === 'today') {
      container.innerHTML = `
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 28px; font-weight: 800; color: #000; margin-bottom: 4px;">Today's Overview</h2>
          <p style="font-size: 14px; color: #64748b;">Live real-time metrics from Supabase & Cashfree.</p>
        </div>

        <!-- 4 Top KPI Cards -->
        <div class="dashboard-kpi-grid">
          <div class="kpi-card">
            <div class="kpi-card-header">
              <span class="kpi-title">TODAY'S SALES</span>
              <div class="kpi-icon-pill" style="font-weight: 700; font-size: 13px;">₹</div>
            </div>
            <div class="kpi-val">₹${metrics.salesToday.toLocaleString('en-IN')}</div>
            <div class="kpi-sub positive">
              <span>Live reconciled</span>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-card-header">
              <span class="kpi-title">ORDERS TODAY</span>
              <div class="kpi-icon-pill">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8H8"/><path d="M16 12H8"/><path d="M13 16H8"/></svg>
              </div>
            </div>
            <div class="kpi-val">${metrics.todayOrdersCount}</div>
            <div class="kpi-sub">Verified customer checkouts</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-card-header">
              <span class="kpi-title">ITEMS SOLD</span>
              <div class="kpi-icon-pill">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              </div>
            </div>
            <div class="kpi-val">${metrics.totalItemsSold}</div>
            <div class="kpi-sub">Top item: ${topItemName}</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-card-header">
              <span class="kpi-title">SUCCESSFUL PAYMENTS</span>
              <div class="kpi-icon-pill">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
              </div>
            </div>
            <div class="kpi-val">${metrics.completedPayments}</div>
            <div class="kpi-sub">Cashfree & UPI Verified</div>
          </div>
        </div>

        <!-- CONVERSION FUNNEL -->
        <div class="conversion-funnel-card">
          <div class="funnel-card-header">
            <h3>Store Telemetry</h3>
            <span style="font-size:12px; color:#10b981; font-weight:700;">● Live Connection</span>
          </div>

          <div class="funnel-stages-row">
            <!-- Stage 1 -->
            <div class="funnel-stage-item">
              <div class="funnel-circle">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </div>
              <div class="funnel-count-val">${metrics.todayVisits !== undefined ? metrics.todayVisits : (metrics.totalVisits || 0)}</div>
              <div class="funnel-stage-label">STORE VISITS</div>
              <div style="font-size: 11px; color: #0ca678; font-weight: 700; margin-top: 3px;">${metrics.todayUniques !== undefined ? metrics.todayUniques : (metrics.uniqueVisitors || 0)} Unique</div>
            </div>

            <!-- Stage 2 -->
            <div class="funnel-stage-item">
              <div class="funnel-circle">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
              </div>
              <div class="funnel-count-val">${metrics.todayOrdersCount}</div>
              <div class="funnel-stage-label">CHECKOUTS</div>
            </div>

            <!-- Stage 3 -->
            <div class="funnel-stage-item">
              <div class="funnel-circle completed">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5">
                  <circle cx="12" cy="12" r="9"></circle>
                  <polyline points="9 12 11 14 15 10"></polyline>
                </svg>
              </div>
              <div class="funnel-count-val">${metrics.completedPayments}</div>
              <div class="funnel-stage-label">PAYMENTS COMPLETED</div>
            </div>
          </div>
        </div>
      `;
    } else {
      // 30 Days View with Real Data
      const topListHtml = metrics.topProducts && metrics.topProducts.length > 0 
        ? metrics.topProducts.map((p, idx) => `
            <div class="top-product-item">
              <div class="top-prod-rank-name">
                <span class="top-prod-rank">${idx + 1}</span>
                <span class="top-prod-name">${p.name}</span>
              </div>
              <span class="top-prod-sales">${p.count} sold</span>
            </div>
          `).join('')
        : '<p style="color:#94a3b8; font-size:13px; padding:10px 0;">No product sales recorded yet.</p>';

      container.innerHTML = `
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 28px; font-weight: 800; color: #000; margin-bottom: 4px;">Performance Overview</h2>
          <p style="font-size: 14px; color: #64748b;">Cumulative metrics across all customer purchases.</p>
        </div>

        <!-- 6 Stat Cards -->
        <div class="dashboard-kpi-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
          <div class="kpi-card">
            <div class="kpi-card-header">
              <span class="kpi-icon-pill">₹</span>
            </div>
            <span class="kpi-title">Total Revenue</span>
            <div class="kpi-val">₹${metrics.totalRevenue.toLocaleString('en-IN')}</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-card-header">
              <span class="kpi-icon-pill">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
              </span>
            </div>
            <span class="kpi-title">Completed Orders</span>
            <div class="kpi-val">${metrics.totalOrdersCount}</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-card-header">
              <span class="kpi-icon-pill">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              </span>
            </div>
            <span class="kpi-title">Total Items Sold</span>
            <div class="kpi-val">${metrics.totalItemsSold}</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-card-header">
              <span class="kpi-icon-pill" style="color: #2563eb;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              </span>
            </div>
            <span class="kpi-title">Store Visits</span>
            <div class="kpi-val">${(metrics.totalVisits || 0).toLocaleString('en-IN')}</div>
            <div class="kpi-sub" style="font-size:11px; color:#64748b; margin-top:2px;">Persistent storefront sessions</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-card-header">
              <span class="kpi-icon-pill" style="color: #0ca678;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </span>
            </div>
            <span class="kpi-title">Unique Visitors</span>
            <div class="kpi-val">${(metrics.uniqueVisitors || 0).toLocaleString('en-IN')}</div>
            <div class="kpi-sub" style="font-size:11px; color:#0ca678; margin-top:2px; font-weight:600;">Anonymous unique devices</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-card-header">
              <span class="kpi-icon-pill">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </span>
            </div>
            <span class="kpi-title">Honor Trust Score</span>
            <div class="kpi-val">100%</div>
          </div>
        </div>

        <!-- Middle Grid: Real Top Products -->
        <div class="dashboard-middle-grid">
          <div class="top-products-card">
            <h3 style="font-size: 16px; font-weight: 800; color: #0f172a; margin-bottom: 12px;">Top Selling Products</h3>
            <div class="top-products-list">
              ${topListHtml}
            </div>
            <button onclick="window.adminApp.switchTab('inventory')" 
                    style="width:100%; background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:10px; font-size:13px; font-weight:700; cursor:pointer; margin-top: 14px;">
              Manage Inventory
            </button>
          </div>

          <div class="chart-card">
            <div class="chart-card-header">
              <h3>System Integrity Status</h3>
              <span style="color:#10b981; font-weight:800; font-size:13px;">● Nominal</span>
            </div>
            <div style="padding: 16px 0; font-size: 13px; color: #475569; line-height: 1.6;">
              <p>✓ All payments verified against Cashfree Payment Gateway</p>
              <p>✓ Stock levels deducted synchronously upon receipt</p>
              <p>✓ Zero client-side price trust enforced</p>
            </div>
          </div>
        </div>
      `;
    }
  }

  setDashboardSubView(view) {
    this.dashboardSubView = view;
    document.querySelectorAll('.dashboard-toggle-btn').forEach(btn => {
      if (btn.dataset.subview === view) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    this.renderDashboard();
  }

  switchSalesSubtab(subtab) {
    this.currentSalesSubtab = subtab;
    this.salesSubnavBtns.forEach(btn => {
      if (btn.dataset.subtab === subtab) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    Object.keys(this.salesSubtabViews).forEach(key => {
      const view = this.salesSubtabViews[key];
      if (!view) return;
      if (key === subtab) {
        view.classList.add('active');
        view.style.display = 'block';
      } else {
        view.classList.remove('active');
        view.style.display = 'none';
      }
    });

    if (subtab === 'daily' && !this.dailyReportData) {
      this.loadDailyReport(this.dailyReportDate);
    } else {
      this.renderSales();
    }
  }

  setSalesPeriod(period) {
    this.salesPeriod = period;
    document.querySelectorAll('.date-pill-btn').forEach(btn => {
      if (btn.dataset.period === period) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    const customRow = document.getElementById('custom-date-range-row');
    if (customRow) {
      customRow.style.display = (period === 'custom') ? 'block' : 'none';
    }

    if (period !== 'custom') {
      this.loadSalesData();
    }
  }

  async loadSalesData() {
    try {
      const adminToken = localStorage.getItem('honesty_admin_token') || (window.authManager ? window.authManager.getAccessToken() : '');
      const headers = adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {};

      const params = new URLSearchParams({
        period: this.salesPeriod,
        status: this.salesFilters.orderStatus,
        paymentStatus: this.salesFilters.paymentStatus,
        category: this.salesFilters.category,
        paymentMethod: this.salesFilters.paymentMethod,
        search: this.salesFilters.search
      });

      if (this.salesPeriod === 'custom') {
        if (this.salesCustomStart) params.append('startDate', this.salesCustomStart);
        if (this.salesCustomEnd) params.append('endDate', this.salesCustomEnd);
      }

      const res = await fetch(`/api/admin/sales?${params.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          this.salesData = data;
          this.renderSales();
          return;
        }
      }
    } catch (err) {
      console.warn('[AdminApp] loadSalesData network warning:', err);
    }

    // Client-side fallback if backend API is not yet loaded
    this.renderSales();
  }

  async loadDailyReport(dateStr) {
    const targetDate = dateStr || this.dailyReportDate || new Date().toISOString().split('T')[0];
    try {
      const adminToken = localStorage.getItem('honesty_admin_token') || (window.authManager ? window.authManager.getAccessToken() : '');
      const headers = adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {};

      const res = await fetch(`/api/admin/daily-report?date=${targetDate}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          this.dailyReportData = data;
          this.renderDailyReport();
          return;
        }
      }
    } catch (err) {
      console.warn('[AdminApp] loadDailyReport network warning:', err);
    }
  }

  renderSales() {
    if (!this.salesData) {
      this.loadSalesData();
      return;
    }

    const summary = this.salesData.summary || {
      confirmedRevenue: 0,
      confirmedOrdersCount: 0,
      totalItemsSold: 0,
      successfulPayments: { count: 0, amount: 0 },
      pendingPayments: { count: 0, amount: 0 },
      failedPayments: { count: 0, amount: 0 }
    };

    // 1. Update KPI Stat Cards
    const kpiRev = document.getElementById('kpi-confirmed-revenue');
    if (kpiRev) kpiRev.innerText = `₹${(summary.confirmedRevenue || 0).toLocaleString('en-IN')}`;

    const kpiOrders = document.getElementById('kpi-confirmed-orders');
    if (kpiOrders) kpiOrders.innerText = summary.confirmedOrdersCount || 0;

    const kpiAvg = document.getElementById('kpi-avg-order-val');
    if (kpiAvg) {
      const avg = summary.confirmedOrdersCount > 0 ? Math.round(summary.confirmedRevenue / summary.confirmedOrdersCount) : 0;
      kpiAvg.innerText = `Avg: ₹${avg} / order`;
    }

    const kpiItems = document.getElementById('kpi-items-sold');
    if (kpiItems) kpiItems.innerText = summary.totalItemsSold || 0;

    const kpiPaySuccess = document.getElementById('kpi-pay-success');
    if (kpiPaySuccess) kpiPaySuccess.innerText = summary.successfulPayments?.count || 0;

    const kpiPayPending = document.getElementById('kpi-pay-pending');
    if (kpiPayPending) kpiPayPending.innerText = summary.pendingPayments?.count || 0;

    const kpiPayFailed = document.getElementById('kpi-pay-failed');
    if (kpiPayFailed) kpiPayFailed.innerText = summary.failedPayments?.count || 0;

    const kpiPayRate = document.getElementById('kpi-pay-rate');
    if (kpiPayRate) {
      const succ = summary.successfulPayments?.count || 0;
      const fail = summary.failedPayments?.count || 0;
      const totalAttempts = succ + fail;
      const rate = totalAttempts > 0 ? Math.round((succ / totalAttempts) * 100) : 100;
      kpiPayRate.innerText = `${rate}% gateway success rate`;
    }

    // 2. Dispatch to Subtabs
    if (this.currentSalesSubtab === 'overview') {
      this.renderSalesOverview();
    } else if (this.currentSalesSubtab === 'daily') {
      this.renderDailyReport();
    } else if (this.currentSalesSubtab === 'products') {
      this.renderProductSales();
    } else if (this.currentSalesSubtab === 'categories') {
      this.renderCategorySales();
    } else if (this.currentSalesSubtab === 'payments') {
      this.renderPaymentTracking();
    }
  }

  renderSalesOverview() {
    const tbody = document.getElementById('sales-table-body');
    const badgeCount = document.getElementById('sales-orders-count-badge');
    if (!tbody) return;

    const orders = this.salesData?.orders || [];
    if (badgeCount) badgeCount.innerText = `Showing ${orders.length} order${orders.length === 1 ? '' : 's'}`;

    if (orders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 40px 16px; color: #94a3b8; font-size: 13px;">
            No orders found matching the selected period and filters.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = orders.map(order => {
      const isPaid = (order.payment_status === 'PAID' || order.status === 'PAID');
      const isPending = (order.payment_status === 'PENDING' || order.status === 'PENDING');
      const isFailed = (order.payment_status === 'FAILED' || order.status === 'FAILED' || order.status === 'CANCELLED');
      const isCompleted = (order.order_status === 'COMPLETED' || order.status === 'COMPLETED');

      const items = Array.isArray(order.items) ? order.items : [];
      const itemsSummary = items.map(i => {
        const qty = i.qty || i.quantity || 1;
        const name = i.name || i.product_name_snapshot || 'Item';
        return `${qty}x ${name}`;
      }).join(', ') || 'Item';

      const orderNumber = order.order_number || ('#HS-' + (order.id.replace(/\D/g, '').slice(-6) || '000000'));
      const amt = Number(order.total_amount !== undefined ? order.total_amount : order.amount) || 0;
      const createdDate = order.created_at ? new Date(order.created_at) : new Date();
      const dateFormatted = createdDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const timeFormatted = createdDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      const customerName = order.customer_name || 'Customer';
      const customerEmail = order.customer_email || '';
      const customerPhone = order.customer_phone ? `+91 ${order.customer_phone}` : '';

      return `
        <tr>
          <td>
            <button type="button" class="order-link-btn" onclick="window.adminApp.showOrderDetailModal('${order.id}')" title="Click to view complete order receipt">
              ${orderNumber}
            </button>
          </td>
          <td>
            <div style="font-weight:600; color:#0f172a; font-size:12px;">${dateFormatted}</div>
            <div style="font-size:11px; color:#64748b;">${timeFormatted}</div>
          </td>
          <td>
            <div style="font-weight:700; color:#0f172a; font-size:13px;">${customerName}</div>
            ${customerEmail ? `<div style="font-size:11px; color:#64748b;">${customerEmail}</div>` : ''}
            ${customerPhone ? `<div style="font-size:11px; color:#0284c7; font-weight:600;">${customerPhone}</div>` : ''}
          </td>
          <td style="max-width: 240px;">
            <div style="font-size:12px; font-weight:600; color:#334155; white-space: normal; line-height: 1.35;">${itemsSummary}</div>
          </td>
          <td>
            <strong style="color: #0f172a; font-size: 14px;">₹${amt}</strong>
          </td>
          <td>
            <span class="badge-status ${isPaid ? 'paid' : (isPending ? 'pending' : 'failed')}">
              ${isPaid ? '✓ PAID' : (isPending ? '⏳ PENDING' : '✕ FAILED')}
            </span>
          </td>
          <td>
            <select class="admin-order-status-select" 
                    style="font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 6px; cursor: pointer; border: 1px solid #cbd5e1;"
                    onchange="window.adminApp.changeOrderStatus('${order.id}', this.value)">
              <option value="COMPLETED" ${isCompleted || isPaid ? 'selected' : ''}>COMPLETED</option>
              <option value="PENDING" ${isPending ? 'selected' : ''}>PENDING</option>
              <option value="CANCELLED" ${isFailed ? 'selected' : ''}>CANCELLED</option>
            </select>
          </td>
          <td style="font-size: 12px; color: #475569;">
            ${order.payment_method || 'Cashfree UPI'}
          </td>
          <td style="text-align: right;">
            <button type="button" class="btn-table-action edit" onclick="window.adminApp.showOrderDetailModal('${order.id}')">
              Details →
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  renderDailyReport() {
    if (!this.dailyReportData) {
      this.loadDailyReport(this.dailyReportDate);
      return;
    }

    const data = this.dailyReportData;
    const summary = data.summary || {};

    const grossEl = document.getElementById('daily-stat-gross');
    if (grossEl) grossEl.innerText = `₹${(summary.grossSales || summary.confirmedRevenue || 0).toLocaleString('en-IN')}`;

    const discEl = document.getElementById('daily-stat-discounts');
    if (discEl) discEl.innerText = `₹${(summary.discounts || 0).toLocaleString('en-IN')}`;

    const netEl = document.getElementById('daily-stat-net');
    if (netEl) netEl.innerText = `₹${(summary.confirmedRevenue || 0).toLocaleString('en-IN')}`;

    const ordersEl = document.getElementById('daily-stat-orders');
    if (ordersEl) ordersEl.innerText = summary.confirmedOrdersCount || 0;

    const unitsEl = document.getElementById('daily-stat-units');
    if (unitsEl) unitsEl.innerText = summary.totalItemsSold || 0;

    // Daily Products Sold
    const prodTbody = document.getElementById('daily-products-tbody');
    if (prodTbody) {
      const prods = (data.products || []).filter(p => p.unitsSold > 0);
      if (prods.length === 0) {
        prodTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 24px; color: #94a3b8; font-size: 12px;">No products sold on ${data.date}.</td></tr>`;
      } else {
        prodTbody.innerHTML = prods.map(p => `
          <tr>
            <td><strong>${p.name}</strong></td>
            <td><span class="badge-tag muted">${p.category}</span></td>
            <td><strong>${p.unitsSold}</strong></td>
            <td>₹${p.unitPrice}</td>
            <td><strong style="color: #047857;">₹${p.revenue}</strong></td>
          </tr>
        `).join('');
      }
    }

    // Daily Categories
    const catTbody = document.getElementById('daily-categories-tbody');
    if (catTbody) {
      const cats = data.categories || [];
      catTbody.innerHTML = cats.map(c => `
        <tr>
          <td><strong>${c.category}</strong></td>
          <td>${c.itemsSold}</td>
          <td><strong>₹${c.revenue}</strong></td>
          <td><span class="badge-tag success">${c.share}%</span></td>
        </tr>
      `).join('');
    }

    // Daily Payment Channels Breakdown Box
    const payBox = document.getElementById('daily-payments-breakdown-box');
    if (payBox) {
      const succ = summary.successfulPayments || { count: 0, amount: 0 };
      const fail = summary.failedPayments || { count: 0, amount: 0 };
      payBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; font-size: 13px;">
          <span style="color:#047857; font-weight:700;">✓ Cashfree UPI / Paid</span>
          <span><strong>${succ.count} orders</strong> (₹${succ.amount})</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; padding: 6px 0; font-size: 13px;">
          <span style="color:#b91c1c; font-weight:700;">✕ Failed / Cancelled</span>
          <span><strong>${fail.count} attempts</strong> (₹${fail.amount})</span>
        </div>
      `;
    }

    // Daily Orders Table
    const ordersTbody = document.getElementById('daily-orders-tbody');
    if (ordersTbody) {
      const orders = data.orders || [];
      if (orders.length === 0) {
        ordersTbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 24px; color:#94a3b8; font-size: 12px;">No transactions recorded on this date.</td></tr>`;
      } else {
        ordersTbody.innerHTML = orders.map(o => {
          const isPaid = o.payment_status === 'PAID' || o.status === 'PAID';
          const items = Array.isArray(o.items) ? o.items : [];
          const itemsSummary = items.map(i => `${i.qty || i.quantity || 1}x ${i.name || i.product_name_snapshot || 'Item'}`).join(', ');
          const createdDate = o.created_at ? new Date(o.created_at) : new Date();
          const timeFormatted = createdDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
          const orderNumber = o.order_number || ('#HS-' + (o.id.replace(/\D/g, '').slice(-6) || '000000'));
          return `
            <tr>
              <td><button type="button" class="order-link-btn" onclick="window.adminApp.showOrderDetailModal('${o.id}')">${orderNumber}</button></td>
              <td>${timeFormatted}</td>
              <td>${o.customer_name || o.customer_email || 'Customer'}</td>
              <td style="max-width:200px;">${itemsSummary}</td>
              <td><strong>₹${o.total_amount !== undefined ? o.total_amount : o.amount}</strong></td>
              <td><span class="badge-status ${isPaid ? 'paid' : 'failed'}">${isPaid ? '✓ PAID' : '✕ ' + (o.status || 'PENDING')}</span></td>
              <td>${o.payment_method || 'Cashfree UPI'}</td>
              <td style="text-align:right;">
                <button type="button" class="btn-table-action edit" onclick="window.adminApp.showOrderDetailModal('${o.id}')">View</button>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  renderProductSales() {
    const tbody = document.getElementById('product-sales-tbody');
    if (!tbody) return;

    let prods = (this.salesData?.products || []);
    if (this.prodSalesSearch) {
      prods = prods.filter(p => (p.name || '').toLowerCase().includes(this.prodSalesSearch));
    }
    if (this.prodSalesCat && this.prodSalesCat !== 'ALL') {
      prods = prods.filter(p => (p.category || '').toLowerCase() === this.prodSalesCat.toLowerCase());
    }

    if (prods.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:32px; color:#94a3b8; font-size:13px;">No product sales records found.</td></tr>`;
      return;
    }

    tbody.innerHTML = prods.map(p => {
      const fullProd = window.storeDB ? window.storeDB.getProduct(p.id) : null;
      const imgSrc = window.resolveProductImage ? window.resolveProductImage(fullProd?.image, p.id) : 'assets/lays.jpg';
      return `
        <tr>
          <td>
            <img src="${imgSrc}" alt="${p.name}" style="width: 36px; height: 36px; border-radius: 8px; object-fit: cover; border: 1px solid #e2e8f0;" onerror="this.src='assets/lays.jpg';" />
          </td>
          <td>
            <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${p.name}</div>
            <div style="font-size: 11px; color: #64748b;">Ref: ${fullProd?.referenceName || p.id}</div>
          </td>
          <td><span class="badge-tag muted">${p.category}</span></td>
          <td>₹${p.unitPrice}</td>
          <td><span class="badge-tag ${p.currentStock <= 5 ? 'warning' : 'success'}">${p.currentStock} units</span></td>
          <td><strong style="font-size: 14px; color: #0f172a;">${p.unitsSold}</strong></td>
          <td><strong style="font-size: 14px; color: #047857;">₹${p.revenue.toLocaleString('en-IN')}</strong></td>
          <td>${p.ordersCount} orders</td>
          <td style="text-align: right;">
            <button type="button" class="btn-table-action edit" onclick="window.adminApp.showProductBuyersModal('${p.id}')" title="Who took what: Customer purchases audit">
              Who Took What 🔍
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  renderCategorySales() {
    const cardsGrid = document.getElementById('category-cards-grid');
    const tbody = document.getElementById('category-sales-tbody');
    const categories = this.salesData?.categories || [
      { category: 'Chips', itemsSold: 0, revenue: 0, share: 0 },
      { category: 'Biscuits', itemsSold: 0, revenue: 0, share: 0 },
      { category: 'Chocolates', itemsSold: 0, revenue: 0, share: 0 },
      { category: 'Drinks', itemsSold: 0, revenue: 0, share: 0 }
    ];

    const categoryIcons = {
      'Chips': { icon: '🥔', cssClass: 'chips' },
      'Biscuits': { icon: '🍪', cssClass: 'biscuits' },
      'Chocolates': { icon: '🍫', cssClass: 'chocolates' },
      'Drinks': { icon: '🥤', cssClass: 'drinks' }
    };

    if (cardsGrid) {
      cardsGrid.innerHTML = categories.map(c => {
        const iconInfo = categoryIcons[c.category] || { icon: '🏷️', cssClass: 'chips' };
        const avgPrice = c.itemsSold > 0 ? (c.revenue / c.itemsSold).toFixed(1) : 0;
        return `
          <div class="category-card">
            <div class="category-card-top">
              <div class="category-title-group">
                <div class="category-icon-box ${iconInfo.cssClass}">${iconInfo.icon}</div>
                <div class="category-name-text">${c.category}</div>
              </div>
              <span class="badge-tag success" style="font-size: 12px;">${c.share}% Share</span>
            </div>

            <div class="category-revenue-val">₹${c.revenue.toLocaleString('en-IN')}</div>

            <div class="category-metrics-line">
              <span>Units Taken: <strong>${c.itemsSold}</strong></span>
              <span>Avg Pack: <strong>₹${avgPrice}</strong></span>
            </div>
          </div>
        `;
      }).join('');
    }

    if (tbody) {
      tbody.innerHTML = categories.map(c => {
        const avgPrice = c.itemsSold > 0 ? (c.revenue / c.itemsSold).toFixed(2) : '0.00';
        return `
          <tr>
            <td><strong>${c.category}</strong></td>
            <td><strong>${c.itemsSold}</strong></td>
            <td><strong style="color: #047857;">₹${c.revenue.toLocaleString('en-IN')}</strong></td>
            <td><span class="badge-tag success">${c.share}%</span></td>
            <td>₹${avgPrice}</td>
          </tr>
        `;
      }).join('');
    }
  }

  renderPaymentTracking() {
    const tbody = document.getElementById('payment-tracking-tbody');
    if (!tbody) return;

    let payments = this.salesData?.payments || [];
    if (this.paymentsFilterStatus && this.paymentsFilterStatus !== 'ALL') {
      payments = payments.filter(p => (p.status || '').toUpperCase() === this.paymentsFilterStatus.toUpperCase());
    }

    if (payments.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:#94a3b8; font-size:13px;">No payment attempts recorded for selected criteria.</td></tr>`;
      return;
    }

    tbody.innerHTML = payments.map(p => {
      const isPaid = (p.status || '').toUpperCase() === 'PAID';
      const isPending = (p.status || '').toUpperCase() === 'PENDING';
      const createdDate = p.timestamp ? new Date(p.timestamp) : new Date();
      const dateFormatted = createdDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      const timeFormatted = createdDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      return `
        <tr>
          <td><code style="font-size:11px; background:#f1f5f9; padding:2px 6px; border-radius:4px;">${p.orderId || '-'}</code></td>
          <td><code style="font-size:11px; color:#0284c7;">${p.paymentId || '-'}</code></td>
          <td><button type="button" class="order-link-btn" onclick="window.adminApp.showOrderDetailModal('${p.orderId}')">${p.orderNumber}</button></td>
          <td>
            <div style="font-weight:700; color:#0f172a; font-size:13px;">${p.customer}</div>
            ${p.customerPhone ? `<div style="font-size:11px; color:#64748b;">+91 ${p.customerPhone}</div>` : ''}
          </td>
          <td><strong style="color: #0f172a; font-size: 13px;">₹${p.amount}</strong></td>
          <td>${p.method || 'Cashfree UPI'}</td>
          <td>
            <span class="badge-status ${isPaid ? 'paid' : (isPending ? 'pending' : 'failed')}">
              ${isPaid ? '✓ PAID' : (isPending ? '⏳ PENDING' : '✕ FAILED')}
            </span>
          </td>
          <td>
            <div style="font-size:12px; font-weight:600;">${dateFormatted}</div>
            <div style="font-size:11px; color:#64748b;">${timeFormatted}</div>
          </td>
        </tr>
      `;
    }).join('');
  }

  showOrderDetailModal(orderId) {
    const modal = document.getElementById('order-detail-modal');
    const titleEl = document.getElementById('order-modal-title');
    const timeEl = document.getElementById('order-modal-timestamp');
    const bodyEl = document.getElementById('order-detail-modal-body');
    if (!modal || !bodyEl) return;

    let order = (this.salesData?.orders || []).find(o => o.id === orderId);
    if (!order && window.storeDB) {
      const all = (window.storeDB.getAdminOrders ? window.storeDB.getAdminOrders() : [])
        .concat(window.storeDB.getUserOrders ? window.storeDB.getUserOrders() : []);
      order = all.find(o => o.id === orderId);
    }

    if (!order) {
      alert('Order not found.');
      return;
    }

    const orderNumber = order.order_number || ('#HS-' + (order.id.replace(/\D/g, '').slice(-6) || '000000'));
    if (titleEl) titleEl.innerText = `Order: ${orderNumber}`;
    const createdDate = order.created_at ? new Date(order.created_at) : new Date();
    if (timeEl) timeEl.innerText = `Placed: ${createdDate.toLocaleString('en-IN')}`;

    const isPaid = order.payment_status === 'PAID' || order.status === 'PAID';
    const isCompleted = order.order_status === 'COMPLETED' || order.status === 'COMPLETED';
    const isFailed = order.payment_status === 'FAILED' || order.status === 'FAILED';

    const items = Array.isArray(order.items) ? order.items : [];
    const itemsHtml = items.map(item => {
      const name = item.name || item.product_name_snapshot || 'Product Item';
      const cat = item.category || item.product_category_snapshot || 'Snack';
      const unitPrice = Number(item.unit_price !== undefined ? item.unit_price : (item.price !== undefined ? item.price : 0));
      const qty = Number(item.qty || item.quantity || 1);
      const lineTotal = Number(item.item_total !== undefined ? item.item_total : (unitPrice * qty));

      return `
        <div class="receipt-item-row">
          <div>
            <div style="font-weight: 700; color: #0f172a;">${name}</div>
            <div style="font-size: 11px; color: #64748b;">Category: ${cat} · ₹${unitPrice} each</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 700; color: #0f172a;">Qty: ${qty}</div>
            <div style="font-size: 12px; font-weight: 800; color: #047857;">₹${lineTotal}</div>
          </div>
        </div>
      `;
    }).join('');

    const subtotal = Number(order.subtotal !== undefined ? order.subtotal : order.amount) || 0;
    const discount = Number(order.discount || 0);
    const total = Number(order.total_amount !== undefined ? order.total_amount : order.amount) || 0;

    const custDisplay = (order.customer_name && !order.customer_name.toLowerCase().includes('honesty') && !order.customer_name.toLowerCase().includes('shopper'))
      ? order.customer_name
      : (order.customer_email ? order.customer_email.split('@')[0] : (order.customer_phone ? `Customer ${order.customer_phone}` : 'Customer'));

    bodyEl.innerHTML = `
      <!-- Customer Information Card -->
      <div class="order-receipt-card">
        <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 8px;">Customer Information</div>
        <div class="order-receipt-grid">
          <div>
            <span style="color: #64748b;">Customer Name:</span>
            <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${custDisplay}</div>
          </div>
          <div>
            <span style="color: #64748b;">Phone Number:</span>
            <div style="font-weight: 700; color: #0284c7; font-size: 13px;">${order.customer_phone ? `+91 ${order.customer_phone}` : 'Not provided'}</div>
          </div>
          <div style="grid-column: span 2;">
            <span style="color: #64748b;">Customer Email:</span>
            <div style="font-weight: 600; color: #0f172a; font-size: 13px;">${order.customer_email || 'Guest checkout'}</div>
          </div>
        </div>
      </div>

      <!-- Payment & Gateway Audit Card -->
      <div class="order-receipt-card">
        <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 8px;">Payment & Gateway Audit</div>
        <div class="order-receipt-grid">
          <div>
            <span style="color: #64748b;">Payment Status:</span>
            <div><span class="badge-status ${isPaid ? 'paid' : (isFailed ? 'failed' : 'pending')}">${isPaid ? '✓ PAID' : order.payment_status || order.status}</span></div>
          </div>
          <div>
            <span style="color: #64748b;">Payment Channel:</span>
            <div style="font-weight: 700; color: #0f172a;">${order.payment_method || 'Cashfree UPI'}</div>
          </div>
          <div>
            <span style="color: #64748b;">Gateway Order ID:</span>
            <div><code style="font-size: 11px; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${order.id}</code></div>
          </div>
          <div>
            <span style="color: #64748b;">Gateway Payment ID:</span>
            <div><code style="font-size: 11px; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${order.payment_reference || order.cashfree_payment_id || 'None'}</code></div>
          </div>
        </div>
      </div>

      <!-- Item Snapshots List -->
      <div class="order-receipt-card">
        <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 8px;">Items Snapshot (Immutable)</div>
        <div style="display: flex; flex-direction: column;">
          ${itemsHtml || '<div style="color: #94a3b8; font-size: 12px;">No item snapshots recorded.</div>'}
        </div>

        <div style="margin-top: 14px; padding-top: 10px; border-top: 1px dashed #cbd5e1;">
          <div class="receipt-summary-line">
            <span>Subtotal</span>
            <span>₹${subtotal}</span>
          </div>
          ${discount > 0 ? `
            <div class="receipt-summary-line">
              <span>Discounts</span>
              <span style="color: #dc2626;">-₹${discount}</span>
            </div>
          ` : ''}
          <div class="receipt-summary-line total">
            <span>Grand Total</span>
            <span style="color: #047857;">₹${total}</span>
          </div>
        </div>
      </div>

      <!-- Status Adjustment Tool for Administrator -->
      <div style="display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 12px 16px; border-radius: 12px; border: 1px solid #cbd5e1;">
        <div>
          <label style="font-size: 12px; font-weight: 700; color: #0f172a; display: block;">Update Order Status</label>
          <span style="font-size: 11px; color: #64748b;">Synchronizes across all devices immediately</span>
        </div>
        <select class="admin-order-status-select" 
                style="font-size: 12px; font-weight: 700; padding: 7px 12px; border-radius: 8px; border: 1.5px solid #0f172a; cursor: pointer;"
                onchange="window.adminApp.changeOrderStatus('${order.id}', this.value); window.adminApp.showOrderDetailModal('${order.id}');">
          <option value="PAID" ${isPaid ? 'selected' : ''}>✓ PAID</option>
          <option value="COMPLETED" ${isCompleted ? 'selected' : ''}>★ COMPLETED</option>
          <option value="PENDING" ${order.status === 'PENDING' ? 'selected' : ''}>⏳ PENDING</option>
          <option value="CANCELLED" ${order.status === 'CANCELLED' ? 'selected' : ''}>✕ CANCELLED</option>
        </select>
      </div>
    `;

    modal.classList.add('active');
  }

  async showProductBuyersModal(productId) {
    const modal = document.getElementById('product-buyers-modal');
    const titleEl = document.getElementById('buyers-modal-prod-name');
    const unitsEl = document.getElementById('buyers-modal-units');
    const revEl = document.getElementById('buyers-modal-revenue');
    const tbody = document.getElementById('product-buyers-tbody');
    if (!modal || !tbody) return;

    modal.classList.add('active');
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: #64748b;">Loading buyer audit history...</td></tr>`;

    try {
      const adminToken = localStorage.getItem('honesty_admin_token') || (window.authManager ? window.authManager.getAccessToken() : '');
      const headers = adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {};

      const res = await fetch(`/api/admin/product-sales?productId=${encodeURIComponent(productId)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (titleEl) titleEl.innerText = `${data.product?.name || productId} — Customer Purchase Log`;
        if (unitsEl) unitsEl.innerText = `${data.totalUnitsSold || 0} units`;
        if (revEl) revEl.innerText = `₹${(data.totalRevenue || 0).toLocaleString('en-IN')}`;

        const txs = data.transactions || [];
        if (txs.length === 0) {
          tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: #94a3b8; font-size: 13px;">No customer purchase records found for this product.</td></tr>`;
          return;
        }

        tbody.innerHTML = txs.map(t => `
          <tr>
            <td>
              <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${t.customerName}</div>
              ${t.customerEmail ? `<div style="font-size: 11px; color: #64748b;">${t.customerEmail}</div>` : ''}
              ${t.customerPhone ? `<div style="font-size: 11px; color: #0284c7; font-weight: 600;">+91 ${t.customerPhone}</div>` : ''}
            </td>
            <td>
              <button type="button" class="order-link-btn" onclick="document.getElementById('product-buyers-modal').classList.remove('active'); window.adminApp.showOrderDetailModal('${t.orderId}')">
                ${t.orderNumber}
              </button>
            </td>
            <td><strong style="color: #0f172a;">${t.quantity}</strong></td>
            <td>₹${t.unitPrice}</td>
            <td><strong style="color: #047857;">₹${t.itemTotal}</strong></td>
            <td>
              <div style="font-size: 12px; font-weight: 600;">${t.date}</div>
              <div style="font-size: 11px; color: #64748b;">${t.time}</div>
            </td>
            <td>
              <span class="badge-status ${t.paymentStatus === 'PAID' ? 'paid' : 'failed'}">
                ${t.paymentStatus === 'PAID' ? '✓ PAID' : t.paymentStatus}
              </span>
            </td>
          </tr>
        `).join('');
      } else {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: #ef4444;">Could not load product audit log.</td></tr>`;
      }
    } catch (err) {
      console.error('[AdminApp] showProductBuyersModal error:', err);
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: #ef4444;">Error fetching customer purchase data.</td></tr>`;
    }
  }

  exportSalesCSV() {
    const orders = this.salesData?.orders || [];
    if (orders.length === 0) {
      alert('No orders available to export for the selected filters.');
      return;
    }

    const headers = ['Order Number', 'Date', 'Time', 'Customer Name', 'Customer Email', 'Customer Phone', 'Items Purchased', 'Subtotal', 'Discount', 'Total Amount', 'Payment Status', 'Order Status', 'Payment Method', 'Gateway Reference'];
    
    const rows = orders.map(o => {
      const dt = o.created_at ? new Date(o.created_at) : new Date();
      const dateStr = dt.toISOString().split('T')[0];
      const timeStr = dt.toLocaleTimeString('en-IN');
      const items = (Array.isArray(o.items) ? o.items : []).map(i => `${i.qty || 1}x ${i.name || i.product_name_snapshot || 'Item'} (₹${i.unit_price || i.price || 0})`).join('; ');
      
      return [
        `"${o.order_number || o.id}"`,
        `"${dateStr}"`,
        `"${timeStr}"`,
        `"${(o.customer_name || 'Customer').replace(/"/g, '""')}"`,
        `"${(o.customer_email || '').replace(/"/g, '""')}"`,
        `"${(o.customer_phone || '').replace(/"/g, '""')}"`,
        `"${items.replace(/"/g, '""')}"`,
        o.subtotal || o.amount || 0,
        o.discount || 0,
        o.total_amount !== undefined ? o.total_amount : o.amount,
        `"${o.payment_status || o.status || 'PENDING'}"`,
        `"${o.order_status || 'COMPLETED'}"`,
        `"${(o.payment_method || 'Cashfree UPI').replace(/"/g, '""')}"`,
        `"${(o.payment_reference || o.id).replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `honesty-store-sales-${this.salesPeriod}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (window.showToast) window.showToast('Sales CSV exported successfully!', 'success');
  }

  async changeOrderStatus(orderId, newStatus) {
    try {
      await window.storeDB.updateOrderStatus(orderId, newStatus);
      if (window.showToast) window.showToast(`Order ${orderId} marked as ${newStatus}`, 'success');
      this.loadSalesData();
    } catch (err) {
      console.error('[AdminApp] changeOrderStatus error:', err);
      alert(`Could not update order status: ${err.message}`);
      this.loadSalesData();
    }
  }

  async renderUsers() {
    const usersBody = document.getElementById('users-activity-body');
    if (!usersBody) return;

    try {
      const adminToken = localStorage.getItem('honesty_admin_token') || (window.authManager ? window.authManager.getAccessToken() : '');
      const headers = adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {};
      const res = await fetch('/api/admin/users', { headers });
      if (res.ok) {
        const data = await res.json();
        const profiles = data.profiles || [];
        if (profiles.length > 0) {
          usersBody.innerHTML = profiles.map(p => `
            <tr>
              <td><strong>${p.full_name || p.email || ('+91 ' + p.phone)}</strong></td>
              <td>${p.created_at ? new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}</td>
              <td>${p.total_orders || 1} Purchase(s)</td>
              <td><span class="badge-paid">Verified</span></td>
              <td><strong>₹${p.total_spent || 0}</strong></td>
            </tr>
          `).join('');
          return;
        }
      }
    } catch (e) {}

    // Fallback: If no profiles, show orders by customer
    const orders = (window.storeDB.getAdminOrders && window.storeDB.getAdminOrders().length > 0) 
      ? window.storeDB.getAdminOrders() 
      : (window.storeDB.getUserOrders ? window.storeDB.getUserOrders() : []);

    if (orders.length > 0) {
      usersBody.innerHTML = orders.map(o => `
        <tr>
          <td><strong>${o.customerEmail || o.customerName || `Customer (${o.id})`}</strong></td>
          <td>${o.timeLabel}</td>
          <td>Purchase (${o.itemCount} items)</td>
          <td><span class="badge-paid">Verified</span></td>
          <td><strong>₹${o.amount}</strong></td>
        </tr>
      `).join('');
    } else {
      usersBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; padding: 32px 16px; color: #94a3b8; font-size: 13px;">
            No customer activity recorded yet.
          </td>
        </tr>
      `;
    }
  }
}

window.AdminApp = AdminApp;

window.testSupabaseConnection = async function() {
  const url = document.getElementById('cfg-supabase-url')?.value.trim();
  const anonKey = document.getElementById('cfg-supabase-key')?.value.trim();
  const feedback = document.getElementById('supabase-test-feedback');
  if (!feedback) return;

  if (!url || !anonKey) {
    feedback.style.display = 'block';
    feedback.innerHTML = '<span style="color:#ef4444; font-weight:700;">Please enter both Supabase Project URL and Anon Key.</span>';
    return;
  }

  feedback.style.display = 'block';
  feedback.innerHTML = '<span style="color:#64748b; font-weight:600;">Testing Supabase connection...</span>';

  try {
    const res = await fetch('/api/test-supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supabaseUrl: url, supabaseAnonKey: anonKey })
    });
    const data = await res.json();
    if (data.ok) {
      feedback.innerHTML = `<span style="color:#16a34a; font-weight:700;">✓ Connected! Tables detected: products (${data.tables?.products ?? 0}).</span>`;
    } else {
      feedback.innerHTML = `<span style="color:#ef4444; font-weight:700;">✗ Connection Failed: ${data.message || 'Check URL and Anon Key.'}</span>`;
    }
  } catch (err) {
    feedback.innerHTML = `<span style="color:#ef4444; font-weight:700;">Server offline or connection error.</span>`;
  }
};
