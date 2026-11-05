(() => {
  'use strict';

  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const header = $('.header');
  const progress = $('#progress');
  const wipe = $('.page-wipe');
  const parallaxItems = $$('.parallax');
  let scrollFrame = 0;

  const updateScrollEffects = () => {
    scrollFrame = 0;
    const scroller = document.scrollingElement || document.documentElement;
    const y = scroller.scrollTop;
    const max = Math.max(0, scroller.scrollHeight - window.innerHeight);

    header?.classList.toggle('scrolled', y > 24);
    if (progress) progress.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;

    if (!reducedMotion && window.innerWidth > 760) {
      parallaxItems.forEach((element) => {
        const speed = Number(element.dataset.speed || 0.08);
        const offset = (y - element.offsetTop) * speed;
        element.style.transform = `translate3d(0, ${offset}px, 0)`;
      });
    }
  };

  const requestScrollUpdate = () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollEffects);
  };

  addEventListener('scroll', requestScrollUpdate, { passive: true });
  addEventListener('resize', requestScrollUpdate, { passive: true });
  updateScrollEffects();

  // Mobile navigation
  const menuToggle = $('.menu-toggle');
  const mobileNavigation = $('.mobile-nav');

  const setMenuState = (open) => {
    if (!menuToggle || !mobileNavigation) return;
    menuToggle.classList.toggle('open', open);
    mobileNavigation.classList.toggle('open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    mobileNavigation.inert = !open;
    mobileNavigation.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('menu-open', open);
    if (open) mobileNavigation.querySelector('a')?.focus({ preventScroll: true });
  };

  menuToggle?.addEventListener('click', () => {
    setMenuState(menuToggle.getAttribute('aria-expanded') !== 'true');
  });
  mobileNavigation && $$('a', mobileNavigation).forEach((link) => link.addEventListener('click', () => setMenuState(false)));

  // Progressive enhancement: content remains visible if JavaScript fails.
  const revealItems = $$('.reveal');
  if (!reducedMotion && 'IntersectionObserver' in window) {
    revealItems.forEach((element) => element.classList.add('reveal-pending'));
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
    revealItems.forEach((element) => revealObserver.observe(element));
  } else {
    revealItems.forEach((element) => element.classList.add('in'));
  }

  // Count-up numbers preserve their final value when JS is unavailable.
  const countItems = $$('[data-count]');
  if (!reducedMotion && 'IntersectionObserver' in window) {
    const countObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const element = entry.target;
        const target = Number(element.dataset.count || 0);
        const suffix = element.dataset.suffix || '';
        const prefix = element.dataset.prefix || '';
        const duration = 1350;
        const startTime = performance.now();
        element.textContent = `${prefix}0${suffix}`;

        const tick = (time) => {
          const progressValue = Math.min(1, (time - startTime) / duration);
          const eased = 1 - Math.pow(1 - progressValue, 3);
          const value = Math.round(target * eased);
          element.textContent = `${prefix}${value.toLocaleString('pt-BR')}${suffix}`;
          if (progressValue < 1) requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
        countObserver.unobserve(element);
      });
    }, { threshold: 0.45 });
    countItems.forEach((element) => countObserver.observe(element));
  }

  // Cinematic transition for internal HTML pages.
  $$('a[href]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      if (!href || !href.endsWith('.html') || link.target === '_blank' || link.hasAttribute('download')) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

      const targetUrl = new URL(link.href, location.href);
      if (!['http:', 'https:', 'file:'].includes(targetUrl.protocol)) return;
      if (location.protocol !== 'file:' && targetUrl.origin !== location.origin) return;

      event.preventDefault();
      if (!wipe || reducedMotion) {
        location.href = link.href;
        return;
      }
      wipe.classList.remove('go');
      void wipe.offsetWidth;
      wipe.classList.add('go');
      setTimeout(() => { location.href = link.href; }, 320);
    });
  });
  addEventListener('pageshow', () => wipe?.classList.remove('go'));

  // FAQ accordion and filters.
  $$('.faq-q').forEach((question) => {
    question.addEventListener('click', () => {
      const item = question.closest('.faq-item');
      const answer = item?.querySelector('.faq-a');
      const open = !item?.classList.contains('open');
      item?.classList.toggle('open', open);
      question.setAttribute('aria-expanded', String(open));
      answer?.setAttribute('aria-hidden', String(!open));
    });
  });

  $$('.faq-filter').forEach((button) => {
    button.addEventListener('click', () => {
      const category = button.dataset.cat;
      $$('.faq-filter').forEach((item) => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      $$('.faq-item').forEach((item) => {
        const visible = category === 'all' || item.dataset.cat === category;
        item.hidden = !visible;
      });
    });
  });

  // Interactive track map.
  const tracks = {
    normal: 'M110 360 C160 110 370 80 480 210 C590 350 760 100 880 170 C1010 245 930 470 760 460 C600 450 560 600 380 540 C230 490 40 560 110 360',
    invertido: 'M870 420 C790 590 560 580 490 430 C420 280 250 520 120 430 C-10 340 100 130 280 150 C460 170 470 20 660 80 C850 140 970 230 870 420',
    chicane: 'M90 370 C150 120 340 90 450 210 C520 285 610 220 650 150 L730 250 L820 120 C980 170 1010 390 850 470 C720 540 560 420 460 520 C330 650 60 560 90 370'
  };
  const trackPath = $('#track-path');
  const trackGreen = $('#track-green');
  $$('.track-tab').forEach((button) => {
    button.addEventListener('click', () => {
      $$('.track-tab').forEach((item) => {
        const selected = item === button;
        item.classList.toggle('active', selected);
        item.setAttribute('aria-selected', String(selected));
      });
      const pathValue = tracks[button.dataset.track] || tracks.normal;
      trackPath?.setAttribute('d', pathValue);
      trackGreen?.setAttribute('d', pathValue);
    });
  });

  // Modal with focus restoration and keyboard support.
  const modal = $('.modal');
  const modalDialog = $('.modal-dialog');
  const modalOpeners = $$('[data-modal-open]');
  let modalTrigger = null;

  const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const setModalState = (open, trigger = null) => {
    if (!modal) return;
    if (open) modalTrigger = trigger || document.activeElement;
    modal.classList.toggle('open', open);
    modal.inert = !open;
    modal.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('modal-open', open);
    if (open) {
      requestAnimationFrame(() => $('.modal-close', modal)?.focus({ preventScroll: true }));
    } else if (modalTrigger instanceof HTMLElement) {
      modalTrigger.focus({ preventScroll: true });
      modalTrigger = null;
    }
  };

  modalOpeners.forEach((button) => button.addEventListener('click', () => setModalState(true, button)));
  $$('[data-modal-close]').forEach((button) => button.addEventListener('click', () => setModalState(false)));
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) setModalState(false);
  });
  modalDialog?.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusable = $$(focusableSelector, modalDialog).filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (modal?.classList.contains('open')) setModalState(false);
    if (mobileNavigation?.classList.contains('open')) setMenuState(false);
  });

  // WhatsApp lead form.
  const form = $('#lead-form');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const message = [
      'Olá! Quero organizar um evento no Kartódromo de Betim.',
      '',
      `Nome: ${data.get('nome') || ''}`,
      `Tipo: ${data.get('tipo') || ''}`,
      `Pessoas: ${data.get('pessoas') || ''}`,
      `Data: ${data.get('data') || ''}`,
      `Mensagem: ${data.get('mensagem') || ''}`
    ].join('\n');
    const url = `https://wa.me/5531998842898?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  });
})();
