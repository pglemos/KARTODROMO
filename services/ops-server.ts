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
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { CLIENTE_COLS, insertCliente, isValidCpf, one, onlyDigits, query, updateCliente, type ClienteInput } from '../lib/ops/db';
import { confereSenha, emiteToken, validaToken } from '../lib/ops/auth';
import { HttpError, inscreverN, officeRoutes } from '../lib/ops/office';
import { relatorio } from '../lib/ops/relatorios';
import { renderTermoResponsabilidade, type TermoParticipante } from '../lib/ops/termo';

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
const TERMO_FILE = process.env.OPS_TERMO_FILE ? resolve(process.cwd(), process.env.OPS_TERMO_FILE) : null;

if (!KEY) console.warn('ATENCAO: OPS_RECEPCAO_KEY vazio, rotas da cronometragem ficam sem protecao');

function log(...args: unknown[]) {
  console.log(`[${new Date().toISOString()}]`, ...args);
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


function mask(value: string | null | undefined, keepEnd = 4) {
  if (!value) return null;
  if (value.includes('@')) {
    const [u, d] = value.split('@');
    return `${u.slice(0, 2)}***@${d}`;
  }
  return value.length <= keepEnd ? value : `${'•'.repeat(Math.min(6, value.length - keepEnd))}${value.slice(-keepEnd)}`;
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
    const c = await one<Record<string, unknown>>(
      `SELECT TOP 1 ${CLIENTE_COLS} FROM dbo.Cliente c WHERE ${isEmail ? 'c.Email = @v' : '(c.DocumentoNum = @v OR c.Documento = @v)'} ORDER BY CASE WHEN c.ResponsavelId IS NULL THEN 0 ELSE 1 END, c.AtualizadoEm DESC`,
      { v },
    );
    if (!c) return send(res, 200, { cliente: null }), true;
    const dependentes = await query<{ id: number; nome: string; nascimento: string }>(
      `SELECT c.Id id, c.Nome nome, CONVERT(varchar(10), c.Nascimento, 126) nascimento FROM dbo.Cliente c WHERE c.ResponsavelId = @id AND c.Bloqueado = 0 ORDER BY c.Nome`,
      { id: c.id },
    );
    // no totem so aparece o minimo: quem digita um CPF alheio nao ve os dados da pessoa
    send(res, 200, {
      cliente: {
        id: c.id,
        nome: c.nome,
        email: mask(c.email as string),
        telefone: mask(onlyDigits(c.telefone)),
        temNascimento: Boolean(c.nascimento),
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
    if (id) {
      if (String(body.token ?? '') !== sign(`cli:${id}`)) throw new HttpError(403, 'Sessão expirada, identifique-se de novo.');
      await updateCliente(id, { ...dados, lgpd: true }, true);
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
    log(`totem: cliente novo ${newId}${responsavelId ? ` (menor de ${responsavelId})` : ''}`);
    send(res, 201, { id: newId, token: sign(`cli:${newId}`) });
    return true;
  }

  if (path === '/api/totem/baterias' && method === 'GET') {
    const rows = await query<{ id: number; nome: string; inicio: string; vagas: number; ocupadas: number; tipoKart: string }>(
      `SELECT b.Id id, b.Nome nome, CONVERT(varchar(16), b.Inicio, 126) inicio, b.Vagas vagas, b.TipoKart tipoKart,
              (SELECT COUNT(*) FROM dbo.Inscricao i WHERE i.BateriaId = b.Id AND i.Status <> 'cancelada') ocupadas
       FROM dbo.Bateria b
       WHERE b.Status = 'aberta' AND b.AutoAtendimento = 1 AND b.ReservaFechada = 0
         AND b.Inicio >= DATEADD(minute, -10, SYSDATETIME()) AND b.Inicio < DATEADD(day, 1, CAST(SYSDATETIME() AS date))
       ORDER BY b.Inicio`,
    );
    send(res, 200, rows.map((r) => ({ ...r, livres: Math.max(0, r.vagas - r.ocupadas) })).filter((r) => r.livres > 0));
    return true;
  }

  if (path === '/api/totem/inscrever' && method === 'POST') {
    const body = await readBody(req);
    const baterias = (Array.isArray(body.bateriaIds) ? body.bateriaIds : [body.bateriaId]).filter(Boolean).map((b) => int(b, 'Bateria'));
    if (!baterias.length) throw new HttpError(400, 'Selecione pelo menos uma bateria.');
    const participantes = Array.isArray(body.participantes) ? body.participantes : [];
    if (!participantes.length) throw new HttpError(400, 'Selecione quem vai correr.');
    const ids: number[] = [];
    for (const bateriaId of baterias) {
      for (const p of participantes as { id: unknown; token: unknown }[]) {
        const cid = int(p.id, 'Participante');
        if (String(p.token ?? '') !== sign(`cli:${cid}`)) throw new HttpError(403, 'Sessão expirada, identifique-se de novo.');
        const dup = await one<{ Id: number }>(`SELECT Id FROM dbo.Inscricao WHERE BateriaId = @b AND ClienteId = @c AND Status <> 'cancelada'`, { b: bateriaId, c: cid });
        if (dup) {
          ids.push(dup.Id);
          continue;
        }
        // pre-reserva: aparece em Reservas > Aprovar na recepcao
        ids.push(...(await inscreverN(bateriaId, cid, 1, 'totem', null, null, false)));
      }
    }
    const primeira = await one<{ inicio: string }>(`SELECT TOP 1 CONVERT(varchar(16), Inicio, 126) inicio FROM dbo.Bateria WHERE Id IN (${baterias.map((_, n) => '@b' + n).join(',')}) ORDER BY Inicio`, Object.fromEntries(baterias.map((b, n) => ['b' + n, b])));
    const p = await parametros();
    log(`totem: ${ids.length} pre-reserva(s) em ${baterias.length} bateria(s)`);
    send(res, 201, { inscricoes: ids, inicio: primeira?.inicio, termoUrl: p['totem.imprimirTermo'] !== 'false' ? termoLink(ids) : null });
    return true;
  }

  return false;
}

// ---------------------------------------------------------------- login da recepcao

async function loginRoute(req: http.IncomingMessage, res: http.ServerResponse) {
  const b = await readBody(req);
  const login = String(b.login ?? '').trim().toLowerCase();
  const senha = String(b.senha ?? '');
  if (!b.termos) throw new HttpError(400, 'É necessário concordar com os termos de uso.');
  const u = await one<{ id: number; nome: string; hash: string; admin: boolean; ativo: boolean }>(`SELECT Id id, Nome nome, SenhaHash hash, Admin admin, Ativo ativo FROM dbo.Usuario WHERE Login = @login`, { login });
  if (!u || !u.ativo || !confereSenha(senha, u.hash)) {
    log(`login recusado: ${login}`);
    throw new HttpError(401, 'Login ou senha inválidos.');
  }
  log(`login: ${login}`);
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
      return sendHtml(res, await relatorio(path.slice('/relatorio/'.length), url));
    }
    if (path === '/api/login' && method === 'POST') return await loginRoute(req, res);
    if (path.startsWith('/api/totem/')) {
      if (await totemRoutes(req, res, path)) return;
    }
    if (path.startsWith('/api/office/')) {
      const sessao = sessaoDe(req, url);
      if (path === '/api/office/termo-link' && method === 'GET') {
        const ids = String(url.searchParams.get('ids') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0);
        return send(res, 200, { url: termoLink(ids) });
      }
      const handled = await officeRoutes({ method, url, sessao, body: () => readBody(req) }, (status, body) => send(res, status, body));
      if (handled) return;
    }
    if (path.startsWith('/api/crono/')) {
      requireKey(req);
      let m = path.match(/^\/api\/crono\/baterias\/(\d+)\/grid$/);
      if (m) {
        const rows = await query(
          `SELECT i.Id inscricaoId, c.Nome nome, i.Kart kart, i.Pago pago, i.Aprovada aprovada, c.Id clienteId FROM dbo.Inscricao i JOIN dbo.Cliente c ON c.Id = i.ClienteId
           WHERE i.BateriaId = @id AND i.Status <> 'cancelada' ORDER BY i.Id`,
          { id: Number(m[1]) },
        );
        return send(res, 200, rows);
      }
      m = path.match(/^\/api\/crono\/baterias\/(\d+)\/programa$/);
      if (m) {
        return send(res, 200, await query(`SELECT pp.Ordem ordem, pp.Nome nome, pp.Tipo tipo, pp.Finalizacao finalizacao, pp.TempoMin tempoMin, pp.VoltasMax voltasMax, b.VoltaMinimaSeg voltaMinimaSeg
          FROM dbo.Bateria b JOIN dbo.ProdutoProva pp ON pp.ProdutoId = b.ProdutoId WHERE b.Id = @id ORDER BY pp.Ordem`, { id: Number(m[1]) }));
      }
      if (path === '/api/crono/baterias' && method === 'GET') {
        const data = String(url.searchParams.get('data') ?? '');
        return send(res, 200, await query(
          `SELECT b.Id id, b.Nome nome, CONVERT(varchar(16), b.Inicio, 126) inicio, b.Vagas vagas, b.TipoKart tipoKart,
                  (SELECT COUNT(*) FROM dbo.Inscricao i WHERE i.BateriaId = b.Id AND i.Status <> 'cancelada') inscritos,
                  (SELECT COUNT(*) FROM dbo.Inscricao i WHERE i.BateriaId = b.Id AND i.Status <> 'cancelada' AND i.Pago = 1) pagos
           FROM dbo.Bateria b WHERE b.Status <> 'cancelada' AND b.Inicio >= @d AND b.Inicio < DATEADD(day, 1, @d) ORDER BY b.Inicio`,
          { d: /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : new Date().toISOString().slice(0, 10) },
        ));
      }
    }
    // compatibilidade com a cronometragem instalada antes (usa /api/baterias?data= com a chave)
    if (path === '/api/baterias' && method === 'GET') {
      requireKey(req);
      const data = String(url.searchParams.get('data') ?? '');
      return send(res, 200, await query(
        `SELECT b.Id id, b.Nome nome, CONVERT(varchar(16), b.Inicio, 126) inicio, b.Vagas vagas, b.TipoKart tipoKart,
                (SELECT COUNT(*) FROM dbo.Inscricao i WHERE i.BateriaId = b.Id AND i.Status <> 'cancelada') inscritos,
                (SELECT COUNT(*) FROM dbo.Inscricao i WHERE i.BateriaId = b.Id AND i.Status <> 'cancelada' AND i.Pago = 1) pagos
         FROM dbo.Bateria b WHERE b.Status <> 'cancelada' AND b.Inicio >= @d AND b.Inicio < DATEADD(day, 1, @d) ORDER BY b.Inicio`,
        { d: /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : new Date().toISOString().slice(0, 10) },
      ));
    }
    send(res, 404, { error: 'Rota desconhecida.' });
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.message });
    log('erro', method, path, err);
    if (!res.headersSent) send(res, 500, { error: 'Erro interno. Tente de novo.' });
  }
});

server.listen(PORT, '0.0.0.0', () => log(`Servidor da operacao em http://0.0.0.0:${PORT} (recepcao /recepcao, totem /totem)`));
