/**
 * Store & Product Page Logic — جوب البلاد
 */

let currentStoreId = null;
let currentStore = null;
let cart = {}; // { product_id: { id, name, price, qty } }

document.addEventListener('DOMContentLoaded', async () => {
    if (window.NavbarComponent) NavbarComponent.render('navbar-container');

    const params = new URLSearchParams(window.location.search);
    currentStoreId = params.get('id');

    if (!currentStoreId) {
        alert('لم يتم تحديد المتجر');
        window.location.href = 'index.html';
        return;
    }

    loadCart();
    await fetchStoreData();
});

// ── Cart helpers ─────────────────────────────────────

function loadCart() {
    try {
        const saved = localStorage.getItem(`cart_${currentStoreId}`);
        cart = saved ? JSON.parse(saved) : {};
    } catch {
        cart = {};
    }
    updateCartBadge();
}

function saveCart() {
    localStorage.setItem(`cart_${currentStoreId}`, JSON.stringify(cart));
    updateCartBadge();
}

function updateCartBadge() {
    const badge = document.getElementById('cart-count');
    if (!badge) return;
    const total = Object.values(cart).reduce((sum, i) => sum + i.qty, 0);
    badge.innerText = total;
    badge.style.display = total > 0 ? 'flex' : 'none';
}

// ── Data fetching ────────────────────────────────────

async function fetchStoreData() {
    try {
        currentStore = await API.stores.getById(currentStoreId);
    } catch {
        // Store not found or not approved
        document.getElementById('store-title').innerText = 'المتجر غير متاح';
        document.getElementById('products-grid').innerHTML =
            '<p style="color:var(--danger); text-align:center;">هذا المتجر غير متاح حالياً.</p>';
        return;
    }

    // Render store header
    document.getElementById('store-title').innerText = currentStore.name;
    document.getElementById('store-desc').innerText = currentStore.description || 'مرحباً بك في متجرنا';
    document.title = `${currentStore.name} - جوب البلاد`;

    // Load products
    try {
        const products = await API.products.getByStore(currentStoreId);
        renderProducts(products);
    } catch (err) {
        console.error('[fetchProducts]', err);
        document.getElementById('products-grid').innerHTML =
            '<p style="color:var(--danger); text-align:center;">تعذر تحميل المنتجات.</p>';
    }
}

// ── Render ────────────────────────────────────────────

function renderProducts(products) {
    const grid = document.getElementById('products-grid');

    if (!products || products.length === 0) {
        grid.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:3rem;">لا تتوفر منتجات حالياً.</p>';
        return;
    }

    grid.innerHTML = products.map(p => {
        const qty = cart[p.id]?.qty || 0;
        const qtyControls = qty > 0
            ? `<div class="qty-controls">
                 <button class="qty-btn" onclick="updateQty('${p.id}', -1)">−</button>
                 <span class="qty-display">${qty}</span>
                 <button class="qty-btn" onclick="updateQty('${p.id}', 1)">+</button>
               </div>`
            : `<button class="btn btn-primary" style="width:100%;padding:0.5rem;" onclick="addToCart('${p.id}','${escHtml(p.name)}',${p.price})">أضف للسلة</button>`;

        return `
            <div class="product-card">
                <div class="product-img flex-center">${p.image_url ? `<img src="${p.image_url}" alt="${escHtml(p.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius-sm);">` : '📦'}</div>
                <div class="product-info">
                    <h3>${escHtml(p.name)}</h3>
                    ${p.description ? `<p style="font-size:.85rem;color:var(--text-muted);margin:.25rem 0;">${escHtml(p.description)}</p>` : ''}
                    <p class="product-price">${Utils.formatCurrency(p.price)}</p>
                </div>
                ${qtyControls}
            </div>
        `;
    }).join('');
}

// ── Cart mutation ─────────────────────────────────────

window.addToCart = function (id, name, price) {
    cart[id] = { id, name, price: parseFloat(price), qty: 1 };
    saveCart();
    reRender();
};

window.updateQty = function (id, delta) {
    if (!cart[id]) return;
    cart[id].qty += delta;
    if (cart[id].qty <= 0) delete cart[id];
    saveCart();
    reRender();
};

// Re-render only product grid (avoids full refetch)
async function reRender() {
    try {
        const products = await API.products.getByStore(currentStoreId);
        renderProducts(products);
    } catch {
        // fallback: do nothing
    }
}

// Make escHtml available
function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
