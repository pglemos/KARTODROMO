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
import { conferirCobrancas, gruposRoutes } from '../lib/ops/grupos';
import { painelRoutes, registrarSinal } from '../lib/ops/painel';
import { enduranceDasBaterias, enduranceRoutes, equipesParaOTotem, paginaDoChefe, vincularNoTotem } from '../lib/ops/endurance';
import { ENDURANCE_VINCULO_SQL } from '../lib/ops/endurance-vinculo';
import { atualizarIndice as atualizarIndicePilotos, pilotosRoutes } from '../lib/ops/pilotos';
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
// O totem nao tem impressora: o termo entra nesta fila e o programa da Recepcao (com a TM-T20)
// pega e imprime em segundos, como o LapTime fazia pelo servidor. Fica so em memoria: um
// servidor reiniciado perde no maximo os termos das ultimas horas, que a recepcao reimprime.
type Impressao = { id: number; url: string; titulo: string; origem: string; criadoEm: number; pegoEm?: number; feitaEm?: number; tentativas: number };
const filaImpressao: Impressao[] = [];
let seqImpressao = 0;
const IMPRESSAO_VALIDADE_MS = 3 * 60 * 60 * 1000;
const IMPRESSAO_REENTREGA_MS = 90 * 1000;

function enfileirarImpressao(url: string, titulo: string, origem: string) {
  const agora = Date.now();
  for (let i = filaImpressao.length - 1; i >= 0; i--) if (agora - filaImpressao[i].criadoEm > IMPRESSAO_VALIDADE_MS) filaImpressao.splice(i, 1);
  const job: Impressao = { id: ++seqImpressao, url, titulo, origem, criadoEm: agora, tentativas: 0 };
  filaImpressao.push(job);
  log(`impressao #${job.id} na fila (${titulo}, ${origem})`);
  return job;
}

function proximaImpressao() {
  const agora = Date.now();
  const job = filaImpressao.find((j) => !j.feitaEm && agora - j.criadoEm <= IMPRESSAO_VALIDADE_MS && (!j.pegoEm || agora - j.pegoEm > IMPRESSAO_REENTREGA_MS));
  if (!job) return null;
  job.pegoEm = agora;
  job.tentativas++;
  return job;
}

/**
 * Quem se identificou por último em cada totem (vale 15 min). É o "dono" das vagas pagas pela reserva online do grupo
 * que está no totem: a lista de baterias soma essas vagas e, na inscrição, elas passam para os pilotos do grupo
 * (mesmo que quem pagou não vá correr). Fica só no servidor: o app do totem aprovado não muda.
 */
const identificadoNoTotem = new Map<string, { id: number; em: number }>();
const ipDe = (req: http.IncomingMessage) => String(req.socket.remoteAddress ?? '').replace(/^::ffff:/, '');
function donoNoTotem(req: http.IncomingMessage) {
  const x = identificadoNoTotem.get(ipDe(req));
  return x && Date.now() - x.em < 15 * 60_000 ? x.id : null;
}

function origemDe(req: http.IncomingMessage) {
  const ip = String(req.socket.remoteAddress ?? '').replace(/^::ffff:/, '');
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
    const dependentes = await query<{ id: number; nome: string; nascimento: string }>(
      `SELECT c.Id id, c.Nome nome, CONVERT(varchar(10), c.Nascimento, 126) nascimento FROM dbo.Cliente c WHERE c.ResponsavelId = @id AND c.Bloqueado = 0 ORDER BY c.Nome`,
      { id: c.id },
    );
    // cadastro completo (pedido do dono em 26/09): o cliente confere e corrige todos os dados no totem
    const txt = (v: unknown) => (v == null ? '' : String(v).trim());
    const num = txt(c.numero);
    const comp = txt(c.complemento);
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
        endereco: enderecoCompleto,
        numero: num,
        complemento: comp,
        bairro: txt(c.bairro),
        cidade: txt(c.cidade),
        estado: txt(c.estado),
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
      const responsavel = await one<{ email: string | null }>(`SELECT Email email FROM dbo.Cliente WHERE Id = @id`, { id: responsavelId });
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
          `SELECT Endereco endereco, Numero numero, Complemento complemento FROM dbo.Cliente WHERE Id = @id`,
          { id },
        );
        const digitado = String(dados.endereco ?? '').trim();
        if (!digitado || (atual && digitado === enderecoDoTotem(atual.endereco, atual.numero, atual.complemento))) delete dados.endereco;
        else limparNumero = Boolean(atual?.numero || atual?.complemento);
      }
      await updateCliente(id, { ...dados, lgpd: true }, true);
      if (limparNumero) await query(`UPDATE dbo.Cliente SET Numero = NULL, Complemento = NULL WHERE Id = @id`, { id });
      log(`totem: cadastro atualizado ${id}`);
      return send(res, 200, { id, token: sign(`cli:${id}`) }), true;
    }
    if (!responsavelId && !String(dados.documento ?? '').trim()) throw new HttpError(400, 'O documento é obrigatório.');
    if (!String(dados.nome ?? '').trim()) throw new HttpError(400, 'O nome é obrigatório.');
    if (String(dados.nome).trim().split(/\s+/).length < 2) throw new HttpError(400, 'Informe o nome completo.');
    if (dados.documento && (dados.tipoDocumento ?? 'CPF') === 'CPF' && !isValidCpf(String(dados.documento))) throw new HttpError(400, 'CPF inválido.');
    if (!responsavelId) {
      if (!dados.telefone || onlyDigits(dados.telefone).length < 10) throw new HttpError(400, 'O número de telefone é obrigatório.');
      const dup = await one<{ id: number }>(`SELECT TOP 1 Id id FROM dbo.Cliente WHERE DocumentoNum = @d`, { d: onlyDigits(dados.documento) });
      if (dup) throw new HttpError(409, 'Já existe cadastro com esse documento. Volte e informe o documento para continuar.');
    }
    if (!dados.nascimento) throw new HttpError(400, 'A data de nascimento é obrigatória.');
    const newId = await insertCliente({ ...dados, responsavelId, lgpd: true }, 'totem');
    if (!responsavelId) identificadoNoTotem.set(ipDe(req), { id: newId, em: Date.now() });
    log(`totem: cliente novo ${newId}${responsavelId ? ` (menor de ${responsavelId})` : ''}`);
    send(res, 201, { id: newId, token: sign(`cli:${newId}`) });
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
      const lista = grupo.join(',');
      for (const g of await query<{ b: number; n: number }>(
        `SELECT i.BateriaId b, COUNT(*) n FROM dbo.Inscricao i
          WHERE i.BateriaId IN (${rows.map((r) => Number(r.id)).join(',')}) AND i.Status <> 'cancelada'
            AND (i.ClienteId IN (${lista})
                 OR (i.Origem = 'site' AND i.Pago = 1 AND i.ClienteId IN (SELECT ResponsavelId FROM dbo.Cliente WHERE Id IN (${lista}) AND ResponsavelId IS NOT NULL)))
          GROUP BY i.BateriaId`,
      )) doGrupo.set(g.b, g.n);
    }
    // bateria de endurance (100 Milhas): depois de escolher, o totem pede a equipe e dá o número da pulseira
    const endurance = await enduranceDasBaterias(rows.map((r) => Number(r.id)));
    send(res, 200, rows
      .map((r) => ({ ...r, livres: Math.max(0, r.vagas - r.ocupadas) + (doGrupo.get(Number(r.id)) ?? 0) }))
      .filter((r) => bateriaDisponivelNoTotem(r, r.dataHoje))
      .map((r) => ({
        endurance: endurance.get(Number(r.id)) ?? null,
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
      const vinculo=await one<{bateriaId:number}>('SELECT BateriaId bateriaId FROM dbo.EnduranceEvento WHERE Id=@id AND Ativo=1',{id:eventoId});
      if(!vinculo || !baterias.includes(vinculo.bateriaId)) throw new HttpError(409,'O campeonato não pertence à bateria selecionada.');
      const equipeIds=Array.isArray(end.equipeIds)?end.equipeIds.map(id=>int(id,'Inscrição')):[int(end.equipeId,'Equipe')];
      pulseiras = await vincularNoTotem(eventoId,equipeIds,grupo);
      log(`totem: endurance ${pulseiras.map((p) => `${p.nome} #${p.pulseira}`).join(', ')} na equipe ${pulseiras[0]?.equipe ?? '?'}`);
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
    // cada termo é um trabalho de impressão separado: a TM-T20 corta o papel no fim de cada trabalho,
    // então vários termos num trabalho só saíam emendados
    if (naRecepcao) for (const idInscricao of termoDoPiloto.values()) enfileirarImpressao(termoLink([idInscricao]), 'Termo de responsabilidade', origemDe(req));
    send(res, 201, { inscricoes: ids, inicio: primeira?.inicio, termoUrl: imprimir ? termoLink(ids) : null, termoNaRecepcao: naRecepcao, pulseiras });
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
      registrarSinal(ipDe(req), path);
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
      const sessao = sessaoDe(req, url);
      const dadosCrono = path.match(/^\/api\/office\/crono\/dados\/([a-zA-Z0-9_-]{1,80})(\/(?:passings|laps))?$/);
      if (dadosCrono && method === 'GET') {
        const response = await fetch(`${TIMING_URL}/api/sessions/${encodeURIComponent(dadosCrono[1])}${dadosCrono[2] ?? ''}`, { signal: AbortSignal.timeout(10_000) });
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
        const job = proximaImpressao();
        return send(res, 200, job ? { id: job.id, url: job.url, titulo: job.titulo, origem: job.origem, tentativa: job.tentativas } : {});
      }
      if (path === '/api/office/impressao/teste' && method === 'POST') {
        const token = String(req.headers.authorization ?? '').slice(7) || String(url.searchParams.get('t') ?? '');
        const job = enfileirarImpressao(`/termo?branco=1&t=${encodeURIComponent(token)}`, 'Teste de impressão (termo em branco)', sessao.nome);
        return send(res, 201, { id: job.id });
      }
      if (path === '/api/office/impressao/fila' && method === 'GET') {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- a URL assinada nao deve sair no diagnostico da fila
        return send(res, 200, filaImpressao.map(({ url: _u, ...j }) => j));
      }
      const mi = path.match(/^\/api\/office\/impressao\/(\d+)\/(feita|falhou)$/);
      if (mi && method === 'POST') {
        const job = filaImpressao.find((j) => j.id === Number(mi[1]));
        if (job && mi[2] === 'feita') { job.feitaEm = Date.now(); log(`impressao #${job.id} impressa na recepcao (${sessao.nome})`); }
        if (job && mi[2] === 'falhou') { job.pegoEm = undefined; log(`impressao #${job.id} falhou na recepcao, volta pra fila`); }
        return send(res, 200, { ok: !!job });
      }
      const reqOffice = { method, url, sessao, body: () => readBody(req) };
      if (await gruposRoutes(reqOffice, (status, body) => send(res, status, body))) return;
      if (await painelRoutes(reqOffice, (status, body) => send(res, status, body))) return;
      if (await enduranceRoutes(reqOffice, (status, body) => send(res, status, body))) return;
      if (await pilotosRoutes(reqOffice, (status, body) => send(res, status, body))) return;
      const handled = await officeRoutes(reqOffice, (status, body) => send(res, status, body));
      if (handled) return;
    }
    if (path.startsWith('/api/crono/')) {
      requireKey(req);
      if (path === '/api/crono/baterias' || path.startsWith('/api/crono/baterias/')) await sincronizarTracadosDaCronometragem();
      let m = path.match(/^\/api\/crono\/baterias\/(\d+)\/grid$/);
      if (m) {
        const rows = await query(
          `SELECT i.Id inscricaoId, c.Nome nome, endurance.equipe, endurance.equipeId, endurance.pulseira, i.Kart kart, i.Pago pago, i.Aprovada aprovada, c.Id clienteId FROM dbo.Inscricao i JOIN dbo.Cliente c ON c.Id = i.ClienteId
           ${ENDURANCE_VINCULO_SQL}
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
             FROM dbo.Manutencao WHERE TRY_CAST(LTRIM(RTRIM(Kart)) AS int) = @n`, { n: numero });
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
        const clientes = await query<Record<string, unknown>>(`SELECT Id id, Email email, Cidade cidade, Estado uf, Peso peso, Sexo sexo, Telefone telefone FROM dbo.Cliente WHERE Id IN (${ids.join(',')})`);
        const vinculos = await query<{ clienteId: number; bateriaId: number; equipeId: number; equipe: string; pulseira: number }>(
          `SELECT p.ClienteId clienteId, ev.BateriaId bateriaId, q.Id equipeId, q.Nome equipe, p.Pulseira pulseira
           FROM dbo.EndurancePilotoInscricao p JOIN dbo.EnduranceEvento ev ON ev.Id = p.EventoId
           JOIN dbo.EnduranceEquipe q ON q.Id = p.EquipeId AND q.EventoId = ev.Id
           WHERE p.ClienteId IN (${ids.join(',')}) AND p.Ativo = 1 AND ev.Ativo = 1`);
        return send(res, 200, clientes.map((c) => ({ ...c, enduranceVinculos: vinculos.filter((v) => v.clienteId === c.id) })));
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
  // reserva em grupo (painel web): confere no Asaas os links de pagamento em aberto
  let conferindo = false;
  setInterval(async () => {
    if (conferindo) return;
    conferindo = true;
    try { await conferirCobrancas(log); } catch (e) { log(`grupo: conferência das cobranças falhou (${(e as Error).message})`); } finally { conferindo = false; }
  }, 60_000).unref();
}

// página Pilotos do painel web: lê da cronometragem as baterias encerradas novas (carreira e ranking por traçado)
setTimeout(() => { atualizarIndicePilotos(log).catch(() => undefined); }, 20_000);
setInterval(() => { atualizarIndicePilotos(log).catch(() => undefined); }, 120_000).unref();

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
