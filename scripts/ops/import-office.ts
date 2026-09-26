/**
 * Aplica a migration 0002 (replica do LapTime Office) e importa do espelho LapTimeMirror:
 * empresa, parametros, tracados, feriados, produtos (+ programa de provas), padroes de reserva,
 * terminais, turnos, formas de pagamento, historico de baterias/reservas, vendas (itens e
 * pagamentos), movimentos de caixa, suprimentos/sangrias e oficina. Cria os usuarios iniciais.
 *
 *   npx tsx scripts/ops/import-office.ts
 *
 * Idempotente: cada etapa so roda se a tabela de destino estiver vazia (ou por LegadoId).
 * Usa o login sysadmin da instancia (CALXPRO_SQL_*) por causa das consultas entre bancos.
 */
import sql from 'mssql';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hashSenha, senhaAleatoria } from '../../lib/ops/auth';

function loadLocalEnv() {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] ||= value;
  }
}
loadLocalEnv();

const L = 'LapTimeMirror.dbo';

async function main() {
  const db = await new sql.ConnectionPool({
    server: process.env.OPS_SQL_SERVER || '192.168.20.13',
    database: 'KartodromoOps',
    user: process.env.CALXPRO_SQL_USER || 'CALXPRO',
    password: process.env.CALXPRO_SQL_PASSWORD || '',
    options: { instanceName: process.env.OPS_SQL_INSTANCE || 'SQLEXPRESS', encrypt: false, trustServerCertificate: true },
    requestTimeout: 1_200_000,
  }).connect();
  const run = async (label: string, text: string) => {
    const t = Date.now();
    const r = await db.request().query(text);
    const n = r.rowsAffected.reduce((a, b) => a + b, 0);
    console.log(`${label}: ${n} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
    return r;
  };
  const empty = async (table: string) => (await db.request().query(`SELECT COUNT(*) n FROM dbo.${table}`)).recordset[0].n === 0;

  await db.request().query("IF OBJECT_ID('dbo.Empresa') IS NOT NULL AND COL_LENGTH('dbo.Empresa','PoliticaReembolso') < 0 SELECT 1 ELSE IF OBJECT_ID('dbo.Empresa') IS NOT NULL ALTER TABLE dbo.Empresa ALTER COLUMN PoliticaReembolso NVARCHAR(MAX) NULL");
  const migration = readFileSync(join(process.cwd(), 'migrations', 'ops', '0002_office.sql'), 'utf8');
  for (const batch of migration.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)) await db.request().batch(batch);
  console.log('migration 0002 ok');

  if (await empty('Empresa'))
    await run('empresa', `INSERT INTO dbo.Empresa (Id, Nome, RazaoSocial, Cnpj, Cep, Endereco, Numero, Complemento, Bairro, Cidade, Estado, Telefone, Email, PoliticaReembolso)
      SELECT TOP 1 1, LEFT(SocialName,200), LEFT(Name,200), LEFT(Cnpj,20), LEFT(Zipcode,12), LEFT(Address,200), LEFT(Number,20), LEFT(Complement,100), LEFT(Neighborhood,100), LEFT(City,100), LEFT(State,4), LEFT(Phone,40), LEFT(Email,200), RefundPolicy FROM ${L}.Company`);

  if (await empty('Parametro'))
    await run('parametros', `INSERT INTO dbo.Parametro (Chave, Valor, Descricao) VALUES
      ('office.perguntarImprimirTermo','true','Perguntar se Deseja Imprimir o Termo de Responsabilidade'),
      ('office.gerarTermoAposPagamento','false','Gerar Termo Após o Pagamento'),
      ('office.imprimirTicketAposVenda','false','Imprimir Ticket após Venda'),
      ('office.exibirEmailLista','true','Exibir E-mail na Lista de Participantes'),
      ('office.exibirPesoLista','true','Exibir Peso na Lista de Participantes'),
      ('office.exibirColunaResponsavel','false','Exibir Coluna Responsável no Grid de Reservas'),
      ('office.validarTotalPago','true','Validar Total Pago'),
      ('office.bloquearProdutosRepetidos','false','Bloquear Produtos Repetidos'),
      ('totem.mensagemBoasVindas','Seja bem-vindo(a) ao KARTODROMO INTERNACIONAL DE BETIM!','Mensagem de Boas-vindas'),
      ('totem.imprimirTermo','true','Imprimir Termo de Responsabilidade'),
      ('totem.consultarCep','true','Consultar CEP On-line'),
      ('totem.tecladoVirtual','false','Exibir Teclado Virtual'),
      ('totem.permitirMenorSemResponsavel','true','Permitir Cadastrar Menor sem Responsável Legal')`);

  if (await empty('Tracado'))
    await run('tracados', `INSERT INTO dbo.Tracado (Nome, Comprimento, Ativo, LegadoId) SELECT Name, Length, Active, Id_RacingTrack FROM ${L}.RacingTrack`);

  if (await empty('Feriado'))
    await run('feriados', `INSERT INTO dbo.Feriado (Data, Descricao, Recorrente) SELECT CAST([Date] AS date), Description, IsRecurring FROM ${L}.Holiday`);

  if (await empty('Produto')) {
    await run('produtos', `INSERT INTO dbo.Produto (Codigo, Nome, PrecoCentavos, Categoria, ClasseContabil, ServicoLocacao, PublicarNuvem, RequerDevolucao, Ativo, LegadoId)
      SELECT p.Code, LTRIM(RTRIM(p.Name)), CAST(ROUND(p.Price * 100, 0) AS INT), ISNULL(c.Name, 'Indoor'), ISNULL(ac.Name, 'Locações'),
             p.IsRental, p.IsOnline, p.IsReturnable, p.Active, p.Id_Product
      FROM ${L}.Product p LEFT JOIN ${L}.Category c ON c.Id_Category = p.Id_Category
      LEFT JOIN ${L}.AccountingClass ac ON ac.Id_AccountingClass = p.Id_AccountingClass`);
    await run('programa de provas', `INSERT INTO dbo.ProdutoProva (ProdutoId, Ordem, Nome, Tipo, Finalizacao, TempoMin, VoltasMax)
      SELECT pr.Id, ROW_NUMBER() OVER (PARTITION BY prt.Id_Product ORDER BY prt.Id_RacingType, prt.Id_ProductRacingType),
             ISNULL(NULLIF(LTRIM(RTRIM(prt.Name)), ''), rt.Name),
             CASE prt.Id_RacingType WHEN 4 THEN 'corrida' WHEN 3 THEN 'classificacao' ELSE 'treino' END,
             CASE WHEN ISNULL(prt.EndLap, 0) > 0 AND ISNULL(prt.EndTime, 0) = 0 THEN 'voltas' ELSE 'tempo' END,
             NULLIF(prt.EndTime, 0), NULLIF(prt.EndLap, 0)
      FROM ${L}.ProductRacingType prt JOIN dbo.Produto pr ON pr.LegadoId = prt.Id_Product
      LEFT JOIN ${L}.RacingType rt ON rt.Id_RacingType = prt.Id_RacingType`);
  }

  if (await empty('PadraoReserva'))
    await run('padroes de reserva', `INSERT INTO dbo.PadraoReserva (Nome, ProdutoId, TracadoId, Categoria, Quantidade, PrimeiraHora, Vagas, IntervaloMin, VoltaMinimaSeg, NumerarNome, Online, Ativo, LegadoId)
      SELECT LTRIM(RTRIM(bc.Name)), p.Id, t.Id, ISNULL(c.Name, 'Indoor'), bc.Quantity, CONVERT(varchar(5), bc.FirstTime, 108), bc.Vacancies,
             CASE WHEN bc.Interval < 30 THEN bc.Interval + 25 ELSE bc.Interval END, bc.MinimumTime, bc.UseNumberOnName, bc.IsOnline, bc.Active, bc.Id_BookingConfig
      FROM ${L}.BookingConfig bc LEFT JOIN dbo.Produto p ON p.LegadoId = bc.Id_Product LEFT JOIN dbo.Tracado t ON t.LegadoId = bc.Id_RacingTrack
      LEFT JOIN ${L}.Category c ON c.Id_Category = bc.Id_Category`);

  if (await empty('Terminal'))
    await run('terminais', `INSERT INTO dbo.Terminal (Codigo, Nome, Ativo, LegadoId)
      SELECT Code, CASE WHEN Id_PosTerminal = 999 THEN 'Vendas on-line (LapTime)' ELSE Description END, CASE WHEN Id_PosTerminal = 999 THEN 0 ELSE Active END, Id_PosTerminal FROM ${L}.PosTerminal`);
  if (await empty('Turno'))
    await run('turnos', `INSERT INTO dbo.Turno (Descricao, Inicio, Fim, Ativo, LegadoId)
      SELECT Description, CONVERT(varchar(5), StartTime, 108), CONVERT(varchar(5), EndTime, 108), Active, Id_PosShift FROM ${L}.PosShift`);
  if (await empty('FormaPagamento'))
    await run('formas de pagamento', `INSERT INTO dbo.FormaPagamento (Codigo, Nome, Tipo, Ativo, LegadoId)
      SELECT Code, Name, CASE LOWER(Name) WHEN 'dinheiro' THEN 'dinheiro' WHEN 'crédito' THEN 'credito' WHEN 'débito' THEN 'debito' WHEN 'pix' THEN 'pix' WHEN 'voucher' THEN 'voucher' ELSE 'outro' END,
             Active, Id_PaymentMethod FROM ${L}.PaymentMethod`);

  // ---------- usuarios iniciais
  if (await empty('Usuario')) {
    const users = [
      { login: 'admin', nome: 'Administrador', admin: true },
      { login: 'ludmila', nome: 'LUDMILA', admin: false },
      { login: 'suenia', nome: 'SUÊNIA', admin: false },
      { login: 'gustavo', nome: 'GUSTAVO', admin: false },
    ];
    const lines: string[] = [];
    for (const u of users) {
      const senha = senhaAleatoria();
      await db.request().input('l', u.login).input('n', u.nome).input('h', hashSenha(senha)).input('a', u.admin ? 1 : 0)
        .query('INSERT INTO dbo.Usuario (Login, Nome, SenhaHash, Admin) VALUES (@l, @n, @h, @a)');
      lines.push(`${u.login.padEnd(10)} ${senha}   (${u.nome}${u.admin ? ', administrador' : ''})`);
    }
    const out = process.env.OPS_SENHAS_FILE || join(process.cwd(), '..', '..', 'KARTODROMO', 'SENHAS_SISTEMA_PROPRIO.txt');
    writeFileSync(out, `Senhas iniciais do app da Recepcao (${new Date().toISOString().slice(0, 10)}). Troque em Inicio > Seguranca > Usuario.\n\n${lines.join('\n')}\n`);
    console.log(`usuarios criados; senhas em ${out}`);
  }

  // ---------- baterias: completa as futuras e traz o historico
  await run('baterias (completa produto/tracado)', `UPDATE b SET ProdutoId = p.Id, TracadoId = t.Id, VoltaMinimaSeg = ISNULL(DATEDIFF(second, CAST('00:00' AS time), CAST(bk.MinimumTime AS time)), 5),
        CodigoReserva = bk.ReservationCode, ReservaFechada = ISNULL(bk.IsReserved, 0), ResponsavelId = c.Id
      FROM dbo.Bateria b JOIN ${L}.Booking bk ON bk.Id_Booking = b.LegadoId
      LEFT JOIN dbo.Produto p ON p.LegadoId = bk.Id_Product LEFT JOIN dbo.Tracado t ON t.LegadoId = bk.Id_RacingTrack
      LEFT JOIN dbo.Cliente c ON c.LegadoId = bk.Id_Customer
      WHERE b.ProdutoId IS NULL`).catch(async () => {
    // MinimumTime pode nao ser time: tenta como numero de segundos
    await run('baterias (completa produto/tracado, fallback)', `UPDATE b SET ProdutoId = p.Id, TracadoId = t.Id, CodigoReserva = bk.ReservationCode, ReservaFechada = ISNULL(bk.IsReserved, 0), ResponsavelId = c.Id
      FROM dbo.Bateria b JOIN ${L}.Booking bk ON bk.Id_Booking = b.LegadoId
      LEFT JOIN dbo.Produto p ON p.LegadoId = bk.Id_Product LEFT JOIN dbo.Tracado t ON t.LegadoId = bk.Id_RacingTrack
      LEFT JOIN dbo.Cliente c ON c.LegadoId = bk.Id_Customer WHERE b.ProdutoId IS NULL`);
  });
  await run('baterias (historico)', `INSERT INTO dbo.Bateria (Inicio, Nome, TipoKart, Vagas, Status, AutoAtendimento, LegadoId, ProdutoId, TracadoId, CodigoReserva, ReservaFechada, ResponsavelId)
      SELECT bk.ExpectedDateTime, bk.Name, CASE WHEN p.Categoria = 'Super Kart' THEN 'super' ELSE 'light' END, bk.MaxVacancies,
             CASE WHEN bk.ExpectedDateTime < CAST(SYSDATETIME() AS date) THEN 'fechada' ELSE 'aberta' END, bk.IsOnline, bk.Id_Booking,
             p.Id, t.Id, bk.ReservationCode, ISNULL(bk.IsReserved, 0), c.Id
      FROM ${L}.Booking bk LEFT JOIN dbo.Produto p ON p.LegadoId = bk.Id_Product LEFT JOIN dbo.Tracado t ON t.LegadoId = bk.Id_RacingTrack
      LEFT JOIN dbo.Cliente c ON c.LegadoId = bk.Id_Customer
      WHERE NOT EXISTS (SELECT 1 FROM dbo.Bateria x WHERE x.LegadoId = bk.Id_Booking)`);
  await run('baterias (tipo de kart pelo produto)', `UPDATE b SET TipoKart = CASE WHEN p.Categoria = 'Super Kart' THEN 'super' ELSE 'light' END
      FROM dbo.Bateria b JOIN dbo.Produto p ON p.Id = b.ProdutoId`);

  await run('reservas (historico)', `INSERT INTO dbo.Inscricao (BateriaId, ClienteId, Status, Origem, Pago, ValorCentavos, PrecoCentavos, DescontoCentavos, Aprovada, ProdutoId, Observacao, CriadoEm, AtualizadoEm, LegadoId)
      SELECT b.Id, c.Id, CASE WHEN bc.IsCanceled = 1 THEN 'cancelada' WHEN bc.PaidOut = 1 THEN 'confirmada' ELSE 'reservada' END, 'laptime',
             bc.PaidOut, CAST(ROUND(bc.PaidPrice * 100, 0) AS INT), CAST(ROUND(bc.Price * 100, 0) AS INT), CAST(ROUND(ISNULL(bc.Discount, 0) * 100, 0) AS INT),
             bc.IsApproved, p.Id, LEFT(bc.Obs, 400), bc.DateBooking, bc.DateBooking, bc.Id_BookingCustomer
      FROM ${L}.BookingCustomer bc JOIN dbo.Bateria b ON b.LegadoId = bc.Id_Booking JOIN dbo.Cliente c ON c.LegadoId = bc.Id_Customer
      LEFT JOIN dbo.Produto p ON p.LegadoId = bc.Id_Product
      WHERE NOT EXISTS (SELECT 1 FROM dbo.Inscricao x WHERE x.LegadoId = bc.Id_BookingCustomer)`);

  // ---------- caixa e vendas
  if (await empty('Movimento')) {
    await run('movimentos de caixa', `INSERT INTO dbo.Movimento (UsuarioId, TerminalId, TurnoId, AbertoEm, FechadoEm, InicialCentavos, ProximoTurnoCentavos, LegadoId)
      SELECT CASE WHEN m.Id_User = 1 THEN (SELECT Id FROM dbo.Usuario WHERE Login = 'admin') END, t.Id, tu.Id, m.DateOpen,
             ISNULL(m.DateClose, CASE WHEN m.DateOpen < CAST(SYSDATETIME() AS date) THEN DATEADD(hour, 23, CAST(CAST(m.DateOpen AS date) AS datetime2)) END),
             CAST(ROUND(ISNULL(m.TotalInitial, 0) * 100, 0) AS INT), CAST(ROUND(ISNULL(m.TotalForNext, 0) * 100, 0) AS INT), m.Id_PosMovement
      FROM ${L}.PosMovement m JOIN dbo.Terminal t ON t.LegadoId = m.Id_PosTerminal LEFT JOIN dbo.Turno tu ON tu.LegadoId = m.Id_PosShift`);
    await run('suprimentos/sangrias', `INSERT INTO dbo.MovimentoTransacao (MovimentoId, UsuarioId, Tipo, ValorCentavos, Observacao, CriadoEm)
      SELECT mv.Id, (SELECT Id FROM dbo.Usuario WHERE Login = 'admin'), CASE pt.TypeMovement WHEN '02' THEN 'sangria' ELSE 'suprimento' END,
             CAST(ROUND(pt.ValueMovement * 100, 0) AS INT), pt.Obs, pt.DateMovement
      FROM ${L}.PosTransaction pt JOIN dbo.Movimento mv ON mv.LegadoId = pt.Id_PosMovement`);
  }
  if (await empty('Venda')) {
    await run('vendas', `INSERT INTO dbo.Venda (Codigo, MovimentoId, UsuarioId, TerminalId, ClienteId, CriadoEm, BrutoCentavos, DescontoCentavos, AcrescimoCentavos,
             RecebidoCentavos, TrocoCentavos, EstornoCentavos, FinalCentavos, Cancelada, MotivoCancelamento, Observacao, LegadoId)
      SELECT s.Code, mv.Id, CASE WHEN s.Id_User = 1 THEN (SELECT Id FROM dbo.Usuario WHERE Login = 'admin') END, t.Id, c.Id, s.DateSale,
             CAST(ROUND(s.TotalVending * 100, 0) AS INT), CAST(ROUND(s.TotalDiscount * 100, 0) AS INT), CAST(ROUND(s.TotalAdditions * 100, 0) AS INT),
             CAST(ROUND(s.TotalReceived * 100, 0) AS INT), CAST(ROUND(s.TotalChange * 100, 0) AS INT), CAST(ROUND(s.TotalCanceled * 100, 0) AS INT),
             CAST(ROUND(s.TotalFinal * 100, 0) AS INT), s.IsCanceled, LEFT(s.CancelReason, 400), LEFT(s.Obs, 1000), s.Id_PosSale
      FROM ${L}.PosSale s LEFT JOIN dbo.Movimento mv ON mv.LegadoId = s.Id_PosMovement LEFT JOIN dbo.Terminal t ON t.LegadoId = s.Id_PosTerminal
      LEFT JOIN dbo.Cliente c ON c.LegadoId = s.Id_Customer`);
    await run('itens de venda', `INSERT INTO dbo.VendaItem (VendaId, Item, ProdutoId, Descricao, Quantidade, UnitarioCentavos, DescontoCentavos, AcrescimoCentavos, LiquidoCentavos,
             InscricaoId, Estornado, MotivoEstorno, LegadoId)
      SELECT v.Id, i.Item, p.Id, LEFT(LTRIM(RTRIM(i.Description)), 200), CAST(i.Quantity AS INT), CAST(ROUND(i.UnitValue * 100, 0) AS INT),
             CAST(ROUND(ISNULL(i.TotalDiscount, 0) * 100, 0) AS INT), CAST(ROUND(ISNULL(i.TotalAddition, 0) * 100, 0) AS INT), CAST(ROUND(i.TotalNet * 100, 0) AS INT),
             ins.Id, CASE WHEN i.IsCanceled = 1 OR i.Returned = 1 THEN 1 ELSE 0 END, LEFT(i.CancelReason, 400), i.Id_PosSaleItem
      FROM ${L}.PosSaleItem i JOIN dbo.Venda v ON v.LegadoId = i.Id_PosSale LEFT JOIN dbo.Produto p ON p.LegadoId = i.Id_Product
      LEFT JOIN dbo.Inscricao ins ON ins.LegadoId = i.Id_BookingCustomer`);
    await run('pagamentos de venda', `INSERT INTO dbo.VendaPagamento (VendaId, FormaPagamentoId, ValorCentavos, Cancelado)
      SELECT v.Id, f.Id, CAST(ROUND(pm.ValuePaid * 100, 0) AS INT), pm.IsCanceled
      FROM ${L}.PosSalePaymentMethod pm JOIN dbo.Venda v ON v.LegadoId = pm.Id_PosSale LEFT JOIN dbo.FormaPagamento f ON f.LegadoId = pm.Id_PaymentMethod`);
    await run('reservas <- venda', `UPDATE ins SET VendaId = vi.VendaId FROM dbo.Inscricao ins JOIN dbo.VendaItem vi ON vi.InscricaoId = ins.Id WHERE ins.VendaId IS NULL`);
  }

  // ---------- oficina
  if (await empty('ItemManutencao')) {
    await run('itens de manutencao', `INSERT INTO dbo.ItemManutencao (Codigo, Nome, ControlaPorTempo, TempoHoras, Ativo, LegadoId)
      SELECT Code, Name, IsTrackedByTime, CASE WHEN TrackTime IS NULL THEN NULL ELSE TrackTime / 60 END, Active, Id_VehicleMaintenanceItem FROM ${L}.VehicleMaintenanceItem`);
    await run('manutencoes', `INSERT INTO dbo.Manutencao (Kart, Categoria, ItemId, MinutosUso, UltimaManutencao, Realizada, Data, LegadoId)
      SELECT vc.Number, c.Name, it.Id, CAST(ISNULL(vc.TickofUse, 0) / 600000000 AS INT), vc.LastMaintenance, CASE WHEN vc.StatusControl = 1 THEN 1 ELSE 0 END, vc.DateControl, vc.Id_VehicleControl
      FROM ${L}.VehicleControl vc LEFT JOIN ${L}.Category c ON c.Id_Category = vc.Id_Category LEFT JOIN dbo.ItemManutencao it ON it.LegadoId = vc.Id_VehicleMaintenanceItem`);
  }

  // as 2 tabelas provisorias da 1a versao (Pagamento/CaixaMovimento) ficam, mas vazias: o caixa agora e por terminal
  const antigos = (await db.request().query('SELECT (SELECT COUNT(*) FROM dbo.Pagamento WHERE Estornado = 0) p, (SELECT COUNT(*) FROM dbo.CaixaMovimento) m')).recordset[0];
  console.log(`pagamentos da versao provisoria ainda nao migrados: ${antigos.p}; movimentos provisorios: ${antigos.m}`);
  await db.close();
}

main().catch((err) => {
  console.error('FALHA', err);
  process.exit(1);
});
