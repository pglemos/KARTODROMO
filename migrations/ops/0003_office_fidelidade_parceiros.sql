-- Fidelidade, parceiros e comissoes do Office.
-- Idempotente para instalacoes que precisem reaplicar a migracao.

IF OBJECT_ID('dbo.FidelidadeConta') IS NULL
CREATE TABLE dbo.FidelidadeConta (
  Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_FidelidadeConta PRIMARY KEY,
  ClienteId INT NOT NULL CONSTRAINT FK_FidelidadeConta_Cliente REFERENCES dbo.Cliente(Id),
  SaldoPontos INT NOT NULL CONSTRAINT DF_FidelidadeConta_Saldo DEFAULT 0,
  Ativo BIT NOT NULL CONSTRAINT DF_FidelidadeConta_Ativo DEFAULT 1,
  CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_FidelidadeConta_CriadoEm DEFAULT SYSDATETIME(),
  AtualizadoEm DATETIME2 NOT NULL CONSTRAINT DF_FidelidadeConta_AtualizadoEm DEFAULT SYSDATETIME(),
  CONSTRAINT CK_FidelidadeConta_Saldo CHECK (SaldoPontos >= 0),
  CONSTRAINT UQ_FidelidadeConta_Cliente UNIQUE (ClienteId)
);
GO

IF OBJECT_ID('dbo.FidelidadeTransacao') IS NULL
CREATE TABLE dbo.FidelidadeTransacao (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_FidelidadeTransacao PRIMARY KEY,
  ContaId INT NOT NULL CONSTRAINT FK_FidelidadeTransacao_Conta REFERENCES dbo.FidelidadeConta(Id),
  Tipo VARCHAR(16) NOT NULL,
  Pontos INT NOT NULL,
  SaldoApos INT NOT NULL,
  Motivo NVARCHAR(400) NOT NULL,
  IdempotencyKey VARCHAR(80) NOT NULL,
  UsuarioId INT NOT NULL CONSTRAINT FK_FidelidadeTransacao_Usuario REFERENCES dbo.Usuario(Id),
  CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_FidelidadeTransacao_CriadoEm DEFAULT SYSDATETIME(),
  CONSTRAINT CK_FidelidadeTransacao_Tipo CHECK (Tipo IN ('ajuste')),
  CONSTRAINT CK_FidelidadeTransacao_Pontos CHECK (Pontos <> 0),
  CONSTRAINT CK_FidelidadeTransacao_Saldo CHECK (SaldoApos >= 0),
  CONSTRAINT UQ_FidelidadeTransacao_Idempotencia UNIQUE (ContaId, IdempotencyKey)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FidelidadeTransacao_Conta_Criado')
  CREATE INDEX IX_FidelidadeTransacao_Conta_Criado ON dbo.FidelidadeTransacao(ContaId, CriadoEm DESC);
GO

IF OBJECT_ID('dbo.Parceiro') IS NULL
CREATE TABLE dbo.Parceiro (
  Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Parceiro PRIMARY KEY,
  Nome NVARCHAR(150) NOT NULL,
  Documento VARCHAR(30) NULL,
  Contato NVARCHAR(120) NULL,
  Telefone NVARCHAR(40) NULL,
  Email NVARCHAR(200) NULL,
  ComissaoPercentual DECIMAL(5,2) NOT NULL CONSTRAINT DF_Parceiro_Comissao DEFAULT 0,
  Ativo BIT NOT NULL CONSTRAINT DF_Parceiro_Ativo DEFAULT 1,
  CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_Parceiro_CriadoEm DEFAULT SYSDATETIME(),
  AtualizadoEm DATETIME2 NOT NULL CONSTRAINT DF_Parceiro_AtualizadoEm DEFAULT SYSDATETIME(),
  CONSTRAINT CK_Parceiro_Comissao CHECK (ComissaoPercentual >= 0 AND ComissaoPercentual <= 100)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Parceiro_Documento')
  CREATE UNIQUE INDEX UX_Parceiro_Documento ON dbo.Parceiro(Documento) WHERE Documento IS NOT NULL;
GO

IF OBJECT_ID('dbo.ParceiroComissao') IS NULL
CREATE TABLE dbo.ParceiroComissao (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ParceiroComissao PRIMARY KEY,
  ParceiroId INT NOT NULL CONSTRAINT FK_ParceiroComissao_Parceiro REFERENCES dbo.Parceiro(Id),
  VendaId INT NOT NULL CONSTRAINT FK_ParceiroComissao_Venda REFERENCES dbo.Venda(Id),
  BaseCentavos INT NOT NULL,
  Percentual DECIMAL(5,2) NOT NULL,
  ValorCentavos INT NOT NULL,
  Estado VARCHAR(12) NOT NULL CONSTRAINT DF_ParceiroComissao_Estado DEFAULT 'pendente',
  CriadaEm DATETIME2 NOT NULL CONSTRAINT DF_ParceiroComissao_CriadaEm DEFAULT SYSDATETIME(),
  AtualizadaEm DATETIME2 NOT NULL CONSTRAINT DF_ParceiroComissao_AtualizadaEm DEFAULT SYSDATETIME(),
  CONSTRAINT CK_ParceiroComissao_Valores CHECK (BaseCentavos >= 0 AND Percentual >= 0 AND Percentual <= 100 AND ValorCentavos >= 0),
  CONSTRAINT CK_ParceiroComissao_Estado CHECK (Estado IN ('pendente', 'paga', 'estornada')),
  CONSTRAINT UQ_ParceiroComissao_Venda UNIQUE (VendaId)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ParceiroComissao_Parceiro_Estado')
  CREATE INDEX IX_ParceiroComissao_Parceiro_Estado ON dbo.ParceiroComissao(ParceiroId, Estado, CriadaEm DESC);
GO

IF OBJECT_ID('dbo.ParceiroComissaoTransacao') IS NULL
CREATE TABLE dbo.ParceiroComissaoTransacao (
  Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ParceiroComissaoTransacao PRIMARY KEY,
  ComissaoId BIGINT NOT NULL CONSTRAINT FK_ParceiroComissaoTransacao_Comissao REFERENCES dbo.ParceiroComissao(Id),
  Tipo VARCHAR(24) NOT NULL,
  ValorCentavos INT NOT NULL,
  Motivo NVARCHAR(400) NOT NULL,
  IdempotencyKey VARCHAR(80) NULL,
  FormaPagamentoId INT NULL CONSTRAINT FK_ParceiroComissaoTransacao_FormaPagamento REFERENCES dbo.FormaPagamento(Id),
  UsuarioId INT NULL CONSTRAINT FK_ParceiroComissaoTransacao_Usuario REFERENCES dbo.Usuario(Id),
  CriadaEm DATETIME2 NOT NULL CONSTRAINT DF_ParceiroComissaoTransacao_CriadaEm DEFAULT SYSDATETIME(),
  CONSTRAINT CK_ParceiroComissaoTransacao_Tipo CHECK (Tipo IN ('acumulada', 'pagamento', 'estorno_pagamento', 'cancelamento_venda'))
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ParceiroComissaoTransacao_Comissao')
  CREATE INDEX IX_ParceiroComissaoTransacao_Comissao ON dbo.ParceiroComissaoTransacao(ComissaoId, CriadaEm);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_ParceiroComissaoTransacao_Idempotencia')
  CREATE UNIQUE INDEX UX_ParceiroComissaoTransacao_Idempotencia
    ON dbo.ParceiroComissaoTransacao(ComissaoId, IdempotencyKey) WHERE IdempotencyKey IS NOT NULL;
GO

IF COL_LENGTH('dbo.ParceiroComissaoTransacao', 'FormaPagamentoId') IS NULL
  ALTER TABLE dbo.ParceiroComissaoTransacao ADD FormaPagamentoId INT NULL REFERENCES dbo.FormaPagamento(Id);
GO

IF COL_LENGTH('dbo.Voucher', 'ParceiroId') IS NULL ALTER TABLE dbo.Voucher ADD ParceiroId INT NULL REFERENCES dbo.Parceiro(Id);
IF COL_LENGTH('dbo.Voucher', 'FidelidadeContaId') IS NULL ALTER TABLE dbo.Voucher ADD FidelidadeContaId INT NULL REFERENCES dbo.FidelidadeConta(Id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Voucher_Parceiro')
  CREATE INDEX IX_Voucher_Parceiro ON dbo.Voucher(ParceiroId, Ativo);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Voucher_FidelidadeConta')
  CREATE INDEX IX_Voucher_FidelidadeConta ON dbo.Voucher(FidelidadeContaId, Ativo);
GO
