'use client';

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Gauge,
  RefreshCw,
  Search,
  Timer,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  EQUALIZATION_TOLERANCE_MS,
  KART_CATEGORY_LABELS,
  KART_CATEGORY_TARGETS_MS,
  equalizationDeltaMs,
  equalizationState,
  kartCategoryFromPlate,
  summarizeCategory,
  targetForKart,
  type KartCategory,
} from '@/lib/equalizacao/kart';
import { formatDurationMs } from '@/lib/livetime/time-format';
import { useAuth } from '@/src/admin/auth/AuthContext';
import { Badge, type BadgeVariant } from '@/src/admin/ui/Badge';
import { Button } from '@/src/admin/ui/Button';
import { Card } from '@/src/admin/ui/Card';
import { PageHeader } from '@/src/admin/ui/PageHeader';
import { Pagination } from '@/src/admin/ui/Pagination';
import { StatCard } from '@/src/admin/ui/StatCard';
import { useToast } from '@/src/admin/ui/useToast';
import { listKarts } from './equalizacao.api';
import type { Kart } from './equalizacao.types';

type CategoryFilter = 'all' | KartCategory;
type StateFilter = 'all' | ReturnType<typeof equalizationState>;

const PAGE_SIZE = 12;

const stateLabel: Record<ReturnType<typeof equalizationState>, string> = {
  equilibrado: 'Dentro do alvo',
  ajustar: 'Ajustar kart',
  critico: 'Ação imediata',
  pendente: 'Aguardando tomada',
  fora_do_padrao: 'Conferir placa',
};

const stateVariant: Record<ReturnType<typeof equalizationState>, BadgeVariant> = {
  equilibrado: 'emerald',
  ajustar: 'amber',
  critico: 'red',
  pendente: 'zinc',
  fora_do_padrao: 'red',
};

const categoryVariant: Record<KartCategory, BadgeVariant> = {
  indoor: 'blue',
  super: 'emerald',
  unknown: 'red',
};

const formatTime = (milliseconds: number | null | undefined): string =>
  milliseconds === null || milliseconds === undefined ? '—' : formatDurationMs(milliseconds) || '—';

const formatDelta = (milliseconds: number | null | undefined): string => {
  if (milliseconds === null || milliseconds === undefined) return 'Sem medição';
  if (milliseconds === 0) return 'No alvo';
  return `${milliseconds > 0 ? '+' : ''}${formatTime(Math.abs(milliseconds))}`;
};

const formatDate = (value: string | null | undefined): string => {
  if (!value) return 'Ainda não medido';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Data inválida'
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
};

const getAlertText = (kart: Kart): string => {
  const state = equalizationState(kart.media_equalizacao_ms, kart.numero);
  if (state === 'equilibrado') return 'Pronto para comparação';
  if (state === 'critico') return 'Média distante do alvo';
  if (state === 'ajustar') return 'Revisar equalização';
  if (state === 'fora_do_padrao') return 'Placa fora de 01–200';
  return 'Sem captura automática';
};

const getPhysicalAlert = (kart: Kart): string | null => {
  if (!kart.chassi_numero?.trim()) return 'Chassi sem identificação';
  if (!kart.redutor_novo?.trim()) return 'Redutor novo não informado';
  return null;
};

function CategoryBadge({ numero }: { numero: string }) {
  const category = kartCategoryFromPlate(numero);
  return <Badge variant={categoryVariant[category]}>{KART_CATEGORY_LABELS[category]}</Badge>;
}

function StateBadge({ kart }: { kart: Kart }) {
  const state = equalizationState(kart.media_equalizacao_ms, kart.numero);
  return <Badge variant={stateVariant[state]}>{stateLabel[state]}</Badge>;
}

function Delta({ kart }: { kart: Kart }) {
  const delta = equalizationDeltaMs(kart.media_equalizacao_ms, kart.numero);
  if (delta === null) return <span className="text-xs text-zinc-500">Aguardando captura</span>;
  return (
    <span className={delta === 0 ? 'text-xs text-emerald-300' : delta > 0 ? 'text-xs text-amber-300' : 'text-xs text-sky-300'}>
      {formatDelta(delta)} do alvo
    </span>
  );
}

export const EqualizacaoListPage = () => {
  useAuth();
  const toast = useToast();
  const [karts, setKarts] = useState<Kart[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const [page, setPage] = useState(0);

  const loadKarts = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setKarts(await listKarts());
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Não foi possível carregar a frota real.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadKarts();
  }, [loadKarts]);

  const filteredKarts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return karts.filter((kart) => {
      const matchesSearch = !normalizedSearch || [kart.numero, kart.chassi_numero, kart.redutor_antigo, kart.redutor_novo]
        .some((value) => value?.toLowerCase().includes(normalizedSearch));
      const matchesCategory = categoryFilter === 'all' || kartCategoryFromPlate(kart.numero) === categoryFilter;
      const matchesState = stateFilter === 'all' || equalizationState(kart.media_equalizacao_ms, kart.numero) === stateFilter;
      return matchesSearch && matchesCategory && matchesState;
    });
  }, [categoryFilter, karts, search, stateFilter]);

  useEffect(() => {
    setPage(0);
  }, [categoryFilter, search, stateFilter]);

  const pageKarts = filteredKarts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const categorySummaries = useMemo(
    () => ({
      super: summarizeCategory(karts, 'super'),
      indoor: summarizeCategory(karts, 'indoor'),
    }),
    [karts],
  );
  const measured = karts.filter((kart) => kart.media_equalizacao_ms !== null).length;
  const balanced = karts.filter((kart) => equalizationState(kart.media_equalizacao_ms, kart.numero) === 'equilibrado').length;
  const alerts = karts.filter((kart) => equalizationState(kart.media_equalizacao_ms, kart.numero) !== 'equilibrado').length;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Operação · manutenção"
        title="Equalização de karts"
        subtitle="Dados reais da frota LapTime, com captura automática durante a tomada de tempo."
      />

      <div className="flex flex-col gap-3 rounded-xl border border-brand-900/50 bg-brand-950/20 p-4 text-sm text-brand-100 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Gauge aria-hidden="true" className="mt-0.5 flex-none text-brand-300" size={18} />
          <div>
            <strong className="block">Somente equalização</strong>
            <span className="mt-1 block text-xs leading-5 text-brand-100/70">
              O número da placa define a categoria. Chassi e redutores são os únicos dados físicos editáveis; sensor e tempo vêm da cronometragem.
            </span>
          </div>
        </div>
        <Button onClick={() => void loadKarts(true)} variant="ghost" loading={refreshing}>
          <RefreshCw aria-hidden="true" size={15} />
          Atualizar frota
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Gauge} label="Frota real" value={String(karts.length)} sub="Karts ativos no LapTime" loading={loading} />
        <StatCard icon={CheckCircle2} label="Dentro do alvo" value={String(balanced)} sub={`Tolerância de ±${formatTime(EQUALIZATION_TOLERANCE_MS)}`} loading={loading} />
        <StatCard icon={Timer} label="Com medição" value={`${measured}/${karts.length || 0}`} sub="Equalização automática registrada" loading={loading} />
        <StatCard icon={alerts ? AlertTriangle : CheckCircle2} label="Precisam de ação" value={String(alerts)} sub="Abrir o kart para decidir" loading={loading} />
      </div>

      <section className="grid gap-4 xl:grid-cols-2">
        {(['super', 'indoor'] as const).map((category) => {
          const summary = categorySummaries[category];
          return (
            <Card className="p-4 md:p-5" key={category}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">Referência da categoria</p>
                  <h2 className="mt-1 text-base font-semibold text-zinc-50">{KART_CATEGORY_LABELS[category]}</h2>
                </div>
                <Badge variant={categoryVariant[category]}>{summary.total} karts</Badge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div><span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Alvo</span><strong className="mt-1 block text-lg text-zinc-100">{formatTime(KART_CATEGORY_TARGETS_MS[category])}</strong></div>
                <div><span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Média da frota</span><strong className="mt-1 block text-lg text-zinc-100">{formatTime(summary.averageMs)}</strong></div>
                <div><span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Medições</span><strong className="mt-1 block text-lg text-zinc-100">{summary.measured}/{summary.total}</strong></div>
              </div>
            </Card>
          );
        })}
      </section>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-zinc-800 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-50">Frota para equalização</h2>
            <p className="mt-1 text-xs text-zinc-500">{filteredKarts.length} registro(s) filtrado(s) · clique no kart para abrir o painel completo.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block">
              <span className="sr-only">Buscar kart</span>
              <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={15} />
              <input
                aria-label="Buscar por kart, chassi ou redutor"
                className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 pl-9 pr-3 text-sm text-zinc-100 outline-none focus:border-brand-500/60 sm:w-64"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Kart, chassi ou redutor"
                value={search}
              />
            </label>
            <select aria-label="Filtrar categoria" className="h-9 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-200" onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)} value={categoryFilter}>
              <option value="all">Todas as categorias</option>
              <option value="super">Super Kart</option>
              <option value="indoor">Kart Indoor</option>
            </select>
            <select aria-label="Filtrar situação" className="h-9 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-200" onChange={(event) => setStateFilter(event.target.value as StateFilter)} value={stateFilter}>
              <option value="all">Todas as situações</option>
              <option value="equilibrado">Dentro do alvo</option>
              <option value="ajustar">Ajustar kart</option>
              <option value="critico">Ação imediata</option>
              <option value="pendente">Aguardando tomada</option>
              <option value="fora_do_padrao">Conferir placa</option>
            </select>
          </div>
        </div>

        {error ? (
          <div className="m-4 flex items-start gap-3 rounded-lg border border-red-900/60 bg-red-950/20 p-4 text-sm text-red-200" role="alert">
            <XCircle aria-hidden="true" className="mt-0.5 flex-none" size={18} />
            <div><strong className="block">Não foi possível atualizar a frota real.</strong><span className="mt-1 block text-xs text-red-200/70">{error}</span></div>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left">
            <thead className="border-b border-zinc-800 bg-zinc-950/40">
              <tr>
                {['Kart / categoria', 'Chassi', 'Redutor', 'Última equalização', 'Melhor volta', 'Desvio do alvo', 'Ação', 'Abrir'].map((label) => (
                  <th className="whitespace-nowrap px-4 py-3 text-[10px] font-bold uppercase tracking-[.1em] text-zinc-500" key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-4 py-12 text-center text-sm text-zinc-500" colSpan={8}>Carregando dados reais do LapTime...</td></tr>
              ) : pageKarts.map((kart) => {
                const physicalAlert = getPhysicalAlert(kart);
                const state = equalizationState(kart.media_equalizacao_ms, kart.numero);
                return (
                  <tr className="border-b border-zinc-800/70 last:border-0 hover:bg-zinc-800/20" key={kart.id}>
                    <td className="px-4 py-3">
                      <Link className="block min-w-32" href={`/admin/equalizacao/${encodeURIComponent(kart.id)}`}>
                        <strong className="block text-sm font-semibold text-zinc-100">Kart {kart.numero}</strong>
                        <span className="mt-1 block"><CategoryBadge numero={kart.numero} /></span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-300">{kart.chassi_numero || <span className="text-zinc-600">Não informado</span>}</td>
                    <td className="px-4 py-3 text-xs text-zinc-400"><span className="block">Antigo: {kart.redutor_antigo || '—'}</span><span className="mt-1 block">Novo: {kart.redutor_novo || '—'}</span></td>
                    <td className="px-4 py-3"><StateBadge kart={kart} /><span className="mt-1 block text-[11px] text-zinc-500">{formatDate(kart.ultima_equalizacao)}</span></td>
                    <td className="px-4 py-3"><strong className="block text-sm tabular-nums text-zinc-100">{formatTime(kart.melhor_equalizacao_ms)}</strong><span className="mt-1 block text-[11px] text-zinc-500">Média {formatTime(kart.media_equalizacao_ms)}</span></td>
                    <td className="px-4 py-3"><Delta kart={kart} /><span className="mt-1 block text-[11px] text-zinc-500">Alvo {formatTime(targetForKart(kart.numero))}</span></td>
                    <td className="px-4 py-3"><span className={state === 'equilibrado' ? 'text-xs text-emerald-300' : 'text-xs text-amber-300'}>{getAlertText(kart)}</span>{physicalAlert ? <span className="mt-1 block text-[11px] text-red-300">{physicalAlert}</span> : null}</td>
                    <td className="px-4 py-3"><Link aria-label={`Abrir painel do kart ${kart.numero}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 transition hover:border-brand-400 hover:text-brand-300" href={`/admin/equalizacao/${encodeURIComponent(kart.id)}`} title="Abrir painel"><ArrowRight aria-hidden="true" size={16} /></Link></td>
                  </tr>
                );
              })}
              {!loading && pageKarts.length === 0 ? <tr><td className="px-4 py-12 text-center text-sm text-zinc-500" colSpan={8}>Nenhum kart corresponde aos filtros atuais.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={filteredKarts.length} onPageChange={setPage} />
      </Card>
    </div>
  );
};
