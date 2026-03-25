/**
 * Navbar Component
 */
const NavbarComponent = {
    render: (containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <nav class="navbar">
                <div class="nav-wrapper">
                    <!-- Brand -->
                    <a href="index.html" class="nav-brand">
                        <span>جوب البلاد</span>
                    </a>

                    <!-- Navigation Links -->
                    <div class="nav-links">
                        <a href="index.html" class="nav-link">المتاجر</a>
                        <a href="cart.html" class="cart-icon">
                            🛒
                            <span class="cart-badge" id="cart-count">0</span>
                        </a>
                        <a href="login.html" class="btn btn-outline" style="padding: 0.4rem 1rem; font-size: 0.9rem;">تسجيل الدخول</a>
                    </div>
                </div>
            </nav>
        `;
    }
};

window.NavbarComponent = NavbarComponent;
