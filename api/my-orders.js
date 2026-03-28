import { adminClient, json, requireAuth } from './_supabase-admin.js';

export default async function handler(req, res) {
  if (req.method === 'DELETE') {
    return handleDelete(req, res);
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, DELETE');
    return json(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Use GET or DELETE /api/my-orders' });
  }

  const authResult = await requireAuth(req, res);
  if (!authResult) {
    return;
  }

  const userId = authResult.user.id;

  // Fetch orders linked to this account, newest first.
  const { data: orders, error: ordersError } = await adminClient
    .from('orders')
    .select('id, store_id, customer_name, customer_phone, delivery_type, location_link, items, total_price, status, created_at, stores(name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (ordersError) {
    return json(res, 500, { error: 'ORDERS_FETCH_FAILED', message: ordersError.message });
  }


  const result = (orders || []).map((o) => ({
    id: o.id,
    store_id: o.store_id,
    store_name: o.stores?.name || '-',
    customer_name: o.customer_name,
    customer_phone: o.customer_phone,
    delivery_type: o.delivery_type,
    location_link: o.location_link || null,
    items: o.items,
    total_price: o.total_price,
    status: o.status,
    created_at: o.created_at
  }));

  return json(res, 200, { orders: result });
}

async function handleDelete(req, res) {
  const authResult = await requireAuth(req, res);
  if (!authResult) return;

  const orderId = req.query?.id || new URL(req.url, 'http://x').searchParams.get('id');
  if (!orderId) {
    return json(res, 400, { error: 'MISSING_ID', message: 'Order id is required' });
  }

  // Verify the order belongs to this user and is still pending.
  const { data: order, error: fetchError } = await adminClient
    .from('orders')
    .select('id, status, user_id')
    .eq('id', orderId)
    .maybeSingle();

  if (fetchError) {
    return json(res, 500, { error: 'LOOKUP_FAILED', message: fetchError.message });
  }
  if (!order) {
    return json(res, 404, { error: 'NOT_FOUND', message: 'Order not found' });
  }
  if (order.user_id !== authResult.user.id) {
    return json(res, 403, { error: 'FORBIDDEN', message: 'This order does not belong to you' });
  }
  if (order.status !== 'pending') {
    return json(res, 409, { error: 'NOT_CANCELLABLE', message: 'Only pending orders can be cancelled' });
  }

  const { error: deleteError } = await adminClient
    .from('orders')
    .delete()
    .eq('id', orderId);

  if (deleteError) {
    return json(res, 500, { error: 'DELETE_FAILED', message: deleteError.message });
  }

  return json(res, 200, { success: true });
}
