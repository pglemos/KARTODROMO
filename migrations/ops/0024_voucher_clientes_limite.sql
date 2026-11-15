-- Vouchers nominais / por grupo de pessoas e limite total de utilizações com esgotamento automático.
IF COL_LENGTH('dbo.Voucher', 'UsoMaxTotal') IS NULL
  ALTER TABLE dbo.Voucher ADD UsoMaxTotal INT NULL;
GO
IF COL_LENGTH('dbo.Voucher', 'RestritoClientes') IS NULL
  ALTER TABLE dbo.Voucher ADD RestritoClientes BIT NOT NULL CONSTRAINT DF_Voucher_RestritoClientes DEFAULT 0;
GO
IF OBJECT_ID('dbo.VoucherCliente') IS NULL
CREATE TABLE dbo.VoucherCliente (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  VoucherId INT NOT NULL REFERENCES dbo.Voucher(Id) ON DELETE CASCADE,
  ClienteId INT NULL REFERENCES dbo.Cliente(Id),
  Nome NVARCHAR(200) NOT NULL,
  Documento VARCHAR(30) NULL,
  Telefone NVARCHAR(40) NULL,
  UsosMax INT NOT NULL DEFAULT 1 CHECK (UsosMax >= 1),
  Observacao NVARCHAR(250) NULL,
  CriadoEm DATETIME2(0) NOT NULL DEFAULT SYSDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VoucherCliente_Voucher')
  CREATE INDEX IX_VoucherCliente_Voucher ON dbo.VoucherCliente (VoucherId);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VoucherCliente_Cliente')
  CREATE INDEX IX_VoucherCliente_Cliente ON dbo.VoucherCliente (ClienteId) WHERE ClienteId IS NOT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VoucherCliente_Documento')
  CREATE INDEX IX_VoucherCliente_Documento ON dbo.VoucherCliente (Documento) WHERE Documento IS NOT NULL;
GO
IF COL_LENGTH('dbo.Inscricao', 'VoucherId') IS NULL
  ALTER TABLE dbo.Inscricao ADD VoucherId INT NULL REFERENCES dbo.Voucher(Id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Inscricao_VoucherId')
  CREATE INDEX IX_Inscricao_VoucherId ON dbo.Inscricao (VoucherId) WHERE VoucherId IS NOT NULL;
GO
