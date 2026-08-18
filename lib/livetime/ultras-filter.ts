// Filtro exclusivo do campeonato ULTRAS / UDK no sistema LapTime.
//
// Regra de ouro: NENHUMA corrida fora do campeonato ULTRAS pode ser importada
// para o UDK. O filtro é conservador:
//   1. Whitelist explícita de Id_RacingGroup (IDs estruturados, nunca texto);
//   2. Fallback textual ("ULTRAS"/"UDK") nos nomes do grupo/evento/corrida,
//      tratado como CANDIDATO: só importa se também passar por auditoria.
// A lista de grupos pode ser ampliada por variável de ambiente, nunca removida.

export type UltrasRacingCandidate = {
  id: number;
  racingGroupId?: number;
  racingEventId?: number;
  racingTypeId?: number;
  state?: number;
  name?: string;
  groupName?: string;
  eventName?: string;
};

export type UltrasFilterOptions = {
  // Id_RacingGroup considerados ULTRAS. Os valores padrão são os grupos
  // conhecidos do campeonato ULTRAS no LapTime do Kartódromo de Betim.
  knownGroupIds?: number[];
  // Padrões textuais de nome (normalizados, minúsculos). Por segurança o
  // padrão "ultras" é SEMPRE incluído e não pode ser removido.
  namePatterns?: string[];
  // Quando true, corridas que casam apenas por texto são aceitas sem auditoria
  // adicional. O padrão é false (conservador).
  allowTextOnly?: boolean;
};

export const DEFAULT_ULTRAS_GROUP_IDS = [
  180236, // ULTRAS 1
  180237, // ULTRAS 2
  190252, // TREINO ULTRAS
  220296, // ULTRAS I - FINAL
  220297, // ULTRAS II - FINAL
];

// "ultra" cobre "ULTRAS", "ULTRÁS", "ULTRA FINAL" etc. "udk" é a sigla oficial.
const MANDATORY_PATTERNS = ['ultra', 'udk'];

function normalize(text: string | undefined | null): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export type UltrasMatch =
  | { kind: 'id'; reason: string }
  | { kind: 'text'; reason: string }
  | { kind: 'none'; reason: string };

export function matchUltrasRacing(racing: UltrasRacingCandidate, options: UltrasFilterOptions = {}): UltrasMatch {
  const knownGroups = options.knownGroupIds ?? DEFAULT_ULTRAS_GROUP_IDS;
  const patterns = Array.from(
    new Set([...MANDATORY_PATTERNS, ...(options.namePatterns || []).map(normalize).filter(Boolean)]),
  );

  if (racing.racingGroupId != null && knownGroups.includes(Number(racing.racingGroupId))) {
    return { kind: 'id', reason: `grupo ${racing.racingGroupId} na whitelist` };
  }

  const haystack = normalize([racing.groupName, racing.eventName, racing.name].join(' '));
  if (haystack) {
    const matched = patterns.find((pattern) => haystack.includes(pattern));
    if (matched) {
      return {
        kind: 'text',
        reason: `nome contém "${matched}" (grupo=${racing.groupName || '-'}, evento=${racing.eventName || '-'})`,
      };
    }
  }

  return { kind: 'none', reason: 'sem vínculo com ULTRAS/UDK' };
}

export function isUltrasRacing(racing: UltrasRacingCandidate, options: UltrasFilterOptions = {}): boolean {
  const match = matchUltrasRacing(racing, options);
  if (match.kind === 'id') return true;
  if (match.kind === 'text') return Boolean(options.allowTextOnly ?? false);
  return false;
}

// Lista os grupos whitelist + padrões vigentes para logs/auditoria.
export function ultrasFilterSummary(options: UltrasFilterOptions = {}): string {
  const knownGroups = options.knownGroupIds ?? DEFAULT_ULTRAS_GROUP_IDS;
  const patterns = Array.from(
    new Set([...MANDATORY_PATTERNS, ...(options.namePatterns || []).map(normalize).filter(Boolean)]),
  );
  return `grupos=[${knownGroups.join(', ')}] padrões=[${patterns.join(', ')}]`;
}