import { createHash } from 'node:crypto';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { emptyCatalog, normalizeCatalog, type TimingCatalog } from './catalog';
import type { Session } from './race-engine';

export interface TimingBackupFileEntry {
  path: string;
  bytes: number;
  sha256: string;
}

export interface TimingBackupManifest {
  version: string;
  createdAt: string;
  files: TimingBackupFileEntry[];
}

export interface TimingBackupResult {
  path: string;
  files: string[];
  manifest: TimingBackupManifest;
}

function calcularSha256(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Cria backup completo do diretório de dados da cronometragem,
 * incluindo sessões, passagens, catálogo, transponders, metas e regras de equalização,
 * e gera um manifesto com hash de integridade de todos os arquivos.
 * Credenciais confidenciais (email.json) não são incluídas no backup geral.
 */
export function createTimingBackup(dataDir: string, backupParentDir?: string): TimingBackupResult {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = join(backupParentDir || join(dataDir, 'backups'), `timing-${stamp}`);
  mkdirSync(target, { recursive: true });

  const manifestFiles: TimingBackupFileEntry[] = [];

  // 1. Diretórios com histórico
  for (const name of ['sessions', 'passagens']) {
    const source = join(dataDir, name);
    if (existsSync(source)) {
      const dest = join(target, name);
      cpSync(source, dest, { recursive: true, errorOnExist: false });
      // Registra arquivos do subdiretório no manifesto
      for (const file of readdirSync(dest)) {
        const fullPath = join(dest, file);
        if (statSync(fullPath).isFile()) {
          manifestFiles.push({
            path: join(name, file),
            bytes: statSync(fullPath).size,
            sha256: calcularSha256(fullPath),
          });
        }
      }
    }
  }

  // 2. Arquivos de configuração, catálogo, equalização e regras
  const arquivosParaBackup = [
    'transponders.json',
    'catalog.json',
    'settings.json',
    'equalizacao-metas.json',
    'equalizacao-regras.json',
  ];

  for (const name of arquivosParaBackup) {
    const source = join(dataDir, name);
    if (existsSync(source)) {
      const dest = join(target, name);
      copyFileSync(source, dest);
      manifestFiles.push({
        path: name,
        bytes: statSync(dest).size,
        sha256: calcularSha256(dest),
      });
    }
  }

  // 3. Manifesto de conteúdo
  const manifest: TimingBackupManifest = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    files: manifestFiles,
  };
  writeFileSync(join(target, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  return {
    path: target,
    files: readdirSync(target),
    manifest,
  };
}

/**
 * Restaura um backup em um diretório de destino.
 */
export function restoreTimingBackup(backupPath: string, targetDir: string): void {
  mkdirSync(targetDir, { recursive: true });
  cpSync(backupPath, targetDir, { recursive: true, errorOnExist: false });
}

/**
 * Carrega o catálogo de eventos de forma resiliente.
 * Se o arquivo estiver corrompido, preserva o arquivo corrompido intacto em uma cópia
 * com timestamp para análise e não permite sobrescrita automática com catálogo vazio.
 */
export function loadCatalogSafely(catalogFile: string): {
  catalog: TimingCatalog;
  isValid: boolean;
  corruptedPreservedPath?: string;
} {
  if (!existsSync(catalogFile)) {
    return { catalog: emptyCatalog(), isValid: true };
  }

  try {
    const raw = readFileSync(catalogFile, 'utf8');
    const parsed = JSON.parse(raw);
    const catalog = normalizeCatalog(parsed);
    return { catalog, isValid: true };
  } catch (_err) {
    // Arquivo corrompido ou inválido: preserva cópia
    const stamp = Date.now();
    const preservedPath = `${catalogFile}.corrompido-${stamp}`;
    copyFileSync(catalogFile, preservedPath);
    return {
      catalog: emptyCatalog(),
      isValid: false,
      corruptedPreservedPath: preservedPath,
    };
  }
}

/**
 * Grava o catálogo de eventos de forma atômica, recusando sobrescrever
 * caso a leitura inicial tenha sido corrompida.
 */
export function saveCatalogSafely(catalogFile: string, catalog: TimingCatalog, isValid: boolean): void {
  if (!isValid) {
    throw new Error('Catálogo corrompido preservado. Não é permitido sobrescrever sem recuperação ou confirmação.');
  }
  const tmp = `${catalogFile}.tmp`;
  writeFileSync(tmp, JSON.stringify(catalog, null, 1), 'utf8');
  renameSync(tmp, catalogFile);
}

export interface ProcessarPassagemParams {
  passing: {
    sequence?: number | null;
    transponder?: number | null;
    decoderTimeMs?: number | null;
    raw?: string | null;
  };
  session: Session | null;
  kart: string | null;
  wallMs: number;
  journal: (entry: Record<string, unknown>) => void;
  applyEngine: () => string;
  saveSession: (s: Session) => void;
  onAlarm: (msg: string, err: unknown) => void;
}

/**
 * Processa a passagem com garantia estrita da ordem:
 * 1. Diário bruto (fonte primária persistida em disco antes de qualquer falha)
 * 2. Aplicação no motor
 * 3. Gravação da sessão com captura e alarme operacional em caso de erro de I/O
 */
export function processarPassagemSegura(params: ProcessarPassagemParams): { result: string } {
  const { passing, session, kart, wallMs, journal, applyEngine, saveSession, onAlarm } = params;

  // 1. Diário primeiro: registra a passagem bruta em disco
  journal({
    wallMs,
    raw: passing.raw,
    transponder: passing.transponder,
    kart,
    decoderTimeMs: passing.decoderTimeMs,
    seq: passing.sequence,
    sessionId: session?.id ?? null,
  });

  // 2. Aplicação no motor
  const result = applyEngine();

  // 3. Salva a sessão; falhas de disco geram alarme operacional sem derrubar o processo
  if (session) {
    try {
      saveSession(session);
    } catch (err) {
      onAlarm(`ALARME OPERACIONAL: falha ao salvar sessão ${session.id} em disco: ${(err as Error).message}`, err);
    }
  }

  return { result };
}
