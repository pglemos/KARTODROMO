-- Endurance (100 Milhas e afins): equipes, pilotos com número de pulseira, pesagens, filas do sorteio do box,
-- trocas de piloto/kart e punições do regulamento. As voltas e as paradas vêm da cronometragem (ORBITS);
-- aqui fica só o que não passa pelo decoder.

IF OBJECT_ID('dbo.EnduranceEvento') IS NULL
CREATE TABLE dbo.EnduranceEvento (
  Id              INT IDENTITY(1,1) PRIMARY KEY,
  Nome            NVARCHAR(120) NOT NULL,
  Data            DATE          NULL,
  BateriaId       INT           NULL,               -- bateria da agenda: o totem mostra o evento quando o piloto escolhe ela
  SessaoCrono     VARCHAR(80)   NULL,               -- id da corrida na cronometragem (voltas e paradas)
  SessaoTomada    VARCHAR(80)   NULL,               -- id da tomada de tempo (grid)
  Regras          NVARCHAR(MAX) NULL,               -- JSON com os números do regulamento (peso, paradas, janela do box…)
  Segredo         VARCHAR(40)   NOT NULL,           -- assina os links dos chefes de equipe
  Ativo           BIT           NOT NULL DEFAULT 1,
  CriadoEm        DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);
GO

IF OBJECT_ID('dbo.EnduranceEquipe') IS NULL
CREATE TABLE dbo.EnduranceEquipe (
  Id              INT IDENTITY(1,1) PRIMARY KEY,
  EventoId        INT           NOT NULL REFERENCES dbo.EnduranceEvento(Id),
  Nome            NVARCHAR(80)  NOT NULL,
  Numero          VARCHAR(10)   NOT NULL,           -- número da placa: é o "kart" da equipe na cronometragem
  Transponder     VARCHAR(12)   NULL,               -- sensor da equipe (passa de kart em kart junto com a placa)
  ChefeNome       NVARCHAR(120) NULL,
  ChefeTelefone   VARCHAR(20)   NULL,
  Pago            BIT           NOT NULL DEFAULT 0,
  Desclassificada BIT           NOT NULL DEFAULT 0,
  Obs             NVARCHAR(400) NULL,
  CriadoEm        DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_EnduranceEquipe_Numero')
  CREATE UNIQUE INDEX UX_EnduranceEquipe_Numero ON dbo.EnduranceEquipe(EventoId, Numero);
GO

IF OBJECT_ID('dbo.EndurancePiloto') IS NULL
CREATE TABLE dbo.EndurancePiloto (
  Id              INT IDENTITY(1,1) PRIMARY KEY,
  EventoId        INT           NOT NULL REFERENCES dbo.EnduranceEvento(Id),
  EquipeId        INT           NOT NULL REFERENCES dbo.EnduranceEquipe(Id),
  ClienteId       INT           NULL REFERENCES dbo.Cliente(Id),
  Nome            NVARCHAR(120) NOT NULL,
  Pulseira        INT           NOT NULL,           -- número único no evento (o piloto fala só o número na balança)
  PesoKg          DECIMAL(6,2)  NULL,               -- peso do piloto equipado, sem lastro (pesagem inicial)
  LastroKg        DECIMAL(6,2)  NULL,               -- lastro que ele leva
  Chefe           BIT           NOT NULL DEFAULT 0,
  Origem          VARCHAR(12)   NOT NULL DEFAULT 'admin',   -- totem | admin | importado
  Ativo           BIT           NOT NULL DEFAULT 1,
  CriadoEm        DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_EndurancePiloto_Pulseira')
  CREATE UNIQUE INDEX UX_EndurancePiloto_Pulseira ON dbo.EndurancePiloto(EventoId, Pulseira);
GO

IF OBJECT_ID('dbo.EndurancePesagem') IS NULL
CREATE TABLE dbo.EndurancePesagem (
  Id              INT IDENTITY(1,1) PRIMARY KEY,
  EventoId        INT           NOT NULL REFERENCES dbo.EnduranceEvento(Id),
  PilotoId        INT           NOT NULL REFERENCES dbo.EndurancePiloto(Id),
  Momento         VARCHAR(10)   NOT NULL,           -- inicial | parada | final
  BalancaKg       DECIMAL(6,2)  NOT NULL,           -- o que a balança mostrou (piloto equipado + lastro na conferência)
  LastroKg        DECIMAL(6,2)  NULL,
  TotalKg         DECIMAL(6,2)  NOT NULL,
  Resultado       VARCHAR(12)   NOT NULL,           -- ok | punicao | dq
  PunicaoSeg      INT           NOT NULL DEFAULT 0,
  Usuario         NVARCHAR(60)  NULL,
  Obs             NVARCHAR(300) NULL,
  Em              DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
  EmMs            BIGINT        NOT NULL
);
GO

IF OBJECT_ID('dbo.EnduranceFila') IS NULL
CREATE TABLE dbo.EnduranceFila (
  Id              INT IDENTITY(1,1) PRIMARY KEY,
  EventoId        INT           NOT NULL REFERENCES dbo.EnduranceEvento(Id),
  Kart            VARCHAR(10)   NOT NULL,           -- kart físico (light da locação)
  Fileira         INT           NULL,               -- 1..4 quando está na fila do box
  Ordem           FLOAT         NULL,
  Situacao        VARCHAR(10)   NOT NULL DEFAULT 'fila',   -- fila | pista | fora (retirado do sorteio)
  EquipeId        INT           NULL,               -- equipe que está com ele na pista
  Obs             NVARCHAR(200) NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_EnduranceFila_Kart')
  CREATE UNIQUE INDEX UX_EnduranceFila_Kart ON dbo.EnduranceFila(EventoId, Kart);
GO

IF OBJECT_ID('dbo.EnduranceTroca') IS NULL
CREATE TABLE dbo.EnduranceTroca (
  Id              INT IDENTITY(1,1) PRIMARY KEY,
  EventoId        INT           NOT NULL REFERENCES dbo.EnduranceEvento(Id),
  EquipeId        INT           NOT NULL REFERENCES dbo.EnduranceEquipe(Id),
  PilotoId        INT           NULL REFERENCES dbo.EndurancePiloto(Id),
  Kart            VARCHAR(10)   NULL,
  KartDevolvido   VARCHAR(10)   NULL,
  Fileira         INT           NULL,               -- bolinha sorteada
  Tipo            VARCHAR(12)   NOT NULL,           -- largada | parada | quebra | mecanica | correcao
  Usuario         NVARCHAR(60)  NULL,
  Obs             NVARCHAR(300) NULL,
  Cancelada       BIT           NOT NULL DEFAULT 0,
  Em              DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
  EmMs            BIGINT        NOT NULL
);
GO

IF OBJECT_ID('dbo.EndurancePunicao') IS NULL
CREATE TABLE dbo.EndurancePunicao (
  Id              INT IDENTITY(1,1) PRIMARY KEY,
  EventoId        INT           NOT NULL REFERENCES dbo.EnduranceEvento(Id),
  EquipeId        INT           NOT NULL REFERENCES dbo.EnduranceEquipe(Id),
  Tipo            VARCHAR(12)   NOT NULL,           -- segundos | voltas | advertencia | dq
  Valor           INT           NOT NULL DEFAULT 0,
  Motivo          NVARCHAR(300) NOT NULL,
  Origem          VARCHAR(12)   NOT NULL DEFAULT 'direcao', -- direcao | pesagem
  PesagemId       INT           NULL,
  Usuario         NVARCHAR(60)  NULL,
  Cancelada       BIT           NOT NULL DEFAULT 0,
  Em              DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);
GO

-- correção do fiscal numa parada que o decoder achou (quebra, entrou pela pista errada, não era parada…)
IF OBJECT_ID('dbo.EnduranceParadaAjuste') IS NULL
CREATE TABLE dbo.EnduranceParadaAjuste (
  Id              INT IDENTITY(1,1) PRIMARY KEY,
  EventoId        INT           NOT NULL REFERENCES dbo.EnduranceEvento(Id),
  EquipeId        INT           NOT NULL REFERENCES dbo.EnduranceEquipe(Id),
  Volta           INT           NOT NULL,
  Acao            VARCHAR(12)   NOT NULL,           -- quebra | invalidar | ignorar | validar
  Usuario         NVARCHAR(60)  NULL,
  Em              DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_EnduranceParadaAjuste')
  CREATE UNIQUE INDEX UX_EnduranceParadaAjuste ON dbo.EnduranceParadaAjuste(EventoId, EquipeId, Volta);
GO
