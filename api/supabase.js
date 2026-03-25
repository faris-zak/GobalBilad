/**
 * جوب البلاد — Supabase Client
 *
 * SETUP:
 *  1. Create a project at https://supabase.com
 *  2. Go to Settings → API
 *  3. Replace SUPABASE_URL and SUPABASE_ANON_KEY below
 *  4. Run sql/schema.sql in the Supabase SQL Editor
 *  5. Enable Google OAuth in Authentication → Providers → Google
 */

const SUPABASE_URL      = 'https://ilxterlkocwitezgjjms.supabase.co';   // e.g. https://xxxx.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlseHRlcmxrb2N3aXRlemdqam1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzODE4MDEsImV4cCI6MjA4OTk1NzgwMX0.VGVkLTjJ5QmwbCD5HeHeJVt0oACqF0G3o8EWeZPyK00';      // public anon key (safe for frontend)

// Guard: warn developer if credentials are not configured
if (SUPABASE_URL === 'https://ilxterlkocwitezgjjms.supabase.co') {
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
