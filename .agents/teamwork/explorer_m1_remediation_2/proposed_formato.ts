export const FUSO_HORARIO = 'America/Sao_Paulo';

const ISO_HORA_REGEX = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;
const HORA_SIMPLES_REGEX = /^\d{2}:\d{2}$/;

export const relogio = (ms: number | null | undefined) => {
  if (ms == null) return '--:--';
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

export const volta = (ms: number | null | undefined) => {
  if (ms == null) return '—';
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(3).padStart(6, '0').replace('.', ',');
  return m ? `${m}:${s}` : s.replace(/^0/, '');
};

export const minutos = (data: Date = new Date()) =>
  data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO_HORARIO });

export const hora = (ms?: number | Date | string | null): string => {
  if (ms == null || ms === '') return '--:--';
  try {
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('pt-BR', { timeZone: FUSO_HORARIO });
  } catch {
    return '--:--';
  }
};

export const dataHoraLocal = (valor: string | number | Date | null | undefined): string => {
  if (!valor) return '—';
  try {
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return String(valor);
    return d.toLocaleString('pt-BR', { timeZone: FUSO_HORARIO });
  } catch {
    return String(valor);
  }
};

export const horaMinutoLocal = (valor: string | number | Date | null | undefined): string => {
  if (!valor) return '--:--';
  try {
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO_HORARIO });
  } catch {
    return '--:--';
  }
};

export const formatarInicioAgenda = (inicio?: string, fallback?: number | string): string => {
  if (!inicio || typeof inicio !== 'string') return String(fallback ?? '');
  const hm = horaMinutoLocal(inicio);
  if (hm !== '--:--') return hm;
  if (HORA_SIMPLES_REGEX.test(inicio)) return inicio;
  if (ISO_HORA_REGEX.test(inicio)) {
    const fatiado = inicio.slice(11, 16);
    if (fatiado) return fatiado;
  }
  return String(fallback ?? '');
};
