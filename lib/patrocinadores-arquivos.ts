import type { AdminD1Database } from '@/lib/admin-d1';

export const PATRO_MAX_BYTES = 8 * 1024 * 1024;
const CHUNK_CHARS = 600_000; // multiplo de 4: cada parte e um base64 valido e cabe nas linhas do D1 (2 MB)

export const PATRO_MIMES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const PATRO_CATEGORIAS = ['logo', 'arte', 'contrato', 'foto', 'outro'] as const;
export type PatroCategoria = (typeof PATRO_CATEGORIAS)[number];

export async function salvarArquivoPatrocinio(
  db: AdminD1Database,
  input: { nome: string; mime: string; bytes: Uint8Array; categoria: PatroCategoria; empresaId?: string | null; contratoId?: string | null },
) {
  const id = crypto.randomUUID();
  const base64 = Buffer.from(input.bytes).toString('base64');
  const statements = [
    db.prepare('INSERT INTO patro_arquivos (id, nome, mime, tamanho, categoria, empresa_id, contrato_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, input.nome, input.mime, input.bytes.byteLength, input.categoria, input.empresaId ?? null, input.contratoId ?? null),
  ];
  for (let seq = 0, offset = 0; offset < base64.length; seq += 1, offset += CHUNK_CHARS) {
    statements.push(db.prepare('INSERT INTO patro_arquivo_partes (arquivo_id, seq, dados) VALUES (?, ?, ?)').bind(id, seq, base64.slice(offset, offset + CHUNK_CHARS)));
  }
  await db.batch(statements);
  return { id, nome: input.nome, mime: input.mime, tamanho: input.bytes.byteLength, categoria: input.categoria };
}

export async function lerArquivoPatrocinio(db: AdminD1Database, id: string) {
  const meta = await db.prepare('SELECT id, nome, mime, tamanho FROM patro_arquivos WHERE id = ?').bind(id).first<{ id: string; nome: string; mime: string; tamanho: number }>();
  if (!meta) return null;
  const partes = await db.prepare('SELECT dados FROM patro_arquivo_partes WHERE arquivo_id = ? ORDER BY seq').bind(id).all<{ dados: string }>();
  const bytes = Buffer.from(partes.results.map((parte) => parte.dados).join(''), 'base64');
  return { meta, bytes };
}

export async function removerArquivoPatrocinio(db: AdminD1Database, id: string) {
  await db.batch([
    db.prepare('DELETE FROM patro_arquivo_partes WHERE arquivo_id = ?').bind(id),
    db.prepare('UPDATE patro_empresas SET logo_arquivo_id = NULL WHERE logo_arquivo_id = ?').bind(id),
    db.prepare('UPDATE patro_espacos SET foto_arquivo_id = NULL WHERE foto_arquivo_id = ?').bind(id),
    db.prepare('UPDATE patro_contratos SET arte_arquivo_id = NULL WHERE arte_arquivo_id = ?').bind(id),
    db.prepare('UPDATE patro_contratos SET contrato_arquivo_id = NULL WHERE contrato_arquivo_id = ?').bind(id),
    db.prepare('DELETE FROM patro_arquivos WHERE id = ?').bind(id),
  ]);
}
