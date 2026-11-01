-- Um piloto e uma pulseira; varias inscricoes da mesma familia.
IF OBJECT_ID('dbo.EndurancePilotoEquipe') IS NULL
CREATE TABLE dbo.EndurancePilotoEquipe (
  PilotoId INT NOT NULL REFERENCES dbo.EndurancePiloto(Id),
  EquipeId INT NOT NULL REFERENCES dbo.EnduranceEquipe(Id),
  CriadoEm DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  CONSTRAINT PK_EndurancePilotoEquipe PRIMARY KEY(PilotoId,EquipeId)
);
GO
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.EndurancePilotoEquipe') AND name='IX_EndurancePilotoEquipe_Equipe')
CREATE INDEX IX_EndurancePilotoEquipe_Equipe ON dbo.EndurancePilotoEquipe(EquipeId,PilotoId);
GO
IF OBJECT_ID('dbo.EndurancePilotoInscricao') IS NULL
EXEC(N'CREATE VIEW dbo.EndurancePilotoInscricao AS
 SELECT p.Id,p.EventoId,v.EquipeId,p.ClienteId,p.Nome,p.Pulseira,p.PesoKg,p.LastroKg,p.Chefe,p.Origem,p.Ativo,p.CriadoEm
 FROM dbo.EndurancePiloto p
 CROSS APPLY(SELECT p.EquipeId UNION SELECT pe.EquipeId FROM dbo.EndurancePilotoEquipe pe WHERE pe.PilotoId=p.Id) v');
GO
