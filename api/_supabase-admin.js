import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for server API');
}

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

let authClient = null;

function getAuthClient() {
  if (authClient) {
    return authClient;
  }

  if (!SUPABASE_ANON_KEY) {
    throw new Error('Missing SUPABASE_ANON_KEY for authenticated endpoints');
  }

  authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return authClient;
}

function json(res, status, payload) {
  return res.status(status).json(payload);
}

function readBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  const [scheme, token] = authHeader.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token.trim();
}

export async function requireAuth(req, res) {
  const token = readBearerToken(req);
  if (!token) {
    json(res, 401, { error: 'UNAUTHORIZED', message: 'Missing bearer token' });
    return null;
  }

  let client;
  try {
    client = getAuthClient();
  } catch (err) {
    json(res, 500, { error: 'SERVER_MISCONFIGURED', message: err.message });
    return null;
  }

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    json(res, 401, { error: 'UNAUTHORIZED', message: 'Invalid or expired token' });
    return null;
  }

  return { user: data.user, token };
}

/**
 * Like requireAuth but does NOT send a 401 — returns null if unauthenticated.
 * Use for endpoints that work for both auth and anon but record the user when present.
 */
export async function optionalAuth(req) {
  const token = readBearerToken(req);
  if (!token) return null;
  let client;
  try {
    client = getAuthClient();
  } catch (_) {
    return null;
  }
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export async function requireAdmin(req, res) {
  const authResult = await requireAuth(req, res);
  if (!authResult) {
    return null;
  }

  const userId = authResult.user.id;
  const { data: profile, error } = await adminClient
    .from('user_profiles')
    .select('user_id, role, account_status')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    json(res, 500, { error: 'PROFILE_LOOKUP_FAILED', message: 'Failed to validate role' });
    return null;
  }

  const role = profile?.role || 'user';
  const status = profile?.account_status || 'active';

  if (status === 'banned') {
    json(res, 403, { error: 'ACCOUNT_BANNED', message: 'Your account is banned' });
    return null;
  }

  if (role !== 'admin') {
    json(res, 403, { error: 'FORBIDDEN', message: 'Admin access required' });
    return null;
  }

  return {
    user: authResult.user,
    profile: {
      user_id: userId,
      role,
      account_status: status
    }
  };
}

export async function requireTrader(req, res) {
  const authResult = await requireAuth(req, res);
  if (!authResult) return null;

  const { data: profile, error } = await adminClient
    .from('user_profiles')
    .select('role, account_status')
    .eq('user_id', authResult.user.id)
    .maybeSingle();

  if (error) {
    json(res, 500, { error: 'PROFILE_LOOKUP_FAILED', message: 'Failed to validate role' });
    return null;
  }

  if (profile?.account_status === 'banned') {
    json(res, 403, { error: 'ACCOUNT_BANNED', message: 'Your account is banned' });
    return null;
  }

  if (profile?.role !== 'trader' && profile?.role !== 'admin') {
    json(res, 403, { error: 'FORBIDDEN', message: 'Trader access required' });
    return null;
  }

  return { user: authResult.user, token: authResult.token };
}

export async function requireDelivery(req, res) {
  const authResult = await requireAuth(req, res);
  if (!authResult) return null;

  const { data: profile, error } = await adminClient
    .from('user_profiles')
    .select('role, account_status')
    .eq('user_id', authResult.user.id)
    .maybeSingle();

  if (error) {
    json(res, 500, { error: 'PROFILE_LOOKUP_FAILED', message: 'Failed to validate role' });
    return null;
  }

  if (profile?.account_status === 'banned') {
    json(res, 403, { error: 'ACCOUNT_BANNED', message: 'Your account is banned' });
    return null;
  }

  if (profile?.role !== 'delivery' && profile?.role !== 'admin') {
    json(res, 403, { error: 'FORBIDDEN', message: 'Delivery access required' });
    return null;
  }

  return { user: authResult.user, token: authResult.token };
}

export function getPagination(req, fallbackPageSize = 20, maxPageSize = 100) {
  const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const requestedPageSize = Number.parseInt(String(req.query.pageSize || fallbackPageSize), 10) || fallbackPageSize;
  const pageSize = Math.min(maxPageSize, Math.max(1, requestedPageSize));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return { page, pageSize, from, to };
}

export function normalizeString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export { adminClient, json };
