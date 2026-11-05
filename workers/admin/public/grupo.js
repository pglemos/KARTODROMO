'use strict';
/* Reserva em grupo (Agenda): cada piloto com nome, WhatsApp e link de cadastro, pagamento de cada um e Pix do Asaas.
   Usa as rotas /api/office/grupos… do servidor da operação (SRVKART). Depende de app.js (carregado antes). */

const Grupo = (() => {
  const MODOS = [
    ['unico', 'O responsável paga tudo', 'Um link Asaas com o valor do grupo inteiro.'],
    ['individual', 'Cada um paga o seu', 'Cada piloto recebe o próprio link de pagamento.'],
    ['sinal', 'Sinal agora, resto na recepção', 'O responsável paga uma parte e cada um acerta o resto ao chegar.'],
  ];
  const ORIGENS = [['whatsapp', 'WhatsApp'], ['instagram', 'Instagram'], ['telefone', 'Telefone'], ['site', 'Site'], ['recepcao', 'Recepção']];
  // pagamento antecipado (WhatsApp, Instagram, telefone, site) = R$ 145; no balcão vale o preço da bateria (R$ 175)
  const PRECO_ANTECIPADO = 14500;
  const lembrado = (k, validos, padrao) => { try { const v = localStorage.getItem('kib-grupo-' + k); return validos.includes(v) ? v : padrao; } catch (e) { return padrao; } };
  const lembrar = (k, v) => { try { localStorage.setItem('kib-grupo-' + k, v); } catch (e) { /* sem armazenamento: segue sem lembrar */ } };
  const precoPara = (origem, b) => (origem === 'recepcao' ? (+b.preco || PRECO_ANTECIPADO) : PRECO_ANTECIPADO);
  // o que falta no responsável (texto exato para quem está ao telefone); '' = tudo certo
  const faltaResp = (r) => {
    if (r.responsavel) return '';
    const nome = String(r.pilotos[0].nome || '').trim().split(/\s+/).filter(Boolean), tel = String(r.pilotos[0].telefone || '').replace(/\D/g, '');
    if (!nome.length) return 'Falta o nome do responsável (ou busque um cliente já cadastrado).';
    if (nome.length < 2) return 'Falta o sobrenome do responsável.';
    if (tel.length < 10) return 'Falta o WhatsApp do responsável, com DDD.';
    return '';
  };
  const respValido = (r) => !!r.responsavel || (String(r.pilotos[0].nome || '').trim().split(/\s+/).filter(Boolean).length >= 2 && String(r.pilotos[0].telefone || '').replace(/\D/g, '').length >= 10);
  const quando = (inicio) => { const d = deIso(inicio); return `${DIAS[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${horaDe(inicio)}`; };
  const primeiro = (n) => String(n || '').trim().split(/\s+/)[0] || '';
  const chipCad = (p) => ({ completo: ['verde', 'Pronto para o totem'], incompleto: ['laranja', 'Falta ' + (p.falta || []).join(', ')], enviado: ['laranja', 'Aguardando cadastro'], pendente: ['cinza', 'Aguardando cadastro'] }[p.cadastro] || ['cinza', p.cadastro]);

  function msgCadastro(g, p) {
    return `Olá${p.nome ? ', ' + primeiro(p.nome) : ''}! Sua vaga na bateria do Kartódromo de Betim (${quando(g.inicio)}) já está guardada na reserva de ${primeiro(g.responsavel)}. Faça seu cadastro (1 minuto): ${p.link} — no dia é só digitar o CPF no totem.`;
  }
  const faltamLista = (g) => g.pilotos.filter((p) => p.cadastro !== 'completo').map((p) => p.id);
  const linkDoGrupo = (g) => { const r = (g.pilotos || []).find((p) => p.responsavel) || (g.pilotos || [])[0]; return r ? r.link : ''; };
  function msgGrupo(g) {
    return `Olá! Vamos correr no Kartódromo de Betim (${quando(g.inicio)}) na reserva de ${primeiro(g.responsavel)}. Cada pessoa faz o próprio cadastro${g.modo === 'individual' ? ' completo e paga a sua vaga no final (Pix ou cartão)' : ' (1 minuto)'} neste link: ${linkDoGrupo(g)} — o mesmo link serve para todo o grupo. No dia é só digitar o CPF no totem.`;
  }
  async function copiar(texto, msg) {
    try { await navigator.clipboard.writeText(texto); toast(msg); }
    catch { const t = document.createElement('textarea'); t.value = texto; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); toast(msg); } catch { toast('Não deu para copiar. Selecione o texto e copie.', true); } t.remove(); }
  }
  function destino(g, p) { return p.telefone || g.responsavelTelefone || ''; }

  // ---------------------------------------------------------------- cartões na gaveta da bateria
  function cartoes(grupos) {
    return grupos.map((g, gi) => {
      const cor = CORG[gi % 6];
      const rostos = g.pilotos.map((p) => { const ok = p.pago && p.cadastro === 'completo', meio = p.pago || p.cadastro === 'completo'; return `<span title="${esc((p.nome || 'Piloto ' + p.ordem) + ' · ' + (p.cadastro === 'completo' ? 'cadastro ok' : 'falta cadastro') + ' · ' + (p.pago ? 'pago' : 'falta pagar'))}" style="width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: var(--kib-fonte-tamanho-pequeno); font-weight: 700; ${ok ? 'background: var(--kib-cor-status-ok); color: var(--kib-cor-acao-sobre-principal)' : meio ? 'background: var(--kib-cor-estado-aviso-fundo); color: var(--kib-cor-agenda-reserva-topo-texto)' : 'background: var(--kib-cor-borda-sutil); color: var(--kib-cor-texto-apoio)'}">${esc(p.nome ? iniciais(p.nome) : String(p.ordem))}</span>`; }).join('');
      const pct = g.total ? Math.round(g.pago / g.total * 100) : 100;
      return `<div style="display: flex; flex-direction: column; gap: var(--kib-espaco-1); padding: var(--kib-espaco-denso-12); border-radius: var(--kib-raio-cartao); background: var(--sup2); box-shadow: inset 0 0 0 1px var(--linha)">
        <span class="linha gap-1"><span class="avatar m" style="background: ${cor}">${esc(iniciais(g.responsavel))}</span><span class="col cresce"><b>${esc(g.responsavel)}${g.n > 1 ? ` e mais ${g.n - 1}` : ''}</b><span class="peq">${g.n} piloto(s) · ${esc({ unico: 'responsável paga tudo', individual: 'cada um paga o seu', sinal: 'sinal + resto na recepção' }[g.modo])} · ${esc(g.codigo)}</span></span></span>
        <span class="linha-quebra gap-meio">${rostos}</span>
        <span style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--kib-espaco-1)">
          <span class="col gap-meio"><span style="display: flex; font-size: var(--kib-fonte-tamanho-pequeno)"><span class="peq">Cadastros</span><b class="empurra">${g.cadastrados} de ${g.n}</b></span><span class="barra" style="height: 5px"><span style="width: ${Math.round(g.cadastrados / Math.max(1, g.n) * 100)}%; background: ${g.cadastrados === g.n ? 'var(--kib-cor-status-ok)' : 'var(--kib-cor-estado-aviso-solido)'}"></span></span></span>
          <span class="col gap-meio"><span style="display: flex; font-size: var(--kib-fonte-tamanho-pequeno)"><span class="peq">Pago</span><b class="empurra">${brlCurto(g.pago)} de ${brlCurto(g.total)}</b></span><span class="barra" style="height: 5px"><span style="width: ${pct}%; background: ${g.falta ? 'var(--kib-cor-estado-aviso-solido)' : 'var(--kib-cor-status-ok)'}"></span></span></span>
        </span>
        <span class="linha-quebra gap-meio"><button class="btn escuro peq" data-grupo-abrir="${g.id}">Abrir reserva</button>${g.falta || g.cadastrados < g.n ? `<button class="btn verdeClaro peq" data-grupo-abrir="${g.id}">Cobrar e mandar links</button>` : ''}</span>
      </div>`;
    }).join('');
  }

  // ---------------------------------------------------------------- janela "Reserva do grupo"
  let estado = null; // { b, g (do servidor) | null, rasc (nova), aoMudar }

  async function abrir(grupoId, b, aoMudar) {
    estado = { b, g: null, rasc: null, aoMudar, reg: { valor: '', quem: '', forma: 'Pix' } };
    modal('<div class="esqueleto" style="height: 420px; margin: var(--kib-espaco-denso-20)"></div>').style.maxWidth = '1140px';
    try { estado.g = await office(`/grupos/${grupoId}`); pintar(); } catch (e) { falhou(e); fecharCamada(); }
  }

  // rascunho da reserva nova: sobrevive a recarregar a página (sessionStorage, por bateria); some ao salvar ou descartar
  const chaveRasc = (b) => 'kib-rasc-' + b.id;
  function lerRascunho(b) {
    try { const r = JSON.parse(sessionStorage.getItem(chaveRasc(b)) || 'null'); return r && Array.isArray(r.pilotos) && r.pilotos.length ? r : null; } catch { return null; }
  }
  function guardarRascunho(apagar) {
    if (!estado || estado.g) return;
    try { if (apagar || !sujo()) sessionStorage.removeItem(chaveRasc(estado.b)); else sessionStorage.setItem(chaveRasc(estado.b), JSON.stringify(estado.rasc)); } catch { /* sem armazenamento: segue sem rascunho */ }
  }

  function nova(b, aoMudar, qtd, voltar, rascAnt) {
    let recuperado = false;
    if (!rascAnt) { rascAnt = lerRascunho(b); recuperado = !!rascAnt; if (rascAnt) qtd = rascAnt.pilotos.length; }
    const n = Math.min(qtd || 2, Math.max(1, +b.disponiveis || 1));
    estado = {
      b, g: null, aoMudar, voltar, reg: { valor: '', quem: '', forma: 'Pix' }, enviarAgora: true, busca: '', achados: [],
      rasc: rascAnt ? { ...rascAnt, pilotos: Array.from({ length: n }, (_, i) => rascAnt.pilotos[i] || { nome: '', telefone: '', menor: false }) } : { responsavel: null, origem: lembrado('origem', ORIGENS.map((o) => o[0]), 'whatsapp'), modo: lembrado('modo', MODOS.map((m) => m[0]), 'individual'), preco: precoPara(lembrado('origem', ORIGENS.map((o) => o[0]), 'whatsapp'), b), precoManual: false, sinalPct: 30, pilotos: Array.from({ length: n }, () => ({ nome: '', telefone: '', menor: false })) },
    };
    modal('', 'Nova reserva').style.maxWidth = '1140px';
    pintar();
    if (recuperado) toast('Recuperei o que você tinha digitado nesta reserva');
    setTimeout(() => { const c = document.querySelector('#camada [data-campo="nome"][data-i="0"]') || document.getElementById('qResp'); if (c) c.focus(); }, 60);
  }
  // há algo digitado que se perderia ao fechar? (só vale para reserva nova ainda não salva)
  const sujo = () => !!(estado && !estado.g && estado.rasc && (estado.rasc.responsavel || estado.rasc.pilotos.some((p) => (p.nome || '').trim() || (p.telefone || '').trim())));

  // valores de cada piloto numa reserva ainda não salva (mesma conta do servidor)
  function contaRascunho(r) {
    const n = r.pilotos.length, total = n * (+r.preco || 0);
    return { n, total, pago: 0, falta: total, pagos: 0, cadastrados: 0, sinal: Math.round(total * r.sinalPct / 100) };
  }

  function pintar() {
    const m = $('#camada .modal'); if (!m || !estado) return;
    guardarRascunho();
    const { b, g, rasc } = estado;
    const novo = !g;
    const T = TIPOS[b.reservaFechada ? 'fechada' : 'reserva'];
    const c = novo ? contaRascunho(rasc) : g;
    const modo = novo ? rasc.modo : g.modo;
    const preco = novo ? rasc.preco : g.preco;
    const sinalPct = novo ? rasc.sinalPct : g.sinalPct;
    const max = b.reservaFechada ? Math.max(12, +b.vagas || 12) : (novo ? +b.disponiveis : (+b.disponiveis || 0) + g.n);
    const pilotos = novo ? rasc.pilotos.map((p, i) => ({ ...p, ordem: i + 1, responsavel: i === 0 })) : g.pilotos;
    const titulo = novo ? 'Quem vai correr?' : `${esc(nomeBonito(g.responsavel))}${g.n > 1 ? ' e mais ' + (g.n - 1) : ''}`;
    const linhas = pilotos.map((p, i) => {
      const resp = i === 0;
      const respExistente = resp && novo && !!rasc.responsavel;
      const nomeVal = respExistente ? rasc.responsavel.nome : (p.nome || '');
      const foneVal = respExistente ? (rasc.responsavel.telefone || '') : (p.telefone || '');
      let cad = ['cinza', 'Link será gerado ao salvar'], pg = ['cinza', brl(preco)], acoesCad = '', acoesPg = '';
      if (!novo) {
        cad = chipCad(p);
        if (modo === 'unico') { pg = p.pago ? ['verde', 'Pago pelo grupo'] : resp ? ['laranja', 'Paga o grupo · falta ' + brlCurto(g.falta)] : ['cinza', 'Responsável paga']; }
        else if (modo === 'sinal') { pg = p.pago ? ['verde', p.pagoNoCaixa ? 'Pago no caixa' : 'Pago'] : ['laranja', 'Resto ' + brlCurto(p.falta_centavos) + ' na recepção']; }
        else { pg = p.pago ? ['verde', p.pagoNoCaixa ? 'Pago no caixa' : 'Pago'] : p.valorPago > 0 ? ['laranja', `Pagou ${brlCurto(p.valorPago)} · falta ${brlCurto(p.falta_centavos)}`] : ['vermelho', 'Falta ' + brlCurto(p.falta_centavos)]; }
        if (!p.pago && (modo !== 'unico' || resp)) acoesPg = `<details class="menuCobrar"><summary class="btn peq prim" aria-haspopup="true" aria-expanded="false">Cobrar</summary><div class="menuCobrarLista" role="group" aria-label="Como cobrar ${esc(nomeVal || 'piloto ' + (i + 1))}"><button type="button" class="btn peq" data-cobrar="${modo === 'unico' ? '' : p.id}" title="Gera o link Asaas (Pix ou cartão) e abre o WhatsApp para enviar">Enviar link de pagamento</button><button type="button" class="btn peq" data-recebi="${modo === 'unico' ? '' : p.id}" title="O cliente já pagou por fora (Pix direto, dinheiro, maquininha)">Marcar como pago</button></div></details>`;
      }
      const okVerde = !novo && p.pago && p.cadastro === 'completo';
      return `<div style="display: grid; grid-template-columns: 34px minmax(150px, 1.5fr) minmax(130px, 1.1fr) 74px 150px minmax(150px, 170px) 30px; gap: var(--kib-espaco-1); align-items: center; min-height: 62px; padding: var(--kib-espaco-meio) var(--kib-espaco-2); border-top: 1px solid color-mix(in srgb, var(--kib-cor-texto-principal) 5%, transparent); ${resp ? 'background: color-mix(in srgb, var(--kib-cor-marca-principal) 3.5%, transparent)' : ''}">
        <span class="avatar m" style="background: ${okVerde ? 'var(--kib-cor-estado-sucesso-texto)' : CORG[i % 6]}">${esc(nomeVal ? iniciais(nomeVal) : String(i + 1))}</span>
        <span class="col gap-meio">${respExistente ? `<span class="entrada" style="height: 34px; display: block; line-height: 32px; font-size: var(--kib-fonte-tamanho-corpo); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; ${nomeVal ? '' : 'color: var(--mudo2)'}">${esc(nomeVal || 'Escolha o responsável')}</span>` : `<input class="entrada" style="height: 34px; font-size: var(--kib-fonte-tamanho-corpo)" value="${esc(nomeVal)}" placeholder="${resp ? 'Nome e sobrenome do responsável' : 'Nome (ou deixe para o link)'}" aria-label="Nome do piloto ${i + 1}" title="${esc(nomeVal)}" aria-describedby="erroGrupo" data-campo="nome" data-i="${i}" ${!novo && resp ? 'readonly' : ''}>`}${resp ? `<span class="linha gap-1"><span class="chip ${nomeVal ? 'verde' : 'cinza sem-sinal'}" style="align-self: flex-start; font-size: var(--kib-fonte-tamanho-pequeno); padding: 1px var(--kib-espaco-1)">RESPONSÁVEL</span>${respExistente ? '<span class="peq cor-apoio">cliente já cadastrado</span><button type="button" class="btn link peq" data-trocar-resp="1">Trocar</button>' : novo ? '<span class="peq cor-apoio">cliente novo: só nome e WhatsApp</span>' : ''}</span>` : ''}</span>
        ${respExistente ? `<span class="mono peq">${esc(foneVal || '—')}</span>` : `<input class="entrada mono" style="height: 34px; font-size: var(--kib-fonte-tamanho-pequeno)" value="${esc(foneVal)}" placeholder="(31) 9 0000-0000" inputmode="tel" aria-label="WhatsApp do piloto ${i + 1}" aria-describedby="erroGrupo" data-campo="telefone" data-i="${i}" ${!novo && resp ? 'readonly' : ''}>`}
        <button class="btn peq" role="switch" aria-checked="${!!p.menor}" data-menor="${i}" style="height: 30px; ${p.menor ? 'background: color-mix(in srgb, var(--kib-cor-categoria-roxo-base) 14%, transparent); color: var(--kib-cor-categoria-roxo-texto)' : 'background: color-mix(in srgb, var(--kib-cor-texto-discreto) 10%, transparent); color: var(--mudo)'}">${p.menor ? 'Menor' : 'Adulto'}</button>
        <span class="col" style="gap: var(--kib-espaco-meio); align-items: flex-start"><span class="chip ${cad[0]} quebra">${esc(cad[1])}</span>${acoesCad}</span>
        <span class="col" style="gap: var(--kib-espaco-meio); align-items: flex-start"><span class="chip ${pg[0]} quebra">${esc(pg[1])}</span>${acoesPg}</span>
        ${resp ? '<span></span>' : `<button class="btn peq hov" style="width: 28px; padding: 0; background: transparent" aria-label="Tirar o piloto ${i + 1}" data-tirar="${i}">${svg(IC.fechar, 13, 'var(--kib-cor-icone-suave)', 2.4)}</button>`}
      </div>`;
    }).join('');
    const pagamentos = novo ? [] : g.pagamentos.slice().reverse();
    const nomeDe = (pid) => { const p = g && g.pilotos.find((x) => x.id === pid); return p ? (p.nome || 'Piloto ' + p.ordem) : 'Grupo · ' + (g ? g.responsavel : ''); };
    const integra = novo ? [] : [
      ['Totem', 'Quem está com o cadastro pronto só digita o CPF e confirma o peso e o termo.', `${g.cadastrados}/${g.n} prontos`, g.cadastrados === g.n, IC.totem, G('var(--kib-cor-categoria-azul-topo)', 'var(--kib-cor-estado-info-solido)')],
      ['Asaas', 'Pix e cartão. Quando o pagamento cai, a reserva se atualiza sozinha (a cada minuto).', `${g.pagos}/${g.n} pagos`, !g.falta, 'M12 3v18M17 7H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H6', G('var(--kib-cor-categoria-azul-escuro-topo)', 'var(--kib-cor-estado-info-texto)')],
      ['Recepção', `O grupo aparece na bateria das ${horaDe(g.inicio)} e quem está pago já sai pago no caixa.`, g.falta ? 'cobrar ' + brlCurto(g.falta) : 'nada a cobrar', !g.falta, IC.recepcao, G('var(--kib-cor-categoria-verde-topo)', 'var(--kib-cor-categoria-verde-base)')],
      ['Sorteio de karts', 'Quem tem cadastro e pagamento em dia entra direto no sorteio.', `${g.prontos}/${g.n} liberados`, g.prontos === g.n, IC.sorteio, G('var(--kib-cor-categoria-roxo-topo)', 'var(--kib-cor-categoria-roxo-base)')],
      ['Cronometragem', 'Os nomes vão para o placar e o resultado chega no e-mail de cada piloto.', `${g.pilotos.filter((p) => p.nome).length}/${g.n} nomes`, g.pilotos.every((p) => p.nome), IC.crono, G('var(--kib-cor-categoria-vermelho-topo)', 'var(--kib-cor-estado-perigo-solido)')],
    ];
    const faltamCad = novo ? [] : g.pilotos.filter((p) => p.cadastro !== 'completo');
    const blocoLinks = novo ? '' : `<div style="padding: var(--kib-espaco-denso-12) var(--kib-espaco-2); border-top: 1px solid var(--linha); display: flex; flex-direction: column; gap: var(--kib-espaco-1)">
      <span class="linha gap-1"><b class="t-corpo">Link de cadastro do grupo</b><span class="chip ${faltamCad.length ? 'laranja' : 'verde'} empurra">${faltamCad.length ? `faltam ${faltamCad.length} de ${g.n}` : 'todos cadastrados'}</span></span>
      <div class="linha-quebra gap-1" style="align-items: center"><input class="entrada peq mono cresce" style="flex: 1 1 280px; min-width: 0" readonly value="${esc(linkDoGrupo(g))}" aria-label="Link de cadastro do grupo" onfocus="this.select()"><button class="btn peq sec" data-copiar-links="1">Copiar</button><button class="btn peq verdeClaro" data-enviar-grupo="1">Enviar no WhatsApp</button></div>
      <span class="peq cor-apoio" style="line-height: 1.4">Mande o mesmo link para todo mundo (grupo de WhatsApp, por exemplo). Quem abrir e se cadastrar ocupa a próxima vaga livre${faltamCad.length ? ': ainda faltam ' + esc(faltamCad.map((p) => p.nome || 'piloto ' + p.ordem).join(', ')) : ''}.</span>
    </div>`;
    const respOk = novo ? respValido(rasc) : true;
    const erroNovo = novo ? faltaResp(rasc) : '';
    const ajudaSalvar = novo && erroNovo && !estado.tentou ? 'Para salvar: ' + erroNovo.replace(/^Falta /, 'falta ') : '';
    m.style.maxWidth = 'min(1360px, calc(100% - 32px))';
    m.setAttribute('aria-label', novo ? 'Nova reserva' : 'Reserva ' + g.codigo);
    m.innerHTML = `
      <div class="modalTopo" style="${T.topo}"><span class="col" style="gap: var(--kib-espaco-meio); min-width: 0"><span class="t-titulo-grande peso-negrito">${novo ? 'Nova reserva: quem vai correr?' : titulo}</span><span class="t-subtitulo peso-semibold" style="opacity: .9">${esc([novo ? '' : 'Reserva ' + g.codigo, quando(b.dataHora), b.nome].filter(Boolean).join(' · '))}${novo && estado.voltar ? ' <button type="button" class="btn link peq" data-voltar-horario="1">‹ Trocar horário</button>' : ''}</span></span>
        <span class="empurra"></span>
        <button class="fechar hov" style="position: static" data-acao="fechar" aria-label="Fechar">${svg(IC.fechar, 15, 'var(--kib-cor-texto-principal)', 2.4)}</button></div>
      <div style="display: flex; flex-wrap: wrap; gap: var(--kib-espaco-2); padding: var(--kib-espaco-2) var(--kib-espaco-2) var(--kib-espaco-2)">
        <div style="flex: 999 1 860px; min-width: 0; display: flex; flex-direction: column; gap: var(--kib-espaco-denso-12)"><section class="cartao leve">
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: var(--kib-espaco-1) var(--kib-espaco-denso-12); padding: var(--kib-espaco-denso-12) var(--kib-espaco-2) var(--kib-espaco-1)"><span class="col" style="gap: 2px; flex: 1 1 260px"><b class="t-subtitulo">Pilotos do grupo</b><span class="peq" style="line-height: 1.4">${novo ? 'Cliente novo? Na linha 1 coloque só nome completo e WhatsApp: o resto ele completa pelo link do grupo. Ajuste ao lado quantas pessoas vão correr (1 = só ele).' : `${g.cadastrados} de ${g.n} com cadastro pronto para o totem · ${g.pagos} de ${g.n} pagos`}</span></span>
            <span class="linha gap-1"><span class="peq peso-semibold">Quantos pilotos vão correr?</span><span class="passo"><button type="button" data-qtd="-1" aria-label="Um piloto a menos">−</button><span>${c.n}</span><button type="button" data-qtd="1" aria-label="Um piloto a mais" ${c.n >= max ? 'disabled' : ''}>+</button></span><span class="peq">até ${max}</span></span></div>
          ${novo ? `<div style="display: flex; flex-direction: column; gap: var(--kib-espaco-1); padding: 0 var(--kib-espaco-2) var(--kib-espaco-denso-12)">
            <label class="buscaCampo" style="height: 38px">${svg(IC.busca, 14, 'var(--kib-cor-borda-campo)')}<input id="qResp" value="${esc(estado.busca)}" placeholder="Já é cliente? Busque por nome, CPF ou telefone" autocomplete="off" aria-label="Buscar o responsável"></label>
            <div id="achados">${estado.achados.length ? `<div class="resultadoBusca">${estado.achados.slice(0, 10).map((x) => `<button type="button" class="hov" data-resp='${esc(JSON.stringify({ id: x.id, nome: x.nome, telefone: x.telefone, documento: x.documento }))}'><span class="avatar p" style="background: ${CORG[x.id % 6]}">${esc(iniciais(x.nome))}</span><span class="col"><b class="trunc">${esc(x.nome)}</b><span class="peq">${esc(x.documento || 'sem CPF')} · ${esc(x.telefone || 'sem telefone')}</span></span></button>`).join('')}</div>` : ''}</div>
            <span style="display: flex; flex-wrap: wrap; align-items: center; gap: var(--kib-espaco-1)"><span class="peq peso-semibold">Chegou por</span><span class="seg">${ORIGENS.map(([v, t]) => `<button type="button" data-origem="${v}" class="${rasc.origem === v ? 'sel' : ''}">${t}</button>`).join('')}</span><span class="peq">Não é cliente ainda? Sem problema: preencha nome e WhatsApp na linha 1.</span></span></div>` : ''}
          <div class="rolagemX"><div style="min-width: 860px"><div class="cabTabela" style="grid-template-columns: 34px minmax(150px, 1.5fr) minmax(130px, 1.1fr) 74px 150px minmax(150px, 170px) 30px; padding: 0 var(--kib-espaco-2)"><span></span><span>Nome</span><span>WhatsApp</span><span>Idade</span><span>Cadastro do totem</span><span>Pagamento</span><span></span></div>${linhas}</div></div>
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: var(--kib-espaco-1) var(--kib-espaco-denso-12); padding: var(--kib-espaco-denso-12) var(--kib-espaco-2); background: var(--sup2); border-top: 1px solid var(--linha)">
            <button class="btn branco peq" data-qtd="1" ${c.n >= max ? 'disabled' : ''}>+ Adicionar piloto</button>
            <span class="peq cresce" style="flex: 1 1 220px; line-height: 1.4">${novo ? 'Um link só para o grupo inteiro: aparece logo depois de salvar. Cada pessoa abre e se cadastra.' : 'Um link só para o grupo inteiro: cada pessoa que abrir ocupa uma vaga livre.'}</span>
          </div>
          ${blocoLinks}
          <div id="listaLinks"></div>
        </section>
          ${!novo ? `<section class="secao" style="padding: var(--kib-espaco-denso-12) var(--kib-espaco-2)"><span class="titulo t-subtitulo">Pagamentos recebidos<span class="peq" style="margin-left: auto; font-weight: 500">${pagamentos.length || ''}</span></span>
            ${pagamentos.map((pg) => `<div style="display: flex; align-items: center; gap: var(--kib-espaco-1); padding: var(--kib-espaco-1) 0; border-top: 1px solid var(--linha)"><span style="width: 28px; height: 28px; border-radius: var(--kib-raio-botao); display: flex; align-items: center; justify-content: center; color: var(--kib-cor-acao-sobre-principal); font-size: var(--kib-fonte-tamanho-pequeno); font-weight: 700; background: ${pg.pilotoId ? CORG[pg.pilotoId % 6] : 'var(--kib-cor-texto-principal)'}">${esc(pg.pilotoId ? iniciais(nomeDe(pg.pilotoId)) : 'G')}</span><span class="col cresce"><b class="trunc">${esc(nomeDe(pg.pilotoId))}</b><span class="peq">${esc(pg.forma)} · ${esc((pg.criadoEm || '').slice(8, 10) + '/' + (pg.criadoEm || '').slice(5, 7) + ' ' + (pg.criadoEm || '').slice(11, 16))}${pg.usuario ? ' · ' + esc(pg.usuario) : ''}</span></span><b class="mono cor-ok">${brl(pg.valor)}</b>${pg.origem === 'manual' ? `<button class="btn peq" style="background: transparent; color: var(--erroTxt)" data-estornar="${pg.id}">Estornar</button>` : ''}</div>`).join('') || '<span class="peq">Nenhum pagamento ainda.</span>'}
            ${g.falta && g.pilotos.filter((p) => !p.pago).length > 1 && modo === 'individual' ? '<button class="btn sec peq" data-todos-pagos="1" title="Registra de uma vez o pagamento de todos que faltam">Marcar todos como pagos</button>' : ''}
            <details class="maisOpcoes" ${estado.reg.valor ? 'open' : ''}><summary>Registrar outro valor recebido</summary>
            <div style="display: grid; grid-template-columns: 92px minmax(0, 1fr) 92px; gap: var(--kib-espaco-meio); padding-top: var(--kib-espaco-1)">
              <input class="entrada" style="height: 34px; font-size: var(--kib-fonte-tamanho-corpo)" type="number" min="0" step="0.01" placeholder="R$" aria-label="Valor recebido" data-reg="valor" value="${esc(estado.reg.valor)}">
              <select class="entrada" style="height: 34px; font-size: var(--kib-fonte-tamanho-pequeno); padding: 0 var(--kib-espaco-meio)" aria-label="Quem pagou" data-reg="quem"><option value="">Grupo (responsável)</option>${g.pilotos.map((p) => `<option value="${p.id}" ${String(estado.reg.quem) === String(p.id) ? 'selected' : ''}>${esc(p.nome || 'Piloto ' + p.ordem)}</option>`).join('')}</select>
              <select class="entrada" style="height: 34px; font-size: var(--kib-fonte-tamanho-pequeno); padding: 0 var(--kib-espaco-meio)" aria-label="Forma" data-reg="forma">${['Pix', 'Cartão', 'Dinheiro'].map((f) => `<option ${estado.reg.forma === f ? 'selected' : ''}>${f}</option>`).join('')}</select>
              <button class="btn escuro peq" style="grid-column: span 3; height: 34px" data-registrar="1">Registrar pagamento</button>
            </div></details></section>
          <details class="secao maisOpcoes"><summary class="titulo t-subtitulo">O que acontece sozinho (totem, Asaas, Recepção, sorteio e cronometragem)</summary>${integra.map(([t, d, st, ok, ic, cor]) => `<div style="display: flex; align-items: flex-start; gap: var(--kib-espaco-1)"><span class="tile" style="width: 28px; height: 28px; border-radius: var(--kib-raio-botao); background: ${cor}">${svg(ic, 14, 'var(--kib-cor-superficie-padrao)')}</span><span class="col" style="gap: 1px; flex-grow: 1"><b>${t}</b><span class="peq" style="line-height: 1.4">${d}</span></span><span class="chip ${ok ? 'verde' : 'laranja'}">${st}</span></div>`).join('')}</details>` : ''}
        </div>
        <div style="flex: 1 1 340px; min-width: 0; display: flex; flex-direction: column; gap: var(--kib-espaco-denso-12)">
          ${novo ? `<details class="secao maisOpcoes" data-det-pag="1" ${estado.pagAberto ? 'open' : ''}><summary class="titulo t-subtitulo">Como vai pagar: ${esc((MODOS.find((x) => x[0] === modo) || [])[1] || '')} · ${brl(preco)} por piloto · total ${brl(c.total)}</summary>` : ''}
          <section class="secao" style="padding: var(--kib-espaco-denso-12) var(--kib-espaco-2) var(--kib-espaco-2); gap: var(--kib-espaco-denso-12)"><span class="titulo t-subtitulo">Como o grupo vai pagar${dica("Escolha uma opção: o responsável paga tudo em um link; cada piloto paga o seu; ou o responsável paga um sinal agora e o resto é acertado na recepção.", "como o grupo vai pagar")}</span>
            <div role="radiogroup" style="display: flex; flex-direction: column; gap: var(--kib-espaco-meio)">${MODOS.map(([v, t, d]) => `<button type="button" role="radio" aria-checked="${modo === v}" data-modo="${v}" class="hov" style="display: flex; align-items: flex-start; gap: var(--kib-espaco-1); padding: var(--kib-espaco-1) var(--kib-espaco-denso-12); border: 0; border-radius: var(--kib-raio-cartao); text-align: left; ${modo === v ? 'background: color-mix(in srgb, var(--kib-cor-marca-principal) 7%, transparent); box-shadow: inset 0 0 0 1.5px var(--verde)' : 'background: var(--fundo)'}"><span style="width: 18px; height: 18px; margin-top: 1px; border-radius: 50%; flex-shrink: 0; ${modo === v ? 'border: 5px solid var(--verde); background: var(--kib-cor-superficie-padrao)' : 'border: 1.5px solid var(--kib-cor-borda-forte); background: var(--kib-cor-superficie-padrao)'}"></span><span class="col" style="gap: 2px"><b class="t-corpo">${t}</b><span class="peq" style="line-height: 1.4">${d}</span></span></button>`).join('')}</div>
            <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--kib-espaco-1)">
              <label class="campo"><span>Preço por piloto${novo ? (rasc.origem === 'recepcao' ? ' · balcão' : ' · antecipado') : ''}</span><span class="entrada" style="display: flex; align-items: center; gap: var(--kib-espaco-meio); height: 36px"><span class="peq">R$</span><input type="number" min="0" step="0.01" value="${(preco / 100).toFixed(2)}" data-preco="1" style="width: 100%; min-width: 0; border: 0; outline: none; background: transparent; font-size: var(--kib-fonte-tamanho-corpo); font-weight: 600"></span></label>
              ${modo === 'sinal' ? `<label class="campo"><span>Sinal agora</span><span class="entrada" style="display: flex; align-items: center; gap: var(--kib-espaco-meio); height: 36px"><input type="number" min="0" max="100" step="5" value="${sinalPct}" data-sinal="1" style="width: 100%; min-width: 0; border: 0; outline: none; background: transparent; font-size: var(--kib-fonte-tamanho-corpo); font-weight: 600"><span class="peq">%</span></span></label>` : `<span class="campo"><span>Total da reserva</span><span class="num" style="height: 36px; display: flex; align-items: center; font-size: var(--kib-fonte-tamanho-titulo); font-weight: 700">${brl(c.total)}</span></span>`}
            </div>
            <div style="display: flex; flex-direction: column; gap: var(--kib-espaco-1); padding: var(--kib-espaco-denso-12); border-radius: var(--kib-raio-cartao); background: var(--sup2); box-shadow: inset 0 0 0 1px var(--linha)">
              <span style="display: flex; align-items: baseline; flex-wrap: wrap; gap: var(--kib-espaco-meio) var(--kib-espaco-1)"><span class="num t-titulo-grande peso-negrito">${brl(c.pago)}</span><span class="peq">de ${brl(c.total)}</span><span class="chip ${novo ? 'cinza' : c.falta ? 'laranja' : 'verde'} empurra">${novo ? 'cobra depois de salvar' : c.falta ? 'falta ' + brl(c.falta) : 'tudo pago'}</span></span>
              <span style="display: flex; height: 8px; border-radius: var(--kib-raio-chip); overflow: hidden; gap: 2px; background: color-mix(in srgb, var(--kib-cor-texto-discreto) 14%, transparent)">${pilotos.map((p) => `<span style="flex: 1 1 0; ${!novo && p.pago ? 'background: var(--kib-cor-status-ok)' : !novo && p.valorPago > 0 ? `background: linear-gradient(90deg, var(--kib-cor-status-ok) ${Math.round(p.valorPago / Math.max(1, preco) * 100)}%, transparent 0)` : ''}"></span>`).join('')}</span>
              <span class="peq" style="line-height: 1.45; color: var(--tinta2)">${novo ? 'Os links de pagamento saem depois de salvar.' : g.falta ? (modo === 'unico' ? esc(g.responsavel) + ' paga pelo grupo.' : 'Falta pagar: ' + esc(g.pilotos.filter((p) => !p.pago).map((p) => p.nome || 'Piloto ' + p.ordem).join(', ')) + '.') : 'Todos pagos. O grupo entra liberado no sorteio.'}</span>
            </div>
            ${!novo ? `<div style="display: flex; flex-direction: column; gap: var(--kib-espaco-1); padding: var(--kib-espaco-denso-12); border-radius: var(--kib-raio-cartao); background: linear-gradient(135deg, color-mix(in srgb, var(--kib-cor-estado-info-solido) 8%, transparent), color-mix(in srgb, var(--kib-cor-marca-principal) 8%, transparent)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--kib-cor-estado-info-solido) 15%, transparent)">
              <span class="linha gap-1"><span style="width: 26px; height: 26px; border-radius: var(--kib-raio-botao); display: flex; align-items: center; justify-content: center; background: ${G('var(--kib-cor-categoria-azul-escuro-topo)', 'var(--kib-cor-estado-info-solido)')}; color: var(--kib-cor-acao-sobre-principal); font-size: var(--kib-fonte-tamanho-pequeno); font-weight: 800">A</span><b>Asaas · Pix e cartão</b><span class="chip ${!g.falta ? 'verde' : g.pago ? 'laranja' : 'azul'} empurra">${!g.falta ? 'Pago' : g.pago ? 'Parcial' : 'Aguardando'}</span></span>
              <span class="peq" style="line-height: 1.45; color: var(--tinta2)">${modo === 'individual' ? `Cada piloto paga a sua vaga (${brl(preco)}) no fim do cadastro pelo link do grupo. Se precisar, “Enviar link de pagamento” no piloto gera um link avulso.` : modo === 'sinal' ? `Link do sinal: ${brl(g.sinal)} (${sinalPct}%). O resto cada um paga na recepção.` : `Link do grupo inteiro: ${brl(g.falta)}.`}</span>
              ${modo !== 'individual' && g.falta ? `<button class="btn prim peq" data-cobrar="">Gerar e enviar link ao responsável</button>` : ''}
              ${g.cobrancaGrupo ? `<a class="mono peq trunc" target="_blank" rel="noopener" href="${esc(g.cobrancaGrupo.link)}" style="padding: var(--kib-espaco-1) var(--kib-espaco-1); border-radius: var(--kib-raio-botao); background: var(--kib-cor-superficie-padrao)">${esc(g.cobrancaGrupo.link)}</a>` : ''}
            </div>` : ''}
          </section>${novo ? '</details>' : ''}
        </div>
      </div>
      <div class="modalRodape">
        ${novo ? `<button type="button" role="switch" aria-checked="${estado.enviarAgora}" data-enviar-agora="1" style="display: flex; align-items: center; gap: var(--kib-espaco-1); padding: 0; border: 0; background: transparent; font-size: var(--kib-fonte-tamanho-corpo); font-weight: 600; text-align: left"><span class="chave ${estado.enviarAgora ? 'on' : ''}"></span>Depois de salvar, já mostrar o link de cadastro do grupo para mandar no WhatsApp</button>` : `<button class="btn perigo peq" data-cancelar-grupo="1">Cancelar reserva</button>`}
        <span class="${estado.tentou ? 'erroMsg' : 'ajuda-campo'} empurra" id="erroGrupo" role="alert">${estado.tentou ? erroNovo : ajudaSalvar}</span>
        <button class="btn sec" data-acao="fechar">${novo ? 'Cancelar' : 'Fechar'}</button>
        ${novo ? `<button class="btn prim ${respOk ? '' : 'quase'}" data-salvar-grupo="1" aria-describedby="erroGrupo" ${respOk ? '' : 'aria-disabled="true"'} title="Salvar (Ctrl+Enter)">Salvar reserva de ${c.n} piloto${c.n > 1 ? 's' : ''}</button>` : ''}
      </div>`;
  }

  async function atualizar(acao, msg) {
    try { estado.g = await acao(); pintar(); if (msg) toast(msg); estado.aoMudar && estado.aoMudar(); } catch (e) { falhou(e, () => atualizar(acao, msg)); }
  }

  function mostrarLinks(lista, titulo) {
    const el = $('#listaLinks'); if (!el) return;
    el.innerHTML = `<div style="padding: var(--kib-espaco-denso-12) var(--kib-espaco-2) var(--kib-espaco-denso-12); display: flex; flex-direction: column; gap: var(--kib-espaco-meio); border-top: 1px solid var(--linha); background: color-mix(in srgb, var(--kib-cor-status-ok) 5%, transparent)"><b>${esc(titulo)}</b><span class="peq">Toque em cada um: abre o WhatsApp com a mensagem pronta.</span>${lista.map(([rot, href]) => `<a class="btn verdeClaro peq" style="justify-content: flex-start" target="_blank" rel="noopener" href="${esc(href)}">${svg(IC.zap, 13, 'var(--kib-cor-estado-sucesso-texto)')} ${esc(rot)}</a>`).join('')}</div>`;
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
    if (t.dataset.campo && !estado.g) {
      estado.rasc.pilotos[+t.dataset.i][t.dataset.campo] = t.value;
      guardarRascunho();
      const er = $('#erroGrupo'), f = faltaResp(estado.rasc);
      if (er) er.textContent = estado.tentou ? f : (f ? 'Para salvar: ' + f.replace(/^Falta /, 'falta ') : '');
      if (t.getAttribute('aria-invalid')) t.removeAttribute('aria-invalid');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { const m = document.querySelector('#camada details.menuCobrar[open], #camada details.menuMais[open]'); if (m) { m.removeAttribute('open'); const sm = m.querySelector('summary'); if (sm) sm.focus(); e.stopPropagation(); } }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
      const t = e.target; if (t && t.closest && t.closest('input, textarea, select, [contenteditable]')) return;
      const d = document.querySelector('.toast button'); if (d && /desfazer/i.test(d.textContent)) { e.preventDefault(); d.click(); }
    }
  }, true);
  document.addEventListener('keydown', (e) => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || !estado || estado.g || !e.target.closest || !e.target.closest('#camada .modal')) return;
    const bt = $('#camada [data-qtd="' + (e.key === 'ArrowUp' ? 1 : -1) + '"]'); if (bt && !bt.disabled) { e.preventDefault(); bt.click(); setTimeout(() => { const f = $('#camada [data-qtd="' + (e.key === 'ArrowUp' ? 1 : -1) + '"]') || $('#camada [data-qtd]'); if (f) f.focus(); }, 0); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey) || !estado || estado.g || !e.target.closest || !e.target.closest('#camada .modal')) return;
    const bt = $('#camada [data-salvar-grupo]'); if (bt && !bt.disabled) { e.preventDefault(); bt.click(); }
  });
  document.addEventListener('toggle', (e) => { if (estado && e.target.dataset && e.target.dataset.detPag) estado.pagAberto = e.target.open; if (e.target.classList && e.target.classList.contains('menuCobrar')) { const sm = e.target.querySelector('summary'); if (sm) sm.setAttribute('aria-expanded', String(e.target.open)); } }, true);
  document.addEventListener('change', async (e) => {
    if (!estado || !e.target.closest('#camada .modal')) return;
    const t = e.target;
    if (t.dataset.reg) { estado.reg[t.dataset.reg] = t.value; return; }
    if (t.dataset.preco) {
      const v = Math.round(parseFloat(String(t.value).replace(',', '.')) * 100);
      if (!(v > 0)) return toast('Preço inválido', true);
      if (estado.g) await atualizar(() => office(`/grupos/${estado.g.id}`, { method: 'PUT', body: { precoCentavos: v } }), 'Preço atualizado');
      else { estado.rasc.preco = v; estado.rasc.precoManual = true; pintar(); }
      return;
    }
    if (t.dataset.sinal) {
      const v = Math.max(0, Math.min(100, Math.round(+t.value || 0)));
      if (estado.g) await atualizar(() => office(`/grupos/${estado.g.id}`, { method: 'PUT', body: { sinalPct: v } }));
      else { estado.rasc.sinalPct = v; pintar(); }
      return;
    }
    if (t.dataset.campo && estado.g) {
      const p = estado.g.pilotos[+t.dataset.i]; if (!p || p.responsavel) return;
      const corpo = { nome: t.dataset.campo === 'nome' ? t.value : p.nome, telefone: t.dataset.campo === 'telefone' ? t.value : p.telefone, menor: p.menor };
      await atualizar(() => office(`/grupos/${estado.g.id}/pilotos/${p.id}`, { method: 'PUT', body: corpo }));
    }
  });
  document.addEventListener('click', async (e) => {
    if (!estado || !e.target.closest('#camada .modal')) return;
    const el = (s) => e.target.closest(s);
    const { g, rasc, b } = estado;
    let x;
    if ((x = el('[data-resp]'))) { rasc.responsavel = JSON.parse(x.dataset.resp); rasc.pilotos[0].nome = rasc.responsavel.nome; rasc.pilotos[0].telefone = rasc.responsavel.telefone || ''; estado.achados = []; estado.busca = ''; pintar(); return; }
    if ((x = el('[data-origem]'))) { rasc.origem = x.dataset.origem; lembrar('origem', rasc.origem); if (!rasc.precoManual) rasc.preco = precoPara(rasc.origem, estado.b); pintar(); return; }
    if (el('[data-trocar-resp]')) { rasc.responsavel = null; rasc.pilotos[0].nome = ''; rasc.pilotos[0].telefone = ''; pintar(); return; }
    if ((x = el('[data-enviar-agora]'))) { estado.enviarAgora = !estado.enviarAgora; pintar(); return; }
    if ((x = el('[data-modo]'))) { if (g) await atualizar(() => office(`/grupos/${g.id}`, { method: 'PUT', body: { modo: x.dataset.modo } }), 'Forma de pagamento atualizada'); else { rasc.modo = x.dataset.modo; lembrar('modo', rasc.modo); pintar(); } return; }
    if ((x = el('[data-menor]'))) {
      const i = +x.dataset.menor;
      if (g) { const p = g.pilotos[i]; await atualizar(() => office(`/grupos/${g.id}/pilotos/${p.id}`, { method: 'PUT', body: { nome: p.nome, telefone: p.telefone, menor: !p.menor } })); }
      else { rasc.pilotos[i].menor = !rasc.pilotos[i].menor; pintar(); }
      return;
    }
    if ((x = el('[data-qtd]'))) {
      const d = +x.dataset.qtd;
      if (g) {
        if (d > 0) await atualizar(() => office(`/grupos/${g.id}/pilotos`, { method: 'POST', body: {} }), 'Piloto adicionado · 1 vaga a menos no site');
        else { const ult = g.pilotos[g.pilotos.length - 1]; if (ult && !ult.responsavel) { if (!confirm(`Tirar ${ult.nome || 'o piloto ' + ult.ordem} do grupo? A vaga volta para o site e o totem.`)) return; await atualizar(() => office(`/grupos/${g.id}/pilotos/${ult.id}`, { method: 'DELETE' }), 'Piloto tirado · vaga liberada'); } }
      } else {
        if (d > 0 && rasc.pilotos.length < +b.disponiveis) rasc.pilotos.push({ nome: '', telefone: '', menor: false });
        if (d < 0 && rasc.pilotos.length > 1) rasc.pilotos.pop();
        pintar();
      }
      return;
    }
    if ((x = el('[data-tirar]'))) {
      const i = +x.dataset.tirar;
      if (g) { const p = g.pilotos[i]; if (!(await confirmar(`Tirar ${p.nome || 'o piloto ' + p.ordem} do grupo?`, `${p.pago ? 'Ele JÁ PAGOU: o pagamento precisa ser estornado depois. ' : ''}A vaga volta para o site e o totem.`, 'Tirar do grupo', true))) return; await atualizar(() => office(`/grupos/${g.id}/pilotos/${p.id}`, { method: 'DELETE' }), 'Piloto tirado · vaga liberada'); }
      else { rasc.pilotos.splice(i, 1); pintar(); }
      return;
    }
    if (el('[data-copiar-links]')) return copiar(linkDoGrupo(g), 'Link do grupo copiado');
    if (el('[data-enviar-grupo]')) {
      const fone = g.responsavelTelefone || '';
      if (!fone) return copiar(msgGrupo(g), 'Sem WhatsApp do responsável: mensagem com o link copiada');
      window.open(zap(fone, msgGrupo(g)), '_blank', 'noopener');
      await atualizar(() => office(`/grupos/${g.id}/links`, { method: 'POST', body: { pilotoIds: faltamLista(g) } }));
      return;
    }
    if (el('[data-voltar-horario]')) { const v = estado.voltar, r = estado.rasc; estado = null; fecharCamada(); return v && v(r); }
    if (el('[data-todos-pagos]')) {
      const faltam = g.pilotos.filter((p) => !p.pago);
      const forma = await escolherForma(`Marcar ${faltam.length} pilotos como pagos?`, `Total ${brl(faltam.reduce((a, p) => a + p.falta_centavos, 0))}. Como eles pagaram?`);
      if (!forma) return;
      try { for (const p of faltam) estado.g = await office(`/grupos/${g.id}/pagamentos`, { method: 'POST', body: { pilotoId: p.id, valorCentavos: p.falta_centavos, forma: forma.trim() } }); pintar(); estado.aoMudar && estado.aoMudar(); toast(`${faltam.length} pagamentos registrados · aparecem pagos na Recepção`); } catch (er) { falhou(er); }
      return;
    }
    if ((x = el('[data-link]'))) {
      const p = g.pilotos.find((y) => y.id === +x.dataset.link); const fone = destino(g, p);
      if (!fone) return toast('Coloque o WhatsApp do piloto (ou do responsável) primeiro.', true);
      window.open(zap(fone, msgCadastro(g, p)), '_blank', 'noopener');
      await atualizar(() => office(`/grupos/${g.id}/links`, { method: 'POST', body: { pilotoIds: [p.id] } }));
      return;
    }
    if ((x = el('[data-cobrar]'))) {
      { const d = x.closest('details.menuCobrar'); if (d) d.removeAttribute('open'); }
      const pid = x.dataset.cobrar ? +x.dataset.cobrar : null;
      const rotuloAntes = x.textContent; x.disabled = true; x.textContent = 'Gerando link…';
      try {
        const r = await office(`/grupos/${g.id}/cobrancas`, { method: 'POST', body: { pilotoId: pid } });
        estado.g = r.grupo; pintar();
        const p = pid ? estado.g.pilotos.find((y) => y.id === pid) : null;
        const fone = p ? destino(estado.g, p) : estado.g.responsavelTelefone;
        const texto = `Olá${p && p.nome ? ', ' + primeiro(p.nome) : ', ' + primeiro(estado.g.responsavel)}! Segue o link para pagar ${p ? 'sua vaga' : 'a reserva do grupo'} na bateria do Kartódromo de Betim (${quando(estado.g.inicio)}): ${brl(r.valor)} por Pix ou cartão — ${r.link}`;
        if (fone) mostrarLinks([[`Mandar o link de ${brl(r.valor)} para ${p ? (p.nome || 'piloto ' + p.ordem) : estado.g.responsavel}`, zap(fone, texto)]], 'Link de pagamento pronto (Asaas)');
        toast(r.reaproveitada ? 'Link de pagamento já existia · pode reenviar' : 'Link de pagamento criado no Asaas');
        estado.aoMudar && estado.aoMudar();
      } catch (er) {
        x.disabled = false; x.textContent = rotuloAntes;
        const lk = $('#listaLinks');
        if (lk) lk.innerHTML = `<div class="aviso-faixa" role="alert">Não consegui gerar o link de pagamento: ${esc(er.message)} <button type="button" class="btn link peq" data-cobrar="${x.dataset.cobrar || ''}">Tentar de novo</button> · ou use “Marcar como pago” se o cliente pagou por fora.</div>`;
        else falhou(er);
      }
      return;
    }
    if ((x = el('[data-recebi]'))) {
      { const d = x.closest('details.menuCobrar'); if (d) d.removeAttribute('open'); }
      const pid = x.dataset.recebi ? +x.dataset.recebi : null;
      const p = pid ? g.pilotos.find((y) => y.id === pid) : null;
      const valor = p ? p.falta_centavos : (g.modo === 'sinal' && g.pago < g.sinal ? g.sinal - g.pago : g.falta);
      const forma = await escolherForma(`Marcar ${brl(valor)} como pago?`, `${p ? (p.nome || 'Piloto ' + p.ordem) : g.responsavel} pagou por fora. Como foi o pagamento?`);
      if (!forma) return;
      await atualizar(() => office(`/grupos/${g.id}/pagamentos`, { method: 'POST', body: { pilotoId: pid, valorCentavos: valor, forma: forma.trim() } }));
      { const ult = estado.g && estado.g.pagamentos.slice(-1)[0], gid = g.id; if (ult) toastAcao(`${brl(valor)} registrado · aparece pago na Recepção`, 'Desfazer', async () => { await atualizar(() => office(`/grupos/${gid}/pagamentos/${ult.id}`, { method: 'DELETE' }), 'Pagamento desfeito'); }); }
      return;
    }
    if (el('[data-registrar]')) {
      const v = Math.round(parseFloat(String(estado.reg.valor).replace(',', '.')) * 100);
      if (!(v > 0)) return toast('Digite o valor recebido', true);
      if (v > g.falta && !(await confirmar('Valor maior do que falta receber', `Você digitou ${brl(v)} e faltam ${brl(g.falta)}. Registrar mesmo assim?`, 'Registrar mesmo assim'))) return;
      await atualizar(() => office(`/grupos/${g.id}/pagamentos`, { method: 'POST', body: { pilotoId: estado.reg.quem ? +estado.reg.quem : null, valorCentavos: v, forma: estado.reg.forma } }), `${brl(v)} registrado`);
      estado.reg = { valor: '', quem: '', forma: 'Pix' }; pintar();
      return;
    }
    if ((x = el('[data-estornar]'))) {
      if (!(await confirmar('Estornar este pagamento?', 'A vaga volta a ficar a pagar.', 'Estornar', true))) return;
      await atualizar(() => office(`/grupos/${g.id}/pagamentos/${x.dataset.estornar}`, { method: 'DELETE' }), 'Pagamento estornado');
      return;
    }
    if (el('[data-cancelar-grupo]')) {
      if (!(await confirmar(`Cancelar a reserva de ${nomeBonito(g.responsavel)}?`, `${g.n} vagas voltam para o site e o totem.`, 'Cancelar reserva', true))) return;
      try { await office(`/grupos/${g.id}`, { method: 'DELETE' }); toast('Reserva cancelada · vagas liberadas'); fecharCamada(); estado.aoMudar && estado.aoMudar(); estado = null; } catch (er) { falhou(er); }
      return;
    }
    if ((x = el('[data-salvar-grupo]'))) {
      if (!respValido(rasc)) {
        estado.tentou = true;
        { const er0 = $('#erroGrupo'); if (er0) er0.className = 'erroMsg empurra'; }
        // não bloqueia em silêncio: diz o que falta, leva o cursor ao campo e marca em vermelho
        const msg = faltaResp(rasc), er = $('#erroGrupo');
        if (er) er.textContent = msg;
        const alvo = /WhatsApp/.test(msg) ? '[data-campo="telefone"][data-i="0"]' : '[data-campo="nome"][data-i="0"]', campo = $('#camada ' + alvo) || $('#qResp');
        if (campo) { campo.setAttribute('aria-invalid', 'true'); campo.scrollIntoView({ block: 'center', behavior: 'smooth' }); campo.focus(); }
        return;
      }
      x.disabled = true; x.setAttribute('aria-busy', 'true'); x.textContent = 'Salvando…';
      try {
        const pilotos = rasc.pilotos.map((p, i) => (i === 0 ? (rasc.responsavel ? { nome: rasc.responsavel.nome, telefone: rasc.responsavel.telefone, menor: false } : { nome: p.nome, telefone: p.telefone, menor: false }) : p));
        const novo = await office('/grupos', { method: 'POST', body: { bateriaId: b.id, ...(rasc.responsavel ? { responsavelId: rasc.responsavel.id } : { responsavelNovo: { nome: rasc.pilotos[0].nome, telefone: rasc.pilotos[0].telefone } }), origem: rasc.origem, modo: rasc.modo, precoCentavos: rasc.preco, sinalPct: rasc.sinalPct, pilotos } });
        guardarRascunho(true); estado.g = novo; estado.rasc = null;
        { const gid = novo.id; toastAcao(`Reserva de ${novo.n} piloto(s) salva · já aparece na Recepção, no site e no totem`, 'Desfazer', async () => { await office(`/grupos/${gid}`, { method: 'DELETE' }); fecharCamada(); estado = null; toast('Reserva desfeita · vagas liberadas'); }); }
        pintar();
        estado.aoMudar && estado.aoMudar();
        if (estado.enviarAgora) {
          await office(`/grupos/${novo.id}/links`, { method: 'POST', body: { pilotoIds: faltamLista(novo) } }).then((r) => { estado.g = r; pintar(); }).catch(() => {});
          const fone = novo.responsavelTelefone || '';
          mostrarLinks([[fone ? `Mandar o link do grupo para ${novo.responsavel} · ${fone}` : 'Copie o link do grupo e mande no WhatsApp', fone ? zap(fone, msgGrupo(novo)) : '#']], 'Link de cadastro do grupo');
        }
      } catch (er) { const m = $('#erroGrupo'); if (m) { m.className = 'erroMsg empurra'; m.textContent = /vaga/i.test(er.message) ? er.message + ' Reduza a quantidade ou use "‹ Trocar horário".' : er.message; } x.disabled = false; x.removeAttribute('aria-busy'); x.textContent = 'Salvar reserva'; }
    }
  });

  return { cartoes, abrir, nova, sujo, descartar: () => guardarRascunho(true) };
})();
