import { describe, expect, it } from 'vitest';
import { caminhoArquivoAtualizacao, tipoConteudoAtualizacao } from '../lib/desktop-updates';

describe('arquivos de atualização desktop', () => {
  it('resolve somente aplicativos e nomes de arquivo permitidos dentro da raiz', () => {
    expect(caminhoArquivoAtualizacao('C:/updates', 'Recepcao', 'manifest.json')).toBe('C:\\updates\\Recepcao\\manifest.json');
    expect(caminhoArquivoAtualizacao('C:/updates', 'Recepcao', '..\\..\\segredo.txt')).toBeNull();
    expect(caminhoArquivoAtualizacao('C:/updates', 'OutroApp', 'manifest.json')).toBeNull();
  });

  it('informa o tipo correto para manifesto e pacote', () => {
    expect(tipoConteudoAtualizacao('manifest.json')).toBe('application/json; charset=utf-8');
    expect(tipoConteudoAtualizacao('Kartodromo.Recepcao.1.0.1.zip')).toBe('application/zip');
  });
});
