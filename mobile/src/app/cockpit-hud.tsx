import { Redirect } from 'expo-router';

/** Rota antiga removida: o cockpit publicado é o componente ligado à cronometragem real. */
export default function CockpitHudLegacyRoute() {
  return <Redirect href="/cockpit" />;
}
