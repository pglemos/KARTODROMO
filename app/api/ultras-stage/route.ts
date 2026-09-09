import { NextRequest, NextResponse } from 'next/server';
import { fetchPublicStageSnapshot, StageSnapshotReadError } from '@/lib/udk-bridge/live-stage-public';
import { configuredUltrasStageId } from '@/lib/udk-bridge/ultras-stage-config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
  'Access-Control-Allow-Origin': '*',
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: NextRequest) {
  const stageId = request.nextUrl.searchParams.get('stage_id') || configuredUltrasStageId();
  if (!isUuid(stageId)) {
    return NextResponse.json(
      { error: 'invalid_stage_id', message: 'Identificador de etapa inválido.' },
      { status: 400, headers: NO_CACHE_HEADERS },
    );
  }

  try {
    const snapshot = await fetchPublicStageSnapshot(stageId);
    return NextResponse.json(snapshot, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    if (error instanceof StageSnapshotReadError) {
      return NextResponse.json(
        { error: error.code, message: error.message, stageId },
        { status: error.status, headers: NO_CACHE_HEADERS },
      );
    }

    return NextResponse.json(
      { error: 'public_snapshot_failed', message: 'Não foi possível carregar a etapa Ultras.', stageId },
      { status: 502, headers: NO_CACHE_HEADERS },
    );
  }
}
