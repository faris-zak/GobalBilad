(function () {
  class SiteFooter extends HTMLElement {
    connectedCallback() {
      const variant = (this.getAttribute('variant') || 'default').toLowerCase();
      const year = new Date().getFullYear();

      if (variant === 'legal') {
        this.innerHTML = `
  <footer class="legal-footer">
    <div class="legal-container legal-footer-inner">
      <div>
        <p class="legal-footer-note">جوب البلاد منصة محلية تربط سكان المعمورة بالمتاجر الغذائية القريبة بخطوات واضحة وسريعة.</p>
        <p class="legal-copyright">© ${year} جوب البلاد. جميع الحقوق محفوظة.</p>
      </div>
      <nav class="legal-footer-links" aria-label="روابط التذييل">
        <a href="about-us.html">من نحن</a>
        <a href="terms-of-service.html">الشروط</a>
        <a href="privacy-policy.html">السياسات</a>
        <a href="contact-us.html">تواصل معنا</a>
      </nav>
    </div>
  </footer>`;
        return;
      }

      this.innerHTML = `
  <footer class="footer">
    <div class="footer-inner">
      <p class="footer-tagline">ندعم المجتمعات المحلية في عُمان، طلبًا بعد طلب.</p>
      <p class="footer-copy">© ${year} جوب البلاد. صُنع بحب في عُمان.</p>
    </div>
  </footer>`;
    }
  }

  customElements.define('site-footer', SiteFooter);
})();
