import { Redirect } from 'expo-router';

/** Parceiros aguarda endpoint real; a rota não expõe dados fictícios. */
export default function ParceirosRoute() {
  return <Redirect href="/(tabs)" />;
}
