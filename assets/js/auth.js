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
  const { data, error } = await client
    .from('user_profiles')
    .select('user_id, full_name, phone, city, address, latitude, longitude, location_validated, location_source')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

async function upsertUserProfile(profile) {
  const client = getSupabaseClient();
  const { data, error } = await client.from('user_profiles').upsert(
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
    .select('user_id, latitude, longitude, location_validated, updated_at')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data || !data.user_id) {
    throw new Error('WRITE_NOT_CONFIRMED: Profile update was not confirmed by database');
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
