import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { agenda } from "./fixture.mjs";
await mkdir("/tmp/kart-audit/reservations-new", { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const report = [];
async function setup(mode) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  let gets = 0,
    posts = 0;
  await page.route("**/api/**", async (route) => {
    assert.equal(
      new URL(route.request().url()).origin,
      "http://127.0.0.1:5174",
    );
    if (route.request().method() === "POST") {
      posts++;
      if (mode === "ambiguous") return route.abort("failed");
      if (mode === "validation")
        return route.fulfill({
          status: 400,
          json: { erro: "TESTE CODEX: validação de servidor" },
        });
      return route.fulfill({
        status: 201,
        json: { id: "12345678-1234-4234-8234-123456789abc", codigo: "ABC234" },
      });
    }
    if (route.request().url().includes("/api/reservas/"))
      return route.fulfill({
        json: { id: "12345678-1234-4234-8234-123456789abc", status: "novo" },
      });
    gets++;
    const data = structuredClone(agenda);
    if (mode === "price" && gets > 1) data.precoCentavos += 1000;
    if (mode === "capacity" && gets > 1)
      data.horarios = data.horarios.filter(
        (h) => h.id !== agenda.horarios[0].id,
      );
    if (mode === "offline") data.pagamentoOnline = false;
    if (mode === "empty") data.horarios = [];
    if (mode === "small-group") data.horarios[0].livres = 2;
    if (mode === "load-failure" && gets === 1)
      return route.fulfill({
        status: 503,
        json: { erro: "TESTE CODEX: agenda indisponível" },
      });
    return route.fulfill({ json: data });
  });
  await page.goto("http://127.0.0.1:5174");
  return { context, page, posts: () => posts };
}
async function review(page) {
  await page.locator(".time-option").first().click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.locator("#nome").fill("TESTE CODEX");
  await page.locator("#documento").fill("52998224725");
  await page.locator("#telefone").fill("31999999999");
  await page.locator("#nascimento").fill("01011988");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("checkbox").nth(0).check();
  await page.getByRole("checkbox").nth(1).check();
  await page.clock.install();
  await page.clock.fastForward(7000);
}
for (const mode of ["price", "capacity", "ambiguous", "validation"]) {
  const { context, page, posts } = await setup(mode);
  await review(page);
  await page.getByRole("button", { name: /Reservar e pagar/ }).click();
  await page.locator('[role="alert"]').waitFor();
  if (mode === "price") {
    assert.equal(posts(), 0);
    assert.match(
      await page.locator('[role="alert"]').innerText(),
      /valor foi atualizado/,
    );
    assert.equal(await page.getByRole("checkbox").nth(0).isChecked(), false);
    assert.match(await page.locator(".stage-actions").innerText(), /155,00/);
  }
  if (mode === "capacity") {
    assert.equal(posts(), 0);
    await page
      .getByRole("heading", { name: "Data e horário", exact: true })
      .waitFor();
    assert.equal(await page.locator(".time-option.selected").count(), 0);
  }
  if (mode === "ambiguous") {
    assert.equal(posts(), 1);
    assert.equal(
      await page.getByRole("button", { name: /Reservar e pagar/ }).isDisabled(),
      true,
    );
    assert.match(
      await page.locator('[role="alert"]').innerText(),
      /pedidos duplicados/,
    );
    await page.clock.fastForward(20000);
    assert.equal(posts(), 1);
  }
  if (mode === "validation") {
    assert.equal(posts(), 1);
    assert.equal(
      await page.getByRole("button", { name: /Reservar e pagar/ }).isDisabled(),
      false,
    );
  }
  report.push({ mode, passed: true });
  await context.close();
}
for (const mode of ["offline", "empty", "load-failure"]) {
  const { context, page, posts } = await setup(mode);
  await page.locator(".empty-state").waitFor();
  assert.equal(posts(), 0);
  assert.equal(
    await page.getByRole("button", { name: /Reservar e pagar/ }).count(),
    0,
  );
  if (mode === "load-failure") {
    await page.getByRole("button", { name: "Atualizar agenda" }).click();
    await page.locator(".time-option").first().waitFor();
  }
  report.push({ mode, passed: true });
  await context.close();
}
{
  const { context, page } = await setup("small-group");
  await page.locator(".time-option").first().click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar um piloto" }).click();
  assert.equal(await page.locator("output").innerText(), "2");
  assert.equal(
    await page
      .getByRole("button", { name: "Adicionar um piloto" })
      .isDisabled(),
    true,
  );
  report.push({ mode: "capacity-limit", passed: true });
  await context.close();
}
await browser.close();
await writeFile(
  "/tmp/kart-audit/reservations-new/edges.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));
