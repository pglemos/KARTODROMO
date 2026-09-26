/* Recepcao — telas (replica funcional do LapTime Office). Depende de office-core.js. */
'use strict';

const App = { apoio: null, view: null, grid: null, rows: [], filtroBateria: null };
const P = (k) => App.apoio?.parametros?.[k];

// =====================================================================================
// LOGIN
// =====================================================================================
function telaLogin() {
  $('#app').hidden = true;
  const l = $('#login');
  l.hidden = false;
  const inp = $('#lgLogin');
  inp.focus();
  const go = async () => {
    $('#lgMsg').textContent = '';
    if (!$('#lgTermos').checked) { $('#lgMsg').textContent = 'É necessário concordar com os termos de uso.'; return; }
    try {
      const r = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login: inp.value, senha: $('#lgSenha').value, termos: true }) });
      const d = await r.json();
      if (!r.ok) { $('#lgMsg').textContent = d.error || 'Falha no login.'; $('#lgSenha').select(); return; }
      Sess.token = d.token;
      try { localStorage.setItem('ultimoLogin', inp.value); } catch { /* */ }
      iniciar();
    } catch { $('#lgMsg').textContent = 'Servidor fora do ar. Verifique a rede.'; }
  };
  try { inp.value = localStorage.getItem('ultimoLogin') || ''; if (inp.value) $('#lgSenha').focus(); } catch { /* */ }
  $('#lgOk').onclick = go;
  $('#lgCancelar').onclick = () => { inp.value = ''; $('#lgSenha').value = ''; inp.focus(); };
  $('#lgSenha').onkeydown = inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
  $('#lgTermosLink').onclick = (e) => { e.preventDefault(); info('Uso restrito aos colaboradores do Kartódromo. Os dados dos clientes são tratados conforme a LGPD e só podem ser usados para a operação do kartódromo.'); };
}

async function iniciar() {
  try { App.apoio = await api('/api/office/apoio', { noRelogin: true, quiet: true }); } catch { Sess.token = ''; return telaLogin(); }
  Sess.user = App.apoio.usuario;
  $('#login').hidden = true;
  $('#app').hidden = false;
  $('#licenca').textContent = `EMPRESA LICENCIADA: ${(App.apoio.empresa?.razaoSocial || App.apoio.empresa?.nome || '').toUpperCase()}`;
  montarMenus();
  montarToolbar();
  montarArvore();
  $('#fData').value = hoje();
  $('#fData').onchange = $('#fFiltro').onchange = () => carregar();
  statusBar();
  selecionarNo('reservas:todas');
}

function statusBar() {
  const tick = () => { const d = new Date(); $('#sbHora').textContent = d.toTimeString().slice(0, 5); $('#sbData').textContent = d.toLocaleDateString('pt-BR'); };
  tick(); setInterval(tick, 15000);
  $('#sbUser').textContent = Sess.user.nome;
  const ping = async () => { try { const r = await fetch('/healthz'); $('#sbSrv').className = r.ok ? 'on' : 'off'; $('#sbSrv').textContent = r.ok ? 'Servidor: On-line' : 'Servidor: Off-line'; } catch { $('#sbSrv').className = 'off'; $('#sbSrv').textContent = 'Servidor: Off-line'; } };
  ping(); setInterval(ping, 30000);
}

// =====================================================================================
// MENUS / TOOLBAR / ARVORE
// =====================================================================================
function montarMenus() {
  const adm = Sess.user.admin;
  const M = [
    ['Início', [
      ['Config Inicial (Empresa)', abrirEmpresa, !adm],
      ['Segurança', [['Usuário', () => cadastro('usuarios'), !adm], ['Trocar minha senha', trocarSenha]]],
      '-', ['Fechar (sair)', sair],
    ]],
    ['Cadastros', [
      ['Empresa', abrirEmpresa, !adm], ['Feriados', () => cadastro('feriados')], '-',
      ['Cliente', () => registroCliente()], ['Traçados', () => cadastro('tracados')], '-',
      ['POS', [['Turno', () => cadastro('turnos')], ['Terminal', () => cadastro('terminais')]]], '-',
      ['Oficina', [['Itens de Manutenção', () => cadastro('itensManutencao')], ['Registro de Manutenções', () => selecionarNo('oficina:arealizar')]]],
    ]],
    ['Financeiro', [
      ['Plano de Contas', null, true], ['Conta Financeira', null, true], ['Métodos de Pagamento', () => cadastro('formas')], '-',
      ['Programa de Fidelidade', [['Contas', () => selecionarNo('fidelidade:contas')], ['Transações', () => selecionarNo('fidelidade:transacoes')]]],
      ['Vouchers', [['Cadastro de Vouchers', () => selecionarNo('vouchers:lista')], ['Histórico de Consumo', () => selecionarNo('vouchers:uso')], ['Criar Voucher', () => criarVoucher('manual')]]],
      ['Parceiros', [['Cadastro de Parceiros', () => selecionarNo('parceiros:lista')]]],
    ]],
    ['Ferramentas', [['Parâmetros do Sistema', parametrosSistema, !adm], ['Cadastro de Padrões de Reservas', () => cadastro('padroes')]]],
    ['Relatórios', [
      ['Cronometragem', [['Abrir app de Cronometragem', () => window.open('http://192.168.20.249:4050/', '_blank')], ['Resultados (TV)', () => window.open('http://192.168.20.249:4050/tv', '_blank')]]],
      ['Financeiro', [['Receitas por Forma de Pagamento', () => relPeriodo('receitas', 'forma')], ['Receitas por Clientes', () => relPeriodo('receitas', 'cliente')], ['Receitas por Produto', () => relPeriodo('receitas', 'produto')], ['Fluxo de Caixa', () => relPeriodo('receitas', 'dia')]]],
      '-', ['Fechamento de Caixa', relFechamento], ['Reservas Diária', relReservasDiaria], ['Clientes por Período', () => relPeriodo('clientes')],
      ['Lista de Participantes', relParticipantes], ['Agenda Mensal', relAgendaMensal], ['Imprimir Termo de Responsabilidade (em Branco)', () => openReport('/termo?branco=1')],
    ]],
    ['Ajuda', [['Sobre', () => info('Kartódromo — Módulo Recepção\nSistema próprio que substitui o LapTime Office.\nServidor: SRVKART (banco KartodromoOps).')]]],
  ];
  const bar = $('#menubar');
  bar.innerHTML = '';
  const buildMenu = (itens) => {
    const menu = h('<div class="menu"></div>');
    for (const it of itens) {
      if (it === '-') { menu.appendChild(h('<div class="sep"></div>')); continue; }
      const [rot, acao, dis] = it;
      const el = h(`<div class="it${Array.isArray(acao) ? ' sub' : ''}${dis || acao === null ? ' dis' : ''}">${esc(rot)}</div>`);
      if (Array.isArray(acao)) el.appendChild(buildMenu(acao));
      else if (acao && !dis) el.onclick = (e) => { e.stopPropagation(); fecharMenus(); acao(); };
      menu.appendChild(el);
    }
    return menu;
  };
  for (const [rot, itens] of M) {
    const top = h(`<div><span>${esc(rot)}</span></div>`);
    top.appendChild(buildMenu(itens));
    top.firstElementChild.onclick = (e) => { e.stopPropagation(); const was = top.classList.contains('open'); fecharMenus(); if (!was) top.classList.add('open'); };
    top.onmouseenter = () => { if ($('#menubar .open') && !top.classList.contains('open')) { fecharMenus(); top.classList.add('open'); } };
    bar.appendChild(top);
  }
  document.addEventListener('click', fecharMenus);
}
function fecharMenus() { $$('#menubar .open').forEach((x) => x.classList.remove('open')); }

function montarToolbar() {
  const T = [
    ['👤', 'Clientes', () => registroCliente()], ['🏷️', 'Produtos', () => cadastro('produtos')], '|',
    ['🚦', 'Reservas', () => criarReservas()], ['📅', 'Agenda', () => agenda()], '|',
    ['🖥️', 'Terminal', terminal], ['💵', 'Receita Avulsa', () => checkout({})], ['📥', 'Suprimento', () => transacaoCaixa('suprimento')], ['📤', 'Sangria', () => transacaoCaixa('sangria')], '|',
    ['🎟️', 'Voucher (Fidelidade)', () => criarVoucher('fidelidade')], ['🎁', 'Voucher (Parceiro)', () => criarVoucher('parceiro')], '|',
    ['🔳', 'Serviços Online ▾', servicosOnline],
  ];
  const tb = $('#toolbar');
  tb.innerHTML = '';
  for (const t of T) {
    if (t === '|') { tb.appendChild(h('<div class="vsep"></div>')); continue; }
    const el = h(`<div class="tb" title="${esc(t[1])}"><div class="ic">${t[0]}</div><span>${esc(t[1])}</span></div>`);
    el.onclick = (e) => t[2](e);
    tb.appendChild(el);
  }
}

const ARVORE = [
  ['📋', 'Reservas', 'reservas:todas', [['y', 'Aprovar', 'reservas:aprovar'], ['g', 'Aprovadas', 'reservas:aprovadas'], ['y', 'Pagamento Pendente', 'reservas:pendentes'], ['r', 'Canceladas', 'reservas:canceladas'], ['b', 'Todas', 'reservas:todas']]],
  ['🕒', 'Baterias', 'baterias:todas', [['g', 'Abertas', 'baterias:abertas'], ['r', 'Fechadas', 'baterias:fechadas'], ['b', 'Todas', 'baterias:todas']]],
  ['💰', 'Financeiro', null, [['➕', 'Vendas', 'vendas:todas', [['g', 'Liquidadas', 'vendas:liquidadas'], ['r', 'Canceladas', 'vendas:canceladas'], ['b', 'Todas', 'vendas:todas']]]]],
  ['🚗', 'Oficina', null, [['🔧', 'Manutenções', 'oficina:todas', [['y', 'A Realizar', 'oficina:arealizar'], ['g', 'Realizadas', 'oficina:realizadas'], ['b', 'Todas', 'oficina:todas']]]]],
  ['⭐', 'Fidelidade', null, [['⭐', 'Contas', 'fidelidade:contas'], ['🪙', 'Transações', 'fidelidade:transacoes']]],
  ['🎟️', 'Vouchers', null, [['🎟️', 'Vouchers', 'vouchers:lista'], ['🕒', 'Histórico de Uso', 'vouchers:uso']]],
  ['🤝', 'Parceiros', null, [['🤝', 'Parceiros', 'parceiros:lista'], ['🤝', 'Histórico de Comissões', 'parceiros:comissoes'], ['🤝', 'Comissões Pagas', 'parceiros:pagas']]],
];
function montarArvore() {
  const mk = (nodes) => {
    const ul = document.createElement('ul');
    for (const [ic, rot, key, kids] of nodes) {
      const li = document.createElement('li');
      const icon = ic.length === 1 && 'ygrb'.includes(ic) ? `<i class="ball ${ic}"></i>` : `<span>${ic}</span>`;
      const n = h(`<span class="n"${key ? ` data-k="${key}"` : ''}>${kids ? '<span class="tg">⊟</span>' : '<span class="tg"></span>'}${icon}<span>${esc(rot)}</span></span>`);
      li.appendChild(n);
      if (kids) { const sub = mk(kids); li.appendChild(sub); $('.tg', n).onclick = (e) => { e.stopPropagation(); sub.hidden = !sub.hidden; $('.tg', n).textContent = sub.hidden ? '⊞' : '⊟'; }; }
      if (key) n.onclick = () => selecionarNo(key);
      ul.appendChild(li);
    }
    return ul;
  };
  $('#tree').innerHTML = '';
  $('#tree').appendChild(mk(ARVORE));
}
function selecionarNo(key, extra) {
  $$('#tree .n').forEach((n) => n.classList.toggle('sel', n.dataset.k === key));
  const [grupo, status] = key.split(':');
  App.view = { grupo, status };
  App.filtroBateria = extra?.bateria || null;
  $('#filterbar').style.visibility = ['oficina', 'fidelidade', 'vouchers', 'parceiros'].includes(grupo) ? 'hidden' : 'visible';
  carregar();
}

// =====================================================================================
// VISOES (grade principal)
// =====================================================================================
const VIEWS = {
  reservas: {
    url: (s) => `/api/office/reservas?status=${s}` + (App.filtroBateria ? `&bateriaId=${App.filtroBateria.id}` : `&filtro=${$('#fFiltro').value}&data=${$('#fData').value}`),
    cols: () => [
      { key: 'pago', label: 'Pago', fmt: 'bool', cls: 'c' },
      { key: 'dataHora', label: 'Data/Hora', fmt: 'dmyhm' },
      { key: 'reserva', label: 'Reserva', w: 150 },
      { key: 'cliente', label: 'Cliente', w: 220 },
      ...(P('office.exibirColunaResponsavel') === 'true' ? [{ key: 'responsavel', label: 'Responsável' }] : []),
      { key: 'produto', label: 'Produto', w: 200 },
      { key: 'categoria', label: 'Categoria' },
      { key: 'preco', label: 'Preço (R$)', fmt: 'money', cls: 'r' },
      { key: 'desconto', label: 'Desconto (R$)', fmt: 'money', cls: 'r' },
      { key: 'total', label: 'Total (R$)', fmt: 'money', cls: 'r' },
      { key: 'observacao', label: 'Observação', w: 200 },
    ],
    rowClass: (r) => (r.status === 'cancelada' ? 'canc' : !r.aprovada ? 'pre' : ''),
    extra: (rows) => `Pagos: ${rows.filter((r) => r.pago).length} · Pré-reservas: ${rows.filter((r) => !r.aprovada && r.status !== 'cancelada').length} · Total pago: ${fmt.brl(rows.filter((r) => r.pago).reduce((s, r) => s + (r.total || 0), 0))}`,
    dbl: (r) => (r.pago || r.status === 'cancelada' ? editarReserva(r) : checkoutDeReservas([r])),
    ctx: (sel) => [
      { label: 'Aprovar', fn: () => checkoutDeReservas(sel), dis: !sel.length || sel.some((r) => r.pago || r.status === 'cancelada') },
      { label: 'Aprovar Pré-reserva (sem pagamento)', fn: () => aprovarPre(sel), dis: !sel.some((r) => !r.aprovada && r.status !== 'cancelada') },
      { label: 'Editar Reserva', fn: () => editarReserva(sel[0]), dis: sel.length !== 1 },
      { label: 'Alterar Cliente', fn: () => alterarCliente(sel[0]), dis: sel.length !== 1 || sel[0].status === 'cancelada' },
      { label: 'Mover Cliente', fn: () => moverCliente(sel[0]), dis: sel.length !== 1 || sel[0].status === 'cancelada' },
      '-',
      { label: 'Imprimir Termo', fn: () => imprimirTermo(sel.map((r) => r.id)), dis: !sel.length },
      { label: 'Imprimir Ticket', fn: () => openReport(`/relatorio/ticket?ids=${sel.map((r) => r.id).join(',')}`), dis: !sel.length },
      '-',
      { label: 'Excluir', fn: () => excluirReservas(sel), dis: !sel.length },
      '-',
      { label: 'Exportar para Excel', fn: () => exportarExcel('reservas', VIEWS.reservas.cols(), App.grid.visiveis()) },
    ],
  },
  baterias: {
    url: (s) => `/api/office/baterias?status=${s}&filtro=${$('#fFiltro').value}&data=${$('#fData').value}`,
    cols: () => [
      { key: 'dataHora', label: 'Data/Hora', fmt: 'dmyhm' },
      { key: 'nome', label: 'Nome', w: 200 },
      { key: 'produto', label: 'Produto', w: 220 },
      { key: 'vagas', label: 'Vagas (máx)', cls: 'r' },
      { key: 'disponiveis', label: 'Vagas (disponíveis)', cls: 'r' },
      { key: 'pagos', label: 'Pagos', cls: 'r' },
      { key: 'preReservas', label: 'Pré-reservas', cls: 'r' },
      { key: 'responsavel', label: 'Responsável', w: 160 },
      { key: 'status', label: 'Situação', val: (r) => (r.status === 'aberta' ? 'Aberta' : 'Fechada') },
      { key: 'autoAtendimento', label: 'Totem', fmt: 'bool', cls: 'c' },
    ],
    rowClass: (r) => (r.status === 'fechada' ? 'canc' : ''),
    extra: (rows) => `Vagas: ${rows.reduce((s, r) => s + r.vagas, 0)} · Reservas: ${rows.reduce((s, r) => s + r.inscritos, 0)} · Pagos: ${rows.reduce((s, r) => s + r.pagos, 0)}`,
    dbl: (r) => { selecionarNo('reservas:todas', { bateria: r }); },
    ctx: (sel) => [
      { label: 'Abrir Bateria', fn: () => statusBateria(sel, 'aberta'), dis: !sel.some((b) => b.status !== 'aberta') },
      { label: 'Fechar Bateria', fn: () => statusBateria(sel, 'fechada'), dis: !sel.some((b) => b.status === 'aberta') },
      { label: 'Editar Bateria', fn: () => formBateria(sel[0]), dis: sel.length !== 1 },
      { label: 'Incluir Cliente', fn: () => incluirCliente(sel[0]), dis: sel.length !== 1 },
      { label: 'Ver Reservas', fn: () => selecionarNo('reservas:todas', { bateria: sel[0] }), dis: sel.length !== 1 },
      { label: 'Lista de Participantes', fn: () => openReport(`/relatorio/participantes?bateria=${sel[0].id}`), dis: sel.length !== 1 },
      '-',
      { label: 'Excluir', fn: () => excluirBaterias(sel), dis: !sel.length },
      { label: 'Excluir Todas as Baterias Listadas', fn: () => excluirBaterias(App.grid.visiveis(), true) },
      '-',
      { label: 'Exportar para Excel', fn: () => exportarExcel('baterias', VIEWS.baterias.cols(), App.grid.visiveis()) },
    ],
  },
  vendas: {
    url: (s) => `/api/office/vendas?status=${s}&filtro=${$('#fFiltro').value}&data=${$('#fData').value}`,
    cols: () => [
      { key: 'dataHora', label: 'Data/Hora', fmt: 'dmyhm' }, { key: 'codigo', label: 'Código' }, { key: 'cliente', label: 'Cliente', w: 200 },
      { key: 'documento', label: 'Nº Documento' }, { key: 'usuario', label: 'Usuário' }, { key: 'terminal', label: 'Terminal' },
      { key: 'bruto', label: 'Vendas (R$)', fmt: 'money', cls: 'r' }, { key: 'desconto', label: 'Descontos (R$)', fmt: 'money', cls: 'r' },
      { key: 'acrescimo', label: 'Acréscimos (R$)', fmt: 'money', cls: 'r' }, { key: 'recebido', label: 'Recebido (R$)', fmt: 'money', cls: 'r' },
      { key: 'troco', label: 'Troco (R$)', fmt: 'money', cls: 'r' }, { key: 'estorno', label: 'Estornos (R$)', fmt: 'money', cls: 'r' },
      { key: 'final', label: 'Final (R$)', fmt: 'money', cls: 'r' }, { key: 'cancelada', label: 'Cancelado', fmt: 'bool', cls: 'c' },
      { key: 'motivo', label: 'Motivo do Cancelamento' }, { key: 'observacao', label: 'Observação' },
    ],
    rowClass: (r) => (r.cancelada ? 'canc' : ''),
    extra: (rows) => `Total final: ${fmt.brl(rows.filter((r) => !r.cancelada).reduce((s, r) => s + r.final, 0))}`,
    dbl: (r) => verVenda(r.id),
    ctx: (sel) => [
      { label: 'Estornar Pagamento', fn: () => estornarVenda(sel[0].id), dis: sel.length !== 1 || sel[0].cancelada },
      { label: 'Visualizar Métodos de Pagamento', fn: () => verVenda(sel[0].id), dis: sel.length !== 1 },
      { label: 'Imprimir Comprovante', fn: () => openReport(`/relatorio/venda?id=${sel[0].id}`), dis: sel.length !== 1 },
      '-',
      { label: 'Exportar para Excel', fn: () => exportarExcel('vendas', VIEWS.vendas.cols(), App.grid.visiveis()) },
    ],
  },
  oficina: {
    url: (s) => `/api/office/manutencoes?status=${s}`,
    cols: () => [
      { key: 'kart', label: 'Kart' }, { key: 'categoria', label: 'Categoria' }, { key: 'item', label: 'Item de Manutenção', w: 200 },
      { key: 'minutosUso', label: 'Tempo de Uso', val: (r) => `${Math.floor(r.minutosUso / 60)}h${String(r.minutosUso % 60).padStart(2, '0')}`, cls: 'r' },
      { key: 'limiteHoras', label: 'Limite (h)', cls: 'r' }, { key: 'ultimaManutencao', label: 'Última Manutenção', fmt: 'dmyhm' },
      { key: 'data', label: 'Atualizado em', fmt: 'dmyhm' }, { key: 'realizada', label: 'Realizada', fmt: 'bool', cls: 'c' },
    ],
    multi: true,
    ctx: (sel) => [
      { label: 'Marcar como Manutenção Realizada', fn: () => marcarManutencao(sel, true), dis: !sel.length },
      { label: 'Marcar Todos como Manutenção Realizada', fn: () => marcarManutencao(App.grid.visiveis(), true) },
      { label: 'Desmarcar como Manutenção Realizada', fn: () => marcarManutencao(sel, false), dis: !sel.length },
      { label: 'Desmarcar Todos como Manutenção Realizada', fn: () => marcarManutencao(App.grid.visiveis(), false) },
      '-', { label: 'Exportar para Excel', fn: () => exportarExcel('manutencoes', VIEWS.oficina.cols(), App.grid.visiveis()) },
    ],
  },
  vouchers: {
    url: (s) => (s === 'uso' ? '/api/office/vouchers/uso' : '/api/office/vouchers'),
    cols: (s) => (s === 'uso'
      ? [{ key: 'dataHora', label: 'Data/Hora', fmt: 'dmyhm' }, { key: 'voucher', label: 'Voucher' }, { key: 'cliente', label: 'Cliente', w: 200 }, { key: 'desconto', label: 'Desconto (R$)', fmt: 'money', cls: 'r' }, { key: 'vendaId', label: 'Venda' }, { key: 'estornado', label: 'Estornado', fmt: 'bool', cls: 'c' }]
      : [{ key: 'codigo', label: 'Código' }, { key: 'origem', label: 'Origem' }, { key: 'referencia', label: 'Conta/Parceiro' }, { key: 'tipo', label: 'Tipo desconto' },
        { key: 'valor', label: 'Valor', val: (r) => (r.tipo === 'percentual' ? `${r.valor}%` : fmt.brl(r.valor)), cls: 'r' }, { key: 'inicio', label: 'Data inicial', fmt: 'dmy' }, { key: 'fim', label: 'Data final', fmt: 'dmy' },
        { key: 'produto', label: 'Produto' }, { key: 'usoMaxCliente', label: 'Uso máx/cliente', cls: 'r' }, { key: 'usoUnico', label: 'Uso único', fmt: 'bool', cls: 'c' }, { key: 'usos', label: 'Usos', cls: 'r' }]),
    ctx: () => [{ label: 'Criar Voucher', fn: () => criarVoucher('manual') }, '-', { label: 'Exportar para Excel', fn: () => exportarExcel('vouchers', VIEWS.vouchers.cols(App.view.status), App.grid.visiveis()) }],
  },
  fidelidade: { vazio: 'O programa de fidelidade não era usado no LapTime (nenhuma conta cadastrada).', cols: () => [{ key: 'nome', label: 'Conta' }, { key: 'saldo', label: 'Saldo' }] },
  parceiros: { vazio: 'Nenhum parceiro cadastrado (o LapTime não tinha parceiros nem comissões).', cols: () => [{ key: 'nome', label: 'Parceiro' }, { key: 'comissao', label: 'Comissão' }] },
};

async function carregar() {
  const { grupo, status } = App.view;
  const v = VIEWS[grupo];
  let rows = [];
  if (v.url) rows = await api(v.url(status)).catch(() => []);
  App.rows = rows;
  const cols = v.cols(status);
  const tituloFiltro = App.filtroBateria ? `<span class="extra">Bateria: <b>${esc(App.filtroBateria.nome)} ${fmt.dmyhm(App.filtroBateria.dataHora)}</b> <a href="#" id="limpaBat">(mostrar todas)</a></span>` : '';
  const render = (list) => {
    $('#totalbar').innerHTML = `Total de registros: ${list.length} ${v.extra ? `<span class="extra">${v.extra(list)}</span>` : ''} ${tituloFiltro}`;
    const lb = $('#limpaBat'); if (lb) lb.onclick = (e) => { e.preventDefault(); App.filtroBateria = null; carregar(); };
  };
  App.grid = grade($('#gridwrap'), cols, rows, {
    multi: v.multi, vazio: v.vazio, rowClass: v.rowClass, onDbl: v.dbl,
    onCtx: v.ctx ? (sel, e) => ctxMenu(e.clientX, e.clientY, v.ctx(sel)) : null,
    onFilter: render,
  });
  render(rows);
}
const recarregar = () => carregar();

// =====================================================================================
// CLIENTES
// =====================================================================================
const CLIENTE_CAMPOS = `
  <div class="fg" style="grid-template-columns: 170px 130px 170px 30px 90px 30px 1fr">
    <div><label>Tipo de pessoa</label><select name="tipoPessoa"><option>Pessoa Física</option><option>Pessoa Jurídica</option></select></div>
    <div><label>Tipo documento</label><select name="tipoDocumento"><option>CPF</option><option>RG</option><option>PASSAPORTE</option><option>OUTRO</option></select></div>
    <div><label>Nº documento</label><input name="documento"></div><div></div>
    <div><label>Cep</label><input name="cep"></div><div><button type="button" data-a="cep" title="Buscar CEP" style="padding:2px 6px">🔍</button></div>
    <div><label>Endereço</label><input name="endereco"></div>
  </div>
  <div class="fg" style="grid-template-columns: 170px 1fr 90px 1fr 1fr; margin-top:6px">
    <div><label>Tipo de cliente</label><select name="tipoCliente"><option>Consumidor Final</option></select></div>
    <div><label>Nome *</label><input name="nome"></div>
    <div><label>Nº</label><input name="numero"></div><div><label>Complemento</label><input name="complemento"></div><div><label>Bairro</label><input name="bairro"></div>
  </div>
  <div class="fg" style="grid-template-columns: 170px 1fr 1fr 90px; margin-top:6px">
    <div><label>Sexo</label><select name="sexo"><option value="">Não Informado</option><option value="M">Masculino</option><option value="F">Feminino</option></select></div>
    <div><label>E-mail</label><input name="email"></div><div><label>Cidade</label><input name="cidade"></div><div><label>Estado</label><input name="estado" maxlength="2"></div>
  </div>
  <div class="fg" style="grid-template-columns: 90px 140px 1fr 1fr 1fr; margin-top:6px">
    <div><label>Peso (kg)</label><input name="peso"></div><div><label>Aniversário</label><input name="nascimento" type="date"></div>
    <div><label>Telefone</label><input name="telefone"></div><div><label>País</label><input value="Brasil" disabled></div>
    <div class="ck" style="padding-bottom:4px"><input type="checkbox" name="bloqueado" id="cfBl"><label for="cfBl">Bloqueado</label></div>
  </div>
  <div class="fg" style="grid-template-columns: 1fr 30px 30px 1fr; margin-top:6px">
    <div><label>Responsável</label><input id="cfResp" readonly><input type="hidden" name="responsavelId"></div>
    <div><button type="button" data-a="respAdd" title="Selecionar responsável">➕</button></div><div><button type="button" data-a="respLimpa" title="Remover responsável">✕</button></div>
    <div class="ck" style="padding-bottom:4px"><input type="checkbox" name="lgpd" id="cfLg"><label for="cfLg">Concordo com os termos de uso dos meus dados</label></div>
  </div>
  <div style="margin-top:6px"><label>Observação</label><input name="observacao" style="width:100%"></div>`;

function camposCliente(root) {
  bindMask($('[name=telefone]', root), 'fone');
  bindMask($('[name=cep]', root), 'cep');
  const doc = $('[name=documento]', root);
  doc.addEventListener('input', () => { if ($('[name=tipoDocumento]', root).value === 'CPF') doc.value = mask.cpf(doc.value); });
  $('[data-a=cep]', root).onclick = async () => {
    const cep = $('[name=cep]', root).value.replace(/\D/g, '');
    if (cep.length !== 8) return info('Informe o CEP com 8 dígitos.');
    try {
      const r = await (await fetch(`https://viacep.com.br/ws/${cep}/json/`)).json();
      if (r.erro) return info('CEP não encontrado.');
      formSet(root, { ...formGet(root), endereco: r.logradouro, bairro: r.bairro, cidade: r.localidade, estado: r.uf });
    } catch { info('Não foi possível consultar o CEP (sem internet?).'); }
  };
  $('[data-a=respAdd]', root).onclick = async () => { const c = await selecionarCliente({ titulo: 'Selecionar responsável' }); if (c) { $('[name=responsavelId]', root).value = c.id; $('#cfResp', root).value = c.nome; } };
  $('[data-a=respLimpa]', root).onclick = () => { $('[name=responsavelId]', root).value = ''; $('#cfResp', root).value = ''; };
}
function clienteBody(root) {
  const b = formGet(root);
  b.lgpd = $('[name=lgpd]', root).checked;
  b.bloqueado = $('[name=bloqueado]', root).checked;
  b.responsavelId = b.responsavelId ? Number(b.responsavelId) : null;
  delete b.tipoPessoa; delete b.tipoCliente;
  return b;
}

/** Registro de Cliente (toolbar "Clientes"): navegacao + incluir/editar/excluir, abas Principal/Financeiro. */
async function registroCliente(idInicial) {
  let atual = null, modo = 'ver';
  const corpo = h(`<div>
    <div class="navbar" style="padding:0 0 6px;border-bottom:1px solid #ddd;margin-bottom:6px">
      <button data-a="pesq"><span class="ic">🔍</span>Pesquisar</button><button data-a="novo"><span class="ic">⊕</span>Incluir</button>
      <button data-a="edit"><span class="ic">✎</span>Editar</button><button data-a="del"><span class="ic">⊖</span>Excluir</button>
      <button data-a="save"><span class="ic">💾</span>Salvar</button><button data-a="canc"><span class="ic">↺</span>Cancelar</button>
      <button data-a="first"><span class="ic">«</span>Início</button><button data-a="prev"><span class="ic">‹</span>Anterior</button>
      <button data-a="next"><span class="ic">›</span>Próximo</button><button data-a="last"><span class="ic">»</span>Fim</button>
      <span class="sp"></span><b id="rcModo" style="color:#555"></b>
    </div>
    <div class="subtabs"><span class="on" data-t="p">Principal</span><span data-t="f">Financeiro</span></div>
    <div id="rcP"><div style="background:#fff;border:1px solid #ccc;padding:4px 8px;margin-bottom:6px"><span style="background:#8b0000;color:#fff;padding:1px 22px">Id:</span> <b id="rcId">0</b> <span id="rcPos" style="float:right;color:#666"></span></div>
      <form id="rcF" onsubmit="return false">${CLIENTE_CAMPOS}</form></div>
    <div id="rcFin" hidden></div></div>`);
  const w = janela({ titulo: 'Registro de Cliente', largura: 980, corpo });
  const f = $('#rcF', corpo);
  camposCliente(f);
  const setModo = (m) => {
    modo = m;
    $('#rcModo', corpo).textContent = m === 'novo' ? 'Incluindo' : m === 'edit' ? 'Editando' : '';
    $$('input,select', f).forEach((el) => { if (el.id !== 'cfResp' && !el.disabled) el.readOnly = m === 'ver'; if (el.tagName === 'SELECT' || el.type === 'checkbox') el.style.pointerEvents = m === 'ver' ? 'none' : ''; });
    $('[data-a=save]', corpo).disabled = $('[data-a=canc]', corpo).disabled = m === 'ver';
    $$('[data-a=novo],[data-a=edit],[data-a=del],[data-a=first],[data-a=prev],[data-a=next],[data-a=last],[data-a=pesq]', corpo).forEach((b) => (b.disabled = m !== 'ver'));
  };
  const mostrar = async (id) => {
    if (!id) return;
    const c = await api(`/api/office/clientes/${id}`);
    atual = c;
    f.reset();
    formSet(f, { ...c, tipoPessoa: 'Pessoa Física', tipoCliente: 'Consumidor Final', lgpd: Boolean(c.lgpdAceiteEm) });
    $('#cfResp', f).value = c.responsavelNome || '';
    $('#rcId', corpo).textContent = c.id;
    $('#rcPos', corpo).textContent = `Registro ${c.posicao} de ${c.totalRegistros} · origem ${c.origem} · desde ${fmt.dmy(c.criadoEm)}`;
    $('#rcFin', corpo).innerHTML = `<p>Compras: <b>${c.financeiro.vendas}</b> · Total: <b>${fmt.brl(c.financeiro.total)}</b> · Última: ${fmt.dmyhm(c.financeiro.ultima)}</p>
      ${c.dependentes.length ? `<p>Dependentes: ${c.dependentes.map((d) => esc(d.nome)).join(', ')}</p>` : ''}<div id="rcHist" style="height:300px;overflow:auto;border:1px solid #ccc;background:#fff"></div>`;
    grade($('#rcHist', corpo), [{ key: 'dataHora', label: 'Data/Hora', fmt: 'dmyhm' }, { key: 'bateria', label: 'Bateria' }, { key: 'produto', label: 'Produto' }, { key: 'valor', label: 'Valor', fmt: 'money', cls: 'r' }, { key: 'pago', label: 'Pago', fmt: 'bool', cls: 'c' }, { key: 'status', label: 'Situação' }], c.historico, { vazio: 'Sem reservas.' });
    setModo('ver');
  };
  $$('.subtabs span', corpo).forEach((s) => (s.onclick = () => { $$('.subtabs span', corpo).forEach((x) => x.classList.toggle('on', x === s)); $('#rcP', corpo).hidden = s.dataset.t !== 'p'; $('#rcFin', corpo).hidden = s.dataset.t !== 'f'; }));
  const nav = async (dir) => { const r = await api(`/api/office/clientes/nav?dir=${dir}&id=${atual?.id || 0}`); if (r?.id) mostrar(r.id); };
  corpo.onclick = async (e) => {
    const a = e.target.closest('button[data-a]')?.dataset.a; if (!a || e.target.closest('button').disabled) return;
    if (a === 'pesq') { const c = await selecionarCliente({ titulo: 'Pesquisar Cliente' }); if (c) mostrar(c.id); }
    if (a === 'novo') { atual = null; f.reset(); $('#cfResp', f).value = ''; $('[name=responsavelId]', f).value = ''; $('#rcId', corpo).textContent = '0'; $('#rcPos', corpo).textContent = ''; setModo('novo'); $('[name=documento]', f).focus(); }
    if (a === 'edit' && atual) setModo('edit');
    if (a === 'canc') { if (atual) mostrar(atual.id); else { f.reset(); setModo('ver'); } }
    if (a === 'save') {
      const b = clienteBody(f);
      if (!b.nome) return info('Informe o nome.');
      if (modo === 'novo') { const r = await api('/api/office/clientes', { body: b }); await mostrar(r.id); }
      else { await api(`/api/office/clientes/${atual.id}`, { method: 'PUT', body: b }); await mostrar(atual.id); }
      info('Operação concluída com sucesso.');
    }
    if (a === 'del' && atual && (await confirmar('Deseja excluir definitivamente o registro atual?'))) { await api(`/api/office/clientes/${atual.id}`, { method: 'DELETE' }); atual = null; f.reset(); nav('last'); }
    if (['first', 'prev', 'next', 'last'].includes(a)) nav(a);
  };
  setModo('ver');
  if (idInicial) mostrar(idInicial); else nav('last');
  return w;
}

/** Janela "Pesquisar Cliente": devolve o cliente escolhido (ou null). */
function selecionarCliente({ titulo = 'Pesquisar Cliente', inicial = '' } = {}) {
  return new Promise((resolve) => {
    let escolhido = null;
    const corpo = h(`<div><div class="fg" style="grid-template-columns: 1fr auto auto auto auto auto">
      <div><label>Pesquisar</label><input id="scQ" value="${esc(inicial)}" placeholder="Digite e tecle Enter"></div>
      <label class="ck"><input type="radio" name="scC" value="auto" checked> Auto</label><label class="ck"><input type="radio" name="scC" value="nome"> Nome</label>
      <label class="ck"><input type="radio" name="scC" value="documento"> CPF/Telefone</label><label class="ck"><input type="radio" name="scC" value="email"> E-mail</label>
      <button id="scB">Pesquisar</button></div>
      <div id="scG" style="height:340px;overflow:auto;border:1px solid #ccc;background:#fff;margin-top:8px"></div></div>`);
    const w = janela({ titulo, largura: 900, corpo, aoFechar: () => resolve(escolhido),
      botoes: [['Novo cliente', async () => { const id = await novoClienteRapido($('#scQ', corpo).value); if (id) { escolhido = await api(`/api/office/clientes/${id}`); w.fechar(); } }], ['Cancelar', () => w.fechar()], ['Selecionar', () => { const s = g.sel()[0]; if (s) { escolhido = s; w.fechar(); } }, true]] });
    const cols = [{ key: 'nome', label: 'Nome', w: 240 }, { key: 'documento', label: 'Documento' }, { key: 'telefone', label: 'Telefone' }, { key: 'email', label: 'E-mail' }, { key: 'nascimento', label: 'Nascimento', fmt: 'dmy' }, { key: 'responsavelNome', label: 'Responsável' }, { key: 'bloqueado', label: 'Bloq.', fmt: 'bool', cls: 'c' }];
    const g = grade($('#scG', corpo), cols, [], { vazio: 'Digite nome, CPF, telefone ou e-mail e tecle Enter.', onDbl: (r) => { escolhido = r; w.fechar(); } });
    const buscar = async () => { const q = $('#scQ', corpo).value.trim(); if (q.length < 2) return; g.set(await api(`/api/office/clientes?q=${encodeURIComponent(q)}&campo=${$('[name=scC]:checked', corpo).value}`)); };
    $('#scB', corpo).onclick = buscar;
    $('#scQ', corpo).onkeydown = (e) => { if (e.key === 'Enter') buscar(); };
    $('#scQ', corpo).focus();
    if (inicial) buscar();
  });
}

/** Cadastro rapido (usado a partir da pesquisa). Devolve o id criado. */
function novoClienteRapido(q = '') {
  return new Promise((resolve) => {
    let id = null;
    const f = h(`<form onsubmit="return false">${CLIENTE_CAMPOS}</form>`);
    const w = janela({ titulo: 'Registro de Cliente (novo)', largura: 980, corpo: f, aoFechar: () => resolve(id),
      botoes: [['Cancelar', () => w.fechar()], ['Salvar', async () => { const b = clienteBody(f); if (!b.nome) return info('Informe o nome.'); const r = await api('/api/office/clientes', { body: b }); id = r.id; w.fechar(); }, true]] });
    camposCliente(f);
    if (/\d{5,}/.test(q)) { $('[name=documento]', f).value = mask.cpf(q); } else if (q.includes('@')) $('[name=email]', f).value = q; else $('[name=nome]', f).value = q;
    $('[name=lgpd]', f).checked = true;
    $('[name=documento]', f).focus();
  });
}

// =====================================================================================
// BATERIAS
// =====================================================================================
const optProdutos = (sel) => App.apoio.produtos.filter((p) => p.ativo || p.id === sel).map((p) => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.nome)} — ${fmt.brl(p.preco)}</option>`).join('');
const optTracados = (sel) => App.apoio.tracados.map((t) => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${esc(t.nome)}</option>`).join('');

function camposBateria(b = {}) {
  return `<div class="fg" style="grid-template-columns: 2fr 1fr 90px 110px">
      <div><label>Nome da reserva *</label><input name="nome" value="${esc(b.nome || '')}"></div>
      <div><label>Data</label><input type="date" name="data" value="${(b.dataHora || '').slice(0, 10) || hoje()}"></div>
      <div><label>Hora</label><input type="time" name="hora" value="${(b.dataHora || '').slice(11, 16) || '17:00'}"></div>
      <div><label>Competidores (máx) *</label><input name="vagas" type="number" min="1" value="${b.vagas ?? 30}"></div>
    </div>
    <div class="fg" style="grid-template-columns: 2fr 1fr 150px; margin-top:6px">
      <div><label>PRODUTO *</label><select name="produtoId">${optProdutos(b.produtoId)}</select></div>
      <div><label>TRAÇADO *</label><select name="tracadoId"><option value=""></option>${optTracados(b.tracadoId ?? App.apoio.tracados[0]?.id)}</select></div>
      <div><label>TEMPO MÍNIMO POR VOLTA (seg)</label><input name="voltaMinimaSeg" type="number" min="0" value="${b.voltaMinimaSeg ?? 5}"></div>
    </div>
    <fieldset style="margin-top:8px"><legend>RESPONSÁVEL PELA RESERVA</legend><div class="fg" style="grid-template-columns: 1fr auto auto 140px auto">
      <div><input id="fbResp" readonly value="${esc(b.responsavel || '')}"><input type="hidden" name="responsavelId" value="${b.responsavelId || ''}"></div>
      <button type="button" data-a="resp">Pesquisar cliente</button><button type="button" data-a="respX">✕</button>
      <div><label>Código de reserva</label><input name="codigoReserva" value="${esc(b.codigoReserva || '')}"></div><button type="button" data-a="cod">Gerar</button>
    </div></fieldset>
    <div class="fg" style="grid-template-columns: auto auto 1fr">
      <label class="ck"><input type="checkbox" name="reservaFechada" ${b.reservaFechada ? 'checked' : ''}> Reserva fechada (grupo/evento, não aparece no totem)</label>
      <label class="ck"><input type="checkbox" name="autoAtendimento" ${b.autoAtendimento === false || b.autoAtendimento === 0 ? '' : 'checked'}> Aparece no autoatendimento</label><div></div>
    </div>
    <div style="margin-top:6px"><label>Observações</label><input name="observacao" style="width:100%" value="${esc(b.observacao || '')}"></div>`;
}
function ligarCamposBateria(root) {
  $('[data-a=resp]', root).onclick = async () => { const c = await selecionarCliente({ titulo: 'Responsável pela reserva' }); if (c) { $('[name=responsavelId]', root).value = c.id; $('#fbResp', root).value = c.nome; } };
  $('[data-a=respX]', root).onclick = () => { $('[name=responsavelId]', root).value = ''; $('#fbResp', root).value = ''; };
  $('[data-a=cod]', root).onclick = () => { $('[name=codigoReserva]', root).value = Math.random().toString(36).slice(2, 8).toUpperCase(); };
}
function bateriaBody(root) {
  const b = formGet(root);
  return { nome: b.nome, inicio: `${b.data}T${b.hora}`, vagas: Number(b.vagas), produtoId: Number(b.produtoId), tracadoId: b.tracadoId ? Number(b.tracadoId) : null, voltaMinimaSeg: Number(b.voltaMinimaSeg || 0),
    responsavelId: b.responsavelId ? Number(b.responsavelId) : null, codigoReserva: b.codigoReserva, reservaFechada: b.reservaFechada, autoAtendimento: b.autoAtendimento, observacao: b.observacao };
}

/** Toolbar "Reservas" = FormCreateBooking: gerar pela configuracao padrao ou criar uma bateria avulsa. */
function criarReservas() {
  const mes0 = hoje().slice(0, 8) + '01';
  const fimMes = (() => { const d = new Date(mes0 + 'T12:00:00'); d.setMonth(d.getMonth() + 1); d.setDate(0); return d.toISOString().slice(0, 10); })();
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const corpo = h(`<div>
    <label class="ck" style="font-weight:700"><input type="radio" name="cmModo" value="padrao" checked> USAR CONFIGURAÇÕES DO SISTEMA:</label>
    <fieldset id="cmPad"><div class="fg" style="grid-template-columns: 2fr 1fr 1fr">
      <div><label>Configuração padrão</label><select id="cmPadrao">${App.apoio.padroes.map((p) => `<option value="${p.id}">${esc(p.nome)}</option>`).join('')}</select></div>
      <div><label>De</label><input type="date" id="cmDe" value="${hoje()}"></div><div><label>Até</label><input type="date" id="cmAte" value="${fimMes}"></div></div>
      <div style="display:flex;gap:12px;margin-top:8px;flex-wrap:wrap">${dias.map((d, i) => `<label class="ck"><input type="checkbox" class="cmDia" value="${i}"> ${d}</label>`).join('')}</div>
      <p style="color:#666;margin:6px 0 0">Feriados cadastrados e horários que já existem são pulados. <a href="#" id="cmVerPad">Ver/editar padrões</a></p></fieldset>
    <label class="ck" style="font-weight:700;margin-top:6px"><input type="radio" name="cmModo" value="avulsa"> USAR CONFIGURAÇÕES ABAIXO:</label>
    <fieldset id="cmAv" disabled><form id="cmF" onsubmit="return false">${camposBateria({ nome: '' })}</form></fieldset></div>`);
  const w = janela({ titulo: 'Criar Reservas', largura: 820, corpo, botoes: [['Cancelar', () => w.fechar()], ['Gerar Reservas do Mês', gerarMes, true], ['Gerar Reserva', gerarUma, true]] });
  ligarCamposBateria($('#cmF', corpo));
  $$('[name=cmModo]', corpo).forEach((r) => (r.onchange = () => { const pad = $('[name=cmModo]:checked', corpo).value === 'padrao'; $('#cmPad', corpo).disabled = !pad; $('#cmAv', corpo).disabled = pad; }));
  $('#cmVerPad', corpo).onclick = (e) => { e.preventDefault(); cadastro('padroes'); };
  async function gerarMes() {
    if ($('[name=cmModo]:checked', corpo).value !== 'padrao') return info('Marque "USAR CONFIGURAÇÕES DO SISTEMA" para gerar pelo padrão.');
    const diasSel = $$('.cmDia:checked', corpo).map((c) => Number(c.value));
    if (!diasSel.length) return info('Selecione pelo menos um dia da semana antes de criar as reservas.');
    const r = await api('/api/office/baterias/gerar', { body: { padraoId: Number($('#cmPadrao', corpo).value), de: $('#cmDe', corpo).value, ate: $('#cmAte', corpo).value, diasSemana: diasSel } });
    await info(r.criadas ? `${r.criadas} reservas geradas com sucesso.` : 'Nenhuma reserva gerada.');
    w.fechar(); recarregar();
  }
  async function gerarUma() {
    if ($('[name=cmModo]:checked', corpo).value !== 'avulsa') return info('Marque "USAR CONFIGURAÇÕES ABAIXO" para criar uma reserva avulsa.');
    const b = bateriaBody($('#cmF', corpo));
    if (!b.nome) return info('Insira um nome para a reserva.');
    await api('/api/office/baterias', { body: b });
    await info('Reserva gerada com sucesso.');
    w.fechar(); recarregar();
  }
}

async function formBateria(b) {
  const f = h(`<form onsubmit="return false">${camposBateria(b)}</form>`);
  const w = janela({ titulo: 'Editar Bateria', largura: 820, corpo: f, botoes: [['Cancelar', () => w.fechar()], ['Salvar', async () => {
    const body = bateriaBody(f);
    if (!body.nome) return info('Insira um nome.');
    await api(`/api/office/baterias/${b.id}`, { method: 'PUT', body });
    await info('Bateria editada com sucesso!'); w.fechar(); recarregar();
  }, true]] });
  ligarCamposBateria(f);
}
async function statusBateria(sel, status) {
  for (const b of sel) await api(`/api/office/baterias/${b.id}/status`, { body: { status } });
  recarregar();
}
async function excluirBaterias(sel, todas) {
  if (!sel.length) return;
  const txt = todas ? 'Deseja excluir definitivamente *** TODAS *** as baterias listadas?' : sel.length === 1 ? `Deseja excluir definitivamente a bateria atual?\n${sel[0].nome} ${fmt.dmyhm(sel[0].dataHora)}` : `Deseja excluir as ${sel.length} baterias selecionadas?`;
  if (!(await confirmar(txt))) return;
  let erros = 0;
  for (const b of sel) await api(`/api/office/baterias/${b.id}`, { method: 'DELETE', quiet: sel.length > 1 }).catch(() => erros++);
  if (erros) await info(`${erros} bateria(s) não foram excluídas porque têm reservas pagas.`);
  recarregar();
}

/** Incluir Cliente na bateria (FormIncludeCustomerBooking): cliente + numero de participantes. */
async function incluirCliente(b) {
  let cli = null;
  const corpo = h(`<div><p><b>${esc(b.nome)}</b> · ${fmt.dmyhm(b.dataHora)} · vagas disponíveis: <b>${b.disponiveis}</b></p>
    <div class="fg" style="grid-template-columns: 1fr auto 110px"><div><label>Cliente</label><input id="icC" readonly placeholder="Pesquise o cliente"></div><button id="icP">Pesquisar Cliente</button>
    <div><label>PARTICIPANTES</label><input id="icN" type="number" min="1" value="1"></div></div>
    <div style="margin-top:6px"><label>Observação</label><input id="icO" style="width:100%"></div>
    <p style="color:#666">Com mais de 1 participante, as vagas ficam no nome do cliente; depois use "Alterar Cliente" em cada reserva para colocar o nome de quem vai correr.</p></div>`);
  const w = janela({ titulo: 'Registra Reserva por Cliente', largura: 640, corpo, botoes: [['Cancelar', () => w.fechar()], ['Reservar', async () => {
    if (!cli) return info('Selecione um cliente.');
    const r = await api(`/api/office/baterias/${b.id}/incluir`, { body: { clienteId: cli.id, participantes: Number($('#icN', corpo).value), observacao: $('#icO', corpo).value } });
    await info(r.mensagem); w.fechar(); recarregar();
  }, true]] });
  $('#icP', corpo).onclick = async () => { const c = await selecionarCliente(); if (c) { cli = c; $('#icC', corpo).value = `${c.nome} — ${c.documento || ''}`; } };
  $('#icP', corpo).click();
}

// =====================================================================================
// RESERVAS: acoes
// =====================================================================================
async function aprovarPre(sel) {
  const pre = sel.filter((r) => !r.aprovada && r.status !== 'cancelada');
  if (!(await confirmar(`Deseja aprovar a pré-reserva? (${pre.length})`))) return;
  for (const r of pre) await api(`/api/office/reservas/${r.id}/aprovar`, { body: {} });
  recarregar();
}
async function editarReserva(r) {
  const corpo = h(`<div><p><b>${esc(r.cliente)}</b> · ${esc(r.reserva)} ${fmt.dmyhm(r.dataHora)}</p><div class="fg" style="grid-template-columns: 2fr 1fr 90px">
    <div><label>Produto</label><select id="erP" ${r.pago ? 'disabled' : ''}>${optProdutos(r.produtoId)}</select></div><div><label>Categoria</label><input value="${esc(r.categoria || '')}" disabled></div>
    <div><label>Kart</label><input id="erK" value="${esc(r.kart || '')}"></div></div>
    <div style="margin-top:6px"><label>Observação</label><input id="erO" style="width:100%" value="${esc(r.observacao || '')}"></div>${r.pago ? '<p style="color:#666">Reserva paga: o produto não pode ser trocado (estorne antes).</p>' : ''}</div>`);
  const w = janela({ titulo: 'Editar Reserva', largura: 620, corpo, botoes: [['Cancelar', () => w.fechar()], ['Salvar', async () => {
    const body = { observacao: $('#erO', corpo).value, kart: $('#erK', corpo).value };
    if (!r.pago) body.produtoId = Number($('#erP', corpo).value);
    await api(`/api/office/reservas/${r.id}`, { method: 'PUT', body }); w.fechar(); recarregar();
  }, true]] });
}
async function alterarCliente(r) {
  const c = await selecionarCliente({ titulo: `Alterar Cliente — ${r.cliente}` });
  if (!c) return;
  const x = await api(`/api/office/reservas/${r.id}/alterar-cliente`, { body: { clienteId: c.id } });
  await info(x.mensagem); recarregar();
}
async function moverCliente(r) {
  const lista = await api(`/api/office/baterias?status=abertas&filtro=apartir&data=${hoje()}`);
  const corpo = h(`<div><p>Mover <b>${esc(r.cliente)}</b> de <b>${esc(r.reserva)} ${fmt.dmyhm(r.dataHora)}</b> para:</p>
    <label>Bateria destino</label><select id="mvD" style="width:100%">${lista.filter((b) => b.id !== r.bateriaId).map((b) => `<option value="${b.id}">${fmt.dmyhm(b.dataHora)} · ${esc(b.nome)} · ${esc(b.produto || '')} · ${b.disponiveis} vagas</option>`).join('')}</select></div>`);
  const w = janela({ titulo: 'Mover Cliente para Reserva', largura: 640, corpo, botoes: [['Cancelar', () => w.fechar()], ['Mover', async () => {
    const x = await api(`/api/office/reservas/${r.id}/mover`, { body: { bateriaId: Number($('#mvD', corpo).value) } });
    await info(x.mensagem); w.fechar(); recarregar();
  }, true]] });
}
async function excluirReservas(sel) {
  if (sel.some((r) => r.pago)) return info('Não é permitido excluir reservas pagas!');
  if (!(await confirmar(sel.length > 1 ? 'Deseja realmente excluir as reservas agendadas?' : 'Deseja realmente excluir a reserva agendada?'))) return;
  for (const r of sel) await api(`/api/office/reservas/${r.id}`, { method: 'DELETE' });
  recarregar();
}
async function imprimirTermo(ids) {
  if (!ids.length) return;
  const r = await api(`/api/office/termo-link?ids=${ids.join(',')}`);
  window.open(r.url, '_blank', 'width=420,height=700');
  setTimeout(recarregar, 2500);
}

// =====================================================================================
// AGENDA
// =====================================================================================
async function agenda() {
  let mes = hoje().slice(0, 7), dia = hoje(), bat = null, cli = null, baterias = [];
  const corpo = h(`<div style="display:grid;grid-template-columns: 430px 1fr;gap:12px">
    <div><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><button id="agA">◀</button><b id="agM"></b><button id="agP">▶</button></div>
      <div id="agCal" class="cal"></div>
      <fieldset style="margin-top:10px"><legend>INFORMAÇÕES DA BATERIA</legend><div id="agInfo" style="min-height:90px;color:#333">Selecione uma bateria.</div></fieldset></div>
    <div>
      <div class="fg" style="grid-template-columns: 1fr auto"><div><label>Baterias disponíveis</label><select id="agB"></select></div><button id="agEd">Editar Bateria</button></div>
      <fieldset style="margin-top:8px"><legend>Pesquisar Cliente</legend>
        <div style="display:flex;gap:12px;margin-bottom:4px"><label class="ck"><input type="radio" name="agC" value="documento" checked> CPF</label><label class="ck"><input type="radio" name="agC" value="email"> E-mail</label><label class="ck"><input type="radio" name="agC" value="nome"> Nome</label></div>
        <div class="fg" style="grid-template-columns: 1fr auto auto"><input id="agQ"><button id="agS">Pesquisar</button><button id="agNovo">Novo cliente</button></div>
        <div style="margin-top:4px"><b id="agCli" style="color:#0063b1"></b></div></fieldset>
      <div class="fg" style="grid-template-columns: 110px 1fr auto;margin-top:6px"><div><label>PARTICIPANTES</label><input id="agN" type="number" min="1" value="1"></div>
        <div><label>OBSERVAÇÕES</label><input id="agO"></div><button id="agR" class="pri">Reservar</button></div>
      <div style="margin-top:8px;font-weight:700">Reservas da bateria</div>
      <div id="agG" style="height:260px;overflow:auto;border:1px solid #ccc;background:#fff"></div></div></div>`);
  const w = janela({ titulo: 'Agenda de Reservas de Bateria', largura: 1180, corpo, botoes: [['Agenda Mensal', () => openReport(`/relatorio/agenda?mes=${mes}`)], ['Fechar', () => { w.fechar(); recarregar(); }]] });
  const gR = grade($('#agG', corpo), [{ key: 'cliente', label: 'Cliente', w: 220 }, { key: 'pago', label: 'Pago', fmt: 'bool', cls: 'c' }, { key: 'aprovada', label: 'Aprovada', fmt: 'bool', cls: 'c' }, { key: 'produto', label: 'Produto' }, { key: 'total', label: 'Total', fmt: 'money', cls: 'r' }], [],
    { vazio: 'Nenhuma reserva.', onCtx: (sel, e) => ctxMenu(e.clientX, e.clientY, [{ label: 'Aprovar / Receber', fn: () => checkoutDeReservas(sel).then(recarregaReservas), dis: sel.some((r) => r.pago) }, { label: 'Imprimir Termo', fn: () => imprimirTermo(sel.map((r) => r.id)) }, { label: 'Excluir', fn: async () => { await excluirReservas(sel); recarregaReservas(); } }]) });
  const cal = async () => {
    const d0 = new Date(mes + '-01T12:00:00');
    $('#agM', corpo).textContent = d0.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase());
    const resumo = Object.fromEntries((await api(`/api/office/agenda?mes=${mes}`)).map((x) => [x.dia, x]));
    const ini = new Date(d0); ini.setDate(1 - d0.getDay());
    let html = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((x) => `<div class="h">${x}</div>`).join('');
    for (let i = 0; i < 42; i++) {
      const d = new Date(ini); d.setDate(ini.getDate() + i);
      const iso = d.toISOString().slice(0, 10), r = resumo[iso];
      html += `<div class="d${iso.slice(0, 7) !== mes ? ' out' : ''}${iso === dia ? ' sel' : ''}" data-d="${iso}"><b>${d.getDate()}</b>${r ? `<div class="x">${r.baterias} bat · ${r.reservas}/${r.vagas}</div>` : ''}</div>`;
    }
    $('#agCal', corpo).innerHTML = html;
    $$('.d', corpo).forEach((el) => (el.onclick = () => { dia = el.dataset.d; mes = dia.slice(0, 7); cal(); carregaDia(); }));
  };
  const carregaDia = async () => {
    baterias = await api(`/api/office/baterias?status=todas&filtro=dia&data=${dia}`);
    $('#agB', corpo).innerHTML = baterias.map((b) => `<option value="${b.id}">${fmt.hm(b.dataHora)} · ${esc(b.nome)} · ${b.disponiveis} vagas${b.status !== 'aberta' ? ' (fechada)' : ''}</option>`).join('') || '<option value="">Nenhuma bateria neste dia</option>';
    const agora = hoje() + 'T' + new Date().toTimeString().slice(0, 5);
    const prox = baterias.find((b) => b.dataHora >= agora) || baterias[0];
    if (prox) $('#agB', corpo).value = prox.id;
    escolheBat();
  };
  const escolheBat = () => {
    bat = baterias.find((b) => String(b.id) === $('#agB', corpo).value) || null;
    $('#agInfo', corpo).innerHTML = bat ? `<b>${esc(bat.nome)}</b> — ${fmt.dmyhm(bat.dataHora)}<br>PRODUTO: ${esc(bat.produto || '—')}<br>TRAÇADO: ${esc(bat.tracado || '—')}<br>TEMPO MÍNIMO POR VOLTA (segundos): ${bat.voltaMinimaSeg}<br>
      COMPETIDORES: ${bat.inscritos}/${bat.vagas} (disponíveis ${bat.disponiveis}) · pagos ${bat.pagos}${bat.observacao ? `<br>OBSERVAÇÕES: ${esc(bat.observacao)}` : ''}` : 'Selecione uma bateria.';
    recarregaReservas();
  };
  const recarregaReservas = async () => { gR.set(bat ? await api(`/api/office/reservas?status=todas&bateriaId=${bat.id}`) : []); };
  $('#agB', corpo).onchange = escolheBat;
  $('#agA', corpo).onclick = () => { const d = new Date(mes + '-15T12:00:00'); d.setMonth(d.getMonth() - 1); mes = d.toISOString().slice(0, 7); cal(); };
  $('#agP', corpo).onclick = () => { const d = new Date(mes + '-15T12:00:00'); d.setMonth(d.getMonth() + 1); mes = d.toISOString().slice(0, 7); cal(); };
  $('#agEd', corpo).onclick = () => bat && formBateria(bat);
  const pesquisa = async () => { const c = await selecionarCliente({ inicial: $('#agQ', corpo).value }); if (c) { cli = c; $('#agCli', corpo).textContent = `${c.nome} · ${c.documento || ''}`; } };
  $('#agS', corpo).onclick = pesquisa;
  $('#agQ', corpo).onkeydown = (e) => { if (e.key === 'Enter') pesquisa(); };
  $('#agNovo', corpo).onclick = async () => { const id = await novoClienteRapido($('#agQ', corpo).value); if (id) { cli = await api(`/api/office/clientes/${id}`); $('#agCli', corpo).textContent = `${cli.nome} · ${cli.documento || ''}`; } };
  $('#agR', corpo).onclick = async () => {
    if (!bat) return info('Selecione uma bateria.');
    if (!cli) return info('Selecione um cliente.');
    const n = Number($('#agN', corpo).value);
    if (!(n > 0)) return info("O campo 'PARTICIPANTES' deve ser maior que 0.");
    const r = await api(`/api/office/baterias/${bat.id}/incluir`, { body: { clienteId: cli.id, participantes: n, observacao: $('#agO', corpo).value } });
    await info(r.mensagem);
    cli = null; $('#agCli', corpo).textContent = ''; $('#agQ', corpo).value = ''; $('#agN', corpo).value = 1; $('#agO', corpo).value = '';
    await carregaDia();
    $('#agB', corpo).value = r.ids ? bat.id : ''; escolheBat();
  };
  await cal();
  await carregaDia();
}

// =====================================================================================
// CAIXA: TERMINAL / SUPRIMENTO / SANGRIA
// =====================================================================================
async function garantirTerminal() {
  const c = await api('/api/office/caixa');
  if (c.aberto) return c;
  if (!(await confirmar('O terminal ainda não foi aberto, deseja abrir agora?'))) return null;
  const ok = await abrirTerminal(c);
  return ok ? api('/api/office/caixa') : null;
}
function abrirTerminal(c) {
  return new Promise((resolve) => {
    let ok = false;
    const corpo = h(`<div class="fg" style="grid-template-columns: 150px 180px">
      <label>Usuário:</label><b style="font-size:17px">${esc(Sess.user.nome)}</b>
      <label>Turnos Disponíveis:</label><select id="atT"><option value=""></option>${c.turnos.map((t) => `<option value="${t.id}">${esc(t.descricao)}</option>`).join('')}</select>
      <label>Terminais Disponíveis:</label><select id="atM"><option value=""></option>${c.terminais.map((t) => `<option value="${t.id}">${esc(t.nome)}</option>`).join('')}</select>
      <label>Suprimento Inicial (R$):</label><input id="atS" value="0"></div>`);
    const w = janela({ titulo: 'Terminal', largura: 380, corpo, aoFechar: () => resolve(ok), botoes: [['Abrir Terminal', async () => {
      if (!$('#atT', corpo).value) return info('Selecione o turno que será aberto o terminal.');
      if (!$('#atM', corpo).value) return info('Selecione um terminal para abrir.');
      const v = toCents($('#atS', corpo).value); if (Number.isNaN(v)) return info('Valor inválido.');
      const r = await api('/api/office/caixa/abrir', { body: { turnoId: Number($('#atT', corpo).value), terminalId: Number($('#atM', corpo).value), inicialCentavos: v } });
      ok = true; await info(r.mensagem); w.fechar();
    }, true]] });
    if (c.turnos.length === 1) $('#atT', corpo).value = c.turnos[0].id;
  });
}
async function terminal() {
  const c = await api('/api/office/caixa');
  if (!c.aberto) { if (await abrirTerminal(c)) recarregar(); return; }
  const s = c.sumario;
  const linhas = [['Total de Início do Turno:', s.inicial], ['Total de Suprimento:', s.suprimento], ['Total de Sangria:', s.sangria], ['Total de Vendas de Produtos:', s.vendasProdutos], ['Total de Vendas:', s.vendas],
    ['Total de Desconto Fornecido:', s.desconto], ['Total de Acréscimos:', s.acrescimos], ['Total Recebido:', s.recebido], ['Total de Troco Fornecido:', s.troco], ['Total Cancelado:', s.cancelado]];
  const corpo = h(`<div><div class="fg" style="grid-template-columns: 90px 1fr 80px 1fr;align-items:center"><label>Usuário:</label><b style="font-size:16px">${esc(Sess.user.nome)}</b><span></span><span></span>
    <label>Terminal:</label><b style="font-size:16px">${esc(c.aberto.terminal)}</b><label>Abertura:</label><b style="font-size:16px">${fmt.dmyhm(c.aberto.abertoEm)}</b></div>
    <fieldset style="margin-top:8px"><legend>Sumário</legend><div class="kv">${linhas.map(([l, v]) => `<span>${l}</span><b>${fmt.brl(v)}</b>`).join('')}
      <span>Total Final:</span><b style="color:#107c10">${fmt.brl(s.final)}</b><span style="color:#555">Dinheiro em caixa (gaveta):</span><b style="font-size:13px">${fmt.brl(s.dinheiroEmCaixa)}</b></div></fieldset>
    <div style="display:flex;justify-content:flex-end;margin:6px 0"><button id="ftR">Gerar Relatório</button></div>
    <div class="fg" style="grid-template-columns: 1fr 140px"><label style="text-align:right;padding-top:4px">Valor para o Próximo Turno:</label><input id="ftP" value="0"></div></div>`);
  const w = janela({ titulo: 'Terminal', largura: 440, corpo, botoes: [['Cancelar', () => w.fechar()], ['Fechar Terminal', async () => {
    const v = toCents($('#ftP', corpo).value); if (Number.isNaN(v)) return info('Valor inválido.');
    if (!(await confirmar('Deseja fechar o terminal?'))) return;
    const r = await api('/api/office/caixa/fechar', { body: { proximoTurnoCentavos: v } });
    await info(r.mensagem); w.fechar();
    openReport(`/relatorio/fechamento?mov=${r.id}`);
  }, true]] });
  $('#ftR', corpo).onclick = () => openReport(`/relatorio/fechamento?mov=${c.aberto.id}`);
}
async function transacaoCaixa(tipo) {
  const c = await garantirTerminal();
  if (!c) return;
  const corpo = h(`<div><div class="fg" style="grid-template-columns: 110px 1fr;align-items:center"><label>Usuário:</label><b style="font-size:17px">${esc(Sess.user.nome)}</b>
    <label>Terminal ativo:</label><b style="font-size:17px">${esc(c.aberto.terminal)}</b><label>Quantia em caixa:</label><b style="font-size:17px;color:#107c10">${fmt.brl(c.sumario.dinheiroEmCaixa)}</b></div>
    <fieldset style="margin-top:10px"><legend>Nova Transação</legend><div class="fg" style="grid-template-columns: 80px 1fr"><label>Valor (R$):</label><input id="tcV"></div>
    <label style="display:block;margin-top:6px">Observações:</label><textarea id="tcO" rows="4" style="width:100%"></textarea></fieldset></div>`);
  const w = janela({ titulo: tipo === 'sangria' ? 'Registrar Sangria' : 'Registrar Suprimento', largura: 320, corpo, botoes: [['Cancelar', () => w.fechar()], ['Registrar Transação', async () => {
    const v = toCents($('#tcV', corpo).value); if (!(v > 0)) return info('Informe o valor.');
    if (!$('#tcO', corpo).value.trim()) return info('Informe a justificativa desta transação.');
    const r = await api('/api/office/caixa/transacao', { body: { tipo, valorCentavos: v, observacao: $('#tcO', corpo).value } });
    await info(r.mensagem); w.fechar();
  }, true]] });
  $('#tcV', corpo).focus();
}

// =====================================================================================
// CHECKOUT (Aprovar reserva / Receita Avulsa)
// =====================================================================================
async function checkoutDeReservas(reservas) {
  if (!reservas.length) return;
  const bat = reservas[0].bateriaId;
  return checkout({ bateriaId: bat, reservaIds: reservas.filter((r) => r.bateriaId === bat).map((r) => r.id), clienteId: reservas[0].clienteId });
}

async function checkout({ bateriaId = null, reservaIds = [], clienteId = null }) {
  const caixa = await garantirTerminal();
  if (!caixa) return;
  let cliente = clienteId ? await api(`/api/office/clientes/${clienteId}`) : null;
  let disponiveis = [];
  const carrinho = []; // {k, inscricaoId, produtoId, cliente, produto, quantidade, unit, descPct, desc, acrPct, acr}
  const pagamentos = []; // {formaPagamentoId, forma, valor}
  let voucher = null;
  let concluido = false;
  const batHoje = await api(`/api/office/baterias?status=todas&filtro=dia&data=${hoje()}`);
  if (bateriaId && !batHoje.some((b) => b.id === bateriaId)) { const x = await api(`/api/office/baterias?status=todas&filtro=todas`).then((l) => l.find((b) => b.id === bateriaId)).catch(() => null); if (x) batHoje.unshift(x); }
  const corpo = h(`<div style="display:grid;grid-template-columns: minmax(0,1fr) 230px;gap:14px">
   <div>
    <div class="fg" style="grid-template-columns: 60px minmax(0,1.2fr) 55px minmax(0,1.4fr) 76px minmax(0,1fr) auto;align-items:center">
      <label>Bateria</label><select id="coB"><option value="">— sem bateria —</option>${batHoje.map((b) => `<option value="${b.id}">${fmt.hm(b.dataHora)} ${esc(b.nome)}</option>`).join('')}</select>
      <label>Cliente:</label><b id="coC"></b><label>Documento:</label><b id="coD"></b><button id="coPC">🔍 Pesquisar Cliente</button></div>
    <label style="display:block;margin-top:6px">Observações</label><textarea id="coO" rows="2" style="width:100%"></textarea>
    <div style="display:grid;grid-template-columns: minmax(0,1fr) 34px minmax(0,1.5fr);gap:6px;margin-top:6px">
      <div><div style="text-align:right;font-weight:700">Reservas disponíveis</div><div id="coRD" style="height:250px;overflow:auto;border:1px solid #999;background:#fff"></div></div>
      <div style="display:flex;flex-direction:column;justify-content:center;gap:10px"><button id="coAdd" title="Adicionar ao carrinho">→</button><button id="coRem" title="Voltar para disponíveis">←</button><button id="coDel" title="Remover do carrinho">🗑</button></div>
      <div><div style="font-weight:700">Carrinho</div><div id="coCar" style="height:250px;overflow:auto;border:1px solid #999;background:#fff"></div></div></div>
    <div style="display:grid;grid-template-columns: minmax(0,1fr) minmax(0,1.5fr);gap:6px;margin-top:8px">
      <div><b>Checkout</b><div class="fg" style="grid-template-columns: 1fr 100px;margin-top:40px"><div><label>Forma de pagamento</label><select id="coF">${App.apoio.formas.map((f) => `<option value="${f.id}">${esc(f.nome)}</option>`).join('')}</select></div>
        <div><label>Valor</label><input id="coV"></div></div><div style="display:flex;justify-content:flex-end;gap:6px;margin-top:6px"><button id="coPR">Remover</button><button id="coPA">Adicionar</button></div></div>
      <div id="coPg" style="height:130px;overflow:auto;border:1px solid #999;background:#fff"></div></div>
    <div style="display:flex;gap:8px;margin-top:8px;align-items:center"><button id="coAP">Adicionar Produtos</button><span style="flex:1"></span><button id="coDesc">Aplicar Desconto</button><button id="coAcr">Aplicar Acréscimo</button>
      <input id="coVc" placeholder="Código do Voucher" style="width:140px"><button id="coVA">Aplicar Voucher</button></div>
   </div>
   <div><div class="bigtot"><div class="l">TOTAL</div><div class="v" id="tTot">0,00</div></div><div class="bigtot"><div class="l">DESCONTO (R$)</div><div class="v red" id="tDes">0,00</div></div>
    <div class="bigtot"><div class="l">ACRÉSCIMO (R$)</div><div class="v red" id="tAcr">0,00</div></div><div class="bigtot"><div class="l">SUBTOTAL</div><div class="v green" id="tSub">0,00</div></div>
    <div class="bigtot"><div class="l">VALOR RECEBIDO</div><div class="v" id="tRec">0,00</div></div><div class="bigtot"><div class="l">TROCO</div><div class="v" id="tTro">0,00</div></div>
    <button class="aprovar" id="coOK">Aprovar</button><p style="color:#666;text-align:center">Terminal ${esc(caixa.aberto.terminal)}</p></div></div>`);
  const w = janela({ titulo: reservaIds.length ? 'Aprovar Reserva' : 'Receita Avulsa', largura: Math.min(1340, innerWidth - 20), corpo, aoFechar: () => { if (concluido) recarregar(); } });
  const gD = grade($('#coRD', corpo), [{ key: 'reserva', label: 'Reserva' }, { key: 'cliente', label: 'Cliente', w: 150 }, { key: 'produto', label: 'Produto' }, { key: 'categoria', label: 'Categoria' }, { key: 'aprovada', label: 'Aprov.', fmt: 'bool', cls: 'c' }], [], { multi: true, vazio: 'Nenhuma reserva a pagar.', onDbl: (r) => { add([r]); } });
  const gC = grade($('#coCar', corpo), [{ key: 'cliente', label: 'Cliente', w: 140 }, { key: 'produto', label: 'Produto', w: 140 }, { key: 'quantidade', label: 'Quantidade', cls: 'r' }, { key: 'unit', label: 'Preço', fmt: 'money', cls: 'r' },
    { key: 'descPct', label: 'Desconto (%)', cls: 'r' }, { key: 'desc', label: 'Desconto (R$)', fmt: 'money', cls: 'r' }, { key: 'acrPct', label: 'Acréscimo (%)', cls: 'r' }, { key: 'acr', label: 'Acréscimo (R$)', fmt: 'money', cls: 'r' }], [], { vazio: '' });
  const gP = grade($('#coPg', corpo), [{ key: 'forma', label: 'Método de Pagamento', w: 200 }, { key: 'valor', label: 'Valor (R$)', fmt: 'money', cls: 'r' }], [], { vazio: '' });
  const totais = () => {
    const tot = carrinho.reduce((s, i) => s + i.unit * i.quantidade, 0), des = carrinho.reduce((s, i) => s + i.desc, 0), acr = carrinho.reduce((s, i) => s + i.acr, 0);
    const sub = tot - des + acr, rec = pagamentos.reduce((s, p) => s + p.valor, 0);
    return { tot, des, acr, sub, rec, troco: Math.max(0, rec - sub), falta: Math.max(0, sub - rec) };
  };
  const refresh = () => {
    gD.set(disponiveis.filter((r) => !carrinho.some((c) => c.inscricaoId === r.id)));
    gC.set(carrinho.map((c) => ({ ...c, id: c.k })));
    gP.set(pagamentos.map((p, i) => ({ ...p, id: i })));
    const t = totais();
    $('#tTot', corpo).textContent = fmt.money(t.tot); $('#tDes', corpo).textContent = fmt.money(t.des); $('#tAcr', corpo).textContent = fmt.money(t.acr);
    $('#tSub', corpo).textContent = fmt.money(t.sub); $('#tRec', corpo).textContent = fmt.money(t.rec); $('#tTro', corpo).textContent = fmt.money(t.troco);
    $('#coV', corpo).value = t.falta ? fmt.money(t.falta) : '';
    $('#coC', corpo).textContent = cliente?.nome || ''; $('#coD', corpo).textContent = cliente?.documento || '';
  };
  let seq = 1;
  const add = (rs) => {
    for (const r of rs) if (!carrinho.some((c) => c.inscricaoId === r.id)) carrinho.push({ k: seq++, inscricaoId: r.id, produtoId: r.produtoId, cliente: r.cliente, produto: r.produto, quantidade: 1, unit: r.preco ?? 0, descPct: 0, desc: r.desconto || 0, acrPct: 0, acr: 0 });
    if (!cliente && rs[0]) api(`/api/office/clientes/${rs[0].clienteId}`).then((c) => { cliente = c; refresh(); });
    refresh();
  };
  const carregaDisp = async () => {
    const b = $('#coB', corpo).value;
    disponiveis = b ? (await api(`/api/office/reservas?status=todas&bateriaId=${b}`)).filter((r) => !r.pago && r.status !== 'cancelada') : [];
    refresh();
  };
  $('#coB', corpo).onchange = carregaDisp;
  $('#coPC', corpo).onclick = async () => { const c = await selecionarCliente(); if (c) { cliente = c; refresh(); } };
  $('#coAdd', corpo).onclick = () => add(gD.sel());
  $('#coRem', corpo).onclick = $('#coDel', corpo).onclick = () => { for (const s of gC.sel()) carrinho.splice(carrinho.findIndex((c) => c.k === s.id), 1); if (!carrinho.some((c) => c.voucher)) voucher = null; refresh(); };
  $('#coPA', corpo).onclick = () => {
    const v = toCents($('#coV', corpo).value); if (!(v > 0)) return info('Informe o valor.');
    const f = App.apoio.formas.find((x) => String(x.id) === $('#coF', corpo).value);
    pagamentos.push({ formaPagamentoId: f.id, forma: f.nome, valor: v }); refresh();
  };
  $('#coPR', corpo).onclick = () => { for (const s of gP.sel()) pagamentos.splice(s.id, 1); refresh(); };
  $('#coAP', corpo).onclick = async () => {
    const it = await adicionarProduto(); if (!it) return;
    const p = App.apoio.produtos.find((x) => x.id === it.produtoId);
    if (P('office.bloquearProdutosRepetidos') === 'true' && carrinho.some((c) => !c.inscricaoId && c.produtoId === p.id)) return info('Produto já está no carrinho.');
    carrinho.push({ k: seq++, inscricaoId: null, produtoId: p.id, cliente: cliente?.nome || '', produto: p.nome, quantidade: it.quantidade, unit: it.preco, descPct: 0, desc: 0, acrPct: 0, acr: 0 }); refresh();
  };
  const ajuste = async (tipo) => {
    const alvo = gC.sel().length ? carrinho.filter((c) => gC.sel().some((s) => s.id === c.k)) : carrinho;
    if (!alvo.length) return info('Carrinho vazio.');
    const v = await pedir(`${tipo === 'desc' ? 'Desconto' : 'Acréscimo'} para ${alvo.length === carrinho.length ? 'todos os itens' : 'os itens selecionados'} (ex.: 10% ou 15,00):`, '', tipo === 'desc' ? 'Aplicar Desconto' : 'Aplicar Acréscimo');
    if (v === null || !v.trim()) return;
    const pct = v.includes('%'); const n = pct ? Number(v.replace('%', '').replace(',', '.')) : toCents(v);
    if (!(n >= 0)) return info('Valor inválido.');
    for (const c of alvo) {
      if (tipo === 'desc' && c.voucher) { await info('Este item já possui desconto de voucher e não pode receber outro desconto.'); continue; }
      const base = c.unit * c.quantidade;
      const val = pct ? Math.round((base * n) / 100) : Math.round(n / alvo.length);
      if (tipo === 'desc') { c.desc = Math.min(base, val); c.descPct = pct ? n : Math.round((c.desc / base) * 10000) / 100 || 0; }
      else { c.acr = val; c.acrPct = pct ? n : Math.round((val / base) * 10000) / 100 || 0; }
    }
    refresh();
  };
  $('#coDesc', corpo).onclick = () => ajuste('desc');
  $('#coAcr', corpo).onclick = () => ajuste('acr');
  $('#coVA', corpo).onclick = async () => {
    const cod = $('#coVc', corpo).value.trim(); if (!cod) return info('Informe o código do voucher.');
    if (voucher) return info('Já existe um voucher aplicado nesta venda. Remova-o primeiro.');
    const v = await api(`/api/office/vouchers/validar?codigo=${encodeURIComponent(cod)}`);
    const alvo = carrinho.find((c) => (!v.produtoId || c.produtoId === v.produtoId) && !c.desc);
    if (!alvo) return info(v.produtoId ? 'O produto do voucher não está na venda.' : 'Nenhum produto na venda para aplicar o voucher.');
    const t = totais(); if (v.pedidoMinimo && t.sub < v.pedidoMinimo) return info(`Valor do pedido insuficiente. Mínimo exigido: ${fmt.brl(v.pedidoMinimo)}.`);
    const base = alvo.unit * alvo.quantidade;
    let d = v.tipo === 'percentual' ? Math.round((base * v.valor) / 100) : v.valor; if (v.descontoMaximo) d = Math.min(d, v.descontoMaximo);
    alvo.desc = Math.min(base, d); alvo.voucher = true; alvo.descPct = Math.round((alvo.desc / base) * 10000) / 100; voucher = v.codigo;
    refresh(); info(`Voucher aplicado! Desconto de ${fmt.brl(alvo.desc)} em ${alvo.produto}.`);
  };
  $('#coOK', corpo).onclick = async () => {
    if (!carrinho.length) return info('Carrinho vazio.');
    const t = totais();
    if (!pagamentos.length && t.sub > 0) { const f = App.apoio.formas.find((x) => String(x.id) === $('#coF', corpo).value); pagamentos.push({ formaPagamentoId: f.id, forma: f.nome, valor: toCents($('#coV', corpo).value) || t.sub }); refresh(); }
    const t2 = totais();
    if (t2.falta > 0 && P('office.validarTotalPago') !== 'false') return info(`Ainda faltam ser pagos ${fmt.brl(t2.falta)} para poder concluir a compra.`);
    const r = await api('/api/office/vendas', { body: {
      clienteId: cliente?.id || null, observacao: $('#coO', corpo).value, voucherCodigo: voucher,
      itens: carrinho.map((c) => ({ inscricaoId: c.inscricaoId, produtoId: c.produtoId, quantidade: c.quantidade, unitarioCentavos: c.unit, descontoCentavos: c.voucher ? 0 : c.desc, acrescimoCentavos: c.acr })),
      pagamentos: pagamentos.map((p) => ({ formaPagamentoId: p.formaPagamentoId, valorCentavos: p.valor })),
    } });
    concluido = true;
    await info(`Venda nº ${r.id} aprovada.${r.troco ? `\nTroco: ${fmt.brl(r.troco)}` : ''}`);
    w.fechar();
    if (P('office.imprimirTicketAposVenda') === 'true') openReport(`/relatorio/venda?id=${r.id}`);
    if (r.inscricoes.length && (P('office.gerarTermoAposPagamento') === 'true' || (P('office.perguntarImprimirTermo') !== 'false' && (await confirmar('Deseja imprimir o Termo de Responsabilidade?', 'Pergunta!'))))) imprimirTermo(r.inscricoes);
  };
  if (bateriaId) { $('#coB', corpo).value = bateriaId; await carregaDisp(); add(disponiveis.filter((r) => reservaIds.includes(r.id))); }
  refresh();
}

function adicionarProduto() {
  return new Promise((resolve) => {
    let res = null;
    const ativos = App.apoio.produtos.filter((p) => p.ativo);
    const corpo = h(`<div class="fg" style="grid-template-columns: 1fr 90px 110px"><div><label>Produto</label><select id="apP">${ativos.map((p) => `<option value="${p.id}">${esc(p.nome)}</option>`).join('')}</select></div>
      <div><label>Quantidade</label><input id="apQ" type="number" min="1" value="1"></div><div><label>Preço</label><input id="apV"></div></div>`);
    const w = janela({ titulo: 'Adicionar Produtos ao Carrinho', largura: 560, corpo, aoFechar: () => resolve(res), botoes: [['Cancelar', () => w.fechar()], ['Adicionar', () => {
      const q = Number($('#apQ', corpo).value); const v = toCents($('#apV', corpo).value);
      if (!(q > 0) || Number.isNaN(v)) return info('Quantidade ou preço inválido.');
      res = { produtoId: Number($('#apP', corpo).value), quantidade: q, preco: v }; w.fechar();
    }, true]] });
    const upd = () => { const p = ativos.find((x) => String(x.id) === $('#apP', corpo).value); $('#apV', corpo).value = fmt.money(p?.preco || 0); };
    $('#apP', corpo).onchange = upd; upd();
  });
}

// =====================================================================================
// VENDAS: visualizar / estornar
// =====================================================================================
async function verVenda(id) {
  const v = await api(`/api/office/vendas/${id}`);
  const corpo = h(`<div><p>Venda nº <b>${v.codigo}</b> · ${fmt.dmyhm(v.dataHora)} · ${esc(v.terminal || '')} · ${esc(v.usuario || '')}<br>Cliente: <b>${esc(v.cliente || '—')}</b></p>
    <div id="vvI" style="height:180px;overflow:auto;border:1px solid #ccc;background:#fff"></div><p style="font-weight:700;margin:8px 0 2px">Métodos de Pagamento</p>
    <div id="vvP" style="height:110px;overflow:auto;border:1px solid #ccc;background:#fff"></div>
    <p>Total ${fmt.brl(v.final)} · Recebido ${fmt.brl(v.recebido)} · Troco ${fmt.brl(v.troco)} · Estornos ${fmt.brl(v.estorno)}</p></div>`);
  janela({ titulo: 'Visualizar Métodos de Pagamento', largura: 760, corpo, botoes: [['Imprimir Comprovante', () => openReport(`/relatorio/venda?id=${id}`)]] });
  grade($('#vvI', corpo), [{ key: 'item', label: 'Item' }, { key: 'descricao', label: 'Descrição', w: 260 }, { key: 'quantidade', label: 'Qtde', cls: 'r' }, { key: 'unitario', label: 'Unitário', fmt: 'money', cls: 'r' }, { key: 'desconto', label: 'Desconto', fmt: 'money', cls: 'r' }, { key: 'liquido', label: 'Líquido', fmt: 'money', cls: 'r' }, { key: 'estornado', label: 'Estornado', fmt: 'bool', cls: 'c' }], v.itens);
  grade($('#vvP', corpo), [{ key: 'forma', label: 'Método de Pagamento', w: 260 }, { key: 'valor', label: 'Valor (R$)', fmt: 'money', cls: 'r' }], v.pagamentos);
}
async function estornarVenda(id) {
  const v = await api(`/api/office/vendas/${id}`);
  const corpo = h(`<div><div class="fg" style="grid-template-columns: 110px 1fr 110px 1fr"><label>Cliente:</label><b>${esc(v.cliente || '—')}</b><label>Data da Venda:</label><b>${fmt.dmyhm(v.dataHora)}</b>
    <label>Terminal:</label><b>${esc(v.terminal || '')}</b><label>Total Recebido:</label><b>${fmt.brl(v.recebido)}</b><label>Descontos:</label><b>${fmt.brl(v.desconto)}</b><label>Troco:</label><b>${fmt.brl(v.troco)}</b></div>
    <p style="font-weight:700;margin:8px 0 2px">Detalhes — marque os itens a estornar</p><div id="evI" style="height:200px;overflow:auto;border:1px solid #ccc;background:#fff"></div>
    <div style="margin-top:6px"><label>Motivo</label><input id="evM" style="width:100%"></div></div>`);
  const itens = v.itens.filter((i) => !i.estornado);
  const w = janela({ titulo: 'Estornar Pagamento', largura: 780, corpo, botoes: [['Cancelar', () => w.fechar()], ['Estornar', async () => {
    const sel = g.sel(); if (!sel.length) return info('Selecione os itens a estornar.');
    if (!$('#evM', corpo).value.trim()) return info('Informe o motivo do estorno.');
    if (!(await confirmar('Tem certeza que deseja estornar os produtos selecionados?'))) return;
    const r = await api(`/api/office/vendas/${id}/estorno`, { body: { itemIds: sel.map((i) => i.id), motivo: $('#evM', corpo).value } });
    await info(`Estorno de ${fmt.brl(r.estornado)} registrado. Devolva o valor ao cliente pela mesma forma de pagamento.`); w.fechar(); recarregar();
  }, true]] });
  const g = grade($('#evI', corpo), [{ key: 'descricao', label: 'Item', w: 320 }, { key: 'quantidade', label: 'Qtde', cls: 'r' }, { key: 'liquido', label: 'Total Líquido', fmt: 'money', cls: 'r' }], itens, { multi: true, vazio: 'Todos os itens já foram estornados.' });
}

// =====================================================================================
// OFICINA / VOUCHERS / SERVICOS ONLINE
// =====================================================================================
async function marcarManutencao(sel, realizada) {
  if (!sel.length) return;
  await api('/api/office/manutencoes/marcar', { body: { ids: sel.map((r) => r.id), realizada } });
  recarregar();
}
function criarVoucher(origem) {
  const tit = origem === 'fidelidade' ? 'Criar Voucher por Fidelidade' : origem === 'parceiro' ? 'Criar Voucher por Parceiro' : 'Criar Voucher';
  const refLabel = origem === 'fidelidade' ? 'Conta fidelidade' : origem === 'parceiro' ? 'Parceiro' : 'Referência (opcional)';
  const corpo = h(`<div class="fg" style="grid-template-columns: 1fr 1fr">
    <div style="grid-column:span 2"><label>${refLabel}</label><input id="vcR" placeholder="${origem === 'fidelidade' ? 'Nome do cliente/conta' : origem === 'parceiro' ? 'Nome do parceiro' : ''}"></div>
    <div><label>Código</label><div style="display:flex;gap:4px"><input id="vcC" style="text-transform:uppercase"><button id="vcG">Gerar</button></div></div><div></div>
    <div><label>Tipo desconto</label><select id="vcT"><option value="percentual">Percentual</option><option value="valor">Valor (R$)</option></select></div><div><label>Valor</label><input id="vcV"></div>
    <div><label>Data inicial</label><input type="date" id="vcI" value="${hoje()}"></div><div><label>Data final</label><input type="date" id="vcF" value="${addDays(hoje(), 30)}"></div>
    <div style="grid-column:span 2"><label>Produto</label><select id="vcP"><option value="">(qualquer produto)</option>${App.apoio.produtos.filter((p) => p.ativo).map((p) => `<option value="${p.id}">${esc(p.nome)}</option>`).join('')}</select></div>
    <div><label>Uso max/cliente</label><input type="number" id="vcU" min="1" value="1"></div><label class="ck" style="align-self:end"><input type="checkbox" id="vcUn" checked> Uso único</label>
    <div><label>Pedido mínimo (R$)</label><input id="vcMin"></div><div><label>Desconto máximo (R$)</label><input id="vcMax"></div></div>`);
  const w = janela({ titulo: tit, largura: 560, corpo, botoes: [['Cancelar', () => w.fechar()], ['Salvar e Fechar', async () => {
    const tipo = $('#vcT', corpo).value; const vv = $('#vcV', corpo).value;
    const valor = tipo === 'valor' ? toCents(vv) : Number(vv.replace(',', '.'));
    if (!(valor > 0)) return info('Informe o valor.');
    await api('/api/office/vouchers', { body: { origem, referencia: $('#vcR', corpo).value, codigo: $('#vcC', corpo).value, tipo, valor, inicio: $('#vcI', corpo).value, fim: $('#vcF', corpo).value,
      produtoId: $('#vcP', corpo).value || null, usoMaxCliente: Number($('#vcU', corpo).value), usoUnico: $('#vcUn', corpo).checked, pedidoMinimo: toCents($('#vcMin', corpo).value) || null, descontoMaximo: toCents($('#vcMax', corpo).value) || null } });
    await info('Voucher criado.'); w.fechar(); if (App.view.grupo === 'vouchers') recarregar();
  }, true]] });
  $('#vcG', corpo).onclick = () => { $('#vcC', corpo).value = 'KB' + Math.random().toString(36).slice(2, 8).toUpperCase(); };
}
function servicosOnline(e) {
  const r = e.currentTarget.getBoundingClientRect();
  ctxMenu(r.left, r.bottom, [
    { label: 'QrCode - Cadastro Online', fn: () => info('O cadastro on-line era um serviço da MyLapTime (desativada).\nPor enquanto o cadastro é feito no totem ou aqui na recepção.') },
    { label: 'QrCode - Agenda Online', fn: () => info('A agenda/pagamento on-line próprios ainda serão implementados no site (a MyLapTime foi desativada).') },
  ]);
}

// =====================================================================================
// CADASTROS GENERICOS (Registro de X)
// =====================================================================================
const CADS = {
  produtos: { titulo: 'Registro de Produto', campos: [['codigo', 'Código', 'text'], ['nome', 'Nome', 'text', 3], ['preco', 'Preço (R$)', 'money'], ['categoria', 'Categoria (padrão)', 'select', 1, ['Indoor', 'Super Kart']], ['classeContabil', 'Classe contábil', 'text'], ['servicoLocacao', 'Serviço de locação', 'bool'], ['publicarNuvem', 'Publicar em nuvem', 'bool'], ['requerDevolucao', 'Requer devolução', 'bool'], ['ativo', 'Ativo', 'bool']],
    cols: [{ key: 'classeContabil', label: 'Classe Contábil' }, { key: 'categoria', label: 'Categoria (padrão)' }, { key: 'codigo', label: 'Código' }, { key: 'nome', label: 'Nome', w: 260 }, { key: 'preco', label: 'Preço (R$)', fmt: 'money', cls: 'r' }, { key: 'ativo', label: 'Ativo', fmt: 'bool', cls: 'c' }], extra: provasProduto },
  tracados: { titulo: 'Registro de Traçado', campos: [['nome', 'Nome', 'text', 2], ['comprimento', 'Comprimento (m)', 'int'], ['ativo', 'Ativo', 'bool']], cols: [{ key: 'nome', label: 'Nome', w: 260 }, { key: 'comprimento', label: 'Comprimento', cls: 'r' }, { key: 'ativo', label: 'Ativo', fmt: 'bool', cls: 'c' }] },
  feriados: { titulo: 'Registro de Feriado', campos: [['data', 'Data', 'date'], ['descricao', 'Descrição', 'text', 2], ['recorrente', 'Repete todo ano', 'bool']], cols: [{ key: 'data', label: 'Data', fmt: 'dmy' }, { key: 'descricao', label: 'Descrição', w: 260 }, { key: 'recorrente', label: 'Recorrente', fmt: 'bool', cls: 'c' }] },
  turnos: { titulo: 'Registro de Turno', campos: [['descricao', 'Descrição', 'text', 2], ['inicio', 'Início (hh:mm)', 'time'], ['fim', 'Término (hh:mm)', 'time'], ['ativo', 'Ativo', 'bool']], cols: [{ key: 'descricao', label: 'Descrição', w: 220 }, { key: 'inicio', label: 'Início' }, { key: 'fim', label: 'Término' }, { key: 'ativo', label: 'Ativo', fmt: 'bool', cls: 'c' }] },
  terminais: { titulo: 'Registro de Terminal', campos: [['codigo', 'Código', 'text'], ['nome', 'Descrição', 'text', 2], ['ativo', 'Ativo', 'bool']], cols: [{ key: 'codigo', label: 'Código' }, { key: 'nome', label: 'Descrição', w: 220 }, { key: 'ativo', label: 'Ativo', fmt: 'bool', cls: 'c' }] },
  formas: { titulo: 'Métodos de Pagamento', campos: [['codigo', 'Código', 'text'], ['nome', 'Nome', 'text', 2], ['tipo', 'Tipo', 'select', 1, ['dinheiro', 'credito', 'debito', 'pix', 'voucher', 'outro']], ['ativo', 'Ativo', 'bool']], cols: [{ key: 'codigo', label: 'Código' }, { key: 'nome', label: 'Nome', w: 220 }, { key: 'tipo', label: 'Tipo' }, { key: 'ativo', label: 'Ativo', fmt: 'bool', cls: 'c' }] },
  itensManutencao: { titulo: 'Itens de Manutenção', campos: [['codigo', 'Código', 'text'], ['nome', 'Nome', 'text', 2], ['controlaPorTempo', 'Controla por tempo de uso', 'bool'], ['tempoHoras', 'A cada (horas)', 'int'], ['ativo', 'Ativo', 'bool']], cols: [{ key: 'codigo', label: 'Código' }, { key: 'nome', label: 'Nome', w: 220 }, { key: 'tempoHoras', label: 'A cada (h)', cls: 'r' }, { key: 'ativo', label: 'Ativo', fmt: 'bool', cls: 'c' }] },
  padroes: { titulo: 'Ferramenta de Configuração de Reservas', campos: [['nome', 'Nome', 'text', 2], ['produtoId', 'Produto (padrão)', 'produto', 2], ['tracadoId', 'Traçado (padrão)', 'tracado'], ['categoria', 'Categoria (padrão)', 'select', 1, ['Indoor', 'Super Kart']], ['quantidade', 'Quantidade', 'int'], ['primeiraHora', '1ª reserva (hh:mm)', 'time'], ['vagas', 'Vagas (máx)', 'int'], ['intervaloMin', 'Intervalo entre inícios (min)', 'int'], ['voltaMinimaSeg', 'Volta mínima (seg)', 'int'], ['numerarNome', 'Nomear reservas com nº sequencial', 'bool'], ['online', 'Publicar no totem', 'bool'], ['ativo', 'Ativo', 'bool']],
    cols: [{ key: 'nome', label: 'Nome', w: 220 }, { key: 'quantidade', label: 'Qtde', cls: 'r' }, { key: 'primeiraHora', label: '1ª reserva' }, { key: 'intervaloMin', label: 'Intervalo', cls: 'r' }, { key: 'vagas', label: 'Vagas', cls: 'r' }, { key: 'ativo', label: 'Ativo', fmt: 'bool', cls: 'c' }] },
  usuarios: { titulo: 'Registro de Usuário', campos: [['login', 'Login', 'text'], ['nome', 'Nome', 'text', 2], ['senha', 'Nova senha (deixe em branco p/ manter)', 'password', 2], ['admin', 'Administrador', 'bool'], ['ativo', 'Ativo', 'bool']], cols: [{ key: 'login', label: 'Login' }, { key: 'nome', label: 'Nome', w: 220 }, { key: 'admin', label: 'Admin', fmt: 'bool', cls: 'c' }, { key: 'ativo', label: 'Ativo', fmt: 'bool', cls: 'c' }] },
};

async function cadastro(ent) {
  const def = CADS[ent];
  let lista = [], atual = null, modo = 'ver';
  const campoHtml = ([k, l, t, span = 1, opts]) => {
    const st = `grid-column: span ${span}`;
    if (t === 'bool') return `<label class="ck" style="${st}"><input type="checkbox" name="${k}"> ${esc(l)}</label>`;
    if (t === 'select') return `<div style="${st}"><label>${esc(l)}</label><select name="${k}">${opts.map((o) => `<option>${esc(o)}</option>`).join('')}</select></div>`;
    if (t === 'produto') return `<div style="${st}"><label>${esc(l)}</label><select name="${k}"><option value=""></option>${optProdutos()}</select></div>`;
    if (t === 'tracado') return `<div style="${st}"><label>${esc(l)}</label><select name="${k}"><option value=""></option>${optTracados()}</select></div>`;
    return `<div style="${st}"><label>${esc(l)}</label><input name="${k}" type="${t === 'date' ? 'date' : t === 'time' ? 'time' : t === 'password' ? 'password' : 'text'}"></div>`;
  };
  const corpo = h(`<div><form id="cdF" class="fg" style="grid-template-columns: repeat(4, 1fr)" onsubmit="return false">${def.campos.map(campoHtml).join('')}</form>
    <div id="cdX"></div><div id="cdG" style="height:300px;overflow:auto;border:1px solid #999;background:#fff;margin-top:8px"></div>
    <div style="text-align:right;color:#444;margin-top:2px" id="cdPos"></div>
    <div class="navbar"><button data-a="first"><span class="ic">«</span></button><button data-a="prev"><span class="ic">‹</span></button><button data-a="next"><span class="ic">›</span></button><button data-a="last"><span class="ic">»</span></button>
      <button data-a="novo"><span class="ic">⊕</span>Novo</button><button data-a="edit"><span class="ic">✎</span>Editar</button><button data-a="del"><span class="ic">🗑</span>Excluir</button><button data-a="canc"><span class="ic">⊗</span>Cancelar</button><button data-a="pesq"><span class="ic">🔍</span>Pesquisar</button>
      <span class="sp"></span><button data-a="fechar"><span class="ic">✕</span>Fechar</button><button data-a="gravar"><span class="ic">💾</span>Gravar</button></div></div>`);
  const w = janela({ titulo: def.titulo, largura: 900, corpo, aoFechar: async () => { App.apoio = await api('/api/office/apoio'); } });
  const f = $('#cdF', corpo);
  const g = grade($('#cdG', corpo), def.cols, [], { onSel: (s) => s[0] && mostrar(s[0]) });
  const tipos = Object.fromEntries(def.campos.map((c) => [c[0], c[2]]));
  const setModo = (m) => { modo = m; $$('[name]', f).forEach((el) => (el.disabled = m === 'ver')); $$('[data-a=gravar],[data-a=canc]', corpo).forEach((b) => (b.disabled = m === 'ver')); $$('[data-a=novo],[data-a=edit],[data-a=del]', corpo).forEach((b) => (b.disabled = m !== 'ver')); };
  const mostrar = (r) => { atual = r; const d = { ...r }; for (const [k, t] of Object.entries(tipos)) if (t === 'money') d[k] = fmt.money(r[k]); formSet(f, d); const i = lista.indexOf(lista.find((x) => x.id === r.id)); $('#cdPos', corpo).textContent = `Registro ${i + 1} de ${lista.length}`; setModo('ver'); def.extra && def.extra($('#cdX', corpo), r); };
  const carregar_ = async (idSel) => { lista = await api(`/api/office/cad/${ent}`); g.set(lista); const r = lista.find((x) => x.id === idSel) || lista[0]; if (r) { g.selecionar((x) => x.id === r.id); mostrar(r); } else { f.reset(); setModo('ver'); } };
  corpo.onclick = async (e) => {
    const a = e.target.closest('button[data-a]')?.dataset.a; if (!a || e.target.closest('button').disabled) return;
    const i = atual ? lista.findIndex((x) => x.id === atual.id) : -1;
    const ir = (n) => { const r = lista[Math.max(0, Math.min(lista.length - 1, n))]; if (r) { g.selecionar((x) => x.id === r.id); mostrar(r); } };
    if (a === 'first') ir(0); if (a === 'prev') ir(i - 1); if (a === 'next') ir(i + 1); if (a === 'last') ir(lista.length - 1);
    if (a === 'novo') { atual = null; f.reset(); $$('[name=ativo]', f).forEach((c) => (c.checked = true)); setModo('novo'); $('[name]', f).focus(); }
    if (a === 'edit' && atual) setModo('edit');
    if (a === 'canc') atual ? mostrar(atual) : (f.reset(), setModo('ver'));
    if (a === 'pesq') { const q = await pedir('Pesquisar (contém):'); if (q) { const r = lista.find((x) => Object.values(x).some((v) => String(v ?? '').toLowerCase().includes(q.toLowerCase()))); if (r) { g.selecionar((x) => x.id === r.id); mostrar(r); } else info('Nada encontrado.'); } }
    if (a === 'fechar') w.fechar();
    if (a === 'del' && atual && (await confirmar('Deseja excluir definitivamente o registro atual?'))) { const r = await api(`/api/office/cad/${ent}/${atual.id}`, { method: 'DELETE' }); if (r.desativado) await info('Registro em uso: foi desativado em vez de excluído.'); carregar_(); }
    if (a === 'gravar') {
      const b = formGet(f);
      for (const [k, t] of Object.entries(tipos)) { if (t === 'money') b[k] = toCents(b[k]); if ((t === 'int' || t === 'produto' || t === 'tracado') && b[k] !== '') b[k] = Number(b[k]); if (t === 'password' && !b[k]) delete b[k]; }
      const r = modo === 'novo' ? await api(`/api/office/cad/${ent}`, { body: b }) : await api(`/api/office/cad/${ent}/${atual.id}`, { method: 'PUT', body: b });
      await info('Operação concluída com sucesso.'); carregar_(r.id);
    }
  };
  setModo('ver');
  carregar_();
}

/** Secao "Item" do Registro de Produto: programa de provas (ex.: Tomada de Tempo 5 min + Corrida 20 min). */
async function provasProduto(root, produto) {
  const lista = await api(`/api/office/cad/provas?produtoId=${produto.id}`);
  root.innerHTML = `<fieldset style="margin-top:8px"><legend>Item — provas da bateria (a cronometragem monta nesta ordem)</legend>
    <div class="fg" style="grid-template-columns: 50px 1fr 130px 110px 90px 90px auto auto"><div><label>Ordem</label><input id="ppO" type="number" value="${lista.length + 1}"></div><div><label>Nome</label><input id="ppN"></div>
    <div><label>Tipo</label><select id="ppT"><option value="classificacao">Tomada de tempo</option><option value="corrida">Corrida</option><option value="treino">Treino</option></select></div>
    <div><label>Autofinalizar</label><select id="ppF"><option value="tempo">Por tempo</option><option value="voltas">Por voltas</option></select></div><div><label>Tempo (min)</label><input id="ppM" type="number"></div><div><label>Voltas (máx)</label><input id="ppV" type="number"></div>
    <button id="ppIns">⊕ Inserir</button><button id="ppDel">🗑 Excluir</button></div><div id="ppG" style="max-height:110px;overflow:auto;border:1px solid #ccc;background:#fff;margin-top:4px"></div></fieldset>`;
  const g = grade($('#ppG', root), [{ key: 'ordem', label: 'Qtde/Ordem' }, { key: 'finalizacao', label: 'Tipo de Finalização' }, { key: 'tempoMin', label: 'Tempo (minutos)', cls: 'r' }, { key: 'voltasMax', label: 'Voltas (máx)', cls: 'r' }, { key: 'nome', label: 'Nome' }, { key: 'tipo', label: 'Tipo' }], lista, { vazio: 'Sem provas: a cronometragem cria uma bateria única.' });
  $('#ppIns', root).onclick = async () => {
    if (!$('#ppN', root).value.trim()) return info('Informe o nome da prova.');
    await api('/api/office/cad/provas', { body: { produtoId: produto.id, ordem: Number($('#ppO', root).value), nome: $('#ppN', root).value, tipo: $('#ppT', root).value, finalizacao: $('#ppF', root).value, tempoMin: $('#ppM', root).value, voltasMax: $('#ppV', root).value } });
    provasProduto(root, produto);
  };
  $('#ppDel', root).onclick = async () => { const s = g.sel()[0]; if (!s) return info('Selecione a prova.'); await api(`/api/office/cad/provas/${s.id}`, { method: 'DELETE' }); provasProduto(root, produto); };
}

async function abrirEmpresa() {
  const e = await api('/api/office/empresa');
  const campos = [['nome', 'Nome fantasia', 2], ['razaoSocial', 'Razão social', 2], ['cnpj', 'CNPJ', 1], ['telefone', 'Telefone', 1], ['email', 'E-mail', 2], ['cep', 'CEP', 1], ['endereco', 'Endereço', 2], ['numero', 'Nº', 1], ['complemento', 'Complemento', 1], ['bairro', 'Bairro', 1], ['cidade', 'Cidade', 1], ['estado', 'UF', 1]];
  const corpo = h(`<form class="fg" style="grid-template-columns: repeat(4,1fr)" onsubmit="return false">${campos.map(([k, l, s]) => `<div style="grid-column:span ${s}"><label>${l}</label><input name="${k}"></div>`).join('')}
    <div style="grid-column:span 4"><label>Política de reembolso</label><textarea name="politicaReembolso" rows="4"></textarea></div></form>`);
  formSet(corpo, e);
  const w = janela({ titulo: 'Registro de Empresa', largura: 760, corpo, botoes: [['Cancelar', () => w.fechar()], ['Salvar', async () => { await api('/api/office/empresa', { method: 'PUT', body: formGet(corpo) }); await info('Operação concluída com sucesso.'); w.fechar(); App.apoio = await api('/api/office/apoio'); }, true]] });
}
async function parametrosSistema() {
  const lista = await api('/api/office/parametros');
  const corpo = h(`<div><p style="color:#555">Parâmetros do módulo Recepção (office.*) e do Autoatendimento (totem.*).</p><div class="fg" style="grid-template-columns: 1fr 260px">
    ${lista.map((p) => `<label style="align-self:center">${esc(p.descricao || p.chave)} <span style="color:#999">(${esc(p.chave)})</span></label>${p.valor === 'true' || p.valor === 'false' ? `<label class="ck"><input type="checkbox" data-k="${esc(p.chave)}" ${p.valor === 'true' ? 'checked' : ''}> ativado</label>` : `<input data-k="${esc(p.chave)}" value="${esc(p.valor)}">`}`).join('')}</div></div>`);
  const w = janela({ titulo: 'Parâmetros do Sistema', largura: 820, corpo, botoes: [['Cancelar', () => w.fechar()], ['Salvar', async () => {
    const body = {}; $$('[data-k]', corpo).forEach((el) => (body[el.dataset.k] = el.type === 'checkbox' ? String(el.checked) : el.value));
    await api('/api/office/parametros', { method: 'PUT', body }); App.apoio = await api('/api/office/apoio'); await info('Parâmetros salvos.'); w.fechar(); recarregar();
  }, true]] });
}
async function trocarSenha() {
  const nova = await pedir('Nova senha (mínimo 6 caracteres):', '', 'Trocar minha senha');
  if (!nova) return;
  const conf = await pedir('Repita a nova senha:', '', 'Trocar minha senha');
  if (conf !== nova) return info('As senhas não conferem.');
  const r = await api('/api/office/senha', { body: { nova } });
  info(r.mensagem);
}
async function sair() { if (await confirmar('Deseja sair do sistema?')) { Sess.token = ''; location.reload(); } }

// =====================================================================================
// RELATORIOS
// =====================================================================================
function relPeriodo(tipo, agrupar) {
  const corpo = h(`<div class="fg" style="grid-template-columns: 1fr 1fr"><div><label>De</label><input type="date" id="rpD" value="${hoje().slice(0, 8)}01"></div><div><label>Até</label><input type="date" id="rpA" value="${hoje()}"></div></div>`);
  const w = janela({ titulo: tipo === 'clientes' ? 'Clientes por Período' : 'Relatório financeiro', largura: 380, corpo, botoes: [['Cancelar', () => w.fechar()], ['Gerar Relatório', () => { openReport(`/relatorio/${tipo}?de=${$('#rpD', corpo).value}&ate=${$('#rpA', corpo).value}${agrupar ? `&agrupar=${agrupar}` : ''}`); w.fechar(); }, true]] });
}
async function relReservasDiaria() { const d = await pedir('Data (AAAA-MM-DD):', $('#fData').value, 'Reservas Diária'); if (d) openReport(`/relatorio/reservas-diaria?data=${d}`); }
async function relAgendaMensal() { const m = await pedir('Mês (AAAA-MM):', hoje().slice(0, 7), 'Agenda Mensal'); if (m) openReport(`/relatorio/agenda?mes=${m}`); }
async function relParticipantes() {
  if (App.view.grupo === 'baterias' && App.grid.sel().length === 1) return openReport(`/relatorio/participantes?bateria=${App.grid.sel()[0].id}`);
  const lista = await api(`/api/office/baterias?status=todas&filtro=dia&data=${$('#fData').value}`);
  const corpo = h(`<div><label>Bateria</label><select id="lpB" style="width:100%">${lista.map((b) => `<option value="${b.id}">${fmt.dmyhm(b.dataHora)} · ${esc(b.nome)} (${b.inscritos})</option>`).join('')}</select></div>`);
  const w = janela({ titulo: 'Lista de Participantes', largura: 480, corpo, botoes: [['Cancelar', () => w.fechar()], ['Gerar Relatório', () => { openReport(`/relatorio/participantes?bateria=${$('#lpB', corpo).value}`); w.fechar(); }, true]] });
}
async function relFechamento() {
  const c = await api('/api/office/caixa');
  const lista = await api('/api/office/movimentos');
  const corpo = h(`<div><div id="rfG" style="height:320px;overflow:auto;border:1px solid #ccc;background:#fff"></div></div>`);
  const w = janela({ titulo: 'Fechamento de Caixa', largura: 760, corpo, botoes: [['Cancelar', () => w.fechar()], ['Gerar Relatório', () => { const s = g.sel()[0]; if (!s) return info('Selecione o movimento.'); openReport(`/relatorio/fechamento?mov=${s.id}`); }, true]] });
  const g = grade($('#rfG', corpo), [{ key: 'terminal', label: 'Terminal' }, { key: 'turno', label: 'Turno' }, { key: 'usuario', label: 'Usuário' }, { key: 'abertoEm', label: 'Abertura', fmt: 'dmyhm' }, { key: 'fechadoEm', label: 'Fechamento', fmt: 'dmyhm' }, { key: 'recebido', label: 'Recebido', fmt: 'money', cls: 'r' }], lista, { onDbl: (r) => openReport(`/relatorio/fechamento?mov=${r.id}`) });
  if (c.aberto) g.selecionar((x) => x.id === c.aberto.id);
}

// =====================================================================================
if (Sess.token) iniciar(); else telaLogin();
