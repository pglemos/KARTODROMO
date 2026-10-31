import { describe, expect, it, vi } from 'vitest';

import { linhasDosDias, tipoDaImagem } from '../../workers/pre-cadastro/src/mobile/ranking';

const ftyp = (marca: string) => new Uint8Array([0, 0, 0, 24, ...new TextEncoder().encode(`ftyp${marca}`)]);

describe('foto do piloto', () => {
  it('identifica imagens pelo conteúdo', () => {
    expect(tipoDaImagem(new Uint8Array([0xff, 0xd8, 0xff, 0]))).toBe('image/jpeg');
    expect(tipoDaImagem(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(tipoDaImagem(new TextEncoder().encode('RIFF0000WEBP'))).toBe('image/webp');
    expect(tipoDaImagem(ftyp('heic'))).toBe('image/heic');
  });

  it('recusa vídeo MP4 e arquivo qualquer', () => {
    expect(tipoDaImagem(ftyp('isom'))).toBeNull();
    expect(tipoDaImagem(ftyp('mp42'))).toBeNull();
    expect(tipoDaImagem(new TextEncoder().encode('<svg></svg>xx'))).toBeNull();
  });
});

describe('ranking diário', () => {
  it('ignora um dia corrompido sem perder os outros', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const bom = JSON.stringify({ linhas: [{ piloto: 'A', kart: '1', categoria: null, tracado: 'T', dia: '2026-10-30', ms: 60000 }, { piloto: 'B', kart: '2', categoria: null, tracado: 'T', dia: '2026-10-30', ms: null }] });
    const r = linhasDosDias([{ dados: '{quebrado', atualizado_em: 5 }, { dados: bom, atualizado_em: 9 }]);
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0]).toMatchObject({ nome: 'A', ms: 60000 });
    expect(r.atualizadoEm).toBe(9);
    expect(erro).toHaveBeenCalledTimes(1);
    erro.mockRestore();
  });
});
