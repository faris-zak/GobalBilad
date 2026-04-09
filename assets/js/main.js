// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.error('Service Worker registration failed:', err));
  });
}

/**
 * Reads the Supabase session from localStorage without importing the full SDK.
 * Returns true if a valid (non-expired) token is found — lightweight check only.
 */
function getQuickSession() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const expiresAt = parsed?.expires_at;
      if (!expiresAt) continue;
      const nowSec = Math.floor(Date.now() / 1000);
      if (nowSec < Number(expiresAt)) return true;
    }
  } catch (_) {}
  return false;
}

async function enhanceAuthLinks() {
  // If auth.js is not loaded, do a quick localStorage check so login links
  // still update to "حسابي" on public pages for signed-in users.
  if (typeof checkSession !== 'function') {
    if (getQuickSession()) {
      document.querySelectorAll('a[href="login.html"], a[href="/login"], a[href="/login.html"]').forEach((link) => {
        link.href = '/account';
        link.textContent = 'حسابي';
      });
    }
    return;
  }

  try {
    const session = await checkSession();
    if (!session) {
      return;
    }

    const user = typeof getCurrentUser === 'function' ? await getCurrentUser() : null;
    const profile = user && typeof getUserProfile === 'function' ? await getUserProfile(user.id) : null;

    const loginLinks = document.querySelectorAll('a[href="login.html"], a[href="/login"], a[href="/login.html"]');
    loginLinks.forEach((link) => {
      link.href = '/account';
      link.textContent = 'حسابي';
    });

    if (profile?.role === 'admin' && profile?.account_status !== 'banned') {
      const nav = document.getElementById('siteNav');
      if (nav && !nav.querySelector('a[href="/admin"]')) {
        const adminLink = document.createElement('a');
        adminLink.href = '/admin';
        adminLink.textContent = 'لوحة الإدارة';
        nav.insertBefore(adminLink, nav.querySelector('.nav-cta-mobile'));
      }
    }

    if (profile?.role === 'trader' && profile?.account_status !== 'banned') {
      const nav = document.getElementById('siteNav');
      if (nav && !nav.querySelector('a[href="/trader"]')) {
        const traderLink = document.createElement('a');
        traderLink.href = '/trader';
        traderLink.textContent = 'لوحة التاجر';
        nav.insertBefore(traderLink, nav.querySelector('.nav-cta-mobile'));
      }
    }

    if (profile?.role === 'delivery' && profile?.account_status !== 'banned') {
      const nav = document.getElementById('siteNav');
      if (nav && !nav.querySelector('a[href="/driver"]')) {
        const driverLink = document.createElement('a');
        driverLink.href = '/driver';
        driverLink.textContent = 'لوحة المندوب';
        nav.insertBefore(driverLink, nav.querySelector('.nav-cta-mobile'));
      }
    }

    const canApplyForRole =
      profile?.account_status !== 'banned' &&
      profile?.role === 'user' &&
      (profile?.application_status === 'none' || profile?.application_status === 'rejected' || !profile?.application_status);

    document
      .querySelectorAll('a[href="apply-role.html"], a[href="/apply-role"], a[href="/apply-role.html"]')
      .forEach((link) => {
        if (!canApplyForRole) {
          link.remove();
          return;
        }
        link.href = '/apply-role';
      });
  } catch (err) {
    console.error('Auth link enhancement failed:', err);
  }
}

window.addEventListener('load', () => {
  enhanceAuthLinks();
  initRevealOnScroll();
  initContactForm();
});

let _globalToastTimer;

/**
 * Shows a transient popup toast notification.
 * @param {string} msg  - Text to display.
 * @param {'ok'|'err'|'warn'} [type='ok'] - Visual variant.
 * @param {number} [duration=3500] - Auto-dismiss delay in ms.
 */
window.showGlobalToast = function showGlobalToast(msg, type = 'ok', duration = 3500) {
  let toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.className = 'global-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }

  toast.textContent = msg;
  toast.className = `global-toast ${type}`;

  // Force reflow so the transition fires even when already visible
  void toast.offsetWidth;
  toast.classList.add('is-visible');

  clearTimeout(_globalToastTimer);
  _globalToastTimer = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, duration);
};

function initRevealOnScroll() {
  const revealItems = document.querySelectorAll('.reveal');
  if (!revealItems.length || typeof IntersectionObserver === 'undefined') {
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14 });

  revealItems.forEach((item) => observer.observe(item));
}

function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) {
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');

  async function submitContactForm(payload) {
    const response = await fetch('/api/contact-messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'تعذر إرسال الرسالة الآن.');
    }

    return data;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
    }

    const formData = new FormData(form);

    try {
      await submitContactForm({
        name: formData.get('name'),
        email: formData.get('email') || '',
        phone: formData.get('phone'),
        requestType: formData.get('requestType'),
        message: formData.get('message')
      });

      window.showGlobalToast('تم إرسال رسالتك بنجاح', 'ok');
      form.reset();
    } catch (error) {
      window.showGlobalToast(error.message || 'تعذر إرسال الرسالة حالياً. حاول مرة أخرى.', 'err');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
      }
    }
  });
}
