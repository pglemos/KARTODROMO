import { describe, expect, it, vi } from 'vitest';
import { avisarPorEmail, conteudoEmailReserva, type PedidoEmail } from '../workers/pre-cadastro/src/emails-reserva';

const base = (): PedidoEmail => ({
  id: '11111111-2222-3333-4444-555555555555', codigo: 'AB12CD', status: 'aguardando_pagamento', quantidade: 2, forma: 'pix',
  cliente: { nome: 'Maria Silva', email: 'maria@exemplo.com' },
  servidor: { valorCentavos: 30000, expiraEm: '2026-11-14T20:15:00Z', descricao: 'Bateria Rental', inicio: '2026-11-14T18:00:00' },
});

describe('e-mails da reserva', () => {
  it('monta todos os tipos com código, data e links', () => {
    for (const t of ['aguardando_pagamento', 'pago', 'confirmado', 'expirado', 'recusado', 'pago_sem_vaga'] as const) {
      const c = conteudoEmailReserva(base(), t);
      expect(c.subject.length).toBeGreaterThan(10);
      expect(c.html).toContain('Maria');
      expect(c.text).not.toContain('undefined');
      expect(c.html).not.toContain('undefined');
    }
    const c = conteudoEmailReserva(base(), 'aguardando_pagamento');
    expect(c.subject).toContain('17:15');
    expect(c.html).toContain('#p=11111111');
    expect(conteudoEmailReserva(base(), 'confirmado').text).toContain('sábado, 14/11/2026 às 18:00');
  });

  it('manda uma vez por status e espera o link do grupo', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const env = { RESEND_API_KEY: 'k', RESEND_FROM_EMAIL: 'r@x.com' };
    const p = base();
    expect(await avisarPorEmail(env, p)).toBe(true);
    expect(await avisarPorEmail(env, p)).toBe(false);
    p.status = 'confirmado'; p.modo = 'individual';
    expect(await avisarPorEmail(env, p)).toBe(false);
    p.grupo = { link: 'https://cadastro.kartodromodebetim.com.br/?g=X', painel: 'https://cadastro.kartodromodebetim.com.br/painel?g=X' };
    expect(await avisarPorEmail(env, p)).toBe(true);
    p.status = 'pago';
    expect(await avisarPorEmail(env, p)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
});
