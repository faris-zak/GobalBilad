import { adminClient, json, normalizeString, requireTrader } from './_supabase-admin.js';

/** Returns the trader's store id, or sends 404 if none exists. */
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
    json(res, 404, { error: 'NO_STORE', message: 'Create a store first before managing products' });
    return null;
  }
  return data.id;
}

/** Verify a product belongs to this trader's store. */
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

async function listProducts(req, res, storeId) {
  const { data, error } = await adminClient
    .from('products')
    .select('id, name, price, is_available, created_at, updated_at')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  if (error) {
    return json(res, 500, { error: 'PRODUCTS_FETCH_FAILED', message: error.message });
  }
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

  if (error) {
    return json(res, 500, { error: 'PRODUCT_CREATE_FAILED', message: error.message });
  }
  return json(res, 201, { product: data });
}

async function updateProduct(req, res, storeId) {
  const productId = normalizeString(req.query?.id || req.body?.id);
  if (!productId) {
    return json(res, 400, { error: 'MISSING_ID', message: 'Product id is required' });
  }

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

  if (error) {
    return json(res, 500, { error: 'PRODUCT_UPDATE_FAILED', message: error.message });
  }
  return json(res, 200, { product: data });
}

async function deleteProduct(req, res, storeId) {
  const productId = normalizeString(req.query?.id);
  if (!productId) {
    return json(res, 400, { error: 'MISSING_ID', message: 'Product id query param is required' });
  }

  const owned = await verifyProductOwnership(res, productId, storeId);
  if (!owned) return;

  const { error } = await adminClient.from('products').delete().eq('id', productId);
  if (error) {
    return json(res, 500, { error: 'PRODUCT_DELETE_FAILED', message: error.message });
  }
  return json(res, 200, { success: true });
}

export default async function handler(req, res) {
  const trader = await requireTrader(req, res);
  if (!trader) return;

  const storeId = await getOwnedStoreId(res, trader.user.id);
  if (!storeId) return;

  if (req.method === 'GET') return listProducts(req, res, storeId);
  if (req.method === 'POST') return createProduct(req, res, storeId);
  if (req.method === 'PATCH') return updateProduct(req, res, storeId);
  if (req.method === 'DELETE') return deleteProduct(req, res, storeId);

  return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
}
