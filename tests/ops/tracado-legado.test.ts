import { describe, expect, it } from 'vitest';
import { tracadoLegado, tracadoConfirmado } from '../../lib/ops/tracado-legado';
describe('traçados históricos do ranking', () => {
 it.each(['Traçado 1','Traçado 1 Normal','Traçado 1 · Super Kart','Traçado 1 Normal · Super Kart'])('não apresenta o padrão legado %s como traçado confirmado', nome => {
  expect(tracadoLegado('lt-506023',nome)).toBe('Traçado não confirmado');
  expect(tracadoLegado('lr-100',nome)).toBe('Traçado não confirmado');
 });
 it.each(['Traçado 9','Traçado 1 Invertido','Traçado 1 Normal Chicane','Traçado 11 Invertido Chicane'])('preserva o desenho explícito %s', nome => expect(tracadoLegado('lt-123',nome)).toBe(nome));
 it('preserva cronometragem atual e o traçado escrito no histórico CalXPro',()=>{
  expect(tracadoLegado('2026-11-05-prova','Traçado 1')).toBe('Traçado 1');
  expect(tracadoLegado('cx-123','Traçado 1')).toBe('Traçado 1');
 });
 it('mantém tempos sem traçado fora do ranking de Indoor e Super Kart',()=>{
  expect(tracadoConfirmado('Traçado não confirmado')).toBe(false);
  expect(tracadoConfirmado('Traçado não confirmado · Super Kart')).toBe(false);
  expect(tracadoConfirmado('Traçado principal')).toBe(false);
  expect(tracadoConfirmado('Traçado 1')).toBe(true);
 });
});
