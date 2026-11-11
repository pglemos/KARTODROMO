'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import { Search, Trophy, Timer, Calendar, FileText, Printer, QrCode, ArrowLeft, ChevronRight, X, AlertCircle, Eye, Flag, User, Copy, Check, ExternalLink } from 'lucide-react';

interface PodiumItem {
  posicao: number;
  piloto: string;
  kart: string;
  tempoMs: number | null;
  tempoFmt: string;
  voltas: number;
}

interface BateriaSummary {
  sessionId: string;
  nome: string;
  horario: string;
  data: string;
  tipo: 'classificacao' | 'corrida';
  tipoRotulo: string;
  criterio: string;
  totalPilotos: number;
  melhorVolta: {
    tempoMs: number;
    tempoFmt: string;
    piloto: string;
    kart: string;
  } | null;
  podio: PodiumItem[];
}

interface IdentResult {
  total: number;
  tipo?: string;
  kart?: string | number;
  piloto?: { nome?: string };
}

const mensagemDeErro = (err: unknown, padrao: string) => (err instanceof Error && err.message ? err.message : padrao);

interface StandingRow {
  posicao: number;
  kart: string;
  piloto: string;
  customerId: string;
  voltas: number;
  melhorVoltaMs: number | null;
  melhorVoltaFmt: string;
  difLider: string;
  difAnterior: string;
  velocidadeKmh: string;
  isMelhorVoltaSessao: boolean;
}

interface BateriaDetail {
  sessionId: string;
  nome: string;
  horario: string;
  data: string;
  tipo: 'classificacao' | 'corrida';
  tipoRotulo: string;
  criterio: string;
  totalPilotos: number;
  melhorVoltaSessao: {
    tempoMs: number;
    tempoFmt: string;
    piloto: string;
    kart: string;
  } | null;
  classificacao: StandingRow[];
}

interface LapItem {
  volta: number;
  tempoMs: number;
  tempoFmt: string;
  dmv: string;
  dlcat: string;
  velocidadeKmh: string;
  hora: string;
  isPersonalBest: boolean;
  isSessionBest: boolean;
  anulada: boolean;
  penalidade: string;
}

interface DriverTelemetry {
  kart: string;
  piloto: string;
  totalVoltas: number;
  melhorVoltaFmt: string;
  mediaVoltaFmt: string;
  voltas: LapItem[];
}

const API_BASE = typeof window !== 'undefined' && window.location.hostname === 'resultados.kartodromodebetim.com.br' ? '' : 'https://resultados.kartodromodebetim.com.br';

export function ResultadosClient() {
  const [data, setData] = useState<string>('');
  const [baterias, setBaterias] = useState<BateriaSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'all' | 'tomada' | 'corrida'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Selected session & driver
  const [selectedBateria, setSelectedBateria] = useState<BateriaDetail | null>(null);
  const [, setLoadingBateria] = useState<boolean>(false);
  const [inSessionFilter, setInSessionFilter] = useState<string>('');

  // Lap-by-lap telemetry
  const [selectedDriverLaps, setSelectedDriverLaps] = useState<DriverTelemetry | null>(null);
  const [, setLoadingLaps] = useState<boolean>(false);

  // QR modal & Sheet preview modal
  const [qrModalOpen, setQrModalOpen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [previewSheet, setPreviewSheet] = useState<{ url: string; title: string } | null>(null);

  // Identification banner
  const [identResult, setIdentResult] = useState<IdentResult | null>(null);

  // Initial load & URL query handling
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get('session');
    const kartParam = params.get('kart');
    const qParam = params.get('q') || params.get('cpf') || params.get('email');
    const dataParam = params.get('data');

    const todayStr = new Date().toISOString().slice(0, 10);
    const initialDate = dataParam || todayStr;
    setData(initialDate);

    fetchBaterias(initialDate).then(() => {
      if (sessionParam) {
        handleOpenBateria(sessionParam, kartParam);
      } else if (qParam) {
        setSearchTerm(qParam);
        handleIdentify(qParam);
      }
    });
    // Carga inicial: roda uma vez, ao abrir a página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBaterias = async (targetDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/baterias?data=${encodeURIComponent(targetDate)}`);
      if (!res.ok) throw new Error('Falha ao carregar as baterias da data.');
      const json = (await res.json()) as { baterias?: BateriaSummary[] };
      setBaterias(json.baterias || []);
    } catch (err) {
      setError(mensagemDeErro(err, 'Erro ao carregar baterias.'));
    } finally {
      setLoading(false);
    }
  };

  const handleIdentify = async (term: string) => {
    if (!term || term.trim().length < 2) {
      setIdentResult(null);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/identificar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identificador: term.trim() }),
      });
      if (res.ok) {
        const json = (await res.json()) as IdentResult;
        if (json.total > 0) {
          setIdentResult(json);
        } else {
          setIdentResult(null);
        }
      }
    } catch {
      // silent
    }
  };

  const handleOpenBateria = async (sessionId: string, kartToHighlight?: string | null) => {
    setLoadingBateria(true);
    try {
      const res = await fetch(`${API_BASE}/api/bateria/${encodeURIComponent(sessionId)}`);
      if (!res.ok) throw new Error('Não foi possível carregar a bateria.');
      const detail: BateriaDetail = await res.json();
      setSelectedBateria(detail);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (kartToHighlight) {
        handleOpenLaps(sessionId, kartToHighlight);
      }
    } catch (err) {
      alert(`Erro: ${mensagemDeErro(err, 'falha inesperada')}`);
    } finally {
      setLoadingBateria(false);
    }
  };

  const handleOpenLaps = async (sessionId: string, kart: string) => {
    setLoadingLaps(true);
    try {
      const res = await fetch(`${API_BASE}/api/bateria/${encodeURIComponent(sessionId)}/voltas?kart=${encodeURIComponent(kart)}`);
      if (!res.ok) throw new Error('Não foi possível carregar as voltas.');
      const json = (await res.json()) as { pilotos?: DriverTelemetry[] };
      const driverData = json.pilotos?.[0] || null;
      setSelectedDriverLaps(driverData);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      alert(`Erro: ${mensagemDeErro(err, 'falha inesperada')}`);
    } finally {
      setLoadingLaps(false);
    }
  };

  // Filtered baterias
  const filteredBaterias = useMemo(() => {
    let list = baterias;
    if (activeTab === 'tomada') list = list.filter((b) => b.tipo === 'classificacao');
    if (activeTab === 'corrida') list = list.filter((b) => b.tipo === 'corrida');
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (b) =>
          b.nome.toLowerCase().includes(term) ||
          b.podio?.some((p) => p.piloto.toLowerCase().includes(term) || p.kart.includes(term)),
      );
    }
    return list;
  }, [baterias, activeTab, searchTerm]);

  // Filtered classification rows inside a session
  const filteredStandings = useMemo(() => {
    if (!selectedBateria) return [];
    if (!inSessionFilter.trim()) return selectedBateria.classificacao;
    const term = inSessionFilter.toLowerCase();
    return selectedBateria.classificacao.filter(
      (r) => r.piloto.toLowerCase().includes(term) || r.kart.includes(term),
    );
  }, [selectedBateria, inSessionFilter]);

  const copyUrl = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#030504] text-[#f7faf6] flex flex-col font-sans selection:bg-[#00ff7a] selection:text-black">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        {/* VIEW 3: VOLTA A VOLTA TELEMETRY */}
        {selectedDriverLaps && selectedBateria ? (
          <div>
            <button
              onClick={() => setSelectedDriverLaps(null)}
              className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#00ff7a] hover:underline mb-6"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar para a classificação da bateria
            </button>

            {/* Driver Hero Header */}
            <div className="bg-[#0b100c] border border-[#00ff7a]/40 rounded-2xl p-6 mb-6 shadow-2xl flex flex-wrap justify-between items-center gap-6">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-xl bg-[#00ff7a]/10 border-2 border-[#00ff7a] flex items-center justify-center text-3xl font-black font-mono text-[#00ff7a] shadow-[0_0_20px_rgba(0,255,122,0.3)]">
                  #{selectedDriverLaps.kart}
                </div>
                <div>
                  <h1 className="text-2xl font-black uppercase tracking-tight text-white">{selectedDriverLaps.piloto}</h1>
                  <p className="text-sm text-zinc-400">{selectedBateria.nome} · Traçado Oficial</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="bg-[#111812] border border-white/10 rounded-xl px-4 py-2 text-center">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Melhor Volta</span>
                  <span className="text-xl font-black font-mono text-[#00ff7a]">{selectedDriverLaps.melhorVoltaFmt}</span>
                </div>
                <div className="bg-[#111812] border border-white/10 rounded-xl px-4 py-2 text-center">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Média Válida</span>
                  <span className="text-xl font-black font-mono text-zinc-200">{selectedDriverLaps.mediaVoltaFmt}</span>
                </div>
                <div className="bg-[#111812] border border-white/10 rounded-xl px-4 py-2 text-center">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Voltas</span>
                  <span className="text-xl font-black font-mono text-zinc-200">{selectedDriverLaps.totalVoltas}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                <button
                  onClick={() => setPreviewSheet({
                    url: `${API_BASE}/api/pdf/piloto/${encodeURIComponent(selectedBateria.sessionId)}/${encodeURIComponent(selectedDriverLaps.kart)}`,
                    title: `Folha A4 Volta a Volta · Kart #${selectedDriverLaps.kart}`,
                  })}
                  className="inline-flex items-center justify-center gap-2 bg-[#00ff7a] text-black font-black uppercase text-xs px-5 py-3 rounded-lg hover:bg-[#66ffa8] transition shadow-[0_0_15px_rgba(0,255,122,0.3)]"
                >
                  <Eye className="w-4 h-4" /> Ver Folha A4
                </button>
                <a
                  href={`${API_BASE}/api/pdf/piloto/${encodeURIComponent(selectedBateria.sessionId)}/${encodeURIComponent(selectedDriverLaps.kart)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white font-bold uppercase text-xs px-4 py-3 rounded-lg hover:bg-white/20 transition"
                >
                  <FileText className="w-4 h-4" /> PDF A4
                </a>
                <a
                  href={`${API_BASE}/api/pdf/piloto/${encodeURIComponent(selectedBateria.sessionId)}/${encodeURIComponent(selectedDriverLaps.kart)}?print=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white font-bold uppercase text-xs px-4 py-3 rounded-lg hover:bg-white/20 transition"
                >
                  <Printer className="w-4 h-4" /> Imprimir A4
                </a>
              </div>
            </div>

            {/* Laps Table */}
            <div className="bg-[#0b100c] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-[#111812] text-zinc-400 uppercase text-xs font-bold border-b border-white/10">
                    <tr>
                      <th className="py-3 px-4 text-center w-12">#</th>
                      <th className="py-3 px-4 text-right">Tempo da Volta</th>
                      <th className="py-3 px-4 text-right">Dif. Melhor (DMV)</th>
                      <th className="py-3 px-4 text-right">Dif. Líder (DLCAT)</th>
                      <th className="py-3 px-4 text-right">Vel. (Km/h)</th>
                      <th className="py-3 px-4 text-center">Hora</th>
                      <th className="py-3 px-4">Status / Punições</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {selectedDriverLaps.voltas.map((lap) => (
                      <tr
                        key={lap.volta}
                        className={lap.isPersonalBest ? 'bg-[#00ff7a]/10 font-bold' : 'hover:bg-white/[0.02]'}
                      >
                        <td className="py-3 px-4 text-center text-zinc-400">{lap.volta}</td>
                        <td
                          className={`py-3 px-4 text-right font-black ${
                            lap.isSessionBest ? 'text-[#b388ff]' : lap.isPersonalBest ? 'text-[#00ff7a]' : 'text-white'
                          }`}
                        >
                          {lap.tempoFmt}
                        </td>
                        <td className="py-3 px-4 text-right text-zinc-300">{lap.dmv}</td>
                        <td className="py-3 px-4 text-right text-zinc-300">{lap.dlcat}</td>
                        <td className="py-3 px-4 text-right text-zinc-300">{lap.velocidadeKmh}</td>
                        <td className="py-3 px-4 text-center text-zinc-400">{lap.hora}</td>
                        <td className="py-3 px-4 font-sans text-xs">
                          {lap.anulada ? (
                            <span className="text-red-400 font-bold">Anulada</span>
                          ) : lap.penalidade ? (
                            <span className="text-yellow-400">{lap.penalidade}</span>
                          ) : (
                            <span className="text-zinc-500">Regular</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : selectedBateria ? (
          /* VIEW 2: CLASSIFICAÇÃO OFICIAL DA BATERIA */
          <div>
            <button
              onClick={() => {
                setSelectedBateria(null);
                setSelectedDriverLaps(null);
              }}
              className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#00ff7a] hover:underline mb-6"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar para todas as baterias
            </button>

            {/* Bateria Card Header */}
            <div className="bg-[#0b100c] border border-white/10 rounded-2xl p-6 mb-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#00ff7a]" />
              <div className="flex flex-wrap justify-between items-start gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs uppercase font-extrabold bg-[#00ff7a]/15 text-[#00ff7a] px-3 py-1 rounded-md border border-[#00ff7a]/30">
                      {selectedBateria.tipoRotulo}
                    </span>
                    <span className="text-xs text-zinc-400 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-zinc-400" /> {selectedBateria.data}</span>
                    <span className="text-xs text-zinc-400 flex items-center gap-1.5"><Flag className="w-3.5 h-3.5 text-zinc-400" /> Traçado Principal · 1.120 m</span>
                  </div>
                  <h1 className="text-3xl font-black uppercase tracking-tight text-white mb-2">
                    {selectedBateria.nome}
                  </h1>
                  <p className="text-sm text-zinc-300">
                    Critério de classificação: <strong className="text-[#00ff7a]">{selectedBateria.criterio}</strong> · Total de competidores: <strong>{selectedBateria.totalPilotos}</strong>
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setPreviewSheet({
                      url: `${API_BASE}/api/pdf/bateria/${encodeURIComponent(selectedBateria.sessionId)}`,
                      title: `Folha A4 Oficial · ${selectedBateria.nome}`,
                    })}
                    className="inline-flex items-center gap-2 bg-[#00ff7a] text-black font-black uppercase text-xs px-5 py-3 rounded-lg hover:bg-[#66ffa8] transition shadow-[0_0_15px_rgba(0,255,122,0.3)]"
                  >
                    <Eye className="w-4 h-4" /> Ver Folha A4
                  </button>
                  <a
                    href={`${API_BASE}/api/pdf/bateria/${encodeURIComponent(selectedBateria.sessionId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white font-bold uppercase text-xs px-4 py-3 rounded-lg hover:bg-white/20 transition"
                  >
                    <FileText className="w-4 h-4" /> PDF A4
                  </a>
                  <a
                    href={`${API_BASE}/api/pdf/bateria/${encodeURIComponent(selectedBateria.sessionId)}?print=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white font-bold uppercase text-xs px-4 py-3 rounded-lg hover:bg-white/20 transition"
                  >
                    <Printer className="w-4 h-4" /> Imprimir A4
                  </a>
                  <button
                    onClick={() => setQrModalOpen(true)}
                    className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white font-bold uppercase text-xs px-4 py-3 rounded-lg hover:bg-white/20 transition"
                  >
                    <QrCode className="w-4 h-4" /> QR Code
                  </button>
                </div>
              </div>

              {/* Pole / Fastest Lap Hero Callout */}
              {selectedBateria.melhorVoltaSessao && (
                <div className="mt-6 bg-gradient-to-r from-[#b388ff]/15 to-transparent border border-[#b388ff]/30 rounded-xl p-4 flex flex-wrap justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-black uppercase bg-[#b388ff] text-black px-2.5 py-1 rounded">
                      Melhor Volta da Sessão
                    </span>
                    <div>
                      <div className="font-bold text-white text-base">{selectedBateria.melhorVoltaSessao.piloto}</div>
                      <div className="text-xs text-zinc-400">Kart #{selectedBateria.melhorVoltaSessao.kart}</div>
                    </div>
                  </div>
                  <div className="font-mono text-2xl font-black text-[#00ff7a]">
                    {selectedBateria.melhorVoltaSessao.tempoFmt}
                  </div>
                </div>
              )}
            </div>

            {/* In-Session Search Filter */}
            <div className="flex justify-between items-center mb-4 gap-4 flex-wrap">
              <h2 className="text-xl font-black uppercase italic tracking-tight text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#ffd700]" /> Classificação Oficial
              </h2>

              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Filtrar por Kart (#) ou Piloto..."
                  value={inSessionFilter}
                  onChange={(e) => setInSessionFilter(e.target.value)}
                  className="w-full bg-[#0b100c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#00ff7a]"
                />
              </div>
            </div>

            {/* Standings Table */}
            <div className="bg-[#0b100c] border border-white/10 rounded-2xl overflow-hidden shadow-xl mb-12">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-[#111812] text-zinc-400 uppercase text-xs font-bold border-b border-white/10">
                    <tr>
                      <th className="py-3 px-4 text-center w-14">POS</th>
                      <th className="py-3 px-4 text-center w-16">KART</th>
                      <th className="py-3 px-4">PILOTO</th>
                      <th className="py-3 px-4 text-right">VOLTAS</th>
                      <th className="py-3 px-4 text-right">MELHOR VOLTA</th>
                      <th className="py-3 px-4 text-right">DIF. LÍDER</th>
                      <th className="py-3 px-4 text-right">DIF. ANT.</th>
                      <th className="py-3 px-4 text-right">VEL. (KM/H)</th>
                      <th className="py-3 px-4 text-right">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredStandings.map((r) => (
                      <tr key={`${r.posicao}-${r.kart}`} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3 px-4 text-center">
                          {r.posicao === 1 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#ffd700] text-black font-black text-xs shadow-[0_0_10px_rgba(255,215,0,0.5)]">
                              1
                            </span>
                          ) : r.posicao === 2 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#c0c7d1] text-black font-black text-xs">
                              2
                            </span>
                          ) : r.posicao === 3 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#cd7f32] text-black font-black text-xs">
                              3
                            </span>
                          ) : (
                            <span className="font-mono font-bold text-zinc-400">{r.posicao}º</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-mono font-black text-[#00ff7a] bg-[#00ff7a]/10 border border-[#00ff7a]/30 px-2 py-1 rounded">
                            #{r.kart}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-white">{r.piloto}</td>
                        <td className="py-3 px-4 text-right font-mono text-zinc-300">{r.voltas}</td>
                        <td
                          className={`py-3 px-4 text-right font-mono font-bold ${
                            r.isMelhorVoltaSessao ? 'text-[#b388ff]' : 'text-white'
                          }`}
                        >
                          {r.melhorVoltaFmt}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-zinc-400">{r.difLider}</td>
                        <td className="py-3 px-4 text-right font-mono text-zinc-400">{r.difAnterior}</td>
                        <td className="py-3 px-4 text-right font-mono text-zinc-400">{r.velocidadeKmh}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleOpenLaps(selectedBateria.sessionId, r.kart)}
                              className="px-2.5 py-1 rounded bg-[#111812] border border-white/20 text-xs font-bold uppercase hover:bg-[#00ff7a] hover:text-black transition inline-flex items-center gap-1.5"
                            >
                              <Timer className="w-3.5 h-3.5" /> Voltas
                            </button>
                            <button
                              onClick={() => setPreviewSheet({
                                url: `${API_BASE}/api/pdf/piloto/${encodeURIComponent(selectedBateria.sessionId)}/${encodeURIComponent(r.kart)}`,
                                title: `Folha A4 Volta a Volta · Kart #${r.kart}`,
                              })}
                              className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-xs font-bold uppercase hover:bg-white/20 transition inline-flex items-center gap-1"
                            >
                              <FileText className="w-3.5 h-3.5" /> A4
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* VIEW 1: HUB PRINCIPAL (LISTA DE BATERIAS) */
          <div>
            {/* Hero Banner */}
            <div className="text-center py-8">
              <span className="inline-flex items-center gap-1.5 bg-[#00ff7a]/10 border border-[#00ff7a]/30 text-[#00ff7a] text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3">
                <Flag className="w-3.5 h-3.5" /> Central Oficial de Resultados
              </span>
              <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tight text-white mb-3">
                Resultados Oficiais &amp; <span className="text-[#00ff7a]">Volta a Volta</span>
              </h1>
              <p className="max-w-2xl mx-auto text-zinc-400 text-sm md:text-base leading-relaxed">
                Escaneie o QR Code ou selecione sua bateria abaixo para acessar a classificação oficial completa e baixar o seu relatório oficial em PDF.
              </p>
            </div>

            {/* Smart Search Bar */}
            <div className="bg-[#0b100c] border border-white/10 rounded-2xl p-5 mb-8 shadow-2xl relative">
              <div className="flex items-center bg-[#030504] border border-white/20 rounded-xl px-4 py-3 focus-within:border-[#00ff7a] transition-all">
                <Search className="w-5 h-5 text-zinc-400 mr-3" />
                <input
                  type="text"
                  placeholder="Digite o número do seu Kart (#), Nome, CPF ou E-mail..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    handleIdentify(e.target.value);
                  }}
                  className="bg-transparent flex-1 text-white placeholder-zinc-500 focus:outline-none text-base"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="text-zinc-400 hover:text-white p-1">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filters & Date Selector Row */}
              <div className="flex flex-wrap justify-between items-center gap-3 mt-4 pt-3 border-t border-white/5">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition ${
                      activeTab === 'all' ? 'bg-[#00ff7a] text-black' : 'bg-white/5 text-zinc-400 hover:text-white'
                    }`}
                  >
                    Todas as Baterias
                  </button>
                  <button
                    onClick={() => setActiveTab('tomada')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition inline-flex items-center gap-1.5 ${
                      activeTab === 'tomada' ? 'bg-[#00ff7a] text-black' : 'bg-white/5 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Timer className="w-3.5 h-3.5" /> Tomadas de Tempo
                  </button>
                  <button
                    onClick={() => setActiveTab('corrida')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition inline-flex items-center gap-1.5 ${
                      activeTab === 'corrida' ? 'bg-[#00ff7a] text-black' : 'bg-white/5 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Trophy className="w-3.5 h-3.5" /> Corridas
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 font-bold uppercase">Data:</span>
                  <input
                    type="date"
                    value={data}
                    onChange={(e) => {
                      if (e.target.value) {
                        setData(e.target.value);
                        fetchBaterias(e.target.value);
                      }
                    }}
                    className="bg-[#111812] border border-white/20 text-xs font-bold text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#00ff7a]"
                  />
                </div>
              </div>
            </div>

            {/* Identification Banner if driver recognized */}
            {identResult && (
              <div className="bg-gradient-to-r from-[#00ff7a]/20 to-[#0b100c] border border-[#00ff7a] rounded-xl p-4 mb-6 flex justify-between items-center gap-4 shadow-[0_0_20px_rgba(0,255,122,0.2)]">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#00ff7a] text-black flex items-center justify-center font-black text-lg">
                    {identResult.tipo === 'kart' ? `#${identResult.kart}` : <User className="w-5 h-5 text-black" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-white">
                      {identResult.piloto?.nome || (identResult.tipo === 'kart' ? `Kart #${identResult.kart}` : `Resultados para "${searchTerm}"`)}
                    </h3>
                    <p className="text-xs text-[#00ff7a]">
                      Encontramos {identResult.total} {identResult.total === 1 ? 'bateria' : 'baterias'} no seu histórico recente.
                    </p>
                  </div>
                </div>
                <button onClick={() => setIdentResult(null)} className="text-zinc-400 hover:text-white p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Baterias Grid */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-black uppercase italic tracking-tight text-white">
                Baterias do Dia ({filteredBaterias.length})
              </h2>
            </div>

            {loading ? (
              <div className="py-20 text-center">
                <div className="w-10 h-10 border-4 border-[#00ff7a]/20 border-t-[#00ff7a] rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm text-zinc-400">Carregando resultados da cronometragem...</p>
              </div>
            ) : filteredBaterias.length === 0 ? (
              <div className="bg-[#0b100c] border border-dashed border-white/10 rounded-2xl p-12 text-center my-8">
                <AlertCircle className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white uppercase mb-1">Nenhuma bateria encontrada</h3>
                <p className="text-sm text-zinc-400">Tente selecionar outra data ou limpe os filtros de busca.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
                {filteredBaterias.map((bateria) => (
                  <div
                    key={bateria.sessionId}
                    onClick={() => handleOpenBateria(bateria.sessionId)}
                    className="bg-[#0b100c] border border-white/10 hover:border-[#00ff7a]/50 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_10px_25px_rgba(0,0,0,0.5)] cursor-pointer group"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className="font-mono text-base font-black text-[#00ff7a] bg-[#00ff7a]/10 border border-[#00ff7a]/25 px-2.5 py-0.5 rounded-md">
                          {bateria.horario || 'PROVA'}
                        </span>
                        <span className="text-[11px] font-extrabold uppercase bg-white/10 text-zinc-300 px-2 py-0.5 rounded inline-flex items-center gap-1">
                          {bateria.tipo === 'corrida' ? <Trophy className="w-3 h-3 text-[#00ff7a]" /> : <Timer className="w-3 h-3 text-[#00ff7a]" />}
                          {bateria.tipo === 'corrida' ? 'Corrida' : 'Tomada'}
                        </span>
                      </div>

                      <h3 className="text-lg font-black uppercase tracking-tight text-white mb-2 group-hover:text-[#00ff7a] transition-colors">
                        {bateria.nome}
                      </h3>

                      <div className="flex items-center gap-3 text-xs text-zinc-400 mb-4">
                        <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {bateria.data}</span>
                        <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> {bateria.totalPilotos} pilotos</span>
                      </div>

                      {/* Best lap highlight */}
                      {bateria.melhorVolta && (
                        <div className="bg-[#b388ff]/10 border border-[#b388ff]/25 rounded-xl p-3 mb-4 flex justify-between items-center text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-[#b388ff] uppercase tracking-wider block">Melhor Volta</span>
                            <span className="font-bold text-white">{bateria.melhorVolta.piloto} (Kart #{bateria.melhorVolta.kart})</span>
                          </div>
                          <span className="font-mono text-sm font-black text-[#00ff7a]">{bateria.melhorVolta.tempoFmt}</span>
                        </div>
                      )}

                      {/* Podium 1-2-3 Mini Preview */}
                      <div className="flex gap-2 mb-4">
                        {bateria.podio.map((p) => (
                          <div
                            key={p.posicao}
                            className={`flex-1 rounded-lg p-2 text-xs border-l-2 bg-[#111812] ${
                              p.posicao === 1 ? 'border-l-[#ffd700]' : p.posicao === 2 ? 'border-l-[#c0c7d1]' : 'border-l-[#cd7f32]'
                            }`}
                          >
                            <span className="text-[10px] font-bold text-zinc-500 block">{p.posicao}º LUGAR</span>
                            <span className="font-bold text-white truncate block">{p.piloto}</span>
                            <span className="font-mono text-[10px] text-zinc-400">Kart #{p.kart}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-white/5">
                      <button className="flex-1 bg-[#00ff7a] text-black font-black uppercase text-xs py-2 rounded-lg group-hover:bg-[#66ffa8] transition flex items-center justify-center gap-1">
                        Ver Classificação <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewSheet({
                            url: `${API_BASE}/api/pdf/bateria/${encodeURIComponent(bateria.sessionId)}`,
                            title: `Folha A4 Oficial · ${bateria.nome}`,
                          });
                        }}
                        className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold uppercase transition flex items-center gap-1"
                        title="Visualizar Folha A4 Oficial"
                      >
                        <FileText className="w-3.5 h-3.5" /> A4
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Sheet Modal Preview (A4 Vertical) */}
      {previewSheet && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6">
          <div className="bg-[#1e2227] border border-[#00ff7a]/40 rounded-2xl w-full max-w-4xl h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center bg-[#14181c] px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="bg-[#00ff7a] text-black font-black text-[10px] px-2 py-0.5 rounded uppercase">
                  A4 Vertical
                </span>
                <h3 className="text-sm font-bold text-white uppercase truncate">
                  {previewSheet.title}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`${previewSheet.url}?print=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#00ff7a] text-black text-xs font-black px-3 py-1.5 rounded-lg hover:bg-[#66ffa8] transition inline-flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" /> Imprimir A4
                </a>
                <a
                  href={previewSheet.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white/10 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-white/20 transition inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Nova Guia
                </a>
                <button
                  onClick={() => setPreviewSheet(null)}
                  className="text-zinc-400 hover:text-white p-1 rounded-lg"
                  aria-label="Fechar visualizador"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-[#525659] relative">
              <iframe
                src={previewSheet.url}
                className="w-full h-full border-none"
                title="Folha A4 Oficial"
              />
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b100c] border border-white/20 rounded-2xl p-6 max-w-sm w-full text-center relative shadow-2xl">
            <button
              onClick={() => setQrModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-black uppercase italic tracking-tight text-white mb-2">
              QR Code do Resultado
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Aponte a câmera do celular para abrir direto este resultado no navegador:
            </p>

            <div className="bg-white p-4 rounded-xl inline-block mb-4 shadow-inner">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                  typeof window !== 'undefined' ? window.location.href : '',
                )}&bgcolor=ffffff&color=030504&margin=4`}
                alt="QR Code"
                className="w-48 h-48 block"
              />
            </div>

            <div className="flex justify-center">
              <button
                onClick={copyUrl}
                className="bg-[#00ff7a] text-black font-black uppercase text-xs px-5 py-2.5 rounded-lg hover:bg-[#66ffa8] transition inline-flex items-center gap-2"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedLink ? 'Link Copiado!' : 'Copiar Link Direto'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
