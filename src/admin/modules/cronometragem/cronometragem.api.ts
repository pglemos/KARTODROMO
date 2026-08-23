import { apiDelete, apiGet, apiGetPage, apiPatch, apiPost, apiPut, type Page } from '../../lib/api-client';
import type {
  CampeonatoOption,
  EtapaOption,
  LivePiloto,
  LivePitStop,
  LivePitStopStatus,
  LivePitSummary,
  LiveRaceInfo,
  LiveSnapshot,
  PilotoOption,
  Sessao,
  SessaoPayload,
  SessaoStatus,
  SessaoTipo,
  SessaoUpdate,
  SessaoWithCampeonato,
  Volta,
  VoltaPayload,
  VoltaUpdate,
} from './cronometragem.types';
import { msParaTexto } from './cronometragem.types';

export const DEFAULT_LIVE_URL = '/api/livetime-snapshot';

const POINTS_BY_POSITION = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const firstValue = (record: Record<string, unknown>, keys: readonly string[]): unknown => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
};

const toText = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
};

const toInteger = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(',', '.'));
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return undefined;
};

const tempoTextoParaMs = (value: string): number | undefined => {
  const normalized = value.trim().replace(',', '.').replace(/^\+/, '');
  const parts = normalized.split(':');
  if (parts.length > 2) return undefined;

  const secondsPart = Number(parts[parts.length - 1]);
  const minutesPart = parts.length === 2 ? Number(parts[0]) : 0;
  if (!Number.isFinite(secondsPart) || !Number.isFinite(minutesPart)) return undefined;

  const milliseconds = (minutesPart * 60 + secondsPart) * 1_000;
  return milliseconds >= 0 ? Math.round(milliseconds) : undefined;
};

const toMilliseconds = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.round(value < 1_000 ? value * 1_000 : value);
  }
  if (typeof value === 'string' && value.trim()) return tempoTextoParaMs(value);
  return undefined;
};

const pitStopStatuses: readonly LivePitStopStatus[] = [
  'mandatory',
  'additional',
  'short',
  'invalid',
  'outside-window',
];

const normalizePitStop = (value: unknown, index: number): LivePitStop | null => {
  if (!isRecord(value)) return null;
  const rawStatus = toText(firstValue(value, ['status', 'situacao'])) as LivePitStopStatus | undefined;
  const status = rawStatus && pitStopStatuses.includes(rawStatus) ? rawStatus : 'invalid';
  const id = toText(firstValue(value, ['id', 'idPassing', 'id_passing'])) ?? `parada-${index + 1}`;

  return {
    id,
    volta: toInteger(firstValue(value, ['lap', 'volta'] )) ?? null,
    tempoParada: toText(firstValue(value, ['stopTime', 'tempoParada', 'tempo_parada'])) ?? null,
    tempoCorrida: toText(firstValue(value, ['raceTime', 'tempoCorrida', 'tempo_corrida'])) ?? null,
    posicao: toInteger(firstValue(value, ['position', 'posicao', 'pos'])) ?? null,
    status,
    ...(toInteger(firstValue(value, ['mandatoryNumber', 'numeroObrigatoria', 'numero_obrigatoria'])) !== undefined
      ? { numeroObrigatoria: toInteger(firstValue(value, ['mandatoryNumber', 'numeroObrigatoria', 'numero_obrigatoria'])) }
      : {}),
  };
};

const normalizePitSummary = (value: unknown): LivePitSummary | undefined => {
  if (!isRecord(value)) return undefined;
  const stopsValue = firstValue(value, ['stops', 'paradas']);
  const paradas = Array.isArray(stopsValue)
    ? stopsValue.map(normalizePitStop).filter((stop): stop is LivePitStop => stop !== null)
    : [];
  const necessarias = toInteger(firstValue(value, ['required', 'necessarias', 'paradasObrigatorias'])) ?? 11;

  return {
    necessarias: Math.max(0, necessarias),
    minimoMs: Math.max(0, toInteger(firstValue(value, ['minimumStopMs', 'minimoMs', 'minimoParadaMs'])) ?? 420_000),
    voltaAtual: toInteger(firstValue(value, ['currentLap', 'voltaAtual', 'volta_atual'])) ?? null,
    tempoTotal: toText(firstValue(value, ['currentRaceTime', 'tempoTotal', 'tempo_total'])) ?? null,
    tempoTotalMs: toInteger(firstValue(value, ['currentRaceTimeMs', 'tempoTotalMs', 'tempo_total_ms'])) ?? null,
    validas: Math.max(0, toInteger(firstValue(value, ['mandatory', 'validas', 'paradasValidas'])) ?? 0),
    faltam: Math.max(0, toInteger(firstValue(value, ['remaining', 'faltam', 'faltamObrigatorias'])) ?? 0),
    curtas: Math.max(0, toInteger(firstValue(value, ['short', 'curtas', 'paradasCurtas'])) ?? 0),
    total: Math.max(0, toInteger(firstValue(value, ['total', 'totalStops', 'totalParadas'])) ?? 0),
    adicionais: Math.max(0, toInteger(firstValue(value, ['additional', 'adicionais', 'paradasAdicionais'])) ?? 0),
    excedentes: Math.max(0, toInteger(firstValue(value, ['excess', 'excedentes', 'paradasExcedentes'])) ?? 0),
    penalidadeVoltas: Math.max(0, toInteger(firstValue(value, ['penaltyLaps', 'penalidadeVoltas', 'penalidade_voltas'])) ?? 0),
    foraJanela: Math.max(0, toInteger(firstValue(value, ['outsideWindow', 'foraJanela', 'fora_janela'])) ?? 0),
    paradas,
  };
};

const normalizeLiveRace = (payload: unknown): LiveRaceInfo | undefined => {
  if (!isRecord(payload)) return undefined;
  const value = firstValue(payload, ['race', 'corrida', 'currentRace']);
  if (!isRecord(value)) return undefined;

  const id = toText(firstValue(value, ['id', 'raceId', 'idRacing']));
  const nome = toText(firstValue(value, ['name', 'nome', 'eventName']));
  if (!id && !nome) return undefined;

  const rulesValue = firstValue(value, ['rules', 'regras']);
  const rules = isRecord(rulesValue) ? rulesValue : {};
  const ruleInteger = (keys: readonly string[], fallback: number) =>
    Math.max(0, toInteger(firstValue(rules, keys)) ?? fallback);

  return {
    id: id ?? '',
    nome: nome ?? 'Sessão ao vivo',
    tipo: toText(firstValue(value, ['type', 'tipo'])) ?? null,
    inicio: toText(firstValue(value, ['startedAt', 'inicio', 'startDateTime'])) ?? null,
    regras: {
      paradasObrigatorias: ruleInteger(['requiredStops', 'paradasObrigatorias'], 11),
      minimoParadaMs: ruleInteger(['minimumStopMs', 'minimoParadaMs'], 420_000),
      paradasAdicionaisPermitidas: ruleInteger(['additionalStopsAllowed', 'paradasAdicionaisPermitidas'], 4),
      minimoRegistroMs: ruleInteger(['candidateStopMinMs', 'minimoRegistroMs'], 240_000),
      voltasPenalidadePorParada: ruleInteger(['penaltyLapsPerStop', 'voltasPenalidadePorParada'], 7),
      boxesAbremAposMs: ruleInteger(['boxOpenAfterMs', 'boxesAbremAposMs'], 600_000),
      boxesFechamAposMs: ruleInteger(['boxCloseAfterMs', 'boxesFechamAposMs'], 42 * 60 * 60_000),
    },
  };
};

const findPilotoArray = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];

  const candidates = [
    payload.pilotos,
    payload.drivers,
    payload.competitors,
    payload.results,
    payload.classification,
    payload.ranking,
    payload.data,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (isRecord(candidate)) {
      const nested = findPilotoArray(candidate);
      if (nested.length) return nested;
    }
  }
  return [];
};

const normalizeLivePiloto = (value: unknown, index: number): LivePiloto | null => {
  if (!isRecord(value)) return null;

  const nome = toText(firstValue(value, ['nome', 'name', 'driver', 'piloto', 'competitor']));
  if (!nome) return null;

  const melhorRaw = firstValue(value, [
    'melhorVolta',
    'bestLap',
    'melhor_volta',
    'best_lap',
    'bestTime',
    'time',
  ]);
  const melhorVoltaMs = toMilliseconds(melhorRaw);
  const melhorVoltaTexto = toText(melhorRaw);
  const posicao = toInteger(firstValue(value, ['posicao', 'pos', 'position', 'place'])) ?? index + 1;
  const kart = toText(firstValue(value, ['kart', 'kartNumber', 'kart_number', 'numero', 'number']));
  const ultimaVolta = toText(
    firstValue(value, ['ultimaVolta', 'lastLap', 'ultima_volta', 'last_lap']),
  );
  const voltas = toInteger(firstValue(value, ['voltas', 'laps', 'lapCount', 'lap_count']));
  const gap = toText(firstValue(value, ['gap', 'interval', 'diferenca', 'difference']));
  const paradas = normalizePitSummary(firstValue(value, ['pitStops', 'paradas', 'pitSummary', 'pit_summary']));

  return {
    posicao: Math.max(1, posicao),
    nome,
    kart: kart ?? null,
    ...(melhorVoltaMs !== undefined ? { melhorVoltaMs } : {}),
    ...(melhorVoltaTexto ? { melhorVoltaTexto } : {}),
    ...(ultimaVolta ? { ultimaVolta } : {}),
    ...(voltas !== undefined ? { voltas: Math.max(0, voltas) } : {}),
    ...(gap ? { gap } : {}),
    ...(paradas ? { paradas } : {}),
  };
};

const normalizeName = (value: string): string =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

type SessaoFullRow = Sessao & { campeonato_nome: string | null };

const toSessaoWithCampeonato = (row: SessaoFullRow): SessaoWithCampeonato => ({
  ...row,
  campeonatos: row.campeonato_nome ? { nome: row.campeonato_nome } : null,
});

export const listSessoes = async (): Promise<SessaoWithCampeonato[]> => {
  const rows = await apiGet<SessaoFullRow[]>('sessoes_full');
  return rows.map(toSessaoWithCampeonato);
};

export type SessoesFilters = {
  etapa_id?: string;
  campeonato_id?: string;
  status?: SessaoStatus | '';
  tipo?: SessaoTipo | '';
  q?: string;
};

export const listSessoesPage = async (
  filters: SessoesFilters,
  page: number,
  pageSize: number,
): Promise<Page<SessaoWithCampeonato>> => {
  const params = new URLSearchParams();
  if (filters.etapa_id) params.set('etapa_id', filters.etapa_id);
  if (filters.campeonato_id) params.set('campeonato_id', filters.campeonato_id);
  if (filters.status) params.set('status', filters.status);
  if (filters.tipo) params.set('tipo', filters.tipo);
  if (filters.q) params.set('q', filters.q);
  params.set('limit', String(pageSize));
  params.set('offset', String(page * pageSize));

  const { data, total } = await apiGetPage<SessaoFullRow>(`sessoes_full?${params.toString()}`);
  return { data: data.map(toSessaoWithCampeonato), total };
};

export const createSessao = async (payload: SessaoPayload): Promise<Sessao> => apiPost<Sessao>('sessoes', payload);

export const updateSessao = async (id: string, payload: SessaoUpdate): Promise<Sessao> =>
  apiPatch<Sessao>(`sessoes/${id}`, payload);

export const removeSessao = async (id: string): Promise<void> => {
  await apiDelete(`sessoes/${id}`);
};

export const listVoltas = async (sessaoId: string): Promise<Volta[]> =>
  apiGet<Volta[]>(`voltas?eq_sessao_id=${encodeURIComponent(sessaoId)}&order=posicao`);

export const createVolta = async (payload: VoltaPayload): Promise<Volta> => apiPost<Volta>('voltas', payload);

export const updateVolta = async (id: string, payload: VoltaUpdate): Promise<Volta> =>
  apiPatch<Volta>(`voltas/${id}`, payload);

export const removeVolta = async (id: string): Promise<void> => {
  await apiDelete(`voltas/${id}`);
};

export const listCampeonatos = async (): Promise<CampeonatoOption[]> =>
  apiGet<CampeonatoOption[]>('campeonatos?order=nome');

export const listEtapas = async (campeonatoId?: string): Promise<EtapaOption[]> => {
  const qs = campeonatoId ? `&eq_campeonato_id=${encodeURIComponent(campeonatoId)}` : '';
  return apiGet<EtapaOption[]>(`etapas?order=nome${qs}`);
};

export const listPilotos = async (): Promise<PilotoOption[]> => apiGet<PilotoOption[]>('pilotos?order=nome');

export const fetchLiveSnapshot = async (url = DEFAULT_LIVE_URL): Promise<LiveSnapshot> => {
  try {
    let payload: unknown;
    if (url === 'cloud') {
      // Fonte NUVEM: lê o snapshot empurrado pela ponte local (livetime-scraper-server / laptime-bridge)
      const rows = await apiGet<{ id: number; payload: string }[]>('cronometragem_live?eq_id=1');
      if (!rows.length) throw new Error('Snapshot em nuvem não encontrado.');
      payload = rows[0].payload ? JSON.parse(rows[0].payload) : null;
    } else {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      payload = await response.json();
    }

    const pilotos = findPilotoArray(payload)
      .map(normalizeLivePiloto)
      .filter((piloto): piloto is LivePiloto => piloto !== null)
      .sort((left, right) => left.posicao - right.posicao);

    if (!pilotos.length) throw new Error('O endpoint não retornou pilotos reconhecíveis.');
    return {
      status: 'online',
      pilotos,
      corrida: normalizeLiveRace(payload),
      atualizadoEm: new Date().toISOString(),
    };
  } catch (error: unknown) {
    return {
      status: 'offline',
      pilotos: [],
      erro: error instanceof Error ? error.message : 'Endpoint indisponível.',
      atualizadoEm: new Date().toISOString(),
    };
  }
};

export const importarSnapshot = async (sessaoId: string, snapshot: LiveSnapshot): Promise<number> => {
  const pilotos = await listPilotos();
  const payloads: VoltaPayload[] = snapshot.pilotos
    .filter((piloto) => piloto.melhorVoltaMs !== undefined)
    .map((piloto, index) => {
      const cadastro = pilotos.find(
        (item) =>
          normalizeName(item.nome) === normalizeName(piloto.nome) ||
          (piloto.kart !== null && item.numero === piloto.kart),
      );
      return {
        sessao_id: sessaoId,
        piloto_id: cadastro?.id ?? null,
        piloto_nome: piloto.nome,
        kart: piloto.kart,
        numero: piloto.voltas ?? index + 1,
        tempo_ms: piloto.melhorVoltaMs ?? 0,
        setor1_ms: null,
        setor2_ms: null,
        setor3_ms: null,
        posicao: piloto.posicao,
        melhor: true,
        valida: true,
      };
    });

  if (!payloads.length) throw new Error('O snapshot não contém melhores voltas importáveis.');
  for (const payload of payloads) {
    await createVolta(payload);
  }
  return payloads.length;
};

type ResultadoAggregate = {
  pilotoId: string | null;
  pilotoNome: string;
  melhorTempo: number;
  voltas: number;
  posicaoInformada: number | null;
};

export const gerarResultados = async (sessaoId: string): Promise<string> => {
  const sessoes = await listSessoes();
  const sessao = sessoes.find((s) => s.id === sessaoId);
  if (!sessao) throw new Error('Não foi possível carregar a sessão: registro não encontrado.');
  if (!sessao.campeonato_id || !sessao.etapa_id) {
    throw new Error('A sessão precisa estar vinculada a campeonato e etapa.');
  }

  const voltas = await listVoltas(sessaoId);
  const validas = voltas.filter((volta) => volta.valida && volta.tempo_ms > 0);
  if (!validas.length) throw new Error('A sessão não possui voltas válidas.');

  const aggregates = new Map<string, ResultadoAggregate>();
  validas.forEach((volta) => {
    const key = volta.piloto_id ?? normalizeName(volta.piloto_nome);
    const current = aggregates.get(key);
    if (!current) {
      aggregates.set(key, {
        pilotoId: volta.piloto_id,
        pilotoNome: volta.piloto_nome,
        melhorTempo: volta.tempo_ms,
        voltas: 1,
        posicaoInformada: volta.posicao,
      });
      return;
    }
    current.voltas += 1;
    current.melhorTempo = Math.min(current.melhorTempo, volta.tempo_ms);
    if (volta.posicao !== null) {
      current.posicaoInformada = Math.min(current.posicaoInformada ?? volta.posicao, volta.posicao);
    }
  });

  const classificados = [...aggregates.values()].sort((left, right) => {
    if (left.posicaoInformada !== null && right.posicaoInformada !== null) {
      return left.posicaoInformada - right.posicaoInformada;
    }
    return left.melhorTempo - right.melhorTempo;
  });
  const leaderTime = classificados[0]?.melhorTempo ?? 0;

  const corrida = await apiPost<{ id: string }>('corridas', {
    etapa_id: sessao.etapa_id,
    campeonato_id: sessao.campeonato_id,
    titulo: sessao.nome,
    data: sessao.data,
    status: 'publicada',
    source: 'cronometragem',
  });
  const corridaId = corrida.id;

  const resultados = classificados.map((resultado, index) => ({
    corrida_id: corridaId,
    piloto_id: resultado.pilotoId,
    piloto_nome: resultado.pilotoNome,
    posicao: index + 1,
    melhor_volta: msParaTexto(resultado.melhorTempo),
    voltas: resultado.voltas,
    pontos: POINTS_BY_POSITION[index] ?? 0,
    gap: index === 0 ? 'Líder' : `+${((resultado.melhorTempo - leaderTime) / 1_000).toFixed(3)}`,
  }));

  try {
    for (const resultado of resultados) {
      await apiPost('resultados', resultado);
    }
  } catch (error) {
    await apiDelete(`corridas/${corridaId}`);
    throw error instanceof Error ? error : new Error('Não foi possível inserir os resultados');
  }

  await recalcularClassificacao(sessao.campeonato_id);
  return corridaId;
};

export const recalcularClassificacao = async (campeonatoId: string): Promise<void> => {
  const corridas = await apiGet<{ id: string }[]>(
    `corridas?eq_campeonato_id=${encodeURIComponent(campeonatoId)}&eq_status=publicada`,
  );

  const totals = new Map<string, number>();
  for (const corrida of corridas) {
    const resultados = await apiGet<{ piloto_id: string | null; posicao: number | null }[]>(
      `resultados?eq_corrida_id=${encodeURIComponent(corrida.id)}`,
    );
    resultados.forEach((resultado) => {
      if (!resultado.piloto_id || !resultado.posicao) return;
      const points = POINTS_BY_POSITION[resultado.posicao - 1] ?? 0;
      totals.set(resultado.piloto_id, (totals.get(resultado.piloto_id) ?? 0) + points);
    });
  }

  const rows = [...totals.entries()]
    .sort(([leftId, leftPoints], [rightId, rightPoints]) =>
      rightPoints === leftPoints ? leftId.localeCompare(rightId) : rightPoints - leftPoints,
    )
    .map(([pilotoId, pontos], index) => ({
      campeonato_id: campeonatoId,
      piloto_id: pilotoId,
      pontos,
      posicao: index + 1,
    }));

  if (!rows.length) return;
  await apiPut('classificacao/upsert', rows);
};
