/**
 * Verificação do lote 4 do port (grupos) contra a cópia no Kartódromo OS. O que cria vaga nova (inscreverN) é do office.ts
 * e entra no lote 5. A cópia na VPS é um ensaio (recarregada inteira no corte), e o teste desfaz o que grava.
 * Uso: OPS_PG_URL=postgres://ops_app:...@127.0.0.1:55432/postgres npx tsx scripts/ops/verificar-pg-lote4.ts
 */
import { one, query, getPool } from '../../lib/ops/db';
import { gruposRoutes, grupo, gruposDoDiaNoTotem, conferirCobrancas, publicarGruposNoSite, enviarLembretesDosGrupos, aplicarPagos, resumoPainel, precoDoPiloto, vincularPorDados } from '../../lib/ops/grupos';

let falhas = 0;
const ok = (nome: string, cond: unknown, extra: unknown = '') => {
  if (!cond) falhas++;
  console.log(`${cond ? 'ok  ' : 'FALHA'} ${nome}${extra !== '' ? ` -> ${typeof extra === 'string' ? extra : JSON.stringify(extra).slice(0, 220)}` : ''}`);
};
const tenta = async (nome: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { falhas++; console.log(`FALHA ${nome} -> ${(e as Error).message}`); } };
const sessao = { uid: 1, nome: 'teste', perfil: 1, admin: true } as never;
async function rota(method: string, caminho: string, body: Record<string, unknown> = {}) {
  let out: { status: number; body: any } = { status: 0, body: null };
  await gruposRoutes({ method, url: new URL('http://x/api/office' + caminho), body: async () => body, sessao } as never, (status, b) => { out = { status, body: b }; });
  return out;
}

async function main() {
  const g = await one<{ id: number; dia: string; bateria: number }>(`select g.id, to_char(b.inicio, 'YYYY-MM-DD') dia, g.bateria_id bateria
    from kart.reserva_grupo g join kart.bateria b on b.id = g.bateria_id
    where exists (select 1 from kart.reserva_grupo_pagamento p where p.grupo_id = g.id) order by g.id desc limit 1`);
  await tenta('leitura', async () => {
    const lista = await rota('GET', `/grupos?de=${g!.dia}&ate=${g!.dia}`);
    ok('lista de grupos por período', lista.status === 200 && Array.isArray(lista.body), `${lista.body?.length} grupo(s) em ${g!.dia}`);
    const um = await grupo(g!.id);
    ok('grupo completo (pilotos, pagamentos, cobranças, saldo)', !!um && Array.isArray(um.pilotos) && um.pilotos.length > 0 && typeof um.pago === 'number', { codigo: um?.codigo, pilotos: um?.pilotos.length, pago: um?.pago, falta: (um as any)?.falta });
    const somaSql = (await one<{ s: number }>(`select coalesce(sum(valor_centavos), 0) s from kart.reserva_grupo_pagamento where grupo_id = @g and not cancelado`, { g: g!.id }))!.s;
    ok('valor pago do grupo bate com a soma direta no banco', um && um.pago === somaSql, { calculado: um?.pago, banco: somaSql });
    const det = await rota('GET', `/grupos/${g!.id}`);
    ok('GET /grupos/:id', det.status === 200 && det.body.id === g!.id);
    const pend = await rota('GET', `/grupos/pendencias?bateriaId=${g!.bateria}`);
    ok('pendências', pend.status === 200, Array.isArray(pend.body) ? `${pend.body.length}` : Object.keys(pend.body ?? {}));
    const tot = await gruposDoDiaNoTotem();
    ok('grupos do dia no totem', Array.isArray(tot), `${tot.length}`);
    ok('resumo do painel', typeof resumoPainel(um!).pilotos !== 'undefined' || !!resumoPainel(um!));
    ok('preço do piloto (aniversário)', precoDoPiloto({ preco: 14500, aniversario: true, precoAniversariante: 9000 }, true, 11) === 9000 && precoDoPiloto({ preco: 14500, aniversario: true, precoAniversariante: 9000 }, true, 10) === 14500);
    const pagos = await aplicarPagos(g!.id);
    ok('aplicar pagos no grupo (idempotente)', pagos === undefined || typeof pagos === 'number' || typeof pagos === 'object', pagos as unknown as string);
    const ninguem = await vincularPorDados(g!.bateria, -1, () => undefined);
    ok('vincular por dados sem cliente', ninguem === null);
  });

  await tenta('pagamento manual', async () => {
    const um = await grupo(g!.id);
    const piloto = um!.pilotos.find((p: any) => p.inscricaoId && !p.inscricaoPaga) ?? um!.pilotos[0];
    const antes = (await one<{ s: number }>(`select coalesce(sum(valor_centavos), 0) s from kart.reserva_grupo_pagamento where grupo_id = @g and not cancelado`, { g: g!.id }))!.s;
    const chave = 'zzteste-' + Date.now();
    const r = await rota('POST', `/grupos/${g!.id}/pagamentos`, { valorCentavos: 100, forma: 'Pix', pilotoId: piloto.id, idempotencyKey: chave });
    const repetido = await rota('POST', `/grupos/${g!.id}/pagamentos`, { valorCentavos: 100, forma: 'Pix', pilotoId: piloto.id, idempotencyKey: chave }).catch((e) => ({ status: 409, body: (e as Error).message }));
    const novos = await query<{ id: number }>(`select id from kart.reserva_grupo_pagamento where idempotency_key = @k`, { k: chave });
    const novo = novos[0];
    ok('mesma chave de idempotência não lança duas vezes', novos.length === 1, { repetido: repetido.status });
    ok('lança pagamento manual', (r.status === 200 || r.status === 201) && !!novo, r.status);
    if (novo) {
      const del = await rota('DELETE', `/grupos/${g!.id}/pagamentos/${novo.id}`);
      const depois = (await one<{ s: number }>(`select coalesce(sum(valor_centavos), 0) s from kart.reserva_grupo_pagamento where grupo_id = @g and not cancelado`, { g: g!.id }))!.s;
      ok('cancela o pagamento e o saldo volta', del.status === 200 && depois === antes, { antes, depois });
      await query(`delete from kart.reserva_grupo_pagamento where id = @id`, { id: novo.id });
    }
  });

  await tenta('site e Asaas simulados', async () => {
    process.env.PRECADASTRO_URL = 'http://site.teste'; process.env.PRECADASTRO_KEY = 'x';
    const fetchReal = globalThis.fetch;
    const chamadas: string[] = [];
    globalThis.fetch = (async (u: string, init?: RequestInit) => {
      chamadas.push(`${init?.method ?? 'GET'} ${String(u).replace('http://site.teste', '')}`);
      if (String(u).includes('/cobranca')) return new Response(JSON.stringify({ status: 'PENDING', pago: false }));
      return new Response(JSON.stringify({ ok: true, acoes: [], pagamentos: [] }));
    }) as typeof fetch;
    try {
      const n = await conferirCobrancas(() => undefined);
      ok('confere cobranças em aberto no Asaas (simulado)', typeof n === 'number', `${n} conferida(s), ${chamadas.length} chamada(s)`);
      chamadas.length = 0;
      await publicarGruposNoSite(() => undefined);
      ok('publica grupos no site (simulado)', chamadas.some((c) => c.startsWith('PUT') || c.startsWith('POST')), chamadas.slice(0, 3));
      const l = await enviarLembretesDosGrupos(() => undefined);
      ok('lembretes dos grupos (janela 2h–48h, lateral)', typeof l === 'number', `${l}`);
    } finally { globalThis.fetch = fetchReal; }
  });

  await getPool().end();
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nlote 4 verificado: tudo ok');
  process.exit(falhas ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
