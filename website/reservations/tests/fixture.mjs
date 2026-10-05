import { readFile } from "node:fs/promises";
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const dates = Array.from({ length: 70 }, (_, i) =>
  new Date(Date.parse(`${tomorrow}T12:00:00Z`) + i * 86400000)
    .toISOString()
    .slice(0, 10),
);
const fixture = {
  atualizadoEm: new Date().toISOString(),
  precoCentavos: 14500,
  maxPilotos: 10,
  prazoMin: 15,
  antecedenciaMin: 120,
  pagamentoOnline: true,
  horarios: dates.flatMap((d, i) =>
    [
      "17:00",
      "17:35",
      "18:10",
      "18:45",
      "19:20",
      "19:55",
      "20:30",
      "21:05",
      "21:40",
    ].map((time, j) => ({
      id: 60 + i * 9 + j,
      inicio: `${d}T${time}`,
      nome: `TESTE CODEX ${time}`,
      livres: 30,
    })),
  ),
};
export const agenda = process.env.RESERVATIONS_AGENDA_FIXTURE
  ? JSON.parse(await readFile(process.env.RESERVATIONS_AGENDA_FIXTURE, "utf8"))
  : fixture;
