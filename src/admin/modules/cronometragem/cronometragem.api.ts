import { supabase } from '../../lib/supabase';
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

export const DEFAULT_LIVE_URL = 'http://localhost:4010/api/livetime-snapshot';

const POINTS_BY_POSITION = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const;

const queryError = (operation: string, message: string): Error =>
  new Error(`${operation}: ${message}`);

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
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export const listSessoes = async (): Promise<SessaoWithCampeonato[]> => {
  const { data, error } = await supabase
    .from('sessoes')
    .select(
      'id, campeonato_id, etapa_id, nome, tipo, data, status, fonte, created_at, campeonatos(nome)',
    )
    .order('data', { ascending: false });

  if (error) throw queryError('Não foi possível carregar as sessões', error.message);
  return (data ?? []) as unknown as SessaoWithCampeonato[];
};

export const createSessao = async (payload: SessaoPayload): Promise<Sessao> => {
  const { data, error } = await supabase.from('sessoes').insert(payload).select().single();
  if (error) throw queryError('Não foi possível criar a sessão', error.message);
  return data as Sessao;
};

export const updateSessao = async (
  id: string,
  payload: SessaoUpdate,
): Promise<Sessao> => {
  const { data, error } = await supabase
    .from('sessoes')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw queryError('Não foi possível atualizar a sessão', error.message);
  return data as Sessao;
};

export const removeSessao = async (id: string): Promise<void> => {
  const { error } = await supabase.from('sessoes').delete().eq('id', id);
  if (error) throw queryError('Não foi possível excluir a sessão', error.message);
};

export const listVoltas = async (sessaoId: string): Promise<Volta[]> => {
  const { data, error } = await supabase
    .from('voltas')
    .select(
      'id, sessao_id, piloto_id, piloto_nome, kart, numero, tempo_ms, setor1_ms, setor2_ms, setor3_ms, posicao, melhor, valida, created_at',
    )
    .eq('sessao_id', sessaoId)
    .order('posicao')
    .order('tempo_ms');
  if (error) throw queryError('Não foi possível carregar as voltas', error.message);
  return (data ?? []) as Volta[];
};

export const createVolta = async (payload: VoltaPayload): Promise<Volta> => {
  const { data, error } = await supabase.from('voltas').insert(payload).select().single();
  if (error) throw queryError('Não foi possível criar a volta', error.message);
  return data as Volta;
};

export const updateVolta = async (id: string, payload: VoltaUpdate): Promise<Volta> => {
  const { data, error } = await supabase
    .from('voltas')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw queryError('Não foi possível atualizar a volta', error.message);
  return data as Volta;
};

export const removeVolta = async (id: string): Promise<void> => {
  const { error } = await supabase.from('voltas').delete().eq('id', id);
  if (error) throw queryError('Não foi possível excluir a volta', error.message);
};

export const listCampeonatos = async (): Promise<CampeonatoOption[]> => {
  const { data, error } = await supabase
    .from('campeonatos')
    .select('id, nome, status')
    .order('nome');
  if (error) throw queryError('Não foi possível carregar os campeonatos', error.message);
  return (data ?? []) as CampeonatoOption[];
};

export const listEtapas = async (campeonatoId?: string): Promise<EtapaOption[]> => {
  let query = supabase.from('etapas').select('id, campeonato_id, nome').order('nome');
  if (campeonatoId) query = query.eq('campeonato_id', campeonatoId);
  const { data, error } = await query;
  if (error) throw queryError('Não foi possível carregar as etapas', error.message);
  return (data ?? []) as EtapaOption[];
};

export const listPilotos = async (): Promise<PilotoOption[]> => {
  const { data, error } = await supabase
    .from('pilotos')
    .select('id, nome, numero, equipe')
    .order('nome');
  if (error) throw queryError('Não foi possível carregar os pilotos', error.message);
  return (data ?? []) as PilotoOption[];
};

export const fetchLiveSnapshot = async (url = DEFAULT_LIVE_URL): Promise<LiveSnapshot> => {
  try {
    let payload: unknown;
    if (url === 'cloud') {
      // Fonte NUVEM: lê o snapshot empurrado pela ponte (scripts/laptime-bridge.mjs)
      const { data, error } = await supabase
        .from('cronometragem_live')
        .select('payload')
        .eq('id', 1)
        .single();
      if (error) throw new Error(error.message);
      payload = (data as { payload: unknown } | null)?.payload;
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

export const importarSnapshot = async (
  sessaoId: string,
  snapshot: LiveSnapshot,
): Promise<number> => {
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
  const { error } = await supabase.from('voltas').insert(payloads);
  if (error) throw queryError('Não foi possível importar o snapshot', error.message);
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
  const { data: sessaoData, error: sessaoError } = await supabase
    .from('sessoes')
    .select('id, campeonato_id, etapa_id, nome, data')
    .eq('id', sessaoId)
    .single();
  if (sessaoError) throw queryError('Não foi possível carregar a sessão', sessaoError.message);

  const sessao = sessaoData as Pick<
    Sessao,
    'id' | 'campeonato_id' | 'etapa_id' | 'nome' | 'data'
  >;
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

  const { data: corridaData, error: corridaError } = await supabase
    .from('corridas')
    .insert({
      etapa_id: sessao.etapa_id,
      campeonato_id: sessao.campeonato_id,
      titulo: sessao.nome,
      data: sessao.data,
      status: 'publicada',
      source: 'cronometragem',
    })
    .select('id')
    .single();
  if (corridaError) throw queryError('Não foi possível criar a corrida', corridaError.message);
  const corridaId = (corridaData as { id: string }).id;

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

  const { error: resultadosError } = await supabase.from('resultados').insert(resultados);
  if (resultadosError) {
    await supabase.from('corridas').delete().eq('id', corridaId);
    throw queryError('Não foi possível inserir os resultados', resultadosError.message);
  }

  await recalcularClassificacao(sessao.campeonato_id);
  return corridaId;
};

type CorridaComResultados = {
  resultados: Array<{ piloto_id: string | null; posicao: number | null }> | null;
};

export const recalcularClassificacao = async (campeonatoId: string): Promise<void> => {
  const { data, error } = await supabase
    .from('corridas')
    .select('resultados(piloto_id, posicao)')
    .eq('campeonato_id', campeonatoId)
    .eq('status', 'publicada');
  if (error) throw queryError('Não foi possível ler os resultados publicados', error.message);

  const totals = new Map<string, number>();
  ((data ?? []) as unknown as CorridaComResultados[]).forEach((corrida) => {
    corrida.resultados?.forEach((resultado) => {
      if (!resultado.piloto_id || !resultado.posicao) return;
      const points = POINTS_BY_POSITION[resultado.posicao - 1] ?? 0;
      totals.set(resultado.piloto_id, (totals.get(resultado.piloto_id) ?? 0) + points);
    });
  });

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
  const { error: upsertError } = await supabase
    .from('classificacao')
    .upsert(rows, { onConflict: 'campeonato_id,piloto_id' });
  if (upsertError) throw queryError('Não foi possível recalcular a classificação', upsertError.message);
};
