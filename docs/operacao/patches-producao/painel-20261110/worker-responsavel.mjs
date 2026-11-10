// Link do grupo (token do responsável) é compartilhado com todos: nos modos "unico" e "sinal" o site cobrava o grupo
// inteiro de QUALQUER pessoa que se cadastrasse por ele. Agora só cobra quando o CPF (ou o celular) bate com o do
// responsável (hash vindo do SRVKART em grupos/todos.json: respDocHash, respFoneHash). Os demais só fazem o cadastro.
// Uso: node worker-responsavel.mjs index-painel.js -> index-painel-resp.js (aplicar sobre o bundle no ar).
import { readFileSync, writeFileSync } from 'node:fs';

const entrada = process.argv[2] || 'index.js';
let js = readFileSync(entrada, 'utf8');
if (js.includes('ehResponsavelDoGrupo')) throw new Error('bundle já tem a correção');
const troca = (de, para) => { if (js.split(de).length !== 2) throw new Error('âncora ausente ou repetida: ' + de.slice(0, 80)); js = js.replace(de, para); };

troca('  const grupo = reserva ? await grupoDoLink(env, reserva) : null;',
`  const grupo = reserva ? await grupoDoLink(env, reserva) : null;
  if (grupo && grupo.souResponsavel && grupo.modo !== "individual") grupo.souResponsavel = await ehResponsavelDoGrupo(grupo, v.dados);`);

troca('var cacheGrupos = null;', `var cacheGrupos = null;
async function hashContato(tipo, valor) {
  const d = String(valor ?? "").replace(/\\D/g, "");
  const base = tipo === "cpf" ? (d.length === 11 ? d : "") : d.length >= 8 ? d.slice(-8) : "";
  if (!base) return null;
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tipo + ":" + base));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashContato, "hashContato");
// quem abriu o link do responsável é o próprio responsável? (CPF igual; sem CPF no cadastro dele, o celular)
async function ehResponsavelDoGrupo(g, d) {
  if (g.respDocHash) return d.tipoDocumento === "CPF" && await hashContato("cpf", d.documento) === g.respDocHash;
  if (g.respFoneHash) return await hashContato("fone", d.telefone) === g.respFoneHash;
  return false;
}
__name(ehResponsavelDoGrupo, "ehResponsavelDoGrupo");`);

// antes do cadastro não dá para saber quem é: a página não anuncia cobrança do grupo; o responsável vê o valor depois de enviar
troca('        const g = await grupoDoLink(env, String(url.searchParams.get("r") ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 24));',
`        const g = await grupoDoLink(env, String(url.searchParams.get("r") ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 24));
        if (g && g.modo !== "individual") g.souResponsavel = false;`);

const saida = entrada.replace(/\.js$/, '') + '-resp.js';
writeFileSync(saida, js);
console.log('ok', saida, js.length);
