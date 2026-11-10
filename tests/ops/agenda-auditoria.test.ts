import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
const source = readFileSync(new URL('../../workers/admin/public/agenda-acoes.js', import.meta.url), 'utf8');
function actions() {
 const calls: { path: string; body: Record<string, unknown> }[] = [];
 const api = vm.runInNewContext(source.replace('return { montar, gaveta };', 'return { restaurar, abrirBateria };') + '\nAgendaAcoes', {
 office: async (path: string, o: {body:Record<string, unknown>}) => { calls.push({path, body:o.body}); },
 });
 return { api, calls };
}
describe('Agenda: estados completos', () => {
 it('desfazer restaura bloqueio e status anterior', async () => {
  const {api,calls}=actions(); await api.restaurar({id:1,status:'aberta',reservaFechada:false,autoAtendimento:false});
  expect(calls).toContainEqual({path:'/baterias/1/tipo',body:expect.objectContaining({tipo:'bloqueada'})});
 });
 it('abrir publica também o autoatendimento', async () => {
  const {api,calls}=actions(); await api.abrirBateria({id:2,status:'fechada',reservaFechada:false,autoAtendimento:false});
  expect(calls).toContainEqual({path:'/baterias/2/tipo',body:expect.objectContaining({tipo:'aberta'})});
 });
});
const db = vi.hoisted(() => ({ query:vi.fn(), one:vi.fn(), tx:vi.fn() }));
vi.mock('../../lib/ops/db', () => ({...db, CLIENTE_COLS:'', onlyDigits:(s:unknown)=>String(s||'').replace(/\D/g,''),insertCliente:vi.fn(),isValidCpf:vi.fn(),updateCliente:vi.fn()}));
import { carregarGrupos, gruposRoutes, tipoDaBateria } from '../../lib/ops/grupos';
import { officeRoutes } from '../../lib/ops/office';
const admin={uid:1,nome:'TESTE CODEX',admin:true,exp:Date.now()+60000};
describe('Agenda: validações no servidor', () => {
 it('busca o responsável do piloto pelo join do grupo', async()=>{
  db.query.mockReset()
   .mockResolvedValueOnce([{id:8,codigo:'G1',bateriaId:1,vagas:30,disponiveis:30,inicio:'2026-11-06T19:00',bateria:'Teste',responsavelId:4,responsavel:'TESTE CODEX',responsavelTelefone:null,origem:'recepcao',modo:'unico',preco:14500,sinalPct:0,observacao:null,status:'ativa',criadoEm:'2026-11-06T18:00',criadoPor:null}])
   .mockResolvedValueOnce([{id:9,grupoId:8,ordem:1,nome:null,telefone:null,menor:false,responsavel:true,clienteId:null,inscricaoId:null,token:'abcdefghijklmnop',inscricaoPaga:false,inscricaoStatus:'reservada',pagoPeloGrupo:false}])
   .mockResolvedValueOnce([]).mockResolvedValueOnce([]);
  await carregarGrupos('g.Id = @id',{id:8});
  const sql=String(db.query.mock.calls[1]?.[0]);
  expect(sql).toContain('LEFT JOIN dbo.ReservaGrupo rg ON rg.Id = p.GrupoId');
  expect(sql).toContain('THEN rg.ResponsavelId END');
  expect(sql).not.toContain('SELECT ResponsavelId FROM dbo.ReservaGrupo');
 });

 it('bloquear limpa reserva exclusiva',async()=>{
  db.query.mockResolvedValue([{id:1}]); await tipoDaBateria(1,'bloqueada');
  expect(db.query.mock.calls[db.query.mock.calls.length - 1]?.[1]).toMatchObject({rf:0,aa:0,status:'aberta'});
 });
 it('recebimento sem chave de idempotência não grava',async()=>{
  db.query.mockReset();db.one.mockReset();db.query.mockResolvedValue([]); db.one.mockResolvedValue(null);
  await expect(gruposRoutes({method:'POST',url:new URL('http://ops/api/office/grupos/1/pagamentos'),sessao:admin,body:async()=>({valorCentavos:14500,forma:'Pix'})},()=>{})).rejects.toMatchObject({status:400});
  expect(db.query.mock.calls.some(([s])=>s.includes('INSERT INTO dbo.ReservaGrupoPagamento'))).toBe(false);
 });
 it('perfil de consulta não altera bateria por chamada direta',async()=>{
  db.query.mockReset();db.one.mockReset();db.query.mockResolvedValue([{funcao:'agenda',acessar:true,alterar:false}]);
  db.one.mockResolvedValue({ativo:true,admin:false,perfilId:2,acessoTotal:false});
  await expect(officeRoutes({method:'POST',url:new URL('http://ops/api/office/baterias/1/status'),sessao:{...admin,admin:false},body:async()=>({status:'aberta'})},()=>{})).rejects.toMatchObject({status:403});
 });
});

import { saldosDasBaterias } from '../../lib/ops/agenda-financeiro';
describe('Agenda: saldo financeiro contratado',()=>{
 it('usa saldo parcial do grupo e valor líquido dos avulsos sem duplicar integrantes',()=>{
  const r=saldosDasBaterias([{id:1,preco:17500}], [{id:10,bateriaId:1,pago:false,total:14500},{id:11,bateriaId:1,pago:false,total:10000},{id:12,bateriaId:1,pago:true,total:17500}], [{bateriaId:1,falta:10000,pilotos:[{inscricaoId:10}]}]);
  expect(r[0].saldoCentavos).toBe(20000);
 });
 it('bateria sem inscrições tem saldo zero',()=>{expect(saldosDasBaterias([{id:2}],[],[])[0].saldoCentavos).toBe(0);});
});

describe('Agenda: movimento flexível',()=>{
 it('permite mover inscrição de grupo desvinculando do grupo',async()=>{
  const executed: string[] = [];
  db.tx.mockImplementation(async(work:(run:unknown)=>unknown)=>work(async(sql:string)=>{
   executed.push(sql);
   if(sql.includes('ReservaGrupoPiloto') && sql.includes('SELECT')) return [{grupoId:8}];
   if(sql.includes('ReservaGrupoPiloto') && sql.includes('UPDATE')) return [];
   if(sql.includes('i.ClienteId'))return [{ClienteId:9,BateriaId:1,Pago:false,Status:'reservada',produtoId:11,preco:14500}];
   if(sql.includes('dbo.Bateria b'))return [{Status:'aberta',Vagas:30,ocupadas:0,produtoId:11,preco:17500}];
   if(sql.includes('SELECT 1 x FROM dbo.Inscricao'))return [];
   return [];
  }));
  const res = await officeRoutes({method:'POST',url:new URL('http://ops/api/office/reservas/10/mover'),sessao:admin,body:async()=>({bateriaId:2})},()=>{});
  expect(res).toBe(true);
  expect(executed.some(s => s.includes('UPDATE dbo.ReservaGrupoPiloto SET InscricaoId = NULL'))).toBe(true);
 });
 it('permite mover para destino passado ou fechado',async()=>{
  db.tx.mockImplementation(async(work:(run:unknown)=>unknown)=>work(async(sql:string)=>{
   if(sql.includes('ReservaGrupoPiloto') && sql.includes('SELECT'))return [];
   if(sql.includes('i.ClienteId'))return [{ClienteId:9,BateriaId:1,Pago:false,Status:'reservada',produtoId:11,preco:14500}];
   if(sql.includes('dbo.Bateria b'))return [{Status:'fechada',Vagas:30,ocupadas:0,produtoId:11,preco:17500,passada:1}];
   if(sql.includes('SELECT 1 x FROM dbo.Inscricao'))return [];
   return [];
  }));
  const res = await officeRoutes({method:'POST',url:new URL('http://ops/api/office/reservas/10/mover'),sessao:admin,body:async()=>({bateriaId:2})},()=>{});
  expect(res).toBe(true);
 });
});
