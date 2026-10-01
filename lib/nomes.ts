/**
 * Nome próprio para exibir (telão, resultado, e-mail, termo): os cadastros vêm "TUDO MAIÚSCULO" (LapTime) ou
 * "tudo minúsculo" (totem/site) e o resultado misturava os dois. Nome já escrito com maiúsculas e minúsculas
 * é respeitado (ex.: "McLaren", "João DE Souza" digitado assim de propósito).
 */
const PARTICULAS = new Set(['da', 'das', 'de', 'do', 'dos', 'e', 'di', 'du', 'del', 'van', 'von', 'y']);

export function nomeProprio(nome: string | null | undefined): string {
  const s = String(nome ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return s;
  const temMaiuscula = /\p{Lu}/u.test(s), temMinuscula = /\p{Ll}/u.test(s);
  if (temMaiuscula && temMinuscula) return s; // já escrito à mão
  if (/^(kart|piloto)\s+\d+$/i.test(s)) return s.replace(/^\w+/, (p) => p[0].toUpperCase() + p.slice(1).toLowerCase());
  return s
    .toLocaleLowerCase('pt-BR')
    .split(' ')
    .map((p, i) => {
      if (i > 0 && PARTICULAS.has(p)) return p;
      if (/^[ivx]+$/.test(p) && p.length <= 4 && i > 0) return p.toUpperCase(); // "Neto II"
      return p.replace(/(^|[^\p{L}])(\p{Ll})/gu, (_, sep: string, l: string) => sep + l.toLocaleUpperCase('pt-BR'));
    })
    .join(' ');
}
