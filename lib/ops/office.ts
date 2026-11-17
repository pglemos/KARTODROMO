/**
 * API do app da recepcao.
 * Todas as rotas daqui exigem sessao de usuario (lib/ops/auth.ts).
 */
import { saldosDasBaterias } from './agenda-financeiro';
import { produtoAntecipado } from './preco-antecipado';
import { pedirVinculoAgora } from './app-mobile';
import { CLIENTE_COLS, colPg, insertCliente, isValidCpf, one, onlyDigits, query, sqlPg, tx, updateCliente, type ClienteInput } from './db';
import { confereSenha, hashSenha, type Sessao } from './auth';
import { erroCadastroObrigatorio, erroPesoCliente } from './cadastro-obrigatorio';
import { mobileApiEndpoint } from '../mobile-api-url';
import { ENDURANCE_VINCULO_SQL } from './endurance-vinculo';
import {
  avaliarElegibilidadeVoucher,
  garantirSchemaVouchers,
  listarBeneficiariosVoucher,
  normalizarBeneficiariosInput,
  normalizarDocVoucher,
  resumirStatusVoucher,
  sincronizarBeneficiariosVoucher,
  vouchersDisponiveisParaCliente,
} from './vouchers';

/** Libera a vaga preservando pagamento, venda e vínculos para consulta e estorno separado. */
export async function cancelarReserva(id: number) {
  const r = await one<{ Id: number }>(
    `UPDATE kart.inscricao SET status = 'cancelada', atualizado_em = now()
        WHERE id = @id returning id`, { id });
  if (!r) throw new HttpError(404, 'Reserva não encontrada.');
}

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
// Data/hora local de Brasília com segundos (a sessão do banco roda em America/Sao_Paulo).
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
const mobilePermissions = new Set(['resultados_publicar_mobile', 'identidade_mobile_vincular']);

async function mobilePermission(sessao: Sessao, funcao: string) {
  const row = await one<{ allowed: boolean | number | string }>(
    `SELECT (coalesce(p.acesso_total, false) OR coalesce(pp.incluir, false)) allowed
     FROM kart.usuario u LEFT JOIN kart.perfil p ON p.id = u.perfil_id
     LEFT JOIN kart.perfil_permissao pp ON pp.perfil_id = p.id AND pp.modulo = @modulo AND pp.funcao = @funcao
     WHERE u.id = @uid AND u.ativo = true`,
    { uid: sessao.uid, modulo: 'App Mobile', funcao },
  );
  return row?.allowed === true || row?.allowed === 1 || row?.allowed === '1';
}

/**
 * Usuários que NÃO podem fechar, bloquear nem excluir baterias (quem sai mais cedo não pode fechar os horários da noite).
 * Lista de logins no parâmetro office.usuariosSemFecharBateria (separados por vírgula). Vale para a Recepção e para o painel web.
 */
let semFecharCache: { em: number; logins: Set<string> } | null = null;
async function loginsSemFechar() {
  if (semFecharCache && Date.now() - semFecharCache.em < 15_000) return semFecharCache.logins;
  const r = await one<{ v: string | null }>(`SELECT valor v FROM kart.parametro WHERE chave = 'office.usuariosSemFecharBateria'`).catch(() => null);
  const logins = new Set(String(r?.v ?? '').split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean));
  semFecharCache = { em: Date.now(), logins };
  return logins;
}
export async function podeFecharBateria(sessao: Sessao) {
  const lista = await loginsSemFechar();
  if (!lista.size) return true;
  const u = await one<{ l: string }>(`SELECT LOWER(login) l FROM kart.usuario WHERE id = @id`, { id: sessao.uid });
  return !(u && lista.has(u.l));
}
export async function exigePodeFecharBateria(sessao: Sessao) {
  if (!(await podeFecharBateria(sessao))) throw new HttpError(403, 'Seu usuário não pode fechar, bloquear nem excluir baterias: o funcionamento precisa continuar normal até o último horário. Chame o administrador.');
}

/** As mesmas permissões do painel são exigidas na API, inclusive em chamadas diretas. */
export async function exigePermissaoOffice(sessao: Sessao, path: string, method: string) {
  if (sessao.admin) return;
  const telas = /^\/(baterias|grupos)/.test(path) || /^\/reservas\/\d+\/mover/.test(path) ? ['agenda', 'recepcao']
    : /^\/reservas/.test(path) ? ['agenda', 'recepcao', 'reservas'] : [];
  if (!telas.length) return;
  const u = await one<{ ativo: boolean; admin: boolean; perfilId: number | null; acessoTotal: boolean }>(
    `SELECT u.ativo ativo, u.admin admin, u.perfil_id "perfilId", p.acesso_total "acessoTotal"
     FROM kart.usuario u LEFT JOIN kart.perfil p ON p.id = u.perfil_id WHERE u.id = @uid`, { uid: sessao.uid });
  if (!u?.ativo) throw new HttpError(401, 'Sessão expirada. Entre novamente.');
  if (u.admin || u.acessoTotal || !u.perfilId) return;
  const permissoes = await query<{ funcao: string; acessar: boolean; alterar: boolean }>(
    `SELECT funcao funcao, acessar acessar, alterar alterar FROM kart.perfil_permissao WHERE perfil_id = @p AND modulo = 'Admin Web'`, { p: u.perfilId });
  // Perfis antigos sem configuração continuam com o acesso contratado; configuração explícita é restritiva.
  if (!permissoes.length) return;
  if (!permissoes.some((p) => telas.includes(p.funcao) && p.acessar && (method === 'GET' || p.alterar)))
    throw new HttpError(403, 'Seu perfil não pode executar esta operação na agenda.');
}

async function servicosOnline() {
  const servicos: { id: string; nome: string; online: boolean | null; status: 'online' | 'offline' | 'indisponivel'; verificadoEm: string | null; detalhe?: string }[] = [
    { id: 'office-api', nome: 'API da Recepção', online: true, status: 'online', verificadoEm: new Date().toISOString() },
  ];
  let bancoOnline = false;
  let bancoVerificado: string | null = null;
  try {
    const db = await one<{ agora: string }>(`SELECT to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS') agora`);
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
      const p = await one<{ id: number }>(`SELECT id id FROM kart.parceiro WHERE lower(unaccent(nome)) = lower(unaccent(@nome)) AND ativo = true ORDER BY id limit 1`, { nome: referencia });
      parceiroId = p?.id ?? null;
    }
    if (!parceiroId) throw new HttpError(400, 'Selecione um parceiro ativo para vincular o voucher.');
    const p = await one<{ nome: string; ativo: boolean }>(`SELECT nome nome, ativo ativo FROM kart.parceiro WHERE id = @id`, { id: parceiroId });
    if (!p || !p.ativo) throw new HttpError(400, 'Parceiro não encontrado ou inativo.');
    referencia = referencia ?? p.nome;
  } else if (origem === 'fidelidade') {
    parceiroId = null;
    if (!fidelidadeContaId && referencia) {
      const a = await one<{ id: number }>(
        `SELECT f.id id FROM kart.fidelidade_conta f JOIN kart.cliente c ON c.id = f.cliente_id
         WHERE lower(unaccent(c.nome)) = lower(unaccent(@nome)) AND f.ativo = true ORDER BY f.id limit 1`, { nome: referencia },
      );
      fidelidadeContaId = a?.id ?? null;
    }
    if (!fidelidadeContaId) throw new HttpError(400, 'Selecione uma conta de fidelidade ativa para vincular o voucher.');
    const a = await one<{ nome: string; ativo: boolean }>(
      `SELECT c.nome nome, f.ativo ativo FROM kart.fidelidade_conta f JOIN kart.cliente c ON c.id = f.cliente_id WHERE f.id = @id`, { id: fidelidadeContaId },
    );
    if (!a || !a.ativo) throw new HttpError(400, 'Conta de fidelidade não encontrada ou inativa.');
    referencia = referencia ?? a.nome;
  } else {
    parceiroId = null;
    fidelidadeContaId = null;
  }
  return { parceiroId, fidelidadeContaId, referencia };
}

/** Filtro "Exibir dados:" da recepção aplicado a uma coluna de data. */
function periodo(url: URL, col: string) {
  const filtro = url.searchParams.get('filtro') || 'dia';
  const data = url.searchParams.get('data') || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  isoDate(data);
  const ate = url.searchParams.get('ate');
  switch (filtro) {
    case 'semana':
      // semana de domingo a sábado (como o DATEFIRST padrão do banco anterior)
      return { where: `${col} >= @d::date - extract(dow from @d::date)::int AND ${col} < @d::date - extract(dow from @d::date)::int + 7`, p: { d: data } };
    case 'mes':
      return { where: `${col} >= date_trunc('month', @d::date) AND ${col} < date_trunc('month', @d::date) + interval '1 month'`, p: { d: data } };
    case 'apartir':
      return { where: `${col} >= @d::date`, p: { d: data } };
    case 'entre':
      return { where: `${col} >= @d::date AND ${col} < @a::date + 1`, p: { d: data, a: isoDate(ate) } };
    case 'todas':
      return { where: '1=1', p: {} };
    default:
      return { where: `${col} >= @d::date AND ${col} < @d::date + 1`, p: { d: data } };
  }
}

// ---------------------------------------------------------------- consultas de lista (arvore)

// as listas abaixo são completadas pelo chamador com "WHERE ... ORDER BY ..." e "limit 5000" (era o TOP 5000)
const RESERVA_SELECT = `SELECT i.id id, i.pago pago, to_char(b.inicio, 'YYYY-MM-DD"T"HH24:MI') "dataHora", b.nome reserva, b.id "bateriaId",
  c.id "clienteId", c.nome cliente, endurance.equipe, endurance."equipeId", endurance.pulseira, c.documento documento, c.email email, c.telefone telefone, c.peso peso, to_char(c.nascimento, 'YYYY-MM-DD') nascimento,
  CASE WHEN c.nascimento IS NULL THEN NULL ELSE extract(year from age(current_date, c.nascimento))::int END idade,
  r.nome responsavel, p.id "produtoId", p.nome produto, p.categoria categoria, coalesce(i.preco_centavos, p.preco_centavos) preco, i.desconto_centavos desconto,
  CASE WHEN i.pago = true THEN i.valor_centavos ELSE coalesce(i.preco_centavos, p.preco_centavos) - i.desconto_centavos END total,
  i.observacao observacao, i.aprovada aprovada, CASE WHEN i.termo_impresso_em IS NULL THEN 0 ELSE 1 END termo, i.status status, i.origem origem, i.kart kart, i.venda_id "vendaId",
  i.voucher_id "voucherId", vsug.codigo "voucherCodigo",
  to_char(i.termo_impresso_em, 'YYYY-MM-DD"T"HH24:MI') "termoImpressoEm", to_char(i.criado_em, 'YYYY-MM-DD"T"HH24:MI') "criadoEm", to_char(i.checkin_em, 'YYYY-MM-DD"T"HH24:MI') "checkinEm", i.checkin_origem "checkinOrigem",
  CASE WHEN i.pago = true THEN coalesce(onl.forma, cx.formas) END "formaPagamento"
  FROM kart.inscricao i JOIN kart.bateria b ON b.id = i.bateria_id JOIN kart.cliente c ON c.id = i.cliente_id ${ENDURANCE_VINCULO_SQL}
  LEFT JOIN kart.cliente r ON r.id = coalesce(i.responsavel_id, c.responsavel_id) LEFT JOIN kart.produto p ON p.id = coalesce(i.produto_id, b.produto_id)
  LEFT JOIN kart.voucher vsug ON vsug.id = i.voucher_id
  LEFT JOIN LATERAL (SELECT CASE ro.forma WHEN 'pix' THEN 'Pix' WHEN 'debito' THEN 'Débito' WHEN 'credito' THEN 'Crédito' ELSE 'Cartão' END || ' (site)' forma
    FROM kart.reserva_online ro WHERE i.origem = 'site' AND ro.status = 'pago' AND ',' || ro.inscricao_ids || ',' LIKE '%,' || (i.id)::text || ',%' LIMIT 1) onl ON true
  LEFT JOIN LATERAL (SELECT string_agg(DISTINCT fp.nome, ' + ') formas FROM kart.venda_pagamento vp JOIN kart.forma_pagamento fp ON fp.id = vp.forma_pagamento_id
    WHERE vp.venda_id = i.venda_id AND vp.cancelado = false) cx ON true`;

const BATERIA_SELECT = `SELECT b.id id, to_char(b.inicio, 'YYYY-MM-DD"T"HH24:MI') "dataHora", b.nome nome, p.id "produtoId", p.nome produto, p.categoria categoria,
  p.preco_centavos preco, b.vagas vagas, b.vagas - (SELECT COUNT(*) FROM kart.inscricao x WHERE x.bateria_id = b.id AND x.status <> 'cancelada') disponiveis,
  (SELECT COUNT(*) FROM kart.inscricao x WHERE x.bateria_id = b.id AND x.status <> 'cancelada') inscritos,
  (SELECT COUNT(*) FROM kart.inscricao x WHERE x.bateria_id = b.id AND x.status <> 'cancelada' AND x.pago = true) pagos,
  (SELECT COUNT(*) FROM kart.inscricao x WHERE x.bateria_id = b.id AND x.status <> 'cancelada' AND x.aprovada = false) "preReservas",
  rc.nome responsavel, b.responsavel_id "responsavelId", b.status status, b.auto_atendimento "autoAtendimento", t.id "tracadoId", t.nome tracado,
  b.volta_minima_seg "voltaMinimaSeg", b.codigo_reserva "codigoReserva", b.reserva_fechada "reservaFechada", b.observacao observacao, b.tipo_kart "tipoKart", b.campeonato campeonato
  FROM kart.bateria b LEFT JOIN kart.produto p ON p.id = b.produto_id LEFT JOIN kart.tracado t ON t.id = b.tracado_id LEFT JOIN kart.cliente rc ON rc.id = b.responsavel_id`;

const VENDA_SELECT = `SELECT v.id id, to_char(v.criado_em, 'YYYY-MM-DD"T"HH24:MI') "dataHora", coalesce(v.codigo, (v.id)::text) codigo, c.nome cliente, c.documento documento,
  u.nome usuario, t.nome terminal, v.bruto_centavos bruto, v.desconto_centavos desconto, v.acrescimo_centavos acrescimo, v.recebido_centavos recebido,
  v.troco_centavos troco, v.estorno_centavos estorno, v.final_centavos final, v.cancelada cancelada, v.motivo_cancelamento motivo, v.observacao observacao, v.movimento_id "movimentoId"
  FROM kart.venda v LEFT JOIN kart.cliente c ON c.id = v.cliente_id LEFT JOIN kart.usuario u ON u.id = v.usuario_id LEFT JOIN kart.terminal t ON t.id = v.terminal_id`;

// ---------------------------------------------------------------- cadastros genericos

type ColType = 'text' | 'int' | 'money' | 'bool' | 'date' | 'time';
type CadDef = { table: string; cols: Record<string, [string, ColType, number?]>; order: string; required?: string[]; adminOnly?: boolean; filter?: string; extra?: string };

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
  tracados: { table: 'Tracado', cols: { nome: ['Nome', 'text', 100], comprimento: ['Comprimento', 'int'], ativo: ['Ativo', 'bool'] }, order: 'LEN(Nome), Nome', required: ['nome'] }, // o catálogo ativo vem da Cronometragem; o servidor mantém a ponte local
  feriados: { table: 'Feriado', cols: { data: ['Data', 'date'], descricao: ['Descricao', 'text', 100], recorrente: ['Recorrente', 'bool'], abre: ['Abre', 'bool'] }, order: 'Data', required: ['data', 'descricao'] },
  turnos: { table: 'Turno', cols: { descricao: ['Descricao', 'text', 60], inicio: ['Inicio', 'time'], fim: ['Fim', 'time'], ativo: ['Ativo', 'bool'] }, order: 'Descricao', required: ['descricao'] },
  terminais: {
    table: 'Terminal', cols: { codigo: ['Codigo', 'text', 10], nome: ['Nome', 'text', 60], ativo: ['Ativo', 'bool'] }, order: 'Nome', required: ['nome'],
    extra: `(SELECT 'Aberto · ' || u.nome FROM kart.movimento m JOIN kart.usuario u ON u.id = m.usuario_id WHERE m.terminal_id = terminal.id AND m.fechado_em IS NULL ORDER BY m.id DESC LIMIT 1) situacao`,
  },
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
  usuarios: {
    table: 'Usuario', cols: { login: ['Login', 'text', 40], nome: ['Nome', 'text', 100], admin: ['Admin', 'bool'], ativo: ['Ativo', 'bool'], perfilId: ['PerfilId', 'int'] }, order: 'Nome', required: ['login', 'nome'], adminOnly: true,
    extra: `to_char(ultimo_acesso, 'YYYY-MM-DD"T"HH24:MI') "ultimoAcesso", (SELECT p.descricao "Descricao" FROM kart.perfil p WHERE p.id = perfil_id) perfil`,
  },
  // perfis de acesso (SegPerfil do canvas)
  perfis: {
    table: 'Perfil', cols: { descricao: ['Descricao', 'text', 60], acessoTotal: ['AcessoTotal', 'bool'], ativo: ['Ativo', 'bool'] }, order: 'Id', required: ['descricao'], adminOnly: true,
  },
};

/** Os cadastros guardam os nomes do banco anterior (PascalCase); aqui viram os nomes do Postgres. */
function cadSelect(def: CadDef) {
  const cols = Object.entries(def.cols).map(([k, [c, t]]) => (t === 'date' ? `to_char(${colPg(c)}, 'YYYY-MM-DD') "${k}"`
    // hora: o mesmo JSON que o driver anterior devolvia para colunas time ("1970-01-01T08:00:00.000Z")
      : `${colPg(c)} "${k}"`));
  return `SELECT id id, ${cols.join(', ')}${def.extra ? ', ' + def.extra : ''} FROM kart.${colPg(def.table)}`;
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

/** Protege o acesso: ninguém se tranca para fora, e sempre sobra um administrador ativo. */
async function guardaUsuario(req: Req, id: number | null, body: Record<string, unknown> | null) {
  const login = body && 'login' in body ? String(body.login ?? '').trim().toLowerCase() : '';
  if (login) {
    const igual = await one<{ id: number }>(`SELECT id id FROM kart.usuario WHERE lower(login) = @login AND (@id::int IS NULL OR id <> @id::int)`, { login, id });
    if (igual) throw new HttpError(409, 'Já existe um usuário com esse login.');
  }
  if (!id) return;
  const alvo = await one<{ admin: boolean; ativo: boolean }>(`SELECT admin admin, ativo ativo FROM kart.usuario WHERE id = @id`, { id });
  if (!alvo) throw new HttpError(404, 'Usuário não encontrado.');
  const excluir = body === null;
  const tiraAtivo = excluir || (body && 'ativo' in body && !bit(body.ativo));
  const tiraAdmin = excluir || (body && 'admin' in body && !bit(body.admin));
  if (id === req.sessao.uid && (excluir)) throw new HttpError(400, 'Você não pode excluir o próprio usuário.');
  if (id === req.sessao.uid && tiraAtivo) throw new HttpError(400, 'Você não pode desativar o próprio usuário.');
  if (id === req.sessao.uid && tiraAdmin) throw new HttpError(400, 'Você não pode tirar o próprio acesso de administrador.');
  if (alvo.admin && alvo.ativo && (tiraAtivo || tiraAdmin)) {
    const outros = await one<{ n: number }>(`SELECT COUNT(*) n FROM kart.usuario WHERE admin = true AND ativo = true AND id <> @id`, { id });
    if (!outros || outros.n < 1) throw new HttpError(400, 'Precisa sobrar pelo menos um administrador ativo.');
  }
}

async function cadRoutes(req: Req, send: Res, ent: string, id: number | null): Promise<void> {
  const def = CAD[ent];
  if (!def) throw new HttpError(404, 'Cadastro desconhecido.');
  if (def.adminOnly && !req.sessao.admin) throw new HttpError(403, 'Disponível apenas para administradores.');
  if (req.method === 'GET') {
    if (id) return send(200, await one(`${cadSelect(def)} WHERE id = @id`, { id }));
    const f = def.filter && req.url.searchParams.get(def.filter);
    const filtros = [
      ent === 'tracados' ? `(timing_track_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM kart.tracado WHERE ativo = true AND timing_track_id IS NOT NULL))` : '',
      f ? `${colPg(def.cols[def.filter!][0])} = @f` : '',
    ].filter(Boolean);
    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    return send(200, await query(`${cadSelect(def)} ${where} ORDER BY ${sqlPg(def.order)}`, f ? { f } : {}));
  }
  if (req.method === 'POST' || req.method === 'PUT') {
    const body = await req.body();
    const vals = cadValues(def, body, req.method === 'PUT');
    if (ent === 'usuarios') {
      await guardaUsuario(req, id, body);
      const senha = String(body.senha ?? '');
      if (req.method === 'POST' && senha.length < 6) throw new HttpError(400, 'A senha precisa ter pelo menos 6 caracteres.');
      if (senha) {
        if (senha.length < 6) throw new HttpError(400, 'A senha precisa ter pelo menos 6 caracteres.');
        vals.SenhaHash = hashSenha(senha);
      }
      if (vals.Login) vals.Login = String(vals.Login).toLowerCase();
    }
    const names = Object.keys(vals);
    try {
      if (req.method === 'POST') {
        const r = await one<{ id: number }>(`INSERT INTO kart.${colPg(def.table)} (${names.map(colPg).join(', ')}) VALUES (${names.map((n) => '@' + n).join(', ')}) returning id`, vals);
        return send(201, { id: r!.id });
      }
      if (!id) throw new HttpError(400, 'Registro não informado.');
      if (names.length) await query(`UPDATE kart.${colPg(def.table)} SET ${names.map((n) => `${colPg(n)} = @${n}`).join(', ')} WHERE id = @id`, { ...vals, id });
      return send(200, { id });
    } catch (e) {
      if (!(e instanceof HttpError) && (ent === 'usuarios' || ent === 'perfis') && duplicateSql(e)) {
        throw new HttpError(409, ent === 'usuarios' ? 'Já existe um usuário com esse login.' : 'Já existe um perfil com esse nome.');
      }
      throw e;
    }
  }
  if (req.method === 'DELETE' && id) {
    if (ent === 'usuarios') await guardaUsuario(req, id, null);
    if (ent === 'perfis') {
      const emUso = await one<{ n: number }>(`SELECT COUNT(*) n FROM kart.usuario WHERE perfil_id = @id`, { id });
      if (emUso && emUso.n > 0) throw new HttpError(409, `Este perfil tem ${emUso.n} usuário(s). Troque o perfil deles antes de excluir.`);
      await query(`DELETE FROM kart.perfil_permissao WHERE perfil_id = @id`, { id });
    }
    try {
      await query(`DELETE FROM kart.${colPg(def.table)} WHERE id = @id`, { id });
      return send(200, { ok: true });
    } catch {
      if ('ativo' in def.cols) {
        await query(`UPDATE kart.${colPg(def.table)} SET ativo = false WHERE id = @id`, { id });
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
    `SELECT m.id id, m.terminal_id "terminalId", t.nome terminal, tu.descricao turno, to_char(m.aberto_em, 'YYYY-MM-DD"T"HH24:MI') "abertoEm", m.inicial_centavos inicial
     FROM kart.movimento m JOIN kart.terminal t ON t.id = m.terminal_id LEFT JOIN kart.turno tu ON tu.id = m.turno_id
     WHERE m.usuario_id = @uid AND m.fechado_em IS NULL ORDER BY m.id DESC limit 1`,
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
    `SELECT m.inicial_centavos inicial,
       coalesce((SELECT SUM(valor_centavos) FROM kart.movimento_transacao WHERE movimento_id = m.id AND tipo = 'suprimento'), 0) suprimento,
       coalesce((SELECT SUM(valor_centavos) FROM kart.movimento_transacao WHERE movimento_id = m.id AND tipo = 'sangria'), 0) sangria,
       coalesce((SELECT SUM(vi.unitario_centavos * vi.quantidade) FROM kart.venda_item vi JOIN kart.venda v ON v.id = vi.venda_id WHERE v.movimento_id = m.id AND vi.inscricao_id IS NULL), 0) "vendasProdutos",
       coalesce((SELECT SUM(bruto_centavos) FROM kart.venda WHERE movimento_id = m.id), 0) vendas,
       coalesce((SELECT SUM(desconto_centavos) FROM kart.venda WHERE movimento_id = m.id), 0) desconto,
       coalesce((SELECT SUM(acrescimo_centavos) FROM kart.venda WHERE movimento_id = m.id), 0) acrescimos,
       coalesce((SELECT SUM(vp.valor_centavos) FROM kart.venda_pagamento vp JOIN kart.venda v ON v.id = vp.venda_id WHERE v.movimento_id = m.id AND vp.cancelado = false), 0) recebido,
       coalesce((SELECT SUM(troco_centavos) FROM kart.venda WHERE movimento_id = m.id), 0) troco,
       coalesce((SELECT SUM(estorno_centavos) FROM kart.venda WHERE movimento_id = m.id), 0) cancelado,
       coalesce((SELECT SUM(vp.valor_centavos) FROM kart.venda_pagamento vp JOIN kart.venda v ON v.id = vp.venda_id JOIN kart.forma_pagamento f ON f.id = vp.forma_pagamento_id
               WHERE v.movimento_id = m.id AND vp.cancelado = false AND f.tipo = 'dinheiro'), 0) "recebidoDinheiro"
     FROM kart.movimento m WHERE m.id = @movId`,
    { movId },
  );
  if (!r) throw new HttpError(404, 'Movimento não encontrado.');
  const porForma = await query<{ forma: string; valor: number }>(
    `SELECT coalesce(f.nome, 'Outros') forma, SUM(vp.valor_centavos) valor FROM kart.venda_pagamento vp JOIN kart.venda v ON v.id = vp.venda_id
     LEFT JOIN kart.forma_pagamento f ON f.id = vp.forma_pagamento_id WHERE v.movimento_id = @movId AND vp.cancelado = false GROUP BY f.nome ORDER BY f.nome`,
    { movId },
  );
  const final = r.inicial + r.suprimento - r.sangria + r.recebido - r.troco - r.cancelado;
  const dinheiro = r.inicial + r.suprimento - r.sangria + r.recebidoDinheiro - r.troco;
  return { ...r, final, dinheiroEmCaixa: dinheiro, porForma };
}

// ---------------------------------------------------------------- inscricao (reserva)

/**
 * opcoes.produtoId: produto escolhido na recepção (senão o da bateria); opcoes.pago: pago antecipado (site/WhatsApp), já entra paga e aprovada.
 * opcoes.clientes: uma vaga para CADA pessoa da lista (reserva online de grupo: comprador + os outros pilotos); clienteId fica
 * como responsável. Sem a lista, as n vagas ficam no nome de clienteId (como a recepção sempre fez).
 * opcoes.run: roda dentro de uma transação já aberta (reserva online grava o pedido e o cupom junto).
 */
type OpsRun = (text: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>[]>;

async function inscreverN(bateriaId: number, clienteId: number, n: number, origem: string, uid: number | null, observacao: string | null, aprovada = true, opcoes: { produtoId?: number | null; pago?: boolean; clientes?: number[]; run?: OpsRun; vagaDoGrupo?: boolean; precos?: number[] } = {}) {
  const pessoas = opcoes.clientes?.length ? opcoes.clientes : null;
  if (pessoas) n = pessoas.length;
  const inscrever = async (run: OpsRun) => {
    const [b] = await run(
      `SELECT b.id "Id", b.status "Status", b.vagas "Vagas", b.inicio "Inicio", b.nome "Nome", b.produto_id "ProdutoId", p.preco_centavos preco,
        (SELECT COUNT(*) FROM kart.inscricao i WHERE i.bateria_id = b.id AND i.status <> 'cancelada') ocupadas,
        CASE WHEN b.inicio < (now() + make_interval(mins => (-30)::int)) THEN 1 ELSE 0 END passada
       FROM kart.bateria b LEFT JOIN kart.produto p ON p.id = b.produto_id WHERE b.id = @bateriaId for update of b`,
      { bateriaId },
    );
    if (!b) throw new HttpError(404, 'Selecione uma bateria.');
    if (b.Status === 'cancelada') throw new HttpError(409, 'Bateria excluída.');
    if (b.passada) throw new HttpError(409, 'Não é permitido reservar para baterias que já ocorreram!');
    const livres = (b.Vagas as number) - (b.ocupadas as number);
    if (livres <= 0) throw new HttpError(409, 'Não há vagas para a bateria selecionada.');
    if (n > livres) throw new HttpError(409, `Não há vagas o suficiente para a quantidade de participantes selecionada. Vagas disponíveis: ${livres}.`);
    // no site quem compra nem sempre pilota: pode reservar de novo para mais alguém na mesma bateria
    // no grupo cada vaga nasce no nome do responsável e depois passa para o piloto: não é reserva duplicada
    if (n === 1 && origem !== 'site' && !opcoes.vagaDoGrupo) {
      const [dup] = await run(`SELECT id "Id" FROM kart.inscricao WHERE bateria_id = @bateriaId AND cliente_id = @clienteId AND status <> 'cancelada'`, { bateriaId, clienteId });
      if (dup) throw new HttpError(409, 'Já existe uma reserva em nome deste cliente.');
    }
    for (const id of pessoas ?? [clienteId]) {
      const [c] = await run(`SELECT bloqueado "Bloqueado", nome "Nome" FROM kart.cliente WHERE id = @id`, { id });
      if (!c) throw new HttpError(404, 'Cliente não localizado.');
      if (c.Bloqueado) throw new HttpError(409, pessoas ? `cliente bloqueado: ${c.Nome}.` : 'Cliente bloqueado.');
    }
    let produtoId = (b.ProdutoId as number | null) ?? null;
    let preco = (b.preco as number | null) ?? null;
    if (opcoes.produtoId) {
      const [p] = await run(`SELECT id "Id", preco_centavos preco FROM kart.produto WHERE id = @id`, { id: opcoes.produtoId });
      if (!p) throw new HttpError(404, 'Produto não encontrado.');
      produtoId = p.Id as number; preco = (p.preco as number | null) ?? null;
    } else if (opcoes.pago) {
      // pago antecipado (WhatsApp/Recepção) sem produto escolhido: locação normal sai pelo ANTECIPADO (R$ 145)
      const pa = produtoAntecipado(produtoId, b.Nome as string | null);
      if (pa && pa !== produtoId) {
        const [p] = await run(`SELECT id "Id", preco_centavos preco FROM kart.produto WHERE id = @id`, { id: pa });
        if (p?.preco != null) { produtoId = p.Id as number; preco = p.preco as number; }
      }
    }
    const pago = Boolean(opcoes.pago);
    const ids: number[] = [];
    for (let k = 0; k < n; k++) {
      const [row] = await run(
        `INSERT INTO kart.inscricao (bateria_id, cliente_id, origem, observacao, produto_id, preco_centavos, aprovada, responsavel_id, pago, valor_centavos, status)
          VALUES (@bateriaId, @clienteId, @origem, @obs, @produtoId, @preco, @aprovada, @resp, @pago, @valor, @status) returning id id`,
        {
          bateriaId, clienteId: pessoas ? pessoas[k] : clienteId, origem, obs: observacao, produtoId, preco: opcoes.precos?.[k] ?? preco, aprovada: (origem === 'site' || origem === 'totem' || origem === 'agendamento') ? 0 : (aprovada ? 1 : 0), resp: n > 1 ? clienteId : null,
          pago: pago ? 1 : 0, valor: pago ? preco : null, status: pago ? 'confirmada' : 'reservada',
        },
      );
      ids.push(row.id as number);
    }
    void uid;
    return ids;
  };
  return opcoes.run ? inscrever(opcoes.run) : tx(inscrever);
}
export { inscreverN };

export const MSG_SERVICO_DIFERENTE = 'Reserva paga só pode ser movida para bateria do mesmo serviço e tipo de kart. O produto e o valor já pagos são preservados.';

/** Resultado do mover: quantas reservas pagas trocaram de serviço e quanto falta cobrar no caixa (só quando o novo é mais caro). */
export interface ResultadoMover { trocasDeServico: number; diferencaCentavos: number }

/**
 * O movimento completo do grupo usa uma única transação: nunca fica pela metade.
 * opcoes.trocarServico: a Recepção confirmou que a reserva PAGA vai para outro serviço (ex.: Happy Hour 15 min → Locação
 * padrão). A reserva passa para o produto/preço da bateria nova, continua paga com o valor já pago, e a diferença fica
 * anotada na observação para cobrar no caixa. O tipo de kart continua tendo de ser o mesmo.
 */
export async function moverReservas(ids: number[], destino: number, grupoId?: number, opcoes: { trocarServico?: boolean } = {}): Promise<ResultadoMover> {
  const resultado: ResultadoMover = { trocasDeServico: 0, diferencaCentavos: 0 };
  await tx(async (run) => {
    if (grupoId) {
      const [g] = await run(`SELECT id "Id" FROM kart.reserva_grupo WHERE id = @g AND status = 'ativa' for update`, { g: grupoId });
      if (!g) throw new HttpError(404, 'Reserva em grupo não encontrada.');
      const membros = await run(`SELECT i.id id FROM kart.reserva_grupo_piloto p JOIN kart.inscricao i ON i.id = p.inscricao_id WHERE p.grupo_id = @g AND i.status <> 'cancelada' ORDER BY i.id for update of p, i`, { g: grupoId });
      ids = membros.map((p) => Number(p.id));
      if (!ids.length) throw new HttpError(409, 'O grupo não tem reservas ativas.');
    }
    for (const id of ids) {
      if (!grupoId) {
        const [vinculo] = await run(`SELECT g.id "grupoId" FROM kart.reserva_grupo_piloto p JOIN kart.reserva_grupo g ON g.id = p.grupo_id WHERE p.inscricao_id = @id AND g.status = 'ativa'`, { id });
        if (vinculo) {
          await run(`UPDATE kart.reserva_grupo_piloto SET inscricao_id = NULL WHERE inscricao_id = @id`, { id });
        }
      }
      const [r] = await run(
        `SELECT i.cliente_id "ClienteId", i.bateria_id "BateriaId", i.pago "Pago", i.status "Status", coalesce(i.produto_id, b.produto_id) "produtoId",
         coalesce(i.preco_centavos, po.preco_centavos) preco, i.desconto_centavos desconto, i.valor_centavos "valorPago", po.nome "produtoNome", b.tipo_kart "tipoKart", po.servico_locacao "servicoLocacao", po.categoria categoria, REPLACE(REPLACE(UPPER(po.nome), 'ANTECIPADO - ', ''), 'BALCÃO - ', '') servico, po.duracao_min "duracaoMin" FROM kart.inscricao i JOIN kart.bateria b ON b.id = i.bateria_id
         LEFT JOIN kart.produto po ON po.id = coalesce(i.produto_id, b.produto_id) WHERE i.id = @id for update of i`,
        { id },
      );
      if (!r) throw new HttpError(404, 'Reserva não encontrada.');
      if (r.Status === 'cancelada') throw new HttpError(409, 'Não é possível mover uma reserva cancelada.');
      if (Number(r.BateriaId) === destino) continue;
      const [d] = await run(
        `SELECT b.status "Status", b.vagas "Vagas", b.nome "Nome", b.reserva_fechada "reservaFechada", b.tipo_kart "tipoKart", p.servico_locacao "servicoLocacao", p.categoria categoria, REPLACE(REPLACE(UPPER(p.nome), 'ANTECIPADO - ', ''), 'BALCÃO - ', '') servico, p.duracao_min "duracaoMin", p.id "produtoId", p.nome "produtoNome", p.preco_centavos preco, (SELECT COUNT(*) FROM kart.inscricao x WHERE x.bateria_id = b.id AND x.status <> 'cancelada') ocupadas
         FROM kart.bateria b LEFT JOIN kart.produto p ON p.id = b.produto_id WHERE b.id = @destino for update of b`,
        { destino },
      );
      if (!d || d.Status === 'cancelada') throw new HttpError(404, 'Bateria destino não encontrada ou cancelada.');
      if (d.produtoId == null || d.preco == null) throw new HttpError(409, 'A bateria destino precisa ter um produto com preço cadastrado.');
      // Antecipado e balcão do mesmo serviço mantêm o produto e o valor já pagos.
      const mesmoServico = Number(d.produtoId) === Number(r.produtoId) || (
        r.servicoLocacao && d.servicoLocacao && r.categoria && r.categoria === d.categoria
        && r.servico && r.servico === d.servico
        && (r.duracaoMin ?? null) === (d.duracaoMin ?? null)
      );
      if ((r.Pago || grupoId) && r.tipoKart !== d.tipoKart) throw new HttpError(409, MSG_SERVICO_DIFERENTE);
      const trocaServico = Boolean((r.Pago || grupoId) && !mesmoServico);
      if (trocaServico && !opcoes.trocarServico) throw new HttpError(409, MSG_SERVICO_DIFERENTE);
      if ((d.ocupadas as number) >= (d.Vagas as number)) throw new HttpError(409, 'Não há vagas disponíveis na bateria destino.');
      const [dup] = await run(`SELECT 1 x FROM kart.inscricao WHERE bateria_id = @destino AND cliente_id = @c AND status <> 'cancelada'`, { destino, c: r.ClienteId });
      if (dup) throw new HttpError(409, 'Já existe uma reserva para este cliente na bateria selecionada.');
      if (trocaServico) {
        // reserva paga vai pelo preço do pagamento antecipado (locação normal = ANTECIPADO R$ 145; Happy Hour, campeonato e eventos = o da bateria)
        if (r.Pago) {
          const pa = produtoAntecipado(Number(d.produtoId), d.Nome as string | null);
          if (pa && pa !== Number(d.produtoId)) {
            const [p] = await run(`SELECT id "Id", nome "Nome", preco_centavos preco FROM kart.produto WHERE id = @id`, { id: pa });
            if (p?.preco != null) { d.produtoId = p.Id; d.produtoNome = p.Nome; d.preco = p.preco; }
          }
        }
        // pago: o que já entrou (valor pago, ou preço − desconto se ainda não houver valor gravado); sem pagar: nada
        const jaPago = r.Pago ? Number(r.valorPago ?? Math.max(0, Number(r.preco ?? 0) - Number(r.desconto ?? 0))) : 0;
        const falta = r.Pago ? Math.max(0, Number(d.preco) - jaPago) : 0;
        const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const nota = `Troca de serviço: ${r.produtoNome ?? 'serviço anterior'} → ${d.produtoNome ?? 'serviço novo'}` +
          (r.Pago ? ` · pago ${brl(jaPago)} · ${falta > 0 ? `diferença ${brl(falta)} a cobrar no caixa` : 'sem diferença a cobrar'}` : '');
        await run(
          `UPDATE kart.inscricao SET bateria_id = @destino, produto_id = @produtoDestino, preco_centavos = @precoDestino,
           observacao = left(concat_ws(' · ', nullif(observacao, ''), @nota::text), 400), termo_impresso_em = NULL, atualizado_em = now() WHERE id = @id`,
          { destino, id, produtoDestino: d.produtoId, precoDestino: d.preco, nota },
        );
        resultado.trocasDeServico += 1;
        resultado.diferencaCentavos += falta;
      } else if (r.Pago || grupoId) {
        await run(`UPDATE kart.inscricao SET bateria_id = @destino, termo_impresso_em = NULL, atualizado_em = now() WHERE id = @id`, { destino, id });
      } else {
        await run(
          `UPDATE kart.inscricao SET bateria_id = @destino, produto_id = @produtoDestino::int, preco_centavos = @precoDestino::int,
           desconto_centavos = CASE WHEN @produtoOrigem::int = @produtoDestino::int THEN CASE WHEN desconto_centavos > @precoDestino::int THEN @precoDestino::int ELSE desconto_centavos END ELSE 0 END,
           termo_impresso_em = NULL, atualizado_em = now() WHERE id = @id`,
          { destino, id, produtoOrigem: r.produtoId, produtoDestino: d.produtoId, precoDestino: d.preco },
        );
      }
    }
    if (grupoId) await run(`UPDATE kart.reserva_grupo SET bateria_id = @destino, atualizado_em = now() WHERE id = @g`, { destino, g: grupoId });
  });
  return resultado;
}

// ---------------------------------------------------------------- venda (checkout / receita avulsa)

type ItemIn = { produtoId?: number; inscricaoId?: number; clienteId?: number; voucherAplicado?: boolean; descricao?: string; quantidade?: number; unitarioCentavos: number; descontoCentavos?: number; acrescimoCentavos?: number };

async function criarVenda(sessao: Sessao, body: Record<string, unknown>) {
  const mov = await movimentoAberto(sessao.uid);
  if (!mov) throw new HttpError(409, 'Não é possível continuar com o caixa fechado!');
  const itensIn = (Array.isArray(body.itens) ? body.itens : []) as ItemIn[];
  if (!itensIn.length) throw new HttpError(400, 'Carrinho vazio.');
  const pagamentosIn = (Array.isArray(body.pagamentos) ? body.pagamentos : []) as { formaPagamentoId: number; valorCentavos: number }[];
  const clienteId = body.clienteId ? int(body.clienteId, 'Cliente') : null;
  const voucherCodigo = str(body.voucherCodigo, 40);
  const validar = (await one<{ v: string }>(`SELECT valor v FROM kart.parametro WHERE chave = 'office.validarTotalPago'`))?.v !== 'false';

  return tx(async (run) => {
    // itens: confere reserva e produto no servidor
    const itens = [] as (Required<Omit<ItemIn, 'produtoId' | 'inscricaoId' | 'clienteId' | 'voucherAplicado'>> & {
      produtoId: number | null; inscricaoId: number | null; itemClienteId: number | null;
      voucherAplicado: boolean; liquido: number; voucherId?: number;
    })[];
    for (const it of itensIn) {
      const qtd = int(it.quantidade ?? 1, 'Quantidade');
      let descricao = str(it.descricao, 200) ?? 'Item';
      let produtoId = it.produtoId ? int(it.produtoId, 'Produto') : null;
      const inscricaoId = it.inscricaoId ? int(it.inscricaoId, 'Reserva') : null;
      let itemClienteId: number | null = it.clienteId ? int(it.clienteId, 'Cliente') : null;
      if (inscricaoId) {
        const [ins] = await run(
          `SELECT i.pago "Pago", i.status "Status", i.produto_id "ProdutoId", i.cliente_id "ClienteId", c.nome "Nome", b.nome bateria FROM kart.inscricao i JOIN kart.cliente c ON c.id = i.cliente_id JOIN kart.bateria b ON b.id = i.bateria_id WHERE i.id = @inscricaoId for update of i`,
          { inscricaoId },
        );
        if (!ins) throw new HttpError(404, 'Reserva não encontrada.');
        if (ins.Pago) throw new HttpError(409, `A reserva de ${ins.Nome} já está paga.`);
        if (ins.Status === 'cancelada') throw new HttpError(409, `A reserva de ${ins.Nome} está cancelada.`);
        produtoId = produtoId ?? (ins.ProdutoId as number | null);
        itemClienteId = (ins.ClienteId as number | null) ?? itemClienteId;
        descricao = `${ins.bateria} - ${ins.Nome}`.slice(0, 200);
      } else if (produtoId) {
        const [p] = await run(`SELECT nome "Nome" FROM kart.produto WHERE id = @produtoId`, { produtoId });
        if (!p) throw new HttpError(404, 'Produto não encontrado.');
        descricao = String(p.Nome).slice(0, 200);
      }
      const unit = cents(it.unitarioCentavos, 'Preço');
      const desc = cents(it.descontoCentavos ?? 0, 'Desconto');
      const acr = cents(it.acrescimoCentavos ?? 0, 'Acréscimo');
      const liquido = unit * qtd - desc + acr;
      if (liquido < 0) throw new HttpError(400, 'Desconto maior que o valor do item.');
      itens.push({
        produtoId, inscricaoId, itemClienteId, voucherAplicado: Boolean(it.voucherAplicado),
        descricao, quantidade: qtd, unitarioCentavos: unit, descontoCentavos: desc, acrescimoCentavos: acr, liquido,
      });
    }

    // voucher (1 item por padrão, ou vários itens marcados com voucherAplicado pelo Caixa)
    let voucher: Record<string, unknown> | null = null;
    const voucherUsos: Array<{ clienteId: number | null; desconto: number; autoLink: { vcId: number; clienteId: number } | null }> = [];
    if (voucherCodigo) {
      const [v] = await run(
        `SELECT v.id "Id", v.codigo "Codigo", v.ativo "Ativo", v.parceiro_id "ParceiroId", v.fidelidade_conta_id "FidelidadeContaId", v.produto_id "ProdutoId", v.tipo "Tipo", v.valor "Valor", v.inicio_em "InicioEm", v.fim_em "FimEm", v.desconto_maximo_centavos "DescontoMaximoCentavos", v.pedido_minimo_centavos "PedidoMinimoCentavos", v.uso_unico "UsoUnico", v.uso_max_total "UsoMaxTotal", v.uso_max_cliente "UsoMaxCliente", v.restrito_clientes "RestritoClientes", v.origem "Origem", v.referencia "Referencia", p.ativo "parceiroAtivo", fc.ativo "fidelidadeAtiva" FROM kart.voucher v
         LEFT JOIN kart.parceiro p ON p.id = v.parceiro_id LEFT JOIN kart.fidelidade_conta fc ON fc.id = v.fidelidade_conta_id WHERE upper(v.codigo) = upper(@c) for update of v`,
        { c: voucherCodigo },
      );
      if (!v || !v.Ativo) throw new HttpError(400, 'Voucher não encontrado.');
      if (v.ParceiroId && !v.parceiroAtivo) throw new HttpError(400, 'O parceiro vinculado ao voucher está inativo.');
      if (v.FidelidadeContaId && !v.fidelidadeAtiva) throw new HttpError(400, 'A conta de fidelidade vinculada ao voucher está inativa.');
      const [hoje] = await run(`SELECT (now())::date d`);
      if ((hoje.d as Date) < (v.InicioEm as Date) || (hoje.d as Date) > (v.FimEm as Date)) throw new HttpError(400, 'Voucher expirado.');
      const totalPedido = itens.reduce((s, i) => s + i.liquido, 0);
      if (v.PedidoMinimoCentavos && totalPedido < (v.PedidoMinimoCentavos as number)) throw new HttpError(400, `valor do pedido insuficiente. Mínimo exigido: ${brl(v.PedidoMinimoCentavos as number)}.`);

      const marcados = itens.filter((i) => i.voucherAplicado);
      const alvos = marcados.length
        ? marcados.filter((i) => (!v.ProdutoId || i.produtoId === v.ProdutoId) && i.descontoCentavos === 0)
        : [itens.find((i) => (!v.ProdutoId || i.produtoId === v.ProdutoId) && i.descontoCentavos === 0)].filter((x): x is (typeof itens)[number] => Boolean(x));

      if (!alvos.length) throw new HttpError(400, v.ProdutoId ? 'O produto do voucher não está na venda.' : 'Nenhum produto na venda para aplicar o voucher.');

      let usosExtra = 0;
      const usosPorClienteExtra = new Map<number, number>();
      for (const alvo of alvos) {
        let cliAlvoId: number | null = alvo.itemClienteId ?? clienteId;
        let cliAlvoDoc: string | null = null;
        if (v.RestritoClientes && cliAlvoId) {
          const [cli] = await run(`SELECT documento "Documento", documento_num "DocumentoNum" FROM kart.cliente WHERE id = @cid`, { cid: cliAlvoId });
          cliAlvoDoc = normalizarDocVoucher(cli?.DocumentoNum ?? cli?.Documento);
        }
        const [usos] = await run(
          `SELECT
             (SELECT COUNT(*) FROM kart.voucher_uso WHERE voucher_id = @id AND estornado = false)
             + (SELECT COUNT(*) FROM kart.reserva_online_voucher_uso WHERE voucher_id = @id AND estado IN ('reservado', 'consumido', 'reembolso_pendente'))
             + (SELECT COUNT(*) FROM kart.reserva_grupo_voucher_uso WHERE voucher_id = @id AND estado IN ('reservado', 'consumido')) n,
             (SELECT COUNT(*) FROM kart.voucher_uso WHERE voucher_id = @id AND cliente_id = @cli AND estornado = false)
             + (SELECT COUNT(*) FROM kart.reserva_online_voucher_uso WHERE voucher_id = @id AND cliente_id = @cli AND estado IN ('reservado', 'consumido', 'reembolso_pendente'))
             + (SELECT COUNT(*) FROM kart.reserva_grupo_voucher_uso WHERE voucher_id = @id AND cliente_id = @cli AND estado IN ('reservado', 'consumido')) "doCliente"`,
          { id: v.Id, cli: cliAlvoId },
        );
        const extraCli = cliAlvoId ? (usosPorClienteExtra.get(cliAlvoId) ?? 0) : 0;
        const eleg = await avaliarElegibilidadeVoucher({
          voucherId: Number(v.Id),
          usoUnico: Boolean(v.UsoUnico),
          usoMaxTotal: v.UsoMaxTotal == null ? null : Number(v.UsoMaxTotal),
          usoMaxCliente: Number(v.UsoMaxCliente ?? 1),
          restritoClientes: Boolean(v.RestritoClientes),
          usosTotais: Number(usos?.n ?? 0) + usosExtra,
          usosClienteDirecto: Number(usos?.doCliente ?? 0) + extraCli,
          clienteId: cliAlvoId,
          documento: cliAlvoDoc,
          reader: run,
        });
        if (!eleg.ok) throw new HttpError(400, eleg.motivo);
        let d = v.Tipo === 'percentual' ? Math.round((alvo.liquido * (v.Valor as number)) / 100) : (v.Valor as number);
        if (v.DescontoMaximoCentavos) d = Math.min(d, v.DescontoMaximoCentavos as number);
        d = Math.min(d, alvo.liquido);
        alvo.descontoCentavos += d;
        alvo.liquido -= d;
        alvo.voucherId = v.Id as number;
        usosExtra++;
        if (cliAlvoId) usosPorClienteExtra.set(cliAlvoId, extraCli + 1);
        voucherUsos.push({
          clienteId: cliAlvoId,
          desconto: d,
          autoLink: eleg.autoLinkClienteId && eleg.matchedVcId ? { vcId: eleg.matchedVcId, clienteId: eleg.autoLinkClienteId } : null,
        });
      }
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
      const [f] = await run(`SELECT tipo "Tipo" FROM kart.forma_pagamento WHERE id = @formaPagamentoId AND ativo = true`, { formaPagamentoId });
      if (!f) throw new HttpError(400, 'Forma de pagamento inválida.');
      if (f.Tipo === 'dinheiro') dinheiro += valor;
      recebido += valor;
      pagamentos.push({ formaPagamentoId, valor });
    }
    if (validar && recebido < total) throw new HttpError(400, `Ainda faltam ser pagos ${brl(total - recebido)} para poder concluir a compra.`);
    const troco = Math.max(0, recebido - total);
    if (troco > dinheiro) throw new HttpError(400, 'Troco só pode ser dado sobre pagamento em dinheiro. Ajuste os valores.');

    const [venda] = await run(
      `INSERT INTO kart.venda (movimento_id, usuario_id, terminal_id, cliente_id, bruto_centavos, desconto_centavos, acrescimo_centavos, recebido_centavos, troco_centavos, final_centavos, observacao)
        VALUES (@mov, @uid, @term, @cli, @bruto, @desc, @acr, @rec, @troco, @final, @obs) returning id id`,
      { mov: mov.id, uid: sessao.uid, term: mov.terminalId, cli: clienteId, bruto, desc: desconto, acr: acrescimo, rec: recebido, troco, final: total, obs: str(body.observacao, 1000) },
    );
    const vendaId = venda.id as number;
    await run(`UPDATE kart.venda SET codigo = (id)::text WHERE id = @vendaId`, { vendaId });
    let n = 1;
    for (const i of itens) {
      await run(
        `INSERT INTO kart.venda_item (venda_id, item, produto_id, descricao, quantidade, unitario_centavos, desconto_centavos, acrescimo_centavos, liquido_centavos, inscricao_id, voucher_id)
         VALUES (@vendaId, @n, @produtoId, @descricao, @qtd, @unit, @desc, @acr, @liq, @ins, @voucherId)`,
        { vendaId, n: n++, produtoId: i.produtoId, descricao: i.descricao, qtd: i.quantidade, unit: i.unitarioCentavos, desc: i.descontoCentavos, acr: i.acrescimoCentavos, liq: i.liquido, ins: i.inscricaoId, voucherId: i.voucherId ?? null },
      );
      if (i.inscricaoId) {
        await run(
          `UPDATE kart.inscricao SET pago = true, aprovada = true, status = 'confirmada', valor_centavos = @liq, desconto_centavos = @desc, venda_id = @vendaId${i.voucherId ? ', voucher_id = @vid' : ''} WHERE id = @ins`,
          { liq: i.liquido, desc: i.descontoCentavos, vendaId, ins: i.inscricaoId, ...(i.voucherId ? { vid: i.voucherId } : {}) },
        );
      }
    }
    for (const pg of pagamentos) {
      await run(`INSERT INTO kart.venda_pagamento (venda_id, forma_pagamento_id, valor_centavos) VALUES (@vendaId, @f, @v)`, { vendaId, f: pg.formaPagamentoId, v: pg.valor });
    }
    if (voucher) {
      for (const vu of voucherUsos) {
        await run(`INSERT INTO kart.voucher_uso (voucher_id, venda_id, cliente_id, desconto_centavos) VALUES (@v, @vendaId, @cli, @d)`, { v: voucher.Id, vendaId, cli: vu.clienteId ?? clienteId, d: vu.desconto });
        if (vu.autoLink) {
          await run(`UPDATE kart.voucher_cliente SET cliente_id = @cid WHERE id = @vcId AND cliente_id IS NULL`, { cid: vu.autoLink.clienteId, vcId: vu.autoLink.vcId });
        }
      }
      if (voucher.Origem === 'parceiro' && voucher.ParceiroId) {
        const base = itens.filter((i) => i.voucherId === Number(voucher!.Id)).reduce((total, i) => total + i.liquido, 0);
        if (base > 0) {
          const [partner] = await run(`SELECT comissao_percentual percentual FROM kart.parceiro WHERE id = @id AND ativo = true for update`, { id: voucher.ParceiroId });
          if (partner) {
            const rate = Number(partner.percentual);
            const commission = Math.round(base * rate / 100);
            if (commission > 0) {
            const [created] = await run(
              `INSERT INTO kart.parceiro_comissao (parceiro_id, venda_id, base_centavos, percentual, valor_centavos)
                VALUES (@parceiroId, @vendaId, @base, @rate, @valor) returning id id`,
              { parceiroId: voucher.ParceiroId, vendaId, base, rate, valor: commission },
            );
            await run(
              `INSERT INTO kart.parceiro_comissao_transacao (comissao_id, tipo, valor_centavos, motivo, usuario_id)
               VALUES (@id, 'acumulada', @valor, 'Comissão gerada pela venda', @uid)`,
              { id: created.id, valor: commission, uid: sessao.uid },
            );
            }
          }
        }
      }
    }
    // termo já impresso (totem, site ou recepção) não sai de novo depois do pagamento: a Recepção só oferece estes
    const insIds = itens.filter((i) => i.inscricaoId).map((i) => i.inscricaoId as number);
    const semTermo = insIds.length
      ? ((await run(
          `SELECT id id FROM kart.inscricao WHERE id IN (${insIds.map((_, n) => '@t' + n).join(',')}) AND termo_impresso_em IS NULL AND origem <> 'totem'`,
          Object.fromEntries(insIds.map((id, n) => ['t' + n, id])),
        )) as { id: number }[]).map((r) => r.id)
      : [];
    return { id: vendaId, total, recebido, troco, inscricoes: insIds, semTermo };
  });
}

async function estornar(sessao: Sessao, vendaId: number, body: Record<string, unknown>) {
  const itemIds = (Array.isArray(body.itemIds) ? body.itemIds : []).map((x) => int(x, 'Item'));
  if (!itemIds.length) throw new HttpError(400, 'Selecione os itens a estornar.');
  const motivo = str(body.motivo, 400) ?? 'Estorno';
  return tx(async (run) => {
    const [v] = await run(`SELECT v.id "Id", v.movimento_id "MovimentoId", m.fechado_em "FechadoEm" FROM kart.venda v LEFT JOIN kart.movimento m ON m.id = v.movimento_id WHERE v.id = @vendaId`, { vendaId });
    if (!v) throw new HttpError(404, 'Venda não encontrada.');
    if (!v.MovimentoId || v.FechadoEm) throw new HttpError(409, 'Não é possível realizar o estorno. Movimento fechado.');
    let soma = 0;
    let estornouVoucherParceiro = false;
    for (const itemId of itemIds) {
      const [it] = await run(`SELECT id "Id", liquido_centavos "LiquidoCentavos", inscricao_id "InscricaoId", voucher_id "VoucherId", estornado "Estornado" FROM kart.venda_item WHERE id = @itemId AND venda_id = @vendaId`, { itemId, vendaId });
      if (!it || it.Estornado) continue;
      soma += it.LiquidoCentavos as number;
      estornouVoucherParceiro ||= Boolean(it.VoucherId);
      await run(`UPDATE kart.venda_item SET estornado = true, estornado_em = now(), motivo_estorno = @motivo WHERE id = @itemId`, { itemId, motivo });
      if (it.InscricaoId) {
        await run(`UPDATE kart.inscricao SET pago = false, status = CASE WHEN status = 'cancelada' THEN 'cancelada' ELSE 'reservada' END, valor_centavos = NULL, venda_id = NULL, atualizado_em = now() WHERE id = @i`, { i: it.InscricaoId });
      }
    }
    await run(`UPDATE kart.voucher_uso SET estornado = true WHERE venda_id = @vendaId AND EXISTS (SELECT 1 FROM kart.venda_item vi WHERE vi.venda_id = @vendaId AND vi.voucher_id IS NOT NULL AND vi.estornado = true)`, { vendaId });
    const [rest] = await run(`SELECT COUNT(*) n FROM kart.venda_item WHERE venda_id = @vendaId AND estornado = false`, { vendaId });
    await run(
      `UPDATE kart.venda SET estorno_centavos = estorno_centavos + @soma, final_centavos = final_centavos - @soma,
         cancelada = CASE WHEN @rest::int = 0 THEN true ELSE cancelada END, motivo_cancelamento = CASE WHEN @rest::int = 0 THEN @motivo ELSE motivo_cancelamento END WHERE id = @vendaId`,
      { soma, rest: rest.n, motivo: `${motivo} (${sessao.nome})`, vendaId },
    );
    if (estornouVoucherParceiro) {
      const [commission] = await run(`SELECT id "Id", valor_centavos "ValorCentavos", estado "Estado" FROM kart.parceiro_comissao WHERE venda_id = @vendaId for update`, { vendaId });
      if (commission && commission.Estado !== 'estornada') {
        await run(
          `INSERT INTO kart.parceiro_comissao_transacao (comissao_id, tipo, valor_centavos, motivo, usuario_id)
           VALUES (@id, 'cancelamento_venda', -@valor, @motivo, @uid)`,
          { id: commission.Id, valor: commission.ValorCentavos, motivo: `Estorno da venda ${vendaId}: ${motivo}`.slice(0, 400), uid: sessao.uid },
        );
        await run(`UPDATE kart.parceiro_comissao SET estado = 'estornada', atualizada_em = now() WHERE id = @id`, { id: commission.Id });
      }
    }
    return { estornado: soma };
  });
}

// ---------------------------------------------------------------- roteador

/**
 * Bateria de campeonato: aparece no totem, no site e na Recepção pelo nome do campeonato (nunca "BATERIA" nem
 * "grupo do organizador") e fica sempre aberta para o piloto se inscrever (online antecipado ou no totem).
 */
function campeonatoDe(b: Record<string, unknown>, nome: string | null) {
  const sim = b.campeonato === true || b.campeonato === 1 || b.campeonato === '1';
  if (sim && (!nome || /^bateria$/i.test(nome.trim()))) throw new HttpError(400, 'Informe o nome do campeonato no nome da bateria.');
  return sim;
}

export async function officeRoutes(req: Req, send: Res): Promise<boolean> {
  const { method, url, sessao } = req;
  const path = url.pathname.replace(/^\/api\/office/, '');
  await exigePermissaoOffice(sessao, path, method);
  let m: RegExpMatchArray | null;

  const mobilePermissionRoute = path.match(/^\/mobile-permissions\/([a-z_]+)$/);
  if (mobilePermissionRoute && method === 'GET') {
    if (!mobilePermissions.has(mobilePermissionRoute[1])) throw new HttpError(404, 'Permissão não encontrada.');
    send(200, { allowed: await mobilePermission(sessao, mobilePermissionRoute[1]) });
    return true;
  }

  if (path === '/mobile-identities/link' && method === 'POST') {
    if (!await mobilePermission(sessao, 'identidade_mobile_vincular')) throw new HttpError(403, 'Seu perfil não pode vincular contas do app.');
    const body = await req.body();
    const customerId = int(body.customerId, 'Cliente');
    const cpf = body.cpf === undefined ? '' : onlyDigits(body.cpf);
    const email = String(body.email ?? '').trim().toLowerCase();
    if ((body.cpf !== undefined && !isValidCpf(cpf)) || email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) || (!cpf && !email)) {
      throw new HttpError(400, 'Informe um CPF válido ou o e-mail verificado da conta do app.');
    }
    if (!await one(`SELECT id id FROM kart.cliente WHERE id = @id`, { id: customerId })) throw new HttpError(404, 'Cliente não encontrado.');

    const destination = process.env.MOBILE_IDENTITY_LINK_URL;
    const adminToken = process.env.MOBILE_ADMIN_TOKEN;
    if (!destination || !adminToken) throw new HttpError(503, 'O vínculo de contas do app ainda não está configurado.');
    const endpoint = mobileApiEndpoint(destination, '/api/mobile/v1/internal/identity-links');
    if (!endpoint) throw new HttpError(503, 'O destino do vínculo de contas não é o Worker móvel autorizado.');
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mobile-admin-token': adminToken },
        body: JSON.stringify({ customerId: String(customerId), ...(cpf ? { cpf } : {}), ...(email ? { email } : {}) }),
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new HttpError(502, 'Não foi possível concluir o vínculo com o app agora.');
    }
    if (response.status === 409) throw new HttpError(409, 'Este cliente ou esta conta já está vinculado.');
    if (response.status === 404) throw new HttpError(400, 'Não foi possível validar o e-mail. Confirme o endereço e se a conta verificou o e-mail.');
    if (!response.ok) throw new HttpError(502, 'Não foi possível concluir o vínculo com o app agora.');
    send(200, { ok: true });
    return true;
  }

  if (path === '/servicos-online' && method === 'GET') {
    send(200, await servicosOnline());
    return true;
  }

  // ---------- fidelidade
  if (path === '/fidelidade/contas' && method === 'GET') {
    const q = str(url.searchParams.get('q'), 100);
    const rows = await query(
      `SELECT a.id id, a.cliente_id "clienteId", c.nome nome, c.documento documento, c.email email, c.telefone telefone,
              a.saldo_pontos saldo, a.saldo_pontos "saldoCentavos", a.ativo ativo, to_char(a.criado_em, 'YYYY-MM-DD"T"HH24:MI') "criadaEm",
              (SELECT COUNT(*) FROM kart.inscricao i WHERE i.cliente_id = a.cliente_id AND i.pago = true AND i.status <> 'cancelada') baterias,
              (SELECT COUNT(*) FROM kart.fidelidade_transacao ft WHERE ft.conta_id = a.id) transacoes
       FROM kart.fidelidade_conta a JOIN kart.cliente c ON c.id = a.cliente_id
       ${q ? 'WHERE unaccent(c.nome) ILIKE unaccent(@q) OR c.documento ILIKE @q' : ''}
       ORDER BY c.nome, a.id limit 2000`, q ? { q: `%${q}%` } : {},
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
        const [cliente] = await run(`SELECT id "Id" FROM kart.cliente WHERE id = @clienteId for update`, { clienteId });
        if (!cliente) throw new HttpError(404, 'Cliente não encontrado.');
        const [existente] = await run(`SELECT id id FROM kart.fidelidade_conta WHERE cliente_id = @clienteId for update`, { clienteId });
        if (existente) return Number(existente.id);
        const [novo] = await run(`INSERT INTO kart.fidelidade_conta (cliente_id)  VALUES (@clienteId) returning id id`, { clienteId });
        criada = true;
        return Number(novo.id);
      });
    } catch (e) {
      if (!duplicateSql(e)) throw e;
      const existente = await one<{ id: number }>(`SELECT id id FROM kart.fidelidade_conta WHERE cliente_id = @clienteId`, { clienteId });
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
      `SELECT a.id id, a.cliente_id "clienteId", c.nome nome, c.documento documento, c.email email, c.telefone telefone,
              a.saldo_pontos saldo, a.saldo_pontos "saldoCentavos", a.ativo ativo, to_char(a.criado_em, 'YYYY-MM-DD"T"HH24:MI') "criadaEm",
              (SELECT COUNT(*) FROM kart.inscricao i WHERE i.cliente_id = a.cliente_id AND i.pago = true AND i.status <> 'cancelada') baterias,
              (SELECT COUNT(*) FROM kart.fidelidade_transacao ft WHERE ft.conta_id = a.id) transacoes
       FROM kart.fidelidade_conta a JOIN kart.cliente c ON c.id = a.cliente_id WHERE a.id = @id`, { id },
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
    const exists = await one<{ id: number }>(`SELECT id id FROM kart.fidelidade_conta WHERE id = @id`, { id });
    if (!exists) throw new HttpError(404, 'Conta de fidelidade não encontrada.');
    const ativo = bit(b.ativo);
    await query(`UPDATE kart.fidelidade_conta SET ativo = @ativo, atualizado_em = now() WHERE id = @id`, { id, ativo });
    if (!ativo) await query(`UPDATE kart.voucher SET ativo = false WHERE fidelidade_conta_id = @id`, { id });
    send(200, { id, ativo: Boolean(ativo) });
    return true;
  }
  if ((m = path.match(/^\/fidelidade\/contas\/(\d+)\/transacoes$/)) && method === 'GET') {
    const id = int(m[1], 'Conta');
    const filtro = periodo(url, 'ft.criado_em');
    const conta = await one(`SELECT id id FROM kart.fidelidade_conta WHERE id = @id`, { id });
    if (!conta) throw new HttpError(404, 'Conta de fidelidade não encontrada.');
    send(200, await query(
      `SELECT ft.id id, to_char(ft.criado_em, 'YYYY-MM-DD"T"HH24:MI') "dataHora", c.nome conta, ft.tipo tipo, ft.pontos pontos,
              ft.saldo_apos "saldoApos", ft.motivo motivo, u.nome usuario
       FROM kart.fidelidade_transacao ft JOIN kart.fidelidade_conta a ON a.id = ft.conta_id JOIN kart.cliente c ON c.id = a.cliente_id
       JOIN kart.usuario u ON u.id = ft.usuario_id WHERE ft.conta_id = @id AND ${filtro.where} ORDER BY ft.criado_em DESC, ft.id DESC`,
      { ...filtro.p, id },
    ));
    return true;
  }
  if (path === '/fidelidade/transacoes' && method === 'GET') {
    const filtro = periodo(url, 'ft.criado_em');
    send(200, await query(
      `SELECT ft.id id, to_char(ft.criado_em, 'YYYY-MM-DD"T"HH24:MI') "dataHora", c.nome conta, ft.tipo tipo, ft.pontos pontos,
              ft.saldo_apos "saldoApos", ft.motivo motivo, u.nome usuario
       FROM kart.fidelidade_transacao ft JOIN kart.fidelidade_conta a ON a.id = ft.conta_id JOIN kart.cliente c ON c.id = a.cliente_id
       JOIN kart.usuario u ON u.id = ft.usuario_id WHERE ${filtro.where} ORDER BY ft.criado_em DESC, ft.id DESC limit 5000`, filtro.p,
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
      const [account] = await run(`SELECT id "Id", saldo_pontos "SaldoPontos" FROM kart.fidelidade_conta WHERE id = @id AND ativo = true for update`, { id });
      if (!account) throw new HttpError(404, 'Conta de fidelidade não encontrada ou inativa.');
      const [previous] = await run(`SELECT id id, pontos pontos, saldo_apos "saldoApos", motivo motivo FROM kart.fidelidade_transacao WHERE conta_id = @id AND idempotency_key = @key`, { id, key });
      if (previous) {
        if (Number(previous.pontos) !== delta || previous.motivo !== motivo) throw new HttpError(409, 'A chave de idempotência já foi usada para outro ajuste.');
        return { ...previous, repetido: true };
      }
      const [updated] = await run(
        `UPDATE kart.fidelidade_conta SET saldo_pontos = saldo_pontos + @delta, atualizado_em = now()
          WHERE id = @id AND saldo_pontos + @delta >= 0 returning saldo_pontos "saldoApos"`, { id, delta },
      );
      if (!updated) throw new HttpError(409, 'O ajuste deixaria o saldo de pontos abaixo de zero.');
      const [created] = await run(
        `INSERT INTO kart.fidelidade_transacao (conta_id, tipo, pontos, saldo_apos, motivo, idempotency_key, usuario_id)
          VALUES (@id, 'ajuste', @delta, @saldo, @motivo, @key, @uid) returning id id`,
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
      `SELECT p.id id, p.nome nome, p.documento documento, p.contato contato, p.telefone telefone, p.email email,
              p.comissao_percentual "comissaoPercentual", p.ativo ativo, to_char(p.criado_em, 'YYYY-MM-DD"T"HH24:MI') "criadoEm",
              (SELECT COUNT(*) FROM kart.parceiro_comissao pc WHERE pc.parceiro_id = p.id) "vendasIndicadas",
              (SELECT v.codigo FROM kart.voucher v WHERE v.parceiro_id = p.id AND v.ativo = true ORDER BY v.criado_em DESC, v.id DESC LIMIT 1) voucher,
              coalesce((SELECT SUM(CASE WHEN pc.estado = 'pendente' THEN pc.valor_centavos ELSE 0 END) FROM kart.parceiro_comissao pc WHERE pc.parceiro_id = p.id), 0) "comissaoPendenteCentavos",
              coalesce((SELECT SUM(-pt.valor_centavos) FROM kart.parceiro_comissao_transacao pt JOIN kart.parceiro_comissao pc ON pc.id = pt.comissao_id WHERE pc.parceiro_id = p.id AND pt.tipo = 'pagamento'), 0) "comissaoPagaCentavos",
              coalesce((SELECT SUM(pt.valor_centavos) FROM kart.parceiro_comissao_transacao pt JOIN kart.parceiro_comissao pc ON pc.id = pt.comissao_id WHERE pc.parceiro_id = p.id), 0) "comissaoSaldoCentavos"
       FROM kart.parceiro p ${q ? 'WHERE unaccent(p.nome) ILIKE unaccent(@q) OR p.documento ILIKE @q' : ''} ORDER BY p.nome limit 2000`,
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
        `INSERT INTO kart.parceiro (nome, documento, contato, telefone, email, comissao_percentual)
          VALUES (@nome, @documento, @contato, @telefone, @email, @rate) returning id id`, fields,
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
    const p = await one(`SELECT id id, nome nome, documento documento, contato contato, telefone telefone, email email, comissao_percentual "comissaoPercentual", ativo ativo FROM kart.parceiro WHERE id = @id`, { id });
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
      const changed = await query(`UPDATE kart.parceiro SET ${Object.keys(vals).map((c) => `${colPg(c)} = @${c}`).join(', ')} WHERE id = @id`, { ...vals, id });
      const found = await one<{ id: number }>(`SELECT id id FROM kart.parceiro WHERE id = @id`, { id });
      if (!found) throw new HttpError(404, 'Parceiro não encontrado.');
      if ('Ativo' in vals && vals.Ativo === 0) await query(`UPDATE kart.voucher SET ativo = false WHERE parceiro_id = @id`, { id });
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
    const changed = await query(`UPDATE kart.parceiro SET ativo = false, atualizado_em = now() WHERE id = @id`, { id });
    const found = await one<{ id: number }>(`SELECT id id FROM kart.parceiro WHERE id = @id`, { id });
    if (!found) throw new HttpError(404, 'Parceiro não encontrado.');
    await query(`UPDATE kart.voucher SET ativo = false WHERE parceiro_id = @id`, { id });
    void changed;
    send(200, { ok: true, desativado: true });
    return true;
  }
  if (path === '/parceiros/comissoes' && method === 'GET') {
    const status = url.searchParams.get('status') || 'todas';
    if (!['todas', 'pendentes', 'pagas', 'estornadas'].includes(status)) throw new HttpError(400, 'Filtro de situação inválido.');
    const where = status === 'todas' ? '' : `WHERE pc.estado = @estado`;
    const filtro = periodo(url, status === 'pagas' ? 'coalesce(ultima.criada_em, pc.criada_em)' : 'pc.criada_em');
    const whereSql = [where.replace(/^WHERE\s*/, ''), filtro.where].filter(Boolean).join(' AND ');
    const partnerId = url.searchParams.get('parceiroId');
    const params = { ...filtro.p, ...(status === 'todas' ? {} : { estado: status === 'pagas' ? 'paga' : status === 'estornadas' ? 'estornada' : 'pendente' }), ...(partnerId ? { parceiroId: int(partnerId, 'Parceiro') } : {}) };
    send(200, await query(
      `SELECT pc.id id, pc.parceiro_id "parceiroId", p.nome parceiro, pc.venda_id "vendaId",
              to_char(pc.criada_em, 'YYYY-MM-DD"T"HH24:MI') data, c.nome cliente, pc.base_centavos "valorVendaCentavos",
              pc.percentual percentual, pc.valor_centavos "comissaoCentavos", pc.estado situacao,
              coalesce((SELECT SUM(CASE WHEN t.tipo = 'acumulada' THEN t.valor_centavos ELSE 0 END) FROM kart.parceiro_comissao_transacao t WHERE t.comissao_id = pc.id), 0) "acumuladoCentavos",
              coalesce((SELECT -SUM(CASE WHEN t.tipo IN ('pagamento', 'estorno_pagamento') THEN t.valor_centavos ELSE 0 END) FROM kart.parceiro_comissao_transacao t WHERE t.comissao_id = pc.id), 0) "pagoCentavos",
              coalesce((SELECT SUM(t.valor_centavos) FROM kart.parceiro_comissao_transacao t WHERE t.comissao_id = pc.id), 0) "saldoCentavos",
              ultima.forma_pagamento_id "formaPagamentoId", ultima."formaPagamento" "metodoPagamento", ultima."dataHora" "pagoEm"
       FROM kart.parceiro_comissao pc JOIN kart.parceiro p ON p.id = pc.parceiro_id JOIN kart.venda v ON v.id = pc.venda_id
       LEFT JOIN kart.cliente c ON c.id = v.cliente_id
       LEFT JOIN LATERAL (SELECT t.forma_pagamento_id, f.nome "formaPagamento", t.criada_em, to_char(t.criada_em, 'YYYY-MM-DD"T"HH24:MI') "dataHora"
                    FROM kart.parceiro_comissao_transacao t LEFT JOIN kart.forma_pagamento f ON f.id = t.forma_pagamento_id
                    WHERE t.comissao_id = pc.id AND t.tipo IN ('pagamento', 'estorno_pagamento') ORDER BY t.criada_em DESC, t.id DESC LIMIT 1) ultima ON true
       WHERE ${whereSql}${partnerId ? ' AND pc.parceiro_id = @parceiroId' : ''} ORDER BY pc.criada_em DESC, pc.id DESC limit 5000`, params,
    ));
    return true;
  }
  if ((m = path.match(/^\/parceiros\/comissoes\/(\d+)\/transacoes$/)) && method === 'GET') {
    const id = int(m[1], 'Comissão');
    const found = await one<{ id: number }>(`SELECT id id FROM kart.parceiro_comissao WHERE id = @id`, { id });
    if (!found) throw new HttpError(404, 'Comissão não encontrada.');
    send(200, await query(
      `SELECT t.id id, to_char(t.criada_em, 'YYYY-MM-DD"T"HH24:MI') "dataHora", t.tipo tipo, t.valor_centavos "valorCentavos",
              t.motivo motivo, f.nome "formaPagamento", u.nome usuario
       FROM kart.parceiro_comissao_transacao t LEFT JOIN kart.forma_pagamento f ON f.id = t.forma_pagamento_id
       LEFT JOIN kart.usuario u ON u.id = t.usuario_id WHERE t.comissao_id = @id ORDER BY t.criada_em DESC, t.id DESC`, { id },
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
    const forma = await one<{ id: number }>(`SELECT id id FROM kart.forma_pagamento WHERE id = @id AND ativo = true`, { id: formaPagamentoId });
    if (!forma) throw new HttpError(400, 'Forma de pagamento inválida.');
    const motivo = action === 'estornar' ? str(b.motivo, 400) : 'Pagamento de comissão';
    if (!motivo) throw new HttpError(400, 'Informe o motivo do estorno da comissão.');
    const result = await tx(async (run) => {
      const [comissao] = await run(`SELECT id "Id", valor_centavos "ValorCentavos", estado "Estado" FROM kart.parceiro_comissao WHERE id = @id for update`, { id });
      if (!comissao) throw new HttpError(404, 'Comissão não encontrada.');
      const expectedType = action === 'pagar' ? 'pagamento' : 'estorno_pagamento';
      const [previous] = await run(`SELECT id id, tipo tipo, motivo motivo, forma_pagamento_id "formaPagamentoId" FROM kart.parceiro_comissao_transacao WHERE comissao_id = @id AND idempotency_key = @key`, { id, key });
      if (previous) {
        if (previous.tipo !== expectedType || previous.motivo !== motivo || Number(previous.formaPagamentoId) !== formaPagamentoId) throw new HttpError(409, 'A chave de idempotência já foi usada para outra ação.');
        return { id, estado: comissao.Estado, repetido: true };
      }
      if (action === 'pagar' && comissao.Estado !== 'pendente') throw new HttpError(409, 'Somente comissões pendentes podem ser pagas.');
      if (action === 'estornar' && comissao.Estado !== 'paga') throw new HttpError(409, 'Somente pagamentos realizados podem ser estornados.');
      const tipo = expectedType;
      const valor = action === 'pagar' ? -Number(comissao.ValorCentavos) : Number(comissao.ValorCentavos);
      await run(
        `INSERT INTO kart.parceiro_comissao_transacao (comissao_id, tipo, valor_centavos, motivo, idempotency_key, forma_pagamento_id, usuario_id)
         VALUES (@id, @tipo, @valor, @motivo, @key, @formaPagamentoId, @uid)`, { id, tipo, valor, motivo, key, formaPagamentoId, uid: sessao.uid },
      );
      const estado = action === 'pagar' ? 'paga' : 'pendente';
      await run(`UPDATE kart.parceiro_comissao SET estado = @estado, atualizada_em = now() WHERE id = @id`, { id, estado });
      return { id, estado, repetido: false };
    });
    send(result.repetido ? 200 : 201, result);
    return true;
  }

  // ---------- listas da arvore
  // reserva online (reservas.kartodromodebetim.com.br): pedidos do site, para a recepção acompanhar.
  // "atencao" = pagou depois dos 15 min e o horário lotou: a recepção devolve o valor ou remarca e marca como resolvido.
  if (path === '/reservas-online' && method === 'GET') {
    const st = url.searchParams.get('status') || 'todas';
    const where: string[] = [];
    let p: Record<string, unknown> = {};
    if (st === 'atencao') where.push("r.status = 'pago_sem_vaga'");
    else {
      const per = periodo(url, 'r.criado_em');
      where.push(per.where); p = per.p;
      if (st === 'pagas') where.push("r.status IN ('pago', 'resolvido')");
    }
    send(200, await query(
      `SELECT r.id id, r.codigo codigo, to_char(r.criado_em, 'YYYY-MM-DD"T"HH24:MI:SS') "dataHora", r.cliente_id "clienteId", c.nome cliente, c.telefone telefone,
              b.id "bateriaId", b.nome bateria, to_char(b.inicio, 'YYYY-MM-DD"T"HH24:MI:SS') inicio, r.quantidade quantidade, r.valor_centavos valor,
              r.forma forma, r.status status, r.pilotos pilotos, to_char(r.pago_em, 'YYYY-MM-DD"T"HH24:MI:SS') "pagoEm", r.asaas_pagamento_id asaas
         FROM kart.reserva_online r JOIN kart.cliente c ON c.id = r.cliente_id JOIN kart.bateria b ON b.id = r.bateria_id
        WHERE ${where.join(' AND ')} ORDER BY r.criado_em DESC`,
      p,
    ));
    return true;
  }
  if ((m = path.match(/^\/reservas-online\/(\d+)\/resolver$/)) && method === 'POST') {
    const { resolucao } = await req.body();
    // Recepção até a 1.0.69 manda só "resolvido", sem dizer se devolveu ou remarcou: vale para pedido sem cupom pendente
    const legado = resolucao === undefined || resolucao === null || resolucao === '';
    if (!legado && resolucao !== 'reembolso_confirmado' && resolucao !== 'remarcado') throw new HttpError(400, 'Confirme o reembolso ou a remarcação antes de resolver.');
    if (legado && await one(
      `SELECT 1 x FROM kart.reserva_online_voucher_uso u JOIN kart.reserva_online r ON r.pedido_id = u.pedido_id WHERE r.id = @id AND u.estado = 'reembolso_pendente' limit 1`,
      { id: Number(m![1]) },
    )) throw new HttpError(400, 'Este pedido usou cupom: atualize a Recepção para dizer se o valor foi devolvido ou se o cliente foi remarcado.');
    const estadoUso = resolucao === 'reembolso_confirmado' ? 'liberado' : 'consumido';
    const r = await tx(async (run) => {
      const [pedido] = await run(
        `UPDATE kart.reserva_online SET status = 'resolvido'  WHERE id = @id AND status = 'pago_sem_vaga' returning codigo`,
        { id: Number(m![1]) },
      );
      if (!pedido) return null;
      await run(
        `UPDATE kart.reserva_online_voucher_uso SET estado = @estado WHERE pedido_id = (SELECT pedido_id "PedidoId" FROM kart.reserva_online WHERE id = @id) AND estado = 'reembolso_pendente'`,
        { id: Number(m![1]), estado: estadoUso },
      );
      return pedido;
    });
    if (!r) throw new HttpError(409, 'Este pedido não está mais pendente.');
    send(200, { ok: true, resolucao: legado ? 'resolvido' : resolucao });
    return true;
  }
  if (path === '/reservas' && method === 'GET') {
    const st = url.searchParams.get('status') || 'todas';
    const where = ["b.status <> 'cancelada'"];
    if (st === 'aprovar') where.push("NOT i.aprovada AND i.status <> 'cancelada'");
    // equipes de Endurance são da organização do evento: não entram em Aprovadas nem em Pagamento pendente
    else if (st === 'aprovadas') where.push("i.aprovada AND i.status <> 'cancelada' AND NOT EXISTS (SELECT 1 FROM kart.endurance_evento ev WHERE ev.bateria_id = i.bateria_id AND ev.ativo)");
    else if (st === 'pendentes') where.push("i.aprovada AND NOT i.pago AND i.status <> 'cancelada' AND coalesce(i.preco_centavos, p.preco_centavos) - i.desconto_centavos > 0 AND NOT EXISTS (SELECT 1 FROM kart.endurance_evento ev WHERE ev.bateria_id = i.bateria_id AND ev.ativo)");
    else if (st === 'canceladas') where.push("i.status = 'cancelada'");
    const bat = url.searchParams.get('bateriaId');
    let p: Record<string, unknown> = {};
    if (bat) {
      where.push('i.bateria_id = @bat');
      p.bat = int(bat, 'Bateria');
    } else {
      const per = periodo(url, 'b.inicio');
      where.push(per.where);
      p = per.p;
    }
    send(200, await query(`${RESERVA_SELECT} WHERE ${where.join(' AND ')} ORDER BY b.inicio, i.id limit 5000`, p));
    return true;
  }
  if (path === '/baterias' && method === 'GET') {
    const st = url.searchParams.get('status') || 'abertas';
    const where = ["b.status <> 'cancelada'"];
    if (st === 'abertas') where.push("b.status = 'aberta'");
    else if (st === 'fechadas') where.push("b.status = 'fechada'");
    const per = periodo(url, 'b.inicio');
    where.push(per.where);
    const baterias = await query<{ id: number; [key: string]: unknown }>(`${BATERIA_SELECT} WHERE ${where.join(' AND ')} ORDER BY b.inicio limit 5000`, per.p);
    if (!baterias.length) { send(200, []); return true; }
    const ids = baterias.map((b) => Number(b.id)).join(',');
    const inscricoes = await query<{ id: number; bateriaId: number; pago: boolean; total: number }>(
      `SELECT i.id id, i.bateria_id "bateriaId", i.pago pago,
        CASE WHEN coalesce(i.preco_centavos, p.preco_centavos) - coalesce(i.desconto_centavos, 0) < 0 THEN 0
             ELSE coalesce(i.preco_centavos, p.preco_centavos) - coalesce(i.desconto_centavos, 0) END total
       FROM kart.inscricao i JOIN kart.bateria b ON b.id = i.bateria_id
       LEFT JOIN kart.produto p ON p.id = coalesce(i.produto_id, b.produto_id)
       WHERE i.status <> 'cancelada' AND i.bateria_id IN (${ids})`);
    const { carregarGrupos } = await import('./grupos');
    const grupos = await carregarGrupos(`g.status = 'ativa' AND g.bateria_id IN (${ids})`, {});
    send(200, saldosDasBaterias(baterias, inscricoes, grupos));
    return true;
  }
  if (path === '/vendas' && method === 'GET') {
    const st = url.searchParams.get('status') || 'liquidadas';
    const where: string[] = [];
    if (st === 'liquidadas') where.push('v.cancelada = false');
    else if (st === 'canceladas') where.push('(v.cancelada = true OR v.estorno_centavos > 0)');
    const per = periodo(url, 'v.criado_em');
    where.push(per.where);
    send(200, await query(`${VENDA_SELECT} WHERE ${where.join(' AND ')} ORDER BY v.criado_em DESC limit 5000`, per.p));
    return true;
  }
  if ((m = path.match(/^\/vendas\/(\d+)$/)) && method === 'GET') {
    const id = Number(m[1]);
    const venda = await one(`${VENDA_SELECT} WHERE v.id = @id`, { id });
    if (!venda) throw new HttpError(404, 'Venda não encontrada.');
    const itens = await query(
      `SELECT id id, item item, descricao descricao, quantidade quantidade, unitario_centavos unitario, desconto_centavos desconto, acrescimo_centavos acrescimo,
              liquido_centavos liquido, estornado estornado, inscricao_id "inscricaoId", motivo_estorno motivo FROM kart.venda_item WHERE venda_id = @id ORDER BY item`,
      { id },
    );
    const pagamentos = await query(
      `SELECT coalesce(f.nome, 'Outros') forma, vp.valor_centavos valor, vp.cancelado cancelado FROM kart.venda_pagamento vp LEFT JOIN kart.forma_pagamento f ON f.id = vp.forma_pagamento_id WHERE vp.venda_id = @id`,
      { id },
    );
    send(200, { ...venda, itens, pagamentos });
    return true;
  }
  if (path === '/manutencoes' && method === 'GET') {
    const st = url.searchParams.get('status') || 'arealizar';
    // "A realizar" = o que precisa de atenção: vencido ou com 80% do limite. Antes listava os 294 controles
    // (até kart com 5 min de uso) e o selo laranja ficava sempre aceso; "Todas" continua mostrando tudo.
    const where = st === 'arealizar'
      ? 'WHERE m.realizada = false AND (coalesce(it.tempo_horas, 0) = 0 OR m.minutos_uso >= it.tempo_horas * 48)'
      : st === 'realizadas' ? 'WHERE m.realizada = true' : '';
    send(
      200,
      await query(
        `SELECT m.id id, trim(m.kart) kart, m.categoria categoria, it.nome item, m.minutos_uso "minutosUso", it.tempo_horas "limiteHoras",
                to_char(m.ultima_manutencao, 'YYYY-MM-DD"T"HH24:MI') "ultimaManutencao", m.realizada realizada, to_char(m.data, 'YYYY-MM-DD"T"HH24:MI') data
         FROM kart.manutencao m LEFT JOIN kart.item_manutencao it ON it.id = m.item_id ${where} ORDER BY CASE WHEN trim(m.kart) ~ '^[0-9]+$' THEN trim(m.kart)::int END NULLS FIRST, m.kart`,
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
        `UPDATE kart.manutencao SET realizada = @r::int = 1, ultima_manutencao = CASE WHEN @r::int = 1 THEN now() ELSE ultima_manutencao END,
           minutos_uso = CASE WHEN @r::int = 1 THEN 0 ELSE minutos_uso END, data = now() WHERE id = @id`,
        { r: realizada, id },
      );
    }
    send(200, { ok: true });
    return true;
  }
  if (path === '/vouchers' && method === 'GET') {
    await garantirSchemaVouchers();
    const [vouchers, todosBens, todosUsos] = await Promise.all([
      query<Record<string, unknown>>(
        `SELECT v.id id, v.codigo codigo, v.origem origem, v.referencia referencia, v.parceiro_id "parceiroId", ppar.nome parceiro,
                v.fidelidade_conta_id "fidelidadeContaId", c.nome conta, v.tipo tipo, v.valor valor, to_char(v.inicio_em, 'YYYY-MM-DD') inicio,
                to_char(v.fim_em, 'YYYY-MM-DD') fim, v.produto_id "produtoId", p.nome produto, v.uso_max_cliente "usoMaxCliente",
                v.uso_max_total "usoMaxTotal", v.uso_unico "usoUnico", v.restrito_clientes "restritoClientes",
                v.pedido_minimo_centavos "pedidoMinimo", v.desconto_maximo_centavos "descontoMaximo", v.ativo ativo,
                to_char(now(), 'YYYY-MM-DD') hoje,
                (SELECT COUNT(*) FROM kart.voucher_uso u WHERE u.voucher_id = v.id AND u.estornado = false) "usosRecepcao",
                (SELECT COUNT(*) FROM kart.reserva_online_voucher_uso o WHERE o.voucher_id = v.id AND o.estado IN ('reservado', 'consumido', 'reembolso_pendente')) "usosOnline",
                (SELECT COUNT(*) FROM kart.reserva_grupo_voucher_uso gv WHERE gv.voucher_id = v.id AND gv.estado IN ('reservado', 'consumido')) "usosGrupo"
         FROM kart.voucher v LEFT JOIN kart.produto p ON p.id = v.produto_id LEFT JOIN kart.parceiro ppar ON ppar.id = v.parceiro_id
         LEFT JOIN kart.fidelidade_conta fc ON fc.id = v.fidelidade_conta_id LEFT JOIN kart.cliente c ON c.id = fc.cliente_id ORDER BY v.id DESC`,
      ),
      query<{ voucherId: number; clienteId: number | null; nome: string; documento: string | null; usosMax: number }>(
        `SELECT vc.voucher_id "voucherId", vc.cliente_id "clienteId",
                COALESCE(NULLIF(trim(c.nome), ''), vc.nome) nome,
                COALESCE(NULLIF(vc.documento, ''), NULLIF(c.documento_num, ''), REPLACE(REPLACE(REPLACE(c.documento, '.', ''), '-', ''), '/', '')) documento,
                vc.usos_max "usosMax"
         FROM kart.voucher_cliente vc LEFT JOIN kart.cliente c ON c.id = vc.cliente_id`,
      ),
      query<{ voucherId: number; clienteId: number | null; documento: string | null }>(
        `SELECT u.voucher_id "voucherId", u.cliente_id "clienteId",
                COALESCE(NULLIF(c.documento_num, ''), REPLACE(REPLACE(REPLACE(c.documento, '.', ''), '-', ''), '/', '')) documento
         FROM (
           SELECT voucher_id, cliente_id FROM kart.voucher_uso WHERE estornado = false
           UNION ALL
           SELECT voucher_id, cliente_id FROM kart.reserva_online_voucher_uso WHERE estado IN ('reservado', 'consumido', 'reembolso_pendente')
           UNION ALL
           SELECT voucher_id, cliente_id FROM kart.reserva_grupo_voucher_uso WHERE estado IN ('reservado', 'consumido')
         ) u LEFT JOIN kart.cliente c ON c.id = u.cliente_id`,
      ),
    ]);
    const bensPorVoucher = new Map<number, typeof todosBens>();
    for (const b of todosBens) {
      const vid = Number(b.voucherId);
      const arr = bensPorVoucher.get(vid) ?? [];
      arr.push(b);
      bensPorVoucher.set(vid, arr);
    }
    const usosPorVoucher = new Map<number, typeof todosUsos>();
    for (const u of todosUsos) {
      const vid = Number(u.voucherId);
      const arr = usosPorVoucher.get(vid) ?? [];
      arr.push(u);
      usosPorVoucher.set(vid, arr);
    }
    const lista = vouchers.map((v) => {
      const id = Number(v.id);
      const usosRec = Number(v.usosRecepcao ?? 0);
      const usosOnl = Number(v.usosOnline ?? 0);
      const usosGrp = Number(v.usosGrupo ?? 0);
      const usos = usosRec + usosOnl + usosGrp;
      const bens = bensPorVoucher.get(id) ?? [];
      const uList = usosPorVoucher.get(id) ?? [];
      const bensComUso = bens.map((b) => {
        const docB = normalizarDocVoucher(b.documento);
        const feitos = uList.filter((u) =>
          (b.clienteId && u.clienteId === b.clienteId)
          || (docB && normalizarDocVoucher(u.documento) === docB),
        ).length;
        return { nome: b.nome, documento: docB, usosMax: Math.max(1, Number(b.usosMax || 1)), usosFeitos: feitos };
      });
      const resumo = resumirStatusVoucher({
        ativo: Boolean(v.ativo),
        usoUnico: Boolean(v.usoUnico),
        usoMaxTotal: v.usoMaxTotal == null ? null : Number(v.usoMaxTotal),
        restritoClientes: Boolean(v.restritoClientes),
        usos,
        fim: String(v.fim ?? ''),
        hoje: String(v.hoje ?? ''),
        beneficiarios: bensComUso,
      });
      return {
        ...v,
        usoMaxTotal: v.usoMaxTotal == null ? null : Number(v.usoMaxTotal),
        restritoClientes: Boolean(v.restritoClientes),
        usos,
        usosRecepcao: usosRec,
        usosOnline: usosOnl,
        usosGrupo: usosGrp,
        beneficiariosTotal: bensComUso.length,
        beneficiariosUsaram: bensComUso.filter((b) => b.usosFeitos >= b.usosMax).length,
        beneficiarios: bensComUso,
        ...resumo,
      };
    });
    send(200, lista);
    return true;
  }
  if (path === '/vouchers/uso' && method === 'GET') {
    await garantirSchemaVouchers();
    const vid = url.searchParams.get('voucherId') ? int(url.searchParams.get('voucherId'), 'Voucher') : null;
    send(
      200,
      await query(
        `SELECT * FROM (
           SELECT u.id id, v.id "voucherId", v.codigo voucher, c.id "clienteId", COALESCE(c.nome, 'Cliente balcão') cliente,
                  c.documento documento, u.desconto_centavos desconto, u.venda_id "vendaId", to_char(u.criado_em, 'YYYY-MM-DD"T"HH24:MI') "dataHora",
                  u.estornado estornado, 'recepcao' canal, 'Recepção' "canalLabel"
           FROM kart.voucher_uso u JOIN kart.voucher v ON v.id = u.voucher_id LEFT JOIN kart.cliente c ON c.id = u.cliente_id
           UNION ALL
           SELECT o.id + 1000000 id, v.id "voucherId", v.codigo voucher, c.id "clienteId", COALESCE(c.nome, 'Site') cliente,
                  c.documento documento, o.desconto_centavos desconto, NULL "vendaId", to_char(o.criado_em, 'YYYY-MM-DD"T"HH24:MI') "dataHora",
                  o.estado = 'liberado' estornado, 'site' canal, 'Reserva online' "canalLabel"
           FROM kart.reserva_online_voucher_uso o JOIN kart.voucher v ON v.id = o.voucher_id LEFT JOIN kart.cliente c ON c.id = o.cliente_id
           UNION ALL
           SELECT gv.id + 2000000 id, v.id "voucherId", v.codigo voucher, c.id "clienteId", COALESCE(c.nome, 'Grupo') cliente,
                  c.documento documento, gv.desconto_centavos desconto, NULL "vendaId", to_char(gv.criado_em, 'YYYY-MM-DD"T"HH24:MI') "dataHora",
                  gv.estado = 'liberado' estornado, 'grupo' canal, 'Link de grupo' "canalLabel"
           FROM kart.reserva_grupo_voucher_uso gv JOIN kart.voucher v ON v.id = gv.voucher_id LEFT JOIN kart.cliente c ON c.id = gv.cliente_id
         ) t
         ${vid ? 'WHERE t."voucherId" = @vid' : ''}
         ORDER BY t."dataHora" DESC, t.id DESC`,
        vid ? { vid } : {},
      ),
    );
    return true;
  }
  if (path === '/vouchers/cliente' && method === 'GET') {
    const clienteId = url.searchParams.get('clienteId') ? int(url.searchParams.get('clienteId'), 'Cliente') : null;
    const documento = url.searchParams.get('documento');
    const produtoId = url.searchParams.get('produtoId') ? int(url.searchParams.get('produtoId'), 'Produto') : null;
    send(200, await vouchersDisponiveisParaCliente({ clienteId, documento, produtoId }));
    return true;
  }
  if ((m = path.match(/^\/vouchers\/(\d+)$/)) && method === 'GET') {
    await garantirSchemaVouchers();
    const id = int(m[1], 'Voucher');
    const v = await one<Record<string, unknown>>(
      `SELECT v.id id, v.codigo codigo, v.origem origem, v.referencia referencia, v.parceiro_id "parceiroId", v.fidelidade_conta_id "fidelidadeContaId",
              v.tipo tipo, v.valor valor, to_char(v.inicio_em, 'YYYY-MM-DD') inicio, to_char(v.fim_em, 'YYYY-MM-DD') fim,
              v.produto_id "produtoId", v.uso_max_cliente "usoMaxCliente", v.uso_max_total "usoMaxTotal", v.uso_unico "usoUnico",
              v.restrito_clientes "restritoClientes", v.pedido_minimo_centavos "pedidoMinimo", v.desconto_maximo_centavos "descontoMaximo", v.ativo ativo,
              to_char(now(), 'YYYY-MM-DD') hoje,
              (SELECT COUNT(*) FROM kart.voucher_uso u WHERE u.voucher_id = v.id AND u.estornado = false) "usosRecepcao",
              (SELECT COUNT(*) FROM kart.reserva_online_voucher_uso o WHERE o.voucher_id = v.id AND o.estado IN ('reservado', 'consumido', 'reembolso_pendente')) "usosOnline",
              (SELECT COUNT(*) FROM kart.reserva_grupo_voucher_uso gv WHERE gv.voucher_id = v.id AND gv.estado IN ('reservado', 'consumido')) "usosGrupo"
       FROM kart.voucher v WHERE v.id = @id`, { id },
    );
    if (!v) throw new HttpError(404, 'Voucher não encontrado.');
    const clientes = await listarBeneficiariosVoucher(id);
    const usos = Number(v.usosRecepcao ?? 0) + Number(v.usosOnline ?? 0) + Number(v.usosGrupo ?? 0);
    const resumo = resumirStatusVoucher({
      ativo: Boolean(v.ativo),
      usoUnico: Boolean(v.usoUnico),
      usoMaxTotal: v.usoMaxTotal == null ? null : Number(v.usoMaxTotal),
      restritoClientes: Boolean(v.restritoClientes),
      usos,
      fim: String(v.fim ?? ''),
      hoje: String(v.hoje ?? ''),
      beneficiarios: clientes,
    });
    send(200, {
      ...v,
      usoMaxTotal: v.usoMaxTotal == null ? null : Number(v.usoMaxTotal),
      restritoClientes: Boolean(v.restritoClientes),
      usos,
      clientes,
      beneficiariosTotal: clientes.length,
      beneficiariosUsaram: clientes.filter((c) => c.esgotado).length,
      ...resumo,
    });
    return true;
  }
  if (path === '/vouchers' && method === 'POST') {
    await garantirSchemaVouchers();
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
    const clientes = normalizarBeneficiariosInput(b.clientes);
    const usoMaxTotal = b.usoMaxTotal != null && b.usoMaxTotal !== '' && Number(b.usoMaxTotal) > 0 ? int(b.usoMaxTotal, 'Limite total de usos') : null;
    const restritoClientes = Boolean(b.restritoClientes) || clientes.length > 0;
    const unico = Boolean(b.usoUnico) && !(usoMaxTotal != null && usoMaxTotal > 1) && clientes.length <= 1 ? 1 : 0;
    const r = await tx(async (run) => {
      const [criado] = await run(
        `INSERT INTO kart.voucher (codigo, origem, referencia, parceiro_id, fidelidade_conta_id, tipo, valor, inicio_em, fim_em, produto_id, uso_max_cliente, uso_max_total, uso_unico, restrito_clientes, pedido_minimo_centavos, desconto_maximo_centavos)
          VALUES (@codigo, @origem, @ref, @parceiroId, @fidelidadeContaId, @tipo, @valor, @ini, @fim, @prod, @usoMax, @usoMaxTotal, @unico, @restrito, @min, @max) returning id id`,
        {
          codigo, origem, ref: links.referencia, parceiroId: links.parceiroId, fidelidadeContaId: links.fidelidadeContaId, tipo, valor,
          ini: inicio, fim, prod: b.produtoId ? int(b.produtoId, 'Produto') : null, usoMax: int(b.usoMaxCliente ?? 1, 'Uso máx/cliente'),
          usoMaxTotal, unico, restrito: restritoClientes ? 1 : 0, min: b.pedidoMinimo ? cents(b.pedidoMinimo) : null, max: b.descontoMaximo ? cents(b.descontoMaximo) : null,
        },
      );
      const vid = Number(criado.id);
      if (clientes.length > 0) await sincronizarBeneficiariosVoucher(vid, clientes, 'replace', run);
      return { id: vid };
    }).catch((e: Error) => {
      if (duplicateSql(e)) throw new HttpError(409, 'Já existe um voucher com esse código.');
      throw e;
    });
    send(201, r);
    return true;
  }
  if ((m = path.match(/^\/vouchers\/(\d+)$/)) && method === 'PUT') {
    const id = int(m[1], 'Voucher');
    const b = await req.body();
    const temNovosCampos = 'usoMaxTotal' in b || 'restritoClientes' in b || 'clientes' in b;
    if (temNovosCampos) await garantirSchemaVouchers();
    const current = await one<Record<string, unknown>>(
      `SELECT id "Id", origem "Origem", referencia "Referencia", parceiro_id "ParceiroId", fidelidade_conta_id "FidelidadeContaId", tipo "Tipo", valor "Valor",
              to_char(inicio_em, 'YYYY-MM-DD') "InicioEm", to_char(fim_em, 'YYYY-MM-DD') "FimEm"
       FROM kart.voucher WHERE id = @id`, { id },
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
    if ('usoMaxTotal' in b) vals.UsoMaxTotal = b.usoMaxTotal != null && b.usoMaxTotal !== '' && Number(b.usoMaxTotal) > 0 ? int(b.usoMaxTotal, 'Limite total de usos') : null;
    if ('usoUnico' in b) vals.UsoUnico = bit(b.usoUnico);
    if ('restritoClientes' in b) vals.RestritoClientes = bit(b.restritoClientes);
    if ('clientes' in b) {
      const lista = normalizarBeneficiariosInput(b.clientes);
      if (lista.length > 0 && !('restritoClientes' in b)) vals.RestritoClientes = 1;
      if (vals.UsoMaxTotal != null && Number(vals.UsoMaxTotal) > 1) vals.UsoUnico = 0;
      if (lista.length > 1) vals.UsoUnico = 0;
    } else if (vals.UsoMaxTotal != null && Number(vals.UsoMaxTotal) > 1) {
      vals.UsoUnico = 0;
    }
    if ('pedidoMinimo' in b) vals.PedidoMinimoCentavos = b.pedidoMinimo ? cents(b.pedidoMinimo) : null;
    if ('descontoMaximo' in b) vals.DescontoMaximoCentavos = b.descontoMaximo ? cents(b.descontoMaximo) : null;
    if ('ativo' in b) vals.Ativo = bit(b.ativo);
    const inicio = String(vals.InicioEm ?? current.InicioEm);
    const fim = String(vals.FimEm ?? current.FimEm);
    if (inicio > fim) throw new HttpError(400, 'A data final deve ser igual ou posterior à data inicial.');
    try {
      await query(`UPDATE kart.voucher SET ${Object.keys(vals).map((c) => `${colPg(c)} = @${c}`).join(', ')} WHERE id = @id`, { ...vals, id });
      if ('clientes' in b) {
        const lista = normalizarBeneficiariosInput(b.clientes);
        await sincronizarBeneficiariosVoucher(id, lista, 'replace');
      }
    } catch (e) {
      if (duplicateSql(e)) throw new HttpError(409, 'Já existe um voucher com esse código.');
      throw e;
    }
    send(200, { id, ok: true });
    return true;
  }
  if ((m = path.match(/^\/vouchers\/(\d+)\/clientes$/)) && method === 'POST') {
    await garantirSchemaVouchers();
    const id = int(m[1], 'Voucher');
    const exists = await one<{ id: number; restrito: boolean; usoMaxTotal: number | null }>(`SELECT id id, restrito_clientes restrito, uso_max_total "usoMaxTotal" FROM kart.voucher WHERE id = @id`, { id });
    if (!exists) throw new HttpError(404, 'Voucher não encontrado.');
    const b = await req.body();
    const rawLista = Array.isArray(b.clientes) ? b.clientes : [b];
    const lista = normalizarBeneficiariosInput(rawLista);
    if (!lista.length) throw new HttpError(400, 'Informe pelo menos uma pessoa com nome ou CPF.');
    const mode = b.substituir === true ? 'replace' : 'merge';
    const { total } = await sincronizarBeneficiariosVoucher(id, lista, mode);
    const sets = ['restrito_clientes = true', 'uso_unico = CASE WHEN @total::int > 1 THEN false ELSE uso_unico END'];
    const p: Record<string, unknown> = { id, total };
    if (b.ajustarLimiteTotal === true && total > 0) {
      sets.push('uso_max_total = @total');
    }
    await query(`UPDATE kart.voucher SET ${sets.join(', ')} WHERE id = @id`, p);
    send(200, { ok: true, id, total, clientes: await listarBeneficiariosVoucher(id) });
    return true;
  }
  if ((m = path.match(/^\/vouchers\/(\d+)\/clientes\/(\d+)$/)) && method === 'DELETE') {
    await garantirSchemaVouchers();
    const id = int(m[1], 'Voucher');
    const cid = int(m[2], 'Beneficiário');
    await query(`DELETE FROM kart.voucher_cliente WHERE id = @cid AND voucher_id = @id`, { cid, id });
    send(200, { ok: true, clientes: await listarBeneficiariosVoucher(id) });
    return true;
  }
  if ((m = path.match(/^\/vouchers\/(\d+)$/)) && method === 'DELETE') {
    const id = int(m[1], 'Voucher');
    const exists = await one<{ id: number }>(`SELECT id id FROM kart.voucher WHERE id = @id`, { id });
    if (!exists) throw new HttpError(404, 'Voucher não encontrado.');
    await query(`UPDATE kart.voucher SET ativo = false WHERE id = @id`, { id });
    send(200, { id, ok: true, desativado: true });
    return true;
  }
  if (path === '/vouchers/validar' && method === 'GET') {
    await garantirSchemaVouchers();
    const codigo = (url.searchParams.get('codigo') || '').trim().toUpperCase();
    const clienteId = url.searchParams.get('clienteId') ? int(url.searchParams.get('clienteId'), 'Cliente') : null;
    const documentoParam = normalizarDocVoucher(url.searchParams.get('documento'));
    const v = await one<Record<string, unknown>>(
      `SELECT v.id "Id", v.codigo "Codigo", v.ativo "Ativo", v.parceiro_id "ParceiroId", v.fidelidade_conta_id "FidelidadeContaId", v.produto_id "ProdutoId", v.tipo "Tipo", v.valor "Valor", v.inicio_em "InicioEm", v.fim_em "FimEm", v.desconto_maximo_centavos "DescontoMaximoCentavos", v.pedido_minimo_centavos "PedidoMinimoCentavos", v.uso_unico "UsoUnico", v.uso_max_total "UsoMaxTotal", v.uso_max_cliente "UsoMaxCliente", v.restrito_clientes "RestritoClientes", v.origem "Origem", v.referencia "Referencia", p.nome produto, pr.ativo "parceiroAtivo", fc.ativo "fidelidadeAtiva",
              CASE WHEN current_date BETWEEN v.inicio_em AND v.fim_em THEN 1 ELSE 0 END "vigenciaOk"
       FROM kart.voucher v LEFT JOIN kart.produto p ON p.id = v.produto_id
       LEFT JOIN kart.parceiro pr ON pr.id = v.parceiro_id LEFT JOIN kart.fidelidade_conta fc ON fc.id = v.fidelidade_conta_id
       WHERE upper(v.codigo) = @c`,
      { c: codigo },
    );
    if (!v || !v.Ativo) throw new HttpError(404, 'Voucher não encontrado ou inativo.');
    if (v.ParceiroId && !v.parceiroAtivo) throw new HttpError(400, 'O parceiro vinculado ao voucher está inativo.');
    if (v.FidelidadeContaId && !v.fidelidadeAtiva) throw new HttpError(400, 'A conta de fidelidade vinculada ao voucher está inativa.');
    if (!v.vigenciaOk) throw new HttpError(400, 'Voucher expirado.');
    let docEfetivo = documentoParam;
    if (!docEfetivo && clienteId) {
      const cli = await one<{ doc: string | null; docNum: string | null }>(`SELECT documento doc, documento_num "docNum" FROM kart.cliente WHERE id = @id`, { id: clienteId });
      docEfetivo = normalizarDocVoucher(cli?.docNum ?? cli?.doc);
    }
    const usos = await one<{ n: number; doCliente: number }>(
      `SELECT
         (SELECT COUNT(*) FROM kart.voucher_uso WHERE voucher_id = @vid AND estornado = false)
         + (SELECT COUNT(*) FROM kart.reserva_online_voucher_uso WHERE voucher_id = @vid AND estado IN ('reservado', 'consumido', 'reembolso_pendente'))
         + (SELECT COUNT(*) FROM kart.reserva_grupo_voucher_uso WHERE voucher_id = @vid AND estado IN ('reservado', 'consumido')) n,
         (SELECT COUNT(*) FROM kart.voucher_uso WHERE voucher_id = @vid AND cliente_id = @cli AND estornado = false)
         + (SELECT COUNT(*) FROM kart.reserva_online_voucher_uso WHERE voucher_id = @vid AND cliente_id = @cli AND estado IN ('reservado', 'consumido', 'reembolso_pendente'))
         + (SELECT COUNT(*) FROM kart.reserva_grupo_voucher_uso WHERE voucher_id = @vid AND cliente_id = @cli AND estado IN ('reservado', 'consumido')) "doCliente"`,
      { vid: v.Id, cli: clienteId ?? 0 },
    );
    const usosTotais = Number(usos?.n ?? 0);
    const eleg = await avaliarElegibilidadeVoucher({
      voucherId: Number(v.Id),
      usoUnico: Boolean(v.UsoUnico),
      usoMaxTotal: v.UsoMaxTotal == null ? null : Number(v.UsoMaxTotal),
      usoMaxCliente: Number(v.UsoMaxCliente ?? 1),
      restritoClientes: Boolean(v.RestritoClientes),
      usosTotais,
      usosClienteDirecto: Number(usos?.doCliente ?? 0),
      clienteId,
      documento: docEfetivo,
    });
    if (!eleg.ok) throw new HttpError(400, eleg.motivo);
    const limiteTotal = v.UsoUnico ? 1 : (v.UsoMaxTotal != null && Number(v.UsoMaxTotal) > 0 ? Number(v.UsoMaxTotal) : null);
    send(200, {
      id: v.Id,
      codigo: v.Codigo,
      tipo: v.Tipo,
      valor: v.Valor,
      produtoId: v.ProdutoId,
      produto: v.produto,
      descontoMaximo: v.DescontoMaximoCentavos,
      pedidoMinimo: v.PedidoMinimoCentavos,
      usoMaxTotal: v.UsoMaxTotal == null ? null : Number(v.UsoMaxTotal),
      restritoClientes: Boolean(v.RestritoClientes),
      usos: usosTotais,
      restantes: limiteTotal != null ? Math.max(0, limiteTotal - usosTotais) : null,
      beneficiarioNome: eleg.beneficiarioNome ?? null,
    });
    return true;
  }

  // ---------- baterias: acoes
  if (path === '/baterias' && method === 'POST') {
    const b = await req.body();
    if (b.reservaFechada) await exigePodeFecharBateria(sessao);
    const nome = str(b.nome, 100);
    if (!nome) throw new HttpError(400, 'Insira um nome para a reserva.');
    const campeonato = campeonatoDe(b, nome);
    const inicio = localDateTime(b.inicio);
    const vagas = int(b.vagas, 'Quantidade máxima de competidores');
    const produtoId = int(b.produtoId, 'Produto');
    const exists = await one(`SELECT 1 x FROM kart.bateria WHERE inicio = @inicio AND status <> 'cancelada' AND produto_id = @produtoId`, { inicio, produtoId });
    if (exists) throw new HttpError(409, 'Já há uma reserva agendada para a data selecionada.');
    const cat = await one<{ c: string }>(`SELECT categoria c FROM kart.produto WHERE id = @produtoId`, { produtoId });
    const r = await one<{ id: number }>(
      `INSERT INTO kart.bateria (inicio, nome, tipo_kart, vagas, produto_id, tracado_id, volta_minima_seg, responsavel_id, codigo_reserva, reserva_fechada, auto_atendimento, observacao, campeonato)
        VALUES (@inicio, @nome, @tipo, @vagas, @produtoId, @tracadoId, @volta, @resp, @codigo, @fechada, @aa, @obs, @camp) returning id id`,
      {
        inicio, nome, tipo: cat?.c === 'Super Kart' ? 'super' : 'light', vagas, produtoId, tracadoId: b.tracadoId ? int(b.tracadoId, 'Traçado') : null,
        volta: Number(b.voltaMinimaSeg ?? 5) || 0, resp: b.responsavelId ? int(b.responsavelId, 'Responsável') : null, codigo: str(b.codigoReserva, 20),
        fechada: campeonato ? 0 : b.reservaFechada ? 1 : 0, aa: campeonato ? 1 : b.autoAtendimento === false ? 0 : 1, obs: str(b.observacao, 400), camp: campeonato ? 1 : 0,
      },
    );
    send(201, r);
    return true;
  }
  if (path === '/baterias/gerar' && method === 'POST') {
    // "Gerar Reservas do Mes": aplica um padrao de reserva nos dias da semana escolhidos, pulando feriados
    const b = await req.body();
    const padrao = await one<Record<string, unknown>>(`SELECT pr.id "Id", pr.nome "Nome", pr.produto_id "ProdutoId", pr.tracado_id "TracadoId", pr.categoria "Categoria", pr.quantidade "Quantidade", pr.primeira_hora "PrimeiraHora", pr.vagas "Vagas", pr.intervalo_min "IntervaloMin", pr.volta_minima_seg "VoltaMinimaSeg", pr.numerar_nome "NumerarNome", pr.online "Online", pr.ativo "Ativo", p.categoria cat FROM kart.padrao_reserva pr LEFT JOIN kart.produto p ON p.id = pr.produto_id WHERE pr.id = @id`, { id: int(b.padraoId, 'Padrão') });
    if (!padrao) throw new HttpError(400, 'Selecione uma configuração padrão antes de criar as reservas.');
    const de = new Date(isoDate(b.de) + 'T12:00:00');
    const ate = new Date(isoDate(b.ate) + 'T12:00:00');
    // soFeriados: o "Horário de Feriado" só nos feriados marcados "Abre", nos dias da semana escolhidos
    // (feriado na segunda continua fechado: a tela manda todos os dias menos segunda)
    const soFeriados = b.soFeriados === true;
    const dias = (Array.isArray(b.diasSemana) ? b.diasSemana : []).map(Number);
    if (!dias.length) throw new HttpError(400, 'Selecione pelo menos um dia da semana antes de criar as reservas.');
    const cad = await query<{ d: string; r: boolean; a: boolean }>(`SELECT to_char(data, 'YYYY-MM-DD') d, recorrente r, abre a FROM kart.feriado`);
    const chaves = (f: { d: string; r: boolean }) => (f.r ? [f.d, f.d.slice(5)] : [f.d]);
    const feriados = new Set(cad.flatMap(chaves));
    const abertos = new Set(cad.filter((f) => f.a).flatMap(chaves));
    const [h0, m0] = String(padrao.PrimeiraHora).split(':').map(Number);
    const pularFeriados = b.pularFeriados !== false;
    const pularExistentes = b.pularExistentes !== false;
    const fechada = b.ativo === false ? 1 : 0;
    if (fechada || !padrao.Online) await exigePodeFecharBateria(sessao);
    let criadas = 0;
    for (let d = new Date(de); d <= ate; d.setDate(d.getDate() + 1)) {
      const data = d.toISOString().slice(0, 10);
      if (!dias.includes(d.getDay())) continue;
      if (soFeriados) { if (!abertos.has(data) && !abertos.has(data.slice(5))) continue; }
      else if (pularFeriados && (feriados.has(data) || feriados.has(data.slice(5)))) continue;
      for (let k = 0; k < (padrao.Quantidade as number); k++) {
        const t = h0 * 60 + m0 + k * (padrao.IntervaloMin as number);
        if (t >= 24 * 60) break;
        const hhmm = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
        const inicio = `${data}T${hhmm}:00`;
        const exists = await one(`SELECT 1 x FROM kart.bateria WHERE inicio = @inicio AND produto_id = @p AND status <> 'cancelada'`, { inicio, p: padrao.ProdutoId });
        if (exists && pularExistentes) continue;
        await query(
          `INSERT INTO kart.bateria (inicio, nome, tipo_kart, vagas, produto_id, tracado_id, volta_minima_seg, auto_atendimento, reserva_fechada) VALUES (@inicio, @nome, @tipo, @vagas, @p, @t, @volta, @aa, @fechada)`,
          {
            inicio, nome: padrao.NumerarNome ? `${padrao.Nome} ${k + 1}` : `BATERIA ${hhmm}`, tipo: padrao.cat === 'Super Kart' ? 'super' : 'light', vagas: padrao.Vagas,
            p: padrao.ProdutoId, t: padrao.TracadoId, volta: padrao.VoltaMinimaSeg, aa: padrao.Online ? 1 : 0, fechada,
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
      `SELECT to_char(inicio, 'YYYY-MM-DD') data, vagas "vagasAtual", reserva_fechada "rfAtual", auto_atendimento "aaAtual", campeonato "campAtual", (SELECT COUNT(*) FROM kart.inscricao WHERE bateria_id = @id AND status <> 'cancelada') n,
              (SELECT COUNT(*) FROM kart.inscricao WHERE bateria_id = @id AND pago = true AND status <> 'cancelada') pagas FROM kart.bateria WHERE id = @id`,
      { id },
    );
    if (!atual) throw new HttpError(404, 'Bateria não encontrada.');
    const inicio = localDateTime(b.inicio);
    if ((atual.pagas as number) > 0 && inicio.slice(0, 10) !== atual.data) throw new HttpError(409, 'Como há reservas pagas, não é possível alterar a data, apenas o horário.');
    const vagas = int(b.vagas, 'Vagas');
    if ((b.reservaFechada && !atual.rfAtual) || vagas < Number(atual.vagasAtual)) await exigePodeFecharBateria(sessao);
    if (vagas < (atual.n as number)) throw new HttpError(409, `O máximo de competidores deve ser maior ou igual ao número de reservas. Número de reservas: ${atual.n}.`);
    const produtoId = int(b.produtoId, 'Produto');
    // a Recepção antiga não manda o campo: sem ele, a bateria continua como estava
    const campPut = b.campeonato === undefined ? Boolean(atual.campAtual) : campeonatoDe(b, str(b.nome, 100));
    const cat = await one<{ c: string }>(`SELECT categoria c FROM kart.produto WHERE id = @produtoId`, { produtoId });
    await query(
      `UPDATE kart.bateria SET inicio = @inicio, nome = @nome, vagas = @vagas, produto_id = @produtoId, tipo_kart = @tipo, tracado_id = @tracadoId, volta_minima_seg = @volta,
         responsavel_id = @resp, codigo_reserva = @codigo, reserva_fechada = @fechada, auto_atendimento = @aa, observacao = @obs, campeonato = @camp WHERE id = @id`,
      {
        id, inicio, nome: str(b.nome, 100) ?? 'BATERIA', vagas, produtoId, tipo: cat?.c === 'Super Kart' ? 'super' : 'light', tracadoId: b.tracadoId ? int(b.tracadoId, 'Traçado') : null,
        volta: Number(b.voltaMinimaSeg ?? 5) || 0, resp: b.responsavelId ? int(b.responsavelId, 'Responsável') : null, codigo: str(b.codigoReserva, 20),
        fechada: campPut ? 0 : b.reservaFechada ? 1 : 0, aa: campPut ? 1 : b.autoAtendimento ? 1 : 0, obs: str(b.observacao, 400), camp: campPut ? 1 : 0,
      },
    );
    send(200, { ok: true });
    return true;
  }
  if ((m = path.match(/^\/baterias\/(\d+)\/restaurar$/)) && method === 'POST') {
    // desfazer de "excluir bateria" e "fechar o dia": só volta uma bateria cancelada que continua sem nenhuma reserva ativa
    await exigePodeFecharBateria(sessao);
    const id = Number(m[1]);
    const b = await req.body();
    const status = b.status === 'fechada' ? 'fechada' : 'aberta';
    const ativas = await one<{ n: number }>(`SELECT COUNT(*) n FROM kart.inscricao WHERE bateria_id = @id AND status <> 'cancelada'`, { id });
    if ((ativas?.n ?? 0) > 0) throw new HttpError(409, 'Esta bateria já tem reservas: não dá para restaurar.');
    const r = await one<{ n: number }>(
      `UPDATE kart.bateria SET status = @status  WHERE id = @id AND status = 'cancelada' returning 1 n`, { status, id },
    );
    if (!r) throw new HttpError(409, 'A bateria não está cancelada.');
    send(200, { ok: true });
    return true;
  }
  if ((m = path.match(/^\/baterias\/(\d+)\/status$/)) && method === 'POST') {
    const b = await req.body();
    const status = b.status === 'fechada' ? 'fechada' : 'aberta';
    if (status === 'fechada') await exigePodeFecharBateria(sessao);
    await query(`UPDATE kart.bateria SET status = @status WHERE id = @id AND status <> 'cancelada'`, { status, id: Number(m[1]) });
    send(200, { ok: true });
    return true;
  }
  if ((m = path.match(/^\/baterias\/(\d+)\/totem$/)) && method === 'POST') {
    const b = await req.body();
    const aa = b.autoAtendimento ? 1 : 0;
    await query(`UPDATE kart.bateria SET auto_atendimento = @aa WHERE id = @id AND status <> 'cancelada'`, { aa, id: Number(m[1]) });
    send(200, { ok: true });
    return true;
  }
  if ((m = path.match(/^\/baterias\/(\d+)$/)) && method === 'DELETE') {
    await exigePodeFecharBateria(sessao);
    const id = Number(m[1]);
    const pagas = await one<{ n: number }>(`SELECT COUNT(*) n FROM kart.inscricao WHERE bateria_id = @id AND pago = true AND status <> 'cancelada'`, { id });
    if (pagas!.n > 0) throw new HttpError(409, 'Não é permitido excluir reservas pagas!');
    await tx(async (run) => {
      await run(`UPDATE kart.inscricao SET status = 'cancelada', atualizado_em = now() WHERE bateria_id = @id AND status <> 'cancelada'`, { id });
      await run(`UPDATE kart.bateria SET status = 'cancelada' WHERE id = @id`, { id });
    });
    send(200, { ok: true });
    return true;
  }
  if (path === '/baterias/fechar-dia' && method === 'POST') {
    // feriado decidido depois de abrir a agenda: cancela de uma vez as baterias do dia que não têm ninguém inscrito
    await exigePodeFecharBateria(sessao);
    const b = await req.body();
    const data = isoDate(b.data);
    const r = await one<{ canceladas: number; mantidas: number }>(
      `WITH c AS (
         UPDATE kart.bateria b SET status = 'cancelada'
          WHERE b.inicio >= @d::date AND b.inicio < @d::date + 1 AND b.status <> 'cancelada'
            AND NOT EXISTS (SELECT 1 FROM kart.inscricao i WHERE i.bateria_id = b.id AND i.status <> 'cancelada')
         RETURNING b.id)
       SELECT (SELECT COUNT(*) FROM c) canceladas,
              (SELECT COUNT(*) FROM kart.bateria WHERE inicio >= @d::date AND inicio < @d::date + 1 AND status <> 'cancelada') - (SELECT COUNT(*) FROM c) mantidas`,
      { d: data },
    );
    send(200, r ?? { canceladas: 0, mantidas: 0 });
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
    send(200, await query(`SELECT pp.ordem ordem, pp.nome nome, pp.tipo tipo, pp.finalizacao finalizacao, pp.tempo_min "tempoMin", pp.voltas_max "voltasMax"
      FROM kart.produto_prova pp JOIN kart.bateria b ON b.produto_id = pp.produto_id WHERE b.id = @id ORDER BY pp.ordem`, { id: Number(m[1]) }));
    return true;
  }
  if (path === '/agenda' && method === 'GET') {
    const mes = String(url.searchParams.get('mes') ?? '');
    if (!/^\d{4}-\d{2}$/.test(mes)) throw new HttpError(400, 'Mês inválido.');
    send(
      200,
      await query(
        `SELECT to_char(b.inicio, 'YYYY-MM-DD') dia, COUNT(*) baterias, SUM(b.vagas) vagas, SUM(coalesce(r.n, 0)) reservas
         FROM kart.bateria b
         LEFT JOIN (SELECT bateria_id, COUNT(*) n FROM kart.inscricao WHERE status <> 'cancelada' GROUP BY bateria_id) r ON r.bateria_id = b.id
         WHERE b.status <> 'cancelada' AND b.inicio >= @d::date AND b.inicio < @d::date + interval '1 month' GROUP BY to_char(b.inicio, 'YYYY-MM-DD') ORDER BY 1`,
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
    const produtoDesejado = b.produtoId === undefined ? null : int(b.produtoId, 'Produto');
    if (b.produtoId !== undefined) {
      p.pid = produtoDesejado;
    }
    if (b.observacao !== undefined) {
      sets.push('observacao = @obs');
      p.obs = str(b.observacao, 400);
    }
    if (b.kart !== undefined) {
      sets.push('kart = @kart');
      p.kart = str(b.kart, 10);
    }
    let atualizarPeso = false;
    let peso: number | null = null;
    if (b.peso !== undefined) {
      const erroPeso = erroPesoCliente(b.peso);
      if (erroPeso) throw new HttpError(400, erroPeso);
      atualizarPeso = true;
      const valor = String(b.peso ?? '').trim().replace(',', '.');
      if (valor) {
        peso = Number(valor);
        if (!Number.isFinite(peso) || peso <= 0 || peso >= 500) throw new HttpError(400, 'Peso inválido. Informe um valor entre 0 e 500 kg.');
        peso = Math.round(peso * 10) / 10;
      }
    }
    if (b.termo !== undefined && typeof b.termo !== 'boolean') throw new HttpError(400, 'Situação do termo inválida.');
    const atualizarTermo = b.termo !== undefined;
    if (!sets.length && produtoDesejado === null && !atualizarPeso && !atualizarTermo) throw new HttpError(400, 'Nada para alterar.');
    await tx(async (run) => {
      let produtoOrigem: number | null = null;
      if (produtoDesejado !== null || atualizarTermo) {
        const [reserva] = await run(
          `SELECT i.pago AS "Pago", i.status AS "Status", coalesce(i.produto_id, b.produto_id) "produtoId"
           FROM kart.inscricao i JOIN kart.bateria b ON b.id = i.bateria_id WHERE i.id = @id for update of i`,
          { id },
        );
        if (!reserva) throw new HttpError(404, 'Reserva não encontrada.');
        if (reserva.Status === 'cancelada') throw new HttpError(409, 'Não é possível editar uma reserva cancelada.');
        produtoOrigem = reserva.produtoId == null ? null : Number(reserva.produtoId);
        if (produtoDesejado !== null && produtoOrigem !== produtoDesejado) {
          if (reserva.Pago) throw new HttpError(409, 'Não é permitido trocar o produto de uma reserva paga.');
          const [prod] = await run(`SELECT preco_centavos preco FROM kart.produto WHERE id = @pid for update`, { pid: produtoDesejado });
          if (!prod) throw new HttpError(404, 'Produto não encontrado.');
          sets.push(
            'produto_id = @pid',
            'preco_centavos = @preco',
            'desconto_centavos = CASE WHEN @produtoOrigem::int = @pid::int THEN CASE WHEN desconto_centavos > @preco::int THEN @preco::int ELSE desconto_centavos END ELSE 0 END',
            // o termo não depende do produto: trocar o produto (ex.: 2 baterias) apagava o "impresso" e a recepção reimprimia tudo
          );
          p.preco = prod.preco;
          p.produtoOrigem = produtoOrigem;
        }
      }
      if (sets.length) await run(`UPDATE kart.inscricao SET ${sets.join(', ')} WHERE id = @id`, p);
      if (atualizarPeso) await run(
        `UPDATE kart.cliente c SET peso = @peso
         FROM kart.inscricao i WHERE i.cliente_id = c.id AND i.id = @id`,
        { id, peso },
      );
      if (atualizarTermo) await run(
        `UPDATE kart.inscricao SET termo_impresso_em = CASE WHEN @termo::boolean THEN COALESCE(termo_impresso_em, now()) ELSE NULL END WHERE id = @id`,
        { id, termo: b.termo },
      );
    });
    send(200, { ok: true });
    return true;
  }
  if ((m = path.match(/^\/reservas\/(\d+)\/alterar-cliente$/)) && method === 'POST') {
    const id = Number(m[1]);
    const b = await req.body();
    const clienteId = int(b.clienteId, 'Cliente');
    const r = await one<{ BateriaId: number }>(`SELECT bateria_id "BateriaId" FROM kart.inscricao WHERE id = @id`, { id });
    if (!r) throw new HttpError(404, 'Reserva não encontrada.');
    const dup = await one(`SELECT 1 x FROM kart.inscricao WHERE bateria_id = @b AND cliente_id = @c AND status <> 'cancelada' AND id <> @id`, { b: r.BateriaId, c: clienteId, id });
    if (dup) throw new HttpError(409, 'Já existe uma reserva em nome deste cliente.');
    await query(`UPDATE kart.inscricao SET cliente_id = @c, termo_impresso_em = NULL, atualizado_em = now() WHERE id = @id`, { c: clienteId, id });
    send(200, { mensagem: 'Cliente alterado com sucesso!' });
    return true;
  }
  if ((m = path.match(/^\/reservas\/(\d+)\/mover$/)) && method === 'POST') {
    const corpo = await req.body();
    const r = await moverReservas([Number(m[1])], int(corpo.bateriaId, 'Bateria'), undefined, { trocarServico: corpo.trocarServico === true });
    send(200, { mensagem: 'Cliente movido com sucesso.', ...r });
    return true;
  }
  if ((m = path.match(/^\/reservas\/(\d+)\/aprovar$/)) && method === 'POST') {
    // evento já acertado fora da recepção (preço final R$ 0): aprovar já confirma, sem caixa nem planilha
    await query(
      `UPDATE kart.inscricao i SET aprovada = true,
         pago = CASE WHEN x.total = 0 THEN true ELSE i.pago END,
         valor_centavos = CASE WHEN x.total = 0 THEN 0 ELSE i.valor_centavos END,
         status = CASE WHEN x.total = 0 THEN 'confirmada' ELSE i.status END
       FROM (SELECT i2.id, coalesce(i2.preco_centavos, p.preco_centavos) - i2.desconto_centavos total
               FROM kart.inscricao i2 JOIN kart.bateria b ON b.id = i2.bateria_id LEFT JOIN kart.produto p ON p.id = coalesce(i2.produto_id, b.produto_id)
              WHERE i2.id = @id) x
       WHERE i.id = x.id AND i.status <> 'cancelada'`,
      { id: Number(m[1]) },
    );
    send(200, { ok: true });
    return true;
  }
  if ((m = path.match(/^\/reservas\/(\d+)$/)) && method === 'DELETE') {
    const id = Number(m[1]);
    await cancelarReserva(id);
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
      where = 'lower(c.email) LIKE @q';
      p = { q: q.toLowerCase() + '%' };
    } else if (campo === 'telefone') {
      where = '(c.telefone_num LIKE @t OR c.telefone LIKE @raw)';
      p = { t: '%' + d, raw: '%' + q + '%' };
    } else if (campo === 'documento' || (campo === 'auto' && d.length >= 4 && d.length === q.replace(/[\s.\-()/]/g, '').length)) {
      where = '(c.documento_num LIKE @d OR c.documento LIKE @raw OR c.telefone_num LIKE @t)';
      p = { d: d + '%', raw: '%' + q + '%', t: '%' + d };
    } else {
      where = 'unaccent(c.nome) ILIKE unaccent(@q)';
      p = { q: '%' + q.replace(/\s+/g, '%') + '%' };
    }
    send(200, await query(`SELECT ${CLIENTE_COLS}, r.nome "responsavelNome" FROM kart.cliente c LEFT JOIN kart.cliente r ON r.id = c.responsavel_id WHERE ${where} ORDER BY c.nome limit 100`, p));
    return true;
  }
  if (path === '/clientes/nav' && method === 'GET') {
    const id = Number(url.searchParams.get('id') || 0);
    const dir = url.searchParams.get('dir');
    const sqlDir: Record<string, string> = {
      first: 'SELECT id id FROM kart.cliente ORDER BY id limit 1',
      last: 'SELECT id id FROM kart.cliente ORDER BY id DESC limit 1',
      prev: 'SELECT id id FROM kart.cliente WHERE id < @id ORDER BY id DESC limit 1',
      next: 'SELECT id id FROM kart.cliente WHERE id > @id ORDER BY id limit 1',
    };
    if (!sqlDir[dir ?? '']) throw new HttpError(400, 'Direção inválida.');
    send(200, await one(sqlDir[dir!], { id }));
    return true;
  }
  if ((m = path.match(/^\/clientes\/(\d+)$/)) && method === 'GET') {
    const id = Number(m[1]);
    const c = await one(`SELECT ${CLIENTE_COLS}, r.nome "responsavelNome", (SELECT COUNT(*) FROM kart.cliente) "totalRegistros",
      (SELECT COUNT(*) FROM kart.cliente x WHERE x.id <= c.id) posicao FROM kart.cliente c LEFT JOIN kart.cliente r ON r.id = c.responsavel_id WHERE c.id = @id`, { id });
    if (!c) throw new HttpError(404, 'Cliente não localizado.');
    const dependentes = await query(`SELECT id id, nome nome, to_char(nascimento, 'YYYY-MM-DD') nascimento FROM kart.cliente WHERE responsavel_id = @id ORDER BY nome`, { id });
    const historico = await query(
      `SELECT i.id id, b.nome bateria, to_char(b.inicio, 'YYYY-MM-DD"T"HH24:MI') "dataHora", p.nome produto, i.pago pago, i.status status,
              CASE WHEN i.pago = true THEN i.valor_centavos ELSE coalesce(i.preco_centavos, p.preco_centavos) END valor
       FROM kart.inscricao i JOIN kart.bateria b ON b.id = i.bateria_id LEFT JOIN kart.produto p ON p.id = coalesce(i.produto_id, b.produto_id) WHERE i.cliente_id = @id ORDER BY b.inicio DESC limit 50`,
      { id },
    );
    const financeiro = await one(
      `SELECT COUNT(*) vendas, coalesce(SUM(final_centavos), 0) total, to_char(MAX(criado_em), 'YYYY-MM-DD"T"HH24:MI') ultima FROM kart.venda WHERE cliente_id = @id AND cancelada = false`,
      { id },
    );
    send(200, { ...c, dependentes, historico, financeiro });
    return true;
  }
  if (path === '/clientes' && method === 'POST') {
    const b = (await req.body()) as ClienteInput;
    const erroCadastro = erroCadastroObrigatorio(b);
    if (erroCadastro) throw new HttpError(400, erroCadastro);
    if ((b.tipoDocumento ?? 'CPF') === 'CPF' && b.documento && !isValidCpf(b.documento)) throw new HttpError(400, 'CPF inválido.');
    if (b.documento && !b.responsavelId) {
      const dup = await one<{ id: number; nome: string }>(`SELECT id id, nome nome FROM kart.cliente WHERE documento_num = @d limit 1`, { d: onlyDigits(b.documento) });
      if (dup) throw new HttpError(409, `Documento já cadastrado para ${dup.nome} (cliente ${dup.id}).`);
    }
    send(201, { id: await insertCliente(b, 'recepcao') }); pedirVinculoAgora();
    return true;
  }
  if ((m = path.match(/^\/clientes\/(\d+)$/)) && method === 'PUT') {
    const b = (await req.body()) as ClienteInput;
    const erroCadastro = erroCadastroObrigatorio(b);
    if (erroCadastro) throw new HttpError(400, erroCadastro);
    if ((b.tipoDocumento ?? 'CPF') === 'CPF' && b.documento && !isValidCpf(b.documento)) throw new HttpError(400, 'CPF inválido.');
    await updateCliente(Number(m[1]), b, false); pedirVinculoAgora();
    send(200, { ok: true });
    return true;
  }
  if ((m = path.match(/^\/clientes\/(\d+)$/)) && method === 'DELETE') {
    const id = Number(m[1]);
    const uso = await one<{ n: number }>(`SELECT (SELECT COUNT(*) FROM kart.inscricao WHERE cliente_id = @id) + (SELECT COUNT(*) FROM kart.venda WHERE cliente_id = @id) + (SELECT COUNT(*) FROM kart.cliente WHERE responsavel_id = @id) n`, { id });
    if (uso!.n > 0) throw new HttpError(409, 'Cliente com reservas, vendas ou dependentes. Use "Bloqueado" em vez de excluir.');
    await query(`DELETE FROM kart.cliente WHERE id = @id`, { id });
    send(200, { ok: true });
    return true;
  }

  // ---------- caixa
  if (path === '/caixa' && method === 'GET') {
    const aberto = await movimentoAberto(sessao.uid);
    const turnos = await query(`SELECT id id, descricao descricao, inicio inicio, fim fim FROM kart.turno WHERE ativo = true ORDER BY inicio`);
    const terminais = await query(
      `SELECT t.id id, t.nome nome FROM kart.terminal t WHERE t.ativo = true AND NOT EXISTS (SELECT 1 FROM kart.movimento m WHERE m.terminal_id = t.id AND m.fechado_em IS NULL) ORDER BY t.nome`,
    );
    send(200, { aberto, turnos, terminais, sumario: aberto ? await sumarioMovimento(aberto.id) : null });
    return true;
  }
  if (path === '/movimentos' && method === 'GET') {
    send(
      200,
      await query(
        `SELECT m.id id, t.nome terminal, tu.descricao turno, u.nome usuario, to_char(m.aberto_em, 'YYYY-MM-DD"T"HH24:MI') "abertoEm", to_char(m.fechado_em, 'YYYY-MM-DD"T"HH24:MI') "fechadoEm",
                coalesce((SELECT SUM(vp.valor_centavos) FROM kart.venda_pagamento vp JOIN kart.venda v ON v.id = vp.venda_id WHERE v.movimento_id = m.id AND vp.cancelado = false), 0) recebido
         FROM kart.movimento m JOIN kart.terminal t ON t.id = m.terminal_id LEFT JOIN kart.turno tu ON tu.id = m.turno_id LEFT JOIN kart.usuario u ON u.id = m.usuario_id
         ORDER BY m.aberto_em DESC limit 120`,
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
    const ocupado = await one(`SELECT 1 x FROM kart.movimento WHERE terminal_id = @terminalId AND fechado_em IS NULL`, { terminalId });
    if (ocupado) throw new HttpError(409, 'Esse terminal já está aberto por outro usuário.');
    const inicial = cents(b.inicialCentavos ?? 0, 'Suprimento inicial');
    const r = await one<{ id: number }>(
      `INSERT INTO kart.movimento (usuario_id, terminal_id, turno_id, inicial_centavos)  VALUES (@uid, @terminalId, @turnoId, @inicial) returning id id`,
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
    await query(`UPDATE kart.movimento SET fechado_em = now(), proximo_turno_centavos = @prox WHERE id = @id`, { prox, id: aberto.id });
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
    await query(`INSERT INTO kart.movimento_transacao (movimento_id, usuario_id, tipo, valor_centavos, observacao) VALUES (@mov, @uid, @tipo, @valor, @obs)`, {
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
      query(`SELECT id id, codigo codigo, nome nome, preco_centavos preco, categoria categoria, ativo ativo FROM kart.produto ORDER BY nome`),
      query(`SELECT id id, nome nome FROM kart.tracado
             WHERE ativo = true AND (timing_track_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM kart.tracado WHERE ativo = true AND timing_track_id IS NOT NULL))
             ORDER BY length(nome), nome`),
      query(`SELECT id id, nome nome, tipo tipo FROM kart.forma_pagamento WHERE ativo = true ORDER BY codigo`),
      // campos do padrão para a prévia de "Criar reservas" (hora como texto hh:mm)
      query(`SELECT id id, nome nome, quantidade quantidade, primeira_hora "primeiraHora", intervalo_min "intervaloMin", vagas vagas, ativo ativo
             FROM kart.padrao_reserva WHERE ativo = true ORDER BY nome`),
      one(`SELECT nome nome, razao_social "razaoSocial" FROM kart.empresa WHERE id = 1`),
      query(`SELECT chave chave, valor valor FROM kart.parametro`),
    ]);
    send(200, { produtos, tracados, formas, padroes, empresa, parametros: Object.fromEntries(parametros.filter((p) => p.chave !== 'office.usuariosSemFecharBateria').map((p) => [p.chave, p.valor])), usuario: sessao, podeFecharBateria: await podeFecharBateria(sessao) });
    return true;
  }
  if (path === '/empresa' && method === 'GET') {
    send(200, await one(`SELECT nome nome, razao_social "razaoSocial", cnpj cnpj, cep cep, endereco endereco, numero numero, complemento complemento, bairro bairro,
      cidade cidade, estado estado, telefone telefone, email email, politica_reembolso "politicaReembolso",
      ibge ibge, pais pais, site site, horarios horarios, logo_nome "logoNome" FROM kart.empresa WHERE id = 1`));
    return true;
  }
  if (path === '/empresa' && method === 'PUT') {
    if (!sessao.admin) throw new HttpError(403, 'Disponível apenas para administradores.');
    const b = await req.body();
    const campos: Record<string, [string, number]> = {
      nome: ['Nome', 200], razaoSocial: ['RazaoSocial', 200], cnpj: ['Cnpj', 20], cep: ['Cep', 12], endereco: ['Endereco', 200], numero: ['Numero', 20],
      complemento: ['Complemento', 100], bairro: ['Bairro', 100], cidade: ['Cidade', 100], estado: ['Estado', 4], telefone: ['Telefone', 40], email: ['Email', 200], politicaReembolso: ['PoliticaReembolso', 8000],
      ibge: ['Ibge', 10], pais: ['Pais', 60], site: ['Site', 200], horarios: ['Horarios', 400],
    };
    const vals: Record<string, unknown> = {};
    for (const [k, [c, max]] of Object.entries(campos)) if (k in b) vals[c] = str(b[k], max);
    if (!vals.Nome && 'nome' in b) throw new HttpError(400, 'Informe o nome.');
    await query(`UPDATE kart.empresa SET ${Object.keys(vals).map((c) => `${colPg(c)} = @${c}`).join(', ')} WHERE id = 1`, vals);
    send(200, { ok: true });
    return true;
  }
  if (path === '/empresa/logo' && method === 'POST') {
    if (!sessao.admin) throw new HttpError(403, 'Disponível apenas para administradores.');
    const b = await req.body();
    const bytes = Buffer.from(String(b.base64 ?? ''), 'base64');
    if (!bytes.length || bytes.length > 1_500_000) throw new HttpError(400, 'Envie uma imagem de até 1,5 MB.');
    await query(`UPDATE kart.empresa SET logo = @logo, logo_nome = @nome WHERE id = 1`, { logo: bytes, nome: str(b.nome, 200) });
    send(200, { ok: true });
    return true;
  }
  if (path === '/parametros' && method === 'GET') {
    send(200, await query(`SELECT chave chave, valor valor, descricao descricao FROM kart.parametro ORDER BY chave`));
    return true;
  }
  if (path === '/parametros' && method === 'PUT') {
    if (!sessao.admin) throw new HttpError(403, 'Disponível apenas para administradores.');
    const b = await req.body();
    for (const [k, v] of Object.entries(b)) await query(`UPDATE kart.parametro SET valor = @v WHERE chave = @k`, { k, v: v === null ? null : String(v).slice(0, 1000) });
    send(200, { ok: true });
    return true;
  }
  if ((m = path.match(/^\/senha$/)) && method === 'POST') {
    const b = await req.body();
    const atual = String(b.senhaAtual ?? '');
    const nova = String(b.nova ?? '');
    if (nova.length < 8) throw new HttpError(400, 'A senha precisa ter pelo menos 8 caracteres.');
    if (!atual) throw new HttpError(400, 'Informe sua senha atual.');
    const u = await one<{ hash: string; ativo: boolean }>(`SELECT senha_hash hash, ativo ativo FROM kart.usuario WHERE id = @id`, { id: sessao.uid });
    if (!u || !u.ativo) throw new HttpError(401, 'Usuário não encontrado ou inativo.');
    if (!confereSenha(atual, u.hash)) throw new HttpError(403, 'A senha atual está incorreta.');
    await query(`UPDATE kart.usuario SET senha_hash = @h WHERE id = @id`, { h: hashSenha(nova), id: sessao.uid });
    send(200, { mensagem: 'Senha alterada.' });
    return true;
  }
  // ---------- permissões por perfil (Permissoes do canvas): matriz funcionalidade × acessar/incluir/alterar/excluir/exportar/importar
  if (path === '/minhas-permissoes' && method === 'GET') {
    const u = await one<{ id: number; nome: string; login: string; admin: boolean; ativo: boolean; perfilId: number | null; perfil: string | null; acessoTotal: boolean | null }>(
      `SELECT u.id id, u.nome nome, u.login login, u.admin admin, u.ativo ativo, u.perfil_id "perfilId", p.descricao perfil, p.acesso_total "acessoTotal"
       FROM kart.usuario u LEFT JOIN kart.perfil p ON p.id = u.perfil_id WHERE u.id = @uid`, { uid: sessao.uid });
    if (!u || !u.ativo) throw new HttpError(401, 'Sessão expirada. Entre novamente.');
    const total = Boolean(u.admin) || Boolean(u.acessoTotal);
    const itens = u.perfilId
      ? await query<{ funcao: string; acessar: boolean; incluir: boolean; alterar: boolean; excluir: boolean }>(
        `SELECT funcao funcao, acessar acessar, incluir incluir, alterar alterar, excluir excluir FROM kart.perfil_permissao WHERE perfil_id = @p AND modulo = 'Admin Web'`, { p: u.perfilId })
      : [];
    send(200, { id: u.id, nome: u.nome, login: u.login, admin: Boolean(u.admin), perfilId: u.perfilId, perfil: u.perfil, acessoTotal: total, configurado: itens.length > 0, telas: itens, fecharBateria: await podeFecharBateria(sessao) });
    return true;
  }
  if (path === '/permissoes' && method === 'GET') {
    if (!sessao.admin) throw new HttpError(403, 'Disponível apenas para administradores.');
    const perfilId = Number(url.searchParams.get('perfilId'));
    if (!perfilId) throw new HttpError(400, 'Informe o perfil.');
    const perfil = await one<{ id: number; descricao: string; acessoTotal: boolean }>(`SELECT id id, descricao descricao, acesso_total "acessoTotal" FROM kart.perfil WHERE id = @perfilId`, { perfilId });
    if (!perfil) throw new HttpError(404, 'Perfil não encontrado.');
    const itens = await query(`SELECT modulo modulo, funcao funcao, acessar acessar, incluir incluir, alterar alterar, excluir excluir, exportar exportar, importar importar FROM kart.perfil_permissao WHERE perfil_id = @perfilId`, { perfilId });
    send(200, { perfil, itens });
    return true;
  }
  if (path === '/permissoes' && method === 'PUT') {
    if (!sessao.admin) throw new HttpError(403, 'Disponível apenas para administradores.');
    const b = await req.body();
    const perfilId = Number(b.perfilId);
    if (!perfilId) throw new HttpError(400, 'Informe o perfil.');
    const itens = Array.isArray(b.itens) ? (b.itens as Record<string, unknown>[]) : [];
    await query(`UPDATE kart.perfil SET acesso_total = @t WHERE id = @perfilId`, { t: b.acessoTotal ? 1 : 0, perfilId });
    for (const it of itens) {
      const modulo = str(it.modulo, 30); const funcao = str(it.funcao, 60);
      if (!modulo || !funcao) continue;
      const v = (k: string) => (it[k] ? 1 : 0);
      await query(
        `INSERT INTO kart.perfil_permissao (perfil_id, modulo, funcao, acessar, incluir, alterar, excluir, exportar, importar)
         VALUES (@perfilId, @modulo, @funcao, @a, @i, @al, @e, @ex, @im)
         ON CONFLICT (perfil_id, modulo, funcao) DO UPDATE SET acessar = excluded.acessar, incluir = excluded.incluir, alterar = excluded.alterar,
           excluir = excluded.excluir, exportar = excluded.exportar, importar = excluded.importar`,
        { perfilId, modulo, funcao, a: v('acessar'), i: v('incluir'), al: v('alterar'), e: v('excluir'), ex: v('exportar'), im: v('importar') },
      );
    }
    send(200, { ok: true, gravados: itens.length });
    return true;
  }
  if ((m = path.match(/^\/cad\/(\w+)(?:\/(\d+))?$/))) {
    await cadRoutes(req, send, m[1], m[2] ? Number(m[2]) : null);
    return true;
  }
  return false;
}
