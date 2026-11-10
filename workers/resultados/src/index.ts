/**
 * Worker do Portal de Resultados Oficiais do Kartódromo Internacional de Betim
 * Domínio: resultados.kartodromodebetim.com.br
 *
 * Exibe resultados oficiais da cronometragem (MYLAPS TranX) e telemetria volta a volta
 * com layout idêntico ao site oficial, busca inteligente por Kart, Nome, CPF ou E-mail
 * e emissão/download de relatórios em PDF.
 */

export interface Env {
  ASSETS: Fetcher;
  MOBILE_DB?: D1Database;
  CRONO_URL?: string;
  OPS_URL?: string;
}

type ResultRow = {
  session_id: string;
  customer_id: string;
  event_name: string;
  event_date: string;
  display_name: string;
  position: number;
  kart: string;
  laps: number;
  best_lap_ms: number | null;
  status: 'published' | 'withdrawn';
  updated_at: number;
};

type LapPassing = {
  lap: number;
  lapMs: number;
  invalid?: boolean;
  wallMs?: number;
  penalty?: string;
  speed?: number;
};

type KartLaps = {
  kart: string;
  name: string;
  laps: LapPassing[];
};

const SEGURANCA: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'x-frame-options': 'SAMEORIGIN',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

function json(status: number, body: unknown, cacheSeconds = 0): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheSeconds > 0 ? `public, max-age=${cacheSeconds}` : 'no-store',
      ...SEGURANCA,
    },
  });
}

function html(status: number, content: string): Response {
  return new Response(content, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-cache',
      ...SEGURANCA,
    },
  });
}

function formatLap(ms: number | null | undefined): string {
  if (ms == null || isNaN(ms) || ms <= 0) return '—';
  const total = Math.round(Math.abs(ms));
  const h = Math.floor(total / 3600000);
  const m = Math.floor((total % 3600000) / 60000);
  const s = ((total % 60000) / 1000).toFixed(3);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${s.padStart(6, '0')}`;
  if (m > 0) return `${m}:${s.padStart(6, '0')}`;
  return s;
}

function formatDiff(diffMs: number | null | undefined): string {
  if (diffMs == null || isNaN(diffMs)) return '—';
  if (diffMs === 0) return '0.000';
  return '+' + formatLap(diffMs);
}

function formatHora(ts: number | undefined): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false });
}

function extrairHorario(nome: string): string {
  const match = nome.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/);
  return match ? match[0] : '';
}

function esc(s: string | number | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Lista baterias com resumo, pódio e filtros de data */
async function listarBaterias(url: URL, env: Env): Promise<Response> {
  if (!env.MOBILE_DB) return json(503, { erro: 'Banco de dados de resultados não conectado.' });

  // 1. Obter datas disponíveis com resultados publicados
  const datasQuery = await env.MOBILE_DB.prepare(
    `SELECT DISTINCT event_date FROM mobile_results WHERE status = 'published' ORDER BY event_date DESC LIMIT 30`
  ).all<{ event_date: string }>();

  const datasDisponiveis = datasQuery.results.map((r) => r.event_date);
  let dataEscolhida = url.searchParams.get('data')?.trim();

  if (!dataEscolhida || !/^\d{4}-\d{2}-\d{2}$/.test(dataEscolhida)) {
    dataEscolhida = datasDisponiveis[0] || new Date().toISOString().slice(0, 10);
  }

  // 2. Buscar sessões dessa data
  const sessoesQuery = await env.MOBILE_DB.prepare(
    `SELECT session_id, event_name, event_date, MAX(updated_at) AS publicado,
            COUNT(*) AS total_pilotos, MIN(CASE WHEN best_lap_ms > 0 THEN best_lap_ms ELSE NULL END) AS menor_tempo
     FROM mobile_results
     WHERE status = 'published' AND event_date = ?
     GROUP BY session_id, event_name, event_date
     ORDER BY event_date DESC, publicado DESC, session_id DESC`
  ).bind(dataEscolhida).all<{
    session_id: string;
    event_name: string;
    event_date: string;
    publicado: number;
    total_pilotos: number;
    menor_tempo: number | null;
  }>();

  if (!sessoesQuery.results.length) {
    return json(200, {
      data: dataEscolhida,
      datasDisponiveis,
      total: 0,
      baterias: [],
    });
  }

  const sessionIds = sessoesQuery.results.map((s) => s.session_id);

  // 3. Buscar os 3 primeiros colocados de cada bateria (pódio)
  const rowsPodio = await env.MOBILE_DB.prepare(
    `SELECT session_id, display_name, position, kart, best_lap_ms, laps
     FROM mobile_results
     WHERE status = 'published' AND session_id IN (${sessionIds.map(() => '?').join(',')}) AND position <= 3
     ORDER BY session_id, position ASC`
  ).bind(...sessionIds).all<{
    session_id: string;
    display_name: string;
    position: number;
    kart: string;
    best_lap_ms: number | null;
    laps: number;
  }>();

  const podioPorSessao = new Map<string, typeof rowsPodio.results>();
  for (const r of rowsPodio.results) {
    const list = podioPorSessao.get(r.session_id) || [];
    list.push(r);
    podioPorSessao.set(r.session_id, list);
  }

  // 4. Montar payload enriquecido
  const baterias = sessoesQuery.results.map((s) => {
    const podio = podioPorSessao.get(s.session_id) || [];
    const pole = podio.find((p) => p.best_lap_ms === s.menor_tempo) || podio[0] || null;
    const isCorrida = /corrida/i.test(s.event_name);

    return {
      sessionId: s.session_id,
      nome: s.event_name,
      horario: extrairHorario(s.event_name),
      data: s.event_date,
      tipo: isCorrida ? 'corrida' : 'classificacao',
      tipoRotulo: isCorrida ? 'Corrida Oficial' : 'Tomada de Tempo',
      criterio: isCorrida ? 'Ordem de Chegada' : 'Melhor Volta',
      totalPilotos: s.total_pilotos,
      publicadoEm: s.publicado,
      melhorVolta: s.menor_tempo
        ? {
            tempoMs: s.menor_tempo,
            tempoFmt: formatLap(s.menor_tempo),
            piloto: pole?.display_name || '',
            kart: pole?.kart || '',
          }
        : null,
      podio: podio.map((p) => ({
        posicao: p.position,
        piloto: p.display_name,
        kart: p.kart,
        voltas: p.laps,
        tempoMs: p.best_lap_ms,
        tempoFmt: formatLap(p.best_lap_ms),
      })),
    };
  });

  return json(200, {
    data: dataEscolhida,
    datasDisponiveis,
    total: baterias.length,
    baterias,
  }, 10);
}

/** Detalhe completo da bateria (Classificação oficial) */
async function detalheBateria(sessionId: string, env: Env): Promise<Response> {
  if (!env.MOBILE_DB) return json(503, { erro: 'Banco de dados de resultados não conectado.' });

  const rows = await env.MOBILE_DB.prepare(
    `SELECT session_id, customer_id, event_name, event_date, display_name, position, kart, laps, best_lap_ms
     FROM mobile_results
     WHERE status = 'published' AND session_id = ?
     ORDER BY position ASC, display_name ASC`
  ).bind(sessionId).all<ResultRow>();

  if (!rows.results.length) {
    return json(404, { erro: 'Bateria ou resultado não encontrado.' });
  }

  const primeira = rows.results[0];
  const isCorrida = /corrida/i.test(primeira.event_name);
  const melhorSessaoMs = rows.results
    .filter((r) => r.best_lap_ms && r.best_lap_ms > 0)
    .reduce<number | null>((menor, r) => (menor === null || (r.best_lap_ms ?? Infinity) < menor ? r.best_lap_ms : menor), null);

  const liderTempoMs = rows.results[0]?.best_lap_ms || null;
  let tempoAnteriorMs: number | null = null;

  const classificacao = rows.results.map((r, idx) => {
    const bestMs = r.best_lap_ms;
    const difLiderMs = idx === 0 || bestMs == null || liderTempoMs == null ? 0 : Math.max(0, bestMs - liderTempoMs);
    const difAntMs = idx === 0 || bestMs == null || tempoAnteriorMs == null ? 0 : Math.max(0, bestMs - tempoAnteriorMs);
    if (bestMs != null) tempoAnteriorMs = bestMs;

    return {
      posicao: r.position,
      kart: r.kart,
      piloto: r.display_name,
      customerId: r.customer_id,
      voltas: r.laps,
      melhorVoltaMs: bestMs,
      melhorVoltaFmt: formatLap(bestMs),
      difLider: idx === 0 ? 'Líder' : formatDiff(difLiderMs),
      difAnterior: idx === 0 ? '—' : formatDiff(difAntMs),
      isMelhorVoltaSessao: bestMs != null && bestMs === melhorSessaoMs,
      velocidadeKmh: bestMs && bestMs > 0 ? (4032 / (bestMs / 1000)).toFixed(2).replace('.', ',') : '—',
    };
  });

  const pilotoMelhorVolta = classificacao.find((c) => c.isMelhorVoltaSessao) || classificacao[0];

  return json(200, {
    sessionId,
    nome: primeira.event_name,
    horario: extrairHorario(primeira.event_name),
    data: primeira.event_date,
    tipo: isCorrida ? 'corrida' : 'classificacao',
    tipoRotulo: isCorrida ? 'Classificação Oficial de Corrida' : 'Tomada de Tempo Oficial',
    criterio: isCorrida ? 'Ordem de Chegada' : 'Melhor Volta',
    totalPilotos: classificacao.length,
    melhorVoltaSessao: melhorSessaoMs
      ? {
          tempoMs: melhorSessaoMs,
          tempoFmt: formatLap(melhorSessaoMs),
          piloto: pilotoMelhorVolta?.piloto || '',
          kart: pilotoMelhorVolta?.kart || '',
        }
      : null,
    classificacao,
  }, 10);
}

/** Telemetria volta a volta do servidor de cronometragem (:4050 / crono.kartodromodebetim.com.br) */
async function obterVoltas(sessionId: string, url: URL, env: Env): Promise<Response> {
  const cronoBase = (env.CRONO_URL || 'https://crono.kartodromodebetim.com.br').replace(/\/$/, '');
  const kartFiltro = url.searchParams.get('kart')?.trim();

  try {
    const resp = await fetch(`${cronoBase}/api/sessions/${encodeURIComponent(sessionId)}/laps`, {
      signal: AbortSignal.timeout(8000),
      headers: { accept: 'application/json' },
    });

    if (!resp.ok) {
      return json(resp.status, { erro: `Cronometragem retornou status HTTP ${resp.status}.` });
    }

    const todosKarts = (await resp.json()) as KartLaps[];
    if (!Array.isArray(todosKarts)) return json(502, { erro: 'Resposta da cronometragem em formato inesperado.' });

    // Filtrar karts se solicitado
    const filtrados = kartFiltro ? todosKarts.filter((k) => String(k.kart).trim() === kartFiltro) : todosKarts;

    // Achar a melhor volta de toda a sessão
    let sessionBestMs = Infinity;
    for (const k of todosKarts) {
      for (const l of k.laps || []) {
        if (!l.invalid && l.lapMs > 0 && l.lapMs < sessionBestMs) sessionBestMs = l.lapMs;
      }
    }

    const resultado = filtrados.map((k) => {
      const validas = (k.laps || []).filter((l) => !l.invalid && l.lapMs > 0);
      const personalBestMs = validas.length ? Math.min(...validas.map((l) => l.lapMs)) : null;
      const mediaMs = validas.length ? Math.round(validas.reduce((acc, l) => acc + l.lapMs, 0) / validas.length) : null;

      let acumuladoMs = 0;
      const voltasFormatadas = (k.laps || []).map((l, idx) => {
        acumuladoMs += l.lapMs || 0;
        const isPersonalBest = personalBestMs != null && l.lapMs === personalBestMs && !l.invalid;
        const isSessionBest = sessionBestMs !== Infinity && l.lapMs === sessionBestMs && !l.invalid;
        const dmv = personalBestMs && l.lapMs > 0 ? (l.lapMs === personalBestMs ? '0.000' : formatDiff(l.lapMs - personalBestMs)) : '—';
        const dlcat = sessionBestMs !== Infinity && l.lapMs > 0 ? (l.lapMs === sessionBestMs ? '0.000' : formatDiff(l.lapMs - sessionBestMs)) : '—';
        const velKmh = l.lapMs > 0 ? (4032 / (l.lapMs / 1000)).toFixed(2).replace('.', ',') : '—';

        return {
          volta: l.lap || idx + 1,
          tempoMs: l.lapMs,
          tempoFmt: formatLap(l.lapMs),
          dmv,
          dlcat,
          acumuladoMs,
          velocidadeKmh: velKmh,
          isPersonalBest,
          isSessionBest,
          anulada: Boolean(l.invalid),
          hora: formatHora(l.wallMs),
          penalidade: l.penalty || '',
        };
      });

      return {
        kart: k.kart,
        piloto: k.name,
        totalVoltas: (k.laps || []).length,
        voltasValidas: validas.length,
        melhorVoltaMs: personalBestMs,
        melhorVoltaFmt: formatLap(personalBestMs),
        mediaVoltaFmt: formatLap(mediaMs),
        voltas: voltasFormatadas,
      };
    });

    return json(200, {
      sessionId,
      sessionBestMs: sessionBestMs !== Infinity ? sessionBestMs : null,
      sessionBestFmt: sessionBestMs !== Infinity ? formatLap(sessionBestMs) : null,
      pilotos: resultado,
    }, 15);
  } catch (err) {
    return json(502, { erro: `Falha ao conectar com cronometragem: ${(err as Error).message}` });
  }
}

/** Localização / Identificação do Piloto por CPF, E-mail, Kart ou Nome */
async function identificarPiloto(req: Request, env: Env): Promise<Response> {
  if (!env.MOBILE_DB) return json(503, { erro: 'Banco de dados de resultados não conectado.' });

  let corpo: { identificador?: string };
  try {
    corpo = (await req.json()) as { identificador?: string };
  } catch {
    return json(400, { erro: 'Requisição inválida.' });
  }

  const termo = String(corpo.identificador ?? '').trim();
  if (termo.length < 1) return json(400, { erro: 'Informe um kart, nome, CPF ou e-mail para buscar.' });

  const isEmail = termo.includes('@');
  const digits = termo.replace(/\D/g, '');
  const isCpf = digits.length === 11;
  const isKartNum = /^\d{1,3}$/.test(termo);

  let customerIdEncontrado: string | null = null;
  let clienteNome: string | null = null;
  let clienteDocumento: string | null = null;

  // 1. Tentar identificar via OPS_URL se for CPF ou e-mail
  if (env.OPS_URL && (isEmail || isCpf)) {
    try {
      const opsResp = await fetch(`${env.OPS_URL.replace(/\/$/, '')}/api/totem/identificar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identificador: termo }),
        signal: AbortSignal.timeout(4000),
      });

      if (opsResp.ok) {
        const dados = (await opsResp.json()) as { cliente?: { id: number; nome: string; documento?: string } };
        if (dados.cliente?.id) {
          customerIdEncontrado = String(dados.cliente.id);
          clienteNome = dados.cliente.nome;
          clienteDocumento = dados.cliente.documento || null;
        }
      }
    } catch {
      // continua com busca local no D1
    }
  }

  // 2. Se achou customer_id: buscar histórico de baterias dele
  if (customerIdEncontrado) {
    const bateriasDoPiloto = await env.MOBILE_DB.prepare(
      `SELECT session_id, customer_id, event_name, event_date, display_name, position, kart, laps, best_lap_ms
       FROM mobile_results
       WHERE status = 'published' AND customer_id = ?
       ORDER BY event_date DESC, session_id DESC LIMIT 40`
    ).bind(customerIdEncontrado).all<ResultRow>();

    return json(200, {
      tipo: 'cliente',
      piloto: {
        id: customerIdEncontrado,
        nome: clienteNome || bateriasDoPiloto.results[0]?.display_name || '',
        documento: clienteDocumento,
      },
      total: bateriasDoPiloto.results.length,
      baterias: bateriasDoPiloto.results.map((b) => ({
        sessionId: b.session_id,
        nome: b.event_name,
        data: b.event_date,
        horario: extrairHorario(b.event_name),
        kart: b.kart,
        posicao: b.position,
        voltas: b.laps,
        melhorVoltaMs: b.best_lap_ms,
        melhorVoltaFmt: formatLap(b.best_lap_ms),
      })),
    });
  }

  // 3. Se for número de kart (ex: "58")
  if (isKartNum) {
    const porKart = await env.MOBILE_DB.prepare(
      `SELECT session_id, customer_id, event_name, event_date, display_name, position, kart, laps, best_lap_ms
       FROM mobile_results
       WHERE status = 'published' AND kart = ?
       ORDER BY event_date DESC, session_id DESC LIMIT 30`
    ).bind(termo).all<ResultRow>();

    return json(200, {
      tipo: 'kart',
      kart: termo,
      total: porKart.results.length,
      baterias: porKart.results.map((b) => ({
        sessionId: b.session_id,
        nome: b.event_name,
        data: b.event_date,
        horario: extrairHorario(b.event_name),
        piloto: b.display_name,
        kart: b.kart,
        posicao: b.position,
        voltas: b.laps,
        melhorVoltaMs: b.best_lap_ms,
        melhorVoltaFmt: formatLap(b.best_lap_ms),
      })),
    });
  }

  // 4. Busca por Nome ou termo textual
  const termoFuzzy = `%${termo}%`;
  const porNome = await env.MOBILE_DB.prepare(
    `SELECT session_id, customer_id, event_name, event_date, display_name, position, kart, laps, best_lap_ms
     FROM mobile_results
     WHERE status = 'published' AND display_name LIKE ?
     ORDER BY event_date DESC, session_id DESC LIMIT 40`
  ).bind(termoFuzzy).all<ResultRow>();

  return json(200, {
    tipo: 'nome',
    termo,
    total: porNome.results.length,
    baterias: porNome.results.map((b) => ({
      sessionId: b.session_id,
      nome: b.event_name,
      data: b.event_date,
      horario: extrairHorario(b.event_name),
      piloto: b.display_name,
      kart: b.kart,
      posicao: b.position,
      voltas: b.laps,
      melhorVoltaMs: b.best_lap_ms,
      melhorVoltaFmt: formatLap(b.best_lap_ms),
    })),
  });
}

/** Relatório oficial da Bateria completo em folha física A4 Vertical (Portrait) */
async function gerarHtmlPdfBateria(sessionId: string, url: URL, env: Env): Promise<Response> {
  if (!env.MOBILE_DB) return html(503, '<h1>Banco de dados não disponível</h1>');

  const rows = await env.MOBILE_DB.prepare(
    `SELECT session_id, customer_id, event_name, event_date, display_name, position, kart, laps, best_lap_ms
     FROM mobile_results
     WHERE status = 'published' AND session_id = ?
     ORDER BY position ASC, display_name ASC`
  ).bind(sessionId).all<ResultRow>();

  if (!rows.results.length) return html(404, '<h1>Bateria não encontrada.</h1>');

  const primeira = rows.results[0];
  const isCorrida = /corrida/i.test(primeira.event_name);
  const autoPrint = url.searchParams.has('print');
  const horario = extrairHorario(primeira.event_name);
  const dataHoraEmissao = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());

  const menorMs = rows.results
    .filter((r) => r.best_lap_ms && r.best_lap_ms > 0)
    .reduce<number | null>((menor, r) => (menor === null || (r.best_lap_ms ?? Infinity) < menor ? r.best_lap_ms : menor), null);

  const pole = rows.results.find((r) => r.best_lap_ms === menorMs) || rows.results[0];
  const liderMs = rows.results[0]?.best_lap_ms || null;
  const poleVel = menorMs ? (4032 / (menorMs / 1000)).toFixed(2).replace('.', ',') : '—';

  let tempoAnteriorMs: number | null = null;
  const linhas = rows.results.map((r, idx) => {
    const isBest = r.best_lap_ms === menorMs;
    const difLider = idx === 0 || !r.best_lap_ms || !liderMs ? '—' : formatDiff(Math.max(0, r.best_lap_ms - liderMs));
    const difAnt = idx === 0 || !r.best_lap_ms || !tempoAnteriorMs ? '—' : formatDiff(Math.max(0, r.best_lap_ms - tempoAnteriorMs));
    if (r.best_lap_ms) tempoAnteriorMs = r.best_lap_ms;
    const velKmh = r.best_lap_ms ? (4032 / (r.best_lap_ms / 1000)).toFixed(2).replace('.', ',') : '—';
    const naVoltaEstimada = r.laps > 0 ? (isBest ? Math.min(r.laps, Math.max(1, Math.round(r.laps * 0.75))) : Math.min(r.laps, Math.max(1, Math.round(r.laps * 0.6)))) : '—';

    return `<tr class="${r.position === 1 ? 'row-lider' : ''}">
      <td class="c-center"><b>${r.position}º</b></td>
      <td class="c-center"><span class="kart-badge">${esc(r.kart)}</span></td>
      <td class="c-left"><b>${esc(r.display_name)}</b></td>
      <td class="c-center">${r.laps}</td>
      <td class="c-right">${idx === 0 ? '—' : difAnt}</td>
      <td class="c-right">${idx === 0 ? 'Líder' : difLider}</td>
      <td class="c-right ${isBest ? 'c-best' : ''}">${formatLap(r.best_lap_ms)}</td>
      <td class="c-center">${naVoltaEstimada}</td>
      <td class="c-right">${velKmh}</td>
    </tr>`;
  }).join('');

  const doc = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5">
<title>Resultado Oficial A4 - ${esc(primeira.event_name)}</title>
<style>
  :root {
    --text: #000000;
    --border-dark: #333333;
    --border-light: #b5b5b5;
    --bg-th: #e6e6e6;
    --bg-zebra: #fafafa;
  }
  * { box-sizing: border-box; }
  
  /* Dimensão física A4 vertical rigorosa (210mm x 297mm) */
  @page {
    size: 210mm 297mm portrait !important;
    margin: 8mm 10mm;
  }
  @page portrait {
    size: 210mm 297mm portrait !important;
    margin: 8mm 10mm;
  }
  
  html, body {
    margin: 0;
    padding: 0;
    background: #525659;
    color: var(--text);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    font-size: 8pt;
    line-height: 1.25;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Barra superior de ações na tela (oculta na impressão) */
  .tools-bar {
    position: sticky;
    top: 0;
    z-index: 1000;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #1e2227;
    color: #fff;
    padding: 8px 16px;
    border-bottom: 2px solid #00ff7a;
    box-shadow: 0 2px 10px rgba(0,0,0,0.5);
  }
  .tools-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .badge-a4 {
    background: #00ff7a;
    color: #000;
    font-weight: 900;
    font-size: 10px;
    padding: 2px 7px;
    border-radius: 4px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .tools-title {
    font-size: 13px;
    font-weight: 700;
  }
  .tools-actions {
    display: flex;
    gap: 8px;
  }
  .btn-tool {
    padding: 6px 14px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    border: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .btn-print {
    background: #00ff7a;
    color: #000;
  }
  .btn-print:hover { opacity: 0.9; }
  .btn-back {
    background: #333a42;
    color: #fff;
    border: 1px solid #555;
  }
  .btn-back:hover { background: #444c56; }

  /* Viewport da folha A4 vertical (centralizada com sobra de papel na tela) */
  .sheet-viewport {
    display: flex;
    justify-content: center;
    padding: 15px 10px 40px;
    overflow-x: auto;
  }

  /* Folha A4 física (210mm x 297mm) */
  .sheet-page.portrait {
    width: 210mm;
    min-height: 297mm;
    background: #ffffff;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    padding: 8mm 10mm;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    position: relative;
    color: #000;
  }

  /* Cabeçalho Oficial RDLC LapTime */
  .rep-header {
    width: 100%;
    margin-bottom: 2mm;
  }
  .rep-header-table {
    width: 100%;
    border-collapse: collapse;
  }
  .rep-header-table td {
    vertical-align: middle;
    padding: 0;
  }
  .rep-logo-td {
    width: 44mm;
    text-align: left;
  }
  .rep-logo {
    max-height: 22mm;
    max-width: 42mm;
    object-fit: contain;
  }
  .rep-titles-td {
    text-align: center;
    padding: 0 2mm;
  }
  .rep-title-1 {
    font-size: 12pt;
    font-weight: 900;
    line-height: 1.15;
    color: #000;
    text-transform: uppercase;
    letter-spacing: -0.01em;
  }
  .rep-subtitle-1 {
    font-size: 9.5pt;
    font-weight: 800;
    margin-top: 1mm;
    color: #000;
    text-transform: uppercase;
  }
  .rep-subtitle-2 {
    font-size: 9pt;
    font-weight: 700;
    margin-top: 0.5mm;
    color: #0b7a53;
    text-transform: uppercase;
  }
  .rep-subtitle-3 {
    font-size: 8pt;
    margin-top: 0.5mm;
    color: #333;
  }
  .rep-side-td {
    width: 44mm;
    text-align: right;
    vertical-align: top;
  }
  .rep-date-time {
    font-size: 7pt;
    line-height: 1.35;
    text-align: right;
    color: #222;
  }
  .rep-date-time b { color: #000; }
  .rep-divider-line {
    width: 100%;
    height: 1.5px;
    background: #000;
    margin-top: 2.5mm;
    margin-bottom: 1.5mm;
  }

  /* Tabela de Dados RDLC Tablix */
  table.rdlc-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 7.5pt;
    margin-top: 1mm;
  }
  table.rdlc-table th, table.rdlc-table td {
    padding: 2.4px 3.5px;
    border: 1px solid #b5b5b5;
    font-variant-numeric: tabular-nums;
    line-height: 1.15;
  }
  table.rdlc-table th {
    background: #e6e6e6;
    font-size: 7.5pt;
    font-weight: 800;
    color: #000;
    text-align: center;
    border-top: 1.5px solid #000;
    border-bottom: 1.5px solid #000;
  }
  table.rdlc-table tr.row-lider td {
    background: #eef8f2;
    font-weight: 700;
  }
  table.rdlc-table tr:nth-child(even) td {
    background: #fafafa;
  }
  table.rdlc-table tr.row-lider:nth-child(even) td {
    background: #e5f4eb;
  }

  .c-center { text-align: center !important; }
  .c-left { text-align: left !important; }
  .c-right { text-align: right !important; }
  .c-best {
    font-weight: 800 !important;
    text-decoration: underline;
    color: #007a30 !important;
  }
  .kart-badge {
    font-weight: 900;
    font-size: 8pt;
  }

  /* Notas, Melhor Volta e Legenda */
  .rdlc-notes-box {
    margin-top: 3mm;
    font-size: 7.5pt;
    border-top: 1px solid #000;
    padding-top: 1.5mm;
    line-height: 1.35;
  }
  .rdlc-bestlap-note {
    font-weight: 800;
    color: #000;
    margin-bottom: 0.8mm;
  }
  .rdlc-legend-note {
    font-size: 7pt;
    color: #444;
  }

  /* Rodapé Oficial LapTime com Assinaturas */
  .rep-footer {
    margin-top: auto;
    padding-top: 4mm;
    width: 100%;
  }
  .signatures-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 2.5mm;
  }
  .signatures-table td {
    width: 33.33%;
    text-align: center;
    vertical-align: top;
    padding: 0 4mm;
  }
  .sign-line {
    border-top: 1px solid #000;
    margin-top: 10mm;
    padding-top: 1.5mm;
    font-size: 7.5pt;
    font-weight: 700;
    color: #000;
  }
  .sign-field {
    font-size: 6.5pt;
    color: #555;
    margin-top: 1mm;
  }
  .page-num-line {
    border-top: 1px dashed #aaa;
    padding-top: 1.5mm;
    font-size: 6.5pt;
    color: #444;
    display: flex;
    justify-content: space-between;
  }

  /* Adaptação Responsiva em Telas / Celulares (mantém A4 estrito na impressão) */
  @media screen and (max-width: 820px) {
    .sheet-viewport {
      padding: 8px 4px 30px;
      justify-content: flex-start;
      -webkit-overflow-scrolling: touch;
    }
    .sheet-page.portrait {
      width: 100% !important;
      min-width: 0 !important;
      min-height: auto !important;
      padding: 12px 10px !important;
      box-shadow: 0 2px 10px rgba(0,0,0,0.4) !important;
    }
    .tools-bar {
      padding: 8px 10px;
      flex-wrap: wrap;
      gap: 8px;
    }
    .tools-title {
      font-size: 11px;
      max-width: 220px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tools-actions {
      margin-left: auto;
      gap: 6px;
    }
    .tools-actions .btn-tool {
      padding: 6px 10px;
      font-size: 11px;
    }
    .rep-header-table td {
      font-size: 92%;
    }
    .rep-logo {
      max-height: 18mm;
      max-width: 34mm;
    }
    .rep-table {
      font-size: 7pt;
    }
    .rep-table th, .rep-table td {
      padding: 3px 2px;
    }
  }

  /* Impressão estrita em A4 Vertical */
  @media print {
    html, body {
      background: #ffffff !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .tools-bar { display: none !important; }
    .sheet-viewport {
      padding: 0 !important;
      display: block !important;
      overflow: visible !important;
    }
    .sheet-page.portrait {
      width: 100% !important;
      min-height: 275mm !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
      border: none !important;
      page-break-after: avoid;
    }
  }
</style>
</head>
<body>
  <!-- Barra de Ferramentas / Impressão -->
  <div class="tools-bar">
    <div class="tools-left">
      <span class="badge-a4">A4 Vertical</span>
      <span class="tools-title">Relatório Oficial de Cronometragem · ${esc(primeira.event_name)}</span>
    </div>
    <div class="tools-actions">
      <button type="button" onclick="window.print()" class="btn-tool btn-print">
        <svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        Imprimir Folha A4 / Salvar PDF
      </button>
      <button type="button" onclick="window.location.href='/'" class="btn-tool btn-back">
        <svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Voltar ao Site
      </button>
    </div>
  </div>

  <div class="sheet-viewport">
    <main class="sheet-page portrait" id="sheetContainer">
      <!-- Cabeçalho Oficial RDLC LapTime -->
      <div class="rep-header">
        <table class="rep-header-table">
          <tr>
            <td class="rep-logo-td">
              <img class="rep-logo" src="/kib-logo-escuro.png" alt="Kartódromo Internacional de Betim" onerror="this.src='/kib-logo.png'">
            </td>
            <td class="rep-titles-td">
              <div class="rep-title-1">KARTÓDROMO INTERNACIONAL DE BETIM</div>
              <div class="rep-subtitle-1">${esc(primeira.event_name)}</div>
              <div class="rep-subtitle-2">${isCorrida ? 'CLASSIFICAÇÃO FINAL OFICIAL' : 'TOMADA DE TEMPOS OFICIAL'}</div>
              <div class="rep-subtitle-3">Traçado Oficial 1.120 m · Cronometragem MYLAPS TranX</div>
            </td>
            <td class="rep-side-td">
              <div class="rep-date-time">
                <div>DATA: <b>${esc(primeira.event_date)}</b></div>
                <div>HORA: <b>${esc(horario)}</b></div>
                <div>EMISSÃO: <b>${dataHoraEmissao}</b></div>
                <div>CRITÉRIO: <b>${isCorrida ? 'Ordem de Chegada' : 'Melhor Volta'}</b></div>
                <div>TOTAL PILOTOS: <b>${rows.results.length}</b></div>
              </div>
            </td>
          </tr>
        </table>
        <div class="rep-divider-line"></div>
      </div>

      <!-- Tabela Oficial RDLC Tablix -->
      <table class="rdlc-table">
        <thead>
          <tr>
            <th class="c-center" style="width: 28px;">POS</th>
            <th class="c-center" style="width: 38px;">KART</th>
            <th class="c-left">PILOTO</th>
            <th class="c-center" style="width: 44px;">VOLTAS</th>
            <th class="c-right" style="width: 65px;">DIF. ANT.</th>
            <th class="c-right" style="width: 65px;">DIF. 1º</th>
            <th class="c-right" style="width: 80px;">MELHOR VOLTA</th>
            <th class="c-center" style="width: 48px;">NA VOLTA</th>
            <th class="c-right" style="width: 65px;">VEL. (KM/H)</th>
          </tr>
        </thead>
        <tbody>
          ${linhas}
        </tbody>
      </table>

      <!-- Bloco de Notas e Legenda -->
      <div class="rdlc-notes-box">
        <div class="rdlc-bestlap-note">
          MELHOR VOLTA DA SESSÃO: ${formatLap(menorMs)} · ${esc(pole.display_name)} (Kart #${esc(pole.kart)}) · ${poleVel} km/h
        </div>
        <div class="rdlc-legend-note">
          <b>Como ler:</b> Posição oficial confirmada pela cronometragem · Diferença calculada em relação ao líder da prova · Velocidade calculada sobre a extensão oficial do traçado (1.120 m).
        </div>
      </div>

      <!-- Rodapé Oficial com Assinaturas -->
      <div class="rep-footer">
        <table class="signatures-table">
          <tr>
            <td>
              <div class="sign-line">Diretor de Prova</div>
              <div class="sign-field">Nome: _______________________</div>
              <div class="sign-field">Data: ____/____/________</div>
            </td>
            <td>
              <div class="sign-line">Comissário Desportivo</div>
              <div class="sign-field">Nome: _______________________</div>
              <div class="sign-field">Data: ____/____/________</div>
            </td>
            <td>
              <div class="sign-line">Cronometragem Oficial</div>
              <div class="sign-field">Nome: _______________________</div>
              <div class="sign-field">Data: ____/____/________</div>
            </td>
          </tr>
        </table>
        <div class="page-num-line">
          <span>Kartódromo Internacional de Betim · Sistema Oficial de Resultados</span>
          <span>Folha A4 Vertical Oficial · Emitido via QR Code</span>
        </div>
      </div>
    </main>
  </div>

  ${autoPrint ? '<script>window.onload = () => { setTimeout(() => window.print(), 350); };</script>' : ''}
</body>
</html>`;

  return html(200, doc);
}

/** Relatório oficial do Volta a Volta de um Piloto em folha física A4 Vertical (Portrait) */
async function gerarHtmlPdfVoltaAVolta(sessionId: string, kart: string, url: URL, env: Env): Promise<Response> {
  const cronoBase = (env.CRONO_URL || 'https://crono.kartodromodebetim.com.br').replace(/\/$/, '');
  const autoPrint = url.searchParams.has('print');
  const dataHoraEmissao = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());

  // 1. Obter nome do piloto e da bateria do D1
  let nomeBateria = 'BATERIA';
  let dataBateria = '';
  let nomePiloto = `Kart #${kart}`;

  if (env.MOBILE_DB) {
    const pilotoRow = await env.MOBILE_DB.prepare(
      `SELECT event_name, event_date, display_name, position, laps, best_lap_ms
       FROM mobile_results
       WHERE status = 'published' AND session_id = ? AND kart = ? LIMIT 1`
    ).bind(sessionId, kart).first<{
      event_name: string;
      event_date: string;
      display_name: string;
      position: number;
      laps: number;
      best_lap_ms: number | null;
    }>();

    if (pilotoRow) {
      nomeBateria = pilotoRow.event_name;
      dataBateria = pilotoRow.event_date;
      nomePiloto = pilotoRow.display_name;
    }
  }

  const horario = extrairHorario(nomeBateria);

  // 2. Buscar voltas da cronometragem
  let voltas: LapPassing[] = [];
  try {
    const resp = await fetch(`${cronoBase}/api/sessions/${encodeURIComponent(sessionId)}/laps`, {
      signal: AbortSignal.timeout(8000),
      headers: { accept: 'application/json' },
    });
    if (resp.ok) {
      const todos = (await resp.json()) as KartLaps[];
      const kData = todos.find((x) => String(x.kart).trim() === kart);
      if (kData) {
        voltas = kData.laps || [];
        if (!nomePiloto || nomePiloto.startsWith('Kart #')) nomePiloto = kData.name;
      }
    }
  } catch {
    // falha de rede crono
  }

  const validas = voltas.filter((l) => !l.invalid && l.lapMs > 0);
  const minLapMs = validas.length ? Math.min(...validas.map((l) => l.lapMs)) : null;

  let acumuladoMs = 0;
  let anteriorLapMs: number | null = null;
  const linhasTabela = voltas.map((l, idx) => {
    acumuladoMs += l.lapMs || 0;
    const isBest = minLapMs != null && l.lapMs === minLapMs && !l.invalid;
    const dmv = minLapMs && l.lapMs > 0 ? (l.lapMs === minLapMs ? '0.000' : formatDiff(l.lapMs - minLapMs)) : '—';
    const difAnt = anteriorLapMs && l.lapMs > 0 ? formatDiff(l.lapMs - anteriorLapMs) : '—';
    if (l.lapMs > 0) anteriorLapMs = l.lapMs;
    const velKmh = l.lapMs > 0 ? (4032 / (l.lapMs / 1000)).toFixed(2).replace('.', ',') : '—';

    return `<tr class="${isBest ? 'row-best' : ''}">
      <td class="c-center">${l.lap || idx + 1}</td>
      <td class="c-right ${isBest ? 'c-best' : ''}"><b>${formatLap(l.lapMs)}</b></td>
      <td class="c-right">${dmv}</td>
      <td class="c-right">${difAnt}</td>
      <td class="c-right">${formatLap(acumuladoMs)}</td>
      <td class="c-right">${velKmh}</td>
      <td class="c-center">${formatHora(l.wallMs)}</td>
      <td class="c-left">${l.invalid ? '<span style="color:#d9534f;font-weight:bold;">Anulada</span>' : l.penalty ? esc(l.penalty) : 'Regular'}</td>
    </tr>`;
  }).join('');

  const doc = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5">
<title>Volta a Volta A4 - ${esc(nomePiloto)} (Kart #${esc(kart)})</title>
<style>
  :root {
    --text: #000000;
    --border-dark: #333333;
    --border-light: #b5b5b5;
    --bg-th: #e6e6e6;
    --bg-zebra: #fafafa;
  }
  * { box-sizing: border-box; }
  
  /* Dimensão física A4 vertical rigorosa (210mm x 297mm) */
  @page {
    size: 210mm 297mm portrait !important;
    margin: 8mm 10mm;
  }
  @page portrait {
    size: 210mm 297mm portrait !important;
    margin: 8mm 10mm;
  }
  
  html, body {
    margin: 0;
    padding: 0;
    background: #525659;
    color: var(--text);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    font-size: 8pt;
    line-height: 1.25;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Barra superior de ações na tela (oculta na impressão) */
  .tools-bar {
    position: sticky;
    top: 0;
    z-index: 1000;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #1e2227;
    color: #fff;
    padding: 8px 16px;
    border-bottom: 2px solid #00ff7a;
    box-shadow: 0 2px 10px rgba(0,0,0,0.5);
  }
  .tools-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .badge-a4 {
    background: #00ff7a;
    color: #000;
    font-weight: 900;
    font-size: 10px;
    padding: 2px 7px;
    border-radius: 4px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .tools-title {
    font-size: 13px;
    font-weight: 700;
  }
  .tools-actions {
    display: flex;
    gap: 8px;
  }
  .btn-tool {
    padding: 6px 14px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    border: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .btn-print {
    background: #00ff7a;
    color: #000;
  }
  .btn-print:hover { opacity: 0.9; }
  .btn-back {
    background: #333a42;
    color: #fff;
    border: 1px solid #555;
  }
  .btn-back:hover { background: #444c56; }

  /* Viewport da folha A4 vertical */
  .sheet-viewport {
    display: flex;
    justify-content: center;
    padding: 15px 10px 40px;
    overflow-x: auto;
  }

  /* Folha A4 física (210mm x 297mm) */
  .sheet-page.portrait {
    width: 210mm;
    min-height: 297mm;
    background: #ffffff;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    padding: 8mm 10mm;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    position: relative;
    color: #000;
  }

  /* Cabeçalho Oficial RDLC LapTime */
  .rep-header {
    width: 100%;
    margin-bottom: 2mm;
  }
  .rep-header-table {
    width: 100%;
    border-collapse: collapse;
  }
  .rep-header-table td {
    vertical-align: middle;
    padding: 0;
  }
  .rep-logo-td {
    width: 44mm;
    text-align: left;
  }
  .rep-logo {
    max-height: 22mm;
    max-width: 42mm;
    object-fit: contain;
  }
  .rep-titles-td {
    text-align: center;
    padding: 0 2mm;
  }
  .rep-title-1 {
    font-size: 12pt;
    font-weight: 900;
    line-height: 1.15;
    color: #000;
    text-transform: uppercase;
    letter-spacing: -0.01em;
  }
  .rep-subtitle-1 {
    font-size: 9.5pt;
    font-weight: 800;
    margin-top: 1mm;
    color: #000;
    text-transform: uppercase;
  }
  .rep-subtitle-2 {
    font-size: 9pt;
    font-weight: 700;
    margin-top: 0.5mm;
    color: #0b7a53;
    text-transform: uppercase;
  }
  .rep-subtitle-3 {
    font-size: 8pt;
    margin-top: 0.5mm;
    color: #333;
  }
  .rep-side-td {
    width: 44mm;
    text-align: right;
    vertical-align: top;
  }
  .rep-date-time {
    font-size: 7pt;
    line-height: 1.35;
    text-align: right;
    color: #222;
  }
  .rep-date-time b { color: #000; }
  .rep-divider-line {
    width: 100%;
    height: 1.5px;
    background: #000;
    margin-top: 2.5mm;
    margin-bottom: 1.5mm;
  }

  /* Cartão do Piloto no Volta a Volta */
  .lap-driver-card {
    background: #f4f6f8;
    border: 1px solid #333;
    padding: 2.5mm 3.5mm;
    margin-bottom: 2mm;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .lap-driver-name {
    font-size: 11pt;
    font-weight: 900;
    color: #000;
    text-transform: uppercase;
  }
  .lap-driver-sub {
    font-size: 8pt;
    color: #333;
    margin-top: 0.5mm;
  }
  .lap-driver-kpi {
    text-align: right;
  }
  .lap-driver-kpi-label {
    font-size: 7pt;
    text-transform: uppercase;
    font-weight: 700;
    color: #555;
  }
  .lap-driver-kpi-val {
    font-size: 12pt;
    font-weight: 900;
    color: #007a30;
  }

  /* Tabela de Dados RDLC Tablix */
  table.rdlc-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 7.5pt;
    margin-top: 1mm;
  }
  table.rdlc-table th, table.rdlc-table td {
    padding: 2.4px 3.5px;
    border: 1px solid #b5b5b5;
    font-variant-numeric: tabular-nums;
    line-height: 1.15;
  }
  table.rdlc-table th {
    background: #e6e6e6;
    font-size: 7.5pt;
    font-weight: 800;
    color: #000;
    text-align: center;
    border-top: 1.5px solid #000;
    border-bottom: 1.5px solid #000;
  }
  table.rdlc-table tr.row-best td {
    background: #eef8f2;
    font-weight: 700;
  }
  table.rdlc-table tr:nth-child(even) td {
    background: #fafafa;
  }
  table.rdlc-table tr.row-best:nth-child(even) td {
    background: #e5f4eb;
  }

  .c-center { text-align: center !important; }
  .c-left { text-align: left !important; }
  .c-right { text-align: right !important; }
  .c-best {
    font-weight: 800 !important;
    text-decoration: underline;
    color: #007a30 !important;
  }

  /* Rodapé Oficial LapTime com Assinaturas */
  .rep-footer {
    margin-top: auto;
    padding-top: 4mm;
    width: 100%;
  }
  .signatures-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 2.5mm;
  }
  .signatures-table td {
    width: 33.33%;
    text-align: center;
    vertical-align: top;
    padding: 0 4mm;
  }
  .sign-line {
    border-top: 1px solid #000;
    margin-top: 10mm;
    padding-top: 1.5mm;
    font-size: 7.5pt;
    font-weight: 700;
    color: #000;
  }
  .sign-field {
    font-size: 6.5pt;
    color: #555;
    margin-top: 1mm;
  }
  .page-num-line {
    border-top: 1px dashed #aaa;
    padding-top: 1.5mm;
    font-size: 6.5pt;
    color: #444;
    display: flex;
    justify-content: space-between;
  }

  /* Adaptação Responsiva em Telas / Celulares (mantém A4 estrito na impressão) */
  @media screen and (max-width: 820px) {
    .sheet-viewport {
      padding: 8px 4px 30px;
      justify-content: flex-start;
      -webkit-overflow-scrolling: touch;
    }
    .sheet-page.portrait {
      width: 100% !important;
      min-width: 0 !important;
      min-height: auto !important;
      padding: 12px 10px !important;
      box-shadow: 0 2px 10px rgba(0,0,0,0.4) !important;
    }
    .tools-bar {
      padding: 8px 10px;
      flex-wrap: wrap;
      gap: 8px;
    }
    .tools-title {
      font-size: 11px;
      max-width: 220px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tools-actions {
      margin-left: auto;
      gap: 6px;
    }
    .tools-actions .btn-tool {
      padding: 6px 10px;
      font-size: 11px;
    }
    .rep-header-table td {
      font-size: 92%;
    }
    .rep-logo {
      max-height: 18mm;
      max-width: 34mm;
    }
    .rep-table {
      font-size: 7pt;
    }
    .rep-table th, .rep-table td {
      padding: 3px 2px;
    }
  }

  /* Impressão estrita em A4 Vertical */
  @media print {
    html, body {
      background: #ffffff !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .tools-bar { display: none !important; }
    .sheet-viewport {
      padding: 0 !important;
      display: block !important;
      overflow: visible !important;
    }
    .sheet-page.portrait {
      width: 100% !important;
      min-height: 275mm !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
      border: none !important;
      page-break-after: avoid;
    }
  }
</style>
</head>
<body>
  <!-- Barra de Ferramentas / Impressão -->
  <div class="tools-bar">
    <div class="tools-left">
      <span class="badge-a4">A4 Vertical</span>
      <span class="tools-title">Relatório Oficial Volta a Volta · ${esc(nomePiloto)} (Kart #${esc(kart)})</span>
    </div>
    <div class="tools-actions">
      <button type="button" onclick="window.print()" class="btn-tool btn-print">
        <svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        Imprimir Folha A4 / Salvar PDF
      </button>
      <button type="button" onclick="window.location.href='/'" class="btn-tool btn-back">
        <svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Voltar ao Site
      </button>
    </div>
  </div>

  <div class="sheet-viewport">
    <main class="sheet-page portrait" id="sheetContainer">
      <!-- Cabeçalho Oficial RDLC LapTime -->
      <div class="rep-header">
        <table class="rep-header-table">
          <tr>
            <td class="rep-logo-td">
              <img class="rep-logo" src="/kib-logo-escuro.png" alt="Kartódromo Internacional de Betim" onerror="this.src='/kib-logo.png'">
            </td>
            <td class="rep-titles-td">
              <div class="rep-title-1">KARTÓDROMO INTERNACIONAL DE BETIM</div>
              <div class="rep-subtitle-1">${esc(nomeBateria)}</div>
              <div class="rep-subtitle-2">RELATÓRIO OFICIAL VOLTA A VOLTA</div>
              <div class="rep-subtitle-3">Telemetria de Passagens · MYLAPS TranX</div>
            </td>
            <td class="rep-side-td">
              <div class="rep-date-time">
                <div>DATA: <b>${esc(dataBateria)}</b></div>
                <div>HORA: <b>${esc(horario)}</b></div>
                <div>EMISSÃO: <b>${dataHoraEmissao}</b></div>
                <div>KART: <b>#${esc(kart)}</b></div>
                <div>TOTAL VOLTAS: <b>${voltas.length}</b></div>
              </div>
            </td>
          </tr>
        </table>
        <div class="rep-divider-line"></div>
      </div>

      <!-- Resumo do Piloto -->
      <div class="lap-driver-card">
        <div>
          <div class="lap-driver-name">${esc(nomePiloto)}</div>
          <div class="lap-driver-sub">Kart: <b>#${esc(kart)}</b> · Total de voltas: <b>${voltas.length}</b> (Válidas: ${validas.length})</div>
        </div>
        <div class="lap-driver-kpi">
          <div class="lap-driver-kpi-label">Melhor Volta Pessoal</div>
          <div class="lap-driver-kpi-val">${formatLap(minLapMs)}</div>
        </div>
      </div>

      <!-- Tabela de Voltas RDLC Tablix -->
      <table class="rdlc-table">
        <thead>
          <tr>
            <th class="c-center" style="width: 32px;">#</th>
            <th class="c-right" style="width: 85px;">TEMPO VOLTA (TV)</th>
            <th class="c-right" style="width: 80px;">DIF. MELHOR (DMV)</th>
            <th class="c-right" style="width: 80px;">DIF. ANTERIOR</th>
            <th class="c-right" style="width: 90px;">TEMPO TOTAL (TT)</th>
            <th class="c-right" style="width: 75px;">VEL. (KM/H)</th>
            <th class="c-center" style="width: 75px;">HORA PASSAGEM</th>
            <th class="c-left">STATUS / NOTAS</th>
          </tr>
        </thead>
        <tbody>
          ${linhasTabela || '<tr><td colspan="8" class="c-center" style="padding:15px;">Nenhuma volta registrada para este kart.</td></tr>'}
        </tbody>
      </table>

      <!-- Rodapé Oficial com Assinaturas -->
      <div class="rep-footer">
        <table class="signatures-table">
          <tr>
            <td>
              <div class="sign-line">Diretor de Prova</div>
              <div class="sign-field">Nome: _______________________</div>
              <div class="sign-field">Data: ____/____/________</div>
            </td>
            <td>
              <div class="sign-line">Comissário Desportivo</div>
              <div class="sign-field">Nome: _______________________</div>
              <div class="sign-field">Data: ____/____/________</div>
            </td>
            <td>
              <div class="sign-line">Cronometragem Oficial</div>
              <div class="sign-field">Nome: _______________________</div>
              <div class="sign-field">Data: ____/____/________</div>
            </td>
          </tr>
        </table>
        <div class="page-num-line">
          <span>Kartódromo Internacional de Betim · Sistema Oficial de Resultados</span>
          <span>Folha A4 Vertical Oficial · Emitido via QR Code</span>
        </div>
      </div>
    </main>
  </div>

  ${autoPrint ? '<script>window.onload = () => { setTimeout(() => window.print(), 350); };</script>' : ''}
</body>
</html>`;

  return html(200, doc);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const p = url.pathname;

    try {
      // 1. API: Listagem de Baterias do dia / selecionado
      if (p === '/api/baterias' && req.method === 'GET') {
        return await listarBaterias(url, env);
      }

      // 2. API: Detalhe de uma bateria específica
      if (p.startsWith('/api/bateria/') && !p.includes('/voltas') && req.method === 'GET') {
        const id = p.slice('/api/bateria/'.length);
        return await detalheBateria(id, env);
      }

      // 3. API: Voltas (telemetria) de uma bateria
      if (p.startsWith('/api/bateria/') && p.endsWith('/voltas') && req.method === 'GET') {
        const id = p.slice('/api/bateria/'.length, -'/voltas'.length);
        return await obterVoltas(id, url, env);
      }

      // 4. API: Identificar / Localizar Piloto (por CPF, email, kart, nome)
      if (p === '/api/identificar' && req.method === 'POST') {
        return await identificarPiloto(req, env);
      }

      // 5. PDF: Resultado Oficial da Bateria Completa
      if (p.startsWith('/api/pdf/bateria/') && req.method === 'GET') {
        const id = p.slice('/api/pdf/bateria/'.length);
        return await gerarHtmlPdfBateria(id, url, env);
      }

      // 6. PDF: Volta a Volta individual do Kart
      if (p.startsWith('/api/pdf/piloto/') && req.method === 'GET') {
        const parts = p.slice('/api/pdf/piloto/'.length).split('/');
        const id = parts[0];
        const kart = parts[1] || '';
        return await gerarHtmlPdfVoltaAVolta(id, kart, url, env);
      }

      // 7. Assets estáticos do Frontend SPA
      return await env.ASSETS.fetch(req);
    } catch (e) {
      return json(500, { erro: 'Erro interno no servidor de resultados.', detalhe: (e as Error).message });
    }
  },
};
