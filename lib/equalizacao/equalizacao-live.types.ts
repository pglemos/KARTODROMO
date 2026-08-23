export type EqualizacaoLiveStatus = 'online' | 'no-qualifying' | 'offline';

export type EqualizacaoLiveCandidate = {
  competitorId: string;
  kart: string;
  piloto: string;
  transponder: string | null;
  melhorVoltaMs: number | null;
  melhorVolta: string | null;
  mediaVoltaMs: number | null;
  mediaVolta: string | null;
  desvioMs: number | null;
  desvio: string | null;
  voltasValidas: number;
  ultimaVolta: number | null;
  tempoCorridaMs: number | null;
  tempoCorrida: string | null;
  ultimaPassagemId: string | null;
};

export type EqualizacaoLiveSnapshot = {
  status: EqualizacaoLiveStatus;
  source: 'laptime';
  atualizadoEm: string;
  error?: string;
  race: {
    id: string;
    nome: string;
    tipo: string | null;
    pista: string | null;
    inicio: string | null;
  } | null;
  candidates: EqualizacaoLiveCandidate[];
};
