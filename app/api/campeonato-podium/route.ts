import { NextRequest, NextResponse } from 'next/server';
import { apiGet } from '@/src/admin/lib/api-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
};

export async function GET(request: NextRequest) {
  const campeonatoId = request.nextUrl.searchParams.get('campeonato_id');

  if (!campeonatoId) {
    return NextResponse.json(
      { error: 'campeonato_id é obrigatório' },
      { status: 400, headers: NO_CACHE_HEADERS },
    );
  }

  try {
    const classificacao = await apiGet<{
      id: string;
      campeonato_id: string | null;
      piloto_id: string | null;
      pontos: number;
      posicao: number | null;
      piloto_nome: string | null;
      piloto_numero: string | null;
      piloto_equipe: string | null;
    }[]>(`classificacao_full?campeonato_id=${encodeURIComponent(campeonatoId)}`);

    const campeonato = await apiGet<{
      id: string;
      nome: string;
      slug: string | null;
      temporada: string | null;
      status: string;
    }>(`campeonatos/${campeonatoId}`);

    const drivers = classificacao
      .filter((row) => row.posicao !== null && row.posicao > 0)
      .sort((a, b) => (a.posicao ?? 999) - (b.posicao ?? 999))
      .map((row) => ({
        position: row.posicao,
        name: row.piloto_nome || 'Piloto removido',
        number: row.piloto_numero || '',
        team: row.piloto_equipe || 'Sem equipe',
        points: row.pontos,
        kart: row.piloto_numero || '',
      }));

    return NextResponse.json(
      {
        campeonato: {
          id: campeonato.id,
          nome: campeonato.nome,
          slug: campeonato.slug,
          temporada: campeonato.temporada,
          status: campeonato.status,
        },
        drivers,
        updatedAt: new Date().toISOString(),
      },
      { headers: NO_CACHE_HEADERS },
    );
  } catch (error) {
    console.error('Error fetching campeonato podium:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar pódio do campeonato' },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }
}