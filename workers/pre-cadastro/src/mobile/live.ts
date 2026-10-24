/**
 * Ao vivo do app: o retrato da cronometragem (o mesmo do placar e do telão), lido do servidor da crono pelo túnel
 * só de leitura (crono.kartodromodebetim.com.br/api/livetime-snapshot). Guarda 2 s no cache do data center para
 * muitos celulares abertos não virarem muitos pedidos no túnel. Só nome, kart e tempos — nada de cadastro.
 */
export interface MobileLiveEnv {
  CRONO_URL?: string;
  AO_VIVO?: DurableObjectNamespace;
}

type Volta = { number?: unknown; time?: unknown; timeMs?: unknown };
type Piloto = { position?: unknown; kart?: unknown; name?: unknown; time?: unknown; laps?: unknown; last?: unknown; bestLap?: unknown; gap?: unknown; passouEm?: unknown; lapTimes?: unknown };
type Retrato = { status?: unknown; updatedAt?: unknown; sessionType?: unknown; eventName?: unknown; trackName?: unknown; race?: { id?: unknown; startedAt?: unknown } | null; drivers?: unknown };

const json = (status: number, body: unknown, maxAge = 0) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': maxAge ? `public, max-age=${maxAge}` : 'no-store' },
});

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const inteiro = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null);
const milissegundos = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v) && v > 0 ? v : null);

function voltasParaApp(value: unknown) {
  if (!Array.isArray(value)) return [];
  const porNumero = new Map<number, { number: number; time: string; timeMs: number }>();
  for (const item of value as Volta[]) {
    const number = inteiro(item?.number);
    const time = texto(item?.time, 16);
    const timeMs = milissegundos(item?.timeMs);
    if (number === null || number < 1 || !time || timeMs === null) continue;
    porNumero.set(number, { number, time, timeMs });
  }
  return [...porNumero.values()].sort((a, b) => a.number - b.number);
}

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
      lapTimes: voltasParaApp(d.lapTimes),
      // hora exata da última passagem, no relógio da cronometragem (versão app=1 do retrato)
      passouEm: typeof d.passouEm === 'number' && Number.isFinite(d.passouEm) ? d.passouEm : null,
    }));
  return {
    status,
    eventName: texto(r.eventName, 120),
    trackName: texto(r.trackName, 120),
    sessionType: r.sessionType === 'race' ? 'race' : 'qualifying',
    raceId: typeof r.race?.id === 'string' ? r.race.id : null,
    startedAt: typeof r.race?.startedAt === 'string' ? r.race.startedAt : null,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : new Date().toISOString(),
    drivers: status === 'empty' ? [] : pilotos,
  };
}

export async function handleMobileLive(request: Request, env: MobileLiveEnv) {
  if (request.method !== 'GET') return json(405, { erro: 'Método não permitido.' });
  if (env.AO_VIVO) {
    // celular conectado por WebSocket recebe cada passagem na hora; a busca simples (versões antigas do app) lê o
    // último retrato da mesma fonte, com 1 s de cache no data center para não virar um pedido por celular
    const objeto = env.AO_VIVO.get(env.AO_VIVO.idFromName('crono'));
    if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') return objeto.fetch(request);
    const cache = (globalThis as { caches?: { default: Cache } }).caches?.default;
    const chave = new Request('https://cache.kartodromo/app/ao-vivo-1s');
    const guardado = cache ? await cache.match(chave) : undefined;
    if (guardado) return guardado;
    const r = await objeto.fetch('https://ao-vivo/retrato').catch(() => null);
    if (!r?.ok) return handleMobileLive(request, { CRONO_URL: env.CRONO_URL }); // repasse fora: lê direto da crono
    // Retratos criados antes da publicação do histórico não têm lapTimes. Não devolva esse
    // estado legado: leia uma vez da cronometragem para atualizar o objeto e o cache do app.
    try {
      const corpo = await r.clone().json() as { drivers?: { lapTimes?: unknown }[] };
      const semHistorico = Array.isArray(corpo.drivers) && corpo.drivers.length > 0 && corpo.drivers.some((d) => !Array.isArray(d.lapTimes));
      if (semHistorico) return handleMobileLive(request, { CRONO_URL: env.CRONO_URL });
    } catch {
      return handleMobileLive(request, { CRONO_URL: env.CRONO_URL });
    }
    const resposta = new Response(r.body, { status: r.status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': r.ok ? 'public, max-age=1' : 'no-store' } });
    if (cache && r.ok) await cache.put(chave, resposta.clone());
    return resposta;
  }
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

type RetratoApp = ReturnType<typeof retratoParaApp>;
type PilotoApp = RetratoApp['drivers'][number] & { passouEm: number | null };

/**
 * Tempo real do app: uma conexão só com o fluxo de eventos da cronometragem (o mesmo dos painéis de LED, que chega no
 * instante da passagem) e o repasse por WebSocket para todos os celulares abertos. Anota a hora em que cada kart
 * completou a volta (`passouEm`, relógio do servidor) e manda `agora` em cada mensagem para o celular acertar o relógio
 * dele pelo do servidor. Sem ninguém olhando por 1 min, fecha a conexão com a cronometragem.
 */
export class AoVivo implements DurableObject {
  private retrato: (Omit<RetratoApp, 'drivers'> & { raceId: string | null; drivers: PilotoApp[] }) | null = null;
  private voltas = new Map<string, number>();
  private passou = new Map<string, number>();
  private corrida: string | null = null;
  private fonte: AbortController | null = null;
  private ultimoUso = 0;
  private ultimoDado = 0;
  private esperando: (() => void)[] = [];

  constructor(private state: DurableObjectState, private env: MobileLiveEnv) {}

  async fetch(request: Request) {
    this.ultimoUso = Date.now();
    this.ligar();
    if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      const par = new WebSocketPair();
      this.state.acceptWebSocket(par[1]);
      if (this.retrato) par[1].send(this.mensagem());
      return new Response(null, { status: 101, webSocket: par[0] });
    }
    if (!this.retrato) await new Promise<void>((ok) => { this.esperando.push(ok); setTimeout(ok, 5000); });
    if (!this.retrato) return json(503, { erro: 'A cronometragem não respondeu. Tente de novo em instantes.' });
    return new Response(this.mensagem(), { headers: { 'content-type': 'application/json; charset=utf-8' } });
  }

  webSocketMessage(ws: WebSocket, msg: string | ArrayBuffer) {
    this.ultimoUso = Date.now();
    if (msg === 'ping') ws.send(JSON.stringify({ tipo: 'pong', agora: this.agoraCrono() }));
  }

  webSocketClose(ws: WebSocket) { try { ws.close(); } catch { /* já fechado */ } }
  webSocketError(ws: WebSocket) { try { ws.close(); } catch { /* já fechado */ } }

  /** de 20 em 20 s: reabre a fonte se caiu ou ficou muda; fecha quando não há mais ninguém */
  async alarm() {
    const conectados = this.state.getWebSockets().length;
    if (!conectados && Date.now() - this.ultimoUso > 60_000) { this.fonte?.abort(); this.fonte = null; return; }
    if (this.fonte && Date.now() - this.ultimoDado > 40_000) { this.fonte.abort(); this.fonte = null; }
    this.ligar();
    if (this.fonte && Date.now() - this.medido > 60_000) await this.medirRelogio();
  }

  private ligar() {
    void this.state.storage.getAlarm().then((a) => { if (!a) void this.state.storage.setAlarm(Date.now() + 20_000); });
    if (this.fonte) return;
    const ctl = new AbortController();
    this.fonte = ctl;
    void this.ler(ctl).finally(() => { if (this.fonte === ctl) this.fonte = null; });
  }

  private async ler(ctl: AbortController) {
    const origem = (this.env.CRONO_URL?.trim() || 'https://crono.kartodromodebetim.com.br').replace(/\/$/, '');
    try {
      const r = await fetch(`${origem}/api/livetime-snapshot/eventos?app=1`, { signal: ctl.signal, headers: { accept: 'text/event-stream' } });
      if (!r.ok || !r.body) return;
      this.ultimoDado = Date.now();
      this.difCrono = null; this.medido = 0; // conexão nova: mede de novo (o relógio do PC pode ter sido acertado)
      void this.medirRelogio();
      const leitor = r.body.pipeThrough(new TextDecoderStream()).getReader();
      let resto = '';
      for (;;) {
        const { value, done } = await leitor.read();
        if (done) return;
        this.ultimoDado = Date.now();
        resto += value;
        let fim: number;
        while ((fim = resto.indexOf('\n\n')) >= 0) {
          const bloco = resto.slice(0, fim);
          resto = resto.slice(fim + 2);
          const dados = bloco.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart()).join('\n');
          if (/^event:\s*snapshot/m.test(bloco) && dados) { try { this.novo(JSON.parse(dados) as Retrato & { race?: { id?: unknown } }); } catch { /* bloco quebrado */ } }
        }
      }
    } catch { /* caiu: o alarme reabre */ }
  }

  private novo(corpo: Retrato & { race?: { id?: unknown; startedAt?: unknown } | null }) {
    // tudo no relógio do PC da cronometragem (largada e passagens são marcadas nele): o retrato sai na passagem com a
    // hora de lá; a diferença para o relógio daqui fica na melhor amostra (a de menor atraso de rede)
    const gerado = typeof corpo.updatedAt === 'string' ? Date.parse(corpo.updatedAt) : NaN;
    if (Number.isFinite(gerado) && !this.medido) { const dif = gerado - Date.now(); if (this.difCrono === null || dif > this.difCrono) this.difCrono = dif; }
    const agora = Number.isFinite(gerado) ? gerado : this.agoraCrono();
    const base = retratoParaApp(corpo);
    const raceId = typeof corpo.race?.id === 'string' ? corpo.race.id : null;
    const novaCorrida = raceId !== this.corrida;
    if (novaCorrida) { this.corrida = raceId; this.voltas.clear(); this.passou.clear(); }
    const conhecida = !novaCorrida && this.voltas.size > 0;
    const drivers = base.drivers.map((d) => {
      const antes = this.voltas.get(d.kart);
      if (d.laps !== null) {
        // volta nova, ou kart que acabou de aparecer no meio da bateria (fechou a 1ª volta agora)
        if ((antes !== undefined && d.laps > antes) || (antes === undefined && conhecida && d.laps > 0)) this.passou.set(d.kart, agora);
        this.voltas.set(d.kart, d.laps);
      }
      return { ...d, passouEm: d.passouEm ?? this.passou.get(d.kart) ?? null };
    });
    this.retrato = { ...base, raceId, drivers };
    for (const ok of this.esperando.splice(0)) ok();
    const msg = this.mensagem();
    for (const ws of this.state.getWebSockets()) { try { ws.send(msg); } catch { /* celular saiu */ } }
  }

  private difCrono: number | null = null;
  private medido = 0;

  /** acerta o relógio pelo da crono como num relógio de rede: 3 pedidos, vale o de menor ida e volta (meio do caminho) */
  private async medirRelogio() {
    const origem = (this.env.CRONO_URL?.trim() || 'https://crono.kartodromodebetim.com.br').replace(/\/$/, '');
    let melhor = Infinity;
    for (let i = 0; i < 3; i++) {
      try {
        const t0 = Date.now();
        const r = await fetch(`${origem}/api/livetime-snapshot`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(3000) });
        const j = await r.json() as { updatedAt?: unknown };
        const t1 = Date.now();
        const hora = typeof j.updatedAt === 'string' ? Date.parse(j.updatedAt) : NaN;
        if (Number.isFinite(hora) && t1 - t0 < melhor) { melhor = t1 - t0; this.difCrono = hora - (t0 + t1) / 2; this.medido = Date.now(); }
      } catch { /* tenta no próximo alarme */ }
    }
  }
  private agoraCrono() { return Date.now() + (this.difCrono ?? 0); }
  private mensagem() { return JSON.stringify({ tipo: 'retrato', agora: this.agoraCrono(), ...this.retrato }); }
}
