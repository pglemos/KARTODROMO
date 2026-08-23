-- 0011_limpa_seed_lanchonete_clube.sql
-- Completa a limpeza dos dados fictícios nascidos do seed inicial: catálogo da
-- lanchonete e módulo Clube de Vantagens (participantes, recompensas, resgates
-- e campanhas de demonstração). Backup integral em .tmp/backup-limpeza/.
-- Vendas reais não existiam (0 registros); tabelas permanecem vazias para uso real.

DELETE FROM clube_resgates;
DELETE FROM clube_transacoes;
DELETE FROM clube_participantes;
DELETE FROM clube_recompensas;
DELETE FROM clube_campanhas;

DELETE FROM lanchonete_estoque;
DELETE FROM lanchonete_produtos;
