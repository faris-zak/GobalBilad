/**
 * جوب البلاد — Drivers API
 */

const DriversAPI = {

  /**
   * Register as a driver (pending admin approval).
   * @param {Object} driverData — { name, phone }
   * @returns {Promise<Object>}
   */
  async register(driverData) {
    const user = await getCurrentUser();
    if (!user) throw new Error('يجب تسجيل الدخول أولاً');

    const { data, error } = await window.db
      .from(CONSTANTS.TABLES.DRIVERS)
      .insert({
        user_id:   user.id,
        name:      driverData.name.trim(),
        phone:     driverData.phone.trim(),
        available: false,
        approved:  false,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Fetch the current user's driver profile.
   * @returns {Promise<Object|null>}
   */
  async getMyProfile() {
    const user = await getCurrentUser();
    if (!user) return null;
    const { data, error } = await window.db
      .from(CONSTANTS.TABLES.DRIVERS)
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (error?.code === 'PGRST116') return null;
    if (error) throw error;
    return data;
  },

  /**
   * Toggle availability (on/off shift).
   * @param {string} driverId
   * @param {boolean} available
   */
  async setAvailability(driverId, available) {
    const { error } = await window.db
      .from(CONSTANTS.TABLES.DRIVERS)
      .update({ available })
      .eq('id', driverId);
    if (error) throw error;
  },

  /**
   * Update limited driver info — name and phone only.
   * @param {string} driverId
   * @param {Object} updates — { name, phone }
   */
  async updateProfile(driverId, updates) {
    const safe = {};
    if (updates.name)  safe.name  = updates.name.trim();
    if (updates.phone) safe.phone = updates.phone.trim();

    const { error } = await window.db
      .from(CONSTANTS.TABLES.DRIVERS)
      .update(safe)
      .eq('id', driverId);
    if (error) throw error;
  },

  /**
   * Mark driver as retired (soft-delete / permanent unavailability).
   * @param {string} driverId
   */
  async retire(driverId) {
    const { error } = await window.db
      .from(CONSTANTS.TABLES.DRIVERS)
      .update({ retired: true, available: false })
      .eq('id', driverId);
    if (error) throw error;
  },

  // ================================================================
  // Admin operations
  // ================================================================

  /**
   * Fetch all drivers — admin only.
   * @returns {Promise<Array>}
   */
  async adminGetAll() {
    const { data, error } = await window.db
      .from(CONSTANTS.TABLES.DRIVERS)
      .select('*, users(name, email)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /**
   * Approve a driver — admin only.
   * @param {string} driverId
   */
  async adminApprove(driverId) {
    const { error } = await window.db
      .from(CONSTANTS.TABLES.DRIVERS)
      .update({ approved: true, rejection_reason: null })
      .eq('id', driverId);
    if (error) throw error;

    // Promote user's role to 'driver'
    const { data: driver } = await window.db
      .from(CONSTANTS.TABLES.DRIVERS)
      .select('user_id')
      .eq('id', driverId)
      .single();
    if (driver?.user_id) {
      await window.db
        .from(CONSTANTS.TABLES.USERS)
        .update({ role: 'driver' })
        .eq('id', driver.user_id);
    }
  },

  /**
   * Reject a driver — admin only.
   * @param {string} driverId
   * @param {string} reason
   */
  async adminReject(driverId, reason) {
    const { error } = await window.db
      .from(CONSTANTS.TABLES.DRIVERS)
      .update({ approved: false, rejection_reason: reason })
      .eq('id', driverId);
    if (error) throw error;
  },

  /**
   * Disable (deactivate) a driver — admin only.
   * @param {string} driverId
   */
  async adminDisable(driverId) {
    const { error } = await window.db
      .from(CONSTANTS.TABLES.DRIVERS)
      .update({ active: false, available: false })
      .eq('id', driverId);
    if (error) throw error;
  },

};
