import { describe, expect, it } from 'vitest';
import { filtrarKarts, type VoltaKart } from '../../workers/pre-cadastro/src/mobile/karts';

const volta = (dia: string, categoria: string, tracado: string, ms: number, kart = categoria === 'Super Kart' ? '108' : '8'): VoltaKart => ({ dia, categoria, tracado, ms, kart, inicio: Date.parse(dia + 'T18:00:00Z'), pos: 2, piloto: 'TESTE CODEX', bateria: 'TESTE CODEX', de: 10 });
const linhas = [
  volta('2026-10-18', 'Indoor', 'Traçado 1', 75000),
  volta('2026-10-19', 'Indoor', 'Traçado 1', 72000),
  volta('2026-10-19', 'Indoor', 'Traçado 1', 61000), // corte: Indoor não faz menos de 1:10 no Traçado 1
  volta('2026-10-24', 'Super Kart', 'Traçado 1', 66000),
  volta('2026-10-24', 'Indoor', 'Traçado 2', 70000),
  volta('2026-10-24', 'Indoor', 'Traçado 1', 65000, '120'), // categoria errada no cadastro: kart 120 é Super Kart
];
const buscar = (query: string) => filtrarKarts(linhas, new URL('https://app.test/?' + query), ['2026-10-24', '2026-10-19', '2026-10-18']);
const kart = (r: ReturnType<typeof buscar>, k: string) => r.karts.find((x) => x.kart === k);

describe('filtros dos karts', () => {
  it('separa dia, semana de segunda a domingo e mês', () => {
    expect(buscar('periodo=dia').karts).toHaveLength(3);
    expect(buscar('periodo=semana')).toMatchObject({ de: '2026-10-19', ate: '2026-10-25' });
    expect(kart(buscar('periodo=semana'), '8')?.corridas).toHaveLength(3);
    expect(kart(buscar('periodo=mes'), '8')?.corridas).toHaveLength(4);
  });
  it('combina categoria e traçado antes de calcular melhor volta', () => {
    const resposta = buscar('periodo=mes&categoria=Indoor&tracado=Tra%C3%A7ado%201');
    expect(resposta.karts).toHaveLength(1);
    expect(resposta.karts[0]).toMatchObject({ kart: '8', melhorMs: 72000, posVolta: 1 });
    expect(resposta.karts[0].corridas).toHaveLength(3);
  });
  it('a categoria vem do número do kart, nunca mistura Indoor e Super Kart', () => {
    const indoor = buscar('periodo=mes&categoria=Indoor').karts.map((k) => k.kart);
    const superKart = buscar('periodo=mes&categoria=Super%20Kart').karts.map((k) => k.kart);
    expect(indoor).toEqual(['8']);
    expect(superKart.sort()).toEqual(['108', '120']);
    expect(kart(buscar('periodo=mes&categoria=Super%20Kart'), '120')?.melhorMs).toBe(65000);
  });
  it('descarta volta abaixo do mínimo do Traçado 1 (Indoor 1:10, Super Kart 1:04)', () => {
    const corridas = kart(buscar('dia=2026-10-19'), '8')!.corridas;
    expect(corridas.map((c) => c.ms).sort()).toEqual([72000, null]);
  });
  it('permite datas históricas e retorna vazio quando não há combinação', () => {
    expect(buscar('dia=2026-10-18').karts[0].melhorMs).toBe(75000);
    expect(buscar('dia=2026-10-18&categoria=Super%20Kart').karts).toEqual([]);
  });
  it('rejeita datas e filtros inválidos', () => {
    for (const q of ['dia=2026-02-30', 'dia=abc', 'periodo=ano', 'categoria=foo']) expect(() => buscar(q)).toThrow();
  });
});
