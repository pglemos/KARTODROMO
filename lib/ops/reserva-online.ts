/**
 * Reserva online (reservas.kartodromodebetim.com.br) — lado do servidor da operação (SRVKART).
 * Mesmo caminho do pré-cadastro: o site guarda os pedidos na Cloudflare e este servidor busca pelo /api/sync
 * (nada daqui fica exposto na internet).
 *   1. a cada 30 s publica a agenda (baterias abertas, vagas e preço) para o site mostrar;
 *   2. a cada 5 s busca pedidos novos: grava o cliente (como o pré-cadastro), segura as vagas (Inscricao Origem 'site',
 *      status 'reservada') por 15 min e devolve o valor — o site então cobra na Asaas (Pix ou cartão);
 *   3. pedido pago no site: marca as vagas como pagas (Pago=1, 'confirmada');
 *   4. sem pagamento depois do prazo: cancela as vagas e avisa o site (que cancela a cobrança).
 * Env: PRECADASTRO_URL/PRECADASTRO_KEY (os mesmos do pré-cadastro); OPS_ONLINE_PRODUTO (4 = ANTECIPADO),
 * OPS_ONLINE_PRODUTOS_BATERIA (baterias vendidas online: 11,4), OPS_ONLINE_ANTECEDENCIA_MIN, OPS_ONLINE_MAX, OPS_ONLINE_PRAZO_MIN.
 */
import { isValidCpf, one, onlyDigits, query, tx } from './db';
import { HttpError, inscreverN } from './office';
import { gravarAcompanhante, gravarPreCadastro, preCadastroLigado, type PreCadastro } from './pre-cadastro';
import { vincularContasDoApp } from './app-mobile';

type Log = (...args: unknown[]) => void;

export const configOnline = () => {
  const e = process.env;
  return {
    produtoVenda: Number(e.OPS_ONLINE_PRODUTO || 4),
    produtosBateria: String(e.OPS_ONLINE_PRODUTOS_BATERIA || '11,4').split(',').map(Number).filter((n) => n > 0),
    antecedenciaMin: Number(e.OPS_ONLINE_ANTECEDENCIA_MIN || 120),
    maxPilotos: Number(e.OPS_ONLINE_MAX || 10),
    prazoMin: Number(e.OPS_ONLINE_PRAZO_MIN || 15),
    diasAgenda: Number(e.OPS_ONLINE_DIAS || 500), // a agenda do ano seguinte inteiro abre em outubro
  };
};

const url = () => (process.env.PRECADASTRO_URL || '').replace(/\/+$/, '');
async function chamar(caminho: string, init: RequestInit = {}, timeoutMs = 10_000) {
  const r = await fetch(url() + caminho, {
    ...init,
    headers: { 'x-sync-key': process.env.PRECADASTRO_KEY || '', 'content-type': 'application/json', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`reserva online ${caminho}: HTTP ${r.status}`);
  return r.json();
}

// ---------------------------------------------------------------- agenda

export type HorarioOnline = { id: number; inicio: string; nome: string; livres: number };

/** Baterias à venda no site: abertas, que aparecem no totem, do produto de locação, com antecedência e vaga. */
export async function agendaOnline() {
  const c = configOnline();
  const produto = await one<{ preco: number | null; nome: string }>(`SELECT PrecoCentavos preco, Nome nome FROM dbo.Produto WHERE Id = @id`, { id: c.produtoVenda });
  const linhas = await query<{ id: number; inicio: string; nome: string; vagas: number; ocupadas: number }>(
    `SELECT b.Id id, CONVERT(varchar(16), b.Inicio, 126) inicio, b.Nome nome, b.Vagas vagas,
            (SELECT COUNT(*) FROM dbo.Inscricao i WHERE i.BateriaId = b.Id AND i.Status <> 'cancelada') ocupadas
       FROM dbo.Bateria b
      WHERE b.Status = 'aberta' AND b.ReservaFechada = 0 AND b.AutoAtendimento = 1
        AND b.ProdutoId IN (${c.produtosBateria.map((n) => Number(n)).join(',') || '0'})
        AND b.Inicio > DATEADD(minute, @antes, SYSDATETIME()) AND b.Inicio < DATEADD(day, @dias, SYSDATETIME())
      ORDER BY b.Inicio`,
    { antes: c.antecedenciaMin, dias: c.diasAgenda },
  );
  const horarios: HorarioOnline[] = linhas.map((l) => ({ id: l.id, inicio: l.inicio, nome: l.nome, livres: Math.max(0, l.vagas - l.ocupadas) }));
  return {
    atualizadoEm: new Date().toISOString(),
    precoCentavos: produto?.preco ?? 0,
    maxPilotos: c.maxPilotos,
    prazoMin: c.prazoMin,
    antecedenciaMin: c.antecedenciaMin,
    horarios,
  };
}

// só manda quando muda (ou a cada 10 min): cada envio é uma gravação no R2 da Cloudflare
let ultimaAgenda = '', ultimoEnvio = 0;
export async function publicarAgenda() {
  const agenda = await agendaOnline();
  const assinatura = JSON.stringify({ ...agenda, atualizadoEm: '' });
  if (assinatura === ultimaAgenda && Date.now() - ultimoEnvio < 10 * 60_000) return 0;
  await chamar('/api/sync/agenda', { method: 'PUT', body: JSON.stringify(agenda) });
  ultimaAgenda = assinatura; ultimoEnvio = Date.now();
  return agenda.horarios.length;
}

// ---------------------------------------------------------------- pedidos

export type PedidoSite = {
  id: string;
  codigo: string;
  status: 'novo' | 'pago';
  criadoEm: string;
  bateriaId: number;
  quantidade: number;
  forma: 'pix' | 'cartao';
  pilotos: string[];
  /** Os outros pilotos (uma vaga para cada, além do comprador). Pedidos antigos não têm: as vagas ficam no nome do comprador. */
  acompanhantes?: { nome: string; documento: string; nascimento: string; instagram?: string; chave?: string }[];
  /** false = quem comprou não pilota: as vagas são todas dos acompanhantes (ele fica como responsável). */
  compradorPilota?: boolean;
  cupom?: string;
  cliente: Omit<PreCadastro, 'key' | 'chave' | 'recebidoEm'> & { chave: string };
  pagamento?: { asaasId: string; billingType: string; pagoEm: string; valorCentavos: number };
};

type Resultado =
  | { id: string; acao: 'reservado'; valorCentavos: number; expiraEm: string; descricao: string; inicio: string }
  | { id: string; acao: 'recusado'; erro: string }
  | { id: string; acao: 'confirmado'; codigo: string }
  | { id: string; acao: 'expirado' }
  | { id: string; acao: 'pago_sem_vaga'; erro: string };

type Linha = { Id: number; Status: string; InscricaoIds: string; ValorCentavos: number; expira: string; BateriaId: number; Quantidade: number; ClienteId: number; Codigo: string };
const LINHA = `SELECT *, CONVERT(varchar(19), ExpiraEm, 126) expira FROM dbo.ReservaOnline`;
/** O banco grava no horário de Brasília (SYSDATETIME); o site recebe com o fuso explícito. */
const brasilia = (local: string) => `${String(local ?? '').slice(0, 19)}-03:00`;

const ids = (s: string) => s.split(',').map(Number).filter((n) => n > 0);
const brl = (centavos: number) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type CouponInput = { codigo: string; documento: string; bateriaId: number; quantidade: number };
type CouponQuote = { brutoCentavos: number; descontoCentavos: number; totalCentavos: number; voucherId: number | null; clienteId: number };
type ReadOne = (text: string, params?: Record<string, unknown>) => Promise<Record<string, unknown> | null>;

async function calcularPedidoOnline(input: CouponInput, read: ReadOne, lock: boolean, clienteId?: number): Promise<CouponQuote & { nome: string; inicio: string }> {
  const c = configOnline();
  const quantidade = Math.trunc(Number(input.quantidade));
  const codigo = String(input.codigo ?? '').trim().toUpperCase();
  const documento = onlyDigits(input.documento);
  if (!(quantidade >= 1 && quantidade <= c.maxPilotos) || (codigo && !isValidCpf(documento))) throw new HttpError(400, 'Dados do cupom inválidos.');

  const baterias = c.produtosBateria.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0).join(',') || '0';
  const bateria = await read(
    `SELECT b.Id, b.Nome nome, CONVERT(varchar(16), b.Inicio, 126) inicio, b.Status, b.Vagas, b.ReservaFechada, b.AutoAtendimento, b.ProdutoId,
            (SELECT COUNT(*) FROM dbo.Inscricao i WHERE i.BateriaId = b.Id AND i.Status <> 'cancelada') ocupadas,
            CASE WHEN b.Status = 'aberta' AND b.ReservaFechada = 0 AND b.AutoAtendimento = 1
                  AND b.ProdutoId IN (${baterias}) AND b.Inicio > DATEADD(minute, @antes, SYSDATETIME()) THEN 1 ELSE 0 END ok
       FROM dbo.Bateria b${lock ? ' WITH (UPDLOCK, HOLDLOCK)' : ''} WHERE b.Id = @id`,
    { id: Number(input.bateriaId), antes: c.antecedenciaMin - 10 },
  );
  if (!bateria || Number(bateria.ok) !== 1) throw new HttpError(400, 'Esse horário não está mais disponível. Escolha outro.');
  const livres = Number(bateria.Vagas) - Number(bateria.ocupadas);
  if (livres < quantidade) throw new HttpError(409, `Não há vagas o suficiente para a quantidade de participantes selecionada. Vagas disponíveis: ${Math.max(0, livres)}.`);

  const produto = await read('SELECT Id, PrecoCentavos preco FROM dbo.Produto WHERE Id = @id', { id: c.produtoVenda });
  const preco = Number(produto?.preco ?? 0);
  if (!Number.isSafeInteger(preco) || preco <= 0) throw new HttpError(503, 'Reserva online indisponível no momento. Fale com a recepção pelo WhatsApp.');
  const brutoCentavos = preco * quantidade;
  if (!Number.isSafeInteger(brutoCentavos)) throw new HttpError(400, 'Valor da reserva inválido.');
  if (!codigo) return { brutoCentavos, descontoCentavos: 0, totalCentavos: brutoCentavos, voucherId: null, clienteId: clienteId ?? 0, nome: String(bateria.nome), inicio: String(bateria.inicio) };
  if (!/^[A-Z0-9_-]{1,40}$/.test(codigo)) throw new HttpError(400, 'Voucher não encontrado.');

  const cliente = clienteId ?? Number((await read(
    `SELECT TOP 1 Id id FROM dbo.Cliente WHERE (DocumentoNum = @doc OR Documento = @doc) AND ResponsavelId IS NULL ORDER BY AtualizadoEm DESC`,
    { doc: documento },
  ))?.id ?? 0);
  const voucher = await read(
    `SELECT v.*, p.Ativo parceiroAtivo, fc.Ativo fidelidadeAtiva,
            CASE WHEN CAST(SYSDATETIME() AS date) BETWEEN v.InicioEm AND v.FimEm THEN 1 ELSE 0 END vigenciaOk
       FROM dbo.Voucher v${lock ? ' WITH (UPDLOCK, HOLDLOCK)' : ''}
       LEFT JOIN dbo.Parceiro p ON p.Id = v.ParceiroId LEFT JOIN dbo.FidelidadeConta fc ON fc.Id = v.FidelidadeContaId
      WHERE v.Codigo = @codigo`,
    { codigo },
  );
  if (!voucher || !voucher.Ativo) throw new HttpError(400, 'Voucher não encontrado.');
  if (voucher.ParceiroId && !voucher.parceiroAtivo) throw new HttpError(400, 'O parceiro vinculado ao voucher está inativo.');
  if (voucher.FidelidadeContaId && !voucher.fidelidadeAtiva) throw new HttpError(400, 'A conta de fidelidade vinculada ao voucher está inativa.');
  if (!voucher.vigenciaOk) throw new HttpError(400, 'Voucher expirado.');
  if (voucher.ProdutoId && Number(voucher.ProdutoId) !== c.produtoVenda) throw new HttpError(400, 'O produto do voucher não está na reserva.');

  const usos = await read(
    `SELECT
       (SELECT COUNT(*) FROM dbo.VoucherUso u WHERE u.VoucherId = @voucher AND u.Estornado = 0)
       + (SELECT COUNT(*) FROM dbo.ReservaOnlineVoucherUso o WHERE o.VoucherId = @voucher AND o.Estado IN ('reservado', 'consumido', 'reembolso_pendente')) n,
       (SELECT COUNT(*) FROM dbo.VoucherUso u WHERE u.VoucherId = @voucher AND u.ClienteId = @cliente AND u.Estornado = 0)
       + (SELECT COUNT(*) FROM dbo.ReservaOnlineVoucherUso o WHERE o.VoucherId = @voucher AND o.ClienteId = @cliente AND o.Estado IN ('reservado', 'consumido', 'reembolso_pendente')) doCliente`,
    { voucher: voucher.Id, cliente },
  );
  if (voucher.UsoUnico && Number(usos?.n ?? 0) > 0) throw new HttpError(400, 'Voucher já utilizado.');
  if (Number(usos?.doCliente ?? 0) >= Number(voucher.UsoMaxCliente ?? 1)) throw new HttpError(400, 'Limite de usos deste voucher para este cliente já atingido.');
  if (voucher.PedidoMinimoCentavos && brutoCentavos < Number(voucher.PedidoMinimoCentavos)) {
    throw new HttpError(400, `Valor do pedido insuficiente. Mínimo exigido: ${brl(Number(voucher.PedidoMinimoCentavos))}.`);
  }

  let descontoCentavos = voucher.Tipo === 'percentual'
    ? Math.round((brutoCentavos * Number(voucher.Valor)) / 100)
    : Number(voucher.Valor);
  if (voucher.DescontoMaximoCentavos) descontoCentavos = Math.min(descontoCentavos, Number(voucher.DescontoMaximoCentavos));
  descontoCentavos = Math.min(Math.max(0, descontoCentavos), brutoCentavos);
  return { brutoCentavos, descontoCentavos, totalCentavos: brutoCentavos - descontoCentavos, voucherId: Number(voucher.Id), clienteId: cliente, nome: String(bateria.nome), inicio: String(bateria.inicio) };
}

export async function previsualizarVoucherOnline(input: CouponInput) {
  try {
    const quote = await calcularPedidoOnline(input, (sql, params) => one(sql, params), false);
    return { brutoCentavos: quote.brutoCentavos, descontoCentavos: quote.descontoCentavos, totalCentavos: quote.totalCentavos };
  } catch (error) {
    if (error instanceof HttpError) return { erro: error.message };
    throw error;
  }
}

/** Texto curto do pedido (vai na cobrança da Asaas e na tela de confirmação). */
export function descricaoPedido(nomeBateria: string, inicio: string, quantidade: number) {
  const [d, h] = inicio.split('T');
  const [a, m, dia] = d.split('-');
  return `Kartódromo de Betim · ${nomeBateria} · ${dia}/${m}/${a} ${h.slice(0, 5)} · ${quantidade} ${quantidade === 1 ? 'piloto' : 'pilotos'}`;
}

/** Pedido novo: grava o cliente e segura as vagas. Idempotente pelo id do pedido (o site pode mandar de novo). */
export async function reservarPedido(p: PedidoSite, log: Log): Promise<Resultado> {
  const c = configOnline();
  const ja = await one<Linha>(`${LINHA} WHERE PedidoId = @id`, { id: p.id });
  if (ja) {
    if (ja.Status === 'aguardando') {
      const b = await one<{ nome: string; inicio: string }>(`SELECT Nome nome, CONVERT(varchar(16), Inicio, 126) inicio FROM dbo.Bateria WHERE Id = @id`, { id: ja.BateriaId });
      return { id: p.id, acao: 'reservado', valorCentavos: ja.ValorCentavos, expiraEm: brasilia(ja.expira), descricao: descricaoPedido(b?.nome ?? '', b?.inicio ?? 'T', ja.Quantidade), inicio: b?.inicio ?? '' };
    }
    if (ja.Status === 'pago') return { id: p.id, acao: 'confirmado', codigo: ja.Codigo };
    return { id: p.id, acao: 'expirado' };
  }
  const n = Math.trunc(Number(p.quantidade));
  if (!(n >= 1 && n <= c.maxPilotos)) return { id: p.id, acao: 'recusado', erro: `Escolha de 1 a ${c.maxPilotos} pilotos.` };
  try {
    await calcularPedidoOnline(
      { codigo: p.cupom ?? '', documento: p.cliente.documento, bateriaId: Number(p.bateriaId), quantidade: n },
      (sql, params) => one(sql, params),
      false,
    );
  } catch (e) {
    if (e instanceof HttpError) return { id: p.id, acao: 'recusado', erro: e.message };
    throw e;
  }
  const cliente: PreCadastro = { ...p.cliente, key: '', recebidoEm: p.criadoEm, menores: p.cliente.menores ?? [] } as PreCadastro;
  const clienteId = await gravarPreCadastro(cliente, log);
  // cada vaga é de uma pessoa: o comprador + um cadastro para cada outro piloto (pedidos antigos, sem a lista: tudo no comprador)
  const eu = p.compradorPilota !== false;
  const faltam = n - (eu ? 1 : 0);
  const outros = (p.acompanhantes ?? []).slice(0, faltam);
  const pessoas = faltam > 0 && outros.length === faltam
    ? [...(eu ? [clienteId] : []), ...(await Promise.all(outros.map((a) => gravarAcompanhante(a, log))))]
    : undefined;
  if (pessoas && new Set(pessoas).size !== pessoas.length) return { id: p.id, acao: 'recusado', erro: 'Cada vaga precisa ser de uma pessoa diferente (há CPF repetido entre os pilotos).' };
  const obs = `Reserva online ${p.codigo}` + (p.pilotos?.length ? ` · pilotos: ${p.pilotos.join(', ')}`.slice(0, 380) : '');
  try {
    const result = await tx(async (run) => {
      const read: ReadOne = async (sql, params) => (await run(sql, params))[0] ?? null;
      const quote = await calcularPedidoOnline(
        { codigo: p.cupom ?? '', documento: p.cliente.documento, bateriaId: Number(p.bateriaId), quantidade: n },
        read,
        true,
        clienteId,
      );
      const inscricoes = await inscreverN(Number(p.bateriaId), clienteId, n, 'site', null, obs, true, { produtoId: c.produtoVenda, clientes: pessoas, run });
      await run(
        `INSERT INTO dbo.ReservaOnline (PedidoId, Codigo, ClienteId, BateriaId, Quantidade, ValorCentavos, Status, Forma, InscricaoIds, Pilotos, ExpiraEm)
         VALUES (@pedido, @codigo, @cliente, @bateria, @n, @valor, 'aguardando', @forma, @insc, @pilotos, DATEADD(minute, @prazo, SYSDATETIME()))`,
        { pedido: p.id, codigo: p.codigo, cliente: clienteId, bateria: Number(p.bateriaId), n, valor: quote.totalCentavos, forma: p.forma, insc: inscricoes.join(','), pilotos: (p.pilotos ?? []).join(', ').slice(0, 600) || null, prazo: c.prazoMin },
      );
      if (quote.voucherId !== null) {
        await run(
          `INSERT INTO dbo.ReservaOnlineVoucherUso (PedidoId, VoucherId, ClienteId, DescontoCentavos, ValidadeEm, Estado)
           VALUES (@pedido, @voucher, @cliente, @desconto, DATEADD(minute, @prazo, SYSDATETIME()), 'reservado')`,
          { pedido: p.id, voucher: quote.voucherId, cliente: clienteId, desconto: quote.descontoCentavos, prazo: c.prazoMin },
        );
      }
      const nova = await read(`SELECT CONVERT(varchar(19), ExpiraEm, 126) expira FROM dbo.ReservaOnline WHERE PedidoId = @p`, { p: p.id });
      return { quote, inscricoes, expira: String(nova?.expira ?? '') };
    });
    const expiraEm = brasilia(result.expira);
    log(`reserva online ${p.codigo}: ${n} vaga(s) seguradas na bateria ${p.bateriaId} para o cliente ${clienteId} até ${result.expira.slice(11, 16)}`);
    return { id: p.id, acao: 'reservado', valorCentavos: result.quote.totalCentavos, expiraEm, descricao: descricaoPedido(result.quote.nome, result.quote.inicio, n), inicio: result.quote.inicio };
  } catch (e) {
    if (e instanceof HttpError && [400, 404, 409, 503].includes(e.status)) return { id: p.id, acao: 'recusado', erro: e.message };
    throw e;
  }
}

/** Pagamento confirmado no site: vagas pagas. Se o prazo já tinha vencido, tenta segurar de novo; sem vaga, fica para devolver. */
export async function confirmarPagamento(p: PedidoSite, log: Log): Promise<Resultado> {
  const r = await one<Linha>(`${LINHA} WHERE PedidoId = @id`, { id: p.id });
  if (!r) return { id: p.id, acao: 'pago_sem_vaga', erro: 'Pedido não encontrado no sistema da recepção.' };
  if (r.Status === 'pago') return { id: p.id, acao: 'confirmado', codigo: r.Codigo };
  // a Asaas diz se o cartão foi de débito (DEBIT_CARD) — a recepção mostra Pix / Crédito / Débito
  const forma = p.pagamento?.billingType === 'PIX' ? 'pix' : p.pagamento?.billingType === 'DEBIT_CARD' ? 'debito' : 'credito';
  if (r.Status === 'pago_sem_vaga') return { id: p.id, acao: 'pago_sem_vaga', erro: 'O pagamento está aguardando a resolução da recepção.' };
  const voucherUso = await one<{ Estado: string }>(`SELECT Estado FROM dbo.ReservaOnlineVoucherUso WHERE PedidoId = @id`, { id: p.id });
  if (voucherUso?.Estado === 'liberado') {
    await tx(async (run) => {
      await run(`UPDATE dbo.ReservaOnline SET Status = 'pago_sem_vaga', AsaasPagamentoId = @asaas, PagoEm = SYSDATETIME(), Forma = @forma WHERE Id = @id`, {
        id: r.Id, asaas: p.pagamento?.asaasId ?? null, forma,
      });
      await run(`UPDATE dbo.ReservaOnlineVoucherUso SET Estado = 'reembolso_pendente' WHERE PedidoId = @pedido AND Estado = 'liberado'`, { pedido: p.id });
    });
    return { id: p.id, acao: 'pago_sem_vaga', erro: 'O pagamento chegou depois do prazo da reserva. A recepção precisa conferir o pedido e o cupom.' };
  }
  let insc = ids(r.InscricaoIds);
  const ativas = await query<{ Id: number }>(`SELECT Id FROM dbo.Inscricao WHERE Id IN (${insc.join(',') || '0'}) AND Status <> 'cancelada'`);
  if (ativas.length < insc.length && (await reativarVagas(r.BateriaId, insc.filter((i) => !ativas.some((a) => a.Id === i))))) {
    log(`reserva online ${r.Codigo}: paga após o prazo, as mesmas ${insc.length - ativas.length} vaga(s) voltaram`);
  } else if (ativas.length < insc.length) {
    // pagou depois do prazo e não deu para devolver as mesmas linhas: segura de novo se ainda houver, para as MESMAS pessoas
    const canceladas = await query<{ ClienteId: number }>(`SELECT ClienteId FROM dbo.Inscricao WHERE Id IN (${insc.join(',') || '0'}) AND Status = 'cancelada' ORDER BY Id`);
    try {
      const novas = await inscreverN(r.BateriaId, r.ClienteId, r.Quantidade - ativas.length, 'site', null, `Reserva online ${r.Codigo} (paga após o prazo)`, true, { produtoId: configOnline().produtoVenda, clientes: canceladas.length === r.Quantidade - ativas.length ? canceladas.map((x) => x.ClienteId) : undefined });
      insc = [...ativas.map((a) => a.Id), ...novas];
    } catch (e) {
      await tx(async (run) => {
        await run(`UPDATE dbo.ReservaOnline SET Status = 'pago_sem_vaga', AsaasPagamentoId = @asaas, PagoEm = SYSDATETIME(), Forma = @forma WHERE Id = @id`, { id: r.Id, asaas: p.pagamento?.asaasId ?? null, forma });
        await run(`UPDATE dbo.ReservaOnlineVoucherUso SET Estado = 'reembolso_pendente' WHERE PedidoId = @pedido AND Estado IN ('reservado', 'liberado')`, { pedido: p.id });
      });
      log(`reserva online ${r.Codigo}: PAGO SEM VAGA (${(e as Error).message}) — devolver ou reagendar`);
      return { id: p.id, acao: 'pago_sem_vaga', erro: 'Recebemos o pagamento, mas as vagas desse horário acabaram. A recepção vai entrar em contato para trocar o horário ou devolver o valor.' };
    }
  }
  const unit = Math.round(r.ValorCentavos / Math.max(1, r.Quantidade));
  await tx(async (run) => {
    await run(`UPDATE dbo.Inscricao SET Pago = 1, ValorCentavos = @unit, Status = 'confirmada', Aprovada = 1, AtualizadoEm = SYSDATETIME() WHERE Id IN (${insc.join(',')})`, { unit });
    await run(`UPDATE dbo.ReservaOnline SET Status = 'pago', InscricaoIds = @insc, AsaasPagamentoId = @asaas, PagoEm = SYSDATETIME(), Forma = @forma WHERE Id = @id`, { id: r.Id, insc: insc.join(','), asaas: p.pagamento?.asaasId ?? null, forma });
    await run(`UPDATE dbo.ReservaOnlineVoucherUso SET Estado = 'consumido' WHERE PedidoId = @pedido AND Estado IN ('reservado', 'reembolso_pendente')`, { pedido: p.id });
  });
  log(`reserva online ${r.Codigo}: paga (${forma}), ${insc.length} vaga(s) confirmadas`);
  return { id: p.id, acao: 'confirmado', codigo: r.Codigo };
}

/**
 * Pix pago dentro do prazo cujo aviso só chegou depois (13/10, reserva ACEXRJ: o webhook ainda ia para o MyLapTime):
 * as vagas já tinham sido canceladas. Devolve as MESMAS inscrições (se a bateria ainda tem lugar e não passou) em vez de
 * criar outras — senão a recepção via o piloto duas vezes na bateria (as canceladas + as novas).
 */
async function reativarVagas(bateriaId: number, canceladas: number[]) {
  if (!canceladas.length) return false;
  return tx(async (run) => {
    const [b] = await run(
      `SELECT b.Vagas - (SELECT COUNT(*) FROM dbo.Inscricao i WITH (UPDLOCK, HOLDLOCK) WHERE i.BateriaId = b.Id AND i.Status <> 'cancelada') livres,
              CASE WHEN b.Status = 'cancelada' OR b.Inicio < DATEADD(minute, -30, SYSDATETIME()) THEN 0 ELSE 1 END ok
         FROM dbo.Bateria b WHERE b.Id = @id`,
      { id: bateriaId },
    );
    if (!b || !b.ok || (b.livres as number) < canceladas.length) return false;
    const n = await run(`UPDATE dbo.Inscricao SET Status = 'confirmada', AtualizadoEm = SYSDATETIME() OUTPUT inserted.Id WHERE Id IN (${canceladas.join(',')}) AND Status = 'cancelada'`);
    return n.length === canceladas.length;
  });
}

/** Prazo vencido sem pagamento (com 2 min de folga para o aviso da Asaas chegar): cancela as vagas. */
export async function expirarVencidos(log: Log) {
  const vencidos = await query<Linha & { PedidoId: string }>(`${LINHA} WHERE Status = 'aguardando' AND ExpiraEm < DATEADD(minute, -2, SYSDATETIME())`);
  const res: Resultado[] = [];
  for (const v of vencidos) {
    await tx(async (run) => {
      await run(`UPDATE dbo.Inscricao SET Status = 'cancelada', AtualizadoEm = SYSDATETIME() WHERE Id IN (${ids(v.InscricaoIds).join(',') || '0'}) AND Pago = 0 AND Status <> 'cancelada'`);
      await run(`UPDATE dbo.ReservaOnline SET Status = 'expirado' WHERE Id = @id AND Status = 'aguardando'`, { id: v.Id });
      await run(`UPDATE dbo.ReservaOnlineVoucherUso SET Estado = 'liberado' WHERE PedidoId = @pedido AND Estado = 'reservado'`, { pedido: v.PedidoId });
    });
    log(`reserva online ${v.Codigo}: sem pagamento no prazo, vagas liberadas`);
    res.push({ id: v.PedidoId, acao: 'expirado' });
  }
  return res;
}

/** Processa prévias móveis pendentes pela fila autenticada do Worker. */
export async function sincronizarCuponsOnline(log: Log) {
  if (!preCadastroLigado()) return 0;
  const jobs = await chamar('/api/sync/mobile/coupons') as (CouponInput & { requestId: string })[];
  let processados = 0;
  for (const job of jobs) {
    try {
      const result = await previsualizarVoucherOnline(job);
      await chamar(`/api/sync/mobile/coupons/${encodeURIComponent(job.requestId)}`, { method: 'POST', body: JSON.stringify(result) });
      processados++;
    } catch {
      log(`prévia de cupom ${String(job.requestId).slice(0, 8)}: não foi possível concluir agora`);
    }
  }
  return processados;
}

// ---------------------------------------------------------------- no totem

/**
 * A reserva online fica toda no nome de quem comprou (N vagas pagas). Quando o grupo se identifica no totem, cada
 * piloto que ainda não tem vaga na bateria fica com uma dessas vagas pagas (do comprador, se ele estiver no grupo ou
 * for o responsável pelos menores) em vez de virar uma pré-reserva nova — senão as vagas eram contadas em dobro.
 * Devolve o id da inscrição que passou para o piloto, ou null.
 */
export async function vagaOnlineDoGrupo(bateriaId: number, clienteId: number, participantes: number[], log: Log, quemSeIdentificou: number | null = null) {
  const grupo = [...new Set(participantes.filter((n) => n > 0))];
  if (!grupo.length) return null;
  const lista = grupo.join(',');
  const resp = await query<{ r: number }>(`SELECT DISTINCT ResponsavelId r FROM dbo.Cliente WHERE Id IN (${lista}) AND ResponsavelId IS NOT NULL`);
  // quem se identificou no totem pagou pelo grupo mesmo sem correr (não está na lista de participantes)
  const donos = [...new Set([...grupo, ...resp.map((x) => x.r), ...(quemSeIdentificou ? [quemSeIdentificou] : [])])].join(',');
  const vaga = await one<{ Id: number; dono: number; nome: string }>(
    `SELECT TOP 1 i.Id, i.ClienteId dono, c.Nome nome FROM dbo.Inscricao i JOIN dbo.Cliente c ON c.Id = i.ClienteId
      WHERE i.BateriaId = @b AND i.Origem = 'site' AND i.Pago = 1 AND i.Status <> 'cancelada'
        AND i.ClienteId IN (${donos}) AND i.ClienteId <> @c
        -- o comprador que também vai correr fica com uma vaga dele: só as que sobram passam para o grupo
        AND (i.ClienteId NOT IN (${lista})
             OR (SELECT COUNT(*) FROM dbo.Inscricao j WHERE j.BateriaId = @b AND j.ClienteId = i.ClienteId AND j.Status <> 'cancelada') > 1)
      ORDER BY i.Id DESC`,
    { b: bateriaId, c: clienteId },
  );
  if (!vaga) return null;
  const r = await one<{ n: number }>(
    `UPDATE dbo.Inscricao SET ClienteId = @c, Observacao = LEFT(ISNULL(Observacao + ' · ', '') + @obs, 400), AtualizadoEm = SYSDATETIME()
      OUTPUT 1 n WHERE Id = @id AND ClienteId = @dono`,
    { c: clienteId, id: vaga.Id, dono: vaga.dono, obs: `vaga paga online por ${vaga.nome}` },
  );
  if (!r) return null;
  log(`totem: vaga paga online (inscrição ${vaga.Id}, de ${vaga.nome}) passou para o cliente ${clienteId}`);
  return vaga.Id;
}

/** Ciclo de 5 s: pedidos novos, pagos e vencidos. */
export async function sincronizarReservasOnline(log: Log) {
  if (!preCadastroLigado()) return 0;
  let previas = 0;
  try { previas = await sincronizarCuponsOnline(log); }
  catch { log('prévia de cupons: sincronização temporariamente indisponível'); }
  // contas do app com e-mail confirmado: vincula ao cliente pelo CPF + e-mail/telefone (uma vez por minuto)
  try { await vincularContasDoApp(log); }
  catch (e) { log(`app: vínculo automático indisponível agora (${(e as Error).message})`); }
  const pedidos = (await chamar('/api/sync/pedidos')) as PedidoSite[];
  const resultados: Resultado[] = [];
  for (const p of pedidos) {
    try {
      resultados.push(p.status === 'pago' ? await confirmarPagamento(p, log) : await reservarPedido(p, log));
    } catch (e) {
      log(`reserva online ${p.codigo}: erro ${(e as Error).message}`);
    }
  }
  resultados.push(...(await expirarVencidos(log)));
  if (resultados.length) await chamar('/api/sync/pedido', { method: 'POST', body: JSON.stringify(resultados) });
  return resultados.length + previas;
}
