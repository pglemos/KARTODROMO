/**
 * Lê tokens/kib.tokens.json (W3C DTCG), valida nomes e tipos e resolve as referências {a.b.c}.
 * Sem dependências: usado pelo gerador (build.mjs), pelo verificador e pelos testes.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const arquivoTokens = join(raiz, 'tokens', 'kib.tokens.json');
export const TEMAS = ['claro', 'escuro'];

const TIPOS = new Set(['color', 'dimension', 'fontFamily', 'fontWeight', 'fontSize', 'duration', 'cubicBezier', 'number', 'shadow']);
// pt-BR minúsculo, sem acento; os nomes legados do desktop mantêm o PascalCase do C# de hoje
const SEGMENTO = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEGMENTO_LEGADO = /^[A-Za-z][A-Za-z0-9]*$/;
const REFERENCIA = /^\{([^{}]+)\}$/;

export function carregarJson(caminho = arquivoTokens) {
  return JSON.parse(readFileSync(caminho, 'utf8'));
}

/**
 * Percorre a árvore e devolve a lista plana de tokens:
 * { caminho, tipo, valor, escuro, descricao, obsoleto, kib, legado }
 */
export function listarTokens(arvore) {
  const tokens = [];
  const erros = [];
  (function andar(no, caminho, tipoHerdado, legado) {
    for (const [chave, filho] of Object.entries(no)) {
      if (chave.startsWith('$')) continue;
      const aqui = [...caminho, chave];
      const ehLegado = legado || filho?.$extensions?.kib?.legado === true;
      const padrao = legado ? SEGMENTO_LEGADO : SEGMENTO;
      if (!padrao.test(chave)) erros.push(`nome inválido "${aqui.join('.')}": use minúsculas sem acento, separadas por hífen`);
      if (filho === null || typeof filho !== 'object' || Array.isArray(filho)) {
        erros.push(`"${aqui.join('.')}" não é grupo nem token`);
        continue;
      }
      const tipo = filho.$type ?? tipoHerdado;
      if ('$value' in filho) {
        if (!TIPOS.has(tipo)) erros.push(`token "${aqui.join('.')}" sem $type válido (${tipo ?? 'nenhum'})`);
        const kib = filho.$extensions?.kib ?? {};
        tokens.push({
          caminho: aqui.join('.'),
          tipo,
          valor: filho.$value,
          escuro: kib.temas?.escuro,
          descricao: filho.$description ?? '',
          obsoleto: filho.$deprecated ?? null,
          kib,
          legado: ehLegado,
        });
      } else {
        andar(filho, aqui, tipo, ehLegado);
      }
    }
  })(arvore, [], undefined, false);
  return { tokens, erros };
}

/** Resolve todos os tokens num tema: devolve Map caminho → valor final (sem referências). */
export function resolverTema(tokens, tema) {
  const porCaminho = new Map(tokens.map((t) => [t.caminho, t]));
  const cache = new Map();
  const erros = [];

  function bruto(t) {
    return tema === 'escuro' && t.escuro !== undefined ? t.escuro : t.valor;
  }
  function resolver(caminho, pilha) {
    if (cache.has(caminho)) return cache.get(caminho);
    const t = porCaminho.get(caminho);
    if (!t) throw new Error(`referência inexistente {${caminho}}${pilha.length ? ` (em ${pilha[pilha.length - 1]})` : ''}`);
    if (pilha.includes(caminho)) throw new Error(`referência circular: ${[...pilha, caminho].join(' → ')}`);
    const v = valorFinal(bruto(t), [...pilha, caminho]);
    cache.set(caminho, v);
    return v;
  }
  function valorFinal(v, pilha) {
    if (typeof v === 'string') {
      const m = REFERENCIA.exec(v);
      return m ? resolver(m[1].trim(), pilha) : v;
    }
    return v;
  }
  for (const t of tokens) {
    try { resolver(t.caminho, []); } catch (e) { erros.push(e.message); }
  }
  return { valores: cache, erros };
}

/** Lê, valida e resolve os dois temas. Lança erro com a lista de problemas. */
export function lerTokens(caminho = arquivoTokens) {
  const { tokens, erros } = listarTokens(carregarJson(caminho));
  const temas = {};
  for (const tema of TEMAS) {
    const r = resolverTema(tokens, tema);
    erros.push(...r.erros.map((e) => `[${tema}] ${e}`));
    temas[tema] = r.valores;
  }
  // todo token temático precisa ser do mesmo tipo de valor nos dois temas
  for (const t of tokens) {
    if (t.escuro === undefined) continue;
    const a = temas.claro.get(t.caminho), b = temas.escuro.get(t.caminho);
    if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b)) erros.push(`token "${t.caminho}" tem tipos diferentes no claro e no escuro`);
  }
  if (erros.length) throw new Error(`Tokens inválidos:\n- ${[...new Set(erros)].join('\n- ')}`);
  return { tokens, temas };
}

// ---------- conversões compartilhadas pelos formatos

/** "#RGB", "#RRGGBB" ou "#RRGGBBAA" → { r, g, b, a(0–255) } */
export function corParaRgba(hex) {
  let h = String(hex).trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(h)) throw new Error(`cor inválida: ${hex}`);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255,
  };
}

/** "9px" → 9 ; "120ms" → 120 */
export function numeroDe(v) {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v));
  if (!Number.isFinite(n)) throw new Error(`número inválido: ${v}`);
  return n;
}

/** caminho "cor.texto.secundario" → "CorTextoSecundario"; "espaco.denso-12" → "EspacoDenso12" */
export function nomePascal(caminho) {
  return caminho.split(/[.-]/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join('');
}
