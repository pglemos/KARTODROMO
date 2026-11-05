import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createTimingBackup,
  loadCatalogSafely,
  processarPassagemSegura,
  restoreTimingBackup,
  saveCatalogSafely,
} from '../lib/timing/persistence';
import type { Session } from '../lib/timing/race-engine';

describe('Tarefa 7 [F13, F14]: Backup completo, resiliência de disco e integridade', () => {
  let tmpDataDir: string;

  beforeEach(() => {
    tmpDataDir = mkdtempSync(join(tmpdir(), 'timing-persist-'));
    mkdirSync(join(tmpDataDir, 'sessions'), { recursive: true });
    mkdirSync(join(tmpDataDir, 'passagens'), { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(tmpDataDir, { recursive: true, force: true });
    } catch {
      // Ignora erro de limpeza
    }
  });

  it('backup_inclui_metas_regras', () => {
    // 1. Cria arquivos de configuração e regras de equalização
    const metasConteudo = JSON.stringify({ metas: [{ trackId: '1', metaSeg: 55.5 }] }, null, 2);
    const regrasConteudo = JSON.stringify({ regras: [{ id: 'r1', nome: 'Padrão' }] }, null, 2);
    const catalogoConteudo = JSON.stringify({ events: [], groups: [], provas: [] }, null, 2);

    writeFileSync(join(tmpDataDir, 'equalizacao-metas.json'), metasConteudo, 'utf8');
    writeFileSync(join(tmpDataDir, 'equalizacao-regras.json'), regrasConteudo, 'utf8');
    writeFileSync(join(tmpDataDir, 'catalog.json'), catalogoConteudo, 'utf8');
    writeFileSync(join(tmpDataDir, 'sessions', 'sess-1.json'), JSON.stringify({ id: 'sess-1' }), 'utf8');
    writeFileSync(join(tmpDataDir, 'passagens', '2026-10-06.jsonl'), '{"wallMs":1000}\n', 'utf8');

    // 2. Executa o backup
    const backupRes = createTimingBackup(tmpDataDir);
    expect(existsSync(backupRes.path)).toBe(true);

    // 3. Verifica que metas, regras e manifesto estão presentes no backup
    const backupMetas = join(backupRes.path, 'equalizacao-metas.json');
    const backupRegras = join(backupRes.path, 'equalizacao-regras.json');
    const backupManifest = join(backupRes.path, 'manifest.json');

    expect(existsSync(backupMetas)).toBe(true);
    expect(existsSync(backupRegras)).toBe(true);
    expect(existsSync(backupManifest)).toBe(true);

    // Conteúdo deve ser byte-a-byte idêntico
    expect(readFileSync(backupMetas, 'utf8')).toBe(metasConteudo);
    expect(readFileSync(backupRegras, 'utf8')).toBe(regrasConteudo);

    // Manifesto deve conter lista de arquivos com hash
    const manifest = JSON.parse(readFileSync(backupManifest, 'utf8'));
    expect(manifest.version).toBe('1.0');
    expect(Array.isArray(manifest.files)).toBe(true);
    const nomesArquivos = manifest.files.map((f: any) => f.path);
    expect(nomesArquivos).toContain('equalizacao-metas.json');
    expect(nomesArquivos).toContain('equalizacao-regras.json');
    expect(nomesArquivos).toContain('catalog.json');

    // 4. Testa restauração em outra pasta temporária
    const tmpRestoreDir = mkdtempSync(join(tmpdir(), 'timing-restore-'));
    try {
      restoreTimingBackup(backupRes.path, tmpRestoreDir);
      expect(readFileSync(join(tmpRestoreDir, 'equalizacao-metas.json'), 'utf8')).toBe(metasConteudo);
      expect(readFileSync(join(tmpRestoreDir, 'equalizacao-regras.json'), 'utf8')).toBe(regrasConteudo);
      expect(existsSync(join(tmpRestoreDir, 'sessions', 'sess-1.json'))).toBe(true);
      expect(existsSync(join(tmpRestoreDir, 'passagens', '2026-10-06.jsonl'))).toBe(true);
    } finally {
      rmSync(tmpRestoreDir, { recursive: true, force: true });
    }
  });

  it('falha_save_session_preserva_passagem_bruta', () => {
    const journalEntries: any[] = [];
    let saveSessionChamado = false;
    let alarmeDisparado = false;

    const fakeJournal = (entry: Record<string, unknown>) => {
      journalEntries.push(entry);
    };

    const fakeSaveSession = (_s: Session) => {
      saveSessionChamado = true;
      // Injeta falha de I/O de disco
      throw new Error('ENOSPC: no space left on device');
    };

    const onAlarm = (msg: string, _err: unknown) => {
      alarmeDisparado = true;
      expect(msg).toContain('ALARME OPERACIONAL');
    };

    const fakeSession = {
      id: 'sess-falha-io',
      name: 'Teste Falha IO',
      type: 'treino',
      state: 'em_andamento',
      durationMs: 600000,
      createdAt: Date.now(),
      competitors: [{ kart: '4', name: 'Piloto', finished: false, crossings: [] }],
    } as unknown as Session;

    const fakePassing = {
      sequence: 1,
      transponder: 12345,
      decoderTimeMs: 50000,
      raw: 'trx-raw-passing',
    };

    // Executa a passagem com ordem segura: diário -> motor -> sessão
    expect(() => {
      processarPassagemSegura({
        passing: fakePassing,
        session: fakeSession,
        kart: '4',
        wallMs: 1234567,
        journal: fakeJournal,
        applyEngine: () => 'counted',
        saveSession: fakeSaveSession,
        onAlarm,
      });
    }).not.toThrow(); // Falha de disco NÃO pode escapar e derrubar o serviço Node

    // Diário DEVE ter recebido a passagem bruta antes da falha da sessão
    expect(journalEntries.length).toBe(1);
    expect(journalEntries[0].transponder).toBe(12345);
    expect(journalEntries[0].raw).toBe('trx-raw-passing');

    // saveSession foi tentado e gerou alarme
    expect(saveSessionChamado).toBe(true);
    expect(alarmeDisparado).toBe(true);
  });

  it('catalogo_invalido_nao_e_sobrescrito', () => {
    const catalogFile = join(tmpDataDir, 'catalog.json');
    const conteudoCorrompido = '{"events": [invalido';
    writeFileSync(catalogFile, conteudoCorrompido, 'utf8');

    // 1. Carregamento seguro detecta que o arquivo é inválido
    const { catalog, isValid, corruptedPreservedPath } = loadCatalogSafely(catalogFile);
    expect(isValid).toBe(false);
    expect(corruptedPreservedPath).toBeDefined();
    expect(existsSync(corruptedPreservedPath!)).toBe(true);
    expect(readFileSync(corruptedPreservedPath!, 'utf8')).toBe(conteudoCorrompido);

    // 2. Tentativa de salvar sem autorização explícita recusa sobrescrever o arquivo original corrompido
    expect(() => {
      saveCatalogSafely(catalogFile, catalog, false);
    }).toThrow(/Catálogo corrompido preservado/);

    // O arquivo corrompido original permanece com o conteúdo intacto (não foi sobrescrito por {})
    expect(readFileSync(catalogFile, 'utf8')).toBe(conteudoCorrompido);
  });
});
