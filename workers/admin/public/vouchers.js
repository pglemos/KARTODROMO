/* Vouchers nominais, grupos autorizados e esgotamento automático entre Recepção, Site, Grupos e Totem. */
'use strict';

TELAS.vouchers = async (tela) => {
  const V_IC = {
    ticket: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7zM15 5v2M15 11v2M15 17v2',
    copiar: 'M9 9h10v10H9zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
    pessoas: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    editar: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z',
    lixo: 'M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6',
    pausa: 'M10 4H6v16h4zM18 4h-4v16h4z',
    play: 'M6 4l14 8-14 8z',
    ok: 'M20 6L9 17l-5-5',
  };

  const podeAlterar = podeTela('vouchers', 'alterar');
  const V = {
    aba: 'vouchers',
    filtro: 'todos',
    canal: 'todos',
    q: '',
    lista: [],
    usos: [],
    produtos: [],
    parceiros: [],
    contas: [],
    catalogosOk: false,
  };

  const addDiasIso = (iso, dias) => {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + dias));
    return dt.toISOString().slice(0, 10);
  };
  const fmtData = (s) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—');
  const fmtDataHora = (s) => {
    if (!s) return '—';
    const limpo = String(s).replace('T', ' ');
    if (/^\d{4}-\d{2}-\d{2}/.test(limpo)) return `${limpo.slice(8, 10)}/${limpo.slice(5, 7)}/${limpo.slice(2, 4)} ${limpo.slice(11, 16)}`;
    return limpo;
  };
  const fmtDoc = (d) => {
    const dig = so(d);
    if (dig.length === 11) return `${dig.slice(0, 3)}.${dig.slice(3, 6)}.${dig.slice(6, 9)}-${dig.slice(9)}`;
    if (dig.length === 14) return `${dig.slice(0, 2)}.${dig.slice(2, 5)}.${dig.slice(5, 8)}/${dig.slice(8, 12)}-${dig.slice(12)}`;
    return d || '—';
  };
  const lerCentavos = (txt) => {
    const s = String(txt || '').trim().replace(/\s+/g, '').replace(/^R\$/i, '');
    if (!s) return null;
    const norm = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
    const n = Number(norm);
    if (!Number.isFinite(n) || n < 0) return NaN;
    return Math.round(n * 100);
  };
  const brlCampo = (cent) => (cent != null && cent > 0 ? (Number(cent) / 100).toFixed(2).replace('.', ',') : '');
  const gerarCodigo = () => 'KB' + Math.random().toString(36).slice(2, 8).toUpperCase();
  const plural = (n, um, muitos) => `${n} ${n === 1 ? um : muitos}`;

  const origemLabel = (v) => {
    if (v.origem === 'parceiro') return v.parceiro ? `Parceiro · ${v.parceiro}` : 'Parceiro';
    if (v.origem === 'fidelidade') return v.conta ? `Fidelidade · ${v.conta}` : 'Fidelidade';
    return v.referencia || 'Manual';
  };

  const descontoTxt = (v) => (v.tipo === 'percentual' ? `${Number(v.valor) || 0}%` : brl(Number(v.valor) || 0));

  const chipStatus = (v) => {
    if (v.status === 'esgotado' || v.esgotado) return '<span class="chip vermelho">Esgotado</span>';
    if (v.status === 'expirado' || v.expirado) return '<span class="chip laranja">Expirado</span>';
    if (v.status === 'inativo' || !v.ativo) return '<span class="chip cinza sem-sinal">Inativo</span>';
    return '<span class="chip verde">Ativo</span>';
  };

  const canalChip = (u) => {
    if (u.canal === 'grupo') return '<span class="chip roxo sem-sinal">Link de grupo</span>';
    if (u.canal === 'site') return '<span class="chip azul sem-sinal">Reserva online</span>';
    return '<span class="chip cinza sem-sinal">Recepção</span>';
  };

  const parseLote = (texto, usosPadrao = 1) => {
    const itens = [];
    const ignoradas = [];
    const chaves = new Set();
    const linhas = String(texto || '').split(/\r?\n/);
    for (const raw of linhas) {
      const linha = raw.trim();
      if (!linha) continue;
      if (/^(nome|piloto)\s*[;,\t]/i.test(linha) && /cpf|doc/i.test(linha)) continue;
      const partes = linha.split(/[;\t,]+/).map((p) => p.trim()).filter(Boolean);
      let nome = '';
      let doc = '';
      let fone = '';
      let usos = usosPadrao;
      if (partes.length === 1) {
        const d = so(partes[0]);
        if (d.length === 11 || d.length === 14) {
          doc = d;
          nome = `CPF ${fmtDoc(d)}`;
        } else {
          nome = partes[0];
        }
      } else {
        for (const p of partes) {
          const d = so(p);
          if (!doc && (d.length === 11 || d.length === 14)) { doc = d; continue; }
          if (/^\d{1,2}$/.test(p) && Number(p) >= 1 && Number(p) <= 99 && nome) { usos = Number(p); continue; }
          if (!fone && d.length >= 10 && d.length <= 13 && !/[a-zA-ZÀ-ÿ]{3}/.test(p)) { fone = p; continue; }
          if (!nome && /[a-zA-ZÀ-ÿ]/.test(p)) { nome = p; continue; }
          if (!fone && d.length >= 8 && d.length <= 13) { fone = p; }
        }
      }
      if (!nome && !doc) { ignoradas.push(linha); continue; }
      if (!nome && doc) nome = `CPF ${fmtDoc(doc)}`;
      const key = doc || normTxt(nome);
      if (chaves.has(key)) continue;
      chaves.add(key);
      itens.push({ clienteId: null, nome, documento: doc || null, telefone: fone || null, usosMax: usos, usosFeitos: 0 });
    }
    return { itens, ignoradas };
  };

  const carregarDados = async () => {
    const [lista, usos] = await Promise.all([office('/vouchers'), office('/vouchers/uso')]);
    V.lista = Array.isArray(lista) ? lista : [];
    V.usos = Array.isArray(usos) ? usos : [];
  };

  const carregarCatalogos = async () => {
    if (V.catalogosOk) return;
    const [produtos, parceiros, contas] = await Promise.all([
      office('/cad/produtos').catch(() => []),
      office('/parceiros').catch(() => []),
      office('/fidelidade/contas').catch(() => []),
    ]);
    V.produtos = Array.isArray(produtos) ? produtos.filter((p) => p.ativo !== false && p.ativo !== 0) : [];
    V.parceiros = Array.isArray(parceiros) ? parceiros.filter((p) => p.ativo !== false && p.ativo !== 0) : [];
    V.contas = Array.isArray(contas) ? contas.filter((c) => c.ativo !== false && c.ativo !== 0) : [];
    V.catalogosOk = true;
  };

  tela.innerHTML = `${cabecalho(
    'Clientes · cupons, pessoas autorizadas e esgotamento automático',
    'Vouchers',
    `<button type="button" class="btn branco" id="vchAtualizar">${svg(IC.sync, 14, 'currentColor', 2.2)}Atualizar</button>${podeAlterar ? `<button type="button" class="btn prim" id="vchNovo">${svg(IC.mais, 14, 'var(--kib-cor-acao-sobre-principal)', 2.6)}Novo voucher</button>` : ''}`,
  )}
  <main class="principal">
    <section class="kpis kpis4" id="vchKpis" aria-label="Resumo de vouchers">${'<div class="esqueleto" style="height: 110px"></div>'.repeat(4)}</section>
    <section class="cartao" id="vchCard"><div class="esqueleto" style="height: 320px; margin: var(--kib-espaco-2)"></div></section>
  </main>`;

  const kpisHtml = () => {
    const ativos = V.lista.filter((v) => v.status === 'ativo').length;
    const esgotados = V.lista.filter((v) => v.esgotado).length;
    const expirados = V.lista.filter((v) => v.status === 'expirado').length;
    const restritos = V.lista.filter((v) => v.restritoClientes).length;
    const totalPessoas = V.lista.reduce((s, v) => s + (Number(v.beneficiariosTotal) || 0), 0);
    const pessoasUsaram = V.lista.reduce((s, v) => s + (Number(v.beneficiariosUsaram) || 0), 0);
    const totalUsos = V.lista.reduce((s, v) => s + (Number(v.usos) || 0), 0);
    const usosValidos = V.usos.filter((u) => !u.estornado);
    const descontoTotal = usosValidos.reduce((s, u) => s + (Number(u.desconto) || 0), 0);
    const estornados = V.usos.length - usosValidos.length;
    return `
      <article class="kpi"><span class="rot">${svg(V_IC.ticket, 14, 'var(--verde)', 2.2)}Vouchers ativos</span><span class="val num">${ativos}</span><span class="sub">${esgotados} esgotado(s) · ${expirados} expirado(s)</span></article>
      <article class="kpi"><span class="rot">${svg(V_IC.pessoas, 14, 'var(--roxo)', 2.2)}Pessoas e grupos</span><span class="val num">${totalPessoas}</span><span class="sub">${restritos} voucher(s) restrito(s) · ${pessoasUsaram} já usaram</span></article>
      <article class="kpi"><span class="rot">${svg(V_IC.ok, 14, 'var(--azulTxt)', 2.2)}Utilizações registradas</span><span class="val num">${totalUsos}</span><span class="sub">${esgotados ? `${esgotados} fechado(s) ao atingir o teto` : 'Recepção, site e links de grupo'}</span></article>
      <article class="kpi"><span class="rot">Desconto concedido</span><span class="val num">${brl(descontoTotal)}</span><span class="sub">${usosValidos.length} aplicado(s)${estornados ? ` · ${estornados} estornado(s)` : ''}</span></article>`;
  };

  const barraProgressoHtml = (v) => {
    const usados = Number(v.usos) || 0;
    const limite = v.limiteTotal != null ? Number(v.limiteTotal) : null;
    if (limite == null) {
      return `<div class="vchProg"><span class="num"><b>${usados}</b> uso(s) · sem teto</span><span class="peq">Até ${v.usoMaxCliente} por pessoa</span></div>`;
    }
    const pct = limite > 0 ? Math.min(100, Math.round((usados / limite) * 100)) : 100;
    const corBarra = v.esgotado || pct >= 100
      ? 'var(--erro)'
      : pct >= 80
        ? 'var(--aviso)'
        : 'var(--ok)';
    const restTxt = v.esgotado
      ? (v.usoUnico ? 'Uso único consumido' : 'Esgotado automaticamente')
      : `${plural(Math.max(0, limite - usados), 'uso restante', 'usos restantes')}`;
    const canais = [];
    if (v.usosRecepcao) canais.push(`${v.usosRecepcao} balcão`);
    if (v.usosOnline) canais.push(`${v.usosOnline} site`);
    if (v.usosGrupo) canais.push(`${v.usosGrupo} grupo`);
    return `<div class="vchProg">
      <div class="linha gap-1" style="justify-content: space-between"><span class="num"><b>${usados}</b> / ${limite}</span><span class="peq num">${pct}%</span></div>
      <div class="barra" aria-hidden="true"><span style="width: ${pct}%; background: ${corBarra}"></span></div>
      <span class="peq">${esc(restTxt)}${canais.length ? ` · ${esc(canais.join(', '))}` : ''}</span>
    </div>`;
  };

  const pessoasResumoHtml = (v) => {
    const total = Number(v.beneficiariosTotal) || 0;
    const usaram = Number(v.beneficiariosUsaram) || 0;
    const bens = Array.isArray(v.beneficiarios) ? v.beneficiarios : [];
    const nomes = bens.slice(0, 2).map((b) => nomeBonito(b.nome).split(' ').slice(0, 2).join(' ')).join(', ');
    const sobra = total > 2 ? ` +${total - 2}` : '';
    const chipTipo = v.restritoClientes
      ? `<span class="chip roxo sem-sinal">${svg(V_IC.pessoas, 12, 'currentColor', 2.2)}${plural(total, 'pessoa', 'pessoas')}</span>`
      : total > 0
        ? `<span class="chip azul sem-sinal">${plural(total, 'indicada', 'indicadas')} · aberto</span>`
        : '<span class="chip cinza sem-sinal">Qualquer cliente</span>';
    const sub = total > 0
      ? `<span class="peq trunc" title="${esc(bens.map((b) => `${b.nome} (${b.usosFeitos}/${b.usosMax})`).join(', '))}">${esc(nomes + sobra)} · ${usaram}/${total} usaram</span>`
      : '<span class="peq">Sem restrição de lista</span>';
    return `<div class="col" style="gap: var(--kib-espaco-meio); min-width: 0">${chipTipo}${sub}</div>`;
  };

  const filtraVoucher = (v) => {
    if (V.filtro === 'ativos' && v.status !== 'ativo') return false;
    if (V.filtro === 'grupo' && !v.restritoClientes && !(Number(v.beneficiariosTotal) > 0)) return false;
    if (V.filtro === 'parceiro' && v.origem !== 'parceiro') return false;
    if (V.filtro === 'fidelidade' && v.origem !== 'fidelidade') return false;
    if (V.filtro === 'esgotados' && !v.esgotado) return false;
    if (V.filtro === 'inativos' && v.status !== 'inativo' && v.status !== 'expirado') return false;
    const q = normTxt(V.q);
    if (!q) return true;
    const docQ = so(V.q);
    const bensTexto = (v.beneficiarios || []).map((b) => `${b.nome || ''} ${b.documento || ''}`).join(' ');
    const alvo = normTxt(`${v.codigo} ${v.referencia || ''} ${v.parceiro || ''} ${v.conta || ''} ${v.produto || ''} ${bensTexto}`);
    return alvo.includes(q) || (docQ.length >= 3 && so(bensTexto).includes(docQ));
  };

  const filtraUso = (u) => {
    if (V.canal !== 'todos' && u.canal !== V.canal) return false;
    const q = normTxt(V.q);
    if (!q) return true;
    const docQ = so(V.q);
    const alvo = normTxt(`${u.voucher || ''} ${u.cliente || ''} ${u.documento || ''} ${u.canalLabel || ''} ${u.vendaId || ''}`);
    return alvo.includes(q) || (docQ.length >= 3 && so(u.documento || '').includes(docQ));
  };

  const pintar = () => {
    $('#vchKpis').innerHTML = kpisHtml();
    const card = $('#vchCard');
    const cTodos = V.lista.length;
    const cAtivos = V.lista.filter((v) => v.status === 'ativo').length;
    const cGrupo = V.lista.filter((v) => v.restritoClientes || Number(v.beneficiariosTotal) > 0).length;
    const cParceiro = V.lista.filter((v) => v.origem === 'parceiro').length;
    const cFidel = V.lista.filter((v) => v.origem === 'fidelidade').length;
    const cEsg = V.lista.filter((v) => v.esgotado).length;
    const cInat = V.lista.filter((v) => v.status === 'inativo' || v.status === 'expirado').length;

    const abasHtml = `<div class="cartaoCab">
      <div class="seg" role="tablist" aria-label="Visão de vouchers">
        <button type="button" role="tab" aria-selected="${V.aba === 'vouchers'}" class="${V.aba === 'vouchers' ? 'sel' : ''}" data-aba="vouchers">Vouchers (${cTodos})</button>
        <button type="button" role="tab" aria-selected="${V.aba === 'uso'}" class="${V.aba === 'uso' ? 'sel' : ''}" data-aba="uso">Histórico de utilizações (${V.usos.length})</button>
      </div>
      <div class="buscaCampo dir" style="min-width: 240px; flex: 1 1 260px; max-width: 380px">
        ${svg(IC.busca, 14, 'var(--mudo)')}
        <input type="search" id="vchBusca" value="${esc(V.q)}" placeholder="${V.aba === 'vouchers' ? 'Buscar código, pessoa, CPF ou campanha…' : 'Buscar voucher, piloto, CPF ou venda…'}" aria-label="Buscar vouchers">
      </div>
    </div>`;

    if (V.aba === 'vouchers') {
      const filtros = [
        ['todos', 'Todos', cTodos],
        ['ativos', 'Ativos', cAtivos],
        ['grupo', 'Com pessoas / grupo', cGrupo],
        ['esgotados', 'Esgotados', cEsg],
        ['parceiro', 'Parceiros', cParceiro],
        ['fidelidade', 'Fidelidade', cFidel],
        ['inativos', 'Inativos e expirados', cInat],
      ];
      const lista = V.lista.filter(filtraVoucher);
      card.innerHTML = `${abasHtml}
        <div class="vchToolbar">
          <div class="filtros" role="group" aria-label="Filtrar vouchers">
            ${filtros.map(([id, rot, n]) => `<button type="button" class="${V.filtro === id ? 'sel' : ''}" data-filtro="${id}">${esc(rot)} <span>(${n})</span></button>`).join('')}
          </div>
        </div>
        <div class="rolagemX"><div class="vchGrade">
          <div class="cabTabela vchCols">
            <span>Voucher</span>
            <span>Desconto</span>
            <span>Pessoas / Grupo</span>
            <span>Uso e saldo</span>
            <span>Validade e status</span>
            <span class="t-dir">Ações</span>
          </div>
          ${lista.length ? lista.map((v) => {
            const detalhes = [v.produto || 'Todos os produtos'];
            if (v.pedidoMinimo) detalhes.push(`mín. ${brl(v.pedidoMinimo)}`);
            if (v.descontoMaximo) detalhes.push(`teto ${brl(v.descontoMaximo)}`);
            return `<div class="linhaTabela vchCols" style="${v.ativo ? '' : 'opacity: .65'}">
              <div class="col" style="gap: var(--kib-espaco-meio); min-width: 0">
                <div class="vchCodRow">
                  <span class="vchCod mono">${esc(v.codigo)}</span>
                  <button type="button" class="vchCopiar" data-copiar="${esc(v.codigo)}" title="Copiar código">${svg(V_IC.copiar, 12, 'currentColor', 2.1)}Copiar</button>
                </div>
                <span class="peq trunc" title="${esc(origemLabel(v))}">${esc(origemLabel(v))}</span>
              </div>
              <div class="col" style="gap: 2px; min-width: 0">
                <b class="t-subtitulo num">${esc(descontoTxt(v))}</b>
                <span class="peq trunc" title="${esc(detalhes.join(' · '))}">${esc(detalhes.join(' · '))}</span>
              </div>
              ${pessoasResumoHtml(v)}
              ${barraProgressoHtml(v)}
              <div class="col" style="gap: var(--kib-espaco-meio); align-items: flex-start">
                ${chipStatus(v)}
                <span class="peq num">${fmtData(v.inicio)} até ${fmtData(v.fim)}</span>
              </div>
              <div class="vchAcoes">
                <button type="button" class="btn sec peq" data-pessoas="${v.id}">${svg(V_IC.pessoas, 13, 'currentColor', 2.2)}Pessoas</button>
                ${podeAlterar ? `
                  <button type="button" class="btn sec peq" data-editar="${v.id}">${svg(V_IC.editar, 13, 'currentColor', 2.2)}Editar</button>
                  <button type="button" class="btn peq ${v.ativo ? 'sec risco' : 'verdeClaro'}" data-alternar="${v.id}">${v.ativo ? 'Desativar' : 'Reativar'}</button>
                ` : ''}
              </div>
            </div>`;
          }).join('') : `<div class="vazio"><b>${V.lista.length ? 'Nenhum voucher encontrado' : 'Nenhum voucher cadastrado'}</b><span>${V.lista.length ? 'Mude o filtro ou limpe a busca.' : 'Crie o primeiro voucher para liberar descontos nominais, grupos ou parceiros.'}</span></div>`}
        </div></div>`;
    } else {
      const canais = [
        ['todos', 'Todos os canais', V.usos.length],
        ['recepcao', 'Recepção', V.usos.filter((u) => u.canal === 'recepcao').length],
        ['site', 'Reserva online', V.usos.filter((u) => u.canal === 'site').length],
        ['grupo', 'Link de grupo', V.usos.filter((u) => u.canal === 'grupo').length],
      ];
      const usos = V.usos.filter(filtraUso);
      card.innerHTML = `${abasHtml}
        <div class="vchToolbar">
          <div class="filtros" role="group" aria-label="Filtrar canal">
            ${canais.map(([id, rot, n]) => `<button type="button" class="${V.canal === id ? 'sel' : ''}" data-canal="${id}">${esc(rot)} <span>(${n})</span></button>`).join('')}
          </div>
        </div>
        <div class="rolagemX"><div class="vchGrade">
          <div class="cabTabela vchUsoCols">
            <span>Data e hora</span>
            <span>Voucher</span>
            <span>Cliente</span>
            <span>Canal</span>
            <span class="t-dir">Desconto</span>
            <span class="t-dir">Ref.</span>
            <span>Situação</span>
          </div>
          ${usos.length ? usos.map((u) => `
            <div class="linhaTabela vchUsoCols" style="${u.estornado ? 'opacity: .6' : ''}">
              <span class="num peq">${esc(fmtDataHora(u.dataHora))}</span>
              <span class="vchCod mono" style="justify-self: start">${esc(u.voucher || '—')}</span>
              <div class="col" style="gap: 2px; min-width: 0">
                <b class="trunc">${esc(u.cliente || 'Cliente não informado')}</b>
                <span class="peq num">${esc(fmtDoc(u.documento))}</span>
              </div>
              <span>${canalChip(u)}</span>
              <b class="num t-dir">${brl(Number(u.desconto) || 0)}</b>
              <span class="num t-dir peq">${u.vendaId ? `#${u.vendaId}` : '—'}</span>
              <span>${u.estornado ? '<span class="chip laranja">Estornado</span>' : '<span class="chip verde">Aplicado</span>'}</span>
            </div>`).join('') : '<div class="vazio"><b>Nenhuma utilização encontrada</b><span>Quando um voucher for usado na Recepção, Site ou Link de grupo, ele aparece aqui.</span></div>'}
        </div></div>`;
    }

    const busca = $('#vchBusca');
    if (busca) {
      busca.oninput = () => {
        const pos = busca.selectionStart;
        V.q = busca.value;
        pintar();
        const novo = $('#vchBusca');
        if (novo) {
          novo.focus();
          if (pos != null) novo.setSelectionRange(pos, pos);
        }
      };
    }
  };

  // ---------------- Editor compartilhado de Pessoas / Grupo
  const montarEditorPessoas = (host, state, opts = {}) => {
    const modoDireto = opts.modoDireto || null;
    let buscaTimer = null;

    const chavePessoa = (p) => {
      if (p.clienteId) return `cid:${p.clienteId}`;
      const d = so(p.documento);
      if (d) return `doc:${d}`;
      return `nom:${normTxt(p.nome)}`;
    };

    const jaExiste = (cand) => {
      const cid = cand.clienteId ? Number(cand.clienteId) : null;
      const doc = so(cand.documento);
      return state.pessoas.some((x) => (cid && x.clienteId === cid) || (doc && so(x.documento) === doc));
    };

    const renderLista = () => {
      const alvo = $('#vchListaPessoas', host);
      if (!alvo) return;
      if (!state.pessoas.length) {
        alvo.innerHTML = `<div class="vazio" style="padding: var(--kib-espaco-2)"><b class="t-corpo">Nenhuma pessoa vinculada</b><span class="peq">Busque um cliente cadastrado, adicione manualmente ou cole uma lista do grupo.</span></div>`;
        return;
      }
      alvo.innerHTML = `<div class="vchPessoaLista">${state.pessoas.map((p, idx) => {
        const usosFeitos = Number(p.usosFeitos) || 0;
        const usosMax = Math.max(1, Number(p.usosMax) || 1);
        const esg = usosFeitos >= usosMax;
        const temBanco = !!p.clienteId;
        return `<div class="vchPessoaItem">
          <span class="avatar p" style="background: ${CORG[(p.clienteId || idx + 1) % 6]}">${esc(iniciais(p.nome))}</span>
          <div class="col cresce" style="min-width: 180px; gap: 2px">
            <div class="linha gap-meio" style="flex-wrap: wrap">
              <b>${esc(p.nome)}</b>
              ${temBanco ? '<span class="chip verde sem-sinal">Cadastro no banco</span>' : '<span class="chip azul sem-sinal">Vinculação por CPF</span>'}
            </div>
            <span class="peq num">CPF: ${esc(fmtDoc(p.documento))}${p.telefone ? ` · ${esc(p.telefone)}` : ''}${p.observacao ? ` · ${esc(p.observacao)}` : ''}</span>
          </div>
          <span class="chip ${esg ? 'vermelho' : 'cinza sem-sinal'} num">${usosFeitos}/${usosMax} uso(s)</span>
          ${podeAlterar ? `<button type="button" class="btn sec peq risco" data-rem-pessoa="${idx}" aria-label="Remover ${esc(p.nome)}">${svg(V_IC.lixo, 13, 'currentColor', 2.1)}Remover</button>` : ''}
        </div>`;
      }).join('')}</div>`;
      if (opts.onChange) opts.onChange();
    };

    const incluirPessoa = async (p) => {
      if (jaExiste(p)) {
        toast('Essa pessoa já está na lista deste voucher.');
        return false;
      }
      if (modoDireto) {
        await office(`/vouchers/${modoDireto.voucherId}/clientes`, {
          method: 'POST',
          body: {
            clientes: [{ clienteId: p.clienteId || null, nome: p.nome, documento: p.documento || null, telefone: p.telefone || null, usosMax: p.usosMax || 1 }],
            ajustarLimiteTotal: !!$('#vchAjustarTeto', host)?.checked,
          },
        });
        await modoDireto.recarregar();
        toast('Pessoa adicionada ao voucher');
        return true;
      }
      state.pessoas.push(p);
      renderLista();
      return true;
    };

    host.innerHTML = `
      <div class="vchBoxSec">
        <div class="linha gap-1" style="justify-content: space-between; flex-wrap: wrap">
          <div class="col" style="gap: 2px">
            <b>Pessoas e grupos autorizados</b>
            <span class="peq">Ao se identificar no site, link de grupo, recepção ou totem pelo CPF, o voucher é reconhecido automaticamente.</span>
          </div>
          <span class="chip roxo sem-sinal num" id="vchContPessoas">${plural(state.pessoas.length, 'pessoa', 'pessoas')}</span>
        </div>

        ${podeAlterar ? `
        <div class="campo">
          <span>Buscar cliente já cadastrado no kartódromo (nome, CPF ou telefone)</span>
          <input class="entrada" id="vchBuscaCli" placeholder="Digite ao menos 2 letras ou números do CPF…" autocomplete="off">
          <div id="vchResCli"></div>
        </div>

        <details style="margin-top: var(--kib-espaco-meio)">
          <summary class="btn sec peq" style="display: inline-flex; width: fit-content; list-style: none">${svg(IC.mais, 13, 'currentColor', 2.4)}Adicionar pessoa manualmente (mesmo sem conta no kartódromo)</summary>
          <div class="vchFormGrid" style="margin-top: var(--kib-espaco-1)">
            <label class="campo"><span>Nome completo *</span><input class="entrada" id="vchManNome" placeholder="Ex.: Maria Souza" autocomplete="off"></label>
            <label class="campo"><span>CPF *</span><input class="entrada num" id="vchManCpf" placeholder="000.000.000-00" autocomplete="off"></label>
            <label class="campo"><span>WhatsApp (opcional)</span><input class="entrada num" id="vchManFone" placeholder="(31) 99999-9999" autocomplete="off"></label>
            <label class="campo"><span>Usos permitidos</span><input class="entrada num" id="vchManUsos" type="number" min="1" max="50" value="1"></label>
          </div>
          <div class="linha gap-1" style="margin-top: var(--kib-espaco-1)">
            <button type="button" class="btn sec" id="vchBtnAddManual">Incluir na lista</button>
            <span class="peq" id="vchManAviso"></span>
          </div>
        </details>

        <details>
          <summary class="btn sec peq" style="display: inline-flex; width: fit-content; list-style: none">${svg(V_IC.pessoas, 13, 'currentColor', 2.2)}Colar lista de grupo (várias pessoas de uma vez)</summary>
          <div class="col gap-1" style="margin-top: var(--kib-espaco-1)">
            <span class="peq">Cole uma linha por pessoa: <b>Nome; CPF; WhatsApp</b> (ou apenas CPFs, separados por ponto e vírgula, vírgula ou tab).</span>
            <textarea class="entrada" id="vchLoteTxt" rows="4" style="height: auto; padding: var(--kib-espaco-1) var(--kib-espaco-denso-12); line-height: 1.45" placeholder="João Silva; 123.456.789-00; 31999998888&#10;Maria Souza; 987.654.321-00"></textarea>
            <div class="linha gap-1" style="flex-wrap: wrap">
              <label class="linha gap-meio peq">Usos por pessoa <input class="entrada peq num" id="vchLoteUsos" type="number" min="1" max="50" value="1" style="width: 72px"></label>
              <button type="button" class="btn prim peq" id="vchBtnImportarLote">Adicionar lista ao voucher</button>
            </div>
          </div>
        </details>` : ''}

        <div id="vchListaPessoas"></div>
      </div>`;

    const atualizarContador = () => {
      const c = $('#vchContPessoas', host);
      if (c) c.textContent = plural(state.pessoas.length, 'pessoa', 'pessoas');
    };
    const origOnChange = opts.onChange;
    opts.onChange = () => {
      atualizarContador();
      if (origOnChange) origOnChange();
    };
    renderLista();

    const inpBusca = $('#vchBuscaCli', host);
    if (inpBusca) {
      inpBusca.oninput = () => {
        clearTimeout(buscaTimer);
        const q = inpBusca.value.trim();
        const box = $('#vchResCli', host);
        if (q.length < 2) { box.innerHTML = ''; return; }
        box.innerHTML = '<div class="peq" style="padding: var(--kib-espaco-1)">Buscando clientes…</div>';
        buscaTimer = setTimeout(async () => {
          try {
            const cli = await office('/clientes?q=' + encodeURIComponent(q));
            if (inpBusca.value.trim() !== q) return;
            if (!cli.length) {
              box.innerHTML = '<div class="peq" style="padding: var(--kib-espaco-1)">Nenhum cliente cadastrado encontrado. Use "Adicionar pessoa manualmente" abaixo.</div>';
              return;
            }
            box.innerHTML = `<div class="vchResBusca">${cli.slice(0, 12).map((c) => {
              const dup = jaExiste({ clienteId: c.id, documento: c.documento });
              return `<button type="button" class="vchResItem" data-pick-cli="${c.id}" ${dup ? 'disabled' : ''}>
                <span class="avatar p" style="background: ${CORG[c.id % 6]}">${esc(iniciais(c.nome))}</span>
                <span class="col cresce" style="min-width: 0; gap: 2px">
                  <b class="trunc">${esc(c.nome)}</b>
                  <span class="peq num">CPF: ${esc(fmtDoc(c.documento))}${c.telefone ? ` · ${esc(c.telefone)}` : ''}</span>
                </span>
                <span class="chip ${dup ? 'verde' : 'azul sem-sinal'}">${dup ? 'Na lista' : 'Adicionar'}</span>
              </button>`;
            }).join('')}</div>`;
            box.querySelectorAll('[data-pick-cli]').forEach((btn) => {
              btn.onclick = async () => {
                const cid = Number(btn.dataset.pickCli);
                const c = cli.find((x) => Number(x.id) === cid);
                if (!c) return;
                btn.disabled = true;
                try {
                  const ok = await incluirPessoa({
                    clienteId: c.id,
                    nome: c.nome,
                    documento: so(c.documento) || null,
                    telefone: c.telefone || null,
                    usosMax: Math.max(1, Number($('#vchManUsos', host)?.value) || 1),
                    usosFeitos: 0,
                  });
                  if (ok && !modoDireto) {
                    inpBusca.value = '';
                    box.innerHTML = '';
                  }
                } catch (err) {
                  toast(err.message);
                  btn.disabled = false;
                }
              };
            });
          } catch (err) {
            box.innerHTML = `<div class="peq" style="padding: var(--kib-espaco-1)">${esc(err.message)}</div>`;
          }
        }, 240);
      };
    }

    const btnMan = $('#vchBtnAddManual', host);
    if (btnMan) {
      btnMan.onclick = async () => {
        const nome = $('#vchManNome', host).value.trim();
        const doc = so($('#vchManCpf', host).value);
        const fone = $('#vchManFone', host).value.trim();
        const usosMax = Math.max(1, Number($('#vchManUsos', host).value) || 1);
        const aviso = $('#vchManAviso', host);
        if (!nome) { aviso.textContent = 'Informe o nome da pessoa.'; return; }
        if (doc && doc.length !== 11 && doc.length !== 14) { aviso.textContent = 'Informe um CPF com 11 dígitos (ou CNPJ).'; return; }
        if (!doc) { aviso.textContent = 'Informe o CPF para o totem, site e recepção identificarem a pessoa.'; return; }
        aviso.textContent = '';
        btnMan.disabled = true;
        try {
          const ok = await incluirPessoa({ clienteId: null, nome, documento: doc, telefone: fone || null, usosMax, usosFeitos: 0 });
          if (ok && !modoDireto) {
            $('#vchManNome', host).value = '';
            $('#vchManCpf', host).value = '';
            $('#vchManFone', host).value = '';
          }
        } catch (err) {
          aviso.textContent = err.message;
        } finally {
          btnMan.disabled = false;
        }
      };
    }

    const btnLote = $('#vchBtnImportarLote', host);
    if (btnLote) {
      btnLote.onclick = async () => {
        const txt = $('#vchLoteTxt', host).value;
        const usosPadrao = Math.max(1, Number($('#vchLoteUsos', host).value) || 1);
        const { itens, ignoradas } = parseLote(txt, usosPadrao);
        if (!itens.length) { toast('Nenhuma linha válida encontrada. Informe Nome e CPF.'); return; }
        const novos = itens.filter((p) => !jaExiste(p));
        if (!novos.length) { toast('Todas as pessoas coladas já estão na lista.'); return; }
        btnLote.disabled = true;
        try {
          if (modoDireto) {
            await office(`/vouchers/${modoDireto.voucherId}/clientes`, {
              method: 'POST',
              body: {
                clientes: novos.map((p) => ({ nome: p.nome, documento: p.documento, telefone: p.telefone, usosMax: p.usosMax })),
                ajustarLimiteTotal: !!$('#vchAjustarTeto', host)?.checked,
              },
            });
            await modoDireto.recarregar();
          } else {
            const chavesAtuais = new Set(state.pessoas.map(chavePessoa));
            for (const p of novos) {
              const k = chavePessoa(p);
              if (!chavesAtuais.has(k)) {
                chavesAtuais.add(k);
                state.pessoas.push(p);
              }
            }
            renderLista();
          }
          $('#vchLoteTxt', host).value = '';
          toast(`${plural(novos.length, 'pessoa incluída', 'pessoas incluídas')}${ignoradas.length ? ` (${ignoradas.length} linha(s) ignorada(s))` : ''}`);
        } catch (err) {
          toast(err.message);
        } finally {
          btnLote.disabled = false;
        }
      };
    }

    host.addEventListener('click', async (ev) => {
      const rem = ev.target.closest('[data-rem-pessoa]');
      if (!rem) return;
      const idx = Number(rem.dataset.remPessoa);
      const p = state.pessoas[idx];
      if (!p) return;
      if (modoDireto && p.id) {
        rem.disabled = true;
        try {
          await office(`/vouchers/${modoDireto.voucherId}/clientes/${p.id}`, { method: 'DELETE' });
          await modoDireto.recarregar();
          toast(`${p.nome} removido(a) do voucher`);
        } catch (err) {
          toast(err.message);
          rem.disabled = false;
        }
        return;
      }
      state.pessoas.splice(idx, 1);
      renderLista();
    });

    return { renderLista };
  };

  // ---------------- Modal Criar / Editar Voucher
  const abrirModalVoucher = async (voucherId = null) => {
    const m = modal(`<div class="modalTopo"><span class="t-titulo-grande peso-negrito">Carregando voucher…</span></div><div class="pad-2"><div class="esqueleto" style="height: 220px"></div></div>`, 'Voucher');
    m.style.maxWidth = '820px';
    try {
      await carregarCatalogos();
      const det = voucherId ? await office(`/vouchers/${voucherId}`) : null;
      if (!document.body.contains(m)) return;

      const novo = !det;
      const hoje = hojeIso();
      const fimPadrao = addDiasIso(hoje, 30);
      const state = {
        pessoas: (det?.clientes || []).map((c) => ({
          id: c.id,
          clienteId: c.clienteId,
          nome: c.nome,
          documento: c.documento,
          telefone: c.telefone,
          usosMax: c.usosMax || 1,
          usosFeitos: c.usosFeitos || 0,
          observacao: c.observacao || '',
        })),
      };

      const origemAtual = det?.origem || 'manual';
      const usoUnicoAtual = det ? !!det.usoUnico : false;

      m.innerHTML = `
        <div class="modalTopo">
          <div class="col" style="gap: 2px">
            <span class="t-titulo-grande peso-negrito">${novo ? 'Novo voucher' : `Editar voucher ${esc(det.codigo)}`}</span>
            <span class="peq">Valido na Recepção, Site, Links de grupo e reconhecido pelo CPF no Totem.</span>
          </div>
          <button type="button" class="fechar hov solto" data-acao="fechar" aria-label="Fechar">${svg(IC.fechar, 15, 'var(--tinta)', 2.4)}</button>
        </div>
        <div style="padding: 0 var(--kib-espaco-denso-20) var(--kib-espaco-denso-20); display: flex; flex-direction: column; gap: var(--kib-espaco-2)">
          <div class="vchFormGrid">
            <div class="campo">
              <span>Código do voucher *</span>
              <div class="linha gap-meio">
                <input class="entrada mono" id="fVchCodigo" value="${esc(det?.codigo || gerarCodigo())}" maxlength="30" style="text-transform: uppercase" autocomplete="off">
                <button type="button" class="btn sec peq" id="fVchGerar">Gerar</button>
              </div>
            </div>
            <label class="campo">
              <span>Origem</span>
              <select class="entrada" id="fVchOrigem">
                <option value="manual" ${origemAtual === 'manual' ? 'selected' : ''}>Manual / Campanha / Grupo</option>
                <option value="parceiro" ${origemAtual === 'parceiro' ? 'selected' : ''}>Parceiro</option>
                <option value="fidelidade" ${origemAtual === 'fidelidade' ? 'selected' : ''}>Fidelidade</option>
              </select>
            </label>
            <div class="campo" id="fVchBoxRef">
              <span>Referência / Nome do grupo</span>
              <input class="entrada" id="fVchRef" value="${esc(det?.referencia || '')}" placeholder="Ex.: Grupo Empresa X ou Promo Novembro">
            </div>
            <div class="campo" id="fVchBoxParc" hidden>
              <span>Parceiro vinculado</span>
              <select class="entrada" id="fVchParceiro">
                <option value="">Selecione um parceiro…</option>
                ${V.parceiros.map((p) => `<option value="${p.id}" ${Number(det?.parceiroId) === Number(p.id) ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
              </select>
            </div>
            <div class="campo" id="fVchBoxFid" hidden>
              <span>Conta fidelidade</span>
              <select class="entrada" id="fVchConta">
                <option value="">Selecione a conta…</option>
                ${V.contas.map((c) => `<option value="${c.id}" ${Number(det?.fidelidadeContaId) === Number(c.id) ? 'selected' : ''}>${esc(c.nome)}${c.documento ? ` · ${fmtDoc(c.documento)}` : ''}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="vchFormGrid">
            <label class="campo">
              <span>Tipo de desconto</span>
              <select class="entrada" id="fVchTipo">
                <option value="percentual" ${(det?.tipo || 'percentual') === 'percentual' ? 'selected' : ''}>Percentual (%)</option>
                <option value="valor" ${det?.tipo === 'valor' ? 'selected' : ''}>Valor fixo (R$)</option>
              </select>
            </label>
            <label class="campo">
              <span id="fVchLblValor">${det?.tipo === 'valor' ? 'Desconto (R$) *' : 'Desconto (%) *'}</span>
              <input class="entrada num" id="fVchValor" value="${esc(det ? (det.tipo === 'valor' ? brlCampo(det.valor) : String(det.valor)) : '10')}" placeholder="${det?.tipo === 'valor' ? '50,00' : '10'}">
            </label>
            <label class="campo">
              <span>Produto específico</span>
              <select class="entrada" id="fVchProd">
                <option value="">Qualquer bateria / produto</option>
                ${V.produtos.map((p) => `<option value="${p.id}" ${Number(det?.produtoId) === Number(p.id) ? 'selected' : ''}>${esc(p.nome)} (${brl(p.preco || p.precoCentavos || 0)})</option>`).join('')}
              </select>
            </label>
            <label class="campo">
              <span>Validade inicial *</span>
              <input class="entrada num" id="fVchIni" type="date" value="${esc((det?.inicio || hoje).slice(0, 10))}">
            </label>
            <label class="campo">
              <span>Validade final *</span>
              <input class="entrada num" id="fVchFim" type="date" value="${esc((det?.fim || fimPadrao).slice(0, 10))}">
            </label>
            <label class="campo">
              <span>Pedido mínimo (R$)</span>
              <input class="entrada num" id="fVchMin" value="${esc(brlCampo(det?.pedidoMinimo))}" placeholder="Sem mínimo">
            </label>
            <label class="campo">
              <span>Desconto máximo (R$)</span>
              <input class="entrada num" id="fVchMax" value="${esc(brlCampo(det?.descontoMaximo))}" placeholder="Sem teto">
            </label>
          </div>

          <div class="vchBoxSec">
            <b>Regras de quantidade e esgotamento automático</b>
            <div class="vchFormGrid">
              <div class="campo">
                <span>Limite total de usos do voucher</span>
                <div class="linha gap-meio">
                  <input class="entrada num" id="fVchUsoMaxTotal" type="number" min="1" value="${det?.usoMaxTotal != null ? det.usoMaxTotal : ''}" placeholder="Sem limite global">
                  <button type="button" class="btn sec peq" id="fVchIgualarGrupo" title="Igualar limite total ao número de pessoas na lista">Igualar lista</button>
                </div>
                <span class="ajuda-campo">Quando atingir esse total de usos (somando Recepção, Site e Grupo), o voucher esgota sozinho.</span>
              </div>
              <label class="campo">
                <span>Usos máximos por cliente</span>
                <input class="entrada num" id="fVchUsoCli" type="number" min="1" value="${det?.usoMaxCliente || 1}">
                <span class="ajuda-campo">Quantas vezes cada pessoa pode usar o cupom.</span>
              </label>
            </div>
            <label class="vchCheckLinha">
              <input type="checkbox" id="fVchUsoUnico" ${usoUnicoAtual ? 'checked' : ''}>
              <span class="col" style="gap: 2px">
                <b>Uso único (vale 1 utilização no total)</b>
                <span class="peq">Após a primeira compra concluída em qualquer canal, o voucher é marcado como esgotado.</span>
              </span>
            </label>
            <label class="vchCheckLinha">
              <input type="checkbox" id="fVchRestrito" ${det?.restritoClientes ? 'checked' : ''}>
              <span class="col" style="gap: 2px">
                <b>Restringir às pessoas / grupo cadastrados abaixo</b>
                <span class="peq">Somente os clientes desta lista (por cadastro ou CPF) poderão utilizar este voucher.</span>
              </span>
            </label>
            ${!novo ? `<label class="vchCheckLinha"><input type="checkbox" id="fVchAtivo" ${det.ativo ? 'checked' : ''}><span><b>Voucher ativo</b> (desmarque para suspender manualmente)</span></label>` : ''}
          </div>

          <div id="fVchPessoasHost"></div>
          <p class="erroMsg" id="fVchErro" style="margin: 0"></p>
        </div>
        <div class="modalRodape">
          <button type="button" class="btn sec empurra" data-acao="fechar">Cancelar</button>
          <button type="button" class="btn prim" id="fVchSalvar">${novo ? 'Criar voucher' : 'Salvar alterações'}</button>
        </div>`;

      const atualizaOrigem = () => {
        const ori = $('#fVchOrigem', m).value;
        $('#fVchBoxRef', m).hidden = ori !== 'manual';
        $('#fVchBoxParc', m).hidden = ori !== 'parceiro';
        $('#fVchBoxFid', m).hidden = ori !== 'fidelidade';
      };
      const atualizaTipo = () => {
        const v = $('#fVchTipo', m).value === 'valor';
        $('#fVchLblValor', m).textContent = v ? 'Desconto (R$) *' : 'Desconto (%) *';
        $('#fVchValor', m).placeholder = v ? '50,00' : '10';
      };
      const atualizaUsoUnico = () => {
        const uu = $('#fVchUsoUnico', m).checked;
        const inpTotal = $('#fVchUsoMaxTotal', m);
        inpTotal.disabled = uu;
        if (uu) inpTotal.value = '1';
      };
      const atualizaBotaoIgualar = () => {
        const btn = $('#fVchIgualarGrupo', m);
        if (!btn) return;
        const n = state.pessoas.reduce((s, p) => s + Math.max(1, Number(p.usosMax) || 1), 0);
        btn.disabled = n === 0 || $('#fVchUsoUnico', m).checked;
        btn.textContent = n ? `Igualar (${n})` : 'Igualar lista';
      };

      $('#fVchGerar', m).onclick = () => { $('#fVchCodigo', m).value = gerarCodigo(); };
      $('#fVchOrigem', m).onchange = atualizaOrigem;
      $('#fVchTipo', m).onchange = atualizaTipo;
      $('#fVchUsoUnico', m).onchange = () => { atualizaUsoUnico(); atualizaBotaoIgualar(); };
      $('#fVchIgualarGrupo', m).onclick = () => {
        const n = state.pessoas.reduce((s, p) => s + Math.max(1, Number(p.usosMax) || 1), 0);
        if (n > 0) {
          $('#fVchUsoUnico', m).checked = false;
          $('#fVchUsoMaxTotal', m).disabled = false;
          $('#fVchUsoMaxTotal', m).value = String(n);
        }
      };

      atualizaOrigem();
      atualizaTipo();
      atualizaUsoUnico();
      montarEditorPessoas($('#fVchPessoasHost', m), state, { onChange: atualizaBotaoIgualar });
      atualizaBotaoIgualar();

      $('#fVchSalvar', m).onclick = async () => {
        const erro = (msg) => { $('#fVchErro', m).textContent = msg; };
        erro('');
        const codigo = $('#fVchCodigo', m).value.trim().toUpperCase();
        const origem = $('#fVchOrigem', m).value;
        const tipo = $('#fVchTipo', m).value;
        const valorRaw = $('#fVchValor', m).value;
        const inicio = $('#fVchIni', m).value;
        const fim = $('#fVchFim', m).value;
        const usoUnico = $('#fVchUsoUnico', m).checked;
        const usoMaxCliente = Math.max(1, Number($('#fVchUsoCli', m).value) || 1);
        const rawTotal = $('#fVchUsoMaxTotal', m).value.trim();
        const usoMaxTotal = usoUnico ? 1 : (rawTotal ? Math.max(1, Number(rawTotal) || 0) : null);
        const restritoClientes = $('#fVchRestrito', m).checked;

        if (!codigo || codigo.length < 3) return erro('Informe um código com pelo menos 3 caracteres.');
        if (!inicio || !fim || fim < inicio) return erro('A validade final deve ser igual ou posterior à inicial.');
        let valor = 0;
        if (tipo === 'percentual') {
          valor = Math.round(Number(valorRaw.replace(',', '.')));
          if (!Number.isFinite(valor) || valor < 1 || valor > 100) return erro('Informe um desconto percentual entre 1% e 100%.');
        } else {
          valor = lerCentavos(valorRaw);
          if (!Number.isFinite(valor) || valor <= 0) return erro('Informe um desconto em reais válido.');
        }
        const pedidoMinimo = lerCentavos($('#fVchMin', m).value);
        if (Number.isNaN(pedidoMinimo)) return erro('Pedido mínimo inválido.');
        const descontoMaximo = lerCentavos($('#fVchMax', m).value);
        if (Number.isNaN(descontoMaximo)) return erro('Desconto máximo inválido.');
        if (origem === 'parceiro' && !$('#fVchParceiro', m).value) return erro('Selecione o parceiro.');
        if (origem === 'fidelidade' && !$('#fVchConta', m).value) return erro('Selecione a conta fidelidade.');
        if (restritoClientes && state.pessoas.length === 0) return erro('Adicione pelo menos uma pessoa à lista ou desmarque a restrição.');

        const body = {
          codigo,
          origem,
          referencia: origem === 'manual' ? ($('#fVchRef', m).value.trim() || null) : null,
          parceiroId: origem === 'parceiro' ? Number($('#fVchParceiro', m).value) : null,
          fidelidadeContaId: origem === 'fidelidade' ? Number($('#fVchConta', m).value) : null,
          tipo,
          valor,
          inicio,
          fim,
          produtoId: $('#fVchProd', m).value ? Number($('#fVchProd', m).value) : null,
          usoMaxCliente,
          usoMaxTotal,
          usoUnico,
          restritoClientes,
          pedidoMinimo: pedidoMinimo && pedidoMinimo > 0 ? pedidoMinimo : null,
          descontoMaximo: descontoMaximo && descontoMaximo > 0 ? descontoMaximo : null,
          clientes: state.pessoas.map((p) => ({
            clienteId: p.clienteId || null,
            nome: p.nome,
            documento: p.documento || null,
            telefone: p.telefone || null,
            usosMax: Math.max(1, Number(p.usosMax) || 1),
            observacao: p.observacao || null,
          })),
        };
        if (!novo) body.ativo = $('#fVchAtivo', m).checked;

        const btn = $('#fVchSalvar', m);
        btn.disabled = true;
        try {
          await office(novo ? '/vouchers' : `/vouchers/${det.id}`, { method: novo ? 'POST' : 'PUT', body });
          toast(novo ? 'Voucher criado' : 'Voucher atualizado');
          fecharCamada();
          await carregarDados();
          pintar();
        } catch (err) {
          erro(err.message);
          btn.disabled = false;
        }
      };
    } catch (err) {
      if (!document.body.contains(m)) return;
      m.innerHTML = `<div class="modalTopo"><b>Erro ao abrir voucher</b><button type="button" class="fechar hov solto" data-acao="fechar">${svg(IC.fechar, 15)}</button></div><div class="pad-2"><p class="erroMsg">${esc(err.message)}</p></div>`;
    }
  };

  // ---------------- Modal dedicado Gerenciar Pessoas / Grupo
  const abrirModalPessoas = async (voucherId) => {
    const m = modal(`<div class="modalTopo"><span class="t-titulo-grande peso-negrito">Carregando pessoas do voucher…</span></div><div class="pad-2"><div class="esqueleto" style="height: 200px"></div></div>`, 'Pessoas do voucher');
    m.style.maxWidth = '780px';

    const state = { pessoas: [], det: null };
    const pintarModal = async () => {
      const det = await office(`/vouchers/${voucherId}`);
      if (!document.body.contains(m)) return;
      state.det = det;
      state.pessoas = (det.clientes || []).map((c) => ({ ...c }));

      m.innerHTML = `
        <div class="modalTopo">
          <div class="col" style="gap: var(--kib-espaco-meio)">
            <div class="linha gap-1" style="flex-wrap: wrap">
              <span class="vchCod mono">${esc(det.codigo)}</span>
              ${chipStatus(det)}
              ${det.restritoClientes ? '<span class="chip roxo sem-sinal">Uso restrito às pessoas abaixo</span>' : '<span class="chip azul sem-sinal">Aberto (com lista opcional)</span>'}
            </div>
            <span class="peq num">Desconto de ${esc(descontoTxt(det))} · Usos: <b>${det.usos || 0}</b>${det.limiteTotal != null ? ` / ${det.limiteTotal}` : ' (sem teto)'}</span>
          </div>
          <button type="button" class="fechar hov solto" data-acao="fechar" aria-label="Fechar">${svg(IC.fechar, 15, 'var(--tinta)', 2.4)}</button>
        </div>
        <div style="padding: 0 var(--kib-espaco-denso-20) var(--kib-espaco-denso-20); display: flex; flex-direction: column; gap: var(--kib-espaco-denso-12)">
          ${podeAlterar ? `
            <div class="linha gap-2" style="justify-content: space-between; flex-wrap: wrap; padding: var(--kib-espaco-1) var(--kib-espaco-denso-12); border-radius: var(--kib-raio-botao); background: var(--sup2)">
              <label class="linha gap-1 peq" style="cursor: pointer">
                <input type="checkbox" id="vchToggleRestrito" ${det.restritoClientes ? 'checked' : ''} style="width: 18px; height: 18px">
                <span><b>Restringir voucher</b> apenas às pessoas desta lista</span>
              </label>
              <label class="linha gap-1 peq" style="cursor: pointer">
                <input type="checkbox" id="vchAjustarTeto" ${det.usoMaxTotal != null ? 'checked' : ''} style="width: 18px; height: 18px">
                <span>Ajustar limite total ao adicionar/remover</span>
              </label>
            </div>` : ''}
          <div id="vchPessoasHost"></div>
        </div>
        <div class="modalRodape">
          <button type="button" class="btn prim empurra" data-acao="fechar">Concluir</button>
        </div>`;

      const recarregarTudo = async () => {
        await Promise.all([pintarModal(), carregarDados()]);
        pintar();
      };

      const toggleRest = $('#vchToggleRestrito', m);
      if (toggleRest) {
        toggleRest.onchange = async () => {
          if (toggleRest.checked && state.pessoas.length === 0) {
            toggleRest.checked = false;
            toast('Inclua pelo menos uma pessoa antes de ativar a restrição.');
            return;
          }
          toggleRest.disabled = true;
          try {
            await office(`/vouchers/${det.id}`, { method: 'PUT', body: { restritoClientes: toggleRest.checked } });
            await recarregarTudo();
            toast(toggleRest.checked ? 'Voucher restrito às pessoas da lista' : 'Voucher liberado para qualquer cliente');
          } catch (err) {
            toast(err.message);
            toggleRest.checked = !toggleRest.checked;
            toggleRest.disabled = false;
          }
        };
      }

      montarEditorPessoas($('#vchPessoasHost', m), state, {
        modoDireto: {
          voucherId: det.id,
          recarregar: recarregarTudo,
        },
      });
    };

    try {
      await pintarModal();
    } catch (err) {
      if (!document.body.contains(m)) return;
      m.innerHTML = `<div class="modalTopo"><b>Erro</b><button type="button" class="fechar hov solto" data-acao="fechar">${svg(IC.fechar, 15)}</button></div><div class="pad-2"><p class="erroMsg">${esc(err.message)}</p></div>`;
    }
  };

  // ---------------- Eventos da tela
  tela.addEventListener('click', async (ev) => {
    const t = ev.target;
    if (t.closest('#vchNovo')) { if (podeAlterar) abrirModalVoucher(null); return; }
    if (t.closest('#vchAtualizar')) {
      const btn = t.closest('#vchAtualizar');
      btn.disabled = true;
      try {
        await carregarDados();
        pintar();
      } catch (err) {
        falhou(err);
      } finally {
        btn.disabled = false;
      }
      return;
    }
    const aba = t.closest('[data-aba]');
    if (aba) { V.aba = aba.dataset.aba; pintar(); return; }
    const filtro = t.closest('[data-filtro]');
    if (filtro) { V.filtro = filtro.dataset.filtro; pintar(); return; }
    const canal = t.closest('[data-canal]');
    if (canal) { V.canal = canal.dataset.canal; pintar(); return; }

    const copiar = t.closest('[data-copiar]');
    if (copiar) {
      const cod = copiar.dataset.copiar;
      try {
        await navigator.clipboard.writeText(cod);
        toast(`Código ${cod} copiado`);
      } catch {
        toast(`Código: ${cod}`);
      }
      return;
    }

    const pessoasBtn = t.closest('[data-pessoas]');
    if (pessoasBtn) { abrirModalPessoas(Number(pessoasBtn.dataset.pessoas)); return; }

    const editBtn = t.closest('[data-editar]');
    if (editBtn && podeAlterar) { abrirModalVoucher(Number(editBtn.dataset.editar)); return; }

    const altBtn = t.closest('[data-alternar]');
    if (altBtn && podeAlterar) {
      const id = Number(altBtn.dataset.alternar);
      const item = V.lista.find((x) => Number(x.id) === id);
      if (!item) return;
      const prox = !item.ativo;
      const ok = await confirmar(
        prox ? `Reativar voucher ${item.codigo}?` : `Desativar voucher ${item.codigo}?`,
        prox ? 'Ele volta a aceitar usos dentro da validade e do limite configurado.' : 'O código não poderá mais ser aplicado até ser reativado.',
        prox ? 'Reativar' : 'Desativar',
        !prox,
      );
      if (!ok) return;
      altBtn.disabled = true;
      try {
        await office(`/vouchers/${id}`, { method: 'PUT', body: { ativo: prox } });
        toast(prox ? 'Voucher reativado' : 'Voucher desativado');
        await carregarDados();
        pintar();
      } catch (err) {
        falhou(err);
        altBtn.disabled = false;
      }
    }
  });

  await carregarDados();
  pintar();
};
