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

export async function tratarComprovantes(req: Request, env: ComprovanteEnv, url: URL): Promise<Response> {
  try {
    const quem = await autenticar(req, env);
    const db = env.KARTODROMO_ADMIN_DB;
    if (!db || !env.COMPROVANTES) throw new ErroHttp(503, 'O armazenamento de comprovantes ainda não foi ligado neste painel.');
    const partes = url.pathname.replace(/^\/api\/comprovantes\/?/, '').split('/').filter(Boolean);

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
