import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const MIGRATION_PATH = path.resolve(__dirname, '../../migrations/ops/0017_otimizacoes_indices_fks.sql');

describe('Migração 0017 - Índices em FKs e Constraints de Integridade', () => {
  it('o arquivo de migração existe e possui conteúdo válido', () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
    const content = fs.readFileSync(MIGRATION_PATH, 'utf-8');
    expect(content.trim().length).toBeGreaterThan(100);
  });

  const rawSql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
  const batches = rawSql
    .split(/^\s*GO\s*$/gim)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  it('possui batches válidos delimitados por GO', () => {
    expect(batches.length).toBeGreaterThanOrEqual(10);
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

  it('contém índices essenciais em chaves estrangeiras', () => {
    expect(rawSql).toContain('IX_Pagamento_Inscricao');
    expect(rawSql).toContain('IX_Venda_Cliente');
    expect(rawSql).toContain('IX_Venda_Movimento');
    expect(rawSql).toContain('IX_VendaItem_Produto');
    expect(rawSql).toContain('IX_VendaPagamento_Forma');
    expect(rawSql).toContain('IX_ReservaOnline_Bateria');
  });

  it('contém constraints de validação de domínio para Status', () => {
    expect(rawSql).toContain('CK_Inscricao_Status');
    expect(rawSql).toContain("Status IN ('reservada', 'confirmada', 'cancelada')");
    expect(rawSql).toContain('CK_Bateria_Status');
    expect(rawSql).toContain("Status IN ('aberta', 'fechada', 'cancelada')");
  });
});
