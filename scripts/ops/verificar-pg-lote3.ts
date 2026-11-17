/**
 * Verificação do lote 3 do port (reserva online, endurance, app mobile, totem, traçados) contra a cópia no Kartódromo OS.
 * Só escreve em linhas de teste (marcadas "ZZ TESTE") e desfaz tudo no fim.
 * Uso: OPS_PG_URL=postgres://ops_app:...@127.0.0.1:55432/postgres OPS_TIMING_URL=http://127.0.0.1:9 npx tsx scripts/ops/verificar-pg-lote3.ts
 */
import { one, query, getPool } from '../../lib/ops/db';
import { agendaOnline, primeiraVez, previsualizarVoucherOnline, confirmarPagamento, expirarVencidos, vagaOnlineDoGrupo, acertarCuponsDosGrupos, precoDaVagaPeloLink, precoPrimeiraVezDoGrupo, type PedidoSite } from '../../lib/ops/reserva-online';
import { enduranceRoutes, equipesParaOTotem, enduranceDasBaterias, paginaDoChefe, tokenEquipe } from '../../lib/ops/endurance';
import { ENDURANCE_VINCULO_SQL } from '../../lib/ops/endurance-vinculo';
import { TOTEM_BATERIAS_SQL } from '../../lib/ops/totem-baterias';
import { syncTimingTracks as sincronizarTracadosDaCronometragem } from '../../lib/ops/tracado-sync';
import { clienteDaConta } from '../../lib/ops/app-mobile';

let falhas = 0;
const ok = (nome: string, cond: unknown, extra: unknown = '') => {
  if (!cond) falhas++;
  console.log(`${cond ? 'ok  ' : 'FALHA'} ${nome}${extra !== '' ? ` -> ${typeof extra === 'string' ? extra : JSON.stringify(extra).slice(0, 200)}` : ''}`);
};
const tenta = async (nome: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { falhas++; console.log(`FALHA ${nome} -> ${(e as Error).message}`); } };
const sessao = { uid: 1, nome: 'teste', perfil: 1 } as never;
async function rota(method: string, caminho: string, body: Record<string, unknown> = {}) {
  let out: { status: number; body: any } = { status: 0, body: null };
  await enduranceRoutes({ method, url: new URL('http://x/api/office' + caminho), body: async () => body, sessao }, (status, b) => { out = { status, body: b }; });
  return out;
}

async function main() {
  // ---------------- reserva online
  await tenta('reserva online', async () => {
    const ag = await agendaOnline();
    ok('agenda online (baterias abertas, antecedência, preço)', ag.horarios.length > 0 && ag.horarios.every((h) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(h.inicio) && h.precoCentavos > 0), `${ag.horarios.length} horários, preço ${ag.precoCentavos}`);
    const veterano = await one<{ doc: string }>(`select c.documento_num doc from kart.cliente c where length(c.documento_num) = 11 and exists (select 1 from kart.inscricao i where i.cliente_id = c.id and i.status <> 'cancelada') limit 1`);
    const [pv] = await primeiraVez([veterano!.doc], (sql, p) => one(sql, p));
    ok('primeira vez: quem já andou não é estreante', pv === false);
    const h = ag.horarios.find((x) => x.livres >= 2)!;
    const prev = await previsualizarVoucherOnline({ codigo: '', documento: veterano!.doc, bateriaId: h.id, quantidade: 2 });
    ok('prévia sem cupom (2 vagas)', 'totalCentavos' in prev && prev.totalCentavos === h.precoCentavos * 2, prev);
    const cupom = await previsualizarVoucherOnline({ codigo: 'NAOEXISTE', documento: veterano!.doc, bateriaId: h.id, quantidade: 1 });
    ok('prévia com cupom inexistente', 'erro' in cupom && cupom.erro === 'Voucher não encontrado.', cupom);
    const vz = await one<{ codigo: string }>(`select codigo from kart.voucher where ativo and current_date between inicio_em and fim_em limit 1`);
    if (vz) { const pc = await previsualizarVoucherOnline({ codigo: vz.codigo.toLowerCase(), documento: veterano!.doc, bateriaId: h.id, quantidade: 1 }); ok('prévia com cupom real (código em minúsculas)', 'erro' in pc || pc.descontoCentavos >= 0, pc); }

    // pedido aguardando montado à mão (inscreverN é do office.ts, lote 5): expira e confirma
    const cli = await one<{ id: number }>(`insert into kart.cliente (nome, origem) values ('ZZ TESTE RESERVA', 'teste') returning id`);
    const mk = async (pedido: string, expiraMin: number) => {
      const i1 = await one<{ id: number }>(`insert into kart.inscricao (bateria_id, cliente_id, status, origem, pago, valor_centavos, preco_centavos) values (@b, @c, 'reservada', 'site', false, 0, 17500) returning id`, { b: h.id, c: cli!.id });
      const i2 = await one<{ id: number }>(`insert into kart.inscricao (bateria_id, cliente_id, status, origem, pago, valor_centavos, preco_centavos) values (@b, @c, 'reservada', 'site', false, 0, 8990) returning id`, { b: h.id, c: cli!.id });
      await query(`insert into kart.reserva_online (pedido_id, codigo, cliente_id, bateria_id, quantidade, valor_centavos, status, forma, inscricao_ids, expira_em)
        values (@p, @p, @c, @b, 2, 26490, 'aguardando', 'pix', @ids, now() + make_interval(mins => @m::int))`, { p: pedido, c: cli!.id, b: h.id, ids: `${i1!.id},${i2!.id}`, m: expiraMin });
      return [i1!.id, i2!.id];
    };
    try {
      const venc = await mk('ZZT-EXP', -10);
      const r = await expirarVencidos(() => undefined);
      const st = await query<{ status: string }>(`select status from kart.inscricao where id = any(@ids)`, { ids: venc });
      ok('expira pedido vencido e libera as vagas', r.some((x) => x.id === 'ZZT-EXP') && st.every((x) => x.status === 'cancelada'));
      const pago = await mk('ZZT-PAG', 15);
      const res = await confirmarPagamento({ id: 'ZZT-PAG', codigo: 'ZZT-PAG', status: 'pago', pagamento: { asaasId: 'pay_teste', billingType: 'PIX', pagoEm: '', valorCentavos: 26490 } } as PedidoSite, () => undefined);
      const ins = await query<{ pago: boolean; valor_centavos: number; status: string }>(`select pago, valor_centavos, status from kart.inscricao where id = any(@ids) order by id`, { ids: pago });
      ok('confirma pagamento: vagas pagas e valor dividido pelo preço de cada vaga', res.acao === 'confirmado' && ins.every((x) => x.pago && x.status === 'confirmada') && ins[0].valor_centavos + ins[1].valor_centavos === 26490 && ins[0].valor_centavos > ins[1].valor_centavos, ins);
      const fim = await one<{ status: string; forma: string }>(`select status, forma from kart.reserva_online where pedido_id = 'ZZT-PAG'`);
      ok('reserva online fica paga (pix)', fim?.status === 'pago' && fim.forma === 'pix', fim);
      const ninguem = await vagaOnlineDoGrupo(h.id, cli!.id, [cli!.id], () => undefined);
      ok('vaga online do grupo (sem outro dono: nada muda)', ninguem === null);
    } finally {
      await query(`delete from kart.reserva_online where pedido_id like 'ZZT-%'`);
      await query(`delete from kart.inscricao where cliente_id = @c`, { c: cli!.id });
      await query(`delete from kart.cliente where id = @c`, { c: cli!.id });
    }
    await acertarCuponsDosGrupos();
    ok('acerto dos cupons dos grupos (update ... where exists)', true);
    const g = await one<{ id: number; token: string }>(`select g.id, t.token from kart.reserva_grupo g join kart.reserva_grupo_piloto t on t.grupo_id = g.id where g.status = 'ativa' and t.token is not null order by g.id desc limit 1`);
    if (g) {
      const preco = await precoDaVagaPeloLink(g.token, veterano!.doc);
      ok('preço da vaga pelo link do grupo', !!preco && preco.precoCentavos > 0, preco);
      const pvg = await precoPrimeiraVezDoGrupo(g.id);
      ok('preço de primeira vez do grupo', pvg === null || pvg > 0, pvg);
    }
  });

  // ---------------- endurance
  await tenta('endurance', async () => {
    const lista = await rota('GET', '/endurance/eventos');
    ok('lista de eventos', lista.status === 200 && lista.body.length >= 1 && !('segredo' in lista.body[0]), `${lista.body.length} evento(s)`);
    const real = lista.body[0];
    const det = await rota('GET', `/endurance/eventos/${real.id}`);
    ok('evento real: equipes ordenadas pelo número da placa + pilotos pela view', det.status === 200 && det.body.equipes.length > 0 && det.body.equipes.every((q: any, i: number, a: any[]) => i === 0 || !(Number(q.numero) < Number(a[i - 1].numero))), `${det.body.equipes.length} equipes, ${det.body.equipes.reduce((s: number, q: any) => s + q.pilotos.length, 0)} pilotos`);
    if (real.bateriaId) {
      const tot = await equipesParaOTotem(real.bateriaId);
      ok('equipes para o totem', !tot || tot.equipes.length > 0, tot ? `${tot.equipes.length} equipes` : 'evento inativo');
      const mapa = await enduranceDasBaterias([real.bateriaId]);
      ok('endurance das baterias', mapa instanceof Map);
      const vin = await query(`select i.id, endurance.pulseira, endurance.equipe from kart.inscricao i ${ENDURANCE_VINCULO_SQL} where i.bateria_id = @b limit 5`, { b: real.bateriaId });
      ok('vínculo endurance na inscrição (lateral + string_agg)', Array.isArray(vin), vin.slice(0, 2));
    }
    const ev = await rota('POST', '/endurance/eventos', { nome: 'ZZ TESTE ENDURANCE', data: '2026-12-20', regras: { pilotosMax: 3, fileiras: 2 } });
    const eid = ev.body.id;
    try {
      const q1 = await rota('POST', `/endurance/eventos/${eid}/equipes`, { nome: 'ZZ Equipe A', numero: '10', pago: true });
      const q2 = await rota('POST', `/endurance/eventos/${eid}/equipes`, { nome: 'ZZ Equipe B', numero: '2' });
      let dupOk = false; try { await rota('POST', `/endurance/eventos/${eid}/equipes`, { nome: 'ZZ Repetida', numero: '10' }); } catch (e) { dupOk = /placa 10/.test((e as Error).message); }
      ok('equipes + placa repetida recusada', q1.status === 201 && q2.status === 201 && dupOk);
      const p1 = await rota('POST', `/endurance/eventos/${eid}/pilotos`, { equipeId: q1.body.id, nome: 'ZZ Piloto Um', chefe: true });
      const p2 = await rota('POST', `/endurance/eventos/${eid}/pilotos`, { equipeId: q1.body.id, nome: 'ZZ Piloto Dois' });
      const p3 = await rota('POST', `/endurance/eventos/${eid}/pilotos`, { equipeId: q2.body.id, nome: 'ZZ Piloto Tres' });
      ok('pilotos com pulseiras em sequência (trava do evento)', [p1, p2, p3].map((p) => p.body.pulseira).join(',') === '1,2,3', [p1.body.pulseira, p2.body.pulseira, p3.body.pulseira]);
      const pes = await rota('POST', `/endurance/eventos/${eid}/pesagens`, { pulseira: 1, momento: 'inicial', balancaKg: '70,5' });
      const pes2 = await rota('POST', `/endurance/eventos/${eid}/pesagens`, { pulseira: 1, momento: 'parada', balancaKg: '60' });
      ok('pesagem inicial (lastro) e de parada', pes.status === 201 && pes2.status === 201, { inicial: pes.body.lastroKg, parada: pes2.body.resultado });
      const pul = await rota('GET', `/endurance/eventos/${eid}/pulseira/1`);
      ok('ficha da pulseira', pul.body.piloto.nome === 'ZZ Piloto Um' && pul.body.pesagens.length === 2 && pul.body.companheiros.length === 1);
      await rota('DELETE', `/endurance/eventos/${eid}/pesagens/${pes2.body.id}`);
      const f = await rota('POST', `/endurance/eventos/${eid}/filas`, { fileiras: { '1': ['21', '22'], '2': ['23'] }, fora: ['29'] });
      ok('monta filas', f.body.filas.length === 4, f.body.filas.map((x: any) => `${x.kart}:${x.situacao}`));
      const lg = await rota('POST', `/endurance/eventos/${eid}/largada`, {});
      ok('sorteio da largada', lg.body.sorteados.length === 2, lg.body.sorteados);
      const tr = await rota('POST', `/endurance/eventos/${eid}/trocas`, { pulseira: 2 });
      ok('troca no box (pega o 1º kart da fileira e devolve o anterior)', tr.status === 201 && !!tr.body.kart && tr.body.devolvido, tr.body);
      const df = await rota('POST', `/endurance/eventos/${eid}/trocas/${tr.body.id}/desfazer`);
      ok('desfazer a última troca', df.body.ok === true);
      await rota('POST', `/endurance/eventos/${eid}/punicoes`, { equipeId: q2.body.id, tipo: 'segundos', valor: 10, motivo: 'teste' });
      await rota('POST', `/endurance/eventos/${eid}/ajustes`, { equipeId: q2.body.id, volta: 5, acao: 'ignorar' });
      const put = await rota('PUT', `/endurance/eventos/${eid}/pilotos/${p3.body.pilotoId}`, { pesoKg: '75,5', chefe: true });
      const det2 = await rota('GET', `/endurance/eventos/${eid}`);
      const tres = det2.body.equipes.find((q: any) => q.id === q2.body.id).pilotos[0];
      ok('atualiza piloto (peso numérico, chefe booleano) + punição + ajuste', put.body.ok && tres.pesoKg === 75.5 && tres.chefe === true && det2.body.punicoes.length >= 1 && det2.body.ajustes.length === 1, { peso: tres.pesoKg, punicoes: det2.body.punicoes.length });
      ok('placas em ordem numérica (2 antes de 10)', det2.body.equipes[0].numero === '2');
      const evRow = await one<{ segredo: string }>(`select segredo from kart.endurance_evento where id = @id`, { id: eid });
      const chefe = await paginaDoChefe(tokenEquipe({ segredo: evRow!.segredo }, q1.body.id));
      ok('página pública do chefe de equipe (link assinado)', chefe.equipe.nome === 'ZZ Equipe A' && chefe.pilotos.length === 2);
      await rota('DELETE', `/endurance/eventos/${eid}/pilotos/${p3.body.pilotoId}`);
      const del = await rota('DELETE', `/endurance/eventos/${eid}/equipes/${q2.body.id}`).catch((e) => ({ status: 409, body: (e as Error).message }));
      ok('apagar equipe com punição/troca é bloqueado ou apaga em transação', del.status === 200 || del.status === 409);
    } finally {
      for (const t of ['endurance_parada_ajuste', 'endurance_punicao', 'endurance_troca', 'endurance_fila', 'endurance_pesagem']) await query(`delete from kart.${t} where evento_id = @e`, { e: eid });
      await query(`delete from kart.endurance_piloto_equipe where piloto_id in (select id from kart.endurance_piloto where evento_id = @e)`, { e: eid });
      await query(`delete from kart.endurance_piloto where evento_id = @e`, { e: eid });
      await query(`delete from kart.endurance_equipe where evento_id = @e`, { e: eid });
      await query(`delete from kart.endurance_evento where id = @e`, { e: eid });
    }
  });

  // ---------------- totem, traçados, app
  await tenta('totem/traçados/app', async () => {
    const bat = await query(TOTEM_BATERIAS_SQL);
    ok('baterias do totem hoje (data de hoje no fuso de Brasília)', Array.isArray(bat), `${bat.length} bateria(s) hoje`);
    const antes = await query<{ id: number; nome: string; ativo: boolean; timing_track_id: string | null }>(`select id, nome, ativo, timing_track_id from kart.tracado order by id`);
    const reais = antes.filter((t) => t.timing_track_id && t.ativo).map((t) => ({ id: t.timing_track_id, name: t.nome, lengthMeters: 1110, active: true }));
    const tracks = await sincronizarTracadosDaCronometragem({ timingUrl: 'http://crono.teste', query, one, fetcher: (async () => new Response(JSON.stringify(reais.length ? reais : [{ id: 'zz-teste', name: 'Traçado ZZ Normal', lengthMeters: 1110, active: true }]))) as never } as never);
    ok('sincroniza traçados da cronometragem (upsert + returning)', tracks.length > 0, `${tracks.length} traçado(s)`);
    await query(`delete from kart.tracado where timing_track_id = 'zz-teste'`);
    for (const t of antes) await query(`update kart.tracado set nome = @n, ativo = @a where id = @id`, { id: t.id, n: t.nome, a: t.ativo });
    const c = await one<{ doc: string; email: string }>(`select documento_num doc, email from kart.cliente where length(documento_num) = 11 and email like '%@%' and responsavel_id is null order by id desc limit 1`);
    const conta = await clienteDaConta({ cpf: c!.doc, email: c!.email.toUpperCase(), phone: '' } as never);
    ok('vínculo da conta do app pelo CPF + e-mail', conta?.nivel === 'completo', conta);
  });

  await getPool().end();
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nlote 3 verificado: tudo ok');
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
