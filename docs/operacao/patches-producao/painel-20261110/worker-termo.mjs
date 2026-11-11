// Termo de responsabilidade aceito online no pré-cadastro (cadastro.kartodromodebetim.com.br).
// - GET /api/termo: texto publicado pelo SRVKART (lib/ops/termo-online.ts), com versão = hash do texto.
// - PUT /api/sync/termo: o SRVKART grava o texto (R2 config/termo.json).
// - POST /api/pre-cadastro: guarda { versao, aceitoEm, imagem, ip } junto do cadastro quando a versão é a atual.
// - Página: seção "Termo de responsabilidade" com o texto, aceite obrigatório e opção de não autorizar imagem.
// Uso: node worker-termo.mjs index-painel-resp-aviso.js -> index-painel-resp-aviso-termo.js
import { readFileSync, writeFileSync } from 'node:fs';
const entrada = process.argv[2];
let js = readFileSync(entrada, 'utf8');
if (js.includes('"/api/termo"')) throw new Error('bundle já tem o termo');
const troca = (de, para, alvo = 'js') => {
  const fonte = alvo === 'js' ? js : pagina;
  if (fonte.split(de).length !== 2) throw new Error(`âncora ausente ou repetida (${alvo}): ` + de.slice(0, 80));
  if (alvo === 'js') js = js.replace(de, para); else pagina = pagina.replace(de, para);
};

// ---------------------------------------------------------------- worker
troca('      if (p === "/api/aviso" && req.method === "GET") {', `      if (p === "/api/termo" && req.method === "GET") {
        const t = await termoPublicado(env);
        return new Response(JSON.stringify(t), { status: t ? 200 : 404, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60" } });
      }
      if (p === "/api/aviso" && req.method === "GET") {`);
troca('        if (p === "/api/sync/aviso" && req.method === "PUT") {', `        if (p === "/api/sync/termo" && req.method === "PUT") {
          const t = await req.json().catch(() => ({}));
          const paragrafos = (Array.isArray(t.paragrafos) ? t.paragrafos : []).slice(0, 40).map((x) => ({ ...(x?.titulo ? { titulo: String(x.titulo).slice(0, 120) } : {}), texto: String(x?.texto ?? "").slice(0, 3000) })).filter((x) => x.texto);
          if (!/^[a-f0-9]{12}$/.test(String(t.versao ?? "")) || !paragrafos.length) return json12(400, { erro: "Termo inv\\xE1lido." });
          const termo = { versao: String(t.versao), titulo: String(t.titulo ?? "Termo de Responsabilidade").slice(0, 80), empresa: String(t.empresa ?? "").slice(0, 160), paragrafos };
          await env.PRE.put("config/termo.json", JSON.stringify(termo), { httpMetadata: { contentType: "application/json" } });
          cacheTermo = null;
          return json12(200, { ok: true, versao: termo.versao });
        }
        if (p === "/api/sync/aviso" && req.method === "PUT") {`);
troca('var cacheGrupos = null;', `var cacheGrupos = null;
var cacheTermo = null;
async function termoPublicado(env) {
  if (!cacheTermo || Date.now() - cacheTermo.em > 6e4) {
    const obj = await env.PRE.get("config/termo.json");
    cacheTermo = { em: Date.now(), t: obj ? await obj.json() : null };
  }
  return cacheTermo.t;
}
__name(termoPublicado, "termoPublicado");`);
troca('  const registro = { chave, recebidoEm: (/* @__PURE__ */ new Date()).toISOString(), ...v.dados, ...reserva ? { reserva } : {},',
`  // aceite do termo de responsabilidade: só vale para a versão publicada agora
  const termoAtual = corpo.termo && corpo.termo.aceito === true ? await termoPublicado(env) : null;
  const termo = termoAtual && String(corpo.termo.versao) === termoAtual.versao ? { versao: termoAtual.versao, aceitoEm: (/* @__PURE__ */ new Date()).toISOString(), imagem: corpo.termo.imagem !== false, ip: req.headers.get("cf-connecting-ip") ?? null } : null;
  if (corpo.termo && corpo.termo.aceito === true && termoAtual && !termo) return json12(409, { erro: "O termo foi atualizado agora h\\xE1 pouco. Recarregue a p\\xE1gina e aceite de novo." });
  const registro = { chave, recebidoEm: (/* @__PURE__ */ new Date()).toISOString(), ...v.dados, ...reserva ? { reserva } : {}, ...termo ? { termo } : {},`);

// ---------------------------------------------------------------- página (embutida no bundle)
const ini = js.indexOf('var PAGINA_CADASTRO = ');
const fim = js.indexOf('\n', ini);
let pagina = JSON.parse(js.slice(ini + 22, fim).replace(/;\s*$/, ''));
troca(`    <section class="cartao">
      <label class="termo"><input type="checkbox" id="lgpd">`, `    <section class="cartao" id="secTermo" hidden>
      <h2><span class="n">6</span>Termo de responsabilidade</h2>
      <p class="sub">Leia e aceite agora. No dia, a recepção só confere e você assina o impresso.</p>
      <div class="termo-texto" id="termoTexto" tabindex="0" role="region" aria-label="Texto do termo de responsabilidade"></div>
      <label class="termo"><input type="checkbox" id="aceiteTermo"><span>Li e aceito o Termo de Responsabilidade. <span class="obrig">*</span></span></label>
      <label class="termo"><input type="checkbox" id="naoImagem"><span>Não autorizo o uso da minha imagem em fotos e vídeos do kartódromo.</span></label>
    </section>

    <section class="cartao">
      <label class="termo"><input type="checkbox" id="lgpd">`, 'p');
troca('  .termo { display: flex;', `  .termo-texto { max-height: 260px; overflow: auto; border: 1px solid var(--linha); border-radius: var(--raio); padding: 12px 14px; margin: 12px 0; background: rgba(255,255,255,.02); font: 500 15px/1.55 var(--corpo); color: var(--suave); text-transform: none; letter-spacing: 0; }
  .termo-texto p { margin: 0 0 10px; }
  .termo-texto strong { color: var(--texto); }
  .termo { display: flex;`, 'p');
troca("    const feitos = campos.filter((id) => regras[id][0]()).length + ($('lgpd').checked ? 1 : 0);\n    const total = campos.length + 1;",
  "    const feitos = campos.filter((id) => regras[id][0]()).length + ($('lgpd').checked ? 1 : 0) + (TERMO && $('aceiteTermo').checked ? 1 : 0);\n    const total = campos.length + 1 + (TERMO ? 1 : 0);", 'p');
troca("  const primeiroQueFalta = () => { for (const id of campos) { if (!regras[id][0]()) return id; } return $('lgpd').checked ? null : 'lgpd'; };",
  "  const primeiroQueFalta = () => { for (const id of campos) { if (!regras[id][0]()) return id; } if (TERMO && !$('aceiteTermo').checked) return 'aceiteTermo'; return $('lgpd').checked ? null : 'lgpd'; };", 'p');
troca("if (id !== 'lgpd') conferir(id);", "if (id !== 'lgpd' && id !== 'aceiteTermo') conferir(id);", 'p');
troca("    if (!$('lgpd').checked) return erro('Para continuar, aceite o Termo de Consentimento para Tratamento de Dados Pessoais.', null);",
  "    if (TERMO && !$('aceiteTermo').checked) return erro('Para continuar, leia e aceite o Termo de Responsabilidade.', $('aceiteTermo'));\n    if (!$('lgpd').checked) return erro('Para continuar, aceite o Termo de Consentimento para Tratamento de Dados Pessoais.', null);", 'p');
troca("          lgpd: true, site: $('site').value, t: aberto,",
  "          termo: TERMO && $('aceiteTermo').checked ? { versao: TERMO.versao, aceito: true, imagem: !$('naoImagem').checked } : undefined,\n          lgpd: true, site: $('site').value, t: aberto,", 'p');
troca("for (const id of ['bairro', 'endereco', 'cidade']) $(id).setAttribute('autocapitalize', 'words');\n  atualizarProgresso();\n", `for (const id of ['bairro', 'endereco', 'cidade']) $(id).setAttribute('autocapitalize', 'words');
  atualizarProgresso();
  // termo de responsabilidade publicado pelo SRVKART: sem ele (falha de rede), a seção some e o termo fica só na recepção
  fetch('/api/termo').then((r) => (r.ok ? r.json() : null)).then((t) => {
    if (!t || !Array.isArray(t.paragrafos)) return;
    TERMO = t;
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    $('termoTexto').innerHTML = t.paragrafos.map((p) => '<p>' + (p.titulo ? '<strong>' + esc(p.titulo) + '</strong> ' : '') + esc(p.texto) + '</p>').join('');
    $('secTermo').hidden = false;
    atualizarProgresso();
  }).catch(() => {});
`, 'p');
// TERMO precisa existir antes do primeiro atualizarProgresso
troca("  const atualizarProgresso = () => {", "  var TERMO = null;\n  const atualizarProgresso = () => {", 'p');
troca('Você assina o termo de responsabilidade na recepção, no dia da corrida, já com seus dados impressos.', 'No dia da corrida, a recepção confere seus dados e você assina o termo impresso.', 'p');

js = js.slice(0, ini) + 'var PAGINA_CADASTRO = ' + JSON.stringify(pagina) + ';' + js.slice(fim);
const saida = entrada.replace(/\.js$/, '') + '-termo.js';
writeFileSync(saida, js);
writeFileSync('pagina-com-termo.html', pagina);
console.log('ok', saida, js.length);
