function formatPrice(value) {
  return `${Number(value || 0).toFixed(3)} ر.ع`;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getStoreId() {
  const params = new URLSearchParams(location.search);
  return params.get('id') || '';
}

function updateCartMeta(storeId) {
  if (!window.CartUtils || !storeId) return;
  const cartCount = window.CartUtils.getCartCount(storeId);
  const badge = document.getElementById('storeCartCount');
  const checkoutBtn = document.getElementById('goToCheckoutBtn');
  const floatingCart = document.getElementById('floatingCart');
  const floatingCount = document.getElementById('floatingCartCount');
  const floatingHref = document.getElementById('floatingCartBtn');

  if (badge) badge.textContent = String(cartCount);
  if (floatingCount) floatingCount.textContent = String(cartCount);

  const isEmpty = cartCount < 1;
  if (floatingCart) floatingCart.classList.toggle('is-hidden', isEmpty);

  if (checkoutBtn) {
    checkoutBtn.classList.toggle('is-disabled', isEmpty);
    checkoutBtn.setAttribute('aria-disabled', String(isEmpty));
    checkoutBtn.setAttribute('tabindex', isEmpty ? '-1' : '0');
    checkoutBtn.href = isEmpty ? '#' : (checkoutBtn.dataset.href || checkoutBtn.href);
  }
  if (floatingHref && checkoutBtn) {
    floatingHref.href = isEmpty ? '#' : (checkoutBtn.dataset.href || '');
  }
}

function showMessage(text) {
  const node = document.getElementById('storeNotice');
  if (!node) return;
  node.textContent = text;
  node.classList.add('show');
  window.clearTimeout(showMessage._timer);
  showMessage._timer = window.setTimeout(() => {
    node.classList.remove('show');
  }, 1600);
}

function renderProducts(store, items) {
  const title = document.getElementById('storeTitle');
  const subtitle = document.getElementById('storeSubtitle');
  const productsGrid = document.getElementById('productsGrid');
  const checkoutBtn = document.getElementById('goToCheckoutBtn');

  if (!productsGrid || !title || !subtitle || !checkoutBtn) return;

  title.textContent = store.name;
  subtitle.textContent = 'اختر المنتجات التي تريدها ثم أكمل الطلب.';
  checkoutBtn.href = `checkout.html?store=${encodeURIComponent(store.id)}`;
  checkoutBtn.dataset.href = checkoutBtn.href;

  if (!Array.isArray(items) || !items.length) {
    productsGrid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div><p>لا توجد منتجات متاحة في هذا المتجر حالياً.</p></div>';
    return;
  }

  productsGrid.innerHTML = items.map((item) => `
    <article class="product-card reveal">
      <div class="product-card-img" aria-hidden="true">🛒</div>
      <div class="product-card-body">
        <h3 class="product-card-name">${escapeHtml(item.name)}</h3>
        <div class="product-card-price">${formatPrice(item.price)}</div>
        <div class="product-card-footer">
          <button
            class="btn btn-primary btn-add-cart"
            type="button"
            data-id="${escapeHtml(item.id)}"
            data-name="${escapeHtml(item.name)}"
            data-price="${Number(item.price)}"
          >أضف للسلة</button>
        </div>
      </div>
    </article>
  `).join('');

  productsGrid.querySelectorAll('.btn-add-cart').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!window.CartUtils) return;

      window.CartUtils.addItem(store.id, {
        storeName: store.name,
        storePhone: store.whatsapp_phone
      }, {
        id: btn.dataset.id,
        name: btn.dataset.name,
        price: Number(btn.dataset.price)
      });

      updateCartMeta(store.id);

      // Brief visual feedback on the button
      btn.textContent = '✓ تمت الإضافة';
      btn.classList.add('added');
      setTimeout(() => {
        btn.textContent = 'أضف للسلة';
        btn.classList.remove('added');
      }, 1200);

      showMessage('تمت إضافة المنتج إلى السلة');
    });
  });

  if (typeof initRevealOnScroll === 'function') {
    initRevealOnScroll();
  }
}

async function loadStoreProducts() {
  const storeId = getStoreId();
  const productsGrid = document.getElementById('productsGrid');
  if (!productsGrid) return;

  if (!storeId) {
    productsGrid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>المتجر غير محدد.</p></div>';
    return;
  }

  productsGrid.innerHTML = '<div class="loading">جاري تحميل المنتجات...</div>';

  try {
    const response = await fetch(`/api/store-products?storeId=${encodeURIComponent(storeId)}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || 'تعذر تحميل منتجات المتجر');
    }

    renderProducts(data.store, data.items || []);
    updateCartMeta(storeId);
  } catch (err) {
    productsGrid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>${escapeHtml(err.message || 'حدث خطأ أثناء تحميل المنتجات')}</p></div>`;
  }
}

window.addEventListener('load', loadStoreProducts);
window.addEventListener('cart:updated', () => {
  const storeId = getStoreId();
  updateCartMeta(storeId);
});
