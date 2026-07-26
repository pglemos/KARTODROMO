import { NextRequest, NextResponse } from 'next/server';
import { fetchLapTimeBookingCustomers } from '@/lib/livetime/laptime-bookings';
import { getLaptimeSqlOptions } from '@/lib/livetime/sql-env';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sqlOptions = getLaptimeSqlOptions();
  if (!sqlOptions || !sqlOptions.user || !sqlOptions.password) {
    return NextResponse.json({ error: 'laptime_sql_not_configured' }, { status: 503 });
  }

  const bookingId = request.nextUrl.searchParams.get('bookingId');
  if (!bookingId) {
    return NextResponse.json({ error: 'bookingId_required' }, { status: 400 });
  }

  try {
    const rows = await fetchLapTimeBookingCustomers(sqlOptions, bookingId);
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
