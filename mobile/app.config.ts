import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const easProjectId = process.env.EAS_PROJECT_ID?.trim();
  return {
    ...config,
    name: config.name ?? 'Kartódromo de Betim',
    slug: config.slug ?? 'kartodromo-betim',
    extra: {
      ...config.extra,
      ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
    },
  };
};
