/**
 * جوب البلاد — Location Service
 *
 * Checks whether the user is physically within Al-Maamoura.
 * Result is cached in localStorage (30 min) to reduce permission prompts.
 */

const LocationService = {

  // ================================================================
  // Check
  // ================================================================

  /**
   * Verify the user is in the coverage area.
   * Uses cached result if recent enough, otherwise requests geolocation.
   * @returns {Promise<{ allowed: boolean, lat?: number, lng?: number, distance?: number }>}
   */
  async verify() {
    // Check cache first
    const cached = this._getCached();
    if (cached) return cached;

    // Request real position
    try {
      const pos = await this._requestPosition();
      const { latitude: lat, longitude: lng } = pos.coords;
      const distance = Helpers.getDistance(
        lat, lng, CONSTANTS.AREA.CENTER_LAT, CONSTANTS.AREA.CENTER_LNG
      );
      const allowed = distance <= (CONSTANTS.AREA.RADIUS_KM + CONSTANTS.AREA.BUFFER_KM);
      const result  = { allowed, lat, lng, distance: Math.round(distance * 10) / 10 };

      this._cache(result);
      return result;

    } catch (err) {
      // Geolocation denied or unavailable
      return { allowed: false, denied: true, error: err.message };
    }
  },

  /**
   * Prompt full page overlay checking location.
   * Shows the user a blocking screen while checking, then hides it.
   * Returns false if the user is outside the area/denied.
   * @returns {Promise<boolean>}
   */
  async verifyAndBlock() {
    const banner = document.getElementById('location-banner');
    const blocked = document.getElementById('location-blocked');
    if (banner) Helpers.show(banner);

    const result = await this.verify();

    if (banner) Helpers.hide(banner);

    if (!result.allowed) {
      if (blocked) Helpers.show(blocked);
      return false;
    }
    return true;
  },

  // ================================================================
  // Manual override
  // ================================================================

  /**
   * Allow user to manually confirm they are in the area (escape hatch).
   * Stores a manual confirmation in localStorage.
   */
  manualConfirm() {
    const result = {
      allowed:  true,
      manual:   true,
      lat:      CONSTANTS.AREA.CENTER_LAT,
      lng:      CONSTANTS.AREA.CENTER_LNG,
      distance: 0,
    };
    this._cache(result);
  },

  /**
   * Clear the cached location and force re-check on next verify().
   */
  clearCache() {
    Helpers.storageRemove(CONSTANTS.STORAGE.LOCATION);
    Helpers.storageRemove(CONSTANTS.STORAGE.LOCATION_VERIFIED);
    Helpers.storageRemove(CONSTANTS.STORAGE.LOCATION_TIMESTAMP);
  },

  // ================================================================
  // Google Maps
  // ================================================================

  /**
   * Open Google Maps to get a share link → pastes into location field.
   * Just navigates to the sharing page; user copies the link themselves.
   */
  openMapsForShare() {
    window.open('https://maps.google.com', '_blank', 'noopener,noreferrer');
  },

  /**
   * Generate a Google Maps link from coordinates.
   * @param {number} lat
   * @param {number} lng
   * @returns {string}
   */
  coordsToMapsLink(lat, lng) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  },

  // ================================================================
  // Private helpers
  // ================================================================

  _requestPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('خدمة الموقع غير مدعومة في هذا المتصفح'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout:            10000,
        maximumAge:         5 * 60 * 1000, // Accept a 5-min cached position
      });
    });
  },

  _cache(result) {
    Helpers.storageSet(CONSTANTS.STORAGE.LOCATION, result);
    Helpers.storageSet(CONSTANTS.STORAGE.LOCATION_TIMESTAMP, Date.now());
  },

  _getCached() {
    const ts = Helpers.storageGet(CONSTANTS.STORAGE.LOCATION_TIMESTAMP, 0);
    const ageMinutes = (Date.now() - ts) / (1000 * 60);
    if (ageMinutes > CONSTANTS.LOCATION_CACHE_MINUTES) return null;
    return Helpers.storageGet(CONSTANTS.STORAGE.LOCATION, null);
  },

};
