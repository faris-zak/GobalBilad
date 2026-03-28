import { adminClient, json, normalizeString, requireTrader } from './_supabase-admin.js';

async function getStore(res, userId) {
  const { data, error } = await adminClient
    .from('stores')
    .select('id, name, whatsapp_phone, is_active, created_at, updated_at')
    .eq('owner_user_id', userId)
    .maybeSingle();

  if (error) {
    return json(res, 500, { error: 'STORE_FETCH_FAILED', message: error.message });
  }
  return json(res, 200, { store: data ?? null });
}

async function createStore(req, res, userId) {
  const name = normalizeString(req.body?.name);
  const whatsapp_phone = normalizeString(req.body?.whatsapp_phone);

  if (!name || !whatsapp_phone) {
    return json(res, 400, { error: 'INVALID_PAYLOAD', message: 'name and whatsapp_phone are required' });
  }

  // Each trader may own only one store
  const { data: existing } = await adminClient
    .from('stores')
    .select('id')
    .eq('owner_user_id', userId)
    .maybeSingle();

  if (existing) {
    return json(res, 409, { error: 'STORE_EXISTS', message: 'You already have a store. Use PATCH to update it.' });
  }

  const { data, error } = await adminClient
    .from('stores')
    .insert({ name, whatsapp_phone, owner_user_id: userId, is_active: true })
    .select('id, name, whatsapp_phone, is_active, created_at, updated_at')
    .single();

  if (error) {
    return json(res, 500, { error: 'STORE_CREATE_FAILED', message: error.message });
  }
  return json(res, 201, { store: data });
}

async function updateStore(req, res, userId) {
  const { data: existing } = await adminClient
    .from('stores')
    .select('id')
    .eq('owner_user_id', userId)
    .maybeSingle();

  if (!existing) {
    return json(res, 404, { error: 'STORE_NOT_FOUND', message: 'No store found for this trader' });
  }

  const updates = {};
  const name = normalizeString(req.body?.name);
  const whatsapp_phone = normalizeString(req.body?.whatsapp_phone);

  if (name) updates.name = name;
  if (whatsapp_phone) updates.whatsapp_phone = whatsapp_phone;
  if (typeof req.body?.is_active === 'boolean') updates.is_active = req.body.is_active;

  if (Object.keys(updates).length === 0) {
    return json(res, 400, { error: 'NO_FIELDS', message: 'No updatable fields provided' });
  }

  const { data, error } = await adminClient
    .from('stores')
    .update(updates)
    .eq('id', existing.id)
    .select('id, name, whatsapp_phone, is_active, created_at, updated_at')
    .single();

  if (error) {
    return json(res, 500, { error: 'STORE_UPDATE_FAILED', message: error.message });
  }
  return json(res, 200, { store: data });
}

export default async function handler(req, res) {
  const trader = await requireTrader(req, res);
  if (!trader) return;

  const userId = trader.user.id;

  if (req.method === 'GET') return getStore(res, userId);
  if (req.method === 'POST') return createStore(req, res, userId);
  if (req.method === 'PATCH') return updateStore(req, res, userId);

  return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
}
