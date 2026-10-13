import { NextResponse } from 'next/server';
import { autorizarPublicacao, guardarRetrato, TAMANHO_MAXIMO, validarRetrato } from '@/lib/timing/transmissao-nuvem';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SEM_CACHE = { 'Cache-Control': 'no-store' };

/** Só o servidor da cronometragem (ORBITS) publica aqui, com a chave de publicação (diferente da chave do parceiro). */
export async function POST(request: Request) {
  if (!process.env.TRANSMISSAO_PUBLICACAO_SHA256) return NextResponse.json({ erro: 'Publicação não configurada.' }, { status: 503, headers: SEM_CACHE });
  if (!(await autorizarPublicacao(request))) return NextResponse.json({ erro: 'Chave de publicação inválida.' }, { status: 401, headers: SEM_CACHE });
  const tamanho = Number(request.headers.get('content-length') ?? 0);
  if (tamanho > TAMANHO_MAXIMO) return NextResponse.json({ erro: 'Retrato grande demais.' }, { status: 413, headers: SEM_CACHE });
  const texto = await request.text();
  if (texto.length > TAMANHO_MAXIMO) return NextResponse.json({ erro: 'Retrato grande demais.' }, { status: 413, headers: SEM_CACHE });
  let corpo: unknown;
  try { corpo = JSON.parse(texto); } catch { return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400, headers: SEM_CACHE }); }
  const retrato = validarRetrato(corpo);
  if (!retrato) return NextResponse.json({ erro: 'Formato inesperado (versão 1).' }, { status: 400, headers: SEM_CACHE });
  try {
    await guardarRetrato(retrato);
  } catch {
    return NextResponse.json({ erro: 'Não foi possível guardar o retrato.' }, { status: 502, headers: SEM_CACHE });
  }
  return NextResponse.json({ ok: true }, { headers: SEM_CACHE });
}
