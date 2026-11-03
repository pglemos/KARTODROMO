import { describe, expect, it } from 'vitest';
import { parseTrxLine } from '../lib/timing/trx-parser';
import { sanitizarNomeDestinatario, validarEmailDestinatario } from '../services/timing-email';
import { computeStandings, createSession, startSession } from '../lib/timing/race-engine';
import { REGRAS_100_MILHAS, analisarCorrida, type VoltaCrono } from '../lib/ops/endurance-regras';

describe('33 Items Round 2 - Test Suite', () => {
  it('Item 33: TRX parser filtra ruídos alfa e caracteres inválidos em campos numéricos', () => {
    // Linha válida
    const validLine = '\u0001$\t01\t0001\t001234\t00000000\t00:01:05.123\t0040\t0100\r\n';
    const parsed = parseTrxLine(validLine);
    expect(parsed.kind).toBe('passing');
    if (parsed.kind === 'passing') {
      expect(parsed.transponder).toBe(0x1234);
    }

    // Linha com ruído eletromagnético corrompendo dígitos com letras ou símbolos
    const noisyLine = '\u0001$\t01\t0001\t0012X4\t00000000\t00:01:05.123\t0040\t0100\r\n';
    const parsedNoise = parseTrxLine(noisyLine);
    expect(parsedNoise.kind).toBe('other');
  });

  it('Item 28: Sanitização RFC 2822 em nomes e e-mails de destinatários', () => {
    const nomeComAspas = 'Piloto "Super", Kartista';
    const sanitizado = sanitizarNomeDestinatario(nomeComAspas);
    expect(sanitizado).toBe('Piloto Super Kartista');

    const emailValido = '  PILOTO.123@GMAIL.COM  ';
    expect(validarEmailDestinatario(emailValido)).toBe('piloto.123@gmail.com');

    const emailInvalido = 'piloto@@gmail..com';
    expect(validarEmailDestinatario(emailInvalido)).toBeNull();
  });

  it('Item 29: Desempate em treino livre sem voltas válidas (ordem estável por número do kart)', () => {
    const s = createSession({
      id: 'treino-sem-voltas',
      name: 'Treino Livre',
      type: 'treino',
      durationMin: 10,
      minLapSec: 5,
      now: Date.now(),
      competitors: [
        { kart: '15', name: 'Piloto B' },
        { kart: '03', name: 'Piloto A' },
      ],
    });
    startSession(s, Date.now());
    const standings = computeStandings(s);
    expect(standings.length).toBe(2);
    expect(standings[0].laps).toBe(0);
    expect(standings[1].laps).toBe(0);
    // Em treino sem voltas, critério desportivo estável por número de kart crescente
    expect(standings.map((r) => r.kart)).toEqual(['03', '15']);
  });

  it('Item 24: Endurance ignora volta lenta sob bandeira amarela ou safety car para parada de box', () => {
    const voltasEquipe: VoltaCrono[] = [
      { lap: 1, lapMs: 60_000, wallMs: 1_000_000 },
      { lap: 2, lapMs: 61_000, wallMs: 1_061_000 },
      // Volta 3 foi lenta (120s) devido a bandeira amarela, não foi box nem teve troca de kart
      { lap: 3, lapMs: 120_000, wallMs: 1_181_000, underYellow: true, flag: 'yellow' },
      { lap: 4, lapMs: 60_500, wallMs: 1_241_500 },
    ];

    const analise = analisarCorrida({
      regras: REGRAS_100_MILHAS,
      sessao: { startedAt: 1_000_000, elapsedMs: 300_000, durationMs: 150 * 60_000, state: 'em_andamento' },
      equipes: [{ id: 1, numero: '10', nome: 'Equipe Teste' }],
      voltas: new Map([['10', voltasEquipe]]),
      trocas: [],
      punicoes: [],
      ajustes: [],
      agoraMs: 1_300_000,
    });

    const eq = analise.equipes[0];
    expect(eq.paradas.length).toBe(0); // A volta sob bandeira amarela NÃO foi contada como parada no box!
  });
});
