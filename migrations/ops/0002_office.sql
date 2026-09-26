-- Replica funcional do LapTime Office: usuarios, produtos, POS (terminal/turno/movimento/venda),
-- vouchers, padroes de reserva, feriados, tracados, oficina e parametros.
-- Idempotente (IF OBJECT_ID / COL_LENGTH).

IF OBJECT_ID('dbo.Usuario') IS NULL
CREATE TABLE dbo.Usuario (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Login VARCHAR(40) NOT NULL UNIQUE,
  Nome NVARCHAR(100) NOT NULL,
  SenhaHash VARCHAR(200) NOT NULL,
  Admin BIT NOT NULL DEFAULT 0,
  Ativo BIT NOT NULL DEFAULT 1,
  CriadoEm DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

IF OBJECT_ID('dbo.Empresa') IS NULL
CREATE TABLE dbo.Empresa (
  Id INT PRIMARY KEY,
  Nome NVARCHAR(200) NOT NULL,
  RazaoSocial NVARCHAR(200) NULL,
  Cnpj VARCHAR(20) NULL,
  Cep VARCHAR(12) NULL, Endereco NVARCHAR(200) NULL, Numero NVARCHAR(20) NULL, Complemento NVARCHAR(100) NULL,
  Bairro NVARCHAR(100) NULL, Cidade NVARCHAR(100) NULL, Estado VARCHAR(4) NULL,
  Telefone NVARCHAR(40) NULL, Email NVARCHAR(200) NULL,
  PoliticaReembolso NVARCHAR(MAX) NULL
);
GO

IF OBJECT_ID('dbo.Parametro') IS NULL
CREATE TABLE dbo.Parametro (
  Chave VARCHAR(80) PRIMARY KEY,
  Valor NVARCHAR(1000) NULL,
  Descricao NVARCHAR(200) NULL
);
GO

IF OBJECT_ID('dbo.Tracado') IS NULL
CREATE TABLE dbo.Tracado (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Nome NVARCHAR(100) NOT NULL,
  Comprimento INT NULL,
  Ativo BIT NOT NULL DEFAULT 1,
  LegadoId INT NULL
);
GO

IF OBJECT_ID('dbo.Feriado') IS NULL
CREATE TABLE dbo.Feriado (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Data DATE NOT NULL,
  Descricao NVARCHAR(100) NOT NULL,
  Recorrente BIT NOT NULL DEFAULT 0
);
GO

IF OBJECT_ID('dbo.Produto') IS NULL
CREATE TABLE dbo.Produto (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Codigo VARCHAR(20) NOT NULL,
  Nome NVARCHAR(150) NOT NULL,
  PrecoCentavos INT NOT NULL DEFAULT 0,
  Categoria NVARCHAR(40) NOT NULL DEFAULT 'Indoor',   -- Indoor | Super Kart
  ClasseContabil NVARCHAR(60) NOT NULL DEFAULT 'Locações',
  ServicoLocacao BIT NOT NULL DEFAULT 1,
  PublicarNuvem BIT NOT NULL DEFAULT 0,
  RequerDevolucao BIT NOT NULL DEFAULT 0,
  DuracaoMin INT NULL,
  Ativo BIT NOT NULL DEFAULT 1,
  LegadoId INT NULL
);
GO

IF OBJECT_ID('dbo.PadraoReserva') IS NULL
CREATE TABLE dbo.PadraoReserva (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Nome NVARCHAR(100) NOT NULL,
  ProdutoId INT NULL REFERENCES dbo.Produto(Id),
  TracadoId INT NULL REFERENCES dbo.Tracado(Id),
  Categoria NVARCHAR(40) NOT NULL DEFAULT 'Indoor',
  Quantidade INT NOT NULL DEFAULT 1,
  PrimeiraHora VARCHAR(5) NOT NULL DEFAULT '17:00',
  Vagas INT NOT NULL DEFAULT 30,
  IntervaloMin INT NOT NULL DEFAULT 35,        -- entre o inicio de uma bateria e o da proxima
  VoltaMinimaSeg INT NOT NULL DEFAULT 5,
  NumerarNome BIT NOT NULL DEFAULT 0,
  Online BIT NOT NULL DEFAULT 1,
  Ativo BIT NOT NULL DEFAULT 1,
  LegadoId INT NULL
);
GO

-- Bateria: campos do LapTime (produto, tracado, volta minima, responsavel, codigo de reserva)
IF COL_LENGTH('dbo.Bateria', 'ProdutoId') IS NULL ALTER TABLE dbo.Bateria ADD ProdutoId INT NULL REFERENCES dbo.Produto(Id);
IF COL_LENGTH('dbo.Bateria', 'TracadoId') IS NULL ALTER TABLE dbo.Bateria ADD TracadoId INT NULL REFERENCES dbo.Tracado(Id);
IF COL_LENGTH('dbo.Bateria', 'VoltaMinimaSeg') IS NULL ALTER TABLE dbo.Bateria ADD VoltaMinimaSeg INT NOT NULL DEFAULT 5;
IF COL_LENGTH('dbo.Bateria', 'ResponsavelId') IS NULL ALTER TABLE dbo.Bateria ADD ResponsavelId INT NULL REFERENCES dbo.Cliente(Id);
IF COL_LENGTH('dbo.Bateria', 'CodigoReserva') IS NULL ALTER TABLE dbo.Bateria ADD CodigoReserva VARCHAR(20) NULL;
IF COL_LENGTH('dbo.Bateria', 'ReservaFechada') IS NULL ALTER TABLE dbo.Bateria ADD ReservaFechada BIT NOT NULL DEFAULT 0;
IF COL_LENGTH('dbo.Bateria', 'Observacao') IS NULL ALTER TABLE dbo.Bateria ADD Observacao NVARCHAR(400) NULL;
GO

-- Inscricao = BookingCustomer: produto/preco/desconto, aprovacao (pre-reserva do totem), responsavel
IF COL_LENGTH('dbo.Inscricao', 'ProdutoId') IS NULL ALTER TABLE dbo.Inscricao ADD ProdutoId INT NULL REFERENCES dbo.Produto(Id);
IF COL_LENGTH('dbo.Inscricao', 'PrecoCentavos') IS NULL ALTER TABLE dbo.Inscricao ADD PrecoCentavos INT NULL;
IF COL_LENGTH('dbo.Inscricao', 'DescontoCentavos') IS NULL ALTER TABLE dbo.Inscricao ADD DescontoCentavos INT NOT NULL DEFAULT 0;
IF COL_LENGTH('dbo.Inscricao', 'Aprovada') IS NULL ALTER TABLE dbo.Inscricao ADD Aprovada BIT NOT NULL DEFAULT 1;
IF COL_LENGTH('dbo.Inscricao', 'ResponsavelId') IS NULL ALTER TABLE dbo.Inscricao ADD ResponsavelId INT NULL REFERENCES dbo.Cliente(Id);
IF COL_LENGTH('dbo.Inscricao', 'VendaId') IS NULL ALTER TABLE dbo.Inscricao ADD VendaId INT NULL;
IF COL_LENGTH('dbo.Inscricao', 'LegadoId') IS NULL ALTER TABLE dbo.Inscricao ADD LegadoId INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Inscricao_Legado') CREATE INDEX IX_Inscricao_Legado ON dbo.Inscricao(LegadoId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Bateria_Legado') CREATE INDEX IX_Bateria_Legado ON dbo.Bateria(LegadoId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Cliente_Legado') CREATE INDEX IX_Cliente_Legado ON dbo.Cliente(LegadoId);
GO

-- ---------------------------------------------------------------- POS
IF OBJECT_ID('dbo.Terminal') IS NULL
CREATE TABLE dbo.Terminal (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Codigo VARCHAR(10) NOT NULL,
  Nome NVARCHAR(60) NOT NULL,
  Ativo BIT NOT NULL DEFAULT 1,
  LegadoId INT NULL
);
GO
IF OBJECT_ID('dbo.Turno') IS NULL
CREATE TABLE dbo.Turno (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Descricao NVARCHAR(60) NOT NULL,
  Inicio VARCHAR(5) NOT NULL DEFAULT '08:00',
  Fim VARCHAR(5) NOT NULL DEFAULT '22:00',
  Ativo BIT NOT NULL DEFAULT 1,
  LegadoId INT NULL
);
GO
IF OBJECT_ID('dbo.FormaPagamento') IS NULL
CREATE TABLE dbo.FormaPagamento (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Codigo VARCHAR(10) NOT NULL,
  Nome NVARCHAR(60) NOT NULL,
  Tipo VARCHAR(12) NOT NULL DEFAULT 'outro',  -- dinheiro | credito | debito | pix | voucher | outro
  Ativo BIT NOT NULL DEFAULT 1,
  LegadoId INT NULL
);
GO
IF OBJECT_ID('dbo.Movimento') IS NULL
CREATE TABLE dbo.Movimento (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  UsuarioId INT NULL REFERENCES dbo.Usuario(Id),
  TerminalId INT NOT NULL REFERENCES dbo.Terminal(Id),
  TurnoId INT NULL REFERENCES dbo.Turno(Id),
  AbertoEm DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  FechadoEm DATETIME2 NULL,
  InicialCentavos INT NOT NULL DEFAULT 0,
  ProximoTurnoCentavos INT NULL,
  LegadoId INT NULL
);
GO
IF OBJECT_ID('dbo.MovimentoTransacao') IS NULL
CREATE TABLE dbo.MovimentoTransacao (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  MovimentoId INT NOT NULL REFERENCES dbo.Movimento(Id),
  UsuarioId INT NULL REFERENCES dbo.Usuario(Id),
  Tipo VARCHAR(12) NOT NULL,          -- suprimento | sangria
  ValorCentavos INT NOT NULL,
  Observacao NVARCHAR(400) NULL,
  CriadoEm DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO
IF OBJECT_ID('dbo.Venda') IS NULL
CREATE TABLE dbo.Venda (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Codigo VARCHAR(20) NULL,
  MovimentoId INT NULL REFERENCES dbo.Movimento(Id),
  UsuarioId INT NULL REFERENCES dbo.Usuario(Id),
  TerminalId INT NULL REFERENCES dbo.Terminal(Id),
  ClienteId INT NULL REFERENCES dbo.Cliente(Id),
  CriadoEm DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  BrutoCentavos INT NOT NULL DEFAULT 0,
  DescontoCentavos INT NOT NULL DEFAULT 0,
  AcrescimoCentavos INT NOT NULL DEFAULT 0,
  RecebidoCentavos INT NOT NULL DEFAULT 0,
  TrocoCentavos INT NOT NULL DEFAULT 0,
  EstornoCentavos INT NOT NULL DEFAULT 0,
  FinalCentavos INT NOT NULL DEFAULT 0,
  Cancelada BIT NOT NULL DEFAULT 0,
  MotivoCancelamento NVARCHAR(400) NULL,
  Observacao NVARCHAR(1000) NULL,
  LegadoId INT NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Venda_CriadoEm') CREATE INDEX IX_Venda_CriadoEm ON dbo.Venda(CriadoEm);
GO
IF OBJECT_ID('dbo.VendaItem') IS NULL
CREATE TABLE dbo.VendaItem (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  VendaId INT NOT NULL REFERENCES dbo.Venda(Id),
  Item INT NOT NULL,
  ProdutoId INT NULL REFERENCES dbo.Produto(Id),
  Descricao NVARCHAR(200) NOT NULL,
  Quantidade INT NOT NULL DEFAULT 1,
  UnitarioCentavos INT NOT NULL,
  DescontoCentavos INT NOT NULL DEFAULT 0,
  AcrescimoCentavos INT NOT NULL DEFAULT 0,
  LiquidoCentavos INT NOT NULL,
  InscricaoId INT NULL,
  VoucherId INT NULL,
  Estornado BIT NOT NULL DEFAULT 0,
  EstornadoEm DATETIME2 NULL,
  MotivoEstorno NVARCHAR(400) NULL,
  LegadoId INT NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VendaItem_Venda') CREATE INDEX IX_VendaItem_Venda ON dbo.VendaItem(VendaId);
GO
IF OBJECT_ID('dbo.VendaPagamento') IS NULL
CREATE TABLE dbo.VendaPagamento (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  VendaId INT NOT NULL REFERENCES dbo.Venda(Id),
  FormaPagamentoId INT NULL REFERENCES dbo.FormaPagamento(Id),
  ValorCentavos INT NOT NULL,
  Cancelado BIT NOT NULL DEFAULT 0
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VendaPagamento_Venda') CREATE INDEX IX_VendaPagamento_Venda ON dbo.VendaPagamento(VendaId);
GO

-- ---------------------------------------------------------------- vouchers
IF OBJECT_ID('dbo.Voucher') IS NULL
CREATE TABLE dbo.Voucher (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Codigo VARCHAR(40) NOT NULL UNIQUE,
  Origem VARCHAR(12) NOT NULL DEFAULT 'manual',   -- fidelidade | parceiro | manual
  Referencia NVARCHAR(150) NULL,                   -- conta fidelidade / parceiro
  Tipo VARCHAR(12) NOT NULL DEFAULT 'percentual',  -- percentual | valor
  Valor INT NOT NULL,                              -- percentual: % inteiro; valor: centavos
  InicioEm DATE NOT NULL,
  FimEm DATE NOT NULL,
  ProdutoId INT NULL REFERENCES dbo.Produto(Id),
  UsoMaxCliente INT NOT NULL DEFAULT 1,
  UsoUnico BIT NOT NULL DEFAULT 1,
  PedidoMinimoCentavos INT NULL,
  DescontoMaximoCentavos INT NULL,
  Ativo BIT NOT NULL DEFAULT 1,
  CriadoEm DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO
IF OBJECT_ID('dbo.VoucherUso') IS NULL
CREATE TABLE dbo.VoucherUso (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  VoucherId INT NOT NULL REFERENCES dbo.Voucher(Id),
  VendaId INT NOT NULL REFERENCES dbo.Venda(Id),
  ClienteId INT NULL REFERENCES dbo.Cliente(Id),
  DescontoCentavos INT NOT NULL,
  Estornado BIT NOT NULL DEFAULT 0,
  CriadoEm DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

-- ---------------------------------------------------------------- oficina
IF OBJECT_ID('dbo.ItemManutencao') IS NULL
CREATE TABLE dbo.ItemManutencao (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Codigo VARCHAR(20) NULL,
  Nome NVARCHAR(100) NOT NULL,
  ControlaPorTempo BIT NOT NULL DEFAULT 1,
  TempoHoras INT NULL,
  Ativo BIT NOT NULL DEFAULT 1,
  LegadoId INT NULL
);
GO
IF OBJECT_ID('dbo.Manutencao') IS NULL
CREATE TABLE dbo.Manutencao (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Kart VARCHAR(10) NOT NULL,
  Categoria NVARCHAR(40) NULL,
  ItemId INT NULL REFERENCES dbo.ItemManutencao(Id),
  MinutosUso INT NOT NULL DEFAULT 0,
  UltimaManutencao DATETIME2 NULL,
  Realizada BIT NOT NULL DEFAULT 0,
  Data DATETIME2 NULL,
  LegadoId INT NULL
);
GO

-- programa de provas de cada produto (ProductRacingType): ex. Tomada de Tempo 5 min + Corrida 20 min
IF OBJECT_ID('dbo.ProdutoProva') IS NULL
CREATE TABLE dbo.ProdutoProva (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ProdutoId INT NOT NULL REFERENCES dbo.Produto(Id),
  Ordem INT NOT NULL DEFAULT 1,
  Nome NVARCHAR(60) NOT NULL,
  Tipo VARCHAR(14) NOT NULL DEFAULT 'corrida',   -- treino | classificacao | corrida
  Finalizacao VARCHAR(10) NOT NULL DEFAULT 'tempo', -- tempo | voltas
  TempoMin INT NULL,
  VoltasMax INT NULL
);
GO
