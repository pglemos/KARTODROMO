import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../ui/PageHeader';
import { Tabs } from '../../ui/Tabs';
import { useToast } from '../../ui/useToast';
import { CobrancasTab } from './CobrancasTab';
import { ContratosTab } from './ContratosTab';
import { EmpresasTab } from './EmpresasTab';
import { EspacosTab } from './EspacosTab';
import { patrocinadoresApi } from './patrocinadores.api';
import { ResumoTab } from './ResumoTab';
import type { Cobranca, Contrato, Empresa, Espaco } from './patrocinadores.types';

type Aba = 'resumo' | 'contratos' | 'cobrancas' | 'empresas' | 'espacos';

const abas: { key: Aba; label: string }[] = [
  { key: 'resumo', label: 'Resumo' },
  { key: 'contratos', label: 'Contratos' },
  { key: 'cobrancas', label: 'Cobranças' },
  { key: 'empresas', label: 'Empresas' },
  { key: 'espacos', label: 'Espaços' },
];

export function PatrocinadoresPage() {
  const { error: toastError } = useToast();
  const [aba, setAba] = useState<Aba>('resumo');
  const [carregando, setCarregando] = useState(true);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [espacos, setEspacos] = useState<Espaco[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);

  const carregar = useCallback(async () => {
    try {
      const [e, s, c, b] = await Promise.all([
        patrocinadoresApi.empresas(),
        patrocinadoresApi.espacos(),
        patrocinadoresApi.contratos(),
        patrocinadoresApi.cobrancas(),
      ]);
      setEmpresas(e);
      setEspacos(s);
      setContratos(c);
      setCobrancas(b);
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Não foi possível carregar os patrocinadores');
    } finally {
      setCarregando(false);
    }
  }, [toastError]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Gestão" title="Patrocinadores e publicidade" subtitle="Empresas, outdoors, pódio, contratos, recorrência e cobranças em um só lugar." />
      <Tabs items={abas} value={aba} onChange={(key) => setAba(key as Aba)} />
      {aba === 'resumo' && <ResumoTab carregando={carregando} cobrancas={cobrancas} contratos={contratos} espacos={espacos} irPara={setAba} />}
      {aba === 'contratos' && <ContratosTab cobrancas={cobrancas} contratos={contratos} empresas={empresas} espacos={espacos} onChanged={carregar} />}
      {aba === 'cobrancas' && <CobrancasTab cobrancas={cobrancas} empresas={empresas} onChanged={carregar} />}
      {aba === 'empresas' && <EmpresasTab contratos={contratos} empresas={empresas} onChanged={carregar} />}
      {aba === 'espacos' && <EspacosTab contratos={contratos} espacos={espacos} onChanged={carregar} />}
    </div>
  );
}
