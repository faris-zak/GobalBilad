// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.error('Service Worker registration failed:', err));
  });
}

async function enhanceAuthLinks() {
  if (typeof checkSession !== 'function') {
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
  } catch (err) {
    console.error('Auth link enhancement failed:', err);
  }
}

window.addEventListener('load', () => {
  enhanceAuthLinks();
  initRevealOnScroll();
  initContactForm();
});

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

  const successMessage = document.getElementById('successMessage');
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

    if (successMessage) {
      successMessage.classList.remove('show', 'is-error');
      successMessage.textContent = '';
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

      if (successMessage) {
        successMessage.textContent = 'تم إرسال رسالتك بنجاح';
        successMessage.classList.add('show');
      }

      form.reset();
    } catch (error) {
      if (successMessage) {
        successMessage.textContent = error.message || 'تعذر إرسال الرسالة حالياً. حاول مرة أخرى.';
        successMessage.classList.add('show', 'is-error');
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
      }
    }
  });
}
