// Driver Dashboard — API client & render logic
// Used as an ES module by driver-dashboard.html

const API = '/api/trader?resource=driver';
let _token = null;

// ─── Bootstrap ───────────────────────────────────────────────────────────────
export async function initDriver(token) {
  _token = token;
  document.getElementById('refreshBtn').addEventListener('click', refresh);
  await refresh();
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────
async function apiFetch(method, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + _token,
    },
  };
  if (body !== null) opts.body = JSON.stringify(body);
  const res = await fetch(API, opts);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

// ─── Data refresh ────────────────────────────────────────────────────────────
async function refresh() {
  setLoading(true);
  const { ok, data } = await apiFetch('GET');
  setLoading(false);
  if (!ok) {
    showError(data.message || 'فشل تحميل الطلبات');
    return;
  }
  renderAvailable(data.available || []);
  renderMine(data.mine || []);
}

// ─── Actions ─────────────────────────────────────────────────────────────────
async function takeOrder(id, btn) {
  btn.disabled = true;
  btn.textContent = '…';
  const { ok, data } = await apiFetch('PATCH', { action: 'take', id });
  if (!ok) {
    btn.disabled = false;
    btn.textContent = 'استلام الطلب';
    showToast(data.message || 'فشل الاستلام', 'err');
    return;
  }
  showToast('تم استلام الطلب ✓');
  await refresh();
}

async function changeStatus(id, status, btn) {
  btn.disabled = true;
  const labels = { out_for_delivery: 'جارٍ التوصيل…', delivered: 'جارٍ التأكيد…' };
  btn.textContent = labels[status] || '…';
  const { ok, data } = await apiFetch('PATCH', { action: 'status', id, status });
  if (!ok) {
    btn.disabled = false;
    btn.textContent = status === 'out_for_delivery' ? 'بدء التوصيل 🚗' : 'تم التسليم ✅';
    showToast(data.message || 'فشل التحديث', 'err');
    return;
  }
  showToast(status === 'delivered' ? 'تم تأكيد التسليم ✓' : 'بدأ التوصيل ✓');
  await refresh();
}

// ─── Render helpers ───────────────────────────────────────────────────────────
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtPrice(p) {
  return Number(p).toLocaleString('ar-IQ') + ' د.ع';
}

function itemsHtml(items) {
  if (!Array.isArray(items) || !items.length) return '<li class="drv-item-row"><span>—</span></li>';
  return items
    .map(
      it =>
        `<li class="drv-item-row"><span>${esc(it.name)} × ${it.qty}</span><span class="drv-item-price">${fmtPrice(it.price * it.qty)}</span></li>`
    )
    .join('');
}

function locationBtn(link) {
  if (!link) return '';
  return `<a class="drv-location-btn" href="${esc(link)}" target="_blank" rel="noopener noreferrer">📍 الموقع</a>`;
}

function storeName(o) {
  return o.stores?.name || o.store_id?.slice(0, 8) || '—';
}

function buildCard(o, actionsHtml) {
  return `
    <div class="drv-card" id="dcard-${o.id}">
      <div class="drv-card-head">
        <span class="drv-store-name">${esc(storeName(o))}</span>
        <span class="drv-delivery-tag">توصيل</span>
      </div>
      <ul class="drv-items">${itemsHtml(o.items)}</ul>
      <div class="drv-card-foot">
        <span class="drv-total">${fmtPrice(o.total_price)}</span>
        ${locationBtn(o.location_link)}
      </div>
      <div class="drv-actions">${actionsHtml}</div>
    </div>`;
}

function renderAvailable(orders) {
  const el = document.getElementById('availableList');
  const counter = document.getElementById('availableCount');
  counter.textContent = orders.length;
  if (!orders.length) {
    el.innerHTML = '<p class="drv-empty">لا توجد طلبات جاهزة للاستلام الآن.</p>';
    return;
  }
  el.innerHTML = orders
    .map(o =>
      buildCard(
        o,
        `<button class="drv-btn drv-btn-take" data-id="${o.id}" onclick="window._driverTake('${o.id}',this)">استلام الطلب</button>`
      )
    )
    .join('');
}

function renderMine(orders) {
  const el = document.getElementById('myOrdersList');
  const counter = document.getElementById('myCount');
  counter.textContent = orders.length;
  if (!orders.length) {
    el.innerHTML = '<p class="drv-empty">ليس لديك طلبات نشطة الآن.</p>';
    return;
  }
  el.innerHTML = orders
    .map(o => {
      let actions = '';
      if (o.status === 'ready_for_shipping') {
        actions = `<button class="drv-btn drv-btn-start" onclick="window._driverStart('${o.id}',this)">🚗 بدء التوصيل</button>`;
      } else if (o.status === 'out_for_delivery') {
        actions = `<button class="drv-btn drv-btn-done" onclick="window._driverDone('${o.id}',this)">✅ تم التسليم</button>`;
      }
      return buildCard(o, actions);
    })
    .join('');
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function setLoading(on) {
  const btn = document.getElementById('refreshBtn');
  btn.disabled = on;
  btn.textContent = on ? '…' : '↻ تحديث';
}

function showError(msg) {
  document.getElementById('availableList').innerHTML = `<p class="drv-error">${esc(msg)}</p>`;
}

let _toastTimer;
function showToast(msg, type = 'ok') {
  const t = document.getElementById('drvToast');
  t.textContent = msg;
  t.className = 'drv-toast show' + (type === 'err' ? ' err' : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.className = 'drv-toast'; }, 3500);
}

// ─── Global callbacks (called from inline onclick in rendered HTML) ───────────
window._driverTake  = (id, btn) => takeOrder(id, btn);
window._driverStart = (id, btn) => changeStatus(id, 'out_for_delivery', btn);
window._driverDone  = (id, btn) => changeStatus(id, 'delivered', btn);
