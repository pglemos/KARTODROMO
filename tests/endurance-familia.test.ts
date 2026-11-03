import { describe, expect, it } from 'vitest';
import { validarFamiliaEquipes } from '../lib/ops/endurance-familia';
describe('inscricoes da mesma familia',()=>{
 it('aceita duas inscricoes da familia cadastrada, mesmo com nomes diferentes',()=>{
  expect(()=>validarFamiliaEquipes([{id:1,grupoId:4},{id:2,grupoId:4}])).not.toThrow();
 });
 it('recusa familias diferentes, mesmo com nomes parecidos',()=>{
  expect(()=>validarFamiliaEquipes([{id:1,grupoId:4},{id:2,grupoId:5}])).toThrow(/mesma família/);
 });
 it('nao trata inscricoes sem familia como parentes',()=>{
  expect(()=>validarFamiliaEquipes([{id:1,grupoId:null},{id:2,grupoId:null}])).toThrow(/mesma família/);
 });
 it('aceita reinscricao na mesma equipe sem familia',()=>{
  expect(()=>validarFamiliaEquipes([{id:1,grupoId:null},{id:1,grupoId:null}])).not.toThrow();
 });
});
