function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderStores(items) {
  const grid = document.getElementById('storesGrid');
  if (!grid) return;

  if (!Array.isArray(items) || !items.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏪</div><p>لا توجد متاجر متاحة الآن.</p></div>';
    return;
  }

  grid.innerHTML = items.map((store) => {
    const safeName = escapeHtml(store.name);
    return `
      <a class="store-card reveal" href="store.html?id=${encodeURIComponent(store.id)}">
        <div class="store-card-icon" aria-hidden="true">🏪</div>
        <div class="store-card-info">
          <h3 class="store-card-name">${safeName}</h3>
        </div>
        <span class="store-card-btn">دخول المتجر</span>
      </a>
    `;
  }).join('');

  if (typeof initRevealOnScroll === 'function') {
    initRevealOnScroll();
  }
}

async function loadStores() {
  const grid = document.getElementById('storesGrid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading">جاري تحميل المتاجر...</div>';

  try {
    const response = await fetch('/api/stores');
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || 'تعذر تحميل المتاجر');
    }

    renderStores(data.items || []);
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>${escapeHtml(err.message || 'حدث خطأ أثناء تحميل المتاجر')}</p></div>`;
  }
}

window.addEventListener('load', loadStores);
