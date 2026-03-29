import { adminClient, json, normalizeString, optionalAuth, requireAuth } from './_supabase-admin.js';

// ─── Status-update: valid statuses ────────────────────────────────────────────
const VALID_STATUSES = new Set([
  'pending', 'confirmed', 'rejected',
  'ready_for_shipping', 'out_for_delivery', 'delivered',
]);

// Role-based transition table: role → { current_status → [allowed next statuses] }
const ROLE_TRANSITIONS = {
  trader: {
    pending:   ['confirmed', 'rejected'],
    confirmed: ['ready_for_shipping'],
  },
  delivery: {
    ready_for_shipping: ['out_for_delivery'],
    out_for_delivery:   ['delivered'],
  },
};

async function updateOrderStatus(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Use POST /api/orders/update-status' });
  }

  // ── Authenticate ──────────────────────────────────────────────────────────
  const authResult = await requireAuth(req, res);
  if (!authResult) return;
  const userId = authResult.user.id;

  // ── Resolve role from server-side profile (never trust client-supplied role) ─
  const { data: profile, error: profileErr } = await adminClient
    .from('user_profiles')
    .select('role, account_status')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileErr) return json(res, 500, { error: 'PROFILE_LOOKUP_FAILED', message: profileErr.message });
  if (profile?.account_status === 'banned') {
    return json(res, 403, { error: 'ACCOUNT_BANNED', message: 'Your account is banned' });
  }

  const role = profile?.role || 'user';
  if (!['trader', 'delivery', 'admin'].includes(role)) {
    return json(res, 403, { error: 'FORBIDDEN', message: 'Only store owners, drivers, or admins can update order status' });
  }

  // ── Parse & validate body ─────────────────────────────────────────────────
  const body = parseBody(req.body);
  const orderId  = normalizeString(body?.order_id);
  const newStatus = normalizeString(body?.new_status).toLowerCase();

  if (!orderId) {
    return json(res, 400, { error: 'MISSING_ORDER_ID', message: 'order_id is required' });
  }
  if (!VALID_STATUSES.has(newStatus)) {
    return json(res, 400, {
      error: 'INVALID_STATUS',
      message: `new_status must be one of: ${[...VALID_STATUSES].join(', ')}`,
    });
  }

  // ── Fetch order ───────────────────────────────────────────────────────────
  const { data: order, error: orderErr } = await adminClient
    .from('orders')
    .select('id, status, driver_id, store_id, delivery_type')
    .eq('id', orderId)
    .maybeSingle();

  if (orderErr) return json(res, 500, { error: 'ORDER_LOOKUP_FAILED', message: orderErr.message });
  if (!order)   return json(res, 404, { error: 'ORDER_NOT_FOUND', message: 'Order not found' });

  const currentStatus = order.status;

  if (currentStatus === newStatus) {
    return json(res, 409, { error: 'NO_CHANGE', message: `Order is already ${newStatus}` });
  }

  // ── Role-specific transition validation ───────────────────────────────────
  if (role === 'trader') {
    // Must own the store
    const { data: store } = await adminClient
      .from('stores')
      .select('id')
      .eq('id', order.store_id)
      .eq('owner_user_id', userId)
      .maybeSingle();

    if (!store) {
      return json(res, 403, { error: 'FORBIDDEN', message: 'This order does not belong to your store' });
    }

    const allowed = ROLE_TRANSITIONS.trader[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      return json(res, 409, {
        error: 'INVALID_TRANSITION',
        message: `Store cannot move order from '${currentStatus}' to '${newStatus}'`,
      });
    }

  } else if (role === 'delivery') {
    const allowed = ROLE_TRANSITIONS.delivery[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      return json(res, 409, {
        error: 'INVALID_TRANSITION',
        message: `Driver cannot move order from '${currentStatus}' to '${newStatus}'`,
      });
    }

    // Driver starting delivery: atomic claim (assign driver_id if null)
    if (newStatus === 'out_for_delivery') {
      if (order.driver_id && order.driver_id !== userId) {
        return json(res, 409, { error: 'ALREADY_ASSIGNED', message: 'This order is already assigned to another driver' });
      }
      const { data: claimed, error: claimErr } = await adminClient
        .from('orders')
        .update({ status: 'out_for_delivery', driver_id: userId })
        .eq('id', orderId)
        .eq('status', 'ready_for_shipping')
        .is('driver_id', null)
        .select('id, status, driver_id, updated_at')
        .maybeSingle();

      if (claimErr) return json(res, 500, { error: 'UPDATE_FAILED', message: claimErr.message });
      if (!claimed) return json(res, 409, { error: 'ALREADY_ASSIGNED', message: 'Order was taken by another driver' });

      return json(res, 200, { success: true, message: 'Delivery started', order: claimed });
    }

    // Driver completing delivery: must be the assigned driver
    if (newStatus === 'delivered') {
      if (order.driver_id !== userId) {
        return json(res, 403, { error: 'FORBIDDEN', message: 'This order is not assigned to you' });
      }
    }

  }
  // admin: no transition restriction

  // ── Apply update ──────────────────────────────────────────────────────────
  const { data: updated, error: updateErr } = await adminClient
    .from('orders')
    .update({ status: newStatus })
    .eq('id', orderId)
    .select('id, status, driver_id, updated_at')
    .single();

  if (updateErr) return json(res, 500, { error: 'UPDATE_FAILED', message: updateErr.message });
  return json(res, 200, { success: true, message: 'Order status updated', order: updated });
}

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
  // Route: POST /api/orders/update-status (via vercel.json rewrite → ?_action=update-status)
  if (normalizeString(req.query?._action).toLowerCase() === 'update-status') {
    return updateOrderStatus(req, res);
  }

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
