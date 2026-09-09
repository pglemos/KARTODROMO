'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { StageSnapshot } from '@/lib/udk-bridge/live-stage';

type PublicSnapshot = StageSnapshot & { capturedAt: string; updatedAt: string };

type UltrasStageClientProps = {
  stageId: string;
};

const POLL_MS = 3_000;
const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function formatPoints(points: number | null): string {
  return points === null ? '—' : Number.isInteger(points) ? String(points) : points.toFixed(1);
}

function formatUpdatedAt(value: string | undefined): string {
  if (!value) return 'sem atualização';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : timeFormatter.format(date);
}

function stateLabel(state: 'scheduled' | 'live' | 'finished'): string {
  if (state === 'finished') return 'Finalizada';
  if (state === 'live') return 'Ao vivo';
  return 'Agendada';
}

function stateClass(state: 'scheduled' | 'live' | 'finished'): string {
  if (state === 'finished') return 'ultras-state ultras-state-finished';
  if (state === 'live') return 'ultras-state ultras-state-live';
  return 'ultras-state ultras-state-scheduled';
}

function SnapshotTable({ snapshot, categoryId }: { snapshot: PublicSnapshot; categoryId: string }) {
  const category = snapshot.categories.find((item) => item.id === categoryId);
  if (!category) return null;

  return (
    <section className="ultras-category" aria-labelledby={`ultras-category-${category.id}`}>
      <div className="ultras-category-heading">
        <div>
          <p className="ultras-kicker">Classificação combinada</p>
          <h2 id={`ultras-category-${category.id}`}>{category.name}</h2>
        </div>
        <span>{category.rows.length} pilotos</span>
      </div>
      <div className="ultras-table-wrap">
        <table className="ultras-table">
          <thead>
            <tr>
              <th scope="col">Pos.</th>
              <th scope="col">Piloto</th>
              <th scope="col">Corrida 1 <small>normal</small></th>
              <th scope="col">Corrida 2 <small>invertido</small></th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {category.rows.map((row) => (
              <tr className={row.position !== null && row.position <= 3 ? 'ultras-row-top' : ''} key={row.driverId}>
                <td className="ultras-position">{row.position === null ? '—' : `${row.position}º`}</td>
                <th scope="row">{row.name}</th>
                <td>{formatPoints(row.racePoints[0] ?? null)}</td>
                <td>{formatPoints(row.racePoints[1] ?? null)}</td>
                <td className="ultras-total">{formatPoints(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function UltrasStageClient({ stageId }: UltrasStageClientProps) {
  const [snapshot, setSnapshot] = useState<PublicSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSnapshot = useCallback(async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);

    try {
      const query = new URLSearchParams({ stage_id: stageId, _ts: String(Date.now()) });
      const response = await fetch(`/api/ultras-stage?${query.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string } & Partial<PublicSnapshot>;
      if (!response.ok) throw new Error(body.message || body.error || `HTTP ${response.status}`);
      setSnapshot(body as PublicSnapshot);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a etapa Ultras.');
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }, [stageId]);

  useEffect(() => {
    void loadSnapshot();
    const timer = window.setInterval(() => void loadSnapshot(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadSnapshot]);

  const overallLabel = useMemo(() => {
    if (!snapshot) return 'Aguardando dados';
    if (snapshot.complete) return 'Resultado final';
    if (snapshot.heats.some((heat) => heat.state === 'live')) return 'Resultado ao vivo';
    return 'Resultado provisório';
  }, [snapshot]);

  return (
    <main className="ultras-page">
      <style>{`
        .ultras-page{min-height:100vh;background:#07090d;color:#f5f7fb;font-family:Arial,Helvetica,sans-serif;padding:clamp(20px,4vw,56px)}
        .ultras-shell{max-width:1440px;margin:0 auto}
        .ultras-header{display:flex;align-items:flex-end;justify-content:space-between;gap:28px;border-bottom:1px solid #26303b;padding-bottom:24px}
        .ultras-kicker{color:#ff5c35;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;margin:0 0 8px}
        .ultras-header h1{font-size:clamp(32px,5vw,68px);line-height:.95;letter-spacing:-.05em;margin:0;font-weight:900;text-transform:uppercase}
        .ultras-subtitle{color:#aab6c4;font-size:15px;margin:12px 0 0}
        .ultras-live-badge{border:1px solid #314050;background:#0d141c;border-radius:999px;display:flex;align-items:center;gap:10px;padding:10px 14px;color:#dce8f3;font-size:12px;font-weight:800;white-space:nowrap;text-transform:uppercase;letter-spacing:.08em}
        .ultras-live-dot{width:8px;height:8px;background:#ff5c35;border-radius:50%;box-shadow:0 0 0 4px #ff5c3522,0 0 18px #ff5c35;animation:ultras-pulse 1.5s infinite}
        @keyframes ultras-pulse{50%{opacity:.35}}
        .ultras-races{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:24px 0}
        .ultras-race{border:1px solid #26313e;background:linear-gradient(135deg,#101720,#0b0f15);border-radius:14px;padding:18px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px}
        .ultras-race strong{display:block;font-size:18px}
        .ultras-race small{display:block;color:#8795a5;margin-top:5px;font-size:12px}
        .ultras-state{border-radius:999px;font-size:11px;font-weight:900;letter-spacing:.08em;padding:7px 10px;text-transform:uppercase;white-space:nowrap}
        .ultras-state-live{background:#ff5c3520;color:#ff8c6f;border:1px solid #ff5c3570}
        .ultras-state-finished{background:#39d98a18;color:#74e9ac;border:1px solid #39d98a55}
        .ultras-state-scheduled{background:#8290a015;color:#b9c5d2;border:1px solid #8290a040}
        .ultras-note{color:#9eabb9;font-size:13px;margin:0 0 22px}
        .ultras-note strong{color:#fff}
        .ultras-category{background:#0d1219;border:1px solid #26313e;border-radius:16px;overflow:hidden;margin-top:18px}
        .ultras-category-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 22px;border-bottom:1px solid #26313e}
        .ultras-category-heading h2{font-size:23px;margin:0;text-transform:uppercase;letter-spacing:-.02em}
        .ultras-category-heading>span{font-size:12px;color:#91a0af}
        .ultras-category-heading .ultras-kicker{margin-bottom:4px}
        .ultras-table-wrap{overflow-x:auto}
        .ultras-table{border-collapse:collapse;width:100%;min-width:700px}
        .ultras-table th,.ultras-table td{padding:13px 18px;text-align:right;border-bottom:1px solid #1d2731;font-size:14px}
        .ultras-table thead th{color:#8391a1;font-size:10px;letter-spacing:.1em;text-transform:uppercase;background:#0a0e14;white-space:nowrap}
        .ultras-table thead th:nth-child(2),.ultras-table tbody th{text-align:left}
        .ultras-table thead small{display:block;color:#5d6b79;font-size:9px;letter-spacing:.06em;margin-top:3px}
        .ultras-table tbody th{color:#e8edf3;font-weight:700}
        .ultras-table tbody tr:last-child th,.ultras-table tbody tr:last-child td{border-bottom:0}
        .ultras-position{color:#92a0ae;width:70px;font-variant-numeric:tabular-nums}
        .ultras-row-top .ultras-position{color:#ff805e;font-weight:900}
        .ultras-total{color:#fff;font-size:17px!important;font-weight:900;font-variant-numeric:tabular-nums}
        .ultras-footer{display:flex;align-items:center;justify-content:space-between;gap:15px;color:#718092;font-size:11px;margin-top:24px}
        .ultras-footer strong{color:#afbbc8}
        .ultras-alert{border:1px solid #a9782c;background:#5a3b101c;color:#f3c676;border-radius:12px;padding:14px 16px;font-size:13px;line-height:1.55;margin-top:20px}
        .ultras-alert strong{display:block;color:#ffe0a0;margin-bottom:5px}
        .ultras-empty{min-height:45vh;display:grid;place-items:center;text-align:center}
        .ultras-empty-card{border:1px solid #26313e;background:#0d1219;border-radius:16px;padding:30px;max-width:560px}
        .ultras-empty-card h2{margin:0 0 10px;font-size:22px}
        .ultras-empty-card p{color:#9eabb9;margin:0;line-height:1.55}
        @media (max-width:700px){.ultras-header{align-items:flex-start;flex-direction:column}.ultras-live-badge{align-self:flex-start}.ultras-races{grid-template-columns:1fr}.ultras-race{padding:15px}.ultras-table th,.ultras-table td{padding:12px 13px}.ultras-category-heading{padding:17px}.ultras-footer{align-items:flex-start;flex-direction:column}}
      `}</style>

      <div className="ultras-shell">
        <header className="ultras-header">
          <div>
            <p className="ultras-kicker">Kartódromo Internacional de Betim · Campeonato Ultras</p>
            <h1>{snapshot?.title || 'Ultras · 2ª etapa'}</h1>
            <p className="ultras-subtitle">Traçado normal + traçado invertido · classificação única da etapa</p>
          </div>
          <div className="ultras-live-badge">
            <span className="ultras-live-dot" aria-hidden="true" />
            {overallLabel}
          </div>
        </header>

        {snapshot ? (
          <>
            <section className="ultras-races" aria-label="Corridas da etapa">
              {snapshot.heats.map((heat) => (
                <article className="ultras-race" key={heat.racingId}>
                  <div>
                    <strong>{heat.label}</strong>
                    <small>Vencedor: 50 pontos base · {heat.entries.length} pilotos vinculados</small>
                  </div>
                  <span className={stateClass(heat.state)}>{stateLabel(heat.state)}</span>
                </article>
              ))}
            </section>

            <p className="ultras-note">
              <strong>Total = Corrida 1 + Corrida 2.</strong> A classificação é vinculada ao piloto no UDK, mesmo que o kart mude entre os traçados. Fonte: {snapshot.source}; atualização: {formatUpdatedAt(snapshot.capturedAt)}.
            </p>

            {snapshot.categories.map((category) => (
              <SnapshotTable categoryId={category.id} key={category.id} snapshot={snapshot} />
            ))}

            {snapshot.unresolved.length > 0 ? (
              <aside className="ultras-alert" role="status">
                <strong>Resultado provisório: há pilotos sem vínculo no UDK.</strong>
                {snapshot.unresolved.join(' · ')}
              </aside>
            ) : null}

            <footer className="ultras-footer">
              <span>Leitura automática do LapTime a cada 3 segundos</span>
              <strong>{snapshot.complete ? 'Etapa encerrada e conferida' : 'Dados sujeitos ao fechamento da cronometragem'}</strong>
            </footer>
          </>
        ) : (
          <section className="ultras-empty">
            <div className="ultras-empty-card">
              <h2>{loading ? 'Conectando à cronometragem...' : 'Aguardando o snapshot da etapa'}</h2>
              <p>{error || 'O bridge local publica o primeiro resultado assim que as corridas estiverem disponíveis no LapTime.'}</p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
