import { beforeEach, describe, expect, it } from 'vitest';
import { abrirStore, type AppStore } from '../../lib/app-v1/store';
import { autenticar, bloquearUsuario, criarUsuario, login, LoginRecusado, pode, renovar, sair, type Relogio } from '../../lib/app-v1/auth';

const SEGREDO = 'segredo-de-teste-com-tamanho-suficiente';
describe('login, sessão e perfis', () => {
  let store: AppStore;
  let agora: number;
  const ctx = (): { store: AppStore; segredo: string; relogio: Relogio } => ({ store, segredo: SEGREDO, relogio: () => agora });
  const SENHA = 'senha-de-teste-123';

  beforeEach(async () => {
    store = abrirStore(':memory:');
    agora = 1_000_000;
    await criarUsuario(ctx(), { usuario: 'ana', nome: 'Ana', perfil: 'OPERACAO', senha: SENHA });
  });

  it('entra e autentica com o token', async () => {
    const t = await login(ctx(), 'ana', SENHA, 'tablet-1');
    expect(autenticar(ctx(), `Bearer ${t.accessToken}`)).toMatchObject({ usuario: 'ana', perfil: 'OPERACAO', deviceId: 'tablet-1' });
  });

  it('senha errada e usuário inexistente recusados igualmente', async () => {
    await expect(login(ctx(), 'ana', 'errada-errada', 'x')).rejects.toBeInstanceOf(LoginRecusado);
    await expect(login(ctx(), 'nao-existe', 'errada-errada', 'x')).rejects.toBeInstanceOf(LoginRecusado);
  });

  it('não guarda senha em texto', () => {
    const u = store.db.prepare(`SELECT senhaHash FROM usuarios WHERE usuario='ana'`).get() as { senhaHash: string };
    expect(u.senhaHash).not.toContain(SENHA);
  });

  it('5 erros seguidos atrasam o login, mesmo com a senha certa', async () => {
    for (let i = 0; i < 5; i++) await login(ctx(), 'ana', 'errada-errada', 'x').catch(() => null);
    await expect(login(ctx(), 'ana', SENHA, 'x')).rejects.toBeInstanceOf(LoginRecusado);
    agora += 31_000;
    await expect(login(ctx(), 'ana', SENHA, 'x')).resolves.toBeTruthy();
  });

  it('token expira em 15 minutos e cabeçalho inválido não autentica', async () => {
    const t = await login(ctx(), 'ana', SENHA, 'x');
    agora += 15 * 60_000 + 1;
    expect(autenticar(ctx(), `Bearer ${t.accessToken}`)).toBeNull();
    expect(autenticar(ctx(), undefined)).toBeNull();
    expect(autenticar(ctx(), 'Bearer a.b')).toBeNull();
  });

  it('token assinado com outro segredo não autentica', async () => {
    const t = await login(ctx(), 'ana', SENHA, 'x');
    expect(autenticar({ ...ctx(), segredo: 'outro-segredo-qualquer-de-teste-123' }, `Bearer ${t.accessToken}`)).toBeNull();
  });

  it('renova com rotação; refresh reutilizado revoga a sessão', async () => {
    const t1 = await login(ctx(), 'ana', SENHA, 'x');
    const t2 = renovar(ctx(), t1.refreshToken);
    expect(t2.refreshToken).not.toBe(t1.refreshToken);
    agora += 61_000;
    expect(() => renovar(ctx(), t1.refreshToken)).toThrow(LoginRecusado);
    expect(autenticar(ctx(), `Bearer ${t2.accessToken}`)).toBeNull();
    expect(() => renovar(ctx(), t2.refreshToken)).toThrow(LoginRecusado);
  });

  it('sessão expira no prazo absoluto de 12 h mesmo com renovações', async () => {
    let t = await login(ctx(), 'ana', SENHA, 'x');
    for (let h = 0; h < 11; h++) { agora += 3_600_000; t = renovar(ctx(), t.refreshToken); }
    agora += 3_600_000 + 1;
    expect(() => renovar(ctx(), t.refreshToken)).toThrow(LoginRecusado);
    expect(autenticar(ctx(), `Bearer ${t.accessToken}`)).toBeNull();
  });

  it('bloqueado recusado no pedido seguinte', async () => {
    const t = await login(ctx(), 'ana', SENHA, 'x');
    bloquearUsuario(ctx(), 'ana', true);
    expect(autenticar(ctx(), `Bearer ${t.accessToken}`)).toBeNull();
    expect(() => renovar(ctx(), t.refreshToken)).toThrow(LoginRecusado);
    await expect(login(ctx(), 'ana', SENHA, 'x')).rejects.toBeInstanceOf(LoginRecusado);
  });

  it('sair revoga a sessão', async () => {
    const t = await login(ctx(), 'ana', SENHA, 'x');
    const id = autenticar(ctx(), `Bearer ${t.accessToken}`)!;
    sair(ctx(), id.sessaoId);
    expect(autenticar(ctx(), `Bearer ${t.accessToken}`)).toBeNull();
  });

  it('o laço de eventos segue respondendo durante vários logins simultâneos', async () => {
    let voltas = 0;
    const timer = setInterval(() => { voltas++; }, 1);
    await Promise.all(Array.from({ length: 4 }, () => login(ctx(), 'ana', SENHA, 'x')));
    clearInterval(timer);
    expect(voltas).toBeGreaterThan(3);
  });

  it('matriz de capacidades', () => {
    expect(pode('RECEPCAO', 'kart.trocar')).toBe(false);
    expect(pode('OPERACAO', 'usuarios.gerir')).toBe(false);
    expect(pode('GERENCIA', 'kart.trocar')).toBe(true);
    expect(pode('GERENCIA', 'usuarios.gerir')).toBe(true);
    expect(pode('RECEPCAO', 'sessoes.ver')).toBe(true);
    for (const p of ['RECEPCAO', 'OPERACAO', 'GERENCIA'] as const) expect(pode(p, 'recepcao.aprovar')).toBe(false);
    expect(pode('RECEPCAO', 'inexistente')).toBe(false);
  });
});

describe('correções da revisão: login', () => {
  const SENHA = 'senha-de-teste-123';
  it('refresh perdido: reenvio em até 60 s não revoga; depois disso revoga', async () => {
    const store = abrirStore(':memory:'); let agora = 1_000_000;
    const c = { store, segredo: SEGREDO, relogio: () => agora };
    await criarUsuario(c, { usuario: 'ana', nome: 'Ana', perfil: 'OPERACAO', senha: SENHA });
    const t1 = await login(c, 'ana', SENHA, 'x');
    renovar(c, t1.refreshToken); // resposta perdida
    agora += 30_000;
    const t3 = renovar(c, t1.refreshToken);
    expect(autenticar(c, `Bearer ${t3.accessToken}`)).toBeTruthy();
    agora += 61_000;
    expect(() => renovar(c, t1.refreshToken)).toThrow(LoginRecusado);
    expect(autenticar(c, `Bearer ${t3.accessToken}`)).toBeNull();
  });
  it('logins errados em paralelo contam todos e atrasam', async () => {
    const store = abrirStore(':memory:'); const c = { store, segredo: SEGREDO, relogio: () => 5_000 };
    await criarUsuario(c, { usuario: 'ana', nome: 'Ana', perfil: 'OPERACAO', senha: SENHA });
    await Promise.all(Array.from({ length: 5 }, () => login(c, 'ana', 'errada-errada', 'x').catch(() => null)));
    await expect(login(c, 'ana', SENHA, 'x')).rejects.toBeInstanceOf(LoginRecusado);
  });
});
