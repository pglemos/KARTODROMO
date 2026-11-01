'use strict';
/* Endurance (100 Milhas): evento, equipes e pulseiras, pesagem, box (trocas, sorteio das fileiras, paradas),
   punições, estratégia ao vivo e estatísticas. Depende de app.js e endurance-vis.js (carregados antes). */

NAV.find((g) => g.t === 'Competições').itens.push(['endurance', 'Endurance · 100 Milhas', 'M4 20l6-14 4 8 2-4 4 10M3 20h18', G('#FF8A3D', '#E8590C')]);

const ABAS_END = [['vivo', 'Ao vivo'], ['estrategia', 'Estratégia'], ['box', 'Box e sorteio'], ['pesagem', 'Pesagem'], ['equipes', 'Equipes e pulseiras'], ['punicoes', 'Punições'], ['estatisticas', 'Estatísticas'], ['evento', 'Evento e regras']];
const PRESETS_PUNICAO = [
  ['segundos', 15, 'Time penalty 15 s (12.5)'], ['voltas', 1, 'Perda de 1 volta (12.5)'], ['voltas', 2, 'Perda de 2 voltas · pane seca (12.6)'],
  ['segundos', 30, '+30 s · empurrar com kart fora do peso (7.6)'], ['advertencia', 0, 'Advertência de pista (3 = DQ)'], ['dq', 0, 'Desclassificação (DQ)'],
  ['segundos', 0, 'Outra · segundos'], ['voltas', 0, 'Outra · voltas'],
];

TELAS.endurance = async (tela) => {
  const E = S.end || (S.end = { ev: Number(guarda.ler('kib-end-ev')) || null, aba: guarda.ler('kib-end-aba') || 'vivo', est: 'paradas' });
  const eventos = await office('/endurance/eventos');
  if (!eventos.find((x) => x.id === E.ev)) E.ev = eventos.find((x) => x.ativo)?.id ?? eventos[0]?.id ?? null;
  const acoes = `${eventos.length > 1 ? `<select class="entrada" id="evSel" style="height: 36px; width: auto">${eventos.map((x) => `<option value="${x.id}" ${x.id === E.ev ? 'selected' : ''}>${esc(x.nome)}${x.data ? ' · ' + x.data.split('-').reverse().join('/') : ''}</option>`).join('')}</select>` : ''}
    <button class="btn sec" data-ev-novo="1">${svg(IC.mais, 14, 'currentColor', 2.6)}Novo evento</button>`;
  const atual = eventos.find((x) => x.id === E.ev);
  tela.innerHTML = `${cabecalho('Competições · endurance por equipes', atual ? esc(atual.nome) : 'Endurance', acoes)}<main class="principal">
    ${atual ? `<nav class="ev-abas" aria-label="Partes do evento">${ABAS_END.map(([id, t]) => `<button data-aba="${id}" class="${E.aba === id ? 'sel' : ''}">${t}</button>`).join('')}</nav><div id="evCorpo"><div class="esqueleto" style="height: 360px"></div></div>`
      : `<section class="cartao"><div class="vazio"><b>Nenhum evento de endurance</b><span>Crie o evento (ex.: 100 Milhas Light de Betim · 25/10), cadastre as equipes e ligue a bateria da agenda e a corrida da cronometragem.</span><button class="btn prim" style="margin-top: 12px" data-ev-novo="1">Criar evento</button></div></section>`}
  </main>`;
  tela.addEventListener('change', (e) => { if (e.target.id === 'evSel') { E.ev = Number(e.target.value); guarda.gravar('kib-end-ev', E.ev); abrirTela('endurance'); } });
  tela.addEventListener('click', (e) => {
    const ab = e.target.closest('[data-aba]');
    if (ab) { E.aba = ab.dataset.aba; guarda.gravar('kib-end-aba', E.aba); tela.querySelectorAll('[data-aba]').forEach((b) => b.classList.toggle('sel', b === ab)); abrirAba(); }
    if (e.target.closest('[data-ev-novo]')) novoEvento();
  });
  if (!atual) return;
  guarda.gravar('kib-end-ev', E.ev);

  // dados do evento (equipes, pilotos, filas, trocas…) e a análise ao vivo ficam em cache para as abas
  const D = { ev: null, an: null };
  const base = `/endurance/eventos/${E.ev}`;
  const carregarEvento = async () => { D.ev = await office(base); return D.ev; };
  const carregarAnalise = async () => { D.an = await office(base + '/analise'); return D.an; };
  const corpo = () => $('#evCorpo');
  const eqDe = (id) => D.ev.equipes.find((q) => q.id === id);

  function abrirAba() {
    limparTimers();
    // elemento novo a cada aba: os eventos da aba anterior não se acumulam
    const velho = corpo(); const novo = velho.cloneNode(false); velho.replaceWith(novo);
    corpo().innerHTML = '<div class="esqueleto" style="height: 360px"></div>';
    const f = { vivo: abaVivo, estrategia: abaEstrategia, box: abaBox, pesagem: abaPesagem, equipes: abaEquipes, punicoes: abaPunicoes, estatisticas: abaEstatisticas, evento: abaEvento }[E.aba] || abaVivo;
    Promise.resolve(f()).catch((err) => { corpo().innerHTML = `<section class="cartao"><div class="vazio"><b>Não deu para carregar</b><span>${esc(err.message)}</span></div></section>`; });
  }
  const avisoCrono = (a) => (a.erroCrono ? `<section class="cartao leve" style="padding: 12px 16px; background: #FFF4E5">${esc(a.erroCrono)}</section>` : !D.ev?.evento.sessaoCrono && !a.analise.sessao ? `<section class="cartao leve" style="padding: 12px 16px; background: #FFF4E5">A corrida da cronometragem ainda não foi ligada a este evento. Vá em <b>Evento e regras</b> › Cronometragem.</section>` : '');

  // ---------------------------------------------------------------- Ao vivo
  async function abaVivo() {
    const pintar = async () => {
      const a = await carregarAnalise();
      if (E.aba !== 'vivo') return;
      const alertas = a.analise.equipes.flatMap((e) => e.alertas.filter((x) => x.nivel === 'grave').map((x) => `#${e.numero} ${e.nome}: ${x.texto}`));
      corpo().innerHTML = `<div class="col" style="gap: 14px">${avisoCrono(a)}${EV.cabecalhoProva(a.analise, a.regras)}
        ${alertas.length ? `<section class="cartao leve" style="padding: 12px 16px; background: #FFF1F0"><b style="color: var(--erroTxt)">Atenção da direção de prova</b><ul style="margin: 6px 0 0; padding-left: 18px; line-height: 1.6">${alertas.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>` : ''}
        <section class="cartao"><div class="cartaoCab"><h2>Classificação</h2><span class="sub">oficial com punições · atualiza a cada 3 s</span></div>${EV.classificacao(a.analise, a.regras)}</section></div>`;
    };
    await pintar();
    repetir(pintar, 3000);
  }

  // ---------------------------------------------------------------- Estratégia
  async function abaEstrategia() {
    const chave = `kib-end-conc-${E.ev}`;
    const escolhidos = new Set(JSON.parse(guarda.ler(chave) || '[]'));
    let minha = guarda.ler(`kib-end-minha-${E.ev}`) || '';
    let abertoSel = false;
    const pintar = async () => {
      const a = await carregarAnalise();
      if (E.aba !== 'estrategia') return;
      const an = a.analise;
      corpo().innerHTML = `<div class="col" style="gap: 14px">${avisoCrono(a)}${EV.cabecalhoProva(an, a.regras)}
        <section class="cartao"><div class="cartaoCab"><h2>Ordenação pela média das últimas ${a.regras.mediaVoltas} voltas</h2>
          <span class="dir" style="display: flex; gap: 8px; align-items: center"><label class="sub">Destacar equipe <select class="entrada" id="evMinha" style="height: 32px; width: auto">${['<option value="">—</option>', ...an.equipes.map((e) => `<option value="${esc(e.numero)}" ${e.numero === minha ? 'selected' : ''}>#${esc(e.numero)} ${esc(e.nome)}</option>`)].join('')}</select></label>
          <button class="btn sec peq" id="evSelConc">${abertoSel ? 'Fechar' : '(+) Selecione seus concorrentes'}</button></span></div>
          <div class="ev-corpo">${abertoSel ? EV.seletorConcorrentes(an, escolhidos) : ''}
          <p class="ev-nota">Melhor volta da corrida: <b>${an.melhorVolta ? EV.tempo(an.melhorVolta.ms) + ' · kart #' + esc(an.melhorVolta.numero) + ' na volta ' + an.melhorVolta.volta : '—'}</b> · Média mais rápida: <b>${an.melhorMedia ? EV.tempo(an.melhorMedia.ms) + ' · #' + esc(an.melhorMedia.numero) : '—'}</b></p>
          ${EV.porMedia(an, a.regras, escolhidos, minha)}</div></section>
        <div class="ev-grade2">
          <section class="cartao"><div class="cartaoCab"><h2>Ultrapassagem futura</h2><span class="sub">próximas 10 voltas</span></div><div class="ev-corpo">${EV.ultrapassagem(an, escolhidos, minha)}</div></section>
          <section class="cartao"><div class="cartaoCab"><h2>Projeção final</h2><span class="sub">voltas no fim, já descontando as paradas que faltam</span></div><div class="ev-corpo">${EV.projecao(an, minha)}</div></section>
        </div>
        <section class="cartao"><div class="cartaoCab"><h2>Radar do box</h2></div><div class="ev-corpo">${EV.radar(an, a.regras, minha)}</div></section></div>`;
    };
    corpo().addEventListener('change', (e) => {
      if (e.target.dataset.concorrente) { e.target.checked ? escolhidos.add(e.target.dataset.concorrente) : escolhidos.delete(e.target.dataset.concorrente); guarda.gravar(chave, JSON.stringify([...escolhidos])); pintar(); }
      if (e.target.id === 'evMinha') { minha = e.target.value; guarda.gravar(`kib-end-minha-${E.ev}`, minha); pintar(); }
    });
    corpo().addEventListener('click', (e) => { if (e.target.id === 'evSelConc') { abertoSel = !abertoSel; pintar(); } });
    await pintar();
    repetir(() => { if (!abertoSel) pintar(); }, 5000);
  }

  // ---------------------------------------------------------------- Box: trocas, fileiras e paradas
  async function abaBox() {
    await Promise.all([carregarEvento(), carregarAnalise()]);
    const B = { piloto: null, resultado: null, tipo: 'parada', devolver: '', equipeId: null };
    const filasPor = () => {
      const f = {}; for (let i = 1; i <= D.ev.evento.regras.fileiras; i++) f[i] = [];
      for (const k of D.ev.filas) if (k.situacao === 'fila' && k.fileira) (f[k.fileira] = f[k.fileira] || []).push(k);
      return f;
    };
    const pintar = () => {
      const f = filasPor();
      const naPista = D.ev.filas.filter((k) => k.situacao === 'pista');
      const fora = D.ev.filas.filter((k) => k.situacao === 'fora');
      const p = B.piloto;
      const r = B.resultado;
      corpo().innerHTML = `<div class="ev-grade2">
        <section class="cartao"><div class="cartaoCab"><h2>Troca no box</h2><span class="sub">o piloto que vai entrar fala o número da pulseira</span></div><div class="ev-corpo col" style="gap: 12px">
          <input class="ev-numGrande" id="bxPulseira" inputmode="numeric" placeholder="Pulseira" aria-label="Número da pulseira" value="${p ? p.piloto.pulseira : ''}" autocomplete="off">
          ${p?.equipes?.length > 1 ? `<label class="campo"><span>Inscrição em que o piloto vai correr agora</span><select class="entrada" id="bxEquipe"><option value="">Selecione a inscrição</option>${p.equipes.map(q=>`<option value="${q.id}" ${B.equipeId===q.id?'selected':''}>${esc(q.nome)}</option>`).join('')}</select></label>` : ''}
          ${p ? `<div class="ev-resultado neutro"><span>${esc(p.equipe.nome)} · placa #${esc(p.equipe.numero)}</span><b>${esc(p.piloto.nome)}</b><span class="sub">Kart atual da equipe: <b>${esc(naPista.find((k) => k.equipeId === p.equipe.id)?.kart || '—')}</b> · peso ${p.piloto.pesoKg ?? '—'} kg · lastro ${p.piloto.lastroKg ?? '—'} kg</span></div>
            <div class="seg" role="group" aria-label="Tipo da troca">${[['parada', 'Parada'], ['quebra', 'Quebra do kart'], ['mecanica', 'Troca mecânica']].map(([v, t]) => `<button data-tipo="${v}" class="${B.tipo === v ? 'sel' : ''}">${t}</button>`).join('')}</div>
            <label class="campo"><span>O kart que a equipe deixou vai para</span><select class="entrada" id="bxDevolver"><option value="">a fileira mais curta</option>${Object.keys(f).map((n) => `<option value="${n}" ${B.devolver === n ? 'selected' : ''}>fileira ${n}</option>`).join('')}<option value="fora" ${B.devolver === 'fora' ? 'selected' : ''}>fora do sorteio (oficina)</option></select></label>
            <span class="sub" style="text-align: center">Bolinha sorteada:</span>
            <div class="ev-bolas">${Object.keys(f).map((n) => `<button data-bola="${n}" ${f[n].length ? '' : 'disabled'} aria-label="Fileira ${n}">${n}</button>`).join('')}</div>
            <button class="btn sec" data-bola="sistema">Sortear pelo sistema</button>` : '<p class="sub" style="text-align: center">Digite o número e aperte Enter.</p>'}
          ${r ? `<div class="ev-resultado ok"><span>${esc(r.equipe?.nome || '')} · ${esc(r.piloto?.nome || '')}</span><span class="ev-kartGrande">${esc(r.kart)}</span><b style="font-size: 20px">${r.fileira ? 'primeiro da fileira ' + r.fileira : 'kart escolhido'}</b>${r.devolvido ? `<span>Kart ${esc(r.devolvido.kart)} → ${r.devolvido.fileira ? 'fim da fileira ' + r.devolvido.fileira : 'fora do sorteio'}</span>` : ''}<button class="btn perigo peq" data-desfazer="${r.id}" style="align-self: center">Desfazer esta troca</button></div>` : ''}
        </div></section>
        <section class="cartao"><div class="cartaoCab"><h2>Fileiras do box</h2><span class="dir" style="display: flex; gap: 6px"><button class="btn sec peq" data-montar="1">Montar fileiras</button><button class="btn sec peq" data-largada="1">Sorteio da largada</button></span></div><div class="ev-corpo col" style="gap: 12px">
          <div class="ev-filas">${Object.entries(f).map(([n, ks]) => `<div class="ev-fila"><h4>Fileira ${n}</h4>${ks.map((k, i) => `<div class="ev-kartFila ${i === 0 ? 'primeiro' : ''}"><span>${esc(k.kart)}</span><button data-kart-menu="${esc(k.kart)}" aria-label="Opções do kart ${esc(k.kart)}">⋯</button></div>`).join('') || '<span class="sub" style="text-align: center">vazia</span>'}</div>`).join('')}</div>
          <div><b style="font-size: 13px">Na pista (${naPista.length})</b><div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px">${naPista.map((k) => `<span class="chip azul">kart ${esc(k.kart)} · #${esc(eqDe(k.equipeId)?.numero || '?')}</span>`).join('') || '<span class="sub">nenhum</span>'}</div></div>
          ${fora.length ? `<div><b style="font-size: 13px">Fora do sorteio</b><div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px">${fora.map((k) => `<button class="chip vermelho" data-kart-menu="${esc(k.kart)}" style="border: 0">kart ${esc(k.kart)}${k.obs ? ' · ' + esc(k.obs) : ''}</button>`).join('')}</div></div>` : ''}
        </div></section>
      </div>
      <section class="cartao" style="margin-top: 18px"><div class="cartaoCab"><h2>Paradas pelo decoder</h2><span class="sub">${esc(D.an.analise.boxTexto)} · toque na equipe para corrigir uma parada ou ver as trocas</span></div>
        <div class="ev-rolar"><table class="ev-tab"><thead><tr><th>Nº</th><th class="ev-esq">Equipe</th><th>Kart</th><th class="ev-esq">Piloto</th><th>Paradas</th><th>Última parada</th><th>No stint</th><th></th></tr></thead><tbody>
        ${D.an.analise.equipes.slice().sort((x, y) => String(x.numero).localeCompare(String(y.numero), 'pt', { numeric: true })).map((e) => { const u = e.paradas[e.paradas.length - 1]; return `<tr><td class="mono"><b>#${esc(e.numero)}</b></td><td class="ev-esq">${esc(e.nome)}${e.noBox ? ' <span class="ev-box">BOX</span>' : ''}</td><td class="mono">${esc(e.kartAtual || '—')}</td><td class="ev-esq">${esc(e.pilotoAtual || '—')}</td>
          <td>${e.paradasValidas}/${e.paradasTotal}${e.paradasFaltando ? ` <small>faltam ${e.paradasFaltando}</small>` : ' ✓'}</td><td class="mono">${u ? EV.tempo(u.tempoMs) + ' <small>v' + u.volta + '</small>' : '—'}</td><td class="mono">${e.tempoNoStintMs != null ? EV.relogio(e.tempoNoStintMs) : '—'}</td><td><button class="btn sec peq" data-eq-box="${e.id}">Abrir</button></td></tr>`; }).join('')}
        </tbody></table></div></section>`;
      const inp = $('#bxPulseira'); if (inp && !p) inp.focus();
    };
    const buscar = async (n) => {
      if (!n) { B.piloto = null; pintar(); return; }
      try { B.piloto = await office(`${base}/pulseira/${encodeURIComponent(n)}`); B.equipeId=B.piloto.equipes?.length>1?null:B.piloto.equipe.id; B.resultado = null; pintar(); } catch (err) { B.piloto = null; falhou(err); pintar(); }
    };
    corpo().addEventListener('keydown', (e) => { if (e.target.id === 'bxPulseira' && e.key === 'Enter') buscar(e.target.value.trim()); });
    corpo().addEventListener('change', (e) => { if (e.target.id === 'bxDevolver') B.devolver = e.target.value; if(e.target.id==='bxEquipe'){ B.equipeId=Number(e.target.value)||null; B.piloto.equipe=B.piloto.equipes.find(q=>q.id===B.equipeId)||B.piloto.equipes[0]; pintar(); } });
    corpo().addEventListener('click', async (e) => {
      const t = e.target.closest('[data-tipo]'); if (t) { B.tipo = t.dataset.tipo; pintar(); return; }
      const bola = e.target.closest('[data-bola]');
      if (bola && B.piloto) {
        if(!B.equipeId){toast('Selecione a inscrição da equipe antes do sorteio.');return;}
        bola.disabled = true;
        try {
          B.resultado = await office(`${base}/trocas`, { method: 'POST', body: { pulseira: B.piloto.piloto.pulseira, equipeId:B.equipeId, tipo: B.tipo, bola: bola.dataset.bola === 'sistema' ? null : Number(bola.dataset.bola), devolverFileira: B.devolver && B.devolver !== 'fora' ? Number(B.devolver) : null, kartAnteriorFora: B.devolver === 'fora' } });
          B.piloto = null; B.devolver = '';
          await Promise.all([carregarEvento(), carregarAnalise()]);
          pintar();
        } catch (err) { falhou(err); bola.disabled = false; }
        return;
      }
      const des = e.target.closest('[data-desfazer]');
      if (des && confirm('Desfazer esta troca? O kart volta para a frente da fileira e a equipe volta para o kart anterior.')) {
        try { await office(`${base}/trocas/${des.dataset.desfazer}/desfazer`, { method: 'POST' }); B.resultado = null; await carregarEvento(); pintar(); toast('Troca desfeita.'); } catch (err) { falhou(err); }
        return;
      }
      const km = e.target.closest('[data-kart-menu]'); if (km) { menuKart(km.dataset.kartMenu); return; }
      if (e.target.closest('[data-montar]')) { montarFileiras(); return; }
      if (e.target.closest('[data-largada]')) { sorteioLargada(); return; }
      const eb = e.target.closest('[data-eq-box]'); if (eb) gavetaEquipeBox(Number(eb.dataset.eqBox));
    });
    const menuKart = (kart) => {
      const k = D.ev.filas.find((x) => x.kart === kart);
      const m = modal(`<div class="modalTopo" style="padding: 16px 18px"><b style="font-size: 16px">Kart ${esc(kart)}</b><span class="sub">${k?.situacao === 'fora' ? 'fora do sorteio' : 'fileira ' + (k?.fileira ?? '?')}</span></div>
        <div style="padding: 0 18px 18px; display: flex; flex-direction: column; gap: 8px">
          ${Array.from({ length: D.ev.evento.regras.fileiras }, (_, i) => `<button class="btn sec" data-mv="${i + 1}">Mover para o fim da fileira ${i + 1}</button>`).join('')}
          ${k?.situacao === 'fora' ? '' : '<label class="campo"><span>Motivo (oficina, desempenho…)</span><input class="entrada" id="mvObs"></label><button class="btn perigo" data-mv="fora">Tirar do sorteio</button>'}
          <button class="btn sec" data-acao="fechar">Cancelar</button></div>`);
      m.style.maxWidth = '380px';
      m.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-mv]'); if (!b) return;
        try {
          const r = await office(`${base}/filas/mover`, { method: 'POST', body: b.dataset.mv === 'fora' ? { kart, situacao: 'fora', obs: $('#mvObs')?.value } : { kart, situacao: 'fila', fileira: Number(b.dataset.mv) } });
          D.ev.filas = r.filas; fecharCamada(); pintar();
        } catch (err) { falhou(err); }
      });
    };
    const montarFileiras = () => {
      const f = filasPor();
      const m = modal(`<div class="modalTopo" style="padding: 16px 18px"><b style="font-size: 16px">Montar as fileiras do box</b><span class="sub">Números dos karts na ordem da fila (o primeiro sai antes), separados por espaço ou vírgula. Karts que estão na pista ficam como estão.</span></div>
        <div style="padding: 0 18px 18px" class="ev-form">${Object.keys(f).map((n) => `<label class="campo"><span>Fileira ${n}</span><textarea class="entrada" data-fil="${n}" style="height: 90px; padding: 8px">${f[n].map((k) => k.kart).join(' ')}</textarea></label>`).join('')}
          <label class="campo" style="grid-column: 1 / -1"><span>Fora do sorteio</span><input class="entrada" id="filFora" value="${esc(D.ev.filas.filter((k) => k.situacao === 'fora').map((k) => k.kart).join(' '))}"></label></div>
        <div class="modalRodape" style="padding: 12px 18px; display: flex; gap: 8px; justify-content: flex-end"><button class="btn sec" data-acao="fechar">Cancelar</button><button class="btn prim" id="filSalvar">Salvar fileiras</button></div>`);
      m.style.maxWidth = '720px';
      $('#filSalvar').addEventListener('click', async () => {
        const separa = (s) => String(s).split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
        const fileiras = {}; m.querySelectorAll('[data-fil]').forEach((t) => { fileiras[t.dataset.fil] = separa(t.value); });
        try { const r = await office(`${base}/filas`, { method: 'POST', body: { fileiras, fora: separa($('#filFora').value) } }); D.ev.filas = r.filas; fecharCamada(); pintar(); toast('Fileiras salvas.'); } catch (err) { falhou(err); }
      });
    };
    const sorteioLargada = async () => {
      const semKart = D.ev.equipes.filter((q) => !q.desclassificada && !D.ev.filas.some((k) => k.situacao === 'pista' && k.equipeId === q.id));
      if (!semKart.length) { toast('Todas as equipes já têm kart.'); return; }
      if (!confirm(`Sortear kart para ${semKart.length} equipe(s) entre os karts das fileiras?`)) return;
      try {
        const r = await office(`${base}/largada`, { method: 'POST', body: {} });
        await carregarEvento(); pintar();
        const m = modal(`<div class="modalTopo" style="padding: 16px 18px"><b style="font-size: 16px">Karts da largada</b><span class="sub">Digite a pulseira de quem larga em cada equipe (pode ser depois, aqui ou no Box).</span></div>
          <div class="ev-rolar" style="padding: 0 18px 12px"><table class="ev-tab"><thead><tr><th>Placa</th><th class="ev-esq">Equipe</th><th>Kart</th><th>Pulseira de quem larga</th></tr></thead><tbody>${r.sorteados.map((s) => { const t = D.ev.trocas.slice().reverse().find((x) => x.tipo === 'largada' && x.kart === s.kart); return `<tr><td class="mono">#${esc(s.numero)}</td><td class="ev-esq">${esc(s.equipe)}</td><td class="mono"><b style="font-size: 18px">${esc(s.kart)}</b></td><td><input class="entrada" style="width: 90px; height: 32px" inputmode="numeric" data-larga="${t?.id ?? ''}"></td></tr>`; }).join('')}</tbody></table></div>
          <div class="modalRodape" style="padding: 12px 18px; display: flex; gap: 8px; justify-content: flex-end"><button class="btn sec" onclick="window.print()">Imprimir</button><button class="btn prim" id="lgSalvar">Salvar quem larga</button></div>`);
        m.style.maxWidth = '640px';
        $('#lgSalvar').addEventListener('click', async () => {
          for (const i of m.querySelectorAll('[data-larga]')) if (i.value.trim() && i.dataset.larga) { try { await office(`${base}/trocas/${i.dataset.larga}`, { method: 'PUT', body: { pulseira: Number(i.value) } }); } catch (err) { falhou(err); return; } }
          fecharCamada(); await carregarEvento(); toast('Pilotos da largada salvos.');
        });
      } catch (err) { falhou(err); }
    };
    const gavetaEquipeBox = (id) => {
      const e = D.an.analise.equipes.find((x) => x.id === id);
      const trocas = D.ev.trocas.filter((t) => t.equipeId === id);
      const ultima = trocas[trocas.length - 1];
      const acoes = (eq, p) => `<select class="entrada" style="height: 30px; width: auto" data-ajuste="${p.volta}"><option value="">${p.ajuste ? 'tirar correção' : 'corrigir…'}</option><option value="quebra">foi quebra (box fechado)</option><option value="validar">validar como obrigatória</option><option value="invalidar">invalidar (entrou errado 10.5)</option><option value="ignorar">não foi parada</option></select>`;
      const g = gaveta(`<div class="gavetaTopo" style="padding: 16px 18px; display: flex; align-items: center; gap: 10px"><span class="col"><b style="font-size: 17px">#${esc(e.numero)} ${esc(e.nome)}</b><span class="sub">${e.paradasValidas} válida(s) de ${a_regras().paradasObrigatorias} · ${e.paradasTotal} no total (máx. ${a_regras().paradasMax})</span></span><button class="btn sec peq" data-acao="fechar" style="margin-left: auto">Fechar</button></div>
        <div class="gavetaCorpo" style="padding: 0 18px 18px; display: flex; flex-direction: column; gap: 14px">
          <div><h3 style="font-size: 14px; margin: 0 0 8px">Paradas</h3>${EV.paradasDaEquipe(e, a_regras(), acoes)}</div>
          <div><h3 style="font-size: 14px; margin: 0 0 8px">Trocas registradas</h3><table class="ev-tab"><thead><tr><th>Hora</th><th class="ev-esq">Piloto</th><th>Kart</th><th>Fileira</th><th>Tipo</th><th></th></tr></thead><tbody>${trocas.map((t) => `<tr><td class="mono">${t.em.slice(11, 19)}</td><td class="ev-esq">${t.pulseira > 0 ? `<span class="ev-pulseira">${t.pulseira}</span> ` : ''}${esc(t.piloto || '—')}</td><td class="mono"><b>${esc(t.kart || '')}</b>${t.kartDevolvido ? ` <small>(deixou ${esc(t.kartDevolvido)})</small>` : ''}</td><td>${t.fileira ?? ''}</td><td>${esc(t.tipo)}</td><td>${t === ultima ? `<button class="btn perigo peq" data-desf="${t.id}">Desfazer</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6">Nenhuma troca.</td></tr>'}</tbody></table></div>
        </div>`);
      g.addEventListener('change', async (ev2) => {
        const s = ev2.target.closest('[data-ajuste]'); if (!s) return;
        try { await office(`${base}/ajustes`, { method: 'POST', body: { equipeId: id, volta: Number(s.dataset.ajuste), acao: s.value } }); await carregarAnalise(); gavetaEquipeBox(id); pintar(); toast('Parada corrigida.'); } catch (err) { falhou(err); }
      });
      g.addEventListener('click', async (ev2) => {
        const d = ev2.target.closest('[data-desf]'); if (!d || !confirm('Desfazer a última troca desta equipe?')) return;
        try { await office(`${base}/trocas/${d.dataset.desf}/desfazer`, { method: 'POST' }); await carregarEvento(); gavetaEquipeBox(id); pintar(); } catch (err) { falhou(err); }
      });
    };
    const a_regras = () => D.ev.evento.regras;
    pintar();
    repetir(async () => { if (document.activeElement && ['bxPulseira', 'bxDevolver'].includes(document.activeElement.id)) return; if ($('#camada').innerHTML) return; await Promise.all([carregarEvento(), carregarAnalise()]); if (E.aba === 'box') pintar(); }, 8000);
  }

  // ---------------------------------------------------------------- Pesagem
  async function abaPesagem() {
    await carregarEvento();
    const P = { dados: null, momento: guarda.ler('kib-end-momento') || 'parada', resultado: null, equipeId:null };
    const R = () => D.ev.evento.regras;
    const pintar = () => {
      const d = P.dados;
      const hist = D.ev.pesagens.slice(0, 40);
      const nomeP = (id) => { for (const q of D.ev.equipes) { const p = q.pilotos.find((x) => x.id === id); if (p) return { p, q }; } return null; };
      const lastroPadrao = d ? (P.momento === 'inicial' ? '' : d.piloto.lastroKg ?? '') : '';
      corpo().innerHTML = `<div class="ev-grade2">
        <section class="cartao"><div class="cartaoCab"><h2>Pesagem</h2><span class="sub">mínimo ${R().pesoMinKg} kg · sem tolerância · lastro até ${R().lastroMaxKg} kg</span></div><div class="ev-corpo col" style="gap: 12px">
          <div class="seg" role="group" aria-label="Momento">${[['inicial', 'Antes da largada (define o lastro)'], ['parada', 'Na parada'], ['final', 'Final (parque fechado)']].map(([v, t]) => `<button data-mom="${v}" class="${P.momento === v ? 'sel' : ''}">${t}</button>`).join('')}</div>
          <input class="ev-numGrande" id="pzPulseira" inputmode="numeric" placeholder="Pulseira" aria-label="Número da pulseira" value="${d ? d.piloto.pulseira : ''}" autocomplete="off">
          ${d?.equipes?.length > 1 ? `<label class="campo"><span>Inscrição desta pesagem</span><select class="entrada" id="pzEquipe"><option value="">Selecione a inscrição</option>${d.equipes.map(q=>`<option value="${q.id}" ${P.equipeId===q.id?'selected':''}>${esc(q.nome)}</option>`).join('')}</select></label>` : ''}
          ${d ? `<div class="ev-resultado neutro"><span>${esc(d.equipe.nome)} · placa #${esc(d.equipe.numero)}</span><b>${esc(d.piloto.nome)}</b>
              <span class="sub">Peso inicial ${d.piloto.pesoKg != null ? d.piloto.pesoKg + ' kg' : '—'} · lastro ${d.piloto.lastroKg != null ? d.piloto.lastroKg + ' kg' : '—'}${d.piloto.pesoCadastro ? ' · cadastro ' + d.piloto.pesoCadastro + ' kg' : ''}${d.lastroSugerido ? ` · sugerido ${d.lastroSugerido.lastroKg} kg${d.lastroSugerido.acimaDoLimite ? ' (acima do limite!)' : ''}` : ''}</span></div>
            <div class="ev-form"><label class="campo"><span>${P.momento === 'inicial' ? 'Balança (piloto equipado, SEM lastro)' : 'Balança (piloto COM o lastro)'}</span><input class="entrada" id="pzBalanca" inputmode="decimal" style="height: 56px; font-size: 28px; font-weight: 800; text-align: center" placeholder="kg"></label>
              <label class="campo"><span>Lastro ${P.momento === 'inicial' ? '(vazio = calcula)' : 'conferido'} (kg)</span><input class="entrada" id="pzLastro" inputmode="decimal" style="height: 56px; font-size: 22px; text-align: center" value="${esc(lastroPadrao)}"></label></div>
            <button class="btn prim" id="pzRegistrar" style="height: 48px; font-size: 16px">Registrar pesagem</button>` : '<p class="sub" style="text-align: center">Digite a pulseira e aperte Enter. Depois o peso e Enter de novo.</p>'}
          ${P.resultado ? `<div class="ev-resultado ${P.resultado.resultado}"><span>${esc(P.resultado.piloto.nome)} · pulseira ${P.resultado.piloto.pulseira}</span><b>${String(P.resultado.totalKg.toFixed(2)).replace('.', ',')} kg</b><span style="font-weight: 600">${esc(P.resultado.mensagem)}</span>${P.momento === 'inicial' && P.resultado.lastroKg != null ? `<span>Lastro: <b>${P.resultado.lastroKg} kg</b></span>` : ''}</div>` : ''}
        </div></section>
        <section class="cartao"><div class="cartaoCab"><h2>Últimas pesagens</h2></div><div class="ev-rolar"><table class="ev-tab"><thead><tr><th>Hora</th><th>Pulseira</th><th class="ev-esq">Piloto</th><th>Momento</th><th>Total</th><th>Resultado</th><th></th></tr></thead><tbody>
          ${hist.map((x) => { const np = nomeP(x.pilotoId); return `<tr><td class="mono">${x.em.slice(11, 16)}</td><td>${np ? `<span class="ev-pulseira">${np.p.pulseira}</span>` : ''}</td><td class="ev-esq">${esc(np?.p.nome || '')}<br><small>#${esc(np?.q.numero || '')} ${esc(np?.q.nome || '')}</small></td><td>${esc(x.momento)}</td><td class="mono"><b>${x.totalKg.toFixed(2)}</b></td>
            <td class="${x.resultado === 'ok' ? 'ev-bom' : x.resultado === 'dq' ? 'ev-ruim' : 'ev-medio'}">${x.resultado === 'ok' ? 'OK' : x.resultado === 'dq' ? 'DQ' : '+' + x.punicaoSeg / 60 + ' min'}</td><td><button class="btn sec peq" data-apagar-pz="${x.id}" aria-label="Apagar pesagem">Apagar</button></td></tr>`; }).join('') || '<tr><td colspan="7">Nenhuma pesagem ainda.</td></tr>'}
        </tbody></table></div></section></div>`;
      const alvo = d ? $('#pzBalanca') : $('#pzPulseira'); if (alvo) alvo.focus();
    };
    const buscar = async (n) => { try { P.dados = await office(`${base}/pulseira/${encodeURIComponent(n)}`); P.equipeId=P.dados.equipes?.length>1?null:P.dados.equipe.id; P.resultado = null; pintar(); } catch (err) { P.dados = null; falhou(err); pintar(); } };
    corpo().addEventListener('change',e=>{if(e.target.id==='pzEquipe'){P.equipeId=Number(e.target.value)||null;P.dados.equipe=P.dados.equipes.find(q=>q.id===P.equipeId)||P.dados.equipes[0];pintar();}});
    const registrar = async () => {
      const b = $('#pzBalanca'); if (!b || !b.value.trim()) return;
      try {
        if(P.momento!=='inicial'&&!P.equipeId){toast('Selecione a inscrição desta pesagem.');return;}
        P.resultado = await office(`${base}/pesagens`, { method: 'POST', body: { pulseira: P.dados.piloto.pulseira, equipeId:P.equipeId, momento: P.momento, balancaKg: b.value, lastroKg: $('#pzLastro').value } });
        P.dados = null; await carregarEvento(); pintar();
      } catch (err) { falhou(err); }
    };
    corpo().addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      if (e.target.id === 'pzPulseira' && e.target.value.trim()) buscar(e.target.value.trim());
      if (e.target.id === 'pzBalanca' || e.target.id === 'pzLastro') registrar();
    });
    corpo().addEventListener('click', async (e) => {
      const mo = e.target.closest('[data-mom]'); if (mo) { P.momento = mo.dataset.mom; guarda.gravar('kib-end-momento', P.momento); pintar(); return; }
      if (e.target.id === 'pzRegistrar') { registrar(); return; }
      const ap = e.target.closest('[data-apagar-pz]');
      if (ap && confirm('Apagar esta pesagem? A punição que ela gerou também sai.')) { try { await office(`${base}/pesagens/${ap.dataset.apagarPz}`, { method: 'DELETE' }); await carregarEvento(); pintar(); } catch (err) { falhou(err); } }
    });
    pintar();
  }

  // ---------------------------------------------------------------- Equipes e pulseiras
  async function abaEquipes() {
    await carregarEvento();
    const link = (q) => `${location.origin}/equipe/${q.token}`;
    const pintar = () => {
      const tot = D.ev.equipes.reduce((a, q) => a + q.pilotos.length, 0);
      corpo().innerHTML = `<section class="cartao"><div class="cartaoCab"><h2>${D.ev.equipes.length} equipes · ${tot} pilotos</h2><span class="dir ev-naoImprime" style="display: flex; flex-wrap: wrap; gap: 6px"><button class="btn prim peq" data-nova-eq="1">${svg(IC.mais, 12, '#FFF', 2.6)}Equipe</button><button class="btn sec peq" data-importar="1">Importar lista</button><button class="btn sec peq" onclick="window.print()">Imprimir pulseiras</button></span></div>
        <div class="ev-rolar"><table class="ev-tab"><thead><tr><th>Placa</th><th class="ev-esq">Equipe</th><th>Transponder</th><th class="ev-esq">Chefe</th><th class="ev-esq">Pilotos (pulseira · peso · lastro)</th><th>Pago</th><th class="ev-naoImprime">Link do chefe</th><th class="ev-naoImprime"></th></tr></thead><tbody>
        ${D.ev.equipes.map((q) => `<tr class="${q.desclassificada ? 'ev-dq' : ''}"><td class="mono"><b style="font-size: 16px">#${esc(q.numero)}</b></td><td class="ev-esq"><b>${esc(q.nome)}</b>${q.desclassificada ? ' <span class="chip vermelho">DQ</span>' : ''}</td><td class="mono">${esc(q.transponder || '—')}</td><td class="ev-esq">${esc(q.chefeNome || '—')}${q.chefeTelefone ? '<br><small>' + esc(q.chefeTelefone) + '</small>' : ''}</td>
          <td class="ev-esq"><div class="col" style="gap: 4px">${q.pilotos.map((p) => `<span style="display: flex; align-items: center; gap: 6px"><span class="ev-pulseira">${p.pulseira}</span><b>${esc(p.nome)}</b>${p.chefe ? ' <span class="chip laranja">chefe</span>' : ''}<small>${p.pesoKg != null ? p.pesoKg + ' kg' : ''}${p.lastroKg != null ? ' · lastro ' + p.lastroKg : ''}${p.origem === 'totem' ? ' · totem' : ''}</small><button class="btn sec peq ev-naoImprime" data-ed-pil="${p.id}" style="height: 24px">Editar</button></span>`).join('')}
            ${q.pilotos.length < D.ev.evento.regras.pilotosMax ? `<button class="btn verdeClaro peq ev-naoImprime" data-novo-pil="${q.id}" style="align-self: flex-start">+ piloto</button>` : ''}</div></td>
          <td>${q.pago ? '<span class="chip verde">pago</span>' : '<span class="chip laranja">não</span>'}</td>
          <td class="ev-naoImprime"><button class="btn sec peq" data-copiar="${esc(link(q))}">Copiar</button>${q.chefeTelefone ? ` <a class="btn verdeClaro peq" target="_blank" rel="noopener" href="${esc(zap(q.chefeTelefone, `Olá! Acompanhe a equipe ${q.nome} nas ${D.ev.evento.nome} por este link: ${link(q)}`))}">WhatsApp</a>` : ''}</td>
          <td class="ev-naoImprime"><button class="btn sec peq" data-ed-eq="${q.id}">Editar</button></td></tr>`).join('') || '<tr><td colspan="8">Nenhuma equipe. Cadastre uma a uma ou importe a lista.</td></tr>'}
        </tbody></table></div></section>`;
    };
    const formEquipe = (q) => {
      const m = modal(`<div class="modalTopo" style="padding: 16px 18px"><b style="font-size: 16px">${q ? 'Editar equipe' : 'Nova equipe'}</b></div><form id="fEq" style="padding: 0 18px 18px" class="ev-form">
        <label class="campo"><span>Nome da equipe</span><input class="entrada" name="nome" required value="${esc(q?.nome || '')}"></label>
        <label class="campo"><span>Número da placa</span><input class="entrada" name="numero" required value="${esc(q?.numero || '')}"></label>
        <label class="campo"><span>Transponder da equipe</span><input class="entrada" name="transponder" inputmode="numeric" value="${esc(q?.transponder || '')}" placeholder="opcional"></label>
        <label class="campo"><span>Chefe de equipe</span><input class="entrada" name="chefeNome" value="${esc(q?.chefeNome || '')}"></label>
        <label class="campo"><span>WhatsApp do chefe</span><input class="entrada" name="chefeTelefone" inputmode="tel" value="${esc(q?.chefeTelefone || '')}"></label>
        <label class="campo"><span>Observação</span><input class="entrada" name="obs" value="${esc(q?.obs || '')}"></label>
        <label style="display: flex; gap: 8px; align-items: center"><input type="checkbox" name="pago" ${q?.pago ? 'checked' : ''}> Inscrição paga</label>
        ${q ? `<label style="display: flex; gap: 8px; align-items: center; color: var(--erroTxt)"><input type="checkbox" name="desclassificada" ${q.desclassificada ? 'checked' : ''}> Desclassificada (DQ)</label>` : ''}
        <div style="grid-column: 1 / -1; display: flex; gap: 8px; justify-content: flex-end">${q ? '<button type="button" class="btn perigo" id="eqApagar" style="margin-right: auto">Apagar</button>' : ''}<button type="button" class="btn sec" data-acao="fechar">Cancelar</button><button class="btn prim">Salvar</button></div></form>`);
      m.style.maxWidth = '640px';
      $('#fEq').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target)); f.pago = !!f.pago; f.desclassificada = !!f.desclassificada;
        try { await office(q ? `${base}/equipes/${q.id}` : `${base}/equipes`, { method: q ? 'PUT' : 'POST', body: f }); fecharCamada(); await carregarEvento(); pintar(); toast('Equipe salva.'); } catch (err) { falhou(err); }
      });
      $('#eqApagar')?.addEventListener('click', async () => { if (!confirm('Apagar a equipe?')) return; try { await office(`${base}/equipes/${q.id}`, { method: 'DELETE' }); fecharCamada(); await carregarEvento(); pintar(); } catch (err) { falhou(err); } });
    };
    const formPiloto = (equipeId, p) => {
      const m = modal(`<div class="modalTopo" style="padding: 16px 18px"><b style="font-size: 16px">${p ? `Pulseira ${p.pulseira} · ${esc(p.nome)}` : 'Novo piloto na equipe ' + esc(eqDe(equipeId).nome)}</b>${p ? '' : '<span class="sub">Procure o cliente pelo nome ou CPF (cadastro do totem) ou escreva só o nome.</span>'}</div>
        <div style="padding: 0 18px 18px" class="ev-form">
          ${p ? '' : '<label class="campo" style="grid-column: 1 / -1"><span>Buscar cliente</span><input class="entrada" id="pBusca" placeholder="Nome, CPF ou telefone"></label><div id="pRes" style="grid-column: 1 / -1; display: flex; flex-direction: column; gap: 4px"></div>'}
          <label class="campo"><span>Nome</span><input class="entrada" id="pNome" value="${esc(p?.nome || '')}"></label>
          ${p ? `<label class="campo"><span>Equipe</span><select class="entrada" id="pEq">${D.ev.equipes.map((q) => `<option value="${q.id}" ${q.id === p.equipeId ? 'selected' : ''}>#${esc(q.numero)} ${esc(q.nome)}</option>`).join('')}</select></label>
            <label class="campo"><span>Peso inicial (kg)</span><input class="entrada" id="pPeso" inputmode="decimal" value="${p.pesoKg ?? ''}"></label><label class="campo"><span>Lastro (kg)</span><input class="entrada" id="pLastro" inputmode="decimal" value="${p.lastroKg ?? ''}"></label>` : ''}
          <label style="display: flex; gap: 8px; align-items: center"><input type="checkbox" id="pChefe" ${p?.chefe ? 'checked' : ''}> Chefe de equipe</label>
          <div style="grid-column: 1 / -1; display: flex; gap: 8px; justify-content: flex-end">${p ? '<button class="btn perigo" id="pTirar" style="margin-right: auto">Tirar do evento</button>' : ''}<button class="btn sec" data-acao="fechar">Cancelar</button><button class="btn prim" id="pSalvar">Salvar</button></div></div>`);
      m.style.maxWidth = '600px';
      let clienteId = null, t;
      $('#pBusca')?.addEventListener('input', (e) => {
        clearTimeout(t); const q = e.target.value.trim(); if (q.length < 3) return;
        t = setTimeout(async () => { try { const l = await office('/clientes?q=' + encodeURIComponent(q)); $('#pRes').innerHTML = l.slice(0, 8).map((c) => `<button class="btn branco" data-cli="${c.id}" data-nome="${esc(c.nome)}" style="justify-content: flex-start">${esc(c.nome)} <small class="sub">${esc(c.documento || '')}${c.peso ? ' · ' + c.peso + ' kg' : ''}</small></button>`).join('') || '<span class="sub">Nada encontrado.</span>'; } catch (err) { falhou(err); } }, 300);
      });
      m.addEventListener('click', (e) => { const c = e.target.closest('[data-cli]'); if (c) { clienteId = Number(c.dataset.cli); $('#pNome').value = c.dataset.nome; $('#pRes').innerHTML = `<span class="chip verde">cliente ligado: ${esc(c.dataset.nome)}</span>`; } });
      $('#pSalvar').addEventListener('click', async () => {
        try {
          if (p) await office(`${base}/pilotos/${p.id}`, { method: 'PUT', body: { nome: $('#pNome').value, equipeId: Number($('#pEq').value), chefe: $('#pChefe').checked, pesoKg: $('#pPeso').value, lastroKg: $('#pLastro').value } });
          else { const r = await office(`${base}/pilotos`, { method: 'POST', body: { equipeId, clienteId, nome: $('#pNome').value, chefe: $('#pChefe').checked } }); toast(`Pulseira ${r.pulseira} para ${$('#pNome').value}.`); }
          fecharCamada(); await carregarEvento(); pintar();
        } catch (err) { falhou(err); }
      });
      $('#pTirar')?.addEventListener('click', async () => { if (!confirm(`Tirar ${p.nome} do evento? A pulseira ${p.pulseira} não é reaproveitada.`)) return; try { await office(`${base}/pilotos/${p.id}`, { method: 'DELETE' }); fecharCamada(); await carregarEvento(); pintar(); } catch (err) { falhou(err); } });
    };
    const importar = () => {
      const m = modal(`<div class="modalTopo" style="padding: 16px 18px"><b style="font-size: 16px">Importar equipes e pilotos</b><span class="sub">Uma linha por piloto: <b>placa ; equipe ; piloto ; CPF ; chefe</b> (CPF e chefe são opcionais; dá para colar do Excel). Com CPF o piloto fica ligado ao cadastro do kartódromo.</span></div>
        <div style="padding: 0 18px 18px"><textarea class="entrada" id="impTexto" style="height: 260px; padding: 10px; font-family: var(--mono)" placeholder="101;Equipe Exemplo;João da Silva;12345678900;chefe&#10;101;Equipe Exemplo;Maria Souza"></textarea></div>
        <div class="modalRodape" style="padding: 12px 18px; display: flex; gap: 8px; justify-content: flex-end"><button class="btn sec" data-acao="fechar">Cancelar</button><button class="btn prim" id="impOk">Importar</button></div>`);
      m.style.maxWidth = '720px';
      $('#impOk').addEventListener('click', async () => {
        try { const r = await office(`${base}/importar`, { method: 'POST', body: { texto: $('#impTexto').value } }); fecharCamada(); await carregarEvento(); pintar(); toast(`${r.equipes} equipe(s) e ${r.pilotos} piloto(s) novos${r.erros.length ? ` · ${r.erros.length} erro(s)` : ''}.`, r.erros.length > 0); if (r.erros.length) alert(r.erros.join('\n')); } catch (err) { falhou(err); }
      });
    };
    corpo().addEventListener('click', async (e) => {
      if (e.target.closest('[data-nova-eq]')) return formEquipe(null);
      const ed = e.target.closest('[data-ed-eq]'); if (ed) return formEquipe(eqDe(Number(ed.dataset.edEq)));
      const np = e.target.closest('[data-novo-pil]'); if (np) return formPiloto(Number(np.dataset.novoPil), null);
      const ep = e.target.closest('[data-ed-pil]'); if (ep) { for (const q of D.ev.equipes) { const p = q.pilotos.find((x) => x.id === Number(ep.dataset.edPil)); if (p) return formPiloto(q.id, p); } }
      if (e.target.closest('[data-importar]')) return importar();
      const cp = e.target.closest('[data-copiar]'); if (cp) { try { await navigator.clipboard.writeText(cp.dataset.copiar); toast('Link copiado.'); } catch { prompt('Copie o link:', cp.dataset.copiar); } }
    });
    pintar();
  }

  // ---------------------------------------------------------------- Punições
  async function abaPunicoes() {
    await carregarEvento();
    const pintar = () => {
      corpo().innerHTML = `<div class="ev-grade2">
        <section class="cartao"><div class="cartaoCab"><h2>Aplicar punição</h2><span class="sub">decisão da direção de prova</span></div><form id="fPun" class="ev-corpo ev-form">
          <label class="campo" style="grid-column: 1 / -1"><span>Equipe</span><select class="entrada" name="equipeId" required><option value="">Escolha…</option>${D.ev.equipes.map((q) => `<option value="${q.id}">#${esc(q.numero)} ${esc(q.nome)}</option>`).join('')}</select></label>
          <label class="campo" style="grid-column: 1 / -1"><span>Punição</span><select class="entrada" name="preset">${PRESETS_PUNICAO.map(([t, v, r], i) => `<option value="${i}">${esc(r)}</option>`).join('')}</select></label>
          <label class="campo"><span>Valor (segundos ou voltas)</span><input class="entrada" name="valor" inputmode="numeric" value="15"></label>
          <label class="campo" style="grid-column: 1 / -1"><span>Motivo</span><input class="entrada" name="motivo" required placeholder="Ex.: ultrapassagem sob bandeira amarela na curva 3, volta 87"></label>
          <div style="grid-column: 1 / -1; display: flex; justify-content: flex-end"><button class="btn prim">Aplicar</button></div></form></section>
        <section class="cartao"><div class="cartaoCab"><h2>Punições aplicadas</h2></div><div class="ev-rolar"><table class="ev-tab"><thead><tr><th>Hora</th><th class="ev-esq">Equipe</th><th>Punição</th><th class="ev-esq">Motivo</th><th></th></tr></thead><tbody>
          ${D.ev.punicoes.slice().reverse().map((p) => `<tr><td class="mono">${p.em.slice(11, 16)}</td><td class="ev-esq">#${esc(eqDe(p.equipeId)?.numero)} ${esc(eqDe(p.equipeId)?.nome)}</td><td><b>${p.tipo === 'segundos' ? '+' + p.valor + ' s' : p.tipo === 'voltas' ? '−' + p.valor + ' volta(s)' : p.tipo === 'dq' ? 'DQ' : 'Advertência'}</b>${p.origem === 'pesagem' ? '<br><small>pesagem</small>' : ''}</td><td class="ev-esq">${esc(p.motivo)}</td><td><button class="btn sec peq" data-tirar-pun="${p.id}">Cancelar</button></td></tr>`).join('') || '<tr><td colspan="5">Nenhuma punição.</td></tr>'}
        </tbody></table></div></section></div>`;
      const f = $('#fPun');
      f.preset.addEventListener('change', () => { f.valor.value = PRESETS_PUNICAO[f.preset.value][1] || ''; });
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const [tipo] = PRESETS_PUNICAO[f.preset.value];
        try { await office(`${base}/punicoes`, { method: 'POST', body: { equipeId: Number(f.equipeId.value), tipo, valor: Number(f.valor.value) || 0, motivo: `${PRESETS_PUNICAO[f.preset.value][2].replace(/^Outra · \w+$/, '')} ${f.motivo.value}`.trim() } }); await carregarEvento(); pintar(); toast('Punição aplicada.'); } catch (err) { falhou(err); }
      });
    };
    corpo().addEventListener('click', async (e) => {
      const t = e.target.closest('[data-tirar-pun]'); if (!t || !confirm('Cancelar esta punição?')) return;
      try { await office(`${base}/punicoes/${t.dataset.tirarPun}`, { method: 'DELETE' }); await carregarEvento(); pintar(); } catch (err) { falhou(err); }
    });
    pintar();
  }

  // ---------------------------------------------------------------- Estatísticas
  async function abaEstatisticas() {
    const pintar = async () => {
      const a = await carregarAnalise();
      if (E.aba !== 'estatisticas') return;
      const conteudo = E.est === 'stint' ? EV.stintMedio(a.analise, a.regras) : E.est === 'equipe' ? EV.porPiloto(a.analise, a.porPiloto) : E.est === 'karts' ? EV.karts(a.karts) : E.est === 'classificacao' ? EV.classificacao(a.analise, a.regras) : EV.tempoParadas(a.analise, a.regras);
      corpo().innerHTML = `<section class="cartao"><div class="cartaoCab"><h2>Estatísticas · ${esc(atual.nome)}</h2><span class="dir ev-naoImprime" style="display: flex; flex-wrap: wrap; gap: 6px">
        ${[['paradas', 'Tempo das paradas'], ['stint', 'Stint médio'], ['equipe', 'Pilotos'], ['karts', 'Karts'], ['classificacao', 'Classificação']].map(([v, t]) => `<button class="btn ${E.est === v ? 'escuro' : 'sec'} peq" data-est="${v}">${t}</button>`).join('')}
        <button class="btn sec peq" onclick="window.print()">Imprimir / PDF</button><button class="btn sec peq" data-csv="1">Exportar volta a volta</button></span></div><div class="ev-corpo">${conteudo}</div></section>`;
    };
    corpo().addEventListener('click', async (e) => {
      const b = e.target.closest('[data-est]'); if (b) { E.est = b.dataset.est; pintar(); return; }
      if (e.target.closest('[data-csv]')) {
        try { const r = await office(`${base}/volta-a-volta`); const url = URL.createObjectURL(new Blob(['﻿' + r.csv], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = r.nome; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); } catch (err) { falhou(err); }
      }
    });
    await pintar();
    repetir(pintar, 15000);
  }

  // ---------------------------------------------------------------- Evento e regras
  async function abaEvento() {
    await carregarEvento();
    const ev = D.ev.evento, r = ev.regras;
    let sessoes = [], baterias = [];
    try { sessoes = await office(`${base}/sessoes-crono`); } catch { /* cronometragem fora: mostra só o id */ }
    if (ev.data) { try { baterias = await office(`/baterias?status=todas&filtro=dia&data=${ev.data}`); } catch { /* sem agenda */ } }
    const numeros = [['duracaoMin', 'Duração da prova (min)'], ['pesoMinKg', 'Peso mínimo (kg)'], ['lastroMaxKg', 'Lastro máximo (kg)'], ['punicaoSegPor500g', 'Punição por 500 g abaixo (s)'], ['deficitMaxKg', 'Abaixo do mínimo até (kg) = punição; mais = DQ do kart'], ['dqEquipeAbaixoKg', 'Pesagem abaixo de (kg) = DQ da equipe'],
      ['paradasObrigatorias', 'Paradas obrigatórias'], ['paradasMax', 'Paradas no total (máximo)'], ['paradaMinMs', 'Tempo mínimo da parada (ms)'], ['faixaPunicaoMs', 'Vale com punição a partir de (ms)'], ['punicaoFaixaSeg', 'Punição dessa faixa (s)'], ['voltasPorParadaFaltante', 'Voltas perdidas por parada que falta'],
      ['boxAbreMin', 'Box abre aos (min)'], ['boxFechaMin', 'Box fecha aos (min)'], ['limiarParadaMs', 'Volta acima disto é parada (ms)'], ['voltaLimpaMaxMs', 'Médias só com voltas até (ms)'], ['fileiras', 'Fileiras do sorteio'], ['pilotosMax', 'Pilotos por equipe (máximo)'],
      ['mediaVoltas', 'Média das últimas N voltas'], ['radarBomPct', 'Radar: kart bom (% mais rápidos)'], ['radarMedioPct', 'Radar: kart médio (%)']];
    corpo().innerHTML = `<div class="ev-grade2">
      <section class="cartao"><div class="cartaoCab"><h2>Evento</h2></div><form id="fEv" class="ev-corpo ev-form">
        <label class="campo" style="grid-column: 1 / -1"><span>Nome</span><input class="entrada" name="nome" value="${esc(ev.nome)}" required></label>
        <label class="campo"><span>Data</span><input class="entrada" type="date" name="data" value="${esc(ev.data || '')}"></label>
        <label class="campo"><span>Bateria da agenda (o totem oferece a equipe)</span><select class="entrada" name="bateriaId"><option value="">nenhuma</option>${baterias.map((b) => `<option value="${b.id}" ${b.id === ev.bateriaId ? 'selected' : ''}>${esc(String(b.dataHora || b.inicio || '').slice(11, 16))} · ${esc(b.nome)}</option>`).join('')}${ev.bateriaId && !baterias.find((b) => b.id === ev.bateriaId) ? `<option value="${ev.bateriaId}" selected>bateria ${ev.bateriaId}</option>` : ''}</select></label>
        <label style="display: flex; gap: 8px; align-items: center"><input type="checkbox" name="ativo" ${ev.ativo ? 'checked' : ''}> Evento ativo (aparece no totem)</label>
        <div style="grid-column: 1 / -1; display: flex; justify-content: flex-end"><button class="btn prim">Salvar evento</button></div></form></section>
      <section class="cartao"><div class="cartaoCab"><h2>Cronometragem</h2><span class="sub">cada equipe vira um competidor (número da placa) na corrida</span></div><div class="ev-corpo col" style="gap: 10px">
        <label class="campo"><span>Corrida (2,5 h)</span><select class="entrada" id="crCorrida"><option value="">escolha…</option>${sessoes.map((s) => `<option value="${esc(s.id)}" ${s.id === ev.sessaoCrono ? 'selected' : ''}>${esc(s.nome)} · ${esc(s.tipo)} · ${esc(s.estado)} · ${new Date(s.criadaEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</option>`).join('')}</select></label>
        <label class="campo"><span>Tomada de tempo (5 min)</span><select class="entrada" id="crTomada"><option value="">escolha…</option>${sessoes.map((s) => `<option value="${esc(s.id)}" ${s.id === ev.sessaoTomada ? 'selected' : ''}>${esc(s.nome)} · ${esc(s.tipo)} · ${esc(s.estado)}</option>`).join('')}</select></label>
        <label style="display: flex; gap: 8px; align-items: center"><input type="checkbox" id="crTransp"> Gravar o transponder de cada equipe na cronometragem (placa = número)</label>
        <div style="display: flex; flex-wrap: wrap; gap: 8px"><button class="btn prim" data-preparar="corrida">Ligar corrida e lançar as equipes</button><button class="btn sec" data-preparar="tomada">Ligar tomada e lançar as equipes</button></div>
        <p class="ev-nota">Lança na bateria escolhida a lista de equipes (número da placa + nome), desliga o e-mail automático aos pilotos e, na corrida, acerta a duração para ${r.duracaoMin} min. A bandeira e o fim continuam com o cronometrista.</p>
      </div></section></div>
      <section class="cartao" style="margin-top: 18px"><div class="cartaoCab"><h2>Regras do regulamento</h2><span class="sub">valores das 100 Milhas Light de Betim; mude só se o regulamento mudar</span></div><form id="fRg" class="ev-corpo ev-form">
        ${numeros.map(([k, t]) => `<label class="campo"><span>${t}</span><input class="entrada" name="${k}" inputmode="numeric" value="${r[k]}"></label>`).join('')}
        <label class="campo"><span>Tempo da parada</span><select class="entrada" name="medidaParada"><option value="volta-menos-media" ${r.medidaParada === 'volta-menos-media' ? 'selected' : ''}>volta do box − volta normal</option><option value="volta" ${r.medidaParada === 'volta' ? 'selected' : ''}>volta do box inteira</option></select></label>
        <div style="grid-column: 1 / -1; display: flex; justify-content: flex-end"><button class="btn prim">Salvar regras</button></div></form></section>`;
    $('#fEv').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
      try { await office(base, { method: 'PUT', body: { nome: f.nome, data: f.data, bateriaId: f.bateriaId ? Number(f.bateriaId) : null, ativo: !!f.ativo } }); toast('Evento salvo.'); abrirTela('endurance'); } catch (err) { falhou(err); }
    });
    $('#fRg').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
      const regras = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, k === 'medidaParada' ? v : Number(String(v).replace(',', '.'))]));
      try { await office(base, { method: 'PUT', body: { regras } }); toast('Regras salvas.'); } catch (err) { falhou(err); }
    });
    corpo().addEventListener('click', async (e) => {
      const b = e.target.closest('[data-preparar]'); if (!b) return;
      const tipo = b.dataset.preparar, sessaoId = $(tipo === 'corrida' ? '#crCorrida' : '#crTomada').value;
      if (!sessaoId) { toast('Escolha a bateria da cronometragem.', true); return; }
      const corpoReq = { sessaoId, tipo, transponders: $('#crTransp').checked };
      try {
        let r;
        try { r = await office(`${base}/preparar-crono`, { method: 'POST', body: corpoReq }); } catch (err) {
          if (!/Confirme para trocar/.test(err.message) || !confirm(`${err.message}\nOs karts com esses números perdem o transponder na cronometragem. Continuar?`)) throw err;
          r = await office(`${base}/preparar-crono`, { method: 'POST', body: { ...corpoReq, forcar: true } });
        }
        toast(`${r.equipes} equipes lançadas na ${tipo}.${r.avisos.length ? ' ' + r.avisos.join('; ') : ''}`);
      } catch (err) { falhou(err); }
    });
  }

  abrirAba();
};

function novoEvento() {
  const m = modal(`<div class="modalTopo" style="padding: 16px 18px"><b style="font-size: 16px">Novo evento de endurance</b><span class="sub">As regras começam com as do regulamento das 100 Milhas Light de Betim.</span></div>
    <form id="fNovoEv" style="padding: 0 18px 18px" class="ev-form"><label class="campo" style="grid-column: 1 / -1"><span>Nome</span><input class="entrada" name="nome" required value="100 Milhas Light de Betim 2026"></label>
    <label class="campo"><span>Data</span><input class="entrada" type="date" name="data" value="2026-10-25"></label>
    <div style="grid-column: 1 / -1; display: flex; gap: 8px; justify-content: flex-end"><button type="button" class="btn sec" data-acao="fechar">Cancelar</button><button class="btn prim">Criar</button></div></form>`);
  m.style.maxWidth = '520px';
  $('#fNovoEv').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    try { const r = await office('/endurance/eventos', { method: 'POST', body: f }); S.end = { ...(S.end || {}), ev: r.id, aba: 'evento' }; guarda.gravar('kib-end-ev', r.id); fecharCamada(); abrirTela('endurance'); } catch (err) { falhou(err); }
  });
}
