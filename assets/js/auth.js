const SUPABASE_URL = 'https://xgzrqcgnhwjgdwidhmzv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnenJxY2duaHdqZ2R3aWRobXp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTQxMjMsImV4cCI6MjA5MDAzMDEyM30.U6XIZ4aiXbuiqlnWhC4KZvYzUd5pqK-dp6S1POK5JD4';

let supabaseClient = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error('Supabase library is not loaded');
    }
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

async function checkSession() {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session;
}

async function getAccessToken() {
  const session = await checkSession();
  return session?.access_token || null;
}

async function getCurrentUser() {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getUser();
  if (error) {
    throw error;
  }
  return data.user;
}

async function loginWithGoogle() {
  const client = getSupabaseClient();
  const redirectTarget = `${window.location.origin}/auth-callback`;

  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectTarget }
  });

  if (error) {
    throw error;
  }
}

async function logout() {
  const client = getSupabaseClient();
  const { error } = await client.auth.signOut();
  if (error) {
    throw error;
  }
}

async function getUserProfile(userId) {
  const client = getSupabaseClient();
  const fullSelect = 'user_id, full_name, phone, city, address, latitude, longitude, location_validated, location_source, role, account_status, banned_at, requested_role, application_status, application_payload, application_submitted_at, application_reviewed_at, application_reviewed_by, application_rejection_reason';
  const baseSelect = 'user_id, full_name, phone, city, address, latitude, longitude, location_validated, location_source';

  let { data, error } = await client
    .from('user_profiles')
    .select(fullSelect)
    .eq('user_id', userId)
    .maybeSingle();

  if (error && error.code === '42703') {
    const fallback = await client
      .from('user_profiles')
      .select(baseSelect)
      .eq('user_id', userId)
      .maybeSingle();

    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw error;
  }

  if (data && typeof data.role === 'undefined') {
    data.role = 'user';
  }

  if (data && typeof data.account_status === 'undefined') {
    data.account_status = 'active';
  }

  if (data && typeof data.application_status === 'undefined') {
    data.application_status = 'none';
  }

  return data;
}

async function upsertUserProfile(profile) {
  const client = getSupabaseClient();
  const fullSelect = 'user_id, full_name, phone, city, address, latitude, longitude, location_validated, location_source, role, account_status, banned_at, requested_role, application_status, application_payload, application_submitted_at, application_reviewed_at, application_reviewed_by, application_rejection_reason';
  const baseSelect = 'user_id, full_name, phone, city, address, latitude, longitude, location_validated, location_source';

  let { data, error } = await client
    .from('user_profiles')
    .upsert(
      {
        user_id: profile.user_id,
        full_name: profile.full_name,
        phone: profile.phone,
        city: profile.city,
        address: profile.address,
        latitude: profile.latitude,
        longitude: profile.longitude,
        location_validated: profile.location_validated,
        location_source: profile.location_source,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id' }
    )
    .select(fullSelect)
    .single();

  if (error && error.code === '42703') {
    const fallback = await client
      .from('user_profiles')
      .upsert(
        {
          user_id: profile.user_id,
          full_name: profile.full_name,
          phone: profile.phone,
          city: profile.city,
          address: profile.address,
          latitude: profile.latitude,
          longitude: profile.longitude,
          location_validated: profile.location_validated,
          location_source: profile.location_source,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id' }
      )
      .select(baseSelect)
      .single();

    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw error;
  }

  if (data && typeof data.role === 'undefined') {
    data.role = 'user';
  }

  if (data && typeof data.account_status === 'undefined') {
    data.account_status = 'active';
  }

  if (data && typeof data.application_status === 'undefined') {
    data.application_status = 'none';
  }

  return data;
}

async function deleteAccountProfile(userId) {
  const client = getSupabaseClient();
  const { error } = await client.from('user_profiles').delete().eq('user_id', userId);
  if (error) {
    throw error;
  }
}
