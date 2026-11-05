/**
 * Endurance (100 Milhas): evento, equipes, pilotos com número de pulseira, pesagem, filas e sorteio do box, punições.
 *
 * Rotas da recepção/painel web em /api/office/endurance/... (login da Recepção) e a página pública do chefe de equipe em
 * /api/publico/endurance/<token> (link assinado por equipe). As voltas e as paradas vêm da corrida da cronometragem
 * (ORBITS :4050); as regras do regulamento estão em endurance-regras.ts.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { one, query, tx } from './db';
import { HttpError } from './office';
import { validarFamiliaEquipes } from './endurance-familia';
import type { Sessao } from './auth';
import {
  analisarCorrida, avaliarPeso, desempenhoDosKarts, lastroNecessario, lerRegras, sortearFileira,
  type AjusteIn, type Analise, type PunicaoIn, type Regras, type SessaoIn, type TrocaIn, type VoltaCrono,
} from './endurance-regras';

type Req = { method: string; url: URL; body: () => Promise<Record<string, unknown>>; sessao: Sessao };
type Res = (status: number, body: unknown) => void;

const TIMING_URL = (process.env.OPS_TIMING_URL || 'http://192.168.20.249:4050').replace(/\/$/, '');

type Evento = { id: number; nome: string; data: string | null; bateriaId: number | null; sessaoCrono: string | null; sessaoTomada: string | null; regras: string | null; segredo: string; ativo: boolean };
type Equipe = { id: number; eventoId: number; nome: string; numero: string; transponder: string | null; chefeNome: string | null; chefeTelefone: string | null; pago: boolean; desclassificada: boolean; obs: string | null };
type Piloto = { id: number; eventoId: number; equipeId: number; clienteId: number | null; nome: string; pulseira: number; pesoKg: number | null; lastroKg: number | null; chefe: boolean; origem: string; ativo: boolean; pesoCadastro: number | null; documento: string | null; telefone: string | null };

const EVENTO_COLS = `Id id, Nome nome, CONVERT(varchar(10), Data, 126) data, BateriaId bateriaId, SessaoCrono sessaoCrono, SessaoTomada sessaoTomada, Regras regras, Segredo segredo, Ativo ativo`;
const EQUIPE_COLS = `Id id, EventoId eventoId, Nome nome, Numero numero, Transponder transponder, ChefeNome chefeNome, ChefeTelefone chefeTelefone, Pago pago, Desclassificada desclassificada, Obs obs`;
const PILOTO_SQL = `SELECT p.Id id, p.EventoId eventoId, p.EquipeId equipeId, p.ClienteId clienteId, p.Nome nome, p.Pulseira pulseira, CAST(p.PesoKg AS float) pesoKg,
  CAST(p.LastroKg AS float) lastroKg, p.Chefe chefe, p.Origem origem, p.Ativo ativo, CAST(c.Peso AS float) pesoCadastro, c.Documento documento, c.Telefone telefone
  FROM dbo.EndurancePilotoInscricao p LEFT JOIN dbo.Cliente c ON c.Id = p.ClienteId`;

const txt = (v: unknown, max = 120) => (v == null ? '' : String(v).trim().slice(0, max));
const num = (v: unknown) => { const s = String(v ?? '').trim().replace(',', '.'); if (!s) return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
const idDe = (v: unknown, nome: string) => { const n = Number(v); if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${nome} inválido.`); return n; };

// ------------------------------------------------------------------ leitura

async function evento(id: number): Promise<Evento> {
  const e = await one<Evento>(`SELECT ${EVENTO_COLS} FROM dbo.EnduranceEvento WHERE Id = @id`, { id });
  if (!e) throw new HttpError(404, 'Evento não encontrado.');
  return e;
}
const equipesDo = (eventoId: number) => query<Equipe>(`SELECT ${EQUIPE_COLS} FROM dbo.EnduranceEquipe WHERE EventoId = @e ORDER BY TRY_CONVERT(int, Numero), Numero`, { e: eventoId });
const pilotosDo = (eventoId: number) => query<Piloto>(`${PILOTO_SQL} WHERE p.EventoId = @e AND p.Ativo = 1 ORDER BY p.Pulseira`, { e: eventoId });

export function tokenEquipe(ev: Pick<Evento, 'segredo'>, equipeId: number) {
  return `${equipeId}.${createHmac('sha256', ev.segredo).update(`equipe:${equipeId}`).digest('base64url').slice(0, 16)}`;
}

async function filasDo(eventoId: number) {
  return query<{ kart: string; fileira: number | null; ordem: number | null; situacao: string; equipeId: number | null; obs: string | null }>(
    `SELECT Kart kart, Fileira fileira, Ordem ordem, Situacao situacao, EquipeId equipeId, Obs obs FROM dbo.EnduranceFila WHERE EventoId = @e ORDER BY Fileira, Ordem, Kart`, { e: eventoId });
}
async function trocasDo(eventoId: number) {
  return query<{ id: number; equipeId: number; pilotoId: number | null; piloto: string | null; pulseira: number | null; kart: string | null; kartDevolvido: string | null; fileira: number | null; tipo: string; usuario: string | null; obs: string | null; em: string; emMs: number }>(
    `SELECT t.Id id, t.EquipeId equipeId, t.PilotoId pilotoId, p.Nome piloto, p.Pulseira pulseira, t.Kart kart, t.KartDevolvido kartDevolvido, t.Fileira fileira, t.Tipo tipo,
       t.Usuario usuario, t.Obs obs, CONVERT(varchar(19), t.Em, 126) em, t.EmMs emMs
     FROM dbo.EnduranceTroca t LEFT JOIN dbo.EndurancePiloto p ON p.Id = t.PilotoId WHERE t.EventoId = @e AND t.Cancelada = 0 ORDER BY t.EmMs, t.Id`, { e: eventoId });
}
async function pesagensDo(eventoId: number) {
  return query<{ id: number; pilotoId: number; momento: string; balancaKg: number; lastroKg: number | null; totalKg: number; resultado: string; punicaoSeg: number; usuario: string | null; obs: string | null; em: string }>(
    `SELECT Id id, PilotoId pilotoId, Momento momento, CAST(BalancaKg AS float) balancaKg, CAST(LastroKg AS float) lastroKg, CAST(TotalKg AS float) totalKg, Resultado resultado,
       PunicaoSeg punicaoSeg, Usuario usuario, Obs obs, CONVERT(varchar(19), Em, 126) em FROM dbo.EndurancePesagem WHERE EventoId = @e ORDER BY Id DESC`, { e: eventoId });
}
async function punicoesDo(eventoId: number) {
  return query<{ id: number; equipeId: number; tipo: PunicaoIn['tipo']; valor: number; motivo: string; origem: string; usuario: string | null; em: string }>(
    `SELECT Id id, EquipeId equipeId, Tipo tipo, Valor valor, Motivo motivo, Origem origem, Usuario usuario, CONVERT(varchar(19), Em, 126) em
     FROM dbo.EndurancePunicao WHERE EventoId = @e AND Cancelada = 0 ORDER BY Id`, { e: eventoId });
}
const ajustesDo = (eventoId: number) => query<AjusteIn>(`SELECT EquipeId equipeId, Volta volta, Acao acao FROM dbo.EnduranceParadaAjuste WHERE EventoId = @e`, { e: eventoId });

// ------------------------------------------------------------------ cronometragem

const cacheCrono = new Map<string, { em: number; dados: Promise<{ sessao: SessaoIn & { competitors?: { kart: string }[] } | null; voltas: Map<string, VoltaCrono[]> }> }>();

async function dadosDaCrono(sessaoId: string | null) {
  if (!sessaoId) return { sessao: null, voltas: new Map<string, VoltaCrono[]>() };
  const c = cacheCrono.get(sessaoId);
  if (c && Date.now() - c.em < 2_000) return c.dados;
  const dados = (async () => {
    const pegar = async (caminho: string) => {
      const r = await fetch(`${TIMING_URL}/api/sessions/${encodeURIComponent(sessaoId)}${caminho}`, { signal: AbortSignal.timeout(6_000) });
      if (!r.ok) throw new HttpError(r.status === 404 ? 404 : 502, r.status === 404 ? 'A corrida ligada a este evento não existe mais na cronometragem.' : 'A cronometragem não respondeu.');
      return r.json();
    };
    const [s, laps] = await Promise.all([pegar(''), pegar('/laps')]) as [SessaoIn & { competitors?: { kart: string; name?: string }[] }, { kart: string; name?: string; laps: VoltaCrono[] }[]];
    const voltas = new Map<string, VoltaCrono[]>();
    for (const l of laps) {
      if (l.kart) voltas.set(String(l.kart), l.laps);
      const nome = String(l.name ?? '').trim().toLowerCase();
      if (nome) voltas.set(`nome:${nome}`, l.laps);
    }
    return { sessao: s, voltas };
  })();
  cacheCrono.set(sessaoId, { em: Date.now(), dados });
  dados.catch(() => cacheCrono.delete(sessaoId));
  return dados;
}

async function sincronizarKartsComCrono(ev: Evento) {
  try {
    const [equipes, filas] = await Promise.all([
      equipesDo(ev.id),
      query<{ kart: string; equipeId: number }>(`SELECT Kart kart, EquipeId equipeId FROM dbo.EnduranceFila WHERE EventoId = @e AND Situacao = 'pista' AND EquipeId IS NOT NULL`, { e: ev.id }),
    ]);
    const kartPorEquipe = new Map(filas.map((f) => [f.equipeId, String(f.kart).trim()]));
    const ativas = equipes.filter((q) => !q.desclassificada);
    const mudancas = ativas.filter((q) => {
      const k = kartPorEquipe.get(q.id);
      return Boolean(k && q.numero !== k);
    });
    if (mudancas.length) {
      await tx(async (run) => {
        for (const q of mudancas) {
          const k = kartPorEquipe.get(q.id)!;
          await run(`UPDATE dbo.EnduranceEquipe SET Numero = CONCAT('TMP_', Id) WHERE EventoId = @e AND (Id = @id OR Numero = @num)`, { e: ev.id, id: q.id, num: k });
        }
        for (const q of mudancas) {
          const k = kartPorEquipe.get(q.id)!;
          await run(`UPDATE dbo.EnduranceEquipe SET Numero = @num WHERE EventoId = @e AND Id = @id`, { e: ev.id, id: q.id, num: k });
        }
        await run(`UPDATE dbo.EnduranceEquipe SET Numero = CONCAT('EQ', Id) WHERE EventoId = @e AND Numero LIKE 'TMP_%'`, { e: ev.id });
      });
    }
    const competitors = ativas.map((q) => ({ kart: kartPorEquipe.get(q.id) ?? (/^\d+$/.test(q.numero) ? q.numero : ''), name: q.nome }));
    for (const sid of [ev.sessaoTomada, ev.sessaoCrono].filter((x): x is string => Boolean(x))) {
      cacheCrono.delete(sid);
      await fetch(`${TIMING_URL}/api/sessions/${encodeURIComponent(sid)}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(5_000),
        body: JSON.stringify({ competitors, semEmailPilotos: false }),
      }).catch(() => null);
    }
  } catch { /* sincronização auxiliar não bloqueia a operação do box */ }
}

async function analise(ev: Evento): Promise<{ analise: Analise; regras: Regras; erroCrono: string | null }> {
  const regras = lerRegras(ev.regras);
  const [equipes, trocas, punicoes, ajustes, filas] = await Promise.all([equipesDo(ev.id), trocasDo(ev.id), punicoesDo(ev.id), ajustesDo(ev.id), filasDo(ev.id)]);
  let crono: Awaited<ReturnType<typeof dadosDaCrono>> = { sessao: null, voltas: new Map() };
  let erroCrono: string | null = null;
  try {
    crono = await dadosDaCrono(ev.sessaoCrono || ev.sessaoTomada);
    if (ev.sessaoCrono && ev.sessaoTomada && crono.sessao?.state === 'preparando') {
      const tomada = await dadosDaCrono(ev.sessaoTomada).catch(() => null);
      if (tomada?.sessao && tomada.sessao.state !== 'preparando') crono = tomada;
    }
  } catch (e) { erroCrono = (e as Error).message; }
  const kartNaPista = new Map(filas.filter((f) => f.situacao === 'pista' && f.equipeId != null).map((f) => [f.equipeId!, String(f.kart).trim()]));
  const voltasResolvidas = new Map<string, VoltaCrono[]>(crono.voltas);
  for (const e of equipes) {
    const kPista = kartNaPista.get(e.id);
    const vs = crono.voltas.get(e.numero)
      ?? (kPista ? crono.voltas.get(kPista) : undefined)
      ?? crono.voltas.get(`nome:${e.nome.trim().toLowerCase()}`);
    if (vs) voltasResolvidas.set(e.numero, vs);
  }
  const a = analisarCorrida({
    regras, sessao: crono.sessao, agoraMs: Date.now(), voltas: voltasResolvidas, ajustes,
    equipes: equipes.map((e) => ({ id: e.id, numero: kartNaPista.get(e.id) || e.numero, nome: e.nome, desclassificada: e.desclassificada })),
    trocas: trocas.map((t): TrocaIn => ({ equipeId: t.equipeId, pilotoId: t.pilotoId, pilotoNome: t.piloto, kart: t.kart, tipo: t.tipo, emMs: Number(t.emMs) })),
    punicoes: punicoes.map((p) => ({ equipeId: p.equipeId, tipo: p.tipo, valor: p.valor, motivo: p.motivo, origem: p.origem })),
  });
  return { analise: a, regras, erroCrono };
}

/** Estatística por piloto (voltas, média, melhor, tempo em pista), juntando os stints de cada um. */
function porPiloto(a: Analise) {
  const m = new Map<string, { equipeId: number; piloto: string; stints: number; voltas: number; somaMedia: number; voltasMedia: number; melhorMs: number | null; tempoMs: number }>();
  for (const e of a.equipes) for (const s of e.stints) {
    const chave = `${e.id}|${s.pilotoId ?? s.piloto ?? '?'}`;
    const x = m.get(chave) ?? { equipeId: e.id, piloto: s.piloto ?? 'Sem piloto registrado', stints: 0, voltas: 0, somaMedia: 0, voltasMedia: 0, melhorMs: null, tempoMs: 0 };
    x.stints++; x.voltas += s.voltas; x.tempoMs += s.tempoMs;
    if (s.mediaMs != null) { x.somaMedia += s.mediaMs * s.voltas; x.voltasMedia += s.voltas; }
    if (s.melhorMs != null && (x.melhorMs == null || s.melhorMs < x.melhorMs)) x.melhorMs = s.melhorMs;
    m.set(chave, x);
  }
  return [...m.values()].map((x) => ({ equipeId: x.equipeId, piloto: x.piloto, stints: x.stints, voltas: x.voltas, mediaMs: x.voltasMedia ? x.somaMedia / x.voltasMedia : null, melhorMs: x.melhorMs, tempoMs: x.tempoMs }));
}

// ------------------------------------------------------------------ pilotos e pulseiras

async function vincular(ev: Evento, equipeId: number, dados: { clienteId?: number | null; nome: string; origem: string; chefe?: boolean }) {
  return (await vincularInscricoes(ev, [equipeId], [dados]))[0];
}

async function vincularInscricoes(ev: Evento, selecao: number[], dados: { clienteId?: number | null; nome: string; origem: string; chefe?: boolean }[]) {
  const regras = lerRegras(ev.regras);
  const ids = [...new Set(selecao.map(id => idDe(id, 'Inscrição')))];
  if (!ids.length || ids.length > 7) throw new HttpError(400, 'Selecione de uma a sete inscrições da mesma família.');
  return tx(async (run) => {
    // Serializa pulseiras e vagas por evento; uma falha desfaz toda a seleção.
    await run('SELECT Id FROM dbo.EnduranceEvento WITH(UPDLOCK,HOLDLOCK) WHERE Id=@e', {e:ev.id});
    const equipes = await run(`SELECT Id id,Nome nome,Numero numero,GrupoId grupoId FROM dbo.EnduranceEquipe WITH(UPDLOCK,HOLDLOCK) WHERE EventoId=@e AND Desclassificada=0 AND Id IN (${ids.join(',')})`, {e:ev.id}) as {id:number;nome:string;numero:string;grupoId:number|null}[];
    if(equipes.length !== ids.length) throw new HttpError(404,'Inscrição não encontrada ou indisponível neste evento.');
    const validar=(qs:typeof equipes)=>{try{validarFamiliaEquipes(qs);}catch(err){throw new HttpError(409,(err as Error).message);}};
    validar(equipes);
    const saida: {pilotoId:number;pulseira:number;equipe:string;numero:string;novo:boolean;equipes:{id:number;nome:string}[]}[]=[];
    for(const d of dados){
      let p=d.clienteId ? (await run('SELECT Id id,EquipeId equipeId,Pulseira pulseira FROM dbo.EndurancePiloto WITH(UPDLOCK,HOLDLOCK) WHERE EventoId=@e AND ClienteId=@c AND Ativo=1',{e:ev.id,c:d.clienteId}))[0] as {id:number;equipeId:number;pulseira:number}|undefined : undefined;
      const novo=!p;
      if(p){
        const anteriores=await run('SELECT q.Id id,q.Nome nome,q.Numero numero,q.GrupoId grupoId FROM dbo.EndurancePilotoInscricao p JOIN dbo.EnduranceEquipe q ON q.Id=p.EquipeId WHERE p.Id=@id',{id:p.id}) as typeof equipes;
        validar([...anteriores,...equipes]);
      }
      for(const q of equipes){
        const ja=p && (await run('SELECT Id FROM dbo.EndurancePilotoInscricao WHERE Id=@id AND EquipeId=@q',{id:p.id,q:q.id})).length>0;
        const n=(await run('SELECT COUNT(*) n FROM dbo.EndurancePilotoInscricao WHERE EquipeId=@q AND Ativo=1',{q:q.id}))[0] as {n:number};
        if(!ja && n.n>=regras.pilotosMax) throw new HttpError(409,`A inscrição ${q.nome} já tem ${regras.pilotosMax} pilotos. Escolha outra inscrição da mesma família.`);
        if(!p){
          const prox=(await run('SELECT ISNULL(MAX(Pulseira),0)+1 n FROM dbo.EndurancePiloto WITH(UPDLOCK,HOLDLOCK) WHERE EventoId=@e',{e:ev.id}))[0] as {n:number};
          const ins=(await run('INSERT dbo.EndurancePiloto(EventoId,EquipeId,ClienteId,Nome,Pulseira,Chefe,Origem) OUTPUT INSERTED.Id id VALUES(@e,@q,@c,@nome,@p,@chefe,@o)',{e:ev.id,q:q.id,c:d.clienteId??null,nome:d.nome.slice(0,120),p:prox.n,chefe:d.chefe?1:0,o:d.origem}))[0] as {id:number};
          p={id:ins.id,equipeId:q.id,pulseira:prox.n};
        }else if(!ja){
          await run('INSERT dbo.EndurancePilotoEquipe(PilotoId,EquipeId) VALUES(@p,@q)',{p:p.id,q:q.id});
        }
      }
      const vinculadas=await run('SELECT q.Id id,q.Nome nome FROM dbo.EndurancePilotoInscricao p JOIN dbo.EnduranceEquipe q ON q.Id=p.EquipeId WHERE p.Id=@p ORDER BY q.Nome',{p:p!.id}) as {id:number;nome:string}[];
      saida.push({pilotoId:p!.id,pulseira:p!.pulseira,equipe:vinculadas.map(q=>q.nome).join(' / '),numero:equipes[0].numero,novo,equipes:vinculadas});
    }
    return saida;
  });
}

async function pilotoPorPulseira(eventoId: number, pulseira: number, equipeId?: number, exigirEquipe=false) {
  const pilotos = await query<Piloto>(`${PILOTO_SQL} WHERE p.EventoId = @e AND p.Pulseira = @n AND p.Ativo = 1`, { e: eventoId, n: pulseira });
  if(!equipeId && exigirEquipe && pilotos.length>1) throw new HttpError(409,'Este piloto corre em várias inscrições. Escolha a inscrição da equipe para esta operação.');
  const p = equipeId ? pilotos.find(p=>p.equipeId===equipeId) : pilotos[0];
  if (!p) throw new HttpError(404, `Nenhum piloto com a pulseira ${pulseira} neste evento.`);
  return p;
}

// ------------------------------------------------------------------ totem

/** Eventos de endurance ligados às baterias que o totem mostra (o piloto escolhe a equipe depois de escolher a bateria). */
export async function enduranceDasBaterias(bateriaIds: number[]) {
  if (!bateriaIds.length) return new Map<number, { eventoId: number; nome: string }>();
  const lista = bateriaIds.filter((b) => Number.isInteger(b)).join(',') || '0';
  const rows = await query<{ bateriaId: number; eventoId: number; nome: string }>(`SELECT BateriaId bateriaId, Id eventoId, Nome nome FROM dbo.EnduranceEvento WHERE Ativo = 1 AND BateriaId IN (${lista})`).catch(() => []);
  return new Map(rows.map((r) => [r.bateriaId, { eventoId: r.eventoId, nome: r.nome }]));
}

export async function equipesParaOTotem(bateriaId: number) {
  const ev = await one<Evento>(`SELECT TOP 1 ${EVENTO_COLS} FROM dbo.EnduranceEvento WHERE Ativo = 1 AND BateriaId = @b ORDER BY Id DESC`, { b: bateriaId });
  if (!ev) return null;
  const regras = lerRegras(ev.regras);
  const equipes = await query<{ id: number; nome: string; numero: string; pilotos: number }>(
    `SELECT q.Id id, q.Nome nome, q.Numero numero, q.GrupoId grupoId, (SELECT COUNT(*) FROM dbo.EndurancePilotoInscricao p WHERE p.EquipeId = q.Id AND p.Ativo = 1) pilotos
     FROM dbo.EnduranceEquipe q WHERE q.EventoId = @e AND q.Desclassificada = 0 ORDER BY q.Nome`, { e: ev.id });
  return { eventoId: ev.id, nome: ev.nome, maxPilotos: regras.pilotosMax, equipes: equipes.map((q) => ({ ...q, vagas: Math.max(0, regras.pilotosMax - q.pilotos) })) };
}

/** Chamado pelo /api/totem/inscrever quando a bateria é de endurance: liga cada participante à equipe e dá a pulseira. */
export async function vincularNoTotem(eventoId: number, equipeId: number | number[], clienteIds: number[]) {
  const ev = await evento(eventoId);
  const dados: { clienteId: number; nome: string; origem: 'totem' }[] = [];
  for (const cid of [...new Set(clienteIds.map(id=>idDe(id,'Piloto')))]) {
    const c = await one<{ nome: string }>(`SELECT Nome nome FROM dbo.Cliente WHERE Id = @id`, { id: cid });
    if(!c) throw new HttpError(404,'Piloto não encontrado.');
    dados.push({clienteId:cid,nome:c.nome,origem:'totem'});
  }
  const vinculados=await vincularInscricoes(ev,Array.isArray(equipeId)?equipeId:[equipeId],dados);
  return vinculados.map((v,i)=>({...v,clienteId:dados[i].clienteId,nome:dados[i].nome}));
}

// ------------------------------------------------------------------ página do chefe de equipe (pública, link assinado)

export async function paginaDoChefe(token: string) {
  const m = token.match(/^(\d{1,9})\.([\w-]{16})$/);
  if (!m) throw new HttpError(404, 'Link inválido.');
  const eq = await one<Equipe>(`SELECT ${EQUIPE_COLS} FROM dbo.EnduranceEquipe WHERE Id = @id`, { id: Number(m[1]) });
  if (!eq) throw new HttpError(404, 'Link inválido.');
  const ev = await evento(eq.eventoId);
  const esperado = Buffer.from(tokenEquipe(ev, eq.id)), recebido = Buffer.from(token);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) throw new HttpError(404, 'Link inválido.');
  const { analise: a, regras, erroCrono } = await analise(ev);
  const pilotos = (await pilotosDo(ev.id)).filter((p) => p.equipeId === eq.id);
  const pesagens = (await pesagensDo(ev.id)).filter((x) => pilotos.some((p) => p.id === x.pilotoId));
  const punicoes = (await punicoesDo(ev.id)).filter((p) => p.equipeId === eq.id);
  return {
    evento: { id: ev.id, nome: ev.nome, data: ev.data }, regras, erroCrono,
    equipe: { id: eq.id, nome: eq.nome, numero: eq.numero, chefeNome: eq.chefeNome },
    pilotos: pilotos.map((p) => ({ nome: p.nome, pulseira: p.pulseira, pesoKg: p.pesoKg, lastroKg: p.lastroKg, chefe: p.chefe, lastroSugerido: p.pesoKg != null ? lastroNecessario(p.pesoKg, regras).lastroKg : null })),
    pesagens: pesagens.map((x) => ({ ...x, piloto: pilotos.find((p) => p.id === x.pilotoId)?.nome ?? '' })),
    punicoes: punicoes.map(({ usuario: _u, ...p }) => p),
    analise: a,
    porPiloto: porPiloto(a).filter((x) => x.equipeId === eq.id),
  };
}

// ------------------------------------------------------------------ rotas do painel

export async function enduranceRoutes(req: Req, send: Res): Promise<boolean> {
  const { method, url, sessao } = req;
  const path = url.pathname.replace(/^\/api\/office/, '');
  if (!path.startsWith('/endurance')) return false;
  let m: RegExpMatchArray | null;
  const quem = sessao.nome.slice(0, 60);

  if (path === '/endurance/eventos' && method === 'GET') {
    send(200, await query(`SELECT ${EVENTO_COLS}, (SELECT COUNT(*) FROM dbo.EnduranceEquipe q WHERE q.EventoId = e.Id) equipes,
      (SELECT COUNT(*) FROM dbo.EndurancePiloto p WHERE p.EventoId = e.Id AND p.Ativo = 1) pilotos FROM dbo.EnduranceEvento e ORDER BY Ativo DESC, Data DESC, Id DESC`)
      .then((l) => l.map(({ segredo: _s, ...x }) => ({ ...x, regras: lerRegras(x.regras as string) }))));
    return true;
  }
  if (path === '/endurance/eventos' && method === 'POST') {
    const b = await req.body();
    const nome = txt(b.nome);
    if (!nome) throw new HttpError(400, 'Informe o nome do evento.');
    const r = await one<{ id: number }>(
      `INSERT INTO dbo.EnduranceEvento (Nome, Data, BateriaId, SessaoCrono, Regras, Segredo) OUTPUT INSERTED.Id id VALUES (@nome, @data, @bat, @crono, @regras, @seg)`,
      { nome, data: txt(b.data, 10) || null, bat: b.bateriaId ? Number(b.bateriaId) : null, crono: txt(b.sessaoCrono, 80) || null, regras: JSON.stringify(lerRegras(JSON.stringify(b.regras ?? {}))), seg: randomBytes(18).toString('base64url') },
    );
    send(201, { id: r!.id });
    return true;
  }

  if (!(m = path.match(/^\/endurance\/eventos\/(\d+)(\/.*)?$/))) return false;
  const ev = await evento(Number(m[1]));
  const resto = m[2] ?? '';
  const regras = lerRegras(ev.regras);

  if (!resto && method === 'GET') {
    const [equipes, pilotos, filas, trocas, pesagens, punicoes, ajustes] = await Promise.all([equipesDo(ev.id), pilotosDo(ev.id), filasDo(ev.id), trocasDo(ev.id), pesagensDo(ev.id), punicoesDo(ev.id), ajustesDo(ev.id)]);
    const { segredo: _s, ...semSegredo } = ev;
    send(200, {
      evento: { ...semSegredo, regras }, filas, trocas, pesagens, punicoes, ajustes,
      equipes: equipes.map((q) => ({ ...q, token: tokenEquipe(ev, q.id), pilotos: pilotos.filter((p) => p.equipeId === q.id) })),
    });
    return true;
  }
  if (!resto && method === 'PUT') {
    const b = await req.body();
    await query(`UPDATE dbo.EnduranceEvento SET Nome = COALESCE(@nome, Nome), Data = @data, BateriaId = @bat, SessaoCrono = @crono, SessaoTomada = @tomada, Regras = @regras, Ativo = @ativo WHERE Id = @id`, {
      id: ev.id, nome: txt(b.nome) || null, data: b.data !== undefined ? (txt(b.data, 10) || null) : ev.data, bat: b.bateriaId !== undefined ? (b.bateriaId ? Number(b.bateriaId) : null) : ev.bateriaId,
      crono: b.sessaoCrono !== undefined ? (txt(b.sessaoCrono, 80) || null) : ev.sessaoCrono, tomada: b.sessaoTomada !== undefined ? (txt(b.sessaoTomada, 80) || null) : ev.sessaoTomada,
      regras: b.regras ? JSON.stringify(lerRegras(JSON.stringify({ ...regras, ...(b.regras as object) }))) : ev.regras, ativo: b.ativo === undefined ? (ev.ativo ? 1 : 0) : (b.ativo ? 1 : 0),
    });
    send(200, { ok: true });
    return true;
  }

  // ---- análise ao vivo (estratégia, radar, projeção, estatísticas)
  if (resto === '/analise' && method === 'GET') {
    const { analise: a, erroCrono } = await analise(ev);
    send(200, { analise: a, regras, erroCrono, karts: desempenhoDosKarts(a), porPiloto: porPiloto(a) });
    return true;
  }
  if (resto === '/volta-a-volta' && method === 'GET') {
    const equipes = await equipesDo(ev.id);
    const crono = await dadosDaCrono(ev.sessaoCrono);
    const linhas = ['Equipe;Numero;Volta;Tempo (ms);Tempo;Hora'];
    for (const q of equipes) (crono.voltas.get(q.numero) ?? []).filter((v) => v.lapMs).sort((a, b) => a.wallMs - b.wallMs).forEach((v, i) => {
      const ms = v.lapMs as number;
      linhas.push([q.nome.replace(/;/g, ','), q.numero, i + 1, ms, `${Math.floor(ms / 60000)}:${String(Math.floor(ms % 60000 / 1000)).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`,
        new Date(v.wallMs).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })].join(';'));
    });
    send(200, { nome: `${ev.nome} - volta a volta.csv`, csv: linhas.join('\r\n') });
    return true;
  }

  // ---- cronometragem
  if (resto === '/sessoes-crono' && method === 'GET') {
    const r = await fetch(`${TIMING_URL}/api/sessions`, { signal: AbortSignal.timeout(6_000) }).catch(() => null);
    if (!r?.ok) throw new HttpError(502, 'A cronometragem não respondeu.');
    const lista = (await r.json()) as { id: string; name: string; type: string; state: string; createdAt: number }[];
    send(200, lista.slice(0, 80).map((s) => ({ id: s.id, nome: s.name, tipo: s.type, estado: s.state, criadaEm: s.createdAt })));
    return true;
  }
  if (resto === '/preparar-crono' && method === 'POST') {
    const b = await req.body();
    const sessaoId = txt(b.sessaoId, 80);
    if (!/^[\w-]+$/.test(sessaoId)) throw new HttpError(400, 'Escolha a corrida da cronometragem.');
    const equipes = (await equipesDo(ev.id)).filter((q) => !q.desclassificada);
    if (!equipes.length) throw new HttpError(400, 'Cadastre as equipes antes.');
    const avisos: string[] = [];
    if (b.transponders) {
      const mapa = await fetch(`${TIMING_URL}/api/transponders`, { signal: AbortSignal.timeout(6_000) }).then((r) => r.json() as Promise<Record<string, string>>);
      const conflitos = equipes.filter((q) => q.transponder && Object.entries(mapa).some(([raw, kart]) => kart === q.numero && raw !== q.transponder))
        .map((q) => `placa ${q.numero} já é o kart do transponder ${Object.entries(mapa).find(([raw, kart]) => kart === q.numero && raw !== q.transponder)![0]}`);
      if (conflitos.length && !b.forcar) return send(409, { error: 'Alguns números de placa já são de karts na cronometragem. Confirme para trocar.', conflitos }), true;
      for (const q of equipes.filter((x) => x.transponder)) {
        const r = await fetch(`${TIMING_URL}/api/transponders`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ raw: q.transponder, kart: q.numero }), signal: AbortSignal.timeout(6_000) });
        if (!r.ok) avisos.push(`transponder da placa ${q.numero} não foi gravado`);
      }
    }
    const r = await fetch(`${TIMING_URL}/api/sessions/${encodeURIComponent(sessaoId)}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({ competitors: equipes.map((q) => ({ kart: q.numero, name: q.nome })), semEmailPilotos: false, ...(b.tipo === 'corrida' ? { durationMin: regras.duracaoMin } : {}) }),
    });
    if (!r.ok) throw new HttpError(502, `A cronometragem recusou (${(await r.json().catch(() => ({}))).error ?? r.status}).`);
    await query(b.tipo === 'tomada' ? `UPDATE dbo.EnduranceEvento SET SessaoTomada = @s WHERE Id = @id` : `UPDATE dbo.EnduranceEvento SET SessaoCrono = @s WHERE Id = @id`, { s: sessaoId, id: ev.id });
    send(200, { ok: true, equipes: equipes.length, avisos });
    return true;
  }

  // ---- equipes
  if (resto === '/equipes' && method === 'POST') {
    const b = await req.body();
    const nome = txt(b.nome, 80), numero = txt(b.numero, 10);
    if (!nome || !numero) throw new HttpError(400, 'Informe o nome e o número da placa.');
    const r = await one<{ id: number }>(
      `INSERT INTO dbo.EnduranceEquipe (EventoId, Nome, Numero, Transponder, ChefeNome, ChefeTelefone, Pago, Obs) OUTPUT INSERTED.Id id VALUES (@e, @nome, @num, @tr, @cn, @ct, @pago, @obs)`,
      { e: ev.id, nome, num: numero, tr: txt(b.transponder, 12).replace(/\D/g, '') || null, cn: txt(b.chefeNome) || null, ct: txt(b.chefeTelefone, 20) || null, pago: b.pago ? 1 : 0, obs: txt(b.obs, 400) || null },
    ).catch((e) => { if (/UX_EnduranceEquipe_Numero|duplicate/i.test(String(e))) throw new HttpError(409, `Já existe equipe com a placa ${numero}.`); throw e; });
    send(201, { id: r!.id });
    return true;
  }
  if ((m = resto.match(/^\/equipes\/(\d+)$/))) {
    const id = Number(m[1]);
    if (method === 'PUT') {
      const b = await req.body();
      await query(`UPDATE dbo.EnduranceEquipe SET Nome = COALESCE(@nome, Nome), Numero = COALESCE(@num, Numero), Transponder = @tr, ChefeNome = @cn, ChefeTelefone = @ct, Pago = @pago,
        Desclassificada = @dq, Obs = @obs WHERE Id = @id AND EventoId = @e`, {
        id, e: ev.id, nome: txt(b.nome, 80) || null, num: txt(b.numero, 10) || null, tr: txt(b.transponder, 12).replace(/\D/g, '') || null, cn: txt(b.chefeNome) || null,
        ct: txt(b.chefeTelefone, 20) || null, pago: b.pago ? 1 : 0, dq: b.desclassificada ? 1 : 0, obs: txt(b.obs, 400) || null,
      });
      send(200, { ok: true });
      return true;
    }
    if (method === 'DELETE') {
      const usada = await one<{ n: number }>(`SELECT (SELECT COUNT(*) FROM dbo.EndurancePilotoInscricao WHERE EquipeId = @id AND Ativo = 1) + (SELECT COUNT(*) FROM dbo.EnduranceTroca WHERE EquipeId = @id) n`, { id });
      if (usada && usada.n > 0) throw new HttpError(409, 'A equipe tem pilotos ou trocas. Tire os pilotos antes (ou marque como desclassificada).');
      await query(`DELETE FROM dbo.EndurancePilotoEquipe WHERE EquipeId=@id OR PilotoId IN(SELECT Id FROM dbo.EndurancePiloto WHERE EquipeId=@id AND Ativo=0); DELETE FROM dbo.EndurancePiloto WHERE EquipeId = @id AND Ativo = 0; DELETE FROM dbo.EnduranceEquipe WHERE Id = @id AND EventoId = @e`, { id, e: ev.id });
      send(200, { ok: true });
      return true;
    }
  }

  // ---- pilotos
  if (resto === '/pilotos' && method === 'POST') {
    const b = await req.body();
    const equipeId = idDe(b.equipeId, 'Equipe');
    const clienteId = b.clienteId ? idDe(b.clienteId, 'Cliente') : null;
    let nome = txt(b.nome);
    if (clienteId && !nome) nome = (await one<{ nome: string }>(`SELECT Nome nome FROM dbo.Cliente WHERE Id = @id`, { id: clienteId }))?.nome ?? '';
    if (!nome) throw new HttpError(400, 'Informe o nome do piloto.');
    const v = await vincular(ev, equipeId, { clienteId, nome, origem: 'admin', chefe: Boolean(b.chefe) });
    send(201, v);
    return true;
  }
  if ((m = resto.match(/^\/pilotos\/(\d+)$/))) {
    const id = Number(m[1]);
    if (method === 'PUT') {
      const b = await req.body();
      if (b.equipeId) {
        const n = await one<{ n: number }>(`SELECT COUNT(*) n FROM dbo.EndurancePilotoInscricao WHERE EquipeId = @q AND Ativo = 1 AND Id <> @id`, { q: Number(b.equipeId), id });
        if (n && n.n >= regras.pilotosMax) throw new HttpError(409, `A equipe já tem ${regras.pilotosMax} pilotos.`);
        await query('DELETE FROM dbo.EndurancePilotoEquipe WHERE PilotoId=@id AND EXISTS(SELECT 1 FROM dbo.EndurancePiloto WHERE Id=@id AND EquipeId<>@q)',{id,q:Number(b.equipeId)});
      }
      await query(`UPDATE dbo.EndurancePiloto SET Nome = COALESCE(@nome, Nome), EquipeId = COALESCE(@q, EquipeId), Chefe = COALESCE(@chefe, Chefe),
        PesoKg = CASE WHEN @temPeso = 1 THEN @peso ELSE PesoKg END, LastroKg = CASE WHEN @temLastro = 1 THEN @lastro ELSE LastroKg END WHERE Id = @id AND EventoId = @e`, {
        id, e: ev.id, nome: txt(b.nome) || null, q: b.equipeId ? Number(b.equipeId) : null, chefe: b.chefe === undefined ? null : (b.chefe ? 1 : 0),
        temPeso: b.pesoKg === undefined ? 0 : 1, peso: num(b.pesoKg), temLastro: b.lastroKg === undefined ? 0 : 1, lastro: num(b.lastroKg),
      });
      send(200, { ok: true });
      return true;
    }
    if (method === 'DELETE') {
      // a pulseira não volta para ninguém (a pulseira física já pode estar no braço de alguém)
      await query(`UPDATE dbo.EndurancePiloto SET Ativo = 0, Pulseira = -Id WHERE Id = @id AND EventoId = @e`, { id, e: ev.id });
      send(200, { ok: true });
      return true;
    }
  }
  if (resto === '/importar' && method === 'POST') {
    // uma linha por piloto: número da placa ; nome da equipe ; nome do piloto ; CPF (opcional) ; chefe (opcional: "chefe" ou "sim")
    const b = await req.body();
    const linhas = String(b.texto ?? '').split(/\r?\n/).map((l) => l.split(/[;\t]/).map((x) => x.trim())).filter((c) => c.length >= 2 && c[0] && c[1]);
    if (!linhas.length) throw new HttpError(400, 'Cole as linhas no formato: placa ; equipe ; piloto ; CPF ; chefe');
    const resumo = { equipes: 0, pilotos: 0, erros: [] as string[] };
    for (const [numero, nomeEq, nomePil, cpf, chefe] of linhas) {
      if (/^(placa|numero|número|n[ºo°])$/i.test(numero)) continue;
      let eq = await one<{ id: number }>(`SELECT Id id FROM dbo.EnduranceEquipe WHERE EventoId = @e AND Numero = @n`, { e: ev.id, n: numero.slice(0, 10) });
      if (!eq) { eq = await one<{ id: number }>(`INSERT INTO dbo.EnduranceEquipe (EventoId, Nome, Numero, Pago) OUTPUT INSERTED.Id id VALUES (@e, @nome, @n, 1)`, { e: ev.id, nome: nomeEq.slice(0, 80), n: numero.slice(0, 10) }); resumo.equipes++; }
      if (!nomePil) continue;
      const digitos = String(cpf ?? '').replace(/\D/g, '');
      const cli = digitos.length >= 5 ? await one<{ id: number; nome: string }>(`SELECT TOP 1 Id id, Nome nome FROM dbo.Cliente WHERE DocumentoNum = @d ORDER BY CASE WHEN ResponsavelId IS NULL THEN 0 ELSE 1 END`, { d: digitos }) : null;
      try {
        const v = await vincular(ev, eq!.id, { clienteId: cli?.id ?? null, nome: cli?.nome ?? nomePil, origem: 'importado', chefe: /^(chefe|sim|s|x)$/i.test(chefe ?? '') });
        if (v.novo) resumo.pilotos++;
      } catch (e) { resumo.erros.push(`${nomePil}: ${(e as Error).message}`); }
    }
    send(200, resumo);
    return true;
  }

  // ---- pesagem
  if ((m = resto.match(/^\/pulseira\/(\d+)$/)) && method === 'GET') {
    const p = await pilotoPorPulseira(ev.id, Number(m[1]));
    const eq = await one<Equipe>(`SELECT ${EQUIPE_COLS} FROM dbo.EnduranceEquipe WHERE Id = @id`, { id: p.equipeId });
    const pesagens = (await pesagensDo(ev.id)).filter((x) => x.pilotoId === p.id);
    const companheiros = (await pilotosDo(ev.id)).filter((x) => x.equipeId === p.equipeId && x.id !== p.id).map((x) => ({ nome: x.nome, pulseira: x.pulseira }));
    const equipes=await query<Equipe>(`SELECT q.Id id,q.Nome nome,q.Numero numero FROM dbo.EnduranceEquipe q JOIN dbo.EndurancePilotoInscricao v ON v.EquipeId=q.Id WHERE v.Id=@p AND v.Ativo=1 ORDER BY q.Nome`,{p:p.id});
    send(200, { piloto: p, equipe: eq, equipes, pesagens, companheiros, regras, lastroSugerido: p.pesoKg != null ? lastroNecessario(p.pesoKg, regras) : null });
    return true;
  }
  if (resto === '/pesagens' && method === 'POST') {
    const b = await req.body();
    const momento = ['inicial', 'parada', 'final'].includes(String(b.momento)) ? String(b.momento) : 'parada';
    const p = await pilotoPorPulseira(ev.id, idDe(b.pulseira, 'Pulseira'),b.equipeId?idDe(b.equipeId,'Inscrição'):undefined,momento!=='inicial');
    const balanca = num(b.balancaKg);
    if (balanca == null || balanca < 20 || balanca > 250) throw new HttpError(400, 'Peso da balança inválido.');
    let lastro = num(b.lastroKg);
    // pesagem inicial: a balança mostra o piloto equipado SEM lastro; o lastro é o que ele vai levar
    // nas outras: o piloto sobe COM o lastro e a balança já mostra o total
    if (momento === 'inicial' && lastro == null) lastro = lastroNecessario(balanca, regras).lastroKg;
    const total = momento === 'inicial' ? balanca + (lastro ?? 0) : balanca;
    const av = avaliarPeso(total, regras);
    const r = await tx(async (run) => {
      const ins = (await run(
        `INSERT INTO dbo.EndurancePesagem (EventoId, PilotoId, Momento, BalancaKg, LastroKg, TotalKg, Resultado, PunicaoSeg, Usuario, Obs, EmMs) OUTPUT INSERTED.Id id
         VALUES (@e, @p, @mo, @b, @l, @t, @res, @pun, @u, @obs, @ms)`,
        { e: ev.id, p: p.id, mo: momento, b: balanca, l: lastro, t: total, res: av.resultado, pun: av.punicaoSeg, u: quem, obs: txt(b.obs, 300) || null, ms: Date.now() },
      ))[0] as { id: number };
      if (momento === 'inicial') await run(`UPDATE dbo.EndurancePiloto SET PesoKg = @peso, LastroKg = @l WHERE Id = @id`, { peso: balanca, l: lastro, id: p.id });
      else if (lastro != null) await run(`UPDATE dbo.EndurancePiloto SET LastroKg = @l WHERE Id = @id`, { l: lastro, id: p.id });
      // a pesagem de antes da largada só define o lastro; punição vale para as pesagens durante e depois da prova
      if (momento !== 'inicial' && av.resultado !== 'ok') {
        await run(`INSERT INTO dbo.EndurancePunicao (EventoId, EquipeId, Tipo, Valor, Motivo, Origem, PesagemId, Usuario) VALUES (@e, @q, @tipo, @v, @mot, 'pesagem', @pid, @u)`, {
          e: ev.id, q: p.equipeId, tipo: av.resultado === 'dq' ? 'dq' : 'segundos', v: av.punicaoSeg, pid: ins.id, u: quem,
          mot: `Pesagem (${momento}) de ${p.nome}, pulseira ${p.pulseira}: ${total.toFixed(2).replace('.', ',')} kg. ${av.mensagem}`.slice(0, 300),
        });
      }
      return ins;
    });
    send(201, { id: r.id, totalKg: total, lastroKg: lastro, ...av, piloto: { nome: p.nome, pulseira: p.pulseira } });
    return true;
  }
  if ((m = resto.match(/^\/pesagens\/(\d+)$/)) && method === 'DELETE') {
    await query(`UPDATE dbo.EndurancePunicao SET Cancelada = 1 WHERE PesagemId = @id AND EventoId = @e; DELETE FROM dbo.EndurancePesagem WHERE Id = @id AND EventoId = @e`, { id: Number(m[1]), e: ev.id });
    send(200, { ok: true });
    return true;
  }

  // ---- filas do box (fileiras 1..N) e sorteio
  if (resto === '/filas' && method === 'POST') {
    // monta as fileiras: { fileiras: { "1": ["12","7"], "2": [...] } }; karts que estão na pista ficam como estão
    const b = await req.body();
    const fil = (b.fileiras ?? {}) as Record<string, unknown[]>;
    await tx(async (run) => {
      await run(`DELETE FROM dbo.EnduranceFila WHERE EventoId = @e AND Situacao <> 'pista'`, { e: ev.id });
      const naPista = new Set(((await run(`SELECT Kart kart FROM dbo.EnduranceFila WHERE EventoId = @e`, { e: ev.id })) as { kart: string }[]).map((x) => x.kart));
      for (const [f, karts] of Object.entries(fil)) {
        const fileira = Number(f);
        if (!Number.isInteger(fileira) || fileira < 1 || fileira > 12) continue;
        let ordem = 0;
        for (const k of karts.map((x) => txt(x, 10)).filter(Boolean)) {
          if (naPista.has(k)) continue;
          naPista.add(k);
          await run(`INSERT INTO dbo.EnduranceFila (EventoId, Kart, Fileira, Ordem, Situacao) VALUES (@e, @k, @f, @o, 'fila')`, { e: ev.id, k, f: fileira, o: ++ordem });
        }
      }
      for (const k of (Array.isArray(b.fora) ? b.fora : []).map((x: unknown) => txt(x, 10)).filter(Boolean)) {
        if (naPista.has(k)) continue;
        await run(`INSERT INTO dbo.EnduranceFila (EventoId, Kart, Situacao) VALUES (@e, @k, 'fora')`, { e: ev.id, k });
      }
    });
    send(200, { filas: await filasDo(ev.id) });
    return true;
  }
  if (resto === '/filas/mover' && method === 'POST') {
    // tira do sorteio (6.4), devolve para uma fileira, ou muda de lugar
    const b = await req.body();
    const kart = txt(b.kart, 10);
    const sit = String(b.situacao ?? 'fila');
    const fileira = b.fileira ? Number(b.fileira) : null;
    const k = await one<{ situacao: string }>(`SELECT Situacao situacao FROM dbo.EnduranceFila WHERE EventoId = @e AND Kart = @k`, { e: ev.id, k: kart });
    if (k?.situacao === 'pista') throw new HttpError(409, `O kart ${kart} está na pista com uma equipe. Faça a troca primeiro.`);
    const ordem = await one<{ o: number }>(`SELECT ISNULL(${b.inicio ? 'MIN(Ordem) - 1' : 'MAX(Ordem) + 1'}, 1) o FROM dbo.EnduranceFila WHERE EventoId = @e AND Fileira = @f AND Situacao = 'fila'`, { e: ev.id, f: fileira });
    if (k) await query(`UPDATE dbo.EnduranceFila SET Situacao = @s, Fileira = @f, Ordem = @o, Obs = @obs WHERE EventoId = @e AND Kart = @k`, { e: ev.id, k: kart, s: sit === 'fora' ? 'fora' : 'fila', f: sit === 'fora' ? null : fileira, o: sit === 'fora' ? null : ordem?.o ?? 1, obs: txt(b.obs, 200) || null });
    else await query(`INSERT INTO dbo.EnduranceFila (EventoId, Kart, Fileira, Ordem, Situacao, Obs) VALUES (@e, @k, @f, @o, @s, @obs)`, { e: ev.id, k: kart, s: sit === 'fora' ? 'fora' : 'fila', f: sit === 'fora' ? null : fileira, o: sit === 'fora' ? null : ordem?.o ?? 1, obs: txt(b.obs, 200) || null });
    send(200, { filas: await filasDo(ev.id) });
    return true;
  }
  if (resto === '/largada' && method === 'POST') {
    // sorteio dos karts do briefing: cada equipe sem kart recebe um kart sorteado entre os das fileiras
    const b = await req.body();
    const res = await tx(async (run) => {
      const livres = (await run(`SELECT Kart kart FROM dbo.EnduranceFila WITH (UPDLOCK) WHERE EventoId = @e AND Situacao = 'fila'`, { e: ev.id }) as { kart: string }[]).map((x) => x.kart);
      const semKart = (await run(`SELECT q.Id id, q.Numero numero, q.Nome nome FROM dbo.EnduranceEquipe q WHERE q.EventoId = @e AND q.Desclassificada = 0
        AND NOT EXISTS (SELECT 1 FROM dbo.EnduranceFila f WHERE f.EventoId = q.EventoId AND f.EquipeId = q.Id AND f.Situacao = 'pista')`, { e: ev.id })) as { id: number; numero: string; nome: string }[];
      if (livres.length < semKart.length) throw new HttpError(409, `Há ${semKart.length} equipes sem kart e só ${livres.length} karts nas fileiras.`);
      for (let i = livres.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [livres[i], livres[j]] = [livres[j], livres[i]]; }
      const out: { equipe: string; numero: string; kart: string }[] = [];
      for (const [i, q] of semKart.entries()) {
        const kart = livres[i];
        await run(`UPDATE dbo.EnduranceFila SET Situacao = 'pista', EquipeId = @q, Fileira = NULL, Ordem = NULL WHERE EventoId = @e AND Kart = @k`, { e: ev.id, q: q.id, k: kart });
        await run(`INSERT INTO dbo.EnduranceTroca (EventoId, EquipeId, Kart, Tipo, Usuario, Obs, EmMs) VALUES (@e, @q, @k, 'largada', @u, @obs, @ms)`, { e: ev.id, q: q.id, k: kart, u: quem, obs: txt(b.obs, 300) || 'Sorteio dos karts do briefing', ms: Date.now() });
        out.push({ equipe: q.nome, numero: q.numero, kart });
      }
      return out;
    });
    send(200, { sorteados: res });
    return true;
  }
  if (resto === '/trocas' && method === 'POST') {
    // troca no box: o piloto que vai entrar fala o número da pulseira; a bolinha (ou o sistema) diz a fileira; ele pega o 1º kart dela.
    const b = await req.body();
    const tipo = ['parada', 'quebra', 'mecanica', 'largada', 'correcao'].includes(String(b.tipo)) ? String(b.tipo) : 'parada';
    const p = b.pulseira ? await pilotoPorPulseira(ev.id, idDe(b.pulseira, 'Pulseira'),b.equipeId?idDe(b.equipeId,'Inscrição'):undefined,true) : null;
    const equipeId = p?.equipeId ?? idDe(b.equipeId, 'Equipe');
    const r = await tx(async (run) => {
      const filasAgora = (await run(`SELECT Kart kart, Fileira fileira, Ordem ordem, Situacao situacao, EquipeId equipeId FROM dbo.EnduranceFila WITH (UPDLOCK) WHERE EventoId = @e ORDER BY Fileira, Ordem`, { e: ev.id })) as { kart: string; fileira: number | null; ordem: number | null; situacao: string; equipeId: number | null }[];
      const anterior = filasAgora.find((f) => f.situacao === 'pista' && f.equipeId === equipeId) ?? null;
      let kart: string; let fileira: number | null = null;
      const manual = txt(b.kart, 10);
      if (manual) {
        const k = filasAgora.find((f) => f.kart === manual);
        if (k?.situacao === 'pista' && k.equipeId !== equipeId) throw new HttpError(409, `O kart ${manual} está na pista com outra equipe.`);
        kart = manual; fileira = k?.fileira ?? null;
      } else {
        const mapa = new Map<number, string[]>();
        for (let f = 1; f <= regras.fileiras; f++) mapa.set(f, []);
        for (const f of filasAgora) if (f.situacao === 'fila' && f.fileira) (mapa.get(f.fileira) ?? mapa.set(f.fileira, []).get(f.fileira)!).push(f.kart);
        const s = sortearFileira(mapa, b.bola ? Number(b.bola) : null);
        kart = s.kart; fileira = s.fileira;
      }
      // o kart que a equipe deixou volta para o fim de uma fileira (a que o box escolher; senão a mais curta)
      let devolvidoEm: number | null = null;
      if (anterior && anterior.kart !== kart) {
        const cont = new Map<number, number>();
        for (let f = 1; f <= regras.fileiras; f++) cont.set(f, 0);
        for (const f of filasAgora) if (f.situacao === 'fila' && f.fileira && f.kart !== kart) cont.set(f.fileira, (cont.get(f.fileira) ?? 0) + 1);
        devolvidoEm = b.devolverFileira ? Number(b.devolverFileira) : [...cont.entries()].sort((x, y) => x[1] - y[1] || x[0] - y[0])[0][0];
        if (b.kartAnteriorFora) await run(`UPDATE dbo.EnduranceFila SET Situacao = 'fora', EquipeId = NULL, Fileira = NULL, Ordem = NULL, Obs = @obs WHERE EventoId = @e AND Kart = @k`, { e: ev.id, k: anterior.kart, obs: txt(b.obs, 200) || 'Retirado na troca' });
        else {
          const max = (await run(`SELECT ISNULL(MAX(Ordem), 0) + 1 o FROM dbo.EnduranceFila WHERE EventoId = @e AND Fileira = @f AND Situacao = 'fila'`, { e: ev.id, f: devolvidoEm }))[0] as { o: number };
          await run(`UPDATE dbo.EnduranceFila SET Situacao = 'fila', EquipeId = NULL, Fileira = @f, Ordem = @o WHERE EventoId = @e AND Kart = @k`, { e: ev.id, k: anterior.kart, f: devolvidoEm, o: max.o });
        }
      }
      const existe = filasAgora.some((f) => f.kart === kart);
      if (existe) await run(`UPDATE dbo.EnduranceFila SET Situacao = 'pista', EquipeId = @q, Fileira = NULL, Ordem = NULL WHERE EventoId = @e AND Kart = @k`, { e: ev.id, q: equipeId, k: kart });
      else await run(`INSERT INTO dbo.EnduranceFila (EventoId, Kart, Situacao, EquipeId) VALUES (@e, @k, 'pista', @q)`, { e: ev.id, k: kart, q: equipeId });
      const ins = (await run(
        `INSERT INTO dbo.EnduranceTroca (EventoId, EquipeId, PilotoId, Kart, KartDevolvido, Fileira, Tipo, Usuario, Obs, EmMs) OUTPUT INSERTED.Id id VALUES (@e, @q, @p, @k, @kd, @f, @t, @u, @obs, @ms)`,
        { e: ev.id, q: equipeId, p: p?.id ?? null, k: kart, kd: anterior && anterior.kart !== kart ? anterior.kart : null, f: fileira, t: tipo, u: quem, obs: txt(b.obs, 300) || null, ms: Date.now() },
      ))[0] as { id: number };
      return { id: ins.id, kart, fileira, devolvido: anterior && anterior.kart !== kart ? { kart: anterior.kart, fileira: b.kartAnteriorFora ? null : devolvidoEm } : null };
    });
    const eq = await one<{ nome: string; numero: string }>(`SELECT Nome nome, Numero numero FROM dbo.EnduranceEquipe WHERE Id = @id`, { id: equipeId });
    send(201, { ...r, piloto: p ? { nome: p.nome, pulseira: p.pulseira } : null, equipe: eq });
    return true;
  }
  if ((m = resto.match(/^\/trocas\/(\d+)$/)) && method === 'PUT') {
    // escolher depois quem larga (sorteio do briefing) ou corrigir o piloto de uma troca
    const b = await req.body();
    const t = await one<{ equipeId: number }>(`SELECT EquipeId equipeId FROM dbo.EnduranceTroca WHERE Id = @id AND EventoId = @e`, { id: Number(m[1]), e: ev.id });
    if (!t) throw new HttpError(404, 'Troca não encontrada.');
    const p = b.pulseira ? await pilotoPorPulseira(ev.id, idDe(b.pulseira, 'Pulseira'),t.equipeId) : b.pilotoId ? await one<Piloto>(`${PILOTO_SQL} WHERE p.Id = @id AND p.EventoId = @e AND p.EquipeId=@q`, { id: Number(b.pilotoId), e: ev.id,q:t.equipeId }) : null;
    if (p && p.equipeId !== t.equipeId) throw new HttpError(409, `${p.nome} é de outra equipe.`);
    await query(`UPDATE dbo.EnduranceTroca SET PilotoId = @p WHERE Id = @id`, { p: p?.id ?? null, id: Number(m[1]) });
    send(200, { ok: true });
    return true;
  }
  if ((m = resto.match(/^\/trocas\/(\d+)\/desfazer$/)) && method === 'POST') {
    // só a última troca da equipe: o kart volta para o começo da fileira de onde saiu e o anterior volta para a equipe
    const id = Number(m[1]);
    await tx(async (run) => {
      const t = (await run(`SELECT Id id, EquipeId equipeId, Kart kart, KartDevolvido kartDevolvido, Fileira fileira FROM dbo.EnduranceTroca WHERE Id = @id AND EventoId = @e AND Cancelada = 0`, { id, e: ev.id }))[0] as { id: number; equipeId: number; kart: string; kartDevolvido: string | null; fileira: number | null } | undefined;
      if (!t) throw new HttpError(404, 'Troca não encontrada.');
      const ultima = (await run(`SELECT MAX(Id) id FROM dbo.EnduranceTroca WHERE EquipeId = @q AND Cancelada = 0`, { q: t.equipeId }))[0] as { id: number };
      if (ultima.id !== t.id) throw new HttpError(409, 'Só dá para desfazer a última troca da equipe.');
      if (t.fileira) {
        const min = (await run(`SELECT ISNULL(MIN(Ordem), 1) - 1 o FROM dbo.EnduranceFila WHERE EventoId = @e AND Fileira = @f AND Situacao = 'fila'`, { e: ev.id, f: t.fileira }))[0] as { o: number };
        await run(`UPDATE dbo.EnduranceFila SET Situacao = 'fila', EquipeId = NULL, Fileira = @f, Ordem = @o WHERE EventoId = @e AND Kart = @k`, { e: ev.id, k: t.kart, f: t.fileira, o: min.o });
      } else await run(`UPDATE dbo.EnduranceFila SET Situacao = 'fila', EquipeId = NULL, Fileira = 1, Ordem = 0 WHERE EventoId = @e AND Kart = @k`, { e: ev.id, k: t.kart });
      if (t.kartDevolvido) await run(`UPDATE dbo.EnduranceFila SET Situacao = 'pista', EquipeId = @q, Fileira = NULL, Ordem = NULL WHERE EventoId = @e AND Kart = @k`, { e: ev.id, k: t.kartDevolvido, q: t.equipeId });
      await run(`UPDATE dbo.EnduranceTroca SET Cancelada = 1, Obs = CONCAT(ISNULL(Obs + ' · ', ''), 'desfeita por ', @u) WHERE Id = @id`, { id, u: quem });
    });
    send(200, { ok: true });
    return true;
  }

  // ---- punições da direção de prova e correções de parada
  if (resto === '/punicoes' && method === 'POST') {
    const b = await req.body();
    const tipo = String(b.tipo);
    if (!['segundos', 'voltas', 'advertencia', 'dq'].includes(tipo)) throw new HttpError(400, 'Tipo de punição inválido.');
    const motivo = txt(b.motivo, 300);
    if (!motivo) throw new HttpError(400, 'Escreva o motivo.');
    await query(`INSERT INTO dbo.EndurancePunicao (EventoId, EquipeId, Tipo, Valor, Motivo, Usuario) VALUES (@e, @q, @t, @v, @m, @u)`,
      { e: ev.id, q: idDe(b.equipeId, 'Equipe'), t: tipo, v: Math.max(0, Math.round(num(b.valor) ?? 0)), m: motivo, u: quem });
    send(201, { ok: true });
    return true;
  }
  if ((m = resto.match(/^\/punicoes\/(\d+)$/)) && method === 'DELETE') {
    await query(`UPDATE dbo.EndurancePunicao SET Cancelada = 1 WHERE Id = @id AND EventoId = @e`, { id: Number(m[1]), e: ev.id });
    send(200, { ok: true });
    return true;
  }
  if (resto === '/ajustes' && method === 'POST') {
    const b = await req.body();
    const equipeId = idDe(b.equipeId, 'Equipe'), volta = idDe(b.volta, 'Volta');
    const acao = String(b.acao ?? '');
    await query(`DELETE FROM dbo.EnduranceParadaAjuste WHERE EventoId = @e AND EquipeId = @q AND Volta = @v`, { e: ev.id, q: equipeId, v: volta });
    if (['quebra', 'invalidar', 'ignorar', 'validar'].includes(acao)) {
      await query(`INSERT INTO dbo.EnduranceParadaAjuste (EventoId, EquipeId, Volta, Acao, Usuario) VALUES (@e, @q, @v, @a, @u)`, { e: ev.id, q: equipeId, v: volta, a: acao, u: quem });
    }
    cacheCrono.delete(ev.sessaoCrono ?? '');
    send(200, { ok: true });
    return true;
  }

  return false;
}
