import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Vínculo automático da conta do app com o cliente da recepção: CPF + (e-mail ou telefone).
const clientes = vi.hoisted(() => ({ linhas: [] as { id: number; email: string | null; telefone: string | null }[] }));
vi.mock('../../lib/ops/db', async () => {
  const real = await vi.importActual<typeof import('../../lib/ops/db')>('../../lib/ops/db');
  return { onlyDigits: real.onlyDigits, query: vi.fn(async () => clientes.linhas) };
});

const { clienteDaConta, mesmoTelefone, pedirVinculoAgora, vincularContasDoApp } = await import('../../lib/ops/app-mobile');

const conta = { email: 'Maria@Example.com', cpf: '529.982.247-25', phone: '(31) 98888-7777' };

describe('vínculo automático da conta do app', () => {
  beforeEach(() => {
    process.env.MOBILE_IDENTITY_LINK_URL = 'https://reservas.kartodromodebetim.com.br/api/mobile/v1/internal/identity-links';
    process.env.MOBILE_ADMIN_TOKEN = 'token-de-teste';
    pedirVinculoAgora(); // zera ciclo e backoff entre testes
  });
  afterEach(() => { vi.unstubAllGlobals(); clientes.linhas = []; });

  it('telefone igual com ou sem 9, +55 e máscara', () => {
    expect(mesmoTelefone('31988887777', '+55 (31) 98888-7777')).toBe(true);
    expect(mesmoTelefone('3188887777', '31988887777')).toBe(true);
    expect(mesmoTelefone('31988887777', '31988887778')).toBe(false);
    expect(mesmoTelefone('', '31988887777')).toBe(false);
  });

  it('CPF sozinho vincula no nível cpf; com e-mail ou telefone, completo', async () => {
    clientes.linhas = [{ id: 7, email: 'outra@example.com', telefone: '31977776666' }];
    expect(await clienteDaConta(conta)).toEqual({ id: 7, nivel: 'cpf' });
    clientes.linhas = [{ id: 7, email: 'maria@example.com', telefone: null }];
    expect(await clienteDaConta(conta)).toEqual({ id: 7, nivel: 'completo' });
    clientes.linhas = [{ id: 8, email: null, telefone: '(31) 98888-7777' }];
    expect(await clienteDaConta(conta)).toEqual({ id: 8, nivel: 'completo' });
    // vários cadastros no mesmo CPF: prefere o que bate o e-mail
    clientes.linhas = [{ id: 9, email: null, telefone: null }, { id: 10, email: 'maria@example.com', telefone: null }];
    expect(await clienteDaConta(conta)).toEqual({ id: 10, nivel: 'completo' });
    clientes.linhas = [];
    expect(await clienteDaConta(conta)).toBeNull();
  });

  it('conta já vinculada por CPF que continua só CPF não é reenviada', async () => {
    clientes.linhas = [{ id: 7, email: 'outra@example.com', telefone: null }];
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: URL | string) => {
      urls.push(String(url));
      if (String(url).endsWith('/identity-candidates')) return new Response(JSON.stringify([{ ...conta, nivel: 'cpf' }]), { status: 200 });
      return new Response('{"ok":true}', { status: 200 });
    }));
    expect(await vincularContasDoApp(vi.fn(), 50_000_000, true)).toBe(0);
    expect(urls.filter((u) => u.endsWith('/identity-links'))).toHaveLength(0);
  });

  it('busca as contas pendentes e vincula a que bateu, uma vez por minuto', async () => {
    clientes.linhas = [{ id: 42, email: 'maria@example.com', telefone: null }];
    const chamadas: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: URL | string, init?: RequestInit) => {
      chamadas.push({ url: String(url), init });
      if (String(url).endsWith('/identity-candidates')) return new Response(JSON.stringify([conta]), { status: 200 });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }));
    const log = vi.fn();
    expect(await vincularContasDoApp(log, 1_000_000)).toBe(1);
    expect(chamadas[0].url).toBe('https://reservas.kartodromodebetim.com.br/api/mobile/v1/internal/identity-candidates');
    expect(chamadas[0].init?.headers).toMatchObject({ 'x-mobile-admin-token': 'token-de-teste' });
    expect(JSON.parse(String(chamadas[1].init?.body))).toEqual({ customerId: '42', email: 'maria@example.com', nivel: 'completo' });
    // dentro do mesmo minuto não pergunta de novo
    expect(await vincularContasDoApp(log, 1_030_000)).toBe(0);
    expect(chamadas).toHaveLength(2);
  });

  it('sob demanda (forcar): vincula na hora, mesmo dentro do minuto, e publica o histórico', async () => {
    clientes.linhas = [{ id: 43, email: 'maria@example.com', telefone: null }];
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: URL | string) => {
      urls.push(String(url));
      if (String(url).endsWith('/identity-candidates')) return new Response(JSON.stringify([conta]), { status: 200 });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }));
    expect(await vincularContasDoApp(vi.fn(), 2_000_000)).toBe(1);
    // 5 s depois chega o sino: o ciclo de 60 s não segura
    expect(await vincularContasDoApp(vi.fn(), 2_005_000, true)).toBe(1);
    expect(urls.filter((u) => u.endsWith('/identity-links'))).toHaveLength(2);
  });

  it('desligado sem a configuração', async () => {
    delete process.env.MOBILE_ADMIN_TOKEN;
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect(await vincularContasDoApp(vi.fn(), 9_000_000)).toBe(0);
    expect(f).not.toHaveBeenCalled();
  });
});
