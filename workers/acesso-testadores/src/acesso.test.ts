import { describe, expect, it } from 'vitest';
import worker, { linkGrupo, type Env } from './index';

const env: Env = {
  GRUPO_TESTADORES: 'testadores-kartodromobetim@googlegroups.com',
  LINK_CLIENTE: 'https://play.google.com/apps/internaltest/1',
  LINK_OPERACAO: 'https://play.google.com/apps/testing/op',
};

const get = (path: string) => worker.fetch(new Request(`https://x${path}`), env);

describe('acesso-testadores', () => {
  it('monta link do grupo', () =>
    expect(linkGrupo(env.GRUPO_TESTADORES)).toBe('https://groups.google.com/g/testadores-kartodromobetim'));

  it('página pública mostra grupo e app cliente, sem Operação', async () => {
    const html = await (await get('/')).text();
    expect(html).toContain('https://groups.google.com/g/testadores-kartodromobetim');
    expect(html).toContain(env.LINK_CLIENTE);
    expect(html).not.toContain(env.LINK_OPERACAO);
  });

  it('?equipe mostra também a Operação', async () => {
    expect(await (await get('/?equipe')).text()).toContain(env.LINK_OPERACAO);
  });

  it('404 fora da raiz', async () => expect((await get('/x')).status).toBe(404));
});
