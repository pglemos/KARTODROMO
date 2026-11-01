import { Redirect } from 'expo-router';

/** Notícias demonstrativas não são publicadas sem endpoint real. */
export default function NoticiaLegacyRoute() {
  return <Redirect href="/(tabs)" />;
}
