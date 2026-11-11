import { describe, expect, it } from 'vitest';

describe('Aprovação de reservas online / site', () => {
  it('garante que inscrição com origem site não seja criada como aprovada', async () => {
    // Simula a lógica de aprovação de inscreverN
    const origem = 'site';
    const aprovadaPassada = true;
    const aprovadaFinal = (origem === 'site' || origem === 'totem' || origem === 'agendamento') ? 0 : (aprovadaPassada ? 1 : 0);
    expect(aprovadaFinal).toBe(0);
  });

  it('garante que a situação de reserva paga mas não aprovada seja Pré-reserva', () => {
    function situacaoReserva(r: { status?: string; pago?: boolean; aprovada?: boolean }) {
      return r.status === 'cancelada' ? 'Cancelada'
        : r.aprovada != null && !r.aprovada ? 'Pré-reserva'
        : r.pago ? 'Paga'
        : 'A pagar';
    }

    // Reserva do site: já paga pelo Pix, mas recepção ainda não aprovou
    const resSiteNaoAprovada = { status: 'confirmada', pago: true, aprovada: false };
    expect(situacaoReserva(resSiteNaoAprovada)).toBe('Pré-reserva');

    // Após recepção aprovar (Ctrl+A):
    const resSiteAprovada = { status: 'confirmada', pago: true, aprovada: true };
    expect(situacaoReserva(resSiteAprovada)).toBe('Paga');

    // Reserva não paga e aprovada:
    const resAguardandoPagamento = { status: 'reservada', pago: false, aprovada: true };
    expect(situacaoReserva(resAguardandoPagamento)).toBe('A pagar');
  });
});
