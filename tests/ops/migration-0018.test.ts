import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const MIGRATION_PATH = path.resolve(__dirname, '../../migrations/ops/0018_otimizacoes_fks_e_totem.sql');

describe('Migração 0018 - Cobertura Completa de FKs, Totem e Constraints', () => {
  it('o arquivo de migração 0018 existe e possui conteúdo válido', () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
    const content = fs.readFileSync(MIGRATION_PATH, 'utf-8');
    expect(content.trim().length).toBeGreaterThan(100);
  });

  const rawSql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
  const batches = rawSql
    .split(/^\s*GO\s*$/gim)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  it('possui batches delimitados por GO com QUOTED_IDENTIFIER ativado', () => {
    expect(batches.length).toBeGreaterThanOrEqual(15);
    expect(rawSql).toContain('SET QUOTED_IDENTIFIER ON');
  });

  it('possui parênteses e aspas balanceados', () => {
    let openParen = 0;
    let inSingleQuote = false;

    for (let i = 0; i < rawSql.length; i++) {
      const char = rawSql[i];
      if (char === "'" && (i === 0 || rawSql[i - 1] !== '\\')) {
        inSingleQuote = !inSingleQuote;
      } else if (!inSingleQuote) {
        if (char === '(') openParen++;
        if (char === ')') openParen--;
      }
    }
    expect(inSingleQuote).toBe(false);
    expect(openParen).toBe(0);
  });

  it('contém o índice filtrado coberto para otimização do totem', () => {
    expect(rawSql).toContain('IX_Bateria_Totem_Ativas');
    expect(rawSql).toContain("WHERE Status = 'aberta' AND AutoAtendimento = 1 AND ReservaFechada = 0");
  });

  it('contém índices para chaves estrangeiras remanescentes', () => {
    expect(rawSql).toContain('IX_Bateria_Produto');
    expect(rawSql).toContain('IX_Bateria_Responsavel');
    expect(rawSql).toContain('IX_Bateria_Tracado');
    expect(rawSql).toContain('IX_Inscricao_Produto');
    expect(rawSql).toContain('IX_Inscricao_Responsavel');
    expect(rawSql).toContain('IX_ReservaGrupo_Responsavel');
    expect(rawSql).toContain('IX_Usuario_Perfil');
  });

  it('contém constraints de integridade para ranges numéricos', () => {
    expect(rawSql).toContain('CK_Inscricao_Valores');
    expect(rawSql).toContain('CK_Bateria_Vagas');
  });
});
