import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ErroApi, FINAIS, ID_PEDIDO, type Agenda, type Aviso, type Horario, type MinhaReserva, type Pedido, type Politica } from './api';
import {
  cpfValido, dataIso, deIso, diaChave, diaCurto, diaLongo, digitos, emailValido, erroInstagram, hora, ics, idade,
  mascaraCep, mascaraCpf, mascaraData, mascaraFone, menosUmaHora, nomeMes, reais,
} from './util';

const WHATS = '5531998842898';
const IDADE_MIN = 14;
const PASSOS = ['Corrida', 'Pilotos', 'Cadastro', 'Pagamento'] as const;

type Pessoa = { nome: string; documento: string; nascimento: string; email: string; telefone: string; instagram: string; peso: string; cep: string; endereco: string; complemento: string; bairro: string; cidade: string };
const vazia = (): Pessoa => ({ nome: '', documento: '', nascimento: '', email: '', telefone: '', instagram: '', peso: '', cep: '', endereco: '', complemento: '', bairro: '', cidade: '' });
type Rascunho = { bateriaId: number | null; quantidade: number; euPiloto: boolean; comprador: Pessoa; acomp: Pessoa[]; forma: 'pix' | 'cartao' };
const RASCUNHO0: Rascunho = { bateriaId: null, quantidade: 1, euPiloto: true, comprador: vazia(), acomp: [], forma: 'pix' };

const ler = <T,>(k: string, padrao: T): T => { try { const v = sessionStorage.getItem(k); return v ? { ...padrao, ...JSON.parse(v) } : padrao; } catch { return padrao; } };
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
  useEffect(() => { const f = () => setMinhas(location.hash === '#minhas'); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const abrirMinhas = (e: React.MouseEvent) => { e.preventDefault(); history.pushState(null, '', location.pathname + '#minhas'); setMinhas(true); window.scrollTo({ top: 0 }); };
  const sairMinhas = () => { history.pushState(null, '', location.pathname); setMinhas(false); };
  const [aviso, setAviso] = useState<Aviso>(null);
  useEffect(() => { api.aviso().then(setAviso); }, []);
  const novo = () => { guardarPedido(null); setPedidoId(null); window.scrollTo({ top: 0 }); };
  return (
    <>
      <a className="pular" href="#conteudo">Pular para a reserva</a>
      <header className="barra">
        <a href="https://kartodromodebetim.com.br" className="marca" aria-label="Kartódromo Internacional de Betim, site principal"><img src="/booking-media/logo.png" alt="Kartódromo Internacional de Betim" width="160" height="44" /></a>
        <nav className="barra-acoes">
          <a href="#minhas" onClick={abrirMinhas} className="lnk-claro sempre"><Ico d={I.cal} s={16} />Minhas reservas</a>
          <a href="https://kartodromodebetim.com.br" className="lnk-claro"><Ico d={I.voltar} s={16} />Voltar ao site</a>
          <a href={`https://wa.me/${WHATS}`} target="_blank" rel="noopener" className="btn-claro"><Ico d={I.ajuda} s={16} />Precisa de ajuda?</a>
        </nav>
      </header>
      {aviso && <div className={`aviso ${aviso.tom === 'alerta' ? 'alerta' : ''}`} role="status"><Ico d={I.alerta} s={18} /><p>{aviso.texto}</p></div>}
      <main id="conteudo" tabIndex={-1}>
        {minhas ? <MinhasReservas onVoltar={sairMinhas} onAbrir={(id) => { sairMinhas(); guardarPedido(id); setPedidoId(id); window.scrollTo({ top: 0 }); }} />
          : pedidoId ? <Acompanhar id={pedidoId} onNovo={novo} /> : <Reserva onCriado={(id) => { guardarPedido(id); setPedidoId(id); window.scrollTo({ top: 0 }); }} />}
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
  const [r, setR] = useState<Rascunho>(() => ler('kib-rascunho', RASCUNHO0));
  const abertoEm = useRef(Date.now());
  const tituloRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { gravar('kib-rascunho', { ...r, comprador: { ...r.comprador }, acomp: r.acomp }); }, [r]);

  const carregar = useCallback(async () => {
    setCarregando(true); setErroAgenda('');
    try { setAgenda(await api.agenda()); } catch (e) { setErroAgenda((e as Error).message); } finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { const t = setInterval(() => { if (document.visibilityState === 'visible' && passo === 0) api.agenda().then(setAgenda).catch(() => undefined); }, 60000); return () => clearInterval(t); }, [passo]);

  const horario = agenda?.horarios.find((h) => h.id === r.bateriaId) ?? null;
  // horário escolhido sumiu da agenda (lotou ou passou do prazo)
  useEffect(() => { if (agenda && r.bateriaId && !horario) setR((x) => ({ ...x, bateriaId: null })); }, [agenda, r.bateriaId, horario]);
  const maxQtd = Math.max(1, Math.min(agenda?.maxPilotos ?? 10, horario?.livres ?? 10));
  const ir = (p: number) => { setPasso(p); requestAnimationFrame(() => { tituloRef.current?.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); }); };
  const titulos = ['Escolha quando correr.', 'Quem vai para a pista?', 'Dados de quem reserva e dos pilotos.', 'Confira e finalize.'];
  const subs = ['Selecione o dia e o horário da sua bateria.', 'Reserve as vagas do seu grupo na mesma bateria.', 'A reserva deve ser feita por um adulto, que pode ou não pilotar.', 'Revise sua corrida e escolha como pagar.'];

  return (
    <div className="pagina">
      <div className="cabeca">
        <div>
          <p className="sobre">Kartódromo de Betim · Reserva online</p>
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
          {passo === 0 && <EtapaCorrida agenda={agenda} carregando={carregando} erro={erroAgenda} recarregar={carregar} selecionado={r.bateriaId}
            onEscolher={(h) => { setR((x) => ({ ...x, bateriaId: h.id, quantidade: Math.min(x.quantidade, Math.max(1, Math.min(agenda?.maxPilotos ?? 10, h.livres))) })); ir(1); }} />}
          {passo === 1 && horario && <EtapaPilotos r={r} setR={setR} max={maxQtd} horario={horario} voltar={() => ir(0)} avancar={() => ir(2)} />}
          {passo === 2 && horario && <EtapaCadastro r={r} setR={setR} voltar={() => ir(1)} avancar={() => ir(3)} />}
          {passo === 3 && horario && agenda && <EtapaPagamento r={r} setR={setR} horario={horario} agenda={agenda} abertoEm={abertoEm.current} voltar={() => ir(2)}
            onCriado={(id) => { try { sessionStorage.removeItem('kib-rascunho'); } catch { /* ok */ } onCriado(id); }}
            onIndisponivel={() => { setR((x) => ({ ...x, bateriaId: null })); carregar(); ir(0); }} />}
          {passo > 0 && !horario && <div className="vazio"><p>Esse horário não está mais disponível.</p><button className="btn" onClick={() => ir(0)}>Escolher outro horário</button></div>}
        </section>
        <Resumo horario={horario} r={r} agenda={agenda} />
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
  if (erro && !agenda) return <div className="erro-bloco" role="alert"><strong>Não foi possível carregar a agenda</strong><p>{erro}</p><button className="btn" onClick={recarregar}>Tentar de novo</button></div>;
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
        <div><h2>Data e horário</h2><p className="muted">Os horários abaixo têm vagas disponíveis.</p></div>
        <button className="ico-btn" onClick={recarregar} aria-label="Atualizar horários" title="Atualizar horários"><Ico d={I.atualizar} /></button>
      </div>
      <div className="corrida">
        <div className="calendario" aria-label="Dias com horários disponíveis">
          <div className="cal-topo">
            <button className="ico-btn" onClick={() => mudarMes(-1)} disabled={!temAntes} aria-label="Mês anterior"><Ico d={I.esq} /></button>
            <strong>{nomeMes(ano, m)}</strong>
            <button className="ico-btn" onClick={() => mudarMes(1)} disabled={!temDepois} aria-label="Próximo mês"><Ico d={I.dir} /></button>
          </div>
          <div className="cal-grade" role="grid">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <span key={i} className="cal-sem" aria-hidden="true">{d}</span>)}
            {celulas.map((c, i) => {
              if (!c) return <span key={i} />;
              const k = diaChave(c); const tem = porDia.has(k);
              return <button key={i} className={`cal-dia${k === dia ? ' sel' : ''}${tem ? ' tem' : ''}`} disabled={!tem} aria-pressed={k === dia}
                aria-label={`${diaLongo(c)}${tem ? `, ${porDia.get(k)!.length} horários` : ', sem horários'}`} onClick={() => { setDia(k); setTodos(false); }}>{c.getDate()}</button>;
            })}
          </div>
        </div>
        <div className="horarios">
          <div className="hor-topo">
            <div><p className="sobre">Horários de largada</p><strong className="dia-sel">{dia && diaCurto(deIso(dia + 'T00:00'))}</strong></div>
            <button className="lnk" onClick={compartilhar}><Ico d={I.compartilhar} s={16} />Compartilhar data</button>
          </div>
          <div className="segmentos" role="radiogroup" aria-label="Período">
            {([['todos', 'Todos'], ['antes', 'Antes das 18h'], ['depois', 'A partir das 18h']] as const).map(([v, t]) =>
              <button key={v} role="radio" aria-checked={periodo === v} className={periodo === v ? 'on' : ''} onClick={() => setPeriodo(v)}>{t}</button>)}
          </div>
          {visiveis.length ? (
            <div className="hor-lista">
              {visiveis.map((h) => {
                const dt = deIso(h.inicio); const poucas = h.livres <= 5;
                return (
                  <button key={h.id} className={`hor${h.id === selecionado ? ' sel' : ''}`} onClick={() => onEscolher(h)} aria-label={`${hora(dt)}, ${h.livres} vagas, ${reais(h.precoCentavos)} por piloto`}>
                    <span className="hor-l"><strong>{hora(dt)}</strong><span className={`vagas${poucas ? ' poucas' : ''}`}>{poucas ? `Últimas ${h.livres}` : `${h.livres} vagas`}</span></span>
                    <span className="hor-chegue">Chegue às {menosUmaHora(dt)}</span>
                    {(h.precoCentavos !== agenda.precoCentavos || h.precoPrimeiraVezCentavos) && <span className="hor-preco">{reais(h.precoCentavos)}{h.precoPrimeiraVezCentavos ? ` · 1ª vez ${reais(h.precoPrimeiraVezCentavos)}` : ''}</span>}
                  </button>
                );
              })}
            </div>
          ) : <p className="muted vazio-mini">Nenhum horário nesse período. Troque o filtro ou o dia.</p>}
          {lista.length > 6 && !todos && <button className="lnk centro" onClick={() => setTodos(true)}>Ver todos os horários ({lista.length})</button>}
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
function EtapaPilotos({ r, setR, max, horario, voltar, avancar }: { r: Rascunho; setR: React.Dispatch<React.SetStateAction<Rascunho>>; max: number; horario: Horario; voltar: () => void; avancar: () => void }) {
  const q = Math.min(r.quantidade, max);
  const mudar = (n: number) => setR((x) => ({ ...x, quantidade: Math.max(1, Math.min(max, n)) }));
  return (
    <>
      <div className="etapa-topo"><span className="num">02</span><div><h2>Pilotos</h2><p className="muted">Todos correm juntos na mesma bateria.</p></div></div>
      <div className="contador">
        <span id="lbl-qtd">Quantos pilotos?</span>
        <div className="qtd" role="group" aria-labelledby="lbl-qtd">
          <button className="ico-btn" onClick={() => mudar(q - 1)} disabled={q <= 1} aria-label="Menos um piloto"><Ico d={I.menos} /></button>
          <output aria-live="polite">{q}</output>
          <button className="ico-btn" onClick={() => mudar(q + 1)} disabled={q >= max} aria-label="Mais um piloto"><Ico d={I.mais} /></button>
        </div>
        <span className="muted">máx. {max} {max === 1 ? 'vaga' : 'vagas'} neste horário</span>
      </div>
      {horario.precoPrimeiraVezCentavos ? <p className="dica-mini">Primeira vez no Kartódromo de Betim? Nesse horário, cada piloto estreante paga {reais(horario.precoPrimeiraVezCentavos)}. O desconto é conferido pelo CPF e aparece no total da próxima tela.</p> : null}
      <fieldset className="escolha">
        <legend>Você também vai pilotar?</legend>
        <label className={r.euPiloto ? 'on' : ''}><input type="radio" name="eu" checked={r.euPiloto} onChange={() => setR((x) => ({ ...x, euPiloto: true }))} /><span><strong>Sim, vou correr</strong><small>Uma das vagas é minha.</small></span></label>
        <label className={!r.euPiloto ? 'on' : ''}><input type="radio" name="eu" checked={!r.euPiloto} onChange={() => setR((x) => ({ ...x, euPiloto: false }))} /><span><strong>Não, só vou reservar</strong><small>Reservo e pago para outras pessoas.</small></span></label>
      </fieldset>
      <p className="dica-mini">Cada vaga é de uma pessoa diferente. Na próxima etapa você informa nome, CPF e nascimento de cada piloto.</p>
      <div className="acoes"><button className="btn sec" onClick={voltar}>Voltar</button><button className="btn" onClick={() => { setR((x) => ({ ...x, quantidade: q })); avancar(); }}>Continuar</button></div>
    </>
  );
}

// ------------------------------------------------------------------ 3. cadastro
type Erros = Record<string, string>;
function validarTudo(r: Rascunho): Erros {
  const e: Erros = {}; const c = r.comprador;
  if (c.nome.trim().split(/\s+/).length < 2) e['c.nome'] = 'Informe nome e sobrenome.';
  if (!cpfValido(c.documento)) e['c.documento'] = 'Confira os 11 números do CPF.';
  if (!emailValido(c.email)) e['c.email'] = c.email ? 'Confira o endereço de e-mail.' : 'Informe seu e-mail (o recibo e o resultado vão para ele).';
  if (digitos(c.telefone).length < 10) e['c.telefone'] = 'Informe um celular com DDD.';
  const nasc = dataIso(c.nascimento);
  if (!nasc) e['c.nascimento'] = 'Use uma data válida: DD/MM/AAAA.'; else if (idade(nasc) < 18) e['c.nascimento'] = 'A reserva deve ser feita por um adulto de 18 anos ou mais. Confira a data.';
  if (!c.instagram.trim()) e['c.instagram'] = 'Informe seu Instagram (o @usuário). Ele sai junto com seu nome no resultado da bateria.'; else if (erroInstagram(c.instagram)) e['c.instagram'] = erroInstagram(c.instagram);
  if (r.euPiloto) { const p = Number(c.peso.replace(',', '.')); if (!(p >= 20 && p <= 250)) e['c.peso'] = 'Informe seu peso (kg). Ele é usado para equilibrar os karts.'; }
  const docs = new Set([digitos(c.documento)]);
  const n = r.quantidade - (r.euPiloto ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const a = r.acomp[i] ?? vazia(); const k = `a${i}.`;
    if (a.nome.trim().split(/\s+/).length < 2) e[k + 'nome'] = 'Informe nome e sobrenome.';
    if (!cpfValido(a.documento)) e[k + 'documento'] = 'Confira os 11 números do CPF.';
    else if (docs.has(digitos(a.documento))) e[k + 'documento'] = 'Cada piloto precisa de um CPF diferente (cada vaga é de uma pessoa).';
    docs.add(digitos(a.documento));
    const na = dataIso(a.nascimento);
    if (!na) e[k + 'nascimento'] = 'Use uma data válida: DD/MM/AAAA.'; else if (idade(na) < IDADE_MIN) e[k + 'nascimento'] = `Cada piloto precisa ter ${IDADE_MIN} anos ou mais.`;
    if (!emailValido(a.email)) e[k + 'email'] = a.email ? 'Confira o e-mail.' : 'Informe o e-mail.';
    if (digitos(a.telefone).length < 10) e[k + 'telefone'] = 'Informe o celular com DDD.';
    const p = Number(a.peso.replace(',', '.')); if (!(p >= 20 && p <= 250)) e[k + 'peso'] = a.peso ? 'Informe um peso entre 20 e 250 kg.' : 'Informe o peso (kg).';
    if (a.instagram.trim() && erroInstagram(a.instagram)) e[k + 'instagram'] = 'Confira o Instagram: só o @usuário, ou deixe em branco.';
    if (!a.endereco.trim()) e[k + 'endereco'] = 'Informe o endereço (rua e número).';
    if (!a.bairro.trim()) e[k + 'bairro'] = 'Informe o bairro.';
    if (!a.cidade.trim()) e[k + 'cidade'] = 'Informe a cidade.';
  }
  return e;
}

function Campo({ id, rotulo, valor, erro, onChange, tipo = 'text', modo, auto, dica, max, opcional, onBlur }: {
  id: string; rotulo: string; valor: string; erro?: string; onChange: (v: string) => void; tipo?: string; modo?: React.HTMLAttributes<HTMLInputElement>['inputMode']; auto?: string; dica?: string; max?: number; opcional?: boolean; onBlur?: () => void;
}) {
  return (
    <div className={`campo${erro ? ' com-erro' : ''}`}>
      <label htmlFor={id}>{rotulo}{opcional ? <small> (opcional)</small> : null}</label>
      <input id={id} type={tipo} inputMode={modo} autoComplete={auto} maxLength={max} value={valor} onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
        aria-invalid={!!erro} aria-describedby={erro ? id + '-e' : dica ? id + '-d' : undefined} />
      {erro ? <p className="msg-erro" id={id + '-e'}>{erro}</p> : dica ? <p className="dica-campo" id={id + '-d'}>{dica}</p> : null}
    </div>
  );
}

async function buscarCep(cep: string): Promise<Partial<Pessoa> | null> {
  if (digitos(cep).length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${digitos(cep)}/json/`);
    const j = await r.json();
    if (j.erro) return null;
    return { endereco: j.logradouro || '', bairro: j.bairro || '', cidade: j.localidade ? `${j.localidade}/${j.uf}` : '' };
  } catch { return null; }
}

function FormPessoa({ p, prefixo, erros, set, mostrar, comprador, piloto }: { p: Pessoa; prefixo: string; erros: Erros; set: (campo: keyof Pessoa, v: string) => void; mostrar: (k: string) => boolean; comprador?: boolean; piloto?: boolean }) {
  const er = (k: keyof Pessoa) => (mostrar(prefixo + k) ? erros[prefixo + k] : undefined);
  const id = (k: string) => `${prefixo.replace('.', '-')}${k}`;
  return (
    <div className="form-grade">
      <Campo id={id('nome')} rotulo="Nome completo" valor={p.nome} erro={er('nome')} onChange={(v) => set('nome', v)} auto={comprador ? 'name' : 'off'} max={120} />
      <Campo id={id('documento')} rotulo="CPF" valor={p.documento} erro={er('documento')} onChange={(v) => set('documento', mascaraCpf(v))} modo="numeric" auto="off" />
      <Campo id={id('nascimento')} rotulo="Data de nascimento" valor={p.nascimento} erro={er('nascimento')} onChange={(v) => set('nascimento', mascaraData(v))} modo="numeric" auto={comprador ? 'bday' : 'off'} dica="DD/MM/AAAA" />
      <Campo id={id('telefone')} rotulo="Celular (WhatsApp)" valor={p.telefone} erro={er('telefone')} onChange={(v) => set('telefone', mascaraFone(v))} tipo="tel" modo="tel" auto={comprador ? 'tel-national' : 'off'} />
      <Campo id={id('email')} rotulo="E-mail" valor={p.email} erro={er('email')} onChange={(v) => set('email', v)} tipo="email" modo="email" auto={comprador ? 'email' : 'off'} max={160} />
      <Campo id={id('instagram')} rotulo="Instagram" valor={p.instagram} erro={er('instagram')} onChange={(v) => set('instagram', v)} auto="off" opcional={!comprador} dica="Sai com o nome no resultado da bateria." max={40} />
      {piloto && <Campo id={id('peso')} rotulo="Peso (kg)" valor={p.peso} erro={er('peso')} onChange={(v) => set('peso', v.replace(/[^\d,.]/g, '').slice(0, 5))} modo="decimal" dica="Usado para equilibrar os karts." />}
      {!comprador && <>
        <Campo id={id('cep')} rotulo="CEP" valor={p.cep} onChange={(v) => set('cep', mascaraCep(v))} modo="numeric" opcional onBlur={async () => { const x = await buscarCep(p.cep); if (x) (Object.keys(x) as (keyof Pessoa)[]).forEach((k) => { if (x[k] && !p[k]) set(k, x[k]!); }); }} dica="Preenche o endereço." />
        <Campo id={id('endereco')} rotulo="Endereço (rua e número)" valor={p.endereco} erro={er('endereco')} onChange={(v) => set('endereco', v)} max={150} />
        <Campo id={id('bairro')} rotulo="Bairro" valor={p.bairro} erro={er('bairro')} onChange={(v) => set('bairro', v)} max={80} />
        <Campo id={id('cidade')} rotulo="Cidade" valor={p.cidade} erro={er('cidade')} onChange={(v) => set('cidade', v)} max={80} />
      </>}
    </div>
  );
}

function EtapaCadastro({ r, setR, voltar, avancar }: { r: Rascunho; setR: React.Dispatch<React.SetStateAction<Rascunho>>; voltar: () => void; avancar: () => void }) {
  const [tocados, setTocados] = useState<Set<string>>(new Set());
  const [tentou, setTentou] = useState(false);
  const erros = validarTudo(r);
  const mostrar = (k: string) => tentou || tocados.has(k);
  const n = r.quantidade - (r.euPiloto ? 1 : 0);
  const setC = (campo: keyof Pessoa, v: string) => { setR((x) => ({ ...x, comprador: { ...x.comprador, [campo]: v } })); setTocados((t) => new Set(t).add('c.' + campo)); };
  const setA = (i: number) => (campo: keyof Pessoa, v: string) => {
    setR((x) => { const acomp = [...x.acomp]; while (acomp.length <= i) acomp.push(vazia()); acomp[i] = { ...acomp[i], [campo]: v }; return { ...x, acomp }; });
    setTocados((t) => new Set(t).add(`a${i}.${campo}`));
  };
  const faltam = Object.keys(erros).length;
  const continuar = () => {
    setTentou(true);
    if (faltam) { requestAnimationFrame(() => (document.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus()); return; }
    avancar();
  };
  return (
    <>
      <div className="etapa-topo"><span className="num">03</span><div><h2>Cadastro</h2><p className="muted">Com esses dados o totem encontra cada piloto pelo CPF no dia.</p></div></div>
      <section className="bloco">
        <h3>{r.euPiloto ? 'Você (quem reserva e pilota)' : 'Você (quem reserva)'}</h3>
        <FormPessoa p={r.comprador} prefixo="c." erros={erros} set={setC} mostrar={mostrar} comprador piloto={r.euPiloto} />
      </section>
      {Array.from({ length: n }, (_, i) => (
        <section className="bloco" key={i}>
          <h3>Piloto {i + (r.euPiloto ? 2 : 1)}</h3>
          <FormPessoa p={r.acomp[i] ?? vazia()} prefixo={`a${i}.`} erros={erros} set={setA(i)} mostrar={mostrar} piloto />
        </section>
      ))}
      <p className="dica-mini">Seus dados são usados só para a reserva, o cadastro no totem e o resultado da bateria (LGPD). Menores de 18 anos assinam o termo com o responsável no dia.</p>
      {tentou && faltam > 0 && <p className="msg-erro geral" role="alert">Faltam {faltam} {faltam === 1 ? 'campo' : 'campos'}. Confira os destacados.</p>}
      <div className="acoes"><button className="btn sec" onClick={voltar}>Voltar</button><button className="btn" onClick={continuar}>Continuar</button></div>
    </>
  );
}

// ------------------------------------------------------------------ 4. pagamento
function EtapaPagamento({ r, setR, horario, agenda, abertoEm, voltar, onCriado, onIndisponivel }: {
  r: Rascunho; setR: React.Dispatch<React.SetStateAction<Rascunho>>; horario: Horario; agenda: Agenda; abertoEm: number; voltar: () => void; onCriado: (id: string) => void; onIndisponivel: () => void;
}) {
  const [aceite, setAceite] = useState(false);
  const [politica, setPolitica] = useState<Politica | null>(null);
  const [verPolitica, setVerPolitica] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [incerto, setIncerto] = useState(false);
  const isca = useRef<HTMLInputElement>(null);
  useEffect(() => { api.politica().then(setPolitica).catch(() => undefined); }, []);
  const dt = deIso(horario.inicio);
  const [cupom, setCupom] = useState('');
  const [aplicado, setAplicado] = useState<{ codigo: string; descontoCentavos: number; totalCentavos: number; brutoCentavos: number } | null>(null);
  const [aplicando, setAplicando] = useState(false);
  const [erroCupom, setErroCupom] = useState('');
  const nOutros = r.quantidade - (r.euPiloto ? 1 : 0);
  const documentos = [...(r.euPiloto ? [r.comprador.documento] : []), ...r.acomp.slice(0, nOutros).map((a) => a.documento)].map(digitos);
  const total = aplicado ? aplicado.totalCentavos : horario.precoCentavos * r.quantidade;
  const aplicarCupom = async () => {
    const codigo = cupom.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{1,40}$/.test(codigo)) { setErroCupom('Confira o código do cupom.'); return; }
    setAplicando(true); setErroCupom(''); setAplicado(null);
    try {
      const { requestId } = await api.cupom({ codigo, bateriaId: horario.id, quantidade: r.quantidade, documento: digitos(r.comprador.documento), documentos });
      // o kartódromo confere o cupom em poucos segundos
      for (let i = 0; i < 20; i++) {
        await new Promise((ok) => setTimeout(ok, 1500));
        const x = await api.cupomResultado(requestId);
        if (x.status === 'pending') continue;
        if (x.erro) { setErroCupom(x.erro); return; }
        setAplicado({ codigo, descontoCentavos: x.descontoCentavos ?? 0, totalCentavos: x.totalCentavos ?? 0, brutoCentavos: x.brutoCentavos ?? 0 });
        return;
      }
      setErroCupom('O kartódromo não respondeu agora. Tente de novo em instantes ou finalize sem cupom.');
    } catch (e) { setErroCupom((e as Error).message); } finally { setAplicando(false); }
  };
  const enviar = async () => {
    if (!aceite) { setErro('Para reservar, aceite a política de cancelamento.'); return; }
    if (!agenda.pagamentoOnline) { setErro('Pagamento online indisponível. Fale com a recepção.'); return; }
    // o servidor recusa envios feitos menos de 6 s depois de abrir a página (anti-robô)
    const espera = 6500 - (Date.now() - abertoEm);
    setEnviando(true); setErro('');
    if (espera > 0) await new Promise((ok) => setTimeout(ok, espera));
    const c = r.comprador; const n = r.quantidade - (r.euPiloto ? 1 : 0);
    const corpo = {
      ...c, nome: c.nome.trim(), email: c.email.trim(), documento: c.documento, nascimento: dataIso(c.nascimento), tipoDocumento: 'CPF',
      bateriaId: horario.id, quantidade: r.quantidade, compradorPilota: r.euPiloto,
      pilotos: [...(r.euPiloto ? [c.nome.trim()] : []), ...r.acomp.slice(0, n).map((a) => a.nome.trim())],
      acompanhantes: r.acomp.slice(0, n).map((a) => ({ ...a, nome: a.nome.trim(), email: a.email.trim(), nascimento: dataIso(a.nascimento), endereco: a.endereco.trim(), bairro: a.bairro.trim(), cidade: a.cidade.trim() })),
      forma: r.forma, politica: true, lgpd: true, site: isca.current?.value || '', t: abertoEm, ...(aplicado ? { cupom: aplicado.codigo } : {}),
    };
    try {
      const res = await api.criar(corpo);
      if (!ID_PEDIDO.test(res.id || '')) throw new ErroApi('Não foi possível verificar o número do pedido.', 500);
      onCriado(res.id);
    } catch (e) {
      const st = (e as ErroApi).status;
      if (!st || st >= 500) setIncerto(true);
      const msg = (e as Error).message;
      if (/hor[aá]rio|lotou|vaga/i.test(msg) && st === 400) { setErro(msg + ' Escolha outro horário.'); setTimeout(onIndisponivel, 2500); }
      else setErro(msg);
    } finally { setEnviando(false); }
  };
  return (
    <>
      <div className="etapa-topo"><span className="num">04</span><div><h2>Pagamento</h2><p className="muted">As vagas ficam separadas por {agenda.prazoMin} minutos enquanto você paga.</p></div></div>
      <dl className="conferir">
        <div><dt>Bateria</dt><dd>{diaLongo(dt)} · {hora(dt)}</dd></div>
        <div><dt>Chegada</dt><dd>{menosUmaHora(dt)} (1 hora antes)</dd></div>
        <div><dt>Pilotos</dt><dd>{[...(r.euPiloto ? [r.comprador.nome] : []), ...r.acomp.slice(0, r.quantidade - (r.euPiloto ? 1 : 0)).map((a) => a.nome)].map((x) => x.trim().split(/\s+/)[0]).join(', ')}</dd></div>
        <div><dt>Quem reserva</dt><dd>{r.comprador.nome} · {r.comprador.email}</dd></div>
      </dl>
      <fieldset className="escolha formas">
        <legend>Como você quer pagar?</legend>
        <label className={r.forma === 'pix' ? 'on' : ''}><input type="radio" name="forma" checked={r.forma === 'pix'} onChange={() => setR((x) => ({ ...x, forma: 'pix' }))} /><span><strong>Pix</strong><small>Aprovação na hora. QR code na próxima tela.</small></span></label>
        <label className={r.forma === 'cartao' ? 'on' : ''}><input type="radio" name="forma" checked={r.forma === 'cartao'} onChange={() => setR((x) => ({ ...x, forma: 'cartao' }))} /><span><strong>Cartão de crédito</strong><small>Página segura da Asaas.</small></span></label>
      </fieldset>
      <div className="cupom">
        <label htmlFor="cupom">Cupom de desconto <small>(opcional)</small></label>
        <div className="cupom-linha">
          <input id="cupom" value={cupom} onChange={(e) => { setCupom(e.target.value.toUpperCase().replace(/\s/g, '')); setAplicado(null); setErroCupom(''); }} maxLength={40} autoComplete="off" autoCapitalize="characters" aria-invalid={!!erroCupom} aria-describedby="cupom-msg" />
          <button type="button" className="btn sec" onClick={aplicarCupom} disabled={aplicando || !cupom.trim()} aria-busy={aplicando}>{aplicando ? 'Conferindo…' : aplicado ? 'Aplicado' : 'Aplicar'}</button>
        </div>
        <p id="cupom-msg" className={erroCupom ? 'msg-erro' : 'dica-campo'} role={erroCupom ? 'alert' : undefined}>{erroCupom || (aplicado ? `Cupom ${aplicado.codigo}: desconto de ${reais(aplicado.descontoCentavos)}.` : '')}</p>
      </div>
      <div className="total"><span>{aplicado ? <><s>{reais(aplicado.brutoCentavos)}</s> com cupom</> : `${r.quantidade} × ${reais(horario.precoCentavos)}`}</span><strong>{reais(total)}</strong></div>
      {horario.precoPrimeiraVezCentavos ? <p className="dica-mini">Estreantes pagam {reais(horario.precoPrimeiraVezCentavos)} neste horário: o desconto é conferido pelo CPF e já vem no valor do Pix/cartão.</p> : null}
      <label className="aceite">
        <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
        <span>{politica?.aceite ?? 'Li e aceito a Política de Cancelamento, Reagendamento e Reembolso.'} <button type="button" className="lnk inline" onClick={() => setVerPolitica(true)}>Ler a política</button></span>
      </label>
      <input ref={isca} name="site" tabIndex={-1} autoComplete="off" className="isca" aria-hidden="true" />
      {erro && <p className="msg-erro geral" role="alert">{erro}</p>}
      {incerto && <p className="dica-mini">Não conseguimos confirmar se o pedido chegou. Para não pagar duas vezes, <a href={`https://wa.me/${WHATS}`} target="_blank" rel="noopener">fale com a recepção</a> antes de tentar de novo.</p>}
      <div className="acoes"><button className="btn sec" onClick={voltar} disabled={enviando}>Voltar</button>
        <button className="btn grande" onClick={enviar} disabled={enviando || !aceite} aria-busy={enviando}>{enviando ? 'Separando suas vagas…' : `Reservar e pagar ${reais(total)}`}</button></div>
      {verPolitica && <ModalPolitica politica={politica} fechar={() => setVerPolitica(false)} aceitar={() => { setAceite(true); setVerPolitica(false); }} />}
    </>
  );
}

function ModalPolitica({ politica, fechar, aceitar }: { politica: Politica | null; fechar: () => void; aceitar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} className="modal" onClose={fechar} aria-labelledby="pol-t">
      <div className="modal-topo"><h2 id="pol-t">{politica?.titulo ?? 'Política de Cancelamento'}</h2><button className="ico-btn" onClick={fechar} aria-label="Fechar"><Ico d={I.x} /></button></div>
      <div className="modal-corpo">
        {!politica ? <p>Carregando…</p> : politica.secoes.map((s) => (
          <section key={s.titulo}><h3>{s.titulo}</h3>{s.paragrafos?.map((p, i) => <p key={i}>{p}</p>)}
            {s.subsecoes?.map((ss) => <div key={ss.titulo}><h4>{ss.titulo}</h4>{ss.paragrafos.map((p, i) => <p key={i}>{p}</p>)}</div>)}</section>
        ))}
      </div>
      <div className="modal-pe"><button className="btn sec" onClick={fechar}>Fechar</button><button className="btn" onClick={aceitar}>Li e aceito</button></div>
    </dialog>
  );
}

// ------------------------------------------------------------------ resumo lateral
function Resumo({ horario, r, agenda }: { horario: Horario | null; r: Rascunho; agenda: Agenda | null }) {
  const dt = horario ? deIso(horario.inicio) : null;
  const preco = horario?.precoCentavos ?? agenda?.precoCentavos ?? 0;
  return (
    <aside className="cartao resumo" aria-label="Resumo da reserva">
      <div className="resumo-foto"><img src="/booking-media/action.webp" alt="Kart em ação na pista de Betim" loading="lazy" /><span><Ico d={I.bandeira} s={14} />Kart de aluguel</span></div>
      <div className="resumo-corpo">
        <h2>Sua corrida</h2>
        <dl>
          <div><dt>Dia</dt><dd>{dt ? diaLongo(dt) : 'Selecione na agenda'}</dd></div>
          <div><dt>Largada</dt><dd>{dt ? hora(dt) : '—'}</dd></div>
          <div><dt>Chegada</dt><dd>{dt ? menosUmaHora(dt) : '—'}</dd></div>
          <div><dt>Pilotos</dt><dd>{r.quantidade}</dd></div>
        </dl>
        <div className="resumo-total"><span>Total</span><strong>{horario ? reais(preco * r.quantidade) : '—'}</strong></div>
        <p className="muted pequeno"><Ico d={I.escudo} s={14} /> Pix ou cartão pela Asaas</p>
      </div>
    </aside>
  );
}

// ------------------------------------------------------------------ acompanhamento do pedido
function Acompanhar({ id, onNovo }: { id: string; onNovo: () => void }) {
  const [p, setP] = useState<Pedido | null>(null);
  const [falhas, setFalhas] = useState(0);
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    let vivo = true; let t: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const x = await api.pedido(id); if (!vivo) return; setP(x); setFalhas(0);
        if (FINAIS.has(x.status)) { if (x.status !== 'confirmado') guardarPedido(id); return; }
      } catch (e) {
        if (!vivo) return;
        if ((e as ErroApi).status === 404) { setP({ id, status: 'nao_encontrada' } as Pedido); return; }
        setFalhas((f) => f + 1);
      }
      t = setTimeout(tick, document.visibilityState === 'visible' ? 3500 : 10000);
    };
    tick();
    const r = setInterval(() => setAgora(Date.now()), 1000);
    return () => { vivo = false; clearTimeout(t); clearInterval(r); };
  }, [id]);

  if (!p) return <div className="pagina estreita"><div className="cartao carregando" role="status">Carregando sua reserva…</div></div>;
  const dt = p.inicio ? deIso(p.inicio) : null;
  const restante = p.expiraEm ? Math.max(0, Date.parse(p.expiraEm) - agora) : 0;
  const mm = Math.floor(restante / 60000), ss = Math.floor((restante % 60000) / 1000);
  const info = dt && <p className="ped-info"><Ico d={I.cal} s={16} />{diaLongo(dt)} · largada {hora(dt)} · {p.quantidade} {p.quantidade === 1 ? 'piloto' : 'pilotos'}{p.valorCentavos ? ` · ${reais(p.valorCentavos)}` : ''}</p>;
  const ajuda = <a className="btn sec" href={`https://wa.me/${WHATS}?text=${encodeURIComponent('Reserva ' + (p.codigo || p.id))}`} target="_blank" rel="noopener">Falar com a recepção</a>;

  let corpo: React.ReactNode;
  if (p.status === 'confirmado') {
    const baixar = () => { const b = new Blob([ics(dt!, p.codigo, p.descricao || 'Kart')], { type: 'text/calendar' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `kart-${p.codigo}.ics`; a.click(); };
    corpo = <>
      <div className="selo ok"><Ico d={I.ok} s={28} /></div>
      <p className="sobre">Tudo certo para a corrida</p><h1>Reserva confirmada</h1>{info}
      <div className="codigo"><span>Código da reserva</span><strong>{p.codigo}</strong><button className="ico-btn" onClick={() => { navigator.clipboard?.writeText(p.codigo); avisar('Código copiado'); }} aria-label="Copiar código"><Ico d={I.copiar} /></button></div>
      <p className="dica-mini centro">Guarde o código: com ele e o CPF você acessa <a href="#minhas">Minhas reservas</a> para remarcar ou cancelar.</p>
      <ol className="no-dia"><li>Chegue às <strong>{dt && menosUmaHora(dt)}</strong>, uma hora antes da largada.</li><li>No totem, informe o <strong>CPF de quem reservou</strong> e confira os dados.</li><li>O termo de responsabilidade é assinado na recepção.</li></ol>
      <div className="acoes centro">{dt && <button className="btn" onClick={baixar}>Salvar na agenda</button>}<a className="btn sec" href="https://maps.google.com/?q=Kart%C3%B3dromo+Internacional+de+Betim" target="_blank" rel="noopener">Como chegar</a></div>
      <button className="lnk centro" onClick={onNovo}>Fazer outra reserva</button>
    </>;
  } else if (p.status === 'aguardando_pagamento' && p.pix) {
    corpo = <>
      <p className="sobre">Vagas separadas por {mm}:{String(ss).padStart(2, '0')}</p><h1>Pague com Pix</h1>{info}
      <img className="qr" src={`data:image/png;base64,${p.pix.imagem}`} alt="QR code do Pix desta reserva" width="240" height="240" />
      <label className="campo"><span>Pix copia e cola</span><textarea readOnly value={p.pix.payload} rows={3} onFocus={(e) => e.target.select()} /></label>
      <div className="acoes centro"><button className="btn grande" onClick={async () => { try { await navigator.clipboard.writeText(p.pix!.payload); avisar('Código Pix copiado'); } catch { avisar('Selecione e copie o código no campo acima.'); } }}>Copiar código Pix</button></div>
      <p className="dica-mini centro">Confira o valor no banco antes de confirmar. A confirmação aparece aqui sozinha.</p>
    </>;
  } else if (p.status === 'aguardando_pagamento' && p.invoiceUrl) {
    corpo = <>
      <p className="sobre">Vagas separadas por {mm}:{String(ss).padStart(2, '0')}</p><h1>Pague com cartão</h1>{info}
      <div className="acoes centro"><a className="btn grande" href={p.invoiceUrl} target="_blank" rel="noopener">Abrir pagamento seguro</a></div>
      <p className="dica-mini centro">Pagamento processado pela Asaas. Volte para esta página: a confirmação aparece aqui.</p>
    </>;
  } else if (p.status === 'novo' || p.preparandoPagamento) {
    corpo = <><div className="girando" aria-hidden="true" /><h1>Preparando seu pagamento</h1>{info}<p className="muted centro">Verificando a disponibilidade e gerando a cobrança. Leva alguns segundos.</p></>;
  } else if (p.status === 'pago') {
    corpo = <><div className="girando" aria-hidden="true" /><p className="sobre">Pagamento recebido</p><h1>Falta confirmar sua reserva</h1>{info}<p className="muted centro">Estamos lançando as vagas no sistema do kartódromo. Não faça outro pagamento.</p></>;
  } else if (p.status === 'expirado') {
    corpo = <><h1>O prazo de pagamento terminou</h1>{info}<p className="muted centro">As vagas foram liberadas. Se você pagou agora há pouco, fale com a recepção.</p><div className="acoes centro"><button className="btn" onClick={onNovo}>Escolher outro horário</button>{ajuda}</div></>;
  } else if (p.status === 'nao_encontrada') {
    corpo = <><h1>Reserva não encontrada</h1><p className="muted centro">Confira o link ou fale com a recepção.</p><div className="acoes centro"><button className="btn" onClick={onNovo}>Fazer uma reserva</button>{ajuda}</div></>;
  } else {
    corpo = <><h1>{p.status === 'pago_sem_vaga' ? 'Seu pagamento precisa de atendimento' : p.status === 'recusado' ? 'Esse horário ficou indisponível' : 'Não foi possível gerar o pagamento'}</h1>{info}
      <p className="muted centro">{p.erro || (p.status === 'pago_sem_vaga' ? 'A disponibilidade mudou antes da confirmação. A recepção resolve com você: troca de horário ou reembolso.' : 'Escolha outro horário para continuar.')}</p>
      {p.codigo && <p className="muted centro pequeno">Referência do pedido: {p.codigo}</p>}<div className="acoes centro">{ajuda}<button className="btn sec" onClick={onNovo}>Fazer outra reserva</button></div></>;
  }
  return (
    <div className="pagina estreita">
      <div className="cartao pedido" aria-live="polite">{corpo}{falhas >= 3 && !FINAIS.has(p.status) && <p className="msg-erro geral">Atualização interrompida. Confira a conexão: a página tenta de novo sozinha.</p>}</div>
      <p className="dica-mini centro">Você pode voltar a esta página pelo mesmo link.</p>
    </div>
  );
}

// ------------------------------------------------------------------ minhas reservas
const ROTULO: Record<string, [string, string]> = {
  confirmado: ['ok', 'Confirmada'], pago: ['pend', 'Pagamento recebido'], aguardando_pagamento: ['pend', 'Aguardando pagamento'], novo: ['pend', 'Em processamento'],
  expirado: ['neutro', 'Prazo de pagamento encerrado'], recusado: ['neutro', 'Não confirmada'], pago_sem_vaga: ['erro', 'Precisa de atendimento'], erro_pagamento: ['erro', 'Erro no pagamento'],
};
/** Política (src/config/politica-cancelamento.ts): 48 h antes ou mais = reembolso de 95% e remarcação sem custo; menos de 48 h = sem reembolso. */
function regraDaPolitica(inicio: Date, valor: number | null) {
  const horas = (inicio.getTime() - Date.now()) / 3600e3;
  if (horas <= 0) return { passou: true, noPrazo: false, texto: 'Bateria já realizada.' };
  if (horas >= 48) return { passou: false, noPrazo: true, texto: `Dentro do prazo: cancelando agora, o reembolso é de ${valor ? reais(Math.round(valor * 0.95)) : '95% do valor pago'} (5% de taxa administrativa). Remarcar não tem custo.` };
  return { passou: false, noPrazo: false, texto: 'Faltam menos de 48 horas: pela política não há reembolso. A recepção pode avaliar um voucher para outra data em casos excepcionais.' };
}

function MinhasReservas({ onVoltar, onAbrir }: { onVoltar: () => void; onAbrir: (id: string) => void }) {
  const [cpf, setCpf] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [res, setRes] = useState<{ nome: string; reservas: MinhaReserva[] } | null>(null);
  const buscar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro('');
    if (!cpfValido(cpf)) { setErro('Confira os 11 números do CPF de quem reservou.'); return; }
    if (!/^[A-Z0-9]{6}$/.test(codigo)) { setErro('O código da reserva tem 6 letras e números (está na confirmação e no WhatsApp).'); return; }
    setBuscando(true);
    try { setRes(await api.minhas(digitos(cpf), codigo)); } catch (x) { setErro((x as Error).message); } finally { setBuscando(false); }
  };
  const zapMsg = (rv: MinhaReserva, acao: 'cancelar' | 'remarcar', regra: string) =>
    `https://wa.me/${WHATS}?text=${encodeURIComponent(`Olá! Quero ${acao} a reserva ${rv.codigo}${rv.inicio ? ` (${diaLongo(deIso(rv.inicio))}, ${hora(deIso(rv.inicio))})` : ''}, no CPF de quem reservou. ${acao === 'cancelar' ? regra : 'Quais horários estão livres?'}`)}`;
  return (
    <div className="pagina estreita">
      <div className="cabeca"><div><p className="sobre">Kartódromo de Betim · Reserva online</p><h1 tabIndex={-1}>Minhas reservas</h1><p className="sub">Veja suas reservas, pague o que ficou pendente e peça remarcação ou cancelamento.</p></div></div>
      {!res ? (
        <form className="cartao principal" onSubmit={buscar} noValidate>
          <div className="form-grade">
            <Campo id="m-cpf" rotulo="CPF de quem reservou" valor={cpf} onChange={(v) => setCpf(mascaraCpf(v))} modo="numeric" auto="off" />
            <Campo id="m-cod" rotulo="Código de uma reserva" valor={codigo} onChange={(v) => setCodigo(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} auto="off" dica="Está na tela de confirmação e na mensagem do WhatsApp." />
          </div>
          {erro && <p className="msg-erro geral" role="alert">{erro}</p>}
          <div className="acoes"><button type="button" className="btn sec" onClick={onVoltar}>Voltar</button><button className="btn" disabled={buscando} aria-busy={buscando}>{buscando ? 'Buscando…' : 'Ver minhas reservas'}</button></div>
        </form>
      ) : (
        <>
          <p className="muted">Olá, {res.nome}! {res.reservas.length === 1 ? 'Esta é a sua reserva online.' : `Estas são as suas ${res.reservas.length} reservas online.`}</p>
          <ul className="minhas">
            {res.reservas.map((rv) => {
              const dt = rv.inicio ? deIso(rv.inicio) : null;
              const [tom, rot] = ROTULO[rv.status] ?? ['neutro', rv.status];
              const regra = dt && (rv.status === 'confirmado' || rv.status === 'pago') ? regraDaPolitica(dt, rv.valorCentavos) : null;
              return (
                <li key={rv.id} className="cartao minha">
                  <div className="minha-topo"><div><strong>{dt ? `${diaLongo(dt)} · ${hora(dt)}` : 'Data a confirmar'}</strong><span className="muted pequeno">Reserva {rv.codigo} · {rv.quantidade} {rv.quantidade === 1 ? 'piloto' : 'pilotos'}{rv.valorCentavos ? ` · ${reais(rv.valorCentavos)}` : ''}</span></div><span className={`selo-st ${tom}`}>{rot}</span></div>
                  {regra && !regra.passou && <p className="dica-mini">{regra.texto}</p>}
                  <div className="acoes esq">
                    <button className="btn sec" onClick={() => onAbrir(rv.id)}>{rv.status === 'aguardando_pagamento' ? 'Pagar agora' : 'Ver detalhes'}</button>
                    {regra && !regra.passou && <a className="btn sec" href={zapMsg(rv, 'remarcar', regra.texto)} target="_blank" rel="noopener">{regra.noPrazo ? 'Remarcar' : 'Falar sobre remarcar'}</a>}
                    {regra && !regra.passou && <a className="lnk" href={zapMsg(rv, 'cancelar', regra.texto)} target="_blank" rel="noopener">Pedir cancelamento</a>}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="dica-mini">Cancelamentos e remarcações são confirmados pela recepção no WhatsApp, como prevê a política. Reservas feitas no balcão ou por grupo não aparecem aqui.</p>
          <div className="acoes"><button className="btn sec" onClick={() => setRes(null)}>Buscar outro CPF</button><button className="btn" onClick={onVoltar}>Fazer uma reserva</button></div>
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
