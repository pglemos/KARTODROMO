import { NextRequest, NextResponse } from 'next/server';
import { fetchCalXProCreditosPage } from '@/lib/livetime/calxpro-receitas';
import { getCalXProSqlOptions } from '@/lib/livetime/sql-env';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sqlOptions = getCalXProSqlOptions();
  if (!sqlOptions || !sqlOptions.user || !sqlOptions.password) {
    return NextResponse.json({ error: 'calxpro_sql_not_configured' }, { status: 503 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const { rows, total } = await fetchCalXProCreditosPage(sqlOptions, {
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
      { error: error instanceof Error ? error.message : 'calxpro_sql_query_failed' },
      { status: 502 },
    );
  }
}
