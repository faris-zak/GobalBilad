/**
 * جوب البلاد — Reusable UI Components
 * Each function writes HTML into a target element.
 */

const Components = {

  // ================================================================
  // Navbar
  // ================================================================

  renderNavbar() {
    const el = document.getElementById('navbar');
    if (!el) return;

    const profile = App.profile;
    const path    = window.location.pathname;

    const userMenu = profile
      ? `<div class="navbar-user">
           <span class="navbar-username">${Helpers.escapeHtml(profile.name || 'مستخدم')}</span>
           <div class="navbar-dropdown">
             ${this._navDashboardLink(profile.role)}
             <a href="/profile.html">الملف الشخصي</a>
             <button onclick="AuthAPI.signOut()" class="btn-link text-danger">تسجيل الخروج</button>
           </div>
         </div>`
      : `<a href="/login.html" class="btn btn-primary btn-sm">تسجيل الدخول</a>`;

    el.innerHTML = `
      <nav class="navbar" role="navigation" aria-label="القائمة الرئيسية">
        <div class="container navbar-inner">
          <a href="/index.html" class="navbar-brand">
            <span class="navbar-logo">🏪</span>
            <span class="navbar-title">${CONSTANTS.APP_NAME}</span>
          </a>
          <div class="navbar-actions">
            ${profile?.role === 'customer' || !profile
              ? `<a href="/cart.html" class="navbar-cart" aria-label="السلة">
                   🛒 <span id="cart-badge" class="cart-badge" style="display:none">0</span>
                 </a>`
              : ''}
            ${userMenu}
          </div>
        </div>
      </nav>
    `;

    this.updateCartBadge();
  },

  _navDashboardLink(role) {
    const links = {
      store:  '<a href="/dashboard/store.html">لوحة التحكم</a>',
      driver: '<a href="/dashboard/driver.html">لوحة التوصيل</a>',
      admin:  '<a href="/dashboard/admin.html">إدارة النظام</a>',
    };
    return links[role] || '<a href="/index.html">الرئيسية</a>';
  },

  updateCartBadge() {
    const badge = document.getElementById('cart-badge');
    if (!badge) return;
    const count = Cart.getTotalCount();
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  },

  // ================================================================
  // Store Card
  // ================================================================

  /**
   * Build HTML for a store card used in the home page grid.
   * @param {Object} store
   * @returns {string}
   */
  storeCard(store) {
    const categoryLabels = {
      grocery:     'بقالة',
      restaurant:  'مطعم',
      bakery:      'مخبز',
      pharmacy:    'صيدلية',
      electronics: 'إلكترونيات',
      general:     'عام',
    };
    const catLabel = categoryLabels[store.category] || 'متجر';

    return `
      <a href="/store.html?id=${store.id}" class="store-card" aria-label="${Helpers.escapeHtml(store.name)}">
        <div class="store-card-icon">${this._categoryIcon(store.category)}</div>
        <div class="store-card-body">
          <h3 class="store-card-name">${Helpers.escapeHtml(store.name)}</h3>
          <span class="badge badge-outline">${catLabel}</span>
          ${store.description
            ? `<p class="store-card-desc">${Helpers.escapeHtml(Helpers.truncate(store.description, 60))}</p>`
            : ''}
        </div>
        <span class="store-card-arrow">←</span>
      </a>
    `;
  },

  _categoryIcon(category) {
    const icons = {
      grocery: '🛒', restaurant: '🍽', bakery: '🥖',
      pharmacy: '💊', electronics: '📱', general: '🏪',
    };
    return icons[category] || '🏪';
  },

  // ================================================================
  // Product Card
  // ================================================================

  /**
   * Build HTML for a single product card.
   * @param {Object} product
   * @param {string} storeId
   * @param {string} storeName
   * @returns {string}
   */
  productCard(product, storeId, storeName) {
    const qty = Cart.getItemQty(storeId, product.id);
    return `
      <div class="product-card" data-product-id="${product.id}">
        ${product.image_url
          ? `<img src="${Helpers.escapeHtml(product.image_url)}" alt="${Helpers.escapeHtml(product.name)}" class="product-img" loading="lazy">`
          : `<div class="product-img-placeholder">🛍</div>`}
        <div class="product-body">
          <h4 class="product-name">${Helpers.escapeHtml(product.name)}</h4>
          ${product.description
            ? `<p class="product-desc">${Helpers.escapeHtml(Helpers.truncate(product.description, 50))}</p>`
            : ''}
          <div class="product-footer">
            <span class="product-price">${Helpers.formatPrice(product.price)}</span>
            ${qty > 0
              ? `<div class="qty-control">
                   <button class="qty-btn" onclick="Cart.setQuantity('${storeId}','${product.id}',${qty - 1});Components.refreshProductCard('${product.id}','${storeId}','${Helpers.escapeHtml(storeName)}')">−</button>
                   <span class="qty-value">${qty}</span>
                   <button class="qty-btn" onclick="Cart.addItem('${storeId}','${Helpers.escapeHtml(storeName)}',${JSON.stringify(product).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/"/g,'&quot;')});Components.refreshProductCard('${product.id}','${storeId}','${Helpers.escapeHtml(storeName)}')">+</button>
                 </div>`
              : `<button class="btn btn-primary btn-sm"
                   onclick="Cart.addItem('${storeId}','${Helpers.escapeHtml(storeName)}',${JSON.stringify({ id: product.id, name: product.name, price: product.price }).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/"/g,'&quot;')});Components.refreshProductCard('${product.id}','${storeId}','${Helpers.escapeHtml(storeName)}')">
                   أضف +
                 </button>`}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Re-render a single product card in place (after cart change).
   * Requires the product data still available in window._currentProducts.
   */
  refreshProductCard(productId, storeId, storeName) {
    const card = document.querySelector(`.product-card[data-product-id="${productId}"]`);
    if (!card) return;
    const product = (window._currentProducts || []).find(p => p.id === productId);
    if (!product) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = this.productCard(product, storeId, storeName);
    card.replaceWith(tmp.firstElementChild);
    this.updateCartBadge();
  },

  // ================================================================
  // Order Status Badge
  // ================================================================

  statusBadge(status) {
    const label = CONSTANTS.ORDER_STATUS_LABELS[status] || status;
    const color = CONSTANTS.ORDER_STATUS_COLORS[status] || '#6b7280';
    return `<span class="status-badge" style="background:${color}20;color:${color};border:1px solid ${color}40">${label}</span>`;
  },

  // ================================================================
  // Empty State
  // ================================================================

  emptyState(icon, title, subtitle = '', actionHtml = '') {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">${icon}</div>
        <h3 class="empty-state-title">${Helpers.escapeHtml(title)}</h3>
        ${subtitle ? `<p class="empty-state-sub">${Helpers.escapeHtml(subtitle)}</p>` : ''}
        ${actionHtml}
      </div>
    `;
  },

  // ================================================================
  // Loading Spinner
  // ================================================================

  spinner() {
    return `<div class="spinner-wrap"><div class="spinner" aria-label="جاري التحميل..."></div></div>`;
  },

  // ================================================================
  // Location Blocked Banner
  // ================================================================

  renderLocationBanner() {
    const el = document.getElementById('location-blocked');
    if (!el) return;
    el.innerHTML = `
      <div class="location-blocked-inner">
        <div class="location-blocked-icon">📍</div>
        <h2>خارج منطقة التغطية</h2>
        <p>
          عذراً، منصة <strong>${CONSTANTS.APP_NAME}</strong> متاحة فقط
          لسكان <strong>${CONSTANTS.AREA.NAME}</strong>.
        </p>
        <p class="text-muted">هل أنت في المنطقة ولكن لم يتم التعرف على موقعك؟</p>
        <button class="btn btn-primary" onclick="LocationService.manualConfirm();location.reload()">
          نعم، أنا في ${CONSTANTS.AREA.NAME}
        </button>
        <button class="btn btn-ghost" onclick="LocationService.clearCache();location.reload()">
          إعادة المحاولة
        </button>
      </div>
    `;
  },

};
