import { NextRequest, NextResponse } from 'next/server';
import { readTb50DisplayModeFromStore, tb50DisplayModeStoreStatus, writeTb50DisplayMode } from '@/lib/tb50-display-mode-store';
import { requireAdminPermission } from '@/lib/admin-api-guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
};

export async function GET() {
  const state = await readTb50DisplayModeFromStore();
  return NextResponse.json({ ...state, store: tb50DisplayModeStoreStatus() }, { headers: NO_CACHE_HEADERS });
}

export async function PUT(request: NextRequest) {
  const denied = await requireAdminPermission('telao', true, request);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const state = await writeTb50DisplayMode(body);
  return NextResponse.json({ ...state, store: tb50DisplayModeStoreStatus() }, { headers: NO_CACHE_HEADERS });
}
