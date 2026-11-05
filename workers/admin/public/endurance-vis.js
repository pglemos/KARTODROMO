'use strict';
/* Endurance: tabelas e gráficos usados no painel (admin) e na página do chefe de equipe.
   Não depende de app.js: recebe a análise pronta do servidor (/endurance/eventos/:id/analise ou /publico/endurance/:token). */
const EV = (() => {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tempo = (ms) => {
    if (ms == null || !isFinite(ms)) return '—';
    const neg = ms < 0; ms = Math.abs(Math.round(ms));
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), mil = ms % 1000;
    return `${neg ? '-' : ''}${m ? m + ':' + String(s).padStart(2, '0') : s}.${String(mil).padStart(3, '0')}`;
  };
  const relogio = (ms) => {
    if (ms == null || !isFinite(ms)) return '—';
    ms = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(ms / 3600), m = Math.floor((ms % 3600) / 60), s = ms % 60;
    return `${h ? h + ':' : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`;
  };
  const dif = (e) => (e.posPista === 1 ? 'Líder' : e.difLiderVoltas ? `+${e.difLiderVoltas} volta${e.difLiderVoltas > 1 ? 's' : ''}` : e.difLiderMs != null ? '+' + tempo(e.difLiderMs) : '—');
  const difFrente = (e) => (e.posPista === 1 ? '' : e.difFrenteVoltas ? `+${e.difFrenteVoltas} v` : e.difFrenteMs != null ? '+' + tempo(e.difFrenteMs) : '—');
  const RADAR = { bom: 'ev-bom', medio: 'ev-medio', ruim: 'ev-ruim' };
  const CORES = ['#0B7A53', '#1E6FE8', '#D92D20', '#FF9F0A', '#8645D6', '#0E9C9C', '#E8590C', '#5A3E36', '#C2185B', '#3F51B5', '#7CB342', '#00ACC1'];

  function cabecalhoProva(a, regras) {
    const s = a.sessao;
    const estado = !s ? 'Corrida não ligada' : s.state === 'preparando' ? 'Aguardando largada' : s.state === 'em_andamento' ? 'Em andamento' : s.state === 'bandeira_final' ? 'Bandeira final' : s.state === 'encerrada' ? 'Encerrada' : s.state;
    const pct = s && s.durationMs ? Math.min(100, (s.elapsedMs / s.durationMs) * 100) : 0;
    return `<div class="ev-topo">
      <div class="ev-relogio"><span>Tempo de prova</span><b class="mono">${s ? relogio(s.elapsedMs) : '—'}</b></div>
      <div class="ev-relogio"><span>Restante</span><b class="mono">${a.restanteMs != null ? relogio(a.restanteMs) : relogio(regras.duracaoMin * 60000)}</b></div>
      <div class="ev-relogio"><span>Situação</span><b>${esc(estado)}</b></div>
      <div class="ev-relogio ${a.boxAberto ? 'ev-aberto' : 'ev-fechado'}"><span>Box</span><b>${esc(a.boxTexto)}</b></div>
      <div class="ev-relogio"><span>Melhor volta</span><b class="mono">${a.melhorVolta ? `${tempo(a.melhorVolta.ms)} <small>#${esc(a.melhorVolta.numero)} v${a.melhorVolta.volta}</small>` : '—'}</b></div>
      <div class="ev-relogio"><span>Melhor média (${regras.mediaVoltas}v)</span><b class="mono">${a.melhorMedia ? `${tempo(a.melhorMedia.ms)} <small>#${esc(a.melhorMedia.numero)}</small>` : '—'}</b></div>
      <div class="ev-barraProva"><i style="width: ${pct}%"></i><em style="left: ${(regras.boxAbreMin / regras.duracaoMin) * 100}%"></em><em style="left: ${(regras.boxFechaMin / regras.duracaoMin) * 100}%"></em></div>
    </div>`;
  }

  function paradasTxt(e, regras) {
    const cls = e.paradasFaltando ? (e.paradasTotal >= regras.paradasMax ? 'ev-ruim' : '') : 'ev-bom';
    return `<span class="${cls}" title="válidas / total">${e.paradasValidas}/${e.paradasTotal}${e.paradasFaltando ? ` · faltam ${e.paradasFaltando}` : ' ✓'}</span>`;
  }

  /** Classificação oficial (com punições) e posição na pista. */
  function classificacao(a, regras, destaque) {
    if (!a.equipes.length) return '<p class="ev-vazio">Nenhuma equipe cadastrada.</p>';
    return `<div class="ev-rolar"><table class="ev-tab">
      <thead><tr><th>Pos</th><th>Pista</th><th>Nº</th><th class="ev-esq">Equipe</th><th class="ev-esq">Na pista</th><th>Voltas</th><th>Dif. líder</th><th>Dif. frente</th><th>Última</th><th>Melhor</th><th>Média ${regras.mediaVoltas}v</th><th>Paradas</th><th>Stint</th><th>Punição</th></tr></thead>
      <tbody>${a.equipes.map((e) => `<tr class="${e.numero === destaque ? 'ev-minha' : ''} ${e.desclassificada ? 'ev-dq' : ''}">
        <td><b>${e.desclassificada ? 'DQ' : e.posOficial + 'º'}</b></td><td>${e.posPista}º</td><td class="mono"><b>#${esc(e.numero)}</b></td>
        <td class="ev-esq"><b>${esc(e.nome)}</b>${e.alertas.length ? `<div class="ev-alertas">${e.alertas.map((x) => `<span class="ev-al ev-al-${x.nivel}">${esc(x.texto)}</span>`).join('')}</div>` : ''}${e.desclassificada ? `<div class="ev-alertas"><span class="ev-al ev-al-grave">DQ: ${esc(e.motivosDq.join('; '))}</span></div>` : ''}</td>
        <td class="ev-esq">${e.noBox ? '<span class="ev-box">BOX</span> ' : ''}${esc(e.pilotoAtual || '—')}${e.kartAtual ? ` <small class="mono">kart ${esc(e.kartAtual)}</small>` : ''}</td>
        <td class="mono"><b>${e.voltas}</b>${e.voltasPerdidas ? `<small class="ev-ruim"> −${e.voltasPerdidas}</small>` : ''}</td>
        <td class="mono">${dif(e)}</td><td class="mono">${difFrente(e)}</td>
        <td class="mono ${RADAR[e.radar] || ''}">${tempo(e.ultimaMs)}</td><td class="mono">${tempo(e.melhorMs)}</td><td class="mono">${tempo(e.mediaMs)}</td>
        <td>${paradasTxt(e, regras)}</td><td class="mono">${e.tempoNoStintMs != null ? relogio(e.tempoNoStintMs) : '—'}</td>
        <td class="mono">${e.punicaoSeg ? '+' + e.punicaoSeg + ' s' : ''}${e.voltasPerdidasPrevistas > e.voltasPerdidas ? `<small class="ev-medio" title="paradas obrigatórias que faltam"> (−${e.voltasPerdidasPrevistas - e.voltasPerdidas} v)</small>` : ''}</td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  /** Ordenação pela média das últimas voltas (estratégia), com os concorrentes escolhidos em cima. */
  function porMedia(a, regras, escolhidos, destaque) {
    const lista = a.equipes.filter((e) => e.mediaMs != null).sort((x, y) => x.mediaMs - y.mediaMs);
    const linha = (e, i) => `<tr class="${e.numero === destaque ? 'ev-minha' : ''}"><td><b>${i + 1}º</b></td><td>${e.posPista}º</td><td class="mono"><b>#${esc(e.numero)}</b></td><td class="mono"><b>${tempo(e.mediaMs)}</b></td><td class="mono">${i ? tempo(e.mediaMs - lista[0].mediaMs) : ''}</td><td class="mono ${RADAR[e.radar] || ''}">${tempo(e.ultimaMs)}</td><td class="ev-esq">${esc(e.nome)}</td></tr>`;
    const cab = `<thead><tr><th>Ordem</th><th>Pista</th><th>Kart</th><th>Média (${regras.mediaVoltas}v)</th><th>Dif. média</th><th>Última volta</th><th class="ev-esq">Equipe</th></tr></thead>`;
    const sel = lista.filter((e) => escolhidos.has(e.numero) || e.numero === destaque);
    return `${sel.length ? `<div class="ev-rolar"><table class="ev-tab">${cab}<tbody>${sel.map((e) => linha(e, lista.indexOf(e))).join('')}</tbody></table></div><h4 class="ev-sub">Todas as equipes</h4>` : ''}
      <div class="ev-rolar"><table class="ev-tab">${cab}<tbody>${lista.map(linha).join('') || '<tr><td colspan="7">Ainda sem voltas.</td></tr>'}</tbody></table></div>`;
  }

  function seletorConcorrentes(a, escolhidos) {
    return `<div class="ev-concorrentes">${a.equipes.slice().sort((x, y) => String(x.numero).localeCompare(String(y.numero), 'pt', { numeric: true })).map((e) => `<label><input type="checkbox" data-concorrente="${esc(e.numero)}" ${escolhidos.has(e.numero) ? 'checked' : ''}> ${esc(e.numero)}</label>`).join('')}</div>`;
  }

  /** Radar do box: posição real, voltas, paradas, tempo de pista, média e cor da última volta (kart bom/médio/ruim). */
  function radar(a, regras, destaque) {
    return `<p class="ev-nota">Cor da última volta: <span class="ev-bom">verde</span> = ${regras.radarBomPct}% mais rápidos (kart bom), <span class="ev-medio">amarelo</span> = próximos ${regras.radarMedioPct}% (médio), <span class="ev-ruim">vermelho</span> = o resto.</p>
      <div class="ev-rolar"><table class="ev-tab"><thead><tr><th>Real</th><th>Pista</th><th>Kart</th><th class="ev-esq">Equipe</th><th>Voltas</th><th>Paradas</th><th>Tempo no stint</th><th>Média (${regras.mediaVoltas}v)</th><th>Última volta</th><th>Diferença</th></tr></thead>
      <tbody>${a.equipes.map((e) => `<tr class="${e.numero === destaque ? 'ev-minha' : ''}"><td><b>${e.posOficial}º</b></td><td>${e.posPista}º</td><td class="mono"><b>#${esc(e.numero)}</b></td><td class="ev-esq">${esc(e.nome)}</td><td class="mono">${e.voltas}</td><td>${e.paradasFaltando ? e.paradasTotal : 'OK'}</td>
        <td class="mono">${e.tempoNoStintMs != null ? relogio(e.tempoNoStintMs) : '—'}</td><td class="mono">${tempo(e.mediaMs)}</td><td class="mono ${RADAR[e.radar] || ''}">${tempo(e.ultimaMs)}</td>
        <td class="mono">${e.noBox ? '<span class="ev-box">BOX</span>' : difFrente(e) || '—'}</td></tr>`).join('')}</tbody></table></div>`;
  }

  /** Ultrapassagem futura: posição prevista nas próximas 10 voltas, no ritmo da média de cada equipe. */
  function ultrapassagem(a, escolhidos, destaque) {
    let eqs = a.equipes.filter((e) => e.ultrapassagem && e.ultrapassagem.length);
    const foco = eqs.filter((e) => escolhidos.has(e.numero) || e.numero === destaque);
    eqs = (foco.length >= 2 ? foco : eqs.slice().sort((x, y) => x.ultrapassagem[0] - y.ultrapassagem[0]).slice(0, 10));
    if (!eqs.length) return '<p class="ev-vazio">Ainda sem voltas suficientes.</p>';
    // posições relativas só entre as equipes mostradas
    const serie = eqs.map((e) => ({ e, p: [] }));
    for (let k = 0; k <= 10; k++) serie.slice().sort((x, y) => x.e.ultrapassagem[k] - y.e.ultrapassagem[k]).forEach((s, i) => { s.p[k] = i + 1; });
    const W = 900, H = 40 + eqs.length * 38, x = (k) => 50 + k * ((W - 170) / 10), y = (p) => 20 + (p - 1) * 38;
    return `<svg class="ev-graf" viewBox="0 0 ${W} ${H + 20}" role="img" aria-label="Ultrapassagem futura">
      ${eqs.map((_, i) => `<line x1="50" x2="${W - 120}" y1="${y(i + 1)}" y2="${y(i + 1)}" stroke="#E5E5EA"/><text x="30" y="${y(i + 1) + 4}" font-size="16" text-anchor="end" fill="#6E6E73">${i + 1}º</text>`).join('')}
      ${Array.from({ length: 11 }, (_, k) => `<text x="${x(k)}" y="${H + 14}" font-size="15" text-anchor="middle" fill="#8E8E93">${k}</text>`).join('')}
      ${serie.map((s, i) => { const cor = s.e.numero === destaque ? '#FF6B00' : CORES[i % CORES.length]; return `<polyline fill="none" stroke="${cor}" stroke-width="${s.e.numero === destaque ? 4 : 3}" points="${s.p.map((p, k) => `${x(k)},${y(p)}`).join(' ')}"/>
        <circle cx="${x(10)}" cy="${y(s.p[10])}" r="17" fill="#FFF" stroke="${cor}" stroke-width="2"/><text x="${x(10)}" y="${y(s.p[10]) + 4}" font-size="14" font-weight="700" text-anchor="middle" fill="${cor}">${esc(s.e.numero)}</text>
        <text x="${x(10) + 24}" y="${y(s.p[10]) + 5}" font-size="15" fill="${cor}">${esc(s.e.nome).slice(0, 18)}</text>`; }).join('')}
    </svg><p class="ev-nota">Eixo de baixo = voltas a partir de agora. Considera o ritmo da média das últimas voltas de cada equipe.</p>`;
  }

  /** Projeção do resultado final: voltas que cabem no tempo restante, descontando as paradas obrigatórias que faltam. */
  function projecao(a, destaque) {
    const eqs = a.equipes.filter((e) => e.projecaoVoltas != null).sort((x, y) => x.posProjecao - y.posProjecao);
    if (!eqs.length) return '<p class="ev-vazio">A projeção aparece depois da largada.</p>';
    const min = Math.min(...eqs.map((e) => e.projecaoVoltas)), max = Math.max(...eqs.map((e) => e.projecaoVoltas));
    const larg = (v) => 8 + (max > min ? ((v - min) / (max - min)) * 92 : 92);
    const cor = (e, i) => (e.noBox ? '#D92D20' : e.numero === destaque ? '#FF6B00' : i < 3 ? '#0B9E3B' : i < 6 ? '#3F67B5' : i < 10 ? '#E6D200' : '#C7C7CC');
    return `<div class="ev-proj">${eqs.map((e, i) => `<div class="ev-projLinha"><span class="ev-projPos">${i + 1}º</span><span class="ev-projBarra"><i style="width: ${larg(e.projecaoVoltas)}%; background: ${cor(e, i)}"></i></span><span class="ev-projTxt">${e.noBox ? 'box · ' : ''}#${esc(e.numero)} ${esc(e.nome)} <small>${e.projecaoVoltas.toLocaleString('pt-BR')} v</small></span></div>`).join('')}</div>`;
  }

  // ---------------------------------------------------------------- estatísticas
  function tempoParadas(a, regras) {
    const max = Math.max(1, ...a.equipes.map((e) => e.paradas.length));
    return `<p class="ev-nota">TEMPO PERDIDO: o que passou do tempo mínimo (${tempo(regras.paradaMinMs)}) somando as paradas. Volta do box − volta normal da equipe${regras.medidaParada === 'volta' ? ' (configurado: volta inteira)' : ''}.</p>
    <div class="ev-rolar"><table class="ev-tab"><thead><tr><th>Ordem</th><th class="ev-esq">Equipe</th><th>Média paradas</th><th>Tempo perdido</th><th>Paradas</th>${Array.from({ length: max }, (_, i) => `<th>Par. ${i + 1}</th>`).join('')}</tr></thead>
    <tbody>${a.equipes.map((e) => `<tr><td>${e.posOficial}º</td><td class="ev-esq"><b>#${esc(e.numero)}</b> ${esc(e.nome)}</td><td class="mono">${tempo(e.mediaParadasMs)}</td><td class="mono">${(e.tempoPerdidoMs / 1000).toFixed(3)}</td><td>${e.paradasTotal}</td>
      ${Array.from({ length: max }, (_, i) => { const p = e.paradas[i]; return `<td class="mono ${p ? (p.situacao === 'valida' ? '' : p.situacao === 'valida_punida' ? 'ev-medio' : 'ev-ruim') : ''}">${p ? `${tempo(p.tempoMs)}<br><small>v: ${p.volta}${p.quebra ? ' · quebra' : ''}${p.situacao === 'rapida' ? ' · sem mín.' : p.situacao === 'ignorada' ? ' · ignorada' : ''}</small>` : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function stintMedio(a, regras) {
    const max = Math.max(1, ...a.equipes.map((e) => e.stints.length));
    return `<p class="ev-nota">MÉDIA: só voltas até ${Math.round(regras.voltaLimpaMaxMs / 1000)} segundos.</p>
    <div class="ev-rolar"><table class="ev-tab"><thead><tr><th>Ordem</th><th class="ev-esq">Equipe</th><th>Melhor volta</th><th>Média total</th>${Array.from({ length: max }, (_, i) => `<th>Stint ${i + 1}</th>`).join('')}</tr></thead>
    <tbody>${a.equipes.map((e) => `<tr><td>${e.posOficial}º</td><td class="ev-esq"><b>#${esc(e.numero)}</b> ${esc(e.nome)}</td><td class="mono">${tempo(e.melhorMs)}</td><td class="mono">${tempo(e.mediaTotalMs)}</td>
      ${Array.from({ length: max }, (_, i) => { const s = e.stints[i]; return `<td class="mono">${s ? `${tempo(s.mediaMs)}<br><small>${s.voltas}v (${s.voltaIni}-${s.voltaFim})${s.piloto ? '<br>' + esc(s.piloto.split(' ')[0]) : ''}${s.kart ? ' · k' + esc(s.kart) : ''}</small>` : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function porPiloto(a, lista) {
    const nome = (id) => a.equipes.find((e) => e.id === id);
    return `<div class="ev-rolar"><table class="ev-tab"><thead><tr><th class="ev-esq">Equipe</th><th class="ev-esq">Piloto</th><th>Stints</th><th>Voltas</th><th>Tempo na pista</th><th>Média</th><th>Melhor</th></tr></thead>
    <tbody>${lista.slice().sort((x, y) => (nome(x.equipeId)?.posOficial ?? 99) - (nome(y.equipeId)?.posOficial ?? 99) || (x.mediaMs ?? 1e9) - (y.mediaMs ?? 1e9)).map((p) => `<tr><td class="ev-esq">#${esc(nome(p.equipeId)?.numero)} ${esc(nome(p.equipeId)?.nome)}</td><td class="ev-esq"><b>${esc(p.piloto)}</b></td><td>${p.stints}</td><td>${p.voltas}</td><td class="mono">${relogio(p.tempoMs)}</td><td class="mono">${tempo(p.mediaMs)}</td><td class="mono">${tempo(p.melhorMs)}</td></tr>`).join('') || '<tr><td colspan="7">Sem stints ainda.</td></tr>'}</tbody></table></div>`;
  }

  function karts(lista) {
    return `<p class="ev-nota">Média das voltas limpas de cada kart físico em todos os stints (para a organização avaliar tirar kart do sorteio — item 6.4).</p>
    <div class="ev-rolar"><table class="ev-tab"><thead><tr><th>Kart</th><th>Voltas</th><th>Média</th><th>Dif. p/ melhor</th><th>Melhor volta</th><th class="ev-esq">Equipes</th></tr></thead>
    <tbody>${lista.map((k) => `<tr><td class="mono"><b>${esc(k.kart)}</b></td><td>${k.voltas}</td><td class="mono">${tempo(k.mediaMs)}</td><td class="mono ${k.difMs > 1500 ? 'ev-ruim' : k.difMs > 700 ? 'ev-medio' : 'ev-bom'}">+${tempo(k.difMs)}</td><td class="mono">${tempo(k.melhorMs)}</td><td class="ev-esq">${k.equipes.map((n) => '#' + esc(n)).join(' ')}</td></tr>`).join('') || '<tr><td colspan="6">Os karts aparecem depois das primeiras trocas registradas no box.</td></tr>'}</tbody></table></div>`;
  }

  /** Paradas de uma equipe (página do chefe e box). */
  function paradasDaEquipe(e, regras, acoes) {
    if (!e.paradas.length) return `<p class="ev-vazio">Nenhuma parada ainda. Obrigatórias: ${regras.paradasObrigatorias} de no mínimo ${tempo(regras.paradaMinMs)} (máximo ${regras.paradasMax} paradas no total).</p>`;
    const txt = { valida: 'Válida', valida_punida: `Válida +${regras.punicaoFaixaSeg} s`, rapida: 'Sem tempo mínimo', ignorada: 'Ignorada' };
    return `<table class="ev-tab"><thead><tr><th>#</th><th>Volta</th><th>Minuto</th><th>Tempo</th><th class="ev-esq">Situação</th>${acoes ? '<th></th>' : ''}</tr></thead><tbody>${e.paradas.map((p, i) => `<tr><td>${i + 1}</td><td>${p.volta}</td><td>${Math.floor(p.minutoDeProva)}'</td><td class="mono"><b>${tempo(p.tempoMs)}</b></td>
      <td class="ev-esq"><span class="${p.situacao === 'valida' ? 'ev-bom' : p.situacao === 'valida_punida' ? 'ev-medio' : 'ev-ruim'}">${txt[p.situacao]}</span>${p.quebra ? ' · quebra' : ''}${p.foraDaJanela ? ' · box fechado' : ''}</td>${acoes ? `<td>${acoes(e, p)}</td>` : ''}</tr>`).join('')}</tbody></table>`;
  }

  return { esc, tempo, relogio, cabecalhoProva, classificacao, porMedia, seletorConcorrentes, radar, ultrapassagem, projecao, tempoParadas, stintMedio, porPiloto, karts, paradasDaEquipe };
})();
