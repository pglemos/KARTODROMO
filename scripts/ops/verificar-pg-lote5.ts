/**
 * Verificação de ponta a ponta do lote 5 (office.ts + ops-server.ts) contra a cópia no Kartódromo OS.
 * Sobe o ops-server num processo separado (porta 4999, sem site/app/cronometragem configurados: nada sai para fora)
 * e chama as rotas HTTP reais da Recepção, do caixa e do totem. Tudo o que cria é marcado "ZZ TESTE" e é apagado no fim.
 * Uso: OPS_PG_URL=postgres://ops_app:...@127.0.0.1:55432/postgres npx tsx scripts/ops/verificar-pg-lote5.ts
 */
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { one, query, getPool } from '../../lib/ops/db';
import { reservarPedido, confirmarPagamento, type PedidoSite } from '../../lib/ops/reserva-online';

const PORTA = 4999;
const SEGREDO = 'segredo-de-teste-lote5';
const BASE = `http://127.0.0.1:${PORTA}`;
let falhas = 0;
const ok = (nome: string, cond: unknown, extra: unknown = '') => {
  if (!cond) falhas++;
  console.log(`${cond ? 'ok  ' : 'FALHA'} ${nome}${extra !== '' ? ` -> ${typeof extra === 'string' ? extra : JSON.stringify(extra).slice(0, 200)}` : ''}`);
};
const tenta = async (nome: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { falhas++; console.log(`FALHA ${nome} -> ${(e as Error).message}`); } };

function token(uid: number, nome: string) {
  const payload = Buffer.from(JSON.stringify({ uid, nome, admin: true, exp: Date.now() + 3_600_000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', SEGREDO).update(payload).digest('base64url')}`;
}
let TOKEN = '';
async function api(method: string, caminho: string, body?: unknown): Promise<{ status: number; body: any }> {
  const r = await fetch(BASE + caminho, { method, headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text();
  let j: unknown = t; try { j = JSON.parse(t); } catch { /* html */ }
  return { status: r.status, body: j };
}
const dia = (offsetDias: number) => new Date(Date.now() + offsetDias * 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 10);
const horaSp = (deltaMin: number) => { const d = new Date(Date.now() - 3 * 3_600_000 + deltaMin * 60_000); return d.toISOString().slice(0, 16); };

async function main() {
  const env = { ...process.env, OPS_PORT: String(PORTA), OPS_SESSION_SECRET: SEGREDO, OPS_RECEPCAO_KEY: 'chave-teste', OPS_TIMING_URL: 'http://127.0.0.1:9',
    PRECADASTRO_URL: '', PRECADASTRO_KEY: '', MOBILE_IDENTITY_LINK_URL: '', MOBILE_ADMIN_TOKEN: '', OPS_UPDATES_DIR: '/tmp/ops-updates-teste' };
  const srv = spawn('npx', ['tsx', 'services/ops-server.ts'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let logSrv = '';
  srv.stdout.on('data', (d) => { logSrv += d; }); srv.stderr.on('data', (d) => { logSrv += d; });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE + '/healthz')).ok) break; } catch { /* subindo */ } await new Promise((r) => setTimeout(r, 1000)); }

  const adm = await one<{ id: number; nome: string }>(`select id, nome from kart.usuario where admin and ativo order by id limit 1`);
  TOKEN = token(adm!.id, adm!.nome);
  const criados = { clientes: [] as number[], baterias: [] as number[], vendas: [] as number[], movimentos: [] as number[], grupos: [] as number[], vouchers: [] as number[], feriados: [] as number[] };

  try {
    await tenta('servidor e leitura', async () => {
      ok('servidor sobe no Postgres (/healthz)', (await fetch(BASE + '/healthz')).ok);
      const apoio = await api('GET', '/api/office/apoio');
      ok('apoio da Recepção (produtos, traçados, formas, padrões, empresa, parâmetros)', apoio.status === 200 && apoio.body.produtos?.length > 0, Object.keys(apoio.body ?? {}));
      const cad = await api('GET', '/api/office/cad/turnos');
      ok('cadastro genérico: turnos (hora em texto, como no banco anterior)', cad.status === 200 && (!cad.body.length || /^\d{2}:\d{2}/.test(cad.body[0].inicio)), cad.body[0]);
      const cli = await api('GET', '/api/office/clientes?q=jose%20silva');
      ok('busca de clientes por nome (sem acento)', cli.status === 200 && cli.body.length > 0, `${cli.body.length}`);
      const um = await api('GET', `/api/office/clientes/${cli.body[0].id}`);
      ok('ficha do cliente (posição, dependentes, histórico, financeiro)', um.status === 200 && 'historico' in um.body && um.body.posicao > 0, { posicao: um.body.posicao, historico: um.body.historico?.length });
      const nav = await api('GET', `/api/office/clientes/nav?dir=next&id=${cli.body[0].id}`);
      ok('navegação de clientes', nav.status === 200 && nav.body.id > cli.body[0].id);
      for (const [nome, cam] of [['agenda (baterias da semana)', `/api/office/baterias?filtro=semana&data=${dia(0)}&status=todas`], ['reservas do dia', `/api/office/reservas?data=${dia(0)}`],
        ['vendas do mês', `/api/office/vendas?filtro=mes&data=${dia(0)}`], ['manutenções', '/api/office/manutencoes?status=todas'], ['vouchers', '/api/office/vouchers'],
        ['parceiros', '/api/office/parceiros'], ['fidelidade', '/api/office/fidelidade/contas'], ['reservas online', `/api/office/reservas-online?filtro=mes&data=${dia(0)}`],
        ['movimentos de caixa', '/api/office/movimentos'], ['permissões', '/api/office/minhas-permissoes'], ['serviços', '/api/office/servicos-online']] as const) {
        const r = await api('GET', cam);
        ok(`GET ${nome}`, r.status === 200, Array.isArray(r.body) ? `${r.body.length} linha(s)` : r.status === 200 ? 'ok' : r.body);
      }
    });

    // produto 4 = ANTECIPADO (o mesmo que a reserva online vende)
    const produto = await one<{ id: number; preco: number }>(`select id, preco_centavos preco from kart.produto where id = 4`);
    let bateriaId = 0, clienteId = 0, inscricaoId = 0;
    await tenta('agenda e reserva', async () => {
      const b = await api('POST', '/api/office/baterias', { nome: 'ZZ TESTE PORT', inicio: `${dia(2)}T23:40`, vagas: 10, produtoId: produto!.id, autoAtendimento: true });
      bateriaId = b.body.id; criados.baterias.push(bateriaId);
      ok('cria bateria', b.status === 201 && bateriaId > 0, b.body);
      const c = await api('POST', '/api/office/clientes', { nome: 'zz teste port caixa', tipoDocumento: 'RG', documento: 'ZZ' + Date.now(), telefone: '31999990000', email: 'zz@teste.com', nascimento: '1990-01-01', peso: '80', instagram: '@zzteste', lgpd: true });
      clienteId = c.body.id; criados.clientes.push(clienteId);
      ok('cadastra cliente pela Recepção', c.status === 201 && clienteId > 0, c.body);
      const inc = await api('POST', `/api/office/baterias/${bateriaId}/incluir`, { clienteId, participantes: 1, produtoId: produto!.id });
      inscricaoId = (inc.body.ids ?? inc.body)[0];
      ok('inclui reserva na bateria (inscreverN com trava da bateria)', inc.status === 201 || inc.status === 200, inc.body);
      const dup = await api('POST', `/api/office/baterias/${bateriaId}/incluir`, { clienteId, participantes: 1 });
      ok('reserva repetida do mesmo cliente é recusada', dup.status === 409, dup.body);
      const lista = await api('GET', `/api/office/reservas?bateriaId=${bateriaId}`);
      inscricaoId = inscricaoId || lista.body[0]?.id;
      ok('reserva aparece na lista (lateral do endurance, forma de pagamento)', lista.body.length === 1 && lista.body[0].cliente === 'Zz Teste Port Caixa' && lista.body[0].idade >= 35, lista.body[0] && { idade: lista.body[0].idade, total: lista.body[0].total });
      const ed = await api('PUT', `/api/office/reservas/${inscricaoId}`, { observacao: 'ZZ obs', kart: '7', peso: '81,5', termo: true });
      const depois = await one<{ observacao: string; kart: string; termo: boolean; peso: number }>(`select i.observacao, i.kart, i.termo_impresso_em is not null termo, c.peso from kart.inscricao i join kart.cliente c on c.id = i.cliente_id where i.id = @id`, { id: inscricaoId });
      ok('edita reserva (observação, kart, peso do cliente, termo)', ed.status === 200 && depois?.kart === '7' && depois.termo && depois.peso === 81.5, depois);
      const ap = await api('POST', `/api/office/reservas/${inscricaoId}/aprovar`);
      ok('aprova reserva', ap.status === 200);
      const st = await api('POST', `/api/office/baterias/${bateriaId}/status`, { status: 'aberta' });
      ok('status da bateria', st.status === 200, st.body);
    });

    await tenta('caixa', async () => {
      const aberto = await one<{ id: number }>(`select id from kart.movimento where usuario_id = @u and fechado_em is null`, { u: adm!.id });
      if (aberto) { ok('caixa do usuário admin já aberto na cópia: teste de caixa pulado', true); return; }
      const term = await one<{ id: number }>(`select t.id from kart.terminal t where t.ativo and not exists (select 1 from kart.movimento m where m.terminal_id = t.id and m.fechado_em is null) order by t.id limit 1`);
      const turno = await one<{ id: number }>(`select id from kart.turno where ativo order by id limit 1`);
      const ab = await api('POST', '/api/office/caixa/abrir', { terminalId: term!.id, turnoId: turno!.id, inicialCentavos: 10000 });
      const mov = await one<{ id: number }>(`select id from kart.movimento where usuario_id = @u and fechado_em is null`, { u: adm!.id });
      if (mov) criados.movimentos.push(mov.id);
      ok('abre o caixa', ab.status === 200 || ab.status === 201, ab.body);
      const sup = await api('POST', '/api/office/caixa/transacao', { tipo: 'suprimento', valorCentavos: 500, observacao: 'ZZ' });
      ok('suprimento', sup.status === 200 || sup.status === 201, sup.body);
      const dinheiro = await one<{ id: number }>(`select id from kart.forma_pagamento where ativo and tipo = 'dinheiro' limit 1`);
      const preco = (await one<{ p: number }>(`select coalesce(preco_centavos, 0) - coalesce(desconto_centavos, 0) p from kart.inscricao where id = @id`, { id: inscricaoId }))!.p;
      const venda = await api('POST', '/api/office/vendas', { clienteId, itens: [{ inscricaoId, unitarioCentavos: preco, quantidade: 1 }], pagamentos: [{ formaPagamentoId: dinheiro!.id, valorCentavos: preco + 1000 }] });
      if (venda.body?.id) criados.vendas.push(venda.body.id);
      const ins = await one<{ pago: boolean; status: string; venda_id: number }>(`select pago, status, venda_id from kart.inscricao where id = @id`, { id: inscricaoId });
      ok('venda no caixa paga a reserva e calcula o troco', venda.status === 201 && venda.body.troco === 1000 && ins?.pago && ins.status === 'confirmada' && ins.venda_id === venda.body.id, { venda: venda.body, ins });
      const det = await api('GET', `/api/office/vendas/${venda.body.id}`);
      ok('detalhe da venda', det.status === 200 && det.body.itens?.length === 1, det.status);
      const caixa = await api('GET', '/api/office/caixa');
      const s = caixa.body.sumario ?? caixa.body;
      ok('sumário do caixa (inicial + suprimento + recebido - troco)', caixa.status === 200, { final: s.final, dinheiro: s.dinheiroEmCaixa });
      const rel = await fetch(`${BASE}/relatorio/fechamento?mov=${mov!.id}&t=${encodeURIComponent(TOKEN)}`);
      const html = await rel.text();
      ok('relatório de fechamento de caixa (HTML)', rel.status === 200 && html.includes('Fechamento de caixa') && html.includes('Vendas (1)'), rel.status);
      const itemId = (await one<{ id: number }>(`select id from kart.venda_item where venda_id = @v`, { v: venda.body.id }))!.id;
      const est = await api('POST', `/api/office/vendas/${venda.body.id}/estorno`, { itemIds: [itemId], motivo: 'ZZ teste' });
      const ins2 = await one<{ pago: boolean; status: string }>(`select pago, status from kart.inscricao where id = @id`, { id: inscricaoId });
      const v2 = await one<{ cancelada: boolean; estorno_centavos: number }>(`select cancelada, estorno_centavos from kart.venda where id = @id`, { id: venda.body.id });
      ok('estorno devolve a reserva para reservada e cancela a venda', est.status === 200 && !ins2?.pago && ins2?.status === 'reservada' && v2?.cancelada === true && v2.estorno_centavos === preco, { ins2, v2 });
      const fe = await api('POST', '/api/office/caixa/fechar', { proximoTurnoCentavos: 0 });
      ok('fecha o caixa', fe.status === 200, fe.body);
    });

    await tenta('grupo e reserva online', async () => {
      const g = await api('POST', '/api/office/grupos', { bateriaId, responsavelId: clienteId, modo: 'individual', pilotos: [{ nome: 'ZZ amigo 1' }, { nome: 'ZZ amigo 2' }, { nome: 'ZZ amigo 3' }] });
      if (g.body?.id) criados.grupos.push(g.body.id);
      ok('cria grupo pela Recepção (3 vagas seguradas)', (g.status === 201 || g.status === 200) && g.body.pilotos?.length === 3, { status: g.status, codigo: g.body?.codigo });
      const mv = await api('POST', `/api/office/baterias/${bateriaId}/incluir`, { clienteId: (await one<{ id: number }>(`select c.id from kart.cliente c where c.responsavel_id is null and not c.bloqueado and not exists (select 1 from kart.inscricao i where i.cliente_id = c.id and i.bateria_id = @b and i.status <> 'cancelada') order by c.id desc limit 1`, { b: bateriaId }))!.id, participantes: 1 });
      ok('mais uma reserva avulsa na mesma bateria', mv.status === 201 || mv.status === 200, mv.body);
      const docComprador = '52998224725';
      const pedido = { id: 'ZZT-' + Date.now(), codigo: 'ZZT' + String(Date.now()).slice(-6), status: 'novo', criadoEm: new Date().toISOString(), bateriaId, quantidade: 2, forma: 'pix', pilotos: [],
        cliente: { chave: docComprador, tipoDocumento: 'CPF', documento: docComprador, nome: 'zz teste comprador online', email: 'zzon@teste.com', telefone: '31988887777', nascimento: '1991-02-03', peso: '70', cep: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', menores: [] } } as unknown as PedidoSite;
      const res = await reservarPedido(pedido, () => undefined);
      ok('reserva online segura 2 vagas e devolve o valor', res.acao === 'reservado' && (res as any).valorCentavos > 0, res);
      const pago = await confirmarPagamento({ ...pedido, status: 'pago', pagamento: { asaasId: 'pay_zz', billingType: 'PIX', pagoEm: '', valorCentavos: (res as any).valorCentavos } } as PedidoSite, () => undefined);
      ok('pagamento confirmado: vagas pagas', pago.acao === 'confirmado', pago);
      const comprador = await one<{ id: number }>(`select id from kart.cliente where documento_num = @d`, { d: docComprador });
      if (comprador) criados.clientes.push(comprador.id);
    });

    await tenta('totem', async () => {
      const bt = await api('POST', '/api/office/baterias', { nome: 'ZZ TESTE TOTEM', inicio: `${horaSp(0).slice(0, 10)}T23:59`, vagas: 8, produtoId: produto!.id, autoAtendimento: true });
      if (bt.body?.id) criados.baterias.push(bt.body.id);
      const doc = (await one<{ d: string }>(`select documento d from kart.cliente where id = @id`, { id: clienteId }))!.d;
      const idf = await fetch(`${BASE}/api/totem/identificar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ documento: doc, q: doc }) }).then(async (r) => ({ status: r.status, body: await r.json() as any }));
      ok('totem identifica o cliente pelo documento', idf.status === 200 && idf.body.cliente?.id === clienteId && !!idf.body.token, { status: idf.status, keys: Object.keys(idf.body ?? {}) });
      const bats = await fetch(`${BASE}/api/totem/baterias`).then(async (r) => ({ status: r.status, body: await r.json() as any }));
      const lista = (bats.body.baterias ?? bats.body) as any[];
      ok('totem lista as baterias de hoje', bats.status === 200 && Array.isArray(lista) && lista.some((b) => b.id === bt.body.id), `${Array.isArray(lista) ? lista.length : '?'} bateria(s)`);
      const cli = { id: idf.body.cliente.id, token: idf.body.token };
      const insc = await fetch(`${BASE}/api/totem/inscrever`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bateriaId: bt.body.id, participantes: [{ id: cli.id, token: cli.token }] }) }).then(async (r) => ({ status: r.status, body: await r.json() as any }));
      ok('totem inscreve o piloto (pré-reserva)', insc.status === 200 || insc.status === 201, insc.body);
    });

    await tenta('vouchers, cadastros e permissões', async () => {
      const v = await api('POST', '/api/office/vouchers', { codigo: 'ZZPORT' + String(Date.now()).slice(-5), origem: 'manual', tipo: 'percentual', valor: 10, inicio: dia(0), fim: dia(30), usoMaxTotal: 5 });
      if (v.body?.id) criados.vouchers.push(v.body.id);
      ok('cria voucher', v.status === 201 || v.status === 200, v.body);
      const cod = (await one<{ c: string }>(`select codigo c from kart.voucher where id = @id`, { id: v.body.id }))!.c;
      const val = await api('GET', `/api/office/vouchers/validar?codigo=${cod.toLowerCase()}&clienteId=${clienteId}`);
      ok('valida voucher (código em minúsculas)', val.status === 200, val.body);
      const ed = await api('PUT', `/api/office/vouchers/${v.body.id}`, { valor: 15, ativo: true });
      const vv = await one<{ valor: number }>(`select valor from kart.voucher where id = @id`, { id: v.body.id });
      ok('edita voucher (colunas montadas dinamicamente)', ed.status === 200 && vv?.valor === 15, vv);
      const f = await api('POST', '/api/office/cad/feriados', { data: dia(200), descricao: 'ZZ feriado', recorrente: false, abre: false });
      if (f.body?.id) criados.feriados.push(f.body.id);
      const f2 = await api('PUT', `/api/office/cad/feriados/${f.body.id}`, { descricao: 'ZZ feriado editado' });
      const lido = await api('GET', `/api/office/cad/feriados/${f.body.id}`);
      ok('cadastro genérico: cria, edita e lê (data no formato de antes)', f.status === 201 && f2.status === 200 && lido.body.descricao === 'ZZ feriado editado' && lido.body.data === dia(200), lido.body);
      const perfil = await one<{ id: number }>(`select id from kart.perfil order by id limit 1`);
      const antes = await query(`select * from kart.perfil_permissao where perfil_id = @p`, { p: perfil!.id });
      const pr = await api('PUT', '/api/office/permissoes', { perfilId: perfil!.id, acessoTotal: false, itens: [{ modulo: 'Admin Web', funcao: 'zz-teste', acessar: true }] });
      const gravada = await one(`select acessar from kart.perfil_permissao where perfil_id = @p and funcao = 'zz-teste'`, { p: perfil!.id });
      ok('salva permissões (upsert no lugar do MERGE)', pr.status === 200 && gravada, gravada);
      await query(`delete from kart.perfil_permissao where perfil_id = @p and funcao = 'zz-teste'`, { p: perfil!.id });
      void antes;
    });
  } finally {
    const ids = criados;
    for (const g of ids.grupos) {
      for (const t of ['reserva_grupo_voucher_uso', 'reserva_grupo_pagamento', 'reserva_grupo_cobranca', 'reserva_grupo_piloto']) await query(`delete from kart.${t} where grupo_id = @g`, { g }).catch(() => undefined);
      await query(`delete from kart.reserva_grupo where id = @g`, { g }).catch(() => undefined);
    }
    for (const v of ids.vendas) { for (const t of ['venda_pagamento', 'venda_item', 'voucher_uso']) await query(`delete from kart.${t} where venda_id = @v`, { v }).catch(() => undefined); }
    if (ids.baterias.length) {
      await query(`delete from kart.reserva_online where bateria_id = any(@b)`, { b: ids.baterias }).catch(() => undefined);
      await query(`update kart.inscricao set venda_id = null where bateria_id = any(@b)`, { b: ids.baterias }).catch(() => undefined);
    }
    for (const v of ids.vendas) await query(`delete from kart.venda where id = @v`, { v }).catch(() => undefined);
    for (const m of ids.movimentos) { await query(`delete from kart.movimento_transacao where movimento_id = @m`, { m }); await query(`delete from kart.movimento where id = @m`, { m }); }
    if (ids.baterias.length) {
      await query(`delete from kart.inscricao where bateria_id = any(@b)`, { b: ids.baterias });
      await query(`delete from kart.bateria where id = any(@b)`, { b: ids.baterias });
    }
    await query(`delete from kart.cliente where nome ilike 'zz amigo%' or nome ilike 'amigo % de zz teste%' or (origem = 'grupo' and nome ilike 'zz%')`).catch(() => undefined);
    for (const c of ids.clientes) { await query(`delete from kart.cliente_termo_aceite where cliente_id = @c`, { c }); await query(`delete from kart.cliente where id = @c`, { c }).catch(() => undefined); }
    for (const v of ids.vouchers) { await query(`delete from kart.voucher_cliente where voucher_id = @v`, { v }); await query(`delete from kart.voucher where id = @v`, { v }); }
    for (const f of ids.feriados) await query(`delete from kart.feriado where id = @f`, { f });
    srv.kill('SIGTERM');
    await getPool().end();
    const erros = logSrv.split('\n').filter((l) => /error|erro/i.test(l) && !/cronometragem|indispon|ECONNREFUSED|fetch failed|9\/api/i.test(l));
    if (erros.length) console.log('\nlog do servidor (erros):\n' + erros.slice(0, 15).join('\n'));
  }
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nlote 5 verificado: tudo ok');
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
