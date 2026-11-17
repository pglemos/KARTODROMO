/** Relatorios imprimiveis do app da recepcao (HTML). */
import { one, query } from './db';
import { HttpError, sumarioMovimento } from './office';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const brl = (c: number | null | undefined) => (c === null || c === undefined ? '' : (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const dmy = (s: unknown) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
const hm = (s: unknown) => (s ? String(s).slice(11, 16) : '');
const agora = () => new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

/** Folha do relatorio no modelo do canvas (RelatorioFechamento.dc.html): na tela, folha branca sobre fundo cinza;
 *  cabecalho com o logo num bloco escuro a esquerda e titulo/subtitulo a direita; empresa no rodape. */
async function page(titulo: string, subtitulo: string, corpo: string, opts: { cupom?: boolean; paisagem?: boolean; janela?: string } = {}) {
  const emp = await one<{ nome: string; razao: string; cnpj: string; tel: string; end: string }>(
    `select nome, razao_social razao, cnpj, telefone tel, concat(endereco, ', ', numero, ' - ', bairro, ' - ', cidade, '/', estado) "end" from kart.empresa where id = 1`,
  );
  const size = opts.cupom ? '80mm auto' : opts.paisagem ? 'A4 landscape' : 'A4';
  const largura = opts.cupom ? '74mm' : opts.paisagem ? '1040px' : '720px';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(opts.janela ?? titulo)}</title><style>
    @page { size: ${size}; margin: ${opts.cupom ? '3mm' : '12mm'}; }
    html { background:#f2f2f5; }
    body { font: ${opts.cupom ? '11px' : '12.5px'}/1.4 "Segoe UI", Arial, sans-serif; color:#1d1d1f; margin:0; padding:24px 16px; }
    .folha { background:#fff; max-width:${largura}; margin:0 auto; padding:${opts.cupom ? '12px' : '40px'}; box-shadow:0 1px 3px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.06); }
    header { border-bottom:2px solid #1d1d1f; margin-bottom:6px; padding-bottom:12px; ${opts.cupom ? 'text-align:center;' : 'display:flex; justify-content:space-between; align-items:center; gap:16px;'} }
    header .logo { background:#1d1d1f; border-radius:6px; padding:7px 14px; display:inline-flex; align-items:center; }
    header .logo img { height:${opts.cupom ? '22px' : '28px'}; display:block; }
    header .tit { ${opts.cupom ? 'margin-top:6px;' : 'text-align:right;'} }
    header h1 { font-size:${opts.cupom ? '13px' : '15px'}; margin:0 0 2px; font-weight:700; } header .sub { font-size:12px; color:#3a3a3c; }
    h2 { font-size:${opts.cupom ? '12px' : '13px'}; margin:18px 0 4px; font-weight:700; }
    table { width:100%; border-collapse:collapse; margin-bottom:8px; }
    th, td { border-bottom:1px solid #e5e5ea; padding:${opts.cupom ? '3px 4px' : '9px 0 9px 6px'}; text-align:left; vertical-align:top; }
    th { font-size:10.5px; color:#6e6e73; font-weight:600; padding-top:6px; padding-bottom:6px; }
    th:first-child, td:first-child { padding-left:0; }
    .r { text-align:right; white-space:nowrap; } .tot td { font-weight:bold; border-top:2px solid #1d1d1f; }
    .kv td:last-child { text-align:right; font-weight:700; white-space:nowrap; } .kv tr.forte td { font-size:14px; }
    .muted { color:#6e6e73; font-size:10.5px; } .sig { margin-top:40px; border-top:1px solid #1d1d1f; text-align:center; font-size:10.5px; padding-top:3px; }
    footer { margin-top:18px; color:#6e6e73; font-size:10px; }
    .tools { position:fixed; top:10px; right:12px; } .tools button { font:600 13px "Segoe UI", Arial; background:#0b7a53; color:#fff; border:0; border-radius:8px; padding:8px 16px; cursor:pointer; }
    @media print { html { background:#fff; } body { padding:0; } .folha { max-width:none; padding:0; box-shadow:none; } .tools { display:none; } }
  </style></head><body>
  <div class="tools" id="tools"><button onclick="print()">Imprimir</button></div>
  <script>if (window.chrome && window.chrome.webview) document.getElementById('tools').remove();</script>
  <div class="folha">
  <header><div class="logo"><img src="/ui/kib-logo.png" alt="${esc(emp?.nome ?? 'Kartódromo')}"></div>
  <div class="tit"><h1>${esc(titulo)}</h1><div class="sub">${subtitulo}</div></div></header>
  ${corpo}
  <footer>${esc(emp?.razao || emp?.nome)}${emp?.cnpj ? ` · CNPJ ${esc(emp.cnpj)}` : ''}${emp?.tel ? ` · ${esc(emp.tel)}` : ''} · Emitido em ${agora()}</footer></div></body></html>`;
}

export async function relatorio(tipo: string, url: URL): Promise<string> {
  const p = url.searchParams;
  switch (tipo) {
    case 'fechamento': {
      const movId = Number(p.get('mov'));
      if (!movId) throw new HttpError(400, 'Movimento não informado.');
      const mov = await one<Record<string, string>>(
        `select t.nome terminal, tu.descricao turno, u.nome usuario, to_char(m.aberto_em, 'YYYY-MM-DD"T"HH24:MI') aberto, to_char(m.fechado_em, 'YYYY-MM-DD"T"HH24:MI') fechado, m.proximo_turno_centavos prox
         from kart.movimento m join kart.terminal t on t.id = m.terminal_id left join kart.turno tu on tu.id = m.turno_id left join kart.usuario u on u.id = m.usuario_id where m.id = @movId`,
        { movId },
      );
      if (!mov) throw new HttpError(404, 'Movimento não encontrado.');
      const s = await sumarioMovimento(movId);
      const vendas = await query(
        `select to_char(v.criado_em, 'YYYY-MM-DD"T"HH24:MI') dh, v.id, c.nome cliente, v.final_centavos final, v.recebido_centavos recebido, v.troco_centavos troco, v.estorno_centavos estorno,
                (select string_agg(coalesce(f.nome, '?') || ' ' || replace(replace(replace(to_char(vp.valor_centavos / 100.0, 'FM999,999,990.00'), ',', '#'), '.', ','), '#', '.'), ', ' order by vp.id) from kart.venda_pagamento vp left join kart.forma_pagamento f on f.id = vp.forma_pagamento_id where vp.venda_id = v.id) formas
         from kart.venda v left join kart.cliente c on c.id = v.cliente_id where v.movimento_id = @movId order by v.id`,
        { movId },
      );
      const trans = await query(`select to_char(criado_em, 'YYYY-MM-DD"T"HH24:MI') dh, tipo, valor_centavos valor, observacao obs from kart.movimento_transacao where movimento_id = @movId order by id`, { movId });
      // linhas no modelo do canvas; saidas com "– R$"; "Vendas (baterias)" = vendas brutas menos os produtos
      const kv = (k: string, v: number, o: { menos?: boolean; forte?: boolean } = {}) =>
        `<tr${o.forte ? ' class="forte"' : ''}><td>${k}</td><td>${o.menos && v ? '– ' : ''}${brl(v)}</td></tr>`;
      const fim = mov.fechado ? hm(mov.fechado) : 'aberto';
      return page(
        'Fechamento de caixa',
        `Terminal ${esc(mov.terminal)}${mov.turno ? ` · ${esc(mov.turno)}` : ''} · ${esc(mov.usuario)}<br>${dmy(mov.aberto)} ${hm(mov.aberto)} → ${mov.fechado && dmy(mov.fechado) !== dmy(mov.aberto) ? dmy(mov.fechado) + ' ' : ''}${fim}`,
        `<table class="kv">${kv('Início do turno', s.inicial)}${kv('Suprimento', s.suprimento)}${kv('Sangria', s.sangria, { menos: true })}
          ${kv('Vendas de produtos', s.vendasProdutos)}${kv('Vendas (baterias)', s.vendas - s.vendasProdutos)}${kv('Desconto fornecido', s.desconto, { menos: true })}${s.acrescimos ? kv('Acréscimos', s.acrescimos) : ''}
          ${kv('Total recebido', s.recebido)}${kv('Troco fornecido', s.troco, { menos: true })}${kv('Cancelado', s.cancelado, { menos: true })}${kv('Total final (todas as formas)', s.final, { forte: true })}
          ${kv('Dinheiro na gaveta', s.dinheiroEmCaixa, { forte: true })}${mov.prox !== null && mov.prox !== undefined ? kv('Valor para o próximo turno', Number(mov.prox)) : ''}</table>
         <h2>Por forma de pagamento</h2><table class="kv">${(s.porForma as { forma: string; valor: number }[]).map((f) => `<tr><td>${esc(f.forma)}</td><td>${brl(f.valor)}</td></tr>`).join('') || '<tr><td>Nenhum recebimento.</td><td></td></tr>'}</table>
         <h2>Suprimentos e sangrias</h2><table><tr><th>Hora</th><th>Tipo</th><th>Observação</th><th class="r">Valor</th></tr>
         ${trans.map((t) => `<tr><td>${hm(t.dh)}</td><td>${esc(t.tipo)}</td><td>${esc(t.obs)}</td><td class="r">${brl(t.valor as number)}</td></tr>`).join('') || '<tr><td colspan="4">—</td></tr>'}</table>
         <h2>Vendas (${vendas.length})</h2><table><tr><th>Hora</th><th>Nº</th><th>Cliente</th><th>Pagamento</th><th class="r">Total</th><th class="r">Troco</th><th class="r">Estorno</th></tr>
         ${vendas.map((v) => `<tr><td>${hm(v.dh)}</td><td>${v.id}</td><td>${esc(v.cliente)}</td><td>${esc(v.formas)}</td><td class="r">${brl(v.final as number)}</td><td class="r">${brl(v.troco as number)}</td><td class="r">${v.estorno ? brl(v.estorno as number) : ''}</td></tr>`).join('')}</table>
         <div class="sig">Assinatura do operador</div>`,
        { janela: `Fechamento de caixa · ${dmy(mov.aberto)}` },
      );
    }
    case 'participantes': {
      const bateriaId = Number(p.get('bateria'));
      const b = await one<Record<string, string>>(
        `select b.nome, to_char(b.inicio, 'YYYY-MM-DD"T"HH24:MI') inicio, pr.nome produto, t.nome tracado, b.vagas from kart.bateria b
         left join kart.produto pr on pr.id = b.produto_id left join kart.tracado t on t.id = b.tracado_id where b.id = @bateriaId`,
        { bateriaId },
      );
      if (!b) throw new HttpError(404, 'Bateria não encontrada.');
      const params = Object.fromEntries((await query<{ k: string; v: string }>(`select chave k, valor v from kart.parametro`)).map((x) => [x.k, x.v]));
      const email = params['office.exibirEmailLista'] !== 'false';
      const peso = params['office.exibirPesoLista'] !== 'false';
      const rows = await query(
        `select c.nome, c.documento doc, c.telefone tel, c.email, c.peso, to_char(c.nascimento, 'YYYY-MM-DD') nasc, i.kart, i.pago, i.aprovada,
                case when i.termo_impresso_em is null then 0 else 1 end termo, r.nome resp
         from kart.inscricao i join kart.cliente c on c.id = i.cliente_id left join kart.cliente r on r.id = c.responsavel_id where i.bateria_id = @bateriaId and i.status <> 'cancelada' order by c.nome`,
        { bateriaId },
      );
      return page(
        'Lista de Participantes',
        `<b>${esc(b.nome)}</b> · ${dmy(b.inicio)} ${hm(b.inicio)} · ${esc(b.produto)} · ${esc(b.tracado)} · ${rows.length}/${b.vagas} participantes`,
        `<table><tr><th>#</th><th>Nome</th><th>Documento</th><th>Nascimento</th><th>Telefone</th>${email ? '<th>E-mail</th>' : ''}${peso ? '<th>Peso</th>' : ''}<th>Kart</th><th>Pago</th><th>Termo</th></tr>
         ${rows.map((r, n) => `<tr><td>${n + 1}</td><td>${esc(r.nome)}${r.resp ? `<br><span class="muted">resp.: ${esc(r.resp)}</span>` : ''}</td><td>${esc(r.doc)}</td><td>${dmy(r.nasc)}</td><td>${esc(r.tel)}</td>
           ${email ? `<td>${esc(r.email)}</td>` : ''}${peso ? `<td>${r.peso ?? ''}</td>` : ''}<td>${esc(r.kart)}</td><td>${r.pago ? 'Sim' : r.aprovada ? 'Não' : 'Pré-reserva'}</td><td>${r.termo ? 'Sim' : ''}</td></tr>`).join('')}</table>`,
        { paisagem: true },
      );
    }
    case 'clientes': {
      const de = p.get('de');
      const ate = p.get('ate');
      const rows = await query(
        `select c.nome, c.documento doc, c.telefone tel, c.email, c.cidade, to_char(c.nascimento, 'YYYY-MM-DD') nasc, to_char(c.criado_em, 'YYYY-MM-DD') criado, c.origem
         from kart.cliente c where c.criado_em >= @de::date and c.criado_em < @ate::date + 1 order by c.criado_em`,
        { de, ate },
      );
      return page(
        'Clientes por Período',
        `Cadastrados de ${dmy(de)} a ${dmy(ate)} · ${rows.length} clientes`,
        `<table><tr><th>Cadastro</th><th>Nome</th><th>Documento</th><th>Nascimento</th><th>Telefone</th><th>E-mail</th><th>Cidade</th><th>Origem</th></tr>
         ${rows.map((r) => `<tr><td>${dmy(r.criado)}</td><td>${esc(r.nome)}</td><td>${esc(r.doc)}</td><td>${dmy(r.nasc)}</td><td>${esc(r.tel)}</td><td>${esc(r.email)}</td><td>${esc(r.cidade)}</td><td>${esc(r.origem)}</td></tr>`).join('')}</table>`,
        { paisagem: true },
      );
    }
    case 'agenda': {
      const mes = String(p.get('mes') ?? '');
      const rows = await query(
        `select to_char(b.inicio, 'YYYY-MM-DD"T"HH24:MI') inicio, b.nome, pr.nome produto, b.vagas,
                (select count(*) from kart.inscricao i where i.bateria_id = b.id and i.status <> 'cancelada') reservas,
                (select count(*) from kart.inscricao i where i.bateria_id = b.id and i.status <> 'cancelada' and i.pago) pagos
         from kart.bateria b left join kart.produto pr on pr.id = b.produto_id where b.status <> 'cancelada' and b.inicio >= @d::date and b.inicio < @d::date + interval '1 month' order by b.inicio`,
        { d: `${mes}-01` },
      );
      const porDia = new Map<string, typeof rows>();
      for (const r of rows) {
        const d = String(r.inicio).slice(0, 10);
        porDia.set(d, [...(porDia.get(d) ?? []), r]);
      }
      const nomeMes = new Date(`${mes}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      return page(
        'Agenda de Reservas Mensal',
        nomeMes,
        [...porDia.entries()].map(([d, list]) => `<h2>${new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}</h2>
          <table><tr><th>Hora</th><th>Bateria</th><th>Produto</th><th class="r">Reservas</th><th class="r">Pagos</th><th class="r">Vagas</th></tr>
          ${list.map((r) => `<tr><td>${hm(r.inicio)}</td><td>${esc(r.nome)}</td><td>${esc(r.produto)}</td><td class="r">${r.reservas}</td><td class="r">${r.pagos}</td><td class="r">${r.vagas}</td></tr>`).join('')}</table>`).join('') || '<p>Nenhuma bateria no mês.</p>',
      );
    }
    case 'reservas-diaria': {
      const data = String(p.get('data') ?? '');
      const rows = await query(
        `select to_char(b.inicio, 'YYYY-MM-DD"T"HH24:MI') inicio, b.nome bateria, c.nome cliente, c.telefone tel, pr.nome produto, i.pago, i.aprovada,
                case when i.pago then i.valor_centavos else coalesce(i.preco_centavos, pr.preco_centavos) end valor
         from kart.inscricao i join kart.bateria b on b.id = i.bateria_id join kart.cliente c on c.id = i.cliente_id left join kart.produto pr on pr.id = coalesce(i.produto_id, b.produto_id)
         where b.inicio >= @d::date and b.inicio < @d::date + 1 and i.status <> 'cancelada' order by b.inicio, c.nome`,
        { d: data },
      );
      return page(
        'Reservas Diária',
        `${dmy(data)} · ${rows.length} reservas · ${rows.filter((r) => r.pago).length} pagas`,
        `<table><tr><th>Hora</th><th>Bateria</th><th>Cliente</th><th>Telefone</th><th>Produto</th><th>Situação</th><th class="r">Valor</th></tr>
         ${rows.map((r) => `<tr><td>${hm(r.inicio)}</td><td>${esc(r.bateria)}</td><td>${esc(r.cliente)}</td><td>${esc(r.tel)}</td><td>${esc(r.produto)}</td><td>${r.pago ? 'Pago' : r.aprovada ? 'Aprovada' : 'Pré-reserva'}</td><td class="r">${brl(r.valor as number)}</td></tr>`).join('')}</table>`,
        { paisagem: true },
      );
    }
    case 'receitas': {
      const de = p.get('de');
      const ate = p.get('ate');
      const agrupar = p.get('agrupar') || 'forma';
      const term = Number(p.get('terminal')) > 0 ? Number(p.get('terminal')) : null;
      const fTerm = term ? ' and v.terminal_id = @term' : '';
      const base = `from kart.venda v where not v.cancelada and v.criado_em >= @de::date and v.criado_em < @ate::date + 1${fTerm}`;
      let rows: Record<string, unknown>[];
      let titulo: string;
      if (agrupar === 'produto') {
        titulo = 'Receitas agrupadas por Produto';
        // agrupa pelo produto (nome do cadastro); item avulso sem produto cai pela descricao
        rows = await query(`select coalesce(pr.nome, vi.descricao) grupo, sum(vi.quantidade) qtd, sum(vi.liquido_centavos) valor
          from kart.venda_item vi join kart.venda v on v.id = vi.venda_id left join kart.produto pr on pr.id = vi.produto_id
          where not v.cancelada and not vi.estornado and v.criado_em >= @de::date and v.criado_em < @ate::date + 1${fTerm} group by coalesce(pr.nome, vi.descricao)`, { de, ate, ...(term ? { term } : {}) });
      } else if (agrupar === 'cliente') {
        titulo = 'Receitas por Clientes';
        rows = await query(`select coalesce(c.nome, '(sem cliente)') grupo, count(*) qtd, sum(v.final_centavos) valor ${base.replace('from kart.venda v', 'from kart.venda v left join kart.cliente c on c.id = v.cliente_id')} group by c.nome order by valor desc`, { de, ate, ...(term ? { term } : {}) });
      } else if (agrupar === 'dia') {
        titulo = 'Fluxo de Caixa (por dia)';
        rows = await query(`select to_char(v.criado_em, 'DD/MM/YYYY') grupo, count(*) qtd, sum(v.final_centavos) valor, min(v.criado_em) o ${base} group by to_char(v.criado_em, 'DD/MM/YYYY') order by o`, { de, ate, ...(term ? { term } : {}) });
      } else {
        titulo = 'Receitas por Forma de Pagamento';
        rows = await query(`select coalesce(f.nome, 'Outros') grupo, count(*) qtd, sum(vp.valor_centavos - case when f.tipo = 'dinheiro' then v.troco_centavos else 0 end) valor
          from kart.venda_pagamento vp join kart.venda v on v.id = vp.venda_id left join kart.forma_pagamento f on f.id = vp.forma_pagamento_id
          where not v.cancelada and not vp.cancelado and v.criado_em >= @de::date and v.criado_em < @ate::date + 1${fTerm} group by f.nome order by valor desc`, { de, ate, ...(term ? { term } : {}) });
      }
      if (agrupar === 'produto') rows = rows.sort((a, b) => (b.valor as number) - (a.valor as number));
      const total = rows.reduce((s, r) => s + ((r.valor as number) ?? 0), 0);
      return page(
        titulo,
        `Período: ${dmy(de)} à ${dmy(ate)}`,
        `<table><tr><th>${agrupar === 'dia' ? 'Dia' : agrupar === 'cliente' ? 'Cliente' : agrupar === 'produto' ? 'Produto' : 'Forma'}</th><th class="r">Qtde</th><th class="r">Valor</th></tr>
         ${rows.map((r) => `<tr><td>${esc(r.grupo)}</td><td class="r">${r.qtd}</td><td class="r">${brl(r.valor as number)}</td></tr>`).join('')}
         <tr class="tot"><td>Total</td><td></td><td class="r">${brl(total)}</td></tr></table>`,
      );
    }
    case 'ticket': {
      const ids = String(p.get('ids') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 30);
      const rows = await query(
        `select i.id, b.nome bateria, to_char(b.inicio, 'YYYY-MM-DD"T"HH24:MI') inicio, c.nome cliente, pr.nome produto, i.pago, i.kart,
                case when i.pago then i.valor_centavos else coalesce(i.preco_centavos, pr.preco_centavos) end valor
         from kart.inscricao i join kart.bateria b on b.id = i.bateria_id join kart.cliente c on c.id = i.cliente_id left join kart.produto pr on pr.id = coalesce(i.produto_id, b.produto_id)
         where i.id in (${ids.map((_, n) => '@i' + n).join(',') || '0'})`,
        Object.fromEntries(ids.map((id, n) => ['i' + n, id])),
      );
      return page(
        'Ticket',
        '',
        rows.map((r) => `<div style="page-break-after:always"><h2>${esc(r.bateria)}</h2><p><b>${dmy(r.inicio)} às ${hm(r.inicio)}</b></p>
          <p>${esc(r.cliente)}<br>${esc(r.produto)}<br>${brl(r.valor as number)} · ${r.pago ? 'PAGO' : 'A PAGAR'}${r.kart ? `<br>Kart ${esc(r.kart)}` : ''}</p><p class="muted">Reserva nº ${r.id}</p></div>`).join(''),
        { cupom: true },
      );
    }
    case 'venda': {
      const id = Number(p.get('id'));
      const v = await one<Record<string, unknown>>(
        `select v.id, to_char(v.criado_em, 'YYYY-MM-DD"T"HH24:MI') dh, c.nome cliente, c.documento doc, u.nome usuario, t.nome terminal, v.bruto_centavos bruto, v.desconto_centavos desconto,
                v.acrescimo_centavos acrescimo, v.final_centavos final, v.recebido_centavos recebido, v.troco_centavos troco, v.cancelada
         from kart.venda v left join kart.cliente c on c.id = v.cliente_id left join kart.usuario u on u.id = v.usuario_id left join kart.terminal t on t.id = v.terminal_id where v.id = @id`,
        { id },
      );
      if (!v) throw new HttpError(404, 'Venda não encontrada.');
      const itens = await query(`select descricao d, quantidade q, liquido_centavos l, estornado e from kart.venda_item where venda_id = @id order by item`, { id });
      const pags = await query(`select coalesce(f.nome, '?') f, vp.valor_centavos v from kart.venda_pagamento vp left join kart.forma_pagamento f on f.id = vp.forma_pagamento_id where vp.venda_id = @id`, { id });
      return page(
        `Comprovante nº ${v.id}`,
        `${dmy(v.dh)} ${hm(v.dh)} · ${esc(v.terminal)} · ${esc(v.usuario)}`,
        `<p>${esc(v.cliente)} ${v.doc ? '· ' + esc(v.doc) : ''}</p><table>${itens.map((i) => `<tr><td>${i.q}x ${esc(i.d)}${i.e ? ' (estornado)' : ''}</td><td class="r">${brl(i.l as number)}</td></tr>`).join('')}</table>
         <table class="kv"><tr><td>Subtotal</td><td>${brl(v.bruto as number)}</td></tr><tr><td>Desconto</td><td>${brl(v.desconto as number)}</td></tr><tr><td>Acréscimo</td><td>${brl(v.acrescimo as number)}</td></tr>
         <tr><td>TOTAL</td><td>${brl(v.final as number)}</td></tr>${pags.map((pg) => `<tr><td>${esc(pg.f)}</td><td>${brl(pg.v as number)}</td></tr>`).join('')}<tr><td>Troco</td><td>${brl(v.troco as number)}</td></tr></table>
         <p class="muted">Não é documento fiscal.</p>`,
        { cupom: true },
      );
    }
    default:
      throw new HttpError(404, 'Relatório desconhecido.');
  }
}
