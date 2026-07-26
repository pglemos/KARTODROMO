import { NextRequest, NextResponse } from 'next/server';
import { readTb50PageFromRemote, tb50PageStoreStatus, writeTb50PageRemote } from '@/lib/tb50-page-store';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
};

export async function GET() {
  const state = await readTb50PageFromRemote();
  return NextResponse.json({ ...state, store: tb50PageStoreStatus() }, { headers: NO_CACHE_HEADERS });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const state = await writeTb50PageRemote(body?.offset);
  return NextResponse.json({ ...state, store: tb50PageStoreStatus() }, { headers: NO_CACHE_HEADERS });
}
