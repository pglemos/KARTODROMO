import { Activity, CalendarDays, Monitor, Timer, WalletCards } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminModules } from '../../../../components/admin/navigation';
import { humanizeAdminError } from '@/lib/admin-error-messages';
import { useAuth } from '../../auth/AuthContext';
import { apiGet } from '../../lib/api-client';
import { canAccess } from '../../lib/rbac';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type Stats = {
  reservas: number | null;
  saldo: number | null;
  vendas: number | null;
  fila: number | null;
  error: string | null;
};

type Kpi = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
};

const initialStats: Stats = { reservas: null, saldo: null, vendas: null, fila: null, error: null };

const isFulfilled = <T,>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> => result.status === 'fulfilled';

function formatKpiValue(
  value: number | null,
  loading: boolean,
  formatter: (value: number) => string = String,
) {
  if (loading) return 'Carregando';
  return value === null ? 'Indisponível' : formatter(value);
}

export const DashboardPage = () => {
  const { role } = useAuth();
  const permissions = useMemo(() => ({
    reservas: canAccess(role, 'reservas'),
    recepcao: canAccess(role, 'recepcao'),
    lanchonete: canAccess(role, 'lanchonete'),
    financeira: canAccess(role, 'financeira'),
  }), [role]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>(initialStats);

  const loadData = useCallback(async () => {
    setLoading(true);
    setStats((current) => ({ ...current, error: null }));

    const [reservasResult, filaResult, vendasResult, financeiroResult] = await Promise.allSettled([
      permissions.reservas ? apiGet<{ id: string }[]>('reservas?eq_status=confirmada') : Promise.resolve(null),
      permissions.recepcao ? apiGet<{ id: string }[]>('recepcao_atendimentos?in_status=aguardando,em_atendimento') : Promise.resolve(null),
      permissions.lanchonete ? apiGet<{ total: number }[]>('lanchonete_vendas') : Promise.resolve(null),
      permissions.financeira ? apiGet<{ tipo: string; valor: number }[]>('financeiro_lancamentos?eq_status=confirmado') : Promise.resolve(null),
    ]);

    const failures = [reservasResult, filaResult, vendasResult, financeiroResult]
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => humanizeAdminError(result.reason, 'Uma fonte não respondeu.'));

    const financeiro = isFulfilled(financeiroResult) && financeiroResult.value
      ? financeiroResult.value.reduce((total, item) => total + (item.tipo === 'receita' ? Number(item.valor) : -Number(item.valor)), 0)
      : null;

    setStats({
      reservas: isFulfilled(reservasResult) && reservasResult.value ? reservasResult.value.length : null,
      fila: isFulfilled(filaResult) && filaResult.value ? filaResult.value.length : null,
      vendas: isFulfilled(vendasResult) && vendasResult.value
        ? vendasResult.value.reduce((total, item) => total + Number(item.total ?? 0), 0)
        : null,
      saldo: financeiro,
      error: failures.length ? [...new Set(failures)].join(' ') : null,
    });
    setLoading(false);
  }, [permissions]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const kpis = useMemo<Kpi[]>(() => {
    const next: Kpi[] = [];
    if (permissions.reservas) next.push({ label: 'Reservas confirmadas', value: formatKpiValue(stats.reservas, loading), detail: stats.reservas === null && !loading ? 'Fonte indisponível' : 'Total no sistema', icon: CalendarDays });
    if (permissions.recepcao) next.push({ label: 'Fila da recepção', value: formatKpiValue(stats.fila, loading), detail: stats.fila === null && !loading ? 'Fonte indisponível' : 'Aguardando ou em atendimento', icon: Activity });
    if (permissions.lanchonete) next.push({ label: 'Vendas da lanchonete', value: formatKpiValue(stats.vendas, loading, (value) => brl.format(value)), detail: stats.vendas === null && !loading ? 'Fonte indisponível' : 'Faturamento acumulado', icon: WalletCards });
    if (permissions.financeira) next.push({ label: 'Saldo financeiro', value: formatKpiValue(stats.saldo, loading, (value) => brl.format(value)), detail: stats.saldo === null && !loading ? 'Fonte indisponível' : 'Lançamentos confirmados', icon: WalletCards });
    if (!next.length) next.push({ label: 'Módulos disponíveis', value: String(adminModules.filter((module) => module.key !== 'dashboard' && canAccess(role, module.key)).length), detail: 'Áreas liberadas para o seu perfil', icon: Monitor });
    return next;
  }, [loading, permissions, role, stats.fila, stats.reservas, stats.saldo, stats.vendas]);

  const quickLinks = useMemo(() => adminModules
    .filter((module) => module.key !== 'dashboard' && canAccess(role, module.key))
    .filter((module) => ['reservas', 'cronometragem', 'telao', 'financeira', 'lanchonete'].includes(module.key))
    .slice(0, 2), [role]);

  return (
    <section className="admin-dashboard grid gap-6 pb-10">
      <header className="admin-dashboard-intro">
        <div>
          <h2>Visão geral da operação</h2>
          <p>Resumo das áreas liberadas para o seu perfil. Use a navegação lateral para acessar cada rotina.</p>
        </div>
        <span className="admin-dashboard-role"><Activity aria-hidden="true" size={15} />{role === 'owner' ? 'Acesso completo' : 'Acesso por perfil'}</span>
      </header>

      {stats.error ? (
        <div className="admin-inline-alert admin-inline-alert-error" role="alert">
          <span>{stats.error}</span>
          <button type="button" onClick={() => void loadData()}>Atualizar indicadores</button>
        </div>
      ) : null}

      <div className="admin-dashboard-kpis" aria-label="Indicadores operacionais">
        {kpis.map(({ detail, icon: Icon, label, value }) => (
          <article className="admin-dashboard-kpi" key={label}>
            <div className="admin-dashboard-kpi__top"><span>{label}</span><Icon aria-hidden="true" size={17} /></div>
            <strong>{value}</strong>
            <small>{detail}</small>
          </article>
        ))}
      </div>

      <section className="admin-dashboard-workspace">
        <div>
          <div className="admin-section-heading">
            <div><span>Próximo passo</span><h2>Acesso rápido</h2></div>
            <Timer aria-hidden="true" size={18} />
          </div>
          <div className="admin-dashboard-links">
            {quickLinks.length ? quickLinks.map((module) => (
              <a href={module.href} key={module.key}>
                <strong>{module.title}</strong>
                <span>{module.summary}</span>
                <em>Abrir</em>
              </a>
            )) : <p className="admin-dashboard-empty">Nenhum atalho operacional está liberado para este perfil.</p>}
          </div>
        </div>
        <aside className="admin-dashboard-note">
          <span className="admin-dashboard-note__icon"><Monitor aria-hidden="true" size={18} /></span>
          <div><strong>Navegação por perfil</strong><p>Os módulos exibidos no menu respeitam o papel da sua conta. Se uma área não aparece, solicite a liberação à administração.</p></div>
        </aside>
      </section>
    </section>
  );
};
