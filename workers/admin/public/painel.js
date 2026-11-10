'use strict';
/* Telas que juntam vários sistemas: Campeonatos (resultados oficiais da crono + regra de pontos), Sorteio e karts,
   Autoatendimento (sinais dos totens) e PCs e sistema. Depende de app.js (carregado antes). */

// ------------------------------------------------------------------ cálculo do campeonato
const Campeonato = (() => {
  const cache = new Map();
  async function sessao(id) {
    if (!cache.has(id)) cache.set(id, office(`/crono/dados/${encodeURIComponent(id)}`).catch((e) => ({ erro: e.message, standings: [] })));
    return cache.get(id);
  }
  const chave = (nome) => String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const pontosDa = (lista, pos) => (pos <= lista.length ? lista[pos - 1] : Math.max(1, lista[lista.length - 1] - (pos - lista.length)));

  /** Classificação por categoria: corridas de todas as etapas na ordem; cada coluna é uma corrida. */
  async function calcular(c, descartar) {
    const P = String(c.pontos || '50,45,42,40,38').split(',').map(Number).filter((n) => n > 0);
    const colunas = [];
    for (const e of c.etapas) e.sessoesCorrida.forEach((sid, i) => colunas.push({ etapa: e, sid, pole: e.sessoesPole[i] || null, rotulo: `E${e.ordem} C${i + 1}` }));
    const dados = await Promise.all(colunas.map(async (col) => ({ ...col, s: await sessao(col.sid), p: col.pole ? await sessao(col.pole) : null })));
    const pilotos = new Map(); // categoria|nome → linha
    const categorias = new Set();
    dados.forEach((col, ci) => {
      const lista = (col.s.standings || []).slice().sort((a, b) => a.position - b.position);
      const melhor = Math.min(...lista.map((x) => x.bestLapMs || Infinity));
      const poleNome = col.p && col.p.standings && col.p.standings.length ? chave(col.p.standings.slice().sort((a, b) => a.position - b.position)[0].name) : null;
      const posCat = new Map();
      for (const r of lista) {
        const cat = r.category || 'Geral';
        categorias.add(cat);
        const n = (posCat.get(cat) || 0) + 1; posCat.set(cat, n);
        const pos = c.regra === 'geral' ? r.position : n;
        const k = `${cat}|${chave(r.name)}`;
        if (!pilotos.has(k)) pilotos.set(k, { nome: r.name, categoria: cat, pts: Array(dados.length).fill(null) });
        let v = r.desclassificado ? 0 : pontosDa(P, pos);
        const marcas = [];
        if (!r.desclassificado && r.bestLapMs && r.bestLapMs === melhor && c.bonusMelhorVolta) { v += c.bonusMelhorVolta; marcas.push('mv'); }
        if (!r.desclassificado && poleNome && chave(r.name) === poleNome && c.bonusPole) { v += c.bonusPole; marcas.push('pole'); }
        if (r.penaltyMs > 0 && c.penalidadePontos) { v -= c.penalidadePontos; marcas.push('pen'); }
        if (r.desclassificado) marcas.push('dc');
        pilotos.get(k).pts[ci] = { v, marcas, pos };
      }
    });
    const linhas = [...pilotos.values()].map((l) => {
      const validos = l.pts.map((p, i) => ({ p, i })).filter((x) => x.p);
      const desc = new Set();
      if (descartar && c.descartes > 0 && validos.length > c.descartes) validos.slice().sort((a, b) => a.p.v - b.p.v).slice(0, c.descartes).forEach((x) => desc.add(x.i));
      const total = validos.filter((x) => !desc.has(x.i)).reduce((a, x) => a + x.p.v, 0);
      return { ...l, desc, total, corridas: validos.length };
    });
    return { colunas: dados.map((d) => ({ rotulo: d.rotulo, nome: d.s.name || d.sid, erro: d.s.erro })), categorias: [...categorias].sort(), linhas };
  }
  return { calcular, sessao };
})();

// ------------------------------------------------------------------ Campeonatos
TELAS.campeonatos = async (tela) => {
  const C = S.camp || (S.camp = { sel: null, cat: null, descartar: false });
  tela.innerHTML = `${cabecalho('Competições · resultados oficiais da cronometragem', 'Campeonatos', `<button class="btn prim" data-novo-camp="1">${svg(IC.mais, 14, 'var(--kib-cor-acao-sobre-principal)', 2.6)}Novo campeonato</button>`)}<main class="principal" id="corpoCamp"><div class="esqueleto" style="height: 400px"></div></main>`;
  let camps = [];
  const carregar = async () => { camps = await office('/campeonatos'); if (!camps.find((c) => c.id === C.sel)) C.sel = camps[0]?.id ?? null; await pintar(); };
  const pintar = async () => {
    const corpo = $('#corpoCamp');
    if (!camps.length) { corpo.innerHTML = `<section class="cartao"><div class="vazio"><b>Nenhum campeonato cadastrado</b><span>Crie o campeonato (ex.: Ultras do Kart 2026) e ligue cada etapa às corridas da cronometragem. A classificação sai sozinha dos resultados oficiais.</span><button class="btn prim" style="margin-top: var(--kib-espaco-denso-12)" data-novo-camp="1">Criar campeonato</button></div></section>`; return; }
    const c = camps.find((x) => x.id === C.sel);
    corpo.innerHTML = `<div class="linha-quebra gap-meio">${camps.map((x) => `<button class="btn ${x.id === c.id ? 'branco' : 'sec'}" data-camp="${x.id}">${esc(x.nome)}${x.temporada ? ' · ' + esc(x.temporada) : ''}</button>`).join('')}</div>
      <section style="border-radius: var(--kib-raio-janela); overflow: hidden; color: var(--kib-cor-acao-sobre-principal); background: radial-gradient(90% 140% at 100% 0%, color-mix(in srgb, var(--kib-cor-categoria-ambar-topo) 35%, transparent) 0%, color-mix(in srgb, var(--kib-cor-categoria-ambar-topo) 0%, transparent) 55%), linear-gradient(135deg, var(--kib-cor-superficie-inversa) 0%, var(--kib-cor-superficie-inversa) 100%); box-shadow: 0 30px 60px -30px color-mix(in srgb, var(--kib-cor-texto-principal) 55%, transparent)">
        <div style="display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--kib-espaco-2) var(--kib-espaco-3); padding: var(--kib-espaco-3) var(--kib-espaco-3) var(--kib-espaco-2)"><span class="col gap-meio"><span style="font-size: var(--kib-fonte-tamanho-pequeno); font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--kib-cor-categoria-ambar-topo)">${esc(c.temporada || 'Campeonato')}</span><span style="font-size: var(--kib-fonte-tamanho-destaque); font-weight: 700; letter-spacing: -0.02em">${esc(c.nome)}</span><span style="font-size: var(--kib-fonte-tamanho-corpo); color: var(--kib-cor-icone-suave)">${c.etapas.length} etapa(s) · pontos ${esc(c.pontos)}… · posição ${c.regra === 'geral' ? 'geral da corrida' : 'na categoria'}</span></span>
          <span style="margin-left: auto; display: flex; flex-wrap: wrap; gap: var(--kib-espaco-1)"><button class="btn" style="background: color-mix(in srgb, var(--kib-cor-acao-sobre-principal) 12%, transparent); color: var(--kib-cor-acao-sobre-principal)" data-pdf="1">PDF por categoria</button><button class="btn" style="background: ${G('var(--kib-cor-categoria-ambar-topo)', 'var(--kib-cor-categoria-ambar-base)')}; color: var(--kib-cor-texto-principal)" data-nova-etapa="1">+ Etapa</button></span></div>
        <ol style="margin: 0; padding: 0 var(--kib-espaco-3) var(--kib-espaco-denso-20); list-style: none; display: grid; grid-template-columns: repeat(${Math.max(1, c.etapas.length)}, minmax(0, 1fr)); gap: var(--kib-espaco-1)">${c.etapas.map((e) => `<li class="col gap-1"><span style="height: 4px; border-radius: var(--kib-raio-chip); background: ${e.publicada ? 'var(--kib-cor-categoria-ambar-topo)' : 'linear-gradient(90deg, var(--kib-cor-categoria-ambar-topo) 50%, color-mix(in srgb, var(--kib-cor-acao-sobre-principal) 18%, transparent) 50%)'}"></span><span class="col" style="gap: 1px"><b class="t-pequeno">${esc(e.nome)}${e.data ? ' · ' + e.data.split('-').reverse().slice(0, 2).join('/') : ''}</b><span style="font-size: var(--kib-fonte-tamanho-pequeno); color: var(--kib-cor-texto-discreto)">${e.sessoesCorrida.length} corrida(s) · ${e.publicada ? 'oficial' : 'aguardando recurso'}</span><span style="display: flex; gap: var(--kib-espaco-1); margin-top: 2px"><button class="btn peq" style="height: 20px; padding: 0; background: transparent; color: var(--kib-cor-categoria-ambar-topo)" data-oficial="${e.id}" data-v="${e.publicada ? 0 : 1}">${e.publicada ? 'Desmarcar oficial' : 'Marcar oficial'}</button><button class="btn peq" style="height: 20px; padding: 0; background: transparent; color: var(--kib-cor-estado-perigo-fundo)" data-tirar-etapa="${e.id}">Tirar</button></span></span></li>`).join('') || '<li style="color: var(--kib-cor-icone-suave)">Nenhuma etapa ainda. Toque em “+ Etapa” e escolha as corridas na cronometragem.</li>'}</ol>
      </section>
      <div id="classif"><div class="esqueleto" style="height: 360px"></div></div>
      <section class="cartao leve"><div class="cartaoCab"><h2>Regra de pontuação</h2><span class="sub">vale para todas as etapas deste campeonato</span></div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--kib-espaco-denso-12); padding: 0 var(--kib-espaco-2) var(--kib-espaco-2)">
          <span class="campo"><span>Pontuar pela posição</span><span class="seg">${[['categoria', 'Na categoria'], ['geral', 'Geral']].map(([v, t]) => `<button data-regra="${v}" class="${c.regra === v ? 'sel' : ''}">${t}</button>`).join('')}</span></span>
          <label class="campo"><span>Pontos (1º, 2º, 3º…)</span><input class="entrada" data-campo-camp="pontos" value="${esc(c.pontos)}"></label>
          <label class="campo"><span>Bônus pole</span><input class="entrada" type="number" min="0" data-campo-camp="bonusPole" value="${c.bonusPole}"></label>
          <label class="campo"><span>Bônus melhor volta</span><input class="entrada" type="number" min="0" data-campo-camp="bonusMelhorVolta" value="${c.bonusMelhorVolta}"></label>
          <label class="campo"><span>Punição em tempo (pontos a menos)</span><input class="entrada" type="number" min="0" data-campo-camp="penalidadePontos" value="${c.penalidadePontos}"></label>
          <label class="campo"><span>Descartes (piores corridas)</span><input class="entrada" type="number" min="0" data-campo-camp="descartes" value="${c.descartes}"></label>
        </div></section>`;
    if (!c.etapas.length) { $('#classif').innerHTML = ''; return; }
    const r = await Campeonato.calcular(c, C.descartar);
    if (C.sel !== c.id) return;
    S.camp.ultimo = { c, r };
    if (!r.categorias.includes(C.cat)) C.cat = r.categorias[0];
    const linhas = r.linhas.filter((l) => l.categoria === C.cat).sort((a, b) => b.total - a.total);
    const med = ['background: linear-gradient(180deg, var(--kib-cor-estado-aviso-fundo), var(--kib-cor-categoria-amarelo-topo)); color: var(--kib-cor-estado-aviso-texto-forte)', 'background: linear-gradient(180deg, var(--kib-cor-fundo-app), var(--kib-cor-borda-forte)); color: var(--kib-cor-texto-corpo)', 'background: linear-gradient(180deg, var(--kib-cor-estado-aviso-fundo), var(--kib-cor-categoria-ambar-base)); color: var(--kib-cor-estado-aviso-texto-forte)'];
    const cel = (p, desc) => !p ? '<span class="peq t-dir">—</span>' : `<span class="t-dir"><span style="display: inline-block; min-width: 30px; padding: 2px var(--kib-espaco-meio); border-radius: var(--kib-raio-chip); text-align: center; ${desc ? 'background: color-mix(in srgb, var(--kib-cor-texto-discreto) 14%, transparent); color: var(--kib-cor-texto-discreto); text-decoration: line-through' : p.marcas.includes('pen') || p.marcas.includes('dc') ? 'background: color-mix(in srgb, var(--kib-cor-estado-perigo-solido) 14%, transparent); color: var(--erroTxt); font-weight: 700' : p.marcas.length ? 'background: color-mix(in srgb, var(--kib-cor-status-ok) 18%, transparent); color: var(--okTxt); font-weight: 700' : ''}" title="${esc(p.pos + 'º' + (p.marcas.length ? ' · ' + p.marcas.join(', ') : ''))}">${p.v}</span></span>`;
    const grade = `40px minmax(0, 1.6fr) repeat(${r.colunas.length}, 52px) 64px`;
    $('#classif').innerHTML = `<div style="display: flex; flex-wrap: wrap; align-items: center; gap: var(--kib-espaco-1); margin-bottom: var(--kib-espaco-denso-12)"><div class="seg">${r.categorias.map((k) => `<button data-cat="${esc(k)}" class="${k === C.cat ? 'sel' : ''}">${esc(k)}</button>`).join('')}</div>
        <button role="switch" aria-checked="${C.descartar}" data-descartar="1" style="margin-left: auto; display: flex; align-items: center; gap: var(--kib-espaco-1); height: 34px; padding: 0 var(--kib-espaco-denso-12) 0 var(--kib-espaco-meio); border: 0; border-radius: var(--kib-raio-botao); background: var(--kib-cor-superficie-padrao); box-shadow: 0 0 0 1px var(--linha2); font-size: var(--kib-fonte-tamanho-corpo); font-weight: 600"><span class="chave ${C.descartar ? 'on' : ''}"></span>Aplicar descarte das ${c.descartes} piores</button></div>
      ${r.colunas.some((x) => x.erro) ? `<p class="erroMsg">Algumas corridas não abriram: ${esc(r.colunas.filter((x) => x.erro).map((x) => x.rotulo + ' (' + x.erro + ')').join(', '))}</p>` : ''}
      <section style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--kib-espaco-denso-12); margin-bottom: var(--kib-espaco-2)">${linhas.slice(0, 3).map((l, k) => `<div class="kpi" style="flex-direction: row; align-items: center; gap: var(--kib-espaco-denso-12)"><span style="width: 50px; height: 50px; border-radius: var(--kib-raio-cartao); display: flex; align-items: center; justify-content: center; font-size: var(--kib-fonte-tamanho-titulo-grande); font-weight: 700; ${med[k]}">${k + 1}</span><span class="col"><b class="t-subtitulo">${esc(l.nome)}</b><span class="peq">${k === 0 ? (linhas[1] ? 'líder · ' + (l.total - linhas[1].total) + ' pts de vantagem' : 'líder') : '−' + (linhas[0].total - l.total) + ' do líder'}</span></span><span class="col" style="margin-left: auto; align-items: flex-end"><span class="num t-titulo-grande peso-negrito">${l.total}</span><span class="peq">pontos</span></span></div>`).join('')}</section>
      <section class="cartao"><div class="cartaoCab"><h2>Classificação · ${esc(C.cat || '')}</h2><span class="sub">${linhas.length} pilotos · passe o mouse num ponto para ver a posição</span></div>
        <div class="rolagemX"><div style="min-width: ${360 + r.colunas.length * 60}px"><div class="cabTabela" style="grid-template-columns: ${grade}"><span>Pos</span><span>Piloto</span>${r.colunas.map((x) => `<span class="t-dir" title="${esc(x.nome)}">${x.rotulo}</span>`).join('')}<span class="t-dir">Total</span></div>
        ${linhas.map((l, k) => `<div class="linhaTabela" style="grid-template-columns: ${grade}"><b style="font-size: var(--kib-fonte-tamanho-subtitulo); ${k < 3 ? 'color: var(--kib-cor-estado-aviso-texto)' : ''}">${k + 1}</b><b class="trunc">${esc(l.nome)}</b>${l.pts.map((p, i) => cel(p, l.desc.has(i))).join('')}<b class="num" style="text-align: right; font-size: var(--kib-fonte-tamanho-subtitulo)">${l.total}</b></div>`).join('')}</div></div>
        <div style="display: flex; flex-wrap: wrap; gap: var(--kib-espaco-denso-12); padding: var(--kib-espaco-denso-12) var(--kib-espaco-2); font-size: var(--kib-fonte-tamanho-pequeno); color: var(--tinta2); background: var(--sup2)"><span><span class="chip verde">+</span> bônus pole ou melhor volta</span><span><span class="chip vermelho">−</span> punição em tempo ou desclassificado</span><span><span class="chip cinza" style="text-decoration: line-through">0</span> descartada</span></div></section>`;
  };
  const novaEtapa = async (c) => {
    const m = modal('<div class="esqueleto" style="height: 300px; margin: var(--kib-espaco-denso-20)"></div>'); m.style.maxWidth = '860px';
    let eventos = [];
    try { eventos = await office(`/painel/eventos?de=${somaDias(hojeIso(), -120)}`); } catch (e) { falhou(e); fecharCamada(); return; }
    const marcadas = { corrida: new Set(), pole: new Set() };
    const pintarM = () => {
      m.innerHTML = `<div class="modalTopo" style="${TIPOS.camp.topo}"><span class="col gap-meio"><span style="font-size: var(--kib-fonte-tamanho-pequeno); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; opacity: .8">${esc(c.nome)}</span><span class="t-titulo-grande peso-negrito">Nova etapa</span><span style="font-size: var(--kib-fonte-tamanho-corpo); opacity: .85">Marque as corridas (e as tomadas de tempo, para o bônus de pole) na ordem em que aconteceram.</span></span><button class="fechar hov solto" data-acao="fechar">${svg(IC.fechar, 15, 'var(--kib-cor-texto-principal)', 2.4)}</button></div>
        <div style="display: flex; flex-wrap: wrap; gap: var(--kib-espaco-denso-12); padding: var(--kib-espaco-2) var(--kib-espaco-2) 0"><label class="campo" style="flex: 1 1 220px"><span>Nome da etapa</span><input class="entrada" id="nomeEtapa" value="${c.etapas.length + 1}ª etapa"></label><label class="campo" style="flex: 1 1 160px"><span>Data</span><input class="entrada" id="dataEtapa" type="date" value="${hojeIso()}"></label></div>
        <div style="max-height: 420px; overflow-y: auto; padding: var(--kib-espaco-denso-12) var(--kib-espaco-2) var(--kib-espaco-2); display: flex; flex-direction: column; gap: var(--kib-espaco-1)">${eventos.map((e) => `<div class="secao"><span class="titulo">${esc(e.nome)}<span class="peq" style="margin-left: auto; font-weight: 500">${esc((e.data || '').split('-').reverse().join('/'))}</span></span>${e.sessoes.filter((s) => s.tipo === 'corrida' || s.tipo === 'classificacao').map((s) => { const tp = s.tipo === 'corrida' ? 'corrida' : 'pole'; const on = marcadas[tp].has(s.id); return `<button class="hov" data-marcar="${esc(s.id)}" data-tp="${tp}" style="display: flex; align-items: center; gap: var(--kib-espaco-1); padding: var(--kib-espaco-1) var(--kib-espaco-1); border: 0; border-radius: var(--kib-raio-botao); text-align: left; ${on ? 'background: color-mix(in srgb, var(--kib-cor-marca-principal) 8%, transparent); box-shadow: inset 0 0 0 1.5px var(--verde)' : 'background: var(--fundo)'}"><span style="width: 18px; height: 18px; border-radius: var(--kib-raio-chip); display: flex; align-items: center; justify-content: center; ${on ? 'background: var(--verde)' : 'background: var(--kib-cor-superficie-padrao); box-shadow: inset 0 0 0 1.5px var(--kib-cor-borda-forte)'}">${on ? svg(IC.ok, 11, 'var(--kib-cor-superficie-padrao)', 3.4) : ''}</span><span class="col cresce"><b>${esc(s.nome)}</b><span class="peq">${s.tipo === 'corrida' ? 'Corrida' : 'Tomada de tempo (pole)'} · ${s.pilotos} pilotos · ${esc(s.estado)}</span></span>${on ? `<span class="chip verde">${tp === 'corrida' ? 'C' : 'P'}${[...marcadas[tp]].indexOf(s.id) + 1}</span>` : ''}</button>`; }).join('')}</div>`).join('') || '<div class="vazio">Nenhum evento com corridas nos últimos 120 dias.</div>'}</div>
        <div class="modalRodape"><span class="peq">${marcadas.corrida.size} corrida(s) · ${marcadas.pole.size} pole(s)</span><button class="btn sec empurra" data-acao="fechar">Cancelar</button><button class="btn prim" id="salvarEtapa" ${marcadas.corrida.size ? '' : 'disabled'}>Salvar etapa</button></div>`;
    };
    pintarM();
    m.onclick = async (ev) => {
      const b = ev.target.closest('[data-marcar]');
      if (b) { const set = marcadas[b.dataset.tp]; set.has(b.dataset.marcar) ? set.delete(b.dataset.marcar) : set.add(b.dataset.marcar); const nome = $('#nomeEtapa').value, data = $('#dataEtapa').value; pintarM(); $('#nomeEtapa').value = nome; $('#dataEtapa').value = data; return; }
      if (ev.target.closest('#salvarEtapa')) {
        try { camps = await office(`/campeonatos/${c.id}/etapas`, { method: 'POST', body: { nome: $('#nomeEtapa').value, data: $('#dataEtapa').value, sessoesCorrida: [...marcadas.corrida], sessoesPole: [...marcadas.pole] } }); toast('Etapa salva · classificação recalculada'); fecharCamada(); pintar(); } catch (er) { falhou(er); }
      }
    };
  };
  const imprimir = () => {
    const u = S.camp.ultimo; if (!u) return;
    const { c, r } = u;
    const w = window.open('', '_blank'); if (!w) return toast('Libere as janelas novas para gerar o PDF', true);
    const blocos = r.categorias.map((cat) => { const l = r.linhas.filter((x) => x.categoria === cat).sort((a, b) => b.total - a.total); return `<h2>${esc(cat)}</h2><table><thead><tr><th>Pos</th><th>Piloto</th>${r.colunas.map((x) => `<th>${x.rotulo}</th>`).join('')}<th>Total</th></tr></thead><tbody>${l.map((p, k) => `<tr><td>${k + 1}</td><td class="n">${esc(p.nome)}</td>${p.pts.map((q, i) => `<td class="${p.desc.has(i) ? 'd' : ''}">${q ? q.v + (q.marcas.length ? '*' : '') : '—'}</td>`).join('')}<td><b>${p.total}</b></td></tr>`).join('')}</tbody></table>`; }).join('<div class="q"></div>');
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(c.nome)} · classificação</title><style>body{font-family: var(--kib-fonte-familia-interface);margin: var(--kib-espaco-3);color:var(--kib-cor-texto-principal)}h1{margin: 0 0 var(--kib-espaco-meio)}p{color:var(--kib-cor-texto-apoio);margin: 0 0 var(--kib-espaco-2)}h2{margin: var(--kib-espaco-2) 0 var(--kib-espaco-1)}table{border-collapse:collapse;width:100%;font-size: var(--kib-fonte-tamanho-pequeno)}th,td{border:1px solid var(--kib-cor-borda-sutil);padding: var(--kib-espaco-meio) var(--kib-espaco-meio);text-align:center}td.n{text-align:left}td.d{color:var(--kib-cor-texto-discreto);text-decoration:line-through}.q{page-break-after:always}</style></head><body><h1>${esc(c.nome)}</h1><p>${esc(c.temporada || '')} · pontos ${esc(c.pontos)}… · posição ${c.regra === 'geral' ? 'geral' : 'na categoria'} · * = bônus ou punição · gerado em ${new Date().toLocaleString('pt-BR', { timeZone: TZ })}</p>${blocos}<script>setTimeout(()=>print(),300)<\/script></body></html>`);
    w.document.close();
  };
  tela.addEventListener('click', async (ev) => {
    const t = (s) => ev.target.closest(s);
    let x;
    if (t('[data-novo-camp]')) {
      const m = modal(`<div class="modalTopo" style="background: linear-gradient(160deg, var(--kib-cor-borda-sutil), var(--kib-cor-fundo-app))"><span class="col gap-meio"><span class="t-titulo-grande peso-negrito">Novo campeonato</span><span class="peq">Crie um campeonato para apurar etapas, categorias e pontuação.</span></span><button class="fechar hov solto" data-acao="fechar" aria-label="Fechar">${svg(IC.fechar, 15, 'var(--kib-cor-texto-principal)', 2.4)}</button></div>
        <div style="display: grid; gap: var(--kib-espaco-denso-12); padding: var(--kib-espaco-2)">
          <label class="campo"><span>Nome do campeonato</span><input class="entrada" id="novoCampNome" placeholder="Ex.: Ultras do Kart" required autofocus></label>
          <label class="campo"><span>Temporada</span><input class="entrada" id="novoCampTemp" placeholder="Ex.: 2026 · 2º semestre" value="2026"></label>
          <p class="erroMsg" id="novoCampErro"></p>
        </div>
        <div class="modalRodape"><button class="btn sec empurra" data-acao="fechar">Cancelar</button><button class="btn prim" id="salvarNovoCamp">Criar campeonato</button></div>`, 'Novo campeonato');
      m.style.maxWidth = '520px';
      $('#salvarNovoCamp', m).onclick = async () => {
        const nome = $('#novoCampNome', m).value.trim();
        const temp = $('#novoCampTemp', m).value.trim();
        if (!nome) { $('#novoCampErro', m).textContent = 'Informe o nome do campeonato.'; return; }
        try {
          camps = await office('/campeonatos', { method: 'POST', body: { nome, temporada: temp, regra: 'categoria' } });
          C.sel = camps.find((c) => c.nome === nome)?.id ?? camps[0].id;
          toast('Campeonato criado'); fecharCamada(); pintar();
        } catch (er) { $('#novoCampErro', m).textContent = er.message; }
      };
      return;
    }
    if ((x = t('[data-camp]'))) { C.sel = +x.dataset.camp; C.cat = null; pintar(); return; }
    if ((x = t('[data-cat]'))) { C.cat = x.dataset.cat; pintar(); return; }
    if (t('[data-descartar]')) { C.descartar = !C.descartar; pintar(); return; }
    if (t('[data-pdf]')) { imprimir(); return; }
    const c = camps.find((y) => y.id === C.sel);
    if (t('[data-nova-etapa]')) { novaEtapa(c); return; }
    if ((x = t('[data-regra]'))) { try { camps = await office(`/campeonatos/${c.id}`, { method: 'PUT', body: { regra: x.dataset.regra } }); toast('Regra salva · classificação recalculada'); pintar(); } catch (er) { falhou(er); } return; }
    if ((x = t('[data-oficial]'))) { try { camps = await office(`/campeonatos/${c.id}/etapas/${x.dataset.oficial}`, { method: 'PUT', body: { publicada: x.dataset.v === '1' } }); pintar(); } catch (er) { falhou(er); } return; }
    if ((x = t('[data-tirar-etapa]'))) {
      const ok = await confirmar('Tirar esta etapa do campeonato?', 'Os resultados da cronometragem não são apagados.', 'Tirar etapa', true);
      if (!ok) return;
      try { camps = await office(`/campeonatos/${c.id}/etapas/${x.dataset.tirarEtapa}`, { method: 'DELETE' }); pintar(); } catch (er) { falhou(er); }
    }
  });
  tela.addEventListener('change', async (ev) => {
    const f = ev.target.dataset.campoCamp; if (!f) return;
    const c = camps.find((y) => y.id === C.sel);
    try { camps = await office(`/campeonatos/${c.id}`, { method: 'PUT', body: { [f]: ev.target.value } }); toast('Regra salva · classificação recalculada'); pintar(); } catch (er) { falhou(er); }
  });
  await carregar();
};


// ------------------------------------------------------------------ sinais dos PCs (Sistema e Autoatendimento)
function quandoMin(m) { return m == null ? '—' : m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} d`; }


const NOME_APP = { Recepcao: 'Recepção', Autoatendimento: 'Totem', Cronometragem: 'Cronometragem' };
const GRADE_PCS = '64px minmax(0, 1fr) minmax(0, 1.3fr) minmax(0, 1.5fr) 110px';

TELAS.sistema = async (tela) => {
  tela.innerHTML = `${cabecalho('Sistema · rede 192.168.20.x', 'PCs e sistema')}<main class="principal"><section class="kpis" id="servicos"></section><section class="cartao" id="pcs"><div class="esqueleto" style="height: 300px; margin: var(--kib-espaco-2)"></div></section><section class="cartao leve"><div class="cartaoCab"><span class="col"><h2>Usuários e acessos</h2><span class="sub">criar, editar, excluir e escolher as telas de cada perfil</span></span><a class="btn prim dir" href="#/usuarios">Abrir</a></div></section></main>`;
  const carregar = async () => {
    await atualizarConexao();
    const r = S.saude;
    const s = await office('/painel/sinais');
    if (!tela.isConnected) return;
    const srv = $('#servicos', tela), pcs = $('#pcs', tela);
    if (r && srv) srv.innerHTML = [['Servidor da operação', 'SRVKART · KartodromoOps', r.ops], ['Cronometragem', 'ORBITS · decoder', r.crono]].map(([t, d, x]) => `<div class="kpi"><span class="rot"><span class="ponto" style="width: 8px; height: 8px; background: ${x.ok ? 'var(--kib-cor-status-ok)' : 'var(--kib-cor-estado-perigo-solido)'}"></span>${t}</span><span class="val t-titulo-grande">${x.ok ? x.ms + ' ms' : 'sem resposta'}</span><span class="peq">${d}</span></div>`).join('')
      + `<div class="kpi"><span class="rot">Versões publicadas</span><span class="col" style="gap: var(--kib-espaco-meio); margin-top: var(--kib-espaco-meio)">${Object.entries(s.publicadas || {}).map(([a, v]) => `<span style="display: flex; justify-content: space-between; font-size: var(--kib-fonte-tamanho-corpo)"><span>${NOME_APP[a] || esc(a)}</span><b class="mono">${esc(v || '—')}</b></span>`).join('')}</span></div>`;
    const off = s.pcs.filter((p) => !p.online);
    selo('sistema', off.length ? String(off.length) : '', 'vermelho');
    const progs = (p) => p.apps.length ? p.apps.map((a) => `<span style="display: flex; align-items: center; gap: var(--kib-espaco-meio); flex-wrap: wrap"><b class="t-pequeno">${NOME_APP[a.app] || esc(a.app)}</b><span class="mono t-pequeno">${esc(a.versao || '')}</span>${a.atualizando ? '<span class="chip laranja">atualizando</span>' : '<span class="chip verde">em dia</span>'}<span class="peq">${quandoMin(a.minutos)}</span></span>`).join('')
      : p.totem ? `<span class="peq">Totem em uso ${quandoMin(p.totem.minutos)}</span>` : `<span class="peq">${p.online ? 'nenhum programa pediu atualização desde ' + (s.desde < 60 ? `${s.desde} min` : `${Math.round(s.desde / 60)} h`) : '—'}</span>`;
    if (pcs) pcs.innerHTML = `<div class="cartaoCab"><span class="col"><h2>Computadores</h2><span class="sub">rede testada pelo SRVKART agora · versão = a publicada, a não ser que o PC esteja baixando a nova</span></span><span class="chip ${off.length ? 'vermelho' : 'verde'} dir">${off.length ? off.length + ' sem resposta' : 'todos respondendo'}</span></div>
      <div class="rolagemX"><div style="min-width: 780px"><div class="cabTabela" style="grid-template-columns: ${GRADE_PCS}"><span>IP</span><span>Computador</span><span>Função</span><span>Programas · versão · último sinal</span><span>Rede</span></div>
      ${s.pcs.map((p) => `<div class="linhaTabela" style="grid-template-columns: ${GRADE_PCS}"><span class="mono">.${esc(p.ip.split('.').pop())}</span><b class="linha gap-1"><span class="ponto" style="width: 8px; height: 8px; flex-shrink: 0; background: ${p.online ? 'var(--kib-cor-status-ok)' : 'var(--kib-cor-estado-perigo-solido)'}"></span>${esc(p.nome)}</b><span class="peq">${esc(p.papel)}</span><span class="col gap-meio">${progs(p)}</span><span><span class="chip ${p.online ? 'verde' : 'vermelho'}">${p.online ? (p.ms ? p.ms + ' ms' : 'servidor') : 'sem resposta'}</span></span></div>`).join('')}</div></div>
      <p class="peq" style="margin: 0; padding: var(--kib-espaco-denso-12) var(--kib-espaco-2); background: var(--sup2); border-top: 1px solid var(--linha); line-height: 1.5">A Cronometragem pede atualização a cada 3 minutos; Recepção e totem pedem ao abrir. Instalar versão nova e reiniciar programa continuam fora do painel web (só no kartódromo, depois das 21:40). Totens e telão desligados aparecem “sem resposta”.</p>`;
  };
  await carregar();
  repetir(carregar, 30_000);
};

const telaTotensBase = TELAS.totens;
const PASSOS_TOTEM = [['/api/totem/identificar', 'Digitou o CPF'], ['/api/totem/cadastro', 'Cadastro ou peso'], ['/api/totem/baterias', 'Viu as baterias'], ['/api/totem/inscrever', 'Se inscreveu']];

// ------------------------------------------------------------------ extras: lista do sorteio para imprimir e detalhe do piloto no campeonato
const telaSorteioBase = TELAS.sorteio;

document.addEventListener('click', (e) => {
  const l = e.target.closest('#classif .linhaTabela'); if (!l || !S.camp?.ultimo) return;
  const nome = l.querySelector('b.trunc')?.textContent;
  const { r } = S.camp.ultimo;
  const p = r.linhas.find((x) => x.nome === nome && x.categoria === S.camp.cat); if (!p) return;
  const marca = { mv: 'melhor volta', pole: 'pole', pen: 'punição', dc: 'desclassificado' };
  modal(`<div class="modalTopo" style="${TIPOS.camp.topo}"><span class="col gap-meio"><span style="font-size: var(--kib-fonte-tamanho-pequeno); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; opacity: .8">${esc(p.categoria)}</span><span class="t-titulo-grande peso-negrito">${esc(p.nome)}</span><span style="font-size: var(--kib-fonte-tamanho-corpo); opacity: .85">${p.total} pontos · ${p.corridas} corrida(s)</span></span><button class="fechar hov solto" data-acao="fechar">${svg(IC.fechar, 15, 'var(--kib-cor-texto-principal)', 2.4)}</button></div>
    <div style="padding: var(--kib-espaco-1) 0 var(--kib-espaco-denso-12)">${r.colunas.map((c, i) => { const q = p.pts[i]; return `<div style="display: flex; align-items: center; gap: var(--kib-espaco-denso-12); padding: var(--kib-espaco-1) var(--kib-espaco-2); border-bottom: 1px solid var(--linha)"><span class="mono" style="width: 56px">${c.rotulo}</span><span class="trunc peq cresce">${esc(c.nome)}</span>${q ? `<span>${q.pos}º</span>${q.marcas.map((m) => `<span class="chip ${m === 'pen' || m === 'dc' ? 'vermelho' : 'verde'}">${marca[m]}</span>`).join('')}<b class="num" style="width: 36px; text-align: right; ${p.desc.has(i) ? 'text-decoration: line-through; color: var(--kib-cor-texto-discreto)' : ''}">${q.v}</b>` : '<span class="peq">não correu</span>'}</div>`; }).join('')}</div>`).style.maxWidth = '560px';
});
