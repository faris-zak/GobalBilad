/**
 * جوب البلاد — Helper Utilities
 * Pure functions with no side effects.
 * No dependency on DOM or Supabase — safe to call anywhere.
 */

const Helpers = {

  // ================================================================
  // Formatting
  // ================================================================

  /**
   * Format a number as Omani Rial (3 decimal places).
   * @param {number|string} amount
   * @returns {string} e.g. "1.500 ر.ع."
   */
  formatPrice(amount) {
    if (amount === null || amount === undefined || amount === '') return '—';
    return `${parseFloat(amount).toFixed(3)} ر.ع.`;
  },

  /**
   * Format a date in Arabic (long format).
   * @param {string|Date} date
   * @returns {string}
   */
  formatDate(date) {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('ar-OM', {
      year:  'numeric',
      month: 'long',
      day:   'numeric',
    });
  },

  /**
   * Format a date + time in Arabic.
   * @param {string|Date} date
   * @returns {string}
   */
  formatDateTime(date) {
    if (!date) return '—';
    return new Date(date).toLocaleString('ar-OM', {
      year:   'numeric',
      month:  'short',
      day:    'numeric',
      hour:   '2-digit',
      minute: '2-digit',
    });
  },

  /**
   * Relative time string ("منذ 5 دقائق").
   * @param {string|Date} date
   * @returns {string}
   */
  timeAgo(date) {
    if (!date) return '—';
    const rtf  = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' });
    const diff = (new Date(date).getTime() - Date.now()) / 1000;
    const abs  = Math.abs(diff);
    if (abs < 60)    return rtf.format(Math.round(diff), 'second');
    if (abs < 3600)  return rtf.format(Math.round(diff / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
    return rtf.format(Math.round(diff / 86400), 'day');
  },

  /**
   * Truncate text with Arabic ellipsis.
   * @param {string} text
   * @param {number} max
   * @returns {string}
   */
  truncate(text, max = 80) {
    if (!text) return '';
    return text.length > max ? text.slice(0, max) + '…' : text;
  },

  // ================================================================
  // Location / Distance
  // ================================================================

  /**
   * Haversine distance between two GPS points.
   * @param {number} lat1
   * @param {number} lng1
   * @param {number} lat2
   * @param {number} lng2
   * @returns {number} Distance in kilometres
   */
  getDistance(lat1, lng1, lat2, lng2) {
    const R    = 6371;
    const dLat = this._rad(lat2 - lat1);
    const dLng = this._rad(lng2 - lng1);
    const a    =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this._rad(lat1)) * Math.cos(this._rad(lat2)) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  _rad(deg) { return deg * (Math.PI / 180); },

  /**
   * Check if a point is within the platform's coverage area.
   * @param {number} lat
   * @param {number} lng
   * @returns {boolean}
   */
  isInCoverageArea(lat, lng) {
    const area = CONSTANTS.AREA;
    const dist = this.getDistance(lat, lng, area.CENTER_LAT, area.CENTER_LNG);
    return dist <= (area.RADIUS_KM + area.BUFFER_KM);
  },

  // ================================================================
  // Delivery Fee
  // ================================================================

  /**
   * Calculate delivery fee based on order total.
   * Returns null if order exceeds max allowed amount.
   * @param {number} total
   * @param {boolean} freeDelivery — true if user has free delivery
   * @returns {{ fee: number, isFree: boolean }|null}
   */
  calcDeliveryFee(total, freeDelivery = false) {
    const { TIER_1, TIER_2, MAX_ORDER_AMOUNT } = CONSTANTS.DELIVERY;

    if (total >= MAX_ORDER_AMOUNT) return null; // Rejected

    if (freeDelivery) return { fee: 0, isFree: true };

    let fee = 0;
    if (total < TIER_1.MAX)  fee = TIER_1.FEE;
    else if (total < TIER_2.MAX) fee = TIER_2.FEE;

    return { fee, isFree: false };
  },

  // ================================================================
  // URL / Routing
  // ================================================================

  /**
   * Get a query string parameter from the current page URL.
   * @param {string} name
   * @returns {string|null}
   */
  getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  },

  /**
   * Build a URL with query parameters.
   * @param {string} base
   * @param {Object} params
   * @returns {string}
   */
  buildUrl(base, params = {}) {
    const url = new URL(base, window.location.origin);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null && v !== undefined) url.searchParams.set(k, String(v));
    });
    return url.toString();
  },

  // ================================================================
  // DOM
  // ================================================================

  /**
   * Set loading state on a <button>.
   * Original text is stored in dataset so it can be restored.
   * @param {HTMLButtonElement} btn
   * @param {boolean} loading
   * @param {string} [text]
   */
  btnLoading(btn, loading, text = 'جاري التحميل...') {
    if (!btn) return;
    if (loading) {
      btn.dataset.orig = btn.textContent;
      btn.textContent  = text;
      btn.disabled     = true;
    } else {
      btn.textContent = btn.dataset.orig || btn.textContent;
      btn.disabled    = false;
    }
  },

  /**
   * Escape HTML to prevent XSS when inserting untrusted text into innerHTML.
   * Prefer textContent wherever possible; use this only when HTML context required.
   * @param {string} str
   * @returns {string}
   */
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
  },

  // ================================================================
  // Phone
  // ================================================================

  /**
   * Normalise an Omani phone number for WhatsApp deep-links.
   * Adds the +968 country code when missing.
   * @param {string} phone
   * @returns {string} e.g. "96899112233"
   */
  normalizePhone(phone) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('968')) return digits;
    if (digits.startsWith('0'))   return '968' + digits.slice(1);
    return '968' + digits;
  },

  // ================================================================
  // localStorage (safe wrappers)
  // ================================================================

  storageGet(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },

  storageSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { console.warn('[Storage] write failed', e); }
  },

  storageRemove(key) {
    try { localStorage.removeItem(key); } catch {}
  },

  // ================================================================
  // Misc
  // ================================================================

  /** Deep clone a serialisable object. */
  clone(obj) { return JSON.parse(JSON.stringify(obj)); },

  /** Simple debounce. */
  debounce(fn, ms = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  },

  /** Generate a short random string (for optimistic UI IDs). */
  uid() { return Math.random().toString(36).slice(2, 9); },

};
