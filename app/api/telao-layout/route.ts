import { NextRequest, NextResponse } from 'next/server';
import { readTelaoLayoutConfig, writeTelaoLayoutConfig } from '@/lib/telao-layout-store';
import { TELAO_LAYOUT_PRESETS } from '@/lib/telao-layout-config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
};

export async function GET() {
  return NextResponse.json(
    {
      layout: readTelaoLayoutConfig(),
      presets: TELAO_LAYOUT_PRESETS,
    },
    { headers: NO_CACHE_HEADERS },
  );
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const layout = writeTelaoLayoutConfig(body);

  return NextResponse.json({ layout }, { headers: NO_CACHE_HEADERS });
}
