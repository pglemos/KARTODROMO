import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";
test("página pública recebe HTML próprio e cache revalidável", async () => {
  let called;
  const env = {
    ASSETS: {
      fetch: async (r) => {
        called = r.url;
        return new Response("pista");
      },
    },
    LEGACY: {
      fetch: () => {
        throw new Error("não deve delegar");
      },
    },
  };
  const r = await worker.fetch(
    new Request("https://kartodromodebetim.com.br/pista"),
    env,
  );
  assert.equal(called, "https://kartodromodebetim.com.br/pista/index.html");
  assert.equal(await r.text(), "pista");
  assert.equal(r.headers.get("cache-control"), "no-cache");
});
test("API de inscrições preserva corpo, método, cookies e autorização no serviço original", async () => {
  let called;
  const request = new Request("https://preview.workers.dev/api/inscricao", {
    method: "POST",
    headers: {
      cookie: "session=teste",
      Authorization: "Bearer teste",
      "Content-Type": "application/json",
    },
    body: '{"evento":"TESTE CODEX"}',
  });
  const r = await worker.fetch(request, {
    LEGACY: {
      fetch: async (req) => {
        called = req;
        return new Response("original", { status: 201 });
      },
    },
  });
  assert.equal(called.url, "https://kartodromodebetim.com.br/api/inscricao");
  assert.equal(called.method, "POST");
  assert.equal(called.headers.get("cookie"), "session=teste");
  assert.equal(called.headers.get("authorization"), "Bearer teste");
  assert.equal(await called.text(), '{"evento":"TESTE CODEX"}');
  assert.equal(r.status, 201);
});
test("admin e telão continuam delegados ao serviço original", async () => {
  for (const path of [
    "/admin",
    "/placar-telao-tb50",
    "/_next/static/runtime.js",
  ]) {
    let original;
    await worker.fetch(new Request("https://kartodromodebetim.com.br" + path), {
      LEGACY: {
        fetch: (r) => {
          original = r.url;
          return new Response("original");
        },
      },
    });
    assert.equal(original, "https://kartodromodebetim.com.br" + path);
  }
});
test("aliases, trailing slash e www redirecionam sem perder parâmetros", async () => {
  for (const [path, expected] of [
    ["/pista.html?x=1", "https://kartodromodebetim.com.br/pista?x=1"],
    ["/home", "https://kartodromodebetim.com.br/"],
    ["/pista/", "https://kartodromodebetim.com.br/pista"],
  ]) {
    const r = await worker.fetch(
      new Request("https://kartodromodebetim.com.br" + path),
      {},
    );
    assert.equal(r.status, 301);
    assert.equal(r.headers.get("location"), expected);
  }
  const r = await worker.fetch(
    new Request("https://www.kartodromodebetim.com.br/pista?x=1"),
    {},
  );
  assert.equal(
    r.headers.get("location"),
    "https://kartodromodebetim.com.br/pista?x=1",
  );
});
test("preview não é indexado e assets versionados têm cache imutável", async () => {
  const env = { ASSETS: { fetch: () => new Response("ok") } };
  const preview = await worker.fetch(
    new Request("https://preview.workers.dev/"),
    env,
  );
  assert.equal(preview.headers.get("x-robots-tag"), "noindex");
  const asset = await worker.fetch(
    new Request("https://kartodromodebetim.com.br/ui-assets/test.js"),
    env,
  );
  assert.match(asset.headers.get("cache-control"), /immutable/);
});
