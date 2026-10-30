// Fora do Windows (GitHub Actions) não existe DPAPI: simula o formato. No Windows os testes usam a proteção de verdade.
const PREFIX = 'dpapi:v1:';
export const protegerSegredoLocal = (s: string) => PREFIX + (s ? Buffer.from(s).toString('base64') : 'empty');
export const revelarSegredoLocal = (s: string) => {
  if (!s.startsWith(PREFIX)) return s;
  return s === PREFIX + 'empty' ? '' : Buffer.from(s.slice(PREFIX.length), 'base64').toString();
};
