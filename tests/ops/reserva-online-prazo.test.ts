import { afterEach, describe, expect, it, vi } from 'vitest';

import { configOnline } from '../../lib/ops/preco-antecipado';
import { EXPIRA_SQL, MARGEM_ANTES_DA_BATERIA_MIN, PRAZO_MINIMO_MIN } from '../../lib/ops/reserva-online';

afterEach(() => vi.unstubAllEnvs());

describe('prazo para pagar a reserva online (regra do dono, 20/11/2026)', () => {
  it('é de 2 horas quando o servidor não configura outro', () => {
    vi.stubEnv('OPS_ONLINE_PRAZO_MIN', '');
    expect(configOnline().prazoMin).toBe(120);
  });

  it('respeita o valor do .env quando existe', () => {
    vi.stubEnv('OPS_ONLINE_PRAZO_MIN', '45');
    expect(configOnline().prazoMin).toBe(45);
  });

  it('nunca passa de 1 hora antes da bateria e nunca fica abaixo de 15 minutos', () => {
    expect(MARGEM_ANTES_DA_BATERIA_MIN).toBe(60);
    expect(PRAZO_MINIMO_MIN).toBe(15);
    const sql = EXPIRA_SQL.replace(/\s+/g, ' ');
    expect(sql).toContain('greatest(now() + make_interval(mins => @minimo::int)');
    expect(sql).toContain('least(now() + make_interval(mins => @prazo::int)');
    expect(sql).toContain('(select b.inicio from kart.bateria b where b.id = @bateria) - make_interval(mins => @margem::int)');
  });
});
