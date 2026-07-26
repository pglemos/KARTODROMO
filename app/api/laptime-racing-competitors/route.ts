import { NextRequest, NextResponse } from 'next/server';
import { fetchLapTimeRacingCompetitors } from '@/lib/livetime/laptime-racings';
import { getLaptimeSqlOptions } from '@/lib/livetime/sql-env';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sqlOptions = getLaptimeSqlOptions();
  if (!sqlOptions || !sqlOptions.user || !sqlOptions.password) {
    return NextResponse.json({ error: 'laptime_sql_not_configured' }, { status: 503 });
  }

  const racingId = request.nextUrl.searchParams.get('racingId');
  if (!racingId) {
    return NextResponse.json({ error: 'racingId_required' }, { status: 400 });
  }

  try {
    const rows = await fetchLapTimeRacingCompetitors(sqlOptions, racingId);
    return NextResponse.json(rows, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'laptime_sql_query_failed' },
      { status: 502 },
    );
  }
}
