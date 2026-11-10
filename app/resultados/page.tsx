import type { Metadata } from 'next';
import { ResultadosClient } from './ResultadosClient';

export const metadata: Metadata = {
  title: 'Resultados Oficiais & Volta a Volta | Kartódromo Internacional de Betim',
  description: 'Consulte a classificação oficial, tempos e telemetria volta a volta em PDF da sua bateria de kart via QR Code.',
  openGraph: {
    title: 'Resultados Oficiais · Kartódromo de Betim',
    description: 'Classificação oficial e telemetria volta a volta em PDF direto da cronometragem MYLAPS TranX.',
    siteName: 'Kartódromo Internacional de Betim',
    locale: 'pt_BR',
    type: 'website',
  },
};

export default function ResultadosPage() {
  return <ResultadosClient />;
}
