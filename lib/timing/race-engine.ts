/** Motor de cronometragem sem IO: passagens, bandeiras, correcoes e classificacao. */

export type SessionType = 'treino' | 'classificacao' | 'corrida';
export type SessionState = 'preparando' | 'em_andamento' | 'bandeira_final' | 'encerrada' | 'cancelada';
export type RaceFlag = 'none' | 'green' | 'yellow' | 'red' | 'white' | 'checkered';
/** Bandeiras só para um piloto (sinalização): preta, preta com círculo laranja (mecânico), preta e branca (advertência), azul (deixe passar), penalidade. */
export type PilotFlag = 'black' | 'mechanical' | 'warning' | 'blue' | 'penalty';

export type Crossing = {
  id?: string;
  decoderTimeMs: number;
  wallMs: number;
  /** tempo da volta que ESTA passagem fecha (null na primeira passagem) */
  lapMs: number | null;
  invalid?: boolean;
  deleted?: boolean;
  source?: 'decoder' | 'manual';
  transponder?: number | null;
  originalKart?: string;
};

export type Observation = { id: string; text: string; wallMs: number; author?: string };

/** Dados do "Registro de competidor" (Competidor do canvas). Não mexem na contagem de voltas. */
export type CompetidorDetalhes = {
  sexo?: string; iniciais?: string; email?: string; patrocinador?: string; clube?: string; cidade?: string; estado?: string; pais?: string;
  box?: string; peso?: number | null; pesoIndumentaria?: number | null; pesoLastro?: number | null; pontuacao?: number | null;
  /** some da classificação e dos relatórios (continua contando as voltas) */
  oculto?: boolean;
  /** provas de revezamento: nomes do 2º, 3º... piloto */
  equipe?: string[];
};

export type Competitor = {
  kart: string;
  name: string;
  customerId?: string | null;
  category?: string | null;
  detalhes?: CompetidorDetalhes;
  autoAdded?: boolean;
  flag?: RaceFlag | PilotFlag;
  crossings: Crossing[];
  finished: boolean;
};

export type Session = {
  id: string;
  name: string;
  type: SessionType;
  durationMs: number;
  maxLaps: number | null;
  minLapMs: number;
  state: SessionState;
  createdAt: number;
  /** hora da largada = primeira passagem contada depois da bandeira verde (null até lá) */
  startedAt: number | null;
  /** hora em que o operador deu a bandeira verde (a bateria fica armada esperando o 1º kart) */
  greenAt?: number | null;
  checkeredAt: number | null;
  finishedAt: number | null;
  /** hora em que o tempo programado acabou: só avisa, quem dá a quadriculada e encerra é o cronometrista */
  timeUpAt?: number | null;
  currentFlag?: RaceFlag;
  redFlagAt?: number | null;
  redFlagElapsedMs?: number | null;
  eventId?: string | null;
  groupId?: string | null;
  proofId?: string | null;
  /** baterias criadas juntas do mesmo programa da agenda (ex.: Tomada de tempo + Corrida) */
  programaId?: string | null;
  /** bateria da agenda da recepção de onde a prova foi criada (tablet do sorteio) */
  agendaId?: number | null;
  /** minutos de pista de cada kart já enviados ao controle de manutenção da oficina (servidor da operação) */
  usoKartsEnviado?: boolean;
  /** e-mail do resultado para os pilotos (automático ao encerrar tomada de tempo/corrida, ou reenvio manual) */
  emailsResultado?: EnvioEmailsResultado;
  observations?: Observation[];
  competitors: Competitor[];
  /** Leituras do decoder que não viraram volta (volta mínima, kart encerrado, transponder desconhecido...). Só pra mostrar ao operador. */
  rejected?: RejectedPassing[];
};

export type EnvioEmailsResultado = {
  /** enviado = todos com e-mail receberam; parcial = alguns falharam (tenta de novo); falhou = nenhum foi (tenta de novo);
   *  sem-destinatarios = ninguém da prova tem e-mail cadastrado; desligado = envio automático desativado quando encerrou */
  status: 'enviado' | 'parcial' | 'falhou' | 'sem-destinatarios' | 'desligado';
  atualizadoEm: number;
  tentativas: number;
  /** "kart|email" de quem já recebeu (não manda de novo na nova tentativa) */
  enviados: string[];
  falhas: { kart: string; nome: string; email: string; erro: string }[];
  semEmail: { kart: string; nome: string }[];
};

export type RejectedPassing = { id: string; kart: string | null; transponder: number | null; wallMs: number; decoderTimeMs: number; reason: string; sinceLastMs: number | null };

export type Standing = {
  position: number;
  kart: string;
  name: string;
  category: string | null;
  laps: number;
  lastLapMs: number | null;
  bestLapMs: number | null;
  bestLapNumber: number | null;
  totalMs: number | null;
  averageSpeedKmh: number | null;
  /** corrida: diferença pro líder (ms) ou voltas; treino/classificação: diferença de melhor volta */
  gapMs: number | null;
  gapLaps: number;
  finished: boolean;
  autoAdded: boolean;
  lastCrossingWallMs: number | null;
};

const DAY_MS = 86_400_000;
/** Diferença aceitável entre o relógio do decoder e o do servidor numa volta (atraso de rede). */
const DECODER_CLOCK_TOLERANCE_MS = 3_000;

export function createSession(input: {
  id: string;
  name: string;
  type: SessionType;
  durationMin: number;
  maxLaps?: number | null;
  minLapSec?: number;
  now: number;
  competitors?: { kart: string; name: string; customerId?: string | null; category?: string | null }[];
  eventId?: string | null;
  groupId?: string | null;
  proofId?: string | null;
  programaId?: string | null;
}): Session {
  return {
    id: input.id,
    name: input.name.trim() || defaultName(input.type),
    type: input.type,
    durationMs: Math.max(0, Math.round(input.durationMin * 60_000)),
    maxLaps: input.maxLaps && input.maxLaps > 0 ? input.maxLaps : null,
    minLapMs: Math.round((input.minLapSec ?? 5) * 1000),
    state: 'preparando',
    createdAt: input.now,
    startedAt: null,
    greenAt: null,
    checkeredAt: null,
    finishedAt: null,
    currentFlag: 'none',
    redFlagAt: null,
    redFlagElapsedMs: null,
    eventId: input.eventId ?? null,
    groupId: input.groupId ?? null,
    proofId: input.proofId ?? null,
    programaId: input.programaId ?? null,
    observations: [],
    competitors: dedupeKarts(input.competitors ?? []).map((c) => ({
      kart: c.kart,
      name: c.name.trim(),
      customerId: c.customerId ?? null,
      category: c.category ?? null,
      crossings: [],
      finished: false,
    })),
  };
}

export function updateSessionParameters(
  session: Session,
  parameters: { name?: string; durationMin?: number; maxLaps?: number | null },
  now: number,
) {
  const updatesRules = parameters.durationMin !== undefined || parameters.maxLaps !== undefined;
  if (updatesRules && !['preparando', 'em_andamento', 'encerrada'].includes(session.state)) {
    throw new Error('Duração e limite de voltas não podem ser alterados neste estado da bateria.');
  }

  let durationMs: number | undefined;
  if (parameters.durationMin !== undefined) {
    if (!Number.isFinite(parameters.durationMin) || parameters.durationMin < 0) {
      throw new Error('A duração deve ser um número igual ou maior que zero.');
    }
    durationMs = Math.round(parameters.durationMin * 60_000);
  }

  let maxLaps: number | null | undefined;
  if (parameters.maxLaps !== undefined) {
    if (parameters.maxLaps !== null && (!Number.isInteger(parameters.maxLaps) || parameters.maxLaps < 0)) {
      throw new Error('O limite de voltas deve ser um número inteiro igual ou maior que zero.');
    }
    maxLaps = parameters.maxLaps && parameters.maxLaps > 0 ? parameters.maxLaps : null;
  }

  if (typeof parameters.name === 'string') session.name = parameters.name.trim() || session.name;
  if (durationMs !== undefined && durationMs !== session.durationMs) {
    session.durationMs = durationMs;
    session.timeUpAt = null;
  }
  if (maxLaps !== undefined) session.maxLaps = maxLaps;

  if (session.state === 'em_andamento' && session.maxLaps !== null) {
    const leader = computeStandings(session)[0];
    if (leader && leader.laps >= session.maxLaps) setRaceFlag(session, 'checkered', now);
  }
}

function defaultName(type: SessionType) {
  return type === 'corrida' ? 'Corrida' : type === 'classificacao' ? 'Tomada de Tempo' : 'Treino';
}

/** Linha sem piloto de verdade: nome vazio ou o "Kart 12" que o sistema cria quando o kart entra sozinho. */
export function semPilotoNome(kart: string, name: string | null | undefined) {
  const n = String(name ?? '').trim().toLowerCase();
  return !n || n === `kart ${String(kart).trim().toLowerCase()}`;
}

/**
 * Um piloto por kart. Piloto sem kart ainda (veio da agenda) fica, desde que tenha nome.
 * Kart repetido: fica a linha com piloto. Na troca de kart o kart novo quase sempre já passou na linha
 * e virou "Kart 12"; quando o operador põe 12 no piloto, a linha "Kart 12" sai e as passagens dela vão
 * para o piloto (setCompetitors).
 */
function dedupeKarts<T extends { kart: string; name?: string }>(list: T[]): T[] {
  const porKart = new Map<string, T>();
  for (const c of list) {
    const k = String(c.kart).trim();
    if (!k) continue;
    const atual = porKart.get(k);
    if (!atual || (semPilotoNome(k, atual.name) && !semPilotoNome(k, c.name))) porKart.set(k, c);
  }
  return list.filter((c) => {
    const k = String(c.kart).trim();
    return k ? porKart.get(k) === c : Boolean(c.name?.trim());
  });
}

/**
 * Troca a lista de competidores mantendo o histórico de cada PILOTO (não do número do kart):
 * - o piloto é reconhecido pelo cliente, depois pelo nome e por último pelo kart;
 * - troca de kart: as voltas do kart anterior continuam com o piloto no kart novo;
 * - se o kart novo já estava na pista sem piloto ("Kart 12", entrou sozinho), as passagens dele
 *   se juntam ao histórico do piloto;
 * - dois pilotos que trocam de kart entre si levam cada um as próprias voltas.
 */
export type TrocaDeKart = { nome: string; de: string; para: string; voltasLevadas: number; passagensJuntadas: number };

export function setCompetitors(session: Session, list: { kart: string; name: string; customerId?: string | null; category?: string | null; detalhes?: CompetidorDetalhes }[]): TrocaDeKart[] {
  const previous = session.competitors;
  const trocas: TrocaDeKart[] = [];
  const used = new Set<Competitor>();
  const nome = (n: string | null | undefined) => String(n ?? '').trim().toLowerCase();
  const semPiloto = (c: Competitor) => Boolean(c.autoAdded) || semPilotoNome(c.kart, c.name);
  const novos = dedupeKarts(list);
  const achar = (pred: (o: Competitor) => boolean) => previous.find((o) => !used.has(o) && pred(o));

  // 1ª passada: reconhece cada piloto da lista nova na lista antiga
  const matches = novos.map((c) => {
    const cid = c.customerId ? String(c.customerId) : '';
    const n = nome(c.name);
    const old =
      (cid ? achar((o) => String(o.customerId ?? '') === cid) : undefined) ??
      (n && n !== `kart ${nome(c.kart)}` ? achar((o) => !semPiloto(o) && nome(o.name) === n) : undefined);
    if (old) used.add(old);
    return old;
  });
  // 2ª passada: quem não foi reconhecido pelo piloto herda pelo número do kart (ex.: só corrigiu o nome)
  novos.forEach((c, i) => {
    if (matches[i] || !c.kart) return;
    const old = achar((o) => o.kart === c.kart);
    if (old) { used.add(old); matches[i] = old; }
  });

  session.competitors = novos.map((c, i) => {
    const old = matches[i];
    const kartMudou = Boolean(old?.kart && old.kart !== c.kart);
    // Clona as passagens ao mudar de kart. Além de evitar que uma referência antiga seja
    // reaproveitada por engano, registra de qual kart veio cada leitura no histórico.
    const crossings = (old?.crossings ?? []).map((x) => kartMudou && old?.kart && !x.originalKart
      ? { ...x, originalKart: old.kart }
      : { ...x });
    // trocou de kart: junta as passagens que o kart novo já tinha sem piloto
    let passagensJuntadas = 0;
    if (c.kart && kartMudou) {
      const orfao = achar((o) => o.kart === c.kart && semPiloto(o));
      if (orfao) {
        used.add(orfao);
        crossings.push(...orfao.crossings.map((x) => ({ ...x })));
        passagensJuntadas = orfao.crossings.length;
      }
      if (old?.kart) trocas.push({ nome: c.name.trim(), de: old.kart, para: c.kart, voltasLevadas: Math.max(0, old.crossings.filter((x) => !x.deleted).length - 1), passagensJuntadas });
    }
    crossings.sort((a, b) => a.wallMs - b.wallMs);
    const competitor: Competitor = {
      kart: c.kart,
      name: c.name.trim(),
      customerId: c.customerId ?? old?.customerId ?? null,
      category: c.category ?? old?.category ?? null,
      ...(c.detalhes ?? old?.detalhes ? { detalhes: c.detalhes ?? old?.detalhes } : {}),
      autoAdded: false,
      flag: old?.flag ?? 'none',
      crossings,
      finished: old?.finished ?? false,
    };
    if (kartMudou || crossings.length !== (old?.crossings.length ?? 0)) recalculate(competitor);
    // a volta que junta os dois karts tem a parada da troca dentro: conta como volta, mas não vale
    // como melhor volta; idem qualquer volta curta demais criada pela junção
    if (kartMudou && passagensJuntadas && old) {
      const chave = (x: Crossing) => `${x.wallMs}|${x.decoderTimeMs}|${x.transponder ?? ''}`;
      const antigos = new Set(old.crossings.map(chave));
      const ativos = activeCrossings(competitor);
      ativos.forEach((x, i) => {
        if (i === 0 || antigos.has(chave(x))) return;
        const juncao = antigos.has(chave(ativos[i - 1]));
        if (juncao || (x.lapMs !== null && x.lapMs < session.minLapMs)) x.invalid = true;
      });
    }
    return competitor;
  });
  // Leituras rejeitadas também fazem parte do histórico mostrado ao operador. Quando o
  // piloto troca de kart, elas precisam seguir o mesmo vínculo das passagens contadas.
  for (const troca of trocas) for (const rejeitada of session.rejected ?? []) if (rejeitada.kart === troca.de) rejeitada.kart = troca.para;
  return trocas;
}

export type TrocaDeKartInput = {
  fromKart: string;
  toKart: string;
  customerId?: string | null;
  name?: string | null;
  category?: string | null;
  detalhes?: CompetidorDetalhes;
};

/** Troca atômica usada pelo operador. O vínculo é feito pelo piloto e pelo kart atual,
 * nunca pelo índice visual da grade, que pode mudar com a ordenação ou com novas leituras. */
export function swapKart(session: Session, input: TrocaDeKartInput): TrocaDeKart {
  const fromKart = String(input.fromKart ?? '').trim();
  const toKart = String(input.toKart ?? '').trim();
  if (!fromKart || !toKart) throw new Error('Informe o kart atual e o kart novo.');
  if (fromKart === toKart) throw new Error('O piloto já está nesse kart.');

  const candidatos = session.competitors.filter((c) => c.kart === fromKart && !semPilotoNome(c.kart, c.name) && !c.autoAdded);
  if (!candidatos.length) throw new Error(`Nenhum piloto real está no kart ${fromKart}.`);
  const cid = input.customerId == null ? '' : String(input.customerId).trim();
  const n = String(input.name ?? '').trim().toLowerCase();
  const origem = (cid ? candidatos.find((c) => String(c.customerId ?? '') === cid) : undefined)
    ?? (n ? candidatos.find((c) => c.name.trim().toLowerCase() === n) : undefined)
    ?? candidatos[0];

  const dono = session.competitors.find((c) => c !== origem && c.kart === toKart);
  if (dono && !semPilotoNome(dono.kart, dono.name) && !dono.autoAdded)
    throw new Error(`O kart ${toKart} já está com ${dono.name}.`);

  const trocas = setCompetitors(session, session.competitors.filter((c) => c !== dono).map((c) => c === origem
    ? {
      kart: toKart,
      name: String(input.name ?? '').trim() || c.name,
      customerId: input.customerId === undefined ? c.customerId ?? null : input.customerId,
      category: input.category === undefined ? c.category ?? null : input.category,
      detalhes: input.detalhes ?? c.detalhes,
    }
    : {
      kart: c.kart,
      name: c.name,
      customerId: c.customerId ?? null,
      category: c.category ?? null,
      detalhes: c.detalhes,
    }));
  const troca = trocas.find((t) => t.de === fromKart && t.para === toKart);
  if (!troca) throw new Error('A troca não pôde ser aplicada ao histórico da bateria.');
  return troca;
}

/** Mesma bateria da agenda (Tomada de tempo + Corrida...). Baterias antigas sem programaId: mesmo nome
 *  antes do " · " e criadas no mesmo minuto (é assim que o programa de provas cria). */
export function mesmoPrograma(a: Session, b: Session) {
  if (a.id === b.id) return false;
  if (a.programaId || b.programaId) return Boolean(a.programaId) && a.programaId === b.programaId;
  const base = (n: string) => { const i = n.lastIndexOf(' · '); return i > 0 ? n.slice(0, i).trim().toLowerCase() : null; };
  const ba = base(a.name);
  return ba !== null && ba === base(b.name) && Math.abs(a.createdAt - b.createdAt) <= 2 * 60_000;
}

/** Copia pilotos e números dos karts para outra bateria do mesmo programa que ainda não largou. */
export function copiarCompetidores(destino: Session, origem: Session) {
  if (destino.state !== 'preparando') return false;
  setCompetitors(destino, origem.competitors.map((c) => ({ kart: c.kart, name: c.name, customerId: c.customerId ?? null, category: c.category ?? null, detalhes: c.detalhes })));
  return true;
}

export function startSession(session: Session, now: number) {
  if (session.state !== 'preparando') throw new Error('A bateria já foi iniciada.');
  session.state = 'em_andamento';
  // o cronômetro só começa quando o primeiro kart cruzar a linha (igual ao LapTime)
  session.greenAt = now;
  session.startedAt = null;
  session.currentFlag = 'green';
}

/** Bateria com bandeira verde mas nenhum kart passou ainda: o cronômetro está parado em zero. */
export function aguardandoLargada(session: Session) {
  return session.state === 'em_andamento' && session.startedAt === null;
}

function largarNaPrimeiraPassagem(session: Session, wallMs: number) {
  if (session.state === 'em_andamento' && session.startedAt === null) session.startedAt = wallMs;
}

export function elapsedMs(session: Session, now: number): number {
  if (session.startedAt === null) return 0;
  if (session.redFlagAt != null) return Math.max(0, session.redFlagElapsedMs ?? (session.redFlagAt - session.startedAt));
  return Math.max(0, (session.finishedAt ?? now) - session.startedAt);
}

export function setRaceFlag(session: Session, flag: Exclude<RaceFlag, 'none'>, now: number) {
  if (flag === 'green' && session.state === 'preparando') return startSession(session, now);
  if (session.state !== 'em_andamento' && session.state !== 'bandeira_final') throw new Error('A bateria precisa estar em andamento.');
  if (flag === 'red') {
    if (session.redFlagAt == null) {
      session.redFlagElapsedMs = elapsedMs(session, now);
      session.redFlagAt = now;
    }
    session.currentFlag = 'red';
    return;
  }
  if (session.redFlagAt != null) {
    const frozenElapsed = session.redFlagElapsedMs ?? 0;
    // vermelha antes do primeiro kart passar: continua esperando a largada
    if (session.startedAt !== null) session.startedAt = now - frozenElapsed;
    session.redFlagAt = null;
    session.redFlagElapsedMs = null;
  }
  session.currentFlag = flag;
  if (flag === 'checkered') checkered(session, now);
}

export function checkered(session: Session, now: number) {
  if (session.state !== 'em_andamento') return;
  session.state = 'bandeira_final';
  session.checkeredAt = now;
  session.currentFlag = 'checkered';
}

export function closeSession(session: Session, now: number) {
  if (session.state === 'encerrada' || session.state === 'cancelada') return;
  if (session.state === 'preparando') {
    session.state = 'cancelada';
  } else {
    session.state = 'encerrada';
    session.checkeredAt ??= now;
    session.currentFlag = 'checkered';
  }
  session.finishedAt = now;
  session.redFlagAt = null;
}

export function cancelSession(session: Session, now: number) {
  session.state = 'cancelada';
  session.finishedAt = now;
  session.redFlagAt = null;
}

export type PassingResult = 'counted' | 'ignored-state' | 'ignored-min-lap' | 'ignored-finished' | 'ignored-red-flag';

function activeCrossings(competitor: Competitor) {
  return competitor.crossings.filter((x) => !x.deleted).sort((a, b) => a.wallMs - b.wallMs);
}

function lapDuration(previous: Crossing, current: Crossing) {
  if (current.source === 'manual' && current.lapMs !== null) return current.lapMs;
  // Depois de uma passagem manual, o relógio do decoder não foi sincronizado
  // com o valor digitado. Use o intervalo real entre os registros no diário.
  if (previous.source === 'manual') return Math.max(0, current.wallMs - previous.wallMs);
  let ms = current.decoderTimeMs - previous.decoderTimeMs;
  if (ms < 0) ms += DAY_MS;
  // O relógio do decoder é zerado a cada conexão (@RESET + ?;;;11;). Se a conexão caiu no
  // meio da prova, a diferença pelo decoder deixa de fazer sentido: usa o intervalo real.
  const wall = current.wallMs - previous.wallMs;
  if (wall > 0 && Math.abs(ms - wall) > DECODER_CLOCK_TOLERANCE_MS) return wall;
  return ms;
}

function recalculate(competitor: Competitor) {
  const active = activeCrossings(competitor);
  let previous: Crossing | null = null;
  active.forEach((crossing, i) => {
    if (i === 0 || previous === null) crossing.lapMs = null;
    else if (crossing.source !== 'manual' || crossing.lapMs === null) crossing.lapMs = lapDuration(previous, crossing);
    previous = crossing;
  });
}

/** Aplica uma passagem já renumerada. Karts fora do grid entram sozinhos (autoAdded). */
export function applyPassing(session: Session, p: { id?: string; kart: string; decoderTimeMs: number; wallMs: number; transponder?: number | null; source?: 'decoder' | 'manual' }): PassingResult {
  if (session.state !== 'em_andamento' && session.state !== 'bandeira_final') return 'ignored-state';
  if (session.redFlagAt != null || session.currentFlag === 'red') return 'ignored-red-flag';

  let comp = session.competitors.find((c) => c.kart === p.kart);
  if (!comp) {
    if (session.state === 'bandeira_final') return 'ignored-state';
    comp = { kart: p.kart, name: `Kart ${p.kart}`, autoAdded: true, flag: 'none', crossings: [], finished: false };
    session.competitors.push(comp);
  }
  if (comp.finished) return 'ignored-finished';

  const active = activeCrossings(comp);
  const last = active[active.length - 1];
  const lapMs = last ? lapDuration(last, { decoderTimeMs: p.decoderTimeMs, wallMs: p.wallMs, lapMs: null }) : null;
  if (lapMs !== null && lapMs < session.minLapMs) return 'ignored-min-lap';

  largarNaPrimeiraPassagem(session, p.wallMs);
  comp.crossings.push({ id: p.id, decoderTimeMs: p.decoderTimeMs, wallMs: p.wallMs, lapMs, source: p.source ?? 'decoder', transponder: p.transponder ?? null });
  recalculate(comp);

  const laps = activeCrossings(comp).length - 1;
  if (session.state === 'bandeira_final' && lapMs !== null) {
    comp.finished = true;
  } else if (session.state === 'em_andamento' && session.maxLaps && laps >= session.maxLaps) {
    comp.finished = true;
    checkered(session, p.wallMs);
  }

  return 'counted';
}

/** Inclui uma volta manual usando o tempo informado, sem depender do decoder. */
export function includeManualPassing(session: Session, p: { id: string; kart: string; lapMs: number; wallMs: number; name?: string; transponder?: number | null }) {
  if (!p.kart.trim()) throw new Error('Informe o número do kart.');
  if (!Number.isFinite(p.lapMs) || p.lapMs < session.minLapMs) throw new Error(`O tempo manual deve ser de pelo menos ${session.minLapMs / 1000} segundos.`);
  let competitor = session.competitors.find((c) => c.kart === p.kart);
  if (!competitor) {
    competitor = { kart: p.kart, name: p.name?.trim() || `Kart ${p.kart}`, flag: 'none', crossings: [], finished: false };
    session.competitors.push(competitor);
  }
  if (session.state === 'em_andamento') largarNaPrimeiraPassagem(session, p.wallMs);
  const active = activeCrossings(competitor);
  const previous = active[active.length - 1];
  const decoderTimeMs = previous ? (previous.decoderTimeMs + p.lapMs) % DAY_MS : (p.wallMs % DAY_MS);
  competitor.crossings.push({ id: p.id, decoderTimeMs, wallMs: p.wallMs, lapMs: previous ? p.lapMs : null, source: 'manual', transponder: p.transponder ?? null });
  recalculate(competitor);
  return competitor.crossings.find((x) => x.id === p.id)!;
}

export function locateCrossing(session: Session, id: string) {
  for (const competitor of session.competitors) {
    const crossing = competitor.crossings.find((x) => x.id === id);
    if (crossing) return { competitor, crossing };
  }
  return null;
}

export function setCrossingDeleted(session: Session, id: string, deleted: boolean) {
  const found = locateCrossing(session, id);
  if (!found) throw new Error('Passagem não encontrada.');
  found.crossing.deleted = deleted;
  recalculate(found.competitor);
  found.competitor.finished = false;
  return found;
}

export function setCrossingInvalid(session: Session, id: string, invalid: boolean) {
  const found = locateCrossing(session, id);
  if (!found) throw new Error('Passagem não encontrada.');
  if (found.crossing.lapMs === null) throw new Error('A primeira passagem do kart não fecha uma volta.');
  found.crossing.invalid = invalid;
  return found;
}

/** Transfere uma passagem para outro kart; o vínculo original permite cancelar a atribuição. */
export function assignCrossing(session: Session, id: string, kart: string | null, name?: string) {
  const found = locateCrossing(session, id);
  if (!found) throw new Error('Passagem não encontrada.');
  if (kart !== null && !kart.trim()) throw new Error('Informe o número do competidor.');
  if (!kart) {
    if (!found.crossing.originalKart) throw new Error('A passagem não tem atribuição para cancelar.');
    kart = found.crossing.originalKart;
  } else if (!found.crossing.originalKart) {
    found.crossing.originalKart = found.competitor.kart;
  }
  if (found.competitor.kart === kart) return found;
  found.competitor.crossings = found.competitor.crossings.filter((x) => x !== found.crossing);
  recalculate(found.competitor);
  let target = session.competitors.find((c) => c.kart === kart);
  if (!target) {
    target = { kart, name: name?.trim() || `Kart ${kart}`, flag: 'none', crossings: [], finished: false };
    session.competitors.push(target);
  }
  target.crossings.push(found.crossing);
  recalculate(target);
  return { competitor: target, crossing: found.crossing };
}

export function clearCrossings(session: Session) {
  for (const competitor of session.competitors) {
    for (const crossing of competitor.crossings) crossing.deleted = true;
    competitor.finished = false;
  }
}

/**
 * Chamado periodicamente. Nunca dá a quadriculada nem encerra a bateria sozinho: quando o tempo
 * programado acaba só marca timeUpAt (true = mudou, avisar as telas). A quadriculada e o
 * encerramento são sempre do cronometrista.
 */
export function tick(session: Session, now: number): boolean {
  if (session.state !== 'em_andamento' || session.timeUpAt != null) return false;
  if (session.durationMs <= 0 || session.startedAt === null || session.redFlagAt != null) return false;
  if (elapsedMs(session, now) < session.durationMs) return false;
  session.timeUpAt = now;
  return true;
}

/** O tempo programado já acabou e a prova segue esperando a quadriculada do cronometrista. */
export function timeIsUp(session: Session, now: number): boolean {
  return session.state === 'em_andamento' && session.durationMs > 0 && session.startedAt !== null && elapsedMs(session, now) >= session.durationMs;
}

export function toggleLapInvalid(session: Session, kart: string, lapNumber: number) {
  const comp = session.competitors.find((c) => c.kart === kart);
  const crossing = comp ? activeCrossings(comp)[lapNumber] : undefined;
  if (!crossing || crossing.lapMs === null) throw new Error('Volta não encontrada.');
  crossing.invalid = !crossing.invalid;
}

export function remainingMs(session: Session, now: number): number | null {
  if (!session.durationMs || session.startedAt === null) return session.durationMs || null;
  if (session.state !== 'em_andamento') return 0;
  return Math.max(0, session.durationMs - elapsedMs(session, now));
}

function compareCrossings(a?: Crossing | null, b?: Crossing | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  if (
    a.source !== 'manual' &&
    b.source !== 'manual' &&
    typeof a.decoderTimeMs === 'number' &&
    typeof b.decoderTimeMs === 'number'
  ) {
    let diff = a.decoderTimeMs - b.decoderTimeMs;
    if (diff > DAY_MS / 2) diff -= DAY_MS;
    else if (diff < -DAY_MS / 2) diff += DAY_MS;

    const wallDiff = a.wallMs - b.wallMs;
    if (wallDiff === 0 || Math.abs(diff - wallDiff) <= DECODER_CLOCK_TOLERANCE_MS) {
      if (diff !== 0) return diff;
    }
  }
  return a.wallMs - b.wallMs;
}

export function computeStandings(session: Session, trackLengthMeters = 1_000): Standing[] {
  const rows = session.competitors.map((c, gridIndex) => {
    const crossings = activeCrossings(c);
    const laps = Math.max(0, crossings.length - 1);
    const firstCrossing = crossings[0] ?? null;
    const lastCrossing = crossings[crossings.length - 1] ?? null;

    const validLaps: { lapNumber: number; lapMs: number; wallMs: number }[] = [];
    crossings.forEach((x, i) => {
      if (i > 0 && x.lapMs !== null && !x.invalid) {
        validLaps.push({ lapNumber: i, lapMs: x.lapMs, wallMs: x.wallMs });
      }
    });

    validLaps.sort((a, b) => a.lapMs - b.lapMs);
    const best = validLaps[0]?.lapMs ?? null;
    const bestN = validLaps[0]?.lapNumber ?? null;
    const bestWall = validLaps[0]?.wallMs ?? null;
    const best2nd = validLaps[1]?.lapMs ?? null;
    const best3rd = validLaps[2]?.lapMs ?? null;

    let total: number | null = null;
    if (firstCrossing && lastCrossing && laps > 0) {
      total = crossings.slice(1).reduce((sum, crossing) => sum + (crossing.lapMs ?? 0), 0);
    }

    return {
      c,
      gridIndex,
      crossings,
      firstCrossing,
      lastCrossing,
      laps,
      best,
      bestN,
      bestWall,
      best2nd,
      best3rd,
      lastLap: lastCrossing?.lapMs ?? null,
      total,
      averageSpeed: total && total > 0 ? (laps * trackLengthMeters * 3_600) / total : null,
      lastWall: lastCrossing?.wallMs ?? null,
    };
  });

  if (session.type === 'corrida') {
    rows.sort((a, b) => {
      // 1. Mais voltas completadas vem na frente
      if (b.laps !== a.laps) return b.laps - a.laps;

      // 2. Na mesma volta (> 0): quem completou a volta primeiro na pista
      if (a.laps > 0) {
        const arrival = compareCrossings(a.lastCrossing, b.lastCrossing);
        if (arrival !== 0) return arrival;
      }

      // 3. Nenhuma volta completada ainda (laps === 0):
      // Quem já abriu volta na pista (passou no sensor na largada) vem antes de quem não passou
      if (a.crossings.length !== b.crossings.length) {
        return b.crossings.length - a.crossings.length;
      }
      if (a.crossings.length > 0) {
        const arrival = compareCrossings(a.firstCrossing, b.firstCrossing);
        if (arrival !== 0) return arrival;
      }

      // 4. Ordem inicial do grid
      return a.gridIndex - b.gridIndex;
    });
  } else {
    rows.sort((a, b) => {
      // 1. Quem tem volta válida vem na frente de quem não tem
      if ((a.best === null) !== (b.best === null)) {
        return a.best === null ? 1 : -1;
      }

      // 2. Ambos têm volta válida: menor tempo de volta
      if (a.best !== null && b.best !== null) {
        if (a.best !== b.best) return a.best - b.best;

        // Desempate 1: 2ª melhor volta
        if (a.best2nd !== null && b.best2nd !== null && a.best2nd !== b.best2nd) {
          return a.best2nd - b.best2nd;
        }
        if ((a.best2nd === null) !== (b.best2nd === null)) {
          return a.best2nd === null ? 1 : -1;
        }

        // Desempate 2: 3ª melhor volta
        if (a.best3rd !== null && b.best3rd !== null && a.best3rd !== b.best3rd) {
          return a.best3rd - b.best3rd;
        }
        if ((a.best3rd === null) !== (b.best3rd === null)) {
          return a.best3rd === null ? 1 : -1;
        }

        // Desempate 3: quem marcou a melhor volta antes na cronologia
        if (a.bestWall !== null && b.bestWall !== null && a.bestWall !== b.bestWall) {
          return a.bestWall - b.bestWall;
        }

        return a.gridIndex - b.gridIndex;
      }

      // 3. Nenhum tem volta válida: mais voltas completadas (ex: voltas anuladas)
      if (b.laps !== a.laps) return b.laps - a.laps;

      // Quem já abriu volta na pista
      if (a.crossings.length !== b.crossings.length) {
        return b.crossings.length - a.crossings.length;
      }
      if (a.crossings.length > 0) {
        const arrival = compareCrossings(a.firstCrossing, b.firstCrossing);
        if (arrival !== 0) return arrival;
      }

      // Ordem inicial
      return a.gridIndex - b.gridIndex;
    });
  }

  const leader = rows[0];
  return rows.map((r, i) => {
    let gapMs: number | null = null;
    let gapLaps = 0;
    if (i > 0 && leader) {
      if (session.type === 'corrida') {
        gapLaps = leader.laps - r.laps;
        if (gapLaps === 0 && leader.laps > 0 && r.lastCrossing && leader.lastCrossing) {
          const diff = compareCrossings(r.lastCrossing, leader.lastCrossing);
          gapMs = Math.max(0, diff);
        }
      } else if (r.best !== null && leader.best !== null) {
        gapMs = r.best - leader.best;
      }
    }
    return {
      position: i + 1,
      kart: r.c.kart,
      name: r.c.name,
      category: r.c.category ?? null,
      laps: r.laps,
      lastLapMs: r.lastLap,
      bestLapMs: r.best,
      bestLapNumber: r.bestN,
      totalMs: r.total,
      averageSpeedKmh: r.averageSpeed,
      gapMs,
      gapLaps,
      finished: r.c.finished,
      autoAdded: Boolean(r.c.autoAdded),
      lastCrossingWallMs: r.lastWall,
    };
  });
}

export function formatLap(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '--';
  const totalSec = ms / 1000;
  const m = Math.floor(totalSec / 60);
  const s = totalSec - m * 60;
  return m > 0 ? `${m}:${s.toFixed(3).padStart(6, '0')}` : s.toFixed(3);
}

/**
 * Operador restaurou uma leitura que tinha sido ignorada (ex.: abaixo da volta mínima), como o
 * "restaurar volta excluída" do LapTime: entra na ordem cronológica e as voltas são recalculadas.
 */
export function acceptRejected(session: Session, r: RejectedPassing) {
  if (!r.kart) throw new Error('Transponder desconhecido: atribua a passagem a um kart antes.');
  let comp = session.competitors.find((c) => c.kart === r.kart);
  if (!comp) {
    comp = { kart: r.kart, name: `Kart ${r.kart}`, autoAdded: true, flag: 'none', crossings: [], finished: false };
    session.competitors.push(comp);
  }
  comp.crossings.push({ id: r.id, decoderTimeMs: r.decoderTimeMs, wallMs: r.wallMs, lapMs: null, source: 'decoder', transponder: r.transponder });
  recalculate(comp);
  session.rejected = (session.rejected ?? []).filter((x) => x.id !== r.id);
}
