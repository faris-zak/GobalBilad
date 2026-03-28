import { adminClient, json, normalizeString, optionalAuth } from './_supabase-admin.js';

function parseBody(rawBody) {
  if (!rawBody) {
    return {};
  }

  if (typeof rawBody === 'string') {
    try {
      return JSON.parse(rawBody);
    } catch (_err) {
      return {};
    }
  }

  if (typeof rawBody === 'object') {
    return rawBody;
  }

  return {};
}

function toValidNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num;
}

function normalizeItems(items) {
  if (!Array.isArray(items) || !items.length) {
    return null;
  }

  const normalized = [];

  for (const rawItem of items) {
    const id = normalizeString(rawItem?.id);
    const name = normalizeString(rawItem?.name);
    const priceNum = toValidNumber(rawItem?.price);
    const qtyNum = Number.parseInt(String(rawItem?.qty || ''), 10);

    if (!id || !name || priceNum === null || priceNum < 0 || !Number.isInteger(qtyNum) || qtyNum < 1) {
      return null;
    }

    normalized.push({
      id,
      name: name.slice(0, 180),
      price: Number(priceNum.toFixed(3)),
      qty: qtyNum
    });
  }

  return normalized;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Use POST /api/orders' });
  }

  const body = parseBody(req.body);
  const storeId = normalizeString(body?.storeId);
  const customerName = normalizeString(body?.name);
  const customerPhone = normalizeString(body?.phone);
  const deliveryType = normalizeString(body?.deliveryType);
  const locationLink = normalizeString(body?.locationLink);
  const items = normalizeItems(body?.items);

  if (!storeId) {
    return json(res, 400, { error: 'INVALID_STORE_ID', message: 'storeId is required' });
  }

  if (!customerName || customerName.length < 2) {
    return json(res, 400, { error: 'INVALID_NAME', message: 'name must be at least 2 characters' });
  }

  if (!customerPhone || customerPhone.length < 6) {
    return json(res, 400, { error: 'INVALID_PHONE', message: 'phone is required' });
  }

  if (deliveryType !== 'pickup' && deliveryType !== 'delivery') {
    return json(res, 400, { error: 'INVALID_DELIVERY_TYPE', message: 'deliveryType must be pickup or delivery' });
  }

  if (deliveryType === 'delivery' && !locationLink) {
    return json(res, 400, { error: 'INVALID_LOCATION_LINK', message: 'locationLink is required for delivery' });
  }

  if (!items) {
    return json(res, 400, { error: 'INVALID_ITEMS', message: 'items must be a non-empty array of valid items' });
  }

  const { data: store, error: storeError } = await adminClient
    .from('stores')
    .select('id, name, whatsapp_phone')
    .eq('id', storeId)
    .eq('is_active', true)
    .maybeSingle();

  if (storeError) {
    return json(res, 500, { error: 'STORE_LOOKUP_FAILED', message: storeError.message });
  }

  if (!store) {
    return json(res, 404, { error: 'STORE_NOT_FOUND', message: 'Store does not exist or is inactive' });
  }

  const total = Number(items.reduce((sum, item) => sum + item.price * item.qty, 0).toFixed(3));

  const authUser = await optionalAuth(req);

  const { data: createdOrder, error: insertError } = await adminClient
    .from('orders')
    .insert({
      store_id: store.id,
      user_id: authUser?.id ?? null,
      customer_name: customerName.slice(0, 180),
      customer_phone: customerPhone.slice(0, 80),
      delivery_type: deliveryType,
      location_link: deliveryType === 'delivery' ? locationLink.slice(0, 2000) : null,
      items,
      total_price: total,
      status: 'pending'
    })
    .select('id, total_price, status, created_at')
    .single();

  if (insertError) {
    return json(res, 500, { error: 'CREATE_ORDER_FAILED', message: insertError.message });
  }

  return json(res, 201, {
    message: 'Order created successfully',
    order: createdOrder,
    store: {
      id: store.id,
      name: store.name,
      whatsapp_phone: store.whatsapp_phone
    }
  });
}
