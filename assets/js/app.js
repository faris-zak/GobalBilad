// =============================================
//  GobalBilad — Main JavaScript (Refactored)
//  Scope: Auth, API, store browsing, product pages,
//         dashboard management, WhatsApp ordering.
// =============================================

'use strict';

// ---------------------------------------------
// Configuration
// ---------------------------------------------
const APP_CONFIG = {
  SUPABASE_URL: 'https://euequlunrvrbslsjrqpp.supabase.co',
  SUPABASE_ANON: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1ZXF1bHVucnZyYnNsc2pycXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzAyMDAsImV4cCI6MjA4OTg0NjIwMH0.TV9888GZe7XU2FcMDHoMpTS4Cr_uX0lhwM7yKjGR4_8',
  SESSION_KEY: 'gb_session',
  DEFAULT_PHONE: '96812345678',
  OWNER_PROFILE_KEY: 'gb_owner_profile',
  CART_KEY: 'gb_cart_items',
  CART_PAYMENT_KEY: 'gb_cart_payment_method'
};

// ---------------------------------------------
// Runtime state (kept small and page-scoped)
// ---------------------------------------------
const APP_STATE = {
  storesPage: {
    allStores: [],
    query: '',
    category: 'all'
  },
  storePage: {
    store: null,
    allProducts: [],
    activeCategory: 'all',
    searchQuery: ''
  },
  productPage: {
    currentProduct: null,
    currentStore: null,
    currentProductUrl: ''
  },
  cart: {
    items: [],
    paymentMethod: 'cash',
    contextStoreName: '',
    contextPhone: APP_CONFIG.DEFAULT_PHONE
  }
};

// ---------------------------------------------
// Shared utility helpers
// ---------------------------------------------
const Utils = {
  byId(id) {
    return document.getElementById(id);
  },

  getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  },

  // Protects HTML rendering from script injection.
  escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  // Formats Omani prices with 3 decimals (baisa precision).
  formatPrice(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(3) : '0.000';
  },

  cleanPhone(phone) {
    return String(phone || '').replace(/[^0-9]/g, '');
  },

  // Lightweight local SVG placeholder to avoid external image request.
  getPlaceholderImageDataUri(title) {
    return 'assets/images/placeholder-product.svg';
  },

  // Small generic empty-state renderer reused across pages.
  renderEmptyState(message, icon = '📦') {
    return `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-state-icon">${icon}</div>
        <p>${Utils.escapeHtml(message)}</p>
      </div>`;
  }
};

// ---------------------------------------------
// Owner profile module (localStorage only)
// ---------------------------------------------
function getDefaultOwnerProfile() {
  return {
    storeName: 'متجري المحلي',
    ownerName: 'صاحب المتجر',
    location: 'عُمان',
    phone: APP_CONFIG.DEFAULT_PHONE,
    picture: 'assets/images/placeholder-owner.svg'
  };
}

function getOwnerProfile() {
  try {
    const raw = localStorage.getItem(APP_CONFIG.OWNER_PROFILE_KEY);
    if (!raw) return getDefaultOwnerProfile();

    const parsed = JSON.parse(raw);
    return { ...getDefaultOwnerProfile(), ...parsed };
  } catch {
    return getDefaultOwnerProfile();
  }
}

function saveOwnerProfile(profile) {
  const merged = { ...getDefaultOwnerProfile(), ...profile };
  localStorage.setItem(APP_CONFIG.OWNER_PROFILE_KEY, JSON.stringify(merged));
  return merged;
}

function resetOwnerProfile() {
  localStorage.removeItem(APP_CONFIG.OWNER_PROFILE_KEY);
  loadOwnerPage();
}

function applyOwnerProfileToStore(store) {
  const owner = getOwnerProfile();
  return {
    ...store,
    name: owner.storeName || store?.name,
    description: owner.location
      ? `${store?.description || 'متجر محلي'} - ${owner.location}`
      : (store?.description || 'متجر محلي'),
    phone: owner.phone || store?.phone || APP_CONFIG.DEFAULT_PHONE,
    owner_name: owner.ownerName,
    picture: owner.picture
  };
}

function setTextById(id, value) {
  const el = Utils.byId(id);
  if (el) el.textContent = value;
}

function renderOwnerPreview(profile) {
  const image = Utils.byId('ownerPreviewImage');
  if (image) image.src = profile.picture || 'assets/images/placeholder-owner.svg';

  setTextById('ownerPreviewStoreName', profile.storeName || 'اسم المتجر');
  setTextById('ownerPreviewOwnerName', profile.ownerName || 'صاحب المتجر');
  setTextById('ownerPreviewLocation', profile.location || 'الموقع');
  setTextById('ownerPreviewPhone', profile.phone ? `واتساب: ${profile.phone}` : 'واتساب: غير محدد');
}

function loadOwnerPage() {
  const form = Utils.byId('ownerProfileForm');
  if (!form) return;

  const profile = getOwnerProfile();

  const storeName = Utils.byId('ownerStoreNameInput');
  const ownerName = Utils.byId('ownerNameInput');
  const location = Utils.byId('ownerLocationInput');
  const phone = Utils.byId('ownerPhoneInput');
  const pictureUrl = Utils.byId('ownerPictureUrlInput');
  const pictureFile = Utils.byId('ownerPictureInput');

  if (storeName) storeName.value = profile.storeName || '';
  if (ownerName) ownerName.value = profile.ownerName || '';
  if (location) location.value = profile.location || '';
  if (phone) phone.value = profile.phone || '';
  if (pictureUrl) pictureUrl.value = profile.picture?.startsWith('http') ? profile.picture : '';

  if (pictureFile && pictureFile.dataset.bound !== '1') {
    pictureFile.addEventListener('change', () => {
      const file = pictureFile.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const next = saveOwnerProfile({ ...getOwnerProfile(), picture: String(reader.result || '') });
        renderOwnerPreview(next);
      };
      reader.readAsDataURL(file);
    });

    pictureFile.dataset.bound = '1';
  }

  renderOwnerPreview(profile);
}

function saveOwnerProfileFromForm() {
  const nextProfile = saveOwnerProfile({
    storeName: Utils.byId('ownerStoreNameInput')?.value.trim(),
    ownerName: Utils.byId('ownerNameInput')?.value.trim(),
    location: Utils.byId('ownerLocationInput')?.value.trim(),
    phone: Utils.byId('ownerPhoneInput')?.value.trim(),
    picture: Utils.byId('ownerPictureUrlInput')?.value.trim() || getOwnerProfile().picture
  });

  renderOwnerPreview(nextProfile);

  const message = Utils.byId('ownerSaveMessage');
  if (message) {
    message.textContent = 'تم حفظ بيانات المتجر بنجاح.';
  }
}

function loadOwnerProfileIntoLanding() {
  const owner = getOwnerProfile();

  const ownerCard = Utils.byId('ownerLandingCard');
  if (!ownerCard) return;

  const ownerImage = Utils.byId('ownerLandingImage');
  if (ownerImage) ownerImage.src = owner.picture || 'assets/images/placeholder-owner.svg';

  setTextById('ownerLandingStoreName', owner.storeName || 'متجر محلي');
  setTextById('ownerLandingOwnerName', owner.ownerName || 'صاحب المتجر');
  setTextById('ownerLandingLocation', owner.location || 'عُمان');
}

// ---------------------------------------------
// Cart + billing module (localStorage only)
// ---------------------------------------------
function loadCartState() {
  try {
    const rawItems = localStorage.getItem(APP_CONFIG.CART_KEY);
    const rawPayment = localStorage.getItem(APP_CONFIG.CART_PAYMENT_KEY);

    APP_STATE.cart.items = rawItems ? JSON.parse(rawItems) : [];
    APP_STATE.cart.paymentMethod = rawPayment || 'cash';
  } catch {
    APP_STATE.cart.items = [];
    APP_STATE.cart.paymentMethod = 'cash';
  }
}

function saveCartState() {
  localStorage.setItem(APP_CONFIG.CART_KEY, JSON.stringify(APP_STATE.cart.items));
  localStorage.setItem(APP_CONFIG.CART_PAYMENT_KEY, APP_STATE.cart.paymentMethod);
}

function setCartContext(storeName, phone) {
  APP_STATE.cart.contextStoreName = storeName || 'Local Store';
  APP_STATE.cart.contextPhone = phone || APP_CONFIG.DEFAULT_PHONE;
}

function getCartTotal() {
  return APP_STATE.cart.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
}

function addProductToCart(product) {
  const existing = APP_STATE.cart.items.find((item) => item.id === product.id);

  if (existing) {
    existing.quantity += 1;
  } else {
    APP_STATE.cart.items.push({
      id: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      quantity: 1,
      url: product.url || '',
      image: product.image || 'assets/images/placeholder-product.svg'
    });
  }

  saveCartState();
  renderCartPanel();
}

function updateCartItemQuantity(itemId, delta) {
  APP_STATE.cart.items = APP_STATE.cart.items
    .map((item) => item.id === itemId ? { ...item, quantity: Math.max(0, Number(item.quantity) + Number(delta)) } : item)
    .filter((item) => item.quantity > 0);

  saveCartState();
  renderCartPanel();
}

function removeCartItem(itemId) {
  APP_STATE.cart.items = APP_STATE.cart.items.filter((item) => item.id !== itemId);
  saveCartState();
  renderCartPanel();
}

function clearCart() {
  APP_STATE.cart.items = [];
  saveCartState();
  renderCartPanel();
}

function setCartPaymentMethod(method) {
  APP_STATE.cart.paymentMethod = method || 'cash';
  saveCartState();
  renderCartPanel();
}

function getPaymentLabel(method) {
  if (method === 'card') return 'Card';
  if (method === 'online') return 'Online';
  return 'Cash';
}

function buildCartWhatsAppMessage() {
  const lines = [
    'Hello, I want to place an order:'
  ];

  APP_STATE.cart.items.forEach((item) => {
    lines.push(`${item.name} x ${item.quantity}`);
  });

  lines.push(`Total: ${Utils.formatPrice(getCartTotal())} OMR`);
  lines.push(`Payment method: ${getPaymentLabel(APP_STATE.cart.paymentMethod)}`);

  return lines.join('\n');
}

function buildCartWhatsAppLink() {
  const phone = Utils.cleanPhone(APP_STATE.cart.contextPhone || APP_CONFIG.DEFAULT_PHONE);
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildCartWhatsAppMessage())}`;
}

function renderCartPanel() {
  const listEl = Utils.byId('cartItemsList');
  const totalEl = Utils.byId('cartTotalValue');
  const countEl = Utils.byId('cartCountBadge');
  const paymentEl = Utils.byId('cartPaymentMethod');
  const waBtn = Utils.byId('cartWhatsAppBtn');
  const emptyEl = Utils.byId('cartEmptyMessage');

  if (!listEl || !totalEl || !countEl || !paymentEl || !waBtn || !emptyEl) return;

  countEl.textContent = String(APP_STATE.cart.items.reduce((s, i) => s + Number(i.quantity), 0));
  totalEl.textContent = `${Utils.formatPrice(getCartTotal())} OMR`;
  paymentEl.value = APP_STATE.cart.paymentMethod;

  if (APP_STATE.cart.items.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
    waBtn.classList.add('disabled');
    waBtn.href = '#';
    waBtn.setAttribute('aria-disabled', 'true');
    waBtn.setAttribute('tabindex', '-1');
    return;
  }

  emptyEl.style.display = 'none';
  waBtn.classList.remove('disabled');
  waBtn.removeAttribute('aria-disabled');
  waBtn.removeAttribute('tabindex');
  waBtn.href = buildCartWhatsAppLink();

  listEl.innerHTML = APP_STATE.cart.items.map((item) => `
    <article class="cart-item">
      <img src="${Utils.escapeHtml(item.image)}" alt="${Utils.escapeHtml(item.name)}" class="cart-item-image" loading="lazy" />

      <div class="cart-item-main">
        <h4>${Utils.escapeHtml(item.name)}</h4>
        <p>${Utils.formatPrice(item.price)} OMR</p>

        <div class="cart-qty-controls">
          <button type="button" onclick="updateCartItemQuantity('${item.id}', -1)">-</button>
          <span>${item.quantity}</span>
          <button type="button" onclick="updateCartItemQuantity('${item.id}', 1)">+</button>
          <button type="button" class="cart-remove-btn" onclick="removeCartItem('${item.id}')">حذف</button>
        </div>
      </div>
    </article>
  `).join('');
}

function toggleCartPanel(forceOpen) {
  const panel = Utils.byId('cartPanel');
  if (!panel) return;

  const open = typeof forceOpen === 'boolean' ? forceOpen : !panel.classList.contains('is-open');
  panel.classList.toggle('is-open', open);
}

function initCartUI(options = {}) {
  setCartContext(options.storeName, options.phone);

  const toggleBtn = Utils.byId('cartToggleBtn');
  const closeBtn = Utils.byId('cartCloseBtn');
  const paymentEl = Utils.byId('cartPaymentMethod');
  const clearBtn = Utils.byId('cartClearBtn');

  if (toggleBtn && toggleBtn.dataset.bound !== '1') {
    toggleBtn.addEventListener('click', () => toggleCartPanel());
    toggleBtn.dataset.bound = '1';
  }

  if (closeBtn && closeBtn.dataset.bound !== '1') {
    closeBtn.addEventListener('click', () => toggleCartPanel(false));
    closeBtn.dataset.bound = '1';
  }

  if (paymentEl && paymentEl.dataset.bound !== '1') {
    paymentEl.addEventListener('change', () => setCartPaymentMethod(paymentEl.value));
    paymentEl.dataset.bound = '1';
  }

  if (clearBtn && clearBtn.dataset.bound !== '1') {
    clearBtn.addEventListener('click', clearCart);
    clearBtn.dataset.bound = '1';
  }

  renderCartPanel();
}

loadCartState();

// ---------------------------------------------
// API client
// ---------------------------------------------
const Api = {
  getAuthToken() {
    const raw = localStorage.getItem(APP_CONFIG.SESSION_KEY);
    if (!raw) return null;

    try {
      const session = JSON.parse(raw);
      return session?.access_token || null;
    } catch {
      return null;
    }
  },

  setSession(sessionData) {
    localStorage.setItem(APP_CONFIG.SESSION_KEY, JSON.stringify(sessionData));
  },

  clearSession() {
    localStorage.removeItem(APP_CONFIG.SESSION_KEY);
  },

  getHeaders(token = null) {
    return {
      'Content-Type': 'application/json',
      apikey: APP_CONFIG.SUPABASE_ANON,
      Authorization: `Bearer ${token || APP_CONFIG.SUPABASE_ANON}`,
      Prefer: 'return=representation'
    };
  },

  async request(path, options = {}, customError = 'Request failed') {
    const response = await fetch(`${APP_CONFIG.SUPABASE_URL}${path}`, options);
    const text = await response.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      const message = data?.error_description || data?.message || data?.msg || customError;
      throw new Error(message);
    }

    return data;
  }
};

// ---------------------------------------------
// Auth functions (exported globally)
// ---------------------------------------------
async function signIn(email, password) {
  const data = await Api.request(
    '/auth/v1/token?grant_type=password',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: APP_CONFIG.SUPABASE_ANON
      },
      body: JSON.stringify({ email, password })
    },
    'Sign in failed'
  );

  Api.setSession(data);
  return data;
}

async function signUp(email, password, storeName) {
  const data = await Api.request(
    '/auth/v1/signup',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: APP_CONFIG.SUPABASE_ANON
      },
      body: JSON.stringify({ email, password })
    },
    'Sign up failed'
  );

  Api.setSession(data);

  if (data.user?.id) {
    await createStore({ id: data.user.id, name: storeName }, data.access_token);
  }

  return data;
}

async function handleSignOut() {
  Api.clearSession();
  window.location.href = 'index.html';
}

async function getCurrentUser() {
  const token = Api.getAuthToken();
  if (!token) return null;

  try {
    return await Api.request(
      '/auth/v1/user',
      {
        headers: {
          apikey: APP_CONFIG.SUPABASE_ANON,
          Authorization: `Bearer ${token}`
        }
      },
      'Failed to load current user'
    );
  } catch {
    return null;
  }
}

// ---------------------------------------------
// Data access functions
// ---------------------------------------------
async function fetchStores() {
  return Api.request(
    '/rest/v1/stores?order=created_at.desc',
    { headers: Api.getHeaders() },
    'Failed to load stores'
  );
}

async function fetchStore(storeId) {
  const data = await Api.request(
    `/rest/v1/stores?id=eq.${storeId}&limit=1`,
    { headers: Api.getHeaders() },
    'Failed to load store'
  );

  return data?.[0] || null;
}

async function createStore(store, token) {
  return Api.request(
    '/rest/v1/stores',
    {
      method: 'POST',
      headers: {
        ...Api.getHeaders(token),
        Prefer: 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(store)
    },
    'Failed to create store'
  );
}

async function ensureStoreExists(user) {
  let store = await fetchStore(user.id);

  if (!store) {
    const fallbackName = user.email?.split('@')[0] || 'My Store';
    await createStore({ id: user.id, name: fallbackName }, Api.getAuthToken());
    store = await fetchStore(user.id);
  }

  return store;
}

async function fetchProducts(storeId) {
  return Api.request(
    `/rest/v1/products?store_id=eq.${storeId}&order=created_at.desc`,
    { headers: Api.getHeaders() },
    'Failed to load products'
  );
}

async function fetchProduct(productId) {
  const data = await Api.request(
    `/rest/v1/products?id=eq.${productId}&limit=1`,
    { headers: Api.getHeaders() },
    'Failed to load product'
  );

  return data?.[0] || null;
}

async function addProduct(product) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not logged in');

  await ensureStoreExists(user);

  return Api.request(
    '/rest/v1/products',
    {
      method: 'POST',
      headers: Api.getHeaders(Api.getAuthToken()),
      body: JSON.stringify({ ...product, store_id: user.id })
    },
    'Failed to add product'
  );
}

async function updateProduct(productId, updates) {
  return Api.request(
    `/rest/v1/products?id=eq.${productId}`,
    {
      method: 'PATCH',
      headers: Api.getHeaders(Api.getAuthToken()),
      body: JSON.stringify(updates)
    },
    'Failed to update product'
  );
}

async function deleteProduct(productId) {
  if (!confirm('Delete this product? This cannot be undone.')) return;

  await Api.request(
    `/rest/v1/products?id=eq.${productId}`,
    {
      method: 'DELETE',
      headers: Api.getHeaders(Api.getAuthToken())
    },
    'Failed to delete product'
  );
}

// ---------------------------------------------
// WhatsApp link generator (single reusable source)
// ---------------------------------------------
function buildWhatsAppLink(phone, productName, productUrl, deliveryType = 'normal') {
  const cleanPhone = Utils.cleanPhone(phone);
  const delivery = deliveryType === 'urgent' ? 'Urgent' : 'Normal';

  const message = [
    'Hello, I want to order this product:',
    productName,
    productUrl,
    `Delivery type: ${delivery}`
  ].join('\n');

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

// ---------------------------------------------
// stores.html controller
// ---------------------------------------------
async function loadStores() {
  const container = Utils.byId('storesList');
  if (!container) return;

  try {
    APP_STATE.storesPage.allStores = await fetchStores();
    APP_STATE.storesPage.category = Utils.getQueryParam('category') || 'all';
    applyStoreFilters();
  } catch (error) {
    container.innerHTML = Utils.renderEmptyState(error.message, '⚠️');
  }
}

function filterStores(query) {
  APP_STATE.storesPage.query = String(query || '').trim().toLowerCase();
  applyStoreFilters();
}

function applyStoreFilters() {
  const { allStores, query, category } = APP_STATE.storesPage;

  const filtered = allStores.filter((store) => {
    const matchesCategory = category === 'all' || (store.category || '') === category;
    const text = `${store.name || ''} ${store.description || ''}`.toLowerCase();
    const matchesQuery = !query || text.includes(query);
    return matchesCategory && matchesQuery;
  });

  renderStores(filtered);
}

function renderStores(stores) {
  const container = Utils.byId('storesList');
  if (!container) return;

  if (!stores || stores.length === 0) {
    container.innerHTML = Utils.renderEmptyState('No stores yet. Be the first to join!', '🏪');
    return;
  }

  const icons = {
    grocery: '🛒',
    bakery: '🥖',
    meat: '🥩',
    dairy: '🥛',
    sweets: '🍬',
    drinks: '🧃',
    default: '🏪'
  };

  container.innerHTML = stores.map((store) => `
    <a href="store.html?id=${store.id}" class="store-card">
      <div class="store-card-icon">${icons[store.category] || icons.default}</div>
      <div class="store-card-info">
        <div class="store-card-name">${Utils.escapeHtml(store.name)}</div>
        <div class="store-card-desc">${Utils.escapeHtml(store.description || 'Local store')}</div>
      </div>
      <span class="store-card-arrow">›</span>
    </a>
  `).join('');
}

// ---------------------------------------------
// store.html controller
// ---------------------------------------------
async function loadStorePage() {
  const storeId = Utils.getQueryParam('id');
  if (!storeId) {
    window.location.href = 'stores.html';
    return;
  }

  try {
    const [rawStore, products] = await Promise.all([
      fetchStore(storeId),
      fetchProducts(storeId)
    ]);

    if (!rawStore) {
      window.location.href = 'stores.html';
      return;
    }

    const store = applyOwnerProfileToStore(rawStore);

    APP_STATE.storePage.store = store;
    APP_STATE.storePage.allProducts = products || [];
    APP_STATE.storePage.activeCategory = 'all';
    APP_STATE.storePage.searchQuery = '';

    document.title = `${store.name} — GobalBilad`;

    renderStoreHero();
    bindStoreSearchInput();
    bindStoreProductCardActions();
    renderStoreCategoryFilters();
    updateStoreProductsView();
    initCartUI({ storeName: store.name, phone: store.phone });
  } catch (error) {
    const hero = Utils.byId('storeHero');
    if (hero) hero.innerHTML = Utils.renderEmptyState(error.message, '⚠️');
  }
}

function renderStoreHero() {
  const hero = Utils.byId('storeHero');
  const { store, allProducts } = APP_STATE.storePage;
  if (!hero || !store) return;

  const cleanPhone = Utils.cleanPhone(store.phone);
  const picture = store.picture || 'assets/images/placeholder-store.svg';

  hero.innerHTML = `
    <div class="store-hero-inner store-hero-inner-v2">
      <a href="stores.html" class="back-link back-link-v2">العودة إلى المتاجر ←</a>

      <div class="store-hero-main">
        <div class="store-hero-icon store-hero-icon-image">
          <img src="${Utils.escapeHtml(picture)}" alt="${Utils.escapeHtml(store.name)}" loading="lazy" />
        </div>

        <div class="store-hero-info">
          <h1>${Utils.escapeHtml(store.name)}</h1>
          <p>${Utils.escapeHtml(store.description || 'متجر محلي يقدم منتجات يومية بجودة عالية')}</p>

          <div class="store-meta">
            <span class="store-meta-chip">${Utils.escapeHtml(store.category || 'متجر محلي')}</span>
            <span class="store-meta-chip">${allProducts.length} منتج</span>
            ${store.owner_name ? `<span class="store-meta-chip">المالك: ${Utils.escapeHtml(store.owner_name)}</span>` : ''}
          </div>

          <div class="store-links">
            ${store.phone ? `<a href="https://wa.me/${cleanPhone}" class="store-link store-link--wa" target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>` : ''}
            ${store.instagram ? `<a href="${Utils.escapeHtml(store.instagram)}" class="store-link" target="_blank" rel="noopener noreferrer">📸 Instagram</a>` : ''}
          </div>
        </div>
      </div>
    </div>`;
}

function bindStoreSearchInput() {
  const input = Utils.byId('storeProductSearch');
  if (!input || input.dataset.bound === '1') return;

  input.addEventListener('input', () => {
    APP_STATE.storePage.searchQuery = input.value.trim().toLowerCase();
    updateStoreProductsView();
  });

  input.dataset.bound = '1';
}

function bindStoreProductCardActions() {
  const container = Utils.byId('productsList');
  if (!container || container.dataset.bound === '1') return;

  container.addEventListener('click', (event) => {
    const button = event.target.closest('.js-add-cart-btn');
    if (!button) return;

    const product = {
      id: button.dataset.id || '',
      name: button.dataset.name || 'Product',
      price: Number(button.dataset.price || 0),
      image: button.dataset.image || 'assets/images/placeholder-product.svg',
      url: button.dataset.url || ''
    };

    addProductToCart(product);
    toggleCartPanel(true);
  });

  container.dataset.bound = '1';
}

function renderStoreCategoryFilters() {
  const container = Utils.byId('storeCategoryFilters');
  const { allProducts, activeCategory } = APP_STATE.storePage;
  if (!container) return;

  const categories = [...new Set(
    allProducts.map((product) => (product.category || '').trim()).filter(Boolean)
  )];

  if (categories.length <= 1) {
    container.innerHTML = '';
    return;
  }

  const chips = ['all', ...categories];
  container.innerHTML = chips.map((category) => {
    const label = category === 'all' ? 'الكل' : category;
    const active = category === activeCategory ? 'is-active' : '';

    return `
      <button
        type="button"
        class="category-filter-chip ${active}"
        data-category="${Utils.escapeHtml(category)}"
      >${Utils.escapeHtml(label)}</button>`;
  }).join('');

  container.querySelectorAll('.category-filter-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      APP_STATE.storePage.activeCategory = chip.dataset.category || 'all';
      renderStoreCategoryFilters();
      updateStoreProductsView();
    });
  });
}

function updateStoreProductsView() {
  const { allProducts, activeCategory, searchQuery, store } = APP_STATE.storePage;

  const filtered = allProducts.filter((product) => {
    const matchesCategory = activeCategory === 'all' || (product.category || '') === activeCategory;
    const searchableText = `${product.name || ''} ${product.description || ''}`.toLowerCase();
    const matchesSearch = !searchQuery || searchableText.includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

  renderProductCards(filtered, store);
}

function renderProductCards(products, store) {
  const container = Utils.byId('productsList');
  if (!container) return;

  if (!products || products.length === 0) {
    container.innerHTML = Utils.renderEmptyState('لا توجد منتجات مطابقة حاليا.', '📦');
    return;
  }

  const hasPhone = Boolean(Utils.cleanPhone(store?.phone || APP_CONFIG.DEFAULT_PHONE));

  container.innerHTML = products.map((product) => {
    const productUrl = `${window.location.origin}/product.html?id=${product.id}`;
    const imageUrl = product.image_url
      ? Utils.escapeHtml(product.image_url)
      : Utils.getPlaceholderImageDataUri(product.name);

    const waLink = hasPhone
      ? buildWhatsAppLink(store?.phone || APP_CONFIG.DEFAULT_PHONE, product.name, productUrl, 'normal')
      : '#';

    return `
      <article class="product-card product-card-v2">
        <div class="product-card-img">
          <img src="${imageUrl}" alt="${Utils.escapeHtml(product.name)}" loading="lazy" />
        </div>

        <div class="product-card-body">
          <div class="product-card-name">${Utils.escapeHtml(product.name)}</div>

          <div class="product-card-desc">
            ${Utils.escapeHtml(product.description || 'منتج محلي متوفر للطلب المباشر.')}
          </div>

          <div class="product-card-price">${Utils.formatPrice(product.price)} <span>OMR</span></div>

          <div class="product-card-actions">
            <a href="product.html?id=${product.id}" class="btn btn-ghost product-view-btn">عرض التفاصيل</a>
            <button
              type="button"
              class="btn btn-secondary js-add-cart-btn"
              data-id="${Utils.escapeHtml(product.id)}"
              data-name="${Utils.escapeHtml(product.name)}"
              data-price="${Number(product.price) || 0}"
              data-image="${Utils.escapeHtml(imageUrl)}"
              data-url="${Utils.escapeHtml(productUrl)}"
            >🧺 أضف إلى السلة</button>
            <a
              href="${waLink}"
              class="btn btn-wa product-order-btn ${hasPhone ? '' : 'disabled'}"
              target="_blank"
              rel="noopener noreferrer"
              ${hasPhone ? '' : 'aria-disabled="true" tabindex="-1"'}
            >💬 اطلب عبر واتساب</a>
          </div>
        </div>
      </article>`;
  }).join('');
}

// ---------------------------------------------
// product.html controller
// ---------------------------------------------
async function loadProductPage() {
  const productId = Utils.getQueryParam('id');
  if (!productId) {
    window.location.href = 'stores.html';
    return;
  }

  try {
    const product = await fetchProduct(productId);
    if (!product) {
      window.location.href = 'stores.html';
      return;
    }

    const [rawStore, storeProducts] = await Promise.all([
      fetchStore(product.store_id),
      fetchProducts(product.store_id)
    ]);

    const store = applyOwnerProfileToStore(rawStore || {});

    const backLink = Utils.byId('backLink');
    if (backLink) backLink.href = `store.html?id=${product.store_id}`;

    document.title = `${product.name} — GobalBilad`;

    const productImage = Utils.byId('productImg');
    if (productImage) {
      const imageUrl = product.image_url
        ? Utils.escapeHtml(product.image_url)
        : Utils.getPlaceholderImageDataUri(product.name);
      productImage.innerHTML = `<img src="${imageUrl}" alt="${Utils.escapeHtml(product.name)}" loading="lazy" />`;
    }

    APP_STATE.productPage.currentProduct = product;
    APP_STATE.productPage.currentStore = store;
    APP_STATE.productPage.currentProductUrl = window.location.href;

    renderProductDetail(product, store);
    renderRecommendedProducts(storeProducts, product.id);
    initCartUI({ storeName: store.name, phone: store.phone });
  } catch (error) {
    const info = Utils.byId('productInfo');
    if (info) info.innerHTML = Utils.renderEmptyState(error.message, '⚠️');

    const recommended = Utils.byId('recommendedProducts');
    if (recommended) recommended.innerHTML = '';
  }
}

function renderProductDetail(product, store) {
  const container = Utils.byId('productInfo');
  if (!container) return;

  const orderPhone = store?.phone || APP_CONFIG.DEFAULT_PHONE;
  const hasPhone = Boolean(Utils.cleanPhone(orderPhone));
  const productUrl = APP_STATE.productPage.currentProductUrl;

  container.innerHTML = `
    <div class="product-context">
      <span class="product-store-chip">${Utils.escapeHtml(store?.name || 'متجر محلي')}</span>
    </div>

    <h1 class="product-detail-name">${Utils.escapeHtml(product.name)}</h1>
    <div class="product-detail-price">${Utils.formatPrice(product.price)} <span>OMR</span></div>
    <p class="product-detail-desc">${Utils.escapeHtml(product.description || 'منتج متوفر للطلب المباشر من المتجر عبر واتساب.')}</p>

    <div class="delivery-options">
      <h3>Delivery type</h3>
      <div class="delivery-btns">
        <button class="delivery-btn active" id="normalBtn" onclick="selectDelivery('normal')" type="button">
          <span class="delivery-icon">🚚</span>
          Normal
        </button>
        <button class="delivery-btn" id="urgentBtn" onclick="selectDelivery('urgent')" type="button">
          <span class="delivery-icon">⚡</span>
          Urgent
        </button>
      </div>
    </div>

    <a
      id="waOrderBtn"
      class="btn btn-wa product-order-main ${hasPhone ? '' : 'disabled'}"
      href="${hasPhone ? buildWhatsAppLink(orderPhone, product.name, productUrl, 'normal') : '#'}"
      target="_blank"
      rel="noopener noreferrer"
      ${hasPhone ? '' : 'aria-disabled="true" tabindex="-1"'}
    >
      💬 Order via WhatsApp
    </a>

    <p class="product-order-note">
      Sold by <strong>${Utils.escapeHtml(store?.name || 'Local Store')}</strong>
    </p>

    <button class="btn btn-secondary product-add-cart-btn" id="addCurrentProductToCartBtn" type="button">🧺 Add to Cart</button>`;

  const addBtn = Utils.byId('addCurrentProductToCartBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      addProductToCart({
        id: String(product.id),
        name: product.name,
        price: Number(product.price) || 0,
        image: product.image_url || Utils.getPlaceholderImageDataUri(product.name),
        url: productUrl
      });
      toggleCartPanel(true);
    });
  }
}

function selectDelivery(type) {
  const normalBtn = Utils.byId('normalBtn');
  const urgentBtn = Utils.byId('urgentBtn');
  const waBtn = Utils.byId('waOrderBtn');

  if (!normalBtn || !urgentBtn || !waBtn) return;

  normalBtn.classList.toggle('active', type === 'normal');
  urgentBtn.classList.toggle('active', type === 'urgent');

  if (waBtn.classList.contains('disabled')) return;

  waBtn.href = buildWhatsAppLink(
    APP_STATE.productPage.currentStore?.phone || APP_CONFIG.DEFAULT_PHONE,
    APP_STATE.productPage.currentProduct?.name || '',
    APP_STATE.productPage.currentProductUrl,
    type
  );
}

function renderRecommendedProducts(products, currentProductId) {
  const container = Utils.byId('recommendedProducts');
  if (!container) return;

  const recommended = (products || []).filter((item) => item.id !== currentProductId).slice(0, 3);
  if (recommended.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = recommended.map((product) => {
    const imageUrl = product.image_url
      ? Utils.escapeHtml(product.image_url)
      : Utils.getPlaceholderImageDataUri(product.name);

    return `
      <a href="product.html?id=${product.id}" class="recommended-card">
        <div class="recommended-card-img">
          <img src="${imageUrl}" alt="${Utils.escapeHtml(product.name)}" loading="lazy" />
        </div>
        <div class="recommended-card-body">
          <div class="recommended-card-name">${Utils.escapeHtml(product.name)}</div>
          <div class="recommended-card-price">${Utils.formatPrice(product.price)} <span>OMR</span></div>
        </div>
      </a>`;
  }).join('');
}

// ---------------------------------------------
// dashboard.html controller
// ---------------------------------------------
async function loadDashboard(user) {
  try {
    const store = await ensureStoreExists(user);
    const products = await fetchProducts(user.id);

    if (store) {
      const storeNameEl = Utils.byId('storeName');
      if (storeNameEl) storeNameEl.textContent = store.name;

      const publicUrl = `${window.location.origin}/store.html?id=${store.id}`;
      const publicLink = Utils.byId('storePublicLink');
      const viewLink = Utils.byId('storeViewLink');

      if (publicLink) publicLink.href = publicUrl;
      if (viewLink) {
        viewLink.innerHTML = `<a href="${publicUrl}" target="_blank" style="color:var(--green)">View your public store →</a>`;
      }
    }

    const countEl = Utils.byId('productCount');
    if (countEl) countEl.textContent = String(products.length);

    renderDashboardProducts(products);
  } catch (error) {
    const list = Utils.byId('productsList');
    if (list) list.innerHTML = Utils.renderEmptyState(error.message, '⚠️');
  }
}

function renderDashboardProducts(products) {
  const container = Utils.byId('productsList');
  if (!container) return;

  if (!products || products.length === 0) {
    container.innerHTML = Utils.renderEmptyState('No products yet. Add your first product!', '📦');
    return;
  }

  container.innerHTML = products.map((product) => `
    <div class="product-list-item">
      <div class="pli-icon">
        ${product.image_url ? `<img src="${Utils.escapeHtml(product.image_url)}" alt="${Utils.escapeHtml(product.name)}" />` : '🛍️'}
      </div>
      <div class="pli-info">
        <div class="pli-name">${Utils.escapeHtml(product.name)}</div>
        <div class="pli-price">${Utils.formatPrice(product.price)} OMR</div>
      </div>
      <div class="pli-actions">
        <button class="btn-icon" title="Edit" onclick='openEditProduct(${JSON.stringify(product)})'>✏️</button>
        <button class="btn-icon btn-icon--danger" title="Delete" onclick="deleteAndReload('${product.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

async function deleteAndReload(productId) {
  try {
    await deleteProduct(productId);
    const user = await getCurrentUser();
    if (user) loadDashboard(user);
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
}

// ---------------------------------------------
// Backward-compatible utility exports
// ---------------------------------------------
function formatPrice(price) {
  return Utils.formatPrice(price);
}

function escapeHtml(value) {
  return Utils.escapeHtml(value);
}

// ---------------------------------------------
// Global exports for inline HTML handlers
// ---------------------------------------------
Object.assign(window, {
  signIn,
  signUp,
  handleSignOut,
  getCurrentUser,
  fetchStores,
  fetchStore,
  createStore,
  ensureStoreExists,
  fetchProducts,
  fetchProduct,
  addProduct,
  updateProduct,
  deleteProduct,
  buildWhatsAppLink,
  loadOwnerPage,
  saveOwnerProfileFromForm,
  resetOwnerProfile,
  loadOwnerProfileIntoLanding,
  addProductToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
  toggleCartPanel,
  loadStores,
  renderStores,
  filterStores,
  loadStorePage,
  loadProductPage,
  selectDelivery,
  loadDashboard,
  renderDashboardProducts,
  deleteAndReload,
  formatPrice,
  escapeHtml
});
