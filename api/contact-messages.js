import { adminClient, json, normalizeString } from './_supabase-admin.js';

function validatePayload(body) {
  const sender_name = normalizeString(body?.name);
  const sender_email = normalizeString(body?.email);
  const sender_phone = normalizeString(body?.phone);
  const request_type = normalizeString(body?.requestType);
  const message = normalizeString(body?.message);

  if (!sender_name || sender_name.length < 2) {
    return { error: 'INVALID_NAME', message: 'name must be at least 2 characters' };
  }

  if (!sender_phone || sender_phone.length < 6) {
    return { error: 'INVALID_PHONE', message: 'phone is required' };
  }

  if (!request_type) {
    return { error: 'INVALID_REQUEST_TYPE', message: 'requestType is required' };
  }

  if (!message || message.length < 5) {
    return { error: 'INVALID_MESSAGE', message: 'message must be at least 5 characters' };
  }

  if (sender_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender_email)) {
    return { error: 'INVALID_EMAIL', message: 'email format is invalid' };
  }

  return {
    sender_name: sender_name.slice(0, 120),
    sender_email: sender_email ? sender_email.slice(0, 190) : null,
    sender_phone: sender_phone.slice(0, 50),
    request_type: request_type.slice(0, 80),
    message: message.slice(0, 4000)
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Use POST /api/contact-messages' });
  }

  const payload = validatePayload(req.body);
  if (payload.error) {
    return json(res, 400, payload);
  }

  const { data, error } = await adminClient
    .from('contact_messages')
    .insert({
      ...payload,
      status: 'new'
    })
    .select('id, status, created_at')
    .single();

  if (error) {
    return json(res, 500, { error: 'CREATE_MESSAGE_FAILED', message: error.message });
  }

  return json(res, 201, {
    message: 'Message submitted successfully',
    item: data
  });
}
