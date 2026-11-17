/**
 * Catálogo de traçados da Cronometragem usado pela Recepção.
 *
 * A Recepção precisa continuar gravando o inteiro TracadoId do banco de operações,
 * mas o nome, comprimento e a identidade técnica vêm do catálogo da Cronometragem.
 * O espelho local mantém essa ponte sem duplicar registros a cada login.
 */

export type TimingTrack = {
  id: string;
  name: string;
  lengthMeters: number;
  active: true;
};

type SqlParams = Record<string, unknown>;
type SqlQuery = <T = Record<string, unknown>>(text: string, params?: SqlParams) => Promise<T[]>;
type SqlOne = <T = Record<string, unknown>>(text: string, params?: SqlParams) => Promise<T | null>;
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

const texto = (value: unknown) => String(value ?? '').trim();

function chaveNome(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');
}

/** Converte a resposta livre da API em uma lista estável para a Recepção. */
export function canonicalizeTimingTracks(input: unknown): TimingTrack[] {
  if (!Array.isArray(input)) return [];
  const vistos = new Set<string>();
  const tracks: TimingTrack[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const id = texto(item.id);
    const name = texto(item.name);
    const lengthMeters = Number(item.lengthMeters);
    const inactive = item.active === false || item.active === 0 || item.active === 'false';
    if (!id || !name || !Number.isFinite(lengthMeters) || lengthMeters <= 0 || inactive) continue;
    const key = chaveNome(name);
    if (vistos.has(key)) continue;
    vistos.add(key);
    tracks.push({ id, name, lengthMeters: Math.round(lengthMeters), active: true });
  }
  return tracks.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' }) || a.id.localeCompare(b.id));
}

export async function syncTimingTracks({
  timingUrl,
  query,
  one,
  fetcher = fetch,
}: {
  timingUrl: string;
  query: SqlQuery;
  one: SqlOne;
  fetcher?: Fetcher;
}): Promise<TimingTrack[]> {
  // O servidor pode estar atualizando uma instalação criada antes deste espelho.
  // Fazemos isso antes da chamada externa para que o fallback histórico continue
  // funcionando mesmo se a Cronometragem estiver temporariamente indisponível.
  // kart.tracado.timing_track_id já vem das migrations do Kartódromo OS.

  const response = await fetcher(`${timingUrl.replace(/\/$/, '')}/api/catalog/tracks`, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`A cronometragem respondeu HTTP ${response.status}.`);
  const tracks = canonicalizeTimingTracks(await response.json());
  if (!tracks.length) throw new Error('A cronometragem não devolveu nenhum traçado ativo.');

  const atuais = await query<{ id: number; timingId: string | null }>(
    `select id, timing_track_id "timingId" from kart.tracado where timing_track_id is not null`,
  );
  const porTimingId = new Map(atuais.filter((r) => r.timingId).map((r) => [String(r.timingId), r.id]));
  const idsCanonicos = new Map(porTimingId);
  const idsAtivos = new Set<string>();

  for (const track of tracks) {
    idsAtivos.add(track.id);
    const id = porTimingId.get(track.id);
    if (id) {
      await query(
        `update kart.tracado set nome = @nome, comprimento = @comprimento, ativo = true where id = @id`,
        { id, nome: track.name, comprimento: track.lengthMeters },
      );
    } else {
      const criado = await one<{ id: number }>(
        `insert into kart.tracado (nome, comprimento, ativo, timing_track_id)
         values (@nome, @comprimento, true, @timingId) returning id`,
        { nome: track.name, comprimento: track.lengthMeters, timingId: track.id },
      );
      if (criado?.id) idsCanonicos.set(track.id, criado.id);
    }
  }

  // Os registros antigos eram genéricos ("Traçado 1", "Traçado 6").
  // Para que a agenda já criada passe a chegar à Cronometragem com um UUID,
  // apontamos somente baterias futuras e padrões ativos para a variante Normal
  // de mesmo número e comprimento. Histórico e provas já iniciadas não mudam.
  const antigos = await query<{ id: number; nome: string; comprimento: number | null }>(
    `select id, nome, comprimento from kart.tracado where timing_track_id is null and ativo`,
  );
  for (const antigo of antigos) {
    const match = antigo.nome.match(/^Traçado\s+(\d+)$/i);
    if (!match) continue;
    const normal = tracks.find((track) => track.name === `Traçado ${match[1]} Normal` && Number(antigo.comprimento) === track.lengthMeters);
    const novoId = normal ? idsCanonicos.get(normal.id) : undefined;
    if (!novoId) continue;
    await query(`update kart.bateria set tracado_id = @novo where tracado_id = @antigo and inicio >= now()`, { novo: novoId, antigo: antigo.id });
    await query(`update kart.padrao_reserva set tracado_id = @novo where tracado_id = @antigo and ativo`, { novo: novoId, antigo: antigo.id });
  }

  // Registros retirados/inativados na Cronometragem não continuam aparecendo na Recepção.
  for (const atual of atuais) {
    if (atual.timingId && !idsAtivos.has(String(atual.timingId))) {
      await query(`update kart.tracado set ativo = false where id = @id`, { id: atual.id });
    }
  }
  return tracks;
}
