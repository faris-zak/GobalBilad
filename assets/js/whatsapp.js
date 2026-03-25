/**
 * جوب البلاد — WhatsApp Integration
 * Builds formatted WhatsApp message deep-links for order notifications.
 */

const WhatsApp = {

  /**
   * Open a WhatsApp chat with the store for a placed order.
   * @param {Object} order — order row with items joined
   * @param {Object} store — store row
   * @param {Array}  items — order_items rows
   */
  sendOrderToStore(order, store, items) {
    const phone = Helpers.normalizePhone(store.whatsapp || store.phone);
    const msg   = this._buildOrderMessage(order, store, items);
    this._open(phone, msg);
  },

  /**
   * Open a WhatsApp chat with the customer (from store dashboard).
   * @param {string} customerPhone
   * @param {Object} order
   */
  contactCustomer(customerPhone, order) {
    const phone = Helpers.normalizePhone(customerPhone);
    const msg   = `مرحباً ${order.customer_name}، بخصوص طلبك رقم #${order.id.slice(0, 8).toUpperCase()} من ${CONSTANTS.APP_NAME}`;
    this._open(phone, msg);
  },

  /**
   * Open a WhatsApp chat with a driver (admin).
   * @param {string} driverPhone
   * @param {string} [message]
   */
  contactDriver(driverPhone, message = '') {
    const phone = Helpers.normalizePhone(driverPhone);
    this._open(phone, message || `مرحباً، بخصوص التوصيل على منصة ${CONSTANTS.APP_NAME}`);
  },

  // ================================================================
  // Private
  // ================================================================

  _open(phone, message) {
    const encoded = encodeURIComponent(message);
    const url     = `https://wa.me/${phone}?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  },

  /**
   * Build the formatted Arabic order message.
   * @param {Object} order
   * @param {Object} store
   * @param {Array}  items
   * @returns {string}
   */
  _buildOrderMessage(order, store, items) {
    const lines = items.map(item =>
      `• ${item.product_name} × ${item.quantity}  ——  ${Helpers.formatPrice(item.price * item.quantity)}`
    ).join('\n');

    const deliveryLine = order.is_free_delivery
      ? '🎁 التوصيل: مجاني (أول طلب)'
      : `🚗 رسوم التوصيل: ${Helpers.formatPrice(order.delivery_fee)}`;

    const locationLine = order.location_link
      ? `📍 الموقع: ${order.location_link}`
      : '📍 الموقع: لم يُحدَّد';

    const notesLine = order.notes
      ? `📝 ملاحظات: ${order.notes}`
      : '';

    return [
      `🛒 *طلب جديد — ${CONSTANTS.APP_NAME}*`,
      `─────────────────`,
      `👤 العميل: ${order.customer_name}`,
      `📞 الهاتف: ${order.customer_phone}`,
      locationLine,
      ``,
      `*قائمة المنتجات:*`,
      lines,
      `─────────────────`,
      `💰 إجمالي المنتجات: ${Helpers.formatPrice(order.total_price)}`,
      deliveryLine,
      `💵 *الإجمالي الكلي: ${Helpers.formatPrice(
        parseFloat(order.total_price) + parseFloat(order.delivery_fee)
      )}*`,
      notesLine,
      ``,
      `🆔 رقم الطلب: #${order.id.slice(0, 8).toUpperCase()}`,
      `🕐 ${Helpers.formatDateTime(order.created_at)}`,
    ].filter(Boolean).join('\n');
  },

};
