import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Gift, Megaphone, Users, TrendingUp, Award, ChevronRight, Plus, X, CheckCircle, XCircle } from 'lucide-react';
import { humanizeAdminError } from '@/lib/admin-error-messages';
import { Card } from '../../ui/Card';
import { PageHeader } from '../../ui/PageHeader';
import { DataTable, type DataTableColumn } from '../../ui/DataTable';
import { useToast } from '../../ui/useToast';
import { apiGet, apiPost, apiPatch } from '../../lib/api-client';

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
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 min-h-[44px] px-3 py-2 sm:min-h-0 sm:py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

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
  const { error: toastError, success: toastSuccess } = useToast();
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
      toastError(humanizeAdminError(err, 'Não foi possível carregar os dados do clube.'));
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => { void load(); }, [load]);

  async function toggleCampanha(campanha: Campanha) {
    try {
      await apiPatch<Campanha>(`clube_campanhas/${campanha.id}`, { ativo: !campanha.ativo });
      setCampanhas((all) => all.map((c) => c.id === campanha.id ? { ...c, ativo: !c.ativo } : c));
      toastSuccess(`Campanha ${campanha.ativo ? 'desativada' : 'ativada'}!`);
    } catch (error: unknown) {
      toastError(humanizeAdminError(error, 'Não foi possível alterar a campanha.'));
    }
  }

  async function aprovarResgate(id: string) {
    try {
      await apiPatch<Resgate>(`clube_resgates/${id}`, { status: 'aprovado' });
      setResgates((all) => all.map((r) => r.id === id ? { ...r, status: 'aprovado' as const } : r));
      toastSuccess('Resgate aprovado!');
    } catch (error: unknown) {
      toastError(humanizeAdminError(error, 'Não foi possível aprovar o resgate.'));
    }
  }

  async function recusarResgate(id: string) {
    try {
      await apiPatch<Resgate>(`clube_resgates/${id}`, { status: 'recusado' });
      setResgates((all) => all.map((r) => r.id === id ? { ...r, status: 'recusado' as const } : r));
      toastSuccess('Resgate recusado.');
    } catch (error: unknown) {
      toastError(humanizeAdminError(error, 'Não foi possível recusar o resgate.'));
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
      toastSuccess('Recompensa criada!');
    } catch (error: unknown) {
      toastError(humanizeAdminError(error, 'Não foi possível criar a recompensa.'));
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
      toastSuccess('Campanha criada!');
    } catch (error: unknown) {
      toastError(humanizeAdminError(error, 'Não foi possível criar a campanha.'));
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
      <div className="flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              tab === t.key
                ? 'bg-brand-500 text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
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
            <button
              className="flex items-center gap-2 rounded bg-brand-500 px-3 py-2 text-xs font-bold text-zinc-950"
              onClick={() => setModalRecompensa(true)}
            >
              <Plus size={14} /> Nova recompensa
            </button>
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
                      <button
                        className="flex items-center gap-1 rounded border border-green-700 bg-green-950 px-3 py-1.5 text-xs font-bold text-green-300"
                        onClick={() => void aprovarResgate(r.id)}
                      >
                        <CheckCircle size={13} /> Aprovar
                      </button>
                      <button
                        className="flex items-center gap-1 rounded border border-red-800 bg-red-950 px-3 py-1.5 text-xs font-bold text-red-300"
                        onClick={() => void recusarResgate(r.id)}
                      >
                        <XCircle size={13} /> Recusar
                      </button>
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
            <button
              className="flex items-center gap-2 rounded bg-brand-500 px-3 py-2 text-xs font-bold text-zinc-950"
              onClick={() => setModalCampanha(true)}
            >
              <Plus size={14} /> Nova campanha
            </button>
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
                  }`}
                  onClick={() => void toggleCampanha(item)}
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
      {modalRecompensa && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
          <form
            className="grid w-full max-w-lg gap-4 rounded-xl border border-zinc-700 bg-zinc-900 p-6"
            onSubmit={(e) => void addRecompensa(e)}
          >
            <div className="flex justify-between">
              <h2 className="text-xl font-bold text-zinc-100">Nova recompensa</h2>
              <button type="button" onClick={() => setModalRecompensa(false)}>
                <X className="text-zinc-400" size={20} />
              </button>
            </div>
            {[
              { name: 'nome', label: 'Nome', type: 'text' },
              { name: 'descricao', label: 'Descrição', type: 'text' },
              { name: 'categoria', label: 'Categoria', type: 'text' },
              { name: 'pontos', label: 'Pontos necessários', type: 'number' },
              { name: 'estoque', label: 'Estoque inicial', type: 'number' },
            ].map(({ name, label, type }) => (
              <label className="grid gap-1 text-sm text-zinc-300" key={name}>
                {label}
                <input
                  className={inputClassName}
                  min={type === 'number' ? 0 : undefined}
                  name={name}
                  required
                  type={type}
                />
              </label>
            ))}
            <button className="h-11 rounded bg-brand-500 font-bold text-zinc-950">Salvar recompensa</button>
          </form>
        </div>
      )}

      {/* Modal Nova Campanha */}
      {modalCampanha && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
          <form
            className="grid w-full max-w-lg gap-4 rounded-xl border border-zinc-700 bg-zinc-900 p-6"
            onSubmit={(e) => void addCampanha(e)}
          >
            <div className="flex justify-between">
              <h2 className="text-xl font-bold text-zinc-100">Nova campanha</h2>
              <button type="button" onClick={() => setModalCampanha(false)}>
                <X className="text-zinc-400" size={20} />
              </button>
            </div>
            <label className="grid gap-1 text-sm text-zinc-300">
              Nome
              <input className={inputClassName} name="nome" required type="text" />
            </label>
            <label className="grid gap-1 text-sm text-zinc-300">
              Descrição
              <input className={inputClassName} name="descricao" type="text" />
            </label>
            <label className="grid gap-1 text-sm text-zinc-300">
              Tipo
              <select className={inputClassName} name="tipo">
                <option value="bonus">Bônus fixo</option>
                <option value="multiplicador">Multiplicador</option>
                <option value="especial">Especial</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm text-zinc-300">
              Multiplicador de pontos (ex: 2 para dobrar)
              <input className={inputClassName} defaultValue="1" min={1} name="multiplicador" step="0.1" type="number" />
            </label>
            <button className="h-11 rounded bg-brand-500 font-bold text-zinc-950">Salvar campanha</button>
          </form>
        </div>
      )}
    </section>
  );
}
