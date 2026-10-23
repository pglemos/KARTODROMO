import { DEMO_MODE } from '../../config/features';
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CareerScreen } from '../../components/career-screen';
import CarreiraPilotoTela from '../../components/carreira-piloto';
import { getDriverById, MOCK_DRIVERS } from '../../mock/kart-data';

function CarreiraDemo() {
  const { driverId } = useLocalSearchParams<{ driverId?: string }>();
  const driver = (driverId ? getDriverById(driverId) : undefined) ?? MOCK_DRIVERS[0];

  return <CareerScreen driver={driver} />;
}

/** aba Carreira: na loja é a carreira real do piloto logado (resultados ficam num botão dentro dela) */
function CarreiraReal() {
  return <CarreiraPilotoTela id="eu" aba />;
}

export default DEMO_MODE ? CarreiraDemo : CarreiraReal;
