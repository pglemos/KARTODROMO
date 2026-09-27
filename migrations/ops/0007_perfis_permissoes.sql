-- Perfis de acesso e permissões (telas SegPerfil / Permissoes / SegUsuario do canvas).
-- Cada usuário tem um perfil; o perfil diz o que pode em cada funcionalidade de cada módulo.
IF OBJECT_ID('dbo.Perfil') IS NULL
CREATE TABLE dbo.Perfil (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Descricao NVARCHAR(60) NOT NULL UNIQUE,
  AcessoTotal BIT NOT NULL DEFAULT 0,
  Ativo BIT NOT NULL DEFAULT 1,
  CriadoEm DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO
IF OBJECT_ID('dbo.PerfilPermissao') IS NULL
CREATE TABLE dbo.PerfilPermissao (
  PerfilId INT NOT NULL CONSTRAINT FK_PerfilPermissao_Perfil REFERENCES dbo.Perfil(Id) ON DELETE CASCADE,
  Modulo VARCHAR(30) NOT NULL,
  Funcao VARCHAR(60) NOT NULL,
  Acessar BIT NOT NULL DEFAULT 0,
  Incluir BIT NOT NULL DEFAULT 0,
  Alterar BIT NOT NULL DEFAULT 0,
  Excluir BIT NOT NULL DEFAULT 0,
  Exportar BIT NOT NULL DEFAULT 0,
  Importar BIT NOT NULL DEFAULT 0,
  CONSTRAINT PK_PerfilPermissao PRIMARY KEY (PerfilId, Modulo, Funcao)
);
GO
IF COL_LENGTH('dbo.Usuario', 'PerfilId') IS NULL
  ALTER TABLE dbo.Usuario ADD PerfilId INT NULL CONSTRAINT FK_Usuario_Perfil REFERENCES dbo.Perfil(Id);
GO
IF NOT EXISTS (SELECT 1 FROM dbo.Perfil WHERE Descricao = N'Administrador') INSERT INTO dbo.Perfil (Descricao, AcessoTotal) VALUES (N'Administrador', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.Perfil WHERE Descricao = N'Recepção') INSERT INTO dbo.Perfil (Descricao, AcessoTotal) VALUES (N'Recepção', 0);
IF NOT EXISTS (SELECT 1 FROM dbo.Perfil WHERE Descricao = N'Cronometragem') INSERT INTO dbo.Perfil (Descricao, AcessoTotal) VALUES (N'Cronometragem', 0);
GO
UPDATE dbo.Usuario SET PerfilId = (SELECT Id FROM dbo.Perfil WHERE Descricao = N'Administrador') WHERE PerfilId IS NULL AND Admin = 1;
UPDATE dbo.Usuario SET PerfilId = (SELECT Id FROM dbo.Perfil WHERE Descricao = N'Recepção') WHERE PerfilId IS NULL AND Admin = 0;
GO
