-- Migration 0018: Cobertura Completa de FKs, Otimização do Totem e Constraints de Range
-- Baseado na auditoria detalhada via skills: sql-optimization-patterns, database-schema-designer, sql-code-review

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- 1. Índice Coberto Filtrado de Alta Performance para o Totem
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Bateria_Totem_Ativas' AND object_id = OBJECT_ID('dbo.Bateria'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Bateria_Totem_Ativas
    ON dbo.Bateria (Inicio)
    INCLUDE (Nome, Vagas, TipoKart)
    WHERE Status = 'aberta' AND AutoAtendimento = 1 AND ReservaFechada = 0;
END;
GO

-- 2. Índices de Cobertura para Todas as Chaves Estrangeiras Remanescentes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Bateria_Produto' AND object_id = OBJECT_ID('dbo.Bateria'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Bateria_Produto ON dbo.Bateria(ProdutoId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Bateria_Responsavel' AND object_id = OBJECT_ID('dbo.Bateria'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Bateria_Responsavel ON dbo.Bateria(ResponsavelId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Bateria_Tracado' AND object_id = OBJECT_ID('dbo.Bateria'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Bateria_Tracado ON dbo.Bateria(TracadoId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Inscricao_Produto' AND object_id = OBJECT_ID('dbo.Inscricao'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Inscricao_Produto ON dbo.Inscricao(ProdutoId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Inscricao_Responsavel' AND object_id = OBJECT_ID('dbo.Inscricao'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Inscricao_Responsavel ON dbo.Inscricao(ResponsavelId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Cliente_LgpdMenorResp' AND object_id = OBJECT_ID('dbo.Cliente'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Cliente_LgpdMenorResp ON dbo.Cliente(LgpdMenorResponsavelId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Manutencao_Item' AND object_id = OBJECT_ID('dbo.Manutencao'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Manutencao_Item ON dbo.Manutencao(ItemId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Movimento_Turno' AND object_id = OBJECT_ID('dbo.Movimento'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Movimento_Turno ON dbo.Movimento(TurnoId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Movimento_Usuario' AND object_id = OBJECT_ID('dbo.Movimento'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Movimento_Usuario ON dbo.Movimento(UsuarioId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MovimentoTransacao_Movimento' AND object_id = OBJECT_ID('dbo.MovimentoTransacao'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_MovimentoTransacao_Movimento ON dbo.MovimentoTransacao(MovimentoId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MovimentoTransacao_Usuario' AND object_id = OBJECT_ID('dbo.MovimentoTransacao'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_MovimentoTransacao_Usuario ON dbo.MovimentoTransacao(UsuarioId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PadraoReserva_Produto' AND object_id = OBJECT_ID('dbo.PadraoReserva'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_PadraoReserva_Produto ON dbo.PadraoReserva(ProdutoId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PadraoReserva_Tracado' AND object_id = OBJECT_ID('dbo.PadraoReserva'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_PadraoReserva_Tracado ON dbo.PadraoReserva(TracadoId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ProdutoProva_Produto' AND object_id = OBJECT_ID('dbo.ProdutoProva'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_ProdutoProva_Produto ON dbo.ProdutoProva(ProdutoId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReservaGrupo_Responsavel' AND object_id = OBJECT_ID('dbo.ReservaGrupo'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReservaGrupo_Responsavel ON dbo.ReservaGrupo(ResponsavelId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReservaGrupoCobranca_Grupo' AND object_id = OBJECT_ID('dbo.ReservaGrupoCobranca'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReservaGrupoCobranca_Grupo ON dbo.ReservaGrupoCobranca(GrupoId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReservaGrupoCobranca_Piloto' AND object_id = OBJECT_ID('dbo.ReservaGrupoCobranca'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReservaGrupoCobranca_Piloto ON dbo.ReservaGrupoCobranca(PilotoId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReservaGrupoPagamento_Piloto' AND object_id = OBJECT_ID('dbo.ReservaGrupoPagamento'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReservaGrupoPagamento_Piloto ON dbo.ReservaGrupoPagamento(PilotoId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReservaGrupoPiloto_Cliente' AND object_id = OBJECT_ID('dbo.ReservaGrupoPiloto'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReservaGrupoPiloto_Cliente ON dbo.ReservaGrupoPiloto(ClienteId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReservaGrupoPiloto_Inscricao' AND object_id = OBJECT_ID('dbo.ReservaGrupoPiloto'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReservaGrupoPiloto_Inscricao ON dbo.ReservaGrupoPiloto(InscricaoId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReservaOnlineVoucherUso_Cliente' AND object_id = OBJECT_ID('dbo.ReservaOnlineVoucherUso'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReservaOnlineVoucherUso_Cliente ON dbo.ReservaOnlineVoucherUso(ClienteId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Usuario_Perfil' AND object_id = OBJECT_ID('dbo.Usuario'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Usuario_Perfil ON dbo.Usuario(PerfilId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Voucher_Produto' AND object_id = OBJECT_ID('dbo.Voucher'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Voucher_Produto ON dbo.Voucher(ProdutoId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VoucherUso_Cliente' AND object_id = OBJECT_ID('dbo.VoucherUso'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_VoucherUso_Cliente ON dbo.VoucherUso(ClienteId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VoucherUso_Venda' AND object_id = OBJECT_ID('dbo.VoucherUso'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_VoucherUso_Venda ON dbo.VoucherUso(VendaId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VoucherUso_Voucher' AND object_id = OBJECT_ID('dbo.VoucherUso'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_VoucherUso_Voucher ON dbo.VoucherUso(VoucherId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EnduranceEquipe_GrupoId' AND object_id = OBJECT_ID('dbo.EnduranceEquipe'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_EnduranceEquipe_GrupoId ON dbo.EnduranceEquipe(GrupoId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EnduranceParadaAjuste_Equipe' AND object_id = OBJECT_ID('dbo.EnduranceParadaAjuste'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_EnduranceParadaAjuste_Equipe ON dbo.EnduranceParadaAjuste(EquipeId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EndurancePunicao_Equipe' AND object_id = OBJECT_ID('dbo.EndurancePunicao'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_EndurancePunicao_Equipe ON dbo.EndurancePunicao(EquipeId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EndurancePunicao_Evento' AND object_id = OBJECT_ID('dbo.EndurancePunicao'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_EndurancePunicao_Evento ON dbo.EndurancePunicao(EventoId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EnduranceTroca_Equipe' AND object_id = OBJECT_ID('dbo.EnduranceTroca'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_EnduranceTroca_Equipe ON dbo.EnduranceTroca(EquipeId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FidelidadeTransacao_Usuario' AND object_id = OBJECT_ID('dbo.FidelidadeTransacao'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_FidelidadeTransacao_Usuario ON dbo.FidelidadeTransacao(UsuarioId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ParceiroComissaoTransacao_Forma' AND object_id = OBJECT_ID('dbo.ParceiroComissaoTransacao'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_ParceiroComissaoTransacao_Forma ON dbo.ParceiroComissaoTransacao(FormaPagamentoId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ParceiroComissaoTransacao_Usuario' AND object_id = OBJECT_ID('dbo.ParceiroComissaoTransacao'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_ParceiroComissaoTransacao_Usuario ON dbo.ParceiroComissaoTransacao(UsuarioId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CampeonatoInscricaoCobranca_Inscricao' AND object_id = OBJECT_ID('dbo.CampeonatoInscricaoCobranca'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_CampeonatoInscricaoCobranca_Inscricao ON dbo.CampeonatoInscricaoCobranca(InscricaoId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CampeonatoInscricaoPagamento_Inscricao' AND object_id = OBJECT_ID('dbo.CampeonatoInscricaoPagamento'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_CampeonatoInscricaoPagamento_Inscricao ON dbo.CampeonatoInscricaoPagamento(InscricaoId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CampeonatoInscricaoPiloto_Inscricao' AND object_id = OBJECT_ID('dbo.CampeonatoInscricaoPiloto'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_CampeonatoInscricaoPiloto_Inscricao ON dbo.CampeonatoInscricaoPiloto(InscricaoId);
END;
GO

-- 3. Constraints de Integridade Numérica e Negócio
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Inscricao_Valores' AND parent_object_id = OBJECT_ID('dbo.Inscricao'))
BEGIN
    ALTER TABLE dbo.Inscricao ADD CONSTRAINT CK_Inscricao_Valores 
    CHECK ((PrecoCentavos IS NULL OR PrecoCentavos >= 0) AND (DescontoCentavos IS NULL OR DescontoCentavos >= 0));
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Bateria_Vagas' AND parent_object_id = OBJECT_ID('dbo.Bateria'))
BEGIN
    ALTER TABLE dbo.Bateria ADD CONSTRAINT CK_Bateria_Vagas 
    CHECK (Vagas > 0);
END;
GO
