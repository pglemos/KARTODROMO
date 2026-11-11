/**
 * Reserva em grupo (painel web · Agenda): cada piloto do grupo com nome, WhatsApp e link de cadastro próprio, e o
 * pagamento de cada um. As vagas continuam sendo dbo.Inscricao (uma por piloto, no nome do responsável até a pessoa
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
import { insertCliente, one, onlyDigits, query, tx, type ClienteInput } from './db';
import { HttpError, cancelarReserva, exigePodeFecharBateria, exigePermissaoOffice, inscreverN, moverReservas } from './office';
import type { Sessao } from './auth';

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
};

export async function carregarGrupos(where: string, params: Record<string, unknown>) {
  const grupos = await query<GrupoRow>(
    `SELECT g.Id id, g.Codigo codigo, g.BateriaId bateriaId, b.Vagas vagas, b.Vagas - (SELECT COUNT(*) FROM dbo.Inscricao i WHERE i.BateriaId = b.Id AND i.Status <> 'cancelada') disponiveis, CONVERT(varchar(16), b.Inicio, 126) inicio, b.Nome bateria, g.ResponsavelId responsavelId,
            r.Nome responsavel, r.Telefone responsavelTelefone, g.Origem origem, g.Modo modo, g.PrecoCentavos preco, g.SinalPct sinalPct, g.Observacao observacao,
            g.Status status, CONVERT(varchar(16), g.CriadoEm, 126) criadoEm, u.Nome criadoPor
       FROM dbo.ReservaGrupo g JOIN dbo.Bateria b ON b.Id = g.BateriaId JOIN dbo.Cliente r ON r.Id = g.ResponsavelId LEFT JOIN dbo.Usuario u ON u.Id = g.CriadoPor
      WHERE ${where} ORDER BY b.Inicio, g.Id`,
    params,
  );
  if (!grupos.length) return [];
  const ids = grupos.map((g) => Number(g.id));
  const lista = ids.join(',');
  const pilotos = await query(
    `SELECT p.Id id, p.GrupoId grupoId, p.Ordem ordem, p.Nome nome, p.Telefone telefone, p.Menor menor, p.Responsavel responsavel, p.ClienteId clienteId,
            p.InscricaoId inscricaoId, p.Token token, p.PagoPeloGrupo pagoPeloGrupo, CONVERT(varchar(16), p.LinkEnviadoEm, 126) linkEnviadoEm,
            CONVERT(varchar(16), p.CadastroEm, 126) cadastroEm, i.Pago inscricaoPaga, i.Status inscricaoStatus, i.VendaId vendaId, i.Origem inscricaoOrigem,
            i.TermoImpressoEm termoEm, i.Kart kart,
            c.Nome clienteNome, c.Documento documento, c.Email email, c.Peso peso, c.Telefone clienteTelefone,
            CASE WHEN EXISTS (SELECT 1 FROM dbo.ClienteTermoAceite ta WHERE ta.ClienteId = c.Id) THEN 1 ELSE 0 END termoOnline
       FROM dbo.ReservaGrupoPiloto p
       LEFT JOIN dbo.Inscricao i ON i.Id = p.InscricaoId
       LEFT JOIN dbo.ReservaGrupo rg ON rg.Id = p.GrupoId
       LEFT JOIN dbo.Cliente c ON c.Id = COALESCE(p.ClienteId, CASE WHEN p.Responsavel = 1 THEN rg.ResponsavelId END)
      WHERE p.GrupoId IN (${lista}) ORDER BY p.GrupoId, p.Ordem, p.Id`,
  );
  const pagamentos = await query(
    `SELECT pg.Id id, pg.GrupoId grupoId, pg.PilotoId pilotoId, pg.ValorCentavos valor, pg.Forma forma, pg.Origem origem, CONVERT(varchar(16), pg.CriadoEm, 126) criadoEm, u.Nome usuario
       FROM dbo.ReservaGrupoPagamento pg LEFT JOIN dbo.Usuario u ON u.Id = pg.UsuarioId
      WHERE pg.GrupoId IN (${lista}) AND pg.Cancelado = 0 ORDER BY pg.CriadoEm`,
  );
  const cobrancas = await query(
    `SELECT Id id, GrupoId grupoId, PilotoId pilotoId, ValorCentavos valor, Link link, Status status, CONVERT(varchar(16), CriadoEm, 126) criadoEm
       FROM dbo.ReservaGrupoCobranca WHERE GrupoId IN (${lista}) AND Status IN ('aguardando', 'pago') ORDER BY Id`,
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

/** Mesmo cálculo da tela: quanto cada piloto já tem coberto e quem ainda falta. */
export function montar(g: GrupoRow, pilotos: Linha[], pagamentos: Linha[], cobrancas: Linha[]) {
  const preco = Number(g.preco) || 0;
  const ativos = pilotos.filter((p) => p.inscricaoStatus !== 'cancelada');
  const n = ativos.length;
  const idsAtivos = new Set(ativos.map((p) => Number(p.id)));
  const pagamentosAtivos = pagamentos.filter((pg) => !pg.pilotoId || idsAtivos.has(Number(pg.pilotoId)));
  const unico = g.modo === 'unico';
  let doGrupo = 0;
  const porPiloto = new Map<number, number>();
  for (const pg of pagamentosAtivos) {
    const v = Number(pg.valor) || 0;
    if (!unico && pg.pilotoId) porPiloto.set(Number(pg.pilotoId), (porPiloto.get(Number(pg.pilotoId)) ?? 0) + v);
    else doGrupo += v;
  }
  // pago no caixa da Recepção ou pelo site: a vaga já vem paga e não depende do painel
  const pagosFora = ativos.filter((p) => p.inscricaoPaga && !p.pagoPeloGrupo).length;
  const restantes = Math.max(1, n - pagosFora);
  const pagoPainel = pagamentosAtivos.reduce((a, pg) => a + (Number(pg.valor) || 0), 0);
  const lista = ativos.map((p) => {
    const fora = Boolean(p.inscricaoPaga && !p.pagoPeloGrupo);
    const dela = fora ? preco : (porPiloto.get(Number(p.id)) ?? 0) + doGrupo / restantes;
    const ok = preco <= 0 || dela >= preco - 0.5;
    const cliente = p.documento !== undefined && (p.clienteId || p.responsavel) ? { documento: p.documento, email: p.email, peso: p.peso, telefone: p.clienteTelefone } : null;
    const falta = faltaNoCadastro(cliente);
    const cadastro = (p.clienteId || p.responsavel) && !falta.length ? 'completo' : p.cadastroEm || p.clienteId ? 'incompleto' : p.linkEnviadoEm ? 'enviado' : 'pendente';
    return {
      id: p.id, ordem: p.ordem, nome: p.nome || p.clienteNome || null, telefone: p.telefone || p.clienteTelefone || null, menor: Boolean(p.menor), responsavel: Boolean(p.responsavel),
      clienteId: p.clienteId ?? (p.responsavel ? g.responsavelId : null), inscricaoId: p.inscricaoId, kart: p.kart ?? null, termo: Boolean(p.termoEm) || Boolean(p.termoOnline), termoOnline: Boolean(p.termoOnline),
      link: linkCadastro(String(p.token)), linkEnviadoEm: p.linkEnviadoEm, cadastroEm: p.cadastroEm, cadastro, falta: cadastro === 'completo' ? [] : falta,
      pago: ok, pagoNoCaixa: fora, valorPago: Math.min(Math.round(dela), preco), falta_centavos: Math.max(0, Math.round(preco - dela)),
      cobranca: cobrancas.find((c) => c.pilotoId === p.id && c.status === 'aguardando') ?? null,
    };
  });
  const total = n * preco;
  const pago = Math.min(total, pagoPainel + pagosFora * preco);
  const sinal = Math.round(total * (Number(g.sinalPct) || 0) / 100);
  const responsavel = pilotos.find((p) => p.responsavel);
  return {
    ...g, linkGrupo: responsavel?.token ? linkCadastro(String(responsavel.token)) : null, linkPainel: linkPainel(String(g.codigo)), pilotos: lista, pagamentos: pagamentos.map((pg) => {
      const p = pilotos.find((p) => Number(p.id) === Number(pg.pilotoId));
      return { ...pg, pilotoNome: p?.nome || p?.clienteNome || null, pilotoCancelado: p?.inscricaoStatus === 'cancelada' };
    }), n, total, pago, falta: Math.max(0, total - pago), sinal,
    pagos: lista.filter((p) => p.pago).length, cadastrados: lista.filter((p) => p.cadastro === 'completo').length,
    prontos: lista.filter((p) => p.pago && p.cadastro === 'completo').length,
    cobrancaGrupo: cobrancas.find((c) => !c.pilotoId && c.status === 'aguardando') ?? null,
  };
}

export async function grupo(id: number) {
  const [g] = await carregarGrupos('g.Id = @id', { id });
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
    if (p.pago) {
      const feito = await one<{ Id: number }>(
        `UPDATE dbo.Inscricao SET Pago = 1, ValorCentavos = @preco, Status = 'confirmada', AtualizadoEm = SYSDATETIME()
           OUTPUT inserted.Id WHERE Id = @id AND Pago = 0 AND Status <> 'cancelada'`,
        { id: p.inscricaoId, preco: g.preco },
      );
      if (feito) await query(`UPDATE dbo.ReservaGrupoPiloto SET PagoPeloGrupo = 1 WHERE Id = @id`, { id: p.id });
    } else {
      const desfeito = await one<{ Id: number }>(
        `UPDATE i SET Pago = 0, ValorCentavos = NULL, Status = 'reservada', AtualizadoEm = SYSDATETIME() OUTPUT inserted.Id
           FROM dbo.Inscricao i JOIN dbo.ReservaGrupoPiloto p ON p.InscricaoId = i.Id
          WHERE p.Id = @pid AND p.PagoPeloGrupo = 1 AND i.VendaId IS NULL AND i.Pago = 1 AND i.Status <> 'cancelada'`,
        { pid: p.id },
      );
      if (desfeito) await query(`UPDATE dbo.ReservaGrupoPiloto SET PagoPeloGrupo = 0 WHERE Id = @id`, { id: p.id });
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
    `SELECT p.Id id, p.GrupoId grupoId, p.InscricaoId inscricaoId, p.Responsavel responsavel, g.BateriaId bateriaId, p.Nome nome
       FROM dbo.ReservaGrupoPiloto p JOIN dbo.ReservaGrupo g ON g.Id = p.GrupoId WHERE p.Token = @token AND g.Status = 'ativa' AND (p.Responsavel = 1 OR EXISTS (SELECT 1 FROM dbo.Inscricao i WHERE i.Id = p.InscricaoId AND i.Status <> 'cancelada'))`,
    { token },
  );
  if (!p) { log(`grupo: link ${token.slice(0, 4)}… não pertence a nenhuma reserva ativa`); return false; }
  if (p.responsavel) {
    // LINK ÚNICO DO GRUPO: o código do responsável serve para todo mundo. Quem se cadastra ocupa a primeira vaga livre
    // (de preferência a que já tem o nome dela). Os links individuais antigos continuam valendo.
    const jaNoGrupo = await one<{ id: number }>(`SELECT TOP 1 p.Id id FROM dbo.ReservaGrupoPiloto p JOIN dbo.Inscricao i ON i.Id = p.InscricaoId AND i.Status <> 'cancelada' WHERE p.GrupoId = @g AND p.ClienteId = @c`, { g: p.grupoId, c: clienteId });
    if (jaNoGrupo) {
      await query(`UPDATE dbo.ReservaGrupoPiloto SET CadastroEm = COALESCE(CadastroEm, SYSDATETIME()) WHERE Id = @id`, { id: jaNoGrupo.id });
      log(`grupo ${p.grupoId}: cliente ${clienteId} já está no grupo (vaga ${jaNoGrupo.id}), cadastro confirmado`);
      return true;
    }
    // o responsável ainda é provisório (só nome e WhatsApp)? Se quem abriu o link é ele (mesmo WhatsApp ou mesmo nome), o cadastro
    // dele substitui o provisório em toda a reserva (vagas, grupo e vaga do responsável).
    const prov = await one<{ slotId: number; clienteId: number; nome: string; telefone: string | null; documento: string | null }>(
      `SELECT p.Id slotId, p.ClienteId clienteId, c.Nome nome, c.Telefone telefone, c.Documento documento
         FROM dbo.ReservaGrupoPiloto p JOIN dbo.Cliente c ON c.Id = p.ClienteId WHERE p.Id = @id`, { id: p.id },
    );
    if (prov && !prov.documento) {
      const quem = await one<{ nome: string; telefone: string | null }>(`SELECT Nome nome, Telefone telefone FROM dbo.Cliente WHERE Id = @c`, { c: clienteId });
      const fim = (v: string | null | undefined) => onlyDigits(v).slice(-8);
      const mesmoFone = !!quem && fim(quem.telefone).length >= 8 && fim(quem.telefone) === fim(prov.telefone);
      const a = semAcento(quem?.nome).split(' '), b2 = semAcento(prov.nome).split(' ');
      const mesmoNome = !!quem && (semAcento(quem.nome) === semAcento(prov.nome) || (a.length > 1 && b2.length > 1 && a[0] === b2[0] && a[a.length - 1] === b2[b2.length - 1]));
      if (mesmoFone || mesmoNome) {
        const antigo = prov.clienteId;
        await query(`UPDATE dbo.Inscricao SET ClienteId = @c, AtualizadoEm = SYSDATETIME() WHERE ClienteId = @a AND Id IN (SELECT InscricaoId FROM dbo.ReservaGrupoPiloto WHERE GrupoId = @g AND InscricaoId IS NOT NULL)`, { c: clienteId, a: antigo, g: p.grupoId });
        await query(`UPDATE dbo.Inscricao SET ResponsavelId = @c WHERE ResponsavelId = @a AND Id IN (SELECT InscricaoId FROM dbo.ReservaGrupoPiloto WHERE GrupoId = @g AND InscricaoId IS NOT NULL)`, { c: clienteId, a: antigo, g: p.grupoId }).catch(() => undefined);
        await query(`UPDATE dbo.ReservaGrupo SET ResponsavelId = @c, AtualizadoEm = SYSDATETIME() WHERE Id = @g`, { c: clienteId, g: p.grupoId });
        await query(`UPDATE dbo.ReservaGrupoPiloto SET ClienteId = @c, CadastroEm = SYSDATETIME() WHERE Id = @id`, { c: clienteId, id: p.id });
        await query(
          `DELETE FROM dbo.Cliente WHERE Id = @a AND Documento IS NULL
             AND NOT EXISTS (SELECT 1 FROM dbo.Inscricao WHERE ClienteId = @a) AND NOT EXISTS (SELECT 1 FROM dbo.ReservaGrupo WHERE ResponsavelId = @a)
             AND NOT EXISTS (SELECT 1 FROM dbo.ReservaGrupoPiloto WHERE ClienteId = @a)`, { a: antigo },
        ).catch(() => log(`grupo ${p?.grupoId}: cadastro provisório ${antigo} ficou (tem outros vínculos)`));
        log(`grupo ${p.grupoId}: responsável cadastrou-se pelo link (cliente ${clienteId} no lugar do provisório ${antigo})`);
        return true;
      }
    }
    const livre = await one<Vaga>(
      `SELECT TOP 1 v.Id id, v.GrupoId grupoId, v.InscricaoId inscricaoId, v.Responsavel responsavel, g.BateriaId bateriaId, v.Nome nome
         FROM dbo.ReservaGrupoPiloto v JOIN dbo.ReservaGrupo g ON g.Id = v.GrupoId JOIN dbo.Cliente c ON c.Id = @c
        WHERE v.GrupoId = @g AND EXISTS (SELECT 1 FROM dbo.Inscricao i WHERE i.Id = v.InscricaoId AND i.Status <> 'cancelada') AND (v.ClienteId IS NULL OR v.ClienteId IN (SELECT Id FROM dbo.Cliente WHERE Origem = 'grupo' AND Documento IS NULL)) AND v.Responsavel = 0
        ORDER BY CASE WHEN v.Nome IS NOT NULL AND LOWER(v.Nome) = LOWER(c.Nome) THEN 0 ELSE 1 END, v.Ordem`,
      { g: p.grupoId, c: clienteId },
    );
    if (!livre) { log(`grupo ${p.grupoId}: link do grupo usado pelo cliente ${clienteId}, mas não há vaga livre (aumente a quantidade de pilotos na reserva)`); return false; }
    p = livre;
  }
  const outra = await one<{ Id: number }>(
    `SELECT TOP 1 Id FROM dbo.Inscricao WHERE BateriaId = @b AND ClienteId = @c AND Status <> 'cancelada' AND Id <> ISNULL(@i, 0)`,
    { b: p.bateriaId, c: clienteId, i: p.inscricaoId },
  );
  if (p.inscricaoId && !outra) {
    await query(`UPDATE dbo.Inscricao SET ClienteId = @c, AtualizadoEm = SYSDATETIME() WHERE Id = @i AND Status <> 'cancelada'`, { c: clienteId, i: p.inscricaoId });
    await limparProvisorios();
  }
  await query(
    `UPDATE p SET ClienteId = @c, CadastroEm = SYSDATETIME(), Nome = COALESCE(NULLIF(p.Nome, ''), c.Nome), Telefone = COALESCE(NULLIF(p.Telefone, ''), c.Telefone)
       FROM dbo.ReservaGrupoPiloto p JOIN dbo.Cliente c ON c.Id = @c WHERE p.Id = @id`,
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
    `SELECT v.Id id, v.Ordem ordem, v.Nome nome, v.Telefone telefone, v.InscricaoId inscricaoId
       FROM dbo.ReservaGrupoPiloto v JOIN dbo.Inscricao i ON i.Id = v.InscricaoId AND i.Status <> 'cancelada'
      WHERE v.GrupoId = @g AND EXISTS (SELECT 1 FROM dbo.Inscricao i WHERE i.Id = v.InscricaoId AND i.Status <> 'cancelada') AND v.ClienteId IS NULL AND v.Responsavel = 0 ORDER BY v.Ordem`,
    { g: grupoId },
  );
}

/**
 * Uma pessoa com cadastro de verdade passa a ocupar uma vaga que já existia no grupo, mantendo preço e pagamento da vaga.
 * Pode ser repetida sem efeito. Se a pessoa já tinha uma pré-reserva avulsa (totem) na mesma bateria e ainda não paga,
 * essa pré-reserva sai (a vaga do grupo é a dela). Reserva paga duplicada fica para a recepção resolver.
 */
export async function vincularClienteAoGrupo(grupoId: number, clienteId: number, pilotoId: number | null, log: Log, puxarDados = false) {
  const g = await one<{ bateriaId: number }>(`SELECT BateriaId bateriaId FROM dbo.ReservaGrupo WHERE Id = @g AND Status = 'ativa'`, { g: grupoId });
  if (!g) throw new HttpError(404, 'Reserva em grupo não encontrada.');
  const c = await one<{ id: number }>(`SELECT Id id FROM dbo.Cliente WHERE Id = @c`, { c: clienteId });
  if (!c) throw new HttpError(404, 'Cadastro não encontrado.');
  const ja = await one<{ id: number }>(`SELECT TOP 1 p.Id id FROM dbo.ReservaGrupoPiloto p JOIN dbo.Inscricao i ON i.Id = p.InscricaoId AND i.Status <> 'cancelada' WHERE p.GrupoId = @g AND p.ClienteId = @c`, { g: grupoId, c: clienteId });
  if (ja) return { ok: true, jaVinculado: true, pilotoId: ja.id, inscricaoId: null as number | null };
  const livres = await vagasAguardando(grupoId);
  const vaga = pilotoId ? livres.find((v) => v.id === pilotoId) : livres[0];
  if (!vaga || !vaga.inscricaoId) throw new HttpError(409, 'Não há vaga aguardando cadastro neste grupo.');
  await tx(async (run) => {
    const outras = await run(
      `SELECT Id, Pago, VendaId FROM dbo.Inscricao WITH (UPDLOCK) WHERE BateriaId = @b AND ClienteId = @c AND Status <> 'cancelada' AND Id <> @i`,
      { b: g.bateriaId, c: clienteId, i: vaga.inscricaoId },
    );
    for (const o of outras) {
      if (o.Pago || o.VendaId) throw new HttpError(409, 'Esta pessoa já tem reserva paga nesta bateria. Resolva na recepção (estorno ou mover).');
    }
    for (const o of outras) await run(`UPDATE dbo.Inscricao SET Status = 'cancelada', Pago = 0, AtualizadoEm = SYSDATETIME() WHERE Id = @id`, { id: o.Id });
    await run(`UPDATE dbo.Inscricao SET ClienteId = @c, AtualizadoEm = SYSDATETIME() WHERE Id = @i AND Status <> 'cancelada'`, { c: clienteId, i: vaga.inscricaoId });
    await run(
      `UPDATE p SET ClienteId = @c, CadastroEm = SYSDATETIME(),
              Nome = CASE WHEN @puxar = 1 THEN COALESCE(NULLIF(c.Nome, ''), p.Nome) ELSE COALESCE(NULLIF(p.Nome, ''), c.Nome) END,
              Telefone = CASE WHEN @puxar = 1 THEN COALESCE(NULLIF(c.Telefone, ''), p.Telefone) ELSE COALESCE(NULLIF(p.Telefone, ''), c.Telefone) END,
              Menor = CASE WHEN @puxar = 1 AND c.Nascimento IS NOT NULL THEN CASE WHEN DATEADD(year, 18, c.Nascimento) > CAST(SYSDATETIME() AS date) THEN 1 ELSE 0 END ELSE p.Menor END
         FROM dbo.ReservaGrupoPiloto p JOIN dbo.Cliente c ON c.Id = @c WHERE p.Id = @id`,
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
  const quem = await one<{ nome: string; telefone: string | null }>(`SELECT Nome nome, Telefone telefone FROM dbo.Cliente WHERE Id = @c`, { c: clienteId });
  if (!quem) return null;
  const grupos = await query<{ id: number }>(`SELECT Id id FROM dbo.ReservaGrupo WHERE BateriaId = @b AND Status = 'ativa'`, { b: bateriaId });
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
      if (r?.jaVinculado) return (await one<{ i: number }>(`SELECT InscricaoId i FROM dbo.ReservaGrupoPiloto WHERE Id = @id`, { id: r.pilotoId }))?.i ?? null;
    }
  }
  return null;
}

// ---------------------------------------------------------------- totem: "Vim com um grupo"

const primeiroNome = (nome: string) => {
  const p = String(nome ?? '').trim().split(/\s+/).filter(Boolean);
  return p.length ? p[0].charAt(0).toUpperCase() + p[0].slice(1).toLowerCase() : '';
};

/**
 * Grupos de hoje que ainda têm vaga aguardando quem chegar: o totem mostra "Grupo do Edmael · 21:40" ANTES das baterias,
 * para o amigo se reconhecer. Só o primeiro nome do responsável aparece (privacidade).
 */
export async function gruposDoDiaNoTotem() {
  const rows = await query<{ id: number; responsavel: string; bateriaId: number; inicio: string; total: number }>(
    `SELECT g.Id id, r.Nome responsavel, g.BateriaId bateriaId, CONVERT(varchar(16), b.Inicio, 126) inicio,
            (SELECT COUNT(*) FROM dbo.ReservaGrupoPiloto p JOIN dbo.Inscricao i ON i.Id = p.InscricaoId AND i.Status <> 'cancelada' WHERE p.GrupoId = g.Id) total
       FROM dbo.ReservaGrupo g JOIN dbo.Bateria b ON b.Id = g.BateriaId JOIN dbo.Cliente r ON r.Id = g.ResponsavelId
      WHERE g.Status = 'ativa' AND b.Status <> 'cancelada' AND CONVERT(date, b.Inicio) = CONVERT(date, SYSDATETIME())
        AND b.Inicio >= DATEADD(MINUTE, -45, SYSDATETIME())
      ORDER BY b.Inicio, g.Id`,
  );
  const out: { id: number; responsavel: string; inicio: string; total: number; aguardando: number; bateriaId: number }[] = [];
  for (const g of rows) {
    const aguardando = (await vagasAguardando(g.id)).length;
    if (aguardando > 0) out.push({ id: g.id, responsavel: primeiroNome(g.responsavel), inicio: g.inicio, total: Number(g.total), aguardando, bateriaId: g.bateriaId });
  }
  return out;
}

/** O amigo escolheu o grupo no totem: ocupa uma vaga já paga e recebe a mensagem que valoriza quem reservou. */
export async function entrarNoGrupoPeloTotem(grupoId: number, clienteId: number, log: Log) {
  const r = await vincularClienteAoGrupo(grupoId, clienteId, null, log);
  const g = await one<{ responsavel: string; bateriaId: number; inicio: string; total: number }>(
    `SELECT rc.Nome responsavel, g.BateriaId bateriaId, CONVERT(varchar(16), b.Inicio, 126) inicio,
            (SELECT COUNT(*) FROM dbo.ReservaGrupoPiloto p JOIN dbo.Inscricao i ON i.Id = p.InscricaoId AND i.Status <> 'cancelada' WHERE p.GrupoId = g.Id) total
       FROM dbo.ReservaGrupo g JOIN dbo.Bateria b ON b.Id = g.BateriaId JOIN dbo.Cliente rc ON rc.Id = g.ResponsavelId WHERE g.Id = @g`,
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
  const p = pilotoId ? g.pilotos.find((x) => x.id === pilotoId) : null;
  if (pilotoId && !p) throw new HttpError(404, 'Piloto não encontrado no grupo.');
  const valor = p ? p.falta_centavos : g.modo === 'sinal' ? Math.max(0, g.sinal - g.pago) : g.falta;
  if (valor <= 0) throw new HttpError(409, p ? 'Este piloto já está pago.' : 'O grupo já está pago.');
  const quem = await one<{ nome: string; documento: string | null; email: string | null; telefone: string | null }>(
    `SELECT Nome nome, Documento documento, Email email, Telefone telefone FROM dbo.Cliente WHERE Id = @id`,
    { id: (p?.clienteId as number | null) ?? (g.responsavelId as number) },
  );
  const doc = onlyDigits(quem?.documento);
  const pagador = doc.length === 11 ? quem! : await one<{ nome: string; documento: string | null; email: string | null; telefone: string | null }>(
    `SELECT Nome nome, Documento documento, Email email, Telefone telefone FROM dbo.Cliente WHERE Id = @id`, { id: g.responsavelId },
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
    `INSERT INTO dbo.ReservaGrupoCobranca (GrupoId, PilotoId, ValorCentavos, AsaasId, Link) VALUES (@g, @p, @v, @a, @l)`,
    { g: g.id, p: pilotoId, v: valor, a: String(c.id), l: String(c.link) },
  );
  if (antiga) await query(`UPDATE dbo.ReservaGrupoCobranca SET Status = 'cancelada' WHERE Id = @id`, { id: antiga.id });
  return { link: String(c.link), valor, reaproveitada: false };
}

/** A cada minuto: confere no Asaas as cobranças em aberto e lança o pagamento de quem pagou. */
export async function conferirCobrancas(log: Log, grupoId?: number): Promise<number> {
  if (!siteUrl() || !siteChave()) return 0;
  const abertas = grupoId
    ? await query<{ id: number; grupoId: number; pilotoId: number | null; valor: number; asaasId: string; criadoEm: Date }>(
        `SELECT Id id, GrupoId grupoId, PilotoId pilotoId, ValorCentavos valor, AsaasId asaasId, CriadoEm criadoEm
           FROM dbo.ReservaGrupoCobranca
          WHERE GrupoId = @grupoId AND Status = 'aguardando'
          ORDER BY Id DESC`,
        { grupoId },
      )
    : await query<{ id: number; grupoId: number; pilotoId: number | null; valor: number; asaasId: string; criadoEm: Date }>(
        `SELECT TOP 50 Id id, GrupoId grupoId, PilotoId pilotoId, ValorCentavos valor, AsaasId asaasId, CriadoEm criadoEm
           FROM dbo.ReservaGrupoCobranca
          WHERE Status = 'aguardando' AND CriadoEm > DATEADD(day, -4, SYSDATETIME())
          ORDER BY CASE WHEN CriadoEm > DATEADD(hour, -12, SYSDATETIME()) THEN 0 ELSE 1 END, Id DESC`,
      );

  let pagas = 0;
  const gruposAfetados = new Set<number>();

  for (const c of abertas) {
    try {
      const s = (await site(`/api/sync/cobranca/${encodeURIComponent(c.asaasId)}`)) as { pago?: boolean; forma?: string; status?: string };
      if (s.pago) {
        const ok = await one<{ Id: number }>(
          `UPDATE dbo.ReservaGrupoCobranca SET Status = 'pago', PagoEm = SYSDATETIME() OUTPUT inserted.Id WHERE Id = @id AND Status = 'aguardando'`,
          { id: c.id },
        );
        if (ok) {
          const ja = await one<{ Id: number }>(`SELECT Id FROM dbo.ReservaGrupoPagamento WHERE AsaasId = @a AND Cancelado = 0`, { a: c.asaasId });
          if (!ja) {
            await query(
              `INSERT INTO dbo.ReservaGrupoPagamento (GrupoId, PilotoId, ValorCentavos, Forma, Origem, AsaasId) VALUES (@g, @p, @v, @f, 'asaas', @a)`,
              { g: c.grupoId, p: c.pilotoId, v: c.valor, f: s.forma === 'PIX' ? 'Pix (Asaas)' : s.forma === 'CREDIT_CARD' ? 'Cartão (Asaas)' : 'Asaas', a: c.asaasId },
            );
          }
          gruposAfetados.add(c.grupoId);
          pagas++;
          log(`grupo ${c.grupoId}: pagamento Asaas ${c.asaasId} recebido`);
        }
      } else if (['REFUNDED', 'DELETED', 'OVERDUE'].includes(String(s.status))) {
        await query(`UPDATE dbo.ReservaGrupoCobranca SET Status = @s WHERE Id = @id`, { id: c.id, s: s.status === 'OVERDUE' ? 'vencida' : 'cancelada' });
      } else if (Date.now() - new Date(c.criadoEm).getTime() > 48 * 3600_000 && String(s.status) === 'PENDING') {
        await query(`UPDATE dbo.ReservaGrupoCobranca SET Status = 'vencida' WHERE Id = @id`, { id: c.id });
      }
    } catch (e) {
      log(`grupo ${c.grupoId}: conferência da cobrança falhou (${(e as Error).message})`);
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
        const ja = await one<{ Id: number }>(`SELECT Id FROM dbo.ReservaGrupoPagamento WHERE AsaasId = @a AND Cancelado = 0`, { a: n.asaasId });
        if (ja) {
          processadosIds.push(n.asaasId);
          continue;
        }

        let gid: number | null = null;
        let pid: number | null = null;

        const mNum = String(n.externalReference).match(/^grupo-(\d+)-(\d+|g)$/);
        if (mNum) {
          gid = Number(mNum[1]);
          pid = mNum[2] === 'g' ? null : Number(mNum[2]);
        } else {
          const mCod = String(n.externalReference).match(/^grupo-([A-Z0-9]{8})-(.+)$/);
          if (mCod) {
            const [grp] = await query<{ Id: number }>(`SELECT Id FROM dbo.ReservaGrupo WHERE Codigo = @c`, { c: mCod[1] });
            if (grp) {
              gid = grp.Id;
              const cpfDig = onlyDigits(mCod[2]);
              if (cpfDig.length >= 11) {
                const [pil] = await query<{ Id: number }>(
                  `SELECT p.Id FROM dbo.ReservaGrupoPiloto p JOIN dbo.Cliente c ON c.Id = p.ClienteId WHERE p.GrupoId = @g AND (c.DocumentoNum = @cpf OR c.Documento LIKE '%' + @cpf + '%')`,
                  { g: gid, cpf: cpfDig },
                );
                if (pil) pid = pil.Id;
              }
            }
          }
        }

        if (gid) {
          const valorCentavos = Math.round(Number(n.value ?? 145) * 100);
          const forma = n.billingType === 'PIX' ? 'Pix (Asaas)' : n.billingType === 'CREDIT_CARD' ? 'Cartão (Asaas)' : 'Asaas';
          await query(
            `INSERT INTO dbo.ReservaGrupoPagamento (GrupoId, PilotoId, ValorCentavos, Forma, Origem, AsaasId) VALUES (@g, @p, @v, @f, 'asaas', @a)`,
            { g: gid, p: pid, v: valorCentavos, f: forma, a: n.asaasId },
          );
          await query(`UPDATE dbo.ReservaGrupoCobranca SET Status = 'pago', PagoEm = SYSDATETIME() WHERE AsaasId = @a AND Status = 'aguardando'`, { a: n.asaasId });
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
        const ja = await one<{ Id: number }>(`SELECT Id FROM dbo.ReservaGrupoPagamento WHERE AsaasId = @a AND Cancelado = 0`, { a: p.id });
        if (ja) continue;

        // Bate por AsaasId direto na cobrança gerada pelo sistema
        const cob = await one<{ Id: number; GrupoId: number; PilotoId: number | null; ValorCentavos: number }>(
          `SELECT Id, GrupoId, PilotoId, ValorCentavos FROM dbo.ReservaGrupoCobranca WHERE AsaasId = @a`, { a: p.id },
        );
        if (cob) {
          const valorCentavos = Math.round(Number(p.value) * 100) || cob.ValorCentavos;
          const forma = p.billingType === 'PIX' ? 'Pix (Asaas)' : p.billingType === 'CREDIT_CARD' ? 'Cartão (Asaas)' : 'Asaas';
          await query(
            `INSERT INTO dbo.ReservaGrupoPagamento (GrupoId, PilotoId, ValorCentavos, Forma, Origem, AsaasId) VALUES (@g, @p, @v, @f, 'asaas', @a)`,
            { g: cob.GrupoId, p: cob.PilotoId, v: valorCentavos, f: forma, a: p.id },
          );
          await query(`UPDATE dbo.ReservaGrupoCobranca SET Status = 'pago', PagoEm = SYSDATETIME() WHERE Id = @id AND Status = 'aguardando'`, { id: cob.Id });
          gruposAfetados.add(cob.GrupoId);
          novos++;
          log(`grupo ${cob.GrupoId}: pagamento Asaas ${p.id} conciliado diretamente`);
          continue;
        }

        // Bate por externalReference grupo-ID-PILOTO ou grupo-CODIGO-CPF
        let gid: number | null = null;
        let pid: number | null = null;
        const mNum = String(p.externalReference ?? '').match(/^grupo-(\d+)-(\d+|g)$/);
        if (mNum) {
          gid = Number(mNum[1]);
          pid = mNum[2] === 'g' ? null : Number(mNum[2]);
        } else {
          const mCod = String(p.externalReference ?? '').match(/^grupo-([A-Z0-9]{8})-(.+)$/);
          if (mCod) {
            const [grp] = await query<{ Id: number }>(`SELECT Id FROM dbo.ReservaGrupo WHERE Codigo = @c`, { c: mCod[1] });
            if (grp) {
              gid = grp.Id;
              const cpfDig = onlyDigits(mCod[2]);
              if (cpfDig.length >= 11) {
                const [pil] = await query<{ Id: number }>(
                  `SELECT p.Id FROM dbo.ReservaGrupoPiloto p JOIN dbo.Cliente c ON c.Id = p.ClienteId WHERE p.GrupoId = @g AND (c.DocumentoNum = @cpf OR c.Documento LIKE '%' + @cpf + '%')`,
                  { g: gid, cpf: cpfDig },
                );
                if (pil) pid = pil.Id;
              }
            }
          } else {
            const mDesc = String(p.description ?? '').match(/\breserva\s+(G[A-Z0-9]{7})\b/i);
            if (mDesc) {
              const [grp] = await query<{ Id: number }>(`SELECT Id FROM dbo.ReservaGrupo WHERE Codigo = @c`, { c: mDesc[1] });
              if (grp) gid = grp.Id;
            }
          }
        }

        if (gid) {
          if (grupoId && gid !== grupoId) continue;

          const valorCentavos = Math.round(Number(p.value) * 100);
          const forma = p.billingType === 'PIX' ? 'Pix (Asaas)' : p.billingType === 'CREDIT_CARD' ? 'Cartão (Asaas)' : 'Asaas';
          await query(
            `INSERT INTO dbo.ReservaGrupoPagamento (GrupoId, PilotoId, ValorCentavos, Forma, Origem, AsaasId) VALUES (@g, @p, @v, @f, 'asaas', @a)`,
            { g: gid, p: pid, v: valorCentavos, f: forma, a: p.id },
          );
          await query(`UPDATE dbo.ReservaGrupoCobranca SET Status = 'pago', PagoEm = SYSDATETIME() WHERE AsaasId = @a AND Status = 'aguardando'`, { a: p.id });
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
    `INSERT INTO dbo.ReservaGrupoPiloto (GrupoId, Ordem, Nome, Telefone, Menor, Responsavel, ClienteId, InscricaoId, Token)
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
    `SELECT TOP 20 Id id, Nome nome, Telefone telefone FROM dbo.Cliente WHERE Telefone IS NOT NULL AND Telefone LIKE '%' + @fim ORDER BY Id DESC`, { fim: fim.slice(-4) },
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
  const [r] = await run(`SELECT Nome FROM dbo.Cliente WHERE Id = @id`, { id: responsavelId });
  const rotulo = (nome && nome.trim()) || `Amigo ${ordem} de ${String(r?.Nome ?? 'responsável')}`;
  const [c] = await run(
    `INSERT INTO dbo.Cliente (Nome, Telefone, TelefoneNum, Origem) OUTPUT inserted.Id id VALUES (@n, @t, @tn, 'grupo')`,
    { n: rotulo.slice(0, 200), t: telefone, tn: telefone ? onlyDigits(telefone).slice(-20) || null : null },
  );
  return Number(c.id);
}

/** Apaga os cadastros provisórios de vaga que ninguém mais usa (o amigo se cadastrou e a reserva passou para ele). */
async function limparProvisorios() {
  await query(
    `DELETE FROM dbo.Cliente WHERE Origem = 'grupo' AND Documento IS NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.Inscricao i WHERE i.ClienteId = Cliente.Id)
       AND NOT EXISTS (SELECT 1 FROM dbo.ReservaGrupo g WHERE g.ResponsavelId = Cliente.Id)
       AND NOT EXISTS (SELECT 1 FROM dbo.ReservaGrupoPiloto p WHERE p.ClienteId = Cliente.Id)`,
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
      `SELECT Id id, BateriaId bateriaId, ResponsavelId responsavelId, Codigo codigo FROM dbo.ReservaGrupo WITH (UPDLOCK, HOLDLOCK) WHERE Id = @g AND Status = 'ativa'`,
      { g: grupoId },
    );
    if (!g) throw new HttpError(404, 'Reserva em grupo não encontrada.');

    const [p] = await run(
      `SELECT Id id, Ordem ordem, Nome nome, Telefone telefone, ClienteId clienteId, InscricaoId inscricaoId, Responsavel responsavel
         FROM dbo.ReservaGrupoPiloto WITH (UPDLOCK, HOLDLOCK) WHERE Id = @pid AND GrupoId = @g`,
      { pid: pilotoId, g: grupoId },
    );
    if (!p) throw new HttpError(404, 'Piloto não encontrado no grupo.');
    if (p.responsavel) throw new HttpError(400, 'Não é possível desvincular o responsável principal da reserva.');

    const inscricaoId = p.inscricaoId ? Number(p.inscricaoId) : null;
    const clienteId = p.clienteId ? Number(p.clienteId) : null;
    const ordem = Number(p.ordem);

    if (opts.destino === 'sozinho') {
      if (inscricaoId) {
        await run(
          `UPDATE dbo.Inscricao
              SET ResponsavelId = NULL,
                  Observacao = LEFT('Inscrição avulsa / individual (desvinculado do grupo ' + @cod + ')' + CASE WHEN Observacao IS NOT NULL AND Observacao <> '' THEN ' · ' + Observacao ELSE '' END, 400),
                  AtualizadoEm = SYSDATETIME()
            WHERE Id = @i`,
          { i: inscricaoId, cod: g.codigo },
        );
        if (opts.novaBateriaId && Number(opts.novaBateriaId) !== Number(g.bateriaId)) {
          await moverReservas([inscricaoId], Number(opts.novaBateriaId));
        }
      }

      // Restaura a vaga no grupo de origem
      const cid = await cadastroDaVaga(run, Number(g.responsavelId), ordem, null, null);
      const [novaInsc] = await inscreverN(Number(g.bateriaId), Number(g.responsavelId), 1, 'recepcao', sessaoUid, 'Reserva em grupo pelo painel web', false, { vagaDoGrupo: true, run });
      await run(`UPDATE dbo.Inscricao SET ClienteId = @c WHERE Id = @i`, { c: cid, i: novaInsc });
      await run(
        `UPDATE dbo.ReservaGrupoPiloto
            SET ClienteId = @c, Nome = '', Telefone = NULL, CadastroEm = NULL, InscricaoId = @novaInsc, PagoPeloGrupo = 0
          WHERE Id = @pid`,
        { c: cid, novaInsc, pid: p.id },
      );

      log(`grupo ${grupoId}: piloto ${p.id} (cliente ${clienteId}) desvinculado e colocado sozinho (inscrição ${inscricaoId})`);
    } else if (opts.destino === 'outro_grupo') {
      const novoGrupoId = Number(opts.novoGrupoId);
      if (!novoGrupoId || novoGrupoId === grupoId) throw new HttpError(400, 'Selecione um grupo de destino diferente do atual.');

      const [ng] = await run(
        `SELECT Id id, BateriaId bateriaId, ResponsavelId responsavelId, Codigo codigo FROM dbo.ReservaGrupo WITH (UPDLOCK, HOLDLOCK) WHERE Id = @ng AND Status = 'ativa'`,
        { ng: novoGrupoId },
      );
      if (!ng) throw new HttpError(404, 'Grupo de destino não encontrado ou inativo.');

      if (inscricaoId && Number(g.bateriaId) !== Number(ng.bateriaId)) {
        await moverReservas([inscricaoId], Number(ng.bateriaId));
      }

      // Restaura a vaga no grupo de origem
      const cidOrigem = await cadastroDaVaga(run, Number(g.responsavelId), ordem, null, null);
      const [novaInscOrigem] = await inscreverN(Number(g.bateriaId), Number(g.responsavelId), 1, 'recepcao', sessaoUid, 'Reserva em grupo pelo painel web', false, { vagaDoGrupo: true, run });
      await run(`UPDATE dbo.Inscricao SET ClienteId = @c WHERE Id = @i`, { c: cidOrigem, i: novaInscOrigem });
      await run(
        `UPDATE dbo.ReservaGrupoPiloto
            SET ClienteId = @c, Nome = '', Telefone = NULL, CadastroEm = NULL, InscricaoId = @novaInsc, PagoPeloGrupo = 0
          WHERE Id = @pid`,
        { c: cidOrigem, novaInsc: novaInscOrigem, pid: p.id },
      );

      // No novo grupo: procura vaga aguardando
      const [vagaDestino] = await run(
        `SELECT TOP 1 v.Id id, v.InscricaoId inscricaoId
           FROM dbo.ReservaGrupoPiloto v
          WHERE v.GrupoId = @ng
            AND v.Responsavel = 0
            AND v.ClienteId IS NOT NULL
            AND EXISTS (SELECT 1 FROM dbo.Cliente c WHERE c.Id = v.ClienteId AND c.Origem = 'grupo')
          ORDER BY v.Ordem`,
        { ng: novoGrupoId },
      );

      if (vagaDestino) {
        if (inscricaoId) {
          if (vagaDestino.inscricaoId && vagaDestino.inscricaoId !== inscricaoId) {
            await run(`UPDATE dbo.Inscricao SET Status = 'cancelada', Pago = 0, AtualizadoEm = SYSDATETIME() WHERE Id = @oldInsc`, { oldInsc: vagaDestino.inscricaoId });
          }
          await run(
            `UPDATE dbo.Inscricao
                SET ResponsavelId = @resp,
                    Observacao = LEFT('Reserva em grupo ' + @cod + ' pelo painel web' + CASE WHEN Observacao IS NOT NULL AND Observacao <> '' THEN ' · ' + Observacao ELSE '' END, 400),
                    AtualizadoEm = SYSDATETIME()
              WHERE Id = @i`,
            { resp: ng.responsavelId, cod: ng.codigo, i: inscricaoId },
          );
        }

        await run(
          `UPDATE p
              SET ClienteId = @c,
                  InscricaoId = COALESCE(@insc, p.InscricaoId),
                  CadastroEm = SYSDATETIME(),
                  Nome = COALESCE(NULLIF(c.Nome, ''), p.Nome),
                  Telefone = COALESCE(NULLIF(c.Telefone, ''), p.Telefone)
             FROM dbo.ReservaGrupoPiloto p
             LEFT JOIN dbo.Cliente c ON c.Id = @c
            WHERE p.Id = @vagaId`,
          { c: clienteId, insc: inscricaoId, vagaId: vagaDestino.id },
        );
      } else {
        const [ordemNova] = await run(`SELECT ISNULL(MAX(Ordem), 0) + 1 proxima FROM dbo.ReservaGrupoPiloto WHERE GrupoId = @ng`, { ng: novoGrupoId });
        const proxima = Number(ordemNova.proxima);
        let finalInsc = inscricaoId;
        if (!finalInsc) {
          const [insc] = await inscreverN(Number(ng.bateriaId), Number(ng.responsavelId), 1, 'recepcao', sessaoUid, `Reserva em grupo ${ng.codigo} pelo painel web`, false, { vagaDoGrupo: true, run });
          finalInsc = insc;
        } else {
          await run(
            `UPDATE dbo.Inscricao
                SET ResponsavelId = @resp,
                    Observacao = LEFT('Reserva em grupo ' + @cod + ' pelo painel web' + CASE WHEN Observacao IS NOT NULL AND Observacao <> '' THEN ' · ' + Observacao ELSE '' END, 400),
                    AtualizadoEm = SYSDATETIME()
              WHERE Id = @i`,
            { resp: ng.responsavelId, cod: ng.codigo, i: finalInsc },
          );
        }
        await novoPiloto(run, novoGrupoId, proxima, { nome: p.nome ?? '', telefone: p.telefone ?? '', menor: false }, finalInsc, false, clienteId);
        await run(`UPDATE dbo.ReservaGrupoPiloto SET CadastroEm = SYSDATETIME() WHERE GrupoId = @ng AND Ordem = @o`, { ng: novoGrupoId, o: proxima });
      }

      log(`grupo ${grupoId}: piloto ${p.id} transferido para o grupo ${novoGrupoId} (${ng.codigo})`);
    } else {
      throw new HttpError(400, 'Destino inválido: escolha "sozinho" ou "outro_grupo".');
    }

    await limparProvisorios();
    return { ok: true, mensagem: opts.destino === 'sozinho' ? 'Participante colocado sozinho como reserva individual.' : 'Participante transferido para o novo grupo com sucesso.' };
  });
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
    if (bat) { send(200, await carregarGrupos(`g.BateriaId = @b AND g.Status = 'ativa'`, { b: int(bat, 'Bateria') })); return true; }
    const de = String(url.searchParams.get('de') ?? ''), ate = String(url.searchParams.get('ate') ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) throw new HttpError(400, 'Informe o período.');
    send(200, await carregarGrupos(`g.Status = 'ativa' AND b.Inicio >= @de AND b.Inicio < DATEADD(day, 1, @ate)`, { de, ate }));
    return true;
  }

  if (path === '/grupos/pendencias' && method === 'GET') {
    // quem chegou/reservou sozinho na bateria e as vagas de grupo que aguardam cadastro: a recepção liga uma coisa à outra
    const b = int(url.searchParams.get('bateriaId'), 'Bateria');
    const grupos = await query<{ id: number; codigo: string; responsavel: string }>(
      `SELECT g.Id id, g.Codigo codigo, r.Nome responsavel FROM dbo.ReservaGrupo g JOIN dbo.Cliente r ON r.Id = g.ResponsavelId WHERE g.BateriaId = @b AND g.Status = 'ativa'`, { b });
    const comVagas = [];
    for (const g of grupos) { const livres = await vagasAguardando(g.id); if (livres.length) comVagas.push({ ...g, vagas: livres.map((v) => ({ id: v.id, ordem: v.ordem, nome: v.nome })) }); }
    const candidatos = comVagas.length ? await query(
      `SELECT i.Id inscricaoId, c.Id clienteId, c.Nome nome, i.Origem origem, i.Pago pago
         FROM dbo.Inscricao i JOIN dbo.Cliente c ON c.Id = i.ClienteId
        WHERE i.BateriaId = @b AND i.Status <> 'cancelada'
          AND NOT EXISTS (SELECT 1 FROM dbo.ReservaGrupoPiloto p JOIN dbo.ReservaGrupo g ON g.Id = p.GrupoId AND g.Status = 'ativa' WHERE p.InscricaoId = i.Id)
          AND NOT EXISTS (SELECT 1 FROM dbo.ReservaGrupoPiloto p JOIN dbo.ReservaGrupo g ON g.Id = p.GrupoId AND g.Status = 'ativa' WHERE p.ClienteId = c.Id AND g.BateriaId = @b)
          AND NOT EXISTS (SELECT 1 FROM dbo.ReservaGrupo g WHERE g.Status = 'ativa' AND g.BateriaId = @b AND g.ResponsavelId = c.Id)
        ORDER BY c.Nome`, { b }) : [];
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
      `SELECT p.PrecoCentavos preco, b.ProdutoId produtoId FROM dbo.Bateria b LEFT JOIN dbo.Produto p ON p.Id = b.ProdutoId WHERE b.Id = @id`, { id: bateriaId },
    );
    if (!bat) throw new HttpError(404, 'Bateria não encontrada.');
    const preco = b.precoCentavos != null && b.precoCentavos !== '' ? cents(b.precoCentavos, 'Preço por piloto') : Number(bat.preco) || 0;
    if (preco <= 0) throw new HttpError(400, 'Informe o preço por piloto.');
    const sinalPct = Math.max(0, Math.min(100, Math.round(Number(b.sinalPct ?? 30)) || 0));
    const obs = txt(b.observacao, 300);
    // as vagas: o mesmo caminho da Recepção (confere vaga, cliente bloqueado, bateria passada)
    const id = await tx(async (run) => {
      const [aberta] = await run(`SELECT Status status, ReservaFechada fechada FROM dbo.Bateria WITH (UPDLOCK, HOLDLOCK) WHERE Id = @id`, { id: bateriaId });
      if (!aberta || aberta.status !== 'aberta' || aberta.fechada) throw new HttpError(409, 'Abra a bateria antes de criar outro grupo.');
      const insc = await inscreverN(bateriaId, responsavelId, pilotos.length, origem === 'site' ? 'site' : 'recepcao', sessao.uid, `Reserva em grupo pelo painel web${obs ? ` · ${obs}` : ''}`.slice(0, 400), false, { produtoId: bat.produtoId, vagaDoGrupo: true, run });
        const [g] = await run(
          `INSERT INTO dbo.ReservaGrupo (Codigo, BateriaId, ResponsavelId, Origem, Modo, PrecoCentavos, SinalPct, Observacao, CriadoPor)
           OUTPUT inserted.Id id VALUES (@codigo, @b, @r, @o, @m, @preco, @sinal, @obs, @u)`,
          { codigo: codigoNovo(), b: bateriaId, r: responsavelId, o: origem, m: modo, preco, sinal: sinalPct, obs, u: sessao.uid },
        );
        for (let k = 0; k < pilotos.length; k++) await novoPiloto(run, Number(g.id), k + 1, pilotos[k], insc[k], k === 0, k === 0 ? responsavelId : null);
        // cada amigo é uma pessoa: a vaga nasce com cadastro provisório próprio, não no nome do responsável
        for (let k = 1; k < pilotos.length; k++) {
          const cid = await cadastroDaVaga(run, responsavelId, k + 1, txt(pilotos[k].nome, 120) ?? null, fone(pilotos[k].telefone) ?? null);
          await run(`UPDATE dbo.Inscricao SET ClienteId = @c WHERE Id = @i`, { c: cid, i: insc[k] });
        }
        await run(`UPDATE dbo.Inscricao SET PrecoCentavos = @preco WHERE Id IN (${insc.map(Number).join(',')})`, { preco });
        return Number(g.id);
    });
    send(201, await grupo(id));
    return true;
  }

  if ((m = path.match(/^\/grupos\/(\d+)\/mover$/)) && method === 'POST') {
    await moverReservas([], int((await req.body()).bateriaId, 'Bateria'), Number(m[1]));
    send(200, await grupo(Number(m[1])));
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
        const [vigente] = await run(`SELECT PrecoCentavos preco, Modo modo FROM dbo.ReservaGrupo WITH (UPDLOCK, HOLDLOCK) WHERE Id = @id AND Status = 'ativa'`, { id });
        if (!vigente) throw new HttpError(409, 'Esta reserva não está ativa.');
        if (preco !== Number(vigente.preco) || modo !== vigente.modo) {
          const [financeiro] = await run(`SELECT
            (SELECT COUNT(*) FROM dbo.ReservaGrupoPagamento WHERE GrupoId = @id AND Cancelado = 0) pagamentos,
            (SELECT COUNT(*) FROM dbo.ReservaGrupoCobranca WHERE GrupoId = @id AND Status IN ('aguardando', 'pago')) cobrancas,
            (SELECT COUNT(*) FROM dbo.ReservaGrupoPiloto p JOIN dbo.Inscricao i ON i.Id = p.InscricaoId WHERE p.GrupoId = @id AND i.Pago = 1 AND i.Status <> 'cancelada') pagos`, { id });
          if (financeiro && (financeiro.pagamentos || financeiro.cobrancas || financeiro.pagos))
            throw new HttpError(409, 'Há pagamentos ou cobranças neste grupo. Resolva-os antes de alterar preço ou forma de divisão.');
        }
        await run(`UPDATE dbo.ReservaGrupo SET Modo = @modo, PrecoCentavos = @preco, SinalPct = @sinal, Observacao = @obs, AtualizadoEm = SYSDATETIME() WHERE Id = @id`,
          { id, modo, preco, sinal, obs: b.observacao !== undefined ? txt(b.observacao, 300) : atual.observacao ?? null });
        if (preco !== Number(vigente.preco)) await run(`UPDATE i SET PrecoCentavos = @preco, DescontoCentavos = 0, AtualizadoEm = SYSDATETIME()
          FROM dbo.Inscricao i JOIN dbo.ReservaGrupoPiloto p ON p.InscricaoId = i.Id
          WHERE p.GrupoId = @id AND i.Status <> 'cancelada' AND i.Pago = 0`, { id, preco });
      });
      await aplicarPagos(id);
      send(200, await grupo(id));
      return true;
    }
    if (method === 'DELETE') {
      await grupo(id);
      await tx(async (run) => {
        await run(`SELECT Id FROM dbo.ReservaGrupo WITH (UPDLOCK, HOLDLOCK) WHERE Id = @id`, { id });
        await run(`UPDATE dbo.Inscricao SET Status = 'cancelada', AtualizadoEm = SYSDATETIME() WHERE Id IN (SELECT InscricaoId FROM dbo.ReservaGrupoPiloto WHERE GrupoId = @id)`, { id });
        await run(`UPDATE dbo.ReservaGrupo SET Status = 'cancelada', AtualizadoEm = SYSDATETIME() WHERE Id = @id`, { id });
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
      const [atual] = await run(`SELECT Id, BateriaId bateriaId, PrecoCentavos preco FROM dbo.ReservaGrupo WITH (UPDLOCK, HOLDLOCK) WHERE Id = @id AND Status = 'ativa'`, { id });
      if (!atual) throw new HttpError(409, 'Esta reserva não está ativa.');
      const [ordem] = await run(`SELECT ISNULL(MAX(Ordem), 0) + 1 proxima FROM dbo.ReservaGrupoPiloto WHERE GrupoId = @id`, { id });
      const proxima = Number(ordem.proxima);
      const [insc] = await inscreverN(Number(atual.bateriaId), Number(g.responsavelId), 1, 'recepcao', sessao.uid, `Reserva em grupo ${g.codigo} pelo painel web`, false, { vagaDoGrupo: true, run });
      await novoPiloto(run, id, proxima, p, insc, false, null);
      const cid = await cadastroDaVaga(run, Number(g.responsavelId), proxima, txt(p.nome, 120) ?? null, fone(p.telefone) ?? null);
      await run(`UPDATE dbo.Inscricao SET ClienteId = @c, ResponsavelId = @r, PrecoCentavos = @p WHERE Id = @i`, { c: cid, r: g.responsavelId, p: atual.preco, i: insc });
    });
    await aplicarPagos(id);
    send(201, await grupo(id));
    return true;
  }

  if ((m = path.match(/^\/grupos\/(\d+)\/pilotos\/(\d+)$/))) {
    const id = Number(m[1]), pid = Number(m[2]);
    const g = await grupo(id);
    const p = g.pilotos.find((x) => x.id === pid);
    if (!p && method === 'DELETE' && await one(`SELECT p.Id FROM dbo.ReservaGrupoPiloto p JOIN dbo.Inscricao i ON i.Id = p.InscricaoId WHERE p.Id = @pid AND p.GrupoId = @id AND i.Status = 'cancelada'`, { pid, id })) {
      send(200, g);
      return true;
    }
    if (!p) throw new HttpError(404, 'Piloto não encontrado no grupo.');
    if (method === 'PUT') {
      const b = (await req.body()) as PilotoIn;
      await query(`UPDATE dbo.ReservaGrupoPiloto SET Nome = @n, Telefone = @t, Menor = @m WHERE Id = @id`, { id: pid, n: txt(b.nome, 120), t: b.telefone === '' ? null : fone(b.telefone) ?? txt(b.telefone, 30), m: b.menor ? 1 : 0 });
      if (!p.clienteId && p.inscricaoId) {
        await query(
          `UPDATE c SET Nome = LEFT(COALESCE(NULLIF(LTRIM(RTRIM(@n)), ''), 'Amigo ' + CAST(@o AS varchar(5)) + ' de ' + r.Nome), 200), Telefone = COALESCE(@t, c.Telefone), AtualizadoEm = SYSDATETIME()
             FROM dbo.Cliente c JOIN dbo.Inscricao i ON i.ClienteId = c.Id JOIN dbo.Cliente r ON r.Id = @r WHERE i.Id = @i AND c.Origem = 'grupo'`,
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
      await query(`UPDATE dbo.ReservaGrupoPiloto SET LinkEnviadoEm = SYSDATETIME() WHERE GrupoId = @id AND Id IN (${inClause})`, pmap);
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
    const valor = cents(b.valorCentavos, 'Valor recebido');
    const forma = txt(b.forma, 40) ?? 'Pix';
    await tx(async (run) => {
      const [ativo] = await run(`SELECT Id FROM dbo.ReservaGrupo WITH (UPDLOCK, HOLDLOCK) WHERE Id = @g AND Status = 'ativa'`, { g: id });
      if (!ativo) throw new HttpError(409, 'Esta reserva não está ativa.');
      const [anterior] = await run(`SELECT PilotoId pilotoId, ValorCentavos valor, Forma forma, Cancelado cancelado FROM dbo.ReservaGrupoPagamento WHERE GrupoId = @g AND IdempotencyKey = @key`, { g: id, key });
      if (anterior) {
        if (anterior.cancelado || Number(anterior.valor) !== valor || (anterior.pilotoId ?? null) !== pilotoId || anterior.forma !== forma)
          throw new HttpError(409, 'Esta chave já pertence a outro recebimento.');
        return;
      }
      await run(`INSERT INTO dbo.ReservaGrupoPagamento (GrupoId, PilotoId, ValorCentavos, Forma, Origem, UsuarioId, IdempotencyKey)
        VALUES (@g, @p, @v, @f, 'manual', @u, @key)`, { g: id, p: pilotoId, v: valor, f: forma, u: sessao.uid, key });
    });
    await aplicarPagos(id);
    send(201, await grupo(id));
    return true;
  }

  if ((m = path.match(/^\/grupos\/(\d+)\/pagamentos\/(\d+)$/)) && method === 'DELETE') {
    const id = Number(m[1]);
    const r = await one<{ Id: number }>(`UPDATE dbo.ReservaGrupoPagamento SET Cancelado = 1 OUTPUT inserted.Id WHERE Id = @pg AND GrupoId = @g AND Cancelado = 0 AND Origem = 'manual'`, { pg: Number(m[2]), g: id });
    if (!r) throw new HttpError(409, 'Só dá para estornar aqui pagamento lançado à mão. Pagamento do Asaas se estorna no Asaas.');
    await aplicarPagos(id);
    send(200, await grupo(id));
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
  const rows = await query(`DECLARE @alteradas TABLE (Id int);
    UPDATE dbo.Bateria SET Status = @status, ReservaFechada = @rf, AutoAtendimento = @aa
    OUTPUT inserted.Id INTO @alteradas WHERE Id = @id AND Status <> 'cancelada';
    SELECT Id id FROM @alteradas`,
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
    })),
  };
}
/**
 * Manda ao site o resumo das reservas em grupo ativas: com ele o link do grupo mostra "Grupo do(a) Fulano", a bateria e,
 * se cada um paga o seu, cobra a vaga da pessoa na hora (Asaas) no fim do cadastro. Só reenvia quando algo muda.
 */
export async function publicarGruposNoSite(log: Log) {
  if (!siteUrl() || !siteChave()) return 0;
  const gs = await query<{ id: number; codigo: string; modo: string; preco: number; sinalPct: number; status: string; bateria: string; inicio: string; responsavel: string; respDoc: string | null; respFone: string | null }>(
    `SELECT g.Id id, g.Codigo codigo, g.Modo modo, g.PrecoCentavos preco, g.SinalPct sinalPct, g.Status status, b.Nome bateria, CONVERT(varchar(16), b.Inicio, 126) inicio, r.Nome responsavel,
            r.Documento respDoc, r.Telefone respFone
       FROM dbo.ReservaGrupo g JOIN dbo.Bateria b ON b.Id = g.BateriaId JOIN dbo.Cliente r ON r.Id = g.ResponsavelId
      WHERE g.Status = 'ativa' AND b.Inicio > DATEADD(hour, -2, SYSDATETIME())`,
  );
  if (!gs.length) return 0;
  const lista = gs.map((g) => g.id).join(',');
  const pagos = await query<{ grupoId: number; pago: number }>(
    `SELECT GrupoId grupoId, SUM(ValorCentavos) pago FROM dbo.ReservaGrupoPagamento WHERE GrupoId IN (${lista}) AND Cancelado = 0 GROUP BY GrupoId`,
  );
  const vagas = await query<{ grupoId: number; token: string; livre: number; responsavel: number }>(
    `SELECT v.GrupoId grupoId, v.Token token, v.Responsavel responsavel, CASE WHEN v.ClienteId IS NULL AND v.Responsavel = 0 AND i.Id IS NOT NULL THEN 1 ELSE 0 END livre
       FROM dbo.ReservaGrupoPiloto v LEFT JOIN dbo.Inscricao i ON i.Id = v.InscricaoId AND i.Status <> 'cancelada'
      WHERE v.GrupoId IN (${lista}) AND (v.Responsavel = 1 OR i.Id IS NOT NULL)`,
  );
  // status por vaga para o painel do organizador (só primeiro nome; o painel só abre com a chave)
  const completos = await carregarGrupos(`g.Id IN (${lista})`, {}).catch(() => []);
  const grupos = gs.map((g) => {
    const dele = vagas.filter((v) => v.grupoId === g.id);
    const c = completos.find((x) => Number(x.id) === g.id);
    return {
      id: g.id, sinalPct: Number(g.sinalPct) || 0, pagoCentavos: Number(pagos.find((x) => x.grupoId === g.id)?.pago) || 0,
      // quem paga o grupo (modo único ou sinal): só o link do responsável cobra; os convidados só fazem o cadastro
      responsavelToken: dele.find((v) => Number(v.responsavel) === 1)?.token ?? null,
      tokens: dele.map((v) => v.token).filter(Boolean), codigo: g.codigo, status: g.status, modo: g.modo, precoCentavos: Number(g.preco) || 0,
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

/** A pessoa pagou (ou vai pagar) a vaga no fim do cadastro pelo link do grupo: a cobrança passa a ser da vaga que ficou com ela. */
export async function registrarCobrancaDoLink(token: string, clienteId: number, cob: { id?: unknown; link?: unknown; valorCentavos?: unknown }, log: Log) {
  const asaasId = String(cob.id ?? '');
  if (!/^pay_[A-Za-z0-9]{6,40}$/.test(asaasId)) return false;
  const vaga = await one<{ id: number; grupoId: number }>(
    `SELECT TOP 1 v.Id id, v.GrupoId grupoId FROM dbo.ReservaGrupoPiloto t JOIN dbo.ReservaGrupoPiloto v ON v.GrupoId = t.GrupoId
      WHERE t.Token = @token AND v.ClienteId = @c ORDER BY v.Responsavel, v.Ordem`,
    { token, c: clienteId },
  );
  if (!vaga) { log(`grupo: cobrança ${asaasId} do link sem vaga para o cliente ${clienteId} (conferir na recepção)`); return false; }
  if (await one(`SELECT 1 x FROM dbo.ReservaGrupoCobranca WHERE AsaasId = @a`, { a: asaasId })) return true;
  await query(`UPDATE dbo.ReservaGrupoCobranca SET Status = 'cancelada' WHERE PilotoId = @p AND Status = 'aguardando'`, { p: vaga.id });
  await query(
    `INSERT INTO dbo.ReservaGrupoCobranca (GrupoId, PilotoId, ValorCentavos, AsaasId, Link) VALUES (@g, @p, @v, @a, @l)`,
    { g: vaga.grupoId, p: vaga.id, v: Math.round(Number(cob.valorCentavos) || 0), a: asaasId, l: String(cob.link ?? '').slice(0, 400) },
  );
  log(`grupo ${vaga.grupoId}: cobrança ${asaasId} do link ligada ao piloto ${vaga.id} (cliente ${clienteId})`);
  return true;
}
