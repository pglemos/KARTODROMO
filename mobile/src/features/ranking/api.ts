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
  primeira: string | null;
  ultima: string | null;
  tracados: { nome: string; ms: number; dia: string; corridas: number; semana: PosicaoRanking | null; mes: PosicaoRanking | null; geral: PosicaoRanking | null }[];
  recentes: { dia: string; bateria: string; tipo: string; tracado: string; pos: number; de: number; melhor: number | null; kart: string }[];
  atualizadoEm: string;
}

export const rankingApi = {
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
