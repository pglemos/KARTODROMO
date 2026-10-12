# Especificação — App móvel do Kartódromo Internacional de Betim

- Data: 2026-10-12
- Status: **Rascunho para revisão do usuário**
- Plataformas: iOS e Android
- Decisão técnica aprovada: React Native com TypeScript, em um app separado dos programas internos do kartódromo.

## 1. Objetivo

Criar um app para clientes do Kartódromo Internacional de Betim reservarem baterias, consultarem agenda e cupons, acompanharem resultados oficiais e registrarem treinos pessoais por GPS. Reservas e agenda são o caminho principal; GPS e resultados oficiais são áreas distintas, com fontes e rótulos próprios.

Os apps indicados pelo usuário — MyLapTime, RaceChrono Pro, LapTrophy, Sector Lapper e Kart Hub Experience — servem como referências de categoria e funcionalidades. O app terá identidade, telas, textos e implementação próprios. Não copiará código, marca, conteúdo ou interface do MyLapTime/Sisecom.

## 2. Decisões e limites do primeiro lançamento

- Um app novo em React Native + TypeScript para iOS e Android; não alterar o app interno Android de sorteio.
- Cadastro e login por e-mail ou CPF, com senha de no mínimo 8 caracteres. E-mail verificado será usado para recuperação da conta.
- Reservas, cupons e histórico de resultados exigem conta autenticada. A agenda pode ser consultada sem login.
- Reserva de uma ou mais vagas em uma bateria, com pagamento online pelo fluxo Asaas já existente.
- Cupom de desconto validado pelo servidor no momento da reserva; o app nunca calcula nem determina o preço final.
- Cronometragem GPS básica, iniciada pelo piloto e apresentada como **treino pessoal**. Não altera nem substitui resultado oficial.
- Resultados oficiais somente de sessões publicadas pela operação e vinculados à conta depois de validar a identidade do piloto.
- Primeiro lançamento não inclui vídeo avançado, OBD, GPS externo, comunidade ou suporte a múltiplos kartódromos.

## 3. Experiência do cliente

### 3.1 Início, agenda e reserva

O cadastro pede nome, CPF, e-mail e telefone. O e-mail precisa ser verificado. A conta permite reservar usando os próprios dados, mas a associação com cadastro e resultados antigos é uma validação separada: até concluí-la, o app não exibe histórico anterior. CPF repetido é tratado pelas regras de identidade do servidor, sem criar duplicatas indiscriminadamente nem revelar se o documento existe na base.

1. A tela inicial destaca a próxima reserva, a ação **Reservar bateria** e acessos à agenda, cupons, resultados e GPS.
2. A agenda agrupa as baterias por data e informa horário, nome, vagas disponíveis e preço recebido do servidor. Horários são exibidos em `America/Sao_Paulo` e valores em reais.
3. Para reservar, o cliente entra ou cria conta, seleciona bateria, quantidade de vagas e nomes dos pilotos, se aplicável, e informa a forma de pagamento aceita pelo fluxo online.
4. O cliente pode informar um cupom. A tela mostra a prévia retornada pelo servidor; a reserva repete a validação de forma atômica antes de criar a cobrança.
5. O app apresenta o status da reserva, valor final, prazo de pagamento e instruções Pix ou cartão retornadas pelo Asaas. Repetir uma solicitação após falha de rede não pode criar reserva nem cobrança duplicada.
6. A área **Minhas reservas** lista pedidos da própria conta, com bateria, data, valor, pagamento e estado atual. Detalhes e pagamentos não são acessíveis usando apenas um identificador público.

Estados do fluxo existente que o app deve representar: `novo`, `aguardando_pagamento`, `pago`, `confirmado`, `recusado`, `expirado`, `pago_sem_vaga` e `erro_pagamento`. A interface deve explicar quando a operação precisa de ajuda da recepção, sem declarar uma reserva como confirmada antes da confirmação do servidor.

### 3.2 Cupons

- Um cupom por pedido; cupons não acumulam com outro desconto neste primeiro lançamento.
- O servidor valida se o código está ativo, dentro da validade, elegível para o produto/bateria, dentro dos limites de uso e do pedido mínimo, e aplica o limite máximo de desconto configurado.
- O preço final, desconto e uso do cupom são calculados e registrados no servidor. Dados enviados pelo app nunca são autoridade para preço.
- A prévia não garante o desconto: no envio da reserva o código é validado novamente, de forma transacional, para resolver uso simultâneo ou alteração de disponibilidade.
- O uso fica provisoriamente reservado pelo mesmo prazo do bloqueio da vaga (atualmente 15 minutos, conforme resposta do servidor); é consumido quando o pagamento é confirmado e liberado quando o pedido expira ou é recusado. Em `pago_sem_vaga`, permanece pendente até a operação resolver pagamento/reembolso; uso só é revertido depois que o reembolso for confirmado.
- A equipe continua gerenciando códigos pelas ferramentas internas. A tela do cliente não cria nem altera cupons.

O sistema já tem `dbo.Voucher` e regras internas de validade, produto, limite por cliente, pedido mínimo e teto de desconto. O uso atual está ligado a `dbo.Venda`/`dbo.VoucherUso`; ele não cobre diretamente `dbo.ReservaOnline`. A implementação deverá registrar o resgate online associado à reserva e aplicar atomicamente o ciclo acima. Não se deve registrar uma venda fictícia para representar uma reserva.

### 3.3 Treino GPS pessoal

- O piloto inicia e encerra cada sessão; o app coleta localização somente durante a sessão ativa e enquanto o app está em primeiro plano.
- A cronometragem detecta passagens pela linha de largada/chegada configurada para o traçado e mostra voltas, melhor volta, duração e indicador de qualidade/precisão do GPS.
- Se a precisão for insuficiente ou a sessão for interrompida, o app sinaliza a limitação e não inventa voltas.
- Sessões e pontos GPS ficam no dispositivo neste lançamento. A pessoa pode apagar seus treinos. A tela os identifica como treino pessoal, sem selo, ranking ou exportação que os apresente como tempo oficial.
- A geometria da pista e da linha de cronometragem deve vir de medição/configuração validada pelo kartódromo; não será estimada por coordenadas inventadas.

### 3.4 Resultados oficiais

- O app apresenta somente resultados finais que a operação tenha marcado como publicados, por evento/data e piloto.
- O resumo pode mostrar posição, kart, voltas e melhor volta, com acesso ao resultado completo quando os dados oficiais permitirem.
- GPS pessoal nunca aparece nessa área nem participa de classificação, recordes ou resultados de campeonato.
- Resultados antigos só são vinculados após validação de identidade e associação ao identificador de cliente correto. Não usar correspondência aproximada apenas pelo nome.
- Se a conta não puder ser associada automaticamente com segurança, orientar o cliente a validar os dados com a recepção; não revelar se determinado CPF consta na base.

## 4. Arquitetura e fronteiras de confiança

### App

React Native + TypeScript, com navegação e componentes próprios do produto. Tokens de sessão ficam no Keychain do iOS/Keystore do Android. O app não guarda senha e não acessa banco de dados nem serviços administrativos.

### API móvel

Adicionar rotas versionadas `/api/mobile/v1/*` ao Cloudflare Worker `workers/pre-cadastro`, que já atende agenda, reserva online e Asaas. Guardar contas, vínculos de identidade e sessões revogáveis em um binding D1 dedicado; manter pedidos no R2 existente e a validação operacional no servidor atual. A camada cuida de autenticação de cliente, rate limit, autorização por conta, idempotência e respostas filtradas. O app não chama diretamente SQL Server, Asaas, `/api/office/*`, a API administrativa ou a rede interna.

A senha é armazenada somente como hash adaptativo com salt. Tokens de acesso têm validade curta; renovação e revogação são suportadas. Login, cadastro e recuperação têm limites de tentativa e mensagens que não permitem enumerar contas. Nenhum segredo, senha, token ou CPF completo vai para log.

### Reservas, pagamentos e cupons

Reaproveitar a integração atual: `GET /api/agenda`, `POST /api/reservas`, consulta de pedido, sincronização autenticada com o servidor da operação e cobrança Asaas. Esses endpoints atuais são voltados à reserva pública sem conta e não bastam, sozinhos, para autorizar consulta de histórico de um usuário ou aplicar cupom a uma reserva. A API móvel deve adicionar identidade da conta e vínculo com cliente no pedido e no servidor da operação, mantendo validação de vagas, preço, cupom e estado no servidor autoritativo.

O estado da cobrança continua vindo do fluxo Asaas/servidor; o app recebe apenas instruções necessárias para pagar e o estado filtrado do pedido. O aplicativo não recebe chaves Asaas ou dados de pagamento de outros clientes.

### Resultados

O `GET /api/livetime-snapshot` existente é um snapshot de cronometragem ao vivo, não um arquivo público de resultados oficiais. Depois de encerrar e conferir uma sessão, o cronometrista usa uma ação explícita de publicação; correção ou retirada posterior também fica auditada. Um processo de saída autenticado publica em R2 apenas os campos autorizados. O Worker serve resultados publicados e o histórico do cliente vinculado à conta. A cronometragem em `:4050` permanece interna: nenhum app, Worker ou serviço público conecta diretamente a ela.

## 5. Contratos móveis propostos

Os nomes abaixo são contratos conceituais para a implementação, não rotas existentes:

| Área | Operações mínimas | Regra principal |
|---|---|---|
| Conta | cadastro, login, verificação de e-mail, recuperação, renovar sessão, logout | Login por e-mail ou CPF; senha mínima de 8 caracteres |
| Agenda | consultar agenda e disponibilidade | Leitura pública filtrada; resposta indica atualização |
| Cupom | pré-validar código | Só prévia; validar novamente ao criar a reserva |
| Reserva | criar, listar minhas reservas, consultar detalhe próprio | Autenticação obrigatória, autorização por proprietário e chave de idempotência na criação |
| Resultados | consultar resultados publicados e histórico vinculado à conta | Apenas registros finais publicados; leitura sem mutação |

Erros esperados devem ser traduzidos em mensagens claras: sessão inválida, horário sem vaga, agenda desatualizada, cupom expirado/inelegível/limite atingido, pagamento indisponível, reserva expirada e serviço temporariamente fora do ar. Nenhum erro inclui stack trace, segredo ou dados de outro cliente.

## 6. Privacidade e segurança

- Coletar somente dados necessários para conta, reserva, pagamento, vínculo de resultados e obrigações do kartódromo; exibir política de privacidade e consentimentos pertinentes à LGPD.
- CPF é dado de identificação e deve ser mascarado em telas/logs. Respostas de API retornam apenas o mínimo necessário.
- E-mail precisa ser verificado para recuperação da conta. Vínculo de histórico exige confirmação adicional por dado já verificado ou validação assistida pela equipe.
- O pagamento permanece no Asaas; o app não armazena dados completos de cartão.
- Dados de localização dos treinos permanecem locais e são apagáveis pelo cliente. O uso da localização é explicado antes da permissão do sistema operacional.
- A API aplica autorização por objeto, rate limit, validação de entrada, proteção contra replay/idempotência de cobrança e auditoria de ações relevantes.

## 7. Fora do primeiro lançamento

Cronometragem por GPS externo ou OBD, análise avançada de vídeo, comunidade/chat, feed social, ranking público de tempos GPS, compartilhamento de traçado, múltiplas pistas/estabelecimentos, painel administrativo novo no app, cancelamento ou reembolso self-service sem política operacional aprovada.

## 8. Critérios de aceite

- Uma pessoa consegue criar conta, verificar e-mail e entrar usando e-mail ou CPF; senha menor que 8 caracteres é rejeitada.
- Agenda e disponibilidade exibidas vêm do servidor. A reserva só fica confirmada após confirmação oficial do fluxo de pagamento/operação.
- Retentativa de rede não duplica pedido, cobrança nem resgate de cupom; cliente A não consulta a reserva de cliente B.
- Cupom inválido, vencido, não elegível, fora do limite ou concorrente com outro resgate é recusado no servidor; o desconto e valor final persistidos coincidem com a cobrança.
- A pessoa vê seus próprios pedidos e pagamentos, sem acesso a dados de terceiros.
- Uma sessão GPS identifica voltas e melhor volta quando a precisão permite, permanece marcada como treino pessoal e não é enviada à cronometragem oficial.
- Resultado final só aparece depois de publicação pela operação; vínculo de histórico não depende apenas do nome e não revela a existência de contas/CPFs alheios.
- iOS e Android oferecem os mesmos fluxos principais, com valores em BRL, datas/horários de Brasília e estados compreensíveis quando sem rede.

## 9. Dependências para o plano de implementação

1. Entregar a geometria medida do traçado e da linha de largada/chegada antes de habilitar o cronômetro GPS.
2. Habilitar a ação de publicação e a lista fechada de campos oficiais antes de exibir resultados no app.
3. Usar validação assistida pela recepção quando o cadastro antigo não tiver e-mail/telefone que permita confirmar o vínculo; nenhuma busca apenas pelo nome libera histórico.

Esses itens são pré-condições funcionais para as partes correspondentes; não autorizam expor a cronometragem interna nem alterar as regras operacionais de reservas sem revisão.
