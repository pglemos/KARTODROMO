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
  tela.innerHTML = `${cabecalho('Competições · resultados oficiais da cronometragem', 'Campeonatos', `<button class="btn prim" data-novo-camp="1">${svg(IC.mais, 14, '#FFF', 2.6)}Novo campeonato</button>`)}<main class="principal" id="corpoCamp"><div class="esqueleto" style="height: 400px"></div></main>`;
  let camps = [];
  const carregar = async () => { camps = await office('/campeonatos'); if (!camps.find((c) => c.id === C.sel)) C.sel = camps[0]?.id ?? null; await pintar(); };
  const pintar = async () => {
    const corpo = $('#corpoCamp');
    if (!camps.length) { corpo.innerHTML = `<section class="cartao"><div class="vazio"><b>Nenhum campeonato cadastrado</b><span>Crie o campeonato (ex.: Ultras do Kart 2026) e ligue cada etapa às corridas da cronometragem. A classificação sai sozinha dos resultados oficiais.</span><button class="btn prim" style="margin-top: 12px" data-novo-camp="1">Criar campeonato</button></div></section>`; return; }
    const c = camps.find((x) => x.id === C.sel);
    corpo.innerHTML = `<div style="display: flex; flex-wrap: wrap; gap: 6px">${camps.map((x) => `<button class="btn ${x.id === c.id ? 'branco' : 'sec'}" data-camp="${x.id}">${esc(x.nome)}${x.temporada ? ' · ' + esc(x.temporada) : ''}</button>`).join('')}</div>
      <section style="border-radius: 22px; overflow: hidden; color: #FFF; background: radial-gradient(90% 140% at 100% 0%, rgba(255,181,71,.35) 0%, rgba(255,181,71,0) 55%), linear-gradient(135deg, #1C1C1E 0%, #0B0B0C 100%); box-shadow: 0 30px 60px -30px rgba(0,0,0,.55)">
        <div style="display: flex; flex-wrap: wrap; align-items: flex-end; gap: 18px 28px; padding: 24px 24px 18px"><span class="col" style="gap: 6px"><span style="font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: #FFB547">${esc(c.temporada || 'Campeonato')}</span><span style="font-size: 30px; font-weight: 700; letter-spacing: -0.02em">${esc(c.nome)}</span><span style="font-size: 13px; color: #A1A1A6">${c.etapas.length} etapa(s) · pontos ${esc(c.pontos)}… · posição ${c.regra === 'geral' ? 'geral da corrida' : 'na categoria'}</span></span>
          <span style="margin-left: auto; display: flex; flex-wrap: wrap; gap: 8px"><button class="btn" style="background: rgba(255,255,255,.12); color: #FFF" data-pdf="1">PDF por categoria</button><button class="btn" style="background: ${G('#FFC56B', '#F07A00')}; color: #1D1D1F" data-nova-etapa="1">+ Etapa</button></span></div>
        <ol style="margin: 0; padding: 0 24px 22px; list-style: none; display: grid; grid-template-columns: repeat(${Math.max(1, c.etapas.length)}, minmax(0, 1fr)); gap: 8px">${c.etapas.map((e) => `<li class="col" style="gap: 8px"><span style="height: 4px; border-radius: 2px; background: ${e.publicada ? '#FFB547' : 'linear-gradient(90deg, #FFB547 50%, rgba(255,255,255,.18) 50%)'}"></span><span class="col" style="gap: 1px"><b style="font-size: 12.5px">${esc(e.nome)}${e.data ? ' · ' + e.data.split('-').reverse().slice(0, 2).join('/') : ''}</b><span style="font-size: 11.5px; color: #8E8E93">${e.sessoesCorrida.length} corrida(s) · ${e.publicada ? 'oficial' : 'aguardando recurso'}</span><span style="display: flex; gap: 8px; margin-top: 2px"><button class="btn peq" style="height: 20px; padding: 0; background: transparent; color: #FFB547" data-oficial="${e.id}" data-v="${e.publicada ? 0 : 1}">${e.publicada ? 'Desmarcar oficial' : 'Marcar oficial'}</button><button class="btn peq" style="height: 20px; padding: 0; background: transparent; color: #FF8A80" data-tirar-etapa="${e.id}">Tirar</button></span></span></li>`).join('') || '<li style="color: #A1A1A6">Nenhuma etapa ainda. Toque em “+ Etapa” e escolha as corridas na cronometragem.</li>'}</ol>
      </section>
      <div id="classif"><div class="esqueleto" style="height: 360px"></div></div>
      <section class="cartao leve"><div class="cartaoCab"><h2>Regra de pontuação</h2><span class="sub">vale para todas as etapas deste campeonato</span></div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; padding: 0 18px 18px">
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
    const med = ['background: linear-gradient(180deg, #FFE27A, #F5B800); color: #5C3A00', 'background: linear-gradient(180deg, #F2F2F7, #C7C7CC); color: #3A3A3C', 'background: linear-gradient(180deg, #F0C9A0, #C98A4B); color: #4A2A0A'];
    const cel = (p, desc) => !p ? '<span class="peq" style="text-align: right">—</span>' : `<span style="text-align: right"><span style="display: inline-block; min-width: 30px; padding: 2px 5px; border-radius: 6px; text-align: center; ${desc ? 'background: rgba(118,118,128,.14); color: #8E8E93; text-decoration: line-through' : p.marcas.includes('pen') || p.marcas.includes('dc') ? 'background: rgba(255,69,58,.14); color: var(--erroTxt); font-weight: 700' : p.marcas.length ? 'background: rgba(52,199,89,.18); color: var(--okTxt); font-weight: 700' : ''}" title="${esc(p.pos + 'º' + (p.marcas.length ? ' · ' + p.marcas.join(', ') : ''))}">${p.v}</span></span>`;
    const grade = `40px minmax(0, 1.6fr) repeat(${r.colunas.length}, 52px) 64px`;
    $('#classif').innerHTML = `<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 14px"><div class="seg">${r.categorias.map((k) => `<button data-cat="${esc(k)}" class="${k === C.cat ? 'sel' : ''}">${esc(k)}</button>`).join('')}</div>
        <button role="switch" aria-checked="${C.descartar}" data-descartar="1" style="margin-left: auto; display: flex; align-items: center; gap: 10px; height: 34px; padding: 0 12px 0 6px; border: 0; border-radius: 10px; background: #FFF; box-shadow: 0 0 0 1px var(--linha2); font-size: 13px; font-weight: 600"><span class="chave ${C.descartar ? 'on' : ''}"></span>Aplicar descarte das ${c.descartes} piores</button></div>
      ${r.colunas.some((x) => x.erro) ? `<p class="erroMsg">Algumas corridas não abriram: ${esc(r.colunas.filter((x) => x.erro).map((x) => x.rotulo + ' (' + x.erro + ')').join(', '))}</p>` : ''}
      <section style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 18px">${linhas.slice(0, 3).map((l, k) => `<div class="kpi" style="flex-direction: row; align-items: center; gap: 14px"><span style="width: 50px; height: 50px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; ${med[k]}">${k + 1}</span><span class="col"><b style="font-size: 15px">${esc(l.nome)}</b><span class="peq">${k === 0 ? (linhas[1] ? 'líder · ' + (l.total - linhas[1].total) + ' pts de vantagem' : 'líder') : '−' + (linhas[0].total - l.total) + ' do líder'}</span></span><span class="col" style="margin-left: auto; align-items: flex-end"><span class="num" style="font-size: 24px; font-weight: 700">${l.total}</span><span class="peq">pontos</span></span></div>`).join('')}</section>
      <section class="cartao"><div class="cartaoCab"><h2>Classificação · ${esc(C.cat || '')}</h2><span class="sub">${linhas.length} pilotos · passe o mouse num ponto para ver a posição</span></div>
        <div class="rolagemX"><div style="min-width: ${360 + r.colunas.length * 60}px"><div class="cabTabela" style="grid-template-columns: ${grade}"><span>Pos</span><span>Piloto</span>${r.colunas.map((x) => `<span style="text-align: right" title="${esc(x.nome)}">${x.rotulo}</span>`).join('')}<span style="text-align: right">Total</span></div>
        ${linhas.map((l, k) => `<div class="linhaTabela" style="grid-template-columns: ${grade}"><b style="font-size: 15px; ${k < 3 ? 'color: #B07A00' : ''}">${k + 1}</b><b class="trunc">${esc(l.nome)}</b>${l.pts.map((p, i) => cel(p, l.desc.has(i))).join('')}<b class="num" style="text-align: right; font-size: 15px">${l.total}</b></div>`).join('')}</div></div>
        <div style="display: flex; flex-wrap: wrap; gap: 14px; padding: 12px 18px; font-size: 11.5px; color: var(--tinta2); background: var(--sup2)"><span><span class="chip verde">+</span> bônus pole ou melhor volta</span><span><span class="chip vermelho">−</span> punição em tempo ou desclassificado</span><span><span class="chip cinza" style="text-decoration: line-through">0</span> descartada</span></div></section>`;
  };
  const novaEtapa = async (c) => {
    const m = modal('<div class="esqueleto" style="height: 300px; margin: 20px"></div>'); m.style.maxWidth = '860px';
    let eventos = [];
    try { eventos = await office(`/painel/eventos?de=${somaDias(hojeIso(), -120)}`); } catch (e) { falhou(e); fecharCamada(); return; }
    const marcadas = { corrida: new Set(), pole: new Set() };
    const pintarM = () => {
      m.innerHTML = `<div class="modalTopo" style="${TIPOS.camp.topo}"><span class="col" style="gap: 3px"><span style="font-size: 11.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; opacity: .8">${esc(c.nome)}</span><span style="font-size: 22px; font-weight: 700">Nova etapa</span><span style="font-size: 13px; opacity: .85">Marque as corridas (e as tomadas de tempo, para o bônus de pole) na ordem em que aconteceram.</span></span><button class="fechar hov" style="position: static; margin-left: auto" data-acao="fechar">${svg(IC.fechar, 15, '#1D1D1F', 2.4)}</button></div>
        <div style="display: flex; flex-wrap: wrap; gap: 12px; padding: 16px 18px 0"><label class="campo" style="flex: 1 1 220px"><span>Nome da etapa</span><input class="entrada" id="nomeEtapa" value="${c.etapas.length + 1}ª etapa"></label><label class="campo" style="flex: 1 1 160px"><span>Data</span><input class="entrada" id="dataEtapa" type="date" value="${hojeIso()}"></label></div>
        <div style="max-height: 420px; overflow-y: auto; padding: 12px 18px 16px; display: flex; flex-direction: column; gap: 10px">${eventos.map((e) => `<div class="secao"><span class="titulo">${esc(e.nome)}<span class="peq" style="margin-left: auto; font-weight: 500">${esc((e.data || '').split('-').reverse().join('/'))}</span></span>${e.sessoes.filter((s) => s.tipo === 'corrida' || s.tipo === 'classificacao').map((s) => { const tp = s.tipo === 'corrida' ? 'corrida' : 'pole'; const on = marcadas[tp].has(s.id); return `<button class="hov" data-marcar="${esc(s.id)}" data-tp="${tp}" style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 0; border-radius: 10px; text-align: left; ${on ? 'background: rgba(11,122,83,.08); box-shadow: inset 0 0 0 1.5px var(--verde)' : 'background: var(--fundo)'}"><span style="width: 18px; height: 18px; border-radius: 5px; display: flex; align-items: center; justify-content: center; ${on ? 'background: var(--verde)' : 'background: #FFF; box-shadow: inset 0 0 0 1.5px #C7C7CC'}">${on ? svg(IC.ok, 11, '#FFF', 3.4) : ''}</span><span class="col" style="flex-grow: 1"><b>${esc(s.nome)}</b><span class="peq">${s.tipo === 'corrida' ? 'Corrida' : 'Tomada de tempo (pole)'} · ${s.pilotos} pilotos · ${esc(s.estado)}</span></span>${on ? `<span class="chip verde">${tp === 'corrida' ? 'C' : 'P'}${[...marcadas[tp]].indexOf(s.id) + 1}</span>` : ''}</button>`; }).join('')}</div>`).join('') || '<div class="vazio">Nenhum evento com corridas nos últimos 120 dias.</div>'}</div>
        <div class="modalRodape"><span class="peq">${marcadas.corrida.size} corrida(s) · ${marcadas.pole.size} pole(s)</span><button class="btn sec" style="margin-left: auto" data-acao="fechar">Cancelar</button><button class="btn prim" id="salvarEtapa" ${marcadas.corrida.size ? '' : 'disabled'}>Salvar etapa</button></div>`;
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
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(c.nome)} · classificação</title><style>body{font-family:system-ui,sans-serif;margin:24px;color:#1D1D1F}h1{margin:0 0 4px}p{color:#6E6E73;margin:0 0 18px}h2{margin:18px 0 8px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ddd;padding:4px 6px;text-align:center}td.n{text-align:left}td.d{color:#999;text-decoration:line-through}.q{page-break-after:always}</style></head><body><h1>${esc(c.nome)}</h1><p>${esc(c.temporada || '')} · pontos ${esc(c.pontos)}… · posição ${c.regra === 'geral' ? 'geral' : 'na categoria'} · * = bônus ou punição · gerado em ${new Date().toLocaleString('pt-BR', { timeZone: TZ })}</p>${blocos}<script>setTimeout(()=>print(),300)<\/script></body></html>`);
    w.document.close();
  };
  tela.addEventListener('click', async (ev) => {
    const t = (s) => ev.target.closest(s);
    let x;
    if (t('[data-novo-camp]')) { const nome = prompt('Nome do campeonato (ex.: Ultras do Kart):'); if (!nome) return; const temp = prompt('Temporada (ex.: 2026 · 2º semestre):', '2026') || ''; try { camps = await office('/campeonatos', { method: 'POST', body: { nome, temporada: temp, regra: 'categoria' } }); C.sel = camps.find((c) => c.nome === nome.trim())?.id ?? camps[0].id; toast('Campeonato criado'); pintar(); } catch (er) { falhou(er); } return; }
    if ((x = t('[data-camp]'))) { C.sel = +x.dataset.camp; C.cat = null; pintar(); return; }
    if ((x = t('[data-cat]'))) { C.cat = x.dataset.cat; pintar(); return; }
    if (t('[data-descartar]')) { C.descartar = !C.descartar; pintar(); return; }
    if (t('[data-pdf]')) { imprimir(); return; }
    const c = camps.find((y) => y.id === C.sel);
    if (t('[data-nova-etapa]')) { novaEtapa(c); return; }
    if ((x = t('[data-regra]'))) { try { camps = await office(`/campeonatos/${c.id}`, { method: 'PUT', body: { regra: x.dataset.regra } }); toast('Regra salva · classificação recalculada'); pintar(); } catch (er) { falhou(er); } return; }
    if ((x = t('[data-oficial]'))) { try { camps = await office(`/campeonatos/${c.id}/etapas/${x.dataset.oficial}`, { method: 'PUT', body: { publicada: x.dataset.v === '1' } }); pintar(); } catch (er) { falhou(er); } return; }
    if ((x = t('[data-tirar-etapa]'))) { if (!confirm('Tirar esta etapa do campeonato? Os resultados da cronometragem não são apagados.')) return; try { camps = await office(`/campeonatos/${c.id}/etapas/${x.dataset.tirarEtapa}`, { method: 'DELETE' }); pintar(); } catch (er) { falhou(er); } }
  });
  tela.addEventListener('change', async (ev) => {
    const f = ev.target.dataset.campoCamp; if (!f) return;
    const c = camps.find((y) => y.id === C.sel);
    try { camps = await office(`/campeonatos/${c.id}`, { method: 'PUT', body: { [f]: ev.target.value } }); toast('Regra salva · classificação recalculada'); pintar(); } catch (er) { falhou(er); }
  });
  await carregar();
};

// ------------------------------------------------------------------ Sorteio e karts
TELAS.sorteio = async (tela) => {
  const F = S.frota || (S.frota = { filtro: 0 });
  tela.innerHTML = `${cabecalho('Operação · tablet do sorteio, cronometragem e oficina', 'Sorteio e karts')}<main class="principal"><div class="linhaFlex"><section class="cartao" id="sorteio" style="flex: 999 1 560px; min-width: 0"></section><section class="cartao leve" id="oficinaResumo" style="flex: 1 1 320px; min-width: 0"></section></div><section class="cartao leve" id="frota"></section></main>`;
  const carregar = async () => {
    const [so, fr] = await Promise.all([office('/painel/sorteio').catch((e) => ({ erro: e.message })), office('/painel/karts').catch((e) => ({ erro: e.message, karts: [], oficina: [] }))]);
    const s = so.sorteio;
    $('#sorteio').innerHTML = s ? `<div class="cartaoCab"><span class="col"><h2>${esc(s.bateria)}</h2><span class="sub">${esc(s.tipo === 'corrida' ? 'Corrida' : s.tipo === 'classificacao' ? 'Tomada de tempo' : s.tipo)} · ${s.pilotos.length} pilotos · sorteado ${new Date(s.em).toLocaleString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${s.tipoKart ? ' · kart ' + esc(s.tipoKart) : ''}</span></span><span class="chip ${s.state === 'encerrada' ? 'cinza' : 'verde'} dir">${esc(s.state)}</span></div>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; padding: 4px 18px 18px">${s.pilotos.map((p) => `<div style="display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 14px; background: var(--sup2); box-shadow: inset 0 0 0 1px var(--linha)"><span style="width: 48px; height: 48px; border-radius: 12px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: linear-gradient(180deg, #2C2C2E, #0B0B0C); color: #FFF; font-family: var(--mono); font-size: 18px; font-weight: 600">${esc(p.kart || '—')}</span><span class="col"><b class="trunc">${esc(p.nome)}</b>${p.peso ? `<span class="peq">${esc(p.peso)} kg</span>` : ''}</span></div>`).join('')}</div>` : `<div class="vazio"><b>Nenhum sorteio ainda</b><span>${esc(so.erro || 'O tablet ainda não sorteou nenhuma bateria.')}</span></div>`;
    const ofi = new Map((fr.oficina || []).map((o) => [String(+o.kart), o]));
    const estado = (k) => { const o = ofi.get(String(+k)); return o && o.vencidos > 0 ? 'oficina' : 'ok'; };
    const cont = { ok: 0, oficina: 0 }; fr.karts.forEach((k) => cont[estado(k)]++);
    const vencidos = (fr.oficina || []).filter((o) => o.vencidos > 0).sort((a, b) => b.minutos - a.minutos);
    $('#oficinaResumo').innerHTML = `<div class="cartaoCab"><h2>Oficina</h2><span class="sub">manutenção vencida pelas horas de pista</span></div>${vencidos.slice(0, 8).map((o) => `<div style="display: flex; align-items: center; gap: 10px; padding: 8px 16px; border-top: 1px solid var(--linha)"><span class="kart">${esc(o.kart)}</span><span class="peq" style="flex-grow: 1">${o.vencidos} item(ns) vencido(s)</span><b class="num">${Math.round(o.minutos / 60)} h</b></div>`).join('') || '<p class="peq" style="padding: 0 16px 16px">Nenhuma manutenção vencida.</p>'}<p class="peq" style="margin: 0; padding: 12px 16px; background: var(--sup2); border-top: 1px solid var(--linha)">A oficina é marcada no programa da Recepção (Oficina › Registro de manutenções).</p>`;
    const filtros = [['Todos', null], ['Em dia', 'ok'], ['Manutenção vencida', 'oficina']];
    const vis = fr.karts.filter((k) => !filtros[F.filtro][1] || estado(k) === filtros[F.filtro][1]);
    $('#frota').innerHTML = `<div class="cartaoCab"><span class="col"><h2>Frota</h2><span class="sub">${fr.karts.length} karts com transponder cadastrado na cronometragem (os que podem entrar no sorteio)</span></span><div class="filtros dir">${filtros.map(([t, v], i) => `<button data-f="${i}" class="${i === F.filtro ? 'sel' : ''}">${t} <span>${v ? cont[v] : fr.karts.length}</span></button>`).join('')}</div></div>
      <div style="display: flex; height: 8px; margin: 0 18px 14px; border-radius: 4px; overflow: hidden; gap: 2px"><span style="flex: ${cont.ok} 1 0; background: #34C759"></span><span style="flex: ${cont.oficina} 1 0; background: #FF9F0A"></span></div>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 8px; padding: 0 18px 18px">${vis.map((k) => { const e = estado(k), o = ofi.get(String(+k)); return `<div style="display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: 13px; ${e === 'ok' ? 'background: #FFF; box-shadow: inset 0 0 0 1px var(--linha2)' : 'background: rgba(255,159,10,.08); box-shadow: inset 0 0 0 1px rgba(255,159,10,.35)'}"><span style="display: flex; align-items: center; justify-content: space-between"><span class="mono" style="font-size: 20px; font-weight: 600">${esc(k)}</span><span class="ponto" style="width: 9px; height: 9px; background: ${e === 'ok' ? '#34C759' : '#FF9F0A'}"></span></span><span class="peq" style="font-weight: 600; color: ${e === 'ok' ? 'var(--okTxt)' : 'var(--avisoTxt)'}">${e === 'ok' ? 'Em dia' : 'Manutenção vencida'}</span><span class="peq" style="font-size: 11px">${o ? Math.round(o.minutos / 60) + ' h de pista' : 'sem controle'}</span></div>`; }).join('')}</div>`;
  };
  tela.addEventListener('click', (e) => { const f = e.target.closest('[data-f]'); if (f) { F.filtro = +f.dataset.f; carregar(); } });
  await carregar();
  repetir(carregar, 30_000);
};

// ------------------------------------------------------------------ sinais dos PCs (Sistema e Autoatendimento)
function quandoMin(m) { return m == null ? '—' : m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} d`; }


const NOME_APP = { Recepcao: 'Recepção', Autoatendimento: 'Totem', Cronometragem: 'Cronometragem' };
const GRADE_PCS = '64px minmax(0, 1fr) minmax(0, 1.3fr) minmax(0, 1.5fr) 110px';

TELAS.sistema = async (tela) => {
  tela.innerHTML = `${cabecalho('Sistema · rede 192.168.20.x', 'PCs e sistema')}<main class="principal"><section class="kpis" id="servicos"></section><section class="cartao" id="pcs"><div class="esqueleto" style="height: 300px; margin: 16px"></div></section><section class="cartao leve" id="usuarios"></section></main>`;
  let perfis = [], usuarios = [];
  const carregar = async () => {
    await atualizarConexao();
    const r = S.saude;
    const s = await office('/painel/sinais');
    if (r) $('#servicos').innerHTML = [['Servidor da operação', 'SRVKART · KartodromoOps', r.ops], ['Cronometragem', 'ORBITS · decoder', r.crono]].map(([t, d, x]) => `<div class="kpi"><span class="rot"><span class="ponto" style="width: 8px; height: 8px; background: ${x.ok ? '#34C759' : '#FF453A'}"></span>${t}</span><span class="val" style="font-size: 22px">${x.ok ? x.ms + ' ms' : 'sem resposta'}</span><span class="peq">${d}</span></div>`).join('')
      + `<div class="kpi"><span class="rot">Versões publicadas</span><span class="col" style="gap: 3px; margin-top: 4px">${Object.entries(s.publicadas || {}).map(([a, v]) => `<span style="display: flex; justify-content: space-between; font-size: 13px"><span>${NOME_APP[a] || esc(a)}</span><b class="mono">${esc(v || '—')}</b></span>`).join('')}</span></div>`;
    const off = s.pcs.filter((p) => !p.online);
    selo('sistema', off.length ? String(off.length) : '', 'vermelho');
    const progs = (p) => p.apps.length ? p.apps.map((a) => `<span style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap"><b style="font-size: 12.5px">${NOME_APP[a.app] || esc(a.app)}</b><span class="mono" style="font-size: 12px">${esc(a.versao || '')}</span>${a.atualizando ? '<span class="chip laranja">atualizando</span>' : '<span class="chip verde">em dia</span>'}<span class="peq">${quandoMin(a.minutos)}</span></span>`).join('')
      : p.totem ? `<span class="peq">Totem em uso ${quandoMin(p.totem.minutos)}</span>` : `<span class="peq">${p.online ? 'nenhum programa pediu atualização desde ' + (s.desde < 60 ? `${s.desde} min` : `${Math.round(s.desde / 60)} h`) : '—'}</span>`;
    $('#pcs').innerHTML = `<div class="cartaoCab"><span class="col"><h2>Computadores</h2><span class="sub">rede testada pelo SRVKART agora · versão = a publicada, a não ser que o PC esteja baixando a nova</span></span><span class="chip ${off.length ? 'vermelho' : 'verde'} dir">${off.length ? off.length + ' sem resposta' : 'todos respondendo'}</span></div>
      <div class="rolagemX"><div style="min-width: 780px"><div class="cabTabela" style="grid-template-columns: ${GRADE_PCS}"><span>IP</span><span>Computador</span><span>Função</span><span>Programas · versão · último sinal</span><span>Rede</span></div>
      ${s.pcs.map((p) => `<div class="linhaTabela" style="grid-template-columns: ${GRADE_PCS}"><span class="mono">.${esc(p.ip.split('.').pop())}</span><b style="display: flex; align-items: center; gap: 8px"><span class="ponto" style="width: 8px; height: 8px; flex-shrink: 0; background: ${p.online ? '#34C759' : '#FF453A'}"></span>${esc(p.nome)}</b><span class="peq">${esc(p.papel)}</span><span class="col" style="gap: 3px">${progs(p)}</span><span><span class="chip ${p.online ? 'verde' : 'vermelho'}">${p.online ? (p.ms ? p.ms + ' ms' : 'servidor') : 'sem resposta'}</span></span></div>`).join('')}</div></div>
      <p class="peq" style="margin: 0; padding: 12px 18px; background: var(--sup2); border-top: 1px solid var(--linha); line-height: 1.5">A Cronometragem pede atualização a cada 3 minutos; Recepção e totem pedem ao abrir. Instalar versão nova e reiniciar programa continuam fora do painel web (só no kartódromo, depois das 21:40). Totens e telão desligados aparecem “sem resposta”.</p>`;
  };
  const pintarUsuarios = () => {
    const box = $('#usuarios');
    if (!S.usuario?.admin) { box.innerHTML = `<div class="cartaoCab"><h2>Usuários</h2></div><p class="peq" style="padding: 0 16px 16px">Só o administrador vê e muda os usuários.</p>`; return; }
    box.innerHTML = `<div class="cartaoCab"><span class="col"><h2>Quem entra no sistema</h2><span class="sub">os mesmos usuários do programa Recepção e deste painel · o perfil diz o que cada um pode fazer</span></span><button class="btn prim dir" data-novo-usuario="1">${svg(IC.mais, 14, '#FFF', 2.6)}Novo usuário</button></div>
      <div class="rolagemX"><div style="min-width: 640px"><div class="cabTabela" style="grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) 190px 130px 90px"><span>Nome</span><span>Login</span><span>Perfil</span><span>Último acesso</span><span>Ativo</span></div>
      ${usuarios.map((u) => `<div class="linhaTabela" style="grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) 190px 130px 90px; ${u.ativo ? '' : 'opacity: .55'}"><b class="trunc">${esc(u.nome)}${u.admin ? ' <span class="chip azul">admin</span>' : ''}</b><span class="mono trunc" style="font-size: 12.5px">${esc(u.login)}</span><select class="entrada" style="height: 32px" data-perfil-usuario="${u.id}">${perfis.map((p) => `<option value="${p.id}" ${p.id === u.perfilId ? 'selected' : ''}>${esc(p.descricao)}</option>`).join('')}${u.perfilId ? '' : '<option selected value="">—</option>'}</select><span class="peq">${u.ultimoAcesso ? esc(u.ultimoAcesso.slice(8, 10) + '/' + u.ultimoAcesso.slice(5, 7) + ' ' + u.ultimoAcesso.slice(11, 16)) : 'nunca'}</span><button role="switch" aria-checked="${!!u.ativo}" data-ativo-usuario="${u.id}" style="border: 0; background: transparent; padding: 0"><span class="chave ${u.ativo ? 'on' : ''}"></span></button></div>`).join('')}</div></div>`;
  };
  const carregarUsuarios = async () => {
    if (!S.usuario?.admin) return pintarUsuarios();
    try { [usuarios, perfis] = await Promise.all([office('/cad/usuarios'), office('/cad/perfis')]); pintarUsuarios(); }
    catch (e) { $('#usuarios').innerHTML = `<div class="cartaoCab"><h2>Usuários</h2></div><p class="erroMsg" style="padding: 0 16px 16px">${esc(e.message)}</p>`; }
  };
  const novoUsuario = () => {
    const m = modal(`<div class="modalTopo" style="background: linear-gradient(160deg, #E5E5EA, #F5F5F7)"><span class="col" style="gap: 3px"><span style="font-size: 22px; font-weight: 700">Novo usuário</span><span class="peq">Entra no programa Recepção e neste painel com o login e a senha abaixo.</span></span><button class="fechar hov" style="position: static; margin-left: auto" data-acao="fechar">${svg(IC.fechar, 15, '#1D1D1F', 2.4)}</button></div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; padding: 16px 18px">
        <label class="campo"><span>Nome</span><input class="entrada" id="uNome" autocomplete="off"></label>
        <label class="campo"><span>Login (e-mail ou apelido)</span><input class="entrada" id="uLogin" autocomplete="off"></label>
        <label class="campo"><span>Perfil</span><select class="entrada" id="uPerfil">${perfis.map((p) => `<option value="${p.id}">${esc(p.descricao)}</option>`).join('')}</select></label>
        <label class="campo"><span>Senha inicial (mín. 6)</span><input class="entrada" id="uSenha" type="password" autocomplete="new-password"></label>
      </div><p class="erroMsg" id="uErro" style="padding: 0 18px"></p>
      <div class="modalRodape"><button class="btn sec" style="margin-left: auto" data-acao="fechar">Cancelar</button><button class="btn prim" id="uSalvar">Criar usuário</button></div>`);
    m.style.maxWidth = '620px';
    $('#uSalvar').onclick = async () => {
      try {
        await office('/cad/usuarios', { method: 'POST', body: { nome: $('#uNome').value, login: $('#uLogin').value, perfilId: Number($('#uPerfil').value) || null, senha: $('#uSenha').value, ativo: true, admin: false } });
        toast('Usuário criado'); fecharCamada(); carregarUsuarios();
      } catch (e) { $('#uErro').textContent = e.message; }
    };
  };
  tela.addEventListener('click', async (e) => {
    if (e.target.closest('[data-novo-usuario]')) return novoUsuario();
    const a = e.target.closest('[data-ativo-usuario]');
    if (a) {
      const u = usuarios.find((x) => x.id === +a.dataset.ativoUsuario);
      if (u.id === S.usuario?.id && u.ativo) return toast('Você não pode desativar o próprio usuário', true);
      try { await office(`/cad/usuarios/${u.id}`, { method: 'PUT', body: { ativo: !u.ativo } }); u.ativo = !u.ativo; pintarUsuarios(); toast(u.ativo ? 'Usuário ativado' : 'Usuário desativado: não entra mais'); } catch (er) { falhou(er); }
    }
  });
  tela.addEventListener('change', async (e) => {
    const s = e.target.closest('[data-perfil-usuario]'); if (!s) return;
    try { await office(`/cad/usuarios/${s.dataset.perfilUsuario}`, { method: 'PUT', body: { perfilId: Number(s.value) || null } }); toast('Perfil trocado'); carregarUsuarios(); } catch (er) { falhou(er); }
  });
  await Promise.all([carregar(), carregarUsuarios()]);
  repetir(carregar, 30_000);
};

const telaTotensBase = TELAS.totens;
const PASSOS_TOTEM = [['/api/totem/identificar', 'Digitou o CPF'], ['/api/totem/cadastro', 'Cadastro ou peso'], ['/api/totem/baterias', 'Viu as baterias'], ['/api/totem/inscrever', 'Se inscreveu']];
TELAS.totens = async (tela) => {
  await telaTotensBase(tela);
  const principal = tela.querySelector('.principal');
  const acoes = tela.querySelector('.cab .acoes');
  if (acoes) acoes.insertAdjacentHTML('beforeend', `<button class="btn branco" data-qr="1" >Imprimir QR do pré-cadastro</button>`);
  const caixa = document.createElement('section'); caixa.className = 'kpis';
  principal.insertBefore(caixa, principal.firstChild);
  const extra = document.createElement('div'); extra.className = 'linhaFlex';
  caixa.after(extra);
  const pintar = async () => {
    try {
      const s = await office('/painel/sinais');
      const totens = s.pcs.filter((p) => ['192.168.20.161', '192.168.20.69', '192.168.20.239', '192.168.20.12'].includes(p.ip));
      caixa.innerHTML = totens.map((p) => `<div class="kpi" style="gap: 8px"><span style="height: 92px; border-radius: 12px; display: flex; flex-direction: column; justify-content: space-between; padding: 12px; ${p.totem && p.totem.minutos < 30 ? 'background: linear-gradient(135deg, #1E6FE8, #0B3E8F); color: #FFF' : p.online ? 'background: linear-gradient(135deg, #3A3A3C, #1C1C1E); color: #FFF' : 'background: #E5E5EA; color: #6E6E73'}"><span style="display: flex; justify-content: space-between; font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; opacity: .8"><span>Tela agora</span><span>${p.online ? 'ligado' : 'sem resposta'}</span></span><b style="font-size: 16px">${esc(p.totem ? p.totem.tela : p.online ? 'Sem uso desde que o servidor reiniciou' : 'Desligado ou fora da rede')}</b></span><span class="col"><b>${esc(p.nome)}</b><span class="peq">${esc(p.ip)} · ${p.totem ? 'último uso ' + quandoMin(p.totem.minutos) : 'sem uso registrado'}</span></span></div>`).join('');
      const f = s.funil || {};
      const maxF = Math.max(1, ...PASSOS_TOTEM.map(([k]) => f[k] || 0));
      extra.innerHTML = `<section class="cartao leve" style="flex: 1 1 360px; min-width: 0"><div class="cartaoCab"><span class="col"><h2>Funil dos totens hoje</h2><span class="sub">onde as pessoas desistem · conta cada passo concluído</span></span></div>
          <div class="col" style="gap: 10px; padding: 0 18px 18px">${PASSOS_TOTEM.map(([k, t], i) => { const v = f[k] || 0, ant = i ? (f[PASSOS_TOTEM[i - 1][0]] || 0) : 0; return `<div class="col" style="gap: 4px"><span style="display: flex; justify-content: space-between; font-size: 13px"><b>${t}</b><span><b class="num">${v}</b>${i && ant > v ? ` <span class="peq" style="color: var(--avisoTxt)">−${ant - v}</span>` : ''}</span></span><span style="height: 10px; border-radius: 5px; background: var(--cinzaFundo); overflow: hidden"><span style="display: block; height: 100%; width: ${Math.round((v / maxF) * 100)}%; background: ${G('#6CB8FF', '#1E6FE8')}"></span></span></div>`; }).join('')}
          ${PASSOS_TOTEM.every(([k]) => !f[k]) ? '<span class="peq">Ninguém usou os totens hoje ainda (ou o servidor reiniciou).</span>' : ''}</div></section>
        <section class="cartao leve" style="flex: 1 1 360px; min-width: 0"><div class="cartaoCab"><span class="col"><h2>Pré-cadastros pelo QR code</h2><span class="sub">chegam ao SRVKART a cada 30 s · o totem acha pelo CPF</span></span></div>
          ${(s.preCadastros || []).slice(0, 8).map((p) => `<div style="display: flex; align-items: center; gap: 10px; padding: 8px 16px; border-top: 1px solid var(--linha)"><b class="trunc" style="flex-grow: 1">${esc(p.nome)}</b>${p.grupo ? '<span class="chip azul">link do grupo</span>' : ''}<span class="chip ${p.novo ? 'verde' : 'cinza'}">${p.novo ? 'novo' : 'atualizou'}</span><span class="peq">${quandoMin(Math.round((Date.now() - p.em) / 60000))}</span></div>`).join('') || '<p class="peq" style="padding: 0 16px 16px">Nenhum pré-cadastro chegou desde que o servidor reiniciou.</p>'}</section>
        <section class="cartao leve" style="flex: 1 1 300px; min-width: 0"><div class="cartaoCab"><span class="col"><h2>O que o totem exige</h2><span class="sub">vale no totem e no pré-cadastro</span></span></div>
          <ul style="margin: 0; padding: 0 18px 16px 34px; line-height: 1.8; font-size: 13px"><li>Cliente novo: CPF, nome, nascimento, celular, e-mail, peso e endereço</li><li>Cliente que já existe: começa confirmando o peso</li><li>Menor de idade: entra pelo responsável, com o peso dele</li></ul>
          <p class="peq" style="margin: 0; padding: 12px 16px; background: var(--sup2); border-top: 1px solid var(--linha)">O totem usa o teclado USB. Nunca abre teclado na tela.</p></section>`;
    } catch (e) { caixa.innerHTML = `<p class="erroMsg">${esc(e.message)}</p>`; }
  };
  tela.addEventListener('click', (e) => {
    if (!e.target.closest('[data-qr]')) return;
    const w = window.open('', '_blank'); if (!w) return toast('Libere as janelas novas para imprimir', true);
    const qr = 'https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=10&data=' + encodeURIComponent(LINK_CADASTRO);
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>QR do pré-cadastro</title><style>body{font-family:system-ui,sans-serif;text-align:center;margin:40px;color:#1D1D1F}h1{font-size:40px;margin:0 0 8px}p{font-size:20px;color:#3A3A3C;margin:0 0 24px}img{width:420px;height:420px}b{font-size:22px}</style></head><body><h1>Faça seu cadastro antes de chegar</h1><p>Aponte a câmera do celular · no totem é só digitar o CPF</p><img src="${qr}" alt="QR code" onload="setTimeout(()=>print(),300)"><br><b>${esc(LINK_CADASTRO.replace(/^https?:\/\//, ''))}</b><p style="margin-top:16px">Kartódromo de Betim</p></body></html>`);
    w.document.close();
  });
  await pintar();
  repetir(pintar, 30_000);
};

// ------------------------------------------------------------------ extras: lista do sorteio para imprimir e detalhe do piloto no campeonato
const telaSorteioBase = TELAS.sorteio;
TELAS.sorteio = async (tela) => {
  await telaSorteioBase(tela);
  const h = tela.querySelector('.cab .acoes'); if (h) h.insertAdjacentHTML('beforeend', '<button class="btn branco" data-imprimir-sorteio="1">Imprimir lista</button>');
  tela.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-imprimir-sorteio]')) return;
    const { sorteio: s } = await office('/painel/sorteio');
    if (!s) return toast('Nenhum sorteio para imprimir', true);
    const w = window.open('', '_blank'); if (!w) return toast('Libere as janelas novas para imprimir', true);
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Sorteio · ${esc(s.bateria)}</title><style>body{font-family:system-ui,sans-serif;margin:28px;color:#1D1D1F}h1{margin:0}p{color:#6E6E73;margin:4px 0 18px}table{border-collapse:collapse;width:100%;font-size:18px}td{border-bottom:1px solid #ddd;padding:8px 6px}td.k{font-weight:700;font-size:24px;width:80px;text-align:center}</style></head><body><h1>${esc(s.bateria)}</h1><p>${s.pilotos.length} pilotos · sorteado ${new Date(s.em).toLocaleString('pt-BR', { timeZone: TZ })}${s.tipoKart ? ' · ' + esc(s.tipoKart) : ''}</p><table>${s.pilotos.map((p) => `<tr><td>${esc(p.nome)}</td><td class="k">${esc(p.kart)}</td></tr>`).join('')}</table><script>setTimeout(()=>print(),300)<\/script></body></html>`);
    w.document.close();
  });
};

document.addEventListener('click', (e) => {
  const l = e.target.closest('#classif .linhaTabela'); if (!l || !S.camp?.ultimo) return;
  const nome = l.querySelector('b.trunc')?.textContent;
  const { r } = S.camp.ultimo;
  const p = r.linhas.find((x) => x.nome === nome && x.categoria === S.camp.cat); if (!p) return;
  const marca = { mv: 'melhor volta', pole: 'pole', pen: 'punição', dc: 'desclassificado' };
  modal(`<div class="modalTopo" style="${TIPOS.camp.topo}"><span class="col" style="gap: 3px"><span style="font-size: 11.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; opacity: .8">${esc(p.categoria)}</span><span style="font-size: 22px; font-weight: 700">${esc(p.nome)}</span><span style="font-size: 13px; opacity: .85">${p.total} pontos · ${p.corridas} corrida(s)</span></span><button class="fechar hov" style="position: static; margin-left: auto" data-acao="fechar">${svg(IC.fechar, 15, '#1D1D1F', 2.4)}</button></div>
    <div style="padding: 8px 0 12px">${r.colunas.map((c, i) => { const q = p.pts[i]; return `<div style="display: flex; align-items: center; gap: 12px; padding: 8px 18px; border-bottom: 1px solid var(--linha)"><span class="mono" style="width: 56px">${c.rotulo}</span><span class="trunc peq" style="flex-grow: 1">${esc(c.nome)}</span>${q ? `<span>${q.pos}º</span>${q.marcas.map((m) => `<span class="chip ${m === 'pen' || m === 'dc' ? 'vermelho' : 'verde'}">${marca[m]}</span>`).join('')}<b class="num" style="width: 36px; text-align: right; ${p.desc.has(i) ? 'text-decoration: line-through; color: #8E8E93' : ''}">${q.v}</b>` : '<span class="peq">não correu</span>'}</div>`; }).join('')}</div>`).style.maxWidth = '560px';
});
