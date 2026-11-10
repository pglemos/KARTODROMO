# Correções da agenda — publicação em 05/11/2026

As correções dos achados A01–A26 foram implementadas e publicadas no backend Ops e no Worker administrativo. A validação de produção confirmou saldo de R$ 23.055 em vez de R$ 27.825, ausência da afirmação falsa de pagamento, bloqueio de novo grupo em horário fechado, ausência de cobrança de sinal zero e descarte de resposta de período antigo.

## Publicação e recuperação

- Ops publicado em **05/11/2026 às 14:31:40**, antes do funcionamento, com fila de impressão vazia. Health confirmado antes e depois. Não houve alteração ou reinício da cronometragem, dos programas Windows ou do telão.
- Backup: `C:\kartodromo-servidor\backups\agenda-20261105-143138`.
- Migration aplicada: `migrations/ops/0017_agenda_pagamento_idempotente.sql`, aditiva, repetível, sem modificar pagamentos existentes. Inclui opções SET exigidas pelo índice filtrado do SQL Server.
- Worker final: **`e078ec00-82d8-4f5d-899b-3a69d5d163d3`**, `kartodromo-admin`. Versão anterior à intervenção: `b9aec06f-a33e-4d3e-b588-139138ab1b87`. As versões intermediárias foram substituídas após ampliar tratamento de falha de rede no movimento e excluir também status fechado do seletor de nova reserva.
- Scripts do navegador: `v=20261105-agenda3`. Quem estiver com uma página antiga aberta deve recarregar antes de registrar recebimento. O backend recusa pagamento sem identificador da tentativa, em vez de arriscar duplicação.
- A publicação provisionou o bucket `kartodromo-comprovantes`, já declarado no arquivo de configuração. Não foram alterados o site público e o Worker de reservas.
- `componentes.css` foi reenviado por diferença de finais de linha; comparado com o corpo da resposta anterior, seu conteúdo normalizado era idêntico. Nenhum layout externo à correção foi refeito.

Arquivos do backend conferidos por SHA-256 após cópia:

| Arquivo | SHA-256 |
|---|---|
|`lib/ops/agenda-financeiro.ts`|`b2595c3f675a38cd6ce3d8c6f5347d0232417d9a7af32b5494c7703143b54764`|
|`lib/ops/office.ts`|`d85621281ec32da08dff6897e59a0b0cb530474d9c95f1a983c2d1afb7647ca1`|
|`lib/ops/grupos.ts`|`b3110598d04fbd69e5d666b3715eaf7567372453d662fade2f4fe2fa2b59ef58`|

## Rastreabilidade dos 26 achados

| Achado | Correção e evidência |
|---|---|
|A01|Saldo agregado no servidor com preço contratado, descontos e pagamentos parciais; sem duplicar os integrantes. API e interface de produção confirmaram R$ 23.055.|
|A02|Pendências cadastrais dizem que vagas estão reservadas e pedem conferir pagamento; produção confirmou ausência da frase “já está paga”.|
|A03|Nova reserva de grupo só em bateria aberta e sem exclusividade, tanto na API quanto nos dois caminhos de interface. Ampliar grupo existente permanece permitido.|
|A04|Limite usa vagas livres mais as pertencentes ao grupo editado, com disponibilidade atual vinda do servidor; teste de navegador com outro grupo ocupando vagas.|
|A05|Cobrança coletiva do sinal só é oferecida se houver saldo do sinal; API rejeita saldo zero antes de acessar Asaas. Verificado no SQL e via API pública.|
|A06|Campo de data sem limite de 14 dias; seletor começa na data escolhida e usa disponibilidade real também às segundas. Teste de navegador para 07/12/2026.|
|A07|Consultas possuem geração e parâmetro capturado; resposta antiga não pinta dados nem libera formulário. Repetido em produção com atraso controlado: título e conteúdo em 19–25/11, sem linhas de 13–14/11.|
|A08|Janela de horário identificada como previsão; não afirma corrida real a partir do relógio. Passado mostra inscritos/horário encerrado. A consulta à corrida real continua na Cronometragem.|
|A09|Grade e gaveta atualizam a cada 30 s; grupo aberto atualiza preservando campos em edição e recebimento digitado. Há botão Atualizar; integração de navegador passou.|
|A10|Falhas de grupos e pendências são exibidas com recuperação; não são convertidas em “sem grupos”. Movimento também informa falha antes de montar seleção incompleta.|
|A11|Falha de carga exibe mensagem e Tentar novamente; remove dados acionáveis de outro período. Teste de recuperação passou.|
|A12|Desfazer restaura status e ambas as flags em um UPDATE atômico, inclusive combinação anterior. Verificado no SQL e API pública.|
|A13|Abrir aplica status aberto e flags de publicação juntas. Verificado no SQL e API pública.|
|A14|Fechada, bloqueada e aberta definem ambas as flags. UPDATE usa OUTPUT INTO, compatível com os gatilhos existentes de produção.|
|A15|Grupo passa a ser indivisível no movimento. Selecionar integrante amplia a seleção com confirmação; API individual recusa integrante de grupo. A movimentação inteira ocorre em uma transação.|
|A16|Movimento de grupo preserva tarifa, produtos, pagamentos e associação do grupo; mudança de serviço/kart incompatível é recusada.|
|A17|Destino passado é rejeitado no servidor; status e exclusividade são conferidos novamente.|
|A18|Preço sem pagamentos/cobranças é sincronizado com inscrições na mesma transação. Com valores já comprometidos, alteração de preço/divisão é recusada para preservar histórico.|
|A19|Chave da tentativa persiste após perda de resposta; banco garante unicidade por grupo. Duas chamadas concorrentes reais resultaram em um recebimento, tanto diretamente quanto pela API pública.|
|A20|Estado e identidade da janela são conferidos após respostas; busca, carga, atualização e desfazer não repintam outro grupo. Teste com fechamento e abertura de outra modal passou.|
|A21|Menor do responsável é preservado no payload e no banco; testes de navegador e SQL passaram. Cadastro legal completo continua sendo exigido no fluxo correspondente.|
|A22|Comparação do movimento usa Brasília, como a agenda, e o servidor valida horário pela referência operacional.|
|A23|API aplica permissões de leitura/alteração nos recursos de agenda/grupos/reservas; perfil de consulta recebeu 403 para bateria e recebimento. Restrições pessoais de fechar também cobrem criar/gerar bateria bloqueada.|
|A24|Inscrição e vínculo de piloto são feitos na mesma transação; falha de gatilho provocada somente para TESTE CODEX não deixou vaga órfã. Nova reserva também cria grupo e inscrições na mesma transação.|
|A25|Avulsas passam a exigir e-mail no mesmo indicador de prontidão cadastral do grupo; lista retorna esse campo.|
|A26|Expectativas antigas de termo e movimento foram reconciliadas com as regras atuais, sem voltar a invalidar termo por troca de produto. Foram adicionadas regressões de saldo, flags, segurança, rede, menor, calendário e concorrência.|

## Verificação executada

- **264 testes aprovados em 23 arquivos**: `npx vitest run tests/ops tests/admin-comprovantes.test.ts tests/admin-patrocinadores.test.ts`.
- **19 verificações no SQL real e 19 pela API pública do admin**: criação, inclusão, menor, preço, sinal, recebimento concorrente, alteração de chave, saldo, proteção de preço pago, capacidade com rollback, movimento inteiro, pagamento integral, estorno integral, estados, consulta sem escrita, falha de vínculo com rollback, estorno e sinal zero.
- Todos os dados dos roteiros foram identificados como TESTE CODEX, em baterias de 2099, e removidos no `finally` pelos IDs desta execução. O roteiro conferiu ausência de resíduos. A tarefa temporária de tentativa de banco separado foi removida; nenhum banco separado foi criado porque os acessos não têm CREATE DATABASE.
- A consulta final dos grupos de hoje em diante retornou zero integrantes fora da bateria do grupo e zero preços pendentes divergentes. Também retornou zero baterias, produtos, responsáveis e usuários restantes dos roteiros.
- Os roteiros não enviaram WhatsApp, não criaram cobrança externa, não imprimiram termos e não criaram corrida. O teste de sinal zero confirma rejeição antes da chamada ao Asaas.
- TypeScript estrito do servidor e roteiro SQL passou; ESLint dos arquivos da agenda, roteiro e testes passou; sintaxe dos scripts, diff-check e empacotamento/publicação do Worker passaram.
- Navegador de produção: saldo, exclusividade, texto de pagamento, sinal zero, atualização e concorrência conferidos; console sem erros. Em largura de 390 px, documento e viewport mediram 390 px e o campo de data apareceu.

A suíte completa também foi executada e **não está integralmente verde**: 1.166 testes passaram, três falharam fora da agenda e quatro foram pulados por uma suíte bloqueada. Falhas: `tests/mobile/ranking-publisher.test.ts` (revalidação de traçado), `tests/design-tokens/tokens.test.ts` (artefatos gerados de cronometragem/desktop fora de sincronia) e `tests/timing-round2-33-items.test.ts` (parada sob amarela). `tests/mobile/results-publication.test.ts` foi bloqueado por `EADDRINUSE :4150`, de um simulador já em uso que não foi interrompido. Essa rodada ocorreu antes de acrescentar as duas últimas regressões de rede e filtragem de status; o escopo da agenda foi reexecutado depois, com os 264 testes aprovados acima.

Duas anotações de tipo em `lib/ops/endurance.ts` foram ajustadas sem alteração de comportamento para permitir o typecheck estrito do servidor. Esse arquivo não foi reenviado ao servidor.

O typecheck e lint globais também têm problemas em testes/código de cronometragem e outros módulos já fora deste escopo. Não foram alterados o FormTV nem os arquivos do telão para mascarar esses resultados. O build relevante desta entrega é o do Worker administrativo, publicado com sucesso. Não foi feito build/publicação do Next institucional.

## Última conferência financeira

Às **14:48 de 05/11**, com dados operacionais já diferentes do retrato inicial, a API e as reservas/grupos de 05 a 07/11 somaram ambas **R$ 24.795**, com **diferença zero**. O valor de R$ 23.055 acima documenta a primeira conferência após a publicação, não congela o saldo da operação. A bateria 394 permaneceu com saldo de R$ 2.175.

## Código e limitações

Código e testes estão no worktree `/Users/pedroguilherme/.codex/worktrees/agenda-auditoria-fixes/KARTODROMO`, branch `main-agenda-auditoria-fixes`, base `ae40173`. O checkout original e os arquivos de outras sessões foram preservados. A integração em `main`/GitHub não faz parte desta publicação direta e não foi executada: **não republicar o admin a partir de uma revisão que não contenha estas correções**.

A revisão final foi feita localmente, seguindo o roteiro de revisão e os agentes AIOX do projeto; não houve revisão independente por agente nativo, proibido pelas regras do repositório. Isso, os testes com respostas controladas e os ensaios reais acima não equivalem a uma garantia matemática de ausência de defeitos.

Não foram certificados neste trabalho impressão física, chegada de cliente no totem, cobrança/liquidação real Asaas, resultado de corrida ou envio de e-mail. Nenhum dado real foi reconciliado, reprecificado ou reembolsado automaticamente. As correções protegem os fluxos e passam a apresentar os valores registrados corretamente.
