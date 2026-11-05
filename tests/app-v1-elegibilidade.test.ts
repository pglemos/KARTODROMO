import { describe, it, expect } from 'vitest';
import { elegibilidade } from '../lib/app-v1/regras';

describe('App V1 - Regras de Elegibilidade para Sorteio', () => {
  it('retorna ELEGIVEL quando aprovado, pago e com termo', () => {
    const res = elegibilidade({
      clienteId: 1,
      nome: 'Piloto Teste',
      aprovada: true,
      pago: true,
      termo: true,
      totalCentavos: 15000,
      endurance: false,
    });
    expect(res).toEqual({ situacao: 'ELEGIVEL', motivo: null });
  });

  it('retorna ELEGIVEL quando aprovado e pago, mesmo se termo estiver pendente no banco', () => {
    const res = elegibilidade({
      clienteId: 2,
      nome: 'Piloto Pago na Recepcao',
      aprovada: true,
      pago: true,
      termo: false,
      totalCentavos: 15000,
      endurance: false,
    });
    expect(res).toEqual({ situacao: 'ELEGIVEL', motivo: null });
  });

  it('retorna ELEGIVEL para endurance aprovado, mesmo se termo estiver pendente', () => {
    const res = elegibilidade({
      clienteId: 3,
      nome: 'Piloto Endurance',
      aprovada: true,
      pago: false,
      termo: false,
      totalCentavos: 0,
      endurance: true,
    });
    expect(res).toEqual({ situacao: 'ELEGIVEL', motivo: null });
  });

  it('retorna INELEGIVEL se não estiver aprovado na recepção', () => {
    const res = elegibilidade({
      clienteId: 4,
      nome: 'Piloto Nao Aprovado',
      aprovada: false,
      pago: true,
      termo: true,
      totalCentavos: 15000,
      endurance: false,
    });
    expect(res).toEqual({ situacao: 'INELEGIVEL', motivo: 'Não aprovado na recepção.' });
  });

  it('retorna INELEGIVEL se pagamento estiver pendente', () => {
    const res = elegibilidade({
      clienteId: 5,
      nome: 'Piloto Sem Pagar',
      aprovada: true,
      pago: false,
      termo: true,
      totalCentavos: 15000,
      endurance: false,
    });
    expect(res).toEqual({ situacao: 'INELEGIVEL', motivo: 'Pagamento pendente.' });
  });

  it('retorna INELEGIVEL com motivo de termo se ainda não foi pago/aprovado e não tem termo', () => {
    const res = elegibilidade({
      clienteId: 6,
      nome: 'Piloto Novo',
      aprovada: false,
      pago: false,
      termo: false,
      totalCentavos: 15000,
      endurance: false,
    });
    // Verifica primeiro aprovação
    expect(res.situacao).toBe('INELEGIVEL');
  });
});
