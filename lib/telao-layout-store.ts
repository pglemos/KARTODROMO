import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_TELAO_LAYOUT, normalizeTelaoLayoutConfig, type TelaoLayoutConfig } from '@/lib/telao-layout-config';

const configPath = process.env.TELAO_LAYOUT_CONFIG_PATH || '.runtime/telao-layout.json';

let memoryConfig: TelaoLayoutConfig = DEFAULT_TELAO_LAYOUT;

export function readTelaoLayoutConfig(): TelaoLayoutConfig {
  try {
    if (!existsSync(configPath)) return memoryConfig;
    return normalizeTelaoLayoutConfig(JSON.parse(readFileSync(configPath, 'utf8')));
  } catch {
    return memoryConfig;
  }
}

export function writeTelaoLayoutConfig(input: unknown): TelaoLayoutConfig {
  const config = normalizeTelaoLayoutConfig(input);
  memoryConfig = config;

  try {
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  } catch {
    // On read-only/serverless hosts the in-memory config still works until the instance is recycled.
  }

  return config;
}
