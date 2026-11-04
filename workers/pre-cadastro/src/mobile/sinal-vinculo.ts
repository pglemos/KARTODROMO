/**
 * Vínculo sob demanda (app ↔ cadastro do kartódromo), sem porta aberta no kartódromo.
 *
 * O SRVKART deixa um long-poll aberto em GET /api/mobile/v1/internal/identity-wait. Quando um cliente confirma o
 * e-mail ou abre o histórico ainda sem vínculo, o Worker "toca" este Durable Object e o long-poll responde na hora:
 * o SRVKART busca as contas pendentes, confere CPF + e-mail/telefone no KartodromoOps, vincula e publica o histórico.
 *
 * Um único objeto (nome fixo). Sinal que chega sem ninguém esperando fica guardado e é entregue no próximo long-poll,
 * então nada se perde entre uma espera e outra.
 */
export interface SinalVinculoEnv {
  SINAL_VINCULO?: DurableObjectNamespace;
  MOBILE_ADMIN_TOKEN?: string;
}

const ESPERA_MAX_MS = 25_000;

export class SinalVinculo implements DurableObject {
  private esperando = new Set<(sinal: boolean) => void>();
  private pendente = false;

  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === '/tocar') { await this.tocar(); return new Response('ok'); }
    const sinal = await this.esperar(Number(url.searchParams.get('ms') ?? ESPERA_MAX_MS));
    return Response.json({ sinal });
  }

  /** Acorda quem está esperando; se ninguém estiver, guarda para o próximo. */
  async tocar(): Promise<void> {
    if (this.esperando.size === 0) { this.pendente = true; return; }
    for (const acordar of this.esperando) acordar(true);
    this.esperando.clear();
  }

  /** true = houve pedido de vínculo; false = passou o tempo sem pedido. */
  async esperar(ms: number): Promise<boolean> {
    if (this.pendente) { this.pendente = false; return true; }
    const limite = Math.min(Math.max(ms, 1_000), ESPERA_MAX_MS);
    return new Promise<boolean>((resolve) => {
      const acordar = (sinal: boolean) => { clearTimeout(timer); this.esperando.delete(acordar); resolve(sinal); };
      const timer = setTimeout(() => acordar(false), limite);
      this.esperando.add(acordar);
    });
  }
}

function objeto(env: SinalVinculoEnv) {
  return env.SINAL_VINCULO?.get(env.SINAL_VINCULO.idFromName('vinculo'));
}

/** Pede vínculo agora. Nunca falha a requisição do cliente: sem o objeto, o ciclo de 60 s do SRVKART cobre. */
export async function pedirVinculo(env: SinalVinculoEnv): Promise<void> {
  try { await objeto(env)?.fetch('https://sinal/tocar', { method: 'POST' }); } catch { /* ciclo periódico cobre */ }
}

function igual(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

/** GET /api/mobile/v1/internal/identity-wait?ms=25000 (x-mobile-admin-token) → { sinal: boolean } */
export async function esperarPedidoDeVinculo(request: Request, env: SinalVinculoEnv): Promise<Response> {
  if (request.method !== 'GET') return json(405, { erro: 'Método não permitido.' });
  const token = request.headers.get('x-mobile-admin-token') ?? '';
  if (!env.MOBILE_ADMIN_TOKEN || !igual(token, env.MOBILE_ADMIN_TOKEN)) return json(401, { erro: 'Não autorizado.' });
  const alvo = objeto(env);
  if (!alvo) return json(503, { erro: 'Serviço temporariamente indisponível.' });
  const ms = Number(new URL(request.url).searchParams.get('ms') ?? ESPERA_MAX_MS);
  const r = await alvo.fetch(`https://sinal/esperar?ms=${Number.isFinite(ms) ? ms : ESPERA_MAX_MS}`);
  const { sinal } = (await r.json()) as { sinal: boolean };
  return json(200, { sinal });
}
