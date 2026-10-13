/**
 * Contraste WCAG 2.x. Os pares a verificar ficam no próprio token:
 * "$extensions": { "kib": { "contraste": [{ "sobre": "cor.superficie.padrao", "min": 4.5, "nivel": "aviso"? }] } }
 * nivel "aviso" registra sem reprovar (decisão pendente documentada).
 */
import { corParaRgba, TEMAS } from './ler-tokens.mjs';

function canal(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Cor com transparência vira a cor visível por cima do fundo. */
export function compor(frente, fundo) {
  const f = corParaRgba(frente), b = corParaRgba(fundo);
  const a = f.a / 255;
  const mix = (x, y) => Math.round(x * a + y * (1 - a));
  return { r: mix(f.r, b.r), g: mix(f.g, b.g), b: mix(f.b, b.b) };
}

export function luminancia({ r, g, b }) {
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

export function razaoContraste(frente, fundo) {
  const l1 = luminancia(compor(frente, fundo));
  const l2 = luminancia(compor(fundo, '#FFFFFF'));
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
}

/** Verifica todos os pares declarados, nos dois temas. */
export function verificarContrastes(tokens, temas) {
  const resultados = [];
  for (const t of tokens) {
    for (const par of t.kib.contraste ?? []) {
      for (const tema of TEMAS) {
        const frente = temas[tema].get(t.caminho);
        const fundo = temas[tema].get(par.sobre);
        if (fundo === undefined) {
          resultados.push({ token: t.caminho, sobre: par.sobre, tema, razao: 0, min: par.min, ok: false, nivel: 'erro', motivo: 'fundo inexistente' });
          continue;
        }
        const razao = razaoContraste(frente, fundo);
        resultados.push({ token: t.caminho, sobre: par.sobre, tema, frente, fundo, razao, min: par.min, ok: razao >= par.min, nivel: par.nivel ?? 'erro' });
      }
    }
  }
  return resultados;
}
