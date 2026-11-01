-- Verificações de qualidade de dados levantadas na auditoria de 27/10/2026 (Recepção/Totens).
-- Rodar com: sqlcmd -I -S localhost\SQLEXPRESS -d KartodromoOps -U KartOpsSql -P *** -i <arquivo>
-- TODAS as consultas abaixo são somente leitura. As correções propostas estão COMENTADAS
-- e precisam de aprovação do dono antes de executar (regra: teste só com dados "TESTE CODEX").

-- =====================================================================
-- 1. DIAGNÓSTICO (read-only)
-- =====================================================================

-- Clientes duplicados por documento (341 grupos em 27/10)
SELECT TOP (20) DocumentoNum, COUNT(*) qtde
FROM dbo.Cliente WHERE DocumentoNum IS NOT NULL
GROUP BY DocumentoNum HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC;

-- Clientes duplicados por e-mail
SELECT TOP (10) Email, COUNT(*) qtde
FROM dbo.Cliente WHERE Email IS NOT NULL AND Email <> ''
GROUP BY Email HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC;

-- Pré-reservas do totem pendentes há mais de 2 dias (34 em 27/10)
SELECT i.Id, i.BateriaId, b.Nome, b.Inicio, c.Nome cliente, i.CriadoEm
FROM dbo.Inscricao i
JOIN dbo.Bateria b ON b.Id = i.BateriaId
JOIN dbo.Cliente c ON c.Id = i.ClienteId
WHERE i.Origem = 'totem' AND i.Aprovada = 0 AND i.CriadoEm < DATEADD(day, -2, SYSDATETIME())
ORDER BY i.CriadoEm;

-- Inscrições "reservada" em baterias que já ocorreram (317 em 27/10) — fantasmas de vagas
SELECT b.Inicio, COUNT(*) qtde FROM dbo.Inscricao i
JOIN dbo.Bateria b ON b.Id = i.BateriaId
WHERE i.Status = 'reservada' AND b.Inicio < SYSDATETIME()
GROUP BY b.Inicio ORDER BY b.Inicio DESC;

-- Produtos ativos com preço zero (10 em 27/10)
SELECT Id, Nome, PrecoCentavos FROM dbo.Produto WHERE Ativo = 1 AND PrecoCentavos <= 0;

-- Clientes sem telefone e sem e-mail (94 em 27/10)
SELECT COUNT(*) FROM dbo.Cliente
WHERE (TelefoneNum IS NULL OR TelefoneNum = '') AND (Email IS NULL OR Email = '');

-- Clientes sem aceite LGPD (10.364 em 27/10 — import legado)
SELECT Origem, COUNT(*) FROM dbo.Cliente WHERE LgpdAceiteEm IS NULL GROUP BY Origem;

-- Menores de idade (8.127 em 27/10)
SELECT COUNT(*) FROM dbo.Cliente WHERE Nascimento > DATEADD(year, -18, CAST(SYSDATETIME() AS date));

-- Caixas abertos esquecidos (mov. 805/SUÊNIA desde 25/10 com R$ 2.035,00 em 3 vendas)
SELECT m.Id, t.Nome terminal, u.Login, CONVERT(varchar(16), m.AbertoEm, 126) aberto,
  (SELECT COUNT(*) FROM dbo.Venda v WHERE v.MovimentoId = m.Id AND v.Cancelada = 0) vendas,
  (SELECT ISNULL(SUM(v.FinalCentavos),0)/100.0 FROM dbo.Venda v WHERE v.MovimentoId = m.Id AND v.Cancelada = 0) total
FROM dbo.Movimento m
LEFT JOIN dbo.Terminal t ON t.Id = m.TerminalId
LEFT JOIN dbo.Usuario u ON u.Id = m.UsuarioId
WHERE m.FechadoEm IS NULL;

-- Oficina atrasada (131 itens em 27/10)
SELECT COUNT(*) FROM dbo.Manutencao WHERE Status = 'a realizar' AND CriadoEm < DATEADD(day, -30, SYSDATETIME());

-- =====================================================================
-- 2. CORREÇÕES PROPOSTAS — NÃO EXECUTAR SEM APROVAÇÃO DO DONO
-- =====================================================================

-- 2a. Cancelar inscrições-fantasma (reservada em bateria passada, nunca confirmada):
-- UPDATE i SET i.Status = 'cancelada', i.AtualizadoEm = SYSDATETIME()
-- FROM dbo.Inscricao i JOIN dbo.Bateria b ON b.Id = i.BateriaId
-- WHERE i.Status = 'reservada' AND b.Inicio < DATEADD(day, -7, SYSDATETIME());

-- 2b. Expirar vouchers vencidos que ficaram ativos:
-- UPDATE dbo.Voucher SET Ativo = 0 WHERE Ativo = 1 AND FimEm < CAST(SYSDATETIME() AS date);

-- 2c. Duplicados de documento: revisar manualmente antes (fidelidade/compras anexadas ao registro errado).
--     Listar pares primeiro e decidir o cliente "verdadeiro" caso a caso.

-- 2d. Produtos com preço zero: definir preço ou inativar
-- UPDATE dbo.Produto SET Ativo = 0 WHERE Ativo = 1 AND PrecoCentavos <= 0;  -- se a regra for inativar
