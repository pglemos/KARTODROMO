import test from "node:test";
import assert from "node:assert/strict";
import { calendarEvent } from "../src/calendar.mjs";
import { championships } from "../src/data.js";
test("calendário usa dia inteiro e término exclusivo, sem inventar horário da prova", () => {
  const event = calendarEvent(championships[0]);
  assert.match(event, /DTSTART;VALUE=DATE:20261025\r\n/);
  assert.match(event, /DTEND;VALUE=DATE:20261026\r\n/);
  assert.match(
    event,
    /URL:https:\/\/kartodromodebetim.com.br\/100-milhas-light/,
  );
  assert.doesNotMatch(event, /DTSTART;TZID/);
});
test("temporadas mensais sem data confirmada não geram evento", () => {
  assert.equal(calendarEvent(championships.find((c) => c.id === "kac")), null);
  assert.equal(
    calendarEvent(championships.find((c) => c.id === "kac-super")),
    null,
  );
});
test("calendário trata virada de ano e escapa textos conforme formato ICS", () => {
  const event = calendarEvent({
    id: "teste",
    date: "31/12/2026",
    name: "Teste, equipe; Betim",
    intro: "Duas linhas\nOlá",
  });
  assert.match(event, /DTEND;VALUE=DATE:20270101/);
  assert.match(event, /SUMMARY:Teste\\, equipe\\; Betim/);
  assert.match(event, /Duas linhas\\nOlá/);
});
test("linhas ICS respeitam 75 bytes e preservam caracteres UTF-8", () => {
  const event = calendarEvent(championships[1]);
  for (const line of event.split("\r\n"))
    assert.ok(Buffer.byteLength(line, "utf8") <= 75);
  const unfolded = event.replace(/\r\n /g, "");
  assert.match(unfolded, /Uma prova decidida em cada detalhe/);
});
