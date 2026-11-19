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
  // pagamento antecipado padrão = R$ 145; no balcão (ou bateria promocional como Happy Hour R$ 99,90) vale o menor preço da bateria
  const PRECO_ANTECIPADO = 14500;
  const HAPPY_NORMAL = 9990;
  const HAPPY_PRIMEIRA_VEZ = 8990;
  const ehHH = (b) => (typeof ehHappyHour === 'function' ? ehHappyHour(b) : (+(b && b.produtoId) === 67 || /happy\s*hour/i.test(String((b && b.produto) || ''))));
  const durBatDe = (b) => {
    if (typeof duracaoBat === 'function') return duracaoBat(b);
    const m = +(b && b.duracaoMin);
    if (Number.isFinite(m) && m > 0) return m;
    const tx = /\b(\d+)\s*MIN\b/i.exec(String((b && b.produto) || ''));
    return tx ? +tx[1] : (+(b && b.produtoId) === 67 ? 15 : 35);
  };
  const lembrado = (k, validos, padrao) => { try { const v = localStorage.getItem('kib-grupo-' + k); return validos.includes(v) ? v : padrao; } catch (e) { return padrao; } };
  const lembrar = (k, v) => { try { localStorage.setItem('kib-grupo-' + k, v); } catch (e) { /* sem armazenamento: segue sem lembrar */ } };
  const precoPara = (origem, b) => {
    const pb = +(b && b.preco) || 0;
    if (origem === 'recepcao') return pb || PRECO_ANTECIPADO;
    if (ehHH(b)) return pb > 0 ? Math.min(pb, PRECO_ANTECIPADO) : HAPPY_NORMAL;
    return pb > 0 ? Math.min(pb, PRECO_ANTECIPADO) : PRECO_ANTECIPADO;
  };
  const nomeBonito = (n) => String(n || '').split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).join(' ').toLowerCase().replace(/(^|[\s'\(\[\-])([\p{L}])/gu, (_, a, b) => a + b.toUpperCase()).replace(/\s(Da|De|Do|Das|Dos|E)(?=\s)/g, (x) => x.toLowerCase());
  const formatarTelefone = (v) => {
    let d = String(v || '').replace(/\D/g, '');
    if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2);
    if (!d) return '';
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
  };
  const IC_ALERTA = 'M12 9v4M12 17h.01M10.3 3.6l-8.5 14.8A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.6l-8.5-14.8a2 2 0 0 0-3.4 0z';
  const IC_RELOGIO = 'M12 6v6l4 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z';
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
  const chipCad = (p) => ({ completo: ['verde', 'Pronto para o totem'], incompleto: ['laranja', 'Falta ' + (p.falta || []).join(', ')], enviado: ['laranja', 'Aguardando cadastro'], pendente: ['laranja', 'Aguardando cadastro'] }[p.cadastro] || ['laranja', p.cadastro || 'Aguardando cadastro']);

  function msgCadastro(g, p) {
    return `Olá${p.nome ? ', ' + primeiro(p.nome) : ''}! Sua vaga na bateria do Kartódromo de Betim (${quando(g.inicio)}) já está guardada na reserva de ${primeiro(g.responsavel)}. Faça seu cadastro (1 minuto): ${p.link} — no dia é só digitar o CPF no totem.`;
  }
  // avatar: verde = pago e cadastrado; cor do grupo = pago; cinza = ainda falta pagar (o mesmo em todo o modal)
  const corAvatar = (p, i) => !p ? (i === 0 ? 'background: var(--kib-cor-marca-principal); color: var(--kib-branco)' : 'background: var(--kib-cor-superficie-campo); color: var(--kib-cor-texto-secundario); box-shadow: inset 0 0 0 1px var(--kib-cor-borda-forte)')
    : p.pago && p.cadastro === 'completo' ? 'background: var(--kib-cor-estado-sucesso-texto); color: var(--kib-branco)'
      : p.pago ? `background: ${CORG[i % 6]}; color: var(--kib-branco)`
        : 'background: var(--kib-cor-superficie-campo); color: var(--kib-cor-texto-secundario); box-shadow: inset 0 0 0 1px var(--kib-cor-borda-forte)';
  const vagaLivre = (p) => !!p && !p.responsavel && !String(p.nome || '').trim() && !p.clienteId && !p.pago && !(+p.valorPago > 0);
  const faltamLista = (g) => g.pilotos.filter((p) => p.cadastro !== 'completo').map((p) => p.id);
  const linkDoGrupo = (g) => { const r = (g.pilotos || []).find((p) => p.responsavel) || (g.pilotos || [])[0]; return g.linkGrupo || (r ? r.link : ''); };
  function msgGrupo(g) {
    return `Olá! Vamos correr no Kartódromo de Betim (${quando(g.inicio)}) na reserva de ${primeiro(g.responsavel)}. Cada pessoa faz o próprio cadastro${g.modo === 'individual' ? ' completo e paga a sua vaga no final (Pix ou cartão)' : ' (1 minuto)'} neste link: ${linkDoGrupo(g)} — o mesmo link serve para todo o grupo. No dia é só digitar o CPF no totem.`;
  }
  async function copiar(texto, msg) {
    try { await navigator.clipboard.writeText(texto); toast(msg); }
    catch { const t = document.createElement('textarea'); t.value = texto; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); toast(msg); } catch { toast('Não deu para copiar. Selecione o texto e copie.', true); } t.remove(); }
  }
  function nomePiloto(g, p) {
    if (p && p.responsavel && g && g.responsavel && (!p.nome || /\s\.$/.test(String(p.nome).trim()) || String(p.nome).trim().length < String(g.responsavel).trim().length)) {
      return g.responsavel;
    }
    return (p && p.nome) || (p && p.responsavel && g && g.responsavel) || '';
  }
  function fonePiloto(g, p) {
    const dig = (v) => String(v || '').replace(/\D/g, '');
    if (p && p.responsavel && g && g.responsavelTelefone) {
      const dp = dig(p.telefone).length, dr = dig(g.responsavelTelefone).length;
      if (dr >= 11 && dp < 11) return g.responsavelTelefone;
    }
    return (p && p.telefone) || (p && p.responsavel && g && g.responsavelTelefone) || '';
  }
  function destino(g, p) { return fonePiloto(g, p); }
  function msgCobranca(g, p, r) {
    const nomeAlvo = p ? nomePiloto(g, p) : g.responsavel;
    return `Olá${nomeAlvo ? ', ' + primeiro(nomeAlvo) : ''}! Segue o link para pagar ${p ? 'sua vaga' : 'a reserva do grupo'} na bateria do Kartódromo de Betim (${quando(g.inicio)}): ${brl(r.valor)} por Pix ou cartão — ${r.link}`;
  }

  // ---------------------------------------------------------------- cartões na gaveta da bateria
  function cartoes(grupos) {
    return grupos.map((g, gi) => {
      const cor = CORG[gi % 6];
      const rostos = g.pilotos.map((p) => { const ok = p.pago && p.cadastro === 'completo', meio = p.pago || p.cadastro === 'completo'; return `<span title="${esc((p.nome || 'Piloto ' + p.ordem) + ' · ' + (p.cadastro === 'completo' ? 'cadastro ok' : 'falta cadastro') + ' · ' + (p.pago ? 'pago' : 'falta pagar'))}" style="width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: var(--kib-fonte-tamanho-pequeno); font-weight: 700; ${ok ? 'background: var(--kib-cor-status-ok); color: var(--kib-cor-acao-sobre-principal)' : meio ? 'background: var(--kib-cor-estado-aviso-fundo); color: var(--kib-cor-agenda-reserva-topo-texto)' : 'background: var(--kib-cor-borda-sutil); color: var(--kib-cor-texto-apoio)'}">${esc(p.nome ? iniciais(p.nome) : String(p.ordem))}</span>`; }).join('');
      const pct = g.total ? Math.round(g.pago / g.total * 100) : 100;
      return `<div style="display: flex; flex-direction: column; gap: var(--kib-espaco-1); padding: var(--kib-espaco-denso-12); border-radius: var(--kib-raio-cartao); background: var(--sup2); box-shadow: inset 0 0 0 1px var(--linha)">
        <span class="linha gap-1"><span class="avatar m" style="background: ${cor}">${esc(iniciais(g.responsavel))}</span><span class="col cresce"><b>${esc(g.responsavel)}${g.n > 1 ? ` e mais ${g.n - 1}` : ''}</b><span class="peq">${plural(g.n, "piloto", "pilotos")} · ${esc({ unico: 'responsável paga tudo', individual: 'cada um paga o seu', sinal: 'sinal + resto na recepção' }[g.modo])} · ${esc(g.codigo)}</span></span></span>
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
  let estado = null;
  const ativo = (ctx) => !!ctx && estado === ctx && ctx.janela?.isConnected && ctx.janela === $('#camada .modal');
  // { b, g (do servidor) | null, rasc (nova), aoMudar }

  async function abrir(grupoId, b, aoMudar) {
    estado = { b, g: null, rasc: null, aoMudar, reg: { valor: '', quem: '', forma: 'Pix' } };
    const ctx = estado;
    ctx.janela = modal('<div class="esqueleto" style="height: 420px; margin: var(--kib-espaco-denso-20)"></div>'); ctx.janela.style.maxWidth = '1140px';
    try { const g = await office(`/grupos/${grupoId}`); if (!ativo(ctx)) return; ctx.g = g; pintar(); } catch (e) { if (ativo(ctx)) { falhou(e); fecharCamada(); } }
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
    if (rascAnt && !rascAnt.precoManual) rascAnt = { ...rascAnt, preco: precoPara(rascAnt.origem || 'whatsapp', b) };
    const n = Math.min(qtd || 2, Math.max(1, +b.disponiveis || 1));
    estado = {
      b, g: null, aoMudar, voltar, reg: { valor: '', quem: '', forma: 'Pix' }, enviarAgora: true, pagAberto: true, busca: '', achados: [],
      rasc: rascAnt ? { ...rascAnt, pilotos: Array.from({ length: n }, (_, i) => rascAnt.pilotos[i] || { nome: '', telefone: '', menor: false }) } : { responsavel: null, origem: lembrado('origem', ORIGENS.map((o) => o[0]), 'whatsapp'), modo: lembrado('modo', MODOS.map((m) => m[0]), 'individual'), preco: precoPara(lembrado('origem', ORIGENS.map((o) => o[0]), 'whatsapp'), b), precoManual: false, sinalPct: 30, pilotos: Array.from({ length: n }, () => ({ nome: '', telefone: '', menor: false })) },
    };
    estado.janela = modal('', 'Nova reserva'); estado.janela.style.maxWidth = '1140px';
    pintar();
    if (recuperado) toast('Recuperei o que você tinha digitado nesta reserva');
    setTimeout(() => { const c = document.getElementById('qResp') || document.querySelector('#camada [data-campo="nome"][data-i="0"]'); if (c) c.focus(); }, 60);
  }
  // há algo digitado que se perderia ao fechar? (só vale para reserva nova ainda não salva)
  const sujo = () => !!(estado && !estado.g && estado.rasc && (estado.rasc.responsavel || estado.rasc.pilotos.some((p) => (p.nome || '').trim() || (p.telefone || '').trim())));

  // valores de cada piloto numa reserva ainda não salva (mesma conta do servidor)
  // promoção do site: aniversariante + pelo menos 10 convidados → a vaga dele sai por R$ 90,00 (o servidor confere igual)
  const ANIV_MIN = 10, ANIV_PRECO = 9000;
  const precoAniv = (r, n) => (r.aniversario && n - 1 >= ANIV_MIN ? Math.min(+r.preco || 0, ANIV_PRECO) : +r.preco || 0);
  function contaRascunho(r) {
    const n = r.pilotos.length, total = (n - 1) * (+r.preco || 0) + (n ? precoAniv(r, n) : 0);
    return { n, total, pago: 0, falta: total, pagos: 0, cadastrados: 0, sinal: Math.round(total * r.sinalPct / 100) };
  }

  // Janela interativa para movimentar cliente que entrou no grupo errado ou quer ir para outro grupo
  async function abrirModalMoverPiloto(g, p, aoConcluir) {
    const antes = document.activeElement;
    const veu = document.createElement('div');
    veu.className = 'veu veuTopo';
    veu.style.zIndex = '10001';

    const pNome = nomeBonito(p.nome || 'Piloto ' + p.ordem);
    const dataHoraIso = g.inicio || (estado?.b?.dataHora) || '';
    const dataIso = dataHoraIso.slice(0, 10) || iso(new Date());

    veu.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" style="max-width: 580px; width: 100%;">
        <div class="modalGrupoTopo" style="background: var(--kib-cor-superficie-padrao); border-bottom: 1px solid var(--kib-cor-borda-sutil);">
          <div class="modalGrupoTopoInfo">
            <h2 class="modalGrupoTitulo">Movimentar participante de grupo</h2>
            <div class="modalGrupoBadges">
              <span class="badgeNomeBateria">${esc(pNome)}</span>
              <span class="badgeCodigoReserva">Grupo atual: ${esc(g.codigo)}</span>
            </div>
          </div>
          <button type="button" class="btnFecharModal hov" data-acao="fecharDlg" aria-label="Fechar" title="Fechar (Esc)">
            ${svg(IC.fechar, 16, 'currentColor', 2.4)}
          </button>
        </div>
        <div style="padding: var(--kib-espaco-2); display: flex; flex-direction: column; gap: var(--kib-espaco-1);">
          <p class="peq" style="line-height: 1.45; color: var(--kib-cor-texto-secundario); margin: 0 0 6px;">
            Caso este cliente tenha entrado no grupo errado pelo autoatendimento (totem) ou link, você pode desvinculá-lo para ficar sozinho (reserva individual) ou transferi-lo para outro grupo.
          </p>

          <div role="radiogroup" style="display: flex; flex-direction: column; gap: 8px;">
            <label class="cardModoPagamento optDestino selecionado" style="cursor: pointer; display: flex; align-items: flex-start; gap: 10px; padding: 12px; border-radius: 8px; border: 1px solid var(--kib-cor-borda-sutil);">
              <input type="radio" name="destAcao" value="sozinho" checked style="margin-top: 3px;">
              <span class="col" style="gap: 2px; flex: 1;">
                <b class="t-subtitulo" style="color: var(--kib-cor-texto-principal);">Colocar sozinho (reserva individual)</b>
                <span class="peq" style="line-height: 1.35; color: var(--kib-cor-texto-secundario);">
                  O participante passa a ter uma reserva avulsa independente. A vaga no grupo ${esc(g.codigo)} é liberada para outro amigo se cadastrar.
                </span>
                <div id="boxDestSozinho" style="margin-top: 8px; display: flex; flex-direction: column; gap: 4px;">
                  <span class="peq peso-semibold" style="font-size: var(--kib-fonte-tamanho-pequeno);">Bateria da reserva individual:</span>
                  <select id="selBatSozinho" class="entrada" style="height: 36px; font-size: var(--kib-fonte-tamanho-corpo);">
                    <option value="${g.bateriaId}">Manter na bateria atual (${quando(g.inicio)})</option>
                  </select>
                </div>
              </span>
            </label>

            <label class="cardModoPagamento optDestino" style="cursor: pointer; display: flex; align-items: flex-start; gap: 10px; padding: 12px; border-radius: 8px; border: 1px solid var(--kib-cor-borda-sutil);">
              <input type="radio" name="destAcao" value="outro_grupo" style="margin-top: 3px;">
              <span class="col" style="gap: 2px; flex: 1;">
                <b class="t-subtitulo" style="color: var(--kib-cor-texto-principal);">Mover para outro grupo</b>
                <span class="peq" style="line-height: 1.35; color: var(--kib-cor-texto-secundario);">
                  Transfere o participante para outro grupo de amigos da data. A vaga no grupo atual é liberada.
                </span>
                <div id="boxDestOutroGrupo" style="margin-top: 8px; display: none; flex-direction: column; gap: 4px;">
                  <span class="peq peso-semibold" style="font-size: var(--kib-fonte-tamanho-pequeno);">Selecione o grupo de destino:</span>
                  <select id="selOutroGrupo" class="entrada" style="height: 36px; font-size: var(--kib-fonte-tamanho-corpo);">
                    <option value="">Carregando grupos...</option>
                  </select>
                </div>
              </span>
            </label>
          </div>

          <div id="erroMoverPiloto" class="cor-erro peq" role="alert" style="min-height: 18px; margin-top: 4px;"></div>

          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 10px; border-top: 1px solid var(--kib-cor-borda-sutil); padding-top: 12px;">
            <button type="button" class="btn link" data-acao="cancelarDlg">Cancelar</button>
            <button type="button" class="btn prim" id="btnConfirmarMoverPiloto">Confirmar movimentação</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(veu);

    let fechado = false, enviando = false;
    const fechar = () => {
      if (fechado) return;
      fechado = true;
      veu.remove();
      document.removeEventListener('keydown', onKey, true);
      try { antes && antes.focus(); } catch {}
    };

    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(); return; }
      if (e.key === 'Tab') {
        const f = [...veu.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')].filter((el) => el.offsetParent !== null);
        if (!f.length) return;
        const i = f.indexOf(document.activeElement);
        e.preventDefault(); e.stopPropagation();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    let veuDown = false;
    veu.addEventListener('pointerdown', (e) => { veuDown = e.target === veu; });
    veu.addEventListener('click', (e) => { if (veuDown && e.target === veu) fechar(); veuDown = false; });

    const radioSozinho = veu.querySelector('input[value="sozinho"]');
    if (radioSozinho) radioSozinho.focus();
    const radioOutro = veu.querySelector('input[value="outro_grupo"]');
    const boxSozinho = veu.querySelector('#boxDestSozinho');
    const boxOutro = veu.querySelector('#boxDestOutroGrupo');
    const selBat = veu.querySelector('#selBatSozinho');
    const selGrupo = veu.querySelector('#selOutroGrupo');
    const erroDiv = veu.querySelector('#erroMoverPiloto');
    const btnConfirmar = veu.querySelector('#btnConfirmarMoverPiloto');

    const atualizarCards = () => {
      const eSozinho = radioSozinho.checked;
      radioSozinho.closest('.optDestino').classList.toggle('selecionado', eSozinho);
      radioOutro.closest('.optDestino').classList.toggle('selecionado', !eSozinho);
      boxSozinho.style.display = eSozinho ? 'flex' : 'none';
      boxOutro.style.display = eSozinho ? 'none' : 'flex';
    };

    radioSozinho.onchange = atualizarCards;
    radioOutro.onchange = atualizarCards;

    office(`/baterias?data=${dataIso}&status=todas`).then((bats) => {
      if (fechado || !veu.isConnected || !bats || !Array.isArray(bats)) return;
      const outras = bats.filter((b) => b.id !== g.bateriaId && b.status !== 'cancelada' && (+b.disponiveis > 0));
      for (const b of outras) {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = `${b.nome || 'Bateria'} às ${horaDe(b.dataHora)} (${b.disponiveis} vagas livres)`;
        selBat.appendChild(opt);
      }
    }).catch(() => undefined);

    office(`/grupos?de=${dataIso}&ate=${dataIso}`).then((grupos) => {
      if (fechado || !veu.isConnected) return;
      selGrupo.innerHTML = '';
      const outros = (grupos || []).filter((gr) => gr.id !== g.id && gr.status === 'ativa');
      if (!outros.length) {
        selGrupo.innerHTML = '<option value="">Nenhum outro grupo ativo nesta data</option>';
        return;
      }
      const optVazia = document.createElement('option');
      optVazia.value = '';
      optVazia.textContent = 'Escolha o grupo de destino...';
      selGrupo.appendChild(optVazia);
      for (const gr of outros) {
        const opt = document.createElement('option');
        opt.value = gr.id;
        opt.textContent = `Grupo ${gr.codigo} · ${nomeBonito(gr.responsavel)} às ${horaDe(gr.inicio)} (${gr.cadastrados}/${gr.n} cadastrados)`;
        selGrupo.appendChild(opt);
      }
    }).catch((err) => {
      if (fechado || !veu.isConnected) return;
      selGrupo.innerHTML = `<option value="">Erro ao carregar grupos (${err.message})</option>`;
    });

    veu.querySelector('[data-acao="fecharDlg"]').onclick = fechar;
    veu.querySelector('[data-acao="cancelarDlg"]').onclick = fechar;

    btnConfirmar.onclick = async () => {
      if (enviando || fechado) return;
      erroDiv.textContent = '';
      const destino = radioSozinho.checked ? 'sozinho' : 'outro_grupo';
      const body = { destino };
      if (destino === 'sozinho') {
        body.novaBateriaId = +selBat.value || g.bateriaId;
      } else {
        const gid = +selGrupo.value;
        if (!gid) {
          erroDiv.textContent = 'Selecione o grupo de destino.';
          return;
        }
        body.novoGrupoId = gid;
      }

      enviando = true;
      btnConfirmar.disabled = true;
      btnConfirmar.setAttribute('aria-busy', 'true');
      btnConfirmar.textContent = 'Movimentando…';

      try {
        const res = await office(`/grupos/${g.id}/pilotos/${p.id}/desvincular`, { method: 'POST', body });
        toast(res.mensagem || 'Participante movido.');
        fechar();
        if (aoConcluir) aoConcluir(res);
      } catch (e) {
        if (!fechado && veu.isConnected) {
          erroDiv.textContent = e.message || String(e);
          btnConfirmar.disabled = false;
          btnConfirmar.removeAttribute('aria-busy');
          btnConfirmar.textContent = 'Confirmar movimentação';
        } else {
          falhou(e);
        }
      } finally {
        enviando = false;
      }
    };
  }

  function pintar() {
    if (!ativo(estado)) return; const m = estado.janela;
    guardarRascunho();
    const { b, g, rasc } = estado;
    const novo = !g;
    const T = TIPOS[b.reservaFechada ? 'fechada' : 'reserva'];
    const c = novo ? contaRascunho(rasc) : g;
    const modo = novo ? rasc.modo : g.modo;
    const preco = novo ? rasc.preco : g.preco;
    const sinalPct = novo ? rasc.sinalPct : g.sinalPct;
    const aniv = novo ? !!rasc.aniversario : !!g.aniversario;
    const isHappy = ehHH(b) || ehHH(g);
    const durMin = durBatDe(b || g);
    const podeTrocarPreco = novo || (!((g.pagamentos || []).length) && !g.pago && !g.cobrancaGrupo && !(g.pilotos || []).some((p) => p.pago));
    const nAniv = novo ? rasc.pilotos.length : g.n;
    const convidadosAniv = Math.max(0, nAniv - 1), promoOk = aniv && convidadosAniv >= ANIV_MIN;
    const max = Math.max(0, +(novo ? b.disponiveis : g.disponiveis) || 0) + (novo ? 0 : g.n);
    const pilotos = novo ? rasc.pilotos.map((p, i) => ({ ...p, ordem: i + 1, responsavel: i === 0 })) : g.pilotos;
    const pendentes = novo ? [] : g.pilotos.filter((p) => !p.pago);
    const pagamentosFeitos = novo ? 0 : (g.pagamentos || []).length;
    const parciais = novo ? 0 : g.pilotos.filter((p) => !p.pago && +p.valorPago > 0).length;
    const livres = novo ? [] : g.pilotos.filter(vagaLivre);
    const devedores = novo ? [] : g.pilotos.filter((p) => !p.pago && !vagaLivre(p));
    const faltaDevedores = devedores.reduce((a, p) => a + (+p.falta_centavos || 0), 0), faltaLivres = livres.reduce((a, p) => a + (+p.falta_centavos || 0), 0);
    const minutosAte = (deIso(b.dataHora) - new Date()) / 60000;
    const urgenteGrupo = minutosAte < 120; // falta de pagamento só vira alarme vermelho perto da bateria
    const obsTexto = String((b && b.observacao) || '').trim();
    const obsContradiz = !novo && /anivers/i.test(obsTexto) && !aniv;
    const pagouPrecoAniv = !novo ? (g.pagamentos || []).filter((pg) => +pg.valor === ANIV_PRECO && pg.pilotoId).map((pg) => nomeBonito(pg.pilotoNome || (g.pilotos.find((x) => x.id === pg.pilotoId) || {}).nome || '')).filter(Boolean) : [];
    const travaForma = !novo && pagamentosFeitos > 0 && !estado.trocarModo;
    const travaPreco = !novo && !podeTrocarPreco && !estado.editarPreco;
    const produtoTxt = String(b.produto || '').replace(/^(ANTECIPADO|BALCÃO|BALCAO)\s*-\s*/i, '').toLowerCase().replace(/^./, (x) => x.toUpperCase());
    const titulo = novo ? 'Quem vai correr?' : `${esc(nomeBonito(g.responsavel))}${g.n > 1 ? ' e mais ' + (g.n - 1) : ''}`;
    const bvHtml = (i) => {
      const v = estado.bv; if (!v || v.i !== i) return '';
      const itens = (v.achados || []).slice(0, 8).map((c) => `<button type="button" class="btn sec" style="justify-content: flex-start; min-height: 44px; text-align: left" data-pick-vaga="${esc(JSON.stringify({ id: c.id, nome: c.nome, telefone: c.telefone || '', nascimento: c.nascimento || '' }))}"><b>${esc(nomeBonito(c.nome))}</b><span class="peq" style="margin-left: 8px">${esc([c.documento, c.telefone, c.nascimento ? 'nasc. ' + c.nascimento.split('-').reverse().join('/') : ''].filter(Boolean).join(' · '))}</span></button>`).join('');
      return `<div class="buscaVaga" style="grid-column: 1 / -1; padding: var(--kib-espaco-1) var(--kib-espaco-2); background: var(--kib-cor-superficie-suave); border-top: 1px solid var(--kib-cor-borda-sutil); display: flex; flex-direction: column; gap: var(--kib-espaco-1)">
        <span style="display: flex; gap: var(--kib-espaco-1); align-items: center"><input id="qVaga" class="entrada" style="flex: 1; min-height: 44px" value="${esc(v.q)}" placeholder="CPF, nome ou telefone do piloto ou amigo" aria-label="Buscar cadastro para a vaga ${i + 1}" autocomplete="off"><button type="button" class="btn sec" data-fechar-bv>Fechar</button></span>
        ${itens || (v.q.trim().length >= 2 ? '<span class="peq">Nenhum cadastro encontrado. Preencha nome e WhatsApp na linha, ou mande o link de cadastro.</span>' : '<span class="peq">Digite pelo menos 2 letras ou 4 números. Ao escolher, nome, WhatsApp e idade vêm do cadastro.</span>')}
      </div>`;
    };
    const linhas = pilotos.map((p, i) => {
      const resp = i === 0;
      const respExistente = resp && novo && !!rasc.responsavel;
      const rawNome = respExistente ? rasc.responsavel.nome : (novo ? (p.nome || '') : nomePiloto(g, p));
      const rawFone = respExistente ? (rasc.responsavel.telefone || '') : (novo ? (p.telefone || '') : fonePiloto(g, p));
      const nomeVal = rawNome;
      const foneVal = formatarTelefone(rawFone);
      let cad = ['cinza', 'Link após salvar'], pg = ['cinza', brl(preco)], acoesCad = '', acoesPg = '';
      if (!novo) {
        cad = chipCad(p);
        if (modo === 'unico') { pg = p.pago ? ['verde', 'Pago pelo grupo'] : resp ? ['laranja', 'Paga o grupo · falta ' + brlCurto(g.falta)] : ['cinza', 'Responsável paga']; }
        else if (modo === 'sinal') { pg = p.pago ? ['verde', p.pagoNoCaixa ? 'Pago no caixa' : 'Pago'] : ['laranja', 'Resto ' + brlCurto(p.falta_centavos) + ' na Recepção']; }
        else { pg = p.pago ? ['verde', p.pagoNoCaixa ? 'Pago no caixa' : 'Pago'] : p.valorPago > 0 ? ['laranja', `Falta ${brlCurto(p.falta_centavos)}`, `Pagou ${brlCurto(p.valorPago)} de ${brlCurto(p.valorPago + p.falta_centavos)} · falta ${brlCurto(p.falta_centavos)}`] : ['vermelho', 'Falta ' + brlCurto(p.falta_centavos)]; }
        const cobExist = modo === 'unico' ? g.cobrancaGrupo : p.cobranca;
        if (vagaLivre(p) && modo !== 'unico') pg = ['cinza', `${brlCurto(p.falta_centavos)} pelo link`];
        if (!p.pago && !vagaLivre(p) && (modo !== 'unico' || resp)) {
          acoesPg = `<details class="menuCobrar">
            <summary class="btnCobrarSumario" aria-haspopup="true" aria-expanded="false" title="Mandar link, quitar com voucher ou marcar como pago">Receber</summary>
            <div class="menuCobrarLista" role="group" aria-label="Como cobrar ${esc(nomeVal || 'piloto ' + (i + 1))}">
              <button type="button" class="btn peq" data-cobrar="${modo === 'unico' ? '' : p.id}" title="Gera o link Asaas (Pix ou cartão) e abre o WhatsApp para enviar">${svg(IC.zap, 13, 'var(--kib-cor-marca-principal)')} Enviar link de pagamento</button>
              ${cobExist && cobExist.link ? `<button type="button" class="btn peq" data-ver-cobranca="${modo === 'unico' ? '' : p.id}" title="Copia o link de pagamento (${brlCurto(cobExist.valor)}) e mostra o botão do WhatsApp">${svg(IC.reservas, 13, 'var(--kib-cor-estado-info-texto)')} Copiar link (${brlCurto(cobExist.valor)})</button>` : ''}
              <button type="button" class="btn peq" data-quitar-voucher="${modo === 'unico' ? '' : p.id}" title="Quita a vaga do piloto com um voucher de pagamento">${svg('M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4zM10 7v10', 13, 'var(--kib-cor-marca-principal)')} Quitar com voucher</button>
              <hr class="divisorMenu">
              <button type="button" class="btn peq" data-recebi="${modo === 'unico' ? '' : p.id}" title="O cliente já pagou por fora (Pix direto, dinheiro, maquininha)">${svg(IC.ok, 13, 'var(--kib-cor-status-ok)')} Marcar ${modo === 'unico' ? brlCurto(g.falta) : brlCurto(p.falta_centavos)} como pago</button>
            </div>
          </details>`;
        }
      }
      const okVerde = !novo && p.pago && p.cadastro === 'completo';
      const fixo = !novo && resp; // o responsável de uma reserva salva não se edita aqui: aparece como texto, não como campo
      const salvoTexto = !novo && !resp && !!String(p.nome || '').trim() && estado.editandoLinha !== i; // piloto já salvo: texto; clique para corrigir
      const iniciaisNome = nomeVal ? iniciais(nomeBonito(nomeVal)) : String(i + 1);

      return `<div class="linhaPilotoGrupo ${resp ? 'isResp' : ''}">
        <span class="avatar m" style="${corAvatar(novo ? null : p, i)}; font-weight: 700;" aria-hidden="true">${esc(iniciaisNome)}</span>
        <div style="display: flex; flex-direction: column; gap: 3px; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 6px; width: 100%; min-width: 0;">
            ${fixo ? `<span class="valorFixo trunc" title="${esc(nomeBonito(nomeVal))}">${esc(nomeBonito(nomeVal))}</span>` : salvoTexto ? `<button type="button" class="valorEditavel" data-editar-linha="${i}" title="${esc(nomeBonito(nomeVal))} · clique para corrigir o nome ou o WhatsApp"><span class="trunc">${esc(nomeBonito(nomeVal))}</span>${svg('M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16v4z', 12, 'currentColor', 2)}</button>` : respExistente ? `<span class="entrada" style="height: 36px; flex: 1; min-width: 0; display: flex; align-items: center; font-size: var(--kib-fonte-tamanho-corpo); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; ${nomeVal ? '' : 'color: var(--mudo2)'}">${esc(nomeBonito(nomeVal) || 'Escolha o responsável')}</span>` : `<input class="entrada" style="height: 36px; flex: 1; min-width: 0; font-size: var(--kib-fonte-tamanho-corpo); font-weight: 500;" value="${esc(nomeBonito(nomeVal))}" placeholder="${resp ? 'Nome do responsável' : 'Nome (opcional)'}" aria-label="Nome do piloto ${i + 1}" title="${esc(nomeBonito(nomeVal) || (resp ? '' : 'Pode deixar vazio: a pessoa preenche pelo link do grupo'))}" aria-describedby="erroGrupo" data-campo="nome" data-i="${i}" ${!novo && resp ? 'readonly' : ''}>`}${!resp && !p.clienteId && !novo ? `<button type="button" class="btnIconeLinha" data-buscar-vaga="${i}" aria-label="Buscar cadastro do piloto ${i + 1} por CPF, nome ou telefone" title="Buscar cadastro (CPF, nome ou telefone)">${svg(IC.busca, 15, 'currentColor', 2.2)}</button>` : !resp && !p.clienteId && novo ? `<button type="button" class="btnIconeLinha" data-buscar-vaga="${i}" aria-label="Buscar cadastro do piloto ${i + 1} por CPF, nome ou telefone" title="Buscar cadastro (CPF, nome ou telefone)">${svg(IC.busca, 15, 'currentColor', 2.2)}</button>` : ''}
          </div>
          ${resp ? `<div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;"><span class="badgeRespTag" title="Responsável pela reserva">${svg(IC.ok, 10, 'currentColor')} RESPONSÁVEL</span>${respExistente ? '<span class="peq cor-apoio" style="font-size: 12px; line-height: 1.35">cliente já cadastrado · <button type="button" class="btn link peq" data-trocar-resp="1" style="font-size: 12px; padding: 0">Trocar</button></span>' : ''}</div>` : ''}
          ${false ? `<button type="button" class="btn link peq btnBuscarVaga" data-buscar-vaga="${i}" aria-label="Buscar cadastro do piloto ${i + 1} por CPF, nome ou telefone" title="Buscar por CPF, nome ou telefone">${svg(IC.busca, 11)} Buscar cadastro</button>` : ''}
        </div>
        ${respExistente || fixo || salvoTexto ? `<span class="valorFixo mono">${esc(foneVal || '—')}</span>` : `<input class="entrada mono" style="height: 36px; font-size: var(--kib-fonte-tamanho-pequeno);" value="${esc(foneVal)}" placeholder="WhatsApp com DDD" inputmode="tel" aria-label="WhatsApp do piloto ${i + 1}" aria-describedby="erroGrupo" data-campo="telefone" data-i="${i}" ${!novo && resp ? 'readonly' : ''}>`}
        <span class="celIdade">${!novo && vagaLivre(p) ? '<span class="textoPendenteNovo" aria-label="Idade: ainda sem piloto">—</span>' : ''}<button ${!novo && vagaLivre(p) ? 'hidden' : ''} type="button" class="btnToggleIdade ${p.menor ? 'menor' : 'adulto'}" role="switch" aria-checked="${!!p.menor}" data-menor="${i}" title="${p.menor ? 'Menor de idade · clique para trocar para adulto' : 'Adulto · clique para trocar para menor de idade'}" aria-label="Idade do piloto ${i + 1}: ${p.menor ? 'menor de idade' : 'adulto'}. Trocar">${p.menor ? 'Menor' : 'Adulto'}</button></span>
        <div style="display: flex; align-items: center; min-width: 0;">
          ${novo ? `<span class="textoPendenteNovo">${esc(cad[1])}</span>` : vagaLivre(p) ? '<span class="chipTotemStatus aguardando">Vaga livre</span>' : cad[0] === 'verde' ? `<span class="chipTotemStatus completo" title="Cadastro completo: no totem é só digitar o CPF">${svg(IC.ok, 12, 'currentColor', 2.2)} Completo</span>` : `<span class="chipTotemStatus incompleto" title="${esc(cad[1])}">${svg(IC_ALERTA, 12, 'currentColor', 2)} <span class="trunc">${esc(vagaLivre(p) ? 'Vaga livre' : cad[1] === 'Aguardando cadastro' ? 'Sem cadastro' : cad[1])}</span></span>`}
        </div>
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; min-width: 0;">
          ${novo ? `<span class="textoPendenteNovo num">${esc(pg[1])}</span>` : pg[0] === 'verde' ? `<span class="chipPgStatus pago" title="${esc(pg[1])}">${svg(IC.ok, 12, 'currentColor', 2.2)} ${esc(pg[1])}</span>` : pg[0] === 'vermelho' && urgenteGrupo ? `<span class="chipPgStatus falta" title="${esc(pg[1])} · a bateria começa em menos de 2 horas">${svg(IC_ALERTA, 11, 'currentColor', 2.2)} ${esc(pg[1])}</span>` : `<span class="chipPgStatus ${pg[0] === 'cinza' ? 'aguardando' : 'parcial'}" title="${esc(pg[2] || pg[1])}">${pg[0] === 'cinza' ? '' : svg(IC_RELOGIO, 11, 'currentColor', 2.2)} ${esc(pg[1])}</span>`}
          ${acoesPg}
        </div>
        ${resp ? '<span></span>' : `<div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px;">
          ${!novo && (p.clienteId || p.nome) ? `<button type="button" class="btnMoverPilotoGrupo hov" aria-label="Mover ${esc(nomeVal || 'piloto ' + (i + 1))} para outro grupo ou deixar sozinho" title="Mover para outro grupo ou deixar sozinho" data-mover-piloto="${p.id}" data-piloto-nome="${esc(nomeVal || 'Piloto ' + (i + 1))}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v16h-6M10 8l-4 4 4 4M6 12h10"/></svg></button>` : ''}
          <button type="button" class="btnRemoverPiloto hov" aria-label="Tirar o piloto ${i + 1}" title="Tirar piloto da reserva" data-tirar="${i}">${svg(IC.fechar, 13, 'currentColor', 2.2)}</button>
        </div>`}
      </div>${bvHtml(i)}`;
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
      <span class="linha gap-1"><b class="t-corpo">Link de cadastro do grupo</b>${(() => { const semCad = faltamCad.filter((p) => !vagaLivre(p)).length, nl = faltamCad.filter(vagaLivre).length; return `<span class="empurra linha gap-meio">${semCad ? `<span class="chip laranja">${semCad} sem cadastro</span>` : ''}${nl ? `<span class="chipTotemStatus aguardando">${plural(nl, 'vaga livre', 'vagas livres')}</span>` : ''}${!semCad && !nl ? '<span class="chip verde">todos com cadastro</span>' : ''}</span>`; })()}</span>
      <div class="linha-quebra gap-1 linhaAcoesLink" style="align-items: center"><input class="entrada peq mono cresce" style="flex: 1 1 280px; min-width: 0" readonly value="${esc(linkDoGrupo(g))}" aria-label="Link de cadastro do grupo" onfocus="this.select()"><button type="button" class="btn peq sec" data-copiar-links="1">Copiar</button><button type="button" class="btnZapWhatsApp peq" data-enviar-grupo="1">${svg(IC.zap, 13, 'var(--kib-branco)')} Enviar no WhatsApp</button></div>
      <span class="peq cor-apoio" style="line-height: 1.4">Mande o mesmo link para todo mundo (grupo de WhatsApp, por exemplo). Quem abrir e se cadastrar ocupa a próxima vaga livre.${(() => { const nomes = faltamCad.filter((p) => !vagaLivre(p)).map((p) => nomeBonito(p.nome) || 'Piloto ' + p.ordem); const nl = faltamCad.filter(vagaLivre).length; return nomes.length || nl ? ' Falta: ' + esc([...nomes, nl ? plural(nl, 'vaga livre', 'vagas livres') : ''].filter(Boolean).join(', ')) + '.' : ''; })()}</span>
      ${g.linkPainel ? `<span class="linha gap-1" style="margin-top: var(--kib-espaco-1)"><b class="t-corpo">Painel do responsável</b><span class="peq cor-apoio">só para ${esc(primeiro(g.responsavel))}: mostra quem já se cadastrou e pagou</span></span>
      <div class="linha-quebra gap-1 linhaAcoesLink"><button type="button" class="btn peq sec" data-copiar-painel="1">Copiar link do painel</button><button type="button" class="btnZapWhatsApp peq" data-enviar-painel="1">${svg(IC.zap, 13, 'var(--kib-branco)')} Enviar ao responsável</button></div>` : ''}
    </div>`;
    const respOk = novo ? respValido(rasc) : true;
    const erroNovo = novo ? faltaResp(rasc) : '';
    const ajudaSalvar = novo && erroNovo && !estado.tentou ? 'Para salvar: ' + erroNovo.replace(/^Falta /, 'falta ') : '';
    m.style.maxWidth = 'min(1360px, calc(100% - 32px))';
    m.classList.add('modalGrupo');
    // o modal se redesenha inteiro: guarda rolagem e blocos abertos para não "pular" nem fechar o que a pessoa abriu
    const corpoAntes = m.querySelector('.modalGrupoCorpo');
    const rolagemAntes = corpoAntes ? corpoAntes.scrollTop : 0;
    const abertos = new Set([...m.querySelectorAll('details[data-det-key][open]')].map((d) => d.dataset.detKey));
    m.setAttribute('aria-label', novo ? 'Nova reserva' : 'Reserva ' + g.codigo);
    m.innerHTML = `
      <div class="modalGrupoTopo">
        <div class="modalGrupoTopoInfo">
          <h2 class="modalGrupoTitulo">${novo ? 'Nova reserva: quem vai correr?' : titulo}</h2>
          <div class="modalGrupoBadges">
            ${novo ? '' : `<span class="badgeCodigoReserva">Reserva ${esc(g.codigo)}</span>`}
            <span class="badgeDataBateria">${svg(IC.agenda, 14, 'var(--kib-cor-texto-secundario)')} ${quando(b.dataHora)}</span>
            <span class="badgeNomeBateria">${/^\s*bateria\s*[\d:h]*\s*$/i.test(b.nome || '') ? '' : esc(b.nome) + ' · '}${esc(produtoTxt || 'Bateria')} · ${durMin} min</span>
            ${novo && estado.voltar ? '<button type="button" class="btn link peq" data-voltar-horario="1" style="font-size: var(--kib-fonte-tamanho-pequeno);">‹ Trocar horário</button>' : ''}
          </div>
        </div>
        ${novo ? '' : `<div class="resumoGrupo" aria-live="polite">
            <span class="resumoGrupoFalta ${!g.falta ? 'ok' : urgenteGrupo ? 'urgente' : ''}">${g.falta ? `Falta ${brl(g.falta)}` : 'Tudo pago'}</span>
            <span class="resumoGrupoConta">${brlCurto(g.pago)} de ${brlCurto(g.total)} recebidos · ${g.pagos}/${g.n} pagos${parciais ? ` (+${parciais} em parte)` : ''} · ${g.cadastrados}/${g.n} com cadastro</span>
            ${g.falta && livres.length && modo === 'individual' ? `<span class="resumoGrupoConta">${devedores.length ? `${brlCurto(faltaDevedores)} de ${plural(devedores.length, 'pessoa', 'pessoas')} + ` : ''}${brlCurto(faltaLivres)} de ${plural(livres.length, 'vaga livre', 'vagas livres')} (pelo link)</span>` : ''}
          </div>`}
        <button type="button" class="btnFecharModal hov" data-acao="fechar" aria-label="Fechar janela" title="Fechar (Esc)">
          ${svg(IC.fechar, 16, 'currentColor', 2.4)}
        </button>
      </div>
      <div class="modalGrupoCorpo">
      <div style="display: flex; flex-wrap: wrap; align-items: flex-start; gap: var(--kib-espaco-2); padding: var(--kib-espaco-2)">
        ${obsTexto ? `<div class="obsNoCorpo">${typeof avisoObs === 'function' ? avisoObs(b, obsContradiz ? `<span class="avisoContradiz">${svg(IC_ALERTA, 13, 'currentColor', 2.2)} A observação fala em aniversariante, mas a promoção não está ligada.${pagouPrecoAniv.length ? ` ${pagouPrecoAniv.join(', ')} pagou ${brl(ANIV_PRECO)}, o valor de aniversariante.` : ''} Confirme quem é o aniversariante antes de cobrar: a promoção vale só para o responsável.</span>` : '') : ''}</div>` : ''}
        <div style="flex: 999 1 860px; min-width: 0; display: flex; flex-direction: column; gap: var(--kib-espaco-denso-12)">
          <section class="cartao leve">
            <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--kib-espaco-1) var(--kib-espaco-denso-12); padding: var(--kib-espaco-denso-12) var(--kib-espaco-2) var(--kib-espaco-1)">
              <div class="col" style="gap: 2px; flex: 1 1 260px">
                <b class="t-subtitulo" style="font-size: var(--kib-fonte-tamanho-subtitulo);">Pilotos do grupo</b>
                <span class="peq" style="line-height: 1.4; color: var(--kib-cor-texto-secundario);">${novo ? 'A linha 1 é o responsável. Cliente novo: só nome completo e WhatsApp; o resto ele completa pelo link.' : (g.falta ? 'Quem falta pagar tem o botão “Receber” na própria linha.' : 'Todos pagos. Falta só quem não tem cadastro completar pelo link.')}</span>
              </div>
              <div class="linha gap-1" style="align-items: center;">
                <span class="peq peso-semibold" style="color: var(--kib-cor-texto-principal);">Vagas do grupo:</span>
                <span class="passo"><button type="button" data-qtd="-1" aria-label="Um piloto a menos">−</button><span style="min-width: 28px; text-align: center; font-weight: 700;">${c.n}</span><button type="button" data-qtd="1" aria-label="Um piloto a mais" ${c.n >= max ? 'disabled' : ''}>+</button></span>
                <span class="peq" style="color: var(--kib-cor-texto-secundario);">máx. ${max}</span>
              </div>
            </div>
            ${novo ? `<div style="display: flex; flex-direction: column; gap: var(--kib-espaco-1); padding: 0 var(--kib-espaco-2) var(--kib-espaco-denso-12)">
              <label class="buscaCampo" style="height: 38px">${svg(IC.busca, 14, 'var(--kib-cor-borda-campo)')}<input id="qResp" value="${esc(estado.busca)}" placeholder="Já é cliente? Busque por nome, CPF ou telefone" autocomplete="off" aria-label="Buscar o responsável"></label>
              <div id="achados">${estado.achados.length ? `<div class="resultadoBusca">${estado.achados.slice(0, 10).map((x) => `<button type="button" class="hov" data-resp="${esc(JSON.stringify({ id: x.id, nome: x.nome, telefone: x.telefone, documento: x.documento }))}"><span class="avatar p" style="background: ${CORG[x.id % 6]}">${esc(iniciais(x.nome))}</span><span class="col"><b class="trunc">${esc(nomeBonito(x.nome))}</b><span class="peq">${esc(x.documento || 'sem CPF')} · ${esc(formatarTelefone(x.telefone) || 'sem telefone')}</span></span></button>`).join('')}</div>` : ''}</div>
              <span style="display: flex; flex-wrap: wrap; align-items: center; gap: var(--kib-espaco-1)"><span class="peq peso-semibold">Chegou por</span><span class="seg">${ORIGENS.map(([v, t]) => `<button type="button" data-origem="${v}" class="${rasc.origem === v ? 'sel' : ''}">${t}</button>`).join('')}</span></span></div>` : ''}
            <div id="listaLinks"></div>
            <div class="rolagemX">
              <div style="min-width: 940px">
                <div class="cabTabelaGrupo" aria-hidden="true">
                  <span></span>
                  <span>Nome</span>
                  <span>WhatsApp</span>
                  <span>Idade</span>
                  <span>Cadastro</span>
                  <span>Pagamento</span>
                  <span></span>
                </div>
                ${linhas}
              </div>
            </div>
            <div style="display: flex; flex-wrap: wrap; align-items: center; gap: var(--kib-espaco-1) var(--kib-espaco-denso-12); padding: var(--kib-espaco-denso-12) var(--kib-espaco-2); background: var(--kib-cor-superficie-suave); border-top: 1px solid var(--kib-cor-borda-sutil)">
              <button class="btn branco peq" data-qtd="1" ${c.n >= max ? 'disabled' : ''}>+ Adicionar piloto</button>
              <span class="peq cresce" style="flex: 1 1 220px; line-height: 1.4; color: var(--kib-cor-texto-secundario);">${c.n >= max ? 'A bateria não tem mais vagas livres.' : novo ? 'Depois de salvar sai um link só para o grupo: cada pessoa abre e se cadastra.' : `Ainda cabem ${max - c.n} na bateria. A vaga nova fica livre para o link do grupo.`}</span>
            </div>
            ${blocoLinks}
          </section>
          ${!novo ? `
          <details class="secao maisOpcoes blocoAuto" data-det-key="automatico"><summary class="titulo t-subtitulo">O que acontece sozinho até a corrida</summary><div class="listaAuto">${integra.map(([t, d, st, ok, ic]) => `<div class="itemAuto"><span class="tile" aria-hidden="true">${svg(ic, 14, 'currentColor')}</span><span class="col" style="gap: 1px; flex-grow: 1"><b>${t}</b><span class="peq" style="line-height: 1.4">${d}</span></span></div>`).join('')}</div></details>` : ''}

        </div>
        <div class="colunaPagamento" style="flex: 1 1 340px; min-width: 0; display: flex; flex-direction: column; gap: var(--kib-espaco-denso-12)">
          ${novo ? `<details class="secao maisOpcoes" data-det-pag="1" ${estado.pagAberto ? 'open' : ''}><summary class="titulo t-subtitulo">Como vai pagar: ${esc((MODOS.find((x) => x[0] === modo) || [])[1] || '')} · ${brl(preco)} por piloto · total ${brl(c.total)}</summary>` : ''}
          <section class="secao ${novo ? 'dentroDoResumo' : ''}" style="padding: var(--kib-espaco-denso-12) var(--kib-espaco-2) var(--kib-espaco-2); gap: var(--kib-espaco-denso-12)">
            <div style="display: ${novo ? 'none' : 'flex'}; align-items: center; justify-content: space-between; gap: var(--kib-espaco-1)">
              <span class="titulo t-subtitulo" style="font-size: var(--kib-fonte-tamanho-subtitulo); margin: 0">Como o grupo vai pagar?</span>
              ${dica("Escolha uma opção: o responsável paga tudo em um link; cada piloto paga o seu; ou o responsável paga um sinal agora e o resto é acertado na Recepção.", "como o grupo vai pagar")}
            </div>
            ${travaForma ? (() => { const [, t, d] = MODOS.find((x) => x[0] === modo) || MODOS[0]; return `<div class="formaTravada"><span class="col" style="gap: 2px; min-width: 0"><b class="t-subtitulo">${t}</b><span class="peq">${d}</span></span><button type="button" class="btn sec peq" data-trocar-modo="1" title="Já há pagamento nesta reserva: trocar pede confirmação">Trocar</button></div>`; })() : `<div role="radiogroup" aria-label="Como o grupo vai pagar" style="display: flex; flex-direction: column; gap: 8px">
              ${MODOS.map(([v, t, d]) => `
                <button type="button" role="radio" aria-checked="${modo === v}" data-modo="${v}" class="cardModoPagamento ${modo === v ? 'selecionado' : ''}">
                  <span class="radioCirculoIndicador"></span>
                  <span class="col" style="gap: 2px">
                    <b class="t-subtitulo" style="color: var(--kib-cor-texto-principal);">${t}</b>
                    <span class="peq" style="line-height: 1.35; color: var(--kib-cor-texto-secundario);">${d}</span>
                  </span>
                </button>
              `).join('')}
            </div>`}
            <div class="gradeMetricas">
              <div class="cardMetricaFinanceira">
                <label class="cardMetricaFinanceiraLabel" for="precoGrupo">Por piloto${novo ? (isHappy ? ' · Happy Hour' : rasc.origem === 'recepcao' ? ' · balcão' : ' · antecipado') : ''}</label>
                ${travaPreco ? `<div class="valorComAcao"><span class="num valorGrande" id="precoGrupo">${brl(preco)}</span><button type="button" class="btn link peq" data-alterar-preco="1" aria-label="Alterar o preço por piloto" title="Já há pagamento: alterar pede confirmação">Alterar</button></div>` : `<label class="campoMoeda"><span aria-hidden="true">R$</span><input id="precoGrupo" type="number" min="0" step="0.01" value="${(preco / 100).toFixed(2)}" data-preco="1" aria-label="Preço por piloto em reais"></label>`}
              </div>
              ${modo === 'sinal' ? `
                <div class="cardMetricaFinanceira">
                  <span class="cardMetricaFinanceiraLabel">Sinal agora (%)</span>
                  <div style="display: flex; align-items: center; gap: 4px; height: 32px; min-width: 0">
                    <input type="number" min="0" max="100" step="5" value="${sinalPct}" data-sinal="1" aria-label="Sinal agora, em porcentagem" class="campoNumero">
                    <span style="flex-shrink: 0; white-space: nowrap; font-size: var(--kib-fonte-tamanho-corpo); font-weight: 600; color: var(--kib-cor-texto-secundario);">%</span>
                  </div>
                </div>
              ` : `
                <div class="cardMetricaFinanceira">
                  <span class="cardMetricaFinanceiraLabel" title="Total da reserva (${c.n} karts)">Total · ${c.n} karts</span>
                  <div style="display: flex; align-items: center; height: 32px">
                    <span class="num" style="font-size: var(--kib-fonte-tamanho-titulo); font-weight: 700; color: var(--kib-cor-texto-principal);">${brl(c.total)}</span>
                  </div>
                </div>
              `}
            </div>
            ${isHappy ? `
              <div data-hh-banner="1" style="display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: var(--kib-raio-cartao); background: color-mix(in srgb, var(--kib-cor-estado-aviso-solido) 10%, var(--kib-cor-superficie-padrao)); border: 1px solid color-mix(in srgb, var(--kib-cor-estado-aviso-solido) 35%, transparent);">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
                  <b class="t-pequeno" style="color: var(--kib-cor-texto-principal);">Happy Hour · terça a quinta</b>
                  <span class="chip cinza">${durMin} min de pista</span>
                </div>
                <span class="peq" style="line-height: 1.4; color: var(--kib-cor-texto-secundario);">1ª vez no kartódromo: <b style="color: var(--kib-cor-texto-principal);">${brl(HAPPY_PRIMEIRA_VEZ)}</b> · demais pilotos: <b style="color: var(--kib-cor-texto-principal);">${brl(HAPPY_NORMAL)}</b></span>
                ${podeTrocarPreco ? `
                  <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px;">
                    <button type="button" class="btn peq ${preco === HAPPY_PRIMEIRA_VEZ ? 'prim' : 'sec'}" data-preco-preset="${HAPPY_PRIMEIRA_VEZ}" aria-pressed="${preco === HAPPY_PRIMEIRA_VEZ}">1ª vez · ${brl(HAPPY_PRIMEIRA_VEZ)}</button>
                    <button type="button" class="btn peq ${preco === HAPPY_NORMAL ? 'prim' : 'sec'}" data-preco-preset="${HAPPY_NORMAL}" aria-pressed="${preco === HAPPY_NORMAL}">Demais · ${brl(HAPPY_NORMAL)}</button>
                  </div>
                ` : ''}
                <span class="peq" style="line-height: 1.35; color: var(--kib-cor-texto-secundario);">No link de cada piloto, o sistema confere o CPF e cobra ${brl(HAPPY_PRIMEIRA_VEZ)} de quem corre pela 1ª vez.</span>
              </div>
            ` : ''}
            <button type="button" role="switch" aria-checked="${aniv}" data-aniv="1" class="cartaoInterruptor ${aniv ? 'ligado' : ''}" title="Promoção do site: o aniversariante que traz pelo menos ${ANIV_MIN} convidados pagantes corre por ${brl(ANIV_PRECO)}">
              <span class="col" style="gap: 2px; flex: 1; min-width: 0">
                <b class="t-subtitulo" style="color: var(--kib-cor-texto-principal);">Responsável é o aniversariante</b>
                <span class="peq" style="line-height: 1.35; color: var(--kib-cor-texto-secundario);">${!aniv ? (convidadosAniv >= ANIV_MIN ? (() => { const quem = esc(primeiro(nomeBonito(novo ? (rasc.responsavel ? rasc.responsavel.nome : rasc.pilotos[0].nome) : g.responsavel)) || 'o responsável'); const rp = novo ? null : g.pilotos.find((x) => x.responsavel); const jaPagou = rp ? (rp.pago ? preco : +rp.valorPago || 0) : 0; return jaPagou > ANIV_PRECO ? `${quem} já pagou ${brl(jaPagou)}: ligando, sobra crédito de ${brl(jaPagou - ANIV_PRECO)} para ele (sem estorno automático). Peça documento com foto no dia.` : `Este grupo tem ${convidadosAniv} convidados: ligando, ${quem} paga ${brl(ANIV_PRECO)} e o total cai para ${brl(c.total - Math.max(0, preco - ANIV_PRECO))}. Peça documento com foto no dia.`; })() : `Vale para o responsável: com ${ANIV_MIN} convidados ou mais, ele paga só ${brl(ANIV_PRECO)}. Este grupo tem ${convidadosAniv === 0 ? 'só o responsável' : plural(convidadosAniv, 'convidado', 'convidados')} por enquanto.`) : promoOk ? `Promoção valendo: ${convidadosAniv} convidados · aniversariante paga ${brl(Math.min(preco, ANIV_PRECO))}, convidados ${brl(preco)}.` : `Faltam ${ANIV_MIN - convidadosAniv} convidado${ANIV_MIN - convidadosAniv > 1 ? 's' : ''} para a promoção (${convidadosAniv} de ${ANIV_MIN}). Até lá ele paga ${brl(preco)}.`}</span>
              </span>
            <span class="chave ${aniv ? 'on' : ''}" aria-hidden="true"></span>
            </button>
            <div style="display: flex; flex-direction: column; gap: var(--kib-espaco-1); padding: var(--kib-espaco-denso-12); border-radius: var(--kib-raio-cartao); background: var(--kib-cor-superficie-padrao); border: 1px solid var(--kib-cor-borda-sutil);">
              <span class="cardMetricaFinanceiraLabel">${novo ? 'Cobrança' : 'Situação do pagamento'}</span>
              <div class="barra" ${novo ? 'hidden' : ''} style="height: 7px; border-radius: var(--kib-raio-chip); background: color-mix(in srgb, var(--kib-cor-texto-principal) 8%, transparent); overflow: hidden; display: flex;">
                <span style="width: 100%; transform: scaleX(${c.total ? Math.min(100, Math.round(c.pago / c.total * 100)) / 100 : 1}); transform-origin: left; background: ${c.falta ? 'var(--kib-cor-estado-aviso-solido)' : 'var(--kib-cor-status-ok)'}; transition: transform .3s ease;"></span>
              </div>
              ${novo ? `
                <span class="peq" style="line-height: 1.45; color: var(--kib-cor-texto-secundario);">Os links de pagamento saem logo após salvar a reserva.</span>
              ` : !g.falta ? `
                <div style="display: flex; align-items: center; gap: 6px; color: var(--kib-cor-estado-sucesso-texto); font-size: var(--kib-fonte-tamanho-corpo); font-weight: 600;">
                  ${svg(IC.ok, 14, 'currentColor')} Todos os pilotos estão pagos. Grupo liberado para o sorteio!
                </div>
              ` : modo === 'unico' ? `
                <span class="peq" style="line-height: 1.45; color: var(--kib-cor-texto-secundario);"><b>${esc(nomeBonito(g.responsavel))}</b> é responsável pelo pagamento total do grupo.</span>
              ` : `
                <div class="boxPendenciasPg">
                  <span class="peq" style="font-weight: 600; color: var(--kib-cor-texto-principal);">${devedores.length ? `Falta receber de ${plural(devedores.length, 'pessoa', 'pessoas')}:` : 'Ninguém com nome deve nada.'}</span>
                  <div class="chipsPendentesLista">
                    ${devedores.slice(0, 6).map((p) => `<span class="chipPilotoPendente">${esc(nomeBonito(p.nome) || 'Piloto ' + p.ordem)} · ${brlCurto(p.falta_centavos)}</span>`).join('')}
                    ${devedores.length > 6 ? `<span class="chipPilotoPendenteMais" title="${devedores.slice(6).map((p) => nomeBonito(p.nome) || 'Piloto ' + p.ordem).join(', ')}">+${devedores.length - 6} outros</span>` : ''}
                    ${livres.length ? `<span class="peq" style="flex-basis: 100%; color: var(--kib-cor-texto-secundario);">${plural(livres.length, 'vaga livre paga', 'vagas livres pagam')} pelo link ao se cadastrar.</span>` : ''}
                  </div>
                </div>
              `}
            </div>
            ${!novo ? `
              <div style="display: flex; flex-direction: column; gap: var(--kib-espaco-1); padding: var(--kib-espaco-denso-12); border-radius: var(--kib-raio-cartao); background: var(--kib-cor-superficie-padrao); border: 1px solid var(--kib-cor-borda-sutil);">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="tileLink" aria-hidden="true">${svg('M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1', 14, 'currentColor', 2.2)}</span>
                    <b class="t-subtitulo" style="color: var(--kib-cor-texto-principal);">Links de pagamento Asaas</b>
                  </div>

                </div>
                <span class="peq" style="line-height: 1.45; color: var(--kib-cor-texto-secundario);">
                  ${modo === 'individual' ? `Cada piloto paga a própria vaga (${brl(preco)}) pelo link do grupo. Para mandar um link só para uma pessoa, use “Receber” na linha dela.` : modo === 'sinal' ? `Sinal: ${brl(g.sinal)} (${sinalPct}%). O restante cada piloto acerta na Recepção.` : `Cobrança total do grupo: ${brl(g.falta)}.`}
                </span>
                ${modo !== 'individual' && g.falta && (modo !== 'sinal' || g.sinal > g.pago) ? `<button type="button" class="btn prim peq" data-cobrar="" style="margin-top: 4px;">Gerar e enviar link ao responsável</button>` : ''}
                ${g.cobrancaGrupo ? `<a class="mono peq trunc" target="_blank" rel="noopener" href="${esc(g.cobrancaGrupo.link)}" style="display: block; max-width: 100%; min-width: 0; padding: 6px 8px; border-radius: 6px; background: var(--kib-cor-superficie-padrao); border: 1px solid var(--kib-cor-borda-sutil); color: var(--kib-cor-texto-link);">${esc(g.cobrancaGrupo.link)}</a>` : ''}
              </div>
            ` : ''}
          </section>${novo ? '</details>' : ''}
          ${!novo ? `<section class="secao pagRecebidos">
            <div class="pagRecebidosCab"><span class="col" style="gap: 1px; min-width: 0"><span class="titulo t-subtitulo" style="margin: 0">Recebidos <span class="contaPag">${pagamentos.length}</span></span>${estado.conferidoEm ? `<span class="peq" style="color: var(--kib-cor-texto-secundario)">Conferido no Asaas às ${estado.conferidoEm}</span>` : ''}</span><button type="button" class="btn peq sec" data-conferir-asaas="1" title="Busca no Asaas os Pix e cartões que ainda não apareceram aqui (a tela já confere sozinha a cada minuto)">${svg(IC.sync, 12, 'currentColor')} Conferir no Asaas</button></div>
            ${modo === 'individual' && pagamentos.some((pg) => !pg.pilotoId) ? `<div class="aviso-faixa" role="note">Há pagamento sem piloto (${brl(g.pagamentosSemPiloto || pagamentos.filter((pg) => !pg.pilotoId).reduce((a, pg) => a + (+pg.valor || 0), 0))}). Em "cada um paga o seu" ele não é dividido entre as vagas: escolha o piloto abaixo ou estorne.</div>` : ''}
            ${(() => { const linhaPg = (pg) => { const pp = pg.pilotoId ? g.pilotos.find((x) => x.id === pg.pilotoId) : null; const ip = pp ? g.pilotos.indexOf(pp) : 0; const data = (pg.criadoEm || '').slice(8, 10) + '/' + (pg.criadoEm || '').slice(5, 7) + ' ' + (pg.criadoEm || '').slice(11, 16); return `<div class="linhaPag"><span class="avatar p" style="${pg.pilotoId ? corAvatar(pp || { pago: true }, ip) : 'background: var(--kib-cor-texto-principal); color: var(--kib-branco)'}" aria-hidden="true">${esc(pg.pilotoId ? iniciais(nomeBonito(nomeDe(pg.pilotoId))) : 'G')}</span><span class="linhaPagCorpo"><span class="linhaPagTopo"><b class="trunc" title="${esc(nomeBonito(pg.pilotoNome || nomeDe(pg.pilotoId)))}">${esc(nomeBonito(pg.pilotoNome || nomeDe(pg.pilotoId)))}${pg.pilotoCancelado ? ' · vaga cancelada' : ''}${modo === 'individual' && !pg.pilotoId ? ' · sem piloto' : ''}</b><b class="mono cor-ok">${brl(pg.valor)}</b></span><span class="linhaPagInfo">${pg.origem === 'manual' ? '<span class="chipOrigemPag manual">Lançado na recepção</span>' : ''}<span>${esc(pg.forma)} · ${esc(data)}${pg.usuario ? ' · por ' + esc(pg.usuario) : ''}</span>${pg.origem === 'manual' ? `<button type="button" class="btn peq linkPerigo" data-estornar="${pg.id}" title="Desfaz este lançamento feito na recepção">Estornar</button>` : ''}</span>${modo === 'individual' && !pg.pilotoId ? `<select class="entrada peq" style="max-width: 220px; height: 32px" aria-label="Escolher o piloto deste pagamento" data-vincular-pg="${pg.id}"><option value="">Escolher piloto…</option>${g.pilotos.map((p) => `<option value="${p.id}">${esc(nomeBonito(p.nome) || 'Piloto ' + p.ordem)}</option>`).join('')}</select>` : ''}</span></div>`; }; if (!pagamentos.length) return '<span class="peq" style="color: var(--kib-cor-texto-secundario);">Nenhum pagamento ainda. Os do Asaas aparecem aqui sozinhos.</span>'; const manuais = pagamentos.filter((pg) => pg.origem === 'manual'); const outros = pagamentos.filter((pg) => pg.origem !== 'manual'); const visiveis = [...manuais, ...outros.slice(0, Math.max(0, 4 - manuais.length))]; const resto = pagamentos.filter((pg) => !visiveis.includes(pg)); return visiveis.map(linhaPg).join('') + (resto.length ? `<details class="maisOpcoes enxuto maisRecebidos" data-det-key="recebidos"><summary>Ver mais ${plural(resto.length, 'pagamento', 'pagamentos')}</summary>${resto.map(linhaPg).join('')}</details>` : ''); })()}
            ${devedores.length > 1 && modo === 'individual' ? `<button type="button" class="btn sec peq" data-todos-pagos="1" style="width: fit-content; display: inline-flex; align-items: center; gap: 6px;" title="Pede confirmação com os nomes e a forma de pagamento">${svg(IC.ok, 13, 'currentColor')} Marcar os ${devedores.length} que faltam como pagos (${brl(devedores.reduce((a, p) => a + p.falta_centavos, 0))})</button>` : ''}
            <details class="maisOpcoes enxuto" data-det-key="registrar" ${estado.reg.valor ? 'open' : ''}><summary>Lançar um valor recebido na recepção</summary>
            <div class="formRegistrar">
              <label class="campoPeq campoQuem"><span>Quem pagou</span><select class="entrada" data-reg="quem"><option value="">${modo === 'individual' ? 'Escolha quem pagou…' : 'Grupo (responsável)'}</option>${(modo === 'individual' ? g.pilotos.filter((p) => !p.pago) : g.pilotos).map((p) => `<option value="${p.id}" ${String(estado.reg.quem) === String(p.id) ? 'selected' : ''}>${esc(nomeBonito(p.nome) || 'Vaga livre ' + p.ordem)}${!p.pago ? ' · falta ' + brlCurto(p.falta_centavos) : ''}</option>`).join('')}</select></label>
              <label class="campoPeq"><span>Valor (R$)</span><input class="entrada" type="number" min="0" step="0.01" placeholder="0,00" data-reg="valor" value="${esc(estado.reg.valor)}"></label>
              
              <label class="campoPeq"><span>Forma</span><select class="entrada" data-reg="forma">${['Pix', 'Cartão', 'Dinheiro', 'Voucher'].map((f) => `<option ${estado.reg.forma === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
              ${estado.reg.forma === 'Voucher' ? `<label class="campoPeq" style="grid-column: 1 / -1"><span>Código do voucher</span><input class="entrada num" style="text-transform: uppercase" placeholder="Ex.: KB2KB5NX" data-reg="voucherCodigo" value="${esc(estado.reg.voucherCodigo || '')}"></label>` : ''}
              <button type="button" class="btn prim peq" style="grid-column: 1 / -1" data-registrar="1">Lançar pagamento</button>
            </div></details></section>` : ''}
        </div>

      </div>
      </div>
      <div class="modalRodape" style="display: flex; align-items: center; gap: var(--kib-espaco-1); padding: 12px var(--kib-espaco-denso-20); background: var(--kib-cor-superficie-padrao); border-top: 1px solid var(--kib-cor-borda-sutil);">
        ${novo ? `<button type="button" role="switch" aria-checked="${estado.enviarAgora}" data-enviar-agora="1" style="display: flex; align-items: center; min-height: 36px; gap: var(--kib-espaco-1); padding: 0; border: 0; background: transparent; font-size: var(--kib-fonte-tamanho-corpo); font-weight: 600; color: var(--kib-cor-texto-principal); cursor: pointer;"><span class="chave ${estado.enviarAgora ? 'on' : ''}"></span>Mostrar o link do grupo ao salvar</button>` : `<button type="button" class="btn perigo peq" data-cancelar-grupo="1">Cancelar reserva</button>`}
        <span class="${estado.tentou && erroNovo ? 'erroMsg' : 'ajuda-campo'} empurra" id="erroGrupo" ${estado.tentou && erroNovo ? 'role="alert"' : 'aria-live="polite"'} style="font-size: var(--kib-fonte-tamanho-pequeno);">${novo ? (estado.tentou ? erroNovo : ajudaSalvar) : `${svg(IC.ok, 12, 'currentColor', 2.2)} Tudo o que você muda aqui é salvo na hora${estado.salvoEm ? ` · última alteração às ${estado.salvoEm}` : ''}`}</span>
        <span class="botoesRodape"><button type="button" class="btn sec peq" data-acao="fechar">${novo ? 'Cancelar' : 'Fechar'}</button>
        ${novo ? `<button type="button" class="btn prim peq ${respOk ? '' : 'quase'}" data-salvar-grupo="1" aria-describedby="erroGrupo" ${respOk ? '' : 'aria-disabled="true"'} title="Atalho: Ctrl+Enter" aria-keyshortcuts="Control+Enter">Salvar reserva de ${c.n} piloto${c.n > 1 ? 's' : ''}</button>` : ''}</span>
      </div>`;
    // devolve a rolagem e os blocos que estavam abertos antes do redesenho
    m.querySelectorAll('details[data-det-key]').forEach((d) => { if (abertos.has(d.dataset.detKey)) d.open = true; });
    const corpoDepois = m.querySelector('.modalGrupoCorpo'); if (corpoDepois && rolagemAntes) corpoDepois.scrollTop = rolagemAntes;
  }

  async function atualizar(acao, msg) {
    const ctx = estado; if (!ativo(ctx) || ctx.ocupado) return false;
    ctx.ocupado = true;
    try {
      const g = await acao(); if (!ativo(ctx)) return false;
      const agora = new Date(); ctx.salvoEm = `${pad(agora.getHours())}:${pad(agora.getMinutes())}`;
      ctx.g = g; pintar(); if (msg) toast(msg); ctx.aoMudar && ctx.aoMudar(); return true;
    } catch (e) { if (ativo(ctx)) falhou(e, () => { if (ativo(ctx)) atualizar(acao, msg); }); return false; }
    finally { ctx.ocupado = false; }
  }

  async function refrescar(forcar = false) {
    const ctx = estado; if (!ativo(ctx) || !ctx.g || ctx.ocupado || ctx.reg.valor || ctx.reg.quem || (!forcar && ctx.janela.contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName))) return;
    // menu "Receber" aberto, busca de cadastro aberta ou troca em andamento: espera a pessoa terminar
    if (!forcar && (ctx.bv || ctx.trocarModo || ctx.editarPreco || ctx.janela.querySelector('details.menuCobrar[open], .veuTopo'))) return;
    try {
      if (forcar) {
        ctx.ocupado = true;
        const res = await office(`/grupos/${ctx.g.id}/conferir-asaas`, { method: 'POST' }).catch(() => null);
        ctx.ocupado = false;
        if (res && res.grupo) {
          ctx.g = res.grupo; ctx.conferidoEm = (() => { const a = new Date(); return `${pad(a.getHours())}:${pad(a.getMinutes())}`; })();
          if (res.pagas > 0) toast(`${plural(res.pagas, 'pagamento recebido', 'pagamentos recebidos')} no Asaas.`);
          pintar();
          ctx.aoMudar && ctx.aoMudar();
          return;
        }
      }
      const [g, baterias] = await Promise.all([office(`/grupos/${ctx.g.id}`), office(`/baterias?status=todas&filtro=entre&data=${ctx.g.inicio.slice(0, 10)}&ate=${ctx.g.inicio.slice(0, 10)}`)]);
      if (!ativo(ctx) || ctx.ocupado || !forcar && ctx.janela.contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      ctx.g = g; ctx.b = baterias.find((b) => b.id === g.bateriaId) || ctx.b; pintar();
    } catch (e) { if (ativo(ctx)) { const er = $('#erroGrupo'); if (er) er.textContent = 'Não foi possível atualizar a reserva: ' + e.message; } }
    finally { ctx.ocupado = false; }
  }

  function mostrarLinks(lista, titulo, extras) {
    const el = $('#listaLinks'); if (!el) return;
    const url = extras && extras.url ? String(extras.url) : '';
    const texto = extras && extras.texto ? String(extras.texto) : '';
    const copia = url ? `<div class="linha-quebra gap-1" style="align-items: center">
      <input class="entrada peq mono cresce" style="flex: 1 1 260px; min-width: 0; height: 34px" readonly value="${esc(url)}" aria-label="Link de pagamento gerado" onfocus="this.select()">
      <button type="button" class="btn peq branco" data-copiar-txt="${esc(url)}">Copiar link</button>
      ${texto ? `<button type="button" class="btn peq branco" data-copiar-txt="${esc(texto)}">Copiar mensagem</button>` : ''}
    </div>` : '';
    const botoesZap = (lista || []).map(([rot, href]) => `<a class="btn verdeClaro peq" style="justify-content: flex-start" target="_blank" rel="noopener" href="${esc(href)}">${svg(IC.zap, 13, 'var(--kib-cor-estado-sucesso-texto)')} ${esc(rot)}</a>`).join('');
    const dica = extras && extras.semFone
      ? 'Sem WhatsApp cadastrado nesta linha: copie o link ou a mensagem acima para enviar.'
      : (lista && lista.length ? 'Copie o link/mensagem acima ou toque abaixo para abrir o WhatsApp com tudo pronto.' : '');
    el.innerHTML = `<div style="padding: var(--kib-espaco-denso-12) var(--kib-espaco-2); display: flex; flex-direction: column; gap: var(--kib-espaco-meio); border-top: 1px solid var(--linha); border-bottom: 1px solid var(--linha); background: color-mix(in srgb, var(--kib-cor-status-ok) 7%, transparent)">
      <div class="linha gap-1" style="align-items: center; justify-content: space-between"><b>${esc(titulo)}</b><button type="button" class="btn link peq" data-fechar-links="1" aria-label="Fechar aviso de link">Fechar</button></div>
      ${dica ? `<span class="peq">${esc(dica)}</span>` : ''}
      ${copia}
      ${botoesZap}
    </div>`;
    if (el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function mostrarCobrancaPronta(g, p, cob) {
    const fone = p ? destino(g, p) : g.responsavelTelefone;
    const nomeAlvo = p ? (nomePiloto(g, p) || 'piloto ' + p.ordem) : g.responsavel;
    const texto = msgCobranca(g, p, cob);
    const botoes = fone ? [[`Mandar o link de ${brl(cob.valor)} para ${nomeBonito(nomeAlvo)}${formatarTelefone(fone) ? ' · ' + formatarTelefone(fone) : ''}`, zap(fone, texto)]] : [];
    mostrarLinks(botoes, `Link de pagamento pronto · ${brl(cob.valor)} (Asaas)`, { url: cob.link, texto, semFone: !fone });
  }

  // ---------------------------------------------------------------- eventos da janela
  let tBusca;
  document.addEventListener('input', (e) => {
    if (!ativo(estado) || !e.target.closest('#camada .modal')) return;
    const t = e.target;
    if (t.id === 'qResp') {
      const ctx = estado; estado.busca = t.value; clearTimeout(tBusca);
      const q = t.value.trim();
      tBusca = setTimeout(async () => {
        if (!ativo(ctx)) return;
        if (q.length < 2) { ctx.achados = []; const el = $('#achados'); if (el) el.innerHTML = ''; return; }
        let achados; try { achados = await office('/clientes?q=' + encodeURIComponent(q)); } catch (er) { if (ativo(ctx)) toast('Não foi possível buscar clientes: ' + er.message, true); return; }
        if (!ativo(ctx) || ctx.busca.trim() !== q) return; ctx.achados = achados;
        pintar(); const i = $('#qResp'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
      }, 280);
      return;
    }
    if (t.id === 'qVaga') {
      const ctx = estado, v = ctx.bv; if (!v) return; v.q = t.value; clearTimeout(tBusca);
      const q = t.value.trim();
      tBusca = setTimeout(async () => {
        if (!ativo(ctx) || !ctx.bv) return;
        if (q.length < 2) { ctx.bv.achados = []; pintar(); const i = $('#qVaga'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } return; }
        let achados; try { achados = await office('/clientes?q=' + encodeURIComponent(q)); } catch (er) { if (ativo(ctx)) toast('Não foi possível buscar clientes: ' + er.message, true); return; }
        if (!ativo(ctx) || !ctx.bv || ctx.bv.q.trim() !== q) return; ctx.bv.achados = achados;
        pintar(); const i = $('#qVaga'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
      }, 280);
      return;
    }
    if (t.dataset.reg) { estado.reg[t.dataset.reg] = t.value; return; }
    if (t.dataset.campo) {
      if (t.dataset.campo === 'telefone') {
        const limpo = t.value.replace(/\D/g, '').slice(0, 11);
        t.value = formatarTelefone(limpo);
      }
      if (!estado.g) {
        estado.rasc.pilotos[+t.dataset.i][t.dataset.campo] = t.value;
        guardarRascunho();
        const er = $('#erroGrupo'), f = faltaResp(estado.rasc), sb = $('#camada [data-salvar-grupo]'), ok = !f;
        if (er) er.textContent = estado.tentou ? f : (f ? 'Para salvar: ' + f.replace(/^Falta /, 'falta ') : '');
        if (sb) { sb.classList.toggle('quase', !ok); if (ok) sb.removeAttribute('aria-disabled'); else sb.setAttribute('aria-disabled', 'true'); }
        if (t.getAttribute('aria-invalid')) t.removeAttribute('aria-invalid');
      }
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
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || !ativo(estado) || estado.g || estado.ocupado || document.querySelector('.veuTopo') || !e.target.closest || !e.target.closest('#camada .modal')) return;
    const bt = $('#camada [data-qtd="' + (e.key === 'ArrowUp' ? 1 : -1) + '"]'); if (bt && !bt.disabled) { e.preventDefault(); bt.click(); setTimeout(() => { const f = $('#camada [data-qtd="' + (e.key === 'ArrowUp' ? 1 : -1) + '"]') || $('#camada [data-qtd]'); if (f) f.focus(); }, 0); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey) || !ativo(estado) || estado.g || estado.ocupado || document.querySelector('.veuTopo') || !e.target.closest || !e.target.closest('#camada .modal')) return;
    const bt = $('#camada [data-salvar-grupo]'); if (bt && !bt.disabled) { e.preventDefault(); bt.click(); }
  });
  document.addEventListener('toggle', (e) => { if (estado && e.target.dataset && e.target.dataset.detPag) estado.pagAberto = e.target.open; if (e.target.classList && e.target.classList.contains('menuCobrar')) { const sm = e.target.querySelector('summary'); if (sm) sm.setAttribute('aria-expanded', String(e.target.open)); const lista = e.target.querySelector('.menuCobrarLista'); if (sm && lista && e.target.open) { const r = sm.getBoundingClientRect(); lista.style.position = 'fixed'; const rod = e.target.closest('.modal')?.querySelector('.modalRodape'); const limite = (rod ? rod.getBoundingClientRect().top : window.innerHeight) - 8; lista.style.top = (r.bottom + 4 + lista.offsetHeight > limite ? Math.max(8, r.top - lista.offsetHeight - 4) : r.bottom + 4) + 'px'; lista.style.left = Math.max(8, Math.min(r.right - lista.offsetWidth, window.innerWidth - lista.offsetWidth - 8)) + 'px'; } } }, true);
  document.addEventListener('scroll', (e) => { if (e.target && e.target.classList && e.target.classList.contains('modalGrupoCorpo')) e.target.querySelectorAll('details.menuCobrar[open]').forEach((d) => d.removeAttribute('open')); }, true);
  document.addEventListener('change', async (e) => {
    if (!ativo(estado) || !e.target.closest('#camada .modal')) return;
    const t = e.target;
    if (t.dataset.reg) {
      estado.reg[t.dataset.reg] = t.value;
      if (t.dataset.reg === 'quem' && estado.g && t.value) { const p = estado.g.pilotos.find((x) => String(x.id) === t.value); const v = $('#camada [data-reg="valor"]'); if (p && v && !String(v.value).trim()) { v.value = (p.falta_centavos / 100).toFixed(2); estado.reg.valor = v.value; } }
      return;
    }
    if (t.dataset.preco) {
      const v = Math.round(parseFloat(String(t.value).replace(',', '.')) * 100);
      if (!Number.isFinite(v) || v <= 0) return toast('Informe um preço maior que zero.', true);
      if (estado.g) { estado.editarPreco = false; if (v === estado.g.preco) { pintar(); return; } await atualizar(() => office(`/grupos/${estado.g.id}`, { method: 'PUT', body: { precoCentavos: v } }), 'Preço atualizado'); }
      else { estado.rasc.preco = v; estado.rasc.precoManual = true; pintar(); }
      return;
    }
    if (t.dataset.sinal) {
      const v = Math.max(0, Math.min(100, Math.round(+t.value || 0)));
      if (estado.g) await atualizar(() => office(`/grupos/${estado.g.id}`, { method: 'PUT', body: { sinalPct: v } }));
      else { estado.rasc.sinalPct = v; pintar(); }
      return;
    }
    if (t.dataset.vincularPg && estado.g) {
      const pgId = +t.dataset.vincularPg, pilotoId = +t.value;
      if (!pgId || !pilotoId) return;
      await atualizar(() => office(`/grupos/${estado.g.id}/pagamentos/${pgId}`, { method: 'PATCH', body: { pilotoId } }), 'Pagamento vinculado ao piloto');
      return;
    }
    if (t.dataset.campo && estado.g) {
      const p = estado.g.pilotos[+t.dataset.i]; if (!p || p.responsavel) return;
      let val = t.value;
      if (t.dataset.campo === 'nome') {
        val = nomeBonito(t.value);
        t.value = val;
      }
      if (t.dataset.campo === 'telefone') {
        val = formatarTelefone(t.value);
        t.value = val;
      }
      const antes = { nome: p.nome, telefone: p.telefone, menor: p.menor };
      if (t.dataset.campo === 'telefone' || !t.closest('.linhaPilotoGrupo')?.querySelector('[data-campo="telefone"]')) estado.editandoLinha = null;
      if ((t.dataset.campo === 'nome' ? String(antes.nome || '') : formatarTelefone(antes.telefone)) === val) return;
      const corpo = { nome: t.dataset.campo === 'nome' ? val : p.nome, telefone: t.dataset.campo === 'telefone' ? val : p.telefone, menor: p.menor };
      const gid = estado.g.id;
      if (await atualizar(() => office(`/grupos/${gid}/pilotos/${p.id}`, { method: 'PUT', body: corpo }))) {
        toastAcao(`${t.dataset.campo === 'nome' ? 'Nome' : 'WhatsApp'} de ${nomeBonito(antes.nome) || 'piloto ' + p.ordem} alterado`, 'Desfazer', () => atualizar(() => office(`/grupos/${gid}/pilotos/${p.id}`, { method: 'PUT', body: antes }), 'Alteração desfeita'));
      }
    }
  });
  document.addEventListener('click', async (e) => {
    if (!ativo(estado) || !e.target.closest('#camada .modal')) return;
    const el = (s) => e.target.closest(s);
    const ctx = estado; if (ctx.ocupado) return;
    const { g, rasc, b } = ctx; let x0;
    if (e.target.closest('[data-grupo-atualizar]')) return refrescar(true);
    if ((x0 = el('[data-editar-linha]'))) { ctx.editandoLinha = +x0.dataset.editarLinha; pintar(); const ci = $(`#camada [data-campo="nome"][data-i="${ctx.editandoLinha}"]`); if (ci) { ci.focus(); ci.select(); } return; }
    if (el('[data-buscar-vaga]')) { ctx.bv = { i: +el('[data-buscar-vaga]').dataset.buscarVaga, q: '', achados: [] }; pintar(); const qi = $('#qVaga'); if (qi) { qi.focus(); qi.scrollIntoView({ block: 'center' }); } return; }
    if (el('[data-fechar-bv]')) { ctx.bv = null; pintar(); return; }
    if (el('[data-pick-vaga]')) {
      const c = JSON.parse(el('[data-pick-vaga]').dataset.pickVaga), i = ctx.bv ? ctx.bv.i : -1; if (i < 0) return;
      const menor = c.nascimento ? (new Date(`${c.nascimento}T00:00:00`) > new Date(new Date().setFullYear(new Date().getFullYear() - 18))) : false;
      ctx.bv = null;
      if (g) { const p = g.pilotos[i]; await atualizar(() => office(`/grupos/${g.id}/vincular`, { method: 'POST', body: { clienteId: c.id, pilotoId: p.id, puxarDados: true } }), `${nomeBonito(c.nome)} ocupou a vaga ${i + 1}`); }
      else { rasc.pilotos[i] = { ...rasc.pilotos[i], nome: c.nome, telefone: c.telefone, menor, clienteId: c.id }; guardarRascunho(); pintar(); toast(`${nomeBonito(c.nome)} na vaga ${i + 1}`); }
      return;
    }
    if (el('[data-conferir-asaas]')) {
      const btn = el('[data-conferir-asaas]');
      const rotulo = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `${svg(IC.sync, 12, 'currentColor')} Verificando Asaas…`;
      ctx.ocupado = true;
      try {
        const res = await office(`/grupos/${g.id}/conferir-asaas`, { method: 'POST' });
        if (!ativo(ctx)) return;
        ctx.g = res.grupo || g; ctx.conferidoEm = (() => { const a = new Date(); return `${pad(a.getHours())}:${pad(a.getMinutes())}`; })();
        pintar();
        ctx.aoMudar && ctx.aoMudar();
        if (res.pagas > 0) {
          toast(`${plural(res.pagas, 'novo pagamento recebido', 'novos pagamentos recebidos')} no Asaas.`);
        } else {
          toast('Conferido no Asaas: nenhum novo pagamento pendente.');
        }
      } catch (err) {
        if (ativo(ctx)) {
          btn.disabled = false;
          btn.innerHTML = rotulo;
          falhou(err);
        }
      } finally {
        ctx.ocupado = false;
      }
      return;
    }
    let x;
    if ((x = el('[data-resp]'))) { rasc.responsavel = JSON.parse(x.dataset.resp); rasc.pilotos[0].nome = rasc.responsavel.nome; rasc.pilotos[0].telefone = rasc.responsavel.telefone || ''; estado.achados = []; estado.busca = ''; pintar(); return; }
    if ((x = el('[data-origem]'))) { rasc.origem = x.dataset.origem; lembrar('origem', rasc.origem); if (!rasc.precoManual) rasc.preco = precoPara(rasc.origem, estado.b); pintar(); return; }
    if ((x = el('[data-preco-preset]'))) {
      const v = +x.dataset.precoPreset;
      if (!Number.isFinite(v) || v <= 0) return;
      if (g) await atualizar(() => office(`/grupos/${g.id}`, { method: 'PUT', body: { precoCentavos: v } }), `Valor ajustado para ${brl(v)}`);
      else { rasc.preco = v; rasc.precoManual = true; pintar(); }
      return;
    }
    if (el('[data-trocar-resp]')) { rasc.responsavel = null; rasc.pilotos[0].nome = ''; rasc.pilotos[0].telefone = ''; pintar(); return; }
    if ((x = el('[data-enviar-agora]'))) { estado.enviarAgora = !estado.enviarAgora; pintar(); return; }
    if (el('[data-trocar-modo]')) {
      const n = (g.pagamentos || []).length;
      if (!(await confirmar('Trocar a forma de pagamento?', `Esta reserva já tem ${plural(n, 'pagamento', 'pagamentos')}. Eles continuam registrados, mas o quanto cada pessoa ainda deve muda conforme a forma nova.`, 'Escolher outra forma')) || !ativo(ctx)) return;
      ctx.trocarModo = true; pintar(); const r = $('#camada [data-modo]'); if (r) r.focus(); return;
    }
    if (el('[data-alterar-preco]')) {
      if (!(await confirmar('Alterar o preço por piloto?', `Já há pagamento nesta reserva. O preço novo vale para os ${g.n} pilotos e muda o quanto falta para cada um. Quem já pagou continua com o valor pago.`, 'Alterar o preço')) || !ativo(ctx)) return;
      ctx.editarPreco = true; pintar(); const ip = $('#precoGrupo'); if (ip && ip.select) { ip.focus(); ip.select(); } return;
    }
    if (el('[data-aniv]') && g && (g.pagamentos || []).length && !(await confirmar(g.aniversario ? 'Desligar a promoção de aniversariante?' : 'Ligar a promoção de aniversariante?', g.aniversario ? `O responsável volta a pagar ${brl(g.preco)}.` : `Com ${ANIV_MIN} convidados ou mais, o responsável passa a pagar ${brl(ANIV_PRECO)}. Peça documento com foto no dia.`, g.aniversario ? 'Desligar' : 'Ligar a promoção'))) return;
    if (el('[data-aniv]')) { if (g) await atualizar(() => office(`/grupos/${g.id}`, { method: 'PUT', body: { aniversario: !g.aniversario } }), g.aniversario ? 'Promoção de aniversário removida' : 'Marcado como aniversariante'); else { rasc.aniversario = !rasc.aniversario; pintar(); } return; }
    if ((x = el('[data-modo]'))) { if (g) { ctx.trocarModo = false; if (x.dataset.modo === g.modo) { pintar(); return; } await atualizar(() => office(`/grupos/${g.id}`, { method: 'PUT', body: { modo: x.dataset.modo } }), 'Forma de pagamento atualizada'); } else { rasc.modo = x.dataset.modo; lembrar('modo', rasc.modo); pintar(); } return; }
    if ((x = el('[data-menor]'))) {
      const i = +x.dataset.menor;
      if (g) { const p = g.pilotos[i], antes = !!p.menor, gid = g.id; if (await atualizar(() => office(`/grupos/${gid}/pilotos/${p.id}`, { method: 'PUT', body: { nome: p.nome, telefone: p.telefone, menor: !antes } }))) toastAcao(`${nomeBonito(p.nome) || 'Piloto ' + p.ordem}: agora ${antes ? 'adulto' : 'menor de idade'}`, 'Desfazer', () => atualizar(() => office(`/grupos/${gid}/pilotos/${p.id}`, { method: 'PUT', body: { nome: p.nome, telefone: p.telefone, menor: antes } }), 'Alteração desfeita')); }
      else { rasc.pilotos[i].menor = !rasc.pilotos[i].menor; pintar(); }
      return;
    }
    if ((x = el('[data-qtd]'))) {
      const d = +x.dataset.qtd;
      if (g) {
        if (d > 0) await atualizar(() => office(`/grupos/${g.id}/pilotos`, { method: 'POST', body: {} }), 'Piloto adicionado · 1 vaga a menos no site');
        else { const ult = g.pilotos[g.pilotos.length - 1]; if (ult && !ult.responsavel) { if (!(await confirmar(`Tirar ${ult.nome || 'o piloto ' + ult.ordem} do grupo?`, `${ult.pago ? 'O pagamento será mantido no histórico, sem reembolso automático. ' : ''}A vaga volta para o site e o totem.`, 'Tirar do grupo', true)) || !ativo(ctx)) return; await atualizar(() => office(`/grupos/${g.id}/pilotos/${ult.id}`, { method: 'DELETE' }), 'Piloto tirado · vaga liberada'); } }
      } else {
        if (d > 0 && rasc.pilotos.length < +b.disponiveis) rasc.pilotos.push({ nome: '', telefone: '', menor: false });
        if (d < 0 && rasc.pilotos.length > 1) rasc.pilotos.pop();
        pintar();
      }
      return;
    }
    if ((x = el('[data-mover-piloto]'))) {
      const pid = +x.dataset.moverPiloto;
      if (g) {
        const p = g.pilotos.find((item) => item.id === pid);
        if (p) {
          abrirModalMoverPiloto(g, p, async () => {
            await refrescar();
            if (ctx.aoMudar) ctx.aoMudar();
          });
        }
      }
      return;
    }
    if ((x = el('[data-tirar]'))) {
      const i = +x.dataset.tirar;
      if (g) { const p = g.pilotos[i]; if (!(await confirmar(`Tirar ${p.nome || 'o piloto ' + p.ordem} do grupo?`, `${p.pago ? 'O pagamento será mantido no histórico, sem reembolso automático. ' : ''}A vaga volta para o site e o totem.`, 'Tirar do grupo', true)) || !ativo(ctx)) return; await atualizar(() => office(`/grupos/${g.id}/pilotos/${p.id}`, { method: 'DELETE' }), 'Piloto tirado · vaga liberada'); }
      else { rasc.pilotos.splice(i, 1); pintar(); }
      return;
    }
    if (el('[data-copiar-links]')) return copiar(linkDoGrupo(g), 'Link do grupo copiado');
    if (el('[data-copiar-painel]')) return copiar(g.linkPainel, 'Link do painel copiado');
    if (el('[data-enviar-painel]')) {
      const msg = `Olá, ${primeiro(g.responsavel)}! Acompanhe aqui o seu grupo no Kartódromo de Betim (${quando(g.inicio)}): quem já fez o cadastro e quem já pagou. Não compartilhe este link, ele é só seu: ${g.linkPainel}`;
      const fone = g.responsavelTelefone || '';
      if (!fone) return copiar(msg, 'Sem WhatsApp do responsável: mensagem copiada');
      window.open(zap(fone, msg), '_blank', 'noopener');
      return;
    }
    if (el('[data-enviar-grupo]')) {
      const fone = g.responsavelTelefone || '';
      if (!fone) return copiar(msgGrupo(g), 'Sem WhatsApp do responsável: mensagem com o link copiada');
      window.open(zap(fone, msgGrupo(g)), '_blank', 'noopener');
      await atualizar(() => office(`/grupos/${g.id}/links`, { method: 'POST', body: { pilotoIds: faltamLista(g) } }));
      return;
    }
    if (el('[data-voltar-horario]')) { const v = estado.voltar, r = estado.rasc; estado = null; fecharCamada(); return v && v(r); }
    if (el('[data-todos-pagos]')) {
      const faltam = g.pilotos.filter((p) => !p.pago && !vagaLivre(p));
      const forma = await escolherForma(`Marcar ${faltam.length} pilotos como pagos?`, `${faltam.map((p) => nomeBonito(p.nome) || 'Piloto ' + p.ordem).join(', ')}. Total ${brl(faltam.reduce((a, p) => a + p.falta_centavos, 0))}. As vagas livres ficam de fora. Como eles pagaram?`);
      if (!forma || !ativo(ctx)) return;
      ctx.ocupado = true;
      let pagosAgora = 0;
      try {
        for (const p of faltam) {
          if (!ativo(ctx)) { if (pagosAgora > 0) ctx.aoMudar && ctx.aoMudar(); return; }
          const atualP = (ctx.g && ctx.g.pilotos.find((x) => x.id === p.id)) || p;
          if (atualP.pago || !atualP.falta_centavos) continue;
          ctx.g = await office(`/grupos/${g.id}/pagamentos`, { method: 'POST', body: { pilotoId: p.id, valorCentavos: atualP.falta_centavos, forma: forma.trim() } });
          pagosAgora++;
        }
        if (!ativo(ctx)) { if (pagosAgora > 0) ctx.aoMudar && ctx.aoMudar(); return; }
        pintar(); ctx.aoMudar && ctx.aoMudar();
        toast(`${faltam.length} pagamentos registrados · aparecem pagos na Recepção`);
      } catch (er) {
        if (pagosAgora > 0) ctx.aoMudar && ctx.aoMudar();
        if (ativo(ctx)) {
          if (pagosAgora > 0) { pintar(); toast(`${pagosAgora} de ${faltam.length} registrados antes do erro: ${er.message}`, true); }
          else falhou(er);
        } else {
          falhou(er);
        }
      } finally { ctx.ocupado = false; }
      return;
    }
    if ((x = el('[data-link]'))) {
      const p = g.pilotos.find((y) => y.id === +x.dataset.link); const fone = destino(g, p);
      if (!fone) return toast('Coloque o WhatsApp do piloto (ou do responsável) primeiro.', true);
      window.open(zap(fone, msgCadastro(g, p)), '_blank', 'noopener');
      await atualizar(() => office(`/grupos/${g.id}/links`, { method: 'POST', body: { pilotoIds: [p.id] } }));
      return;
    }
    if ((x = el('[data-copiar-txt]'))) return copiar(x.dataset.copiarTxt || '', 'Copiado');
    if (el('[data-fechar-links]')) { const lk = $('#listaLinks'); if (lk) lk.innerHTML = ''; return; }
    if ((x = el('[data-ver-cobranca]'))) {
      { const d = x.closest('details.menuCobrar'); if (d) d.removeAttribute('open'); }
      const pid = x.dataset.verCobranca ? +x.dataset.verCobranca : null;
      const p = pid ? g.pilotos.find((y) => y.id === pid) : null;
      const cob = p ? p.cobranca : g.cobrancaGrupo;
      if (!cob || !cob.link) return toast('Link de pagamento ainda não foi gerado.', true);
      mostrarCobrancaPronta(g, p, cob);
      copiar(cob.link, `Link de ${brl(cob.valor)} copiado`);
      return;
    }
    if ((x = el('[data-cobrar]'))) {
      { const d = x.closest('details.menuCobrar'); if (d) d.removeAttribute('open'); }
      const pid = x.dataset.cobrar ? +x.dataset.cobrar : null;
      ctx.ocupado = true;
      const rotuloAntes = x.textContent; x.disabled = true; x.textContent = 'Gerando link…';
      try {
        const r = await office(`/grupos/${g.id}/cobrancas`, { method: 'POST', body: { pilotoId: pid } });
        if (!ativo(ctx)) return;
        estado.g = r.grupo; pintar();
        const p = pid ? estado.g.pilotos.find((y) => y.id === pid) : null;
        mostrarCobrancaPronta(estado.g, p, r);
        toast(r.reaproveitada ? 'Link de pagamento já existia · pronto para copiar ou enviar' : 'Link de pagamento criado no Asaas');
        if (ativo(ctx)) ctx.aoMudar && ctx.aoMudar();
      } catch (er) {
        if (!ativo(ctx)) return;
        x.disabled = false; x.textContent = rotuloAntes;
        const lk = $('#listaLinks');
        if (lk) lk.innerHTML = `<div class="aviso-faixa" role="alert">Não foi possível gerar o link de pagamento: ${esc(er.message)} <button type="button" class="btn link peq" data-cobrar="${x.dataset.cobrar || ''}">Tentar de novo</button> · ou use “Marcar como pago” se o cliente pagou por fora.</div>`;
        else falhou(er);
      } finally { ctx.ocupado = false; }
      return;
    }
    if ((x = el('[data-quitar-voucher]'))) {
      { const d = x.closest('details.menuCobrar'); if (d) d.removeAttribute('open'); }
      const pid = x.dataset.quitarVoucher ? +x.dataset.quitarVoucher : null;
      const p = pid ? g.pilotos.find((y) => y.id === pid) : null;
      const valor = p ? p.falta_centavos : g.falta;
      if (!valor) return toast('Esta vaga já está paga.');
      let sugerido = '';
      try {
        if (p && p.clienteId) {
          const vchs = await office('/vouchers/cliente?clienteId=' + p.clienteId);
          if (vchs.length) sugerido = vchs[0].codigo;
        }
      } catch {}
      const cod = await pedirVoucher(`Quitar vaga de ${esc(p ? (p.nome || 'Piloto ' + p.ordem) : g.responsavel)}`, `Valor da vaga: ${brl(valor)}. Digite o código do voucher:`, sugerido);
      if (!cod || !ativo(ctx)) return;
      const recebido = await atualizar(() => office(`/grupos/${g.id}/pagamentos`, {
        method: 'POST',
        body: { pilotoId: pid, valorCentavos: valor, forma: 'Voucher', voucherCodigo: cod, idempotencyKey: 'vch_' + g.id + '_' + (pid || 'g') + '_' + Date.now() },
      }), 'Vaga quitada com voucher');
      return;
    }
    if ((x = el('[data-recebi]'))) {
      { const d = x.closest('details.menuCobrar'); if (d) d.removeAttribute('open'); }
      const pid = x.dataset.recebi ? +x.dataset.recebi : null;
      const p = pid ? g.pilotos.find((y) => y.id === pid) : null;
      const valor = p ? p.falta_centavos : (g.modo === 'sinal' ? Math.max(0, g.sinal - g.pago) : g.falta);
      if (!valor) return toast('Não há valor a receber nesta cobrança.');
      const forma = await escolherForma(`Marcar ${brl(valor)} como pago?`, `${p ? (p.nome || 'Piloto ' + p.ordem) : g.responsavel} pagou por fora. Como foi o pagamento?`);
      if (!forma || !ativo(ctx)) return;
      let voucherCodigo = null;
      if (forma === 'Voucher') {
        let sugerido = '';
        try {
          if (p && p.clienteId) {
            const vchs = await office('/vouchers/cliente?clienteId=' + p.clienteId);
            if (vchs.length) sugerido = vchs[0].codigo;
          }
        } catch {}
        voucherCodigo = await pedirVoucher(`Quitar com voucher`, `Digite o código do voucher para ${esc(p ? (p.nome || 'Piloto ' + p.ordem) : g.responsavel)}:`, sugerido);
        if (!voucherCodigo || !ativo(ctx)) return;
      }
      const corpoPg = { pilotoId: pid, valorCentavos: valor, forma: forma.trim(), ...(voucherCodigo ? { voucherCodigo } : {}) };
      const recebido = await atualizar(() => office(`/grupos/${g.id}/pagamentos`, { method: 'POST', body: corpoPg }));
      if (!recebido) return;
      if (!ativo(ctx)) return;
      { const ult = estado.g && estado.g.pagamentos.slice(-1)[0], gid = g.id; if (ult) toastAcao(`${brl(valor)} registrado · aparece pago na Recepção`, 'Desfazer', async () => { const atualizado = await office(`/grupos/${gid}/pagamentos/${ult.id}`, { method: 'DELETE' }); if (ativo(ctx)) { ctx.g = atualizado; pintar(); ctx.aoMudar && ctx.aoMudar(); } toast('Pagamento desfeito'); }); }
      return;
    }
    if (el('[data-registrar]')) {
      if (g.modo === 'individual' && !ctx.reg.quem) return toast('Neste grupo cada um paga o seu: escolha de qual piloto é o pagamento.', true);
      const v = Math.round(parseFloat(String(estado.reg.valor).replace(',', '.')) * 100);
      if (!Number.isFinite(v) || v <= 0) return toast('Informe o valor recebido, maior que zero.', true);
      if (v > g.falta && !(await confirmar('Valor maior do que falta receber', `Você digitou ${brl(v)} e faltam ${brl(g.falta)}. Registrar mesmo assim?`, 'Registrar mesmo assim'))) return;
      if (!ativo(ctx)) return;
      let vchCod = ctx.reg.voucherCodigo ? String(ctx.reg.voucherCodigo).trim().toUpperCase() : null;
      if (ctx.reg.forma === 'Voucher' && !vchCod) {
        vchCod = await pedirVoucher('Código do voucher', 'Digite o código do voucher:');
        if (!vchCod || !ativo(ctx)) return;
      }
      const corpo = { pilotoId: ctx.reg.quem ? +ctx.reg.quem : null, valorCentavos: v, forma: ctx.reg.forma, ...(vchCod ? { voucherCodigo: vchCod } : {}) };
      if (!await atualizar(() => office(`/grupos/${g.id}/pagamentos`, { method: 'POST', body: corpo }), `${brl(v)} registrado`)) return;
      if (!ativo(ctx)) return; estado.reg = { valor: '', quem: '', forma: 'Pix', voucherCodigo: '' }; pintar();
      return;
    }
    if ((x = el('[data-estornar]'))) {
      if (!(await confirmar('Estornar este pagamento?', 'A vaga volta a ficar a pagar.', 'Estornar', true)) || !ativo(ctx)) return;
      await atualizar(() => office(`/grupos/${g.id}/pagamentos/${x.dataset.estornar}`, { method: 'DELETE' }), 'Pagamento estornado');
      return;
    }
    if (el('[data-cancelar-grupo]')) {
      if (!(await confirmar(`Cancelar a reserva de ${nomeBonito(g.responsavel)}?`, `${g.n} vagas voltam para o site e o totem. Os pagamentos serão mantidos no histórico, sem reembolso automático.`, 'Cancelar reserva', true)) || !ativo(ctx)) return;
      try { await office(`/grupos/${g.id}`, { method: 'DELETE' }); if (!ativo(ctx)) return; toast('Reserva cancelada · vagas liberadas'); fecharCamada(); ctx.aoMudar && ctx.aoMudar(); estado = null; } catch (er) { falhou(er); }
      return;
    }
    if ((x = el('[data-salvar-grupo]'))) {
      if (x.disabled || x.getAttribute('aria-busy') === 'true') return;
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
      const rotuloSalvar = x.textContent;
      x.disabled = true; x.setAttribute('aria-busy', 'true'); x.textContent = 'Salvando…';
      try {
        const pilotos = rasc.pilotos.map((p, i) => (i === 0 ? (rasc.responsavel ? { nome: rasc.responsavel.nome, telefone: rasc.responsavel.telefone, menor: !!p.menor } : { nome: p.nome, telefone: p.telefone, menor: !!p.menor }) : p));
        let novo = await office('/grupos', { method: 'POST', body: { bateriaId: b.id, ...(rasc.responsavel ? { responsavelId: rasc.responsavel.id } : { responsavelNovo: { nome: rasc.pilotos[0].nome, telefone: rasc.pilotos[0].telefone } }), origem: rasc.origem, modo: rasc.modo, precoCentavos: rasc.preco, sinalPct: rasc.sinalPct, aniversario: !!rasc.aniversario, pilotos } });
        for (let k = 1; k < rasc.pilotos.length; k++) {
          const cid = rasc.pilotos[k].clienteId, vaga = novo.pilotos && novo.pilotos[k];
          if (!cid || !vaga) continue;
          try { novo = await office(`/grupos/${novo.id}/vincular`, { method: 'POST', body: { clienteId: cid, pilotoId: vaga.id, puxarDados: true } }); }
          catch (er) { toast(`Vaga ${k + 1}: não deu para vincular o cadastro (${er.message})`, true); }
        }
        if (!ativo(ctx)) { try { sessionStorage.removeItem(chaveRasc(b)); } catch {} ctx.aoMudar && ctx.aoMudar(); return; }
        guardarRascunho(true); estado.g = novo; estado.rasc = null;
        { const gid = novo.id; toastAcao(`Reserva de ${plural(novo.n, 'piloto', 'pilotos')} salva · já aparece na Recepção, no site e no totem`, 'Desfazer', async () => { await office(`/grupos/${gid}`, { method: 'DELETE' }); if (ativo(ctx)) { fecharCamada(); estado = null; } toast('Reserva desfeita · vagas liberadas'); }); }
        pintar();
        if (ativo(ctx)) ctx.aoMudar && ctx.aoMudar();
        if (estado.enviarAgora) {
          await office(`/grupos/${novo.id}/links`, { method: 'POST', body: { pilotoIds: faltamLista(novo) } }).then((r) => { if (ativo(ctx)) { ctx.g = r; pintar(); } }).catch(() => {});
          if (!ativo(ctx)) return;
          const fone = novo.responsavelTelefone || '';
          mostrarLinks([[fone ? `Mandar o link do grupo para ${novo.responsavel} · ${fone}` : 'Copie o link do grupo e mande no WhatsApp', fone ? zap(fone, msgGrupo(novo)) : '#']], 'Link de cadastro do grupo');
        }
      } catch (er) { if (!ativo(ctx)) return falhou(er); const m = $('#erroGrupo'); if (m) { m.className = 'erroMsg empurra'; m.textContent = /vaga/i.test(er.message) ? er.message + ' Reduza a quantidade ou use “‹ Trocar horário”.' : er.message; } if (x.isConnected) { x.disabled = false; x.removeAttribute('aria-busy'); x.textContent = rotuloSalvar; } }
    }
  });

  return { cartoes, abrir, nova, refrescar, sujo, moverPiloto: abrirModalMoverPiloto, descartar: () => guardarRascunho(true) };
})();
