import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Clock3, Flag, Medal, RefreshCw, Trophy } from 'lucide-react';
import { formatResultDateTime, normalizeRaceResult } from '../lib/raceResults';
import type { RaceResultPayload } from '../types/raceResults';

interface ChampionshipResultsProps {
  championshipId: string;
}

const statusLabels: Record<RaceResultPayload['status'], string> = {
  live: 'Ao vivo',
  provisional: 'Provisório',
  final: 'Final',
};

const fetchResultJson = async (url: string) => {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  const contentType = response.headers.get('content-type') || '';

  if (!response.ok || !contentType.includes('application/json')) {
    throw new Error('result-not-json');
  }

  return normalizeRaceResult((await response.json()) as RaceResultPayload);
};

const ChampionshipResults = ({ championshipId }: ChampionshipResultsProps) => {
  const [payload, setPayload] = useState<RaceResultPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadResult = async () => {
      try {
        let result: RaceResultPayload;

        try {
          result = await fetchResultJson(`/api/results?championship=${encodeURIComponent(championshipId)}&t=${Date.now()}`);
        } catch {
          result = await fetchResultJson(`/data/race-results/${encodeURIComponent(championshipId)}/latest.json?t=${Date.now()}`);
        }

        if (!cancelled) {
          setPayload(result);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError('Resultado indisponível');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadResult();
    const interval = window.setInterval(loadResult, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [championshipId]);

  const winner = useMemo(() => payload?.entries[0], [payload]);
  const podium = useMemo(() => payload?.entries.slice(0, 3) ?? [], [payload]);
  const standings = payload?.standings?.slice(0, 10) ?? [];

  if (isLoading) {
    return (
      <div className="kac-results-state" data-reveal>
        <RefreshCw className="h-5 w-5 animate-spin text-primary-600" />
        <span>Carregando resultado...</span>
      </div>
    );
  }

  if (error || !payload || payload.entries.length === 0) {
    return (
      <div className="kac-results-state" data-reveal>
        <AlertCircle className="h-5 w-5 text-primary-600" />
        <span>Resultado será publicado aqui assim que a corrida for encerrada.</span>
      </div>
    );
  }

  return (
    <div className="kac-results-grid" data-reveal>
      <div className="kac-results-summary">
        <div className="kac-results-kicker">
          <Flag className="h-4 w-4" />
          <span>{statusLabels[payload.status]}</span>
        </div>
        <h3>{payload.title}</h3>
        <p>
          {payload.round ? `Corrida ${payload.round} - ` : ''}
          {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(`${payload.date}T12:00:00`))}
        </p>

        {winner && (
          <div className="kac-winner-card">
            <div>
              <span>1º colocado</span>
              <strong>{winner.name}</strong>
            </div>
            <Trophy className="h-10 w-10 text-primary-600" />
          </div>
        )}

        <div className="kac-result-meta">
          <Clock3 className="h-4 w-4" />
          <span>Atualizado em {formatResultDateTime(payload.generatedAt)}</span>
        </div>
      </div>

      <div className="kac-results-table">
        <div className="kac-results-table-head">
          <Medal className="h-5 w-5 text-primary-600" />
          <strong>Resultado da corrida</strong>
        </div>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Pos.</th>
                <th>Piloto</th>
                <th>Melhor volta</th>
                <th>Pontos</th>
              </tr>
            </thead>
            <tbody>
              {payload.entries.map((entry) => (
                <tr key={`${entry.position}-${entry.name}`}>
                  <td>{entry.position}</td>
                  <td>{entry.name}</td>
                  <td>{entry.bestLap ?? '-'}</td>
                  <td>{typeof entry.points === 'number' ? entry.points : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="kac-results-podium">
        {podium.map((entry) => (
          <div key={entry.name} className="kac-podium-item">
            <span>{entry.position}º</span>
            <strong>{entry.name}</strong>
            <p>{entry.bestLap ?? 'Sem tempo'}</p>
          </div>
        ))}
      </div>

      <div className="kac-standings-table">
        <div className="kac-results-table-head">
          <Trophy className="h-5 w-5 text-primary-600" />
          <strong>Classificação do campeonato</strong>
        </div>
        {standings.length > 0 ? (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Pos.</th>
                  <th>Piloto</th>
                  <th>Pontos</th>
                  <th>Corridas</th>
                  <th>Vitórias</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((standing) => (
                  <tr key={standing.name}>
                    <td>{standing.position}</td>
                    <td>{standing.name}</td>
                    <td>{standing.points}</td>
                    <td>{standing.starts}</td>
                    <td>{standing.wins}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="kac-standings-empty">Ranking do campeonato será consolidado após a publicação da primeira corrida.</p>
        )}
      </div>
    </div>
  );
};

export default ChampionshipResults;
