function initClubPortalNav() {
  const nav = document.querySelector('.club-portal-nav');
  const current = nav?.querySelector('[aria-current="page"]');
  if (!nav || !current || nav.dataset.enhanced === 'true') return false;
  nav.dataset.enhanced = 'true';

  requestAnimationFrame(() => {
    current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });

  nav.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const links = Array.from(nav.querySelectorAll('a'));
    const index = links.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    links[(index + direction + links.length) % links.length].focus();
  });
  return true;
}

function bootClubPortalNav() {
  if (initClubPortalNav()) return;
  const observer = new MutationObserver(() => {
    if (initClubPortalNav()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 10000);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootClubPortalNav, { once: true });
else bootClubPortalNav();
