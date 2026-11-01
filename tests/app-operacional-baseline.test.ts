import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

// Congela o comportamento atual. BASELINE_ROOT aponta para uma cópia da produção; sem ele, usa este repositório.
const raiz = process.env.BASELINE_ROOT ?? resolve(__dirname, '..');
const motor = () => import(/* @vite-ignore */ pathToFileURL(resolve(raiz, 'lib/timing/race-engine.ts')).href);
const sorteioMod = () => import(/* @vite-ignore */ pathToFileURL(resolve(raiz, 'lib/timing/sorteio.ts')).href);

describe('baseline do App Operacional', () => {
  let e: any;
  let so: any;
  let servidor: string;
  let ops: string;

  beforeAll(async () => {
    e = await motor();
    so = await sorteioMod();
    servidor = readFileSync(resolve(raiz, 'services/timing-server.ts'), 'utf8');
    ops = readFileSync(resolve(raiz, 'services/ops-server.ts'), 'utf8');
  });

  const nova = (id = 's', programaId?: string) => {
    const s = e.createSession({
      id, name: id, type: 'corrida', durationMin: 20, now: 0,
      competitors: [{ kart: '4', name: 'Ana', customerId: '10' }, { kart: '5', name: 'Bia', customerId: '11' }],
    });
    if (programaId) s.programaId = programaId;
    return s;
  };
  const voltas = (s: any, kart: string, base: number) => {
    for (let i = 0; i < 3; i++) e.applyPassing(s, { id: `${kart}-${base}-${i}`, kart, decoderTimeMs: base + i * 60_000, wallMs: base + i * 60_000 });
  };
  const linha = (s: any, kart: string) => e.computeStandings(s).find((x: any) => x.kart === kart);

  // leitura do código: o servidor inteiro não sobe sem as dependências da produção; a correção vai na rota nova
  it('preparar hoje não filtra aprovada nem pago (bug documentado)', () => {
    const ini = servidor.indexOf("agenda\\/(\\d+)\\/preparar");
    const trecho = servidor.slice(ini, servidor.indexOf('createSession', ini));
    expect(trecho).toContain('/grid`');
    expect(trecho).not.toMatch(/aprovada|\.pago/);
    expect(ops).toMatch(/i\.Pago pago, i\.Aprovada aprovada/);
  });

  it('sorteio recusa lista alterada e bateria já largada', () => {
    const s = nova();
    expect(() => so.validarSorteio(s, [{ indice: 0, kart: '7', nome: 'Outra', customerId: '99' }, { indice: 1, kart: '8' }], new Set(['7', '8']))).toThrow(so.ListaMudouError);
    e.startSession(s, 1);
    expect(() => so.validarSorteio(s, [{ indice: 0, kart: '7' }], new Set(['7']))).toThrow(/já largou/);
  });

  it('swap-kart com manterVoltas leva voltas e melhor tempo', () => {
    const s = nova();
    e.startSession(s, 1);
    voltas(s, '4', 1000);
    const antes = linha(s, '4');
    const t = e.swapKart(s, { fromKart: '4', toKart: '8', customerId: '10', manterVoltas: true });
    expect(t.de).toBe('4');
    expect(linha(s, '8').laps).toBe(antes.laps);
    expect(linha(s, '8').bestLapMs).toBe(antes.bestLapMs);
  });

  it('swap-kart sem manterVoltas recomeça no kart novo', () => {
    const s = nova();
    e.startSession(s, 1);
    voltas(s, '4', 1000);
    const t = e.swapKart(s, { fromKart: '4', toKart: '8', customerId: '10', manterVoltas: false });
    expect(t.voltasLevadas).toBe(0);
    expect(linha(s, '8').laps).toBe(0);
  });

  it('swap-kart absorve as passagens de kart sem piloto e tira a linha dele', () => {
    const s = nova();
    e.startSession(s, 1);
    voltas(s, '4', 1000);
    voltas(s, '12', 500_000);
    expect(s.competitors.some((c: any) => c.kart === '12' && c.autoAdded)).toBe(true);
    e.swapKart(s, { fromKart: '4', toKart: '12', customerId: '10' });
    expect(s.competitors.filter((c: any) => c.kart === '12')).toHaveLength(1);
    expect(s.competitors.find((c: any) => c.kart === '12').name).toBe('Ana');
    expect(linha(s, '12').laps).toBeGreaterThan(2);
  });

  it('swap-kart recusa kart com outro piloto', () => {
    const s = nova();
    e.startSession(s, 1);
    expect(() => e.swapKart(s, { fromKart: '4', toKart: '5', customerId: '10' })).toThrow(/já está com Bia/);
  });

  it('a troca propaga à prova irmã que ainda não largou', () => {
    const a = nova('a', 'p');
    const b = nova('b', 'p');
    e.startSession(a, 1);
    e.swapKart(a, { fromKart: '4', toKart: '8', customerId: '10' });
    expect(e.propagarTrocaKart(a, b, '4', '8', '10')).toBe(true);
    expect(b.competitors.find((c: any) => c.customerId === '10').kart).toBe('8');
  });

  it('duas penalidades iguais criam dois registros: repetir duplica o efeito', () => {
    const s = nova();
    e.addPenalty(s, '4', { id: 'x1', tipo: 'tempo', segundos: 5, wallMs: 1 });
    e.addPenalty(s, '4', { id: 'x2', tipo: 'tempo', segundos: 5, wallMs: 1 });
    expect(s.competitors.find((c: any) => c.kart === '4').penalidades).toHaveLength(2);
  });

  it('pela internet, só leitura em lista fechada', () => {
    expect(servidor).toContain("Acesso só pela rede do kartódromo.");
    expect(servidor).toMatch(/veioDaInternet\(req\) && !\(\(req\.method === 'GET' \|\| req\.method === 'HEAD'\) && isAllowedPublicReadPath/);
  });

  it('bateria sem agenda mantém os competidores como vieram', () => {
    const s = nova();
    expect(s.agendaId ?? null).toBeNull();
    expect(s.competitors.map((c: any) => c.name)).toEqual(['Ana', 'Bia']);
  });
});
