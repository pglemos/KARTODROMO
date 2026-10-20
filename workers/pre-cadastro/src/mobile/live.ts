/**
 * Ao vivo do app: o retrato da cronometragem (o mesmo do placar e do telão), lido do servidor da crono pelo túnel
 * só de leitura (crono.kartodromodebetim.com.br/api/livetime-snapshot). Guarda 2 s no cache do data center para
 * muitos celulares abertos não virarem muitos pedidos no túnel. Só nome, kart e tempos — nada de cadastro.
 */
export interface MobileLiveEnv {
  CRONO_URL?: string;
}

type Piloto = { position?: unknown; kart?: unknown; name?: unknown; time?: unknown; laps?: unknown; last?: unknown; bestLap?: unknown; gap?: unknown };
type Retrato = { status?: unknown; updatedAt?: unknown; sessionType?: unknown; eventName?: unknown; trackName?: unknown; race?: { startedAt?: unknown } | null; drivers?: unknown };

const json = (status: number, body: unknown, maxAge = 0) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': maxAge ? `public, max-age=${maxAge}` : 'no-store' },
});

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const inteiro = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null);

/** Só os campos que o app mostra, com tamanho limitado (o retrato vem de fora do Worker). */
export function retratoParaApp(r: Retrato) {
  const status = r.status === 'live' ? 'live' : r.status === 'finished' ? 'finished' : 'empty';
  const pilotos = (Array.isArray(r.drivers) ? r.drivers as Piloto[] : [])
    .filter((d) => inteiro(d.position) !== null && inteiro(d.position)! < 999 && texto(d.kart, 10) && texto(d.kart, 10) !== '-')
    .slice(0, 60)
    .map((d) => ({
      position: inteiro(d.position)!,
      kart: texto(d.kart, 10),
      name: texto(d.name, 80),
      best: texto(d.time, 16),
      laps: inteiro(d.laps),
      last: texto(d.last, 16),
      bestLap: inteiro(d.bestLap),
      gap: texto(d.gap, 20),
    }));
  return {
    status,
    eventName: texto(r.eventName, 120),
    trackName: texto(r.trackName, 120),
    sessionType: r.sessionType === 'race' ? 'race' : 'qualifying',
    startedAt: typeof r.race?.startedAt === 'string' ? r.race.startedAt : null,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : new Date().toISOString(),
    drivers: status === 'empty' ? [] : pilotos,
  };
}

export async function handleMobileLive(request: Request, env: MobileLiveEnv) {
  if (request.method !== 'GET') return json(405, { erro: 'Método não permitido.' });
  const cache = (globalThis as { caches?: { default: Cache } }).caches?.default;
  const chave = new Request('https://cache.kartodromo/app/ao-vivo');
  const guardado = cache ? await cache.match(chave) : undefined;
  if (guardado) return guardado;
  const origem = (env.CRONO_URL?.trim() || 'https://crono.kartodromodebetim.com.br').replace(/\/$/, '');
  let r: Response;
  try {
    r = await fetch(`${origem}/api/livetime-snapshot`, { signal: AbortSignal.timeout(6000), headers: { accept: 'application/json' } });
  } catch {
    return json(503, { erro: 'A cronometragem não respondeu. Tente de novo em instantes.' });
  }
  if (!r.ok) return json(503, { erro: 'A cronometragem não respondeu. Tente de novo em instantes.' });
  let corpo: Retrato;
  try { corpo = await r.json() as Retrato; } catch { return json(503, { erro: 'A cronometragem respondeu num formato inesperado.' }); }
  const resposta = json(200, retratoParaApp(corpo), 2);
  if (cache) await cache.put(chave, resposta.clone());
  return resposta;
}
