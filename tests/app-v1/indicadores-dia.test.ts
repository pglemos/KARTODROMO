import { describe, expect, it } from 'vitest';
import { indicadoresDia } from '../../lib/app-v1/indicadores-dia';
import { criarOperacao } from '../../lib/app-v1/operacao';
import { abrirStore } from '../../lib/app-v1/store';
import type { Identidade } from '../../lib/app-v1/auth';
const c = (n: number) => ({ kart: String(n + 1), name: `Piloto ${n}`, customerId: String(n + 1) });
const etapa = (id: string, agendaId: number, type: string, ids: number[], state = 'encerrada') => ({ id, agendaId, type, state, name: 'BATERIA', createdAt: Date.parse('2026-11-03T20:00:00Z'), competitors: ids.map(c) });
const faixa = (inicio: number, n: number) => Array.from({ length: n }, (_, i) => inicio + i);
describe('indicadores e devolução de frota', () => {
  it('55 aparições em etapas correspondem a 29 pilotos únicos e quatro baterias', () => {
    const sessoes = [etapa('t1',1,'classificacao',faixa(0,15)),etapa('c1',1,'corrida',faixa(0,12)),etapa('t2',2,'classificacao',faixa(15,11)),etapa('c2',2,'corrida',faixa(15,11)),etapa('c3',3,'corrida',faixa(26,3)),etapa('c4',4,'corrida',faixa(0,3)),etapa('t3',3,'classificacao',faixa(26,3),'preparando'),etapa('t4',4,'classificacao',faixa(0,3),'preparando')];
    expect(indicadoresDia(sessoes)).toMatchObject({ pilotos:29, participacoes:32, baterias:{total:4, encerradas:4, preparando:0, emProva:0} });
  });
  it('tomada encerrada com corrida em preparo ainda não encerra a bateria', () => {
    expect(indicadoresDia([etapa('t',1,'classificacao',[1]),etapa('c',1,'corrida',[1],'preparando')]).baterias).toEqual({total:1,encerradas:0,preparando:1,emProva:0});
  });
  it('o gerente devolve pelo payload do app, sem marcar o kart novamente como fora', async () => {
    const store = abrirStore(':memory:');
    try {
      const op = criarOperacao({store,legado:async()=>({}),verSessao:()=>undefined,inscricoes:async()=>[],kartsCadastrados:()=>['7']});
      const ger:Identidade = {usuarioId:'g',usuario:'TESTE CODEX',nome:'Teste',perfil:'GERENCIA',sessaoId:'s',deviceId:'d',expiraEm:0};
      await op.marcarKart(ger,'7',{fora:true,reason:'TESTE CODEX'});
      const pedido = {operationId:'devolver',expectedSessionRevision:store.revisao('frota'),payload:{fora:false},reason:'TESTE CODEX: devolução'};
      expect(await op.marcarKart(ger,'7',pedido)).toMatchObject({status:'APPLIED'});
      expect(op.frota().fora).toHaveLength(0);
      expect(await op.marcarKart(ger,'7',pedido)).toMatchObject({status:'APPLIED'});
      expect(store.db.prepare("SELECT COUNT(*) n FROM auditoria WHERE operationId='devolver'").get()).toEqual({n:1});
      await expect(op.marcarKart({...ger,perfil:'OPERACAO'},'7',{fora:false})).rejects.toMatchObject({http:403});
    } finally {store.fechar();}
  });
});
