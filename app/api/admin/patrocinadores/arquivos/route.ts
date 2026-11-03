import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { adminCookieName, readAdminSession } from '@/lib/admin-auth';
import { getCloudflareAdminDb } from '@/lib/cloudflare-admin-db';
import {
  PATRO_CATEGORIAS,
  PATRO_MAX_BYTES,
  PATRO_MIMES,
  salvarArquivoPatrocinio,
  type PatroCategoria,
} from '@/lib/patrocinadores-arquivos';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  if (!readAdminSession(cookieStore.get(adminCookieName())?.value)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!form || !(file instanceof File)) return NextResponse.json({ error: 'invalid_file' }, { status: 400 });
  if (!PATRO_MIMES.some((mime) => mime === file.type)) return NextResponse.json({ error: 'invalid_file_type' }, { status: 415 });
  if (file.size === 0 || file.size > PATRO_MAX_BYTES) return NextResponse.json({ error: 'invalid_file_size' }, { status: 413 });

  const categoria = String(form.get('categoria') || 'outro');
  if (!PATRO_CATEGORIAS.some((item) => item === categoria)) return NextResponse.json({ error: 'invalid_categoria' }, { status: 400 });

  const db = await getCloudflareAdminDb();
  if (!db) return NextResponse.json({ error: 'cloudflare_d1_not_configured' }, { status: 503 });

  try {
    const saved = await salvarArquivoPatrocinio(db, {
      nome: file.name.slice(0, 200) || 'arquivo',
      mime: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
      categoria: categoria as PatroCategoria,
      empresaId: String(form.get('empresa_id') || '') || null,
      contratoId: String(form.get('contrato_id') || '') || null,
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'upload_failed' }, { status: 500 });
  }
}
