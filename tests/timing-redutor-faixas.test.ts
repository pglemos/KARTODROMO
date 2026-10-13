import { describe, it, expect } from 'vitest';
import { ajusteRedutorMm, regraDa, validarFaixasRedutor, faixasDaRegra } from '../lib/timing/equalizacao';
describe('faixas individuais do redutor', () => {
 const faixas = Array.from({length:9}, (_,i)=>({ateMs:500+(i+1)*250,mm:(i+1)*0.1}));
 const regra={toleranciaMs:500,faixaMs:250,passoMm:0.1,faixasPersonalizadas:faixas};
 it('edita nove faixas e respeita o limite inclusive, abrindo e fechando',()=>{
  expect(ajusteRedutorMm(500,regra)).toBe(0);
  expect(ajusteRedutorMm(750,regra)).toBe(0.1);
  expect(ajusteRedutorMm(751,regra)).toBe(0.2);
  expect(ajusteRedutorMm(-2750,regra)).toBe(-0.9);
  expect(ajusteRedutorMm(2751,regra)).toBe(1);
  expect(faixasDaRegra(regra)).toHaveLength(10);
  expect(regraDa(regra).faixasPersonalizadas).toHaveLength(9);
 });
 it('aceita ajuste independente por faixa sem recalcular o valor digitado',()=>{
  const r={...regra,faixasPersonalizadas:[{ateMs:750,mm:0.35},{ateMs:1000,mm:0.8}]};
  expect(ajusteRedutorMm(600,r)).toBe(0.35);expect(ajusteRedutorMm(-800,r)).toBe(-0.8);
 });
 it('recusa limites repetidos, fora de ordem e ajustes inválidos',()=>{
  for(const f of [[],[{ateMs:500,mm:1}],[{ateMs:750,mm:-1}],[{ateMs:750,mm:1},{ateMs:750,mm:2}],[{ateMs:750,mm:''}]])expect(()=>validarFaixasRedutor(f,500)).toThrow();
 });
 it('mantém o cálculo anterior para regras existentes',()=>{
  expect(ajusteRedutorMm(1000,{toleranciaMs:500,faixaMs:250,passoMm:0.1})).toBe(0.2);
 });
});
