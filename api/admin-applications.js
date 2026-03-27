import { adminClient, getPagination, json, normalizeString, requireAdmin } from './_supabase-admin.js';

const ALLOWED_STATUSES = new Set(['pending', 'approved', 'rejected']);

async function listApplications(req, res) {
  const { from, to, page, pageSize } = getPagination(req, 20, 100);
  const status = normalizeString(req.query.status).toLowerCase();
  const requestedRole = normalizeString(req.query.requestedRole).toLowerCase();

  let query = adminClient
    .from('user_profiles')
    .select(
      'user_id, full_name, phone, city, role, account_status, requested_role, application_status, application_payload, application_submitted_at, application_reviewed_at, application_reviewed_by, application_rejection_reason',
      { count: 'exact' }
    )
    .not('requested_role', 'is', null)
    .range(from, to)
    .order('application_submitted_at', { ascending: false, nullsFirst: false });

  if (ALLOWED_STATUSES.has(status)) {
    query = query.eq('application_status', status);
  }

  if (requestedRole === 'trader' || requestedRole === 'delivery') {
    query = query.eq('requested_role', requestedRole);
  }

  const { data, error, count } = await query;
  if (error) {
    return json(res, 500, { error: 'LIST_APPLICATIONS_FAILED', message: error.message });
  }

  return json(res, 200, {
    page,
    pageSize,
    total: count || 0,
    applications: data || []
  });
}

async function patchApplication(req, res, actingUserId) {
  const userId = normalizeString(req.body?.userId);
  const decision = normalizeString(req.body?.decision).toLowerCase();
  const reason = normalizeString(req.body?.reason);

  if (!userId || (decision !== 'approve' && decision !== 'reject')) {
    return json(res, 400, {
      error: 'INVALID_PAYLOAD',
      message: 'userId and decision (approve|reject) are required'
    });
  }

  const { data: profile, error: readError } = await adminClient
    .from('user_profiles')
    .select('user_id, role, requested_role, application_status')
    .eq('user_id', userId)
    .maybeSingle();

  if (readError) {
    return json(res, 500, { error: 'APPLICATION_LOOKUP_FAILED', message: readError.message });
  }

  if (!profile || !profile.requested_role) {
    return json(res, 404, { error: 'APPLICATION_NOT_FOUND', message: 'No application found for this user' });
  }

  if (profile.application_status !== 'pending') {
    return json(res, 409, { error: 'APPLICATION_NOT_PENDING', message: 'Only pending applications can be reviewed' });
  }

  const now = new Date().toISOString();
  const updatePayload = {
    user_id: userId,
    application_status: decision === 'approve' ? 'approved' : 'rejected',
    application_reviewed_at: now,
    application_reviewed_by: actingUserId,
    application_rejection_reason: decision === 'reject' ? reason : null,
    updated_at: now
  };

  if (decision === 'approve') {
    updatePayload.role = profile.requested_role;
  }

  if (decision === 'reject') {
    if (reason.length < 3 || reason.length > 300) {
      return json(res, 400, {
        error: 'INVALID_REJECTION_REASON',
        message: 'reason is required for rejection (3-300 chars)'
      });
    }
  }

  const { data, error } = await adminClient
    .from('user_profiles')
    .upsert(updatePayload, { onConflict: 'user_id' })
    .select(
      'user_id, role, requested_role, application_status, application_reviewed_at, application_reviewed_by, application_rejection_reason, updated_at'
    )
    .single();

  if (error) {
    return json(res, 500, { error: 'APPLICATION_REVIEW_FAILED', message: error.message });
  }

  return json(res, 200, {
    message: decision === 'approve' ? 'Application approved.' : 'Application rejected.',
    application: data
  });
}

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) {
    return;
  }

  if (req.method === 'GET') {
    return listApplications(req, res);
  }

  if (req.method === 'PATCH') {
    return patchApplication(req, res, admin.user.id);
  }

  res.setHeader('Allow', 'GET, PATCH');
  return json(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Use GET or PATCH' });
}