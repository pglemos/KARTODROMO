// Cria usuário do app operacional. Uso: npx tsx scripts/app-v1/criar-usuario.ts <usuario> "<nome>" <RECEPCAO|OPERACAO|GERENCIA>
// A senha vem da entrada padrão, para não ficar no histórico do terminal.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { criarUsuario, type Perfil } from '../../lib/app-v1/auth';
import { abrirStore } from '../../lib/app-v1/store';

const [usuario, nome, perfil] = process.argv.slice(2);
if (!usuario || !nome || !perfil) throw new Error('Informe usuário, nome e perfil.');
const senha = readFileSync(0, 'utf8').replace(/\r?\n$/, '');
const dados = resolve(process.env.TIMING_DATA_DIR || join(process.cwd(), 'data', 'timing'));
const store = abrirStore(join(dados, '..', 'app-operacional', 'app.db'));
await criarUsuario({ store, segredo: '' }, { usuario, nome, perfil: perfil as Perfil, senha });
store.fechar();
console.log(`Usuário ${usuario} criado.`);
