import { cp, mkdir, readFile, rm, writeFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const output = resolve(process.argv[2] || join(root, 'premium-dist'));
const source = join(root, 'premium-src');
const publicDir = join(root, 'public');

const SITE = 'https://kartodromodebetim.com.br';
const BOOKING = 'https://tools.mylaptime.com.br/booking?uid=5729bbc1-572b-4e32-84ec-e9e93ab08ced';
const WHATSAPP = 'https://wa.me/5531998842898';

const routes = [
  ['/', 'index.html'],
  ['/pista', 'pista.html'],
  ['/kart-locacao', 'kart-locacao.html'],
  ['/campeonatos', 'campeonatos.html'],
  ['/eventos', 'eventos.html'],
  ['/duvidas', 'duvidas.html'],
  ['/kac', 'kac.html'],
  ['/kac-super', 'kac-super.html'],
  ['/200-milhas', '200-milhas.html'],
  ['/500-milhas', '500-milhas.html'],
];

const arrow = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>`;
const whatsappIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-11.9 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z"/><path d="M8.5 8.5c.5 3 2 4.5 5 5"/></svg>`;
const clockIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2M9 2h6"/></svg>`;
const mapIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15"/></svg>`;
const groupIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
const flagIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4m0 1c5-3 9 3 14 0v9c-5 3-9-3-14 0"/></svg>`;
const boltIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>`;
const trophyIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4ZM7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"/></svg>`;

const navItems = [
  ['home', '/', 'Home'],
  ['pista', '/pista', 'A pista'],
  ['locacao', '/kart-locacao', 'Locação'],
  ['campeonatos', '/campeonatos', 'Campeonatos'],
  ['eventos', '/eventos', 'Eventos'],
  ['duvidas', '/duvidas', 'Dúvidas'],
];

function nav(active, mobile = false) {
  return navItems.map(([key, href, label]) => `<a${key === active ? ' class="active" aria-current="page"' : ''} href="${href}">${label}</a>`).join('');
}

function header(active) {
  return `<header class="header"><div class="container"><div class="header-inner">
    <a class="brand" href="/" aria-label="Kartódromo Internacional de Betim, início"><img src="/assets/brand/kib-logo.png" alt="Kartódromo Internacional de Betim"></a>
    <nav class="nav" aria-label="Navegação principal">${nav(active)}</nav>
    <a class="btn btn-primary btn-small header-cta" href="${BOOKING}" target="_blank" rel="noopener noreferrer">Reservar agora ${arrow}</a>
    <button class="menu-toggle" type="button" aria-label="Abrir menu" aria-controls="mobile-navigation" aria-expanded="false"><span></span><span></span><span></span></button>
  </div></div></header>
  <nav class="mobile-nav" id="mobile-navigation" aria-label="Navegação móvel" aria-hidden="true">${nav(active, true)}<a class="btn btn-primary" href="${BOOKING}" target="_blank" rel="noopener noreferrer">Reservar agora</a></nav>`;
}

function footer() {
  return `<footer class="footer"><div class="container"><div class="footer-grid">
    <div><a class="footer-brand" href="/"><img src="/assets/brand/kib-logo.png" alt="Kartódromo Internacional de Betim"></a><p>Pista homologada de 1.110 metros, kart de locação, campeonatos e estrutura para aniversários, grupos e empresas em Betim.</p></div>
    <div><h4>Navegar</h4><div class="footer-links"><a href="/pista">A pista</a><a href="/kart-locacao">Kart de locação</a><a href="/campeonatos">Campeonatos</a><a href="/eventos">Eventos</a><a href="/duvidas">Dúvidas</a></div></div>
    <div><h4>Contato</h4><div class="footer-links"><a href="tel:+553135112373">(31) 3511-2373</a><a href="${WHATSAPP}" target="_blank" rel="noopener noreferrer">(31) 99884-2898</a><a href="mailto:contato@kartodromodebetim.com.br">contato@kartodromodebetim.com.br</a><span>Av. Adutora Várzea das Flores, 477<br>Itacolomi, Betim/MG</span></div></div>
  </div><div class="copyright"><span>© 2026 Kartódromo Internacional de Betim</span><span>Experiência editorial de automobilismo</span></div></div></footer>
  <a class="whatsapp-float" href="${WHATSAPP}" target="_blank" rel="noopener noreferrer" aria-label="Abrir WhatsApp">${whatsappIcon}</a>
  <div class="mobile-sticky"><a class="btn btn-primary" href="${BOOKING}" target="_blank" rel="noopener noreferrer">Reservar</a><a class="btn btn-outline" href="${WHATSAPP}" target="_blank" rel="noopener noreferrer">WhatsApp</a></div>`;
}

function modal() {
  return `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="lead-title" aria-hidden="true"><div class="modal-panel"><div class="modal-head"><div><p class="eyebrow">Monte sua experiência</p><h2 id="lead-title">Solicitar proposta</h2></div><button class="modal-close" type="button" aria-label="Fechar">×</button></div>
    <form data-lead-form><div class="form-grid">
      <div class="form-field"><label for="lead-name">Nome</label><input id="lead-name" name="name" autocomplete="name" required></div>
      <div class="form-field"><label for="lead-type">Tipo</label><select id="lead-type" name="type" required><option value="">Selecione</option><option>Aniversário</option><option>Grupo de amigos</option><option>Evento corporativo</option><option>Campeonato</option></select></div>
      <div class="form-field"><label for="lead-people">Quantidade de pessoas</label><input id="lead-people" name="people" inputmode="numeric"></div>
      <div class="form-field"><label for="lead-date">Data pretendida</label><input id="lead-date" name="date" type="date"></div>
      <div class="form-field full"><label for="lead-notes">Observações</label><textarea id="lead-notes" name="notes"></textarea></div>
    </div><div class="form-actions"><button class="btn btn-outline modal-close" type="button">Cancelar</button><button class="btn btn-primary" type="submit">Continuar no WhatsApp ${arrow}</button></div></form>
  </div></div>`;
}

function media({ image = '/assets/posters/home-karting.jpg', video = true, position = 'center' } = {}) {
  return `<div class="hero-media">${video ? `<video autoplay muted loop playsinline preload="metadata" poster="${image}" style="object-position:${position}"><source src="/assets/videos/home-karting.mp4" type="video/mp4"></video>` : `<img src="${image}" alt="" style="object-position:${position}">`}</div><div class="hero-grid-lines" aria-hidden="true"></div><div class="speed-lines" aria-hidden="true"><i></i><i></i><i></i></div>`;
}

function telemetry(items) {
  return `<div class="telemetry-wrap"><div class="container"><div class="telemetry">${items.map(({ icon, title, text }) => `<div class="telemetry-item"><div class="telemetry-icon">${icon}</div><div><strong>${title}</strong><span>${text}</span></div></div>`).join('')}</div></div></div>`;
}

function bigCta(title, text, primary = 'Reservar corrida') {
  return `<section class="section"><div class="container"><div class="big-cta reveal"><div><h2>${title}</h2><p>${text}</p></div><div class="big-cta-actions"><a class="btn btn-primary" href="${BOOKING}" target="_blank" rel="noopener noreferrer">${primary} ${arrow}</a><a class="btn btn-outline" href="${WHATSAPP}" target="_blank" rel="noopener noreferrer">${whatsappIcon} Falar no WhatsApp</a></div></div></div></section>`;
}

function page({ filename, route, title, description, active, content, modalEnabled = false }) {
  const canonical = `${SITE}${route === '/' ? '/' : route}`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#030504"><meta name="color-scheme" content="dark"><title>${title}</title><meta name="description" content="${description}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE}/assets/posters/home-karting.jpg"><link rel="icon" type="image/png" href="/assets/brand/kib-logo.png"><link rel="stylesheet" href="/assets/css/site.css"></head><body><a class="skip-link" href="#conteudo">Pular para o conteúdo</a><div class="noise" aria-hidden="true"></div><div id="progress" aria-hidden="true"></div>${header(active)}<main id="conteudo">${content}</main>${footer()}${modalEnabled ? modal() : ''}<script src="/assets/js/site.js" defer></script></body></html>`;
}

function home() {
  const content = `<section class="hero">${media()}<div class="container hero-content"><div class="hero-copy"><p class="eyebrow">A comemoração mais rápida de Betim</p><h1 class="hero-title"><span>Aniversário no</span><br><span class="huge">Kart</span><br><span>mais incrível</span><br><span>de Betim</span></h1><p class="hero-sub">Transforme aniversários e encontros de amigos em uma disputa cinematográfica, com kart, cronometragem, pódio e estrutura completa.</p><div class="actions"><button class="btn btn-primary" type="button" data-modal-open>Reservar meu grupo ${arrow}</button><a class="btn btn-outline" href="${WHATSAPP}" target="_blank" rel="noopener noreferrer">${whatsappIcon} Falar no WhatsApp</a></div><div class="hero-facts"><div><strong>1.110m</strong><span>Pista homologada</span></div><div><strong>30 min</strong><span>Bateria completa</span></div><div><strong>Betim · MG</strong><span>Acesso fácil</span></div></div></div><aside class="glass-panel booking"><h2 class="panel-title">Pacotes para grupos</h2><div class="price"><small>A partir de</small><strong>R$145</strong><span>por pessoa</span></div><div class="panel-list"><div><strong>Pista homologada</strong>Segurança, equipe e alto desempenho.</div><div><strong>Cronometragem eletrônica</strong>Resultados individuais em tempo real.</div><div><strong>Estrutura completa</strong>Área para receber seu grupo e celebrar.</div></div><div class="panel-actions"><button class="btn btn-primary" type="button" data-modal-open>Reservar grupo</button><a class="btn btn-outline" href="${WHATSAPP}" target="_blank" rel="noopener noreferrer">Falar no WhatsApp</a></div></aside></div></section>
  ${telemetry([{ icon: mapIcon, title: '1.110m de pista', text: 'Traçado técnico e emocionante' }, { icon: clockIcon, title: 'Cronometragem eletrônica', text: 'Resultados precisos em tempo real' }, { icon: groupIcon, title: 'Estrutura para grupos', text: 'Aniversários, amigos e empresas' }, { icon: trophyIcon, title: 'Pódio e celebração', text: 'Uma experiência completa de corrida' }])}
  <div class="editorial-band"><div class="ticker"><span>Velocidade • Amigos • Pódio • Adrenalina • Aniversários • </span><span>Velocidade • Amigos • Pódio • Adrenalina • Aniversários • </span></div></div>
  <section class="section"><div class="container"><div class="reveal"><p class="eyebrow">Escolha seu formato</p><h2 class="section-title">Opções para grupos<br><span class="accent">e comemorações</span></h2></div><div class="poster-grid"><article class="poster-card reveal"><span class="poster-number">01</span><img src="/assets/events/1.jpg" alt="Piloto no kart"><div class="poster-content"><h3>Aniversário Racer</h3><p>Bateria exclusiva, pódio, fotos e um dia que ninguém do grupo vai esquecer.</p><div class="card-price"><small>A partir de</small><strong>R$145</strong><span>por pessoa</span></div><button class="btn btn-primary btn-small" type="button" data-modal-open>Ver detalhes</button></div></article><article class="poster-card reveal"><span class="poster-number">02</span><img src="/assets/events/6.jpg" alt="Grupo de amigos no kartódromo"><div class="poster-content"><h3>Grupo de Amigos</h3><p>Disputa, ranking e momento épico no pódio com a sua turma.</p><div class="card-price"><small>A partir de</small><strong>R$135</strong><span>por pessoa</span></div><button class="btn btn-primary btn-small" type="button" data-modal-open>Montar grupo</button></div></article><article class="poster-card reveal"><span class="poster-number">03</span><img src="/assets/events/7.jpg" alt="Evento corporativo"><div class="poster-content"><h3>Evento Corporativo</h3><p>Integração, adrenalina e networking em um ambiente fora do convencional.</p><div class="card-price"><small>Projeto</small><strong>VIP</strong><span>sob consulta</span></div><button class="btn btn-primary btn-small" type="button" data-modal-open>Solicitar proposta</button></div></article></div></div></section>
  <section class="section section-dark"><div class="container"><div class="asym-grid"><div class="reveal"><p class="eyebrow">Como funciona</p><h2 class="section-title">Simples, rápido<br><span class="accent">e cheio de adrenalina</span></h2><p class="section-copy">Do primeiro contato ao pódio, a equipe organiza cada etapa para seu grupo aproveitar o que importa: a corrida e a comemoração.</p></div><div class="stats-grid reveal"><div class="stat"><strong data-count="4">0</strong><span>Etapas claras</span></div><div class="stat"><strong data-count="30" data-suffix=" min">0</strong><span>Experiência na pista</span></div><div class="stat"><strong data-count="35">0</strong><span>Karts por bateria</span></div><div class="stat"><strong data-count="1996">0</strong><span>Desde 1996</span></div></div></div><div class="steps"><article class="step reveal" data-step="01"><div class="step-icon">${clockIcon}</div><h3>Escolha data e grupo</h3><p>Conte quantas pessoas vão participar e a data pretendida.</p></article><article class="step reveal" data-step="02"><div class="step-icon">${groupIcon}</div><h3>Receba a proposta</h3><p>A equipe confirma o formato, horários e condições para o grupo.</p></article><article class="step reveal" data-step="03"><div class="step-icon">${flagIcon}</div><h3>Briefing e grid</h3><p>Cadastro, equipamentos, instruções de segurança e formação da bateria.</p></article><article class="step reveal" data-step="04"><div class="step-icon">${trophyIcon}</div><h3>Corrida e pódio</h3><p>Disputa cronometrada, resultado individual e celebração final.</p></article></div></div></section>
  <section class="section"><div class="container"><p class="eyebrow">Experiência real</p><h2 class="section-title">Seu grupo dentro<br><span class="accent">da história</span></h2><div class="gallery-strip"><figure class="gallery-item reveal"><img src="/assets/events/2.jpg" alt="Bateria de kart"><figcaption class="gallery-caption"><strong>Adrenalina desde a largada</strong><span>Pista, grid e cronometragem.</span></figcaption></figure><figure class="gallery-item reveal"><img src="/assets/events/3.jpg" alt="Piloto acelerando"><figcaption class="gallery-caption"><strong>Disputa de verdade</strong><span>Resultado volta a volta.</span></figcaption></figure><figure class="gallery-item reveal"><img src="/assets/events/4.jpg" alt="Grupo no kartódromo"><figcaption class="gallery-caption"><strong>Memória em grupo</strong><span>Uma comemoração diferente.</span></figcaption></figure><figure class="gallery-item reveal"><img src="/assets/events/5.jpg" alt="Kart na pista"><figcaption class="gallery-caption"><strong>Circuito homologado</strong><span>1.110 metros de desafio.</span></figcaption></figure><figure class="gallery-item reveal"><img src="/assets/events/7.jpg" alt="Evento corporativo"><figcaption class="gallery-caption"><strong>Empresas e equipes</strong><span>Integração fora do comum.</span></figcaption></figure></div></div></section>
  ${bigCta('Seu grupo.<br><span class="accent">Sua largada.</span>', 'Monte a experiência, confirme a data e deixe a equipe cuidar do restante.', 'Reservar meu grupo')}`;
  return page({ filename: 'index.html', route: '/', title: 'Kartódromo de Betim | Grupos, aniversários e kart', description: 'O kartódromo mais completo de Betim para aniversários, grupos de amigos, locação e campeonatos.', active: 'home', content, modalEnabled: true });
}

function pista() {
  const content = `<section class="hero compact">${media({ position: 'center 45%' })}<div class="container page-hero-grid"><div><p class="eyebrow">Circuito homologado</p><h1 class="page-title"><span class="outline">Pista</span><br><span class="green">1.110m</span></h1><p class="page-lead">Um traçado técnico, veloz e mutável. Cada configuração altera pontos de frenagem, linhas de tangência e estratégia.</p><div class="actions"><a class="btn btn-primary" href="#tracados">Ver traçados ${arrow}</a><a class="btn btn-outline" href="/kart-locacao">Correr nesta pista</a></div></div><div class="hero-side-number">1.110<small>metros de desafio</small></div></div></section>
  ${telemetry([{ icon: mapIcon, title: '3 configurações', text: 'Normal, invertido e chicane' }, { icon: boltIcon, title: 'Alta velocidade', text: 'Retas e pontos técnicos' }, { icon: clockIcon, title: 'Cronometragem', text: 'Precisão volta a volta' }, { icon: flagIcon, title: 'Homologada', text: 'Estrutura oficial de prova' }])}
  <section id="tracados" class="section"><div class="container"><div class="asym-grid"><div class="reveal"><p class="eyebrow">Desenho do circuito</p><h2 class="section-title">Cada traçado muda<br><span class="accent">o jeito de pilotar</span></h2><p class="section-copy">Selecione uma configuração e veja o circuito reagir. A animação representa o fluxo de volta e a leitura de setores.</p></div><div class="metric-stack reveal"><div class="metric-mini"><h3>Maior reta</h3><strong data-count="190" data-suffix="m">0</strong><span>Aceleração máxima e tomada de vácuo.</span></div><div class="metric-mini"><h3>Curvas técnicas</h3><strong data-count="14">0</strong><span>Combinações de baixa, média e alta.</span></div></div></div><div style="margin-top:55px"><div class="track-tabs"><button class="track-tab active" type="button" data-track="normal">Normal</button><button class="track-tab" type="button" data-track="invertido">Invertido</button><button class="track-tab" type="button" data-track="chicane">Chicane</button></div><div class="track-stage reveal"><svg viewBox="0 0 1080 680" role="img" aria-label="Mapa estilizado do circuito"><path id="track-path" class="track-path" d="M110 360 C160 110 370 80 480 210 C590 350 760 100 880 170 C1010 245 930 470 760 460 C600 450 560 600 380 540 C230 490 40 560 110 360"/><path id="track-green" class="track-path green" d="M110 360 C160 110 370 80 480 210 C590 350 760 100 880 170 C1010 245 930 470 760 460 C600 450 560 600 380 540 C230 490 40 560 110 360"/></svg></div></div></div></section>
  <section class="section section-dark"><div class="container"><p class="eyebrow">Telemetria editorial</p><h2 class="section-title">Leia a pista<br><span class="accent">antes da largada</span></h2><div class="metric-board"><div class="metric-main reveal"><h3>Velocidade estimada</h3><div class="metric-value"><span>até</span> 85<span>km/h</span></div><div class="metric-graph">${[22,38,52,68,84,60,74,92,66,48,78,96,72,54,88,100,62,42,70,90].map((height) => `<i style="height:${height}%"></i>`).join('')}</div></div><div class="metric-stack"><div class="metric-mini reveal"><h3>Setor técnico</h3><strong>S2</strong><span>Sequência que premia precisão.</span></div><div class="metric-mini reveal"><h3>Sentido</h3><strong>↻</strong><span>Alterado conforme evento e campeonato.</span></div></div></div></div></section>
  <section class="section"><div class="container"><p class="eyebrow">Estrutura do circuito</p><h2 class="section-title">Performance com<br><span class="accent">segurança</span></h2><div class="spec-grid"><article class="spec reveal"><strong>01</strong><h3>Barreiras e áreas de escape</h3><p>Proteções distribuídas conforme os pontos de maior exigência do circuito.</p></article><article class="spec reveal"><strong>02</strong><h3>Equipe de pista</h3><p>Bandeiramento, orientação e resposta operacional durante toda a bateria.</p></article><article class="spec reveal"><strong>03</strong><h3>Cronometragem oficial</h3><p>Voltas, posições e melhores tempos registrados individualmente.</p></article></div></div></section>
  ${bigCta('Sua volta começa<br><span class="accent">agora</span>', 'Consulte os horários disponíveis e venha descobrir cada setor da pista.')}`;
  return page({ filename: 'pista.html', route: '/pista', title: 'A pista | Kartódromo Internacional de Betim', description: 'Conheça a pista homologada de 1.110 metros e seus traçados oficiais.', active: 'pista', content });
}

function locacao() {
  const content = `<section class="hero compact">${media({ position: 'center 60%' })}<div class="container page-hero-grid"><div><p class="eyebrow">Kart de locação</p><h1 class="page-title">Entre no<br><span class="green">grid hoje</span></h1><p class="page-lead">Bateria de 30 minutos com kart, equipamento, briefing, cronometragem e equipe de pista em um circuito de 1.110 metros.</p><div class="actions"><a class="btn btn-primary" href="${BOOKING}" target="_blank" rel="noopener noreferrer">Reservar online ${arrow}</a><a class="btn btn-outline" href="${WHATSAPP}" target="_blank" rel="noopener noreferrer">Tirar dúvida</a></div></div><aside class="glass-panel booking"><h2 class="panel-title">Valor da bateria</h2><div class="price"><small>Antecipado</small><strong>R$145</strong><span>por piloto</span></div><div class="panel-list"><div><strong>Preço normal R$175</strong>Desconto no pagamento antecipado.</div><div><strong>Pix ou cartão</strong>Pagamento no agendamento online.</div><div><strong>Equipamento incluso</strong>Capacete e orientações de segurança.</div></div><div class="panel-actions"><a class="btn btn-primary" href="${BOOKING}" target="_blank" rel="noopener noreferrer">Ver horários</a></div></aside></div></section>
  ${telemetry([{ icon: clockIcon, title: '30 minutos', text: '5 treino + 10 tomada + 15 corrida' }, { icon: trophyIcon, title: 'Equipamento incluso', text: 'Capacete e orientação obrigatória' }, { icon: boltIcon, title: 'Kart Light', text: 'Categoria acessível e competitiva' }, { icon: flagIcon, title: 'Resultado individual', text: 'Voltas e classificação final' }])}
  <section class="section"><div class="container"><div class="asym-grid"><div class="reveal"><p class="eyebrow">A bateria</p><h2 class="section-title">Trinta minutos<br><span class="accent">dentro da pista</span></h2><p class="section-copy">Chegue com uma hora de antecedência para cadastro, pesagem, retirada dos equipamentos e briefing.</p></div><div class="stats-grid reveal"><div class="stat"><strong>05</strong><span>min de treino</span></div><div class="stat"><strong>10</strong><span>min de tomada</span></div><div class="stat"><strong>15</strong><span>min de corrida</span></div><div class="stat"><strong>01</strong><span>resultado final</span></div></div></div><div class="steps"><article class="step reveal" data-step="01"><div class="step-icon">${groupIcon}</div><h3>Cadastro e pesagem</h3><p>Confirmação dos dados, assinatura e preparação para o briefing.</p></article><article class="step reveal" data-step="02"><div class="step-icon">${trophyIcon}</div><h3>Equipamento e briefing</h3><p>Capacete, instruções de segurança, bandeiras e regras de pista.</p></article><article class="step reveal" data-step="03"><div class="step-icon">${clockIcon}</div><h3>Tomada de tempo</h3><p>Voltas rápidas para definir a posição de largada de cada piloto.</p></article><article class="step reveal" data-step="04"><div class="step-icon">${flagIcon}</div><h3>Corrida</h3><p>Quinze minutos de disputa até a bandeirada e o resultado final.</p></article></div></div></section>
  <section class="section section-dark"><div class="container"><p class="eyebrow">Para pilotar</p><h2 class="section-title">Requisitos<br><span class="accent">rápidos</span></h2><div class="rules-grid"><article class="rule-card reveal" data-step="01"><h3>Idade e altura</h3><p>Confirme previamente os critérios da categoria e disponibilidade da bateria.</p><strong>Consulte a equipe em caso de dúvida.</strong></article><article class="rule-card reveal" data-step="02"><h3>Roupa adequada</h3><p>Calça comprida, camisa e calçado fechado são recomendados para melhor proteção.</p><strong>Evite acessórios soltos.</strong></article><article class="rule-card reveal" data-step="03"><h3>Chegada antecipada</h3><p>Apresente-se uma hora antes para cadastro, pesagem, equipamento e briefing.</p><strong>A bateria não espera atrasos.</strong></article></div></div></section>
  ${bigCta('Escolha o horário.<br><span class="accent">Entre no grid.</span>', 'A agenda oficial mostra as baterias disponíveis e permite pagamento antecipado.', 'Ver horários')}`;
  return page({ filename: 'kart-locacao.html', route: '/kart-locacao', title: 'Kart de locação | Kartódromo de Betim', description: 'Reserve uma bateria de kart de locação com cronometragem e equipamento incluso.', active: 'locacao', content });
}

const championshipCards = [
  { href: '/kac', image: '/assets/events/1.jpg', status: 'Iniciantes', title: 'KAC', text: 'Campeonato mensal de Kart Light para evolução, constância e disputa.' },
  { href: '/kac-super', image: '/assets/events/3.jpg', status: 'Super Kart', title: 'KAC Super', text: 'Temporada anual de alta performance, pontuação acumulada e grid experiente.' },
  { href: '/200-milhas', image: '/assets/events/5.jpg', status: 'Endurance', title: '200 Milhas', text: 'Estratégia em equipe, ritmo, trocas e gestão de corrida.' },
  { href: '/500-milhas', image: '/assets/events/7.jpg', status: 'Endurance', title: '500 Milhas', text: 'A prova mais longa e exigente do calendário de Betim.' },
];

function campeonatos() {
  const content = `<section class="hero compact">${media({ position: 'center 50%' })}<div class="container page-hero-grid"><div><p class="eyebrow">Calendário competitivo</p><h1 class="page-title">A temporada<br><span class="green">começa aqui</span></h1><p class="page-lead">Do primeiro campeonato ao endurance de longa duração, existe um grid preparado para cada nível de piloto.</p><div class="actions"><a class="btn btn-primary" href="#categorias">Conhecer campeonatos ${arrow}</a><a class="btn btn-outline" href="${WHATSAPP}" target="_blank" rel="noopener noreferrer">Falar com organização</a></div></div><div class="hero-side-number">2026<small>temporada oficial</small></div></div></section>
  ${telemetry([{ icon: trophyIcon, title: '4 campeonatos', text: 'Sprint e endurance' }, { icon: groupIcon, title: 'Vários níveis', text: 'Iniciantes a experientes' }, { icon: flagIcon, title: 'Regulamentos próprios', text: 'Critérios por competição' }, { icon: clockIcon, title: 'Calendário anual', text: 'Etapas e provas especiais' }])}
  <section id="categorias" class="section"><div class="container"><p class="eyebrow">Escolha seu grid</p><h2 class="section-title">Campeonatos<br><span class="accent">de Betim</span></h2><div class="champ-grid">${championshipCards.map((card) => `<a class="champ-card reveal" href="${card.href}"><img src="${card.image}" alt=""><div class="champ-content"><span class="status-pill">${card.status}</span><h3>${card.title}</h3><p>${card.text}</p><span class="btn btn-outline btn-small">Ver campeonato ${arrow}</span></div></a>`).join('')}</div></div></section>
  <section class="section section-dark"><div class="container"><div class="asym-grid"><div><p class="eyebrow">Da inscrição ao resultado</p><h2 class="section-title">Competição com<br><span class="accent">processo claro</span></h2><p class="section-copy">Cada campeonato possui regras, requisitos, calendário e formato específicos. Consulte a página da competição antes de confirmar a inscrição.</p></div><div class="steps" style="grid-template-columns:1fr 1fr"><article class="step reveal" data-step="01"><div class="step-icon">${groupIcon}</div><h3>Escolha a categoria</h3><p>Compare nível de experiência, kart utilizado e formato de prova.</p></article><article class="step reveal" data-step="02"><div class="step-icon">${flagIcon}</div><h3>Leia o regulamento</h3><p>Confirme documentos, lastro, pontuação, penalidades e critérios.</p></article><article class="step reveal" data-step="03"><div class="step-icon">${clockIcon}</div><h3>Inscreva-se no prazo</h3><p>Fale com a organização e confirme pagamento e disponibilidade.</p></article><article class="step reveal" data-step="04"><div class="step-icon">${trophyIcon}</div><h3>Dispute a temporada</h3><p>Acompanhe etapas, resultados e classificação oficial.</p></article></div></div></div></section>
  ${bigCta('Existe um grid<br><span class="accent">para você.</span>', 'Consulte a organização para inscrições, calendário e disponibilidade.', 'Falar com organização')}`;
  return page({ filename: 'campeonatos.html', route: '/campeonatos', title: 'Campeonatos | Kartódromo Internacional de Betim', description: 'Conheça os campeonatos KAC, KAC Super, 200 Milhas e 500 Milhas de Betim.', active: 'campeonatos', content });
}

function eventos() {
  const content = `<section class="hero compact">${media({ position: 'center 48%' })}<div class="container hero-content"><div><p class="eyebrow">Grupos, empresas e celebrações</p><h1 class="page-title">Eventos com<br><span class="green">ritmo de corrida</span></h1><p class="page-lead">Transforme integração, aniversário ou confraternização em uma experiência com pista, competição, pódio e estrutura completa.</p><div class="actions"><button class="btn btn-primary" type="button" data-modal-open>Solicitar proposta ${arrow}</button><a class="btn btn-outline" href="${WHATSAPP}" target="_blank" rel="noopener noreferrer">Atendimento no WhatsApp</a></div></div><aside class="glass-panel booking"><h2 class="panel-title">Projeto sob medida</h2><div class="price"><small>Formato</small><strong>VIP</strong><span>de acordo com o grupo</span></div><div class="panel-list"><div><strong>Bateria exclusiva</strong>Grid reservado para convidados.</div><div><strong>Experiência personalizada</strong>Horários, formato e estrutura combinados.</div><div><strong>Pódio e reconhecimento</strong>Resultado e celebração final.</div></div><button class="btn btn-primary" type="button" data-modal-open>Montar evento</button></aside></div></section>
  ${telemetry([{ icon: groupIcon, title: 'Aniversários', text: 'Uma celebração fora do comum' }, { icon: trophyIcon, title: 'Empresas', text: 'Integração e reconhecimento' }, { icon: flagIcon, title: 'Bateria exclusiva', text: 'Grid reservado para o grupo' }, { icon: mapIcon, title: 'Estrutura completa', text: 'Pista, equipe e recepção' }])}
  <section class="section"><div class="container"><p class="eyebrow">Formatos</p><h2 class="section-title">Escolha a experiência<br><span class="accent">do seu grupo</span></h2><div class="poster-grid"><article class="poster-card reveal"><span class="poster-number">01</span><img src="/assets/events/2.jpg" alt="Aniversário no kart"><div class="poster-content"><h3>Aniversários</h3><p>Comemoração com bateria, resultado, pódio e fotos.</p><button class="btn btn-primary btn-small" type="button" data-modal-open>Planejar aniversário</button></div></article><article class="poster-card reveal"><span class="poster-number">02</span><img src="/assets/events/6.jpg" alt="Grupo de amigos"><div class="poster-content"><h3>Amigos</h3><p>Descubra quem fala muito e quem realmente entrega volta rápida.</p><button class="btn btn-primary btn-small" type="button" data-modal-open>Montar bateria</button></div></article><article class="poster-card reveal"><span class="poster-number">03</span><img src="/assets/events/7.jpg" alt="Equipe corporativa"><div class="poster-content"><h3>Corporativo</h3><p>Integração, premiação, relacionamento e experiência de marca.</p><button class="btn btn-primary btn-small" type="button" data-modal-open>Solicitar proposta</button></div></article></div></div></section>
  <section class="section section-dark"><div class="container"><p class="eyebrow">Ambiente</p><h2 class="section-title">Cada momento<br><span class="accent">vira história</span></h2><div class="gallery-strip"><figure class="gallery-item reveal"><img src="/assets/events/1.jpg" alt="Piloto acelerando"><figcaption class="gallery-caption"><strong>Pista homologada</strong><span>Competição com estrutura.</span></figcaption></figure><figure class="gallery-item reveal"><img src="/assets/events/3.jpg" alt="Kart na pista"><figcaption class="gallery-caption"><strong>Resultado individual</strong><span>Cronometragem eletrônica.</span></figcaption></figure><figure class="gallery-item reveal"><img src="/assets/events/4.jpg" alt="Grupo reunido"><figcaption class="gallery-caption"><strong>Recepção do grupo</strong><span>Organização antes da largada.</span></figcaption></figure><figure class="gallery-item reveal"><img src="/assets/events/5.jpg" alt="Pódio"><figcaption class="gallery-caption"><strong>Pódio</strong><span>O final que todo evento merece.</span></figcaption></figure><figure class="gallery-item reveal"><img src="/assets/events/6.jpg" alt="Equipe de amigos"><figcaption class="gallery-caption"><strong>Memória coletiva</strong><span>Assunto para muito tempo.</span></figcaption></figure></div></div></section>
  ${bigCta('Seu evento merece<br><span class="accent">uma largada.</span>', 'Envie os dados do grupo e receba uma proposta contextualizada.', 'Solicitar proposta')}`;
  return page({ filename: 'eventos.html', route: '/eventos', title: 'Eventos | Kartódromo Internacional de Betim', description: 'Eventos corporativos, aniversários e grupos com kart, cronometragem e pódio em Betim.', active: 'eventos', content, modalEnabled: true });
}

const faqItems = [
  ['locacao', 'Preciso ter experiência para correr?', 'Não. A categoria de locação atende iniciantes e pilotos habituais. Todos recebem briefing antes da entrada na pista.'],
  ['locacao', 'Quanto tempo dura a bateria?', 'A experiência de pista soma 30 minutos: treino, tomada de tempo e corrida.'],
  ['reserva', 'Como faço a reserva?', 'Use a agenda oficial para escolher a bateria e realizar o pagamento antecipado.'],
  ['reserva', 'Qual a antecedência recomendada?', 'Chegue aproximadamente uma hora antes para cadastro, pesagem, equipamento e briefing.'],
  ['grupos', 'É possível reservar uma bateria exclusiva?', 'Sim. O formato depende do tamanho do grupo, data e disponibilidade. Solicite uma proposta.'],
  ['grupos', 'O aniversariante possui condição especial?', 'As condições podem variar conforme a campanha vigente. Confirme com a equipe no momento da reserva.'],
  ['seguranca', 'Quais roupas devo usar?', 'Prefira calça comprida, camisa e calçado fechado. Evite objetos e acessórios soltos.'],
  ['seguranca', 'O capacete está incluso?', 'Sim. O equipamento obrigatório e as orientações de segurança fazem parte da experiência.'],
  ['campeonato', 'Como participo dos campeonatos?', 'Consulte a página da competição, leia o regulamento e confirme requisitos e vagas com a organização.'],
  ['campeonato', 'Onde encontro resultados e classificação?', 'A organização publica resultados oficiais pelos canais definidos em cada competição.'],
];

function duvidas() {
  const content = `<section class="hero compact">${media({ image: '/assets/history/1.jpg', video: false, position: 'center 40%' })}<div class="container page-hero-grid"><div><p class="eyebrow">Antes da bandeirada</p><h1 class="page-title"><span class="outline">Dúvidas</span><br><span class="green">frequentes</span></h1><p class="page-lead">Regras de conduta, segurança, reservas e respostas para preparar sua experiência antes de chegar ao circuito.</p><div class="actions"><a class="btn btn-primary" href="#faq">Consultar respostas</a><a class="btn btn-outline" href="${WHATSAPP}" target="_blank" rel="noopener noreferrer">Falar com suporte</a></div></div><div class="hero-side-number">FAQ<small>informação rápida</small></div></div></section>
  <section id="faq" class="section"><div class="container"><div class="faq-layout"><aside class="faq-sidebar" aria-label="Categorias de dúvidas"><button class="faq-filter active" type="button" data-cat="all">Todas</button><button class="faq-filter" type="button" data-cat="locacao">Locação</button><button class="faq-filter" type="button" data-cat="reserva">Reserva</button><button class="faq-filter" type="button" data-cat="grupos">Grupos</button><button class="faq-filter" type="button" data-cat="seguranca">Segurança</button><button class="faq-filter" type="button" data-cat="campeonato">Campeonatos</button></aside><div><p class="eyebrow">Central de respostas</p><h2 class="section-title">Tudo o que você<br><span class="accent">precisa saber</span></h2><div class="faq-list">${faqItems.map(([cat, question, answer], index) => `<article class="faq-item" data-cat="${cat}"><button class="faq-q" type="button"><span>${question}</span><b aria-hidden="true">+</b></button><div class="faq-a" id="faq-${index + 1}" aria-hidden="true"><div><p>${answer}</p></div></div></article>`).join('')}</div></div></div></div></section>
  ${bigCta('Ainda ficou<br><span class="accent">alguma dúvida?</span>', 'A equipe pode confirmar regras, disponibilidade e condições específicas da sua experiência.', 'Abrir agenda')}`;
  return page({ filename: 'duvidas.html', route: '/duvidas', title: 'Dúvidas frequentes | Kartódromo de Betim', description: 'Respostas sobre reservas, locação, segurança, grupos e campeonatos.', active: 'duvidas', content });
}

const championshipData = {
  kac: {
    filename: 'kac.html', route: '/kac', eyebrow: 'Campeonato oficial · Iniciantes', title: 'KAC<br><span class="green">Iniciantes</span>', description: 'Campeonato mensal de Kart Light para pilotos iniciantes. Constância, evolução e tomada de decisão dentro da pista.', side: 'KAC', sideLabel: 'porta de entrada', status: 'Categoria iniciantes', intro: 'Evolução volta a volta',
    stats: [['10', 'etapas previstas'], ['Light', 'categoria'], ['100kg', 'lastro de referência'], ['Mensal', 'ritmo da temporada']],
    timeline: [['Fev', 'Abertura da temporada'], ['Mar', 'Etapa 2'], ['Abr', 'Etapa 3'], ['Mai', 'Etapa 4'], ['Jun', 'Etapa 5'], ['Jul', 'Etapa 6'], ['Ago', 'Etapa 7'], ['Set', 'Etapa 8'], ['Out', 'Etapa 9'], ['Nov', 'Final da temporada']],
    rules: [['Experiência', 'Voltado a pilotos iniciantes e em desenvolvimento.'], ['Lastro', 'Consulte o regulamento oficial da temporada.'], ['Pontuação', 'Resultados acumulados conforme critérios da competição.']],
  },
  super: {
    filename: 'kac-super.html', route: '/kac-super', eyebrow: 'Campeonato oficial · Super Kart', title: 'KAC<br><span class="green">Super Kart</span>', description: 'Campeonato anual na categoria Super Kart, com etapas de fevereiro a novembro e pontuação acumulada.', side: '400', sideLabel: 'cc de performance', status: 'Categoria avançada', intro: 'Alta performance em temporada',
    stats: [['10', 'etapas previstas'], ['400cc', 'Super Kart'], ['13HP', 'motor Honda'], ['Anual', 'pontuação acumulada']],
    timeline: [['Fev', 'Etapa de abertura'], ['Mar', 'Etapa 2'], ['Abr', 'Etapa 3'], ['Mai', 'Etapa 4'], ['Jun', 'Etapa 5'], ['Jul', 'Etapa 6'], ['Ago', 'Etapa 7'], ['Set', 'Etapa 8'], ['Out', 'Etapa 9'], ['Nov', 'Grande final']],
    rules: [['Carteirinha', 'Experiência comprovada e liberação para Super Kart.'], ['Lastro', 'Aplicado conforme o regulamento da temporada.'], ['Pontuação', 'Acumulada por etapa, com critérios de desempate.']],
  },
  '200': {
    filename: '200-milhas.html', route: '/200-milhas', eyebrow: 'Endurance', title: '200 <span class="green">Milhas</span><br><span class="outline">de Betim</span>', description: 'Endurance estratégico em equipe, com ritmo, trocas, constância e gestão de corrida.', side: '200', sideLabel: 'milhas de estratégia', status: 'Prova em equipe', intro: 'Ritmo, estratégia e trocas',
    stats: [['200', 'milhas'], ['Equipe', 'formato'], ['Stints', 'gestão de pilotos'], ['Endurance', 'categoria']],
    timeline: [['01', 'Inscrição da equipe'], ['02', 'Definição dos pilotos'], ['03', 'Briefing e tomada'], ['04', 'Largada e stints'], ['05', 'Trocas e estratégia'], ['06', 'Bandeirada final']],
    rules: [['Equipe', 'Pilotos e responsáveis definidos na inscrição.'], ['Estratégia', 'Trocas e stints conforme o regulamento oficial.'], ['Penalidades', 'Conduta e procedimentos são fiscalizados durante toda a prova.']],
  },
  '500': {
    filename: '500-milhas.html', route: '/500-milhas', eyebrow: 'Endurance máximo', title: '500 <span class="green">Milhas</span><br><span class="outline">de Betim</span>', description: 'A prova de longa duração mais exigente do calendário, com estratégia, constância e trabalho em equipe.', side: '500', sideLabel: 'milhas de resistência', status: 'Prova especial', intro: 'O maior desafio do calendário',
    stats: [['500', 'milhas'], ['Longa', 'duração'], ['Equipe', 'estratégia'], ['Máxima', 'resistência']],
    timeline: [['01', 'Planejamento da equipe'], ['02', 'Treinos e classificação'], ['03', 'Formação do grid'], ['04', 'Primeiros stints'], ['05', 'Gestão de longa duração'], ['06', 'Bandeirada histórica']],
    rules: [['Preparação', 'A prova exige equipe organizada, pilotos e estratégia definidos.'], ['Stints', 'Limites, trocas e procedimentos seguem regulamento próprio.'], ['Segurança', 'Briefing e disciplina de pista são obrigatórios.']],
  },
};

function championshipPage(data) {
  const content = `<section class="hero compact">${media({ position: 'center 50%' })}<div class="container page-hero-grid"><div><p class="eyebrow">${data.eyebrow}</p><h1 class="page-title">${data.title}</h1><p class="page-lead">${data.description}</p><div class="actions"><a class="btn btn-primary" href="${WHATSAPP}" target="_blank" rel="noopener noreferrer">Consultar inscrição ${arrow}</a><a class="btn btn-outline" href="/campeonatos">Todos os campeonatos</a></div></div><div class="hero-side-number">${data.side}<small>${data.sideLabel}</small></div></div></section>
  ${telemetry(data.stats.map(([title, text], index) => ({ icon: [trophyIcon, boltIcon, clockIcon, flagIcon][index], title, text })))}
  <section class="section"><div class="container"><div class="asym-grid"><div><p class="eyebrow">${data.status}</p><h2 class="section-title">${data.intro.split(' ').slice(0, 2).join(' ')}<br><span class="accent">${data.intro.split(' ').slice(2).join(' ')}</span></h2><p class="section-copy">A página resume o formato da competição. Datas, valores, requisitos, lastro e critérios oficiais devem ser confirmados no regulamento vigente e com a organização.</p></div><div class="stats-grid">${data.stats.map(([value, label]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join('')}</div></div></div></section>
  <section class="section section-dark"><div class="container"><p class="eyebrow">Fluxo da competição</p><h2 class="section-title">Do primeiro contato<br><span class="accent">à bandeirada</span></h2><div class="timeline">${data.timeline.map(([date, title], index) => `<div class="timeline-item reveal"><div class="timeline-date">${date}</div><article class="timeline-card"><h3>${title}</h3><p>${index < 2 ? 'Preparação, confirmação e alinhamento com a organização.' : index < data.timeline.length - 1 ? 'Etapa competitiva conforme calendário e regulamento.' : 'Encerramento, resultado e reconhecimento da competição.'}</p></article></div>`).join('')}</div></div></section>
  <section class="section"><div class="container"><p class="eyebrow">Antes de se inscrever</p><h2 class="section-title">Regras que<br><span class="accent">importam</span></h2><div class="rules-grid">${data.rules.map(([title, text], index) => `<article class="rule-card reveal" data-step="0${index + 1}"><h3>${title}</h3><p>${text}</p><strong>Confirme no regulamento vigente.</strong></article>`).join('')}</div></div></section>
  ${bigCta('Prepare a equipe.<br><span class="accent">Confirme o grid.</span>', 'Fale com a organização para calendário, regulamento, valores e disponibilidade.', 'Consultar inscrição')}`;
  return page({ filename: data.filename, route: data.route, title: `${data.description.split('.')[0]} | Kartódromo de Betim`, description: data.description, active: 'campeonatos', content });
}

const generatedPages = [
  home(), pista(), locacao(), campeonatos(), eventos(), duvidas(),
  championshipPage(championshipData.kac), championshipPage(championshipData.super),
  championshipPage(championshipData['200']), championshipPage(championshipData['500']),
];

await rm(output, { recursive: true, force: true });
await mkdir(join(output, 'assets/css'), { recursive: true });
await mkdir(join(output, 'assets/js'), { recursive: true });
await writeFile(join(output, 'assets/css/site.css'), await readFile(join(source, 'site.css'), 'utf8'));
await writeFile(join(output, 'assets/js/site.js'), await readFile(join(source, 'site.js'), 'utf8'));

for (const directory of ['brand', 'posters', 'videos', 'events', 'history', 'championships', 'kac', 'regulamentos']) {
  const from = join(publicDir, directory);
  try {
    await access(from);
    await cp(from, join(output, 'assets', directory), { recursive: true });
  } catch {
    // Diretórios opcionais não bloqueiam a geração. Referências usadas nas páginas são validadas pelos testes E2E.
  }
}

for (const html of generatedPages) {
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  const routeEntry = routes.find(([, filename]) => html.includes(`rel="canonical" href="${SITE}${filename === 'index.html' ? '/' : `/${filename.replace(/\.html$/, '')}`}"`));
  const routeIndex = generatedPages.indexOf(html);
  const filename = routes[routeIndex][1];
  await writeFile(join(output, filename), html);
  if (!titleMatch) throw new Error(`Página sem título: ${filename}`);
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map(([route]) => `  <url><loc>${SITE}${route === '/' ? '/' : route}</loc><changefreq>weekly</changefreq><priority>${route === '/' ? '1.0' : '0.8'}</priority></url>`).join('\n')}\n</urlset>\n`;
await writeFile(join(output, 'sitemap.xml'), sitemap);
await writeFile(join(output, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
await writeFile(join(output, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n\n/*.html\n  Cache-Control: public, max-age=300, must-revalidate\n`);
await writeFile(join(output, '404.html'), `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Página não encontrada | Kartódromo de Betim</title><link rel="stylesheet" href="/assets/css/site.css"></head><body>${header('')}<main id="conteudo"><section class="hero compact">${media({ image: '/assets/history/1.jpg', video: false })}<div class="container"><h1 class="page-title">Página<br><span class="green">não encontrada</span></h1><p class="page-lead">A curva não estava no traçado. Volte para a página inicial.</p><div class="actions"><a class="btn btn-primary" href="/">Voltar para Home ${arrow}</a></div></div></section></main>${footer()}<script src="/assets/js/site.js" defer></script></body></html>`);

console.log(`Site premium gerado em ${output}`);
console.log(`${generatedPages.length} páginas principais, ${routes.length} rotas canônicas.`);
