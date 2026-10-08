import { describe, expect, it } from "vitest";
import {
  createSession,
  updateSessionParameters,
  sanitizarCompetidorDetalhes,
  parseNumeroOpcional,
  type Competitor,
} from "../lib/timing/race-engine";

describe("Tarefa 10 - Competidores, equipe, numéricos e prova por voltas", () => {
  it("equipe_transponder_roundtrip: salva e recupera equipe e equipeTransponders preservando posições", () => {
    // 1. Piloto com equipe e equipeTransponders correspondentes
    const detalhesEntrada = {
      equipe: ["Piloto 2", "Piloto 3"],
      equipeTransponders: ["99001", null],
    };

    const saneado = sanitizarCompetidorDetalhes(detalhesEntrada);
    expect(saneado?.equipe).toEqual(["Piloto 2", "Piloto 3"]);
    expect(saneado?.equipeTransponders).toEqual(["99001", null]);

    // 2. Compatibilidade com JSON legado (sem equipeTransponders)
    const legado = {
      equipe: ["Piloto 2", "Piloto 3"],
    };
    const saneadoLegado = sanitizarCompetidorDetalhes(legado);
    expect(saneadoLegado?.equipe).toEqual(["Piloto 2", "Piloto 3"]);
    expect(saneadoLegado?.equipeTransponders).toBeUndefined();
  });

  it("numerico_invalido_nao_e_gravado: texto inválido, peso negativo e lastro negativo são rejeitados; vazio e pontuação negativa aceitos", () => {
    // Vazio/null aceitos como null
    expect(parseNumeroOpcional("", "peso")).toBeNull();
    expect(parseNumeroOpcional(null, "peso")).toBeNull();
    expect(parseNumeroOpcional(undefined, "peso")).toBeNull();

    // Texto inválido "abc" deve disparar erro
    expect(() => parseNumeroOpcional("abc", "peso")).toThrow(/inválido/i);

    // Peso negativo deve disparar erro
    expect(() => parseNumeroOpcional(-10, "peso")).toThrow(/negativo/i);

    // Peso lastro negativo deve disparar erro
    expect(() => parseNumeroOpcional("-2,5", "pesoLastro")).toThrow(/negativo/i);

    // Pontuação negativa aceita normalmente (regra esportiva)
    expect(parseNumeroOpcional(-5, "pontuacao", true)).toBe(-5);
    expect(parseNumeroOpcional("-3,5", "pontuacao", true)).toBe(-3.5);

    // Teste integrado de sanitizarCompetidorDetalhes
    expect(() => sanitizarCompetidorDetalhes({ peso: "invalido" })).toThrow(/inválido/i);
    expect(() => sanitizarCompetidorDetalhes({ pesoLastro: -1 })).toThrow(/negativo/i);
    const valido = sanitizarCompetidorDetalhes({
      peso: "72.4",
      pesoIndumentaria: null,
      pesoLastro: "",
      pontuacao: "-10",
    });
    expect(valido?.peso).toBe(72.4);
    expect(valido?.pesoIndumentaria).toBeNull();
    expect(valido?.pesoLastro).toBeNull();
    expect(valido?.pontuacao).toBe(-10);
  });

  it("prova_por_voltas_nao_recebe20min: prova configurada por voltas mantém durationMs=0", () => {
    // Prova criada por voltas com durationMin = 0
    const sessao = createSession({
      id: "teste-voltas-1",
      name: "Final por Voltas",
      type: "corrida",
      durationMin: 0,
      maxLaps: 15,
      now: 1000,
    });
    expect(sessao.maxLaps).toBe(15);
    expect(sessao.durationMs).toBe(0);

    // Atualização de parâmetros para prova por voltas com durationMin = 0
    updateSessionParameters(sessao, { durationMin: 0, maxLaps: 20 }, 2000);
    expect(sessao.maxLaps).toBe(20);
    expect(sessao.durationMs).toBe(0);
  });
});
