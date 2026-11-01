/**
 * Regras do endurance (regulamento das 100 Milhas Light de Betim) calculadas a partir das voltas da cronometragem.
 *
 * O transponder e a placa são da EQUIPE (passam de kart em kart na troca), então cada competidor da corrida na
 * cronometragem é uma equipe. A parada é achada pelo decoder: a volta do box é muito mais longa que as outras; o tempo
 * da parada é essa volta menos a volta normal da equipe (ou a volta inteira, conforme `medidaParada`).
 *
 * Tudo aqui é puro (sem banco nem rede) para poder testar com corridas montadas à mão.
 */

export type Regras = {
  duracaoMin: number;
  pesoMinKg: number;
  lastroMaxKg: number;
  /** punição por cada 500 g abaixo do peso mínimo */
  punicaoSegPor500g: number;
  /** abaixo do mínimo até este tanto = punição de tempo; mais que isso = kart desclassificado */
  deficitMaxKg: number;
  /** pesagem abaixo disto em qualquer momento = equipe desclassificada */
  dqEquipeAbaixoKg: number;
  paradasObrigatorias: number;
  paradasMax: number;
  paradaMinMs: number;
  /** parada entre este tempo e o mínimo vale, mas com punição de `punicaoFaixaSeg` */
  faixaPunicaoMs: number;
  punicaoFaixaSeg: number;
  voltasPorParadaFaltante: number;
  boxAbreMin: number;
  boxFechaMin: number;
  /** volta acima disto (e pelo menos 40% da parada mínima acima da volta normal) é volta do box */
  limiarParadaMs: number;
  /** tempo adicional de trânsito no pit lane (entrada/saída e velocidade reduzida) a descontar da parada */
  pitTransitDeltaMs?: number;
  /** médias só com voltas até este tempo (tira volta de bandeira amarela, box, rodada) */
  voltaLimpaMaxMs: number;
  medidaParada: 'volta-menos-media' | 'volta';
  fileiras: number;
  pilotosMin: number;
  pilotosMax: number;
  radarBomPct: number;
  radarMedioPct: number;
  mediaVoltas: number;
};

export const REGRAS_100_MILHAS: Regras = {
  duracaoMin: 150,
  pesoMinKg: 90,
  lastroMaxKg: 50,
  punicaoSegPor500g: 60,
  deficitMaxKg: 2,
  dqEquipeAbaixoKg: 85,
  paradasObrigatorias: 3,
  paradasMax: 5,
  paradaMinMs: 7 * 60_000,
  faixaPunicaoMs: 6 * 60_000 + 55_000,
  punicaoFaixaSeg: 15,
  voltasPorParadaFaltante: 7,
  boxAbreMin: 5,
  boxFechaMin: 130,
  limiarParadaMs: 100_000,
  voltaLimpaMaxMs: 90_000,
  medidaParada: 'volta-menos-media',
  fileiras: 4,
  pilotosMin: 1,
  pilotosMax: 3,
  radarBomPct: 40,
  radarMedioPct: 30,
  mediaVoltas: 10,
};

export function lerRegras(json: string | null | undefined): Regras {
  let r: Partial<Regras> = {};
  try { r = json ? JSON.parse(json) : {}; } catch { r = {}; }
  const out = { ...REGRAS_100_MILHAS };
  for (const k of Object.keys(out) as (keyof Regras)[]) {
    const v = r[k];
    if (k === 'medidaParada') { if (v === 'volta' || v === 'volta-menos-media') out.medidaParada = v; continue; }
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

// ------------------------------------------------------------------ peso

export type AvaliacaoPeso = { resultado: 'ok' | 'punicao' | 'dq'; deficitKg: number; punicaoSeg: number; dqEquipe: boolean; mensagem: string };

const kg = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + ' kg';

export function avaliarPeso(totalKg: number, r: Regras): AvaliacaoPeso {
  const deficit = Math.round((r.pesoMinKg - totalKg) * 1000) / 1000;
  const dqEquipe = totalKg < r.dqEquipeAbaixoKg;
  if (deficit <= 0) return { resultado: 'ok', deficitKg: 0, punicaoSeg: 0, dqEquipe: false, mensagem: `Peso OK: ${kg(totalKg)} (mínimo ${kg(r.pesoMinKg)}).` };
  if (deficit > r.deficitMaxKg) {
    return {
      resultado: 'dq', deficitKg: deficit, punicaoSeg: 0, dqEquipe,
      mensagem: `${kg(deficit)} abaixo do mínimo: kart DESCLASSIFICADO, não pode voltar à pista${dqEquipe ? ` (abaixo de ${kg(r.dqEquipeAbaixoKg)}: equipe desclassificada)` : ''}.`,
    };
  }
  // 1 minuto a cada 500 g (ou fração) abaixo
  const blocos = Math.ceil(deficit / 0.5 - 1e-9);
  const seg = blocos * r.punicaoSegPor500g;
  return { resultado: 'punicao', deficitKg: deficit, punicaoSeg: seg, dqEquipe, mensagem: `${kg(deficit)} abaixo do mínimo: punição de ${seg / 60} min.` };
}

/** Lastro para chegar ao peso mínimo, em passos de 0,5 kg. */
export function lastroNecessario(pesoPilotoKg: number, r: Regras) {
  const falta = Math.max(0, r.pesoMinKg - pesoPilotoKg);
  const lastro = Math.max(0, Math.ceil(falta * 2 - 1e-9) / 2) || 0;
  return { lastroKg: lastro, acimaDoLimite: lastro > r.lastroMaxKg };
}

// ------------------------------------------------------------------ sorteio da fileira (bolinhas 1..N)

export function sortearFileira(filas: Map<number, string[]>, bola: number | null, aleatorio: () => number = Math.random) {
  const comKart = [...filas.entries()].filter(([, k]) => k.length > 0).map(([f]) => f).sort((a, b) => a - b);
  if (!comKart.length) throw new Error('Não há kart nas fileiras do box.');
  if (bola != null) {
    if (!filas.get(bola)?.length) throw new Error(`A fileira ${bola} está vazia. Sorteie outra bolinha.`);
    return { fileira: bola, kart: filas.get(bola)![0] };
  }
  const f = comKart[Math.min(comKart.length - 1, Math.floor(aleatorio() * comKart.length))];
  return { fileira: f, kart: filas.get(f)![0] };
}

// ------------------------------------------------------------------ corrida

export type VoltaCrono = {
  lap: number;
  lapMs: number | null;
  invalid?: boolean;
  wallMs: number;
  underYellow?: boolean;
  flag?: string | null;
  pitStopExplicit?: boolean;
  transponder?: string | number | null;
  kart?: string | null;
  originalKart?: string | null;
};
export type EquipeIn = { id: number; numero: string; nome: string; desclassificada?: boolean };
export type TrocaIn = { equipeId: number; pilotoId: number | null; pilotoNome: string | null; kart: string | null; tipo: string; emMs: number };
export type PunicaoIn = { equipeId: number; tipo: 'segundos' | 'voltas' | 'advertencia' | 'dq'; valor: number; motivo: string; origem?: string };
export type AjusteIn = { equipeId: number; volta: number; acao: 'quebra' | 'invalidar' | 'ignorar' | 'validar' };
export type SessaoIn = { startedAt: number | null; elapsedMs: number; durationMs: number; state: string; currentFlag?: string; nome?: string };

export type Parada = {
  volta: number;
  inicioMs: number; // hora (relógio) em que entrou no box (começo da volta do box)
  minutoDeProva: number;
  voltaMs: number;
  tempoMs: number;
  situacao: 'valida' | 'valida_punida' | 'rapida' | 'ignorada';
  quebra: boolean;
  foraDaJanela: boolean;
  ajuste: AjusteIn['acao'] | null;
  perdidoMs: number; // tempo além do mínimo
};

export type Stint = {
  indice: number;
  voltaIni: number;
  voltaFim: number;
  voltas: number;
  mediaMs: number | null;
  melhorMs: number | null;
  tempoMs: number;
  piloto: string | null;
  pilotoId: number | null;
  kart: string | null;
  emAndamento: boolean;
};

export type Alerta = { nivel: 'info' | 'aviso' | 'grave'; texto: string };

export type EquipeAnalise = {
  id: number; numero: string; nome: string;
  voltas: number;
  ultimaPassagemMs: number | null;
  tempoTotalMs: number | null;
  ultimaMs: number | null;
  melhorMs: number | null;
  melhorVolta: number | null;
  mediaMs: number | null; // média das últimas N voltas limpas
  mediaTotalMs: number | null;
  posPista: number;
  posOficial: number;
  difLiderMs: number | null; difLiderVoltas: number;
  difFrenteMs: number | null; difFrenteVoltas: number;
  difMediaLiderMs: number | null;
  paradas: Parada[];
  paradasValidas: number;
  paradasTotal: number;
  paradasFaltando: number;
  tempoPerdidoMs: number;
  mediaParadasMs: number | null;
  stints: Stint[];
  pilotoAtual: string | null;
  kartAtual: string | null;
  tempoNoStintMs: number | null;
  noBox: boolean;
  radar: 'bom' | 'medio' | 'ruim' | null;
  punicaoSeg: number;
  voltasPerdidas: number;
  voltasPerdidasPrevistas: number; // inclui as paradas que faltam (só valem no fim)
  desclassificada: boolean;
  motivosDq: string[];
  alertas: Alerta[];
  projecaoVoltas: number | null;
  posProjecao: number | null;
  ultrapassagem: number[]; // posição prevista daqui a 0..10 voltas
};

export type Analise = {
  agoraMs: number;
  sessao: SessaoIn | null;
  restanteMs: number | null;
  minutoDeProva: number | null;
  boxAberto: boolean;
  boxTexto: string;
  melhorVolta: { ms: number; numero: string; volta: number } | null;
  melhorMedia: { ms: number; numero: string } | null;
  equipes: EquipeAnalise[];
};

const mediana = (v: number[]) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

export function analisarCorrida(input: {
  regras: Regras;
  sessao: SessaoIn | null;
  equipes: EquipeIn[];
  voltas: Map<string, VoltaCrono[]>; // por número da equipe
  trocas: TrocaIn[];
  punicoes: PunicaoIn[];
  ajustes: AjusteIn[];
  agoraMs: number;
}): Analise {
  const { regras: r, sessao, agoraMs } = input;
  const inicio = sessao?.startedAt ?? null;
  const elapsed = sessao?.elapsedMs ?? 0;
  const encerrada = sessao ? ['encerrada', 'bandeira_final'].includes(sessao.state) : false;
  const correndo = sessao?.state === 'em_andamento' && inicio != null;
  const minuto = inicio != null ? elapsed / 60_000 : null;
  const boxAberto = minuto != null && !encerrada && minuto >= r.boxAbreMin && minuto < r.boxFechaMin && sessao?.currentFlag !== 'red';
  const boxTexto = minuto == null ? `Box abre aos ${r.boxAbreMin} min de prova` : sessao?.currentFlag === 'red' ? 'Box FECHADO (bandeira vermelha)'
    : minuto < r.boxAbreMin ? `Box abre em ${Math.ceil(r.boxAbreMin - minuto)} min` : minuto < r.boxFechaMin ? `Box ABERTO · fecha em ${Math.ceil(r.boxFechaMin - minuto)} min` : 'Box FECHADO';
  const durationMs = sessao?.durationMs || r.duracaoMin * 60_000;
  const restanteMs = inicio != null ? Math.max(0, durationMs - elapsed) : null;

  // referência geral para quem ainda não tem volta limpa
  const voltaSobBandeira = (v: VoltaCrono) => Boolean(v.underYellow || v.flag === 'yellow' || v.flag === 'red');
  const todasLimpas: number[] = [];
  for (const vs of input.voltas.values()) for (const v of vs) if (v.lapMs != null && v.lapMs <= r.voltaLimpaMaxMs && !v.invalid && !voltaSobBandeira(v)) todasLimpas.push(v.lapMs);
  const refGeral = mediana(todasLimpas) ?? 65_000;

  // tempos por número de volta na bateria para detectar safety car / bandeira amarela global
  const temposPorVolta = new Map<number, number[]>();
  const listasDaBateria = input.equipes.length
    ? input.equipes.map((eq) => input.voltas.get(eq.numero) ?? [])
    : [...new Set(input.voltas.values())];
  for (const vs of listasDaBateria) {
    const validas = vs.filter((v) => v.lapMs != null && v.lapMs > 0).sort((a, b) => a.wallMs - b.wallMs);
    validas.forEach((v, idx) => {
      const num = v.lap || idx + 1;
      const arr = temposPorVolta.get(num) ?? [];
      arr.push(v.lapMs as number);
      temposPorVolta.set(num, arr);
    });
  }

  const eqs: EquipeAnalise[] = input.equipes.map((e) => {
    const voltas = (input.voltas.get(e.numero) ?? []).filter((v) => v.lapMs != null && v.lapMs > 0).sort((a, b) => a.wallMs - b.wallMs);
    const limpas = voltas.filter((v) => (v.lapMs as number) <= r.voltaLimpaMaxMs && !v.invalid && !voltaSobBandeira(v));
    const refEquipe = mediana(limpas.map((v) => v.lapMs as number)) ?? refGeral;
    const ajustes = new Map(input.ajustes.filter((a) => a.equipeId === e.id).map((a) => [a.volta, a.acao]));
    const trocasEq = input.trocas.filter((t) => t.equipeId === e.id).sort((a, b) => a.emMs - b.emMs);
    const alertas: Alerta[] = [];
    const motivosDq: string[] = [];

    // paradas pelo decoder
    const paradas: Parada[] = [];
    voltas.forEach((v, i) => {
      const lapMs = v.lapMs as number;
      const numVolta = v.lap || i + 1;
      const ajuste = ajustes.get(i + 1) ?? ajustes.get(numVolta) ?? null;
      const minDelta = Math.max(35_000, Math.round(r.paradaMinMs * 0.4));
      if ((lapMs < r.limiarParadaMs || lapMs < refEquipe + minDelta) && ajuste !== 'validar' && ajuste !== 'quebra' && ajuste !== 'invalidar') return;
      const inicioMs = v.wallMs - lapMs;
      const prev = i > 0 ? voltas[i - 1] : null;
      const teveTroca = Boolean(
        (prev && v.transponder != null && prev.transponder != null && String(v.transponder) !== String(prev.transponder))
        || (prev && v.kart != null && prev.kart != null && String(v.kart) !== String(prev.kart))
        || (v.originalKart != null && String(v.originalKart) !== String(v.kart ?? e.numero))
        || trocasEq.some((t) => t.tipo !== 'largada' && t.emMs >= inicioMs - 10_000 && t.emMs <= v.wallMs + 10_000 && (inicio == null || t.emMs > inicio + 5_000)),
      );
      const temposNaVolta = temposPorVolta.get(numVolta) ?? [];
      const medVolta = mediana(temposNaVolta);
      const limiarSafetyCar = Math.min(r.limiarParadaMs, Math.max(r.voltaLimpaMaxMs, refGeral * 1.35));
      const medianaSubiuAbruptamente = temposNaVolta.length >= 2 && medVolta != null && (
        temposNaVolta.length >= 3
          ? medVolta >= limiarSafetyCar
          : Math.min(...temposNaVolta) >= limiarSafetyCar && (Math.max(...temposNaVolta) - Math.min(...temposNaVolta)) < minDelta
      );
      if ((voltaSobBandeira(v) || medianaSubiuAbruptamente) && !v.pitStopExplicit && !teveTroca && ajuste !== 'validar' && ajuste !== 'quebra' && ajuste !== 'invalidar') {
        return;
      }
      const transit = r.pitTransitDeltaMs ?? 0;
      const tempo = r.medidaParada === 'volta' ? lapMs : Math.max(0, lapMs - refEquipe - transit);
      const min = inicio != null ? (inicioMs - inicio) / 60_000 : 0;
      const fora = inicio != null && (min < r.boxAbreMin - 0.05 || min > r.boxFechaMin);
      let situacao: Parada['situacao'] = tempo >= r.paradaMinMs ? 'valida' : tempo >= r.faixaPunicaoMs ? 'valida_punida' : 'rapida';
      if (ajuste === 'ignorar') situacao = 'ignorada';
      else if (ajuste === 'invalidar') situacao = 'rapida';
      else if (ajuste === 'validar' && situacao === 'rapida') situacao = 'valida';
      paradas.push({
        volta: i + 1, inicioMs, minutoDeProva: Math.round(min * 10) / 10, voltaMs: lapMs, tempoMs: Math.round(tempo), situacao,
        quebra: ajuste === 'quebra', foraDaJanela: fora, ajuste, perdidoMs: situacao === 'valida' || situacao === 'valida_punida' ? Math.max(0, Math.round(tempo - r.paradaMinMs)) : 0,
      });
    });
    const contam = paradas.filter((p) => p.situacao !== 'ignorada');
    const validas = contam.filter((p) => p.situacao === 'valida' || p.situacao === 'valida_punida').length;
    const faltando = Math.max(0, r.paradasObrigatorias - validas);
    for (const p of contam) {
      if (p.situacao === 'valida_punida') alertas.push({ nivel: 'aviso', texto: `Parada da volta ${p.volta} com ${fmtMs(p.tempoMs)}: vale, mas +${r.punicaoFaixaSeg} s.` });
      if (p.foraDaJanela && !p.quebra) alertas.push({ nivel: 'grave', texto: `Parada na volta ${p.volta} com o box fechado: só vale se foi quebra (confirme no box), senão o kart é desclassificado.` });
    }
    if (contam.length > r.paradasMax) { motivosDq.push(`${contam.length} paradas (máximo ${r.paradasMax})`); }
    else if (contam.length === r.paradasMax) alertas.push({ nivel: 'aviso', texto: `Já fez ${r.paradasMax} paradas: a próxima desclassifica.` });

    // punições
    let punicaoSeg = contam.filter((p) => p.situacao === 'valida_punida').length * r.punicaoFaixaSeg;
    let voltasPerdidas = 0;
    for (const p of input.punicoes.filter((x) => x.equipeId === e.id)) {
      if (p.tipo === 'segundos') punicaoSeg += p.valor;
      else if (p.tipo === 'voltas') voltasPerdidas += p.valor;
      else if (p.tipo === 'dq') motivosDq.push(p.motivo);
    }
    const advertencias = input.punicoes.filter((x) => x.equipeId === e.id && x.tipo === 'advertencia').length;
    if (advertencias >= 3) motivosDq.push(`${advertencias} advertências de pista`);
    if (e.desclassificada && !motivosDq.length) motivosDq.push('desclassificada pela direção de prova');
    const voltasFaltantes = faltando * r.voltasPorParadaFaltante;

    // stints (entre as paradas) com piloto e kart pelas trocas registradas no box
    const trocas = input.trocas.filter((t) => t.equipeId === e.id).sort((a, b) => a.emMs - b.emMs);
    const quemEm = (ms: number) => { let t: TrocaIn | null = null; for (const x of trocas) if (x.emMs <= ms + 90_000) t = x; return t; };
    const cortes = contam.map((p) => p.volta);
    const stints: Stint[] = [];
    let ini = 1;
    for (const corte of [...cortes, voltas.length + 1]) {
      const fim = corte - 1;
      const doStint = voltas.slice(ini - 1, Math.max(ini - 1, fim));
      const lim = doStint.filter((v) => (v.lapMs as number) <= r.voltaLimpaMaxMs && !v.invalid).map((v) => v.lapMs as number);
      const comecoMs = ini === 1 ? (inicio ?? voltas[0]?.wallMs ?? 0) : (voltas[ini - 2]?.wallMs ?? 0);
      const t = quemEm(comecoMs);
      const aberto = corte === voltas.length + 1;
      if (doStint.length || aberto) {
        stints.push({
          indice: stints.length + 1, voltaIni: ini, voltaFim: Math.max(ini - 1, fim), voltas: doStint.length,
          mediaMs: media(lim), melhorMs: lim.length ? Math.min(...lim) : null, tempoMs: doStint.reduce((a, v) => a + (v.lapMs as number), 0),
          piloto: t?.pilotoNome ?? null, pilotoId: t?.pilotoId ?? null, kart: t?.kart ?? null, emAndamento: aberto && !encerrada,
        });
      }
      ini = corte + 1;
    }
    const ultima = voltas[voltas.length - 1];
    const atual = trocas[trocas.length - 1] ?? null;
    const ultimoStint = stints[stints.length - 1];
    const comecoStint = ultimoStint ? (ultimoStint.voltaIni === 1 ? inicio : voltas[ultimoStint.voltaIni - 2]?.wallMs ?? null) : null;
    const lims = limpas.map((v) => v.lapMs as number);
    const mediaN = media(lims.slice(-r.mediaVoltas));
    const melhor = lims.length ? Math.min(...lims) : null;
    const desdeUltima = ultima ? agoraMs - ultima.wallMs : null;
    const noBox = correndo && desdeUltima != null && desdeUltima > Math.max(2.5 * (mediaN ?? refEquipe), 150_000);

    return {
      id: e.id, numero: e.numero, nome: e.nome,
      voltas: voltas.length,
      ultimaPassagemMs: ultima?.wallMs ?? null,
      tempoTotalMs: ultima && inicio != null ? ultima.wallMs - inicio : null,
      ultimaMs: ultima?.lapMs ?? null,
      melhorMs: melhor,
      melhorVolta: melhor != null ? voltas.findIndex((v) => v.lapMs === melhor && !v.invalid) + 1 : null,
      mediaMs: mediaN, mediaTotalMs: media(lims),
      posPista: 0, posOficial: 0,
      difLiderMs: null, difLiderVoltas: 0, difFrenteMs: null, difFrenteVoltas: 0, difMediaLiderMs: null,
      paradas, paradasValidas: validas, paradasTotal: contam.length, paradasFaltando: faltando,
      tempoPerdidoMs: contam.reduce((a, p) => a + p.perdidoMs, 0),
      mediaParadasMs: media(contam.filter((p) => p.situacao !== 'rapida').map((p) => p.tempoMs)),
      stints,
      pilotoAtual: atual?.pilotoNome ?? null, kartAtual: atual?.kart ?? null,
      tempoNoStintMs: comecoStint != null && !encerrada ? Math.max(0, agoraMs - comecoStint) : null,
      noBox, radar: null,
      punicaoSeg, voltasPerdidas: voltasPerdidas + (encerrada ? voltasFaltantes : 0), voltasPerdidasPrevistas: voltasPerdidas + voltasFaltantes,
      desclassificada: motivosDq.length > 0, motivosDq, alertas,
      projecaoVoltas: null, posProjecao: null, ultrapassagem: [],
    } satisfies EquipeAnalise;
  });

  // posição na pista: mais voltas, depois quem passou antes
  const naPista = [...eqs].sort((a, b) => b.voltas - a.voltas || (a.ultimaPassagemMs ?? Infinity) - (b.ultimaPassagemMs ?? Infinity));
  const passagemNaVolta = (e: EquipeAnalise, volta: number) => (input.voltas.get(e.numero) ?? []).filter((v) => v.lapMs != null && v.lapMs > 0).sort((a, b) => a.wallMs - b.wallMs)[volta - 1]?.wallMs ?? null;
  naPista.forEach((e, i) => {
    e.posPista = i + 1;
    const dif = (outro: EquipeAnalise) => {
      if (!e.voltas || !outro.voltas) return { ms: null, voltas: 0 };
      const v = outro.voltas - e.voltas;
      if (v > 0) return { ms: null, voltas: v };
      const t = passagemNaVolta(outro, e.voltas);
      return { ms: t != null && e.ultimaPassagemMs != null ? e.ultimaPassagemMs - t : null, voltas: 0 };
    };
    if (i > 0) {
      const l = dif(naPista[0]); e.difLiderMs = l.ms; e.difLiderVoltas = l.voltas;
      const f = dif(naPista[i - 1]); e.difFrenteMs = f.ms; e.difFrenteVoltas = f.voltas;
    }
  });

  // classificação oficial: desclassificadas no fim; voltas menos as perdidas; tempo + punições
  const oficial = [...eqs].sort((a, b) =>
    Number(a.desclassificada) - Number(b.desclassificada)
    || (b.voltas - b.voltasPerdidas) - (a.voltas - a.voltasPerdidas)
    || ((a.tempoTotalMs ?? Infinity) + a.punicaoSeg * 1000) - ((b.tempoTotalMs ?? Infinity) + b.punicaoSeg * 1000));
  oficial.forEach((e, i) => { e.posOficial = i + 1; });

  // radar do box: última volta comparada com as outras equipes (kart bom / médio / ruim)
  const comUltima = eqs.filter((e) => e.ultimaMs != null && e.ultimaMs <= r.voltaLimpaMaxMs).sort((a, b) => (a.ultimaMs as number) - (b.ultimaMs as number));
  comUltima.forEach((e, i) => {
    const pct = ((i + 1) / comUltima.length) * 100;
    e.radar = pct <= r.radarBomPct ? 'bom' : pct <= r.radarBomPct + r.radarMedioPct ? 'medio' : 'ruim';
  });

  const comMedia = eqs.filter((e) => e.mediaMs != null);
  const melhorMediaEq = comMedia.sort((a, b) => (a.mediaMs as number) - (b.mediaMs as number))[0];
  for (const e of eqs) if (e.mediaMs != null && melhorMediaEq) e.difMediaLiderMs = e.mediaMs - (melhorMediaEq.mediaMs as number);

  // projeção final: voltas que ainda cabem no tempo, descontando as paradas obrigatórias que faltam
  if (restanteMs != null && inicio != null) {
    for (const e of eqs) {
      const ritmo = e.mediaMs ?? e.mediaTotalMs ?? refGeral;
      if (!e.voltas || !ritmo) continue;
      const custoParada = r.medidaParada === 'volta' ? r.paradaMinMs : r.paradaMinMs + ritmo;
      const disponivel = restanteMs + (agoraMs - (e.ultimaPassagemMs ?? agoraMs)) - e.paradasFaltando * custoParada;
      e.projecaoVoltas = Math.round((e.voltas + Math.max(0, disponivel) / ritmo + 1 - e.voltasPerdidas) * 10) / 10;
    }
    [...eqs].filter((e) => e.projecaoVoltas != null).sort((a, b) => Number(a.desclassificada) - Number(b.desclassificada) || (b.projecaoVoltas as number) - (a.projecaoVoltas as number))
      .forEach((e, i) => { e.posProjecao = i + 1; });
  }

  // ultrapassagem futura: tempo "equivalente" de cada equipe andando no ritmo da média das últimas voltas
  const ref = melhorMediaEq?.mediaMs ?? refGeral;
  const base = eqs.filter((e) => e.voltas > 0 && e.ultimaPassagemMs != null && inicio != null);
  for (let k = 0; k <= 10; k++) {
    const eqv = base.map((e) => ({ e, t: ((e.ultimaPassagemMs as number) - (inicio as number)) - e.voltas * ref + k * ((e.mediaMs ?? ref) - ref) }))
      .sort((a, b) => a.t - b.t);
    eqv.forEach((x, i) => { x.e.ultrapassagem[k] = i + 1; });
  }

  let melhorVolta: Analise['melhorVolta'] = null;
  for (const e of eqs) if (e.melhorMs != null && (!melhorVolta || e.melhorMs < melhorVolta.ms)) melhorVolta = { ms: e.melhorMs, numero: e.numero, volta: e.melhorVolta ?? 0 };

  return {
    agoraMs, sessao, restanteMs, minutoDeProva: minuto != null ? Math.floor(minuto) : null, boxAberto, boxTexto,
    melhorVolta, melhorMedia: melhorMediaEq ? { ms: melhorMediaEq.mediaMs as number, numero: melhorMediaEq.numero } : null,
    equipes: oficial,
  };
}

/** Desempenho de cada kart físico (para a organização tirar do sorteio o que destoa — item 6.4). */
export function desempenhoDosKarts(a: Analise) {
  const porKart = new Map<string, { kart: string; voltas: number; somaMs: number; melhorMs: number | null; equipes: Set<string> }>();
  for (const e of a.equipes) for (const s of e.stints) {
    if (!s.kart || s.mediaMs == null || !s.voltas) continue;
    const k = porKart.get(s.kart) ?? { kart: s.kart, voltas: 0, somaMs: 0, melhorMs: null, equipes: new Set<string>() };
    k.voltas += s.voltas; k.somaMs += s.mediaMs * s.voltas;
    if (s.melhorMs != null && (k.melhorMs == null || s.melhorMs < k.melhorMs)) k.melhorMs = s.melhorMs;
    k.equipes.add(e.numero);
    porKart.set(s.kart, k);
  }
  const lista = [...porKart.values()].map((k) => ({ kart: k.kart, voltas: k.voltas, mediaMs: k.somaMs / k.voltas, melhorMs: k.melhorMs, equipes: [...k.equipes] }))
    .sort((x, y) => x.mediaMs - y.mediaMs);
  const ref = lista.length ? lista[0].mediaMs : 0;
  return lista.map((k) => ({ ...k, difMs: k.mediaMs - ref }));
}

export function fmtMs(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms)) return '—';
  const neg = ms < 0; ms = Math.abs(Math.round(ms));
  const m = Math.floor(ms / 60_000), s = Math.floor((ms % 60_000) / 1000), mil = ms % 1000;
  return `${neg ? '-' : ''}${m}:${String(s).padStart(2, '0')}.${String(mil).padStart(3, '0')}`;
}
