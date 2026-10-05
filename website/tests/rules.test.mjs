import test from "node:test";
import assert from "node:assert/strict";
import {
  validCPF,
  validatePilots,
  registrationPayload,
} from "../src/registration.mjs";
import { championships, registrationStatus } from "../src/data.js";
const light = championships[0],
  endurance = championships[1];
test("inscrições respeitam abertura em Brasília e fechamento inclusive", () => {
  assert.equal(
    registrationStatus(endurance, Date.parse("2026-10-05T12:59:59Z")),
    "soon",
  );
  assert.equal(
    registrationStatus(endurance, Date.parse("2026-10-05T13:00:00Z")),
    "open",
  );
  assert.equal(
    registrationStatus(light, Date.parse("2026-10-16T03:00:00Z")),
    "closed",
  );
  assert.equal(registrationStatus(championships[4]), "past");
});
test("CPF rejeita repetição, tamanho e dígitos verificadores inválidos", () => {
  assert.equal(validCPF("00000000000"), false);
  assert.equal(validCPF("123"), false);
  assert.equal(validCPF("52998224726"), false);
  assert.equal(validCPF("529.982.247-25"), true);
});
test("requisitos das provas diferem por idade e mínimo de pilotos", () => {
  const p = { nome: "TESTE CODEX A", idade: 13, altura: 1.7, peso: 65 };
  assert.equal(validatePilots([[p]], light).length, 1);
  assert.equal(
    validatePilots([[p, { ...p, nome: "TESTE CODEX B" }]], endurance).length,
    0,
  );
  assert.ok(validatePilots([[p]], endurance).length);
  assert.ok(
    validatePilots([[{ ...p, idade: 15, altura: 1.5, peso: 50 }]], light)
      .length === 2,
  );
});
test("pilotos duplicados e limite de três por kart light são recusados", () => {
  const p = { nome: "TESTE CODEX A", idade: 20, altura: 1.7, peso: 65 };
  assert.match(validatePilots([[p, p]], light).join(" "), /já foi/);
  assert.match(
    validatePilots(
      [
        [
          p,
          { ...p, nome: "Bbb" },
          { ...p, nome: "Ccc" },
          { ...p, nome: "Ddd" },
        ],
      ],
      light,
    ).join(" "),
    /3 pilotos/,
  );
});
test("payload mantém contrato existente e todas as medidas nos dados da inscrição", () => {
  const d = {
    equipe: "TESTE CODEX",
    nome: "TESTE CODEX",
    whatsapp: "31999999999",
    email: "teste@example.com",
    cidade: "Betim",
    regulamento: "on",
    responsabilidade: "on",
    pagamento: "Pix",
  };
  const p = registrationPayload(light, d, [
    [{ nome: " TESTE CODEX A ", idade: 20, altura: 1.7, peso: 65 }],
  ]);
  assert.equal(p.modalidade, "equipe");
  assert.equal(p.campeonato_id, "100-milhas-light");
  assert.equal(p.quantidadeKarts, 1);
  assert.deepEqual(p.pilotos, [{ nome: "TESTE CODEX A", peso_kg: 65 }]);
  assert.ok(p.observacoes.includes("20 anos"));
  assert.equal(p.acceptedRules, true);
  assert.equal(p.acceptedImage, false);
  const individual = registrationPayload(championships[2], d, []);
  assert.equal(individual.modalidade, "individual");
  assert.equal(individual.fullName, "TESTE CODEX");
  assert.equal(individual.campeonato_id, "kac-iniciantes");
});
