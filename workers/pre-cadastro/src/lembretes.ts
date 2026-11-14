/**
 * Lembretes por e-mail dos grupos (12/11/2026, decisão do dono: e-mail automático). O SRVKART escolhe quem recebe
 * (tem e-mail, cadastro e pagamento de cada vaga) e manda em POST /api/sync/lembretes; aqui o texto é montado e o
 * envio sai pelo mesmo caminho dos e-mails do app. Cada lembrete tem uma chave e sai UMA vez (marca no R2).
 *  - 'pagar':     quem fez o cadastro num grupo "cada um paga o seu" e ainda não pagou a vaga;
 *  - 'cadastros': quem organiza, quando ainda há vagas sem cadastro;
 *  - 'soltas':    quem organiza, quando vagas sem pagamento voltaram para venda 24 h antes (grupos do site).
 */
import { enviarEmail, type MobileEmailEnv } from './mobile/email';

type R2 = { get(k: string): Promise<unknown | null>; put(k: string, v: string): Promise<unknown> };
export type EnvLembretes = MobileEmailEnv & { PRE: R2 };

export type Lembrete = {
  chave: string; tipo: 'pagar' | 'cadastros' | 'soltas' | 'removido'; para: string; nome: string; bateria: string; inicio: string;
  link: string; painel?: string | null; responsavel?: string; valorCentavos?: number; faltam?: number; soltaEm24h?: boolean;
};

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
function quando(inicio: string) {
  const [d, h] = String(inicio).split('T');
  const [a, m, dia] = d.split('-').map(Number);
  const sem = DIAS[new Date(Date.UTC(a, m - 1, dia)).getUTCDay()];
  return `${sem}, ${String(dia).padStart(2, '0')}/${String(m).padStart(2, '0')} às ${String(h ?? '').slice(0, 5)}`;
}
const reais = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const linkSeguro = (v: unknown) => { const s = String(v ?? ''); return /^https:\/\/((cadastro|reservas)\.kartodromodebetim\.com\.br|www\.asaas\.com|asaas\.com)\/[\w\-./?=&%]*$/.test(s) ? s : null; };

function botao(texto: string, href: string) {
  return `<p style="margin:24px 0"><a href="${esc(href)}" style="display:inline-block;background:#00e676;color:#03140b;font:700 17px Arial,sans-serif;text-transform:uppercase;text-decoration:none;padding:14px 26px;border-radius:4px">${esc(texto)}</a></p>`;
}
function moldura(titulo: string, corpo: string) {
  return `<div style="background:#030504;padding:28px 16px;font:16px/1.5 Arial,sans-serif;color:#f7faf6"><div style="max-width:520px;margin:0 auto;background:#0b100c;border:1px solid #1f2621;border-radius:4px;padding:26px 22px">`
    + `<p style="margin:0 0 6px;color:#00e676;font:700 12px Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase">Kartódromo de Betim</p>`
    + `<h1 style="margin:0 0 14px;font:700 24px Arial,sans-serif;text-transform:uppercase">${esc(titulo)}</h1>${corpo}`
    + `<p style="margin:22px 0 0;color:#8b958e;font-size:13px">Dúvidas? Responda este e-mail ou fale com a recepção pelo WhatsApp (31) 99884-2898.</p></div></div>`;
}

export function conteudoLembrete(l: Lembrete) {
  const nome = l.nome.trim().split(/\s+/)[0] || 'piloto';
  const dia = quando(l.inicio);
  if (l.tipo === 'pagar') {
    const valor = l.valorCentavos ? ` (${reais(l.valorCentavos)})` : '';
    const prazo = l.soltaEm24h ? ' Vagas sem pagamento 24 horas antes da bateria voltam para venda.' : '';
    const subject = `Falta pagar sua vaga no kart · ${dia}`;
    const text = `Oi, ${nome}! Seu cadastro no grupo de ${l.responsavel ?? 'seus amigos'} para ${l.bateria}, ${dia}, está feito, mas a sua vaga ainda não foi paga${valor}.${prazo}\n\nPague por Pix ou cartão: ${l.link}\n\nJá pagou? Pode ignorar este e-mail: a confirmação chega em alguns minutos.`;
    const html = moldura('Falta pagar sua vaga', `<p>Oi, ${esc(nome)}! Seu cadastro no grupo de <strong>${esc(l.responsavel ?? 'seus amigos')}</strong> para <strong>${esc(l.bateria)}, ${esc(dia)}</strong> está feito, mas a sua vaga ainda não foi paga${esc(valor)}.${esc(prazo)}</p>`
      + botao('Pagar minha vaga', l.link) + `<p style="color:#a8b2aa">Já pagou? Pode ignorar este e-mail: a confirmação chega em alguns minutos.</p>`);
    return { subject, text, html };
  }
  if (l.tipo === 'removido') {
    const texto = `Oi, ${nome}. ${l.responsavel ?? 'Quem organiza'} tirou você do grupo de ${l.bateria}, ${dia}. Sua vaga voltou para o grupo e nada foi cobrado de você. Se foi engano, fale com quem organizou ou com a recepção.`;
    return { subject: `Remoção de participação · ${l.bateria} · ${dia}`, text: `${texto}\n\nQuer correr em outro horário? ${l.link}`,
      html: moldura('Você saiu do grupo', `<p>${esc(texto)}</p>` + botao('Reservar outro horário', l.link)) };
  }
  if (l.tipo === 'soltas') {
    const n = Number(l.faltam) || 0;
    const qtd = n === 1 ? '1 vaga' : `${n} vagas`;
    const subject = `${n === 1 ? '1 vaga do seu grupo voltou' : `${n} vagas do seu grupo voltaram`} para venda · ${dia}`;
    const texto = `Oi, ${nome}! Faltando 24 horas para ${l.bateria}, ${dia}, ${qtd} do seu grupo ainda não tinha${n === 1 ? '' : 'm'} pagamento e voltou${n === 1 ? '' : 'aram'} para venda, como avisado na reserva. Quem já pagou continua garantido. Se alguém ainda quiser correr, pode reservar no site enquanto houver vaga ou falar com a recepção.`;
    const text = `${texto}\n\nReservar: https://reservas.kartodromodebetim.com.br${l.painel ? `\nSeu grupo: ${l.painel}` : ''}`;
    const html = moldura(n === 1 ? '1 vaga voltou para venda' : `${n} vagas voltaram para venda`, `<p>${esc(texto)}</p>` + botao('Reservar mais vagas', 'https://reservas.kartodromodebetim.com.br')
      + (l.painel ? `<p><a href="${esc(l.painel)}" style="color:#00e676">Ver como ficou o seu grupo</a></p>` : ''));
    return { subject, text, html };
  }
  const n = Number(l.faltam) || 0;
  const faltam = n === 1 ? 'falta 1 pessoa fazer o cadastro' : `faltam ${n} pessoas fazerem o cadastro`;
  const subject = `${n === 1 ? 'Falta 1 cadastro' : `Faltam ${n} cadastros`} no seu grupo · ${dia}`;
  const texto = `Oi, ${nome}! No seu grupo de ${l.bateria}, ${dia}, ainda ${faltam}. Mande o link do grupo para quem vai correr: cada um faz o próprio cadastro${l.soltaEm24h ? ' e paga a vaga. Vagas sem pagamento 24 horas antes da bateria voltam para venda' : ''}.`;
  const text = `${texto}\n\nLink do grupo: ${l.link}${l.painel ? `\nVeja quem já entrou: ${l.painel}` : ''}`;
  const zap = `https://wa.me/?text=${encodeURIComponent(`Bora correr de kart no Kartódromo de Betim, ${dia}! Entra no grupo e faz teu cadastro: ${l.link}`)}`;
  const html = moldura(n === 1 ? 'Falta 1 cadastro' : `Faltam ${n} cadastros`, `<p>${esc(texto)}</p>` + botao('Mandar o link no WhatsApp', zap)
    + `<p>Link do grupo: <a href="${esc(l.link)}" style="color:#00e676">${esc(l.link)}</a></p>`
    + (l.painel ? `<p><a href="${esc(l.painel)}" style="color:#00e676">Ver quem já entrou e pagou</a></p>` : ''));
  return { subject, text, html };
}

/** POST /api/sync/lembretes { lembretes: Lembrete[] } → envia os que ainda não saíram. */
export async function lembretesSync(req: Request, env: EnvLembretes) {
  const corpo = (await req.json().catch(() => ({}))) as { lembretes?: Lembrete[] };
  const lista = Array.isArray(corpo.lembretes) ? corpo.lembretes.slice(0, 100) : [];
  const res = { enviados: 0, jaEnviados: 0, invalidos: 0, falhas: 0 };
  for (const l of lista) {
    const link = linkSeguro(l?.link);
    const ok = l && (l.tipo === 'pagar' || l.tipo === 'cadastros' || l.tipo === 'soltas' || l.tipo === 'removido') && /^[\w:.-]{3,80}$/.test(String(l.chave)) && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(l.para)) && link;
    if (!ok) { res.invalidos++; continue; }
    const marca = `lembretes/${l.chave}`;
    if (await env.PRE.get(marca)) { res.jaEnviados++; continue; }
    const c = conteudoLembrete({ ...l, link, painel: linkSeguro(l.painel) });
    if (await enviarEmail(env, String(l.para).trim(), c.subject, c.text, c.html)) {
      await env.PRE.put(marca, JSON.stringify({ em: new Date().toISOString(), tipo: l.tipo }));
      res.enviados++;
    } else res.falhas++;
  }
  return new Response(JSON.stringify(res), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
}
