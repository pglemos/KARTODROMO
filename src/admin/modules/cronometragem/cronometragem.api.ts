import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../../lib/api-client';
import type {
  CampeonatoOption,
  EtapaOption,
  LivePiloto,
  LiveSnapshot,
  PilotoOption,
  Sessao,
  SessaoPayload,
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

  return {
    posicao: Math.max(1, posicao),
    nome,
    kart: kart ?? null,
    ...(melhorVoltaMs !== undefined ? { melhorVoltaMs } : {}),
    ...(melhorVoltaTexto ? { melhorVoltaTexto } : {}),
    ...(ultimaVolta ? { ultimaVolta } : {}),
    ...(voltas !== undefined ? { voltas: Math.max(0, voltas) } : {}),
    ...(gap ? { gap } : {}),
  };
};

const normalizeName = (value: string): string =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

type SessaoFullRow = Sessao & { campeonato_nome: string | null };

export const listSessoes = async (): Promise<SessaoWithCampeonato[]> => {
  const rows = await apiGet<SessaoFullRow[]>('sessoes_full');
  return rows.map((row) => ({ ...row, campeonatos: row.campeonato_nome ? { nome: row.campeonato_nome } : null }));
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
    return { status: 'online', pilotos, atualizadoEm: new Date().toISOString() };
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
