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
 * OPS_ONLINE_PRODUTOS_BATERIA (baterias vendidas online: 11,4,67), OPS_ONLINE_ANTECEDENCIA_MIN, OPS_ONLINE_MAX, OPS_ONLINE_PRAZO_MIN,
 * OPS_ONLINE_PRECO_PROPRIO (baterias vendidas pelo preço do próprio produto: 67 = HAPPY HOUR, R$ 99,90) e
 * OPS_ONLINE_PRIMEIRA_VEZ (produto:preço de quem nunca andou no kartódromo: 67:8990 = R$ 89,90 no Happy Hour).
 */
import { isValidCpf, one, onlyDigits, query, tx } from './db';
import { HttpError, inscreverN } from './office';
import { configOnline, produtoDaBateria } from './preco-antecipado';

export { configOnline, produtoDaBateria };
import { avaliarElegibilidadeVoucher } from './vouchers';
import { grupoDaReservaOnline } from './grupos';
import { emCurso } from './andamento';
import { gravarAcompanhante, gravarPreCadastro, preCadastroLigado, type AcompanhanteSite, type PreCadastro } from './pre-cadastro';
import { escutarPedidosDeVinculo, publicarClientesDoApp, publicarHistoricosVinculados, publicarRankingDoApp, sincronizarPerfisDoApp, vincularContasDoApp } from './app-mobile';

type Log = (...args: unknown[]) => void;

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

export type HorarioOnline = { id: number; inicio: string; nome: string; livres: number; precoCentavos: number; precoPrimeiraVezCentavos?: number };


/**
 * Primeira vez no kartódromo: CPF sem cadastro, ou cadastro sem nenhuma inscrição (corrida, marcada ou paga) e que não veio
 * dos sistemas antigos de cronometragem (origem 'legado' = já passou pela pista antes de 2026).
 */
export async function primeiraVez(documentos: string[], read: ReadOne): Promise<boolean[]> {
  const out: boolean[] = [];
  for (const d of documentos) {
    const doc = onlyDigits(d);
    if (!isValidCpf(doc)) { out.push(false); continue; }
    const r = await read(
      `select count(*) n from kart.cliente c
        where (c.documento_num = @doc or c.documento = @doc)
          and (c.origem = 'legado' or c.legado_id is not null
               or exists (select 1 from kart.inscricao i where i.cliente_id = c.id and i.status <> 'cancelada'))`,
      { doc },
    );
    out.push(Number(r?.n ?? 1) === 0);
  }
  return out;
}

/** Baterias à venda no site: abertas, que aparecem no totem, do produto de locação, com antecedência e vaga. */
export async function agendaOnline() {
  const c = configOnline();
  const produto = await one<{ preco: number | null; nome: string }>(`select preco_centavos preco, nome from kart.produto where id = @id`, { id: c.produtoVenda });
  const linhas = await query<{ id: number; inicio: string; nome: string; vagas: number; ocupadas: number; produto: number; preco: number | null }>(
    `select b.id, to_char(b.inicio, 'YYYY-MM-DD"T"HH24:MI') inicio, b.nome, b.vagas, b.produto_id produto, pb.preco_centavos preco,
            (select count(*) from kart.inscricao i where i.bateria_id = b.id and i.status <> 'cancelada') ocupadas
       from kart.bateria b left join kart.produto pb on pb.id = b.produto_id
      where b.status = 'aberta' and not coalesce(b.reserva_fechada, false)
        and b.produto_id in (${c.produtosBateria.map((n) => Number(n)).join(',') || '0'})
        and b.inicio > now() + make_interval(mins => @antes::int) and b.inicio < now() + make_interval(days => @dias::int)
      order by b.inicio`,
    { antes: c.antecedenciaMin, dias: c.diasAgenda },
  );
  const horarios: HorarioOnline[] = [];
  for (const l of linhas) {
    const proprio = produtoDaBateria(l.produto, c) !== c.produtoVenda;
    const preco = proprio ? Number(l.preco ?? 0) : Number(produto?.preco ?? 0);
    if (!(preco > 0)) continue; // sem preço não dá para vender
    const pv = proprio ? c.primeiraVez[l.produto] : undefined;
    horarios.push({ id: l.id, inicio: l.inicio, nome: l.nome, livres: Math.max(0, l.vagas - l.ocupadas), precoCentavos: preco, ...(pv && pv < preco ? { precoPrimeiraVezCentavos: pv } : {}) });
  }
  return {
    atualizadoEm: new Date().toISOString(),
    precoCentavos: produto?.preco ?? 0,
    maxPilotos: c.maxPilotos,
    prazoMin: c.prazoMin,
    antecedenciaMin: c.antecedenciaMin,
    // este SRVKART sabe criar o grupo "cada um paga o seu" do site: sem isto o site não oferece a opção
    // (site novo com SRVKART antigo cobraria todas as vagas do organizador)
    grupoSite: true,
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
  /** 'confirmado' só no "cada um paga o seu" que voltou à fila porque o grupo não foi criado. */
  status: 'novo' | 'pago' | 'confirmado';
  criadoEm: string;
  bateriaId: number;
  quantidade: number;
  forma: 'pix' | 'cartao';
  pilotos: string[];
  /** Os outros pilotos (uma vaga para cada, além do comprador). Pedidos antigos não têm: as vagas ficam no nome do comprador. */
  acompanhantes?: (AcompanhanteSite & { chave?: string })[];
  /** false = quem comprou não pilota: as vagas são todas dos acompanhantes (ele fica como responsável). */
  compradorPilota?: boolean;
  /** 'individual' = cada um paga o seu (site, 12/11/2026): segura todas as vagas, cobra só 1 e vira grupo depois de pago. */
  modo?: 'individual';
  cupom?: string;
  cliente: Omit<PreCadastro, 'key' | 'chave' | 'recebidoEm'> & { chave: string };
  pagamento?: { asaasId: string; billingType: string; pagoEm: string; valorCentavos: number };
};

type Resultado =
  | { id: string; acao: 'reservado'; valorCentavos: number; expiraEm: string; descricao: string; inicio: string }
  | { id: string; acao: 'recusado'; erro: string }
  | { id: string; acao: 'confirmado'; codigo: string; grupo?: { codigo: string; link: string; painel: string } }
  | { id: string; acao: 'expirado' }
  | { id: string; acao: 'pago_sem_vaga'; erro: string };

type Linha = { Id: number; Status: string; InscricaoIds: string; ValorCentavos: number; expira: string; BateriaId: number; Quantidade: number; ClienteId: number; Codigo: string };
const LINHA = `select id "Id", pedido_id "PedidoId", status "Status", inscricao_ids "InscricaoIds", valor_centavos "ValorCentavos", bateria_id "BateriaId",
  quantidade "Quantidade", cliente_id "ClienteId", codigo "Codigo", to_char(expira_em, 'YYYY-MM-DD"T"HH24:MI:SS') expira from kart.reserva_online`;
/** As horas saem no horário de Brasília (sessão em America/Sao_Paulo); o site recebe com o fuso explícito. */
const brasilia = (local: string) => `${String(local ?? '').slice(0, 19)}-03:00`;

const ids = (s: string) => s.split(',').map(Number).filter((n) => n > 0);
const brl = (centavos: number) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** documentos = CPF de quem pilota cada vaga (define o preço de primeira vez). Sem a lista, todas as vagas pelo preço cheio. */
type CouponInput = { codigo: string; documento: string; bateriaId: number; quantidade: number; documentos?: string[] };
type CouponQuote = { brutoCentavos: number; descontoCentavos: number; totalCentavos: number; voucherId: number | null; clienteId: number; produtoId: number; precos: number[] };
type ReadOne = (text: string, params?: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
type ReadList = (text: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>[]>;

/**
 * Até quando a vaga fica segura sem pagamento. Regra do dono (20/11/2026): 2 horas (`OPS_ONLINE_PRAZO_MIN`), mas
 * nunca depois de 1 hora antes da bateria (a hora de chegada), e nunca menos de 15 minutos, para quem reserva em cima.
 */
export const PRAZO_MINIMO_MIN = 15;
export const MARGEM_ANTES_DA_BATERIA_MIN = 60;
export const EXPIRA_SQL = `greatest(now() + make_interval(mins => @minimo::int),
  least(now() + make_interval(mins => @prazo::int),
        (select b.inicio from kart.bateria b where b.id = @bateria) - make_interval(mins => @margem::int)))`;

async function calcularPedidoOnline(input: CouponInput, read: ReadOne, lock: boolean, clienteId?: number, readList?: ReadList): Promise<CouponQuote & { nome: string; inicio: string }> {
  const c = configOnline();
  const quantidade = Math.trunc(Number(input.quantidade));
  const codigo = String(input.codigo ?? '').trim().toUpperCase();
  const documento = onlyDigits(input.documento);
  if (!(quantidade >= 1 && quantidade <= c.maxPilotos) || (codigo && !isValidCpf(documento))) throw new HttpError(400, 'Dados do cupom inválidos.');
  if (codigo && !/^[A-Z0-9_-]{1,40}$/.test(codigo)) throw new HttpError(400, 'Voucher não encontrado.');

  const baterias = c.produtosBateria.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0).join(',') || '0';
  const bateria = await read(
    `select b.id "Id", b.nome, to_char(b.inicio, 'YYYY-MM-DD"T"HH24:MI') inicio, b.status "Status", b.vagas "Vagas", b.reserva_fechada "ReservaFechada", b.auto_atendimento "AutoAtendimento", b.produto_id "ProdutoId",
            (select count(*) from kart.inscricao i where i.bateria_id = b.id and i.status <> 'cancelada') ocupadas,
            case when b.status = 'aberta' and not coalesce(b.reserva_fechada, false)
                  and b.produto_id in (${baterias}) and b.inicio > now() + make_interval(mins => @antes::int) then 1 else 0 end ok
       from kart.bateria b where b.id = @id${lock ? ' for update of b' : ''}`,
    { id: Number(input.bateriaId), antes: c.antecedenciaMin - 10 },
  );
  if (!bateria || Number(bateria.ok) !== 1) throw new HttpError(400, 'Esse horário não está mais disponível. Escolha outro.');
  const livres = Number(bateria.Vagas) - Number(bateria.ocupadas);
  if (livres < quantidade) throw new HttpError(409, `Não há vagas o suficiente para a quantidade de participantes selecionada. Vagas disponíveis: ${Math.max(0, livres)}.`);

  const produtoId = produtoDaBateria(Number(bateria.ProdutoId), c);
  const produto = await read('select id "Id", preco_centavos preco from kart.produto where id = @id', { id: produtoId });
  const preco = Number(produto?.preco ?? 0);
  if (!Number.isSafeInteger(preco) || preco <= 0) throw new HttpError(503, 'Reserva online indisponível no momento. Fale com a recepção pelo WhatsApp.');
  const pv = c.primeiraVez[produtoId];
  const docs = (input.documentos ?? []).slice(0, quantidade);
  const novatos = pv && pv < preco && docs.length === quantidade ? await primeiraVez(docs, read) : [];
  const precos = Array.from({ length: quantidade }, (_, i) => (novatos[i] ? pv : preco));
  const brutoCentavos = precos.reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(brutoCentavos)) throw new HttpError(400, 'Valor da reserva inválido.');
  const base = { voucherId: null, clienteId: clienteId ?? 0, produtoId, precos, nome: String(bateria.nome), inicio: String(bateria.inicio) };
  if (!codigo) return { ...base, brutoCentavos, descontoCentavos: 0, totalCentavos: brutoCentavos };

  const v = await avaliarVoucher({ codigo, documento, clienteId, produtoId, brutoCentavos, brutoNominalCentavos: quantidade > 1 ? precos[0] : brutoCentavos }, read, lock, readList);
  return { ...base, brutoCentavos, descontoCentavos: v.descontoCentavos, totalCentavos: brutoCentavos - v.descontoCentavos, voucherId: v.voucherId, clienteId: v.clienteId };
}

/**
 * Regras do cupom (as mesmas da reserva online e do link do grupo): ativo, parceiro/fidelidade ativos, vigência, produto,
 * limite de uso total (UsoUnico / UsoMaxTotal), lista nominal de pessoas (RestritoClientes) e limite por cliente
 * (recepção + site + link do grupo) e pedido mínimo. Devolve o desconto em centavos.
 */
export async function avaliarVoucher(
  e: { codigo: string; documento: string; clienteId?: number; produtoId: number; brutoCentavos: number; brutoNominalCentavos?: number },
  read: ReadOne,
  lock: boolean,
  readList?: ReadList,
): Promise<{ voucherId: number; descontoCentavos: number; clienteId: number }> {
  const { codigo, documento, produtoId, brutoCentavos } = e;
  const cliente = e.clienteId ?? Number((await read(
    `select id from kart.cliente where (documento_num = @doc or documento = @doc) and responsavel_id is null order by atualizado_em desc limit 1`,
    { doc: documento },
  ))?.id ?? 0);
  const voucher = await read(
    `select v.id "Id", v.codigo "Codigo", v.ativo "Ativo", v.parceiro_id "ParceiroId", v.fidelidade_conta_id "FidelidadeContaId", v.produto_id "ProdutoId", v.uso_unico "UsoUnico", v.uso_max_total "UsoMaxTotal", v.uso_max_cliente "UsoMaxCliente", v.restrito_clientes "RestritoClientes", v.pedido_minimo_centavos "PedidoMinimoCentavos", v.tipo "Tipo", v.valor "Valor", v.desconto_maximo_centavos "DescontoMaximoCentavos", p.ativo "parceiroAtivo", fc.ativo "fidelidadeAtiva",
            case when current_date between v.inicio_em and v.fim_em then 1 else 0 end "vigenciaOk"
       from kart.voucher v
       left join kart.parceiro p on p.id = v.parceiro_id left join kart.fidelidade_conta fc on fc.id = v.fidelidade_conta_id
      where upper(v.codigo) = @codigo${lock ? ' for update of v' : ''}`,
    { codigo },
  );
  if (!voucher || !voucher.Ativo) throw new HttpError(400, 'Voucher não encontrado.');
  if (voucher.ParceiroId && !voucher.parceiroAtivo) throw new HttpError(400, 'O parceiro vinculado ao voucher está inativo.');
  if (voucher.FidelidadeContaId && !voucher.fidelidadeAtiva) throw new HttpError(400, 'A conta de fidelidade vinculada ao voucher está inativa.');
  if (!voucher.vigenciaOk) throw new HttpError(400, 'Voucher expirado.');
  if (voucher.ProdutoId && Number(voucher.ProdutoId) !== produtoId) throw new HttpError(400, 'O produto do voucher não está na reserva.');

  const usos = await read(
    `select
       (select count(*) from kart.voucher_uso u where u.voucher_id = @voucher and not u.estornado)
       + (select count(*) from kart.reserva_online_voucher_uso o where o.voucher_id = @voucher and o.estado in ('reservado', 'consumido', 'reembolso_pendente'))
       + (select count(*) from kart.reserva_grupo_voucher_uso gv where gv.voucher_id = @voucher and gv.estado in ('reservado', 'consumido')) n,
       (select count(*) from kart.voucher_uso u where u.voucher_id = @voucher and u.cliente_id = @cliente and not u.estornado)
       + (select count(*) from kart.reserva_online_voucher_uso o where o.voucher_id = @voucher and o.cliente_id = @cliente and o.estado in ('reservado', 'consumido', 'reembolso_pendente'))
       + (select count(*) from kart.reserva_grupo_voucher_uso gv where gv.voucher_id = @voucher and gv.cliente_id = @cliente and gv.estado in ('reservado', 'consumido')) "doCliente"`,
    { voucher: voucher.Id, cliente },
  );
  const eleg = await avaliarElegibilidadeVoucher({
    voucherId: Number(voucher.Id),
    usoUnico: Boolean(voucher.UsoUnico),
    usoMaxTotal: voucher.UsoMaxTotal == null ? null : Number(voucher.UsoMaxTotal),
    usoMaxCliente: Number(voucher.UsoMaxCliente ?? 1),
    restritoClientes: Boolean(voucher.RestritoClientes),
    usosTotais: Number(usos?.n ?? 0),
    usosClienteDirecto: Number(usos?.doCliente ?? 0),
    clienteId: cliente > 0 ? cliente : null,
    documento,
    reader: readList ?? ((sql, params) => query(sql, params)),
  });
  if (!eleg.ok) throw new HttpError(400, eleg.motivo);
  if (voucher.PedidoMinimoCentavos && brutoCentavos < Number(voucher.PedidoMinimoCentavos)) {
    throw new HttpError(400, `Valor do pedido insuficiente. Mínimo exigido: ${brl(Number(voucher.PedidoMinimoCentavos))}.`);
  }

  // Para voucher nominal/grupo restrito (1 uso por reserva online), aplica sobre 1 vaga (a do beneficiário)
  // quando houver vários pilotos pagando juntos, evitando que 1 crédito quite vagas extras.
  const baseDesconto = Boolean(voucher.RestritoClientes) && e.brutoNominalCentavos != null
    ? Math.min(brutoCentavos, e.brutoNominalCentavos)
    : brutoCentavos;
  let descontoCentavos = voucher.Tipo === 'percentual'
    ? Math.round((baseDesconto * Number(voucher.Valor)) / 100)
    : Number(voucher.Valor);
  if (voucher.DescontoMaximoCentavos) descontoCentavos = Math.min(descontoCentavos, Number(voucher.DescontoMaximoCentavos));
  descontoCentavos = Math.min(Math.max(0, descontoCentavos), baseDesconto);
  return { voucherId: Number(voucher.Id), descontoCentavos, clienteId: cliente };
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

/** CPF de quem pilota cada vaga, na ordem das inscrições (comprador primeiro, se pilota). Pedido antigo: tudo no comprador. */
export function documentosDasVagas(p: Pick<PedidoSite, 'cliente' | 'acompanhantes' | 'compradorPilota'>, n: number): string[] {
  const eu = p.compradorPilota !== false;
  const outros = (p.acompanhantes ?? []).slice(0, n - (eu ? 1 : 0)).map((a) => String(a.documento ?? ''));
  if (outros.length !== n - (eu ? 1 : 0)) return Array.from({ length: n }, () => String(p.cliente.documento ?? ''));
  return [...(eu ? [String(p.cliente.documento ?? '')] : []), ...outros];
}

/** Pedido novo: grava o cliente e segura as vagas. Idempotente pelo id do pedido (o site pode mandar de novo). */
export async function reservarPedido(p: PedidoSite, log: Log): Promise<Resultado> {
  const c = configOnline();
  const ja = await one<Linha>(`${LINHA} where pedido_id = @id`, { id: p.id });
  if (ja) {
    if (ja.Status === 'aguardando') {
      const b = await one<{ nome: string; inicio: string }>(`select nome, to_char(inicio, 'YYYY-MM-DD"T"HH24:MI') inicio from kart.bateria where id = @id`, { id: ja.BateriaId });
      return { id: p.id, acao: 'reservado', valorCentavos: ja.ValorCentavos, expiraEm: brasilia(ja.expira), descricao: descricaoPedido(b?.nome ?? '', b?.inicio ?? 'T', ja.Quantidade), inicio: b?.inicio ?? '' };
    }
    if (ja.Status === 'pago') return { id: p.id, acao: 'confirmado', codigo: ja.Codigo };
    return { id: p.id, acao: 'expirado' };
  }
  const n = Math.trunc(Number(p.quantidade));
  if (!(n >= 1 && n <= c.maxPilotos)) return { id: p.id, acao: 'recusado', erro: `Escolha de 1 a ${c.maxPilotos} pilotos.` };
  const documentos = documentosDasVagas(p, n);
  try {
    await calcularPedidoOnline(
      { codigo: p.cupom ?? '', documento: p.cliente.documento, bateriaId: Number(p.bateriaId), quantidade: n, documentos },
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
  const individual = p.modo === 'individual';
  if (individual && (n < 2 || n > 10)) return { id: p.id, acao: 'recusado', erro: 'Para cada um pagar o seu, o grupo precisa ter de 2 a 10 pilotos.' };
  const obs = `Reserva online ${p.codigo}${individual ? ' · cada um paga o seu' : ''}` + (p.pilotos?.length ? ` · pilotos: ${p.pilotos.join(', ')}`.slice(0, 380) : '');
  try {
    const result = await tx(async (run) => {
      const read: ReadOne = async (sql, params) => (await run(sql, params))[0] ?? null;
      // cada um paga o seu: agora só 1 vaga (a de quem organiza, com primeira vez e cupom dele; ou a garantia, preço cheio);
      // as outras vagas ficam seguras pelo preço cheio e cada amigo paga a sua pelo link do grupo
      const quote = individual
        ? await calcularPedidoOnline({ codigo: p.cupom ?? '', documento: p.cliente.documento, bateriaId: Number(p.bateriaId), quantidade: 1, documentos: eu ? [p.cliente.documento] : [] }, read, true, clienteId, run)
        : await calcularPedidoOnline(
          { codigo: p.cupom ?? '', documento: p.cliente.documento, bateriaId: Number(p.bateriaId), quantidade: n, documentos },
          read,
          true,
          clienteId,
          run,
        );
      if (individual) {
        const cheio = await calcularPedidoOnline({ codigo: '', documento: p.cliente.documento, bateriaId: Number(p.bateriaId), quantidade: n, documentos: [] }, read, false);
        quote.precos = eu ? [quote.precos[0], ...cheio.precos.slice(1)] : cheio.precos;
      }
      const inscricoes = await inscreverN(Number(p.bateriaId), clienteId, n, 'site', null, obs, false, { produtoId: quote.produtoId, precos: quote.precos, clientes: pessoas, run });
      await run(
        `insert into kart.reserva_online (pedido_id, codigo, cliente_id, bateria_id, quantidade, valor_centavos, status, forma, inscricao_ids, pilotos, expira_em)
         values (@pedido, @codigo, @cliente, @bateria, @n, @valor, 'aguardando', @forma, @insc, @pilotos, ${EXPIRA_SQL})`,
        { pedido: p.id, codigo: p.codigo, cliente: clienteId, bateria: Number(p.bateriaId), n, valor: quote.totalCentavos, forma: p.forma, insc: inscricoes.join(','), pilotos: (p.pilotos ?? []).join(', ').slice(0, 600) || null, prazo: c.prazoMin, minimo: PRAZO_MINIMO_MIN, margem: MARGEM_ANTES_DA_BATERIA_MIN },
      );
      if (quote.voucherId !== null) {
        await run(
          `insert into kart.reserva_online_voucher_uso (pedido_id, voucher_id, cliente_id, desconto_centavos, validade_em, estado)
           values (@pedido, @voucher, @cliente, @desconto, (select expira_em from kart.reserva_online where pedido_id = @pedido), 'reservado')`,
          { pedido: p.id, voucher: quote.voucherId, cliente: clienteId, desconto: quote.descontoCentavos },
        );
      }
      const nova = await read(`select to_char(expira_em, 'YYYY-MM-DD"T"HH24:MI:SS') expira from kart.reserva_online where pedido_id = @p`, { p: p.id });
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
  const r = await one<Linha>(`${LINHA} where pedido_id = @id`, { id: p.id });
  if (!r) return { id: p.id, acao: 'pago_sem_vaga', erro: 'Pedido não encontrado no sistema da recepção.' };
  if (r.Status === 'pago') return { id: p.id, acao: 'confirmado', codigo: r.Codigo, ...(await grupoDoPedido(p, r, ids(r.InscricaoIds), log)) };
  // a Asaas diz se o cartão foi de débito (DEBIT_CARD); voucher 100% chega com VOUCHER
  const forma = p.pagamento?.billingType === 'VOUCHER' ? 'voucher' : p.pagamento?.billingType === 'PIX' ? 'pix' : p.pagamento?.billingType === 'DEBIT_CARD' ? 'debito' : 'credito';
  if (r.Status === 'pago_sem_vaga') return { id: p.id, acao: 'pago_sem_vaga', erro: 'O pagamento está aguardando a resolução da recepção.' };
  const voucherUso = await one<{ Estado: string; VoucherId?: number | null; DescontoCentavos?: number | null }>(`select estado "Estado", voucher_id "VoucherId", desconto_centavos "DescontoCentavos" from kart.reserva_online_voucher_uso where pedido_id = @id`, { id: p.id });
  const voucherIdUso = voucherUso?.VoucherId ? Number(voucherUso.VoucherId) : null;
  if (voucherUso?.Estado === 'liberado') {
    await tx(async (run) => {
      await run(`update kart.reserva_online set status = 'pago_sem_vaga', asaas_pagamento_id = @asaas, pago_em = now(), forma = @forma where id = @id`, {
        id: r.Id, asaas: p.pagamento?.asaasId ?? null, forma,
      });
      await run(`update kart.reserva_online_voucher_uso set estado = 'reembolso_pendente' where pedido_id = @pedido and estado = 'liberado'`, { pedido: p.id });
    });
    return { id: p.id, acao: 'pago_sem_vaga', erro: 'O pagamento chegou depois do prazo da reserva. A recepção precisa conferir o pedido e o cupom.' };
  }
  let insc = ids(r.InscricaoIds);
  const ativas = await query<{ Id: number }>(`select id "Id" from kart.inscricao where id in (${insc.join(',') || '0'}) and status <> 'cancelada'`);
  if (ativas.length < insc.length && (await reativarVagas(r.BateriaId, insc.filter((i) => !ativas.some((a) => a.Id === i))))) {
    log(`reserva online ${r.Codigo}: paga após o prazo, as mesmas ${insc.length - ativas.length} vaga(s) voltaram`);
  } else if (ativas.length < insc.length) {
    // pagou depois do prazo e não deu para devolver as mesmas linhas: segura de novo se ainda houver, para as MESMAS pessoas
    const canceladas = await query<{ ClienteId: number }>(`select cliente_id "ClienteId" from kart.inscricao where id in (${insc.join(',') || '0'}) and status = 'cancelada' order by id`);
    try {
      const novas = await inscreverN(r.BateriaId, r.ClienteId, r.Quantidade - ativas.length, 'site', null, `Reserva online ${r.Codigo} (paga após o prazo)`, false, { produtoId: produtoDaBateria((await one<{ p: number }>(`select produto_id p from kart.bateria where id = @id`, { id: r.BateriaId }))?.p), clientes: canceladas.length === r.Quantidade - ativas.length ? canceladas.map((x) => x.ClienteId) : undefined });
      insc = [...ativas.map((a) => a.Id), ...novas];
    } catch (e) {
      await tx(async (run) => {
        await run(`update kart.reserva_online set status = 'pago_sem_vaga', asaas_pagamento_id = @asaas, pago_em = now(), forma = @forma where id = @id`, { id: r.Id, asaas: p.pagamento?.asaasId ?? null, forma });
        await run(`update kart.reserva_online_voucher_uso set estado = 'reembolso_pendente' where pedido_id = @pedido and estado in ('reservado', 'liberado')`, { pedido: p.id });
      });
      log(`reserva online ${r.Codigo}: PAGO SEM VAGA (${(e as Error).message}) — devolver ou reagendar`);
      return { id: p.id, acao: 'pago_sem_vaga', erro: 'Recebemos o pagamento, mas as vagas desse horário acabaram. A recepção vai entrar em contato para trocar o horário ou devolver o valor.' };
    }
  }
  // cada vaga recebe a sua parte do valor pago, na proporção do preço dela (Happy Hour: primeira vez R$ 89,90, as outras R$ 99,90)
  if (p.modo === 'individual') return await confirmarIndividual(p, r, insc, forma, log, voucherIdUso);
  const linhasPreco = await query<{ Id: number; PrecoCentavos: number | null }>(`select id "Id", preco_centavos "PrecoCentavos" from kart.inscricao where id in (${insc.join(',') || '0'}) order by id`);
  const valores = dividirValor(r.ValorCentavos, linhasPreco.map((l) => Number(l.PrecoCentavos ?? 0)));
  const unit = Math.round(r.ValorCentavos / Math.max(1, r.Quantidade));
  await tx(async (run) => {
    await run(`update kart.inscricao set pago = true, valor_centavos = @unit, ${voucherIdUso ? 'voucher_id = coalesce(voucher_id, @vid), ' : ''}status = 'confirmada' where id in (${insc.join(',')})`, { unit, ...(voucherIdUso ? { vid: voucherIdUso } : {}) });
    if (linhasPreco.length === insc.length && new Set(linhasPreco.map((l) => l.PrecoCentavos)).size > 1) {
      for (const [k, l] of linhasPreco.entries()) await run(`update kart.inscricao set valor_centavos = @valor where id = @id`, { id: l.Id, valor: valores[k] });
    }
    await run(`update kart.reserva_online set status = 'pago', inscricao_ids = @insc, asaas_pagamento_id = @asaas, pago_em = now(), forma = @forma where id = @id`, { id: r.Id, insc: insc.join(','), asaas: p.pagamento?.asaasId ?? null, forma });
    await run(`update kart.reserva_online_voucher_uso set estado = 'consumido' where pedido_id = @pedido and estado in ('reservado', 'reembolso_pendente')`, { pedido: p.id });
  });
  log(`reserva online ${r.Codigo}: paga (${forma}), ${insc.length} vaga(s) confirmadas`);
  return { id: p.id, acao: 'confirmado', codigo: r.Codigo };
}

/** Cada um paga o seu: o pagamento cobre só a vaga de quem organiza (se pilota); as dos amigos seguem reservadas. */
async function confirmarIndividual(p: PedidoSite, r: Linha, insc: number[], forma: string, log: Log, voucherIdUso: number | null = null): Promise<Resultado> {
  const ordenadas = [...insc].sort((a, b) => a - b);
  const eu = p.compradorPilota !== false;
  await tx(async (run) => {
    if (eu && ordenadas[0]) await run(`update kart.inscricao set pago = true, valor_centavos = @v, ${voucherIdUso ? 'voucher_id = coalesce(voucher_id, @vid), ' : ''}status = 'confirmada' where id = @id`, { id: ordenadas[0], v: r.ValorCentavos, ...(voucherIdUso ? { vid: voucherIdUso } : {}) });
    await run(`update kart.reserva_online set status = 'pago', inscricao_ids = @insc, asaas_pagamento_id = @asaas, pago_em = now(), forma = @forma where id = @id`, { id: r.Id, insc: ordenadas.join(','), asaas: p.pagamento?.asaasId ?? null, forma });
    await run(`update kart.reserva_online_voucher_uso set estado = 'consumido' where pedido_id = @pedido and estado in ('reservado', 'reembolso_pendente')`, { pedido: p.id });
  });
  log(`reserva online ${r.Codigo}: paga (${forma}), cada um paga o seu: ${eu ? 'vaga de quem organiza paga' : 'garantia paga'}, ${ordenadas.length} vaga(s) no grupo`);
  return { id: p.id, acao: 'confirmado', codigo: r.Codigo, ...(await grupoDoPedido(p, r, ordenadas, log)) };
}

/** Links do grupo do pedido "cada um paga o seu" (cria o grupo na primeira vez). Falha não desfaz o pagamento: tenta de novo no próximo ciclo. */
async function grupoDoPedido(p: PedidoSite, r: Linha, insc: number[], log: Log): Promise<{ grupo?: { codigo: string; link: string; painel: string } }> {
  if (p.modo !== 'individual') return {};
  try {
    const preco = Number((await one<{ preco: number }>(`select preco_centavos preco from kart.inscricao where id in (${insc.join(',') || '0'}) and not pago order by id desc limit 1`))?.preco ?? 0)
      || Number((await one<{ preco: number }>(`select p.preco_centavos preco from kart.bateria b join kart.produto p on p.id = b.produto_id where b.id = @b`, { b: r.BateriaId }))?.preco ?? 0);
    const ativas = (await query<{ Id: number }>(`select id "Id" from kart.inscricao where id in (${insc.join(',') || '0'}) and status <> 'cancelada' order by id`)).map((x) => x.Id);
    return { grupo: await grupoDaReservaOnline({ codigoReserva: r.Codigo, bateriaId: r.BateriaId, responsavelId: r.ClienteId, inscricoes: ativas, compradorPilota: p.compradorPilota !== false, precoCentavos: preco, valorPagoCentavos: r.ValorCentavos }, log) };
  } catch (e) {
    log(`reserva online ${r.Codigo}: grupo do "cada um paga o seu" não foi criado agora (${(e as Error).message})`);
    return {};
  }
}

/** Divide o total pelas vagas na proporção dos preços (sem preço: partes iguais). A soma fecha no total, centavo a centavo. */
export function dividirValor(total: number, precos: number[]): number[] {
  if (!precos.length) return [];
  const soma = precos.reduce((a, b) => a + b, 0);
  const pesos = soma > 0 ? precos : precos.map(() => 1);
  const somaPesos = pesos.reduce((a, b) => a + b, 0);
  const partes = pesos.map((p) => Math.floor((total * p) / somaPesos));
  partes[partes.length - 1] += total - partes.reduce((a, b) => a + b, 0);
  return partes;
}

/**
 * Pix pago dentro do prazo cujo aviso só chegou depois (13/10, reserva ACEXRJ: o webhook ainda ia para o sistema antigo):
 * as vagas já tinham sido canceladas. Devolve as MESMAS inscrições (se a bateria ainda tem lugar e não passou) em vez de
 * criar outras — senão a recepção via o piloto duas vezes na bateria (as canceladas + as novas).
 */
async function reativarVagas(bateriaId: number, canceladas: number[]) {
  if (!canceladas.length) return false;
  return tx(async (run) => {
    const [b] = await run(
      // trava a linha da bateria: quem aloca vaga na mesma bateria espera (serializa a contagem de vagas)
      `select b.vagas - (select count(*) from kart.inscricao i where i.bateria_id = b.id and i.status <> 'cancelada') livres,
              case when b.status = 'cancelada' or b.inicio < now() - interval '30 minutes' then 0 else 1 end ok
         from kart.bateria b where b.id = @id for update of b`,
      { id: bateriaId },
    );
    if (!b || !b.ok || (b.livres as number) < canceladas.length) return false;
    const n = await run(`update kart.inscricao set status = 'confirmada' where id in (${canceladas.join(',')}) and status = 'cancelada' returning id`);
    return n.length === canceladas.length;
  });
}

/** Prazo vencido sem pagamento (com 2 min de folga para o aviso da Asaas chegar): cancela as vagas. */
export async function expirarVencidos(log: Log) {
  const vencidos = await query<Linha & { PedidoId: string }>(`${LINHA} where status = 'aguardando' and expira_em < now() - interval '2 minutes'`);
  const res: Resultado[] = [];
  for (const v of vencidos) {
    await tx(async (run) => {
      await run(`update kart.inscricao set status = 'cancelada' where id in (${ids(v.InscricaoIds).join(',') || '0'}) and not pago and status <> 'cancelada'`);
      await run(`update kart.reserva_online set status = 'expirado' where id = @id and status = 'aguardando'`, { id: v.Id });
      await run(`update kart.reserva_online_voucher_uso set estado = 'liberado' where pedido_id = @pedido and estado = 'reservado'`, { pedido: v.PedidoId });
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
  // cupom digitado na reserva do site (reservas.kartodromodebetim.com.br): mesma conta, sem conta do app
  const doSite = (await chamar('/api/sync/cupons-site').catch(() => [])) as (CouponInput & { requestId: string })[];
  for (const job of Array.isArray(doSite) ? doSite : []) {
    try {
      const result = await previsualizarVoucherOnline(job);
      await chamar(`/api/sync/cupons-site/${encodeURIComponent(job.requestId)}`, { method: 'POST', body: JSON.stringify(result) });
      processados++;
    } catch {
      log(`prévia de cupom do site ${String(job.requestId).slice(0, 8)}: não foi possível concluir agora`);
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
  const resp = await query<{ r: number }>(`select distinct responsavel_id r from kart.cliente where id in (${lista}) and responsavel_id is not null`);
  // quem se identificou no totem pagou pelo grupo mesmo sem correr (não está na lista de participantes)
  const donos = [...new Set([...grupo, ...resp.map((x) => x.r), ...(quemSeIdentificou ? [quemSeIdentificou] : [])])].join(',');
  const vaga = await one<{ Id: number; dono: number; nome: string }>(
    `select i.id "Id", i.cliente_id dono, c.nome from kart.inscricao i join kart.cliente c on c.id = i.cliente_id
      where i.bateria_id = @b and i.origem = 'site' and i.pago and i.status <> 'cancelada'
        and i.cliente_id in (${donos}) and i.cliente_id <> @c
        -- o comprador que também vai correr fica com uma vaga dele: só as que sobram passam para o grupo
        and (i.cliente_id not in (${lista})
             or (select count(*) from kart.inscricao j where j.bateria_id = @b and j.cliente_id = i.cliente_id and j.status <> 'cancelada') > 1)
      order by i.id desc limit 1`,
    { b: bateriaId, c: clienteId },
  );
  if (!vaga) return null;
  const r = await one<{ n: number }>(
    `update kart.inscricao set cliente_id = @c, observacao = left(coalesce(observacao || ' · ', '') || @obs, 400)
      where id = @id and cliente_id = @dono returning 1 n`,
    { c: clienteId, id: vaga.Id, dono: vaga.dono, obs: `vaga paga online por ${vaga.nome}` },
  );
  if (!r) return null;
  log(`totem: vaga paga online (inscrição ${vaga.Id}, de ${vaga.nome}) passou para o cliente ${clienteId}`);
  return vaga.Id;
}

/** Ciclo de 5 s: pedidos novos, pagos e vencidos. */
/**
 * Tarefas do app que não podem segurar os pedidos pagos: rodam em paralelo (uma de cada vez) e o aviso de falha
 * sai no máximo a cada 10 min (20/10: o banco do app às vezes leva 12–15 s e atrasava o ciclo inteiro).
 */
const emAndamento = new Set<string>();
const ultimoAviso = new Map<string, number>();
function emParalelo(nome: string, tarefa: () => Promise<unknown>, log: Log, aviso: (e: Error) => string) {
  if (emAndamento.has(nome)) return;
  emAndamento.add(nome);
  void emCurso(`app:${nome}`, tarefa())
    .catch((e: Error) => {
      if (Date.now() - (ultimoAviso.get(nome) ?? 0) < 10 * 60_000) return;
      ultimoAviso.set(nome, Date.now());
      log(aviso(e));
    })
    .finally(() => emAndamento.delete(nome));
}

let escutaVinculoLigada = false;

export async function sincronizarReservasOnline(log: Log) {
  if (!preCadastroLigado()) return 0;
  // vínculo sob demanda: long-poll permanente no Worker (liga uma vez; reconecta sozinho)
  if (!escutaVinculoLigada) { escutaVinculoLigada = true; void escutarPedidosDeVinculo(log); }
  emParalelo('cupons', () => sincronizarCuponsOnline(log), log, () => 'prévia de cupons do app: sincronização temporariamente indisponível (tenta de novo a cada 5 s)');
  // contas do app com e-mail confirmado: vincula ao cliente pelo CPF + e-mail/telefone (uma vez por minuto)
  emParalelo('vinculo', () => vincularContasDoApp(log), log, (e) => `app: vínculo automático indisponível agora (${e.message})`);
  // ranking e carreira dos pilotos no app (a cada 10 min)
  emParalelo('ranking', () => publicarRankingDoApp(log), log, (e) => `app: ranking indisponível agora (${e.message})`);
  // histórico completo de todo cliente vinculado (a cada 10 min, só o que mudou)
  emParalelo('historicos', () => publicarHistoricosVinculados(log), log, (e) => `app: histórico indisponível agora (${e.message})`);
  emParalelo('clientes-app', () => publicarClientesDoApp(log), log, (e) => `app: cadastros indisponíveis agora (${e.message})`);
  emParalelo('perfil-app', () => sincronizarPerfisDoApp(log), log, (e) => `app: perfil indisponível agora (${e.message})`);
  // a Cloudflare às vezes leva 15+ s para responder (fila vazia): 10 s gerava ~1 falha por minuto no log. Não sobrepõe (trava 'ocupado').
  const pedidos = (await chamar('/api/sync/pedidos', {}, 25_000)) as PedidoSite[];
  const resultados: Resultado[] = [];
  for (const p of pedidos) {
    try {
      // 'confirmado' só volta da fila no "cada um paga o seu" sem grupo: confirmarPagamento recria o grupo e devolve os links
      resultados.push(p.status === 'pago' || p.status === 'confirmado' ? await confirmarPagamento(p, log) : await reservarPedido(p, log));
    } catch (e) {
      log(`reserva online ${p.codigo}: erro ${(e as Error).message}`);
    }
  }
  resultados.push(...(await expirarVencidos(log)));
  if (resultados.length) await chamar('/api/sync/pedido', { method: 'POST', body: JSON.stringify(resultados) });
  return resultados.length;
}

/**
 * Preço da vaga de quem entra pelo link do grupo (12/11/2026, decisão 5 do dono: primeira vez vale por piloto também no
 * "cada um paga o seu"): estreante paga o preço de primeira vez do produto da bateria, quando houver e for menor.
 * Chamado pelo site na hora de gerar a cobrança (POST /api/totem/grupo-preco). Devolve só o valor.
 */
export async function precoDaVagaPeloLink(token: string, cpf: string, cupom = ''): Promise<{ precoCentavos: number; primeiraVez: boolean; cupom?: { codigo: string; descontoCentavos: number } | null; erroCupom?: string } | null> {
  if (!/^[A-Za-z0-9]{10,24}$/.test(token) || !isValidCpf(onlyDigits(cpf))) return null;
  const c = configOnline();
  const g = await one<{ preco: number; produtoId: number | null; aniversario: boolean | number; precoAniv: number | null; respDoc: string | null; respDocNum: string | null; ativos: number }>(
    `select g.preco_centavos preco, b.produto_id "produtoId", g.aniversario, g.preco_aniversariante_centavos "precoAniv",
            r.documento "respDoc", r.documento_num "respDocNum",
            (select count(*) from kart.reserva_grupo_piloto vp left join kart.inscricao ip on ip.id = vp.inscricao_id
              where vp.grupo_id = g.id and (ip.id is null or ip.status <> 'cancelada')) ativos
       from kart.reserva_grupo_piloto t
       join kart.reserva_grupo g on g.id = t.grupo_id and g.status = 'ativa'
       join kart.bateria b on b.id = g.bateria_id
       join kart.cliente r on r.id = g.responsavel_id
      where t.token = @token`, { token },
  );
  if (!g) return null;
  const cheio = Number(g.preco) || 0;
  const cpfNum = onlyDigits(cpf);
  const respNum = onlyDigits(g.respDoc ?? g.respDocNum ?? '');
  const ehRespAniv = Boolean(g.aniversario) && !!cpfNum && cpfNum === respNum && Math.max(0, (Number(g.ativos) || 0) - 1) >= 10;
  const valorAniv = ehRespAniv && Number(g.precoAniv) > 0 && Number(g.precoAniv) < cheio ? Number(g.precoAniv) : cheio;
  const produto = produtoDaBateria(Number(g.produtoId), c);
  const pv = c.primeiraVez[produto];
  const novo = pv && pv < valorAniv ? (await primeiraVez([cpf], (sql, params) => one(sql, params)))[0] : false;
  const base = novo ? Math.min(pv, valorAniv) : valorAniv;
  const codigo = String(cupom ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{1,40}$/.test(codigo)) return { precoCentavos: base, primeiraVez: Boolean(novo) };
  // cupom do amigo (12/11/2026): mesmas regras da reserva online, sobre o preço da vaga dele
  try {
    const v = await avaliarVoucher({ codigo, documento: onlyDigits(cpf), produtoId: produto, brutoCentavos: base }, (sql, params) => one(sql, params), false);
    return { precoCentavos: base - v.descontoCentavos, primeiraVez: Boolean(novo), cupom: { codigo, descontoCentavos: v.descontoCentavos } };
  } catch (e) {
    if (e instanceof HttpError) return { precoCentavos: base, primeiraVez: Boolean(novo), cupom: null, erroCupom: e.message };
    throw e;
  }
}

/**
 * Cupom usado na cobrança do link do grupo: reserva o uso (conta no limite do voucher) e confere o valor cobrado.
 * Devolve o preço que a vaga passa a valer, ou null se o cupom não vale mais (a vaga fica com o preço normal).
 */
export async function reservarCupomDoLink(o: { asaasId: string; grupoId: number; pilotoId: number; clienteId: number; documento: string; codigo: string; valorCobrado: number; consumido?: boolean }, log: Log): Promise<number | null> {
  const ja = await one<{ Id: number }>(`select id "Id" from kart.reserva_grupo_voucher_uso where asaas_id = @a`, { a: o.asaasId });
  if (ja) return o.valorCobrado;
  const g = await one<{ preco: number; produtoId: number | null; aniversario?: boolean | number; precoAniv?: number | null }>(`select g.preco_centavos preco, b.produto_id "produtoId", g.aniversario, g.preco_aniversariante_centavos "precoAniv" from kart.reserva_grupo g join kart.bateria b on b.id = g.bateria_id where g.id = @id`, { id: o.grupoId });
  if (!g) return null;
  const c = configOnline();
  const produto = produtoDaBateria(Number(g.produtoId), c);
  const bases = [...new Set([Number(g.preco) || 0, c.primeiraVez[produto], g.aniversario ? Number(g.precoAniv || 0) : 0].filter((x): x is number => Number(x) > 0))];
  try {
    return await tx(async (run) => {
      const read: ReadOne = async (sql, params) => (await run(sql, params))[0] ?? null;
      for (const base of bases) {
        const v = await avaliarVoucher({ codigo: o.codigo, documento: o.documento, clienteId: o.clienteId, produtoId: produto, brutoCentavos: base }, read, true, run);
        if (base - v.descontoCentavos !== o.valorCobrado) continue;
        await run(`insert into kart.reserva_grupo_voucher_uso (asaas_id, grupo_id, piloto_id, voucher_id, cliente_id, desconto_centavos, estado) values (@a, @g, @p, @v, @c, @d, @estado)`,
          { a: o.asaasId, g: o.grupoId, p: o.pilotoId, v: v.voucherId, c: o.clienteId, d: v.descontoCentavos, estado: o.consumido ? 'consumido' : 'reservado' });
        log(`grupo ${o.grupoId}: cupom ${o.codigo} ${o.consumido ? 'consumido' : 'reservado'} na cobrança ${o.asaasId} (desconto ${brl(v.descontoCentavos)})`);
        return o.valorCobrado;
      }
      log(`grupo ${o.grupoId}: cupom ${o.codigo} da cobrança ${o.asaasId} não confere com o valor cobrado (${brl(o.valorCobrado)})`);
      return null;
    });
  } catch (e) {
    log(`grupo ${o.grupoId}: cupom ${o.codigo} da cobrança ${o.asaasId} recusado (${(e as Error).message})`);
    return null;
  }
}

/** Cupom de cobrança paga vira consumido; de cobrança vencida/cancelada volta a valer (liberado). Roda a cada ciclo. */
export async function acertarCuponsDosGrupos() {
  await query(`update kart.reserva_grupo_voucher_uso u set estado = 'consumido'
    where u.estado = 'reservado' and exists (select 1 from kart.reserva_grupo_pagamento pg where pg.asaas_id = u.asaas_id and not pg.cancelado)`);
  await query(`update kart.reserva_grupo_voucher_uso u set estado = 'liberado'
    where u.estado = 'reservado' and exists (select 1 from kart.reserva_grupo_cobranca c where c.asaas_id = u.asaas_id and c.status in ('vencida', 'cancelada'))`);
}

/** Valor de primeira vez configurado para o produto da bateria do grupo (para conferir o que o site cobrou). */
export async function precoPrimeiraVezDoGrupo(grupoId: number): Promise<number | null> {
  const b = await one<{ produtoId: number | null }>(`select b.produto_id "produtoId" from kart.reserva_grupo g join kart.bateria b on b.id = g.bateria_id where g.id = @id`, { id: grupoId });
  const c = configOnline();
  return b ? c.primeiraVez[produtoDaBateria(Number(b.produtoId), c)] ?? null : null;
}
