import test from "node:test";
import assert from "node:assert/strict";
import {
  age,
  arrival,
  availability,
  calendarFile,
  cpfValid,
  isoDOB,
  maskPhone,
  safeInvoice,
  timestamp,
  validateCustomer,
} from "../src/model.js";
import worker from "../worker.js";

test("CPF rejects repeated digits and incorrect check digits", () => {
  assert.equal(cpfValid("529.982.247-25"), true);
  assert.equal(cpfValid("52998224724"), false);
  assert.equal(cpfValid("11111111111"), false);
});
test("birth date rejects impossible dates and handles leap years", () => {
  assert.equal(isoDOB("31/02/2000"), "");
  assert.equal(isoDOB("29/02/2001"), "");
  assert.equal(isoDOB("29/02/2000"), "2000-02-29");
});
test("adult age uses the birthday in Brasilia, including UTC day boundary", () => {
  assert.equal(age("2008-10-05", new Date("2026-10-05T02:30:00Z")), 17);
  assert.equal(age("2008-10-05", new Date("2026-10-05T03:00:00Z")), 18);
});
test("customer validation separates optional purchaser weight from driver requirements", () => {
  const customer = {
    documento: "52998224725",
    nome: "TESTE CODEX",
    telefone: "31999999999",
    nascimento: "01/01/1988",
    email: "",
    peso: "",
  };
  assert.deepEqual(validateCustomer(customer), {});
  assert.deepEqual(validateCustomer({ ...customer, peso: "140" }), {});
  assert.ok(validateCustomer({ ...customer, peso: "400" }).peso);
  assert.ok(
    validateCustomer({ ...customer, nascimento: "31/02/1988" }).nascimento,
  );
});
test("arrival is an hour before the start even across midnight", () => {
  assert.equal(arrival("2026-10-06T17:00"), "16:00");
  assert.equal(arrival("2026-10-06T00:30"), "23:30");
  assert.equal(
    timestamp("2026-10-06T17:00"),
    Date.parse("2026-10-06T20:00:00Z"),
  );
});
test("available slots respect sold-out state and actual booking cutoff", () => {
  const agenda = {
    antecedenciaMin: 120,
    horarios: [
      { id: 1, inicio: "2026-10-06T12:00", livres: 5 },
      { id: 2, inicio: "2026-10-06T14:00", livres: 0 },
      { id: 3, inicio: "2026-10-06T15:00", livres: 3 },
    ],
  };
  assert.deepEqual(
    availability(agenda, Date.parse("2026-10-06T13:00:00Z")).map((h) => h.id),
    [3],
  );
});
test("card payment URLs must use HTTPS on the actual Asaas domain", () => {
  assert.ok(safeInvoice("https://www.asaas.com/i/abc"));
  for (const url of [
    "javascript:alert(1)",
    "https://asaas.com.evil.example",
    "http://asaas.com/i/a",
    "https://evil.example/?asaas.com",
  ])
    assert.equal(safeInvoice(url), null);
});
test("phone mask keeps every digit and handles landline and mobile", () => {
  assert.equal(maskPhone("31999999999"), "(31) 99999-9999");
  assert.equal(maskPhone("3133334444"), "(31) 3333-4444");
});
test("calendar download starts at arrival, uses UTC and escapes the address comma", () => {
  const text = calendarFile({
    id: "test",
    codigo: "ABC234",
    inicio: "2026-10-06T17:00",
  });
  assert.ok(text.includes("DTSTART:20261006T190000Z"));
  assert.ok(text.includes("DTEND:20261006T203000Z"));
  assert.ok(text.includes("Flores\\, 477"));
});
test("frontend worker delegates all API requests intact to deployed cadastro service", async () => {
  const request = new Request(
    "https://preview.workers.dev/api/reservas?previa=test",
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-previa": "test" },
      body: '{"test":true}',
    },
  );
  let forwarded;
  const env = {
    LEGACY: {
      async fetch(r) {
        forwarded = r;
        return new Response("backend");
      },
    },
    ASSETS: {
      fetch() {
        throw new Error("API must not hit assets");
      },
    },
  };
  const response = await worker.fetch(request, env);
  assert.equal(await response.text(), "backend");
  assert.equal(
    forwarded.url,
    "https://reservas.kartodromodebetim.com.br/api/reservas?previa=test",
  );
  assert.equal(forwarded.method, "POST");
  assert.equal(forwarded.headers.get("x-previa"), "test");
  assert.equal(await forwarded.text(), '{"test":true}');
});
test("frontend worker delegates webhooks, sync endpoints and legacy assets", async () => {
  for (const path of [
    "/api/asaas/webhook",
    "/api/sync/reservas",
    "/logo.png",
    "/cadastro",
  ]) {
    let called = false;
    await worker.fetch(
      new Request(`https://reservas.kartodromodebetim.com.br${path}`),
      {
        LEGACY: {
          fetch() {
            called = true;
            return new Response("ok");
          },
        },
        ASSETS: {
          fetch() {
            throw new Error("Should delegate");
          },
        },
      },
    );
    assert.equal(called, true);
  }
});
test("frontend worker serves aliases without breaking query, HEAD or embed compatibility", async () => {
  for (const path of ["/", "/reservar", "/reservar.html"]) {
    let served;
    const response = await worker.fetch(
      new Request(
        `https://reservas.kartodromodebetim.com.br${path}?previa=test`,
        { method: "HEAD" },
      ),
      {
        ASSETS: {
          fetch(r) {
            served = r;
            return new Response(null);
          },
        },
      },
    );
    assert.equal(new URL(served.url).pathname, "/index.html");
    assert.equal(served.method, "HEAD");
    assert.equal(new URL(served.url).search, "?previa=test");
    assert.equal(response.headers.get("cache-control"), "no-cache");
    assert.equal(response.headers.has("x-frame-options"), false);
  }
});
