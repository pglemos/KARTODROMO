/**
 * App do cliente: vínculo automático da conta do app com o cadastro da recepção (SRVKART).
 * O resultado pessoal (e a carreira) do app só aparece com esse vínculo. Antes era só a recepção, à mão
 * (botão "App" na ficha do cliente); agora, a cada minuto, o servidor pede ao Worker as contas com e-mail confirmado
 * ainda sem vínculo e procura o cliente pelo CPF. Só vincula se o e-mail OU o telefone da conta também forem os do
 * cadastro — CPF sozinho não basta (qualquer um digita o CPF de outra pessoa). O que não bater continua manual.
 * Env: MOBILE_IDENTITY_LINK_URL (…/api/mobile/v1/internal/identity-links) e MOBILE_ADMIN_TOKEN.
 */
import { mobileApiEndpoint } from '../mobile-api-url';
import { CLIENTE_COLS, one, onlyDigits, query, updateCliente, type ClienteInput } from './db';
import { createHash, createHmac } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

type Log = (...args: unknown[]) => void;
type Candidata = { email: string; cpf: string; phone: string; nivel?: string | null };

const INTERVALO_MS = 60_000;
/** conta que não bateu com nenhum cadastro: tenta de novo depois (a recepção pode corrigir o cadastro) */
const ESPERA_SEM_CADASTRO_MS = 30 * 60_000;
let ultimaVez = 0;
const semCadastro = new Map<string, number>();

export function vinculoAutomaticoLigado() {
  return Boolean(process.env.MOBILE_IDENTITY_LINK_URL && process.env.MOBILE_ADMIN_TOKEN);
}

/** Mesmo telefone: compara os últimos 10 dígitos (DDD + número, com ou sem o 9 e o +55). */
export function mesmoTelefone(a: string, b: string) {
  const x = onlyDigits(a).replace(/^55(?=\d{10,11}$)/, '');
  const y = onlyDigits(b).replace(/^55(?=\d{10,11}$)/, '');
  if (x.length < 10 || y.length < 10) return false;
  const fim = (s: string) => (s.length === 11 && s[2] === '9' ? s.slice(0, 2) + s.slice(3) : s).slice(-10);
  return fim(x) === fim(y);
}

/**
 * Cliente da recepção dono desta conta, pelo CPF (o app só deixa um CPF por conta, com e-mail confirmado).
 *   nivel 'completo': CPF + (e-mail ou telefone do cadastro) → histórico e perfil pessoal.
 *   nivel 'cpf'     : só o CPF → histórico, carreira e ranking; o perfil pessoal fica protegido.
 * Com mais de um cadastro no mesmo CPF, prefere o que bate e-mail/telefone; senão, o atualizado por último.
 */
export async function clienteDaConta(c: Candidata): Promise<{ id: number; nivel: 'cpf' | 'completo' } | null> {
  const cpf = onlyDigits(c.cpf);
  if (cpf.length !== 11) return null;
  const linhas = await query<{ id: number; email: string | null; telefone: string | null }>(
    `SELECT TOP 10 Id id, Email email, Telefone telefone FROM dbo.Cliente
      WHERE (DocumentoNum = @doc OR Documento = @doc) AND ResponsavelId IS NULL ORDER BY AtualizadoEm DESC`,
    { doc: cpf },
  );
  if (!linhas.length) return null;
  const email = c.email.trim().toLowerCase();
  const dono = linhas.find((l) => (email && String(l.email ?? '').trim().toLowerCase() === email) || mesmoTelefone(String(l.telefone ?? ''), c.phone));
  return dono ? { id: dono.id, nivel: 'completo' } : { id: linhas[0].id, nivel: 'cpf' };
}

/** Recepção salvou/corrigiu um cadastro: o próximo ciclo (≤ 5 s) confere todas as contas pendentes de novo. */
export function pedirVinculoAgora() {
  ultimaVez = 0;
  semCadastro.clear();
}

/**
 * Vínculo sob demanda: long-poll no Worker. Responde na hora em que um cliente confirma o e-mail ou abre o histórico
 * sem vínculo; aí vincula e publica o histórico completo daquele cliente. O ciclo de 60 s continua como rede de segurança.
 */
export async function escutarPedidosDeVinculo(log: Log, parar: () => boolean = () => false) {
  if (!vinculoAutomaticoLigado()) return;
  const vincular = mobileApiEndpoint(process.env.MOBILE_IDENTITY_LINK_URL!, '/api/mobile/v1/internal/identity-links');
  if (!vincular) return;
  const esperar = new URL('/api/mobile/v1/internal/identity-wait?ms=25000', vincular);
  let pausa = 1_000;
  while (!parar()) {
    try {
      const r = await fetch(esperar, {
        headers: { 'x-mobile-admin-token': process.env.MOBILE_ADMIN_TOKEN! },
        redirect: 'error',
        signal: AbortSignal.timeout(35_000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const { sinal } = (await r.json()) as { sinal?: boolean };
      pausa = 1_000;
      if (sinal) await vincularContasDoApp(log, Date.now(), true);
    } catch (e) {
      // sem internet ou Worker antigo: espera um pouco (até 30 s) e tenta de novo; o ciclo de 60 s cobre
      if (pausa >= 30_000) log(`app: espera do vínculo sob demanda indisponível (${(e as Error).message})`);
      await new Promise((ok) => setTimeout(ok, pausa));
      pausa = Math.min(pausa * 2, 30_000);
    }
  }
}

/** Roda junto com o ciclo da reserva online (5 s), mas só uma vez por minuto (ou na hora, com forcar). Devolve quantas contas vinculou. */
export async function vincularContasDoApp(log: Log, agora = Date.now(), forcar = false) {
  if (!vinculoAutomaticoLigado() || (!forcar && agora - ultimaVez < INTERVALO_MS)) return 0;
  ultimaVez = agora;
  const destino = process.env.MOBILE_IDENTITY_LINK_URL!;
  const token = process.env.MOBILE_ADMIN_TOKEN!;
  const vincular = mobileApiEndpoint(destino, '/api/mobile/v1/internal/identity-links');
  if (!vincular) return 0;
  const listar = new URL('/api/mobile/v1/internal/identity-candidates', vincular);
  const r = await fetch(listar, { headers: { 'x-mobile-admin-token': token }, redirect: 'error', signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`contas do app: HTTP ${r.status}`);
  const contas = (await r.json()) as Candidata[];
  let feitos = 0;
  for (const conta of contas) {
    const chave = onlyDigits(conta.cpf) + '|' + conta.email.trim().toLowerCase();
    if (!forcar && (semCadastro.get(chave) ?? 0) > agora) continue;
    const achado = await clienteDaConta(conta);
    if (!achado) { semCadastro.set(chave, agora + ESPERA_SEM_CADASTRO_MS); continue; }
    // já vinculada por CPF e continua só CPF: nada a promover (confere de novo quando a recepção mexer no cadastro)
    if (conta.nivel === 'cpf' && achado.nivel === 'cpf') { semCadastro.set(chave, agora + ESPERA_SEM_CADASTRO_MS); continue; }
    const clienteId = achado.id;
    const v = await fetch(vincular, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mobile-admin-token': token },
      body: JSON.stringify({ customerId: String(clienteId), email: conta.email.trim().toLowerCase(), nivel: achado.nivel }),
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    if (v.ok) {
      feitos++;
      log(achado.nivel === 'completo'
        ? `app: conta vinculada ao cliente ${clienteId} (CPF e e-mail ou telefone conferidos)`
        : `app: conta vinculada ao cliente ${clienteId} pelo CPF (corridas liberadas; perfil pessoal aguarda e-mail/telefone iguais)`);
      // histórico completo (inclusive o de antes do app) já no mesmo instante
      try {
        historicosUltimaVez = 0; // a reconciliação seguinte também confere este cliente
        const n = await publicarHistoricoDoCliente(String(clienteId));
        log(`app: histórico do cliente ${clienteId} publicado (${n} bateria(s))`);
      } catch (e) {
        log(`app: histórico do cliente ${clienteId} não publicado agora (${(e as Error).message})`);
      }
      continue;
    }
    // 409 = o cliente já tem outra conta do app: fica para a recepção decidir
    semCadastro.set(chave, agora + ESPERA_SEM_CADASTRO_MS);
    if (v.status === 409) log(`app: cliente ${clienteId} já tem outra conta do app vinculada; ficou para a recepção`);
  }
  return feitos;
}

// ---------------------------------------------------------------- histórico pessoal completo
type PilotoBateria = { cid?: unknown; nome?: unknown; kart?: unknown; pos?: unknown; voltas?: unknown; melhor?: unknown; dq?: unknown };
type BateriaIndice = { id?: unknown; nome?: unknown; dia?: unknown; tipo?: unknown; reserva?: unknown; pilotos?: unknown };
export type ResultadoHistorico = {
  sessionId: string; eventName: string; eventDate: string; displayName: string;
  position: number; kart: string; laps: number; bestLapMs: number | null;
};

/** Baterias de um cliente no índice da cronometragem (.runtime/pilotos-cronometragem.json). Mesmas regras do Worker. */
export function historicoDoCliente(baterias: Record<string, BateriaIndice>, clienteId: string): ResultadoHistorico[] {
  const porSessao = new Map<string, ResultadoHistorico>();
  for (const [key, b] of Object.entries(baterias)) {
    const sessionId = String(b.id ?? key);
    const eventName = String(b.nome ?? '').replace(/\s+/g, ' ').trim();
    const eventDate = String(b.dia ?? '');
    const tipo = String(b.tipo ?? '').toLowerCase();
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(sessionId) || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate) ||
        !eventName || eventName.length > 160 || /equalizacao|teste codex/i.test(eventName + ' ' + tipo) ||
        /^test(?:-|_)/i.test(sessionId) || b.reserva === true || !Array.isArray(b.pilotos)) continue;
    for (const p of b.pilotos as PilotoBateria[]) {
      if (String(p.cid ?? '') !== clienteId || p.dq === true) continue;
      const displayName = String(p.nome ?? '').replace(/\s+/g, ' ').trim();
      const kart = String(p.kart ?? '').trim();
      const position = Number(p.pos);
      const laps = Number(p.voltas ?? 0);
      const melhor = Number(p.melhor);
      const bestLapMs = Number.isSafeInteger(melhor) && melhor > 0 && melhor <= 600_000 ? melhor : null;
      if (!displayName || displayName.length > 80 || !kart || kart.length > 40 || !Number.isSafeInteger(position) ||
          position < 1 || position > 1000 || !Number.isSafeInteger(laps) || laps < 0 || laps > 10_000) continue;
      porSessao.set(sessionId, { sessionId, eventName, eventDate, displayName, position, kart, laps, bestLapMs });
    }
  }
  return [...porSessao.values()]
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate) || b.sessionId.localeCompare(a.sessionId))
    .slice(0, 500);
}

const ARQ_INDICE_PILOTOS = () => resolve(join(process.cwd(), '.runtime', 'pilotos-cronometragem.json'));

/** Publica no app o histórico completo de um cliente (chave historico:<id>). Devolve quantas baterias foram. */
export async function publicarHistoricoDoCliente(clienteId: string) {
  if (!/^\d{1,20}$/.test(clienteId) || !vinculoAutomaticoLigado()) return 0;
  const base = mobileApiEndpoint(process.env.MOBILE_IDENTITY_LINK_URL!, '/api/mobile/v1/internal/identity-links');
  if (!base) return 0;
  const arquivo = ARQ_INDICE_PILOTOS();
  if (!existsSync(arquivo)) return 0;
  const baterias = (JSON.parse(readFileSync(arquivo, 'utf8')) as { baterias?: Record<string, BateriaIndice> }).baterias ?? {};
  const results = historicoDoCliente(baterias, clienteId);
  if (!results.length) return 0;
  const r = await fetch(new URL('/api/mobile/v1/internal/ranking', base), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-mobile-admin-token': process.env.MOBILE_ADMIN_TOKEN! },
    body: JSON.stringify({ itens: [{ chave: 'historico:' + clienteId, dados: { results } }] }),
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return results.length;
}

/**
 * Reconciliação: a cada 10 min publica o histórico de todo cliente vinculado cujo histórico mudou (ou que nunca foi
 * publicado). Substitui o script manual publicar-karts-app.mjs para o histórico: ninguém vinculado fica sem corridas.
 */
const HISTORICOS_ESPACO_MIN_MS = 20_000;
const HISTORICOS_SEGURANCA_MS = 6 * 3_600_000;
let historicosUltimaVez = 0;
let historicosVersao = -1;
const historicoEnviado = new Map<string, string>();

/** Orientado a evento: roda quando entra bateria nova no índice (ou um vínculo novo zera historicosUltimaVez). */
export async function publicarHistoricosVinculados(log: Log, agora = Date.now()) {
  if (!vinculoAutomaticoLigado() || agora - historicosUltimaVez < HISTORICOS_ESPACO_MIN_MS) return 0;
  const { versaoIndicePilotos } = await import('./pilotos');
  const versao = versaoIndicePilotos();
  if (historicosUltimaVez !== 0 && versao === historicosVersao && agora - historicosUltimaVez < HISTORICOS_SEGURANCA_MS) return 0;
  historicosUltimaVez = agora;
  historicosVersao = versao;
  const base = mobileApiEndpoint(process.env.MOBILE_IDENTITY_LINK_URL!, '/api/mobile/v1/internal/identity-links');
  if (!base) return 0;
  const arquivo = ARQ_INDICE_PILOTOS();
  if (!existsSync(arquivo)) return 0;
  const token = process.env.MOBILE_ADMIN_TOKEN!;
  const r = await fetch(base, { headers: { 'x-mobile-admin-token': token }, redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`contas vinculadas: HTTP ${r.status}`);
  const ids = ((await r.json()) as { customerIds?: unknown[] }).customerIds?.map(String).filter((id) => /^\d{1,20}$/.test(id)) ?? [];
  const baterias = (JSON.parse(readFileSync(arquivo, 'utf8')) as { baterias?: Record<string, BateriaIndice> }).baterias ?? {};
  const mudaram: { chave: string; dados: { results: ResultadoHistorico[] }; texto: string }[] = [];
  for (const id of ids) {
    const results = historicoDoCliente(baterias, id);
    if (!results.length) continue;
    const texto = hashDe(JSON.stringify(results));
    if (historicoEnviado.get(id) !== texto) mudaram.push({ chave: 'historico:' + id, dados: { results }, texto });
  }
  for (let i = 0; i < mudaram.length; i += 10) {
    const lote = mudaram.slice(i, i + 10);
    const e = await fetch(new URL('/api/mobile/v1/internal/ranking', base), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mobile-admin-token': token },
      body: JSON.stringify({ itens: lote.map(({ chave, dados }) => ({ chave, dados })) }),
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    if (!e.ok) throw new Error(`histórico: HTTP ${e.status}`);
    for (const l of lote) historicoEnviado.set(l.chave.slice('historico:'.length), l.texto);
  }
  if (mudaram.length) log(`app: histórico de ${mudaram.length} cliente(s) vinculado(s) atualizado`);
  return mudaram.length;
}

// ---------------------------------------------------------------- ranking e carreira no app
/**
 * Ranking e carreira no app, orientado a evento: publica assim que o índice de baterias muda (bateria nova lida da
 * cronometragem) ou o dia vira (semana/mês). Envia só o que mudou, comparando hash por documento:
 *   ranking            1 documento (top 100 por traçado/período)
 *   posicoes:<p>:<t>   1 por traçado/período (~100): posição e total de cada piloto — o Worker junta na leitura
 *   piloto:<cid>       ficha do piloto, que agora só muda quando ELE corre
 * Antes a posição ficava na ficha: uma bateria mexia no "de 812" de todo o traçado e ~75 mil fichas eram regravadas
 * várias vezes por dia (cota de gravação do D1). Só dados públicos — ver rankingPublicoParaApp.
 */
const RANKING_ESPACO_MIN_MS = 20_000; // várias baterias seguidas viram uma publicação só
const RANKING_SEGURANCA_MS = 6 * 3_600_000; // rede de segurança: confere mesmo sem evento
// O que já foi enviado fica em disco (hash por documento) para um reinício não regravar nada.
const ARQ_ENVIADO = resolve(join(process.cwd(), '.runtime', 'ranking-app-enviado.json'));
const FORMATO_ENVIO = 'v2-posicoes';
let rankingUltimaVez = 0;
let rankingVersao = -1;
let rankingDia = '';
const rankingEnviado = new Map<string, string>();
try { if (existsSync(ARQ_ENVIADO)) for (const [k, v] of Object.entries(JSON.parse(readFileSync(ARQ_ENVIADO, 'utf8')) as Record<string, string>)) rankingEnviado.set(k, v); } catch { /* recomeça vazio */ }
const hashDe = (t: string) => createHash('sha1').update(t).digest('base64');
const diaSp = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

/** Pede publicação no próximo ciclo (≤ 5 s), ex.: bateria nova lida. */
export function pedirPublicacaoDoRanking() { rankingVersao = -1; }

export async function publicarRankingDoApp(log: Log, agora = Date.now()) {
  if (!vinculoAutomaticoLigado() || agora - rankingUltimaVez < RANKING_ESPACO_MIN_MS) return 0;
  const { rankingPublicoParaApp, versaoIndicePilotos } = await import('./pilotos');
  const versao = versaoIndicePilotos();
  const dia = diaSp(agora);
  if (versao === rankingVersao && dia === rankingDia && agora - rankingUltimaVez < RANKING_SEGURANCA_MS) return 0;
  rankingUltimaVez = agora;
  const base = mobileApiEndpoint(process.env.MOBILE_IDENTITY_LINK_URL!, '/api/mobile/v1/internal/identity-links');
  if (!base) return 0;
  const destino = new URL('/api/mobile/v1/internal/ranking', base);
  const token = process.env.MOBILE_ADMIN_TOKEN!;
  const { ranking, pilotos, posicoes } = await rankingPublicoParaApp();
  const enviar = async (itens: { chave: string; dados: unknown }[], apagar: string[] = []) => {
    const r = await fetch(destino, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mobile-admin-token': token },
      body: JSON.stringify(apagar.length ? { itens, apagar } : { itens }),
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) throw new Error(`ranking do app: HTTP ${r.status}`);
  };
  const salvar = () => { try { const tmp = ARQ_ENVIADO + '.tmp'; writeFileSync(tmp, JSON.stringify(Object.fromEntries(rankingEnviado))); renameSync(tmp, ARQ_ENVIADO); } catch { /* sem disco: no próximo reinício reconfere */ } };

  // 1) ranking (1 doc) e posições (~100 docs): só os que mudaram; lotes até ~3 MB (limite do Worker: 4 MB)
  const docs: { chave: string; dados: unknown; texto: string }[] = [];
  const textoRanking = hashDe(JSON.stringify(ranking));
  if (rankingEnviado.get('ranking') !== textoRanking) docs.push({ chave: 'ranking', dados: ranking, texto: textoRanking });
  for (const [chave, dados] of Object.entries(posicoes)) {
    const texto = hashDe(JSON.stringify(dados));
    if (rankingEnviado.get(chave) !== texto) docs.push({ chave, dados, texto });
  }
  let lote: typeof docs = [], bytes = 0;
  const fecharLote = async () => {
    if (!lote.length) return;
    await enviar(lote.map(({ chave, dados }) => ({ chave, dados })));
    for (const l of lote) rankingEnviado.set(l.chave, l.texto);
    lote = []; bytes = 0;
  };
  for (const d of docs) {
    const tam = JSON.stringify(d.dados).length;
    if (bytes + tam > 3_000_000) await fecharLote();
    lote.push(d); bytes += tam;
  }
  await fecharLote();

  // 2) fichas: na primeira vez no formato novo, a ficha perdeu as posições (o texto muda para todos). Não regrava
  //    ~75 mil fichas por isso: marca como enviadas e manda só quem correu de ontem para cá (o que pode ter mudado
  //    desde a última publicação). O Worker continua servindo a ficha antiga com a posição nova dos documentos.
  const migrando = rankingEnviado.get('__formato') !== FORMATO_ENVIO;
  const ontem = diaSp(agora - 86_400_000);
  const mudaram: { chave: string; dados: unknown; texto: string }[] = [];
  let np = 0;
  for (const [cid, dados] of Object.entries(pilotos as unknown as Record<string, { recentes?: { dia?: string }[] }>)) {
    const texto = hashDe(JSON.stringify(dados));
    if (rankingEnviado.get(cid) === texto) continue;
    if (migrando && !(dados.recentes ?? []).some((r) => String(r.dia ?? '') >= ontem)) rankingEnviado.set(cid, texto);
    else mudaram.push({ chave: 'piloto:' + cid, dados, texto });
    // cede o event loop: dezenas de milhares de hashes por ciclo
    if ((++np & 511) === 511) await new Promise<void>((r) => setImmediate(r));
  }
  for (let i = 0; i < mudaram.length; i += 400) {
    const parte = mudaram.slice(i, i + 400);
    await enviar(parte.map(({ chave, dados }) => ({ chave, dados })));
    for (const l of parte) rankingEnviado.set(l.chave.slice('piloto:'.length), l.texto);
  }
  // 3) fichas que deixaram de existir (ex.: cadastro duplicado unificado em outro): apaga no app para não aparecer na busca
  const sumiram = [...rankingEnviado.keys()].filter((k) => /^\d{1,12}$/.test(k) && !(k in (pilotos as object)));
  for (let i = 0; i < sumiram.length; i += 500) {
    const parte = sumiram.slice(i, i + 500);
    await enviar([], parte.map((cid) => 'piloto:' + cid));
    for (const cid of parte) rankingEnviado.delete(cid);
  }
  if (migrando) rankingEnviado.set('__formato', FORMATO_ENVIO);
  rankingVersao = versao;
  rankingDia = dia;
  salvar();
  if (docs.length || mudaram.length) log(`app: ranking publicado (${mudaram.length} piloto(s), ${docs.length} documento(s) de posição/ranking)`);
  return mudaram.length;
}

// ---------------------------------------------------------------- cadastros existentes (cadastro do app reconhece o piloto)
// Uma vez por dia: código do CPF (HMAC com a chave de administração; não volta ao CPF) e o e-mail mascarado. O app usa no
// cadastro para dizer "você já é piloto aqui; use o e-mail p•••@gmail.com para trazer seu histórico". Vai para o R2.
const CLIENTES_INTERVALO_MS = 24 * 3_600_000;
// em disco: reiniciar o servidor não pode reenviar os 134 mil cadastros (trava o event loop em horário aberto)
const ARQ_CLIENTES = resolve(join(process.cwd(), '.runtime', 'clientes-app-ultima.txt'));
let clientesUltimaVez = (() => { try { return Number(readFileSync(ARQ_CLIENTES, 'utf8')) || 0; } catch { return 0; } })();
const mascarar = (email: string) => {
  const [u, d] = email.trim().toLowerCase().split('@');
  return u && d ? `${u[0]}•••@${d}` : null;
};
export async function publicarClientesDoApp(log: Log, agora = Date.now()) {
  if (!vinculoAutomaticoLigado() || agora - clientesUltimaVez < CLIENTES_INTERVALO_MS) return 0;
  clientesUltimaVez = agora;
  const base = mobileApiEndpoint(process.env.MOBILE_IDENTITY_LINK_URL!, '/api/mobile/v1/internal/identity-links');
  if (!base) return 0;
  const token = process.env.MOBILE_ADMIN_TOKEN!;
  const linhas = await query<{ doc: string; email: string | null }>(
    `SELECT DocumentoNum doc, Email email FROM dbo.Cliente
      WHERE ResponsavelId IS NULL AND LEN(DocumentoNum) = 11 ORDER BY AtualizadoEm ASC`,
  );
  const mapa = new Map<string, string | null>();
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    const codigo = createHmac('sha256', token).update('cpf:' + l.doc).digest('hex').slice(0, 32);
    const m = l.email && l.email.includes('@') ? mascarar(l.email) : null;
    if (m || !mapa.has(codigo)) mapa.set(codigo, m); // o mais recente com e-mail vence
    // cede o event loop a cada 1024 linhas: 134 mil HMACs seguidos travavam o servidor por ~21 s (medido em 28/10/2026)
    if ((i & 1023) === 1023) await new Promise<void>((r) => setImmediate(r));
  }
  // stringify em blocos (mesma saída): o stringify unico de 134 mil pares tambem travava o loop
  const pares: string[] = [];
  let n = 0;
  for (const [k, v] of mapa) {
    pares.push(JSON.stringify([k, v]));
    if ((++n & 8191) === 8191) await new Promise<void>((r) => setImmediate(r));
  }
  const r = await fetch(new URL('/api/mobile/v1/ranking/interno/clientes', base), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-mobile-admin-token': token },
    body: '{"itens":[' + pares.join(',') + ']}',
    redirect: 'error',
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok) { clientesUltimaVez = agora - CLIENTES_INTERVALO_MS + 15 * 60_000; throw new Error(`cadastros do app: HTTP ${r.status}`); }
  try { writeFileSync(ARQ_CLIENTES, String(agora)); } catch { /* sem o arquivo só publica de novo no próximo início */ }
  log(`app: ${mapa.size} cadastro(s) publicados para o reconhecimento no cadastro do app`);
  return mapa.size;
}

// ---------------------------------------------------------------- perfil do app (dados do cadastro, editáveis pelo piloto)
// A cada 30 s: busca no worker as alterações que pilotos pediram pelo app (telefone, nascimento, gênero, peso, tipo
// sanguíneo e endereço), grava no cadastro e publica o perfil de volta. Também publica o perfil de quem tem conta
// ligada e ainda não tem perfil no app (ou está com mais de 1 dia). Nome, CPF e e-mail não mudam por aqui.
const PERFIL_INTERVALO_MS = 30_000;
const EDITAVEIS = ['telefone', 'nascimento', 'sexo', 'peso', 'tipoSanguineo', 'cep', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado'] as const;
let perfilUltimaVez = 0;
export async function sincronizarPerfisDoApp(log: Log, agora = Date.now()) {
  if (!vinculoAutomaticoLigado() || agora - perfilUltimaVez < PERFIL_INTERVALO_MS) return 0;
  perfilUltimaVez = agora;
  const base = mobileApiEndpoint(process.env.MOBILE_IDENTITY_LINK_URL!, '/api/mobile/v1/internal/identity-links');
  if (!base) return 0;
  const destino = new URL('/api/mobile/v1/internal/perfil', base);
  const headers = { 'content-type': 'application/json', 'x-mobile-admin-token': process.env.MOBILE_ADMIN_TOKEN! };
  const r = await fetch(destino, { headers, redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`perfil do app: HTTP ${r.status}`);
  const { itens } = await r.json() as { itens: { cliente: string; pedido: Record<string, unknown> | null }[] };
  if (!itens.length) return 0;
  const saida: { cliente: string; perfil: unknown; aplicado: boolean; erro: string | null }[] = [];
  let aplicados = 0;
  for (const it of itens) {
    const id = Number(it.cliente);
    if (!Number.isSafeInteger(id)) continue;
    let erro: string | null = null, aplicado = false;
    if (it.pedido) {
      const input: ClienteInput = {};
      for (const k of EDITAVEIS) if (k in it.pedido) (input as Record<string, unknown>)[k] = it.pedido[k];
      try { await updateCliente(id, input, true); aplicado = true; aplicados++; } catch (e) { erro = 'Não foi possível salvar agora. Tente de novo ou fale com a recepção.'; log(`app: perfil ${id} não gravado (${(e as Error).message})`); }
    }
    const c = await one<Record<string, unknown>>(`SELECT ${CLIENTE_COLS} FROM dbo.Cliente c WHERE c.Id = @id`, { id });
    if (!c) continue;
    const doc = String(c.documento ?? '');
    saida.push({
      cliente: it.cliente, aplicado, erro,
      perfil: {
        nome: c.nome, email: c.email, documento: doc.length >= 11 ? `•••.${doc.replace(/\D/g, '').slice(3, 6)}.•••-${doc.replace(/\D/g, '').slice(-2)}` : null,
        telefone: c.telefone, nascimento: c.nascimento, sexo: c.sexo, peso: c.peso, tipoSanguineo: c.tipoSanguineo,
        cep: c.cep, endereco: c.endereco, numero: c.numero, complemento: c.complemento, bairro: c.bairro, cidade: c.cidade, estado: c.estado,
        clienteDesde: c.criadoEm,
      },
    });
  }
  for (let i = 0; i < saida.length; i += 50) {
    const p = await fetch(destino, { method: 'POST', headers, body: JSON.stringify({ itens: saida.slice(i, i + 50) }), redirect: 'error', signal: AbortSignal.timeout(15_000) });
    if (!p.ok) throw new Error(`perfil do app: HTTP ${p.status}`);
  }
  if (aplicados) log(`app: ${aplicados} perfil(is) alterado(s) pelo app gravado(s) no cadastro`);
  return saida.length;
}
