import { NextResponse } from 'next/server';
import { autorizarLeitura, lerRetrato, SEM_CACHE } from '@/lib/timing/transmissao-nuvem';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Retrato ao vivo da bateria para o parceiro de transmissão. Documentação: docs/api-transmissao.md */
export async function GET(request: Request) {
  if (!process.env.TRANSMISSAO_CHAVES_SHA256) {
    return NextResponse.json({ erro: 'API de transmissão ainda não configurada.' }, { status: 503, headers: SEM_CACHE });
  }
  if (!(await autorizarLeitura(request))) {
    return NextResponse.json(
      { erro: 'Chave ausente ou inválida. Envie no cabeçalho Authorization: Bearer <chave>.' },
      { status: 401, headers: { ...SEM_CACHE, 'WWW-Authenticate': 'Bearer' } },
    );
  }
  try {
    const retrato = await lerRetrato();
    if (!retrato) {
      return NextResponse.json(
        { versao: 1, atualizadoEm: new Date().toISOString(), situacao: 'sem-bateria', sinal: 'sem-sinal', bateria: null, melhorVolta: null, pilotos: [] },
        { headers: SEM_CACHE },
      );
    }
    return NextResponse.json(retrato, { headers: SEM_CACHE });
  } catch {
    return NextResponse.json({ erro: 'Não foi possível ler os dados da corrida agora. Tente de novo em 1 s.' }, { status: 502, headers: SEM_CACHE });
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: SEM_CACHE });
}
