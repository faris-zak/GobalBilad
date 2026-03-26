const adminStatusEl = document.getElementById('adminStatus');
const usersListEl = document.getElementById('usersList');
const messagesListEl = document.getElementById('messagesList');
const kpiUsersEl = document.getElementById('kpiUsers');
const kpiBannedEl = document.getElementById('kpiBanned');
const kpiNewMessagesEl = document.getElementById('kpiNewMessages');

const usersSearchInput = document.getElementById('usersSearchInput');
const usersRoleFilter = document.getElementById('usersRoleFilter');
const usersStatusFilter = document.getElementById('usersStatusFilter');
const messagesStatusFilter = document.getElementById('messagesStatusFilter');
const refreshDashboardBtn = document.getElementById('refreshDashboardBtn');

let dashboardState = {
  users: [],
  messages: []
};

function setAdminStatus(type, text) {
  if (!adminStatusEl) {
    return;
  }

  adminStatusEl.className = `admin-status ${type || ''}`.trim();
  adminStatusEl.textContent = text || '';
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
  return role === 'admin' ? 'admin-badge admin-badge-admin' : 'admin-badge';
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
  const messages = dashboardState.messages || [];

  const bannedCount = users.filter((user) => user.account_status === 'banned').length;
  const newMessagesCount = messages.filter((message) => message.status === 'new').length;

  kpiUsersEl.textContent = String(users.length);
  kpiBannedEl.textContent = String(bannedCount);
  kpiNewMessagesEl.textContent = String(newMessagesCount);
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

async function refreshDashboard() {
  setAdminStatus('', 'جاري تحديث البيانات...');

  await Promise.all([loadUsers(), loadMessages()]);
  renderUsers();
  renderMessages();
  updateKpis();

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

  messagesStatusFilter.addEventListener('change', () => {
    refreshDashboard().catch((error) => setAdminStatus('err', error.message || 'تعذر تحديث الرسائل.'));
  });

  refreshDashboardBtn.addEventListener('click', () => {
    refreshDashboard().catch((error) => setAdminStatus('err', error.message || 'تعذر تحديث اللوحة.'));
  });
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
