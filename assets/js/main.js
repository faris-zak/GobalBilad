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
});
