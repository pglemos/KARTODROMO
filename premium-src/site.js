(() => {
  'use strict';

  const body = document.body;
  const header = document.querySelector('.header');
  const progress = document.getElementById('progress');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const updateScroll = () => {
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    header?.classList.toggle('scrolled', y > 24);
    if (progress) {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      progress.style.transform = `scaleX(${Math.min(1, y / max)})`;
    }
  };
  updateScroll();
  window.addEventListener('scroll', updateScroll, { passive: true });
  window.addEventListener('resize', updateScroll, { passive: true });

  const focusableSelector = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])',
    'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  const trapFocus = (container, event) => {
    if (event.key !== 'Tab') return;
    const items = [...container.querySelectorAll(focusableSelector)].filter((el) => !el.hidden);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const menuButton = document.querySelector('.menu-toggle');
  const mobileNav = document.querySelector('.mobile-nav');
  let menuPreviousFocus = null;

  const setMenu = (open) => {
    if (!menuButton || !mobileNav) return;
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    mobileNav.classList.toggle('open', open);
    mobileNav.setAttribute('aria-hidden', String(!open));
    body.classList.toggle('menu-open', open);
    if (open) {
      menuPreviousFocus = document.activeElement;
      mobileNav.querySelector('a')?.focus();
    } else if (menuPreviousFocus instanceof HTMLElement) {
      menuPreviousFocus.focus();
    }
  };

  menuButton?.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
  mobileNav?.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenu(false);
  });
  mobileNav?.addEventListener('keydown', (event) => trapFocus(mobileNav, event));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') setMenu(false);
  });

  const reveals = [...document.querySelectorAll('.reveal')];
  if (reducedMotion || !('IntersectionObserver' in window)) {
    reveals.forEach((element) => element.classList.add('visible'));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .12 });
    reveals.forEach((element) => observer.observe(element));
  }

  const animateCounter = (element) => {
    const target = Number(element.dataset.count || 0);
    const suffix = element.dataset.suffix || '';
    if (!Number.isFinite(target)) return;
    if (reducedMotion) {
      element.textContent = `${target}${suffix}`;
      return;
    }
    const duration = 1100;
    const start = performance.now();
    const frame = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      element.textContent = `${Math.round(target * eased)}${suffix}`;
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };

  const counters = [...document.querySelectorAll('[data-count]')];
  if ('IntersectionObserver' in window && !reducedMotion) {
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: .6 });
    counters.forEach((counter) => counterObserver.observe(counter));
  } else {
    counters.forEach(animateCounter);
  }

  const trackPaths = {
    normal: 'M110 360 C160 110 370 80 480 210 C590 350 760 100 880 170 C1010 245 930 470 760 460 C600 450 560 600 380 540 C230 490 40 560 110 360',
    invertido: 'M122 348 C55 545 246 510 392 562 C570 625 610 458 766 474 C950 493 1020 260 884 184 C758 114 598 358 478 222 C372 102 170 112 122 348',
    chicane: 'M110 360 C160 110 370 80 480 210 C530 270 545 312 515 350 C485 386 565 392 610 350 C680 282 784 112 880 170 C1010 245 930 470 760 460 C600 450 560 600 380 540 C230 490 40 560 110 360'
  };
  document.querySelectorAll('.track-tab').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.track-tab').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      const path = trackPaths[button.dataset.track];
      if (!path) return;
      document.getElementById('track-path')?.setAttribute('d', path);
      document.getElementById('track-green')?.setAttribute('d', path);
    });
  });

  document.querySelectorAll('.faq-q').forEach((button, index) => {
    const item = button.closest('.faq-item');
    const answer = item?.querySelector('.faq-a');
    const answerId = answer?.id || `faq-answer-${index + 1}`;
    if (answer) answer.id = answerId;
    button.setAttribute('aria-controls', answerId);
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!open));
      item?.classList.toggle('open', !open);
      answer?.setAttribute('aria-hidden', String(open));
    });
  });

  document.querySelectorAll('.faq-filter').forEach((filter) => {
    filter.addEventListener('click', () => {
      document.querySelectorAll('.faq-filter').forEach((button) => button.classList.remove('active'));
      filter.classList.add('active');
      const category = filter.dataset.cat || 'all';
      document.querySelectorAll('.faq-item').forEach((item) => {
        item.classList.toggle('hidden', category !== 'all' && item.dataset.cat !== category);
      });
    });
  });

  const modal = document.querySelector('.modal');
  const modalPanel = modal?.querySelector('.modal-panel');
  const closeButton = modal?.querySelector('.modal-close');
  let modalPreviousFocus = null;

  const setModal = (open) => {
    if (!modal || !modalPanel) return;
    modal.classList.toggle('open', open);
    modal.setAttribute('aria-hidden', String(!open));
    body.classList.toggle('modal-open', open);
    if (open) {
      modalPreviousFocus = document.activeElement;
      setTimeout(() => modal.querySelector('input, select, textarea, button')?.focus(), 0);
    } else if (modalPreviousFocus instanceof HTMLElement) {
      modalPreviousFocus.focus();
    }
  };

  document.querySelectorAll('[data-modal-open]').forEach((button) => button.addEventListener('click', () => setModal(true)));
  closeButton?.addEventListener('click', () => setModal(false));
  modal?.addEventListener('mousedown', (event) => {
    if (event.target === modal) setModal(false);
  });
  modalPanel?.addEventListener('keydown', (event) => trapFocus(modalPanel, event));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal?.classList.contains('open')) setModal(false);
  });

  const form = document.querySelector('[data-lead-form]');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const type = String(data.get('type') || '').trim();
    const people = String(data.get('people') || '').trim();
    const date = String(data.get('date') || '').trim();
    const notes = String(data.get('notes') || '').trim();
    const message = [
      'Olá! Quero organizar uma experiência no Kartódromo Internacional de Betim.',
      name && `Nome: ${name}`,
      type && `Tipo: ${type}`,
      people && `Pessoas: ${people}`,
      date && `Data pretendida: ${date}`,
      notes && `Observações: ${notes}`
    ].filter(Boolean).join('\n');
    window.open(`https://wa.me/5531998842898?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    setModal(false);
  });
})();
