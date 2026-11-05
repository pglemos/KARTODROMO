import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { abrirStore, type AppStore } from '../../lib/app-v1/store';
import { criarOperacao } from '../../lib/app-v1/operacao';
import type { Identidade } from '../../lib/app-v1/auth';
const stores: AppStore[] = [];
afterEach(() => stores.splice(0).forEach(s => s.fechar()));
const ger: Identidade = { usuarioId:'g',usuario:'TESTE CODEX',nome:'Teste',perfil:'GERENCIA',sessaoId:'s',deviceId:'d',expiraEm:0 };
const montar = (store: AppStore) => criarOperacao({store,legado:async()=>({resultado:{karts:[]}}),verSessao:()=>undefined,inscricoes:async()=>[],kartsCadastrados:()=>['7','105']});
const pedido = (id: string, rev: number, chassi: unknown) => ({operationId:id,expectedSessionRevision:rev,payload:{chassi},reason:'TESTE CODEX: identificação física'});
describe('identificação do chassi', () => {
 it('salva sem retirar de operação, aparece na equalização e resiste à devolução da oficina', async () => {
  const store=abrirStore(':memory:');stores.push(store);const op=montar(store);
  const req=pedido('chassi',0,'  CH-105/2026  ');
  expect(await op.chassiKart(ger,'105',req)).toMatchObject({status:'APPLIED',resultado:{kart:'105',chassi:'CH-105/2026'}});
  expect(op.frota()).toMatchObject({fora:[],chassis:{'105':'CH-105/2026'}});
  expect(await op.equalizacao('eq')).toMatchObject({chassis:{'105':'CH-105/2026'}});
  expect(await op.chassiKart(ger,'105',req)).toMatchObject({status:'APPLIED'});
  await expect(op.chassiKart(ger,'7',req)).rejects.toMatchObject({codigo:'IDEMPOTENCY_PAYLOAD_MISMATCH'});
  await op.marcarKart(ger,'105',{fora:true,reason:'TESTE CODEX'});
  await op.marcarKart(ger,'105',{fora:false,reason:'TESTE CODEX'});
  expect(op.frota().chassis['105']).toBe('CH-105/2026');
 });
 it('recusa recepção, kart desconhecido e identificação vazia ou longa', async () => {
  const store=abrirStore(':memory:');stores.push(store);const op=montar(store);
  await expect(op.chassiKart({...ger,perfil:'RECEPCAO'},'105',pedido('rec',0,'ABC'))).rejects.toMatchObject({http:403});
  for (const [i,kart,chassi] of [[1,'1000','ABC'],[2,'99','ABC'],[3,'105',' '],[4,'105','X'.repeat(81)],[5,'105',123]] as const) {
   expect(await op.chassiKart(ger,kart,pedido(String(i),0,chassi))).toMatchObject({status:'REJECTED'});
  }
  expect(op.frota().chassis).toEqual({});
 });
 it('mantém o cadastro ao reabrir o banco', async () => {
  const pasta=mkdtempSync(join(tmpdir(),'kart-chassi-'));const arquivo=join(pasta,'app.db');
  let store=abrirStore(arquivo);
  try {
   await montar(store).chassiKart(ger,'105',pedido('persistir',0,'CH-105'));
   store.fechar();store=abrirStore(arquivo);
   expect(montar(store).frota().chassis['105']).toBe('CH-105');
  } finally {store.fechar();rmSync(pasta,{recursive:true,force:true});}
 });
});
