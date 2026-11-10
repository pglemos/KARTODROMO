import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { renderTermoResponsabilidade } from '../../lib/ops/termo';

const source = readFileSync('services/ops-server.ts', 'utf8');
function carregar(nome: string, fim: string, deps: Record<string, unknown>) {
  const trecho = source.slice(source.indexOf(`async function ${nome}(`), source.indexOf(fim, source.indexOf(`async function ${nome}(`)));
  const js = ts.transpileModule(trecho, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  return runInNewContext(js + `; ${nome}`, { URL, URLSearchParams, ...deps });
}

describe('ligações do servidor para termo e grupos do totem', () => {
  it('consulta bateria e responsável da vaga e imprime somente o primeiro nome', async () => {
    const query = vi.fn().mockResolvedValueOnce([{ nome: 'TESTE CODEX', bateriaNome: 'BATERIA 19:20', grupoResponsavel: 'Marcus' }]).mockResolvedValue([]);
    const termo = carregar('termoHtml', '// ---------------------------------------------------------------- fila', {
      one: async () => ({ nome: 'Kartódromo', razaoSocial: null, cidade: 'Betim' }), query,
      TERMO_FILE: '', renderTermoResponsabilidade,
    });
    const html = await termo([42]);
    expect(query.mock.calls[0][0]).toContain('b.Nome bateriaNome');
    expect(query.mock.calls[0][0]).toContain('grupo.responsavel grupoResponsavel');
    expect(query.mock.calls[0][0]).toContain('gp.InscricaoId = i.Id');
    expect(query.mock.calls[0][0]).toContain('CHARINDEX');
    expect(html).toContain('BATERIA 19:20');
    expect(html).toContain('GRUPO DO(A) MARCUS');
    expect(html).not.toContain('colegas');
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('retorna os grupos disponíveis pela rota pública', async () => {
    const send = vi.fn();
    const grupos = [{ id: 7, responsavel: 'Marcus', aguardando: 2 }];
    const route = carregar('totemRoutes', '// ---------------------------------------------------------------- login', { send, gruposDoDiaNoTotem: async () => grupos });
    expect(await route({ method: 'GET' }, {}, '/api/totem/grupos')).toBe(true);
    expect(send).toHaveBeenCalledWith({}, 200, grupos);
  });

  it('recusa ingresso em grupo sem o token do participante', async () => {
    const entrar = vi.fn();
    const route = carregar('totemRoutes', '// ---------------------------------------------------------------- login', {
      readBody: async () => ({ grupoId: 7, clienteId: 42, token: 'invalido' }),
      int: Number, sign: () => 'valido', HttpError: Error, entrarNoGrupoPeloTotem: entrar,
    });
    await expect(route({ method: 'POST' }, {}, '/api/totem/grupo/entrar')).rejects.toThrow();
    expect(entrar).not.toHaveBeenCalled();
  });
});


it('preserva a fila e os identificadores após reiniciar, com gravação atômica', () => {
  const files = new Map<string, string>();
  const trecho = source.slice(source.indexOf('type Impressao ='), source.indexOf('/**\n * Quem se identificou'));
  const js = ts.transpileModule(trecho, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const deps = {
    join: (...parts: string[]) => parts.join('/'), process: { cwd: () => '/tmp/TESTE-CODEX' },
    existsSync: (p: string) => files.has(p), readFileSync: (p: string) => files.get(p),
    dirname: () => '/tmp/TESTE-CODEX/.runtime', mkdirSync() {}, log() {},
    writeFileSync: (p: string, value: string) => files.set(p, value),
    renameSync: (a: string, b: string) => { files.set(b, files.get(a)!); files.delete(a); },
  };
  const abrir = () => runInNewContext(js + '; ({ enfileirarImpressao, proximaImpressao })', { ...deps });
  const fila = abrir();
  expect(fila.enfileirarImpressao('/termo?ids=42', 'TESTE CODEX', 'teste').id).toBe(1);
  expect(fila.proximaImpressao().id).toBe(1);
  const reaberta = abrir();
  expect(reaberta.proximaImpressao()).toBeNull();
  expect(reaberta.enfileirarImpressao('/termo?ids=43', 'TESTE CODEX', 'teste').id).toBe(2);
  expect(reaberta.proximaImpressao().id).toBe(2);
  expect([...files.keys()]).toEqual(['/tmp/TESTE-CODEX/.runtime/impressao-fila.json']);
  const path = '/tmp/TESTE-CODEX/.runtime/impressao-fila.json';
  const canceladas = JSON.parse(files.get(path)!);
  canceladas.forEach((job: { canceladaEm?: number }) => { job.canceladaEm = Date.now(); });
  files.set(path, JSON.stringify(canceladas));
  expect(abrir().proximaImpressao()).toBeNull();

  // se o arquivo tiver sujeira de PowerShell ou id null, saneia e nunca gera NaN
  files.set(path, JSON.stringify([{ value: [{ id: 10 }] }, { id: null, url: '/termo?ids=99', criadoEm: Date.now() }]));
  const saneada = abrir();
  const proximo = saneada.proximaImpressao();
  expect(proximo).not.toBeNull();
  expect(Number.isFinite(proximo.id)).toBe(true);
  expect(proximo.id).toBeGreaterThan(0);
  const novo = saneada.enfileirarImpressao('/termo?ids=100', 'Novo', 'totem');
  expect(Number.isFinite(novo.id)).toBe(true);
  expect(novo.id).toBeGreaterThan(proximo.id);
});

describe('impressão local por totem', () => {
  it.each([true, false, undefined])('roteia impressaoLocal=%s sem duplicar na recepção', async (impressaoLocal) => {
    const send = vi.fn();
    const fila = vi.fn();
    const route = carregar('totemRoutes', '// ---------------------------------------------------------------- login', {
      send, readBody: async () => ({ bateriaIds: [1, 2], participantes: [{ id: 42, token: 'valido' }, { id: 43, token: 'valido' }], impressaoLocal }),
      int: Number, sign: () => 'valido', HttpError: Error, log: vi.fn(),
      one: async (sql: string, params: Record<string, number>) => sql.includes('dbo.Inscricao') ? { Id: params.b * 100 + params.c } : { inicio: '2026-11-07T19:00' },
      parametros: async () => ({}), query: async () => [],
      termoLink: (ids: number[]) => '/termo?ids=' + ids.join(','),
      enfileirarImpressao: fila, origemDe: () => 'Totem 2',
    });
    await route({ method: 'POST' }, {}, '/api/totem/inscrever');
    expect(send).toHaveBeenCalledWith({}, 201, expect.objectContaining({
      termoNaRecepcao: impressaoLocal !== true,
      termoUrls: ['/termo?ids=142', '/termo?ids=143'],
    }));
    expect(fila).toHaveBeenCalledTimes(impressaoLocal === true ? 0 : 2);
  });
});
