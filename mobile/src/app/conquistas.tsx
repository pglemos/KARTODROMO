import { Redirect } from 'expo-router';

/** Rota antiga removida: conquistas da conta vivem em /minhas-conquistas. */
export default function ConquistasLegacyRoute() {
  return <Redirect href="/minhas-conquistas" />;
}
