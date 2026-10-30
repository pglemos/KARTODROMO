-- Equipe organizadora -> ate sete inscricoes de kart -> pilotos.
-- EnduranceEquipe continua sendo a inscricao competidora; Kart fisico fica nas trocas/sorteios.
IF OBJECT_ID('dbo.EnduranceGrupo') IS NULL
BEGIN
  CREATE TABLE dbo.EnduranceGrupo (
    Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    EventoId INT NOT NULL REFERENCES dbo.EnduranceEvento(Id),
    Nome NVARCHAR(80) NOT NULL,
    CriadoEm DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT UX_EnduranceGrupo_Nome UNIQUE (EventoId,Nome),
    CONSTRAINT UX_EnduranceGrupo_Evento UNIQUE (Id,EventoId)
  );
END;
GO
IF COL_LENGTH('dbo.EnduranceEquipe','GrupoId') IS NULL
  ALTER TABLE dbo.EnduranceEquipe ADD GrupoId INT NULL;
IF COL_LENGTH('dbo.EnduranceEquipe','InscricaoOrdem') IS NULL
  ALTER TABLE dbo.EnduranceEquipe ADD InscricaoOrdem TINYINT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_EnduranceEquipe_Grupo')
  ALTER TABLE dbo.EnduranceEquipe ADD CONSTRAINT FK_EnduranceEquipe_Grupo
    FOREIGN KEY (GrupoId,EventoId) REFERENCES dbo.EnduranceGrupo(Id,EventoId);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_EnduranceEquipe_InscricaoOrdem')
  ALTER TABLE dbo.EnduranceEquipe ADD CONSTRAINT CK_EnduranceEquipe_InscricaoOrdem
    CHECK ((GrupoId IS NULL AND InscricaoOrdem IS NULL) OR
           (GrupoId IS NOT NULL AND InscricaoOrdem IS NOT NULL AND InscricaoOrdem BETWEEN 1 AND 7));
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_EnduranceEquipe_GrupoInscricao')
  CREATE UNIQUE INDEX UX_EnduranceEquipe_GrupoInscricao
    ON dbo.EnduranceEquipe(EventoId,GrupoId,InscricaoOrdem) WHERE GrupoId IS NOT NULL;
GO
