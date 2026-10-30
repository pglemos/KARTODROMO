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
import { randomBytes } from 'node:crypto';
import { one, onlyDigits, query, tx } from './db';
import { HttpError, inscreverN } from './office';
import type { Sessao } from './auth';

type Req = { method: string; url: URL; body: () => Promise<Record<string, unknown>>; sessao: Sessao };
type Res = (status: number, body: unknown) => void;
type Log = (...args: unknown[]) => void;

export const LINK_CADASTRO = 'https://cadastro.kartodromodebetim.com.br';
const MODOS = ['unico', 'individual', 'sinal'] as const;
const ORIGENS = ['recepcao', 'whatsapp', 'telefone', 'site'] as const;

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
  id: number; codigo: string; bateriaId: number; inicio: string; bateria: string; responsavelId: number; responsavel: string; responsavelTelefone: string | null;
  origem: string; modo: string; preco: number; sinalPct: number; observacao: string | null; status: string; criadoEm: string; criadoPor: string | null;
};

export async function carregarGrupos(where: string, params: Record<string, unknown>) {
  const grupos = await query<GrupoRow>(
    `SELECT g.Id id, g.Codigo codigo, g.BateriaId bateriaId, CONVERT(varchar(16), b.Inicio, 126) inicio, b.Nome bateria, g.ResponsavelId responsavelId,
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
            c.Nome clienteNome, c.Documento documento, c.Email email, c.Peso peso, c.Telefone clienteTelefone
       FROM dbo.ReservaGrupoPiloto p
       LEFT JOIN dbo.Inscricao i ON i.Id = p.InscricaoId
       LEFT JOIN dbo.Cliente c ON c.Id = COALESCE(p.ClienteId, CASE WHEN p.Responsavel = 1 THEN (SELECT ResponsavelId FROM dbo.ReservaGrupo WHERE Id = p.GrupoId) END)
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
  return grupos.map((g) => montar(g, pilotos.filter((p) => p.grupoId === g.id), pagamentos.filter((p) => p.grupoId === g.id), cobrancas.filter((c) => c.grupoId === g.id)));
}

/** Mesmo cálculo da tela: quanto cada piloto já tem coberto e quem ainda falta. */
export function montar(g: GrupoRow, pilotos: Linha[], pagamentos: Linha[], cobrancas: Linha[]) {
  const preco = Number(g.preco) || 0;
  const ativos = pilotos.filter((p) => p.inscricaoStatus !== 'cancelada');
  const n = ativos.length;
  const unico = g.modo === 'unico';
  let doGrupo = 0;
  const porPiloto = new Map<number, number>();
  for (const pg of pagamentos) {
    const v = Number(pg.valor) || 0;
    if (!unico && pg.pilotoId) porPiloto.set(Number(pg.pilotoId), (porPiloto.get(Number(pg.pilotoId)) ?? 0) + v);
    else doGrupo += v;
  }
  // pago no caixa da Recepção ou pelo site: a vaga já vem paga e não depende do painel
  const pagosFora = ativos.filter((p) => p.inscricaoPaga && !p.pagoPeloGrupo).length;
  const restantes = Math.max(1, n - pagosFora);
  const pagoPainel = pagamentos.reduce((a, pg) => a + (Number(pg.valor) || 0), 0);
  const lista = ativos.map((p) => {
    const fora = Boolean(p.inscricaoPaga && !p.pagoPeloGrupo);
    const dela = fora ? preco : (porPiloto.get(Number(p.id)) ?? 0) + doGrupo / restantes;
    const ok = preco <= 0 || dela >= preco - 0.5;
    const cliente = p.documento !== undefined && (p.clienteId || p.responsavel) ? { documento: p.documento, email: p.email, peso: p.peso, telefone: p.clienteTelefone } : null;
    const falta = faltaNoCadastro(cliente);
    const cadastro = (p.clienteId || p.responsavel) && !falta.length ? 'completo' : p.cadastroEm || p.clienteId ? 'incompleto' : p.linkEnviadoEm ? 'enviado' : 'pendente';
    return {
      id: p.id, ordem: p.ordem, nome: p.nome || p.clienteNome || null, telefone: p.telefone || p.clienteTelefone || null, menor: Boolean(p.menor), responsavel: Boolean(p.responsavel),
      clienteId: p.clienteId ?? (p.responsavel ? g.responsavelId : null), inscricaoId: p.inscricaoId, kart: p.kart ?? null, termo: Boolean(p.termoEm),
      link: linkCadastro(String(p.token)), linkEnviadoEm: p.linkEnviadoEm, cadastroEm: p.cadastroEm, cadastro, falta: cadastro === 'completo' ? [] : falta,
      pago: ok, pagoNoCaixa: fora, valorPago: Math.min(Math.round(dela), preco), falta_centavos: Math.max(0, Math.round(preco - dela)),
      cobranca: cobrancas.find((c) => c.pilotoId === p.id && c.status === 'aguardando') ?? null,
    };
  });
  const total = n * preco;
  const pago = Math.min(total, pagoPainel + pagosFora * preco);
  const sinal = Math.round(total * (Number(g.sinalPct) || 0) / 100);
  return {
    ...g, pilotos: lista, pagamentos, n, total, pago, falta: Math.max(0, total - pago), sinal,
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
        `UPDATE dbo.Inscricao SET Pago = 1, ValorCentavos = @preco, Status = 'confirmada', Aprovada = 1, AtualizadoEm = SYSDATETIME()
           OUTPUT inserted.Id WHERE Id = @id AND Pago = 0 AND Status <> 'cancelada'`,
        { id: p.inscricaoId, preco: g.preco },
      );
      if (feito) await query(`UPDATE dbo.ReservaGrupoPiloto SET PagoPeloGrupo = 1 WHERE Id = @id`, { id: p.id });
    } else {
      const desfeito = await one<{ Id: number }>(
        `UPDATE i SET Pago = 0, ValorCentavos = NULL, Status = 'reservada', AtualizadoEm = SYSDATETIME() OUTPUT inserted.Id
           FROM dbo.Inscricao i JOIN dbo.ReservaGrupoPiloto p ON p.InscricaoId = i.Id
          WHERE p.Id = @pid AND p.PagoPeloGrupo = 1 AND i.VendaId IS NULL AND i.Pago = 1`,
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
  const p = await one<{ id: number; grupoId: number; inscricaoId: number | null; responsavel: boolean; bateriaId: number; nome: string | null }>(
    `SELECT p.Id id, p.GrupoId grupoId, p.InscricaoId inscricaoId, p.Responsavel responsavel, g.BateriaId bateriaId, p.Nome nome
       FROM dbo.ReservaGrupoPiloto p JOIN dbo.ReservaGrupo g ON g.Id = p.GrupoId WHERE p.Token = @token AND g.Status = 'ativa'`,
    { token },
  );
  if (!p) { log(`grupo: link ${token.slice(0, 4)}… não pertence a nenhuma reserva ativa`); return false; }
  const outra = await one<{ Id: number }>(
    `SELECT TOP 1 Id FROM dbo.Inscricao WHERE BateriaId = @b AND ClienteId = @c AND Status <> 'cancelada' AND Id <> ISNULL(@i, 0)`,
    { b: p.bateriaId, c: clienteId, i: p.inscricaoId },
  );
  if (p.inscricaoId && !outra) {
    await query(`UPDATE dbo.Inscricao SET ClienteId = @c, AtualizadoEm = SYSDATETIME() WHERE Id = @i AND Status <> 'cancelada'`, { c: clienteId, i: p.inscricaoId });
  }
  await query(
    `UPDATE p SET ClienteId = @c, CadastroEm = SYSDATETIME(), Nome = COALESCE(NULLIF(p.Nome, ''), c.Nome), Telefone = COALESCE(NULLIF(p.Telefone, ''), c.Telefone)
       FROM dbo.ReservaGrupoPiloto p JOIN dbo.Cliente c ON c.Id = @c WHERE p.Id = @id`,
    { c: clienteId, id: p.id },
  );
  log(`grupo ${p.grupoId}: piloto ${p.id} cadastrado pelo link (cliente ${clienteId})${outra ? ' — já tinha outra vaga na bateria, vaga do grupo mantida' : ''}`);
  return true;
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
  const valor = p ? p.falta_centavos : g.modo === 'sinal' && g.pago < g.sinal ? g.sinal - g.pago : g.falta;
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
export async function conferirCobrancas(log: Log) {
  if (!siteUrl() || !siteChave()) return 0;
  const abertas = await query<{ id: number; grupoId: number; pilotoId: number | null; valor: number; asaasId: string }>(
    `SELECT TOP 40 Id id, GrupoId grupoId, PilotoId pilotoId, ValorCentavos valor, AsaasId asaasId FROM dbo.ReservaGrupoCobranca
      WHERE Status = 'aguardando' AND CriadoEm > DATEADD(day, -10, SYSDATETIME()) ORDER BY Id`,
  );
  let pagas = 0;
  for (const c of abertas) {
    try {
      const s = await site(`/api/sync/cobranca/${encodeURIComponent(c.asaasId)}`);
      if (s.pago) {
        const ok = await one<{ Id: number }>(`UPDATE dbo.ReservaGrupoCobranca SET Status = 'pago', PagoEm = SYSDATETIME() OUTPUT inserted.Id WHERE Id = @id AND Status = 'aguardando'`, { id: c.id });
        if (ok) {
          await query(
            `INSERT INTO dbo.ReservaGrupoPagamento (GrupoId, PilotoId, ValorCentavos, Forma, Origem, AsaasId) VALUES (@g, @p, @v, @f, 'asaas', @a)`,
            { g: c.grupoId, p: c.pilotoId, v: c.valor, f: s.forma === 'PIX' ? 'Pix (Asaas)' : s.forma === 'CREDIT_CARD' ? 'Cartão (Asaas)' : 'Asaas', a: c.asaasId },
          );
          await aplicarPagos(c.grupoId);
          pagas++;
          log(`grupo ${c.grupoId}: pagamento Asaas ${c.asaasId} recebido`);
        }
      } else if (['REFUNDED', 'DELETED', 'OVERDUE'].includes(String(s.status))) {
        await query(`UPDATE dbo.ReservaGrupoCobranca SET Status = @s WHERE Id = @id`, { id: c.id, s: s.status === 'OVERDUE' ? 'vencida' : 'cancelada' });
      }
    } catch (e) {
      log(`grupo ${c.grupoId}: conferência da cobrança falhou (${(e as Error).message})`);
    }
  }
  return pagas;
}

// ---------------------------------------------------------------- rotas (/api/office/grupos…)

async function novoPiloto(run: (t: string, p?: Record<string, unknown>) => Promise<Linha[]>, grupoId: number, ordem: number, p: PilotoIn, inscricaoId: number, responsavel: boolean, clienteId: number | null) {
  await run(
    `INSERT INTO dbo.ReservaGrupoPiloto (GrupoId, Ordem, Nome, Telefone, Menor, Responsavel, ClienteId, InscricaoId, Token)
     VALUES (@g, @o, @n, @t, @m, @r, @c, @i, @k)`,
    { g: grupoId, o: ordem, n: txt(p.nome, 120), t: fone(p.telefone), m: p.menor ? 1 : 0, r: responsavel ? 1 : 0, c: clienteId, i: inscricaoId, k: tokenNovo() },
  );
}

export async function gruposRoutes(req: Req, send: Res): Promise<boolean> {
  const { method, url, sessao } = req;
  const path = url.pathname.replace(/^\/api\/office/, '');
  let m: RegExpMatchArray | null;
  if ((m = path.match(/^\/baterias\/(\d+)\/tipo$/)) && method === 'POST') {
    await tipoDaBateria(Number(m[1]), String((await req.body()).tipo ?? ''));
    send(200, { ok: true });
    return true;
  }
  if (!path.startsWith('/grupos')) return false;

  if (path === '/grupos' && method === 'GET') {
    const bat = url.searchParams.get('bateriaId');
    if (bat) { send(200, await carregarGrupos(`g.BateriaId = @b AND g.Status = 'ativa'`, { b: int(bat, 'Bateria') })); return true; }
    const de = String(url.searchParams.get('de') ?? ''), ate = String(url.searchParams.get('ate') ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) throw new HttpError(400, 'Informe o período.');
    send(200, await carregarGrupos(`g.Status = 'ativa' AND b.Inicio >= @de AND b.Inicio < DATEADD(day, 1, @ate)`, { de, ate }));
    return true;
  }

  if (path === '/grupos' && method === 'POST') {
    const b = await req.body();
    const bateriaId = int(b.bateriaId, 'Bateria');
    const responsavelId = int(b.responsavelId, 'Responsável');
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
    const insc = await inscreverN(bateriaId, responsavelId, pilotos.length, origem === 'site' ? 'site' : 'recepcao', sessao.uid, `Reserva em grupo pelo painel web${obs ? ` · ${obs}` : ''}`.slice(0, 400), true, { produtoId: bat.produtoId });
    try {
      const id = await tx(async (run) => {
        const [g] = await run(
          `INSERT INTO dbo.ReservaGrupo (Codigo, BateriaId, ResponsavelId, Origem, Modo, PrecoCentavos, SinalPct, Observacao, CriadoPor)
           OUTPUT inserted.Id id VALUES (@codigo, @b, @r, @o, @m, @preco, @sinal, @obs, @u)`,
          { codigo: codigoNovo(), b: bateriaId, r: responsavelId, o: origem, m: modo, preco, sinal: sinalPct, obs, u: sessao.uid },
        );
        for (let k = 0; k < pilotos.length; k++) await novoPiloto(run, Number(g.id), k + 1, pilotos[k], insc[k], k === 0, k === 0 ? responsavelId : null);
        await run(`UPDATE dbo.Inscricao SET PrecoCentavos = @preco WHERE Id IN (${insc.map(Number).join(',')})`, { preco });
        return Number(g.id);
      });
      send(201, await grupo(id));
    } catch (e) {
      await query(`UPDATE dbo.Inscricao SET Status = 'cancelada', AtualizadoEm = SYSDATETIME() WHERE Id IN (${insc.map(Number).join(',')}) AND Pago = 0`).catch(() => undefined);
      throw e;
    }
    return true;
  }

  if ((m = path.match(/^\/grupos\/(\d+)$/))) {
    const id = Number(m[1]);
    if (method === 'GET') { send(200, await grupo(id)); return true; }
    if (method === 'PUT') {
      const b = await req.body();
      const atual = await grupo(id);
      const modo = MODOS.find((x) => x === b.modo) ?? atual.modo;
      const preco = b.precoCentavos != null ? cents(b.precoCentavos, 'Preço por piloto') : Number(atual.preco);
      const sinal = b.sinalPct != null ? Math.max(0, Math.min(100, Math.round(Number(b.sinalPct)) || 0)) : Number(atual.sinalPct);
      await query(
        `UPDATE dbo.ReservaGrupo SET Modo = @modo, PrecoCentavos = @preco, SinalPct = @sinal, Observacao = @obs, AtualizadoEm = SYSDATETIME() WHERE Id = @id`,
        { id, modo, preco, sinal, obs: b.observacao !== undefined ? txt(b.observacao, 300) : atual.observacao ?? null },
      );
      await aplicarPagos(id);
      send(200, await grupo(id));
      return true;
    }
    if (method === 'DELETE') {
      const g = await grupo(id);
      if (g.pilotos.some((p) => p.pagoNoCaixa)) throw new HttpError(409, 'Há pilotos que já pagaram no caixa: cancele pela Recepção (estorno).');
      if (g.pagamentos.length) throw new HttpError(409, 'Há pagamentos registrados neste grupo: estorne antes de cancelar.');
      await query(`UPDATE dbo.Inscricao SET Status = 'cancelada', AtualizadoEm = SYSDATETIME() WHERE Id IN (SELECT InscricaoId FROM dbo.ReservaGrupoPiloto WHERE GrupoId = @id) AND Pago = 0`, { id });
      await query(`UPDATE dbo.ReservaGrupo SET Status = 'cancelada', AtualizadoEm = SYSDATETIME() WHERE Id = @id`, { id });
      send(200, { ok: true });
      return true;
    }
  }

  if ((m = path.match(/^\/grupos\/(\d+)\/pilotos$/)) && method === 'POST') {
    const id = Number(m[1]);
    const g = await grupo(id);
    const p = (await req.body()) as PilotoIn;
    const [insc] = await inscreverN(Number(g.bateriaId), Number(g.responsavelId), 1, 'recepcao', sessao.uid, `Reserva em grupo ${g.codigo} pelo painel web`, true, { vagaDoGrupo: true });
    await tx(async (run) => { await novoPiloto(run, id, g.n + 1, p, insc, false, null); await run(`UPDATE dbo.Inscricao SET ResponsavelId = @r, PrecoCentavos = @p WHERE Id = @i`, { r: g.responsavelId, p: g.preco, i: insc }); });
    await aplicarPagos(id);
    send(201, await grupo(id));
    return true;
  }

  if ((m = path.match(/^\/grupos\/(\d+)\/pilotos\/(\d+)$/))) {
    const id = Number(m[1]), pid = Number(m[2]);
    const g = await grupo(id);
    const p = g.pilotos.find((x) => x.id === pid);
    if (!p) throw new HttpError(404, 'Piloto não encontrado no grupo.');
    if (method === 'PUT') {
      const b = (await req.body()) as PilotoIn;
      await query(`UPDATE dbo.ReservaGrupoPiloto SET Nome = @n, Telefone = @t, Menor = @m WHERE Id = @id`, { id: pid, n: txt(b.nome, 120), t: b.telefone === '' ? null : fone(b.telefone) ?? txt(b.telefone, 30), m: b.menor ? 1 : 0 });
      send(200, await grupo(id));
      return true;
    }
    if (method === 'DELETE') {
      if (p.responsavel) throw new HttpError(409, 'O responsável não sai do grupo: cancele a reserva inteira.');
      if (p.pagoNoCaixa) throw new HttpError(409, 'Este piloto pagou no caixa: tire pela Recepção (estorno).');
      if (g.pagamentos.some((pg) => Number(pg.pilotoId) === pid)) throw new HttpError(409, 'Há pagamento deste piloto: estorne antes de tirar.');
      await query(`UPDATE dbo.Inscricao SET Status = 'cancelada', Pago = 0, AtualizadoEm = SYSDATETIME() WHERE Id = @i AND VendaId IS NULL`, { i: p.inscricaoId });
      await query(`DELETE FROM dbo.ReservaGrupoCobranca WHERE PilotoId = @id AND Status <> 'pago'`, { id: pid });
      await query(`DELETE FROM dbo.ReservaGrupoPiloto WHERE Id = @id`, { id: pid });
      await aplicarPagos(id);
      send(200, await grupo(id));
      return true;
    }
  }

  if ((m = path.match(/^\/grupos\/(\d+)\/links$/)) && method === 'POST') {
    const id = Number(m[1]);
    const b = await req.body();
    const ids = (Array.isArray(b.pilotoIds) ? b.pilotoIds : []).map(Number).filter((x: number) => Number.isInteger(x) && x > 0);
    if (ids.length) await query(`UPDATE dbo.ReservaGrupoPiloto SET LinkEnviadoEm = SYSDATETIME() WHERE GrupoId = @id AND Id IN (${ids.join(',')})`, { id });
    send(200, await grupo(id));
    return true;
  }

  if ((m = path.match(/^\/grupos\/(\d+)\/pagamentos$/)) && method === 'POST') {
    const id = Number(m[1]);
    const b = await req.body();
    const g = await grupo(id);
    const pilotoId = b.pilotoId ? int(b.pilotoId, 'Piloto') : null;
    if (pilotoId && !g.pilotos.some((p) => p.id === pilotoId)) throw new HttpError(404, 'Piloto não encontrado no grupo.');
    const valor = cents(b.valorCentavos, 'Valor recebido');
    const forma = txt(b.forma, 40) ?? 'Pix';
    await query(
      `INSERT INTO dbo.ReservaGrupoPagamento (GrupoId, PilotoId, ValorCentavos, Forma, Origem, UsuarioId) VALUES (@g, @p, @v, @f, 'manual', @u)`,
      { g: id, p: pilotoId, v: valor, f: forma, u: sessao.uid },
    );
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
export async function tipoDaBateria(bateriaId: number, tipo: string) {
  if (tipo === 'fechada') await query(`UPDATE dbo.Bateria SET ReservaFechada = 1 WHERE Id = @id AND Status <> 'cancelada'`, { id: bateriaId });
  // site e totem só oferecem bateria com Status 'aberta', ReservaFechada 0 e AutoAtendimento 1: bloquear tira dos dois e
  // a Recepção continua vendo e vendendo normalmente
  else if (tipo === 'bloqueada') await query(`UPDATE dbo.Bateria SET AutoAtendimento = 0 WHERE Id = @id AND Status <> 'cancelada'`, { id: bateriaId });
  else if (tipo === 'aberta') await query(`UPDATE dbo.Bateria SET ReservaFechada = 0, AutoAtendimento = 1 WHERE Id = @id AND Status <> 'cancelada'`, { id: bateriaId });
  else throw new HttpError(400, 'Tipo inválido.');
}
