export interface Links {
  grupo: string;
  cliente: string;
  operacao: string;
  /** Mostra também o app da Operação (link com ?equipe). */
  equipe: boolean;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function pagina(l: Links): string {
  const operacao = l.equipe
    ? `<a class="btn sec" href="${esc(l.operacao)}" target="_blank" rel="noopener">App da Operação (equipe)</a>`
    : '';
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Acesso antecipado — Kartódromo de Betim</title>
<meta name="description" content="Baixe o app do Kartódromo de Betim antes do lançamento.">
<style>
:root{--bg:#f6f7f9;--card:#fff;--txt:#111;--sub:#555;--acc:#0b57d0;--on:#fff;--line:#0002}
@media (prefers-color-scheme:dark){:root{--bg:#111;--card:#1c1c1e;--txt:#f2f2f2;--sub:#aaa;--acc:#8ab4f8;--on:#111;--line:#fff2}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:460px;margin:0 auto;padding:32px 16px}
.card{background:var(--card);border-radius:16px;padding:24px}
h1{font-size:1.5rem;margin:0 0 8px}p{color:var(--sub);margin:0 0 16px}
.passo{border-top:1px solid var(--line);padding-top:16px;margin-top:16px}
.n{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--acc);color:var(--on);font-weight:700;margin-right:8px}
h2{font-size:1.05rem;margin:0 0 6px;display:flex;align-items:center}
.btn{display:block;margin-top:12px;padding:14px;border-radius:999px;background:var(--acc);color:var(--on);font-weight:600;text-align:center;text-decoration:none}
.sec{background:transparent;color:var(--acc);border:1px solid var(--acc)}
small{display:block;color:var(--sub);margin-top:16px}
</style>
</head>
<body><main><div class="card">
<h1>Acesso antecipado ao app</h1>
<p>O app do Kartódromo de Betim está em testes na Google Play. Faça os dois passos <strong>no celular Android</strong>, com a mesma conta Google da Play Store.</p>
<div class="passo">
<h2><span class="n">1</span>Entre no grupo de testadores</h2>
<p>Toque em <strong>Participar do grupo</strong>. A entrada é imediata.</p>
<a class="btn" href="${esc(l.grupo)}" target="_blank" rel="noopener">Abrir grupo</a>
</div>
<div class="passo">
<h2><span class="n">2</span>Ative o teste e instale</h2>
<p>Toque em <strong>Tornar-se testador</strong> e depois em baixar na Google Play. Pode levar alguns minutos para liberar.</p>
<a class="btn" href="${esc(l.cliente)}" target="_blank" rel="noopener">Baixar o app</a>
${operacao}
</div>
<small>No app, crie sua conta com CPF e senha. Se aparecer “app não disponível”, confira se a conta Google é a mesma do passo 1 e tente de novo em alguns minutos.</small>
</div></main></body></html>`;
}
