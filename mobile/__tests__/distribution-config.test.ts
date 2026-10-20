import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const mobileRoot = resolve(__dirname, '..');
const repoRoot = resolve(mobileRoot, '..');
const appJsonPath = resolve(mobileRoot, 'app.json');
const easJsonPath = resolve(mobileRoot, 'eas.json');
const workflowPath = resolve(repoRoot, '.github/workflows/mobile.yml');
const privacyPagePath = resolve(repoRoot, 'app/privacidade/page.tsx');
const registrationPath = resolve(mobileRoot, 'src/app/(auth)/cadastro.tsx');
const testMonorepo = existsSync(resolve(repoRoot, 'workers/pre-cadastro/src/index.ts')) ? it : it.skip;

interface AppConfig {
  expo?: {
    icon?: string;
    ios?: { bundleIdentifier?: string; icon?: string; buildNumber?: string };
    android?: { package?: string; versionCode?: number; adaptiveIcon?: { foregroundImage?: string } };
  };
}

interface EasConfig {
  cli?: { appVersionSource?: string };
  build?: {
    development?: { distribution?: string };
    preview?: { distribution?: string; android?: { buildType?: string } };
    'store-preview'?: { distribution?: string; autoIncrement?: boolean; android?: { buildType?: string }; env?: Record<string, string> };
    production?: { env?: Record<string, string> };
  };
  submit?: {
    preview?: { android?: { track?: string } };
    production?: { ios?: { ascAppId?: string } };
  };
}

function readJson<T>(path: string): T | null {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as T : null;
}

describe('configuração de distribuição móvel', () => {
  it('QA interno na homologação isolada; TestFlight/Play interno e loja no servidor real', () => {
    const eas = readJson<{ build: Record<string, { env?: Record<string, string> }> }>(easJsonPath)!;
    for (const profile of ['development', 'preview']) {
      expect(eas.build[profile].env?.EXPO_PUBLIC_API_URL).toBe('https://kartodromo-mobile-homolog.kartodromo.workers.dev');
    }
    // 20/10/2026: o backend do app está em produção (reservas, resultados, ao vivo); o build que vai para o
    // TestFlight e para a faixa interna do Google Play usa o mesmo servidor da loja (sem URL = produção).
    expect(eas.build['store-preview'].env?.EXPO_PUBLIC_API_URL).toBeUndefined();
    expect(eas.build.production.env?.EXPO_PUBLIC_API_URL).toBeUndefined();
  });
  it('usa o mesmo identificador nas lojas e aponta para a política pública', () => {
    const expo = readJson<AppConfig>(appJsonPath)?.expo;
    const registration = readFileSync(registrationPath, 'utf8');
    expect(expo?.ios?.bundleIdentifier).toBe('br.com.kartodromobetim.app');
    expect(expo?.ios?.buildNumber).toBe('1');
    expect(expo?.android?.package).toBe('br.com.kartodromobetim.app');
    expect(expo?.android?.versionCode).toBe(1);
    expect(expo?.icon).toBe('./assets/app-icon.png');
    expect(existsSync(resolve(mobileRoot, 'assets/app-icon.png'))).toBe(true);
    expect(expo?.android?.adaptiveIcon?.foregroundImage).toBe('./assets/adaptive-icon.png');
    expect(existsSync(resolve(mobileRoot, 'assets/adaptive-icon.png'))).toBe(true);
    expect(registration).toContain('https://reservas.kartodromodebetim.com.br/privacidade');
  });

  testMonorepo('[monorepo] inclui a política pública no site', () => {
    expect(existsSync(privacyPagePath)).toBe(true);
  });

  it('separa builds internos, desliga o modo demo nas lojas e configura só o ascAppId no envio iOS', () => {
    const eas = readJson<EasConfig>(easJsonPath);
    expect(eas?.cli?.appVersionSource).toBe('remote');
    expect(eas?.build?.development?.distribution).toBe('internal');
    expect(eas?.build?.preview?.distribution).toBe('internal');
    expect(eas?.build?.preview?.android?.buildType).toBe('apk');
    expect(eas?.build?.['store-preview']?.distribution).toBe('store');
    expect(eas?.build?.['store-preview']?.autoIncrement).toBe(true);
    expect(eas?.build?.['store-preview']?.android?.buildType).toBe('app-bundle');
    expect(eas?.build?.production).toBeDefined();
    expect(eas?.submit?.preview?.android?.track).toBe('internal');
    expect(eas?.submit?.production?.ios?.ascAppId).toBe('6824677679');
    expect(JSON.stringify(eas?.submit)).not.toMatch(/AuthKey|\.p8|ascApiKey/);
    expect(eas?.build?.production?.env?.EXPO_PUBLIC_DEMO_MODE).toBe('0');
    expect(eas?.build?.['store-preview']?.env?.EXPO_PUBLIC_DEMO_MODE).toBe('0');
  });

  it('exporta iOS e Android sem exigir um bundle web', () => {
    const mobilePackage = readJson<{ scripts?: { export?: string; doctor?: string } }>(resolve(mobileRoot, 'package.json'));
    expect(mobilePackage?.scripts?.export).toContain('expo export --platform ios');
    expect(mobilePackage?.scripts?.export).toContain('expo export --platform android');
    expect(mobilePackage?.scripts?.export).not.toContain('--platform all');
    expect(mobilePackage?.scripts?.doctor).toBe('npx expo-doctor');
  });

  testMonorepo('[monorepo] exporta o app na CI', () => {
    expect(readFileSync(workflowPath, 'utf8')).toContain('run: npm run export');
  });

  testMonorepo('[monorepo] aciona a CI para APIs, operação, migrações e testes do app', () => {
    const workflow = existsSync(workflowPath) ? readFileSync(workflowPath, 'utf8') : '';
    expect(workflow).toContain('"workers/pre-cadastro/**"');
    expect(workflow).toContain('"lib/ops/**"');
    expect(workflow).toContain('"services/ops-server.ts"');
    expect(workflow).toContain('"migrations/ops/**"');
    expect(workflow).toContain('"desktop/src/Kartodromo.Cronometragem/**"');
    expect(workflow).toContain('"desktop/src/Kartodromo.Recepcao/**"');
    expect(workflow).toContain('"tests/**"');
  });

  testMonorepo('[monorepo] usa a opção serial suportada pelo Vitest na suíte raiz', () => {
    const workflow = existsSync(workflowPath) ? readFileSync(workflowPath, 'utf8') : '';
    expect(workflow).toContain('npm test -- --maxWorkers=1');
    expect(workflow).not.toContain('--minWorkers');
  });

  it('mantém segredos fora da configuração do app', () => {
    const eas = readJson<EasConfig>(easJsonPath);
    const clientConfig = `${readFileSync(appJsonPath, 'utf8')}\n${JSON.stringify(eas ?? {})}`;
    expect(clientConfig).not.toMatch(/MOBILE_(?:PUBLISH|ADMIN)_TOKEN|ASAAS_API_KEY|RESEND_API_KEY|EXPO_TOKEN/);
  });

  testMonorepo('[monorepo] usa apenas o secret EXPO_TOKEN na automação mobile', () => {
    const workflow = readFileSync(workflowPath, 'utf8');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('secrets.EXPO_TOKEN');
    expect(workflow).toContain('build --platform all --profile preview --non-interactive');
    expect(workflow).toContain('expo-doctor');
    expect(workflow).not.toContain('expo export --platform all');
  });
});
