/**
 * E-mails da reserva online (13/11/2026, paridade com o Granja Viana): cada mudança de status do pedido que o cliente
 * precisa saber vira UM e-mail, marcado em p.emails para não repetir.
 *   aguardando_pagamento → "Reserva recebida: falta pagar" (com o prazo e o link para pagar)
 *   pago                 → "Pagamento recebido"
 *   confirmado           → "Reserva confirmada" (data, pilotos, código, check-in, política)
 *   expirado             → "Reserva cancelada" (sem pagamento no prazo)
 *   recusado             → "Horário indisponível"
 *   pago_sem_vaga        → "Pagamento recebido, horário lotou" (estorno)
 */
import { enviarEmail, type MobileEmailEnv } from './mobile/email';

export type TipoEmailReserva = 'aguardando_pagamento' | 'pago' | 'confirmado' | 'expirado' | 'recusado' | 'pago_sem_vaga' | 'cancelado';
const TIPOS = new Set<string>(['aguardando_pagamento', 'pago', 'confirmado', 'expirado', 'recusado', 'pago_sem_vaga', 'cancelado']);

export type PedidoEmail = {
  id: string; codigo: string; status: string; quantidade: number; forma: 'pix' | 'cartao'; modo?: 'individual';
  cliente: { nome: string; email?: string };
  servidor?: { valorCentavos: number; expiraEm: string; descricao: string; inicio: string };
  pagamento?: { valorCentavos: number; billingType: string; pagoEm: string };
  grupo?: { link: string; painel: string };
  erro?: string;
  cancelamento?: { reembolsoCentavos: number };
  emails?: Record<string, string>;
};

const SITE = 'https://reservas.kartodromodebetim.com.br';
const ZAP = 'https://wa.me/5531998842898';
const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const reais = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function quandoBateria(inicio?: string) {
  const [d, h] = String(inicio ?? '').split('T');
  const [a, m, dia] = (d ?? '').split('-').map(Number);
  if (!a || !m || !dia) return '';
  const sem = DIAS[new Date(Date.UTC(a, m - 1, dia)).getUTCDay()];
  return `${sem}, ${String(dia).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a} às ${String(h ?? '').slice(0, 5)}`;
}

/** Hora local (Brasília) de um instante ISO: "17:42". */
function hora(iso?: string) {
  const t = Date.parse(String(iso ?? ''));
  if (!Number.isFinite(t)) return '';
  return new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

function botao(texto: string, href: string) {
  return `<p style="margin:24px 0"><a href="${esc(href)}" style="display:inline-block;background:#00e676;color:#03140b;font:700 16px Arial,sans-serif;text-transform:uppercase;text-decoration:none;padding:14px 26px;border-radius:4px">${esc(texto)}</a></p>`;
}

function tabela(linhas: [string, string][]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-top:1px solid #1f2621">`
    + linhas.map(([k, v]) => `<tr><td style="padding:9px 0;border-bottom:1px solid #1f2621;color:#8b958e;font-size:14px">${esc(k)}</td><td align="right" style="padding:9px 0;border-bottom:1px solid #1f2621;font-size:14px;font-weight:700">${esc(v)}</td></tr>`).join('')
    + `</table>`;
}

function moldura(titulo: string, corpo: string, rodape = true) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0;background:#030504">`
    + `<div style="background:#030504;padding:28px 16px;font:16px/1.5 Arial,sans-serif;color:#f7faf6"><div style="max-width:540px;margin:0 auto;background:#0b100c;border:1px solid #1f2621;border-radius:4px;padding:26px 22px">`
    + `<p style="margin:0 0 6px;color:#00e676;font:700 12px Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase">Kartódromo Internacional de Betim</p>`
    + `<h1 style="margin:0 0 14px;font:700 24px Arial,sans-serif;text-transform:uppercase">${esc(titulo)}</h1>${corpo}`
    + (rodape ? `<p style="margin:22px 0 0;color:#8b958e;font-size:13px">Dúvidas? Responda este e-mail ou fale com a recepção pelo <a href="${ZAP}" style="color:#00e676">WhatsApp (31) 99884-2898</a>.<br>Av. Adutora Várzea das Flores, 477 · Itacolomi · Betim/MG</p>` : '')
    + `</div></div></body></html>`;
}

export function conteudoEmailReserva(p: PedidoEmail, tipo: TipoEmailReserva) {
  const nome = (p.cliente.nome || '').trim().split(/\s+/)[0] || 'piloto';
  const dia = quandoBateria(p.servidor?.inicio);
  const bateria = p.servidor?.descricao || 'Bateria de kart';
  const valor = p.pagamento?.valorCentavos ?? p.servidor?.valorCentavos ?? null;
  const vagas = p.quantidade === 1 ? '1 piloto' : `${p.quantidade} pilotos`;
  const acompanhar = `${SITE}/#p=${p.id}`;
  const minhas = `${SITE}/#minhas`;
  const resumo: [string, string][] = [['Código', p.codigo], ['Bateria', bateria], ['Data', dia], ['Vagas', vagas]];
  if (valor != null) resumo.push(['Valor', reais(valor)]);
  const r = tabela(resumo);
  const tr = resumo.map(([k, v]) => `${k}: ${v}`).join('\n');

  switch (tipo) {
    case 'aguardando_pagamento': {
      const ate = hora(p.servidor?.expiraEm);
      const forma = p.forma === 'pix' ? 'Pix' : 'cartão';
      const subject = `Reserva ${p.codigo}: falta pagar${ate ? ` até ${ate}` : ''} · ${dia}`;
      const texto = `Oi, ${nome}! Separamos ${p.quantidade === 1 ? 'sua vaga' : `suas ${p.quantidade} vagas`} na bateria. Pague por ${forma}${ate ? ` até ${ate}` : ' nos próximos minutos'} para confirmar: depois disso as vagas voltam para venda.`;
      return {
        subject,
        text: `${texto}\n\n${tr}\n\nPagar: ${acompanhar}\n\nJá pagou? A confirmação chega em alguns minutos.`,
        html: moldura('Falta pagar', `<p>${esc(texto)}</p>${r}${botao(`Pagar com ${forma}`, acompanhar)}<p style="color:#a8b2aa;font-size:14px">Já pagou? Pode ignorar: a confirmação chega por e-mail em alguns minutos.</p>`),
      };
    }
    case 'pago': {
      const meio = p.pagamento?.billingType === 'PIX' ? 'Pix' : p.pagamento?.billingType === 'CREDIT_CARD' ? 'cartão de crédito' : p.forma === 'pix' ? 'Pix' : 'cartão';
      const texto = `Oi, ${nome}! Recebemos seu pagamento${valor != null ? ` de ${reais(valor)}` : ''} por ${meio}. Agora a recepção confirma a sua vaga: você recebe outro e-mail em instantes.`;
      return {
        subject: `Pagamento recebido · reserva ${p.codigo}`,
        text: `${texto}\n\n${tr}\n\nAcompanhe: ${acompanhar}`,
        html: moldura('Pagamento recebido', `<p>${esc(texto)}</p>${r}${botao('Acompanhar a reserva', acompanhar)}`),
      };
    }
    case 'confirmado': {
      const grupo = p.modo === 'individual' && p.grupo
        ? `<p><strong>Cada um paga o seu:</strong> mande o link do grupo para quem vai correr. Cada um faz o cadastro e paga a própria vaga.</p>${botao('Mandar o link do grupo', `https://wa.me/?text=${encodeURIComponent(`Bora correr de kart, ${dia}! Faz teu cadastro e paga tua vaga: ${p.grupo.link}`)}`)}<p style="font-size:14px">Link do grupo: <a href="${esc(p.grupo.link)}" style="color:#00e676">${esc(p.grupo.link)}</a><br><a href="${esc(p.grupo.painel)}" style="color:#00e676">Painel do grupo: veja quem já entrou e pagou</a></p>`
        : '';
      const grupoTxt = p.modo === 'individual' && p.grupo ? `\n\nLink do grupo (cada um paga o seu): ${p.grupo.link}\nPainel do grupo: ${p.grupo.painel}` : '';
      const dicas = [
        'Chegue 1 hora antes da largada.',
        'No dia, abra Minhas reservas no celular e toque em "Cheguei! Fazer check-in": seu termo fica pronto na recepção.',
        'Venha de calçado fechado. Gestantes não podem correr.',
        'Menores de 18 anos precisam de um responsável presente para assinar o termo.',
        'Cancelamento com 48 horas ou mais de antecedência: reembolso de 95%. Com menos de 48 horas não há reembolso.',
      ];
      const texto = `Oi, ${nome}! Sua reserva está confirmada. Te esperamos na pista!`;
      return {
        subject: `✅ Reserva confirmada · ${dia}`,
        text: `${texto}\n\n${tr}${grupoTxt}\n\n${dicas.map((d) => `• ${d}`).join('\n')}\n\nMinhas reservas (com o CPF e o código ${p.codigo}): ${minhas}`,
        html: moldura('Reserva confirmada', `<p>${esc(texto)}</p>${r}${grupo}`
          + `<p style="margin:20px 0 8px;font-weight:700">Antes de vir</p><ul style="margin:0;padding-left:20px;color:#d4dbd5;font-size:14px">${dicas.map((d) => `<li style="margin:0 0 6px">${esc(d)}</li>`).join('')}</ul>`
          + botao('Ver minhas reservas', minhas) + `<p style="color:#a8b2aa;font-size:14px">Para entrar em Minhas reservas use seu CPF e o código <strong>${esc(p.codigo)}</strong>.</p>`),
      };
    }
    case 'expirado': {
      const texto = `Oi, ${nome}. O prazo para pagar a reserva ${p.codigo} terminou sem pagamento, então ela foi cancelada e as vagas voltaram para venda. Nada foi cobrado.`;
      return {
        subject: `Reserva ${p.codigo} cancelada: pagamento não recebido`,
        text: `${texto}\n\n${tr}\n\nQuer correr mesmo assim? Faça uma nova reserva: ${SITE}\n\nSe você pagou e recebeu este e-mail, responda com o comprovante que a recepção resolve.`,
        html: moldura('Reserva cancelada', `<p>${esc(texto)}</p>${r}${botao('Fazer nova reserva', SITE)}<p style="color:#a8b2aa;font-size:14px">Se você pagou e recebeu este e-mail, responda com o comprovante que a recepção resolve.</p>`),
      };
    }
    case 'cancelado': {
      const reemb = p.cancelamento?.reembolsoCentavos ?? 0;
      const texto = reemb > 0
        ? `Oi, ${nome}. Sua reserva ${p.codigo} foi cancelada como você pediu. O estorno de ${reais(reemb)} (95% do valor pago) já foi pedido. O prazo para o valor aparecer depende do banco: no Pix costuma ser rápido; no cartão pode levar até 2 faturas.`
        : `Oi, ${nome}. Sua reserva ${p.codigo} foi cancelada como você pediu. Como faltavam menos de 48 horas para a bateria, não há reembolso, conforme a Política de Cancelamento.`;
      return {
        subject: `Reserva ${p.codigo} cancelada${reemb > 0 ? ` · estorno de ${reais(reemb)}` : ''}`,
        text: `${texto}\n\n${tr}\n\nQuer correr em outro dia? ${SITE}`,
        html: moldura('Reserva cancelada', `<p>${esc(texto)}</p>${r}${botao('Reservar outro horário', SITE)}`),
      };
    }
    case 'recusado': {
      const texto = `Oi, ${nome}. ${p.erro || 'Esse horário não está mais disponível.'} A reserva ${p.codigo} não foi feita e nada foi cobrado.`;
      return {
        subject: `Reserva ${p.codigo} não concluída: horário indisponível`,
        text: `${texto}\n\nEscolha outro horário: ${SITE}`,
        html: moldura('Horário indisponível', `<p>${esc(texto)}</p>${botao('Escolher outro horário', SITE)}`),
      };
    }
    case 'pago_sem_vaga': {
      const texto = `Oi, ${nome}. Seu pagamento${valor != null ? ` de ${reais(valor)}` : ''} chegou depois que o horário lotou, então não conseguimos confirmar a vaga. A recepção vai devolver o valor integral ou remarcar para outro horário, como você preferir.`;
      return {
        subject: `Reserva ${p.codigo}: pagamento recebido, horário lotado`,
        text: `${texto}\n\n${tr}\n\nFale com a recepção: ${ZAP}`,
        html: moldura('Horário lotado', `<p>${esc(texto)}</p>${r}${botao('Falar com a recepção', ZAP)}`, false)
          .replace('</div></div></body>', `<p style="margin:22px 0 0;color:#8b958e;font-size:13px">Responda este e-mail ou chame no WhatsApp (31) 99884-2898.</p></div></div></body>`),
      };
    }
  }
}

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Manda o e-mail do status atual se ainda não saiu. Devolve true quando marcou p.emails (o chamador grava o pedido).
 * Reserva "cada um paga o seu" confirmada sem o link do grupo espera o link chegar.
 */
export async function avisarPorEmail(env: MobileEmailEnv, p: PedidoEmail) {
  if (!TIPOS.has(p.status)) return false;
  const para = String(p.cliente.email ?? '').trim();
  if (!EMAIL_OK.test(para)) return false;
  p.emails ??= {};
  if (p.emails[p.status]) return false;
  if (p.status === 'confirmado' && p.modo === 'individual' && !p.grupo) return false;
  // "pago" e "confirmado" costumam chegar juntos: quem já recebeu a confirmação não precisa do aviso de pagamento.
  if (p.status === 'pago' && p.emails.confirmado) return false;
  const c = conteudoEmailReserva(p, p.status as TipoEmailReserva);
  if (!(await enviarEmail(env, para, c.subject, c.text, c.html).catch(() => false))) return false;
  p.emails[p.status] = new Date().toISOString();
  return true;
}

// ---------------------------------------------------------------- cadastro (link do grupo e termo)

export type CadastroEmail = {
  nome: string; email?: string;
  grupo?: { responsavel: string; bateria: string; inicio: string } | null;
  pagamento?: { link?: string; valorCentavos?: number } | null;
  termo?: { versao: string; aceitoEm: string; imagem?: boolean } | null;
};

/** "Confirmação de participação": quem entrou pelo link do grupo. */
export function conteudoParticipacao(c: CadastroEmail) {
  const g = c.grupo!;
  const nome = c.nome.trim().split(/\s+/)[0] || 'piloto';
  const dia = quandoBateria(g.inicio);
  const pagar = c.pagamento?.link ? c.pagamento : null;
  const texto = `Oi, ${nome}! Você entrou no grupo de ${g.responsavel} para ${g.bateria}, ${dia}.`
    + (pagar ? ` Para garantir sua vaga, pague${pagar.valorCentavos ? ` ${reais(pagar.valorCentavos)}` : ''} pelo link abaixo.` : ' Seu cadastro já está com a recepção.');
  const linhas: [string, string][] = [['Grupo de', g.responsavel], ['Bateria', g.bateria], ['Data', dia]];
  return {
    subject: `Confirmação de participação · ${g.bateria} · ${dia}`,
    text: `${texto}\n\n${linhas.map(([k, v]) => `${k}: ${v}`).join('\n')}${pagar ? `\n\nPagar: ${pagar.link}` : ''}\n\nChegue 1 hora antes da largada.`,
    html: moldura('Você está no grupo', `<p>${esc(texto)}</p>${tabela(linhas)}${pagar ? botao('Pagar minha vaga', pagar.link!) : ''}<p style="color:#a8b2aa;font-size:14px">Chegue 1 hora antes da largada.</p>`),
  };
}

/** "Termo de responsabilidade": comprovante do aceite digital. */
export function conteudoTermo(c: CadastroEmail) {
  const t = c.termo!;
  const nome = c.nome.trim().split(/\s+/)[0] || 'piloto';
  const quando = new Date(Date.parse(t.aceitoEm)).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
  const texto = `Oi, ${nome}! Seu termo de responsabilidade foi assinado digitalmente no cadastro. Guarde este e-mail como comprovante.`;
  const linhas: [string, string][] = [['Nome', c.nome], ['Versão do termo', t.versao], ['Assinado em', quando], ['Uso de imagem', t.imagem === false ? 'Não autorizado' : 'Autorizado']];
  return {
    subject: 'Termo de responsabilidade assinado · Kartódromo de Betim',
    text: `${texto}\n\n${linhas.map(([k, v]) => `${k}: ${v}`).join('\n')}`,
    html: moldura('Termo assinado', `<p>${esc(texto)}</p>${tabela(linhas)}`),
  };
}

/** Manda os e-mails do cadastro (participação e termo). Falha de envio não atrapalha o cadastro. */
export async function avisarCadastro(env: MobileEmailEnv, c: CadastroEmail) {
  const para = String(c.email ?? '').trim();
  if (!EMAIL_OK.test(para)) return 0;
  let n = 0;
  for (const m of [c.grupo ? conteudoParticipacao(c) : null, c.termo ? conteudoTermo(c) : null]) {
    if (m && (await enviarEmail(env, para, m.subject, m.text, m.html).catch(() => false))) n++;
  }
  return n;
}
