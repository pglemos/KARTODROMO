import { API_BASE_URL, MobileApiError, mobileRequest } from '../../api/client';

export type PeriodoRanking = 'semana' | 'mes' | 'geral';

export interface LinhaRanking {
  pos: number;
  id: string | null;
  nome: string;
  ms: number;
  kart: string | null;
  dia: string;
  categoria: string | null;
}

export interface RankingResponse {
  periodo: PeriodoRanking;
  de: string | null;
  ate: string | null;
  tracados: { nome: string; pilotos: number }[];
  tracado: string | null;
  linhas: LinhaRanking[];
  atualizadoEm: string;
}

export interface PosicaoRanking { pos: number; de: number }

export interface CarreiraPiloto {
  id: string;
  nome: string;
  baterias: number;
  corridas: number;
  voltas: number;
  vitorias: number;
  podios: number;
  poles: number;
  voltasMaisRapidas: number;
  /** semanas no top 10 semanal do LapTime antigo (antes de 02/09/2026, quando não há corrida detalhada) */
  semanasTop10?: number;
  mesesTop10?: number;
  /** XP e baterias por mês (mais recente primeiro, até 12) */
  xpMes?: { mes: string; xp: number; baterias: number; podios?: number; vitorias?: number }[];
  /** posição no ranking de XP: líder e quem está logo acima e abaixo */
  comparativo?: { pos: number; de: number; lider: VizinhoXp | null; acima: VizinhoXp | null; abaixo: VizinhoXp | null; acimaLista?: VizinhoXp[] };
  /** contagens completas da carreira (servidor) */
  estatisticas?: { corridas: number; classificatorias: number; treinos: number; comTempo: number; noturnas: number; vitoriasChuva: number; maiorSequenciaVitorias: number; cheias: { corridas: number; vitorias: number; podios: number }; tracadosDiferentes: number };
  primeira: string | null;
  ultima: string | null;
  tracados: { nome: string; ms: number; dia: string; corridas: number; semana: PosicaoRanking | null; mes: PosicaoRanking | null; geral: PosicaoRanking | null }[];
  recentes: { dia: string; bateria: string; tipo: string; tracado: string; pos: number; de: number; melhor: number | null; kart: string }[];
  atualizadoEm: string;
}

export interface KartDoDia { kart: string; melhorMs: number | null; posVolta: number | null; melhorPos: number | null; corridas: { inicio: number; pos: number; piloto: string; ms: number | null; bateria: string; de: number }[] }

export const rankingApi = {
  kartsDoDia() {
    return mobileRequest<{ dia: string | null; karts: KartDoDia[]; atualizadoEm: string | null }>('/api/mobile/v1/ranking/karts');
  },
  buscar(nome: string) {
    return mobileRequest<{ pilotos: VizinhoXp[] }>(`/api/mobile/v1/ranking/busca?nome=${encodeURIComponent(nome)}`);
  },
  ranking(periodo: PeriodoRanking, tracado?: string | null) {
    const q = new URLSearchParams({ periodo });
    if (tracado) q.set('tracado', tracado);
    return mobileRequest<RankingResponse>(`/api/mobile/v1/ranking?${q.toString()}`);
  },
  piloto(id: string) {
    return mobileRequest<CarreiraPiloto>(`/api/mobile/v1/ranking/pilotos/${encodeURIComponent(id)}`);
  },
  /** endereço da foto (404 quando o piloto não tem); `v` muda depois de trocar a foto para furar o cache */
  fotoUrl(id: string, v?: number) {
    return `${API_BASE_URL}/api/mobile/v1/ranking/pilotos/${encodeURIComponent(id)}/foto${v ? `?v=${v}` : ''}`;
  },
  async enviarFoto(accessToken: string, arquivo: string) {
    const blob = await (await fetch(arquivo)).blob();
    const r = await fetch(`${API_BASE_URL}/api/mobile/v1/ranking/me/foto`, { method: 'PUT', headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'image/jpeg' }, body: blob });
    const corpo = (await r.json().catch(() => ({}))) as { erro?: string; versao?: number };
    if (!r.ok) throw new MobileApiError(corpo.erro ?? 'Não foi possível enviar a foto.', r.status);
    return corpo.versao ?? Date.now();
  },
  removerFoto(accessToken: string) {
    return mobileRequest<{ ok: boolean }>('/api/mobile/v1/ranking/me/foto', { method: 'DELETE', accessToken });
  },
  minha(accessToken: string) {
    return mobileRequest<CarreiraPiloto>('/api/mobile/v1/ranking/me', { accessToken });
  },
};

/** 61234 → "1:01.234"; 54193 → "54.193" */
export function formatarVolta(ms: number) {
  const min = Math.floor(ms / 60000);
  const seg = ((ms % 60000) / 1000).toFixed(3).padStart(6, '0');
  return min ? `${min}:${seg}` : seg.replace(/^0/, '');
}

/** "2026-10-18" → "18/10/2026" */
export function formatarDia(dia: string) {
  const [a, m, d] = dia.split('-');
  return d && m && a ? `${d}/${m}/${a}` : dia;
}

export interface VizinhoXp { id: string; nome: string; xp: number }
