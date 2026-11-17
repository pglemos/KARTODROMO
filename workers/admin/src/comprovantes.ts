/**
 * Comprovantes de pagamento da reserva em grupo (Agenda).
 *
 * Quando o cliente já pagou fora do link novo do Asaas (antes de a reserva ser lançada no painel), o atendente registra o
 * pagamento e anexa o comprovante (foto ou PDF). O arquivo fica no R2 (binding COMPROVANTES); os dados para achá-lo ficam no
 * D1 `kartodromo-admin` (tabela comprovantes_pagamento). O login é o mesmo da Recepção, validado no servidor da operação.
 *
 *   GET    /api/comprovantes/grupo/:grupoId                        lista os comprovantes da reserva
 *   POST   /api/comprovantes/grupo/:grupoId/pagamento/:pagamentoId anexa (corpo = arquivo; ?nome= nome original)
 *   GET    /api/comprovantes/arquivo/:id                           abre o arquivo
 *   DELETE /api/comprovantes/:id                                   remove o anexo
 *
 * Anexos gerais (17/11/2026): comprovante de pagamento feito por fora do Asaas, contrato, arte etc. ligados a qualquer
 * coisa do kartódromo (reserva, grupo, bateria/evento, campeonato, contrato/cobrança de patrocínio, cliente):
 *   GET    /api/comprovantes/anexos?desde=AAAA-MM-DD&entidade=   os mais recentes (tela Comprovantes do CRM)
 *   GET    /api/comprovantes/anexos/:entidade/:id                os anexos daquela coisa
 *   POST   /api/comprovantes/anexos/:entidade/:id                anexa (corpo = arquivo; ?nome=&categoria=&descricao=&valor=&pago_em=&forma=)
 *   GET    /api/comprovantes/anexo/:id                           abre o arquivo
 *   DELETE /api/comprovantes/anexo/:id                           remove
 */

import { autenticar, type D1Db } from './patrocinadores';

export type R2Corpo = { arrayBuffer: () => Promise<ArrayBuffer> };
export type R2Bucket = {
  put: (chave: string, valor: ArrayBuffer, opcoes?: { httpMetadata?: { contentType?: string } }) => Promise<unknown>;
  get: (chave: string) => Promise<(R2Corpo & { body: ReadableStream }) | null>;
  delete: (chave: string) => Promise<void>;
};

export interface ComprovanteEnv {
  OPS_URL: string;
  KARTODROMO_ADMIN_DB?: D1Db;
  COMPROVANTES?: R2Bucket;
}

export const COMPROVANTE_MAX_BYTES = 8 * 1024 * 1024;
const MIMES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

const SEGURANCA: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'x-frame-options': 'DENY',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...SEGURANCA } });

class ErroHttp extends Error {
  constructor(readonly status: number, mensagem: string) {
    super(mensagem);
  }
}

type Linha = {
  id: number;
  grupo_id: number;
  pagamento_id: number;
  chave: string;
  nome_arquivo: string;
  tipo: string;
  tamanho: number;
  enviado_por: string;
  criado_em: string;
};

const publico = (l: Linha) => ({ id: l.id, grupoId: l.grupo_id, pagamentoId: l.pagamento_id, nome: l.nome_arquivo, tipo: l.tipo, tamanho: l.tamanho, enviadoPor: l.enviado_por, criadoEm: l.criado_em });

const idDe = (texto: string): number => {
  if (!/^\d{1,12}$/.test(texto)) throw new ErroHttp(400, 'Identificador inválido.');
  return Number(texto);
};

/** Nome só para mostrar: sem pastas, sem caracteres de controle, no máximo 120 caracteres. */
export function nomeSeguro(bruto: string | null): string {
  const base = (bruto ?? '').split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const limpo = base.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120);
  return limpo || 'comprovante';
}

/** O tipo vem do cabeçalho, mas só vale se os primeiros bytes do arquivo combinam com ele. */
export function tipoConfere(tipo: string, bytes: Uint8Array): boolean {
  const igual = (...b: number[]) => b.every((v, i) => bytes[i] === v);
  if (tipo === 'application/pdf') return igual(0x25, 0x50, 0x44, 0x46);
  if (tipo === 'image/png') return igual(0x89, 0x50, 0x4e, 0x47);
  if (tipo === 'image/jpeg') return igual(0xff, 0xd8, 0xff);
  if (tipo === 'image/webp') return igual(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return false;
}

export const ENTIDADES_DE_ANEXO = ['reserva', 'reserva_online', 'grupo', 'bateria', 'campeonato', 'patrocinio_contrato', 'patrocinio_cobranca', 'cliente'] as const;
export const CATEGORIAS_DE_ANEXO = ['comprovante', 'contrato', 'arte', 'logo', 'foto', 'documento', 'outro'] as const;
const MIMES_ANEXO = [...MIMES, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

type LinhaAnexo = {
  id: number; entidade: string; entidade_id: string; categoria: string; descricao: string | null; valor: number | null; pago_em: string | null;
  forma: string | null; chave: string; nome_arquivo: string; tipo: string; tamanho: number; enviado_por: string; criado_em: string;
};
const anexoPublico = (l: LinhaAnexo) => ({
  id: l.id, entidade: l.entidade, entidadeId: l.entidade_id, categoria: l.categoria, descricao: l.descricao, valor: l.valor, pagoEm: l.pago_em,
  forma: l.forma, nome: l.nome_arquivo, tipo: l.tipo, tamanho: l.tamanho, enviadoPor: l.enviado_por, criadoEm: l.criado_em,
});

const tabelaAnexosPronta = new WeakSet<object>();
/** A tabela nasce sozinha (mesmo SQL da migration 0014): o painel na VPS não tem passo de migração do D1. */
async function garantirAnexos(db: D1Db) {
  if (tabelaAnexosPronta.has(db)) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS anexos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entidade TEXT NOT NULL CHECK (entidade IN ('reserva','reserva_online','grupo','bateria','campeonato','patrocinio_contrato','patrocinio_cobranca','cliente')),
    entidade_id TEXT NOT NULL,
    categoria TEXT NOT NULL DEFAULT 'comprovante' CHECK (categoria IN ('comprovante','contrato','arte','logo','foto','documento','outro')),
    descricao TEXT, valor REAL, pago_em TEXT, forma TEXT,
    chave TEXT NOT NULL UNIQUE, nome_arquivo TEXT NOT NULL, tipo TEXT NOT NULL, tamanho INTEGER NOT NULL, enviado_por TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT (datetime('now')))`).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_anexos_entidade ON anexos (entidade, entidade_id)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_anexos_criado ON anexos (criado_em)').run();
  tabelaAnexosPronta.add(db);
}

const entidadeDe = (texto: string) => {
  if (!(ENTIDADES_DE_ANEXO as readonly string[]).includes(texto)) throw new ErroHttp(400, 'Tipo de registro inválido.');
  return texto;
};
const entidadeIdDe = (texto: string) => {
  if (!/^[0-9A-Za-z-]{1,64}$/.test(texto)) throw new ErroHttp(400, 'Identificador inválido.');
  return texto;
};
const textoCurto = (v: string | null, max: number) => {
  // eslint-disable-next-line no-control-regex
  const t = (v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
  return t || null;
};

async function tratarAnexos(req: Request, env: ComprovanteEnv, url: URL, partes: string[], quem: { nome: string }): Promise<Response> {
  const db = env.KARTODROMO_ADMIN_DB!;
  const r2 = env.COMPROVANTES!;
  await garantirAnexos(db);
  if (req.method === 'GET' && partes[0] === 'anexos' && partes.length === 1) {
    const desde = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('desde') ?? '') ? url.searchParams.get('desde')! : '2000-01-01';
    const ent = url.searchParams.get('entidade');
    const r = ent
      ? await db.prepare('SELECT * FROM anexos WHERE criado_em >= ? AND entidade = ? ORDER BY id DESC LIMIT 300').bind(desde, entidadeDe(ent)).all<LinhaAnexo>()
      : await db.prepare('SELECT * FROM anexos WHERE criado_em >= ? ORDER BY id DESC LIMIT 300').bind(desde).all<LinhaAnexo>();
    return json(200, r.results.map(anexoPublico));
  }
  if (partes[0] === 'anexos' && partes.length === 3) {
    const entidade = entidadeDe(partes[1]);
    const entidadeId = entidadeIdDe(partes[2]);
    if (req.method === 'GET') {
      const r = await db.prepare('SELECT * FROM anexos WHERE entidade = ? AND entidade_id = ? ORDER BY id').bind(entidade, entidadeId).all<LinhaAnexo>();
      return json(200, r.results.map(anexoPublico));
    }
    if (req.method === 'POST') {
      const tipo = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      if (!MIMES_ANEXO.includes(tipo)) throw new ErroHttp(415, 'Envie uma foto (JPG, PNG ou WebP), um PDF ou um DOCX.');
      const dados = await req.arrayBuffer();
      if (dados.byteLength === 0) throw new ErroHttp(400, 'O arquivo está vazio.');
      if (dados.byteLength > COMPROVANTE_MAX_BYTES) throw new ErroHttp(413, 'O arquivo passa de 8 MB. Envie um arquivo menor.');
      const cabeca = new Uint8Array(dados, 0, Math.min(16, dados.byteLength));
      const docx = tipo.includes('wordprocessingml') && cabeca[0] === 0x50 && cabeca[1] === 0x4b;
      if (!docx && !tipoConfere(tipo, cabeca)) throw new ErroHttp(400, 'O arquivo não parece ser do tipo informado.');
      const categoria = (CATEGORIAS_DE_ANEXO as readonly string[]).includes(url.searchParams.get('categoria') ?? '') ? url.searchParams.get('categoria')! : 'comprovante';
      const valorBruto = url.searchParams.get('valor');
      const valor = valorBruto != null && valorBruto !== '' && Number.isFinite(Number(valorBruto)) && Number(valorBruto) >= 0 ? Math.round(Number(valorBruto) * 100) / 100 : null;
      const pagoEm = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('pago_em') ?? '') ? url.searchParams.get('pago_em') : null;
      const chave = `anexos/${entidade}/${entidadeId}/${crypto.randomUUID()}`;
      await r2.put(chave, dados, { httpMetadata: { contentType: tipo } });
      try {
        await db
          .prepare('INSERT INTO anexos (entidade, entidade_id, categoria, descricao, valor, pago_em, forma, chave, nome_arquivo, tipo, tamanho, enviado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(entidade, entidadeId, categoria, textoCurto(url.searchParams.get('descricao'), 300), valor, pagoEm, textoCurto(url.searchParams.get('forma'), 40), chave, nomeSeguro(url.searchParams.get('nome')), tipo, dados.byteLength, quem.nome)
          .run();
      } catch (e) {
        await r2.delete(chave).catch(() => undefined);
        throw e;
      }
      const l = await db.prepare('SELECT * FROM anexos WHERE chave = ?').bind(chave).first<LinhaAnexo>();
      return json(201, l ? anexoPublico(l) : { ok: true });
    }
  }
  if (partes[0] === 'anexo' && partes.length === 2) {
    const id = idDe(partes[1]);
    const l = await db.prepare('SELECT * FROM anexos WHERE id = ?').bind(id).first<LinhaAnexo>();
    if (!l) throw new ErroHttp(404, 'Anexo não encontrado.');
    if (req.method === 'GET') {
      const obj = await r2.get(l.chave);
      if (!obj) throw new ErroHttp(404, 'Arquivo não encontrado.');
      const nomeAscii = l.nome_arquivo.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
      return new Response(obj.body, { status: 200, headers: { 'content-type': l.tipo, 'content-disposition': `inline; filename="${nomeAscii}"`, 'cache-control': 'private, no-store', ...SEGURANCA } });
    }
    if (req.method === 'DELETE') {
      await db.prepare('DELETE FROM anexos WHERE id = ?').bind(id).run();
      await r2.delete(l.chave).catch(() => undefined);
      return json(200, { ok: true });
    }
  }
  throw new ErroHttp(404, 'Rota não encontrada.');
}

/** O CRM (Kartódromo OS) envia e abre anexos direto do navegador, com o token curto do ops-server. */
const ORIGENS_LIBERADAS = new Set(['https://crm.kartodromodebetim.com.br']);
function comCors(req: Request, r: Response): Response {
  const origem = req.headers.get('origin') ?? '';
  if (!ORIGENS_LIBERADAS.has(origem)) return r;
  const h = new Headers(r.headers);
  h.set('access-control-allow-origin', origem);
  h.set('vary', 'origin');
  h.set('access-control-expose-headers', 'content-disposition, content-type');
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
}

export async function tratarComprovantes(req: Request, env: ComprovanteEnv, url: URL): Promise<Response> {
  const origem = req.headers.get('origin') ?? '';
  if (req.method === 'OPTIONS') {
    if (!ORIGENS_LIBERADAS.has(origem)) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': origem,
        'access-control-allow-methods': 'GET, POST, DELETE',
        'access-control-allow-headers': 'authorization, content-type',
        'access-control-max-age': '600',
        vary: 'origin',
      },
    });
  }
  return comCors(req, await tratarComprovantesInterno(req, env, url));
}

async function tratarComprovantesInterno(req: Request, env: ComprovanteEnv, url: URL): Promise<Response> {
  try {
    const quem = await autenticar(req, env);
    const db = env.KARTODROMO_ADMIN_DB;
    if (!db || !env.COMPROVANTES) throw new ErroHttp(503, 'O armazenamento de comprovantes ainda não foi ligado neste painel.');
    const partes = url.pathname.replace(/^\/api\/comprovantes\/?/, '').split('/').filter(Boolean);
    if (partes[0] === 'anexos' || partes[0] === 'anexo') return await tratarAnexos(req, env, url, partes, quem);

    if (req.method === 'GET' && partes[0] === 'grupo' && partes.length === 2) {
      const r = await db.prepare('SELECT * FROM comprovantes_pagamento WHERE grupo_id = ? ORDER BY id').bind(idDe(partes[1])).all<Linha>();
      return json(200, r.results.map(publico));
    }

    if (req.method === 'POST' && partes[0] === 'grupo' && partes[2] === 'pagamento' && partes.length === 4) {
      const grupoId = idDe(partes[1]);
      const pagamentoId = idDe(partes[3]);
      const tipo = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      if (!MIMES.includes(tipo)) throw new ErroHttp(415, 'Envie uma foto (JPG, PNG ou WebP) ou um PDF.');
      const dados = await req.arrayBuffer();
      if (dados.byteLength === 0) throw new ErroHttp(400, 'O arquivo está vazio.');
      if (dados.byteLength > COMPROVANTE_MAX_BYTES) throw new ErroHttp(413, 'O arquivo passa de 8 MB. Envie uma foto menor.');
      if (!tipoConfere(tipo, new Uint8Array(dados, 0, Math.min(16, dados.byteLength)))) throw new ErroHttp(400, 'O arquivo não parece ser do tipo informado.');
      const chave = `comprovantes/${grupoId}/${pagamentoId}/${crypto.randomUUID()}`;
      await env.COMPROVANTES.put(chave, dados, { httpMetadata: { contentType: tipo } });
      try {
        const nome = nomeSeguro(url.searchParams.get('nome'));
        await db
          .prepare('INSERT INTO comprovantes_pagamento (grupo_id, pagamento_id, chave, nome_arquivo, tipo, tamanho, enviado_por) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(grupoId, pagamentoId, chave, nome, tipo, dados.byteLength, quem.nome)
          .run();
      } catch (e) {
        await env.COMPROVANTES.delete(chave).catch(() => undefined);
        throw e;
      }
      const l = await db.prepare('SELECT * FROM comprovantes_pagamento WHERE chave = ?').bind(chave).first<Linha>();
      return json(201, l ? publico(l) : { ok: true });
    }

    if (req.method === 'GET' && partes[0] === 'arquivo' && partes.length === 2) {
      const l = await db.prepare('SELECT * FROM comprovantes_pagamento WHERE id = ?').bind(idDe(partes[1])).first<Linha>();
      const obj = l ? await env.COMPROVANTES.get(l.chave) : null;
      if (!l || !obj) throw new ErroHttp(404, 'Comprovante não encontrado.');
      const nomeAscii = l.nome_arquivo.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
      return new Response(obj.body, {
        status: 200,
        headers: { 'content-type': l.tipo, 'content-disposition': `inline; filename="${nomeAscii}"`, 'cache-control': 'private, no-store', ...SEGURANCA },
      });
    }

    if (req.method === 'DELETE' && partes.length === 1) {
      const id = idDe(partes[0]);
      const l = await db.prepare('SELECT * FROM comprovantes_pagamento WHERE id = ?').bind(id).first<Linha>();
      if (!l) throw new ErroHttp(404, 'Comprovante não encontrado.');
      await db.prepare('DELETE FROM comprovantes_pagamento WHERE id = ?').bind(id).run();
      await env.COMPROVANTES.delete(l.chave).catch(() => undefined);
      return json(200, { ok: true });
    }

    throw new ErroHttp(404, 'Rota não encontrada.');
  } catch (e) {
    // O ErroHttp de autenticar() (patrocinadores.ts) é outra classe: o que vale é ter status e mensagem.
    if (e instanceof Error && typeof (e as { status?: unknown }).status === 'number') return json((e as unknown as { status: number }).status, { error: e.message });
    return json(500, { error: 'Não foi possível concluir. Tente de novo.' });
  }
}
