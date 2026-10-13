import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Gift, Megaphone, Users, TrendingUp, Award, ChevronRight, Plus, X, CheckCircle, XCircle } from 'lucide-react';
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
  bronze: 'border-kib-aviso/40 bg-kib-aviso-fundo text-kib-aviso',
  prata: 'border-kib-borda-forte bg-kib-superficie text-kib-texto-2',
  ouro: 'border-kib-aviso bg-kib-aviso-fundo text-kib-aviso',
  platina: 'border-kib-roxo/40 bg-kib-roxo/10 text-kib-roxo',
};

const statusBadge: Record<string, string> = {
  pendente: 'border-kib-aviso/40 bg-kib-aviso-fundo text-kib-aviso',
  aprovado: 'border-kib-sucesso/40 bg-kib-sucesso-fundo text-kib-sucesso',
  recusado: 'border-kib-perigo/40 bg-kib-perigo-fundo text-kib-perigo',
  entregue: 'border-kib-info/40 bg-kib-info-fundo text-kib-info',
};

const inputClassName =
  'w-full rounded-lg border border-kib-borda-forte bg-kib-fundo min-h-[44px] px-3 py-2 sm:min-h-0 sm:py-2.5 text-sm text-kib-texto placeholder:text-kib-texto-3 focus:border-kib-acao focus:outline-none focus:ring-2 focus:ring-kib-acao/20';

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
      toastError(err instanceof Error ? err.message : 'Erro ao carregar dados');
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
    } catch {
      toastError('Erro ao alterar campanha');
    }
  }

  async function aprovarResgate(id: string) {
    try {
      await apiPatch<Resgate>(`clube_resgates/${id}`, { status: 'aprovado' });
      setResgates((all) => all.map((r) => r.id === id ? { ...r, status: 'aprovado' as const } : r));
      toastSuccess('Resgate aprovado!');
    } catch {
      toastError('Erro ao aprovar resgate');
    }
  }

  async function recusarResgate(id: string) {
    try {
      await apiPatch<Resgate>(`clube_resgates/${id}`, { status: 'recusado' });
      setResgates((all) => all.map((r) => r.id === id ? { ...r, status: 'recusado' as const } : r));
      toastSuccess('Resgate recusado.');
    } catch {
      toastError('Erro ao recusar resgate');
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
    } catch {
      toastError('Erro ao criar recompensa');
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
    } catch {
      toastError('Erro ao criar campanha');
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
            <Icon className="text-kib-acao" size={22} />
            <span className="mt-4 block text-xs font-bold uppercase text-kib-texto-3">{label}</span>
            <strong className="mt-1 block text-3xl text-kib-texto">{value}</strong>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-kib-borda bg-kib-superficie p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              tab === t.key
                ? 'bg-kib-acao text-kib-sobre-acao'
                : 'text-kib-texto-2 hover:text-kib-texto'
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
            <h2 className="text-lg font-bold text-kib-texto">Participantes do Clube</h2>
            <p className="text-sm text-kib-texto-2">{participantes.length} participante(s) cadastrado(s)</p>
          </div>
          <div className="divide-y divide-kib-borda">
            {loading ? (
              <div className="p-6 text-center text-kib-texto-3">Carregando...</div>
            ) : participantes.length === 0 ? (
              <div className="p-6 text-center text-kib-texto-3">Nenhum participante cadastrado.</div>
            ) : (
              participantes.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <strong className="text-kib-texto">{p.nome}</strong>
                    <p className="text-xs text-kib-texto-3">{p.email ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-sm font-bold text-kib-acao">
                      <TrendingUp size={14} />
                      {p.pontos.toLocaleString('pt-BR')} pts
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${nivelBadge[p.nivel] ?? ''}`}>
                      {p.nivel}
                    </span>
                    <ChevronRight className="text-kib-texto-3" size={16} />
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
            <h2 className="text-lg font-bold text-kib-texto">Recompensas e Estoque</h2>
            <button
              className="flex items-center gap-2 rounded bg-kib-acao px-3 py-2 text-xs font-bold text-kib-sobre-acao"
              onClick={() => setModalRecompensa(true)}
            >
              <Plus size={14} /> Nova recompensa
            </button>
          </div>
          <div className="space-y-2">
            {loading ? (
              <p className="text-sm text-kib-texto-3">Carregando...</p>
            ) : recompensas.length === 0 ? (
              <p className="text-sm text-kib-texto-3">Nenhuma recompensa cadastrada.</p>
            ) : (
              recompensas.map((item) => (
                <div
                  key={item.id}
                  className="grid items-center gap-3 rounded-lg border border-kib-borda p-3 md:grid-cols-[1fr_auto_auto_auto]"
                >
                  <div>
                    <strong className="text-kib-texto">{item.nome}</strong>
                    <p className="text-xs text-kib-texto-3">{item.categoria} · {item.pontos_necessarios.toLocaleString('pt-BR')} pontos</p>
                  </div>
                  <span className={`text-xs font-semibold ${item.estoque < 5 ? 'text-kib-perigo' : 'text-kib-texto-2'}`}>
                    Estoque: {item.estoque}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${item.ativo ? 'border-kib-sucesso/40 text-kib-sucesso' : 'border-kib-borda-forte text-kib-texto-3'}`}>
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
              <h2 className="mb-4 text-lg font-bold text-kib-texto">Resgates aguardando aprovação</h2>
              <div className="space-y-2">
                {pendentes.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-kib-aviso/40 bg-kib-aviso-fundo p-3"
                  >
                    <div>
                      <strong className="text-kib-texto">{r.participante_nome}</strong>
                      <p className="text-xs text-kib-texto-3">{r.recompensa_nome} · {r.pontos} pontos</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="flex items-center gap-1 rounded border border-kib-sucesso/40 bg-kib-sucesso-fundo px-3 py-1.5 text-xs font-bold text-kib-sucesso"
                        onClick={() => void aprovarResgate(r.id)}
                      >
                        <CheckCircle size={13} /> Aprovar
                      </button>
                      <button
                        className="flex items-center gap-1 rounded border border-kib-perigo/40 bg-kib-perigo-fundo px-3 py-1.5 text-xs font-bold text-kib-perigo"
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
              <h2 className="text-lg font-bold text-kib-texto">Histórico de resgates</h2>
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
            <h2 className="text-lg font-bold text-kib-texto">Campanhas de Pontuação</h2>
            <button
              className="flex items-center gap-2 rounded bg-kib-acao px-3 py-2 text-xs font-bold text-kib-sobre-acao"
              onClick={() => setModalCampanha(true)}
            >
              <Plus size={14} /> Nova campanha
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {loading ? (
              <p className="text-sm text-kib-texto-3">Carregando...</p>
            ) : campanhas.length === 0 ? (
              <p className="text-sm text-kib-texto-3">Nenhuma campanha cadastrada.</p>
            ) : (
              campanhas.map((item) => (
                <button
                  key={item.id}
                  className={`rounded-lg border p-4 text-left transition ${
                    item.ativo ? 'border-kib-acao/40 bg-kib-acao/10' : 'border-kib-borda opacity-70'
                  }`}
                  onClick={() => void toggleCampanha(item)}
                >
                  <strong className="block text-kib-texto">{item.nome}</strong>
                  {item.descricao && <p className="mt-1 text-xs text-kib-texto-2">{item.descricao}</p>}
                  <span className="mt-2 block text-xs uppercase text-kib-acao">
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-kib-sobreposicao p-4">
          <form
            className="grid w-full max-w-lg gap-4 rounded-xl border border-kib-borda-forte bg-kib-superficie p-6"
            onSubmit={(e) => void addRecompensa(e)}
          >
            <div className="flex justify-between">
              <h2 className="text-xl font-bold text-kib-texto">Nova recompensa</h2>
              <button type="button" onClick={() => setModalRecompensa(false)}>
                <X className="text-kib-texto-2" size={20} />
              </button>
            </div>
            {[
              { name: 'nome', label: 'Nome', type: 'text' },
              { name: 'descricao', label: 'Descrição', type: 'text' },
              { name: 'categoria', label: 'Categoria', type: 'text' },
              { name: 'pontos', label: 'Pontos necessários', type: 'number' },
              { name: 'estoque', label: 'Estoque inicial', type: 'number' },
            ].map(({ name, label, type }) => (
              <label className="grid gap-1 text-sm text-kib-texto-2" key={name}>
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
            <button className="h-11 rounded bg-kib-acao font-bold text-kib-sobre-acao">Salvar recompensa</button>
          </form>
        </div>
      )}

      {/* Modal Nova Campanha */}
      {modalCampanha && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-kib-sobreposicao p-4">
          <form
            className="grid w-full max-w-lg gap-4 rounded-xl border border-kib-borda-forte bg-kib-superficie p-6"
            onSubmit={(e) => void addCampanha(e)}
          >
            <div className="flex justify-between">
              <h2 className="text-xl font-bold text-kib-texto">Nova campanha</h2>
              <button type="button" onClick={() => setModalCampanha(false)}>
                <X className="text-kib-texto-2" size={20} />
              </button>
            </div>
            <label className="grid gap-1 text-sm text-kib-texto-2">
              Nome
              <input className={inputClassName} name="nome" required type="text" />
            </label>
            <label className="grid gap-1 text-sm text-kib-texto-2">
              Descrição
              <input className={inputClassName} name="descricao" type="text" />
            </label>
            <label className="grid gap-1 text-sm text-kib-texto-2">
              Tipo
              <select className={inputClassName} name="tipo">
                <option value="bonus">Bônus fixo</option>
                <option value="multiplicador">Multiplicador</option>
                <option value="especial">Especial</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm text-kib-texto-2">
              Multiplicador de pontos (ex: 2 para dobrar)
              <input className={inputClassName} defaultValue="1" min={1} name="multiplicador" step="0.1" type="number" />
            </label>
            <button className="h-11 rounded bg-kib-acao font-bold text-kib-sobre-acao">Salvar campanha</button>
          </form>
        </div>
      )}
    </section>
  );
}
