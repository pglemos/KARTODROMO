import { demoOnly } from '../../config/features';
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CareerScreen } from '../../components/career-screen';
import { getDriverById, MOCK_DRIVERS } from '../../mock/kart-data';

function CarreiraTab() {
  const { driverId } = useLocalSearchParams<{ driverId?: string }>();
  const driver = (driverId ? getDriverById(driverId) : undefined) ?? MOCK_DRIVERS[0];

  return <CareerScreen driver={driver} />;
}

export default demoOnly(CarreiraTab);
