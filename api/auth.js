/**
 * جوب البلاد — Authentication API
 * Wraps Supabase Auth operations with consistent error handling.
 */

const AuthAPI = {

  /**
   * Sign in with Google OAuth.
   * Redirects to Supabase OAuth flow; Supabase will redirect back after auth.
   */
  async signInWithGoogle() {
    const { error } = await window.db.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/index.html`,
        queryParams: { access_type: 'offline', prompt: 'select_account' },
      },
    });
    if (error) throw error;
  },

  /**
   * Sign in with email and password (stores & drivers).
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ user, session }>}
   */
  async signInWithEmail(email, password) {
    const { data, error } = await window.db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  /**
   * Register a new auth account (email + password).
   * Used by store and driver registration flows.
   * The trigger in SQL will create the public.users row automatically.
   * @param {string} email
   * @param {string} password
   * @param {string} name
   * @returns {Promise<{ user, session }>}
   */
  async signUp(email, password, name) {
    const { data, error } = await window.db.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/login.html`,
      },
    });
    if (error) throw error;
    return data;
  },

  /**
   * Sign out the current user and clear local state.
   */
  async signOut() {
    // Clear cart and location cache
    Helpers.storageRemove(CONSTANTS.STORAGE.CART);
    Helpers.storageRemove(CONSTANTS.STORAGE.LOCATION_VERIFIED);
    Helpers.storageRemove(CONSTANTS.STORAGE.LOCATION_TIMESTAMP);

    const { error } = await window.db.auth.signOut();
    if (error) throw error;
    window.location.href = '/login.html';
  },

  /**
   * Send a password reset email.
   * @param {string} email
   */
  async resetPassword(email) {
    const { error } = await window.db.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password.html`,
    });
    if (error) throw error;
  },

  /**
   * Listen for auth state changes.
   * @param {Function} callback — receives (event, session)
   */
  onAuthChange(callback) {
    return window.db.auth.onAuthStateChange(callback);
  },

  /**
   * Set or update the user's role in public.users.
   * Only call this during the registration flow for stores/drivers.
   * @param {string} userId
   * @param {string} role
   */
  async setRole(userId, role) {
    const { error } = await window.db
      .from(CONSTANTS.TABLES.USERS)
      .update({ role })
      .eq('id', userId);
    if (error) throw error;
  },

  /**
   * Update the current user's profile (name, phone).
   * @param {Object} updates — { name, phone }
   */
  async updateProfile(updates) {
    const user = await getCurrentUser();
    if (!user) throw new Error('غير مسجّل الدخول');

    // Sanitised update — only allow safe fields
    const safe = {};
    if (updates.name  !== undefined) safe.name  = String(updates.name).trim();
    if (updates.phone !== undefined) safe.phone = String(updates.phone).trim();

    const { error } = await window.db
      .from(CONSTANTS.TABLES.USERS)
      .update(safe)
      .eq('id', user.id);
    if (error) throw error;
  },

};
