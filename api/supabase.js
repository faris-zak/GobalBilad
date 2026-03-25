const SUPABASE_URL      = 'https://voqzlqijszaacphtfvzb.supabase.co';   // e.g. https://xxxx.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvcXpscWlqc3phYWNwaHRmdnpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTkzNDYsImV4cCI6MjA4OTk5NTM0Nn0.9DWQSAts6ADWMD2rxUkrsGhZK3_ey9JFm6K7UD1lrZ4';      // public anon key (safe for frontend)

// Guard: warn developer if credentials are not yet configured
if (SUPABASE_URL === 'https://voqzlqijszaacphtfvzb.supabase.co' || SUPABASE_ANON_KEY === 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvcXpscWlqc3phYWNwaHRmdnpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MTkzNDYsImV4cCI6MjA4OTk5NTM0Nn0.9DWQSAts6ADWMD2rxUkrsGhZK3_ey9JFm6K7UD1lrZ4') {
  console.error(
    '⚠️ Supabase غير مُهيَّأ. افتح api/supabase.js وأدخل رابط مشروعك ومفتاح anon.'
  );
}

// Initialise Supabase client (supabase-js loaded via CDN <script> tag)
const { createClient } = supabase;
window.db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken:    true,
    persistSession:      true,
    detectSessionInUrl:  true,
  },
});

/**
 * Convenience: get the currently signed-in user object, or null.
 * @returns {Promise<import('@supabase/supabase-js').User|null>}
 */
async function getCurrentUser() {
  const { data: { user } } = await window.db.auth.getUser();
  return user || null;
}

/**
 * Convenience: get the full user profile row from public.users.
 * @returns {Promise<Object|null>}
 */
async function getUserProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await window.db
    .from(CONSTANTS.TABLES.USERS)
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) { console.error('[getUserProfile]', error); return null; }
  return data;
}
