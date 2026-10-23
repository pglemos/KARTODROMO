import { useLocalSearchParams } from 'expo-router';

import CockpitReal from '../components/cockpit-real';

/** cockpit do piloto na bateria ao vivo (app de loja); ?kart=12 abre já no kart escolhido no Ao vivo */
export default function CockpitRota() {
  const { kart } = useLocalSearchParams<{ kart?: string }>();
  return <CockpitReal kartInicial={typeof kart === 'string' && kart ? kart : null} />;
}
