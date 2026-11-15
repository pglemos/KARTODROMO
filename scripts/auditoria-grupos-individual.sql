-- Auditoria e correção de pagamentos rateados indevidamente no modo "individual"
-- Executar no SQL Server KartodromoOps (SRVKART). Por padrão só diagnostica (@AplicarCorrecaoG6FFF18E = 0).

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

-- 3. Correção segura de G6FFF18E (troque @AplicarCorrecao = 1 somente após conferir o Raio-X acima)
--    Regra:
--      - Para pagamentos manuais com valor fracionário gerado pelo rateio antigo (ex.: 14091, 14026, 14000),
--        ajusta para g.PrecoCentavos (14500) caso representem 1 vaga inteira quitada no balcão, OU estorna duplicatas.
--      - Nunca apaga linhas nem altera pagamentos Origem = 'asaas'.
DECLARE @AplicarCorrecao BIT = 0;

IF @AplicarCorrecao = 1
BEGIN
  BEGIN TRAN;
  SELECT pg.Id, pg.PilotoId, pg.ValorCentavos, pg.Forma, pg.Origem, pg.CriadoEm
    FROM dbo.ReservaGrupoPagamento pg
    JOIN dbo.ReservaGrupo g ON g.Id = pg.GrupoId
   WHERE g.Codigo = 'G6FFF18E' AND pg.Cancelado = 0;
  -- Exemplo após conferência:
  -- UPDATE dbo.ReservaGrupoPagamento SET Cancelado = 1 WHERE Id = <ID_DO_LANCAMENTO_INDEVIDO_SEM_PILOTO> AND Origem = 'manual';
  -- UPDATE dbo.ReservaGrupoPagamento SET ValorCentavos = 14500 WHERE GrupoId = (SELECT Id FROM dbo.ReservaGrupo WHERE Codigo = 'G6FFF18E') AND Cancelado = 0 AND Origem = 'manual' AND ValorCentavos IN (14091, 14026, 14000);
  COMMIT TRAN;
END;
