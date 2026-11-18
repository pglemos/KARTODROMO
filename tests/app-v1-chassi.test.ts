import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chassisFrota, gravarChassi } from '../lib/app-v1/chassi';
import { abrirStore } from '../lib/app-v1/store';

const novo = () => abrirStore(join(mkdtempSync(join(tmpdir(), 'chassi-')), 'app.db'));

describe('chassi da frota', () => {
  it('aceita qualquer número de chassi em kart Light ou Super', () => {
    const s = novo();
    gravarChassi(s, '27', '250', 'teste', ['27', '127']);
    gravarChassi(s, '127', '12', 'teste', ['27', '127']);
    expect(chassisFrota(s)).toEqual({ '27': '250', '127': '12' });
  });
  it('troca de chassi: placa e sensor do 27 vão para o chassi que era do 45', () => {
    const s = novo();
    gravarChassi(s, '27', '180', 'teste', ['27', '45']);
    gravarChassi(s, '45', '301', 'teste', ['27', '45']);
    expect(gravarChassi(s, '27', ' 301 ', 'teste', ['27', '45']).liberadoDe).toBe('45');
    expect(chassisFrota(s)).toEqual({ '27': '301' });
  });
  it('recusa kart não cadastrado na cronometragem', () => {
    expect(() => gravarChassi(novo(), '99', '10', 'teste', ['27'])).toThrow('não existe na cronometragem');
  });
});
