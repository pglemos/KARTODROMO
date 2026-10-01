-- Reserva online (reservas.kartodromodebetim.com.br, pagamento Asaas): um pedido do site = N vagas numa bateria,
-- seguradas por 15 min até o Pix/cartão ser confirmado. As vagas são linhas normais de dbo.Inscricao (Origem 'site');
-- aqui fica o pedido em si: quem comprou, quanto, como pagou e o código da cobrança na Asaas.
IF OBJECT_ID('dbo.ReservaOnline') IS NULL
CREATE TABLE dbo.ReservaOnline (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  PedidoId VARCHAR(40) NOT NULL CONSTRAINT UQ_ReservaOnline_Pedido UNIQUE,  -- id do pedido no site
  Codigo VARCHAR(10) NOT NULL,                                              -- mostrado ao cliente (ex.: K7M2QX)
  ClienteId INT NOT NULL CONSTRAINT FK_ReservaOnline_Cliente REFERENCES dbo.Cliente(Id),
  BateriaId INT NOT NULL CONSTRAINT FK_ReservaOnline_Bateria REFERENCES dbo.Bateria(Id),
  Quantidade INT NOT NULL,
  ValorCentavos INT NOT NULL,
  Status VARCHAR(20) NOT NULL,              -- aguardando | pago | expirado | pago_sem_vaga | cancelado
  Forma VARCHAR(10) NULL,                   -- pix | cartao
  AsaasPagamentoId VARCHAR(40) NULL,
  InscricaoIds VARCHAR(400) NOT NULL,       -- ids de dbo.Inscricao separados por vírgula
  Pilotos NVARCHAR(600) NULL,               -- nomes informados pelo comprador (opcional)
  CriadoEm DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
  ExpiraEm DATETIME2(0) NOT NULL,
  PagoEm DATETIME2(0) NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReservaOnline_Status')
  CREATE INDEX IX_ReservaOnline_Status ON dbo.ReservaOnline (Status, ExpiraEm);
