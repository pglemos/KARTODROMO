import { useLocalSearchParams } from 'expo-router';

import CarreiraPilotoTela from '../../components/carreira-piloto';

/** /piloto/123 = carreira de um piloto do ranking; /piloto/eu = a sua (conta ligada ao cadastro) */
export default function PilotoRota() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CarreiraPilotoTela id={String(id ?? '')} />;
}
