(function () {
  const KEY_PREFIX = 'cart_';

  function key(storeId) {
    return `${KEY_PREFIX}${storeId}`;
  }

  function safeJsonParse(value) {
    try {
      return JSON.parse(value);
    } catch (_err) {
      return null;
    }
  }

  function normalizeCart(storeId, data) {
    const items = Array.isArray(data?.items) ? data.items : [];

    return {
      storeId,
      storeName: typeof data?.storeName === 'string' ? data.storeName : '',
      storePhone: typeof data?.storePhone === 'string' ? data.storePhone : '',
      items: items
        .map((item) => ({
          id: String(item?.id || ''),
          name: String(item?.name || ''),
          price: Number(item?.price || 0),
          qty: Number.parseInt(String(item?.qty || 0), 10)
        }))
        .filter((item) => item.id && item.name && Number.isFinite(item.price) && item.price >= 0 && Number.isInteger(item.qty) && item.qty > 0)
    };
  }

  function getCart(storeId) {
    const raw = localStorage.getItem(key(storeId));
    const parsed = safeJsonParse(raw);
    return normalizeCart(storeId, parsed || {});
  }

  function saveCart(storeId, cart) {
    localStorage.setItem(key(storeId), JSON.stringify(normalizeCart(storeId, cart)));
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: { storeId } }));
  }

  function addItem(storeId, storeMeta, item) {
    const cart = getCart(storeId);
    cart.storeName = storeMeta?.storeName || cart.storeName;
    cart.storePhone = storeMeta?.storePhone || cart.storePhone;

    const idx = cart.items.findIndex((it) => it.id === String(item.id));
    if (idx >= 0) {
      cart.items[idx].qty += 1;
    } else {
      cart.items.push({
        id: String(item.id),
        name: String(item.name),
        price: Number(item.price),
        qty: 1
      });
    }

    saveCart(storeId, cart);
    return cart;
  }

  function updateItemQty(storeId, itemId, qty) {
    const cart = getCart(storeId);
    const nextQty = Number.parseInt(String(qty || 0), 10);
    const idx = cart.items.findIndex((it) => it.id === String(itemId));

    if (idx === -1) return cart;

    if (!Number.isInteger(nextQty) || nextQty <= 0) {
      cart.items.splice(idx, 1);
    } else {
      cart.items[idx].qty = nextQty;
    }

    saveCart(storeId, cart);
    return cart;
  }

  function removeItem(storeId, itemId) {
    return updateItemQty(storeId, itemId, 0);
  }

  function clearCart(storeId) {
    localStorage.removeItem(key(storeId));
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: { storeId } }));
  }

  function getCartTotal(storeId) {
    const cart = getCart(storeId);
    const total = cart.items.reduce((sum, item) => sum + item.price * item.qty, 0);
    return Number(total.toFixed(3));
  }

  function getCartCount(storeId) {
    const cart = getCart(storeId);
    return cart.items.reduce((sum, item) => sum + item.qty, 0);
  }

  function getAllCartCount() {
    let count = 0;

    for (let i = 0; i < localStorage.length; i += 1) {
      const storageKey = localStorage.key(i);
      if (!storageKey || !storageKey.startsWith(KEY_PREFIX)) {
        continue;
      }

      const parsed = safeJsonParse(localStorage.getItem(storageKey));
      if (!parsed || !Array.isArray(parsed.items)) {
        continue;
      }

      for (const item of parsed.items) {
        const qty = Number.parseInt(String(item?.qty || 0), 10);
        if (Number.isInteger(qty) && qty > 0) {
          count += qty;
        }
      }
    }

    return count;
  }

  window.CartUtils = {
    getCart,
    addItem,
    updateItemQty,
    removeItem,
    clearCart,
    getCartTotal,
    getCartCount,
    getAllCartCount
  };
})();
