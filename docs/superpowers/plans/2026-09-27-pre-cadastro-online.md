# Pré-cadastro Online: Plano de Implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: usar `superpowers:subagent-driven-development` ou `superpowers:executing-plans` e executar as tarefas na ordem. Marque cada etapa concluída (`- [ ]`).

**Objetivo:** Entregar link e QR de pré-cadastro, sincronizar cadastros com segurança ao SQL local e permitir que Totem 1 e Totem 2 recuperem e confirmem os dados sem selecionar bateria no site.

**Arquitetura:** A página Next.js grava pedidos pendentes no D1. O servidor da operação busca a fila por HTTPS de saída e grava staging no SQL local; os totens consultam primeiro clientes e pendências locais e só usam busca remota autenticada quando necessário. A confirmação no totem promove responsável e dependentes em uma transação, mantendo o cliente operacional como fonte prioritária.

**Stack:** Next.js 16, React 19, Cloudflare Workers/D1, Turnstile, TypeScript/Vitest, SQL Server, Node/TypeScript e aplicativos nativos Windows .NET 8 WinForms.

**Especificação:** `docs/superpowers/specs/2026-09-27-pre-cadastro-online-design.md`

## Restrições Globais

- Link canônico: `https://kartodromodebetim.com.br/pre-cadastro`; o QR contém somente esse endereço.
- Aplicativos da recepção e dos totens continuam nativos Windows; não criar tela web de totem, teclado na tela ou alteração no telão.
- O servidor SQL/operacional não recebe conexões da internet; somente o Worker acessa D1 publicamente.
- `tipoPessoa` usa `PF` ou `PJ`; cadastros antigos sem valor recebem `PF`. Não adicionar CNPJ ao fluxo de identificação.
- Pré-cadastros repetidos são idempotentes; cadastro operacional existente nunca é sobrescrito pelo formulário público.
- Nome, documento, celular, nascimento e consentimento são obrigatórios; e-mail, peso e endereço são opcionais. Dependentes exigem nome e nascimento; documento é opcional.
- Não escrever PII ou segredos em logs, arquivos versionados ou commits. Credenciais compartilhadas anteriormente estão expostas: não reutilizá-las; implantar somente com credenciais rotacionadas e novos segredos fora do Git.
- Aplicar limite de frequência persistente no Worker além da validação Turnstile; respostas públicas não confirmam se um documento/e-mail já existe.
- Testes em produção usam registros identificados exatamente como `TESTE CODEX` e os removem ao final. Nunca criar sessão na cronometragem real `:4050`; ela não faz parte deste escopo.
- Não reiniciar servidor com fila de impressão pendente nem atualizar a recepção ou totens enquanto estiverem em uso.

## Foco de Revisão

- Documento alfanumérico com pontuação (`AB.123`) não pode colidir com seu sufixo (`123`); cobrir em `normalizeDocument` e identificação nos dois formatos.
- E-mail compartilhado ou mais de um documento correspondente não pode escolher `TOP 1`; retornar desambiguação sem expor perfis até receber o tipo de documento.
- Cliente operacional criado antes da sincronização da fila deve vencer; importar a fila não pode atualizar nem duplicar esse cadastro.
- Falha entre gravação local e acknowledgement, ou repetição da confirmação, deve preservar a pendência e nunca duplicar responsável/dependentes.
- Token Turnstile ausente, inválido, repetido/expirado, payload grande ou segredo de sincronização ausente/incorreto deve falhar fechado, com resposta pública genérica e sem PII em logs.

---

## Mapa de Arquivos

- Criar `migrations/d1/0012_pre_cadastros.sql` e `lib/pre-cadastro-d1.ts` para fila privada, hashes HMAC e expiração.
- Criar `migrations/ops/0005_pre_cadastro.sql` e ampliar `lib/ops/db.ts` para campos do cliente, normalização e staging local.
- Criar `app/pre-cadastro/page.tsx`, `components/pre-cadastro/PreCadastroForm.tsx`, `lib/pre-cadastro-consent.ts`, `app/api/pre-cadastro/route.ts` e `app/pre-cadastro/qr.svg/route.ts` para página, validação, consentimento e QR.
- Criar rotas privadas sob `app/api/internal/pre-cadastros/` para busca da fila, lookup autenticado e acknowledgement.
- Criar `services/pre-cadastro-sync.ts`; ampliar `services/ops-server.ts` com sincronização de saída e rotas de totem.
- Atualizar `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs` e `desktop/src/Kartodromo.Recepcao/FormCliente.cs` para fluxo nativo e persistência de `tipoPessoa`.
- Criar testes Vitest junto aos helpers e rotas; usar os projetos WinForms existentes para build e validação de tela nos equipamentos reais.

## Tarefa 1: Modelo SQL local, normalização e contratos de cliente

**Arquivos:**
- Criar: `migrations/ops/0005_pre_cadastro.sql`
- Modificar: `lib/ops/db.ts`
- Testar: `tests/ops/document-normalization.test.ts`, `tests/ops/cliente-fields.test.ts`

**Interfaces:**
- Produz `normalizeDocument(value: unknown): string`, que remove pontuação/espaços, converte letras em maiúsculas e preserva toda letra e número.
- `ClienteInput.tipoPessoa` aceita `PF | PJ`; `clienteColumns` persiste o campo e `CLIENTE_COLS` o devolve.
- O SQL local expõe busca por `DocumentoBusca`, persiste `LgpdVersao` e oferece staging idempotente por `RequestId` com índices por documento/e-mail normalizados.

- [ ] **Passo 1: Escrever testes que falham** para `AB.123 -> AB123`, `123 -> 123`, documentos vazios, round-trip de `tipoPessoa` PF/PJ e round-trip de `LgpdVersao`.
- [ ] **Passo 2: Rodar os testes específicos**: `npm test -- tests/ops/document-normalization.test.ts tests/ops/cliente-fields.test.ts`. Esperado antes da implementação: falha nos novos casos.
- [ ] **Passo 3: Implementar helper e contratos** em `lib/ops/db.ts`; normalizar no insert/update sem alterar `DocumentoNum`, que continua atendendo compatibilidade dos clientes existentes.
- [ ] **Passo 4: Criar migração SQL repetível** com `TipoPessoa` default `PF`, `LgpdVersao`, `DocumentoBusca`, preenchimento dos clientes existentes, índices não exclusivos e tabelas de responsável/dependentes em staging. A chave única de pedido é `RequestId`; documento repetido não causa perda de pedidos operacionais existentes.
- [ ] **Passo 5: Validar a migração** duas vezes em uma cópia descartável do banco e conferir colunas, índices, contagens antes/depois e exemplos alfanuméricos; não usar produção nesta etapa.
- [ ] **Passo 6: Rodar testes específicos e os testes existentes de `lib/ops/db.ts`**; esperado: todos passam e `npm run typecheck` não acusa incompatibilidade.

## Tarefa 2: Fila D1 e operações idempotentes

**Arquivos:**
- Criar: `migrations/d1/0012_pre_cadastros.sql`
- Criar: `lib/pre-cadastro-d1.ts`, `lib/pre-cadastro-d1.test.ts`
- Criar: `worker.ts` como custom Worker que delega `fetch` ao worker gerado e executa limpeza diária.
- Modificar: `wrangler.jsonc` para apontar para o custom Worker e declarar o cron diário.
- Modificar: `lib/cloudflare-admin-db.ts` somente se necessário para os testes D1 locais

**Interfaces:**
- `enqueuePreCadastro(input, env) -> Promise<'queued' | 'duplicate>` guarda payload, consentimento, hashes HMAC de documento/e-mail e expiração de 30 dias.
- `listPreCadastros(db, limit) -> Promise<PendingPreCadastro[]>` entrega apenas itens não expirados.
- `findPreCadastro(db, {kind, value, tipoDocumento?}, indexKey) -> Promise<PendingPreCadastro[]>` não revela resultado à API pública.
- `ackPreCadastros(db, ids) -> Promise<number>` remove payload e hashes somente após confirmação do servidor local.
- `consumeSubmissionQuota(db, ipHash, now) -> Promise<boolean>` aplica o limite de 20 envios por IP pseudonimizado em 60 minutos sem guardar o IP puro; `purgeExpiredPreCadastros(db, now) -> Promise<number>` remove payload/hash vencidos.

- [ ] **Passo 1: Escrever testes D1** para inclusão, primeiro pedido prevalecer para documento pendente, lookup CPF/RG/passaporte, prefixo alfanumérico, e-mail ambíguo, acknowledgement, limite por janela e exclusão automática aos 30 dias.
- [ ] **Passo 2: Rodar `npm test -- lib/pre-cadastro-d1.test.ts`** e confirmar que os casos falham antes da implementação.
- [ ] **Passo 3: Implementar migração e helpers** usando o padrão de Miniflare/D1 dos testes existentes; calcular HMAC no Worker e nunca guardar os segredos na linha de comando ou no banco.
- [ ] **Passo 4: Implementar limpeza diária** no `scheduled()` do custom Worker, além da limpeza defensiva no pull; configurar trigger `0 3 * * *` em `wrangler.jsonc`, sem alterar outros triggers existentes.
- [ ] **Passo 5: Rodar a suíte específica e simular o scheduled localmente** com Wrangler; esperado: registros expirados somem sem tráfego público ou servidor local ativo e limites bloqueiam excesso por janela.

## Tarefa 3: Formulário público, Turnstile e QR permanente

**Arquivos:**
- Criar: `lib/pre-cadastro-consent.ts`
- Criar: `app/api/pre-cadastro/route.ts`, `app/api/pre-cadastro/route.test.ts`
- Criar: `app/pre-cadastro/page.tsx`, `components/pre-cadastro/PreCadastroForm.tsx`
- Criar: `app/pre-cadastro/qr.svg/route.ts`
- Modificar: `package.json` e lockfile para `qrcode` e tipos, se a lib não existir no ambiente

**Interfaces:**
- `POST /api/pre-cadastro` recebe perfil, dependentes, versão/aceite LGPD e token Turnstile; devolve a mesma resposta `202` para pedido novo ou duplicado.
- `GET /pre-cadastro/qr.svg` devolve SVG que codifica exclusivamente o link canônico.
- A forma de pessoa é `PF | PJ`; documento é CPF, RG ou passaporte; não há bateria, horário, produto, reserva ou pagamento.
- `lib/pre-cadastro-consent.ts` fixa `CONSENT_VERSION = '2026-09-27-v1'`; o servidor confere essa versão, registra seu próprio timestamp UTC e o segredo de limite de frequência é separado da chave HMAC de documentos.

- [ ] **Passo 1: Escrever testes de rota** para campos obrigatórios, CPF inválido, RG/passaporte, datas futuras/inválidas, consentimento ausente, menor sem nome/nascimento, payload acima de 64 KiB, Turnstile inválido, limite de 20 envios/60 minutos, resposta igual para duplicado e logs sem PII.
- [ ] **Passo 2: Rodar `npm test -- app/api/pre-cadastro/route.test.ts`** e confirmar as falhas esperadas.
- [ ] **Passo 3: Implementar validação server-side e Siteverify**; manter `TURNSTILE_SECRET_KEY`, `PRECADASTRO_INDEX_KEY` e `PRECADASTRO_RATE_KEY` somente no Worker. Validar a versão `2026-09-27-v1`, exibir o texto exato do diálogo atual do totem e registrar o timestamp UTC gerado no servidor.
- [ ] **Passo 4: Aplicar `consumeSubmissionQuota` antes de aceitar o pedido**; derivar chave HMAC a partir do IP entregue pela plataforma, nunca guardar ou registrar o IP cru, e retornar a mesma resposta genérica quando a regra de duplicidade for acionada.
- [ ] **Passo 5: Implementar formulário responsivo** com tipo de pessoa, tipo/documento, nome, e-mail, celular, nascimento, peso, CEP, endereço, número, complemento, bairro, cidade e UF; incluir dependentes com documento opcional, CEP editável com ViaCEP, confirmação genérica e retenção local dos campos em falha de rede. Não incluir escolha de bateria.
- [ ] **Passo 6: Implementar endpoint QR SVG** apontando sempre para `https://kartodromodebetim.com.br/pre-cadastro`; mostrar QR, link copiável e opções de baixar/imprimir na página.
- [ ] **Passo 7: Validar interface e rotas** com `npm test -- app/api/pre-cadastro/route.test.ts`, `npm run typecheck` e Playwright em viewport móvel e desktop; esperado: fluxo completo sem chamadas de leitura pública da fila.

Referências técnicas: [Cloudflare Turnstile: validação server-side obrigatória](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/); [node-qrcode: saída SVG](https://github.com/soldair/node-qrcode).

Para retenção, o custom Worker segue o padrão documentado de [Cron Triggers da Cloudflare](https://developers.cloudflare.com/workers/configuration/cron-triggers/) e [custom Worker do OpenNext](https://opennext.js.org/cloudflare/howtos/custom-worker).

## Tarefa 4: API privada da fila no Worker

**Arquivos:**
- Criar: `app/api/internal/pre-cadastros/pull/route.ts`
- Criar: `app/api/internal/pre-cadastros/ack/route.ts`
- Criar: `app/api/internal/pre-cadastros/lookup/route.ts`
- Criar: `app/api/internal/pre-cadastros/internal-routes.test.ts`
- Modificar: tipos de ambiente Cloudflare existentes

**Interfaces:**
- Todas as rotas exigem `Authorization: Bearer <PRECADASTRO_SYNC_KEY>` e falham fechadas se o segredo não estiver configurado.
- `POST /pull` recebe `{limit}` e responde `{items:[{id,payload,createdAt,expiresAt}]}`.
- `POST /ack` recebe `{ids:string[]}` e remove payload/hashes somente para UUIDs reconhecidos.
- `POST /lookup` recebe `{kind:'document'|'email', value:string, tipoDocumento?:'CPF'|'RG'|'PASSAPORTE'}` e devolve zero, um ou vários itens para decisão local; nunca é chamado pelo navegador.

- [ ] **Passo 1: Escrever testes** sem autorização, com chave ausente/incorreta, batch limitado, lookup sem correspondência, colisão de e-mail, acknowledgement desconhecido e logs sem segredo/PII.
- [ ] **Passo 2: Rodar `npm test -- app/api/internal/pre-cadastros/internal-routes.test.ts`** e verificar falha inicial.
- [ ] **Passo 3: Implementar as três rotas** usando os helpers da Tarefa 2, comparação de segredo em tempo constante e corpos de resposta sem logging de PII.
- [ ] **Passo 4: Rodar os testes da rota e todos os testes D1**; esperado: um browser sem segredo nunca lê ou confirma um pré-cadastro.

## Tarefa 5: Sincronização de saída e staging no SQL operacional

**Arquivos:**
- Criar: `services/pre-cadastro-sync.ts`, `tests/ops/pre-cadastro-sync.test.ts`
- Modificar: `services/ops-server.ts`, `lib/ops/db.ts`
- Usar: tabelas criadas em `migrations/ops/0005_pre_cadastro.sql`

**Interfaces:**
- `startPreCadastroSync({baseUrl, syncKey, intervalMs = 15000})` busca em lote e só envia acknowledgement depois do commit SQL local.
- `stagePreCadastro(item)` é idempotente por UUID, grava responsável e dependentes, e descarta a cópia pública se o documento já existir operacionalmente.
- `lookupPendingPreCadastro({kind, value, tipoDocumento?})` consulta staging local; somente quando não houver resultado chama o lookup autenticado do Worker.
- `cleanupExpiredStaging(now)` remove responsável/dependentes não confirmados após 30 dias e roda no ciclo do serviço.

- [ ] **Passo 1: Escrever testes** para sync normal, pedido repetido, SQL indisponível antes do ack, falha após staging antes do ack, limpeza aos 30 dias, cliente operacional preexistente e falha de internet na busca sob demanda.
- [ ] **Passo 2: Rodar `npm test -- tests/ops/pre-cadastro-sync.test.ts`** e confirmar falha inicial.
- [ ] **Passo 3: Implementar polling de 15 segundos configurável** e endpoints do Worker usando HTTPS, `PRECADASTRO_SYNC_URL`/`PRECADASTRO_SYNC_KEY` vindos do `.env.local`; não registrar documento, e-mail, payload, token ou chave.
- [ ] **Passo 4: Implementar staging transacional** no SQL local com índice exato de documento normalizado e e-mail, expiração de 30 dias e limpeza de pendências vencidas; tratar repetição de pull como operação segura.
- [ ] **Passo 5: Rodar testes específicos e checagem TS do servidor**: `npx tsc --noEmit --skipLibCheck --target es2022 --module esnext --moduleResolution bundler --esModuleInterop --types node services/ops-server.ts`.

## Tarefa 6: Identificação, confirmação e promoção nos dois totens

**Arquivos:**
- Modificar: `services/ops-server.ts`, `lib/ops/db.ts`
- Modificar: `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`
- Criar: `tests/ops/totem-pre-cadastro.test.ts`

**Interfaces:**
- `POST /api/totem/identificar` passa a aceitar `{identificador, tipoDocumento?}` e distingue cliente operacional, pendência, sem resultado e ambiguidade sem escolher registro arbitrário.
- Documento operacional é procurado primeiro usando valor normalizado; e-mail só retorna perfil se for único. Documento que colide entre tipos oferece seletor de tipo; mais de um resultado do mesmo tipo instrui procurar a recepção. E-mail ambíguo instrui identificação por documento.
- A resposta mantém o contrato antigo (`cliente`, `dependentes`, `token`) e acrescenta dados de pré-cadastro/ambiguidade somente quando o app envia `X-Kartodromo-Features: pre-cadastro-v1`; a interface web legada mantém o fluxo manual.
- `POST /api/totem/pre-cadastro/confirmar` recebe `{requestId, token, dados, lgpd:true}`; o token assinado escopa o UUID e expira. O servidor cria responsável e dependentes na mesma transação e responde sempre com o mesmo cliente numa repetição.
- Segredo `PRECADASTRO_TOKEN_KEY` de confirmação é explícito no `.env.local`; serviço recusa emissão/validação de token quando ausente, sem fallback inseguro.

- [ ] **Passo 1: Escrever testes do servidor** para CPF/RG/passaporte/e-mail único, colisão alfanumérica, múltiplos tipos, duplicados do mesmo tipo, e-mail compartilhado, cliente operacional prioritário, token ausente/expirado/de outro UUID ou chave ausente, busca local/remota, promoção idempotente com dependentes e rollback sem inserção parcial.
- [ ] **Passo 2: Rodar `npm test -- tests/ops/totem-pre-cadastro.test.ts`** e confirmar falha inicial.
- [ ] **Passo 3: Implementar busca sem `TOP 1` arbitrário** e promover pendência com `tx`; conservar o fluxo manual atual quando não houver pré-cadastro ou internet.
- [ ] **Passo 4: Alterar `FormTotem`** para enviar `X-Kartodromo-Features: pre-cadastro-v1`, distinguir origem online, preencher/conferir campos, exibir `tipoPessoa`, mostrar tipo de documento só para desambiguação, enviar `tipoPessoa`/`LgpdVersao`, manter teclado USB sem teclado virtual e seguir para participantes/baterias somente após confirmação.
- [ ] **Passo 5: Compilar os apps nativos** com `dotnet build desktop/src/Kartodromo.Autoatendimento/Kartodromo.Autoatendimento.csproj -c Release` e executar autoteste visual em ambiente não produtivo; esperado: busca e cadastro novos continuam disponíveis.
- [ ] **Passo 6: Reexecutar testes de servidor e checagem TS**; esperado: Totem 1 e 2 consomem o mesmo contrato e nenhuma bateria aparece no formulário online.

## Tarefa 7: Persistência de pessoa física/jurídica na recepção

**Arquivos:**
- Modificar: `lib/ops/office.ts`, `lib/ops/db.ts`
- Modificar: `desktop/src/Kartodromo.Recepcao/FormCliente.cs`
- Modificar/criar: `tests/ops/office-routes.test.ts`

**Interfaces:**
- As rotas da recepção retornam `tipoPessoa` em consulta e aceitam `tipoPessoa: 'PF'|'PJ'` em inclusão/edição.
- O app nativo seleciona o valor retornado ao abrir e o envia ao salvar; cliente antigo sem valor aparece como pessoa física.

- [ ] **Passo 1: Escrever testes de API** para round-trip PF/PJ em inclusão, detalhe e edição parcial sem `tipoPessoa`.
- [ ] **Passo 2: Rodar `npm test -- tests/ops/office-routes.test.ts`** para verificar a falha antes da alteração.
- [ ] **Passo 3: Implementar round-trip da API e UI** sem mudar a interface web legada.
- [ ] **Passo 4: Compilar recepção** com `dotnet build desktop/src/Kartodromo.Recepcao/Kartodromo.Recepcao.csproj -c Release`; esperado: o campo permanece após fechar e reabrir cliente.
- [ ] **Passo 5: Rodar testes da recepção, TypeScript e suite Vitest**; esperado: campos omitidos mantêm compatibilidade dos clientes existentes.

## Tarefa 8: Verificação integrada, publicação e entrega

**Arquivos:**
- Modificar: scripts de deploy/documentação somente se necessário para as novas migrações e configurações
- Testar: Worker/D1, API operacional, Recepção .53, Totem 1 `.161` e Totem 2 `.69`

**Interfaces:** usar os contratos e campos definidos nas Tarefas 1–7; deploy de SQL sempre precede código de servidor e apps nativos.

- [ ] **Passo 1: Rodar verificações locais completas**: `npm run typecheck`, `npm test`, build Worker (`npm run build:worker`) e builds WinForms de Recepção e Autoatendimento. Registrar falhas preexistentes separadamente, sem ocultar falha nova.
- [ ] **Passo 2: Validar primeiro em ambiente isolado** a migração D1, migração SQL repetida, envio/duplicidade, polling/ack, lookup sob demanda, promoção/rollback e QR decodificado exatamente para a URL canônica.
- [ ] **Passo 3: Preparar produção** somente com credenciais Cloudflare/GitHub rotacionadas e segredos novos entregues por canal seguro; configurar Turnstile e segredos fora do repo, aplicar migrações idempotentes, conferir backup e fila de impressão vazia antes de reiniciar o servidor.
- [ ] **Passo 4: Publicar Worker e serviço operacional**, verificar `/healthz`, status de fila e logs sem PII; confirmar que o SQL continua acessível apenas na LAN.
- [ ] **Passo 5: Instalar apps nativos apenas quando Recepção e totens estiverem sem uso** via `scripts/apps/implantar-remoto.ps1`; não tocar em `FormTV`, `--tv` ou cronometragem.
- [ ] **Passo 6: Fazer teste ponta a ponta com nome exatamente `TESTE CODEX`**: pré-cadastro no link, leitura do QR, importação e busca por CPF/RG/passaporte/e-mail único, testar dependente e colisões, repetir no Totem 1 e Totem 2, confirmar bateria ainda não escolhida no site e reservar somente no fluxo presencial.
- [ ] **Passo 7: Verificar persistência `tipoPessoa` na recepção após fechar/abrir**, revisar D1/SQL e remover todas as linhas de teste ao final; confirmar fila de impressão sem job de teste e ausência de PII nos logs.
- [ ] **Passo 8: Entregar link permanente e arquivo/endpoint SVG do QR**, comandos/configuração final sem segredos, máquinas atualizadas, testes executados e qualquer bloqueio externo explicitamente descrito.
