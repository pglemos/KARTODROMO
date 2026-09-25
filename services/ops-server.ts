/**
 * Servidor da operacao (substitui o LapTime Office + Autoatendimento). Roda no SRVKART.
 *
 *   /recepcao   app da recepcao (agenda de baterias, clientes, pagamento, caixa)
 *   /totem      app de autoatendimento (identificacao, cadastro/LGPD, escolher bateria, termo)
 *   /termo      termo de responsabilidade imprimivel (80mm)
 *   /api/...    JSON. Rotas da recepcao/crono exigem o header x-ops-key (OPS_RECEPCAO_KEY).
 *
 * Banco: KartodromoOps (lib/ops/db.ts). So LAN: o firewall do SRVKART libera a porta pra rede local.
 */
import http from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  CLIENTE_COLS,
  insertCliente,
  isValidCpf,
  one,
  onlyDigits,
  precos,
  query,
  tx,
  updateCliente,
  type ClienteInput,
} from '../lib/ops/db';

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
const TERMO_FILE = resolve(process.cwd(), process.env.OPS_TERMO_FILE || join('data', 'ops', 'termo.txt'));
const EMPRESA = process.env.OPS_EMPRESA || 'Kartódromo Internacional de Betim';

if (!KEY) console.warn('ATENCAO: OPS_RECEPCAO_KEY vazio, rotas da recepcao ficam sem protecao');

function log(...args: unknown[]) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
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
    throw new HttpError(400, 'JSON invalido.');
  }
}

function requireKey(req: http.IncomingMessage) {
  if (!KEY) return;
  const got = Buffer.from(String(req.headers['x-ops-key'] ?? ''));
  const want = Buffer.from(KEY);
  if (got.length !== want.length || !timingSafeEqual(got, want)) throw new HttpError(401, 'Chave do app invalida. Reinstale o app da recepcao.');
}

const sign = (text: string) => createHmac('sha256', KEY || 'sem-chave').update(text).digest('base64url').slice(0, 22);

const int = (v: unknown, name: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${name} invalido.`);
  return n;
};

const isoDate = (v: unknown) => {
  const s = String(v ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new HttpError(400, 'Data invalida (use AAAA-MM-DD).');
  return s;
};

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function mask(value: string | null | undefined, keepEnd = 4) {
  if (!value) return null;
  if (value.includes('@')) {
    const [u, d] = value.split('@');
    return `${u.slice(0, 2)}***@${d}`;
  }
  return value.length <= keepEnd ? value : `${'•'.repeat(Math.min(6, value.length - keepEnd))}${value.slice(-keepEnd)}`;
}

/** Monta um UPDATE parcial: set('Coluna=@x', 'x', valor). */
function updateBuilder(id: number) {
  const sets: string[] = [];
  const p: Record<string, unknown> = { id };
  const set = (expr: string, name: string, value: unknown) => {
    sets.push(expr);
    p[name] = value;
  };
  return { sets, p, set };
}

// ---------------------------------------------------------------- consultas comuns

const BATERIA_COLS = `b.Id id, b.Nome nome, CONVERT(varchar(16), b.Inicio, 126) inicio, b.TipoKart tipoKart, b.Vagas vagas, b.Status status,
  b.AutoAtendimento autoAtendimento, b.TimingSessionId timingSessionId,
  (SELECT COUNT(*) FROM dbo.Inscricao i WHERE i.BateriaId = b.Id AND i.Status <> 'cancelada') inscritos,
  (SELECT COUNT(*) FROM dbo.Inscricao i WHERE i.BateriaId = b.Id AND i.Status <> 'cancelada' AND i.Pago = 1) pagos`;

async function inscricoesDaBateria(bateriaId: number) {
  return query(
    `SELECT i.Id id, i.Status status, i.Origem origem, i.Kart kart, i.Pago pago, i.ValorCentavos valorCentavos,
            CONVERT(varchar(19), i.TermoImpressoEm, 126) termoImpressoEm, i.Observacao observacao, CONVERT(varchar(19), i.CriadoEm, 126) criadoEm,
            c.Id clienteId, c.Nome nome, c.Documento documento, c.Telefone telefone, CONVERT(varchar(10), c.Nascimento, 126) nascimento,
            c.Peso peso, c.ResponsavelId responsavelId, r.Nome responsavelNome, c.Bloqueado bloqueado,
            (SELECT TOP 1 p.Forma FROM dbo.Pagamento p WHERE p.InscricaoId = i.Id AND p.Estornado = 0 ORDER BY p.Id DESC) formaPagamento
     FROM dbo.Inscricao i JOIN dbo.Cliente c ON c.Id = i.ClienteId LEFT JOIN dbo.Cliente r ON r.Id = c.ResponsavelId
     WHERE i.BateriaId = @bateriaId AND i.Status <> 'cancelada' ORDER BY i.Id`,
    { bateriaId },
  );
}

async function inscrever(clienteId: number, bateriaId: number, origem: string, observacao?: string | null) {
  return tx(async (run) => {
    const [b] = await run(
      `SELECT b.Id, b.Status, b.Vagas, (SELECT COUNT(*) FROM dbo.Inscricao i WITH (UPDLOCK, HOLDLOCK) WHERE i.BateriaId = b.Id AND i.Status <> 'cancelada') ocupadas
       FROM dbo.Bateria b WHERE b.Id = @bateriaId`,
      { bateriaId },
    );
    if (!b) throw new HttpError(404, 'Bateria nao encontrada.');
    if (b.Status !== 'aberta') throw new HttpError(409, 'Bateria fechada.');
    if ((b.ocupadas as number) >= (b.Vagas as number)) throw new HttpError(409, 'Bateria lotada.');
    const [dup] = await run(`SELECT Id FROM dbo.Inscricao WHERE BateriaId=@bateriaId AND ClienteId=@clienteId AND Status <> 'cancelada'`, { bateriaId, clienteId });
    if (dup) return dup.Id as number;
    const [c] = await run(`SELECT Bloqueado FROM dbo.Cliente WHERE Id=@clienteId`, { clienteId });
    if (!c) throw new HttpError(404, 'Cliente nao encontrado.');
    if (c.Bloqueado) throw new HttpError(409, 'Cliente bloqueado. Procure a recepcao.');
    const [row] = await run(
      `INSERT INTO dbo.Inscricao (BateriaId, ClienteId, Origem, Observacao) OUTPUT inserted.Id id VALUES (@bateriaId, @clienteId, @origem, @observacao)`,
      { bateriaId, clienteId, origem, observacao: observacao ?? null },
    );
    return row.id as number;
  });
}

// ---------------------------------------------------------------- termo

const TERMO_PADRAO = `RASCUNHO - revisar com o juridico do kartodromo antes de usar em definitivo.

Declaro que estou em boas condicoes de saude e apto(a) a praticar kart, que nao estou sob efeito de alcool, medicamentos ou qualquer substancia que reduza meus reflexos, e que recebi e compreendi as orientacoes de seguranca (briefing) e o significado das bandeiras.

Comprometo-me a usar os equipamentos de seguranca fornecidos (capacete, balaclava e demais itens), a seguir as instrucoes dos fiscais de pista e as regras do kartodromo, e a nao provocar colisoes intencionais.

Estou ciente de que o kart e um esporte a motor com riscos inerentes, incluindo colisoes, capotamentos e lesoes, e assumo esses riscos ao participar da atividade.

Responsabilizo-me por danos causados ao equipamento por uso em desacordo com as orientacoes recebidas.

Autorizo o uso da minha imagem captada durante as atividades para divulgacao do kartodromo.

No caso de menor de idade, o responsavel legal abaixo identificado declara estar ciente e de acordo com todos os termos acima e responde pelo menor.`;

function termoTexto() {
  return existsSync(TERMO_FILE) ? readFileSync(TERMO_FILE, 'utf8') : TERMO_PADRAO;
}

function idade(nascimento: string | null) {
  if (!nascimento) return null;
  const [y, m, d] = nascimento.split('-').map(Number);
  const now = new Date();
  let a = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a--;
  return a;
}

async function termoHtml(ids: number[]) {
  const rows = await query<Record<string, string | number | null>>(
    `SELECT i.Id id, b.Nome bateria, CONVERT(varchar(16), b.Inicio, 126) inicio, c.Nome nome, c.TipoDocumento tipoDoc, c.Documento documento,
            CONVERT(varchar(10), c.Nascimento, 126) nascimento, c.Telefone telefone, r.Nome respNome, r.Documento respDoc
     FROM dbo.Inscricao i JOIN dbo.Bateria b ON b.Id = i.BateriaId JOIN dbo.Cliente c ON c.Id = i.ClienteId
     LEFT JOIN dbo.Cliente r ON r.Id = c.ResponsavelId WHERE i.Id IN (${ids.map((_, n) => '@i' + n).join(',')})`,
    Object.fromEntries(ids.map((id, n) => ['i' + n, id])),
  );
  if (rows.length) await query(`UPDATE dbo.Inscricao SET TermoImpressoEm = SYSDATETIME() WHERE Id IN (${ids.map((_, n) => '@i' + n).join(',')})`, Object.fromEntries(ids.map((id, n) => ['i' + n, id])));
  const texto = esc(termoTexto()).split(/\n\s*\n/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  const pages = rows.map((r) => {
    const age = idade(r.nascimento as string | null);
    const menor = age !== null && age < 18;
    const [data, hora] = String(r.inicio).split('T');
    return `<section class="page">
      <h1>${esc(EMPRESA)}</h1><h2>TERMO DE RESPONSABILIDADE</h2>
      <div class="box"><b>${esc(r.nome)}</b><br>${esc(r.tipoDoc)}: ${esc(r.documento || '—')}<br>Nascimento: ${r.nascimento ? esc(String(r.nascimento).split('-').reverse().join('/')) : '—'}${age !== null ? ` (${age} anos)` : ''}
      <br>${esc(r.bateria)} · ${esc(data.split('-').reverse().join('/'))} ${esc(hora)}<br>Inscrição nº ${r.id}</div>
      ${texto}
      <div class="sig">Assinatura do participante</div>
      ${menor ? `<div class="sig">Responsável legal: ${esc(r.respNome || '________________')}${r.respDoc ? ' · ' + esc(r.respDoc) : ''}</div>` : ''}
      <p class="small">Impresso em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
    </section>`;
  });
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Termo de responsabilidade</title><style>
    @page { size: 80mm auto; margin: 3mm; }
    body { font: 11px/1.35 Arial, sans-serif; color:#000; margin:0; width:74mm; }
    h1 { font-size:13px; text-align:center; margin:4px 0 0; } h2 { font-size:12px; text-align:center; margin:2px 0 8px; }
    .box { border:1px solid #000; padding:5px; margin-bottom:8px; } p { margin:0 0 6px; text-align:justify; }
    .sig { margin-top:34px; border-top:1px solid #000; padding-top:2px; text-align:center; font-size:10px; }
    .small { font-size:9px; text-align:center; margin-top:10px; } .page { page-break-after: always; }
  </style></head><body>${pages.join('') || '<p>Nada para imprimir.</p>'}<script>window.onload=()=>{setTimeout(()=>window.print(),300)}</script></body></html>`;
}

// ---------------------------------------------------------------- rotas do totem (sem chave)

async function totemRoutes(req: http.IncomingMessage, res: http.ServerResponse, path: string): Promise<boolean> {
  const method = req.method ?? 'GET';

  if (path === '/api/totem/identificar' && method === 'POST') {
    const body = await readBody(req);
    const raw = String(body.identificador ?? '').trim();
    if (raw.length < 5) throw new HttpError(400, 'Informe CPF, documento ou e-mail.');
    const where = raw.includes('@') ? 'c.Email = @v' : 'c.DocumentoNum = @v';
    const v = raw.includes('@') ? raw.toLowerCase() : onlyDigits(raw) || raw;
    const c = await one<Record<string, unknown>>(`SELECT TOP 1 ${CLIENTE_COLS} FROM dbo.Cliente c WHERE ${where} AND c.ResponsavelId IS NULL ORDER BY c.AtualizadoEm DESC`, { v });
    if (!c) return send(res, 200, { cliente: null }), true;
    const dependentes = await query(
      `SELECT c.Id id, c.Nome nome, CONVERT(varchar(10), c.Nascimento, 126) nascimento FROM dbo.Cliente c WHERE c.ResponsavelId = @id AND c.Bloqueado = 0 ORDER BY c.Nome`,
      { id: c.id },
    );
    // no totem so mostra o minimo: quem digita um CPF alheio nao ve os dados da pessoa
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
    if (!body.lgpd) throw new HttpError(400, 'E preciso aceitar o termo de consentimento (LGPD).');
    const id = body.id ? int(body.id, 'Cliente') : null;
    if (id) {
      if (String(body.token ?? '') !== sign(`cli:${id}`)) throw new HttpError(403, 'Sessao expirada, identifique-se de novo.');
      await updateCliente(id, { ...dados, lgpd: true }, true);
      log(`totem: cadastro atualizado ${id}`);
      return send(res, 200, { id, token: sign(`cli:${id}`) }), true;
    }
    // menor: exige o responsavel ja identificado
    let responsavelId: number | null = null;
    if (body.responsavelId) {
      responsavelId = int(body.responsavelId, 'Responsavel');
      if (String(body.responsavelToken ?? '') !== sign(`cli:${responsavelId}`)) throw new HttpError(403, 'Sessao expirada, identifique-se de novo.');
    }
    if (!dados.nome || String(dados.nome).trim().split(/\s+/).length < 2) throw new HttpError(400, 'Informe o nome completo.');
    if (!responsavelId) {
      if ((dados.tipoDocumento ?? 'CPF') === 'CPF' && !isValidCpf(String(dados.documento ?? ''))) throw new HttpError(400, 'CPF invalido.');
      if (!dados.telefone || onlyDigits(dados.telefone).length < 10) throw new HttpError(400, 'Informe o telefone com DDD.');
      const dup = await one<{ id: number }>(`SELECT TOP 1 Id id FROM dbo.Cliente WHERE DocumentoNum = @d AND ResponsavelId IS NULL`, { d: onlyDigits(dados.documento) });
      if (dup) throw new HttpError(409, 'Ja existe cadastro com esse documento. Volte e identifique-se pelo CPF.');
    }
    if (!dados.nascimento) throw new HttpError(400, 'Informe a data de nascimento.');
    const newId = await insertCliente({ ...dados, responsavelId, lgpd: true }, 'totem');
    log(`totem: cliente novo ${newId}${responsavelId ? ` (menor de ${responsavelId})` : ''}`);
    send(res, 201, { id: newId, token: sign(`cli:${newId}`) });
    return true;
  }

  if (path === '/api/totem/baterias' && method === 'GET') {
    const rows = await query(
      `SELECT ${BATERIA_COLS} FROM dbo.Bateria b
       WHERE b.Status = 'aberta' AND b.AutoAtendimento = 1
         AND b.Inicio >= DATEADD(minute, -10, SYSDATETIME()) AND b.Inicio < DATEADD(day, 1, CAST(SYSDATETIME() AS date))
       ORDER BY b.Inicio`,
    );
    send(res, 200, rows.map((r) => ({ ...r, livres: Math.max(0, (r.vagas as number) - (r.inscritos as number)) })).filter((r) => r.livres > 0));
    return true;
  }

  if (path === '/api/totem/inscrever' && method === 'POST') {
    const body = await readBody(req);
    const bateriaId = int(body.bateriaId, 'Bateria');
    const participantes = Array.isArray(body.participantes) ? body.participantes : [];
    if (!participantes.length) throw new HttpError(400, 'Escolha quem vai correr.');
    const ids: number[] = [];
    for (const p of participantes as { id: unknown; token: unknown }[]) {
      const cid = int(p.id, 'Participante');
      if (String(p.token ?? '') !== sign(`cli:${cid}`)) throw new HttpError(403, 'Sessao expirada, identifique-se de novo.');
      ids.push(await inscrever(cid, bateriaId, 'totem'));
    }
    const b = await one<{ inicio: string; nome: string }>(`SELECT CONVERT(varchar(16), Inicio, 126) inicio, Nome nome FROM dbo.Bateria WHERE Id=@bateriaId`, { bateriaId });
    log(`totem: ${ids.length} inscricao(oes) na bateria ${bateriaId}`);
    send(res, 201, { inscricoes: ids, bateria: b, termoUrl: `/termo?ids=${ids.join(',')}&s=${sign('termo:' + ids.join(','))}` });
    return true;
  }

  if (path === '/api/config' && method === 'GET') {
    send(res, 200, { empresa: EMPRESA, precos: precos() });
    return true;
  }

  return false;
}

// ---------------------------------------------------------------- rotas da recepcao (com chave)

async function recepcaoRoutes(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<boolean> {
  const path = url.pathname;
  const method = req.method ?? 'GET';
  let m: RegExpMatchArray | null;

  // --- baterias
  if (path === '/api/baterias' && method === 'GET') {
    const data = isoDate(url.searchParams.get('data'));
    send(res, 200, await query(`SELECT ${BATERIA_COLS} FROM dbo.Bateria b WHERE CAST(b.Inicio AS date) = @data AND b.Status <> 'cancelada' ORDER BY b.Inicio`, { data }));
    return true;
  }

  if (path === '/api/baterias/gerar' && method === 'POST') {
    const b = await readBody(req);
    const data = isoDate(b.data);
    const [h, mi] = String(b.inicio ?? '').split(':').map(Number);
    const qtd = Math.min(40, int(b.quantidade, 'Quantidade'));
    const intervalo = int(b.intervaloMin, 'Intervalo');
    const vagas = int(b.vagas ?? 30, 'Vagas');
    const tipoKart = b.tipoKart === 'super' ? 'super' : 'light';
    if (!(h >= 0 && h < 24 && mi >= 0 && mi < 60)) throw new HttpError(400, 'Horario inicial invalido.');
    let created = 0;
    for (let n = 0; n < qtd; n++) {
      const t = h * 60 + mi + n * intervalo;
      if (t >= 24 * 60) break;
      const hhmm = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
      const inicio = `${data}T${hhmm}:00`;
      const exists = await one(`SELECT 1 x FROM dbo.Bateria WHERE Inicio = @inicio AND TipoKart = @tipoKart AND Status <> 'cancelada'`, { inicio, tipoKart });
      if (exists) continue;
      await query(`INSERT INTO dbo.Bateria (Inicio, Nome, TipoKart, Vagas) VALUES (@inicio, @nome, @tipoKart, @vagas)`, {
        inicio,
        nome: `${tipoKart === 'super' ? 'SUPER KART' : 'BATERIA'} ${hhmm}`,
        tipoKart,
        vagas,
      });
      created++;
    }
    send(res, 201, { criadas: created });
    return true;
  }

  if ((m = path.match(/^\/api\/baterias\/(\d+)$/)) && method === 'PATCH') {
    const id = Number(m[1]);
    const b = await readBody(req);
    const { sets, p, set } = updateBuilder(id);
    if (typeof b.nome === 'string' && b.nome.trim()) set('Nome=@nome', 'nome', b.nome.trim().slice(0, 100));
    if (b.status && ['aberta', 'fechada', 'cancelada'].includes(String(b.status))) set('Status=@status', 'status', b.status);
    if (b.vagas !== undefined) set('Vagas=@vagas', 'vagas', int(b.vagas, 'Vagas'));
    if (b.tipoKart === 'light' || b.tipoKart === 'super') set('TipoKart=@tipoKart', 'tipoKart', b.tipoKart);
    if (b.autoAtendimento !== undefined) set('AutoAtendimento=@aa', 'aa', b.autoAtendimento ? 1 : 0);
    if (typeof b.inicio === 'string' && /^\d{2}:\d{2}$/.test(b.inicio)) {
      set("Inicio = CAST(CONCAT(CONVERT(varchar(10), Inicio, 126), 'T', @hora, ':00') AS datetime2)", 'hora', b.inicio);
    }
    if (typeof b.timingSessionId === 'string') set('TimingSessionId=@ts', 'ts', b.timingSessionId.slice(0, 40));
    if (!sets.length) throw new HttpError(400, 'Nada para alterar.');
    if (p.status === 'cancelada') {
      const ativos = await one<{ n: number }>(`SELECT COUNT(*) n FROM dbo.Inscricao WHERE BateriaId=@id AND Status <> 'cancelada'`, { id });
      if (ativos!.n > 0) throw new HttpError(409, 'A bateria tem inscritos. Mova ou cancele as inscricoes antes.');
    }
    await query(`UPDATE dbo.Bateria SET ${sets.join(', ')} WHERE Id=@id`, p);
    send(res, 200, await one(`SELECT ${BATERIA_COLS} FROM dbo.Bateria b WHERE b.Id=@id`, { id }));
    return true;
  }

  if ((m = path.match(/^\/api\/baterias\/(\d+)\/inscricoes$/)) && method === 'GET') {
    send(res, 200, await inscricoesDaBateria(Number(m[1])));
    return true;
  }

  // --- inscricoes
  if (path === '/api/inscricoes' && method === 'POST') {
    const b = await readBody(req);
    const id = await inscrever(int(b.clienteId, 'Cliente'), int(b.bateriaId, 'Bateria'), ['recepcao', 'site', 'whatsapp'].includes(String(b.origem)) ? String(b.origem) : 'recepcao', (b.observacao as string) ?? null);
    send(res, 201, { id });
    return true;
  }

  if ((m = path.match(/^\/api\/inscricoes\/(\d+)$/)) && method === 'PATCH') {
    const id = Number(m[1]);
    const b = await readBody(req);
    if (b.bateriaId) {
      // mover de bateria: valida vaga no destino e preserva pagamento
      const destino = int(b.bateriaId, 'Bateria');
      const atual = await one<{ ClienteId: number }>(`SELECT ClienteId FROM dbo.Inscricao WHERE Id=@id`, { id });
      if (!atual) throw new HttpError(404, 'Inscricao nao encontrada.');
      await tx(async (run) => {
        const [d] = await run(
          `SELECT b.Status, b.Vagas, (SELECT COUNT(*) FROM dbo.Inscricao i WITH (UPDLOCK, HOLDLOCK) WHERE i.BateriaId=b.Id AND i.Status<>'cancelada') ocupadas FROM dbo.Bateria b WHERE b.Id=@destino`,
          { destino },
        );
        if (!d) throw new HttpError(404, 'Bateria destino nao encontrada.');
        if ((d.ocupadas as number) >= (d.Vagas as number)) throw new HttpError(409, 'Bateria destino lotada.');
        await run(`UPDATE dbo.Inscricao SET BateriaId=@destino, AtualizadoEm=SYSDATETIME() WHERE Id=@id`, { destino, id });
      });
    }
    const { sets, p, set } = updateBuilder(id);
    if (b.kart !== undefined) set('Kart=@kart', 'kart', b.kart ? String(b.kart).trim().slice(0, 10) : null);
    if (b.status && ['reservada', 'confirmada', 'cancelada'].includes(String(b.status))) set('Status=@status', 'status', b.status);
    if (b.observacao !== undefined) set('Observacao=@obs', 'obs', b.observacao ? String(b.observacao).slice(0, 400) : null);
    if (sets.length) await query(`UPDATE dbo.Inscricao SET ${sets.join(', ')}, AtualizadoEm=SYSDATETIME() WHERE Id=@id`, p);
    send(res, 200, { ok: true });
    return true;
  }

  if ((m = path.match(/^\/api\/inscricoes\/(\d+)\/pagar$/)) && method === 'POST') {
    const id = Number(m[1]);
    const b = await readBody(req);
    const tabela = String(b.tabela ?? '');
    const forma = String(b.forma ?? '');
    const operador = String(b.operador ?? '').trim().slice(0, 60);
    if (!['antecipado', 'balcao', 'super', 'avulso'].includes(tabela)) throw new HttpError(400, 'Tabela de preco invalida.');
    if (!['dinheiro', 'credito', 'debito', 'pix', 'site'].includes(forma)) throw new HttpError(400, 'Forma de pagamento invalida.');
    if (!operador) throw new HttpError(400, 'Operador nao identificado.');
    const valor = Math.round(Number(b.valorCentavos));
    if (!Number.isFinite(valor) || valor < 0 || valor > 10_000_00) throw new HttpError(400, 'Valor invalido.');
    await tx(async (run) => {
      const [i] = await run(`SELECT i.Id, i.Pago, c.Nome, bt.Nome bateria FROM dbo.Inscricao i JOIN dbo.Cliente c ON c.Id=i.ClienteId JOIN dbo.Bateria bt ON bt.Id=i.BateriaId WHERE i.Id=@id`, { id });
      if (!i) throw new HttpError(404, 'Inscricao nao encontrada.');
      if (i.Pago) throw new HttpError(409, 'Essa inscricao ja esta paga.');
      await run(`INSERT INTO dbo.Pagamento (InscricaoId, Descricao, Tabela, Forma, ValorCentavos, Operador) VALUES (@id, @desc, @tabela, @forma, @valor, @operador)`, {
        id,
        desc: `${i.bateria} - ${i.Nome}`.slice(0, 200),
        tabela,
        forma,
        valor,
        operador,
      });
      await run(`UPDATE dbo.Inscricao SET Pago=1, ValorCentavos=@valor, Status='confirmada', AtualizadoEm=SYSDATETIME() WHERE Id=@id`, { id, valor });
    });
    log(`pagamento inscricao ${id}: ${tabela}/${forma} ${valor / 100} por ${operador}`);
    send(res, 200, { ok: true });
    return true;
  }

  if ((m = path.match(/^\/api\/inscricoes\/(\d+)\/estornar$/)) && method === 'POST') {
    const id = Number(m[1]);
    await tx(async (run) => {
      await run(`UPDATE dbo.Pagamento SET Estornado=1, EstornadoEm=SYSDATETIME() WHERE InscricaoId=@id AND Estornado=0`, { id });
      await run(`UPDATE dbo.Inscricao SET Pago=0, ValorCentavos=NULL, Status='reservada', AtualizadoEm=SYSDATETIME() WHERE Id=@id`, { id });
    });
    log(`estorno inscricao ${id}`);
    send(res, 200, { ok: true });
    return true;
  }

  if (path === '/api/termo-link' && method === 'GET') {
    const ids = String(url.searchParams.get('ids') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0);
    send(res, 200, { url: `/termo?ids=${ids.join(',')}&s=${sign('termo:' + ids.join(','))}` });
    return true;
  }

  // --- clientes
  if (path === '/api/clientes' && method === 'GET') {
    const q = String(url.searchParams.get('q') ?? '').trim();
    if (q.length < 2) return send(res, 200, []), true;
    const d = onlyDigits(q);
    let where: string;
    let p: Record<string, unknown>;
    if (q.includes('@')) {
      where = 'c.Email LIKE @q';
      p = { q: q.toLowerCase() + '%' };
    } else if (d.length >= 4 && d.length === q.replace(/[\s.\-()/]/g, '').length) {
      // so digitos: CPF pelo comeco, telefone pelo fim
      where = '(c.DocumentoNum LIKE @d OR c.TelefoneNum LIKE @t)';
      p = { d: d + '%', t: '%' + d };
    } else {
      where = 'c.Nome COLLATE Latin1_General_CI_AI LIKE @q';
      p = { q: '%' + q.replace(/\s+/g, '%') + '%' };
    }
    send(res, 200, await query(`SELECT TOP 50 ${CLIENTE_COLS}, r.Nome responsavelNome FROM dbo.Cliente c LEFT JOIN dbo.Cliente r ON r.Id=c.ResponsavelId WHERE ${where} ORDER BY c.AtualizadoEm DESC`, p));
    return true;
  }

  if ((m = path.match(/^\/api\/clientes\/(\d+)$/)) && method === 'GET') {
    const id = Number(m[1]);
    const c = await one(`SELECT ${CLIENTE_COLS}, r.Nome responsavelNome FROM dbo.Cliente c LEFT JOIN dbo.Cliente r ON r.Id=c.ResponsavelId WHERE c.Id=@id`, { id });
    if (!c) throw new HttpError(404, 'Cliente nao encontrado.');
    const dependentes = await query(`SELECT c.Id id, c.Nome nome, CONVERT(varchar(10), c.Nascimento, 126) nascimento FROM dbo.Cliente c WHERE c.ResponsavelId=@id`, { id });
    const historico = await query(
      `SELECT TOP 30 i.Id id, b.Nome bateria, CONVERT(varchar(16), b.Inicio, 126) inicio, i.Status status, i.Pago pago, i.ValorCentavos valorCentavos, i.Kart kart
       FROM dbo.Inscricao i JOIN dbo.Bateria b ON b.Id=i.BateriaId WHERE i.ClienteId=@id ORDER BY b.Inicio DESC`,
      { id },
    );
    send(res, 200, { ...c, dependentes, historico });
    return true;
  }

  if (path === '/api/clientes' && method === 'POST') {
    const b = (await readBody(req)) as ClienteInput;
    if ((b.tipoDocumento ?? 'CPF') === 'CPF' && b.documento && !isValidCpf(b.documento)) throw new HttpError(400, 'CPF invalido.');
    if (b.documento && !b.responsavelId) {
      const dup = await one<{ id: number; nome: string }>(`SELECT TOP 1 Id id, Nome nome FROM dbo.Cliente WHERE DocumentoNum=@d`, { d: onlyDigits(b.documento) });
      if (dup) throw new HttpError(409, `Documento ja cadastrado para ${dup.nome} (cliente ${dup.id}).`);
    }
    send(res, 201, { id: await insertCliente(b, 'recepcao') });
    return true;
  }

  if ((m = path.match(/^\/api\/clientes\/(\d+)$/)) && method === 'PUT') {
    const b = (await readBody(req)) as ClienteInput;
    if ((b.tipoDocumento ?? 'CPF') === 'CPF' && b.documento && !isValidCpf(b.documento)) throw new HttpError(400, 'CPF invalido.');
    await updateCliente(Number(m[1]), b, false);
    send(res, 200, { ok: true });
    return true;
  }

  // --- caixa
  if (path === '/api/caixa' && method === 'GET') {
    const data = isoDate(url.searchParams.get('data'));
    const pagamentos = await query(
      `SELECT p.Id id, p.InscricaoId inscricaoId, p.Descricao descricao, p.Tabela tabela, p.Forma forma, p.ValorCentavos valorCentavos,
              p.Operador operador, p.Estornado estornado, CONVERT(varchar(19), p.CriadoEm, 126) criadoEm
       FROM dbo.Pagamento p WHERE CAST(p.CriadoEm AS date)=@data ORDER BY p.Id DESC`,
      { data },
    );
    const movimentos = await query(
      `SELECT Id id, Tipo tipo, ValorCentavos valorCentavos, Operador operador, Observacao observacao, CONVERT(varchar(19), CriadoEm, 126) criadoEm
       FROM dbo.CaixaMovimento WHERE CAST(CriadoEm AS date)=@data ORDER BY Id`,
      { data },
    );
    const porForma: Record<string, number> = {};
    for (const p of pagamentos) if (!p.estornado) porForma[p.forma as string] = (porForma[p.forma as string] ?? 0) + (p.valorCentavos as number);
    const mov = (t: string) => movimentos.filter((x) => x.tipo === t).reduce((s, x) => s + (x.valorCentavos as number), 0);
    send(res, 200, {
      data,
      pagamentos,
      movimentos,
      porForma,
      total: Object.values(porForma).reduce((a, b) => a + b, 0),
      dinheiroEmCaixa: mov('abertura') + mov('suprimento') - mov('sangria') + (porForma.dinheiro ?? 0),
    });
    return true;
  }

  if (path === '/api/caixa/movimento' && method === 'POST') {
    const b = await readBody(req);
    const tipo = String(b.tipo ?? '');
    if (!['abertura', 'suprimento', 'sangria', 'fechamento'].includes(tipo)) throw new HttpError(400, 'Tipo invalido.');
    const valor = Math.round(Number(b.valorCentavos));
    if (!Number.isFinite(valor) || valor < 0) throw new HttpError(400, 'Valor invalido.');
    const operador = String(b.operador ?? '').trim().slice(0, 60);
    if (!operador) throw new HttpError(400, 'Operador nao identificado.');
    await query(`INSERT INTO dbo.CaixaMovimento (Tipo, ValorCentavos, Operador, Observacao) VALUES (@tipo, @valor, @operador, @obs)`, {
      tipo,
      valor,
      operador,
      obs: b.observacao ? String(b.observacao).slice(0, 400) : null,
    });
    send(res, 201, { ok: true });
    return true;
  }

  // --- integracao com a cronometragem (servico no PC de cronometragem)
  if ((m = path.match(/^\/api\/crono\/baterias\/(\d+)\/grid$/)) && method === 'GET') {
    const rows = await inscricoesDaBateria(Number(m[1]));
    send(res, 200, rows.map((r) => ({ inscricaoId: r.id, nome: r.nome, kart: r.kart, pago: Boolean(r.pago), clienteId: r.clienteId })));
    return true;
  }

  return false;
}

// ---------------------------------------------------------------- servidor

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname;
  try {
    if (path === '/' || path === '/recepcao') return sendHtml(res, readFileSync(join(UI_DIR, 'recepcao.html')));
    if (path === '/totem') return sendHtml(res, readFileSync(join(UI_DIR, 'totem.html')));
    if (path === '/healthz') {
      const r = await one<{ agora: string }>(`SELECT CONVERT(varchar(19), SYSDATETIME(), 126) agora`);
      return send(res, 200, { ok: true, sqlAgora: r?.agora });
    }
    if (path === '/termo') {
      const idsText = String(url.searchParams.get('ids') ?? '');
      const ids = idsText.split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 20);
      if (!ids.length || url.searchParams.get('s') !== sign('termo:' + ids.join(','))) throw new HttpError(403, 'Link do termo invalido.');
      return sendHtml(res, await termoHtml(ids));
    }
    if (path.startsWith('/api/')) {
      if (await totemRoutes(req, res, path)) return;
      requireKey(req);
      if (await recepcaoRoutes(req, res, url)) return;
    }
    send(res, 404, { error: 'Rota desconhecida.' });
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.message });
    log('erro', req.method, path, err);
    if (!res.headersSent) send(res, 500, { error: 'Erro interno. Tente de novo.' });
  }
});

server.listen(PORT, '0.0.0.0', () => log(`Servidor da operacao em http://0.0.0.0:${PORT} (recepcao /recepcao, totem /totem)`));
