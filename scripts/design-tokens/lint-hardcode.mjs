/**
 * Verificador de hardcode visual (cor/fonte/tamanho fora dos tokens), com "catraca":
 * o que já existe fica registrado em tokens/hardcode-baseline.json e só falha se um arquivo PIORAR ou se aparecer
 * hardcode num arquivo novo. Arquivos congelados (telão) contam, mas nunca falham.
 *
 *   node scripts/design-tokens/lint-hardcode.mjs                       confere (CI)
 *   node scripts/design-tokens/lint-hardcode.mjs --relatorio           gera docs/design-system/10-inventario/hardcode-relatorio.md
 *   node scripts/design-tokens/lint-hardcode.mjs --atualizar-baseline  registra a contagem atual (depois de uma migração)
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { contarHardcode, REGRAS } from './lint-regras.mjs';
import { raiz } from './ler-tokens.mjs';
import { SAIDAS } from './build.mjs';

export const ESCOPO = ['desktop/src', 'app', 'components', 'src', 'lib', 'styles', 'services/timing-ui', 'android/sorteio/app/src/main'];
const EXTENSOES = new Set(['.cs', '.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.kt', '.xml']);
const PASTAS_FORA = new Set(['bin', 'obj', 'node_modules', '.next', 'publish', 'build', '.gradle']);
const ARQUIVOS_FORA = new Set([
  ...Object.values(SAIDAS).map((p) => p.replace(/\\/g, '/')),
  'desktop/src/Kartodromo.Comum/Tokens.cs',
]);
/** Telão congelado: documenta, conta, nunca reprova (tv-classica: navegador de TV antigo, sem variáveis CSS). */
export const CONGELADO = /(^|\/)FormTV\.cs$|^services\/timing-ui\/(tv|tv-classica|tb50)\.html$|^app\/(telao|placar-telao[^/]*|podio-[^/]*|designer-telao)\/|^components\/telao\//;
export const ARQUIVO_BASELINE = join(raiz, 'tokens', 'hardcode-baseline.json');

export function listarArquivos(base = raiz) {
  const saida = [];
  for (const pasta of ESCOPO) {
    const inicio = join(base, pasta);
    if (!existsSync(inicio)) continue;
    (function andar(dir) {
      for (const nome of readdirSync(dir)) {
        if (PASTAS_FORA.has(nome)) continue;
        const abs = join(dir, nome);
        if (statSync(abs).isDirectory()) { andar(abs); continue; }
        const rel = relative(base, abs).replace(/\\/g, '/');
        if (!EXTENSOES.has(extname(nome)) || ARQUIVOS_FORA.has(rel) || /\.test\.[jt]sx?$|\.d\.ts$/.test(nome)) continue;
        saida.push(rel);
      }
    })(inicio);
  }
  return saida.sort();
}

/** { arquivo: { regra: n } } só com quem tem alguma ocorrência */
export function contarTudo(base = raiz) {
  const tudo = {};
  for (const rel of listarArquivos(base)) {
    const c = contarHardcode(readFileSync(join(base, rel), 'utf8'), extname(rel));
    if (Object.keys(c).length) tudo[rel] = c;
  }
  return tudo;
}

/** Compara com a baseline: { piorou: [...], melhorou: [...] } */
export function comparar(atual, baseline) {
  const piorou = [], melhorou = [];
  const arquivos = new Set([...Object.keys(atual), ...Object.keys(baseline)]);
  for (const arq of arquivos) {
    const a = atual[arq] ?? {}, b = baseline[arq] ?? {};
    for (const regra of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const na = a[regra] ?? 0, nb = b[regra] ?? 0;
      if (na > nb && !CONGELADO.test(arq)) piorou.push({ arquivo: arq, regra, antes: nb, agora: na });
      else if (na < nb) melhorou.push({ arquivo: arq, regra, antes: nb, agora: na });
    }
  }
  return { piorou, melhorou };
}

function app(arq) {
  const m = /^desktop\/src\/([^/]+)/.exec(arq);
  if (m) return m[1].replace('Kartodromo.', 'Desktop · ');
  if (arq.startsWith('services/timing-ui')) return 'Páginas da cronometragem (timing-ui)';
  if (arq.startsWith('android/')) return 'Tablet do sorteio (Android)';
  return `Site/admin · ${arq.split('/')[0]}/`;
}

export function relatorio(atual) {
  const soma = (c) => Object.values(c).reduce((s, n) => s + n, 0);
  const porApp = new Map();
  const porRegra = new Map();
  for (const [arq, c] of Object.entries(atual)) {
    const a = app(arq);
    porApp.set(a, (porApp.get(a) ?? 0) + soma(c));
    for (const [r, n] of Object.entries(c)) porRegra.set(r, (porRegra.get(r) ?? 0) + n);
  }
  const top = Object.entries(atual).sort((a, b) => soma(b[1]) - soma(a[1])).slice(0, 25);
  const total = [...porApp.values()].reduce((s, n) => s + n, 0);
  return `<!-- AUTO-GERADO por \`npm run lint:design:relatorio\` — não edite. -->
# Relatório de hardcode visual

Cor, fonte ou tamanho escritos direto no código em vez de token. **Total: ${total} ocorrências em ${Object.keys(atual).length} arquivos.**
A meta de cada fase de migração é baixar estes números (ver 07-arquitetura/proibicao-de-hardcode.md).

## Por aplicativo

| Aplicativo | Ocorrências |
|---|---|
${[...porApp].sort((a, b) => b[1] - a[1]).map(([a, n]) => `| ${a} | ${n} |`).join('\n')}

## Por regra

| Regra | Ocorrências | Como corrigir |
|---|---|---|
${[...porRegra].sort((a, b) => b[1] - a[1]).map(([r, n]) => `| \`${r}\` | ${n} | ${REGRAS.find((x) => x.id === r)?.ajuda ?? ''} |`).join('\n')}

## 25 arquivos com mais ocorrências

| Arquivo | Total | Detalhe | Congelado |
|---|---|---|---|
${top.map(([arq, c]) => `| \`${arq}\` | ${soma(c)} | ${Object.entries(c).map(([r, n]) => `${r} ${n}`).join(' · ')} | ${CONGELADO.test(arq) ? 'sim' : ''} |`).join('\n')}
`;
}

function principal() {
  const args = process.argv.slice(2);
  const atual = contarTudo();
  if (args.includes('--atualizar-baseline')) {
    writeFileSync(ARQUIVO_BASELINE, `${JSON.stringify({ $descricao: 'Contagem de hardcode visual por arquivo (catraca). Atualize só depois de uma migração que REDUZA os números: npm run lint:design:baseline', arquivos: atual }, null, 2)}\n`);
    console.log(`baseline atualizada: ${Object.keys(atual).length} arquivos`);
    return;
  }
  if (args.includes('--relatorio')) {
    const destino = join(raiz, 'docs', 'design-system', '10-inventario', 'hardcode-relatorio.md');
    writeFileSync(destino, relatorio(atual));
    console.log(`relatório: ${relative(raiz, destino)}`);
    return;
  }
  const baseline = existsSync(ARQUIVO_BASELINE) ? JSON.parse(readFileSync(ARQUIVO_BASELINE, 'utf8')).arquivos : {};
  const { piorou, melhorou } = comparar(atual, baseline);
  if (melhorou.length) console.log(`✔ ${melhorou.length} contagem(ns) caíram — registre com \`npm run lint:design:baseline\`.`);
  if (piorou.length) {
    console.error('Cor/fonte/tamanho escrito direto no código (use os tokens — docs/design-system/07-arquitetura/proibicao-de-hardcode.md):');
    for (const p of piorou) console.error(`- ${p.arquivo}: ${p.regra} ${p.antes} → ${p.agora}  (${REGRAS.find((r) => r.id === p.regra)?.ajuda ?? ''})`);
    process.exit(1);
  }
  console.log(`Sem hardcode visual novo (${Object.keys(atual).length} arquivos com hardcode antigo registrado).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) principal();
