import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Gift, Megaphone, Users, TrendingUp, Award, ChevronRight, Plus, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { FormField } from '../../ui/FormField';
import { Modal } from '../../ui/Modal';
import { PageHeader } from '../../ui/PageHeader';
import { DataTable, type DataTableColumn } from '../../ui/DataTable';
import { useToast } from '../../ui/useToast';
import { apiGet, apiPost, apiPatch } from '../../lib/api-client';
import { useAuth } from '../../auth/AuthContext';
import { canAccess } from '../../lib/rbac';

type Participante = {
  id: string;
  nome: string;
  email: string | null;
  pontos: number;
  nivel: 'bronze' | 'prata' | 'ouro' | 'platina';
  ativo: boolean;
  created_at: string;
};

type Recompensa = {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string;
  pontos_necessarios: number;
  estoque: number;
  ativo: boolean;
};

type Resgate = {
  id: string;
  participante_nome: string;
  recompensa_nome: string;
  pontos: number;
  status: 'pendente' | 'aprovado' | 'recusado' | 'entregue';
  created_at: string;
};

type Campanha = {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: string;
  multiplicador: number;
  ativo: boolean;
};

const nivelBadge: Record<string, string> = {
  bronze: 'border-amber-700 bg-amber-950 text-amber-300',
  prata: 'border-gray-500 bg-gray-900 text-gray-300',
  ouro: 'border-yellow-600 bg-yellow-950 text-yellow-300',
  platina: 'border-violet-600 bg-violet-950 text-violet-300',
};

const statusBadge: Record<string, string> = {
  pendente: 'border-amber-700 bg-amber-950 text-amber-300',
  aprovado: 'border-green-700 bg-green-950 text-green-300',
  recusado: 'border-red-700 bg-red-950 text-red-300',
  entregue: 'border-sky-700 bg-sky-950 text-sky-300',
};

const inputClassName =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

const resgatesColumns: readonly DataTableColumn<Resgate>[] = [
  { key: 'participante_nome', label: 'Participante' },
  { key: 'recompensa_nome', label: 'Recompensa' },
  { key: 'pontos', label: 'Pontos', render: (r) => String(r.pontos) },
  {
    key: 'status',
    label: 'Status',
    render: (r) => (
      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusBadge[r.status] ?? ''}`}>
        {r.status}
      </span>
    ),
  },
];

export function ClubePage() {
  const { role } = useAuth();
  const toast = useToast();
  const canWrite = canAccess(role, 'clube') && ['owner', 'admin'].includes(role);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [recompensas, setRecompensas] = useState<Recompensa[]>([]);
  const [resgates, setResgates] = useState<Resgate[]>([]);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'participantes' | 'recompensas' | 'resgates' | 'campanhas'>('participantes');
  const [modalRecompensa, setModalRecompensa] = useState(false);
  const [modalCampanha, setModalCampanha] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r, re, c] = await Promise.all([
        apiGet<Participante[]>('clube_participantes?limit=100'),
        apiGet<Recompensa[]>('clube_recompensas?limit=100'),
        apiGet<Resgate[]>('clube_resgates_full?limit=50'),
        apiGet<Campanha[]>('clube_campanhas?limit=50'),
      ]);
      setParticipantes(p);
      setRecompensas(r);
      setResgates(re);
      setCampanhas(c);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  async function toggleCampanha(campanha: Campanha) {
    try {
      await apiPatch<Campanha>(`clube_campanhas/${campanha.id}`, { ativo: !campanha.ativo });
      setCampanhas((all) => all.map((c) => c.id === campanha.id ? { ...c, ativo: !c.ativo } : c));
      toast.success(`Campanha ${campanha.ativo ? 'desativada' : 'ativada'}!`);
    } catch {
      toast.error('Erro ao alterar campanha');
    }
  }

  async function aprovarResgate(resgate: Resgate) {
    try {
      await apiPatch<Resgate>(`clube_resgates/${resgate.id}`, { status: 'aprovado' });
      setResgates((all) => all.map((r) => r.id === resgate.id ? { ...r, status: 'aprovado' as const } : r));
      toast.success('Resgate aprovado!');
    } catch {
      toast.error('Erro ao aprovar resgate');
    }
  }

  async function recusarResgate(resgate: Resgate) {
    try {
      await apiPatch<Resgate>(`clube_resgates/${resgate.id}`, { status: 'recusado' });
      setResgates((all) => all.map((r) => r.id === resgate.id ? { ...r, status: 'recusado' as const } : r));
      toast.success('Resgate recusado.');
    } catch {
      toast.error('Erro ao recusar resgate');
    }
  }

  async function addRecompensa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const nova = await apiPost<Recompensa>('clube_recompensas', {
        nome: String(data.get('nome')),
        descricao: String(data.get('descricao') || ''),
        categoria: String(data.get('categoria')),
        pontos_necessarios: Number(data.get('pontos')),
        estoque: Number(data.get('estoque')),
        ativo: true,
      });
      setRecompensas((all) => [...all, nova]);
      setModalRecompensa(false);
      toast.success('Recompensa criada!');
    } catch {
      toast.error('Erro ao criar recompensa');
    }
  }

  async function addCampanha(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const nova = await apiPost<Campanha>('clube_campanhas', {
        nome: String(data.get('nome')),
        descricao: String(data.get('descricao') || ''),
        tipo: String(data.get('tipo')),
        multiplicador: Number(data.get('multiplicador') || 1),
        ativo: true,
      });
      setCampanhas((all) => [...all, nova]);
      setModalCampanha(false);
      toast.success('Campanha criada!');
    } catch {
      toast.error('Erro ao criar campanha');
    }
  }

  const pendentes = resgates.filter((r) => r.status === 'pendente');
  const participantesAtivos = participantes.filter((p) => p.ativo).length;
  const campanhasAtivas = campanhas.filter((c) => c.ativo).length;

  const tabs = [
    { key: 'participantes' as const, label: 'Participantes' },
    { key: 'recompensas' as const, label: 'Recompensas' },
    { key: 'resgates' as const, label: `Resgates${pendentes.length ? ` (${pendentes.length})` : ''}` },
    { key: 'campanhas' as const, label: 'Campanhas' },
  ];

  return (
    <section className="space-y-6">
      <PageHeader eyebrow="Gestão" title="Clube de Vantagens" subtitle="Participantes, recompensas, campanhas e resgates do programa de fidelidade." />

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Participantes ativos', value: loading ? '…' : String(participantesAtivos), Icon: Users },
          { label: 'Recompensas', value: loading ? '…' : String(recompensas.length), Icon: Gift },
          { label: 'Campanhas ativas', value: loading ? '…' : String(campanhasAtivas), Icon: Megaphone },
          { label: 'Resgates pendentes', value: loading ? '…' : String(pendentes.length), Icon: Award },
        ].map(({ label, value, Icon }) => (
          <Card className="p-5" key={label}>
            <Icon className="text-brand-400" size={22} />
            <span className="mt-4 block text-xs font-bold uppercase text-zinc-500">{label}</span>
            <strong className="mt-1 block text-3xl text-zinc-100">{value}</strong>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-4" role="tablist">
        {tabs.map((t) => (
          <button
            aria-selected={tab === t.key}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
              tab === t.key
                ? 'border-brand-400 text-brand-200'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
            key={t.key}
            onClick={() => setTab(t.key)}
            role="tab"
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Participantes Tab */}
      {tab === 'participantes' && (
        <Card className="overflow-hidden p-0">
          <div className="p-4">
            <h2 className="text-lg font-bold text-zinc-100">Participantes do Clube</h2>
            <p className="text-sm text-zinc-400">{participantes.length} participante(s) cadastrado(s)</p>
          </div>
          <div className="divide-y divide-zinc-800">
            {loading ? (
              <div className="p-6 text-center text-zinc-500">Carregando...</div>
            ) : participantes.length === 0 ? (
              <div className="p-6 text-center text-zinc-500">Nenhum participante cadastrado.</div>
            ) : (
              participantes.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <strong className="text-zinc-200">{p.nome}</strong>
                    <p className="text-xs text-zinc-500">{p.email ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-sm font-bold text-brand-400">
                      <TrendingUp size={14} />
                      {p.pontos.toLocaleString('pt-BR')} pts
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${nivelBadge[p.nivel] ?? ''}`}>
                      {p.nivel}
                    </span>
                    <ChevronRight className="text-zinc-600" size={16} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* Recompensas Tab */}
      {tab === 'recompensas' && (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-100">Recompensas e Estoque</h2>
            <Button disabled={!canWrite} onClick={() => setModalRecompensa(true)}>
              <Plus size={14} /> Nova recompensa
            </Button>
          </div>
          <div className="space-y-2">
            {loading ? (
              <p className="text-sm text-zinc-500">Carregando...</p>
            ) : recompensas.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhuma recompensa cadastrada.</p>
            ) : (
              recompensas.map((item) => (
                <div
                  key={item.id}
                  className="grid items-center gap-3 rounded-lg border border-zinc-800 p-3 md:grid-cols-[1fr_auto_auto_auto]"
                >
                  <div>
                    <strong className="text-zinc-200">{item.nome}</strong>
                    <p className="text-xs text-zinc-500">{item.categoria} · {item.pontos_necessarios.toLocaleString('pt-BR')} pontos</p>
                  </div>
                  <span className={`text-xs font-semibold ${item.estoque < 5 ? 'text-red-400' : 'text-zinc-400'}`}>
                    Estoque: {item.estoque}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${item.ativo ? 'border-green-700 text-green-400' : 'border-zinc-700 text-zinc-500'}`}>
                    {item.ativo ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* Resgates Tab */}
      {tab === 'resgates' && (
        <div className="space-y-4">
          {pendentes.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-4 text-lg font-bold text-zinc-100">Resgates aguardando aprovação</h2>
              <div className="space-y-2">
                {pendentes.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-800/40 bg-amber-950/20 p-3"
                  >
                    <div>
                      <strong className="text-zinc-200">{r.participante_nome}</strong>
                      <p className="text-xs text-zinc-500">{r.recompensa_nome} · {r.pontos} pontos</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        disabled={!canWrite}
                        onClick={() => void aprovarResgate(r)}
                        variant="ghost"
                      >
                        <CheckCircle size={13} /> Aprovar
                      </Button>
                      <Button
                        disabled={!canWrite}
                        onClick={() => void recusarResgate(r)}
                        variant="danger"
                      >
                        <XCircle size={13} /> Recusar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Card className="p-0">
            <div className="p-4">
              <h2 className="text-lg font-bold text-zinc-100">Histórico de resgates</h2>
            </div>
            <DataTable
              columns={resgatesColumns}
              emptyLabel="Nenhum resgate registrado."
              error={null}
              loading={loading}
              rows={resgates}
            />
          </Card>
        </div>
      )}

      {/* Campanhas Tab */}
      {tab === 'campanhas' && (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-100">Campanhas de Pontuação</h2>
            <Button disabled={!canWrite} onClick={() => setModalCampanha(true)}>
              <Plus size={14} /> Nova campanha
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {loading ? (
              <p className="text-sm text-zinc-500">Carregando...</p>
            ) : campanhas.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhuma campanha cadastrada.</p>
            ) : (
              campanhas.map((item) => (
                <button
                  key={item.id}
                  className={`rounded-lg border p-4 text-left transition ${
                    item.ativo ? 'border-brand-500/40 bg-brand-500/10' : 'border-zinc-800 opacity-70'
                  } ${!canWrite ? 'cursor-not-allowed' : ''}`}
                  disabled={!canWrite}
                  onClick={() => canWrite && void toggleCampanha(item)}
                >
                  <strong className="block text-zinc-200">{item.nome}</strong>
                  {item.descricao && <p className="mt-1 text-xs text-zinc-400">{item.descricao}</p>}
                  <span className="mt-2 block text-xs uppercase text-brand-400">
                    {item.ativo ? 'Ativa' : 'Inativa'}
                    {item.multiplicador > 1 && ` · ${item.multiplicador}x pontos`}
                  </span>
                </button>
              ))
            )}
          </div>
        </Card>
      )}

      {/* Modal Nova Recompensa */}
      <Modal
        footer={
          <Button form="clube-recompensa-form" type="submit">
            Salvar recompensa
          </Button>
        }
        isOpen={modalRecompensa}
        onClose={() => setModalRecompensa(false)}
        title="Nova recompensa"
      >
        <form className="grid gap-5 md:grid-cols-2" id="clube-recompensa-form" onSubmit={(e) => void addRecompensa(e)}>
          <div className="md:col-span-2">
            <FormField htmlFor="cr-nome" label="Nome">
              <input className={inputClassName} id="cr-nome" name="nome" required type="text" />
            </FormField>
          </div>
          <FormField htmlFor="cr-descricao" label="Descrição">
            <input className={inputClassName} id="cr-descricao" name="descricao" type="text" />
          </FormField>
          <FormField htmlFor="cr-categoria" label="Categoria">
            <input className={inputClassName} id="cr-categoria" name="categoria" required type="text" />
          </FormField>
          <FormField htmlFor="cr-pontos" label="Pontos necessários">
            <input className={inputClassName} id="cr-pontos" min={0} name="pontos" required type="number" />
          </FormField>
          <FormField htmlFor="cr-estoque" label="Estoque inicial">
            <input className={inputClassName} id="cr-estoque" min={0} name="estoque" required type="number" />
          </FormField>
        </form>
      </Modal>

      {/* Modal Nova Campanha */}
      <Modal
        footer={
          <Button form="clube-campanha-form" type="submit">
            Salvar campanha
          </Button>
        }
        isOpen={modalCampanha}
        onClose={() => setModalCampanha(false)}
        title="Nova campanha"
      >
        <form className="grid gap-5 md:grid-cols-2" id="clube-campanha-form" onSubmit={(e) => void addCampanha(e)}>
          <div className="md:col-span-2">
            <FormField htmlFor="cc-nome" label="Nome">
              <input className={inputClassName} id="cc-nome" name="nome" required type="text" />
            </FormField>
          </div>
          <FormField htmlFor="cc-descricao" label="Descrição">
            <input className={inputClassName} id="cc-descricao" name="descricao" type="text" />
          </FormField>
          <FormField htmlFor="cc-tipo" label="Tipo">
            <select className={inputClassName} id="cc-tipo" name="tipo">
              <option value="bonus">Bônus fixo</option>
              <option value="multiplicador">Multiplicador</option>
              <option value="especial">Especial</option>
            </select>
          </FormField>
          <FormField htmlFor="cc-multiplicador" label="Multiplicador de pontos (ex: 2 para dobrar)">
            <input className={inputClassName} defaultValue="1" id="cc-multiplicador" min={1} name="multiplicador" step="0.1" type="number" />
          </FormField>
        </form>
      </Modal>
    </section>
  );
}
