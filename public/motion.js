// Shared page-motion helper: scroll-reveal, count-up numbers, scroll-spy nav, scroll progress bar.
// Imported via dynamic import('./motion.js') from each page's DCLogic componentDidMount.

function setupReveal() {
  const nodes = Array.from(document.querySelectorAll('[data-reveal]'));
  if (!nodes.length) return () => {};

  if (!('IntersectionObserver' in window)) {
    nodes.forEach((node) => {
      node.style.opacity = '1';
      node.style.transform = 'none';
    });
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translate3d(0,0,0) scale(1)';
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14, rootMargin: '0px 0px -8% 0px' },
  );
  nodes.forEach((node) => observer.observe(node));
  return () => observer.disconnect();
}

function animateCount(node) {
  const target = parseFloat(node.getAttribute('data-countup'));
  if (Number.isNaN(target)) return;
  const prefix = node.getAttribute('data-countup-prefix') || '';
  const suffix = node.getAttribute('data-countup-suffix') || '';
  const thousands = node.hasAttribute('data-countup-thousands');
  const decimals = parseInt(node.getAttribute('data-countup-decimals') || '0', 10);
  const duration = 1100;
  const start = performance.now();

  const tick = (now) => {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const value = target * eased;
    let formatted = decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
    if (thousands) formatted = Number(formatted).toLocaleString('pt-BR');
    node.textContent = prefix + formatted + suffix;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function setupCountUp() {
  const nodes = Array.from(document.querySelectorAll('[data-countup]'));
  if (!nodes.length) return () => {};

  if (!('IntersectionObserver' in window)) {
    nodes.forEach(animateCount);
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 },
  );
  nodes.forEach((node) => observer.observe(node));
  return () => observer.disconnect();
}

function setupScrollSpy(config) {
  if (!config || !config.sectionIds || !config.onChange) return () => {};
  const nodes = config.sectionIds.map((id) => document.getElementById(id)).filter(Boolean);
  if (!nodes.length) return () => {};

  const update = () => {
    const anchorOffset = window.innerWidth < 768 ? 190 : 170;
    const current = [...nodes].reverse().find((node) => node.offsetTop <= window.scrollY + anchorOffset);
    if (current) config.onChange(current.id);
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
  return () => window.removeEventListener('scroll', update);
}

function setupProgressBar(selector) {
  if (!selector) return () => {};
  const bar = document.querySelector(selector);
  if (!bar) return () => {};

  const update = () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = h > 0 ? Math.min(Math.max(window.scrollY / h, 0), 1) : 0;
    bar.style.transform = 'scaleX(' + ratio + ')';
  };
  update();
  window.addEventListener('scroll', update, { passive: true });
  return () => window.removeEventListener('scroll', update);
}

export function initPageMotion(options) {
  const opts = options || {};
  const cleanups = [
    setupReveal(),
    setupCountUp(),
    setupScrollSpy(opts.scrollSpy),
    setupProgressBar(opts.progressBarSelector),
  ];
  return () => cleanups.forEach((fn) => fn && fn());
}
