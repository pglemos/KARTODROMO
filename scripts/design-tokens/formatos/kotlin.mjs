/**
 * Tokens.kt (Jetpack Compose) para o tablet do sorteio. Ainda sem uso: a migração do Tema.kt é uma fase própria.
 */
import { AVISO, ehSemantico, ordenar } from './comum.mjs';
import { corParaRgba, nomePascal, numeroDe } from '../ler-tokens.mjs';

const hex2 = (n) => n.toString(16).padStart(2, '0').toUpperCase();

function cor(hex) {
  const { r, g, b, a } = corParaRgba(hex);
  return `Color(0x${hex2(a)}${hex2(r)}${hex2(g)}${hex2(b)})`;
}

function membro(t, v, nome) {
  switch (t.tipo) {
    case 'color': return `val ${nome} = ${cor(v)}`;
    case 'dimension': return t.caminho.startsWith('fonte.tamanho') ? `val ${nome} = ${numeroDe(v)}.sp` : `val ${nome} = ${numeroDe(v)}.dp`;
    case 'fontWeight': return `const val ${nome} = ${numeroDe(v)}`;
    case 'number': return `const val ${nome} = ${numeroDe(v)}f`;
    case 'duration': return `const val ${nome} = ${Math.round(numeroDe(v))} // ms`;
    case 'fontFamily': return `const val ${nome} = "${Array.isArray(v) ? v[0] : v}"`;
    case 'cubicBezier': return `val ${nome} = floatArrayOf(${v.map((n) => `${n}f`).join(', ')})`;
    default: return null; // sombra: Compose usa elevação, não token de sombra
  }
}

export function gerarKotlin({ tokens, temas }) {
  const primitivos = ordenar(tokens.filter((t) => t.caminho.startsWith('primitivo.cor.')));
  const semanticos = ordenar(tokens.filter(ehSemantico));
  const bloco = (lista, tema, nome) => lista.map((t) => membro(t, temas[tema].get(t.caminho), nome(t))).filter(Boolean).map((l) => `        ${l}`).join('\n');
  return `// ${AVISO}
@file:Suppress("unused", "MemberVisibilityCanBePrivate")

package br.com.kartodromobetim.sorteio.design

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

object Tokens {
    /** Paleta crua: não use direto na tela. */
    object Primitivo {
${bloco(primitivos, 'claro', (t) => nomePascal(t.caminho.slice('primitivo.cor.'.length)))}
    }

    /** Tema CLARO — operação. */
    object Claro {
${bloco(semanticos, 'claro', (t) => nomePascal(t.caminho))}
    }

    /** Tema ESCURO — público (o tablet do sorteio é escuro). */
    object Escuro {
${bloco(semanticos, 'escuro', (t) => nomePascal(t.caminho))}
    }
}
`;
}

export function gerarAndroidXml({ tokens, temas }) {
  const cores = ordenar(tokens.filter((t) => ehSemantico(t) && t.tipo === 'color'));
  const linha = (tema, t) => {
    const { r, g, b, a } = corParaRgba(temas[tema].get(t.caminho));
    return `    <color name="kib_${tema}_${t.caminho.replace(/[.-]/g, '_')}">#${hex2(a)}${hex2(r)}${hex2(g)}${hex2(b)}</color>`;
  };
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- ${AVISO} -->
<resources>
${cores.map((t) => linha('claro', t)).join('\n')}
${cores.map((t) => linha('escuro', t)).join('\n')}
</resources>
`;
}
