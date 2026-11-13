import { describe, expect, it } from 'vitest';
import { descreverAndamento, emCurso } from '../../lib/ops/andamento';

describe('o que está em curso (diagnóstico de travamento do event loop)', () => {
  it('lista as tarefas enquanto rodam e tira quando terminam, mesmo com erro', async () => {
    let soltar: () => void = () => undefined;
    const a = emCurso('pedidos', new Promise<void>((ok) => { soltar = ok; }));
    const b = emCurso('http GET /api/x', Promise.reject(new Error('x'))).catch(() => undefined);
    expect(descreverAndamento()).toMatch(/pedidos \d+,\ds/);
    await b;
    expect(descreverAndamento()).not.toContain('http GET');
    soltar(); await a;
    expect(descreverAndamento()).toBe('nada registrado');
  });
});
