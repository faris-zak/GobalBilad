import { adminClient, getPagination, json, normalizeString, requireTrader } from './_supabase-admin.js';

const ALLOWED_STATUSES = new Set(['pending', 'confirmed', 'cancelled']);

async function getOwnedStoreId(res, userId) {
  const { data, error } = await adminClient
    .from('stores')
    .select('id')
    .eq('owner_user_id', userId)
    .maybeSingle();

  if (error) {
    json(res, 500, { error: 'STORE_LOOKUP_FAILED', message: error.message });
    return null;
  }
  if (!data) {
    json(res, 404, { error: 'NO_STORE', message: 'No store found for this account' });
    return null;
  }
  return data.id;
}

async function listOrders(req, res, storeId) {
  const { from, to, page, pageSize } = getPagination(req, 25, 100);
  const statusFilter = normalizeString(req.query?.status).toLowerCase();

  let query = adminClient
    .from('orders')
    .select(
      'id, customer_name, customer_phone, delivery_type, location_link, items, total_price, status, created_at, updated_at',
      { count: 'exact' }
    )
    .eq('store_id', storeId)
    .range(from, to)
    .order('created_at', { ascending: false });

  if (ALLOWED_STATUSES.has(statusFilter)) {
    query = query.eq('status', statusFilter);
  }

  const { data, error, count } = await query;
  if (error) {
    return json(res, 500, { error: 'ORDERS_FETCH_FAILED', message: error.message });
  }

  return json(res, 200, { page, pageSize, total: count || 0, orders: data || [] });
}

async function updateOrderStatus(req, res, storeId) {
  const orderId = normalizeString(req.body?.id || req.query?.id);
  const newStatus = normalizeString(req.body?.status).toLowerCase();

  if (!orderId) {
    return json(res, 400, { error: 'MISSING_ID', message: 'Order id is required' });
  }

  if (newStatus !== 'confirmed' && newStatus !== 'cancelled') {
    return json(res, 400, { error: 'INVALID_STATUS', message: 'Status must be confirmed or cancelled' });
  }

  // Verify order belongs to this trader's store
  const { data: order, error: lookupErr } = await adminClient
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .eq('store_id', storeId)
    .maybeSingle();

  if (lookupErr) {
    return json(res, 500, { error: 'ORDER_LOOKUP_FAILED', message: lookupErr.message });
  }
  if (!order) {
    return json(res, 404, { error: 'ORDER_NOT_FOUND', message: 'Order not found or does not belong to your store' });
  }
  if (order.status !== 'pending') {
    return json(res, 409, { error: 'ORDER_NOT_PENDING', message: 'Only pending orders can be updated' });
  }

  const { data, error } = await adminClient
    .from('orders')
    .update({ status: newStatus })
    .eq('id', orderId)
    .select('id, status, updated_at')
    .single();

  if (error) {
    return json(res, 500, { error: 'ORDER_UPDATE_FAILED', message: error.message });
  }
  return json(res, 200, { order: data });
}

export default async function handler(req, res) {
  const trader = await requireTrader(req, res);
  if (!trader) return;

  const storeId = await getOwnedStoreId(res, trader.user.id);
  if (!storeId) return;

  if (req.method === 'GET') return listOrders(req, res, storeId);
  if (req.method === 'PATCH') return updateOrderStatus(req, res, storeId);

  return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
}
