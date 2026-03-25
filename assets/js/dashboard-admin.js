/**
 * Admin Dashboard Logic — جوب البلاد
 */

document.addEventListener('DOMContentLoaded', async () => {
    if (window.NavbarComponent) NavbarComponent.render('navbar-container');
    await initDashboard();
});

async function initDashboard() {
    const user = await API.auth.getUser().catch(() => null);
    if (!user) return showAuthGuard();

    const profile = await API.auth.getProfile(user.id).catch(() => null);
    if (!profile || profile.role !== 'admin') return showAuthGuard();

    document.getElementById('dashboard-body').style.display = 'block';
    await Promise.all([loadStats(), loadStores()]);
}

function showAuthGuard() {
    document.getElementById('auth-guard').style.display = 'block';
}

window.switchTab = function (tabId, btn) {
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');

    if (tabId === 'tab-drivers')  loadDrivers();
    if (tabId === 'tab-orders')   loadAllOrders();
    if (tabId === 'tab-users')    loadUsers();
    if (tabId === 'tab-messages') loadMessages();
};

// ── STATS ─────────────────────────────────────────────
async function loadStats() {
    try {
        const [stores, drivers, orders, users, unread] = await Promise.all([
            API.stores.adminGetAll(),
            API.drivers.adminGetAll(),
            API.orders.adminGetAll(),
            API.users.adminGetAll(),
            API.contactMessages.adminUnreadCount(),
        ]);
        document.getElementById('stat-stores').innerText   = stores.length;
        document.getElementById('stat-drivers').innerText  = drivers.length;
        document.getElementById('stat-orders').innerText   = orders.length;
        document.getElementById('stat-users').innerText    = users.length;
        document.getElementById('stat-messages').innerText = unread;
        const msgBtn = document.getElementById('messages-tab-btn');
        if (msgBtn) msgBtn.textContent = unread > 0 ? `📨 الرسائل (${unread})` : '📨 الرسائل';
    } catch { /* stats are non-critical */ }
}

// ── STORES ────────────────────────────────────────────
window.loadStores = async function () {
    const list = document.getElementById('stores-list');
    list.innerHTML = '<div class="loader">جاري التحميل...</div>';
    try {
        const stores = await API.stores.adminGetAll();
        if (!stores.length) { list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">لا توجد متاجر.</p>'; return; }

        list.innerHTML = stores.map(s => `
            <div class="admin-card">
                <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:.5rem;">
                    <h4>${escHtml(s.name)}</h4>
                    <span class="badge-status ${s.approved ? 'badge-approved' : 'badge-pending'}">${s.approved ? 'معتمد' : 'قيد المراجعة'}</span>
                </div>
                <p style="font-size:.9rem;color:var(--text-muted);">
                    المالك: ${escHtml(s.owner_name)} · الهاتف: ${escHtml(s.phone)}
                    ${s.category ? ' · ' + escHtml(s.category) : ''}
                </p>
                <p style="font-size:.85rem;color:var(--text-muted);">${new Date(s.created_at).toLocaleDateString('ar-OM')}</p>
                ${s.rejection_reason ? `<p style="color:var(--danger);font-size:.9rem;">سبب الرفض: ${escHtml(s.rejection_reason)}</p>` : ''}
                <div class="admin-actions">
                    ${!s.approved
                        ? `<button class="btn btn-secondary" onclick="approveStore('${s.id}')">✅ موافقة</button>
                           <button class="btn btn-outline" style="color:var(--danger);border-color:var(--danger);" onclick="rejectStore('${s.id}')">❌ رفض</button>`
                        : `<button class="btn btn-outline" style="color:var(--danger);border-color:var(--danger);" onclick="rejectStore('${s.id}')">إلغاء الاعتماد</button>`
                    }
                </div>
            </div>`).join('');
    } catch (err) {
        list.innerHTML = '<p style="color:var(--danger);">تعذر التحميل.</p>';
    }
};

window.approveStore = async function (id) {
    await API.stores.adminSetApproval(id, true, null).catch(e => alert(e.message));
    await loadStores();
};

window.rejectStore = async function (id) {
    const reason = prompt('سبب الرفض (اختياري):') || null;
    await API.stores.adminSetApproval(id, false, reason).catch(e => alert(e.message));
    await loadStores();
};

// ── DRIVERS ───────────────────────────────────────────
window.loadDrivers = async function () {
    const list = document.getElementById('drivers-list');
    list.innerHTML = '<div class="loader">جاري التحميل...</div>';
    try {
        const drivers = await API.drivers.adminGetAll();
        if (!drivers.length) { list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">لا يوجد مندوبون.</p>'; return; }

        list.innerHTML = drivers.map(d => {
            const u = d.users || {};
            const waLink = `https://wa.me/968${(d.phone || '').replace(/\D/g,'')}`;
            return `
                <div class="admin-card">
                    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:.5rem;">
                        <h4>${escHtml(d.name)}</h4>
                        <span class="badge-status ${d.approved ? 'badge-approved' : 'badge-pending'}">${d.approved ? (d.available ? 'متاح' : 'غير متاح') : 'قيد المراجعة'}</span>
                    </div>
                    <p style="font-size:.9rem;color:var(--text-muted);">
                        الهاتف: ${escHtml(d.phone || u.phone || '—')} · إجمالي التوصيلات: ${d.total_deliveries || 0}
                        ${d.retired ? ' · <strong style="color:var(--danger)">متقاعد</strong>' : ''}
                    </p>
                    ${d.rejection_reason ? `<p style="color:var(--danger);font-size:.9rem;">سبب الرفض: ${escHtml(d.rejection_reason)}</p>` : ''}
                    <div class="admin-actions">
                        ${!d.approved
                            ? `<button class="btn btn-secondary" onclick="approveDriver('${d.id}')">✅ موافقة</button>
                               <button class="btn btn-outline" style="color:var(--danger);border-color:var(--danger);" onclick="rejectDriver('${d.id}')">❌ رفض</button>`
                            : `<button class="btn btn-outline" style="color:var(--danger);border-color:var(--danger);font-size:.85rem;" onclick="rejectDriver('${d.id}')">تعطيل</button>`
                        }
                        <a href="${waLink}" target="_blank" rel="noopener" class="btn btn-outline" style="font-size:.85rem;padding:.4rem .9rem;background:#25d366;color:#fff;border-color:#25d366;">واتساب</a>
                    </div>
                </div>`;
        }).join('');
    } catch {
        list.innerHTML = '<p style="color:var(--danger);">تعذر التحميل.</p>';
    }
};

window.approveDriver = async function (id) {
    await API.drivers.adminSetApproval(id, true, null).catch(e => alert(e.message));
    await loadDrivers();
};

window.rejectDriver = async function (id) {
    const reason = prompt('سبب الرفض أو التعطيل (اختياري):') || null;
    await API.drivers.adminSetApproval(id, false, reason).catch(e => alert(e.message));
    await loadDrivers();
};

// ── ORDERS ─────────────────────────────────────────────
const STATUS_LABELS = {
    pending:'قيد الانتظار', confirmed:'مؤكد', ready:'جاهز للشحن',
    out_for_delivery:'في الطريق', delivered:'تم التسليم', rejected:'مرفوض'
};

window.loadAllOrders = async function () {
    const list = document.getElementById('all-orders-list');
    list.innerHTML = '<div class="loader">جاري التحميل...</div>';
    try {
        const orders = await API.orders.adminGetAll();
        if (!orders.length) { list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">لا توجد طلبات.</p>'; return; }

        list.innerHTML = `
            <div style="overflow-x:auto;">
            <table>
                <thead><tr>
                    <th>رقم</th><th>المتجر</th><th>العميل</th><th>الإجمالي</th><th>الحالة</th><th>التاريخ</th>
                </tr></thead>
                <tbody>${orders.map(o => `
                    <tr>
                        <td style="font-size:.8rem;">${o.id.substring(0,8)}</td>
                        <td>${escHtml((o.stores || {}).name || '—')}</td>
                        <td>${escHtml(o.customer_name)}</td>
                        <td>${Utils.formatCurrency(o.total_price + (o.is_free_delivery ? 0 : o.delivery_fee))}</td>
                        <td>${STATUS_LABELS[o.status] || o.status}</td>
                        <td style="font-size:.85rem;">${new Date(o.created_at).toLocaleDateString('ar-OM')}</td>
                    </tr>`).join('')}
                </tbody>
            </table></div>`;
    } catch {
        list.innerHTML = '<p style="color:var(--danger);">تعذر التحميل.</p>';
    }
};

// ── USERS ─────────────────────────────────────────────
window.loadUsers = async function () {
    const list = document.getElementById('users-list');
    list.innerHTML = '<div class="loader">جاري التحميل...</div>';
    try {
        const users = await API.users.adminGetAll();
        if (!users.length) { list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">لا يوجد مستخدمون.</p>'; return; }

        const roleLabel = { customer:'عميل', store:'تاجر', driver:'مندوب', admin:'مدير' };
        list.innerHTML = `
            <div style="overflow-x:auto;">
            <table>
                <thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>الحالة</th><th>تاريخ التسجيل</th><th></th></tr></thead>
                <tbody>${users.map(u => `
                    <tr>
                        <td>${escHtml(u.name || '—')}</td>
                        <td style="font-size:.85rem;">${escHtml(u.email)}</td>
                        <td>${roleLabel[u.role] || u.role}</td>
                        <td>${u.is_blocked ? '<span style="color:var(--danger);">محظور</span>' : '<span style="color:var(--secondary);">نشط</span>'}</td>
                        <td style="font-size:.85rem;">${new Date(u.created_at).toLocaleDateString('ar-OM')}</td>
                        <td>
                            <button class="btn btn-outline" style="font-size:.8rem;padding:.3rem .7rem;${u.is_blocked ? '' : 'color:var(--danger);border-color:var(--danger);'}"
                                onclick="toggleBlock('${u.id}', ${!u.is_blocked})">
                                ${u.is_blocked ? 'رفع الحظر' : 'حظر'}
                            </button>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table></div>`;
    } catch {
        list.innerHTML = '<p style="color:var(--danger);">تعذر التحميل.</p>';
    }
};

window.toggleBlock = async function (userId, block) {
    if (block && !confirm('هل تريد حظر هذا المستخدم؟')) return;
    await API.users.adminBlock(userId, block).catch(e => alert(e.message));
    await loadUsers();
};

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── MESSAGES ───────────────────────────────────────────
const REQUEST_TYPE_ICONS = { 'شكوى':'😡', 'اقتراح':'💡', 'سؤال':'❓', 'إبلاغ عن مشكلة':'🚨' };

window.loadMessages = async function () {
    const list = document.getElementById('messages-list');
    list.innerHTML = '<div class="loader">جاري التحميل...</div>';
    try {
        const messages = await API.contactMessages.adminGetAll();
        if (!messages.length) {
            list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">لا توجد رسائل بعد.</p>';
            return;
        }
        list.innerHTML = messages.map(m => {
            const icon = REQUEST_TYPE_ICONS[m.request_type] || '📨';
            const date = new Date(m.created_at).toLocaleString('ar-OM');
            const unreadBorder = m.is_read ? '' : 'border-right:3px solid var(--accent);';
            return `
                <div class="admin-card" style="${unreadBorder}">
                    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:.5rem;margin-bottom:.4rem;">
                        <h4>${icon} ${escHtml(m.request_type)}
                            ${!m.is_read ? '<span style="background:var(--accent);color:#fff;font-size:.72rem;font-weight:700;padding:.15em .55em;border-radius:999px;margin-right:.4rem;">جديد</span>' : ''}
                        </h4>
                        <span style="font-size:.82rem;color:var(--text-muted);">${date}</span>
                    </div>
                    <p style="font-size:.92rem;font-weight:600;color:var(--text-primary);margin-bottom:.25rem;">
                        ${escHtml(m.name)}
                        ${m.phone ? `<span style="color:var(--text-muted);font-weight:400;"> · ${escHtml(m.phone)}</span>` : ''}
                    </p>
                    <p style="font-size:.92rem;color:var(--text-secondary);white-space:pre-wrap;margin-bottom:.75rem;">${escHtml(m.message)}</p>
                    <div class="admin-actions">
                        ${!m.is_read
                            ? `<button class="btn btn-outline" style="font-size:.82rem;padding:.35rem .85rem;" onclick="markMessageRead('${m.id}')">✅ تحديد كمقروء</button>`
                            : '<span style="font-size:.82rem;color:var(--text-muted);">✔ مقروء</span>'
                        }
                        <button class="btn btn-outline" style="font-size:.82rem;padding:.35rem .85rem;color:var(--danger);border-color:var(--danger);" onclick="deleteMessage('${m.id}')">🗑 حذف</button>
                        ${m.phone ? `<a href="https://wa.me/968${m.phone.replace(/\D/g,'')}" target="_blank" rel="noopener" class="btn" style="font-size:.82rem;padding:.35rem .85rem;background:#25d366;color:#fff;border:none;">واتساب</a>` : ''}
                    </div>
                </div>`;
        }).join('');
    } catch {
        list.innerHTML = '<p style="color:var(--danger);">تعذر التحميل.</p>';
    }
};

window.markMessageRead = async function (id) {
    await API.contactMessages.adminMarkRead(id).catch(e => alert(e.message));
    await Promise.all([loadStats(), loadMessages()]);
};

window.deleteMessage = async function (id) {
    if (!confirm('هل تريد حذف هذه الرسالة نهائياً؟')) return;
    await API.contactMessages.adminDelete(id).catch(e => alert(e.message));
    await Promise.all([loadStats(), loadMessages()]);
};
