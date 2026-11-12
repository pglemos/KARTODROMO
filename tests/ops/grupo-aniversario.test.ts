import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/ops/db', () => ({ query: vi.fn(), one: vi.fn(), tx: vi.fn(), insertCliente: vi.fn(), onlyDigits: (v: unknown) => String(v ?? '').replace(/\D/g, '') }));
vi.mock('../../lib/ops/office', () => ({ HttpError: class extends Error {}, cancelarReserva: vi.fn(), exigePodeFecharBateria: vi.fn(), exigePermissaoOffice: vi.fn(), inscreverN: vi.fn(), moverReservas: vi.fn() }));

const { montar, precoDoPiloto } = await import('../../lib/ops/grupos');

const grupoBase = { id: 1, codigo: 'GABC', bateriaId: 9, vagas: 20, disponiveis: 0, inicio: '2026-11-20T19:00', bateria: 'BATERIA', responsavelId: 50, responsavel: 'Ana', responsavelTelefone: null,
  origem: 'whatsapp', modo: 'unico', preco: 14500, sinalPct: 30, observacao: null, status: 'ativa', criadoEm: '', criadoPor: null };
const pilotos = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1, ordem: i + 1, responsavel: i === 0 ? 1 : 0, token: 't' + i, inscricaoStatus: 'reservada', inscricaoPaga: 0, pagoPeloGrupo: 0 }));

describe('promoção do aniversariante', () => {
  it('aniversariante com 10 convidados paga R$ 90, convidados pagam o preço do grupo', () => {
    expect(precoDoPiloto({ ...grupoBase, aniversario: 1, precoAniversariante: null }, true, 11)).toBe(9000);
    expect(precoDoPiloto({ ...grupoBase, aniversario: 1, precoAniversariante: null }, false, 11)).toBe(14500);
  });

  it('abaixo de 10 convidados não vale a promoção', () => {
    expect(precoDoPiloto({ ...grupoBase, aniversario: 1, precoAniversariante: null }, true, 10)).toBe(14500);
  });

  it('sem marcação de aniversário nada muda', () => {
    expect(precoDoPiloto({ ...grupoBase, aniversario: 0 }, true, 15)).toBe(14500);
  });

  it('total do grupo e pagamento único dividido proporcionalmente', () => {
    const g = montar({ ...grupoBase, aniversario: 1, precoAniversariante: 9000 }, pilotos(11), [], []);
    expect(g.total).toBe(9000 + 10 * 14500);
    expect(g.promocao?.ativa).toBe(true);
    const pago = montar({ ...grupoBase, aniversario: 1, precoAniversariante: 9000 }, pilotos(11), [{ id: 1, grupoId: 1, pilotoId: null, valor: g.total }], []);
    expect(pago.falta).toBe(0);
    expect(pago.pilotos.every((p) => p.pago)).toBe(true);
    expect(pago.pilotos[0].preco).toBe(9000);
  });
});
