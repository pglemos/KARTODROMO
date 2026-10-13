IF OBJECT_ID('dbo.ReservaOnlineVoucherUso') IS NULL
CREATE TABLE dbo.ReservaOnlineVoucherUso (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  PedidoId VARCHAR(40) NOT NULL CONSTRAINT UQ_ReservaOnlineVoucherUso_Pedido UNIQUE
    REFERENCES dbo.ReservaOnline(PedidoId),
  VoucherId INT NOT NULL REFERENCES dbo.Voucher(Id),
  ClienteId INT NOT NULL REFERENCES dbo.Cliente(Id),
  DescontoCentavos INT NOT NULL CHECK (DescontoCentavos >= 0),
  ValidadeEm DATETIME2(0) NOT NULL,
  Estado VARCHAR(24) NOT NULL CHECK (Estado IN ('reservado', 'consumido', 'liberado', 'reembolso_pendente')),
  CriadoEm DATETIME2(0) NOT NULL DEFAULT SYSDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReservaOnlineVoucherUso_VoucherEstado')
  CREATE INDEX IX_ReservaOnlineVoucherUso_VoucherEstado
    ON dbo.ReservaOnlineVoucherUso (VoucherId, Estado, ClienteId);
