/* Agenda: as funções de bateria da Recepção no painel web.
   Nova bateria · editar · abrir/fechar · excluir · gerar baterias do mês · fechar o dia · mover cliente (pago ou não) de bateria ou de dia.
   Usa as rotas do servidor da operação: POST/PUT/DELETE /baterias, /baterias/:id/status, /baterias/gerar, /baterias/fechar-dia, /reservas/:id/mover.
   O app.js chama AgendaAcoes.montar (cabeçalho) e AgendaAcoes.gaveta (gaveta da bateria). */
'use strict';

const AgendaAcoes = (() => {
  let C = null; // { tela, A, bats(), recarregar(), carregar(), abrir(id) }
  let apoio = null;
  const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const permitido = () => podeTela('agenda', 'alterar');
  const carregarApoio = async () => (apoio ||= await office('/apoio'));
  const agoraLocal = () => { const d = new Date(); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  // já correu = o horário passou; "fechada" é outra coisa (o app trata as duas como "fim")
  const passou = (b) => { const dia = b.dataHora.slice(0, 10), hoje = hojeIso(); return dia < hoje || (dia === hoje && hm(horaDe(b.dataHora)) + 35 <= agoraMin()); };
  const dataBr = (iso) => { const [a, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${a}`; };
  const diaExtenso = (iso) => { const d = deIso(iso); return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`; };
  const voltar = (id) => { if (id) C.abrir(id); else fecharCamada(); };
  const rodapeModal = (extra = '') => `<div class="modalRodape">${extra}</div>`;
  const estaFechada = (b) => b.status === 'fechada' || !!b.reservaFechada;
  // abrir: deixa a bateria realmente aberta (status e tipo); fechar: tipo "fechada" (sai do site e do totem, quem já reservou continua)
  async function abrirBateria(b) {
    if (b.status === 'fechada') await office(`/baterias/${b.id}/status`, { method: 'POST', body: { status: 'aberta' } });
    if (b.reservaFechada) await office(`/baterias/${b.id}/tipo`, { method: 'POST', body: { tipo: 'aberta' } });
  }
  const fecharBateria = (b) => office(`/baterias/${b.id}/tipo`, { method: 'POST', body: { tipo: 'fechada' } });
  const tipoDe = (b) => (b.reservaFechada ? 'fechada' : (b.autoAtendimento === false || b.autoAtendimento === 0) ? 'bloqueada' : 'aberta');
  const TIPOS_RESERVA = [['aberta', 'Vagas abertas', 'site, totem e Recepção'], ['fechada', 'Bateria fechada para novos', 'só o grupo, sai do site'], ['bloqueada', 'Bloqueada', 'só a Recepção vende']];
  const flagsDoTipo = (t) => ({ reservaFechada: t === 'fechada', autoAtendimento: t === 'aberta' });

  // ------------------------------------------------------------------ nova bateria / editar
  async function formBateria(b, diaPadrao) {
    const novo = !b;
    const m = modal('<div class="esqueleto" style="height: 360px; margin: var(--kib-espaco-denso-20)"></div>', novo ? 'Nova bateria' : 'Editar bateria');
    m.style.maxWidth = '680px';
    let ap; try { ap = await carregarApoio(); } catch (e) { falhou(e); return voltar(b && b.id); }
    const produtos = ap.produtos.filter((p) => p.ativo || (b && p.id === b.produtoId));
    const dia = novo ? diaPadrao : b.dataHora.slice(0, 10), hora = novo ? '' : b.dataHora.slice(11, 16);
    const tipo = novo ? 'aberta' : tipoDe(b);
    m.innerHTML = `<div class="modalTopo"><span class="col" style="gap: var(--kib-espaco-meio)"><span style="font-size: var(--kib-fonte-tamanho-titulo); font-weight: 700">${novo ? 'Nova bateria' : 'Editar bateria'}</span><span class="peq">${novo ? 'Cria um horário na agenda, igual à Recepção' : `${diaExtenso(dia)} · ${hora}`}</span></span></div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: var(--kib-espaco-denso-12); padding: var(--kib-espaco-2) var(--kib-espaco-3)">
        <label class="campo"><span>Nome</span><input class="entrada" id="bNome" maxlength="100" value="${esc(novo ? 'BATERIA' : b.nome || '')}"></label>
        <label class="campo"><span>Data</span><input class="entrada" id="bData" type="date" value="${dia}"></label>
        <label class="campo"><span>Hora</span><input class="entrada" id="bHora" type="time" value="${hora}"></label>
        <label class="campo"><span>Produto</span><select class="entrada" id="bProduto"><option value="">Escolha</option>${produtos.map((p) => `<option value="${p.id}" ${b && p.id === b.produtoId ? 'selected' : ''}>${esc(p.nome)} · ${brl(p.preco)}</option>`).join('')}</select></label>
        <label class="campo"><span>Vagas (máximo de pilotos)</span><input class="entrada" id="bVagas" type="number" min="1" max="60" inputmode="numeric" value="${novo ? 12 : b.vagas}"></label>
        <label class="campo"><span>Traçado</span><select class="entrada" id="bTracado"><option value="">Sem traçado</option>${ap.tracados.map((t) => `<option value="${t.id}" ${b && t.id === b.tracadoId ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}</select></label>
        <label class="campo"><span>Volta mínima (segundos)</span><input class="entrada" id="bVolta" type="number" min="0" inputmode="numeric" value="${novo ? 5 : b.voltaMinimaSeg ?? 5}"></label>
        <label class="campo"><span>Quem pode reservar</span><select class="entrada" id="bTipo">${TIPOS_RESERVA.map(([v, t, d]) => `<option value="${v}" ${tipo === v ? 'selected' : ''}>${t} · ${d}</option>`).join('')}</select></label>
        <label class="campo" style="grid-column: 1 / -1"><span>Observação (opcional)</span><textarea class="entrada" id="bObs" rows="2" maxlength="400" style="height: auto">${esc(novo ? '' : b.observacao || '')}</textarea></label>
      </div><p class="erroMsg" id="bErro" style="padding: 0 var(--kib-espaco-3)"></p>
      <div class="modalRodape"><button class="btn sec" style="margin-left: auto" data-ag-voltar>Cancelar</button><button class="btn prim" id="bSalvar">${novo ? 'Criar bateria' : 'Salvar alterações'}</button></div>`;
    m.querySelector('[data-ag-voltar]').onclick = () => voltar(b && b.id);
    m.querySelector('#bNome').focus();
    m.querySelector('#bSalvar').onclick = async () => {
      const erro = (t) => { m.querySelector('#bErro').textContent = t; };
      const nome = m.querySelector('#bNome').value.trim(), data = m.querySelector('#bData').value, h = m.querySelector('#bHora').value;
      const produtoId = Number(m.querySelector('#bProduto').value), vagas = Math.floor(Number(m.querySelector('#bVagas').value));
      if (!nome) return erro('Informe o nome da bateria.');
      if (!data) return erro('Informe a data.');
      if (!/^\d{2}:\d{2}$/.test(h)) return erro('Informe a hora.');
      if (!produtoId) return erro('Escolha o produto: ele define o preço.');
      if (!(vagas >= 1)) return erro('Informe as vagas (pelo menos 1).');
      if (!novo && vagas < b.inscritos) return erro(`A bateria já tem ${b.inscritos} inscrito(s). As vagas não podem ficar abaixo disso.`);
      const corpo = {
        nome, inicio: `${data}T${h}`, vagas, produtoId, tracadoId: Number(m.querySelector('#bTracado').value) || null,
        voltaMinimaSeg: Math.max(0, Math.floor(Number(m.querySelector('#bVolta').value) || 0)), observacao: m.querySelector('#bObs').value.trim() || null,
        ...flagsDoTipo(m.querySelector('#bTipo').value),
        ...(novo ? {} : { codigoReserva: b.codigoReserva || null, responsavelId: b.responsavelId || null }),
      };
      const btn = m.querySelector('#bSalvar'); btn.disabled = true;
      try {
        const r = await office(novo ? '/baterias' : `/baterias/${b.id}`, { method: novo ? 'POST' : 'PUT', body: corpo });
        toast(novo ? 'Bateria criada' : 'Bateria salva');
        const id = novo ? r.id : b.id;
        if (novo || data !== b.dataHora.slice(0, 10)) { C.A.base = data; if (C.A.vista === 'lista' && data < hojeIso()) C.A.base = hojeIso(); }
        C.A.sel = id; fecharCamada(); await C.carregar(); C.abrir(id);
      } catch (e) { erro(e.message); btn.disabled = false; }
    };
  }

  // ------------------------------------------------------------------ abrir/fechar e excluir
  async function alternarStatus(b) {
    const fechar = !estaFechada(b);
    try {
      if (fechar) await fecharBateria(b); else await abrirBateria(b);
      toast(fechar ? 'Bateria fechada: sai do site e do totem. Quem já reservou continua' : 'Bateria aberta para reservas');
      await C.recarregar(); C.abrir(b.id);
    } catch (e) { falhou(e); }
  }

  function excluir(b) {
    const m = modal('', 'Excluir bateria'); m.style.maxWidth = '540px';
    const pagos = +b.pagos || 0, n = +b.inscritos || 0;
    const bloqueada = pagos > 0;
    m.innerHTML = `<div style="padding: var(--kib-espaco-3)"><b style="font-size: var(--kib-fonte-tamanho-titulo)">Excluir a bateria das ${horaDe(b.dataHora)}?</b>
      <p style="line-height: 1.5; margin: var(--kib-espaco-1) 0 0">${esc(diaExtenso(b.dataHora.slice(0, 10)))} · ${esc(b.nome || b.produto || '')}</p>
      ${bloqueada
        ? `<p style="line-height: 1.5; margin: var(--kib-espaco-denso-12) 0 0"><b>Não dá para excluir:</b> ${pagos} ${pagos === 1 ? 'reserva já está paga' : 'reservas já estão pagas'}. Mova ${pagos === 1 ? 'o cliente' : 'os clientes'} para outra bateria (em “Mover clientes”, na gaveta) ou faça o estorno antes.</p>`
        : n > 0
          ? `<p style="line-height: 1.5; margin: var(--kib-espaco-denso-12) 0 0">${n} ${n === 1 ? 'reserva será cancelada' : 'reservas serão canceladas'} junto. Avise ${n === 1 ? 'o cliente' : 'os clientes'} ou mova-${n === 1 ? 'o' : 'os'} para outra bateria antes.</p>`
          : '<p style="line-height: 1.5; margin: var(--kib-espaco-denso-12) 0 0">A bateria não tem reservas.</p>'}
      <p class="erroMsg" id="xErro"></p></div>
      <div class="modalRodape"><button class="btn sec" style="margin-left: auto" data-ag-voltar>${bloqueada ? 'Entendi' : 'Cancelar'}</button>${bloqueada ? '' : '<button class="btn prim" id="xOk" style="background: var(--kib-cor-estado-perigo-solido)">Excluir bateria</button>'}</div>`;
    m.querySelector('[data-ag-voltar]').onclick = () => voltar(b.id);
    const ok = m.querySelector('#xOk'); if (!ok) return;
    ok.onclick = async () => {
      ok.disabled = true;
      try { await office(`/baterias/${b.id}`, { method: 'DELETE' }); toast('Bateria excluída'); C.A.sel = null; fecharCamada(); await C.carregar(); }
      catch (e) { m.querySelector('#xErro').textContent = e.message; ok.disabled = false; }
    };
  }

  // ------------------------------------------------------------------ fechar o dia
  async function fecharDia() {
    const m = modal('', 'Fechar o dia'); m.style.maxWidth = '560px';
    const dia0 = C.A.base;
    m.innerHTML = `<div class="modalTopo"><span class="col" style="gap: var(--kib-espaco-meio)"><span style="font-size: var(--kib-fonte-tamanho-titulo); font-weight: 700">Fechar o dia (feriado)</span><span class="peq">Cancela as baterias do dia que não têm ninguém inscrito</span></span></div>
      <div style="padding: var(--kib-espaco-2) var(--kib-espaco-3); display: grid; gap: var(--kib-espaco-denso-12)"><label class="campo"><span>Dia</span><input class="entrada" id="fdData" type="date" value="${dia0}"></label><div id="fdResumo" class="peq" style="line-height: 1.5" role="status"></div><p class="erroMsg" id="fdErro"></p></div>
      <div class="modalRodape"><button class="btn sec" style="margin-left: auto" data-ag-voltar>Cancelar</button><button class="btn prim" id="fdOk" style="background: var(--kib-cor-estado-perigo-solido)" disabled>Fechar o dia</button></div>`;
    m.querySelector('[data-ag-voltar]').onclick = () => fecharCamada();
    let lista = [];
    const resumo = async () => {
      const d = m.querySelector('#fdData').value; const ok = m.querySelector('#fdOk'); ok.disabled = true;
      if (!d) { m.querySelector('#fdResumo').textContent = ''; return; }
      m.querySelector('#fdResumo').textContent = 'Conferindo as baterias do dia…';
      try {
        lista = (await office(`/baterias?status=todas&filtro=entre&data=${d}&ate=${d}`)).filter((x) => x.status !== 'cancelada');
        const com = lista.filter((x) => (+x.inscritos || 0) + (+x.preReservas || 0) > 0).length;
        m.querySelector('#fdResumo').innerHTML = lista.length
          ? `<b>${diaExtenso(d)}</b>: ${lista.length - com} de ${lista.length} baterias serão canceladas.${com ? ` <b>${com}</b> ${com === 1 ? 'tem reserva e continua' : 'têm reserva e continuam'}: avise os clientes e mova-os antes de cancelar.` : ''}<br>Para não gerar esse dia de novo, cadastre-o em Cadastros › Feriados.`
          : `${diaExtenso(d)} já não tem baterias.`;
        ok.disabled = !(lista.length - com);
      } catch (e) { m.querySelector('#fdResumo').textContent = ''; m.querySelector('#fdErro').textContent = e.message; }
    };
    m.querySelector('#fdData').onchange = resumo; resumo();
    m.querySelector('#fdOk').onclick = async () => {
      const ok = m.querySelector('#fdOk'); ok.disabled = true;
      try {
        const r = await office('/baterias/fechar-dia', { method: 'POST', body: { data: m.querySelector('#fdData').value } });
        toast(`${r.canceladas} ${r.canceladas === 1 ? 'bateria cancelada' : 'baterias canceladas'}${r.mantidas ? ` · ${r.mantidas} com reserva continuam` : ''}`);
        C.A.sel = null; fecharCamada(); await C.carregar();
      } catch (e) { m.querySelector('#fdErro').textContent = e.message; ok.disabled = false; }
    };
  }

  // ------------------------------------------------------------------ gerar baterias do mês
  async function gerar() {
    const m = modal('<div class="esqueleto" style="height: 320px; margin: var(--kib-espaco-denso-20)"></div>', 'Gerar baterias'); m.style.maxWidth = '640px';
    let ap; try { ap = await carregarApoio(); } catch (e) { falhou(e); return fecharCamada(); }
    const d0 = deIso(C.A.base), ini = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-01`, fim = (() => { const f = new Date(d0.getFullYear(), d0.getMonth() + 1, 0); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`; })();
    m.innerHTML = `<div class="modalTopo"><span class="col" style="gap: var(--kib-espaco-meio)"><span style="font-size: var(--kib-fonte-tamanho-titulo); font-weight: 700">Gerar baterias</span><span class="peq">Aplica uma configuração padrão nos dias escolhidos</span></span></div>
      <div style="display: grid; gap: var(--kib-espaco-denso-12); padding: var(--kib-espaco-2) var(--kib-espaco-3)">
        <label class="campo"><span>Configuração padrão</span><select class="entrada" id="gPadrao"><option value="">Escolha</option>${ap.padroes.map((p) => `<option value="${p.id}">${esc(p.nome)} · ${p.quantidade} baterias a partir das ${esc(p.primeiraHora)}, a cada ${p.intervaloMin} min · ${p.vagas} vagas</option>`).join('')}</select></label>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: var(--kib-espaco-denso-12)"><label class="campo"><span>De</span><input class="entrada" id="gDe" type="date" value="${ini < hojeIso() ? hojeIso() : ini}"></label><label class="campo"><span>Até</span><input class="entrada" id="gAte" type="date" value="${fim}"></label></div>
        <fieldset style="border: 0; padding: 0; margin: 0"><legend class="peq" style="padding: 0 0 var(--kib-espaco-meio)">Dias da semana</legend><span class="linha-quebra gap-meio">${[3, 4, 5, 6, 0, 1, 2].map((i) => `<label class="chip cinza" style="cursor: pointer"><input type="checkbox" name="gDia" value="${i}" ${i === 1 ? '' : 'checked'} style="accent-color: var(--verde)"> ${SEMANA[i]}</label>`).join('')}</span></fieldset>
        <label style="display: flex; gap: var(--kib-espaco-1); align-items: center"><input type="checkbox" id="gFeriados" checked style="accent-color: var(--verde)">Pular feriados cadastrados</label>
        <label style="display: flex; gap: var(--kib-espaco-1); align-items: center"><input type="checkbox" id="gExistentes" checked style="accent-color: var(--verde)">Pular horários que já existem (evita duplicar)</label>
        <label style="display: flex; gap: var(--kib-espaco-1); align-items: center"><input type="checkbox" id="gAtivo" checked style="accent-color: var(--verde)">Criar já abertas para reserva</label>
        <p class="erroMsg" id="gErro"></p></div>
      <div class="modalRodape"><button class="btn sec" style="margin-left: auto" data-ag-voltar>Cancelar</button><button class="btn prim" id="gOk">Gerar baterias</button></div>`;
    m.querySelector('[data-ag-voltar]').onclick = () => fecharCamada();
    m.querySelector('#gOk').onclick = async () => {
      const erro = (t) => { m.querySelector('#gErro').textContent = t; };
      const padraoId = Number(m.querySelector('#gPadrao').value), de = m.querySelector('#gDe').value, ate = m.querySelector('#gAte').value;
      const dias = [...m.querySelectorAll('[name=gDia]:checked')].map((x) => +x.value);
      if (!padraoId) return erro('Escolha a configuração padrão.');
      if (!de || !ate || ate < de) return erro('Confira o período: a data final vem depois da inicial.');
      if (!dias.length) return erro('Escolha pelo menos um dia da semana.');
      const ok = m.querySelector('#gOk'); ok.disabled = true; ok.textContent = 'Gerando…'; erro('');
      let criadas = 0;
      try {
        // um mês por vez, como na Recepção: período grande não estoura o tempo do servidor
        for (let a = deIso(de); iso(a) <= ate; a = new Date(a.getFullYear(), a.getMonth() + 1, 1)) {
          const fimMes = new Date(a.getFullYear(), a.getMonth() + 1, 0); const f = iso(fimMes) > ate ? ate : iso(fimMes);
          const r = await office('/baterias/gerar', { method: 'POST', body: { padraoId, de: iso(a) < de ? de : iso(a), ate: f, diasSemana: dias, pularFeriados: m.querySelector('#gFeriados').checked, pularExistentes: m.querySelector('#gExistentes').checked, ativo: m.querySelector('#gAtivo').checked, soFeriados: false } });
          criadas += r.criadas || 0;
        }
        toast(`${criadas} ${criadas === 1 ? 'bateria criada' : 'baterias criadas'}`);
        fecharCamada(); await C.carregar();
      } catch (e) { erro(criadas ? `${criadas} baterias foram criadas, mas a geração parou: ${e.message}. Gere de novo o mesmo período: os horários que já existem são pulados.` : e.message); ok.disabled = false; ok.textContent = 'Gerar baterias'; }
    };
  }

  // ------------------------------------------------------------------ mover cliente de bateria ou de dia
  async function mover(origem, reservas) {
    // reservas: lista de inscrições (pagas ou não) que saem de `origem`
    const n = reservas.length, pagas = reservas.filter((r) => r.pago), nome = n === 1 ? reservas[0].cliente : `${n} clientes`;
    const m = modal('', 'Mover cliente'); m.style.maxWidth = '720px';
    let dia = origem.dataHora.slice(0, 10), lista = [], escolhida = null, ocupado = false;
    const motivo = (b) => {
      if (b.id === origem.id) return 'Bateria atual';
      if (b.status !== 'aberta') return 'Bateria fechada';
      if (b.dataHora < agoraLocal()) return 'Já passou';
      if ((+b.disponiveis || 0) < reservas.length) return +b.disponiveis ? `Só ${b.disponiveis} ${+b.disponiveis === 1 ? 'vaga' : 'vagas'}` : 'Sem vagas';
      if (b.produtoId == null || b.preco == null) return 'Sem produto/preço';
      if (reservas.some((r) => r.pago) && origem.tipoKart !== b.tipoKart) return 'Reserva paga só vai para o mesmo tipo de kart';
      return '';
    };
    const pintar = () => {
      const corpo = lista.length ? lista.map((b) => {
        const why = motivo(b), off = !!why;
        return `<label class="linhaDestino ${off ? 'off' : ''} ${escolhida === b.id ? 'sel' : ''}"><input type="radio" name="dest" value="${b.id}" ${off ? 'disabled' : ''} ${escolhida === b.id ? 'checked' : ''}>
          <b class="mono">${horaDe(b.dataHora)}</b><span class="col" style="min-width: 0"><span class="trunc">${esc(b.nome || b.produto || 'Bateria')}</span><span class="peq trunc">${esc([b.produto, b.preco != null ? brl(b.preco) : '', b.tracado].filter(Boolean).join(' · '))}</span></span>
          <span class="chip ${off ? 'cinza' : +b.disponiveis > 3 ? 'verde' : 'laranja'}">${off ? esc(why) : `${b.disponiveis} ${+b.disponiveis === 1 ? 'vaga livre' : 'vagas livres'}`}</span></label>`;
      }).join('') : '<div class="vazio"><b>Sem baterias neste dia</b><span>Escolha outro dia ou crie a bateria na Agenda.</span></div>';
      m.querySelector('#mvLista').innerHTML = corpo;
      const alvo = lista.find((b) => b.id === escolhida);
      const ok = m.querySelector('#mvOk'); ok.disabled = !alvo || !!motivo(alvo) || ocupado;
      ok.textContent = alvo ? `Mover para ${horaDe(alvo.dataHora)}${alvo.dataHora.slice(0, 10) !== origem.dataHora.slice(0, 10) ? ' de ' + dataBr(alvo.dataHora) : ''}` : 'Escolha a bateria';
      const naoPagas = reservas.filter((r) => !r.pago);
      const aviso = alvo && naoPagas.length && naoPagas.some((r) => Number(r.produtoId) !== Number(alvo.produtoId) || Number(r.preco) !== Number(alvo.preco)) ? `O valor ${naoPagas.length === 1 ? 'da reserva' : 'das reservas não pagas'} passa a ser o da bateria nova (${brl(alvo.preco)}).` : '';
      m.querySelector('#mvAviso').textContent = [aviso, alvo && reservas.some((r) => r.pago) ? 'O produto e o valor já pagos são preservados; o servidor confere se é o mesmo serviço.' : ''].filter(Boolean).join(' ');
    };
    const carregarDia = async () => {
      m.querySelector('#mvDia').value = dia; m.querySelector('#mvTitulo2').textContent = diaExtenso(dia);
      m.querySelector('#mvLista').innerHTML = '<div class="esqueleto" style="height: 160px"></div>'; escolhida = null;
      try { lista = (await office(`/baterias?status=todas&filtro=entre&data=${dia}&ate=${dia}`)).filter((b) => b.status !== 'cancelada').sort((x, y) => x.dataHora.localeCompare(y.dataHora)); }
      catch (e) { lista = []; m.querySelector('#mvErro').textContent = e.message; }
      pintar();
    };
    m.innerHTML = `<div class="modalTopo"><span class="col" style="gap: var(--kib-espaco-meio); min-width: 0"><span style="font-size: var(--kib-fonte-tamanho-titulo); font-weight: 700">Mover ${esc(nome)}</span>
        <span class="peq">Hoje em ${diaExtenso(origem.dataHora.slice(0, 10))}, ${horaDe(origem.dataHora)} · ${pagas.length ? `${pagas.length} ${pagas.length === 1 ? 'pago' : 'pagos'}` : ''}${pagas.length && n > pagas.length ? ' · ' : ''}${n > pagas.length ? `${n - pagas.length} sem pagar` : ''}</span></span></div>
      <div style="padding: var(--kib-espaco-2) var(--kib-espaco-3); display: grid; gap: var(--kib-espaco-denso-12)">
        <div class="linha gap-1" style="flex-wrap: wrap"><button class="btn sec peq" data-mv-dia="-1" aria-label="Dia anterior">${svg(IC.esq, 14)}</button><input class="entrada" id="mvDia" type="date" style="width: auto" value="${dia}" aria-label="Dia da nova bateria"><button class="btn sec peq" data-mv-dia="1" aria-label="Próximo dia">${svg(IC.dir, 14)}</button>
          <button class="btn sec peq" data-mv-hoje>Hoje</button><button class="btn sec peq" data-mv-amanha>Amanhã</button><b id="mvTitulo2" style="margin-left: auto"></b></div>
        <div id="mvLista" role="radiogroup" aria-label="Baterias do dia" style="display: grid; gap: var(--kib-espaco-meio); max-height: 46vh; overflow: auto"></div>
        <p class="peq" id="mvAviso" style="margin: 0" role="status"></p><p class="erroMsg" id="mvErro"></p></div>
      <div class="modalRodape"><button class="btn sec" style="margin-left: auto" data-ag-voltar>Cancelar</button><button class="btn prim" id="mvOk" disabled>Escolha a bateria</button></div>`;
    m.querySelector('[data-ag-voltar]').onclick = () => voltar(origem.id);
    m.addEventListener('click', (e) => {
      const d = e.target.closest('[data-mv-dia]'); if (d) { dia = somaDias(dia, +d.dataset.mvDia); carregarDia(); return; }
      if (e.target.closest('[data-mv-hoje]')) { dia = hojeIso(); carregarDia(); return; }
      if (e.target.closest('[data-mv-amanha]')) { dia = somaDias(hojeIso(), 1); carregarDia(); }
    });
    m.querySelector('#mvDia').onchange = (e) => { if (e.target.value) { dia = e.target.value; carregarDia(); } };
    m.querySelector('#mvLista').onchange = (e) => { if (e.target.name === 'dest') { escolhida = +e.target.value; pintar(); } };
    m.querySelector('#mvOk').onclick = async () => {
      const alvo = lista.find((b) => b.id === escolhida); if (ocupado || !alvo || motivo(alvo)) return;
      ocupado = true; m.querySelector('#mvOk').disabled = true; m.querySelector('#mvErro').textContent = '';
      const falhas = [], pendentes = []; let feitas = 0;
      for (const r of reservas) {
        try { await office(`/reservas/${r.id}/mover`, { method: 'POST', body: { bateriaId: alvo.id } }); feitas++; }
        catch (e) { pendentes.push(r); falhas.push(`${r.cliente}: ${e.message}`); }
      }
      ocupado = false;
      if (!falhas.length) { toast(feitas === 1 ? 'Cliente movido' : `${feitas} clientes movidos`); C.A.sel = origem.id; fecharCamada(); await C.recarregar(); return; }
      m.querySelector('#mvErro').textContent = (feitas ? `${feitas} movido(s). Não deu para mover: ` : 'Não foi possível mover: ') + falhas.join(' · ');
      reservas = pendentes; alvo.disponiveis = Math.max(0, Number(alvo.disponiveis) - feitas); pintar();
      if (feitas) await C.recarregar().catch(() => undefined);
    };
    carregarDia();
  }

  // ------------------------------------------------------------------ seleção em lote: abrir ou fechar várias baterias
  const lote = { modo: false, sel: new Set(), obs: null, abort: null };
  const lista = () => (C && C.bats ? C.bats() : []);
  const porId = (id) => lista().find((x) => x.id === id);
  const editavel = (b) => !!b && b.status !== 'cancelada' && !passou(b);

  function decorar() {
    if (!C) return;
    const cal = C.tela.querySelector('#calendario'); if (!cal) return;
    // some da seleção o que saiu da tela (outra semana) ou já passou
    for (const id of [...lote.sel]) if (!editavel(porId(id))) lote.sel.delete(id);
    cal.classList.toggle('agModo', lote.modo);
    cal.querySelectorAll('[data-sel]').forEach((el) => {
      const b = porId(+el.dataset.sel); if (!b) return;
      const ok = editavel(b);
      el.classList.toggle('agSel', lote.modo && lote.sel.has(b.id));
      el.classList.toggle('agPassou', lote.modo && !ok);
      el.classList.toggle('agFechada', estaFechada(b) && ok);
      if (lote.modo) el.setAttribute('aria-pressed', String(lote.sel.has(b.id))); else el.removeAttribute('aria-pressed');
    });
    barraLote();
  }

  function barraLote() {
    let barra = document.getElementById('agBarraLote');
    const bt = C.tela.querySelector('[data-ag-selecionar]'); if (bt) bt.setAttribute('aria-pressed', String(lote.modo));
    if (!lote.modo) { if (barra) barra.remove(); return; }
    if (!barra) { barra = document.createElement('div'); barra.id = 'agBarraLote'; barra.className = 'agBarraLote'; barra.setAttribute('role', 'region'); barra.setAttribute('aria-label', 'Seleção de baterias'); document.body.appendChild(barra); }
    const sel = [...lote.sel].map(porId).filter(Boolean);
    const fechadas = sel.filter(estaFechada), abertas = sel.filter((b) => !estaFechada(b));
    const futuras = lista().filter(editavel);
    barra.innerHTML = `<span class="agBarraTxt" role="status" aria-live="polite"><b>${sel.length ? `${sel.length} ${sel.length === 1 ? 'bateria selecionada' : 'baterias selecionadas'}` : 'Escolha as baterias na agenda'}</b><span class="peq">${sel.length ? `${abertas.length} ${abertas.length === 1 ? 'aberta' : 'abertas'} · ${fechadas.length} ${fechadas.length === 1 ? 'fechada' : 'fechadas'}` : 'Toque ou clique em cada uma. As que já correram não entram.'}</span></span>
      <span class="agBarraAcoes"><button type="button" class="btn sec peq" data-ag-lote-todas ${futuras.length ? '' : 'disabled'}>${sel.length && sel.length === futuras.length ? 'Limpar seleção' : 'Todas desta tela'}</button>
      <button type="button" class="btn sec peq" data-ag-lote-abrir ${fechadas.length ? '' : 'disabled'}>Abrir${fechadas.length ? ' ' + fechadas.length : ''}</button>
      <button type="button" class="btn prim peq" data-ag-lote-fechar style="background: var(--kib-cor-estado-perigo-solido)" ${abertas.length ? '' : 'disabled'}>Fechar${abertas.length ? ' ' + abertas.length : ''}</button>
      <button type="button" class="btn sec peq" data-ag-lote-sair>Sair</button></span>`;
  }

  function alternarLote(ligar = !lote.modo) {
    lote.modo = ligar; if (!ligar) lote.sel.clear();
    if (ligar) { A_fecharGaveta(); }
    decorar();
  }
  function A_fecharGaveta() { if (document.querySelector('#camada .gaveta')) { C.A.sel = null; fecharCamada(); } }
  function marcar(id) {
    const b = porId(id);
    if (!editavel(b)) { toast('Esta bateria já correu: não dá para abrir ou fechar', true); return; }
    if (lote.sel.has(id)) lote.sel.delete(id); else lote.sel.add(id);
    decorar();
  }
  async function aplicarLote(fechar) {
    const alvo = [...lote.sel].map(porId).filter((b) => b && (fechar ? !estaFechada(b) : estaFechada(b)));
    if (!alvo.length) return;
    const executar = async () => {
      const erros = []; let feitas = 0;
      for (const b of alvo) { try { if (fechar) await fecharBateria(b); else await abrirBateria(b); feitas++; lote.sel.delete(b.id); } catch (e) { erros.push(`${horaDe(b.dataHora)} de ${dataBr(b.dataHora)}: ${e.message}`); } }
      return { feitas, erros };
    };
    if (fechar) {
      const reservas = alvo.reduce((a, b) => a + (+b.inscritos || 0), 0);
      const ordenadas = alvo.slice().sort((x, y) => x.dataHora.localeCompare(y.dataHora));
      const m = modal('', 'Fechar baterias'); m.style.maxWidth = '540px';
      m.innerHTML = `<div style="padding: var(--kib-espaco-3)"><b style="font-size: var(--kib-fonte-tamanho-titulo)">Fechar ${alvo.length} ${alvo.length === 1 ? 'bateria' : 'baterias'}?</b>
        <p style="line-height: 1.5; margin: var(--kib-espaco-denso-12) 0 0">Elas saem do site e do totem; só quem já tem reserva (e a Recepção) continua usando. ${reservas ? `<b>${reservas}</b> ${reservas === 1 ? 'reserva que já existe continua' : 'reservas que já existem continuam'}.` : 'Nenhuma tem reserva.'} Dá para abrir de novo a qualquer momento.</p>
        <ul class="peq" style="margin: var(--kib-espaco-denso-12) 0 0; padding-left: var(--kib-espaco-3); max-height: 22vh; overflow: auto; line-height: 1.6">${ordenadas.map((b) => `<li>${dataBr(b.dataHora)} · ${horaDe(b.dataHora)}${+b.inscritos ? ` · ${b.inscritos} ${+b.inscritos === 1 ? 'reserva' : 'reservas'}` : ''}</li>`).join('')}</ul><p class="erroMsg" id="lErro"></p></div>
        <div class="modalRodape"><button class="btn sec" style="margin-left: auto" data-ag-lote-nao>Cancelar</button><button class="btn prim" id="lOk" style="background: var(--kib-cor-estado-perigo-solido)">Fechar ${alvo.length === 1 ? 'a bateria' : 'as ' + alvo.length + ' baterias'}</button></div>`;
      m.querySelector('[data-ag-lote-nao]').onclick = () => fecharCamada();
      m.querySelector('#lOk').onclick = async () => {
        m.querySelector('#lOk').disabled = true;
        const r = await executar();
        if (!r.erros.length) { toast(`${r.feitas} ${r.feitas === 1 ? 'bateria fechada' : 'baterias fechadas'}`); fecharCamada(); await C.carregar(); decorar(); return; }
        m.querySelector('#lErro').textContent = `${r.feitas} fechada(s). Não deu para fechar: ${r.erros.join(' · ')}`; await C.carregar(); decorar();
      };
      return;
    }
    const r = await executar();
    toast(r.erros.length ? `${r.feitas} aberta(s). Falhou: ${r.erros.join(' · ')}` : `${r.feitas} ${r.feitas === 1 ? 'bateria aberta' : 'baterias abertas'} para reservas`, !!r.erros.length);
    await C.carregar(); decorar();
  }

  // ------------------------------------------------------------------ pontes com o app.js
  function montar(ctx) {
    if (lote.obs) lote.obs.disconnect(); if (lote.abort) lote.abort.abort();
    C = ctx; lote.modo = false; lote.sel.clear(); document.getElementById('agBarraLote')?.remove();
    if (!permitido()) return;
    const acoes = C.tela.querySelector('.cab .acoes'); if (!acoes) return;
    const caixa = document.createElement('span');
    caixa.style.display = 'contents';
    caixa.innerHTML = `<button class="btn sec" data-ag-selecionar aria-pressed="false" title="Escolher várias baterias para abrir ou fechar (tecla X)">Selecionar</button>
      <details class="menuMais"><summary class="btn sec" aria-label="Ações de bateria: nova, gerar, fechar o dia">Baterias</summary><div class="menuLista menuDir"><button type="button" data-ag-nova-bat>Nova bateria…</button><button type="button" data-ag-gerar>Gerar baterias do mês…</button><button type="button" data-ag-fechar-dia>Fechar o dia (feriado)…</button></div></details>`;
    acoes.prepend(caixa);
    lote.abort = new AbortController();
    // modo seleção: o clique numa bateria marca em vez de abrir a gaveta (captura, antes do app.js)
    C.tela.addEventListener('click', (e) => {
      if (e.target.closest('[data-ag-selecionar]')) { e.stopPropagation(); alternarLote(); return; }
      if (!lote.modo) return;
      const el = e.target.closest('#calendario [data-sel]'); if (!el) return;
      e.preventDefault(); e.stopPropagation(); marcar(+el.dataset.sel);
    }, true);
    document.addEventListener('click', (e) => {
      if (!lote.modo) return;
      if (e.target.closest('[data-ag-lote-todas]')) { const fut = lista().filter(editavel); if (lote.sel.size && lote.sel.size === fut.length) lote.sel.clear(); else fut.forEach((b) => lote.sel.add(b.id)); decorar(); }
      else if (e.target.closest('[data-ag-lote-abrir]')) aplicarLote(false);
      else if (e.target.closest('[data-ag-lote-fechar]')) aplicarLote(true);
      else if (e.target.closest('[data-ag-lote-sair]')) alternarLote(false);
    }, { signal: lote.abort.signal });
    document.addEventListener('keydown', (e) => {
      if (S.rota !== 'agenda' || $('#camada').innerHTML || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape' && lote.modo) { alternarLote(false); return; }
      if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
      if (e.key.toLowerCase() === 'x') alternarLote();
    }, { signal: lote.abort.signal });
    const cal = C.tela.querySelector('#calendario');
    if (cal) { let raf = 0; lote.obs = new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(decorar); }); lote.obs.observe(cal, { childList: true, subtree: true }); }
    decorar();
    C.tela.addEventListener('click', (e) => {
      const menu = C.tela.querySelector('.cab .menuMais'); if (menu && menu.open && (!e.target.closest('.menuMais') || e.target.closest('.menuLista button'))) menu.open = false;
      if (e.target.closest('[data-ag-nova-bat]')) return formBateria(null, C.A.base < hojeIso() ? hojeIso() : C.A.base);
      if (e.target.closest('[data-ag-gerar]')) return gerar();
      if (e.target.closest('[data-ag-fechar-dia]')) return fecharDia();
    });
  }

  // gaveta da bateria: menu "Gerenciar" no rodapé + seção "Mover clientes"
  function gaveta({ b, reservas }) {
    if (!C || !permitido()) return;
    const g = document.querySelector('#camada .gaveta'); if (!g || +g.dataset.bateria !== b.id) return;
    if (estaFechada(b) && !passou(b)) { const topo = g.querySelector('.gavetaTopo'); if (topo) topo.innerHTML = topo.innerHTML.replace(' · já correu', ' · bateria fechada para reservas'); }
    if (passou(b)) return;
    if (b.status === 'fechada') { const nr = g.querySelector('[data-acao="novaReserva"]'); if (nr) { nr.disabled = true; nr.title = 'Abra a bateria para aceitar novas reservas'; nr.lastChild.textContent = ' Bateria fechada: abra para novas reservas'; } }
    const rodape = g.lastElementChild;
    if (rodape && !rodape.querySelector('[data-ag-gerenciar]')) {
      const det = document.createElement('details'); det.className = 'menuMais menuCima'; det.setAttribute('data-ag-gerenciar', '');
      det.innerHTML = `<summary class="btn sec" aria-label="Gerenciar esta bateria">Gerenciar</summary><div class="menuLista menuDir"><button type="button" data-ag-editar>Editar bateria</button><button type="button" data-ag-status>${estaFechada(b) ? 'Abrir bateria' : 'Fechar bateria'}</button><button type="button" data-ag-excluir style="color: var(--erroTxt)">Excluir bateria</button></div>`;
      rodape.appendChild(det);
      det.addEventListener('click', (e) => {
        const bt = e.target.closest('button'); if (!bt) return; det.open = false;
        if (bt.hasAttribute('data-ag-editar')) formBateria(b); else if (bt.hasAttribute('data-ag-status')) alternarStatus(b); else if (bt.hasAttribute('data-ag-excluir')) excluir(b);
      });
    }
    const corpo = g.querySelector('#corpoBateria'); if (!corpo || corpo.querySelector('[data-ag-mover-secao]')) return;
    const lista = reservas.filter((r) => r.status !== 'cancelada'); if (!lista.length) return;
    const sec = document.createElement('section'); sec.className = 'secao'; sec.setAttribute('data-ag-mover-secao', '');
    sec.innerHTML = `<span class="titulo">Mover clientes<span class="peq" style="margin-left: auto; font-weight: 500">de bateria ou de dia · pagos e não pagos</span></span>
      <div class="listaMover">${lista.map((r) => `<label class="linhaMover"><input type="checkbox" data-ag-sel="${r.id}" aria-label="Selecionar ${esc(r.cliente)}"><span class="col" style="min-width: 0"><span class="trunc peso-semibold">${esc(r.cliente)}</span><span class="peq trunc">${esc(r.responsavel && r.responsavel !== r.cliente ? 'responsável ' + r.responsavel : r.origem || 'Recepção')}</span></span><span class="chip ${r.pago ? 'verde' : 'laranja'}">${r.pago ? 'pago' : 'falta ' + brlCurto(r.total)}</span><button type="button" class="btn sec peq" data-ag-mover="${r.id}">Mover</button></label>`).join('')}</div>
      <div class="linha gap-1" style="flex-wrap: wrap"><button type="button" class="btn sec peq" data-ag-sel-todos>Selecionar todos</button><button type="button" class="btn prim peq" data-ag-mover-sel disabled>Mover selecionados</button></div>`;
    corpo.appendChild(sec);
    const atual = () => [...sec.querySelectorAll('[data-ag-sel]:checked')].map((x) => lista.find((r) => r.id === +x.dataset.agSel));
    const botao = () => { const k = atual().length; const bt = sec.querySelector('[data-ag-mover-sel]'); bt.disabled = !k; bt.textContent = k ? `Mover ${k} ${k === 1 ? 'selecionado' : 'selecionados'}` : 'Mover selecionados'; };
    sec.addEventListener('change', (e) => { if (e.target.matches('[data-ag-sel]')) botao(); });
    sec.addEventListener('click', (e) => {
      const um = e.target.closest('[data-ag-mover]'); if (um) { e.preventDefault(); mover(b, [lista.find((r) => r.id === +um.dataset.agMover)]); return; }
      if (e.target.closest('[data-ag-sel-todos]')) { const todos = sec.querySelectorAll('[data-ag-sel]'); const marcar = ![...todos].every((x) => x.checked); todos.forEach((x) => { x.checked = marcar; }); botao(); return; }
      if (e.target.closest('[data-ag-mover-sel]')) mover(b, atual());
    });
  }

  return { montar, gaveta };
})();
