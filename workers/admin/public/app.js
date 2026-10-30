'use strict';
/* Painel administrativo web do Kartódromo de Betim.
   Lê e grava no KartodromoOps (SRVKART) pelo servidor da operação, com o login dos usuários da Recepção.
   O placar ao vivo vem da cronometragem do ORBITS (só leitura). */

// ------------------------------------------------------------------ utilidades
const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TZ = 'America/Sao_Paulo';
const hojeIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
const agoraMin = () => { const [h, m] = new Date().toLocaleTimeString('pt-BR', { timeZone: TZ, hour12: false }).split(':'); return +h * 60 + +m; };
const pad = (n) => String(n).padStart(2, '0');
const deIso = (s) => { const [a, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(a, m - 1, d); };
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const somaDias = (s, n) => { const d = deIso(s); d.setDate(d.getDate() + n); return iso(d); };
const hm = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const fmtHm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const horaDe = (dt) => String(dt || '').slice(11, 16);
const brl = (c) => ((+c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCurto = (c) => brl(c).replace(',00', '');
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const iniciais = (n) => { const p = String(n || '').trim().split(/\s+/).filter(Boolean); return p.length ? (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() : '?'; };
const so = (s) => String(s || '').replace(/\D/g, '');
const zap = (fone, texto) => { let d = so(fone); if (!d) return ''; if (d.length <= 11) d = '55' + d; return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`; };
const G = (a, b) => `linear-gradient(180deg, ${a}, ${b})`;
const CORG = ['#FF9F0A', '#1E6FE8', '#8645D6', '#0E9C9C', '#D92D20', '#34C759'];
const LINK_CADASTRO = 'https://cadastro.kartodromodebetim.com.br';
const guarda = { ler(k) { try { return localStorage.getItem(k); } catch { return null; } }, gravar(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sem armazenamento */ } } };

const IC = {
  inicio: 'M3 11l9-7 9 7v9H3z', agenda: 'M4 5h16v15H4zM4 10h16M9 3v4M15 3v4M8 14h3M8 17h6', recepcao: 'M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  crono: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2 2M10 2h4', sorteio: 'M4 4h16v16H4zM9 9h.01M15 15h.01M15 9h.01M9 15h.01',
  reservas: 'M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4zM10 6v12', totem: 'M7 3h10v18H7zM11 18h2',
  camp: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4', sistema: 'M4 5h16v11H4zM8 20h8M12 16v4',
  busca: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5', sair: 'M15 4h4v16h-4M10 17l5-5-5-5M15 12H3', fechar: 'M6 6l12 12M18 6L6 18',
  esq: 'M15 6l-6 6 6 6', dir: 'M9 6l6 6-6 6', mais: 'M12 5v14M5 12h14', ok: 'M5 12.5l4.5 4.5L19 7.5', zap: 'M4 20l1.4-4.2A8 8 0 1 1 8.2 18.6zM9 9.5c0 3 2.5 5.5 5.5 5.5',
  pilotos: 'M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', ranking: 'M3 20h18M5 20v-5h4v5M10 20V9h4v11M15 20v-7h4v7',
};
const svg = (d, tam = 14, cor = 'currentColor', larg = 2.2) => `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="${larg}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"></path></svg>`;

const NAV = [
  { t: 'Operação', itens: [['visao', 'Visão geral', IC.inicio, G('#9A9AA0', '#4A4A4F')], ['agenda', 'Agenda', IC.agenda, G('#FF8A65', '#E8590C')], ['recepcao', 'Recepção', IC.recepcao, G('#5EDB7A', '#1E9E4A')], ['crono', 'Cronometragem', IC.crono, G('#FF6B5E', '#D92D20')], ['sorteio', 'Sorteio e karts', IC.sorteio, G('#C08BFF', '#8645D6')]] },
  { t: 'Clientes', itens: [['pilotos', 'Pilotos', IC.pilotos, G('#7FB8FF', '#1E6FE8')], ['ranking', 'Ranking', IC.ranking, G('#FFD24A', '#E0A100')], ['reservas', 'Reservas online', IC.reservas, G('#48D6CC', '#0E9C9C')], ['totens', 'Autoatendimento', IC.totem, G('#6CB8FF', '#1E6FE8')]] },
  { t: 'Competições', itens: [['campeonatos', 'Campeonatos', IC.camp, G('#FFB547', '#F07A00')]] },
  { t: 'Sistema', itens: [['sistema', 'PCs e sistema', IC.sistema, G('#8E8E93', '#3A3A3C')]] },
];

// ------------------------------------------------------------------ estado e API
const S = {
  token: guarda.ler('kib-admin-token'), usuario: JSON.parse(guarda.ler('kib-admin-usuario') || 'null'),
  selos: {}, timers: [], tela: {},
};

async function api(caminho, opcoes = {}) {
  const r = await fetch('/api' + caminho, {
    method: opcoes.method || 'GET',
    headers: { ...(S.token ? { authorization: 'Bearer ' + S.token } : {}), ...(opcoes.body ? { 'content-type': 'application/json' } : {}) },
    body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
  });
  const novo = r.headers.get('x-novo-token');
  if (novo) { S.token = novo; guarda.gravar('kib-admin-token', novo); }
  const dados = await r.json().catch(() => ({}));
  if (r.status === 401 && caminho !== '/login') { sair('Sua sessão terminou. Entre de novo.'); throw new Error('Sessão expirada.'); }
  if (!r.ok) throw new Error(dados.error || `Erro ${r.status}`);
  return dados;
}
const office = (c, o) => api('/office' + c, o);

let toastTimer;
function toast(msg, erro = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (erro ? ' erro' : '');
  el.setAttribute('role', 'status');
  el.innerHTML = `${svg(erro ? IC.fechar : IC.ok, 16, erro ? '#FFB3AE' : '#5EDB7A', 2.6)}<span>${esc(msg)}</span>`;
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  document.body.appendChild(el);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.remove(), 3600);
}
const falhou = (e) => toast(e.message || String(e), true);

function limparTimers() { S.timers.forEach(clearInterval); S.timers = []; }
function repetir(fn, ms) { S.timers.push(setInterval(() => { if (!document.hidden) fn(); }, ms)); }

// ------------------------------------------------------------------ login
function telaLogin(msg = '') {
  limparTimers();
  $('#raiz').innerHTML = `<div class="login"><form id="fLogin" autocomplete="on">
    <div class="marca"><span class="logo"><img src="/kib-logo.png" alt=""></span><span class="col"><b style="font-size: 17px">Kartódromo de Betim</b><span class="sub">Painel administrativo</span></span></div>
    <span class="sub" style="line-height: 1.5">Entre com o mesmo usuário e senha do programa da Recepção.</span>
    <label class="campo"><span>Usuário</span><input class="entrada" name="login" autocomplete="username" required autofocus></label>
    <label class="campo"><span>Senha</span><input class="entrada" name="senha" type="password" autocomplete="current-password" required></label>
    <label style="display: flex; gap: 8px; align-items: flex-start; font-size: 12.5px; color: var(--tinta2); line-height: 1.4"><input type="checkbox" name="termos" required style="margin-top: 2px; accent-color: var(--verde)">Concordo com os termos de uso do sistema do kartódromo.</label>
    <span class="erroMsg" id="erroLogin">${esc(msg)}</span>
    <button class="btn prim" style="height: 42px">Entrar</button>
  </form></div>`;
  $('#fLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const botao = e.target.querySelector('button'); botao.disabled = true; botao.textContent = 'Entrando…';
    try {
      const r = await api('/login', { method: 'POST', body: { login: f.get('login'), senha: f.get('senha'), termos: !!f.get('termos') } });
      S.token = r.token; S.usuario = r.usuario;
      guarda.gravar('kib-admin-token', r.token); guarda.gravar('kib-admin-usuario', JSON.stringify(r.usuario));
      if (!location.hash) location.hash = '#/visao';
      montarApp();
    } catch (err) {
      $('#erroLogin').textContent = err.message; botao.disabled = false; botao.textContent = 'Entrar';
    }
  });
}
function sair(msg) { S.token = null; S.usuario = null; guarda.gravar('kib-admin-token', null); guarda.gravar('kib-admin-usuario', null); telaLogin(msg); }

// ------------------------------------------------------------------ casca
function rotaAtual() { const r = (location.hash.match(/^#\/([a-z]+)/) || [])[1]; return TELAS[r] ? r : 'visao'; }

function montarApp() {
  if (!S.token) return telaLogin();
  const rota = rotaAtual();
  const u = S.usuario || { nome: '?' };
  $('#raiz').innerHTML = `<div class="app">
  <aside class="lateral" aria-label="Menu principal">
    <a href="#/visao" class="marca"><span class="logo"><img src="/kib-logo.png" alt="Kartódromo Internacional de Betim"></span><span class="col"><b style="font-size: 13.5px">Kartódromo de Betim</b><span class="peq">Painel administrativo</span></span></a>
    <button class="buscaBtn ocultarCelular hov" data-acao="busca">${svg(IC.busca, 14, '#6E6E73')}<span>Buscar cliente, CPF, tela…</span></button>
    <nav class="grupos" aria-label="Módulos">${NAV.map((g) => `<div class="grupo"><span class="grupo-titulo">${g.t}</span>${g.itens.map(([id, t, ic, cor]) => `
      <a href="#/${id}" class="navItem hov ${id === rota ? 'atual' : ''}" ${id === rota ? 'aria-current="page"' : ''}><span class="tile" style="background: ${cor}">${svg(ic, 13, '#FFF', 2.3)}</span><span style="flex-grow: 1">${t}</span><span id="selo-${id}"></span></a>`).join('')}</div>`).join('')}</nav>
    <div class="rodapeLateral ocultarCelular">
      <div class="estadoCard" id="estadoConexao"><span style="display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; color: var(--mudo)"><span class="ponto" style="background: #C7C7CC"></span>Conferindo conexão…</span></div>
      <div class="usuario"><span class="avatar" style="width: 30px; height: 30px; background: ${G('#7FB8FF', '#1E6FE8')}; font-size: 13px">${esc(iniciais(u.nome))}</span>
        <span class="col" style="flex-grow: 1"><b style="font-size: 12.5px">${esc(u.nome)}</b><span class="peq">${u.admin ? 'Administrador' : 'Recepção'}</span></span>
        <button class="btn sec peq" data-acao="sair" aria-label="Sair" style="width: 28px; padding: 0">${svg(IC.sair, 14, '#3A3A3C')}</button></div>
    </div>
  </aside>
  <div class="conteudo" id="tela"></div>
</div>`;
  abrirTela(rota);
  atualizarConexao();
}

async function atualizarConexao() {
  try {
    const r = await fetch('/api/saude').then((x) => x.json());
    const el = $('#estadoConexao'); if (!el) return;
    const ok = r.ops.ok && r.crono.ok;
    el.innerHTML = `<span style="display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; color: ${ok ? 'var(--okTxt)' : 'var(--avisoTxt)'}"><span class="ponto ${ok ? 'pulso' : ''}" style="background: ${ok ? '#34C759' : '#FF9F0A'}"></span>${ok ? 'Tudo conectado' : 'Conexão com problema'}</span>
      <span class="peq" style="line-height: 1.4">Servidor ${r.ops.ok ? r.ops.ms + ' ms' : 'sem resposta'} · cronometragem ${r.crono.ok ? r.crono.ms + ' ms' : 'sem resposta'}</span>`;
    S.saude = r;
  } catch { /* fica como está */ }
}

function selo(id, txt, tipo) { const el = $('#selo-' + id); if (el) el.innerHTML = txt ? `<span class="selo ${tipo}">${esc(txt)}</span>` : ''; }

function cabecalho(sobre, titulo, acoes = '') {
  return `<header class="cab"><div class="col" style="gap: 3px"><span class="sobre">${sobre}</span><h1>${titulo}</h1></div><div class="acoes">${acoes}</div></header>`;
}

function abrirTela(rota) {
  limparTimers();
  fecharCamada();
  document.querySelectorAll('.navItem').forEach((a) => { const at = a.getAttribute('href') === '#/' + rota; a.classList.toggle('atual', at); at ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
  const velha = $('#tela'); if (!velha) return;
  const tela = velha.cloneNode(false); velha.replaceWith(tela); // elemento novo: os cliques da tela anterior não se acumulam
  tela.innerHTML = `<div class="principal"><div class="esqueleto" style="height: 60px; width: 320px"></div><div class="esqueleto" style="height: 120px"></div><div class="esqueleto" style="height: 360px"></div></div>`;
  S.tela = {};
  Promise.resolve(TELAS[rota](tela)).catch((e) => { tela.innerHTML = `<div class="principal"><div class="cartao"><div class="vazio"><b>Não deu para carregar</b><span>${esc(e.message)}</span><button class="btn sec" style="margin-top: 10px" onclick="location.reload()">Tentar de novo</button></div></div></div>`; });
  window.scrollTo(0, 0);
}

// ------------------------------------------------------------------ camada (gaveta, modal)
function fecharCamada() { $('#camada').innerHTML = ''; }
function gaveta(html) { $('#camada').innerHTML = `<aside class="gaveta" aria-label="Detalhe">${html}</aside>`; return $('#camada .gaveta'); }
function modal(html) { $('#camada').innerHTML = `<div class="veu"><div class="modal" role="dialog">${html}</div></div>`; return $('#camada .modal'); }

// ------------------------------------------------------------------ classificação das baterias (mesmas cores do FamilyWall)
const TIPOS = {
  livre: { t: 'Vagas abertas', curto: 'Vagas', fundo: 'background: #E3F6F4; color: #0B5F5A', cor: '#2CB5AC', cheio: '#0E9C9C', topo: 'background: linear-gradient(160deg, #D5F3F0, #EAF8F6); color: #0B4F4B' },
  reserva: { t: 'Com reserva', curto: 'Reserva', fundo: 'background: #FFEBCC; color: #6B4000', cor: '#FF9F0A', cheio: '#E08700', topo: 'background: linear-gradient(160deg, #FFE1B3, #FFF2DE); color: #5C3700' },
  fechada: { t: 'Bateria fechada', curto: 'Fechada', fundo: 'background: #FFDAD7; color: #8F1F18', cor: '#FF453A', cheio: '#D92D20', topo: 'background: linear-gradient(160deg, #FFCBC6, #FFE7E5); color: #7A1A14' },
  camp: { t: 'Campeonato', curto: 'Camp.', fundo: 'background: #D3EBDF; color: #084D34', cor: '#0B7A53', cheio: '#0B7A53', topo: 'background: linear-gradient(160deg, #C4E5D5, #E4F3EB); color: #084D34' },
  evento: { t: 'Evento ou treino', curto: 'Evento', fundo: 'background: #DCE8FB; color: #133F8C', cor: '#1E6FE8', cheio: '#1E6FE8', topo: 'background: linear-gradient(160deg, #CCDDFA, #E8F0FD); color: #123A80' },
  bloq: { t: 'Bloqueado', curto: 'Bloq.', fundo: 'background: repeating-linear-gradient(135deg, #E9E9EE 0 6px, #F4F4F7 6px 12px); color: #48484A', cor: '#8E8E93', cheio: '#8E8E93', topo: 'background: linear-gradient(160deg, #E5E5EA, #F2F2F5); color: #3A3A3C' },
};
const ORDEM_TIPOS = ['livre', 'reserva', 'fechada', 'camp', 'evento', 'bloq'];
function tipoDe(b) {
  const nome = `${b.nome || ''} ${b.produto || ''} ${b.categoria || ''}`.toLowerCase();
  if (+b.vagas === 0 || b.autoAtendimento === false || b.autoAtendimento === 0) return 'bloq';
  if (b.reservaFechada) return 'fechada';
  if (/kac|legends|ultras|campeonato|etapa|copa|endurance|milhas/.test(nome) && !/treino/.test(nome)) return 'camp';
  if (/treino|evento|tabajara|bier|super quinta|time attack|ins[oô]nia|empresa|equaliza|anivers/.test(nome)) return 'evento';
  return (+b.inscritos || 0) > 0 ? 'reserva' : 'livre';
}
function situacaoBateria(b) {
  const dia = b.dataHora.slice(0, 10), hoje = hojeIso(), ini = hm(horaDe(b.dataHora)), agora = agoraMin();
  if (b.status === 'fechada' || dia < hoje || (dia === hoje && ini + 35 <= agora)) return 'fim';
  if (dia === hoje && ini <= agora && agora < ini + 35) return 'pista';
  return 'futura';
}

// ------------------------------------------------------------------ como mostrar uma bateria (agenda e visão geral usam as mesmas regras)
const generico = (nome) => /^\s*bateria\s*\d*\s*$/i.test(nome || '');
/** O nome que importa: o responsável do grupo, o evento ou o campeonato; "Bateria 04" sozinho não diz nada. */
const tituloBat = (b, tp = tipoDe(b), curto = false) => {
  const n = +b.inscritos || 0;
  if (tp === 'camp') return b.nome;
  if (tp === 'evento') return b.responsavel || b.nome;
  if (tp === 'bloq') return b.responsavel || (!generico(b.nome) ? b.nome : n ? `${n} piloto${n === 1 ? '' : 's'}` : 'Bloqueado');
  if (tp === 'livre') return 'Livre';
  return b.responsavel || (generico(b.nome) ? (curto ? `${n} avulso${n === 1 ? '' : 's'}` : `${n} piloto${n === 1 ? '' : 's'} avulso${n === 1 ? '' : 's'}`) : b.nome);
};
const falta = (b) => Math.max(0, (+b.inscritos || 0) - (+b.pagos || 0));
const faltaValor = (b) => falta(b) * (+b.preco || 0);
const urgente = (b) => b.dataHora.slice(0, 10) === hojeIso() && hm(horaDe(b.dataHora)) - agoraMin() <= 180;
const livresTxt = (b, st = situacaoBateria(b), tp = tipoDe(b)) => {
  const l = +b.disponiveis || 0, n = +b.inscritos || 0;
  if (st === 'fim') return n ? `${n} correram` : 'não correu';
  if (tp === 'fechada') return 'Fechada';
  if (tp === 'bloq') return 'Bloqueada';
  return l === 0 ? 'Lotada' : `${l} ${l === 1 ? 'livre' : 'livres'}`;
};
const amostra = (t, on) => t === 'livre'
  ? `background: #FFF; box-shadow: inset 0 0 0 1.5px ${on ? '#636366' : '#C7C7CC'}`
  : t === 'bloq' ? (on ? TIPOS.bloq.fundo + '; box-shadow: inset 0 0 0 1px #AEAEB2' : 'background: #FFF; box-shadow: inset 0 0 0 1.5px #C7C7CC')
    : on ? 'background: ' + TIPOS[t].cor : 'background: #FFF; box-shadow: inset 0 0 0 1.5px #C7C7CC';

// ------------------------------------------------------------------ busca geral
function abrirBusca() {
  const m = modal(`<div style="padding: 0"><label style="display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--linha2); background: #FFF">${svg(IC.busca, 17, '#6E6E73')}<input id="qBusca" placeholder="Nome, CPF, telefone ou nome de tela…" aria-label="Buscar" style="flex-grow: 1; min-width: 0; border: 0; outline: none; background: transparent; font-size: 15px"><button class="btn sec peq" data-acao="fechar">Fechar</button></label><div id="resBusca" style="max-height: 440px; overflow-y: auto; padding: 6px; background: #FFF"></div></div>`);
  m.style.maxWidth = '600px';
  const entrada = $('#qBusca'); entrada.focus();
  let t;
  const telas = NAV.flatMap((g) => g.itens);
  const pintar = async () => {
    const q = entrada.value.trim(); const qq = q.toLowerCase();
    const achadas = telas.filter(([, t2]) => !qq || t2.toLowerCase().includes(qq));
    let html = achadas.map(([id, t2, ic, cor]) => `<a href="#/${id}" class="hov" data-acao="fechar" style="display: flex; align-items: center; gap: 10px; height: 42px; padding: 0 10px; border-radius: 9px; text-decoration: none; color: var(--tinta)"><span class="tile" style="width: 26px; height: 26px; background: ${cor}">${svg(ic, 13, '#FFF')}</span><span style="flex-grow: 1; font-weight: 500">${t2}</span><span class="peq">Tela</span></a>`).join('');
    if (q.length >= 2) {
      html += `<div class="peq" style="padding: 10px 10px 4px">Clientes</div><div id="cliBusca"><div class="esqueleto" style="height: 40px; margin: 4px"></div></div>`;
    }
    $('#resBusca').innerHTML = html || '<p class="vazio">Nada encontrado.</p>';
    if (q.length >= 2) {
      try {
        const cli = await office('/clientes?q=' + encodeURIComponent(q));
        const alvo = $('#cliBusca'); if (!alvo || entrada.value.trim() !== q) return;
        alvo.innerHTML = cli.length ? cli.slice(0, 20).map((c) => `<div style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 9px"><span class="avatar" style="width: 30px; height: 30px; font-size: 11px; background: ${CORG[c.id % 6]}">${esc(iniciais(c.nome))}</span><span class="col" style="flex-grow: 1"><b class="trunc">${esc(c.nome)}</b><span class="peq">${esc(c.documento || 'sem documento')} · ${esc(c.telefone || 'sem telefone')}${c.peso ? ' · ' + esc(c.peso) + ' kg' : ''}</span></span>${c.telefone ? `<a class="btn verdeClaro peq" target="_blank" rel="noopener" href="${esc(zap(c.telefone, 'Olá, ' + c.nome.split(' ')[0] + '! Aqui é do Kartódromo de Betim.'))}">WhatsApp</a>` : ''}</div>`).join('') : '<p class="peq" style="padding: 8px 10px">Nenhum cliente com esse nome, CPF ou telefone.</p>';
      } catch (e) { const alvo = $('#cliBusca'); if (alvo) alvo.innerHTML = `<p class="peq" style="padding: 8px 10px">${esc(e.message)}</p>`; }
    }
  };
  entrada.addEventListener('input', () => { clearTimeout(t); t = setTimeout(pintar, 250); });
  pintar();
}

// ------------------------------------------------------------------ TELAS
const TELAS = {};

// ---------- Visão geral
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
TELAS.visao = async (tela) => {
  const hoje = hojeIso();
  const d = deIso(hoje);
  const nomeU = (S.usuario?.nome || '').split(' ')[0];
  const h = agoraMin();
  const saud = h < 12 * 60 ? 'Bom dia' : h < 18 * 60 ? 'Boa tarde' : 'Boa noite';
  tela.innerHTML = `${cabecalho(`${DIAS[d.getDay()][0].toUpperCase() + DIAS[d.getDay()].slice(1)}, ${d.getDate()} de ${MESES[d.getMonth()]}<span id="atualizadoV" style="color: var(--mudo2); font-weight: 500"></span>`, `${saud}, ${esc(nomeU)}`, `<a href="#/agenda" class="btn branco">Abrir agenda</a><button class="btn prim" data-nova-reserva="1">${svg(IC.mais, 14, '#FFF', 2.6)}Nova reserva</button>`)}
  <main class="principal">
    <section id="pendencias" aria-live="polite"><div class="esqueleto" style="height: 56px"></div></section>
    <section class="kpis kpis4" id="kpis">${'<div class="esqueleto" style="height: 112px"></div>'.repeat(4)}</section>
    <div class="linhaFlex" style="align-items: stretch">
      <section class="cartao" id="agoraSeguir" style="flex: 999 1 540px; min-width: 0"><div class="esqueleto" style="height: 220px; margin: 16px"></div></section>
      <section class="placar" id="emPista" style="flex: 1 1 360px; min-width: 0"><div style="padding: 18px; color: #A1A1A6">Carregando a cronometragem…</div></section>
    </div>
    <section class="cartao" id="linhaDia"><div class="esqueleto" style="height: 150px; margin: 16px"></div></section>
  </main>`;
  const irAgenda = (b) => { S.irAgenda = { dia: b.dataHora.slice(0, 10), id: b.id }; location.hash = '#/agenda'; };
  const prontoTotem = (r) => !!(r.documento && r.peso && r.telefone);
  let bats = [];

  const pintarPendencias = (online, aprovar, abertos) => {
    const restantes = bats.filter((b) => situacaoBateria(b) !== 'fim');
    const itens = [];
    const atencao = online.filter((o) => o.status === 'pago_sem_vaga');
    if (atencao.length) itens.push(['vermelho', `${plural(atencao.length, 'reserva do site paga', 'reservas do site pagas')} sem vaga`, 'O horário lotou depois do pagamento: devolva o dinheiro ou remarque com o cliente.', 'Resolver', '#/reservas']);
    if (S.saude && !S.saude.ops.ok) itens.push(['vermelho', 'Servidor da operação sem resposta', 'Recepção, totem e site podem não estar gravando. Veja o SRVKART.', 'Ver PCs', '#/sistema']);
    if (S.saude && !S.saude.crono.ok) itens.push(['vermelho', 'Cronometragem sem resposta', 'O placar e os resultados não estão chegando do ORBITS.', 'Ver PCs', '#/sistema']);
    if (aprovar.length) itens.push(['laranja', `${plural(aprovar.length, 'pré-reserva do totem', 'pré-reservas do totem')} para aprovar`, 'Os pilotos estão esperando a confirmação da Recepção.', 'Aprovar', '#/recepcao']);
    if (!abertos.length && restantes.length) itens.push(['laranja', 'Nenhum caixa aberto', `Abra o caixa no programa da Recepção antes da bateria das ${horaDe(restantes[0].dataHora)}.`, 'Ver Recepção', '#/recepcao']);
    const devendo = restantes.filter((b) => falta(b) > 0 && urgente(b));
    if (devendo.length === 1) { const b = devendo[0]; itens.push(['laranja', `${tituloBat(b)} · ${horaDe(b.dataHora)} ainda não pagou tudo`, `${plural(falta(b), 'piloto sem pagar', 'pilotos sem pagar')}${+b.preco ? ' · falta ' + brl(faltaValor(b)) : ''}`, 'Ver na agenda', `bat:${b.id}`]); }
    else if (devendo.length > 1) itens.push(['laranja', `${devendo.length} baterias das próximas 3 horas com piloto sem pagar`, `${devendo.map((b) => `${horaDe(b.dataHora)} ${tituloBat(b)}`).join(' · ')}${devendo.some((b) => +b.preco) ? ' · falta ' + brl(devendo.reduce((x, b) => x + faltaValor(b), 0)) : ''}`, 'Ver quem falta', 'lista']);
    const el = $('#pendencias');
    if (!itens.length) { el.innerHTML = `<div class="tudoEmDia">${svg(IC.ok, 16, '#1C6B35', 2.8)}<b>Tudo em dia</b><span>nenhuma pendência agora</span></div>`; return; }
    el.innerHTML = `<div class="cartao pendencias"><div class="cartaoCab"><h2>Precisa de você agora</h2><span class="selo ${itens.some((i) => i[0] === 'vermelho') ? 'vermelho' : 'laranjaS'}" style="margin-left: 0">${itens.length}</span></div>
      ${itens.map(([nivel, t, dd, botao, alvo]) => `<div class="pendencia ${nivel}"><span class="col" style="flex: 1 1 260px; gap: 2px"><b>${esc(t)}</b><span class="peq" style="line-height: 1.45">${esc(dd)}</span></span>${alvo === 'lista' ? `<button class="btn sec peq" data-ir-lista="1">${botao}</button>` : alvo.startsWith('bat:') ? `<button class="btn ${nivel === 'vermelho' ? 'perigo' : 'sec'} peq" data-ir-bat="${alvo.slice(4)}">${botao}</button>` : `<a class="btn ${nivel === 'vermelho' ? 'perigo' : 'sec'} peq" href="${alvo}">${botao}</a>`}</div>`).join('')}</div>`;
  };

  const pintarKpis = (online, movs) => {
    const vagas = bats.reduce((a, b) => a + (+b.vagas || 0), 0), insc = bats.reduce((a, b) => a + (+b.inscritos || 0), 0), oc = vagas ? insc / vagas : 0;
    const pagasOnline = online.filter((o) => o.status === 'pago' || o.status === 'resolvido');
    const recebidoCaixa = movs.filter((m) => (m.abertoEm || '').slice(0, 10) === hoje || !m.fechadoEm).reduce((a, m) => a + (+m.recebido || 0), 0);
    const recebidoOnline = pagasOnline.reduce((a, o) => a + (+o.valor || 0), 0);
    // o dia inteiro: quem já correu sem pagar também é dinheiro a receber
    const devendo = bats.filter((b) => falta(b) > 0), aReceber = devendo.reduce((a, b) => a + faltaValor(b), 0), temUrgente = devendo.some((b) => situacaoBateria(b) !== 'fim' && urgente(b));
    const jaCorreram = devendo.filter((b) => situacaoBateria(b) === 'fim').length;
    const feitas = bats.filter((b) => situacaoBateria(b) === 'fim').length, naPista = bats.find((b) => situacaoBateria(b) === 'pista'), prox = bats.find((b) => situacaoBateria(b) === 'futura');
    const kpi = (t, v, nota, link, extra = '', estiloV = '') => `<a href="${link}" class="kpi ergue"><span class="rot">${t}</span><span class="col" style="gap: 4px"><span class="val" style="${estiloV}">${v}</span><span class="peq">${nota}</span></span>${extra}</a>`;
    const segmentos = `<span class="segmentos" role="img" aria-label="${feitas} baterias terminadas de ${bats.length}">${bats.map((b) => { const st = situacaoBateria(b); return `<span class="${st}"></span>`; }).join('')}</span>`;
    $('#kpis').innerHTML = [
      kpi('Pilotos hoje', insc, `de ${vagas} vagas · ${Math.round(oc * 100)}% ocupado`, '#/agenda', `<span class="barra" role="img" aria-label="${Math.round(oc * 100)}% das vagas ocupadas"><span style="width: ${Math.min(100, Math.round(oc * 100))}%; background: ${oc > .8 ? '#D92D20' : oc > .5 ? '#E08700' : '#1E9E4A'}"></span></span>`),
      kpi('Recebido hoje', brlCurto(recebidoCaixa + recebidoOnline), `caixa ${brlCurto(recebidoCaixa)} · site ${brlCurto(recebidoOnline)} (${plural(pagasOnline.length, 'reserva', 'reservas')})`, '#/reservas'),
      kpi('A receber hoje', devendo.length ? brlCurto(aReceber) : 'Nada', devendo.length ? `${plural(devendo.length, 'bateria', 'baterias')} com piloto sem pagar${jaCorreram ? ` (${jaCorreram} já ${jaCorreram === 1 ? 'correu' : 'correram'})` : ''}` : 'todos os pilotos de hoje pagaram', '#/agenda', '', devendo.length && temUrgente ? 'color: var(--avisoTxt)' : ''),
      kpi('Baterias', bats.length ? `${feitas} de ${bats.length}` : '—', naPista ? `${esc(tituloBat(naPista))} na pista` : prox ? `próxima às ${horaDe(prox.dataHora)}` : bats.length ? 'todas já correram' : 'sem baterias hoje', '#/crono', bats.length ? segmentos : ''),
    ].join('');
  };

  const painelBateria = (b, rotulo, rs) => {
    const tp = tipoDe(b), T = TIPOS[tp], n = +b.inscritos || 0, vagas = +b.vagas || 0, pagos = +b.pagos || 0;
    const prontos = rs ? rs.filter((r) => r.status !== 'cancelada' && prontoTotem(r)).length : null;
    const ini = hm(horaDe(b.dataHora)), falt = ini - agoraMin();
    const quando = situacaoBateria(b) === 'pista' ? '<span class="chip" style="background: #34C759; color: #FFF">Na pista agora</span>' : `<span class="chip cinza">${rotulo}${falt > 0 && falt < 180 ? ` · em ${falt} min` : ''}</span>`;
    const sub = [generico(b.nome) ? '' : b.nome, b.produto, b.tipoKart].filter(Boolean).filter((x) => x !== tituloBat(b, tp)).map(esc).join(' · ');
    return `<div class="painelBat">
      <span style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">${quando}<span class="mono peq" style="color: var(--tinta2)">${horaDe(b.dataHora)}–${fmtHm(ini + 35)}</span></span>
      <span class="col" style="gap: 2px"><b style="font-size: 18px; letter-spacing: -0.01em">${esc(tp === 'livre' ? 'Horário livre' : tituloBat(b, tp))}</b>${sub ? `<span class="peq">${sub}</span>` : ''}</span>
      <span class="numerosBat">
        <span><b>${n}</b><span>de ${vagas} pilotos</span></span>
        <span><b style="color: ${n && pagos < n ? 'var(--avisoTxt)' : 'var(--tinta)'}">${pagos}</b><span>pagos${n && pagos < n && +b.preco ? ` · falta ${brlCurto(faltaValor(b))}` : ''}</span></span>
        <span><b style="color: ${prontos !== null && prontos < n ? 'var(--avisoTxt)' : 'var(--tinta)'}">${prontos === null ? '—' : prontos}</b><span>prontos p/ totem</span></span>
      </span>
      <span style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: auto"><a class="btn sec peq" href="#/recepcao" data-ir-recepcao="${b.id}">Ver pilotos</a><button class="btn sec peq" data-ir-bat="${b.id}">Abrir na agenda</button></span>
    </div>`;
  };
  const pintarAgora = async () => {
    const naPista = bats.find((b) => situacaoBateria(b) === 'pista'), futuras = bats.filter((b) => situacaoBateria(b) === 'futura');
    const foco = (naPista ? [[naPista, 'Na pista'], futuras[0] && [futuras[0], 'Próxima']] : [futuras[0] && [futuras[0], 'Próxima'], futuras[1] && [futuras[1], 'Depois']]).filter(Boolean);
    const el = $('#agoraSeguir');
    if (!foco.length) {
      const correram = bats.reduce((a, b) => a + (+b.inscritos || 0), 0), amanha = somaDias(hoje, deIso(somaDias(hoje, 1)).getDay() === 1 ? 2 : 1);
      el.innerHTML = `<div class="cartaoCab"><h2>Agora e a seguir</h2></div><div class="fimDoDia"><b>${bats.length ? 'As baterias de hoje acabaram' : 'Sem baterias hoje'}</b><span class="peq" style="font-size: 13px">${bats.length ? `${plural(correram, 'piloto correu', 'pilotos correram')} em ${plural(bats.length, 'bateria', 'baterias')}.` : d.getDay() === 1 ? 'Segunda o kartódromo não abre.' : 'Dia fechado ou grade ainda não gerada.'}</span><span style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px"><button class="btn sec peq" data-ir-dia="${amanha}">Ver ${amanha === somaDias(hoje, 1) ? 'amanhã' : 'terça'} na agenda</button><button class="btn sec peq" data-nova-reserva="1">Nova reserva</button></span></div>`;
      return;
    }
    const rs = await Promise.all(foco.map(([b]) => (+b.inscritos ? office(`/reservas?bateriaId=${b.id}&status=todas`).catch(() => null) : Promise.resolve([]))));
    if (!$('#agoraSeguir')) return;
    el.innerHTML = `<div class="cartaoCab"><h2>Agora e a seguir</h2><a class="dir" href="#/agenda" style="font-size: 13px; font-weight: 600; text-decoration: none">Agenda do dia</a></div><div class="agoraGrade">${foco.map(([b, r], i) => painelBateria(b, r, rs[i])).join('')}</div>`;
  };

  const blocoDia = (b) => {
    const tp = tipoDe(b), T = TIPOS[tp], st = situacaoBateria(b), n = +b.inscritos || 0, vagas = Math.max(1, +b.vagas || 0);
    const cls = ['bloco2', tp === 'livre' ? 'livre' : tp === 'bloq' ? 'bloq' : '', st === 'fim' ? 'passou' : '', st === 'pista' ? 'pista' : ''].filter(Boolean).join(' ');
    const titulo = tituloBat(b, tp, true), dir = livresTxt(b, st, tp);
    return `<button class="${cls}" data-ir-bat="${b.id}" style="${tp === 'livre' || tp === 'bloq' ? '' : `${T.fundo}; --faixa: ${T.cor}`}" aria-label="${esc(`${horaDe(b.dataHora)}, ${titulo}, ${T.t}, ${dir}`)}">
      <span class="linha1"><span class="mono hora">${horaDe(b.dataHora)}</span>${st === 'pista' ? '<span class="naPista">na pista</span>' : `<span class="dirB">${dir}</span>`}</span>
      <span class="tituloB trunc">${esc(tp === 'livre' ? 'Livre' : titulo)}</span>${st !== 'fim' && falta(b) && tp !== 'livre' ? `<span class="aPagarB">${falta(b)} a pagar</span>` : ''}${tp === 'livre' ? '' : `<span class="barraB" style="width: ${Math.round(Math.min(1, n / vagas) * 100)}%; background: ${T.cheio}"></span>`}</button>`;
  };
  const pintarLinha = () => {
    const el = $('#linhaDia');
    if (!bats.length) { el.innerHTML = `<div class="cartaoCab"><h2>Linha do dia</h2></div><div class="vazio"><b>Sem baterias hoje</b><span>${d.getDay() === 1 ? 'Segunda o kartódromo não abre.' : 'Dia fechado ou grade ainda não gerada.'}</span></div>`; return; }
    el.innerHTML = `<div class="cartaoCab"><span class="col"><h2>Linha do dia</h2><span class="sub">toque numa bateria para abrir na agenda</span></span><span class="dir legendaCurta"><span><span class="amostra" style="${amostra('livre', true)}"></span>livre</span><span><span class="amostra" style="background: #FFEBCC; box-shadow: inset 3px 0 0 #FF9F0A"></span>com reserva ou evento</span><span><span class="amostra" style="box-shadow: inset 0 0 0 2px #FF3B30"></span>na pista</span></span></div>
      <div class="rolagemX" id="rolaLinha" style="padding: 0 18px 16px"><div class="linhaBlocos">${bats.map(blocoDia).join('')}</div></div>`;
    const foco = el.querySelector('.bloco2.pista') || el.querySelector('.bloco2:not(.passou)'), rola = $('#rolaLinha');
    if (foco && rola) rola.scrollLeft = Math.max(0, foco.offsetLeft - rola.offsetLeft - 160);
  };

  const carregar = async () => {
    const [bs, online, aprovar, movs] = await Promise.all([
      office(`/baterias?status=todas&data=${hoje}`),
      office(`/reservas-online?status=todas&data=${hoje}`).catch(() => []),
      office(`/reservas?status=aprovar&filtro=apartir&data=${hoje}`).catch(() => []),
      office('/movimentos').catch(() => []),
    ]);
    bats = bs.filter((b) => b.dataHora.startsWith(hoje)).sort((x, y) => x.dataHora.localeCompare(y.dataHora));
    if (!$('#kpis')) return;
    const at = $('#atualizadoV'); if (at) at.textContent = ` · atualizado às ${new Date().toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })}`;
    const abertos = movs.filter((m) => !m.fechadoEm);
    selo('recepcao', aprovar.length ? String(aprovar.length) : '', 'vermelho');
    const nAt = online.filter((o) => o.status === 'pago_sem_vaga').length; selo('reservas', nAt ? String(nAt) : '', 'vermelho');
    pintarPendencias(online, aprovar, abertos);
    pintarKpis(online, movs);
    pintarLinha();
    await pintarAgora();
  };

  const vivo = async () => {
    const el = $('#emPista'); if (!el) return;
    try {
      const s = await api('/crono/ao-vivo');
      const corre = s.status === 'live' || s.status === 'running';
      selo('crono', corre ? 'ao vivo' : '', 'vivo');
      const pil = (s.drivers || []).filter((p) => +p.position < 900).slice(0, 5);
      const largou = s.race && s.race.startedAt ? new Date(s.race.startedAt) : null;
      const min = largou ? Math.max(0, Math.round((Date.now() - largou.getTime()) / 60000)) : null;
      if (!corre && !pil.length) { el.innerHTML = `<div class="placarVazio"><span class="chip" style="background: rgba(255,255,255,0.1); color: #D1D1D6">CRONOMETRAGEM</span><b>Nenhuma bateria na pista</b><span>O placar aparece aqui quando a próxima largar.</span><a href="#/crono">Abrir cronometragem${svg(IC.dir, 14, '#5EDB7A', 2.4)}</a></div>`; return; }
      el.innerHTML = `<div style="display: flex; flex-direction: column; gap: 4px; padding: 16px 18px 10px">
          <span style="display: flex; align-items: center; gap: 8px"><span class="chip" style="background: ${corre ? 'rgba(52,199,89,0.2)' : 'rgba(255,255,255,0.1)'}; color: ${corre ? '#5EDB7A' : '#D1D1D6'}; letter-spacing: .05em">${corre ? '<span class="ponto pulso" style="background: #5EDB7A"></span>AO VIVO' : 'ÚLTIMA BATERIA'}</span>${largou ? `<span style="font-size: 12px; color: #A1A1A6">${corre ? `largou às ${largou.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })} · há ${min} min` : `largou às ${largou.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })}`}</span>` : ''}</span>
          <h2 style="margin: 0; font-size: 16px; font-weight: 700">${esc(s.eventName || 'Bateria')}</h2></div>
        <div class="linha cabPlacar"><span>Pos</span><span>Kart</span><span>Piloto</span><span style="text-align: right">Melhor volta</span></div>
        ${pil.map((p, i) => `<div class="linha"><span style="font-size: 15px; font-weight: 700; color: ${i < 3 ? '#FFD24A' : '#FFF'}">${esc(p.position)}</span><span class="kartE">${esc(p.kart)}</span><span class="trunc" style="font-weight: 600">${esc(p.name)}</span><span class="mono" style="text-align: right; font-size: 13px">${esc(p.time || '—')}</span></div>`).join('') || '<div style="padding: 14px 20px; color: #A1A1A6">Largou agora: ninguém completou volta ainda.</div>'}
        <a href="#/crono" class="linkPlacar">${(s.drivers || []).length > 5 ? `Ver os ${(s.drivers || []).length} pilotos na cronometragem` : 'Abrir cronometragem'}${svg(IC.dir, 14, '#5EDB7A', 2.4)}</a>`;
    } catch (e) { el.innerHTML = `<div class="placarVazio"><b>Cronometragem sem resposta</b><span>${esc(e.message)}</span><a href="#/sistema">Ver PCs e sistema${svg(IC.dir, 14, '#5EDB7A', 2.4)}</a></div>`; }
  };

  tela.addEventListener('click', (e) => {
    if (e.target.closest('[data-nova-reserva]')) { S.irAgendaNova = true; location.hash = '#/agenda'; return; }
    const dd = e.target.closest('[data-ir-dia]'); if (dd) { S.agenda = { ...(S.agenda || { ocultos: {}, q: '' }), vista: 'dia', base: dd.dataset.irDia, sel: null }; location.hash = '#/agenda'; return; }
    if (e.target.closest('[data-ir-lista]')) { S.agenda = { ...(S.agenda || { ocultos: {}, q: '' }), vista: 'lista', base: hoje, sel: null }; location.hash = '#/agenda'; return; }
    const b = e.target.closest('[data-ir-bat]'); if (b) { const x = bats.find((y) => y.id === +b.dataset.irBat); if (x) irAgenda(x); return; }
    const rc = e.target.closest('[data-ir-recepcao]'); if (rc) S.irBateria = +rc.dataset.irRecepcao;
  });
  await atualizarConexao();
  await carregar();
  vivo();
  repetir(carregar, 30_000); repetir(vivo, 5_000); repetir(atualizarConexao, 60_000);
};

// ---------- Agenda
TELAS.agenda = async (tela) => {
  const celular = () => window.matchMedia('(max-width: 760px)').matches;
  const A = S.agenda || (S.agenda = { vista: celular() ? 'dia' : 'semana', base: hojeIso(), ocultos: {}, q: '' });
  if (S.irAgenda) { A.base = S.irAgenda.dia; A.sel = S.irAgenda.id; A.vista = celular() ? 'dia' : 'semana'; S.irAgenda = null; }
  tela.innerHTML = `${cabecalho('<span class="ponto pulso" style="background: #34C759"></span><span style="color: var(--okTxt)">Mesma agenda da Recepção, do site e dos totens</span><span id="atualizado" style="color: var(--mudo2); font-weight: 500"></span>', 'Agenda <span id="periodo" style="font-size: 17px; font-weight: 600; color: var(--mudo); letter-spacing: 0"></span>', `
    <button class="btn prim" data-nova="1" title="Nova reserva (tecla N)">${svg(IC.mais, 14, '#FFF', 2.6)}Nova reserva</button>
    <div style="display: flex; align-items: center; gap: 2px; height: 36px; padding: 0 3px; border-radius: 10px; background: #FFF; box-shadow: 0 0 0 1px var(--linha2)"><button class="btn sec peq hov" data-nav="-1" aria-label="Anterior" title="Anterior (seta para a esquerda)" style="background: transparent; width: 30px; padding: 0">${svg(IC.esq, 15)}</button><button class="btn sec peq" data-nav="0" title="Voltar para hoje (tecla T)">Hoje</button><button class="btn sec peq hov" data-nav="1" aria-label="Próximo" title="Próximo (seta para a direita)" style="background: transparent; width: 30px; padding: 0">${svg(IC.dir, 15)}</button></div>
    <div class="seg" role="tablist" aria-label="Vista">${[['dia', 'Dia', 'D'], ['semana', 'Semana', 'S'], ['lista', 'Lista', 'L']].map(([v, t, k]) => `<button role="tab" data-vista="${v}" aria-selected="${A.vista === v}" title="${t} (tecla ${k})" class="${A.vista === v ? 'sel' : ''}">${t}</button>`).join('')}</div>`)}
  <main class="principal agendaLayout">
    <div class="agendaLado">
      <section class="cartao leve" style="padding: 12px" id="miniCal"></section>
      <section class="cartao leve" style="padding: 8px" id="filtrosTipo"></section>
      <section class="cartao leve" id="aPagar"></section>
    </div>
    <section class="cartao agendaCal" id="calendario" aria-live="polite"><div class="esqueleto" style="height: 600px; margin: 16px"></div></section>
  </main>`;
  let bats = [];
  const semanaIni = () => { const d = deIso(A.base); d.setDate(d.getDate() - d.getDay()); return iso(d); };

  const carregar = async () => {
    const cal = $('#calendario'); cal.setAttribute('aria-busy', 'true'); cal.classList.add('carregando');
    try {
      bats = A.vista === 'lista'
        ? await office(`/baterias?status=todas&filtro=entre&data=${A.base}&ate=${somaDias(A.base, 6)}`)
        : await office(`/baterias?status=todas&filtro=semana&data=${semanaIni()}`);
      bats.sort((x, y) => x.dataHora.localeCompare(y.dataHora));
      const at = $('#atualizado'); if (at) at.textContent = ` · atualizado às ${new Date().toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })}`;
      pintar();
      pintarMini();
    } finally { cal.removeAttribute('aria-busy'); cal.classList.remove('carregando'); }
  };
  const recarregar = async () => { const sel = A.sel; await carregar(); if (sel && !$('#camada .modal')) abrirBateria(sel); };
  const filtrar = (lista) => lista.filter((b) => !A.ocultos[tipoDe(b)] && (!A.q || `${b.nome} ${b.produto} ${b.responsavel || ''}`.toLowerCase().includes(A.q.toLowerCase())));

  const blocoSemana = (b) => {
    const tp = tipoDe(b), T = TIPOS[tp], st = situacaoBateria(b), n = +b.inscritos || 0, vagas = Math.max(1, +b.vagas || 0);
    const cls = ['bloco2', tp === 'livre' ? 'livre' : tp === 'bloq' ? 'bloq' : '', st === 'fim' ? 'passou' : '', st === 'pista' ? 'pista' : '', A.sel === b.id ? 'sel' : ''].filter(Boolean).join(' ');
    const estilo = tp === 'livre' || tp === 'bloq' ? '' : `${T.fundo}; --faixa: ${T.cor}`;
    const titulo = tituloBat(b, tp, true), dir = livresTxt(b, st, tp);
    const aPagar = st !== 'fim' && falta(b) && tp !== 'livre' ? `<span class="aPagarB">${falta(b)} a pagar</span>` : '';
    return `<button class="${cls}" data-sel="${b.id}" style="${estilo}" aria-label="${esc(`${horaDe(b.dataHora)}, ${titulo}, ${T.t}, ${dir}`)}">
      <span class="linha1"><span class="mono hora">${horaDe(b.dataHora)}</span>${st === 'pista' ? '<span class="naPista">na pista</span>' : ''}<span class="dirB">${dir}</span></span>
      ${tp === 'livre' ? '' : `<span class="tituloB trunc">${esc(titulo)}</span>${aPagar}<span class="barraB" style="width: ${Math.round(Math.min(1, n / vagas) * 100)}%; background: ${T.cheio}"></span>`}</button>`;
  };

  const pintar = () => {
    const ini = semanaIni(), fimSem = somaDias(ini, 6), di = deIso(ini), df = deIso(fimSem);
    const lf = somaDias(A.base, 6), dl = deIso(A.base), dlf = deIso(lf);
    $('#periodo').textContent = A.vista === 'semana' ? `${di.getDate()}${di.getMonth() !== df.getMonth() ? ' de ' + MESES[di.getMonth()] : ''} – ${df.getDate()} de ${MESES[df.getMonth()]}`
      : A.vista === 'dia' ? `${DIAS[deIso(A.base).getDay()]}, ${deIso(A.base).getDate()} de ${MESES[deIso(A.base).getMonth()]}`
        : A.base === hojeIso() ? 'próximos 7 dias' : `${dl.getDate()}/${pad(dl.getMonth() + 1)} a ${dlf.getDate()}/${pad(dlf.getMonth() + 1)}`;
    tela.querySelectorAll('[data-vista]').forEach((x) => { x.classList.toggle('sel', x.dataset.vista === A.vista); x.setAttribute('aria-selected', x.dataset.vista === A.vista); });
    const conta = {}; bats.forEach((b) => { const t = tipoDe(b); conta[t] = (conta[t] || 0) + 1; });
    $('#filtrosTipo').innerHTML = `<span class="rotuloLado">Mostrar</span>${ORDEM_TIPOS.map((t) => { const on = !A.ocultos[t]; return `<button class="hov filtroTipo" data-tipo="${t}" role="switch" aria-checked="${on}"><span class="amostra" style="${amostra(t, on)}">${on ? svg(IC.ok, 10, t === 'livre' || t === 'bloq' ? '#3A3A3C' : '#FFF', 3.6) : ''}</span><span style="flex-grow: 1; ${on ? '' : 'color: var(--mudo2)'}">${TIPOS[t].t}</span><span class="peq">${conta[t] || 0}</span></button>`; }).join('')}
      <label class="buscaCampo" style="margin: 6px 4px 4px">${svg(IC.busca, 13, '#8E8E93')}<input id="qAg" value="${esc(A.q)}" placeholder="Responsável, KAC, Legends…" aria-label="Filtrar a agenda pelo nome"></label>`;
    const cal = $('#calendario');
    const hoje = hojeIso(), agora = agoraMin();
    if (A.vista === 'semana') {
      const dias = Array.from({ length: 7 }, (_, k) => somaDias(ini, k));
      const cab = dias.map((dia) => {
        const d = deIso(dia), doDia = bats.filter((b) => b.dataHora.startsWith(dia)), vagas = doDia.reduce((a, b) => a + (+b.vagas || 0), 0), ins = doDia.reduce((a, b) => a + (+b.inscritos || 0), 0), oc = vagas ? ins / vagas : 0;
        return `<button class="hov cabDia ${dia === hoje ? 'hoje' : ''} ${dia < hoje ? 'passado' : ''}" data-dia="${dia}" title="Abrir o dia"><span class="nomeDia">${DIAS[d.getDay()].slice(0, 3)}</span><span class="numDia">${d.getDate()}</span>${doDia.length ? `<span class="ocDia" role="img" aria-label="${Math.round(oc * 100)}% ocupado"><span style="width: ${Math.round(oc * 100)}%; background: ${oc > .8 ? '#D92D20' : oc > .5 ? '#E08700' : '#0B7A53'}"></span></span><span class="resumoDia">${ins} pilotos · ${doDia.length} bat.</span>` : `<span class="resumoDia">fechado</span>`}</button>`;
      }).join('');
      const colunas = dias.map((dia) => {
        const todos = bats.filter((b) => b.dataHora.startsWith(dia)), doDia = filtrar(todos);
        if (!todos.length) return `<div class="colDia2 fechadoDia"><span>Fechado</span></div>`;
        let html = '', marcou = dia !== hoje || agora < hm(horaDe(todos[0].dataHora)) || agora >= hm(horaDe(todos[todos.length - 1].dataHora)) + 35;
        for (const b of doDia) {
          if (!marcou && hm(horaDe(b.dataHora)) > agora) { html += `<div class="agoraMarca"><span>agora · ${fmtHm(agora)}</span></div>`; marcou = true; }
          html += blocoSemana(b);
        }
        const escondidas = todos.length - doDia.length;
        if (escondidas) html += `<span class="peq" style="padding: 4px 6px">+${escondidas} escondida${escondidas > 1 ? 's' : ''} pelo filtro</span>`;
        return `<div class="colDia2 ${dia === hoje ? 'hoje' : ''}">${html}</div>`;
      }).join('');
      const colunasCss = dias.map((dia) => (bats.some((b) => b.dataHora.startsWith(dia)) ? 'minmax(0, 1fr)' : 'minmax(0, .45fr)')).join(' ');
      cal.innerHTML = `<div class="rolagemX"><div class="semana2"><div class="linhaSemana cabSemana" style="grid-template-columns: ${colunasCss}">${cab}</div><div class="linhaSemana" style="grid-template-columns: ${colunasCss}">${colunas}</div></div></div>
        <div class="legendaAg"><span><span class="amostra" style="${amostra('livre', true)}"></span>Contorno = livre para reservar</span><span><span class="amostra" style="background: #FFEBCC; box-shadow: inset 3px 0 0 #FF9F0A"></span>Cor cheia = já tem reserva, evento ou campeonato</span><span><span class="amostra" style="box-shadow: inset 0 0 0 2px #FF3B30"></span>Na pista agora</span><span class="atalhos">Atalhos: <kbd>N</kbd> nova reserva · <kbd>T</kbd> hoje · <kbd>←</kbd><kbd>→</kbd> semana · <kbd>D</kbd><kbd>S</kbd><kbd>L</kbd> vista · <kbd>Esc</kbd> fecha</span></div>`;
    } else if (A.vista === 'dia') {
      const todos = bats.filter((b) => b.dataHora.startsWith(A.base)), doDia = filtrar(todos);
      const d = deIso(A.base), ins = todos.reduce((a, b) => a + (+b.inscritos || 0), 0);
      cal.innerHTML = `<div class="cartaoCab"><h2 style="font-size: 20px">${A.base === hoje ? 'Hoje, ' : ''}${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}</h2><span class="sub">${todos.length ? `${todos.length} baterias de 35 min · ${ins} pilotos` : ''}</span></div>
        ${doDia.length ? doDia.map((b) => {
          const tp = tipoDe(b), T = TIPOS[tp], st = situacaoBateria(b), n = +b.inscritos || 0, vagas = Math.min(20, +b.vagas || 0), f = falta(b);
          const extra = [generico(b.nome) || tituloBat(b, tp) === b.nome ? '' : b.nome, b.produto, b.observacao].filter(Boolean).map(esc).join(' · ');
          return `<button class="hov linhaDia ${A.sel === b.id ? 'sel' : ''} ${st === 'fim' ? 'passou' : ''}" data-sel="${b.id}"><span class="col" style="width: 58px"><span class="mono" style="font-size: 15px; font-weight: 600">${horaDe(b.dataHora)}</span><span class="mono peq">${fmtHm(hm(horaDe(b.dataHora)) + 35)}</span></span><span class="faixaDia" style="${tp === 'livre' ? 'background: #FFF; box-shadow: inset 0 0 0 1.5px #AEAEB2' : tp === 'bloq' ? TIPOS.bloq.fundo : 'background: ' + T.cor}"></span><span class="col" style="flex: 1 1 220px; gap: 4px"><span style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap"><b class="trunc" style="font-size: 14px; ${tp === 'livre' ? 'color: var(--mudo); font-weight: 600' : ''}">${esc(tituloBat(b, tp))}</b>${tp === 'livre' ? '' : `<span class="chip" style="${T.fundo}">${T.curto}</span>`}${st === 'pista' ? '<span class="chip" style="background: #FF3B30; color: #FFF">na pista</span>' : ''}${st !== 'fim' && f ? `<span class="chip ${urgente(b) ? 'laranja' : 'cinza'}">${+b.preco ? brlCurto(faltaValor(b)) + ' a receber' : f + ' a pagar'}</span>` : ''}</span>${extra ? `<span class="peq">${extra}</span>` : ''}</span><span class="vagasDia" role="img" aria-label="${n} de ${+b.vagas || 0} vagas ocupadas">${Array.from({ length: vagas }, (_, k) => `<span style="background: ${k < n ? (tp === 'livre' ? '#8E8E93' : T.cheio) : 'rgba(118,118,128,.14)'}"></span>`).join('')}</span><span class="livresDia" style="color: ${st === 'fim' ? 'var(--mudo)' : +b.disponiveis ? 'var(--okTxt)' : 'var(--erroTxt)'}">${livresTxt(b, st, tp)}</span></button>`;
        }).join('') : todos.length ? '<div class="vazio"><b>Nada com esse filtro</b><span>Ligue os tipos em “Mostrar” ou limpe a busca.</span></div>' : `<div class="vazio"><b>Sem baterias neste dia</b><span>${d.getDay() === 1 ? 'Segunda o kartódromo não abre.' : 'Use as setas para ver outro dia.'}</span></div>`}`;
    } else {
      const comPiloto = filtrar(bats).filter((b) => +b.inscritos > 0);
      const dias = [...new Set(comPiloto.map((b) => b.dataHora.slice(0, 10)))];
      const grade = '58px minmax(0, 1.4fr) minmax(0, .9fr) minmax(0, 1fr) 140px';
      cal.innerHTML = `<div class="cartaoCab"><h2>Reservas ${A.base === hoje ? 'dos próximos 7 dias' : `de ${dl.getDate()}/${pad(dl.getMonth() + 1)} a ${dlf.getDate()}/${pad(dlf.getMonth() + 1)}`}</h2><span class="sub">só as baterias que já têm pilotos</span></div>
        ${dias.length ? `<div class="rolagemX"><div style="min-width: 680px"><div class="cabTabela" style="grid-template-columns: ${grade}"><span>Hora</span><span>Quem</span><span>Pilotos</span><span>Pagamento</span><span style="text-align: right">Falta receber</span></div>${dias.map((dia) => { const d = deIso(dia); const lista = comPiloto.filter((b) => b.dataHora.startsWith(dia)); return `<div class="diaLista"><b>${dia === hoje ? 'Hoje · ' : ''}${DIAS[d.getDay()]}, ${d.getDate()}/${pad(d.getMonth() + 1)}</b><span class="peq">${lista.length} baterias · ${lista.reduce((a, b) => a + +b.inscritos, 0)} pilotos</span></div>${lista.map((b) => { const tp = tipoDe(b), pago = +b.pagos, n = +b.inscritos, st = situacaoBateria(b), f = falta(b); return `<button class="linhaTabela hov ${A.sel === b.id ? 'sel' : ''} ${st === 'fim' ? 'passou' : ''}" data-sel="${b.id}" style="grid-template-columns: ${grade}"><span class="mono" style="font-weight: 600">${horaDe(b.dataHora)}</span><span class="col"><b class="trunc">${esc(tituloBat(b, tp))}</b><span class="peq trunc">${generico(b.nome) ? '' : esc(b.nome) + ' · '}${TIPOS[tp].t}</span></span><span class="peq" style="color: var(--tinta2)">${n} piloto${n > 1 ? 's' : ''} · ${livresTxt(b, st, tp).toLowerCase()}</span><span class="col" style="gap: 4px"><span class="peq">${pago} de ${n} pagos</span><span class="barra" style="height: 5px"><span style="width: ${n ? Math.round(pago / n * 100) : 0}%; background: ${pago < n ? '#FF9F0A' : '#34C759'}"></span></span></span><span style="justify-self: end" class="chip ${!f ? 'verde' : urgente(b) ? 'laranja' : 'cinza'}">${!f ? 'tudo pago' : +b.preco ? brlCurto(faltaValor(b)) : f + ' a pagar'}</span></button>`; }).join('')}`; }).join('')}</div></div>` : `<div class="vazio"><b>Nenhuma reserva nesses 7 dias</b><span>Use “Nova reserva” para marcar um grupo.</span></div>`}`;
    }
    pintarAPagar();
  };

  const pintarMini = async () => {
    const base = deIso(A.base), mes = `${base.getFullYear()}-${pad(base.getMonth() + 1)}`;
    let resumo = [];
    try { resumo = await office(`/agenda?mes=${mes}`); } catch { /* sem resumo: o calendário funciona sem as bolinhas */ }
    const porDia = Object.fromEntries(resumo.map((r) => [r.dia, r]));
    const m0 = new Date(base.getFullYear(), base.getMonth(), 1), ult = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const ini = A.vista === 'lista' ? A.base : semanaIni(), fim = somaDias(ini, 6), hoje = hojeIso();
    let cel = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((c, i) => `<span class="letraDia" aria-hidden="true" title="${DIAS[i]}">${c}</span>`).join('');
    cel += '<span></span>'.repeat(m0.getDay());
    for (let dn = 1; dn <= ult; dn++) {
      const dia = `${mes}-${pad(dn)}`, r = porDia[dia], oc = r && r.vagas ? r.reservas / r.vagas : 0;
      const estilo = dia === hoje ? 'background: var(--verde); color: #FFF; font-weight: 700' : dia === A.base && A.vista === 'dia' ? 'background: var(--tinta); color: #FFF; font-weight: 700' : dia >= ini && dia <= fim && A.vista !== 'dia' ? 'background: rgba(11,122,83,.10); color: var(--verdeEsc); font-weight: 600' : r ? '' : 'color: var(--mudo2)';
      cel += `<button class="hov" data-dia="${dia}" style="${estilo}" aria-label="${dn} de ${MESES[base.getMonth()]}${r ? `, ${r.reservas} de ${r.vagas} vagas ocupadas` : ', sem baterias'}"><span>${dn}</span><span class="ponto" style="width: 4px; height: 4px; background: ${!r ? 'transparent' : oc > .8 ? '#D92D20' : oc > .5 ? '#E08700' : oc > 0 ? '#0B7A53' : '#C7C7CC'}"></span></button>`;
    }
    $('#miniCal').innerHTML = `<div style="display: flex; align-items: center; padding: 2px 4px 8px"><b style="font-size: 14px; text-transform: capitalize">${MESES[base.getMonth()]} ${base.getFullYear()}</b><span style="margin-left: auto; display: flex; gap: 2px"><button class="btn sec peq" data-mes="-1" aria-label="Mês anterior" style="background: transparent; width: 28px; padding: 0">${svg(IC.esq, 13)}</button><button class="btn sec peq" data-mes="1" aria-label="Próximo mês" style="background: transparent; width: 28px; padding: 0">${svg(IC.dir, 13)}</button></span></div><div class="miniCal">${cel}</div>
      <div class="legendaMini"><span><span class="ponto" style="width: 6px; height: 6px; background: #0B7A53"></span>vagas</span><span><span class="ponto" style="width: 6px; height: 6px; background: #E08700"></span>metade</span><span><span class="ponto" style="width: 6px; height: 6px; background: #D92D20"></span>quase cheio</span></div>`;
  };

  const pintarAPagar = () => {
    const futuras = bats.filter((b) => situacaoBateria(b) !== 'fim' && falta(b) > 0).sort((a, b) => (urgente(b) - urgente(a)) || a.dataHora.localeCompare(b.dataHora));
    const total = futuras.reduce((a, b) => a + faltaValor(b), 0), urg = futuras.filter(urgente);
    $('#aPagar').innerHTML = `<div class="cabLado"><span class="col"><b style="font-size: 14px">A receber</b><span class="peq">${A.vista === 'lista' ? 'nestes 7 dias' : 'nesta semana'}${futuras.length ? ` · ${futuras.length} reserva${futuras.length > 1 ? 's' : ''}` : ''}</span></span>${futuras.length ? `<b class="num" style="margin-left: auto; font-size: 16px">${brlCurto(total)}</b>` : ''}</div>
      ${urg.length ? `<p class="avisoHoje">${urg.length} ${urg.length > 1 ? 'reservas começam' : 'reserva começa'} nas próximas 3 horas sem pagar tudo</p>` : ''}
      ${futuras.slice(0, 6).map((b) => { const d = deIso(b.dataHora), u = urgente(b); return `<button class="hov linhaLado" data-sel="${b.id}" data-base="${b.dataHora.slice(0, 10)}"><span class="quando ${u ? 'urgente' : ''}"><span>${b.dataHora.slice(0, 10) === hojeIso() ? 'hoje' : DIAS[d.getDay()].slice(0, 3) + ' ' + d.getDate()}</span><b class="mono">${horaDe(b.dataHora)}</b></span><span class="col" style="flex-grow: 1"><b class="trunc">${esc(tituloBat(b))}</b><span class="peq">${falta(b)} sem pagar</span></span><b style="font-size: 13px; white-space: nowrap; color: ${u ? 'var(--avisoTxt)' : 'var(--tinta2)'}">${+b.preco ? brlCurto(faltaValor(b)) : falta(b) + ' a pagar'}</b></button>`; }).join('') || '<p class="peq" style="margin: 0; padding: 12px 14px; color: var(--okTxt); border-top: 1px solid var(--linha)">Tudo pago.</p>'}
      ${futuras.length > 6 ? `<button class="btn sec peq" data-vista-lista="1" style="margin: 8px 14px 12px">Ver as ${futuras.length} na lista</button>` : ''}`;
  };

  const abrirBateria = async (id) => {
    A.sel = id;
    const b = bats.find((x) => x.id === id);
    if (!b) { fecharCamada(); return; }
    const tp = tipoDe(b), T = TIPOS[tp], st = situacaoBateria(b), d = deIso(b.dataHora);
    const titulo = tituloBat(b, tp);
    const g = gaveta(`<div class="gavetaTopo" style="${T.topo}"><button class="fechar hov" data-acao="fecharGaveta" aria-label="Fechar (Esc)">${svg(IC.fechar, 14, '#1D1D1F', 2.4)}</button>
      <span style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase"><span class="amostra" style="${amostra(tp, true)}"></span>${T.t}</span>
      <span style="padding-right: 40px; font-size: 21px; font-weight: 700; letter-spacing: -0.015em">${esc(titulo === 'Livre' ? 'Horário livre' : titulo)}</span>
      <span style="font-size: 13px; opacity: .85">${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} · ${horaDe(b.dataHora)} às ${fmtHm(hm(horaDe(b.dataHora)) + 35)}${st === 'pista' ? ' · na pista agora' : st === 'fim' ? ' · já correu' : ''}</span>
      <span style="font-size: 12px; opacity: .8">${[b.nome, b.produto, b.tracado, b.tipoKart].filter(Boolean).map(esc).join(' · ')}</span></div>
      <div class="gavetaCorpo" id="corpoBateria"><div class="esqueleto" style="height: 120px"></div><div class="esqueleto" style="height: 200px"></div></div>
      <div style="display: flex; gap: 8px; padding: 12px 16px; background: #FFF; border-top: 1px solid var(--linha2)">${st !== 'fim' && +b.disponiveis > 0 && tp !== 'bloq' ? `<button class="btn prim" style="flex-grow: 1" data-acao="novaReserva">${svg(IC.mais, 14, '#FFF', 2.6)}Nova reserva · ${b.disponiveis} ${+b.disponiveis === 1 ? 'vaga' : 'vagas'}</button>` : `<a class="btn sec" style="flex-grow: 1" href="#/recepcao">Abrir na Recepção</a>`}</div>`);
    g.dataset.bateria = id;
    let reservas = [];
    try { reservas = await office(`/reservas?bateriaId=${id}&status=todas`); } catch (e) { $('#corpoBateria').innerHTML = `<div class="vazio"><b>Não deu para carregar as reservas</b><span>${esc(e.message)}</span><button class="btn sec peq" style="margin-top: 8px" data-reabrir="${id}">Tentar de novo</button></div>`; return; }
    if (A.sel !== id) return;
    reservas = reservas.filter((r) => r.status !== 'cancelada');
    let gruposReserva = [];
    try { gruposReserva = await office(`/grupos?bateriaId=${id}`); } catch { gruposReserva = []; }
    if (A.sel !== id) return;
    const doGrupo = new Map();
    gruposReserva.forEach((gr, gi) => gr.pilotos.forEach((p) => doGrupo.set(p.inscricaoId, { cor: CORG[gi % 6], nome: p.nome })));
    const avulsas = reservas.filter((r) => !doGrupo.has(r.id));
    const grupos = new Map();
    avulsas.forEach((r) => { const k = r.responsavel || r.cliente; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(r); });
    const cores = new Map([...grupos.keys()].map((k, i) => [k, CORG[(i + gruposReserva.length) % 6]]));
    const ordenadas = reservas.slice().sort((x, y) => (doGrupo.has(y.id) ? 1 : 0) - (doGrupo.has(x.id) ? 1 : 0));
    const assentos = Array.from({ length: Math.max(1, +b.vagas || 12) }, (_, i) => { const r = ordenadas[i]; const dg = r && doGrupo.get(r.id); const nomeA = dg ? (dg.nome || r.cliente) : r && r.cliente; return r ? `<span class="vaga ocupada" style="background: ${dg ? dg.cor : cores.get(r.responsavel || r.cliente)}" title="${esc(nomeA)}">${esc(iniciais(nomeA))}</span>` : `<span class="vaga" title="Vaga ${i + 1} livre">${i + 1}</span>`; }).join('');
    const tipoAtual = b.reservaFechada ? 'fechada' : (b.autoAtendimento === false || b.autoAtendimento === 0) ? 'bloqueada' : 'aberta';
    const tipoHtml = st === 'fim' ? '' : `<section class="secao"><span class="titulo">Quem pode reservar este horário</span><span class="tiposBat">${[['aberta', 'Vagas abertas', 'livre', 'site, totem e Recepção'], ['fechada', 'Bateria fechada', 'fechada', 'só o grupo, sai do site'], ['bloqueada', 'Bloqueada', 'bloq', 'só a Recepção vende']].map(([v, t, tq, dd]) => `<button class="hov" data-tipo-bat="${v}" aria-pressed="${tipoAtual === v}" style="${tipoAtual === v ? (tq === 'livre' ? 'background: #FFF' : TIPOS[tq].fundo) + '; box-shadow: inset 0 0 0 2px ' + (tq === 'livre' ? '#636366' : TIPOS[tq].cor) : 'background: var(--fundo); color: var(--tinta2)'}"><span style="display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700"><span class="amostra" style="width: 10px; height: 10px; ${amostra(tq, true)}"></span>${t}</span><span style="font-size: 12px; opacity: .8">${dd}</span></button>`).join('')}</span></section>`;
    const prontoTotem = (r) => !!(r.documento && r.peso && r.telefone);
    const cartoes = [...grupos.entries()].map(([resp, lista]) => {
      const pagos = lista.filter((r) => r.pago).length, prontos = lista.filter(prontoTotem).length, total = lista.reduce((a, r) => a + (+r.total || 0), 0), pagoValor = lista.filter((r) => r.pago).reduce((a, r) => a + (+r.total || 0), 0);
      const tel = lista[0].telefone, cor = cores.get(resp);
      const msgCad = `Olá! Sua bateria no Kartódromo de Betim é ${DIAS[d.getDay()]} ${d.getDate()}/${pad(d.getMonth() + 1)} às ${horaDe(b.dataHora)}. Para agilizar, cada piloto faz o pré-cadastro aqui: ${LINK_CADASTRO} — no totem é só digitar o CPF.`;
      const msgPag = `Olá! Faltam ${lista.length - pagos} piloto(s) a pagar da bateria de ${d.getDate()}/${pad(d.getMonth() + 1)} às ${horaDe(b.dataHora)} (${brl(total - pagoValor)}). O pagamento pode ser feito na recepção.`;
      return `<div class="cartaoGrupo">
        <span style="display: flex; align-items: center; gap: 10px"><span class="avatar" style="width: 34px; height: 34px; font-size: 12px; background: ${cor}">${esc(iniciais(resp))}</span><span class="col" style="flex-grow: 1"><b>${esc(resp)}</b><span class="peq">${lista.length} piloto${lista.length > 1 ? 's' : ''} · ${esc(lista[0].origem || 'Recepção')}${tel ? ' · ' + esc(tel) : ''}</span></span></span>
        <span style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px">
          <span class="col" style="gap: 4px"><span style="display: flex; flex-wrap: wrap; gap: 2px 8px; font-size: 12px"><span class="peq" title="CPF, peso e telefone preenchidos">Prontos para o totem</span><b style="margin-left: auto">${prontos} de ${lista.length}</b></span><span class="barra" style="height: 5px"><span style="width: ${Math.round(prontos / lista.length * 100)}%; background: ${prontos === lista.length ? '#34C759' : '#FF9F0A'}"></span></span></span>
          <span class="col" style="gap: 4px"><span style="display: flex; flex-wrap: wrap; gap: 2px 8px; font-size: 12px"><span class="peq">Pago</span><b style="margin-left: auto">${brlCurto(pagoValor)} de ${brlCurto(total)}</b></span><span class="barra" style="height: 5px"><span style="width: ${total ? Math.round(pagoValor / total * 100) : 0}%; background: ${pagos === lista.length ? '#34C759' : '#FF9F0A'}"></span></span></span>
        </span>
        <div class="listaPilotos">${lista.map((r) => `<div><span class="avatar" style="width: 26px; height: 26px; font-size: 12px; background: ${r.pago && prontoTotem(r) ? '#34C759' : cor}" aria-hidden="true">${esc(iniciais(r.cliente))}</span><span class="col" style="flex-grow: 1"><span class="trunc" style="font-weight: 600">${esc(r.cliente)}</span><span class="peq">${esc(r.documento || 'sem CPF')}${r.peso ? ' · ' + r.peso + ' kg' : ' · sem peso'}${r.idade != null ? ' · ' + r.idade + ' anos' : ''}</span></span>${r.aprovada ? '' : `<button class="btn peq" style="background: rgba(255,159,10,.16); color: var(--avisoTxt)" data-aprovar="${r.id}">Aprovar</button>`}<span class="chip ${r.pago ? 'verde' : 'laranja'}">${r.pago ? 'pago' : 'falta ' + brlCurto(r.total)}</span></div>`).join('')}</div>
        <span style="display: flex; flex-wrap: wrap; gap: 6px">${tel ? `<a class="btn verdeClaro peq" target="_blank" rel="noopener" href="${esc(zap(tel, msgCad))}">Enviar link de cadastro</a>${pagos < lista.length ? `<a class="btn peq" style="background: rgba(30,111,232,.12); color: var(--azulTxt)" target="_blank" rel="noopener" href="${esc(zap(tel, msgPag))}">Cobrar no WhatsApp</a>` : ''}` : '<span class="peq">Sem telefone do responsável: peça na Recepção.</span>'}</span>
      </div>`;
    }).join('');
    const nGrupos = grupos.size + gruposReserva.length;
    $('#corpoBateria').innerHTML = `<section class="secao"><span class="titulo">Vagas<span style="margin-left: auto; font-size: 12px; font-weight: 600; color: ${st === 'fim' ? 'var(--mudo)' : tp === 'fechada' || tp === 'bloq' ? 'var(--tinta2)' : +b.disponiveis ? 'var(--okTxt)' : 'var(--erroTxt)'}">${st === 'fim' ? b.inscritos + ' correram' : tp === 'fechada' ? 'fechada: fora do site e do totem' : tp === 'bloq' ? 'bloqueada: só a Recepção vende' : b.disponiveis + ' de ' + b.vagas + ' livres no site e no totem'}</span></span><div class="vagasGrade">${assentos}</div><span class="peq">Cada quadrado é uma vaga. Os karts saem no sorteio do tablet, na hora da bateria.</span></section>
      ${tipoHtml}
      <section class="secao"><span class="titulo">Reservas<span class="peq" style="margin-left: auto; font-weight: 500">${reservas.length ? `${reservas.length} piloto${reservas.length > 1 ? 's' : ''} em ${nGrupos} ${nGrupos > 1 ? 'grupos' : 'grupo'}` : ''}</span></span>${Grupo.cartoes(gruposReserva)}${cartoes ? (gruposReserva.length ? '<span class="peq" style="font-weight: 700; margin-top: 4px">Outras reservas (Recepção, totem e site)</span>' : '') + cartoes : ''}${!reservas.length ? `<span class="peq">Nenhuma reserva ainda.${st !== 'fim' && +b.disponiveis > 0 && tp !== 'bloq' ? ' Use “Nova reserva” abaixo.' : ''}</span>` : ''}</section>
      ${b.observacao ? `<section class="secao"><span class="titulo">Observação</span><span style="white-space: pre-line; line-height: 1.5">${esc(b.observacao)}</span></section>` : ''}`;
  };

  /** Nova reserva pelo cabeçalho: escolhe dia, quantos pilotos e o horário; depois abre a reserva do grupo. */
  const escolherHorario = async () => {
    const E = { dia: A.vista === 'dia' && A.base >= hojeIso() ? A.base : hojeIso(), n: 2, lista: [], carregando: true };
    const m = modal('<div class="esqueleto" style="height: 360px; margin: 20px"></div>');
    m.style.maxWidth = '640px';
    const desenhar = () => {
      const validas = E.lista.filter((b) => situacaoBateria(b) !== 'fim' && tipoDe(b) !== 'bloq' && !b.reservaFechada);
      const dias = Array.from({ length: 14 }, (_, k) => somaDias(hojeIso(), k));
      m.innerHTML = `<div class="modalTopo" style="${TIPOS.reserva.topo}"><span class="col" style="gap: 3px"><span style="font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; opacity: .8">Nova reserva</span><span style="font-size: 23px; font-weight: 700; letter-spacing: -0.02em">Que dia e que horário?</span><span style="font-size: 13px; opacity: .85">Só aparecem os horários com vagas para o grupo inteiro.</span></span><button class="fechar hov" style="position: static; margin-left: auto" data-acao="fechar" aria-label="Fechar (Esc)">${svg(IC.fechar, 15, '#1D1D1F', 2.4)}</button></div>
        <div style="display: flex; flex-direction: column; gap: 14px; padding: 16px 18px 18px">
          <div class="diasEscolha" role="listbox" aria-label="Dia">${dias.map((dia) => { const d = deIso(dia); return `<button class="hov ${dia === E.dia ? 'sel' : ''}" data-escolher-dia="${dia}" role="option" aria-selected="${dia === E.dia}" ${d.getDay() === 1 ? 'disabled title="Segunda o kartódromo não abre"' : ''}><span>${dia === hojeIso() ? 'hoje' : DIAS[d.getDay()].slice(0, 3)}</span><b>${d.getDate()}</b></button>`; }).join('')}</div>
          <span style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap"><b style="font-size: 14px">Quantos pilotos?</b><span class="passo"><button type="button" data-escolher-n="-1" aria-label="Um a menos">−</button><span>${E.n}</span><button type="button" data-escolher-n="1" aria-label="Um a mais">+</button></span><span class="peq">dá para mudar depois, na reserva</span></span>
          <div class="horariosEscolha">${E.carregando ? '<div class="esqueleto" style="height: 180px"></div>' : validas.length ? validas.map((b) => { const l = +b.disponiveis || 0, cabe = l >= E.n, tp = tipoDe(b); return `<button class="hov" data-escolher="${b.id}" ${cabe ? '' : 'disabled'}><b class="mono">${horaDe(b.dataHora)}</b><span class="col" style="flex-grow: 1; min-width: 0"><span class="trunc" style="font-weight: 600">${esc(tp === 'livre' ? 'Livre' : tituloBat(b, tp))}</span><span class="peq">${esc(b.produto || b.nome)}</span></span><span style="font-size: 12.5px; font-weight: 700; color: ${cabe ? 'var(--okTxt)' : 'var(--erroTxt)'}">${cabe ? `${l} ${l === 1 ? 'livre' : 'livres'}` : `só ${l} ${l === 1 ? 'livre' : 'livres'}`}</span></button>`; }).join('') : '<div class="vazio"><b>Nenhum horário com vaga neste dia</b><span>Escolha outro dia acima.</span></div>'}</div>
        </div>`;
    };
    const buscar = async () => {
      E.carregando = true; desenhar();
      try { E.lista = (await office(`/baterias?status=todas&filtro=entre&data=${E.dia}&ate=${E.dia}`)).sort((x, y) => x.dataHora.localeCompare(y.dataHora)); }
      catch (er) { E.lista = []; falhou(er); }
      E.carregando = false; desenhar();
    };
    m.onclick = async (e) => {
      const dd = e.target.closest('[data-escolher-dia]'); if (dd) { E.dia = dd.dataset.escolherDia; buscar(); return; }
      const nn = e.target.closest('[data-escolher-n]'); if (nn) { E.n = Math.max(1, Math.min(40, E.n + +nn.dataset.escolherN)); desenhar(); return; }
      const h = e.target.closest('[data-escolher]');
      if (h) {
        const b = E.lista.find((x) => x.id === +h.dataset.escolher); if (!b) return;
        A.base = E.dia; if (A.vista === 'lista') A.vista = 'semana';
        await carregar(); A.sel = b.id; pintar();
        Grupo.nova(bats.find((x) => x.id === b.id) || b, recarregar, E.n);
      }
    };
    buscar();
  };

  const irPara = (n) => { A.base = n === 0 ? hojeIso() : somaDias(A.base, (A.vista === 'dia' ? 1 : 7) * n); A.sel = null; fecharCamada(); carregar(); };
  const mudarVista = (v) => { if (A.vista === v) return; A.vista = v; if (v === 'lista' && A.base < hojeIso()) A.base = hojeIso(); carregar(); };
  tela.addEventListener('click', async (e) => {
    if (e.target.closest('[data-nova]')) return escolherHorario();
    const nav = e.target.closest('[data-nav]'); if (nav) return irPara(+nav.dataset.nav);
    const v = e.target.closest('[data-vista]'); if (v) return mudarVista(v.dataset.vista);
    if (e.target.closest('[data-vista-lista]')) return mudarVista('lista');
    const dia = e.target.closest('[data-dia]'); if (dia) { A.base = dia.dataset.dia; A.vista = 'dia'; A.sel = null; fecharCamada(); carregar(); return; }
    const mes = e.target.closest('[data-mes]'); if (mes) { const d = deIso(A.base); d.setMonth(d.getMonth() + +mes.dataset.mes, 1); A.base = iso(d); carregar(); return; }
    const t = e.target.closest('[data-tipo]'); if (t) { A.ocultos[t.dataset.tipo] = !A.ocultos[t.dataset.tipo]; pintar(); return; }
    const s = e.target.closest('[data-sel]');
    if (s) {
      if (s.dataset.base && !bats.find((b) => b.id === +s.dataset.sel)) { A.base = s.dataset.base; await carregar(); }
      A.sel = +s.dataset.sel; pintar(); abrirBateria(A.sel);
    }
  });
  tela.addEventListener('input', (e) => { if (e.target.id === 'qAg') { A.q = e.target.value; clearTimeout(S.tela.tq); S.tela.tq = setTimeout(() => { pintar(); const i = $('#qAg'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 300); } });
  $('#camada').onclick = async (e) => {
    if (e.target.closest('[data-acao="fecharGaveta"]') || e.target.closest('[data-acao="fechar"]')) { A.sel = null; fecharCamada(); pintar(); return; }
    const re = e.target.closest('[data-reabrir]'); if (re) { abrirBateria(+re.dataset.reabrir); return; }
    if (e.target.closest('[data-acao="novaReserva"]')) { const b = bats.find((x) => x.id === A.sel); if (b) Grupo.nova(b, recarregar); return; }
    const ga = e.target.closest('[data-grupo-abrir]'); if (ga) { const b = bats.find((x) => x.id === A.sel); if (b) Grupo.abrir(+ga.dataset.grupoAbrir, b, recarregar); return; }
    const tb = e.target.closest('[data-tipo-bat]');
    if (tb) {
      if (tb.getAttribute('aria-pressed') === 'true') return;
      const aviso = { aberta: 'Abrir este horário? As vagas voltam a aparecer no site e no totem.', fechada: 'Fechar esta bateria para o grupo? Ela sai do site e do totem, e só o grupo corre.', bloqueada: 'Bloquear este horário? Sai do site e do totem; só a Recepção poderá vender.' }[tb.dataset.tipoBat];
      if (!confirm(aviso)) return;
      tb.disabled = true;
      try { await office(`/baterias/${A.sel}/tipo`, { method: 'POST', body: { tipo: tb.dataset.tipoBat } }); toast({ aberta: 'Horário aberto no site, no totem e na Recepção', fechada: 'Bateria fechada para o grupo · saiu do site e do totem', bloqueada: 'Horário bloqueado · só a Recepção vende' }[tb.dataset.tipoBat]); await recarregar(); } catch (er) { falhou(er); tb.disabled = false; }
      return;
    }
    const ap = e.target.closest('[data-aprovar]'); if (ap) { ap.disabled = true; try { await office(`/reservas/${ap.dataset.aprovar}/aprovar`, { method: 'POST', body: {} }); toast('Pré-reserva aprovada'); await recarregar(); } catch (er) { falhou(er); ap.disabled = false; } }
  };
  // atalhos de teclado (um ouvinte só no documento; vale enquanto esta tela está aberta)
  S.tela.atalho = (e) => {
    if (e.key === 'Escape') { if (A.sel) { A.sel = null; setTimeout(pintar, 0); } return; }
    if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable || $('#camada .modal')) return;
    const k = e.key.toLowerCase();
    if (k === 'n') { e.preventDefault(); escolherHorario(); }
    else if (k === 't') irPara(0);
    else if (e.key === 'ArrowLeft' && !$('#camada').innerHTML) irPara(-1);
    else if (e.key === 'ArrowRight' && !$('#camada').innerHTML) irPara(1);
    else if (k === 'd') mudarVista('dia');
    else if (k === 's') mudarVista('semana');
    else if (k === 'l') mudarVista('lista');
  };
  await carregar();
  if (A.sel) abrirBateria(A.sel);
  if (S.irAgendaNova) { S.irAgendaNova = false; escolherHorario(); }
  repetir(async () => { if (!$('#camada .modal')) await carregar(); }, 45_000);
};

// ---------- Recepção
TELAS.recepcao = async (tela) => {
  const R = S.rec || (S.rec = { data: hojeIso(), filtro: 0, qBat: '', qPil: '' });
  if (S.irBateria) { R.data = hojeIso(); R.bat = S.irBateria; S.irBateria = null; }
  tela.innerHTML = `${cabecalho('Operação · mesmo banco da Recepção (.53 e .239)', 'Recepção', `<div style="display: flex; align-items: center; height: 36px; border-radius: 10px; background: #FFF; box-shadow: 0 0 0 1px var(--linha2)"><button class="btn peq" data-dia="-1" aria-label="Dia anterior" style="background: transparent; width: 34px; padding: 0">${svg(IC.esq, 15)}</button><span id="diaTxt" style="min-width: 130px; text-align: center; font-weight: 600"></span><button class="btn peq" data-dia="1" aria-label="Próximo dia" style="background: transparent; width: 34px; padding: 0">${svg(IC.dir, 15)}</button></div>`)}
  <main class="principal"><div class="linhaFlex">
    <section class="cartao leve" id="listaBats" style="flex: 1 1 270px; min-width: 0"></section>
    <section class="cartao" id="pilotos" style="flex: 999 1 520px; min-width: 0"></section>
    <section class="cartao leve" id="ficha" style="flex: 1 1 290px; min-width: 0"></section>
  </div><section class="cartao leve" id="caixa"></section></main>`;
  let bats = [], reservas = [];
  const carregarDia = async () => {
    const d = deIso(R.data);
    $('#diaTxt').textContent = `${R.data === hojeIso() ? 'Hoje' : DIAS[d.getDay()].slice(0, 3)}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
    bats = await office(`/baterias?status=todas&data=${R.data}`);
    if (!bats.find((b) => b.id === R.bat)) R.bat = (bats.find((b) => situacaoBateria(b) === 'pista') || bats.find((b) => situacaoBateria(b) === 'futura') || bats[0] || {}).id;
    pintarBats();
    await carregarPilotos();
  };
  const pintarBats = () => {
    const q = R.qBat.toLowerCase();
    const vis = bats.filter((b) => !q || `${horaDe(b.dataHora)} ${b.nome} ${b.produto}`.toLowerCase().includes(q));
    const tot = bats.reduce((a, b) => a + +b.inscritos, 0), vagas = bats.reduce((a, b) => a + +b.vagas, 0);
    $('#listaBats').innerHTML = `<div style="padding: 14px 14px 10px; display: flex; flex-direction: column; gap: 10px"><div style="display: flex; align-items: baseline"><h2 style="margin: 0; font-size: 15px">Baterias</h2><span class="peq" style="margin-left: auto">${tot} de ${vagas} vagas</span></div><label class="buscaCampo">${svg(IC.busca, 13, '#8E8E93')}<input id="qBat" value="${esc(R.qBat)}" placeholder="Hora ou tipo" aria-label="Filtrar baterias"></label></div>
      <div style="display: flex; flex-direction: column; gap: 2px; padding: 0 6px 8px">${vis.map((b) => { const st = situacaoBateria(b), sel = b.id === R.bat; return `<button class="hov" data-bat="${b.id}" style="display: flex; flex-direction: column; gap: 6px; padding: 9px 10px; border: 0; border-radius: 11px; text-align: left; background: ${sel ? 'rgba(11,122,83,.09)' : '#FFF'}; ${sel ? 'box-shadow: inset 0 0 0 1.5px rgba(11,122,83,.45)' : ''}"><span style="display: flex; align-items: center; gap: 8px; width: 100%"><span class="mono" style="font-weight: 600">${horaDe(b.dataHora)}</span><b class="trunc">${esc(b.nome)}</b><span class="chip ${st === 'fim' ? 'cinza' : st === 'pista' ? 'verde' : +b.disponiveis ? 'laranja' : 'azul'}" style="margin-left: auto">${st === 'fim' ? 'Finalizada' : st === 'pista' ? 'Na pista' : +b.disponiveis ? 'Com vagas' : 'Lotada'}</span></span><span style="display: flex; align-items: center; gap: 8px; width: 100%"><span class="barra" style="flex-grow: 1; height: 5px"><span style="width: ${Math.round(+b.inscritos / Math.max(1, +b.vagas) * 100)}%; background: ${st === 'pista' ? '#34C759' : '#0B7A53'}"></span></span><span class="peq num">${b.inscritos}/${b.vagas}${+b.preReservas ? ' · ' + b.preReservas + ' a aprovar' : ''}</span></span></button>`; }).join('') || '<p class="vazio">Nenhuma bateria.</p>'}</div>`;
  };
  const carregarPilotos = async () => {
    const b = bats.find((x) => x.id === R.bat);
    if (!b) { $('#pilotos').innerHTML = '<div class="vazio"><b>Sem baterias neste dia</b></div>'; $('#ficha').innerHTML = ''; return; }
    reservas = (await office(`/reservas?bateriaId=${b.id}&status=todas`)).filter((r) => r.status !== 'cancelada');
    if (!reservas.find((r) => r.id === R.pil)) R.pil = (reservas[0] || {}).id;
    pintarPilotos();
  };
  const pintarPilotos = () => {
    const b = bats.find((x) => x.id === R.bat); if (!b) return;
    const st = situacaoBateria(b);
    const aPagar = reservas.filter((r) => !r.pago), semTermo = reservas.filter((r) => !r.termo), site = reservas.filter((r) => r.origem === 'site'), aprovar = reservas.filter((r) => !r.aprovada);
    const filtros = [['Todos', reservas], ['A pagar', aPagar], ['Sem termo', semTermo], ['Pelo site', site], ['A aprovar', aprovar]];
    const q = R.qPil.toLowerCase();
    const lista = filtros[R.filtro][1].filter((r) => !q || `${r.cliente} ${r.kart || ''} ${r.documento || ''}`.toLowerCase().includes(q));
    $('#pilotos').innerHTML = `<div class="cartaoCab"><span class="col"><h2 style="font-size: 18px">${esc(b.nome)} · ${horaDe(b.dataHora)}</h2><span class="sub">${esc(b.produto || '')}${b.tracado ? ' · traçado ' + esc(b.tracado) : ''}${b.tipoKart ? ' · ' + esc(b.tipoKart) : ''}</span></span><span class="chip dir ${st === 'fim' ? 'cinza' : st === 'pista' ? 'verde' : 'laranja'}">${st === 'fim' ? 'Finalizada' : st === 'pista' ? 'Na pista' : 'Próxima'}</span></div>
      <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; margin: 0 18px; border-radius: 12px; overflow: hidden; background: rgba(0,0,0,.06); box-shadow: 0 0 0 1px var(--linha)">${[['Pilotos', `${b.inscritos}/${b.vagas}`, ''], ['Pagos', b.pagos, 'color: var(--okTxt)'], ['A pagar', aPagar.length, aPagar.length ? 'color: var(--erroTxt)' : ''], ['Sem termo', semTermo.length, semTermo.length ? 'color: var(--erroTxt)' : '']].map(([t, v, c]) => `<div class="col" style="gap: 1px; padding: 10px 12px; background: var(--sup2)"><span class="peq">${t}</span><span class="num" style="font-size: 20px; font-weight: 700; ${c}">${v}</span></div>`).join('')}</div>
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 14px 18px 10px"><div class="filtros">${filtros.map(([t, l], i) => `<button data-filtro="${i}" class="${i === R.filtro ? 'sel' : ''}">${t} <span>${l.length}</span></button>`).join('')}</div><label class="buscaCampo" style="margin-left: auto; width: 220px; max-width: 100%">${svg(IC.busca, 13, '#8E8E93')}<input id="qPil" value="${esc(R.qPil)}" placeholder="Piloto, kart ou CPF"></label></div>
      <div class="rolagemX"><div style="min-width: 620px"><div class="cabTabela" style="grid-template-columns: 30px minmax(0, 1.7fr) 64px 58px 130px 100px"><span>Nº</span><span>Piloto</span><span style="text-align: right">Peso</span><span style="text-align: right">Kart</span><span>Pagamento</span><span>Termo</span></div>
      ${lista.map((r, i) => `<button class="linhaTabela hov ${r.id === R.pil ? 'sel' : ''}" data-pil="${r.id}" style="grid-template-columns: 30px minmax(0, 1.7fr) 64px 58px 130px 100px"><span class="peq">${i + 1}</span><span style="display: flex; align-items: center; gap: 10px; min-width: 0"><span class="avatar" style="width: 30px; height: 30px; font-size: 11px; background: ${CORG[r.clienteId % 6]}">${esc(iniciais(r.cliente))}</span><span class="col"><b class="trunc">${esc(r.cliente)}</b><span class="peq">${esc(r.origem === 'site' ? 'Reserva online' : r.origem === 'totem' ? 'Totem' : 'Recepção')}${r.responsavel && r.responsavel !== r.cliente ? ' · resp. ' + esc(r.responsavel) : ''}</span></span></span><span style="text-align: right">${r.peso ? r.peso + ' kg' : '—'}</span><span style="text-align: right">${r.kart ? `<span class="kart">${esc(r.kart)}</span>` : '—'}</span><span><span class="chip ${r.pago ? (r.origem === 'site' ? 'azul' : 'verde') : 'vermelho'}">${r.pago ? esc(r.formaPagamento || 'Pago') : 'A pagar ' + brlCurto(r.total)}</span></span><span style="display: flex; align-items: center; gap: 6px; font-size: 12px; ${r.termo ? '' : 'color: var(--erroTxt); font-weight: 600'}"><span class="ponto" style="background: ${r.termo ? '#34C759' : '#FF453A'}"></span>${r.termo ? 'Impresso' : 'Falta'}</span></button>`).join('') || `<div class="vazio"><b>Ninguém aqui</b><span>${reservas.length ? 'Nenhum piloto com esse filtro.' : 'Bateria ainda sem pilotos.'}</span></div>`}</div></div>`;
    pintarFicha();
  };
  const pintarFicha = () => {
    const r = reservas.find((x) => x.id === R.pil);
    if (!r) { $('#ficha').innerHTML = '<div class="vazio"><span>Toque num piloto para ver a ficha.</span></div>'; return; }
    $('#ficha').innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 22px 18px 16px; text-align: center; background: linear-gradient(180deg, rgba(11,122,83,.08), rgba(11,122,83,0))"><span class="avatar" style="width: 64px; height: 64px; font-size: 22px; background: ${CORG[r.clienteId % 6]}; box-shadow: 0 8px 20px -8px rgba(0,0,0,.35)">${esc(iniciais(r.cliente))}</span><b style="font-size: 17px">${esc(r.cliente)}</b><span class="chip cinza">Cliente ${r.clienteId}</span></div>
      <dl style="margin: 0; padding: 4px 18px 12px; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px 14px; font-size: 12.5px">${[['CPF', r.documento || '—'], ['Nascimento', r.nascimento ? r.nascimento.split('-').reverse().join('/') + (r.idade != null ? ` (${r.idade})` : '') : '—'], ['Peso', r.peso ? r.peso + ' kg' : '—'], ['Telefone', r.telefone || '—'], ['Responsável', r.responsavel || '—'], ['Produto', r.produto || '—'], ['Valor', brl(r.total)], ['Reservado em', r.criadoEm ? r.criadoEm.replace('T', ' ') : '—']].map(([k, v]) => `<dt class="peq">${k}</dt><dd style="margin: 0; text-align: right" class="trunc">${esc(v)}</dd>`).join('')}</dl>
      <div style="display: flex; flex-direction: column; gap: 6px; padding: 8px 18px 18px">${r.aprovada ? '' : `<button class="btn prim" data-aprovar="${r.id}">Aprovar pré-reserva</button>`}${r.telefone ? `<a class="btn verdeClaro" target="_blank" rel="noopener" href="${esc(zap(r.telefone, 'Olá, ' + r.cliente.split(' ')[0] + '! Aqui é do Kartódromo de Betim.'))}">${svg(IC.zap, 14, '#1C6B35')} WhatsApp</a>` : ''}<span class="peq" style="text-align: center; line-height: 1.5">Cobrar, mover e imprimir o termo continuam no programa da Recepção.</span></div>`;
  };
  const carregarCaixa = async () => {
    const movs = await office('/movimentos').catch(() => []);
    const hoje = hojeIso();
    const doDia = movs.filter((m) => (m.abertoEm || '').slice(0, 10) === hoje || !m.fechadoEm);
    const total = doDia.reduce((a, m) => a + (+m.recebido || 0), 0);
    $('#caixa').innerHTML = `<div class="cartaoCab"><h2>Caixas de hoje</h2><span class="sub">terminais abertos e fechados no dia</span><span class="dir num" style="font-size: 22px; font-weight: 700">${brl(total)}</span></div>
      <div class="rolagemX"><div style="min-width: 560px"><div class="cabTabela" style="grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 110px 110px 120px"><span>Terminal</span><span>Operador · turno</span><span>Aberto</span><span>Fechado</span><span style="text-align: right">Recebido</span></div>
      ${doDia.map((m) => `<div class="linhaTabela" style="grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 110px 110px 120px"><b>${esc(m.terminal)}</b><span class="trunc">${esc(m.usuario || '—')} · ${esc(m.turno || '—')}</span><span class="mono">${esc((m.abertoEm || '').slice(11, 16))}</span><span>${m.fechadoEm ? `<span class="mono">${esc(m.fechadoEm.slice(11, 16))}</span>` : '<span class="chip verde"><span class="ponto pulso" style="background: #34C759"></span>aberto</span>'}</span><b class="num" style="text-align: right">${brl(m.recebido)}</b></div>`).join('') || '<div class="vazio"><b>Nenhum caixa aberto hoje</b><span>O terminal é aberto no programa da Recepção.</span></div>'}</div></div>`;
  };
  tela.addEventListener('click', async (e) => {
    const dd = e.target.closest('[data-dia]'); if (dd) { R.data = somaDias(R.data, +dd.dataset.dia); R.bat = null; carregarDia().catch(falhou); return; }
    const b = e.target.closest('[data-bat]'); if (b) { R.bat = +b.dataset.bat; R.filtro = 0; pintarBats(); carregarPilotos().catch(falhou); return; }
    const f = e.target.closest('[data-filtro]'); if (f) { R.filtro = +f.dataset.filtro; pintarPilotos(); return; }
    const p = e.target.closest('[data-pil]'); if (p) { R.pil = +p.dataset.pil; pintarPilotos(); return; }
    const ap = e.target.closest('[data-aprovar]'); if (ap) { ap.disabled = true; try { await office(`/reservas/${ap.dataset.aprovar}/aprovar`, { method: 'POST', body: {} }); toast('Pré-reserva aprovada'); await carregarDia(); } catch (er) { falhou(er); ap.disabled = false; } }
  });
  tela.addEventListener('input', (e) => {
    if (e.target.id === 'qBat') { R.qBat = e.target.value; pintarBats(); const i = $('#qBat'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
    if (e.target.id === 'qPil') { R.qPil = e.target.value; pintarPilotos(); const i = $('#qPil'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  });
  await carregarDia();
  carregarCaixa();
  repetir(() => { if (!document.activeElement || document.activeElement.tagName !== 'INPUT') carregarDia(); }, 30_000);
  repetir(carregarCaixa, 60_000);
};

// ---------- Cronometragem
TELAS.crono = async (tela) => {
  const C = S.crono || (S.crono = { aba: 0 });
  tela.innerHTML = `${cabecalho('Operação · espelho do CRONO1 e do ORBITS', 'Cronometragem', `<span class="chip cinza" style="height: 28px">Somente leitura</span><div class="seg">${['Ao vivo', 'Baterias de hoje'].map((t, i) => `<button data-aba="${i}" class="${C.aba === i ? 'sel' : ''}">${t}</button>`).join('')}</div>`)}<main class="principal" id="corpoCrono"></main>`;
  const aoVivo = async () => {
    if (C.aba !== 0) return;
    try {
      const s = await api('/crono/ao-vivo');
      const corre = s.status === 'running' || s.status === 'live' || (s.race && s.race.state > 0 && s.race.state < 5);
      selo('crono', corre ? 'ao vivo' : '', 'vivo');
      $('#corpoCrono').innerHTML = `<div class="linhaFlex"><section class="placar" style="flex: 999 1 640px; min-width: 0">
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 14px 22px; padding: 18px 20px 14px"><span class="col" style="gap: 6px"><span class="chip" style="background: ${corre ? 'rgba(52,199,89,.2)' : 'rgba(255,255,255,.1)'}; color: ${corre ? '#5EDB7A' : '#D1D1D6'}; letter-spacing: .06em; align-self: flex-start">${corre ? 'AO VIVO' : 'ENCERRADA'}</span><span style="font-size: 22px; font-weight: 700; letter-spacing: -0.02em">${esc(s.eventName || 'Sem bateria')}</span></span><span class="peq" style="margin-left: auto; color: #A1A1A6">Atualizado ${s.updatedAt ? new Date(s.updatedAt).toLocaleTimeString('pt-BR', { timeZone: TZ }) : '—'}</span></div>
        <div style="display: grid; grid-template-columns: 34px 46px minmax(0, 1fr) 92px; gap: 10px; height: 30px; align-items: center; padding: 0 20px; font-size: 11px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: #8E8E93; border-top: 1px solid rgba(255,255,255,.08)"><span>Pos</span><span>Kart</span><span>Piloto</span><span style="text-align: right">Tempo</span></div>
        ${(s.drivers || []).map((p, i) => `<div class="linha"><span style="font-size: 16px; font-weight: 700; color: ${i < 3 ? '#FFD24A' : '#FFF'}">${esc(p.position)}</span><span class="kartE">${esc(p.kart)}</span><span class="trunc" style="font-weight: 600">${esc(p.name)}</span><span class="mono" style="text-align: right; font-size: 12.5px; color: ${i === 0 ? '#C08BFF' : '#FFF'}">${esc(p.time || '—')}</span></div>`).join('') || '<div style="padding: 24px 20px; color: #A1A1A6">Nenhum piloto na pista.</div>'}</section>
        <section class="cartao leve" style="flex: 1 1 320px; min-width: 0"><div class="cartaoCab"><h2>Regras da cabine</h2></div><p style="margin: 0; padding: 0 16px 16px; line-height: 1.55; color: var(--tinta2)">Largar, encerrar e penalizar continuam só na cabine (programa Cronometragem). O fim da bateria é manual: o painel web nunca encerra bateria sozinho.</p><p style="margin: 0; padding: 12px 16px; font-size: 12px; color: var(--mudo); background: var(--sup2); border-top: 1px solid var(--linha)">O placar se atualiza a cada 3 segundos.</p></section></div>`;
    } catch (e) { $('#corpoCrono').innerHTML = `<div class="cartao"><div class="vazio"><b>Cronometragem sem resposta</b><span>${esc(e.message)}</span></div></div>`; }
  };
  const hoje = async () => {
    const lista = await office(`/crono/sessoes?de=${hojeIso()}&ate=${hojeIso()}`);
    $('#corpoCrono').innerHTML = `<div class="linhaFlex"><section class="cartao" style="flex: 1 1 340px; min-width: 0"><div class="cartaoCab"><h2>Baterias de hoje</h2><span class="sub">${lista.length}</span></div>${lista.map((s) => `<button class="linhaTabela hov ${C.sessao === s.id ? 'sel' : ''}" data-sessao="${esc(s.id)}" style="grid-template-columns: 1fr auto"><span class="col"><b class="trunc">${esc(s.name || s.id)}</b><span class="peq">${s.startedAt ? new Date(s.startedAt).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) : 'não largou'} · ${s.competitors ?? 0} pilotos</span></span><span class="chip ${s.state === 'finalizada' || s.finishedAt ? 'cinza' : s.startedAt ? 'verde' : 'laranja'}">${esc(s.finishedAt ? 'encerrada' : s.startedAt ? 'na pista' : s.state || 'preparando')}</span></button>`).join('') || '<div class="vazio"><b>Nenhuma bateria cronometrada hoje</b></div>'}</section><section class="cartao" id="resultado" style="flex: 999 1 560px; min-width: 0"><div class="vazio"><span>Toque numa bateria para ver o resultado.</span></div></section></div>`;
    if (C.sessao) resultado(C.sessao);
  };
  const resultado = async (id) => {
    C.sessao = id;
    $('#resultado').innerHTML = '<div class="esqueleto" style="height: 300px; margin: 16px"></div>';
    try {
      const s = await office(`/crono/dados/${encodeURIComponent(id)}`);
      const melhor = Math.min(...s.standings.map((p) => p.bestLapMs || Infinity));
      const ms = (v) => v ? (v / 1000).toFixed(3) : '—';
      $('#resultado').innerHTML = `<div class="cartaoCab"><h2>${esc(s.name)}</h2><span class="sub">${s.standings.length} pilotos${s.track ? ' · ' + esc(s.track.name || '') : ''}</span></div><div class="rolagemX"><div style="min-width: 640px"><div class="cabTabela" style="grid-template-columns: 40px 52px minmax(0, 1.6fr) 70px 90px 90px 80px"><span>Pos</span><span>Kart</span><span>Piloto</span><span style="text-align: right">Voltas</span><span style="text-align: right">Melhor</span><span style="text-align: right">Última</span><span>Pen.</span></div>
        ${s.standings.map((p) => `<div class="linhaTabela" style="grid-template-columns: 40px 52px minmax(0, 1.6fr) 70px 90px 90px 80px"><b style="font-size: 15px; ${p.position <= 3 ? 'color: #B07A00' : ''}">${esc(p.position)}</b><span class="kart">${esc(p.kart)}</span><span class="col"><b class="trunc">${esc(p.name)}</b><span class="peq">${esc(p.category || '')}${p.instagram ? ' · ' + esc(p.instagram) : ''}</span></span><span style="text-align: right">${esc(p.laps)}</span><span class="mono" style="text-align: right; ${p.bestLapMs === melhor ? 'color: var(--roxo); font-weight: 700' : ''}">${ms(p.bestLapMs)}</span><span class="mono" style="text-align: right">${ms(p.lastLapMs)}</span><span>${p.desclassificado ? '<span class="chip vermelho">DC</span>' : p.penaltyMs ? `<span class="chip vermelho">+${Math.round(p.penaltyMs / 1000)} s</span>` : p.advertencias ? '<span class="chip laranja">ADV</span>' : ''}</span></div>`).join('')}</div></div>`;
    } catch (e) { $('#resultado').innerHTML = `<div class="vazio"><b>Sem resultado</b><span>${esc(e.message)}</span></div>`; }
  };
  tela.addEventListener('click', (e) => {
    const a = e.target.closest('[data-aba]'); if (a) { C.aba = +a.dataset.aba; tela.querySelectorAll('[data-aba]').forEach((x) => x.classList.toggle('sel', x === a)); (C.aba === 0 ? aoVivo() : hoje()).catch(falhou); return; }
    const s = e.target.closest('[data-sessao]'); if (s) { tela.querySelectorAll('[data-sessao]').forEach((x) => x.classList.toggle('sel', x === s)); resultado(s.dataset.sessao); }
  });
  await (C.aba === 0 ? aoVivo() : hoje());
  repetir(aoVivo, 3_000);
};

// ---------- Reservas online
TELAS.reservas = async (tela) => {
  const R = S.ronl || (S.ronl = { filtro: 0, q: '' });
  tela.innerHTML = `${cabecalho('Clientes · reservas.kartodromodebetim.com.br e Asaas', 'Reservas online', `<a class="btn branco" href="https://reservas.kartodromodebetim.com.br" target="_blank" rel="noopener">Ver página de reservas</a>`)}<main class="principal"><section class="kpis" id="kpisRes"></section><section class="cartao" id="tabRes"></section></main>`;
  let lista = [];
  const pintar = () => {
    const pagas = lista.filter((o) => o.status === 'pago' || o.status === 'resolvido'), aguard = lista.filter((o) => ['novo', 'aguardando', 'aguardando_pagamento', 'pendente'].includes(o.status)), atencao = lista.filter((o) => o.status === 'pago_sem_vaga'), outras = lista.filter((o) => !pagas.includes(o) && !aguard.includes(o) && !atencao.includes(o));
    $('#kpisRes').innerHTML = [['Pagas (30 dias)', pagas.length, 'color: var(--verde)'], ['Aguardando pagamento', aguard.length, 'color: var(--avisoTxt)'], ['Precisa de atenção', atencao.length, atencao.length ? 'color: var(--erroTxt)' : ''], ['Recebido pelo Asaas', brl(pagas.reduce((a, o) => a + (+o.valor || 0), 0)), '']].map(([t, v, c]) => `<div class="kpi"><span class="rot">${t}</span><span class="val" style="${c}">${v}</span></div>`).join('');
    const filtros = [['Todas', lista], ['Pagas', pagas], ['Aguardando', aguard], ['Atenção', atencao], ['Outras', outras]];
    const q = R.q.toLowerCase();
    const vis = filtros[R.filtro][1].filter((o) => !q || `${o.cliente} ${o.codigo} ${o.telefone}`.toLowerCase().includes(q));
    const chip = (st) => ({ pago: ['verde', 'Pago'], resolvido: ['verde', 'Resolvido'], pago_sem_vaga: ['vermelho', 'Pagou sem vaga'], pendente: ['laranja', 'Aguardando'], aguardando: ['laranja', 'Aguardando'], aguardando_pagamento: ['laranja', 'Aguardando Pix'], novo: ['laranja', 'Novo'], expirado: ['cinza', 'Expirou'], cancelado: ['cinza', 'Cancelado'] }[st] || ['cinza', st]);
    $('#tabRes').innerHTML = `<div class="cartaoCab"><h2>Pedidos do site</h2><div class="filtros">${filtros.map(([t, l], i) => `<button data-f="${i}" class="${i === R.filtro ? 'sel' : ''}">${t} <span>${l.length}</span></button>`).join('')}</div><label class="buscaCampo dir" style="width: 220px; max-width: 100%">${svg(IC.busca, 13, '#8E8E93')}<input id="qRes" value="${esc(R.q)}" placeholder="Nome, código ou telefone"></label></div>
      <div class="rolagemX"><div style="min-width: 760px"><div class="cabTabela" style="grid-template-columns: 110px minmax(0, 1.4fr) minmax(0, 1fr) 60px 100px 130px 120px"><span>Pedido</span><span>Cliente</span><span>Bateria</span><span style="text-align: right">Vagas</span><span style="text-align: right">Valor</span><span>Pagamento</span><span></span></div>
      ${vis.map((o) => { const [c, t] = chip(o.status); return `<div class="linhaTabela" style="grid-template-columns: 110px minmax(0, 1.4fr) minmax(0, 1fr) 60px 100px 130px 120px"><span class="col"><span class="mono" style="font-weight: 600">${esc(o.codigo)}</span><span class="peq">${esc((o.dataHora || '').slice(8, 10) + '/' + (o.dataHora || '').slice(5, 7) + ' ' + (o.dataHora || '').slice(11, 16))}</span></span><span class="col"><b class="trunc">${esc(o.cliente)}</b><span class="peq">${esc(o.telefone || '')}${o.forma ? ' · ' + esc(o.forma) : ''}</span></span><span class="col"><span class="trunc">${esc(o.bateria)}</span><span class="peq">${esc((o.inicio || '').slice(8, 10) + '/' + (o.inicio || '').slice(5, 7) + ' ' + (o.inicio || '').slice(11, 16))}</span></span><span style="text-align: right">${o.quantidade}</span><b class="num" style="text-align: right">${brl(o.valor)}</b><span><span class="chip ${c}">${esc(t)}</span></span><span style="display: flex; gap: 6px; justify-content: flex-end">${o.status === 'pago_sem_vaga' ? `<button class="btn escuro peq" data-resolver="${o.id}">Resolvido</button>` : ''}${o.telefone ? `<a class="btn verdeClaro peq" target="_blank" rel="noopener" href="${esc(zap(o.telefone, `Olá, ${(o.cliente || '').split(' ')[0]}! Sobre a sua reserva ${o.codigo} no Kartódromo de Betim:`))}">WhatsApp</a>` : ''}</span></div>`; }).join('') || '<div class="vazio"><b>Nenhum pedido com esse filtro</b></div>'}</div></div>`;
  };
  const carregar = async () => { lista = await office(`/reservas-online?status=todas&filtro=entre&data=${somaDias(hojeIso(), -30)}&ate=${hojeIso()}`); selo('reservas', lista.filter((o) => o.status === 'pago_sem_vaga').length ? String(lista.filter((o) => o.status === 'pago_sem_vaga').length) : '', 'vermelho'); pintar(); };
  tela.addEventListener('click', async (e) => {
    const f = e.target.closest('[data-f]'); if (f) { R.filtro = +f.dataset.f; pintar(); return; }
    const r = e.target.closest('[data-resolver]'); if (r) { if (!confirm('Marcar como resolvido? (o cliente já foi reembolsado ou remarcado)')) return; try { await office(`/reservas-online/${r.dataset.resolver}/resolver`, { method: 'POST', body: {} }); toast('Marcado como resolvido'); carregar(); } catch (er) { falhou(er); } }
  });
  tela.addEventListener('input', (e) => { if (e.target.id === 'qRes') { R.q = e.target.value; pintar(); const i = $('#qRes'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } });
  await carregar();
  repetir(carregar, 30_000);
};

// ---------- Autoatendimento (pré-reservas que vieram dos totens)
TELAS.totens = async (tela) => {
  const hoje = hojeIso();
  tela.innerHTML = `${cabecalho('Clientes · totens da entrada e cadastro.kartodromodebetim.com.br', 'Autoatendimento', `<a class="btn escuro" href="${LINK_CADASTRO}" target="_blank" rel="noopener">Abrir o pré-cadastro</a>`)}<main class="principal"><section class="cartao" id="preRes"></section><section class="cartao leve"><div class="cartaoCab"><h2>Totens</h2><span class="sub">Totem 1 (.161) e Totem 2 (.69) · versão e tela de cada totem chegam na próxima atualização do servidor</span></div></section></main>`;
  const carregar = async () => {
    const lista = await office(`/reservas?status=todas&data=${hoje}`);
    const doTotem = lista.filter((r) => r.origem === 'totem' && r.status !== 'cancelada');
    $('#preRes').innerHTML = `<div class="cartaoCab"><h2>Quem passou pelos totens hoje</h2><span class="sub">${doTotem.length} pilotos · ${doTotem.filter((r) => !r.aprovada).length} esperando a recepção aprovar</span></div>
      <div class="rolagemX"><div style="min-width: 640px"><div class="cabTabela" style="grid-template-columns: 70px minmax(0, 1.5fr) 130px 70px 120px 130px"><span>Hora</span><span>Piloto</span><span>CPF</span><span style="text-align: right">Peso</span><span>Bateria</span><span>Situação</span></div>
      ${doTotem.map((r) => `<div class="linhaTabela" style="grid-template-columns: 70px minmax(0, 1.5fr) 130px 70px 120px 130px"><span class="mono">${esc((r.criadoEm || '').slice(11, 16))}</span><b class="trunc">${esc(r.cliente)}</b><span class="mono peq">${esc(r.documento || '—')}</span><span style="text-align: right">${r.peso ? r.peso + ' kg' : '—'}</span><span class="mono">${esc(horaDe(r.dataHora))}</span><span>${r.aprovada ? `<span class="chip ${r.pago ? 'verde' : 'laranja'}">${r.pago ? 'Pago' : 'Aprovada · a pagar'}</span>` : `<button class="btn peq" style="background: rgba(255,159,10,.16); color: var(--avisoTxt)" data-aprovar="${r.id}">Aprovar</button>`}</span></div>`).join('') || '<div class="vazio"><b>Ninguém usou os totens hoje ainda</b></div>'}</div></div>`;
  };
  tela.addEventListener('click', async (e) => { const ap = e.target.closest('[data-aprovar]'); if (ap) { ap.disabled = true; try { await office(`/reservas/${ap.dataset.aprovar}/aprovar`, { method: 'POST', body: {} }); toast('Pré-reserva aprovada'); carregar(); } catch (er) { falhou(er); ap.disabled = false; } } });
  await carregar();
  repetir(carregar, 30_000);
};

// ---------- Telas que dependem da próxima etapa do servidor
function emBreve(sobre, titulo, texto, itens) {
  return async (tela) => {
    tela.innerHTML = `${cabecalho(sobre, titulo)}<main class="principal"><section class="cartao"><div class="cartaoCab"><h2>Em implantação</h2><span class="chip laranja">próxima etapa</span></div><p style="margin: 0; padding: 0 18px 12px; line-height: 1.6; color: var(--tinta2)">${texto}</p><ul style="margin: 0; padding: 0 18px 18px 36px; line-height: 1.8">${itens.map((i) => `<li>${i}</li>`).join('')}</ul></section></main>`;
  };
}
TELAS.campeonatos = emBreve('Competições', 'Campeonatos', 'Os resultados das etapas já são gerados pela cronometragem. A tela de campeonatos precisa das categorias e da regra de pontuação no banco do servidor.', ['Etapas, categorias e pontuação (50, 45, 42, 40, 38…)', 'Bônus de pole e melhor volta, punição −10', 'PDF por categoria e publicação no site', 'Falta decidir: pontuar pela posição na categoria ou pela geral']);
TELAS.sorteio = emBreve('Operação', 'Sorteio e karts', 'O sorteio roda no tablet e grava pela cronometragem. A tela web vai mostrar o sorteio, a frota e as trocas assim que o servidor expuser esses dados.', ['Sorteio de cada bateria, vindo do tablet', 'Frota: no sorteio, na oficina, bloqueado', 'Trocas de kart com as voltas levadas']);
TELAS.sistema = async (tela) => {
  tela.innerHTML = `${cabecalho('Sistema', 'PCs e sistema')}<main class="principal"><section class="kpis" id="servicos"></section><section class="cartao leve"><div class="cartaoCab"><h2>Computadores</h2><span class="sub">versão, último sinal e erros de cada PC chegam na próxima etapa (agente em cada PC)</span></div>
    <div class="rolagemX"><div style="min-width: 560px"><div class="cabTabela" style="grid-template-columns: 70px minmax(0, 1fr) minmax(0, 1.6fr)"><span>IP</span><span>Computador</span><span>Programas</span></div>${[['.53', 'Recepção', 'Recepção · impressora TM-T20'], ['.239', 'Recepção 2', 'Recepção · Totem · Cronometragem'], ['.12', 'Ana (gerência)', 'Recepção · Totem · Cronometragem'], ['.161', 'Totem 1', 'Autoatendimento'], ['.69', 'Totem 2', 'Autoatendimento'], ['.254', 'CRONO1', 'Cronometragem · TV'], ['.249', 'ORBITS', 'Cronometragem :4050 · painel de LED'], ['.13', 'SRVKART', 'Servidor da operação :4060 · SQL Server'], ['.250', 'Telão TB50', 'Placar LED grande']].map(([ip, n, a]) => `<div class="linhaTabela" style="grid-template-columns: 70px minmax(0, 1fr) minmax(0, 1.6fr)"><span class="mono">${ip}</span><b>${n}</b><span class="peq">${a}</span></div>`).join('')}</div></div></section></main>`;
  const pintar = async () => { await atualizarConexao(); const r = S.saude; if (!r) return; $('#servicos').innerHTML = [['Servidor da operação', 'SRVKART · KartodromoOps', r.ops], ['Cronometragem', 'ORBITS · decoder', r.crono]].map(([t, d, x]) => `<div class="kpi"><span class="rot"><span class="ponto" style="width: 8px; height: 8px; background: ${x.ok ? '#34C759' : '#FF453A'}"></span>${t}</span><span class="val" style="font-size: 22px">${x.ok ? x.ms + ' ms' : 'sem resposta'}</span><span class="peq">${d}</span></div>`).join(''); };
  await pintar();
  repetir(pintar, 30_000);
};

// ------------------------------------------------------------------ eventos gerais
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-acao]');
  if (!a) return;
  const acao = a.dataset.acao;
  if (acao === 'sair') { if (confirm('Sair do painel?')) sair(); }
  if (acao === 'busca') abrirBusca();
  if (acao === 'fechar') fecharCamada();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('#camada').innerHTML) fecharCamada();
  if (S.tela && S.tela.atalho) S.tela.atalho(e); // atalhos da tela aberta (S.tela zera a cada troca de tela)
});
window.addEventListener('hashchange', () => { if (S.token && $('#tela')) abrirTela(rotaAtual()); });
// espera grupo.js e painel.js (carregados depois deste arquivo)
document.addEventListener('DOMContentLoaded', montarApp);
