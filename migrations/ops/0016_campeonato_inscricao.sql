-- Inscrição de equipes em campeonato pelo site (200 Milhas): equipe, pilotos, cobrança Asaas e pagamentos.
IF OBJECT_ID('dbo.CampeonatoInscricao') IS NULL
CREATE TABLE dbo.CampeonatoInscricao (
  Id int IDENTITY PRIMARY KEY,
  Evento varchar(40) NOT NULL,
  Protocolo varchar(20) NOT NULL UNIQUE,
  Token varchar(40) NOT NULL UNIQUE,
  Equipe nvarchar(100) NOT NULL,
  ChefeClienteId int NULL,
  ChefeNome nvarchar(150) NOT NULL,
  ChefeCpf varchar(11) NOT NULL,
  ChefeTelefone varchar(20) NOT NULL,
  ChefeEmail nvarchar(200) NOT NULL,
  Cidade nvarchar(100) NULL,
  Karts int NOT NULL,
  ValorCentavos int NOT NULL,
  Status varchar(20) NOT NULL DEFAULT 'ativa', -- ativa | cancelada
  Observacao nvarchar(1000) NULL,
  ObsInterna nvarchar(1000) NULL,
  AutorizaImagem bit NOT NULL DEFAULT 0,
  Origem varchar(20) NOT NULL DEFAULT 'site',
  CriadoEm datetime2 NOT NULL DEFAULT SYSDATETIME(),
  AtualizadoEm datetime2 NOT NULL DEFAULT SYSDATETIME()
);
IF OBJECT_ID('dbo.CampeonatoInscricaoPiloto') IS NULL
CREATE TABLE dbo.CampeonatoInscricaoPiloto (
  Id int IDENTITY PRIMARY KEY,
  InscricaoId int NOT NULL REFERENCES dbo.CampeonatoInscricao(Id),
  Kart int NOT NULL DEFAULT 1,
  ClienteId int NULL,
  Nome nvarchar(150) NOT NULL,
  Cpf varchar(11) NOT NULL,
  Nascimento date NOT NULL,
  Telefone varchar(20) NULL,
  Email nvarchar(200) NULL,
  AlturaCm int NULL,
  PesoKg decimal(5,1) NULL,
  Ativo bit NOT NULL DEFAULT 1
);
IF OBJECT_ID('dbo.CampeonatoInscricaoCobranca') IS NULL
CREATE TABLE dbo.CampeonatoInscricaoCobranca (
  Id int IDENTITY PRIMARY KEY,
  InscricaoId int NOT NULL REFERENCES dbo.CampeonatoInscricao(Id),
  ValorCentavos int NOT NULL,
  Forma varchar(10) NOT NULL,
  Parcelas int NOT NULL DEFAULT 1,
  AsaasId varchar(60) NOT NULL,
  Link varchar(400) NOT NULL,
  Status varchar(20) NOT NULL DEFAULT 'aguardando', -- aguardando | pago | vencida | cancelada
  CriadoEm datetime2 NOT NULL DEFAULT SYSDATETIME(),
  PagoEm datetime2 NULL
);
IF OBJECT_ID('dbo.CampeonatoInscricaoPagamento') IS NULL
CREATE TABLE dbo.CampeonatoInscricaoPagamento (
  Id int IDENTITY PRIMARY KEY,
  InscricaoId int NOT NULL REFERENCES dbo.CampeonatoInscricao(Id),
  ValorCentavos int NOT NULL,
  Forma nvarchar(60) NOT NULL,
  Origem varchar(10) NOT NULL, -- asaas | manual
  AsaasId varchar(60) NULL,
  UsuarioId int NULL,
  Observacao nvarchar(300) NULL,
  Em datetime2 NOT NULL DEFAULT SYSDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CampeonatoPiloto_Cpf')
  CREATE INDEX IX_CampeonatoPiloto_Cpf ON dbo.CampeonatoInscricaoPiloto (Cpf, Ativo);
