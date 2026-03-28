import { adminClient, getPagination, json, normalizeString, requireTrader } from './_supabase-admin.js';

const ALLOWED_ORDER_STATUSES = new Set(['pending', 'confirmed', 'cancelled']);

// ─── Shared helpers ──────────────────────────────────────────────────────────

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
    json(res, 404, { error: 'NO_STORE', message: 'Create a store first before managing products or orders' });
    return null;
  }
  return data.id;
}

async function verifyProductOwnership(res, productId, storeId) {
  const { data, error } = await adminClient
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('store_id', storeId)
    .maybeSingle();

  if (error) {
    json(res, 500, { error: 'PRODUCT_LOOKUP_FAILED', message: error.message });
    return false;
  }
  if (!data) {
    json(res, 404, { error: 'PRODUCT_NOT_FOUND', message: 'Product not found or does not belong to your store' });
    return false;
  }
  return true;
}

// ─── Store handlers ──────────────────────────────────────────────────────────

async function getStore(res, userId) {
  const { data, error } = await adminClient
    .from('stores')
    .select('id, name, whatsapp_phone, is_active, created_at, updated_at')
    .eq('owner_user_id', userId)
    .maybeSingle();

  if (error) return json(res, 500, { error: 'STORE_FETCH_FAILED', message: error.message });
  return json(res, 200, { store: data ?? null });
}

async function createStore(req, res, userId) {
  const name = normalizeString(req.body?.name);
  const whatsapp_phone = normalizeString(req.body?.whatsapp_phone);

  if (!name || !whatsapp_phone) {
    return json(res, 400, { error: 'INVALID_PAYLOAD', message: 'name and whatsapp_phone are required' });
  }

  const { data: existing } = await adminClient
    .from('stores').select('id').eq('owner_user_id', userId).maybeSingle();

  if (existing) {
    return json(res, 409, { error: 'STORE_EXISTS', message: 'You already have a store. Use PATCH to update it.' });
  }

  const { data, error } = await adminClient
    .from('stores')
    .insert({ name, whatsapp_phone, owner_user_id: userId, is_active: true })
    .select('id, name, whatsapp_phone, is_active, created_at, updated_at')
    .single();

  if (error) return json(res, 500, { error: 'STORE_CREATE_FAILED', message: error.message });
  return json(res, 201, { store: data });
}

async function updateStore(req, res, userId) {
  const { data: existing } = await adminClient
    .from('stores').select('id').eq('owner_user_id', userId).maybeSingle();

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

  if (error) return json(res, 500, { error: 'STORE_UPDATE_FAILED', message: error.message });
  return json(res, 200, { store: data });
}

// ─── Product handlers ─────────────────────────────────────────────────────────

async function listProducts(res, storeId) {
  const { data, error } = await adminClient
    .from('products')
    .select('id, name, price, is_available, created_at, updated_at')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  if (error) return json(res, 500, { error: 'PRODUCTS_FETCH_FAILED', message: error.message });
  return json(res, 200, { items: data || [] });
}

async function createProduct(req, res, storeId) {
  const name = normalizeString(req.body?.name);
  const price = Number(req.body?.price);
  const is_available = req.body?.is_available !== false;

  if (!name || Number.isNaN(price) || price < 0) {
    return json(res, 400, { error: 'INVALID_PAYLOAD', message: 'name and a non-negative price are required' });
  }

  const { data, error } = await adminClient
    .from('products')
    .insert({ store_id: storeId, name, price, is_available })
    .select('id, name, price, is_available, created_at, updated_at')
    .single();

  if (error) return json(res, 500, { error: 'PRODUCT_CREATE_FAILED', message: error.message });
  return json(res, 201, { product: data });
}

async function updateProduct(req, res, storeId) {
  const productId = normalizeString(req.query?.id || req.body?.id);
  if (!productId) return json(res, 400, { error: 'MISSING_ID', message: 'Product id is required' });

  const owned = await verifyProductOwnership(res, productId, storeId);
  if (!owned) return;

  const updates = {};
  const name = normalizeString(req.body?.name);
  const price = req.body?.price !== undefined ? Number(req.body.price) : undefined;
  if (name) updates.name = name;
  if (price !== undefined) {
    if (Number.isNaN(price) || price < 0) {
      return json(res, 400, { error: 'INVALID_PRICE', message: 'Price must be a non-negative number' });
    }
    updates.price = price;
  }
  if (typeof req.body?.is_available === 'boolean') updates.is_available = req.body.is_available;

  if (Object.keys(updates).length === 0) {
    return json(res, 400, { error: 'NO_FIELDS', message: 'No updatable fields provided' });
  }

  const { data, error } = await adminClient
    .from('products')
    .update(updates)
    .eq('id', productId)
    .select('id, name, price, is_available, created_at, updated_at')
    .single();

  if (error) return json(res, 500, { error: 'PRODUCT_UPDATE_FAILED', message: error.message });
  return json(res, 200, { product: data });
}

async function deleteProduct(req, res, storeId) {
  const productId = normalizeString(req.query?.id);
  if (!productId) return json(res, 400, { error: 'MISSING_ID', message: 'Product id query param is required' });

  const owned = await verifyProductOwnership(res, productId, storeId);
  if (!owned) return;

  const { error } = await adminClient.from('products').delete().eq('id', productId);
  if (error) return json(res, 500, { error: 'PRODUCT_DELETE_FAILED', message: error.message });
  return json(res, 200, { success: true });
}

// ─── Order handlers ───────────────────────────────────────────────────────────

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

  if (ALLOWED_ORDER_STATUSES.has(statusFilter)) {
    query = query.eq('status', statusFilter);
  }

  const { data, error, count } = await query;
  if (error) return json(res, 500, { error: 'ORDERS_FETCH_FAILED', message: error.message });
  return json(res, 200, { page, pageSize, total: count || 0, orders: data || [] });
}

async function updateOrderStatus(req, res, storeId) {
  const orderId = normalizeString(req.body?.id || req.query?.id);
  const newStatus = normalizeString(req.body?.status).toLowerCase();

  if (!orderId) return json(res, 400, { error: 'MISSING_ID', message: 'Order id is required' });
  if (newStatus !== 'confirmed' && newStatus !== 'cancelled') {
    return json(res, 400, { error: 'INVALID_STATUS', message: 'Status must be confirmed or cancelled' });
  }

  const { data: order, error: lookupErr } = await adminClient
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .eq('store_id', storeId)
    .maybeSingle();

  if (lookupErr) return json(res, 500, { error: 'ORDER_LOOKUP_FAILED', message: lookupErr.message });
  if (!order) return json(res, 404, { error: 'ORDER_NOT_FOUND', message: 'Order not found or does not belong to your store' });
  if (order.status !== 'pending') return json(res, 409, { error: 'ORDER_NOT_PENDING', message: 'Only pending orders can be updated' });

  const { data, error } = await adminClient
    .from('orders')
    .update({ status: newStatus })
    .eq('id', orderId)
    .select('id, status, updated_at')
    .single();

  if (error) return json(res, 500, { error: 'ORDER_UPDATE_FAILED', message: error.message });
  return json(res, 200, { order: data });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const trader = await requireTrader(req, res);
  if (!trader) return;

  const resource = normalizeString(req.query?.resource).toLowerCase();
  const userId = trader.user.id;

  if (resource === 'store') {
    if (req.method === 'GET')   return getStore(res, userId);
    if (req.method === 'POST')  return createStore(req, res, userId);
    if (req.method === 'PATCH') return updateStore(req, res, userId);
    return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }

  const storeId = await getOwnedStoreId(res, userId);
  if (!storeId) return;

  if (resource === 'products') {
    if (req.method === 'GET')    return listProducts(res, storeId);
    if (req.method === 'POST')   return createProduct(req, res, storeId);
    if (req.method === 'PATCH')  return updateProduct(req, res, storeId);
    if (req.method === 'DELETE') return deleteProduct(req, res, storeId);
    return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }

  if (resource === 'orders') {
    if (req.method === 'GET')   return listOrders(req, res, storeId);
    if (req.method === 'PATCH') return updateOrderStatus(req, res, storeId);
    return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }

  return json(res, 400, { error: 'MISSING_RESOURCE', message: 'resource query param must be store, products, or orders' });
}
