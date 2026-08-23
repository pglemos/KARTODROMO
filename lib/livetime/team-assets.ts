import type { LiveTimingDriver } from '@/lib/livetime/types';

export type TeamAsset = {
  key: string;
  label: string;
  aliases: string[];
  imageBase: string;
};

const TEAM_ASSETS: TeamAsset[] = [
  { key: 'gorillas', label: 'GORILLAS TEAM RACING', aliases: ['GORILLAS TEAM RACING', 'GORILLAS TEAM', 'GORILLAS'], imageBase: 'GORILLAS_TEAM' },
  { key: 'apex-firepit', label: 'FIREPIT / APEX', aliases: ['FIREPIT APEX', 'APEX FIREPIT', 'FIREPIT'], imageBase: 'APEX_FIREPIT' },
  { key: 'xzero27', label: 'ZERO27 / ÁGUIA', aliases: ['ZERO27 AGUIA', 'ZERO 27 AGUIA', 'ZERO27 AGUI', 'ZERO 27 AGUI'], imageBase: 'XZERO27' },
  { key: 'esquadrao', label: 'ESQUADRÃO DO KART', aliases: ['ESQUADRAO DO KART', 'ESQUADRAO KART'], imageBase: 'ESQUADRAO_DO_KART' },
  { key: 'f1-mvb', label: 'F1 MKB', aliases: ['F1 MKB', 'F1 MVB'], imageBase: 'F1_MVB' },
  { key: 'minas', label: 'MINAS RACING', aliases: ['MINAS RACING', 'MR MINAS RACING'], imageBase: 'MR_MINAS_RACING' },
  { key: 'rk-mineiro', label: 'RK MINEIRO', aliases: ['RK MINEIRO', 'RK'], imageBase: 'RK_MINEIRO' },
  { key: 'madruga', label: 'MADRUGA RACE TEAM', aliases: ['MADRUGA RACE TEAM', 'MADRUGA RACING', 'MADRUGA'], imageBase: 'MADRUGA_RACING' },
  { key: 'kts', label: 'KTS', aliases: ['KTS'], imageBase: 'KTS' },
  { key: 'chevette', label: 'CHEVETTE RACING', aliases: ['CHEVETTE RACING', 'CHEVETTE'], imageBase: 'CHEVETTE_RACING' },
];

const TEAM_SHORT_PREFIXES: Record<string, string> = {
  gorillas: 'GT',
  'apex-firepit': 'FA',
  xzero27: 'ZE',
  esquadrao: 'ED',
  'f1-mvb': 'FM',
  minas: 'MR',
  'rk-mineiro': 'RK',
  madruga: 'MR',
  kts: 'KTS',
  chevette: 'CR',
};

function normalize(value: string | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' E ')
    .replace(/[^A-Z0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function withoutKartSuffix(value: string): string {
  return value.replace(/\s+\d{1,3}$/, '').trim();
}

function matchesAlias(value: string, alias: string): boolean {
  return value === alias || value.startsWith(`${alias} `) || value.includes(` ${alias} `);
}

export function resolveTeamAsset(team: string | undefined, fallbackName?: string): TeamAsset | null {
  const candidates = [team, fallbackName].map(normalize).filter(Boolean).map(withoutKartSuffix);

  for (const candidate of candidates) {
    const match = TEAM_ASSETS.find((asset) => asset.aliases.some((alias) => matchesAlias(candidate, normalize(alias))));
    if (match) return match;
  }

  return null;
}

export function teamAssetSrc(asset: TeamAsset, rank: number): string {
  const safeRank = Math.min(Math.max(Math.trunc(rank), 1), 3);
  return `/tb50/teams/${asset.imageBase}_P${safeRank}.png`;
}

function trailingTeamNumber(...values: Array<string | undefined>): string {
  for (const value of values) {
    const match = normalize(value).match(/(?:^|\s)(\d{1,3})$/);
    if (match) return match[1];
  }

  return '';
}

/**
 * LapTime may return either the compact entry code (FA1) or the full team
 * entry name (FIREPIT/ APEX 1). Keep the compact code on the LED card while
 * using the full name to resolve the supplied P1/P2/P3 artwork.
 */
export function teamCodeForDriver(driver: Pick<LiveTimingDriver, 'team' | 'name'>): string {
  const name = String(driver.name || '').trim();
  if (!name) return 'AGUARDANDO EQUIPE';

  const compactName = normalize(name).replace(/\s+/g, '');
  if (/^[A-Z]{2,5}\d{1,3}$/.test(compactName)) return compactName;

  const asset = resolveTeamAsset(driver.team, name);
  const prefix = asset ? TEAM_SHORT_PREFIXES[asset.key] : undefined;
  const number = trailingTeamNumber(driver.team, name);
  return prefix && number ? `${prefix}${number}` : name;
}

export function teamLabelForDriver(driver: Pick<LiveTimingDriver, 'team' | 'name'>): string {
  return resolveTeamAsset(driver.team, driver.name)?.label || driver.team || driver.name || 'Equipe não identificada';
}

export { TEAM_ASSETS };
