// =====================================================
// Supabase Client + API Layer
// جوب البلاد — Al-Maamoura Local Marketplace
// =====================================================

// IMPORTANT: Replace with your actual Supabase project credentials
const SUPABASE_URL = 'https://rorckgvoujizlscuogpd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvcmNrZ3ZvdWppemxzY3VvZ3BkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MjI1MzIsImV4cCI6MjA4OTk5ODUzMn0.kza4e2eJNf1If3nqs_OuloX8okz__MDTkQjE0C7Y9u8';

// Initialize client safely
let _supabase = null;
try {
    if (window.supabase) {
        _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.warn('[Supabase] CDN library not loaded.');
    }
} catch (err) {
    console.error('[Supabase] Init error:', err);
}

window.supabaseClient = _supabase;

// =====================================================
// API — Namespaced helper functions
// =====================================================
const API = {
    // ── AUTH ──────────────────────────────────────────
    auth: {
        // Get the currently logged-in user (cached session)
        getUser: async () => {
            const { data: { user } } = await _supabase.auth.getUser();
            return user;
        },

        // Fetch user profile row from public.users
        getProfile: async (userId) => {
            const { data, error } = await _supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();
            if (error) throw error;
            return data;
        },

        // Update own profile
        updateProfile: async (userId, updates) => {
            const { data, error } = await _supabase
                .from('users')
                .update(updates)
                .eq('id', userId)
                .select()
                .single();
            if (error) throw error;
            return data;
        },

        signOut: () => _supabase.auth.signOut(),

        // Google OAuth — customers
        signInWithGoogle: (redirectTo) =>
            _supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: redirectTo || window.location.origin + '/index.html' }
            }),

        // Email/password — stores, drivers, admin
        signInWithEmail: (email, password) =>
            _supabase.auth.signInWithPassword({ email, password }),

        // Register new store/driver account
        signUpWithEmail: (email, password) =>
            _supabase.auth.signUp({ email, password }),

        onAuthChange: (callback) =>
            _supabase.auth.onAuthStateChange(callback),
    },

    // ── STORES ────────────────────────────────────────
    stores: {
        // All approved + active stores (public)
        getAll: async () => {
            const { data, error } = await _supabase
                .from('stores')
                .select('*')
                .eq('approved', true)
                .eq('active', true)
                .order('name');
            if (error) throw error;
            return data;
        },

        // Single store by ID
        getById: async (storeId) => {
            const { data, error } = await _supabase
                .from('stores')
                .select('*')
                .eq('id', storeId)
                .single();
            if (error) throw error;
            return data;
        },

        // Store owner: fetch own store record
        getOwn: async (userId) => {
            const { data, error } = await _supabase
                .from('stores')
                .select('*')
                .eq('user_id', userId)
                .single();
            if (error) throw error;
            return data;
        },

        // Register a new store (requires admin approval)
        register: async (storeData) => {
            const { data, error } = await _supabase
                .from('stores')
                .insert(storeData)
                .select()
                .single();
            if (error) throw error;
            return data;
        },

        // Store owner: update their store details
        update: async (storeId, updates) => {
            const { data, error } = await _supabase
                .from('stores')
                .update(updates)
                .eq('id', storeId)
                .select()
                .single();
            if (error) throw error;
            return data;
        },

        // ADMIN: get all stores (pending + approved)
        adminGetAll: async () => {
            const { data, error } = await _supabase
                .from('stores')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },

        // ADMIN: approve or reject a store
        adminSetApproval: async (storeId, approved, rejectionReason = null) => {
            const { data, error } = await _supabase
                .from('stores')
                .update({ approved, rejection_reason: rejectionReason })
                .eq('id', storeId)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
    },

    // ── PRODUCTS ──────────────────────────────────────
    products: {
        // All available products for a store
        getByStore: async (storeId) => {
            const { data, error } = await _supabase
                .from('products')
                .select('*')
                .eq('store_id', storeId)
                .eq('available', true)
                .order('sort_order')
                .order('name');
            if (error) throw error;
            return data;
        },

        // All products for a store (including unavailable — for owner dashboard)
        getByStoreAll: async (storeId) => {
            const { data, error } = await _supabase
                .from('products')
                .select('*')
                .eq('store_id', storeId)
                .order('sort_order')
                .order('name');
            if (error) throw error;
            return data;
        },

        // Create product
        create: async (productData) => {
            const { data, error } = await _supabase
                .from('products')
                .insert(productData)
                .select()
                .single();
            if (error) throw error;
            return data;
        },

        // Update product
        update: async (productId, updates) => {
            const { data, error } = await _supabase
                .from('products')
                .update(updates)
                .eq('id', productId)
                .select()
                .single();
            if (error) throw error;
            return data;
        },

        // Delete product
        delete: async (productId) => {
            const { error } = await _supabase
                .from('products')
                .delete()
                .eq('id', productId);
            if (error) throw error;
        },

        // Toggle availability
        toggleAvailability: async (productId, available) => {
            return API.products.update(productId, { available });
        },
    },

    // ── ORDERS ────────────────────────────────────────
    orders: {
        // Place a new order (insert order + items in one transaction via RPC)
        place: async ({ order, items }) => {
            // Insert order first
            const { data: newOrder, error: orderErr } = await _supabase
                .from('orders')
                .insert(order)
                .select()
                .single();
            if (orderErr) throw orderErr;

            // Attach order_id to each item and insert
            const orderItems = items.map(item => ({
                order_id: newOrder.id,
                product_id: item.product_id,
                product_name: item.name,
                quantity: item.qty,
                price: item.price,
            }));

            const { error: itemsErr } = await _supabase
                .from('order_items')
                .insert(orderItems);
            if (itemsErr) throw itemsErr;

            return newOrder;
        },

        // Customer: view own order history
        getMyOrders: async (userId) => {
            const { data, error } = await _supabase
                .from('orders')
                .select(`*, order_items(*), stores(name)`)
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },

        // Store: view incoming orders
        getForStore: async (storeId) => {
            const { data, error } = await _supabase
                .from('orders')
                .select(`*, order_items(*), users(name, phone)`)
                .eq('store_id', storeId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },

        // Driver: view orders ready for pickup + their active deliveries
        getForDriver: async (driverId) => {
            const { data, error } = await _supabase
                .from('orders')
                .select(`*, order_items(*), stores(name, phone, whatsapp), users(name, phone)`)
                .in('status', ['ready', 'out_for_delivery'])
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },

        // Update order status (store or driver depending on RLS)
        updateStatus: async (orderId, status, extras = {}) => {
            const { data, error } = await _supabase
                .from('orders')
                .update({ status, ...extras })
                .eq('id', orderId)
                .select()
                .single();
            if (error) throw error;
            return data;
        },

        // ADMIN: all orders
        adminGetAll: async () => {
            const { data, error } = await _supabase
                .from('orders')
                .select(`*, order_items(*), stores(name), users(name, phone), drivers(name, phone)`)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
    },

    // ── DRIVERS ───────────────────────────────────────
    drivers: {
        // Driver: get own record
        getOwn: async (userId) => {
            const { data, error } = await _supabase
                .from('drivers')
                .select('*')
                .eq('user_id', userId)
                .single();
            if (error) throw error;
            return data;
        },

        // Driver: register
        register: async (driverData) => {
            const { data, error } = await _supabase
                .from('drivers')
                .insert(driverData)
                .select()
                .single();
            if (error) throw error;
            return data;
        },

        // Driver: update own profile / availability
        update: async (driverId, updates) => {
            const { data, error } = await _supabase
                .from('drivers')
                .update(updates)
                .eq('id', driverId)
                .select()
                .single();
            if (error) throw error;
            return data;
        },

        // ADMIN: all drivers
        adminGetAll: async () => {
            const { data, error } = await _supabase
                .from('drivers')
                .select(`*, users(name, email, phone)`)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },

        // ADMIN: approve or reject a driver
        adminSetApproval: async (driverId, approved, rejectionReason = null) => {
            const { data, error } = await _supabase
                .from('drivers')
                .update({ approved, rejection_reason: rejectionReason })
                .eq('id', driverId)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
    },

    // ── FREE DELIVERY ─────────────────────────────────
    freeDelivery: {
        // Check if user has already used their free delivery
        hasUsed: async (userId) => {
            const { data } = await _supabase
                .from('free_delivery_used')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle();
            return data !== null;
        },

        // Mark free delivery as used
        markUsed: async (userId) => {
            const { error } = await _supabase
                .from('free_delivery_used')
                .insert({ user_id: userId });
            if (error) throw error;
        },
    },

    // ── APP CONFIG ────────────────────────────────────
    config: {
        // Get all config key/values
        getAll: async () => {
            const { data, error } = await _supabase
                .from('app_config')
                .select('key, value');
            if (error) throw error;
            // Return as plain object {key: value}
            return Object.fromEntries(data.map(r => [r.key, r.value]));
        },
    },

    // ── USERS (ADMIN) ─────────────────────────────────
    users: {
        adminGetAll: async () => {
            const { data, error } = await _supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },

        adminBlock: async (userId, isBlocked) => {
            const { data, error } = await _supabase
                .from('users')
                .update({ is_blocked: isBlocked })
                .eq('id', userId)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
    },
};

window.API = API;
