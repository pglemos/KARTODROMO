/**
 * E-mail do resultado para os pilotos (como o LapTime fazia ao finalizar a prova): um e-mail por piloto com
 * o resumo dele, a classificação e dois PDFs anexados — o resultado oficial da prova e o volta a volta do piloto.
 * Só monta textos/HTML (sem IO); quem envia é o servidor da cronometragem.
 */
import type { Competitor, Session, SessionType, Standing } from './race-engine';
import { nomeProprio } from '../nomes';

export type EmpresaEmail = { nome: string; telefone?: string | null; email?: string | null; cidade?: string | null; estado?: string | null; site?: string | null };

export type ContextoProva = {
  empresa: EmpresaEmail;
  evento: string | null;
  grupo: string | null;
  prova: string;
  tipo: SessionType;
  tracado: string | null;
  /** hora da prova (início, ou fim/criação quando não houve largada) */
  quando: number;
  classificacao: Standing[];
};

export type VoltaPiloto = { numero: number; ms: number; anulada: boolean; melhor: boolean; hora: number };

export type PilotoEmail = { nome: string; kart: string; email: string; standing: Standing | null; voltas: VoltaPiloto[] };

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** 55.214 · 1:02.470 · 1:02:03.004 (mesmo formato da tela da cronometragem) */
export function tempo(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '—';
  const total = Math.round(ms);
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const mil = String(total % 1000).padStart(3, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${mil}`;
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}.${mil}`;
  return `${s}.${mil}`;
}

const dataHora = (ms: number) => new Date(ms).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const hora = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function nomeTipo(tipo: SessionType) {
  return tipo === 'corrida' ? 'Corrida' : tipo === 'classificacao' ? 'Tomada de tempo' : tipo === 'equalizacao' ? 'Equalização' : 'Treino';
}

/** corrida = ordem de chegada; tomada de tempo/treino = melhor volta */
function criterio(tipo: SessionType) {
  return tipo === 'corrida' ? 'Classificação oficial · ordem de chegada' : 'Classificação pela melhor volta';
}

function diferenca(r: Standing, tipo: SessionType) {
  if (r.position === 1) return '—';
  if (tipo === 'corrida' && r.gapLaps > 0) return `+${r.gapLaps} volta${r.gapLaps === 1 ? '' : 's'}`;
  return r.gapMs != null ? `+${tempo(r.gapMs)}` : '—';
}

/** Voltas válidas e anuladas do piloto, em ordem, com a melhor marcada (a 1ª passagem só abre a volta 1). */
export function voltasDoPiloto(c: Competitor): VoltaPiloto[] {
  const passagens = c.crossings.filter((x) => !x.deleted && x.lapMs != null && x.lapMs > 0).sort((a, b) => a.wallMs - b.wallMs);
  const voltas = passagens.map((x, i) => ({ numero: i + 1, ms: x.lapMs as number, anulada: Boolean(x.invalid), melhor: false, hora: x.wallMs }));
  const validas = voltas.filter((v) => !v.anulada);
  if (validas.length) {
    const melhor = validas.reduce((a, b) => (b.ms < a.ms ? b : a));
    melhor.melhor = true;
  }
  return voltas;
}

/** E-mail que dá para mandar: tem @, domínio com ponto e sem espaço. */
export function emailValido(v: unknown): v is string {
  return typeof v === 'string' && /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[a-z]{2,}$/i.test(v.trim());
}

/** Quem recebe: competidores de verdade (não o "Kart 12" que só passou na linha), com e-mail válido. */
export function destinatarios(s: Session, emailDoCliente: Map<string, string>): { competidor: Competitor; email: string }[] {
  const vistos = new Set<string>();
  const lista: { competidor: Competitor; email: string }[] = [];
  for (const c of s.competitors) {
    if (c.autoAdded || c.detalhes?.oculto) continue;
    const email = (c.customerId ? emailDoCliente.get(String(c.customerId)) : undefined) ?? c.detalhes?.email ?? '';
    const e = email.trim().toLowerCase();
    if (!emailValido(e) || vistos.has(e + '|' + c.kart)) continue;
    vistos.add(e + '|' + c.kart);
    lista.push({ competidor: c, email: e });
  }
  return lista;
}

export function assunto(ctx: ContextoProva) {
  const partes = [ctx.grupo, ctx.prova].filter(Boolean).join(' · ');
  return `Resultado oficial · ${partes} | ${ctx.empresa.nome}`;
}

function primeiroNome(nome: string) {
  const n = nome.trim().split(/\s+/)[0] ?? '';
  return n ? n[0].toUpperCase() + n.slice(1).toLowerCase() : 'piloto';
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Linhas "Local / Grupo / Traçado / Prova" do LapTime + data. */
function ficha(ctx: ContextoProva) {
  return [
    ['Local', ctx.empresa.nome],
    ['Evento', ctx.evento],
    ['Grupo', ctx.grupo],
    // "CORRIDA (corrida)" repetia: o tipo só entra quando o nome da prova não diz
    ['Prova', semAcento(ctx.prova).includes(semAcento(nomeTipo(ctx.tipo))) ? ctx.prova : `${ctx.prova} (${nomeTipo(ctx.tipo).toLowerCase()})`],
    ['Traçado', ctx.tracado],
    ['Data', dataHora(ctx.quando)],
  ].filter(([, v]) => v) as [string, string][];
}

function tabelaClassificacao(ctx: ContextoProva, destaqueKart: string | null, estiloEmail: boolean) {
  const cel = estiloEmail ? 'padding:8px 6px;border-bottom:1px solid #E5E5EA;font-size:13px;' : '';
  const th = estiloEmail ? 'padding:7px 6px;font-size:11px;color:#6E6E73;text-align:left;border-bottom:1px solid #E5E5EA;font-weight:600;' : '';
  const dir = estiloEmail ? 'text-align:right;white-space:nowrap;' : '';
  const linhas = ctx.classificacao
    .map((r) => {
      const eu = destaqueKart != null && r.kart === destaqueKart;
      const fundo = eu ? (estiloEmail ? 'background:#E8F5EE;font-weight:700;' : '') : '';
      return `<tr${eu && !estiloEmail ? ' class="eu"' : ''}>
        <td style="${cel}${fundo}">${r.position}º</td><td style="${cel}${fundo}">${esc(r.kart)}</td><td style="${cel}${fundo}">${esc(nomeProprio(r.name))}</td>
        <td style="${cel}${fundo}${dir}" class="r">${r.laps}</td><td style="${cel}${fundo}${dir}" class="r">${tempo(r.bestLapMs)}</td>
        ${ctx.tipo === 'corrida' ? `<td style="${cel}${fundo}${dir}" class="r">${tempo(r.totalMs)}</td>` : ''}<td style="${cel}${fundo}${dir}" class="r">${diferenca(r, ctx.tipo)}</td></tr>`;
    })
    .join('');
  return `<table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;">
    <thead><tr><th style="${th}">Pos.</th><th style="${th}">Kart</th><th style="${th}">Piloto</th><th style="${th}${dir}" class="r">Voltas</th>
    <th style="${th}${dir}" class="r">Melhor volta</th>${ctx.tipo === 'corrida' ? `<th style="${th}${dir}" class="r">Tempo total</th>` : ''}<th style="${th}${dir}" class="r">Diferença</th></tr></thead>
    <tbody>${linhas}</tbody></table>`;
}

/** Corpo do e-mail (HTML compatível com Gmail/Outlook: tabelas e estilo inline). logoCid = imagem anexada inline. */
export function htmlEmail(ctx: ContextoProva, p: PilotoEmail, logoCid: string | null) {
  const s = p.standing;
  const total = ctx.classificacao.length;
  const resumo = s
    ? [
        ['Posição', `${s.position}º de ${total}`],
        ['Melhor volta', `${tempo(s.bestLapMs)}${s.bestLapNumber ? ` (volta ${s.bestLapNumber})` : ''}`],
        ['Voltas', String(s.laps)],
        ['Kart', p.kart],
      ]
    : [['Kart', p.kart]];
  const cartoes = resumo
    .map(([k, v]) => `<td style="padding:12px 10px;background:#F5F5F7;border-radius:10px;" width="25%"><div style="font-size:11px;color:#6E6E73;">${esc(k)}</div><div style="font-size:17px;font-weight:700;color:#1D1D1F;margin-top:2px;">${esc(v)}</div></td>`)
    .join('<td width="8"></td>');
  const contato = [ctx.empresa.telefone, ctx.empresa.email, ctx.empresa.site].filter(Boolean).map(esc).join(' · ');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#F2F2F5;font-family:'Segoe UI',Arial,sans-serif;color:#1D1D1F;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F2F2F5;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#1D1D1F;padding:18px 24px;">${logoCid ? `<img src="cid:${logoCid}" alt="${esc(ctx.empresa.nome)}" height="36" style="display:block;height:36px;">` : `<span style="color:#fff;font-weight:700;font-size:16px;">${esc(ctx.empresa.nome)}</span>`}</td></tr>
  <tr><td style="padding:26px 24px 8px;">
    <div style="font-size:12px;color:#0B7A53;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">Resultado oficial · ${esc(nomeTipo(ctx.tipo))}</div>
    <h1 style="margin:6px 0 10px;font-size:22px;">Olá, ${esc(primeiroNome(nomeProprio(p.nome)))}!</h1>
    <p style="margin:0 0 6px;font-size:14px;line-height:1.5;">Obrigado por correr com a gente${ctx.evento ? ` no evento <b>${esc(ctx.evento)}</b>` : ''}. O resultado oficial da prova e o seu volta a volta estão em PDF, anexados neste e-mail.</p>
  </td></tr>
  <tr><td style="padding:10px 24px 4px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${cartoes}</tr></table></td></tr>
  <tr><td style="padding:14px 24px 0;"><table role="presentation" cellspacing="0" cellpadding="0" style="font-size:13px;line-height:1.6;">
    ${ficha(ctx).map(([k, v]) => `<tr><td style="color:#6E6E73;padding-right:12px;">${esc(k)}</td><td style="font-weight:600;">${esc(v)}</td></tr>`).join('')}</table></td></tr>
  <tr><td style="padding:18px 24px 6px;"><div style="font-size:14px;font-weight:700;margin-bottom:6px;">${esc(criterio(ctx.tipo))}</div>${tabelaClassificacao(ctx, p.kart, true)}</td></tr>
  <tr><td style="padding:18px 24px 24px;font-size:11.5px;color:#6E6E73;line-height:1.5;border-top:1px solid #F2F2F5;">
    ${esc(ctx.empresa.nome)}${contato ? ` · ${contato}` : ''}<br>Você recebeu este e-mail porque participou desta prova. Este é um envio automático: não responda.
  </td></tr>
</table></td></tr></table></body></html>`;
}

/** Texto puro (para quem lê e-mail sem HTML). */
export function textoEmail(ctx: ContextoProva, p: PilotoEmail) {
  const s = p.standing;
  return [
    `Olá, ${primeiroNome(nomeProprio(p.nome))}!`,
    '',
    `Resultado oficial — ${nomeTipo(ctx.tipo)}: ${[ctx.grupo, ctx.prova].filter(Boolean).join(' · ')}`,
    s ? `Posição: ${s.position}º de ${ctx.classificacao.length} · Melhor volta: ${tempo(s.bestLapMs)} · Voltas: ${s.laps} · Kart ${p.kart}` : `Kart ${p.kart}`,
    ...ficha(ctx).map(([k, v]) => `${k}: ${v}`),
    '',
    ...ctx.classificacao.map((r) => `${r.position}º  kart ${r.kart}  ${nomeProprio(r.name)}  ${r.laps} voltas  melhor ${tempo(r.bestLapMs)}  ${diferenca(r, ctx.tipo)}`),
    '',
    'O resultado oficial e o seu volta a volta estão em PDF anexados.',
    `${ctx.empresa.nome} — envio automático, não responda.`,
  ].join('\n');
}

const cssPdf = `@page{size:A4;margin:14mm 12mm}*{box-sizing:border-box}body{font:12px/1.35 'Segoe UI',Arial,sans-serif;color:#1D1D1F;margin:0}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1D1D1F;padding-bottom:10px;margin-bottom:10px}
header .logo{background:#1D1D1F;border-radius:6px;padding:7px 14px}header .logo img{height:28px;display:block}header .logo span{color:#fff;font-weight:700}
h1{font-size:16px;margin:0 0 2px}h2{font-size:13px;margin:16px 0 6px}.sub{color:#3A3A3C;font-size:11.5px;text-align:right}
table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #E5E5EA;padding:6px 5px;text-align:left}th{font-size:10.5px;color:#6E6E73;font-weight:600}
.r{text-align:right;white-space:nowrap}tr.eu td,tr.melhor td{background:#E8F5EE;font-weight:700}tr.anulada td{color:#8E8E93;text-decoration:line-through}
.ficha{display:grid;grid-template-columns:repeat(3,1fr);gap:4px 16px;font-size:11.5px;margin:4px 0 8px}.ficha b{font-weight:600}.muted{color:#6E6E73;font-size:10.5px}
.quebra{page-break-before:always}`;

function cabecalhoPdf(ctx: ContextoProva, titulo: string, logoDataUri: string | null) {
  return `<header><div class="logo">${logoDataUri ? `<img src="${logoDataUri}" alt="">` : `<span>${esc(ctx.empresa.nome)}</span>`}</div>
    <div class="sub"><h1>${esc(titulo)}</h1>${esc([ctx.grupo, ctx.prova].filter(Boolean).join(' · '))}<br>${esc(dataHora(ctx.quando))}</div></header>
    <div class="ficha">${ficha(ctx).map(([k, v]) => `<div>${esc(k)}: <b>${esc(v)}</b></div>`).join('')}</div>`;
}

/** PDF 1 (igual para todos): resultado oficial da prova. */
export function htmlPdfResultado(ctx: ContextoProva, logoDataUri: string | null) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Resultado oficial</title><style>${cssPdf}</style></head><body>
    ${cabecalhoPdf(ctx, 'Resultado oficial', logoDataUri)}
    <h2>${esc(criterio(ctx.tipo))}</h2>${tabelaClassificacao(ctx, null, false)}
    <p class="muted">Emitido automaticamente pela cronometragem · ${esc(ctx.empresa.nome)}</p></body></html>`;
}

/** PDF 2 (de cada piloto): volta a volta, com a melhor volta destacada e as anuladas riscadas. */
export function htmlPdfVoltaAVolta(ctx: ContextoProva, p: PilotoEmail, logoDataUri: string | null) {
  const melhor = p.voltas.find((v) => v.melhor)?.ms ?? null;
  const linhas = p.voltas
    .map((v) => `<tr class="${v.anulada ? 'anulada' : v.melhor ? 'melhor' : ''}"><td>${v.numero}</td><td class="r">${tempo(v.ms)}</td>
      <td class="r">${v.anulada ? 'anulada' : melhor != null && !v.melhor ? `+${tempo(v.ms - melhor)}` : v.melhor ? 'melhor volta' : '—'}</td><td class="r">${hora(v.hora)}</td></tr>`)
    .join('');
  const s = p.standing;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Volta a volta</title><style>${cssPdf}</style></head><body>
    ${cabecalhoPdf(ctx, 'Volta a volta', logoDataUri)}
    <h2>${esc(nomeProprio(p.nome))} · kart ${esc(p.kart)}${s ? ` · ${s.position}º lugar` : ''}</h2>
    <table><thead><tr><th>Volta</th><th class="r">Tempo</th><th class="r">Diferença para a melhor</th><th class="r">Hora</th></tr></thead><tbody>${linhas || '<tr><td colspan="4">Nenhuma volta registrada.</td></tr>'}</tbody></table>
    <p class="muted">Emitido automaticamente pela cronometragem · ${esc(ctx.empresa.nome)}</p></body></html>`;
}

/** Nome de arquivo seguro para o anexo. */
export function nomeArquivo(base: string) {
  return base.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'resultado';
}
