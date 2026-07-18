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
import { LanchonetePage } from '@/src/admin/modules/lanchonete/LanchonetePage';
import { RecepcaoPage } from '@/src/admin/modules/recepcao/RecepcaoPage';
import { ReservasPage } from '@/src/admin/modules/reservas/ReservasPage';
import { ResultadosPage } from '@/src/admin/modules/resultados/ResultadosPage';
import { ToastProvider } from '@/src/admin/ui/useToast';
import type { AdminModuleKey } from './navigation';

const legacyPages: Partial<Record<AdminModuleKey, ComponentType>> = {
  administrativa: AdministrativaPage,
  campeonatos: CampeonatosPage,
  clientes: ClientesPage,
  clube: ClubePage,
  cronometragem: CronometragemPage,
  dashboard: DashboardPage,
  financeira: FinanceiraPage,
  lanchonete: LanchonetePage,
  recepcao: RecepcaoPage,
  reservas: ReservasPage,
  resultados: ResultadosPage,
};

export function LegacyAdminContent({ moduleKey, sessionEmail }: { moduleKey: AdminModuleKey; sessionEmail: string }) {
  const Page = legacyPages[moduleKey];
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!Page) return null;

  if (!mounted) {
    return (
      <div className="mx-auto max-w-[1500px] rounded-lg border border-zinc-800 bg-zinc-900 p-5 text-sm font-bold text-zinc-400">
        Carregando módulo...
      </div>
    );
  }

  return (
    <LegacyAuthProvider email={sessionEmail}>
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
