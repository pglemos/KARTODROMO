import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { idiomaInicial, trocarIdioma } from './i18n';
import { api, ErroApi, FINAIS, ID_PEDIDO, type Agenda, type Aviso, type Horario, type Corrida, type MinhaReserva, type MeuGrupo, type Pedido, type Politica, type TermoResp } from './api';
import {
  cpfValido, dataIso, deIso, diaChave, diaCurto, diaLongo, digitos, emailValido, erroInstagram, hora, ics, idade,
  mascaraCep, mascaraCpf, mascaraData, mascaraFone, menosUmaHora, nomeMes, nomeValido, reais,
} from './util';

const WHATS = '5531998842898';
const IDADE_MIN = 14;
const PASSOS = ['Corrida', 'Pilotos', 'Cadastro', 'Pagamento'] as const;

type Pessoa = { nome: string; documento: string; nascimento: string; email: string; telefone: string; instagram: string; peso: string; cep: string; endereco: string; complemento: string; bairro: string; cidade: string };
const vazia = (): Pessoa => ({ nome: '', documento: '', nascimento: '', email: '', telefone: '', instagram: '', peso: '', cep: '', endereco: '', complemento: '', bairro: '', cidade: '' });
type Rascunho = { bateriaId: number | null; quantidade: number; euPiloto: boolean; comprador: Pessoa; acomp: Pessoa[]; forma: 'pix' | 'cartao'; modo: 'tudo' | 'cada' };
const RASCUNHO0: Rascunho = { bateriaId: null, quantidade: 1, euPiloto: true, comprador: vazia(), acomp: [], forma: 'pix', modo: 'tudo' };
// "Cada um paga o seu" (decisões do dono, 12/11/2026): 2 a 10 pilotos e bateria a 24h ou mais (as vagas não pagas voltam para venda 24h antes)
const GRUPO_MIN = 2, GRUPO_MAX = 10, GRUPO_ANTECEDENCIA_H = 24;
const cadaPodeNoHorario = (h: Horario) => Date.parse(h.inicio.slice(0, 16) + ':00-03:00') - Date.now() >= GRUPO_ANTECEDENCIA_H * 3_600_000;
const cadaPode = (h: Horario, q: number) => q >= GRUPO_MIN && q <= GRUPO_MAX && cadaPodeNoHorario(h);
/** Modo valendo de fato: a escolha "cada" só vale se o horário e a quantidade permitem. */
const ehCada = (r: Rascunho, h: Horario | null, a: Agenda | null) => !!a?.grupoSite && r.modo === 'cada' && !!h && cadaPode(h, r.quantidade);

const mesclarPessoa = (raw: unknown): Pessoa => {
  const base = vazia();
  if (!raw || typeof raw !== 'object') return base;
  const src = raw as Record<string, unknown>;
  for (const k of Object.keys(base) as (keyof Pessoa)[]) {
    if (typeof src[k] === 'string') base[k] = src[k];
  }
  return base;
};
const lerRascunho = (): Rascunho => {
  try {
    const raw = sessionStorage.getItem('kib-rascunho');
    if (!raw) return RASCUNHO0;
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (!p || typeof p !== 'object') return RASCUNHO0;
    const bateriaId = typeof p.bateriaId === 'number' && Number.isFinite(p.bateriaId) ? p.bateriaId : null;
    const qtdRaw = typeof p.quantidade === 'number' && Number.isFinite(p.quantidade) ? Math.trunc(p.quantidade) : 1;
    const quantidade = Math.max(1, Math.min(20, qtdRaw));
    const euPiloto = typeof p.euPiloto === 'boolean' ? p.euPiloto : true;
    const forma = p.forma === 'cartao' ? 'cartao' : 'pix';
    const modo = p.modo === 'cada' ? 'cada' : 'tudo';
    const acomp = Array.isArray(p.acomp) ? p.acomp.slice(0, 19).map(mesclarPessoa) : [];
    return { bateriaId, quantidade, euPiloto, comprador: mesclarPessoa(p.comprador), acomp, forma, modo };
  } catch {
    return RASCUNHO0;
  }
};
const gravar = (k: string, v: unknown) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } };
function pedidoSalvo(): string | null {
  const h = /#p=([a-f0-9-]{36})/.exec(location.hash)?.[1];
  if (h && ID_PEDIDO.test(h)) return h;
  try { const x = localStorage.getItem('kib-reserva'); return x && ID_PEDIDO.test(x) ? x : null; } catch { return null; }
}
function guardarPedido(id: string | null) {
  try { if (id) localStorage.setItem('kib-reserva', id); else localStorage.removeItem('kib-reserva'); } catch { /* ok */ }
  history.replaceState(null, '', location.pathname + location.search + (id ? `#p=${id}` : ''));
}
function useOnline() {
  const [on, setOn] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  useEffect(() => {
    const up = () => setOn(true), dn = () => setOn(false);
    window.addEventListener('online', up); window.addEventListener('offline', dn);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', dn); };
  }, []);
  return on;
}
class ErroTela extends Component<{ children: ReactNode }, { falhou: boolean }> {
  state = { falhou: false };
  static getDerivedStateFromError() { return { falhou: true }; }
  render() {
    if (!this.state.falhou) return this.props.children;
    return (
      <div className="pagina estreita">
        <div className="cartao erro-bloco" role="alert">
          <strong>Algo deu errado nesta tela</strong>
          <p>Recarregue a página para continuar sua reserva sem perder os dados preenchidos.</p>
          <div className="acoes centro">
            <button type="button" className="btn" onClick={() => location.reload()}>Recarregar página</button>
            <a className="btn sec" href={`https://wa.me/${WHATS}`} target="_blank" rel="noopener">Falar com a recepção</a>
          </div>
        </div>
      </div>
    );
  }
}

// ------------------------------------------------------------------ ícones
const Ico = ({ d, s = 18 }: { d: string; s?: number }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const I = {
  voltar: 'M19 12H5m7 7-7-7 7-7', ajuda: 'M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.9-.9L3 21l1.9-5.1A8.4 8.4 0 1 1 21 11.5z', pino: 'M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zm0-9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  atualizar: 'M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6', esq: 'm15 18-6-6 6-6', dir: 'm9 18 6-6-6-6', relogio: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  compartilhar: 'M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v14', ok: 'M20 6 9 17l-5-5', escudo: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  bandeira: 'M4 21V4h13l-2 4 2 4H4', copiar: 'M9 9h11v11H9zM5 15H4V4h11v1', cal: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4', alerta: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  mais: 'M12 5v14M5 12h14', menos: 'M5 12h14', x: 'M18 6 6 18M6 6l12 12',
};

// ------------------------------------------------------------------ app
export default function App() {
  const [pedidoId, setPedidoId] = useState<string | null>(pedidoSalvo);
  const [minhas, setMinhas] = useState(() => location.hash === '#minhas');
  const online = useOnline();
  useEffect(() => { const f = () => setMinhas(location.hash === '#minhas'); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const abrirMinhas = (e: React.MouseEvent) => { e.preventDefault(); history.pushState(null, '', location.pathname + location.search + '#minhas'); setMinhas(true); window.scrollTo({ top: 0 }); };
  const sairMinhas = () => { history.pushState(null, '', location.pathname + location.search); setMinhas(false); };
  const [aviso, setAviso] = useState<Aviso>(null);
  useEffect(() => { api.aviso().then(setAviso); }, []);
  const novo = () => { guardarPedido(null); setPedidoId(null); window.scrollTo({ top: 0 }); };
  return (
    <>
      <a className="pular" href="#conteudo">Pular para a reserva</a>
      <header className="barra">
        <a href="https://kartodromodebetim.com.br" className="marca" aria-label="Kartódromo Internacional de Betim, site principal"><img src="/booking-media/logo.png" alt="Kartódromo Internacional de Betim" width="160" height="44" /></a>
        <nav className="barra-acoes">
          <button type="button" className="idioma" data-sem-traducao onClick={() => trocarIdioma(idiomaInicial() === 'en' ? 'pt' : 'en')} aria-label={idiomaInicial() === 'en' ? 'Ver em português' : 'View in English'}>{idiomaInicial() === 'en' ? 'PT' : 'EN'}</button>
          <a href="#minhas" onClick={abrirMinhas} className="lnk-claro sempre"><Ico d={I.cal} s={16} /><span>Minhas<span className="so-largo"> reservas</span></span></a>
          <a href="https://kartodromodebetim.com.br" className="lnk-claro"><Ico d={I.voltar} s={16} />Voltar ao site</a>
          <a href={`https://wa.me/${WHATS}`} target="_blank" rel="noopener" className="btn-claro"><Ico d={I.ajuda} s={16} /><span className="so-largo">Precisa de ajuda?</span><span className="so-celular">Ajuda</span></a>
        </nav>
      </header>
      {aviso && <div className={`aviso ${aviso.tom === 'alerta' ? 'alerta' : ''}`} role="status"><Ico d={I.alerta} s={18} /><p>{aviso.texto}</p></div>}
      {!online && <div className="aviso alerta" role="status"><Ico d={I.alerta} s={18} /><p>Você está sem internet. Reconecte-se para atualizar horários e concluir o pagamento.</p></div>}
      <main id="conteudo" tabIndex={-1}>
        <ErroTela>
          {minhas ? <MinhasReservas onVoltar={sairMinhas} onAbrir={(id) => { sairMinhas(); guardarPedido(id); setPedidoId(id); window.scrollTo({ top: 0 }); }} />
            : pedidoId ? <Acompanhar id={pedidoId} onNovo={novo} /> : <Reserva onCriado={(id) => { guardarPedido(id); setPedidoId(id); window.scrollTo({ top: 0 }); }} />}
        </ErroTela>
      </main>
      <footer className="rodape">
        <p>Kartódromo Internacional de Betim · Av. Adutora Várzea das Flores, 477 · Itacolomi · Betim/MG</p>
        <p><a href="https://maps.google.com/?q=Kart%C3%B3dromo+Internacional+de+Betim" target="_blank" rel="noopener">Como chegar</a> · <a href={`https://wa.me/${WHATS}`} target="_blank" rel="noopener">WhatsApp da recepção</a> · <span className="seguro"><Ico d={I.escudo} s={14} />Conexão segura</span></p>
      </footer>
    </>
  );
}

// ------------------------------------------------------------------ fluxo da reserva
function Reserva({ onCriado }: { onCriado: (id: string) => void }) {
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [erroAgenda, setErroAgenda] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [passo, setPasso] = useState(0);
  const [r, setR] = useState<Rascunho>(lerRascunho);
  const abertoEm = useRef(Date.now());
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const agendaSeq = useRef(0);
  const agendaAbort = useRef<AbortController | null>(null);
  useEffect(() => { gravar('kib-rascunho', { ...r, comprador: { ...r.comprador }, acomp: r.acomp }); }, [r]);

  const carregar = useCallback(async () => {
    agendaAbort.current?.abort();
    const ctl = new AbortController();
    agendaAbort.current = ctl;
    const seq = ++agendaSeq.current;
    setCarregando(true); setErroAgenda('');
    try {
      const data = await api.agenda(ctl.signal);
      if (seq === agendaSeq.current && !ctl.signal.aborted) setAgenda(data);
    } catch (e) {
      if (ctl.signal.aborted || seq !== agendaSeq.current) return;
      setErroAgenda((e as Error).message);
    } finally {
      if (seq === agendaSeq.current && !ctl.signal.aborted) setCarregando(false);
    }
  }, []);
  useEffect(() => { carregar(); return () => agendaAbort.current?.abort(); }, [carregar]);
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible' && passo === 0) carregar();
    }, 60000);
    return () => clearInterval(t);
  }, [passo, carregar]);

  const horario = agenda?.horarios.find((h) => h.id === r.bateriaId) ?? null;
  // horário escolhido sumiu da agenda (lotou ou passou do prazo)
  useEffect(() => { if (agenda && r.bateriaId && !horario) setR((x) => ({ ...x, bateriaId: null })); }, [agenda, r.bateriaId, horario]);
  const maxQtd = Math.max(1, Math.min(agenda?.maxPilotos ?? 10, horario?.livres ?? 10));
  useEffect(() => {
    if (passo > 0 && !(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement || document.activeElement instanceof HTMLSelectElement)) {
      tituloRef.current?.focus({ preventScroll: true });
    }
  }, [passo]);
  const ir = (p: number) => { setPasso(p); requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' })); };
  const titulos = ['Escolha quando correr.', 'Quem vai para a pista?', 'Dados de quem reserva e dos pilotos.', 'Confira e finalize.'];
  const subs = ['Selecione o dia e o horário da sua bateria.', 'Escolha quantos pilotos vão para a pista e se você vai correr.', 'A reserva deve ser feita por um adulto, que pode ou não pilotar.', 'Revise os detalhes da corrida e escolha como pagar.'];

  return (
    <div className="pagina">
      <div className="cabeca">
        <div className="cabeca-tit">
          <h1 ref={tituloRef} tabIndex={-1}>{titulos[passo]}</h1>
          <p className="sub">{subs[passo]}</p>
        </div>
        <p className="local"><Ico d={I.pino} s={16} />Betim, MG</p>
      </div>
      <ol className="passos" aria-label="Etapas da reserva">
        {PASSOS.map((p, i) => (
          <li key={p} className={i === passo ? 'atual' : i < passo ? 'feito' : ''} aria-current={i === passo ? 'step' : undefined}>
            {i < passo ? <button type="button" onClick={() => ir(i)}><span className="bola"><Ico d={I.ok} s={14} /></span>{p}</button> : <span><span className="bola">{i + 1}</span>{p}</span>}
          </li>
        ))}
      </ol>
      <div className="grade">
        <section className="cartao principal">
          {agenda && !agenda.pagamentoOnline && (
            <div className="aviso alerta" role="status" style={{ marginBottom: '16px' }}>
              <Ico d={I.alerta} s={18} />
              <p>Pagamento online indisponível no momento. Para reservar agora, fale com a recepção no WhatsApp.</p>
            </div>
          )}
          {agenda && erroAgenda && (
            <div className="aviso alerta aviso-inline" role="status" style={{ marginBottom: '16px' }}>
              <p>Não foi possível atualizar os horários agora. Exibindo o último carregamento.</p>
              <button type="button" className="btn sec" onClick={carregar}>Tentar novamente</button>
            </div>
          )}
          {passo === 0 && <EtapaCorrida agenda={agenda} carregando={carregando} erro={erroAgenda} recarregar={carregar} selecionado={r.bateriaId}
            onEscolher={(h) => { setR((x) => ({ ...x, bateriaId: h.id, quantidade: Math.min(x.quantidade, Math.max(1, Math.min(agenda?.maxPilotos ?? 10, h.livres))) })); ir(1); }} />}
          {passo === 1 && horario && <EtapaPilotos r={r} setR={setR} max={maxQtd} horario={horario} grupoSite={!!agenda?.grupoSite} voltar={() => ir(0)} avancar={() => ir(2)} />}
          {passo === 2 && horario && <EtapaCadastro r={r} setR={setR} cada={ehCada(r, horario, agenda)} voltar={() => ir(1)} avancar={() => ir(3)} />}
          {passo === 3 && horario && agenda && <EtapaPagamento r={r} setR={setR} cada={ehCada(r, horario, agenda)} horario={horario} agenda={agenda} abertoEm={abertoEm.current} voltar={() => ir(2)}
            onCriado={(id) => { try { sessionStorage.removeItem('kib-rascunho'); } catch { /* ok */ } onCriado(id); }}
            onIndisponivel={() => { setR((x) => ({ ...x, bateriaId: null })); carregar(); ir(0); }} />}
          {passo > 0 && !horario && <div className="vazio"><p>Esse horário não está mais disponível.</p><button type="button" className="btn" onClick={() => ir(0)}>Escolher outro horário</button></div>}
        </section>
        <Resumo horario={horario} r={r} agenda={agenda} cada={ehCada(r, horario, agenda)} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ 1. corrida
function EtapaCorrida({ agenda, carregando, erro, recarregar, selecionado, onEscolher }: {
  agenda: Agenda | null; carregando: boolean; erro: string; recarregar: () => void; selecionado: number | null; onEscolher: (h: Horario) => void;
}) {
  const porDia = useMemo(() => {
    const m = new Map<string, Horario[]>();
    for (const h of agenda?.horarios ?? []) { const k = diaChave(deIso(h.inicio)); (m.get(k) ?? m.set(k, []).get(k)!).push(h); }
    for (const l of m.values()) l.sort((a, b) => a.inicio.localeCompare(b.inicio));
    return m;
  }, [agenda]);
  const dias = [...porDia.keys()].sort();
  const pedidaUrl = new URLSearchParams(location.search).get('data');
  const [dia, setDia] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<'todos' | 'antes' | 'depois'>('todos');
  const [todos, setTodos] = useState(false);
  const [mes, setMes] = useState<[number, number] | null>(null);
  useEffect(() => {
    if (!dias.length || (dia && porDia.has(dia))) return;
    const sel = selecionado ? agenda?.horarios.find((h) => h.id === selecionado) : null;
    const inicial = sel ? diaChave(deIso(sel.inicio)) : pedidaUrl && porDia.has(pedidaUrl) ? pedidaUrl : dias[0];
    setDia(inicial);
    const [a, m] = inicial.split('-').map(Number); setMes([a, m - 1]);
  }, [dias.join(), porDia, dia, pedidaUrl, selecionado, agenda]);

  if (carregando && !agenda) return <div className="carregando" role="status">Consultando horários disponíveis…</div>;
  if (erro && !agenda) return <div className="erro-bloco" role="alert"><strong>Não foi possível carregar a agenda</strong><p>{erro}</p><button type="button" className="btn" onClick={recarregar}>Tentar de novo</button></div>;
  if (!agenda || !dias.length) return <div className="vazio"><strong>Sem horários disponíveis agora</strong><p>Novos horários abrem com frequência. Fale com a recepção para grupos e eventos.</p><a className="btn" href={`https://wa.me/${WHATS}`} target="_blank" rel="noopener">Falar com a recepção</a></div>;

  const lista = (porDia.get(dia ?? '') ?? []).filter((h) => { const hh = deIso(h.inicio).getHours(); return periodo === 'todos' || (periodo === 'antes' ? hh < 18 : hh >= 18); });
  const visiveis = todos ? lista : lista.slice(0, 6);
  const [ano, m] = mes ?? [new Date().getFullYear(), new Date().getMonth()];
  const primeiro = new Date(ano, m, 1);
  const celulas: (Date | null)[] = Array(primeiro.getDay()).fill(null);
  for (let d = 1; d <= new Date(ano, m + 1, 0).getDate(); d++) celulas.push(new Date(ano, m, d));
  const temAntes = dias.some((d) => d < `${ano}-${String(m + 1).padStart(2, '0')}-01`);
  const temDepois = dias.some((d) => d > `${ano}-${String(m + 1).padStart(2, '0')}-31`);
  const mudarMes = (delta: number) => { const n = new Date(ano, m + delta, 1); setMes([n.getFullYear(), n.getMonth()]); };
  const compartilhar = async () => {
    const url = `${location.origin}/?data=${dia}`;
    const texto = `Horários de kart em ${diaLongo(deIso(dia + 'T00:00'))} no Kartódromo de Betim`;
    try { if (navigator.share) await navigator.share({ title: 'Kartódromo de Betim', text: texto, url }); else { await navigator.clipboard.writeText(url); avisar('Link da data copiado'); } }
    catch { /* cancelado */ }
  };

  return (
    <>
      <div className="etapa-topo">
        <span className="num">01</span>
        <div><h2>Data e horário</h2><p className="muted">Baterias com vagas abertas. Toque em um horário para avançar.</p></div>
        <button type="button" className="ico-btn" onClick={recarregar} aria-label="Atualizar horários" title="Atualizar horários"><Ico d={I.atualizar} /></button>
      </div>
      <div className="corrida">
        <div className="calendario" aria-label="Dias com horários disponíveis">
          <div className="cal-topo">
            <button type="button" className="ico-btn" onClick={() => mudarMes(-1)} disabled={!temAntes} aria-label="Mês anterior"><Ico d={I.esq} /></button>
            <strong>{nomeMes(ano, m)}</strong>
            <button type="button" className="ico-btn" onClick={() => mudarMes(1)} disabled={!temDepois} aria-label="Próximo mês"><Ico d={I.dir} /></button>
          </div>
          <div className="cal-grade" role="grid">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <span key={i} className="cal-sem" aria-hidden="true">{d}</span>)}
            {celulas.map((c, i) => {
              if (!c) return <span key={i} />;
              const k = diaChave(c); const tem = porDia.has(k);
              const qtdH = tem ? porDia.get(k)!.length : 0;
              return <button type="button" key={i} className={`cal-dia${k === dia ? ' sel' : ''}${tem ? ' tem' : ''}`} disabled={!tem} aria-pressed={k === dia}
                aria-label={`${diaLongo(c)}${tem ? `, ${qtdH} ${qtdH === 1 ? 'horário' : 'horários'}` : ', sem horários'}`} onClick={() => { setDia(k); setTodos(false); }}>{c.getDate()}</button>;
            })}
          </div>
        </div>
        <div className="horarios">
          <div className="hor-topo">
            <div><strong className="dia-sel">{dia && diaCurto(deIso(dia + 'T00:00'))}</strong><p className="hor-sub">Horários de largada</p></div>
            <button type="button" className="lnk" onClick={compartilhar} aria-label="Compartilhar link com os horários deste dia"><Ico d={I.compartilhar} s={16} />Compartilhar data</button>
          </div>
          <div className="segmentos" role="radiogroup" aria-label="Filtrar por período">
            {([['todos', 'Todos'], ['antes', 'Antes das 18h'], ['depois', 'A partir das 18h']] as const).map(([v, t]) =>
              <button type="button" key={v} role="radio" aria-checked={periodo === v} className={periodo === v ? 'on' : ''} onClick={() => setPeriodo(v)}>{t}</button>)}
          </div>
          {visiveis.length ? (
            <div className="hor-lista">
              {visiveis.map((h) => {
                const dt = deIso(h.inicio); const esgotado = h.livres <= 0; const poucas = h.livres > 0 && h.livres <= 5;
                return (
                  <button type="button" key={h.id} className={`hor${h.id === selecionado ? ' sel' : ''}`} disabled={esgotado} onClick={() => onEscolher(h)} aria-label={`${hora(dt)}, ${esgotado ? 'esgotado' : h.livres === 1 ? '1 vaga' : `${h.livres} vagas`}, ${reais(h.precoCentavos)} por piloto`}>
                    <span className="hor-l"><strong>{hora(dt)}</strong><span className={`vagas${poucas || esgotado ? ' poucas' : ''}`}>{esgotado ? 'Esgotado' : poucas ? (h.livres === 1 ? 'Última vaga' : `Últimas ${h.livres}`) : `${h.livres} vagas`}</span></span>
                    <span className="hor-chegue">Chegue às {menosUmaHora(dt)}</span>
                    {(h.precoCentavos !== agenda.precoCentavos || h.precoPrimeiraVezCentavos) && <span className="hor-preco">{reais(h.precoCentavos)}{h.precoPrimeiraVezCentavos ? ` · 1ª vez ${reais(h.precoPrimeiraVezCentavos)}` : ''}</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="vazio-mini">
              <p className="muted">Nenhum horário disponível neste período. Troque o filtro acima ou escolha outro dia.</p>
              <button type="button" className="btn sec" style={{ marginTop: '10px' }} onClick={() => setPeriodo('todos')}>Ver todos os horários</button>
            </div>
          )}
          {lista.length > 6 && !todos && <button type="button" className="lnk centro" onClick={() => setTodos(true)}>Ver todos os horários ({lista.length})</button>}
        </div>
      </div>
      <div className="dica"><Ico d={I.relogio} /><p><strong>Planeje chegar uma hora antes.</strong> É o tempo do cadastro no totem, preparação e orientações de segurança.</p></div>
      <Requisitos />
    </>
  );
}

function Requisitos() {
  return (
    <details className="requisitos">
      <summary>Requisitos e orientações para pilotar</summary>
      <ul>
        <li>Idade mínima de {IDADE_MIN} anos e altura mín. 1,50 m.</li>
        <li>Não precisa de experiência nem de equipamento próprio.</li>
        <li>Use calçado fechado. Gestantes não podem pilotar.</li>
        <li>O termo de responsabilidade é assinado no kartódromo, antes da corrida.</li>
        <li>Menores de 18 anos precisam do responsável no dia para assinar o termo.</li>
      </ul>
    </details>
  );
}

// ------------------------------------------------------------------ 2. pilotos
function EtapaPilotos({ r, setR, max, horario, grupoSite, voltar, avancar }: { r: Rascunho; setR: React.Dispatch<React.SetStateAction<Rascunho>>; max: number; horario: Horario; grupoSite: boolean; voltar: () => void; avancar: () => void }) {
  const q = Math.min(r.quantidade, max);
  const mudar = (n: number) => setR((x) => ({ ...x, quantidade: Math.max(1, Math.min(max, n)) }));
  return (
    <>
      <div className="etapa-topo"><span className="num">02</span><div><h2>Pilotos</h2><p className="muted">Todos correm juntos na mesma bateria.</p></div></div>
      <div className="contador">
        <div className="contador-txt">
          <span id="lbl-qtd" className="contador-rot">Quantos pilotos?</span>
          <span className="muted pequeno">{`Máx. de ${max} ${max === 1 ? 'vaga' : 'vagas'} neste horário`}</span>
        </div>
        <div className="qtd" role="group" aria-labelledby="lbl-qtd">
          <button type="button" className="ico-btn" onClick={() => mudar(q - 1)} disabled={q <= 1} aria-label="Menos um piloto"><Ico d={I.menos} /></button>
          <output aria-live="polite">{q}</output>
          <button type="button" className="ico-btn" onClick={() => mudar(q + 1)} disabled={q >= max} aria-label="Mais um piloto"><Ico d={I.mais} /></button>
        </div>
      </div>
      {horario.precoPrimeiraVezCentavos ? <p className="dica-mini">{`Primeira vez no Kartódromo de Betim? Neste horário, cada piloto estreante paga ${reais(horario.precoPrimeiraVezCentavos)}. O desconto é conferido pelo CPF e aplicado na etapa de pagamento.`}</p> : null}
      <fieldset className="escolha">
        <legend>Você também vai pilotar?</legend>
        <label className={r.euPiloto ? 'on' : ''}><input type="radio" name="eu" checked={r.euPiloto} onChange={() => setR((x) => ({ ...x, euPiloto: true }))} /><span><strong>Sim, vou correr</strong><small>Uma das vagas é minha.</small></span></label>
        <label className={!r.euPiloto ? 'on' : ''}><input type="radio" name="eu" checked={!r.euPiloto} onChange={() => setR((x) => ({ ...x, euPiloto: false }))} /><span><strong>Não, só vou reservar</strong><small>Faço a reserva para outras pessoas.</small></span></label>
      </fieldset>
      {grupoSite && q >= GRUPO_MIN && (() => {
        const pode = cadaPode(horario, q);
        const cada = r.modo === 'cada' && pode;
        return (
          <fieldset className="escolha">
            <legend>Como vocês vão pagar?</legend>
            <label className={!cada ? 'on' : ''}><input type="radio" name="modo" checked={!cada} onChange={() => setR((x) => ({ ...x, modo: 'tudo' }))} /><span><strong>Eu pago tudo agora</strong><small>{`Você informa os dados de todos e paga as ${q} vagas juntas.`}</small></span></label>
            <label className={cada ? 'on' : ''} aria-disabled={!pode}><input type="radio" name="modo" checked={cada} disabled={!pode} onChange={() => setR((x) => ({ ...x, modo: 'cada' }))} /><span><strong>Cada um paga o seu</strong>
              <small>{!pode ? (q > GRUPO_MAX ? `Disponível para até ${GRUPO_MAX} pilotos. Para grupos maiores, fale com a recepção.` : `Disponível apenas para baterias com ${GRUPO_ANTECEDENCIA_H}h ou mais de antecedência.`)
                : r.euPiloto ? 'Você paga só a sua vaga agora e envia o link do grupo para os outros pilotos.' : 'Você paga 1 vaga de garantia agora e envia o link do grupo para os pilotos.'}</small></span></label>
          </fieldset>
        );
      })()}
      <p className="dica-mini">{grupoSite && r.modo === 'cada' && cadaPode(horario, q)
        ? `Cada piloto acessa o link, faz o próprio cadastro e paga sua vaga. Vagas não pagas até ${GRUPO_ANTECEDENCIA_H}h antes da largada são liberadas.`
        : 'Cada vaga é pessoal (1 CPF por piloto). Na próxima etapa, informe os dados de quem vai correr.'}</p>
      <div className="acoes"><button type="button" className="btn sec" onClick={voltar}>Voltar aos horários</button><button type="button" className="btn" onClick={() => { setR((x) => ({ ...x, quantidade: q })); avancar(); }}>Ir para o cadastro</button></div>
    </>
  );
}

// ------------------------------------------------------------------ 3. cadastro
type Erros = Record<string, string>;
const parsePeso = (s: string) => (/^\d{1,3}([.,]\d{1,2})?$/.test(s.trim()) ? Number(s.trim().replace(',', '.')) : NaN);
function validarTudo(r: Rascunho, cada = false): Erros {
  const e: Erros = {}; const c = r.comprador;
  if (!nomeValido(c.nome)) e['c.nome'] = 'Digite nome e sobrenome.';
  if (!cpfValido(c.documento)) e['c.documento'] = 'Informe os 11 dígitos de um CPF válido.';
  if (!emailValido(c.email)) e['c.email'] = c.email ? 'Informe um e-mail válido (ex.: nome@dominio.com).' : 'Informe seu e-mail para receber o comprovante e os resultados.';
  if (digitos(c.telefone).length < 10) e['c.telefone'] = 'Informe um celular com DDD.';
  const nasc = dataIso(c.nascimento);
  if (!nasc) e['c.nascimento'] = 'Use uma data válida no formato DD/MM/AAAA.'; else if (idade(nasc) < 18) e['c.nascimento'] = 'Quem reserva precisa ter 18 anos ou mais. Confira a data.';
  if (!c.instagram.trim()) e['c.instagram'] = 'Informe seu Instagram (@usuário). Ele identifica a reserva e sai no resultado.'; else if (erroInstagram(c.instagram)) e['c.instagram'] = erroInstagram(c.instagram);
  if (r.euPiloto) { const p = parsePeso(c.peso); if (!(p >= 20 && p <= 250)) e['c.peso'] = c.peso ? 'Informe um peso entre 20 e 250 kg.' : 'Informe seu peso (kg) para equilibrar os karts.'; }
  const docs = new Set([digitos(c.documento)]);
  const n = cada ? 0 : r.quantidade - (r.euPiloto ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const a = r.acomp[i] ?? vazia(); const k = `a${i}.`;
    if (!nomeValido(a.nome)) e[k + 'nome'] = 'Digite nome e sobrenome.';
    if (!cpfValido(a.documento)) e[k + 'documento'] = 'Informe os 11 dígitos de um CPF válido.';
    else if (docs.has(digitos(a.documento))) e[k + 'documento'] = 'Este CPF já foi usado em outra vaga. Cada piloto precisa de um CPF único.';
    docs.add(digitos(a.documento));
    const na = dataIso(a.nascimento);
    if (!na) e[k + 'nascimento'] = 'Use uma data válida no formato DD/MM/AAAA.'; else if (idade(na) < IDADE_MIN) e[k + 'nascimento'] = `Cada piloto precisa ter ${IDADE_MIN} anos ou mais.`;
    if (!emailValido(a.email)) e[k + 'email'] = a.email ? 'Informe um e-mail válido.' : 'Informe o e-mail do piloto.';
    if (digitos(a.telefone).length < 10) e[k + 'telefone'] = 'Informe o celular com DDD.';
    const p = parsePeso(a.peso); if (!(p >= 20 && p <= 250)) e[k + 'peso'] = a.peso ? 'Informe um peso entre 20 e 250 kg.' : 'Informe o peso (kg) para equilibrar os karts.';
    if (a.instagram.trim() && erroInstagram(a.instagram)) e[k + 'instagram'] = 'Informe um @usuário válido (ex.: @andre.silva) ou deixe em branco.';
    if (!a.endereco.trim()) e[k + 'endereco'] = 'Informe a rua e o número.';
    if (!a.bairro.trim()) e[k + 'bairro'] = 'Informe o bairro.';
    if (!a.cidade.trim()) e[k + 'cidade'] = 'Informe a cidade.';
  }
  return e;
}

function Campo({ id, rotulo, valor, erro, onChange, tipo = 'text', modo, auto, dica, max, opcional, required, onBlur, largura, autoCorrect, autoCapitalize, spellCheck, enterKeyHint }: {
  id: string; rotulo: string; valor: string; erro?: string; onChange: (v: string) => void; tipo?: string; modo?: React.HTMLAttributes<HTMLInputElement>['inputMode']; auto?: string; dica?: string; max?: number; opcional?: boolean; required?: boolean; onBlur?: () => void; largura?: 'total' | 'c2' | 'c4'; autoCorrect?: string; autoCapitalize?: string; spellCheck?: boolean; enterKeyHint?: React.HTMLAttributes<HTMLInputElement>['enterKeyHint'];
}) {
  return (
    <div className={`campo${largura ? ' campo-' + largura : ''}${erro ? ' com-erro' : ''}`}>
      <label htmlFor={id}>{rotulo}{opcional ? <small> (opcional)</small> : null}</label>
      <input id={id} type={tipo} inputMode={modo} autoComplete={auto} maxLength={max} required={required}
        autoCorrect={autoCorrect} autoCapitalize={autoCapitalize} spellCheck={spellCheck} enterKeyHint={enterKeyHint}
        value={valor} onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
        aria-invalid={!!erro} aria-describedby={erro ? id + '-e' : dica ? id + '-d' : undefined} />
      {erro ? <p className="msg-erro" id={id + '-e'}>{erro}</p> : dica ? <p className="dica-campo" id={id + '-d'}>{dica}</p> : null}
    </div>
  );
}

async function buscarCep(cep: string, signal?: AbortSignal): Promise<{ dados: Partial<Pessoa> | null; naoEncontrado?: boolean }> {
  if (digitos(cep).length !== 8) return { dados: null };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  const onAbort = () => ctl.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const r = await fetch(`https://viacep.com.br/ws/${digitos(cep)}/json/`, { signal: ctl.signal });
    if (!r.ok) return { dados: null };
    const j = await r.json();
    if (j.erro) return { dados: null, naoEncontrado: true };
    return { dados: { endereco: j.logradouro || '', bairro: j.bairro || '', cidade: j.localidade ? `${j.localidade}/${j.uf}` : '' } };
  } catch { return { dados: null }; }
  finally { clearTimeout(t); signal?.removeEventListener('abort', onAbort); }
}

function FormPessoa({ p, prefixo, erros, set, onBlurField, mostrar, comprador, piloto }: { p: Pessoa; prefixo: string; erros: Erros; set: (campo: keyof Pessoa, v: string) => void; onBlurField: (k: string) => void; mostrar: (k: string) => boolean; comprador?: boolean; piloto?: boolean }) {
  const er = (k: keyof Pessoa) => (mostrar(prefixo + k) ? erros[prefixo + k] : undefined);
  const blur = (k: keyof Pessoa) => () => onBlurField(prefixo + k);
  const id = (k: string) => `${prefixo.replace('.', '-')}${k}`;
  const [cepMsg, setCepMsg] = useState('');
  const cepAbort = useRef<AbortController | null>(null);
  useEffect(() => () => cepAbort.current?.abort(), []);
  return (
    <div className="form-grade">
      <Campo id={id('nome')} rotulo="Nome completo" valor={p.nome} erro={er('nome')} onChange={(v) => set('nome', v)} onBlur={blur('nome')} auto={comprador ? 'name' : 'off'} max={120} largura="total" required enterKeyHint="next" />
      <Campo id={id('documento')} rotulo="CPF" valor={p.documento} erro={er('documento')} onChange={(v) => set('documento', mascaraCpf(v))} onBlur={blur('documento')} modo="numeric" auto="off" required enterKeyHint="next" />
      <Campo id={id('nascimento')} rotulo="Data de nascimento" valor={p.nascimento} erro={er('nascimento')} onChange={(v) => set('nascimento', mascaraData(v))} onBlur={blur('nascimento')} modo="numeric" auto={comprador ? 'bday' : 'off'} required enterKeyHint="next" dica={comprador ? 'DD/MM/AAAA · mínimo 18 anos' : `DD/MM/AAAA · mínimo ${IDADE_MIN} anos`} />
      <Campo id={id('telefone')} rotulo="Celular (WhatsApp)" valor={p.telefone} erro={er('telefone')} onChange={(v) => set('telefone', mascaraFone(v))} onBlur={blur('telefone')} tipo="tel" modo="tel" auto={comprador ? 'tel-national' : 'off'} required enterKeyHint="next" />
      <Campo id={id('email')} rotulo="E-mail" valor={p.email} erro={er('email')} onChange={(v) => set('email', v)} onBlur={blur('email')} tipo="email" modo="email" auto={comprador ? 'email' : 'off'} autoCorrect="off" autoCapitalize="none" spellCheck={false} max={160} required enterKeyHint="next" dica={comprador ? 'Recebe o comprovante e os tempos da corrida.' : undefined} />
      <Campo id={id('instagram')} rotulo="Instagram" valor={p.instagram} erro={er('instagram')} onChange={(v) => set('instagram', v)} onBlur={blur('instagram')} auto="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} opcional={!comprador} required={!!comprador} enterKeyHint="next" dica={piloto ? 'Sai com o nome no resultado da bateria.' : 'Usado para identificar a reserva (ex.: @usuario).'} max={40} largura={piloto ? 'c4' : 'total'} />
      {piloto && <Campo id={id('peso')} rotulo="Peso (kg)" valor={p.peso} erro={er('peso')} onChange={(v) => set('peso', v.replace(/[^\d,.]/g, '').slice(0, 5))} onBlur={blur('peso')} modo="decimal" required enterKeyHint={comprador ? 'done' : 'next'} dica="Usado para equilibrar os karts." largura="c2" />}
      {!comprador && <>
        <Campo id={id('cep')} rotulo="CEP" valor={p.cep} onChange={(v) => { set('cep', mascaraCep(v)); if (cepMsg) setCepMsg(''); }} modo="numeric" opcional enterKeyHint="next" onBlur={async () => {
          cepAbort.current?.abort();
          const ctl = new AbortController();
          cepAbort.current = ctl;
          const res = await buscarCep(p.cep, ctl.signal);
          if (ctl.signal.aborted) return;
          if (res.naoEncontrado) { setCepMsg('CEP não encontrado. Preencha o endereço manualmente.'); return; }
          if (res.dados) {
            setCepMsg('');
            (Object.keys(res.dados) as (keyof Pessoa)[]).forEach((k) => { if (res.dados![k] && !p[k]) set(k, res.dados![k]!); });
          }
        }} dica={cepMsg || 'Preenche rua, bairro e cidade automaticamente.'} largura="c2" />
        <Campo id={id('endereco')} rotulo="Endereço (rua e número)" valor={p.endereco} erro={er('endereco')} onChange={(v) => set('endereco', v)} onBlur={blur('endereco')} max={150} largura="c4" required enterKeyHint="next" />
        <Campo id={id('bairro')} rotulo="Bairro" valor={p.bairro} erro={er('bairro')} onChange={(v) => set('bairro', v)} onBlur={blur('bairro')} max={80} required enterKeyHint="next" />
        <Campo id={id('cidade')} rotulo="Cidade" valor={p.cidade} erro={er('cidade')} onChange={(v) => set('cidade', v)} onBlur={blur('cidade')} max={80} required enterKeyHint="next" />
      </>}
    </div>
  );
}

function EtapaCadastro({ r, setR, cada, voltar, avancar }: { r: Rascunho; setR: React.Dispatch<React.SetStateAction<Rascunho>>; cada: boolean; voltar: () => void; avancar: () => void }) {
  const [tocados, setTocados] = useState<Set<string>>(new Set());
  const [tentou, setTentou] = useState(false);
  const erros = validarTudo(r, cada);
  const mostrar = (k: string) => tentou || tocados.has(k);
  const marcarTocado = (k: string) => setTocados((t) => (t.has(k) ? t : new Set(t).add(k)));
  const n = cada ? 0 : r.quantidade - (r.euPiloto ? 1 : 0);
  const setC = (campo: keyof Pessoa, v: string) => setR((x) => ({ ...x, comprador: { ...x.comprador, [campo]: v } }));
  const setA = (i: number) => (campo: keyof Pessoa, v: string) => {
    setR((x) => { const acomp = [...x.acomp]; while (acomp.length <= i) acomp.push(vazia()); acomp[i] = { ...acomp[i], [campo]: v }; return { ...x, acomp }; });
  };
  const faltam = Object.keys(erros).length;
  const continuar = (e: React.FormEvent) => {
    e.preventDefault();
    setTentou(true);
    if (faltam) { requestAnimationFrame(() => (document.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus()); return; }
    avancar();
  };
  return (
    <form onSubmit={continuar} noValidate>
      <div className="etapa-topo"><span className="num">03</span><div><h2>Cadastro</h2><p className="muted">Estes dados identificam o responsável e vinculam cada piloto ao totem no dia.</p></div></div>
      <section className="bloco">
        <h3>{r.euPiloto ? 'Você (quem reserva e pilota)' : 'Você (quem reserva)'}</h3>
        <FormPessoa p={r.comprador} prefixo="c." erros={erros} set={setC} onBlurField={marcarTocado} mostrar={mostrar} comprador piloto={r.euPiloto} />
      </section>
      {Array.from({ length: n }, (_, i) => (
        <section className="bloco" key={i}>
          <h3>Piloto {i + (r.euPiloto ? 2 : 1)}</h3>
          <FormPessoa p={r.acomp[i] ?? vazia()} prefixo={`a${i}.`} erros={erros} set={setA(i)} onBlurField={marcarTocado} mostrar={mostrar} piloto />
        </section>
      ))}
      {cada && (() => {
        const outros = r.quantidade - (r.euPiloto ? 1 : 0);
        return <p className="dica-mini">{`${outros === 1 ? 'O outro piloto faz o cadastro pelo link do grupo' : `Os outros ${outros} pilotos fazem o cadastro pelo link do grupo`}, disponível após o pagamento.`}</p>;
      })()}
      <p className="dica-mini">Seus dados são usados só para a reserva, o cadastro no totem e o resultado da bateria (LGPD). Menores de 18 anos assinam o termo com o responsável no dia.</p>
      {tentou && faltam > 0 && <p className="msg-erro geral" role="alert">{faltam === 1 ? 'Há 1 campo pendente acima. Revise o campo destacado.' : `Há ${faltam} campos pendentes acima. Revise os campos destacados.`}</p>}
      <div className="acoes"><button type="button" className="btn sec" onClick={voltar}>Voltar aos pilotos</button><button type="submit" className="btn">Ir para o pagamento</button></div>
    </form>
  );
}

// ------------------------------------------------------------------ 4. pagamento
function EtapaPagamento({ r, setR, cada, horario, agenda, abertoEm, voltar, onCriado, onIndisponivel }: {
  r: Rascunho; cada: boolean; setR: React.Dispatch<React.SetStateAction<Rascunho>>; horario: Horario; agenda: Agenda; abertoEm: number; voltar: () => void; onCriado: (id: string) => void; onIndisponivel: () => void;
}) {
  const [aceite, setAceite] = useState(false);
  const [politica, setPolitica] = useState<Politica | null>(null);
  const [erroPolitica, setErroPolitica] = useState(false);
  const [verPolitica, setVerPolitica] = useState(false);
  const [verTermo, setVerTermo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [incerto, setIncerto] = useState(false);
  const isca = useRef<HTMLInputElement>(null);
  const enviandoRef = useRef(false);
  const aplicandoRef = useRef(false);
  const vivoRef = useRef(true);
  const cupomAbort = useRef<AbortController | null>(null);
  const indisponivelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregarPolitica = useCallback(() => {
    setErroPolitica(false);
    const ctl = new AbortController();
    api.politica(ctl.signal).then((p) => { if (!ctl.signal.aborted) setPolitica(p); })
      .catch(() => { if (!ctl.signal.aborted) setErroPolitica(true); });
    return () => ctl.abort();
  }, []);
  useEffect(() => carregarPolitica(), [carregarPolitica]);

  useEffect(() => {
    vivoRef.current = true;
    return () => {
      vivoRef.current = false;
      cupomAbort.current?.abort();
      if (indisponivelTimer.current) clearTimeout(indisponivelTimer.current);
    };
  }, []);

  const dt = deIso(horario.inicio);
  const [cupom, setCupom] = useState('');
  const [aplicado, setAplicado] = useState<{ codigo: string; descontoCentavos: number; totalCentavos: number; brutoCentavos: number } | null>(null);
  const [aplicando, setAplicando] = useState(false);
  const [erroCupom, setErroCupom] = useState('');
  const nOutros = cada ? 0 : r.quantidade - (r.euPiloto ? 1 : 0);
  const documentos = [...(r.euPiloto ? [r.comprador.documento] : []), ...r.acomp.slice(0, nOutros).map((a) => a.documento)].map(digitos);
  // cada um paga o seu: agora só 1 vaga (a de quem organiza ou a garantia)
  const vagasAgora = cada ? 1 : r.quantidade;
  const total = aplicado ? aplicado.totalCentavos : horario.precoCentavos * vagasAgora;
  const aplicarCupom = async () => {
    if (aplicandoRef.current || enviandoRef.current) return;
    const codigo = cupom.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{1,40}$/.test(codigo)) { setErroCupom('Digite um cupom válido (letras, números, - ou _).'); return; }
    aplicandoRef.current = true;
    cupomAbort.current?.abort();
    const ctl = new AbortController();
    cupomAbort.current = ctl;
    setAplicando(true); setErroCupom(''); setAplicado(null);
    try {
      const { requestId } = await api.cupom({ codigo, bateriaId: horario.id, quantidade: vagasAgora, documento: digitos(r.comprador.documento), documentos }, ctl.signal);
      // o kartódromo confere o cupom em poucos segundos
      for (let i = 0; i < 20; i++) {
        await new Promise<void>((ok) => {
          const t = setTimeout(ok, 1500);
          ctl.signal.addEventListener('abort', () => { clearTimeout(t); ok(); }, { once: true });
        });
        if (ctl.signal.aborted || !vivoRef.current) return;
        const x = await api.cupomResultado(requestId, ctl.signal);
        if (ctl.signal.aborted || !vivoRef.current) return;
        if (x.status === 'pending') continue;
        if (x.erro) { setErroCupom(x.erro); return; }
        setAplicado({ codigo, descontoCentavos: x.descontoCentavos ?? 0, totalCentavos: x.totalCentavos ?? 0, brutoCentavos: x.brutoCentavos ?? 0 });
        return;
      }
      if (vivoRef.current && !ctl.signal.aborted) {
        setErroCupom('Não foi possível conferir o cupom agora. Tente novamente em instantes ou finalize sem cupom.');
      }
    } catch (e) {
      if (!ctl.signal.aborted && vivoRef.current) setErroCupom((e as Error).message);
    } finally {
      aplicandoRef.current = false;
      if (vivoRef.current) setAplicando(false);
    }
  };
  const enviar = async () => {
    if (enviandoRef.current) return;
    if (!aceite) { setErro('Marque a caixa aceitando a política de cancelamento para finalizar.'); return; }
    if (!agenda.pagamentoOnline) { setErro('Pagamento online indisponível no momento. Fale com a recepção no WhatsApp.'); return; }
    enviandoRef.current = true;
    // o servidor recusa envios feitos menos de 6 s depois de abrir a página (anti-robô)
    const espera = 6500 - (Date.now() - abertoEm);
    setEnviando(true); setErro('');
    if (espera > 0) await new Promise((ok) => setTimeout(ok, espera));
    if (!vivoRef.current) { enviandoRef.current = false; return; }
    const c = r.comprador; const n = cada ? 0 : r.quantidade - (r.euPiloto ? 1 : 0);
    const corpo = {
      ...c, nome: c.nome.trim(), email: c.email.trim(), documento: c.documento, nascimento: dataIso(c.nascimento), tipoDocumento: 'CPF',
      bateriaId: horario.id, quantidade: r.quantidade, compradorPilota: r.euPiloto,
      pilotos: [...(r.euPiloto ? [c.nome.trim()] : []), ...r.acomp.slice(0, n).map((a) => a.nome.trim())],
      acompanhantes: r.acomp.slice(0, n).map((a) => ({ ...a, nome: a.nome.trim(), email: a.email.trim(), nascimento: dataIso(a.nascimento), endereco: a.endereco.trim(), bairro: a.bairro.trim(), cidade: a.cidade.trim() })),
      ...(cada ? { modo: 'individual' } : {}),
      forma: r.forma, politica: true, lgpd: true, site: isca.current?.value || '', t: abertoEm, ...(aplicado ? { cupom: aplicado.codigo } : {}),
    };
    try {
      const res = await api.criar(corpo);
      if (!vivoRef.current) return;
      if (!ID_PEDIDO.test(res.id || '')) throw new ErroApi('Não foi possível verificar o número do pedido.', 500);
      onCriado(res.id);
    } catch (e) {
      if (!vivoRef.current) return;
      const st = (e as ErroApi).status;
      if (!st || st >= 500) setIncerto(true);
      const msg = (e as Error).message;
      if (/hor[aá]rio|lotou|vaga/i.test(msg) && st === 400) {
        setErro(msg + ' Escolha outro horário.');
        if (indisponivelTimer.current) clearTimeout(indisponivelTimer.current);
        indisponivelTimer.current = setTimeout(() => { if (vivoRef.current) onIndisponivel(); }, 2500);
      } else setErro(msg);
    } finally {
      enviandoRef.current = false;
      if (vivoRef.current) setEnviando(false);
    }
  };
  return (
    <>
      <div className="etapa-topo"><span className="num">04</span><div><h2>Pagamento</h2><p className="muted">{`As vagas ficam separadas por ${agenda.prazoMin} minutos enquanto você paga.`}</p></div></div>
      <dl className="conferir">
        <div><dt>Bateria</dt><dd>{diaLongo(dt)} · {hora(dt)}</dd></div>
        <div><dt>Chegada</dt><dd>{menosUmaHora(dt)} (1 hora antes)</dd></div>
        <div><dt>Pilotos</dt><dd>{cada ? `${r.quantidade} pilotos · 1 vaga paga agora + link para o grupo` : [...(r.euPiloto ? [r.comprador.nome] : []), ...r.acomp.slice(0, r.quantidade - (r.euPiloto ? 1 : 0)).map((a) => a.nome)].map((x) => x.trim().split(/\s+/)[0]).join(', ')}</dd></div>
        <div><dt>Quem reserva</dt><dd>{r.comprador.nome} · {r.comprador.email}</dd></div>
      </dl>
      {total > 0 ? (
        <fieldset className="escolha formas">
          <legend>Como você quer pagar?</legend>
          <label className={r.forma === 'pix' ? 'on' : ''}><input type="radio" name="forma" checked={r.forma === 'pix'} onChange={() => setR((x) => ({ ...x, forma: 'pix' }))} /><span><strong>Pix</strong><small>Aprovação imediata. O QR code aparece na próxima tela.</small></span></label>
          <label className={r.forma === 'cartao' ? 'on' : ''}><input type="radio" name="forma" checked={r.forma === 'cartao'} onChange={() => setR((x) => ({ ...x, forma: 'cartao' }))} /><span><strong>Cartão de crédito</strong><small>Ambiente seguro da Asaas. Após pagar, volte para esta página.</small></span></label>
        </fieldset>
      ) : (
        <div className="dica" role="status"><Ico d={I.ok} /><p><strong>Voucher cobre 100% da reserva!</strong> Valor final R$ 0,00 — nenhuma cobrança financeira será gerada.</p></div>
      )}
      <div className="cupom">
        <label htmlFor="cupom">Cupom de desconto <small>(opcional)</small></label>
        <div className="cupom-linha">
          <input id="cupom" value={cupom} disabled={enviando} onChange={(e) => { setCupom(e.target.value.toUpperCase().replace(/\s/g, '')); setAplicado(null); setErroCupom(''); }} maxLength={40} autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="done" aria-invalid={!!erroCupom} aria-describedby="cupom-msg" />
          <button type="button" className="btn sec" onClick={aplicarCupom} disabled={enviando || aplicando || !cupom.trim()} aria-busy={aplicando}>{aplicando ? 'Conferindo…' : aplicado ? 'Cupom aplicado' : 'Aplicar cupom'}</button>
        </div>
        <p id="cupom-msg" className={erroCupom ? 'msg-erro' : 'dica-campo'} role={erroCupom ? 'alert' : undefined}>{erroCupom || (aplicado ? `Cupom ${aplicado.codigo}: desconto de ${reais(aplicado.descontoCentavos)}.` : '')}</p>
      </div>
      <div className="total"><span>{aplicado ? <><s>{reais(aplicado.brutoCentavos)}</s> com cupom</> : cada ? (r.euPiloto ? 'Sua vaga (paga agora)' : '1 vaga de garantia (paga agora)') : `${r.quantidade} × ${reais(horario.precoCentavos)}`}</span><strong>{reais(total)}</strong></div>
      {cada && (() => {
        const o = r.quantidade - (r.euPiloto ? 1 : 0);
        return <p className="dica-mini">{`${o === 1 ? (r.euPiloto ? 'O outro piloto paga' : 'O piloto convidado paga') : `${r.euPiloto ? 'Os outros' : 'Os'} ${o} pilotos pagam`} ${reais(horario.precoCentavos)}${o === 1 ? '' : ' cada'} pelo link do grupo. ${o === 1 ? 'A vaga fica guardada' : 'As vagas ficam guardadas'} até ${GRUPO_ANTECEDENCIA_H}h antes da bateria; quem não pagar até lá perde a vaga.${r.euPiloto ? '' : ' A garantia é abatida de quem faltar ou devolvida conforme a política.'}`}</p>;
      })()}
      {horario.precoPrimeiraVezCentavos ? <p className="dica-mini">{`Estreantes pagam ${reais(horario.precoPrimeiraVezCentavos)} neste horário: o desconto é conferido pelo CPF e já vem no valor do Pix/cartão.`}</p> : null}
      <label className="aceite">
        <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
        <span>{politica?.aceite ?? 'Li e aceito a Política de Cancelamento, Reagendamento e Reembolso.'} <button type="button" className="lnk inline" onClick={() => setVerPolitica(true)}>Ler a política</button></span>
      </label>
      <div className="dica-mini" style={{ marginTop: '4px' }}>
        <span>O termo de responsabilidade é assinado na recepção antes da corrida. </span>
        <button type="button" className="lnk inline" onClick={() => setVerTermo(true)}>Ver modelo do termo</button>
      </div>
      <input ref={isca} name="site" tabIndex={-1} autoComplete="off" className="isca" aria-hidden="true" />
      {erro && <p className="msg-erro geral" role="alert">{erro}</p>}
      {incerto && <p className="dica-mini">Não conseguimos confirmar se sua reserva foi registrada. Para evitar pagamento duplicado, <a href={`https://wa.me/${WHATS}`} target="_blank" rel="noopener">fale com a recepção no WhatsApp</a> antes de tentar novamente.</p>}
      <div className="acoes"><button type="button" className="btn sec" onClick={voltar} disabled={enviando}>Voltar ao cadastro</button>
        <button type="button" className="btn grande" onClick={enviar} disabled={enviando || !aceite || !agenda.pagamentoOnline} aria-busy={enviando}>{enviando ? 'Criando reserva…' : total === 0 ? `Confirmar reserva (${reais(0)})` : `Reservar e pagar ${reais(total)}`}</button></div>
      {verPolitica && <ModalPolitica politica={politica} erro={erroPolitica} recarregar={carregarPolitica} fechar={() => setVerPolitica(false)} aceitar={() => { setAceite(true); setVerPolitica(false); }} />}
      {verTermo && <ModalTermo fechar={() => setVerTermo(false)} />}
    </>
  );
}

/** Botões do grupo (Minhas reservas): mandar o link de novo e abrir o painel. */
function LinksDoGrupo({ link, painel, quando }: { link: string; painel: string; quando: Date | null }) {
  const texto = `Bora correr de kart no Kartódromo de Betim${quando ? `, ${diaLongo(quando)} às ${hora(quando)}` : ''}! Entra no grupo, faz teu cadastro e paga tua vaga: ${link}`;
  return (
    <div className="acoes esq">
      <a className="btn sec" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener"><Ico d={I.compartilhar} />Reenviar link no WhatsApp</a>
      <a className="lnk" href={painel} target="_blank" rel="noopener">Ver quem já entrou e pagou</a>
    </div>
  );
}

/** Depois de pago, no "cada um paga o seu": o link para mandar aos amigos e o painel de quem já entrou. */
function ConvidarGrupo({ p, dt }: { p: Pedido; dt: Date | null }) {
  if (!p.grupo) return <div className="dica" role="status"><Ico d={I.relogio} /><p>Preparando o link do seu grupo. Ele aparece aqui em instantes.</p></div>;
  const texto = `Bora correr de kart no Kartódromo de Betim${dt ? `, ${diaLongo(dt)} às ${hora(dt)}` : ''}! Entra no grupo, faz teu cadastro e paga tua vaga: ${p.grupo.link}`;
  return (
    <section className="grupo-convite" aria-labelledby="grupo-t">
      <h2 id="grupo-t">Envie o link para os outros pilotos</h2>
      <p className="muted">Compartilhe este link com o grupo. Cada piloto faz o próprio cadastro e paga sua vaga. Quem não pagar até 24h antes da bateria perde a vaga.</p>
      <div className="acoes centro">
        <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener"><Ico d={I.compartilhar} />Enviar link no WhatsApp</a>
        <button type="button" className="btn sec" onClick={async () => { try { await navigator.clipboard.writeText(p.grupo!.link); avisar('Link do grupo copiado'); } catch { avisar('Não foi possível copiar. Use o botão Enviar link no WhatsApp.'); } }}><Ico d={I.copiar} />Copiar link do grupo</button>
      </div>
      <a className="lnk centro" href={p.grupo.painel} target="_blank" rel="noopener">Ver quem já entrou e pagou</a>
    </section>
  );
}

function useModalRef(fechar: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const foraDown = useRef(false);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const clicouFora = (e: React.PointerEvent<HTMLDialogElement>) => {
    const d = ref.current;
    if (!d) return false;
    const rect = d.getBoundingClientRect();
    return e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
  };
  const props = {
    ref,
    className: 'modal',
    onClose: fechar,
    onPointerDown: (e: React.PointerEvent<HTMLDialogElement>) => {
      if ('closedBy' in HTMLDialogElement.prototype) return;
      foraDown.current = e.target === ref.current && clicouFora(e);
    },
    onPointerUp: (e: React.PointerEvent<HTMLDialogElement>) => {
      if ('closedBy' in HTMLDialogElement.prototype) return;
      const fecharAgora = foraDown.current && e.target === ref.current && clicouFora(e);
      foraDown.current = false;
      if (fecharAgora) ref.current?.close();
    },
    ...({ closedBy: 'any' } as Record<string, string>),
  };
  return props;
}

function ModalPolitica({ politica, erro, recarregar, fechar, aceitar }: { politica: Politica | null; erro: boolean; recarregar: () => void; fechar: () => void; aceitar: () => void }) {
  const dialogProps = useModalRef(fechar);
  return (
    <dialog {...dialogProps} aria-labelledby="pol-t">
      <div className="modal-topo"><h2 id="pol-t">{politica?.titulo ?? 'Política de Cancelamento'}</h2><button type="button" className="ico-btn" onClick={fechar} aria-label="Fechar"><Ico d={I.x} /></button></div>
      <div className="modal-corpo">
        {erro && !politica ? (
          <div className="erro-bloco" role="alert">
            <p>Não foi possível carregar a política agora.</p>
            <button type="button" className="btn sec" onClick={recarregar}>Tentar novamente</button>
          </div>
        ) : !politica ? <p>Carregando…</p> : politica.secoes.map((s) => (
          <section key={s.titulo}><h3>{s.titulo}</h3>{s.paragrafos?.map((p, i) => <p key={i}>{p}</p>)}
            {s.subsecoes?.map((ss) => <div key={ss.titulo}><h4>{ss.titulo}</h4>{ss.paragrafos.map((p, i) => <p key={i}>{p}</p>)}</div>)}</section>
        ))}
      </div>
      <div className="modal-pe"><button type="button" className="btn sec" onClick={fechar}>Fechar</button><button type="button" className="btn" onClick={aceitar}>Aceitar política</button></div>
    </dialog>
  );
}

function ModalTermo({ fechar }: { fechar: () => void }) {
  const dialogProps = useModalRef(fechar);
  const [termo, setTermo] = useState<TermoResp | null>(null);
  const [erroTermo, setErroTermo] = useState(false);
  const carregar = useCallback(() => {
    setErroTermo(false);
    const ctl = new AbortController();
    api.termo(ctl.signal).then((t) => { if (!ctl.signal.aborted) setTermo(t); })
      .catch(() => { if (!ctl.signal.aborted) setErroTermo(true); });
    return () => ctl.abort();
  }, []);
  useEffect(() => carregar(), [carregar]);
  return (
    <dialog {...dialogProps} aria-labelledby="termo-modal-t">
      <div className="modal-topo">
        <h2 id="termo-modal-t">{termo?.titulo ?? 'Termo de Responsabilidade e Consentimento LGPD'}</h2>
        <button type="button" className="ico-btn" onClick={fechar} aria-label="Fechar"><Ico d={I.x} /></button>
      </div>
      <div className="modal-corpo">
        <p className="dica-mini termo-intro">
          Modelo das condições de pista, responsabilidade civil e desportiva e consentimento para tratamento de dados pessoais (LGPD):
        </p>
        {erroTermo ? (
          <div className="erro-bloco" role="alert">
            <p className="muted">Não foi possível carregar o modelo agora. Você também pode ler e assinar o termo completo na recepção antes da corrida.</p>
            <button type="button" className="btn sec" style={{ marginTop: '10px' }} onClick={carregar}>Tentar novamente</button>
          </div>
        ) : !termo ? (
          <p>Carregando termo…</p>
        ) : (
          termo.paragrafos.map((p, i) => (
            <div key={i} className="termo-item">
              {p.titulo && <strong className="termo-tit">{p.titulo}</strong>}
              <p>{p.texto}</p>
            </div>
          ))
        )}
      </div>
      <div className="modal-pe">
        <button type="button" className="btn" onClick={fechar}>Fechar termo</button>
      </div>
    </dialog>
  );
}

// ------------------------------------------------------------------ resumo lateral
function Resumo({ horario, r, agenda, cada }: { horario: Horario | null; r: Rascunho; agenda: Agenda | null; cada: boolean }) {
  const dt = horario ? deIso(horario.inicio) : null;
  const preco = horario?.precoCentavos ?? agenda?.precoCentavos ?? 0;
  return (
    <aside className={`cartao resumo${horario ? ' tem-horario' : ''}`} aria-label="Resumo da reserva">
      <div className="resumo-foto"><img src="/booking-media/action.webp" alt="Kart em ação na pista de Betim" loading="lazy" /><span><Ico d={I.bandeira} s={14} />Kart de aluguel</span></div>
      <div className="resumo-corpo">
        <h2>Sua corrida</h2>
        <dl>
          <div><dt>Dia</dt><dd>{dt ? diaLongo(dt) : 'Escolha na agenda'}</dd></div>
          <div><dt>Largada</dt><dd>{dt ? hora(dt) : '—'}</dd></div>
          <div><dt>Chegada</dt><dd>{dt ? menosUmaHora(dt) : '—'}</dd></div>
          <div><dt>Pilotos</dt><dd>{r.quantidade}</dd></div>
        </dl>
        <div className="resumo-total"><span>{cada ? 'Valor agora' : 'Total'}</span><strong>{horario ? reais(preco * (cada ? 1 : r.quantidade)) : '—'}</strong></div>
        {cada && <p className="muted pequeno">Os demais pilotos pagam a própria vaga pelo link.</p>}
        <p className="muted pequeno"><Ico d={I.escudo} s={14} /> Pagamento seguro via Asaas (Pix ou cartão)</p>
      </div>
    </aside>
  );
}

// ------------------------------------------------------------------ acompanhamento do pedido
function Acompanhar({ id, onNovo }: { id: string; onNovo: () => void }) {
  const [p, setP] = useState<Pedido | null>(null);
  const [erroInicial, setErroInicial] = useState('');
  const [falhas, setFalhas] = useState(0);
  const [tentativa, setTentativa] = useState(0);
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    let vivo = true; let t: ReturnType<typeof setTimeout>;
    const ctl = new AbortController();
    const tick = async () => {
      try {
        const x = await api.pedido(id, ctl.signal); if (!vivo) return;
        setP(x); setErroInicial(''); setFalhas(0);
        const esperandoGrupo = x.status === 'confirmado' && x.modo === 'individual' && !x.grupo;
        if (FINAIS.has(x.status) && !esperandoGrupo) { if (x.status !== 'confirmado') guardarPedido(id); return; }
      } catch (e) {
        if (!vivo || ctl.signal.aborted) return;
        if ((e as ErroApi).status === 404) { setP({ id, status: 'nao_encontrada' } as Pedido); return; }
        setErroInicial((prev) => prev || (e as Error).message);
        setFalhas((f) => f + 1);
      }
      t = setTimeout(tick, document.visibilityState === 'visible' ? 3500 : 10000);
    };
    tick();
    const r = setInterval(() => setAgora(Date.now()), 1000);
    return () => { vivo = false; ctl.abort(); clearTimeout(t); clearInterval(r); };
  }, [id, tentativa]);

  if (!p && erroInicial) {
    return (
      <div className="pagina estreita">
        <div className="cartao erro-bloco" role="alert">
          <strong>Não foi possível carregar sua reserva</strong>
          <p>{erroInicial}</p>
          <div className="acoes centro">
            <button type="button" className="btn" onClick={() => { setErroInicial(''); setTentativa((n) => n + 1); }}>Tentar novamente</button>
            <button type="button" className="btn sec" onClick={onNovo}>Fazer outra reserva</button>
          </div>
        </div>
      </div>
    );
  }
  if (!p) return <div className="pagina estreita"><div className="cartao carregando" role="status">Carregando sua reserva…</div></div>;
  const dt = p.inicio ? deIso(p.inicio) : null;
  const restante = p.expiraEm ? Math.max(0, Date.parse(p.expiraEm) - agora) : 0;
  const mm = Math.floor(restante / 60000), ss = Math.floor((restante % 60000) / 1000);
  const prazoTexto = restante === 0 && p.expiraEm ? 'Prazo encerrado · conferindo atualização…' : `Vagas separadas por ${mm}:${String(ss).padStart(2, '0')}`;
  const info = dt && <p className="ped-info"><Ico d={I.cal} s={16} />{diaLongo(dt)}{` · largada ${hora(dt)} · ${p.quantidade} ${p.quantidade === 1 ? 'piloto' : 'pilotos'}${p.valorCentavos ? ` · ${reais(p.valorCentavos)}` : ''}`}</p>;
  const ajuda = <a className="btn sec" href={`https://wa.me/${WHATS}?text=${encodeURIComponent('Reserva ' + (p.codigo || p.id))}`} target="_blank" rel="noopener">Falar com a recepção</a>;

  let corpo: React.ReactNode;
  if (p.status === 'confirmado') {
    const baixar = () => {
      const b = new Blob([ics(dt!, p.codigo, p.descricao || 'Kart')], { type: 'text/calendar' });
      const url = URL.createObjectURL(b);
      const a = document.createElement('a'); a.href = url; a.download = `kart-${p.codigo}.ics`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    corpo = <>
      <div className="selo ok"><Ico d={I.ok} s={28} /></div>
      <h1>Reserva confirmada</h1>{info}
      <div className="codigo"><span>Código da reserva</span><strong>{p.codigo}</strong><button type="button" className="ico-btn" onClick={async () => { try { await navigator.clipboard.writeText(p.codigo); avisar('Código copiado'); } catch { avisar('Não foi possível copiar.'); } }} aria-label="Copiar código"><Ico d={I.copiar} /></button></div>
      {p.modo === 'individual' && <ConvidarGrupo p={p} dt={dt} />}
      <p className="dica-mini centro">Guarde o código: com ele e o CPF você acessa <a href="#minhas">Minhas reservas</a> para fazer check-in, remarcar ou cancelar.</p>
      <ol className="no-dia"><li>Chegue às <strong>{dt && menosUmaHora(dt)}</strong>, uma hora antes da largada.</li><li>No totem do kartódromo, informe o <strong>CPF de quem reservou</strong> e confira os dados.</li><li>Assine o termo de responsabilidade na recepção antes da corrida.</li></ol>
      <div className="acoes centro">{dt && <button type="button" className="btn" onClick={baixar}>Salvar na agenda</button>}<a className="btn sec" href="https://maps.google.com/?q=Kart%C3%B3dromo+Internacional+de+Betim" target="_blank" rel="noopener">Como chegar</a></div>
      <button type="button" className="lnk centro" onClick={onNovo}>Fazer outra reserva</button>
    </>;
  } else if (p.status === 'aguardando_pagamento' && p.pix) {
    corpo = <>
      <h1>Pague com Pix</h1>
      <p className="prazo-vivo" role="status">{prazoTexto}</p>{info}
      <img className="qr" src={`data:image/png;base64,${p.pix.imagem}`} alt="QR code do Pix desta reserva" width="240" height="240" />
      <label className="campo"><span>Pix copia e cola</span><textarea readOnly value={p.pix.payload} rows={3} onFocus={(e) => e.target.select()} /></label>
      <div className="acoes centro"><button type="button" className="btn grande" onClick={async () => { try { await navigator.clipboard.writeText(p.pix!.payload); avisar('Código Pix copiado'); } catch { avisar('Selecione e copie o código no campo acima.'); } }}>Copiar código Pix</button></div>
      <p className="dica-mini centro">Confira o valor no app do banco antes de confirmar. A confirmação aparece aqui automaticamente.</p>
    </>;
  } else if (p.status === 'aguardando_pagamento' && p.invoiceUrl) {
    corpo = <>
      <h1>Pague com cartão</h1>
      <p className="prazo-vivo" role="status">{prazoTexto}</p>{info}
      <div className="acoes centro"><a className="btn grande" href={p.invoiceUrl} target="_blank" rel="noopener">Abrir pagamento seguro (Asaas)</a></div>
      <p className="dica-mini centro">Você pagará na página segura da Asaas. Depois de concluir, volte para esta tela — a confirmação aparece aqui.</p>
    </>;
  } else if (p.status === 'novo' || p.preparandoPagamento) {
    corpo = <><div className="girando" aria-hidden="true" /><h1>Preparando seu pagamento</h1>{info}<p className="muted centro">Verificando vagas disponíveis e gerando sua cobrança. Aguarde alguns segundos.</p></>;
  } else if (p.status === 'pago') {
    corpo = <><div className="girando" aria-hidden="true" /><h1>Confirmando suas vagas na agenda</h1><p className="ped-sub">Pagamento recebido</p>{info}<p className="muted centro">Estamos registrando suas vagas no sistema da pista. Não faça outro pagamento.</p></>;
  } else if (p.status === 'expirado') {
    corpo = <><h1>O prazo de pagamento terminou</h1>{info}<p className="muted centro">As vagas voltaram para a agenda. Se você concluiu o pagamento há poucos instantes, fale com a recepção.</p><div className="acoes centro"><button type="button" className="btn" onClick={onNovo}>Escolher outro horário</button>{ajuda}</div></>;
  } else if (p.status === 'nao_encontrada') {
    corpo = <><h1>Reserva não encontrada</h1><p className="muted centro">Confira se o link está completo ou fale com a recepção.</p><div className="acoes centro"><button type="button" className="btn" onClick={onNovo}>Fazer uma reserva</button>{ajuda}</div></>;
  } else {
    corpo = <><h1>{p.status === 'pago_sem_vaga' ? 'Pagamento recebido, mas o horário lotou' : p.status === 'recusado' ? 'Esse horário ficou indisponível' : 'Não foi possível gerar o pagamento'}</h1>{info}
      <p className="muted centro">{p.erro || (p.status === 'pago_sem_vaga' ? 'As vagas se esgotaram antes da confirmação do pagamento. Fale com a recepção para escolher outro horário ou receber o reembolso.' : 'Escolha outro horário para tentar uma nova reserva.')}</p>
      {p.codigo && <p className="muted centro pequeno">Código de referência: {p.codigo}</p>}<div className="acoes centro">{ajuda}<button type="button" className="btn sec" onClick={onNovo}>Fazer outra reserva</button></div></>;
  }
  return (
    <div className="pagina estreita">
      <div className="cartao pedido" aria-live="polite">{corpo}{falhas >= 3 && !FINAIS.has(p.status) && <p className="msg-erro geral">Não foi possível atualizar o status agora. Confira sua conexão — a página tenta novamente sozinha.</p>}</div>
      <p className="dica-mini centro">Você pode voltar a esta página pelo mesmo link.</p>
    </div>
  );
}

const tempoVolta = (ms: number) => { const m = Math.floor(ms / 60000), s = (ms % 60000) / 1000; return `${m ? m + ':' : ''}${s.toFixed(3).padStart(m ? 6 : 5, '0')}`; };

// ------------------------------------------------------------------ minhas reservas
const ROTULO: Record<string, [string, string]> = {
  confirmado: ['ok', 'Confirmada'], pago: ['pend', 'Pagamento recebido'], aguardando_pagamento: ['pend', 'Aguardando pagamento'], novo: ['pend', 'Em processamento'],
  expirado: ['neutro', 'Prazo de pagamento encerrado'], recusado: ['neutro', 'Não confirmada'], pago_sem_vaga: ['erro', 'Precisa de atendimento'], erro_pagamento: ['erro', 'Erro no pagamento'], cancelado: ['neutro', 'Cancelada'],
};
/** Política (src/config/politica-cancelamento.ts): 48 h antes ou mais = reembolso de 90% e remarcação sem custo; menos de 48 h = sem reembolso. */
function regraDaPolitica(inicio: Date, valor: number | null) {
  const horas = (inicio.getTime() - Date.now()) / 3600e3;
  if (horas <= 0) return { passou: true, noPrazo: false, texto: 'Bateria já realizada.' };
  if (horas >= 48) return { passou: false, noPrazo: true, texto: `Dentro do prazo: cancelando agora, o reembolso é de ${valor ? reais(Math.round(valor * 0.90)) : '90% do valor pago'} (10% de taxa administrativa/operacional). Remarcar não tem custo.` };
  return { passou: false, noPrazo: false, texto: 'Faltam menos de 48 horas: pela política não há reembolso. Em casos excepcionais, fale com a recepção sobre a possibilidade de voucher.' };
}

function MinhasReservas({ onVoltar, onAbrir }: { onVoltar: () => void; onAbrir: (id: string) => void }) {
  const [cpf, setCpf] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [res, setRes] = useState<{ nome: string; reservas: MinhaReserva[]; grupos?: MeuGrupo[] } | null>(null);
  const [corridas, setCorridas] = useState<{ corridas: Corrida[]; aviso?: string } | null>(null);
  const [checando, setChecando] = useState<string | null>(null);
  const [msgCheckin, setMsgCheckin] = useState<Record<string, { ok: boolean; texto: string }>>({});
  const [confirmarCancel, setConfirmarCancel] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [msgCancel, setMsgCancel] = useState<Record<string, { ok: boolean; texto: string }>>({});
  const vivoRef = useRef(true);
  const buscandoRef = useRef(false);
  const cancelandoRef = useRef(false);
  const checandoRef = useRef(false);
  const minhasAbort = useRef<AbortController | null>(null);
  useEffect(() => {
    vivoRef.current = true;
    return () => { vivoRef.current = false; minhasAbort.current?.abort(); };
  }, []);
  const cancelar = async (rv: MinhaReserva) => {
    if (cancelandoRef.current) return;
    cancelandoRef.current = true;
    setCancelando(rv.id);
    try {
      const x = await api.cancelar({ cpf: digitos(cpf), codigo, pedidoId: rv.id, confirmo: true });
      if (!vivoRef.current) return;
      setRes((r0) => r0 && { ...r0, reservas: r0.reservas.map((y) => (y.id === rv.id ? { ...y, status: 'cancelado' } : y)) });
      setMsgCancel((m) => ({ ...m, [rv.id]: { ok: true, texto: x.reembolsoCentavos > 0 ? `Reserva cancelada. O estorno de ${reais(x.reembolsoCentavos)} já foi pedido e você recebe a confirmação por e-mail.` : 'Reserva cancelada. Você recebe a confirmação por e-mail.' } }));
      setConfirmarCancel(null);
    } catch (e) {
      if (vivoRef.current) setMsgCancel((m) => ({ ...m, [rv.id]: { ok: false, texto: (e as Error).message } }));
    } finally {
      cancelandoRef.current = false;
      if (vivoRef.current) setCancelando(null);
    }
  };
  const fazerCheckin = (rv: MinhaReserva) => {
    if (checandoRef.current) return;
    if (!navigator.geolocation) { setMsgCheckin((m) => ({ ...m, [rv.id]: { ok: false, texto: 'Este aparelho não informa a localização. Faça o check-in no totem.' } })); return; }
    checandoRef.current = true;
    setChecando(rv.id);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const x = await api.checkin({ cpf: digitos(cpf), codigo, pedidoId: rv.id, lat: pos.coords.latitude, lng: pos.coords.longitude, precisao: pos.coords.accuracy });
        if (!vivoRef.current) return;
        setRes((r0) => r0 && { ...r0, reservas: r0.reservas.map((y) => (y.id === rv.id ? { ...y, checkinEm: x.checkinEm } : y)) });
        setMsgCheckin((m) => ({ ...m, [rv.id]: { ok: true, texto: 'Check-in feito! O termo de cada piloto já está indo para a impressora da recepção: no balcão, é só conferir e assinar.' } }));
      } catch (e) {
        if (vivoRef.current) setMsgCheckin((m) => ({ ...m, [rv.id]: { ok: false, texto: (e as Error).message } }));
      } finally {
        checandoRef.current = false;
        if (vivoRef.current) setChecando(null);
      }
    }, (err) => {
      checandoRef.current = false;
      if (!vivoRef.current) return;
      setChecando(null);
      setMsgCheckin((m) => ({ ...m, [rv.id]: { ok: false, texto: err.code === err.PERMISSION_DENIED ? 'Permita o acesso à localização para fazer o check-in (ou use o totem).' : 'Não foi possível obter sua localização. Tente de novo em um lugar aberto.' } }));
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };
  const buscar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (buscandoRef.current) return;
    setErro('');
    if (!cpfValido(cpf)) { setErro('Informe os 11 dígitos válidos do CPF de quem reservou.'); return; }
    if (!/^[A-Z0-9]{6}$/.test(codigo)) { setErro('Digite o código da reserva com 6 letras e números (ex.: ABC123).'); return; }
    buscandoRef.current = true;
    minhasAbort.current?.abort();
    const ctl = new AbortController();
    minhasAbort.current = ctl;
    setBuscando(true);
    try {
      const r0 = await api.minhas(digitos(cpf), codigo, ctl.signal);
      if (ctl.signal.aborted || !vivoRef.current) return;
      setRes(r0);
      setCorridas(null);
      api.corridas(digitos(cpf), codigo, ctl.signal)
        .then((c) => { if (!ctl.signal.aborted && vivoRef.current) setCorridas(c); })
        .catch(() => { if (!ctl.signal.aborted && vivoRef.current) setCorridas({ corridas: [], aviso: 'Não foi possível carregar o histórico agora.' }); });
    } catch (x) {
      if (!ctl.signal.aborted && vivoRef.current) setErro((x as Error).message);
    } finally {
      buscandoRef.current = false;
      if (!ctl.signal.aborted && vivoRef.current) setBuscando(false);
    }
  };
  const zapMsg = (rv: MinhaReserva, acao: 'cancelar' | 'remarcar', regra: string) =>
    `https://wa.me/${WHATS}?text=${encodeURIComponent(`Olá! Quero ${acao} a reserva ${rv.codigo}${rv.inicio ? ` (${diaLongo(deIso(rv.inicio))}, ${hora(deIso(rv.inicio))})` : ''}, no CPF de quem reservou. ${acao === 'cancelar' ? regra : 'Quais horários estão livres?'}`)}`;
  return (
    <div className="pagina estreita">
      <div className="cabeca"><div className="cabeca-tit"><h1 tabIndex={-1}>Minhas reservas</h1><p className="sub">Consulte suas reservas online, pague pendências, faça check-in, remarque ou cancele.</p></div></div>
      {!res ? (
        <form className="cartao principal" onSubmit={buscar} noValidate>
          <div className="form-grade">
            <Campo id="m-cpf" rotulo="CPF de quem reservou" valor={cpf} onChange={(v) => setCpf(mascaraCpf(v))} modo="numeric" auto="off" required enterKeyHint="next" />
            <Campo id="m-cod" rotulo="Código da reserva" valor={codigo} onChange={(v) => setCodigo(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} auto="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false} max={6} required enterKeyHint="search" dica="Código de 6 letras e números enviado na confirmação e no WhatsApp." />
          </div>
          {erro && <p className="msg-erro geral" role="alert">{erro}</p>}
          <div className="acoes"><button type="button" className="btn sec" onClick={onVoltar}>Voltar</button><button type="submit" className="btn" disabled={buscando} aria-busy={buscando}>{buscando ? 'Consultando…' : 'Consultar reservas'}</button></div>
        </form>
      ) : (
        <>
          <p className="muted">{res.reservas.length === 1 ? `Olá, ${res.nome}! Esta é a sua reserva online.` : `Olá, ${res.nome}! Estas são as suas ${res.reservas.length} reservas online.`}</p>
          <ul className="minhas">
            {res.reservas.map((rv) => {
              const dt = rv.inicio ? deIso(rv.inicio) : null;
              const [tom, rot] = ROTULO[rv.status] ?? ['neutro', rv.status];
              const regra = dt && (rv.status === 'confirmado' || rv.status === 'pago') ? regraDaPolitica(dt, rv.valorCentavos) : null;
              return (
                <li key={rv.id} className="cartao minha">
                  <div className="minha-topo"><div><strong>{dt ? `${diaLongo(dt)} · ${hora(dt)}` : 'Data a confirmar'}</strong><span className="muted pequeno">{`Reserva ${rv.codigo} · ${rv.quantidade} ${rv.quantidade === 1 ? 'piloto' : 'pilotos'}${rv.valorCentavos ? ` · ${reais(rv.valorCentavos)}` : ''}`}</span></div><span className={`selo-st ${tom}`}>{rot}</span></div>
                  {regra && !regra.passou && <p className="dica-mini">{regra.texto}</p>}
                  {(() => {
                    if (rv.checkinEm) return <p className="checkin ok">{`Check-in feito às ${hora(new Date(rv.checkinEm))}. Seu termo está na recepção para assinar.`}</p>;
                    if (!dt || rv.status !== 'confirmado') return null;
                    const falta = dt.getTime() - Date.now();
                    if (falta > 2 * 3600e3 || falta < -15 * 60e3) return null;
                    return <button type="button" className="btn grande checkin-btn" onClick={() => fazerCheckin(rv)} disabled={checando === rv.id} aria-busy={checando === rv.id}>{checando === rv.id ? 'Conferindo sua localização…' : 'Cheguei! Fazer check-in'}</button>;
                  })()}
                  {msgCheckin[rv.id] && <p className={`checkin ${msgCheckin[rv.id].ok ? 'ok' : 'erro'}`} role="status">{msgCheckin[rv.id].texto}</p>}
                  {rv.grupo && <LinksDoGrupo link={rv.grupo.link} painel={rv.grupo.painel} quando={dt} />}
                  {confirmarCancel === rv.id && regra && (
                    <div className="confirma-cancel" role="alertdialog" aria-labelledby={`cc-${rv.id}`}>
                      <p id={`cc-${rv.id}`}><strong>{`Cancelar a reserva ${rv.codigo}?`}</strong></p>
                      <p>{regra.noPrazo
                        ? `Você recebe ${rv.valorCentavos ? reais(Math.floor(rv.valorCentavos * 0.90)) : '90% do valor pago'} de volta (10% de taxa administrativa/operacional), na mesma forma de pagamento. Não dá para desfazer.`
                        : 'Faltam menos de 48 horas para a bateria: pela política não há reembolso. As vagas voltam para venda. Não dá para desfazer.'}</p>
                      <div className="acoes esq">
                        <button type="button" className="btn perigo" onClick={() => cancelar(rv)} disabled={cancelando === rv.id} aria-busy={cancelando === rv.id}>{cancelando === rv.id ? 'Cancelando…' : 'Confirmar cancelamento'}</button>
                        <button type="button" className="btn sec" onClick={() => setConfirmarCancel(null)} disabled={cancelando === rv.id}>Manter reserva</button>
                      </div>
                    </div>
                  )}
                  {msgCancel[rv.id] && <p className={`checkin ${msgCancel[rv.id].ok ? 'ok' : 'erro'}`} role="status">{msgCancel[rv.id].texto}</p>}
                  <div className="acoes esq">
                    <button type="button" className="btn sec" onClick={() => onAbrir(rv.id)}>{rv.status === 'aguardando_pagamento' ? 'Pagar agora' : 'Ver detalhes'}</button>
                    {regra && !regra.passou && <a className="btn sec" href={zapMsg(rv, 'remarcar', regra.texto)} target="_blank" rel="noopener">{regra.noPrazo ? 'Remarcar' : 'Solicitar remarcação'}</a>}
                    {regra && !regra.passou && rv.status === 'confirmado' && !rv.grupo && !rv.checkinEm
                      ? <button type="button" className="lnk" onClick={() => setConfirmarCancel(rv.id)}>Cancelar reserva</button>
                      : regra && !regra.passou && <a className="lnk" href={zapMsg(rv, 'cancelar', regra.texto)} target="_blank" rel="noopener">Pedir cancelamento</a>}
                  </div>
                </li>
              );
            })}
          </ul>
          {!!res.grupos?.length && (
            <section className="meus-grupos" aria-labelledby="t-grupos">
              <h2 id="t-grupos">Grupos que você organiza</h2>
              <ul className="minhas">
                {res.grupos.map((g) => {
                  const dt = deIso(g.inicio);
                  return (
                    <li key={g.codigo} className="cartao minha">
                      <div className="minha-topo"><div><strong>{`${diaLongo(dt)} · ${hora(dt)}`}</strong><span className="muted pequeno">{`${g.bateria} · grupo ${g.codigo}${g.vagas != null ? ` · ${g.pagos ?? 0} de ${g.vagas} pagos · ${g.cadastrados ?? 0} cadastrados` : ''}`}</span></div><span className="selo-st ok">{g.modo === 'individual' ? 'Cada um paga' : 'Grupo completo'}</span></div>
                      {g.link && g.painel && <LinksDoGrupo link={g.link} painel={g.painel} quando={dt} />}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <section className="corridas" aria-labelledby="t-corridas">
            <h2 id="t-corridas">Minhas corridas</h2>
            {!corridas ? <p className="muted">Carregando seu histórico…</p>
              : corridas.corridas.length ? (
                <ul>
                  {corridas.corridas.slice(0, 30).map((c) => (
                    <li key={c.sessionId}>
                      <span className={`pos${c.position <= 3 ? ' podio' : ''}`}>{c.position}º</span>
                      <span className="cor-info"><strong>{c.eventName}</strong><small>{`${c.eventDate.split('-').reverse().join('/')} · kart ${c.kart} · ${c.laps} ${c.laps === 1 ? 'volta' : 'voltas'}`}</small></span>
                      <span className="cor-volta"><small>melhor volta</small>{c.bestLapMs ? tempoVolta(c.bestLapMs) : '—'}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="muted">{corridas.aviso || 'Nenhuma corrida registrada neste CPF ainda. Após a primeira bateria, seus tempos aparecem aqui.'}</p>}
          </section>
          <p className="dica-mini">Cancelamentos e remarcações são confirmados pela recepção no WhatsApp, conforme a política. Reservas feitas diretamente no balcão ou como convidado de um grupo não aparecem aqui.</p>
          <div className="acoes"><button type="button" className="btn sec" onClick={() => setRes(null)}>Consultar outro CPF</button><button type="button" className="btn" onClick={onVoltar}>Fazer nova reserva</button></div>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ toast
function avisar(texto: string) {
  const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = texto;
  document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('on'));
  setTimeout(() => { el.classList.remove('on'); setTimeout(() => el.remove(), 300); }, 2200);
}
