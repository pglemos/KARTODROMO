import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONFIG_PADRAO, configPublica, lerConfig, sanitizarNomeDestinatario, semEmailAosPilotos, validarEmailDestinatario, salvarConfig } from '../services/timing-email';
import type { Session } from '../lib/timing/race-engine';
import { chaveOperadorValida, clienteEhMaquinaOperadora } from '../lib/timing/operator-auth';

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function configFile() {
  const dir = mkdtempSync(join(tmpdir(), 'kart-email-'));
  dirs.push(dir);
  return join(dir, 'email.json');
}

describe('confiabilidade e segurança do email', () => {
  it('exige uma chave configurada e compara a credencial de operador com segurança', () => {
    expect(chaveOperadorValida('chave-local', 'chave-local')).toBe(true);
    expect(chaveOperadorValida('chave-errada', 'chave-local')).toBe(false);
    expect(chaveOperadorValida('chave-local', undefined)).toBe(false);
    expect(clienteEhMaquinaOperadora('::ffff:192.168.20.13', 'CRONO1', 'crono1', ['192.168.20.13'])).toBe(true);
    expect(clienteEhMaquinaOperadora('192.168.20.14', 'CRONO1', 'crono1', ['192.168.20.13'])).toBe(false);
    expect(clienteEhMaquinaOperadora('192.168.20.13', 'outra-maquina', 'crono1', ['192.168.20.13'])).toBe(false);
  });
  it('reativa automaticamente provas 100 Milhas antigas marcadas para não enviar', () => {
    const sessao = { id: 'teste', name: '100 Milhas - Corrida', semEmailPilotos: true } as Session;
    expect(semEmailAosPilotos(sessao, '100 Milhas')).toBe(false);
    expect(semEmailAosPilotos({ ...sessao, name: 'Tabajara', semEmailPilotos: true } as Session)).toBe(true);
  });

  it('rejeita cabeçalhos injetáveis e normaliza emails de destinatário', () => {
    expect(validarEmailDestinatario(' piloto@example.com ')).toBe('piloto@example.com');
    expect(validarEmailDestinatario('piloto@example.com\r\nBcc: fraud@example.com')).toBeNull();
    expect(sanitizarNomeDestinatario('João\r\n<Bcc: x>')).toBe('João Bcc: x');
  });

  it('não retorna a senha SMTP, mas mantém os campos necessários para editar a configuração autenticada', () => {
    const publico = configPublica({ ...CONFIG_PADRAO, host: 'smtp.private.test', usuario: 'conta@private.test', senha: 'segredo', copiaOculta: 'oculta@private.test' });
    expect(publico).not.toHaveProperty('senha');
    expect(publico.host).toBe('smtp.private.test');
    expect(publico.usuario).toBe('conta@private.test');
    expect(publico.senhaDefinida).toBe(true);
  });

  it('descarta configuração malformada para valores padrão e rejeita porta não SMTP', () => {
    const file = configFile();
    writeFileSync(file, '{ quebrado');
    expect(lerConfig(file)).toEqual(CONFIG_PADRAO);
    expect(() => salvarConfig(file, { ...CONFIG_PADRAO, porta: 2525 })).toThrow(/porta|TLS/i);
  });

  it('grava a configuração final em JSON válido sem deixar o temporário', () => {
    const file = configFile();
    const saved = salvarConfig(file, { host: 'smtp.example.com', porta: 587, usuario: 'kart@example.com', senha: 'nova-senha' });
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(saved);
  });
});
