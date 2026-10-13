# Kartódromo Mobile App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Entregar o app iOS e Android do Kartódromo de Betim com agenda, reservas, cupons, treino GPS pessoal e resultados oficiais publicados.

**Architecture:** Criar em mobile/ um app independente React Native com Expo Router e TypeScript. O Cloudflare Worker existente em workers/pre-cadastro continua como única API pública; D1 guarda identidade, sessões, vínculos e resultados publicados, R2 mantém os pedidos online, e o servidor operacional no SQL Server continua autoridade de vagas, preços, cupons e pagamentos. A cronometragem envia resultados somente após publicação explícita pelo programa Windows.

**Tech Stack:** Expo, React Native, TypeScript, Expo Router, expo-location, expo-secure-store, expo-sqlite, Cloudflare Workers/D1/R2, Node.js/TypeScript, SQL Server, WinForms .NET 8, Vitest/Jest e EAS Build/Submit.

**Spec:** docs/superpowers/specs/2026-10-12-kartodromo-mobile-app-design.md

## Global Constraints

- O app de cliente será um pacote novo em mobile/, separado do app Android interno de sorteio e sem dependências móveis no package.json da raiz.
- iOS e Android terão os mesmos fluxos principais; login aceita e-mail ou CPF e a senha tem no mínimo 8 caracteres.
- O app não acessa SQL Server, Asaas, /api/office/*, API administrativa ou rede interna.
- Agenda, disponibilidade, valor, desconto, estado da reserva e confirmação de pagamento vêm do servidor.
- GPS coleta apenas com treino iniciado e app em primeiro plano; pontos ficam no dispositivo, podem ser apagados e nunca viram resultado oficial.
- Resultados só aparecem após publicação explícita pela operação; histórico antigo exige vínculo de identidade validado, sem correspondência aproximada por nome.
- Não clonar nem fazer proxy do MyLapTime/Sisecom. Referências inspiram a categoria, não a implementação ou identidade visual.
- Programas da operação continuam Windows nativos em desktop/; não alterar FormTV nem --tv. Cronometragem deve ser simulada em :4150, nunca testada no :4050 real.
- Não registrar senha, token, chave Asaas ou CPF completo em arquivo, commit, tela de diagnóstico ou log. Migrar banco antes de publicar código que o consome.
- Testes que escrevam em produção só usam registros “TESTE CODEX” e removem esses registros ao final.

## Review Focus

- Reenvio simultâneo de reserva com a mesma chave de idempotência ou falha entre D1 e R2: deve retornar o mesmo pedido sem criar cobrança duplicada. Teste: Task 4.
- Dois pedidos concorrentes pelo último uso de um cupom, expiração, pagamento sem vaga e confirmação de reembolso: o limite e o desconto devem permanecer consistentes. Teste: Task 5.
- Token expirado/reutilizado, CPF ou e-mail já cadastrado e recuperação de conta: falha deve ser segura e não revelar existência de outra conta. Teste: Task 2.
- Permissão GPS negada, precisão ruim, app em segundo plano e geometria de pista ausente: não registrar volta inventada nem habilitar cronometragem sem traçado medido. Teste: Task 7.
- Sessão sem customerId, identidade não validada, resultado corrigido ou retirado: não expor histórico alheio nem manter publicação desatualizada. Teste: Task 8.

---

## Mapa de arquivos e fronteiras

- mobile/app/: rotas Expo Router e telas de cliente; mobile/src/api/ contém contratos e transporte HTTP; mobile/src/session/ mantém sessão; mobile/src/features/ divide reservas, GPS e resultados.
- workers/pre-cadastro/src/mobile/: endpoints móveis, autenticação, cupons e resultados. workers/pre-cadastro/migrations/ mantém schema D1; o binding PRE/R2 continua guardando pedidos.
- lib/ops/reserva-online.ts e services/ops-server.ts: sincronização com a operação e validação autoritativa de reserva/cupom. migrations/ops/ mantém alterações SQL Server, sempre aplicadas primeiro no ambiente alvo.
- lib/timing/mobile-results.ts e services/timing-server.ts: seleção dos campos oficiais, publicação autenticada e auditoria. desktop/src/Kartodromo.Cronometragem/FormCrono.cs oferece a ação ao operador; desktop/src/Kartodromo.Recepcao/FormCliente.cs oferece o vínculo assistido de identidade.
- tests/mobile/ e testes existentes cobrem Worker/servidor; mobile/__tests__/ cobre telas e lógica local; .github/workflows/mobile.yml verifica o pacote Expo e cria builds internos sob acionamento explícito.

## Plano de execução

### Task 1: Criar a base Expo independente

**Files:**
- Create: mobile/package.json, mobile/package-lock.json, mobile/app.json, mobile/tsconfig.json, mobile/jest.config.js
- Create: mobile/app/_layout.tsx, mobile/app/index.tsx, mobile/__tests__/app-shell.test.tsx

**Interfaces:**
- Expo Router usa mobile/app/ como diretório de rotas; configuração TypeScript estrita.
- Configuração inicial: nome “Kartódromo de Betim”, slug kartodromo-betim e esquema kartodromo. Instalar o SDK estável produzido pelo template Expo atual e preservar versões no lockfile.

- [x] **Step 1: Inicializar o projeto e o preset de testes** com o template Expo Router/TypeScript atual; manter instalação, scripts e lockfile dentro de mobile/.
- [x] **Step 2: Escrever o teste mobile/__tests__/app-shell.test.tsx**, verificando que a tela inicial mostra a ação “Reservar bateria” e acesso à agenda e ao login.
- [x] **Step 3: Rodar o teste e confirmar a falha** com npm --prefix mobile test -- --runInBand __tests__/app-shell.test.tsx.
- [x] **Step 4: Implementar app/_layout.tsx e app/index.tsx** com navegação inicial acessível e o estado de rede nos fluxos remotos.
- [x] **Step 5: Verificar o teste e os tipos** com npm --prefix mobile test -- --runInBand __tests__/app-shell.test.tsx e npm --prefix mobile run typecheck. Resultado esperado: PASS e nenhum erro TypeScript.

### Task 2: Implementar identidade e autenticação no Worker

**Files:**
- Create: workers/pre-cadastro/migrations/0001_mobile_identity.sql
- Create: workers/pre-cadastro/src/mobile/auth.ts, workers/pre-cadastro/src/mobile/email.ts
- Modify: workers/pre-cadastro/src/index.ts, workers/pre-cadastro/src/cloudflare.d.ts, workers/pre-cadastro/wrangler.jsonc
- Test: tests/mobile/auth.test.ts

**Interfaces:**
- Binding D1: MOBILE_DB. Tabelas para contas, sessões revogáveis, tokens de e-mail de uso único e limites de tentativa; CPF armazenado cifrado e pesquisado por índice HMAC, sem plaintext em logs.
- Nome D1: kartodromo-mobile, com IDs distintos para desenvolvimento/homologação e produção; migrations_dir fica em workers/pre-cadastro/migrations.
- Rotas: POST /api/mobile/v1/auth/register, /login, /email/verify, /password/forgot, /password/reset, /session/refresh e /session/logout.
- Credencial: PBKDF2-HMAC-SHA-256 com salt aleatório de 16 bytes e custo versionado de 600.000 iterações; senha mínima de 8 caracteres. Token de acesso opaco expira em 15 minutos; refresh opaco rotativo expira em 30 dias; apenas hashes dos tokens ficam em D1.
- E-mail transacional enviado por HTTPS via Resend; RESEND_API_KEY e remetente verificado ficam em segredo/configuração do Worker, nunca no repositório. Tokens de verificação e redefinição são de uso único e expiram em 30 minutos.

- [x] **Step 1: Escrever tests/mobile/auth.test.ts** para cadastro com senha curta, login por e-mail/CPF, verificação e redefinição de uso único, refresh rotativo e respostas indistinguíveis para conta existente/inexistente.
- [x] **Step 2: Rodar o teste e confirmar a falha** com npx vitest run tests/mobile/auth.test.ts.
- [x] **Step 3: Criar a migration D1, o binding e o auth.ts/email.ts**; implementar as sete rotas, limites por IP e identificador, mensagens que não enumerem contas e envio HTTPS de e-mail.
- [x] **Step 4: Integrar as rotas em src/index.ts** sem alterar os fluxos públicos atuais de pré-cadastro e reserva sem conta.
- [x] **Step 5: Verificar testes e migration local** com npx vitest run tests/mobile/auth.test.ts e npx wrangler d1 migrations apply kartodromo-mobile --local --config workers/pre-cadastro/wrangler.jsonc. Resultado esperado: testes PASS e migration aplicada no D1 local.

### Task 3: Conectar cadastro e sessão no app Expo

**Files:**
- Create: mobile/src/api/contracts.ts, mobile/src/api/client.ts
- Create: mobile/src/session/provider.tsx, mobile/src/session/secure-storage.ts
- Create: mobile/app/(auth)/login.tsx, cadastro.tsx, verificar-email.tsx, recuperar-senha.tsx, redefinir-senha.tsx
- Modify: mobile/app/_layout.tsx, mobile/app/index.tsx
- Test: mobile/__tests__/session.test.tsx

**Interfaces:**
- client.ts expõe authApi.login(identifier, password), register(input), verifyEmail(token), requestPasswordReset(identifier), resetPassword(token, password), refresh() e logout().
- Sessão guarda somente access/refresh tokens no expo-secure-store; senha e tokens não são escritos em AsyncStorage, SQLite, logs ou analytics.
- Cadastro exige aceite da política pública /privacidade e apresenta coleta/uso de dados; permissão do sistema para localização só é solicitada ao iniciar um treino.

- [x] **Step 1: Escrever session.test.tsx** cobrindo restauração da sessão, expiração do access token, refresh único, logout e falha de refresh que limpa os tokens.
- [x] **Step 2: Rodar o teste e confirmar a falha** com npm --prefix mobile test -- --runInBand __tests__/session.test.tsx.
- [x] **Step 3: Implementar contratos HTTP, SecureStore, provider e telas de conta**; validar a senha no cliente para orientar o usuário e repetir a validação no Worker.
- [x] **Step 4: Verificar teste e tipos** com npm --prefix mobile test -- --runInBand __tests__/session.test.tsx e npm --prefix mobile run typecheck. Resultado esperado: PASS.

### Task 4: Vincular reservas à conta e garantir idempotência

**Files:**
- Create: workers/pre-cadastro/migrations/0002_mobile_bookings.sql
- Create: workers/pre-cadastro/src/mobile/reservations.ts
- Modify: workers/pre-cadastro/src/index.ts, workers/pre-cadastro/src/reservas.ts
- Modify: workers/pre-cadastro/src/asaas.ts
- Modify: lib/ops/reserva-online.ts, services/ops-server.ts
- Test: tests/mobile/reservations-api.test.ts, tests/mobile/asaas-idempotency.test.ts, tests/reserva-online.test.ts

**Interfaces:**
- GET /api/mobile/v1/agenda é público. POST /api/mobile/v1/reservations exige sessão e Idempotency-Key; recebe bateriaId, quantidade, pilotos e forma pix/cartao. GET /reservations e GET /reservations/:id retornam somente pedidos cujo account_id é da sessão.
- mobile_orders relaciona account_id, pedido_id, idempotency_key e hash do corpo; grava estado creating/ready para repetir com segurança um PUT no R2 após falha parcial. Repetir a mesma chave e corpo devolve o pedido original; mesma chave com corpo diferente retorna 409.
- O Worker carrega nome/documento/e-mail/telefone do perfil autenticado; nunca aceita do app um account_id ou preço autoritativo. Pedido móvel consultado pela rota pública antiga por ID retorna 404; pedidos legados sem conta mantêm seu fluxo.
- A cobrança usa o pedido como externalReference estável; depois de timeout ambíguo, consultar GET /payments?externalReference=:pedidoId e reutilizar a cobrança existente antes de tentar criar outra.

- [ ] **Step 1: Escrever testes** para agenda pública, cliente A sem acesso ao pedido B, chave repetida, corpo diferente com 409, recuperação após falha entre gravação D1/R2 e reutilização da cobrança Asaas após timeout.
- [ ] **Step 2: Rodar os testes e confirmar falha** com npx vitest run tests/mobile/reservations-api.test.ts tests/mobile/asaas-idempotency.test.ts tests/reserva-online.test.ts.
- [ ] **Step 3: Criar migration e rotas móveis**; gravar propriedade/idempotência em D1, encaminhar pedido ao fluxo R2 existente e bloquear leitura anônima do pedido móvel.
- [ ] **Step 4: Ajustar o sincronizador operacional** para preservar o ID do pedido e os estados existentes: novo, aguardando_pagamento, pago, confirmado, recusado, expirado, pago_sem_vaga e erro_pagamento.
- [ ] **Step 5: Aplicar migrations no banco local/de homologação antes do código** e rodar npx vitest run tests/mobile/reservations-api.test.ts tests/mobile/asaas-idempotency.test.ts tests/reserva-online.test.ts. Resultado esperado: testes PASS; cobrança continua criada apenas pela integração Asaas existente.

### Task 5: Validar e consumir cupons de forma atômica

**Files:**
- Create: workers/pre-cadastro/migrations/0003_mobile_coupon_previews.sql
- Create: workers/pre-cadastro/src/mobile/coupons.ts
- Create: migrations/ops/0010_reserva_online_voucher.sql
- Modify: workers/pre-cadastro/src/index.ts, lib/ops/reserva-online.ts, lib/ops/office.ts, services/ops-server.ts
- Test: tests/mobile/coupons-api.test.ts, tests/ops/reserva-online-voucher.test.ts

**Interfaces:**
- POST /api/mobile/v1/coupons/preview cria job curto em D1 e responde requestId; GET /coupons/preview/:requestId consulta o resultado. O servidor operacional busca jobs por GET /api/sync/mobile/coupons e devolve o resultado por POST /api/sync/mobile/coupons/:requestId, sempre com x-sync-key.
- previsualizarVoucherOnline(input: { codigo: string; documento: string; bateriaId: number; quantidade: number }) retorna brutoCentavos, descontoCentavos e totalCentavos, ou erro de elegibilidade. A prévia não reserva uso.
- dbo.ReservaOnlineVoucherUso registra PedidoId único, VoucherId, ClienteId, desconto, validade e estado reservado/consumido/liberado/reembolso_pendente. Não alterar VoucherUso para criar venda fictícia; contar os usos de venda existentes junto com os usos online ativos.
- reservarPedido revalida o cupom sob lock na mesma transação SQL que segura as vagas e grava o valor final. Pagamento confirmado consome o uso; pedido expirado/recusado libera; pago_sem_vaga mantém pendente até a recepção confirmar reembolso ou solução operacional.

- [ ] **Step 1: Escrever testes** para cupom ativo, vencido, inelegível, limite atingido, pedido mínimo, teto de desconto, dois resgates concorrentes e transições de pagamento/reembolso.
- [ ] **Step 2: Rodar os testes e confirmar falha** com npx vitest run tests/mobile/coupons-api.test.ts tests/ops/reserva-online-voucher.test.ts.
- [ ] **Step 3: Adicionar jobs de prévia no D1** com expiração curta, autorização por conta e respostas sem enumeração ou exposição de outros pedidos.
- [ ] **Step 4: Implementar validação/consumo em SQL** com locks e transação única para uso do cupom, bloqueio de vagas, ReservaOnline e valor final; preservar dbo.Voucher e o fluxo de venda existente.
- [ ] **Step 5: Integrar sincronização e resolução de pago_sem_vaga** às rotas operacionais existentes; uso só passa a liberado após vencimento/recusa ou confirmação do reembolso.
- [ ] **Step 6: Aplicar migrations primeiro em banco de homologação e verificar concorrência e estados** com npx vitest run tests/mobile/coupons-api.test.ts tests/ops/reserva-online-voucher.test.ts. Resultado esperado: nenhum uso excedido e cobrança igual ao total registrado no SQL.

### Task 6: Implementar agenda, reservas e pagamento no app

**Files:**
- Create: mobile/app/(tabs)/agenda.tsx, reservas.tsx, mobile/app/reservations/[id].tsx
- Create: mobile/src/features/reservations/api.ts, schemas.ts, components.tsx
- Modify: mobile/app/_layout.tsx, mobile/app/index.tsx
- Test: mobile/__tests__/reservations.test.tsx

**Interfaces:**
- api.ts usa os contratos da Task 4 e Task 5; nenhuma tela calcula preço ou confirma pagamento por conta própria.
- Agenda mostra horários BRL em America/Sao_Paulo. Reserva mostra quantidade, pilotos, cupom, prévia do servidor, estados atuais, prazo, Pix/QR ou invoiceUrl do Asaas. Minhas reservas lista somente a conta autenticada.
- Cupom é código digitado no fluxo de reserva; esta versão não inclui catálogo promocional, pois o sistema atual não publica uma fonte de campanhas.

- [ ] **Step 1: Escrever reservations.test.tsx** verificando agenda sem login, reserva que exige login, cupom aplicado apenas pela resposta do servidor, valor/estado de pagamento e erro recuperável sem rede.
- [ ] **Step 2: Rodar o teste e confirmar falha** com npm --prefix mobile test -- --runInBand __tests__/reservations.test.tsx.
- [ ] **Step 3: Implementar telas e chamadas de API** para agenda, pedido, prévia de cupom, minhas reservas e detalhe/pagamento; usar expo-clipboard somente para copiar o código Pix.
- [ ] **Step 4: Verificar testes, tipos e formatação BRL/data** com npm --prefix mobile test -- --runInBand __tests__/reservations.test.tsx e npm --prefix mobile run typecheck. Resultado esperado: PASS e estados do servidor preservados.

### Task 7: Implementar treino GPS pessoal local

**Files:**
- Create: mobile/app/(tabs)/gps.tsx
- Create: mobile/src/features/gps/location.ts, lap-detector.ts, local-db.ts, repository.ts
- Create: mobile/src/features/gps/track-config.ts
- Test: mobile/__tests__/gps.test.ts

**Interfaces:**
- location.ts inicia Location.watchPositionAsync somente após consentimento/permissão foreground e botão Iniciar; encerra assinatura ao parar, desmontar a tela ou app sair de active. Não solicitar permissão background.
- lap-detector.ts recebe pontos GPS e uma linha de chegada medida; retorna passagens válidas ou nenhuma. Sessão, voltas e pontos ficam em expo-sqlite; excluir treino apaga linhas e pontos relacionados.
- track-config.ts não contém coordenadas inventadas. Sem geometria medida e validada pelo kartódromo, a ação de cronometrar fica desabilitada e explica que a configuração está pendente.

- [ ] **Step 1: Escrever gps.test.ts** com rota sintética de teste para detector, precisão além do limite sem volta, ponto fora de ordem, permissão negada, pausa em background e configuração ausente.
- [ ] **Step 2: Rodar o teste e confirmar falha** com npm --prefix mobile test -- --runInBand __tests__/gps.test.ts.
- [ ] **Step 3: Implementar coleta foreground, detecção, qualidade GPS, persistência local e exclusão**; rotular cada sessão “Treino pessoal”, sem exportação ou ranking oficial.
- [ ] **Step 4: Adicionar a geometria real somente após medição aprovada** e registrar seus pontos/fontes em track-config.ts.
- [ ] **Step 5: Verificar testes e tipos** com npm --prefix mobile test -- --runInBand __tests__/gps.test.ts e npm --prefix mobile run typecheck. Resultado esperado: nenhuma permissão background e nenhum dado fora do dispositivo.

### Task 8: Publicar resultados oficiais e validar identidade assistida

**Files:**
- Create: workers/pre-cadastro/migrations/0004_mobile_results.sql
- Create: workers/pre-cadastro/src/mobile/results.ts, lib/timing/mobile-results.ts
- Modify: workers/pre-cadastro/src/index.ts, services/timing-server.ts
- Modify: desktop/src/Kartodromo.Cronometragem/FormCrono.cs, desktop/src/Kartodromo.Recepcao/FormCliente.cs
- Modify: services/ops-server.ts, lib/ops/office.ts
- Test: tests/mobile/results-publication.test.ts

**Interfaces:**
- O operador publica por ação explícita na tela nativa FormCrono somente uma sessão encerrada. POST local /api/sessions/:id/mobile-publication exige permissão resultados_publicar_mobile; a retirada/correção é explícita e auditada. Nunca alterar FormTV ou --tv.
- O servidor envia por HTTPS ao Worker apenas sessionId, evento/data, customerId, nome de exibição, posição, kart, voltas e melhor volta. O token de publicação fica em segredo local fora do repositório e em segredo do Worker.
- Worker aceita POST /api/mobile/v1/internal/results somente com MOBILE_PUBLISH_TOKEN e upsert idempotente por sessão/piloto; mantém estado publicado/retirado e auditoria. GET /api/mobile/v1/results retorna apenas sessões publicadas e GET /api/mobile/v1/results/me exige sessão e vínculo validado.
- POST /api/mobile/v1/internal/identity-links exige MOBILE_ADMIN_TOKEN, separado do token de publicação. Vínculo antigo é escrito por ação restrita na tela nativa de cliente após a recepção conferir a identidade; POST /api/office/mobile-identities/link envia customerId e e-mail verificado ao Worker. A chave primária é o customerId exato; nomes parecidos nunca vinculam.

- [ ] **Step 1: Escrever results-publication.test.ts** provando que sessão não encerrada, competidor sem customerId ou publicação sem permissão é rejeitada; retirada remove o resultado público e mantém trilha de auditoria.
- [ ] **Step 2: Rodar o teste e confirmar falha** com npx vitest run tests/mobile/results-publication.test.ts.
- [ ] **Step 3: Implementar serializer e endpoints** com lista fechada de campos, token servidor-a-servidor, idempotência, edição/retirada explícita e log sem CPF/e-mail completo.
- [ ] **Step 4: Adicionar permissões e ações nas telas Windows nativas** de cronometragem e recepção; preservar o fluxo atual e nunca embutir segredo do Worker no executável.
- [ ] **Step 5: Verificar testes e build** com npx vitest run tests/mobile/results-publication.test.ts e dotnet build desktop/src/Kartodromo.Cronometragem/Kartodromo.Cronometragem.csproj -c Release no ORBITS/Windows.
- [ ] **Step 6: Validar a publicação somente com o simulador** TIMING_SIMULATE=1 TIMING_PORT=4150 npx tsx services/timing-server.ts; conferir publicação, retirada e correção com sessão “TESTE CODEX”. Não iniciar nem consultar o serviço real :4050.

### Task 9: Mostrar resultados e histórico no app

**Files:**
- Create: mobile/app/(tabs)/resultados.tsx
- Create: mobile/src/features/results/api.ts, types.ts
- Modify: mobile/app/_layout.tsx, mobile/app/index.tsx
- Test: mobile/__tests__/results.test.tsx

**Interfaces:**
- GET /results exibe somente eventos/resultados publicados; GET /results/me exige sessão e retorna apenas resultados do customerId ligado e validado.
- Conta sem vínculo vê orientação para procurar a recepção, sem receber confirmação de que CPF/cliente está cadastrado.

- [ ] **Step 1: Escrever results.test.tsx** para resultado público retirado, histórico da conta vinculada e conta sem vínculo sem vazamento de existência de cadastro.
- [ ] **Step 2: Rodar o teste e confirmar falha** com npm --prefix mobile test -- --runInBand __tests__/results.test.tsx.
- [ ] **Step 3: Implementar listagem por evento/data, classificação e histórico pessoal** usando somente as APIs da Task 8.
- [ ] **Step 4: Verificar teste e tipos** com npm --prefix mobile test -- --runInBand __tests__/results.test.tsx e npm --prefix mobile run typecheck. Resultado esperado: dados retirados não aparecem.

### Task 10: Preparar CI, builds assinados e distribuição interna

**Files:**
- Create: .github/workflows/mobile.yml, mobile/eas.json, mobile/README.md
- Create: docs/mobile/store-listing.md, docs/mobile/privacy-policy-content.md
- Create: mobile/assets/app-icon.png, mobile/assets/adaptive-icon.png, mobile/assets/splash.png
- Create: app/privacidade/page.tsx, app/privacidade/page.test.tsx
- Modify: mobile/package.json, mobile/app.json, workers/pre-cadastro/wrangler.jsonc
- Test: mobile/__tests__/distribution-config.test.ts, app/privacidade/page.test.tsx

**Interfaces:**
- Identificadores iniciais: br.com.kartodromobetim.app para iOS/Android; confirmar disponibilidade nos consoles antes do primeiro build assinado.
- CI em PR/push móvel executa instalação reproduzível, Jest, typecheck, Expo Doctor e export iOS/Android. workflow_dispatch executa builds EAS internos iOS/Android e registra links/IDs de artefato; credenciais permanecem no EAS/secret store.
- Perfis EAS development, preview e production separados. Submit preview envia ao TestFlight e faixa interna do Google Play; nenhum perfil publica em produção.
- A listagem inclui ícone, capturas reais das telas e declarações de dados/permissões. A política pública em /privacidade descreve dados, localização foreground, retenção, exclusão, contato e direitos LGPD; contato e prazos de retenção são confirmados pelo responsável antes da publicação.

- [ ] **Step 1: Escrever distribution-config.test.ts e page.test.tsx** verificando IDs iguais, preview interno, ausência de segredos e conteúdo de privacidade coerente com cadastro, reservas, pagamento e GPS foreground.
- [ ] **Step 2: Rodar o teste e confirmar falha** com npm --prefix mobile test -- --runInBand __tests__/distribution-config.test.ts.
- [ ] **Step 3: Implementar eas.json, workflow e instruções de build**; no workflow_dispatch executar npx eas build --platform all --profile preview --non-interactive e guardar os links/IDs retornados.
- [ ] **Step 4: Verificar configuração, política e builds** com npm --prefix mobile test, npm --prefix mobile run typecheck, npx expo-doctor (em mobile/) e workflow_dispatch; instalar a versão candidata em ao menos um iPhone e um Android e validar cadastro, reserva/pagamento e permissão GPS.
- [ ] **Step 5: Fazer upload apenas aos grupos internos TestFlight/Google Play** após contas de desenvolvedor e credenciais estarem prontas. Publicação aberta permanece bloqueada até aprovação final do responsável.

## Bloqueios de lançamento

- Provedor transacional, `RESEND_API_KEY` e remetente verificado configurados como segredo/variável do Worker antes de ativar verificação/recuperação por e-mail (Task 2).
- Criar bancos D1 distintos de homologação e produção, substituir os UUIDs locais de `wrangler.jsonc` e aplicar migrations antes do código que os usa; somente o D1 local foi alterado neste trabalho (Tasks 2, 4, 5 e 8).
- Geometria de pista/linha de chegada medida e aprovada antes de habilitar GPS no build público (Task 7).
- Sessões e pilotos com customerId correto, permissão do operador e token de publicação configurados antes de mostrar resultados (Task 8).
- Contas Apple Developer e Google Play, IDs de pacote disponíveis, assinatura e ao menos um dispositivo físico de cada plataforma antes do envio interno (Task 10).
- Validação de reserva, cupom, pagamento, publicação e privacidade em homologação antes de qualquer teste de produção; se um teste produtivo for indispensável, usar apenas “TESTE CODEX” e desfazer os registros.

## Referências técnicas

- Criar projeto Expo e Expo Router: https://docs.expo.dev/get-started/create-a-project/
- Permissão foreground e watchPositionAsync: https://docs.expo.dev/versions/latest/sdk/location/
- Envio a TestFlight e faixa interna Google Play: https://docs.expo.dev/submit/testflight/ e https://docs.expo.dev/submit/android/
