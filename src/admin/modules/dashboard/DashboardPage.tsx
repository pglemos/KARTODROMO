import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck2, ConciergeBell, UtensilsCrossed, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { apiGet } from '../../lib/api-client';
import { canAccess } from '../../lib/rbac';
import { Card } from '../../ui/Card';
import { PageHeader } from '../../ui/PageHeader';
import { StatCard } from '../../ui/StatCard';
import { StatusBadge } from '../../ui/Badge';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

type Relation = { nome: string } | { nome: string }[] | null | undefined;
const nameOf = (relation: Relation): string =>
  (Array.isArray(relation) ? relation[0]?.nome : relation?.nome) ?? '—';

type ReservaRow = {
  id: string;
  data_inicio: string;
  status: string;
  clientes: Relation;
  pistas: Relation;
};

type ClassificacaoRow = {
  id: string;
  pontos: number;
  pilotos: Relation;
  campeonatos: Relation;
};

type Stats = {
  reservas: number | null;
  saldo: number | null;
  vendas: number | null;
  fila: number | null;
};

export const DashboardPage = () => {
  const { role } = useAuth();
  const canFinance = canAccess(role, 'financeira');

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ reservas: null, saldo: null, vendas: null, fila: null });
  const [reservas, setReservas] = useState<ReservaRow[]>([]);
  const [lideres, setLideres] = useState<ClassificacaoRow[]>([]);

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
        const fin = await apiGet<{ tipo: string; valor: number }[]>('financeiro_lancamentos?eq_status=confirmado');
        saldo = fin.reduce(
          (sum, row) => sum + (row.tipo === 'receita' ? Number(row.valor) : -Number(row.valor)),
          0,
        );
      }

      const proximasRows = await apiGet<
        Array<{ id: string; data_inicio: string; status: string; cliente_nome: string | null; pista_nome: string | null }>
      >('reservas_full?dir=asc&limit=5');

      const classificacaoRows = await apiGet<
        Array<{
          id: string;
          pontos: number;
          piloto_nome: string | null;
          campeonato_nome: string | null;
        }>
      >('classificacao_full?limit=3');

      setStats({
        reservas: confirmadas.length,
        saldo,
        vendas: vendas.reduce((sum, row) => sum + Number(row.total ?? 0), 0),
        fila: fila.length,
      });
      setReservas(
        proximasRows.map((row) => ({
          id: row.id,
          data_inicio: row.data_inicio,
          status: row.status,
          clientes: row.cliente_nome ? { nome: row.cliente_nome } : null,
          pistas: row.pista_nome ? { nome: row.pista_nome } : null,
        })),
      );
      setLideres(
        classificacaoRows.map((row) => ({
          id: row.id,
          pontos: row.pontos,
          pilotos: row.piloto_nome ? { nome: row.piloto_nome } : null,
          campeonatos: row.campeonato_nome ? { nome: row.campeonato_nome } : null,
        })),
      );
    } catch {
      setStats({ reservas: null, saldo: null, vendas: null, fila: null });
      setReservas([]);
      setLideres([]);
    }

    setLoading(false);
  }, [canFinance]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow="Visão geral"
        title="Dashboard"
        subtitle="Indicadores operacionais dos módulos disponíveis para o seu perfil."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CalendarCheck2}
          label="Reservas confirmadas"
          loading={loading}
          value={String(stats.reservas ?? 0)}
          sub="Total no sistema"
        />
        {canFinance ? (
          <StatCard
            icon={WalletCards}
            label="Saldo financeiro"
            loading={loading}
            value={brl.format(stats.saldo ?? 0)}
            sub="Lançamentos confirmados"
          />
        ) : null}
        <StatCard
          icon={UtensilsCrossed}
          label="Vendas lanchonete"
          loading={loading}
          value={brl.format(stats.vendas ?? 0)}
          sub="Acumulado"
        />
        <StatCard
          icon={ConciergeBell}
          label="Fila recepção"
          loading={loading}
          value={String(stats.fila ?? 0)}
          sub="Aguardando / em atendimento"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100">Próximas reservas</h2>
            <Link className="text-xs font-medium text-brand-400 hover:text-brand-300" to="/admin/reservas">
              Ver todas
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }, (_, index) => (
                <div className="h-12 animate-pulse rounded-lg bg-zinc-800/60" key={index} />
              ))}
            </div>
          ) : reservas.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">Nenhuma reserva cadastrada.</p>
          ) : (
            <ul className="divide-y divide-zinc-800/60">
              {reservas.map((reserva) => (
                <li className="flex items-center justify-between gap-3 py-3" key={reserva.id}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-200">{nameOf(reserva.clientes)}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {nameOf(reserva.pistas)} · {dateTime.format(new Date(reserva.data_inicio))}
                    </p>
                  </div>
                  <StatusBadge status={reserva.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100">Líderes da classificação</h2>
            <Link className="text-xs font-medium text-brand-400 hover:text-brand-300" to="/admin/campeonatos">
              Ver campeonatos
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }, (_, index) => (
                <div className="h-12 animate-pulse rounded-lg bg-zinc-800/60" key={index} />
              ))}
            </div>
          ) : lideres.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">Sem classificação registrada.</p>
          ) : (
            <ul className="space-y-2">
              {lideres.map((linha, index) => (
                <li className="flex items-center gap-3 py-1" key={linha.id}>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-200">{nameOf(linha.pilotos)}</p>
                    <p className="truncate text-xs text-zinc-500">{nameOf(linha.campeonatos)}</p>
                  </div>
                  <span className="text-sm font-semibold text-brand-400">{linha.pontos} pts</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
};
