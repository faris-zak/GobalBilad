/**
 * Store Dashboard Logic — جوب البلاد
 */

let _store = null;
let _storeId = null;

const STATUS_LABELS = {
    pending:          'قيد الانتظار',
    confirmed:        'تم التأكيد',
    ready:            'جاهز للشحن',
    out_for_delivery: 'خرج للتوصيل',
    delivered:        'تم التسليم',
    rejected:         'مرفوض',
};

const STATUS_BADGE_CLASS = {
    pending:          'badge-pending',
    confirmed:        'badge-confirmed',
    ready:            'badge-ready',
    out_for_delivery: 'badge-out',
    delivered:        'badge-delivered',
    rejected:         'badge-rejected',
};

document.addEventListener('DOMContentLoaded', async () => {
    if (window.NavbarComponent) NavbarComponent.render('navbar-container');
    await initDashboard();
});

async function initDashboard() {
    const user = await API.auth.getUser().catch(() => null);
    if (!user) { return showAuthGuard(); }

    const profile = await API.auth.getProfile(user.id).catch(() => null);
    if (!profile || profile.role !== 'store') { return showAuthGuard(); }

    // Fetch own store
    try {
        _store = await API.stores.getOwn(user.id);
        _storeId = _store.id;
    } catch {
        document.getElementById('dashboard-body').innerHTML = `
            <p style="color:var(--danger);text-align:center;padding:3rem;">
                لم يتم العثور على متجرك. تأكد من تسجيل متجرك ومن موافقة الإدارة.
            </p>`;
        document.getElementById('dashboard-body').style.display = 'block';
        return;
    }

    if (!_store.approved) {
        document.getElementById('dashboard-body').innerHTML = `
            <div style="text-align:center;padding:4rem;">
                <p style="font-size:1.2rem;color:var(--accent);">⏳ طلب تسجيل متجرك قيد المراجعة من الإدارة.</p>
                ${_store.rejection_reason ? `<p style="color:var(--danger);margin-top:1rem;">سبب الرفض: ${escHtml(_store.rejection_reason)}</p>` : ''}
            </div>`;
        document.getElementById('dashboard-body').style.display = 'block';
        return;
    }

    document.getElementById('store-name-heading').innerText = _store.name;
    document.getElementById('dashboard-body').style.display = 'block';

    await loadOrders();
    setupSettingsForm();
    setupProductForm();
};

function showAuthGuard() {
    document.getElementById('auth-guard').style.display = 'block';
}

// ── TAB SWITCHING ─────────────────────────────────────
window.switchTab = function (tabId) {
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');

    if (tabId === 'tab-products') loadProducts();
};

// ── ORDERS ────────────────────────────────────────────
window.loadOrders = async function () {
    const list = document.getElementById('orders-list');
    list.innerHTML = '<div class="loader">جاري تحميل الطلبات...</div>';
    try {
        const orders = await API.orders.getForStore(_storeId);
        if (!orders.length) {
            list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">لا توجد طلبات حالياً.</p>';
            return;
        }
        list.innerHTML = orders.map(order => buildOrderCard(order)).join('');
    } catch (err) {
        console.error('[loadOrders]', err);
        list.innerHTML = '<p style="color:var(--danger);">تعذر تحميل الطلبات.</p>';
    }
};

function buildOrderCard(order) {
    const items = order.order_items || [];
    const customer = order.users || {};
    const itemsHtml = items.map(i =>
        `<li>${escHtml(i.product_name)} × ${i.quantity} — ${Utils.formatCurrency(i.price * i.quantity)}</li>`
    ).join('');

    const actions = buildOrderActions(order);
    const waLink = `https://wa.me/968${(customer.phone || '').replace(/\D/g, '')}`;

    return `
        <div class="order-card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.5rem;">
                <h4>طلب #${order.id.substring(0,8)}</h4>
                <span class="badge-status ${STATUS_BADGE_CLASS[order.status] || ''}">${STATUS_LABELS[order.status] || order.status}</span>
            </div>
            <p style="font-size:.9rem;color:var(--text-muted);">${new Date(order.created_at).toLocaleString('ar-OM')}</p>
            <p style="margin:.5rem 0;"><strong>العميل:</strong> ${escHtml(order.customer_name)} · ${escHtml(order.customer_phone)}</p>
            ${order.location_link ? `<p><strong>الموقع:</strong> <a href="${order.location_link}" target="_blank" rel="noopener" style="color:var(--primary);">عرض على الخريطة 📍</a></p>` : ''}
            <ul style="margin:.5rem 0 .5rem 1rem;font-size:.95rem;">${itemsHtml}</ul>
            <p><strong>الإجمالي:</strong> ${Utils.formatCurrency(order.total_price)} + توصيل ${order.is_free_delivery ? 'مجاني 🎁' : Utils.formatCurrency(order.delivery_fee)}</p>
            ${order.notes ? `<p style="color:var(--text-secondary);font-size:.9rem;"><strong>ملاحظات:</strong> ${escHtml(order.notes)}</p>` : ''}
            <div class="order-actions">
                ${actions}
                ${customer.phone ? `<a href="${waLink}" target="_blank" rel="noopener" class="btn btn-outline" style="font-size:.85rem;padding:.4rem .9rem;background:#25d366;color:#fff;border-color:#25d366;">واتساب العميل</a>` : ''}
            </div>
        </div>`;
}

function buildOrderActions(order) {
    const { status, id } = order;
    const btn = (label, newStatus, cls = 'btn-secondary') =>
        `<button class="btn ${cls}" onclick="updateOrderStatus('${id}','${newStatus}')">${label}</button>`;

    if (status === 'pending')    return btn('✅ تأكيد الطلب', 'confirmed') + btn('❌ رفض', 'rejected', 'btn-outline');
    if (status === 'confirmed')  return btn('📦 جاهز للشحن', 'ready');
    if (status === 'rejected')   return '';
    if (status === 'delivered')  return '<span style="color:var(--secondary);font-weight:bold;">✔ تم التسليم</span>';
    return '';
}

window.updateOrderStatus = async function (orderId, status) {
    if (status === 'rejected' && !confirm('هل تريد فعلاً رفض هذا الطلب؟')) return;
    try {
        await API.orders.updateStatus(orderId, status);
        await loadOrders();
    } catch (err) {
        alert('فشل تحديث حالة الطلب: ' + err.message);
    }
};

// ── PRODUCTS ──────────────────────────────────────────
async function loadProducts() {
    const list = document.getElementById('products-list');
    list.innerHTML = '<div class="loader">جاري التحميل...</div>';
    try {
        const products = await API.products.getByStoreAll(_storeId);
        if (!products.length) {
            list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">لا توجد منتجات. أضف منتجك الأول الآن.</p>';
            return;
        }
        list.innerHTML = products.map(p => `
            <div class="product-row">
                <div>
                    <strong>${escHtml(p.name)}</strong>
                    ${p.description ? `<p style="font-size:.85rem;color:var(--text-muted);">${escHtml(p.description)}</p>` : ''}
                    <span style="color:var(--primary);font-weight:700;">${Utils.formatCurrency(p.price)}</span>
                </div>
                <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">
                    <button class="btn ${p.available ? 'btn-secondary' : 'btn-outline'}" style="font-size:.8rem;padding:.35rem .75rem;"
                        onclick="toggleProduct('${p.id}', ${!p.available})">
                        ${p.available ? '✅ متاح' : '❌ غير متاح'}
                    </button>
                    <button class="btn btn-outline" style="font-size:.8rem;padding:.35rem .75rem;" onclick="editProduct(${JSON.stringify(p).replace(/"/g, '&quot;')})">تعديل</button>
                    <button class="btn btn-outline" style="font-size:.8rem;padding:.35rem .75rem;color:var(--danger);border-color:var(--danger);" onclick="deleteProduct('${p.id}')">حذف</button>
                </div>
            </div>`).join('');
    } catch (err) {
        list.innerHTML = '<p style="color:var(--danger);">تعذر تحميل المنتجات.</p>';
    }
}

window.toggleProduct = async function (id, available) {
    try {
        await API.products.toggleAvailability(id, available);
        await loadProducts();
    } catch (err) {
        alert('فشل التحديث: ' + err.message);
    }
};

window.deleteProduct = async function (id) {
    if (!confirm('هل تريد حذف هذا المنتج نهائياً؟')) return;
    try {
        await API.products.delete(id);
        await loadProducts();
    } catch (err) {
        alert('فشل الحذف: ' + err.message);
    }
};

window.editProduct = function (product) {
    document.getElementById('product-form-title').innerText = 'تعديل المنتج';
    document.getElementById('edit-product-id').value = product.id;
    document.getElementById('p-name').value      = product.name || '';
    document.getElementById('p-desc').value      = product.description || '';
    document.getElementById('p-price').value     = product.price || '';
    document.getElementById('p-category').value  = product.category || '';
    document.getElementById('p-image').value     = product.image_url || '';
    document.getElementById('product-form-wrapper').style.display = 'block';
    document.getElementById('product-form-wrapper').scrollIntoView({ behavior: 'smooth' });
};

window.showAddProductForm = function () {
    document.getElementById('product-form-title').innerText = 'إضافة منتج جديد';
    document.getElementById('product-form').reset();
    document.getElementById('edit-product-id').value = '';
    document.getElementById('product-form-wrapper').style.display = 'block';
    document.getElementById('product-form-wrapper').scrollIntoView({ behavior: 'smooth' });
};

window.hideProductForm = function () {
    document.getElementById('product-form-wrapper').style.display = 'none';
};

function setupProductForm() {
    document.getElementById('product-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('product-submit-btn');
        btn.disabled = true;
        btn.innerText = 'جاري الحفظ...';

        const editId = document.getElementById('edit-product-id').value;
        const payload = {
            name:        document.getElementById('p-name').value.trim(),
            description: document.getElementById('p-desc').value.trim() || null,
            price:       parseFloat(document.getElementById('p-price').value),
            category:    document.getElementById('p-category').value.trim() || null,
            image_url:   document.getElementById('p-image').value.trim() || null,
            store_id:    _storeId,
        };

        try {
            if (editId) {
                await API.products.update(editId, payload);
            } else {
                await API.products.create(payload);
            }
            hideProductForm();
            await loadProducts();
        } catch (err) {
            alert('خطأ: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerText = 'حفظ';
        }
    });
}

// ── SETTINGS ──────────────────────────────────────────
function setupSettingsForm() {
    if (!_store) return;
    document.getElementById('s-name').value     = _store.name || '';
    document.getElementById('s-owner').value    = _store.owner_name || '';
    document.getElementById('s-phone').value    = _store.phone || '';
    document.getElementById('s-whatsapp').value = _store.whatsapp || '';
    document.getElementById('s-desc').value     = _store.description || '';

    document.getElementById('store-settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.submitter;
        btn.disabled = true;
        btn.innerText = 'جاري الحفظ...';
        try {
            await API.stores.update(_storeId, {
                name:        document.getElementById('s-name').value.trim(),
                owner_name:  document.getElementById('s-owner').value.trim(),
                phone:       document.getElementById('s-phone').value.trim(),
                whatsapp:    document.getElementById('s-whatsapp').value.trim() || null,
                description: document.getElementById('s-desc').value.trim() || null,
            });
            alert('تم حفظ الإعدادات ✅');
        } catch (err) {
            alert('خطأ: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerText = 'حفظ الإعدادات';
        }
    });
}

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
