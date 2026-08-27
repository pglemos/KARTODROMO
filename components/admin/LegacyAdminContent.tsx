'use client';

import { BrowserRouter } from 'react-router-dom';
import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { LegacyAuthProvider } from '@/src/admin/auth/AuthContext';
import { AdministrativaPage } from '@/src/admin/modules/administrativa/AdministrativaPage';
import { CampeonatosPage } from '@/src/admin/modules/campeonatos/CampeonatosPage';
import { ClientesPage } from '@/src/admin/modules/clientes/ClientesPage';
import { ClubePage } from '@/src/admin/modules/clube/ClubePage';
import { CronometragemPage } from '@/src/admin/modules/cronometragem/CronometragemPage';
import { DashboardPage } from '@/src/admin/modules/dashboard/DashboardPage';
import { FinanceiraPage } from '@/src/admin/modules/financeira/FinanceiraPage';
import { EqualizacaoPage } from '@/src/admin/modules/equalizacao/EqualizacaoPage';
import { LanchonetePage } from '@/src/admin/modules/lanchonete/LanchonetePage';
import { RecepcaoPage } from '@/src/admin/modules/recepcao/RecepcaoPage';
import { ReservasPage } from '@/src/admin/modules/reservas/ReservasPage';
import { ResultadosPage } from '@/src/admin/modules/resultados/ResultadosPage';
import { ToastProvider } from '@/src/admin/ui/useToast';
import type { AdminModuleKey } from './navigation';
import type { Role } from '@/src/admin/lib/rbac';

const legacyPages: Partial<Record<AdminModuleKey, ComponentType>> = {
  administrativa: AdministrativaPage,
  campeonatos: CampeonatosPage,
  clientes: ClientesPage,
  clube: ClubePage,
  cronometragem: CronometragemPage,
  dashboard: DashboardPage,
  financeira: FinanceiraPage,
  equalizacao: EqualizacaoPage,
  lanchonete: LanchonetePage,
  recepcao: RecepcaoPage,
  reservas: ReservasPage,
  resultados: ResultadosPage,
};

function ModuleLoadingState() {
  return (
    <div aria-busy="true" aria-label="Carregando módulo" className="admin-module-loading" role="status">
      <div className="admin-module-loading__heading">
        <span className="admin-skeleton admin-skeleton--title" />
        <span className="admin-skeleton admin-skeleton--copy" />
      </div>
      <div className="admin-module-loading__cards" aria-hidden="true">
        <span className="admin-skeleton admin-skeleton--card" />
        <span className="admin-skeleton admin-skeleton--card" />
        <span className="admin-skeleton admin-skeleton--card" />
      </div>
      <div aria-hidden="true" className="admin-module-loading__table">
        <span className="admin-skeleton admin-skeleton--row" />
        <span className="admin-skeleton admin-skeleton--row" />
        <span className="admin-skeleton admin-skeleton--row" />
        <span className="admin-skeleton admin-skeleton--row" />
      </div>
    </div>
  );
}

export function LegacyAdminContent({ moduleKey, sessionEmail, sessionRole }: { moduleKey: AdminModuleKey; sessionEmail: string; sessionRole: Role }) {
  const Page = legacyPages[moduleKey];
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!Page) return null;

  if (!mounted) {
    return <ModuleLoadingState />;
  }

  return (
    <LegacyAuthProvider email={sessionEmail} role={sessionRole}>
      <ToastProvider>
        <BrowserRouter>
          <div className="mx-auto max-w-[1500px]">
            <Page />
          </div>
        </BrowserRouter>
      </ToastProvider>
    </LegacyAuthProvider>
  );
}
