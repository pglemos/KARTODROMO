import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Testes Adversariais Empíricos para a Milestone M1:
 * - Validação da coluna computada KartNumero e eliminação de scans em /api/crono/uso-karts
 * - Verificação de injeção SQL, DDL perigoso e integridade
 * - Idempotência e compatibilidade T-SQL no SQL Server
 */

describe('Challenger M1 - Auditoria Adversarial da Migração 0011', () => {
  const sqlPath = path.resolve(__dirname, '../../migrations/ops/0011_fila_impressao_indices.sql');
  const rawSql = fs.readFileSync(sqlPath, 'utf8');

  describe('Auditoria de Segurança e Injeção SQL', () => {
    it('o script não deve conter execução de SQL dinâmico nem chamadas perigosas de sistema', () => {
      // Proibir sp_executesql, exec(...), xp_cmdshell, OPENROWSET, etc.
      expect(rawSql).not.toMatch(/sp_executesql/i);
      expect(rawSql).not.toMatch(/xp_cmdshell/i);
      expect(rawSql).not.toMatch(/EXEC\s*\(/i);
      expect(rawSql).not.toMatch(/EXECUTE\s*\(/i);
      expect(rawSql).not.toMatch(/OPENROWSET/i);
      expect(rawSql).not.toMatch(/OPENDATASOURCE/i);
    });

    it('o script não deve conter operações destrutivas não autorizadas (DROP, TRUNCATE, DELETE)', () => {
      expect(rawSql).not.toMatch(/\bDROP\s+TABLE\b/i);
      expect(rawSql).not.toMatch(/\bDROP\s+DATABASE\b/i);
      expect(rawSql).not.toMatch(/\bTRUNCATE\s+TABLE\b/i);
      expect(rawSql).not.toMatch(/\bDELETE\s+FROM\b/i);
    });

    it('o script não deve alterar usuários, permissões ou roles do banco', () => {
      expect(rawSql).not.toMatch(/\bGRANT\b/i);
      expect(rawSql).not.toMatch(/\bREVOKE\b/i);
      expect(rawSql).not.toMatch(/\bDENY\b/i);
      expect(rawSql).not.toMatch(/\bALTER\s+ROLE\b/i);
      expect(rawSql).not.toMatch(/\bCREATE\s+USER\b/i);
    });

    it('todos os objetos pertencem estritamente ao schema dbo', () => {
      const createdObjects = [
        'dbo.FilaImpressao',
        'dbo.Movimento',
        'dbo.Manutencao',
      ];
      for (const obj of createdObjects) {
        expect(rawSql).toContain(obj);
      }
      // Não deve referenciar schemas estranhos como master, tempdb, guest ou sysadmin
      expect(rawSql).not.toMatch(/\bmaster\.dbo\b/i);
      expect(rawSql).not.toMatch(/\btempdb\.dbo\b/i);
    });

    it('todas as instruções DDL estão protegidas por verificações de idempotência', () => {
      // dbo.FilaImpressao
      expect(rawSql).toMatch(/IF\s+OBJECT_ID\s*\(\s*'dbo\.FilaImpressao'\s*,\s*'U'\s*\)\s+IS\s+NULL/i);
      // IX_FilaImpressao_Status_CriadoEm
      expect(rawSql).toMatch(/IF\s+NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+sys\.indexes\s+WHERE\s+name\s*=\s*'IX_FilaImpressao_Status_CriadoEm'/i);
      // IX_FilaImpressao_Status_PegoEm
      expect(rawSql).toMatch(/IF\s+NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+sys\.indexes\s+WHERE\s+name\s*=\s*'IX_FilaImpressao_Status_PegoEm'/i);
      // UX_Movimento_TerminalAberto
      expect(rawSql).toMatch(/IF\s+OBJECT_ID\s*\(\s*'dbo\.Movimento'\s*,\s*'U'\s*\)\s+IS\s+NOT\s+NULL[\s\S]*?NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+sys\.indexes\s+WHERE\s+name\s*=\s*'UX_Movimento_TerminalAberto'/i);
      // KartNumero
      expect(rawSql).toMatch(/IF\s+COL_LENGTH\s*\(\s*'dbo\.Manutencao'\s*,\s*'KartNumero'\s*\)\s+IS\s+NULL/i);
      // IX_Manutencao_KartNumero
      expect(rawSql).toMatch(/NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+sys\.indexes\s+WHERE\s+name\s*=\s*'IX_Manutencao_KartNumero'/i);
      // IX_Manutencao_Kart
      expect(rawSql).toMatch(/NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+sys\.indexes\s+WHERE\s+name\s*=\s*'IX_Manutencao_Kart'/i);
    });
  });

  describe('Auditoria de Performance: KartNumero e /api/crono/uso-karts', () => {
    it('a coluna computada KartNumero deve ser explicitamente PERSISTED para permitir indexação física e estatísticas', () => {
      expect(rawSql).toMatch(/KartNumero\s+AS\s+TRY_CAST\s*\(\s*LTRIM\s*\(\s*RTRIM\s*\(\s*Kart\s*\)\s*\)\s+AS\s+INT\s*\)\s+PERSISTED/i);
    });

    it('o índice IX_Manutencao_KartNumero é um COVERING INDEX para a consulta de /api/crono/uso-karts', () => {
      // Consulta em services/ops-server.ts:625:
      // SELECT Id id, Categoria categoria, ItemId item, MinutosUso minutos, CONVERT(varchar(19), UltimaManutencao, 126) ultima
      // FROM dbo.Manutencao WHERE TRY_CAST(LTRIM(RTRIM(Kart)) AS int) = @n
      const match = rawSql.match(/CREATE\s+INDEX\s+IX_Manutencao_KartNumero\s+ON\s+dbo\.Manutencao\s*\(\s*KartNumero\s*\)\s+INCLUDE\s*\(([^)]+)\)/i);
      expect(match).not.toBeNull();
      const includedColumns = match![1].split(',').map((c) => c.trim().toLowerCase());

      expect(includedColumns).toContain('categoria');
      expect(includedColumns).toContain('itemid');
      expect(includedColumns).toContain('minutosuso');
      expect(includedColumns).toContain('ultimamanutencao');
      // Id é a chave primária clusterizada de dbo.Manutencao, logo já está presente nas folhas do índice
    });

    it('comportamento empírico da conversão de tipos com TRY_CAST simulado contra casos extremos', () => {
      // Simula a lógica exata de TRY_CAST(LTRIM(RTRIM(Kart)) AS INT)
      function tryCastKart(kart: unknown): number | null {
        if (kart === null || kart === undefined) return null;
        const str = String(kart).trim();
        if (str === '') return 0; // No T-SQL, TRY_CAST('' AS INT) avalia para 0
        // Em T-SQL TRY_CAST só converte strings puramente inteiras com sinal opcional
        if (!/^[-+]?\d+$/.test(str)) return null;
        const n = Number(str);
        // Overflow de INT32 no SQL Server: -2,147,483,648 a 2,147,483,647
        if (n < -2147483648 || n > 2147483647) return null;
        return n;
      }

      // Casos normais
      expect(tryCastKart('1')).toBe(1);
      expect(tryCastKart(' 07 ')).toBe(7);
      expect(tryCastKart('01')).toBe(1);
      expect(tryCastKart('12')).toBe(12);

      // Casos adversários e de injeção
      expect(tryCastKart("1; DROP TABLE Users--")).toBeNull();
      expect(tryCastKart("1' OR '1'='1")).toBeNull();
      expect(tryCastKart('KART_INVALIDO')).toBeNull();
      expect(tryCastKart('12.5')).toBeNull(); // Float não é INT direto
      expect(tryCastKart('0x12')).toBeNull(); // Hex não converte diretamente em INT
      expect(tryCastKart(null)).toBeNull();
      expect(tryCastKart(undefined)).toBeNull();

      // Overflow de INT (protegido pelo TRY_CAST sem estourar exceção)
      expect(tryCastKart('2147483647')).toBe(2147483647);
      expect(tryCastKart('2147483648')).toBeNull(); // Estourou limite INT32 -> retorna NULL
      expect(tryCastKart('9999999999999999999999999999')).toBeNull();
    });
  });

  describe('Auditoria de Integridade: Saneamento e Índice UX_Movimento_TerminalAberto', () => {
    it('o índice UX_Movimento_TerminalAberto é filtrado exclusivamente para FechadoEm IS NULL', () => {
      expect(rawSql).toMatch(/CREATE\s+UNIQUE\s+INDEX\s+UX_Movimento_TerminalAberto\s+ON\s+dbo\.Movimento\s*\(\s*TerminalId\s*\)\s+WHERE\s+FechadoEm\s+IS\s+NULL/i);
    });

    it('a CTE de saneamento mantém o movimento mais recente e fecha registros órfãos antigos', () => {
      // Simulação da CTE:
      // SELECT Id, ROW_NUMBER() OVER (PARTITION BY TerminalId ORDER BY AbertoEm DESC, Id DESC) AS rn FROM dbo.Movimento WHERE FechadoEm IS NULL
      interface MovimentoRow {
        Id: number;
        TerminalId: number;
        AbertoEm: string;
        FechadoEm: string | null;
      }

      const rows: MovimentoRow[] = [
        { Id: 1, TerminalId: 101, AbertoEm: '2026-10-20T08:00:00Z', FechadoEm: null }, // legado esquecido
        { Id: 2, TerminalId: 101, AbertoEm: '2026-10-25T09:00:00Z', FechadoEm: null }, // mais recente
        { Id: 3, TerminalId: 102, AbertoEm: '2026-10-25T10:00:00Z', FechadoEm: null }, // terminal diferente
        { Id: 4, TerminalId: 101, AbertoEm: '2026-10-19T08:00:00Z', FechadoEm: '2026-10-19T18:00:00Z' }, // já fechado
      ];

      // Aplica a lógica da CTE da migração:
      const abertos = rows.filter((r) => r.FechadoEm === null);
      // Agrupa por TerminalId
      const porTerminal: Record<number, MovimentoRow[]> = {};
      for (const r of abertos) {
        porTerminal[r.TerminalId] = porTerminal[r.TerminalId] || [];
        porTerminal[r.TerminalId].push(r);
      }

      for (const list of Object.values(porTerminal)) {
        list.sort((a, b) => b.AbertoEm.localeCompare(a.AbertoEm) || b.Id - a.Id);
        // list[0] é rn=1 (preservado). list[1..] é rn>1 (fechado)
        for (let i = 1; i < list.length; i++) {
          list[i].FechadoEm = list[i].AbertoEm;
        }
      }

      // Verificações adversariais pós-saneamento:
      // O registro Id=2 (mais recente do terminal 101) permanece ABERTO
      expect(rows.find((r) => r.Id === 2)?.FechadoEm).toBeNull();
      // O registro Id=1 (antigo duplicado do terminal 101) foi FECHADO
      expect(rows.find((r) => r.Id === 1)?.FechadoEm).toBe('2026-10-20T08:00:00Z');
      // O registro Id=3 (único do terminal 102) permanece ABERTO
      expect(rows.find((r) => r.Id === 3)?.FechadoEm).toBeNull();

      // Agora o índice UNIQUE (TerminalId) WHERE FechadoEm IS NULL pode ser criado SEM ERRO
      const abertosFinais = rows.filter((r) => r.FechadoEm === null);
      const terminaisAbertos = abertosFinais.map((r) => r.TerminalId);
      const unicos = new Set(terminaisAbertos);
      expect(unicos.size).toBe(terminaisAbertos.length);
    });
  });

  describe('Auditoria da Fila de Impressão (dbo.FilaImpressao)', () => {
    it('possui CHECK constraint limitando status estritamente aos 4 estados válidos', () => {
      const match = rawSql.match(/CONSTRAINT\s+CK_FilaImpressao_Status\s+CHECK\s*\(\s*Status\s+IN\s*\(([^)]+)\)\s*\)/i);
      expect(match).not.toBeNull();
      const statusList = match![1].split(',').map((s) => s.trim().replace(/'/g, ''));
      expect(statusList).toEqual(['pendente', 'imprimindo', 'impressa', 'falhou']);
    });

    it('os índices criados cobrem a consulta atômica com UPDLOCK e READPAST', () => {
      expect(rawSql).toMatch(/CREATE\s+INDEX\s+IX_FilaImpressao_Status_CriadoEm\s+ON\s+dbo\.FilaImpressao\s*\(\s*Status\s*,\s*CriadoEm\s*\)/i);
      expect(rawSql).toMatch(/CREATE\s+INDEX\s+IX_FilaImpressao_Status_PegoEm\s+ON\s+dbo\.FilaImpressao\s*\(\s*Status\s*,\s*PegoEm\s*\)/i);
    });
  });

  describe('Auditoria Adversarial de Casos de Borda: Status Inválido (\'cancelado\' vs CHECK Constraint) e Valores Nulos', () => {
    interface FilaRow {
      Id: number;
      Url: string | null;
      Titulo: string | null;
      Origem: string | null;
      Status: string | null;
      Tentativas: number | null;
      CriadoEm: Date | null;
      PegoEm: Date | null;
      FeitaEm: Date | null;
      FalhouEm: Date | null;
      UltimoErro: string | null;
    }

    class FilaImpressaoTable {
      rows: FilaRow[] = [];
      private nextId = 1;

      insert(row: Partial<FilaRow>): FilaRow {
        // Validação de NOT NULL
        if (row.Url === null || row.Url === undefined) throw new Error('Cannot insert the value NULL into column Url, table dbo.FilaImpressao');
        if (row.Titulo === null || row.Titulo === undefined) throw new Error('Cannot insert the value NULL into column Titulo, table dbo.FilaImpressao');
        if (row.Origem === null || row.Origem === undefined) throw new Error('Cannot insert the value NULL into column Origem, table dbo.FilaImpressao');

        // Em SQL Server, omitir a coluna aciona o DEFAULT ('pendente', 0, SYSDATETIME).
        // Porém inserir explicitamente NULL falha com erro de NOT NULL!
        const status = 'Status' in row ? row.Status : 'pendente';
        if (status === null || status === undefined) throw new Error('Cannot insert the value NULL into column Status, table dbo.FilaImpressao');

        // CHECK Constraint: CK_FilaImpressao_Status CHECK (Status IN ('pendente', 'imprimindo', 'impressa', 'falhou'))
        const allowedStatuses = ['pendente', 'imprimindo', 'impressa', 'falhou'];
        if (!allowedStatuses.includes(status)) {
          throw new Error(`The INSERT statement conflicted with the CHECK constraint "CK_FilaImpressao_Status". Status="${status}"`);
        }

        const tentativas = 'Tentativas' in row ? row.Tentativas : 0;
        if (tentativas === null || tentativas === undefined) throw new Error('Cannot insert the value NULL into column Tentativas, table dbo.FilaImpressao');

        const criadoEm = 'CriadoEm' in row ? row.CriadoEm : new Date();
        if (criadoEm === null || criadoEm === undefined) throw new Error('Cannot insert the value NULL into column CriadoEm, table dbo.FilaImpressao');

        const newRow: FilaRow = {
          Id: this.nextId++,
          Url: row.Url,
          Titulo: row.Titulo,
          Origem: row.Origem,
          Status: status,
          Tentativas: tentativas,
          CriadoEm: criadoEm,
          PegoEm: row.PegoEm ?? null,
          FeitaEm: row.FeitaEm ?? null,
          FalhouEm: row.FalhouEm ?? null,
          UltimoErro: row.UltimoErro ?? null,
        };

        this.rows.push(newRow);
        return { ...newRow };
      }

      update(id: number, updates: Partial<FilaRow>): FilaRow {
        const row = this.rows.find((r) => r.Id === id);
        if (!row) throw new Error(`Row with Id ${id} not found`);

        if ('Url' in updates && updates.Url === null) throw new Error('Cannot update Url to NULL');
        if ('Titulo' in updates && updates.Titulo === null) throw new Error('Cannot update Titulo to NULL');
        if ('Origem' in updates && updates.Origem === null) throw new Error('Cannot update Origem to NULL');
        if ('Status' in updates) {
          if (updates.Status === null) throw new Error('Cannot update Status to NULL');
          const allowedStatuses = ['pendente', 'imprimindo', 'impressa', 'falhou'];
          if (!allowedStatuses.includes(updates.Status!)) {
            throw new Error(`The UPDATE statement conflicted with the CHECK constraint "CK_FilaImpressao_Status". Status="${updates.Status}"`);
          }
        }

        Object.assign(row, updates);
        return { ...row };
      }
    }

    it('rejeita categoricamente status "cancelado" na inserção via CHECK constraint', () => {
      const table = new FilaImpressaoTable();
      expect(() => {
        table.insert({
          Url: 'http://srvkart:4060/termo/1',
          Titulo: 'Termo 1',
          Origem: 'totem-1',
          Status: 'cancelado',
        });
      }).toThrow(/The INSERT statement conflicted with the CHECK constraint "CK_FilaImpressao_Status"/);
    });

    it('rejeita categoricamente atualização de status para "cancelado" via CHECK constraint', () => {
      const table = new FilaImpressaoTable();
      const row = table.insert({
        Url: 'http://srvkart:4060/termo/1',
        Titulo: 'Termo 1',
        Origem: 'totem-1',
        Status: 'pendente',
      });

      expect(() => {
        table.update(row.Id, { Status: 'cancelado' });
      }).toThrow(/The UPDATE statement conflicted with the CHECK constraint "CK_FilaImpressao_Status"/);
    });

    it('rejeita outros status espúrios ou variações de case ("aguardando", "concluido", "PENDENTE", "")', () => {
      const table = new FilaImpressaoTable();
      const statusInvalidos = ['aguardando', 'concluido', 'processando', 'abortado', 'PENDENTE', '', '   '];

      for (const st of statusInvalidos) {
        expect(() => {
          table.insert({
            Url: 'http://srvkart:4060/termo/test',
            Titulo: 'Teste',
            Origem: 'totem',
            Status: st,
          });
        }).toThrow(/CK_FilaImpressao_Status/);
      }
    });

    it('aceita exclusivamente os quatro status oficiais previstos no contrato', () => {
      const table = new FilaImpressaoTable();
      const statusValidos = ['pendente', 'imprimindo', 'impressa', 'falhou'];

      for (const st of statusValidos) {
        const row = table.insert({
          Url: `http://srvkart:4060/termo/${st}`,
          Titulo: `Termo ${st}`,
          Origem: 'totem',
          Status: st,
        });
        expect(row.Status).toBe(st);
      }
      expect(table.rows).toHaveLength(4);
    });

    it('impede inserção de valores nulos em colunas NOT NULL obrigatórias', () => {
      const table = new FilaImpressaoTable();

      // Url nula
      expect(() => {
        table.insert({ Url: null as never, Titulo: 'T', Origem: 'O' });
      }).toThrow(/Cannot insert the value NULL into column Url/);

      // Titulo nulo
      expect(() => {
        table.insert({ Url: 'http://u', Titulo: null as never, Origem: 'O' });
      }).toThrow(/Cannot insert the value NULL into column Titulo/);

      // Origem nula
      expect(() => {
        table.insert({ Url: 'http://u', Titulo: 'T', Origem: null as never });
      }).toThrow(/Cannot insert the value NULL into column Origem/);

      // Status nulo explícito
      expect(() => {
        table.insert({ Url: 'http://u', Titulo: 'T', Origem: 'O', Status: null as never });
      }).toThrow(/Cannot insert the value NULL into column Status/);
    });

    it('permite valores nulos estritamente nas colunas opcionais (PegoEm, FeitaEm, FalhouEm, UltimoErro)', () => {
      const table = new FilaImpressaoTable();
      const row = table.insert({
        Url: 'http://srvkart:4060/termo/1',
        Titulo: 'Termo 1',
        Origem: 'recepcao',
        PegoEm: null,
        FeitaEm: null,
        FalhouEm: null,
        UltimoErro: null,
      });

      expect(row.PegoEm).toBeNull();
      expect(row.FeitaEm).toBeNull();
      expect(row.FalhouEm).toBeNull();
      expect(row.UltimoErro).toBeNull();
    });
  });

  describe('Auditoria de Concorrência: Reabertura Simultânea de Terminal no Mesmo TerminalId', () => {
    interface MovimentoRow {
      Id: number;
      TerminalId: number;
      AbertoEm: Date;
      FechadoEm: Date | null;
    }

    class MovimentoTable {
      rows: MovimentoRow[] = [];
      private nextId = 1;

      abrirCaixa(terminalId: number, dataHora: Date = new Date()): MovimentoRow {
        // Simula a verificação física do índice único filtrado UX_Movimento_TerminalAberto:
        // CREATE UNIQUE INDEX UX_Movimento_TerminalAberto ON dbo.Movimento (TerminalId) WHERE FechadoEm IS NULL;
        const terminalJaAberto = this.rows.some((r) => r.TerminalId === terminalId && r.FechadoEm === null);
        if (terminalJaAberto) {
          throw new Error(`Cannot insert duplicate key row in object 'dbo.Movimento' with unique index 'UX_Movimento_TerminalAberto'. The duplicate key value is (${terminalId}).`);
        }

        const row: MovimentoRow = {
          Id: this.nextId++,
          TerminalId: terminalId,
          AbertoEm: dataHora,
          FechadoEm: null,
        };
        this.rows.push(row);
        return { ...row };
      }

      fecharCaixa(movimentoId: number, dataHora: Date = new Date()): void {
        const row = this.rows.find((r) => r.Id === movimentoId);
        if (!row) throw new Error(`Movimento ${movimentoId} não encontrado`);
        if (row.FechadoEm !== null) throw new Error(`Movimento ${movimentoId} já está fechado`);
        row.FechadoEm = dataHora;
      }
    }

    it('bloqueia categoricamente duas tentativas de abertura simultânea para o mesmo TerminalId', () => {
      const db = new MovimentoTable();

      // Primeiro operador abre o terminal 1
      const m1 = db.abrirCaixa(1);
      expect(m1.Id).toBe(1);
      expect(m1.TerminalId).toBe(1);

      // Segundo operador ou thread concorrente tenta abrir o mesmo terminal 1 sem o primeiro ter fechado
      expect(() => {
        db.abrirCaixa(1);
      }).toThrow(/Cannot insert duplicate key row in object 'dbo.Movimento' with unique index 'UX_Movimento_TerminalAberto'/);
    });

    it('permite aberturas concorrentes em terminais distintos (Terminal 1, 2 e 3 abertos ao mesmo tempo)', () => {
      const db = new MovimentoTable();

      const m1 = db.abrirCaixa(1);
      const m2 = db.abrirCaixa(2);
      const m3 = db.abrirCaixa(3);

      expect(m1.TerminalId).toBe(1);
      expect(m2.TerminalId).toBe(2);
      expect(m3.TerminalId).toBe(3);

      const abertos = db.rows.filter((r) => r.FechadoEm === null);
      expect(abertos).toHaveLength(3);
    });

    it('permite múltiplos ciclos de abertura e fechamento para o mesmo TerminalId ao longo do tempo (sem colisão no índice)', () => {
      const db = new MovimentoTable();

      for (let ciclo = 1; ciclo <= 25; ciclo++) {
        const m = db.abrirCaixa(1, new Date(`2026-10-26T${String(ciclo).padStart(2, '0')}:00:00Z`));
        expect(m.FechadoEm).toBeNull();

        // Tentativa de abrir novamente durante o ciclo DEVE falhar
        expect(() => db.abrirCaixa(1)).toThrow(/UX_Movimento_TerminalAberto/);

        // Fecha o caixa do ciclo
        db.fecharCaixa(m.Id, new Date(`2026-10-26T${String(ciclo).padStart(2, '0')}:50:00Z`));
      }

      // 25 movimentos criados e fechados para o Terminal 1
      expect(db.rows).toHaveLength(25);
      const aindaAbertos = db.rows.filter((r) => r.FechadoEm === null);
      expect(aindaAbertos).toHaveLength(0);

      // E agora uma nova abertura (26ª) funciona perfeitamente
      const m26 = db.abrirCaixa(1);
      expect(m26.FechadoEm).toBeNull();
    });

    it('corrida assíncrona simulada: 10 requisições simultâneas para abrir o mesmo terminal resultam em exatamente 1 sucesso e 9 falhas', async () => {
      const db = new MovimentoTable();
      let sucessos = 0;
      let falhas = 0;

      const promises = Array.from({ length: 10 }).map(async () => {
        try {
          db.abrirCaixa(5);
          sucessos++;
        } catch {
          falhas++;
        }
      });

      await Promise.all(promises);

      expect(sucessos).toBe(1);
      expect(falhas).toBe(9);
      expect(db.rows.filter((r) => r.TerminalId === 5 && r.FechadoEm === null)).toHaveLength(1);
    });
  });

  describe('Auditoria de Concorrência e Resiliência da CTE Atômica (UPDLOCK, READPAST)', () => {
    interface Job {
      id: number;
      url: string;
      titulo: string;
      origem: string;
      status: 'pendente' | 'imprimindo' | 'impressa' | 'falhou';
      tentativas: number;
      criadoEm: Date;
      pegoEm: Date | null;
      feitaEm: Date | null;
      falhouEm: Date | null;
      ultimoErro: string | null;
      lockedBy: string | null;
    }

    class SqlQueueEngine {
      private jobs: Job[] = [];
      private nextId = 1;

      enqueue(url: string, titulo: string, origem: string, criadoEm: Date = new Date()): Job {
        const job: Job = {
          id: this.nextId++,
          url,
          titulo,
          origem,
          status: 'pendente',
          tentativas: 0,
          criadoEm,
          pegoEm: null,
          feitaEm: null,
          falhouEm: null,
          ultimoErro: null,
          lockedBy: null,
        };
        this.jobs.push(job);
        return { ...job };
      }

      /**
       * Simulação exata da CTE T-SQL:
       * WITH Proximo AS (
       *   SELECT TOP (1) * FROM dbo.FilaImpressao WITH (UPDLOCK, READPAST)
       *   WHERE Status = 'pendente' OR (Status = 'imprimindo' AND PegoEm < DATEADD(second, -90, SYSDATETIME()))
       *   ORDER BY CriadoEm ASC
       * )
       * UPDATE Proximo SET Status = 'imprimindo', PegoEm = SYSDATETIME(), Tentativas = Tentativas + 1
       * OUTPUT inserted.Id, inserted.Url, inserted.Titulo, inserted.Origem;
       */
      async fetchNextJobAtomic(workerId: string, agora: Date = new Date()): Promise<Job | null> {
        // UPDLOCK + READPAST:
        // Encontra o primeiro registro elegível ordenado por CriadoEm ASC que NÃO esteja com lock ativo (READPAST pula locked)
        const cutoff90s = new Date(agora.getTime() - 90 * 1000);

        const eligible = this.jobs
          .filter((j) => {
            // Se estiver bloqueado por outro worker (transação em andamento), READPAST pula!
            if (j.lockedBy !== null && j.lockedBy !== workerId) return false;

            const isPendente = j.status === 'pendente';
            const isImprimindoTimeout = j.status === 'imprimindo' && j.pegoEm !== null && j.pegoEm < cutoff90s;
            return isPendente || isImprimindoTimeout;
          })
          .sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime());

        if (eligible.length === 0) return null;

        const target = eligible[0];

        // Adquire lock exclusivo e atualiza atomicamente
        target.lockedBy = workerId;
        target.status = 'imprimindo';
        target.pegoEm = agora;
        target.tentativas += 1;

        // Imediatamente libera o lock (simulando commit da transação T-SQL do ops-server)
        target.lockedBy = null;

        return { ...target };
      }

      completeJob(id: number, dataHora: Date = new Date()): void {
        const job = this.jobs.find((j) => j.id === id);
        if (!job) throw new Error('Job not found');
        job.status = 'impressa';
        job.feitaEm = dataHora;
      }

      failJob(id: number, erro: string, dataHora: Date = new Date()): void {
        const job = this.jobs.find((j) => j.id === id);
        if (!job) throw new Error('Job not found');
        job.status = 'falhou';
        job.falhouEm = dataHora;
        job.ultimoErro = erro;
      }

      getJob(id: number): Job | undefined {
        return this.jobs.find((j) => j.id === id);
      }
    }

    it('mantém ordem estrita FIFO (ORDER BY CriadoEm ASC) no consumo da fila', async () => {
      const queue = new SqlQueueEngine();
      const t0 = new Date('2026-10-26T10:00:00Z');
      const t1 = new Date('2026-10-26T10:01:00Z');
      const t2 = new Date('2026-10-26T10:02:00Z');

      queue.enqueue('http://termo/3', 'Termo 3', 'totem', t2);
      queue.enqueue('http://termo/1', 'Termo 1', 'totem', t0);
      queue.enqueue('http://termo/2', 'Termo 2', 'totem', t1);

      const job1 = await queue.fetchNextJobAtomic('worker-1', new Date('2026-10-26T10:03:00Z'));
      const job2 = await queue.fetchNextJobAtomic('worker-1', new Date('2026-10-26T10:03:01Z'));
      const job3 = await queue.fetchNextJobAtomic('worker-1', new Date('2026-10-26T10:03:02Z'));

      expect(job1?.titulo).toBe('Termo 1');
      expect(job2?.titulo).toBe('Termo 2');
      expect(job3?.titulo).toBe('Termo 3');
    });

    it('garante que concorrência massiva de 50 workers sobre 15 jobs não gera nenhuma duplicação nem omissão', async () => {
      const queue = new SqlQueueEngine();
      for (let i = 1; i <= 15; i++) {
        queue.enqueue(`http://termo/${i}`, `Termo ${i}`, 'totem', new Date(1000 * i));
      }

      // 50 workers competindo concorrentemente para puxar trabalhos
      const resultados: (Job | null)[] = await Promise.all(
        Array.from({ length: 50 }).map((_, idx) =>
          queue.fetchNextJobAtomic(`worker-${idx}`, new Date('2026-10-26T11:00:00Z'))
        )
      );

      const jobsEntregues = resultados.filter((j): j is Job => j !== null);
      expect(jobsEntregues).toHaveLength(15);

      const idsEntregues = jobsEntregues.map((j) => j.id);
      const setIds = new Set(idsEntregues);
      // Cada id deve ser estritamente único (zero duplicações)
      expect(setIds.size).toBe(15);

      // 35 workers receberam null de forma limpa (fila vazia), sem erro
      const nulls = resultados.filter((j) => j === null);
      expect(nulls).toHaveLength(35);
    });

    it('reentrega trabalho travado após timeout de 90 segundos e incrementa Tentativas', async () => {
      const queue = new SqlQueueEngine();
      const t0 = new Date('2026-10-26T12:00:00Z');
      queue.enqueue('http://termo/crash', 'Termo Crash', 'totem', t0);

      // Worker 1 pega às 12:00:00 e simula que o agente de impressão caiu/congelou
      const job1 = await queue.fetchNextJobAtomic('worker-1', t0);
      expect(job1).not.toBeNull();
      expect(job1?.tentativas).toBe(1);
      expect(job1?.status).toBe('imprimindo');

      // Tentativa 60s depois (12:01:00) -> NÃO deve reentregar (ainda não bateu 90s)
      const t60s = new Date('2026-10-26T12:01:00Z');
      const tentativaPrecoce = await queue.fetchNextJobAtomic('worker-2', t60s);
      expect(tentativaPrecoce).toBeNull();

      // Tentativa 91s depois (12:01:31) -> DEVE reentregar com incremento de Tentativas
      const t91s = new Date('2026-10-26T12:01:31Z');
      const jobReentregue = await queue.fetchNextJobAtomic('worker-3', t91s);
      expect(jobReentregue).not.toBeNull();
      expect(jobReentregue?.id).toBe(job1!.id);
      expect(jobReentregue?.tentativas).toBe(2);
      expect(jobReentregue?.status).toBe('imprimindo');
      expect(jobReentregue?.pegoEm).toEqual(t91s);
    });

    it('trabalhos com status "impressa" ou "falhou" NUNCA são capturados pela CTE', async () => {
      const queue = new SqlQueueEngine();
      queue.enqueue('http://termo/ok', 'Termo Sucesso', 'totem');
      queue.enqueue('http://termo/err', 'Termo Erro', 'totem');

      const jobOk = await queue.fetchNextJobAtomic('w', new Date());
      queue.completeJob(jobOk!.id);

      const jobErr = await queue.fetchNextJobAtomic('w', new Date());
      queue.failJob(jobErr!.id, 'Impressora sem papel');

      expect(queue.getJob(jobOk!.id)?.status).toBe('impressa');
      expect(queue.getJob(jobErr!.id)?.status).toBe('falhou');

      // Passados 10 minutos (muito além de 90s), nenhum dos dois pode ser reentregue
      const agora10m = new Date(Date.now() + 600 * 1000);
      const proximo = await queue.fetchNextJobAtomic('w', agora10m);
      expect(proximo).toBeNull();
    });

    it('fila vazia retorna null de forma segura sem lançar exceções nem causar bloqueios', async () => {
      const queue = new SqlQueueEngine();
      const job = await queue.fetchNextJobAtomic('w');
      expect(job).toBeNull();
    });

    it('estresse em escala massiva: 100 workers concorrentes disputando 20 jobs com zero colisões e zero omissões', async () => {
      const queue = new SqlQueueEngine();
      for (let i = 1; i <= 20; i++) {
        queue.enqueue(`http://termo/${i}`, `Termo ${i}`, 'totem', new Date(1000 * i));
      }

      const resultados = await Promise.all(
        Array.from({ length: 100 }).map((_, idx) =>
          queue.fetchNextJobAtomic(`worker-${idx}`, new Date('2026-10-26T14:00:00Z'))
        )
      );

      const entregues = resultados.filter((j): j is NonNullable<typeof j> => j !== null);
      expect(entregues).toHaveLength(20);

      const ids = entregues.map((j) => j.id);
      expect(new Set(ids).size).toBe(20);

      const vazios = resultados.filter((j) => j === null);
      expect(vazios).toHaveLength(80);
    });
  });

  describe('Auditoria Adversarial do Ciclo de Vida de Contingência e Reimpressão', () => {
    interface JobRegistro {
      id: number;
      titulo: string;
      status: 'pendente' | 'imprimindo' | 'impressa' | 'falhou';
      tentativas: number;
      criadoEm: Date;
      pegoEm: Date | null;
      ultimoErro: string | null;
    }

    class FilaContingenciaSimulador {
      jobs: JobRegistro[] = [];
      private nextId = 1;

      enfileirar(titulo: string, criadoEm: Date): JobRegistro {
        const j: JobRegistro = {
          id: this.nextId++,
          titulo,
          status: 'pendente',
          tentativas: 0,
          criadoEm,
          pegoEm: null,
          ultimoErro: null,
        };
        this.jobs.push(j);
        return { ...j };
      }

      // Simula: UPDATE dbo.FilaImpressao SET Status = 'falhou', UltimoErro = 'contingencia' WHERE Status IN ('pendente', 'imprimindo') AND DATEDIFF(hour, CriadoEm, SYSDATETIME()) >= 3
      aplicarContingencia3Horas(agora: Date): void {
        const tresHorasAtrasMs = 3 * 3600 * 1000;
        for (const j of this.jobs) {
          if ((j.status === 'pendente' || j.status === 'imprimindo') && agora.getTime() - j.criadoEm.getTime() >= tresHorasAtrasMs) {
            j.status = 'falhou';
            j.ultimoErro = 'contingencia';
          }
        }
      }

      // Simula proximaImpressao() com filtro de validade
      buscarProximoParaImprimir(agora: Date): JobRegistro | null {
        const cutoff3h = new Date(agora.getTime() - 3 * 3600 * 1000);
        const cutoff90s = new Date(agora.getTime() - 90 * 1000);

        const cand = this.jobs
          .filter((j) => {
            const pendenteValido = j.status === 'pendente' && j.criadoEm >= cutoff3h;
            const imprimindoTimeout = j.status === 'imprimindo' && j.pegoEm !== null && j.pegoEm < cutoff90s;
            return pendenteValido || imprimindoTimeout;
          })
          .sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime());

        if (cand.length === 0) return null;
        const target = cand[0];
        target.status = 'imprimindo';
        target.pegoEm = agora;
        target.tentativas++;
        return { ...target };
      }

      // Reimpressão com preservação estrita de CriadoEm (modelo legado/ingênuo)
      reimprimirSemRenovarCriadoEm(id: number): void {
        const j = this.jobs.find((x) => x.id === id);
        if (j) {
          j.status = 'pendente';
          j.pegoEm = null;
          j.tentativas = 0;
          j.ultimoErro = null;
        }
      }

      // Reimpressão com renovação de CriadoEm para SYSDATETIME() (modelo resiliente)
      reimprimirComRenovacaoCriadoEm(id: number, agora: Date): void {
        const j = this.jobs.find((x) => x.id === id);
        if (j) {
          j.status = 'pendente';
          j.criadoEm = agora;
          j.pegoEm = null;
          j.tentativas = 0;
          j.ultimoErro = null;
        }
      }
    }

    it('preserva dados no banco em caso de recepção fechada por mais de 3 horas sem descarte físico', () => {
      const sim = new FilaContingenciaSimulador();
      const t0 = new Date('2026-10-26T10:00:00Z');
      const job = sim.enfileirar('Termo Piloto Ausente', t0);

      // 4 horas depois (14:00) a contingência roda
      const t4h = new Date('2026-10-26T14:00:00Z');
      sim.aplicarContingencia3Horas(t4h);

      const jobAposContingencia = sim.jobs.find((j) => j.id === job.id);
      expect(jobAposContingencia).toBeDefined();
      expect(jobAposContingencia?.status).toBe('falhou');
      expect(jobAposContingencia?.ultimoErro).toBe('contingencia');
      // O registro continua existindo fisicamente (sem DELETE/splice)
      expect(sim.jobs).toHaveLength(1);
    });

    it('demonstra que a reimpressão de trabalho expirado requer renovação de CriadoEm para entrega na CTE', () => {
      const sim = new FilaContingenciaSimulador();
      const t0 = new Date('2026-10-26T08:00:00Z');
      const job = sim.enfileirar('Termo da Manhã', t0);

      // Às 12:00 (4h depois), vai para contingência
      const t12h = new Date('2026-10-26T12:00:00Z');
      sim.aplicarContingencia3Horas(t12h);
      expect(sim.jobs[0].status).toBe('falhou');

      // Se reimprimir SEM atualizar CriadoEm (mantendo 08:00):
      sim.reimprimirSemRenovarCriadoEm(job.id);
      expect(sim.jobs[0].status).toBe('pendente');
      // Porém na busca da CTE às 12:05, CriadoEm continua com mais de 3 horas!
      const t12_05 = new Date('2026-10-26T12:05:00Z');
      const entregaFalha = sim.buscarProximoParaImprimir(t12_05);
      expect(entregaFalha).toBeNull(); // NÂO entrega pois CriadoEm é 08:00

      // Se reimprimir COM renovação de CriadoEm = SYSDATETIME() (12:06):
      const t12_06 = new Date('2026-10-26T12:06:00Z');
      sim.reimprimirComRenovacaoCriadoEm(job.id, t12_06);
      expect(sim.jobs[0].status).toBe('pendente');
      expect(sim.jobs[0].criadoEm).toEqual(t12_06);

      // Agora a CTE às 12:06 captura o trabalho imediatamente!
      const entregaSucesso = sim.buscarProximoParaImprimir(t12_06);
      expect(entregaSucesso).not.toBeNull();
      expect(entregaSucesso?.id).toBe(job.id);
      expect(entregaSucesso?.status).toBe('imprimindo');
    });

    it('demonstra a diferença semântica entre DATEDIFF de fronteira de hora e duração real em segundos/minutos', () => {
      // No SQL Server, DATEDIFF(hour, '10:59:00', '13:00:01') conta passagens de fronteira de hora:
      // 10:59 -> 11:00 (1), 11:00 -> 12:00 (2), 12:00 -> 13:00 (3) = 3 fronteiras!
      // Apesar de apenas 2 horas, 1 minuto e 1 segundo terem decorrido fisicamente.
      function sqlServerDateDiffHourBoundaries(d1: Date, d2: Date): number {
        const h1 = d1.getUTCFullYear() * 8760 + d1.getUTCMonth() * 720 + d1.getUTCDate() * 24 + d1.getUTCHours();
        const h2 = d2.getUTCFullYear() * 8760 + d2.getUTCMonth() * 720 + d2.getUTCDate() * 24 + d2.getUTCHours();
        return h2 - h1;
      }

      const inicio = new Date('2026-10-26T10:59:00Z');
      const fim = new Date('2026-10-26T13:00:01Z');

      const diferencaFronteiras = sqlServerDateDiffHourBoundaries(inicio, fim);
      const diferencaMinutosReais = (fim.getTime() - inicio.getTime()) / (60 * 1000);

      // DATEDIFF(hour) acusa 3 horas:
      expect(diferencaFronteiras).toBe(3);
      // Enquanto a duração física real foi de apenas 121 minutos (~2h e 1min):
      expect(diferencaMinutosReais).toBeCloseTo(121.016, 1);

      // Conclusão empírica: CriadoEm >= DATEADD(hour, -3, SYSDATETIME()) é a forma sargable e temporalmente precisa.
    });
  });
});


