(function () {
  const NAV_LINKS = [
    { href: 'index.html', label: 'الرئيسية' },
    { href: 'stores.html', label: 'المتاجر' },
    { href: 'about-us.html', label: 'من نحن' },
    { href: 'apply-role.html', label: 'سجّل كتاجر أو مندوب' },
    { href: 'terms-of-service.html', label: 'شروط الخدمة' },
    { href: 'privacy-policy.html', label: 'سياسة الخصوصية' },
    { href: 'contact-us.html', label: 'تواصل معنا' }
  ];

  class SiteHeader extends HTMLElement {
    connectedCallback() {
      const page = location.pathname.split('/').pop() || 'index.html';

      const navItems = NAV_LINKS.map(({ href, label }) => {
        // about-us.html is treated as the same active page as about.html
        const isActive =
          page === href ||
          (page === '' && href === 'index.html') ||
          (page === 'about-us.html' && href === 'about.html') ||
          (page === 'carts.html' && href === 'carts.html');
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
                سلة الطلبات
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
