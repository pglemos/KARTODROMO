import { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays,
  ConciergeBell,
  Flag,
  Gauge,
  LayoutDashboard,
  Monitor,
  ShieldCheck,
  Timer,
  Trophy,
  Users,
  UtensilsCrossed,
  WalletCards,
  BadgePercent,
  type LucideIcon,
} from 'lucide-react';
import { adminModules, type AdminModuleKey } from '../../../../components/admin/navigation';
import { useAuth } from '../../auth/AuthContext';
import { apiGet } from '../../lib/api-client';
import { canAccess } from '../../lib/rbac';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type Stats = {
  reservas: number | null;
  saldo: number | null;
  vendas: number | null;
  fila: number | null;
};

const iconMap: Record<AdminModuleKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  reservas: CalendarDays,
  recepcao: ConciergeBell,
  lanchonete: UtensilsCrossed,
  cronometragem: Timer,
  campeonatos: Trophy,
  resultados: Flag,
  telao: Monitor,
  financeira: WalletCards,
  clientes: Users,
  equalizacao: Gauge,
  administrativa: ShieldCheck,
  clube: BadgePercent,
};

const liveModules = new Set<AdminModuleKey>(['cronometragem', 'telao']);

export const DashboardPage = () => {
  const { role } = useAuth();
  const canFinance = canAccess(role, 'financeira');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ reservas: null, saldo: null, vendas: null, fila: null });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [confirmadas, fila, vendas] = await Promise.all([
        apiGet<{ id: string }[]>('reservas?eq_status=confirmada'),
        apiGet<{ id: string }[]>('recepcao_atendimentos?in_status=aguardando,em_atendimento'),
        apiGet<{ total: number }[]>('lanchonete_vendas'),
      ]);

      let saldo: number | null = null;
      if (canFinance) {
        const lancamentos = await apiGet<{ tipo: string; valor: number }[]>(
          'financeiro_lancamentos?eq_status=confirmado',
        );
        saldo = lancamentos.reduce(
          (total, item) => total + (item.tipo === 'receita' ? Number(item.valor) : -Number(item.valor)),
          0,
        );
      }

      setStats({
        reservas: confirmadas.length,
        saldo,
        vendas: vendas.reduce((total, item) => total + Number(item.total ?? 0), 0),
        fila: fila.length,
      });
    } catch {
      setStats({ reservas: null, saldo: null, vendas: null, fila: null });
    } finally {
      setLoading(false);
    }
  }, [canFinance]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const kpis = [
    {
      label: 'Reservas confirmadas',
      value: String(stats.reservas ?? 0),
      detail: 'Total no sistema',
    },
    {
      label: 'Fila da recepção',
      value: String(stats.fila ?? 0),
      detail: 'Aguardando ou em atendimento',
    },
    {
      label: 'Vendas da lanchonete',
      value: brl.format(stats.vendas ?? 0),
      detail: 'Faturamento acumulado',
    },
    ...(canFinance
      ? [{ label: 'Saldo financeiro', value: brl.format(stats.saldo ?? 0), detail: 'Lançamentos confirmados' }]
      : [{ label: 'Módulos disponíveis', value: String(adminModules.length - 1), detail: 'Áreas operacionais' }]),
  ];

  return (
    <section className="grid gap-6 pb-10 font-['Rajdhani',sans-serif]">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <article className="rounded-[14px] border border-zinc-800 bg-zinc-900 p-[18px]" key={kpi.label}>
            <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-400">{kpi.label}</span>
            <strong className="mt-2.5 block text-[28px] font-bold leading-tight text-zinc-50">
              {loading ? <span className="inline-block h-8 w-24 animate-pulse rounded bg-zinc-800" /> : kpi.value}
            </strong>
            <span className="mt-1 block text-xs text-zinc-500">{kpi.detail}</span>
          </article>
        ))}
      </div>

      <section className="grid items-center gap-[22px] rounded-2xl border border-zinc-800 bg-zinc-900 p-5 lg:grid-cols-[1.4fr_1fr] lg:p-[26px]">
        <div>
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.12em] text-primary-300">
            Central administrativa
          </p>
          <h2 className="mt-2 text-2xl font-bold text-zinc-50">Visão geral da operação</h2>
          <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-zinc-400">
            Acompanhe reservas, cronometragem, campeonatos e a gestão financeira do kartódromo em um só lugar. Use a
            barra lateral para navegar entre os módulos.
          </p>
        </div>
        <div className="grid gap-2.5 rounded-xl border border-primary-400/40 bg-primary-500/10 p-[18px]">
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-primary-300">Acesso rápido</span>
          <a
            className="flex h-11 items-center justify-center rounded-[9px] bg-primary-500 text-sm font-bold text-zinc-950 hover:bg-primary-400"
            href="/admin/reservas"
          >
            Ver reservas
          </a>
          <a
            className="flex h-11 items-center justify-center rounded-[9px] border border-zinc-700 text-sm font-bold text-zinc-100 hover:border-primary-400/60 hover:text-primary-300"
            href="/admin/cronometragem"
          >
            Abrir cronometragem
          </a>
        </div>
      </section>

      <section>
        <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-xl font-bold text-zinc-50">Módulos do sistema</h2>
          <span className="text-xs font-semibold text-zinc-500">{adminModules.length - 1} módulos operacionais</span>
        </div>
        <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {adminModules
            .filter((module) => module.key !== 'dashboard')
            .map((module) => {
              const Icon = iconMap[module.key];
              const isLive = liveModules.has(module.key);
              return (
                <a
                  className="group grid gap-2.5 rounded-[14px] border border-zinc-800 bg-zinc-900 p-[18px] text-zinc-100 transition hover:-translate-y-0.5 hover:border-primary-400/60"
                  href={module.href}
                  key={module.key}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-[9px] bg-primary-500/10 text-primary-300">
                      <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.04em] ${
                        isLive ? 'bg-blue-400/10 text-blue-300' : 'bg-primary-500/10 text-primary-300'
                      }`}
                    >
                      {isLive ? 'Ao vivo' : 'Ativo'}
                    </span>
                  </div>
                  <strong className="text-base font-bold group-hover:text-primary-300">{module.title}</strong>
                  <p className="m-0 text-[13px] leading-relaxed text-zinc-400">{module.summary}</p>
                </a>
              );
            })}
        </div>
      </section>
    </section>
  );
};
