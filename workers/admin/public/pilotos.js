'use strict';
/* Página Pilotos (cartela de clientes ao vivo), perfil do piloto (carreira, dados e foto) e ranking por traçado.
   Os dados vêm de /api/office/pilotos* (lib/ops/pilotos.ts): cadastro do KartodromoOps + baterias encerradas da cronometragem
   + LapTime antigo (corridas de setembro e ranking semanal/mensal desde jan/2025). */

const fmtVolta = (ms) => { if (!ms) return '—'; const s = ms / 1000, m = Math.floor(s / 60); return `${m}:${(s - m * 60).toFixed(3).padStart(6, '0')}`; };
const idadeDe = (nasc) => { if (!nasc) return null; const n = deIso(nasc), h = deIso(hojeIso()); let a = h.getFullYear() - n.getFullYear(); if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) a--; return a >= 0 && a < 120 ? a : null; };
const dataBr = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
/** dd/mm, com o ano (dd/mm/aa) quando não é deste ano */
const dataCurta = (iso) => { if (!iso) return '—'; const [a, m, d] = iso.slice(0, 10).split('-'); return a === hojeIso().slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${a.slice(2)}`; };
const diasAtras = (iso) => {
  if (!iso) return 'nunca correu';
  const d = Math.round((deIso(hojeIso()) - deIso(iso)) / 864e5);
  return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : d < 30 ? `há ${d} dias` : d < 365 ? `há ${Math.round(d / 30)} ${Math.round(d / 30) === 1 ? 'mês' : 'meses'}` : `há ${Math.round(d / 365)} ${Math.round(d / 365) === 1 ? 'ano' : 'anos'}`;
};
/** "JOAO DA SILVA" → "João da Silva" não (sem acento novo), mas "Joao da Silva": nomes do LapTime vêm em maiúsculas. */
const nomeBonitoPiloto = (n) => String(n || '').toLowerCase().replace(/(^|[\s'-])([\p{L}])/gu, (_, a, b) => a + b.toUpperCase()).replace(/\s(Da|De|Do|Das|Dos|E)(?=\s)/g, (x) => x.toLowerCase())
  .replace(/\b(Ii|Iii|Iv|Vi|Vii|Viii|Ix)\b/g, (x) => x.toUpperCase()); // Junior II
const instagramValido = (s) => !!s && /^[A-Za-z0-9._]{1,30}$/.test(String(s).replace(/^@/, '')) && !/^\d+$/.test(String(s).replace(/^@/, ''));
const ORIGEM = { laptime: 'LapTime antigo', recepcao: 'Recepção', totem: 'totem', site: 'pré-cadastro (QR)', calxpro: 'CalXPro' };
S.minis = S.minis || {};
async function carregarMiniaturas(ids) {
  const faltam = ids.filter((id) => !(id in S.minis));
  if (!faltam.length) return;
  try { Object.assign(S.minis, await office('/pilotos/miniaturas?ids=' + faltam.join(','))); faltam.forEach((id) => { if (!(id in S.minis)) S.minis[id] = null; }); } catch { /* sem miniaturas: ficam as iniciais */ }
}
/** Foto quando houver; senão iniciais em cinza (cor não significa nada aqui). */
const avatarPiloto = (id, nome, tam, extra = '') => {
  const src = id && S.minis[id];
  return src ? `<img src="${src}" alt="" width="${tam}" height="${tam}" style="width: ${tam}px; height: ${tam}px; border-radius: 50%; object-fit: cover; flex-shrink: 0; ${extra}">`
    : `<span class="avatar avatarNeutro" aria-hidden="true" style="width: ${tam}px; height: ${tam}px; font-size: ${Math.max(12, Math.round(tam / 3))}px; ${extra}">${esc(iniciais(nomeBonitoPiloto(nome)))}</span>`;
};
const zapPiloto = (fone, nome) => (fone ? zap(fone, `Olá, ${nomeBonitoPiloto(nome).split(' ')[0]}! Aqui é do Kartódromo de Betim.`) : '');

// ------------------------------------------------------------------ cartela
TELAS.pilotos = async (tela) => {
  let salvo = null;
  try { salvo = JSON.parse(guarda.ler('kib-pil') || 'null'); } catch { salvo = null; }
  const P = S.pil || (S.pil = { filtro: salvo?.filtro || 'todos', ordem: salvo?.ordem || 'recentes', q: '', pagina: 1, inicio: !!salvo, sel: new Map(), selecionando: false });
  if (!P.sel) { P.sel = new Map(); P.selecionando = false; }
  const FILTROS = [
    ['todos', 'Todos', 'total', 'Todos os cadastros do sistema'],
    ['hoje', 'Correndo hoje', 'hoje', 'Quem tem bateria reservada hoje'],
    ['ativos', 'Ativos 30 dias', 'ativos30', 'Quem correu nos últimos 30 dias'],
    ['novos', 'Novos na semana', 'novos', 'Cadastrados nos últimos 7 dias'],
    ['incompletos', 'Cadastro incompleto', 'incompletos', 'Falta CPF, peso, telefone ou e-mail'],
    ['aniversariantes', 'Aniversariantes do mês', 'aniversariantes', 'Fazem aniversário neste mês'],
  ];
  const ORDENS = [['recentes', 'Mais recentes', ''], ['nome', 'Nome (A–Z)', ''], ['baterias', 'Mais baterias', 'só em Ativos 30 dias'], ['melhor', 'Melhor volta', 'só em Ativos 30 dias']];
  const ordemValida = (o) => (o === 'baterias' || o === 'melhor' ? P.filtro === 'ativos' && !P.q : true);
  const n = (v) => (+v || 0).toLocaleString('pt-BR');
  const hhmm = (d) => d.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
    const buscasRecentes = () => { try { return JSON.parse(guarda.ler('kib-pil-buscas') || '[]'); } catch { return []; } };

  tela.innerHTML = `<header class="cab"><div class="col"><h1>Pilotos</h1></div><div class="acoes"><a class="btn branco" href="#/ranking" title="Atalho: R">Ranking por traçado</a><a class="btn prim" href="#/piloto/novo" title="Atalho: N">${svg(IC.mais, 14, 'var(--kib-cor-acao-sobre-principal)', 2.6)}Novo cliente</a></div></header>
  <main class="principal">
    <section class="cartao" id="cartela" aria-busy="true">
      <div class="barraCartela">
        <label class="buscaCampo" style="flex: 1 1 260px; max-width: 420px">${svg(IC.busca, 15, 'var(--kib-cor-borda-campo)')}<input class="t-corpo" id="qPil" type="search" list="recentesPil" autocomplete="off" value="${esc(P.q)}" placeholder="Nome, CPF, telefone ou e-mail  ( / )" aria-label="Buscar cliente por nome, CPF, telefone ou e-mail"><button type="button" class="limpaBusca" data-limpar aria-label="Limpar busca" ${P.q ? '' : 'hidden'}>${svg(IC.fechar, 14)}</button></label>
        <datalist id="recentesPil">${buscasRecentes().map((b) => `<option value="${esc(b)}"></option>`).join('')}</datalist>
        <label class="ordemCartela"><span class="peq">Ordenar</span><select class="entrada" id="ordemPil">${ORDENS.map(([v, t, porque]) => `<option value="${v}" data-porque="${porque}">${t}</option>`).join('')}</select></label>
        <details class="menuMais"><summary class="btn sec" aria-label="Mais ações da lista">Mais ações</summary><div class="menuLista">
          <button type="button" data-sel-modo>Selecionar vários <kbd>S</kbd></button>
          <button type="button" data-atualizar>Atualizar agora</button>
          <button type="button" data-ajuda>Ajuda desta tela <kbd>H</kbd></button></div></details>
        <span class="statusCartela" id="statusP" role="status"></span>
        <div class="linhaFiltros"><div class="filtros" id="filtrosP" role="tablist" aria-label="Filtro da lista"></div><select class="entrada" id="maisPil" aria-label="Mais filtros"></select></div>
      </div>
      <div id="avisoP"></div>
      <div id="barraSelP"></div>
      <div id="listaP"><div class="esqueleto" style="height: 480px; margin: var(--kib-espaco-2)"></div></div>
      <div class="rodapeCartela" id="rodapeP"></div>
      <div class="so-leitor" id="anuncioP" aria-live="polite"></div>
    </section>
  </main>`;

  let resumo = null, lista = null, erro = null, ultimaOk = null, ocupado = false;

  const atencao = (c) => {
    const ch = [];
    if (c.bloqueado) ch.push(['vermelho', 'Bloqueado', '', 'Cliente bloqueado: não pode reservar nem correr']);
    if (c.duplicado) ch.push(['vermelho', 'Possível duplicado', `#/piloto/${c.duplicado.id}`, 'Outro cadastro com o mesmo CPF ou nome parecido. Clique para abrir o outro']);
    if (c.responsavelId && c.responsavelNome && nomeBonitoPiloto(c.responsavelNome) === nomeBonitoPiloto(c.nome)) ch.push(['laranja', 'Nome igual ao do responsável', '', 'O menor foi cadastrado com o nome do responsável: confira o cadastro']);
    else if (c.responsavelId) ch.push(['azul', 'Menor · ' + nomeBonitoPiloto(c.responsavelNome || 'responsável').split(' ')[0], '', 'Menor de idade; o responsável aparece no perfil']);
    if (c.faltas.length && c.hoje) ch.push(['laranja', 'Falta ' + c.faltas.join(', '), '', 'Corre hoje e o cadastro está incompleto: peça antes da bateria']);
    return ch.map(([cor, t, href, dica]) => (href ? `<a class="chip ${cor} trunc" href="${href}" title="${esc(dica)}">${esc(t)}</a>` : `<span class="chip ${cor} trunc" title="${esc(dica)}">${esc(t)}</span>`)).join('')
      || (c.faltas.length ? `<span class="peq" title="Falta ${esc(c.faltas.join(', '))}">incompleto</span>` : '<span class="peq" aria-label="Cadastro completo">—</span>');
  };

  const linha = (c) => {
    const id = c.id, ida = idadeDe(c.nascimento), car = c.carreira, nome = nomeBonitoPiloto(c.nome);
    const sub = c.hoje ? `correndo hoje · ${c.hoje}` : (c.criadoEm ? `cadastro ${dataCurta(c.criadoEm)}` : '');
    const fone = c.telefone, wa = zapPiloto(fone, c.nome);
    return `<div class="linhaPiloto hov" role="row" data-href="#/piloto/${id}" data-id="${id}"><span class="cSel"><input type="checkbox" data-sel="${id}" aria-label="Selecionar ${esc(nome)}" ${P.sel.has(id) ? 'checked' : ''}></span>${avatarPiloto(id, c.nome, 38, c.hoje ? 'box-shadow: 0 0 0 2px var(--kib-cor-superficie-padrao), 0 0 0 4px var(--kib-cor-status-ok)' : '')}<span class="col"><a class="trunc nomePiloto" href="#/piloto/${id}">${esc(nome)}</a><span class="peq trunc" style="${c.hoje ? 'color: var(--okTxt); font-weight: 600' : ''}">${esc(sub)}</span></span><span class="cIdade">${ida != null ? ida + ' anos' : '—'}</span><span class="cPeso">${c.peso ? (+c.peso).toLocaleString('pt-BR') + ' kg' : '—'}</span><span class="cContato">${fone ? `<span class="trunc">${esc(fone)}</span>${wa ? `<a class="btnZap" href="${esc(wa)}" target="_blank" rel="noopener" aria-label="WhatsApp de ${esc(nome)}" title="Abrir no WhatsApp">${svg(IC.zap, 14, 'var(--kib-cor-estado-sucesso-texto)', 2.2)}</a>` : ''}` : `<span class="trunc peq">${esc(c.email || (c.responsavelNome ? 'via ' + nomeBonitoPiloto(c.responsavelNome) : '—'))}</span>`}</span><b class="cBat">${car ? car.baterias : 0}</b><span class="cMelhor col">${car && car.melhor ? `<b class="mono">${fmtVolta(car.melhor.ms)}</b><span class="peq trunc">${esc(car.melhor.tracado)}</span>` : '<span class="peq">—</span>'}</span><span class="cUltima" style="${c.hoje ? 'font-weight: 700; color: var(--okTxt)' : 'color: var(--tinta2)'}">${c.hoje ? 'hoje · ' + c.hoje : diasAtras(car && car.ultima)}</span><span class="cAtencao">${atencao(c)}</span></div>`;
  };

  const pintarFiltros = () => {
    const PRINCIPAIS = ['todos', 'hoje', 'ativos', 'incompletos'];
    $('#filtrosP').innerHTML = FILTROS.filter(([f]) => PRINCIPAIS.includes(f)).map(([f, t, key, dica]) => {
      const sel = P.filtro === f && !P.q; const cont = resumo && resumo[key] ? n(resumo[key]) : '';
      return `<button role="tab" aria-selected="${sel}" data-filtro="${f}" class="${sel ? 'sel' : ''}" title="${esc(dica)}" style="border-radius: var(--kib-raio-janela)">${t} <span>${cont}</span></button>`;
    }).join('');
    const mais = $('#maisPil'), emMais = !PRINCIPAIS.includes(P.filtro) && !P.q;
    mais.innerHTML = `<option value="">${emMais ? '' : 'Mais filtros'}</option>` + FILTROS.filter(([f]) => !PRINCIPAIS.includes(f)).map(([f, t, key]) => `<option value="${f}">${t}${resumo && resumo[key] ? ' · ' + n(resumo[key]) : ''}</option>`).join('');
    mais.value = emMais ? P.filtro : ''; mais.classList.toggle('sel', emMais);
    const sel = $('#ordemPil');
    [...sel.options].forEach((o) => { const ok = ordemValida(o.value); o.disabled = !ok; o.textContent = ORDENS.find((x) => x[0] === o.value)[1] + (ok ? '' : ` (${o.dataset.porque})`); });
    sel.value = P.ordem;
  };

  const pintarStatus = () => {
    const el = $('#statusP'); if (!el) return;
    const botao = '';
    el.innerHTML = erro
      ? `<span class="ponto" style="background: var(--kib-cor-estado-perigo-solido)"></span><span class="cor-erro">Sem conexão${ultimaOk ? ` · dados de ${hhmm(ultimaOk)}` : ''}</span>${botao}`
      : `<span class="ponto ${ocupado ? '' : 'pulso'}" style="background: var(--kib-cor-status-ok)"></span><span class="cor-ok">${ocupado ? 'Atualizando…' : `Ao vivo · ${ultimaOk ? hhmm(ultimaOk) : '—'}`}</span>${botao}`;
  };

  const pagina = () => lista ? Math.max(1, Math.ceil(lista.total / lista.porPagina)) : 1;
  const pintarRodape = () => {
    const el = $('#rodapeP'); if (!el || !lista) { if (el) el.innerHTML = ''; return; }
    const ini = (lista.pagina - 1) * lista.porPagina;
    const paginar = !P.q && lista.total > lista.porPagina;
    el.innerHTML = `<span style="display: inline-flex; align-items: center; gap: var(--kib-espaco-meio)"><span class="ponto" style="width: 10px; height: 10px; background: var(--kib-cor-status-ok)"></span>contorno verde = correndo hoje</span>
      <span class="peq">${lista.total ? `${n(ini + 1)}–${n(ini + lista.linhas.length)} de ${n(lista.total)}` : ''}</span>
      ${paginar ? `<span class="paginador"><button class="btn sec icone" data-pag="-1" aria-label="Página anterior" ${lista.pagina <= 1 ? 'disabled' : ''}>${svg(IC.esq, 14)}</button>
        <label class="peq">Página <input class="entrada pagIr" id="pagIr" type="number" min="1" max="${pagina()}" value="${lista.pagina}" inputmode="numeric" aria-label="Ir para a página"> de ${n(pagina())}</label>
        <button class="btn sec icone" data-pag="1" aria-label="Próxima página" ${lista.pagina >= pagina() ? 'disabled' : ''}>${svg(IC.dir, 14)}</button></span>` : ''}`;
  };

  const pintarAviso = () => {
    const el = $('#avisoP'); if (!el) return;
    const partes = [];
    if (erro) partes.push(`<div class="avisoErro" role="alert"><span><b>Não deu para atualizar a lista.</b> ${lista ? `Mostrando os dados de ${hhmm(ultimaOk || new Date())}.` : 'Nada foi perdido: a busca e o filtro continuam como estavam.'}</span><button type="button" class="btn sec peq" data-atualizar>Tentar de novo</button></div>`);
    if (P.q && lista) partes.push(`<div class="resumoBusca" role="status"><span><b>${n(lista.total)}</b> ${lista.total === 1 ? 'resultado' : 'resultados'} para “${esc(P.q)}”${lista.total >= 100 ? ' · só os 100 primeiros: refine a busca' : ''}</span><span style="margin-left: auto; display: flex; align-items: center; gap: var(--kib-espaco-1); flex-wrap: wrap"><span class="peq">Não é nenhum destes?</span><a class="btn sec peq" href="#/piloto/novo">Cadastrar novo cliente</a><button type="button" class="btn sec peq" data-limpar>Limpar busca</button></span></div>`);
    el.innerHTML = partes.join('');
  };

  const pintarSelecao = () => {
    const el = $('#barraSelP'); if (!el) return;
    $('#cartela').classList.toggle('selecionando', P.selecionando);
    const modo = tela.querySelector('[data-sel-modo]'); if (modo) { modo.setAttribute('aria-pressed', P.selecionando); modo.firstChild.textContent = P.selecionando ? 'Sair da seleção ' : 'Selecionar vários '; }
    el.innerHTML = P.selecionando
      ? `<div class="barraSel" role="region" aria-label="Seleção"><b>${P.sel.size ? `${n(P.sel.size)} ${P.sel.size === 1 ? 'selecionado' : 'selecionados'}` : 'Marque os clientes'}</b>
          <span class="peq">${P.sel.size ? '' : 'A seleção vale entre páginas e filtros.'}</span>
          <span style="margin-left: auto; display: flex; gap: var(--kib-espaco-meio); flex-wrap: wrap"><button type="button" class="btn sec peq" data-copiar ${P.sel.size ? '' : 'disabled'}>Copiar telefones</button><button type="button" class="btn sec peq" data-csv ${P.sel.size ? '' : 'disabled'}>Baixar planilha (CSV)</button><button type="button" class="btn sec peq" data-sel-limpar ${P.sel.size ? '' : 'disabled'}>Limpar seleção</button></span></div>`
      : '';
  };

  const vazio = () => {
    if (erro && !lista) return `<div class="vazio"><b>Não foi possível carregar a lista</b><span>${esc(erro)}</span><button type="button" class="btn prim" style="margin-top: var(--kib-espaco-1)" data-atualizar>Tentar de novo</button></div>`;
    if (P.q) return `<div class="vazio"><b>Nenhum cliente com “${esc(P.q)}”</b><span>Tente só o sobrenome, o CPF só com números ou parte do telefone.</span><span style="display: flex; gap: var(--kib-espaco-1); margin-top: var(--kib-espaco-1)"><button type="button" class="btn sec" data-limpar>Limpar busca</button><a class="btn prim" href="#/piloto/novo">Cadastrar novo cliente</a></span></div>`;
    return `<div class="vazio"><b>${P.filtro === 'hoje' ? 'Ninguém reservado para hoje ainda' : 'Ninguém nesse filtro agora'}</b><span>${P.filtro === 'hoje' ? 'Quando houver reservas, elas aparecem aqui.' : 'Escolha outro filtro ou veja todos.'}</span><button type="button" class="btn sec" style="margin-top: var(--kib-espaco-1)" data-filtro="todos">Ver todos</button></div>`;
  };

  const pintarLista = () => {
    const el = $('#listaP'); if (!el) return;
    if (!lista || !lista.linhas.length) { el.innerHTML = vazio(); return; }
    const todos = lista.linhas.every((c) => P.sel.has(c.id));
    el.innerHTML = `<div class="tabelaPilotos" role="table" aria-label="Clientes"><div class="linhaPiloto cab" role="row"><span class="cSel"><input type="checkbox" data-sel-todos aria-label="Selecionar todos desta página" ${todos ? 'checked' : ''}></span><span></span><span>Piloto</span><span class="cIdade">Idade</span><span class="cPeso">Peso</span><span class="cContato">Contato</span><span class="cBat">Baterias</span><span class="cMelhor">Melhor volta</span><span class="cUltima">Última vez</span><span class="cAtencao">Atenção</span></div>${lista.linhas.map(linha).join('')}</div>`;
    el.querySelectorAll('.linhaPiloto.cab > span').forEach((c) => c.setAttribute('role', 'columnheader'));
    el.querySelectorAll('.linhaPiloto.hov').forEach((r) => { r.tabIndex = 0; [...r.children].forEach((c) => c.setAttribute('role', 'cell')); });
  };

  const repintar = () => { pintarFiltros(); pintarStatus(); pintarAviso(); pintarSelecao(); pintarLista(); pintarRodape(); $('#cartela').setAttribute('aria-busy', ocupado); $('#listaP').classList.toggle('carregando', ocupado && !!lista); };

  const anunciar = () => { const a = $('#anuncioP'); if (a && lista) a.textContent = erro ? 'Sem conexão. Mostrando os últimos dados.' : `${n(lista.total)} ${lista.total === 1 ? 'cliente' : 'clientes'}${P.q ? ` para ${P.q}` : ''}. Página ${lista.pagina} de ${pagina()}.`; };

  const salvarPreferencias = () => guarda.gravar('kib-pil', JSON.stringify({ filtro: P.filtro, ordem: P.ordem }));
  const lembrarBusca = () => {
    if (!P.q || P.q.length < 2 || !lista || !lista.total) return;
    const b = [P.q, ...buscasRecentes().filter((x) => x.toLowerCase() !== P.q.toLowerCase())].slice(0, 6);
    guarda.gravar('kib-pil-buscas', JSON.stringify(b));
    $('#recentesPil').innerHTML = b.map((x) => `<option value="${esc(x)}"></option>`).join('');
  };

  const carregar = async () => {
    if (ocupado) return;
    ocupado = true; repintar();
    try {
      if (!P.inicio) { P.inicio = true; try { const r0 = await office('/pilotos/resumo'); if (r0.hoje > 0) P.filtro = 'hoje'; } catch { /* abre em Todos */ } }
      if (!ordemValida(P.ordem)) P.ordem = 'recentes';
      const [r, l] = await Promise.all([office('/pilotos/resumo'), office(`/pilotos?filtro=${P.filtro}&pagina=${P.pagina}&ordem=${P.ordem}${window.matchMedia('(max-width: 760px)').matches ? '&por=20' : ''}&q=${encodeURIComponent(P.q)}`)]);
      resumo = r; lista = l; erro = null; ultimaOk = new Date();
    } catch (e) { erro = e.message || 'Falha de conexão'; }
    ocupado = false;
    salvarPreferencias(); repintar(); anunciar(); lembrarBusca();
    const comFoto = lista ? lista.linhas.filter((c) => c.temFoto).map((c) => c.id) : [];
    if (comFoto.length) { await carregarMiniaturas(comFoto); pintarLista(); }
  };
  const recarregar = () => carregar();

  // ---- ações
  const limparBusca = () => { const i = $('#qPil'); i.value = ''; P.q = ''; P.pagina = 1; tela.querySelector('[data-limpar]')?.setAttribute('hidden', ''); recarregar(); i.focus(); };
  const alternarSelecao = () => { P.selecionando = !P.selecionando; if (!P.selecionando) P.sel.clear(); pintarSelecao(); pintarLista(); };
  const linhaDoCliente = (id) => lista?.linhas.find((c) => c.id === id);
  const textoCsv = (v) => { const s = String(v ?? '').replace(/"/g, '""'); return `"${/^[=+\-@\t\r]/.test(s) ? "'" + s : s}"`; };
  const baixarCsv = () => {
    const linhas = [['Nome', 'Telefone', 'E-mail', 'Idade', 'Peso (kg)'], ...[...P.sel.values()].map((c) => [c.nome, c.telefone || '', c.email || '', c.idade ?? '', c.peso ?? ''])];
    const blob = new Blob(['﻿' + linhas.map((l) => l.map(textoCsv).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `pilotos-${hojeIso()}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(`Planilha com ${P.sel.size} ${P.sel.size === 1 ? 'cliente' : 'clientes'} baixada`);
  };
  const copiarTelefones = async () => {
    const txt = [...P.sel.values()].filter((c) => c.telefone).map((c) => `${nomeBonitoPiloto(c.nome)}: ${c.telefone}`).join('\n');
    if (!txt) return toast('Nenhum dos selecionados tem telefone', true);
    try { await navigator.clipboard.writeText(txt); toast('Telefones copiados'); } catch { toast('O navegador não deixou copiar: use a planilha (CSV)', true); }
  };
  const ajuda = () => {
    const m = modal(`<div class="modalTopo"><span class="col" style="gap: var(--kib-espaco-meio)"><span style="font-size: var(--kib-fonte-tamanho-titulo); font-weight: 700">Como ler a lista de pilotos</span><span class="peq">Avisos da coluna Atenção e atalhos do teclado</span></span></div>
      <div style="padding: var(--kib-espaco-2) var(--kib-espaco-3); display: grid; gap: var(--kib-espaco-2)">
        <div class="col" style="gap: var(--kib-espaco-1)"><b>Avisos</b>
          <span><span class="chip vermelho">Bloqueado</span> não pode reservar nem correr.</span>
          <span><span class="chip vermelho">Possível duplicado</span> outro cadastro com o mesmo CPF ou nome parecido. Clique no aviso para abrir o outro.</span>
          <span><span class="chip laranja">Nome igual ao do responsável</span> menor cadastrado com o nome de quem responde por ele.</span>
          <span><span class="chip azul">Menor · Nome</span> menor de idade e seu responsável.</span>
          <span><span class="chip laranja">Falta CPF</span> só aparece para quem corre hoje. Os demais ficam como “incompleto”.</span></div>
        <div class="col" style="gap: var(--kib-espaco-1)"><b>Atalhos</b>
          <span><kbd>/</kbd> buscar · <kbd>↑</kbd> <kbd>↓</kbd> ou <kbd>J</kbd> <kbd>K</kbd> mover pela lista · <kbd>Enter</kbd> abrir o perfil</span>
          <span><kbd>N</kbd> novo cliente · <kbd>R</kbd> ranking · <kbd>S</kbd> selecionar vários · <kbd>Esc</kbd> limpar a busca · <kbd>H</kbd> esta ajuda · <kbd>?</kbd> ajuda geral do painel</span></div>
        <span class="peq">Mais explicações em <a href="#/ajuda" data-acao="fechar">Ajuda e tutorial</a>.</span>
      </div><div class="modalRodape"><button class="btn prim" style="margin-left: auto" data-acao="fechar">Entendi</button></div>`);
    m.style.maxWidth = '640px';
  };
  const mover = (d) => {
    const rows = [...tela.querySelectorAll('.linhaPiloto.hov')]; if (!rows.length) return;
    const i = rows.indexOf(document.activeElement?.closest?.('.linhaPiloto.hov'));
    rows[Math.max(0, Math.min(rows.length - 1, i < 0 ? (d > 0 ? 0 : rows.length - 1) : i + d))].focus();
  };
  const irPagina = (p) => { const alvo = Math.max(1, Math.min(pagina(), Math.floor(+p) || 1)); if (alvo === P.pagina) return; P.pagina = alvo; recarregar(); window.scrollTo(0, 0); };

  // ---- eventos
  tela.addEventListener('click', (e) => {
    const pular = e.target.closest('#linkPularRank');
    if (pular) {
      e.preventDefault();
      const tab = $('#tabelaRank');
      if (tab) {
        tab.scrollIntoView({ behavior: 'smooth' });
        tab.focus();
      }
      return;
    }
    const t = e.target;
    const menu = tela.querySelector('.menuMais'); if (menu && menu.open && (!t.closest('.menuMais') || t.closest('.menuLista button'))) menu.open = false;
    if (t.closest('[data-limpar]')) return limparBusca();
    if (t.closest('[data-atualizar]')) return recarregar();
    if (t.closest('[data-ajuda]')) return ajuda();
    if (t.closest('[data-sel-modo]')) return alternarSelecao();
    if (t.closest('[data-copiar]')) return copiarTelefones();
    if (t.closest('[data-csv]')) return baixarCsv();
    if (t.closest('[data-sel-limpar]')) { P.sel.clear(); pintarSelecao(); pintarLista(); return; }
    if (t.closest('a, select, input')) return;
    const f = t.closest('[data-filtro]'); if (f) { P.filtro = f.dataset.filtro; P.q = ''; $('#qPil').value = ''; P.pagina = 1; recarregar(); return; }
    const pg = t.closest('[data-pag]'); if (pg) { irPagina(P.pagina + +pg.dataset.pag); return; }
    if (t.closest('.cSel')) return;
    const l = t.closest('[data-href]'); if (l) location.hash = l.dataset.href;
  });
  tela.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'maisPil') { if (t.value) { P.filtro = t.value; P.q = ''; $('#qPil').value = ''; P.pagina = 1; recarregar(); } return; }
    if (t.id === 'ordemPil') { P.ordem = t.value; P.pagina = 1; recarregar(); return; }
    if (t.id === 'pagIr') { irPagina(t.value); return; }
    if (t.dataset.sel) {
      const id = +t.dataset.sel, c = linhaDoCliente(id);
      if (t.checked && c) P.sel.set(id, { nome: c.nome, telefone: c.telefone, email: c.email, idade: idadeDe(c.nascimento), peso: c.peso }); else P.sel.delete(id);
      pintarSelecao(); const todos = tela.querySelector('[data-sel-todos]'); if (todos) todos.checked = lista.linhas.every((x) => P.sel.has(x.id));
      return;
    }
    if (t.dataset.selTodos !== undefined && 'selTodos' in t.dataset) {
      for (const c of lista.linhas) { if (t.checked) P.sel.set(c.id, { nome: c.nome, telefone: c.telefone, email: c.email, idade: idadeDe(c.nascimento), peso: c.peso }); else P.sel.delete(c.id); }
      pintarSelecao(); pintarLista();
    }
  });
  let tq;
  tela.addEventListener('input', (e) => {
    if (e.target.id !== 'qPil') return;
    const v = e.target.value.trim(); tela.querySelector('[data-limpar]')?.toggleAttribute('hidden', !e.target.value);
    clearTimeout(tq); tq = setTimeout(() => { P.q = v; P.pagina = 1; recarregar(); }, 300);
  });
  tela.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList?.contains('linhaPiloto') && e.target.dataset.href) location.hash = e.target.dataset.href;
    if (e.key === 'Enter' && e.target.id === 'qPil') { clearTimeout(tq); P.q = e.target.value.trim(); P.pagina = 1; recarregar(); }
  });
  S.tela.atalho = (e) => {
    if ($('#camada').innerHTML || e.ctrlKey || e.metaKey || e.altKey) return;
    const ativo = document.activeElement, digitando = /INPUT|SELECT|TEXTAREA/.test(ativo?.tagName || '');
    if (e.key === 'Escape' && tela.querySelector('.menuMais[open]')) { tela.querySelector('.menuMais').open = false; return; }
    if (e.key === 'Escape') { if (P.q || (ativo && ativo.id === 'qPil' && ativo.value)) limparBusca(); else if (P.selecionando) alternarSelecao(); return; }
    if (ativo?.id === 'qPil' && e.key === 'ArrowDown') { e.preventDefault(); mover(1); return; }
    if (digitando) return;
    const k = e.key.toLowerCase();
    if (e.key === '/') { e.preventDefault(); $('#qPil')?.focus(); }
    else if (k === 'h') ajuda();
    else if (k === 'n') location.hash = '#/piloto/novo';
    else if (k === 'r') location.hash = '#/ranking';
    else if (k === 's') alternarSelecao();
    else if (k === 'j' || e.key === 'ArrowDown') { e.preventDefault(); mover(1); }
    else if (k === 'k' || e.key === 'ArrowUp') { e.preventDefault(); mover(-1); }
  };

  await carregar();
  if (!window.matchMedia('(max-width: 760px)').matches && !P.focado) { P.focado = true; $('#qPil')?.focus(); }
  repetir(() => { const a = document.activeElement; if (a?.id !== 'qPil' && a?.id !== 'pagIr' && a?.tagName !== 'SELECT' && !a?.closest?.('.linhaPiloto') && !$('#camada').innerHTML) carregar().catch(() => undefined); }, 30_000);
};

// ------------------------------------------------------------------ perfil
TELAS.piloto = async (tela) => {
  document.querySelectorAll('.navItem').forEach((a) => a.classList.toggle('atual', a.getAttribute('href') === '#/pilotos'));
  const idTxt = (location.hash.match(/^#\/piloto\/(\w+)/) || [])[1] || 'novo';
  const novo = idTxt === 'novo', id = novo ? null : +idTxt;
  const V = S.pilV || (S.pilV = { aba: 0 });
  if (novo) V.aba = 1;
  const mostrar = { hist: false, antigo: false };
  let d = null, foto = null;
  const vazioCli = { nome: '', tipoDocumento: 'CPF', documento: '', email: '', instagram: '', telefone: '', nascimento: '', sexo: '', peso: '', cep: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', observacao: '', bloqueado: false };
  const carregar = async () => {
    if (novo) { d = { cliente: { ...vazioCli }, resumo: null, tracados: [], evolucao: [], corridas: [], totalCorridas: 0, dependentes: [], laptime: [] }; return; }
    d = await office(`/pilotos/${id}`);
    foto = null;
    if (d.cliente.temFoto) { try { foto = (await office(`/pilotos/${id}/foto`)).foto; } catch { foto = null; } }
  };
  const pintar = () => {
    const c = d.cliente, r = d.resumo || { baterias: 0, voltas: 0, vitorias: 0, podios: 0 }, ida = idadeDe(c.nascimento), nome = nomeBonitoPiloto(c.nome);
    const insta = instagramValido(c.instagram) ? '@' + String(c.instagram).replace(/^@/, '') : null;
    const sub = [ida != null ? ida + ' anos' : null, c.peso ? (+c.peso).toLocaleString('pt-BR') + ' kg' : null, c.cidade ? nomeBonitoPiloto(c.cidade) + (c.estado ? '/' + String(c.estado).toUpperCase() : '') : null, insta].filter(Boolean).map(esc).join(' · ');
    const fin = d.financeiro && +d.financeiro.vendas ? `${brlCurto(d.financeiro.total)} em ${(+d.financeiro.vendas).toLocaleString('pt-BR')} ${+d.financeiro.vendas === 1 ? 'compra' : 'compras'} · última ${dataCurta(d.financeiro.ultima)}` : null;
    const wa = zapPiloto(c.telefone, c.nome);
    const avisos = [
      d.duplicado ? `<p class="avisoPerfil vermelho">Possível cadastro duplicado: <a href="#/piloto/${d.duplicado.id}">${esc(nomeBonitoPiloto(d.duplicado.nome))} (cliente ${d.duplicado.id})</a> tem o mesmo CPF, ou o mesmo nome com o mesmo telefone ou nascimento. Confira antes de reservar.</p>` : '',
      c.responsavelNome && nomeBonitoPiloto(c.responsavelNome) === nome ? `<p class="avisoPerfil">Este menor está com o mesmo nome do responsável. Corrija o nome em “Dados e cadastro”.</p>` : '',
      c.instagram && !insta ? `<p class="avisoPerfil">O Instagram cadastrado (“${esc(c.instagram)}”) não é um usuário válido. Corrija em “Dados e cadastro”.</p>` : '',
    ].join('');
    tela.innerHTML = `<header class="cab" style="align-items: center"><a class="btn branco" href="#/pilotos">${svg(IC.esq, 14)}Pilotos</a><span class="peq peso-semibold">${novo ? 'Novo cliente · os mesmos campos obrigatórios do totem' : `Cliente ${c.id} · cadastrado em ${dataBr(c.criadoEm)}`}</span></header>
    <main class="principal">
      <section class="heroPiloto">
        <div style="position: relative; flex-shrink: 0">${foto ? `<img src="${foto}" alt="Foto de ${esc(nome)}" class="fotoGrande" style="${d.hoje ? 'box-shadow: 0 0 0 3px var(--kib-cor-status-ok)' : ''}">` : `<div class="fotoGrande semFoto" role="img" aria-label="${novo ? 'Sem foto' : 'Sem foto: ' + esc(nome)}" style="${d.hoje ? 'box-shadow: 0 0 0 3px var(--kib-cor-status-ok)' : ''}">${novo ? svg(IC.pilotos, 44, 'var(--kib-cor-borda-campo)', 1.8) : esc(iniciais(nome))}</div>`}
          ${novo ? '' : `<button type="button" class="btnFoto" data-foto="1" aria-label="${foto ? 'Trocar a foto' : 'Colocar foto'}" title="${foto ? 'Trocar a foto' : 'Colocar foto'}">${svg('M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', 20, 'var(--kib-cor-texto-principal)', 2)}</button>`}</div>
        <div class="col" style="gap: var(--kib-espaco-meio); flex: 1 1 320px">
          ${d.hoje ? `<span class="statusHero"><span class="ponto" style="width: 7px; height: 7px; background: var(--kib-cor-status-ok)"></span>Correndo hoje · ${esc(d.hoje)}</span>` : c.bloqueado ? '<span class="statusHero" style="color: var(--kib-cor-estado-perigo-fundo)">Bloqueado: não pode reservar nem correr</span>' : ''}
          <h1 class="nomeHero">${esc(nome || 'Novo cliente')}</h1>
          ${sub ? `<span style="font-size: var(--kib-fonte-tamanho-corpo); color: var(--kib-cor-borda-sutil)">${sub}</span>` : ''}
          ${novo ? '' : `<span style="display: flex; flex-wrap: wrap; gap: var(--kib-espaco-1); align-items: center; margin-top: var(--kib-espaco-meio)">${wa ? `<a class="btn" href="${esc(wa)}" target="_blank" rel="noopener" style="height: 34px; background: color-mix(in srgb, var(--kib-cor-status-ok) 18%, transparent); color: var(--kib-cor-categoria-verde-topo)">${svg(IC.zap, 14, 'var(--kib-cor-categoria-verde-topo)', 2.2)}WhatsApp</a>` : ''}${fin ? `<span style="font-size: var(--kib-fonte-tamanho-corpo); color: var(--kib-cor-icone-suave)">${esc(fin)}</span>` : ''}</span>`}
        </div>
        ${novo ? '' : `<div class="numerosHero">${[[r.baterias, 'baterias'], [r.voltas, 'voltas'], [r.vitorias, 'vitórias'], [r.podios, 'pódios']].map(([v, t]) => `<span><b>${(+v || 0).toLocaleString('pt-BR')}</b><span>${t}</span></span>`).join('')}</div>`}
      </section>
      ${avisos}
      ${novo ? '' : `<div class="seg" role="tablist" aria-label="Seções do perfil" style="align-self: flex-start">${['Carreira', 'Dados e cadastro'].map((t, i) => `<button role="tab" aria-selected="${V.aba === i}" data-aba="${i}" class="${V.aba === i ? 'sel' : ''}" style="height: 36px">${t}</button>`).join('')}</div>`}
      <div id="corpoPiloto" style="display: flex; flex-direction: column; gap: var(--kib-espaco-2)"></div>
    </main>`;
    $('#corpoPiloto').innerHTML = V.aba === 0 && !novo ? htmlCarreira() : htmlDados();
  };
  const htmlCarreira = () => {
    const posChip = (p) => (p ? `<span class="chip ${p.pos === 1 ? 'ouro' : 'cinza'}" title="${p.pos}º de ${p.de} pilotos">${p.pos}º de ${p.de}</span>` : '<span class="peq">—</span>');
    const ev = d.evolucao || [], vals = ev.map((x) => x.ms), mx = Math.max(...vals), mn = Math.min(...vals), faixa = Math.max(1, mx - mn);
    const melhores = `<section class="cartao" style="flex: 1 1 440px; min-width: 0"><div class="cartaoCab"><h2>Melhores voltas por traçado</h2><span class="sub">sem baterias de chuva · Indoor e Super Kart separados</span></div>
        <div class="tabelaTracados"><div class="linhaTracado cab"><span>Traçado</span><span>Melhor</span><span>Semana</span><span>Mês</span></div>
        ${d.tracados.map((t) => `<div class="linhaTracado"><span class="col"><b>${esc(t.nome)}</b><span class="peq">${dataCurta(t.dia)} · ${t.corridas ? `${esc(t.bateria)} · ${t.corridas} ${t.corridas === 1 ? 'bateria' : 'baterias'}` : 'ranking mensal'}</span></span><b class="mono">${fmtVolta(t.ms)}</b>${posChip(t.semana)}${posChip(t.mes)}</div>`).join('') || '<p class="peq cartao-corpo">Só correu em baterias de chuva até agora.</p>'}</div>
        <p class="peq" style="margin: 0; padding: var(--kib-espaco-1) var(--kib-espaco-2); background: var(--sup2); border-top: 1px solid var(--linha)">Posição no ranking da semana e do mês de cada traçado. <a href="#/ranking">Ver ranking</a></p></section>`;
    const lt = d.laptime || [], lr = d.laptimeResumo;
    const antigo = lt.length ? `<section class="cartao"><div class="cartaoCab"><span class="col"><h2>Ranking de 2025 e 2026</h2><span class="sub">ranking mensal de jan/2025 a set/2026 · só os 10 primeiros de cada faixa de peso</span></span>
        ${lr ? `<span class="dir resumoAntigo"><span><b>${lr.meses}</b> ${lr.meses === 1 ? 'mês' : 'meses'} no top 10</span>${d.semanasTop ? `<span><b>${d.semanasTop}</b> ${d.semanasTop === 1 ? 'semana' : 'semanas'} no top 10</span>` : ''}<span><b>${lr.vitorias}</b> ${lr.vitorias === 1 ? 'vez' : 'vezes'} em 1º</span></span>` : ''}</div>
        <div class="tabelaAntigo"><div class="linhaAntigo cab"><span>Mês</span><span>Traçado</span><span>Posição</span><span>Melhor volta</span></div>
        ${(mostrar.antigo ? lt : lt.slice(0, 8)).map((x) => `<div class="linhaAntigo"><span>${esc(x.periodo.charAt(0).toUpperCase() + x.periodo.slice(1))}</span><span class="trunc">${esc(x.tracado)}</span><span><b style="${x.pos === 1 ? 'color: var(--kib-cor-estado-aviso-texto)' : ''}">${x.pos}º</b> <span class="peq">${x.faixa ? esc(nomeBonitoPiloto(x.faixa).replace(/ Kg\b/g, ' kg').replace(/ Até /g, ' até ').replace(/^Até /, 'Até ').replace(/ De /g, ' de ')) : ''}</span></span><b class="mono">${fmtVolta(x.ms)}</b></div>`).join('')}</div>
        ${lt.length > 8 ? `<button class="btn sec peq" data-mais="antigo" style="margin: var(--kib-espaco-1) var(--kib-espaco-2) var(--kib-espaco-denso-12)">${mostrar.antigo ? 'Mostrar menos' : `Ver os ${lt.length} meses`}</button>` : ''}</section>` : '';
    if (!d.totalCorridas) return (d.tracados.length ? `<div class="linhaFlex">${melhores}</div>` : `<section class="cartao"><div class="vazio"><b>Ainda não correu desde ${dataBr(d.desde)}</b><span>Não há corridas deste piloto na cronometragem nova nem no ranking antigo.</span></div></section>`) + antigo;
    const grafico = ev.length > 1 ? `<div class="graficoEv" role="img" aria-label="Melhor volta foi de ${fmtVolta(ev[0].ms)} para ${fmtVolta(ev[ev.length - 1].ms)} nas últimas ${ev.length} baterias; a melhor foi ${fmtVolta(mn)}"><span class="escalaEv" aria-hidden="true"><span>${fmtVolta(mn)}</span><span>${fmtVolta(mx)}</span></span>${ev.map((x) => `<span title="${dataBr(x.dia)} · ${esc(x.bateria)} · ${fmtVolta(x.ms)}"><span class="barraEv" style="height: ${Math.round(((mx - x.ms) / faixa) * 110 + 14)}px; ${x.ms === mn ? 'background: var(--verde)' : ''}"></span></span>`).join('')}</div><div class="rodapeEv peq"><span>${dataCurta(ev[0].dia)}</span><span><span class="ponto" style="width: 8px; height: 8px; background: var(--verde)"></span> melhor volta: ${fmtVolta(mn)}</span><span>${dataCurta(ev[ev.length - 1].dia)}</span></div>` : '<p class="peq cartao-corpo">O gráfico aparece a partir da segunda bateria no mesmo traçado.</p>';
    const hist = mostrar.hist ? d.corridas : d.corridas.slice(0, 12);
    return `<div class="linhaFlex">${melhores}
      <section class="cartao" style="flex: 1 1 400px; min-width: 0"><div class="cartaoCab"><h2>Evolução${d.principal ? ' no ' + esc(d.principal) : ''}</h2><span class="sub">melhor volta de cada bateria · barra mais alta = mais rápido</span></div>${grafico}</section>
    </div>
    <section class="cartao"><div class="cartaoCab"><h2>Histórico de baterias</h2><span class="sub">${d.totalCorridas} ${d.totalCorridas === 1 ? 'bateria' : 'baterias'} desde ${dataBr(d.desde)} · toque para abrir o resultado (as mais antigas só têm o resumo)</span></div>
      <div class="tabelaHist"><div class="linhaHist cab"><span>Data</span><span>Bateria</span><span class="hTracado">Traçado</span><span>Posição</span><span class="hKart">Kart</span><span class="hVoltas">Voltas</span><span>Melhor</span></div>
      ${hist.map((x) => { const lt2 = true; return `<${lt2 ? 'div' : 'button'} class="linhaHist ${lt2 ? '' : 'hov'}" ${lt2 ? '' : `data-resultado="${esc(x.sessaoId)}"`}><span class="mono">${dataCurta(x.dia)}</span><b class="trunc">${esc(x.bateria)}</b><span class="trunc hTracado cor-corpo">${esc(x.tracado)}${x.chuva ? ' <span class="chip azul">chuva</span>' : ''}</span><b style="${x.pos === 1 ? 'color: var(--kib-cor-estado-aviso-texto)' : x.pos <= 3 ? '' : 'color: var(--mudo)'}">${x.dq ? 'DC' : x.pos ? x.pos + 'º' : '<span class="peq" title="Só sobrou a reserva paga desta bateria">sem tempo</span>'}${x.pos ? `<span class="peq" style="font-weight: 500"> de ${x.de}</span>` : ''}</b><span class="hKart">${x.kart ? `<span class="kart">${esc(x.kart)}</span>` : '—'}</span><span class="hVoltas">${x.voltas}</span><b class="mono">${fmtVolta(x.melhor)}</b></${lt2 ? 'div' : 'button'}>`; }).join('')}</div>
      ${d.corridas.length > 12 ? `<button class="btn sec peq" data-mais="hist" style="margin: var(--kib-espaco-1) var(--kib-espaco-2) var(--kib-espaco-denso-12)">${mostrar.hist ? 'Mostrar menos' : `Ver todas as ${d.totalCorridas}`}</button>` : ''}</section>${antigo}`;
  };
  const CAMPOS = [['nome', 'Nome completo', 'text', 'name'], ['documento', 'CPF', 'text', 'off', 'numeric'], ['nascimento', 'Nascimento', 'date'], ['sexo', 'Sexo', 'sexo'], ['peso', 'Peso (kg)', 'text', 'off', 'decimal'], ['telefone', 'Celular (WhatsApp)', 'tel', 'tel', 'tel'], ['email', 'E-mail', 'email', 'email'], ['instagram', 'Instagram (usuário, sem @)', 'text', 'off'], ['cep', 'CEP', 'text', 'postal-code', 'numeric'], ['endereco', 'Endereço', 'text', 'street-address'], ['numero', 'Número', 'text', 'off'], ['complemento', 'Complemento', 'text', 'off'], ['bairro', 'Bairro', 'text', 'off'], ['cidade', 'Cidade', 'text', 'address-level2'], ['estado', 'UF', 'text', 'address-level1']];
  const htmlDados = () => {
    const c = d.cliente;
    return `<section class="cartao"><div class="cartaoCab"><h2>Dados do cadastro</h2><span class="sub">e-mail e peso são obrigatórios, como no totem · salvar vale na hora para Recepção, totem e site</span></div>
      <form id="fPiloto" class="formPiloto" novalidate>
        ${CAMPOS.map(([k, t, tipo, ac, im]) => `<label class="campo"><span>${t}</span>${tipo === 'sexo' ? `<select class="entrada" name="sexo"><option value="" ${!c.sexo ? 'selected' : ''}>Não informado</option><option value="M" ${c.sexo === 'M' ? 'selected' : ''}>Masculino</option><option value="F" ${c.sexo === 'F' ? 'selected' : ''}>Feminino</option></select>` : `<input class="entrada" name="${k}" type="${tipo}" value="${esc(c[k] ?? '')}" autocomplete="${ac || 'off'}" ${im ? `inputmode="${im}"` : ''} ${k === 'nome' ? 'required' : ''} ${k === 'instagram' && c.instagram && !instagramValido(c.instagram) ? 'aria-invalid="true" style="box-shadow: inset 0 0 0 2px var(--aviso)"' : ''}>`}</label>`).join('')}
        <label class="campo linha-toda"><span>Observação (só a equipe vê)</span><textarea class="entrada" name="observacao" rows="2" style="height: auto; padding: var(--kib-espaco-1) var(--kib-espaco-denso-12)">${esc(c.observacao || '')}</textarea></label>
        ${c.responsavelNome ? `<p class="peq" style="grid-column: 1 / -1; margin: 0">Menor de idade · responsável: <a href="#/piloto/${c.responsavelId}">${esc(nomeBonitoPiloto(c.responsavelNome))}</a></p>` : ''}
        ${d.dependentes && d.dependentes.length ? `<p class="peq" style="grid-column: 1 / -1; margin: 0">Responsável por: ${d.dependentes.map((x) => `<a href="#/piloto/${x.id}">${esc(nomeBonitoPiloto(x.nome))}</a>`).join(', ')}</p>` : ''}
      </form>
      <p class="erroMsg" id="erroPiloto" role="alert" style="margin: 0; padding: 0 var(--kib-espaco-2) var(--kib-espaco-1)"></p>
      <div class="modalRodape" style="border-top: 1px solid var(--linha)"><label style="display: flex; align-items: center; gap: var(--kib-espaco-1); font-weight: 600"><input type="checkbox" id="chBloq" ${c.bloqueado ? 'checked' : ''} style="width: 18px; height: 18px">Bloqueado (não pode reservar nem correr)</label><span style="margin-left: auto; display: flex; gap: var(--kib-espaco-1)"><button type="button" class="btn sec" data-desfazer="1">Desfazer</button><button type="button" class="btn prim" data-salvar="1">${novo ? 'Criar cliente' : 'Salvar alterações'}</button></span></div></section>`;
  };
  const salvar = async (botao) => {
    const f = new FormData($('#fPiloto'));
    const dados = { ...d.cliente };
    CAMPOS.forEach(([k]) => { dados[k] = String(f.get(k) ?? '').trim() || null; });
    dados.observacao = String(f.get('observacao') ?? '').trim() || null;
    dados.bloqueado = $('#chBloq').checked;
    dados.peso = dados.peso ? String(dados.peso).replace(',', '.') : null;
    dados.instagram = dados.instagram ? dados.instagram.replace(/^@/, '') : null;
    if (!dados.nome) { $('#erroPiloto').textContent = 'Digite o nome do cliente.'; return; }
    if (dados.instagram && !instagramValido(dados.instagram)) { $('#erroPiloto').textContent = 'Instagram inválido: use só o usuário (letras, números, ponto e _), sem o @.'; return; }
    ['id', 'responsavelNome', 'legadoId', 'temFoto', 'criadoEm', 'origem', 'lgpdAceiteEm'].forEach((k) => delete dados[k]);
    botao.disabled = true; botao.textContent = 'Salvando…'; $('#erroPiloto').textContent = '';
    try {
      if (novo) { const r = await office('/clientes', { method: 'POST', body: { ...dados, lgpd: true } }); toast('Cliente criado · já aparece na Recepção e no totem'); location.hash = '#/piloto/' + r.id; return; }
      await office(`/clientes/${id}`, { method: 'PUT', body: dados });
      toast('Cadastro salvo · vale na hora para Recepção, totem e site');
      await carregar(); pintar();
    } catch (er) { $('#erroPiloto').textContent = er.message; botao.disabled = false; botao.textContent = novo ? 'Criar cliente' : 'Salvar alterações'; }
  };
  const abrirFoto = () => {
    const F = { img: null, zoom: 1, x: 0, y: 0 };
    const m = modal(`<div class="modalTopo" style="background: var(--kib-cor-superficie-padrao)"><span class="col" style="gap: 2px"><span class="t-titulo-grande peso-negrito">Foto do piloto</span><span class="peq">Aparece na cartela, no perfil e no ranking.</span></span><button class="fechar hov solto" data-acao="fechar" aria-label="Fechar">${svg(IC.fechar, 15, 'var(--kib-cor-texto-principal)', 2.4)}</button></div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: var(--kib-espaco-denso-12); padding: var(--kib-espaco-denso-20) var(--kib-espaco-denso-20)">
        <canvas id="cvFoto" width="512" height="512" class="cvFoto" aria-label="Pré-visualização da foto. Arraste para enquadrar o rosto."></canvas>
        <label style="display: flex; align-items: center; gap: var(--kib-espaco-1); width: 100%; max-width: 300px" class="peq">Zoom<input class="cresce" id="zoomFoto" type="range" min="100" max="300" value="100" disabled></label>
        <span style="display: flex; flex-wrap: wrap; gap: var(--kib-espaco-1); justify-content: center"><label class="btn branco" style="height: 44px; cursor: pointer">Escolher arquivo<input id="arqFoto" type="file" accept="image/jpeg,image/png,image/webp" style="display: none"></label><label class="btn branco" style="height: 44px; cursor: pointer">Tirar com a câmera<input id="camFoto" type="file" accept="image/*" capture="user" style="display: none"></label></span>
        <span class="peq t-centro">JPG, PNG ou WEBP. A foto é reduzida para 512 px antes de salvar.</span>
      </div>
      <div class="modalRodape">${d.cliente.temFoto ? '<button class="btn perigo" data-remover-foto="1">Remover foto</button>' : ''}<span class="erroMsg" id="erroFoto"></span><button class="btn prim empurra" id="salvarFoto" disabled>Salvar foto</button></div>`);
    m.style.maxWidth = '520px';
    const cv = $('#cvFoto'), ctx = cv.getContext('2d');
    const desenhar = () => {
      ctx.fillStyle = tk('--kib-cor-borda-sutil'); ctx.fillRect(0, 0, 512, 512);
      if (!F.img) { ctx.fillStyle = tk('--kib-cor-texto-secundario'); ctx.font = '600 22px system-ui'; ctx.textAlign = 'center'; ctx.fillText('Escolha uma foto', 256, 262); return; }
      const base = Math.max(512 / F.img.width, 512 / F.img.height) * F.zoom, w = F.img.width * base, h = F.img.height * base;
      F.x = Math.min(0, Math.max(512 - w, F.x)); F.y = Math.min(0, Math.max(512 - h, F.y));
      ctx.drawImage(F.img, F.x, F.y, w, h);
    };
    const carregarArq = (file) => {
      if (!file) return;
      if (!/^image\//.test(file.type)) { $('#erroFoto').textContent = 'Esse arquivo não é uma imagem.'; return; }
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => { F.img = im; F.zoom = 1; const base = Math.max(512 / im.width, 512 / im.height); F.x = (512 - im.width * base) / 2; F.y = (512 - im.height * base) / 2; $('#zoomFoto').disabled = false; $('#zoomFoto').value = 100; $('#salvarFoto').disabled = false; $('#erroFoto').textContent = ''; desenhar(); URL.revokeObjectURL(url); };
      im.onerror = () => { $('#erroFoto').textContent = 'Não deu para abrir essa imagem.'; };
      im.src = url;
    };
    $('#arqFoto').onchange = (e) => carregarArq(e.target.files[0]);
    $('#camFoto').onchange = (e) => carregarArq(e.target.files[0]);
    $('#zoomFoto').oninput = (e) => { const z = +e.target.value / 100, c0 = 256; F.x = c0 - (c0 - F.x) * (z / F.zoom); F.y = c0 - (c0 - F.y) * (z / F.zoom); F.zoom = z; desenhar(); };
    let arr = null;
    cv.onpointerdown = (e) => { if (!F.img) return; arr = { x: e.clientX, y: e.clientY, fx: F.x, fy: F.y, k: 512 / cv.getBoundingClientRect().width }; cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = (e) => { if (!arr) return; F.x = arr.fx + (e.clientX - arr.x) * arr.k; F.y = arr.fy + (e.clientY - arr.y) * arr.k; desenhar(); };
    cv.onpointerup = () => { arr = null; };
    desenhar();
    m.onclick = async (e) => {
      if (e.target.closest('#salvarFoto')) {
        const b = e.target.closest('#salvarFoto'); b.disabled = true; b.textContent = 'Salvando…';
        const mini = document.createElement('canvas'); mini.width = mini.height = 96; mini.getContext('2d').drawImage(cv, 0, 0, 96, 96);
        try { await office(`/pilotos/${id}/foto`, { method: 'PUT', body: { foto: cv.toDataURL('image/jpeg', 0.86), miniatura: mini.toDataURL('image/jpeg', 0.8) } }); delete S.minis[id]; toast('Foto salva'); fecharCamada(); await carregar(); pintar(); }
        catch (er) { $('#erroFoto').textContent = er.message; b.disabled = false; b.textContent = 'Salvar foto'; }
      }
      if (e.target.closest('[data-remover-foto]')) {
        if (!confirm('Remover a foto deste piloto?')) return;
        try { await office(`/pilotos/${id}/foto`, { method: 'DELETE' }); delete S.minis[id]; toast('Foto removida'); fecharCamada(); await carregar(); pintar(); } catch (er) { falhou(er); }
      }
    };
  };
  tela.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-aba]'); if (a) { V.aba = +a.dataset.aba; pintar(); return; }
    if (e.target.closest('[data-foto]')) return abrirFoto();
    const mm = e.target.closest('[data-mais]'); if (mm) { mostrar[mm.dataset.mais] = !mostrar[mm.dataset.mais]; $('#corpoPiloto').innerHTML = htmlCarreira(); return; }
    const s = e.target.closest('[data-salvar]'); if (s) return salvar(s);
    if (e.target.closest('[data-desfazer]')) { pintar(); toast('Alterações desfeitas'); return; }
  });
  await carregar();
  pintar();
};

// ------------------------------------------------------------------ ranking
TELAS.ranking = async (tela) => {
  const R = S.rank || (S.rank = { periodo: 'semana', tracado: null, top: 50, ref: null, outros: false, q: '' });
  tela.innerHTML = `<a href="javascript:void(0)" onclick="event.preventDefault(); const t=document.getElementById('tabelaRank'); if(t){ t.scrollIntoView({behavior:'smooth'}); t.focus(); }" class="pularLink" id="linkPularRank">Pular para o ranking</a>
  ${cabecalho(
    'Clientes · tempos oficiais sem chuva · Indoor e Super Kart separados',
    'Ranking <span id="perRank" style="font-size: var(--kib-fonte-tamanho-titulo); font-weight: 600; color: var(--kib-cinza-600); letter-spacing: 0"></span>',
    `<div class="barraAcoesRank">
       <div class="buscaWrap">
         <label class="buscaCampo buscaRank">
           ${svg(IC.busca, 15, 'var(--kib-cor-borda-campo)')}
           <input class="t-corpo" id="qRank" type="search" autocomplete="off" value="${esc(R.q)}" placeholder="Buscar piloto ou kart (/)" aria-label="Buscar piloto ou kart pelo nome ou número">
           <kbd class="atalhoKbd" title="Pressione / para focar a busca">/</kbd>
           ${R.q ? `<button type="button" class="limpaBusca" id="btnLimpaRank" title="Limpar busca (Esc)" aria-label="Limpar busca">×</button>` : ''}
         </label>
       </div>
       <div class="seg segPeriodo" role="tablist" aria-label="Período do ranking">
         ${[['semana', 'Semana'], ['mes', 'Mês'], ['geral', 'Geral']].map(([v, t]) => `<button role="tab" data-periodo="${v}" aria-selected="${R.periodo === v}" class="${R.periodo === v ? 'sel' : ''}">${t}</button>`).join('')}
       </div>
       <a class="btn branco" href="#/pilotos" title="Ir para o cadastro de pilotos">Pilotos</a>
       <button class="btn sec ocultarCelular" data-imprimir="1" title="Imprimir ranking deste traçado para o mural">${svg(IC.ranking, 14)} Imprimir</button>
     </div>`
  )}
  <main class="principal" id="corpoRank" tabindex="-1">
    <div class="esqueleto" style="height: 520px"></div>
  </main>`;

  let dados = null;
  const pintar = () => {
    const p = dados.periodo, antigoOuGeral = R.periodo === 'geral' || dados.antigo;
    const dt = (iso) => (antigoOuGeral ? dataBr(iso) : dataCurta(iso));
    const txtPeriodo = p.de ? `· ${R.periodo === 'mes' ? MESES[deIso(p.de).getMonth()] + ' de ' + deIso(p.de).getFullYear() : `${dataBr(p.de).slice(0, 5)} a ${dataBr(p.ate)}`}` : '· desde jan/2025';
    $('#perRank').textContent = txtPeriodo;
    tela.querySelectorAll('[data-periodo]').forEach((b) => {
      const at = b.dataset.periodo === R.periodo;
      b.classList.toggle('sel', at);
      b.setAttribute('aria-selected', at);
    });

    const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const q = norm(R.q).trim();
    const todas = dados.linhas;
    const lider = todas[0];
    const L = q ? todas.filter((l) => norm(l.nome).includes(q) || String(l.kart || '') === q) : todas;
    const empate = (l) => { const i = todas.indexOf(l); return (i > 0 && todas[i - 1].ms === l.ms) || (i < todas.length - 1 && todas[i + 1].ms === l.ms); };
    const rotuloBat = (s) => {
      const t = String(s || '');
      const m = /^BATERIA FECHADA\s*-\s*(.+)$/i.exec(t);
      const bonito = (x) => nomeBonitoPiloto(x).replace(/Kac/g, 'KAC');
      return m ? `Fechada · ${bonito(m[1])}` : bonito(t).replace(/^Bateria (\d)/, 'Bateria $1');
    };
    const med = [
      'background: linear-gradient(180deg, var(--kib-cor-estado-aviso-fundo), var(--kib-cor-categoria-amarelo-topo)); color: var(--kib-cor-estado-aviso-texto-forte)',
      'background: linear-gradient(180deg, var(--kib-cor-fundo-app), var(--kib-cor-borda-forte)); color: var(--kib-cor-texto-corpo)',
      'background: linear-gradient(180deg, var(--kib-cor-estado-aviso-fundo), var(--kib-cor-categoria-ambar-base)); color: var(--kib-cor-estado-aviso-texto-forte)'
    ];
    const sub = (l) => { const i = idadeDe(l.nascimento); return [i != null && i < 18 ? 'até 17 anos' : null, !l.cid ? 'sem cadastro ligado' : null].filter(Boolean).join(' · '); };
    const origem = (l) => {
      if (l.antigo) return '<span class="chip peq neutro" title="Tempo importado do histórico de corridas">Histórico</span>';
      if (!l.bateria) return '<span class="peq mudo">—</span>';
      return `<span class="trunc cor-corpo" title="${esc(l.bateria)}">${esc(rotuloBat(l.bateria))}</span>`;
    };

    const linha = (l) => {
      const inner = `<b class="rPos" role="cell">${l.pos}º</b>${avatarPiloto(l.cid, l.nome, 34)}<span class="col rNome" role="cell"><b class="trunc">${esc(nomeBonitoPiloto(l.nome))}</b>${sub(l) ? `<span class="peq trunc">${esc(sub(l))}</span>` : ''}</span><b class="mono rTempo" role="cell">${fmtVolta(l.ms)}</b><span class="mono peq rDif" role="cell">${l.pos === 1 ? '—' : '+' + ((l.ms - lider.ms) / 1000).toFixed(3)}${empate(l) ? ' <span title="Mesmo tempo do vizinho na lista">· empate</span>' : ''}</span><span class="rKart" role="cell">${l.kart ? `<span class="kart">${esc(l.kart)}</span>` : '<span class="peq mudo">—</span>'}</span><span class="rBat" role="cell">${origem(l)}</span><span class="rData" role="cell">${dt(l.dia)}</span>`;
      return l.cid ? `<a class="linhaRank hov" role="row" href="#/piloto/${l.cid}" aria-label="${l.pos}º ${esc(nomeBonitoPiloto(l.nome))}, ${fmtVolta(l.ms)}. Abrir perfil">${inner}</a>` : `<div class="linhaRank" role="row">${inner}</div>`;
    };

    const grupo = (sk) => dados.tracados.filter((t) => !!t.superKart === sk);
    const chip = (t) => `<button role="tab" data-tracado="${esc(t.nome)}" aria-selected="${t.nome === dados.tracado}" class="${t.nome === dados.tracado ? 'sel' : ''}" title="${t.pilotos} pilotos com melhor volta neste traçado">${esc(t.nome.replace(' · Super Kart', ''))} <span>${t.pilotos}</span></button>`;

    const blocoGrupo = (titulo, lista) => {
      if (!lista.length) return '';
      const MAX_VISIVEIS = 5;
      const ordenados = [...lista].sort((a, b) => b.pilotos - a.pilotos);
      const destacados = ordenados.slice(0, MAX_VISIVEIS);
      if (dados.tracado && !destacados.some((t) => t.nome === dados.tracado)) {
        const atual = lista.find((t) => t.nome === dados.tracado);
        if (atual) destacados.push(atual);
      }
      const muitos = lista.filter((t) => destacados.includes(t));
      const poucos = lista.filter((t) => !destacados.includes(t));
      return `<div class="grupoTracados"><span class="rotuloGrupo">${titulo}</span><div class="filtros" role="tablist" aria-label="Traçados ${titulo}">${muitos.map(chip).join('')}${poucos.length ? (R.outros ? `${poucos.map(chip).join('')}<button class="maisTracados" data-recolher="1" aria-expanded="true">Recolher outros ▴</button>` : `<button class="maisTracados" data-outros="1" aria-expanded="false">+${poucos.length} outros traçados ▾</button>`) : ''}</div></div>`;
    };

    const navPer = R.periodo === 'geral' ? '' : `<span class="navPeriodo" role="navigation" aria-label="Navegação de datas"><button class="btn sec icone" data-ref="${esc(p.anterior || '')}" aria-label="${R.periodo === 'mes' ? 'Mês anterior' : 'Semana anterior'}" title="${R.periodo === 'mes' ? 'Mês anterior' : 'Semana anterior'}" ${p.anterior ? '' : 'disabled'}>${svg(IC.esq, 14)}</button>${R.ref ? `<button class="btn sec" data-ref="" aria-label="${R.periodo === 'mes' ? 'Voltar para o mês atual' : 'Voltar para a semana atual'}">${R.periodo === 'mes' ? 'Mês atual' : 'Semana atual'}</button>` : ''}<button class="btn sec icone" data-ref="${esc(p.proximo || '')}" aria-label="${R.periodo === 'mes' ? 'Próximo mês' : 'Próxima semana'}" title="${p.proximo ? (R.periodo === 'mes' ? 'Próximo mês' : 'Próxima semana') : (R.periodo === 'mes' ? 'Você já está no mês mais recente' : 'Você já está na semana mais recente')}" ${p.proximo ? '' : 'disabled'}>${svg(IC.dir, 14)}</button></span>`;

    const avisoGeral = dados.antigo
      ? `<div class="avisoAntigo" role="note"><span aria-hidden="true">${svg(IC.sistema, 14, 'var(--kib-info-texto-escuro)')}</span><span>Período antigo: só havia os 10 primeiros de cada faixa de peso no arquivo original.</span></div>`
      : dados.comAntigo
      ? `<div class="avisoAntigo" role="note"><span aria-hidden="true">${svg(IC.sistema, 14, 'var(--kib-info-texto-escuro)')}</span><span>O geral reúne a cronometragem nova, as corridas de setembro e o ranking antigo desde jan/2025.</span></div>`
      : '';

    const podioHtml = L.length && !q
      ? `<section class="podio" aria-label="Pódio">${L.slice(0, 3).map((l, i) => {
          const inner = `<span class="medalha" style="${med[i]}">${i + 1}</span>${avatarPiloto(l.cid, l.nome, 48, 'border-radius: var(--kib-raio-cartao)')}<span class="col podioTexto"><b class="podioNome">${esc(nomeBonitoPiloto(l.nome))}</b><span class="podioTempo"><b class="mono">${fmtVolta(l.ms)}</b><span class="peq">${i ? '+' + ((l.ms - lider.ms) / 1000).toFixed(3) : 'líder'} · ${dt(l.dia)}</span></span></span>`;
          return l.cid ? `<a href="#/piloto/${l.cid}" class="cartaoPodio ${i === 0 ? 'primeiro' : ''}" aria-label="${i + 1}º colocado: ${esc(nomeBonitoPiloto(l.nome))}, tempo ${fmtVolta(l.ms)}. Abrir perfil">${inner}</a>` : `<div class="cartaoPodio ${i === 0 ? 'primeiro' : ''}">${inner}</div>`;
        }).join('')}</section>`
      : '';

    const tabelaHtml = L.length
      ? `<section class="cartao" id="tabelaRank" tabindex="-1" style="outline: none"><div class="cartaoCab"><h2>${esc(dados.tracado)} · ${R.periodo === 'mes' ? 'mês' : R.periodo}</h2><span class="sub">melhor volta de cada piloto · baterias oficiais sem chuva · desempate por quem registrou primeiro · transponder MYLAPS</span></div>
        <div class="tabelaRank" role="table" aria-label="Ranking de melhores voltas ${esc(dados.tracado)}">
          <div class="linhaRank cab" role="row">
            <span class="rPos" role="columnheader">Pos</span>
            <span role="presentation"></span>
            <span class="rNome" role="columnheader">Piloto</span>
            <span class="rTempo" role="columnheader" title="Melhor volta registrada pelo transponder do piloto"><span class="hLg">Melhor volta</span><span class="hSm" aria-hidden="true">Volta</span></span>
            <span class="rDif" role="columnheader" title="Diferença para o líder da categoria">Diferença</span>
            <span class="rKart" role="columnheader">Kart</span>
            <span class="rBat" role="columnheader">Bateria</span>
            <span class="rData" role="columnheader">Data</span>
          </div>
          ${L.map(linha).join('')}
        </div>
        <div class="rodapeCartela">
          <span>${q ? `${L.length} ${L.length === 1 ? 'resultado' : 'resultados'} para “${esc(R.q)}” em ${todas.length} carregados` : `Mostrando ${L.length} de ${dados.total} ${dados.total === 1 ? 'piloto' : 'pilotos'}`}</span>
          <span>Voltas inválidas, desclassificados e equalização não entram</span>
          ${!q && dados.total > L.length ? '<button class="btn sec peq empurra" data-todos="1">Ver todos</button>' : ''}
        </div>
      </section>`
      : `<section class="cartao" id="tabelaRank" tabindex="-1" style="outline: none"><div class="vazio">
          <b>${q ? `Nenhum piloto com “${esc(R.q)}” no ${esc(dados.tracado)}` : dados.tracados.length ? 'Sem tempos nesse traçado no período' : 'Nenhum tempo no período'}</b>
          <span>${q ? 'O piloto pode ter corrido em outro traçado ou período. Limpe a busca ou veja o Geral.' : R.periodo === 'semana' ? 'A semana vai de domingo a sábado. Use as setas ou veja o mês.' : 'Os tempos aparecem quando as baterias são encerradas na cronometragem.'}</span>
          <div style="display:flex;gap:var(--kib-espaco-1);margin-top:var(--kib-espaco-1);justify-content:center;flex-wrap:wrap">
            ${q ? `<button class="btn prim peq" id="btnLimpaVazio">Limpar busca</button>` : ''}
            ${q && R.periodo !== 'geral' ? `<button class="btn sec peq" data-periodo="geral">Ver no Geral (desde 2025)</button>` : ''}
            ${!q && p.anterior ? `<button class="btn sec peq" data-ref="${esc(p.anterior)}">Ver período anterior</button>` : ''}
          </div>
        </div></section>`;

    const atalhosHtml = `<div class="atalhosBarra peq ocultarCelular" aria-hidden="true">
      <span><kbd>/</kbd> buscar</span>
      <span><kbd>S</kbd> semana</span>
      <span><kbd>M</kbd> mês</span>
      <span><kbd>G</kbd> geral</span>
      <span><kbd>P</kbd> pilotos</span>
      <span><kbd>Esc</kbd> limpar</span>
    </div>`;

    $('#corpoRank').innerHTML = `<div id="rankAviso" class="somenteLeitor" aria-live="polite" aria-atomic="true"></div>${avisoGeral}
      <div class="barraTracados">${blocoGrupo('Indoor', grupo(false))}${blocoGrupo('Super Kart', grupo(true))}${navPer}</div>
      ${podioHtml}
      ${tabelaHtml}
      ${atalhosHtml}`;

    const aviso = $('#rankAviso');
    if (aviso) {
      aviso.textContent = q
        ? `${L.length} resultados encontrados para ${R.q} no ${dados.tracado}`
        : `Ranking ${dados.tracado}, ${R.periodo}, ${dados.total} pilotos carregados.`;
    }
  };

  const carregar = async () => {
    const el = $('#corpoRank');
    if (el) el.classList.add('carregando');
    const aviso = $('#rankAviso');
    if (aviso) aviso.textContent = 'Carregando ranking...';
    try {
      dados = await office(`/pilotos/ranking?periodo=${R.periodo}&top=${R.top}${R.ref ? '&ref=' + R.ref : ''}${R.tracado ? '&tracado=' + encodeURIComponent(R.tracado) : ''}`);
      R.tracado = dados.tracado;
      pintar();
      const ids = dados.linhas.filter((l) => l.cid && l.temFoto).map((l) => l.cid);
      if (ids.length) { await carregarMiniaturas(ids); pintar(); }
    } finally {
      if (el) el.classList.remove('carregando');
    }
  };

  const imprimir = () => {
    const w = window.open('', '_blank');
    if (!w) return toast('Libere as janelas novas para imprimir', true);
    const p = dados.periodo, titulo = `${dados.tracado} · ${R.periodo === 'mes' ? 'mês' : R.periodo}`;
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Ranking ${esc(titulo)}</title><style>body{font-family: var(--kib-fonte-familia-interface);margin: var(--kib-espaco-3);color:var(--kib-cor-texto-principal)}h1{margin: 0;font-size: var(--kib-fonte-tamanho-destaque)}p{color:var(--kib-cor-texto-apoio);margin: var(--kib-espaco-meio) 0 var(--kib-espaco-2)}table{border-collapse:collapse;width:100%;font-size: var(--kib-fonte-tamanho-subtitulo)}td,th{border-bottom:1px solid var(--kib-cor-borda-sutil);padding: var(--kib-espaco-1) var(--kib-espaco-meio);text-align:left}th{font-size: var(--kib-fonte-tamanho-pequeno);text-transform:uppercase;color:var(--kib-cor-texto-apoio)}td.t{font-family: var(--kib-fonte-familia-numero);font-weight:700}tr:nth-child(-n+4) td{font-weight:700}</style></head><body><h1>Ranking · ${esc(titulo)}</h1><p>${p.de ? `${dataBr(p.de)} a ${dataBr(p.ate)}` : 'Geral, desde jan/2025'} · Kartódromo Internacional de Betim · tempos oficiais, sem baterias de chuva</p><table><thead><tr><th>Pos</th><th>Piloto</th><th>Melhor volta</th><th>Kart</th><th>Data</th></tr></thead><tbody>${dados.linhas.slice(0, 30).map((l) => `<tr><td>${l.pos}º</td><td>${esc(nomeBonitoPiloto(l.nome))}</td><td class="t">${fmtVolta(l.ms)}</td><td>${esc(l.kart || '—')}</td><td>${dataBr(l.dia)}</td></tr>`).join('')}</tbody></table><script>setTimeout(()=>print(),300)<\/script></body></html>`);
    w.document.close();
  };

  tela.addEventListener('click', (e) => {
    const p = e.target.closest('[data-periodo]');
    if (p) { R.periodo = p.dataset.periodo; R.top = 50; R.ref = null; carregar().catch(falhou); return; }
    const t = e.target.closest('[data-tracado]');
    if (t) { R.tracado = t.dataset.tracado; R.top = 50; carregar().catch(falhou); return; }
    if (e.target.closest('[data-outros]')) { R.outros = true; pintar(); return; }
    if (e.target.closest('[data-recolher]')) { R.outros = false; pintar(); return; }
    if (e.target.closest('#btnLimpaRank') || e.target.closest('#btnLimpaVazio')) {
      R.q = '';
      const inp = $('#qRank');
      if (inp) { inp.value = ''; inp.focus(); }
      pintar();
      return;
    }
    const rf = e.target.closest('[data-ref]');
    if (rf && !rf.disabled) { R.ref = rf.dataset.ref || null; R.top = 50; carregar().catch(falhou); return; }
    if (e.target.closest('[data-todos]')) { R.top = 500; carregar().catch(falhou); return; }
    if (e.target.closest('[data-imprimir]') && dados) imprimir();
  });

  tela.addEventListener('input', (e) => {
    if (e.target.id !== 'qRank' || !dados) return;
    R.q = e.target.value;
    const btnL = $('#btnLimpaRank');
    if (!btnL && R.q) {
      const wrap = e.target.closest('.buscaCampo');
      if (wrap) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'limpaBusca';
        b.id = 'btnLimpaRank';
        b.title = 'Limpar busca (Esc)';
        b.setAttribute('aria-label', 'Limpar busca');
        b.textContent = '×';
        wrap.appendChild(b);
      }
    } else if (btnL && !R.q) {
      btnL.remove();
    }
    if (R.q.trim() && dados.total > dados.linhas.length && R.top < 500) {
      R.top = 500;
      carregar().catch(falhou);
    } else {
      pintar();
    }
  });

  const onKeyGlobal = (e) => {
    const el = document.activeElement;
    const tag = (el?.tagName || '').toLowerCase();
    const digitando = tag === 'input' || tag === 'textarea' || tag === 'select';
    if (e.key === 'Escape') {
      if (R.q) {
        R.q = '';
        const inp = $('#qRank');
        if (inp) inp.value = '';
        pintar();
      }
      if (el?.id === 'qRank') el.blur();
      return;
    }
    if (digitando) return;
    const k = e.key.toLowerCase();
    if (e.key === '/' || e.key === '?') {
      e.preventDefault();
      const inp = $('#qRank');
      if (inp) { inp.focus(); inp.select(); }
    } else if (k === 's') {
      R.periodo = 'semana'; R.top = 50; R.ref = null; carregar().catch(falhou);
    } else if (k === 'm') {
      R.periodo = 'mes'; R.top = 50; R.ref = null; carregar().catch(falhou);
    } else if (k === 'g') {
      R.periodo = 'geral'; R.top = 50; R.ref = null; carregar().catch(falhou);
    } else if (k === 'p') {
      location.hash = '#/pilotos';
    } else if (k === 'i') {
      if (dados) imprimir();
    }
  };

  // Suporte a setas em tablists (WAI-ARIA Tabs)
  tela.addEventListener('keydown', (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (!tab) return;
    const list = tab.closest('[role="tablist"]');
    if (!list) return;
    const tabs = Array.from(list.querySelectorAll('[role="tab"]'));
    const idx = tabs.indexOf(tab);
    if (idx < 0) return;
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      next = tabs[(idx + 1) % tabs.length];
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = tabs[(idx - 1 + tabs.length) % tabs.length];
    }
    if (next) {
      e.preventDefault();
      next.focus();
      next.click();
    }
  });

  window.addEventListener('keydown', onKeyGlobal);
  tela.addEventListener('DOMNodeRemovedFromDocument', () => {
    window.removeEventListener('keydown', onKeyGlobal);
  }, { once: true });

  await carregar();
  repetir(() => carregar().catch(() => undefined), 60_000);
};
