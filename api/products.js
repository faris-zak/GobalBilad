/**
 * جوب البلاد — Products API
 */

const ProductsAPI = {

  /**
   * Fetch all available products for a store (public).
   * @param {string} storeId
   * @returns {Promise<Array>}
   */
  async getByStore(storeId) {
    const { data, error } = await window.db
      .from(CONSTANTS.TABLES.PRODUCTS)
      .select('*')
      .eq('store_id', storeId)
      .eq('available', true)
      .order('sort_order', { ascending: true })
      .order('name',       { ascending: true });
    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch ALL products for a store (including unavailable) — store owner only.
   * @param {string} storeId
   * @returns {Promise<Array>}
   */
  async getAllByStore(storeId) {
    const { data, error } = await window.db
      .from(CONSTANTS.TABLES.PRODUCTS)
      .select('*')
      .eq('store_id', storeId)
      .order('sort_order', { ascending: true })
      .order('name',       { ascending: true });
    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new product — store owner only.
   * @param {string} storeId
   * @param {Object} productData
   * @returns {Promise<Object>}
   */
  async create(storeId, productData) {
    const { data, error } = await window.db
      .from(CONSTANTS.TABLES.PRODUCTS)
      .insert({
        store_id:    storeId,
        name:        productData.name.trim(),
        description: productData.description?.trim() || null,
        price:       parseFloat(productData.price),
        available:   productData.available !== false,
        image_url:   productData.imageUrl?.trim() || null,
        category:    productData.category?.trim() || null,
        sort_order:  productData.sortOrder || 0,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Update a product — store owner only.
   * @param {string} productId
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async update(productId, updates) {
    const safe = {};
    const allowed = ['name', 'description', 'price', 'available', 'image_url', 'category', 'sort_order'];
    allowed.forEach(k => {
      if (updates[k] !== undefined) safe[k] = updates[k];
    });
    if (safe.price    !== undefined) safe.price    = parseFloat(safe.price);
    if (safe.name     !== undefined) safe.name     = safe.name.trim();

    const { data, error } = await window.db
      .from(CONSTANTS.TABLES.PRODUCTS)
      .update(safe)
      .eq('id', productId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Toggle product availability — store owner only.
   * @param {string} productId
   * @param {boolean} available
   */
  async setAvailability(productId, available) {
    const { error } = await window.db
      .from(CONSTANTS.TABLES.PRODUCTS)
      .update({ available })
      .eq('id', productId);
    if (error) throw error;
  },

  /**
   * Delete a product — store owner only.
   * @param {string} productId
   */
  async delete(productId) {
    const { error } = await window.db
      .from(CONSTANTS.TABLES.PRODUCTS)
      .delete()
      .eq('id', productId);
    if (error) throw error;
  },

};
