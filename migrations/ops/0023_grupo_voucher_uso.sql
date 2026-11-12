-- Cupom usado por quem paga a vaga pelo link do grupo (12/11/2026). Conta no limite de uso do voucher junto com
-- VoucherUso (recepção) e ReservaOnlineVoucherUso (reserva online). Uma linha por cobrança da Asaas.
IF OBJECT_ID('dbo.ReservaGrupoVoucherUso') IS NULL
CREATE TABLE dbo.ReservaGrupoVoucherUso (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  AsaasId VARCHAR(40) NOT NULL CONSTRAINT UQ_ReservaGrupoVoucherUso_Asaas UNIQUE,
  GrupoId INT NOT NULL REFERENCES dbo.ReservaGrupo(Id),
  PilotoId INT NULL REFERENCES dbo.ReservaGrupoPiloto(Id),
  VoucherId INT NOT NULL REFERENCES dbo.Voucher(Id),
  ClienteId INT NOT NULL REFERENCES dbo.Cliente(Id),
  DescontoCentavos INT NOT NULL CHECK (DescontoCentavos >= 0),
  Estado VARCHAR(24) NOT NULL CHECK (Estado IN ('reservado', 'consumido', 'liberado')),
  CriadoEm DATETIME2(0) NOT NULL DEFAULT SYSDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReservaGrupoVoucherUso_VoucherEstado')
  CREATE INDEX IX_ReservaGrupoVoucherUso_VoucherEstado ON dbo.ReservaGrupoVoucherUso (VoucherId, Estado, ClienteId);
GO
