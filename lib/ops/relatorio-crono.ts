import { normalizarInstagram } from './instagram';

type Piloto = { kart?: unknown; customerId?: unknown; instagram?: string | null; [key: string]: unknown };
export type SessaoRelatorio = { competitors: Piloto[]; standings: Piloto[]; [key: string]: unknown };

export function idsClientesRelatorio(session: SessaoRelatorio): number[] {
  return [...new Set(session.competitors.map((c) => Number(c.customerId)).filter((id) => Number.isInteger(id) && id > 0 && id <= 2147483647))];
}

/** A classificação continua sendo a do cronômetro; só acrescenta o contato do cadastro. */
export function acrescentarInstagramRelatorio(session: SessaoRelatorio, clientes: { id: number; instagram: string | null }[]): SessaoRelatorio {
  const perfis = new Map(clientes.map((c) => [String(c.id), normalizarInstagram(c.instagram)]));
  const pilotos = new Map(session.competitors.map((c) => [String(c.kart), c]));
  return {
    ...session,
    competitors: session.competitors.map((c) => ({ ...c, instagram: perfis.get(String(c.customerId)) || null })),
    standings: session.standings.map((r) => ({ ...r, instagram: perfis.get(String(r.customerId ?? pilotos.get(String(r.kart))?.customerId)) || null })),
  };
}

/** Reaproveita o relatório oficial sem alterar o serviço da cronometragem ou o telão. */
export function prepararRelatorioRecepcao(html: string, timingUrl: string): string {
  const fetchOriginal = 'const response = await fetch(url);';
  const nomeOriginal = "nome: { h: 'Piloto', cls: 'col-nome', td: r => esc(r.name) },";
  const colunasOriginal = 'const cols = [C.pos, C.kart, C.nome];';
  const tabelaOriginal = 'let html = `<table class="rdlc-table rdlc-resultado"><thead><tr>`;';
  if (![fetchOriginal, nomeOriginal, colunasOriginal, tabelaOriginal].every((trecho) => html.includes(trecho))) throw new Error('Modelo de resultado incompatível com a impressão do Instagram.');
  return html
    .replace(fetchOriginal, "const token = new URLSearchParams(location.search).get('t') || '';\n  const response = await fetch('/api/office/crono/dados' + url.slice('/api/sessions'.length) + '?t=' + encodeURIComponent(token));")
    .replace(nomeOriginal, nomeOriginal + "\n      instagram: { h: 'Instagram', cls: 'col-instagram', td: r => esc(r.instagram || 'Não informado') },")
    .replace(colunasOriginal, 'const cols = [C.pos, C.kart, C.nome, C.instagram];')
    .replace(tabelaOriginal, 'const ocultasRecepcao = [C.total, C.difAnt, C.ultima];\n    for (let n = cols.length - 1; n >= 0; n--) { if (ocultasRecepcao.includes(cols[n])) cols.splice(n, 1); }\n    ' + tabelaOriginal)
    .replace('</style>', '@media print { body:not(.cupom) .rdlc-resultado .col-instagram { min-width:25mm; font-size:6.5pt; } body.cupom .rdlc-resultado .col-instagram { min-width:15mm; } }\n</style>')
    .replace('<style>', '<style>\n.rdlc-resultado .col-instagram { text-align:left; white-space:normal; overflow-wrap:anywhere; max-width:40mm; }\n@media print { body.cupom .rdlc-resultado .col-nome { min-width:0; white-space:normal; } body.cupom .rdlc-resultado .col-instagram { max-width:20mm; font-size:6.5pt; } }')
    .replace('href="/tokens.css"', `href="${timingUrl}/tokens.css"`)
    .replace('src="/kib-logo.png"', `src="${timingUrl}/kib-logo.png"`);
}

