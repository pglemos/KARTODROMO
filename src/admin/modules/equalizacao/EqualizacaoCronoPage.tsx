'use client';

import { AlertTriangle, CheckCircle2, Gauge, RefreshCw, Timer, Wrench } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, type BadgeVariant } from '@/src/admin/ui/Badge';
import { Button } from '@/src/admin/ui/Button';
import { Card } from '@/src/admin/ui/Card';
import { PageHeader } from '@/src/admin/ui/PageHeader';
import { StatCard } from '@/src/admin/ui/StatCard';

/**
 * Equalização dos karts — leitura do que a cronometragem do kartódromo registrou (ORBITS, pela ponte):
 * histórico por data, meta de tempo por traçado e a matriz de cada equalização (blocos de 2 voltas por redutor,
 * karts referência, apontamentos da oficina). Criar e editar é no programa da Cronometragem, dentro do kartódromo.
 */

type Tracado = { id: string | null; name: string; lengthMeters: number };
type Resumo = {
  id: string; name: string; state: string; createdAt: number; startedAt: number | null; finishedAt: number | null; finalizadaEm: number | null;
  track: Tracado; mecanico: string; metaMs: number | null; metaOrigem: string; toleranciaMs: number; referencias: string[];
  karts: number; equalizados: number; ajustando: number; revisar: number; regra?: Regra;
};
type Regra = { nome: string; toleranciaMs: number; faixaMs: number; passoMm: number };
type Bloco = { bloco: number; rotulo: string; aberturaMm: number; voltasMs: number[]; mediaMs: number | null; deltaMs: number | null; dentro: boolean; completo: boolean; ajusteMm: number | null };
type Sistema = { status: 'ok' | 'atencao' | 'critico'; nota?: string };
type KartEq = {
  kart: string; piloto: string; referencia: boolean; voltas: number; melhorMs: number | null; mediaMs: number | null; blocos: Bloco[];
  redutorSugerido: string | null; status: string; acao: string;
  checklist: { sistemas?: Record<string, Sistema>; observacoes?: string; acaoOficina?: string } | null;
};
type Detalhe = Resumo & {
  resultado: { metaMs: number | null; toleranciaMs: number; referencias: { kart: string; melhorMs: number | null; mediaMs: number | null; voltas: number }[]; karts: KartEq[] };
  voltasDesdeUltima: Record<string, { voltas: number; baterias: number; desde: number | null }>;
};
type Meta = { id: string; trackId: string | null; track: string; metaMs: number; toleranciaMs: number; quando: number; origem: string; referencias?: string[] };

const SISTEMAS: [string, string][] = [['chassi', 'Chassi / direção'], ['pneu', 'Pneus'], ['motor', 'Motor'], ['embreagem', 'Embreagem'], ['freio', 'Freios']];
const ESTADOS: Record<string, string> = { preparando: 'Preparando', em_andamento: 'Em andamento', bandeira_final: 'Bandeira final', encerrada: 'Encerrada' };
const statusVariant: Record<string, BadgeVariant> = { REF: 'blue', EQUALIZADO: 'emerald', AJUSTANDO: 'amber', REVISAR: 'red' };
const sistemaCor: Record<string, string> = { ok: 'text-emerald-400', atencao: 'text-amber-300', critico: 'text-red-400' };
const sistemaNome: Record<string, string> = { ok: 'OK', atencao: 'Atenção', critico: 'Crítico' };

const tempo = (ms: number | null | undefined) => {
  if (ms == null || !(ms > 0)) return '–';
  // MM:SS:mmm (01:14:000), como na cronometragem: há traçado de mais de um minuto
  const t = Math.round(ms); const p = (n: number, d: number) => String(n).padStart(d, '0');
  return `${p(Math.floor(t / 60000), 2)}:${p(Math.floor((t % 60000) / 1000), 2)}:${p(t % 1000, 3)}`;
};
const delta = (ms: number | null) => (ms == null ? '' : `${ms > 0 ? '+' : ms < 0 ? '−' : '±'}${(Math.abs(ms) / 1000).toFixed(3)}`);
const dataHora = (ms: number | null) => (ms ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(ms)) : '–');
// milímetros do redutor e segundos em texto corrido com vírgula; os tempos de volta saem como MM:SS:mmm
const mm = (x: number) => Math.abs(x).toFixed(2).replace(/0$/, '').replace('.', ',');
const segs = (ms: number) => (ms / 1000).toFixed(3).replace('.', ',');
const ajuste = (x: number | null) => (x == null ? '' : x === 0 ? 'equalizado' : `${x > 0 ? 'abrir' : 'fechar'} ${mm(x)} mm`);

async function ler<T>(caminho: string): Promise<T> {
  const r = await fetch(`/api/admin/equalizacao/crono${caminho}`, { cache: 'no-store' });
  const j = (await r.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!r.ok || !j) throw new Error(j?.error || 'Não foi possível carregar a equalização.');
  return j;
}

export function EqualizacaoCronoPage() {
  const [lista, setLista] = useState<Resumo[]>([]);
  const [tracados, setTracados] = useState<Tracado[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [tracado, setTracado] = useState('*');
  const [aberta, setAberta] = useState<Detalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try {
      const filtro = tracado === '*' ? '' : `?trackId=${encodeURIComponent(tracado)}`;
      const [a, b] = await Promise.all([
        ler<{ equalizacoes: Resumo[]; tracks: Tracado[] }>(filtro),
        ler<{ metas: Meta[] }>(`/metas${filtro}`),
      ]);
      setLista(a.equalizacoes); setTracados(a.tracks); setMetas(b.metas);
    } catch (e) { setErro((e as Error).message); }
    finally { setCarregando(false); }
  }, [tracado]);

  useEffect(() => { void carregar(); }, [carregar]);

  const abrir = async (id: string) => {
    setErro(null);
    try { setAberta(await ler<Detalhe>(`/${encodeURIComponent(id)}`)); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    catch (e) { setErro((e as Error).message); }
  };

  const ultimaMeta = metas[0] ?? null;
  const totais = useMemo(() => ({
    equalizados: lista.reduce((t, e) => t + e.equalizados, 0),
    oficina: lista.reduce((t, e) => t + e.revisar, 0),
  }), [lista]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Oficina" title="Equalização dos karts" subtitle="Histórico por data, meta de tempo por traçado e a matriz de cada equalização. Os tempos vêm da cronometragem do kartódromo e ficam separados das baterias normais." />

      <div className="flex flex-col gap-3 rounded-xl border border-brand-900/50 bg-brand-950/20 p-4 text-sm text-brand-100 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Gauge aria-hidden="true" className="mt-0.5 flex-none text-brand-300" size={18} />
          <span className="text-xs leading-5 text-brand-100/80">Aqui é só consulta. Para criar uma equalização, escolher os karts referência, anotar os pontos da oficina e gerar o PDF, use a aba <strong>Equalização</strong> do programa da Cronometragem.</span>
        </div>
        <div className="flex flex-none items-center gap-2">
          <label className="sr-only" htmlFor="eq-tracado">Traçado</label>
          <select id="eq-tracado" className="h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100" value={tracado} onChange={(e) => { setAberta(null); setTracado(e.target.value); }}>
            <option value="*">Todos os traçados</option>
            {tracados.map((t) => <option key={t.id ?? ''} value={t.id ?? ''}>{t.name} · {t.lengthMeters} m</option>)}
          </select>
          <Button onClick={() => void carregar()} variant="ghost" loading={carregando}><RefreshCw aria-hidden="true" size={15} />Atualizar</Button>
        </div>
      </div>

      {erro ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-900/60 bg-red-950/20 p-4 text-sm text-red-100" role="alert">
          <AlertTriangle aria-hidden="true" className="mt-0.5 flex-none text-red-300" size={18} />
          <span>{erro}</span>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Timer} label="Equalizações" value={String(lista.length)} sub={tracado === '*' ? 'Todos os traçados' : 'No traçado escolhido'} loading={carregando} />
        <StatCard icon={Gauge} label="Meta mais recente" value={tempo(ultimaMeta?.metaMs)} sub={ultimaMeta ? `${ultimaMeta.track} · ± ${(ultimaMeta.toleranciaMs / 1000).toFixed(3)} s · ${dataHora(ultimaMeta.quando)}` : 'Nenhuma meta registrada'} loading={carregando} />
        <StatCard icon={CheckCircle2} label="Karts equalizados" value={String(totais.equalizados)} sub="Somando as equalizações listadas" loading={carregando} />
        <StatCard icon={Wrench} label="Para a oficina" value={String(totais.oficina)} sub="Ficaram fora da meta" loading={carregando} />
      </div>

      {aberta ? <DetalheEqualizacao e={aberta} fechar={() => setAberta(null)} /> : null}

      <Card className="p-4 md:p-5">
        <h2 className="text-base font-semibold text-zinc-50">Equalizações por data</h2>
        {!carregando && !lista.length ? <p className="mt-3 text-sm text-zinc-400">Nenhuma equalização registrada{tracado === '*' ? '' : ' neste traçado'}.</p> : null}
        {lista.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-zinc-500">
                <tr><th className="py-2 pr-3">Data</th><th className="py-2 pr-3">Equalização</th><th className="py-2 pr-3">Traçado</th><th className="py-2 pr-3 text-right">Meta</th><th className="py-2 pr-3">Referências</th><th className="py-2 pr-3 text-right">Karts</th><th className="py-2 pr-3 text-right">Equalizados</th><th className="py-2 pr-3 text-right">Oficina</th><th className="py-2">Situação</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 text-zinc-200">
                {lista.map((e) => (
                  <tr key={e.id} className="cursor-pointer hover:bg-zinc-800/40" onClick={() => void abrir(e.id)}>
                    <td className="py-2.5 pr-3 tabular-nums text-zinc-400">{dataHora(e.startedAt ?? e.createdAt)}</td>
                    <td className="py-2.5 pr-3 font-medium text-brand-300"><button className="text-left underline-offset-2 hover:underline" type="button" onClick={(ev) => { ev.stopPropagation(); void abrir(e.id); }}>{e.name}</button></td>
                    <td className="py-2.5 pr-3">{e.track.name}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{tempo(e.metaMs)} <span className="font-normal text-zinc-500">± {(e.toleranciaMs / 1000).toFixed(3)}</span></td>
                    <td className="py-2.5 pr-3 text-zinc-400">{e.referencias.map((k) => `#${k}`).join(', ') || '–'}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{e.karts}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{e.equalizados}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{e.revisar}</td>
                    <td className="py-2.5"><Badge variant={e.finalizadaEm ? 'emerald' : 'amber'}>{e.finalizadaEm ? 'Finalizada' : ESTADOS[e.state] ?? e.state}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <Card className="p-4 md:p-5">
        <h2 className="text-base font-semibold text-zinc-50">Meta de tempo por traçado</h2>
        <p className="mt-1 text-xs text-zinc-500">A meta não é fixa: cada equalização finalizada registra a sua, e a cronometragem pode definir uma meta fixa para o traçado.</p>
        {!carregando && !metas.length ? <p className="mt-3 text-sm text-zinc-400">Nenhuma meta registrada ainda.</p> : null}
        {metas.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-zinc-500"><tr><th className="py-2 pr-3">Data</th><th className="py-2 pr-3">Traçado</th><th className="py-2 pr-3 text-right">Meta</th><th className="py-2 pr-3 text-right">Tolerância</th><th className="py-2 pr-3">Origem</th><th className="py-2">Referências</th></tr></thead>
              <tbody className="divide-y divide-zinc-800 text-zinc-200">
                {metas.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2.5 pr-3 tabular-nums text-zinc-400">{dataHora(m.quando)}</td><td className="py-2.5 pr-3">{m.track}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{tempo(m.metaMs)}</td><td className="py-2.5 pr-3 text-right tabular-nums">± {(m.toleranciaMs / 1000).toFixed(3)}</td>
                    <td className="py-2.5 pr-3">{m.origem === 'manual' ? 'Meta fixa definida' : 'Equalização'}</td><td className="py-2.5 text-zinc-400">{(m.referencias ?? []).map((k) => `#${k}`).join(', ') || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function DetalheEqualizacao({ e, fechar }: { e: Detalhe; fechar: () => void }) {
  const r = e.resultado;
  const maxBlocos = Math.max(4, ...r.karts.filter((k) => !k.referencia).map((k) => k.blocos.length));
  const comApontamento = r.karts.filter((k) => k.checklist && (Object.keys(k.checklist.sistemas ?? {}).length || k.checklist.observacoes || k.checklist.acaoOficina));
  return (
    <Card className="p-4 md:p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-400">{dataHora(e.startedAt ?? e.createdAt)} · {e.track.name} · {e.track.lengthMeters} m</p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-50">{e.name}</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Meta <strong className="text-zinc-100">{tempo(r.metaMs)}</strong> ± {(r.toleranciaMs / 1000).toFixed(3)} s
            {r.referencias.length ? ` · referências: ${r.referencias.map((x) => `#${x.kart} ${tempo(x.melhorMs)}`).join(', ')}` : ''}
            {e.mecanico ? ` · responsável: ${e.mecanico}` : ''}
          </p>
          {e.regra ? <p className="mt-1 text-xs text-zinc-500">Regra do redutor ({e.regra.nome}): equalizado até ±{segs(e.regra.toleranciaMs)} s; depois, a cada {segs(e.regra.faixaMs)} s, {mm(e.regra.passoMm)} mm. Mais lento que a referência = abrir; mais rápido = fechar.</p> : null}
        </div>
        <Button onClick={fechar} variant="ghost">Fechar</Button>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="py-2 pr-3">Kart</th><th className="py-2 pr-3">Mecânico / piloto</th>
              {Array.from({ length: maxBlocos }, (_, i) => <th className="py-2 pr-3 text-right" key={i}>Bloco {i + 1}<span className="block font-normal normal-case tracking-normal">{i === 0 ? 'redutor inicial' : 'redutor trocado'}</span></th>)}
              <th className="py-2 pr-3">Redutor sugerido</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Ação recomendada</th><th className="py-2 text-right">Voltas desde a última</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 text-zinc-200">
            {r.karts.map((k) => {
              const v = e.voltasDesdeUltima[k.kart];
              return (
                <tr key={k.kart}>
                  <td className="py-2.5 pr-3 font-semibold tabular-nums">#{k.kart}</td>
                  <td className="py-2.5 pr-3">{k.piloto}</td>
                  {k.referencia ? (
                    <td className="py-2.5 pr-3 text-zinc-400" colSpan={maxBlocos}>Melhor <strong className="text-zinc-100">{tempo(k.melhorMs)}</strong> · média {tempo(k.mediaMs)} · {k.voltas} volta(s) — base de comparação</td>
                  ) : Array.from({ length: maxBlocos }, (_, i) => {
                    const b = k.blocos[i];
                    if (!b) return <td className="py-2.5 pr-3 text-right text-zinc-600" key={i}>–</td>;
                    return (
                      <td className={`py-2.5 pr-3 text-right tabular-nums ${b.dentro && b.completo ? 'font-semibold text-emerald-400' : ''}`} key={i}>
                        {b.voltasMs.map(tempo).join(' / ')}{b.completo ? '' : ' / …'}
                        <span className="block text-xs font-normal text-zinc-500">{b.completo ? `média ${tempo(b.mediaMs)} (${delta(b.deltaMs)})` : 'falta 1 volta'}</span>
                        <span className="block text-xs font-normal text-zinc-400">{b.rotulo}{b.ajusteMm != null ? ` → ${ajuste(b.ajusteMm)}` : ''}</span>
                      </td>
                    );
                  })}
                  <td className="py-2.5 pr-3">{k.redutorSugerido ?? '–'}</td>
                  <td className="py-2.5 pr-3"><Badge variant={statusVariant[k.status] ?? 'zinc'}>{k.status}</Badge></td>
                  <td className="py-2.5 pr-3 text-zinc-300">{k.acao}</td>
                  <td className="py-2.5 text-right tabular-nums">{v ? v.voltas : 0}<span className="block text-xs text-zinc-500">{v ? `${v.baterias} bateria(s)` : ''}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h3 className="mt-6 text-sm font-semibold text-zinc-50">Apontamentos técnicos · checklist da oficina</h3>
      {!comApontamento.length ? <p className="mt-2 text-sm text-zinc-400">Nenhum apontamento registrado para os karts desta equalização.</p> : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-zinc-500"><tr><th className="py-2 pr-3">Kart</th>{SISTEMAS.map(([id, nome]) => <th className="py-2 pr-3" key={id}>{nome}</th>)}<th className="py-2 pr-3">Observações</th><th className="py-2">Ação da oficina / peças</th></tr></thead>
            <tbody className="divide-y divide-zinc-800 text-zinc-200">
              {comApontamento.map((k) => (
                <tr key={k.kart}>
                  <td className="py-2.5 pr-3 font-semibold tabular-nums">#{k.kart}</td>
                  {SISTEMAS.map(([id]) => {
                    const s = k.checklist?.sistemas?.[id];
                    return <td className="py-2.5 pr-3" key={id}>{s ? <><strong className={sistemaCor[s.status]}>{sistemaNome[s.status]}</strong>{s.nota ? <span className="block text-xs text-zinc-400">{s.nota}</span> : null}</> : <span className="text-zinc-600">–</span>}</td>;
                  })}
                  <td className="py-2.5 pr-3 text-zinc-300">{k.checklist?.observacoes || '–'}</td>
                  <td className="py-2.5 text-zinc-300">{k.checklist?.acaoOficina || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-xs leading-5 text-zinc-500">Cada bloco são 2 voltas com um redutor: o bloco 1 é com o redutor que estava no kart e a diferença para a meta diz quanto abrir ou fechar para o bloco seguinte. Vale o último bloco: dentro da faixa de equalizado, o kart é liberado com aquele redutor. O PDF para a oficina sai pela Cronometragem (Equalização › Relatório para a oficina).</p>
    </Card>
  );
}
