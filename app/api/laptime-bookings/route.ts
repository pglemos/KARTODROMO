import { NextRequest, NextResponse } from 'next/server';
import { fetchLapTimeBookingsPage } from '@/lib/livetime/laptime-bookings';
import { getLaptimeSqlOptions } from '@/lib/livetime/sql-env';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sqlOptions = getLaptimeSqlOptions();
  if (!sqlOptions || !sqlOptions.user || !sqlOptions.password) {
    return NextResponse.json({ error: 'laptime_sql_not_configured' }, { status: 503 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const { rows, total } = await fetchLapTimeBookingsPage(sqlOptions, {
      q: searchParams.get('q') || undefined,
      status: status === 'aberta' || status === 'encerrada' ? status : undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined,
    });

    return NextResponse.json(rows, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'x-total-count': String(total),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'laptime_sql_query_failed' },
      { status: 502 },
    );
  }
}
