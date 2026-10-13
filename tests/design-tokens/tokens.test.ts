import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { carregarJson, listarTokens, lerTokens, resolverTema } from '../../scripts/design-tokens/ler-tokens.mjs';
import { razaoContraste, verificarContrastes } from '../../scripts/design-tokens/contraste.mjs';
import { desatualizados, gerar, SAIDAS } from '../../scripts/design-tokens/build.mjs';

const raizRepo = join(__dirname, '..', '..');

type ArvoreEditavel = { primitivo: { cor: Record<string, Record<string, { $value: string }>> } };

function jsonTemporario(arvore: unknown) {
  const pasta = mkdtempSync(join(tmpdir(), 'kib-tokens-'));
  const arq = join(pasta, 'tokens.json');
  writeFileSync(arq, JSON.stringify(arvore));
  return arq;
}

describe('tokens/kib.tokens.json', () => {
  it('é válido: nomes, tipos e referências resolvem nos dois temas', () => {
    const { tokens, temas } = lerTokens();
    expect(tokens.length).toBeGreaterThan(200);
    for (const t of tokens) {
      expect(temas.claro.has(t.caminho), t.caminho).toBe(true);
      expect(temas.escuro.has(t.caminho), t.caminho).toBe(true);
    }
  });

  it('a marca é verde nos dois temas: #0B7A53 na operação e #00E676 no público', () => {
    const { temas } = lerTokens();
    expect(temas.claro.get('cor.acao.principal')).toBe('#0B7A53');
    expect(temas.escuro.get('cor.acao.principal')).toBe('#00E676');
  });

  it('nenhum par de contraste declarado reprova (exceto decisão pendente marcada como aviso)', () => {
    const { tokens, temas } = lerTokens();
    const reprovados = verificarContrastes(tokens, temas).filter((r) => !r.ok && r.nivel !== 'aviso');
    expect(reprovados).toEqual([]);
  });

  it('cores-chave do DESIGN.md batem com os tokens do tema público', () => {
    const design = readFileSync(join(raizRepo, 'DESIGN.md'), 'utf8');
    const { temas } = lerTokens();
    const doDesign = (nome: string) => new RegExp(`${nome}:\\s*"(#[0-9a-fA-F]{6})"`).exec(design)?.[1]?.toUpperCase();
    expect(doDesign('preto-box')).toBe(temas.escuro.get('cor.fundo.app'));
    expect(doDesign('asfalto-elevado')).toBe(temas.escuro.get('cor.superficie.padrao'));
    expect(doDesign('neon-cronometrico')).toBe(temas.escuro.get('cor.acao.principal'));
    expect(doDesign('tinta-cta')).toBe(temas.escuro.get('cor.acao.sobre-principal'));
    expect(doDesign('sage-suave')).toBe(temas.escuro.get('cor.texto.secundario'));
  });
});

describe('leitor de tokens', () => {
  it('recusa nome com acento ou maiúscula', () => {
    const { erros } = listarTokens({ cor: { $type: 'color', Ação: { $value: '#000000' } } });
    expect(erros.join()).toMatch(/nome inválido/);
  });

  it('detecta referência circular e referência inexistente', () => {
    const { tokens } = listarTokens({ cor: { $type: 'color', a: { $value: '{cor.b}' }, b: { $value: '{cor.a}' }, c: { $value: '{cor.nao-existe}' } } });
    const { erros } = resolverTema(tokens, 'claro');
    expect(erros.join('\n')).toMatch(/circular/);
    expect(erros.join('\n')).toMatch(/inexistente/);
  });

  it('o tema escuro sobrescreve e o claro usa $value', () => {
    const { tokens } = listarTokens({ cor: { $type: 'color', x: { $value: '#111111', $extensions: { kib: { temas: { escuro: '#EEEEEE' } } } } } });
    expect(resolverTema(tokens, 'claro').valores.get('cor.x')).toBe('#111111');
    expect(resolverTema(tokens, 'escuro').valores.get('cor.x')).toBe('#EEEEEE');
  });

  it('contraste WCAG: preto sobre branco = 21:1, branco sobre branco = 1:1', () => {
    expect(razaoContraste('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(razaoContraste('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });
});

describe('gerador', () => {
  it('os arquivos gerados no repositório estão em dia (npm run tokens)', () => {
    expect(desatualizados(gerar().arquivos)).toEqual([]);
  });

  it('o check acusa quando o JSON muda e o gerado não', () => {
    const arvore = carregarJson() as unknown as ArvoreEditavel;
    arvore.primitivo.cor.verde['600'].$value = '#0B7A54';
    expect(desatualizados(gerar(jsonTemporario(arvore)).arquivos)).toContain(SAIDAS.csharp);
  });

  it('o build falha se um par de contraste reprovar', () => {
    const arvore = carregarJson() as unknown as ArvoreEditavel;
    arvore.primitivo.cor.cinza['500'].$value = '#DDDDDD'; // texto secundário quase branco
    expect(() => gerar(jsonTemporario(arvore))).toThrow(/Contraste reprovado/);
  });

  it('C# legado: os 44 nomes antigos de Tokens.cs continuam com o MESMO tipo e valor', () => {
    const snapshot = JSON.parse(readFileSync(join(__dirname, 'legado-desktop.snapshot.json'), 'utf8')) as Record<string, { tipo: string; argb?: number[]; conhecida?: string; valor?: number }>;
    const cs = gerar().arquivos[SAIDAS.csharp];
    for (const [nome, esperado] of Object.entries(snapshot)) {
      if (esperado.tipo === 'Color') {
        const valor = esperado.conhecida ? `System.Drawing.Color.${esperado.conhecida}` : `System.Drawing.Color.FromArgb(${esperado.argb!.join(', ')})`;
        expect(cs, nome).toContain(`public static readonly System.Drawing.Color ${nome} = ${valor};`);
      } else {
        const literal = esperado.tipo === 'float' ? `${esperado.valor}f` : `${esperado.valor}`;
        expect(cs, nome).toContain(`public const ${esperado.tipo} ${nome} = ${literal};`);
      }
    }
  });

  it('CSS: escuro no :root, claro em [data-tema="claro"], prefixo exclusivo --kib-', () => {
    const css = gerar().arquivos[SAIDAS.css];
    expect(css).toMatch(/:root \{[^}]*--kib-cor-acao-principal: #00e676;/);
    expect(css).toMatch(/\[data-tema="claro"\],\s*\.kib-tema-claro \{[^}]*--kib-cor-acao-principal: #0b7a53;/);
    expect(css).not.toMatch(/--kib-primitivo|--kib-legado/);
  });

  it('Kotlin e XML do Android saem com os dois temas', () => {
    const { arquivos } = gerar();
    expect(arquivos[SAIDAS.kotlin]).toContain('val CorAcaoPrincipal = Color(0xFF00E676)');
    expect(arquivos[SAIDAS.androidXml]).toContain('<color name="kib_claro_cor_acao_principal">#FF0B7A53</color>');
  });

  it('o placar do TB50 (navegador antigo da placa, ES5) segue sem os tokens', () => {
    expect(readFileSync(join(raizRepo, 'services', 'timing-ui', 'tb50.html'), 'utf8')).not.toContain('tokens.css');
  });

  it('a TV da sala (refeita em 08/10) usa os tokens do tema escuro, com reserva se o tokens.css faltar', () => {
    const tv = readFileSync(join(raizRepo, 'services', 'timing-ui', 'tv.html'), 'utf8');
    expect(tv).toContain('<link rel="stylesheet" href="/tokens.css">');
    expect(tv).not.toContain('data-tema="claro"');
    expect(tv).toMatch(/var\(--kib-cor-acao-principal, #00E676\)/);
  });

  it('as páginas de operação da cronometragem usam os tokens no tema claro', () => {
    for (const pagina of ['operador.html', 'admin.html', 'resultado.html', 'equalizacao.html']) {
      const html = readFileSync(join(raizRepo, 'services', 'timing-ui', pagina), 'utf8');
      expect(html, pagina).toContain('<link rel="stylesheet" href="/tokens.css">');
      expect(html, pagina).toContain('data-tema="claro"');
    }
  });
});
