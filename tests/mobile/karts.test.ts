import { describe, expect, it } from 'vitest';
import { filtrarKarts, type VoltaKart } from '../../workers/pre-cadastro/src/mobile/karts';

const volta = (dia: string, categoria: string, tracado: string, ms: number): VoltaKart => ({ dia, categoria, tracado, ms, kart: '8', inicio: Date.parse(dia + 'T18:00:00Z'), pos: 2, piloto: 'TESTE CODEX', bateria: 'TESTE CODEX', de: 10 });
const linhas = [volta('2026-10-18', 'Indoor', 'Traçado 1', 65000), volta('2026-10-19', 'Indoor', 'Traçado 1', 60000), volta('2026-10-24', 'Super Kart', 'Traçado 1', 50000), volta('2026-10-24', 'Indoor', 'Traçado 2', 70000)];
const buscar = (query: string) => filtrarKarts(linhas, new URL('https://app.test/?' + query), ['2026-10-24', '2026-10-19', '2026-10-18']);

describe('filtros dos karts', () => {
  it('separa dia, semana de segunda a domingo e mês', () => {
    expect(buscar('periodo=dia').karts[0].corridas).toHaveLength(2);
    expect(buscar('periodo=semana')).toMatchObject({ de: '2026-10-19', ate: '2026-10-25' });
    expect(buscar('periodo=semana').karts[0].corridas).toHaveLength(3);
    expect(buscar('periodo=mes').karts[0].corridas).toHaveLength(4);
  });
  it('combina categoria e traçado antes de calcular melhor volta', () => {
    const resposta = buscar('periodo=mes&categoria=Indoor&tracado=Tra%C3%A7ado%201');
    expect(resposta.karts[0]).toMatchObject({ melhorMs: 60000, posVolta: 1 });
    expect(resposta.karts[0].corridas).toHaveLength(2);
  });
  it('permite datas históricas e retorna vazio quando não há combinação', () => {
    expect(buscar('dia=2026-10-18').karts[0].melhorMs).toBe(65000);
    expect(buscar('dia=2026-10-18&categoria=Super%20Kart').karts).toEqual([]);
  });
  it('rejeita datas e filtros inválidos', () => {
    for (const q of ['dia=2026-02-30', 'dia=abc', 'periodo=ano', 'categoria=foo']) expect(() => buscar(q)).toThrow();
  });
});
