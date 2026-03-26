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

    const loginLinks = document.querySelectorAll('a[href="login.html"], a[href="/login"], a[href="/login.html"]');
    loginLinks.forEach((link) => {
      link.href = '/account';
      link.textContent = 'حسابي';
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

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
    }

    if (successMessage) {
      successMessage.classList.add('show');
    }

    form.reset();

    setTimeout(() => {
      if (submitBtn) {
        submitBtn.disabled = false;
      }
    }, 600);
  });
}
