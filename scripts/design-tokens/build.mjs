/**
 * Gera as saídas dos design tokens a partir de tokens/kib.tokens.json.
 *
 *   node scripts/design-tokens/build.mjs           gera/atualiza os arquivos
 *   node scripts/design-tokens/build.mjs --check   só confere: sai com erro se algum gerado estiver desatualizado
 *
 * Saídas (versionadas: o build do desktop e do Android não dependem de Node):
 *   styles/tokens.css, services/timing-ui/tokens.css, desktop/src/Kartodromo.Comum/Tokens.g.cs,
 *   android/sorteio/.../design/Tokens.kt, android/sorteio/.../res/values/cores_tokens.xml,
 *   docs/design-system/02-tokens/referencia.md
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { lerTokens, raiz } from './ler-tokens.mjs';
import { verificarContrastes } from './contraste.mjs';
import { gerarCss } from './formatos/css.mjs';
import { gerarCsharp } from './formatos/csharp.mjs';
import { gerarAndroidXml, gerarKotlin } from './formatos/kotlin.mjs';
import { gerarMarkdown } from './formatos/markdown.mjs';

const ANDROID = join('android', 'sorteio', 'app', 'src', 'main');

export const SAIDAS = {
  css: join('styles', 'tokens.css'),
  timingUi: join('services', 'timing-ui', 'tokens.css'),
  csharp: join('desktop', 'src', 'Kartodromo.Comum', 'Tokens.g.cs'),
  kotlin: join(ANDROID, 'java', 'br', 'com', 'kartodromobetim', 'sorteio', 'design', 'Tokens.kt'),
  androidXml: join(ANDROID, 'res', 'values', 'cores_tokens.xml'),
  referencia: join('docs', 'design-system', '02-tokens', 'referencia.md'),
};

/** Gera tudo em memória: { arquivos: { caminhoRelativo: conteúdo }, contrastes } */
export function gerar(caminhoTokens) {
  const dados = lerTokens(caminhoTokens);
  const contrastes = verificarContrastes(dados.tokens, dados.temas);
  const reprovados = contrastes.filter((r) => !r.ok && r.nivel !== 'aviso');
  if (reprovados.length) {
    throw new Error(`Contraste reprovado:\n- ${reprovados.map((r) => `${r.token} sobre ${r.sobre} (${r.tema}): ${r.razao.toFixed(2)} < ${r.min}`).join('\n- ')}`);
  }
  const css = gerarCss(dados);
  return {
    contrastes,
    arquivos: {
      [SAIDAS.css]: css,
      [SAIDAS.timingUi]: css,
      [SAIDAS.csharp]: gerarCsharp(dados),
      [SAIDAS.kotlin]: gerarKotlin(dados),
      [SAIDAS.androidXml]: gerarAndroidXml(dados),
      [SAIDAS.referencia]: gerarMarkdown(dados, contrastes),
    },
  };
}

const normalizar = (s) => s.replace(/^﻿/, '').replace(/\r\n/g, '\n');

/** Lista os arquivos gerados que diferem do disco. */
export function desatualizados(arquivos, base = raiz) {
  return Object.entries(arquivos)
    .filter(([rel, conteudo]) => {
      const abs = join(base, rel);
      return !existsSync(abs) || normalizar(readFileSync(abs, 'utf8')) !== normalizar(conteudo);
    })
    .map(([rel]) => rel);
}

function principal() {
  const conferir = process.argv.includes('--check');
  const { arquivos, contrastes } = gerar();
  const avisos = contrastes.filter((r) => !r.ok && r.nivel === 'aviso');
  for (const r of avisos) console.warn(`⚠ contraste (decisão pendente): ${r.token} sobre ${r.sobre} (${r.tema}) = ${r.razao.toFixed(2)}:1 < ${r.min}:1`);

  if (conferir) {
    const lista = desatualizados(arquivos);
    if (lista.length) {
      console.error(`Design tokens desatualizados (rode \`npm run tokens\`):\n- ${lista.join('\n- ')}`);
      process.exit(1);
    }
    console.log(`Design tokens em dia (${Object.keys(arquivos).length} arquivos gerados conferidos).`);
    return;
  }
  for (const [rel, conteudo] of Object.entries(arquivos)) {
    const abs = join(raiz, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, conteudo, 'utf8');
    console.log(`gerado ${relative(raiz, abs).replace(/\\/g, '/')}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) principal();
