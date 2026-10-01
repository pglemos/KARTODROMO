import { describe, expect, it } from 'vitest';
import type { Competitor, Session, Standing } from '../lib/timing/race-engine';
import { assunto, destinatarios, emailValido, htmlEmail, htmlPdfVoltaAVolta, nomeArquivo, tempo, textoEmail, voltasDoPiloto, type ContextoProva } from '../lib/timing/email-resultado';

const comp = (kart: string, name: string, extra: Partial<Competitor> = {}): Competitor => ({ kart, name, crossings: [], finished: false, ...extra });
const sessao = (competitors: Competitor[]): Session => ({ id: 's1', name: 'BATERIA 17:00 · CORRIDA', type: 'corrida', durationMs: 0, maxLaps: null, minLapMs: 0, state: 'encerrada', createdAt: 0, startedAt: 0, checkeredAt: null, finishedAt: 0, competitors });
const st = (position: number, kart: string, name: string, extra: Partial<Standing> = {}): Standing => ({ position, kart, name, category: null, laps: 10, lastLapMs: 60_000, bestLapMs: 55_214, bestLapNumber: 4, totalMs: 602_470, averageSpeedKmh: null, gapMs: position === 1 ? null : 1_250, gapLaps: 0, finished: true, autoAdded: false, lastCrossingWallMs: null, ...extra });

const ctx: ContextoProva = {
  empresa: { nome: 'Kartódromo Internacional de Betim', telefone: '(31) 3333-3333' },
  evento: 'Baterias 29/09/2026', grupo: 'BATERIA 17:00', prova: 'CORRIDA', tipo: 'corrida', tracado: 'Traçado 1', quando: Date.UTC(2026, 8, 29, 20, 0),
  classificacao: [st(1, '07', 'MARIA SOUZA'), st(2, '12', 'JOÃO <SILVA>', { gapLaps: 1 })],
};

describe('e-mail do resultado', () => {
  it('formata tempos como a cronometragem', () => {
    expect(tempo(55_214)).toBe('55.214');
    expect(tempo(62_470)).toBe('1:02.470');
    expect(tempo(3_723_004)).toBe('1:02:03.004');
    expect(tempo(null)).toBe('—');
  });

  it('volta a volta: ignora apagadas e a passagem de largada, marca a melhor válida e as anuladas', () => {
    const c = comp('07', 'Maria', {
      crossings: [
        { decoderTimeMs: 0, wallMs: 1000, lapMs: null },
        { decoderTimeMs: 0, wallMs: 2000, lapMs: 61_000 },
        { decoderTimeMs: 0, wallMs: 3000, lapMs: 50_000, invalid: true },
        { decoderTimeMs: 0, wallMs: 4000, lapMs: 58_000, deleted: true },
        { decoderTimeMs: 0, wallMs: 5000, lapMs: 59_500 },
      ],
    });
    const v = voltasDoPiloto(c);
    expect(v.map((x) => x.numero)).toEqual([1, 2, 3]);
    expect(v[1].anulada).toBe(true);
    expect(v.find((x) => x.melhor)?.ms).toBe(59_500); // a anulada (50 s) não vale como melhor
  });

  it('destinatários: só piloto de verdade com e-mail válido (cadastro da recepção ou do competidor)', () => {
    const s = sessao([
      comp('07', 'Maria', { customerId: '10' }),
      comp('12', 'João', { detalhes: { email: 'JOAO@EXEMPLO.COM ' } }),
      comp('15', 'Kart 15', { autoAdded: true, customerId: '11' }),
      comp('20', 'Sem email', { customerId: '12' }),
      comp('21', 'Oculto', { customerId: '13', detalhes: { oculto: true } }),
      comp('22', 'Email ruim', { detalhes: { email: 'fulano@' } }),
    ]);
    const mapa = new Map([['10', 'maria@exemplo.com'], ['11', 'kart@exemplo.com'], ['13', 'oculto@exemplo.com']]);
    expect(destinatarios(s, mapa).map((d) => `${d.competidor.kart}:${d.email}`)).toEqual(['07:maria@exemplo.com', '12:joao@exemplo.com']);
    expect(emailValido('a@b.com')).toBe(true);
    expect(emailValido('a b@c.com')).toBe(false);
  });

  it('corpo do e-mail: nome, posição, dados da prova e classificação com escape de HTML', () => {
    const p = { nome: 'MARIA SOUZA', kart: '07', email: 'maria@exemplo.com', standing: ctx.classificacao[0], voltas: [] };
    const html = htmlEmail(ctx, p, 'logo-kartodromo');
    expect(html).toContain('Olá, Maria!');
    expect(html).toContain('1º de 2');
    expect(html).toContain('55.214');
    expect(html).toContain('BATERIA 17:00');
    expect(html).toContain('Traçado 1');
    expect(html).toContain('João &lt;Silva&gt;'); // nome próprio na exibição (lib/nomes)
    expect(html).toContain('+1 volta');
    expect(html).toContain('cid:logo-kartodromo');
    expect(textoEmail(ctx, p)).toContain('Posição: 1º de 2');
    expect(assunto(ctx)).toBe('Resultado oficial · BATERIA 17:00 · CORRIDA | Kartódromo Internacional de Betim');
  });

  it('PDF do volta a volta traz o piloto e as voltas', () => {
    const p = { nome: 'MARIA SOUZA', kart: '07', email: 'm@e.com', standing: ctx.classificacao[0], voltas: [{ numero: 1, ms: 56_000, anulada: false, melhor: false, hora: 0 }, { numero: 2, ms: 55_214, anulada: false, melhor: true, hora: 0 }] };
    const html = htmlPdfVoltaAVolta(ctx, p, null);
    expect(html).toContain('Maria Souza · kart 07 · 1º lugar');
    expect(html).toContain('melhor volta');
    expect(html).toContain('+0.786');
    expect(nomeArquivo('Volta a volta João kart 07')).toBe('Volta-a-volta-Joao-kart-07');
  });
});
