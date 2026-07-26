import { NextRequest, NextResponse } from 'next/server';
import {
  readTelaoPlaylistFromRemote,
  telaoPlaylistStoreStatus,
  writeTelaoPlaylistRemote,
} from '@/lib/telao-playlist-store';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
};

export async function GET() {
  const endpoint = process.env.TELAO_PLAYLIST_REMOTE_ENDPOINT || process.env.TELAO_LAYOUT_REMOTE_ENDPOINT;

  return NextResponse.json(
    {
      playlist: await readTelaoPlaylistFromRemote(),
      store: {
        ...telaoPlaylistStoreStatus(),
        ...(endpoint ? { storage: 'remote', persistent: true } : {}),
      },
    },
    { headers: NO_CACHE_HEADERS },
  );
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const items = Array.isArray(body) ? body : body?.items;
  const result = await writeTelaoPlaylistRemote({ items });

  return NextResponse.json(
    { playlist: result, store: telaoPlaylistStoreStatus() },
    { headers: NO_CACHE_HEADERS },
  );
}
