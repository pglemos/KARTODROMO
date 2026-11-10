'use client';

import { BrowserRouter } from 'react-router-dom';
import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { LegacyAuthProvider } from '@/src/admin/auth/AuthContext';
import { ToastProvider } from '@/src/admin/ui/useToast';
import type { AdminModuleKey } from './navigation';

const legacyPages: Partial<Record<AdminModuleKey, ComponentType>> = {
  administrativa: dynamic(() => import('@/src/admin/modules/administrativa/AdministrativaPage').then((m) => m.AdministrativaPage)),
  campeonatos: dynamic(() => import('@/src/admin/modules/campeonatos/CampeonatosPage').then((m) => m.CampeonatosPage)),
  clientes: dynamic(() => import('@/src/admin/modules/clientes/ClientesPage').then((m) => m.ClientesPage)),
  clube: dynamic(() => import('@/src/admin/modules/clube/ClubePage').then((m) => m.ClubePage)),
  cronometragem: dynamic(() => import('@/src/admin/modules/cronometragem/CronometragemPage').then((m) => m.CronometragemPage)),
  dashboard: dynamic(() => import('@/src/admin/modules/dashboard/DashboardPage').then((m) => m.DashboardPage)),
  financeira: dynamic(() => import('@/src/admin/modules/financeira/FinanceiraPage').then((m) => m.FinanceiraPage)),
  equalizacao: dynamic(() => import('@/src/admin/modules/equalizacao/EqualizacaoPage').then((m) => m.EqualizacaoPage)),
  lanchonete: dynamic(() => import('@/src/admin/modules/lanchonete/LanchonetePage').then((m) => m.LanchonetePage)),
  recepcao: dynamic(() => import('@/src/admin/modules/recepcao/RecepcaoPage').then((m) => m.RecepcaoPage)),
  reservas: dynamic(() => import('@/src/admin/modules/reservas/ReservasPage').then((m) => m.ReservasPage)),
  resultados: dynamic(() => import('@/src/admin/modules/resultados/ResultadosPage').then((m) => m.ResultadosPage)),
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
      <div className="admin-card mx-auto max-w-[1500px] p-5 text-sm font-bold text-kib-texto-2">
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
