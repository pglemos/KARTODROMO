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
const nomeBonito = (n) => String(n || '').toLowerCase().replace(/(^|[\s'-])([\p{L}])/gu, (_, a, b) => a + b.toUpperCase()).replace(/\s(Da|De|Do|Das|Dos|E)(?=\s)/g, (x) => x.toLowerCase())
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
    : `<span class="avatar avatarNeutro" aria-hidden="true" style="width: ${tam}px; height: ${tam}px; font-size: ${Math.max(12, Math.round(tam / 3))}px; ${extra}">${esc(iniciais(nomeBonito(nome)))}</span>`;
};
const zapPiloto = (fone, nome) => (fone ? zap(fone, `Olá, ${nomeBonito(nome).split(' ')[0]}! Aqui é do Kartódromo de Betim.`) : '');

// ------------------------------------------------------------------ cartela
TELAS.pilotos = async (tela) => {
  const P = S.pil || (S.pil = { filtro: 'todos', q: '', pagina: 1, ordem: 'recentes' });
  tela.innerHTML = `${cabecalho('<span class="ponto pulso" style="background: #34C759"></span><span style="color: var(--okTxt)">Ao vivo · mesmos clientes da Recepção, do totem e do site</span><span id="atualizadoP" style="color: var(--mudo2); font-weight: 500"></span>', 'Pilotos', `<a class="btn branco" href="#/ranking">Ranking por traçado</a><a class="btn prim" href="#/piloto/novo">${svg(IC.mais, 14, '#FFF', 2.6)}Novo cliente</a>`)}
  <main class="principal">
    <section class="kpis kpis4" id="kpisP">${'<div class="esqueleto" style="height: 104px"></div>'.repeat(4)}</section>
    <section class="cartao" id="cartela"><div class="esqueleto" style="height: 480px; margin: 16px"></div></section>
  </main>`;
  let resumo = null, lista = null;
  const FILTROS = [['todos', 'Todos', 'total'], ['hoje', 'Correndo hoje', 'hoje'], ['ativos', 'Ativos 30 dias', 'ativos30'], ['novos', 'Novos na semana', 'novos'], ['incompletos', 'Cadastro incompleto', 'incompletos'], ['aniversariantes', 'Aniversariantes do mês', 'aniversariantes']];
  const ORDENS = [['recentes', 'Mais recentes'], ['nome', 'Nome (A–Z)'], ['baterias', 'Mais baterias'], ['melhor', 'Melhor volta']];
  const ordemValida = (o) => (o === 'baterias' || o === 'melhor' ? P.filtro === 'ativos' && !P.q : true);
  const n = (v) => (+v || 0).toLocaleString('pt-BR');
  const pintarKpis = () => {
    if (!resumo) return;
    const orig = (resumo.novosOrigem || []).map((o) => `${n(o.n)} ${ORIGEM[o.origem] || o.origem}`).join(' · ');
    const k = (rot, val, nota, f) => `<button type="button" class="kpi ergue" data-filtro="${f}" aria-pressed="${P.filtro === f && !P.q}" style="border: 0; text-align: left; font: inherit; ${P.filtro === f && !P.q ? 'box-shadow: 0 0 0 2px var(--verde)' : ''}"><span class="rot">${rot}</span><span class="col" style="gap: 4px"><span class="val">${val}</span><span class="peq">${nota}</span></span></button>`;
    $('#kpisP').innerHTML = [
      k('Clientes na base', n(resumo.total), `${n(resumo.legado)} vieram do LapTime antigo`, 'todos'),
      k('Correram nos últimos 30 dias', n(resumo.ativos30), 'toque para ver quem', 'ativos'),
      k('Novos esta semana', n(resumo.novos), orig || 'nenhum cadastro novo', 'novos'),
      k('Cadastro incompleto', n(resumo.incompletos), 'sem CPF, peso, telefone ou e-mail', 'incompletos'),
    ].join('');
  };
  const paginacao = () => { const ini = (lista.pagina - 1) * lista.porPagina; return `<span class="peq">${lista.total ? `${n(ini + 1)}–${n(ini + lista.linhas.length)} de ${n(lista.total)}${P.q && lista.total >= 100 ? ' (refine a busca)' : ''}` : ''}</span><span style="display: flex; gap: 6px"><button class="btn sec" data-pag="-1" aria-label="Página anterior" ${lista.pagina <= 1 ? 'disabled' : ''} style="width: 40px; padding: 0">${svg(IC.esq, 14)}</button><button class="btn sec" data-pag="1" aria-label="Próxima página" ${ini + lista.linhas.length >= lista.total ? 'disabled' : ''} style="width: 40px; padding: 0">${svg(IC.dir, 14)}</button></span>`; };
  const atencao = (c) => {
    const ch = [];
    if (c.bloqueado) ch.push(['vermelho', 'Bloqueado']);
    if (c.duplicado) ch.push(['vermelho', 'Possível duplicado', `#/piloto/${c.duplicado.id}`]);
    if (c.responsavelId && c.responsavelNome && nomeBonito(c.responsavelNome) === nomeBonito(c.nome)) ch.push(['laranja', 'Mesmo nome do responsável']);
    else if (c.responsavelId) ch.push(['azul', 'Menor · ' + nomeBonito(c.responsavelNome || 'responsável').split(' ')[0]]);
    if (c.faltas.length) ch.push(['laranja', 'Falta ' + c.faltas.join(', ')]);
    return ch.map(([cor, t, href]) => (href ? `<a class="chip ${cor} trunc" href="${href}" title="Abrir o outro cadastro">${esc(t)}</a>` : `<span class="chip ${cor} trunc">${esc(t)}</span>`)).join('') || '<span class="peq" aria-label="Cadastro completo">—</span>';
  };
  const pintarLista = () => {
    const el = $('#cartela'); if (!el || !lista) return;
    const cont = (key) => (resumo ? n(resumo[key]) : '');
    el.innerHTML = `<div class="barraCartela">
        <label class="buscaCampo" style="height: 40px; flex: 1 1 260px; max-width: 420px">${svg(IC.busca, 15, '#8E8E93')}<input id="qPil" type="search" value="${esc(P.q)}" placeholder="Nome, CPF, telefone ou e-mail" aria-label="Buscar cliente" style="font-size: 14px"></label>
        <label class="ordemCartela"><span class="peq">Ordenar</span><select class="entrada" id="ordemPil" style="height: 40px; width: auto">${ORDENS.map(([v, t]) => `<option value="${v}" ${P.ordem === v ? 'selected' : ''} ${ordemValida(v) ? '' : 'disabled'}>${t}${ordemValida(v) ? '' : ' (só em Ativos)'}</option>`).join('')}</select></label>
        <span class="paginaTopo">${paginacao()}</span>
        <div class="filtros" role="tablist" aria-label="Filtro" style="flex-basis: 100%">${FILTROS.map(([f, t, key]) => `<button role="tab" aria-selected="${P.filtro === f && !P.q}" data-filtro="${f}" class="${P.filtro === f && !P.q ? 'sel' : ''}" style="height: 34px; border-radius: 17px">${t} <span>${cont(key)}</span></button>`).join('')}</div>
      </div>
      ${lista.linhas.length ? `<div class="tabelaPilotos" role="table" aria-label="Clientes"><div class="linhaPiloto cab" role="row"><span></span><span>Piloto</span><span class="cIdade">Idade</span><span class="cPeso">Peso</span><span class="cContato">Contato</span><span class="cBat">Baterias</span><span class="cMelhor">Melhor volta</span><span class="cUltima">Última vez</span><span class="cAtencao">Atenção</span></div>
      ${lista.linhas.map((c) => {
        const id = c.id, ida = idadeDe(c.nascimento), car = c.carreira, nome = nomeBonito(c.nome);
        const sub = c.hoje ? `correndo hoje · ${c.hoje}` : c.origem === 'laptime' ? 'cliente desde o LapTime' : `cadastro ${dataCurta(c.criadoEm)} · ${ORIGEM[c.origem] || c.origem}`;
        const fone = c.telefone, wa = zapPiloto(fone, c.nome);
        return `<div class="linhaPiloto hov" role="row" data-href="#/piloto/${id}">${avatarPiloto(id, c.nome, 38, c.hoje ? 'box-shadow: 0 0 0 2px #FFF, 0 0 0 4px #34C759' : '')}<span class="col"><a class="trunc nomePiloto" href="#/piloto/${id}">${esc(nome)}</a><span class="peq trunc" style="${c.hoje ? 'color: var(--okTxt); font-weight: 600' : ''}">${esc(sub)}</span></span><span class="cIdade">${ida != null ? ida + ' anos' : '—'}</span><span class="cPeso">${c.peso ? (+c.peso).toLocaleString('pt-BR') + ' kg' : '—'}</span><span class="cContato">${fone ? `<span class="trunc">${esc(fone)}</span>${wa ? `<a class="btnZap" href="${esc(wa)}" target="_blank" rel="noopener" aria-label="WhatsApp de ${esc(nome)}" title="Abrir no WhatsApp">${svg(IC.zap, 14, '#1C6B35', 2.2)}</a>` : ''}` : `<span class="trunc peq">${esc(c.email || (c.responsavelNome ? 'via ' + nomeBonito(c.responsavelNome) : '—'))}</span>`}</span><b class="cBat">${car ? car.baterias : 0}</b><span class="cMelhor col">${car && car.melhor ? `<b class="mono">${fmtVolta(car.melhor.ms)}</b><span class="peq trunc">${esc(car.melhor.tracado)}</span>` : '<span class="peq">—</span>'}</span><span class="cUltima" style="${c.hoje ? 'font-weight: 700; color: var(--okTxt)' : 'color: var(--tinta2)'}">${c.hoje ? 'hoje · ' + c.hoje : diasAtras(car && car.ultima)}</span><span class="cAtencao">${atencao(c)}</span></div>`;
      }).join('')}</div>` : `<div class="vazio"><b>${P.q ? 'Nenhum cliente com essa busca' : 'Ninguém nesse filtro agora'}</b><span>${P.q ? 'Tente parte do nome, o CPF só com números ou o telefone.' : P.filtro === 'hoje' ? 'Ninguém reservado para hoje ainda.' : 'Escolha outro filtro.'}</span></div>`}
      <div class="rodapeCartela"><span style="display: inline-flex; align-items: center; gap: 6px"><span class="ponto" style="width: 10px; height: 10px; background: #34C759"></span>contorno verde = correndo hoje</span><span style="margin-left: auto; display: flex; align-items: center; gap: 12px">${paginacao()}</span></div>`;
  };
  const carregar = async () => {
    if (!ordemValida(P.ordem)) P.ordem = 'recentes';
    const [r, l] = await Promise.all([office('/pilotos/resumo'), office(`/pilotos?filtro=${P.filtro}&pagina=${P.pagina}&ordem=${P.ordem}${window.matchMedia("(max-width: 760px)").matches ? "&por=20" : ""}&q=${encodeURIComponent(P.q)}`)]);
    resumo = r; lista = l;
    const at = $('#atualizadoP'); if (at) at.textContent = ` · atualizado às ${new Date().toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })}`;
    const foco = document.activeElement && document.activeElement.id === 'qPil';
    const repintar = () => { pintarKpis(); pintarLista(); if (foco) { const i = $('#qPil'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } };
    repintar();
    const comFoto = lista.linhas.filter((c) => c.temFoto).map((c) => c.id);
    if (comFoto.length) { await carregarMiniaturas(comFoto); repintar(); }
  };
  tela.addEventListener('click', (e) => {
    if (e.target.closest('a, select, input')) return;
    const f = e.target.closest('[data-filtro]'); if (f) { P.filtro = f.dataset.filtro; P.q = ''; P.pagina = 1; carregar().catch(falhou); return; }
    const pg = e.target.closest('[data-pag]'); if (pg) { P.pagina = Math.max(1, P.pagina + +pg.dataset.pag); carregar().catch(falhou); window.scrollTo(0, 0); return; }
    const l = e.target.closest('[data-href]'); if (l) location.hash = l.dataset.href;
  });
  tela.addEventListener('change', (e) => { if (e.target.id === 'ordemPil') { P.ordem = e.target.value; P.pagina = 1; carregar().catch(falhou); } });
  let tq;
  tela.addEventListener('input', (e) => { if (e.target.id === 'qPil') { clearTimeout(tq); tq = setTimeout(() => { P.q = e.target.value.trim(); P.pagina = 1; carregar().catch(falhou); }, 300); } });
  await carregar();
  repetir(() => { if (document.activeElement?.id !== 'qPil') carregar().catch(() => undefined); }, 30_000);
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
    const c = d.cliente, r = d.resumo || { baterias: 0, voltas: 0, vitorias: 0, podios: 0 }, ida = idadeDe(c.nascimento), nome = nomeBonito(c.nome);
    const insta = instagramValido(c.instagram) ? '@' + String(c.instagram).replace(/^@/, '') : null;
    const sub = [ida != null ? ida + ' anos' : null, c.peso ? (+c.peso).toLocaleString('pt-BR') + ' kg' : null, c.cidade ? nomeBonito(c.cidade) + (c.estado ? '/' + String(c.estado).toUpperCase() : '') : null, insta].filter(Boolean).map(esc).join(' · ');
    const fin = d.financeiro && +d.financeiro.vendas ? `${brlCurto(d.financeiro.total)} em ${(+d.financeiro.vendas).toLocaleString('pt-BR')} ${+d.financeiro.vendas === 1 ? 'compra' : 'compras'} · última ${dataCurta(d.financeiro.ultima)}` : null;
    const wa = zapPiloto(c.telefone, c.nome);
    const avisos = [
      d.duplicado ? `<p class="avisoPerfil vermelho">Possível cadastro duplicado: <a href="#/piloto/${d.duplicado.id}">${esc(nomeBonito(d.duplicado.nome))} (cliente ${d.duplicado.id})</a> tem o mesmo CPF, ou o mesmo nome com o mesmo telefone ou nascimento. Confira antes de reservar.</p>` : '',
      c.responsavelNome && nomeBonito(c.responsavelNome) === nome ? `<p class="avisoPerfil">Este menor está com o mesmo nome do responsável. Corrija o nome em “Dados e cadastro”.</p>` : '',
      c.instagram && !insta ? `<p class="avisoPerfil">O Instagram cadastrado (“${esc(c.instagram)}”) não é um usuário válido. Corrija em “Dados e cadastro”.</p>` : '',
    ].join('');
    tela.innerHTML = `<header class="cab" style="align-items: center"><a class="btn branco" href="#/pilotos">${svg(IC.esq, 14)}Pilotos</a><span class="peq" style="font-weight: 600">${novo ? 'Novo cliente · os mesmos campos obrigatórios do totem' : `Cliente ${c.id} · cadastrado em ${dataBr(c.criadoEm)} · origem ${esc(ORIGEM[c.origem] || c.origem)}`}</span></header>
    <main class="principal">
      <section class="heroPiloto">
        <div style="position: relative; flex-shrink: 0">${foto ? `<img src="${foto}" alt="Foto de ${esc(nome)}" class="fotoGrande" style="${d.hoje ? 'box-shadow: 0 0 0 3px #34C759' : ''}">` : `<div class="fotoGrande semFoto" role="img" aria-label="${novo ? 'Sem foto' : 'Sem foto: ' + esc(nome)}" style="${d.hoje ? 'box-shadow: 0 0 0 3px #34C759' : ''}">${novo ? svg(IC.pilotos, 44, '#8E8E93', 1.8) : esc(iniciais(nome))}</div>`}
          ${novo ? '' : `<button type="button" class="btnFoto" data-foto="1" aria-label="${foto ? 'Trocar a foto' : 'Colocar foto'}" title="${foto ? 'Trocar a foto' : 'Colocar foto'}">${svg('M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', 20, '#1D1D1F', 2)}</button>`}</div>
        <div class="col" style="gap: 6px; flex: 1 1 320px">
          ${d.hoje ? `<span class="statusHero"><span class="ponto" style="width: 7px; height: 7px; background: #34C759"></span>Correndo hoje · ${esc(d.hoje)}</span>` : c.bloqueado ? '<span class="statusHero" style="color: #FF8A80">Bloqueado: não pode reservar nem correr</span>' : ''}
          <h1 class="nomeHero">${esc(nome || 'Novo cliente')}</h1>
          ${sub ? `<span style="font-size: 14px; color: #D1D1D6">${sub}</span>` : ''}
          ${novo ? '' : `<span style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 4px">${wa ? `<a class="btn" href="${esc(wa)}" target="_blank" rel="noopener" style="height: 34px; background: rgba(52,199,89,.18); color: #5EDB7A">${svg(IC.zap, 14, '#5EDB7A', 2.2)}WhatsApp</a>` : ''}${fin ? `<span style="font-size: 13px; color: #A1A1A6">${esc(fin)}</span>` : ''}</span>`}
        </div>
        ${novo ? '' : `<div class="numerosHero">${[[r.baterias, 'baterias'], [r.voltas, 'voltas'], [r.vitorias, 'vitórias'], [r.podios, 'pódios']].map(([v, t]) => `<span><b>${(+v || 0).toLocaleString('pt-BR')}</b><span>${t}</span></span>`).join('')}</div>`}
      </section>
      ${avisos}
      ${novo ? '' : `<div class="seg" role="tablist" aria-label="Seções do perfil" style="align-self: flex-start">${['Carreira', 'Dados e cadastro'].map((t, i) => `<button role="tab" aria-selected="${V.aba === i}" data-aba="${i}" class="${V.aba === i ? 'sel' : ''}" style="height: 36px">${t}</button>`).join('')}</div>`}
      <div id="corpoPiloto" style="display: flex; flex-direction: column; gap: 18px"></div>
    </main>`;
    $('#corpoPiloto').innerHTML = V.aba === 0 && !novo ? htmlCarreira() : htmlDados();
  };
  const htmlCarreira = () => {
    const posChip = (p) => (p ? `<span class="chip ${p.pos === 1 ? 'ouro' : 'cinza'}" title="${p.pos}º de ${p.de} pilotos">${p.pos}º de ${p.de}</span>` : '<span class="peq">—</span>');
    const ev = d.evolucao || [], vals = ev.map((x) => x.ms), mx = Math.max(...vals), mn = Math.min(...vals), faixa = Math.max(1, mx - mn);
    const melhores = `<section class="cartao" style="flex: 1 1 440px; min-width: 0"><div class="cartaoCab"><h2>Melhores voltas por traçado</h2><span class="sub">sem baterias de chuva · Indoor e Super Kart separados</span></div>
        <div class="tabelaTracados"><div class="linhaTracado cab"><span>Traçado</span><span>Melhor</span><span>Semana</span><span>Mês</span></div>
        ${d.tracados.map((t) => `<div class="linhaTracado"><span class="col"><b>${esc(t.nome)}</b><span class="peq">${dataCurta(t.dia)} · ${t.corridas ? `${esc(t.bateria)} · ${t.corridas} ${t.corridas === 1 ? 'bateria' : 'baterias'}` : 'ranking do LapTime antigo'}</span></span><b class="mono">${fmtVolta(t.ms)}</b>${posChip(t.semana)}${posChip(t.mes)}</div>`).join('') || '<p class="peq" style="padding: 0 18px 16px">Só correu em baterias de chuva até agora.</p>'}</div>
        <p class="peq" style="margin: 0; padding: 10px 18px; background: var(--sup2); border-top: 1px solid var(--linha)">Posição no ranking da semana e do mês de cada traçado. <a href="#/ranking">Ver ranking</a></p></section>`;
    const lt = d.laptime || [], lr = d.laptimeResumo;
    const antigo = lt.length ? `<section class="cartao"><div class="cartaoCab"><span class="col"><h2>No LapTime antigo</h2><span class="sub">ranking mensal de jan/2025 a set/2026 · o LapTime guardava os 10 primeiros de cada faixa de peso</span></span>
        ${lr ? `<span class="dir resumoAntigo"><span><b>${lr.meses}</b> ${lr.meses === 1 ? 'mês' : 'meses'} no top 10</span>${d.semanasTop ? `<span><b>${d.semanasTop}</b> ${d.semanasTop === 1 ? 'semana' : 'semanas'} no top 10</span>` : ''}<span><b>${lr.vitorias}</b> ${lr.vitorias === 1 ? 'vez' : 'vezes'} em 1º</span></span>` : ''}</div>
        <div class="tabelaAntigo"><div class="linhaAntigo cab"><span>Mês</span><span>Traçado</span><span>Posição</span><span>Melhor volta</span></div>
        ${(mostrar.antigo ? lt : lt.slice(0, 8)).map((x) => `<div class="linhaAntigo"><span>${esc(x.periodo.charAt(0).toUpperCase() + x.periodo.slice(1))}</span><span class="trunc">${esc(x.tracado)}</span><span><b style="${x.pos === 1 ? 'color: #8A5300' : ''}">${x.pos}º</b> <span class="peq">${x.faixa ? esc(nomeBonito(x.faixa).replace(/ Kg\b/g, ' kg').replace(/ Até /g, ' até ').replace(/^Até /, 'Até ').replace(/ De /g, ' de ')) : ''}</span></span><b class="mono">${fmtVolta(x.ms)}</b></div>`).join('')}</div>
        ${lt.length > 8 ? `<button class="btn sec peq" data-mais="antigo" style="margin: 10px 18px 14px">${mostrar.antigo ? 'Mostrar menos' : `Ver os ${lt.length} meses`}</button>` : ''}</section>` : '';
    if (!d.totalCorridas) return (d.tracados.length ? `<div class="linhaFlex">${melhores}</div>` : `<section class="cartao"><div class="vazio"><b>Ainda não correu desde ${dataBr(d.desde)}</b><span>Não há corridas deste piloto na cronometragem nova nem no LapTime antigo.</span></div></section>`) + antigo;
    const grafico = ev.length > 1 ? `<div class="graficoEv" role="img" aria-label="Melhor volta foi de ${fmtVolta(ev[0].ms)} para ${fmtVolta(ev[ev.length - 1].ms)} nas últimas ${ev.length} baterias; a melhor foi ${fmtVolta(mn)}"><span class="escalaEv" aria-hidden="true"><span>${fmtVolta(mn)}</span><span>${fmtVolta(mx)}</span></span>${ev.map((x) => `<span title="${dataBr(x.dia)} · ${esc(x.bateria)} · ${fmtVolta(x.ms)}"><span class="barraEv" style="height: ${Math.round(((mx - x.ms) / faixa) * 110 + 14)}px; ${x.ms === mn ? 'background: var(--verde)' : ''}"></span></span>`).join('')}</div><div class="rodapeEv peq"><span>${dataCurta(ev[0].dia)}</span><span><span class="ponto" style="width: 8px; height: 8px; background: var(--verde)"></span> melhor volta: ${fmtVolta(mn)}</span><span>${dataCurta(ev[ev.length - 1].dia)}</span></div>` : '<p class="peq" style="padding: 0 18px 16px">O gráfico aparece a partir da segunda bateria no mesmo traçado.</p>';
    const hist = mostrar.hist ? d.corridas : d.corridas.slice(0, 12);
    return `<div class="linhaFlex">${melhores}
      <section class="cartao" style="flex: 1 1 400px; min-width: 0"><div class="cartaoCab"><h2>Evolução${d.principal ? ' no ' + esc(d.principal) : ''}</h2><span class="sub">melhor volta de cada bateria · barra mais alta = mais rápido</span></div>${grafico}</section>
    </div>
    <section class="cartao"><div class="cartaoCab"><h2>Histórico de baterias</h2><span class="sub">${d.totalCorridas} ${d.totalCorridas === 1 ? 'bateria' : 'baterias'} desde ${dataBr(d.desde)} · toque para abrir o resultado (as do LapTime antigo só têm o resumo)</span></div>
      <div class="tabelaHist"><div class="linhaHist cab"><span>Data</span><span>Bateria</span><span class="hTracado">Traçado</span><span>Posição</span><span class="hKart">Kart</span><span class="hVoltas">Voltas</span><span>Melhor</span></div>
      ${hist.map((x) => { const lt2 = /^(lt|lr|cx)-/.test(x.sessaoId); return `<${lt2 ? 'div' : 'button'} class="linhaHist ${lt2 ? '' : 'hov'}" ${lt2 ? '' : `data-resultado="${esc(x.sessaoId)}"`}><span class="mono">${dataCurta(x.dia)}</span><b class="trunc">${esc(x.bateria)}</b><span class="trunc hTracado" style="color: var(--tinta2)">${esc(x.tracado)}${x.chuva ? ' <span class="chip azul">chuva</span>' : ''}</span><b style="${x.pos === 1 ? 'color: #8A5300' : x.pos <= 3 ? '' : 'color: var(--mudo)'}">${x.dq ? 'DC' : x.pos ? x.pos + 'º' : '<span class="peq" title="Bateria do LapTime de que só sobrou a reserva paga">sem tempo</span>'}${x.pos ? `<span class="peq" style="font-weight: 500"> de ${x.de}</span>` : ''}</b><span class="hKart">${x.kart ? `<span class="kart">${esc(x.kart)}</span>` : '—'}</span><span class="hVoltas">${x.voltas}</span><b class="mono">${fmtVolta(x.melhor)}</b></${lt2 ? 'div' : 'button'}>`; }).join('')}</div>
      ${d.corridas.length > 12 ? `<button class="btn sec peq" data-mais="hist" style="margin: 10px 18px 14px">${mostrar.hist ? 'Mostrar menos' : `Ver todas as ${d.totalCorridas}`}</button>` : ''}</section>${antigo}`;
  };
  const CAMPOS = [['nome', 'Nome completo', 'text', 'name'], ['documento', 'CPF', 'text', 'off', 'numeric'], ['nascimento', 'Nascimento', 'date'], ['sexo', 'Sexo', 'sexo'], ['peso', 'Peso (kg)', 'text', 'off', 'decimal'], ['telefone', 'Celular (WhatsApp)', 'tel', 'tel', 'tel'], ['email', 'E-mail', 'email', 'email'], ['instagram', 'Instagram (usuário, sem @)', 'text', 'off'], ['cep', 'CEP', 'text', 'postal-code', 'numeric'], ['endereco', 'Endereço', 'text', 'street-address'], ['numero', 'Número', 'text', 'off'], ['complemento', 'Complemento', 'text', 'off'], ['bairro', 'Bairro', 'text', 'off'], ['cidade', 'Cidade', 'text', 'address-level2'], ['estado', 'UF', 'text', 'address-level1']];
  const htmlDados = () => {
    const c = d.cliente;
    return `<section class="cartao"><div class="cartaoCab"><h2>Dados do cadastro</h2><span class="sub">e-mail e peso são obrigatórios, como no totem · salvar vale na hora para Recepção, totem e site</span></div>
      <form id="fPiloto" class="formPiloto" novalidate>
        ${CAMPOS.map(([k, t, tipo, ac, im]) => `<label class="campo"><span>${t}</span>${tipo === 'sexo' ? `<select class="entrada" name="sexo"><option value="" ${!c.sexo ? 'selected' : ''}>Não informado</option><option value="M" ${c.sexo === 'M' ? 'selected' : ''}>Masculino</option><option value="F" ${c.sexo === 'F' ? 'selected' : ''}>Feminino</option></select>` : `<input class="entrada" name="${k}" type="${tipo}" value="${esc(c[k] ?? '')}" autocomplete="${ac || 'off'}" ${im ? `inputmode="${im}"` : ''} ${k === 'nome' ? 'required' : ''} ${k === 'instagram' && c.instagram && !instagramValido(c.instagram) ? 'aria-invalid="true" style="box-shadow: inset 0 0 0 2px var(--aviso)"' : ''}>`}</label>`).join('')}
        <label class="campo" style="grid-column: 1 / -1"><span>Observação (só a equipe vê)</span><textarea class="entrada" name="observacao" rows="2" style="height: auto; padding: 10px 12px">${esc(c.observacao || '')}</textarea></label>
        ${c.responsavelNome ? `<p class="peq" style="grid-column: 1 / -1; margin: 0">Menor de idade · responsável: <a href="#/piloto/${c.responsavelId}">${esc(nomeBonito(c.responsavelNome))}</a></p>` : ''}
        ${d.dependentes && d.dependentes.length ? `<p class="peq" style="grid-column: 1 / -1; margin: 0">Responsável por: ${d.dependentes.map((x) => `<a href="#/piloto/${x.id}">${esc(nomeBonito(x.nome))}</a>`).join(', ')}</p>` : ''}
      </form>
      <p class="erroMsg" id="erroPiloto" role="alert" style="margin: 0; padding: 0 18px 10px"></p>
      <div class="modalRodape" style="border-top: 1px solid var(--linha)"><label style="display: flex; align-items: center; gap: 8px; font-weight: 600"><input type="checkbox" id="chBloq" ${c.bloqueado ? 'checked' : ''} style="width: 18px; height: 18px">Bloqueado (não pode reservar nem correr)</label><span style="margin-left: auto; display: flex; gap: 8px"><button type="button" class="btn sec" data-desfazer="1">Desfazer</button><button type="button" class="btn prim" data-salvar="1">${novo ? 'Criar cliente' : 'Salvar alterações'}</button></span></div></section>`;
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
    const m = modal(`<div class="modalTopo" style="background: #FFF"><span class="col" style="gap: 2px"><span style="font-size: 20px; font-weight: 700">Foto do piloto</span><span class="peq">Aparece na cartela, no perfil e no ranking.</span></span><button class="fechar hov" style="position: static; margin-left: auto" data-acao="fechar" aria-label="Fechar">${svg(IC.fechar, 15, '#1D1D1F', 2.4)}</button></div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 20px 22px">
        <canvas id="cvFoto" width="512" height="512" class="cvFoto" aria-label="Pré-visualização da foto. Arraste para enquadrar o rosto."></canvas>
        <label style="display: flex; align-items: center; gap: 10px; width: 100%; max-width: 300px" class="peq">Zoom<input id="zoomFoto" type="range" min="100" max="300" value="100" style="flex-grow: 1" disabled></label>
        <span style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center"><label class="btn branco" style="height: 44px; cursor: pointer">Escolher arquivo<input id="arqFoto" type="file" accept="image/jpeg,image/png,image/webp" style="display: none"></label><label class="btn branco" style="height: 44px; cursor: pointer">Tirar com a câmera<input id="camFoto" type="file" accept="image/*" capture="user" style="display: none"></label></span>
        <span class="peq" style="text-align: center">JPG, PNG ou WEBP. A foto é reduzida para 512 px antes de salvar.</span>
      </div>
      <div class="modalRodape">${d.cliente.temFoto ? '<button class="btn perigo" data-remover-foto="1">Remover foto</button>' : ''}<span class="erroMsg" id="erroFoto"></span><button class="btn prim" id="salvarFoto" style="margin-left: auto" disabled>Salvar foto</button></div>`);
    m.style.maxWidth = '520px';
    const cv = $('#cvFoto'), ctx = cv.getContext('2d');
    const desenhar = () => {
      ctx.fillStyle = '#E5E5EA'; ctx.fillRect(0, 0, 512, 512);
      if (!F.img) { ctx.fillStyle = '#6E6E73'; ctx.font = '600 22px system-ui'; ctx.textAlign = 'center'; ctx.fillText('Escolha uma foto', 256, 262); return; }
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
    const rs = e.target.closest('[data-resultado]'); if (rs) { S.crono = { ...(S.crono || {}), aba: 1, sessao: rs.dataset.resultado }; location.hash = '#/crono'; }
  });
  await carregar();
  pintar();
};

// ------------------------------------------------------------------ ranking
TELAS.ranking = async (tela) => {
  const R = S.rank || (S.rank = { periodo: 'semana', tracado: null, top: 50, ref: null, outros: false });
  tela.innerHTML = `${cabecalho('Clientes · tempos oficiais, sem baterias de chuva · Indoor e Super Kart separados', 'Ranking <span id="perRank" style="font-size: 17px; font-weight: 600; color: var(--mudo); letter-spacing: 0"></span>', `<a class="btn branco" href="#/pilotos">Pilotos</a><button class="btn escuro" data-imprimir="1">Imprimir para o mural</button><div class="seg" role="tablist" aria-label="Período">${[['semana', 'Semana'], ['mes', 'Mês'], ['geral', 'Geral']].map(([v, t]) => `<button role="tab" data-periodo="${v}" aria-selected="${R.periodo === v}" class="${R.periodo === v ? 'sel' : ''}">${t}</button>`).join('')}</div>`)}
  <main class="principal" id="corpoRank"><div class="esqueleto" style="height: 520px"></div></main>`;
  let dados = null;
  const POUCOS = 10;
  const pintar = () => {
    const p = dados.periodo, antigoOuGeral = R.periodo === 'geral' || dados.antigo;
    const dt = (iso) => (antigoOuGeral ? dataBr(iso) : dataCurta(iso));
    $('#perRank').textContent = p.de ? `· ${R.periodo === 'mes' ? MESES[deIso(p.de).getMonth()] + ' de ' + deIso(p.de).getFullYear() : `${dataBr(p.de).slice(0, 5)} a ${dataBr(p.ate)}`}` : '· desde jan/2025';
    tela.querySelectorAll('[data-periodo]').forEach((b) => { b.classList.toggle('sel', b.dataset.periodo === R.periodo); b.setAttribute('aria-selected', b.dataset.periodo === R.periodo); });
    const L = dados.linhas, lider = L[0];
    const med = ['background: linear-gradient(180deg, #FFE27A, #F5B800); color: #5C3A00', 'background: linear-gradient(180deg, #F2F2F7, #C7C7CC); color: #3A3A3C', 'background: linear-gradient(180deg, #F0C9A0, #C98A4B); color: #4A2A0A'];
    const sub = (l) => { const i = idadeDe(l.nascimento); return [i != null && i < 18 ? 'até 17 anos' : null, !l.cid ? 'sem cadastro ligado' : null].filter(Boolean).join(' · '); };
    const origem = (l) => (l.antigo ? '<span class="peq">LapTime</span>' : `<span class="trunc" style="color: var(--tinta2)">${esc(l.bateria)}</span>`);
    const linha = (l) => { const inner = `<b class="rPos">${l.pos}º</b>${avatarPiloto(l.cid, l.nome, 34)}<span class="col rNome"><b class="trunc">${esc(nomeBonito(l.nome))}</b>${sub(l) ? `<span class="peq trunc">${esc(sub(l))}</span>` : ''}</span><b class="mono rTempo">${fmtVolta(l.ms)}</b><span class="mono peq rDif">${l.pos === 1 ? '—' : '+' + ((l.ms - lider.ms) / 1000).toFixed(3)}</span><span class="rKart">${l.kart ? `<span class="kart">${esc(l.kart)}</span>` : '<span class="peq">—</span>'}</span><span class="rBat">${origem(l)}</span><span class="rData">${dt(l.dia)}</span>`; return l.cid ? `<a class="linhaRank hov" href="#/piloto/${l.cid}">${inner}</a>` : `<div class="linhaRank">${inner}</div>`; };
    // traçados: Indoor e Super Kart em grupos; os de poucos pilotos ficam em "outros"
    const grupo = (sk) => dados.tracados.filter((t) => !!t.superKart === sk);
    const chip = (t) => `<button role="tab" data-tracado="${esc(t.nome)}" aria-selected="${t.nome === dados.tracado}" class="${t.nome === dados.tracado ? 'sel' : ''}">${esc(t.nome.replace(' · Super Kart', ''))} <span>${t.pilotos}</span></button>`;
    const blocoGrupo = (titulo, lista) => { if (!lista.length) return ''; const muitos = lista.filter((t) => t.pilotos >= POUCOS || t.nome === dados.tracado), poucos = lista.filter((t) => !muitos.includes(t)); return `<div class="grupoTracados"><span class="rotuloGrupo">${titulo}</span><div class="filtros" role="tablist" aria-label="Traçados ${titulo}">${muitos.map(chip).join('')}${poucos.length ? (R.outros ? poucos.map(chip).join('') : `<button class="maisTracados" data-outros="1">+${poucos.length} com poucos pilotos</button>`) : ''}</div></div>`; };
    const navPer = R.periodo === 'geral' ? '' : `<span class="navPeriodo"><button class="btn sec" data-ref="${esc(p.anterior || '')}" aria-label="${R.periodo === 'mes' ? 'Mês anterior' : 'Semana anterior'}" title="${R.periodo === 'mes' ? 'Mês anterior' : 'Semana anterior'}" ${p.anterior ? '' : 'disabled'} style="width: 40px; padding: 0">${svg(IC.esq, 14)}</button>${R.ref ? `<button class="btn sec" data-ref="" style="padding: 0 12px">${R.periodo === 'mes' ? 'Este mês' : 'Esta semana'}</button>` : ''}<button class="btn sec" data-ref="${esc(p.proximo || '')}" aria-label="${R.periodo === 'mes' ? 'Próximo mês' : 'Próxima semana'}" title="${R.periodo === 'mes' ? 'Próximo mês' : 'Próxima semana'}" ${p.proximo ? '' : 'disabled'} style="width: 40px; padding: 0">${svg(IC.dir, 14)}</button></span>`;
    $('#corpoRank').innerHTML = `${dados.antigo ? '<p class="avisoAntigo">Período do LapTime antigo: ele guardava só os 10 primeiros de cada faixa de peso, então este ranking junta esses tempos.</p>' : dados.comAntigo ? '<p class="avisoAntigo">O geral junta a cronometragem nova, as corridas do LapTime de setembro e o ranking antigo desde jan/2025 (10 primeiros de cada faixa de peso).</p>' : ''}
      <div class="barraTracados">${blocoGrupo('Indoor', grupo(false))}${blocoGrupo('Super Kart', grupo(true))}${navPer}</div>
      ${dados.erroCronometragem ? `<p class="erroMsg">A cronometragem não respondeu agora (${esc(dados.erroCronometragem)}); mostrando os tempos já lidos.</p>` : ''}
      ${L.length ? `<section class="podio">${L.slice(0, 3).map((l, i) => { const inner = `<span class="medalha" style="${med[i]}">${i + 1}</span>${avatarPiloto(l.cid, l.nome, 48, 'border-radius: 14px')}<span class="col podioTexto"><b class="podioNome">${esc(nomeBonito(l.nome))}</b><span class="podioTempo"><b class="mono">${fmtVolta(l.ms)}</b><span class="peq">${i ? '+' + ((l.ms - lider.ms) / 1000).toFixed(3) : 'líder'} · ${dt(l.dia)}</span></span></span>`; return l.cid ? `<a href="#/piloto/${l.cid}" class="cartaoPodio ${i === 0 ? 'primeiro' : ''}">${inner}</a>` : `<div class="cartaoPodio ${i === 0 ? 'primeiro' : ''}">${inner}</div>`; }).join('')}</section>
      <section class="cartao"><div class="cartaoCab"><h2>${esc(dados.tracado)} · ${R.periodo === 'mes' ? 'mês' : R.periodo}</h2><span class="sub">melhor volta de cada piloto · um tempo por piloto</span></div>
        <div class="tabelaRank"><div class="linhaRank cab"><span class="rPos">Pos</span><span></span><span class="rNome">Piloto</span><span class="rTempo">Melhor volta</span><span class="rDif">Diferença</span><span class="rKart">Kart</span><span class="rBat">Bateria</span><span class="rData">Data</span></div>${L.map(linha).join('')}</div>
        <div class="rodapeCartela"><span>Mostrando ${L.length} de ${dados.total} ${dados.total === 1 ? 'piloto' : 'pilotos'}</span><span>Voltas inválidas, desclassificados e equalização não entram</span>${dados.total > L.length ? '<button class="btn sec peq" data-todos="1" style="margin-left: auto">Ver todos</button>' : ''}</div></section>`
      : `<section class="cartao"><div class="vazio"><b>${dados.tracados.length ? 'Sem tempos nesse traçado no período' : 'Nenhum tempo no período'}</b><span>${R.periodo === 'semana' ? 'A semana vai de domingo a sábado. Use as setas ou veja o mês.' : 'Os tempos aparecem quando as baterias são encerradas na cronometragem.'}</span></div></section>`}`;
  };
  const carregar = async () => {
    dados = await office(`/pilotos/ranking?periodo=${R.periodo}&top=${R.top}${R.ref ? '&ref=' + R.ref : ''}${R.tracado ? '&tracado=' + encodeURIComponent(R.tracado) : ''}`);
    R.tracado = dados.tracado;
    pintar();
    const ids = dados.linhas.filter((l) => l.cid && l.temFoto).map((l) => l.cid);
    if (ids.length) { await carregarMiniaturas(ids); pintar(); }
  };
  const imprimir = () => {
    const w = window.open('', '_blank'); if (!w) return toast('Libere as janelas novas para imprimir', true);
    const p = dados.periodo, titulo = `${dados.tracado} · ${R.periodo === 'mes' ? 'mês' : R.periodo}`;
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Ranking ${esc(titulo)}</title><style>body{font-family:system-ui,sans-serif;margin:28px;color:#1D1D1F}h1{margin:0;font-size:30px}p{color:#6E6E73;margin:4px 0 18px}table{border-collapse:collapse;width:100%;font-size:16px}td,th{border-bottom:1px solid #ddd;padding:8px 6px;text-align:left}th{font-size:12px;text-transform:uppercase;color:#6E6E73}td.t{font-family:monospace;font-weight:700}tr:nth-child(-n+4) td{font-weight:700}</style></head><body><h1>Ranking · ${esc(titulo)}</h1><p>${p.de ? `${dataBr(p.de)} a ${dataBr(p.ate)}` : 'Geral, desde jan/2025'} · Kartódromo Internacional de Betim · tempos oficiais, sem baterias de chuva</p><table><thead><tr><th>Pos</th><th>Piloto</th><th>Melhor volta</th><th>Kart</th><th>Data</th></tr></thead><tbody>${dados.linhas.slice(0, 30).map((l) => `<tr><td>${l.pos}º</td><td>${esc(nomeBonito(l.nome))}</td><td class="t">${fmtVolta(l.ms)}</td><td>${esc(l.kart || '—')}</td><td>${dataBr(l.dia)}</td></tr>`).join('')}</tbody></table><script>setTimeout(()=>print(),300)<\/script></body></html>`);
    w.document.close();
  };
  tela.addEventListener('click', (e) => {
    const p = e.target.closest('[data-periodo]'); if (p) { R.periodo = p.dataset.periodo; R.top = 50; R.ref = null; carregar().catch(falhou); return; }
    const t = e.target.closest('[data-tracado]'); if (t) { R.tracado = t.dataset.tracado; R.top = 50; carregar().catch(falhou); return; }
    if (e.target.closest('[data-outros]')) { R.outros = true; pintar(); return; }
    const rf = e.target.closest('[data-ref]'); if (rf && !rf.disabled) { R.ref = rf.dataset.ref || null; R.top = 50; carregar().catch(falhou); return; }
    if (e.target.closest('[data-todos]')) { R.top = 500; carregar().catch(falhou); return; }
    if (e.target.closest('[data-imprimir]') && dados) imprimir();
  });
  await carregar();
  repetir(() => carregar().catch(() => undefined), 60_000);
};
