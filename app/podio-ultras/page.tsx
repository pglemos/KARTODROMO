import type { Metadata } from 'next';
import { UltrasStageClient } from './UltrasStageClient';
import { configuredUltrasStageId } from '@/lib/udk-bridge/ultras-stage-config';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ultras · Resultado ao vivo | Kartódromo',
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PodioUltrasPage({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const stageId = firstParam(params.stage_id) || configuredUltrasStageId();
  return <UltrasStageClient stageId={stageId} />;
}
