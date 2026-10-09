import { describe, expect, it } from 'vitest';
import { POLITICA_SECOES, POLITICA_VERSAO, politicaTexto } from '../src/config/politica-cancelamento';
import { politicaPublica } from '../workers/pre-cadastro/src/reservas';

describe('política de cancelamento (texto oficial de 09/10/2026)', () => {
  it('tem as 7 seções e as regras-chave', () => {
    expect(POLITICA_SECOES.map((s) => s.titulo.split('.')[0])).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    const t = politicaTexto();
    for (const trecho of ['48 horas de antecedência', 'desconto de 5% referente à taxa administrativa', 'no-show', '7 dias úteis', 'titularidade do cliente', 'reembolso integral', 'aceita integralmente esta Política'])
      expect(t).toContain(trecho);
  });
  it('a reserva online publica a mesma política e a versão que vai no pedido', async () => {
    const r = await politicaPublica().json() as { versao: string; secoes: unknown[] };
    expect(r.versao).toBe(POLITICA_VERSAO);
    expect(r.secoes).toEqual(POLITICA_SECOES);
  });
});
