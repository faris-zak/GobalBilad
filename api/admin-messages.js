import { adminClient, getPagination, json, normalizeString, requireAdmin } from './_supabase-admin.js';

const ALLOWED_STATUSES = new Set(['new', 'read', 'resolved']);

async function listMessages(req, res) {
  const { page, pageSize, from, to } = getPagination(req, 20, 100);
  const status = normalizeString(req.query.status).toLowerCase();

  let query = adminClient
    .from('contact_messages')
    .select('id, sender_name, sender_email, sender_phone, request_type, message, status, read_at, resolved_at, handled_by, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status && ALLOWED_STATUSES.has(status)) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;
  if (error) {
    return json(res, 500, { error: 'LIST_MESSAGES_FAILED', message: error.message });
  }

  return json(res, 200, {
    page,
    pageSize,
    total: count || 0,
    messages: data || []
  });
}

async function updateMessage(req, res, actingUserId) {
  const id = normalizeString(req.body?.id);
  const status = normalizeString(req.body?.status).toLowerCase();

  if (!id || !status) {
    return json(res, 400, { error: 'INVALID_PAYLOAD', message: 'id and status are required' });
  }

  if (!ALLOWED_STATUSES.has(status)) {
    return json(res, 400, { error: 'INVALID_STATUS', message: 'status must be new, read, or resolved' });
  }

  const now = new Date().toISOString();
  const updatePayload = {
    status,
    handled_by: actingUserId,
    updated_at: now
  };

  if (status === 'new') {
    updatePayload.read_at = null;
    updatePayload.resolved_at = null;
  }

  if (status === 'read') {
    updatePayload.read_at = now;
    updatePayload.resolved_at = null;
  }

  if (status === 'resolved') {
    updatePayload.read_at = now;
    updatePayload.resolved_at = now;
  }

  const { data, error } = await adminClient
    .from('contact_messages')
    .update(updatePayload)
    .eq('id', id)
    .select('id, status, read_at, resolved_at, handled_by, updated_at')
    .single();

  if (error) {
    return json(res, 500, { error: 'UPDATE_MESSAGE_FAILED', message: error.message });
  }

  return json(res, 200, { message: data });
}

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) {
    return;
  }

  if (req.method === 'GET') {
    return listMessages(req, res);
  }

  if (req.method === 'PATCH') {
    return updateMessage(req, res, admin.user.id);
  }

  res.setHeader('Allow', 'GET, PATCH');
  return json(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Use GET or PATCH' });
}
