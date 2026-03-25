// Initialize Supabase Client
// IMPORTANT: Replace these with your actual Supabase URL and Auth Key later
const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Default initialization will fail without real keys,
// so we wrap it to prevent immediate crashing on load
let supabase = null;

try {
    if (typeof supabase !== 'undefined' && window.supabase) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("Supabase client initialized successfully.");
    } else {
        console.warn("Supabase library not loaded. Make sure the CDN script is included.");
    }
} catch (error) {
    console.error("Error initializing Supabase client:", error);
}

// Export for global access in other scripts
window.supabaseClient = supabase;
