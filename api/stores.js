/**
 * جوب البلاد — Stores API
 */

const StoresAPI = {

  /**
   * Fetch all approved and active stores (public, no auth required).
   * @returns {Promise<Array>}
   */
  async getAll() {
    const { data, error } = await window.db
      .from(CONSTANTS.TABLES.STORES)
      .select('*')
      .eq('approved', true)
      .eq('active', true)
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch a single store by ID.
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async getById(id) {
    const { data, error } = await window.db
      .from(CONSTANTS.TABLES.STORES)
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Fetch the store owned by the currently signed-in user.
   * @returns {Promise<Object|null>}
   */
  async getMyStore() {
    const user = await getCurrentUser();
    if (!user) return null;
    const { data, error } = await window.db
      .from(CONSTANTS.TABLES.STORES)
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (error?.code === 'PGRST116') return null; // No row found
    if (error) throw error;
    return data;
  },

  /**
   * Submit a new store registration request.
   * Status defaults to approved=false (awaits admin review).
   * @param {Object} storeData
   * @returns {Promise<Object>}
   */
  async register(storeData) {
    const user = await getCurrentUser();
    if (!user) throw new Error('يجب تسجيل الدخول أولاً');

    const { data, error } = await window.db
      .from(CONSTANTS.TABLES.STORES)
      .insert({
        user_id:       user.id,
        name:          storeData.name.trim(),
        owner_name:    storeData.ownerName.trim(),
        phone:         storeData.phone.trim(),
        whatsapp:      storeData.whatsapp?.trim() || storeData.phone.trim(),
        description:   storeData.description?.trim() || null,
        category:      storeData.category || 'general',
        location_text: storeData.locationText?.trim() || null,
        approved:      false,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Update store info (owner only).
   * @param {string} storeId
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async update(storeId, updates) {
    // Only allow safe fields to be updated by store owner
    const safe = {};
    const allowed = ['name', 'description', 'phone', 'whatsapp', 'category', 'location_text'];
    allowed.forEach(k => {
      if (updates[k] !== undefined) safe[k] = updates[k];
    });

    const { data, error } = await window.db
      .from(CONSTANTS.TABLES.STORES)
      .update(safe)
      .eq('id', storeId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ================================================================
  // Admin operations
  // ================================================================

  /**
   * Fetch all stores (pending + approved) — admin only.
   * @returns {Promise<Array>}
   */
  async adminGetAll() {
    const { data, error } = await window.db
      .from(CONSTANTS.TABLES.STORES)
      .select('*, users(name, email)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /**
   * Approve a store — admin only.
   * @param {string} storeId
   */
  async adminApprove(storeId) {
    const { error } = await window.db
      .from(CONSTANTS.TABLES.STORES)
      .update({ approved: true, rejection_reason: null })
      .eq('id', storeId);
    if (error) throw error;

    // Promote the owner's role to 'store'
    const { data: store } = await window.db
      .from(CONSTANTS.TABLES.STORES)
      .select('user_id')
      .eq('id', storeId)
      .single();
    if (store?.user_id) {
      await window.db
        .from(CONSTANTS.TABLES.USERS)
        .update({ role: 'store' })
        .eq('id', store.user_id);
    }
  },

  /**
   * Reject a store — admin only.
   * @param {string} storeId
   * @param {string} reason
   */
  async adminReject(storeId, reason) {
    const { error } = await window.db
      .from(CONSTANTS.TABLES.STORES)
      .update({ approved: false, rejection_reason: reason })
      .eq('id', storeId);
    if (error) throw error;
  },

  /**
   * Toggle a store's active status — admin only.
   * @param {string} storeId
   * @param {boolean} active
   */
  async adminSetActive(storeId, active) {
    const { error } = await window.db
      .from(CONSTANTS.TABLES.STORES)
      .update({ active })
      .eq('id', storeId);
    if (error) throw error;
  },

};
