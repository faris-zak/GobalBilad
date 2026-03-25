/**
 * App Main Logic — جوب البلاد
 * Handles: store listing, location check, auth state
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Render navbar
    if (window.NavbarComponent) NavbarComponent.render('navbar-container');

    // Location check
    const locationStatus = document.getElementById('location-status');
    if (locationStatus) verifyUserLocation(locationStatus);

    // Store grid
    const storesGrid = document.getElementById('stores-grid');
    if (storesGrid) {
        await loadStores(storesGrid);
        setupStoreSearch();
    }
});

async function verifyUserLocation(el) {
    try {
        const loc = await Utils.checkLocation();
        if (loc.isInside) {
            el.className = 'status-badge allowed';
            el.innerText = '📍 أنت داخل المعمورة. يمكنك الطلب الآن.';
        } else {
            el.className = 'status-badge blocked';
            el.innerText = '❌ خدماتنا متاحة داخل المعمورة فقط.';
        }
    } catch {
        el.className = 'status-badge checking';
        el.innerText = '⚠️ تعذر تحديد الموقع تلقائياً. يمكنك الطلب وتحديده يدوياً.';
    }
}

// All loaded stores stored here for client-side search
let _allStores = [];

async function loadStores(grid) {
    grid.innerHTML = '<div class="loader">جاري تحميل المتاجر...</div>';
    try {
        _allStores = await API.stores.getAll();
        renderStores(_allStores, grid);
    } catch (err) {
        console.error('[loadStores]', err);
        grid.innerHTML = '<p style="color:var(--danger); text-align:center; padding:2rem;">تعذر تحميل المتاجر. يرجى المحاولة لاحقاً.</p>';
    }
}

function renderStores(stores, grid = document.getElementById('stores-grid')) {
    if (!stores || stores.length === 0) {
        grid.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:3rem;">لا توجد متاجر متاحة حالياً.</p>';
        return;
    }

    grid.innerHTML = stores.map(store => `
        <div class="card" onclick="window.location.href='store.html?id=${store.id}'" style="cursor:pointer;">
            <div class="card-img-wrapper">
                <span class="card-placeholder-icon">🏪</span>
            </div>
            <div class="card-body">
                <h3 class="card-title">${escHtml(store.name)}</h3>
                <p class="card-subtitle">
                    ${store.category ? escHtml(store.category) : ''}
                    ${store.description ? ' · ' + escHtml(store.description).substring(0, 50) : ''}
                </p>
                <div class="card-actions">
                    <span class="status-badge allowed">مفتوح</span>
                    <span style="color:var(--text-muted); font-size:0.85rem;">← تصفح المنتجات</span>
                </div>
            </div>
        </div>
    `).join('');
}

function setupStoreSearch() {
    const input = document.getElementById('search-stores');
    if (!input) return;
    input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        const filtered = q
            ? _allStores.filter(s => s.name.toLowerCase().includes(q) || (s.category || '').toLowerCase().includes(q))
            : _allStores;
        renderStores(filtered);
    });
}

// Escape HTML to prevent XSS when rendering user-supplied content
function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

window.escHtml = escHtml;
