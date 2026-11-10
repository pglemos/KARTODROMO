# Painel do organizador do grupo (10/11/2026)

Link só do responsável: `cadastro.kartodromodebetim.com.br/painel?g=CODIGO&k=CHAVE`. Mostra:
- quantas pessoas já se cadastraram e pagaram, e quanto já entrou;
- a situação de cada vaga;
- WhatsApp e Copiar link para quem ainda falta.

O link do grupo (`?r=`) continua o mesmo, compartilhado com todos. Por isso o painel usa uma chave separada: os primeiros 16 caracteres de `HMAC(OPS_RECEPCAO_KEY, "painel:"+codigo)`.

## Partes
1. **SRVKART** (`lib/ops/grupos.ts`): `publicarGruposNoSite` manda junto `painel` (chave, totais e vagas, só com o primeiro nome). `montar()` devolve `linkPainel`.
2. **Admin** (`workers/admin/public/grupo.js`): na reserva em grupo da Agenda, botões "Copiar link do painel" e "Enviar ao responsável".
3. **Worker kartodromo-cadastro**: `worker-painel.mjs` acrescenta `/painel` (página `painel.html`) e `/api/grupo/painel`.

## Publicar (nesta ordem)
1. Reiniciar o ops-server do SRVKART com o `grupos.ts` novo. Em até 1 min o `grupos/todos.json` passa a ter `painel`.
2. Baixar do ar o bundle do worker (a `index2.js` local está desatualizada: o deploy de 10/11 não está nela). Depois rodar `node ../cadastro-20261110/extrair.mjs` e `node worker-painel.mjs index.js`.
3. Rodar `npx wrangler whoami` e `node ../cadastro-20261105/subir.mjs index-painel.js`.
4. Publicar o admin.

Se o worker for publicado antes do SRVKART, o painel responde 404 até o primeiro resumo novo chegar.
