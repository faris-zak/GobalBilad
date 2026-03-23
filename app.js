// =============================================
//  GobalBilad — Main JavaScript
//  Handles: Supabase connection, auth, CRUD,
//           store/product pages, WhatsApp links
// =============================================

// ---- CONFIGURATION ----
// Replace these with your actual Supabase project values
// Get them from: https://app.supabase.com → Project Settings → API
const SUPABASE_URL    = 'https://euequlunrvrbslsjrqpp.supabase.co';
const SUPABASE_ANON   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1ZXF1bHVucnZyYnNsc2pycXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzAyMDAsImV4cCI6MjA4OTg0NjIwMH0.TV9888GZe7XU2FcMDHoMpTS4Cr_uX0lhwM7yKjGR4_8';

// =============================================
//  SUPABASE CLIENT (using CDN-free REST API)
//  We call Supabase REST directly — no npm needed
// =============================================

// Helper: Build headers for Supabase REST calls
function getHeaders(token = null) {
  const headers = {
    'Content-Type':  'application/json',
    'apikey':         SUPABASE_ANON,
    'Authorization': `Bearer ${token || SUPABASE_ANON}`,
    'Prefer':        'return=representation'
  };
  return headers;
}

// Get auth token from localStorage (set after login)
function getAuthToken() {
  const session = JSON.parse(localStorage.getItem('gb_session') || 'null');
  return session?.access_token || null;
}

// =============================================
//  AUTH FUNCTIONS
// =============================================

// Sign in with email/password
async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'فشل تسجيل الدخول');
  localStorage.setItem('gb_session', JSON.stringify(data));
  return data;
}

// Sign up new store owner
async function signUp(email, password, storeName) {
  // 1. Create the auth user
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'فشل إنشاء الحساب');
  localStorage.setItem('gb_session', JSON.stringify(data));

  // 2. Create the store record linked to this user
  if (data.user?.id) {
    await createStore({
      id:   data.user.id,
      name: storeName
    }, data.access_token);
  }
  return data;
}

// Sign out
async function handleSignOut() {
  localStorage.removeItem('gb_session');
  window.location.href = 'index.html';
}

// Get current logged-in user
async function getCurrentUser() {
  const token = getAuthToken();
  if (!token) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) return null;
  return await res.json();
}

// =============================================
//  DATABASE FUNCTIONS
// =============================================

// --- STORES ---

// Fetch all stores
async function fetchStores() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/stores?order=created_at.desc`,
    { headers: getHeaders() }
  );
  if (!res.ok) throw new Error('تعذر تحميل المتاجر');
  return await res.json();
}

// Fetch one store by ID
async function fetchStore(storeId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/stores?id=eq.${storeId}&limit=1`,
    { headers: getHeaders() }
  );
  if (!res.ok) throw new Error('تعذر تحميل بيانات المتجر');
  const data = await res.json();
  return data[0] || null;
}

// Create store (called during signup)
async function createStore(store, token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/stores`, {
    method:  'POST',
    headers: getHeaders(token),
    body:    JSON.stringify(store)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'تعذر إنشاء المتجر');
  }
  return await res.json();
}

// --- PRODUCTS ---

// Fetch products for a store
async function fetchProducts(storeId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products?store_id=eq.${storeId}&order=created_at.desc`,
    { headers: getHeaders() }
  );
  if (!res.ok) throw new Error('تعذر تحميل المنتجات');
  return await res.json();
}

// Fetch a single product
async function fetchProduct(productId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products?id=eq.${productId}&limit=1`,
    { headers: getHeaders() }
  );
  if (!res.ok) throw new Error('تعذر تحميل المنتج');
  const data = await res.json();
  return data[0] || null;
}

// Add a product
async function addProduct(product) {
  const user = await getCurrentUser();
  if (!user) throw new Error('يجب تسجيل الدخول أولًا');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
    method:  'POST',
    headers: getHeaders(getAuthToken()),
    body:    JSON.stringify({ ...product, store_id: user.id })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'تعذر إضافة المنتج');
  }
  return await res.json();
}

// Update a product
async function updateProduct(productId, updates) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${productId}`, {
    method:  'PATCH',
    headers: getHeaders(getAuthToken()),
    body:    JSON.stringify(updates)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'تعذر تحديث المنتج');
  }
  return await res.json();
}

// Delete a product
async function deleteProduct(productId) {
  if (!confirm('هل تريد حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.')) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${productId}`, {
    method:  'DELETE',
    headers: getHeaders(getAuthToken())
  });
  if (!res.ok) throw new Error('تعذر حذف المنتج');
}

// =============================================
//  WHATSAPP LINK GENERATOR
// =============================================

function buildWhatsAppLink(phone, productName, productUrl, deliveryType = 'normal') {
  // Clean phone — remove spaces, dashes, plus sign inconsistencies
  const cleanPhone = phone.replace(/[^0-9]/g, '');

  // Delivery type text
  const delivery = deliveryType === 'urgent'
    ? '⚡ *أرغب بتوصيل عاجل*'
    : '🚚 التوصيل العادي مناسب.';

  // Message text
  const message = `مرحبًا 👋 أرغب في طلب هذا المنتج:\n\n*${productName}*\n${productUrl}\n\n${delivery}\n\nيرجى تأكيد طلبي، شكرًا لكم 🙏`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

// =============================================
//  PAGE: stores.html — Store Listing
// =============================================

let allStores = []; // keep for client-side search

async function loadStores() {
  const container = document.getElementById('storesList');
  if (!container) return;

  try {
    allStores = await fetchStores();
    renderStores(allStores);
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>${err.message}</p></div>`;
  }
}

function renderStores(stores) {
  const container = document.getElementById('storesList');
  if (!stores || stores.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-state-icon">🏪</div>
        <p>لا توجد متاجر بعد. كن أول من ينضم!</p>
      </div>`;
    return;
  }

  // Category icons map
  const icons = { grocery:'🛒', bakery:'🥖', meat:'🥩', dairy:'🥛', sweets:'🍬', drinks:'🧃', default:'🏪' };

  container.innerHTML = stores.map(store => `
    <a href="store.html?id=${store.id}" class="store-card">
      <div class="store-card-icon">${icons[store.category] || icons.default}</div>
      <div class="store-card-info">
        <div class="store-card-name">${escapeHtml(store.name)}</div>
        <div class="store-card-desc">${escapeHtml(store.description || 'متجر محلي')}</div>
      </div>
      <span class="store-card-arrow">‹</span>
    </a>
  `).join('');
}

function filterStores(query) {
  const q = query.toLowerCase();
  const filtered = allStores.filter(s =>
    s.name.toLowerCase().includes(q) ||
    (s.description || '').toLowerCase().includes(q)
  );
  renderStores(filtered);
}

// =============================================
//  PAGE: store.html — Store Profile + Products
// =============================================

async function loadStorePage() {
  const storeId = new URLSearchParams(window.location.search).get('id');
  if (!storeId) { window.location.href = 'stores.html'; return; }

  try {
    // Load store info and products in parallel
    const [store, products] = await Promise.all([
      fetchStore(storeId),
      fetchProducts(storeId)
    ]);

    if (!store) { window.location.href = 'stores.html'; return; }

    // Update page title
    document.title = `${store.name} — GobalBilad`;

    // Render store hero
    renderStoreHero(store);

    // Render products
    renderProductCards(products, store);

  } catch (err) {
    document.getElementById('storeHero').innerHTML =
      `<div class="empty-state"><p>${err.message}</p></div>`;
  }
}

function renderStoreHero(store) {
  const el = document.getElementById('storeHero');
  el.innerHTML = `
    <div class="store-hero-inner">
      <div class="store-hero-icon">🏪</div>
      <div class="store-hero-info">
        <h1>${escapeHtml(store.name)}</h1>
        <p>${escapeHtml(store.description || 'متجر محلي في عُمان')}</p>
        <div class="store-links">
          ${store.phone ? `<a href="https://wa.me/${store.phone.replace(/[^0-9]/g,'')}" class="store-link store-link--wa" target="_blank">💬 واتساب</a>` : ''}
          ${store.instagram ? `<a href="${escapeHtml(store.instagram)}" class="store-link" target="_blank">📸 إنستغرام</a>` : ''}
        </div>
      </div>
    </div>`;
}

function renderProductCards(products, store) {
  const container = document.getElementById('productsList');
  if (!products || products.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-state-icon">📦</div>
        <p>لا توجد منتجات مضافة حتى الآن.</p>
      </div>`;
    return;
  }

  container.innerHTML = products.map(p => {
    const productUrl = `${window.location.origin}/product.html?id=${p.id}`;
    const waLink = buildWhatsAppLink(store.phone || '96812345678', p.name, productUrl);
    return `
      <a href="product.html?id=${p.id}" class="product-card">
        <div class="product-card-img">
          ${p.image_url
            ? `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" loading="lazy" />`
            : '🛍️'}
        </div>
        <div class="product-card-body">
          <div class="product-card-name">${escapeHtml(p.name)}</div>
          <div class="product-card-desc">${escapeHtml(p.description || '')}</div>
          <div class="product-card-price">${formatPrice(p.price)} <span>ر.ع</span></div>
        </div>
      </a>`;
  }).join('');
}

// =============================================
//  PAGE: product.html — Product Detail
// =============================================

async function loadProductPage() {
  const productId = new URLSearchParams(window.location.search).get('id');
  if (!productId) { window.location.href = 'stores.html'; return; }

  try {
    const product = await fetchProduct(productId);
    if (!product) { window.location.href = 'stores.html'; return; }

    const store = await fetchStore(product.store_id);

    // Update back link
    document.getElementById('backLink').href = `store.html?id=${product.store_id}`;

    // Update page title
    document.title = `${product.name} — GobalBilad`;

    // Product image
    const imgEl = document.getElementById('productImg');
    if (product.image_url) {
      imgEl.innerHTML = `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" />`;
    } else {
      imgEl.textContent = '🛍️';
    }

    // Product info
    renderProductDetail(product, store);

  } catch (err) {
    document.getElementById('productInfo').innerHTML =
      `<div class="empty-state"><p>${err.message}</p></div>`;
  }
}

function renderProductDetail(product, store) {
  const container = document.getElementById('productInfo');
  const productUrl = window.location.href;

  container.innerHTML = `
    <h1 class="product-detail-name">${escapeHtml(product.name)}</h1>
    <div class="product-detail-price">${formatPrice(product.price)} <span>ر.ع</span></div>

    ${product.description ? `<p class="product-detail-desc">${escapeHtml(product.description)}</p>` : ''}

    <!-- Delivery Type Selection -->
    <div class="delivery-options">
      <h3>نوع التوصيل:</h3>
      <div class="delivery-btns">
        <button class="delivery-btn active" id="normalBtn" onclick="selectDelivery('normal')">
          <span class="delivery-icon">🚚</span>
          عادي
        </button>
        <button class="delivery-btn" id="urgentBtn" onclick="selectDelivery('urgent')">
          <span class="delivery-icon">⚡</span>
          عاجل
        </button>
      </div>
    </div>

    <!-- WhatsApp Order Button -->
    <a
      id="waOrderBtn"
      class="btn btn-wa"
      href="${buildWhatsAppLink(store?.phone || '', product.name, productUrl, 'normal')}"
      target="_blank"
    >
      💬 اطلب عبر واتساب
    </a>

    <p style="text-align:center;font-size:13px;color:var(--text-light);margin-top:12px;">
      يُباع بواسطة <strong>${escapeHtml(store?.name || 'متجر محلي')}</strong>
    </p>`;

  // Store data on window for delivery toggle
  window._currentProduct = product;
  window._currentStore   = store;
  window._currentProductUrl = productUrl;
}

// Toggle delivery type and update WhatsApp link
function selectDelivery(type) {
  document.getElementById('normalBtn').classList.toggle('active', type === 'normal');
  document.getElementById('urgentBtn').classList.toggle('active', type === 'urgent');
  // Update the WhatsApp link
  const link = buildWhatsAppLink(
    window._currentStore?.phone || '',
    window._currentProduct?.name || '',
    window._currentProductUrl,
    type
  );
  document.getElementById('waOrderBtn').href = link;
}

// =============================================
//  PAGE: dashboard.html — Store Dashboard
// =============================================

async function loadDashboard(user) {
  try {
    const [store, products] = await Promise.all([
      fetchStore(user.id),
      fetchProducts(user.id)
    ]);

    // Store name in header
    if (store) {
      document.getElementById('storeName').textContent = store.name;
      const publicUrl = `${window.location.origin}/store.html?id=${store.id}`;
      document.getElementById('storePublicLink').href = publicUrl;
      document.getElementById('storeViewLink').innerHTML =
        `<a href="${publicUrl}" target="_blank" style="color:var(--green)">عرض متجرك العام ←</a>`;
    }

    // Product count
    document.getElementById('productCount').textContent = products.length;

    // Render product list
    renderDashboardProducts(products);

  } catch (err) {
    document.getElementById('productsList').innerHTML =
      `<div class="empty-state"><p>${err.message}</p></div>`;
  }
}

function renderDashboardProducts(products) {
  const container = document.getElementById('productsList');
  if (!products || products.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <p>لا توجد منتجات بعد. أضف أول منتج الآن!</p>
      </div>`;
    return;
  }

  container.innerHTML = products.map(p => `
    <div class="product-list-item">
      <div class="pli-icon">
        ${p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" />` : '🛍️'}
      </div>
      <div class="pli-info">
        <div class="pli-name">${escapeHtml(p.name)}</div>
        <div class="pli-price">${formatPrice(p.price)} ر.ع</div>
      </div>
      <div class="pli-actions">
        <button class="btn-icon" title="تعديل" onclick='openEditProduct(${JSON.stringify(p)})'>✏️</button>
        <button class="btn-icon btn-icon--danger" title="حذف" onclick="deleteAndReload('${p.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

async function deleteAndReload(productId) {
  try {
    await deleteProduct(productId);
    const user = await getCurrentUser();
    loadDashboard(user);
  } catch (err) {
    alert('خطأ: ' + err.message);
  }
}

// =============================================
//  UTILITIES
// =============================================

// Format price as "0.500" style (Omani Baisa)
function formatPrice(price) {
  return parseFloat(price).toFixed(3);
}

// Simple HTML escape to prevent XSS
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
