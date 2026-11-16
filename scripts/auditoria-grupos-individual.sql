-- Auditoria e correção de pagamentos rateados indevidamente no modo "individual"
-- Executar no SQL Server KartodromoOps (SRVKART). Por padrão só diagnostica (@AplicarCorrecao = 0).

-- 1. Raio-X completo da reserva G6FFF18E
SELECT g.Id GrupoId, g.Codigo, g.Modo, g.PrecoCentavos, g.Aniversario, b.Inicio, b.Nome Bateria,
       pg.Id PagamentoId, pg.PilotoId, p.Ordem PilotoOrdem, COALESCE(c.Nome, p.Nome) PilotoNome,
       pg.ValorCentavos, pg.Forma, pg.Origem, pg.AsaasId, pg.Cancelado, pg.CriadoEm
  FROM dbo.ReservaGrupo g
  JOIN dbo.Bateria b ON b.Id = g.BateriaId
  LEFT JOIN dbo.ReservaGrupoPagamento pg ON pg.GrupoId = g.Id
  LEFT JOIN dbo.ReservaGrupoPiloto p ON p.Id = pg.PilotoId
  LEFT JOIN dbo.Cliente c ON c.Id = p.ClienteId
 WHERE g.Codigo = 'G6FFF18E'
 ORDER BY pg.Id;

-- 2. Todas as outras reservas "individual" no histórico com pagamento sem piloto ou valor quebrado
SELECT g.Id GrupoId, g.Codigo, b.Inicio, b.Nome Bateria, g.PrecoCentavos,
       pg.Id PagamentoId, pg.PilotoId, pg.ValorCentavos, pg.Forma, pg.Origem, pg.AsaasId, pg.CriadoEm
  FROM dbo.ReservaGrupo g
  JOIN dbo.Bateria b ON b.Id = g.BateriaId
  JOIN dbo.ReservaGrupoPagamento pg ON pg.GrupoId = g.Id AND pg.Cancelado = 0
 WHERE g.Modo = 'individual'
   AND (pg.PilotoId IS NULL OR (pg.ValorCentavos % 10 <> 0 AND pg.Origem = 'manual'))
 ORDER BY b.Inicio DESC, g.Id, pg.Id;

-- 3. Correção idempotente aplicada em 16/11/2026 (troque @AplicarCorrecao = 1 para executar)
DECLARE @AplicarCorrecao BIT = 0;

IF @AplicarCorrecao = 1
BEGIN
  SET XACT_ABORT ON;
  BEGIN TRAN;

  -- Grupo 88 (G6FFF18E): cancelar lançamento sem piloto (43), duplicatas de Asaas (40, 47) e vagas canceladas (36, 52, 359)
  UPDATE dbo.ReservaGrupoPagamento
     SET Cancelado = 1
   WHERE GrupoId = 88 AND Origem = 'manual' AND Cancelado = 0 AND Id IN (36, 40, 43, 47, 52, 359);

  -- Corrigir valores quebrados (14091, 14071, 14000, 13971) nas 8 vagas ativas para 14500
  UPDATE dbo.ReservaGrupoPagamento
     SET ValorCentavos = 14500
   WHERE GrupoId = 88 AND Origem = 'manual' AND Cancelado = 0 AND Id IN (46, 48, 49, 852, 853, 854, 855, 856);

  UPDATE i
     SET Pago = 1, ValorCentavos = 14500, PrecoCentavos = 14500, Status = 'confirmada', AtualizadoEm = SYSDATETIME()
    FROM dbo.Inscricao i
    JOIN dbo.ReservaGrupoPiloto p ON p.InscricaoId = i.Id
   WHERE p.GrupoId = 88 AND i.Status <> 'cancelada' AND i.VendaId IS NULL;

  UPDATE p
     SET PagoPeloGrupo = 1
    FROM dbo.ReservaGrupoPiloto p
    JOIN dbo.Inscricao i ON i.Id = p.InscricaoId
   WHERE p.GrupoId = 88 AND i.Status <> 'cancelada' AND i.VendaId IS NULL;

  -- Grupo 248 (GD626C77): desmembrar pagamento 547 (29000 sem piloto) para pilotos 2811 e 2812
  IF EXISTS (SELECT 1 FROM dbo.ReservaGrupoPagamento WHERE Id = 547 AND GrupoId = 248 AND Cancelado = 0 AND PilotoId IS NULL AND ValorCentavos = 29000)
  BEGIN
    UPDATE dbo.ReservaGrupoPagamento SET PilotoId = 2811, ValorCentavos = 14500 WHERE Id = 547 AND GrupoId = 248 AND Cancelado = 0;
    IF NOT EXISTS (SELECT 1 FROM dbo.ReservaGrupoPagamento WHERE GrupoId = 248 AND PilotoId = 2812 AND Cancelado = 0)
      INSERT INTO dbo.ReservaGrupoPagamento (GrupoId, PilotoId, ValorCentavos, Forma, Origem, UsuarioId)
      SELECT GrupoId, 2812, 14500, Forma, Origem, UsuarioId FROM dbo.ReservaGrupoPagamento WHERE Id = 547;
  END;
  UPDATE i
     SET Pago = 1, ValorCentavos = 14500, PrecoCentavos = 14500, Status = 'confirmada', AtualizadoEm = SYSDATETIME()
    FROM dbo.Inscricao i JOIN dbo.ReservaGrupoPiloto p ON p.InscricaoId = i.Id
   WHERE p.GrupoId = 248 AND p.Id IN (2811, 2812) AND i.Status <> 'cancelada' AND i.VendaId IS NULL;
  UPDATE dbo.ReservaGrupoPiloto SET PagoPeloGrupo = 1 WHERE GrupoId = 248 AND Id IN (2811, 2812);

  -- Grupo 101 (G975BF1D): vincular 204 -> 1147 e desmembrar 114 (29000) -> 1148 e 1149
  UPDATE dbo.ReservaGrupoPagamento SET PilotoId = 1147 WHERE Id = 204 AND GrupoId = 101 AND Cancelado = 0 AND PilotoId IS NULL AND ValorCentavos = 14500;
  IF EXISTS (SELECT 1 FROM dbo.ReservaGrupoPagamento WHERE Id = 114 AND GrupoId = 101 AND Cancelado = 0 AND PilotoId IS NULL AND ValorCentavos = 29000)
  BEGIN
    UPDATE dbo.ReservaGrupoPagamento SET PilotoId = 1148, ValorCentavos = 14500 WHERE Id = 114 AND GrupoId = 101 AND Cancelado = 0;
    IF NOT EXISTS (SELECT 1 FROM dbo.ReservaGrupoPagamento WHERE GrupoId = 101 AND PilotoId = 1149 AND Cancelado = 0)
      INSERT INTO dbo.ReservaGrupoPagamento (GrupoId, PilotoId, ValorCentavos, Forma, Origem, UsuarioId)
      SELECT GrupoId, 1149, 14500, Forma, Origem, UsuarioId FROM dbo.ReservaGrupoPagamento WHERE Id = 114;
  END;
  UPDATE i
     SET Pago = 1, ValorCentavos = 14500, PrecoCentavos = 14500, Status = 'confirmada', AtualizadoEm = SYSDATETIME()
    FROM dbo.Inscricao i JOIN dbo.ReservaGrupoPiloto p ON p.InscricaoId = i.Id
   WHERE p.GrupoId = 101 AND p.Id IN (1147, 1148, 1149) AND i.Status <> 'cancelada' AND i.VendaId IS NULL;
  UPDATE dbo.ReservaGrupoPiloto SET PagoPeloGrupo = 1 WHERE GrupoId = 101 AND Id IN (1147, 1148, 1149);

  -- Grupo 338 (G1819936): ajustar preço 14499 -> 14500
  UPDATE dbo.ReservaGrupo SET PrecoCentavos = 14500, AtualizadoEm = SYSDATETIME() WHERE Id = 338 AND PrecoCentavos = 14499;
  UPDATE i SET PrecoCentavos = 14500, AtualizadoEm = SYSDATETIME()
    FROM dbo.Inscricao i JOIN dbo.ReservaGrupoPiloto p ON p.InscricaoId = i.Id
   WHERE p.GrupoId = 338 AND i.PrecoCentavos = 14499;

  COMMIT TRAN;
END;
