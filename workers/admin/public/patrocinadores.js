'use strict';
/* Patrocinadores e publicidade: empresas, outdoors e pódio, contratos, recorrência e cobranças. Depende de app.js. */
IC.patro = 'M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z';
NAV.splice(NAV.findIndex((g) => g.t === 'Sistema'), 0, { t: 'Comercial', itens: [['patrocinadores', 'Patrocinadores', IC.patro, G('#B388FF', '#7C4DFF')]] });

const PT = {
  recorrencia: { unico: 'Pagamento único', mensal: 'Mensal', bimestral: 'Bimestral', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' },
  meses: { unico: 0, mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 },
  tipo: { outdoor: 'Outdoor', podio: 'Pódio', banner: 'Banner', telao: 'Telão', estrutura: 'Estrutura', outro: 'Outro' },
  status: { rascunho: ['amarelo', 'Rascunho'], ativo: ['verde', 'Ativo'], encerrado: ['cinza', 'Encerrado'], cancelado: ['vermelho', 'Cancelado'] },
  cobranca: { pendente: ['amarelo', 'A receber'], atrasado: ['vermelho', 'Atrasado'], pago: ['verde', 'Pago'], cancelado: ['cinza', 'Cancelada'] },
  formas: ['Pix', 'Transferência', 'Boleto', 'Dinheiro', 'Cartão', 'Permuta'],
};
const ptR = (v) => brl(Math.round((+v || 0) * 100));
const ptRc = (v) => ptR(v).replace(',00', '');
const ptData = (s) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '—');
const ptDias = (s) => Math.round((deIso(s) - deIso(hojeIso())) / 86400000);
const ptMensal = (c) => (PT.meses[c.recorrencia] ? +c.valor / PT.meses[c.recorrencia] : 0);
const ptVigente = (c) => c.status === 'ativo' && c.data_inicio <= hojeIso() && (!c.data_fim || c.data_fim >= hojeIso());
const ptSelo = (mapa, k) => `<span class="i2-selo ${(mapa[k] || ['cinza', k])[0]}">${esc((mapa[k] || ['', k])[1])}</span>`;

async function ptEnviar(file, categoria) {
  let f = file;
  if (f.type.startsWith('image/') && f.type !== 'image/gif' && f.size > 1_500_000) {
    const bmp = await createImageBitmap(f);
    const esc2 = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * esc2); cv.height = Math.round(bmp.height * esc2);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob = await new Promise((ok) => cv.toBlob(ok, 'image/webp', 0.85));
    if (blob) f = new File([blob], f.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' });
  }
  const fd = new FormData();
  fd.append('file', f); fd.append('categoria', categoria);
  const r = await fetch('/api/patro/arquivos', { method: 'POST', headers: { authorization: 'Bearer ' + S.token }, body: fd });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) { sair('Sua sessão terminou. Entre de novo.'); throw new Error('Sessão expirada.'); }
  if (!r.ok) throw new Error(d.error || `Erro ${r.status}`);
  return d;
}

async function ptBlob(id) {
  const r = await fetch('/api/patro/arquivos/' + id, { headers: { authorization: 'Bearer ' + S.token } });
  if (!r.ok) throw new Error('Não deu para abrir o arquivo.');
  return r.blob();
}

/** Troca <img data-arq="ID"> pela imagem baixada com o login (o navegador não manda o token em <img>). */
function ptImagens(raiz) {
  raiz.querySelectorAll('img[data-arq]').forEach(async (img) => {
    try { img.src = URL.createObjectURL(await ptBlob(img.dataset.arq)); } catch { img.remove(); }
  });
}

const ptCampo = (c, v) => {
  const val = v[c.k] ?? '';
  const id = `pt-${c.k}`;
  const larga = c.larga ? ' larga' : '';
  if (c.t === 'check') return `<label class="campo${larga}" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="${id}" ${v[c.k] ? 'checked' : ''}><span style="font-size:14px;color:inherit">${esc(c.r)}</span></label>`;
  if (c.t === 'arquivo') {
    const doc = !c.img;
    return `<div class="campo larga"><span>${esc(c.r)}</span><div class="pt-arq" data-arq-campo="${c.k}"><div class="pt-logo">${val && !doc ? `<img data-arq="${esc(val)}" alt="">` : val ? 'PDF' : '+'}</div>
      <div>${val ? (doc ? `<a href="#" data-abrir="${esc(val)}">Abrir arquivo anexado</a>` : 'Imagem anexada') : esc(c.dica || 'Nenhum arquivo enviado')}</div>
      <button type="button" class="btn sec peq" data-env="${c.k}">${val ? 'Trocar' : 'Enviar'}</button>${val ? `<button type="button" class="btn perigo peq" data-rem="${c.k}">Remover</button>` : ''}</div>
      <input type="file" hidden id="${id}-f" accept="${c.img ? 'image/png,image/jpeg,image/webp,image/gif' : 'application/pdf,.docx'}"></div>`;
  }
  const ctl = c.t === 'area' ? `<textarea class="entrada" id="${id}" rows="3">${esc(val)}</textarea>`
    : c.t === 'sel' ? `<select class="entrada" id="${id}">${c.o.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(val) === String(ov) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>`
    : `<input class="entrada" id="${id}" type="${c.t || 'text'}" ${c.t === 'number' ? `step="${c.passo || '0.01'}" min="${c.min ?? 0}" ${c.max ? `max="${c.max}"` : ''}` : ''} value="${esc(val)}" ${c.req ? 'required' : ''} ${c.ph ? `placeholder="${esc(c.ph)}"` : ''}>`;
  return `<label class="campo${larga}"><span>${esc(c.r)}${c.req ? ' *' : ''}</span>${ctl}${c.dica ? `<small class="i2-m">${esc(c.dica)}</small>` : ''}</label>`;
};

/** Gaveta com formulário. `salvar(valores)` recebe os campos prontos e devolve uma promessa. */
function ptForm({ titulo, campos, valores, salvar, aoMudar }) {
  const v = { ...valores };
  const g = gaveta(`<form class="i2-g" novalidate><div class="i2-gc"><h2>${esc(titulo)}</h2><button type="button" class="btn sec" data-fechar>Fechar</button></div>
    <div class="pt-form">${campos.map((c) => ptCampo(c, v)).join('')}</div>
    <div class="i2-acoes"><button class="btn prim">Salvar</button><button type="button" class="btn sec" data-fechar>Cancelar</button></div></form>`);
  const form = $('form', g);
  ptImagens(g);
  const ler = () => campos.forEach((c) => {
    const el = $('#pt-' + c.k, g);
    if (!el || c.t === 'arquivo') return;
    v[c.k] = c.t === 'check' ? el.checked : el.value;
  });
  const refazer = () => ptForm({ titulo, campos, valores: v, salvar, aoMudar });
  g.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', fecharCamada));
  g.querySelectorAll('[data-abrir]').forEach((a) => a.addEventListener('click', async (e) => { e.preventDefault(); try { window.open(URL.createObjectURL(await ptBlob(a.dataset.abrir)), '_blank'); } catch (err) { toast(err.message, true); } }));
  g.querySelectorAll('[data-env]').forEach((b) => b.addEventListener('click', () => $(`#pt-${b.dataset.env}-f`, g).click()));
  g.querySelectorAll('[data-rem]').forEach((b) => b.addEventListener('click', () => { ler(); v[b.dataset.rem] = null; refazer(); }));
  campos.filter((c) => c.t === 'arquivo').forEach((c) => $(`#pt-${c.k}-f`, g).addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const novo = (await ptEnviar(f, c.cat)).id; ler(); v[c.k] = novo; refazer(); } catch (err) { toast(err.message, true); }
  }));
  if (aoMudar) campos.filter((c) => c.aoMudar).forEach((c) => $('#pt-' + c.k, g).addEventListener('change', () => { ler(); aoMudar(c.k, v); refazer(); }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    ler();
    const btn = $('.prim', form); btn.disabled = true;
    try { await salvar(v); fecharCamada(); } catch (err) { toast(err.message, true); btn.disabled = false; }
  });
}

function ptConfirmar(msg, sim) {
  const m = modal(`<div class="i2-g"><h2>Tem certeza?</h2><p>${esc(msg)}</p><div class="i2-acoes"><button class="btn perigo forte" data-sim>Excluir</button><button class="btn sec" data-nao>Cancelar</button></div></div>`);
  $('[data-nao]', m).addEventListener('click', fecharCamada);
  $('[data-sim]', m).addEventListener('click', async () => { fecharCamada(); await sim(); });
}

TELAS.patrocinadores = async (tela) => {
  const P = S.pt || (S.pt = { aba: 'resumo', fc: 'todos', fb: 'todas', q: '', emp: '' });
  let D;
  const agir = async (fn, ok) => { try { const r = await fn(); if (ok) toast(ok); return r; } catch (e) { toast(e.message, true); return null; } };
  const carregar = async () => { D = await api('/patro/tudo'); };
  await carregar();
  const emp = (id) => D.empresas.find((e) => e.id === id);
  const logo = (e) => `<div class="pt-logo">${e.logo_arquivo_id ? `<img data-arq="${esc(e.logo_arquivo_id)}" alt="">` : esc((e.nome || '?')[0].toUpperCase())}</div>`;
  const busca = (itens, campos) => { const t = P.q.trim().toLowerCase(); return t ? itens.filter((i) => campos.some((c) => String(i[c] ?? '').toLowerCase().includes(t))) : itens; };
  const vazio = (t, s) => `<div class="vazio"><b>${t}</b><span>${s}</span></div>`;

  // ---------------- Resumo
  const resumo = () => {
    const vig = D.contratos.filter(ptVigente);
    const abertas = D.cobrancas.filter((c) => c.status === 'pendente' || c.status === 'atrasado');
    const atras = D.cobrancas.filter((c) => c.status === 'atrasado');
    const lim = somaDias(hojeIso(), 30);
    const prox = D.cobrancas.filter((c) => c.status === 'pendente' && c.vencimento <= lim).slice(0, 6);
    const acabando = vig.filter((c) => c.data_fim && c.data_fim <= lim).sort((a, b) => a.data_fim.localeCompare(b.data_fim));
    const ativos = D.espacos.filter((e) => e.ativo);
    const ocupados = ativos.filter((e) => vig.some((c) => c.espaco_id === e.id)).length;
    const soma = (l) => l.reduce((s, c) => s + c.valor, 0);
    return `<section class="i2-num">
      <div class="cartao"><span>Receita mensal contratada</span><b>${ptRc(vig.reduce((s, c) => s + ptMensal(c), 0))}</b><small>${vig.length} contrato(s) vigente(s)</small></div>
      <div class="cartao"><span>A receber</span><b>${ptRc(soma(abertas))}</b><small>${abertas.length} cobrança(s) em aberto</small></div>
      <div class="cartao"><span>Em atraso</span><b>${ptRc(soma(atras))}</b><small>${atras.length} cobrança(s) vencida(s)</small></div>
      <div class="cartao"><span>Espaços ocupados</span><b>${ocupados} de ${ativos.length}</b><small>${ativos.length ? `${ativos.length - ocupados} livre(s) para vender` : 'cadastre os espaços'}</small></div></section>
    <div class="pt-dois">
      <div class="cartao pt-sec" style="padding:16px"><h2>Cobranças dos próximos 30 dias</h2>${atras.length ? `<button class="pt-aviso erro" style="border:0;width:100%;text-align:left;margin-bottom:8px;cursor:pointer" data-aba="cobrancas">${atras.length} em atraso somando ${ptR(soma(atras))} — resolver agora</button>` : ''}
        ${prox.length ? `<ul class="pt-ul">${prox.map((c) => `<li><span><b>${esc(c.empresa_nome)}</b><br><small class="i2-m">${ptData(c.vencimento)} · em ${ptDias(c.vencimento)} dia(s)</small></span><b>${ptR(c.valor)}</b></li>`).join('')}</ul>` : '<p class="i2-m">Nada a vencer nos próximos 30 dias.</p>'}</div>
      <div class="cartao pt-sec" style="padding:16px"><h2>Contratos vencendo em 30 dias</h2>
        ${acabando.length ? `<ul class="pt-ul">${acabando.map((c) => `<li><span><b>${esc(c.empresa_nome)}</b><br><small class="i2-m">${esc(c.espaco_nome || c.titulo)}</small></span><b>${ptData(c.data_fim)}${c.renovacao_automatica ? ' · renova' : ''}</b></li>`).join('')}</ul>` : '<p class="i2-m">Nenhum contrato perto do fim.</p>'}</div></div>
    <div class="cartao pt-sec" style="padding:16px"><h2>Mapa de espaços</h2>${ativos.length ? `<ul class="pt-mapa">${ativos.map((e) => { const c = vig.find((x) => x.espaco_id === e.id); return `<li><span><b>${esc(e.nome)}</b><small class="i2-m">${c ? esc(c.empresa_nome) : PT.tipo[e.tipo]}</small></span><span class="i2-selo ${c ? 'amarelo' : 'verde'}">${c ? 'Ocupado' : 'Livre'}</span></li>`; }).join('')}</ul>` : '<p class="i2-m">Cadastre os outdoors e o pódio na aba Espaços.</p>'}</div>`;
  };

  // ---------------- Contratos
  const contratos = () => {
    const lista = busca(D.contratos.filter((c) => P.fc === 'todos' || c.status === P.fc), ['titulo', 'empresa_nome', 'espaco_nome']);
    const filtros = [['todos', 'Todos'], ['ativo', 'Ativos'], ['rascunho', 'Rascunhos'], ['encerrado', 'Encerrados'], ['cancelado', 'Cancelados']];
    return `<div class="i2-filtros"><input class="entrada" id="ptq" type="search" placeholder="Buscar empresa, espaço ou título" value="${esc(P.q)}" aria-label="Buscar">
      ${filtros.map(([k, r]) => `<button class="i2-f ${P.fc === k ? 'atual' : ''}" data-fc="${k}">${r}</button>`).join('')}<button class="btn prim" data-novo="contratos">+ Novo contrato</button></div>
      ${lista.length ? `<div class="pt-grade">${lista.map((c) => {
        const dias = c.data_fim ? ptDias(c.data_fim) : null;
        const parc = D.cobrancas.filter((b) => b.contrato_id === c.id && b.status !== 'cancelado').length;
        return `<div class="cartao pt-card"><div class="pt-topo"><div><b>${esc(c.empresa_nome || 'Empresa removida')}</b><small class="i2-m">${esc(c.titulo)}</small></div>${ptSelo(PT.status, c.status)}</div>
          <dl class="pt-dados"><div><dt>Espaço</dt><dd>${esc(c.espaco_nome || 'Não vinculado')}</dd></div><div><dt>Valor</dt><dd>${ptR(c.valor)} · ${PT.recorrencia[c.recorrencia]}</dd></div>
          <div><dt>Vigência</dt><dd>${ptData(c.data_inicio)} a ${c.data_fim ? ptData(c.data_fim) : 'indeterminado'}</dd></div><div><dt>Vencimento</dt><dd>Todo dia ${c.dia_vencimento} · ${parc} parcela(s)</dd></div></dl>
          ${c.status === 'ativo' && dias !== null && dias >= 0 && dias <= 30 ? `<div class="pt-aviso">Vence em ${dias} dia(s)${c.renovacao_automatica ? ' — renovação automática marcada' : ' — combine a renovação'}</div>` : ''}
          <div class="pt-rodape"><span>${c.contrato_arquivo_id ? `<a href="#" data-abrir="${esc(c.contrato_arquivo_id)}">Ver contrato</a> · ` : ''}${c.status !== 'cancelado' ? `<button data-gerar="${c.id}">Gerar cobranças</button>` : ''}</span>
          <span><button data-edit="contratos" data-id="${c.id}">Editar</button> · <button class="del" data-del="contratos" data-id="${c.id}">Excluir</button></span></div></div>`;
      }).join('')}</div>` : `<div class="cartao">${vazio(D.contratos.length ? 'Nada neste filtro' : 'Nenhum contrato ainda', D.contratos.length ? 'Troque o filtro ou a busca.' : 'Crie o primeiro para começar a controlar as cobranças.')}</div>`}`;
  };

  // ---------------- Cobranças
  const cobrancas = () => {
    const lista = D.cobrancas.filter((c) => (P.fb === 'todas' || c.status === P.fb) && (!P.emp || c.empresa_id === P.emp));
    const filtros = [['todas', 'Todas'], ['atrasado', 'Atrasadas'], ['pendente', 'A receber'], ['pago', 'Pagas'], ['cancelado', 'Canceladas']];
    return `<div class="i2-filtros">${filtros.map(([k, r]) => `<button class="i2-f ${P.fb === k ? 'atual' : ''}" data-fb="${k}">${r}</button>`).join('')}
      <select class="entrada" id="ptemp" style="max-width:240px" aria-label="Empresa"><option value="">Todas as empresas</option>${D.empresas.map((e) => `<option value="${e.id}" ${P.emp === e.id ? 'selected' : ''}>${esc(e.nome)}</option>`).join('')}</select>
      <span class="i2-m">${lista.length} cobrança(s) · <b>${ptR(lista.reduce((s, c) => s + c.valor, 0))}</b></span></div>
      ${lista.length ? `<div class="cartao pt-lista">${lista.map((c) => {
        const d = ptDias(c.vencimento); const aberta = c.status === 'pendente' || c.status === 'atrasado';
        return `<div class="pt-linha"><div class="gr"><b>${esc(c.empresa_nome || 'Empresa removida')}</b><small class="i2-m">${esc(c.contrato_titulo)} · parcela ${c.parcela}</small></div>
          <div class="col"><small class="i2-m">Vencimento</small><b>${ptData(c.vencimento)}</b><small class="i2-m">${aberta ? (d < 0 ? `${-d} dia(s) de atraso` : d === 0 ? 'vence hoje' : `em ${d} dia(s)`) : c.status === 'pago' ? `pago em ${ptData(c.pago_em)}` : ''}</small></div>
          <b class="col">${ptR(c.valor)}</b>${ptSelo(PT.cobranca, c.status)}
          <div class="acoes">${aberta ? `<button class="btn prim peq" data-baixa="${c.id}">Dar baixa</button><button class="btn sec peq" data-cobst="cancelado" data-id="${c.id}">Cancelar</button>` : `<button class="btn sec peq" data-cobst="pendente" data-id="${c.id}">Reabrir</button>`}</div></div>`;
      }).join('')}</div>` : `<div class="cartao">${vazio(D.cobrancas.length ? 'Nada neste filtro' : 'Nenhuma cobrança ainda', D.cobrancas.length ? 'Troque o filtro.' : 'Abra um contrato e use “Gerar cobranças” para programar as parcelas.')}</div>`}`;
  };

  // ---------------- Empresas
  const empresas = () => {
    const lista = busca(D.empresas, ['nome', 'razao_social', 'cnpj', 'contato_nome', 'segmento']);
    return `<div class="i2-filtros"><input class="entrada" id="ptq" type="search" placeholder="Buscar por nome, CNPJ ou contato" value="${esc(P.q)}" aria-label="Buscar"><button class="btn prim" data-novo="empresas">+ Nova empresa</button></div>
      ${lista.length ? `<div class="pt-grade">${lista.map((e) => {
        const vig = D.contratos.filter((c) => c.empresa_id === e.id && ptVigente(c));
        return `<div class="cartao pt-card ${e.ativo ? '' : 'off'}"><div class="pt-topo">${logo(e)}<div><b>${esc(e.nome)}</b><small class="i2-m">${esc(e.segmento || e.razao_social || 'Sem segmento')}</small></div></div>
          <div style="font-size:13px">${e.contato_nome ? `${esc(e.contato_nome)}<br>` : ''}${e.telefone ? `<a href="https://wa.me/${(() => { const n = String(e.telefone).replace(/\D/g, ''); return n.length <= 11 ? '55' + n : n; })()}" target="_blank" rel="noopener">${esc(e.telefone)}</a><br>` : ''}${e.email ? `<a href="mailto:${esc(e.email)}">${esc(e.email)}</a>` : ''}</div>
          <div class="pt-rodape"><span class="i2-m">${vig.length ? `${vig.length} contrato(s) · ${ptR(vig.reduce((s, c) => s + ptMensal(c), 0))}/mês` : 'Sem contrato ativo'}</span><span><button data-edit="empresas" data-id="${e.id}">Editar</button> · <button class="del" data-del="empresas" data-id="${e.id}">Excluir</button></span></div></div>`;
      }).join('')}</div>` : `<div class="cartao">${vazio(D.empresas.length ? 'Nenhuma empresa encontrada' : 'Nenhuma empresa cadastrada', D.empresas.length ? 'Troque a busca.' : 'Comece cadastrando o primeiro patrocinador.')}</div>`}`;
  };

  // ---------------- Espaços
  const espacos = () => `<div class="i2-filtros"><span class="i2-m" style="flex:1">Outdoors, placas, pódio e outros pontos de exposição. Livre/Ocupado vem dos contratos ativos.</span><button class="btn prim" data-novo="espacos">+ Novo espaço</button></div>
    ${D.espacos.length ? `<div class="pt-grade">${D.espacos.map((e) => {
      const c = D.contratos.find((x) => x.espaco_id === e.id && ptVigente(x));
      return `<div class="cartao pt-card ${e.ativo ? '' : 'off'}" style="padding:0;overflow:hidden"><div class="pt-foto">${e.foto_arquivo_id ? `<img data-arq="${esc(e.foto_arquivo_id)}" alt="">` : 'Sem foto'}</div>
        <div style="padding:14px 16px;display:flex;flex-direction:column;gap:8px"><div class="pt-topo"><div><b>${esc(e.nome)}</b><small class="i2-m">${PT.tipo[e.tipo]}${e.localizacao ? ' · ' + esc(e.localizacao) : ''}</small></div><span class="i2-selo ${c ? 'amarelo' : 'verde'}">${c ? 'Ocupado' : 'Livre'}</span></div>
        <div style="font-size:13px">${e.dimensoes ? `${esc(e.dimensoes)}<br>` : ''}${c ? `${esc(c.empresa_nome)} até ${c.data_fim ? ptData(c.data_fim) : 'prazo indeterminado'}` : 'Disponível para contrato'}</div>
        <div class="pt-rodape"><b>${e.valor_tabela ? ptR(e.valor_tabela) + ' (tabela)' : 'Sem valor de tabela'}</b><span><button data-edit="espacos" data-id="${e.id}">Editar</button> · <button class="del" data-del="espacos" data-id="${e.id}">Excluir</button></span></div></div></div>`;
    }).join('')}</div>` : `<div class="cartao">${vazio('Nenhum espaço cadastrado', 'Cadastre cada outdoor e o pódio para poder vendê-los.')}</div>`}`;

  // ---------------- formulários
  const opEmpresas = () => D.empresas.filter((e) => e.ativo).map((e) => [e.id, e.nome]);
  const FORM = {
    empresas: { titulo: 'empresa', campos: () => [
      { k: 'logo_arquivo_id', r: 'Logo da empresa', t: 'arquivo', cat: 'logo', img: true, dica: 'PNG, JPG ou WEBP' },
      { k: 'nome', r: 'Nome da marca', req: true }, { k: 'razao_social', r: 'Razão social' }, { k: 'cnpj', r: 'CNPJ', ph: '00.000.000/0000-00' }, { k: 'segmento', r: 'Segmento', ph: 'Ex.: autopeças, bebidas' },
      { k: 'contato_nome', r: 'Pessoa de contato' }, { k: 'telefone', r: 'Telefone / WhatsApp' }, { k: 'email', r: 'E-mail', t: 'email' }, { k: 'site', r: 'Site' },
      { k: 'endereco', r: 'Endereço', larga: true }, { k: 'observacoes', r: 'Observações', t: 'area', larga: true }, { k: 'ativo', r: 'Empresa ativa', t: 'check' }],
      novo: () => ({ ativo: true }) },
    espacos: { titulo: 'espaço', campos: () => [
      { k: 'foto_arquivo_id', r: 'Foto do espaço', t: 'arquivo', cat: 'foto', img: true, dica: 'Foto do outdoor ou do pódio' },
      { k: 'nome', r: 'Nome', req: true, ph: 'Ex.: Outdoor da reta dos boxes' }, { k: 'tipo', r: 'Tipo', t: 'sel', o: Object.entries(PT.tipo) },
      { k: 'localizacao', r: 'Localização' }, { k: 'dimensoes', r: 'Medidas', ph: 'Ex.: 6 x 3 m' }, { k: 'valor_tabela', r: 'Valor de tabela (R$)', t: 'number', dica: 'Sugestão ao criar contrato' },
      { k: 'ativo', r: 'Disponível para venda', t: 'check' }, { k: 'descricao', r: 'Descrição', t: 'area', larga: true }],
      novo: () => ({ tipo: 'outdoor', valor_tabela: 0, ativo: true }) },
    contratos: { titulo: 'contrato', campos: () => [
      { k: 'empresa_id', r: 'Empresa', t: 'sel', o: opEmpresas(), req: true },
      { k: 'espaco_id', r: 'Espaço (outdoor, pódio...)', t: 'sel', aoMudar: true, dica: 'Preenche valor e título sugeridos', o: [['', 'Sem espaço específico'], ...D.espacos.filter((e) => e.ativo).map((e) => [e.id, e.nome])] },
      { k: 'titulo', r: 'Título', req: true, larga: true, ph: 'Ex.: Outdoor reta principal — 2026' },
      { k: 'valor', r: 'Valor (R$)', t: 'number', req: true }, { k: 'recorrencia', r: 'Recorrência', t: 'sel', o: Object.entries(PT.recorrencia), dica: 'O valor é cobrado a cada período' },
      { k: 'data_inicio', r: 'Início', t: 'date', req: true }, { k: 'data_fim', r: 'Fim', t: 'date', dica: 'Vazio = sem data final' },
      { k: 'dia_vencimento', r: 'Dia do vencimento', t: 'number', passo: '1', min: 1, max: 28, dica: 'De 1 a 28' },
      { k: 'status', r: 'Situação', t: 'sel', o: [['rascunho', 'Rascunho (em negociação)'], ['ativo', 'Ativo'], ['encerrado', 'Encerrado'], ['cancelado', 'Cancelado']] },
      { k: 'renovacao_automatica', r: 'Renovação automática (lembrete no resumo)', t: 'check', larga: true },
      { k: 'contrato_arquivo_id', r: 'Contrato assinado', t: 'arquivo', cat: 'contrato', img: false, dica: 'PDF ou DOCX, até 8 MB' },
      { k: 'arte_arquivo_id', r: 'Arte / imagem da marca', t: 'arquivo', cat: 'arte', img: true, dica: 'Arte que vai no outdoor ou pódio' },
      { k: 'observacoes', r: 'Observações', t: 'area', larga: true }],
      novo: () => ({ empresa_id: D.empresas.find((e) => e.ativo)?.id, titulo: '', status: 'ativo', valor: 0, recorrencia: 'mensal', dia_vencimento: 10, data_inicio: hojeIso() }),
      aoMudar: (k, v) => { const e = D.espacos.find((x) => x.id === v.espaco_id); if (k === 'espaco_id' && e) { if (!+v.valor) v.valor = e.valor_tabela; if (!v.titulo) v.titulo = `Publicidade — ${e.nome}`; } } },
  };
  const NUM = ['valor', 'valor_tabela', 'dia_vencimento'];

  function abrirForm(rec, atual) {
    const f = FORM[rec];
    if (rec === 'contratos' && !D.empresas.length) return toast('Cadastre uma empresa antes de criar o contrato (aba Empresas).', true);
    ptForm({
      titulo: `${atual ? 'Editar' : 'Novo'} ${f.titulo}`, campos: f.campos(), valores: atual || f.novo(), aoMudar: f.aoMudar,
      salvar: async (v) => {
        const dados = {};
        for (const c of f.campos()) {
          if (c.t === 'arquivo' || c.t === 'check') { dados[c.k] = v[c.k] ?? (c.t === 'check' ? false : null); continue; }
          const x = v[c.k];
          dados[c.k] = NUM.includes(c.k) ? Number(x) || 0 : x === '' || x === undefined ? null : x;
        }
        await api(`/patro/${rec}${atual ? '/' + atual.id : ''}`, { method: atual ? 'PATCH' : 'POST', body: dados });
        toast(atual ? 'Salvo' : `${f.titulo[0].toUpperCase()}${f.titulo.slice(1)} cadastrad${rec === 'espacos' ? 'o' : 'a'}`);
        await carregar(); desenhar();
      },
    });
  }

  function dar_baixa(id) {
    const c = D.cobrancas.find((x) => x.id === id);
    const g = modal(`<form class="i2-g"><h2>Registrar pagamento</h2><p>${esc(c.empresa_nome)} · parcela ${c.parcela} · <b>${ptR(c.valor)}</b></p>
      <label class="campo"><span>Data do pagamento</span><input class="entrada" type="date" name="em" value="${hojeIso()}" required></label>
      <label class="campo"><span>Forma de pagamento</span><select class="entrada" name="forma">${PT.formas.map((f) => `<option>${f}</option>`).join('')}</select></label>
      <div class="i2-acoes"><button class="btn prim">Confirmar pagamento</button><button type="button" class="btn sec" data-nao>Cancelar</button></div></form>`);
    $('[data-nao]', g).addEventListener('click', fecharCamada);
    $('form', g).addEventListener('submit', async (e) => {
      e.preventDefault(); const f = new FormData(e.target); fecharCamada();
      if (await agir(() => api('/patro/cobrancas/' + id, { method: 'PATCH', body: { status: 'pago', pago_em: f.get('em'), forma_pagamento: f.get('forma') } }), 'Pagamento registrado')) { await carregar(); desenhar(); }
    });
  }

  // ---------------- tela
  function desenhar() {
    const abas = [['resumo', 'Resumo'], ['contratos', 'Contratos'], ['cobrancas', 'Cobranças'], ['empresas', 'Empresas'], ['espacos', 'Espaços']];
    const corpo = { resumo, contratos, cobrancas, empresas, espacos }[P.aba]();
    tela.innerHTML = `${cabecalho('Comercial · outdoor, pódio e marcas', 'Patrocinadores e publicidade')}<main class="principal">
      <nav class="ev-abas" aria-label="Partes">${abas.map(([k, r]) => `<button data-aba="${k}" class="${P.aba === k ? 'atual' : ''}">${r}</button>`).join('')}</nav>${corpo}</main>`;
    ptImagens(tela);
    const q = $('#ptq', tela);
    if (q) q.addEventListener('input', () => { P.q = q.value; const pos = q.selectionStart; desenhar(); const n = $('#ptq', tela); n.focus(); n.setSelectionRange(pos, pos); });
    const sel = $('#ptemp', tela);
    if (sel) sel.addEventListener('change', () => { P.emp = sel.value; desenhar(); });
  }

  tela.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-aba],[data-fc],[data-fb],[data-novo],[data-edit],[data-del],[data-gerar],[data-baixa],[data-cobst],[data-abrir]');
    if (!a) return;
    const d = a.dataset;
    if (d.aba) { P.aba = d.aba; P.q = ''; return desenhar(); }
    if (d.fc) { P.fc = d.fc; return desenhar(); }
    if (d.fb) { P.fb = d.fb; return desenhar(); }
    if (d.novo) return abrirForm(d.novo);
    if (d.edit) return abrirForm(d.edit, { contratos: D.contratos, empresas: D.empresas, espacos: D.espacos }[d.edit].find((x) => x.id === d.id));
    if (d.baixa) return dar_baixa(d.baixa);
    if (d.abrir !== undefined) { e.preventDefault(); return agir(async () => window.open(URL.createObjectURL(await ptBlob(d.abrir)), '_blank')); }
    if (d.del) {
      const nomes = { empresas: 'a empresa e todos os contratos e cobranças dela', espacos: 'o espaço (os contratos ficam sem espaço)', contratos: 'o contrato e todas as cobranças dele' };
      return ptConfirmar(`Excluir ${nomes[d.del]}? Para manter o histórico, prefira desativar, encerrar ou cancelar.`, async () => { if (await agir(() => api(`/patro/${d.del}/${d.id}`, { method: 'DELETE' }), 'Excluído')) { await carregar(); desenhar(); } });
    }
    if (d.gerar) { const r = await agir(() => api(`/patro/contratos/${d.gerar}/cobrancas`, { method: 'POST', body: {} })); if (r) { toast(r.geradas ? `${r.geradas} cobrança(s) gerada(s)` : 'Todas as cobranças já estavam geradas'); await carregar(); desenhar(); } return; }
    if (d.cobst) { if (await agir(() => api('/patro/cobrancas/' + d.id, { method: 'PATCH', body: d.cobst === 'pendente' ? { status: 'pendente', pago_em: null, forma_pagamento: null } : { status: d.cobst } }), d.cobst === 'pendente' ? 'Cobrança reaberta' : 'Cobrança cancelada')) { await carregar(); desenhar(); } }
  });

  desenhar();
};
