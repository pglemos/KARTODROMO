-- Reserva em grupo (painel web / agenda): cada piloto do grupo com nome, WhatsApp e link de cadastro próprio,
-- e o pagamento de cada um (responsável paga tudo, cada um paga o seu, ou sinal + resto na recepção).
-- As vagas continuam sendo dbo.Inscricao (uma por piloto, no nome do responsável até a pessoa se cadastrar),
-- então Recepção, totem, site e cronometragem enxergam a reserva sem mudar nada.

IF OBJECT_ID('dbo.ReservaGrupo') IS NULL
CREATE TABLE dbo.ReservaGrupo (
  Id             INT IDENTITY(1,1) PRIMARY KEY,
  Codigo         VARCHAR(12)   NOT NULL,
  BateriaId      INT           NOT NULL REFERENCES dbo.Bateria(Id),
  ResponsavelId  INT           NOT NULL REFERENCES dbo.Cliente(Id),
  Origem         VARCHAR(12)   NOT NULL DEFAULT 'recepcao',   -- recepcao | whatsapp | telefone | site
  Modo           VARCHAR(12)   NOT NULL DEFAULT 'individual', -- unico | individual | sinal
  PrecoCentavos  INT           NOT NULL,
  SinalPct       INT           NOT NULL DEFAULT 30,
  Observacao     NVARCHAR(400) NULL,
  Status         VARCHAR(12)   NOT NULL DEFAULT 'ativa',      -- ativa | cancelada
  CriadoPor      INT           NULL,
  CriadoEm       DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
  AtualizadoEm   DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_ReservaGrupo_Codigo')
  CREATE UNIQUE INDEX UX_ReservaGrupo_Codigo ON dbo.ReservaGrupo(Codigo);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReservaGrupo_Bateria')
  CREATE INDEX IX_ReservaGrupo_Bateria ON dbo.ReservaGrupo(BateriaId);
GO

IF OBJECT_ID('dbo.ReservaGrupoPiloto') IS NULL
CREATE TABLE dbo.ReservaGrupoPiloto (
  Id             INT IDENTITY(1,1) PRIMARY KEY,
  GrupoId        INT           NOT NULL REFERENCES dbo.ReservaGrupo(Id),
  Ordem          INT           NOT NULL,
  Nome           NVARCHAR(120) NULL,
  Telefone       VARCHAR(30)   NULL,
  Menor          BIT           NOT NULL DEFAULT 0,
  Responsavel    BIT           NOT NULL DEFAULT 0,
  ClienteId      INT           NULL REFERENCES dbo.Cliente(Id),   -- preenchido quando a pessoa faz o cadastro pelo link
  InscricaoId    INT           NULL REFERENCES dbo.Inscricao(Id), -- a vaga dela na bateria
  Token          VARCHAR(24)   NOT NULL,                          -- link de cadastro: cadastro.kartodromodebetim.com.br/?r=TOKEN
  PagoPeloGrupo  BIT           NOT NULL DEFAULT 0,                -- a Inscricao foi marcada paga por este painel
  LinkEnviadoEm  DATETIME2     NULL,
  CadastroEm     DATETIME2     NULL,
  CriadoEm       DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_ReservaGrupoPiloto_Token')
  CREATE UNIQUE INDEX UX_ReservaGrupoPiloto_Token ON dbo.ReservaGrupoPiloto(Token);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReservaGrupoPiloto_Grupo')
  CREATE INDEX IX_ReservaGrupoPiloto_Grupo ON dbo.ReservaGrupoPiloto(GrupoId);
GO

IF OBJECT_ID('dbo.ReservaGrupoPagamento') IS NULL
CREATE TABLE dbo.ReservaGrupoPagamento (
  Id             INT IDENTITY(1,1) PRIMARY KEY,
  GrupoId        INT           NOT NULL REFERENCES dbo.ReservaGrupo(Id),
  PilotoId       INT           NULL REFERENCES dbo.ReservaGrupoPiloto(Id), -- NULL = pago pelo grupo (responsável)
  ValorCentavos  INT           NOT NULL,
  Forma          NVARCHAR(40)  NOT NULL,
  Origem         VARCHAR(12)   NOT NULL DEFAULT 'manual',  -- manual | asaas
  AsaasId        VARCHAR(40)   NULL,
  UsuarioId      INT           NULL,
  Cancelado      BIT           NOT NULL DEFAULT 0,
  CriadoEm       DATETIME2     NOT NULL DEFAULT SYSDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReservaGrupoPagamento_Grupo')
  CREATE INDEX IX_ReservaGrupoPagamento_Grupo ON dbo.ReservaGrupoPagamento(GrupoId);
GO

-- Cobranças Asaas por piloto ou do grupo (link de pagamento). O SRVKART cria pelo worker do site e confere a situação.
IF OBJECT_ID('dbo.ReservaGrupoCobranca') IS NULL
CREATE TABLE dbo.ReservaGrupoCobranca (
  Id             INT IDENTITY(1,1) PRIMARY KEY,
  GrupoId        INT           NOT NULL REFERENCES dbo.ReservaGrupo(Id),
  PilotoId       INT           NULL REFERENCES dbo.ReservaGrupoPiloto(Id),
  ValorCentavos  INT           NOT NULL,
  AsaasId        VARCHAR(40)   NOT NULL,
  Link           VARCHAR(300)  NOT NULL,
  Status         VARCHAR(20)   NOT NULL DEFAULT 'aguardando',  -- aguardando | pago | cancelada | vencida
  CriadoEm       DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
  PagoEm         DATETIME2     NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReservaGrupoCobranca_Status')
  CREATE INDEX IX_ReservaGrupoCobranca_Status ON dbo.ReservaGrupoCobranca(Status);
GO
