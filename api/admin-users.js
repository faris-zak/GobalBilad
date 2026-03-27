import { adminClient, getPagination, json, normalizeString, requireAdmin } from './_supabase-admin.js';

const ALLOWED_ROLES = new Set(['user', 'trader', 'delivery', 'admin']);
const ALLOWED_STATUSES = new Set(['active', 'banned']);

async function listUsers(req, res) {
  const { page, pageSize } = getPagination(req, 25, 100);
  const search = normalizeString(req.query.search).toLowerCase();
  const roleFilter = normalizeString(req.query.role).toLowerCase();
  const statusFilter = normalizeString(req.query.status).toLowerCase();

  const { data, error } = await adminClient.auth.admin.listUsers({
    page,
    perPage: pageSize
  });

  if (error) {
    return json(res, 500, { error: 'LIST_USERS_FAILED', message: error.message });
  }

  const users = data?.users || [];
  const userIds = users.map((user) => user.id);

  let profileMap = new Map();
  if (userIds.length) {
    const { data: profiles, error: profileError } = await adminClient
      .from('user_profiles')
      .select('user_id, full_name, phone, role, account_status, created_at, updated_at')
      .in('user_id', userIds);

    if (profileError) {
      return json(res, 500, { error: 'LIST_PROFILES_FAILED', message: profileError.message });
    }

    profileMap = new Map((profiles || []).map((profile) => [profile.user_id, profile]));
  }

  let merged = users.map((user) => {
    const profile = profileMap.get(user.id);
    const role = profile?.role || 'user';
    const accountStatus = profile?.account_status || 'active';

    return {
      user_id: user.id,
      email: user.email || null,
      full_name: profile?.full_name || user.user_metadata?.full_name || null,
      phone: profile?.phone || user.phone || null,
      role,
      account_status: accountStatus,
      created_at: profile?.created_at || user.created_at || null,
      updated_at: profile?.updated_at || user.updated_at || null
    };
  });

  if (roleFilter && ALLOWED_ROLES.has(roleFilter)) {
    merged = merged.filter((user) => user.role === roleFilter);
  }

  if (statusFilter && ALLOWED_STATUSES.has(statusFilter)) {
    merged = merged.filter((user) => user.account_status === statusFilter);
  }

  if (search) {
    merged = merged.filter((user) => {
      return [user.full_name, user.email, user.phone]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(search));
    });
  }

  return json(res, 200, {
    page,
    pageSize,
    users: merged
  });
}

async function patchUser(req, res, actingUserId) {
  const userId = normalizeString(req.body?.userId);
  const nextRole = normalizeString(req.body?.role).toLowerCase();
  const nextStatus = normalizeString(req.body?.account_status).toLowerCase();

  if (!userId) {
    return json(res, 400, { error: 'INVALID_PAYLOAD', message: 'userId is required' });
  }

  if (!nextRole && !nextStatus) {
    return json(res, 400, { error: 'INVALID_PAYLOAD', message: 'role or account_status is required' });
  }

  if (nextRole && !ALLOWED_ROLES.has(nextRole)) {
    return json(res, 400, { error: 'INVALID_ROLE', message: 'role must be user, trader, delivery, or admin' });
  }

  if (nextStatus && !ALLOWED_STATUSES.has(nextStatus)) {
    return json(res, 400, { error: 'INVALID_STATUS', message: 'account_status must be active or banned' });
  }

  if (userId === actingUserId) {
    if (nextRole && nextRole !== 'admin') {
      return json(res, 400, { error: 'SELF_ROLE_CHANGE_BLOCKED', message: 'You cannot demote your own admin role' });
    }

    if (nextStatus && nextStatus === 'banned') {
      return json(res, 400, { error: 'SELF_BAN_BLOCKED', message: 'You cannot ban your own account' });
    }
  }

  const updatePayload = {
    updated_at: new Date().toISOString()
  };

  if (nextRole) {
    updatePayload.role = nextRole;
  }

  if (nextStatus) {
    updatePayload.account_status = nextStatus;
    updatePayload.banned_at = nextStatus === 'banned' ? new Date().toISOString() : null;
  }

  const { data, error } = await adminClient
    .from('user_profiles')
    .upsert(
      {
        user_id: userId,
        ...updatePayload
      },
      { onConflict: 'user_id' }
    )
    .select('user_id, role, account_status, banned_at, updated_at')
    .single();

  if (error) {
    return json(res, 500, { error: 'USER_UPDATE_FAILED', message: error.message });
  }

  return json(res, 200, { user: data });
}

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) {
    return;
  }

  if (req.method === 'GET') {
    return listUsers(req, res);
  }

  if (req.method === 'PATCH') {
    return patchUser(req, res, admin.user.id);
  }

  res.setHeader('Allow', 'GET, PATCH');
  return json(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Use GET or PATCH' });
}
