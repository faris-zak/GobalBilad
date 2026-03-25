/**
 * جوب البلاد — Orders API
 */

const OrdersAPI = {

  /**
   * Place a new order (customer).
   * Inserts the order + order_items in a single batch.
   * @param {Object} orderData
   * @param {Array}  items — [{ product_id, product_name, quantity, price }]
   * @returns {Promise<Object>} Created order
   */
  async create(orderData, items) {
    const user = await getCurrentUser();
    if (!user) throw new Error('يجب تسجيل الدخول أولاً');

    // Insert order row
    const { data: order, error: orderErr } = await window.db
      .from(CONSTANTS.TABLES.ORDERS)
      .insert({
        user_id:          user.id,
        store_id:         orderData.storeId,
        status:           'pending',
        total_price:      orderData.totalPrice,
        delivery_fee:     orderData.deliveryFee,
        customer_name:    orderData.customerName.trim(),
        customer_phone:   orderData.customerPhone.trim(),
        location_link:    orderData.locationLink?.trim() || null,
        notes:            orderData.notes?.trim() || null,
        is_free_delivery: orderData.isFreeDelivery || false,
      })
      .select()
      .single();
    if (orderErr) throw orderErr;

    // Insert order items
    const lines = items.map(item => ({
      order_id:     order.id,
      product_id:   item.productId || item.product_id || null,
      product_name: item.productName || item.product_name,
      quantity:     item.quantity,
      price:        item.price,
    }));

    const { error: itemsErr } = await window.db
      .from(CONSTANTS.TABLES.ORDER_ITEMS)
      .insert(lines);
    if (itemsErr) throw itemsErr;

    // If this was a free delivery, record it
    if (orderData.isFreeDelivery) {
      await window.db
        .from(CONSTANTS.TABLES.FREE_DELIVERY)
        .insert({ user_id: user.id })
        .throwOnError();
    }

    return order;
  },

  /**
   * Fetch a customer's order history, newest first.
   * @returns {Promise<Array>}
   */
  async getMyOrders() {
    const user = await getCurrentUser();
    if (!user) return [];
    const { data, error } = await window.db
      .from(CONSTANTS.TABLES.ORDERS)
      .select(`*, stores(name), order_items(*)`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch a single order with all related data.
   * @param {string} orderId
   * @returns {Promise<Object>}
   */
  async getById(orderId) {
    const { data, error } = await window.db
      .from(CONSTANTS.TABLES.ORDERS)
      .select(`*, stores(name, phone, whatsapp), users(name, phone), order_items(*), drivers(name, phone)`)
      .eq('id', orderId)
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Fetch all orders for the current store owner.
   * @returns {Promise<Array>}
   */
  async getStoreOrders(storeId) {
    const { data, error } = await window.db
      .from(CONSTANTS.TABLES.ORDERS)
      .select(`*, users(name, phone), order_items(*), drivers(name, phone)`)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch orders that are ready for pickup — driver dashboard.
   * @returns {Promise<Array>}
   */
  async getReadyOrders() {
    const { data, error } = await window.db
      .from(CONSTANTS.TABLES.ORDERS)
      .select(`*, stores(name, phone, location_text), users(name, phone), order_items(*)`)
      .in('status', ['ready', 'out_for_delivery'])
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  /**
   * Update order status.
   * Validates the transition is legal for the calling user's role.
   * @param {string} orderId
   * @param {string} newStatus
   * @param {Object} [extra] — { driverId, rejectionReason }
   */
  async updateStatus(orderId, newStatus, extra = {}) {
    const updates = { status: newStatus };
    if (extra.driverId)        updates.driver_id         = extra.driverId;
    if (extra.rejectionReason) updates.rejection_reason  = extra.rejectionReason;

    const { error } = await window.db
      .from(CONSTANTS.TABLES.ORDERS)
      .update(updates)
      .eq('id', orderId);
    if (error) throw error;

    // If delivered, increment driver's total
    if (newStatus === 'delivered' && extra.driverId) {
      await window.db.rpc('increment_driver_deliveries', { driver_uuid: extra.driverId })
        .then(() => {})
        .catch(() => {}); // Non-critical, ignore failure
    }
  },

  /**
   * Subscribe to real-time order updates for a store.
   * @param {string} storeId
   * @param {Function} onUpdate — called with (payload)
   * @returns {RealtimeChannel} Call .unsubscribe() to stop listening.
   */
  subscribeStoreOrders(storeId, onUpdate) {
    return window.db
      .channel(`store-orders-${storeId}`)
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  CONSTANTS.TABLES.ORDERS,
        filter: `store_id=eq.${storeId}`,
      }, onUpdate)
      .subscribe();
  },

  /**
   * Subscribe to status changes on the driver's assigned orders.
   * @param {Function} onUpdate
   * @returns {RealtimeChannel}
   */
  subscribeDriverOrders(onUpdate) {
    return window.db
      .channel('driver-orders')
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  CONSTANTS.TABLES.ORDERS,
      }, onUpdate)
      .subscribe();
  },

  /**
   * Check if current user is eligible for free delivery.
   * Free delivery = first order AND within the launch week.
   * @returns {Promise<boolean>}
   */
  async isFreeDeliveryEligible() {
    const user = await getCurrentUser();
    if (!user) return false;

    // Has the user already used their free delivery?
    const { data: used } = await window.db
      .from(CONSTANTS.TABLES.FREE_DELIVERY)
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (used) return false;

    // Is the platform still in its launch week?
    const { data: config } = await window.db
      .from(CONSTANTS.TABLES.APP_CONFIG)
      .select('value')
      .eq('key', 'launch_date')
      .single();
    if (!config) return false;

    const launchDate = new Date(config.value);
    const daysSince  = (Date.now() - launchDate.getTime()) / (1000 * 60 * 60 * 24);
    const freeDays   = parseInt(CONSTANTS.DELIVERY.FREE_PERIOD_DAYS || 7, 10);
    return daysSince <= freeDays;
  },

  // ================================================================
  // Admin
  // ================================================================

  /**
   * Fetch all orders — admin only.
   * @returns {Promise<Array>}
   */
  async adminGetAll() {
    const { data, error } = await window.db
      .from(CONSTANTS.TABLES.ORDERS)
      .select(`*, stores(name), users(name, phone), drivers(name)`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

};
