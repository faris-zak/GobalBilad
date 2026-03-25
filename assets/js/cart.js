/**
 * جوب البلاد — Cart Manager
 *
 * Cart is stored in localStorage as:
 * {
 *   [storeId]: {
 *     storeId: string,
 *     storeName: string,
 *     items: { [productId]: { id, name, price, quantity } }
 *   }
 * }
 *
 * Each store maintains its own independent cart.
 */

const Cart = {

  // ================================================================
  // Core read/write
  // ================================================================

  _load() {
    return Helpers.storageGet(CONSTANTS.STORAGE.CART, {});
  },

  _save(cart) {
    Helpers.storageSet(CONSTANTS.STORAGE.CART, cart);
    document.dispatchEvent(new CustomEvent('cart:changed', { detail: { cart } }));
    if (typeof Components !== 'undefined') Components.updateCartBadge();
  },

  // ================================================================
  // Mutations
  // ================================================================

  /**
   * Add or increment a product in the cart.
   * @param {string} storeId
   * @param {string} storeName
   * @param {Object} product — { id, name, price }
   * @param {number} [qty]
   */
  addItem(storeId, storeName, product, qty = 1) {
    const cart  = this._load();
    if (!cart[storeId]) {
      cart[storeId] = { storeId, storeName, items: {} };
    }
    const store = cart[storeId];
    if (store.items[product.id]) {
      const newQty = store.items[product.id].quantity + qty;
      store.items[product.id].quantity = Math.min(newQty, CONSTANTS.MAX_CART_QTY_PER_ITEM);
    } else {
      store.items[product.id] = {
        id:       product.id,
        name:     product.name,
        price:    product.price,
        quantity: qty,
      };
    }
    this._save(cart);
  },

  /**
   * Set an item's quantity. If qty === 0, removes the item.
   * @param {string} storeId
   * @param {string} productId
   * @param {number} qty
   */
  setQuantity(storeId, productId, qty) {
    const cart = this._load();
    if (!cart[storeId]?.items[productId]) return;
    if (qty <= 0) {
      this.removeItem(storeId, productId);
      return;
    }
    cart[storeId].items[productId].quantity = Math.min(qty, CONSTANTS.MAX_CART_QTY_PER_ITEM);
    this._save(cart);
  },

  /**
   * Remove a single product from a store's cart.
   * @param {string} storeId
   * @param {string} productId
   */
  removeItem(storeId, productId) {
    const cart = this._load();
    if (!cart[storeId]) return;
    delete cart[storeId].items[productId];
    // Clean up empty store carts
    if (Object.keys(cart[storeId].items).length === 0) {
      delete cart[storeId];
    }
    this._save(cart);
  },

  /**
   * Clear an entire store's cart (after checkout).
   * @param {string} storeId
   */
  clearStore(storeId) {
    const cart = this._load();
    delete cart[storeId];
    this._save(cart);
  },

  /** Clear all carts. */
  clearAll() {
    this._save({});
  },

  // ================================================================
  // Read helpers
  // ================================================================

  /**
   * Get all carts as an array: [{ storeId, storeName, items: [...] }]
   * @returns {Array}
   */
  getAll() {
    const cart = this._load();
    return Object.values(cart).map(store => ({
      ...store,
      items: Object.values(store.items),
    }));
  },

  /**
   * Get items for a specific store.
   * @param {string} storeId
   * @returns {Array}
   */
  getStoreItems(storeId) {
    const cart = this._load();
    const store = cart[storeId];
    if (!store) return [];
    return Object.values(store.items);
  },

  /**
   * How many products are in a store's cart.
   * @param {string} storeId
   * @returns {number}
   */
  getStoreItemCount(storeId) {
    return this.getStoreItems(storeId).reduce((s, i) => s + i.quantity, 0);
  },

  /**
   * Total number of items across all stores.
   * @returns {number}
   */
  getTotalCount() {
    return this.getAll().reduce((s, store) =>
      s + store.items.reduce((ss, i) => ss + i.quantity, 0), 0);
  },

  /**
   * Subtotal for a specific store (before delivery fee).
   * @param {string} storeId
   * @returns {number}
   */
  getStoreSubtotal(storeId) {
    return this.getStoreItems(storeId)
      .reduce((s, i) => s + (parseFloat(i.price) * i.quantity), 0);
  },

  /**
   * Check if any cart exists.
   * @returns {boolean}
   */
  isEmpty() {
    return Object.keys(this._load()).length === 0;
  },

  /**
   * Check if a specific product is in a store's cart.
   * @param {string} storeId
   * @param {string} productId
   * @returns {number} current quantity (0 if not in cart)
   */
  getItemQty(storeId, productId) {
    const cart = this._load();
    return cart[storeId]?.items[productId]?.quantity || 0;
  },

};
