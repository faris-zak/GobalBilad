import { adminClient, json, normalizeString } from './_supabase-admin.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Use GET /api/store-products?storeId=' });
  }

  const storeId = normalizeString(req.query?.storeId);
  if (!storeId) {
    return json(res, 400, { error: 'INVALID_STORE_ID', message: 'storeId is required' });
  }

  const { data: store, error: storeError } = await adminClient
    .from('stores')
    .select('id, name, whatsapp_phone')
    .eq('id', storeId)
    .eq('is_active', true)
    .maybeSingle();

  if (storeError) {
    return json(res, 500, { error: 'FETCH_STORE_FAILED', message: storeError.message });
  }

  if (!store) {
    return json(res, 404, { error: 'STORE_NOT_FOUND', message: 'Store does not exist or is inactive' });
  }

  const { data: products, error: productsError } = await adminClient
    .from('products')
    .select('id, name, price')
    .eq('store_id', storeId)
    .eq('is_available', true)
    .order('created_at', { ascending: false });

  if (productsError) {
    return json(res, 500, { error: 'FETCH_PRODUCTS_FAILED', message: productsError.message });
  }

  return json(res, 200, {
    store,
    items: Array.isArray(products) ? products : []
  });
}
