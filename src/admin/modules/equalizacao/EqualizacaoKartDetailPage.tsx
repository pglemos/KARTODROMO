'use client';

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Database,
  History,
  RefreshCw,
  Save,
  Timer,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  EQUALIZATION_TOLERANCE_MS,
  KART_CATEGORY_LABELS,
  equalizationDeltaMs,
  equalizationState,
  kartCategoryFromPlate,
  normalizedKartNumber,
  targetForKart,
} from '@/lib/equalizacao/kart';
import { formatDurationMs } from '@/lib/livetime/time-format';
import { useAuth } from '@/src/admin/auth/AuthContext';
import { canAccess } from '@/src/admin/lib/rbac';
import { Badge, type BadgeVariant } from '@/src/admin/ui/Badge';
import { Button } from '@/src/admin/ui/Button';
import { Card } from '@/src/admin/ui/Card';
import { FormField } from '@/src/admin/ui/FormField';
import { useToast } from '@/src/admin/ui/useToast';
import {
  captureEqualizacaoAfter,
  captureEqualizacaoBefore,
  fetchEqualizacaoLive,
  getKart,
  getKartHistory,
  listKartEqualizations,
  startEqualizacaoSession,
  updateKartPhysicalData,
  type EqualizacaoAfterResponse,
} from './equalizacao.api';
import type {
  Kart,
  KartEqualization,
  KartEqualizationCapture,
  KartEqualizationSession,
  KartHistoryResponse,
} from './equalizacao.types';
import type { EqualizacaoLiveCandidate, EqualizacaoLiveSnapshot } from '@/lib/equalizacao/equalizacao-live.types';

type DetailTab = 'painel' | 'historico' | 'auditoria';
type PhysicalForm = {
  chassi_numero: string;
  redutor_antigo: string;
  redutor_novo: string;
};

const inputClassName =
  'h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20';

const formatTime = (milliseconds: number | null | undefined): string =>
  milliseconds === null || milliseconds === undefined ? '—' : formatDurationMs(milliseconds) || '—';

const formatDate = (value: string | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(date);
};

const deltaText = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—';
  if (value === 0) return 'No alvo';
  return `${value > 0 ? '+' : ''}${formatTime(Math.abs(value))}`;
};

const statusLabel: Record<string, string> = {
  aprovada: 'Aprovada',
  ajustar: 'Ajustar kart',
  reteste: 'Reteste',
  cancelada: 'Cancelada',
};

const statusVariant: Record<string, BadgeVariant> = {
  aprovada: 'emerald',
  ajustar: 'amber',
  reteste: 'red',
  cancelada: 'zinc',
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Não foi possível concluir a operação.';

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail?: string; icon: typeof Timer }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="flex items-center justify-between gap-3"><span className="text-[10px] font-bold uppercase tracking-[.1em] text-zinc-500">{label}</span><Icon aria-hidden="true" className="text-brand-400" size={16} /></div>
      <strong className="mt-2 block text-xl tabular-nums text-zinc-50">{value}</strong>
      {detail ? <span className="mt-1 block text-xs text-zinc-500">{detail}</span> : null}
    </div>
  );
}

function LiveStatus({ status }: { status: EqualizacaoLiveSnapshot['status'] }) {
  if (status === 'online') return <Badge variant="emerald">Tomada em andamento</Badge>;
  if (status === 'no-qualifying') return <Badge variant="amber">Aguardando tomada</Badge>;
  return <Badge variant="red">Fonte indisponível</Badge>;
}

function CaptureAction({
  kart,
  candidate,
  capture,
  session,
  canWrite,
  busy,
  onBefore,
  onAfter,
}: {
  kart: Kart;
  candidate: EqualizacaoLiveCandidate | undefined;
  capture: KartEqualizationCapture | undefined;
  session: KartEqualizationSession | null;
  canWrite: boolean;
  busy: boolean;
  onBefore: (kart: Kart, candidate: EqualizacaoLiveCandidate) => void;
  onAfter: (capture: KartEqualizationCapture) => void;
}) {
  if (capture?.status === 'completa') return <Badge variant="emerald">Antes e depois registrados</Badge>;
  if (!canWrite || !session || session.status !== 'aberta' || !candidate) return <span className="text-xs text-zinc-600">Aguardando condição</span>;
  if (capture) return <Button loading={busy} onClick={() => onAfter(capture)} variant="secondary"><CheckCircle2 aria-hidden="true" size={14} />Capturar depois</Button>;
  return <Button loading={busy} onClick={() => onBefore(kart, candidate)}><Zap aria-hidden="true" size={14} />Capturar antes</Button>;
}

export const EqualizacaoKartDetailPage = ({ kartId }: { kartId: string }) => {
  const { role } = useAuth();
  const toast = useToast();
  const canWrite = canAccess(role, 'equalizacao') && (role === 'owner' || role === 'admin');
  const [kart, setKart] = useState<Kart | null>(null);
  const [equalizations, setEqualizations] = useState<KartEqualization[]>([]);
  const [history, setHistory] = useState<KartHistoryResponse | null>(null);
  const [live, setLive] = useState<EqualizacaoLiveSnapshot | null>(null);
  const [session, setSession] = useState<KartEqualizationSession | null>(null);
  const [captures, setCaptures] = useState<KartEqualizationCapture[]>([]);
  const [physical, setPhysical] = useState<PhysicalForm>({ chassi_numero: '', redutor_antigo: '', redutor_novo: '' });
  const [tab, setTab] = useState<DetailTab>('painel');
  const [loading, setLoading] = useState(true);
  const [liveLoading, setLiveLoading] = useState(false);
  const [savingPhysical, setSavingPhysical] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const autoSessionRace = useRef<string | null>(null);
  const liveRequest = useRef(false);

  const loadKartData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [kartData, measurements] = await Promise.all([getKart(kartId), listKartEqualizations(kartId)]);
      setKart(kartData);
      setPhysical({
        chassi_numero: kartData.chassi_numero || '',
        redutor_antigo: kartData.redutor_antigo || '',
        redutor_novo: kartData.redutor_novo || '',
      });
      setEqualizations(measurements);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [kartId]);

  const loadLive = useCallback(async (silent = false) => {
    if (liveRequest.current) return;
    liveRequest.current = true;
    if (!silent) setLiveLoading(true);
    setLiveError(null);
    try {
      const snapshot = await fetchEqualizacaoLive();
      setLive(snapshot);
      if (snapshot.status === 'online' && snapshot.race) {
        if (!(session && session.racing_id === snapshot.race.id) && autoSessionRace.current !== snapshot.race.id && canWrite) {
          autoSessionRace.current = snapshot.race.id;
          const started = await startEqualizacaoSession();
          setSession(started.session);
          setCaptures([]);
        }
      }
    } catch (loadError) {
      const message = errorMessage(loadError);
      setLiveError(message);
      if (!silent) toast.error(message);
    } finally {
      liveRequest.current = false;
      setLiveLoading(false);
    }
  }, [canWrite, session, toast]);

  useEffect(() => {
    void loadKartData();
  }, [loadKartData]);

  useEffect(() => {
    void loadLive();
    const timer = window.setInterval(() => {
      if (!document.hidden) void loadLive(true);
    }, 3_000);
    return () => window.clearInterval(timer);
  }, [loadLive]);

  useEffect(() => {
    if (tab !== 'historico' || !kart || history || historyLoading) return;
    setHistoryLoading(true);
    void getKartHistory(kart)
      .then(setHistory)
      .catch((historyError) => toast.error(errorMessage(historyError)))
      .finally(() => setHistoryLoading(false));
  }, [history, historyLoading, kart, tab, toast]);

  const currentCandidate = useMemo(() => {
    if (!kart || !live) return undefined;
    const number = normalizedKartNumber(kart.numero);
    return live.candidates.find((candidate) => normalizedKartNumber(candidate.kart) === number);
  }, [kart, live]);

  const currentCapture = captures.find((capture) => capture.kart_id === kart?.id);
  const target = targetForKart(kart?.numero);
  const state = kart ? equalizationState(kart.media_equalizacao_ms, kart.numero) : 'pendente';
  const category = kart ? kartCategoryFromPlate(kart.numero) : 'unknown';
  const lastMeasurement = equalizations[0];

  const savePhysical = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!kart || !canWrite) return;
    setSavingPhysical(true);
    try {
      const updated = await updateKartPhysicalData(kart.id, physical);
      setKart(updated);
      toast.success(`Identificação física do kart ${updated.numero} atualizada.`);
    } catch (saveError) {
      toast.error(errorMessage(saveError));
    } finally {
      setSavingPhysical(false);
    }
  };

  const handleBefore = async (selectedKart: Kart, candidate: EqualizacaoLiveCandidate) => {
    if (!session) return;
    setBusyAction(`before:${selectedKart.id}`);
    try {
      const response = await captureEqualizacaoBefore(session.id, selectedKart.id, candidate.competitorId);
      setCaptures((current) => [response.capture, ...current]);
      toast.success(`Tempo antes capturado automaticamente para o kart ${selectedKart.numero}.`);
    } catch (captureError) {
      toast.error(errorMessage(captureError));
    } finally {
      setBusyAction(null);
    }
  };

  const handleAfter = async (capture: KartEqualizationCapture) => {
    if (!session) return;
    setBusyAction(`after:${capture.id}`);
    try {
      const response: EqualizacaoAfterResponse = await captureEqualizacaoAfter(session.id, capture.id);
      setCaptures((current) => current.map((item) => item.id === capture.id ? response.capture : item));
      setEqualizations((current) => [response.measurement, ...current]);
      if (kart) setKart(await getKart(kart.id));
      toast.success('Tempo depois capturado e auditado pela cronometragem.');
    } catch (captureError) {
      toast.error(errorMessage(captureError));
    } finally {
      setBusyAction(null);
    }
  };

  const openSession = async () => {
    setBusyAction('session');
    try {
      const started = await startEqualizacaoSession();
      setLive(started.snapshot);
      setSession(started.session);
      setCaptures([]);
      autoSessionRace.current = started.session.racing_id;
      toast.success(started.reused ? 'Sessão de equalização retomada.' : 'Sessão de equalização iniciada automaticamente.');
    } catch (sessionError) {
      toast.error(errorMessage(sessionError));
    } finally {
      setBusyAction(null);
    }
  };

  if (loading) return <div className="py-16 text-center text-sm text-zinc-500">Carregando ficha real do kart...</div>;
  if (error || !kart) return <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-6 text-sm text-red-200">{error || 'Kart não encontrado.'}</div>;

  const chartRows = history?.rows.filter((row) => row.bestLapMs !== null).slice(0, 30) || [];
  const chartValues = chartRows.map((row) => row.bestLapMs as number);
  const chartMin = chartValues.length ? Math.min(...chartValues) : 0;
  const chartMax = chartValues.length ? Math.max(...chartValues) : 0;
  const chartRange = Math.max(1, chartMax - chartMin);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-100" href="/admin/equalizacao"><ArrowLeft aria-hidden="true" size={16} />Voltar para equalização</Link>
        <Button onClick={() => void Promise.all([loadKartData(), loadLive()])} variant="ghost" loading={liveLoading}><RefreshCw aria-hidden="true" size={15} />Atualizar</Button>
      </div>

      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div><p className="text-xs font-medium uppercase tracking-wider text-brand-400">Equalização · ficha do kart</p><h1 className="mt-1 text-2xl font-semibold text-zinc-50">Kart {kart.numero}</h1><p className="mt-1 text-sm text-zinc-400">{KART_CATEGORY_LABELS[category]} · chassi {kart.chassi_numero || 'não informado'}</p></div>
        <div className="flex flex-wrap items-center gap-2"><Badge variant={category === 'super' ? 'emerald' : category === 'indoor' ? 'blue' : 'red'}>{KART_CATEGORY_LABELS[category]}</Badge><Badge variant={state === 'equilibrado' ? 'emerald' : state === 'pendente' ? 'zinc' : 'amber'}>{state === 'equilibrado' ? 'Dentro do alvo' : state === 'pendente' ? 'Aguardando tomada' : 'Revisar equalização'}</Badge></div>
      </header>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-zinc-800 bg-zinc-950/30 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3"><span className={`mt-1 h-2.5 w-2.5 rounded-full ${live?.status === 'online' ? 'bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,.12)]' : 'bg-zinc-600'}`} /><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold text-zinc-50">Tomada de tempo em tempo real</h2>{live ? <LiveStatus status={live.status} /> : <Badge variant="zinc">Consultando LapTime</Badge>}</div><p className="mt-1 text-xs text-zinc-500">{live?.race ? `${live.race.nome}${live.race.tipo ? ` · ${live.race.tipo}` : ''}` : 'Nenhuma tomada de tempo identificada agora.'} · atualização {formatDate(live?.atualizadoEm)}</p></div></div>
          <div className="flex flex-wrap gap-2">{session ? <Badge variant={session.status === 'aberta' ? 'blue' : 'zinc'}>Sessão {session.status}</Badge> : null}{!session && live?.status === 'online' && canWrite ? <Button loading={busyAction === 'session'} onClick={() => void openSession()}><Zap aria-hidden="true" size={15} />Iniciar sessão</Button> : null}</div>
        </div>
        {liveError ? <div className="border-b border-red-900/50 bg-red-950/20 px-4 py-3 text-xs text-red-200">{liveError}</div> : null}
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Timer} label="Alvo da categoria" value={formatTime(target)} detail="Tempo médio esperado" /><Metric icon={Zap} label="Melhor ao vivo" value={currentCandidate?.melhorVolta || '—'} detail={currentCandidate?.piloto || 'Kart aguardando volta'} /><Metric icon={Clock3} label="Média ao vivo" value={currentCandidate?.mediaVolta || '—'} detail={currentCandidate ? `${currentCandidate.voltasValidas} voltas válidas` : 'Sem candidato'} /><Metric icon={Database} label="Última medição" value={formatTime(lastMeasurement?.media_ms)} detail={lastMeasurement ? formatDate(lastMeasurement.data) : 'Nenhuma captura'} /></div>
        <div className="border-t border-zinc-800 p-4"><div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><h3 className="text-sm font-semibold text-zinc-100">Escolha o kart na cronometragem</h3><p className="mt-1 text-xs text-zinc-500">Os tempos abaixo são somente leitura. Os botões gravam o instante observado no LapTime.</p></div><span className="text-xs text-zinc-500">{live?.candidates.length || 0} kart(s) identificados</span></div><div className="mt-4 overflow-x-auto"><table className="min-w-[920px] w-full text-left"><thead className="border-b border-zinc-800"><tr>{['Kart', 'Piloto completo', 'Melhor volta', 'Média', 'Voltas válidas', 'Última passagem', 'Registro'].map((label) => <th className="whitespace-nowrap px-3 py-3 text-[10px] font-bold uppercase tracking-[.1em] text-zinc-500" key={label}>{label}</th>)}</tr></thead><tbody>{live?.candidates.map((candidate) => { const candidateKart = normalizedKartNumber(candidate.kart); const isThisKart = candidateKart === normalizedKartNumber(kart.numero); const liveKart = isThisKart ? kart : { ...kart, id: `live-${candidate.kart}`, numero: candidate.kart } as Kart; const capture = isThisKart ? currentCapture : undefined; return <tr className={isThisKart ? 'border-b border-brand-800/50 bg-brand-950/20' : 'border-b border-zinc-800/60'} key={candidate.competitorId}><td className="px-3 py-3"><strong className="text-sm text-zinc-100">{candidate.kart}</strong>{isThisKart ? <span className="ml-2 text-[10px] font-bold uppercase text-brand-300">Este kart</span> : null}</td><td className="px-3 py-3 text-sm text-zinc-200">{candidate.piloto}</td><td className="px-3 py-3 text-sm tabular-nums text-zinc-100">{candidate.melhorVolta || '—'}</td><td className="px-3 py-3 text-sm tabular-nums text-zinc-300">{candidate.mediaVolta || '—'}<span className="mt-1 block text-[11px] text-zinc-600">± {candidate.desvio || '—'}</span></td><td className="px-3 py-3 text-sm text-zinc-300">{candidate.voltasValidas}</td><td className="px-3 py-3 text-xs text-zinc-400">Volta {candidate.ultimaVolta ?? '—'} · {candidate.tempoCorrida || '—'}</td><td className="px-3 py-3"><CaptureAction busy={busyAction === `before:${kart.id}` || busyAction === `after:${capture?.id}`} canWrite={canWrite && isThisKart} candidate={candidate} capture={capture} kart={liveKart} onAfter={handleAfter} onBefore={handleBefore} session={session} /></td></tr>; })}{!live?.candidates.length ? <tr><td className="px-3 py-10 text-center text-sm text-zinc-500" colSpan={7}>Aguardando uma tomada de tempo em andamento no LapTime.</td></tr> : null}</tbody></table></div></div>
      </Card>

      <div className="flex gap-1 overflow-x-auto border-b border-zinc-800"><button className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${tab === 'painel' ? 'border-brand-400 text-brand-300' : 'border-transparent text-zinc-500 hover:text-zinc-200'}`} onClick={() => setTab('painel')} type="button">Painel</button><button className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${tab === 'historico' ? 'border-brand-400 text-brand-300' : 'border-transparent text-zinc-500 hover:text-zinc-200'}`} onClick={() => setTab('historico')} type="button">Histórico de melhores voltas</button><button className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${tab === 'auditoria' ? 'border-brand-400 text-brand-300' : 'border-transparent text-zinc-500 hover:text-zinc-200'}`} onClick={() => setTab('auditoria')} type="button">Auditoria da tomada</button></div>

      {tab === 'painel' ? <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <Card className="p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-zinc-50">Decisão de equalização</h2><p className="mt-1 text-xs text-zinc-500">Comparação da média automática com o alvo da categoria.</p></div><AlertTriangle aria-hidden="true" className={state === 'equilibrado' ? 'text-emerald-300' : 'text-amber-300'} size={19} /></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric icon={Timer} label="Média registrada" value={formatTime(kart.media_equalizacao_ms)} detail={deltaText(equalizationDeltaMs(kart.media_equalizacao_ms, kart.numero))} /><Metric icon={Zap} label="Melhor registrada" value={formatTime(kart.melhor_equalizacao_ms)} detail={`Desvio ${formatTime(kart.desvio_equalizacao_ms)}`} /><Metric icon={History} label="Última captura" value={formatDate(kart.ultima_equalizacao)} detail={kart.ultimo_piloto_equalizacao || 'Piloto não informado'} /></div><div className={`mt-5 rounded-lg border p-4 ${state === 'equilibrado' ? 'border-emerald-900/60 bg-emerald-950/20' : 'border-amber-900/60 bg-amber-950/20'}`}><strong className="block text-sm text-zinc-100">{state === 'equilibrado' ? 'Kart dentro da tolerância' : 'Kart requer decisão da manutenção'}</strong><p className="mt-1 text-xs leading-5 text-zinc-400">Alvo {formatTime(target)} · tolerância ±{formatTime(EQUALIZATION_TOLERANCE_MS)} · última fonte {lastMeasurement?.fonte === 'cronometragem' ? 'cronometragem LapTime' : 'histórico legado'}.</p></div></Card>
        <Card className="p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-zinc-50">Identificação física</h2><p className="mt-1 text-xs text-zinc-500">Somente chassi e redutores podem ser atualizados aqui.</p></div><Database aria-hidden="true" className="text-brand-400" size={18} /></div><form className="mt-5 grid gap-4" onSubmit={savePhysical}><FormField htmlFor="equalizacao-numero" label="Número do kart"><input className={`${inputClassName} opacity-60`} id="equalizacao-numero" readOnly value={kart.numero} /></FormField><FormField htmlFor="equalizacao-chassi" label="Número do chassi"><input className={inputClassName} disabled={!canWrite} id="equalizacao-chassi" onChange={(event) => setPhysical((current) => ({ ...current, chassi_numero: event.target.value }))} value={physical.chassi_numero} /></FormField><div className="grid gap-4 sm:grid-cols-2"><FormField htmlFor="equalizacao-redutor-antigo" label="Redutor antigo"><input className={inputClassName} disabled={!canWrite} id="equalizacao-redutor-antigo" onChange={(event) => setPhysical((current) => ({ ...current, redutor_antigo: event.target.value }))} value={physical.redutor_antigo} /></FormField><FormField htmlFor="equalizacao-redutor-novo" label="Redutor novo"><input className={inputClassName} disabled={!canWrite} id="equalizacao-redutor-novo" onChange={(event) => setPhysical((current) => ({ ...current, redutor_novo: event.target.value }))} value={physical.redutor_novo} /></FormField></div><div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-xs text-zinc-400">Sensor LapTime <strong className="text-zinc-200">{kart.sensor_numero_fonte || kart.sensor_numero || 'não informado'}</strong><span className="mt-1 block text-[11px] text-zinc-600">Somente leitura · identidade sincronizada da cronometragem.</span></div>{canWrite ? <Button loading={savingPhysical} type="submit"><Save aria-hidden="true" size={15} />Salvar identificação</Button> : null}</form></Card>
      </div> : null}

      {tab === 'historico' ? <div className="grid gap-5"><Card className="overflow-hidden"><div className="flex items-center gap-3 border-b border-zinc-800 p-4"><History aria-hidden="true" className="text-brand-400" size={18} /><div><h2 className="text-base font-semibold text-zinc-50">Melhores voltas por corrida</h2><p className="mt-1 text-xs text-zinc-500">Identidade consultada pelo sensor e, quando necessário, pela placa.</p></div></div>{historyLoading ? <div className="p-8 text-center text-sm text-zinc-500">Consultando histórico real do LapTime...</div> : history ? <div className="p-4"><div className="flex flex-wrap gap-2">{([7, 15, 30, 60] as const).map((size) => { const window = history.windows[String(size) as '7' | '15' | '30' | '60']; return <div className="min-w-32 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3" key={size}><span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Últimas {size}</span><strong className="mt-1 block text-lg text-zinc-100">{formatTime(window?.bestLapMs)}</strong><span className="mt-1 block text-[11px] text-zinc-500">Média {formatTime(window?.averageBestLapMs)}</span></div>; })}</div><div className="mt-5 flex h-48 items-end gap-2 overflow-x-auto border-b border-zinc-800 pb-1">{chartRows.map((row) => { const value = row.bestLapMs as number; const height = 22 + Math.round(((chartMax - value) / chartRange) * 78); return <div className="flex h-full min-w-10 flex-1 flex-col items-center justify-end gap-1" key={row.raceId}><span className="text-[9px] tabular-nums text-zinc-400">{formatTime(value)}</span><div className="w-full max-w-9 rounded-t bg-brand-500/70" style={{ height: `${height}%` }} title={`${row.raceName}: ${formatTime(value)}`} /><span className="max-w-14 truncate text-[9px] text-zinc-600">{new Date(row.raceDate).toLocaleDateString('pt-BR')}</span></div>; })}{!chartRows.length ? <div className="flex w-full items-center justify-center text-sm text-zinc-500">Nenhuma melhor volta encontrada.</div> : null}</div><div className="mt-5 overflow-x-auto"><table className="min-w-[760px] w-full text-left"><thead className="border-b border-zinc-800"><tr>{['Corrida', 'Data', 'Piloto', 'Identidade', 'Melhor volta', 'Voltas'].map((label) => <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500" key={label}>{label}</th>)}</tr></thead><tbody>{history.rows.slice(0, 60).map((row) => <tr className="border-b border-zinc-800/60" key={row.raceId}><td className="px-3 py-3 text-sm text-zinc-200">{row.raceName}</td><td className="px-3 py-3 text-xs text-zinc-400">{formatDate(row.raceDate)}</td><td className="px-3 py-3 text-xs text-zinc-400">{row.driver || '—'}</td><td className="px-3 py-3"><Badge variant={row.matchedBy === 'sensor' ? 'emerald' : 'amber'}>{row.matchedBy === 'sensor' ? `Sensor ${row.sensor || '—'}` : `Placa ${row.plate || kart.numero}`}</Badge></td><td className="px-3 py-3 text-sm font-semibold tabular-nums text-zinc-100">{row.bestLap || formatTime(row.bestLapMs)}</td><td className="px-3 py-3 text-xs text-zinc-400">{row.laps ?? '—'}</td></tr>)}{!history.rows.length ? <tr><td className="px-3 py-10 text-center text-sm text-zinc-500" colSpan={6}>Nenhum histórico encontrado.</td></tr> : null}</tbody></table></div></div> : null}</Card><Card className="p-5"><h2 className="text-base font-semibold text-zinc-50">Equalizações registradas</h2><div className="mt-4 grid gap-2">{equalizations.map((item) => <div className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 sm:flex-row sm:items-center sm:justify-between" key={item.id}><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-zinc-200">{item.piloto}</strong><Badge variant={statusVariant[item.status] || 'zinc'}>{statusLabel[item.status] || item.status}</Badge><Badge variant={item.fonte === 'cronometragem' ? 'blue' : 'zinc'}>{item.fonte === 'cronometragem' ? 'Automática' : 'Legado'}</Badge></div><span className="mt-1 block text-xs text-zinc-500">{formatDate(item.data)} · {item.traco}</span></div><div className="text-left sm:text-right"><strong className="block text-sm tabular-nums text-zinc-100">{formatTime(item.media_ms)}</strong><span className="text-xs text-zinc-500">Melhor {formatTime(item.melhor_volta_ms)}</span></div></div>)}{!equalizations.length ? <p className="py-8 text-center text-sm text-zinc-500">Nenhuma equalização registrada.</p> : null}</div></Card></div> : null}

      {tab === 'auditoria' ? <Card className="overflow-hidden"><div className="flex items-center gap-3 border-b border-zinc-800 p-4"><Clock3 aria-hidden="true" className="text-brand-400" size={18} /><div><h2 className="text-base font-semibold text-zinc-50">Auditoria da tomada</h2><p className="mt-1 text-xs text-zinc-500">Cada tempo foi capturado do LapTime, com corrida, competidor e instante.</p></div></div><div className="overflow-x-auto"><table className="min-w-[1050px] w-full text-left"><thead className="border-b border-zinc-800 bg-zinc-950/30"><tr>{['Kart', 'Piloto', 'Antes', 'Depois', 'Voltas', 'Corrida', 'Fonte', 'Responsável'].map((label) => <th className="whitespace-nowrap px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500" key={label}>{label}</th>)}</tr></thead><tbody>{captures.map((capture) => <tr className="border-b border-zinc-800/60" key={capture.id}><td className="px-3 py-3 text-sm font-semibold text-zinc-100">{capture.numero_kart}</td><td className="px-3 py-3 text-sm text-zinc-200">{capture.piloto_depois || capture.piloto_antes}<span className="mt-1 block text-[11px] text-zinc-500">{formatDate(capture.capturado_depois_em || capture.capturado_antes_em)}</span></td><td className="px-3 py-3 text-sm tabular-nums text-zinc-300">{formatTime(capture.tempo_antes_ms)}<span className="mt-1 block text-[11px] text-zinc-500">Média {formatTime(capture.media_antes_ms)}</span></td><td className="px-3 py-3 text-sm tabular-nums text-zinc-100">{formatTime(capture.tempo_depois_ms)}<span className="mt-1 block text-[11px] text-zinc-500">Média {formatTime(capture.media_depois_ms)}</span></td><td className="px-3 py-3 text-xs text-zinc-400">{capture.voltas_antes} → {capture.voltas_depois ?? '—'}</td><td className="px-3 py-3 text-xs text-zinc-400">{capture.racing_id}</td><td className="px-3 py-3"><Badge variant="blue">{capture.fonte}</Badge></td><td className="px-3 py-3 text-xs text-zinc-400">{capture.responsavel || '—'}</td></tr>)}{!captures.length ? <tr><td className="px-3 py-12 text-center text-sm text-zinc-500" colSpan={8}>Nenhuma captura nesta sessão.</td></tr> : null}</tbody></table></div></Card> : null}
    </div>
  );
};
