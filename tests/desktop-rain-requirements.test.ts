import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('botão de chuva da cronometragem', () => {
  it('marca a bateria pela tela principal e expõe a condição na sessão', () => {
    const ui = read('desktop/src/Kartodromo.Cronometragem/FormCrono.cs');
    const design = read('desktop/src/Kartodromo.Cronometragem/FormCrono.Design.cs');
    const live = read('desktop/src/Kartodromo.Cronometragem/FormCrono.AoVivo.cs');
    const server = read('services/timing-server.ts');
    expect(ui).toContain('Chuva');
    expect(design).toContain('BotaoBandeira("Chuva"');
    expect(design).toContain('_fChuva.Click');
    expect(live).toContain('/weather');
    expect(server).toContain('chuva');
  });

  it('mostra a condição nos dois níveis do ranking', () => {
    const ranking = read('desktop/src/Kartodromo.Cronometragem/FormCrono.Ranking.cs');
    const engine = read('lib/timing/ranking-karts.ts');
    expect(ranking).toContain('Condição');
    expect(engine).toContain('chuva');
  });
});
