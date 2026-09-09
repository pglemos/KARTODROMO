export const DEFAULT_ULTRAS_STAGE_ID = '72ee40f8-8574-48db-852e-fce19bfd4ee4';
export const DEFAULT_ULTRAS_SEASON_ID = '35ccbcaa-8912-4af3-85d9-e60dff6200d4';
export const ULTRAS_CATEGORY_SLUGS = ['insanos', 'rapidos'] as const;

export function configuredUltrasStageId(): string {
  return process.env.UDK_STAGE_ID || process.env.ULTRAS_STAGE_ID || DEFAULT_ULTRAS_STAGE_ID;
}
