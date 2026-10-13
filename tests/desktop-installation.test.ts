import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const installer = readFileSync(resolve(root, 'scripts/apps/instalar-desktop.ps1'), 'utf8');
const remoteInstaller = readFileSync(resolve(root, 'scripts/apps/implantar-remoto.ps1'), 'utf8');

describe('inicialização dos aplicativos desktop', () => {
  it('só coloca o Autoatendimento no logon quando isso é solicitado explicitamente', () => {
    expect(installer).toMatch(/if\s*\(\$IniciarNoLogon\)\s*\{/);
    expect(installer).not.toContain('$IniciarNoLogon -or $App -eq \'Autoatendimento\'');
  });

  it('o deploy remoto expõe a opção explícita de iniciar no logon', () => {
    expect(remoteInstaller).toContain('[switch]$IniciarNoLogon');
    expect(remoteInstaller).toContain('$extra.IniciarNoLogon = $true');
  });

  it('encerra a validação temporária do Totem quando o logon automático não foi pedido', () => {
    expect(remoteInstaller).toContain("if ($App -eq 'Autoatendimento' -and -not $IniciarNoLogon)");
    expect(remoteInstaller).toContain("Stop-Process -Force -ErrorAction SilentlyContinue");
    expect(remoteInstaller).toContain("Kartódromo Autoatendimento.lnk");
  });
});
