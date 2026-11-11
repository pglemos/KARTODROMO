// Validação e formatação (mesmas regras do worker: workers/pre-cadastro/src/validar.ts e reservas.ts).

export const digitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');
export const reais = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function cpfValido(v: string) {
  const d = digitos(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const n of [9, 10]) {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const dv = ((s * 10) % 11) % 10;
    if (dv !== Number(d[n])) return false;
  }
  return true;
}
export const mascaraCpf = (v: string) => digitos(v).slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
export function mascaraFone(v: string) {
  const d = digitos(v).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
export const mascaraData = (v: string) => digitos(v).slice(0, 8).replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2})(\d)/, '$1/$2');
export const mascaraCep = (v: string) => digitos(v).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');

/** DD/MM/AAAA -> AAAA-MM-DD ('' se inválida). */
export function dataIso(br: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br.trim());
  if (!m) return '';
  const [, d, mo, a] = m;
  const dt = new Date(Number(a), Number(mo) - 1, Number(d));
  if (dt.getFullYear() !== Number(a) || dt.getMonth() !== Number(mo) - 1 || dt.getDate() !== Number(d)) return '';
  if (dt > new Date() || Number(a) < 1900) return '';
  return `${a}-${mo}-${d}`;
}
export function idade(iso: string, hoje = new Date()) {
  const [a, m, d] = iso.split('-').map(Number);
  let i = hoje.getFullYear() - a;
  if (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) i--;
  return i;
}
export const emailValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
export function erroInstagram(v: string) {
  const s = v.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '');
  const u = s.replace(/^@/, '');
  if (!/^[A-Za-z0-9._]{1,30}$/.test(u) || /^\.|\.$|\.\./.test(u)) return 'Confira o Instagram: só o @usuário (ex.: @andre.silva).';
  return '';
}

const DIAS = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];
const DIAS_LONGOS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const deIso = (iso: string) => { const [d, h = '00:00'] = iso.split('T'); const [a, m, di] = d.split('-').map(Number); const [hh, mm] = h.split(':').map(Number); return new Date(a, m - 1, di, hh, mm); };
export const diaChave = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
export const hora = (dt: Date) => `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
export const diaCurto = (dt: Date) => `${DIAS[dt.getDay()]}, ${dt.getDate()} de ${MESES[dt.getMonth()].slice(0, 3)}.`;
export const diaLongo = (dt: Date) => `${DIAS_LONGOS[dt.getDay()]}, ${dt.getDate()} de ${MESES[dt.getMonth()]}`;
export const nomeMes = (a: number, m: number) => `${MESES[m][0].toUpperCase()}${MESES[m].slice(1)} ${a}`;
export const menosUmaHora = (dt: Date) => hora(new Date(dt.getTime() - 3600e3));

/** Evento .ics da chegada (1 h antes) para "Salvar na agenda". */
export function ics(inicio: Date, codigo: string, descricao: string) {
  const f = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`;
  const chegada = new Date(inicio.getTime() - 3600e3);
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kartodromo de Betim//Reservas//PT-BR', 'BEGIN:VEVENT',
    `UID:${codigo}@reservas.kartodromodebetim.com.br`, `DTSTAMP:${f(new Date())}`,
    `DTSTART;TZID=America/Sao_Paulo:${f(chegada)}`, `DTEND;TZID=America/Sao_Paulo:${f(new Date(inicio.getTime() + 3600e3))}`,
    'SUMMARY:Chegada ao Kartódromo de Betim', `DESCRIPTION:Reserva ${codigo} · ${descricao}. Largada às ${hora(inicio)}. No totem\\, informe o CPF de quem reservou.`,
    'LOCATION:Av. Adutora Várzea das Flores\\, 477 - Itacolomi - Betim/MG', 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}
