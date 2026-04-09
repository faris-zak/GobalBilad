(function () {
  const NAV_LINKS = [
    { href: 'stores.html', label: 'المتاجر' },
    { href: 'apply-role.html', label: 'سجّل كتاجر أو مندوب' },
    { href: 'contact-us.html', label: 'تواصل معنا' }
  ];

  /** Simple cart SVG icon (24×24) */
  const CART_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`;

  class SiteHeader extends HTMLElement {
    connectedCallback() {
      const page = location.pathname.split('/').pop() || 'index.html';

      const navItems = NAV_LINKS.map(({ href, label }) => {
        const isActive =
          page === href ||
          page + '.html' === href ||
          (page === '' && href === 'index.html');
        return `<a href="${href}"${isActive ? ' class="active"' : ''}>${label}</a>`;
      }).join('\n              ');

      this.innerHTML = `
        <header class="site-header">
          <div class="site-header-inner">
            <a href="index.html" class="site-logo" aria-label="الصفحة الرئيسية">
              <span class="site-logo-dot" aria-hidden="true"></span>
              <span>جوب البلاد</span>
            </a>
            <nav class="site-nav" id="siteNav" aria-label="التنقل الرئيسي">
              ${navItems}
              <a href="carts.html" class="nav-cart-link" aria-label="سلة الطلبات">
                ${CART_SVG}
                <span class="cart-badge" id="headerCartBadge">0</span>
              </a>
              <a href="login.html" class="nav-cta-mobile">تسجيل دخول</a>
            </nav>
            <div class="site-header-end">
              <a href="login.html" class="btn btn-outline btn-sm nav-cta">تسجيل دخول</a>
              <button class="hamburger" id="hamburgerBtn" aria-label="فتح القائمة" aria-expanded="false" aria-controls="siteNav">
                <span></span><span></span><span></span>
              </button>
            </div>
          </div>
        </header>
      `;

      this._initHamburger();
      this._initCartBadge();
    }

    _initHamburger() {
      const btn = this.querySelector('#hamburgerBtn');
      const nav = this.querySelector('#siteNav');

      const close = () => {
        nav.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-label', 'فتح القائمة');
      };

      btn.addEventListener('click', () => {
        const isOpen = nav.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', String(isOpen));
        btn.setAttribute('aria-label', isOpen ? 'إغلاق القائمة' : 'فتح القائمة');
      });

      nav.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', close);
      });

      document.addEventListener('click', (e) => {
        if (!this.contains(e.target)) close();
      });
    }

    _initCartBadge() {
      const badge = this.querySelector('#headerCartBadge');
      if (!badge) return;

      const getTotalCount = () => {
        let count = 0;
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i);
          if (!key || !key.startsWith('cart_')) continue;

          try {
            const parsed = JSON.parse(localStorage.getItem(key));
            if (!Array.isArray(parsed?.items)) continue;
            parsed.items.forEach((item) => {
              const qty = Number.parseInt(String(item?.qty || 0), 10);
              if (Number.isInteger(qty) && qty > 0) {
                count += qty;
              }
            });
          } catch (_err) {
            // Ignore malformed cart payloads.
          }
        }
        return count;
      };

      const refresh = () => {
        badge.textContent = String(getTotalCount());
      };

      refresh();
      window.addEventListener('storage', refresh);
      window.addEventListener('cart:updated', refresh);
    }
  }

  customElements.define('site-header', SiteHeader);
})();
