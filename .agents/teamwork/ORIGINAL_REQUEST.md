# Original User Request

## Initial Request — 2026-11-02T20:01:29Z

Corrigir as 45 falhas técnicas, vulnerabilidades e erros identificados no aplicativo Kartódromo Operacional (`kartodromo-operacional`), integrando com o backend local (`KARTODROMO`) conforme necessário, e implementar os novos fluxos operacionais de campeonatos, gestão de trocas/quebras de karts com aprovação gerencial e ordens de serviço, validação pela cronometragem e conferência de peso pós-corrida com desclassificação.

Working directory: /Users/pedroguilherme/PROJETOS/kartodromo-operacional
Integrity mode: development

## Verification Resources
- Suíte de testes automatizados do app: executar `npm test` em `/Users/pedroguilherme/PROJETOS/kartodromo-operacional`.
- Ambiente de simulação da cronometragem: simulador local `:4150` em `/Users/pedroguilherme/PROJETOS/KARTODROMO`.

## Requirements

### R1. Correções das 45 Falhas Técnicas e Vulnerabilidades do App Operacional
- Falhas 01 a 07 (Arquitetura, Conexão e Autenticação):
  - Permitir conexão com IPs de rede local privada RFC 1918 em modo Release na validação de `baseSegura`, com fallback seguro e tela amigável quando `EXPO_PUBLIC_API_URL` não for injetada.
  - Implementar renovação automática de token JWT em respostas 401 para métodos de escrita (`postar` e `enviarOperacao`).
  - Gerar e persistir UUID único por dispositivo em SecureStore/AsyncStorage em substituição ao `deviceId` fixo.
  - Ignorar eventos de keep-alive / ping (`event: ping`, `event: heartbeat` e comentários) no cliente SSE, evitando desconexões e loops de reconexão.
  - Tratar mensagens SSE com payloads `data:` de múltiplas linhas conforme a especificação W3C.
  - Adicionar timeout de conexão de 5 segundos para o handshake inicial do SSE no `fetchFluxo`.
- Falhas 08 a 15 (Baterias e Sorteio):
  - Normalizar chave de agrupamento de baterias removendo sufixos de etapa (`-(?:tomada|corrida|treino).*`) para evitar duplicações na listagem.
  - Manter a ordem original dos pilotos na lista durante o sorteio individual no modo "Um a um".
  - Permitir o sorteio de baterias avulsas quando a recepção estiver offline, bloqueando apenas quando a sessão for vinculada à recepção.
  - Preservar a escala sorteada em memória (`previa`) ao receber erro de concorrência 409, atualizando apenas a revisão da sessão (`expectedSessionRevision`) para reenvio rápido.
  - Corrigir a condição de bloqueio do botão de troca individual para permitir troca quando houver karts elegíveis ainda não atribuídos ao piloto atual.
  - Ajustar o rótulo do botão no modo "Um a um" para exibir confirmação adequada quando houver apenas 1 piloto.
  - Validar a existência de pilotos aptos antes de habilitar a ação de sorteio.
  - Exibir indicador de progresso (`ActivityIndicator`) no card do piloto e bloquear ações concorrentes durante sorteio individual.
- Falhas 16 a 22 (Balança e Lastro):
  - Identificar piloto selecionado na balança por ID persistente ou kart atual, evitando desvios por reordenação da lista.
  - Habilitar botões de incremento rápido (+ e -) mesmo quando o piloto não possuir peso prévio registrado, inicializando com a meta da bateria.
  - Tratar incrementos a partir de zero ou nulo para iniciar em valor razoável e previsível.
  - Controlar o estado de foco do campo de digitação de peso para não sobrescrever o valor digitado durante sincronizações em segundo plano (SSE/polling).
  - Obter a meta de peso a partir da configuração da categoria/bateria, eliminando valores fixos de 90 kg e 100 kg.
  - Exibir banner/transição clara de conclusão após a pesagem do último piloto da bateria.
  - Aplicar arredondamento padronizado a 1 casa decimal nos valores calculados de peças de lastro.
- Falhas 23 a 30 (Galpão, Troca de Kart e Frota):
  - Atualizar o status do kart na frota para fora de operação (`fora: true`) com motivo detalhado ao confirmar troca por quebra.
  - Permitir detalhamento de motivos de quebra com opções ampliadas e campo de texto livre.
  - Tratar karts com identificadores alfanuméricos ou sufixos no filtro de frota.
  - Apresentar confirmação de troca de forma não bloqueante (toast/banner), preservando a visibilidade da lista de pilotos.
  - Normalizar numeração de karts para evitar duplicações por zeros à esquerda (ex.: '4' e '04').
  - Garantir idempotência nas ações de oficina utilizando `enviarOperacao` com `operationId`.
  - Padronizar o payload de remoção e retorno de karts na frota (`{ fora: true, reason }` e `{ fora: false }`).
  - Atualizar o resumo de alertas da tela inicial para monitorar todas as baterias agendadas e em preparação.
- Falhas 31 a 38 (Direção de Prova e Passagens):
  - Enviar identificadores de bandeiras padronizados em inglês conforme aceito pela API da cronometragem (`flag: b.api`).
  - Exigir diálogo de confirmação antes de aplicar advertência a pilotos.
  - Permitir a aplicação de penalidades de tempo customizadas além dos valores pré-definidos (5s, 10s, 30s).
  - Tornar o campo de justificativa opcional para largadas normais de baterias.
  - Adicionar proteção com fallback contra arrays nulos ou indefinidos na lista de penalidades.
  - Implementar sincronização periódica ou via eventos em tempo real na tela de passagens da bateria.
  - Implementar validação explícita de tempo no formato `MM:SS.mmm` para registros manuais de passagem.
  - Validar se o kart destino existe na bateria antes de confirmar transferência de passagens.
- Falhas 39 a 45 (Administração, Dono, Usuários e Histórico):
  - Proteger rotas e telas administrativas sensíveis com controle de acesso baseado em papel (RBAC para perfil `GERENCIA`).
  - Ocultar opção de bloqueio de usuário para a própria conta conectada, prevenindo auto-bloqueio acidental.
  - Adicionar campo de confirmação de senha na criação e alteração de credenciais.
  - Expandir filtros da trilha de auditoria para contemplar eventos de lastro e frota.
  - Utilizar lista virtualizada (`FlatList`) paginada na tela de histórico de auditoria.
  - Encerrar a sessão com aviso e redirecionar ao login após a troca da própria senha.
  - Formatar horários de baterias considerando o fuso horário local `America/Sao_Paulo`.

### R2. Gestão de Campeonatos e Lastros Personalizados
- Permitir configuração e seleção de lastros específicos (como 80 kg, 95 kg, 110 kg e outros valores) por campeonato ou categoria.
- Disponibilizar seção/aba dedicada a Campeonatos para visualização e gerenciamento de regulamentos, regras de pontuação, metas de lastro e critérios de advertências/punições.

### R3. Gestão de Trocas de Kart por Quebra ou Desempenho e Fluxo Gerencial
- Na troca por "Kart quebrou", disponibilizar seleção das quebras mais frequentes (embreagem, cabo de acelerador, cabo de freio, corrente, direção, pneu, banco quebrado, falha no motor, falha no sensor) antes da confirmação.
- Na troca por "Kart ruim", exigir seleção do defeito alegado (pouco freio, motor fraco, kart pulando, direção puxando, não vira tempo, embreagem ruim, pneu descalibrado, pneu lonado, pneu muito cheio) antes da confirmação.
- Karts retirados por quebra ou desempenho ficam automaticamente retidos no sistema, indisponíveis para sorteio ou uso no galpão até liberação formal no sistema por um usuário com perfil de gerência.
- Disponibilizar aba gerencial para conferência diária de todas as trocas:
  - Visualização de todas as quebras e trocas do dia.
  - Geração de Ordem de Serviço (O.S.) para a oficina/manutenção com atribuição do mecânico responsável.
  - Ações gerenciais para karts ruins: "testar kart", "ajustar kart", "ir para manutenção" (abertura de O.S. com mecânico) ou "equalizar" (encaminhamento dos dados para a aba de Equalização).

### R4. Validação pela Cronometragem e Alertas em Tempo Real
- A confirmação definitiva de qualquer troca de kart ocorrida no galpão deve ser validada e confirmada pelo operador da cronometragem para sincronização dos tempos e atualização nas abas gerenciais.
- Gerar alertas visuais e sonoros na cronometragem:
  - Quando houver registro de troca de kart no galpão ou na pista aguardando validação.
  - Quando for detectado kart na pista sem registro prévio de troca pelo operador do galpão.

### R5. Verificação de Peso Pós-Corrida Solicitada pela Cronometragem e Desclassificação
- Permitir que o operador da cronometragem solicite conferência de peso de pilotos específicos para o galpão.
- Exibir alerta imediato na balança/galpão com a lista de pilotos convocados para pesagem pós-corrida.
- O operador do galpão realiza a checagem e registra "Peso Ok" ou "Peso NoK".
- Ao registrar "Peso NoK", o sistema deve aplicar desclassificação automática (DSQ) do piloto na bateria, rebaixando-o para a última posição e registrando formalmente o motivo da desclassificação no resultado oficial.

### R6. Rastreabilidade, Auditoria de Operador e Diretrizes de Operação
- Gravar a identificação do operador de galpão responsável por cada registro de troca de kart na trilha de auditoria.
- Seguir as regras de segurança e operação do kartódromo: nunca expor senhas em código ou logs, não alterar telas de TV/painéis (`FormTV` / `--tv`), e realizar validações contra o simulador `:4150` sem afetar a porta `:4050` de produção.

## Acceptance Criteria

### Correções das 45 Falhas
- [ ] O app compila e abre sem exceções em modo Release em dispositivos conectados via IP local privado (RFC 1918), exibindo fallback amigável quando `EXPO_PUBLIC_API_URL` não for informada.
- [ ] Requisições `POST` e chamadas de `enviarOperacao` renovam o token JWT de forma transparente ao receber status 401 antes de falhar a operação.
- [ ] O app gera e persiste UUID de dispositivo único no SecureStore/AsyncStorage em vez de utilizar identificador fixo.
- [ ] O stream SSE ignora mensagens de keep-alive (`ping`, `heartbeat`) sem reconexões espúrias e monta corretamente payloads multi-linha com prefixo `data:`.
- [ ] O sorteio "Um a um" preserva a ordem de exibição dos pilotos, opera normalmente em baterias avulsas quando a recepção não estiver vinculada, e mantém o estado sorteado em memória após erro 409 para reenvio imediato.
- [ ] A balança rastreia o piloto selecionado por identificador único, permite acionamento de botões de incremento mesmo sem peso anterior inicializando na meta da bateria, e preserva o texto digitado durante atualizações de dados em segundo plano.
- [ ] Karts substituídos por quebra têm seu status atualizado para fora de operação na frota com motivo detalhado, e karts alfanuméricos são suportados sem duplicação por formatação de zeros à esquerda.
- [ ] Bandeiras enviam valores aceitos pela API da cronometragem em inglês, advertências exigem confirmação do operador, punições aceitam tempo configurável em segundos e largadas normais não exigem justificativa de texto obrigatória.
- [ ] Telas administrativas bloqueiam acesso a usuários sem permissão de `GERENCIA`, impedem que o administrador bloqueie a própria conta, exigem confirmação de senha em dois campos e a tela de histórico utiliza `FlatList` paginada.
- [ ] Horários de baterias são exibidos no fuso horário `America/Sao_Paulo`.

### Novos Fluxos de Campeonatos, Trocas, Cronometragem e Pesagem
- [ ] Telas e endpoints permitem selecionar e aplicar metas de lastro de 80, 95 e 110 kg por categoria/campeonato, com aba de consulta aos regulamentos e regras de pontuação.
- [ ] A interface de troca de kart exige seleção da quebra específica ou defeito de desempenho ("Kart ruim"), impedindo a conclusão sem preenchimento do motivo.
- [ ] Karts trocados por quebra ou desempenho permanecem bloqueados para novos sorteios até que um usuário com perfil gerencial realize a liberação no sistema.
- [ ] Aba do Gerente apresenta a lista diária de trocas, permite abertura de Ordem de Serviço com mecânico designado e opções de teste, ajuste e equalização.
- [ ] A interface da cronometragem emite alertas de trocas pendentes e karts não autorizados na pista, exigindo confirmação da cronometragem para validação final da troca.
- [ ] Solicitação de pesagem pós-corrida pela cronometragem gera alerta no galpão, e a confirmação de "Peso NoK" aplica desclassificação automática (DSQ) posicionando o piloto em último lugar com o motivo no resultado oficial.
- [ ] A trilha de auditoria registra o usuário/operador que efetuou cada troca de kart no galpão.
- [ ] A suíte de testes automatizados (`npm test`) passa com sucesso e as integrações são validadas no simulador local `:4150`.
