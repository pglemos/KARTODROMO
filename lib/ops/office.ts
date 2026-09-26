/**
 * API do app da recepcao (replica funcional do LapTime Office).
 * Todas as rotas daqui exigem sessao de usuario (lib/ops/auth.ts).
 */
import { CLIENTE_COLS, insertCliente, isValidCpf, one, onlyDigits, query, tx, updateCliente, type ClienteInput } from './db';
import { confereSenha, hashSenha, type Sessao } from './auth';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Req = { method: string; url: URL; body: () => Promise<Record<string, unknown>>; sessao: Sessao };
type Res = (status: number, body: unknown) => void;

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const int = (v: unknown, nome: string, min = 1) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min) throw new HttpError(400, `${nome} inválido.`);
  return n;
};
const cents = (v: unknown, nome = 'Valor') => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 0 || n > 100_000_000) throw new HttpError(400, `${nome} inválido.`);
  return n;
};
const isoDate = (v: unknown) => {
  const s = String(v ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new HttpError(400, 'Data inválida.');
  const date = new Date(`${s}T00:00:00Z`);
  if (s.startsWith('0000') || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== s) throw new HttpError(400, 'Data inválida.');
  return s;
};
// SQL Server exige segundos no formato ISO de DATETIME2. Preserva a hora local,
// sem converter o horário de Brasília para UTC.
const localDateTime = (v: unknown) => {
  const s = String(v ?? '');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) || Number(s.slice(11, 13)) > 23 || Number(s.slice(14, 16)) > 59) {
    throw new HttpError(400, 'Data/hora inválida.');
  }
  isoDate(s.slice(0, 10));
  return `${s}:00`;
};
const str = (v: unknown, max: number) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
const pontos = (v: unknown) => {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n === 0 || Math.abs(n) > 1_000_000) throw new HttpError(400, 'Informe uma quantidade de pontos inteira, diferente de zero e de até 1.000.000.');
  return n;
};
const chaveIdempotencia = (v: unknown) => {
  const key = str(v, 80);
  if (!key || key.length < 8 || !/^[a-zA-Z0-9._:-]+$/.test(key)) throw new HttpError(400, 'Informe uma chave de idempotência válida (8 a 80 caracteres).');
  return key;
};
const percentual = (v: unknown) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 100 || Math.round(n * 100) !== n * 100) throw new HttpError(400, 'A comissão deve estar entre 0 e 100, com até duas casas decimais.');
  return n;
};
const bit = (v: unknown) => (v === true || v === 'true' || v === 1 || v === '1' ? 1 : 0);
const duplicateSql = (e: unknown) => /UNIQUE|duplicate|2627|2601/i.test(e instanceof Error ? e.message : String(e));

async function servicosOnline() {
  const servicos: { id: string; nome: string; online: boolean | null; status: 'online' | 'offline' | 'indisponivel'; verificadoEm: string | null; detalhe?: string }[] = [
    { id: 'office-api', nome: 'API da Recepção', online: true, status: 'online', verificadoEm: new Date().toISOString() },
  ];
  let bancoOnline = false;
  let bancoVerificado: string | null = null;
  try {
    const db = await one<{ agora: string }>(`SELECT CONVERT(varchar(19), SYSDATETIME(), 126) agora`);
    bancoOnline = Boolean(db);
    bancoVerificado = db?.agora ?? null;
    servicos.push({ id: 'ops-sql', nome: 'Banco operacional', online: bancoOnline, status: bancoOnline ? 'online' : 'offline', verificadoEm: bancoVerificado });
  } catch {
    servicos.push({ id: 'ops-sql', nome: 'Banco operacional', online: false, status: 'offline', verificadoEm: null });
  }
  servicos.push({ id: 'reservas-online', nome: 'Reservas online (totem)', online: bancoOnline, status: bancoOnline ? 'online' : 'offline', verificadoEm: bancoVerificado,
    detalhe: 'Usa a API de operações e o banco operacional.' });
  servicos.push(
    { id: 'site', nome: 'Site kartodromodebetim.com.br', online: null, status: 'indisponivel', verificadoEm: null, detalhe: 'Sem endereço de verificação configurado no servidor.' },
    { id: 'whatsapp', nome: 'WhatsApp (resultados e lembretes)', online: null, status: 'indisponivel', verificadoEm: null, detalhe: 'Não há provedor de WhatsApp configurado.' },
    { id: 'timing-display', nome: 'Classificação ao vivo / telão', online: null, status: 'indisponivel', verificadoEm: null, detalhe: 'Sem endereço de verificação configurado no servidor.' },
  );

  // Serviços opcionais são declarados pela configuração do servidor; nomes e URLs não são
  // derivados de entrada do usuário nem enviados de volta ao cliente.
  type ServiceProbeConfig = { id?: string; nome: string; url: string };
  let configurados: ServiceProbeConfig[] = [];
  try {
    const raw = JSON.parse(process.env.OPS_SERVICOS_ONLINE ?? '[]') as unknown;
    if (Array.isArray(raw)) configurados = raw.filter((x): x is ServiceProbeConfig =>
      Boolean(x) && typeof x === 'object' && typeof (x as { nome?: unknown }).nome === 'string' && typeof (x as { url?: unknown }).url === 'string',
    ).slice(0, 12);
  } catch { /* configuração opcional ausente ou inválida */ }
  const probes = await Promise.all(configurados.map(async (x, i) => {
    const nome = String(x.nome).trim().slice(0, 80) || `Serviço ${i + 1}`;
    const id = typeof x.id === 'string' ? x.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || `configured-${i + 1}` : `configured-${i + 1}`;
    let online = false;
    try {
      const url = new URL(x.url);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('URL inválida');
      const r = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(3000), redirect: 'manual' });
      online = r.status >= 200 && r.status < 400;
    } catch { online = false; }
    return { id, nome, online, status: online ? 'online' as const : 'offline' as const, verificadoEm: new Date().toISOString() };
  }));
  for (const probe of probes) {
    const existing = servicos.findIndex((service) => service.id === probe.id);
    if (existing < 0) servicos.push(probe);
    else servicos[existing] = probe;
  }
  return {
    servicos,
    acoes: {
      publicarAgenda: { disponivel: false, motivo: 'Não há integração de publicação do calendário configurada.' },
      enviarLembreteWhatsApp: { disponivel: false, motivo: 'Não há provedor de WhatsApp configurado.' },
      sincronizarAgora: { disponivel: false, motivo: 'Não há destino ou rotina de sincronização configurado.' },
    },
  };
}

async function voucherLinks(origem: string, body: Record<string, unknown>, keep?: { parceiroId?: number | null; fidelidadeContaId?: number | null }) {
  let parceiroId = body.parceiroId ? int(body.parceiroId, 'Parceiro') : keep?.parceiroId ?? null;
  let fidelidadeContaId = body.fidelidadeContaId ? int(body.fidelidadeContaId, 'Conta de fidelidade') : keep?.fidelidadeContaId ?? null;
  let referencia = str(body.referencia, 150);
  if (origem === 'parceiro') {
    fidelidadeContaId = null;
    if (!parceiroId && referencia) {
      const p = await one<{ id: number }>(`SELECT TOP 1 Id id FROM dbo.Parceiro WHERE Nome COLLATE Latin1_General_CI_AI = @nome AND Ativo = 1 ORDER BY Id`, { nome: referencia });
      parceiroId = p?.id ?? null;
    }
    if (!parceiroId) throw new HttpError(400, 'Selecione um parceiro ativo para vincular o voucher.');
    const p = await one<{ nome: string; ativo: boolean }>(`SELECT Nome nome, Ativo ativo FROM dbo.Parceiro WHERE Id = @id`, { id: parceiroId });
    if (!p || !p.ativo) throw new HttpError(400, 'Parceiro não encontrado ou inativo.');
    referencia = referencia ?? p.nome;
  } else if (origem === 'fidelidade') {
    parceiroId = null;
    if (!fidelidadeContaId && referencia) {
      const a = await one<{ id: number }>(
        `SELECT TOP 1 f.Id id FROM dbo.FidelidadeConta f JOIN dbo.Cliente c ON c.Id = f.ClienteId
         WHERE c.Nome COLLATE Latin1_General_CI_AI = @nome AND f.Ativo = 1 ORDER BY f.Id`, { nome: referencia },
      );
      fidelidadeContaId = a?.id ?? null;
    }
    if (!fidelidadeContaId) throw new HttpError(400, 'Selecione uma conta de fidelidade ativa para vincular o voucher.');
    const a = await one<{ nome: string; ativo: boolean }>(
      `SELECT c.Nome nome, f.Ativo ativo FROM dbo.FidelidadeConta f JOIN dbo.Cliente c ON c.Id = f.ClienteId WHERE f.Id = @id`, { id: fidelidadeContaId },
    );
    if (!a || !a.ativo) throw new HttpError(400, 'Conta de fidelidade não encontrada ou inativa.');
    referencia = referencia ?? a.nome;
  } else {
    parceiroId = null;
    fidelidadeContaId = null;
  }
  return { parceiroId, fidelidadeContaId, referencia };
}

/** Filtro "Exibir dados:" do LapTime aplicado a uma coluna de data. */
function periodo(url: URL, col: string) {
  const filtro = url.searchParams.get('filtro') || 'dia';
  const data = url.searchParams.get('data') || new Date().toISOString().slice(0, 10);
  isoDate(data);
  const ate = url.searchParams.get('ate');
  switch (filtro) {
    case 'semana':
      return { where: `${col} >= DATEADD(day, 1 - DATEPART(weekday, @d), @d) AND ${col} < DATEADD(day, 8 - DATEPART(weekday, @d), @d)`, p: { d: data } };
    case 'mes':
      return { where: `${col} >= DATEFROMPARTS(YEAR(@d), MONTH(@d), 1) AND ${col} < DATEADD(month, 1, DATEFROMPARTS(YEAR(@d), MONTH(@d), 1))`, p: { d: data } };
    case 'apartir':
      return { where: `${col} >= @d`, p: { d: data } };
    case 'entre':
      return { where: `${col} >= @d AND ${col} < DATEADD(day, 1, @a)`, p: { d: data, a: isoDate(ate) } };
    case 'todas':
      return { where: '1=1', p: {} };
    default:
      return { where: `${col} >= @d AND ${col} < DATEADD(day, 1, @d)`, p: { d: data } };
  }
}

// ---------------------------------------------------------------- consultas de lista (arvore)

const RESERVA_SELECT = `SELECT TOP 5000 i.Id id, i.Pago pago, CONVERT(varchar(16), b.Inicio, 126) dataHora, b.Nome reserva, b.Id bateriaId,
  c.Id clienteId, c.Nome cliente, c.Documento documento, c.Telefone telefone, CONVERT(varchar(10), c.Nascimento, 126) nascimento,
  r.Nome responsavel, p.Id produtoId, p.Nome produto, p.Categoria categoria, ISNULL(i.PrecoCentavos, p.PrecoCentavos) preco, i.DescontoCentavos desconto,
  CASE WHEN i.Pago = 1 THEN i.ValorCentavos ELSE ISNULL(i.PrecoCentavos, p.PrecoCentavos) - i.DescontoCentavos END total,
  i.Observacao observacao, i.Aprovada aprovada, i.Status status, i.Origem origem, i.Kart kart, i.VendaId vendaId,
  CONVERT(varchar(16), i.TermoImpressoEm, 126) termoImpressoEm, CONVERT(varchar(16), i.CriadoEm, 126) criadoEm
  FROM dbo.Inscricao i JOIN dbo.Bateria b ON b.Id = i.BateriaId JOIN dbo.Cliente c ON c.Id = i.ClienteId
  LEFT JOIN dbo.Cliente r ON r.Id = ISNULL(i.ResponsavelId, c.ResponsavelId) LEFT JOIN dbo.Produto p ON p.Id = ISNULL(i.ProdutoId, b.ProdutoId)`;

const BATERIA_SELECT = `SELECT TOP 5000 b.Id id, CONVERT(varchar(16), b.Inicio, 126) dataHora, b.Nome nome, p.Id produtoId, p.Nome produto, p.Categoria categoria,
  p.PrecoCentavos preco, b.Vagas vagas, b.Vagas - (SELECT COUNT(*) FROM dbo.Inscricao x WHERE x.BateriaId = b.Id AND x.Status <> 'cancelada') disponiveis,
  (SELECT COUNT(*) FROM dbo.Inscricao x WHERE x.BateriaId = b.Id AND x.Status <> 'cancelada') inscritos,
  (SELECT COUNT(*) FROM dbo.Inscricao x WHERE x.BateriaId = b.Id AND x.Status <> 'cancelada' AND x.Pago = 1) pagos,
  (SELECT COUNT(*) FROM dbo.Inscricao x WHERE x.BateriaId = b.Id AND x.Status <> 'cancelada' AND x.Aprovada = 0) preReservas,
  rc.Nome responsavel, b.ResponsavelId responsavelId, b.Status status, b.AutoAtendimento autoAtendimento, t.Id tracadoId, t.Nome tracado,
  b.VoltaMinimaSeg voltaMinimaSeg, b.CodigoReserva codigoReserva, b.ReservaFechada reservaFechada, b.Observacao observacao, b.TipoKart tipoKart
  FROM dbo.Bateria b LEFT JOIN dbo.Produto p ON p.Id = b.ProdutoId LEFT JOIN dbo.Tracado t ON t.Id = b.TracadoId LEFT JOIN dbo.Cliente rc ON rc.Id = b.ResponsavelId`;

const VENDA_SELECT = `SELECT TOP 5000 v.Id id, CONVERT(varchar(16), v.CriadoEm, 126) dataHora, ISNULL(v.Codigo, CAST(v.Id AS varchar(20))) codigo, c.Nome cliente, c.Documento documento,
  u.Nome usuario, t.Nome terminal, v.BrutoCentavos bruto, v.DescontoCentavos desconto, v.AcrescimoCentavos acrescimo, v.RecebidoCentavos recebido,
  v.TrocoCentavos troco, v.EstornoCentavos estorno, v.FinalCentavos final, v.Cancelada cancelada, v.MotivoCancelamento motivo, v.Observacao observacao, v.MovimentoId movimentoId
  FROM dbo.Venda v LEFT JOIN dbo.Cliente c ON c.Id = v.ClienteId LEFT JOIN dbo.Usuario u ON u.Id = v.UsuarioId LEFT JOIN dbo.Terminal t ON t.Id = v.TerminalId`;

// ---------------------------------------------------------------- cadastros genericos

type ColType = 'text' | 'int' | 'money' | 'bool' | 'date' | 'time';
type CadDef = { table: string; cols: Record<string, [string, ColType, number?]>; order: string; required?: string[]; adminOnly?: boolean; filter?: string };

const CAD: Record<string, CadDef> = {
  produtos: {
    table: 'Produto',
    cols: {
      codigo: ['Codigo', 'text', 20], nome: ['Nome', 'text', 150], preco: ['PrecoCentavos', 'money'], categoria: ['Categoria', 'text', 40],
      classeContabil: ['ClasseContabil', 'text', 60], servicoLocacao: ['ServicoLocacao', 'bool'], publicarNuvem: ['PublicarNuvem', 'bool'],
      requerDevolucao: ['RequerDevolucao', 'bool'], ativo: ['Ativo', 'bool'],
    },
    order: 'Codigo', required: ['codigo', 'nome'],
  },
  provas: {
    table: 'ProdutoProva',
    cols: { produtoId: ['ProdutoId', 'int'], ordem: ['Ordem', 'int'], nome: ['Nome', 'text', 60], tipo: ['Tipo', 'text', 14], finalizacao: ['Finalizacao', 'text', 10], tempoMin: ['TempoMin', 'int'], voltasMax: ['VoltasMax', 'int'] },
    order: 'ProdutoId, Ordem', required: ['produtoId', 'nome'], filter: 'produtoId',
  },
  tracados: { table: 'Tracado', cols: { nome: ['Nome', 'text', 100], comprimento: ['Comprimento', 'int'], ativo: ['Ativo', 'bool'] }, order: 'Nome', required: ['nome'] },
  feriados: { table: 'Feriado', cols: { data: ['Data', 'date'], descricao: ['Descricao', 'text', 100], recorrente: ['Recorrente', 'bool'] }, order: 'Data', required: ['data', 'descricao'] },
  turnos: { table: 'Turno', cols: { descricao: ['Descricao', 'text', 60], inicio: ['Inicio', 'time'], fim: ['Fim', 'time'], ativo: ['Ativo', 'bool'] }, order: 'Descricao', required: ['descricao'] },
  terminais: { table: 'Terminal', cols: { codigo: ['Codigo', 'text', 10], nome: ['Nome', 'text', 60], ativo: ['Ativo', 'bool'] }, order: 'Nome', required: ['nome'] },
  formas: { table: 'FormaPagamento', cols: { codigo: ['Codigo', 'text', 10], nome: ['Nome', 'text', 60], tipo: ['Tipo', 'text', 12], ativo: ['Ativo', 'bool'] }, order: 'Codigo', required: ['nome'] },
  padroes: {
    table: 'PadraoReserva',
    cols: {
      nome: ['Nome', 'text', 100], produtoId: ['ProdutoId', 'int'], tracadoId: ['TracadoId', 'int'], categoria: ['Categoria', 'text', 40],
      quantidade: ['Quantidade', 'int'], primeiraHora: ['PrimeiraHora', 'time'], vagas: ['Vagas', 'int'], intervaloMin: ['IntervaloMin', 'int'],
      voltaMinimaSeg: ['VoltaMinimaSeg', 'int'], numerarNome: ['NumerarNome', 'bool'], online: ['Online', 'bool'], ativo: ['Ativo', 'bool'],
    },
    order: 'Nome', required: ['nome', 'produtoId', 'quantidade', 'primeiraHora', 'vagas'],
  },
  itensManutencao: {
    table: 'ItemManutencao', cols: { codigo: ['Codigo', 'text', 20], nome: ['Nome', 'text', 100], controlaPorTempo: ['ControlaPorTempo', 'bool'], tempoHoras: ['TempoHoras', 'int'], ativo: ['Ativo', 'bool'] },
    order: 'Nome', required: ['nome'],
  },
  usuarios: { table: 'Usuario', cols: { login: ['Login', 'text', 40], nome: ['Nome', 'text', 100], admin: ['Admin', 'bool'], ativo: ['Ativo', 'bool'] }, order: 'Nome', required: ['login', 'nome'], adminOnly: true },
};

function cadSelect(def: CadDef) {
  const cols = Object.entries(def.cols).map(([k, [c, t]]) => (t === 'date' ? `CONVERT(varchar(10), ${c}, 126) ${k}` : `${c} ${k}`));
  return `SELECT Id id, ${cols.join(', ')} FROM dbo.${def.table}`;
}

function cadValues(def: CadDef, body: Record<string, unknown>, partial: boolean) {
  const out: Record<string, unknown> = {};
  for (const [k, [c, t, max]] of Object.entries(def.cols)) {
    if (!(k in body)) {
      if (!partial && def.required?.includes(k)) throw new HttpError(400, `Preencha o campo ${k}.`);
      continue;
    }
    let v = body[k];
    if (v === '' || v === undefined) v = null;
    if (v !== null) {
      if (t === 'int') v = Math.trunc(Number(v));
      else if (t === 'money') v = cents(v);
      else if (t === 'bool') v = v === true || v === 'true' || v === 1 || v === '1' ? 1 : 0;
      else if (t === 'date') v = isoDate(v);
      else if (t === 'time') {
        if (!/^\d{2}:\d{2}$/.test(String(v))) throw new HttpError(400, `Horário inválido em ${k} (use HH:MM).`);
      } else v = String(v).trim().slice(0, max ?? 200);
      if ((t === 'int' || t === 'money') && !Number.isFinite(v as number)) throw new HttpError(400, `Valor inválido em ${k}.`);
    }
    if (v === null && def.required?.includes(k)) throw new HttpError(400, `Preencha o campo ${k}.`);
    out[c] = v;
  }
  return out;
}

async function cadRoutes(req: Req, send: Res, ent: string, id: number | null): Promise<void> {
  const def = CAD[ent];
  if (!def) throw new HttpError(404, 'Cadastro desconhecido.');
  if (def.adminOnly && !req.sessao.admin) throw new HttpError(403, 'Disponível apenas para administradores.');
  if (req.method === 'GET') {
    if (id) return send(200, await one(`${cadSelect(def)} WHERE Id = @id`, { id }));
    const f = def.filter && req.url.searchParams.get(def.filter);
    const where = f ? `WHERE ${def.cols[def.filter!][0]} = @f` : '';
    return send(200, await query(`${cadSelect(def)} ${where} ORDER BY ${def.order}`, f ? { f } : {}));
  }
  if (req.method === 'POST' || req.method === 'PUT') {
    const body = await req.body();
    const vals = cadValues(def, body, req.method === 'PUT');
    if (ent === 'usuarios') {
      const senha = String(body.senha ?? '');
      if (req.method === 'POST' && senha.length < 6) throw new HttpError(400, 'A senha precisa ter pelo menos 6 caracteres.');
      if (senha) {
        if (senha.length < 6) throw new HttpError(400, 'A senha precisa ter pelo menos 6 caracteres.');
        vals.SenhaHash = hashSenha(senha);
      }
      if (vals.Login) vals.Login = String(vals.Login).toLowerCase();
    }
    const names = Object.keys(vals);
    if (req.method === 'POST') {
      const r = await one<{ id: number }>(`INSERT INTO dbo.${def.table} (${names.join(', ')}) OUTPUT inserted.Id id VALUES (${names.map((n) => '@' + n).join(', ')})`, vals);
      return send(201, { id: r!.id });
    }
    if (!id) throw new HttpError(400, 'Registro não informado.');
    if (names.length) await query(`UPDATE dbo.${def.table} SET ${names.map((n) => `${n} = @${n}`).join(', ')} WHERE Id = @id`, { ...vals, id });
    return send(200, { id });
  }
  if (req.method === 'DELETE' && id) {
    try {
      await query(`DELETE FROM dbo.${def.table} WHERE Id = @id`, { id });
      return send(200, { ok: true });
    } catch {
      if ('ativo' in def.cols) {
        await query(`UPDATE dbo.${def.table} SET Ativo = 0 WHERE Id = @id`, { id });
        return send(200, { ok: true, desativado: true });
      }
      throw new HttpError(409, 'Registro em uso, não pode ser excluído.');
    }
  }
  throw new HttpError(405, 'Operação não suportada.');
}

// ---------------------------------------------------------------- caixa (terminal / movimento)

async function movimentoAberto(uid: number) {
  return one<{ id: number; terminalId: number; terminal: string; turno: string; abertoEm: string; inicial: number }>(
    `SELECT TOP 1 m.Id id, m.TerminalId terminalId, t.Nome terminal, tu.Descricao turno, CONVERT(varchar(16), m.AbertoEm, 126) abertoEm, m.InicialCentavos inicial
     FROM dbo.Movimento m JOIN dbo.Terminal t ON t.Id = m.TerminalId LEFT JOIN dbo.Turno tu ON tu.Id = m.TurnoId
     WHERE m.UsuarioId = @uid AND m.FechadoEm IS NULL ORDER BY m.Id DESC`,
    { uid },
  );
}

export async function sumarioMovimento(movId: number) {
  type MovimentoResumo = {
    inicial: number;
    suprimento: number;
    sangria: number;
    vendasProdutos: number;
    vendas: number;
    desconto: number;
    acrescimos: number;
    recebido: number;
    troco: number;
    cancelado: number;
    recebidoDinheiro: number;
  };
  const r = await one<MovimentoResumo>(
    `SELECT m.InicialCentavos inicial,
       ISNULL((SELECT SUM(ValorCentavos) FROM dbo.MovimentoTransacao WHERE MovimentoId = m.Id AND Tipo = 'suprimento'), 0) suprimento,
       ISNULL((SELECT SUM(ValorCentavos) FROM dbo.MovimentoTransacao WHERE MovimentoId = m.Id AND Tipo = 'sangria'), 0) sangria,
       ISNULL((SELECT SUM(vi.UnitarioCentavos * vi.Quantidade) FROM dbo.VendaItem vi JOIN dbo.Venda v ON v.Id = vi.VendaId WHERE v.MovimentoId = m.Id AND vi.InscricaoId IS NULL), 0) vendasProdutos,
       ISNULL((SELECT SUM(BrutoCentavos) FROM dbo.Venda WHERE MovimentoId = m.Id), 0) vendas,
       ISNULL((SELECT SUM(DescontoCentavos) FROM dbo.Venda WHERE MovimentoId = m.Id), 0) desconto,
       ISNULL((SELECT SUM(AcrescimoCentavos) FROM dbo.Venda WHERE MovimentoId = m.Id), 0) acrescimos,
       ISNULL((SELECT SUM(vp.ValorCentavos) FROM dbo.VendaPagamento vp JOIN dbo.Venda v ON v.Id = vp.VendaId WHERE v.MovimentoId = m.Id AND vp.Cancelado = 0), 0) recebido,
       ISNULL((SELECT SUM(TrocoCentavos) FROM dbo.Venda WHERE MovimentoId = m.Id), 0) troco,
       ISNULL((SELECT SUM(EstornoCentavos) FROM dbo.Venda WHERE MovimentoId = m.Id), 0) cancelado,
       ISNULL((SELECT SUM(vp.ValorCentavos) FROM dbo.VendaPagamento vp JOIN dbo.Venda v ON v.Id = vp.VendaId JOIN dbo.FormaPagamento f ON f.Id = vp.FormaPagamentoId
               WHERE v.MovimentoId = m.Id AND vp.Cancelado = 0 AND f.Tipo = 'dinheiro'), 0) recebidoDinheiro
     FROM dbo.Movimento m WHERE m.Id = @movId`,
    { movId },
  );
  if (!r) throw new HttpError(404, 'Movimento não encontrado.');
  const porForma = await query<{ forma: string; valor: number }>(
    `SELECT ISNULL(f.Nome, 'Outros') forma, SUM(vp.ValorCentavos) valor FROM dbo.VendaPagamento vp JOIN dbo.Venda v ON v.Id = vp.VendaId
     LEFT JOIN dbo.FormaPagamento f ON f.Id = vp.FormaPagamentoId WHERE v.MovimentoId = @movId AND vp.Cancelado = 0 GROUP BY f.Nome ORDER BY f.Nome`,
    { movId },
  );
  const final = r.inicial + r.suprimento - r.sangria + r.recebido - r.troco - r.cancelado;
  const dinheiro = r.inicial + r.suprimento - r.sangria + r.recebidoDinheiro - r.troco;
  return { ...r, final, dinheiroEmCaixa: dinheiro, porForma };
}

// ---------------------------------------------------------------- inscricao (reserva)

/** opcoes.produtoId: produto escolhido na recepção (senão o da bateria); opcoes.pago: pago antecipado (site/WhatsApp), já entra paga e aprovada. */
async function inscreverN(bateriaId: number, clienteId: number, n: number, origem: string, uid: number | null, observacao: string | null, aprovada = true, opcoes: { produtoId?: number | null; pago?: boolean } = {}) {
  return tx(async (run) => {
    const [b] = await run(
      `SELECT b.Id, b.Status, b.Vagas, b.Inicio, b.ProdutoId, p.PrecoCentavos preco,
        (SELECT COUNT(*) FROM dbo.Inscricao i WITH (UPDLOCK, HOLDLOCK) WHERE i.BateriaId = b.Id AND i.Status <> 'cancelada') ocupadas,
        CASE WHEN b.Inicio < DATEADD(minute, -30, SYSDATETIME()) THEN 1 ELSE 0 END passada
       FROM dbo.Bateria b LEFT JOIN dbo.Produto p ON p.Id = b.ProdutoId WHERE b.Id = @bateriaId`,
      { bateriaId },
    );
    if (!b) throw new HttpError(404, 'Selecione uma bateria.');
    if (b.Status === 'cancelada') throw new HttpError(409, 'Bateria excluída.');
    if (b.passada) throw new HttpError(409, 'Não é permitido reservar para baterias que já ocorreram!');
    const livres = (b.Vagas as number) - (b.ocupadas as number);
    if (livres <= 0) throw new HttpError(409, 'Não há vagas para a bateria selecionada.');
    if (n > livres) throw new HttpError(409, `Não há vagas o suficiente para a quantidade de participantes selecionada. Vagas disponíveis: ${livres}.`);
    if (n === 1) {
      const [dup] = await run(`SELECT Id FROM dbo.Inscricao WHERE BateriaId = @bateriaId AND ClienteId = @clienteId AND Status <> 'cancelada'`, { bateriaId, clienteId });
      if (dup) throw new HttpError(409, 'Já existe uma reserva em nome deste cliente.');
    }
    const [c] = await run(`SELECT Bloqueado FROM dbo.Cliente WHERE Id = @clienteId`, { clienteId });
    if (!c) throw new HttpError(404, 'Cliente não localizado.');
    if (c.Bloqueado) throw new HttpError(409, 'Cliente bloqueado.');
    let produtoId = (b.ProdutoId as number | null) ?? null;
    let preco = (b.preco as number | null) ?? null;
    if (opcoes.produtoId) {
      const [p] = await run(`SELECT Id, PrecoCentavos preco FROM dbo.Produto WHERE Id = @id`, { id: opcoes.produtoId });
      if (!p) throw new HttpError(404, 'Produto não encontrado.');
      produtoId = p.Id as number; preco = (p.preco as number | null) ?? null;
    }
    const pago = Boolean(opcoes.pago);
    const ids: number[] = [];
    for (let k = 0; k < n; k++) {
      const [row] = await run(
        `INSERT INTO dbo.Inscricao (BateriaId, ClienteId, Origem, Observacao, ProdutoId, PrecoCentavos, Aprovada, ResponsavelId, Pago, ValorCentavos, Status)
         OUTPUT inserted.Id id VALUES (@bateriaId, @clienteId, @origem, @obs, @produtoId, @preco, @aprovada, @resp, @pago, @valor, @status)`,
        {
          bateriaId, clienteId, origem, obs: observacao, produtoId, preco, aprovada: aprovada || pago ? 1 : 0, resp: n > 1 ? clienteId : null,
          pago: pago ? 1 : 0, valor: pago ? preco : null, status: pago ? 'confirmada' : 'reservada',
        },
      );
      ids.push(row.id as number);
    }
    void uid;
    return ids;
  });
}
export { inscreverN };

// ---------------------------------------------------------------- venda (checkout / receita avulsa)

type ItemIn = { produtoId?: number; inscricaoId?: number; descricao?: string; quantidade?: number; unitarioCentavos: number; descontoCentavos?: number; acrescimoCentavos?: number };

async function criarVenda(sessao: Sessao, body: Record<string, unknown>) {
  const mov = await movimentoAberto(sessao.uid);
  if (!mov) throw new HttpError(409, 'Não é possível continuar com o caixa fechado!');
  const itensIn = (Array.isArray(body.itens) ? body.itens : []) as ItemIn[];
  if (!itensIn.length) throw new HttpError(400, 'Carrinho vazio.');
  const pagamentosIn = (Array.isArray(body.pagamentos) ? body.pagamentos : []) as { formaPagamentoId: number; valorCentavos: number }[];
  const clienteId = body.clienteId ? int(body.clienteId, 'Cliente') : null;
  const voucherCodigo = str(body.voucherCodigo, 40);
  const validar = (await one<{ v: string }>(`SELECT Valor v FROM dbo.Parametro WHERE Chave = 'office.validarTotalPago'`))?.v !== 'false';

  return tx(async (run) => {
    // itens: confere reserva e produto no servidor
    const itens = [] as (Required<Omit<ItemIn, 'produtoId' | 'inscricaoId'>> & { produtoId: number | null; inscricaoId: number | null; liquido: number; voucherId?: number })[];
    for (const it of itensIn) {
      const qtd = int(it.quantidade ?? 1, 'Quantidade');
      let descricao = str(it.descricao, 200) ?? 'Item';
      let produtoId = it.produtoId ? int(it.produtoId, 'Produto') : null;
      const inscricaoId = it.inscricaoId ? int(it.inscricaoId, 'Reserva') : null;
      if (inscricaoId) {
        const [ins] = await run(
          `SELECT i.Pago, i.Status, i.ProdutoId, c.Nome, b.Nome bateria FROM dbo.Inscricao i WITH (UPDLOCK) JOIN dbo.Cliente c ON c.Id = i.ClienteId JOIN dbo.Bateria b ON b.Id = i.BateriaId WHERE i.Id = @inscricaoId`,
          { inscricaoId },
        );
        if (!ins) throw new HttpError(404, 'Reserva não encontrada.');
        if (ins.Pago) throw new HttpError(409, `A reserva de ${ins.Nome} já está paga.`);
        if (ins.Status === 'cancelada') throw new HttpError(409, `A reserva de ${ins.Nome} está cancelada.`);
        produtoId = produtoId ?? (ins.ProdutoId as number | null);
        descricao = `${ins.bateria} - ${ins.Nome}`.slice(0, 200);
      } else if (produtoId) {
        const [p] = await run(`SELECT Nome FROM dbo.Produto WHERE Id = @produtoId`, { produtoId });
        if (!p) throw new HttpError(404, 'Produto não encontrado.');
        descricao = String(p.Nome).slice(0, 200);
      }
      const unit = cents(it.unitarioCentavos, 'Preço');
      const desc = cents(it.descontoCentavos ?? 0, 'Desconto');
      const acr = cents(it.acrescimoCentavos ?? 0, 'Acréscimo');
      const liquido = unit * qtd - desc + acr;
      if (liquido < 0) throw new HttpError(400, 'Desconto maior que o valor do item.');
      itens.push({ produtoId, inscricaoId, descricao, quantidade: qtd, unitarioCentavos: unit, descontoCentavos: desc, acrescimoCentavos: acr, liquido });
    }

    // voucher
    let voucher: Record<string, unknown> | null = null;
    let voucherDesconto = 0;
    if (voucherCodigo) {
      const [v] = await run(
        `SELECT v.*, p.Ativo parceiroAtivo, fc.Ativo fidelidadeAtiva FROM dbo.Voucher v
         LEFT JOIN dbo.Parceiro p ON p.Id = v.ParceiroId LEFT JOIN dbo.FidelidadeConta fc ON fc.Id = v.FidelidadeContaId WHERE v.Codigo = @c`,
        { c: voucherCodigo },
      );
      if (!v || !v.Ativo) throw new HttpError(400, 'Voucher não encontrado.');
      if (v.ParceiroId && !v.parceiroAtivo) throw new HttpError(400, 'O parceiro vinculado ao voucher está inativo.');
      if (v.FidelidadeContaId && !v.fidelidadeAtiva) throw new HttpError(400, 'A conta de fidelidade vinculada ao voucher está inativa.');
      const [hoje] = await run(`SELECT CAST(SYSDATETIME() AS date) d`);
      if ((hoje.d as Date) < (v.InicioEm as Date) || (hoje.d as Date) > (v.FimEm as Date)) throw new HttpError(400, 'Voucher expirado.');
      const [usos] = await run(`SELECT COUNT(*) n, SUM(CASE WHEN ClienteId = @cli THEN 1 ELSE 0 END) doCliente FROM dbo.VoucherUso WHERE VoucherId = @id AND Estornado = 0`, { id: v.Id, cli: clienteId });
      if (v.UsoUnico && (usos.n as number) > 0) throw new HttpError(400, 'Voucher já utilizado.');
      if ((usos.doCliente as number) >= (v.UsoMaxCliente as number)) throw new HttpError(400, 'Limite de usos deste voucher para este cliente já atingido.');
      const totalPedido = itens.reduce((s, i) => s + i.liquido, 0);
      if (v.PedidoMinimoCentavos && totalPedido < (v.PedidoMinimoCentavos as number)) throw new HttpError(400, `Valor do pedido insuficiente. Mínimo exigido: ${brl(v.PedidoMinimoCentavos as number)}.`);
      const alvo = itens.find((i) => (!v.ProdutoId || i.produtoId === v.ProdutoId) && i.descontoCentavos === 0);
      if (!alvo) throw new HttpError(400, v.ProdutoId ? 'O produto do voucher não está na venda.' : 'Nenhum produto na venda para aplicar o voucher.');
      voucherDesconto = v.Tipo === 'percentual' ? Math.round((alvo.liquido * (v.Valor as number)) / 100) : (v.Valor as number);
      if (v.DescontoMaximoCentavos) voucherDesconto = Math.min(voucherDesconto, v.DescontoMaximoCentavos as number);
      voucherDesconto = Math.min(voucherDesconto, alvo.liquido);
      alvo.descontoCentavos += voucherDesconto;
      alvo.liquido -= voucherDesconto;
      alvo.voucherId = v.Id as number;
      voucher = v;
    }

    const bruto = itens.reduce((s, i) => s + i.unitarioCentavos * i.quantidade, 0);
    const desconto = itens.reduce((s, i) => s + i.descontoCentavos, 0);
    const acrescimo = itens.reduce((s, i) => s + i.acrescimoCentavos, 0);
    const total = bruto - desconto + acrescimo;

    let recebido = 0;
    let dinheiro = 0;
    const pagamentos = [] as { formaPagamentoId: number; valor: number }[];
    for (const pg of pagamentosIn) {
      const formaPagamentoId = int(pg.formaPagamentoId, 'Forma de pagamento');
      const valor = cents(pg.valorCentavos);
      if (!valor) continue;
      const [f] = await run(`SELECT Tipo FROM dbo.FormaPagamento WHERE Id = @formaPagamentoId AND Ativo = 1`, { formaPagamentoId });
      if (!f) throw new HttpError(400, 'Forma de pagamento inválida.');
      if (f.Tipo === 'dinheiro') dinheiro += valor;
      recebido += valor;
      pagamentos.push({ formaPagamentoId, valor });
    }
    if (validar && recebido < total) throw new HttpError(400, `Ainda faltam ser pagos ${brl(total - recebido)} para poder concluir a compra.`);
    const troco = Math.max(0, recebido - total);
    if (troco > dinheiro) throw new HttpError(400, 'Troco só pode ser dado sobre pagamento em dinheiro. Ajuste os valores.');

    const [venda] = await run(
      `INSERT INTO dbo.Venda (MovimentoId, UsuarioId, TerminalId, ClienteId, BrutoCentavos, DescontoCentavos, AcrescimoCentavos, RecebidoCentavos, TrocoCentavos, FinalCentavos, Observacao)
       OUTPUT inserted.Id id VALUES (@mov, @uid, @term, @cli, @bruto, @desc, @acr, @rec, @troco, @final, @obs)`,
      { mov: mov.id, uid: sessao.uid, term: mov.terminalId, cli: clienteId, bruto, desc: desconto, acr: acrescimo, rec: recebido, troco, final: total, obs: str(body.observacao, 1000) },
    );
    const vendaId = venda.id as number;
    await run(`UPDATE dbo.Venda SET Codigo = CAST(Id AS varchar(20)) WHERE Id = @vendaId`, { vendaId });
    let n = 1;
    for (const i of itens) {
      await run(
        `INSERT INTO dbo.VendaItem (VendaId, Item, ProdutoId, Descricao, Quantidade, UnitarioCentavos, DescontoCentavos, AcrescimoCentavos, LiquidoCentavos, InscricaoId, VoucherId)
         VALUES (@vendaId, @n, @produtoId, @descricao, @qtd, @unit, @desc, @acr, @liq, @ins, @voucherId)`,
        { vendaId, n: n++, produtoId: i.produtoId, descricao: i.descricao, qtd: i.quantidade, unit: i.unitarioCentavos, desc: i.descontoCentavos, acr: i.acrescimoCentavos, liq: i.liquido, ins: i.inscricaoId, voucherId: i.voucherId ?? null },
      );
      if (i.inscricaoId) {
        await run(
          `UPDATE dbo.Inscricao SET Pago = 1, Aprovada = 1, Status = 'confirmada', ValorCentavos = @liq, DescontoCentavos = @desc, VendaId = @vendaId, AtualizadoEm = SYSDATETIME() WHERE Id = @ins`,
          { liq: i.liquido, desc: i.descontoCentavos, vendaId, ins: i.inscricaoId },
        );
      }
    }
    for (const pg of pagamentos) {
      await run(`INSERT INTO dbo.VendaPagamento (VendaId, FormaPagamentoId, ValorCentavos) VALUES (@vendaId, @f, @v)`, { vendaId, f: pg.formaPagamentoId, v: pg.valor });
    }
    if (voucher) {
      await run(`INSERT INTO dbo.VoucherUso (VoucherId, VendaId, ClienteId, DescontoCentavos) VALUES (@v, @vendaId, @cli, @d)`, { v: voucher.Id, vendaId, cli: clienteId, d: voucherDesconto });
      if (voucher.Origem === 'parceiro' && voucher.ParceiroId) {
        const base = itens.filter((i) => i.voucherId === Number(voucher!.Id)).reduce((total, i) => total + i.liquido, 0);
        if (base > 0) {
          const [partner] = await run(`SELECT ComissaoPercentual percentual FROM dbo.Parceiro WITH (UPDLOCK, HOLDLOCK) WHERE Id = @id AND Ativo = 1`, { id: voucher.ParceiroId });
          if (partner) {
            const rate = Number(partner.percentual);
            const commission = Math.round(base * rate / 100);
            if (commission > 0) {
            const [created] = await run(
              `INSERT INTO dbo.ParceiroComissao (ParceiroId, VendaId, BaseCentavos, Percentual, ValorCentavos)
               OUTPUT inserted.Id id VALUES (@parceiroId, @vendaId, @base, @rate, @valor)`,
              { parceiroId: voucher.ParceiroId, vendaId, base, rate, valor: commission },
            );
            await run(
              `INSERT INTO dbo.ParceiroComissaoTransacao (ComissaoId, Tipo, ValorCentavos, Motivo, UsuarioId)
               VALUES (@id, 'acumulada', @valor, 'Comissão gerada pela venda', @uid)`,
              { id: created.id, valor: commission, uid: sessao.uid },
            );
            }
          }
        }
      }
    }
    return { id: vendaId, total, recebido, troco, inscricoes: itens.filter((i) => i.inscricaoId).map((i) => i.inscricaoId) };
  });
}

async function estornar(sessao: Sessao, vendaId: number, body: Record<string, unknown>) {
  const itemIds = (Array.isArray(body.itemIds) ? body.itemIds : []).map((x) => int(x, 'Item'));
  if (!itemIds.length) throw new HttpError(400, 'Selecione os itens a estornar.');
  const motivo = str(body.motivo, 400) ?? 'Estorno';
  return tx(async (run) => {
    const [v] = await run(`SELECT v.Id, v.MovimentoId, m.FechadoEm FROM dbo.Venda v LEFT JOIN dbo.Movimento m ON m.Id = v.MovimentoId WHERE v.Id = @vendaId`, { vendaId });
    if (!v) throw new HttpError(404, 'Venda não encontrada.');
    if (!v.MovimentoId || v.FechadoEm) throw new HttpError(409, 'Não é possível realizar o estorno. Movimento fechado.');
    let soma = 0;
    let estornouVoucherParceiro = false;
    for (const itemId of itemIds) {
      const [it] = await run(`SELECT Id, LiquidoCentavos, InscricaoId, VoucherId, Estornado FROM dbo.VendaItem WHERE Id = @itemId AND VendaId = @vendaId`, { itemId, vendaId });
      if (!it || it.Estornado) continue;
      soma += it.LiquidoCentavos as number;
      estornouVoucherParceiro ||= Boolean(it.VoucherId);
      await run(`UPDATE dbo.VendaItem SET Estornado = 1, EstornadoEm = SYSDATETIME(), MotivoEstorno = @motivo WHERE Id = @itemId`, { itemId, motivo });
      if (it.InscricaoId) {
        await run(`UPDATE dbo.Inscricao SET Pago = 0, Status = 'reservada', ValorCentavos = NULL, VendaId = NULL, AtualizadoEm = SYSDATETIME() WHERE Id = @i`, { i: it.InscricaoId });
      }
    }
    await run(`UPDATE dbo.VoucherUso SET Estornado = 1 WHERE VendaId = @vendaId AND EXISTS (SELECT 1 FROM dbo.VendaItem vi WHERE vi.VendaId = @vendaId AND vi.VoucherId IS NOT NULL AND vi.Estornado = 1)`, { vendaId });
    const [rest] = await run(`SELECT COUNT(*) n FROM dbo.VendaItem WHERE VendaId = @vendaId AND Estornado = 0`, { vendaId });
    await run(
      `UPDATE dbo.Venda SET EstornoCentavos = EstornoCentavos + @soma, FinalCentavos = FinalCentavos - @soma,
         Cancelada = CASE WHEN @rest = 0 THEN 1 ELSE Cancelada END, MotivoCancelamento = CASE WHEN @rest = 0 THEN @motivo ELSE MotivoCancelamento END WHERE Id = @vendaId`,
      { soma, rest: rest.n, motivo: `${motivo} (${sessao.nome})`, vendaId },
    );
    if (estornouVoucherParceiro) {
      const [commission] = await run(`SELECT Id, ValorCentavos, Estado FROM dbo.ParceiroComissao WITH (UPDLOCK, HOLDLOCK) WHERE VendaId = @vendaId`, { vendaId });
      if (commission && commission.Estado !== 'estornada') {
        await run(
          `INSERT INTO dbo.ParceiroComissaoTransacao (ComissaoId, Tipo, ValorCentavos, Motivo, UsuarioId)
           VALUES (@id, 'cancelamento_venda', -@valor, @motivo, @uid)`,
          { id: commission.Id, valor: commission.ValorCentavos, motivo: `Estorno da venda ${vendaId}: ${motivo}`.slice(0, 400), uid: sessao.uid },
        );
        await run(`UPDATE dbo.ParceiroComissao SET Estado = 'estornada', AtualizadaEm = SYSDATETIME() WHERE Id = @id`, { id: commission.Id });
      }
    }
    return { estornado: soma };
  });
}

// ---------------------------------------------------------------- roteador

export async function officeRoutes(req: Req, send: Res): Promise<boolean> {
  const { method, url, sessao } = req;
  const path = url.pathname.replace(/^\/api\/office/, '');
  let m: RegExpMatchArray | null;

  if (path === '/servicos-online' && method === 'GET') {
    send(200, await servicosOnline());
    return true;
  }

  // ---------- fidelidade
  if (path === '/fidelidade/contas' && method === 'GET') {
    const q = str(url.searchParams.get('q'), 100);
    const rows = await query(
      `SELECT TOP 2000 a.Id id, a.ClienteId clienteId, c.Nome nome, c.Documento documento, c.Email email, c.Telefone telefone,
              a.SaldoPontos saldo, a.SaldoPontos saldoCentavos, a.Ativo ativo, CONVERT(varchar(16), a.CriadoEm, 126) criadaEm,
              (SELECT COUNT(*) FROM dbo.Inscricao i WHERE i.ClienteId = a.ClienteId AND i.Pago = 1 AND i.Status <> 'cancelada') baterias,
              (SELECT COUNT(*) FROM dbo.FidelidadeTransacao ft WHERE ft.ContaId = a.Id) transacoes
       FROM dbo.FidelidadeConta a JOIN dbo.Cliente c ON c.Id = a.ClienteId
       ${q ? 'WHERE c.Nome COLLATE Latin1_General_CI_AI LIKE @q OR c.Documento LIKE @q' : ''}
       ORDER BY c.Nome, a.Id`, q ? { q: `%${q}%` } : {},
    );
    send(200, rows);
    return true;
  }
  if (path === '/fidelidade/contas' && method === 'POST') {
    const clienteId = int((await req.body()).clienteId, 'Cliente');
    let contaId: number | null = null;
    let criada = false;
    try {
      contaId = await tx(async (run) => {
        const [cliente] = await run(`SELECT Id FROM dbo.Cliente WITH (UPDLOCK, HOLDLOCK) WHERE Id = @clienteId`, { clienteId });
        if (!cliente) throw new HttpError(404, 'Cliente não encontrado.');
        const [existente] = await run(`SELECT Id id FROM dbo.FidelidadeConta WITH (UPDLOCK, HOLDLOCK) WHERE ClienteId = @clienteId`, { clienteId });
        if (existente) return Number(existente.id);
        const [novo] = await run(`INSERT INTO dbo.FidelidadeConta (ClienteId) OUTPUT inserted.Id id VALUES (@clienteId)`, { clienteId });
        criada = true;
        return Number(novo.id);
      });
    } catch (e) {
      if (!duplicateSql(e)) throw e;
      const existente = await one<{ id: number }>(`SELECT Id id FROM dbo.FidelidadeConta WHERE ClienteId = @clienteId`, { clienteId });
      if (!existente) throw e;
      contaId = existente.id;
      criada = false;
    }
    send(criada ? 201 : 200, { id: contaId, existente: !criada });
    return true;
  }
  if ((m = path.match(/^\/fidelidade\/contas\/(\d+)$/)) && method === 'GET') {
    const id = int(m[1], 'Conta');
    const account = await one(
      `SELECT a.Id id, a.ClienteId clienteId, c.Nome nome, c.Documento documento, c.Email email, c.Telefone telefone,
              a.SaldoPontos saldo, a.SaldoPontos saldoCentavos, a.Ativo ativo, CONVERT(varchar(16), a.CriadoEm, 126) criadaEm,
              (SELECT COUNT(*) FROM dbo.Inscricao i WHERE i.ClienteId = a.ClienteId AND i.Pago = 1 AND i.Status <> 'cancelada') baterias,
              (SELECT COUNT(*) FROM dbo.FidelidadeTransacao ft WHERE ft.ContaId = a.Id) transacoes
       FROM dbo.FidelidadeConta a JOIN dbo.Cliente c ON c.Id = a.ClienteId WHERE a.Id = @id`, { id },
    );
    if (!account) throw new HttpError(404, 'Conta de fidelidade não encontrada.');
    send(200, account);
    return true;
  }
  if ((m = path.match(/^\/fidelidade\/contas\/(\d+)$/)) && method === 'PUT') {
    if (!sessao.admin) throw new HttpError(403, 'Disponível apenas para administradores.');
    const id = int(m[1], 'Conta');
    const b = await req.body();
    if (!('ativo' in b)) throw new HttpError(400, 'Informe o estado ativo da conta.');
    const exists = await one<{ id: number }>(`SELECT Id id FROM dbo.FidelidadeConta WHERE Id = @id`, { id });
    if (!exists) throw new HttpError(404, 'Conta de fidelidade não encontrada.');
    const ativo = bit(b.ativo);
    await query(`UPDATE dbo.FidelidadeConta SET Ativo = @ativo, AtualizadoEm = SYSDATETIME() WHERE Id = @id`, { id, ativo });
    if (!ativo) await query(`UPDATE dbo.Voucher SET Ativo = 0 WHERE FidelidadeContaId = @id`, { id });
    send(200, { id, ativo: Boolean(ativo) });
    return true;
  }
  if ((m = path.match(/^\/fidelidade\/contas\/(\d+)\/transacoes$/)) && method === 'GET') {
    const id = int(m[1], 'Conta');
    const filtro = periodo(url, 'ft.CriadoEm');
    const conta = await one(`SELECT Id id FROM dbo.FidelidadeConta WHERE Id = @id`, { id });
    if (!conta) throw new HttpError(404, 'Conta de fidelidade não encontrada.');
    send(200, await query(
      `SELECT ft.Id id, CONVERT(varchar(16), ft.CriadoEm, 126) dataHora, c.Nome conta, ft.Tipo tipo, ft.Pontos pontos,
              ft.SaldoApos saldoApos, ft.Motivo motivo, u.Nome usuario
       FROM dbo.FidelidadeTransacao ft JOIN dbo.FidelidadeConta a ON a.Id = ft.ContaId JOIN dbo.Cliente c ON c.Id = a.ClienteId
       JOIN dbo.Usuario u ON u.Id = ft.UsuarioId WHERE ft.ContaId = @id AND ${filtro.where} ORDER BY ft.CriadoEm DESC, ft.Id DESC`,
      { ...filtro.p, id },
    ));
    return true;
  }
  if (path === '/fidelidade/transacoes' && method === 'GET') {
    const filtro = periodo(url, 'ft.CriadoEm');
    send(200, await query(
      `SELECT TOP 5000 ft.Id id, CONVERT(varchar(16), ft.CriadoEm, 126) dataHora, c.Nome conta, ft.Tipo tipo, ft.Pontos pontos,
              ft.SaldoApos saldoApos, ft.Motivo motivo, u.Nome usuario
       FROM dbo.FidelidadeTransacao ft JOIN dbo.FidelidadeConta a ON a.Id = ft.ContaId JOIN dbo.Cliente c ON c.Id = a.ClienteId
       JOIN dbo.Usuario u ON u.Id = ft.UsuarioId WHERE ${filtro.where} ORDER BY ft.CriadoEm DESC, ft.Id DESC`, filtro.p,
    ));
    return true;
  }
  if ((m = path.match(/^\/fidelidade\/contas\/(\d+)\/ajustes$/)) && method === 'POST') {
    if (!sessao.admin) throw new HttpError(403, 'Disponível apenas para administradores.');
    const id = int(m[1], 'Conta');
    const b = await req.body();
    const delta = pontos(b.pontos);
    const motivo = str(b.motivo, 400);
    if (!motivo) throw new HttpError(400, 'Informe o motivo do ajuste de pontos.');
    const key = chaveIdempotencia(b.idempotencyKey);
    const result = await tx(async (run) => {
      const [account] = await run(`SELECT Id, SaldoPontos FROM dbo.FidelidadeConta WITH (UPDLOCK, HOLDLOCK) WHERE Id = @id AND Ativo = 1`, { id });
      if (!account) throw new HttpError(404, 'Conta de fidelidade não encontrada ou inativa.');
      const [previous] = await run(`SELECT Id id, Pontos pontos, SaldoApos saldoApos, Motivo motivo FROM dbo.FidelidadeTransacao WHERE ContaId = @id AND IdempotencyKey = @key`, { id, key });
      if (previous) {
        if (Number(previous.pontos) !== delta || previous.motivo !== motivo) throw new HttpError(409, 'A chave de idempotência já foi usada para outro ajuste.');
        return { ...previous, repetido: true };
      }
      const [updated] = await run(
        `UPDATE dbo.FidelidadeConta SET SaldoPontos = SaldoPontos + @delta, AtualizadoEm = SYSDATETIME()
         OUTPUT inserted.SaldoPontos saldoApos WHERE Id = @id AND SaldoPontos + @delta >= 0`, { id, delta },
      );
      if (!updated) throw new HttpError(409, 'O ajuste deixaria o saldo de pontos abaixo de zero.');
      const [created] = await run(
        `INSERT INTO dbo.FidelidadeTransacao (ContaId, Tipo, Pontos, SaldoApos, Motivo, IdempotencyKey, UsuarioId)
         OUTPUT inserted.Id id VALUES (@id, 'ajuste', @delta, @saldo, @motivo, @key, @uid)`,
        { id, delta, saldo: updated.saldoApos, motivo, key, uid: sessao.uid },
      );
      return { id: created.id, pontos: delta, saldoApos: updated.saldoApos, repetido: false };
    });
    send(result.repetido ? 200 : 201, result);
    return true;
  }

  // ---------- parceiros e comissões
  if (path === '/parceiros' && method === 'GET') {
    const q = str(url.searchParams.get('q'), 100);
    send(200, await query(
      `SELECT TOP 2000 p.Id id, p.Nome nome, p.Documento documento, p.Contato contato, p.Telefone telefone, p.Email email,
              p.ComissaoPercentual comissaoPercentual, p.Ativo ativo, CONVERT(varchar(16), p.CriadoEm, 126) criadoEm,
              (SELECT COUNT(*) FROM dbo.ParceiroComissao pc WHERE pc.ParceiroId = p.Id) vendasIndicadas,
              (SELECT TOP 1 v.Codigo FROM dbo.Voucher v WHERE v.ParceiroId = p.Id AND v.Ativo = 1 ORDER BY v.CriadoEm DESC, v.Id DESC) voucher,
              ISNULL((SELECT SUM(CASE WHEN pc.Estado = 'pendente' THEN pc.ValorCentavos ELSE 0 END) FROM dbo.ParceiroComissao pc WHERE pc.ParceiroId = p.Id), 0) comissaoPendenteCentavos,
              ISNULL((SELECT SUM(-pt.ValorCentavos) FROM dbo.ParceiroComissaoTransacao pt JOIN dbo.ParceiroComissao pc ON pc.Id = pt.ComissaoId WHERE pc.ParceiroId = p.Id AND pt.Tipo = 'pagamento'), 0) comissaoPagaCentavos,
              ISNULL((SELECT SUM(pt.ValorCentavos) FROM dbo.ParceiroComissaoTransacao pt JOIN dbo.ParceiroComissao pc ON pc.Id = pt.ComissaoId WHERE pc.ParceiroId = p.Id), 0) comissaoSaldoCentavos
       FROM dbo.Parceiro p ${q ? 'WHERE p.Nome COLLATE Latin1_General_CI_AI LIKE @q OR p.Documento LIKE @q' : ''} ORDER BY p.Nome`,
      q ? { q: `%${q}%` } : {},
    ));
    return true;
  }
  if (path === '/parceiros' && method === 'POST') {
    if (!sessao.admin) throw new HttpError(403, 'Disponível apenas para administradores.');
    const b = await req.body();
    const nome = str(b.nome, 150);
    if (!nome) throw new HttpError(400, 'Informe o nome do parceiro.');
    const rate = percentual(b.comissaoPercentual ?? b.comissao ?? 0);
    const documento = str(b.documento, 30);
    const fields = { nome, documento: documento ? (onlyDigits(documento) || documento).slice(0, 30) : null, contato: str(b.contato, 120), telefone: str(b.telefone, 40), email: str(b.email, 200), rate };
    try {
      const created = await one<{ id: number }>(
        `INSERT INTO dbo.Parceiro (Nome, Documento, Contato, Telefone, Email, ComissaoPercentual)
         OUTPUT inserted.Id id VALUES (@nome, @documento, @contato, @telefone, @email, @rate)`, fields,
      );
      send(201, { id: created!.id });
    } catch (e) {
      if (duplicateSql(e)) throw new HttpError(409, 'Já existe um parceiro com esse documento.');
      throw e;
    }
    return true;
  }
  if ((m = path.match(/^\/parceiros\/(\d+)$/)) && method === 'GET') {
    const id = int(m[1], 'Parceiro');
    const p = await one(`SELECT Id id, Nome nome, Documento documento, Contato contato, Telefone telefone, Email email, ComissaoPercentual comissaoPercentual, Ativo ativo FROM dbo.Parceiro WHERE Id = @id`, { id });
    if (!p) throw new HttpError(404, 'Parceiro não encontrado.');
    send(200, p);
    return true;
  }
  if ((m = path.match(/^\/parceiros\/(\d+)$/)) && method === 'PUT') {
    if (!sessao.admin) throw new HttpError(403, 'Disponível apenas para administradores.');
    const id = int(m[1], 'Parceiro');
    const b = await req.body();
    const vals: Record<string, unknown> = {};
    if ('nome' in b) {
      vals.Nome = str(b.nome, 150);
      if (!vals.Nome) throw new HttpError(400, 'Informe o nome do parceiro.');
    }
    if ('documento' in b) { const d = str(b.documento, 30); vals.Documento = d ? (onlyDigits(d) || d).slice(0, 30) : null; }
    if ('contato' in b) vals.Contato = str(b.contato, 120);
    if ('telefone' in b) vals.Telefone = str(b.telefone, 40);
    if ('email' in b) vals.Email = str(b.email, 200);
    if ('comissaoPercentual' in b || 'comissao' in b) vals.ComissaoPercentual = percentual(b.comissaoPercentual ?? b.comissao);
    if ('ativo' in b) vals.Ativo = bit(b.ativo);
    if (!Object.keys(vals).length) throw new HttpError(400, 'Nenhum campo informado para alteração.');
    try {
      const changed = await query(`UPDATE dbo.Parceiro SET ${Object.keys(vals).map((c) => `${c} = @${c}`).join(', ')}, AtualizadoEm = SYSDATETIME() WHERE Id = @id`, { ...vals, id });
      const found = await one<{ id: number }>(`SELECT Id id FROM dbo.Parceiro WHERE Id = @id`, { id });
      if (!found) throw new HttpError(404, 'Parceiro não encontrado.');
      if ('Ativo' in vals && vals.Ativo === 0) await query(`UPDATE dbo.Voucher SET Ativo = 0 WHERE ParceiroId = @id`, { id });
      void changed;
    } catch (e) {
      if (e instanceof HttpError) throw e;
      if (duplicateSql(e)) throw new HttpError(409, 'Já existe um parceiro com esse documento.');
      throw e;
    }
    send(200, { id });
    return true;
  }
  if ((m = path.match(/^\/parceiros\/(\d+)$/)) && method === 'DELETE') {
    if (!sessao.admin) throw new HttpError(403, 'Disponível apenas para administradores.');
    const id = int(m[1], 'Parceiro');
    const changed = await query(`UPDATE dbo.Parceiro SET Ativo = 0, AtualizadoEm = SYSDATETIME() WHERE Id = @id`, { id });
    const found = await one<{ id: number }>(`SELECT Id id FROM dbo.Parceiro WHERE Id = @id`, { id });
    if (!found) throw new HttpError(404, 'Parceiro não encontrado.');
    await query(`UPDATE dbo.Voucher SET Ativo = 0 WHERE ParceiroId = @id`, { id });
    void changed;
    send(200, { ok: true, desativado: true });
    return true;
  }
  if (path === '/parceiros/comissoes' && method === 'GET') {
    const status = url.searchParams.get('status') || 'todas';
    if (!['todas', 'pendentes', 'pagas', 'estornadas'].includes(status)) throw new HttpError(400, 'Filtro de situação inválido.');
    const where = status === 'todas' ? '' : `WHERE pc.Estado = @estado`;
    const filtro = periodo(url, status === 'pagas' ? 'COALESCE(ultima.CriadaEm, pc.CriadaEm)' : 'pc.CriadaEm');
    const whereSql = [where.replace(/^WHERE\s*/, ''), filtro.where].filter(Boolean).join(' AND ');
    const partnerId = url.searchParams.get('parceiroId');
    const params = { ...filtro.p, ...(status === 'todas' ? {} : { estado: status === 'pagas' ? 'paga' : status === 'estornadas' ? 'estornada' : 'pendente' }), ...(partnerId ? { parceiroId: int(partnerId, 'Parceiro') } : {}) };
    send(200, await query(
      `SELECT TOP 5000 pc.Id id, pc.ParceiroId parceiroId, p.Nome parceiro, pc.VendaId vendaId,
              CONVERT(varchar(16), pc.CriadaEm, 126) data, c.Nome cliente, pc.BaseCentavos valorVendaCentavos,
              pc.Percentual percentual, pc.ValorCentavos comissaoCentavos, pc.Estado situacao,
              ISNULL((SELECT SUM(CASE WHEN t.Tipo = 'acumulada' THEN t.ValorCentavos ELSE 0 END) FROM dbo.ParceiroComissaoTransacao t WHERE t.ComissaoId = pc.Id), 0) acumuladoCentavos,
              ISNULL((SELECT -SUM(CASE WHEN t.Tipo IN ('pagamento', 'estorno_pagamento') THEN t.ValorCentavos ELSE 0 END) FROM dbo.ParceiroComissaoTransacao t WHERE t.ComissaoId = pc.Id), 0) pagoCentavos,
              ISNULL((SELECT SUM(t.ValorCentavos) FROM dbo.ParceiroComissaoTransacao t WHERE t.ComissaoId = pc.Id), 0) saldoCentavos,
              ultima.FormaPagamentoId formaPagamentoId, ultima.formaPagamento metodoPagamento, ultima.dataHora pagoEm
       FROM dbo.ParceiroComissao pc JOIN dbo.Parceiro p ON p.Id = pc.ParceiroId JOIN dbo.Venda v ON v.Id = pc.VendaId
       LEFT JOIN dbo.Cliente c ON c.Id = v.ClienteId
       OUTER APPLY (SELECT TOP 1 t.FormaPagamentoId, f.Nome formaPagamento, t.CriadaEm, CONVERT(varchar(16), t.CriadaEm, 126) dataHora
                    FROM dbo.ParceiroComissaoTransacao t LEFT JOIN dbo.FormaPagamento f ON f.Id = t.FormaPagamentoId
                    WHERE t.ComissaoId = pc.Id AND t.Tipo IN ('pagamento', 'estorno_pagamento') ORDER BY t.CriadaEm DESC, t.Id DESC) ultima
       WHERE ${whereSql}${partnerId ? ' AND pc.ParceiroId = @parceiroId' : ''} ORDER BY pc.CriadaEm DESC, pc.Id DESC`, params,
    ));
    return true;
  }
  if ((m = path.match(/^\/parceiros\/comissoes\/(\d+)\/transacoes$/)) && method === 'GET') {
    const id = int(m[1], 'Comissão');
    const found = await one<{ id: number }>(`SELECT Id id FROM dbo.ParceiroComissao WHERE Id = @id`, { id });
    if (!found) throw new HttpError(404, 'Comissão não encontrada.');
    send(200, await query(
      `SELECT t.Id id, CONVERT(varchar(16), t.CriadaEm, 126) dataHora, t.Tipo tipo, t.ValorCentavos valorCentavos,
              t.Motivo motivo, f.Nome formaPagamento, u.Nome usuario
       FROM dbo.ParceiroComissaoTransacao t LEFT JOIN dbo.FormaPagamento f ON f.Id = t.FormaPagamentoId
       LEFT JOIN dbo.Usuario u ON u.Id = t.UsuarioId WHERE t.ComissaoId = @id ORDER BY t.CriadaEm DESC, t.Id DESC`, { id },
    ));
    return true;
  }
  if ((m = path.match(/^\/parceiros\/comissoes\/(\d+)\/(pagar|estornar)$/)) && method === 'POST') {
    if (!sessao.admin) throw new HttpError(403, 'Disponível apenas para administradores.');
    const id = int(m[1], 'Comissão');
    const action = m[2];
    const b = await req.body();
    const key = chaveIdempotencia(b.idempotencyKey);
    const formaPagamentoId = int(b.formaPagamentoId, 'Forma de pagamento');
    const forma = await one<{ id: number }>(`SELECT Id id FROM dbo.FormaPagamento WHERE Id = @id AND Ativo = 1`, { id: formaPagamentoId });
    if (!forma) throw new HttpError(400, 'Forma de pagamento inválida.');
    const motivo = action === 'estornar' ? str(b.motivo, 400) : 'Pagamento de comissão';
    if (!motivo) throw new HttpError(400, 'Informe o motivo do estorno da comissão.');
    const result = await tx(async (run) => {
      const [comissao] = await run(`SELECT Id, ValorCentavos, Estado FROM dbo.ParceiroComissao WITH (UPDLOCK, HOLDLOCK) WHERE Id = @id`, { id });
      if (!comissao) throw new HttpError(404, 'Comissão não encontrada.');
      const expectedType = action === 'pagar' ? 'pagamento' : 'estorno_pagamento';
      const [previous] = await run(`SELECT Id id, Tipo tipo, Motivo motivo, FormaPagamentoId formaPagamentoId FROM dbo.ParceiroComissaoTransacao WHERE ComissaoId = @id AND IdempotencyKey = @key`, { id, key });
      if (previous) {
        if (previous.tipo !== expectedType || previous.motivo !== motivo || Number(previous.formaPagamentoId) !== formaPagamentoId) throw new HttpError(409, 'A chave de idempotência já foi usada para outra ação.');
        return { id, estado: comissao.Estado, repetido: true };
      }
      if (action === 'pagar' && comissao.Estado !== 'pendente') throw new HttpError(409, 'Somente comissões pendentes podem ser pagas.');
      if (action === 'estornar' && comissao.Estado !== 'paga') throw new HttpError(409, 'Somente pagamentos realizados podem ser estornados.');
      const tipo = expectedType;
      const valor = action === 'pagar' ? -Number(comissao.ValorCentavos) : Number(comissao.ValorCentavos);
      await run(
        `INSERT INTO dbo.ParceiroComissaoTransacao (ComissaoId, Tipo, ValorCentavos, Motivo, IdempotencyKey, FormaPagamentoId, UsuarioId)
         VALUES (@id, @tipo, @valor, @motivo, @key, @formaPagamentoId, @uid)`, { id, tipo, valor, motivo, key, formaPagamentoId, uid: sessao.uid },
      );
      const estado = action === 'pagar' ? 'paga' : 'pendente';
      await run(`UPDATE dbo.ParceiroComissao SET Estado = @estado, AtualizadaEm = SYSDATETIME() WHERE Id = @id`, { id, estado });
      return { id, estado, repetido: false };
    });
    send(result.repetido ? 200 : 201, result);
    return true;
  }

  // ---------- listas da arvore
  if (path === '/reservas' && method === 'GET') {
    const st = url.searchParams.get('status') || 'todas';
    const where = ["b.Status <> 'cancelada'"];
    if (st === 'aprovar') where.push("i.Aprovada = 0 AND i.Status <> 'cancelada'");
    else if (st === 'aprovadas') where.push("i.Aprovada = 1 AND i.Status <> 'cancelada'");
    else if (st === 'pendentes') where.push("i.Aprovada = 1 AND i.Pago = 0 AND i.Status <> 'cancelada'");
    else if (st === 'canceladas') where.push("i.Status = 'cancelada'");
    const bat = url.searchParams.get('bateriaId');
    let p: Record<string, unknown> = {};
    if (bat) {
      where.push('i.BateriaId = @bat');
      p.bat = int(bat, 'Bateria');
    } else {
      const per = periodo(url, 'b.Inicio');
      where.push(per.where);
      p = per.p;
    }
    send(200, await query(`${RESERVA_SELECT} WHERE ${where.join(' AND ')} ORDER BY b.Inicio, i.Id`, p));
    return true;
  }
  if (path === '/baterias' && method === 'GET') {
    const st = url.searchParams.get('status') || 'abertas';
    const where = ["b.Status <> 'cancelada'"];
    if (st === 'abertas') where.push("b.Status = 'aberta'");
    else if (st === 'fechadas') where.push("b.Status = 'fechada'");
    const per = periodo(url, 'b.Inicio');
    where.push(per.where);
    send(200, await query(`${BATERIA_SELECT} WHERE ${where.join(' AND ')} ORDER BY b.Inicio`, per.p));
    return true;
  }
  if (path === '/vendas' && method === 'GET') {
    const st = url.searchParams.get('status') || 'liquidadas';
    const where: string[] = [];
    if (st === 'liquidadas') where.push('v.Cancelada = 0');
    else if (st === 'canceladas') where.push('(v.Cancelada = 1 OR v.EstornoCentavos > 0)');
    const per = periodo(url, 'v.CriadoEm');
    where.push(per.where);
    send(200, await query(`${VENDA_SELECT} WHERE ${where.join(' AND ')} ORDER BY v.CriadoEm DESC`, per.p));
    return true;
  }
  if ((m = path.match(/^\/vendas\/(\d+)$/)) && method === 'GET') {
    const id = Number(m[1]);
    const venda = await one(`${VENDA_SELECT} WHERE v.Id = @id`, { id });
    if (!venda) throw new HttpError(404, 'Venda não encontrada.');
    const itens = await query(
      `SELECT Id id, Item item, Descricao descricao, Quantidade quantidade, UnitarioCentavos unitario, DescontoCentavos desconto, AcrescimoCentavos acrescimo,
              LiquidoCentavos liquido, Estornado estornado, InscricaoId inscricaoId, MotivoEstorno motivo FROM dbo.VendaItem WHERE VendaId = @id ORDER BY Item`,
      { id },
    );
    const pagamentos = await query(
      `SELECT ISNULL(f.Nome, 'Outros') forma, vp.ValorCentavos valor, vp.Cancelado cancelado FROM dbo.VendaPagamento vp LEFT JOIN dbo.FormaPagamento f ON f.Id = vp.FormaPagamentoId WHERE vp.VendaId = @id`,
      { id },
    );
    send(200, { ...venda, itens, pagamentos });
    return true;
  }
  if (path === '/manutencoes' && method === 'GET') {
    const st = url.searchParams.get('status') || 'arealizar';
    const where = st === 'arealizar' ? 'WHERE m.Realizada = 0' : st === 'realizadas' ? 'WHERE m.Realizada = 1' : '';
    send(
      200,
      await query(
        `SELECT m.Id id, m.Kart kart, m.Categoria categoria, it.Nome item, m.MinutosUso minutosUso, it.TempoHoras limiteHoras,
                CONVERT(varchar(16), m.UltimaManutencao, 126) ultimaManutencao, m.Realizada realizada, CONVERT(varchar(16), m.Data, 126) data
         FROM dbo.Manutencao m LEFT JOIN dbo.ItemManutencao it ON it.Id = m.ItemId ${where} ORDER BY TRY_CAST(m.Kart AS int), m.Kart`,
      ),
    );
    return true;
  }
  if (path === '/manutencoes/marcar' && method === 'POST') {
    const b = await req.body();
    const ids = (Array.isArray(b.ids) ? b.ids : []).map((x) => int(x, 'Registro'));
    const realizada = b.realizada ? 1 : 0;
    for (const id of ids) {
      await query(
        `UPDATE dbo.Manutencao SET Realizada = @r, UltimaManutencao = CASE WHEN @r = 1 THEN SYSDATETIME() ELSE UltimaManutencao END,
           MinutosUso = CASE WHEN @r = 1 THEN 0 ELSE MinutosUso END, Data = SYSDATETIME() WHERE Id = @id`,
        { r: realizada, id },
      );
    }
    send(200, { ok: true });
    return true;
  }
  if (path === '/vouchers' && method === 'GET') {
    send(
      200,
      await query(
        `SELECT v.Id id, v.Codigo codigo, v.Origem origem, v.Referencia referencia, v.ParceiroId parceiroId, ppar.Nome parceiro,
                v.FidelidadeContaId fidelidadeContaId, c.Nome conta, v.Tipo tipo, v.Valor valor, CONVERT(varchar(10), v.InicioEm, 126) inicio,
                CONVERT(varchar(10), v.FimEm, 126) fim, p.Nome produto, v.UsoMaxCliente usoMaxCliente, v.UsoUnico usoUnico, v.PedidoMinimoCentavos pedidoMinimo,
                v.DescontoMaximoCentavos descontoMaximo, v.Ativo ativo, (SELECT COUNT(*) FROM dbo.VoucherUso u WHERE u.VoucherId = v.Id AND u.Estornado = 0) usos
         FROM dbo.Voucher v LEFT JOIN dbo.Produto p ON p.Id = v.ProdutoId LEFT JOIN dbo.Parceiro ppar ON ppar.Id = v.ParceiroId
         LEFT JOIN dbo.FidelidadeConta fc ON fc.Id = v.FidelidadeContaId LEFT JOIN dbo.Cliente c ON c.Id = fc.ClienteId ORDER BY v.Id DESC`,
      ),
    );
    return true;
  }
  if (path === '/vouchers/uso' && method === 'GET') {
    send(
      200,
      await query(
        `SELECT u.Id id, v.Codigo voucher, c.Nome cliente, u.DescontoCentavos desconto, u.VendaId vendaId, CONVERT(varchar(16), u.CriadoEm, 126) dataHora, u.Estornado estornado
         FROM dbo.VoucherUso u JOIN dbo.Voucher v ON v.Id = u.VoucherId LEFT JOIN dbo.Cliente c ON c.Id = u.ClienteId ORDER BY u.Id DESC`,
      ),
    );
    return true;
  }
  if ((m = path.match(/^\/vouchers\/(\d+)$/)) && method === 'GET') {
    const id = int(m[1], 'Voucher');
    const v = await one(
      `SELECT v.Id id, v.Codigo codigo, v.Origem origem, v.Referencia referencia, v.ParceiroId parceiroId, v.FidelidadeContaId fidelidadeContaId,
              v.Tipo tipo, v.Valor valor, CONVERT(varchar(10), v.InicioEm, 126) inicio, CONVERT(varchar(10), v.FimEm, 126) fim,
              v.ProdutoId produtoId, v.UsoMaxCliente usoMaxCliente, v.UsoUnico usoUnico, v.PedidoMinimoCentavos pedidoMinimo,
              v.DescontoMaximoCentavos descontoMaximo, v.Ativo ativo,
              (SELECT COUNT(*) FROM dbo.VoucherUso u WHERE u.VoucherId = v.Id AND u.Estornado = 0) usos
       FROM dbo.Voucher v WHERE v.Id = @id`, { id },
    );
    if (!v) throw new HttpError(404, 'Voucher não encontrado.');
    send(200, v);
    return true;
  }
  if (path === '/vouchers' && method === 'POST') {
    const b = await req.body();
    const codigo = (str(b.codigo, 40) ?? '').toUpperCase();
    if (!codigo) throw new HttpError(400, 'Informe ou gere o código.');
    const origem = ['fidelidade', 'parceiro'].includes(String(b.origem)) ? String(b.origem) : 'manual';
    const links = await voucherLinks(origem, b);
    const tipo = b.tipo === 'valor' ? 'valor' : 'percentual';
    const valor = tipo === 'valor' ? cents(b.valor) : int(b.valor, 'Valor');
    if (tipo === 'percentual' && valor > 100) throw new HttpError(400, 'Percentual acima de 100.');
    const inicio = isoDate(b.inicio);
    const fim = isoDate(b.fim);
    if (inicio > fim) throw new HttpError(400, 'A data final deve ser igual ou posterior à data inicial.');
    const r = await one<{ id: number }>(
      `INSERT INTO dbo.Voucher (Codigo, Origem, Referencia, ParceiroId, FidelidadeContaId, Tipo, Valor, InicioEm, FimEm, ProdutoId, UsoMaxCliente, UsoUnico, PedidoMinimoCentavos, DescontoMaximoCentavos)
       OUTPUT inserted.Id id VALUES (@codigo, @origem, @ref, @parceiroId, @fidelidadeContaId, @tipo, @valor, @ini, @fim, @prod, @usoMax, @unico, @min, @max)`,
      {
        codigo, origem, ref: links.referencia, parceiroId: links.parceiroId, fidelidadeContaId: links.fidelidadeContaId, tipo, valor,
        ini: inicio, fim, prod: b.produtoId ? int(b.produtoId, 'Produto') : null, usoMax: int(b.usoMaxCliente ?? 1, 'Uso máx/cliente'),
        unico: b.usoUnico ? 1 : 0, min: b.pedidoMinimo ? cents(b.pedidoMinimo) : null, max: b.descontoMaximo ? cents(b.descontoMaximo) : null,
      },
    ).catch((e: Error) => {
      if (duplicateSql(e)) throw new HttpError(409, 'Já existe um voucher com esse código.');
      throw e;
    });
    send(201, r);
    return true;
  }
  if ((m = path.match(/^\/vouchers\/(\d+)$/)) && method === 'PUT') {
    const id = int(m[1], 'Voucher');
    const b = await req.body();
    const current = await one<Record<string, unknown>>(
      `SELECT Id, Origem, Referencia, ParceiroId, FidelidadeContaId, Tipo, Valor,
              CONVERT(varchar(10), InicioEm, 126) InicioEm, CONVERT(varchar(10), FimEm, 126) FimEm
       FROM dbo.Voucher WHERE Id = @id`, { id },
    );
    if (!current) throw new HttpError(404, 'Voucher não encontrado.');
    const origem = 'origem' in b ? (['fidelidade', 'parceiro'].includes(String(b.origem)) ? String(b.origem) : 'manual') : String(current.Origem);
    const links = await voucherLinks(origem, { ...b, referencia: 'referencia' in b ? b.referencia : current.Referencia },
      { parceiroId: Number(current.ParceiroId) || null, fidelidadeContaId: Number(current.FidelidadeContaId) || null });
    const vals: Record<string, unknown> = { Origem: origem, Referencia: links.referencia, ParceiroId: links.parceiroId, FidelidadeContaId: links.fidelidadeContaId };
    if ('codigo' in b) { const codigo = str(b.codigo, 40); if (!codigo) throw new HttpError(400, 'Informe o código.'); vals.Codigo = codigo.toUpperCase(); }
    if ('tipo' in b) vals.Tipo = b.tipo === 'valor' ? 'valor' : 'percentual';
    if ('valor' in b || 'tipo' in b) {
      const tipo = String(vals.Tipo ?? current.Tipo);
      const valor = tipo === 'valor' ? cents(b.valor ?? current.Valor) : int(b.valor ?? current.Valor, 'Valor');
      if (tipo === 'percentual' && valor > 100) throw new HttpError(400, 'Percentual acima de 100.');
      vals.Valor = valor;
    }
    if ('inicio' in b) vals.InicioEm = isoDate(b.inicio);
    if ('fim' in b) vals.FimEm = isoDate(b.fim);
    if ('produtoId' in b) vals.ProdutoId = b.produtoId ? int(b.produtoId, 'Produto') : null;
    if ('usoMaxCliente' in b) vals.UsoMaxCliente = int(b.usoMaxCliente, 'Uso máx/cliente');
    if ('usoUnico' in b) vals.UsoUnico = bit(b.usoUnico);
    if ('pedidoMinimo' in b) vals.PedidoMinimoCentavos = b.pedidoMinimo ? cents(b.pedidoMinimo) : null;
    if ('descontoMaximo' in b) vals.DescontoMaximoCentavos = b.descontoMaximo ? cents(b.descontoMaximo) : null;
    if ('ativo' in b) vals.Ativo = bit(b.ativo);
    const inicio = String(vals.InicioEm ?? current.InicioEm);
    const fim = String(vals.FimEm ?? current.FimEm);
    if (inicio > fim) throw new HttpError(400, 'A data final deve ser igual ou posterior à data inicial.');
    try {
      await query(`UPDATE dbo.Voucher SET ${Object.keys(vals).map((c) => `${c} = @${c}`).join(', ')} WHERE Id = @id`, { ...vals, id });
    } catch (e) {
      if (duplicateSql(e)) throw new HttpError(409, 'Já existe um voucher com esse código.');
      throw e;
    }
    send(200, { id, ok: true });
    return true;
  }
  if ((m = path.match(/^\/vouchers\/(\d+)$/)) && method === 'DELETE') {
    const id = int(m[1], 'Voucher');
    const exists = await one<{ id: number }>(`SELECT Id id FROM dbo.Voucher WHERE Id = @id`, { id });
    if (!exists) throw new HttpError(404, 'Voucher não encontrado.');
    await query(`UPDATE dbo.Voucher SET Ativo = 0 WHERE Id = @id`, { id });
    send(200, { id, ok: true, desativado: true });
    return true;
  }
  if (path === '/vouchers/validar' && method === 'GET') {
    const v = await one<Record<string, unknown>>(
      `SELECT v.*, p.Nome produto FROM dbo.Voucher v LEFT JOIN dbo.Produto p ON p.Id = v.ProdutoId
       LEFT JOIN dbo.Parceiro pr ON pr.Id = v.ParceiroId LEFT JOIN dbo.FidelidadeConta fc ON fc.Id = v.FidelidadeContaId
       WHERE v.Codigo = @c AND v.Ativo = 1 AND CAST(SYSDATETIME() AS date) BETWEEN v.InicioEm AND v.FimEm
         AND (v.ParceiroId IS NULL OR pr.Ativo = 1) AND (v.FidelidadeContaId IS NULL OR fc.Ativo = 1)`,
      { c: (url.searchParams.get('codigo') || '').toUpperCase() },
    );
    if (!v) throw new HttpError(404, 'Voucher não encontrado ou expirado.');
    send(200, { codigo: v.Codigo, tipo: v.Tipo, valor: v.Valor, produtoId: v.ProdutoId, produto: v.produto, descontoMaximo: v.DescontoMaximoCentavos, pedidoMinimo: v.PedidoMinimoCentavos });
    return true;
  }

  // ---------- baterias: acoes
  if (path === '/baterias' && method === 'POST') {
    const b = await req.body();
    const nome = str(b.nome, 100);
    if (!nome) throw new HttpError(400, 'Insira um nome para a reserva.');
    const inicio = localDateTime(b.inicio);
    const vagas = int(b.vagas, 'Quantidade máxima de competidores');
    const produtoId = int(b.produtoId, 'Produto');
    const exists = await one(`SELECT 1 x FROM dbo.Bateria WHERE Inicio = @inicio AND Status <> 'cancelada' AND ProdutoId = @produtoId`, { inicio, produtoId });
    if (exists) throw new HttpError(409, 'Já há uma reserva agendada para a data selecionada.');
    const cat = await one<{ c: string }>(`SELECT Categoria c FROM dbo.Produto WHERE Id = @produtoId`, { produtoId });
    const r = await one<{ id: number }>(
      `INSERT INTO dbo.Bateria (Inicio, Nome, TipoKart, Vagas, ProdutoId, TracadoId, VoltaMinimaSeg, ResponsavelId, CodigoReserva, ReservaFechada, AutoAtendimento, Observacao)
       OUTPUT inserted.Id id VALUES (@inicio, @nome, @tipo, @vagas, @produtoId, @tracadoId, @volta, @resp, @codigo, @fechada, @aa, @obs)`,
      {
        inicio, nome, tipo: cat?.c === 'Super Kart' ? 'super' : 'light', vagas, produtoId, tracadoId: b.tracadoId ? int(b.tracadoId, 'Traçado') : null,
        volta: Number(b.voltaMinimaSeg ?? 5) || 0, resp: b.responsavelId ? int(b.responsavelId, 'Responsável') : null, codigo: str(b.codigoReserva, 20),
        fechada: b.reservaFechada ? 1 : 0, aa: b.autoAtendimento === false ? 0 : 1, obs: str(b.observacao, 400),
      },
    );
    send(201, r);
    return true;
  }
  if (path === '/baterias/gerar' && method === 'POST') {
    // "Gerar Reservas do Mes": aplica um padrao de reserva nos dias da semana escolhidos, pulando feriados
    const b = await req.body();
    const padrao = await one<Record<string, unknown>>(`SELECT pr.*, p.Categoria cat FROM dbo.PadraoReserva pr LEFT JOIN dbo.Produto p ON p.Id = pr.ProdutoId WHERE pr.Id = @id`, { id: int(b.padraoId, 'Padrão') });
    if (!padrao) throw new HttpError(400, 'Selecione uma configuração padrão antes de criar as reservas.');
    const de = new Date(isoDate(b.de) + 'T12:00:00');
    const ate = new Date(isoDate(b.ate) + 'T12:00:00');
    const dias = (Array.isArray(b.diasSemana) ? b.diasSemana : []).map(Number);
    if (!dias.length) throw new HttpError(400, 'Selecione pelo menos um dia da semana antes de criar as reservas.');
    const feriados = new Set((await query<{ d: string; r: boolean }>(`SELECT CONVERT(varchar(10), Data, 126) d, Recorrente r FROM dbo.Feriado`)).flatMap((f) => [f.d, f.r ? f.d.slice(5) : '']));
    const [h0, m0] = String(padrao.PrimeiraHora).split(':').map(Number);
    let criadas = 0;
    for (let d = new Date(de); d <= ate; d.setDate(d.getDate() + 1)) {
      if (!dias.includes(d.getDay())) continue;
      const data = d.toISOString().slice(0, 10);
      if (feriados.has(data) || feriados.has(data.slice(5))) continue;
      for (let k = 0; k < (padrao.Quantidade as number); k++) {
        const t = h0 * 60 + m0 + k * (padrao.IntervaloMin as number);
        if (t >= 24 * 60) break;
        const hhmm = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
        const inicio = `${data}T${hhmm}:00`;
        const exists = await one(`SELECT 1 x FROM dbo.Bateria WHERE Inicio = @inicio AND ProdutoId = @p AND Status <> 'cancelada'`, { inicio, p: padrao.ProdutoId });
        if (exists) continue;
        await query(
          `INSERT INTO dbo.Bateria (Inicio, Nome, TipoKart, Vagas, ProdutoId, TracadoId, VoltaMinimaSeg, AutoAtendimento) VALUES (@inicio, @nome, @tipo, @vagas, @p, @t, @volta, @aa)`,
          {
            inicio, nome: padrao.NumerarNome ? `${padrao.Nome} ${k + 1}` : `BATERIA ${hhmm}`, tipo: padrao.cat === 'Super Kart' ? 'super' : 'light', vagas: padrao.Vagas,
            p: padrao.ProdutoId, t: padrao.TracadoId, volta: padrao.VoltaMinimaSeg, aa: padrao.Online ? 1 : 0,
          },
        );
        criadas++;
      }
    }
    send(201, { criadas });
    return true;
  }
  if ((m = path.match(/^\/baterias\/(\d+)$/)) && method === 'PUT') {
    const id = Number(m[1]);
    const b = await req.body();
    const atual = await one<Record<string, unknown>>(
      `SELECT CONVERT(varchar(10), Inicio, 126) data, (SELECT COUNT(*) FROM dbo.Inscricao WHERE BateriaId = @id AND Status <> 'cancelada') n,
              (SELECT COUNT(*) FROM dbo.Inscricao WHERE BateriaId = @id AND Pago = 1 AND Status <> 'cancelada') pagas FROM dbo.Bateria WHERE Id = @id`,
      { id },
    );
    if (!atual) throw new HttpError(404, 'Bateria não encontrada.');
    const inicio = localDateTime(b.inicio);
    if ((atual.pagas as number) > 0 && inicio.slice(0, 10) !== atual.data) throw new HttpError(409, 'Como há reservas pagas, não é possível alterar a data, apenas o horário.');
    const vagas = int(b.vagas, 'Vagas');
    if (vagas < (atual.n as number)) throw new HttpError(409, `O máximo de competidores deve ser maior ou igual ao número de reservas. Número de reservas: ${atual.n}.`);
    const produtoId = int(b.produtoId, 'Produto');
    const cat = await one<{ c: string }>(`SELECT Categoria c FROM dbo.Produto WHERE Id = @produtoId`, { produtoId });
    await query(
      `UPDATE dbo.Bateria SET Inicio = @inicio, Nome = @nome, Vagas = @vagas, ProdutoId = @produtoId, TipoKart = @tipo, TracadoId = @tracadoId, VoltaMinimaSeg = @volta,
         ResponsavelId = @resp, CodigoReserva = @codigo, ReservaFechada = @fechada, AutoAtendimento = @aa, Observacao = @obs WHERE Id = @id`,
      {
        id, inicio, nome: str(b.nome, 100) ?? 'BATERIA', vagas, produtoId, tipo: cat?.c === 'Super Kart' ? 'super' : 'light', tracadoId: b.tracadoId ? int(b.tracadoId, 'Traçado') : null,
        volta: Number(b.voltaMinimaSeg ?? 5) || 0, resp: b.responsavelId ? int(b.responsavelId, 'Responsável') : null, codigo: str(b.codigoReserva, 20),
        fechada: b.reservaFechada ? 1 : 0, aa: b.autoAtendimento ? 1 : 0, obs: str(b.observacao, 400),
      },
    );
    send(200, { ok: true });
    return true;
  }
  if ((m = path.match(/^\/baterias\/(\d+)\/status$/)) && method === 'POST') {
    const b = await req.body();
    const status = b.status === 'fechada' ? 'fechada' : 'aberta';
    await query(`UPDATE dbo.Bateria SET Status = @status WHERE Id = @id AND Status <> 'cancelada'`, { status, id: Number(m[1]) });
    send(200, { ok: true });
    return true;
  }
  if ((m = path.match(/^\/baterias\/(\d+)$/)) && method === 'DELETE') {
    const id = Number(m[1]);
    const pagas = await one<{ n: number }>(`SELECT COUNT(*) n FROM dbo.Inscricao WHERE BateriaId = @id AND Pago = 1 AND Status <> 'cancelada'`, { id });
    if (pagas!.n > 0) throw new HttpError(409, 'Não é permitido excluir reservas pagas!');
    await tx(async (run) => {
      await run(`UPDATE dbo.Inscricao SET Status = 'cancelada', AtualizadoEm = SYSDATETIME() WHERE BateriaId = @id AND Status <> 'cancelada'`, { id });
      await run(`UPDATE dbo.Bateria SET Status = 'cancelada' WHERE Id = @id`, { id });
    });
    send(200, { ok: true });
    return true;
  }
  if ((m = path.match(/^\/baterias\/(\d+)\/incluir$/)) && method === 'POST') {
    const b = await req.body();
    const n = int(b.participantes ?? 1, "Campo 'PARTICIPANTES'");
    const ids = await inscreverN(Number(m[1]), int(b.clienteId, 'Cliente'), n, 'recepcao', sessao.uid, str(b.observacao, 400), true, {
      produtoId: b.produtoId ? int(b.produtoId, 'Produto') : null,
      pago: b.pagoAntecipado === true,
    });
    send(201, { ids, mensagem: n > 1 ? 'Vagas reservadas com sucesso!' : 'Vaga reservada com sucesso!' });
    return true;
  }
  if ((m = path.match(/^\/baterias\/(\d+)\/programa$/)) && method === 'GET') {
    send(200, await query(`SELECT pp.Ordem ordem, pp.Nome nome, pp.Tipo tipo, pp.Finalizacao finalizacao, pp.TempoMin tempoMin, pp.VoltasMax voltasMax
      FROM dbo.ProdutoProva pp JOIN dbo.Bateria b ON b.ProdutoId = pp.ProdutoId WHERE b.Id = @id ORDER BY pp.Ordem`, { id: Number(m[1]) }));
    return true;
  }
  if (path === '/agenda' && method === 'GET') {
    const mes = String(url.searchParams.get('mes') ?? '');
    if (!/^\d{4}-\d{2}$/.test(mes)) throw new HttpError(400, 'Mês inválido.');
    send(
      200,
      await query(
        `SELECT CONVERT(varchar(10), b.Inicio, 126) dia, COUNT(*) baterias, SUM(b.Vagas) vagas, SUM(ISNULL(r.n, 0)) reservas
         FROM dbo.Bateria b
         LEFT JOIN (SELECT BateriaId, COUNT(*) n FROM dbo.Inscricao WHERE Status <> 'cancelada' GROUP BY BateriaId) r ON r.BateriaId = b.Id
         WHERE b.Status <> 'cancelada' AND b.Inicio >= @d AND b.Inicio < DATEADD(month, 1, @d) GROUP BY CONVERT(varchar(10), b.Inicio, 126) ORDER BY 1`,
        { d: `${mes}-01` },
      ),
    );
    return true;
  }

  // ---------- reservas: acoes
  if ((m = path.match(/^\/reservas\/(\d+)$/)) && method === 'PUT') {
    const id = Number(m[1]);
    const b = await req.body();
    const sets: string[] = [];
    const p: Record<string, unknown> = { id };
    if (b.produtoId !== undefined) {
      const prod = await one<{ preco: number }>(`SELECT PrecoCentavos preco FROM dbo.Produto WHERE Id = @pid`, { pid: int(b.produtoId, 'Produto') });
      if (!prod) throw new HttpError(404, 'Produto não encontrado.');
      sets.push('ProdutoId = @pid', 'PrecoCentavos = CASE WHEN Pago = 1 THEN PrecoCentavos ELSE @preco END');
      p.pid = int(b.produtoId, 'Produto');
      p.preco = prod.preco;
    }
    if (b.observacao !== undefined) {
      sets.push('Observacao = @obs');
      p.obs = str(b.observacao, 400);
    }
    if (b.kart !== undefined) {
      sets.push('Kart = @kart');
      p.kart = str(b.kart, 10);
    }
    if (!sets.length) throw new HttpError(400, 'Nada para alterar.');
    await query(`UPDATE dbo.Inscricao SET ${sets.join(', ')}, AtualizadoEm = SYSDATETIME() WHERE Id = @id`, p);
    send(200, { ok: true });
    return true;
  }
  if ((m = path.match(/^\/reservas\/(\d+)\/alterar-cliente$/)) && method === 'POST') {
    const id = Number(m[1]);
    const b = await req.body();
    const clienteId = int(b.clienteId, 'Cliente');
    const r = await one<{ BateriaId: number }>(`SELECT BateriaId FROM dbo.Inscricao WHERE Id = @id`, { id });
    if (!r) throw new HttpError(404, 'Reserva não encontrada.');
    const dup = await one(`SELECT 1 x FROM dbo.Inscricao WHERE BateriaId = @b AND ClienteId = @c AND Status <> 'cancelada' AND Id <> @id`, { b: r.BateriaId, c: clienteId, id });
    if (dup) throw new HttpError(409, 'Já existe uma reserva em nome deste cliente.');
    await query(`UPDATE dbo.Inscricao SET ClienteId = @c, TermoImpressoEm = NULL, AtualizadoEm = SYSDATETIME() WHERE Id = @id`, { c: clienteId, id });
    send(200, { mensagem: 'Cliente alterado com sucesso!' });
    return true;
  }
  if ((m = path.match(/^\/reservas\/(\d+)\/mover$/)) && method === 'POST') {
    const id = Number(m[1]);
    const destino = int((await req.body()).bateriaId, 'Bateria');
    await tx(async (run) => {
      const [r] = await run(
        `SELECT i.ClienteId, i.BateriaId, i.Pago, i.Status, ISNULL(i.PrecoCentavos, po.PrecoCentavos) preco FROM dbo.Inscricao i WITH (UPDLOCK, HOLDLOCK) JOIN dbo.Bateria b ON b.Id = i.BateriaId
         LEFT JOIN dbo.Produto po ON po.Id = b.ProdutoId WHERE i.Id = @id`,
        { id },
      );
      if (!r) throw new HttpError(404, 'Reserva não encontrada.');
      if (r.Status === 'cancelada') throw new HttpError(409, 'Cannot move a cancelled reservation.');
      if (Number(r.BateriaId) === destino) return;
      const [d] = await run(
        `SELECT b.Status, b.Vagas, p.PrecoCentavos preco, (SELECT COUNT(*) FROM dbo.Inscricao x WITH (UPDLOCK, HOLDLOCK) WHERE x.BateriaId = b.Id AND x.Status <> 'cancelada') ocupadas
         FROM dbo.Bateria b WITH (UPDLOCK, HOLDLOCK) LEFT JOIN dbo.Produto p ON p.Id = b.ProdutoId WHERE b.Id = @destino`,
        { destino },
      );
      if (!d || d.Status === 'cancelada') throw new HttpError(404, 'Bateria destino não encontrada.');
      if (r.Pago && d.preco !== r.preco) throw new HttpError(409, 'O preço das baterias deve ser igual.');
      if ((d.ocupadas as number) >= (d.Vagas as number)) throw new HttpError(409, 'Não há vagas disponíveis.');
      if (d.Status !== 'aberta') throw new HttpError(409, 'Destination battery is unavailable.');
      const [dup] = await run(`SELECT 1 x FROM dbo.Inscricao WHERE BateriaId = @destino AND ClienteId = @c AND Status <> 'cancelada'`, { destino, c: r.ClienteId });
      if (dup) throw new HttpError(409, 'Já existe uma reserva para este cliente na bateria selecionada.');
      await run(`UPDATE dbo.Inscricao SET BateriaId = @destino, TermoImpressoEm = NULL, AtualizadoEm = SYSDATETIME() WHERE Id = @id`, { destino, id });
    });
    send(200, { mensagem: 'Cliente movido com sucesso.' });
    return true;
  }
  if ((m = path.match(/^\/reservas\/(\d+)\/aprovar$/)) && method === 'POST') {
    await query(`UPDATE dbo.Inscricao SET Aprovada = 1, AtualizadoEm = SYSDATETIME() WHERE Id = @id AND Status <> 'cancelada'`, { id: Number(m[1]) });
    send(200, { ok: true });
    return true;
  }
  if ((m = path.match(/^\/reservas\/(\d+)$/)) && method === 'DELETE') {
    const id = Number(m[1]);
    const r = await one<{ Pago: boolean }>(`SELECT Pago FROM dbo.Inscricao WHERE Id = @id`, { id });
    if (!r) throw new HttpError(404, 'Reserva não encontrada.');
    if (r.Pago) throw new HttpError(409, 'Não é permitido excluir reservas pagas!');
    await query(`UPDATE dbo.Inscricao SET Status = 'cancelada', AtualizadoEm = SYSDATETIME() WHERE Id = @id`, { id });
    send(200, { mensagem: 'Reserva excluída com sucesso!' });
    return true;
  }

  // ---------- clientes
  if (path === '/clientes' && method === 'GET') {
    const q = String(url.searchParams.get('q') ?? '').trim();
    const campo = url.searchParams.get('campo') || 'auto';
    if (q.length < 2) return send(200, []), true;
    const d = onlyDigits(q);
    let where: string;
    let p: Record<string, unknown>;
    if (campo === 'email' || (campo === 'auto' && q.includes('@'))) {
      where = 'c.Email LIKE @q';
      p = { q: q.toLowerCase() + '%' };
    } else if (campo === 'documento' || (campo === 'auto' && d.length >= 4 && d.length === q.replace(/[\s.\-()/]/g, '').length)) {
      where = '(c.DocumentoNum LIKE @d OR c.TelefoneNum LIKE @t)';
      p = { d: d + '%', t: '%' + d };
    } else {
      where = 'c.Nome COLLATE Latin1_General_CI_AI LIKE @q';
      p = { q: '%' + q.replace(/\s+/g, '%') + '%' };
    }
    send(200, await query(`SELECT TOP 100 ${CLIENTE_COLS}, r.Nome responsavelNome FROM dbo.Cliente c LEFT JOIN dbo.Cliente r ON r.Id = c.ResponsavelId WHERE ${where} ORDER BY c.Nome`, p));
    return true;
  }
  if (path === '/clientes/nav' && method === 'GET') {
    const id = Number(url.searchParams.get('id') || 0);
    const dir = url.searchParams.get('dir');
    const sqlDir: Record<string, string> = {
      first: 'SELECT TOP 1 Id id FROM dbo.Cliente ORDER BY Id',
      last: 'SELECT TOP 1 Id id FROM dbo.Cliente ORDER BY Id DESC',
      prev: 'SELECT TOP 1 Id id FROM dbo.Cliente WHERE Id < @id ORDER BY Id DESC',
      next: 'SELECT TOP 1 Id id FROM dbo.Cliente WHERE Id > @id ORDER BY Id',
    };
    if (!sqlDir[dir ?? '']) throw new HttpError(400, 'Direção inválida.');
    send(200, await one(sqlDir[dir!], { id }));
    return true;
  }
  if ((m = path.match(/^\/clientes\/(\d+)$/)) && method === 'GET') {
    const id = Number(m[1]);
    const c = await one(`SELECT ${CLIENTE_COLS}, r.Nome responsavelNome, (SELECT COUNT(*) FROM dbo.Cliente) totalRegistros,
      (SELECT COUNT(*) FROM dbo.Cliente x WHERE x.Id <= c.Id) posicao FROM dbo.Cliente c LEFT JOIN dbo.Cliente r ON r.Id = c.ResponsavelId WHERE c.Id = @id`, { id });
    if (!c) throw new HttpError(404, 'Cliente não localizado.');
    const dependentes = await query(`SELECT Id id, Nome nome, CONVERT(varchar(10), Nascimento, 126) nascimento FROM dbo.Cliente WHERE ResponsavelId = @id ORDER BY Nome`, { id });
    const historico = await query(
      `SELECT TOP 50 i.Id id, b.Nome bateria, CONVERT(varchar(16), b.Inicio, 126) dataHora, p.Nome produto, i.Pago pago, i.Status status,
              CASE WHEN i.Pago = 1 THEN i.ValorCentavos ELSE ISNULL(i.PrecoCentavos, p.PrecoCentavos) END valor
       FROM dbo.Inscricao i JOIN dbo.Bateria b ON b.Id = i.BateriaId LEFT JOIN dbo.Produto p ON p.Id = ISNULL(i.ProdutoId, b.ProdutoId) WHERE i.ClienteId = @id ORDER BY b.Inicio DESC`,
      { id },
    );
    const financeiro = await one(
      `SELECT COUNT(*) vendas, ISNULL(SUM(FinalCentavos), 0) total, CONVERT(varchar(16), MAX(CriadoEm), 126) ultima FROM dbo.Venda WHERE ClienteId = @id AND Cancelada = 0`,
      { id },
    );
    send(200, { ...c, dependentes, historico, financeiro });
    return true;
  }
  if (path === '/clientes' && method === 'POST') {
    const b = (await req.body()) as ClienteInput;
    if ((b.tipoDocumento ?? 'CPF') === 'CPF' && b.documento && !isValidCpf(b.documento)) throw new HttpError(400, 'CPF inválido.');
    if (b.documento && !b.responsavelId) {
      const dup = await one<{ id: number; nome: string }>(`SELECT TOP 1 Id id, Nome nome FROM dbo.Cliente WHERE DocumentoNum = @d`, { d: onlyDigits(b.documento) });
      if (dup) throw new HttpError(409, `Documento já cadastrado para ${dup.nome} (cliente ${dup.id}).`);
    }
    send(201, { id: await insertCliente(b, 'recepcao') });
    return true;
  }
  if ((m = path.match(/^\/clientes\/(\d+)$/)) && method === 'PUT') {
    const b = (await req.body()) as ClienteInput;
    if ((b.tipoDocumento ?? 'CPF') === 'CPF' && b.documento && !isValidCpf(b.documento)) throw new HttpError(400, 'CPF inválido.');
    await updateCliente(Number(m[1]), b, false);
    send(200, { ok: true });
    return true;
  }
  if ((m = path.match(/^\/clientes\/(\d+)$/)) && method === 'DELETE') {
    const id = Number(m[1]);
    const uso = await one<{ n: number }>(`SELECT (SELECT COUNT(*) FROM dbo.Inscricao WHERE ClienteId = @id) + (SELECT COUNT(*) FROM dbo.Venda WHERE ClienteId = @id) + (SELECT COUNT(*) FROM dbo.Cliente WHERE ResponsavelId = @id) n`, { id });
    if (uso!.n > 0) throw new HttpError(409, 'Cliente com reservas, vendas ou dependentes. Use "Bloqueado" em vez de excluir.');
    await query(`DELETE FROM dbo.Cliente WHERE Id = @id`, { id });
    send(200, { ok: true });
    return true;
  }

  // ---------- caixa
  if (path === '/caixa' && method === 'GET') {
    const aberto = await movimentoAberto(sessao.uid);
    const turnos = await query(`SELECT Id id, Descricao descricao, Inicio inicio, Fim fim FROM dbo.Turno WHERE Ativo = 1 ORDER BY Inicio`);
    const terminais = await query(
      `SELECT t.Id id, t.Nome nome FROM dbo.Terminal t WHERE t.Ativo = 1 AND NOT EXISTS (SELECT 1 FROM dbo.Movimento m WHERE m.TerminalId = t.Id AND m.FechadoEm IS NULL) ORDER BY t.Nome`,
    );
    send(200, { aberto, turnos, terminais, sumario: aberto ? await sumarioMovimento(aberto.id) : null });
    return true;
  }
  if (path === '/movimentos' && method === 'GET') {
    send(
      200,
      await query(
        `SELECT TOP 120 m.Id id, t.Nome terminal, tu.Descricao turno, u.Nome usuario, CONVERT(varchar(16), m.AbertoEm, 126) abertoEm, CONVERT(varchar(16), m.FechadoEm, 126) fechadoEm,
                ISNULL((SELECT SUM(vp.ValorCentavos) FROM dbo.VendaPagamento vp JOIN dbo.Venda v ON v.Id = vp.VendaId WHERE v.MovimentoId = m.Id AND vp.Cancelado = 0), 0) recebido
         FROM dbo.Movimento m JOIN dbo.Terminal t ON t.Id = m.TerminalId LEFT JOIN dbo.Turno tu ON tu.Id = m.TurnoId LEFT JOIN dbo.Usuario u ON u.Id = m.UsuarioId
         ORDER BY m.AbertoEm DESC`,
      ),
    );
    return true;
  }
  if (path === '/caixa/abrir' && method === 'POST') {
    const b = await req.body();
    if (await movimentoAberto(sessao.uid)) throw new HttpError(409, 'Você já tem um terminal aberto.');
    if (!b.turnoId) throw new HttpError(400, 'Selecione o turno que será aberto o terminal.');
    if (!b.terminalId) throw new HttpError(400, 'Selecione um terminal para abrir.');
    const terminalId = int(b.terminalId, 'Terminal');
    const ocupado = await one(`SELECT 1 x FROM dbo.Movimento WHERE TerminalId = @terminalId AND FechadoEm IS NULL`, { terminalId });
    if (ocupado) throw new HttpError(409, 'Esse terminal já está aberto por outro usuário.');
    const inicial = cents(b.inicialCentavos ?? 0, 'Suprimento inicial');
    const r = await one<{ id: number }>(
      `INSERT INTO dbo.Movimento (UsuarioId, TerminalId, TurnoId, InicialCentavos) OUTPUT inserted.Id id VALUES (@uid, @terminalId, @turnoId, @inicial)`,
      { uid: sessao.uid, terminalId, turnoId: int(b.turnoId, 'Turno'), inicial },
    );
    send(201, { id: r!.id, mensagem: 'Terminal aberto com sucesso.' });
    return true;
  }
  if (path === '/caixa/fechar' && method === 'POST') {
    const aberto = await movimentoAberto(sessao.uid);
    if (!aberto) throw new HttpError(409, 'O terminal não está aberto.');
    const b = await req.body();
    const prox = cents(b.proximoTurnoCentavos ?? 0, 'Valor para o próximo turno');
    const s = await sumarioMovimento(aberto.id);
    if (prox > s.dinheiroEmCaixa) throw new HttpError(400, `Valor para o próximo turno inválido. Não há ${brl(prox)} em dinheiro no caixa.`);
    await query(`UPDATE dbo.Movimento SET FechadoEm = SYSDATETIME(), ProximoTurnoCentavos = @prox WHERE Id = @id`, { prox, id: aberto.id });
    send(200, { id: aberto.id, mensagem: 'Terminal fechado com sucesso.' });
    return true;
  }
  if (path === '/caixa/transacao' && method === 'POST') {
    const aberto = await movimentoAberto(sessao.uid);
    if (!aberto) throw new HttpError(409, 'O terminal ainda não foi aberto.');
    const b = await req.body();
    const tipo = b.tipo === 'sangria' ? 'sangria' : 'suprimento';
    const valor = cents(b.valorCentavos);
    if (!valor) throw new HttpError(400, 'Informe o valor.');
    const obs = str(b.observacao, 400);
    if (!obs) throw new HttpError(400, 'Informe a justificativa desta transação.');
    if (tipo === 'sangria') {
      const s = await sumarioMovimento(aberto.id);
      if (valor > s.dinheiroEmCaixa) throw new HttpError(400, 'Valor de sangria maior que o valor em caixa.');
    }
    await query(`INSERT INTO dbo.MovimentoTransacao (MovimentoId, UsuarioId, Tipo, ValorCentavos, Observacao) VALUES (@mov, @uid, @tipo, @valor, @obs)`, {
      mov: aberto.id, uid: sessao.uid, tipo, valor, obs,
    });
    send(201, { mensagem: tipo === 'sangria' ? 'Sangria registrada com sucesso.' : 'Suprimento registrado com sucesso.' });
    return true;
  }

  // ---------- venda
  if (path === '/vendas' && method === 'POST') {
    send(201, await criarVenda(sessao, await req.body()));
    return true;
  }
  if ((m = path.match(/^\/vendas\/(\d+)\/estorno$/)) && method === 'POST') {
    send(200, await estornar(sessao, Number(m[1]), await req.body()));
    return true;
  }

  // ---------- apoio / cadastros
  if (path === '/apoio' && method === 'GET') {
    const [produtos, tracados, formas, padroes, empresa, parametros] = await Promise.all([
      query(`SELECT Id id, Codigo codigo, Nome nome, PrecoCentavos preco, Categoria categoria, Ativo ativo FROM dbo.Produto ORDER BY Nome`),
      query(`SELECT Id id, Nome nome FROM dbo.Tracado WHERE Ativo = 1 ORDER BY Nome`),
      query(`SELECT Id id, Nome nome, Tipo tipo FROM dbo.FormaPagamento WHERE Ativo = 1 ORDER BY Codigo`),
      query(`SELECT Id id, Nome nome FROM dbo.PadraoReserva WHERE Ativo = 1 ORDER BY Nome`),
      one(`SELECT Nome nome, RazaoSocial razaoSocial FROM dbo.Empresa WHERE Id = 1`),
      query(`SELECT Chave chave, Valor valor FROM dbo.Parametro`),
    ]);
    send(200, { produtos, tracados, formas, padroes, empresa, parametros: Object.fromEntries(parametros.map((p) => [p.chave, p.valor])), usuario: sessao });
    return true;
  }
  if (path === '/empresa' && method === 'GET') {
    send(200, await one(`SELECT Nome nome, RazaoSocial razaoSocial, Cnpj cnpj, Cep cep, Endereco endereco, Numero numero, Complemento complemento, Bairro bairro,
      Cidade cidade, Estado estado, Telefone telefone, Email email, PoliticaReembolso politicaReembolso FROM dbo.Empresa WHERE Id = 1`));
    return true;
  }
  if (path === '/empresa' && method === 'PUT') {
    if (!sessao.admin) throw new HttpError(403, 'Disponível apenas para administradores.');
    const b = await req.body();
    const campos: Record<string, [string, number]> = {
      nome: ['Nome', 200], razaoSocial: ['RazaoSocial', 200], cnpj: ['Cnpj', 20], cep: ['Cep', 12], endereco: ['Endereco', 200], numero: ['Numero', 20],
      complemento: ['Complemento', 100], bairro: ['Bairro', 100], cidade: ['Cidade', 100], estado: ['Estado', 4], telefone: ['Telefone', 40], email: ['Email', 200], politicaReembolso: ['PoliticaReembolso', 8000],
    };
    const vals: Record<string, unknown> = {};
    for (const [k, [c, max]] of Object.entries(campos)) if (k in b) vals[c] = str(b[k], max);
    if (!vals.Nome && 'nome' in b) throw new HttpError(400, 'Informe o nome.');
    await query(`UPDATE dbo.Empresa SET ${Object.keys(vals).map((c) => `${c} = @${c}`).join(', ')} WHERE Id = 1`, vals);
    send(200, { ok: true });
    return true;
  }
  if (path === '/parametros' && method === 'GET') {
    send(200, await query(`SELECT Chave chave, Valor valor, Descricao descricao FROM dbo.Parametro ORDER BY Chave`));
    return true;
  }
  if (path === '/parametros' && method === 'PUT') {
    if (!sessao.admin) throw new HttpError(403, 'Disponível apenas para administradores.');
    const b = await req.body();
    for (const [k, v] of Object.entries(b)) await query(`UPDATE dbo.Parametro SET Valor = @v WHERE Chave = @k`, { k, v: v === null ? null : String(v).slice(0, 1000) });
    send(200, { ok: true });
    return true;
  }
  if ((m = path.match(/^\/senha$/)) && method === 'POST') {
    const b = await req.body();
    const atual = String(b.senhaAtual ?? '');
    const nova = String(b.nova ?? '');
    if (nova.length < 8) throw new HttpError(400, 'A senha precisa ter pelo menos 8 caracteres.');
    if (!atual) throw new HttpError(400, 'Informe sua senha atual.');
    const u = await one<{ hash: string; ativo: boolean }>(`SELECT SenhaHash hash, Ativo ativo FROM dbo.Usuario WHERE Id = @id`, { id: sessao.uid });
    if (!u || !u.ativo) throw new HttpError(401, 'Usuário não encontrado ou inativo.');
    if (!confereSenha(atual, u.hash)) throw new HttpError(403, 'A senha atual está incorreta.');
    await query(`UPDATE dbo.Usuario SET SenhaHash = @h WHERE Id = @id`, { h: hashSenha(nova), id: sessao.uid });
    send(200, { mensagem: 'Senha alterada.' });
    return true;
  }
  if ((m = path.match(/^\/cad\/(\w+)(?:\/(\d+))?$/))) {
    await cadRoutes(req, send, m[1], m[2] ? Number(m[2]) : null);
    return true;
  }
  return false;
}
