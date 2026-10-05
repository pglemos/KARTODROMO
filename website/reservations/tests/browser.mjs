import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const out = "/tmp/kart-audit/reservations-new";
await mkdir(out, { recursive: true });
import { agenda } from "./fixture.mjs";
const id = "12345678-1234-4234-8234-123456789abc";
const baseOrder = {
  id,
  codigo: "ABC234",
  forma: "pix",
  quantidade: 2,
  nome: "TESTE",
  inicio: agenda.horarios[0].inicio,
  valorCentavos: agenda.precoCentavos * 2,
  expiraEm: new Date(Date.now() + 900000).toISOString(),
  pix: null,
  invoiceUrl: null,
  preparandoPagamento: false,
  erro: null,
};
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const report = { layouts: [], accessibility: [], workflows: [], errors: [] };
async function inspect(page, label, width, axe = false) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    `${label} ${width} overflow`,
  );
  assert.deepEqual(
    await page.evaluate(() =>
      [...document.images]
        .filter((i) => i.offsetWidth && (!i.complete || i.naturalWidth === 0))
        .map((i) => i.src),
    ),
    [],
    `${label} images`,
  );
  report.layouts.push({ label, width, overflow: false });
  await page.screenshot({
    path: `${out}/${label}-${width}.png`,
    fullPage: true,
  });
  if (axe) {
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const violations = result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    }));
    report.accessibility.push({ label, width, violations });
  }
}
function listen(page) {
  page.on("pageerror", (e) => report.errors.push(e.message));
}
for (const width of [1440, 768, 390, 320]) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  listen(page);
  let posts = [],
    currentOrder = { ...baseOrder, status: "novo" };
  await page.route("**/api/**", async (route) => {
    assert.equal(
      new URL(route.request().url()).origin,
      "http://127.0.0.1:5174",
    );
    if (route.request().method() === "POST") {
      posts.push(route.request().postDataJSON());
      await route.fulfill({ status: 201, json: { id, codigo: "ABC234" } });
    } else if (route.request().url().includes("/api/reservas/"))
      await route.fulfill({ json: currentOrder });
    else await route.fulfill({ json: agenda });
  });
  await page.goto("http://127.0.0.1:5174");
  await page.locator(".time-option").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await inspect(page, "agenda", width, width === 1440 || width === 390);
  assert.equal(
    await page
      .getByRole("button", { name: "Continuar", exact: true })
      .isDisabled(),
    true,
  );
  if (width <= 600) await page.locator(".date-picker > summary").click();
  const originalDate = await page
    .locator(".calendar-days button.selected")
    .getAttribute("data-calendar-date");
  await page.locator(".calendar-days button.selected").focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(
    (value) =>
      document.activeElement?.getAttribute("data-calendar-date") !== value,
    originalDate,
  );
  assert.notEqual(
    await page.locator(":focus").getAttribute("data-calendar-date"),
    originalDate,
  );
  await page.getByRole("button", { name: "Próximo mês" }).click();
  await page.getByRole("button", { name: "Mês anterior" }).click();
  assert.equal(
    await page
      .locator(".calendar-days button.selected")
      .getAttribute("data-calendar-date"),
    originalDate,
  );
  await page.locator(".time-option").first().click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar um piloto" }).click();
  assert.equal(await page.locator("output").innerText(), "2");
  await inspect(page, "pilotos", width, width === 1440 || width === 390);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  assert.equal(
    await page.locator("#documento").getAttribute("aria-invalid"),
    "true",
  );
  await page.locator("#nome").fill("TESTE CODEX");
  await page.locator("#documento").fill("52998224725");
  await page.locator("#telefone").fill("31999999999");
  await page.locator("#nascimento").fill("31021988");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  assert.equal(
    await page.locator("#nascimento").getAttribute("aria-invalid"),
    "true",
  );
  await page.locator("#nascimento").fill("01011988");
  await inspect(page, "cadastro", width, width === 1440 || width === 390);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await inspect(page, "revisao", width, width === 1440 || width === 390);
  if (width === 1440 || width === 390) {
    assert.equal(
      await page.getByRole("button", { name: /Reservar e pagar/ }).isDisabled(),
      true,
    );
    await page.getByRole("checkbox").nth(0).check();
    await page.getByRole("checkbox").nth(1).check();
    await page.waitForTimeout(6500);
    await page.getByRole("button", { name: /Reservar e pagar/ }).click();
    await page
      .getByRole("heading", { name: "Verificando disponibilidade" })
      .waitFor();
    assert.equal(posts.length, 1);
    assert.equal(posts[0].nome, "TESTE CODEX");
    assert.equal(posts[0].quantidade, 2);
    assert.equal(posts[0].nascimento, "1988-01-01");
    assert.equal(posts[0].forma, "pix");
    assert.equal(posts[0].politica, true);
    assert.equal(
      await page.evaluate(() => localStorage.getItem("kib-reserva")),
      id,
    );
    currentOrder = { ...baseOrder, status: "pago" };
    await page
      .getByRole("heading", { name: "Falta confirmar sua reserva" })
      .waitFor();
    assert.equal(await page.locator("#reservation-code").count(), 0);
    currentOrder = { ...baseOrder, status: "confirmado" };
    await page.getByRole("heading", { name: /Reserva confirmada/ }).waitFor();
    assert.equal(
      await page.locator("#reservation-code").inputValue(),
      "ABC234",
    );
    await page.reload();
    await page.getByRole("heading", { name: /Reserva confirmada/ }).waitFor();
    report.workflows.push({
      width,
      postedOnce: true,
      correctPayload: true,
      pendingNotConfirmed: true,
      resumedByURL: true,
    });
  }
  await context.close();
}
const scenarios = [
  ["preparando", { status: "aguardando_pagamento", preparandoPagamento: true }],
  [
    "pix",
    {
      status: "aguardando_pagamento",
      pix: {
        payload: "TESTE CODEX - PIX SIMULADO SOMENTE PARA VALIDACAO LOCAL",
        imagem: null,
      },
    },
  ],
  [
    "cartao",
    {
      status: "aguardando_pagamento",
      forma: "cartao",
      invoiceUrl: "https://www.asaas.com/i/TESTE-CODEX",
    },
  ],
  [
    "pix-prazo",
    {
      status: "aguardando_pagamento",
      expiraEm: new Date(Date.now() - 10000).toISOString(),
      pix: { payload: "TESTE LOCAL", imagem: null },
    },
  ],
  ["pago", { status: "pago" }],
  ["confirmado", { status: "confirmado" }],
  ["recusado", { status: "recusado" }],
  ["expirado", { status: "expirado" }],
  ["pago-sem-vaga", { status: "pago_sem_vaga" }],
  [
    "erro-pagamento",
    {
      status: "erro_pagamento",
      erro: "TESTE CODEX: indisponibilidade simulada",
    },
  ],
  ["nao-encontrada", { status: "nao_encontrada" }],
  ["conexao", { status: "connection" }],
];
for (const width of [1440, 390, 320])
  for (const [label, overrides] of scenarios) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    listen(page);
    await page.route("**/api/**", async (route) => {
      assert.equal(route.request().method(), "GET");
      if (route.request().url().includes("/api/reservas/")) {
        if (label === "conexao") await route.abort("failed");
        else if (label === "nao-encontrada")
          await route.fulfill({
            status: 404,
            json: { erro: "Reserva não encontrada." },
          });
        else await route.fulfill({ json: { ...baseOrder, ...overrides } });
      } else await route.fulfill({ json: agenda });
    });
    await page.goto(`http://127.0.0.1:5174/#p=${id}`);
    await page.locator(".payment-panel").waitFor();
    if (label === "conexao")
      await page.getByText("Atualização interrompida").waitFor();
    else if (label === "pix") await page.locator("#pix-code").waitFor();
    else if (label === "confirmado")
      await page.locator("#reservation-code").waitFor();
    else await page.waitForTimeout(250);
    await inspect(page, label, width, width === 390);
    if (label === "cartao")
      assert.equal(
        await page.locator(".card-payment").getAttribute("href"),
        "https://www.asaas.com/i/TESTE-CODEX",
      );
    if (label === "pix-prazo")
      assert.equal(await page.locator("#pix-code").count(), 0);
    if (label === "pago-sem-vaga")
      assert.equal(
        await page
          .getByRole("button", { name: "Escolher outro horário" })
          .count(),
        0,
      );
    await context.close();
  }
await browser.close();
await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
const violations = report.accessibility.filter((v) => v.violations.length);
console.log(
  JSON.stringify(
    {
      layouts: report.layouts.length,
      workflows: report.workflows.length,
      axeChecks: report.accessibility.length,
      violations,
      errors: report.errors,
    },
    null,
    2,
  ),
);
assert.equal(report.errors.length, 0);
assert.equal(violations.length, 0);
