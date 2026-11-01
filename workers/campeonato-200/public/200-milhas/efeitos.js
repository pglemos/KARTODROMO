'use strict';
/* Animações da página da prova: mesmo motor do canvas. */
if (!/^\/200-milhas\/inscricao\//.test(location.pathname)) {
class DCLogic { forceUpdate() { const s = Math.max(0, Math.floor((Date.parse('2027-01-30T08:00:00-03:00') - Date.now()) / 1000)), p = (n) => String(n).padStart(2, '0'), el = document.querySelector('#falta'); if (el) el.textContent = `${Math.floor(s / 86400)}D ${p(Math.floor(s / 3600) % 24)}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`; } }
class Component extends DCLogic {
  componentDidMount() {
    this.t = setInterval(() => this.forceUpdate(), 1000);
    const q = (s) => document.querySelector(s), todos = (s) => [...document.querySelectorAll(s)];
    const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // teste de largada: funciona mesmo sem animações
    const bt = q('#botaoReage'), sai = q('#saidaReage'), rl = todos('#semaforo .rl');
    if (bt) {
      let fase = 'parado', tOff = 0, melhor = Infinity; this.tj = [];
      const pinta = (n) => rl.forEach((l, i) => { const on = i < n; l.style.background = on ? '#ff2d2d' : '#1a0606'; l.style.boxShadow = on ? '0 0 34px #ff2d2d' : 'none'; });
      const limpa = () => { this.tj.forEach(clearTimeout); this.tj = []; };
      bt.addEventListener('click', () => {
        if (fase === 'parado') {
          fase = 'luzes'; pinta(0); sai.textContent = ''; bt.textContent = 'Espere as luzes…';
          rl.forEach((_, i) => this.tj.push(setTimeout(() => pinta(i + 1), 500 + i * 800)));
          this.tj.push(setTimeout(() => { pinta(0); fase = 'valendo'; tOff = performance.now(); bt.textContent = 'Acelera!'; bt.style.background = '#fff'; }, 500 + 4 * 800 + 400 + Math.random() * 2400));
        } else if (fase === 'luzes') {
          limpa(); fase = 'parado'; pinta(5); bt.textContent = 'Tentar de novo'; sai.textContent = 'Largada queimada! No regulamento, isso custa 15 segundos.'; navigator.vibrate?.(200);
        } else if (fase === 'valendo') {
          const ms = Math.round(performance.now() - tOff); melhor = Math.min(melhor, ms); fase = 'parado'; bt.style.background = ''; bt.textContent = 'Tentar de novo'; navigator.vibrate?.(30);
          sai.textContent = `${ms} ms. Seu melhor: ${melhor} ms. ${ms < 100 ? 'Rápido demais: isso foi chute.' : ms < 250 ? 'Sua equipe quer você na largada.' : ms < 400 ? 'Boa largada.' : 'O grid já foi embora.'}`;
        }
      });
    }
    if (calmo) return;
    if (document.scrollingElement.scrollHeight <= innerHeight + 50) return;
    // revela só o que está fora da tela; sem rolagem possível (canvas) tudo segue visível
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { (e.target.__rev || [e.target]).forEach((x) => x.classList.remove('oculto')); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    todos('.rev').forEach((el, i) => { if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('oculto'); el.style.transitionDelay = (i % 3) * 70 + 'ms'; const alvo = el.matches('h2') ? el.parentElement : el; if (alvo !== el) (alvo.__rev = alvo.__rev || [alvo]).push(el); io.observe(alvo); } });
    this.io = io;
    const lim = (v) => Math.max(0, Math.min(1, v));
    const prog = (el) => { const r = el.getBoundingClientRect(); return lim((innerHeight - r.top) / (innerHeight + r.height)); };
    let pedido = false, precoFeito = false, yAnt = scrollY, tAnt = performance.now(), v = 0;
    const leds = todos('#leds .led'), caixaLeds = q('#leds'), linhas = q('#linhas'), faixas = todos('[data-faixa]'), setores = todos('.setor');
    const marcos = ['#box', '#dia', '#vaga'];
    const fmt = (m) => `${Math.floor(m / 60)}:${String(Math.floor(m) % 60).padStart(2, '0')}:${String(Math.floor(m * 60) % 60).padStart(2, '0')}`;
    const decai = () => { if (v > .01) { v *= .86; linhas.style.setProperty('--v', v); requestAnimationFrame(decai); } else linhas.style.setProperty('--v', 0); };
    const quadro = () => {
      pedido = false;
      const raiz = document.scrollingElement, max = raiz.scrollHeight - innerHeight;
      const barra = q('#barra'); if (barra) barra.style.transform = `scaleX(${max > 0 ? lim(raiz.scrollTop / max) : 0})`;
      q('#topoH')?.classList.toggle('rolou', raiz.scrollTop > 40);
      const pr = max > 0 ? lim(raiz.scrollTop / max) : 0, agora = performance.now(), dv = Math.abs(raiz.scrollTop - yAnt) / Math.max(8, agora - tAnt);
      const parado = v <= .01; v = Math.min(.9, Math.max(v, dv / 5)); yAnt = raiz.scrollTop; tAnt = agora; linhas.style.setProperty('--v', v); if (parado) requestAnimationFrame(decai);
      const acesos = Math.round(pr * leds.length); leds.forEach((l, i) => l.classList.toggle('on', i < acesos)); caixaLeds.classList.toggle('topo', acesos === leds.length);
      const hudEl = q('.hud'); if (hudEl) { const f = q('#inscricao')?.getBoundingClientRect(); hudEl.style.opacity = raiz.scrollTop > 620 && !(f && f.top < innerHeight && f.bottom > 0) ? 1 : 0; }
      const min = pr * 300; q('#hudTempo').textContent = pr >= .995 ? 'BANDEIRADA' : fmt(min);
      const box = q('#hudBox'), aberto = min >= 10 && min <= 280; box.textContent = aberto ? 'ABERTO' : 'FECHADO'; box.style.color = aberto ? '#00E676' : '#ff6b6b';
      setores.forEach((el, i) => { const t = q(marcos[i])?.getBoundingClientRect().top ?? 1e9; el.classList.toggle('ok', t < innerHeight * .5); el.classList.toggle('melhor', i === 2 && t < innerHeight * .5); });
      faixas.forEach((f) => { f.style.transform = `translateX(${Number(f.dataset.faixa) > 0 ? -((raiz.scrollTop * .35) % 1600) : -1600 + ((raiz.scrollTop * .35) % 1600)}px)`; });
      const heroi = q('#fotoHero'); if (heroi && raiz.scrollTop < 1000) { heroi.style.animation = 'none'; heroi.style.transform = `translateY(${raiz.scrollTop * .28}px) scale(${1 + raiz.scrollTop * .00018})`; }
      todos('[data-par]').forEach((el) => { el.style.transform = `translateY(${(prog(el) - .5) * -Number(el.dataset.par)}px) scale(1.14)`; });
      const pista = q('#pista'), aero = q('#aero');
      if (pista && aero) { const r = pista.getBoundingClientRect(), p = lim(-r.top / Math.max(1, r.height - (q('#fixa')?.offsetHeight || 800))); aero.style.objectPosition = `50% ${10 + p * 46}%`; aero.style.transform = `scale(${1.1 - p * .1})`; }
      const sol = q('#sol'); if (sol) { const p = lim(prog(sol.parentElement) * 1.8); sol.style.transform = `scale(${1.25 - p * .25})`; sol.style.filter = `saturate(${.6 + p * .4}) brightness(${.6 + p * .4})`; }
      const abre = q('#abre'); if (abre) { const p = lim(prog(abre) * 2.2); abre.style.clipPath = `inset(${4 * (1 - p)}% ${5 * (1 - p)}%)`; }
      const preco = q('#preco');
      if (preco && !precoFeito && preco.getBoundingClientRect().top < innerHeight * .8) {
        precoFeito = true; const ini = performance.now();
        const conta = (t) => { const f = lim((t - ini) / 800), v = f >= 1 ? 2800 : Math.round(2800 * (1 - Math.pow(1 - f, 3)) / 10) * 10; preco.textContent = 'R$ ' + v.toLocaleString('pt-BR'); if (f < 1) requestAnimationFrame(conta); };
        requestAnimationFrame(conta);
      }
    };
    this.rolar = () => { if (!pedido) { pedido = true; requestAnimationFrame(quadro); } };
    const luzCursor = q('#luzCursor');
    this.mover = (e) => { if (luzCursor) luzCursor.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; };
    addEventListener('pointermove', this.mover, { passive: true });
    if (matchMedia('(hover:hover)').matches) {
      todos('.card3').forEach((c) => { c.addEventListener('pointermove', (e) => { const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; c.style.transitionDelay = '0ms'; c.style.transform = `perspective(700px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateY(-6px)`; }); c.addEventListener('pointerleave', () => { c.style.transform = ''; }); });
      todos('.magnet').forEach((a) => { a.addEventListener('pointermove', (e) => { const r = a.getBoundingClientRect(); a.style.translate = `${(e.clientX - r.left - r.width / 2) * .12}px ${(e.clientY - r.top - r.height / 2) * .22}px`; }); a.addEventListener('pointerleave', () => { a.style.translate = ''; }); });
    }
    addEventListener('scroll', this.rolar, { passive: true }); addEventListener('resize', this.rolar); quadro();
    // luzes acendem uma a uma, apagam juntas e a tela reage: é a largada
    const luzes = todos('#luzes span');
    const ciclo = () => {
      luzes.forEach((l, i) => { l.style.animation = 'none'; l.style.opacity = .12; setTimeout(() => { l.style.opacity = 1; }, 500 + i * 550); });
      this.ap = setTimeout(() => { luzes.forEach((l) => { l.style.opacity = .12; }); const f = q('#flash'); if (f) { f.classList.remove('largou'); void f.offsetWidth; f.classList.add('largou'); } }, 500 + 5 * 550 + 700);
    };
    ciclo(); this.ci = setInterval(ciclo, 7000);
  }
  componentWillUnmount() { clearInterval(this.t); clearInterval(this.ci); clearTimeout(this.ap); this.io?.disconnect(); removeEventListener('scroll', this.rolar); removeEventListener('resize', this.rolar); removeEventListener('pointermove', this.mover); (this.tj || []).forEach(clearTimeout); }
}
const pagina = new Component(); pagina.forceUpdate(); pagina.componentDidMount();
}
