// Gera uma chave da API de transmissão ao vivo.
//
//   node scripts/transmissao-chave.mjs --rotulo cosmo --saida C:\KartodromoLocal\segredos\transmissao-cosmo.txt
//
// A chave em si vai SÓ para o arquivo de --saida (fora do repositório, que é público). Na tela sai apenas o hash
// SHA-256 ("rotulo:hash"), que é o que se cadastra no servidor (data/timing/transmissao.json) e no site
// (segredo TRANSMISSAO_CHAVES_SHA256). Documentação: docs/api-transmissao.md
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const valor = (nome) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : undefined; };
const rotulo = (valor('--rotulo') || 'parceiro').toLowerCase().replace(/[^a-z0-9-]/g, '');
const saida = valor('--saida');
const nota = valor('--nota') || '';

if (!saida) {
  console.error('Informe --saida <arquivo> (fora do repositório) para gravar a chave.');
  process.exit(2);
}
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destino = resolve(saida);
const rel = relative(raiz, destino);
if (!rel.startsWith('..') && !isAbsolute(rel)) {
  console.error('Recusado: o arquivo da chave não pode ficar dentro do repositório (ele é público).');
  process.exit(2);
}
if (existsSync(destino)) {
  console.error(`Recusado: ${destino} já existe (não sobrescrevo chave). Apague ou escolha outro nome.`);
  process.exit(2);
}

const chave = 'kib_tx_' + randomBytes(32).toString('base64url');
const hash = createHash('sha256').update(chave).digest('hex');
mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, `${chave}\n`, { encoding: 'utf8', mode: 0o600 });
console.log(`${rotulo}:${hash}`);
if (nota) console.error(nota);
