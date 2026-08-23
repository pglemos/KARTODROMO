// Configuração do UDK Bridge a partir de variáveis de ambiente.
import type { UdkBridgeConfig } from '@/lib/udk-bridge/types';

export type BridgeEnv = {
  udkSupabaseUrl: string;
  udkServiceRoleKey: string;
  championshipId: string;
  seasonId: string;
  categoryMapping: Record<number, string>;
  stages: UdkBridgeConfig['stages'];
  sqlSource: {
    server: string;
    database: string;
    user: string;
    password: string;
    instanceName?: string;
    timeoutMs?: number;
  };
  pollIntervalMs: number;
  allowTextOnly: boolean;
  nameMatchMinScore: number;
};

export function loadBridgeConfig(env: NodeJS.ProcessEnv = process.env): BridgeEnv {
  const championshipId = env.UDK_CHAMPIONSHIP_ID || '0db6c7bd-5595-486e-a2f7-6273cbebb902';
  const seasonId = env.UDK_SEASON_ID || '35ccbcaa-8912-4af3-85d9-e60dff6200d4';

  // Mapeamento de categorias LapTime (Id_Category) → UUIDs de categorias UDK.
  // Formato env: "1:uuid-1,2:uuid-2". Padrão: sem mapeamento (resultado por sessão).
  const categoryMapping: Record<number, string> = {};
  for (const pair of (env.UDK_CATEGORY_MAPPING || '').split(',').filter(Boolean)) {
    const [from, to] = pair.split(':');
    if (from && to) categoryMapping[Number(from)] = to;
  }

  // Etapas UDK: JSON [{ stageId, sessionId, name, kind }].
  const stagesRaw = env.UDK_STAGES;
  const stages: UdkBridgeConfig['stages'] = stagesRaw
    ? (JSON.parse(stagesRaw) as UdkBridgeConfig['stages'])
    : {
        // Endurance 2026 (18/08) — sessão "Endurance 1h".
        'e9a030a9-7ff5-41a9-aa76-7b733b82f5c6': [
          { sessionId: 'e85234a2-bb56-4b23-8914-4b85c7a08028', name: 'Endurance 1h', kind: 'endurance' },
        ],
        // Etapas regulares — "Corrida 1 - Horário" / "Corrida 2 - Anti-horário".
        '72ee40f8-8574-48db-852e-fce19bfd4ee4': [
          { sessionId: 'ecd8f003-8417-4c6c-95f8-b47b26a9d830', name: 'Corrida 1 - Horário', kind: 'race' },
          { sessionId: 'fcab6da9-54b0-456b-87fa-c3de1ce8a02f', name: 'Corrida 2 - Anti-horário', kind: 'race' },
        ],
        'b3cd8002-fe0f-477d-96d2-995538803dda': [
          { sessionId: '2675425b-13db-46f2-b7bf-18f78692714f', name: 'Corrida 1 - Horário', kind: 'race' },
          { sessionId: '56d0d8e5-8bf2-4d44-9633-92d4854e0a95', name: 'Corrida 2 - Anti-horário', kind: 'race' },
        ],
        '53479fe1-4444-4eff-b40d-88f8bb062512': [
          { sessionId: 'ec9fe1b9-73b1-47c1-9a41-d27363d901e4', name: 'Corrida 1 - Horário', kind: 'race' },
          { sessionId: 'd0c15fae-3ac7-49f2-a355-3a70a77a7016', name: 'Corrida 2 - Anti-horário', kind: 'race' },
        ],
        '96daf601-07e8-44e2-a5dc-fa1312a47fdc': [
          { sessionId: 'b1ee3499-2bde-4d5e-a7ae-dcd5325cf2f3', name: 'Endurance 1h', kind: 'endurance' },
        ],
      };

  return {
    udkSupabaseUrl: env.UDK_SUPABASE_URL || '',
    udkServiceRoleKey: env.UDK_SERVICE_ROLE_KEY || '',
    championshipId,
    seasonId,
    categoryMapping,
    stages,
    sqlSource: {
      server: env.BRIDGE_SQL_SERVER || env.LAPTIME_SQL_SERVER || 'localhost',
      database: env.BRIDGE_SQL_DATABASE || env.LAPTIME_SQL_DATABASE || 'LapTimeMirror',
      user: env.BRIDGE_SQL_USER || env.LAPTIME_SQL_USER || 'LapTimeMirrorSql',
      password: env.BRIDGE_SQL_PASSWORD || env.LAPTIME_SQL_PASSWORD || '',
      instanceName: env.BRIDGE_SQL_INSTANCE || env.LAPTIME_SQL_INSTANCE || undefined,
      timeoutMs: Number(env.LAPTIME_SQL_TIMEOUT_MS || 5000),
    },
    pollIntervalMs: Number(env.UDK_BRIDGE_POLL_MS || 15000),
    allowTextOnly: env.UDK_ALLOW_TEXT_ONLY === 'true',
    nameMatchMinScore: Number(env.UDK_NAME_MATCH_MIN_SCORE || 0.8),
  };
}