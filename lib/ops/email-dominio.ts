/**
 * Corrige o domínio de e-mails digitados errado no totem/recepção/site ("gmal.com", "gmail.co", "hotmial.com"…).
 * Em 01/10/2026 eram ~3.600 cadastros com domínio que não existe: o piloto nunca recebia o resultado por e-mail.
 *
 * Regra conservadora: só corrige para os 5 provedores grandes, só quando há UM provedor perto (até 2 letras),
 * nunca quando o domínio é real (yahoo.com.ar, hotmail.com.br, uai.com.br…) nem quando o erro é ambíguo
 * (números colados no domínio — "98gmail.com" — podiam ser do nome antes do @).
 */

const PROVEDORES = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com.br', 'icloud.com'];

/** Domínios reais parecidos com os provedores: nunca mexer. */
const REAIS = new Set([
  ...PROVEDORES,
  'hotmail.com.br', 'outlook.com.br', 'live.com', 'live.com.br', 'live.com.pt', 'msn.com', 'yahoo.com', 'ymail.com', 'me.com', 'mac.com',
  'mail.com', 'email.com', 'gmx.com', 'aol.com', 'uol.com.br', 'bol.com.br', 'ig.com.br', 'oi.com.br', 'terra.com.br', 'uai.com.br',
  'yahoo.com.ar', 'yahoo.com.mx', 'yahoo.com.tw', 'yahoo.com.be', 'yahoo.co.uk', 'yahoo.co.jp', 'yahoo.fr', 'yahoo.es', 'yahoo.it', 'yahoo.de', 'yahoo.ca', 'yahoo.in',
  'hotmail.es', 'hotmail.fr', 'hotmail.it', 'hotmail.de', 'hotmail.co.uk', 'outlook.es', 'outlook.pt', 'outlook.fr', 'outlook.de',
]);

/** Parecem erro, mas podem ser outro provedor ou empresa: deixa como está. */
const AMBIGUOS = new Set([
  'hmail.com', 'hmauil.com', 'cloud.com', 'fmail.com', 'gal.com', 'gml.com', 'gotmail.com', 'rotmail.com', 'tmail.com', 'qmail.com',
  'yamail.com', 'ymail.vom', 'outmail.com', 'hotlook.com', 'vsb.com',
]);

function distancia(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // letras trocadas
    }
  }
  return d[a.length][b.length];
}

/** Domínio corrigido, ou null quando não há correção segura (ou já está certo). */
export function corrigeDominio(original: string): string | null {
  let d = original.trim().toLowerCase();
  if (/^[0-9]/.test(d)) return null; // "98gmail.com": o número pode ser do nome
  d = d.replace(/^[!#|.'"\s]+/, '').replace(/[,;/]/g, '.').replace(/\.{2,}/g, '.').replace(/[.'"\]\s]+$/, '').replace(/[^a-z0-9.-]/g, '');
  d = d.replace(/^(.+\.(?:com|br))\d+$/, '$1'); // "gmail.com61"
  if (REAIS.has(d)) return d === original ? null : d;
  if (AMBIGUOS.has(d) || AMBIGUOS.has(original)) return null;
  const sem = d.replace(/\./g, '');
  for (const p of ['gmail', 'hotmail', 'outlook', 'icloud']) if (sem === p || sem === `${p}com`) return `${p}.com`;
  if (sem === 'gmailcombr' || sem === 'gmailcobr') return 'gmail.com';
  if (sem === 'yahoocombr' || sem === 'yahoocobr') return 'yahoo.com.br';
  if (d.replace(/[^a-z]/g, '').length < 4) return null;
  const perto = PROVEDORES.map((p) => ({ p, k: distancia(d, p) })).filter((c) => c.k <= 2).sort((a, b) => a.k - b.k);
  if (!perto.length || (perto.length > 1 && perto[0].k === perto[1].k)) return null;
  if (perto[0].k === 2 && d.replace(/[^a-z]/g, '').length < 8) return null; // curto demais para ter certeza
  return perto[0].p === d ? null : perto[0].p;
}

/** E-mail com o domínio corrigido (minúsculo, sem espaços nas pontas); devolve o mesmo quando não há o que corrigir. */
export function corrigeEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at <= 0 || e.indexOf('@') !== at) return e;
  const novo = corrigeDominio(e.slice(at + 1));
  return novo ? `${e.slice(0, at)}@${novo}` : e;
}
