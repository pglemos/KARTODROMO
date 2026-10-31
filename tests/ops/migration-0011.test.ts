import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const MIGRATION_PATH = path.resolve(__dirname, '../../migrations/ops/0011_fila_impressao_indices.sql');

describe('Milestone M1 - Migração 0011 (Fila de Impressão e Índices)', () => {
  it('o arquivo de migração existe e não está vazio', () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
    const content = fs.readFileSync(MIGRATION_PATH, 'utf-8');
    expect(content.trim().length).toBeGreaterThan(100);
  });

  const rawSql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
  // Divide os batches pelo separador GO do SQL Server
  const batches = rawSql
    .split(/^\s*GO\s*$/gim)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  it('divide o script em múltiplos batches válidos delimitados por GO', () => {
    expect(batches.length).toBeGreaterThanOrEqual(4);
  });

  describe('Sintaxe e Compatibilidade T-SQL (SQL Server)', () => {
    it('possui parênteses e aspas balanceados em todo o script', () => {
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

    it('utiliza convenções e palavras-chave exclusivas do T-SQL / SQL Server', () => {
      expect(rawSql).toMatch(/SYSDATETIME\(\)/i);
      expect(rawSql).toMatch(/NVARCHAR\(/i);
      expect(rawSql).toMatch(/DATETIME2/i);
      expect(rawSql).toMatch(/IDENTITY\(1,1\)/i);
      expect(rawSql).toMatch(/OBJECT_ID\(/i);
      expect(rawSql).toMatch(/sys\.indexes/i);
      expect(rawSql).toMatch(/TRY_CAST\(/i);
      expect(rawSql).toMatch(/PERSISTED/i);

      // Não deve conter dialetos de outros bancos (Postgres/MySQL)
      expect(rawSql).not.toMatch(/AUTO_INCREMENT/i);
      expect(rawSql).not.toMatch(/SERIAL PRIMARY KEY/i);
      expect(rawSql).not.toMatch(/\bNOW\(\)/i);
    });
  });

  describe('Estrutura da Tabela dbo.FilaImpressao', () => {
    it('garante idempotência na criação de dbo.FilaImpressao com IF OBJECT_ID', () => {
      expect(rawSql).toMatch(/IF\s+OBJECT_ID\s*\(\s*'dbo\.FilaImpressao'\s*,\s*'U'\s*\)\s+IS\s+NULL/i);
    });

    it('possui todas as colunas obrigatórias com seus tipos e restrições', () => {
      const tableMatch = rawSql.match(/CREATE\s+TABLE\s+dbo\.FilaImpressao\s*\(([\s\S]*?)\);/i);
      expect(tableMatch).not.toBeNull();
      const body = tableMatch![1];

      // Id INT IDENTITY(1,1) PRIMARY KEY
      expect(body).toMatch(/Id\s+INT\s+IDENTITY\(1,1\)\s+PRIMARY\s+KEY/i);
      // Url NVARCHAR(500) NOT NULL
      expect(body).toMatch(/Url\s+NVARCHAR\(500\)\s+NOT\s+NULL/i);
      // Titulo NVARCHAR(200) NOT NULL
      expect(body).toMatch(/Titulo\s+NVARCHAR\(200\)\s+NOT\s+NULL/i);
      // Origem NVARCHAR(100) NOT NULL
      expect(body).toMatch(/Origem\s+NVARCHAR\(100\)\s+NOT\s+NULL/i);
      // Status NVARCHAR(20) NOT NULL DEFAULT 'pendente'
      expect(body).toMatch(/Status\s+NVARCHAR\(20\)\s+NOT\s+NULL(?:\s+CONSTRAINT\s+\w+)?\s+DEFAULT\s+'pendente'/i);
      // Tentativas INT NOT NULL DEFAULT 0
      expect(body).toMatch(/Tentativas\s+INT\s+NOT\s+NULL(?:\s+CONSTRAINT\s+\w+)?\s+DEFAULT\s+0/i);
      // CriadoEm DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      expect(body).toMatch(/CriadoEm\s+DATETIME2\s+NOT\s+NULL(?:\s+CONSTRAINT\s+\w+)?\s+DEFAULT\s+SYSDATETIME\(\)/i);
      // PegoEm DATETIME2 NULL
      expect(body).toMatch(/PegoEm\s+DATETIME2\s+NULL/i);
      // FeitaEm DATETIME2 NULL
      expect(body).toMatch(/FeitaEm\s+DATETIME2\s+NULL/i);
      // FalhouEm DATETIME2 NULL
      expect(body).toMatch(/FalhouEm\s+DATETIME2\s+NULL/i);
      // UltimoErro NVARCHAR(MAX) NULL
      expect(body).toMatch(/UltimoErro\s+NVARCHAR\(MAX\)\s+NULL/i);
    });

    it('possui CHECK constraint para os quatro status válidos da fila', () => {
      expect(rawSql).toMatch(/CHECK\s*\(\s*Status\s+IN\s*\(\s*'pendente'\s*,\s*'imprimindo'\s*,\s*'impressa'\s*,\s*'falhou'\s*\)\s*\)/i);
    });
  });

  describe('Índices de Performance da Fila de Impressão', () => {
    it('cria o índice IX_FilaImpressao_Status_CriadoEm de forma idempotente', () => {
      expect(rawSql).toMatch(/IF\s+NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+sys\.indexes\s+WHERE\s+name\s*=\s*'IX_FilaImpressao_Status_CriadoEm'/i);
      expect(rawSql).toMatch(/CREATE\s+INDEX\s+IX_FilaImpressao_Status_CriadoEm\s+ON\s+dbo\.FilaImpressao\s*\(\s*Status\s*,\s*CriadoEm\s*\)/i);
    });

    it('cria o índice IX_FilaImpressao_Status_PegoEm de forma idempotente', () => {
      expect(rawSql).toMatch(/IF\s+NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+sys\.indexes\s+WHERE\s+name\s*=\s*'IX_FilaImpressao_Status_PegoEm'/i);
      expect(rawSql).toMatch(/CREATE\s+INDEX\s+IX_FilaImpressao_Status_PegoEm\s+ON\s+dbo\.FilaImpressao\s*\(\s*Status\s*,\s*PegoEm\s*\)/i);
    });
  });

  describe('Índice Único Filtrado em dbo.Movimento (Terminal Aberto)', () => {
    it('inclui rotina segura para fechar movimentos abertos duplicados legados antes de criar o índice', () => {
      expect(rawSql).toMatch(/WITH\s+AbertosDuplicados\s+AS/i);
      expect(rawSql).toMatch(/PARTITION\s+BY\s+TerminalId\s+ORDER\s+BY\s+AbertoEm\s+DESC/i);
      expect(rawSql).toMatch(/UPDATE\s+dbo\.Movimento\s+SET\s+FechadoEm\s*=\s*AbertoEm/i);
    });

    it('cria o índice único filtrado UX_Movimento_TerminalAberto em dbo.Movimento', () => {
      expect(rawSql).toMatch(/NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+sys\.indexes\s+WHERE\s+name\s*=\s*'UX_Movimento_TerminalAberto'/i);
      expect(rawSql).toMatch(/CREATE\s+UNIQUE\s+INDEX\s+UX_Movimento_TerminalAberto\s+ON\s+dbo\.Movimento\s*\(\s*TerminalId\s*\)\s+WHERE\s+FechadoEm\s+IS\s+NULL/i);
    });
  });

  describe('Otimização em dbo.Manutencao (Busca de Karts sem Full Table Scan)', () => {
    it('adiciona a coluna computada persistida KartNumero de forma idempotente', () => {
      expect(rawSql).toMatch(/IF\s+COL_LENGTH\s*\(\s*'dbo\.Manutencao'\s*,\s*'KartNumero'\s*\)\s+IS\s+NULL/i);
      expect(rawSql).toMatch(/ALTER\s+TABLE\s+dbo\.Manutencao\s+ADD\s+KartNumero\s+AS\s+TRY_CAST\s*\(\s*LTRIM\s*\(\s*RTRIM\s*\(\s*Kart\s*\)\s*\)\s+AS\s+INT\s*\)\s+PERSISTED/i);
    });

    it('cria o índice IX_Manutencao_KartNumero com colunas de cobertura (INCLUDE)', () => {
      expect(rawSql).toMatch(/NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+sys\.indexes\s+WHERE\s+name\s*=\s*'IX_Manutencao_KartNumero'/i);
      expect(rawSql).toMatch(/CREATE\s+INDEX\s+IX_Manutencao_KartNumero\s+ON\s+dbo\.Manutencao\s*\(\s*KartNumero\s*\)\s+INCLUDE\s*\([\s\S]*?\)/i);
    });

    it('cria o índice IX_Manutencao_Kart na coluna Kart textual', () => {
      expect(rawSql).toMatch(/NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+sys\.indexes\s+WHERE\s+name\s*=\s*'IX_Manutencao_Kart'/i);
      expect(rawSql).toMatch(/CREATE\s+INDEX\s+IX_Manutencao_Kart\s+ON\s+dbo\.Manutencao\s*\(\s*Kart\s*\)/i);
    });
  });

  describe('Contrato de Interface M1 ↔ M2 (CTE Atômica do Servidor Node.js)', () => {
    const cteSql = `
      WITH Proximo AS (
        SELECT TOP (1) * FROM dbo.FilaImpressao WITH (UPDLOCK, READPAST)
        WHERE Status = 'pendente' OR (Status = 'imprimindo' AND PegoEm < DATEADD(second, -90, SYSDATETIME()))
        ORDER BY CriadoEm ASC
      )
      UPDATE Proximo SET Status = 'imprimindo', PegoEm = SYSDATETIME(), Tentativas = Tentativas + 1
      OUTPUT inserted.Id, inserted.Url, inserted.Titulo, inserted.Origem;
    `;

    it('todas as colunas da consulta atômica existem na tabela dbo.FilaImpressao', () => {
      const colunasEsperadas = ['Id', 'Url', 'Titulo', 'Origem', 'Status', 'Tentativas', 'CriadoEm', 'PegoEm'];
      for (const col of colunasEsperadas) {
        const regex = new RegExp(`\\b${col}\\b`, 'i');
        expect(rawSql).toMatch(regex);
      }
    });

    it('os índices criados cobrem as cláusulas WHERE e ORDER BY da consulta atômica', () => {
      // Cláusula WHERE 1: Status = 'pendente' ORDER BY CriadoEm ASC -> coberto por (Status, CriadoEm)
      expect(rawSql).toMatch(/CREATE\s+INDEX\s+IX_FilaImpressao_Status_CriadoEm\s+ON\s+dbo\.FilaImpressao\s*\(\s*Status\s*,\s*CriadoEm\s*\)/i);

      // Cláusula WHERE 2: Status = 'imprimindo' AND PegoEm < ... -> coberto por (Status, PegoEm)
      expect(rawSql).toMatch(/CREATE\s+INDEX\s+IX_FilaImpressao_Status_PegoEm\s+ON\s+dbo\.FilaImpressao\s*\(\s*Status\s*,\s*PegoEm\s*\)/i);
    });
  });

  describe('Simulador Comportamental de Esquema e Integridade em Memória', () => {
    class MockSchema {
      tables: Record<string, {
        columns: Record<string, { type: string; nullable: boolean; defaultVal?: string; computed?: string; persisted?: boolean }>;
        checkConstraints: ((row: Record<string, unknown>) => boolean)[];
        rows: Record<string, unknown>[];
      }> = {};

      indexes: Record<string, {
        table: string;
        columns: string[];
        unique: boolean;
        filter?: (row: Record<string, unknown>) => boolean;
      }> = {};

      createTable(name: string, cols: Record<string, { type: string; nullable: boolean; defaultVal?: string }>, checks: ((row: Record<string, unknown>) => boolean)[] = []) {
        if (!this.tables[name]) {
          this.tables[name] = { columns: cols, checkConstraints: checks, rows: [] };
        }
      }

      addColumn(tableName: string, colName: string, def: { type: string; nullable: boolean; defaultVal?: string; computed?: string; persisted?: boolean }) {
        if (this.tables[tableName] && !this.tables[tableName].columns[colName]) {
          this.tables[tableName].columns[colName] = def;
        }
      }

      createIndex(name: string, table: string, cols: string[], unique = false, filter?: (row: Record<string, unknown>) => boolean) {
        if (!this.indexes[name]) {
          this.indexes[name] = { table, columns: cols, unique, filter };
        }
      }

      insert(table: string, row: Record<string, unknown>) {
        const tbl = this.tables[table];
        if (!tbl) throw new Error(`Tabela ${table} não existe.`);

        // Avalia colunas computadas
        for (const [colName, colDef] of Object.entries(tbl.columns)) {
          if (colDef.computed && row[colName] === undefined) {
            if (colName === 'KartNumero') {
              const str = String(row.Kart ?? '').trim();
              const num = parseInt(str, 10);
              row[colName] = isNaN(num) ? null : num;
            }
          } else if (colDef.defaultVal && row[colName] === undefined) {
            row[colName] = colDef.defaultVal;
          }
        }

        // Valida constraints de CHECK
        for (const check of tbl.checkConstraints) {
          if (!check(row)) throw new Error(`Violação de CHECK constraint em ${table}`);
        }

        // Valida índices UNIQUE (incluindo filtrados)
        for (const idx of Object.values(this.indexes)) {
          if (idx.table === table && idx.unique) {
            if (idx.filter && !idx.filter(row)) continue;
            for (const existing of tbl.rows) {
              if (idx.filter && !idx.filter(existing)) continue;
              const matches = idx.columns.every((c) => existing[c] === row[c]);
              if (matches) throw new Error(`Violação de índice UNIQUE ${idx.table} (${idx.columns.join(',')})`);
            }
          }
        }

        tbl.rows.push(row);
      }
    }

    it('executa o ciclo completo de DDL e valida constraints e índices simulados', () => {
      const schema = new MockSchema();

      // Pré-popula tabelas existentes do sistema (Movimento e Manutencao)
      schema.createTable('dbo.Movimento', {
        Id: { type: 'INT', nullable: false },
        TerminalId: { type: 'INT', nullable: false },
        AbertoEm: { type: 'DATETIME2', nullable: false },
        FechadoEm: { type: 'DATETIME2', nullable: true },
      });

      schema.createTable('dbo.Manutencao', {
        Id: { type: 'INT', nullable: false },
        Kart: { type: 'VARCHAR(10)', nullable: false },
        MinutosUso: { type: 'INT', nullable: false, defaultVal: '0' },
      });

      // 1. Aplicação da migração 0011 no simulador
      schema.createTable('dbo.FilaImpressao', {
        Id: { type: 'INT', nullable: false },
        Url: { type: 'NVARCHAR(500)', nullable: false },
        Titulo: { type: 'NVARCHAR(200)', nullable: false },
        Origem: { type: 'NVARCHAR(100)', nullable: false },
        Status: { type: 'NVARCHAR(20)', nullable: false, defaultVal: 'pendente' },
        Tentativas: { type: 'INT', nullable: false, defaultVal: '0' },
        CriadoEm: { type: 'DATETIME2', nullable: false },
        PegoEm: { type: 'DATETIME2', nullable: true },
        FeitaEm: { type: 'DATETIME2', nullable: true },
        FalhouEm: { type: 'DATETIME2', nullable: true },
        UltimoErro: { type: 'NVARCHAR(MAX)', nullable: true },
      }, [
        (row) => ['pendente', 'imprimindo', 'impressa', 'falhou'].includes(String(row.Status)),
      ]);

      schema.createIndex('IX_FilaImpressao_Status_CriadoEm', 'dbo.FilaImpressao', ['Status', 'CriadoEm']);
      schema.createIndex('IX_FilaImpressao_Status_PegoEm', 'dbo.FilaImpressao', ['Status', 'PegoEm']);

      schema.createIndex(
        'UX_Movimento_TerminalAberto',
        'dbo.Movimento',
        ['TerminalId'],
        true,
        (row) => row.FechadoEm === null || row.FechadoEm === undefined
      );

      schema.addColumn('dbo.Manutencao', 'KartNumero', {
        type: 'INT',
        nullable: true,
        computed: 'TRY_CAST(LTRIM(RTRIM(Kart)) AS INT)',
        persisted: true,
      });
      schema.createIndex('IX_Manutencao_KartNumero', 'dbo.Manutencao', ['KartNumero']);
      schema.createIndex('IX_Manutencao_Kart', 'dbo.Manutencao', ['Kart']);

      // 2. Testes de integridade em dbo.FilaImpressao
      // Inserção com status padrão ('pendente')
      schema.insert('dbo.FilaImpressao', {
        Id: 1,
        Url: 'http://srvkart:4060/termo/1',
        Titulo: 'Termo #1',
        Origem: 'totem-1',
        CriadoEm: new Date().toISOString(),
      });
      expect(schema.tables['dbo.FilaImpressao'].rows[0].Status).toBe('pendente');

      // Inserção com status válido explícito
      schema.insert('dbo.FilaImpressao', {
        Id: 2,
        Url: 'http://srvkart:4060/termo/2',
        Titulo: 'Termo #2',
        Origem: 'recepcao',
        Status: 'imprimindo',
        CriadoEm: new Date().toISOString(),
      });

      // Inserção com status inválido deve violar a CHECK constraint
      expect(() => {
        schema.insert('dbo.FilaImpressao', {
          Id: 3,
          Url: 'http://srvkart:4060/termo/3',
          Titulo: 'Termo #3',
          Origem: 'totem-2',
          Status: 'status_invalido_teste',
          CriadoEm: new Date().toISOString(),
        });
      }).toThrow(/Violação de CHECK constraint/);

      // 3. Testes de integridade em dbo.Movimento com UX_Movimento_TerminalAberto
      // Terminal 1 aberto
      schema.insert('dbo.Movimento', {
        Id: 101,
        TerminalId: 1,
        AbertoEm: '2026-10-26T10:00:00',
        FechadoEm: null,
      });

      // Segunda tentativa de abrir o Terminal 1 sem fechar o anterior deve estourar violação de unicidade
      expect(() => {
        schema.insert('dbo.Movimento', {
          Id: 102,
          TerminalId: 1,
          AbertoEm: '2026-10-26T10:05:00',
          FechadoEm: null,
        });
      }).toThrow(/Violação de índice UNIQUE/);

      // Terminal 2 aberto pode coexistir simultaneamente
      schema.insert('dbo.Movimento', {
        Id: 103,
        TerminalId: 2,
        AbertoEm: '2026-10-26T10:10:00',
        FechadoEm: null,
      });
      expect(schema.tables['dbo.Movimento'].rows).toHaveLength(2);

      // Fechando o Terminal 1 permite que uma nova abertura para o Terminal 1 ocorra com sucesso
      schema.tables['dbo.Movimento'].rows[0].FechadoEm = '2026-10-26T12:00:00';
      schema.insert('dbo.Movimento', {
        Id: 104,
        TerminalId: 1,
        AbertoEm: '2026-10-26T12:01:00',
        FechadoEm: null,
      });
      expect(schema.tables['dbo.Movimento'].rows).toHaveLength(3);

      // 4. Testes de cálculo de KartNumero em dbo.Manutencao
      schema.insert('dbo.Manutencao', { Id: 1, Kart: ' 07 ' });
      schema.insert('dbo.Manutencao', { Id: 2, Kart: '12' });
      schema.insert('dbo.Manutencao', { Id: 3, Kart: '01' });
      schema.insert('dbo.Manutencao', { Id: 4, Kart: 'KART_INVALIDO' });

      expect(schema.tables['dbo.Manutencao'].rows[0].KartNumero).toBe(7);
      expect(schema.tables['dbo.Manutencao'].rows[1].KartNumero).toBe(12);
      expect(schema.tables['dbo.Manutencao'].rows[2].KartNumero).toBe(1);
      expect(schema.tables['dbo.Manutencao'].rows[3].KartNumero).toBeNull();
    });
  });
});
