/**
 * جوب البلاد — App Core
 * Bootstraps the platform: auth guard, role redirect, location check, toast system.
 * Loaded last on every page so all dependencies are available.
 */

// ================================================================
// Global App State
// ================================================================
window.App = {
  user:    null,   // auth.User
  profile: null,   // public.users row
  ready:   false,  // true after boot completes
};

// ================================================================
// Page initialisation
// ================================================================
document.addEventListener('DOMContentLoaded', async () => {
  await App.boot();
});

App.boot = async function () {
  try {
    // Load current session
    const { data: { session } } = await window.db.auth.getSession();
    if (session?.user) {
      App.user    = session.user;
      App.profile = await getUserProfile();
    }

    // Route guard: redirect if page requires a role the user does not have
    App.enforceRouteGuard();

    // Sync UI (navbar user state, cart badge, etc.)
    if (typeof Components !== 'undefined') {
      Components.renderNavbar();
      Components.updateCartBadge();
    }

    App.ready = true;

    // Dispatch event so page-specific scripts know the app is ready
    document.dispatchEvent(new Event('app:ready'));

  } catch (err) {
    console.error('[App.boot]', err);
    Toast.show('حدث خطأ أثناء التحميل', 'error');
  }
};

// ================================================================
// Route Guard
// ================================================================
App.enforceRouteGuard = function () {
  let path = window.location.pathname.replace(/\\/g, '/');
  // Normalise clean URLs (no .html) to match PROTECTED_ROUTES keys
  if (!path.endsWith('.html') && CONSTANTS.PROTECTED_ROUTES[path + '.html'] !== undefined) {
    path = path + '.html';
  }
  const allowedRoles   = CONSTANTS.PROTECTED_ROUTES[path];
  if (!allowedRoles) return; // Public page

  if (!App.profile) {
    // Not logged in → go to login
    window.location.href = '/login.html?redirect=' + encodeURIComponent(path);
    return;
  }

  if (!allowedRoles.includes(App.profile.role)) {
    // Wrong role → go to their dashboard
    const dest = CONSTANTS.ROLE_DASHBOARDS[App.profile.role] || '/index.html';
    window.location.href = dest;
  }
};

// ================================================================
// Auth state listener — keeps App.user in sync across tabs
// ================================================================
AuthAPI.onAuthChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session?.user) {
    App.user    = session.user;
    App.profile = await getUserProfile();
  } else if (event === 'SIGNED_OUT') {
    App.user    = null;
    App.profile = null;
  }
});

// ================================================================
// Toast Notification System
// ================================================================
const Toast = {
  container: null,

  _getContainer() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      document.body.appendChild(this.container);
    }
    return this.container;
  },

  /**
   * Show a toast message.
   * @param {string} message
   * @param {'success'|'error'|'info'|'warning'} type
   * @param {number} [duration] ms
   */
  show(message, type = 'info', duration = 4000) {
    const container = this._getContainer();
    const toast     = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || '•'}</span>
      <span class="toast-message">${Helpers.escapeHtml(message)}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);
    // Animate in
    requestAnimationFrame(() => toast.classList.add('toast-visible'));

    // Auto-remove
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, duration);
  },

  success(msg)  { this.show(msg, 'success'); },
  error(msg)    { this.show(msg, 'error');   },
  info(msg)     { this.show(msg, 'info');    },
  warning(msg)  { this.show(msg, 'warning'); },
};

// ================================================================
// Modal System
// ================================================================
const Modal = {
  /**
   * Show a confirmation dialog.
   * @param {string} title
   * @param {string} message
   * @param {Object} [options] — { confirmText, cancelText, danger }
   * @returns {Promise<boolean>}
   */
  confirm(title, message, options = {}) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <h3 id="modal-title" class="modal-title">${Helpers.escapeHtml(title)}</h3>
          <p class="modal-body">${Helpers.escapeHtml(message)}</p>
          <div class="modal-actions">
            <button class="btn btn-ghost modal-cancel">
              ${options.cancelText || 'إلغاء'}
            </button>
            <button class="btn ${options.danger ? 'btn-danger' : 'btn-primary'} modal-confirm">
              ${options.confirmText || 'تأكيد'}
            </button>
          </div>
        </div>
      `;

      const close = val => { overlay.remove(); resolve(val); };
      overlay.querySelector('.modal-cancel').onclick  = () => close(false);
      overlay.querySelector('.modal-confirm').onclick = () => close(true);
      overlay.onclick = e => { if (e.target === overlay) close(false); };

      document.body.appendChild(overlay);
      overlay.querySelector('.modal-confirm').focus();
    });
  },

  /**
   * Show an inline loading spinner over a container.
   * @param {HTMLElement} el
   * @param {boolean} loading
   */
  setLoading(el, loading) {
    if (!el) return;
    el.classList.toggle('loading-container', loading);
  },
};

// ================================================================
// Global error handler for unhandled promise rejections
// ================================================================
window.addEventListener('unhandledrejection', event => {
  console.error('[Unhandled]', event.reason);
});
