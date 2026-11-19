/**
 * Reserva em grupo (painel web · Agenda): cada piloto do grupo com nome, WhatsApp e link de cadastro próprio, e o
 * pagamento de cada um. As vagas continuam sendo kart.inscricao (uma por piloto, no nome do responsável até a pessoa
 * se cadastrar pelo link), então Recepção, totem, site, sorteio e cronometragem enxergam a reserva como sempre.
 *
 * Modos de pagamento:
 *  - unico:      o responsável paga o grupo inteiro (um link Asaas com o total);
 *  - individual: cada piloto paga o seu (um link Asaas por piloto);
 *  - sinal:      o responsável paga uma parte (SinalPct do total) e cada um acerta o resto na recepção.
 * Quando um piloto fica coberto, a vaga dele é marcada paga (Inscricao.Pago, como o "pago antecipado" da Recepção).
 * Pagamento feito no caixa da Recepção ou pelo site também conta (a vaga já vem paga).
 */
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { precoPrimeiraVezDoGrupo, reservarCupomDoLink } from './reserva-online';
import { insertCliente, one, onlyDigits, query, tx, type ClienteInput } from './db';
import { HttpError, cancelarReserva, exigePodeFecharBateria, exigePermissaoOffice, inscreverN, moverReservas } from './office';
import { avaliarElegibilidadeVoucher, vouchersDisponiveisParaCliente } from './vouchers';
import type { Sessao } from './auth';
import { ANIVERSARIO_MIN_CONVIDADOS, ANIVERSARIO_PRECO_PADRAO } from './eventos-schema';

type Req = { method: string; url: URL; body: () => Promise<Record<string, unknown>>; sessao: Sessao };
type Res = (status: number, body: unknown) => void;
type Log = (...args: unknown[]) => void;

export const LINK_CADASTRO = 'https://cadastro.kartodromodebetim.com.br';
const MODOS = ['unico', 'individual', 'sinal'] as const;
const ORIGENS = ['recepcao', 'whatsapp', 'telefone', 'site', 'instagram'] as const;

const int = (v: unknown, nome: string, min = 1) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min) throw new HttpError(400, `${nome} inválido.`);
  return n;
};
const cents = (v: unknown, nome = 'Valor') => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n <= 0 || n > 10_000_000) throw new HttpError(400, `${nome} inválido.`);
  return n;
};
const txt = (v: unknown, max: number) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).replace(/\s+/g, ' ').trim().slice(0, max));
const fone = (v: unknown) => { const d = onlyDigits(v); return d.length >= 10 ? String(v).trim().slice(0, 30) : null; };
const codigoNovo = () => 'G' + randomBytes(4).toString('hex').toUpperCase().slice(0, 7);
const tokenNovo = () => randomBytes(12).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 16).padEnd(16, 'K');
export const linkCadastro = (token: string) => `${LINK_CADASTRO}/?r=${token}`;
/** Chave do painel do organizador: só quem recebe o link do painel vê quem já se cadastrou e pagou (o link do grupo é compartilhado com todos). */
export const chavePainel = (codigo: string) => createHmac('sha256', process.env.OPS_RECEPCAO_KEY || 'sem-chave').update('painel:' + codigo).digest('base64url').slice(0, 16);
export const linkPainel = (codigo: string) => `${LINK_CADASTRO}/painel?g=${codigo}&k=${chavePainel(codigo)}`;

type PilotoIn = { nome?: unknown; telefone?: unknown; menor?: unknown };

// ---------------------------------------------------------------- leitura e cálculo

type Linha = Record<string, unknown>;

/** Campos que faltam para o totem aceitar a pessoa sem parar no balcão (mesmas regras do cadastro presencial). */
function faltaNoCadastro(c: Linha | null): string[] {
  if (!c) return ['cadastro'];
  const f: string[] = [];
  if (!c.documento) f.push('CPF');
  if (!c.email) f.push('e-mail');
  if (!c.peso) f.push('peso');
  if (!c.telefone) f.push('celular');
  return f;
}

type GrupoRow = {
  id: number; codigo: string; bateriaId: number; vagas: number; disponiveis: number; inicio: string; bateria: string; responsavelId: number; responsavel: string; responsavelTelefone: string | null;
  origem: string; modo: string; preco: number; sinalPct: number; observacao: string | null; status: string; criadoEm: string; criadoPor: string | null;
  aniversario?: boolean | number; precoAniversariante?: number | null; campeonato?: boolean | number;
};

/**
 * Promoção do aniversariante: com pelo menos ANIVERSARIO_MIN_CONVIDADOS convidados ativos, a vaga do responsável
 * (o aniversariante) custa precoAniversariante; abaixo disso ele paga o preço normal do grupo.
 */
export function precoDoPiloto(g: Pick<GrupoRow, 'preco' | 'aniversario' | 'precoAniversariante'>, responsavel: boolean, ativos: number) {
  const preco = Number(g.preco) || 0;
  if (!responsavel || !g.aniversario) return preco;
  if (ativos - 1 < ANIVERSARIO_MIN_CONVIDADOS) return preco;
  const p = g.precoAniversariante == null ? ANIVERSARIO_PRECO_PADRAO : Number(g.precoAniversariante);
  return Math.max(0, Math.min(preco, p));
}

export async function carregarGrupos(where: string, params: Record<string, unknown>) {
  const grupos = await query<GrupoRow>(
    `SELECT g.id id, g.codigo codigo, g.bateria_id "bateriaId", b.vagas vagas, b.vagas - (SELECT COUNT(*) FROM kart.inscricao i WHERE i.bateria_id = b.id AND i.status <> 'cancelada') disponiveis, to_char(b.inicio, 'YYYY-MM-DD"T"HH24:MI') inicio, b.nome bateria, g.responsavel_id "responsavelId",
            r.nome responsavel, r.telefone "responsavelTelefone", g.origem origem, g.modo modo, g.preco_centavos preco, g.sinal_pct "sinalPct", g.observacao observacao,
            g.status status, to_char(g.criado_em, 'YYYY-MM-DD"T"HH24:MI') "criadoEm", u.nome "criadoPor",
            g.aniversario aniversario, g.preco_aniversariante_centavos "precoAniversariante", b.campeonato campeonato
       FROM kart.reserva_grupo g JOIN kart.bateria b ON b.id = g.bateria_id JOIN kart.cliente r ON r.id = g.responsavel_id LEFT JOIN kart.usuario u ON u.id = g.criado_por
      WHERE ${where} ORDER BY b.inicio, g.id`,
    params,
  );
  if (!grupos.length) return [];
  const ids = grupos.map((g) => Number(g.id));
  const lista = ids.join(',');
  const pilotos = await query(
    `SELECT p.id id, p.grupo_id "grupoId", p.ordem ordem, p.nome nome, p.telefone telefone, p.menor menor, p.responsavel responsavel, p.cliente_id "clienteId",
            p.inscricao_id "inscricaoId", p.token token, p.pago_pelo_grupo "pagoPeloGrupo", p.preco_centavos "precoProprio", to_char(p.link_enviado_em, 'YYYY-MM-DD"T"HH24:MI') "linkEnviadoEm",
            to_char(p.cadastro_em, 'YYYY-MM-DD"T"HH24:MI') "cadastroEm", i.pago "inscricaoPaga", i.status "inscricaoStatus", i.venda_id "vendaId", i.origem "inscricaoOrigem",
            i.termo_impresso_em "termoEm", i.kart kart,
            c.nome "clienteNome", c.documento documento, c.email email, c.peso peso, c.telefone "clienteTelefone",
            CASE WHEN EXISTS (SELECT 1 FROM kart.cliente_termo_aceite ta WHERE ta.cliente_id = c.id) THEN 1 ELSE 0 END "termoOnline"
       FROM kart.reserva_grupo_piloto p
       LEFT JOIN kart.inscricao i ON i.id = p.inscricao_id
       LEFT JOIN kart.reserva_grupo rg ON rg.id = p.grupo_id
       LEFT JOIN kart.cliente c ON c.id = COALESCE(p.cliente_id, CASE WHEN p.responsavel = true THEN rg.responsavel_id END)
      WHERE p.grupo_id IN (${lista}) ORDER BY p.grupo_id, p.ordem, p.id`,
  );
  const pagamentos = await query(
    `SELECT pg.id id, pg.grupo_id "grupoId", pg.piloto_id "pilotoId", pg.valor_centavos valor, pg.forma forma, pg.origem origem, to_char(pg.criado_em, 'YYYY-MM-DD"T"HH24:MI') "criadoEm", u.nome usuario
       FROM kart.reserva_grupo_pagamento pg LEFT JOIN kart.usuario u ON u.id = pg.usuario_id
      WHERE pg.grupo_id IN (${lista}) AND pg.cancelado = false ORDER BY pg.criado_em`,
  );
  const cobrancas = await query(
    `SELECT id id, grupo_id "grupoId", piloto_id "pilotoId", valor_centavos valor, link link, status status, to_char(criado_em, 'YYYY-MM-DD"T"HH24:MI') "criadoEm"
       FROM kart.reserva_grupo_cobranca WHERE grupo_id IN (${lista}) AND status IN ('aguardando', 'pago') ORDER BY id`,
  );
  const agruparPor = (linhas: Linha[]) => {
    const mapa = new Map<number, Linha[]>();
    for (const item of linhas) {
      const gid = Number(item.grupoId);
      const lista = mapa.get(gid);
      if (lista) lista.push(item);
      else mapa.set(gid, [item]);
    }
    return mapa;
  };
  const pilotosPorGrupo = agruparPor(pilotos);
  const pagamentosPorGrupo = agruparPor(pagamentos);
  const cobrancasPorGrupo = agruparPor(cobrancas);
  return grupos.map((g) => {
    const gid = Number(g.id);
    return montar(
      g,
      pilotosPorGrupo.get(gid) ?? [],
      pagamentosPorGrupo.get(gid) ?? [],
      cobrancasPorGrupo.get(gid) ?? [],
    );
  });
}

/** Cobrança gerada pelo painel para um piloto (botão "Cobrar"): diz de quem é o pagamento que chegou do Asaas. */
async function pilotoDaCobranca(asaasId: string | null | undefined) {
  if (!asaasId) return null;
  const c = await one<{ grupoId: number; pilotoId: number | null }>(
    `SELECT grupo_id "grupoId", piloto_id "pilotoId" FROM kart.reserva_grupo_cobranca WHERE asaas_id = @a limit 1`, { a: asaasId });
  return c ? { grupoId: Number(c.grupoId), pilotoId: c.pilotoId == null ? null : Number(c.pilotoId) } : null;
}

/** Mesmo cálculo da tela: quanto cada piloto já tem coberto e quem ainda falta. */
export function montar(g: GrupoRow, pilotos: Linha[], pagamentos: Linha[], cobrancas: Linha[]) {
  // quem organiza pelo site sem pilotar não tem vaga (InscricaoId NULL): não conta como piloto nem no preço
  const ativos = pilotos.filter((p) => p.inscricaoStatus !== 'cancelada' && !(p.responsavel && p.inscricaoId === null));
  const n = ativos.length;
  const idsAtivos = new Set(ativos.map((p) => Number(p.id)));
  const pagamentosAtivos = pagamentos.filter((pg) => !pg.pilotoId || idsAtivos.has(Number(pg.pilotoId)));
  const unico = g.modo === 'unico';
  const individual = g.modo === 'individual';
  let doGrupo = 0;
  const porPiloto = new Map<number, number>();
  for (const pg of pagamentosAtivos) {
    const v = Number(pg.valor) || 0;
    if (!unico && pg.pilotoId) porPiloto.set(Number(pg.pilotoId), (porPiloto.get(Number(pg.pilotoId)) ?? 0) + v);
    else doGrupo += v;
  }
  // pago no caixa da Recepção ou pelo site: a vaga já vem paga e não depende do painel
  // preço próprio da vaga (estreante pelo link do grupo, 12/11/2026) vale sobre o do grupo
  const precoDe = (p: Linha) => (p.precoProprio != null && Number(p.precoProprio) > 0 ? Number(p.precoProprio) : precoDoPiloto(g, Boolean(p.responsavel), n));
  const fora_ = (p: Linha) => Boolean(p.inscricaoPaga && !p.pagoPeloGrupo);
  const pagosForaValor = ativos.filter(fora_).reduce((a, p) => a + precoDe(p), 0);
  // o pagamento "do grupo" (modos unico/sinal) se divide proporcionalmente ao preço de cada vaga (a do aniversariante custa menos).
  // No modo "individual" ("cada um paga o seu"), NUNCA rateia valor parcial entre os pilotos (evita saldos quebrados como R$ 140,91):
  // excedentes de quem pagou várias vagas e pagamentos sem piloto só quitam vagas inteiras em aberto em ordem.
  const doGrupoRateado = individual ? 0 : doGrupo;
  const somaRestantes = ativos.filter((p) => !fora_(p)).reduce((a, p) => a + precoDe(p), 0);
  const restantes = Math.max(1, ativos.filter((p) => !fora_(p)).length);
  const pagoPainel = pagamentosAtivos.reduce((a, pg) => a + (Number(pg.valor) || 0), 0);
  let creditoLivre = individual ? doGrupo : 0;
  const proprioPorId = new Map<number, number>();
  const alocadoPorId = new Map<number, number>();
  if (individual) {
    for (const p of ativos) {
      if (fora_(p)) continue;
      const precoP = precoDe(p);
      const bruto = porPiloto.get(Number(p.id)) ?? 0;
      const coberto = Math.min(bruto, precoP);
      proprioPorId.set(Number(p.id), coberto);
      creditoLivre += Math.max(0, bruto - precoP);
    }
    for (const p of ativos) {
      if (fora_(p)) continue;
      const precoP = precoDe(p);
      const coberto = proprioPorId.get(Number(p.id)) ?? 0;
      const faltaP = precoP - coberto;
      if (faltaP > 0.5 && creditoLivre >= faltaP - 0.5) {
        const usado = Math.min(faltaP, creditoLivre);
        alocadoPorId.set(Number(p.id), coberto + usado);
        creditoLivre = Math.max(0, creditoLivre - usado);
      } else {
        alocadoPorId.set(Number(p.id), coberto);
      }
    }
  }
  const lista = ativos.map((p) => {
    const fora = fora_(p);
    const precoP = precoDe(p);
    const parteDoGrupo = somaRestantes > 0 ? doGrupoRateado * precoP / somaRestantes : doGrupoRateado / restantes;
    const dela = fora ? precoP : individual ? (alocadoPorId.get(Number(p.id)) ?? 0) : (porPiloto.get(Number(p.id)) ?? 0) + parteDoGrupo;
    const ok = precoP <= 0 || dela >= precoP - 0.5;
    const cliente = p.documento !== undefined && (p.clienteId || p.responsavel) ? { documento: p.documento, email: p.email, peso: p.peso, telefone: p.clienteTelefone } : null;
    const falta = faltaNoCadastro(cliente);
    const cadastro = (p.clienteId || p.responsavel) && !falta.length ? 'completo' : p.cadastroEm || p.clienteId ? 'incompleto' : p.linkEnviadoEm ? 'enviado' : 'pendente';
    const telDig = (v: unknown) => String(v ?? '').replace(/\D/g, '');
    const telLinha = p.clienteTelefone && telDig(p.clienteTelefone).length >= 11 && telDig(p.telefone).length < 11
      ? p.clienteTelefone
      : (p.telefone || p.clienteTelefone || null);
    return {
      id: p.id, ordem: p.ordem, nome: nomeDaVaga(p), telefone: telLinha, menor: Boolean(p.menor), responsavel: Boolean(p.responsavel),
      clienteId: p.clienteId ?? (p.responsavel ? g.responsavelId : null), inscricaoId: p.inscricaoId, kart: p.kart ?? null, termo: Boolean(p.termoEm) || Boolean(p.termoOnline), termoOnline: Boolean(p.termoOnline), termoImpresso: Boolean(p.termoEm),
      link: linkCadastro(String(p.token)), linkEnviadoEm: p.linkEnviadoEm, cadastroEm: p.cadastroEm, cadastro, falta: cadastro === 'completo' ? [] : falta,
      preco: precoP, aniversariante: Boolean(g.aniversario) && Boolean(p.responsavel),
      pago: ok, pagoNoCaixa: fora, valorPago: Math.min(Math.round(dela), precoP), falta_centavos: Math.max(0, Math.round(precoP - dela)),
      cobranca: cobrancas.find((c) => c.pilotoId === p.id && c.status === 'aguardando') ?? null,
    };
  });
  const total = lista.reduce((a, p) => a + p.preco, 0);
  const faltaCalculada = individual ? lista.reduce((a, p) => a + p.falta_centavos, 0) : Math.max(0, total - Math.min(total, pagoPainel + pagosForaValor));
  const pago = individual ? Math.max(0, total - faltaCalculada) : Math.min(total, pagoPainel + pagosForaValor);
  const convidados = Math.max(0, n - 1);
  const promocao = g.aniversario ? {
    ativa: convidados >= ANIVERSARIO_MIN_CONVIDADOS, convidados, minimo: ANIVERSARIO_MIN_CONVIDADOS,
    precoAniversariante: g.precoAniversariante == null ? ANIVERSARIO_PRECO_PADRAO : Number(g.precoAniversariante),
  } : null;
  const sinal = Math.round(total * (Number(g.sinalPct) || 0) / 100);
  const responsavel = pilotos.find((p) => p.responsavel);
  return {
    ...g, linkGrupo: responsavel?.token ? linkCadastro(String(responsavel.token)) : null, linkPainel: linkPainel(String(g.codigo)), pilotos: lista, pagamentos: pagamentos.map((pg) => {
      const p = pilotos.find((p) => Number(p.id) === Number(pg.pilotoId));
      return { ...pg, pilotoNome: p ? nomeDaVaga(p) : null, pilotoCancelado: p?.inscricaoStatus === 'cancelada' };
    }), n, total, pago, falta: faltaCalculada, pagamentosSemPiloto: individual ? Math.round(creditoLivre) : 0, sinal, aniversario: Boolean(g.aniversario), campeonato: Boolean(g.campeonato), promocao,
    pagos: lista.filter((p) => p.pago).length, cadastrados: lista.filter((p) => p.cadastro === 'completo').length,
    prontos: lista.filter((p) => p.pago && p.cadastro === 'completo').length,
    cobrancaGrupo: cobrancas.find((c) => !c.pilotoId && c.status === 'aguardando') ?? null,
  };
}

export async function grupo(id: number) {
  const [g] = await carregarGrupos('g.id = @id', { id });
  if (!g) throw new HttpError(404, 'Reserva em grupo não encontrada.');
  return g;
}

/**
 * Depois de qualquer pagamento (ou estorno): marca paga a vaga de quem ficou coberto e desfaz a marcação de quem
 * deixou de estar (só as que este painel marcou e que não passaram pelo caixa).
 */
export async function aplicarPagos(grupoId: number) {
  const g = await grupo(grupoId);
  for (const p of g.pilotos) {
    if (!p.inscricaoId || p.pagoNoCaixa) continue;
    // o caixa da Recepção cobra Inscricao.PrecoCentavos: a vaga do aniversariante acompanha a promoção
    await query(`UPDATE kart.inscricao SET preco_centavos = @preco, atualizado_em = now()
      WHERE id = @id AND pago = false AND status <> 'cancelada' AND coalesce(preco_centavos, -1) <> @preco`, { id: p.inscricaoId, preco: p.preco });
    if (p.pago) {
      const feito = await one<{ Id: number }>(
        `UPDATE kart.inscricao SET pago = true, valor_centavos = @preco, status = 'confirmada', atualizado_em = now()
            WHERE id = @id AND pago = false AND status <> 'cancelada' returning id`,
        { id: p.inscricaoId, preco: p.preco },
      );
      if (feito) await query(`UPDATE kart.reserva_grupo_piloto SET pago_pelo_grupo = true WHERE id = @id`, { id: p.id });
    } else {
      const desfeito = await one<{ Id: number }>(
        `UPDATE kart.inscricao i SET pago = false, valor_centavos = NULL, status = 'reservada'
           FROM kart.reserva_grupo_piloto p
          WHERE p.inscricao_id = i.id AND p.id = @pid AND p.pago_pelo_grupo = true AND i.venda_id IS NULL AND i.pago = true AND i.status <> 'cancelada' returning i.id "Id"`,
        { pid: p.id },
      );
      if (desfeito) await query(`UPDATE kart.reserva_grupo_piloto SET pago_pelo_grupo = false WHERE id = @id`, { id: p.id });
    }
  }
}

// ---------------------------------------------------------------- link de cadastro (pré-cadastro com ?r=TOKEN)

/**
 * A pessoa abriu o link do grupo e terminou o pré-cadastro: a vaga dela passa para o nome dela (o totem acha pelo CPF,
 * o termo e o resultado saem com o nome certo). Se ela já tem outra vaga na mesma bateria, não mexe.
 */
export async function vincularCadastroDoLink(token: string, clienteId: number, log: Log) {
  if (!/^[A-Za-z0-9]{10,24}$/.test(token)) return false;
  type Vaga = { id: number; grupoId: number; inscricaoId: number | null; responsavel: boolean; bateriaId: number; nome: string | null };
  let p = await one<Vaga>(
    `SELECT p.id id, p.grupo_id "grupoId", p.inscricao_id "inscricaoId", p.responsavel responsavel, g.bateria_id "bateriaId", p.nome nome
       FROM kart.reserva_grupo_piloto p JOIN kart.reserva_grupo g ON g.id = p.grupo_id WHERE p.token = @token AND g.status = 'ativa' AND (p.responsavel = true OR EXISTS (SELECT 1 FROM kart.inscricao i WHERE i.id = p.inscricao_id AND i.status <> 'cancelada'))`,
    { token },
  );
  if (!p) { log(`grupo: link ${token.slice(0, 4)}… não pertence a nenhuma reserva ativa`); return false; }
  if (p.responsavel) {
    // LINK ÚNICO DO GRUPO: o código do responsável serve para todo mundo. Quem se cadastra ocupa a primeira vaga livre
    // (de preferência a que já tem o nome dela). Os links individuais antigos continuam valendo.
    const jaNoGrupo = await one<{ id: number }>(`SELECT p.id id FROM kart.reserva_grupo_piloto p JOIN kart.inscricao i ON i.id = p.inscricao_id AND i.status <> 'cancelada' WHERE p.grupo_id = @g AND p.cliente_id = @c limit 1`, { g: p.grupoId, c: clienteId });
    if (jaNoGrupo) {
      await query(`UPDATE kart.reserva_grupo_piloto SET cadastro_em = COALESCE(cadastro_em, now()) WHERE id = @id`, { id: jaNoGrupo.id });
      log(`grupo ${p.grupoId}: cliente ${clienteId} já está no grupo (vaga ${jaNoGrupo.id}), cadastro confirmado`);
      return true;
    }
    // o responsável ainda é provisório (só nome e WhatsApp)? Se quem abriu o link é ele (mesmo WhatsApp ou mesmo nome), o cadastro
    // dele substitui o provisório em toda a reserva (vagas, grupo e vaga do responsável).
    const prov = await one<{ slotId: number; clienteId: number; nome: string; telefone: string | null; documento: string | null }>(
      `SELECT p.id "slotId", p.cliente_id "clienteId", c.nome nome, c.telefone telefone, c.documento documento
         FROM kart.reserva_grupo_piloto p JOIN kart.cliente c ON c.id = p.cliente_id WHERE p.id = @id`, { id: p.id },
    );
    if (prov && !prov.documento) {
      const quem = await one<{ nome: string; telefone: string | null }>(`SELECT nome nome, telefone telefone FROM kart.cliente WHERE id = @c`, { c: clienteId });
      const fim = (v: string | null | undefined) => onlyDigits(v).slice(-8);
      const mesmoFone = !!quem && fim(quem.telefone).length >= 8 && fim(quem.telefone) === fim(prov.telefone);
      const a = semAcento(quem?.nome).split(' '), b2 = semAcento(prov.nome).split(' ');
      const mesmoNome = !!quem && (semAcento(quem.nome) === semAcento(prov.nome) || (a.length > 1 && b2.length > 1 && a[0] === b2[0] && a[a.length - 1] === b2[b2.length - 1]));
      if (mesmoFone || mesmoNome) {
        const antigo = prov.clienteId;
        await query(`UPDATE kart.inscricao SET cliente_id = @c, atualizado_em = now() WHERE cliente_id = @a AND id IN (SELECT inscricao_id "InscricaoId" FROM kart.reserva_grupo_piloto WHERE grupo_id = @g AND inscricao_id IS NOT NULL)`, { c: clienteId, a: antigo, g: p.grupoId });
        await query(`UPDATE kart.inscricao SET responsavel_id = @c WHERE responsavel_id = @a AND id IN (SELECT inscricao_id "InscricaoId" FROM kart.reserva_grupo_piloto WHERE grupo_id = @g AND inscricao_id IS NOT NULL)`, { c: clienteId, a: antigo, g: p.grupoId }).catch(() => undefined);
        await query(`UPDATE kart.reserva_grupo SET responsavel_id = @c, atualizado_em = now() WHERE id = @g`, { c: clienteId, g: p.grupoId });
        await query(
          `UPDATE kart.reserva_grupo_piloto p SET cliente_id = @c, cadastro_em = now(),
                        nome = COALESCE(NULLIF(c.nome, ''), p.nome),
                        telefone = COALESCE(NULLIF(c.telefone, ''), p.telefone)
             FROM kart.cliente c WHERE c.id = @c AND p.id = @id`,
          { c: clienteId, id: p.id },
        );
        await query(
          `DELETE FROM kart.cliente WHERE id = @a AND documento IS NULL
             AND NOT EXISTS (SELECT 1 FROM kart.inscricao WHERE cliente_id = @a) AND NOT EXISTS (SELECT 1 FROM kart.reserva_grupo WHERE responsavel_id = @a)
             AND NOT EXISTS (SELECT 1 FROM kart.reserva_grupo_piloto WHERE cliente_id = @a)`, { a: antigo },
        ).catch(() => log(`grupo ${p?.grupoId}: cadastro provisório ${antigo} ficou (tem outros vínculos)`));
        log(`grupo ${p.grupoId}: responsável cadastrou-se pelo link (cliente ${clienteId} no lugar do provisório ${antigo})`);
        return true;
      }
    }
    const livre = await one<Vaga>(
      `SELECT v.id id, v.grupo_id "grupoId", v.inscricao_id "inscricaoId", v.responsavel responsavel, g.bateria_id "bateriaId", v.nome nome
         FROM kart.reserva_grupo_piloto v JOIN kart.reserva_grupo g ON g.id = v.grupo_id JOIN kart.cliente c ON c.id = @c
        WHERE v.grupo_id = @g AND EXISTS (SELECT 1 FROM kart.inscricao i WHERE i.id = v.inscricao_id AND i.status <> 'cancelada') AND (v.cliente_id IS NULL OR v.cliente_id IN (SELECT id "Id" FROM kart.cliente WHERE origem = 'grupo' AND documento IS NULL)) AND v.responsavel = false
        ORDER BY CASE WHEN v.nome IS NOT NULL AND LOWER(v.nome) = LOWER(c.nome) THEN 0 ELSE 1 END, v.ordem limit 1`,
      { g: p.grupoId, c: clienteId },
    );
    if (!livre) { log(`grupo ${p.grupoId}: link do grupo usado pelo cliente ${clienteId}, mas não há vaga livre (aumente a quantidade de pilotos na reserva)`); return false; }
    p = livre;
  }
  const outra = await one<{ Id: number }>(
    `SELECT id "Id" FROM kart.inscricao WHERE bateria_id = @b AND cliente_id = @c AND status <> 'cancelada' AND id <> coalesce(@i, 0) limit 1`,
    { b: p.bateriaId, c: clienteId, i: p.inscricaoId },
  );
  if (p.inscricaoId && !outra) {
    await query(`UPDATE kart.inscricao SET cliente_id = @c, atualizado_em = now() WHERE id = @i AND status <> 'cancelada'`, { c: clienteId, i: p.inscricaoId });
    await limparProvisorios();
  }
  await query(
    `UPDATE kart.reserva_grupo_piloto p SET cliente_id = @c, cadastro_em = now(),
                  nome = CASE WHEN p.nome IS NULL OR trim(p.nome) = '' OR trim(p.nome) LIKE '% .' THEN COALESCE(NULLIF(c.nome, ''), p.nome) ELSE p.nome END,
                  telefone = CASE WHEN p.telefone IS NULL OR trim(p.telefone) = '' OR (length(REPLACE(REPLACE(REPLACE(REPLACE(c.telefone,'(',''),')',''),'-',''),' ','')) >= 11 AND length(REPLACE(REPLACE(REPLACE(REPLACE(p.telefone,'(',''),')',''),'-',''),' ','')) < 11) THEN COALESCE(NULLIF(c.telefone, ''), p.telefone) ELSE p.telefone END
       FROM kart.cliente c WHERE c.id = @c AND p.id = @id`,
    { c: clienteId, id: p.id },
  );
  log(`grupo ${p.grupoId}: piloto ${p.id} cadastrado pelo link (cliente ${clienteId})${outra ? ' — já tinha outra vaga na bateria, vaga do grupo mantida' : ''}`);
  return true;
}

// ---------------------------------------------------------------- vaga do grupo x pessoa que chegou (totem/recepção)

type VagaLivre = { id: number; ordem: number; nome: string | null; telefone: string | null; inscricaoId: number | null };

/** Vagas do grupo que ainda aguardam um cadastro de verdade (o "Amigo N de..." provisório). */
async function vagasAguardando(grupoId: number): Promise<VagaLivre[]> {
  return query<VagaLivre>(
    `SELECT v.id id, v.ordem ordem, v.nome nome, v.telefone telefone, v.inscricao_id "inscricaoId"
       FROM kart.reserva_grupo_piloto v JOIN kart.inscricao i ON i.id = v.inscricao_id AND i.status <> 'cancelada'
      WHERE v.grupo_id = @g AND EXISTS (SELECT 1 FROM kart.inscricao i WHERE i.id = v.inscricao_id AND i.status <> 'cancelada') AND v.cliente_id IS NULL AND v.responsavel = false ORDER BY v.ordem`,
    { g: grupoId },
  );
}

/**
 * Uma pessoa com cadastro de verdade passa a ocupar uma vaga que já existia no grupo, mantendo preço e pagamento da vaga.
 * Pode ser repetida sem efeito. Se a pessoa já tinha uma pré-reserva avulsa (totem) na mesma bateria e ainda não paga,
 * essa pré-reserva sai (a vaga do grupo é a dela). Reserva paga duplicada fica para a recepção resolver.
 */
export async function vincularClienteAoGrupo(grupoId: number, clienteId: number, pilotoId: number | null, log: Log, puxarDados = false) {
  const g = await one<{ bateriaId: number }>(`SELECT bateria_id "bateriaId" FROM kart.reserva_grupo WHERE id = @g AND status = 'ativa'`, { g: grupoId });
  if (!g) throw new HttpError(404, 'Reserva em grupo não encontrada.');
  const c = await one<{ id: number }>(`SELECT id id FROM kart.cliente WHERE id = @c`, { c: clienteId });
  if (!c) throw new HttpError(404, 'Cadastro não encontrado.');
  const ja = await one<{ id: number }>(`SELECT p.id id FROM kart.reserva_grupo_piloto p JOIN kart.inscricao i ON i.id = p.inscricao_id AND i.status <> 'cancelada' WHERE p.grupo_id = @g AND p.cliente_id = @c limit 1`, { g: grupoId, c: clienteId });
  if (ja) return { ok: true, jaVinculado: true, pilotoId: ja.id, inscricaoId: null as number | null };
  const livres = await vagasAguardando(grupoId);
  const vaga = pilotoId ? livres.find((v) => v.id === pilotoId) : livres[0];
  if (!vaga || !vaga.inscricaoId) throw new HttpError(409, 'Não há vaga aguardando cadastro neste grupo.');
  await tx(async (run) => {
    const outras = await run(
      `SELECT id "Id", pago "Pago", venda_id "VendaId" FROM kart.inscricao WHERE bateria_id = @b AND cliente_id = @c AND status <> 'cancelada' AND id <> @i for update`,
      { b: g.bateriaId, c: clienteId, i: vaga.inscricaoId },
    );
    for (const o of outras) {
      if (o.Pago || o.VendaId) throw new HttpError(409, 'Esta pessoa já tem reserva paga nesta bateria. Resolva na recepção (estorno ou mover).');
    }
    for (const o of outras) await run(`UPDATE kart.inscricao SET status = 'cancelada', pago = false, atualizado_em = now() WHERE id = @id`, { id: o.Id });
    await run(`UPDATE kart.inscricao SET cliente_id = @c, atualizado_em = now() WHERE id = @i AND status <> 'cancelada'`, { c: clienteId, i: vaga.inscricaoId });
    await run(
      `UPDATE kart.reserva_grupo_piloto p SET cliente_id = @c, cadastro_em = now(),
              nome = CASE WHEN @puxar = 1 THEN COALESCE(NULLIF(c.nome, ''), p.nome) ELSE COALESCE(NULLIF(p.nome, ''), c.nome) END,
              telefone = CASE WHEN @puxar = 1 THEN COALESCE(NULLIF(c.telefone, ''), p.telefone) ELSE COALESCE(NULLIF(p.telefone, ''), c.telefone) END,
              menor = CASE WHEN @puxar = 1 AND c.nascimento IS NOT NULL THEN (c.nascimento + interval '18 years') > current_date ELSE p.menor END
         FROM kart.cliente c WHERE c.id = @c AND p.id = @id`,
      { c: clienteId, id: vaga.id, puxar: puxarDados ? 1 : 0 },
    );
  });
  await limparProvisorios();
  log(`grupo ${grupoId}: cliente ${clienteId} ocupou a vaga ${vaga.id} (vínculo pela recepção/totem)`);
  return { ok: true, jaVinculado: false, pilotoId: vaga.id, inscricaoId: vaga.inscricaoId as number | null };
}

/**
 * Chegada no totem: se a bateria tem um grupo com vaga aguardando cuja pessoa a recepção já anotou (mesmo nome completo ou
 * mesmo WhatsApp), a pessoa entra nessa vaga sozinha. Sem dado em comum NÃO vincula: o mesmo horário não prova que é do grupo.
 * Devolve o id da inscrição da vaga, ou null.
 */
export async function vincularPorDados(bateriaId: number, clienteId: number, log: Log): Promise<number | null> {
  const quem = await one<{ nome: string; telefone: string | null }>(`SELECT nome nome, telefone telefone FROM kart.cliente WHERE id = @c`, { c: clienteId });
  if (!quem) return null;
  const grupos = await query<{ id: number }>(`SELECT id id FROM kart.reserva_grupo WHERE bateria_id = @b AND status = 'ativa'`, { b: bateriaId });
  const fim = (v: string | null | undefined) => onlyDigits(v).slice(-8);
  const a = semAcento(quem.nome).split(' ');
  for (const gr of grupos) {
    for (const v of await vagasAguardando(gr.id)) {
      const mesmoFone = fim(quem.telefone).length >= 8 && fim(quem.telefone) === fim(v.telefone);
      const b2 = semAcento(v.nome).split(' ');
      const mesmoNome = !!v.nome && a.length > 1 && b2.length > 1 && a[0] === b2[0] && a[a.length - 1] === b2[b2.length - 1];
      if (!mesmoFone && !mesmoNome) continue;
      const r = await vincularClienteAoGrupo(gr.id, clienteId, v.id, log).catch(() => null);
      if (r?.inscricaoId) return r.inscricaoId;
      if (r?.jaVinculado) return (await one<{ i: number }>(`SELECT inscricao_id i FROM kart.reserva_grupo_piloto WHERE id = @id`, { id: r.pilotoId }))?.i ?? null;
    }
  }
  return null;
}

// ---------------------------------------------------------------- totem: "Vim com um grupo"

// nome limpo: tira pedaços só de pontuação ("Weder ." → "Weder")
const limparNome = (n: unknown) => String(n ?? '').split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).join(' ');
// vaga com cadastro ligado mostra o nome do cadastro (é o que o título e o caixa usam); sem cadastro, o que foi digitado na vaga
function nomeDaVaga(p: { nome?: unknown; clienteNome?: unknown; clienteId?: unknown; responsavel?: unknown }) {
  const cad = limparNome(p.clienteNome), vaga = limparNome(p.nome);
  return ((p.clienteId || p.responsavel) && cad ? cad : vaga || cad) || null;
}

const primeiroNome = (nome: string) => {
  const p = String(nome ?? '').trim().split(/\s+/).filter(Boolean);
  return p.length ? p[0].charAt(0).toUpperCase() + p[0].slice(1).toLowerCase() : '';
};

/**
 * Grupos de hoje que ainda têm vaga aguardando quem chegar: o totem mostra "Grupo do Edmael · 21:40" ANTES das baterias,
 * para o amigo se reconhecer. Só o primeiro nome do responsável aparece (privacidade).
 */
export async function gruposDoDiaNoTotem() {
  const rows = await query<{ id: number; responsavel: string; bateriaId: number; inicio: string; total: number; aniversario: boolean; bateria: string; campeonato: boolean }>(
    `SELECT g.id id, r.nome responsavel, g.bateria_id "bateriaId", to_char(b.inicio, 'YYYY-MM-DD"T"HH24:MI') inicio, g.aniversario aniversario, b.nome bateria, b.campeonato campeonato,
            (SELECT COUNT(*) FROM kart.reserva_grupo_piloto p JOIN kart.inscricao i ON i.id = p.inscricao_id AND i.status <> 'cancelada' WHERE p.grupo_id = g.id) total
       FROM kart.reserva_grupo g JOIN kart.bateria b ON b.id = g.bateria_id JOIN kart.cliente r ON r.id = g.responsavel_id
      WHERE g.status = 'ativa' AND b.status <> 'cancelada' AND (b.inicio)::date = (now())::date
        AND b.inicio >= (now() + make_interval(mins => (-45)::int))
      ORDER BY b.inicio, g.id`,
  );
  const out: { id: number; responsavel: string; inicio: string; total: number; aguardando: number; bateriaId: number; aniversario: boolean; titulo: string }[] = [];
  for (const g of rows) {
    const aguardando = (await vagasAguardando(g.id)).length;
    const quem = primeiroNome(g.responsavel);
    // campeonato aparece pelo nome do campeonato (nunca "grupo do organizador"); aniversário destaca o aniversariante
    const titulo = g.campeonato ? String(g.bateria || 'Campeonato') : g.aniversario ? `Aniversário do(a) ${quem}` : `Grupo do(a) ${quem}`;
    if (aguardando > 0) out.push({ id: g.id, responsavel: quem, inicio: g.inicio, total: Number(g.total), aguardando, bateriaId: g.bateriaId, aniversario: Boolean(g.aniversario), titulo });
  }
  return out;
}

/** O amigo escolheu o grupo no totem: ocupa uma vaga já paga e recebe a mensagem que valoriza quem reservou. */
export async function entrarNoGrupoPeloTotem(grupoId: number, clienteId: number, log: Log) {
  const r = await vincularClienteAoGrupo(grupoId, clienteId, null, log);
  const g = await one<{ responsavel: string; bateriaId: number; inicio: string; total: number }>(
    `SELECT rc.nome responsavel, g.bateria_id "bateriaId", to_char(b.inicio, 'YYYY-MM-DD"T"HH24:MI') inicio,
            (SELECT COUNT(*) FROM kart.reserva_grupo_piloto p JOIN kart.inscricao i ON i.id = p.inscricao_id AND i.status <> 'cancelada' WHERE p.grupo_id = g.id) total
       FROM kart.reserva_grupo g JOIN kart.bateria b ON b.id = g.bateria_id JOIN kart.cliente rc ON rc.id = g.responsavel_id WHERE g.id = @g`,
    { g: grupoId },
  );
  if (!g) throw new HttpError(404, 'Reserva em grupo não encontrada.');
  const quem = primeiroNome(g.responsavel);
  return {
    ok: true, jaVinculado: r.jaVinculado, bateriaId: g.bateriaId, inicio: g.inicio, total: Number(g.total), responsavel: quem,
    mensagem: `${quem} reservou e pagou a corrida de todos os ${g.total} amigos. Você é convidado(a) dele(a)!`,
  };
}

// ---------------------------------------------------------------- cobrança Asaas (pelo worker do site)

const siteUrl = () => (process.env.PRECADASTRO_URL || '').replace(/\/+$/, '');
const siteChave = () => process.env.PRECADASTRO_KEY || '';

async function site(caminho: string, init: RequestInit = {}) {
  if (!siteUrl() || !siteChave()) throw new HttpError(503, 'Pagamento online desligado neste servidor.');
  const r = await fetch(siteUrl() + caminho, { ...init, headers: { 'x-sync-key': siteChave(), 'content-type': 'application/json', ...(init.headers ?? {}) }, signal: AbortSignal.timeout(15_000) });
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new HttpError(502, `Asaas: ${String(j.erro ?? `HTTP ${r.status}`).replace(/^Asaas [^:]*: /, '')}`);
  return j;
}

async function criarCobranca(grupoId: number, pilotoId: number | null) {
  const g = await grupo(grupoId);
  if (!pilotoId && g.modo === 'individual') throw new HttpError(400, 'Neste grupo cada um paga o seu: escolha de qual piloto é a cobrança.');
  const p = pilotoId ? g.pilotos.find((x) => x.id === pilotoId) : null;
  if (pilotoId && !p) throw new HttpError(404, 'Piloto não encontrado no grupo.');
  const valor = p ? p.falta_centavos : g.modo === 'sinal' ? Math.max(0, g.sinal - g.pago) : g.falta;
  if (valor <= 0) throw new HttpError(409, p ? 'Este piloto já está pago.' : 'O grupo já está pago.');
  const quem = await one<{ nome: string; documento: string | null; email: string | null; telefone: string | null }>(
    `SELECT nome nome, documento documento, email email, telefone telefone FROM kart.cliente WHERE id = @id`,
    { id: (p?.clienteId as number | null) ?? (g.responsavelId as number) },
  );
  const doc = onlyDigits(quem?.documento);
  const pagador = doc.length === 11 ? quem! : await one<{ nome: string; documento: string | null; email: string | null; telefone: string | null }>(
    `SELECT nome nome, documento documento, email email, telefone telefone FROM kart.cliente WHERE id = @id`, { id: g.responsavelId },
  );
  if (onlyDigits(pagador?.documento).length !== 11) throw new HttpError(409, 'Para gerar o Pix o responsável precisa ter CPF no cadastro.');
  const antiga = p ? p.cobranca : g.cobrancaGrupo;
  if (antiga && Number(antiga.valor) === valor) return { link: String(antiga.link), valor, reaproveitada: true };
  const dia = String(g.inicio).slice(0, 10);
  const c = await site('/api/sync/cobranca', {
    method: 'POST',
    body: JSON.stringify({
      nome: pagador!.nome, cpf: pagador!.documento, email: pagador!.email ?? '', celular: pagador!.telefone ?? '', valorCentavos: valor, vencimento: dia,
      descricao: `Kartódromo de Betim · ${g.bateria} ${dia.split('-').reverse().join('/')} ${String(g.inicio).slice(11, 16)} · ${p ? (p.nome ?? 'piloto') : `grupo de ${g.n}`} · reserva ${g.codigo}`,
      referencia: `grupo-${g.id}-${pilotoId ?? 'g'}`,
    }),
  });
  await query(
    `INSERT INTO kart.reserva_grupo_cobranca (grupo_id, piloto_id, valor_centavos, asaas_id, link) VALUES (@g, @p, @v, @a, @l)`,
    { g: g.id, p: pilotoId, v: valor, a: String(c.id), l: String(c.link) },
  );
  if (antiga) await query(`UPDATE kart.reserva_grupo_cobranca SET status = 'cancelada' WHERE id = @id`, { id: antiga.id });
  return { link: String(c.link), valor, reaproveitada: false };
}

/**
 * Diferença a cobrar de reservas JÁ PAGAS que trocaram de serviço (ex.: Happy Hour R$ 89,90 → locação R$ 145): monta um
 * grupo "cada um paga o seu" com essas vagas, lança como pago o que cada um já pagou e gera um link Asaas por pessoa só
 * com a diferença. A vaga volta a "a pagar" com o que já entrou como desconto, então o caixa da Recepção também cobra só a
 * diferença; quando o Asaas confirma, aplicarPagos marca a vaga paga pelo preço novo (como em qualquer grupo).
 */
export async function cobrarDiferencaEmGrupo(inscricaoIds: number[], usuarioId: number | null, log: Log) {
  const ids = [...new Set(inscricaoIds.map(Number))].filter((n) => Number.isInteger(n) && n > 0);
  if (!ids.length || ids.length > 40) throw new HttpError(400, 'Escolha as reservas (até 40).');
  const gid = await tx(async (run) => {
    const linhas = await run(
      `SELECT i.id id, i.bateria_id "bateriaId", i.cliente_id "clienteId", i.responsavel_id "responsavelId", i.pago pago, i.status status,
              coalesce(i.valor_centavos, 0) "valorPago", coalesce(i.preco_centavos, p.preco_centavos, 0) preco, c.nome nome, c.telefone telefone,
              EXISTS (SELECT 1 FROM kart.reserva_grupo_piloto gp JOIN kart.reserva_grupo g ON g.id = gp.grupo_id WHERE gp.inscricao_id = i.id AND g.status = 'ativa') "noGrupo"
         FROM kart.inscricao i JOIN kart.bateria b ON b.id = i.bateria_id LEFT JOIN kart.produto p ON p.id = coalesce(i.produto_id, b.produto_id)
         JOIN kart.cliente c ON c.id = i.cliente_id
        WHERE i.id IN (${ids.join(',')}) ORDER BY i.id for update of i`,
    );
    if (linhas.length !== ids.length) throw new HttpError(404, 'Reserva não encontrada.');
    const bateriaId = Number(linhas[0].bateriaId);
    for (const l of linhas) {
      if (Number(l.bateriaId) !== bateriaId) throw new HttpError(409, 'As reservas precisam ser da mesma bateria.');
      if (l.status === 'cancelada') throw new HttpError(409, `Reserva cancelada: ${l.nome}.`);
      if (!l.pago) throw new HttpError(409, `${l.nome} ainda não pagou nada: use a reserva em grupo normal.`);
      if (l.noGrupo) throw new HttpError(409, `${l.nome} já está numa reserva em grupo.`);
    }
    if (!linhas.some((l) => Number(l.preco) > Number(l.valorPago))) throw new HttpError(409, 'Nenhuma dessas reservas tem diferença a pagar.');
    const resp = Number(linhas.find((l) => l.responsavelId)?.responsavelId ?? linhas[0].clienteId);
    const preco = Math.max(...linhas.map((l) => Number(l.preco)));
    const [g] = await run(
      `INSERT INTO kart.reserva_grupo (codigo, bateria_id, responsavel_id, origem, modo, preco_centavos, sinal_pct, observacao, criado_por)
        VALUES (@codigo, @b, @r, 'recepcao', 'individual', @preco, 0, @obs, @u) returning id id`,
      { codigo: codigoNovo(), b: bateriaId, r: resp, preco, obs: 'Diferença da troca de serviço · cada um paga a sua diferença', u: usuarioId },
    );
    const grupoId = Number(g.id);
    let ordem = 1;
    // quem organiza primeiro (vaga 1), depois os outros na ordem das reservas
    for (const l of [...linhas].sort((a, b) => Number(Number(b.clienteId) === resp) - Number(Number(a.clienteId) === resp))) {
      const ehResp = Number(l.clienteId) === resp && ordem === 1;
      const [pl] = await run(
        `INSERT INTO kart.reserva_grupo_piloto (grupo_id, ordem, nome, telefone, menor, responsavel, cliente_id, inscricao_id, token, preco_centavos)
         VALUES (@g, @o, NULL, @t, false, @r, @c, @i, @k, @preco) returning id id`,
        { g: grupoId, o: ordem++, t: l.telefone ?? null, r: ehResp, c: l.clienteId, i: l.id, k: tokenNovo(), preco: Number(l.preco) },
      );
      const jaPago = Math.min(Number(l.valorPago), Number(l.preco));
      if (jaPago > 0) {
        await run(
          `INSERT INTO kart.reserva_grupo_pagamento (grupo_id, piloto_id, valor_centavos, forma, origem, usuario_id) VALUES (@g, @p, @v, 'Pago antes da troca', 'site', @u)`,
          { g: grupoId, p: Number(pl.id), v: jaPago, u: usuarioId },
        );
      }
      if (Number(l.preco) > jaPago) {
        // a vaga fica "a pagar" só pela diferença: o que já entrou vira desconto (o caixa cobra preço − desconto)
        await run(
          `UPDATE kart.inscricao SET pago = false, status = 'reservada', valor_centavos = NULL, desconto_centavos = @ja,
             observacao = left(concat_ws(' · ', nullif(observacao, ''), @nota::text), 400), atualizado_em = now() WHERE id = @id`,
          { id: l.id, ja: jaPago, nota: `Diferença no grupo (link de pagamento individual): já pago ${(jaPago / 100).toFixed(2).replace('.', ',')}` },
        );
      }
    }
    return grupoId;
  });
  log(`grupo ${gid}: diferença de troca de serviço (${ids.length} vaga(s))`);
  await aplicarPagos(gid);
  const g0 = await grupo(gid);
  const links: { pilotoId: number; nome: string; valor: number; link: string | null; erro?: string }[] = [];
  for (const p of g0.pilotos) {
    if (p.falta_centavos <= 0) continue;
    try {
      const c = await criarCobranca(gid, Number(p.id));
      links.push({ pilotoId: Number(p.id), nome: String(p.nome), valor: c.valor, link: c.link });
    } catch (e) {
      links.push({ pilotoId: Number(p.id), nome: String(p.nome), valor: p.falta_centavos, link: null, erro: (e as Error).message });
    }
  }
  return { grupo: await grupo(gid), links };
}

/** A cada minuto: confere no Asaas as cobranças em aberto e lança o pagamento de quem pagou. */
let proximaConferenciaGeral = 0;
/**
 * Confere na Asaas as cobranças abertas. O ciclo geral roda no máximo a cada 10 min (o webhook já traz os pagamentos
 * na hora): conferir 50 cobranças por minuto estourou a cota de 12h da Asaas em 12/11/2026 e travou o link do grupo.
 * O botão "Conferir no Asaas" (grupoId) continua imediato.
 */
export async function conferirCobrancas(log: Log, grupoId?: number): Promise<number> {
  if (!siteUrl() || !siteChave()) return 0;
  if (!grupoId) {
    if (Date.now() < proximaConferenciaGeral) return 0;
    proximaConferenciaGeral = Date.now() + 10 * 60_000;
  }
  const abertas = grupoId
    ? await query<{ id: number; grupoId: number; pilotoId: number | null; valor: number; asaasId: string; criadoEm: Date }>(
        `SELECT id id, grupo_id "grupoId", piloto_id "pilotoId", valor_centavos valor, asaas_id "asaasId", criado_em "criadoEm"
           FROM kart.reserva_grupo_cobranca
          WHERE grupo_id = @grupoId AND status = 'aguardando'
          ORDER BY id DESC`,
        { grupoId },
      )
    : await query<{ id: number; grupoId: number; pilotoId: number | null; valor: number; asaasId: string; criadoEm: Date }>(
        `SELECT id id, grupo_id "grupoId", piloto_id "pilotoId", valor_centavos valor, asaas_id "asaasId", criado_em "criadoEm"
           FROM kart.reserva_grupo_cobranca
          WHERE status = 'aguardando' AND criado_em > (now() + make_interval(days => (-4)::int))
          ORDER BY CASE WHEN criado_em > (now() + make_interval(hours => (-12)::int)) THEN 0 ELSE 1 END, id DESC limit 50`,
      );

  let pagas = 0;
  const gruposAfetados = new Set<number>();

  for (const c of abertas) {
    try {
      const s = (await site(`/api/sync/cobranca/${encodeURIComponent(c.asaasId)}`)) as { pago?: boolean; forma?: string; status?: string };
      if (s.pago) {
        const ok = await one<{ Id: number }>(
          `UPDATE kart.reserva_grupo_cobranca SET status = 'pago', pago_em = now()  WHERE id = @id AND status = 'aguardando' returning id`,
          { id: c.id },
        );
        if (ok) {
          const ja = await one<{ Id: number }>(`SELECT id "Id" FROM kart.reserva_grupo_pagamento WHERE asaas_id = @a AND cancelado = false`, { a: c.asaasId });
          if (!ja) {
            await query(
              `INSERT INTO kart.reserva_grupo_pagamento (grupo_id, piloto_id, valor_centavos, forma, origem, asaas_id) VALUES (@g, @p, @v, @f, 'asaas', @a)`,
              { g: c.grupoId, p: c.pilotoId, v: c.valor, f: s.forma === 'PIX' ? 'Pix (Asaas)' : s.forma === 'CREDIT_CARD' ? 'Cartão (Asaas)' : 'Asaas', a: c.asaasId },
            );
          }
          gruposAfetados.add(c.grupoId);
          pagas++;
          log(`grupo ${c.grupoId}: pagamento Asaas ${c.asaasId} recebido`);
        }
      } else if (['REFUNDED', 'DELETED', 'OVERDUE'].includes(String(s.status))) {
        await query(`UPDATE kart.reserva_grupo_cobranca SET status = @s WHERE id = @id`, { id: c.id, s: s.status === 'OVERDUE' ? 'vencida' : 'cancelada' });
      } else if (Date.now() - new Date(c.criadoEm).getTime() > 48 * 3600_000 && String(s.status) === 'PENDING') {
        await query(`UPDATE kart.reserva_grupo_cobranca SET status = 'vencida' WHERE id = @id`, { id: c.id });
      }
    } catch (e) {
      log(`grupo ${c.grupoId}: conferência da cobrança falhou (${(e as Error).message})`);
      // Asaas recusando (cota, fora do ar): insistir nas outras só gasta mais cota; tenta de novo no próximo ciclo
      if (/cota|salvar agora|429|indispon/i.test((e as Error).message)) break;
    }
  }

  for (const gid of gruposAfetados) {
    await aplicarPagos(gid);
  }

  return pagas;
}

const conferenciaGrupo = new Map<number, number>();
/** Abrir/atualizar a reserva só lê a caixa de entrada do webhook (1 chamada barata). O Asaas em si é conferido a cada minuto pelo ciclo do servidor e pelo botão "Conferir no Asaas". */
function conferirEmSegundoPlano(id: number): void {
  const agora = Date.now();
  if (agora - (conferenciaGrupo.get(id) ?? 0) < 20_000) return;
  conferenciaGrupo.set(id, agora);
  void puxarPagamentosDiretoDoAsaas(console.log, id, true).catch(() => 0);
}

/** Resolve grupo e piloto de um pagamento Asaas a partir de cobrança salva, externalReference ou descrição. */
async function resolverGrupoEPilotoAsaas(asaasId: string, externalReference?: string | null, description?: string | null) {
  let gid: number | null = null;
  let pid: number | null = null;
  let modo: string | null = null;

  const mNum = String(externalReference ?? '').match(/^grupo-(\d+)-(\d+|g)$/);
  if (mNum) {
    gid = Number(mNum[1]);
    pid = mNum[2] === 'g' ? null : Number(mNum[2]);
  } else {
    const mCod = String(externalReference ?? '').match(/^grupo-([A-Z0-9]{8})-(.+)$/);
    if (mCod) {
      const grp = await one<{ Id: number; Modo: string }>(`SELECT id "Id", modo "Modo" FROM kart.reserva_grupo WHERE codigo = @c`, { c: mCod[1] });
      if (grp) {
        gid = Number(grp.Id);
        modo = grp.Modo;
        const cpfDig = onlyDigits(mCod[2]);
        if (cpfDig.length >= 11) {
          const pil = await one<{ Id: number }>(
            `SELECT p.id "Id"
               FROM kart.reserva_grupo_piloto p
               JOIN kart.reserva_grupo rg ON rg.id = p.grupo_id
               JOIN kart.cliente c ON c.id = COALESCE(p.cliente_id, CASE WHEN p.responsavel = true THEN rg.responsavel_id END)
               LEFT JOIN kart.inscricao i ON i.id = p.inscricao_id
              WHERE p.grupo_id = @g AND (c.documento_num = @cpf OR c.documento LIKE '%' || @cpf || '%')
              ORDER BY CASE WHEN i.status IS NULL OR i.status <> 'cancelada' THEN 0 ELSE 1 END, p.responsavel DESC, p.ordem limit 1`,
            { g: gid, cpf: cpfDig },
          );
          if (pil) pid = Number(pil.Id);
        }
      }
    } else if (description) {
      const mDesc = String(description).match(/\breserva\s+(G[A-Z0-9]{7})\b/i);
      if (mDesc) {
        const grp = await one<{ Id: number; Modo: string }>(`SELECT id "Id", modo "Modo" FROM kart.reserva_grupo WHERE codigo = @c`, { c: mDesc[1] });
        if (grp) {
          gid = Number(grp.Id);
          modo = grp.Modo;
        }
      }
    }
  }

  // a cobrança do piloto manda: o CPF da referência pode não bater (piloto ainda sem cadastro ligado)
  const cobDoPiloto = await pilotoDaCobranca(asaasId);
  if (cobDoPiloto) {
    gid = cobDoPiloto.grupoId;
    pid = cobDoPiloto.pilotoId ?? pid;
  }
  if (gid && !modo) {
    const grp = await one<{ Modo: string }>(`SELECT modo "Modo" FROM kart.reserva_grupo WHERE id = @g`, { g: gid });
    modo = grp?.Modo ?? null;
  }
  return { gid, pid, modo };
}

/** Puxa pagamentos recebidos diretamente da API do Asaas e notificações de webhook. */
export async function puxarPagamentosDiretoDoAsaas(log: Log, grupoId?: number, soWebhook = false): Promise<number> {
  if (!siteUrl() || !siteChave()) return 0;
  let novos = 0;
  const gruposAfetados = new Set<number>();

  // 1. Notificações do webhook gravadas no worker
  try {
    const webhookNotifs = (await site('/api/sync/grupos/pagos').catch(() => [])) as Array<{
      asaasId?: string; externalReference?: string; billingType?: string; value?: number;
    }>;
    const processadosIds: string[] = [];
    if (Array.isArray(webhookNotifs) && webhookNotifs.length) {
      for (const n of webhookNotifs) {
        if (!n.asaasId || !n.externalReference) continue;
        const ja = await one<{ Id: number }>(`SELECT id "Id" FROM kart.reserva_grupo_pagamento WHERE asaas_id = @a AND cancelado = false`, { a: n.asaasId });
        if (ja) {
          processadosIds.push(n.asaasId);
          continue;
        }

        const rawValue = Math.round(Number(n.value) * 100);
        const descontoCupom = Math.round(Number((n as Record<string, unknown>).descontoCentavos ?? 0));
        const isVoucher = n.billingType === 'VOUCHER';
        const valorCentavos = isVoucher && descontoCupom > 0 ? descontoCupom : rawValue;
        if (!Number.isFinite(valorCentavos) || valorCentavos <= 0) continue;

        const { gid, pid, modo } = await resolverGrupoEPilotoAsaas(n.asaasId, n.externalReference);
        // Quitação 100% por voucher pelo link do grupo aguarda o vínculo do piloto pelo pré-cadastro
        if (isVoucher && !pid) continue;
        if (gid) {
          const forma = isVoucher ? 'Voucher' : n.billingType === 'PIX' ? 'Pix (Asaas)' : n.billingType === 'CREDIT_CARD' ? 'Cartão (Asaas)' : 'Asaas';
          if (modo === 'individual' && !pid) {
            log(`grupo ${gid}: aviso — pagamento webhook ${n.asaasId} sem piloto vinculado no modo individual (não será rateado)`);
          }
          await query(
            `INSERT INTO kart.reserva_grupo_pagamento (grupo_id, piloto_id, valor_centavos, forma, origem, asaas_id) VALUES (@g, @p, @v, @f, @origem, @a)`,
            { g: gid, p: pid, v: valorCentavos, f: forma, origem: isVoucher ? 'voucher' : 'asaas', a: n.asaasId },
          );
          if (isVoucher && (n as Record<string, unknown>).cupom) {
            const codCupom = String((n as Record<string, unknown>).cupom).trim().toUpperCase();
            const [vch] = await query<{ Id: number }>(`SELECT id "Id" FROM kart.voucher WHERE codigo = @c`, { c: codCupom });
            if (vch && pid) {
              const [pil] = await query<{ ClienteId: number | null; InscricaoId: number | null }>(`SELECT cliente_id "ClienteId", inscricao_id "InscricaoId" FROM kart.reserva_grupo_piloto WHERE id = @pid`, { pid });
              const [jaUso] = await query<{ Id: number }>(`SELECT id "Id" FROM kart.reserva_grupo_voucher_uso WHERE asaas_id = @a`, { a: n.asaasId });
              if (!jaUso && pil?.ClienteId) {
                await query(
                  `INSERT INTO kart.reserva_grupo_voucher_uso (asaas_id, grupo_id, piloto_id, voucher_id, cliente_id, desconto_centavos, estado)
                   VALUES (@a, @g, @p, @vid, @cid, @d, 'consumido')`,
                  { a: n.asaasId, g: gid, p: pid, vid: vch.Id, cid: pil.ClienteId, d: valorCentavos },
                ).catch(() => undefined);
              }
              if (pil?.InscricaoId) {
                await query(`UPDATE kart.inscricao SET voucher_id = @vid WHERE id = @insId`, { vid: vch.Id, insId: pil.InscricaoId }).catch(() => undefined);
              }
            }
          }
          await query(`UPDATE kart.reserva_grupo_cobranca SET status = 'pago', pago_em = now() WHERE asaas_id = @a AND status = 'aguardando'`, { a: n.asaasId });
          gruposAfetados.add(gid);
          novos++;
          processadosIds.push(n.asaasId);
          log(`grupo ${gid}: pagamento webhook ${n.asaasId} (${forma}) aplicado`);
        }
      }

      if (processadosIds.length) {
        await site('/api/sync/grupos/pagos/limpar', { method: 'POST', body: JSON.stringify({ ids: processadosIds }) }).catch(() => undefined);
      }
    }
  } catch (e) {
    log(`aviso webhook grupos: ${(e as Error).message}`);
  }

  // 2. Consulta direta de pagamentos recebidos no Asaas hoje e ontem (rede de segurança; só no ciclo de 1 min)
  if (!soWebhook) try {
    const ontem = new Date(Date.now() - 3 * 3600_000 - 86400_000).toISOString().slice(0, 10);
    const pagas = (await site(`/api/sync/asaas/pagamentos?de=${ontem}`).catch(() => [])) as Array<{
      id: string; status: string; value: number; billingType: string; externalReference?: string; description?: string;
    }>;

    if (Array.isArray(pagas)) {
      for (const p of pagas) {
        if (!p.id || !['RECEIVED', 'CONFIRMED'].includes(p.status)) continue;
        const ja = await one<{ Id: number }>(`SELECT id "Id" FROM kart.reserva_grupo_pagamento WHERE asaas_id = @a AND cancelado = false`, { a: p.id });
        if (ja) continue;

        // Bate por AsaasId direto na cobrança gerada pelo sistema
        const cob = await one<{ Id: number; GrupoId: number; PilotoId: number | null; ValorCentavos: number }>(
          `SELECT id "Id", grupo_id "GrupoId", piloto_id "PilotoId", valor_centavos "ValorCentavos" FROM kart.reserva_grupo_cobranca WHERE asaas_id = @a`, { a: p.id },
        );
        if (cob) {
          const valorCentavos = Math.round(Number(p.value) * 100) || cob.ValorCentavos;
          const forma = p.billingType === 'PIX' ? 'Pix (Asaas)' : p.billingType === 'CREDIT_CARD' ? 'Cartão (Asaas)' : 'Asaas';
          await query(
            `INSERT INTO kart.reserva_grupo_pagamento (grupo_id, piloto_id, valor_centavos, forma, origem, asaas_id) VALUES (@g, @p, @v, @f, 'asaas', @a)`,
            { g: cob.GrupoId, p: cob.PilotoId, v: valorCentavos, f: forma, a: p.id },
          );
          await query(`UPDATE kart.reserva_grupo_cobranca SET status = 'pago', pago_em = now() WHERE id = @id AND status = 'aguardando'`, { id: cob.Id });
          gruposAfetados.add(cob.GrupoId);
          novos++;
          log(`grupo ${cob.GrupoId}: pagamento Asaas ${p.id} conciliado diretamente`);
          continue;
        }

        const valorCentavos = Math.round(Number(p.value) * 100);
        if (!Number.isFinite(valorCentavos) || valorCentavos <= 0) continue;

        const { gid, pid, modo } = await resolverGrupoEPilotoAsaas(p.id, p.externalReference, p.description);
        if (gid) {
          if (grupoId && gid !== grupoId) continue;
          const forma = p.billingType === 'PIX' ? 'Pix (Asaas)' : p.billingType === 'CREDIT_CARD' ? 'Cartão (Asaas)' : 'Asaas';
          if (modo === 'individual' && !pid) {
            log(`grupo ${gid}: aviso — pagamento Asaas ${p.id} sem piloto vinculado no modo individual (não será rateado)`);
          }
          await query(
            `INSERT INTO kart.reserva_grupo_pagamento (grupo_id, piloto_id, valor_centavos, forma, origem, asaas_id) VALUES (@g, @p, @v, @f, 'asaas', @a)`,
            { g: gid, p: pid, v: valorCentavos, f: forma, a: p.id },
          );
          await query(`UPDATE kart.reserva_grupo_cobranca SET status = 'pago', pago_em = now() WHERE asaas_id = @a AND status = 'aguardando'`, { a: p.id });
          gruposAfetados.add(gid);
          novos++;
          log(`grupo ${gid}: pagamento Asaas ${p.id} (${forma}, R$ ${(valorCentavos / 100).toFixed(2)}) conciliado`);
        }
      }
    }
  } catch (e) {
    log(`aviso consulta pagamentos recentes Asaas: ${(e as Error).message}`);
  }

  for (const gid of gruposAfetados) {
    await aplicarPagos(gid);
  }

  return novos;
}

// ---------------------------------------------------------------- rotas (/api/office/grupos…)

async function novoPiloto(run: (t: string, p?: Record<string, unknown>) => Promise<Linha[]>, grupoId: number, ordem: number, p: PilotoIn, inscricaoId: number, responsavel: boolean, clienteId: number | null) {
  await run(
    `INSERT INTO kart.reserva_grupo_piloto (grupo_id, ordem, nome, telefone, menor, responsavel, cliente_id, inscricao_id, token)
     VALUES (@g, @o, @n, @t, @m, @r, @c, @i, @k)`,
    { g: grupoId, o: ordem, n: txt(p.nome, 120), t: fone(p.telefone), m: p.menor ? 1 : 0, r: responsavel ? 1 : 0, c: clienteId, i: inscricaoId, k: tokenNovo() },
  );
}

const semAcento = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Quem liga ou escreve pelo WhatsApp quase nunca é cliente antigo e só informa nome e telefone. Cria (ou reaproveita, se o mesmo
 * nome já existe com o mesmo telefone) um cadastro PROVISÓRIO só com nome e WhatsApp: a pessoa completa o resto pelo link do
 * grupo e o cadastro dela substitui este (ver vincularCadastroDoLink).
 */
export async function responsavelProvisorio(r?: { nome?: unknown; telefone?: unknown }) {
  const nome = txt(r?.nome, 100);
  const tel = fone(r?.telefone);
  if (!nome || semAcento(nome).split(' ').length < 2) throw new HttpError(400, 'Informe nome e sobrenome do responsável.');
  if (!tel) throw new HttpError(400, 'Informe o WhatsApp do responsável, com DDD.');
  const fim = onlyDigits(tel).slice(-9);
  const iguais = await query<{ id: number; nome: string; telefone: string | null }>(
    `SELECT id id, nome nome, telefone telefone FROM kart.cliente WHERE telefone IS NOT NULL AND telefone LIKE '%' || @fim ORDER BY id DESC limit 20`, { fim: fim.slice(-4) },
  );
  const ja = iguais.find((c) => onlyDigits(c.telefone).slice(-9) === fim && semAcento(c.nome) === semAcento(nome));
  if (ja) return ja.id;
  return insertCliente({ nome, telefone: tel } as ClienteInput, 'recepcao');
}

type Executa = (t: string, p?: Record<string, unknown>) => Promise<Linha[]>;

/**
 * Vaga ainda sem cadastro: ganha um cadastro PROVISÓRIO próprio ("Amigo 2 de Maria Souza", ou o nome que a Recepção já digitou).
 * Sem isso todas as vagas ficam no cadastro do responsável e a Recepção, o crono e o tablet enxergam um único piloto repetido
 * (e os amigos ficam sem kart). Quando o amigo se cadastra pelo link, o cadastro dele substitui este (vincularCadastroDoLink).
 */
async function cadastroDaVaga(run: Executa, responsavelId: number, ordem: number, nome: string | null, telefone: string | null) {
  const [r] = await run(`SELECT nome "Nome" FROM kart.cliente WHERE id = @id`, { id: responsavelId });
  const rotulo = (nome && nome.trim()) || `Amigo ${ordem} de ${String(r?.Nome ?? 'responsável')}`;
  const [c] = await run(
    `INSERT INTO kart.cliente (nome, telefone, telefone_num, origem)  VALUES (@n, @t, @tn, 'grupo') returning id id`,
    { n: rotulo.slice(0, 200), t: telefone, tn: telefone ? onlyDigits(telefone).slice(-20) || null : null },
  );
  return Number(c.id);
}

/** Apaga os cadastros provisórios de vaga que ninguém mais usa (o amigo se cadastrou e a reserva passou para ele). */
async function limparProvisorios() {
  await query(
    `DELETE FROM kart.cliente WHERE origem = 'grupo' AND documento IS NULL
       AND NOT EXISTS (SELECT 1 FROM kart.inscricao i WHERE i.cliente_id = cliente.id)
       AND NOT EXISTS (SELECT 1 FROM kart.reserva_grupo g WHERE g.responsavel_id = cliente.id)
       AND NOT EXISTS (SELECT 1 FROM kart.reserva_grupo_piloto p WHERE p.cliente_id = cliente.id)`,
  ).catch(() => undefined);
}

/**
 * Movimenta um participante que fez cadastro no grupo errado (totem/link) ou quer sair do grupo:
 * - 'sozinho': a reserva dele se torna avulsa (individual) e a vaga no grupo de origem é restaurada (volta a aguardar cadastro).
 *   Pode permanecer na mesma bateria ou ir para outra se informada 'novaBateriaId'.
 * - 'outro_grupo': transfere a pessoa para outro grupo ativo ('novoGrupoId'), liberando a vaga no grupo de origem.
 */
export async function desvincularPilotoDoGrupo(
  grupoId: number,
  pilotoId: number,
  opts: { destino: 'sozinho' | 'outro_grupo'; novaBateriaId?: number; novoGrupoId?: number },
  sessaoUid: number,
  log: Log,
) {
  return await tx(async (run) => {
    const [g] = await run(
      `SELECT id id, bateria_id "bateriaId", responsavel_id "responsavelId", codigo codigo FROM kart.reserva_grupo WHERE id = @g AND status = 'ativa' for update`,
      { g: grupoId },
    );
    if (!g) throw new HttpError(404, 'Reserva em grupo não encontrada.');

    const [p] = await run(
      `SELECT id id, ordem ordem, nome nome, telefone telefone, cliente_id "clienteId", inscricao_id "inscricaoId", responsavel responsavel
         FROM kart.reserva_grupo_piloto WHERE id = @pid AND grupo_id = @g for update`,
      { pid: pilotoId, g: grupoId },
    );
    if (!p) throw new HttpError(404, 'Piloto não encontrado no grupo.');
    if (p.responsavel) throw new HttpError(400, 'Não é possível desvincular o responsável principal da reserva.');
    // O pagamento fica preso à linha do piloto no grupo de origem, que recebe uma vaga nova: mover quem já pagou
    // fazia o mesmo dinheiro cobrir a pessoa movida E a vaga que ficou (revisão de 19/11/2026). Até existir a
    // transferência do pagamento junto com a pessoa, a recepção ajusta o pagamento antes de mover.
    const [dinheiro] = await run(
      `SELECT
         (SELECT COALESCE(SUM(valor_centavos), 0) FROM kart.reserva_grupo_pagamento WHERE grupo_id = @g AND piloto_id = @pid AND cancelado = false) "pago",
         (SELECT COUNT(*) FROM kart.reserva_grupo_cobranca WHERE grupo_id = @g AND piloto_id = @pid AND status = 'aguardando') "cobrancas"`,
      { g: grupoId, pid: pilotoId },
    );
    if (Number(dinheiro?.pago ?? 0) > 0)
      throw new HttpError(409, 'Este piloto já tem pagamento no grupo. Estorne ou passe o pagamento para outra vaga antes de mover.');
    if (Number(dinheiro?.cobrancas ?? 0) > 0)
      throw new HttpError(409, 'Este piloto tem um link de pagamento aberto. Cancele a cobrança antes de mover.');

    const inscricaoId = p.inscricaoId ? Number(p.inscricaoId) : null;
    const clienteId = p.clienteId ? Number(p.clienteId) : null;
    const ordem = Number(p.ordem);

    if (opts.destino === 'sozinho') {
      if (inscricaoId) {
        await run(
          `UPDATE kart.inscricao
              SET responsavel_id = NULL,
                  observacao = LEFT('Inscrição avulsa / individual (desvinculado do grupo ' || @cod || ')' || CASE WHEN observacao IS NOT NULL AND observacao <> '' THEN ' · ' || observacao ELSE '' END, 400),
                  atualizado_em = now()
            WHERE id = @i`,
          { i: inscricaoId, cod: g.codigo },
        );
        if (opts.novaBateriaId && Number(opts.novaBateriaId) !== Number(g.bateriaId)) {
          await moverReservas([inscricaoId], Number(opts.novaBateriaId), undefined, { run });
        }
      }

      // Restaura a vaga no grupo de origem
      const cid = await cadastroDaVaga(run, Number(g.responsavelId), ordem, null, null);
      const [novaInsc] = await inscreverN(Number(g.bateriaId), Number(g.responsavelId), 1, 'recepcao', sessaoUid, 'Reserva em grupo pelo painel web', false, { vagaDoGrupo: true, run });
      await run(`UPDATE kart.inscricao SET cliente_id = @c WHERE id = @i`, { c: cid, i: novaInsc });
      await run(
        `UPDATE kart.reserva_grupo_piloto
            SET cliente_id = @c, nome = '', telefone = NULL, cadastro_em = NULL, inscricao_id = @novaInsc, pago_pelo_grupo = false
          WHERE id = @pid`,
        { c: cid, novaInsc, pid: p.id },
      );

      log(`grupo ${grupoId}: piloto ${p.id} (cliente ${clienteId}) desvinculado e colocado sozinho (inscrição ${inscricaoId})`);
    } else if (opts.destino === 'outro_grupo') {
      const novoGrupoId = Number(opts.novoGrupoId);
      if (!novoGrupoId || novoGrupoId === grupoId) throw new HttpError(400, 'Selecione um grupo de destino diferente do atual.');

      const [ng] = await run(
        `SELECT id id, bateria_id "bateriaId", responsavel_id "responsavelId", codigo codigo FROM kart.reserva_grupo WHERE id = @ng AND status = 'ativa' for update`,
        { ng: novoGrupoId },
      );
      if (!ng) throw new HttpError(404, 'Grupo de destino não encontrado ou inativo.');

      if (inscricaoId && Number(g.bateriaId) !== Number(ng.bateriaId)) {
        await moverReservas([inscricaoId], Number(ng.bateriaId), undefined, { run });
      }

      // No novo grupo: procura vaga aguardando
      const [vagaDestino] = await run(
        `SELECT v.id id, v.inscricao_id "inscricaoId"
           FROM kart.reserva_grupo_piloto v
          WHERE v.grupo_id = @ng
            AND v.responsavel = false
            AND v.cliente_id IS NOT NULL
            AND EXISTS (SELECT 1 FROM kart.cliente c WHERE c.id = v.cliente_id AND c.origem = 'grupo')
          ORDER BY v.ordem limit 1`,
        { ng: novoGrupoId },
      );

      if (vagaDestino) {
        if (inscricaoId) {
          if (vagaDestino.inscricaoId && vagaDestino.inscricaoId !== inscricaoId) {
            await run(`UPDATE kart.inscricao SET status = 'cancelada', pago = false, atualizado_em = now() WHERE id = @oldInsc`, { oldInsc: vagaDestino.inscricaoId });
          }
          await run(
            `UPDATE kart.inscricao
                SET responsavel_id = @resp,
                    observacao = LEFT('Reserva em grupo ' || @cod || ' pelo painel web' || CASE WHEN observacao IS NOT NULL AND observacao <> '' THEN ' · ' || observacao ELSE '' END, 400),
                    atualizado_em = now()
              WHERE id = @i`,
            { resp: ng.responsavelId, cod: ng.codigo, i: inscricaoId },
          );
        }

        await run(
          `UPDATE kart.reserva_grupo_piloto p
              SET cliente_id = @c,
                  inscricao_id = COALESCE(@insc::int, p.inscricao_id),
                  cadastro_em = now(),
                  nome = COALESCE(NULLIF(c.nome, ''), p.nome),
                  telefone = COALESCE(NULLIF(c.telefone, ''), p.telefone)
             FROM (SELECT 1) um LEFT JOIN kart.cliente c ON c.id = @c
            WHERE p.id = @vagaId`,
          { c: clienteId, insc: inscricaoId, vagaId: vagaDestino.id },
        );
      } else {
        const [ordemNova] = await run(`SELECT coalesce(MAX(ordem), 0) + 1 proxima FROM kart.reserva_grupo_piloto WHERE grupo_id = @ng`, { ng: novoGrupoId });
        const proxima = Number(ordemNova.proxima);
        let finalInsc = inscricaoId;
        if (!finalInsc) {
          const [insc] = await inscreverN(Number(ng.bateriaId), Number(ng.responsavelId), 1, 'recepcao', sessaoUid, `Reserva em grupo ${ng.codigo} pelo painel web`, false, { vagaDoGrupo: true, run });
          finalInsc = insc;
        } else {
          await run(
            `UPDATE kart.inscricao
                SET responsavel_id = @resp,
                    observacao = LEFT('Reserva em grupo ' || @cod || ' pelo painel web' || CASE WHEN observacao IS NOT NULL AND observacao <> '' THEN ' · ' || observacao ELSE '' END, 400),
                    atualizado_em = now()
              WHERE id = @i`,
            { resp: ng.responsavelId, cod: ng.codigo, i: finalInsc },
          );
        }
        await novoPiloto(run, novoGrupoId, proxima, { nome: p.nome ?? '', telefone: p.telefone ?? '', menor: false }, finalInsc, false, clienteId);
        await run(`UPDATE kart.reserva_grupo_piloto SET cadastro_em = now() WHERE grupo_id = @ng AND ordem = @o`, { ng: novoGrupoId, o: proxima });
      }

      // Restaura a vaga no grupo de origem DEPOIS de ocupar o destino: na mesma bateria lotada, a vaga do destino
      // (cancelada acima) é a que a origem reaproveita; na ordem antiga a bateria precisava de uma vaga a mais e
      // "Mover para outro grupo" falhava com "Não há vagas" (revisão de 19/11/2026).
      const cidOrigem = await cadastroDaVaga(run, Number(g.responsavelId), ordem, null, null);
      const [novaInscOrigem] = await inscreverN(Number(g.bateriaId), Number(g.responsavelId), 1, 'recepcao', sessaoUid, 'Reserva em grupo pelo painel web', false, { vagaDoGrupo: true, run });
      await run(`UPDATE kart.inscricao SET cliente_id = @c WHERE id = @i`, { c: cidOrigem, i: novaInscOrigem });
      await run(
        `UPDATE kart.reserva_grupo_piloto
            SET cliente_id = @c, nome = '', telefone = NULL, cadastro_em = NULL, inscricao_id = @novaInsc, pago_pelo_grupo = false
          WHERE id = @pid`,
        { c: cidOrigem, novaInsc: novaInscOrigem, pid: p.id },
      );

      log(`grupo ${grupoId}: piloto ${p.id} transferido para o grupo ${novoGrupoId} (${ng.codigo})`);
    } else {
      throw new HttpError(400, 'Destino inválido: escolha "sozinho" ou "outro_grupo".');
    }

    await limparProvisorios();
    return { ok: true, mensagem: opts.destino === 'sozinho' ? 'Participante colocado sozinho como reserva individual.' : 'Participante transferido para o novo grupo com sucesso.' };
  });
}

/** Campos da promoção do aniversariante vindos do painel: { aniversario: true, precoAniversarianteCentavos?: 9000 }. */
function aniversarioDe(b: Record<string, unknown>) {
  const aniv = b.aniversario === true || b.aniversario === 1 || b.aniversario === '1';
  const precoAniv = aniv && b.precoAniversarianteCentavos != null && b.precoAniversarianteCentavos !== ''
    ? Math.max(0, Math.round(Number(b.precoAniversarianteCentavos)) || 0) : aniv ? ANIVERSARIO_PRECO_PADRAO : null;
  return { aniv: aniv ? 1 : 0, precoAniv };
}

export async function gruposRoutes(req: Req, send: Res): Promise<boolean> {
  const { method, url, sessao } = req;
  const path = url.pathname.replace(/^\/api\/office/, '');
  let m: RegExpMatchArray | null;
  if ((m = path.match(/^\/baterias\/(\d+)\/tipo$/)) && method === 'POST') {
    await exigePermissaoOffice(sessao, path, method);
    const body = await req.body(); const tipo = String(body.tipo ?? '');
    const estado = body.estadoAnterior as { status: string; reservaFechada: boolean; autoAtendimento: boolean } | undefined;
    if (estado && (!['aberta', 'fechada'].includes(estado.status) || typeof estado.reservaFechada !== 'boolean' || typeof estado.autoAtendimento !== 'boolean')) throw new HttpError(400, 'Estado de bateria inválido.');
    if (tipo === 'fechada' || tipo === 'bloqueada' || estado?.status === 'fechada' || estado?.reservaFechada || estado?.autoAtendimento === false) await exigePodeFecharBateria(sessao);
    await tipoDaBateria(Number(m[1]), tipo, estado);
    send(200, { ok: true });
    return true;
  }
  // aviso no topo da reserva online (reservas.kartodromodebetim.com.br): texto curto, tom info/alerta e validade opcional
  if (path === '/aviso-reserva') {
    if (method === 'GET') {
      const r = siteUrl() ? await fetch(siteUrl() + '/api/aviso', { signal: AbortSignal.timeout(10_000) }).catch(() => null) : null;
      send(200, r && r.ok ? await r.json() : null);
      return true;
    }
    if (method === 'PUT') {
      await exigePodeFecharBateria(sessao);
      const b = await req.body();
      const r = await site('/api/sync/aviso', { method: 'PUT', body: JSON.stringify({ texto: txt(b.texto, 400) ?? '', tom: b.tom === 'alerta' ? 'alerta' : 'info', ate: txt(b.ate, 30) }) });
      send(200, r.aviso ?? null);
      return true;
    }
  }
  if (!path.startsWith('/grupos')) return false;
  await exigePermissaoOffice(sessao, path, method);

  if (path === '/grupos' && method === 'GET') {
    const bat = url.searchParams.get('bateriaId');
    if (bat) { send(200, await carregarGrupos(`g.bateria_id = @b AND g.status = 'ativa'`, { b: int(bat, 'Bateria') })); return true; }
    const de = String(url.searchParams.get('de') ?? ''), ate = String(url.searchParams.get('ate') ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) throw new HttpError(400, 'Informe o período.');
    send(200, await carregarGrupos(`g.status = 'ativa' AND b.inicio >= @de::date AND b.inicio < @ate::date + 1`, { de, ate }));
    return true;
  }

  if (path === '/grupos/pendencias' && method === 'GET') {
    // quem chegou/reservou sozinho na bateria e as vagas de grupo que aguardam cadastro: a recepção liga uma coisa à outra
    const b = int(url.searchParams.get('bateriaId'), 'Bateria');
    const grupos = await query<{ id: number; codigo: string; responsavel: string }>(
      `SELECT g.id id, g.codigo codigo, r.nome responsavel FROM kart.reserva_grupo g JOIN kart.cliente r ON r.id = g.responsavel_id WHERE g.bateria_id = @b AND g.status = 'ativa'`, { b });
    const comVagas = [];
    for (const g of grupos) { const livres = await vagasAguardando(g.id); if (livres.length) comVagas.push({ ...g, vagas: livres.map((v) => ({ id: v.id, ordem: v.ordem, nome: v.nome })) }); }
    const candidatos = comVagas.length ? await query(
      `SELECT i.id "inscricaoId", c.id "clienteId", c.nome nome, i.origem origem, i.pago pago
         FROM kart.inscricao i JOIN kart.cliente c ON c.id = i.cliente_id
        WHERE i.bateria_id = @b AND i.status <> 'cancelada'
          AND NOT EXISTS (SELECT 1 FROM kart.reserva_grupo_piloto p JOIN kart.reserva_grupo g ON g.id = p.grupo_id AND g.status = 'ativa' WHERE p.inscricao_id = i.id)
          AND NOT EXISTS (SELECT 1 FROM kart.reserva_grupo_piloto p JOIN kart.reserva_grupo g ON g.id = p.grupo_id AND g.status = 'ativa' WHERE p.cliente_id = c.id AND g.bateria_id = @b)
          AND NOT EXISTS (SELECT 1 FROM kart.reserva_grupo g WHERE g.status = 'ativa' AND g.bateria_id = @b AND g.responsavel_id = c.id)
        ORDER BY c.nome`, { b }) : [];
    send(200, { grupos: comVagas, candidatos });
    return true;
  }
  if ((m = path.match(/^\/grupos\/(\d+)\/vincular$/)) && method === 'POST') {
    const b = await req.body();
    const rv = await vincularClienteAoGrupo(Number(m[1]), int(b.clienteId, 'Cliente'), b.pilotoId ? int(b.pilotoId, 'Vaga') : null, (...a) => console.log(...a), b.puxarDados === true);
    send(200, b.puxarDados === true ? await grupo(Number(m[1])) : rv);
    return true;
  }
  if (path === '/grupos' && method === 'POST') {
    const b = await req.body();
    const bateriaId = int(b.bateriaId, 'Bateria');
    const responsavelId = b.responsavelId ? int(b.responsavelId, 'Responsável') : await responsavelProvisorio(b.responsavelNovo as { nome?: unknown; telefone?: unknown } | undefined);
    const pilotos = (Array.isArray(b.pilotos) ? b.pilotos : []).slice(0, 40) as PilotoIn[];
    if (!pilotos.length) throw new HttpError(400, 'Informe ao menos um piloto.');
    const modo = MODOS.find((x) => x === b.modo) ?? 'individual';
    const origem = ORIGENS.find((x) => x === b.origem) ?? 'recepcao';
    const bat = await one<{ preco: number | null; produtoId: number | null }>(
      `SELECT p.preco_centavos preco, b.produto_id "produtoId" FROM kart.bateria b LEFT JOIN kart.produto p ON p.id = b.produto_id WHERE b.id = @id`, { id: bateriaId },
    );
    if (!bat) throw new HttpError(404, 'Bateria não encontrada.');
    const preco = b.precoCentavos != null && b.precoCentavos !== '' ? cents(b.precoCentavos, 'Preço por piloto') : Number(bat.preco) || 0;
    if (preco <= 0) throw new HttpError(400, 'Informe o preço por piloto.');
    const sinalPct = Math.max(0, Math.min(100, Math.round(Number(b.sinalPct ?? 30)) || 0));
    const obs = txt(b.observacao, 300);
    // as vagas: o mesmo caminho da Recepção (confere vaga, cliente bloqueado, bateria passada)
    const id = await tx(async (run) => {
      const [aberta] = await run(`SELECT status status, reserva_fechada fechada FROM kart.bateria WHERE id = @id for update`, { id: bateriaId });
      if (!aberta || aberta.status !== 'aberta' || aberta.fechada) throw new HttpError(409, 'Abra a bateria antes de criar outro grupo.');
      const insc = await inscreverN(bateriaId, responsavelId, pilotos.length, origem === 'site' ? 'site' : 'recepcao', sessao.uid, `Reserva em grupo pelo painel web${obs ? ` · ${obs}` : ''}`.slice(0, 400), false, { produtoId: bat.produtoId, vagaDoGrupo: true, run });
        const [g] = await run(
          `INSERT INTO kart.reserva_grupo (codigo, bateria_id, responsavel_id, origem, modo, preco_centavos, sinal_pct, observacao, criado_por, aniversario, preco_aniversariante_centavos)
            VALUES (@codigo, @b, @r, @o, @m, @preco, @sinal, @obs, @u, @aniv, @precoAniv) returning id id`,
          { codigo: codigoNovo(), b: bateriaId, r: responsavelId, o: origem, m: modo, preco, sinal: sinalPct, obs, u: sessao.uid, ...aniversarioDe(b) },
        );
        for (let k = 0; k < pilotos.length; k++) await novoPiloto(run, Number(g.id), k + 1, pilotos[k], insc[k], k === 0, k === 0 ? responsavelId : null);
        // cada amigo é uma pessoa: a vaga nasce com cadastro provisório próprio, não no nome do responsável
        for (let k = 1; k < pilotos.length; k++) {
          const cid = await cadastroDaVaga(run, responsavelId, k + 1, txt(pilotos[k].nome, 120) ?? null, fone(pilotos[k].telefone) ?? null);
          await run(`UPDATE kart.inscricao SET cliente_id = @c WHERE id = @i`, { c: cid, i: insc[k] });
        }
        await run(`UPDATE kart.inscricao SET preco_centavos = @preco WHERE id IN (${insc.map(Number).join(',')})`, { preco });
        return Number(g.id);
    });
    await aplicarPagos(id);
    send(201, await grupo(id));
    return true;
  }

  if ((m = path.match(/^\/grupos\/(\d+)\/mover$/)) && method === 'POST') {
    const corpo = await req.body();
    const r = await moverReservas([], int(corpo.bateriaId, 'Bateria'), Number(m[1]), { trocarServico: corpo.trocarServico === true });
    send(200, { ...(await grupo(Number(m[1]))), ...r });
    return true;
  }

  if ((m = path.match(/^\/grupos\/(\d+)\/conferir-asaas$/)) && method === 'POST') {
    const id = Number(m[1]);
    const pagasCob = await conferirCobrancas(console.log, id).catch(() => 0);
    const pagasDir = await puxarPagamentosDiretoDoAsaas(console.log, id).catch(() => 0);
    send(200, { ok: true, pagas: pagasCob + pagasDir, grupo: await grupo(id) });
    return true;
  }

  if ((m = path.match(/^\/grupos\/(\d+)$/))) {
    const id = Number(m[1]);
    if (method === 'GET') {
      // O Asaas avisa por webhook: não consultamos o Asaas a cada abertura. Só drenamos a caixa do webhook em segundo plano;
      // o ciclo de 1 min e o botão "Conferir no Asaas" cobrem o que o webhook perder.
      conferirEmSegundoPlano(id);
      send(200, await grupo(id));
      return true;
    }
    if (method === 'PUT') {
      const b = await req.body();
      const atual = await grupo(id);
      const modo = MODOS.find((x) => x === b.modo) ?? atual.modo;
      const preco = b.precoCentavos != null ? cents(b.precoCentavos, 'Preço por piloto') : Number(atual.preco);
      const sinal = b.sinalPct != null ? Math.max(0, Math.min(100, Math.round(Number(b.sinalPct)) || 0)) : Number(atual.sinalPct);
      await tx(async (run) => {
        const [vigente] = await run(`SELECT preco_centavos preco, modo modo FROM kart.reserva_grupo WHERE id = @id AND status = 'ativa' for update`, { id });
        if (!vigente) throw new HttpError(409, 'Esta reserva não está ativa.');
        if (preco !== Number(vigente.preco) || modo !== vigente.modo) {
          const [financeiro] = await run(`SELECT
            (SELECT COUNT(*) FROM kart.reserva_grupo_pagamento WHERE grupo_id = @id AND cancelado = false) pagamentos,
            (SELECT COUNT(*) FROM kart.reserva_grupo_cobranca WHERE grupo_id = @id AND status IN ('aguardando', 'pago')) cobrancas,
            (SELECT COUNT(*) FROM kart.reserva_grupo_piloto p JOIN kart.inscricao i ON i.id = p.inscricao_id WHERE p.grupo_id = @id AND i.pago = true AND i.status <> 'cancelada') pagos`, { id });
          if (financeiro && (financeiro.pagamentos || financeiro.cobrancas || financeiro.pagos))
            throw new HttpError(409, 'Há pagamentos ou cobranças neste grupo. Resolva-os antes de alterar preço ou forma de divisão.');
        }
        await run(`UPDATE kart.reserva_grupo SET modo = @modo, preco_centavos = @preco, sinal_pct = @sinal, observacao = @obs, atualizado_em = now() WHERE id = @id`,
          { id, modo, preco, sinal, obs: b.observacao !== undefined ? txt(b.observacao, 300) : atual.observacao ?? null });
        if (b.aniversario !== undefined || b.precoAniversarianteCentavos !== undefined) {
          const a = aniversarioDe({ aniversario: b.aniversario !== undefined ? b.aniversario : atual.aniversario, precoAniversarianteCentavos: b.precoAniversarianteCentavos ?? atual.promocao?.precoAniversariante });
          await run(`UPDATE kart.reserva_grupo SET aniversario = @aniv, preco_aniversariante_centavos = @precoAniv, atualizado_em = now() WHERE id = @id`, { id, ...a });
        }
        if (preco !== Number(vigente.preco)) await run(`UPDATE kart.inscricao i SET preco_centavos = @preco, desconto_centavos = 0
          FROM kart.reserva_grupo_piloto p
          WHERE p.inscricao_id = i.id AND p.grupo_id = @id AND i.status <> 'cancelada' AND i.pago = false`, { id, preco });
      });
      await aplicarPagos(id);
      send(200, await grupo(id));
      return true;
    }
    if (method === 'DELETE') {
      await grupo(id);
      await tx(async (run) => {
        await run(`SELECT id "Id" FROM kart.reserva_grupo WHERE id = @id for update`, { id });
        await run(`UPDATE kart.inscricao SET status = 'cancelada', atualizado_em = now() WHERE id IN (SELECT inscricao_id "InscricaoId" FROM kart.reserva_grupo_piloto WHERE grupo_id = @id)`, { id });
        await run(`UPDATE kart.reserva_grupo SET status = 'cancelada', atualizado_em = now() WHERE id = @id`, { id });
      });
      send(200, { ok: true });
      return true;
    }
  }

  if ((m = path.match(/^\/grupos\/(\d+)\/pilotos$/)) && method === 'POST') {
    const id = Number(m[1]);
    const g = await grupo(id);
    const p = (await req.body()) as PilotoIn;
    await tx(async (run) => {
      const [atual] = await run(`SELECT id "Id", bateria_id "bateriaId", preco_centavos preco FROM kart.reserva_grupo WHERE id = @id AND status = 'ativa' for update`, { id });
      if (!atual) throw new HttpError(409, 'Esta reserva não está ativa.');
      const [ordem] = await run(`SELECT coalesce(MAX(ordem), 0) + 1 proxima FROM kart.reserva_grupo_piloto WHERE grupo_id = @id`, { id });
      const proxima = Number(ordem.proxima);
      const [insc] = await inscreverN(Number(atual.bateriaId), Number(g.responsavelId), 1, 'recepcao', sessao.uid, `Reserva em grupo ${g.codigo} pelo painel web`, false, { vagaDoGrupo: true, run });
      await novoPiloto(run, id, proxima, p, insc, false, null);
      const cid = await cadastroDaVaga(run, Number(g.responsavelId), proxima, txt(p.nome, 120) ?? null, fone(p.telefone) ?? null);
      await run(`UPDATE kart.inscricao SET cliente_id = @c, responsavel_id = @r, preco_centavos = @p WHERE id = @i`, { c: cid, r: g.responsavelId, p: atual.preco, i: insc });
    });
    await aplicarPagos(id);
    send(201, await grupo(id));
    return true;
  }

  if ((m = path.match(/^\/grupos\/(\d+)\/pilotos\/(\d+)$/))) {
    const id = Number(m[1]), pid = Number(m[2]);
    const g = await grupo(id);
    const p = g.pilotos.find((x) => x.id === pid);
    if (!p && method === 'DELETE' && await one(`SELECT p.id "Id" FROM kart.reserva_grupo_piloto p JOIN kart.inscricao i ON i.id = p.inscricao_id WHERE p.id = @pid AND p.grupo_id = @id AND i.status = 'cancelada'`, { pid, id })) {
      send(200, g);
      return true;
    }
    if (!p) throw new HttpError(404, 'Piloto não encontrado no grupo.');
    if (method === 'PUT') {
      const b = (await req.body()) as PilotoIn;
      await query(`UPDATE kart.reserva_grupo_piloto SET nome = @n, telefone = @t, menor = @m WHERE id = @id`, { id: pid, n: txt(b.nome, 120), t: b.telefone === '' ? null : fone(b.telefone) ?? txt(b.telefone, 30), m: b.menor ? 1 : 0 });
      if (!p.clienteId && p.inscricaoId) {
        await query(
          `UPDATE kart.cliente c SET nome = LEFT(COALESCE(NULLIF(trim(@n), ''), 'Amigo ' || (@o)::text || ' de ' || r.nome), 200), telefone = COALESCE(@t, c.telefone)
             FROM kart.inscricao i, kart.cliente r WHERE i.cliente_id = c.id AND r.id = @r AND i.id = @i AND c.origem = 'grupo'`,
          { n: txt(b.nome, 120) ?? '', o: p.ordem, t: b.telefone === '' ? null : fone(b.telefone) ?? null, r: g.responsavelId, i: p.inscricaoId },
        ).catch(() => undefined);
      }
      send(200, await grupo(id));
      return true;
    }
    if (method === 'DELETE') {
      if (!p.inscricaoId) throw new HttpError(409, 'Este piloto não tem uma inscrição vinculada.');
      await cancelarReserva(Number(p.inscricaoId));
      send(200, await grupo(id));
      return true;
    }
  }

  if ((m = path.match(/^\/grupos\/(\d+)\/pilotos\/(\d+)\/desvincular$/)) && method === 'POST') {
    const id = Number(m[1]), pid = Number(m[2]);
    const b = (await req.body()) as { destino?: unknown; novaBateriaId?: unknown; novoGrupoId?: unknown };
    const destino = b.destino === 'outro_grupo' ? 'outro_grupo' : 'sozinho';
    const res = await desvincularPilotoDoGrupo(
      id,
      pid,
      {
        destino,
        novaBateriaId: b.novaBateriaId ? Number(b.novaBateriaId) : undefined,
        novoGrupoId: b.novoGrupoId ? Number(b.novoGrupoId) : undefined,
      },
      sessao.uid,
      (...a) => console.log(...a),
    );
    await aplicarPagos(id);
    if (b.novoGrupoId) await aplicarPagos(Number(b.novoGrupoId)).catch(() => undefined);
    send(200, { ...res, grupo: await grupo(id) });
    return true;
  }

  if ((m = path.match(/^\/grupos\/(\d+)\/links$/)) && method === 'POST') {
    const id = Number(m[1]);
    const b = await req.body();
    const ids = (Array.isArray(b.pilotoIds) ? b.pilotoIds : []).map(Number).filter((x: number) => Number.isInteger(x) && x > 0);
    if (ids.length) {
      const pmap: Record<string, unknown> = { id };
      ids.forEach((pid: number, n: number) => { pmap[`pid${n}`] = pid; });
      const inClause = ids.map((_, n) => `@pid${n}`).join(',');
      await query(`UPDATE kart.reserva_grupo_piloto SET link_enviado_em = now() WHERE grupo_id = @id AND id IN (${inClause})`, pmap);
    }
    send(200, await grupo(id));
    return true;
  }

  if ((m = path.match(/^\/grupos\/(\d+)\/pagamentos$/)) && method === 'POST') {
    const id = Number(m[1]);
    const b = await req.body();
    const key = String(b.idempotencyKey ?? '');
    if (!/^[a-zA-Z0-9._:-]{8,80}$/.test(key)) throw new HttpError(400, 'Atualize a página antes de registrar este recebimento novamente.');
    const g = await grupo(id);
    const pilotoId = b.pilotoId ? int(b.pilotoId, 'Piloto') : null;
    if (pilotoId && !g.pilotos.some((p) => p.id === pilotoId)) throw new HttpError(404, 'Piloto não encontrado no grupo.');
    // "cada um paga o seu": recebimento sem piloto era dividido entre todos e mostrava "pagou R$ 29 · falta R$ 116" (12/11/2026)
    if (!pilotoId && g.modo === 'individual') throw new HttpError(400, 'Neste grupo cada um paga o seu: escolha de qual piloto é o pagamento.');
    const forma = txt(b.forma, 40) ?? 'Pix';
    const isVoucher = forma.toLowerCase() === 'voucher' || Boolean(b.voucherCodigo);
    const valor = isVoucher && b.valorCentavos == null
      ? (pilotoId ? (g.pilotos.find((p) => p.id === pilotoId)?.falta_centavos ?? 0) : g.falta)
      : cents(b.valorCentavos, 'Valor recebido');

    let voucherAplicado: { id: number; codigo: string; descontoCentavos: number } | null = null;
    let pilDb: { clienteId: number | null; doc: string | null; inscricaoId: number | null } | null = null;

    if (isVoucher) {
      if (pilotoId) {
        const [row] = await query<{ clienteId: number | null; doc: string | null; inscricaoId: number | null }>(
          `SELECT p.cliente_id "clienteId", COALESCE(c.documento_num, c.documento) doc, p.inscricao_id "inscricaoId"
           FROM kart.reserva_grupo_piloto p
           LEFT JOIN kart.cliente c ON c.id = p.cliente_id
           WHERE p.id = @pid`,
          { pid: pilotoId },
        );
        pilDb = row ?? null;
      }
      let codVch = String(b.voucherCodigo ?? '').trim().toUpperCase();
      if (!codVch && pilDb && (pilDb.clienteId || pilDb.doc)) {
        const disponiveis = await vouchersDisponiveisParaCliente({ clienteId: pilDb.clienteId, documento: pilDb.doc });
        if (disponiveis.length) codVch = disponiveis[0].codigo;
      }
      if (!codVch) throw new HttpError(400, 'Informe o código do voucher.');
      const [v] = await query<{
        Id: number; Codigo: string; Tipo: string; Valor: number; Ativo: boolean;
        VigenciaOk?: number | boolean; InicioEm?: Date | string; FimEm?: Date | string;
        DescontoMaximoCentavos: number | null; PedidoMinimoCentavos: number | null;
        UsoUnico: boolean | number; UsoMaxTotal: number | null; UsoMaxCliente: number; RestritoClientes: boolean | number;
      }>(`SELECT id "Id", codigo "Codigo", ativo "Ativo", parceiro_id "ParceiroId", fidelidade_conta_id "FidelidadeContaId", produto_id "ProdutoId", tipo "Tipo", valor "Valor",
          inicio_em "InicioEm", fim_em "FimEm", desconto_maximo_centavos "DescontoMaximoCentavos", pedido_minimo_centavos "PedidoMinimoCentavos",
          uso_unico "UsoUnico", uso_max_total "UsoMaxTotal", uso_max_cliente "UsoMaxCliente", restrito_clientes "RestritoClientes",
          CASE WHEN current_date BETWEEN inicio_em AND fim_em THEN 1 ELSE 0 END AS "VigenciaOk" FROM kart.voucher WHERE upper(codigo) = upper(@c)`, { c: codVch });
      if (!v || !v.Ativo) throw new HttpError(400, 'Voucher não encontrado ou inativo.');
      if (v.VigenciaOk != null) {
        if (!Number(v.VigenciaOk)) throw new HttpError(400, 'Voucher expirado.');
      } else {
        const hoje = new Date().toISOString().slice(0, 10);
        const fmt = (d: Date | string | undefined) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d ?? '').slice(0, 10));
        if (fmt(v.InicioEm) > hoje || fmt(v.FimEm) < hoje) throw new HttpError(400, 'Voucher expirado.');
      }

      const usosTotaisRow = await one<{ n: number; doCli: number }>(
        `SELECT
          (SELECT COUNT(*) FROM kart.voucher_uso WHERE voucher_id = @vid AND estornado = false)
          + (SELECT COUNT(*) FROM kart.reserva_online_voucher_uso WHERE voucher_id = @vid AND estado IN ('reservado', 'consumido', 'reembolso_pendente'))
          + (SELECT COUNT(*) FROM kart.reserva_grupo_voucher_uso WHERE voucher_id = @vid AND estado IN ('reservado', 'consumido')) n,
          (SELECT COUNT(*) FROM kart.voucher_uso WHERE voucher_id = @vid AND cliente_id = @cid AND estornado = false)
          + (SELECT COUNT(*) FROM kart.reserva_online_voucher_uso WHERE voucher_id = @vid AND cliente_id = @cid AND estado IN ('reservado', 'consumido', 'reembolso_pendente'))
          + (SELECT COUNT(*) FROM kart.reserva_grupo_voucher_uso WHERE voucher_id = @vid AND cliente_id = @cid AND estado IN ('reservado', 'consumido')) "doCli"`,
        { vid: v.Id, cid: pilDb?.clienteId ?? null },
      );

      const eleg = await avaliarElegibilidadeVoucher({
        voucherId: v.Id,
        usoUnico: Boolean(v.UsoUnico),
        usoMaxTotal: v.UsoMaxTotal == null ? null : Number(v.UsoMaxTotal),
        usoMaxCliente: Number(v.UsoMaxCliente ?? 1),
        restritoClientes: Boolean(v.RestritoClientes),
        usosTotais: Number(usosTotaisRow?.n ?? 0),
        usosClienteDirecto: Number(usosTotaisRow?.doCli ?? 0),
        clienteId: pilDb?.clienteId ?? null,
        documento: pilDb?.doc ?? null,
      });
      if (!eleg.ok) throw new HttpError(400, eleg.motivo);

      let d = v.Tipo === 'percentual'
        ? Math.round((valor * Number(v.Valor)) / 100)
        : Number(v.Valor);
      if (v.DescontoMaximoCentavos) d = Math.min(d, Number(v.DescontoMaximoCentavos));
      d = Math.min(valor, d);
      if (d <= 0) throw new HttpError(400, 'Este voucher não dá desconto nesta vaga.');
      voucherAplicado = { id: v.Id, codigo: v.Codigo, descontoCentavos: d };
    }
    // O voucher quita só o desconto que ele vale (R$ 20 numa vaga de R$ 145 deixa R$ 125 devendo).
    // Antes gravava a falta inteira e a vaga aparecia 100% paga (revisão de 19/11/2026).
    const valorGravado = voucherAplicado ? voucherAplicado.descontoCentavos : valor;

    await tx(async (run) => {
      const [ativo] = await run(`SELECT id "Id", responsavel_id "ResponsavelId" FROM kart.reserva_grupo WHERE id = @g AND status = 'ativa' for update`, { g: id });
      if (!ativo) throw new HttpError(409, 'Esta reserva não está ativa.');
      const [anterior] = await run(`SELECT piloto_id "pilotoId", valor_centavos valor, forma forma, cancelado cancelado FROM kart.reserva_grupo_pagamento WHERE grupo_id = @g AND idempotency_key = @key`, { g: id, key });
      if (anterior) {
        if (anterior.cancelado || Number(anterior.valor) !== valorGravado || (anterior.pilotoId ?? null) !== pilotoId || anterior.forma !== (isVoucher ? 'Voucher' : forma))
          throw new HttpError(409, 'Esta chave já pertence a outro recebimento.');
        return;
      }
      if (voucherAplicado) {
        // A elegibilidade foi checada fora da transação: dois recebimentos ao mesmo tempo com o mesmo voucher de uso
        // único passavam os dois. A trava por voucher serializa, e a recontagem aqui dentro decide.
        await run(`SELECT pg_advisory_xact_lock(918273, @vid)`, { vid: voucherAplicado.id });
        const [usos] = await run(
          `SELECT v.uso_unico "UsoUnico", v.uso_max_total "UsoMaxTotal",
             (SELECT COUNT(*) FROM kart.voucher_uso WHERE voucher_id = v.id AND estornado = false)
             + (SELECT COUNT(*) FROM kart.reserva_online_voucher_uso WHERE voucher_id = v.id AND estado IN ('reservado', 'consumido', 'reembolso_pendente'))
             + (SELECT COUNT(*) FROM kart.reserva_grupo_voucher_uso WHERE voucher_id = v.id AND estado IN ('reservado', 'consumido')) "n"
             FROM kart.voucher v WHERE v.id = @vid`,
          { vid: voucherAplicado.id },
        );
        const n = Number(usos?.n ?? 0);
        if ((usos?.UsoUnico && n > 0) || (usos?.UsoMaxTotal != null && n >= Number(usos.UsoMaxTotal)))
          throw new HttpError(409, 'Este voucher acabou de ser usado em outro recebimento.');
      }
      const aidVoucher = voucherAplicado ? ('vch_' + key).slice(0, 60) : null;
      await run(`INSERT INTO kart.reserva_grupo_pagamento (grupo_id, piloto_id, valor_centavos, forma, origem, usuario_id, idempotency_key, asaas_id)
        VALUES (@g, @p, @v, @f, 'manual', @u, @key, @aid)`, { g: id, p: pilotoId, v: valorGravado, f: isVoucher ? 'Voucher' : forma, u: sessao.uid, key, aid: aidVoucher });

      if (voucherAplicado && aidVoucher) {
        const cidUso = pilDb?.clienteId ?? Number(ativo.ResponsavelId);
        await run(
          `INSERT INTO kart.reserva_grupo_voucher_uso (asaas_id, grupo_id, piloto_id, voucher_id, cliente_id, desconto_centavos, estado)
           VALUES (@aid, @g, @p, @vid, @cid, @d, 'consumido')`,
          { aid: aidVoucher, g: id, p: pilotoId, vid: voucherAplicado.id, cid: cidUso, d: voucherAplicado.descontoCentavos },
        );
        if (pilDb?.inscricaoId) {
          await run(`UPDATE kart.inscricao SET voucher_id = @vid WHERE id = @insId`, { vid: voucherAplicado.id, insId: pilDb.inscricaoId });
        }
      }
    });
    await aplicarPagos(id);
    send(201, await grupo(id));
    return true;
  }

  if ((m = path.match(/^\/grupos\/(\d+)\/pagamentos\/(\d+)$/)) && method === 'PATCH') {
    const id = Number(m[1]), pgId = Number(m[2]);
    const b = await req.body();
    const g = await grupo(id);
    const pilotoId = b.pilotoId ? int(b.pilotoId, 'Piloto') : null;
    if (!pilotoId && g.modo === 'individual') throw new HttpError(400, 'Neste grupo cada um paga o seu: escolha a qual piloto vincular.');
    if (pilotoId && !g.pilotos.some((p) => p.id === pilotoId)) throw new HttpError(404, 'Piloto não encontrado no grupo.');
    const r = await one<{ Id: number }>(`UPDATE kart.reserva_grupo_pagamento SET piloto_id = @p  WHERE id = @pg AND grupo_id = @g AND cancelado = false returning id`, { p: pilotoId, pg: pgId, g: id });
    if (!r) throw new HttpError(404, 'Pagamento não encontrado neste grupo.');
    await aplicarPagos(id);
    send(200, await grupo(id));
    return true;
  }

  if ((m = path.match(/^\/grupos\/(\d+)\/pagamentos\/(\d+)$/)) && method === 'DELETE') {
    const id = Number(m[1]);
    const r = await one<{ Id: number; AsaasId: string | null; PilotoId: number | null }>(`UPDATE kart.reserva_grupo_pagamento SET cancelado = true  WHERE id = @pg AND grupo_id = @g AND cancelado = false AND origem = 'manual' returning id, asaas_id, piloto_id`, { pg: Number(m[2]), g: id });
    if (!r) throw new HttpError(409, 'Só dá para estornar aqui pagamento lançado à mão. Pagamento do Asaas se estorna no Asaas.');
    if (r.AsaasId && r.AsaasId.startsWith('vch_')) {
      await query(`UPDATE kart.reserva_grupo_voucher_uso SET estado = 'liberado' WHERE asaas_id = @aid AND estado IN ('reservado', 'consumido')`, { aid: r.AsaasId });
      if (r.PilotoId) {
        await query(`UPDATE kart.inscricao SET voucher_id = NULL WHERE id = (SELECT inscricao_id "InscricaoId" FROM kart.reserva_grupo_piloto WHERE id = @pid)`, { pid: r.PilotoId }).catch(() => undefined);
      }
    }
    await aplicarPagos(id);
    send(200, await grupo(id));
    return true;
  }

  if (path === '/grupos/diferenca' && method === 'POST') {
    const b = await req.body();
    const ids = (Array.isArray(b.inscricoes) ? b.inscricoes : []).map((x: unknown) => int(x, 'Reserva'));
    send(201, await cobrarDiferencaEmGrupo(ids, sessao.uid, (...a) => console.log(...a)));
    return true;
  }
  if ((m = path.match(/^\/grupos\/(\d+)\/cobrancas$/)) && method === 'POST') {
    const id = Number(m[1]);
    const b = await req.body();
    const r = await criarCobranca(id, b.pilotoId ? int(b.pilotoId, 'Piloto') : null);
    send(201, { ...r, grupo: await grupo(id) });
    return true;
  }

  return false;
}

/** Tipo do horário pela agenda: bateria fechada para um grupo, bloqueada (some do site/totem) ou aberta. */
export async function tipoDaBateria(bateriaId: number, tipo: string, anterior?: { status: string; reservaFechada: boolean; autoAtendimento: boolean }) {
  if (!['fechada', 'bloqueada', 'aberta'].includes(tipo)) throw new HttpError(400, 'Tipo inválido.');
  const estado = anterior ?? { status: 'aberta', reservaFechada: tipo === 'fechada', autoAtendimento: tipo === 'aberta' };
  const rows = await query(`UPDATE kart.bateria SET status = @status, reserva_fechada = @rf, auto_atendimento = @aa
     WHERE id = @id AND status <> 'cancelada' RETURNING id`,
    { id: bateriaId, status: estado.status, rf: estado.reservaFechada ? 1 : 0, aa: estado.autoAtendimento ? 1 : 0 });
  if (!rows.length) throw new HttpError(404, 'Bateria não encontrada ou cancelada.');
}

// ---------------------------------------------------------------- link único do grupo no site (cadastro + pagamento)

let ultimoResumoSite = '';
/** sha256 de "cpf:<11 dígitos>" ou "fone:<últimos 8 dígitos>" (o worker calcula igual com o que a pessoa digitou). */
export function hashContato(tipo: 'cpf' | 'fone', v: unknown) {
  const d = onlyDigits(v);
  const base = tipo === 'cpf' ? (d.length === 11 ? d : '') : d.length >= 8 ? d.slice(-8) : '';
  return base ? createHash('sha256').update(`${tipo}:${base}`).digest('hex') : null;
}
/** O que o organizador vê no painel: totais e cada vaga (primeiro nome, cadastro, pagamento, termo e o link próprio). */
export function resumoPainel(g: ReturnType<typeof montar>) {
  return {
    chave: chavePainel(String(g.codigo)), n: g.n, termos: g.pilotos.filter((p) => p.termo).length, total: g.total, pago: g.pago, falta: g.falta, pagos: g.pagos, cadastrados: g.cadastrados, prontos: g.prontos,
    vagas: g.pilotos.map((p) => ({
      ordem: p.ordem, nome: primeiroNome(String(p.nome ?? '')) || null, responsavel: p.responsavel, menor: p.menor,
      cadastro: p.cadastro, falta: p.falta, pago: p.pago, termo: p.termo, link: p.link,
      // o organizador pode liberar esta vaga pelo painel (mesmas regras de liberarVagaPeloOrganizador)
      podeLiberar: !p.responsavel && (p.cadastro === 'completo' || p.cadastro === 'incompleto') && !p.termoImpresso && !p.kart && !(g.modo === 'individual' && p.pago),
    })),
  };
}
/**
 * Manda ao site o resumo das reservas em grupo ativas: com ele o link do grupo mostra "Grupo do(a) Fulano", a bateria e,
 * se cada um paga o seu, cobra a vaga da pessoa na hora (Asaas) no fim do cadastro. Só reenvia quando algo muda.
 */
export async function publicarGruposNoSite(log: Log) {
  if (!siteUrl() || !siteChave()) return 0;
  const gs = await query<{ id: number; codigo: string; modo: string; preco: number; sinalPct: number; aniversario: boolean | number; precoAniv: number | null; status: string; bateria: string; inicio: string; responsavel: string; respDoc: string | null; respFone: string | null }>(
    `SELECT g.id id, g.codigo codigo, g.modo modo, g.preco_centavos preco, g.sinal_pct "sinalPct", g.aniversario aniversario, g.preco_aniversariante_centavos "precoAniv", g.status status, b.nome bateria, to_char(b.inicio, 'YYYY-MM-DD"T"HH24:MI') inicio, r.nome responsavel,
            r.documento "respDoc", r.telefone "respFone"
       FROM kart.reserva_grupo g JOIN kart.bateria b ON b.id = g.bateria_id JOIN kart.cliente r ON r.id = g.responsavel_id
      WHERE g.status = 'ativa' AND b.inicio > (now() + make_interval(hours => (-2)::int))`,
  );
  if (!gs.length) return 0;
  const lista = gs.map((g) => g.id).join(',');
  const pagos = await query<{ grupoId: number; pago: number }>(
    `SELECT grupo_id "grupoId", SUM(valor_centavos) pago FROM kart.reserva_grupo_pagamento WHERE grupo_id IN (${lista}) AND cancelado = false GROUP BY grupo_id`,
  );
  const vagas = await query<{ grupoId: number; token: string; livre: number; responsavel: number }>(
    `SELECT v.grupo_id "grupoId", v.token token, v.responsavel responsavel, CASE WHEN v.cliente_id IS NULL AND v.responsavel = false AND i.id IS NOT NULL THEN 1 ELSE 0 END livre
       FROM kart.reserva_grupo_piloto v LEFT JOIN kart.inscricao i ON i.id = v.inscricao_id AND i.status <> 'cancelada'
      WHERE v.grupo_id IN (${lista}) AND (v.responsavel = true OR i.id IS NOT NULL)`,
  );
  // status por vaga para o painel do organizador (só primeiro nome; o painel só abre com a chave)
  const completos = await carregarGrupos(`g.id IN (${lista})`, {}).catch(() => []);
  const grupos = gs.map((g) => {
    const dele = vagas.filter((v) => v.grupoId === g.id);
    const c = completos.find((x) => Number(x.id) === g.id);
    return {
      id: g.id, sinalPct: Number(g.sinalPct) || 0, pagoCentavos: Number(pagos.find((x) => x.grupoId === g.id)?.pago) || 0,
      // quem paga o grupo (modo único ou sinal): só o link do responsável cobra; os convidados só fazem o cadastro
      responsavelToken: dele.find((v) => Number(v.responsavel) === 1)?.token ?? null,
      tokens: dele.map((v) => v.token).filter(Boolean), codigo: g.codigo, status: g.status, modo: g.modo, precoCentavos: Number(g.preco) || 0,
      aniversario: Boolean(g.aniversario), precoAniversarianteCentavos: g.aniversario ? (Number(g.precoAniv) || ANIVERSARIO_PRECO_PADRAO) : null,
      bateria: g.bateria, inicio: g.inicio, responsavel: primeiroNome(g.responsavel), livres: dele.reduce((s, v) => s + v.livre, 0),
      painel: c ? resumoPainel(c) : null,
      // o link do grupo é o do responsável e vai para todo mundo: o site só cobra o grupo inteiro de quem tem o CPF (ou o celular) dele
      respDocHash: hashContato('cpf', g.respDoc), respFoneHash: hashContato('fone', g.respFone),
    };
  });
  const json = JSON.stringify({ grupos });
  if (json === ultimoResumoSite) return 0;
  await site('/api/sync/grupos', { method: 'PUT', body: json });
  ultimoResumoSite = json;
  log(`grupo: resumo de ${grupos.length} reserva(s) em grupo enviado ao site`);
  return grupos.length;
}

// ---------------------------------------------------------------- ações do organizador pelo painel (/painel no site)

type AcaoPainel = { key: string; codigo: string; acao: string; ordem: number; em?: string };

/**
 * O organizador liberou uma vaga no painel (a pessoa desistiu): a vaga volta a ser "Amigo N" e o link do grupo a ocupa de novo.
 * A Inscricao continua a mesma (a bateria não perde a vaga nem o pagamento do grupo). Recusa vaga paga por conta própria,
 * vaga com termo impresso ou kart, e baterias que começam em menos de 1 hora (aí é com a recepção).
 */
export async function liberarVagaPeloOrganizador(codigo: string, ordem: number, log: Log, saiu?: { nome?: string; email?: string | null; responsavel?: string; bateria?: string; inicio?: string }): Promise<string | null> {
  return await tx(async (run) => {
    const [g] = await run(`SELECT g.id id, g.responsavel_id "responsavelId", g.modo modo, b.inicio inicio, b.nome bateria, to_char(b.inicio, 'YYYY-MM-DD"T"HH24:MI') "inicioIso",
      (SELECT nome FROM kart.cliente WHERE id = g.responsavel_id) "responsavelNome", CASE WHEN b.inicio < (now() + make_interval(hours => (1)::int)) THEN 1 ELSE 0 END perto
      FROM kart.reserva_grupo g JOIN kart.bateria b ON b.id = g.bateria_id WHERE g.codigo = @c AND g.status = 'ativa' for update of g`, { c: codigo });
    if (!g) return 'grupo não encontrado';
    if (Number(g.perto)) return 'bateria começa em menos de 1 hora';
    const [p] = await run(`SELECT p.id id, p.responsavel responsavel, p.cliente_id "clienteId", p.inscricao_id "inscricaoId", i.pago pago, p.pago_pelo_grupo "pagoPeloGrupo", i.termo_impresso_em termo, i.kart kart
      FROM kart.reserva_grupo_piloto p LEFT JOIN kart.inscricao i ON i.id = p.inscricao_id
      WHERE p.grupo_id = @g AND p.ordem = @o AND (i.id IS NULL OR i.status <> 'cancelada') for update of p`, { g: g.id, o: ordem });
    if (!p) return 'vaga não encontrada';
    if (p.responsavel) return 'vaga do responsável';
    if (p.termo || p.kart) return 'piloto já passou pela recepção';
    // cada um paga o seu: vaga paga é dinheiro da pessoa (reembolso/troca na recepção); nos outros modos o pagamento é do grupo
    if (g.modo === 'individual' && p.pago) return 'vaga já paga pela pessoa (reembolso é com a recepção)';
    const [cli] = p.clienteId ? await run(`SELECT origem origem, documento documento, nome nome, email email FROM kart.cliente WHERE id = @c`, { c: p.clienteId }) : [];
    if (!p.clienteId || (cli && cli.origem === 'grupo' && !cli.documento)) return null; // já estava aberta
    const prov = await cadastroDaVaga(run, Number(g.responsavelId), ordem, null, null);
    if (p.inscricaoId) await run(`UPDATE kart.inscricao SET cliente_id = @c, atualizado_em = now() WHERE id = @i`, { c: prov, i: p.inscricaoId });
    // igual às vagas ainda não ocupadas: o grupo não aponta para ninguém e a inscrição fica no cadastro provisório "Amigo N"
    await run(`UPDATE kart.reserva_grupo_piloto SET cliente_id = NULL, nome = NULL, telefone = NULL, cadastro_em = NULL, link_enviado_em = NULL WHERE id = @p`, { p: p.id });
    log(`grupo ${g.id}: organizador liberou a vaga ${ordem} pelo painel (cliente ${p.clienteId} saiu)`);
    if (saiu && cli) Object.assign(saiu, { nome: String(cli.nome ?? ''), email: cli.email ?? null, responsavel: String(g.responsavelNome ?? ''), bateria: String(g.bateria ?? ''), inicio: String(g.inicioIso ?? '') });
    return null;
  });
}

/** Busca no site as ações pedidas no painel do organizador, aplica e confirma (chamado a cada minuto). */
export async function aplicarAcoesDoPainel(log: Log) {
  if (!siteUrl() || !siteChave()) return 0;
  const acoes = (await site('/api/sync/grupos/acoes')) as unknown as { acoes?: AcaoPainel[] };
  const feitas: { key: string; erro: string | null }[] = [];
  for (const a of acoes.acoes ?? []) {
    let erro: string | null = 'ação desconhecida';
    const saiu: { nome?: string; email?: string | null; responsavel?: string; bateria?: string; inicio?: string } = {};
    try { if (a.acao === 'liberar' && /^G[0-9A-F]{4,11}$/.test(a.codigo) && Number.isInteger(a.ordem)) erro = await liberarVagaPeloOrganizador(a.codigo, a.ordem, log, saiu); }
    catch (e) { erro = (e as Error).message; }
    // "Remoção de participação": avisa por e-mail quem saiu do grupo
    if (!erro && saiu.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(saiu.email)) {
      await site('/api/sync/lembretes', { method: 'POST', body: JSON.stringify({ lembretes: [{ chave: `removido-${a.key}`.replace(/[^\w:.-]/g, '').slice(0, 80), tipo: 'removido', para: saiu.email, nome: saiu.nome,
        bateria: saiu.bateria, inicio: saiu.inicio, responsavel: saiu.responsavel, link: 'https://reservas.kartodromodebetim.com.br/' }] }) })
        .catch((e) => log(`grupo ${a.codigo}: e-mail de remoção falhou (${(e as Error).message})`));
    }
    if (erro) log(`grupo ${a.codigo}: ação do painel '${a.acao}' na vaga ${a.ordem} recusada (${erro})`);
    feitas.push({ key: a.key, erro });
  }
  if (feitas.length) { await site('/api/sync/grupos/acoes', { method: 'POST', body: JSON.stringify({ feitas }) }); ultimoResumoSite = ''; }
  return feitas.length;
}

/** A pessoa pagou (ou vai pagar) a vaga no fim do cadastro pelo link do grupo: a cobrança passa a ser da vaga que ficou com ela. */
export async function registrarCobrancaDoLink(token: string, clienteId: number, cob: { id?: unknown; link?: unknown; valorCentavos?: unknown; pago?: unknown }, log: Log) {
  const asaasId = String(cob.id ?? '');
  if (!/^pay_[A-Za-z0-9_]{6,45}$/.test(asaasId)) return false;
  const vaga = await one<{ id: number; grupoId: number; inscricaoId: number | null }>(
    `SELECT v.id id, v.grupo_id "grupoId", v.inscricao_id "inscricaoId" FROM kart.reserva_grupo_piloto t JOIN kart.reserva_grupo_piloto v ON v.grupo_id = t.grupo_id
      WHERE t.token = @token AND v.cliente_id = @c ORDER BY v.responsavel, v.ordem limit 1`,
    { token, c: clienteId },
  );
  if (!vaga) { log(`grupo: cobrança ${asaasId} do link sem vaga para o cliente ${clienteId} (conferir na recepção)`); return false; }
  // estreante pelo link pagou o preço de primeira vez: a vaga passa a valer esse preço (só o valor configurado é aceito)
  const valorCob = Math.round(Number(cob.valorCentavos) || 0);
  const cupom = (cob as { cupom?: { codigo?: unknown } }).cupom;
  const pagoPorVoucher = valorCob === 0 && Boolean(cob.pago) && Boolean(cupom?.codigo);
  if (cupom && /^[A-Z0-9_-]{1,40}$/.test(String(cupom.codigo ?? ''))) {
    const cli = await one<{ documento: string | null }>(`SELECT documento documento FROM kart.cliente WHERE id = @c`, { c: clienteId });
    const vale = await reservarCupomDoLink({
      asaasId, grupoId: vaga.grupoId, pilotoId: vaga.id, clienteId,
      documento: onlyDigits(cli?.documento), codigo: String(cupom.codigo),
      valorCobrado: valorCob, consumido: pagoPorVoucher,
    }, log);
    if (vale !== null && vale > 0) await query(`UPDATE kart.reserva_grupo_piloto SET preco_centavos = @v WHERE id = @p`, { v: vale, p: vaga.id });
    if (vale !== null && pagoPorVoucher) {
      const uso = await one<{ VoucherId: number; DescontoCentavos: number }>(
        `SELECT voucher_id "VoucherId", desconto_centavos "DescontoCentavos" FROM kart.reserva_grupo_voucher_uso WHERE asaas_id = @a`,
        { a: asaasId },
      );
      if (uso) {
        const jaPg = await one<{ Id: number }>(`SELECT id "Id" FROM kart.reserva_grupo_pagamento WHERE asaas_id = @a AND cancelado = false`, { a: asaasId });
        if (!jaPg) {
          await query(
            `INSERT INTO kart.reserva_grupo_pagamento (grupo_id, piloto_id, valor_centavos, forma, origem, asaas_id)
             VALUES (@g, @p, @v, 'Voucher', 'voucher', @a)`,
            { g: vaga.grupoId, p: vaga.id, v: uso.DescontoCentavos, a: asaasId },
          );
        }
        if (vaga.inscricaoId) {
          await query(`UPDATE kart.inscricao SET voucher_id = @vid WHERE id = @insId`, { vid: uso.VoucherId, insId: vaga.inscricaoId }).catch(() => undefined);
        }
        await aplicarPagos(vaga.grupoId);
        log(`grupo ${vaga.grupoId}: vaga do piloto ${vaga.id} quitada pelo voucher ${String(cupom.codigo)} (${asaasId})`);
      }
      return true;
    }
  } else if (valorCob > 0) {
    const pv = await precoPrimeiraVezDoGrupo(vaga.grupoId);
    if (pv && valorCob === pv) await query(`UPDATE kart.reserva_grupo_piloto SET preco_centavos = @v WHERE id = @p AND preco_centavos IS NULL`, { v: pv, p: vaga.id });
  }
  if (await one(`SELECT 1 x FROM kart.reserva_grupo_cobranca WHERE asaas_id = @a`, { a: asaasId })) return true;
  await query(`UPDATE kart.reserva_grupo_cobranca SET status = 'cancelada' WHERE piloto_id = @p AND status = 'aguardando'`, { p: vaga.id });
  await query(
    `INSERT INTO kart.reserva_grupo_cobranca (grupo_id, piloto_id, valor_centavos, asaas_id, link) VALUES (@g, @p, @v, @a, @l)`,
    { g: vaga.grupoId, p: vaga.id, v: Math.round(Number(cob.valorCentavos) || 0), a: asaasId, l: String(cob.link ?? '').slice(0, 400) },
  );
  log(`grupo ${vaga.grupoId}: cobrança ${asaasId} do link ligada ao piloto ${vaga.id} (cliente ${clienteId})`);
  return true;
}

// ---------------------------------------------------------------- "cada um paga o seu" criado pelo site (12/11/2026)

/** Marca na observação do grupo: liga o grupo ao pedido do site (idempotência e conferência na recepção). */
const marcaDoSite = (codigoReserva: string) => `Reserva online ${codigoReserva}`;

/**
 * Pedido do site no modo "cada um paga o seu", já pago: vira um grupo da Agenda (Origem 'site', Modo 'individual') com as
 * MESMAS vagas que o pedido segurou. Quem organiza e pilota fica com a vaga 1 (já paga); quem só organiza pagou 1 vaga
 * de garantia (anotada na observação, a recepção abate de quem faltar ou devolve pela política) e não ocupa vaga.
 * Os amigos entram pelo link do grupo, fazem o cadastro e pagam a própria vaga. Idempotente pelo código da reserva.
 */
export async function grupoDaReservaOnline(o: {
  codigoReserva: string; bateriaId: number; responsavelId: number; inscricoes: number[]; compradorPilota: boolean; precoCentavos: number; valorPagoCentavos: number;
}, log: Log): Promise<{ codigo: string; link: string; painel: string }> {
  const marca = marcaDoSite(o.codigoReserva);
  let id = Number((await one<{ id: number }>(`SELECT id id FROM kart.reserva_grupo WHERE origem = 'site' AND observacao LIKE @m ORDER BY id limit 1`, { m: `${marca}%` }))?.id ?? 0);
  if (!id) {
    const obs = o.compradorPilota
      ? `${marca} · cada um paga o seu`
      : `${marca} · cada um paga o seu · garantia de R$ ${(o.valorPagoCentavos / 100).toFixed(2).replace('.', ',')} paga online por quem organiza (abater de quem faltar ou devolver pela política)`;
    id = await tx(async (run) => {
      const [g] = await run(
        `INSERT INTO kart.reserva_grupo (codigo, bateria_id, responsavel_id, origem, modo, preco_centavos, sinal_pct, observacao, criado_por)
          VALUES (@codigo, @b, @r, 'site', 'individual', @preco, 0, @obs, NULL) returning id id`,
        { codigo: codigoNovo(), b: o.bateriaId, r: o.responsavelId, preco: o.precoCentavos, obs },
      );
      const gid = Number(g.id);
      const inserir = (ordem: number, responsavel: boolean, clienteId: number | null, inscricaoId: number | null) => run(
        `INSERT INTO kart.reserva_grupo_piloto (grupo_id, ordem, nome, telefone, menor, responsavel, cliente_id, inscricao_id, token)
         VALUES (@g, @o, NULL, NULL, 0, @r, @c, @i, @k)`,
        { g: gid, o: ordem, r: responsavel ? 1 : 0, c: clienteId, i: inscricaoId, k: tokenNovo() },
      );
      // quem organiza: vaga 1 se pilota; senão sem vaga (InscricaoId NULL), só o link e o painel
      await inserir(1, true, o.responsavelId, o.compradorPilota ? o.inscricoes[0] : null);
      const amigos = o.compradorPilota ? o.inscricoes.slice(1) : o.inscricoes;
      for (const [k, insc] of amigos.entries()) {
        const ordem = k + 2;
        await inserir(ordem, false, null, insc);
        const prov = await cadastroDaVaga(run, o.responsavelId, ordem, null, null);
        await run(`UPDATE kart.inscricao SET cliente_id = @c, preco_centavos = @preco, atualizado_em = now() WHERE id = @i`, { c: prov, i: insc, preco: o.precoCentavos });
      }
      return gid;
    });
    log(`grupo ${id}: criado pelo site (reserva ${o.codigoReserva}, ${o.inscricoes.length} vaga(s), cada um paga o seu)`);
    await aplicarPagos(id).catch((e) => log(`grupo ${id}: aplicar pagos falhou (${(e as Error).message})`));
    ultimoResumoSite = '';
  }
  const g = await one<{ codigo: string; token: string }>(
    `SELECT g.codigo codigo, p.token token FROM kart.reserva_grupo g JOIN kart.reserva_grupo_piloto p ON p.grupo_id = g.id AND p.responsavel = true WHERE g.id = @id`, { id });
  if (!g) throw new HttpError(500, 'Grupo do site sem responsável.');
  return { codigo: g.codigo, link: linkCadastro(g.token), painel: linkPainel(g.codigo) };
}

/**
 * Decisão do dono (12/11/2026): nos grupos "cada um paga o seu" criados pelo site, a vaga de amigo sem pagamento volta
 * para venda 24h antes da bateria. Não mexe em vaga paga, que já passou pela recepção ou vendida no caixa.
 * O organizador vê no painel que a vaga saiu (e pode avisar o amigo); chamado a cada minuto.
 */
export async function soltarVagasNaoPagasDoSite(log: Log) {
  const vagas = await query<{ grupoId: number; pilotoId: number; inscricaoId: number; ordem: number; codigo: string }>(
    `SELECT g.id "grupoId", p.id "pilotoId", p.inscricao_id "inscricaoId", p.ordem ordem, g.codigo codigo
       FROM kart.reserva_grupo g JOIN kart.bateria b ON b.id = g.bateria_id
       JOIN kart.reserva_grupo_piloto p ON p.grupo_id = g.id AND p.responsavel = false
       JOIN kart.inscricao i ON i.id = p.inscricao_id
      WHERE g.origem = 'site' AND g.modo = 'individual' AND g.status = 'ativa'
        AND b.inicio > now() AND b.inicio <= (now() + make_interval(hours => (24)::int))
        AND i.status <> 'cancelada' AND i.pago = false AND i.venda_id IS NULL AND i.termo_impresso_em IS NULL AND i.kart IS NULL`,
  );
  const soltasPorGrupo = new Map<number, number>();
  for (const v of vagas) {
    const feito = await one<{ Id: number }>(
      `UPDATE kart.inscricao SET status = 'cancelada', atualizado_em = now() 
        WHERE id = @i AND pago = false AND status <> 'cancelada' AND venda_id IS NULL returning id`, { i: v.inscricaoId });
    if (feito) {
      log(`grupo ${v.grupoId} (${v.codigo}): vaga ${v.ordem} sem pagamento a 24h da bateria voltou para venda`);
      soltasPorGrupo.set(v.grupoId, (soltasPorGrupo.get(v.grupoId) ?? 0) + 1);
    }
  }
  if (vagas.length) ultimoResumoSite = '';
  // avisa quem organiza por e-mail (uma vez por grupo e bateria; o site guarda a chave)
  if (soltasPorGrupo.size && siteUrl() && siteChave()) {
    const ids = [...soltasPorGrupo.keys()].join(',');
    const orgs = await query<{ grupoId: number; codigo: string; nome: string; email: string | null; bateria: string; inicio: string }>(
      `SELECT g.id "grupoId", g.codigo codigo, r.nome nome, r.email email, b.nome bateria, to_char(b.inicio, 'YYYY-MM-DD"T"HH24:MI') inicio
         FROM kart.reserva_grupo g JOIN kart.cliente r ON r.id = g.responsavel_id JOIN kart.bateria b ON b.id = g.bateria_id WHERE g.id IN (${ids})`,
    );
    const lembretes = orgs.filter((o) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(o.email ?? ''))).map((o) => ({
      chave: `soltas-${o.grupoId}-${o.inicio.replace(/\D/g, '')}`, tipo: 'soltas', para: o.email, nome: o.nome, bateria: o.bateria, inicio: o.inicio,
      link: 'https://reservas.kartodromodebetim.com.br/', painel: linkPainel(o.codigo), faltam: soltasPorGrupo.get(o.grupoId) ?? 0,
    }));
    for (let i = 0; i < lembretes.length; i += 5) {
      await site('/api/sync/lembretes', { method: 'POST', body: JSON.stringify({ lembretes: lembretes.slice(i, i + 5) }) })
        .catch((e) => log(`grupos: aviso de vagas soltas falhou (${(e as Error).message})`));
    }
  }
  return vagas.length;
}

// ---------------------------------------------------------------- lembretes por e-mail (12/11/2026)

let proximosLembretes = 0;
/**
 * Lembretes dos grupos (decisão do dono: e-mail automático). Até 2 dias antes da bateria (e com mais de 2 h para ela):
 *  - quem fez o cadastro num grupo "cada um paga o seu" e não pagou recebe o link de pagamento dele;
 *  - quem organiza recebe o link do grupo quando ainda há vagas sem cadastro.
 * O site monta o texto, envia e guarda a chave: cada lembrete sai uma vez só. Roda a cada 15 min.
 */
export async function enviarLembretesDosGrupos(log: Log) {
  if (!siteUrl() || !siteChave() || Date.now() < proximosLembretes) return 0;
  proximosLembretes = Date.now() + 15 * 60_000;
  const janela = `b.inicio > now() + interval '2 hours' AND b.inicio <= now() + interval '48 hours'`;
  const pagar = await query<{ grupoId: number; pilotoId: number; nome: string; email: string; bateria: string; inicio: string; preco: number; origem: string; responsavel: string; token: string; cobranca: string | null; valorCobranca: number | null }>(
    `SELECT g.id "grupoId", p.id "pilotoId", c.nome nome, c.email email, b.nome bateria, to_char(b.inicio, 'YYYY-MM-DD"T"HH24:MI') inicio, g.preco_centavos preco, g.origem origem,
            r.nome responsavel, rt.token token, cob.link cobranca, cob.valor_centavos "valorCobranca"
       FROM kart.reserva_grupo g JOIN kart.bateria b ON b.id = g.bateria_id JOIN kart.cliente r ON r.id = g.responsavel_id
       JOIN kart.reserva_grupo_piloto p ON p.grupo_id = g.id AND p.cliente_id IS NOT NULL
       JOIN kart.cliente c ON c.id = p.cliente_id
       JOIN kart.inscricao i ON i.id = p.inscricao_id
       JOIN kart.reserva_grupo_piloto rt ON rt.grupo_id = g.id AND rt.responsavel = true
       LEFT JOIN LATERAL (SELECT link, valor_centavos FROM kart.reserva_grupo_cobranca WHERE piloto_id = p.id AND status = 'aguardando' ORDER BY id DESC LIMIT 1) cob ON true
      WHERE g.status = 'ativa' AND g.modo = 'individual' AND ${janela}
        AND i.status <> 'cancelada' AND i.pago = false AND i.venda_id IS NULL AND c.email LIKE '%_@_%._%'
        -- só com a cobrança aberta: o link dela paga direto na Asaas (refazer o cadastro pelo link do grupo é ruim)
        AND cob.link LIKE 'https://%'`,
  );
  const cadastros = await query<{ grupoId: number; codigo: string; nome: string; email: string; bateria: string; inicio: string; origem: string; modo: string; token: string; faltam: number }>(
    `SELECT g.id "grupoId", g.codigo codigo, r.nome nome, r.email email, b.nome bateria, to_char(b.inicio, 'YYYY-MM-DD"T"HH24:MI') inicio, g.origem origem, g.modo modo, rt.token token, COUNT(*) faltam
       FROM kart.reserva_grupo g JOIN kart.bateria b ON b.id = g.bateria_id JOIN kart.cliente r ON r.id = g.responsavel_id
       JOIN kart.reserva_grupo_piloto rt ON rt.grupo_id = g.id AND rt.responsavel = true
       JOIN kart.reserva_grupo_piloto p ON p.grupo_id = g.id AND p.responsavel = false AND p.cliente_id IS NULL
       JOIN kart.inscricao i ON i.id = p.inscricao_id AND i.status <> 'cancelada'
      WHERE g.status = 'ativa' AND ${janela} AND r.email LIKE '%_@_%._%'
      GROUP BY g.id, g.codigo, r.nome, r.email, b.nome, b.inicio, g.origem, g.modo, rt.token`,
  );
  const lembretes = [
    ...pagar.map((x) => ({ chave: `pagar-${x.pilotoId}-${x.inicio.replace(/\D/g, '')}`, tipo: 'pagar', para: x.email, nome: x.nome, bateria: x.bateria, inicio: x.inicio,
      link: String(x.cobranca), responsavel: primeiroNome(x.responsavel), valorCentavos: Number(x.valorCobranca ?? x.preco) || 0, soltaEm24h: x.origem === 'site' })),
    ...cadastros.map((x) => ({ chave: `cadastros-${x.grupoId}-${x.inicio.replace(/\D/g, '')}`, tipo: 'cadastros', para: x.email, nome: x.nome, bateria: x.bateria, inicio: x.inicio,
      link: linkCadastro(x.token), painel: linkPainel(x.codigo), faltam: Number(x.faltam) || 0, soltaEm24h: x.origem === 'site' && x.modo === 'individual' })),
  ];
  if (!lembretes.length) return 0;
  // em lotes de 5: o site envia um por um e a chamada tem tempo limite (12/11: 27 de uma vez estourou o tempo)
  let enviados = 0, falhas = 0;
  for (let i = 0; i < lembretes.length; i += 5) {
    const r = (await site('/api/sync/lembretes', { method: 'POST', body: JSON.stringify({ lembretes: lembretes.slice(i, i + 5) }) })) as { enviados?: number; falhas?: number };
    enviados += Number(r?.enviados) || 0; falhas += Number(r?.falhas) || 0;
  }
  if (enviados || falhas) log(`grupos: lembretes por e-mail ${enviados} enviado(s)${falhas ? `, ${falhas} falha(s)` : ''}`);
  return enviados;
}
