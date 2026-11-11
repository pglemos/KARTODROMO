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
  const nomeBonito = (n) => String(n || '').trim().toLowerCase().replace(/(^|[\s'\(\[\-])([\p{L}])/gu, (_, a, b) => a + b.toUpperCase()).replace(/\s(Da|De|Do|Das|Dos|E)(?=\s)/g, (x) => x.toLowerCase());
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
  const faltamLista = (g) => g.pilotos.filter((p) => p.cadastro !== 'completo').map((p) => p.id);
  const linkDoGrupo = (g) => { const r = (g.pilotos || []).find((p) => p.responsavel) || (g.pilotos || [])[0]; return g.linkGrupo || (r ? r.link : ''); };
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
    const n = Math.min(qtd || 2, Math.max(1, +b.disponiveis || 1));
    estado = {
      b, g: null, aoMudar, voltar, reg: { valor: '', quem: '', forma: 'Pix' }, enviarAgora: true, busca: '', achados: [],
      rasc: rascAnt ? { ...rascAnt, pilotos: Array.from({ length: n }, (_, i) => rascAnt.pilotos[i] || { nome: '', telefone: '', menor: false }) } : { responsavel: null, origem: lembrado('origem', ORIGENS.map((o) => o[0]), 'whatsapp'), modo: lembrado('modo', MODOS.map((m) => m[0]), 'individual'), preco: precoPara(lembrado('origem', ORIGENS.map((o) => o[0]), 'whatsapp'), b), precoManual: false, sinalPct: 30, pilotos: Array.from({ length: n }, () => ({ nome: '', telefone: '', menor: false })) },
    };
    estado.janela = modal('', 'Nova reserva'); estado.janela.style.maxWidth = '1140px';
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
            <h2 class="modalGrupoTitulo" style="font-size: 1.15rem;">Movimentar participante de grupo</h2>
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
                <b class="t-corpo" style="font-size: 13.5px; color: var(--kib-cor-texto-principal);">Colocar sozinho (reserva individual)</b>
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
                <b class="t-corpo" style="font-size: 13.5px; color: var(--kib-cor-texto-principal);">Mover para outro grupo</b>
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

          <div id="erroMoverPiloto" class="cor-erro peq" style="min-height: 18px; margin-top: 4px;"></div>

          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 10px; border-top: 1px solid var(--kib-cor-borda-sutil); padding-top: 12px;">
            <button type="button" class="btn link" data-acao="cancelarDlg">Cancelar</button>
            <button type="button" class="btn prim" id="btnConfirmarMoverPiloto">Confirmar movimentação</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(veu);

    const fechar = () => {
      veu.remove();
      document.removeEventListener('keydown', onKey, true);
      try { antes && antes.focus(); } catch {}
    };

    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(); }
    };
    document.addEventListener('keydown', onKey, true);

    const radioSozinho = veu.querySelector('input[value="sozinho"]');
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
      if (!bats || !Array.isArray(bats)) return;
      const outras = bats.filter((b) => b.id !== g.bateriaId && b.status !== 'cancelada' && (+b.disponiveis > 0));
      for (const b of outras) {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = `${b.nome || 'Bateria'} às ${horaDe(b.dataHora)} (${b.disponiveis} vagas livres)`;
        selBat.appendChild(opt);
      }
    }).catch(() => undefined);

    office(`/grupos?de=${dataIso}&ate=${dataIso}`).then((grupos) => {
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
      selGrupo.innerHTML = `<option value="">Erro ao carregar grupos (${err.message})</option>`;
    });

    veu.querySelector('[data-acao="fecharDlg"]').onclick = fechar;
    veu.querySelector('[data-acao="cancelarDlg"]').onclick = fechar;

    btnConfirmar.onclick = async () => {
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

      btnConfirmar.disabled = true;
      btnConfirmar.textContent = 'Movimentando...';

      try {
        const res = await office(`/grupos/${g.id}/pilotos/${p.id}/desvincular`, { method: 'POST', body });
        toast(res.mensagem || 'Participante movido.');
        fechar();
        if (aoConcluir) aoConcluir(res);
      } catch (e) {
        erroDiv.textContent = e.message || String(e);
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Confirmar movimentação';
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
    const max = Math.max(0, +(novo ? b.disponiveis : g.disponiveis) || 0) + (novo ? 0 : g.n);
    const pilotos = novo ? rasc.pilotos.map((p, i) => ({ ...p, ordem: i + 1, responsavel: i === 0 })) : g.pilotos;
    const pendentes = novo ? [] : g.pilotos.filter((p) => !p.pago);
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
      const rawNome = respExistente ? rasc.responsavel.nome : (p.nome || '');
      const rawFone = respExistente ? (rasc.responsavel.telefone || '') : (p.telefone || '');
      const nomeVal = rawNome;
      const foneVal = formatarTelefone(rawFone);
      let cad = ['cinza', 'Link será gerado ao salvar'], pg = ['cinza', brl(preco)], acoesCad = '', acoesPg = '';
      if (!novo) {
        cad = chipCad(p);
        if (modo === 'unico') { pg = p.pago ? ['verde', 'Pago pelo grupo'] : resp ? ['laranja', 'Paga o grupo · falta ' + brlCurto(g.falta)] : ['cinza', 'Responsável paga']; }
        else if (modo === 'sinal') { pg = p.pago ? ['verde', p.pagoNoCaixa ? 'Pago no caixa' : 'Pago'] : ['laranja', 'Resto ' + brlCurto(p.falta_centavos) + ' na recepção']; }
        else { pg = p.pago ? ['verde', p.pagoNoCaixa ? 'Pago no caixa' : 'Pago'] : p.valorPago > 0 ? ['laranja', `Pagou ${brlCurto(p.valorPago)} · falta ${brlCurto(p.falta_centavos)}`] : ['vermelho', 'Falta ' + brlCurto(p.falta_centavos)]; }
        if (!p.pago && (modo !== 'unico' || resp)) {
          acoesPg = `<details class="menuCobrar">
            <summary class="btnCobrarSumario" aria-haspopup="true" aria-expanded="false" title="Opções de cobrança">Cobrar</summary>
            <div class="menuCobrarLista" role="group" aria-label="Como cobrar ${esc(nomeVal || 'piloto ' + (i + 1))}">
              <button type="button" class="btn peq" data-cobrar="${modo === 'unico' ? '' : p.id}" title="Gera o link Asaas (Pix ou cartão) e abre o WhatsApp para enviar">${svg(IC.zap, 13, 'var(--kib-cor-marca-principal)')} Enviar link de pagamento</button>
              <button type="button" class="btn peq" data-recebi="${modo === 'unico' ? '' : p.id}" title="O cliente já pagou por fora (Pix direto, dinheiro, maquininha)">${svg(IC.ok, 13, 'var(--kib-cor-status-ok)')} Marcar como pago</button>
            </div>
          </details>`;
        }
      }
      const okVerde = !novo && p.pago && p.cadastro === 'completo';
      const iniciaisNome = nomeVal ? iniciais(nomeBonito(nomeVal)) : String(i + 1);

      return `<div class="linhaPilotoGrupo ${resp ? 'isResp' : ''}">
        <span class="avatar m" style="background: ${okVerde ? 'var(--kib-cor-estado-sucesso-texto)' : CORG[i % 6]}; color: var(--kib-branco); font-weight: 700;">${esc(iniciaisNome)}</span>
        <div style="display: flex; flex-direction: column; gap: 3px; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 6px; width: 100%;">
            ${respExistente ? `<span class="entrada" style="height: 36px; display: flex; align-items: center; font-size: var(--kib-fonte-tamanho-corpo); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; ${nomeVal ? '' : 'color: var(--mudo2)'}">${esc(nomeBonito(nomeVal) || 'Escolha o responsável')}</span>` : `<input class="entrada" style="height: 36px; font-size: var(--kib-fonte-tamanho-corpo); font-weight: 500;" value="${esc(nomeBonito(nomeVal))}" placeholder="${resp ? 'Nome do responsável' : 'Nome (ou deixe para o link)'}" aria-label="Nome do piloto ${i + 1}" title="${esc(nomeBonito(nomeVal))}" aria-describedby="erroGrupo" data-campo="nome" data-i="${i}" ${!novo && resp ? 'readonly' : ''}>`}
            ${resp ? `<span class="badgeRespTag" title="Responsável pela reserva">${svg(IC.ok, 10, 'currentColor')} RESPONSÁVEL</span>` : ''}
          </div>
          ${resp && respExistente ? '<span class="peq cor-apoio" style="font-size: 11px; line-height: 1">cliente já cadastrado · <button type="button" class="btn link peq" data-trocar-resp="1" style="font-size: 11px; padding: 0">Trocar</button></span>' : resp && novo ? '<span class="peq cor-apoio" style="font-size: 11px; line-height: 1">cliente novo: só nome e WhatsApp</span>' : ''}
          ${!resp && !p.clienteId ? `<button type="button" class="btn link peq" style="font-size: 11px; padding: 0; justify-content: flex-start; min-height: 0" data-buscar-vaga="${i}" aria-label="Buscar cadastro do piloto ${i + 1} por CPF, nome ou telefone">${svg(IC.busca, 11)} Buscar cadastro (CPF, nome ou telefone)</button>` : !resp && p.clienteId ? '<span class="peq cor-apoio" style="font-size: 11px; line-height: 1">cadastro puxado do banco</span>' : ''}
        </div>
        ${respExistente ? `<span class="mono peq" style="font-size: 12.5px; color: var(--kib-cor-texto-principal);">${esc(foneVal || '—')}</span>` : `<input class="entrada mono" style="height: 36px; font-size: 12.5px;" value="${esc(foneVal)}" placeholder="(31) 9 0000-0000" inputmode="tel" aria-label="WhatsApp do piloto ${i + 1}" aria-describedby="erroGrupo" data-campo="telefone" data-i="${i}" ${!novo && resp ? 'readonly' : ''}>`}
        <button type="button" class="btnToggleIdade ${p.menor ? 'menor' : 'adulto'}" role="switch" aria-checked="${!!p.menor}" data-menor="${i}" title="${p.menor ? 'Menor de idade (clique para mudar)' : 'Adulto (clique para mudar para Menor)'}"><span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor"></span> ${p.menor ? 'Menor' : 'Adulto'}</button>
        <div style="display: flex; align-items: center; min-width: 0;">
          ${novo ? `<span class="chipTotemStatus aguardando">${esc(cad[1])}</span>` : cad[0] === 'verde' ? `<span class="chipTotemStatus completo" title="Cadastro completo">${svg(IC.ok, 12, '#15803d', 2.2)} Pronto para o totem</span>` : `<span class="chipTotemStatus incompleto" title="${esc(cad[1])}">${svg(IC_ALERTA, 12, '#b45309', 2)} <span class="trunc">${esc(cad[1])}</span></span>`}
        </div>
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          ${novo ? `<span class="chipPgStatus aguardando">${esc(pg[1])}</span>` : pg[0] === 'verde' ? `<span class="chipPgStatus pago" title="${esc(pg[1])}">${svg(IC.ok, 12, '#15803d', 2.2)} ${esc(pg[1])}</span>` : pg[0] === 'vermelho' ? `<span class="chipPgStatus falta" title="${esc(pg[1])}">${svg(IC.fechar, 11, 'var(--kib-perigo-texto-escuro)', 2.5)} ${esc(pg[1])}</span>` : `<span class="chipPgStatus ${pg[0] === 'laranja' ? 'parcial' : 'aguardando'}" title="${esc(pg[1])}">${svg(IC_ALERTA, 11, '#b45309', 2)} ${esc(pg[1])}</span>`}
          ${acoesPg}
        </div>
        ${resp ? '<span></span>' : `<div style="display: flex; align-items: center; gap: 4px;">
          ${!novo && (p.clienteId || p.nome) ? `<button type="button" class="btn sec peq" style="display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; height: 26px; padding: 0 8px; color: var(--kib-cor-marca-principal); border-color: color-mix(in srgb, var(--kib-cor-marca-principal) 30%, transparent); font-weight: 600;" aria-label="Mover participante de grupo ou colocar sozinho" title="Grupo errado / Mover participante (colocar sozinho ou em outro grupo)" data-mover-piloto="${p.id}" data-piloto-nome="${esc(nomeVal || 'Piloto ' + (i + 1))}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg> Mover</button>` : ''}
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
      <span class="linha gap-1"><b class="t-corpo">Link de cadastro do grupo</b><span class="chip ${faltamCad.length ? 'laranja' : 'verde'} empurra">${faltamCad.length ? `faltam ${faltamCad.length} de ${g.n}` : 'todos cadastrados'}</span></span>
      <div class="linha-quebra gap-1" style="align-items: center"><input class="entrada peq mono cresce" style="flex: 1 1 280px; min-width: 0" readonly value="${esc(linkDoGrupo(g))}" aria-label="Link de cadastro do grupo" onfocus="this.select()"><button class="btn peq sec" data-copiar-links="1">Copiar</button><button class="btnZapWhatsApp peq" data-enviar-grupo="1">${svg(IC.zap, 13, 'var(--kib-branco)')} Enviar no WhatsApp</button></div>
      <span class="peq cor-apoio" style="line-height: 1.4">Mande o mesmo link para todo mundo (grupo de WhatsApp, por exemplo). Quem abrir e se cadastrar ocupa a próxima vaga livre${faltamCad.length ? ': ainda faltam ' + esc(faltamCad.map((p) => p.nome || 'piloto ' + p.ordem).join(', ')) : ''}.</span>
      ${g.linkPainel ? `<span class="linha gap-1" style="margin-top: var(--kib-espaco-1)"><b class="t-corpo">Painel do responsável</b><span class="peq cor-apoio">só para ${esc(primeiro(g.responsavel))}: mostra quem já se cadastrou e pagou</span></span>
      <div class="linha-quebra gap-1"><button class="btn peq sec" data-copiar-painel="1">Copiar link do painel</button><button class="btnZapWhatsApp peq" data-enviar-painel="1">${svg(IC.zap, 13, 'var(--kib-branco)')} Enviar ao responsável</button></div>` : ''}
    </div>`;
    const respOk = novo ? respValido(rasc) : true;
    const erroNovo = novo ? faltaResp(rasc) : '';
    const ajudaSalvar = novo && erroNovo && !estado.tentou ? 'Para salvar: ' + erroNovo.replace(/^Falta /, 'falta ') : '';
    m.style.maxWidth = 'min(1360px, calc(100% - 32px))';
    m.setAttribute('aria-label', novo ? 'Nova reserva' : 'Reserva ' + g.codigo);
    m.innerHTML = `
      <div class="modalGrupoTopo">
        <div class="modalGrupoTopoInfo">
          <h2 class="modalGrupoTitulo">${novo ? 'Nova reserva: quem vai correr?' : titulo}</h2>
          <div class="modalGrupoBadges">
            ${novo ? '' : `<span class="badgeCodigoReserva">Reserva ${esc(g.codigo)}</span>`}
            <span class="badgeDataBateria">${svg(IC.agenda, 14, 'var(--kib-cor-texto-secundario)')} ${quando(b.dataHora)}</span>
            <span class="badgeNomeBateria">${esc(b.nome || 'Bateria')}</span>
            ${novo && estado.voltar ? '<button type="button" class="btn link peq" data-voltar-horario="1" style="font-size: 12.5px;">‹ Trocar horário</button>' : ''}
          </div>
        </div>
        <button class="btnFecharModal hov" data-acao="fechar" aria-label="Fechar janela" title="Fechar (Esc)">
          ${svg(IC.fechar, 16, 'currentColor', 2.4)}
        </button>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: var(--kib-espaco-2); padding: var(--kib-espaco-2)">
        <div style="flex: 999 1 860px; min-width: 0; display: flex; flex-direction: column; gap: var(--kib-espaco-denso-12)">
          <section class="cartao leve">
            <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--kib-espaco-1) var(--kib-espaco-denso-12); padding: var(--kib-espaco-denso-12) var(--kib-espaco-2) var(--kib-espaco-1)">
              <div class="col" style="gap: 2px; flex: 1 1 260px">
                <b class="t-subtitulo" style="font-size: var(--kib-fonte-tamanho-subtitulo);">Pilotos do grupo</b>
                <span class="peq" style="line-height: 1.4; color: var(--kib-cor-texto-secundario);">${novo ? 'Cliente novo? Na linha 1 coloque só nome completo e WhatsApp: o resto ele completa pelo link do grupo. Ajuste ao lado quantas pessoas vão correr (1 = só ele).' : `<b>${g.cadastrados}</b> de ${g.n} prontos para o totem · <b>${g.pagos}</b> de ${g.n} pagos`}</span>
              </div>
              <div class="linha gap-1" style="align-items: center;">
                <span class="peq peso-semibold" style="color: var(--kib-cor-texto-principal);">Vagas do grupo:</span>
                <span class="passo"><button type="button" data-qtd="-1" aria-label="Um piloto a menos">−</button><span style="min-width: 28px; text-align: center; font-weight: 700;">${c.n}</span><button type="button" data-qtd="1" aria-label="Um piloto a mais" ${c.n >= max ? 'disabled' : ''}>+</button></span>
                <span class="peq" style="color: var(--kib-cor-texto-secundario);">até ${max}</span>
              </div>
            </div>
            ${novo ? `<div style="display: flex; flex-direction: column; gap: var(--kib-espaco-1); padding: 0 var(--kib-espaco-2) var(--kib-espaco-denso-12)">
              <label class="buscaCampo" style="height: 38px">${svg(IC.busca, 14, 'var(--kib-cor-borda-campo)')}<input id="qResp" value="${esc(estado.busca)}" placeholder="Já é cliente? Busque por nome, CPF ou telefone" autocomplete="off" aria-label="Buscar o responsável"></label>
              <div id="achados">${estado.achados.length ? `<div class="resultadoBusca">${estado.achados.slice(0, 10).map((x) => `<button type="button" class="hov" data-resp='${esc(JSON.stringify({ id: x.id, nome: x.nome, telefone: x.telefone, documento: x.documento }))}'><span class="avatar p" style="background: ${CORG[x.id % 6]}">${esc(iniciais(x.nome))}</span><span class="col"><b class="trunc">${esc(nomeBonito(x.nome))}</b><span class="peq">${esc(x.documento || 'sem CPF')} · ${esc(formatarTelefone(x.telefone) || 'sem telefone')}</span></span></button>`).join('')}</div>` : ''}</div>
              <span style="display: flex; flex-wrap: wrap; align-items: center; gap: var(--kib-espaco-1)"><span class="peq peso-semibold">Chegou por</span><span class="seg">${ORIGENS.map(([v, t]) => `<button type="button" data-origem="${v}" class="${rasc.origem === v ? 'sel' : ''}">${t}</button>`).join('')}</span><span class="peq">Não é cliente ainda? Sem problema: preencha nome e WhatsApp na linha 1.</span></span></div>` : ''}
            <div class="rolagemX">
              <div style="min-width: 860px">
                <div class="cabTabelaGrupo">
                  <span></span>
                  <span>Nome</span>
                  <span>WhatsApp</span>
                  <span>Idade</span>
                  <span>Cadastro do totem</span>
                  <span>Pagamento</span>
                  <span></span>
                </div>
                ${linhas}
              </div>
            </div>
            <div style="display: flex; flex-wrap: wrap; align-items: center; gap: var(--kib-espaco-1) var(--kib-espaco-denso-12); padding: var(--kib-espaco-denso-12) var(--kib-espaco-2); background: var(--kib-cor-superficie-suave); border-top: 1px solid var(--kib-cor-borda-sutil)">
              <button class="btn branco peq" data-qtd="1" ${c.n >= max ? 'disabled' : ''}>+ Adicionar piloto</button>
              <span class="peq cresce" style="flex: 1 1 220px; line-height: 1.4; color: var(--kib-cor-texto-secundario);">${novo ? 'Um link só para o grupo inteiro: aparece logo depois de salvar. Cada pessoa abre e se cadastra.' : 'Um link só para o grupo inteiro: cada pessoa que abrir ocupa uma vaga livre.'}</span>
            </div>
            ${blocoLinks}
            <div id="listaLinks"></div>
          </section>
          ${!novo ? `<section class="secao" style="padding: var(--kib-espaco-denso-12) var(--kib-espaco-2)"><div style="display: flex; align-items: center; justify-content: space-between; gap: var(--kib-espaco-1); margin-bottom: var(--kib-espaco-1)"><span class="titulo t-subtitulo" style="font-size: var(--kib-fonte-tamanho-subtitulo); margin: 0">Pagamentos recebidos<span class="peq" style="margin-left: 8px; font-weight: 500">${pagamentos.length || ''}</span></span><button type="button" class="btn peq sec" data-conferir-asaas="1" style="display: inline-flex; align-items: center; gap: 5px; height: 28px; font-size: var(--kib-fonte-tamanho-pequeno);" title="Verifica pagamentos Pix e cartão diretamente no Asaas">${svg(IC.sync, 12, 'currentColor')} Conferir no Asaas</button></div>
            ${pagamentos.map((pg) => `<div style="display: flex; align-items: center; gap: var(--kib-espaco-1); padding: var(--kib-espaco-1) 0; border-top: 1px solid var(--linha)"><span style="width: 28px; height: 28px; border-radius: var(--kib-raio-botao); display: flex; align-items: center; justify-content: center; color: var(--kib-cor-acao-sobre-principal); font-size: var(--kib-fonte-tamanho-pequeno); font-weight: 700; background: ${pg.pilotoId ? CORG[pg.pilotoId % 6] : 'var(--kib-cor-texto-principal)'}">${esc(pg.pilotoId ? iniciais(nomeBonito(nomeDe(pg.pilotoId))) : 'G')}</span><span class="col cresce"><b class="trunc">${esc(nomeBonito(pg.pilotoNome || nomeDe(pg.pilotoId)))}${pg.pilotoCancelado ? ' · vaga cancelada' : ''}</b><span class="peq">${esc(pg.forma)} · ${esc((pg.criadoEm || '').slice(8, 10) + '/' + (pg.criadoEm || '').slice(5, 7) + ' ' + (pg.criadoEm || '').slice(11, 16))}${pg.usuario ? ' · ' + esc(pg.usuario) : ''}</span></span><b class="mono cor-ok">${brl(pg.valor)}</b>${pg.origem === 'manual' ? `<button class="btn peq" style="background: transparent; color: var(--erroTxt)" data-estornar="${pg.id}">Estornar</button>` : ''}</div>`).join('') || '<span class="peq" style="color: var(--kib-cor-texto-secundario);">Nenhum pagamento ainda.</span>'}
            ${g.falta && g.pilotos.filter((p) => !p.pago).length > 1 && modo === 'individual' ? `<button type="button" class="btn sec peq" data-todos-pagos="1" style="width: fit-content; display: inline-flex; align-items: center; gap: 6px; margin-top: 8px;" title="Registra de uma vez o pagamento de todos que faltam">${svg(IC.ok, 13, 'currentColor')} Marcar todos como pagos</button>` : ''}
            <details class="maisOpcoes" ${estado.reg.valor ? 'open' : ''}><summary>Registrar outro valor recebido</summary>
            <div style="display: grid; grid-template-columns: 92px minmax(0, 1fr) 92px; gap: var(--kib-espaco-meio); padding-top: var(--kib-espaco-1)">
              <input class="entrada" style="height: 34px; font-size: var(--kib-fonte-tamanho-corpo)" type="number" min="0" step="0.01" placeholder="R$" aria-label="Valor recebido" data-reg="valor" value="${esc(estado.reg.valor)}">
              <select class="entrada" style="height: 34px; font-size: var(--kib-fonte-tamanho-pequeno); padding: 0 var(--kib-espaco-meio)" aria-label="Quem pagou" data-reg="quem"><option value="">Grupo (responsável)</option>${g.pilotos.map((p) => `<option value="${p.id}" ${String(estado.reg.quem) === String(p.id) ? 'selected' : ''}>${esc(nomeBonito(p.nome) || 'Piloto ' + p.ordem)}</option>`).join('')}</select>
              <select class="entrada" style="height: 34px; font-size: var(--kib-fonte-tamanho-pequeno); padding: 0 var(--kib-espaco-meio)" aria-label="Forma" data-reg="forma">${['Pix', 'Cartão', 'Dinheiro'].map((f) => `<option ${estado.reg.forma === f ? 'selected' : ''}>${f}</option>`).join('')}</select>
              <button class="btn escuro peq" style="grid-column: span 3; height: 34px" data-registrar="1">Registrar pagamento</button>
            </div></details></section>
          <details class="secao maisOpcoes"><summary class="titulo t-subtitulo">O que acontece sozinho (totem, Asaas, Recepção, sorteio e cronometragem)</summary>${integra.map(([t, d, st, ok, ic, cor]) => `<div style="display: flex; align-items: flex-start; gap: var(--kib-espaco-1)"><span class="tile" style="width: 28px; height: 28px; border-radius: var(--kib-raio-botao); background: ${cor}">${svg(ic, 14, 'var(--kib-cor-superficie-padrao)')}</span><span class="col" style="gap: 1px; flex-grow: 1"><b>${t}</b><span class="peq" style="line-height: 1.4">${d}</span></span><span class="chip ${ok ? 'verde' : 'laranja'}">${st}</span></div>`).join('')}</details>` : ''}
        </div>
        <div style="flex: 1 1 340px; min-width: 0; display: flex; flex-direction: column; gap: var(--kib-espaco-denso-12)">
          ${novo ? `<details class="secao maisOpcoes" data-det-pag="1" ${estado.pagAberto ? 'open' : ''}><summary class="titulo t-subtitulo">Como vai pagar: ${esc((MODOS.find((x) => x[0] === modo) || [])[1] || '')} · ${brl(preco)} por piloto · total ${brl(c.total)}</summary>` : ''}
          <section class="secao" style="padding: var(--kib-espaco-denso-12) var(--kib-espaco-2) var(--kib-espaco-2); gap: var(--kib-espaco-denso-12)">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: var(--kib-espaco-1)">
              <span class="titulo t-subtitulo" style="font-size: var(--kib-fonte-tamanho-subtitulo); margin: 0">Como o grupo vai pagar?</span>
              ${dica("Escolha uma opção: o responsável paga tudo em um link; cada piloto paga o seu; ou o responsável paga um sinal agora e o resto é acertado na recepção.", "como o grupo vai pagar")}
            </div>
            <div role="radiogroup" style="display: flex; flex-direction: column; gap: 8px">
              ${MODOS.map(([v, t, d]) => `
                <button type="button" role="radio" aria-checked="${modo === v}" data-modo="${v}" class="cardModoPagamento ${modo === v ? 'selecionado' : ''}">
                  <span class="radioCirculoIndicador"></span>
                  <span class="col" style="gap: 2px">
                    <b class="t-corpo" style="font-size: 13.5px; color: var(--kib-cor-texto-principal);">${t}</b>
                    <span class="peq" style="line-height: 1.35; color: var(--kib-cor-texto-secundario);">${d}</span>
                  </span>
                </button>
              `).join('')}
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--kib-espaco-1)">
              <div class="cardMetricaFinanceira">
                <span class="cardMetricaFinanceiraLabel">Preço por piloto${novo ? (rasc.origem === 'recepcao' ? ' · balcão' : ' · antecipado') : ''}</span>
                <div style="display: flex; align-items: center; gap: 4px; height: 32px">
                  <span style="font-size: var(--kib-fonte-tamanho-corpo); font-weight: 600; color: var(--kib-cor-texto-secundario);">R$</span>
                  <input type="number" min="0" step="0.01" value="${(preco / 100).toFixed(2)}" data-preco="1" style="width: 100%; border: 0; outline: none; background: transparent; font-size: var(--kib-fonte-tamanho-titulo); font-weight: 700; color: var(--kib-cor-texto-principal); font-family: var(--kib-fonte-familia-numero);">
                </div>
              </div>
              ${modo === 'sinal' ? `
                <div class="cardMetricaFinanceira">
                  <span class="cardMetricaFinanceiraLabel">Sinal agora (%)</span>
                  <div style="display: flex; align-items: center; gap: 4px; height: 32px">
                    <input type="number" min="0" max="100" step="5" value="${sinalPct}" data-sinal="1" style="width: 100%; border: 0; outline: none; background: transparent; font-size: var(--kib-fonte-tamanho-titulo); font-weight: 700; color: var(--kib-cor-texto-principal); font-family: var(--kib-fonte-familia-numero);">
                    <span style="font-size: var(--kib-fonte-tamanho-corpo); font-weight: 600; color: var(--kib-cor-texto-secundario);">%</span>
                  </div>
                </div>
              ` : `
                <div class="cardMetricaFinanceira">
                  <span class="cardMetricaFinanceiraLabel">Total da reserva (${c.n} karts)</span>
                  <div style="display: flex; align-items: center; height: 32px">
                    <span class="num" style="font-size: var(--kib-fonte-tamanho-titulo); font-weight: 700; color: var(--kib-cor-texto-principal);">${brl(c.total)}</span>
                  </div>
                </div>
              `}
            </div>
            <div style="display: flex; flex-direction: column; gap: var(--kib-espaco-1); padding: var(--kib-espaco-denso-12); border-radius: var(--kib-raio-cartao); background: var(--kib-cor-superficie-padrao); border: 1px solid var(--kib-cor-borda-sutil);">
              <div style="display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                <div style="display: flex; align-items: baseline; gap: 6px;">
                  <span class="num t-titulo-grande peso-negrito" style="font-size: 1.4rem; color: var(--kib-cor-texto-principal);">${brl(c.pago)}</span>
                  <span class="peq" style="color: var(--kib-cor-texto-secundario);">de ${brl(c.total)}</span>
                </div>
                <span class="chipPgStatus ${novo ? 'aguardando' : c.falta ? 'parcial' : 'pago'}">
                  ${novo ? 'Cobra após salvar' : c.falta ? 'Falta ' + brl(c.falta) : svg(IC.ok, 12, 'var(--kib-sucesso-texto-escuro)') + ' Tudo pago'}
                </span>
              </div>
              <div class="barra" style="height: 7px; border-radius: var(--kib-raio-chip); background: color-mix(in srgb, var(--kib-cor-texto-principal) 8%, transparent); overflow: hidden; display: flex;">
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
                  <span class="peq" style="font-weight: 600; color: var(--kib-cor-texto-principal);">Falta pagar (${pendentes.length} piloto${pendentes.length > 1 ? 's' : ''}):</span>
                  <div class="chipsPendentesLista">
                    ${pendentes.slice(0, 6).map((p) => `<span class="chipPilotoPendente" title="Pendente: ${brlCurto(p.falta_centavos)}">${esc(nomeBonito(p.nome) || 'Piloto ' + p.ordem)}</span>`).join('')}
                    ${pendentes.length > 6 ? `<span class="chipPilotoPendenteMais" title="${pendentes.slice(6).map((p) => nomeBonito(p.nome) || 'Piloto ' + p.ordem).join(', ')}">+${pendentes.length - 6} outros</span>` : ''}
                  </div>
                </div>
              `}
            </div>
            ${!novo ? `
              <div style="display: flex; flex-direction: column; gap: var(--kib-espaco-1); padding: var(--kib-espaco-denso-12); border-radius: var(--kib-raio-cartao); background: linear-gradient(135deg, color-mix(in srgb, var(--kib-cor-estado-info-solido) 6%, transparent), color-mix(in srgb, var(--kib-cor-marca-principal) 6%, transparent)); border: 1px solid color-mix(in srgb, var(--kib-cor-estado-info-solido) 18%, transparent);">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="width: 26px; height: 26px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; background: var(--kib-acao-info); color: var(--kib-branco); font-size: var(--kib-fonte-tamanho-corpo); font-weight: 800;">A</span>
                    <b style="font-size: 13.5px; color: var(--kib-cor-texto-principal);">Asaas · Pix e cartão</b>
                  </div>
                  <span class="chipPgStatus ${!g.falta ? 'pago' : g.pago ? 'parcial' : 'aguardando'}">
                    ${!g.falta ? 'Pago' : g.pago ? 'Parcial' : 'Aguardando'}
                  </span>
                </div>
                <span class="peq" style="line-height: 1.45; color: var(--kib-cor-texto-secundario);">
                  ${modo === 'individual' ? `Cada piloto paga sua vaga (${brl(preco)}) pelo link do grupo. O botão “Cobrar” no piloto gera um link avulso.` : modo === 'sinal' ? `Sinal: ${brl(g.sinal)} (${sinalPct}%). O restante cada piloto acerta na recepção.` : `Cobrança total do grupo: ${brl(g.falta)}.`}
                </span>
                ${modo !== 'individual' && g.falta && (modo !== 'sinal' || g.sinal > g.pago) ? `<button class="btn prim peq" data-cobrar="" style="margin-top: 4px;">Gerar e enviar link ao responsável</button>` : ''}
                ${g.cobrancaGrupo ? `<a class="mono peq trunc" target="_blank" rel="noopener" href="${esc(g.cobrancaGrupo.link)}" style="padding: 6px 8px; border-radius: 6px; background: var(--kib-cor-superficie-padrao); border: 1px solid var(--kib-cor-borda-sutil); color: var(--kib-cor-texto-link);">${esc(g.cobrancaGrupo.link)}</a>` : ''}
              </div>
            ` : ''}
          </section>${novo ? '</details>' : ''}
        </div>
      </div>
      <div class="modalRodape" style="display: flex; align-items: center; gap: var(--kib-espaco-1); padding: 12px var(--kib-espaco-denso-20); background: var(--kib-cor-superficie-padrao); border-top: 1px solid var(--kib-cor-borda-sutil);">
        ${novo ? `<button type="button" role="switch" aria-checked="${estado.enviarAgora}" data-enviar-agora="1" style="display: flex; align-items: center; gap: var(--kib-espaco-1); padding: 0; border: 0; background: transparent; font-size: var(--kib-fonte-tamanho-corpo); font-weight: 600; color: var(--kib-cor-texto-principal); cursor: pointer;"><span class="chave ${estado.enviarAgora ? 'on' : ''}"></span>Depois de salvar, já mostrar o link de cadastro do grupo para mandar no WhatsApp</button>` : `<button class="btn perigo peq" data-cancelar-grupo="1">Cancelar reserva</button>`}
        <span class="${estado.tentou ? 'erroMsg' : 'ajuda-campo'} empurra" id="erroGrupo" role="alert" style="font-size: 12.5px;">${estado.tentou ? erroNovo : ajudaSalvar}</span>
        ${novo ? '' : '<button class="btn sec peq" data-grupo-atualizar>Atualizar</button>'}<button class="btn sec peq" data-acao="fechar">${novo ? 'Cancelar' : 'Fechar'}</button>
        ${novo ? `<button class="btn prim peq ${respOk ? '' : 'quase'}" data-salvar-grupo="1" aria-describedby="erroGrupo" ${respOk ? '' : 'aria-disabled="true"'} title="Salvar reserva (Ctrl+Enter)">Salvar reserva de ${c.n} piloto${c.n > 1 ? 's' : ''}</button>` : ''}
      </div>`;
  }

  async function atualizar(acao, msg) {
    const ctx = estado; if (!ativo(ctx) || ctx.ocupado) return false;
    ctx.ocupado = true;
    try {
      const g = await acao(); if (!ativo(ctx)) return false;
      ctx.g = g; pintar(); if (msg) toast(msg); ctx.aoMudar && ctx.aoMudar(); return true;
    } catch (e) { if (ativo(ctx)) falhou(e, () => { if (ativo(ctx)) atualizar(acao, msg); }); return false; }
    finally { ctx.ocupado = false; }
  }

  async function refrescar(forcar = false) {
    const ctx = estado; if (!ativo(ctx) || !ctx.g || ctx.ocupado || ctx.reg.valor || ctx.reg.quem || (!forcar && ctx.janela.contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName))) return;
    try {
      if (forcar) {
        ctx.ocupado = true;
        const res = await office(`/grupos/${ctx.g.id}/conferir-asaas`, { method: 'POST' }).catch(() => null);
        ctx.ocupado = false;
        if (res && res.grupo) {
          ctx.g = res.grupo;
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

  function mostrarLinks(lista, titulo) {
    const el = $('#listaLinks'); if (!el) return;
    el.innerHTML = `<div style="padding: var(--kib-espaco-denso-12) var(--kib-espaco-2) var(--kib-espaco-denso-12); display: flex; flex-direction: column; gap: var(--kib-espaco-meio); border-top: 1px solid var(--linha); background: color-mix(in srgb, var(--kib-cor-status-ok) 5%, transparent)"><b>${esc(titulo)}</b><span class="peq">Toque em cada um: abre o WhatsApp com a mensagem pronta.</span>${lista.map(([rot, href]) => `<a class="btn verdeClaro peq" style="justify-content: flex-start" target="_blank" rel="noopener" href="${esc(href)}">${svg(IC.zap, 13, 'var(--kib-cor-estado-sucesso-texto)')} ${esc(rot)}</a>`).join('')}</div>`;
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
        const er = $('#erroGrupo'), f = faltaResp(estado.rasc);
        if (er) er.textContent = estado.tentou ? f : (f ? 'Para salvar: ' + f.replace(/^Falta /, 'falta ') : '');
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
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || !estado || estado.g || !e.target.closest || !e.target.closest('#camada .modal')) return;
    const bt = $('#camada [data-qtd="' + (e.key === 'ArrowUp' ? 1 : -1) + '"]'); if (bt && !bt.disabled) { e.preventDefault(); bt.click(); setTimeout(() => { const f = $('#camada [data-qtd="' + (e.key === 'ArrowUp' ? 1 : -1) + '"]') || $('#camada [data-qtd]'); if (f) f.focus(); }, 0); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey) || !estado || estado.g || !e.target.closest || !e.target.closest('#camada .modal')) return;
    const bt = $('#camada [data-salvar-grupo]'); if (bt && !bt.disabled) { e.preventDefault(); bt.click(); }
  });
  document.addEventListener('toggle', (e) => { if (estado && e.target.dataset && e.target.dataset.detPag) estado.pagAberto = e.target.open; if (e.target.classList && e.target.classList.contains('menuCobrar')) { const sm = e.target.querySelector('summary'); if (sm) sm.setAttribute('aria-expanded', String(e.target.open)); } }, true);
  document.addEventListener('change', async (e) => {
    if (!ativo(estado) || !e.target.closest('#camada .modal')) return;
    const t = e.target;
    if (t.dataset.reg) { estado.reg[t.dataset.reg] = t.value; return; }
    if (t.dataset.preco) {
      const v = Math.round(parseFloat(String(t.value).replace(',', '.')) * 100);
      if (!(v > 0)) return toast('Informe um preço maior que zero.', true);
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
      let val = t.value;
      if (t.dataset.campo === 'nome') {
        val = nomeBonito(t.value);
        t.value = val;
      }
      if (t.dataset.campo === 'telefone') {
        val = formatarTelefone(t.value);
        t.value = val;
      }
      const corpo = { nome: t.dataset.campo === 'nome' ? val : p.nome, telefone: t.dataset.campo === 'telefone' ? val : p.telefone, menor: p.menor };
      await atualizar(() => office(`/grupos/${estado.g.id}/pilotos/${p.id}`, { method: 'PUT', body: corpo }));
    }
  });
  document.addEventListener('click', async (e) => {
    if (!ativo(estado) || !e.target.closest('#camada .modal')) return;
    const el = (s) => e.target.closest(s);
    const ctx = estado; if (ctx.ocupado) return;
    const { g, rasc, b } = ctx;
    if (e.target.closest('[data-grupo-atualizar]')) return refrescar(true);
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
        ctx.g = res.grupo || g;
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
        else { const ult = g.pilotos[g.pilotos.length - 1]; if (ult && !ult.responsavel) { if (!confirm(`Tirar ${ult.nome || 'o piloto ' + ult.ordem} do grupo? A vaga volta para o site e o totem. Pagamentos serão mantidos no histórico, sem reembolso automático.`)) return; await atualizar(() => office(`/grupos/${g.id}/pilotos/${ult.id}`, { method: 'DELETE' }), 'Piloto tirado · vaga liberada'); } }
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
      const faltam = g.pilotos.filter((p) => !p.pago);
      const forma = await escolherForma(`Marcar ${faltam.length} pilotos como pagos?`, `Total ${brl(faltam.reduce((a, p) => a + p.falta_centavos, 0))}. Como eles pagaram?`);
      if (!forma || !ativo(ctx)) return;
      ctx.ocupado = true;
      try { for (const p of faltam) { if (!ativo(ctx)) return; ctx.g = await office(`/grupos/${g.id}/pagamentos`, { method: 'POST', body: { pilotoId: p.id, valorCentavos: p.falta_centavos, forma: forma.trim() } }); } if (!ativo(ctx)) return; pintar(); if (ativo(ctx)) ctx.aoMudar && ctx.aoMudar(); toast(`${faltam.length} pagamentos registrados · aparecem pagos na Recepção`); } catch (er) { if (ativo(ctx)) falhou(er); } finally { ctx.ocupado = false; }
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
      ctx.ocupado = true;
      const rotuloAntes = x.textContent; x.disabled = true; x.textContent = 'Gerando link…';
      try {
        const r = await office(`/grupos/${g.id}/cobrancas`, { method: 'POST', body: { pilotoId: pid } });
        if (!ativo(ctx)) return;
        estado.g = r.grupo; pintar();
        const p = pid ? estado.g.pilotos.find((y) => y.id === pid) : null;
        const fone = p ? destino(estado.g, p) : estado.g.responsavelTelefone;
        const texto = `Olá${p && p.nome ? ', ' + primeiro(p.nome) : ', ' + primeiro(estado.g.responsavel)}! Segue o link para pagar ${p ? 'sua vaga' : 'a reserva do grupo'} na bateria do Kartódromo de Betim (${quando(estado.g.inicio)}): ${brl(r.valor)} por Pix ou cartão — ${r.link}`;
        if (fone) mostrarLinks([[`Mandar o link de ${brl(r.valor)} para ${p ? (p.nome || 'piloto ' + p.ordem) : estado.g.responsavel}`, zap(fone, texto)]], 'Link de pagamento pronto (Asaas)');
        toast(r.reaproveitada ? 'Link de pagamento já existia · pode reenviar' : 'Link de pagamento criado no Asaas');
        if (ativo(ctx)) ctx.aoMudar && ctx.aoMudar();
      } catch (er) {
        if (!ativo(ctx)) return;
        x.disabled = false; x.textContent = rotuloAntes;
        const lk = $('#listaLinks');
        if (lk) lk.innerHTML = `<div class="aviso-faixa" role="alert">Não consegui gerar o link de pagamento: ${esc(er.message)} <button type="button" class="btn link peq" data-cobrar="${x.dataset.cobrar || ''}">Tentar de novo</button> · ou use “Marcar como pago” se o cliente pagou por fora.</div>`;
        else falhou(er);
      } finally { ctx.ocupado = false; }
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
      const recebido = await atualizar(() => office(`/grupos/${g.id}/pagamentos`, { method: 'POST', body: { pilotoId: pid, valorCentavos: valor, forma: forma.trim() } }));
      if (!recebido) return;
      if (!ativo(ctx)) return;
      { const ult = estado.g && estado.g.pagamentos.slice(-1)[0], gid = g.id; if (ult) toastAcao(`${brl(valor)} registrado · aparece pago na Recepção`, 'Desfazer', async () => { const atualizado = await office(`/grupos/${gid}/pagamentos/${ult.id}`, { method: 'DELETE' }); if (ativo(ctx)) { ctx.g = atualizado; pintar(); ctx.aoMudar && ctx.aoMudar(); } toast('Pagamento desfeito'); }); }
      return;
    }
    if (el('[data-registrar]')) {
      const v = Math.round(parseFloat(String(estado.reg.valor).replace(',', '.')) * 100);
      if (!(v > 0)) return toast('Informe o valor recebido, maior que zero.', true);
      if (v > g.falta && !(await confirmar('Valor maior do que falta receber', `Você digitou ${brl(v)} e faltam ${brl(g.falta)}. Registrar mesmo assim?`, 'Registrar mesmo assim'))) return;
      if (!ativo(ctx)) return;
      const corpo = { pilotoId: ctx.reg.quem ? +ctx.reg.quem : null, valorCentavos: v, forma: ctx.reg.forma };
      if (!await atualizar(() => office(`/grupos/${g.id}/pagamentos`, { method: 'POST', body: corpo }), `${brl(v)} registrado`)) return;
      if (!ativo(ctx)) return; estado.reg = { valor: '', quem: '', forma: 'Pix' }; pintar();
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
        const pilotos = rasc.pilotos.map((p, i) => (i === 0 ? (rasc.responsavel ? { nome: rasc.responsavel.nome, telefone: rasc.responsavel.telefone, menor: !!p.menor } : { nome: p.nome, telefone: p.telefone, menor: !!p.menor }) : p));
        let novo = await office('/grupos', { method: 'POST', body: { bateriaId: b.id, ...(rasc.responsavel ? { responsavelId: rasc.responsavel.id } : { responsavelNovo: { nome: rasc.pilotos[0].nome, telefone: rasc.pilotos[0].telefone } }), origem: rasc.origem, modo: rasc.modo, precoCentavos: rasc.preco, sinalPct: rasc.sinalPct, pilotos } });
        for (let k = 1; k < rasc.pilotos.length; k++) {
          const cid = rasc.pilotos[k].clienteId, vaga = novo.pilotos && novo.pilotos[k];
          if (!cid || !vaga) continue;
          try { novo = await office(`/grupos/${novo.id}/vincular`, { method: 'POST', body: { clienteId: cid, pilotoId: vaga.id, puxarDados: true } }); }
          catch (er) { toast(`Vaga ${k + 1}: não deu para vincular o cadastro (${er.message})`, true); }
        }
        if (!ativo(ctx)) { try { sessionStorage.removeItem(chaveRasc(b)); } catch {} return; }
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
      } catch (er) { if (!ativo(ctx)) return; const m = $('#erroGrupo'); if (m) { m.className = 'erroMsg empurra'; m.textContent = /vaga/i.test(er.message) ? er.message + ' Reduza a quantidade ou use "‹ Trocar horário".' : er.message; } x.disabled = false; x.removeAttribute('aria-busy'); x.textContent = 'Salvar reserva'; }
    }
  });

  return { cartoes, abrir, nova, refrescar, sujo, moverPiloto: abrirModalMoverPiloto, descartar: () => guardarRascunho(true) };
})();
