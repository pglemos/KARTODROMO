import { describe, expect, it } from 'vitest';
import worker, { linkGrupo, type Env } from './index';

const env: Env = {
  GRUPO_TESTADORES: 'testadores-kartodromobetim@googlegroups.com',
  LINK_CLIENTE: 'https://play.google.com/apps/testing/br.com.kartodromobetim.app',
};

const get = (path: string) => worker.fetch(new Request(`https://x${path}`), env);

describe('acesso-testadores', () => {
  it('monta link do grupo', () =>
    expect(linkGrupo(env.GRUPO_TESTADORES)).toBe('https://groups.google.com/g/testadores-kartodromobetim/about'));

  it('página mostra grupo e app cliente, sem Operação', async () => {
    const html = await (await get('/?equipe')).text();
    expect(html).toContain('https://groups.google.com/g/testadores-kartodromobetim/about');
    expect(html).toContain(env.LINK_CLIENTE);
    expect(html).not.toContain('operacional');
    expect(html).not.toContain('Operação');
  });

  it('404 fora da raiz', async () => expect((await get('/x')).status).toBe(404));
});
