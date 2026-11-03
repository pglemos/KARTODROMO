/**
 * Servidor da operacao (substitui o LapTime Office + Autoatendimento). Roda no SRVKART.
 *
 *   /recepcao        app da recepcao (replica do LapTime Office; login por usuario)
 *   /totem           app de autoatendimento
 *   /termo           termo de responsabilidade imprimivel (80mm), link assinado
 *   /relatorio/:tipo relatorios imprimiveis da recepcao (?t=<token de sessao>)
 *   /api/totem/...   rotas publicas do totem
 *   /api/login       login da recepcao -> token de sessao
 *   /api/office/...  rotas da recepcao (Authorization: Bearer <token>), incluindo fidelidade,
 *                    parceiros/comissoes, vouchers, troca de senha e diagnostico de servicos
 *   /api/crono/...   rotas da cronometragem (header x-ops-key)
 *
 * Banco: KartodromoOps (lib/ops/db.ts). So LAN: firewall do SRVKART libera a porta pra rede local.
 */
import http from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { pipeline } from 'node:stream';
import { extname, join, normalize, resolve } from 'node:path';
import { caminhoArquivoAtualizacao, tipoConteudoAtualizacao } from '../lib/desktop-updates';
import { CLIENTE_COLS, insertCliente, isValidCpf, one, onlyDigits, query, updateCliente, type ClienteInput } from '../lib/ops/db';
import { confereSenha, emiteToken, renovaToken, validaToken } from '../lib/ops/auth';
import { corrigeEmail } from '../lib/ops/email-dominio';
import { erroCadastroObrigatorio } from '../lib/ops/cadastro-obrigatorio';
import { acrescentarInstagramRelatorio, idsClientesRelatorio, prepararRelatorioRecepcao, type SessaoRelatorio } from '../lib/ops/relatorio-crono';
import { HttpError, inscreverN, officeRoutes } from '../lib/ops/office';
import { bateriaDisponivelNoTotem, type TotemBateriaCandidate, TOTEM_BATERIAS_SQL } from '../lib/ops/totem-baterias';
import { relatorio } from '../lib/ops/relatorios';
import { renderTermoResponsabilidade, type TermoParticipante } from '../lib/ops/termo';
import { buscarPreCadastroAgora, preCadastroLigado, sincronizarPreCadastros } from '../lib/ops/pre-cadastro';
import { publicarAgenda, sincronizarReservasOnline, vagaOnlineDoGrupo } from '../lib/ops/reserva-online';
import { syncTimingTracks } from '../lib/ops/tracado-sync';
import { selecionarSessoesParaRelatorio, type ReceptionTimingSession } from '../lib/timing/reception-crono-reports';

function loadLocalEnv() {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] ||= value;
  }
}
loadLocalEnv();

const PORT = Number(process.env.OPS_PORT || 4060);
const KEY = process.env.OPS_RECEPCAO_KEY || '';
const UI_DIR = resolve(process.cwd(), 'services', 'ops-ui');
const UPDATES_DIR = resolve(process.env.OPS_UPDATES_DIR || join(process.cwd(), 'updates'));
const TERMO_FILE = process.env.OPS_TERMO_FILE ? resolve(process.cwd(), process.env.OPS_TERMO_FILE) : null;
const TIMING_URL = (process.env.OPS_TIMING_URL || 'http://192.168.20.249:4050').replace(/\/$/, '');
let sincronizacaoTracados: Promise<unknown> | null = null;
let tracadosSincronizadosEm = 0;
let tracadosUltimaQtd = -1;

if (!KEY) console.warn('ATENCAO: OPS_RECEPCAO_KEY vazio, rotas da cronometragem ficam sem protecao');

function log(...args: unknown[]) {
  // hora local de Brasília (o servidor roda em -03:00); antes ia UTC e atrapalhava o diagnóstico
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  console.log(`[${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}]`, ...args);
}

// Detecta travamento do event loop (a rede cai em rajadas de 10-40 s a cada ~10 min; isso dirá se é o processo).
// ponytail: só registra; se aparecer cadência regular, investigar o timer culpado antes de trocar arquitetura.
let pingAnterior = Date.now();
setInterval(() => {
  const agora = Date.now();
  const atraso = agora - pingAnterior;
  pingAnterior = agora;
  if (atraso > 2000) log(`AVISO: event loop travado por ${atraso} ms`);
}, 1000).unref();

/** Espelha o catálogo da Cronometragem sob demanda, inclusive quando a Recepção é aberta depois de uma alteração. */
async function sincronizarTracadosDaCronometragem() {
  if (Date.now() - tracadosSincronizadosEm < 30_000) return;
  if (sincronizacaoTracados) return sincronizacaoTracados;
    sincronizacaoTracados = syncTimingTracks({ timingUrl: TIMING_URL, query, one })
    .then((tracks) => {
      tracadosSincronizadosEm = Date.now();
      // só registra quando muda a quantidade — antes enchia o log a cada 30 s
      if (tracks.length !== tracadosUltimaQtd) {
        tracadosUltimaQtd = tracks.length;
        log(`catálogo de traçados sincronizado: ${tracks.length} opção(ões) ativas`);
      }
    })
    .catch((err) => {
      log(`catálogo de traçados: sincronização indisponível (${(err as Error).message})`);
    })
    .finally(() => { sincronizacaoTracados = null; });
  return sincronizacaoTracados;
}

// ---------------------------------------------------------------- helpers

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function sendHtml(res: http.ServerResponse, html: string | Buffer) {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(html);
}

const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function sendStatic(res: http.ServerResponse, rel: string) {
  const file = normalize(join(UI_DIR, rel));
  if (!file.startsWith(UI_DIR) || !existsSync(file)) return send(res, 404, { error: 'Arquivo não encontrado.' });
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(file));
}

function sendUpdateFile(res: http.ServerResponse, app: string, nome: string) {
  const file = caminhoArquivoAtualizacao(UPDATES_DIR, app, nome);
  if (!file || !existsSync(file) || statSync(file).isDirectory()) return send(res, 404, { error: 'Arquivo de atualização não encontrado.' });
  const stat = statSync(file);
  res.writeHead(200, {
    'content-type': tipoConteudoAtualizacao(nome),
    'content-length': stat.size,
    'cache-control': 'no-store',
  });
  // pipeline fecha o arquivo se o app desistir no meio; com .pipe() o manifest.json ficava aberto para sempre e
  // não dava mais para publicar versão nova (06/10: "acesso negado" ao trocar o manifesto da Cronometragem)
  pipeline(createReadStream(file), res, () => undefined);
}

async function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 1_000_000) throw new HttpError(413, 'Corpo grande demais.');
    chunks.push(chunk as Buffer);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'JSON inválido.');
  }
}

function requireKey(req: http.IncomingMessage) {
  if (!KEY) return;
  const got = Buffer.from(String(req.headers['x-ops-key'] ?? ''));
  const want = Buffer.from(KEY);
  if (got.length !== want.length || !timingSafeEqual(got, want)) throw new HttpError(401, 'Chave inválida.');
}

const sign = (text: string) => createHmac('sha256', KEY || 'sem-chave').update(text).digest('base64url').slice(0, 22);
export const termoLink = (ids: number[]) => `/termo?ids=${ids.join(',')}&s=${sign('termo:' + ids.join(','))}`;

const int = (v: unknown, name: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${name} inválido.`);
  return n;
};

/** Chamada à cronometragem (ORBITS): timeout generoso (Endurance com muitas voltas demora) e 1 nova tentativa se a rede falhar na hora
 *  (reinício do :4050 / "fetch failed"). Erro final vira 502 com mensagem clara, nunca 500. */
async function fetchCrono(url: string, timeoutMs: number): Promise<Response> {
  let ultimo: unknown;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      return await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      ultimo = e;
      if (tentativa === 0) await new Promise((r) => setTimeout(r, 800));
    }
  }
  const timeout = (ultimo as Error)?.name === 'TimeoutError' || (ultimo as Error)?.name === 'AbortError';
  throw new HttpError(502, timeout
    ? 'A cronometragem demorou para responder (bateria longa?). Tente de novo em instantes.'
    : 'A cronometragem está indisponível no momento.');
}

async function sessoesDaCronometragem(de?: string, ate?: string): Promise<ReceptionTimingSession[]> {
  const response = await fetchCrono(`${TIMING_URL}/api/sessions`, 20_000);
  if (!response.ok) throw new HttpError(502, `A cronometragem respondeu HTTP ${response.status}.`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new HttpError(502, 'A cronometragem devolveu uma lista inválida de baterias.');
  return selecionarSessoesParaRelatorio(payload as ReceptionTimingSession[], de, ate);
}


async function parametros() {
  return Object.fromEntries((await query<{ k: string; v: string }>(`SELECT Chave k, Valor v FROM dbo.Parametro`)).map((p) => [p.k, p.v]));
}

// ---------------------------------------------------------------- termo

async function termoHtml(ids: number[], branco = false) {
  const empresa = await one<{ nome: string; razaoSocial: string | null; cidade: string | null }>(
    'SELECT Nome nome, RazaoSocial razaoSocial, Cidade cidade FROM dbo.Empresa WHERE Id = 1',
  );
  const participantes: TermoParticipante[] = branco
    ? [{
        nome: '', documento: null, nascimento: null, email: null, telefone: null, cep: null, endereco: null,
        numero: null, complemento: null, bairro: null, cidade: null, responsavelNome: null, responsavelDocumento: null,
        responsavelTelefone: null, responsavelEmail: null,
      }]
    : [];
  if (!branco) {
    const placeholders = ids.map((_, n) => '@i' + n).join(',');
    const params = Object.fromEntries(ids.map((id, n) => ['i' + n, id]));
    participantes.push(...await query<TermoParticipante>(
      'SELECT c.Nome nome, c.Documento documento, CONVERT(varchar(10), c.Nascimento, 126) nascimento, ' +
        'c.Email email, c.Telefone telefone, c.Cep cep, c.Endereco endereco, c.Numero numero, c.Complemento complemento, ' +
        'c.Bairro bairro, c.Cidade cidade, r.Nome responsavelNome, r.Documento responsavelDocumento, ' +
        'r.Telefone responsavelTelefone, r.Email responsavelEmail ' +
        'FROM dbo.Inscricao i JOIN dbo.Cliente c ON c.Id = i.ClienteId ' +
        'LEFT JOIN dbo.Cliente r ON r.Id = c.ResponsavelId WHERE i.Id IN (' + placeholders + ')',
      params,
    ));
    if (participantes.length) {
      await query(
        'UPDATE dbo.Inscricao SET TermoImpressoEm = SYSDATETIME() WHERE Id IN (' + placeholders + ')',
        params,
      );
    }
  }
  const textoPersonalizado = TERMO_FILE && existsSync(TERMO_FILE) ? readFileSync(TERMO_FILE, 'utf8') : undefined;
  return renderTermoResponsabilidade({
    empresa: empresa ?? { nome: 'Kartódromo', razaoSocial: null, cidade: 'Betim' },
    participantes,
    branco,
    textoPersonalizado,
  });
}
// ---------------------------------------------------------------- fila de impressao da recepcao
// O totem nao tem impressora: o termo entra na tabela dbo.FilaImpressao (SQL Server) e o programa da Recepcao
// (com a TM-T20) pega e imprime em segundos, como o LapTime fazia pelo servidor.
// Persistido em banco: sobrevive a reinicios do SRVKART :4060.
// Termos pendentes com mais de 3 horas passam para contingencia (Status = 'falhou', UltimoErro = 'contingencia')
// sem expurgo fisico, garantindo retencao de dados caso a recepcao fique fechada ou deslogada.

type FilaImpressaoJob = {
  id: number;
  url: string;
  titulo: string;
  origem: string;
  tentativa: number;
};

async function enfileirarImpressao(url: string, titulo: string, origem: string): Promise<{ id: number; url: string; titulo: string; origem: string }> {
  try {
    // Transiciona para contingencia trabalhos pendentes ha mais de 3 horas (sem expurgo fisico)
    await query(`
      UPDATE dbo.FilaImpressao
      SET Status = 'falhou', UltimoErro = 'contingencia'
      WHERE Status IN ('pendente', 'imprimindo')
        AND DATEDIFF(hour, CriadoEm, SYSDATETIME()) >= 3
    `).catch(() => undefined);

    const row = await one<{ id: number }>(`
      INSERT INTO dbo.FilaImpressao (Url, Titulo, Origem, Status, Tentativas)
      OUTPUT inserted.Id id
      VALUES (@url, @titulo, @origem, 'pendente', 0)
    `, { url, titulo, origem });

    const id = row?.id ?? 0;
    log(`impressao #${id} na fila (${titulo}, ${origem})`);
    return { id, url, titulo, origem };
  } catch (err) {
    log(`erro ao enfileirar impressao no banco: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}

async function proximaImpressao(): Promise<FilaImpressaoJob | null> {
  try {
    // Busca e reserva atomicamente o proximo trabalho com lock atômico UPDLOCK + READPAST
    // Conforme contrato oficial de PROJECT.md
    const rows = await query<FilaImpressaoJob>(`
      WITH Proximo AS (
        SELECT TOP (1) * FROM dbo.FilaImpressao WITH (UPDLOCK, READPAST)
        WHERE Status = 'pendente' OR (Status = 'imprimindo' AND PegoEm < DATEADD(second, -90, SYSDATETIME()))
        ORDER BY CriadoEm ASC
      )
      UPDATE Proximo SET Status = 'imprimindo', PegoEm = SYSDATETIME(), Tentativas = Tentativas + 1
      OUTPUT inserted.Id id, inserted.Url url, inserted.Titulo titulo, inserted.Origem origem, inserted.Tentativas tentativa;
    `);

    return rows[0] ?? null;
  } catch (err) {
    log(`erro ao buscar proxima impressao no banco: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/** Funções de proteção de privacidade (LGPD / PII) no autoatendimento público */
function mascararDocumento(doc: unknown, tipo?: unknown): string {
  if (!doc) return '';
  const d = String(doc).trim();
  const digits = onlyDigits(d);
  if (digits.length === 11 && (!tipo || String(tipo).toUpperCase() === 'CPF')) {
    return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
  }
  if (d.length <= 4) return '***';
  return `${d.slice(0, 2)}***${d.slice(-2)}`;
}

function mascararEmail(email: unknown): string {
  if (!email) return '';
  const s = String(email).trim();
  const at = s.indexOf('@');
  if (at <= 0) return 'u***@***.com';
  const user = s.slice(0, at);
  const domain = s.slice(at + 1);
  const u = user.length > 2 ? `${user[0]}***${user[user.length - 1]}` : (user.length > 0 ? `${user[0]}***` : 'u***');
  const dot = domain.lastIndexOf('.');
  const domName = dot > 0 ? domain.slice(0, dot) : domain;
  const ext = dot > 0 ? domain.slice(dot) : '.com';
  const dMask = domName.length > 0 ? `${domName[0]}***` : 'd***';
  return `${u}@${dMask}${ext}`;
}

function mascararTelefone(telefone: unknown): string {
  if (!telefone) return '';
  const digits = onlyDigits(telefone);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits[2]}****-${digits.slice(-4)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ****-${digits.slice(-4)}`;
  }
  if (digits.length >= 4) {
    return `(**) *****-${digits.slice(-4)}`;
  }
  return '(**) *****-****';
}

export function erroTelefone(telefone: unknown, tipoDoc?: string): string | null {
  const raw = String(telefone ?? '').trim();
  if (!raw) return 'O número de telefone é obrigatório.';
  if (raw.includes('*')) return null;
  if (!/^[+\d\s().-]+$/.test(raw)) return 'Número de telefone inválido.';
  const digits = onlyDigits(raw);
  const isInternacional = raw.startsWith('+') || String(tipoDoc ?? '').toUpperCase() === 'PASSAPORTE';
  if (isInternacional) {
    return digits.length >= 7 && digits.length <= 15 ? null : 'Número de telefone inválido.';
  }
  return digits.length >= 10 && digits.length <= 13 ? null : 'Número de telefone inválido.';
}

function mascararEndereco(endereco: unknown): string {
  if (!endereco) return '';
  const s = String(endereco).trim();
  if (!s) return '';
  const virgula = s.indexOf(',');
  const logradouro = (virgula > 0 ? s.slice(0, virgula) : s).trim();
  const partes = logradouro.split(/\s+/);
  return partes.length <= 1 ? `${partes[0].slice(0, 3)}***` : `${partes[0]} ***, ***`;
}

function mascararNomeMenor(nome: unknown): string {
  if (!nome) return '';
  const partes = String(nome).trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return partes[0] ?? '';
  const primeiro = partes[0];
  const ultimo = partes[partes.length - 1];
  const meio = partes.slice(1, -1).map((p) => `${p[0]}.`).join(' ');
  const meioStr = meio ? ` ${meio}` : '';
  return `${primeiro}${meioStr} ${ultimo[0]}***`;
}

/** Calcula a idade em anos completos a partir de YYYY-MM-DD */
function calcularIdade(nascimento: unknown, refData: Date = new Date()): number | null {
  if (!nascimento) return null;
  const s = String(nascimento).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (!ano || !mes || !dia) return null;
  let idade = refData.getFullYear() - ano;
  const mDiff = (refData.getMonth() + 1) - mes;
  if (mDiff < 0 || (mDiff === 0 && refData.getDate() < dia)) idade--;
  return idade >= 0 ? idade : null;
}

/**
 * Emite um token de sessão assinado por HMAC para o totem.
 * Substitui amarração frágil por IP de socket e IPs hardcoded.
 */
function emiteTotemSession(clienteId: number, totemId: string): string {
  const agora = Date.now();
  const exp = agora + 15 * 60_000;
  const nonce = Math.random().toString(36).slice(2, 8);
  const payload = `${clienteId}:${totemId}:${agora}:${exp}:${nonce}`;
  const sig = sign(`totem_sess:${payload}`);
  return `${payload}:${sig}`;
}

/** Valida o token de sessão assinado por HMAC do totem */
function validaTotemSession(token: string | null | undefined): { clienteId: number; totemId: string } | null {
  if (!token) return null;
  const partes = String(token).trim().split(':');
  if (partes.length !== 6) return null;
  const [cidStr, totemId, agoraStr, expStr, nonce, sig] = partes;
  const payload = `${cidStr}:${totemId}:${agoraStr}:${expStr}:${nonce}`;
  if (sig !== sign(`totem_sess:${payload}`)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  const cid = Number(cidStr);
  if (!Number.isInteger(cid) || cid <= 0) return null;
  return { clienteId: cid, totemId };
}

/**
 * Quem se identificou por último em cada totem (vale 15 min). É o "dono" das vagas pagas pela reserva online do grupo
 * que está no totem: a lista de baterias soma essas vagas e, na inscrição, elas passam para os pilotos do grupo.
 * Valida prioritariamente o header seguro X-Totem-Session ou query totemSession/ts, com fallback para IP.
 */
const identificadoNoTotem = new Map<string, { id: number; em: number }>();
const ipDe = (req: http.IncomingMessage) => String(req.socket.remoteAddress ?? '').replace(/^::ffff:/, '');

function donoNoTotem(req: http.IncomingMessage): number | null {
  const headerToken = req.headers['x-totem-session'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    const s = validaTotemSession(headerToken.trim());
    if (s) return s.clienteId;
  }
  try {
    const u = new URL(req.url ?? '/', 'http://totem');
    const qToken = u.searchParams.get('totemSession') || u.searchParams.get('ts');
    if (qToken) {
      const s = validaTotemSession(qToken);
      if (s) return s.clienteId;
    }
  } catch { /* ignore */ }

  const x = identificadoNoTotem.get(ipDe(req));
  return x && Date.now() - x.em < 15 * 60_000 ? x.id : null;
}

function origemDe(req: http.IncomingMessage): string {
  const totemHeader = req.headers['x-totem-id'];
  if (typeof totemHeader === 'string' && totemHeader.trim()) return totemHeader.trim();

  const clientMachine = String(req.headers['x-client-machine'] ?? '').trim().toUpperCase();
  if (clientMachine === 'TOTEN1' || clientMachine === 'TOTEM1') return 'Totem 1';
  if (clientMachine === 'DESKTOP-4OR2GFI' || clientMachine === 'TOTEN2' || clientMachine === 'TOTEM2') return 'Totem 2';
  if (clientMachine && !clientMachine.startsWith('SRVKART')) return clientMachine;

  const sess = validaTotemSession(String(req.headers['x-totem-session'] ?? ''));
  if (sess?.totemId) return sess.totemId;

  const ip = ipDe(req);
  return ip === '192.168.20.161' ? 'Totem 1' : ip === '192.168.20.69' ? 'Totem 2' : ip || 'totem';
}

/** Rua + número + complemento num texto só, como o totem mostra no campo Endereço. */
function enderecoDoTotem(endereco: unknown, numero: unknown, complemento: unknown) {
  const txt = (v: unknown) => (v == null ? '' : String(v).trim());
  let e = txt(endereco);
  const n = txt(numero);
  const c = txt(complemento);
  if (n && !e.includes(n)) e = e ? `${e}, ${n}` : n;
  if (c && !e.includes(c)) e = e ? `${e} - ${c}` : c;
  return e;
}

// ---------------------------------------------------------------- totem (publico)

async function totemRoutes(req: http.IncomingMessage, res: http.ServerResponse, path: string): Promise<boolean> {
  const method = req.method ?? 'GET';

  if (path === '/api/totem/config' && method === 'GET') {
    const p = await parametros();
    const emp = await one<{ nome: string }>(`SELECT Nome nome FROM dbo.Empresa WHERE Id = 1`);
    send(res, 200, {
      empresa: emp?.nome ?? 'Kartódromo',
      mensagem: p['totem.mensagemBoasVindas'] ?? `Seja bem-vindo(a) ao ${emp?.nome ?? ''}!`,
      imprimirTermo: p['totem.imprimirTermo'] !== 'false',
      consultarCep: p['totem.consultarCep'] !== 'false',
      tecladoVirtual: p['totem.tecladoVirtual'] === 'true',
      permitirMenorSemResponsavel: p['totem.permitirMenorSemResponsavel'] !== 'false',
    });
    return true;
  }

  if (path === '/api/totem/identificar' && method === 'POST') {
    const body = await readBody(req);
    const raw = String(body.identificador ?? '').trim();
    if (raw.length < 5) throw new HttpError(400, 'Informe o CPF, RG, passaporte ou e-mail.');
    const isEmail = raw.includes('@');
    const v = isEmail ? raw.toLowerCase() : onlyDigits(raw) || raw.toUpperCase();
    // e-mail digitado com o domínio errado ("gmal.com") acha o cadastro já corrigido, e vice-versa
    const v2 = isEmail ? corrigeEmail(raw) : v;
    const procurar = () => one<Record<string, unknown>>(
      `SELECT TOP 1 ${CLIENTE_COLS} FROM dbo.Cliente c WHERE ${isEmail ? 'c.Email IN (@v, @v2)' : '(c.DocumentoNum = @v OR c.Documento = @v)'} ORDER BY CASE WHEN c.ResponsavelId IS NULL THEN 0 ELSE 1 END, c.AtualizadoEm DESC`,
      { v, v2 },
    );
    let c = await procurar();
    // não achou: pode ter feito o pré-cadastro pelo QR code há pouco (ainda não sincronizado)
    if (!c && (await buscarPreCadastroAgora(raw, log))) c = await procurar();
    // outro cliente no totem: o anterior deixa de ser o dono das vagas pagas (não passam para um estranho)
    if (!c) return identificadoNoTotem.delete(ipDe(req)), send(res, 200, { cliente: null }), true;
    identificadoNoTotem.set(ipDe(req), { id: Number(c.id), em: Date.now() });
    const totemToken = emiteTotemSession(Number(c.id), origemDe(req));

    const buscaMenores = Boolean(body.menor);
    let dependentesMascarados: Array<{ id: number; nome: string; nascimento: string; token: string }> = [];
    if (buscaMenores) {
      const dependentes = await query<{ id: number; nome: string; nascimento: string }>(
        `SELECT c.Id id, c.Nome nome, CONVERT(varchar(10), c.Nascimento, 126) nascimento FROM dbo.Cliente c WHERE c.ResponsavelId = @id AND c.Bloqueado = 0 ORDER BY c.Nome`,
        { id: c.id },
      );
      dependentesMascarados = dependentes.map((d) => ({ ...d, token: sign(`cli:${d.id}`) })).map((d) => ({
        id: d.id,
        nome: mascararNomeMenor(d.nome),
        nascimento: d.nascimento ? `${d.nascimento.slice(0, 4)}-01-01` : '',
        token: d.token,
      }));
    }

    // cadastro completo (pedido do dono em 26/09): o cliente confere e corrige todos os dados no totem
    const txt = (v: unknown) => (v == null ? '' : String(v).trim());
    const enderecoCompleto = enderecoDoTotem(c.endereco, c.numero, c.complemento);
    const docMasc = mascararDocumento(c.documento, c.tipoDocumento);
    const emailMasc = mascararEmail(c.email);
    const foneMasc = mascararTelefone(c.telefone);
    const endMasc = mascararEndereco(enderecoCompleto);

    send(res, 200, {
      cliente: {
        id: c.id,
        nome: c.nome,
        tipoDocumento: txt(c.tipoDocumento) || 'CPF',
        documento: docMasc,
        documentoMascarado: docMasc,
        email: emailMasc,
        emailMascarado: emailMasc,
        telefone: foneMasc,
        telefoneMascarado: foneMasc,
        nascimento: c.nascimento ? `**/**/${String(c.nascimento).slice(0, 4)}` : '',
        temNascimento: Boolean(c.nascimento),
        peso: c.peso == null ? '' : String(Number(c.peso)),
        cep: txt(c.cep) ? `${txt(c.cep).slice(0, 5)}-***` : '',
        endereco: endMasc,
        enderecoMascarado: endMasc,
        numero: '',
        complemento: '',
        bairro: txt(c.bairro),
        cidade: txt(c.cidade),
        estado: txt(c.estado),
        lgpd: Boolean(c.lgpdAceiteEm),
        bloqueado: Boolean(c.bloqueado),
      },
      dependentes: dependentesMascarados,
      token: sign(`cli:${c.id}`),
      totemToken,
    });
    return true;
  }

  if (path === '/api/totem/cadastro' && method === 'POST') {
    const body = await readBody(req);
    const dados = (body.dados ?? {}) as ClienteInput;
    const id = body.id ? int(body.id, 'Cliente') : null;
    let responsavelId: number | null = null;
    if (body.responsavelId) {
      responsavelId = int(body.responsavelId, 'Responsável');
      if (String(body.responsavelToken ?? '') !== sign(`cli:${responsavelId}`)) throw new HttpError(403, 'Sessão expirada, identifique-se de novo.');
    }
    if (!responsavelId && !body.lgpd) throw new HttpError(400, 'É necessário aceitar o Termo de Consentimento para Tratamento de Dados Pessoais.');
    // Menores podem usar o contato do responsável, inclusive em versões antigas do totem.
    if (responsavelId && !String(dados.email ?? '').trim()) {
      const responsavel = await one<{ email: string | null }>(`SELECT Email email FROM dbo.Cliente WHERE Id = @id`, { id: responsavelId });
      dados.email = responsavel?.email ?? '';
    }

    const idade = calcularIdade(dados.nascimento);
    if (responsavelId) {
      if (body.consentimentoMenor !== true) {
        throw new HttpError(400, 'É obrigatório o consentimento expresso do responsável legal para o tratamento de dados do menor de idade (LGPD Art. 14).');
      }
      if (idade !== null && idade >= 18) {
        throw new HttpError(400, 'Participantes com 18 anos ou mais devem realizar cadastro individual próprio.');
      }
      if (idade !== null && idade < 6) {
        throw new HttpError(400, 'A idade mínima regulamentar para pilotagem é de 6 anos completos.');
      }
    } else {
      if (!id && idade !== null && idade < 18) {
        throw new HttpError(400, 'Menores de 18 anos devem ser cadastrados por um responsável legal (LGPD Art. 14).');
      }
    }

    const semInstagram = Boolean(body.semInstagram || dados.semInstagram);
    dados.semInstagram = semInstagram;

    const erroCadastro = erroCadastroObrigatorio(dados);
    if (erroCadastro) throw new HttpError(400, erroCadastro);
    if (id) {
      if (String(body.token ?? '') !== sign(`cli:${id}`)) throw new HttpError(403, 'Sessão expirada, identifique-se de novo.');

      // Proteção: não sobrescreve campos que retornaram com máscara e não foram alterados
      if (typeof dados.documento === 'string' && dados.documento.includes('***')) delete dados.documento;
      if (typeof dados.email === 'string' && dados.email.includes('***')) delete dados.email;
      if (typeof dados.telefone === 'string' && dados.telefone.includes('***')) delete dados.telefone;
      if (typeof dados.cep === 'string' && dados.cep.includes('***')) delete dados.cep;
      if (typeof dados.documento === 'string' && dados.documento.includes('*')) delete dados.documento;
      if (typeof dados.email === 'string' && dados.email.includes('*')) delete dados.email;
      if (typeof dados.telefone === 'string' && dados.telefone.includes('*')) delete dados.telefone;
      if (typeof dados.cep === 'string' && dados.cep.includes('*')) delete dados.cep;
      if (typeof dados.nascimento === 'string' && (dados.nascimento.includes('*') || !dados.nascimento.trim())) delete dados.nascimento;

      if (dados.documento && !String(dados.documento).includes('*')) {
        const docDigits = onlyDigits(dados.documento);
        if (docDigits) {
          const dup = await one<{ id: number }>(`SELECT TOP 1 Id id FROM dbo.Cliente WHERE DocumentoNum = @d AND Id <> @id`, { d: docDigits, id });
          if (dup) {
            return send(res, 409, {
              error: 'documento_cadastrado',
              message: 'Já existe cadastro com esse documento. Volte e informe o documento para continuar.',
              id: dup.id,
              token: sign(`cli:${dup.id}`),
            }), true;
          }
        }
      }
      if (dados.telefone && !String(dados.telefone).includes('*')) {
        const errTel = erroTelefone(dados.telefone, dados.tipoDocumento);
        if (errTel) throw new HttpError(400, errTel);
      }

      // o totem mostra rua, número e complemento num campo só: se o cliente não mexeu ou se veio mascarado, não regrava
      if (dados.endereco !== undefined) {
        const atual = await one<{ endereco: string | null; numero: string | null; complemento: string | null }>(
          `SELECT Endereco endereco, Numero numero, Complemento complemento FROM dbo.Cliente WHERE Id = @id`,
          { id },
        );
        const digitado = String(dados.endereco ?? '').trim();
        if (digitado.includes('***') || !digitado || (atual && digitado === enderecoDoTotem(atual.endereco, atual.numero, atual.complemento))) {
          delete dados.endereco;
        }
      }

      // Preservação de dados de endereço: NUNCA zera Numero e Complemento como NULL
      await updateCliente(id, { ...dados, lgpd: true }, true);
      const totemToken = emiteTotemSession(id, origemDe(req));
      log(`totem: cadastro atualizado ${id}`);
      return send(res, 200, { id, token: sign(`cli:${id}`), totemToken }), true;
    }
    if (!responsavelId && !String(dados.documento ?? '').trim()) throw new HttpError(400, 'O documento é obrigatório.');
    if (!String(dados.nome ?? '').trim()) throw new HttpError(400, 'O nome é obrigatório.');
    if (String(dados.nome).trim().split(/\s+/).length < 2) throw new HttpError(400, 'Informe o nome completo.');
    if (dados.documento && (dados.tipoDocumento ?? 'CPF') === 'CPF' && !isValidCpf(String(dados.documento))) throw new HttpError(400, 'CPF inválido.');
    if (!responsavelId) {
      const errTel = erroTelefone(dados.telefone, dados.tipoDocumento);
      if (errTel) throw new HttpError(400, errTel);
      const dup = await one<{ id: number }>(`SELECT TOP 1 Id id FROM dbo.Cliente WHERE DocumentoNum = @d`, { d: onlyDigits(dados.documento) });
      if (dup) {
        return send(res, 409, {
          error: 'documento_cadastrado',
          message: 'Já existe cadastro com esse documento. Volte e informe o documento para continuar.',
          id: dup.id,
          token: sign(`cli:${dup.id}`),
        }), true;
      }
    } else if (dados.documento && String(dados.documento).trim()) {
      const dMinor = onlyDigits(dados.documento);
      if (dMinor) {
        const dup = await one<{ id: number }>(`SELECT TOP 1 Id id FROM dbo.Cliente WHERE DocumentoNum = @d`, { d: dMinor });
        if (dup) {
          return send(res, 409, {
            error: 'documento_cadastrado',
            message: 'Já existe cadastro com esse documento.',
            id: dup.id,
            token: sign(`cli:${dup.id}`),
          }), true;
        }
      }
    }
    if (!dados.nascimento) throw new HttpError(400, 'A data de nascimento é obrigatória.');
    const newId = await insertCliente({
      ...dados,
      responsavelId,
      lgpd: true,
      consentimentoMenor: Boolean(responsavelId && body.consentimentoMenor),
      lgpdMenorResponsavelId: responsavelId,
    }, 'totem');
    if (!responsavelId) identificadoNoTotem.set(ipDe(req), { id: newId, em: Date.now() });
    const totemToken = emiteTotemSession(newId, origemDe(req));
    log(`totem: cliente novo ${newId}${responsavelId ? ` (menor de ${responsavelId})` : ''}`);
    send(res, 201, { id: newId, token: sign(`cli:${newId}`), totemToken });
    return true;
  }

  if (path === '/api/totem/baterias' && method === 'GET') {
    const rows = await query<TotemBateriaCandidate>(TOTEM_BATERIAS_SQL);
    // ?grupo=id.token,id.token: vagas que o grupo já tem na bateria (as dele e as pagas online pelo responsável)
    // contam como livres para ele — senão uma bateria lotada pela reserva online sumia do totem para quem pagou
    const grupo = String(new URL(req.url ?? '/', 'http://totem').searchParams.get('grupo') ?? '').split(',').map((x) => x.split('.')).filter(([id, tk]) => Number(id) > 0 && tk === sign(`cli:${Number(id)}`)).map(([id]) => Number(id));
    const dono = donoNoTotem(req);
    if (dono && !grupo.includes(dono)) grupo.push(dono);
    const doGrupo = new Map<number, number>();
    if (grupo.length && rows.length) {
      const bParams: Record<string, unknown> = {};
      const bMarks: string[] = [];
      rows.forEach((r, idx) => {
        const key = `bat_${idx}`;
        bParams[key] = Number(r.id);
        bMarks.push(`@${key}`);
      });

      const gParams: Record<string, unknown> = {};
      const gMarks: string[] = [];
      grupo.forEach((id, idx) => {
        const key = `grp_${idx}`;
        gParams[key] = Number(id);
        gMarks.push(`@${key}`);
      });

      const sqlText = `
        SELECT i.BateriaId b, COUNT(*) n FROM dbo.Inscricao i
        WHERE i.BateriaId IN (${bMarks.join(',')}) AND i.Status <> 'cancelada'
          AND (i.ClienteId IN (${gMarks.join(',')})
               OR (i.Origem = 'site' AND i.Pago = 1 AND i.ClienteId IN (SELECT ResponsavelId FROM dbo.Cliente WHERE Id IN (${gMarks.join(',')}) AND ResponsavelId IS NOT NULL)))
        GROUP BY i.BateriaId`;

      for (const g of await query<{ b: number; n: number }>(sqlText, { ...bParams, ...gParams })) {
        doGrupo.set(g.b, g.n);
      }
    }
    send(res, 200, rows
      .map((r) => ({ ...r, livres: Math.max(0, r.vagas - r.ocupadas) + (doGrupo.get(Number(r.id)) ?? 0) }))
      .filter((r) => bateriaDisponivelNoTotem(r, r.dataHoje, r.agoraHora))
      .map((r) => ({
        id: r.id,
        nome: r.nome,
        inicio: r.inicio,
        vagas: r.vagas,
        tipoKart: r.tipoKart,
        ocupadas: r.ocupadas,
        livres: r.livres,
      })));
    return true;
  }

  if (path === '/api/totem/inscrever' && method === 'POST') {
    const body = await readBody(req);
    const baterias = (Array.isArray(body.bateriaIds) ? body.bateriaIds : [body.bateriaId]).filter(Boolean).map((b) => int(b, 'Bateria'));
    if (!baterias.length) throw new HttpError(400, 'Selecione pelo menos uma bateria.');
    const participantes = Array.isArray(body.participantes) ? body.participantes : [];
    if (!participantes.length) throw new HttpError(400, 'Selecione quem vai correr.');
    const ids: number[] = [];
    // um termo por piloto (mesmo que ele corra em mais de uma bateria): a 1ª inscrição de cada um
    const termoDoPiloto = new Map<number, number>();
    const grupo: number[] = [];
    for (const p of participantes as { id: unknown; token: unknown }[]) {
      const cid = int(p.id, 'Participante');
      if (String(p.token ?? '') !== sign(`cli:${cid}`)) throw new HttpError(403, 'Sessão expirada, identifique-se de novo.');
      grupo.push(cid);
    }
    for (const bateriaId of baterias) {
      // quem já tem vaga na bateria primeiro (o comprador da reserva online fica com a dele; as outras vão para o grupo)
      const existentes = new Map<number, number>();
      for (const cid of grupo) {
        const dup = await one<{ Id: number }>(`SELECT TOP 1 Id FROM dbo.Inscricao WHERE BateriaId = @b AND ClienteId = @c AND Status <> 'cancelada' ORDER BY Id`, { b: bateriaId, c: cid });
        if (dup) existentes.set(cid, dup.Id);
      }
      for (const cid of [...grupo].sort((a, b) => Number(existentes.has(b)) - Number(existentes.has(a)))) {
        const dup = existentes.get(cid);
        if (dup) {
          ids.push(dup);
          if (!termoDoPiloto.has(cid)) termoDoPiloto.set(cid, dup);
          continue;
        }
        const paga = await vagaOnlineDoGrupo(bateriaId, cid, grupo, log, donoNoTotem(req));
        if (paga) {
          ids.push(paga);
          if (!termoDoPiloto.has(cid)) termoDoPiloto.set(cid, paga);
          continue;
        }
        // pre-reserva: aparece em Reservas > Aprovar na recepcao
        const novas = await inscreverN(bateriaId, cid, 1, 'totem', null, null, false);
        ids.push(...novas);
        if (!termoDoPiloto.has(cid) && novas.length) termoDoPiloto.set(cid, novas[0]);
      }
    }
    const primeira = await one<{ inicio: string }>(`SELECT TOP 1 CONVERT(varchar(16), Inicio, 126) inicio FROM dbo.Bateria WHERE Id IN (${baterias.map((_, n) => '@b' + n).join(',')}) ORDER BY Inicio`, Object.fromEntries(baterias.map((b, n) => ['b' + n, b])));
    const p = await parametros();
    log(`totem: ${ids.length} pre-reserva(s) em ${baterias.length} bateria(s)`);
    const imprimir = p['totem.imprimirTermo'] !== 'false';
    const naRecepcao = imprimir && p['totem.termoNaRecepcao'] !== 'false';
    if (naRecepcao) {
      for (const idInscricao of termoDoPiloto.values()) {
        await enfileirarImpressao(termoLink([idInscricao]), 'Termo de responsabilidade', origemDe(req));
      }
    }
    send(res, 201, { inscricoes: ids, inicio: primeira?.inicio, termoUrl: imprimir ? termoLink(ids) : null, termoNaRecepcao: naRecepcao });
    return true;
  }

  return false;
}

// ---------------------------------------------------------------- login da recepcao

// limite simples de tentativas de login por IP (rede local): 10 erros = 15 min de bloqueio
const tentativasLogin = new Map<string, { n: number; ate: number }>();

async function loginRoute(req: http.IncomingMessage, res: http.ServerResponse) {
  const b = await readBody(req);
  const ip = req.socket.remoteAddress ?? '?';
  const agora = Date.now();
  const tent = tentativasLogin.get(ip);
  if (tent && tent.n >= 10 && agora < tent.ate) throw new HttpError(429, 'Muitas tentativas de login. Aguarde alguns minutos.');
  const login = String(b.login ?? '').trim().toLowerCase();
  const senha = String(b.senha ?? '');
  if (!b.termos) throw new HttpError(400, 'É necessário concordar com os termos de uso.');
  const u = await one<{ id: number; nome: string; hash: string; admin: boolean; ativo: boolean }>(`SELECT Id id, Nome nome, SenhaHash hash, Admin admin, Ativo ativo FROM dbo.Usuario WHERE Login = @login`, { login });
  if (!u || !u.ativo || !confereSenha(senha, u.hash)) {
    const reg = tentativasLogin.get(ip) ?? { n: 0, ate: 0 };
    reg.n += 1;
    if (reg.n >= 10) reg.ate = agora + 15 * 60_000;
    tentativasLogin.set(ip, reg);
    log(`login recusado: ${login}`);
    throw new HttpError(401, 'Login ou senha inválidos.');
  }
  tentativasLogin.delete(ip);
  log(`login: ${login}`);
  await query(`UPDATE dbo.Usuario SET UltimoAcesso = SYSDATETIME() WHERE Id = @id`, { id: u.id }).catch(() => undefined);
  send(res, 200, { token: emiteToken({ uid: u.id, nome: u.nome, admin: Boolean(u.admin) }), usuario: { id: u.id, nome: u.nome, admin: Boolean(u.admin) } });
}

function sessaoDe(req: http.IncomingMessage, url: URL) {
  const auth = String(req.headers.authorization ?? '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : url.searchParams.get('t');
  const s = validaToken(token);
  if (!s) throw new HttpError(401, 'Sessão expirada. Entre novamente.');
  return s;
}

// ---------------------------------------------------------------- servidor

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname;
  const method = req.method ?? 'GET';
  try {
    if (method === 'GET' && path.startsWith('/updates/')) {
      const partes = path.slice('/updates/'.length).split('/').map(decodeURIComponent);
      if (partes.length !== 2 || !partes[0] || !partes[1]) return send(res, 404, { error: 'Arquivo de atualização não encontrado.' });
      return sendUpdateFile(res, partes[0], partes[1]);
    }
    if (path === '/' || path === '/recepcao') return sendStatic(res, 'office.html');
    if (path === '/totem') return sendStatic(res, 'totem.html');
    if (path.startsWith('/ui/')) return sendStatic(res, path.slice(4));
    if (path === '/healthz') {
      const r = await one<{ agora: string }>(`SELECT CONVERT(varchar(19), SYSDATETIME(), 126) agora`);
      return send(res, 200, { ok: true, sqlAgora: r?.agora });
    }
    if (path === '/termo') {
      if (url.searchParams.get('branco') === '1') {
        sessaoDe(req, url);
        return sendHtml(res, await termoHtml([], true));
      }
      const ids = String(url.searchParams.get('ids') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 30);
      if (!ids.length || url.searchParams.get('s') !== sign('termo:' + ids.join(','))) throw new HttpError(403, 'Link do termo inválido.');
      return sendHtml(res, await termoHtml(ids));
    }
    if (path.startsWith('/relatorio/')) {
      sessaoDe(req, url);
      const crono = path.match(/^\/relatorio\/crono\/([a-zA-Z0-9_-]{1,80})$/);
      if (crono) {
        const response = await fetchCrono(`${TIMING_URL}/resultado/${encodeURIComponent(crono[1])}`, 30_000);
        if (!response.ok) throw new HttpError(502, 'Não foi possível carregar o resultado da cronometragem.');
        return sendHtml(res, prepararRelatorioRecepcao(await response.text(), TIMING_URL));
      }
      return sendHtml(res, await relatorio(path.slice('/relatorio/'.length), url));
    }
    if (path === '/api/login' && method === 'POST') return await loginRoute(req, res);
    if (path.startsWith('/api/totem/')) {
      if (await totemRoutes(req, res, path)) return;
    }
    if (path.startsWith('/api/office/')) {
      const sessao = sessaoDe(req, url);
      const dadosCrono = path.match(/^\/api\/office\/crono\/dados\/([a-zA-Z0-9_-]{1,80})(\/(?:passings|laps))?$/);
      if (dadosCrono && method === 'GET') {
        const response = await fetchCrono(`${TIMING_URL}/api/sessions/${encodeURIComponent(dadosCrono[1])}${dadosCrono[2] ?? ''}`, 30_000);
        if (!response.ok) throw new HttpError(response.status === 404 ? 404 : 502, 'Dados da cronometragem indisponíveis.');
        const data = await response.json();
        if (dadosCrono[2]) return send(res, 200, data);
        if (!data || !Array.isArray(data.competitors) || !Array.isArray(data.standings)) throw new HttpError(502, 'Resultado da cronometragem inválido.');
        const ids = idsClientesRelatorio(data as SessaoRelatorio);
        if (ids.length > 1000) throw new HttpError(502, 'Quantidade de pilotos inválida.');
        const params = Object.fromEntries(ids.map((id, i) => ['id' + i, id]));
        const clientes = ids.length ? await query<{ id: number; instagram: string | null }>(
          `SELECT Id id, Instagram instagram FROM dbo.Cliente WHERE Id IN (${ids.map((_, i) => '@id' + i).join(',')})`, params,
        ) : [];
        return send(res, 200, acrescentarInstagramRelatorio(data as SessaoRelatorio, clientes));
      }
      const novo = renovaToken(sessao);
      if (novo) res.setHeader('X-Novo-Token', novo);
      if (path === '/api/office/apoio' || path === '/api/office/cad/tracados') await sincronizarTracadosDaCronometragem();
      if (path === '/api/office/termo-link' && method === 'GET') {
        const ids = String(url.searchParams.get('ids') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0);
        return send(res, 200, { url: termoLink(ids) });
      }
      if (path === '/api/office/crono/sessoes' && method === 'GET') {
        const de = String(url.searchParams.get('de') ?? '').match(/^\d{4}-\d{2}-\d{2}$/)?.[0];
        const ate = String(url.searchParams.get('ate') ?? '').match(/^\d{4}-\d{2}-\d{2}$/)?.[0];
        return send(res, 200, await sessoesDaCronometragem(de, ate));
      }
      // agente de impressao do programa da Recepcao
      if (path === '/api/office/impressao/proxima' && method === 'GET') {
        const job = await proximaImpressao();
        return send(res, 200, {
          ok: true,
          job: job ? { id: job.id, url: job.url, titulo: job.titulo, origem: job.origem } : null,
          ...(job ? { id: job.id, url: job.url, titulo: job.titulo, origem: job.origem, tentativa: job.tentativa } : {}),
        });
      }
      if (path === '/api/office/impressao/teste' && method === 'POST') {
        const token = String(req.headers.authorization ?? '').slice(7) || String(url.searchParams.get('t') ?? '');
        const job = await enfileirarImpressao(`/termo?branco=1&t=${encodeURIComponent(token)}`, 'Teste de impressão (termo em branco)', sessao.nome);
        return send(res, 201, { ok: true, id: job.id });
      }
      if (path === '/api/office/impressao/fila' && method === 'GET') {
        const rows = await query<{
          id: number;
          titulo: string;
          origem: string;
          status: string;
          tentativas: number;
          criadoEm: string;
          pegoEm: string | null;
          feitaEm: string | null;
          falhouEm: string | null;
          ultimoErro: string | null;
        }>(`
          SELECT TOP (100)
            Id id, Titulo titulo, Origem origem,
            CASE WHEN Status = 'falhou' AND UltimoErro = 'contingencia' THEN 'contingencia' ELSE Status END status,
            Tentativas tentativas,
            CONVERT(varchar(19), CriadoEm, 126) criadoEm,
            CONVERT(varchar(19), PegoEm, 126) pegoEm,
            CONVERT(varchar(19), FeitaEm, 126) feitaEm,
            CONVERT(varchar(19), FalhouEm, 126) falhouEm,
            UltimoErro ultimoErro
          FROM dbo.FilaImpressao
          WHERE Status IN ('pendente', 'imprimindo')
             OR (Status = 'falhou' AND UltimoErro = 'contingencia')
             OR DATEDIFF(hour, CriadoEm, SYSDATETIME()) < 24
          ORDER BY Id DESC
        `).catch(() => []);
        return send(res, 200, rows);
      }
      const mi = path.match(/^\/api\/office\/impressao\/(\d+)\/(feita|falhou)$/);
      if (mi && method === 'POST') {
        const id = Number(mi[1]);
        if (mi[2] === 'feita') {
          await query(`
            UPDATE dbo.FilaImpressao
            SET Status = 'impressa', FeitaEm = SYSDATETIME()
            WHERE Id = @id
          `, { id });
          log(`impressao #${id} impressa na recepcao (${sessao.nome})`);
          return send(res, 200, { ok: true });
        }
        if (mi[2] === 'falhou') {
          await query(`
            UPDATE dbo.FilaImpressao
            SET Status = 'falhou',
                FalhouEm = SYSDATETIME()
            WHERE Id = @id
          `, { id });
          log(`impressao #${id} falhou na recepcao (${sessao.nome})`);
          return send(res, 200, { ok: true });
        }
      }
      const mr = path.match(/^\/api\/office\/impressao\/(\d+)\/reimprimir$/);
      if (mr && method === 'POST') {
        const id = Number(mr[1]);
        await query(`
          UPDATE dbo.FilaImpressao
          SET Status = 'pendente', PegoEm = NULL, Tentativas = 0, UltimoErro = NULL
          WHERE Id = @id
        `, { id });
        log(`impressao #${id} reenfileirada pela recepcao (${sessao.nome})`);
        return send(res, 200, { ok: true });
      }
      const handled = await officeRoutes({ method, url, sessao, body: () => readBody(req) }, (status, body) => send(res, status, body));
      if (handled) return;
    }
    if (path.startsWith('/api/crono/')) {
      requireKey(req);
      if (path === '/api/crono/baterias' || path.startsWith('/api/crono/baterias/')) await sincronizarTracadosDaCronometragem();
      let m = path.match(/^\/api\/crono\/baterias\/(\d+)\/grid$/);
      if (m) {
        const rows = await query(
          `SELECT i.Id inscricaoId, c.Nome nome, i.Kart kart, i.Pago pago, i.Aprovada aprovada, c.Id clienteId FROM dbo.Inscricao i JOIN dbo.Cliente c ON c.Id = i.ClienteId
           WHERE i.BateriaId = @id AND i.Status <> 'cancelada' ORDER BY i.Id`,
          { id: Number(m[1]) },
        );
        return send(res, 200, rows);
      }
      if (path === '/api/crono/uso-karts' && method === 'POST') {
        // Horas de uso dos karts (controle da oficina): a cronometragem manda, ao encerrar a bateria, quantos minutos
        // cada kart ficou na pista. Era o LapTime que fazia isso; desde 23/09 o contador estava parado.
        const b = (await readBody(req)) as { agendaId?: unknown; karts?: { kart?: unknown; minutos?: unknown }[] };
        const agendaId = Number(b.agendaId);
        const cat = agendaId > 0
          ? (await one<{ c: string | null }>(`SELECT p.Categoria c FROM dbo.Bateria b JOIN dbo.Produto p ON p.Id = b.ProdutoId WHERE b.Id = @id`, { id: agendaId }))?.c ?? null
          : null;
        let somados = 0, criados = 0, ignorados = 0;
        for (const k of Array.isArray(b.karts) ? b.karts : []) {
          const numero = Number(String(k.kart ?? '').trim());
          const minutos = Math.round(Number(k.minutos));
          if (!Number.isSafeInteger(numero) || numero <= 0 || !(minutos > 0) || minutos > 600) { ignorados++; continue; }
          const linhas = await query<{ id: number; categoria: string | null; item: number | null; minutos: number; ultima: string | null }>(
            `SELECT Id id, Categoria categoria, ItemId item, MinutosUso minutos, CONVERT(varchar(19), UltimaManutencao, 126) ultima
             FROM dbo.Manutencao WHERE KartNumero = @n`, { n: numero });
          const cats = [...new Set(linhas.map((l) => l.categoria ?? ''))];
          const daCategoria = cat ? linhas.filter((l) => (l.categoria ?? '') === cat) : cats.length === 1 ? linhas : [];
          // o LapTime deixou controles repetidos do mesmo kart ("01" e "1", "12" e "12 "): soma só em UM por item —
          // o que já teve manutenção registrada mais recente, senão o de mais horas (antes somava em todos)
          const porItem = new Map<string, typeof daCategoria>();
          for (const l of daCategoria) porItem.set(String(l.item ?? ''), [...(porItem.get(String(l.item ?? '')) ?? []), l]);
          const alvo = [...porItem.values()].map((g) => g.sort((a, x) => (x.ultima ?? '').localeCompare(a.ultima ?? '') || x.minutos - a.minutos || a.id - x.id)[0]);
          if (!alvo.length && cat) {
            // kart novo nessa categoria: abre o controle com os itens que contam por hora
            const r = await query(`INSERT dbo.Manutencao (Kart, Categoria, ItemId, MinutosUso, Realizada, Data)
              SELECT @k, @c, Id, @m, 0, SYSDATETIME() FROM dbo.ItemManutencao WHERE Ativo = 1 AND ControlaPorTempo = 1`, { k: String(numero), c: cat, m: minutos });
            void r; criados++;
            continue;
          }
          if (!alvo.length) { ignorados++; continue; }
          for (const l of alvo) {
            // somar uso depois de uma manutenção feita abre um ciclo novo (volta para "A realizar" contando do zero)
            await query(`UPDATE dbo.Manutencao SET MinutosUso = MinutosUso + @m, Realizada = 0, Data = SYSDATETIME() WHERE Id = @id`, { m: minutos, id: l.id });
            somados++;
          }
        }
        return send(res, 200, { ok: true, categoria: cat, somados, criados, ignorados });
      }
      if (path === '/api/crono/empresa' && method === 'GET') {
        // dados da empresa (Cadastros › Empresa da recepção) para o cabeçalho da cronometragem, só leitura
        return send(res, 200, await one(`SELECT Nome nome, Cnpj cnpj, Telefone telefone, Email email, Endereco endereco, Numero numero, Bairro bairro, Cidade cidade, Estado estado
          FROM dbo.Empresa WHERE Id = 1`) ?? {});
      }
      if (path === '/api/crono/clientes' && method === 'GET') {
        // dados dos pilotos para a lista de competidores da cronometragem (só leitura)
        const ids = String(url.searchParams.get('ids') ?? '').split(',').map(Number).filter((n) => Number.isSafeInteger(n) && n > 0).slice(0, 200);
        if (!ids.length) return send(res, 200, []);
        return send(res, 200, await query(`SELECT Id id, Email email, Cidade cidade, Estado uf, Peso peso, Sexo sexo, Telefone telefone FROM dbo.Cliente WHERE Id IN (${ids.join(',')})`));
      }
      m = path.match(/^\/api\/crono\/baterias\/(\d+)\/programa$/);
      if (m) {
        return send(res, 200, await query(`SELECT pp.Ordem ordem, pp.Nome nome, pp.Tipo tipo, pp.Finalizacao finalizacao, pp.TempoMin tempoMin, pp.VoltasMax voltasMax, b.VoltaMinimaSeg voltaMinimaSeg, t.TimingTrackId trackId
          FROM dbo.Bateria b JOIN dbo.ProdutoProva pp ON pp.ProdutoId = b.ProdutoId LEFT JOIN dbo.Tracado t ON t.Id = b.TracadoId
          WHERE b.Id = @id ORDER BY pp.Ordem`, { id: Number(m[1]) }));
      }
      if (path === '/api/crono/baterias' && method === 'GET') {
        const data = String(url.searchParams.get('data') ?? '');
        return send(res, 200, await query(
          `SELECT b.Id id, b.Nome nome, CONVERT(varchar(16), b.Inicio, 126) inicio, b.Vagas vagas, b.TipoKart tipoKart, t.TimingTrackId trackId,
                  (SELECT COUNT(*) FROM dbo.Inscricao i WHERE i.BateriaId = b.Id AND i.Status <> 'cancelada') inscritos,
                  (SELECT COUNT(*) FROM dbo.Inscricao i WHERE i.BateriaId = b.Id AND i.Status <> 'cancelada' AND i.Pago = 1) pagos
           FROM dbo.Bateria b LEFT JOIN dbo.Tracado t ON t.Id = b.TracadoId
           WHERE b.Status <> 'cancelada' AND b.Inicio >= @d AND b.Inicio < DATEADD(day, 1, @d) ORDER BY b.Inicio`,
          { d: /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }) },
        ));
      }
    }
    // compatibilidade com a cronometragem instalada antes (usa /api/baterias?data= com a chave)
    if (path === '/api/baterias' && method === 'GET') {
      requireKey(req);
      await sincronizarTracadosDaCronometragem();
      const data = String(url.searchParams.get('data') ?? '');
      return send(res, 200, await query(
        `SELECT b.Id id, b.Nome nome, CONVERT(varchar(16), b.Inicio, 126) inicio, b.Vagas vagas, b.TipoKart tipoKart, t.TimingTrackId trackId,
                (SELECT COUNT(*) FROM dbo.Inscricao i WHERE i.BateriaId = b.Id AND i.Status <> 'cancelada') inscritos,
                (SELECT COUNT(*) FROM dbo.Inscricao i WHERE i.BateriaId = b.Id AND i.Status <> 'cancelada' AND i.Pago = 1) pagos
         FROM dbo.Bateria b LEFT JOIN dbo.Tracado t ON t.Id = b.TracadoId
         WHERE b.Status <> 'cancelada' AND b.Inicio >= @d AND b.Inicio < DATEADD(day, 1, @d) ORDER BY b.Inicio`,
        { d: /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }) },
      ));
    }
    send(res, 404, { error: 'Rota desconhecida.' });
  } catch (err) {
    // relatórios e termos abrem dentro do visualizador da Recepção: erro vira página legível, não JSON cru
    // (ex.: "Participantes" sem bateria mostrava {"error":"Bateria não encontrada."})
    if ((path.startsWith('/relatorio/') || path === '/termo') && !res.headersSent) {
      const msg = err instanceof HttpError ? err.message : 'Não foi possível montar este relatório agora. Tente de novo.';
      if (!(err instanceof HttpError)) log('erro', method, path, err);
      res.writeHead(err instanceof HttpError ? err.status : 500, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(paginaDeErro(msg));
    }
    if (err instanceof HttpError) return send(res, err.status, { error: err.message });
    log('erro', method, path, err);
    if (!res.headersSent) send(res, 500, { error: 'Erro interno. Tente de novo.' });
  }
});

function paginaDeErro(msg: string) {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Relatório indisponível</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F5F5F7;font-family:"Segoe UI",system-ui,sans-serif;color:#1D1D1F}
.c{max-width:460px;margin:24px;padding:28px 32px;background:#fff;border:1px solid #E5E5EA;border-radius:14px;text-align:center}
.i{width:44px;height:44px;margin:0 auto 12px;border-radius:50%;background:#FFF4E5;color:#C2410C;font:700 24px/44px "Segoe UI"}h1{margin:0 0 6px;font-size:18px}p{margin:0;color:#6E6E73;font-size:14px;line-height:1.45}</style></head>
<body><div class="c"><div class="i">!</div><h1>Relatório indisponível</h1><p>${esc(msg)}</p></div></body></html>`;
}

server.listen(PORT, '0.0.0.0', () => log(`Servidor da operacao em http://0.0.0.0:${PORT} (recepcao /recepcao, totem /totem)`));

// pré-cadastro online (QR code): traz os cadastros do site a cada 30 s
if (preCadastroLigado()) {
  let sincronizando = false;
  const sincronizar = async () => {
    if (sincronizando) return;
    sincronizando = true;
    try {
      const n = await sincronizarPreCadastros(log);
      if (n) log(`pré-cadastro: ${n} cadastro(s) do site gravado(s)`);
    } catch (e) {
      log(`pré-cadastro: sincronização falhou (${(e as Error).message})`);
    } finally {
      sincronizando = false;
    }
  };
  setTimeout(sincronizar, 5_000);
  setInterval(sincronizar, 30_000).unref();
  log('pré-cadastro online ligado');
}

// reserva online (reservas.kartodromodebetim.com.br): agenda a cada 5 s, pedidos/pagamentos/prazos a cada 5 s.
// Liga com OPS_RESERVA_ONLINE=1 no .env.local (usa a mesma chave do pré-cadastro).
if (preCadastroLigado() && process.env.OPS_RESERVA_ONLINE === '1') {
  let ocupado = false, ultimoErro = 0;
  const falhou = (o: string, e: unknown) => { if (Date.now() - ultimoErro > 60_000) { ultimoErro = Date.now(); log(`reserva online: ${o} falhou (${(e as Error).message})`); } };
  const pedidos = async () => {
    if (ocupado) return;
    ocupado = true;
    try { await sincronizarReservasOnline(log); } catch (e) { falhou('pedidos', e); } finally { ocupado = false; }
  };
  const agenda = async () => { try { await publicarAgenda(); } catch (e) { falhou('agenda', e); } };
  setTimeout(agenda, 3_000);
  setInterval(agenda, 5_000).unref();
  setInterval(pedidos, 5_000).unref();
  log('reserva online ligada');
}

// ---------------------------------------------------------------- estabilidade de runtime
process.on('uncaughtException', (err) => {
  console.error('CRITICAL: uncaughtException capturada no ops-server:', err);
  log(`CRITICAL: uncaughtException: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
});

process.on('unhandledRejection', (reason) => {
  console.error('CRITICAL: unhandledRejection capturada no ops-server:', reason);
  log(`CRITICAL: unhandledRejection: ${reason instanceof Error ? reason.stack ?? reason.message : String(reason)}`);
});

