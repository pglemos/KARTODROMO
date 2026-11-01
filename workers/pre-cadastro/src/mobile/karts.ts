export interface VoltaKart {
  kart: string; dia: string; inicio: number; pos: number; piloto: string;
  ms: number | null; bateria: string; de: number; tracado: string; categoria: string | null;
}

export function filtrarKarts(linhas: VoltaKart[], url: URL, dias: string[]) {
  const periodo = url.searchParams.get('periodo') ?? 'dia';
  if (!['dia', 'semana', 'mes'].includes(periodo)) throw new Error('Período inválido.');
  const dia = url.searchParams.get('dia') || dias[0] || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || !Number.isFinite(Date.parse(dia)) || new Date(dia).toISOString().slice(0, 10) !== dia) throw new Error('Data inválida.');
  const data = new Date(dia + 'T12:00:00Z');
  const de = new Date(data);
  const ate = new Date(data);
  if (periodo === 'semana') { de.setUTCDate(data.getUTCDate() - (data.getUTCDay() + 6) % 7); ate.setTime(de.getTime()); ate.setUTCDate(de.getUTCDate() + 6); }
  if (periodo === 'mes') { de.setUTCDate(1); ate.setUTCMonth(ate.getUTCMonth() + 1, 0); }
  const desde = de.toISOString().slice(0, 10), fim = ate.toISOString().slice(0, 10);
  const categoria = url.searchParams.get('categoria') || null;
  if (categoria && !['Indoor', 'Super Kart'].includes(categoria)) throw new Error('Categoria inválida.');
  const tracado = url.searchParams.get('tracado') || null;
  const periodoLinhas = linhas.filter((l) => l.dia >= desde && l.dia <= fim);
  const tracados = [...new Set(periodoLinhas.map((l) => l.tracado))].sort();
  const porKart = new Map<string, { kart: string; melhorMs: number | null; melhorPos: number | null; corridas: VoltaKart[] }>();
  for (const l of periodoLinhas.filter((l) => (!categoria || l.categoria === categoria) && (!tracado || l.tracado === tracado))) {
    const k = porKart.get(l.kart) ?? { kart: l.kart, melhorMs: null, melhorPos: null, corridas: [] };
    if (l.ms !== null && (k.melhorMs === null || l.ms < k.melhorMs)) k.melhorMs = l.ms;
    if (l.pos > 0 && (k.melhorPos === null || l.pos < k.melhorPos)) k.melhorPos = l.pos;
    k.corridas.push(l); porKart.set(l.kart, k);
  }
  const karts = [...porKart.values()].sort((a, b) => (a.melhorMs ?? Infinity) - (b.melhorMs ?? Infinity)).map((k, i) => ({ ...k, posVolta: k.melhorMs === null ? null : i + 1, corridas: k.corridas.sort((a, b) => b.inicio - a.inicio) }));
  return { dia, periodo, de: desde, ate: fim, tracado, categoria, tracados, dias, karts };
}
