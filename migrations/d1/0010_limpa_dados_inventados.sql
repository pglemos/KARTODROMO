-- 0010_limpa_dados_inventados.sql
-- Remove os registros fictícios criados pelo seed inicial (0003_comprehensive_seed.sql,
-- commit e235e46) que foram aplicados por engano no banco de produção: campeonatos,
-- etapas, pilotos, corridas, resultados, sessões, voltas, reservas, atendimentos e
-- lançamentos financeiros inventados. Backup integral salvo em .tmp/backup-limpeza/.
-- Clientes reais (sync do LapTime) são preservados; apenas os 4 clientes de seed saem.

DELETE FROM voltas;
DELETE FROM resultados;
DELETE FROM classificacao;
DELETE FROM corridas;
DELETE FROM sessoes;
DELETE FROM etapas;
DELETE FROM campeonatos;
DELETE FROM pilotos;
DELETE FROM recepcao_atendimentos;
DELETE FROM reservas;
DELETE FROM financeiro_lancamentos;
DELETE FROM financeiro_categorias;

DELETE FROM clientes WHERE id IN ('cli-001', 'cli-002', 'cli-003', 'cli-004');
