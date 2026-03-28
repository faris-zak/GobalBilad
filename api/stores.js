import { adminClient, json } from './_supabase-admin.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Use GET /api/stores' });
  }

  const { data, error } = await adminClient
    .from('stores')
    .select('id, name, whatsapp_phone')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    return json(res, 500, { error: 'FETCH_STORES_FAILED', message: error.message });
  }

  return json(res, 200, {
    items: Array.isArray(data) ? data : []
  });
}
