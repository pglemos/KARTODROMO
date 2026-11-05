'use strict';
/* Reserva em grupo (Agenda): cada piloto com nome, WhatsApp e link de cadastro, pagamento de cada um e Pix do Asaas.
   Usa as rotas /api/office/grupos… do servidor da operação (SRVKART). Depende de app.js (carregado antes). */

const Grupo = (() => {
  const MODOS = [
    ['unico', 'O responsável paga tudo', 'Um link Asaas com o valor do grupo inteiro.'],
    ['individual', 'Cada um paga o seu', 'Cada piloto recebe o próprio link de pagamento.'],
    ['sinal', 'Sinal agora, resto na recepção', 'O responsável paga uma parte e cada um acerta o resto ao chegar.'],
  ];
  const ORIGENS = [['whatsapp', 'WhatsApp'], ['telefone', 'Telefone'], ['recepcao', 'Recepção'], ['site', 'Site']];
  const quando = (inicio) => { const d = deIso(inicio); return `${DIAS[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${horaDe(inicio)}`; };
  const primeiro = (n) => String(n || '').trim().split(/\s+/)[0] || '';
  const chipCad = (p) => ({ completo: ['verde', '✓ Pronto para o totem'], incompleto: ['laranja', 'Falta ' + (p.falta || []).join(', ')], enviado: ['laranja', 'Link enviado · não terminou'], pendente: ['cinza', 'Link não enviado'] }[p.cadastro] || ['cinza', p.cadastro]);

  function msgCadastro(g, p) {
    return `Olá${p.nome ? ', ' + primeiro(p.nome) : ''}! Sua vaga na bateria do Kartódromo de Betim (${quando(g.inicio)}) já está guardada na reserva de ${primeiro(g.responsavel)}. Faça seu cadastro (1 minuto): ${p.link} — no dia é só digitar o CPF no totem.`;
  }
  function destino(g, p) { return p.telefone || g.responsavelTelefone || ''; }

  // ---------------------------------------------------------------- cartões na gaveta da bateria
  function cartoes(grupos) {
    return grupos.map((g, gi) => {
      const cor = CORG[gi % 6];
      const rostos = g.pilotos.map((p) => { const ok = p.pago && p.cadastro === 'completo', meio = p.pago || p.cadastro === 'completo'; return `<span title="${esc((p.nome || 'Piloto ' + p.ordem) + ' · ' + (p.cadastro === 'completo' ? 'cadastro ok' : 'falta cadastro') + ' · ' + (p.pago ? 'pago' : 'falta pagar'))}" style="width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; ${ok ? 'background: #34C759; color: #FFF' : meio ? 'background: #FFD08A; color: #5C3700' : 'background: #E5E5EA; color: #6E6E73'}">${esc(p.nome ? iniciais(p.nome) : String(p.ordem))}</span>`; }).join('');
      const pct = g.total ? Math.round(g.pago / g.total * 100) : 100;
      return `<div style="display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 14px; background: var(--sup2); box-shadow: inset 0 0 0 1px var(--linha)">
        <span style="display: flex; align-items: center; gap: 10px"><span class="avatar" style="width: 34px; height: 34px; font-size: 12px; background: ${cor}">${esc(iniciais(g.responsavel))}</span><span class="col" style="flex-grow: 1"><b>${esc(g.responsavel)}${g.n > 1 ? ` e mais ${g.n - 1}` : ''}</b><span class="peq">${g.n} piloto(s) · ${esc({ unico: 'responsável paga tudo', individual: 'cada um paga o seu', sinal: 'sinal + resto na recepção' }[g.modo])} · ${esc(g.codigo)}</span></span></span>
        <span style="display: flex; flex-wrap: wrap; gap: 4px">${rostos}</span>
        <span style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">
          <span class="col" style="gap: 4px"><span style="display: flex; font-size: 11.5px"><span class="peq">Cadastros</span><b style="margin-left: auto">${g.cadastrados} de ${g.n}</b></span><span class="barra" style="height: 5px"><span style="width: ${Math.round(g.cadastrados / Math.max(1, g.n) * 100)}%; background: ${g.cadastrados === g.n ? '#34C759' : '#FF9F0A'}"></span></span></span>
          <span class="col" style="gap: 4px"><span style="display: flex; font-size: 11.5px"><span class="peq">Pago</span><b style="margin-left: auto">${brlCurto(g.pago)} de ${brlCurto(g.total)}</b></span><span class="barra" style="height: 5px"><span style="width: ${pct}%; background: ${g.falta ? '#FF9F0A' : '#34C759'}"></span></span></span>
        </span>
        <span style="display: flex; flex-wrap: wrap; gap: 6px"><button class="btn escuro peq" data-grupo-abrir="${g.id}">Abrir reserva</button>${g.falta || g.cadastrados < g.n ? `<button class="btn verdeClaro peq" data-grupo-abrir="${g.id}">Cobrar e mandar links</button>` : ''}</span>
      </div>`;
    }).join('');
  }

  // ---------------------------------------------------------------- janela "Reserva do grupo"
  let estado = null; // { b, g (do servidor) | null, rasc (nova), aoMudar }

  async function abrir(grupoId, b, aoMudar) {
    estado = { b, g: null, rasc: null, aoMudar, reg: { valor: '', quem: '', forma: 'Pix' } };
    modal('<div class="esqueleto" style="height: 420px; margin: 20px"></div>').style.maxWidth = '1140px';
    try { estado.g = await office(`/grupos/${grupoId}`); pintar(); } catch (e) { falhou(e); fecharCamada(); }
  }

  function nova(b, aoMudar, qtd) {
    const n = Math.min(qtd || 2, Math.max(1, +b.disponiveis || 1));
    estado = {
      b, g: null, aoMudar, reg: { valor: '', quem: '', forma: 'Pix' }, enviarAgora: true, busca: '', achados: [],
      rasc: { responsavel: null, origem: 'whatsapp', modo: 'individual', preco: +b.preco || 0, sinalPct: 30, pilotos: Array.from({ length: n }, () => ({ nome: '', telefone: '', menor: false })) },
    };
    modal('').style.maxWidth = '1140px';
    pintar();
  }

  // valores de cada piloto numa reserva ainda não salva (mesma conta do servidor)
  function contaRascunho(r) {
    const n = r.pilotos.length, total = n * (+r.preco || 0);
    return { n, total, pago: 0, falta: total, pagos: 0, cadastrados: 0, sinal: Math.round(total * r.sinalPct / 100) };
  }

  function pintar() {
    const m = $('#camada .modal'); if (!m || !estado) return;
    const { b, g, rasc } = estado;
    const novo = !g;
    const T = TIPOS[b.reservaFechada ? 'fechada' : 'reserva'];
    const c = novo ? contaRascunho(rasc) : g;
    const modo = novo ? rasc.modo : g.modo;
    const preco = novo ? rasc.preco : g.preco;
    const sinalPct = novo ? rasc.sinalPct : g.sinalPct;
    const max = b.reservaFechada ? Math.max(12, +b.vagas || 12) : (novo ? +b.disponiveis : (+b.disponiveis || 0) + g.n);
    const pilotos = novo ? rasc.pilotos.map((p, i) => ({ ...p, ordem: i + 1, responsavel: i === 0 })) : g.pilotos;
    const titulo = novo ? 'Quem vai correr?' : `${esc(g.responsavel)}${g.n > 1 ? ' e mais ' + (g.n - 1) : ''}`;
    const linhas = pilotos.map((p, i) => {
      const resp = i === 0;
      const nomeVal = resp && novo ? (rasc.responsavel?.nome || '') : (p.nome || '');
      const foneVal = resp && novo ? (rasc.responsavel?.telefone || '') : (p.telefone || '');
      let cad = ['cinza', 'Link sai ao salvar'], pg = ['cinza', brl(preco)], acoesCad = '', acoesPg = '';
      if (!novo) {
        cad = chipCad(p);
        if (p.cadastro !== 'completo') acoesCad = `<button class="btn peq" style="height: 22px; padding: 0; background: transparent; color: var(--verde)" data-link="${p.id}">${p.linkEnviadoEm ? 'Reenviar link' : destino(g, p) ? 'Enviar link' : 'Sem WhatsApp'}</button>`;
        if (modo === 'unico') { pg = p.pago ? ['verde', '✓ Pago pelo grupo'] : resp ? ['laranja', 'Paga o grupo · falta ' + brlCurto(g.falta)] : ['cinza', 'Responsável paga']; }
        else if (modo === 'sinal') { pg = p.pago ? ['verde', p.pagoNoCaixa ? '✓ Pago no caixa' : '✓ Pago'] : ['laranja', 'Resto ' + brlCurto(p.falta_centavos) + ' na recepção']; }
        else { pg = p.pago ? ['verde', p.pagoNoCaixa ? '✓ Pago no caixa' : '✓ Pago'] : p.valorPago > 0 ? ['laranja', `Pagou ${brlCurto(p.valorPago)} · falta ${brlCurto(p.falta_centavos)}`] : ['vermelho', 'Falta ' + brlCurto(p.falta_centavos)]; }
        if (!p.pago && (modo !== 'unico' || resp)) acoesPg = `<span style="display: flex; gap: 10px"><button class="btn peq" style="height: 22px; padding: 0; background: transparent; color: var(--verde)" data-cobrar="${modo === 'unico' ? '' : p.id}">Cobrar</button><button class="btn peq" style="height: 22px; padding: 0; background: transparent; color: var(--azulTxt)" data-recebi="${modo === 'unico' ? '' : p.id}">Recebi</button></span>`;
      }
      const okVerde = !novo && p.pago && p.cadastro === 'completo';
      return `<div style="display: grid; grid-template-columns: 34px minmax(0, 1.3fr) minmax(0, 1fr) 66px 178px 190px 30px; gap: 10px; align-items: center; min-height: 62px; padding: 6px 16px; border-top: 1px solid rgba(0,0,0,.05); ${resp ? 'background: rgba(11,122,83,.035)' : ''}">
        <span class="avatar" style="width: 32px; height: 32px; font-size: 11.5px; background: ${okVerde ? '#34C759' : CORG[i % 6]}">${esc(nomeVal ? iniciais(nomeVal) : String(i + 1))}</span>
        <span class="col" style="gap: 3px">${resp && novo ? `<span class="entrada" style="height: 34px; display: flex; align-items: center; font-size: 13.5px; ${nomeVal ? '' : 'color: var(--mudo3)'}">${esc(nomeVal || 'Escolha o responsável ao lado')}</span>` : `<input class="entrada" style="height: 34px; font-size: 13.5px" value="${esc(nomeVal)}" placeholder="${resp ? 'Nome do responsável' : 'Nome (ou deixe para o link)'}" aria-label="Nome do piloto ${i + 1}" data-campo="nome" data-i="${i}" ${!novo && resp ? 'readonly' : ''}>`}${resp ? '<span class="chip verde" style="align-self: flex-start; font-size: 10.5px; padding: 1px 7px">RESPONSÁVEL</span>' : ''}</span>
        ${resp && novo ? `<span class="mono peq">${esc(foneVal || '—')}</span>` : `<input class="entrada mono" style="height: 34px; font-size: 12.5px" value="${esc(foneVal)}" placeholder="(31) 9 0000-0000" inputmode="tel" aria-label="WhatsApp do piloto ${i + 1}" data-campo="telefone" data-i="${i}" ${!novo && resp ? 'readonly' : ''}>`}
        <button class="btn peq" role="switch" aria-checked="${!!p.menor}" data-menor="${i}" style="height: 30px; ${p.menor ? 'background: rgba(134,69,214,.14); color: #6A35B0' : 'background: rgba(118,118,128,.10); color: var(--mudo)'}">${p.menor ? 'Menor' : 'Adulto'}</button>
        <span class="col" style="gap: 4px; align-items: flex-start"><span class="chip ${cad[0]} trunc" style="max-width: 100%">${esc(cad[1])}</span>${acoesCad}</span>
        <span class="col" style="gap: 4px; align-items: flex-start"><span class="chip ${pg[0]} trunc" style="max-width: 100%">${esc(pg[1])}</span>${acoesPg}</span>
        ${resp ? '<span></span>' : `<button class="btn peq hov" style="width: 28px; padding: 0; background: transparent" aria-label="Tirar o piloto ${i + 1}" data-tirar="${i}">${svg(IC.fechar, 13, '#AEAEB2', 2.4)}</button>`}
      </div>`;
    }).join('');
    const pagamentos = novo ? [] : g.pagamentos.slice().reverse();
    const nomeDe = (pid) => { const p = g && g.pilotos.find((x) => x.id === pid); return p ? (p.nome || 'Piloto ' + p.ordem) : 'Grupo · ' + (g ? g.responsavel : ''); };
    const integra = novo ? [] : [
      ['Totem', 'Quem está com o cadastro pronto só digita o CPF e confirma o peso e o termo.', `${g.cadastrados}/${g.n} prontos`, g.cadastrados === g.n, IC.totem, G('#6CB8FF', '#1E6FE8')],
      ['Asaas', 'Pix e cartão. Quando o pagamento cai, a reserva se atualiza sozinha (a cada minuto).', `${g.pagos}/${g.n} pagos`, !g.falta, 'M12 3v18M17 7H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H6', G('#4A8DF0', '#1450A8')],
      ['Recepção', `O grupo aparece na bateria das ${horaDe(g.inicio)} e quem está pago já sai pago no caixa.`, g.falta ? 'cobrar ' + brlCurto(g.falta) : 'nada a cobrar', !g.falta, IC.recepcao, G('#5EDB7A', '#1E9E4A')],
      ['Sorteio de karts', 'Quem tem cadastro e pagamento em dia entra direto no sorteio.', `${g.prontos}/${g.n} liberados`, g.prontos === g.n, IC.sorteio, G('#C08BFF', '#8645D6')],
      ['Cronometragem', 'Os nomes vão para o placar e o resultado chega no e-mail de cada piloto.', `${g.pilotos.filter((p) => p.nome).length}/${g.n} nomes`, g.pilotos.every((p) => p.nome), IC.crono, G('#FF6B5E', '#D92D20')],
    ];
    const respOk = novo ? !!rasc.responsavel : true;
    const erroNovo = novo && !respOk ? 'Escolha o responsável (nome, CPF ou telefone).' : '';
    m.innerHTML = `
      <div class="modalTopo" style="${T.topo}"><span class="col" style="gap: 3px; min-width: 0"><span style="font-size: 11.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; opacity: .8">${novo ? 'Nova reserva · ' + (b.reservaFechada ? 'bateria fechada' : 'bateria com vagas') : 'Reserva ' + esc(g.codigo)}</span><span style="font-size: 23px; font-weight: 700; letter-spacing: -0.02em">${titulo}</span><span style="font-size: 13px; opacity: .85">${esc(quando(b.dataHora))} · ${esc(b.nome)}</span></span>
        <span style="margin-left: auto; display: flex; flex-wrap: wrap; gap: 6px">${[[`${c.n} piloto${c.n > 1 ? 's' : ''}`, '#1D1D1F'], [`Cadastros ${c.cadastrados}/${c.n}`, c.cadastrados === c.n ? '#34C759' : '#FF9F0A'], [`Pago ${brlCurto(c.pago)} de ${brlCurto(c.total)}`, c.falta ? '#FF9F0A' : '#34C759']].map(([t, cor]) => `<span class="chip" style="height: 28px; padding: 0 11px; border-radius: 14px; font-size: 12.5px; background: rgba(255,255,255,.7); color: var(--tinta)"><span class="ponto" style="background: ${cor}"></span>${t}</span>`).join('')}</span>
        <button class="fechar hov" style="position: static" data-acao="fechar" aria-label="Fechar">${svg(IC.fechar, 15, '#1D1D1F', 2.4)}</button></div>
      <div style="display: flex; flex-wrap: wrap; gap: 16px; padding: 16px 18px 18px">
        <section class="cartao leve" style="flex: 999 1 620px; min-width: 0; align-self: flex-start">
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; padding: 14px 16px 10px"><span class="col" style="gap: 2px; flex: 1 1 260px"><b style="font-size: 16px">Pilotos do grupo</b><span class="peq" style="line-height: 1.4">${novo ? 'Ligou o Pedro e vem com mais 5? Coloque 6 e preencha o que souber. Quem ficar sem nome completa pelo próprio link.' : `${g.cadastrados} de ${g.n} com cadastro pronto para o totem · ${g.pagos} de ${g.n} pagos`}</span></span>
            <span style="display: flex; align-items: center; gap: 8px"><span class="peq" style="font-weight: 600">Quantos pilotos?</span><span class="passo"><button type="button" data-qtd="-1" aria-label="Um piloto a menos">−</button><span>${c.n}</span><button type="button" data-qtd="1" aria-label="Um piloto a mais" ${c.n >= max ? 'disabled' : ''}>+</button></span><span class="peq">até ${max}</span></span></div>
          ${novo ? `<div style="display: flex; flex-direction: column; gap: 8px; padding: 0 16px 12px">
            <label class="buscaCampo" style="height: 38px">${svg(IC.busca, 14, '#8E8E93')}<input id="qResp" value="${esc(estado.busca)}" placeholder="Responsável: nome, CPF ou telefone" autocomplete="off" aria-label="Buscar o responsável"></label>
            <div id="achados">${estado.achados.length ? `<div class="resultadoBusca">${estado.achados.slice(0, 10).map((x) => `<button type="button" class="hov" data-resp='${esc(JSON.stringify({ id: x.id, nome: x.nome, telefone: x.telefone, documento: x.documento }))}'><span class="avatar" style="width: 28px; height: 28px; font-size: 10.5px; background: ${CORG[x.id % 6]}">${esc(iniciais(x.nome))}</span><span class="col"><b class="trunc">${esc(x.nome)}</b><span class="peq">${esc(x.documento || 'sem CPF')} · ${esc(x.telefone || 'sem telefone')}</span></span></button>`).join('')}</div>` : ''}</div>
            <span style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px"><span class="peq" style="font-weight: 600">Chegou por</span><span class="seg">${ORIGENS.map(([v, t]) => `<button type="button" data-origem="${v}" class="${rasc.origem === v ? 'sel' : ''}" style="height: 28px; font-size: 12.5px">${t}</button>`).join('')}</span><span class="peq">Não achou o responsável? Ele faz o cadastro em ${esc(LINK_CADASTRO.replace('https://', ''))} e aparece aqui.</span></span></div>` : ''}
          <div class="rolagemX"><div style="min-width: 800px"><div class="cabTabela" style="grid-template-columns: 34px minmax(0, 1.3fr) minmax(0, 1fr) 66px 178px 190px 30px; padding: 0 16px"><span></span><span>Nome</span><span>WhatsApp</span><span>Idade</span><span>Cadastro do totem</span><span>Pagamento</span><span></span></div>${linhas}</div></div>
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 12px 16px; background: var(--sup2); border-top: 1px solid var(--linha)">
            <button class="btn branco peq" data-qtd="1" ${c.n >= max ? 'disabled' : ''}>+ Adicionar piloto</button>
            <span class="peq" style="flex: 1 1 220px; line-height: 1.4">Cada piloto recebe o próprio link: <span class="mono" style="color: var(--tinta); font-size: 11.5px">${esc(LINK_CADASTRO.replace('https://', ''))}/?r=…</span></span>
            ${!novo && g.pilotos.some((p) => p.cadastro !== 'completo' && destino(g, p)) ? '<button class="btn verdeClaro peq" data-links-todos="1">Mandar links para quem falta</button>' : ''}
          </div>
          <div id="listaLinks"></div>
        </section>
        <div style="flex: 1 1 340px; min-width: 0; display: flex; flex-direction: column; gap: 14px">
          <section class="secao" style="padding: 14px 16px 16px; gap: 12px"><span class="titulo" style="font-size: 15px">Como o grupo vai pagar</span>
            <div role="radiogroup" style="display: flex; flex-direction: column; gap: 6px">${MODOS.map(([v, t, d]) => `<button type="button" role="radio" aria-checked="${modo === v}" data-modo="${v}" class="hov" style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border: 0; border-radius: 12px; text-align: left; ${modo === v ? 'background: rgba(11,122,83,.07); box-shadow: inset 0 0 0 1.5px var(--verde)' : 'background: var(--fundo)'}"><span style="width: 18px; height: 18px; margin-top: 1px; border-radius: 50%; flex-shrink: 0; ${modo === v ? 'border: 5px solid var(--verde); background: #FFF' : 'border: 1.5px solid #C7C7CC; background: #FFF'}"></span><span class="col" style="gap: 2px"><b style="font-size: 13px">${t}</b><span class="peq" style="line-height: 1.4">${d}</span></span></button>`).join('')}</div>
            <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">
              <label class="campo"><span>Preço por piloto</span><span class="entrada" style="display: flex; align-items: center; gap: 6px; height: 36px"><span class="peq">R$</span><input type="number" min="0" step="0.01" value="${(preco / 100).toFixed(2)}" data-preco="1" style="width: 100%; min-width: 0; border: 0; outline: none; background: transparent; font-size: 14px; font-weight: 600"></span></label>
              ${modo === 'sinal' ? `<label class="campo"><span>Sinal agora</span><span class="entrada" style="display: flex; align-items: center; gap: 6px; height: 36px"><input type="number" min="0" max="100" step="5" value="${sinalPct}" data-sinal="1" style="width: 100%; min-width: 0; border: 0; outline: none; background: transparent; font-size: 14px; font-weight: 600"><span class="peq">%</span></span></label>` : `<span class="campo"><span>Total da reserva</span><span class="num" style="height: 36px; display: flex; align-items: center; font-size: 18px; font-weight: 700">${brl(c.total)}</span></span>`}
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 12px; background: var(--sup2); box-shadow: inset 0 0 0 1px var(--linha)">
              <span style="display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 8px"><span class="num" style="font-size: 24px; font-weight: 700; letter-spacing: -0.02em">${brl(c.pago)}</span><span class="peq">de ${brl(c.total)}</span><span class="chip ${c.falta ? 'laranja' : 'verde'}" style="margin-left: auto">${c.falta ? 'falta ' + brl(c.falta) : 'tudo pago'}</span></span>
              <span style="display: flex; height: 8px; border-radius: 4px; overflow: hidden; gap: 2px; background: rgba(118,118,128,.14)">${pilotos.map((p) => `<span style="flex: 1 1 0; ${!novo && p.pago ? 'background: #34C759' : !novo && p.valorPago > 0 ? `background: linear-gradient(90deg, #34C759 ${Math.round(p.valorPago / Math.max(1, preco) * 100)}%, transparent 0)` : ''}"></span>`).join('')}</span>
              <span class="peq" style="line-height: 1.45; color: var(--tinta2)">${novo ? 'Os links de pagamento saem depois de salvar.' : g.falta ? (modo === 'unico' ? esc(g.responsavel) + ' paga pelo grupo.' : 'Falta pagar: ' + esc(g.pilotos.filter((p) => !p.pago).map((p) => p.nome || 'Piloto ' + p.ordem).join(', ')) + '.') : 'Todos pagos. O grupo entra liberado no sorteio.'}</span>
            </div>
            ${!novo ? `<div style="display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 12px; background: linear-gradient(135deg, rgba(30,111,232,.08), rgba(11,122,83,.08)); box-shadow: inset 0 0 0 1px rgba(30,111,232,.15)">
              <span style="display: flex; align-items: center; gap: 8px"><span style="width: 26px; height: 26px; border-radius: 7px; display: flex; align-items: center; justify-content: center; background: ${G('#4A8DF0', '#1E6FE8')}; color: #FFF; font-size: 11px; font-weight: 800">A</span><b>Asaas · Pix e cartão</b><span class="chip ${!g.falta ? 'verde' : g.pago ? 'laranja' : 'azul'}" style="margin-left: auto">${!g.falta ? 'Pago' : g.pago ? 'Parcial' : 'Aguardando'}</span></span>
              <span class="peq" style="line-height: 1.45; color: var(--tinta2)">${modo === 'individual' ? `Cada piloto recebe o próprio link de ${brl(preco)}. Toque em “Cobrar” no piloto.` : modo === 'sinal' ? `Link do sinal: ${brl(g.sinal)} (${sinalPct}%). O resto cada um paga na recepção.` : `Link do grupo inteiro: ${brl(g.falta)}.`}</span>
              ${modo !== 'individual' && g.falta ? `<button class="btn prim peq" data-cobrar="">Gerar e enviar link ao responsável</button>` : ''}
              ${g.cobrancaGrupo ? `<a class="mono peq trunc" target="_blank" rel="noopener" href="${esc(g.cobrancaGrupo.link)}" style="padding: 7px 10px; border-radius: 8px; background: #FFF">${esc(g.cobrancaGrupo.link)}</a>` : ''}
            </div>` : ''}
          </section>
          ${!novo ? `<section class="secao" style="padding: 14px 16px"><span class="titulo" style="font-size: 15px">Pagamentos recebidos<span class="peq" style="margin-left: auto; font-weight: 500">${pagamentos.length || ''}</span></span>
            ${pagamentos.map((pg) => `<div style="display: flex; align-items: center; gap: 10px; padding: 7px 0; border-top: 1px solid var(--linha)"><span style="width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #FFF; font-size: 10.5px; font-weight: 700; background: ${pg.pilotoId ? CORG[pg.pilotoId % 6] : '#1D1D1F'}">${esc(pg.pilotoId ? iniciais(nomeDe(pg.pilotoId)) : 'G')}</span><span class="col" style="flex-grow: 1"><b class="trunc">${esc(nomeDe(pg.pilotoId))}</b><span class="peq">${esc(pg.forma)} · ${esc((pg.criadoEm || '').slice(8, 10) + '/' + (pg.criadoEm || '').slice(5, 7) + ' ' + (pg.criadoEm || '').slice(11, 16))}${pg.usuario ? ' · ' + esc(pg.usuario) : ''}</span></span><b class="mono" style="color: var(--okTxt)">${brl(pg.valor)}</b>${pg.origem === 'manual' ? `<button class="btn peq" style="background: transparent; color: var(--erroTxt)" data-estornar="${pg.id}">Estornar</button>` : ''}</div>`).join('') || '<span class="peq">Nenhum pagamento ainda.</span>'}
            <div style="display: grid; grid-template-columns: 92px minmax(0, 1fr) 92px; gap: 6px; padding-top: 8px; border-top: 1px solid var(--linha)">
              <input class="entrada" style="height: 34px; font-size: 13px" type="number" min="0" step="0.01" placeholder="R$" aria-label="Valor recebido" data-reg="valor" value="${esc(estado.reg.valor)}">
              <select class="entrada" style="height: 34px; font-size: 12.5px; padding: 0 6px" aria-label="Quem pagou" data-reg="quem"><option value="">Grupo (responsável)</option>${g.pilotos.map((p) => `<option value="${p.id}" ${String(estado.reg.quem) === String(p.id) ? 'selected' : ''}>${esc(p.nome || 'Piloto ' + p.ordem)}</option>`).join('')}</select>
              <select class="entrada" style="height: 34px; font-size: 12.5px; padding: 0 6px" aria-label="Forma" data-reg="forma">${['Pix', 'Cartão', 'Dinheiro'].map((f) => `<option ${estado.reg.forma === f ? 'selected' : ''}>${f}</option>`).join('')}</select>
              <button class="btn escuro peq" style="grid-column: span 3; height: 34px" data-registrar="1">Registrar pagamento</button>
            </div></section>
          <section class="secao" style="padding: 14px 16px; gap: 10px"><span class="titulo" style="font-size: 15px">O que acontece sozinho</span>${integra.map(([t, d, st, ok, ic, cor]) => `<div style="display: flex; align-items: flex-start; gap: 10px"><span class="tile" style="width: 28px; height: 28px; border-radius: 8px; background: ${cor}">${svg(ic, 14, '#FFF')}</span><span class="col" style="gap: 1px; flex-grow: 1"><b>${t}</b><span class="peq" style="line-height: 1.4">${d}</span></span><span class="chip ${ok ? 'verde' : 'laranja'}">${st}</span></div>`).join('')}</section>` : ''}
        </div>
      </div>
      <div class="modalRodape">
        ${novo ? `<button type="button" role="switch" aria-checked="${estado.enviarAgora}" data-enviar-agora="1" style="display: flex; align-items: center; gap: 10px; padding: 0; border: 0; background: transparent; font-size: 13px; font-weight: 600; text-align: left"><span class="chave ${estado.enviarAgora ? 'on' : ''}"></span>Depois de salvar, já mostrar os links de cadastro para mandar no WhatsApp</button>` : `<button class="btn perigo peq" data-cancelar-grupo="1">Cancelar reserva</button>`}
        <span class="erroMsg" id="erroGrupo">${erroNovo}</span>
        <button class="btn sec" style="margin-left: auto; height: 40px" data-acao="fechar">${novo ? 'Cancelar' : 'Fechar'}</button>
        ${novo ? `<button class="btn prim" style="height: 40px" data-salvar-grupo="1" ${respOk ? '' : 'disabled'}>Salvar reserva de ${c.n} piloto${c.n > 1 ? 's' : ''}</button>` : ''}
      </div>`;
  }

  async function atualizar(promessa, msg) {
    try { estado.g = await promessa; pintar(); if (msg) toast(msg); estado.aoMudar && estado.aoMudar(); } catch (e) { falhou(e); }
  }

  function mostrarLinks(lista, titulo) {
    const el = $('#listaLinks'); if (!el) return;
    el.innerHTML = `<div style="padding: 12px 16px 14px; display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--linha); background: rgba(52,199,89,.05)"><b>${esc(titulo)}</b><span class="peq">Toque em cada um: abre o WhatsApp com a mensagem pronta.</span>${lista.map(([rot, href]) => `<a class="btn verdeClaro peq" style="justify-content: flex-start" target="_blank" rel="noopener" href="${esc(href)}">${svg(IC.zap, 13, '#1C6B35')} ${esc(rot)}</a>`).join('')}</div>`;
  }

  // ---------------------------------------------------------------- eventos da janela
  let tBusca;
  document.addEventListener('input', (e) => {
    if (!estado || !e.target.closest('#camada .modal')) return;
    const t = e.target;
    if (t.id === 'qResp') {
      estado.busca = t.value; clearTimeout(tBusca);
      const q = t.value.trim();
      tBusca = setTimeout(async () => {
        if (q.length < 2) { estado.achados = []; $('#achados').innerHTML = ''; return; }
        try { estado.achados = await office('/clientes?q=' + encodeURIComponent(q)); } catch (er) { estado.achados = []; }
        if (estado.busca.trim() !== q) return;
        pintar(); const i = $('#qResp'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
      }, 280);
      return;
    }
    if (t.dataset.reg) { estado.reg[t.dataset.reg] = t.value; return; }
    if (t.dataset.campo && !estado.g) { estado.rasc.pilotos[+t.dataset.i][t.dataset.campo] = t.value; }
  });
  document.addEventListener('change', async (e) => {
    if (!estado || !e.target.closest('#camada .modal')) return;
    const t = e.target;
    if (t.dataset.reg) { estado.reg[t.dataset.reg] = t.value; return; }
    if (t.dataset.preco) {
      const v = Math.round(parseFloat(String(t.value).replace(',', '.')) * 100);
      if (!(v > 0)) return toast('Preço inválido', true);
      if (estado.g) await atualizar(office(`/grupos/${estado.g.id}`, { method: 'PUT', body: { precoCentavos: v } }), 'Preço atualizado');
      else { estado.rasc.preco = v; pintar(); }
      return;
    }
    if (t.dataset.sinal) {
      const v = Math.max(0, Math.min(100, Math.round(+t.value || 0)));
      if (estado.g) await atualizar(office(`/grupos/${estado.g.id}`, { method: 'PUT', body: { sinalPct: v } }));
      else { estado.rasc.sinalPct = v; pintar(); }
      return;
    }
    if (t.dataset.campo && estado.g) {
      const p = estado.g.pilotos[+t.dataset.i]; if (!p || p.responsavel) return;
      const corpo = { nome: t.dataset.campo === 'nome' ? t.value : p.nome, telefone: t.dataset.campo === 'telefone' ? t.value : p.telefone, menor: p.menor };
      await atualizar(office(`/grupos/${estado.g.id}/pilotos/${p.id}`, { method: 'PUT', body: corpo }));
    }
  });
  document.addEventListener('click', async (e) => {
    if (!estado || !e.target.closest('#camada .modal')) return;
    const el = (s) => e.target.closest(s);
    const { g, rasc, b } = estado;
    let x;
    if ((x = el('[data-resp]'))) { rasc.responsavel = JSON.parse(x.dataset.resp); rasc.pilotos[0].nome = rasc.responsavel.nome; rasc.pilotos[0].telefone = rasc.responsavel.telefone || ''; estado.achados = []; estado.busca = ''; pintar(); return; }
    if ((x = el('[data-origem]'))) { rasc.origem = x.dataset.origem; pintar(); return; }
    if ((x = el('[data-enviar-agora]'))) { estado.enviarAgora = !estado.enviarAgora; pintar(); return; }
    if ((x = el('[data-modo]'))) { if (g) await atualizar(office(`/grupos/${g.id}`, { method: 'PUT', body: { modo: x.dataset.modo } }), 'Forma de pagamento atualizada'); else { rasc.modo = x.dataset.modo; pintar(); } return; }
    if ((x = el('[data-menor]'))) {
      const i = +x.dataset.menor;
      if (g) { const p = g.pilotos[i]; await atualizar(office(`/grupos/${g.id}/pilotos/${p.id}`, { method: 'PUT', body: { nome: p.nome, telefone: p.telefone, menor: !p.menor } })); }
      else { rasc.pilotos[i].menor = !rasc.pilotos[i].menor; pintar(); }
      return;
    }
    if ((x = el('[data-qtd]'))) {
      const d = +x.dataset.qtd;
      if (g) {
        if (d > 0) await atualizar(office(`/grupos/${g.id}/pilotos`, { method: 'POST', body: {} }), 'Piloto adicionado · 1 vaga a menos no site');
        else { const ult = g.pilotos[g.pilotos.length - 1]; if (ult && !ult.responsavel) { if (!confirm(`Tirar ${ult.nome || 'o piloto ' + ult.ordem} do grupo? A vaga volta para o site e o totem.`)) return; await atualizar(office(`/grupos/${g.id}/pilotos/${ult.id}`, { method: 'DELETE' }), 'Piloto tirado · vaga liberada'); } }
      } else {
        if (d > 0 && rasc.pilotos.length < +b.disponiveis) rasc.pilotos.push({ nome: '', telefone: '', menor: false });
        if (d < 0 && rasc.pilotos.length > 1) rasc.pilotos.pop();
        pintar();
      }
      return;
    }
    if ((x = el('[data-tirar]'))) {
      const i = +x.dataset.tirar;
      if (g) { const p = g.pilotos[i]; if (!confirm(`Tirar ${p.nome || 'o piloto ' + p.ordem} do grupo? A vaga volta para o site e o totem.`)) return; await atualizar(office(`/grupos/${g.id}/pilotos/${p.id}`, { method: 'DELETE' }), 'Piloto tirado · vaga liberada'); }
      else { rasc.pilotos.splice(i, 1); pintar(); }
      return;
    }
    if ((x = el('[data-link]'))) {
      const p = g.pilotos.find((y) => y.id === +x.dataset.link); const fone = destino(g, p);
      if (!fone) return toast('Coloque o WhatsApp do piloto (ou do responsável) primeiro.', true);
      window.open(zap(fone, msgCadastro(g, p)), '_blank', 'noopener');
      await atualizar(office(`/grupos/${g.id}/links`, { method: 'POST', body: { pilotoIds: [p.id] } }));
      return;
    }
    if (el('[data-links-todos]')) {
      const faltam = g.pilotos.filter((p) => p.cadastro !== 'completo' && destino(g, p));
      await atualizar(office(`/grupos/${g.id}/links`, { method: 'POST', body: { pilotoIds: faltam.map((p) => p.id) } }));
      mostrarLinks(faltam.map((p) => [`${p.nome || 'Piloto ' + p.ordem} · ${destino(g, p)}`, zap(destino(g, p), msgCadastro(g, p))]), 'Links de cadastro para mandar');
      return;
    }
    if ((x = el('[data-cobrar]'))) {
      const pid = x.dataset.cobrar ? +x.dataset.cobrar : null;
      x.disabled = true;
      try {
        const r = await office(`/grupos/${g.id}/cobrancas`, { method: 'POST', body: { pilotoId: pid } });
        estado.g = r.grupo; pintar();
        const p = pid ? estado.g.pilotos.find((y) => y.id === pid) : null;
        const fone = p ? destino(estado.g, p) : estado.g.responsavelTelefone;
        const texto = `Olá${p && p.nome ? ', ' + primeiro(p.nome) : ', ' + primeiro(estado.g.responsavel)}! Segue o link para pagar ${p ? 'sua vaga' : 'a reserva do grupo'} na bateria do Kartódromo de Betim (${quando(estado.g.inicio)}): ${brl(r.valor)} por Pix ou cartão — ${r.link}`;
        if (fone) mostrarLinks([[`Mandar o link de ${brl(r.valor)} para ${p ? (p.nome || 'piloto ' + p.ordem) : estado.g.responsavel}`, zap(fone, texto)]], 'Link de pagamento pronto (Asaas)');
        toast(r.reaproveitada ? 'Link de pagamento já existia · pode reenviar' : 'Link de pagamento criado no Asaas');
        estado.aoMudar && estado.aoMudar();
      } catch (er) { falhou(er); x.disabled = false; }
      return;
    }
    if ((x = el('[data-recebi]'))) {
      const pid = x.dataset.recebi ? +x.dataset.recebi : null;
      const p = pid ? g.pilotos.find((y) => y.id === pid) : null;
      const valor = p ? p.falta_centavos : (g.modo === 'sinal' && g.pago < g.sinal ? g.sinal - g.pago : g.falta);
      const forma = prompt(`Recebeu ${brl(valor)} de ${p ? (p.nome || 'piloto ' + p.ordem) : g.responsavel}? Forma (Pix, Cartão ou Dinheiro):`, 'Pix');
      if (!forma) return;
      await atualizar(office(`/grupos/${g.id}/pagamentos`, { method: 'POST', body: { pilotoId: pid, valorCentavos: valor, forma: forma.trim() } }), `${brl(valor)} registrado · aparece pago na Recepção`);
      return;
    }
    if (el('[data-registrar]')) {
      const v = Math.round(parseFloat(String(estado.reg.valor).replace(',', '.')) * 100);
      if (!(v > 0)) return toast('Digite o valor recebido', true);
      await atualizar(office(`/grupos/${g.id}/pagamentos`, { method: 'POST', body: { pilotoId: estado.reg.quem ? +estado.reg.quem : null, valorCentavos: v, forma: estado.reg.forma } }), `${brl(v)} registrado`);
      estado.reg = { valor: '', quem: '', forma: 'Pix' }; pintar();
      return;
    }
    if ((x = el('[data-estornar]'))) {
      if (!confirm('Estornar este pagamento? A vaga volta a ficar a pagar.')) return;
      await atualizar(office(`/grupos/${g.id}/pagamentos/${x.dataset.estornar}`, { method: 'DELETE' }), 'Pagamento estornado');
      return;
    }
    if (el('[data-cancelar-grupo]')) {
      if (!confirm(`Cancelar a reserva de ${g.responsavel} (${g.n} vagas)? As vagas voltam para o site e o totem.`)) return;
      try { await office(`/grupos/${g.id}`, { method: 'DELETE' }); toast('Reserva cancelada · vagas liberadas'); fecharCamada(); estado.aoMudar && estado.aoMudar(); estado = null; } catch (er) { falhou(er); }
      return;
    }
    if ((x = el('[data-salvar-grupo]'))) {
      if (!rasc.responsavel) return;
      x.disabled = true; x.textContent = 'Salvando…';
      try {
        const pilotos = rasc.pilotos.map((p, i) => (i === 0 ? { nome: rasc.responsavel.nome, telefone: rasc.responsavel.telefone, menor: false } : p));
        const novo = await office('/grupos', { method: 'POST', body: { bateriaId: b.id, responsavelId: rasc.responsavel.id, origem: rasc.origem, modo: rasc.modo, precoCentavos: rasc.preco, sinalPct: rasc.sinalPct, pilotos } });
        estado.g = novo; estado.rasc = null;
        toast(`Reserva de ${novo.n} piloto(s) salva · já aparece na Recepção, no site e no totem`);
        pintar();
        estado.aoMudar && estado.aoMudar();
        if (estado.enviarAgora) {
          const com = novo.pilotos.filter((p) => p.cadastro !== 'completo' && destino(novo, p));
          if (com.length) {
            await office(`/grupos/${novo.id}/links`, { method: 'POST', body: { pilotoIds: com.map((p) => p.id) } }).then((r) => { estado.g = r; pintar(); }).catch(() => {});
            mostrarLinks(com.map((p) => [`${p.nome || 'Piloto ' + p.ordem} · ${destino(novo, p)}`, zap(destino(novo, p), msgCadastro(novo, p))]), 'Links de cadastro para mandar agora');
          }
        }
      } catch (er) { const m = $('#erroGrupo'); if (m) m.textContent = er.message; x.disabled = false; x.textContent = 'Salvar reserva'; }
    }
  });

  return { cartoes, abrir, nova };
})();
