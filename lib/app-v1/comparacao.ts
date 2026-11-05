import { ErroApp } from './comandos';
import type { Legado } from './operacao';

const JANELA_DIAS = 15;
const MAX_VOLTAS = 5;
const MS_DIA = 86_400_000;
const BRASILIA_MS = -3 * 3_600_000;

type Historico = { sessionId: string; data: string; hora: string; melhorMs: number; voltas: number };
export type Amostra = { numero: string; amostra: number; voltas: { lapMs: number; em: number; sessaoId: string }[] };

/** Super Kart tem número a partir de 100; só se compara kart com kart da mesma frota. */
export const frotaDoNumero = (kart: string) => (Number(kart) >= 100 ? 'SUPER' : 'LIGHT');

const dataBrasilia = (ms: number) => new Date(ms + BRASILIA_MS).toISOString().slice(0, 10);
const emMs = (h: Historico) => Date.parse(`${h.data}T${h.hora || '00:00'}:00-03:00`);

function amostraDe(numero: string, historico: Historico[]): Amostra {
  const validos = historico.filter((h) => Number.isFinite(h.melhorMs) && h.melhorMs > 0);
  const voltas = validos
    .map((h) => ({ lapMs: h.melhorMs, em: emMs(h), sessaoId: h.sessionId }))
    .sort((a, b) => a.lapMs - b.lapMs)
    .slice(0, MAX_VOLTAS);
  return { numero, amostra: validos.reduce((s, h) => s + (h.voltas || 0), 0), voltas };
}

/**
 * Compara dois karts da mesma frota nos últimos 15 dias, com as melhores voltas reais de cada um (a melhor de cada bateria).
 * A cronometragem já deixa de fora passagens apagadas, invalidadas e abaixo da volta mínima plausível;
 * equalização fica de fora porque só entra quando pedida.
 */
export async function compararKarts(legado: Legado, p: { kart: string; referencia: string; trackId?: string | null; agora?: number }) {
  const kart = p.kart.trim();
  const referencia = p.referencia.trim();
  if (!/^\d{1,4}$/.test(kart) || !/^\d{1,4}$/.test(referencia)) throw new ErroApp(400, 'INVALID_REQUEST', 'Informe o número do kart e da referência.');
  if (kart === referencia) throw new ErroApp(400, 'INVALID_REQUEST', 'O kart e a referência precisam ser diferentes.');
  if (frotaDoNumero(kart) !== frotaDoNumero(referencia)) throw new ErroApp(400, 'INVALID_REQUEST', 'Compare karts da mesma frota (Light 1–99 ou Super 100+).');
  const agora = p.agora ?? Date.now();
  const filtros = new URLSearchParams({ de: dataBrasilia(agora - JANELA_DIAS * MS_DIA), ate: dataBrasilia(agora), tipos: 'classificacao,corrida,treino' });
  if (p.trackId) filtros.set('trackId', p.trackId);
  const buscar = async (numero: string) => {
    const r = await legado('GET', `/api/ranking-karts?${filtros.toString()}&kart=${encodeURIComponent(numero)}`);
    return amostraDe(numero, Array.isArray(r) ? r as Historico[] : []);
  };
  const [a, b] = await Promise.all([buscar(kart), buscar(referencia)]);
  return { kart: a, referencia: b };
}
