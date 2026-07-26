import { NextRequest, NextResponse } from 'next/server';
import { fetchCalXProCorridaCompetidores } from '@/lib/livetime/calxpro-corridas';
import { getCalXProSqlOptions } from '@/lib/livetime/sql-env';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sqlOptions = getCalXProSqlOptions();
  if (!sqlOptions || !sqlOptions.user || !sqlOptions.password) {
    return NextResponse.json({ error: 'calxpro_sql_not_configured' }, { status: 503 });
  }

  const corridaId = request.nextUrl.searchParams.get('corridaId');
  if (!corridaId) {
    return NextResponse.json({ error: 'missing_corridaId' }, { status: 400 });
  }

  try {
    const rows = await fetchCalXProCorridaCompetidores(sqlOptions, corridaId);
    return NextResponse.json(rows, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'calxpro_sql_query_failed' },
      { status: 502 },
    );
  }
}
