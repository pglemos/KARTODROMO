'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  ClipboardList,
  Flag,
  History,
  RefreshCw,
  TimerReset,
  Trophy,
} from 'lucide-react';
import { Badge, type BadgeVariant } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import {
  getLapTimeRacingDetail,
  type LapTimeRacingDetail,
  type LapTimeRacingDetailCompetitor,
  type LapTimeRacingDetailLap,
  type LapTimeRacingPitStopStatus,
} from './laptime-racings.api';

type DetailTab = 'classification' | 'stops' | 'history';
type StopFilter = 'all' | 'mandatory' | 'short' | 'invalid' | 'outside-window' | 'additional';

const stopStatusLabels: Record<LapTimeRacingPitStopStatus, string> = {
  mandatory: 'Obrigatória',
  additional: 'Adicional',
  short: 'Errada · 4:00-6:59',
  invalid: 'Inválida',
  'outside-window': 'Fora da janela',
};

const stopStatusVariants: Record<LapTimeRacingPitStopStatus, BadgeVariant> = {
  mandatory: 'emerald',
  additional: 'blue',
  short: 'amber',
  invalid: 'red',
  'outside-window': 'red',
};

const inputClassName =
  'rounded-lg border border-zinc-700 bg-zinc-950 min-h-[44px] px-3 py-1.5 sm:min-h-0 sm:py-2 text-sm text-[var(--admin-text)] focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

const formatDate = (value: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(date);
};

const parseTimeMs = (value: string | null): number | null => {
  if (!value) return null;
  const parts = value.replace(/^\+/, '').split(':');
  if (parts.length > 2) return null;
  const seconds = Number(parts[parts.length - 1]);
  const minutes = parts.length === 2 ? Number(parts[0]) : 0;
  if (!Number.isFinite(seconds) || !Number.isFinite(minutes)) return null;
  return Math.round((minutes * 60 + seconds) * 1_000);
};

const formatInteger = (value: number): string => value.toLocaleString('pt-BR');

const statusBadge = (detail: LapTimeRacingDetail) => (
  <Badge variant={detail.race.finalizada ? 'blue' : detail.race.situacao === 'agendada' ? 'amber' : 'emerald'}>
    {detail.race.finalizada ? 'Finalizada' : detail.race.situacao === 'agendada' ? 'Agendada' : 'Em andamento'}
  </Badge>
);

const recoveryText = (value: number | null): string => {
  if (value === null || value === 0) return '—';
  return value > 0 ? `+${value} posições` : `${value} posições`;
};

const lapStatus = (lap: LapTimeRacingDetailLap): { label: string; variant: BadgeVariant } => {
  if (lap.statusParada) return { label: stopStatusLabels[lap.statusParada], variant: stopStatusVariants[lap.statusParada] };
  if (lap.excluida) return { label: 'Excluída', variant: 'red' };
  if (lap.invalida) return { label: 'Inválida', variant: 'red' };
  return { label: 'Volta válida', variant: 'emerald' };
};

const Metric = ({ label, value, detail }: { label: string; value: string; detail?: string }) => (
  <Card className="p-4">
    <p className="text-[11px] font-bold uppercase tracking-[.14em] text-zinc-500">{label}</p>
    <p className="mt-2 text-xl font-black text-[var(--admin-text)]">{value}</p>
    {detail ? <p className="mt-1 text-xs text-zinc-500">{detail}</p> : null}
  </Card>
);

const ClassificationTable = ({ competitors }: { competitors: LapTimeRacingDetailCompetitor[] }) => (
  <div className="overflow-x-auto rounded-xl border border-zinc-800">
    <table className="min-w-[1500px] w-full text-left text-sm">
      <thead className="border-b border-zinc-800 bg-zinc-950/60">
        <tr>
          {[
            'Pos.',
            'Kart',
            'Piloto / equipe',
            'Voltas',
            'Melhor',
            'Média',
            'Pior',
            'Tempo total',
            'Recuperação',
            'Paradas válidas',
            'Erradas 4:00-6:59',
            'Faltam',
            'Punição',
            'Situação',
          ].map((label) => (
            <th className="whitespace-nowrap px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500" key={label}>
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {competitors.map((competitor) => (
          <tr className="border-b border-zinc-800/60 last:border-0" key={competitor.id}>
            <td className="px-3 py-3 font-bold text-[var(--admin-text)]">{competitor.posicao ?? '—'}</td>
            <td className="px-3 py-3 text-zinc-300">{competitor.numero ?? '—'}</td>
            <td className="min-w-[210px] px-3 py-3 font-semibold text-zinc-100">{competitor.nome}</td>
            <td className="px-3 py-3 text-zinc-300">{competitor.voltas ?? '—'}</td>
            <td className="whitespace-nowrap px-3 py-3 text-brand-300">{competitor.melhorVolta ?? '—'}</td>
            <td className="whitespace-nowrap px-3 py-3 text-zinc-300">{competitor.averageLap ?? '—'}</td>
            <td className="whitespace-nowrap px-3 py-3 text-zinc-300">{competitor.worstLap ?? '—'}</td>
            <td className="whitespace-nowrap px-3 py-3 text-zinc-300">{competitor.tempoTotal ?? '—'}</td>
            <td className={`whitespace-nowrap px-3 py-3 ${competitor.positionRecovery && competitor.positionRecovery > 0 ? 'text-emerald-300' : 'text-zinc-400'}`}>
              {recoveryText(competitor.positionRecovery)}
            </td>
            <td className="px-3 py-3 font-semibold text-emerald-300">
              {competitor.pitStops.mandatory}/{competitor.pitStops.required}
            </td>
            <td className="px-3 py-3 text-amber-300">{competitor.pitStops.short}</td>
            <td className={`whitespace-nowrap px-3 py-3 font-bold ${competitor.penaltyLaps ? 'text-red-300' : 'text-emerald-300'}`}>
              {competitor.penaltyLaps ? `+${competitor.penaltyLaps} voltas` : 'Nenhuma'}
            </td>
            <td className="whitespace-nowrap px-3 py-3">
              <Badge variant={competitor.statusLabel === 'Desclassificado' ? 'red' : competitor.statusLabel === 'Classificado' ? 'emerald' : 'zinc'}>
                {competitor.statusLabel}
              </Badge>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export function ResultadoRacingDetailPage({ racingId }: { racingId: string }) {
  const [detail, setDetail] = useState<LapTimeRacingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('classification');
  const [stopFilter, setStopFilter] = useState<StopFilter>('all');
  const [selectedCompetitorId, setSelectedCompetitorId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getLapTimeRacingDetail(racingId);
      setDetail(result);
      setSelectedCompetitorId((current) =>
        current && result.competitors.some((competitor) => competitor.id === current)
          ? current
          : result.competitors[0]?.id ?? '',
      );
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o detalhe da corrida.');
    } finally {
      setLoading(false);
    }
  }, [racingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedCompetitor = useMemo(
    () => detail?.competitors.find((competitor) => competitor.id === selectedCompetitorId) ?? null,
    [detail, selectedCompetitorId],
  );

  const selectedLaps = useMemo(
    () => detail?.laps.filter((lap) => lap.competitorId === selectedCompetitorId).sort((left, right) => (right.volta ?? -1) - (left.volta ?? -1)) ?? [],
    [detail, selectedCompetitorId],
  );

  const filteredStops = useMemo(
    () => detail?.stops.filter((stop) => stopFilter === 'all' || stop.status === stopFilter) ?? [],
    [detail, stopFilter],
  );

  const metrics = useMemo(() => {
    if (!detail) return null;
    const bestTimes = detail.competitors.map((competitor) => parseTimeMs(competitor.melhorVolta)).filter((value): value is number => value !== null);
    const totalLaps = detail.competitors.reduce((total, competitor) => total + (competitor.voltas ?? 0), 0);
    const penalties = detail.competitors.reduce((total, competitor) => total + (competitor.penaltyLaps ?? 0), 0);
    const bestRecovery = Math.max(0, ...detail.competitors.map((competitor) => competitor.positionRecovery ?? 0));
    return {
      bestLap: bestTimes.length ? `${Math.floor(Math.min(...bestTimes) / 60_000)}:${String(Math.floor((Math.min(...bestTimes) % 60_000) / 1_000)).padStart(2, '0')}.${String(Math.min(...bestTimes) % 1_000).padStart(3, '0')}` : '—',
      totalLaps,
      penalties,
      bestRecovery,
    };
  }, [detail]);

  if (loading) {
    return <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 text-sm text-zinc-400">Carregando detalhe completo da corrida...</div>;
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <a className="inline-flex items-center gap-2 text-sm font-semibold text-brand-300 hover:text-brand-200" href="/admin/resultados">
          <ArrowLeft aria-hidden="true" size={16} /> Voltar para resultados
        </a>
        <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-5 text-sm text-red-200" role="alert">
          {error ?? 'Corrida não encontrada.'}
        </div>
      </div>
    );
  }

  const { race } = detail;

  return (
    <section className="space-y-6 pb-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <a className="inline-flex items-center gap-2 text-sm font-semibold text-brand-300 hover:text-brand-200" href="/admin/resultados">
            <ArrowLeft aria-hidden="true" size={16} /> Voltar para resultados
          </a>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <p className="text-xs font-black uppercase tracking-[.18em] text-brand-300">Detalhe completo da corrida</p>
            {statusBadge(detail)}
          </div>
          <h2 className="mt-2 text-3xl font-black text-[var(--admin-text)]">{race.nome}</h2>
          <p className="mt-2 text-sm text-zinc-400">
            #{race.id} · {race.tipo ?? 'Tipo não informado'} · {race.participantes} participantes
          </p>
        </div>
        <Button onClick={() => void load()} variant="ghost" title="Atualizar detalhe">
          <RefreshCw aria-hidden="true" size={16} /> Atualizar
        </Button>
      </div>

      <Card className="p-5">
        <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-xs uppercase tracking-wider text-zinc-500">Evento</p><p className="mt-1 text-zinc-100">{race.evento ?? '—'}</p></div>
          <div><p className="text-xs uppercase tracking-wider text-zinc-500">Grupo</p><p className="mt-1 text-zinc-100">{race.grupo ?? '—'}</p></div>
          <div><p className="text-xs uppercase tracking-wider text-zinc-500">Pista</p><p className="mt-1 text-zinc-100">{race.pista ?? '—'}</p></div>
          <div><p className="text-xs uppercase tracking-wider text-zinc-500">Início</p><p className="mt-1 text-zinc-100">{formatDate(race.inicio)}</p></div>
          <div><p className="text-xs uppercase tracking-wider text-zinc-500">Encerramento</p><p className="mt-1 text-zinc-100">{formatDate(race.encerradaEm)}</p></div>
          <div><p className="text-xs uppercase tracking-wider text-zinc-500">Duração registrada</p><p className="mt-1 text-zinc-100">{race.duracaoEncerramento ?? '—'}</p></div>
          <div><p className="text-xs uppercase tracking-wider text-zinc-500">Volta final</p><p className="mt-1 text-zinc-100">{race.voltaFinal ?? '—'}</p></div>
          <div><p className="text-xs uppercase tracking-wider text-zinc-500">Tempo final</p><p className="mt-1 text-zinc-100">{race.tempoFinal ?? race.tempoTotal ?? '—'}</p></div>
          <div><p className="text-xs uppercase tracking-wider text-zinc-500">Tipo encerramento</p><p className="mt-1 text-zinc-100">{race.tipoEncerramento ?? '—'}</p></div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric detail={`${detail.competitors.length} karts classificados no registro`} label="Participantes" value={formatInteger(race.participantes)} />
        <Metric detail={`${formatInteger(metrics?.totalLaps ?? 0)} passagens somadas`} label="Voltas registradas" value={formatInteger(metrics?.totalLaps ?? 0)} />
        <Metric detail="Melhor volta normal da corrida" label="Melhor tempo" value={metrics?.bestLap ?? '—'} />
        <Metric detail={metrics?.bestRecovery ? `Maior ganho: +${metrics.bestRecovery} posições` : 'Nenhum ganho registrado'} label="Punições / recuperação" value={metrics?.penalties ? `+${metrics.penalties} voltas` : 'Nenhuma'} />
      </div>

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <ClipboardList aria-hidden="true" className="mt-0.5 text-brand-300" size={18} />
          <div>
            <h3 className="font-bold text-[var(--admin-text)]">Observações da prova</h3>
            <p className="mt-1 text-sm text-zinc-400">{race.observacao ?? 'Nenhuma observação registrada no LapTime.'}</p>
            <p className="mt-3 text-xs text-zinc-500">Paradas válidas: mínimo de 7:00.000. Registros de 4:00.000 a 6:59.999 são exibidos como errados e não completam a obrigação. Cada parada faltante ou excedente gera 7 voltas de punição.</p>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-3">
        {([
          ['classification', <Trophy aria-hidden="true" size={15} />, 'Classificação final'],
          ['stops', <Flag aria-hidden="true" size={15} />, `Paradas (${detail.stops.length})`],
          ['history', <History aria-hidden="true" size={15} />, 'Histórico de tempos'],
        ] as const).map(([key, icon, label]) => (
          <button
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${activeTab === key ? 'bg-brand-500 text-zinc-950' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}`}
            key={key}
            onClick={() => setActiveTab(key)}
            type="button"
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {activeTab === 'classification' ? (
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-sm text-zinc-400"><BarChart3 aria-hidden="true" size={16} /> Classificação consolidada com métricas de ritmo, paradas e penalidades.</div>
          <ClassificationTable competitors={detail.competitors} />
          <Card className="overflow-hidden">
            <div className="border-b border-zinc-800 px-4 py-3"><h3 className="font-bold text-[var(--admin-text)]">Punições e observações por kart</h3></div>
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-left text-sm">
                <thead className="border-b border-zinc-800 bg-zinc-950/60"><tr>{['Kart', 'Piloto / equipe', 'Paradas válidas', 'Faltam', 'Erradas', 'Fora da janela', 'Punição'].map((label) => <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500" key={label}>{label}</th>)}</tr></thead>
                <tbody>{detail.competitors.map((competitor) => <tr className="border-b border-zinc-800/60 last:border-0" key={competitor.id}><td className="px-4 py-3 text-zinc-200">{competitor.numero ?? '—'}</td><td className="px-4 py-3 font-semibold text-zinc-100">{competitor.nome}</td><td className="px-4 py-3 text-emerald-300">{competitor.pitStops.mandatory}/{competitor.pitStops.required}</td><td className="px-4 py-3 text-amber-300">{competitor.pitStops.remaining}</td><td className="px-4 py-3 text-amber-300">{competitor.pitStops.short}</td><td className="px-4 py-3 text-red-300">{competitor.pitStops.outsideWindow}</td><td className="px-4 py-3 font-bold text-red-300">{competitor.penaltyLaps ? `+${competitor.penaltyLaps} voltas` : 'Nenhuma'}</td></tr>)}</tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === 'stops' ? (
        <Card className="overflow-hidden">
          <div className="flex flex-col justify-between gap-3 border-b border-zinc-800 px-4 py-4 sm:flex-row sm:items-center">
            <div><h3 className="font-bold text-[var(--admin-text)]">Paradas e registros de box</h3><p className="mt-1 text-xs text-zinc-500">Inclui paradas válidas, adicionais, erradas e fora da janela.</p></div>
            <select aria-label="Filtrar paradas" className={inputClassName} onChange={(event) => setStopFilter(event.target.value as StopFilter)} value={stopFilter}>
              <option value="all">Todas as paradas</option><option value="mandatory">Obrigatórias válidas</option><option value="short">Erradas 4:00-6:59</option><option value="additional">Adicionais</option><option value="outside-window">Fora da janela</option><option value="invalid">Inválidas</option>
            </select>
          </div>
          <div className="overflow-x-auto"><table className="min-w-[1050px] w-full text-left text-sm"><thead className="border-b border-zinc-800 bg-zinc-950/60"><tr>{['Kart', 'Piloto / equipe', 'Volta', 'Tempo da parada', 'Tempo de prova', 'Posição', 'Classificação'].map((label) => <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500" key={label}>{label}</th>)}</tr></thead><tbody>{filteredStops.length ? filteredStops.map((stop) => <tr className="border-b border-zinc-800/60 last:border-0" key={`${stop.competitorId}-${stop.id}`}><td className="px-4 py-3 text-zinc-300">{stop.kart ?? '—'}</td><td className="px-4 py-3 font-semibold text-zinc-100">{stop.nome}</td><td className="px-4 py-3 text-zinc-300">{stop.lap ?? '—'}</td><td className="px-4 py-3 text-zinc-200">{stop.stopTime ?? '—'}</td><td className="px-4 py-3 text-zinc-300">{stop.raceTime ?? '—'}</td><td className="px-4 py-3 text-zinc-400">{stop.position ?? '—'}</td><td className="px-4 py-3"><Badge variant={stopStatusVariants[stop.status]}>{stop.status === 'mandatory' && stop.mandatoryNumber ? `${stopStatusLabels[stop.status]} ${stop.mandatoryNumber}` : stopStatusLabels[stop.status]}</Badge></td></tr>) : <tr><td className="px-4 py-10 text-center text-sm text-zinc-500" colSpan={7}>Nenhum registro para este filtro.</td></tr>}</tbody></table></div>
        </Card>
      ) : null}

      {activeTab === 'history' ? (
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h3 className="font-bold text-[var(--admin-text)]">Histórico de tempos do kart</h3><p className="mt-1 text-xs text-zinc-500">Selecione um kart para consultar cada passagem, tempo total, posição e status.</p></div><select aria-label="Selecionar kart" className={`${inputClassName} sm:min-w-[280px]`} onChange={(event) => setSelectedCompetitorId(event.target.value)} value={selectedCompetitorId}>{detail.competitors.map((competitor) => <option key={competitor.id} value={competitor.id}>{competitor.numero ?? '—'} · {competitor.nome}</option>)}</select></div>
            {selectedCompetitor ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><Metric label="Kart" value={selectedCompetitor.numero ?? '—'} /><Metric label="Voltas" value={String(selectedCompetitor.voltas ?? 0)} /><Metric label="Melhor tempo" value={selectedCompetitor.melhorVolta ?? '—'} /><Metric label="Média" value={selectedCompetitor.averageLap ?? '—'} /><Metric label="Pior tempo" value={selectedCompetitor.worstLap ?? '—'} /><Metric label="Recuperação" value={recoveryText(selectedCompetitor.positionRecovery)} /></div> : null}
          </Card>
          <Card className="overflow-hidden"><div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-4"><TimerReset aria-hidden="true" className="text-brand-300" size={17} /><h3 className="font-bold text-[var(--admin-text)]">Volta a volta · {selectedCompetitor?.nome ?? '—'}</h3><span className="ml-auto text-xs text-zinc-500">{selectedLaps.length} registros</span></div><div className="max-h-[720px] overflow-auto"><table className="min-w-[850px] w-full text-left text-sm"><thead className="sticky top-0 border-b border-zinc-800 bg-zinc-950"><tr>{['Volta', 'Tempo da volta', 'Tempo total', 'Posição', 'Status', 'Bandeira'].map((label) => <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500" key={label}>{label}</th>)}</tr></thead><tbody>{selectedLaps.map((lap) => { const status = lapStatus(lap); return <tr className="border-b border-zinc-800/60 last:border-0" key={lap.id}><td className="px-4 py-3 font-semibold text-zinc-100">{lap.volta ?? '—'}</td><td className="px-4 py-3 text-zinc-300">{lap.tempoVolta ?? '—'}</td><td className="px-4 py-3 text-zinc-300">{lap.tempoTotal ?? '—'}</td><td className="px-4 py-3 text-zinc-400">{lap.posicao ?? '—'}</td><td className="px-4 py-3"><Badge variant={status.variant}>{status.label}</Badge></td><td className="px-4 py-3 text-zinc-500">{lap.bandeira ?? '—'}</td></tr>; })}</tbody></table></div></Card>
        </div>
      ) : null}

      {detail.stops.some((stop) => stop.status === 'short' || stop.status === 'outside-window' || stop.status === 'invalid') ? <div className="flex items-start gap-3 rounded-xl border border-amber-800/50 bg-amber-950/20 p-4 text-sm text-amber-200"><AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={17} /><p>Existem registros de parada que não completam a obrigação. Consulte a aba “Paradas” para identificar volta, duração, tempo de prova e motivo.</p></div> : null}
    </section>
  );
}
