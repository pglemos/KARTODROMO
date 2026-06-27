import sql from 'mssql';
import type { LapTimeSqlOptions } from '@/lib/livetime/laptime-sql';

export type LapTimeBooking = {
  id: string;
  nome: string;
  dataHora: string;
  vagasTotal: number;
  vagasLivres: number;
  reservados: number;
  pagos: number;
  aprovados: number;
  pendentes: number;
  online: boolean;
  encerrada: boolean;
};

export type LapTimeBookingsFilters = {
  q?: string;
  status?: 'aberta' | 'encerrada' | '';
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export type LapTimeBookingCustomer = {
  id: string;
  clienteId: string | null;
  clienteNome: string;
  clienteTelefone: string | null;
  clienteEmail: string | null;
  dataReserva: string | null;
  preco: number;
  pago: number;
  pagou: boolean;
  aprovado: boolean;
  cancelado: boolean;
};

type BookingRow = {
  Id_Booking: number;
  Name: string | null;
  ExpectedDateTime: Date;
  MaxVacancies: number;
  Vacancies: number;
  IsOnline: boolean;
  IsClosed: boolean;
  Reservados: number;
  Pagos: number;
  Aprovados: number;
  Pendentes: number;
};

type BookingCustomerRow = {
  Id_BookingCustomer: number;
  Id_Customer: number | null;
  CustomerName: string | null;
  CustomerPhone: string | null;
  CustomerEmail: string | null;
  DateBooking: Date | null;
  Price: number;
  PaidPrice: number;
  PaidOut: boolean;
  IsApproved: boolean;
  IsCanceled: boolean;
};

function toBooking(row: BookingRow): LapTimeBooking {
  return {
    id: String(row.Id_Booking),
    nome: row.Name?.trim() || 'Bateria',
    dataHora: row.ExpectedDateTime.toISOString(),
    vagasTotal: row.MaxVacancies,
    vagasLivres: row.Vacancies,
    reservados: row.Reservados,
    pagos: row.Pagos,
    aprovados: row.Aprovados,
    pendentes: row.Pendentes,
    online: row.IsOnline,
    encerrada: row.IsClosed,
  };
}

function toBookingCustomer(row: BookingCustomerRow): LapTimeBookingCustomer {
  return {
    id: String(row.Id_BookingCustomer),
    clienteId: row.Id_Customer !== null ? String(row.Id_Customer) : null,
    clienteNome: row.CustomerName?.trim() || 'Sem nome',
    clienteTelefone: row.CustomerPhone?.trim() || null,
    clienteEmail: row.CustomerEmail?.trim() || null,
    dataReserva: row.DateBooking ? row.DateBooking.toISOString() : null,
    preco: Number(row.Price ?? 0),
    pago: Number(row.PaidPrice ?? 0),
    pagou: row.PaidOut,
    aprovado: row.IsApproved,
    cancelado: row.IsCanceled,
  };
}

function sqlConfig(options: LapTimeSqlOptions): sql.config {
  return {
    server: options.server,
    database: options.database,
    user: options.user,
    password: options.password,
    port: options.port,
    connectionTimeout: options.timeoutMs || 5000,
    requestTimeout: options.timeoutMs || 5000,
    pool: { max: 1, min: 0, idleTimeoutMillis: 30000 },
    options: { encrypt: false, trustServerCertificate: true, instanceName: options.instanceName },
  };
}

export async function fetchLapTimeBookingsPage(
  options: LapTimeSqlOptions,
  filters: LapTimeBookingsFilters,
): Promise<{ rows: LapTimeBooking[]; total: number }> {
  const limit = Math.max(1, Math.min(2000, filters.limit ?? 200));
  const offset = Math.max(0, filters.offset ?? 0);
  const q = filters.q?.trim();

  const pool = new sql.ConnectionPool(sqlConfig(options));
  try {
    await pool.connect();

    const conditions: string[] = [];
    if (q) conditions.push('b.Name like @q');
    if (filters.status === 'aberta') conditions.push('b.IsClosed = 0');
    if (filters.status === 'encerrada') conditions.push('b.IsClosed = 1');
    if (filters.from) conditions.push('b.ExpectedDateTime >= @from');
    if (filters.to) conditions.push('b.ExpectedDateTime <= @to');
    const whereSql = conditions.length ? `where ${conditions.join(' and ')}` : '';

    const bind = (request: sql.Request) => {
      if (q) request.input('q', sql.NVarChar, `%${q}%`);
      if (filters.from) request.input('from', sql.DateTime, new Date(filters.from));
      if (filters.to) request.input('to', sql.DateTime, new Date(filters.to));
      return request;
    };

    const totalResult = await bind(pool.request()).query<{ c: number }>(
      `select count(*) as c from dbo.Booking b ${whereSql}`,
    );
    const total = totalResult.recordset[0]?.c ?? 0;

    const rowsResult = await bind(pool.request())
      .input('limit', sql.Int, limit)
      .input('offset', sql.Int, offset)
      .query<BookingRow>(`
        select
          b.Id_Booking, b.Name, b.ExpectedDateTime, b.MaxVacancies, b.Vacancies, b.IsOnline, b.IsClosed,
          (select count(*) from dbo.BookingCustomer bc where bc.Id_Booking = b.Id_Booking and bc.IsCanceled = 0) as Reservados,
          (select count(*) from dbo.BookingCustomer bc where bc.Id_Booking = b.Id_Booking and bc.IsCanceled = 0 and bc.PaidOut = 1) as Pagos,
          (select count(*) from dbo.BookingCustomer bc where bc.Id_Booking = b.Id_Booking and bc.IsCanceled = 0 and bc.IsApproved = 1) as Aprovados,
          (select count(*) from dbo.BookingCustomer bc where bc.Id_Booking = b.Id_Booking and bc.IsCanceled = 0 and bc.IsApproved = 0) as Pendentes
        from dbo.Booking b
        ${whereSql}
        order by b.ExpectedDateTime asc
        offset @offset rows fetch next @limit rows only
      `);

    return { rows: rowsResult.recordset.map(toBooking), total };
  } finally {
    await pool.close().catch(() => undefined);
  }
}

export async function fetchLapTimeBookingCustomers(
  options: LapTimeSqlOptions,
  bookingId: string,
): Promise<LapTimeBookingCustomer[]> {
  const pool = new sql.ConnectionPool(sqlConfig(options));
  try {
    await pool.connect();
    const result = await pool
      .request()
      .input('bookingId', sql.BigInt, Number(bookingId))
      .query<BookingCustomerRow>(`
        select
          bc.Id_BookingCustomer, bc.Id_Customer, c.Name as CustomerName, c.Phone as CustomerPhone, c.Email as CustomerEmail,
          bc.DateBooking, bc.Price, bc.PaidPrice, bc.PaidOut, bc.IsApproved, bc.IsCanceled
        from dbo.BookingCustomer bc
        left join dbo.Customer c on c.Id_Customer = bc.Id_Customer
        where bc.Id_Booking = @bookingId
        order by bc.DateBooking
      `);

    return result.recordset.map(toBookingCustomer);
  } finally {
    await pool.close().catch(() => undefined);
  }
}
