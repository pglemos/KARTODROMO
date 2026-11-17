/**
 * Verificação do port para Postgres, lote a lote, contra a cópia carregada no Kartódromo OS (VPS).
 * Uso: OPS_PG_URL=postgres://ops_app:...@127.0.0.1:55432/postgres npx tsx scripts/ops/verificar-pg.ts
 * Escreve só em linhas de teste (nome "ZZ TESTE PORT ...") e apaga tudo no fim.
 */
import { insertCliente, one, query, updateCliente, getPool } from '../../lib/ops/db';
import { termoAtual, gravarAceiteTermo } from '../../lib/ops/termo-online';
import { painelRoutes } from '../../lib/ops/painel';
import { gravarPreCadastro, gravarAcompanhante, type PreCadastro } from '../../lib/ops/pre-cadastro';

let falhas = 0;
const ok = (nome: string, cond: unknown, extra: unknown = '') => {
  if (!cond) falhas++;
  console.log(`${cond ? 'ok  ' : 'FALHA'} ${nome}${extra !== '' ? ` -> ${typeof extra === 'string' ? extra : JSON.stringify(extra)}` : ''}`);
};
const log = () => undefined;

async function rota(method: string, caminho: string, body: Record<string, unknown> = {}) {
  let out: { status: number; body: unknown } = { status: 0, body: null };
  const tratou = await painelRoutes(
    { method, url: new URL('http://x/api/office' + caminho), body: async () => body, sessao: {} as never },
    (status, b) => { out = { status, body: b }; },
  );
  return { tratou, ...out };
}

async function main() {
  // leitura sobre os dados carregados
  const c = await one<Record<string, unknown>>(`select ${(await import('../../lib/ops/db')).CLIENTE_COLS} from kart.cliente c where c.email is not null and c.nascimento is not null order by c.id limit 1`);
  ok('CLIENTE_COLS devolve camelCase e datas em texto', c && typeof c.criadoEm === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(String(c.criadoEm)) && 'tipoDocumento' in c && /^\d{4}-\d{2}-\d{2}$/.test(String(c.nascimento)), { id: c?.id, criadoEm: c?.criadoEm, nascimento: c?.nascimento });
  const n = await one<{ n: number }>(`select count(*) n from kart.cliente`);
  ok('count(*) volta number', typeof n?.n === 'number' && n.n > 160000, n?.n);
  const t = await termoAtual(null);
  ok('termoAtual lê a empresa', !!t.empresa && /^[a-f0-9]{12}$/.test(t.versao), t.empresa);
  const camp = await rota('GET', '/campeonatos');
  ok('GET /campeonatos', camp.status === 200 && Array.isArray(camp.body), Array.isArray(camp.body) ? `${camp.body.length} campeonato(s)` : camp.status);

  // escrita em linhas de teste
  const ids: number[] = [];
  try {
    const id = await insertCliente({ nome: 'zz teste port lote1', tipoDocumento: 'CPF', documento: '000.000.001-91', telefone: '(31) 99999-0000', nascimento: '1990-05-17', peso: '82,5', lgpd: true, bloqueado: false }, 'teste');
    ids.push(id);
    const g = await one<Record<string, unknown>>(`select nome, documento_num, telefone_num, peso, lgpd_aceite_em is not null lgpd, bloqueado, origem from kart.cliente where id = @id`, { id });
    ok('insertCliente normaliza e grava', g?.nome === 'Zz Teste Port Lote1' && g?.documento_num === '00000000191' && g?.peso === 82.5 && g?.lgpd === true && g?.bloqueado === false, g);
    await updateCliente(id, { email: 'TESTE@GMAL.COM', bloqueado: true }, true);
    const u = await one<Record<string, unknown>>(`select email, bloqueado, atualizado_em > criado_em mudou from kart.cliente where id = @id`, { id });
    ok('updateCliente parcial + trigger atualizado_em', u?.email === 'teste@gmail.com' && u?.bloqueado === true && u?.mudou === true, u);
    await gravarAceiteTermo(id, { versao: 'abcdef123456', aceitoEm: new Date().toISOString(), imagem: false, ip: '1.2.3.4' }, log);
    await gravarAceiteTermo(id, { versao: 'abcdef123456', aceitoEm: new Date().toISOString(), imagem: false, ip: '1.2.3.4' }, log);
    const a = await query(`select autoriza_imagem from kart.cliente_termo_aceite where cliente_id = @id`, { id });
    ok('aceite do termo grava uma vez só (repetido no mesmo minuto é ignorado)', a.length === 1 && a[0].autoriza_imagem === false, a);

    const p: PreCadastro = {
      key: 'k', chave: '00000000272', recebidoEm: '', tipoDocumento: 'CPF', documento: '000.000.002-72', nome: 'zz teste port precadastro', email: 'pc@teste.com',
      telefone: '31988887777', nascimento: '1985-01-02', peso: '70', cep: '32600000', endereco: 'Rua X', numero: '1', complemento: '', bairro: 'Centro', cidade: 'Betim', estado: 'mg',
      menores: [{ nome: 'zz teste port filho', nascimento: '2015-03-04', documento: 'MG123' }],
    };
    const pid = await gravarPreCadastro(p, log); ids.push(pid);
    const pid2 = await gravarPreCadastro({ ...p, email: 'pc2@teste.com' }, log);
    const filhos = await query<{ id: number; nome: string }>(`select id, nome from kart.cliente where responsavel_id = @r`, { r: pid });
    filhos.forEach((f) => ids.push(f.id));
    const pc = await one<Record<string, unknown>>(`select email, estado from kart.cliente where id = @id`, { id: pid });
    ok('pré-cadastro: cria, depois atualiza o mesmo CPF, menor sem duplicar', pid === pid2 && filhos.length === 1 && pc?.email === 'pc2@teste.com' && pc?.estado === 'MG', { pid, pid2, filhos: filhos.length, pc });
    const aid = await gravarAcompanhante({ nome: 'zz teste port acompanhante', documento: '000.000.003-53', nascimento: '2000-01-01', instagram: '@zzteste' }, log);
    ids.push(aid);
    const ac = await one<Record<string, unknown>>(`select origem, instagram from kart.cliente where id = @id`, { id: aid });
    ok('acompanhante da reserva online', ac?.origem === 'site', ac);

    const cr = await rota('POST', '/campeonatos', { nome: 'ZZ TESTE PORT', pontos: '25,18,15' });
    const novo = (cr.body as Record<string, unknown>[]).find((x) => x.nome === 'ZZ TESTE PORT') as Record<string, unknown>;
    const et = await rota('POST', `/campeonatos/${novo.id}/etapas`, { nome: 'E1', data: '2026-12-01', sessoesCorrida: 'a1,a2' });
    const etapa = ((et.body as Record<string, unknown>[]).find((x) => x.id === novo.id) as { etapas: Record<string, unknown>[] }).etapas[0];
    const pu = await rota('PUT', `/campeonatos/${novo.id}/etapas/${etapa.id}`, { publicada: true });
    const etapa2 = ((pu.body as Record<string, unknown>[]).find((x) => x.id === novo.id) as { etapas: Record<string, unknown>[] }).etapas[0];
    const up = await rota('PUT', `/campeonatos/${novo.id}`, { ativo: false, descartes: 1 });
    const camp2 = (up.body as Record<string, unknown>[]).find((x) => x.id === novo.id) as Record<string, unknown>;
    ok('campeonato: cria, etapa, publica, altera', etapa.data === '2026-12-01' && (etapa.sessoesCorrida as string[]).length === 2 && etapa2.publicada === true && camp2.ativo === false && camp2.descartes === 1, { etapa2, ativo: camp2.ativo });
    await query(`delete from kart.campeonato_etapa where campeonato_id = @c`, { c: novo.id });
    await query(`delete from kart.campeonato where id = @c`, { c: novo.id });
  } finally {
    if (ids.length) {
      await query(`delete from kart.cliente_termo_aceite where cliente_id = any(@ids)`, { ids });
      await query(`delete from kart.cliente where id = any(@ids) or responsavel_id = any(@ids)`, { ids });
    }
    await getPool().end();
  }
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nlote verificado: tudo ok');
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
