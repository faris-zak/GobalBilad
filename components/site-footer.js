(function () {
  const FOOTER_LINKS = [
    { href: 'stores.html',           label: 'المتاجر' },
    { href: 'contact-us.html',       label: 'تواصل معنا' },
    { href: 'terms-of-service.html', label: 'الشروط' },
    { href: 'privacy-policy.html',   label: 'السياسات' }
  ];

  class SiteFooter extends HTMLElement {
    connectedCallback() {
      const year = new Date().getFullYear();

      const links = FOOTER_LINKS.map(
        ({ href, label }) => `<a href="${href}" class="sf-link">${label}</a>`
      ).join('');

      this.innerHTML = `
        <footer class="sf">
          <div class="sf-inner">
            <a href="index.html" class="sf-brand" aria-label="الصفحة الرئيسية">
              <span class="sf-dot" aria-hidden="true"></span>
              <span class="sf-name">جوب البلاد</span>
            </a>
            <p class="sf-tagline">ندعم المجتمعات المحلية في عُمان، طلبًا بعد طلب.</p>
            <nav class="sf-nav" aria-label="روابط التذييل">
              ${links}
            </nav>
            <p class="sf-copy">© ${year} جوب البلاد. جميع الحقوق محفوظة.</p>
          </div>
        </footer>`;
    }
  }

  customElements.define('site-footer', SiteFooter);
})();
