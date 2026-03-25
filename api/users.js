/**
 * جوب البلاد — Users API (Admin)
 */

const UsersAPI = {

  /**
   * Fetch all users — admin only.
   * @returns {Promise<Array>}
   */
  async adminGetAll() {
    const { data, error } = await window.db
      .from(CONSTANTS.TABLES.USERS)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /**
   * Block or unblock a user — admin only.
   * @param {string} userId
   * @param {boolean} blocked
   */
  async adminSetBlocked(userId, blocked) {
    const { error } = await window.db
      .from(CONSTANTS.TABLES.USERS)
      .update({ is_blocked: blocked })
      .eq('id', userId);
    if (error) throw error;
  },

  /**
   * Fetch platform stats for admin overview.
   * @returns {Promise<Object>}
   */
  async adminGetStats() {
    try {
      const [usersRes, storesRes, ordersRes, driversRes] = await Promise.all([
        window.db.from(CONSTANTS.TABLES.USERS).select('id, role'),
        window.db.from(CONSTANTS.TABLES.STORES).select('id, approved, active'),
        window.db.from(CONSTANTS.TABLES.ORDERS).select('id, status, total_price, created_at'),
        window.db.from(CONSTANTS.TABLES.DRIVERS).select('id, approved, available, active, retired'),
      ]);

      const orders  = ordersRes.data  || [];
      const drivers = driversRes.data || [];
      const stores  = storesRes.data  || [];

      const today = new Date().toDateString();
      const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === today).length;

      const totalRevenue = orders
        .filter(o => o.status === 'delivered')
        .reduce((sum, o) => sum + parseFloat(o.total_price || 0), 0);

      return {
        data: {
          totalUsers:       (usersRes.data || []).length,
          approvedStores:   stores.filter(s => s.approved && s.active).length,
          approvedDrivers:  drivers.filter(d => d.approved && d.active && !d.retired).length,
          totalOrders:      orders.length,
          todayOrders,
          totalRevenue,
        },
      };
    } catch (err) {
      return { data: null, error: err };
    }
  },

};
