import { describe, it, expect } from 'vitest';
import { P3FrameSplitter, parseP3Frame } from '../lib/timing/p3-parser';
import {
  createSession,
  applyPassing,
  computeStandings,
  updateSessionParameters,
  setRaceFlag,
  restartSession,
  addPenalty,
} from '../lib/timing/race-engine';

describe('Validação dos 33 Itens de Cronometragem', () => {
  describe('Grupo I: Protocolo P3 e Decoder', () => {
    it('Item 1: P3FrameSplitter não confunde byte escapado 0x8D 0xAF com fim de frame', () => {
      const splitter = new P3FrameSplitter();
      // Frame com payload contendo 0x8D 0xAF (que representa 0x8F escapado no meio do corpo)
      const raw = Buffer.from([
        0x8e, // SOR
        0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, // header
        0x03, 0x04, 0x8d, 0xaf, 0x00, 0x00, // campo com byte escapado
        0x8f, // verdadeiro EOR
      ]);
      const frames = splitter.push(raw);
      expect(frames).toHaveLength(1);
      // O corpo desescapado deve conter 0x8F (0xAF - 0x20 = 0x8F)
      expect(frames[0]).toContain(0x8f);
    });

    it('Item 2: P3FrameSplitter preserva o último SOR quando o buffer excede 64KB', () => {
      const splitter = new P3FrameSplitter();
      // Envia 70KB de ruído sem SOR
      splitter.push(Buffer.alloc(70_000, 0x00));
      // Envia um frame válido completo com SOR
      // Quadro: 0x8E <versão u8> <tamanho u16> <crc u16> <flags u16> <tipo u16 = 0x0002> <campos...> 0x8F
      const validFrame = Buffer.from([
        0x8e,
        0x01, // versao
        0x05, 0x00, // tamanho
        0x00, 0x00, // crc
        0x00, 0x00, // flags
        0x02, 0x00, // tipo: 0x0002 status
        0x01, 0x02, 0x10, 0x00, // campo 0x01 ruido u16 = 16
        0x8f,
      ]);
      const frames = splitter.push(validFrame);
      expect(frames).toHaveLength(1);
      const parsed = parseP3Frame(frames[0]);
      expect(parsed.kind).toBe('status');
      if (parsed.kind === 'status') {
        expect(parsed.noise).toBe(16);
      }
    });

    it('Item 6: updateSessionParameters aceita minLapSec e valida valores positivos', () => {
      const s = createSession({ id: 's1', name: 'Treino', type: 'treino', durationMin: 10, now: 1000 });
      expect(s.minLapMs).toBe(5000);

      updateSessionParameters(s, { minLapSec: 25 }, 2000);
      expect(s.minLapMs).toBe(25000);

      expect(() => updateSessionParameters(s, { minLapSec: -5 }, 3000)).toThrow(/maior que zero/);
    });
  });

  describe('Grupo VI: Motor de Cronometragem e Casos de Borda', () => {
    it('Item 28: Classificação desempata usando RTC de alta resolução do TranX P3 antes do wallMs', async () => {
      const { startSession } = await import('../lib/timing/race-engine');
      const s = createSession({ id: 'q1', name: 'Tomada', type: 'classificacao', durationMin: 10, now: 1000 });
      startSession(s, 1000);

      // Kart 10 e Kart 20 fazem rigorosamente a mesma melhor volta de 45.000 ms
      // Kart 10 teve decoderTimeMs = 500.000, mas wallMs gravado no Windows com atraso (1.502.000)
      // Kart 20 teve decoderTimeMs = 501.000, com wallMs adiantado no Windows (1.501.000)
      applyPassing(s, { kart: '10', decoderTimeMs: 455_000, wallMs: 1_457_000 });
      applyPassing(s, { kart: '20', decoderTimeMs: 456_000, wallMs: 1_456_000 });

      applyPassing(s, { kart: '10', decoderTimeMs: 500_000, wallMs: 1_502_000 }); // volta 45.000 ms (RTC anterior: 500.000)
      applyPassing(s, { kart: '20', decoderTimeMs: 501_000, wallMs: 1_501_000 }); // volta 45.000 ms (RTC posterior: 501.000)

      const standings = computeStandings(s);
      expect(standings).toHaveLength(2);
      expect(standings[0].kart).toBe('10'); // P1 pelo RTC do decoder
      expect(standings[1].kart).toBe('20'); // P2
      expect(standings[0].bestLapMs).toBe(45_000);
      expect(standings[1].bestLapMs).toBe(45_000);
    });

    it('Item 29: Cálculo de gap não zera nem oculta diferença quando há penalidade', async () => {
      const { startSession } = await import('../lib/timing/race-engine');
      const s = createSession({ id: 'r1', name: 'Corrida', type: 'corrida', durationMin: 10, now: 1000 });
      startSession(s, 1000);

      // Kart 1 cruza 1s na frente na pista, mas tem 5s de penalidade
      // Kart 2 cruza 1s depois, sem penalidade
      applyPassing(s, { kart: '1', decoderTimeMs: 10_000, wallMs: 10_000 });
      applyPassing(s, { kart: '2', decoderTimeMs: 11_000, wallMs: 11_000 });

      applyPassing(s, { kart: '1', decoderTimeMs: 55_000, wallMs: 55_000 });
      applyPassing(s, { kart: '2', decoderTimeMs: 56_000, wallMs: 56_000 });

      addPenalty(s, '1', { tipo: 'tempo', segundos: 5, texto: 'Toque' });

      const standings = computeStandings(s);
      expect(standings[0].kart).toBe('2'); // Kart 2 líder após penalidade do Kart 1
      expect(standings[1].kart).toBe('1');
      // Gap do Kart 1 para o líder (Kart 2) deve ser +4.000 s (+5s penalidade - 1s na pista)
      expect(standings[1].gapMs).toBe(4_000);
    });

    it('Item 30: Bandeira vermelha preserva originalStartedAt após retomada', async () => {
      const { startSession } = await import('../lib/timing/race-engine');
      const s = createSession({ id: 'r2', name: 'Corrida', type: 'corrida', durationMin: 15, now: 1000 });
      startSession(s, 1000);

      applyPassing(s, { kart: '5', decoderTimeMs: 2000, wallMs: 2000 }); // largada real aos 2000ms
      expect(s.startedAt).toBe(2000);
      expect(s.originalStartedAt).toBe(2000);

      // Bandeira vermelha aos 5000ms (3s de prova)
      setRaceFlag(s, 'red', 5000);
      // Retomada aos 10000ms (ficou 5s parada)
      setRaceFlag(s, 'green', 10000);

      // startedAt foi deslocado para 7000ms para manter o tempo de prova ativo (3s até 10000ms)
      expect(s.startedAt).toBe(7000);
      // originalStartedAt permanece 2000ms intacto para relatórios e carimbos
      expect(s.originalStartedAt).toBe(2000);

      // Reiniciar zera ambos
      restartSession(s);
      expect(s.startedAt).toBeNull();
      expect(s.originalStartedAt).toBeNull();
    });
  });
});
