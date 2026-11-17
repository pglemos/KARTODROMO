/**
 * Dados do painel web que vêm de vários sistemas do kartódromo:
 *  - sinais: último pedido de cada PC (atualização dos programas) e de cada totem, mais um teste de rede (WinRM 5985);
 *  - sorteio e frota: da cronometragem do ORBITS (último sorteio do tablet, karts com transponder);
 *  - eventos: sessões da cronometragem agrupadas por evento (base dos campeonatos);
 *  - campeonatos: regra de pontos e as etapas (sessões de corrida/pole da cronometragem). A classificação é calculada no
 *    painel a partir dos resultados oficiais (/api/office/crono/dados/:id).
 */
import { readFileSync } from 'node:fs';
import { Socket } from 'node:net';
import { join, resolve } from 'node:path';
import { DATA, one, query } from './db';
import { HttpError } from './office';
import type { Sessao } from './auth';

type Req = { method: string; url: URL; body: () => Promise<Record<string, unknown>>; sessao: Sessao };
type Res = (status: number, body: unknown) => void;

const TIMING_URL = (process.env.OPS_TIMING_URL || 'http://192.168.20.249:4050').replace(/\/$/, '');
const UPDATES_DIR = resolve(process.env.OPS_UPDATES_DIR || join(process.cwd(), 'updates')); // a mesma pasta do ops-server

export const PCS = [
  { ip: '192.168.20.53', nome: 'Recepção', papel: 'Recepção · impressora TM-T20' },
  { ip: '192.168.20.239', nome: 'Recepção 2', papel: 'Recepção · Totem · Cronometragem' },
  { ip: '192.168.20.12', nome: 'Ana (gerência)', papel: 'Recepção · Totem · Cronometragem' },
  { ip: '192.168.20.161', nome: 'Totem 1', papel: 'Autoatendimento' },
  { ip: '192.168.20.69', nome: 'Totem 2', papel: 'Autoatendimento' },
  { ip: '192.168.20.254', nome: 'CRONO1', papel: 'Cronometragem · TV' },
  { ip: '192.168.20.249', nome: 'ORBITS', papel: 'Cronometragem :4050 · painel de LED' },
  { ip: '192.168.20.250', nome: 'Telão TB50', papel: 'Placar LED grande' },
  { ip: '192.168.20.13', nome: 'SRVKART', papel: 'Servidor da operação · SQL Server' },
];

// ---------------------------------------------------------------- sinais (em memória; zera quando o servidor reinicia)
type Sinal = { apps: Record<string, number>; pacotes: Record<string, number>; totem?: { em: number; tela: string } };
const sinais = new Map<string, Sinal>();
/** passos do totem por dia (um pedido por passo: identificar, cadastrar, ver baterias, inscrever) */
const funil = new Map<string, Record<string, number>>();
/** últimos pré-cadastros que o servidor buscou no site (QR code) */
const preCadastros: { em: number; nome: string; novo: boolean; grupo: boolean }[] = [];
const diaSp = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

export function registrarPreCadastro(nome: string, novo: boolean, grupo: boolean) {
  preCadastros.unshift({ em: Date.now(), nome: String(nome || '').slice(0, 80), novo, grupo });
  preCadastros.length = Math.min(preCadastros.length, 60);
}

function versaoPublicada(app: string): string | null {
  try {
    const m = JSON.parse(readFileSync(join(UPDATES_DIR, app, 'manifest.json'), 'utf8').replace(/^\uFEFF/, '')) as { version?: string };
    return m.version ?? null;
  } catch { return null; }
}
const TELAS_TOTEM: Record<string, string> = {
  '/api/totem/config': 'Tela inicial', '/api/totem/identificar': 'Identificação (CPF)', '/api/totem/cadastro': 'Cadastro',
  '/api/totem/baterias': 'Escolhendo a bateria', '/api/totem/inscrever': 'Inscrição concluída',
};

/** Chamado pelo servidor a cada pedido de atualização dos programas e a cada pedido do totem. */
export function registrarSinal(ip: string, caminho: string) {
  if (!ip) return;
  const s = sinais.get(ip) ?? { apps: {}, pacotes: {} };
  const up = caminho.match(/^\/updates\/([A-Za-z]+)\/(.+)$/);
  if (up) {
    if (up[2] === 'manifest.json') s.apps[up[1]] = Date.now();
    else s.pacotes[up[1]] = Date.now(); // baixou o pacote: estava numa versão velha e está atualizando
  } else if (TELAS_TOTEM[caminho]) {
    s.totem = { em: Date.now(), tela: TELAS_TOTEM[caminho] };
    const dia = diaSp();
    if (!funil.has(dia)) { funil.clear(); funil.set(dia, {}); }
    const f = funil.get(dia)!;
    f[caminho] = (f[caminho] ?? 0) + 1;
  }
  sinais.set(ip, s);
}

function testarPorta(ip: string, porta: number, ms = 900): Promise<number | null> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const s = new Socket();
    const fim = (v: number | null) => { s.destroy(); resolve(v); };
    s.setTimeout(ms, () => fim(null));
    s.once('error', () => fim(null));
    s.connect(porta, ip, () => fim(Date.now() - t0));
  });
}

async function timing(caminho: string) {
  const r = await fetch(TIMING_URL + caminho, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new HttpError(502, `A cronometragem respondeu HTTP ${r.status}.`);
  return r.json();
}

const txt = (v: unknown, max: number) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).replace(/\s+/g, ' ').trim().slice(0, max));
const inteiro = (v: unknown, padrao: number, min = 0, max = 1000) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : padrao; };
const listaIds = (v: unknown) => (Array.isArray(v) ? v : String(v ?? '').split(',')).map((x) => String(x).trim()).filter((x) => /^[\w-]{1,60}$/.test(x)).slice(0, 12).join(',') || null;

async function campeonatos() {
  const camps = await query(
    `select id, nome, temporada, regra, pontos, bonus_pole "bonusPole", bonus_melhor_volta "bonusMelhorVolta",
            penalidade_pontos "penalidadePontos", descartes, ativo from kart.campeonato order by ativo desc, id desc`,
  );
  const etapas = await query(
    `select id, campeonato_id "campeonatoId", ordem, nome, to_char(data, ${DATA}) data, sessoes_corrida "sessoesCorrida",
            sessoes_pole "sessoesPole", publicada from kart.campeonato_etapa order by campeonato_id, ordem, id`,
  );
  return camps.map((c) => ({
    ...c,
    etapas: etapas.filter((e) => e.campeonatoId === c.id).map((e) => ({
      ...e, sessoesCorrida: String(e.sessoesCorrida ?? '').split(',').filter(Boolean), sessoesPole: String(e.sessoesPole ?? '').split(',').filter(Boolean),
    })),
  }));
}

export async function painelRoutes(req: Req, send: Res): Promise<boolean> {
  const { method, url } = req;
  const path = url.pathname.replace(/^\/api\/office/, '');
  let m: RegExpMatchArray | null;

  if (path === '/painel/sinais' && method === 'GET') {
    const agora = Date.now();
    const lista = await Promise.all(PCS.map(async (pc) => {
      // WinRM, compartilhamento ou RPC: os totens e o telão nem sempre deixam a 5985 aberta para o SRVKART
      let ms: number | null = pc.ip === '192.168.20.13' ? 0 : null;
      for (const porta of [5985, 445, 135, 3389]) { if (ms !== null) break; ms = await testarPorta(pc.ip, porta, 700); }
      const s = sinais.get(pc.ip);
      const apps = Object.entries(s?.apps ?? {}).map(([app, em]) => {
        const baixou = s?.pacotes[app];
        // o app só baixa o pacote quando está numa versão mais velha que a publicada; sem pacote, está na publicada
        return { app, minutos: Math.round((agora - em) / 60000), versao: versaoPublicada(app), atualizando: !!baixou && agora - baixou < 10 * 60_000 };
      });
      return { ...pc, online: ms !== null, ms, apps, totem: s?.totem ? { tela: s.totem.tela, minutos: Math.round((agora - s.totem.em) / 60000) } : null };
    }));
    const publicadas = Object.fromEntries(['Recepcao', 'Autoatendimento', 'Cronometragem'].map((a) => [a, versaoPublicada(a)]));
    send(200, { pcs: lista, desde: Math.round(process.uptime() / 60), publicadas, funil: funil.get(diaSp()) ?? {}, preCadastros });
    return true;
  }
  if (path === '/painel/sorteio' && method === 'GET') { send(200, await timing('/api/sorteio/ultimo')); return true; }
  if (path === '/painel/karts' && method === 'GET') {
    const mapa = (await timing('/api/transponders')) as Record<string, unknown>;
    const karts = [...new Set(Object.values(mapa).map((k) => String(k).trim()).filter((k) => /^\d+$/.test(k)))].sort((a, b) => Number(a) - Number(b));
    const oficina = await query<{ kart: string; itens: number; vencidos: number; minutos: number }>(
      `select trim(m.kart) kart, count(*) itens, sum(case when not m.realizada and coalesce(it.tempo_horas, 0) > 0 and m.minutos_uso >= it.tempo_horas * 60 then 1 else 0 end) vencidos,
              max(m.minutos_uso) minutos
         from kart.manutencao m left join kart.item_manutencao it on it.id = m.item_id group by trim(m.kart)`,
    );
    send(200, { karts, oficina });
    return true;
  }
  if (path === '/painel/eventos' && method === 'GET') {
    const [eventos, sessoes] = await Promise.all([timing('/api/catalog/events'), timing('/api/sessions')]) as [Record<string, unknown>[], Record<string, unknown>[]];
    const de = String(url.searchParams.get('de') ?? '0000');
    const porEvento = new Map<string, Record<string, unknown>[]>();
    for (const s of sessoes) {
      if (s.state === 'cancelada') continue;
      const k = String(s.eventId ?? '');
      if (!porEvento.has(k)) porEvento.set(k, []);
      porEvento.get(k)!.push({ id: s.id, nome: s.name, tipo: s.type, estado: s.state, largou: s.startedAt ?? null, pilotos: s.competitors ?? 0 });
    }
    send(200, eventos.filter((e) => String(e.date ?? '') >= de).map((e) => ({ id: e.id, nome: e.name, data: e.date, agenda: String(e.id).startsWith('agenda-'), sessoes: porEvento.get(String(e.id)) ?? [] }))
      .filter((e) => e.sessoes.length).sort((a, b) => String(b.data).localeCompare(String(a.data))));
    return true;
  }

  if (path === '/campeonatos' && method === 'GET') { send(200, await campeonatos()); return true; }
  if (path === '/campeonatos' && method === 'POST') {
    const b = await req.body();
    const nome = txt(b.nome, 120);
    if (!nome) throw new HttpError(400, 'Informe o nome do campeonato.');
    await query(
      `insert into kart.campeonato (nome, temporada, regra, pontos, bonus_pole, bonus_melhor_volta, penalidade_pontos, descartes)
       values (@nome, @temp, @regra, @pontos, @pole, @mv, @pen, @desc)`,
      {
        nome, temp: txt(b.temporada, 60), regra: b.regra === 'geral' ? 'geral' : 'categoria',
        pontos: String(b.pontos ?? '50,45,42,40,38').split(',').map((x) => inteiro(x, 0, 0, 500)).filter((x) => x > 0).join(',') || '50,45,42,40,38',
        pole: inteiro(b.bonusPole, 1, 0, 50), mv: inteiro(b.bonusMelhorVolta, 1, 0, 50), pen: inteiro(b.penalidadePontos, 10, 0, 100), desc: inteiro(b.descartes, 2, 0, 20),
      },
    );
    send(201, await campeonatos());
    return true;
  }
  if ((m = path.match(/^\/campeonatos\/(\d+)$/)) && method === 'PUT') {
    const b = await req.body();
    const atual = await one<Record<string, unknown>>(`select * from kart.campeonato where id = @id`, { id: Number(m[1]) });
    if (!atual) throw new HttpError(404, 'Campeonato não encontrado.');
    await query(
      `update kart.campeonato set nome = @nome, temporada = @temp, regra = @regra, pontos = @pontos, bonus_pole = @pole, bonus_melhor_volta = @mv,
         penalidade_pontos = @pen, descartes = @desc, ativo = @ativo where id = @id`,
      {
        id: Number(m[1]), nome: txt(b.nome, 120) ?? atual.nome, temp: b.temporada !== undefined ? txt(b.temporada, 60) : atual.temporada,
        regra: b.regra === 'geral' || b.regra === 'categoria' ? b.regra : atual.regra,
        pontos: b.pontos !== undefined ? String(b.pontos).split(',').map((x) => inteiro(x, 0, 0, 500)).filter((x) => x > 0).join(',') || atual.pontos : atual.pontos,
        pole: b.bonusPole !== undefined ? inteiro(b.bonusPole, 1, 0, 50) : atual.bonus_pole, mv: b.bonusMelhorVolta !== undefined ? inteiro(b.bonusMelhorVolta, 1, 0, 50) : atual.bonus_melhor_volta,
        pen: b.penalidadePontos !== undefined ? inteiro(b.penalidadePontos, 10, 0, 100) : atual.penalidade_pontos, desc: b.descartes !== undefined ? inteiro(b.descartes, 2, 0, 20) : atual.descartes,
        ativo: b.ativo === undefined ? atual.ativo : !!b.ativo,
      },
    );
    send(200, await campeonatos());
    return true;
  }
  if ((m = path.match(/^\/campeonatos\/(\d+)\/etapas$/)) && method === 'POST') {
    const b = await req.body();
    const cid = Number(m[1]);
    const n = await one<{ n: number }>(`select coalesce(max(ordem), 0) n from kart.campeonato_etapa where campeonato_id = @c`, { c: cid });
    await query(
      `insert into kart.campeonato_etapa (campeonato_id, ordem, nome, data, sessoes_corrida, sessoes_pole) values (@c, @o, @nome, @data, @corr, @pole)`,
      { c: cid, o: (n?.n ?? 0) + 1, nome: txt(b.nome, 120) ?? `${(n?.n ?? 0) + 1}ª etapa`, data: /^\d{4}-\d{2}-\d{2}$/.test(String(b.data ?? '')) ? b.data : null, corr: listaIds(b.sessoesCorrida), pole: listaIds(b.sessoesPole) },
    );
    send(201, await campeonatos());
    return true;
  }
  if ((m = path.match(/^\/campeonatos\/(\d+)\/etapas\/(\d+)$/))) {
    const params = { c: Number(m[1]), id: Number(m[2]) };
    if (method === 'DELETE') { await query(`delete from kart.campeonato_etapa where id = @id and campeonato_id = @c`, params); send(200, await campeonatos()); return true; }
    if (method === 'PUT') {
      const b = await req.body();
      await query(
        `update kart.campeonato_etapa set nome = coalesce(@nome, nome), data = coalesce(@data::date, data), sessoes_corrida = coalesce(@corr, sessoes_corrida),
           sessoes_pole = coalesce(@pole, sessoes_pole), publicada = coalesce(@pub::boolean, publicada) where id = @id and campeonato_id = @c`,
        { ...params, nome: txt(b.nome, 120), data: /^\d{4}-\d{2}-\d{2}$/.test(String(b.data ?? '')) ? b.data : null, corr: b.sessoesCorrida !== undefined ? listaIds(b.sessoesCorrida) : null, pole: b.sessoesPole !== undefined ? listaIds(b.sessoesPole) : null, pub: b.publicada === undefined ? null : !!b.publicada },
      );
      send(200, await campeonatos());
      return true;
    }
  }
  return false;
}
