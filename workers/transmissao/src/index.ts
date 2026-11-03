/**
 * API de transmissão ao vivo num Worker próprio (antes passava pelo Next do site, que estourava o limite de recursos
 * do Cloudflare durante as corridas: ~7% dos envios do ORBITS voltavam HTTP 500).
 *
 *   POST /api/transmissao/v1/publicar     o servidor da cronometragem (ORBITS) publica o retrato (chave de publicação)
 *   GET  /api/transmissao/v1/corrida      classificação (ETag/304)
 *   GET  /api/transmissao/v1/voltas       volta a volta (ETag/304; ?kart=78 filtra um kart)
 *   GET  /api/transmissao/v1/eventos      tempo real por SSE: eventos corrida e voltas (?kart=78 filtra o volta a volta)
 *   GET  /api/transmissao/v1/saude        situação do envio, sem chave (200 ou 503), para monitoramento
 *   GET  /api/transmissao/v1/openapi.json contrato OpenAPI 3.1, sem chave
 *
 * O Durable Object é o ponto único: recebe o retrato, distribui na hora a quem está conectado e conta o uso por chave.
 * O R2 (`transmissao/v1/corrida.json`) é só reserva: recebe uma cópia a cada 5 s e responde se o objeto falhar.
 * Documentação do parceiro: docs/api-transmissao.md.
 * Segredos (wrangler secret, nunca no código): TRANSMISSAO_CHAVES_SHA256, TRANSMISSAO_PUBLICACAO_SHA256.
 */
import { DurableObject } from 'cloudflare:workers';
import { conferirChave, extrairChave, filtrarVoltasPorKart, lerHashes, VERSAO_TRANSMISSAO, type Transmissao, type VoltasPiloto } from '../../../lib/timing/transmissao';
import { OPENAPI } from './openapi';

interface Env {
  TELAO: R2Bucket;
  HUB: DurableObjectNamespace<HubTransmissao>;
  TRANSMISSAO_CHAVES_SHA256?: string;
  TRANSMISSAO_PUBLICACAO_SHA256?: string;
}

const BASE = '/api/transmissao/v1';
const CHAVE_R2 = 'transmissao/v1/corrida.json';
const SEM_SINAL_APOS_MS = 90_000;
// o retrato leva o volta a volta: uma prova longa (100 Milhas) passa de centenas de KB
const TAMANHO_MAXIMO = 2 * 1024 * 1024;
const LIMITE_POR_SEGUNDO = 10;
const LIMITE_CONEXOES = 10;
const PING_MS = 15_000;
const COPIA_R2_MS = 5_000;
const GRAVAR_PARADO_MS = 60_000;

const CABECALHOS: Record<string, string> = {
  // no-cache permite guardar e revalidar com If-None-Match; o dado nunca é servido velho
  'Cache-Control': 'private, no-cache',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-api-key, content-type, if-none-match, last-event-id, cache-control',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Expose-Headers': 'ETag, Retry-After, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, X-Request-Id',
  'Access-Control-Max-Age': '86400',
  'X-Content-Type-Options': 'nosniff',
};

const json = (corpo: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...CABECALHOS, ...extra } });

/** Erro no padrão RFC 9457. O campo `erro` continua existindo para quem já lia o formato antigo. */
const problema = (status: number, titulo: string, detalhe: string, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify({ type: 'about:blank', title: titulo, status, detail: detalhe, erro: detalhe }), {
    status,
    headers: { 'content-type': 'application/problem+json; charset=utf-8', ...CABECALHOS, ...extra },
  });

type Guardada = Transmissao & { recebidoEm: string; voltaAVolta?: VoltasPiloto[] };
type Cliente = { escritor: WritableStreamDefaultWriter<Uint8Array>; kart: string | null; parceiro: string };

const semTempo = (d: Guardada) => {
  const { atualizadoEm: _a, recebidoEm: _r, ...resto } = d;
  void _a; void _r;
  return JSON.stringify(resto);
};
const sinalDe = (recebidoEm: string | undefined, agora: number) => {
  const idade = agora - Date.parse(recebidoEm ?? '');
  return Number.isFinite(idade) && idade <= SEM_SINAL_APOS_MS ? 'ao-vivo' : 'sem-sinal';
};

function vistaCorrida(d: Guardada | null, agora: number) {
  if (!d) return { versao: VERSAO_TRANSMISSAO, atualizadoEm: new Date(agora).toISOString(), situacao: 'sem-bateria', sinal: 'sem-sinal', bateria: null, melhorVolta: null, pilotos: [] };
  const { voltaAVolta: _v, ...corrida } = d;
  void _v;
  return { ...corrida, sinal: sinalDe(d.recebidoEm, agora) };
}

function vistaVoltas(d: Guardada | null, agora: number, kart: string | null) {
  if (!d) return { versao: VERSAO_TRANSMISSAO, atualizadoEm: new Date(agora).toISOString(), situacao: 'sem-bateria', sinal: 'sem-sinal', bateria: null, pilotos: [] };
  return filtrarVoltasPorKart({
    versao: d.versao, atualizadoEm: d.atualizadoEm, sinal: sinalDe(d.recebidoEm, agora), situacao: d.situacao,
    bateria: d.bateria && { id: d.bateria.id, nome: d.bateria.nome },
    pilotos: d.voltaAVolta ?? [],
  }, kart);
}

const codificador = new TextEncoder();

export class HubTransmissao extends DurableObject<Env> {
  private dados: Guardada | null = null;
  private versaoConteudo = 0;
  private assinatura = '';
  private gravadoEm = 0;
  private copiadoEm = 0;
  private sinalAvisado = '';
  private clientes = new Set<Cliente>();
  private uso = new Map<string, { janela: number; n: number }>();
  private relogio: ReturnType<typeof setInterval> | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const guardado = await ctx.storage.get<{ dados: Guardada; versao: number }>('retrato');
      if (guardado) {
        this.dados = guardado.dados;
        this.versaoConteudo = guardado.versao;
      } else {
        const obj = await env.TELAO.get(CHAVE_R2).catch(() => null);
        this.dados = obj ? ((await obj.json()) as Guardada) : null;
      }
      this.assinatura = this.dados ? semTempo(this.dados) : '';
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const parceiro = request.headers.get('x-parceiro') ?? '';
    if (url.pathname === '/publicar') return this.publicar(await request.text());
    if (url.pathname === '/saude') return this.saude();
    if (url.pathname === '/eventos') return this.abrirFluxo(request, url.searchParams.get('kart'), parceiro);
    const limite = this.contar(parceiro);
    if (limite.status) return limite.status;
    const voltas = url.pathname === '/voltas';
    const kart = voltas ? url.searchParams.get('kart') : null;
    const agora = Date.now();
    // o ETag só muda quando o conteúdo muda: o reenvio de "ainda vivo" a cada 30 s responde 304
    const etag = `"${this.versaoConteudo}-${sinalDe(this.dados?.recebidoEm, agora)}${voltas ? `-v${kart ?? ''}` : ''}"`;
    const extra = { ETag: etag, ...limite.cabecalhos };
    // a Cloudflare enfraquece o ETag ao comprimir (W/"..."); RFC 9110: If-None-Match compara em modo fraco
    const validadores = (request.headers.get('if-none-match') ?? '').split(',').map((v) => v.trim().replace(/^W\//, ''));
    if (validadores.includes(etag) || validadores.includes('*')) return new Response(null, { status: 304, headers: { ...CABECALHOS, ...extra } });
    return json(voltas ? vistaVoltas(this.dados, agora, kart) : vistaCorrida(this.dados, agora), 200, extra);
  }

  private contar(parceiro: string) {
    const janela = Math.floor(Date.now() / 1000);
    const atual = this.uso.get(parceiro);
    const n = atual?.janela === janela ? atual.n + 1 : 1;
    this.uso.set(parceiro, { janela, n });
    const cabecalhos = { 'RateLimit-Limit': String(LIMITE_POR_SEGUNDO), 'RateLimit-Remaining': String(Math.max(0, LIMITE_POR_SEGUNDO - n)), 'RateLimit-Reset': '1' };
    if (n > LIMITE_POR_SEGUNDO) return { cabecalhos, status: problema(429, 'Limite de consultas', `Máximo de ${LIMITE_POR_SEGUNDO} consultas por segundo. Para tempo real use ${BASE}/eventos.`, { ...cabecalhos, 'Retry-After': '1' }) };
    return { cabecalhos, status: null };
  }

  private async publicar(texto: string): Promise<Response> {
    const retrato = JSON.parse(texto) as Guardada;
    const agora = Date.now();
    // um envio atrasado pela rede não pode voltar a classificação para trás
    if (this.dados && Date.parse(retrato.atualizadoEm) < Date.parse(this.dados.atualizadoEm)) return json({ ok: true, ignorado: 'retrato mais antigo que o atual' });
    const novo: Guardada = { ...retrato, recebidoEm: new Date(agora).toISOString() };
    const assinatura = semTempo(novo);
    const mudou = assinatura !== this.assinatura;
    this.dados = novo;
    if (mudou) {
      this.assinatura = assinatura;
      this.versaoConteudo++;
      this.enviarATodos(agora);
    } else if (this.sinalAvisado === 'sem-sinal') {
      this.enviarATodos(agora);
    }
    if (mudou || agora - this.gravadoEm >= GRAVAR_PARADO_MS) {
      this.gravadoEm = agora;
      await this.ctx.storage.put('retrato', { dados: novo, versao: this.versaoConteudo });
    }
    if (agora - this.copiadoEm >= COPIA_R2_MS) {
      this.copiadoEm = agora;
      this.ctx.waitUntil(this.env.TELAO.put(CHAVE_R2, JSON.stringify(novo), { httpMetadata: { contentType: 'application/json' } }).catch(() => undefined));
    }
    return json({ ok: true });
  }

  private saude(): Response {
    const agora = Date.now();
    const sinal = sinalDe(this.dados?.recebidoEm, agora);
    return json({
      status: sinal === 'ao-vivo' ? 'ok' : 'sem-sinal',
      sinal,
      ultimoRecebimentoEm: this.dados?.recebidoEm ?? null,
      situacao: this.dados?.situacao ?? 'sem-bateria',
    }, sinal === 'ao-vivo' ? 200 : 503);
  }

  private abrirFluxo(request: Request, kart: string | null, parceiro: string): Response {
    let abertas = 0;
    for (const c of this.clientes) if (c.parceiro === parceiro) abertas++;
    if (abertas >= LIMITE_CONEXOES) return problema(429, 'Limite de conexões', `Máximo de ${LIMITE_CONEXOES} conexões abertas por chave.`, { 'Retry-After': '30' });
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const cliente: Cliente = { escritor: writable.getWriter(), kart, parceiro };
    this.clientes.add(cliente);
    this.sinalAvisado ||= sinalDe(this.dados?.recebidoEm, Date.now());
    this.escrever(cliente, `retry: 2000\n\n${this.quadro(cliente, Date.now())}`);
    this.relogio ??= setInterval(() => this.batida(), PING_MS);
    request.signal?.addEventListener('abort', () => this.remover(cliente));
    return new Response(readable, {
      headers: { ...CABECALHOS, 'content-type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' },
    });
  }

  private quadro(c: Cliente, agora: number) {
    const id = `${this.versaoConteudo}`;
    return `id: ${id}\nevent: corrida\ndata: ${JSON.stringify(vistaCorrida(this.dados, agora))}\n\nid: ${id}\nevent: voltas\ndata: ${JSON.stringify(vistaVoltas(this.dados, agora, c.kart))}\n\n`;
  }

  private enviarATodos(agora: number) {
    this.sinalAvisado = sinalDe(this.dados?.recebidoEm, agora);
    for (const c of this.clientes) this.escrever(c, this.quadro(c, agora));
  }

  /** Mantém a conexão aberta e avisa quando a cronometragem para de enviar (a queda não gera publicação nenhuma). */
  private batida() {
    const agora = Date.now();
    const sinal = sinalDe(this.dados?.recebidoEm, agora);
    if (sinal !== this.sinalAvisado) this.enviarATodos(agora);
    for (const c of this.clientes) this.escrever(c, ': ping\n\n');
    if (!this.clientes.size && this.relogio) {
      clearInterval(this.relogio);
      this.relogio = null;
    }
  }

  private escrever(c: Cliente, texto: string) {
    // cliente lento demais é desconectado: ele reconecta e recebe o retrato completo
    if ((c.escritor.desiredSize ?? 0) < -TAMANHO_MAXIMO) return this.remover(c);
    c.escritor.write(codificador.encode(texto)).catch(() => this.remover(c));
  }

  private remover(c: Cliente) {
    this.clientes.delete(c);
    c.escritor.abort().catch(() => undefined);
  }
}

function validar(corpo: unknown): boolean {
  if (!corpo || typeof corpo !== 'object') return false;
  const t = corpo as Partial<Transmissao>;
  return t.versao === VERSAO_TRANSMISSAO && typeof t.situacao === 'string' && typeof t.atualizadoEm === 'string' && Array.isArray(t.pilotos) && t.pilotos.length <= 200;
}

const hub = (env: Env) => env.HUB.get(env.HUB.idFromName('corrida'));

async function publicar(request: Request, env: Env): Promise<Response> {
  if (!env.TRANSMISSAO_PUBLICACAO_SHA256) return problema(503, 'Não configurada', 'Publicação não configurada.');
  const chave = extrairChave((n) => request.headers.get(n), new URL('https://x/'));
  if ((await conferirChave(chave, lerHashes(env.TRANSMISSAO_PUBLICACAO_SHA256))) == null) return problema(401, 'Chave inválida', 'Chave de publicação inválida.');
  if (Number(request.headers.get('content-length') ?? 0) > TAMANHO_MAXIMO) return problema(413, 'Grande demais', 'Retrato grande demais.');
  const texto = await request.text();
  if (texto.length > TAMANHO_MAXIMO) return problema(413, 'Grande demais', 'Retrato grande demais.');
  let corpo: unknown;
  try { corpo = JSON.parse(texto); } catch { return problema(400, 'JSON inválido', 'JSON inválido.'); }
  if (!validar(corpo)) return problema(400, 'Formato inesperado', 'Formato inesperado (versão 1).');
  try {
    return await hub(env).fetch('https://hub/publicar', { method: 'POST', body: texto });
  } catch {
    return problema(502, 'Falha momentânea', 'Não foi possível guardar o retrato.', { 'Retry-After': '1' });
  }
}

/** Reserva: se o Durable Object falhar, o último retrato copiado no R2 ainda responde (sem ETag). */
async function lerDoR2(env: Env, voltas: boolean, kart: string | null): Promise<Response> {
  try {
    const obj = await env.TELAO.get(CHAVE_R2);
    const dados = obj ? ((await obj.json()) as Guardada) : null;
    const agora = Date.now();
    return json(voltas ? vistaVoltas(dados, agora, kart) : vistaCorrida(dados, agora));
  } catch {
    return problema(502, 'Falha momentânea', 'Não foi possível ler os dados da corrida agora. Tente de novo em 1 s.', { 'Retry-After': '1' });
  }
}

async function ler(request: Request, env: Env, rota: 'corrida' | 'voltas' | 'eventos'): Promise<Response> {
  if (!env.TRANSMISSAO_CHAVES_SHA256) return problema(503, 'Não configurada', 'API de transmissão ainda não configurada.');
  const url = new URL(request.url);
  const parceiro = await conferirChave(extrairChave((n) => request.headers.get(n), url), lerHashes(env.TRANSMISSAO_CHAVES_SHA256));
  if (parceiro == null) return problema(401, 'Chave inválida', 'Chave ausente ou inválida. Envie no cabeçalho Authorization: Bearer <chave>.', { 'WWW-Authenticate': 'Bearer' });
  const kart = url.searchParams.get('kart');
  const interno = new Headers({ 'x-parceiro': parceiro });
  const validador = request.headers.get('if-none-match');
  if (validador) interno.set('if-none-match', validador);
  try {
    return await hub(env).fetch(`https://hub/${rota}${kart ? `?kart=${encodeURIComponent(kart)}` : ''}`, { headers: interno, signal: rota === 'eventos' ? request.signal : undefined });
  } catch {
    if (rota === 'eventos') return problema(502, 'Falha momentânea', 'Fluxo indisponível agora. Tente de novo em 1 s.', { 'Retry-After': '1' });
    return lerDoR2(env, rota === 'voltas', kart);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const resposta = await rotear(request, env, pathname);
    // comprimindo por conta própria: quando a Cloudflare comprime, enfraquece o ETag (W/) e descarta o If-None-Match
    // fraco, e o 304 nunca sai
    const comprimir = resposta.status === 200 && resposta.headers.has('etag') && /\bgzip\b/.test(request.headers.get('accept-encoding') ?? '');
    const final = comprimir && resposta.body
      ? new Response(resposta.body.pipeThrough(new CompressionStream('gzip')), { status: 200, headers: resposta.headers, encodeBody: 'manual' })
      : new Response(resposta.body, resposta);
    if (comprimir) {
      final.headers.set('Content-Encoding', 'gzip');
      final.headers.set('Vary', 'Accept-Encoding');
    }
    final.headers.set('X-Request-Id', request.headers.get('cf-ray') ?? crypto.randomUUID());
    return final;
  },
};

async function rotear(request: Request, env: Env, pathname: string): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CABECALHOS });
  if (pathname === `${BASE}/publicar`) return request.method === 'POST' ? publicar(request, env) : problema(405, 'Método não permitido', 'Use POST.', { Allow: 'POST' });
  if (request.method !== 'GET') return problema(405, 'Método não permitido', 'Use GET.', { Allow: 'GET, OPTIONS' });
  if (pathname === `${BASE}/corrida`) return ler(request, env, 'corrida');
  if (pathname === `${BASE}/voltas`) return ler(request, env, 'voltas');
  if (pathname === `${BASE}/eventos`) return ler(request, env, 'eventos');
  if (pathname === `${BASE}/openapi.json`) return json(OPENAPI, 200, { 'Cache-Control': 'public, max-age=300' });
  if (pathname === `${BASE}/saude`) {
    try { return await hub(env).fetch('https://hub/saude'); }
    catch { return problema(503, 'Indisponível', 'Serviço indisponível agora.', { 'Retry-After': '5' }); }
  }
  // a raiz da API não traz dados: só aponta os endereços certos (abrir /v1 no navegador dava 404 e parecia fora do ar)
  if (/^\/api\/transmissao(\/v1)?\/?$/.test(pathname)) {
    return json({
      api: 'Transmissão ao vivo do Kartódromo de Betim', versao: VERSAO_TRANSMISSAO,
      enderecos: { corrida: `${BASE}/corrida`, voltas: `${BASE}/voltas`, eventos: `${BASE}/eventos`, saude: `${BASE}/saude`, openapi: `${BASE}/openapi.json` },
      chave: 'Authorization: Bearer <chave>',
    });
  }
  return problema(404, 'Endereço não encontrado', `Endereço não encontrado. Use ${BASE}/corrida, ${BASE}/voltas ou ${BASE}/eventos.`);
}
