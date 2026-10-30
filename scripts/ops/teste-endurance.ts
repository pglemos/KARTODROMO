/** Teste ponta a ponta das rotas do endurance no banco real, com um evento de teste apagado no fim. */
import { enduranceRoutes, paginaDoChefe, tokenEquipe } from '../../lib/ops/endurance';
import { getPool, one, query } from '../../lib/ops/db';

const sessao = { uid: 1, nome: 'teste', admin: true, exp: Date.now() + 3_600_000 };
async function chamar(method: string, caminho: string, body: Record<string, unknown> = {}) {
  let out: { status: number; body: any } = { status: 0, body: null };
  const ok = await enduranceRoutes({ method, url: new URL('http://x/api/office' + caminho), sessao, body: async () => body }, (status, b) => { out = { status, body: b }; });
  if (!ok) throw new Error(`rota não tratada: ${method} ${caminho}`);
  if (out.status >= 400) throw new Error(`${method} ${caminho} → ${out.status} ${JSON.stringify(out.body)}`);
  return out.body;
}
const sessaoCrono = process.argv[2] ?? null;
let id = 0;
try {
  id = (await chamar('POST', '/endurance/eventos', { nome: 'TESTE ENDURANCE (apagar)', data: '2026-10-25', sessaoCrono })).id;
  const a = (await chamar('POST', `/endurance/eventos/${id}/equipes`, { nome: 'Equipe Alfa', numero: '901', chefeNome: 'Chefe A' })).id;
  const b = (await chamar('POST', `/endurance/eventos/${id}/equipes`, { nome: 'Equipe Beta', numero: '902' })).id;
  const imp = await chamar('POST', `/endurance/eventos/${id}/importar`, { texto: 'placa;equipe;piloto\n901;Equipe Alfa;Piloto Um\n901;Equipe Alfa;Piloto Dois;;chefe\n903;Equipe Gama;Piloto Tres' });
  console.log('importar', imp);
  const p = await chamar('POST', `/endurance/eventos/${id}/pilotos`, { equipeId: b, nome: 'Piloto Quatro' });
  console.log('pulseira nova', p.pulseira);
  await chamar('POST', `/endurance/eventos/${id}/pilotos`, { equipeId: a, nome: 'Piloto Cinco' });
  try { await chamar('POST', `/endurance/eventos/${id}/pilotos`, { equipeId: a, nome: 'Piloto Seis' }); console.log('ERRO: deixou 4 pilotos'); } catch (e) { console.log('4º piloto recusado ok'); }
  console.log('pesagem inicial', await chamar('POST', `/endurance/eventos/${id}/pesagens`, { pulseira: 1, momento: 'inicial', balancaKg: 78.4 }));
  console.log('pesagem parada', await chamar('POST', `/endurance/eventos/${id}/pesagens`, { pulseira: 1, momento: 'parada', balancaKg: 99.2 }));
  console.log('consulta pulseira', (await chamar('GET', `/endurance/eventos/${id}/pulseira/1`)).lastroSugerido);
  await chamar('POST', `/endurance/eventos/${id}/filas`, { fileiras: { 1: ['11', '12'], 2: ['21'], 3: ['31', '32'], 4: ['41'] } });
  console.log('largada', (await chamar('POST', `/endurance/eventos/${id}/largada`, {})).sorteados);
  const t = await chamar('POST', `/endurance/eventos/${id}/trocas`, { pulseira: 2, bola: 3 });
  console.log('troca', t.kart, 'fileira', t.fileira, 'devolvido', t.devolvido);
  await chamar('POST', `/endurance/eventos/${id}/trocas/${t.id}/desfazer`);
  await chamar('POST', `/endurance/eventos/${id}/punicoes`, { equipeId: b, tipo: 'voltas', valor: 1, motivo: 'teste' });
  const ev = await chamar('GET', `/endurance/eventos/${id}`);
  console.log('filas', ev.filas.map((f: any) => `${f.kart}:${f.situacao}${f.fileira ?? ''}`).join(' '), 'punicoes', ev.punicoes.length);
  const an = await chamar('GET', `/endurance/eventos/${id}/analise`);
  console.log('analise', an.erroCrono, an.analise.equipes.map((e: any) => `${e.numero} v${e.voltas} p${e.posOficial} ${e.desclassificada ? 'DQ' : ''}`).join(' | '));
  const tk = tokenEquipe(await one<any>(`SELECT Segredo segredo FROM dbo.EnduranceEvento WHERE Id = @id`, { id }) as any, a);
  const pg = await paginaDoChefe(tk);
  console.log('chefe', pg.equipe.nome, pg.pilotos.map((x: any) => `${x.nome}#${x.pulseira}`).join(', '));
  try { await paginaDoChefe(tk.slice(0, -1) + (tk.endsWith('A') ? 'B' : 'A')); console.log('ERRO: token falso aceito'); } catch { console.log('token falso recusado ok'); }
} finally {
  if (id) {
    for (const t of ['EnduranceParadaAjuste', 'EndurancePunicao', 'EnduranceTroca', 'EnduranceFila', 'EndurancePesagem', 'EndurancePiloto', 'EnduranceEquipe']) await query(`DELETE FROM dbo.${t} WHERE EventoId = @id`, { id });
    await query(`DELETE FROM dbo.EnduranceEvento WHERE Id = @id`, { id });
    console.log('evento de teste apagado');
  }
  await (await getPool()).close();
}
