/**
 * Verificação do lote 2 do port (vouchers, relatórios, campeonato, pilotos) e do check-in do lote 1,
 * contra a cópia carregada no Kartódromo OS (VPS). Só escreve em linhas de teste e desfaz tudo no fim.
 * Uso: OPS_PG_URL=postgres://ops_app:...@127.0.0.1:55432/postgres npx tsx scripts/ops/verificar-pg-lote2.ts
 */
import { one, query, getPool } from '../../lib/ops/db';
import { listarBeneficiariosVoucher, sincronizarBeneficiariosVoucher, vouchersDisponiveisParaCliente, avaliarElegibilidadeVoucher } from '../../lib/ops/vouchers';
import { relatorio } from '../../lib/ops/relatorios';
import { campeonatoOfficeRoutes, campeonatoSiteRoutes, buscarPiloto } from '../../lib/ops/campeonato-inscricoes';
import { pilotosRoutes } from '../../lib/ops/pilotos';
import { aplicarCheckins, aplicarCancelamentos } from '../../lib/ops/checkin';

let falhas = 0;
const ok = (nome: string, cond: unknown, extra: unknown = '') => {
  if (!cond) falhas++;
  console.log(`${cond ? 'ok  ' : 'FALHA'} ${nome}${extra !== '' ? ` -> ${typeof extra === 'string' ? extra : JSON.stringify(extra).slice(0, 220)}` : ''}`);
};
const tenta = async (nome: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { falhas++; console.log(`FALHA ${nome} -> ${(e as Error).message}`); } };

function cpfValido(base9: string) {
  const d = base9.split('').map(Number);
  const dv = (len: number) => { let s = 0; for (let i = 0; i < len; i++) s += d[i] * (len + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  d.push(dv(9)); d.push(dv(10));
  return d.join('');
}
const sessao = { uid: 1, nome: 'teste', perfil: 1 } as never;
async function office(fn: typeof pilotosRoutes, method: string, caminho: string, body: Record<string, unknown> = {}) {
  let out: { status: number; body: any } = { status: 0, body: null };
  await fn({ method, url: new URL('http://x/api/office' + caminho), body: async () => body, sessao }, (status, b) => { out = { status, body: b }; });
  return out;
}

async function main() {
  // ---------------- vouchers
  await tenta('vouchers', async () => {
    const v = await one<{ id: number }>(`select voucher_id id from kart.voucher_cliente group by voucher_id order by count(*) desc limit 1`);
    const bens = await listarBeneficiariosVoucher(v!.id);
    ok('beneficiários do voucher (contagem de usos por 3 fontes)', bens.length > 0 && bens.every((b) => typeof b.usosFeitos === 'number'), bens.slice(0, 2));
    const comCliente = bens.find((b) => b.clienteId);
    const disp = comCliente ? await vouchersDisponiveisParaCliente({ clienteId: comCliente.clienteId }) : [];
    ok('vouchers disponíveis para o cliente (lateral join + datas)', Array.isArray(disp), disp.map((d) => ({ codigo: d.codigo, restantes: d.restantesPessoa })));
    const el = await avaliarElegibilidadeVoucher({ voucherId: v!.id, usoUnico: false, usoMaxCliente: 1, restritoClientes: true, usosTotais: 0, usosClienteDirecto: 0, documento: '00000000000' });
    ok('elegibilidade nominal recusa CPF fora da lista', el.ok === false, el);
    const nv = await one<{ id: number }>(`insert into kart.voucher (codigo, origem, tipo, valor, inicio_em, fim_em, uso_max_cliente, uso_unico, ativo, restrito_clientes)
      values ('ZZTESTEPORT', 'manual', 'percentual', 10, current_date, current_date + 30, 1, false, true, true) returning id`);
    try {
      const r1 = await sincronizarBeneficiariosVoucher(nv!.id, [{ nome: 'Fulano Teste', documento: '11122233344', usosMax: 2 }, { nome: 'Outro', documento: '55566677788' }], 'replace');
      const r2 = await sincronizarBeneficiariosVoucher(nv!.id, [{ nome: 'Fulano Teste', documento: '11122233344', usosMax: 3 }], 'merge');
      const lista = await listarBeneficiariosVoucher(nv!.id);
      ok('sincronizar beneficiários (replace + merge, transação)', r1.total === 2 && r2.total === 2 && lista.find((b) => b.documento === '11122233344')?.usosMax === 3, { r1, r2 });
    } finally {
      await query(`delete from kart.voucher_cliente where voucher_id = @id`, { id: nv!.id });
      await query(`delete from kart.voucher where id = @id`, { id: nv!.id });
    }
  });

  // ---------------- relatórios
  await tenta('relatórios', async () => {
    const mov = await one<{ id: number; dia: string }>(`select m.id, to_char(m.aberto_em, 'YYYY-MM-DD') dia from kart.movimento m where exists (select 1 from kart.venda v where v.movimento_id = m.id) order by m.id desc limit 1`);
    // fechamento usa sumarioMovimento (office.ts, lote 5): verificado quando o office for portado
    if (process.env.VERIFICAR_FECHAMENTO === '1') {
      const html = await relatorio('fechamento', new URL(`http://x/?mov=${mov!.id}`));
      const nVendas = (await one<{ n: number }>(`select count(*) n from kart.venda where movimento_id = @id`, { id: mov!.id }))!.n;
      ok('fechamento de caixa (string_agg das formas em pt-BR)', html.includes(`Vendas (${nVendas})`) && /\d,\d{2}/.test(html), `movimento ${mov!.id}, ${nVendas} vendas`);
    }
    const bat = await one<{ id: number; n: number }>(`select bateria_id id, count(*) n from kart.inscricao where status <> 'cancelada' group by bateria_id order by bateria_id desc limit 1`);
    const part = await relatorio('participantes', new URL(`http://x/?bateria=${bat!.id}`));
    ok('lista de participantes', part.includes(`${bat!.n}/`), `bateria ${bat!.id}`);
    const cli = await relatorio('clientes', new URL(`http://x/?de=${mov!.dia}&ate=${mov!.dia}`));
    ok('clientes por período', cli.includes('clientes'));
    const ag = await relatorio('agenda', new URL(`http://x/?mes=${mov!.dia.slice(0, 7)}`));
    ok('agenda mensal', ag.includes('<h2>') || ag.includes('Nenhuma bateria'));
    const rd = await relatorio('reservas-diaria', new URL(`http://x/?data=${mov!.dia}`));
    ok('reservas diária', rd.includes('reservas'));
    for (const agrupar of ['forma', 'produto', 'cliente', 'dia']) {
      const r = await relatorio('receitas', new URL(`http://x/?de=${mov!.dia}&ate=${mov!.dia}&agrupar=${agrupar}`));
      ok(`receitas por ${agrupar}`, r.includes('Total'));
    }
    const totSql = (await one<{ t: number }>(`select coalesce(sum(vp.valor_centavos - case when f.tipo = 'dinheiro' then v.troco_centavos else 0 end), 0) t
      from kart.venda_pagamento vp join kart.venda v on v.id = vp.venda_id left join kart.forma_pagamento f on f.id = vp.forma_pagamento_id
      where not v.cancelada and not vp.cancelado and v.criado_em::date = @d::date`, { d: mov!.dia }))!.t;
    const rf = await relatorio('receitas', new URL(`http://x/?de=${mov!.dia}&ate=${mov!.dia}&agrupar=forma`));
    const brl = (totSql / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    ok('receitas: total bate com a soma direta no banco', rf.includes(brl), brl);
    const ins = await query<{ id: number }>(`select id from kart.inscricao order by id desc limit 2`);
    const tk = await relatorio('ticket', new URL(`http://x/?ids=${ins.map((i) => i.id).join(',')}`));
    ok('ticket', (tk.match(/Reserva nº/g) ?? []).length === 2);
    const vd = await one<{ id: number }>(`select id from kart.venda order by id desc limit 1`);
    const cv = await relatorio('venda', new URL(`http://x/?id=${vd!.id}`));
    ok('comprovante de venda', cv.includes(`Comprovante nº ${vd!.id}`));
  });

  // ---------------- campeonato
  await tenta('campeonato', async () => {
    const c = await one<{ doc: string; nasc: string }>(`select documento_num doc, to_char(nascimento, 'YYYY-MM-DD') nasc from kart.cliente where length(documento_num) = 11 and nascimento is not null and not bloqueado order by id desc limit 1`);
    const p = await buscarPiloto(c!.doc, c!.nasc);
    const errado = await buscarPiloto(c!.doc, '1900-01-01');
    ok('busca do piloto exige documento + nascimento certos', !!p && errado === null, p?.nome);
    const lista = await office(campeonatoOfficeRoutes, 'GET', '/campeonato-inscricoes?evento=200-milhas');
    ok('lista de inscrições do Admin', lista.status === 200 && Array.isArray(lista.body.inscricoes), `${lista.body.inscricoes?.length} inscrição(ões)`);
    const pil = (k: number, n: number) => ({ kart: k, nome: `Piloto Teste ${k}${n}`, cpf: cpfValido(`99${k}${n}000${k}${n}0`.slice(0, 9)), nascimento: '1990-01-01', telefone: '31999990000', email: `p${k}${n}@teste.com`, altura: '1,80', peso: '80' });
    const nova = await office(campeonatoOfficeRoutes, 'POST', '/campeonato-inscricoes', {
      evento: '200-milhas', equipe: 'ZZ Teste Port', chefeNome: 'Chefe Teste', chefeCpf: cpfValido('987654321'), chefeTelefone: '31988887777', chefeEmail: 'chefe@teste.com', karts: 1, pilotos: [pil(1, 1), pil(1, 2)],
    });
    const id = nova.body?.id;
    try {
      ok('cria inscrição (trava por equipe + 2 pilotos + returning)', nova.status === 201 && nova.body.pilotos.length === 2 && nova.body.situacao === 'pendente', { status: nova.status, id });
      let dupOk = false;
      try { await office(campeonatoOfficeRoutes, 'POST', '/campeonato-inscricoes', { evento: '200-milhas', equipe: 'zz TESTE port', chefeNome: 'Chefe Teste', chefeCpf: cpfValido('987654321'), chefeTelefone: '31988887777', chefeEmail: 'chefe@teste.com', karts: 1, pilotos: [pil(1, 3), pil(1, 4)] }); }
      catch (e) { dupOk = /mesmo nome de equipe|nome de equipe/.test((e as Error).message); }
      ok('equipe repetida (sem diferenciar maiúsculas) é recusada', dupOk);
      const pg = await office(campeonatoOfficeRoutes, 'POST', `/campeonato-inscricoes/${id}/pagamentos`, { valorCentavos: 100000, forma: 'Pix' });
      ok('pagamento manual muda para parcial', pg.body.situacao === 'parcial' && pg.body.falta === 280000 - 100000, { falta: pg.body.falta });
      const pub = await campeonatoSiteRoutes(`/api/campeonato-site/200-milhas/inscricoes/${nova.body.token}`, 'GET', async () => ({}), (s, b) => ok('página pública da equipe pelo token', s === 200 && (b as any).equipe === 'ZZ Teste Port' && !(JSON.stringify(b).includes('cpf'))));
      ok('rota pública tratou', pub);
      const busca = await office(campeonatoOfficeRoutes, 'GET', '/campeonato-inscricoes/buscar-piloto?q=silva');
      ok('busca de piloto por nome (ilike)', busca.status === 200 && busca.body.length > 0, busca.body.length);
      const canc = await office(campeonatoOfficeRoutes, 'POST', `/campeonato-inscricoes/${id}/cancelar`);
      ok('cancelar', canc.body.situacao === 'cancelada');
    } finally {
      if (id) for (const t of ['campeonato_inscricao_pagamento', 'campeonato_inscricao_cobranca', 'campeonato_inscricao_piloto']) await query(`delete from kart.${t} where inscricao_id = @id`, { id });
      if (id) await query(`delete from kart.campeonato_inscricao where id = @id`, { id });
    }
  });

  // ---------------- pilotos
  await tenta('pilotos', async () => {
    const r = await office(pilotosRoutes, 'GET', '/pilotos/resumo');
    ok('resumo (contagens + novos por origem)', r.status === 200 && r.body.total > 160000, { total: r.body.total, legado: r.body.legado, novos: r.body.novos, incompletos: r.body.incompletos });
    const b = await office(pilotosRoutes, 'GET', '/pilotos?q=jose%20silva');
    ok('busca por nome sem acento (unaccent)', b.status === 200 && b.body.linhas.length > 0, `${b.body.linhas.length} resultado(s)`);
    const bd = await office(pilotosRoutes, 'GET', '/pilotos?q=3199');
    ok('busca por telefone/documento', bd.status === 200, `${bd.body.linhas.length} resultado(s)`);
    for (const filtro of ['todos', 'novos', 'incompletos', 'aniversariantes']) {
      const f = await office(pilotosRoutes, 'GET', `/pilotos?filtro=${filtro}&pagina=2&ordem=${filtro === 'todos' ? 'nome' : 'recentes'}`);
      ok(`lista filtro=${filtro} página 2 (offset/limit)`, f.status === 200 && Array.isArray(f.body.linhas) && f.body.total >= 0, { total: f.body.total, linhas: f.body.linhas.length });
    }
    const alguem = await one<{ id: number }>(`select id from kart.cliente where responsavel_id is null and email is not null order by id desc limit 1`);
    const ficha = await office(pilotosRoutes, 'GET', `/pilotos/${alguem!.id}`);
    ok('ficha do piloto (dependentes, financeiro, duplicado)', ficha.status === 200 && ficha.body.cliente.id === alguem!.id && 'financeiro' in ficha.body, { financeiro: ficha.body.financeiro });
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const ja = await one(`select 1 x from kart.cliente_foto where cliente_id = @id`, { id: alguem!.id });
    if (!ja) {
      await office(pilotosRoutes, 'PUT', `/pilotos/${alguem!.id}/foto`, { foto: png, miniatura: png });
      await office(pilotosRoutes, 'PUT', `/pilotos/${alguem!.id}/foto`, { foto: png, miniatura: png });
      const f = await office(pilotosRoutes, 'GET', `/pilotos/${alguem!.id}/foto?mini=1`);
      const mini = await office(pilotosRoutes, 'GET', `/pilotos/miniaturas?ids=${alguem!.id}`);
      await office(pilotosRoutes, 'DELETE', `/pilotos/${alguem!.id}/foto`);
      const depois = await one(`select 1 x from kart.cliente_foto where cliente_id = @id`, { id: alguem!.id });
      ok('foto: grava 2x (upsert), lê, miniaturas, apaga', f.body.foto === png && mini.body[alguem!.id] === png && !depois);
    }
  });

  // ---------------- check-in e cancelamento pelo celular (lote 1), com o site simulado
  await tenta('check-in', async () => {
    const r = await one<{ pedido: string; ids: string }>(`select pedido_id pedido, inscricao_ids ids from kart.reserva_online where status = 'pago' and inscricao_ids <> '' order by id desc limit 1`);
    const ids = r!.ids.split(',').map(Number).filter((n) => n > 0);
    const antes = await query(`select id, checkin_em, checkin_origem from kart.inscricao where id = any(@ids)`, { ids });
    process.env.PRECADASTRO_URL = 'http://site.teste'; process.env.PRECADASTRO_KEY = 'x';
    const fetchReal = globalThis.fetch;
    let devolvido: unknown = null;
    globalThis.fetch = (async (u: string, init?: RequestInit) => {
      if (init?.method === 'POST') { devolvido = JSON.parse(String(init.body)); return new Response('{}'); }
      return new Response(JSON.stringify(String(u).includes('cancelamentos') ? { cancelamentos: [] } : { checkins: [{ key: 'k1', pedidoId: r!.pedido, codigo: 'TESTE' }] }));
    }) as typeof fetch;
    try {
      const fila: number[] = [];
      const n = await aplicarCheckins(() => undefined, (id) => fila.push(id));
      const depois = await query<{ checkin_origem: string }>(`select checkin_origem from kart.inscricao where id = any(@ids) and status <> 'cancelada'`, { ids });
      ok('check-in pelo celular marca as vagas e devolve ao site', n === 1 && depois.every((d) => d.checkin_origem) && (devolvido as any)?.feitos?.[0]?.erro === null, { vagas: depois.length, termosNaFila: fila.length });
      ok('cancelamentos vazios', (await aplicarCancelamentos(() => undefined)) === 0);
    } finally {
      globalThis.fetch = fetchReal;
      for (const a of antes) await query(`update kart.inscricao set checkin_em = @c, checkin_origem = @o where id = @id`, { id: a.id, c: a.checkin_em, o: a.checkin_origem });
    }
  });

  await getPool().end();
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nlote 2 verificado: tudo ok');
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
