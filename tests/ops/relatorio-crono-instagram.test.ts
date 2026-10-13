import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { acrescentarInstagramRelatorio, idsClientesRelatorio, prepararRelatorioRecepcao } from '../../lib/ops/relatorio-crono';

describe('Instagram no resultado final da recepção', () => {
  it('usa o ID do piloto, preserva a classificação e acompanha o kart novo', () => {
    const s = { name: 'TESTE CODEX', competitors: [{ kart: '20', customerId: '7', name: 'Mesmo nome' }, { kart: '14', customerId: '8', name: 'Mesmo nome' }], standings: [{ kart: '20', position: 1, laps: 12 }, { kart: '14', position: 2, laps: 10 }] };
    const r = acrescentarInstagramRelatorio(s, [{ id: 8, instagram: '@outro' }, { id: 7, instagram: '@piloto' }]);
    expect(r.standings).toEqual([{ ...s.standings[0], instagram: '@piloto' }, { ...s.standings[1], instagram: '@outro' }]);
    expect(s.standings[0]).not.toHaveProperty('instagram');
    expect(idsClientesRelatorio(s)).toEqual([7, 8]);
  });
  it('não inventa Instagram para resultados antigos ou kart sem cadastro', () => {
    const s = { competitors: [{ kart: '1' }], standings: [{ kart: '1' }] };
    expect(acrescentarInstagramRelatorio(s, []).standings[0].instagram).toBeNull();
    expect(idsClientesRelatorio(s)).toEqual([]);
  });
  it('coloca o Instagram escapado em coluna própria, inclusive impressão em cupom', () => {
    const html = prepararRelatorioRecepcao(readFileSync('services/timing-ui/resultado.html', 'utf8'), 'http://timing');
    expect(html).toContain("esc(r.instagram || 'Não informado')");
    expect(html).toContain("h: 'Instagram', cls: 'col-instagram'");
    expect(html).toContain('const cols = [C.pos, C.kart, C.nome, C.instagram];');
    expect(html).toContain('const ocultasRecepcao = [C.total, C.difAnt, C.ultima];');
    expect(html).not.toContain('Piloto / Instagram');
    expect(html).toContain('/api/office/crono/dados');
    expect(html).toContain('http://timing/kib-logo.png');
    expect(html).not.toContain('const response = await fetch(url);');
  });
  it('recusa modelo incompatível em vez de imprimir resultado sem Instagram silenciosamente', () => {
    expect(() => prepararRelatorioRecepcao('<html></html>', 'http://timing')).toThrow('incompatível');
  });
});

