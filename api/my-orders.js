import { adminClient, json, requireAuth } from './_supabase-admin.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Use GET /api/my-orders' });
  }

  const authResult = await requireAuth(req, res);
  if (!authResult) {
    return;
  }

  const userId = authResult.user.id;

  // Look up the user's phone from their profile.
  const { data: profile, error: profileError } = await adminClient
    .from('user_profiles')
    .select('phone')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileError) {
    return json(res, 500, { error: 'PROFILE_LOOKUP_FAILED', message: profileError.message });
  }

  const phone = (profile?.phone || '').trim();
  if (!phone) {
    // No phone on file — return empty list rather than an error.
    return json(res, 200, { orders: [] });
  }

  // Fetch orders placed with this phone number, newest first.
  // Join store name via stores table.
  const { data: orders, error: ordersError } = await adminClient
    .from('orders')
    .select('id, store_id, customer_name, customer_phone, delivery_type, location_link, items, total_price, status, created_at, stores(name)')
    .eq('customer_phone', phone)
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
