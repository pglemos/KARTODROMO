import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ one: vi.fn(), query: vi.fn(), tx: vi.fn() }));
vi.mock('../../lib/ops/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/ops/db')>()),
  one: db.one,
  query: db.query,
  tx: db.tx,
}));
vi.mock('../../lib/ops/pre-cadastro', () => ({
  gravarPreCadastro: vi.fn(async () => 42),
  preCadastroLigado: () => true,
}));

import * as online from '../../lib/ops/reserva-online';
import { officeRoutes } from '../../lib/ops/office';

type SqlRow = Record<string, unknown>;
type CouponInput = { codigo: string; documento: string; bateriaId: number; quantidade: number };
type CouponPreview = (input: CouponInput) => Promise<unknown>;

const preview = (input: CouponInput) => {
  const fn = (online as unknown as { previsualizarVoucherOnline?: CouponPreview }).previsualizarVoucherOnline;
  return fn?.(input);
};

let voucher: SqlRow;
let usageCount: number;
let customerUsageCount: number;
let usageState: string;
let reservation: SqlRow | null;
let activeEntries: SqlRow[];
let expiredReservations: SqlRow[];
let battery: SqlRow;
let transactionSequence: number;
let transactionTail: Promise<void>;
let statements: { transaction: number; sql: string; params: Record<string, unknown> }[];

const activeVoucher = () => ({
  Id: 7, Codigo: 'BETIM10', Ativo: 1, ProdutoId: null, Tipo: 'percentual', Valor: 20,
  InicioEm: '2026-01-01', FimEm: '2026-12-31', UsoMaxCliente: 1, UsoUnico: 1,
  PedidoMinimoCentavos: null, DescontoMaximoCentavos: 5000, vigenciaOk: 1,
  parceiroAtivo: 1, fidelidadeAtiva: 1,
});

const createTestCpf = () => {
  const digits = Array.from(crypto.getRandomValues(new Uint8Array(9)), (value) => value % 10);
  if (digits.every((digit) => digit === digits[0])) digits[0] = (digits[0] + 1) % 10;
  const checkDigit = (length: number) => {
    const sum = digits.slice(0, length).reduce((total, digit, index) => total + digit * (length + 1 - index), 0);
    const digit = (sum * 10) % 11;
    return digit === 10 ? 0 : digit;
  };
  digits.push(checkDigit(9));
  digits.push(checkDigit(10));
  return digits.join('');
};
const testDocument = createTestCpf();

beforeEach(() => {
  vi.stubEnv('OPS_ONLINE_PRODUTO', '4');
  vi.stubEnv('OPS_ONLINE_PRODUTOS_BATERIA', '11,4');
  vi.stubEnv('OPS_ONLINE_ANTECEDENCIA_MIN', '120');
  vi.stubEnv('OPS_ONLINE_MAX', '10');
  vi.stubEnv('OPS_ONLINE_PRAZO_MIN', '15');
  voucher = activeVoucher();
  usageCount = 0;
  customerUsageCount = 0;
  usageState = 'reservado';
  reservation = null;
  activeEntries = [{ Id: 71 }];
  expiredReservations = [];
  battery = { Id: 101, Nome: 'BATERIA 09:15', nome: 'BATERIA 09:15', Status: 'aberta', ReservaFechada: 0, AutoAtendimento: 1, Vagas: 10, Inicio: '2026-10-20T09:15:00', inicio: '2026-10-20T09:15', ProdutoId: 11, preco: 14500, ocupadas: 0, passada: 0, livres: 10, ok: 1 };
  transactionSequence = 0;
  transactionTail = Promise.resolve();
  statements = [];

  db.one.mockImplementation(async (sql: string, params: Record<string, unknown> = {}) => {
    if (sql.includes('SELECT CONVERT(varchar(19), ExpiraEm')) return { expira: '2026-10-13T12:15:00' };
    if (sql.includes('FROM dbo.Bateria') && sql.includes('inicio')) return { ...battery, inicio: '2026-10-20T09:15', ok: 1 };
    if (sql.includes('FROM dbo.ReservaOnline') && sql.includes('PedidoId')) return reservation?.PedidoId === params.id ? reservation : null;
    if (sql.includes('FROM dbo.Bateria')) return battery;
    if (sql.includes('FROM dbo.Produto')) return { Id: 4, preco: 14500 };
    if (sql.includes('COUNT(')) return { n: usageCount, doCliente: customerUsageCount, totalUsos: usageCount, usosCliente: customerUsageCount };
    if (sql.includes('FROM dbo.Voucher v')) return voucher;
    if (sql.includes('FROM dbo.Cliente')) return { id: 42, Bloqueado: 0 };
    if (sql.includes('OUTPUT inserted.Codigo')) return reservation ? { Codigo: reservation.Codigo } : null;
    return null;
  });
  db.query.mockImplementation(async (sql: string) => {
    if (sql.includes('ExpiraEm <')) return expiredReservations;
    if (sql.includes('FROM dbo.Inscricao')) return activeEntries;
    return [];
  });
  db.tx.mockImplementation(async (callback: (run: (sql: string, params?: Record<string, unknown>) => Promise<SqlRow[]>) => Promise<unknown>) => {
    const previous = transactionTail;
    let release!: () => void;
    transactionTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    const transaction = ++transactionSequence;
    const run = async (sql: string, params: Record<string, unknown> = {}) => {
      statements.push({ transaction, sql, params });
      if (sql.includes('FROM dbo.Bateria')) return [battery];
      if (sql.includes('FROM dbo.Produto')) return [{ Id: 4, preco: 14500 }];
      if (sql.includes('FROM dbo.Cliente')) return [{ Bloqueado: 0 }];
      if (sql.includes('COUNT(') && sql.includes('VoucherUso')) return [{ n: usageCount, doCliente: customerUsageCount }];
      if (sql.includes('FROM dbo.Voucher v')) return [{ ...voucher, parceiroAtivo: 1, fidelidadeAtiva: 1, vigenciaOk: 1 }];
      if (sql.includes('INSERT INTO dbo.Inscricao')) return [{ id: 70 + transaction }];
      if (sql.includes('INSERT INTO dbo.ReservaOnlineVoucherUso')) {
        usageCount++;
        customerUsageCount++;
        usageState = 'reservado';
        return [];
      }
      if (sql.includes('INSERT INTO dbo.ReservaOnline ')) {
        reservation = { Id: transaction, PedidoId: params.pedido, Codigo: params.codigo, Status: 'aguardando', ValorCentavos: params.valor, InscricaoIds: String(params.insc ?? '71'), BateriaId: 101, ClienteId: 42, Quantidade: Number(params.n ?? 1), expira: '2026-10-13T12:15:00' };
        return [];
      }
      if (sql.includes('SELECT CONVERT(varchar(19), ExpiraEm')) return [{ expira: '2026-10-13T12:15:00' }];
      if (sql.includes('UPDATE dbo.ReservaOnlineVoucherUso')) {
        const next = String(params.estado ?? /Estado\s*=\s*'([^']+)'/i.exec(sql)?.[1] ?? '');
        if (next) usageState = next;
        return [];
      }
      if (sql.includes("UPDATE dbo.ReservaOnline SET Status = 'pago_sem_vaga'")) {
        if (reservation) reservation.Status = 'pago_sem_vaga';
        return [];
      }
      if (sql.includes("UPDATE dbo.ReservaOnline SET Status = 'pago'")) {
        if (reservation) reservation.Status = 'pago';
        return [];
      }
      if (sql.includes("UPDATE dbo.ReservaOnline SET Status = 'expirado'")) {
        if (reservation) reservation.Status = 'expirado';
        return [];
      }
      if (sql.includes("UPDATE dbo.ReservaOnline SET Status = 'resolvido'")) {
        if (reservation) reservation.Status = 'resolvido';
        return reservation ? [{ Codigo: reservation.Codigo }] : [];
      }
      if (sql.includes('FROM dbo.ReservaOnline') && sql.includes('PedidoId')) return reservation ? [reservation] : [];
      return [];
    };
    try { return await callback(run); } finally { release(); }
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const couponInput: CouponInput = { codigo: 'betim10', documento: testDocument, bateriaId: 101, quantidade: 2 };
const pedido = (id: string) => ({
  id, codigo: 'K7M2QX', status: 'novo' as const, criadoEm: '2026-10-13T12:00:00.000Z', bateriaId: 101,
  quantidade: 2, forma: 'pix' as const, pilotos: ['Piloto Um', 'Piloto Dois'], cupom: 'BETIM10',
  cliente: {
    tipoDocumento: 'CPF', documento: testDocument, nome: 'Maria de Teste', email: 'maria@example.com', telefone: '31 99999-0000',
    nascimento: '1990-01-01', peso: '', cep: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', menores: [], chave: 'TESTE-HMAC',
  },
});

describe('prévia autoritativa de voucher online', () => {
  it('aplica o teto de desconto ao total calculado pelo servidor', async () => {
    expect(await preview(couponInput)).toEqual({ brutoCentavos: 29000, descontoCentavos: 5000, totalCentavos: 24000 });
  });

  it.each([
    ['voucher vencido', () => { voucher = { ...voucher, vigenciaOk: 0 }; }, { erro: 'Voucher expirado.' }],
    ['produto inelegível', () => { voucher = { ...voucher, ProdutoId: 99 }; }, { erro: 'O produto do voucher não está na reserva.' }],
    ['limite do cliente', () => { voucher = { ...voucher, UsoUnico: 0 }; customerUsageCount = 1; }, { erro: 'Limite de usos deste voucher para este cliente já atingido.' }],
    ['pedido mínimo', () => { voucher = { ...voucher, PedidoMinimoCentavos: 30000 }; }, { erro: expect.stringContaining('Valor do pedido insuficiente.') }],
  ])('recusa %s com o motivo operacional correspondente', async (_name, arrange, expected) => {
    arrange();
    expect(await preview(couponInput)).toMatchObject(expected);
  });
});

describe('consumo atômico e estados do voucher', () => {
  it('busca prévias pelo sync autenticado e devolve apenas o cálculo', async () => {
    vi.stubEnv('PRECADASTRO_URL', 'https://cadastro.example');
    vi.stubEnv('PRECADASTRO_KEY', 'sync-test-key');
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith('/api/sync/mobile/coupons') && init?.method !== 'POST') {
        return new Response(JSON.stringify([{ requestId: '123e4567-e89b-42d3-a456-426614174000', codigo: 'BETIM10', documento: testDocument, bateriaId: 101, quantidade: 2 }]), { status: 200 });
      }
      return new Response('{"ok":true}', { status: 200 });
    }));

    expect(await online.sincronizarCuponsOnline(() => undefined)).toBe(1);
    expect(calls).toHaveLength(2);
    expect(new Headers(calls[0].init?.headers).get('x-sync-key')).toBe('sync-test-key');
    expect(calls[1].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({ brutoCentavos: 29000, descontoCentavos: 5000, totalCentavos: 24000 });
  });

  it('permite apenas um resgate simultâneo e grava o total descontado na mesma transação das vagas', async () => {
    const [first, second] = await Promise.all([
      online.reservarPedido(pedido('pedido-um'), () => undefined),
      online.reservarPedido(pedido('pedido-dois'), () => undefined),
    ]);
    expect([first, second].filter((result) => result.acao === 'reservado')).toHaveLength(1);
    expect([first, second].filter((result) => result.acao === 'recusado')).toHaveLength(1);
    const lock = statements.find(({ sql }) => sql.includes('FROM dbo.Voucher'));
    expect(lock?.sql).toMatch(/UPDLOCK\s*,\s*HOLDLOCK/i);
    const insertion = statements.find(({ sql }) => sql.includes('INSERT INTO dbo.ReservaOnline '));
    expect(insertion?.params.valor).toBe(24000);
    const seatInsert = statements.find(({ sql }) => sql.includes('INSERT INTO dbo.Inscricao'));
    const voucherInsert = statements.find(({ sql }) => sql.includes('INSERT INTO dbo.ReservaOnlineVoucherUso'));
    expect(seatInsert?.transaction).toBe(insertion?.transaction);
    expect(voucherInsert?.transaction).toBe(insertion?.transaction);
    expect(usageCount).toBe(1);
  });

  it.each([
    ['reembolso_confirmado', 'liberado'],
    ['remarcado', 'consumido'],
  ])('consome no pagamento e, ao resolver como %s, deixa o uso em %s', async (resolucao, estadoEsperado) => {
    reservation = { Id: 5, PedidoId: 'pedido-pago', Codigo: 'K7M2QX', Status: 'aguardando', InscricaoIds: '71', ValorCentavos: 24000, expira: '2026-10-13T12:15:00', BateriaId: 101, ClienteId: 42, Quantidade: 2 };
    await online.confirmarPagamento({ ...pedido('pedido-pago'), status: 'pago', pagamento: { asaasId: 'pay-test', billingType: 'PIX', pagoEm: '', valorCentavos: 24000 } } as never, () => undefined);
    expect(usageState).toBe('consumido');

    reservation = { ...reservation, Status: 'pago_sem_vaga' };
    usageState = 'reembolso_pendente';
    const responses: { status: number; body: unknown }[] = [];
    await officeRoutes({
      method: 'POST', url: new URL('https://ops.local/api/office/reservas-online/5/resolver'),
      body: async () => ({ resolucao }), sessao: {} as never,
    }, (status, body) => responses.push({ status, body }));
    expect(responses[responses.length - 1]?.status).toBe(200);
    expect(usageState).toBe(estadoEsperado);
  });

  it('não resolve nem libera o voucher sem declarar o desfecho operacional', async () => {
    reservation = { Id: 9, PedidoId: 'pedido-pendente', Codigo: 'K7M2QX', Status: 'pago_sem_vaga' };
    usageState = 'reembolso_pendente';
    await expect(officeRoutes({
      method: 'POST', url: new URL('https://ops.local/api/office/reservas-online/9/resolver'),
      body: async () => ({}), sessao: {} as never,
    }, () => undefined)).rejects.toMatchObject({ status: 400 });
    expect(usageState).toBe('reembolso_pendente');
  });

  it('mantém o uso pendente quando o pagamento chega sem vaga', async () => {
    reservation = { Id: 6, PedidoId: 'pedido-sem-vaga', Codigo: 'K7M2QX', Status: 'aguardando', InscricaoIds: '71', ValorCentavos: 24000, expira: '2026-10-13T12:15:00', BateriaId: 101, ClienteId: 42, Quantidade: 2 };
    activeEntries = [];
    battery = { ...battery, Vagas: 0, livres: 0 };
    const result = await online.confirmarPagamento({ ...pedido('pedido-sem-vaga'), status: 'pago', pagamento: { asaasId: 'pay-test', billingType: 'PIX', pagoEm: '', valorCentavos: 24000 } } as never, () => undefined);
    expect(result.acao).toBe('pago_sem_vaga');
    expect(usageState).toBe('reembolso_pendente');
  });

  it('libera o uso reservado quando a reserva vence sem pagamento', async () => {
    reservation = { Id: 8, PedidoId: 'pedido-expirado', Codigo: 'K7M2QX', Status: 'aguardando', InscricaoIds: '71', ValorCentavos: 24000, expira: '2026-10-13T12:15:00', BateriaId: 101, ClienteId: 42, Quantidade: 2 };
    expiredReservations = [{ ...reservation }];
    await online.expirarVencidos(() => undefined);
    expect(usageState).toBe('liberado');
  });
});
