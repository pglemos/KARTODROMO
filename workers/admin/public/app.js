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
// lê um design token em tempo de execução (canvas não aceita var())
const tk = (nome) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
const G = (a, b) => `linear-gradient(180deg, ${a}, ${b})`;
const CORG = ['var(--kib-cor-estado-aviso-texto)', 'var(--kib-cor-estado-info-solido)', 'var(--kib-cor-categoria-roxo-base)', 'var(--kib-cor-marca-principal)', 'var(--kib-cor-estado-perigo-solido)', 'var(--kib-cor-estado-sucesso-texto)'];
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
  sync: 'M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16M16 16h5v5',
};
const svg = (d, tam = 14, cor = 'currentColor', larg = 2.2) => `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="${larg}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"></path></svg>`;

const NAV = [
  { t: 'Operação', itens: [['visao', 'Visão geral', IC.inicio, G('var(--kib-cor-borda-campo)', 'var(--kib-cor-texto-corpo)')], ['agenda', 'Agenda', IC.agenda, G('var(--kib-cor-categoria-laranja-topo)', 'var(--kib-cor-categoria-laranja-base)')], ['recepcao', 'Recepção', IC.recepcao, G('var(--kib-cor-categoria-verde-topo)', 'var(--kib-cor-categoria-verde-base)')]] },
  { t: 'Clientes', itens: [['pilotos', 'Pilotos', IC.pilotos, G('var(--kib-cor-categoria-azul-topo)', 'var(--kib-cor-estado-info-solido)')], ['ranking', 'Ranking', IC.ranking, G('var(--kib-cor-categoria-amarelo-topo)', 'var(--kib-cor-categoria-amarelo-base)')], ['reservas', 'Reservas online', IC.reservas, G('var(--kib-cor-categoria-ciano-topo)', 'var(--kib-cor-agenda-livre-cheio)')]] },
  { t: 'Competições', itens: [['campeonatos', 'Campeonatos', IC.camp, G('var(--kib-cor-categoria-ambar-topo)', 'var(--kib-cor-categoria-ambar-base)')]] },
  { t: 'Sistema', itens: [['sistema', 'PCs e sistema', IC.sistema, G('var(--kib-cor-borda-campo)', 'var(--kib-cor-texto-corpo)')], ['usuarios', 'Usuários e acessos', IC.pilotos, G('var(--kib-cor-categoria-roxo-topo)', 'var(--kib-cor-categoria-roxo-base)')]] },
];

// ------------------------------------------------------------------ estado e API
const S = {
  token: guarda.ler('kib-admin-token'), usuario: JSON.parse(guarda.ler('kib-admin-usuario') || 'null'),
  selos: {}, timers: [], tela: {}, perm: null, rota: 'visao',
};

// Permissões por tela (perfil do usuário). Sem configuração no perfil = acesso às telas de sempre, menos Usuários e acessos.
function podeTela(id, acao = 'acessar') {
  const p = S.perm;
  if (id === 'ajuda') return true;
  if (id === 'usuarios') return !!(S.usuario?.admin || p?.admin);
  if (!p || p.acessoTotal || !p.configurado) return true;
  const t = (p.telas || []).find((x) => x.funcao === id);
  return !!(t && (acao === 'acessar' ? t.acessar : t.alterar));
}
async function carregarPermissoes() {
  try { S.perm = await fetch('/api/office/minhas-permissoes', { headers: { authorization: 'Bearer ' + S.token } }).then(async (r) => { if (r.status === 401) throw new Error('401'); if (!r.ok) throw new Error('falhou'); return r.json(); }); }
  catch (e) { if (e.message === '401') { sair('Sua sessão terminou. Entre de novo.'); return false; } S.perm = { admin: !!S.usuario?.admin, acessoTotal: !!S.usuario?.admin, configurado: false, telas: [] }; }
  return true;
}
const primeiraTela = () => { for (const g of NAV) for (const [id] of g.itens) if (podeTela(id)) return id; return null; };

async function api(caminho, opcoes = {}) {
  let tentativa = null;
  if (opcoes.method === 'POST' && /^\/office\/grupos\/\d+\/pagamentos$/.test(caminho)) {
    tentativa = 'kib-recebimento-' + caminho + ':' + JSON.stringify(opcoes.body);
    const key = guarda.ler(tentativa) || crypto.randomUUID();
    guarda.gravar(tentativa, key);
    opcoes = { ...opcoes, body: { ...opcoes.body, idempotencyKey: key } };
  }
  const grava = (opcoes.method || 'GET') !== 'GET';
  if (grava && S.perm && caminho !== '/login' && !/^\/office\/senha$/.test(caminho) && S.rota !== 'usuarios' && !podeTela(S.rota, 'alterar')) throw new Error('Seu perfil só pode consultar esta tela.');
  const r = await fetch('/api' + caminho, {
    method: opcoes.method || 'GET',
    headers: { ...(S.token ? { authorization: 'Bearer ' + S.token } : {}), ...(opcoes.body ? { 'content-type': 'application/json' } : {}) },
    body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
  });
  const novo = r.headers.get('x-novo-token');
  if (novo) { S.token = novo; guarda.gravar('kib-admin-token', novo); }
  const dados = await r.json().catch(() => ({}));
  if (r.status === 401 && caminho !== '/login') { sair('Sua sessão terminou. Entre de novo.'); throw new Error('Sessão expirada.'); }
  if (!r.ok) { if (tentativa && r.status >= 400 && r.status < 500) guarda.gravar(tentativa, null); throw new Error(dados.error || `Erro ${r.status}`); }
  if (tentativa) guarda.gravar(tentativa, null);
  return dados;
}
const office = (c, o) => api('/office' + c, o);

let toastTimer;
function toast(msg, erro = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (erro ? ' erro' : '');
  el.setAttribute('role', 'status');
  el.innerHTML = `${svg(erro ? IC.fechar : IC.ok, 16, erro ? 'var(--kib-cor-estado-perigo-fundo)' : 'var(--kib-cor-categoria-verde-topo)', 2.6)}<span>${esc(msg)}</span>`;
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  document.body.appendChild(el);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.remove(), erro ? 9000 : 3600);
  if (erro) { const x = document.createElement('button'); x.type = 'button'; x.className = 'btn peq toastBtn'; x.textContent = 'Fechar'; x.addEventListener('click', () => el.remove()); el.appendChild(x); }
}
const falhou = (e, tentar) => {
  const m = String((e && e.message) || e || '');
  if (/Cannot read|is not (defined|a function)|undefined|TypeError|Failed to fetch|NetworkError|Unexpected token/i.test(m)) { console.error(e); toast('Não consegui concluir. Confira a conexão e tente de novo.', true); } else toast(m, true);
  const t = document.querySelector('.toast');
  if (t && typeof tentar === 'function') { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn peq toastBtn'; b.textContent = 'Tentar de novo'; b.addEventListener('click', () => { t.remove(); tentar(); }); t.insertBefore(b, t.querySelector('button')); }
};
// aviso com um botão (ex.: Desfazer) que fica 8 s na tela; quem usa teclado alcança o botão com Tab
function toastAcao(msg, rotulo, fn, ms = 8000) {
  const el = document.createElement('div');
  el.className = 'toast'; el.setAttribute('role', 'status');
  el.innerHTML = `${svg(IC.ok, 16, 'var(--kib-cor-categoria-verde-topo)', 2.6)}<span>${esc(msg)}</span><button type="button" class="btn peq toastBtn">${esc(rotulo)}</button>`;
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  document.body.appendChild(el);
  el.querySelector('button').addEventListener('click', async () => { el.remove(); try { await fn(); } catch (e) { falhou(e); } });
  const agendar = () => { clearTimeout(toastTimer); toastTimer = setTimeout(() => el.remove(), ms); };
  agendar();
  el.addEventListener('mouseenter', () => clearTimeout(toastTimer)); el.addEventListener('focusin', () => clearTimeout(toastTimer));
  el.addEventListener('mouseleave', agendar); el.addEventListener('focusout', agendar);
}
// "MARIA DE SOUZA" (tudo maiúsculo no cadastro) vira "Maria de Souza"; nome já misto não é mexido
// Diálogo próprio (nada de confirm/prompt nativos): fica POR CIMA da janela aberta, prende o foco e Esc cancela.
// botoes: [{ rotulo, valor, classe }]; devolve o valor do botão (ou null se cancelar)
function dialogo({ titulo, texto = '', botoes, semFoco = false }) {
  return new Promise((resolve) => {
    const antes = document.activeElement;
    const veu = document.createElement('div'); veu.className = 'veu veuTopo';
    veu.innerHTML = `<div class="modal dialogoCaixa" role="alertdialog" aria-modal="true" aria-labelledby="dlgT" aria-describedby="dlgD"><div class="dialogoCorpo"><h2 id="dlgT" class="t-titulo peso-negrito">${esc(titulo)}</h2><p id="dlgD" class="t-corpo cor-corpo">${esc(texto)}</p><div class="linha-quebra gap-1 dialogoBotoes">${botoes.map((b, i) => `<button type="button" class="btn ${b.classe || 'sec'}" data-dlg="${i}">${esc(b.rotulo)}</button>`).join('')}<button type="button" class="btn link" data-dlg="x">Cancelar</button></div></div></div>`;
    document.body.appendChild(veu);
    const fim = (v) => { veu.remove(); document.removeEventListener('keydown', tecla, true); try { antes && antes.focus(); } catch { /* sumiu */ } resolve(v); };
    const tecla = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fim(null); }
      if (e.key === 'Tab') { const f = [...veu.querySelectorAll('button')]; const i = f.indexOf(document.activeElement); e.preventDefault(); e.stopPropagation(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); }
    };
    document.addEventListener('keydown', tecla, true);
    veu.addEventListener('click', (e) => { const b = e.target.closest('[data-dlg]'); if (b) fim(b.dataset.dlg === 'x' ? null : botoes[+b.dataset.dlg].valor); });
    if (semFoco) { const t = veu.querySelector('#dlgT'); t.tabIndex = -1; t.focus(); } else (veu.querySelector('[data-dlg="0"]') || veu.querySelector('button')).focus();
  });
}
const confirmar = (titulo, texto, ok = 'Confirmar', perigo = false) => dialogo({ titulo, texto, botoes: [{ rotulo: ok, valor: true, classe: perigo ? 'perigo-solido' : 'prim' }] }).then((v) => v === true);
const escolherForma = (titulo, texto) => dialogo({ titulo, texto, botoes: [{ rotulo: 'Pix', valor: 'Pix', classe: 'sec' }, { rotulo: 'Cartão', valor: 'Cartão', classe: 'sec' }, { rotulo: 'Dinheiro', valor: 'Dinheiro', classe: 'sec' }], semFoco: true });
const nomeBonito = (n) => { const t = String(n || ''); if (!t || t !== t.toUpperCase()) return t; return t.toLowerCase().replace(/(^|\s)([a-zà-ú])/g, (m, a, b) => a + b.toUpperCase()).replace(/\s(De|Da|Do|Das|Dos|E)(?=\s)/g, (m) => m.toLowerCase()); };
// ajuda curta: um "?" que abre uma frase logo abaixo (funciona com teclado e leitor de tela, sem JS)
const dica = (texto, nome = 'isto') => `<details class="dicaDet"><summary aria-label="Ajuda: ${esc(nome)}" title="Ajuda: ${esc(nome)}">?</summary><span>${esc(texto)}</span></details>`;
const tracadoTxt = (t) => (/^t\d+$/i.test(String(t || '')) ? 'Traçado ' + String(t).slice(1) : t);

function limparTimers() { S.timers.forEach(clearInterval); S.timers = []; }
function repetir(fn, ms) { S.timers.push(setInterval(() => { if (!document.hidden) fn(); }, ms)); }

// ------------------------------------------------------------------ login
function telaLogin(msg = '') {
  limparTimers();
  $('#raiz').innerHTML = `<main class="login"><form id="fLogin" autocomplete="on">
    <div class="marca"><span class="logo"><img src="/kib-logo.png" alt="Kartódromo Internacional de Betim" width="36" height="36"></span><span class="col"><h1 class="t-titulo" style="margin: 0">Kartódromo de Betim</h1><span class="sub">Painel administrativo</span></span></div>
    <span class="sub" style="line-height: 1.5">Entre com o mesmo usuário e senha do programa da Recepção.</span>
    <label class="campo"><span>Usuário</span><input class="entrada" name="login" autocomplete="username" required autofocus></label>
    <label class="campo"><span>Senha</span><span style="position: relative; display: flex; align-items: center"><input class="entrada" id="inpSenhaLogin" name="senha" type="password" autocomplete="current-password" required style="padding-right: 76px"><button type="button" class="btn link peq" id="btnToggleSenha" aria-label="Mostrar senha" style="position: absolute; right: 10px; min-height: 32px; font-size: var(--kib-fonte-tamanho-pequeno)">Mostrar</button></span></label>
    <label style="display: flex; gap: var(--kib-espaco-1); align-items: center; min-height: 32px; font-size: var(--kib-fonte-tamanho-pequeno); color: var(--tinta2); line-height: 1.4"><input type="checkbox" name="termos" required style="width: 20px; height: 20px; flex-shrink: 0; accent-color: var(--verde)">Concordo com os termos de uso do sistema do kartódromo.</label>
    <span class="erroMsg" id="erroLogin" role="alert">${esc(msg)}</span>
    <button type="submit" class="btn prim" style="height: 42px">Entrar</button>
  </form></main>`;
  $('#btnToggleSenha')?.addEventListener('click', (ev) => {
    const inp = $('#inpSenhaLogin');
    if (!inp) return;
    const mostrar = inp.type === 'password';
    inp.type = mostrar ? 'text' : 'password';
    ev.currentTarget.textContent = mostrar ? 'Ocultar' : 'Mostrar';
    ev.currentTarget.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
  });
  $('#fLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const botao = e.target.querySelector('button[type="submit"]'); botao.disabled = true; botao.textContent = 'Entrando…';
    try {
      const r = await api('/login', { method: 'POST', body: { login: f.get('login'), senha: f.get('senha'), termos: !!f.get('termos') } });
      S.token = r.token; S.usuario = r.usuario; S.perm = null;
      guarda.gravar('kib-admin-token', r.token); guarda.gravar('kib-admin-usuario', JSON.stringify(r.usuario));
      if (!location.hash) location.hash = '#/visao';
      montarApp();
    } catch (err) {
      $('#erroLogin').textContent = err.message; botao.disabled = false; botao.textContent = 'Entrar';
    }
  });
}
function sair(msg) { S.token = null; S.usuario = null; S.perm = null; guarda.gravar('kib-admin-token', null); guarda.gravar('kib-admin-usuario', null); telaLogin(msg); }

// ------------------------------------------------------------------ casca
function rotaAtual() { const r = (location.hash.match(/^#\/([a-z]+)/) || [])[1]; return TELAS[r] ? r : 'visao'; }

async function montarApp() {
  if (!S.token) return telaLogin();
  if (!S.perm && !(await carregarPermissoes())) return;
  let rota = rotaAtual();
  if (!podeTela(rota)) { rota = primeiraTela(); if (!rota) { sair('Seu perfil ainda não tem nenhuma tela liberada. Fale com o administrador.'); return; } location.hash = '#/' + rota; }
  const u = S.usuario || { nome: '?' };
  $('#raiz').innerHTML = `<div class="app">
  <aside class="lateral" aria-label="Menu principal">
    <a href="#/visao" class="marca"><span class="logo"><img src="/kib-logo.png" alt="Kartódromo Internacional de Betim"></span><span class="col"><b class="t-corpo">Kartódromo de Betim</b><span class="peq">Painel administrativo</span></span></a>
    <button class="buscaBtn ocultarCelular hov" data-acao="busca">${svg(IC.busca, 14, 'var(--kib-cor-texto-apoio)')}<span>Buscar cliente, CPF, tela…</span></button>
    <nav class="grupos" aria-label="Módulos">${NAV.map((g) => ({ ...g, itens: g.itens.filter(([id]) => podeTela(id)) })).filter((g) => g.itens.length).map((g) => `<div class="grupo"><span class="grupo-titulo">${g.t}</span>${g.itens.map(([id, t, ic, cor]) => `
      <a href="#/${id}" aria-label="${esc(t)}" class="navItem hov ${id === rota ? 'atual' : ''}" ${id === rota ? 'aria-current="page"' : ''}><span class="tile" style="background: ${cor}">${svg(ic, 13, 'var(--kib-cor-superficie-padrao)', 2.3)}</span><span class="cresce">${t}</span><span id="selo-${id}"></span></a>`).join('')}</div>`).join('')}</nav>
    <div class="rodapeLateral ocultarCelular">
      <div class="estadoCard" id="estadoConexao"><span style="display: flex; align-items: center; gap: var(--kib-espaco-1); font-size: var(--kib-fonte-tamanho-pequeno); font-weight: 600; color: var(--mudo)"><span class="ponto" style="background: var(--kib-cor-borda-forte)"></span>Conferindo conexão…</span></div>
      <div class="usuario"><span class="avatar m" style="background: var(--kib-cor-estado-info-solido); font-size: var(--kib-fonte-tamanho-corpo)">${esc(iniciais(u.nome))}</span>
        <span class="col cresce"><b class="t-pequeno">${esc(u.nome)}</b><span class="peq">${u.admin ? 'Administrador' : esc(S.perm?.perfil || 'Recepção')}</span></span>
        <button class="btn sec peq icone peq" data-acao="sair" aria-label="Sair">${svg(IC.sair, 14, 'var(--kib-cor-texto-corpo)')}</button></div>
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
    el.innerHTML = `<span style="display: flex; align-items: center; gap: var(--kib-espaco-1); font-size: var(--kib-fonte-tamanho-pequeno); font-weight: 600; color: ${ok ? 'var(--okTxt)' : 'var(--avisoTxt)'}"><span class="ponto ${ok ? 'pulso' : ''}" style="background: ${ok ? 'var(--kib-cor-status-ok)' : 'var(--kib-cor-estado-aviso-solido)'}"></span>${ok ? 'Tudo conectado' : 'Conexão com problema'}</span>
      <span class="peq" style="line-height: 1.4">Servidor ${r.ops.ok ? r.ops.ms + ' ms' : 'sem resposta'} · cronometragem ${r.crono.ok ? r.crono.ms + ' ms' : 'sem resposta'}</span>`;
    S.saude = r;
  } catch { /* fica como está */ }
}

function selo(id, txt, tipo) { const el = $('#selo-' + id); if (el) el.innerHTML = txt ? `<span class="selo ${tipo}">${esc(txt)}</span>` : ''; }

function cabecalho(sobre, titulo, acoes = '') {
  return `<header class="cab"><div class="col gap-meio"><span class="sobre">${sobre}</span><h1>${titulo}</h1></div><div class="acoes">${acoes}</div></header>`;
}

function abrirTela(rota) {
  if (!podeTela(rota)) { const p = primeiraTela(); if (p && p !== rota) { location.hash = '#/' + p; return; } }
  S.rota = rota;
  limparTimers();
  fecharCamada();
  document.querySelectorAll('.navItem').forEach((a) => { const at = a.getAttribute('href') === '#/' + rota; a.classList.toggle('atual', at); at ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
  const velha = $('#tela'); if (!velha) return;
  const tela = velha.cloneNode(false); velha.replaceWith(tela); // elemento novo: os cliques da tela anterior não se acumulam
  tela.innerHTML = `<div class="principal"><div class="esqueleto" style="height: 60px; width: 320px"></div><div class="esqueleto" style="height: 120px"></div><div class="esqueleto" style="height: 360px"></div></div>`;
  S.tela = {};
  Promise.resolve(TELAS[rota](tela)).catch((e) => { tela.innerHTML = `<div class="principal"><div class="cartao"><div class="vazio"><b>Não deu para carregar</b><span>${esc(e.message)}</span><button class="btn sec" style="margin-top: var(--kib-espaco-1)" onclick="location.reload()">Tentar de novo</button></div></div></div>`; });
  window.scrollTo(0, 0);
}

// ------------------------------------------------------------------ camada (gaveta, modal)
let focoAnterior = null, focoSeletor = null;
// reserva nova com algo digitado: pergunta antes de descartar (Cancelar, X e Esc passam por aqui)
// fecha a janela; se há reserva em preenchimento, pergunta antes (diálogo próprio, nada de confirm nativo)
const fecharComAviso = (fn) => {
  if (!(typeof Grupo !== 'undefined' && Grupo.sujo && Grupo.sujo())) return fn();
  confirmar('Descartar esta reserva?', 'O que você digitou será perdido.', 'Descartar', true).then((ok) => { if (ok) { if (Grupo.descartar) Grupo.descartar(); fn(); } });
};
function fecharCamada() {
  $('#camada').innerHTML = '';
  let alvo = focoAnterior && document.contains(focoAnterior) ? focoAnterior : (focoSeletor ? document.querySelector(focoSeletor) : null);
  if (alvo) { try { alvo.focus({ preventScroll: true }); } catch { /* elemento sumiu */ } }
  focoAnterior = null; focoSeletor = null;
}
function prenderFoco(el) {
  if (!focoAnterior && document.activeElement && document.activeElement !== document.body) { focoAnterior = document.activeElement; const a = focoAnterior; focoSeletor = a.dataset && a.dataset.sel ? `[data-sel="${a.dataset.sel}"]` : a.dataset && a.dataset.nova ? '[data-nova]' : null; }
  el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true });
  return el;
}
function gaveta(html, nome = 'Detalhe da bateria') { $('#camada').innerHTML = `<aside class="gaveta" role="dialog" aria-modal="true" aria-label="${esc(nome)}">${html}</aside>`; return prenderFoco($('#camada .gaveta')); }
function modal(html, nome = 'Janela') { $('#camada').innerHTML = `<div class="veu"><div class="modal" role="dialog" aria-modal="true" aria-label="${nome}">${html}</div></div>`; return prenderFoco($('#camada .modal')); }

// ------------------------------------------------------------------ classificação das baterias (mesmas cores do FamilyWall)
const TIPOS = {
  livre: { t: 'Livre para reservar', curto: 'Vagas', fundo: 'background: var(--kib-cor-agenda-livre-fundo); color: var(--kib-cor-agenda-livre-texto)', cor: 'var(--kib-cor-agenda-livre-marca)', cheio: 'var(--kib-cor-agenda-livre-cheio)', topo: 'background: linear-gradient(160deg, var(--kib-cor-agenda-livre-topo-inicio), var(--kib-cor-agenda-livre-topo-fim)); color: var(--kib-cor-agenda-livre-topo-texto)' },
  reserva: { t: 'Com reserva', curto: 'Reserva', fundo: 'background: var(--kib-cor-agenda-reserva-fundo); color: var(--kib-cor-agenda-reserva-texto)', cor: 'var(--kib-cor-estado-aviso-solido)', cheio: 'var(--kib-cor-agenda-reserva-cheio)', topo: 'background: linear-gradient(160deg, var(--kib-cor-agenda-reserva-topo-inicio), var(--kib-cor-agenda-reserva-topo-fim)); color: var(--kib-cor-agenda-reserva-topo-texto)' },
  fechada: { t: 'Bateria fechada', curto: 'Fechada', fundo: 'background: var(--kib-cor-agenda-fechada-fundo); color: var(--kib-cor-agenda-fechada-texto)', cor: 'var(--kib-cor-estado-perigo-solido)', cheio: 'var(--kib-cor-estado-perigo-solido)', topo: 'background: linear-gradient(160deg, var(--kib-cor-agenda-fechada-topo-inicio), var(--kib-cor-agenda-fechada-topo-fim)); color: var(--kib-cor-agenda-fechada-topo-texto)' },
  camp: { t: 'Campeonato', curto: 'Camp.', fundo: 'background: var(--kib-cor-agenda-campeonato-fundo); color: var(--kib-cor-agenda-campeonato-texto)', cor: 'var(--kib-cor-marca-principal)', cheio: 'var(--kib-cor-marca-principal)', topo: 'background: linear-gradient(160deg, var(--kib-cor-agenda-campeonato-topo-inicio), var(--kib-cor-agenda-campeonato-topo-fim)); color: var(--kib-cor-agenda-campeonato-texto)' },
  evento: { t: 'Evento ou treino', curto: 'Evento', fundo: 'background: var(--kib-cor-agenda-evento-fundo); color: var(--kib-cor-agenda-evento-texto)', cor: 'var(--kib-cor-estado-info-solido)', cheio: 'var(--kib-cor-estado-info-solido)', topo: 'background: linear-gradient(160deg, var(--kib-cor-agenda-evento-topo-inicio), var(--kib-cor-agenda-evento-topo-fim)); color: var(--kib-cor-agenda-evento-topo-texto)' },
  bloq: { t: 'Bloqueado', curto: 'Bloq.', fundo: 'background: repeating-linear-gradient(135deg, var(--kib-cor-borda-sutil) 0 6px, var(--kib-cor-fundo-app) 6px 12px); color: var(--kib-cor-texto-corpo)', cor: 'var(--kib-cor-borda-campo)', cheio: 'var(--kib-cor-borda-campo)', topo: 'background: linear-gradient(160deg, var(--kib-cor-borda-sutil), var(--kib-cor-superficie-campo)); color: var(--kib-cor-texto-corpo)' },
};
const ORDEM_TIPOS = ['livre', 'reserva', 'fechada', 'camp', 'evento', 'bloq'];
function tipoDe(b) {
  const nome = `${b.nome || ''} ${b.produto || ''} ${b.categoria || ''}`.toLowerCase();
  if (b.campeonato === true || b.campeonato === 1) return 'camp'; // marcada como campeonato na bateria
  if (b.reservaFechada) return 'fechada';
  if (+b.vagas === 0 || b.autoAtendimento === false || b.autoAtendimento === 0) return 'bloq';
  if (/kac|legends|ultras|campeonato|etapa|copa|endurance|milhas/.test(nome) && !/treino/.test(nome)) return 'camp';
  if (/treino|evento|tabajara|bier|super quinta|time attack|ins[oô]nia|empresa|equaliza|anivers/.test(nome)) return 'evento';
  return (+b.inscritos || 0) > 0 ? 'reserva' : 'livre';
}
function situacaoBateria(b) {
  const dia = b.dataHora.slice(0, 10), hoje = hojeIso(), ini = hm(horaDe(b.dataHora)), agora = agoraMin();
  if (dia < hoje || (dia === hoje && ini + 35 <= agora)) return 'fim';
  if (dia === hoje && ini <= agora && agora < ini + 35) return 'prevista';
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
  return nomeBonito(b.responsavel) || (generico(b.nome) ? (curto ? `${n} avulso${n === 1 ? '' : 's'}` : `${n} piloto${n === 1 ? '' : 's'} avulso${n === 1 ? '' : 's'}`) : b.nome);
};
const falta = (b) => Math.max(0, (+b.inscritos || 0) - (+b.pagos || 0));
const faltaValor = (b) => Math.max(0, Number(b.saldoCentavos) || 0);
// UM só jeito de dizer quanto falta pagar (grade, lista, gaveta e painel lateral): "faltam R$ 130 · 2 de 3 sem pagar"
const pagCurto = (b) => (+b.preco ? `faltam ${brlCurto(faltaValor(b))}` : `${falta(b)} sem pagar`);
const pagLongo = (b) => { const f = falta(b), n = +b.inscritos || 0; return !n ? '' : f ? `${+b.preco ? `faltam ${brlCurto(faltaValor(b))} · ` : ''}${f} de ${n} sem pagar` : 'tudo pago'; };
const urgente = (b) => b.dataHora.slice(0, 10) === hojeIso() && hm(horaDe(b.dataHora)) - agoraMin() <= 180;
const livresTxt = (b, st = situacaoBateria(b), tp = tipoDe(b)) => {
  const l = +b.disponiveis || 0, n = +b.inscritos || 0;
  if (st === 'fim') return n ? `${n} inscritos` : 'sem inscritos';
  if (b.status === 'fechada') return 'Fechada';
  if (tp === 'fechada') return 'Fechada';
  if (tp === 'bloq') return 'Bloqueada';
  return l === 0 ? 'Lotada' : `${l} ${l === 1 ? 'livre' : 'livres'}`;
};
const amostra = (t, on) => t === 'livre'
  ? `background: var(--kib-cor-superficie-padrao); box-shadow: inset 0 0 0 1.5px ${on ? 'var(--kib-cor-texto-apoio)' : 'var(--kib-cor-borda-forte)'}`
  : t === 'bloq' ? (on ? TIPOS.bloq.fundo + '; box-shadow: inset 0 0 0 1px var(--kib-cor-icone-suave)' : 'background: var(--kib-cor-superficie-padrao); box-shadow: inset 0 0 0 1.5px var(--kib-cor-borda-forte)')
    : on ? 'background: ' + TIPOS[t].cor : 'background: var(--kib-cor-superficie-padrao); box-shadow: inset 0 0 0 1.5px var(--kib-cor-borda-forte)';

// ------------------------------------------------------------------ busca geral
function abrirBusca() {
  const m = modal(`<div style="padding: 0"><label style="display: flex; align-items: center; gap: var(--kib-espaco-1); padding: var(--kib-espaco-denso-12) var(--kib-espaco-2); border-bottom: 1px solid var(--linha2); background: var(--kib-cor-superficie-padrao)">${svg(IC.busca, 17, 'var(--kib-cor-texto-apoio)')}<input id="qBusca" placeholder="Nome, CPF, telefone ou nome de tela…" aria-label="Buscar" style="flex-grow: 1; min-width: 0; border: 0; outline: none; background: transparent; font-size: var(--kib-fonte-tamanho-subtitulo)"><button class="btn sec peq" data-acao="fechar">Fechar</button></label><div id="resBusca" style="max-height: 440px; overflow-y: auto; padding: var(--kib-espaco-meio); background: var(--kib-cor-superficie-padrao)"></div></div>`);
  m.style.maxWidth = '600px';
  const entrada = $('#qBusca'); entrada.focus();
  let t;
  const telas = NAV.flatMap((g) => g.itens);
  const pintar = async () => {
    const q = entrada.value.trim(); const qq = q.toLowerCase();
    const achadas = telas.filter(([, t2]) => !qq || t2.toLowerCase().includes(qq));
    let html = achadas.map(([id, t2, ic, cor]) => `<a href="#/${id}" class="hov" data-acao="fechar" style="display: flex; align-items: center; gap: var(--kib-espaco-1); height: 42px; padding: 0 var(--kib-espaco-1); border-radius: var(--kib-raio-botao); text-decoration: none; color: var(--tinta)"><span class="tile" style="width: 26px; height: 26px; background: ${cor}">${svg(ic, 13, 'var(--kib-cor-superficie-padrao)')}</span><span style="flex-grow: 1; font-weight: 500">${t2}</span><span class="peq">Tela</span></a>`).join('');
    if (q.length >= 2) {
      html += `<div class="peq" style="padding: var(--kib-espaco-1) var(--kib-espaco-1) var(--kib-espaco-meio)">Clientes</div><div id="cliBusca"><div class="esqueleto" style="height: 40px; margin: var(--kib-espaco-meio)"></div></div>`;
    }
    $('#resBusca').innerHTML = html || '<p class="vazio">Nada encontrado.</p>';
    if (q.length >= 2) {
      try {
        const cli = await office('/clientes?q=' + encodeURIComponent(q));
        const alvo = $('#cliBusca'); if (!alvo || entrada.value.trim() !== q) return;
        alvo.innerHTML = cli.length ? cli.slice(0, 20).map((c) => `<div style="display: flex; align-items: center; gap: var(--kib-espaco-1); padding: var(--kib-espaco-1) var(--kib-espaco-1); border-radius: var(--kib-raio-botao)"><span class="avatar m" style="background: ${CORG[c.id % 6]}">${esc(iniciais(c.nome))}</span><span class="col cresce"><b class="trunc">${esc(c.nome)}</b><span class="peq">${esc(c.documento || 'sem documento')} · ${esc(c.telefone || 'sem telefone')}${c.peso ? ' · ' + esc(c.peso) + ' kg' : ''}</span></span>${c.telefone ? `<a class="btn verdeClaro peq" target="_blank" rel="noopener" href="${esc(zap(c.telefone, 'Olá, ' + c.nome.split(' ')[0] + '! Aqui é do Kartódromo de Betim.'))}">WhatsApp</a>` : ''}</div>`).join('') : '<p class="peq" style="padding: var(--kib-espaco-1) var(--kib-espaco-1)">Nenhum cliente com esse nome, CPF ou telefone.</p>';
      } catch (e) { const alvo = $('#cliBusca'); if (alvo) alvo.innerHTML = `<p class="peq" style="padding: var(--kib-espaco-1) var(--kib-espaco-1)">${esc(e.message)}</p>`; }
    }
  };
  entrada.addEventListener('input', () => { clearTimeout(t); t = setTimeout(pintar, 250); });
  pintar();
}

// ------------------------------------------------------------------ TELAS
const TELAS = {};

// ---------- Visão geral
const kartTxt = (v) => (v ? String(v).charAt(0).toUpperCase() + String(v).slice(1) : '');
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
TELAS.visao = async (tela) => {
  const hoje = hojeIso();
  const d = deIso(hoje);
  const nomeU = (S.usuario?.nome || '').split(' ')[0];
  const h = agoraMin();
  const saud = h < 5 * 60 ? 'Boa noite' : h < 12 * 60 ? 'Bom dia' : h < 18 * 60 ? 'Boa tarde' : 'Boa noite';
  tela.innerHTML = `${cabecalho(`${DIAS[d.getDay()][0].toUpperCase() + DIAS[d.getDay()].slice(1)}, ${d.getDate()} de ${MESES[d.getMonth()]}<span id="atualizadoV" style="color: var(--mudo2); font-weight: 500"></span>`, nomeU ? `${saud}, ${esc(nomeU)}` : saud, `<a href="#/agenda" class="btn branco">Abrir agenda</a><button class="btn prim" data-nova-reserva="1">${svg(IC.mais, 14, 'var(--kib-cor-acao-sobre-principal)', 2.6)}Nova reserva</button>`)}
  <main class="principal">
    <section id="pendencias" aria-live="polite"><div class="esqueleto" style="height: 56px"></div></section>
    <section class="kpis kpis4" id="kpis">${'<div class="esqueleto" style="height: 112px"></div>'.repeat(4)}</section>
    <div class="linhaFlex" style="align-items: stretch">
      <section class="cartao" id="agoraSeguir" style="flex: 999 1 540px; min-width: 0"><div class="esqueleto" style="height: 220px; margin: var(--kib-espaco-2)"></div></section>
      <section class="placar" id="emPista" style="flex: 1 1 360px; min-width: 0"><div style="padding: var(--kib-espaco-2); color: var(--kib-cor-icone-suave)">Carregando a cronometragem…</div></section>
    </div>
    <section class="cartao" id="linhaDia"><div class="esqueleto" style="height: 150px; margin: var(--kib-espaco-2)"></div></section>
    <p class="peq" style="margin: 0; text-align: center"><a href="#/ajuda" data-ajuda-visao="1">Como ler esta tela</a></p>
  </main>`;
  const irAgenda = (b) => { S.irAgenda = { dia: b.dataHora.slice(0, 10), id: b.id }; location.hash = '#/agenda'; };
  const prontoTotem = (r) => !!(r.documento && r.email && r.peso && r.telefone);
  let bats = [];

  const pintarPendencias = (online, aprovar, abertos) => {
    const restantes = bats.filter((b) => situacaoBateria(b) !== 'fim');
    const itens = [];
    const atencao = online.filter((o) => o.status === 'pago_sem_vaga');
    if (atencao.length) itens.push(['vermelho', `${plural(atencao.length, 'reserva do site paga', 'reservas do site pagas')} sem vaga`, 'O horário lotou depois do pagamento. Devolva o dinheiro ou remarque com o cliente.', 'Ver reservas', '#/reservas']);
    if (S.saude && S.saude.ops && !S.saude.ops.ok) itens.push(['vermelho', 'Servidor da operação sem resposta', 'A Recepção, os totens e o site podem não estar gravando. Confira o SRVKART na tela Sistema.', 'Ver estado dos PCs', '#/sistema']);
    if (S.saude && S.saude.crono && !S.saude.crono.ok) itens.push(['vermelho', 'Cronometragem sem resposta', 'O placar e os resultados não estão chegando do ORBITS. Confira a conexão na tela Sistema.', 'Ver estado dos PCs', '#/sistema']);
    if (aprovar.length) itens.push(['laranja', `${plural(aprovar.length, 'pré-reserva do totem', 'pré-reservas do totem')} para aprovar`, 'Os pilotos estão esperando a Recepção confirmar.', 'Aprovar na Recepção', '#/recepcao']);
    if (!abertos.length && restantes.length) itens.push(['laranja', 'Nenhum caixa aberto', `Abra o caixa no programa da Recepção antes da bateria das ${horaDe(restantes[0].dataHora)}.`, 'Ver Recepção', '#/recepcao']);
    const devendo = restantes.filter((b) => falta(b) > 0 && urgente(b));
    if (devendo.length === 1) { const b = devendo[0]; itens.push(['laranja', `${tituloBat(b)} · ${horaDe(b.dataHora)} ainda não pagou tudo`, `${plural(falta(b), 'piloto sem pagar', 'pilotos sem pagar')}${+b.preco ? ' · falta ' + brl(faltaValor(b)) : ''}`, 'Ver na agenda', `bat:${b.id}`]); }
    else if (devendo.length > 1) itens.push(['laranja', `${devendo.length} baterias das próximas 3 horas com piloto sem pagar`, `${devendo.map((b) => `${horaDe(b.dataHora)} ${tituloBat(b)}`).join(' · ')}${devendo.some((b) => +b.preco) ? ' · falta ' + brl(devendo.reduce((x, b) => x + faltaValor(b), 0)) : ''}`, 'Ver lista na agenda', 'lista']);
    const el = $('#pendencias');
    if (!itens.length) { el.innerHTML = `<div class="tudoEmDia">${svg(IC.ok, 16, 'var(--kib-cor-estado-sucesso-texto)', 2.8)}<b>Tudo em dia</b><span>bandeira verde: nenhuma pendência agora</span></div>`; return; }
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
    const feitas = bats.filter((b) => situacaoBateria(b) === 'fim').length, naPista = bats.find((b) => situacaoBateria(b) === 'prevista'), prox = bats.find((b) => situacaoBateria(b) === 'futura');
    const kpi = (t, v, nota, link, extra = '', estiloV = '') => `<a href="${link}" class="kpi ergue"><span class="rot">${t}</span><span class="col gap-meio"><span class="val" style="${estiloV}">${v}</span><span class="peq">${nota}</span></span>${extra}</a>`;
    const segmentos = `<span class="segmentos" role="img" aria-label="${feitas} baterias terminadas de ${bats.length}">${bats.map((b) => { const st = situacaoBateria(b); return `<span class="${st}"></span>`; }).join('')}</span>`;
    $('#kpis').innerHTML = [
      kpi('Pilotos hoje', insc, `de ${vagas} vagas · ${Math.round(oc * 100)}% ocupado`, '#/agenda', `<span class="barra" role="img" aria-label="${Math.round(oc * 100)}% das vagas ocupadas"><span style="width: ${Math.min(100, Math.round(oc * 100))}%; background: ${oc > .8 ? 'var(--kib-cor-estado-perigo-solido)' : oc > .5 ? 'var(--kib-cor-agenda-reserva-cheio)' : 'var(--kib-cor-categoria-verde-base)'}"></span></span>`),
      kpi('Recebido hoje', brlCurto(recebidoCaixa + recebidoOnline), `caixa ${brlCurto(recebidoCaixa)} · site ${brlCurto(recebidoOnline)} (${plural(pagasOnline.length, 'reserva', 'reservas')})`, '#/reservas', '', recebidoCaixa + recebidoOnline > 0 ? 'color: var(--okTxt)' : ''),
      kpi('A receber hoje', devendo.length ? brlCurto(aReceber) : 'Nada', devendo.length ? `${plural(devendo.length, 'bateria', 'baterias')} com piloto sem pagar${jaCorreram ? ` (${jaCorreram} já ${jaCorreram === 1 ? 'passou do horário' : 'passaram do horário'})` : ''}` : 'todos os pilotos de hoje pagaram', '#/agenda', '', !devendo.length ? 'color: var(--okTxt)' : temUrgente ? 'color: var(--avisoTxt)' : ''),
      kpi('Baterias encerradas', bats.length ? `${feitas} de ${bats.length}` : '—', naPista ? `${esc(tituloBat(naPista))} no horário previsto` : prox ? `próxima às ${horaDe(prox.dataHora)}` : bats.length ? 'horários previstos encerrados' : 'sem baterias hoje', '#/recepcao', bats.length ? segmentos : ''),
    ].join('');
  };

  const painelBateria = (b, rotulo, rs) => {
    const tp = tipoDe(b), T = TIPOS[tp], n = +b.inscritos || 0, vagas = +b.vagas || 0, pagos = +b.pagos || 0;
    const prontos = rs ? rs.filter((r) => r.status !== 'cancelada' && prontoTotem(r)).length : null;
    const ini = hm(horaDe(b.dataHora)), falt = ini - agoraMin();
    const quando = situacaoBateria(b) === 'prevista' ? '<span class="chip solido-ok sem-sinal">Horário previsto agora</span>' : `<span class="chip cinza">${rotulo}${falt > 0 && falt < 180 ? ` · em ${falt} min` : ''}</span>`;
    const sub = [generico(b.nome) ? '' : b.nome, b.produto, kartTxt(b.tipoKart)].filter(Boolean).filter((x) => x !== tituloBat(b, tp)).map(esc).join(' · ');
    return `<div class="painelBat">
      <span style="display: flex; align-items: center; gap: var(--kib-espaco-1); flex-wrap: wrap">${quando}<span class="mono peq cor-corpo">${horaDe(b.dataHora)}–${fmtHm(ini + 35)}</span></span>
      <span class="col" style="gap: 2px; min-width: 0; overflow-wrap: anywhere"><b style="font-size: var(--kib-fonte-tamanho-titulo); letter-spacing: -0.01em">${esc(tp === 'livre' ? 'Horário livre' : tituloBat(b, tp))}</b>${sub ? `<span class="peq">${sub}</span>` : ''}</span>
      <span class="numerosBat">
        <span><b>${n}</b><span>de ${vagas} pilotos</span></span>
        <span><b style="color: ${n && pagos < n ? 'var(--avisoTxt)' : n ? 'var(--okTxt)' : 'var(--tinta)'}">${pagos}</b><span>pagos${n && pagos < n && +b.preco ? ` · faltam ${brlCurto(faltaValor(b))}` : ''}</span></span>
        <span><b style="color: ${prontos !== null && prontos < n ? 'var(--avisoTxt)' : prontos !== null && n ? 'var(--okTxt)' : 'var(--tinta)'}">${prontos === null ? '—' : prontos}</b><span title="Documento, e-mail, peso e telefone preenchidos">com cadastro completo para o totem</span></span>
      </span>
      <span style="display: flex; gap: var(--kib-espaco-1); flex-wrap: wrap; margin-top: auto"><a class="btn sec peq" href="#/recepcao" data-ir-recepcao="${b.id}">Ver pilotos</a><button class="btn sec peq" data-ir-bat="${b.id}">Abrir na agenda</button></span>
    </div>`;
  };
  const pintarAgora = async () => {
    const naPista = bats.find((b) => situacaoBateria(b) === 'prevista'), futuras = bats.filter((b) => situacaoBateria(b) === 'futura');
    const foco = (naPista ? [[naPista, 'Horário previsto'], futuras[0] && [futuras[0], 'Próxima']] : [futuras[0] && [futuras[0], 'Próxima'], futuras[1] && [futuras[1], 'Depois']]).filter(Boolean);
    const el = $('#agoraSeguir');
    if (!foco.length) {
      const inscritos = bats.reduce((a, b) => a + (+b.inscritos || 0), 0), amanha = somaDias(hoje, deIso(somaDias(hoje, 1)).getDay() === 1 ? 2 : 1);
      el.innerHTML = `<div class="cartaoCab"><h2>Agora e a seguir</h2></div><div class="fimDoDia"><b>${bats.length ? 'Bandeirada final: os horários previstos de hoje terminaram' : 'Sem baterias hoje'}</b><span class="peq t-corpo">${bats.length ? `${plural(inscritos, 'piloto inscrito', 'pilotos inscritos')} em ${plural(bats.length, 'bateria', 'baterias')}.` : d.getDay() === 1 ? 'Segunda o kartódromo não abre.' : 'Dia fechado ou grade ainda não gerada.'}</span><span style="display: flex; gap: var(--kib-espaco-1); flex-wrap: wrap; margin-top: var(--kib-espaco-meio)"><button class="btn sec peq" data-ir-dia="${amanha}">Ver ${amanha === somaDias(hoje, 1) ? 'amanhã' : 'terça'} na agenda</button><button class="btn sec peq" data-nova-reserva="1">Nova reserva</button></span></div>`;
      return;
    }
    const rs = await Promise.all(foco.map(([b]) => (+b.inscritos ? office(`/reservas?bateriaId=${b.id}&status=todas`).catch(() => null) : Promise.resolve([]))));
    if (!$('#agoraSeguir')) return;
    el.innerHTML = `<div class="cartaoCab"><h2>Agora e a seguir</h2><a class="dir" href="#/agenda" style="font-size: var(--kib-fonte-tamanho-corpo); font-weight: 600; text-decoration: none">Agenda do dia</a></div><div class="agoraGrade">${foco.map(([b, r], i) => painelBateria(b, r, rs[i])).join('')}</div>`;
  };

  const blocoDia = (b) => {
    const tp = tipoDe(b), T = TIPOS[tp], st = situacaoBateria(b), n = +b.inscritos || 0, vagas = Math.max(1, +b.vagas || 0);
    const cls = ['bloco2', tp === 'livre' ? 'livre' : tp === 'bloq' ? 'bloq' : '', st === 'fim' ? 'passou' : '', st === 'prevista' ? 'pista' : ''].filter(Boolean).join(' ');
    const titulo = tituloBat(b, tp, true), dir = livresTxt(b, st, tp);
    return `<button class="${cls}" data-ir-bat="${b.id}" style="${tp === 'livre' || tp === 'bloq' ? '' : `${T.fundo}; --faixa: ${T.cor}`}" aria-label="${esc(`${horaDe(b.dataHora)}, ${titulo}, ${T.t}, ${dir}`)}">
      <span class="linha1"><span class="mono hora">${horaDe(b.dataHora)}</span>${st === 'prevista' ? `<span class="naPista" title="Bateria prevista para agora${dir ? ' · ' + esc(dir) : ''}">PREVISTA AGORA</span>` : `<span class="dirB">${dir}</span>`}</span>
      <span class="tituloB trunc">${esc(tp === 'livre' ? 'Livre' : titulo)}</span>${st !== 'fim' && falta(b) && tp !== 'livre' ? `<span class="aPagarB">${pagCurto(b)}</span>` : ''}${tp === 'livre' ? '' : `<span class="barraB" style="width: ${Math.round(Math.min(1, n / vagas) * 100)}%; background: ${T.cheio}"></span>`}</button>`;
  };
  const pintarLinha = () => {
    const el = $('#linhaDia');
    if (!bats.length) { el.innerHTML = `<div class="cartaoCab"><h2>Linha do dia</h2></div><div class="vazio"><b>Sem baterias hoje</b><span>${d.getDay() === 1 ? 'Segunda o kartódromo não abre.' : 'Dia fechado ou grade ainda não gerada.'}</span></div>`; return; }
    el.innerHTML = `<div class="cartaoCab"><span class="col"><h2>Linha do dia</h2><span class="sub">selecione uma bateria para abrir na agenda</span></span><span class="dir legendaCurta"><span><span class="amostra" style="${amostra('livre', true)}"></span>livre</span><span><span class="amostra" style="background: var(--kib-cor-agenda-reserva-fundo); box-shadow: inset 3px 0 0 var(--kib-cor-estado-aviso-solido)"></span>com reserva ou evento</span><span><span class="amostra" style="box-shadow: inset 0 0 0 2px var(--kib-cor-estado-perigo-solido)"></span>prevista para agora</span></span></div>
      <div class="rolagemX cartao-corpo" id="rolaLinha"><div class="linhaBlocos">${bats.map(blocoDia).join('')}</div></div>`;
    const foco = el.querySelector('.bloco2.pista') || el.querySelector('.bloco2:not(.passou)'), rola = $('#rolaLinha');
    if (foco && rola) rola.scrollLeft = Math.max(0, foco.offsetLeft - rola.offsetLeft - 160);
  };

  let ultimaOk = '';
  const carregar = async () => {
    let bs, online, aprovar, movs;
    try {
      [bs, online, aprovar, movs] = await Promise.all([
        office(`/baterias?status=todas&data=${hoje}`),
        office(`/reservas-online?status=todas&data=${hoje}`).catch(() => []),
        office(`/reservas?status=aprovar&filtro=apartir&data=${hoje}`).catch(() => []),
        office('/movimentos').catch(() => []),
      ]);
    } catch (e) {
      if (!tela.isConnected || !$('#kpis')) return;
      const at = $('#atualizadoV');
      // já tinha dados na tela: mantém e avisa que estão velhos
      if (ultimaOk) { if (at) at.textContent = ` · sem conexão, dados das ${ultimaOk}`; return; }
      // primeira carga falhou: tira os esqueletos e mostra como tentar de novo
      $('#pendencias').innerHTML = `<div class="cartao pendencias"><div class="pendencia vermelho"><span class="col" style="flex: 1 1 260px; gap: 2px"><b>Não consegui carregar as baterias de hoje</b><span class="peq" style="line-height: 1.45">Confira a internet do computador. Detalhe: ${esc(e.message)}</span></span><button class="btn perigo peq" data-recarregar="1">Tentar de novo</button></div></div>`;
      ['#kpis', '#agoraSeguir', '#linhaDia'].forEach((s) => { const x = $(s); if (x) x.innerHTML = ''; });
      return;
    }
    bats = (Array.isArray(bs) ? bs : []).filter((b) => b && typeof b.dataHora === 'string' && b.dataHora.startsWith(hoje)).sort((x, y) => x.dataHora.localeCompare(y.dataHora));
    if (!$('#kpis')) return;
    ultimaOk = new Date().toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
    const at = $('#atualizadoV'); if (at) at.textContent = ` · atualizado às ${ultimaOk}`;
    const abertos = movs.filter((m) => !m.fechadoEm);
    selo('recepcao', aprovar.length ? String(aprovar.length) : '', 'vermelho');
    const nAt = online.filter((o) => o.status === 'pago_sem_vaga').length; selo('reservas', nAt ? String(nAt) : '', 'vermelho');
    pintarPendencias(online, aprovar, abertos);
    pintarKpis(online, movs);
    pintarLinha();
    await pintarAgora();
  };

  let vivoOcupado = false;
  const vivo = async () => {
    const el = $('#emPista', tela); if (!el || vivoOcupado) return;
    vivoOcupado = true;
    try {
      const s = await api('/crono/ao-vivo');
      if (!tela.isConnected) return;
      const corre = s.status === 'live' || s.status === 'running';
      selo('crono', corre ? 'ao vivo' : '', 'vivo');
      const pil = (s.drivers || []).filter((p) => +p.position < 900).slice(0, 5);
      const largou = s.race && s.race.startedAt ? new Date(s.race.startedAt) : null;
      const min = largou ? Math.max(0, Math.round((Date.now() - largou.getTime()) / 60000)) : null;
      if (!corre && !pil.length) { el.innerHTML = `<div class="placarVazio"><span class="chip" style="background: color-mix(in srgb, var(--kib-cor-acao-sobre-principal) 10%, transparent); color: var(--kib-cor-borda-sutil)">CRONOMETRAGEM</span><b>Nenhuma bateria no horário previsto</b><span>O placar aparece aqui quando a próxima largar.</span></div>`; return; }
      el.innerHTML = `<div style="display: flex; flex-direction: column; gap: var(--kib-espaco-meio); padding: var(--kib-espaco-2) var(--kib-espaco-2) var(--kib-espaco-1)">
          <span style="display: flex; align-items: center; flex-wrap: wrap; gap: var(--kib-espaco-1)"><span class="chip" style="background: ${corre ? 'color-mix(in srgb, var(--kib-cor-status-ok) 20%, transparent)' : 'color-mix(in srgb, var(--kib-cor-acao-sobre-principal) 10%, transparent)'}; color: ${corre ? 'var(--kib-cor-categoria-verde-topo)' : 'var(--kib-cor-borda-sutil)'}; letter-spacing: .05em">${corre ? '<span class="ponto pulso" style="background: var(--kib-cor-categoria-verde-topo)"></span>AO VIVO' : 'ÚLTIMA BATERIA'}</span>${largou ? `<span style="font-size: var(--kib-fonte-tamanho-pequeno); color: var(--kib-cor-icone-suave)">${corre ? `largou às ${largou.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })} · há ${min} min` : `largou às ${largou.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })}`}</span>` : ''}</span>
          <h2 style="margin: 0; font-size: var(--kib-fonte-tamanho-subtitulo); font-weight: 700">${esc(s.eventName || 'Bateria')}</h2></div>
        <div class="linha cabPlacar"><span>Pos</span><span>Kart</span><span>Piloto</span><span class="t-dir">Melhor volta</span></div>
        ${pil.map((p, i) => `<div class="linha"><span style="font-size: var(--kib-fonte-tamanho-subtitulo); font-weight: 700; color: ${i < 3 ? 'var(--kib-cor-categoria-amarelo-topo)' : 'var(--kib-cor-acao-sobre-principal)'}">${esc(p.position)}</span><span class="kartE">${esc(p.kart)}</span><span class="trunc peso-semibold">${esc(p.name)}</span><span class="mono" style="text-align: right; font-size: var(--kib-fonte-tamanho-corpo)">${esc(p.time || '—')}</span></div>`).join('') || '<div style="padding: var(--kib-espaco-denso-12) var(--kib-espaco-denso-20); color: var(--kib-cor-icone-suave)">Largou agora: ninguém completou volta ainda.</div>'}`;
    } catch (e) { if (!tela.isConnected) return; el.innerHTML = `<div class="placarVazio"><b>Cronometragem sem resposta</b><span>O placar tenta de novo a cada 5 segundos. Detalhe: ${esc(e.message)}</span><a href="#/sistema">Ver estado dos PCs${svg(IC.dir, 14, 'var(--kib-cor-categoria-verde-topo)', 2.4)}</a></div>`; }
    finally { vivoOcupado = false; }
  };

  tela.addEventListener('click', (e) => {
    if (e.target.closest('[data-ajuda-visao]')) { S.ajuda = { guia: 'visao' }; return; }
    if (e.target.closest('[data-recarregar]')) { $('#pendencias').innerHTML = '<div class="esqueleto" style="height: 56px"></div>'; carregar(); return; }
    if (e.target.closest('[data-nova-reserva]')) { S.irAgendaNova = true; location.hash = '#/agenda'; return; }
    const dd = e.target.closest('[data-ir-dia]'); if (dd) { S.agenda = { ...(S.agenda || { ocultos: {}, q: '' }), vista: 'dia', base: dd.dataset.irDia, sel: null }; location.hash = '#/agenda'; return; }
    if (e.target.closest('[data-ir-lista]')) { S.agenda = { ...(S.agenda || { ocultos: {}, q: '' }), vista: 'lista', base: hoje, sel: null }; location.hash = '#/agenda'; return; }
    const b = e.target.closest('[data-ir-bat]'); if (b) { const x = bats.find((y) => y.id === +b.dataset.irBat); if (x) irAgenda(x); return; }
    const rc = e.target.closest('[data-ir-recepcao]'); if (rc) S.irBateria = +rc.dataset.irRecepcao;
  });
  await atualizarConexao().catch(() => {});
  await carregar();
  vivo();
  repetir(carregar, 30_000); repetir(vivo, 5_000); repetir(atualizarConexao, 60_000);
};

// ---------- Agenda
TELAS.agenda = async (tela) => {
  const celular = () => window.matchMedia('(max-width: 760px)').matches;
  const A = S.agenda || (S.agenda = { vista: celular() ? 'dia' : 'semana', base: hojeIso(), ocultos: {}, q: '' });
  if (S.irAgenda) { A.base = S.irAgenda.dia; A.sel = S.irAgenda.id; A.vista = celular() ? 'dia' : 'semana'; S.irAgenda = null; }
  tela.innerHTML = `${cabecalho('<span class="ponto pulso" style="background: var(--kib-cor-status-ok)"></span><span class="cor-ok">Mesma agenda da Recepção, do site e dos totens</span><span id="atualizado" style="color: var(--mudo2); font-weight: 500"></span>', 'Agenda <span id="periodo" style="font-size: var(--kib-fonte-tamanho-titulo); font-weight: 600; color: var(--mudo); letter-spacing: 0"></span>', `
    <button class="btn prim" data-nova="1" title="Nova reserva (tecla N)">${svg(IC.mais, 14, 'var(--kib-cor-acao-sobre-principal)', 2.6)}Nova reserva<kbd class="atalho" aria-hidden="true">N</kbd></button>
    <div style="display: flex; align-items: center; gap: 2px; height: 40px; box-sizing: border-box; padding: 0 var(--kib-espaco-meio); border-radius: var(--kib-raio-botao); background: var(--kib-cor-superficie-padrao); box-shadow: 0 0 0 1px var(--linha2)"><button class="btn sec peq hov icone peq mudo" data-nav="-1" aria-label="Anterior" title="Anterior (seta para a esquerda)">${svg(IC.esq, 15)}</button><button class="btn sec peq" data-nav="0" title="Voltar para hoje (tecla T)">Hoje</button><button class="btn sec peq hov icone peq mudo" data-nav="1" aria-label="Próximo" title="Próximo (seta para a direita)">${svg(IC.dir, 15)}</button></div>
    <div class="seg" role="tablist" aria-label="Vista">${[['dia', 'Dia', 'D'], ['semana', 'Semana', 'S'], ['lista', 'Lista', 'L']].map(([v, t, k]) => `<button role="tab" data-vista="${v}" aria-selected="${A.vista === v}" title="${t} (tecla ${k})" class="${A.vista === v ? 'sel' : ''}">${t}</button>`).join('')}</div><button class="btn sec icone" data-ajuda-ag aria-haspopup="dialog" aria-label="Atalhos e legenda" title="Atalhos e legenda (tecla ?)">?</button>`)}
  <main class="principal agendaLayout">
    <div class="agendaLado">
      <section class="cartao leve" style="padding: var(--kib-espaco-denso-12)" id="miniCal"></section>
      <section class="cartao leve" style="padding: var(--kib-espaco-1)" id="filtrosTipo"></section>
      <section class="cartao leve" id="aPagar"></section>
    </div>
    <span id="avisoVivo" class="sr-only" role="status" aria-live="polite"></span>
    <section class="cartao agendaCal" id="calendario"><div class="esqueleto" role="status" aria-label="Carregando a agenda" style="height: 600px; margin: var(--kib-espaco-2)"></div></section>
  </main>`;
  let bats = [];
  let ultimaPista = null, offlineDesde = null, consulta = 0, periodoCarregado = null, detalhe = 0;
  tela.addEventListener('toggle', (e) => { if (e.target.matches && e.target.matches('.filtroDet')) A.filtroAberto = e.target.open; }, true);
  const semanaIni = () => { const d = deIso(A.base); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };

  const carregar = async (silencioso = false) => {
    const pedido = ++consulta, base = A.base, vista = A.vista, chavePeriodo = `${vista}:${base}`;
    const cal = tela.querySelector('#calendario'); if (!cal) return false;
    if (!silencioso) {
      cal.setAttribute('aria-busy', 'true');
    }
    const temConteudo = !!cal.querySelector('.rolagemX, .linhaDia, .cartaoCab, .vazio');
    if (!temConteudo && periodoCarregado !== chavePeriodo) {
      bats = [];
      cal.innerHTML = '<div class="esqueleto" role="status" aria-label="Carregando a agenda" style="height: 600px; margin: var(--kib-espaco-2)"></div>';
      const ap = $('#aPagar'); if (ap) ap.innerHTML = '';
    }
    try {
      const recebidas = vista === 'lista'
        ? await office(`/baterias?status=todas&filtro=entre&data=${base}&ate=${somaDias(base, 6)}`)
        : await office(`/baterias?status=todas&filtro=entre&data=${semanaIni()}&ate=${somaDias(semanaIni(), 6)}`);
      if (pedido !== consulta || !tela.isConnected) return false;
      recebidas.sort((x, y) => x.dataHora.localeCompare(y.dataHora) || (x.id - y.id));
      bats = recebidas;
      const at = $('#atualizado'); if (at) { at.style.color = ''; at.textContent = ` · atualizado às ${new Date().toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })}`; }
      const chaveBats = recebidas.map((b) => `${b.id}:${b.status}:${b.inscritos}:${b.vagas}:${b.disponiveis}:${b.pagos}:${b.preco}:${b.reservaFechada}:${b.autoAtendimento}:${b.dataHora}`).join('|');
      const mudou = tela._chaveBats !== chaveBats || periodoCarregado !== chavePeriodo;
      tela._chaveBats = chaveBats;
      periodoCarregado = chavePeriodo;

      if (mudou || !silencioso) {
        const sWinY = window.scrollY;
        pintar();
        pintarMini();
        if (window.scrollY !== sWinY) window.scrollTo({ top: sWinY, behavior: 'instant' });
      } else {
        const faixa = cal.querySelector('.faixaPista');
        const novaFaixaHtml = faixaPista();
        if (faixa) {
          if (!novaFaixaHtml) faixa.remove();
          else if (faixa.outerHTML !== novaFaixaHtml) {
            const temp = document.createElement('div');
            temp.innerHTML = novaFaixaHtml;
            if (temp.firstElementChild) faixa.replaceWith(temp.firstElementChild);
          }
        } else if (novaFaixaHtml) {
          cal.insertAdjacentHTML('afterbegin', novaFaixaHtml);
        }
      }

      offlineDesde = null;
      // leitor de tela: só diz o que MUDOU (bateria entrou ou saiu da pista), não relê a grade a cada 30 s
      const noAr = bats.find((b) => b.dataHora.startsWith(hojeIso()) && situacaoBateria(b) === 'prevista');
      const chave = noAr ? noAr.id : 0;
      if (ultimaPista !== null && ultimaPista !== chave) { const av = $('#avisoVivo'); if (av) av.textContent = noAr ? `Bateria das ${horaDe(noAr.dataHora)} atingiu o horário previsto.` : 'Nenhum horário previsto agora.'; }
      ultimaPista = chave;
      return true;
    } catch (e) {
      if (pedido !== consulta || !tela.isConnected) return false;
      // sem conexão: a tela antiga continua, mas o aviso fica claro e a próxima tentativa é automática (a cada 30 s)
      if (!offlineDesde) offlineDesde = new Date().toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
      const at = $('#atualizado'); if (at) { at.textContent = ` · sem conexão desde ${offlineDesde}, tentando de novo`; at.style.color = 'var(--avisoTxt)'; }
      if (!bats.length || periodoCarregado !== chavePeriodo) { // período novo que não carregou: não mostra a grade do período anterior
        bats = []; periodoCarregado = null;
        cal.innerHTML = `<div class="vazio" role="alert"><b>Não foi possível carregar este período</b><span>Sem internet ou servidor da operação fora do ar. Confira a conexão e tente de novo.</span><button class="btn sec" data-ag-repetir>Tentar novamente</button></div>`;
        const ap = $('#aPagar'); if (ap) ap.innerHTML = '';
      }
      return false;
    } finally { if (pedido === consulta) cal.removeAttribute('aria-busy'); }
  };
  const recarregar = async () => {
    if (document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    const sel = A.sel, g = $('#camada .gaveta');
    if (await carregar(true) && sel && A.sel === sel && g && g.isConnected && !$('#camada .modal')) await abrirBateria(sel, { silencioso: true });
  };
  if (typeof AgendaAcoes !== 'undefined') AgendaAcoes.montar({ tela, A, recarregar, carregar, bats: () => bats, abrir: (id) => abrirBateria(id) });
  const filtrar = (lista) => lista.filter((b) => !A.ocultos[tipoDe(b)] && (!A.q || `${b.nome} ${b.produto} ${b.responsavel || ''}`.toLowerCase().includes(A.q.toLowerCase())));

  // Faixa de pista: o que está correndo AGORA em destaque e a fila das próximas baterias (só quando hoje está na tela)
  const faixaPista = () => {
    const hoje = hojeIso();
    const doDia = bats.filter((b) => b.dataHora.startsWith(hoje) && b.status !== 'cancelada');
    if (!doDia.length || (A.vista === 'dia' && A.base !== hoje)) return '';
    const noAr = doDia.find((b) => situacaoBateria(b) === 'prevista');
    const fila = doDia.filter((b) => b.status === 'aberta' && situacaoBateria(b) === 'futura' && !b.reservaFechada && tipoDe(b) !== 'bloq').slice(0, 4);
    if (!noAr && !fila.length) return '';
    const fim = (b) => fmtHm(hm(horaDe(b.dataHora)) + 35);
    const atual = noAr ? `<button class="pistaAgora hov" data-sel="${noAr.id}" aria-label="Bateria no horário previsto, ${horaDe(noAr.dataHora)}: ${esc(tituloBat(noAr, tipoDe(noAr)))}"><span class="pistaHora mono">${horaDe(noAr.dataHora)}</span><span class="col gap-meio cresce" style="min-width: 0"><b class="trunc t-subtitulo">${esc(tituloBat(noAr, tipoDe(noAr)) === 'Livre' ? 'Bateria sem reserva' : tituloBat(noAr, tipoDe(noAr)))}</b><span class="t-pequeno">previsão até ${fim(noAr)} · ${plural(+noAr.inscritos || 0, 'piloto', 'pilotos')}${falta(noAr) ? ' · ' + pagLongo(noAr) : ''}</span></span></button>`
      : `<span class="pistaAgora vazia"><span class="pistaHora mono">——</span><span class="col gap-meio"><b class="t-subtitulo">Nenhum horário previsto agora</b><span class="t-pequeno">Confira a corrida real na Cronometragem</span></span></span>`;
    const proximas = fila.length ? `<span class="pistaFila" role="list" aria-label="Próximas baterias">${fila.map((b) => `<button class="pistaProx hov" role="listitem" data-sel="${b.id}"><b class="mono">${horaDe(b.dataHora)}</b><span class="t-pequeno">${(+b.inscritos || 0) ? esc(tituloBat(b, tipoDe(b), true)) : livresTxt(b)}</span></button>`).join('')}</span>` : '';
    return `<div class="faixaPista" role="region" aria-label="Horários previstos">${atual}${proximas}</div>`;
  };
  const estaFechada = (b) => (b.status === 'fechada' || !!b.reservaFechada) && situacaoBateria(b) !== 'fim' && b.status !== 'cancelada';
  const blocoSemana = (b) => {
    const tp = tipoDe(b), T = TIPOS[tp], st = situacaoBateria(b), n = +b.inscritos || 0, vagas = Math.max(1, +b.vagas || 0);
    const cls = ['bloco2', tp === 'livre' ? 'livre' : tp === 'bloq' ? 'bloq' : '', st === 'fim' ? 'passou' : '', st === 'prevista' ? 'pista' : '', A.sel === b.id ? 'sel' : '', estaFechada(b) ? 'agFechada' : ''].filter(Boolean).join(' ');
    const estilo = tp === 'livre' || tp === 'bloq' ? '' : `${T.fundo}; --faixa: ${T.cor}`;
    const titulo = tituloBat(b, tp, true), dir = livresTxt(b, st, tp);
    const devendo = st !== 'fim' && falta(b) && tp !== 'livre', aPagar = devendo && (urgente(b) || A.sel === b.id) ? `<span class="aPagarB">${pagCurto(b)}</span>` : '';
    const dica = [T.t, titulo, dir, devendo ? pagLongo(b) : ''].filter(Boolean).join(' · ');
    const chipTipo = ['camp', 'evento'].includes(tp) ? `<span class="tipoB">${T.curto}</span>` : ''; // fechada/bloqueada já dizem o estado em texto
    return `<button class="${cls}" data-sel="${b.id}" title="${esc(dica)}" style="${estilo}" aria-label="${esc(`${horaDe(b.dataHora)}, ${titulo}, ${T.t}, ${dir}`)}">
      <span class="linha1"><span class="mono hora">${horaDe(b.dataHora)}</span>${st === 'prevista' ? `<span class="naPista" title="Bateria prevista para agora${dir ? ' · ' + esc(dir) : ''}">PREVISTA AGORA</span>` : `<span class="dirB">${dir}</span>`}</span>
      ${tp === 'livre' ? '' : `<span class="tituloB trunc">${chipTipo}${esc(titulo)}</span>${aPagar}<span class="barraB" style="width: ${Math.round(Math.min(1, n / vagas) * 100)}%; background: ${T.cheio}"></span>`}</button>`;
  };

  const pintar = () => {
    const ini = semanaIni(), fimSem = somaDias(ini, 6), di = deIso(ini), df = deIso(fimSem);
    const lf = somaDias(A.base, 6), dl = deIso(A.base), dlf = deIso(lf);
    $('#periodo').textContent = A.vista === 'semana' ? `${di.getDate()}${di.getMonth() !== df.getMonth() ? ' de ' + MESES[di.getMonth()] : ''} – ${df.getDate()} de ${MESES[df.getMonth()]}`
      : A.vista === 'dia' ? `${DIAS[deIso(A.base).getDay()]}, ${deIso(A.base).getDate()} de ${MESES[deIso(A.base).getMonth()]}`
        : A.base === hojeIso() ? 'próximos 7 dias' : `${dl.getDate()}/${pad(dl.getMonth() + 1)} a ${dlf.getDate()}/${pad(dlf.getMonth() + 1)}`;
    tela.querySelectorAll('[data-vista]').forEach((x) => { x.classList.toggle('sel', x.dataset.vista === A.vista); x.setAttribute('aria-selected', x.dataset.vista === A.vista); });
    const conta = {}; bats.forEach((b) => { const t = tipoDe(b); conta[t] = (conta[t] || 0) + 1; });
    const nOcultos = ORDEM_TIPOS.filter((t) => A.ocultos[t]).length;
    const fHtml = `<details class="filtroDet" ${A.filtroAberto || A.q || nOcultos ? 'open' : ''}><summary><span class="peso-semibold">Filtrar</span><span class="peq cor-apoio">${nOcultos ? `${nOcultos} tipo${nOcultos > 1 ? 's' : ''} oculto${nOcultos > 1 ? 's' : ''}` : A.q ? 'com busca' : 'tudo visível'}</span></summary>${ORDEM_TIPOS.map((t) => { const on = !A.ocultos[t]; return `<button class="hov filtroTipo" data-tipo="${t}" role="switch" aria-checked="${on}"><span class="amostra" style="${amostra(t, on)}">${on ? svg(IC.ok, 10, t === 'livre' || t === 'bloq' ? 'var(--kib-cor-texto-corpo)' : 'var(--kib-cor-acao-sobre-principal)', 3.6) : ''}</span><span style="flex-grow: 1; ${on ? '' : 'color: var(--mudo2)'}">${TIPOS[t].t}</span><span class="peq">${conta[t] || 0}</span></button>`; }).join('')}
      <label class="buscaCampo" style="margin: var(--kib-espaco-meio) var(--kib-espaco-meio) var(--kib-espaco-meio)">${svg(IC.busca, 13, 'var(--kib-cor-borda-campo)')}<input id="qAg" type="search" value="${esc(A.q)}" placeholder="Responsável, KAC, Legends…" aria-label="Filtrar a agenda pelo nome">${A.q ? `<button type="button" class="btn sec peq icone" data-limpar-q aria-label="Limpar filtro" title="Limpar filtro">×</button>` : ''}</label></details>`;
    const ftEl = $('#filtrosTipo');
    if (ftEl && ftEl.innerHTML !== fHtml) ftEl.innerHTML = fHtml;
    const cal = $('#calendario');
    if (!cal) return;
    const hoje = hojeIso(), agora = agoraMin();
    let novoHtml = '';
    if (A.vista === 'semana') {
      const dias = Array.from({ length: 7 }, (_, k) => somaDias(ini, k));
      const cab = dias.map((dia) => {
        const d = deIso(dia), doDia = bats.filter((b) => b.dataHora.startsWith(dia)), vagas = doDia.reduce((a, b) => a + (+b.vagas || 0), 0), ins = doDia.reduce((a, b) => a + (+b.inscritos || 0), 0), oc = vagas ? ins / vagas : 0;
        return `<button class="hov cabDia ${dia === hoje ? 'hoje' : ''} ${dia < hoje ? 'passado' : ''}" data-dia="${dia}" title="Abrir o dia"><span class="nomeDia">${DIAS[d.getDay()].slice(0, 3)}</span><span class="numDia">${d.getDate()}</span>${doDia.length ? `<span class="ocDia" role="img" aria-label="${Math.round(oc * 100)}% ocupado"><span style="width: ${Math.round(oc * 100)}%; background: ${oc > .8 ? 'var(--kib-cor-estado-perigo-solido)' : oc > .5 ? 'var(--kib-cor-agenda-reserva-cheio)' : 'var(--kib-cor-marca-principal)'}"></span></span><span class="resumoDia">${vagas - ins} livres · ${ins} pilotos</span>` : `<span class="resumoDia">fechado</span>`}</button>`;
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
        if (escondidas) html += `<span class="peq" style="padding: var(--kib-espaco-meio) var(--kib-espaco-meio)">+${escondidas} escondida${escondidas > 1 ? 's' : ''} pelo filtro</span>`;
        return `<div class="colDia2 ${dia === hoje ? 'hoje' : ''}">${html}</div>`;
      }).join('');
      const colunasCss = dias.map((dia) => (bats.some((b) => b.dataHora.startsWith(dia)) ? 'minmax(0, 1fr)' : 'minmax(0, .45fr)')).join(' ');
      novoHtml = `${faixaPista()}<div class="rolagemX"><div class="semana2"><div class="linhaSemana cabSemana" style="grid-template-columns: ${colunasCss}">${cab}</div><div class="linhaSemana" style="grid-template-columns: ${colunasCss}">${colunas}</div></div></div>
        <div class="legendaAg">${ORDEM_TIPOS.map((t) => `<span><span class="amostra" style="${amostra(t, true)}"></span>${TIPOS[t].t}</span>`).join('')}<span><span class="amostra" style="box-shadow: inset 0 0 0 2px var(--kib-cor-estado-perigo-solido)"></span>Horário previsto agora</span><span class="atalhos">Atalhos: <kbd>N</kbd> nova reserva · <kbd>T</kbd> hoje · <kbd>←</kbd><kbd>→</kbd> semana · <kbd>D</kbd><kbd>S</kbd><kbd>L</kbd> vista · <kbd>Esc</kbd> fecha</span></div>`;
    } else if (A.vista === 'dia') {
      const todos = bats.filter((b) => b.dataHora.startsWith(A.base)), doDia = filtrar(todos);
      const d = deIso(A.base), ins = todos.reduce((a, b) => a + (+b.inscritos || 0), 0);
      novoHtml = `${faixaPista()}<div class="cartaoCab"><h2 class="t-titulo-grande">${A.base === hoje ? 'Hoje, ' : ''}${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}</h2><span class="sub">${todos.length ? `${todos.length} baterias de 35 min · ${ins} pilotos` : ''}</span></div>
        ${doDia.length ? doDia.map((b) => {
          const tp = tipoDe(b), T = TIPOS[tp], st = situacaoBateria(b), n = +b.inscritos || 0, vagas = Math.min(20, +b.vagas || 0), f = falta(b);
          const extra = [generico(b.nome) || tituloBat(b, tp) === b.nome ? '' : b.nome, b.produto, b.observacao].filter(Boolean).map(esc).join(' · ');
          return `<button class="hov linhaDia ${A.sel === b.id ? 'sel' : ''} ${st === 'fim' ? 'passou' : ''} ${estaFechada(b) ? 'agFechada' : ''}" data-sel="${b.id}"><span class="col" style="width: 58px"><span class="mono" style="font-size: var(--kib-fonte-tamanho-subtitulo); font-weight: 600">${horaDe(b.dataHora)}</span><span class="mono peq">${fmtHm(hm(horaDe(b.dataHora)) + 35)}</span></span><span class="faixaDia" style="${tp === 'livre' ? 'background: var(--kib-cor-superficie-padrao); box-shadow: inset 0 0 0 1.5px var(--kib-cor-icone-suave)' : tp === 'bloq' ? TIPOS.bloq.fundo : 'background: ' + T.cor}"></span><span class="col" style="flex: 1 1 220px; gap: var(--kib-espaco-meio)"><span style="display: flex; align-items: center; gap: var(--kib-espaco-1); flex-wrap: wrap"><b class="trunc" style="font-size: var(--kib-fonte-tamanho-corpo); ${tp === 'livre' ? 'color: var(--mudo); font-weight: 600' : ''}">${esc(tituloBat(b, tp))}</b>${tp === 'livre' ? '' : `<span class="chip" style="${T.fundo}">${T.curto}</span>`}${st === 'prevista' ? '<span class="chip solido-perigo sem-sinal">no horário previsto</span>' : ''}${st !== 'fim' && f ? `<span class="chip ${urgente(b) ? 'laranja' : 'cinza'}">${pagCurto(b)}</span>` : ''}</span>${extra ? `<span class="peq">${extra}</span>` : ''}</span><span class="vagasDia" role="img" aria-label="${n} de ${+b.vagas || 0} vagas ocupadas">${Array.from({ length: vagas }, (_, k) => `<span style="background: ${k < n ? (tp === 'livre' ? 'var(--kib-cor-borda-campo)' : T.cheio) : 'color-mix(in srgb, var(--kib-cor-texto-discreto) 14%, transparent)'}"></span>`).join('')}</span><span class="livresDia" style="color: ${st === 'fim' || tp === 'bloq' ? 'var(--mudo)' : tp === 'fechada' ? 'var(--erroTxt)' : +b.disponiveis ? 'var(--okTxt)' : 'var(--erroTxt)'}">${livresTxt(b, st, tp)}</span></button>`;
        }).join('') : todos.length ? '<div class="vazio"><b>Nada com esse filtro</b><span>Ligue os tipos em “Mostrar” ou limpe a busca.</span></div>' : `<div class="vazio"><b>Sem baterias neste dia</b><span>${d.getDay() === 1 ? 'Segunda o kartódromo não abre.' : 'Sem bateria, ninguém reserva este dia no site, no totem nem na Recepção.'}</span>${d.getDay() !== 1 && podeTela('agenda', 'alterar') ? '<span class="acoesVazio"><button type="button" class="btn prim peq" data-ag-nova-bat>Criar bateria neste dia</button><button type="button" class="btn sec peq" data-ag-gerar>Gerar baterias do mês…</button></span>' : ''}</div>`}`;
    } else {
      const comPiloto = filtrar(bats).filter((b) => +b.inscritos > 0);
      const dias = [...new Set(comPiloto.map((b) => b.dataHora.slice(0, 10)))];
      const grade = '58px minmax(0, 1.4fr) minmax(0, .9fr) minmax(0, 1fr) 140px';
      novoHtml = `<div class="cartaoCab"><h2>Reservas ${A.base === hoje ? 'dos próximos 7 dias' : `de ${dl.getDate()}/${pad(dl.getMonth() + 1)} a ${dlf.getDate()}/${pad(dlf.getMonth() + 1)}`}</h2><span class="sub">só as baterias que já têm pilotos</span></div>
        ${dias.length ? `<div class="rolagemX"><div style="min-width: 680px"><div class="cabTabela" style="grid-template-columns: ${grade}"><span>Hora</span><span>Quem</span><span>Pilotos</span><span>Pagamento</span><span class="t-dir">Faltam</span></div>${dias.map((dia) => { const d = deIso(dia); const lista = comPiloto.filter((b) => b.dataHora.startsWith(dia)); return `<div class="diaLista"><b>${dia === hoje ? 'Hoje · ' : ''}${DIAS[d.getDay()]}, ${d.getDate()}/${pad(d.getMonth() + 1)}</b><span class="peq">${plural(lista.length, 'bateria', 'baterias')} · ${plural(lista.reduce((a, b) => a + +b.inscritos, 0), 'piloto', 'pilotos')}</span></div>${lista.map((b) => { const tp = tipoDe(b), pago = +b.pagos, n = +b.inscritos, st = situacaoBateria(b), f = falta(b); return `<button class="linhaTabela hov ${A.sel === b.id ? 'sel' : ''} ${st === 'fim' ? 'passou' : ''} ${estaFechada(b) ? 'agFechada' : ''}" data-sel="${b.id}" style="grid-template-columns: ${grade}"><span class="mono peso-semibold">${horaDe(b.dataHora)}</span><span class="col"><b class="trunc">${esc(tituloBat(b, tp))}</b><span class="peq trunc">${generico(b.nome) || b.nome === tituloBat(b, tp) ? '' : esc(b.nome) + ' · '}${TIPOS[tp].t}</span></span><span class="peq cor-corpo">${n} piloto${n > 1 ? 's' : ''} · ${livresTxt(b, st, tp).toLowerCase()}</span><span class="col gap-meio"><span class="peq">${pago} de ${n} pagos</span><span class="barra" style="height: 5px"><span style="width: ${n ? Math.round(pago / n * 100) : 0}%; background: ${pago < n ? 'var(--kib-cor-estado-aviso-solido)' : 'var(--kib-cor-status-ok)'}"></span></span></span><span style="justify-self: end" class="chip ${!f ? 'verde' : urgente(b) ? 'laranja' : 'cinza'}">${!f ? 'tudo pago' : +b.preco ? brlCurto(faltaValor(b)) : f + ' a pagar'}</span></button>`; }).join('')}`; }).join('')}</div></div>` : `<div class="vazio"><b>Nenhuma reserva nesses 7 dias</b><span>Use “Nova reserva” para marcar um grupo.</span></div>`}`;
    }
    if (cal.innerHTML !== novoHtml) {
      const rx = cal.querySelector('.rolagemX');
      const sLeft = rx ? rx.scrollLeft : 0;
      cal.innerHTML = novoHtml;
      const novoRx = cal.querySelector('.rolagemX');
      if (novoRx && sLeft) novoRx.scrollLeft = sLeft;
    }
    pintarAPagar();
  };

  const pintarMini = async () => {
    const pedido = consulta;
    const base = deIso(A.base), mes = `${base.getFullYear()}-${pad(base.getMonth() + 1)}`;
    let resumo = [];
    try { resumo = await office(`/agenda?mes=${mes}`); } catch { /* sem resumo: o calendário funciona sem as bolinhas */ }
    if (pedido !== consulta || !tela.isConnected) return;
    const porDia = Object.fromEntries(resumo.map((r) => [r.dia, r]));
    const m0 = new Date(base.getFullYear(), base.getMonth(), 1), ult = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const ini = A.vista === 'lista' ? A.base : semanaIni(), fim = somaDias(ini, 6), hoje = hojeIso();
    let cel = [['S', 1], ['T', 2], ['Q', 3], ['Q', 4], ['S', 5], ['S', 6], ['D', 0]].map(([c, i]) => `<span class="letraDia" aria-hidden="true" title="${DIAS[i]}">${c}</span>`).join('');
    cel += '<span></span>'.repeat((m0.getDay() + 6) % 7);
    for (let dn = 1; dn <= ult; dn++) {
      const dia = `${mes}-${pad(dn)}`, r = porDia[dia], oc = r && r.vagas ? r.reservas / r.vagas : 0;
      const estilo = dia === hoje ? 'background: var(--verde); color: var(--kib-cor-acao-sobre-principal); font-weight: 700' : dia === A.base && A.vista === 'dia' ? 'background: var(--tinta); color: var(--kib-cor-acao-sobre-principal); font-weight: 700' : dia >= ini && dia <= fim && A.vista !== 'dia' ? 'background: color-mix(in srgb, var(--kib-cor-marca-principal) 10%, transparent); color: var(--verdeEsc); font-weight: 600' : r ? '' : 'color: var(--mudo2)';
      cel += `<button class="hov" data-dia="${dia}" style="${estilo}" aria-label="${dn} de ${MESES[base.getMonth()]}${r ? `, ${r.reservas} de ${r.vagas} vagas ocupadas` : ', sem baterias'}"><span>${dn}</span><span class="ponto" style="width: 4px; height: 4px; background: ${!r ? 'transparent' : oc > .8 ? 'var(--kib-cor-estado-perigo-solido)' : oc > .5 ? 'var(--kib-cor-agenda-reserva-cheio)' : oc > 0 ? 'var(--kib-cor-marca-principal)' : 'var(--kib-cor-borda-forte)'}"></span></button>`;
    }
    const mcHtml = `<div style="display: flex; align-items: center; padding: 2px var(--kib-espaco-meio) var(--kib-espaco-1)"><b style="font-size: var(--kib-fonte-tamanho-corpo); text-transform: capitalize">${MESES[base.getMonth()]} ${base.getFullYear()}</b><span style="margin-left: auto; display: flex; gap: 2px"><button class="btn sec peq icone peq mudo" data-mes="-1" aria-label="Mês anterior">${svg(IC.esq, 13)}</button><button class="btn sec peq icone peq mudo" data-mes="1" aria-label="Próximo mês">${svg(IC.dir, 13)}</button></span></div><div class="miniCal">${cel}</div>
      <div class="legendaMini"><span><span class="ponto" style="width: 6px; height: 6px; background: var(--kib-cor-marca-principal)"></span>vagas</span><span><span class="ponto" style="width: 6px; height: 6px; background: var(--kib-cor-agenda-reserva-cheio)"></span>metade</span><span><span class="ponto" style="width: 6px; height: 6px; background: var(--kib-cor-estado-perigo-solido)"></span>quase cheio</span></div>`;
    const mcEl = $('#miniCal');
    if (mcEl && mcEl.innerHTML !== mcHtml) mcEl.innerHTML = mcHtml;
  };

  const pintarAPagar = () => {
    const futuras = bats.filter((b) => situacaoBateria(b) !== 'fim' && falta(b) > 0).sort((a, b) => (urgente(b) - urgente(a)) || a.dataHora.localeCompare(b.dataHora) || (a.id - b.id));
    const total = futuras.reduce((a, b) => a + faltaValor(b), 0), urg = futuras.filter(urgente);
    const novoHtml = `<div class="cabLado"><span class="col"><b class="t-corpo">A receber</b><span class="peq">${A.vista === 'lista' ? 'nestes 7 dias' : 'nesta semana'}${futuras.length ? ` · ${futuras.length} reserva${futuras.length > 1 ? 's' : ''}` : ''}</span></span>${futuras.length ? `<b class="num" style="margin-left: auto; font-size: var(--kib-fonte-tamanho-subtitulo)">${brlCurto(total)}</b>` : ''}</div>
      ${urg.length ? `<p class="avisoHoje">${urg.length} ${urg.length > 1 ? 'reservas começam' : 'reserva começa'} nas próximas 3 horas sem pagar tudo</p>` : ''}
      ${futuras.slice(0, 6).map((b) => { const d = deIso(b.dataHora), u = urgente(b); return `<button class="hov linhaLado" data-sel="${b.id}" data-base="${b.dataHora.slice(0, 10)}"><span class="quando ${u ? 'urgente' : ''}"><span>${b.dataHora.slice(0, 10) === hojeIso() ? 'hoje' : DIAS[d.getDay()].slice(0, 3) + ' ' + d.getDate()}</span><b class="mono">${horaDe(b.dataHora)}</b></span><span class="col cresce"><b class="trunc">${esc(tituloBat(b))}</b><span class="peq">${tipoDe(b) !== 'livre' ? `<span class="tipoB">${TIPOS[tipoDe(b)].curto}</span> ` : ''}${falta(b)} de ${+b.inscritos || 0} sem pagar</span></span><b style="font-size: var(--kib-fonte-tamanho-corpo); white-space: nowrap; color: ${u ? 'var(--avisoTxt)' : 'var(--tinta2)'}">${+b.preco ? brlCurto(faltaValor(b)) : ''}</b></button>`; }).join('') || '<p class="peq" style="margin: 0; padding: var(--kib-espaco-denso-12) var(--kib-espaco-denso-12); color: var(--okTxt); border-top: 1px solid var(--linha)">Tudo pago.</p>'}
      ${futuras.length > 6 ? `<button class="btn sec peq" data-vista-lista="1" style="margin: var(--kib-espaco-1) var(--kib-espaco-denso-12) var(--kib-espaco-denso-12)">Ver as ${futuras.length} na lista</button>` : ''}`;
    const apEl = $('#aPagar');
    if (apEl && apEl.innerHTML !== novoHtml) apEl.innerHTML = novoHtml;
  };

  const abrirBateria = async (id, opcoes = {}) => {
    const pedido = ++detalhe;
    A.sel = id;
    const b = bats.find((x) => x.id === id);
    if (!b) { fecharCamada(); return; }
    const tp = tipoDe(b), T = TIPOS[tp], st = situacaoBateria(b), d = deIso(b.dataHora);
    const titulo = tituloBat(b, tp);

    const gAtual = document.querySelector('#camada .gaveta');
    const jaAberta = gAtual && +gAtual.dataset.bateria === id && gAtual.isConnected;
    let g;
    let scrollSalvo = 0;
    let selecionados = new Set();
    let pendTexto = '';
    let pendTemFoco = false;

    if (jaAberta) {
      g = gAtual;
      const corpo = g.querySelector('#corpoBateria');
      scrollSalvo = corpo ? corpo.scrollTop : 0;
      selecionados = new Set([...g.querySelectorAll('[data-ag-sel]:checked')].map((el) => el.dataset.agSel));
      const pendInput = g.querySelector('[data-ag-pend-q]');
      pendTexto = pendInput ? pendInput.value : '';
      pendTemFoco = document.activeElement === pendInput;
    } else {
      g = gaveta(`<div class="gavetaTopo" style="${T.topo}"><button class="fechar hov" data-acao="fecharGaveta" aria-label="Fechar (Esc)">${svg(IC.fechar, 14, 'var(--kib-cor-texto-principal)', 2.4)}</button>
        <span style="display: flex; align-items: center; gap: var(--kib-espaco-meio); font-size: var(--kib-fonte-tamanho-pequeno); font-weight: 700; letter-spacing: .05em; text-transform: uppercase"><span class="amostra" style="${amostra(tp, true)}"></span>${T.t}</span>
        <span style="padding-right: var(--kib-espaco-5); font-size: var(--kib-fonte-tamanho-titulo-grande); font-weight: 700; letter-spacing: -0.015em">${esc(titulo === 'Livre' ? 'Horário livre' : titulo)}</span>
        <span style="font-size: var(--kib-fonte-tamanho-corpo); opacity: .85">${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} · ${horaDe(b.dataHora)} às ${fmtHm(hm(horaDe(b.dataHora)) + 35)}${st === 'prevista' ? ' · no horário previsto' : st === 'fim' ? ' · horário encerrado' : ''}</span>
        <span style="font-size: var(--kib-fonte-tamanho-pequeno); opacity: .8">${[b.nome, b.produto, tracadoTxt(b.tracado), kartTxt(b.tipoKart)].filter(Boolean).map(esc).join(' · ')}</span></div>
        <div class="gavetaCorpo" id="corpoBateria"><div class="esqueleto" style="height: 120px"></div><div class="esqueleto" style="height: 200px"></div></div>
        <div style="display: flex; gap: var(--kib-espaco-1); padding: var(--kib-espaco-denso-12) var(--kib-espaco-2); background: var(--kib-cor-superficie-padrao); border-top: 1px solid var(--linha2)">${st !== 'fim' && +b.disponiveis > 0 && tp !== 'bloq' && !b.reservaFechada && b.status === 'aberta' ? `<button class="btn prim cresce" data-acao="novaReserva">${svg(IC.mais, 14, 'var(--kib-cor-acao-sobre-principal)', 2.6)}Nova reserva · ${b.disponiveis} ${+b.disponiveis === 1 ? 'vaga' : 'vagas'}</button>` : `<a class="btn sec cresce" href="#/recepcao">Abrir na Recepção</a>`}</div>`, `Bateria das ${horaDe(b.dataHora)}: ${titulo}`);
      g.dataset.bateria = id;
    }

    let reservas = [];
    try { reservas = await office(`/reservas?bateriaId=${id}&status=todas`); } catch (e) {
      if (pedido !== detalhe || !g.isConnected) return;
      if (!jaAberta) g.querySelector('#corpoBateria').innerHTML = `<div class="vazio"><b>Não deu para carregar as reservas</b><span>${esc(e.message)}</span><button class="btn sec peq" style="margin-top: var(--kib-espaco-1)" data-reabrir="${id}">Tentar de novo</button></div>`;
      return;
    }
    if (A.sel !== id || pedido !== detalhe || !g.isConnected) return;
    reservas = reservas.filter((r) => r.status !== 'cancelada');
    reservas.sort((a, b) => a.id - b.id);
    let gruposReserva = [];
    try { gruposReserva = await office(`/grupos?bateriaId=${id}`); } catch (e) {
      if (pedido !== detalhe || !g.isConnected) return;
      if (!jaAberta) g.querySelector('#corpoBateria').innerHTML = `<div class="vazio" role="alert"><b>Não foi possível conferir os grupos</b><span>${esc(e.message)}</span><button class="btn sec" data-reabrir="${id}">Tentar novamente</button></div>`;
      return;
    }
    if (A.sel !== id || pedido !== detalhe || !g.isConnected) return;
    gruposReserva.sort((a, b) => a.id - b.id);

    const novaAssinatura = JSON.stringify({
      id,
      disp: b.disponiveis,
      vagas: b.vagas,
      st,
      tp,
      res: reservas.map((r) => [r.id, r.status, r.pago, r.total, r.cliente, r.documento, r.telefone, r.aprovada, r.peso, r.idade]),
      grp: gruposReserva.map((gr) => [gr.id, gr.responsavel, gr.pagoValor, gr.total, (gr.pilotos || []).map((p) => [p.inscricaoId, p.nome, p.pago, p.documento])])
    });

    if (jaAberta && g._assinatura === novaAssinatura) {
      const corpo = g.querySelector('#corpoBateria');
      if (corpo && scrollSalvo && Math.abs(corpo.scrollTop - scrollSalvo) > 5) corpo.scrollTop = scrollSalvo;
      return;
    }
    g._assinatura = novaAssinatura;

    const doGrupo = new Map();
    gruposReserva.forEach((gr, gi) => gr.pilotos.forEach((p) => doGrupo.set(p.inscricaoId, { cor: CORG[gi % 6], nome: p.nome })));
    const avulsas = reservas.filter((r) => !doGrupo.has(r.id));
    const grupos = new Map();
    avulsas.forEach((r) => { const k = r.responsavel || r.cliente; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(r); });
    const cores = new Map([...grupos.keys()].map((k, i) => [k, CORG[(i + gruposReserva.length) % 6]]));
    const ordenadas = reservas.slice().sort((x, y) => (doGrupo.has(y.id) ? 1 : 0) - (doGrupo.has(x.id) ? 1 : 0));
    const assentos = Array.from({ length: Math.max(1, +b.vagas || 12) }, (_, i) => { const r = ordenadas[i]; const dg = r && doGrupo.get(r.id); const nomeA = dg ? (dg.nome || r.cliente) : r && r.cliente; return r ? `<span class="vaga ocupada" style="background: ${dg ? dg.cor : cores.get(r.responsavel || r.cliente)}" title="${esc(nomeA)}">${esc(iniciais(nomeA))}</span>` : `<span class="vaga" title="Vaga ${i + 1} livre">${i + 1}</span>`; }).join('');
    const tipoAtual = b.reservaFechada ? 'fechada' : (b.autoAtendimento === false || b.autoAtendimento === 0) ? 'bloqueada' : 'aberta';
    const tipoHtml = st === 'fim' ? '' : `<section class="secao"><span class="titulo">Quem pode reservar este horário${dica("Escolha quem pode ocupar este horário: qualquer pessoa (site, totem e Recepção), só o grupo que já reservou, ou só a Recepção.", "quem pode reservar este horário")}</span><span class="tiposBat">${[['aberta', 'Vagas abertas', 'livre', 'site, totem e Recepção'], ['fechada', 'Bateria fechada', 'fechada', 'só o grupo, sai do site'], ['bloqueada', 'Bloqueada', 'bloq', 'só a Recepção vende']].map(([v, t, tq, dd]) => `<button class="hov" data-tipo-bat="${v}" aria-pressed="${tipoAtual === v}" style="${tipoAtual === v ? (tq === 'livre' ? 'background: var(--kib-cor-superficie-padrao)' : TIPOS[tq].fundo) + '; box-shadow: inset 0 0 0 2px ' + (tq === 'livre' ? 'var(--kib-cor-texto-apoio)' : TIPOS[tq].cor) : 'background: var(--fundo); color: var(--tinta2)'}"><span style="display: flex; align-items: center; gap: var(--kib-espaco-meio); font-size: var(--kib-fonte-tamanho-pequeno); font-weight: 700"><span class="amostra" style="width: 10px; height: 10px; ${amostra(tq, true)}"></span>${t}</span><span style="font-size: var(--kib-fonte-tamanho-pequeno); opacity: .8">${dd}</span></button>`).join('')}</span></section>`;
    const prontoTotem = (r) => !!(r.documento && r.email && r.peso && r.telefone);
    const cartoes = [...grupos.entries()].map(([resp, lista]) => {
      const pagos = lista.filter((r) => r.pago).length, prontos = lista.filter(prontoTotem).length, total = lista.reduce((a, r) => a + (+r.total || 0), 0), pagoValor = lista.filter((r) => r.pago).reduce((a, r) => a + (+r.total || 0), 0);
      const tel = lista[0].telefone, cor = cores.get(resp);
      const msgCad = `Olá! Sua bateria no Kartódromo de Betim é ${DIAS[d.getDay()]} ${d.getDate()}/${pad(d.getMonth() + 1)} às ${horaDe(b.dataHora)}. Para agilizar, cada piloto faz o pré-cadastro aqui: ${LINK_CADASTRO} — no totem é só digitar o CPF.`;
      const msgPag = `Olá! Faltam ${lista.length - pagos} piloto(s) a pagar da bateria de ${d.getDate()}/${pad(d.getMonth() + 1)} às ${horaDe(b.dataHora)} (${brl(total - pagoValor)}). O pagamento pode ser feito na recepção.`;
      return `<div class="cartaoGrupo">
        <span class="linha gap-1"><span class="avatar m" style="background: ${cor}">${esc(iniciais(resp))}</span><span class="col cresce"><b>${esc(resp)}</b><span class="peq">${lista.length} piloto${lista.length > 1 ? 's' : ''} · ${esc(lista[0].origem || 'Recepção')}${tel ? ' · ' + esc(tel) : ''}</span></span></span>
        <span style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--kib-espaco-1)">
          <span class="col gap-meio"><span style="display: flex; flex-wrap: wrap; gap: 2px var(--kib-espaco-1); font-size: var(--kib-fonte-tamanho-pequeno)"><span class="peq" title="CPF, e-mail, peso e telefone preenchidos">Prontos para o totem</span><b class="empurra">${prontos} de ${lista.length}</b></span><span class="barra" style="height: 5px"><span style="width: ${Math.round(prontos / lista.length * 100)}%; background: ${prontos === lista.length ? 'var(--kib-cor-status-ok)' : 'var(--kib-cor-estado-aviso-solido)'}"></span></span></span>
          <span class="col gap-meio"><span style="display: flex; flex-wrap: wrap; gap: 2px var(--kib-espaco-1); font-size: var(--kib-fonte-tamanho-pequeno)"><span class="peq">Pago</span><b class="empurra">${brlCurto(pagoValor)} de ${brlCurto(total)}</b></span><span class="barra" style="height: 5px"><span style="width: ${total ? Math.round(pagoValor / total * 100) : 0}%; background: ${pagos === lista.length ? 'var(--kib-cor-status-ok)' : 'var(--kib-cor-estado-aviso-solido)'}"></span></span></span>
        </span>
        <div class="listaPilotos">${lista.map((r) => `<div><span class="avatar p" style="background: ${r.pago && prontoTotem(r) ? 'var(--kib-cor-status-ok)' : cor}" aria-hidden="true">${esc(iniciais(r.cliente))}</span><span class="col cresce"><span class="trunc peso-semibold">${esc(r.cliente)}</span><span class="peq">${esc(r.documento || 'sem CPF')}${r.peso ? ' · ' + r.peso + ' kg' : ' · sem peso'}${r.idade != null ? ' · ' + r.idade + ' anos' : ''}</span></span>${r.aprovada ? '' : `<button class="btn peq aviso" data-aprovar="${r.id}">Aprovar</button>`}<span class="chip ${r.pago ? 'verde' : 'laranja'}">${r.pago ? 'pago' : 'falta ' + brlCurto(r.total)}</span></div>`).join('')}</div>
        <span class="linha-quebra gap-meio">${tel ? `<a class="btn verdeClaro peq" target="_blank" rel="noopener" href="${esc(zap(tel, msgCad))}">Enviar link de cadastro</a>${pagos < lista.length ? `<a class="btn peq" style="background: color-mix(in srgb, var(--kib-cor-estado-info-solido) 12%, transparent); color: var(--azulTxt)" target="_blank" rel="noopener" href="${esc(zap(tel, msgPag))}">Cobrar no WhatsApp</a>` : ''}` : '<span class="peq">Sem telefone do responsável: peça na Recepção.</span>'}</span>
      </div>`;
    }).join('');
    const nGrupos = grupos.size + gruposReserva.length;
    const corpoEl = g.querySelector('#corpoBateria');
    if (corpoEl) {
      corpoEl.innerHTML = `<section class="secao"><span class="titulo">Vagas<span style="margin-left: auto; font-size: var(--kib-fonte-tamanho-pequeno); font-weight: 600; color: ${st === 'fim' ? 'var(--mudo)' : tp === 'fechada' || tp === 'bloq' ? 'var(--tinta2)' : +b.disponiveis ? 'var(--okTxt)' : 'var(--erroTxt)'}">${st === 'fim' ? b.inscritos + ' inscritos' : tp === 'fechada' ? 'fechada: fora do site e do totem' : tp === 'bloq' ? 'bloqueada: só a Recepção vende' : b.disponiveis + ' de ' + b.vagas + ' livres no site e no totem'}</span></span><div class="vagasGrade">${assentos}</div><span class="peq">Cada quadrado é uma vaga. Os karts saem no sorteio do tablet, na hora da bateria.</span></section>
        ${tipoHtml}
        <section class="secao"><span class="titulo">Reservas<span class="peq" style="margin-left: auto; font-weight: 500">${reservas.length ? `${reservas.length} piloto${reservas.length > 1 ? 's' : ''} em ${nGrupos} ${nGrupos > 1 ? 'grupos' : 'grupo'}` : ''}</span></span>${Grupo.cartoes(gruposReserva)}${cartoes ? (gruposReserva.length ? '<span class="peq" style="font-weight: 700; margin-top: var(--kib-espaco-meio)">Outras reservas (Recepção, totem e site)</span>' : '') + cartoes : ''}${!reservas.length ? `<span class="peq">Nenhuma reserva ainda.${st !== 'fim' && +b.disponiveis > 0 && tp !== 'bloq' && !b.reservaFechada && b.status === 'aberta' ? ' Use “Nova reserva” abaixo.' : ''}</span>` : ''}</section>
        ${b.observacao ? `<section class="secao"><span class="titulo">Observação</span><span style="white-space: pre-line; line-height: 1.5">${esc(b.observacao)}</span></section>` : ''}`;
    }
    if (typeof AgendaAcoes !== 'undefined') AgendaAcoes.gaveta({ b, reservas, st, tp });

    if (jaAberta) {
      if (selecionados.size) {
        g.querySelectorAll('[data-ag-sel]').forEach((cb) => {
          if (selecionados.has(cb.dataset.agSel)) cb.checked = true;
        });
        const bt = g.querySelector('[data-ag-mover-sel]');
        if (bt) {
          const k = g.querySelectorAll('[data-ag-sel]:checked').length;
          bt.disabled = !k;
          bt.textContent = k ? `Mover ${k} ${k === 1 ? 'selecionado' : 'selecionados'}` : 'Mover selecionados';
        }
      }
      const novoPend = g.querySelector('[data-ag-pend-q]');
      if (novoPend && pendTexto) {
        novoPend.value = pendTexto;
        if (pendTemFoco) novoPend.focus({ preventScroll: true });
      }
      if (corpoEl && scrollSalvo) {
        corpoEl.scrollTop = scrollSalvo;
        requestAnimationFrame(() => { if (corpoEl) corpoEl.scrollTop = scrollSalvo; });
      }
    }
  };

  /** Nova reserva pelo cabeçalho: escolhe dia, quantos pilotos e o horário; depois abre a reserva do grupo. */
  const escolherHorario = async (anterior = null, rascAnt = null) => {
    const E = { dia: anterior ? anterior.dia : (A.base >= hojeIso() ? A.base : hojeIso()), n: anterior ? anterior.n : 2, lista: [], carregando: true, consulta: 0 };
    const m = modal('<div class="esqueleto" style="height: 360px; margin: var(--kib-espaco-denso-20)"></div>', 'Nova reserva: escolher dia e horário');
    m.style.maxWidth = '640px';
    const desenhar = () => {
      const validas = E.lista.filter((b) => b.status === 'aberta' && situacaoBateria(b) !== 'fim' && tipoDe(b) !== 'bloq' && !b.reservaFechada);
      const dias = Array.from({ length: 14 }, (_, k) => somaDias(E.dia, k));
      m.innerHTML = `<div class="modalTopo" style="${TIPOS.reserva.topo}"><span class="col gap-meio"><span class="t-titulo-grande peso-negrito">Nova reserva: que dia e que horário?</span><span style="font-size: var(--kib-fonte-tamanho-corpo); opacity: .85">Só aparecem os horários com vagas para o grupo inteiro.</span></span><button class="fechar hov solto" data-acao="fechar" aria-label="Fechar (Esc)">${svg(IC.fechar, 15, 'var(--kib-cor-texto-principal)', 2.4)}</button></div>
        <div style="display: flex; flex-direction: column; gap: var(--kib-espaco-denso-12); padding: var(--kib-espaco-2) var(--kib-espaco-2) var(--kib-espaco-2)">
          <label class="campo"><span>Data da reserva</span><input class="entrada" type="date" min="${hojeIso()}" value="${E.dia}" data-escolher-data></label><div class="diasEscolha" role="listbox" aria-label="Dia">${dias.map((dia) => { const d = deIso(dia); return `<button class="hov ${dia === E.dia ? 'sel' : ''}" data-escolher-dia="${dia}" role="option" aria-selected="${dia === E.dia}" ><span>${dia === hojeIso() ? 'hoje' : DIAS[d.getDay()].slice(0, 3)}</span><b>${d.getDate()}</b></button>`; }).join('')}</div>
          <span style="display: flex; align-items: center; gap: var(--kib-espaco-denso-12); flex-wrap: wrap"><b class="t-corpo">Quantos pilotos vão correr?</b><span class="passo"><button type="button" data-escolher-n="-1" aria-label="Um a menos">−</button><span>${E.n}</span><button type="button" data-escolher-n="1" aria-label="Um a mais">+</button></span><span class="peq">dá para mudar depois, na reserva</span></span>
          <div class="horariosEscolha">${E.carregando ? '<div class="esqueleto" style="height: 180px"></div>' : validas.length ? validas.map((b) => { const l = +b.disponiveis || 0, cabe = l >= E.n, tp = tipoDe(b); return `<button class="hov" data-escolher="${b.id}" ${cabe ? '' : 'disabled'}><b class="mono">${horaDe(b.dataHora)}</b><span class="col" style="flex-grow: 1; min-width: 0"><span class="trunc peso-semibold">${esc(tp === 'livre' ? 'Livre' : tituloBat(b, tp))}</span><span class="peq">${esc(b.produto || b.nome)}${situacaoBateria(b) === 'prevista' ? ' · no horário previsto' : ''}</span></span><span style="font-size: var(--kib-fonte-tamanho-pequeno); font-weight: 700; color: ${cabe ? 'var(--okTxt)' : 'var(--erroTxt)'}">${cabe ? `${l} ${l === 1 ? 'livre' : 'livres'}` : `só ${l} ${l === 1 ? 'livre' : 'livres'}`}</span></button>`; }).join('') : '<div class="vazio"><b>Nenhum horário com vaga neste dia</b><span>Escolha outro dia acima.</span></div>'}</div>
        </div>`;
    };
    const buscar = async () => {
      const pedido = ++E.consulta, dia = E.dia;
      E.carregando = true; desenhar();
      try { const lista = await office(`/baterias?status=todas&filtro=entre&data=${dia}&ate=${dia}`); if (pedido !== E.consulta || !m.isConnected) return; E.lista = lista.sort((x, y) => x.dataHora.localeCompare(y.dataHora)); }
      catch (er) { if (pedido !== E.consulta || !m.isConnected) return; E.lista = []; falhou(er); }
      E.carregando = false; desenhar();
    };
    m.onchange = (e) => { if (e.target.matches('[data-escolher-data]') && e.target.value >= hojeIso()) { E.dia = e.target.value; buscar(); } };
    m.onclick = async (e) => {
      const dd = e.target.closest('[data-escolher-dia]'); if (dd) { E.dia = dd.dataset.escolherDia; buscar(); return; }
      const nn = e.target.closest('[data-escolher-n]'); if (nn) { E.n = Math.max(1, Math.min(40, E.n + +nn.dataset.escolherN)); desenhar(); return; }
      const h = e.target.closest('[data-escolher]');
      if (h) {
        const b = E.lista.find((x) => x.id === +h.dataset.escolher); if (!b) return;
        if (situacaoBateria(b) === 'prevista' && !confirm(`A bateria das ${horaDe(b.dataHora)} já atingiu o horário previsto. Reservar nela mesmo assim?`)) return;
        const diaEscolhido = E.dia;
        A.base = diaEscolhido; if (A.vista === 'lista') A.vista = 'semana';
        if (!await carregar() || !m.isConnected || E.dia !== diaEscolhido) return;
        const atual = bats.find((x) => x.id === b.id);
        if (!atual || atual.status !== 'aberta' || atual.reservaFechada || +atual.disponiveis < E.n) { toast('Este horário mudou. Escolha novamente.', true); buscar(); return; }
        A.sel = b.id; pintar();
        Grupo.nova(atual, recarregar, E.n, (rasc) => escolherHorario({ dia: diaEscolhido, n: E.n }, rasc), rascAnt);
      }
    };
    buscar();
  };

  const irPara = (n) => { A.base = n === 0 ? hojeIso() : somaDias(A.base, (A.vista === 'dia' ? 1 : 7) * n); A.sel = null; fecharCamada(); carregar(); };
  const mudarVista = (v) => { if (A.vista === v) return; A.vista = v; if (v === 'lista' && A.base < hojeIso()) A.base = hojeIso(); carregar(); };
  tela.addEventListener('click', async (e) => {
    if (e.target.closest('[data-ag-repetir]')) return carregar();
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
    if (e.target.closest('[data-acao="fecharGaveta"]') || e.target.closest('[data-acao="fechar"]')) { fecharComAviso(() => { A.sel = null; fecharCamada(); pintar(); }); return; }
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
  const ajudaAgenda = () => {
    const m = modal(`<div style="padding: var(--kib-espaco-3)"><b style="font-size: var(--kib-fonte-tamanho-titulo)">Atalhos e legenda</b>
      <p class="peq" style="margin: var(--kib-espaco-1) 0 0">Teclas valem fora de campos de texto.</p>
      <ul style="list-style: none; margin: var(--kib-espaco-2) 0; padding: 0; display: grid; gap: var(--kib-espaco-1)">
        <li><kbd>N</kbd> nova reserva</li><li><kbd>T</kbd> ir para hoje</li><li><kbd>←</kbd> <kbd>→</kbd> semana ou dia anterior e seguinte</li><li><kbd>D</kbd> <kbd>S</kbd> <kbd>L</kbd> vista Dia, Semana ou Lista</li><li><kbd>Esc</kbd> fecha o painel</li><li><kbd>?</kbd> esta ajuda</li></ul>
      <div style="display: flex; flex-wrap: wrap; gap: var(--kib-espaco-1) var(--kib-espaco-2)">${ORDEM_TIPOS.map((t) => `<span style="display: inline-flex; align-items: center; gap: var(--kib-espaco-meio)"><span class="amostra" style="${amostra(t, true)}"></span>${TIPOS[t].t}</span>`).join('')}</div>
      <p class="peq" style="margin: var(--kib-espaco-2) 0 0">“PREVISTA AGORA” marca a bateria cujo horário previsto é agora; a corrida real fica na Cronometragem. O valor “faltam R$” aparece no bloco quando a bateria é em até 3 horas; nas outras, passe o mouse.</p>
      <div class="modalRodape"><button class="btn sec" style="margin-left: auto" data-fechar-ajuda>Fechar</button></div></div>`, 'Atalhos e legenda');
    m.querySelector('[data-fechar-ajuda]').onclick = () => fecharCamada();
  };
  tela.addEventListener('click', (e) => { if (e.target.closest('[data-ajuda-ag]')) ajudaAgenda(); });
  tela.addEventListener('click', (e) => { if (e.target.closest('[data-limpar-q]')) { A.q = ''; pintar(); const i = $('#qAg'); if (i) i.focus(); } });
  // atalhos de teclado (um ouvinte só no documento; vale enquanto esta tela está aberta)
  S.tela.atalho = (e) => {
    if (e.key === 'Escape') { if (A.sel) { A.sel = null; setTimeout(pintar, 0); } return; }
    if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable || $('#camada .modal')) return;
    const k = e.key.toLowerCase();
    if (k === 'n') { e.preventDefault(); escolherHorario(); }
    else if (e.key === '?') ajudaAgenda();
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
  repetir(async () => { if ($('#camada .modal')) { if (typeof Grupo !== 'undefined') await Grupo.refrescar(); } else await recarregar(); }, 30_000);
};

// ---------- Recepção
TELAS.recepcao = async (tela) => {
  const R = S.rec || (S.rec = { data: hojeIso(), filtro: 0, qBat: '', qPil: '' });
  if (S.irBateria) { R.data = hojeIso(); R.bat = S.irBateria; S.irBateria = null; }
  tela.innerHTML = `${cabecalho('Operação · mesmo banco da Recepção (.53 e .239)', 'Recepção', `<div style="display: flex; align-items: center; height: 36px; border-radius: var(--kib-raio-botao); background: var(--kib-cor-superficie-padrao); box-shadow: 0 0 0 1px var(--linha2)"><button class="btn peq icone peq mudo" data-dia="-1" aria-label="Dia anterior">${svg(IC.esq, 15)}</button><span id="diaTxt" style="min-width: 130px; text-align: center; font-weight: 600"></span><button class="btn peq icone peq mudo" data-dia="1" aria-label="Próximo dia">${svg(IC.dir, 15)}</button></div>`)}
  <main class="principal"><div class="linhaFlex">
    <section class="cartao leve" id="listaBats" style="flex: 1 1 270px; min-width: 0"></section>
    <section class="cartao" id="pilotos" style="flex: 999 1 520px; min-width: 0"></section>
    <section class="cartao leve" id="ficha" style="flex: 1 1 290px; min-width: 0"></section>
  </div><section class="cartao leve" id="caixa"></section></main>`;
  let bats = [], reservas = [];
  const carregarDia = async () => {
    const d = deIso(R.data);
    const dt = $('#diaTxt', tela);
    if (dt) dt.textContent = `${R.data === hojeIso() ? 'Hoje' : DIAS[d.getDay()].slice(0, 3)}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
    bats = await office(`/baterias?status=todas&data=${R.data}`);
    if (!tela.isConnected) return;
    if (!bats.find((b) => b.id === R.bat)) R.bat = (bats.find((b) => situacaoBateria(b) === 'prevista') || bats.find((b) => situacaoBateria(b) === 'futura') || bats[0] || {}).id;
    pintarBats();
    await carregarPilotos();
  };
  const pintarBats = () => {
    const lb = $('#listaBats', tela); if (!lb) return;
    const q = R.qBat.toLowerCase();
    const vis = bats.filter((b) => !q || `${horaDe(b.dataHora)} ${b.nome} ${b.produto}`.toLowerCase().includes(q));
    const tot = bats.reduce((a, b) => a + +b.inscritos, 0), vagas = bats.reduce((a, b) => a + +b.vagas, 0);
    lb.innerHTML = `<div style="padding: var(--kib-espaco-denso-12) var(--kib-espaco-denso-12) var(--kib-espaco-1); display: flex; flex-direction: column; gap: var(--kib-espaco-1)"><div style="display: flex; align-items: baseline"><h2 style="margin: 0; font-size: var(--kib-fonte-tamanho-subtitulo)">Baterias</h2><span class="peq empurra">${tot} de ${vagas} vagas</span></div><label class="buscaCampo">${svg(IC.busca, 13, 'var(--kib-cor-borda-campo)')}<input id="qBat" value="${esc(R.qBat)}" placeholder="Hora ou tipo" aria-label="Filtrar baterias"></label></div>
      <div style="display: flex; flex-direction: column; gap: 2px; padding: 0 var(--kib-espaco-meio) var(--kib-espaco-1)">${vis.map((b) => { const st = situacaoBateria(b), sel = b.id === R.bat; return `<button class="hov" data-bat="${b.id}" style="display: flex; flex-direction: column; gap: var(--kib-espaco-meio); padding: var(--kib-espaco-1) var(--kib-espaco-1); border: 0; border-radius: var(--kib-raio-botao); text-align: left; background: ${sel ? 'color-mix(in srgb, var(--kib-cor-marca-principal) 9%, transparent)' : 'var(--kib-cor-acao-sobre-principal)'}; ${sel ? 'box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--kib-cor-marca-principal) 45%, transparent)' : ''}"><span style="display: flex; align-items: center; gap: var(--kib-espaco-1); width: 100%"><span class="mono peso-semibold">${horaDe(b.dataHora)}</span><b class="trunc">${esc(b.nome)}</b><span class="chip ${st === 'fim' ? 'cinza' : st === 'prevista' ? 'verde' : +b.disponiveis ? 'laranja' : 'azul'} empurra">${st === 'fim' ? 'Horário encerrado' : st === 'prevista' ? 'Horário previsto' : +b.disponiveis ? 'Com vagas' : 'Lotada'}</span></span><span style="display: flex; align-items: center; gap: var(--kib-espaco-1); width: 100%"><span class="barra" style="flex-grow: 1; height: 5px"><span style="width: ${Math.round(+b.inscritos / Math.max(1, +b.vagas) * 100)}%; background: ${st === 'prevista' ? 'var(--kib-cor-status-ok)' : 'var(--kib-cor-marca-principal)'}"></span></span><span class="peq num">${b.inscritos}/${b.vagas}${+b.preReservas ? ' · ' + b.preReservas + ' a aprovar' : ''}</span></span></button>`; }).join('') || '<p class="vazio">Nenhuma bateria.</p>'}</div>`;
  };
  const carregarPilotos = async () => {
    const b = bats.find((x) => x.id === R.bat);
    const pilBox = $('#pilotos', tela), fichaBox = $('#ficha', tela);
    if (!pilBox || !fichaBox) return;
    if (!b) { pilBox.innerHTML = '<div class="vazio"><b>Sem baterias neste dia</b></div>'; fichaBox.innerHTML = ''; return; }
    reservas = (await office(`/reservas?bateriaId=${b.id}&status=todas`)).filter((r) => r.status !== 'cancelada');
    if (!tela.isConnected) return;
    if (!reservas.find((r) => r.id === R.pil)) R.pil = (reservas[0] || {}).id;
    pintarPilotos();
  };
  const pintarPilotos = () => {
    const b = bats.find((x) => x.id === R.bat); const pilBox = $('#pilotos', tela); if (!b || !pilBox) return;
    const st = situacaoBateria(b);
    const aPagar = reservas.filter((r) => !r.pago), semTermo = reservas.filter((r) => !r.termo), site = reservas.filter((r) => r.origem === 'site'), aprovar = reservas.filter((r) => !r.aprovada);
    const filtros = [['Todos', reservas], ['A pagar', aPagar], ['Sem termo', semTermo], ['Pelo site', site], ['A aprovar', aprovar]];
    const q = R.qPil.toLowerCase();
    const lista = filtros[R.filtro][1].filter((r) => !q || `${r.cliente} ${r.kart || ''} ${r.documento || ''}`.toLowerCase().includes(q));
    pilBox.innerHTML = `<div class="cartaoCab"><span class="col"><h2 class="t-titulo">${esc(b.nome)} · ${horaDe(b.dataHora)}</h2><span class="sub">${esc(b.produto || '')}${b.tracado ? ' · traçado ' + esc(b.tracado) : ''}${b.tipoKart ? ' · ' + esc(b.tipoKart) : ''}</span></span><span class="chip dir ${st === 'fim' ? 'cinza' : st === 'prevista' ? 'verde' : 'laranja'}">${st === 'fim' ? 'Horário encerrado' : st === 'prevista' ? 'Horário previsto' : 'Próxima'}</span></div>
      <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; margin: 0 var(--kib-espaco-2); border-radius: var(--kib-raio-cartao); overflow: hidden; background: color-mix(in srgb, var(--kib-cor-texto-principal) 6%, transparent); box-shadow: 0 0 0 1px var(--linha)">${[['Pilotos', `${b.inscritos}/${b.vagas}`, ''], ['Pagos', b.pagos, 'color: var(--okTxt)'], ['A pagar', aPagar.length, aPagar.length ? 'color: var(--erroTxt)' : ''], ['Sem termo', semTermo.length, semTermo.length ? 'color: var(--erroTxt)' : '']].map(([t, v, c]) => `<div class="col" style="gap: 1px; padding: var(--kib-espaco-1) var(--kib-espaco-denso-12); background: var(--sup2)"><span class="peq">${t}</span><span class="num" style="font-size: var(--kib-fonte-tamanho-titulo-grande); font-weight: 700; ${c}">${v}</span></div>`).join('')}</div>
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: var(--kib-espaco-1); padding: var(--kib-espaco-denso-12) var(--kib-espaco-2) var(--kib-espaco-1)"><div class="filtros">${filtros.map(([t, l], i) => `<button data-filtro="${i}" class="${i === R.filtro ? 'sel' : ''}">${t} <span>${l.length}</span></button>`).join('')}</div><label class="buscaCampo" style="margin-left: auto; width: 220px; max-width: 100%">${svg(IC.busca, 13, 'var(--kib-cor-borda-campo)')}<input id="qPil" value="${esc(R.qPil)}" placeholder="Piloto, kart ou CPF"></label></div>
      <div class="rolagemX"><div style="min-width: 620px"><div class="cabTabela" style="grid-template-columns: 30px minmax(0, 1.7fr) 64px 58px 130px 100px"><span>Nº</span><span>Piloto</span><span class="t-dir">Peso</span><span class="t-dir">Kart</span><span>Pagamento</span><span>Termo</span></div>
      ${lista.map((r, i) => `<button class="linhaTabela hov ${r.id === R.pil ? 'sel' : ''}" data-pil="${r.id}" style="grid-template-columns: 30px minmax(0, 1.7fr) 64px 58px 130px 100px"><span class="peq">${i + 1}</span><span style="display: flex; align-items: center; gap: var(--kib-espaco-1); min-width: 0"><span class="avatar m" style="background: ${CORG[r.clienteId % 6]}">${esc(iniciais(r.cliente))}</span><span class="col"><b class="trunc">${esc(r.cliente)}</b><span class="peq">${esc(r.origem === 'site' ? 'Reserva online' : r.origem === 'totem' ? 'Totem' : 'Recepção')}${r.responsavel && r.responsavel !== r.cliente ? ' · resp. ' + esc(r.responsavel) : ''}</span></span></span><span class="t-dir">${r.peso ? r.peso + ' kg' : '—'}</span><span class="t-dir">${r.kart ? `<span class="kart">${esc(r.kart)}</span>` : '—'}</span><span><span class="chip ${r.pago ? (r.origem === 'site' ? 'azul' : 'verde') : 'vermelho'}">${r.pago ? esc(r.formaPagamento || 'Pago') : 'A pagar ' + brlCurto(r.total)}</span></span><span style="display: flex; align-items: center; gap: var(--kib-espaco-meio); font-size: var(--kib-fonte-tamanho-pequeno); ${r.termo ? '' : 'color: var(--erroTxt); font-weight: 600'}"><span class="ponto" style="background: ${r.termo ? 'var(--kib-cor-status-ok)' : 'var(--kib-cor-estado-perigo-solido)'}"></span>${r.termo ? 'Impresso' : 'Falta'}</span></button>`).join('') || `<div class="vazio"><b>Ninguém aqui</b><span>${reservas.length ? 'Nenhum piloto com esse filtro.' : 'Bateria ainda sem pilotos.'}</span></div>`}</div></div>`;
    pintarFicha();
  };
  const pintarFicha = () => {
    const fichaBox = $('#ficha', tela); if (!fichaBox) return;
    const r = reservas.find((x) => x.id === R.pil);
    if (!r) { fichaBox.innerHTML = '<div class="vazio"><span>Toque num piloto para ver a ficha.</span></div>'; return; }
    fichaBox.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; gap: var(--kib-espaco-1); padding: var(--kib-espaco-denso-20) var(--kib-espaco-2) var(--kib-espaco-2); text-align: center; background: linear-gradient(180deg, color-mix(in srgb, var(--kib-cor-marca-principal) 8%, transparent), color-mix(in srgb, var(--kib-cor-marca-principal) 0%, transparent))"><span class="avatar xg" style="background: ${CORG[r.clienteId % 6]}; box-shadow: 0 8px 20px -8px color-mix(in srgb, var(--kib-cor-texto-principal) 35%, transparent)">${esc(iniciais(r.cliente))}</span><b class="t-titulo">${esc(r.cliente)}</b><span class="chip cinza">Cliente ${r.clienteId}</span></div>
      <dl style="margin: 0; padding: var(--kib-espaco-meio) var(--kib-espaco-2) var(--kib-espaco-denso-12); display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--kib-espaco-1) var(--kib-espaco-denso-12); font-size: var(--kib-fonte-tamanho-pequeno)">${[['CPF', r.documento || '—'], ['Nascimento', r.nascimento ? r.nascimento.split('-').reverse().join('/') + (r.idade != null ? ` (${r.idade})` : '') : '—'], ['Peso', r.peso ? r.peso + ' kg' : '—'], ['Telefone', r.telefone || '—'], ['Responsável', r.responsavel || '—'], ['Produto', r.produto || '—'], ['Valor', brl(r.total)], ['Reservado em', r.criadoEm ? r.criadoEm.replace('T', ' ') : '—']].map(([k, v]) => `<dt class="peq">${k}</dt><dd style="margin: 0; text-align: right" class="trunc">${esc(v)}</dd>`).join('')}</dl>
      <div style="display: flex; flex-direction: column; gap: var(--kib-espaco-meio); padding: var(--kib-espaco-1) var(--kib-espaco-2) var(--kib-espaco-2)">${r.aprovada ? '' : `<button class="btn prim" data-aprovar="${r.id}">Aprovar pré-reserva</button>`}${r.telefone ? `<a class="btn verdeClaro" target="_blank" rel="noopener" href="${esc(zap(r.telefone, 'Olá, ' + r.cliente.split(' ')[0] + '! Aqui é do Kartódromo de Betim.'))}">${svg(IC.zap, 14, 'var(--kib-cor-estado-sucesso-texto)')} WhatsApp</a>` : ''}<span class="peq" style="text-align: center; line-height: 1.5">Cobrar, mover e imprimir o termo continuam no programa da Recepção.</span></div>`;
  };
  const carregarCaixa = async () => {
    const movs = await office('/movimentos').catch(() => []);
    if (!tela.isConnected) return;
    const hoje = hojeIso();
    const doDia = movs.filter((m) => (m.abertoEm || '').slice(0, 10) === hoje || !m.fechadoEm);
    const total = doDia.reduce((a, m) => a + (+m.recebido || 0), 0);
    const cx = $('#caixa', tela); if (!cx) return;
    cx.innerHTML = `<div class="cartaoCab"><h2>Caixas de hoje</h2><span class="sub">terminais abertos e fechados no dia</span><span class="dir num t-titulo-grande peso-negrito">${brl(total)}</span></div>
      <div class="rolagemX"><div style="min-width: 560px"><div class="cabTabela" style="grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 110px 110px 120px"><span>Terminal</span><span>Operador · turno</span><span>Aberto</span><span>Fechado</span><span class="t-dir">Recebido</span></div>
      ${doDia.map((m) => `<div class="linhaTabela" style="grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 110px 110px 120px"><b>${esc(m.terminal)}</b><span class="trunc">${esc(m.usuario || '—')} · ${esc(m.turno || '—')}</span><span class="mono">${esc((m.abertoEm || '').slice(11, 16))}</span><span>${m.fechadoEm ? `<span class="mono">${esc(m.fechadoEm.slice(11, 16))}</span>` : '<span class="chip verde"><span class="ponto pulso" style="background: var(--kib-cor-status-ok)"></span>aberto</span>'}</span><b class="num t-dir">${brl(m.recebido)}</b></div>`).join('') || '<div class="vazio"><b>Nenhum caixa aberto hoje</b><span>O terminal é aberto no programa da Recepção.</span></div>'}</div></div>`;
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
    $('#tabRes').innerHTML = `<div class="cartaoCab"><h2>Pedidos do site</h2><div class="filtros">${filtros.map(([t, l], i) => `<button data-f="${i}" class="${i === R.filtro ? 'sel' : ''}">${t} <span>${l.length}</span></button>`).join('')}</div><label class="buscaCampo dir" style="width: 220px; max-width: 100%">${svg(IC.busca, 13, 'var(--kib-cor-borda-campo)')}<input id="qRes" value="${esc(R.q)}" placeholder="Nome, código ou telefone" aria-label="Buscar pedido por nome, código ou telefone"></label></div>
      <div class="rolagemX"><div style="min-width: 760px"><div class="cabTabela" style="grid-template-columns: 110px minmax(0, 1.4fr) minmax(0, 1fr) 60px 100px 130px 120px"><span>Pedido</span><span>Cliente</span><span>Bateria</span><span class="t-dir">Vagas</span><span class="t-dir">Valor</span><span>Pagamento</span><span></span></div>
      ${vis.map((o) => { const [c, t] = chip(o.status); return `<div class="linhaTabela" style="grid-template-columns: 110px minmax(0, 1.4fr) minmax(0, 1fr) 60px 100px 130px 120px"><span class="col"><span class="mono peso-semibold">${esc(o.codigo)}</span><span class="peq">${esc((o.dataHora || '').slice(8, 10) + '/' + (o.dataHora || '').slice(5, 7) + ' ' + (o.dataHora || '').slice(11, 16))}</span></span><span class="col"><b class="trunc">${esc(o.cliente)}</b><span class="peq">${esc(o.telefone || '')}${o.forma ? ' · ' + esc(o.forma) : ''}</span></span><span class="col"><span class="trunc">${esc(o.bateria)}</span><span class="peq">${esc((o.inicio || '').slice(8, 10) + '/' + (o.inicio || '').slice(5, 7) + ' ' + (o.inicio || '').slice(11, 16))}</span></span><span class="t-dir">${o.quantidade}</span><b class="num t-dir">${brl(o.valor)}</b><span><span class="chip ${c}">${esc(t)}</span></span><span style="display: flex; gap: var(--kib-espaco-meio); justify-content: flex-end">${o.status === 'pago_sem_vaga' ? `<button class="btn escuro peq" data-resolver="${o.id}">Resolvido</button>` : ''}${o.telefone ? `<a class="btn verdeClaro peq" target="_blank" rel="noopener" href="${esc(zap(o.telefone, `Olá, ${(o.cliente || '').split(' ')[0]}! Sobre a sua reserva ${o.codigo} no Kartódromo de Betim:`))}">WhatsApp</a>` : ''}</span></div>`; }).join('') || '<div class="vazio"><b>Nenhum pedido com esse filtro</b></div>'}</div></div>`;
  };
  const carregar = async () => { lista = await office(`/reservas-online?status=todas&filtro=entre&data=${somaDias(hojeIso(), -30)}&ate=${hojeIso()}`); if (!tela.isConnected) return; selo('reservas', lista.filter((o) => o.status === 'pago_sem_vaga').length ? String(lista.filter((o) => o.status === 'pago_sem_vaga').length) : '', 'vermelho'); pintar(); };
  tela.addEventListener('click', async (e) => {
    const f = e.target.closest('[data-f]'); if (f) { R.filtro = +f.dataset.f; pintar(); return; }
    const r = e.target.closest('[data-resolver]');
    if (r) {
      const resolucao = await dialogo({
        titulo: 'Marcar pedido como resolvido?',
        texto: 'Escolha como o pedido foi resolvido com o cliente (se usou cupom, reembolso libera o uso e remarcação mantém consumido):',
        botoes: [
          { rotulo: 'Cliente remarcado', valor: 'remarcado', classe: 'prim' },
          { rotulo: 'Reembolso confirmado', valor: 'reembolso_confirmado', classe: 'sec' },
        ],
      });
      if (!resolucao) return;
      try { await office(`/reservas-online/${r.dataset.resolver}/resolver`, { method: 'POST', body: { resolucao } }); toast('Marcado como resolvido'); carregar(); } catch (er) { falhou(er); }
    }
  });
  tela.addEventListener('input', (e) => { if (e.target.id === 'qRes') { R.q = e.target.value; pintar(); const i = $('#qRes'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } });
  await carregar();
  repetir(carregar, 30_000);
};


// ---------- Telas que dependem da próxima etapa do servidor
function emBreve(sobre, titulo, texto, itens) {
  return async (tela) => {
    tela.innerHTML = `${cabecalho(sobre, titulo)}<main class="principal"><section class="cartao"><div class="cartaoCab"><h2>Em implantação</h2><span class="chip laranja">próxima etapa</span></div><p style="margin: 0; padding: 0 var(--kib-espaco-2) var(--kib-espaco-denso-12); line-height: 1.6; color: var(--tinta2)">${texto}</p><ul style="margin: 0; padding: 0 var(--kib-espaco-2) var(--kib-espaco-2) var(--kib-espaco-4); line-height: 1.8">${itens.map((i) => `<li>${i}</li>`).join('')}</ul></section></main>`;
  };
}
TELAS.campeonatos = emBreve('Competições', 'Campeonatos', 'Os resultados das etapas já são gerados pela cronometragem. A tela de campeonatos precisa das categorias e da regra de pontuação no banco do servidor.', ['Etapas, categorias e pontuação (50, 45, 42, 40, 38…)', 'Bônus de pole e melhor volta, punição −10', 'PDF por categoria e publicação no site', 'Falta decidir: pontuar pela posição na categoria ou pela geral']);
TELAS.sistema = async (tela) => {
  tela.innerHTML = `${cabecalho('Sistema', 'PCs e sistema')}<main class="principal"><section class="kpis" id="servicos"></section><section class="cartao leve"><div class="cartaoCab"><h2>Computadores</h2><span class="sub">versão, último sinal e erros de cada PC chegam na próxima etapa (agente em cada PC)</span></div>
    <div class="rolagemX"><div style="min-width: 560px"><div class="cabTabela" style="grid-template-columns: 70px minmax(0, 1fr) minmax(0, 1.6fr)"><span>IP</span><span>Computador</span><span>Programas</span></div>${[['.53', 'Recepção', 'Recepção · impressora TM-T20'], ['.239', 'Recepção 2', 'Recepção · Totem · Cronometragem'], ['.12', 'Ana (gerência)', 'Recepção · Totem · Cronometragem'], ['.161', 'Totem 1', 'Autoatendimento'], ['.69', 'Totem 2', 'Autoatendimento'], ['.254', 'CRONO1', 'Cronometragem · TV'], ['.249', 'ORBITS', 'Cronometragem :4050 · painel de LED'], ['.13', 'SRVKART', 'Servidor da operação :4060 · SQL Server'], ['.250', 'Telão TB50', 'Placar LED grande']].map(([ip, n, a]) => `<div class="linhaTabela" style="grid-template-columns: 70px minmax(0, 1fr) minmax(0, 1.6fr)"><span class="mono">${ip}</span><b>${n}</b><span class="peq">${a}</span></div>`).join('')}</div></div></section></main>`;
  const pintar = async () => { await atualizarConexao(); const r = S.saude; if (!r) return; $('#servicos').innerHTML = [['Servidor da operação', 'SRVKART · KartodromoOps', r.ops], ['Cronometragem', 'ORBITS · decoder', r.crono]].map(([t, d, x]) => `<div class="kpi"><span class="rot"><span class="ponto" style="width: 8px; height: 8px; background: ${x.ok ? 'var(--kib-cor-status-ok)' : 'var(--kib-cor-estado-perigo-solido)'}"></span>${t}</span><span class="val t-titulo-grande">${x.ok ? x.ms + ' ms' : 'sem resposta'}</span><span class="peq">${d}</span></div>`).join(''); };
  await pintar();
  repetir(pintar, 30_000);
};

// ------------------------------------------------------------------ eventos gerais
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-acao]');
  if (!a) return;
  const acao = a.dataset.acao;
  if (acao === 'sair') { confirmar('Sair do painel?', 'Sua sessão atual neste navegador será encerrada.', 'Sair').then((ok) => { if (ok) sair(); }); }
  if (acao === 'busca') abrirBusca();
  if (acao === 'fechar') { fecharComAviso(() => fecharCamada()); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    const cx = $('#camada .modal, #camada .gaveta'); if (!cx) return;
    const f = [...cx.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled):not([readonly]), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])'), ...document.querySelectorAll('.toast button')].filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const primeiro = f[0], ultimo = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === primeiro || document.activeElement === cx)) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    else if (!cx.contains(document.activeElement) && !document.activeElement.closest('.toast')) { e.preventDefault(); primeiro.focus(); }
    return;
  }
  if (e.key === 'Escape' && $('#camada').innerHTML) { fecharComAviso(() => fecharCamada()); }
  if (S.tela && S.tela.atalho) S.tela.atalho(e); // atalhos da tela aberta (S.tela zera a cada troca de tela)
});
window.addEventListener('hashchange', () => { if (S.token && $('#tela')) abrirTela(rotaAtual()); });
// espera grupo.js e painel.js (carregados depois deste arquivo)
document.addEventListener('DOMContentLoaded', montarApp);
