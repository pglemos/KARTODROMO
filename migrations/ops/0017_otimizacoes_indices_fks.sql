-- Migration 0017: Índices em Chaves Estrangeiras (FKs), Otimizações de Busca e Constraints de Integridade
-- Baseado na auditoria detalhada via skills: sql-optimization-patterns, database-schema-designer, sql-code-review

-- 1. Índices em Chaves Estrangeiras (evita Full Table Scans em Joins e Cascades)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Pagamento_Inscricao' AND object_id = OBJECT_ID('dbo.Pagamento'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Pagamento_Inscricao ON dbo.Pagamento(InscricaoId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Venda_Cliente' AND object_id = OBJECT_ID('dbo.Venda'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Venda_Cliente ON dbo.Venda(ClienteId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Venda_Movimento' AND object_id = OBJECT_ID('dbo.Venda'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Venda_Movimento ON dbo.Venda(MovimentoId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Venda_Terminal' AND object_id = OBJECT_ID('dbo.Venda'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Venda_Terminal ON dbo.Venda(TerminalId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Venda_Usuario' AND object_id = OBJECT_ID('dbo.Venda'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Venda_Usuario ON dbo.Venda(UsuarioId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VendaItem_Produto' AND object_id = OBJECT_ID('dbo.VendaItem'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_VendaItem_Produto ON dbo.VendaItem(ProdutoId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VendaPagamento_Forma' AND object_id = OBJECT_ID('dbo.VendaPagamento'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_VendaPagamento_Forma ON dbo.VendaPagamento(FormaPagamentoId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ClienteContato_Cliente' AND object_id = OBJECT_ID('dbo.ClienteContato'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_ClienteContato_Cliente ON dbo.ClienteContato(ClienteId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReservaOnline_Bateria' AND object_id = OBJECT_ID('dbo.ReservaOnline'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReservaOnline_Bateria ON dbo.ReservaOnline(BateriaId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReservaOnline_Cliente' AND object_id = OBJECT_ID('dbo.ReservaOnline'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReservaOnline_Cliente ON dbo.ReservaOnline(ClienteId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EndurancePiloto_Equipe' AND object_id = OBJECT_ID('dbo.EndurancePiloto'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_EndurancePiloto_Equipe ON dbo.EndurancePiloto(EquipeId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EndurancePiloto_Cliente' AND object_id = OBJECT_ID('dbo.EndurancePiloto'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_EndurancePiloto_Cliente ON dbo.EndurancePiloto(ClienteId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EnduranceTroca_Evento_Equipe' AND object_id = OBJECT_ID('dbo.EnduranceTroca'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_EnduranceTroca_Evento_Equipe ON dbo.EnduranceTroca(EventoId, EquipeId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EnduranceTroca_Piloto' AND object_id = OBJECT_ID('dbo.EnduranceTroca'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_EnduranceTroca_Piloto ON dbo.EnduranceTroca(PilotoId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EndurancePesagem_Evento_Piloto' AND object_id = OBJECT_ID('dbo.EndurancePesagem'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_EndurancePesagem_Evento_Piloto ON dbo.EndurancePesagem(EventoId, PilotoId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EndurancePesagem_Piloto' AND object_id = OBJECT_ID('dbo.EndurancePesagem'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_EndurancePesagem_Piloto ON dbo.EndurancePesagem(PilotoId);
END;
GO

-- 2. Constraints de Validação de Domínio (Integridade de Dados)
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Inscricao_Status' AND parent_object_id = OBJECT_ID('dbo.Inscricao'))
BEGIN
    ALTER TABLE dbo.Inscricao ADD CONSTRAINT CK_Inscricao_Status 
    CHECK (Status IN ('reservada', 'confirmada', 'cancelada'));
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Bateria_Status' AND parent_object_id = OBJECT_ID('dbo.Bateria'))
BEGIN
    ALTER TABLE dbo.Bateria ADD CONSTRAINT CK_Bateria_Status 
    CHECK (Status IN ('aberta', 'fechada', 'cancelada'));
END;
GO
