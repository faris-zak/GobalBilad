/**
 * Navbar Component — Auth-Aware
 * Shows login or user menu depending on session state
 */
const NavbarComponent = {
    render: async (containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Base navbar shell immediately
        container.innerHTML = `
            <nav class="navbar">
                <div class="nav-wrapper">
                    <a href="index.html" class="nav-brand">🛒 جوب البلاد</a>
                    <div class="nav-links" id="nav-links-dynamic">
                        <div class="loader" style="padding:.25rem .5rem;font-size:.85rem;">...</div>
                    </div>
                </div>
            </nav>`;

        // Resolve auth state
        let user = null;
        let profile = null;
        try {
            if (window.API) {
                user = await API.auth.getUser();
                if (user) profile = await API.auth.getProfile(user.id);
            }
        } catch { /* not logged in */ }

        const linksEl = document.getElementById('nav-links-dynamic');
        if (!linksEl) return;

        if (user && profile) {
            // Determine dashboard link by role
            let dashLink = '';
            let accountDropdownLink = '';
            if (profile.role === 'store')  dashLink = '<a href="dashboard-store.html"  class="nav-link">لوحة المتجر</a>';
            if (profile.role === 'driver') dashLink = '<a href="dashboard-driver.html" class="nav-link">لوحتي</a>';
            if (profile.role === 'admin')  dashLink = '<a href="dashboard-admin.html"  class="nav-link">الإدارة</a>';
            if (profile.role === 'customer') {
                dashLink = '<a href="account.html" class="nav-link">حسابي</a>';
                accountDropdownLink = '<a href="account.html" class="nav-dropdown-item">الحساب</a>';
            }

            linksEl.innerHTML = `
                <a href="index.html" class="nav-link">المتاجر</a>
                ${dashLink}
                <a href="orders.html" class="nav-link">طلباتي</a>
                <a href="cart.html" class="cart-icon" style="position:relative;">
                    🛒
                    <span class="cart-badge" id="cart-count" style="display:none;">0</span>
                </a>
                <div style="position:relative;" id="user-menu-wrapper">
                    <button onclick="document.getElementById('user-dropdown').classList.toggle('open')"
                        style="background:none;border:none;cursor:pointer;font-size:.95rem;font-weight:700;color:var(--text-primary);font-family:inherit;display:flex;align-items:center;gap:.4rem;">
                        👤 ${escHtmlNav(profile.name || user.email)}
                    </button>
                    <div id="user-dropdown" class="nav-dropdown">
                        ${accountDropdownLink}
                        <a href="orders.html" class="nav-dropdown-item">طلباتي</a>
                        <hr style="margin:.25rem 0;border-color:var(--border);">
                        <button onclick="NavbarComponent.logout()" class="nav-dropdown-item" style="color:var(--danger);">تسجيل الخروج</button>
                    </div>
                </div>`;
        } else {
            linksEl.innerHTML = `
                <a href="index.html" class="nav-link">المتاجر</a>
                <a href="cart.html" class="cart-icon" style="position:relative;">
                    🛒
                    <span class="cart-badge" id="cart-count" style="display:none;">0</span>
                </a>
                <a href="login.html" class="btn btn-outline" style="padding:.4rem 1rem;font-size:.9rem;">دخول</a>`;
        }

        // Update total cart count badge across all stores
        NavbarComponent._updateCartCount();

        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            const wrapper = document.getElementById('user-menu-wrapper');
            const dropdown = document.getElementById('user-dropdown');
            if (wrapper && dropdown && !wrapper.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });
    },

    _updateCartCount: () => {
        const badge = document.getElementById('cart-count');
        if (!badge) return;
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key.startsWith('cart_')) continue;
            try {
                const items = Object.values(JSON.parse(localStorage.getItem(key)) || {});
                total += items.reduce((s, it) => s + it.qty, 0);
            } catch { /* ignore */ }
        }
        badge.innerText = total;
        badge.style.display = total > 0 ? 'flex' : 'none';
    },

    logout: async () => {
        if (window.API) await API.auth.signOut();
        window.location.href = 'login.html';
    },
};

function escHtmlNav(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

window.NavbarComponent = NavbarComponent;
