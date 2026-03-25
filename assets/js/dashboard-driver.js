/**
 * Driver Dashboard Logic — جوب البلاد
 */

let _driver = null;
let _driverId = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (window.NavbarComponent) NavbarComponent.render('navbar-container');
    await initDashboard();
});

async function initDashboard() {
    const user = await API.auth.getUser().catch(() => null);
    if (!user) return showAuthGuard();

    const profile = await API.auth.getProfile(user.id).catch(() => null);
    if (!profile || profile.role !== 'driver') return showAuthGuard();

    try {
        _driver = await API.drivers.getOwn(user.id);
        _driverId = _driver.id;
    } catch {
        document.getElementById('dashboard-body').innerHTML = `
            <p style="color:var(--danger);text-align:center;padding:3rem;">
                لم يتم العثور على ملف المندوب الخاص بك. تواصل مع الإدارة.
            </p>`;
        document.getElementById('dashboard-body').style.display = 'block';
        return;
    }

    if (!_driver.approved) {
        document.getElementById('dashboard-body').innerHTML = `
            <div style="text-align:center;padding:4rem;">
                <p style="font-size:1.2rem;color:var(--accent);">⏳ حسابك قيد المراجعة من الإدارة.</p>
                ${_driver.rejection_reason ? `<p style="color:var(--danger);margin-top:1rem;">سبب الرفض: ${escHtml(_driver.rejection_reason)}</p>` : ''}
            </div>`;
        document.getElementById('dashboard-body').style.display = 'block';
        return;
    }

    if (_driver.retired) {
        document.getElementById('dashboard-body').innerHTML = `
            <p style="text-align:center;color:var(--text-muted);padding:4rem;">لقد أنهيت خدمتك. تواصل مع الإدارة للعودة.</p>`;
        document.getElementById('dashboard-body').style.display = 'block';
        return;
    }

    document.getElementById('dashboard-body').style.display = 'block';
    refreshAvailabilityUI();
    setupProfileForm();
    await loadOrders();
}

function showAuthGuard() {
    document.getElementById('auth-guard').style.display = 'block';
}

function refreshAvailabilityUI() {
    const btn = document.getElementById('btn-toggle-availability');
    const lbl = document.getElementById('availability-label');
    if (_driver.available) {
        btn.innerText = 'أنت متاح ✅ — اضغط لتغيير';
        btn.classList.remove('btn-outline');
        btn.classList.add('btn-secondary');
        lbl.innerText = 'سيتم عرضك للطلبات الجديدة';
    } else {
        btn.innerText = 'غير متاح 🔴 — اضغط لتغيير';
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-outline');
        lbl.innerText = 'لن تصلك طلبات جديدة';
    }
}

window.toggleAvailability = async function () {
    try {
        _driver = await API.drivers.update(_driverId, { available: !_driver.available });
        refreshAvailabilityUI();
    } catch (err) {
        alert('فشل التحديث: ' + err.message);
    }
};

window.confirmRetirement = async function () {
    if (!confirm('هل أنت متأكد من إنهاء خدمتك؟ لن تتمكن من استقبال طلبات بعد ذلك.')) return;
    try {
        await API.drivers.update(_driverId, { retired: true, available: false });
        alert('تم تسجيل تقاعدك. شكراً لخدمتك!');
        window.location.reload();
    } catch (err) {
        alert('خطأ: ' + err.message);
    }
};

// ── ORDERS ────────────────────────────────────────────
window.loadOrders = async function () {
    const list = document.getElementById('orders-list');
    list.innerHTML = '<div class="loader">جاري تحميل الطلبات...</div>';
    try {
        const orders = await API.orders.getForDriver(_driverId);
        if (!orders.length) {
            list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">لا توجد طلبات جاهزة حالياً.</p>';
            return;
        }
        list.innerHTML = orders.map(order => buildDeliveryCard(order)).join('');
    } catch (err) {
        list.innerHTML = '<p style="color:var(--danger);">تعذر تحميل الطلبات.</p>';
    }
};

function buildDeliveryCard(order) {
    const store   = order.stores  || {};
    const customer = order.users  || {};
    const items    = order.order_items || [];
    const itemsHtml = items.map(i => `<li>${escHtml(i.product_name)} × ${i.quantity}</li>`).join('');

    const isMyDelivery = order.driver_id === _driverId;
    const waCustomer  = `https://wa.me/968${(order.customer_phone || '').replace(/\D/g, '')}`;

    let actionHtml = '';
    if (order.status === 'ready') {
        actionHtml = `<button class="btn btn-secondary" onclick="startDelivery('${order.id}')">🚀 بدء التوصيل</button>`;
    } else if (order.status === 'out_for_delivery' && isMyDelivery) {
        actionHtml = `<button class="btn btn-primary" onclick="markDelivered('${order.id}')">✅ تم التسليم</button>`;
    }

    return `
        <div class="delivery-card">
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:.5rem;margin-bottom:.5rem;">
                <h4>طلب #${order.id.substring(0,8)}</h4>
                <span style="font-size:.85rem;color:var(--text-muted);">${new Date(order.created_at).toLocaleString('ar-OM')}</span>
            </div>
            <p><strong>المتجر:</strong> ${escHtml(store.name || '')}</p>
            <p><strong>العميل:</strong> ${escHtml(order.customer_name)} · ${escHtml(order.customer_phone || '')}</p>
            ${order.location_link ? `<p><a href="${order.location_link}" target="_blank" rel="noopener" style="color:var(--primary);">📍 موقع التسليم</a></p>` : ''}
            <ul style="margin:.5rem 0 .5rem 1rem;">${itemsHtml}</ul>
            <p><strong>الإجمالي:</strong> ${Utils.formatCurrency(order.total_price + (order.is_free_delivery ? 0 : order.delivery_fee))}</p>
            <div class="delivery-actions">
                ${actionHtml}
                <a href="${waCustomer}" target="_blank" rel="noopener" class="btn btn-outline" style="font-size:.85rem;padding:.4rem .9rem;background:#25d366;color:#fff;border-color:#25d366;">واتساب العميل</a>
            </div>
        </div>`;
}

window.startDelivery = async function (orderId) {
    try {
        await API.orders.updateStatus(orderId, 'out_for_delivery', { driver_id: _driverId });
        await loadOrders();
    } catch (err) {
        alert('خطأ: ' + err.message);
    }
};

window.markDelivered = async function (orderId) {
    if (!confirm('تأكيد تسليم الطلب؟')) return;
    try {
        await API.orders.updateStatus(orderId, 'delivered');
        // Increment total_deliveries
        await API.drivers.update(_driverId, { total_deliveries: (_driver.total_deliveries || 0) + 1 });
        await loadOrders();
    } catch (err) {
        alert('خطأ: ' + err.message);
    }
};

// ── PROFILE FORM ──────────────────────────────────────
function setupProfileForm() {
    if (!_driver) return;
    document.getElementById('d-name').value  = _driver.name  || '';
    document.getElementById('d-phone').value = _driver.phone || '';

    document.getElementById('driver-profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.submitter;
        btn.disabled = true;
        btn.innerText = 'جاري الحفظ...';
        try {
            _driver = await API.drivers.update(_driverId, {
                name:  document.getElementById('d-name').value.trim(),
                phone: document.getElementById('d-phone').value.trim(),
            });
            alert('تم حفظ التغييرات ✅');
        } catch (err) {
            alert('خطأ: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerText = 'حفظ التغييرات';
        }
    });
}

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
