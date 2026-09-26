-- Banco operacional proprio (substitui o LapTime). SQL Server Express no SRVKART.
-- Clientes, grade de baterias, inscricoes (reservas), pagamentos e caixa.

IF OBJECT_ID('dbo.Cliente') IS NULL
CREATE TABLE dbo.Cliente (
  Id              INT IDENTITY(1,1) PRIMARY KEY,
  Nome            NVARCHAR(200) NOT NULL,
  TipoDocumento   VARCHAR(20)   NOT NULL DEFAULT 'CPF',  -- CPF | RG | PASSAPORTE | OUTRO
  Documento       NVARCHAR(60)  NULL,
  DocumentoNum    VARCHAR(30)   NULL,                    -- so digitos, pra busca
  Email           NVARCHAR(200) NULL,
  Telefone        NVARCHAR(40)  NULL,
  TelefoneNum     VARCHAR(20)   NULL,
  Nascimento      DATE          NULL,
  Sexo            CHAR(1)       NULL,                    -- M | F | NULL
  Peso            DECIMAL(5,1)  NULL,
  Cep             VARCHAR(12)   NULL,
  Endereco        NVARCHAR(200) NULL,
  Numero          NVARCHAR(20)  NULL,
  Complemento     NVARCHAR(100) NULL,
  Bairro          NVARCHAR(100) NULL,
  Cidade          NVARCHAR(100) NULL,
  Estado          VARCHAR(4)    NULL,
  ResponsavelId   INT           NULL REFERENCES dbo.Cliente(Id),
  LgpdAceiteEm    DATETIME2     NULL,
  Bloqueado       BIT           NOT NULL DEFAULT 0,
  Observacao      NVARCHAR(400) NULL,
  Origem          VARCHAR(20)   NOT NULL DEFAULT 'recepcao', -- laptime | calxpro | recepcao | totem | site
  LegadoId        INT           NULL,                         -- Id_Customer do LapTime
  CriadoEm        DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
  AtualizadoEm    DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Cliente_DocumentoNum')
  CREATE INDEX IX_Cliente_DocumentoNum ON dbo.Cliente(DocumentoNum);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Cliente_Email')
  CREATE INDEX IX_Cliente_Email ON dbo.Cliente(Email);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Cliente_TelefoneNum')
  CREATE INDEX IX_Cliente_TelefoneNum ON dbo.Cliente(TelefoneNum);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Cliente_Nome')
  CREATE INDEX IX_Cliente_Nome ON dbo.Cliente(Nome);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Cliente_Responsavel')
  CREATE INDEX IX_Cliente_Responsavel ON dbo.Cliente(ResponsavelId);
GO

IF OBJECT_ID('dbo.Bateria') IS NULL
CREATE TABLE dbo.Bateria (
  Id              INT IDENTITY(1,1) PRIMARY KEY,
  Inicio          DATETIME2     NOT NULL,              -- horario local de Brasilia
  Nome            NVARCHAR(100) NOT NULL,
  TipoKart        VARCHAR(10)   NOT NULL DEFAULT 'light', -- light | super
  Vagas           INT           NOT NULL DEFAULT 30,
  Status          VARCHAR(12)   NOT NULL DEFAULT 'aberta', -- aberta | fechada | cancelada
  AutoAtendimento BIT           NOT NULL DEFAULT 1,     -- aparece no totem
  LegadoId        INT           NULL,                   -- Id_Booking do LapTime
  TimingSessionId VARCHAR(40)   NULL,
  CriadoEm        DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Bateria_Inicio')
  CREATE INDEX IX_Bateria_Inicio ON dbo.Bateria(Inicio);
GO

IF OBJECT_ID('dbo.Inscricao') IS NULL
CREATE TABLE dbo.Inscricao (
  Id              INT IDENTITY(1,1) PRIMARY KEY,
  BateriaId       INT           NOT NULL REFERENCES dbo.Bateria(Id),
  ClienteId       INT           NOT NULL REFERENCES dbo.Cliente(Id),
  Status          VARCHAR(12)   NOT NULL DEFAULT 'reservada', -- reservada | confirmada | cancelada
  Origem          VARCHAR(12)   NOT NULL DEFAULT 'recepcao',  -- totem | recepcao | site | whatsapp
  Kart            VARCHAR(10)   NULL,
  Pago            BIT           NOT NULL DEFAULT 0,
  ValorCentavos   INT           NULL,
  TermoImpressoEm DATETIME2     NULL,
  Observacao      NVARCHAR(400) NULL,
  CriadoEm        DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
  AtualizadoEm    DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Inscricao_Bateria')
  CREATE INDEX IX_Inscricao_Bateria ON dbo.Inscricao(BateriaId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Inscricao_Cliente')
  CREATE INDEX IX_Inscricao_Cliente ON dbo.Inscricao(ClienteId);
GO

IF OBJECT_ID('dbo.Pagamento') IS NULL
CREATE TABLE dbo.Pagamento (
  Id              INT IDENTITY(1,1) PRIMARY KEY,
  InscricaoId     INT           NULL REFERENCES dbo.Inscricao(Id),
  Descricao       NVARCHAR(200) NOT NULL,
  Tabela          VARCHAR(20)   NOT NULL,   -- antecipado | balcao | super | avulso
  Forma           VARCHAR(12)   NOT NULL,   -- dinheiro | credito | debito | pix | site
  ValorCentavos   INT           NOT NULL,
  Operador        NVARCHAR(60)  NOT NULL,
  Estornado       BIT           NOT NULL DEFAULT 0,
  EstornadoEm     DATETIME2     NULL,
  CriadoEm        DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Pagamento_CriadoEm')
  CREATE INDEX IX_Pagamento_CriadoEm ON dbo.Pagamento(CriadoEm);
GO

-- abertura / suprimento / sangria / fechamento do caixa da recepcao
IF OBJECT_ID('dbo.CaixaMovimento') IS NULL
CREATE TABLE dbo.CaixaMovimento (
  Id              INT IDENTITY(1,1) PRIMARY KEY,
  Tipo            VARCHAR(12)   NOT NULL,   -- abertura | suprimento | sangria | fechamento
  ValorCentavos   INT           NOT NULL,
  Operador        NVARCHAR(60)  NOT NULL,
  Observacao      NVARCHAR(400) NULL,
  CriadoEm        DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);
GO
