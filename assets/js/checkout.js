function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatPrice(value) {
  return `${Number(value || 0).toFixed(3)} ر.ع`;
}

function getStoreId() {
  return new URLSearchParams(location.search).get('store') || '';
}

function getGoogleMapsLink(lat, lng) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

function buildWhatsAppMessage(payload) {
  const lines = [
    '🛒 *طلب جديد - جوب البلاد*',
    '',
    `🏪 *المتجر:* ${payload.storeName}`,
    '',
    '📦 *المنتجات:*'
  ];

  payload.items.forEach((item) => {
    lines.push(`• ${item.name} × ${item.qty} — ${Number(item.price * item.qty).toFixed(3)} ر.ع`);
  });

  lines.push('');
  lines.push(`💰 *الإجمالي:* ${Number(payload.totalPrice).toFixed(3)} ر.ع`);
  lines.push('━━━━━━━━━━━━━━');
  lines.push(`👤 *الاسم:* ${payload.customerName}`);
  lines.push(`📞 *الهاتف:* ${payload.customerPhone}`);
  lines.push(`🚚 *الاستلام:* ${payload.deliveryType === 'delivery' ? 'توصيل' : 'استلام من المتجر'}`);

  if (payload.deliveryType === 'delivery' && payload.locationLink) {
    lines.push(`📍 *الموقع:* ${payload.locationLink}`);
  }

  lines.push(`🔖 *رقم الطلب:* #${payload.orderId}`);

  return lines.join('\n');
}

function renderCart(cart) {
  const storeNameNode = document.getElementById('checkoutStoreName');
  const cartItemsNode = document.getElementById('checkoutCartItems');
  const totalNode = document.getElementById('checkoutTotal');
  if (!storeNameNode || !cartItemsNode || !totalNode) return;

  storeNameNode.textContent = cart.storeName || 'المتجر';

  if (!Array.isArray(cart.items) || !cart.items.length) {
    cartItemsNode.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🧺</div><p>السلة فارغة حالياً.</p></div>';
    totalNode.textContent = formatPrice(0);
    return;
  }

  cartItemsNode.innerHTML = cart.items.map((item) => `
    <div class="checkout-item-row">
      <div class="checkout-item-main">
        <strong>${escapeHtml(item.name)}</strong>
        <span>${formatPrice(item.price)}</span>
      </div>
      <div class="checkout-item-actions">
        <button type="button" class="qty-btn" data-op="plus" data-id="${escapeHtml(item.id)}">+</button>
        <span class="qty-value">${item.qty}</span>
        <button type="button" class="qty-btn" data-op="minus" data-id="${escapeHtml(item.id)}">-</button>
      </div>
      <div class="checkout-item-line-total">${formatPrice(item.price * item.qty)}</div>
    </div>
  `).join('');

  cartItemsNode.querySelectorAll('.qty-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!window.CartUtils) return;
      const id = btn.dataset.id;
      const op = btn.dataset.op;
      const current = window.CartUtils.getCart(cart.storeId);
      const item = current.items.find((it) => it.id === id);
      if (!item) return;

      const nextQty = op === 'plus' ? item.qty + 1 : item.qty - 1;
      window.CartUtils.updateItemQty(cart.storeId, id, nextQty);
      refreshView(cart.storeId);
    });
  });

  totalNode.textContent = formatPrice(window.CartUtils.getCartTotal(cart.storeId));
}

function setDeliveryVisibility(deliveryType) {
  const wrap = document.getElementById('deliveryFields');
  if (!wrap) return;
  const show = deliveryType === 'delivery';
  wrap.classList.toggle('is-hidden', !show);
}

async function detectLocationAndFill() {
  const locationInput = document.getElementById('locationLink');
  if (!locationInput || !navigator.geolocation) {
    return;
  }

  const coords = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  locationInput.value = getGoogleMapsLink(coords.latitude, coords.longitude);
}

async function submitOrder(event) {
  event.preventDefault();

  const storeId = getStoreId();
  if (!window.CartUtils || !storeId) {
    return;
  }

  const form = event.currentTarget;
  const submitBtn = form.querySelector('button[type="submit"]');
  const notice = document.getElementById('checkoutNotice');
  const cart = window.CartUtils.getCart(storeId);

  if (!cart.items.length) {
    if (notice) {
      notice.textContent = 'السلة فارغة.';
      notice.classList.add('show', 'is-error');
    }
    return;
  }

  const formData = new FormData(form);
  const name = String(formData.get('name') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const deliveryType = String(formData.get('deliveryType') || 'pickup');
  const locationLink = String(formData.get('locationLink') || '').trim();

  if (!name || name.length < 2 || !phone || phone.length < 6) {
    if (notice) {
      notice.textContent = 'يرجى إدخال الاسم ورقم الهاتف بشكل صحيح.';
      notice.classList.add('show', 'is-error');
    }
    return;
  }

  if (deliveryType === 'delivery' && !locationLink) {
    if (notice) {
      notice.textContent = 'يرجى إضافة رابط الموقع للتوصيل.';
      notice.classList.add('show', 'is-error');
    }
    return;
  }

  submitBtn.disabled = true;
  if (notice) {
    notice.classList.remove('is-error');
    notice.textContent = 'جاري حفظ الطلب...';
    notice.classList.add('show');
  }

  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId,
        name,
        phone,
        deliveryType,
        locationLink: deliveryType === 'delivery' ? locationLink : null,
        items: cart.items
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'تعذر إنشاء الطلب');
    }

    const message = buildWhatsAppMessage({
      storeName: data?.store?.name || cart.storeName || 'المتجر',
      items: cart.items,
      totalPrice: data?.order?.total_price || window.CartUtils.getCartTotal(storeId),
      customerName: name,
      customerPhone: phone,
      deliveryType,
      locationLink: deliveryType === 'delivery' ? locationLink : '',
      orderId: data?.order?.id || ''
    });

    const whatsappPhone = String(data?.store?.whatsapp_phone || cart.storePhone || '').replace(/\D/g, '');
    const waUrl = `https://api.whatsapp.com/send?phone=${whatsappPhone}&text=${encodeURIComponent(message)}`;

    window.CartUtils.clearCart(storeId);
    refreshView(storeId);

    if (notice) {
      notice.textContent = 'تم إنشاء الطلب بنجاح. سيتم فتح واتساب الآن.';
      notice.classList.remove('is-error');
      notice.classList.add('show');
    }

    window.open(waUrl, '_blank', 'noopener');
  } catch (err) {
    if (notice) {
      notice.textContent = err.message || 'حدث خطأ أثناء إرسال الطلب.';
      notice.classList.add('show', 'is-error');
    }
  } finally {
    submitBtn.disabled = false;
  }
}

function refreshView(storeId) {
  if (!window.CartUtils || !storeId) return;
  const cart = window.CartUtils.getCart(storeId);
  renderCart(cart);
}

function showAuthWall(storeId) {
  const formCard = document.querySelector('.checkout-card[aria-label="بيانات الطلب"]');
  if (!formCard) return;

  formCard.innerHTML = `
    <div class="checkout-auth-wall">
      <div class="checkout-auth-icon">🔐</div>
      <h2 class="checkout-subtitle">تسجيل الدخول مطلوب</h2>
      <p class="checkout-auth-text">يجب تسجيل الدخول لإتمام الطلب وحفظ بياناتك بأمان.</p>
      <a href="login.html" class="btn btn-primary btn-block" id="authWallLoginBtn">المتابعة باستخدام Google</a>
    </div>
  `;

  document.getElementById('authWallLoginBtn').addEventListener('click', () => {
    sessionStorage.setItem('loginRedirect', location.href);
  });
}

async function prefillFromProfile() {
  const nameInput = document.getElementById('name');
  const phoneInput = document.getElementById('phone');
  if (!nameInput && !phoneInput) return;

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('user_profiles')
      .select('full_name, phone')
      .maybeSingle();

    if (error || !data) return;
    if (nameInput && !nameInput.value && data.full_name) nameInput.value = data.full_name;
    if (phoneInput && !phoneInput.value && data.phone) phoneInput.value = data.phone;
  } catch (_) {
    // Non-critical — silently ignore
  }
}

async function setupCheckout() {
  const storeId = getStoreId();
  const form = document.getElementById('checkoutForm');
  const detectBtn = document.getElementById('detectLocationBtn');
  const deliveryInputs = document.querySelectorAll('input[name="deliveryType"]');

  if (!window.CartUtils || !storeId) {
    return;
  }

  const cart = window.CartUtils.getCart(storeId);
  if (!cart.storeId) {
    return;
  }

  // Always render cart preview — even for unauthenticated users.
  refreshView(storeId);

  // Auth gate: must be signed in to complete checkout.
  let session = null;
  try {
    session = await checkSession();
  } catch (_err) {
    // checkSession unavailable (e.g. script load failed) — proceed without gate.
  }

  if (!session) {
    showAuthWall(storeId);
    return;
  }

  await prefillFromProfile();

  if (!form) {
    return;
  }

  form.addEventListener('submit', submitOrder);

  deliveryInputs.forEach((input) => {
    input.addEventListener('change', () => {
      setDeliveryVisibility(input.value);
    });
  });

  const selected = form.querySelector('input[name="deliveryType"]:checked');
  setDeliveryVisibility(selected ? selected.value : 'pickup');

  if (detectBtn) {
    detectBtn.addEventListener('click', async () => {
      const notice = document.getElementById('checkoutNotice');
      try {
        await detectLocationAndFill();
        if (notice) {
          notice.textContent = 'تم تحديد الموقع وإضافة الرابط تلقائياً.';
          notice.classList.remove('is-error');
          notice.classList.add('show');
        }
      } catch (_err) {
        if (notice) {
          notice.textContent = 'تعذر تحديد الموقع. أضف رابط خرائط Google يدوياً.';
          notice.classList.add('show', 'is-error');
        }
      }
    });
  }
}

window.addEventListener('load', setupCheckout);
window.addEventListener('cart:updated', () => refreshView(getStoreId()));
