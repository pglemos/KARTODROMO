import type { Metadata } from 'next';
import { PodioCampeonatoClient } from './PodioCampeonatoClient';

export const metadata: Metadata = {
  title: 'Pódio do Campeonato | Kartódromo',
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PodioCampeonatoTb50Page({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const campeonatoId = firstParam(params.campeonato_id);
  const demo = firstParam(params.demo) === 'true';

  if (!campeonatoId && !demo) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#000', color: '#fff', fontFamily: 'monospace' }}>
        <div>Parâmetro campeonato_id é obrigatório</div>
      </div>
    );
  }

  return <PodioCampeonatoClient campeonatoId={campeonatoId || ''} demo={demo} />;
}