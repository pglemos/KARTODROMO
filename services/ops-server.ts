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
import { apagarFotoDoApp, fotoDoBanco, gravarFotoDoApp } from '../lib/ops/foto-app';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { pipeline } from 'node:stream';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { caminhoArquivoAtualizacao, tipoConteudoAtualizacao } from '../lib/desktop-updates';
import { CLIENTE_COLS, insertCliente, isValidCpf, one, onlyDigits, query, updateCliente, type ClienteInput } from '../lib/ops/db';
import { confereSenha, emiteToken, renovaToken, situacaoSegredoSessao, validaToken } from '../lib/ops/auth';
import { corrigeEmail } from '../lib/ops/email-dominio';
import { erroCadastroObrigatorio } from '../lib/ops/cadastro-obrigatorio';
import { acrescentarInstagramRelatorio, idsClientesRelatorio, prepararRelatorioRecepcao, type SessaoRelatorio } from '../lib/ops/relatorio-crono';
import { HttpError, inscreverN, officeRoutes } from '../lib/ops/office';
import { garantirSchemaVouchers, vouchersDisponiveisParaCliente } from '../lib/ops/vouchers';
import { garantirColunasEventos } from '../lib/ops/eventos-schema';
import { bateriaDisponivelNoTotem, type TotemBateriaCandidate, TOTEM_BATERIAS_SQL } from '../lib/ops/totem-baterias';
import { relatorio } from '../lib/ops/relatorios';
import { renderTermoResponsabilidade, type TermoParticipante } from '../lib/ops/termo';
import { buscarPreCadastroAgora, preCadastroLigado, sincronizarPreCadastros } from '../lib/ops/pre-cadastro';
import { publicarTermoNoSite } from '../lib/ops/termo-online';
import { aplicarCancelamentos, aplicarCheckins } from '../lib/ops/checkin';
import { aplicarAcoesDoPainel, enviarLembretesDosGrupos, expirarGruposDoAgente, soltarVagasNaoPagasDoSite, conferirCobrancas, entrarNoGrupoPeloTotem, gruposDoDiaNoTotem, gruposRoutes, publicarGruposNoSite, puxarPagamentosDiretoDoAsaas, vincularPorDados } from '../lib/ops/grupos';
import { campeonatoOfficeRoutes, campeonatoSiteRoutes, conferirCobrancasCampeonato } from '../lib/ops/campeonato-inscricoes';
import { painelRoutes, registrarSinal } from '../lib/ops/painel';
import { enduranceDasBaterias, enduranceRoutes, equipesParaOTotem, paginaDoChefe, vincularNoTotem } from '../lib/ops/endurance';
import { ENDURANCE_VINCULO_SQL } from '../lib/ops/endurance-vinculo';
import { atualizarIndice as atualizarIndicePilotos, pilotosRoutes } from '../lib/ops/pilotos';
import { descreverAndamento, emCurso } from '../lib/ops/andamento';
import { acertarCuponsDosGrupos, precoDaVagaPeloLink, publicarAgenda, sincronizarReservasOnline, vagaOnlineDoGrupo } from '../lib/ops/reserva-online';
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
{
  const situacao = situacaoSegredoSessao();
  if (situacao === 'ausente') {
    console.error('ERRO: OPS_SESSION_SECRET nao configurado. Sem ele ninguem consegue entrar na Recepcao. Defina no .env.local e reinicie.');
    process.exit(1);
  }
  if (situacao === 'compartilhado') console.warn('ATENCAO: OPS_SESSION_SECRET nao definido; a sessao da Recepcao esta assinada com OPS_RECEPCAO_KEY. Crie um segredo proprio.');
}

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
  if (atraso > 2000) log(`AVISO: event loop travado por ${atraso} ms · em curso: ${descreverAndamento(agora)}`);
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
  // Sem OPS_RECEPCAO_KEY o servidor ficava ABERTO (grid com nomes e fotos, termo forjável). Agora fecha.
  if (!KEY) throw new HttpError(503, 'Servidor sem OPS_RECEPCAO_KEY configurada.');
  const got = Buffer.from(String(req.headers['x-ops-key'] ?? ''));
  const want = Buffer.from(KEY);
  if (got.length !== want.length || !timingSafeEqual(got, want)) throw new HttpError(401, 'Chave inválida.');
}

/** Chamada do servidor do app (worker de cadastro): mesma chave que o ops-server usa para falar com o app. */
function requireChaveDoApp(req: http.IncomingMessage) {
  const want = Buffer.from(process.env.MOBILE_ADMIN_TOKEN || '');
  const got = Buffer.from(String(req.headers['x-mobile-admin-token'] ?? ''));
  if (!want.length || got.length !== want.length || !timingSafeEqual(got, want)) throw new HttpError(401, 'Chave inválida.');
}

async function readBytes(req: http.IncomingMessage, max: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > max) throw new HttpError(413, 'Arquivo grande demais.');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

function sendImagem(res: http.ServerResponse, bytes: Buffer, tipo: string) {
  res.writeHead(200, { 'content-type': tipo, 'content-length': bytes.length, 'cache-control': 'no-store' });
  res.end(bytes);
}

const sign = (text: string) => createHmac('sha256', KEY || 'sem-chave').update(text).digest('base64url').slice(0, 22);
export const termoLink = (ids: number[]) => `/termo?ids=${ids.join(',')}&s=${sign('termo:' + ids.join(','))}`;

const int = (v: unknown, name: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${name} inválido.`);
  return n;
};

async function sessoesDaCronometragem(de?: string, ate?: string): Promise<ReceptionTimingSession[]> {
  let response: Response;
  try {
    response = await fetch(`${TIMING_URL}/api/sessions`, { signal: AbortSignal.timeout(6_000) });
  } catch {
    throw new HttpError(502, 'A cronometragem está indisponível no momento.');
  }
  if (!response.ok) throw new HttpError(502, `A cronometragem respondeu HTTP ${response.status}.`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new HttpError(502, 'A cronometragem devolveu uma lista inválida de baterias.');
  return selecionarSessoesParaRelatorio(payload as ReceptionTimingSession[], de, ate);
}


async function parametros() {
  return Object.fromEntries((await query<{ k: string; v: string }>(`SELECT chave k, valor v FROM kart.parametro`)).map((p) => [p.k, p.v]));
}

// ---------------------------------------------------------------- termo

async function termoHtml(ids: number[], branco = false) {
  const empresa = await one<{ nome: string; razaoSocial: string | null; cidade: string | null }>(
    'SELECT nome nome, razao_social "razaoSocial", cidade cidade FROM kart.empresa WHERE id = 1',
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
      `SELECT c.nome nome, c.documento documento, to_char(c.nascimento, 'YYYY-MM-DD') nascimento,
        c.email email, c.telefone telefone, c.cep cep, c.endereco endereco, c.numero numero, c.complemento complemento,
        c.bairro bairro, c.cidade cidade, r.nome "responsavelNome", r.documento "responsavelDocumento",
        r.telefone "responsavelTelefone", r.email "responsavelEmail", i.bateria_id "bateriaId", b.nome "bateriaNome",
        to_char(b.inicio, 'YYYY-MM-DD"T"HH24:MI:SS') "bateriaInicio", grupo.responsavel "grupoResponsavel"
        FROM kart.inscricao i JOIN kart.bateria b ON b.id = i.bateria_id JOIN kart.cliente c ON c.id = i.cliente_id
        LEFT JOIN kart.cliente r ON r.id = c.responsavel_id
        LEFT JOIN LATERAL (SELECT split_part(ltrim(rc.nome), ' ', 1) responsavel FROM kart.reserva_grupo g JOIN kart.cliente rc ON rc.id = g.responsavel_id
          WHERE g.bateria_id = i.bateria_id AND g.status <> 'cancelada' AND (g.responsavel_id = i.cliente_id OR EXISTS (SELECT 1 FROM kart.reserva_grupo_piloto gp WHERE gp.grupo_id = g.id AND (gp.inscricao_id = i.id OR gp.cliente_id = i.cliente_id)))
          ORDER BY g.id DESC LIMIT 1) grupo ON true
        WHERE i.id IN (${placeholders})`,
      params,
    ));
    if (participantes.length) {
      await query(
        'UPDATE kart.inscricao SET termo_impresso_em = now() WHERE id IN (' + placeholders + ')',
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
// O totem nao tem impressora: o termo entra nesta fila e o programa da Recepcao (com a TM-T20)
// pega e imprime em segundos. A fila em disco preserva os trabalhos durante reinícios.
type Impressao = { id: number; url: string; titulo: string; origem: string; criadoEm: number; pegoEm?: number; feitaEm?: number; canceladaEm?: number; tentativas: number };
const arquivoFilaImpressao = join(process.cwd(), '.runtime', 'impressao-fila.json');

function carregarFilaImpressao(): Impressao[] {
  if (!existsSync(arquivoFilaImpressao)) return [];
  try {
    const raw = JSON.parse(readFileSync(arquivoFilaImpressao, 'utf8'));
    const itens = Array.isArray(raw) ? raw : Array.isArray(raw?.value) ? raw.value : [];
    let maxId = 0;
    const lista: Impressao[] = [];
    for (const item of itens) {
      if (item && typeof item === 'object' && typeof item.url === 'string') {
        const id = Number.isFinite(item.id) && item.id > 0 ? Number(item.id) : null;
        if (id && id > maxId) maxId = id;
        lista.push({
          id: id ?? 0,
          url: String(item.url),
          titulo: String(item.titulo ?? 'Termo de responsabilidade'),
          origem: String(item.origem ?? 'totem'),
          criadoEm: Number.isFinite(item.criadoEm) ? Number(item.criadoEm) : Date.now(),
          pegoEm: Number.isFinite(item.pegoEm) ? Number(item.pegoEm) : undefined,
          feitaEm: Number.isFinite(item.feitaEm) ? Number(item.feitaEm) : undefined,
          canceladaEm: Number.isFinite(item.canceladaEm) ? Number(item.canceladaEm) : undefined,
          tentativas: Number.isFinite(item.tentativas) ? Number(item.tentativas) : 0,
        });
      }
    }
    for (const j of lista) {
      if (j.id <= 0) j.id = ++maxId;
    }
    return lista;
  } catch {
    return [];
  }
}

const filaImpressao: Impressao[] = carregarFilaImpressao();
let seqImpressao = filaImpressao.reduce((max, j) => (Number.isFinite(j.id) && j.id > max ? j.id : max), 0);

function salvarFilaImpressao() {
  mkdirSync(dirname(arquivoFilaImpressao), { recursive: true });
  writeFileSync(arquivoFilaImpressao + '.tmp', JSON.stringify(filaImpressao), { mode: 0o600 });
  renameSync(arquivoFilaImpressao + '.tmp', arquivoFilaImpressao);
}
const IMPRESSAO_VALIDADE_MS = 3 * 60 * 60 * 1000;
const IMPRESSAO_REENTREGA_MS = 90 * 1000;

function enfileirarImpressao(url: string, titulo: string, origem: string) {
  const agora = Date.now();
  for (let i = filaImpressao.length - 1; i >= 0; i--) if (agora - filaImpressao[i].criadoEm > IMPRESSAO_VALIDADE_MS) filaImpressao.splice(i, 1);
  if (!Number.isFinite(seqImpressao) || seqImpressao <= 0) {
    seqImpressao = filaImpressao.reduce((max, j) => (Number.isFinite(j.id) && j.id > max ? j.id : max), 0);
  }
  const job: Impressao = { id: ++seqImpressao, url, titulo, origem, criadoEm: agora, tentativas: 0 };
  filaImpressao.push(job);
  salvarFilaImpressao();
  log(`impressao #${job.id} na fila (${titulo}, ${origem})`);
  return job;
}

function proximaImpressao() {
  const agora = Date.now();
  const job = filaImpressao.find((j) => Number.isFinite(j.id) && j.id > 0 && !j.feitaEm && !j.canceladaEm && j.tentativas < 10 && agora - j.criadoEm <= IMPRESSAO_VALIDADE_MS && (!j.pegoEm || agora - j.pegoEm > IMPRESSAO_REENTREGA_MS));
  if (!job) return null;
  job.pegoEm = agora;
  job.tentativas++;
  salvarFilaImpressao();
  return job;
}

/**
 * Quem se identificou por último em cada totem (vale 15 min). É o "dono" das vagas pagas pela reserva online do grupo
 * que está no totem: a lista de baterias soma essas vagas e, na inscrição, elas passam para os pilotos do grupo
 * (mesmo que quem pagou não vá correr). Fica só no servidor: o app do totem aprovado não muda.
 */
const identificadoNoTotem = new Map<string, { id: number; em: number }>();
const ipDe = (req: http.IncomingMessage) => String(req.socket?.remoteAddress ?? '').replace(/^::ffff:/, '');
function donoNoTotem(req: http.IncomingMessage) {
  const x = identificadoNoTotem.get(ipDe(req));
  return x && Date.now() - x.em < 15 * 60_000 ? x.id : null;
}

function origemDe(req: http.IncomingMessage) {
  const ip = String(req.socket?.remoteAddress ?? '').replace(/^::ffff:/, '');
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
  const getParam = (name: string): string => {
    const rawUrl = req.url ?? '';
    const idx = rawUrl.indexOf('?');
    if (idx === -1) return '';
    const q = rawUrl.slice(idx + 1);
    for (const pair of q.split('&')) {
      const [k, v] = pair.split('=');
      if (decodeURIComponent(k || '') === name) return decodeURIComponent(v || '').replace(/\+/g, ' ');
    }
    return '';
  };

  if (path === '/api/totem/config' && method === 'GET') {
    const p = await parametros();
    const emp = await one<{ nome: string }>(`SELECT nome nome FROM kart.empresa WHERE id = 1`);
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

  // preço da vaga de quem entra pelo link do grupo (estreante paga o de primeira vez): o site pergunta ao gerar a cobrança
  if (path === '/api/totem/grupo-preco' && method === 'POST') {
    const body = await readBody(req);
    const r = await precoDaVagaPeloLink(String(body.token ?? ''), String(body.cpf ?? ''), String(body.cupom ?? ''));
    if (!r) throw new HttpError(404, 'Grupo não encontrado.');
    send(res, 200, r);
    return true;
  }
  if ((path === '/api/totem/identificar' || path === '/api/publico/cliente-busca') && (method === 'POST' || method === 'GET')) {
    const body = method === 'POST' ? await readBody(req) : {};
    const raw = String(body.identificador ?? body.documento ?? body.cpf ?? getParam('identificador') ?? getParam('q') ?? getParam('cpf') ?? getParam('documento') ?? '').trim();
    if (raw.length < 5) throw new HttpError(400, 'Informe o CPF, RG, passaporte, telefone ou e-mail.');
    const isEmail = raw.includes('@');
    const dig = onlyDigits(raw);
    const v = isEmail ? raw.toLowerCase() : dig || raw.toUpperCase();
    // e-mail digitado com o domínio errado ("gmal.com") acha o cadastro já corrigido, e vice-versa
    const v2 = isEmail ? corrigeEmail(raw) : v;
    const procurar = () => {
      if (isEmail) {
        return one<Record<string, unknown>>(
          `SELECT ${CLIENTE_COLS} FROM kart.cliente c WHERE lower(c.email) IN (lower(@v), lower(@v2)) ORDER BY CASE WHEN c.responsavel_id IS NULL THEN 0 ELSE 1 END, c.atualizado_em DESC LIMIT 1`,
          { v, v2 },
        );
      }
      if (dig && dig.length >= 10) {
        return one<Record<string, unknown>>(
          `SELECT ${CLIENTE_COLS} FROM kart.cliente c
            WHERE (c.documento_num = @dig OR c.documento = @raw OR c.documento = @dig
               OR c.telefone_num = @dig OR c.telefone LIKE @phoneLike)
            ORDER BY CASE WHEN c.documento_num = @dig OR c.documento = @raw THEN 0 ELSE 1 END,
                     CASE WHEN c.responsavel_id IS NULL THEN 0 ELSE 1 END,
                     c.atualizado_em DESC LIMIT 1`,
          { dig, raw, phoneLike: '%' + dig.slice(-8) },
        );
      }
      if (dig && dig.length >= 4) {
        return one<Record<string, unknown>>(
          `SELECT ${CLIENTE_COLS} FROM kart.cliente c
            WHERE (c.documento_num = @dig OR c.documento = @raw OR c.documento = @dig)
            ORDER BY CASE WHEN c.responsavel_id IS NULL THEN 0 ELSE 1 END, c.atualizado_em DESC LIMIT 1`,
          { dig, raw },
        );
      }
      const nomeLike = '%' + raw.replace(/\s+/g, '%') + '%';
      return one<Record<string, unknown>>(
        `SELECT ${CLIENTE_COLS} FROM kart.cliente c
          WHERE (c.documento = @raw OR unaccent(c.nome) ILIKE unaccent(@nomeLike))
          ORDER BY CASE WHEN c.documento = @raw THEN 0 ELSE 1 END,
                   CASE WHEN c.responsavel_id IS NULL THEN 0 ELSE 1 END,
                   c.atualizado_em DESC LIMIT 1`,
        { raw, nomeLike },
      );
    };
    let c = await procurar();
    // não achou: pode ter feito o pré-cadastro pelo QR code há pouco (ainda não sincronizado)
    if (!c && (await buscarPreCadastroAgora(raw, log))) c = await procurar();
    // outro cliente no totem: o anterior deixa de ser o dono das vagas pagas (não passam para um estranho)
    if (!c) return identificadoNoTotem.delete(ipDe(req)), send(res, 200, { cliente: null }), true;
    identificadoNoTotem.set(ipDe(req), { id: Number(c.id), em: Date.now() });
    const dependentes = await query<{ id: number; nome: string; nascimento: string }>(
      `SELECT c.id id, c.nome nome, to_char(c.nascimento, 'YYYY-MM-DD') nascimento FROM kart.cliente c WHERE c.responsavel_id = @id AND c.bloqueado = false ORDER BY c.nome`,
      { id: c.id },
    );
    // cadastro completo (pedido do dono em 26/09): o cliente confere e corrige todos os dados no totem
    const txt = (v: unknown) => (v == null ? '' : String(v).trim());
    const num = txt(c.numero);
    const comp = txt(c.complemento);
    const rua = txt(c.endereco);
    const enderecoCompleto = enderecoDoTotem(c.endereco, c.numero, c.complemento);

    send(res, 200, {
      cliente: {
        id: c.id,
        nome: c.nome,
        tipoDocumento: txt(c.tipoDocumento) || 'CPF',
        documento: txt(c.documento),
        email: txt(c.email),
        // sem isso o totem abria o campo vazio e exigia o @ de novo a cada visita
        instagram: txt(c.instagram),
        telefone: txt(c.telefone),
        nascimento: txt(c.nascimento),
        temNascimento: Boolean(c.nascimento),
        peso: c.peso == null ? '' : String(Number(c.peso)),
        cep: txt(c.cep),
        rua,
        endereco: enderecoCompleto,
        numero: num,
        complemento: comp,
        bairro: txt(c.bairro),
        cidade: txt(c.cidade),
        estado: txt(c.estado),
        sexo: txt(c.sexo),
        tipoSanguineo: txt(c.tipoSanguineo),
        lgpd: Boolean(c.lgpdAceiteEm),
        bloqueado: Boolean(c.bloqueado),
      },
      dependentes: dependentes.map((d) => ({ ...d, token: sign(`cli:${d.id}`) })),
      token: sign(`cli:${c.id}`),
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
      const responsavel = await one<{ email: string | null }>(`SELECT email email FROM kart.cliente WHERE id = @id`, { id: responsavelId });
      dados.email = responsavel?.email ?? '';
    }
    const erroCadastro = erroCadastroObrigatorio(dados);
    if (erroCadastro) throw new HttpError(400, erroCadastro);
    if (id) {
      if (String(body.token ?? '') !== sign(`cli:${id}`)) throw new HttpError(403, 'Sessão expirada, identifique-se de novo.');
      // o totem mostra rua, número e complemento num campo só: se o cliente não mexeu, não regrava
      // (senão o número e o complemento saíam repetidos no termo); se mexeu, o texto vira o endereço todo
      let limparNumero = false;
      if (dados.endereco !== undefined) {
        const atual = await one<{ endereco: string | null; numero: string | null; complemento: string | null }>(
          `SELECT endereco endereco, numero numero, complemento complemento FROM kart.cliente WHERE id = @id`,
          { id },
        );
        const digitado = String(dados.endereco ?? '').trim();
        if (!digitado || (atual && digitado === enderecoDoTotem(atual.endereco, atual.numero, atual.complemento))) delete dados.endereco;
        else limparNumero = Boolean(atual?.numero || atual?.complemento);
      }
      await updateCliente(id, { ...dados, lgpd: true }, true);
      if (limparNumero) await query(`UPDATE kart.cliente SET numero = NULL, complemento = NULL WHERE id = @id`, { id });
      log(`totem: cadastro atualizado ${id}`);
      return send(res, 200, { id, token: sign(`cli:${id}`) }), true;
    }
    if (!responsavelId && !String(dados.documento ?? '').trim()) throw new HttpError(400, 'O documento é obrigatório.');
    if (!String(dados.nome ?? '').trim()) throw new HttpError(400, 'O nome é obrigatório.');
    if (String(dados.nome).trim().split(/\s+/).length < 2) throw new HttpError(400, 'Informe o nome completo.');
    if (dados.documento && (dados.tipoDocumento ?? 'CPF') === 'CPF' && !isValidCpf(String(dados.documento))) throw new HttpError(400, 'CPF inválido.');
    if (!responsavelId) {
      if (!dados.telefone || onlyDigits(dados.telefone).length < 10) throw new HttpError(400, 'O número de telefone é obrigatório.');
      const dup = await one<{ id: number }>(`SELECT id id FROM kart.cliente WHERE documento_num = @d limit 1`, { d: onlyDigits(dados.documento) });
      if (dup) throw new HttpError(409, 'Já existe cadastro com esse documento. Volte e informe o documento para continuar.');
    }
    if (!dados.nascimento) throw new HttpError(400, 'A data de nascimento é obrigatória.');
    const newId = await insertCliente({ ...dados, responsavelId, lgpd: true }, 'totem');
    if (!responsavelId) identificadoNoTotem.set(ipDe(req), { id: newId, em: Date.now() });
    log(`totem: cliente novo ${newId}${responsavelId ? ` (menor de ${responsavelId})` : ''}`);
    send(res, 201, { id: newId, token: sign(`cli:${newId}`) });
    return true;
  }

  // "Vim com um grupo": grupos de hoje com vaga aguardando (antes de escolher a bateria) e a entrada do amigo no grupo
  if (path === '/api/totem/grupos' && method === 'GET') {
    await garantirColunasEventos();
    send(res, 200, await gruposDoDiaNoTotem());
    return true;
  }
  if (path === '/api/totem/grupo/entrar' && method === 'POST') {
    const body = await readBody(req);
    const cid = int(body.clienteId, 'Cliente');
    if (String(body.token ?? '') !== sign(`cli:${cid}`)) throw new HttpError(403, 'Sessão expirada, identifique-se de novo.');
    send(res, 200, await entrarNoGrupoPeloTotem(int(body.grupoId, 'Grupo'), cid, log));
    return true;
  }

  if (path === '/api/totem/vouchers-cliente' && method === 'GET') {
    const rawGrupo = String(new URL(req.url ?? '/', 'http://totem').searchParams.get('grupo') ?? '');
    const idsVerificados = rawGrupo
      .split(',')
      .map((x) => x.split('.'))
      .filter(([id, tk]) => Number(id) > 0 && tk === sign(`cli:${Number(id)}`))
      .map(([id]) => Number(id));
    if (!idsVerificados.length) {
      const sp = new URL(req.url ?? '/', 'http://totem').searchParams;
      const cid = Number(sp.get('clienteId') || 0);
      const tk = String(sp.get('token') ?? '');
      if (cid > 0 && tk === sign(`cli:${cid}`)) idsVerificados.push(cid);
    }
    if (!idsVerificados.length) return send(res, 200, []), true;
    const encontrados: Array<Record<string, unknown>> = [];
    for (const cid of idsVerificados) {
      const lista = await vouchersDisponiveisParaCliente({ clienteId: cid });
      for (const v of lista) encontrados.push({ clienteId: cid, ...v });
    }
    send(res, 200, encontrados);
    return true;
  }

  if (path === '/api/totem/baterias' && method === 'GET') {
    await garantirColunasEventos();
    const rows = await query<TotemBateriaCandidate>(TOTEM_BATERIAS_SQL);
    // ?grupo=id.token,id.token: vagas que o grupo já tem na bateria (as dele e as pagas online pelo responsável)
    // contam como livres para ele — senão uma bateria lotada pela reserva online sumia do totem para quem pagou
    const grupo = String(new URL(req.url ?? '/', 'http://totem').searchParams.get('grupo') ?? '').split(',').map((x) => x.split('.')).filter(([id, tk]) => Number(id) > 0 && tk === sign(`cli:${Number(id)}`)).map(([id]) => Number(id));
    const dono = donoNoTotem(req);
    if (dono && !grupo.includes(dono)) grupo.push(dono);
    const doGrupo = new Map<number, number>();
    if (grupo.length && rows.length) {
      const bmap: Record<string, unknown> = {};
      const bIn = rows.map((r, n) => { bmap[`b${n}`] = Number(r.id); return `@b${n}`; }).join(',');
      const gIn = grupo.map((gId, n) => { bmap[`g${n}`] = gId; return `@g${n}`; }).join(',');
      for (const g of await query<{ b: number; n: number }>(
        `SELECT i.bateria_id b, COUNT(*) n FROM kart.inscricao i
          WHERE i.bateria_id IN (${bIn}) AND i.status <> 'cancelada'
            AND (i.cliente_id IN (${gIn})
                 OR (i.origem = 'site' AND i.pago = true AND i.cliente_id IN (SELECT responsavel_id "ResponsavelId" FROM kart.cliente WHERE id IN (${gIn}) AND responsavel_id IS NOT NULL)))
          GROUP BY i.bateria_id`,
        bmap,
      )) doGrupo.set(g.b, g.n);
    }
    // bateria de endurance (100 Milhas): depois de escolher, o totem pede a equipe e dá o número da pulseira
    const endurance = await enduranceDasBaterias(rows.map((r) => Number(r.id)));
    // 20/11/2026 (dono): o totem mostra primeiro as baterias e, dentro de cada uma, os grupos com vaga paga esperando.
    // Bateria lotada só pelas vagas reservadas do grupo continua aparecendo (o amigo entra pela vaga do grupo).
    const gruposPorBateria = new Map<number, Awaited<ReturnType<typeof gruposDoDiaNoTotem>>>();
    try {
      for (const g of await gruposDoDiaNoTotem()) {
        const lista = gruposPorBateria.get(Number(g.bateriaId)) ?? [];
        lista.push(g);
        gruposPorBateria.set(Number(g.bateriaId), lista);
      }
    } catch (e) { log(`totem: grupos das baterias indisponíveis: ${(e as Error).message}`); }
    send(res, 200, rows
      .map((r) => ({ ...r, livres: Math.max(0, r.vagas - r.ocupadas) + (doGrupo.get(Number(r.id)) ?? 0) }))
      .filter((r) => bateriaDisponivelNoTotem({ ...r, livres: r.livres + (gruposPorBateria.get(Number(r.id)) ?? []).reduce((s, g) => s + g.aguardando, 0) }, r.dataHoje))
      .map((r) => ({
        grupos: (gruposPorBateria.get(Number(r.id)) ?? []).map((g) => ({ id: g.id, titulo: g.titulo, responsavel: g.responsavel, aguardando: g.aguardando, total: g.total, aniversario: g.aniversario })),
        endurance: endurance.get(Number(r.id)) ?? null,
        id: r.id,
        nome: r.nome,
        inicio: r.inicio,
        vagas: r.vagas,
        tipoKart: r.tipoKart,
        ocupadas: r.ocupadas,
        livres: r.livres,
        campeonato: r.campeonato === true || r.campeonato === 1,
      })));
    return true;
  }

  if (path === '/api/totem/endurance' && method === 'GET') {
    const bateria = Number(new URL(req.url ?? '/', 'http://totem').searchParams.get('bateria'));
    if (!Number.isInteger(bateria) || bateria <= 0) throw new HttpError(400, 'Bateria inválida.');
    send(res, 200, await equipesParaOTotem(bateria));
    return true;
  }

  if (path === '/api/totem/inscrever' && method === 'POST') {
    const body = await readBody(req);
    const baterias = (Array.isArray(body.bateriaIds) ? body.bateriaIds : [body.bateriaId]).filter(Boolean).map((b) => int(b, 'Bateria'));
    if (!baterias.length) throw new HttpError(400, 'Selecione pelo menos uma bateria.');
    const participantes = Array.isArray(body.participantes) ? body.participantes : [];
    if (!participantes.length) throw new HttpError(400, 'Selecione quem vai correr.');
    const ids: number[] = [];
    const vouchersReconhecidos: Array<{ clienteId: number; codigo: string; tipo: string; valor: number }> = [];
    // um termo por piloto (mesmo que ele corra em mais de uma bateria): a 1ª inscrição de cada um
    const termoDoPiloto = new Map<number, number>();
    const grupo: number[] = [];
    for (const p of participantes as { id: unknown; token: unknown }[]) {
      const cid = int(p.id, 'Participante');
      if (String(p.token ?? '') !== sign(`cli:${cid}`)) throw new HttpError(403, 'Sessão expirada, identifique-se de novo.');
      grupo.push(cid);
    }
    // endurance: cada piloto vira membro da equipe escolhida e ganha o número da pulseira (antes da inscrição:
    // se a equipe estiver cheia ou o piloto já for de outra equipe, nada é gravado)
    let pulseiras: Awaited<ReturnType<typeof vincularNoTotem>> = [];
    const end = body.endurance as { eventoId?: unknown; equipeId?: unknown; equipeIds?: unknown[] } | undefined;
    if (end && end.eventoId && (end.equipeId || Array.isArray(end.equipeIds))) {
      const eventoId=int(end.eventoId,'Evento');
      const vinculo=await one<{bateriaId:number}>('SELECT bateria_id "bateriaId" FROM kart.endurance_evento WHERE id=@id AND ativo = true',{id:eventoId});
      if(!vinculo || !baterias.includes(vinculo.bateriaId)) throw new HttpError(409,'O campeonato não pertence à bateria selecionada.');
      const equipeIds=Array.isArray(end.equipeIds)?end.equipeIds.map(id=>int(id,'Inscrição')):[int(end.equipeId,'Equipe')];
      pulseiras = await vincularNoTotem(eventoId,equipeIds,grupo);
      log(`totem: endurance ${pulseiras.map((p) => `${p.nome} #${p.pulseira}`).join(', ')} na equipe ${pulseiras[0]?.equipe ?? '?'}`);
    }
    for (const bateriaId of baterias) {
      // quem já tem vaga na bateria primeiro (o comprador da reserva online fica com a dele; as outras vão para o grupo)
      const existentes = new Map<number, number>();
      for (const cid of grupo) {
        const dup = await one<{ Id: number }>(`SELECT id "Id" FROM kart.inscricao WHERE bateria_id = @b AND cliente_id = @c AND status <> 'cancelada' ORDER BY id limit 1`, { b: bateriaId, c: cid });
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
        // reserva em grupo da recepção com vaga aguardando cadastro e dado em comum (nome ou WhatsApp): entra na vaga já paga
        const vagaGrupo = await vincularPorDados(bateriaId, cid, log);
        if (vagaGrupo) {
          ids.push(vagaGrupo);
          if (!termoDoPiloto.has(cid)) termoDoPiloto.set(cid, vagaGrupo);
          continue;
        }
        // pre-reserva: aparece em Reservas > Aprovar na recepcao
        const novas = await inscreverN(bateriaId, cid, 1, 'totem', null, null, false);
        ids.push(...novas);
        if (novas.length) {
          const batProd = await one<{ produtoId: number | null }>(`SELECT produto_id "produtoId" FROM kart.bateria WHERE id = @id`, { id: bateriaId }).catch(() => null);
          const vchs = await vouchersDisponiveisParaCliente({ clienteId: cid, produtoId: batProd?.produtoId ?? null }).catch(() => []);
          if (vchs.length) {
            const v0 = vchs[0];
            for (const insId of novas) {
              await query(`UPDATE kart.inscricao SET voucher_id = @vid WHERE id = @id`, { vid: v0.id, id: insId }).catch(() => undefined);
            }
            vouchersReconhecidos.push({ clienteId: cid, codigo: v0.codigo, tipo: v0.tipo, valor: v0.valor });
          }
        }
        if (!termoDoPiloto.has(cid) && novas.length) termoDoPiloto.set(cid, novas[0]);
      }
    }
    const primeira = await one<{ inicio: string }>(`SELECT to_char(inicio, 'YYYY-MM-DD"T"HH24:MI') inicio FROM kart.bateria WHERE id IN (${baterias.map((_, n) => '@b' + n).join(',')}) ORDER BY bateria.inicio LIMIT 1`, Object.fromEntries(baterias.map((b, n) => ['b' + n, b])));
    const p = await parametros();
    log(`totem: ${ids.length} pre-reserva(s) em ${baterias.length} bateria(s)`);
    const imprimir = p['totem.imprimirTermo'] !== 'false';
    const origem = origemDe(req);
    const ip = (req.socket?.remoteAddress ?? '').replace(/^::ffff:/, '');
    const isTotem1 = origem === 'Totem 1' || ip === '192.168.20.161';
    // Se for Totem 1 (ou se solicitou impressaoLocal), NUNCA joga na recepção: imprime direto no totem
    const naRecepcao = !isTotem1 && imprimir && body.impressaoLocal !== true && p['totem.termoNaRecepcao'] !== 'false';
    // cada termo é um trabalho de impressão separado: a TM-T20 corta o papel no fim de cada trabalho,
    // então vários termos num trabalho só saíam emendados
    if (naRecepcao) for (const idInscricao of termoDoPiloto.values()) enfileirarImpressao(termoLink([idInscricao]), 'Termo de responsabilidade', origem);
    if (ids.length) {
      const pmap = Object.fromEntries(ids.map((id, n) => ['id' + n, id]));
      await query(`UPDATE kart.inscricao SET termo_impresso_em = COALESCE(termo_impresso_em, now()), atualizado_em = now() WHERE id IN (${ids.map((_, n) => '@id' + n).join(',')})`, pmap).catch(() => undefined);
    }
    send(res, 201, { inscricoes: ids, inicio: primeira?.inicio, termoUrl: imprimir ? termoLink(ids) : null, termoUrls: imprimir ? [...termoDoPiloto.values()].map((id) => termoLink([id])) : [], termoNaRecepcao: naRecepcao, pulseiras, vouchersReconhecidos });
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
  const u = await one<{ id: number; nome: string; hash: string; admin: boolean; ativo: boolean }>(`SELECT id id, nome nome, senha_hash hash, admin admin, ativo ativo FROM kart.usuario WHERE login = @login`, { login });
  if (!u || !u.ativo || !confereSenha(senha, u.hash)) {
    const reg = tentativasLogin.get(ip) ?? { n: 0, ate: 0 };
    if (reg.ate && agora >= reg.ate) { reg.n = 0; reg.ate = 0; }
    reg.n += 1;
    if (reg.n >= 10) reg.ate = agora + 15 * 60_000;
    tentativasLogin.set(ip, reg);
    log(`login recusado: ${login}`);
    throw new HttpError(401, 'Login ou senha inválidos.');
  }
  tentativasLogin.delete(ip);
  log(`login: ${login}`);
  await query(`UPDATE kart.usuario SET ultimo_acesso = now() WHERE id = @id`, { id: u.id }).catch(() => undefined);
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

const server = http.createServer((req, res) => {
  void emCurso(`http ${req.method} ${String(req.url ?? '').split('?')[0].slice(0, 60)}`, atender(req, res));
});
async function atender(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname;
  const method = req.method ?? 'GET';
  try {
    if (method === 'GET' && path.startsWith('/updates/')) {
      const partes = path.slice('/updates/'.length).split('/').map(decodeURIComponent);
      if (partes.length !== 2 || !partes[0] || !partes[1]) return send(res, 404, { error: 'Arquivo de atualização não encontrado.' });
      registrarSinal(ipDe(req), path);
      return sendUpdateFile(res, partes[0], partes[1]);
    }
    if (path === '/' || path === '/recepcao') return sendStatic(res, 'office.html');
    if (path === '/totem') return sendStatic(res, 'totem.html');
    if (path.startsWith('/ui/')) return sendStatic(res, path.slice(4));
    if (path === '/healthz') {
      const r = await one<{ agora: string }>(`SELECT to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS') agora`);
      return send(res, 200, { ok: true, sqlAgora: r?.agora });
    }
    // foto que o piloto enviou (ou tirou) no app: o worker de cadastro chama na hora e a foto vai para o banco
    {
      const mf = path.match(/^\/api\/app\/foto\/(\d{1,12})$/);
      if (mf && (method === 'PUT' || method === 'DELETE')) {
        requireChaveDoApp(req);
        const clienteId = Number(mf[1]);
        if (method === 'DELETE') {
          await apagarFotoDoApp(clienteId);
          console.log(`app: cliente ${clienteId} tirou a foto no app`);
          return send(res, 200, { ok: true });
        }
        try {
          const r = await gravarFotoDoApp(clienteId, await readBytes(req, 2_000_000));
          console.log(`app: foto do cliente ${clienteId} gravada no banco (${r.bytes} bytes)`);
          return send(res, 200, r);
        } catch (e) {
          const st = (e as { status?: number }).status;
          if (st === 404) return send(res, 404, { error: 'Cliente não encontrado.' });
          if (e instanceof HttpError) throw e;
          return send(res, 400, { error: (e as Error).message });
        }
      }
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
        const response = await fetch(`${TIMING_URL}/resultado/${encodeURIComponent(crono[1])}`, { signal: AbortSignal.timeout(10_000) });
        if (!response.ok) throw new HttpError(502, 'Não foi possível carregar o resultado da cronometragem.');
        return sendHtml(res, prepararRelatorioRecepcao(await response.text(), TIMING_URL));
      }
      return sendHtml(res, await relatorio(path.slice('/relatorio/'.length), url));
    }
    if (path === '/api/login' && method === 'POST') return await loginRoute(req, res);
    // página do chefe de equipe do endurance: link assinado por equipe, só leitura
    const chefe = path.match(/^\/api\/publico\/endurance\/([\w.-]{3,60})$/);
    if (chefe && method === 'GET') return send(res, 200, await paginaDoChefe(chefe[1]));
    if (path.startsWith('/api/totem/')) {
      registrarSinal(ipDe(req), path);
      if (await totemRoutes(req, res, path)) return;
    }
    if (path.startsWith('/api/office/')) {
      await garantirColunasEventos();
      const sessao = sessaoDe(req, url);
      const dadosCrono = path.match(/^\/api\/office\/crono\/dados\/([a-zA-Z0-9_-]{1,80})(\/(?:passings|laps))?$/);
      if (dadosCrono && method === 'GET') {
        const response = await fetch(`${TIMING_URL}/api/sessions/${encodeURIComponent(dadosCrono[1])}${dadosCrono[2] ?? ''}`, { signal: AbortSignal.timeout(10_000) });
        if (!response.ok) throw new HttpError(response.status === 404 ? 404 : 502, 'Dados da cronometragem indisponíveis.');
        const data = (await response.json()) as (SessaoRelatorio & { competitors?: unknown[]; standings?: unknown[] }) | null;
        if (dadosCrono[2]) return send(res, 200, data);
        if (!data || !Array.isArray(data.competitors) || !Array.isArray(data.standings)) throw new HttpError(502, 'Resultado da cronometragem inválido.');
        const ids = idsClientesRelatorio(data as SessaoRelatorio);
        if (ids.length > 1000) throw new HttpError(502, 'Quantidade de pilotos inválida.');
        const params = Object.fromEntries(ids.map((id, i) => ['id' + i, id]));
        const clientes = ids.length ? await query<{ id: number; instagram: string | null }>(
          `SELECT id id, instagram instagram FROM kart.cliente WHERE id IN (${ids.map((_, i) => '@id' + i).join(',')})`, params,
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
        const job = proximaImpressao();
        return send(res, 200, job ? { id: job.id, url: job.url, titulo: job.titulo, origem: job.origem, tentativa: job.tentativas } : {});
      }
      if (path === '/api/office/impressao/teste' && method === 'POST') {
        const token = String(req.headers.authorization ?? '').slice(7) || String(url.searchParams.get('t') ?? '');
        const job = enfileirarImpressao(`/termo?branco=1&t=${encodeURIComponent(token)}`, 'Teste de impressão (termo em branco)', sessao.nome);
        return send(res, 201, { id: job.id });
      }
      if (path === '/api/office/impressao/fila' && method === 'GET') {
        return send(res, 200, filaImpressao.map(({ url: _u, ...j }) => j));
      }
      const mi = path.match(/^\/api\/office\/impressao\/(\d+)\/(feita|falhou)$/);
      if (mi && method === 'POST') {
        const job = filaImpressao.find((j) => j.id === Number(mi[1]));
        if (job && mi[2] === 'feita') { job.feitaEm = Date.now(); log(`impressao #${job.id} impressa na recepcao (${sessao.nome})`); }
        if (job && mi[2] === 'falhou') {
          job.pegoEm = Date.now();
          if (job.tentativas >= 10) log(`impressao #${job.id} suspensa apos 10 tentativas falhas (${job.titulo})`);
          else log(`impressao #${job.id} falhou na recepcao, volta pra fila`);
        }
        if (job) salvarFilaImpressao();
        return send(res, 200, { ok: !!job });
      }
      const reqOffice = { method, url, sessao, body: () => readBody(req) };
      if (await campeonatoOfficeRoutes(reqOffice, (status, body) => send(res, status, body))) return;
      if (await gruposRoutes(reqOffice, (status, body) => send(res, status, body))) return;
      if (await painelRoutes(reqOffice, (status, body) => send(res, status, body))) return;
      if (await enduranceRoutes(reqOffice, (status, body) => send(res, status, body))) return;
      if (await pilotosRoutes(reqOffice, (status, body) => send(res, status, body))) return;
      const handled = await officeRoutes(reqOffice, (status, body) => send(res, status, body));
      if (handled) return;
    }
    if (path.startsWith('/api/campeonato-site/')) {
      requireKey(req);
      if (await campeonatoSiteRoutes(path, method, () => readBody(req), (status, body) => send(res, status, body))) return;
      return send(res, 404, { error: 'Rota desconhecida.' });
    }
    if (path.startsWith('/api/crono/')) {
      requireKey(req);
      // foto do piloto do banco para TV, telão TB50 e pódio (?mini=1 = miniatura 160 px)
      const mfc = path.match(/^\/api\/crono\/foto\/(\d{1,12})$/);
      if (mfc && method === 'GET') {
        const f = await fotoDoBanco(Number(mfc[1]), url.searchParams.get('mini') === '1');
        if (!f) return send(res, 404, { error: 'Piloto sem foto.' });
        return sendImagem(res, f.bytes, f.tipo);
      }
      if (path === '/api/crono/baterias' || path.startsWith('/api/crono/baterias/')) await sincronizarTracadosDaCronometragem();
      let m = path.match(/^\/api\/crono\/baterias\/(\d+)\/grid$/);
      if (m) {
        const rows = await query(
          `SELECT i.id "inscricaoId", c.nome nome, endurance.equipe, endurance."equipeId", endurance.pulseira, i.kart kart, i.pago pago, i.aprovada aprovada, c.id "clienteId",
             (i.termo_impresso_em IS NOT NULL) termo,
             (COALESCE(i.preco_centavos, pg.preco_centavos, 0) - COALESCE(i.desconto_centavos, 0))::int "totalCentavos",
             EXISTS (SELECT 1 FROM kart.endurance_evento ev WHERE ev.bateria_id = i.bateria_id AND ev.ativo) "enduranceAtivo"
           FROM kart.inscricao i JOIN kart.cliente c ON c.id = i.cliente_id
           JOIN kart.bateria bg ON bg.id = i.bateria_id LEFT JOIN kart.produto pg ON pg.id = COALESCE(i.produto_id, bg.produto_id)
           ${ENDURANCE_VINCULO_SQL}
           WHERE i.bateria_id = @id AND i.status <> 'cancelada' ORDER BY i.id`,
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
          ? (await one<{ c: string | null }>(`SELECT p.categoria c FROM kart.bateria b JOIN kart.produto p ON p.id = b.produto_id WHERE b.id = @id`, { id: agendaId }))?.c ?? null
          : null;
        let somados = 0, criados = 0, ignorados = 0;
        for (const k of Array.isArray(b.karts) ? b.karts : []) {
          const numero = Number(String(k.kart ?? '').trim());
          const minutos = Math.round(Number(k.minutos));
          if (!Number.isSafeInteger(numero) || numero <= 0 || !(minutos > 0) || minutos > 600) { ignorados++; continue; }
          const linhas = await query<{ id: number; categoria: string | null; item: number | null; minutos: number; ultima: string | null }>(
            `SELECT id id, categoria categoria, item_id item, minutos_uso minutos, to_char(ultima_manutencao, 'YYYY-MM-DD"T"HH24:MI:SS') ultima
             FROM kart.manutencao WHERE trim(kart) ~ '^[0-9]+$' AND trim(kart)::int = @n`, { n: numero });
          const cats = [...new Set(linhas.map((l) => l.categoria ?? ''))];
          const daCategoria = cat ? linhas.filter((l) => (l.categoria ?? '') === cat) : cats.length === 1 ? linhas : [];
          // o sistema antigo deixou controles repetidos do mesmo kart ("01" e "1", "12" e "12 "): soma só em UM por item —
          // o que já teve manutenção registrada mais recente, senão o de mais horas (antes somava em todos)
          const porItem = new Map<string, typeof daCategoria>();
          for (const l of daCategoria) porItem.set(String(l.item ?? ''), [...(porItem.get(String(l.item ?? '')) ?? []), l]);
          const alvo = [...porItem.values()].map((g) => g.sort((a, x) => (x.ultima ?? '').localeCompare(a.ultima ?? '') || x.minutos - a.minutos || a.id - x.id)[0]);
          if (!alvo.length && cat) {
            // kart novo nessa categoria: abre o controle com os itens que contam por hora
            const r = await query(`INSERT INTO kart.manutencao (kart, categoria, item_id, minutos_uso, realizada, data)
              SELECT @k, @c, id "Id", @m, 0, now() FROM kart.item_manutencao WHERE ativo = true AND controla_por_tempo = true`, { k: String(numero), c: cat, m: minutos });
            void r; criados++;
            continue;
          }
          if (!alvo.length) { ignorados++; continue; }
          for (const l of alvo) {
            // somar uso depois de uma manutenção feita abre um ciclo novo (volta para "A realizar" contando do zero)
            await query(`UPDATE kart.manutencao SET minutos_uso = minutos_uso + @m, realizada = false, data = now() WHERE id = @id`, { m: minutos, id: l.id });
            somados++;
          }
        }
        return send(res, 200, { ok: true, categoria: cat, somados, criados, ignorados });
      }
      if (path === '/api/crono/empresa' && method === 'GET') {
        // dados da empresa (Cadastros › Empresa da recepção) para o cabeçalho da cronometragem, só leitura
        return send(res, 200, await one(`SELECT nome nome, cnpj cnpj, telefone telefone, email email, endereco endereco, numero numero, bairro bairro, cidade cidade, estado estado
          FROM kart.empresa WHERE id = 1`) ?? {});
      }
      if (path === '/api/crono/clientes' && method === 'GET') {
        // dados dos pilotos para a lista de competidores da cronometragem (só leitura)
        const ids = String(url.searchParams.get('ids') ?? '').split(',').map(Number).filter((n) => Number.isSafeInteger(n) && n > 0).slice(0, 200);
        if (!ids.length) return send(res, 200, []);
        const pmap = Object.fromEntries(ids.map((id, n) => [`id${n}`, id]));
        const inClause = ids.map((_, n) => `@id${n}`).join(',');
        const clientes = await query<Record<string, unknown>>(`SELECT id id, email email, cidade cidade, estado uf, peso peso, sexo sexo, telefone telefone FROM kart.cliente WHERE id IN (${inClause})`, pmap);
        const vinculos = await query<{ clienteId: number; bateriaId: number; equipeId: number; equipe: string; pulseira: number }>(
          `SELECT p.cliente_id "clienteId", ev.bateria_id "bateriaId", q.id "equipeId", q.nome equipe, p.pulseira pulseira
           FROM kart.endurance_piloto_inscricao p JOIN kart.endurance_evento ev ON ev.id = p.evento_id
           JOIN kart.endurance_equipe q ON q.id = p.equipe_id AND q.evento_id = ev.id
           WHERE p.cliente_id IN (${inClause}) AND p.ativo = true AND ev.ativo = true`, pmap);
        return send(res, 200, clientes.map((c) => ({ ...c, enduranceVinculos: vinculos.filter((v) => v.clienteId === c.id) })));
      }
      m = path.match(/^\/api\/crono\/baterias\/(\d+)\/programa$/);
      if (m) {
        return send(res, 200, await query(`SELECT pp.ordem ordem, pp.nome nome, pp.tipo tipo, pp.finalizacao finalizacao, pp.tempo_min "tempoMin", pp.voltas_max "voltasMax", b.volta_minima_seg "voltaMinimaSeg", t.timing_track_id "trackId"
          FROM kart.bateria b JOIN kart.produto_prova pp ON pp.produto_id = b.produto_id LEFT JOIN kart.tracado t ON t.id = b.tracado_id
          WHERE b.id = @id ORDER BY pp.ordem`, { id: Number(m[1]) }));
      }
      if (path === '/api/crono/baterias' && method === 'GET') {
        const data = String(url.searchParams.get('data') ?? '');
        return send(res, 200, await query(
          `SELECT b.id id, b.nome nome, to_char(b.inicio, 'YYYY-MM-DD"T"HH24:MI') inicio, b.vagas vagas, b.tipo_kart "tipoKart", t.timing_track_id "trackId",
                  (SELECT COUNT(*) FROM kart.inscricao i WHERE i.bateria_id = b.id AND i.status <> 'cancelada') inscritos,
                  (SELECT COUNT(*) FROM kart.inscricao i WHERE i.bateria_id = b.id AND i.status <> 'cancelada' AND i.pago = true) pagos
           FROM kart.bateria b LEFT JOIN kart.tracado t ON t.id = b.tracado_id
           WHERE b.status <> 'cancelada' AND b.inicio >= @d AND b.inicio < (@d + make_interval(days => (1)::int)) ORDER BY b.inicio`,
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
        `SELECT b.id id, b.nome nome, to_char(b.inicio, 'YYYY-MM-DD"T"HH24:MI') inicio, b.vagas vagas, b.tipo_kart "tipoKart", t.timing_track_id "trackId",
                (SELECT COUNT(*) FROM kart.inscricao i WHERE i.bateria_id = b.id AND i.status <> 'cancelada') inscritos,
                (SELECT COUNT(*) FROM kart.inscricao i WHERE i.bateria_id = b.id AND i.status <> 'cancelada' AND i.pago = true) pagos
         FROM kart.bateria b LEFT JOIN kart.tracado t ON t.id = b.tracado_id
         WHERE b.status <> 'cancelada' AND b.inicio >= @d AND b.inicio < (@d + make_interval(days => (1)::int)) ORDER BY b.inicio`,
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
}

function paginaDeErro(msg: string) {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Relatório indisponível</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F5F5F7;font-family:"Segoe UI",system-ui,sans-serif;color:#1D1D1F}
.c{max-width:460px;margin:24px;padding:28px 32px;background:#fff;border:1px solid #E5E5EA;border-radius:14px;text-align:center}
.i{width:44px;height:44px;margin:0 auto 12px;border-radius:50%;background:#FFF4E5;color:#C2410C;font:700 24px/44px "Segoe UI"}h1{margin:0 0 6px;font-size:18px}p{margin:0;color:#6E6E73;font-size:14px;line-height:1.45}</style></head>
<body><div class="c"><div class="i">!</div><h1>Relatório indisponível</h1><p>${esc(msg)}</p></div></body></html>`;
}

server.listen(PORT, '0.0.0.0', () => {
  log(`Servidor da operacao em http://0.0.0.0:${PORT} (recepcao /recepcao, totem /totem)`);
  garantirColunasEventos().catch((e) => log(`colunas de aniversario/campeonato: ${(e as Error).message}`));
  garantirSchemaVouchers().catch((e) => log(`schema de vouchers: ${(e as Error).message}`));
});

// pré-cadastro online (QR code): traz os cadastros do site a cada 30 s
if (preCadastroLigado()) {
  let sincronizando = false;
  const sincronizar = async () => {
    if (sincronizando) return;
    sincronizando = true;
    try {
      const n = await emCurso('pre-cadastro', sincronizarPreCadastros(log));
      if (n) log(`pré-cadastro: ${n} cadastro(s) do site gravado(s)`);
    } catch (e) {
      log(`pré-cadastro: sincronização falhou (${(e as Error).message})`);
    } finally {
      sincronizando = false;
    }
  };
  setTimeout(sincronizar, 5_000);
  setInterval(sincronizar, 30_000).unref();
  // check-in pelo celular: marca a chegada e manda o termo de cada piloto para a fila da Recepção
  let checando = false;
  setInterval(async () => {
    if (checando) return;
    checando = true;
    try { await emCurso('checkins', aplicarCheckins(log, (id) => enfileirarImpressao(termoLink([id]), 'Termo de responsabilidade', 'celular'))); }
    catch (e) { log(`check-in: sincronização falhou (${(e as Error).message})`); }
    try { await emCurso('cancelamentos', aplicarCancelamentos(log)); }
    catch (e) { log(`cancelamento: sincronização falhou (${(e as Error).message})`); }
    finally { checando = false; }
  }, 20_000).unref();
  log('pré-cadastro online ligado');
  // reserva em grupo (painel web): confere no Asaas os links de pagamento em aberto
  let conferindo = false;
  setInterval(async () => {
    if (conferindo) return;
    conferindo = true;
    await emCurso('grupos-ciclo', (async () => {
    await publicarTermoNoSite(TERMO_FILE, log).catch((e) => log(`termo: publicação no site falhou (${(e as Error).message})`));
    if (await aplicarAcoesDoPainel(log).catch((e) => { log(`grupo: ações do painel falharam (${(e as Error).message})`); return 0; })) { /* o resumo abaixo já sai atualizado */ }
    try { await acertarCuponsDosGrupos().catch((e) => log(`grupo: acerto dos cupons falhou (${(e as Error).message})`)); await enviarLembretesDosGrupos(log).catch((e) => log(`grupo: lembretes falharam (${(e as Error).message})`)); await soltarVagasNaoPagasDoSite(log).catch((e) => log(`grupo: soltar vagas não pagas falhou (${(e as Error).message})`)); await expirarGruposDoAgente(log).catch((e) => log(`grupo: expirar reservas do agente falhou (${(e as Error).message})`)); await publicarGruposNoSite(log).catch((e) => log(`grupo: resumo para o site falhou (${(e as Error).message})`)); await conferirCobrancas(log); await puxarPagamentosDiretoDoAsaas(log); await conferirCobrancasCampeonato(log); } catch (e) { log(`grupo: conferência das cobranças falhou (${(e as Error).message})`); } finally { conferindo = false; }
    })());
  }, 60_000).unref();
}

// página Pilotos do painel web: lê da cronometragem as baterias encerradas novas (carreira e ranking por traçado)
setTimeout(() => { emCurso('indice-pilotos', atualizarIndicePilotos(log)).catch(() => undefined); }, 20_000);
setInterval(() => { emCurso('indice-pilotos', atualizarIndicePilotos(log)).catch(() => undefined); }, 120_000).unref();

// reserva online (reservas.kartodromodebetim.com.br): agenda a cada 5 s, pedidos/pagamentos/prazos a cada 5 s.
// Liga com OPS_RESERVA_ONLINE=1 no .env.local (usa a mesma chave do pré-cadastro).
if (preCadastroLigado() && process.env.OPS_RESERVA_ONLINE === '1') {
  let ocupado = false, ultimoErro = 0;
  const falhou = (o: string, e: unknown) => { if (Date.now() - ultimoErro > 60_000) { ultimoErro = Date.now(); log(`reserva online: ${o} falhou (${(e as Error).message})`); } };
  const pedidos = async () => {
    if (ocupado) return;
    ocupado = true;
    try { await emCurso('pedidos', sincronizarReservasOnline(log)); } catch (e) { falhou('pedidos', e); } finally { ocupado = false; }
  };
  const agenda = async () => { try { await emCurso('agenda', publicarAgenda()); } catch (e) { falhou('agenda', e); } };
  setTimeout(agenda, 3_000);
  setInterval(agenda, 5_000).unref();
  setInterval(pedidos, 5_000).unref();
  log('reserva online ligada');
}
