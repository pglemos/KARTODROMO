> **Histórico (12/11/2026):** tudo isto já está em `workers/pre-cadastro` e o worker no ar é igual ao fonte. Não use estes scripts para publicar.

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

## Correção da cobrança pelo link do grupo (10/11, 16h)
O link do grupo é o token do responsável e vai para todos. Nos modos `unico` e `sinal`, quem se cadastrasse por ele
recebia a cobrança do grupo inteiro. Agora o SRVKART manda `respDocHash`/`respFoneHash` (sha256 de `cpf:<11>` / `fone:<últimos 8>`)
e o worker (`worker-responsavel.mjs`) só cobra quando o CPF (ou, sem CPF, o celular) é do responsável. O `GET /api/grupo` não
anuncia cobrança do grupo antes do envio.

Bundle no ar = `worker-responsavel.mjs(worker-painel.mjs(index-antes-painel.js))`. Para reverter, suba `index-antes-painel.js`.
No SRVKART ficaram as cópias `grupos.antes-painel.ts` (original) e `grupos.antes-resp.ts` (só com o painel).

## Aviso e termo digital (11/11)
Bundle no ar: `worker-termo(worker-aviso(worker-responsavel(worker-painel(index-antes-painel.js))))`.
Para montar: `cp index-antes-painel.js base.js` e, em seguida, rode `worker-painel.mjs base.js`, `worker-responsavel.mjs base-painel.js`, `worker-aviso.mjs base-painel-resp.js` e `worker-termo.mjs base-painel-resp-aviso.js`. Por último, publique com `subir.mjs base-painel-resp-aviso-termo.js`.
- **Termo:** o SRVKART (`lib/ops/termo-online.ts`) publica o mesmo texto da impressão em `PUT /api/sync/termo`, com versão = hash do texto. O cadastro mostra o texto, pede o aceite e permite recusar o uso de imagem. O aceite vai para `dbo.ClienteTermoAceite` (migração 0019). O painel do grupo mostra "Termos X/Y". A assinatura impressa na recepção continua.
- Se o texto mudar (`data/ops/termo.txt`), muda a versão. Quem estiver com a página aberta recebe 409 e é avisado para recarregar.

## Painel v2: liberar vaga (11/11)
O organizador libera no painel a vaga de quem desistiu. Fluxo: `POST /api/grupo/painel/acao` grava o pedido na fila do R2 (`grupos/acoes/`). A cada minuto, o SRVKART (`aplicarAcoesDoPainel` → `liberarVagaPeloOrganizador`) aplica e confirma.
- A vaga volta a ficar aberta e a inscrição continua a mesma, no cadastro provisório "Amigo N".
- O pedido é recusado (e o motivo aparece no painel por 1 hora) quando: a vaga é do responsável; o termo já foi impresso ou o kart já está definido; a vaga foi paga pela própria pessoa no modo "cada um paga o seu"; ou falta menos de 1 hora para a bateria.
- Bundle no ar: `worker-acoes.mjs` aplicado sobre `base-painel-resp-aviso-termo.js`.

## 12/11: tudo passou para o código-fonte
Em 11/11, perto da meia-noite, o worker foi publicado a partir de `workers/pre-cadastro` e os remendos saíram do ar. Desde o commit 2e5228b, painel, termo, aviso, ações e cupom ficam no fonte (`src/extras.ts`, `public/painel.html`, `public/index.html`). **Publique só com `cd workers/pre-cadastro && npx wrangler deploy` a partir do `main` atualizado.** Os scripts `worker-*.mjs` desta pasta ficam só como histórico.
A busca de cadastro por CPF/e-mail (`/api/cliente/identificar`) não voltou: ela devolvia os dados pessoais de qualquer pessoa sem confirmação.
