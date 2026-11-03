import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { adminCookieName, readAdminSession } from '@/lib/admin-auth';
import { getCloudflareAdminDb } from '@/lib/cloudflare-admin-db';
import { lerArquivoPatrocinio, removerArquivoPatrocinio } from '@/lib/patrocinadores-arquivos';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function authorized() {
  const cookieStore = await cookies();
  return Boolean(readAdminSession(cookieStore.get(adminCookieName())?.value));
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorized())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = await getCloudflareAdminDb();
  if (!db) return NextResponse.json({ error: 'cloudflare_d1_not_configured' }, { status: 503 });

  const arquivo = await lerArquivoPatrocinio(db, (await params).id);
  if (!arquivo) return NextResponse.json({ error: 'record_not_found' }, { status: 404 });

  const baixar = request.nextUrl.searchParams.get('download') === '1';
  const nome = arquivo.meta.nome.replace(/["\r\n\\]/g, '_');
  return new NextResponse(new Uint8Array(arquivo.bytes), {
    headers: {
      'content-type': arquivo.meta.mime,
      'content-length': String(arquivo.bytes.byteLength),
      'content-disposition': `${baixar ? 'attachment' : 'inline'}; filename="${nome}"`,
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, max-age=300',
    },
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorized())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = await getCloudflareAdminDb();
  if (!db) return NextResponse.json({ error: 'cloudflare_d1_not_configured' }, { status: 503 });
  await removerArquivoPatrocinio(db, (await params).id);
  return NextResponse.json({ ok: true });
}
