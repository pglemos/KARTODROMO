-- Termo de responsabilidade aceito online (pré-cadastro / link do grupo): versão do texto, quando e se autoriza uso de imagem.
-- A assinatura impressa na recepção continua valendo (Inscricao.TermoImpressoEm); este aceite adianta a fila e aparece no painel do grupo.
IF OBJECT_ID('dbo.ClienteTermoAceite') IS NULL
CREATE TABLE dbo.ClienteTermoAceite (
  Id             INT IDENTITY(1,1) PRIMARY KEY,
  ClienteId      INT          NOT NULL REFERENCES dbo.Cliente(Id),
  Versao         VARCHAR(16)  NOT NULL,
  AceitoEm       DATETIME2    NOT NULL,
  AutorizaImagem BIT          NOT NULL DEFAULT 1,
  Origem         VARCHAR(12)  NOT NULL DEFAULT 'site',
  Ip             VARCHAR(45)  NULL,
  CriadoEm       DATETIME2    NOT NULL DEFAULT SYSDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ClienteTermoAceite_Cliente')
  CREATE INDEX IX_ClienteTermoAceite_Cliente ON dbo.ClienteTermoAceite(ClienteId, AceitoEm DESC);
GO
