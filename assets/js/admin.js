const adminStatusEl = document.getElementById('adminStatus');
const usersListEl = document.getElementById('usersList');
const applicationsListEl = document.getElementById('applicationsList');
const messagesListEl = document.getElementById('messagesList');
const kpiUsersEl = document.getElementById('kpiUsers');
const kpiBannedEl = document.getElementById('kpiBanned');
const kpiNewMessagesEl = document.getElementById('kpiNewMessages');
const kpiPendingApplicationsEl = document.getElementById('kpiPendingApplications');

const usersSearchInput = document.getElementById('usersSearchInput');
const usersRoleFilter = document.getElementById('usersRoleFilter');
const usersStatusFilter = document.getElementById('usersStatusFilter');
const applicationsStatusFilter = document.getElementById('applicationsStatusFilter');
const applicationsRoleFilter = document.getElementById('applicationsRoleFilter');
const messagesStatusFilter = document.getElementById('messagesStatusFilter');
const refreshDashboardBtn = document.getElementById('refreshDashboardBtn');
const seedStoresBtn = document.getElementById('seedStoresBtn');

let dashboardState = {
  users: [],
  applications: [],
  messages: []
};

function setAdminStatus(type, text) {
  if (!adminStatusEl) {
    return;
  }

  adminStatusEl.className = `admin-status ${type || ''}`.trim();
  adminStatusEl.textContent = text || '';
}

// Build a contextual WhatsApp URL for an applicant.
// status: 'pending' | 'approved' | 'rejected'
function buildCardWaUrl(phone, name, requestedRole, status, rejectionReason) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  // Prepend Omani country code (968) when not already present.
  const normalised = digits.startsWith('968')
    ? digits
    : digits.startsWith('0')
    ? `968${digits.slice(1)}`
    : `968${digits}`;

  const roleLabel = requestedRole === 'trader' ? 'تاجر' : 'مندوب توصيل';
  let message = '';
  if (status === 'approved') {
    message = `✅ مبروك ${name}!\n\n تمت الموافقة على طلبك في جوب البلاد.\nيمكنك الآن تسجيل الدخول والاستمتاع بدورك الجديد كـ${roleLabel}.`;
  } else if (status === 'rejected') {
    const reasonText = rejectionReason ? `\nالسبب: ${rejectionReason}` : '';
    message = `نأسف ${name}، تم رفض طلبك في جوب البلاد.${reasonText}\nيمكنك إعادة التقديم من خلال حسابك في أي وقت.`;
  }

  const base = `https://api.whatsapp.com/send?phone=${normalised}`;
  return message ? `${base}&text=${encodeURIComponent(message)}` : base;
}

async function getAccessTokenOrThrow() {
  const session = await checkSession();
  if (!session?.access_token) {
    throw new Error('NO_SESSION');
  }
  return session.access_token;
}

async function apiFetch(path, options = {}) {
  const token = await getAccessTokenOrThrow();
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(payload.message || 'REQUEST_FAILED');
    err.status = response.status;
    err.payload = payload;
    throw err;
  }

  return payload;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function userBadgeClass(role) {
  if (role === 'admin') return 'admin-badge admin-badge-admin';
  if (role === 'trader') return 'admin-badge admin-badge-trader';
  if (role === 'delivery') return 'admin-badge admin-badge-delivery';
  return 'admin-badge';
}

function statusBadgeClass(status) {
  if (status === 'banned') return 'admin-badge admin-badge-banned';
  return 'admin-badge admin-badge-active';
}

function messageStatusClass(status) {
  if (status === 'resolved') return 'admin-badge admin-badge-resolved';
  if (status === 'read') return 'admin-badge admin-badge-read';
  return 'admin-badge admin-badge-new';
}

function updateKpis() {
  const users = dashboardState.users || [];
  const applications = dashboardState.applications || [];
  const messages = dashboardState.messages || [];

  const bannedCount = users.filter((user) => user.account_status === 'banned').length;
  const pendingApplicationsCount = applications.filter((application) => application.application_status === 'pending').length;
  const newMessagesCount = messages.filter((message) => message.status === 'new').length;

  kpiUsersEl.textContent = String(users.length);
  kpiBannedEl.textContent = String(bannedCount);
  kpiNewMessagesEl.textContent = String(newMessagesCount);
  if (kpiPendingApplicationsEl) {
    kpiPendingApplicationsEl.textContent = String(pendingApplicationsCount);
  }
}

function renderUsers() {
  if (!usersListEl) {
    return;
  }

  const users = dashboardState.users || [];
  if (!users.length) {
    usersListEl.innerHTML = '<div class="admin-empty">لا توجد نتائج للمستخدمين.</div>';
    return;
  }

  usersListEl.innerHTML = users.map((user) => {
    const displayName = user.full_name || 'بدون اسم';
    const email = user.email || '-';
    const phone = user.phone || '-';
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    const nextRoleLabel = user.role === 'admin' ? 'تحويل إلى User' : 'تحويل إلى Admin';
    const nextStatus = user.account_status === 'banned' ? 'active' : 'banned';
    const nextStatusLabel = user.account_status === 'banned' ? 'إلغاء الحظر' : 'حظر المستخدم';

    return `
      <article class="admin-user-row" data-user-id="${escapeHtml(user.user_id)}">
        <div class="admin-user-main">
          <h3>${escapeHtml(displayName)}</h3>
          <p dir="ltr">${escapeHtml(email)}</p>
          <p dir="ltr">${escapeHtml(phone)}</p>
        </div>
        <div class="admin-user-meta">
          <span class="${userBadgeClass(user.role)}">${escapeHtml(user.role)}</span>
          <span class="${statusBadgeClass(user.account_status)}">${escapeHtml(user.account_status)}</span>
        </div>
        <div class="admin-user-actions">
          <button class="btn btn-outline btn-sm" data-action="role" data-role="${escapeHtml(nextRole)}" type="button">${escapeHtml(nextRoleLabel)}</button>
          <button class="btn btn-primary btn-sm" data-action="status" data-status="${escapeHtml(nextStatus)}" type="button">${escapeHtml(nextStatusLabel)}</button>
        </div>
      </article>
    `;
  }).join('');
}

function renderMessages() {
  if (!messagesListEl) {
    return;
  }

  const messages = dashboardState.messages || [];
  if (!messages.length) {
    messagesListEl.innerHTML = '<div class="admin-empty">لا توجد رسائل حالياً.</div>';
    return;
  }

  messagesListEl.innerHTML = messages.map((message) => {
    return `
      <article class="admin-message-row" data-message-id="${escapeHtml(message.id)}">
        <div class="admin-message-head">
          <h3>${escapeHtml(message.sender_name)}</h3>
          <span class="${messageStatusClass(message.status)}">${escapeHtml(message.status)}</span>
        </div>
        <p class="admin-message-line" dir="ltr">${escapeHtml(message.sender_email || '-')}</p>
        <p class="admin-message-line" dir="ltr">${escapeHtml(message.sender_phone)}</p>
        <p class="admin-message-type">${escapeHtml(message.request_type)}</p>
        <p class="admin-message-body">${escapeHtml(message.message)}</p>
        <div class="admin-message-actions">
          <button class="btn btn-outline btn-sm" data-action="message-status" data-status="read" type="button">تمييز كمقروءة</button>
          <button class="btn btn-primary btn-sm" data-action="message-status" data-status="resolved" type="button">إغلاق</button>
        </div>
      </article>
    `;
  }).join('');
}

function renderApplications() {
  if (!applicationsListEl) {
    return;
  }

  const applications = dashboardState.applications || [];
  if (!applications.length) {
    applicationsListEl.innerHTML = '<div class="admin-empty">لا توجد طلبات حالياً.</div>';
    return;
  }

  applicationsListEl.innerHTML = applications.map((application) => {
    const displayName = application.full_name || application.application_payload?.fullName || application.application_payload?.ownerName || 'بدون اسم';
    const roleLabel = application.requested_role === 'trader' ? 'تاجر' : 'مندوب';
    const payloadPreview = application.application_payload ? escapeHtml(JSON.stringify(application.application_payload)) : '-';
    const canReview = application.application_status === 'pending';

    const waUrl = buildCardWaUrl(
      application.phone || '',
      displayName,
      application.requested_role || '',
      application.application_status,
      application.application_rejection_reason || ''
    );
    const waBtn = waUrl
      ? `<a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm admin-wa-btn">📲 واتساب</a>`
      : `<span class="admin-wa-no-phone">لا يوجد رقم هاتف</span>`;

    return `
      <article class="admin-application-row"
        data-app-user-id="${escapeHtml(application.user_id)}">
        <div class="admin-message-head">
          <h3>${escapeHtml(displayName)}</h3>
          <span class="${messageStatusClass(application.application_status)}">${escapeHtml(application.application_status)}</span>
        </div>
        <p class="admin-message-line" dir="ltr">user_id: ${escapeHtml(application.user_id)}</p>
        <p class="admin-message-type">نوع الطلب: <strong>${escapeHtml(roleLabel)}</strong></p>
        <p class="admin-message-line">الدور الحالي: <span class="${userBadgeClass(application.role || 'user')}">${escapeHtml(application.role || 'user')}</span></p>
        <details class="admin-application-details">
          <summary>عرض بيانات الطلب</summary>
          <pre>${payloadPreview}</pre>
        </details>
        <p class="admin-message-line">تاريخ التقديم: ${escapeHtml(application.application_submitted_at || '-')}</p>
        ${application.application_rejection_reason ? `<p class="admin-message-line">سبب الرفض: ${escapeHtml(application.application_rejection_reason)}</p>` : ''}
        <div class="admin-user-actions">
          <button class="btn btn-primary btn-sm" data-action="application-approve" type="button" ${canReview ? '' : 'disabled'}>قبول الطلب</button>
          <button class="btn btn-outline btn-sm" data-action="application-reject" type="button" ${canReview ? '' : 'disabled'}>رفض الطلب</button>
          ${waBtn}
        </div>
      </article>
    `;
  }).join('');
}

async function loadUsers() {
  const query = new URLSearchParams();
  query.set('page', '1');
  query.set('pageSize', '100');

  const search = usersSearchInput.value.trim();
  const role = usersRoleFilter.value;
  const status = usersStatusFilter.value;

  if (search) query.set('search', search);
  if (role) query.set('role', role);
  if (status) query.set('status', status);

  const payload = await apiFetch(`/api/admin-users?${query.toString()}`);
  dashboardState.users = payload.users || [];
}

async function loadMessages() {
  const query = new URLSearchParams();
  query.set('page', '1');
  query.set('pageSize', '100');

  const status = messagesStatusFilter.value;
  if (status) {
    query.set('status', status);
  }

  const payload = await apiFetch(`/api/admin-messages?${query.toString()}`);
  dashboardState.messages = payload.messages || [];
}

async function loadApplications() {
  const query = new URLSearchParams();
  query.set('page', '1');
  query.set('pageSize', '100');

  const status = applicationsStatusFilter?.value || '';
  const requestedRole = applicationsRoleFilter?.value || '';
  if (status) query.set('status', status);
  if (requestedRole) query.set('requestedRole', requestedRole);

  const payload = await apiFetch(`/api/admin-applications?${query.toString()}`);
  dashboardState.applications = payload.applications || [];
}

async function refreshDashboard() {
  setAdminStatus('', 'جاري تحديث البيانات...');

  const results = await Promise.allSettled([loadUsers(), loadApplications(), loadMessages()]);

  const applicationsFailed = results[1]?.status === 'rejected';
  if (applicationsFailed) {
    console.error('Applications load failed:', results[1].reason);
    setAdminStatus('err', 'تعذر تحميل طلبات الانضمام. تأكد من تحديث قاعدة البيانات وإعادة تحميل الصفحة.');
  }

  renderUsers();
  renderApplications();
  renderMessages();
  updateKpis();

  if (applicationsFailed) {
    return;
  }

  setAdminStatus('ok', 'تم تحديث لوحة الإدارة بنجاح.');
}

async function updateUser(userId, payload) {
  await apiFetch('/api/admin-users', {
    method: 'PATCH',
    body: JSON.stringify({ userId, ...payload })
  });
}

async function updateMessageStatus(id, status) {
  await apiFetch('/api/admin-messages', {
    method: 'PATCH',
    body: JSON.stringify({ id, status })
  });
}

async function reviewApplication(userId, decision, reason = '') {
  await apiFetch('/api/admin-applications', {
    method: 'PATCH',
    body: JSON.stringify({ userId, decision, reason })
  });
}

async function runSeedHelper() {
  const payload = await apiFetch('/api/admin-seed-helper', {
    method: 'POST'
  });

  return payload?.result || null;
}

async function handleUsersClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const row = event.target.closest('[data-user-id]');
  if (!row) {
    return;
  }

  const userId = row.getAttribute('data-user-id');
  const action = button.getAttribute('data-action');

  button.disabled = true;
  try {
    if (action === 'role') {
      const role = button.getAttribute('data-role');
      await updateUser(userId, { role });
    }

    if (action === 'status') {
      const account_status = button.getAttribute('data-status');
      await updateUser(userId, { account_status });
    }

    await refreshDashboard();
  } catch (error) {
    setAdminStatus('err', error.message || 'فشلت عملية تحديث المستخدم.');
  } finally {
    button.disabled = false;
  }
}

async function handleMessagesClick(event) {
  const button = event.target.closest('button[data-action="message-status"]');
  if (!button) {
    return;
  }

  const row = event.target.closest('[data-message-id]');
  if (!row) {
    return;
  }

  const id = row.getAttribute('data-message-id');
  const status = button.getAttribute('data-status');

  button.disabled = true;
  try {
    await updateMessageStatus(id, status);
    await refreshDashboard();
  } catch (error) {
    setAdminStatus('err', error.message || 'فشل تحديث حالة الرسالة.');
  } finally {
    button.disabled = false;
  }
}

async function handleApplicationsClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const action = button.getAttribute('data-action');
  if (action !== 'application-approve' && action !== 'application-reject') {
    return;
  }

  const row = event.target.closest('[data-app-user-id]');
  if (!row) {
    return;
  }

  const userId = row.getAttribute('data-app-user-id');
  if (!userId) {
    return;
  }

  button.disabled = true;
  try {
    if (action === 'application-approve') {
      await reviewApplication(userId, 'approve');
      setAdminStatus('ok', 'تم قبول الطلب بنجاح. استخدم زر واتساب في البطاقة لإشعار المتقدم.');
    } else {
      const reason = window.prompt('سبب الرفض (إجباري):');
      if (!reason) {
        setAdminStatus('err', 'تم إلغاء رفض الطلب لأنه لا يوجد سبب.');
        return;
      }
      await reviewApplication(userId, 'reject', reason);
      setAdminStatus('ok', 'تم رفض الطلب وتسجيل السبب. استخدم زر واتساب في البطاقة لإشعار المتقدم.');
    }

    await refreshDashboard();
  } catch (error) {
    setAdminStatus('err', error.message || 'فشل تحديث حالة الطلب.');
  } finally {
    button.disabled = false;
  }
}

async function guardAdminAccess() {
  const session = await checkSession();
  if (!session) {
    window.location.href = '/login';
    return false;
  }

  const user = await getCurrentUser();
  if (!user) {
    window.location.href = '/login';
    return false;
  }

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== 'admin' || profile.account_status === 'banned') {
    window.location.href = '/account';
    return false;
  }

  return true;
}

function bindEvents() {
  usersListEl.addEventListener('click', handleUsersClick);
  applicationsListEl.addEventListener('click', handleApplicationsClick);
  messagesListEl.addEventListener('click', handleMessagesClick);

  usersSearchInput.addEventListener('input', () => {
    refreshDashboard().catch((error) => setAdminStatus('err', error.message || 'تعذر تحديث المستخدمين.'));
  });

  usersRoleFilter.addEventListener('change', () => {
    refreshDashboard().catch((error) => setAdminStatus('err', error.message || 'تعذر تحديث المستخدمين.'));
  });

  usersStatusFilter.addEventListener('change', () => {
    refreshDashboard().catch((error) => setAdminStatus('err', error.message || 'تعذر تحديث المستخدمين.'));
  });

  applicationsStatusFilter.addEventListener('change', () => {
    refreshDashboard().catch((error) => setAdminStatus('err', error.message || 'تعذر تحديث الطلبات.'));
  });

  applicationsRoleFilter.addEventListener('change', () => {
    refreshDashboard().catch((error) => setAdminStatus('err', error.message || 'تعذر تحديث الطلبات.'));
  });

  messagesStatusFilter.addEventListener('change', () => {
    refreshDashboard().catch((error) => setAdminStatus('err', error.message || 'تعذر تحديث الرسائل.'));
  });

  refreshDashboardBtn.addEventListener('click', () => {
    refreshDashboard().catch((error) => setAdminStatus('err', error.message || 'تعذر تحديث اللوحة.'));
  });

  if (seedStoresBtn) {
    seedStoresBtn.addEventListener('click', async () => {
      seedStoresBtn.disabled = true;
      setAdminStatus('', 'جاري تهيئة بيانات المتاجر...');

      try {
        const result = await runSeedHelper();
        await refreshDashboard();

        const createdStores = result?.createdStores ?? 0;
        const existingStores = result?.existingStores ?? 0;
        const createdProducts = result?.createdProducts ?? 0;

        setAdminStatus(
          'ok',
          `تمت التهيئة بنجاح: متاجر جديدة ${createdStores}، متاجر موجودة ${existingStores}، منتجات جديدة ${createdProducts}.`
        );
      } catch (error) {
        setAdminStatus('err', error.message || 'تعذر تهيئة بيانات المتاجر.');
      } finally {
        seedStoresBtn.disabled = false;
      }
    });
  }
}

window.addEventListener('load', async () => {
  try {
    const allowed = await guardAdminAccess();
    if (!allowed) {
      return;
    }

    bindEvents();
    await refreshDashboard();
  } catch (error) {
    setAdminStatus('err', 'تعذر فتح لوحة الإدارة. تأكد من تسجيل الدخول بصلاحية admin.');
  }
});
