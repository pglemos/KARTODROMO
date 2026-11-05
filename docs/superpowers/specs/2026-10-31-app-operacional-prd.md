# KARTÓDROMO INTERNACIONAL DE BETIM
## App Operacional — PRD, arquitetura, regras de negócio e plano de implantação

**Versão:** 2.0 — revisão técnica da especificação de 31/10/2026  
**Data de referência:** 31/10/2026  
**Status:** **Especificação revisada; não equivale a software implementado ou validado em produção.**  
**Produto:** aplicativo interno Android/iOS, com interface adaptada a tablets e celulares.  
**Sistema a substituir:** SorteioKarts 1.6 (`br.com.kartodromobetim.sorteio`), após migração controlada.  
**Sistemas preservados:** cronometragem Windows, recepção, telões/placares e integrações atuais.

> **Regra inegociável:** o aplicativo novo não cria uma segunda cronometragem e não reinventa fórmulas, histórico de voltas ou penalidades. Ele oferece uma interface segura aos mesmos comandos e à mesma fonte de verdade que já operam no servidor. Toda afirmação sobre código, APK ou produção precisa ser demonstrada na fase de inventário, pois o material recebido para esta revisão contém apenas o documento de especificação.

### Convenções de rastreabilidade

- **[REQUISITO]**: intenção claramente expressa no documento-base.
- **[DESCRITO NO DOCUMENTO-BASE]**: fato técnico afirmado na especificação original, **não revalidado aqui** com acesso ao repositório, APK ou servidor.
- **[RECOMENDAÇÃO]**: decisão de projeto proposta nesta revisão, sujeita a aceite do responsável.
- **[BLOQUEIO]**: condição que deve ser validada ou resolvida antes de habilitar uma funcionalidade em produção.
- **[CRITÉRIO]**: comportamento objetivamente verificável por teste.

---

# 1. Resumo executivo

Construir um **Sistema Operacional de Pista** para uso interno no Kartódromo Internacional de Betim. O app unifica sorteio, elegibilidade, peso/lastro, entrada de atrasados, troca de kart, gestão da frota, direção de prova, operações da cronometragem, equalização, acompanhamento da recepção e gestão/auditoria.

O aplicativo deve funcionar dentro e fora do kartódromo, inclusive por dados móveis, sem depender de descobrir endereços IP. O servidor de cronometragem continua a ser a **única fonte autoritativa** de provas, resultados, voltas, identificação de pilotos e eventos. O app nunca deve anunciar uma ação concluída antes da confirmação autoritativa do servidor.

## 1.1 Objetivos de negócio

1. Evitar sorteios de pilotos não liberados pela recepção.
2. Adicionar pilotos atrasados sem embaralhar ou apagar os sorteios já registrados.
3. Executar trocas de kart e ações da direção de prova com o mesmo efeito do software Windows.
4. Reduzir ligações, recados e reentrada manual de informações entre recepção, galpão, pista e cronometragem.
5. Permitir gestão remota **autenticada, auditável e reversível quando o sistema atual permitir**.
6. Manter a operação segura mesmo quando a conexão do aparelho oscilar.

## 1.2 Não objetivos

- Reescrever o motor da cronometragem, decoder, leitura de transponders, cálculo de tempos ou classificação.
- Substituir o caixa e o sistema de pagamento da recepção na primeira entrega.
- Alterar unilateralmente regras de competições oficiais, classes ou peso mínimo de campeonatos.
- Fazer ações críticas offline com execução automática posterior.
- Expor administração, segredos técnicos ou portas internas diretamente à internet.
- Prometer latência fixa em internet móvel ou continuidade quando a origem ficar indisponível.

## 1.3 Critérios de sucesso

- Nenhum piloto sem liberação autoritativa é gravado via app em uma bateria vinculada à recepção.
- Inclusão de atrasado não altera kart, lastro ou posição dos demais pilotos já confirmados.
- Toda troca, punição, exclusão de passagem e ação de prova é registrada com identidade, instante, sessão, parâmetros, resultado e estado anterior/posterior quando disponível.
- Resultado final e voltas no Windows coincidem com o estado recebido pelo app após cada operação, sem divergência não explicada.
- Falha de rede nunca causa comando crítico silenciosamente reexecutado.
- Publicação e reversão têm procedimento testado e não exigem alterar clientes legados sem planejamento.

---

# 2. Auditoria do documento anterior: problemas e decisões corretivas

| ID | Gravidade | Achado | Correção nesta versão |
|---|---|---|---|
| A01 | CRÍTICA | Perfil Recepção ora aprova, ora apenas consulta | Recepção é **somente leitura no app v1**; aprovação permanece no sistema oficial |
| A02 | CRÍTICA | Edição depois do sorteio não define limite após largada | Máquina de estados com proibições e exceções rastreáveis |
| A03 | CRÍTICA | Operação remota sem matriz de comando/risco | Matriz de capacidades por perfil, risco e estado |
| A04 | CRÍTICA | Timeout tratado como falha definida | Estado **resultado desconhecido** e consulta por `operationId` |
| A05 | CRÍTICA | HTTPS local era opcional, enquanto o login seria obrigatório | API única em HTTPS como padrão; atalho local só com TLS e políticas equivalentes |
| A06 | CRÍTICA | Autorização poderia existir só no Worker | Autorização obrigatória no servidor de origem; Worker é defesa adicional |
| A07 | ALTA | Campo `aprovada` usado sem provar relação com pagamento/termo | Contrato explícito de elegibilidade a validar na integração |
| A08 | ALTA | Sorteio parcial sem trava de capacidade e concorrência | Alocação transacional, versão, unicidade e conflito 409 |
| A09 | ALTA | Trabalho offline podia aplicar rascunho obsoleto | Dados offline são rascunhos; reconfirmação explícita ao voltar |
| A10 | ALTA | Convivência do 1.6 depende só de acordo verbal | Habilitação por bateria/aparelho, trava de operação e plano de corte |
| A11 | ALTA | Proposta de reinício e edição de passagens sem proteção extra | Confirmação reforçada, motivo, versão, diário e ensaio em simulação |
| A12 | ALTA | SSE sem recuperação de eventos e snapshots | Revisões monotônicas, reconciliação e fallback controlado |
| A13 | ALTA | Ajustes do app podem divergir das regras Windows | Inventário de comandos + testes comparativos por cenário |
| A14 | MÉDIA | Meta de latência parecia garantia de rede | SLO com condições de medição e comportamento quando excedido |
| A15 | MÉDIA | Regra Google de 12 testadores tratada como universal | Aplicável apenas a contas pessoais elegíveis e publicação em produção |
| A16 | MÉDIA | Não havia critérios verificáveis por módulo | Histórias, matriz de cenários, gates e aceite por módulo |
| A17 | ALTA | Origem e repositório podem estar diferentes | Inventário somente leitura e baseline da produção antes do desenvolvimento |
| A18 | ALTA | Falta procedimento de emergência e retorno ao legado | Runbook, canário, rollback e documentação de falhas |

**Nota metodológica:** os números de linhas, caminhos e rotas citados a seguir vieram do documento-base. Sua existência, assinatura e semântica só serão consideradas verificadas após leitura do código correspondente.

---

# 3. Situação atual e inventário obrigatório

## 3.1 Sistemas informados no documento-base

- **SorteioKarts 1.6**: aplicativo Android Kotlin/Compose, pacote `br.com.kartodromobetim.sorteio`, endereço configurado de referência `http://192.168.20.249:4050`.
- **Servidor operacional / cronometragem**: rotas informadas `/healthz`, `/api/agenda`, `/api/agenda/:id/preparar`, `/api/sessions`, `/api/sessions/:id/sorteio`, `/api/events`.
- **Servidor e desktop**: referências `services/ops-server.ts`, `services/timing-server.ts`, `desktop/src/Kartodromo.Cronometragem`, `FormCrono.Cadastros.cs`, `FormCrono.Penalidades.cs`.
- **Internet**: domínio informado `crono.kartodromodebetim.com.br`, conjunto de rotas `LEITURA_PELA_INTERNET` e integração com túnel Cloudflare.
- **Equalização**: família informada `/api/equalizacao/*`.
- **Front-end de referência**: app de clientes localizado, segundo o documento, em `PROJETOS/kartodromo-app-ios`, Expo Router e componentes próprios, incluindo `motion.tsx`.

## 3.2 Diagnósticos anteriores que exigem reprodução

- `services/ops-server.ts:1005`: listagem incluiria campo `aprovada`.
- `services/timing-server.ts:3302`: preparação de agenda incluiria inscritos sem filtrar elegibilidade.
- `validarSorteio`: mudança na lista de inscritos resultaria em `ListaMudouError` e HTTP 409.
- `POST /api/sessions/:id/swap-kart`: operação declarada como equivalente à troca do programa Windows.
- A API atual teria operações já implementadas de bandeira, passagens, penalidade e equalização.

Nenhuma dessas hipóteses será tratada como causa definitivamente demonstrada sem reproduzir o problema com uma base de teste ou analisar as implementações em produção.

## 3.3 Checklist do inventário de leitura (sem publicar alterações)

1. Registrar versão, commit, hash do binário, configurações não secretas e mapeamento de serviços na produção (ex.: acesso `ssh orbits`, **se autorizado**).
2. Comparar produção e repositório, identificar diferenças e contratos atuais.
3. Levantar rotas de escrita/leitura, verbos, payloads, retornos, erros, efeitos colaterais e consumidores.
4. Identificar tabelas, transações, integridade, índices, logs, event bus e persistência.
5. Identificar como o Windows implementa **cada** comando e como o servidor o executa.
6. Inspecionar relação entre `aprovada`, `paga`, termo e exceções formais da recepção.
7. Identificar estados reais da bateria, flag de largada, relargada e fechamento.
8. Verificar geração de IDs de participantes, kart, transponder, passagem, sessão, agenda e programa.
9. Verificar se as APIs compartilham lógica de negócio ou a duplicam.
10. Documentar como o SorteioKarts 1.6 escreve e que travas já existem para acesso simultâneo.
11. Confirmar SDK Expo, React Native, dependências, versão do Android/iOS e compatibilidade com dispositivos existentes a partir do `package.json` e lockfile.
12. Identificar backup/restauração e janela segura de deploy.

**Entrega obrigatória:** `INVENTARIO_PRODUCAO.md`, matriz `CONTRATOS_LEGADOS.md`, plano de testes e relatório de diferenças. **[BLOQUEIO]** Nenhuma publicação de comando novo antes de concluir o inventário.

---

# 4. Política de decisões operacionais

As três políticas abaixo são **recomendações fechadas para orientar o desenvolvimento**, mas requerem o aceite expresso do responsável antes de ativar a operação real. Não são decisões retroativamente atribuídas ao dono.

## D01 — Alterações na composição da bateria

**[RECOMENDAÇÃO]** Até a largada, é possível incluir, editar, retirar ou reassociar participantes elegíveis, com versão e auditoria. Após a largada:

1. **Proibida a edição livre do sorteio e a redistribuição geral de karts.**
2. **Permitida a troca de kart**, exclusivamente pelas regras e efeitos do comando da cronometragem existente.
3. **Entrada excepcional de atrasado**: apenas participante elegível, kart livre/seguro, confirmação humana e motivo; não reatribuir os outros e não inventar voltas anteriores. **[BLOQUEIO]** Só habilitar se o motor atual suportar essa entrada corretamente; caso contrário, apresentar opção apenas antes da largada.
4. **Retirada de participante com voltas**: não fazer exclusão destrutiva; usar a desclassificação ou retirada formal **que já exista** no software Windows, preservando resultados, passagens e diário.
5. Alteração de peso/lastro após largada não reescreve resultado; é correção logística auditada, com conferência presencial.
6. Penalidades, bandeiras, passagem manual e demais controles da prova seguem suas próprias permissões, e não se confundem com edição de composição.

## D02 — Operação pode agir remotamente

**[RECOMENDAÇÃO]** Usuários do perfil **Operação** podem executar ações operacionais também em 3G/4G, com o mesmo controle de permissão que teriam no Wi-Fi. A rede não define autorização. Comandos críticos exigem sessão válida, confirmação contextual, revisão atual da bateria, idempotência e trilha de auditoria. Reinício, cancelamento e manipulação de passagens exigem confirmação reforçada, mas **não são reservados automaticamente à Gerência**. Dono/Gerência herda todas as capacidades, além de administração de usuários e auditoria.

**Regra de segurança:** um comando remoto nunca abre acesso anônimo à rota antiga, não transporta chave-mestra no aplicativo e não depende apenas de confiar no Worker.

## D03 — Recepção no app v1 é consulta

**[RECOMENDAÇÃO]** No aplicativo operacional, Recepção apenas lê listas, status de liberação, preparação, sorteio e resultado visível. Aprovação, pagamento, termo e cadastro permanecem **exclusivamente no programa oficial da recepção**. O app não fornece atalho de liberação.

Uma inscrição fica apta ao sorteio somente se a fonte autoritativa indicar liberação efetiva, **com pagamento e termo satisfeitos ou exceções formalmente reconhecidas no sistema oficial**. A equivalência entre `aprovada = 1` e essas condições deve ser comprovada no inventário. Falha de consulta, valor ausente ou status desconhecido é **não elegível**.

---

# 5. Perfis, escopos e segurança de funções

## 5.1 Perfis de usuário

- **Recepção**: consulta; nunca escreve elegibilidade, pagamento, termo ou sorteio.
- **Operação**: cria e corrige sorteios, gerencia galpão, trocas, direção de prova, cronometragem e equalização conforme permissões e estados. Pode atuar remotamente.
- **Dono/Gerência**: visualização global, operações e gestão de acessos, sessões e auditoria.

Cada usuário possui conta individual. Contas compartilhadas são proibidas. Dispositivo pode ser compartilhado apenas com logout/troca de usuário visíveis. Permissões são validadas pelo servidor **em todas as chamadas**, nunca só pelo menu do app.

## 5.2 Matriz de capacidades proposta

| Capacidade | Recepção | Operação | Dono/Gerência | Proteção especial |
|---|:---:|:---:|:---:|---|
| Ver agenda, aprovados e sorteio | Sim | Sim | Sim | Filtrar por escopo autorizado |
| Alterar aprovação, pagamento, termo | Não | Não | Não via app v1 | Exclusivo programa recepção |
| Preparar bateria e sortear | Não | Sim | Sim | Elegibilidade + versão |
| Incluir atrasado | Não | Sim | Sim | Trava de estado e elegibilidade |
| Alterar peso/lastro | Não | Sim | Sim | Revalidar + histórico |
| Trocar kart | Não | Sim | Sim | Confirmar origem/destino |
| Manutenção / frota | Não | Sim | Sim | Motivo e validações de ocupação |
| Advertência / punição / DQ | Não | Sim | Sim | Justificativa/contexto |
| Bandeiras / largar / quadriculada | Não | Sim | Sim | Estado e confirmação |
| Reiniciar / relargar / cancelar | Não | Sim | Sim | Confirmação reforçada |
| Corrigir passagens e resultados | Não | Sim | Sim | Confirmação reforçada + diário |
| Equalização | Não | Sim | Sim | Travar sessão fechada conforme legado |
| Ver auditoria | Limitada à leitura pertinente | Das próprias operações e sessões | Global | Sem exposição de credenciais |
| Criar/bloquear usuários e permissões | Não | Não | Sim | Reautenticação e log |

**[BLOQUEIO]** Se a cronometragem existente não oferecer um comando seguro ou se o operador não possuir competência formal para determinada intervenção, a função permanece oculta ou desativada até regulamentar esse acesso. A matriz é intenção do produto, não prova de permissão atual.

## 5.3 Controles de risco

- **Baixo risco**: consultas e preferências de interface.
- **Médio risco**: rascunhos de sorteio, ajustes de peso antes da largada e manutenção fora da bateria.
- **Alto risco**: gravar sorteio, entrada tardia, trocar kart, punição e alteração de bandeira.
- **Crítico**: largada, cancelamento, reinício, relargada, manipulação de passagens ou resultado final.

Para risco alto: confirmar a ação exibindo bateria, piloto, kart e consequência. Para risco crítico: confirmar reforçadamente, exigir motivo/registro e bloquear repetição enquanto houver resposta desconhecida. Para ações irreversíveis, aplicar a semântica real do sistema Windows, sem prometer desfazer o que não pode ser revertido.

---

# 6. Máquina de estados da bateria

A máquina abaixo é uma **camada de políticas do app** a mapear para os estados reais do servidor. Não determina alteração automática dos estados usados pela cronometragem.

| Estado do app | Descrição | Composição / sorteio | Prova / resultados |
|---|---|---|---|
| `AGENDADA` | Bateria na agenda, não preparada | Consultar, verificar elegibilidade | Não largar |
| `PREPARADA` | Sessão materializada | Adicionar aptos, pesar, sortear | Não largar sem pré-condições |
| `SORTEIO_RASCUNHO` | Montagem ainda não gravada | Editar, recalcular, descartar | Não modificar resultado |
| `SORTEIO_CONFIRMADO` | Escala gravada | Ajustar com versão e auditoria | Aguardar liberação |
| `PRONTA` | Conferência operacional concluída | Ajuste antes da largada com nova conferência | Pode iniciar pelas regras existentes |
| `EM_ANDAMENTO` | Prova iniciou | **Sem refazer sorteio**; troca e atrasado excepcional | Penalidade, bandeira e comandos admitidos |
| `QUADRICULADA` | Encerramento sinalizado | Não incluir novos participantes | Concluir tratamentos permitidos |
| `ENCERRADA` | Resultado encerrado | Bloqueada | Consulta; alteração só se houver procedimento formal de reabertura no legado |
| `CANCELADA` | Bateria cancelada | Bloqueada | Consulta/auditoria |

**Bandeira vermelha, suspensão temporária e safety procedures** são atributos/eventos distintos, salvo evidência de que o servidor já os modela como estados. Nunca inferir início/fim apenas pelo horário agendado.

## 6.1 Regras universais das transições

- Toda mudança exige versão atual da sessão e transição suportada pelo backend.
- Confirmar novamente a elegibilidade no **momento de gravar**, não só quando abrir a tela.
- `ENCERRADA` e `CANCELADA` são imutáveis pelo fluxo ordinário.
- Reinício/relargada jamais executam duas vezes por toque repetido.
- Comando recebido fora do estado permitido retorna `409 STATE_CONFLICT` com estado autoritativo.
- O cliente reconcilia e mostra novo estado, sem presumir que seu estado local está correto.
- Em caso de divergência entre a máquina do app e o servidor Windows, bloquear a operação e usar o estado do servidor como referência até revisar o mapeamento.

---

# 7. Elegibilidade, recepção e sorteio

## 7.1 Fonte da verdade de aprovação

Modelo lógico de elegibilidade:

```text
bateria.vinculada_recepcao = true
  e inscricao.existe = true
  e inscricao.nao_cancelada = true
  e recepcao.liberação_autoritativa = true
  e obrigacoes_de_pagamento_e_termo_atendidas_no_sistema_oficial = true
  => ELEGIVEL
caso contrário => INELEGIVEL ou INDETERMINADA (bloqueado)
```

Se a fonte oficial demonstrar que `aprovada=1` é **a marca final que já incorpora** pagamento e termo/exceções, a API do app pode usar essa marca com testes de regressão. Caso contrário, consultar as condições separadas ou uma nova projeção **somente leitura** da recepção. **Nunca concluir que `aprovada` implica `paga` e `termo` por suposição.**

Para bateria criada diretamente no Windows e **não vinculada à recepção**, não inventar aprovação; exibir etiqueta “Bateria sem vínculo com recepção” e seguir as regras originais do sistema de cronometragem. Não aplicar o filtro de forma global e indiscriminada às rotas legadas.

## 7.2 Sorteio inicial

1. Operador abre bateria e visualiza disponibilidade real da frota, inscritos aptos e pendências.
2. Seleciona categoria/frota conforme regra atual da sessão: Light (identificação 1–99, meta informada 90 kg) ou Super (100+, meta informada 100 kg). **[BLOQUEIO]** Confirmar no código e configuração se essas faixas e metas são fixas ou parametrizadas; não confundir com peso mínimo de regulamentos de eventos.
3. Verifica peso informado (intervalo citado 20–250 kg), limites e opções de lastro (peças de 5 kg e 2,5 kg). Cálculo deve reutilizar a regra de negócio existente.
4. Identifica karts indisponíveis/manutenção e histórico de karts já utilizados pelo piloto no programa/evento.
5. Permite sorteio integral, um a um com aceitar/recusar, modo fiscal e apresentações agrupadas por kart/nome, **desde que correspondam às regras do legado**.
6. Mostra conferência com piloto, kart, peso, lastro e pendências.
7. Ao gravar, servidor verifica `sessionRevision`, elegibilidade atual e conflitos de kart/piloto; só então aplica em transação.
8. Retorna ID da operação, versão e estado persistido. Cliente exibe sucesso apenas depois dessa confirmação.

**Invariantes:** um piloto ativo por alocação válida; um kart não pode ser alocado simultaneamente para dois pilotos na mesma bateria salvo modelo explícito de dupla ocupação já aceito pelo legado; o sorteio nunca aloca kart em manutenção ou indisponível.

## 7.3 Atrasados antes da largada

- Após aprovação oficial, o app recebe um aviso discreto, por exemplo “3 pilotos liberados aguardando kart”.
- A lista de atrasados resulta da diferença entre **elegíveis atuais** e **alocados confirmados**, e não de cache ou notificação duplicada.
- Operador escolhe **sortear apenas os novos**, utilizando karts disponíveis, ou **atribuir manualmente** kart válido.
- A transação preserva todos os vínculos previamente gravados; se não houver kart livre, bloquear e apresentar motivos.
- Se a elegibilidade mudar durante o fluxo, devolver conflito e recarregar; nunca gravar liberação presumida.

## 7.4 Atrasados depois da largada

**Fluxo excepcional [RECOMENDAÇÃO, condicionado à compatibilidade do legado]:**

1. Detectar novo participante elegível sem alocação.
2. Exibir **BATERIA EM ANDAMENTO**, voltas/transponders em uso e riscos.
3. Operador selecionar kart livre e conferir fisicamente piloto, transponder, lastro e autorização para entrada na pista.
4. Confirmação explícita: “Entrar durante a corrida. Voltas anteriores não serão atribuídas automaticamente.”
5. Servidor valida transição, versão, disponibilidade e elegibilidade; executa operação de cadastro em corrida **já suportada pelo mecanismo existente**.
6. Persistir hora, posição inicial, eventuais condições do regulamento, usuário e motivo.
7. Atualizar cronometragem/placar e mostrar o resultado autoritativo.

**[BLOQUEIO]** Se não existir suporte seguro no Windows/backend para inclusão durante corrida, manter esse botão desabilitado com motivo. Não fabricar integração que altere resultados para cumprir requisito de interface.

## 7.5 Cancelamento ou revogação de aprovação

- Antes da largada: aviso ao operador; remanejamento/removal formal conforme regras; não remover automaticamente sem registro.
- Após a largada sem voltas: operação condicionada ao procedimento aceito pelo legado; preservar diário.
- Após a largada **com voltas**: não excluir participante e passagens; usar classificação formal/desclassificação/retirada suportada e registrar causa.
- Caso de status desconhecido: bloqueio de novas alocações e aviso para a recepção resolver no sistema oficial.

## 7.6 Peso e lastro

- Mostrar peso declarado/medido, meta, lastro recomendado, peças disponíveis e resultado final.
- Diferenciar “recomendação calculada” de “lastro instalado/conferido”.
- Registro de conferência deve conter operador, instante, peso usado e status da verificação.
- Impedir peso fora das faixas aceitas pelo sistema e números inválidos (`NaN`, negativos, vazios, separadores ambíguos).
- Não aceitar cálculo offline como confirmação de pesagem; ao reconectar, revalidar meta, categoria e versão.

---

# 8. Troca de kart

Reproduzir a semântica efetiva de `TrocarKart` (referência original `FormCrono.Cadastros.cs:327`) e `POST /api/sessions/:id/swap-kart`, **após inventário**.

## 8.1 Fluxo operacional

1. Escolher bateria e piloto, visualizar kart atual, identificação/transponder, voltas e melhor volta.
2. Selecionar kart substituto, mostrar situação de oficina, disponibilidade, lastro a conferir e possíveis passagens já registradas em nome genérico (“Kart 12” no exemplo anterior).
3. Apresentar opções de tratamento de voltas **exatamente como o legado**: preservar/ignorar, com valor padrão condicionado ao modo real (inclusive eventual regra Tabajara).
4. Mostrar resumo dos efeitos sobre classificações, passagens e outras baterias do mesmo programa, quando aplicável.
5. Confirmar com `expectedOldKart`, `newKart`, `sessionRevision`, modo de voltas e motivo.
6. Receber resultado, versão, diferenças e ID do evento de auditoria `kart-swap`.
7. Atualizar todas as telas por snapshot/eventos.

## 8.2 Impedimentos

- Kart destino em manutenção, ocupado ou incompatível com categoria: bloquear, salvo exceção já permitida formalmente pela cronometragem e expressamente sinalizada.
- Piloto não corresponde mais ao kart antigo: `409 STALE_ASSIGNMENT`.
- Comando ainda com resultado desconhecido: não repetir como nova operação.
- Bateria encerrada/cancelada: bloquear fluxo normal.
- Se a troca alterar passagens de outras baterias, mostrar isso **antes** de confirmar, se o mecanismo atual oferecer essa informação.

---

# 9. Direção de prova e cronometragem

## 9.1 Ações de direção

- Advertência preta/branca, com participante/kart, curva, volta, motivo e identificação do diretor.
- Penalidade de tempo com unidade, valor, motivo e critérios reais do servidor; permitir múltiplas quando o legado permitir.
- Remoção/retificação de penalidade apenas se suportada e com histórico de quem fez.
- Bandeira preta/desclassificação; bandeiras por piloto e gerais, respeitando o protocolo do sistema atual.
- Bandeira verde, amarela, vermelha, branca, quadriculada, relargada e reinício segundo comandos já existentes, sem inventar fluxo.
- Observações e incidentes vinculados à bateria e, quando possível, à volta.

**Ponto sensível:** enviar duas penalidades idênticas intencionalmente é diferente de repetir o mesmo comando após timeout. A identificação da operação, não o texto/valor, determina duplicidade.

## 9.2 Controle da sessão

Exibir, conforme suportado: iniciar/largar, sinalizar quadriculada, encerrar, cancelar, editar informações permitidas, acompanhar voltas e resultados. Botões críticos exibem contexto e exigem confirmação reforçada. Um clique não provoca mudança visual enganosa antes da confirmação.

## 9.3 Passagens e resultados

Cobertura desejada **por paridade, e não por cópia do motor**:

- incluir passagem manual;
- excluir, invalidar, validar e restaurar passagem;
- atribuir passagem ao competidor;
- aplicar ajustes subsequentes associados ao kart, se suportados;
- tratar leitura ignorada;
- incluir/remover volta e ajustar posição pelos comandos oficiais;
- consultar e, quando permitido, corrigir cadastro/transponder do competidor;
- remontar pelo diário;
- acompanhar e enviar resultado pelos canais já configurados.

Para cada comando, documentar: ID da passagem, origem, sessão, evento, relógio autoritativo, consequências, reversibilidade, usuário, motivo e comparação antes/depois. **Nunca excluir definitivamente o diário bruto para “limpar” a tela.**

## 9.4 Manutenção de paridade

| Domínio | Autoridade | App pode fazer | App não pode fazer |
|---|---|---|---|
| Tempos e classificação | Motor existente | Consultar e acionar operações existentes | Recalcular independentemente |
| Passagens | Diário e funções existentes | Enviar edição auditada suportada | Alterar banco bruto por fora |
| Penalidades | Regras atuais do servidor | Criar/retificar pelas mesmas funções | Inventar fórmula distinta |
| Transponder | Cadastro/decoder atual | Mostrar e ajustar se comando disponível | Configurar hardware do decoder |
| Telão/placar | Integração atual | Consumir resultados | Fazer escrita paralela inconsistente |
| E-mail de resultados | Infra atual | Solicitar envio permitido | Introduzir SMTP alternativo no app |

**Fora do app v1:** decoder, parâmetros de hardware, painel físico LED, configurações globais, backup, SMTP e suporte remoto do Windows.

---

# 10. Frota, manutenção e equalização

## 10.1 Estados de kart

Disponível, reservado/alocado, em uso, manutenção e indisponível por decisão de operação. Esses estados devem ser **mapeados para o cadastro real**, evitando duas fontes de verdade. Toda alteração pede motivo e usuário.

Se um kart entrar em manutenção após sorteado, emitir alerta ao galpão e à direção, sem trocar automaticamente. Oferecer substituição pela operação oficial, com revalidação do lastro e conferência do veículo. Não permitir finalizar manutenção se houver impeditivo definido pelo mecanismo existente.

## 10.2 Equalização

Fluxos previstos, sujeitos a auditoria de rotas `/api/equalizacao/*`: criar sessão, editar parâmetros, atribuir blocos por kart, registrar redutor, registrar ação da oficina, importar, finalizar, reabrir, mostrar metas/regras, comparar desempenho, ranking por kart e peso.

Exigir revisão para concorrência e rastreio de importação. Dados de equalização não podem reescrever automaticamente classificação de provas. A UI deve separar equalização técnica de resultado de competição.

## 10.3 Indicadores

- karts disponíveis, em corrida, em manutenção e indisponíveis;
- horas/uso e reincidência de manutenção **apenas se os dados existirem**;
- desempenho e ranking por critérios já calculados pelo sistema;
- pendências de conferência de lastro e trocas executadas.

---

# 11. Telas e experiência do usuário

## 11.1 Mapa de navegação por perfil

```text
Login / Identificação de usuário
├── Operação
│   ├── Painel da pista (bateria ativa, alertas, conexão)
│   ├── Agenda e baterias
│   │   ├── Pilotos aptos e pendentes
│   │   ├── Sorteio / conferir / confirmar
│   │   ├── Atrasados / inclusão excepcional
│   │   └── Lastro / conferência física
│   ├── Galpão e frota
│   │   ├── Grade de karts
│   │   ├── Troca de kart
│   │   └── Manutenção
│   ├── Direção de prova
│   │   ├── Bandeiras e penalidades
│   │   ├── Comandos da sessão
│   │   └── Diário e passagens (interface avançada)
│   ├── Equalização
│   └── Histórico operacional
├── Recepção
│   ├── Agenda e status dos pilotos
│   ├── Sorteio/lastro em consulta
│   └── Status da bateria
└── Dono/Gerência
    ├── Visão de todas as operações
    ├── Mesmos módulos da Operação
    ├── Usuários e sessões
    └── Auditoria, incidentes e saúde do sistema
```

## 11.2 Direção visual

- Identidade verde/preto/grafite do Kartódromo Internacional de Betim, com referências visuais do app de clientes, sem copiar a experiência de compra para um painel industrial.
- Tablet primeiro, modo paisagem/vertical conforme módulo, com adaptação real a celular; não ampliar tela mobile mecanicamente.
- Priorizar legibilidade em luz solar, números grandes, alto contraste e controles com alvo de toque confortável, especialmente no galpão.
- Cor + texto + ícone sempre que indicar estado (não depender apenas de vermelho/verde).
- Animações no sorteio e em confirmações apenas quando não interferirem na segurança nem em ações imediatas; respeitar “reduzir movimento”.
- Prevenir toques acidentais: ações críticas visualmente separadas de controles de consulta, com área de confirmação.
- Exibir referência temporal “Atualizado há X s” e estado de sincronismo.

## 11.3 Componentes essenciais

1. **Barra de conectividade:** `Local seguro`, `Internet segura`, `Reconectando`, `Sem conexão`, `Dados desatualizados`.
2. **Cartão da bateria ativa:** estado, nome, categoria, pilotos confirmados, início, último evento e botão de detalhes.
3. **Grade de karts:** posição, número, disponibilidade, piloto, troca e lastro, com seletor rápido.
4. **Chamada de pilotos:** modo individual, recusa/aceite permitido, sequência e histórico.
5. **Aviso de atrasados:** contador e ação sem substituir o contexto do operador.
6. **Painel do diretor:** controles priorizados, bandeiras, incidentes, penalidades e revisão atual.
7. **Histórico por operação:** quem, o quê, quando, motivo, situação e versão.
8. **Estado incerto:** aviso claro de que o comando pode ter sido aplicado e está sendo verificado.

## 11.4 Estados obrigatórios de toda tela crítica

- Carregando, vazio, sincronizado, editando, aguardando confirmação, aplicado, bloqueado, conflito de versão, sem permissão, desconectado, resultado desconhecido e erro recuperável.
- Sempre apresentar **efeito real** em vez de apenas animação de sucesso.
- Não mostrar “Aplicado” por atualização otimista de interface.
- Após retomar o app do segundo plano, consultar estado atual antes de habilitar botões de escrita.

---

# 12. Arquitetura proposta

## 12.1 Princípio

Um único serviço de comando autoritativo reutiliza as **funções reais** da cronometragem, mantendo contratos legados. O novo aplicativo usa um namespace próprio autenticado. A camada Cloudflare faz publicação e proteção adicional, não substitui controles do servidor de origem.

```text
          [App Android / iOS - Expo / React Native]
                  |              |
                HTTPS          HTTPS
                  |              |
        [Gateway externo]   [Gateway local com TLS]
        [Cloudflare Worker]        |
                  |                |
        [Túnel/Access]             |
                  +--------+-------+
                           |
              [API app/v1 autenticada]
              [Autorização + validação]
              [Idempotência + auditoria]
              [Controle de concorrência]
                           |
        [Adaptadores das funções de negócio atuais]
                           |
         [Servidor cronometragem + dados atuais]
                           |
           [Windows / Recepção / Telões]
```

A decisão exata de embutir rotas em processo existente ou instalar serviço adjacente depende do inventário. **Nunca criar um segundo banco independente para resultados de prova.** A auditoria do novo app pode usar armazenamento separado, desde que vinculado atomicamente ao resultado da operação ou por outbox confiável.

## 12.2 Caminhos local e externo

- **Padrão recomendado:** mesma origem HTTPS segura para todos os aparelhos. Reduz divergência de autenticação, política e certificados.
- **Otimização local opcional:** gateway HTTPS interno descoberto por configuração segura, com certificado válido, **mesmas credenciais e mesma autorização na origem**. Não enviar tokens de usuário via HTTP puro ao IP `:4050`.
- Worker valida parâmetros de entrada e limites, mas a API de origem **também** autentica e autoriza o usuário e seu perfil.
- Credenciais de serviço entre Cloudflare e origem ficam **somente** no servidor/ambiente seguro, nunca distribuídas dentro do APK/IPA.
- O túnel deve expor apenas endpoints necessários; proteger rotas internas e evitar endpoint de escrita legado publicamente acessível.
- A disponibilidade de dois links de internet aumenta resiliência, mas **não elimina** falhas de DNS, roteador, energia, Cloudflare, túnel, origem ou dependência única. Prever modo degradado.

## 12.3 Fluxo de um comando

1. App lê sessão e versão da bateria (`sessionRevision`).
2. Usuário confirma ação.
3. App cria `operationId`/`Idempotency-Key` único, persiste estado **pendente de resposta**, e envia por HTTPS com token.
4. API verifica usuário, permissão, revogação, estado, versão, entradas e pré-condições; registra operação com trava idempotente.
5. Adaptador chama o **mesmo mecanismo** do Windows; comita alteração e resultado, incluindo auditoria/outbox quando possível.
6. API devolve confirmação estruturada e nova versão.
7. Evento tempo real notifica todos os aparelhos; app reconcilia com snapshot, se necessário.
8. Se conexão cair depois do envio, app consulta `GET /operations/:id` antes de permitir retry; reenvio usa **o mesmo** identificador e payload.

## 12.4 Concorrência e atomicidade

- Use **controle otimista** por revisão mais checagem autoritativa de entidades relevantes. Não basta comparar `kartAntes` sem proteger alocação simultânea.
- Sorteio/entrada tardia exigem unicidade e transação para não reservar o mesmo kart em duas operações concorrentes.
- A operação aplicada e sua auditoria não podem ficar em estados divergentes após queda de processo. Usar transação ou outbox persistente conforme a infraestrutura real.
- Se o sistema existente não fornece atomicidade suficiente, criar adaptador serializado por bateria sem mudar o contrato das rotas antigas; registrar a limitação e testar usuários mistos.
- Eventual atualização feita pelo Windows precisa incrementar ou invalidar a revisão observada pelo app; caso contrário, detectar inconsistência comparando snapshot antes de escrever.

---

# 13. Contratos de API propostos (não confundir com rotas já existentes)

**Prefixo proposto:** `/api/app/v1`. Os caminhos abaixo são um contrato **a implementar**, sujeitos à comparação com o backend atual. Não indicam que essas rotas já existam.

| Verbo | Caminho proposto | Uso | Perfil |
|---|---|---|---|
| POST | `/auth/login` | Entrar | Todos |
| POST | `/auth/refresh` | Renovar sessão | Todos |
| POST | `/auth/logout` | Encerrar/revogar sessão | Todos |
| GET | `/me` | Perfil e capacidades | Todos |
| GET | `/sessions` | Listar baterias | Todos, escopo |
| GET | `/sessions/{id}` | Snapshot completo/revisão | Todos, escopo |
| GET | `/sessions/{id}/eligible-participants` | Elegíveis + bloqueios | Todos, leitura |
| POST | `/sessions/{id}/prepare` | Preparar bateria | Operação/Gerência |
| POST | `/sessions/{id}/draw` | Gravar sorteio inicial | Operação/Gerência |
| POST | `/sessions/{id}/late-assignments` | Incluir atrasado | Operação/Gerência |
| POST | `/sessions/{id}/weight-checks` | Conferir peso/lastro | Operação/Gerência |
| POST | `/sessions/{id}/kart-swaps` | Trocar kart | Operação/Gerência |
| POST | `/sessions/{id}/penalties` | Advertir/penalizar | Operação/Gerência |
| POST | `/sessions/{id}/flags` | Bandeiras | Operação/Gerência |
| POST | `/sessions/{id}/commands` | Largar/encerrar/reiniciar/etc. | Operação/Gerência |
| POST | `/sessions/{id}/passage-corrections` | Corrigir passagens | Operação/Gerência |
| GET | `/fleet` | Disponibilidade e manutenção | Operação/Gerência |
| POST | `/fleet/{kartId}/maintenance` | Registrar manutenção | Operação/Gerência |
| GET | `/equalization` | Listar equalização | Operação/Gerência |
| POST | `/equalization/commands` | Comando de equalização | Operação/Gerência |
| GET | `/operations/{operationId}` | Determinar resultado conhecido/pendente | Emissor/Gerência |
| GET | `/events` | Fluxo ao vivo | Todos, escopo |
| GET | `/audit` | Consultar trilha | Conforme perfil |
| GET/POST | `/users` | Gestão de usuários | Gerência |

## 13.1 Envelope mínimo de comando

```json
{
  "operationId": "uuid-gerado-pelo-app",
  "sessionId": "id-da-bateria",
  "expectedSessionRevision": 148,
  "command": "swap-kart",
  "payload": {
    "participantId": "piloto-123",
    "expectedKartId": "kart-12",
    "targetKartId": "kart-21",
    "lapPolicy": "PRESERVE"
  },
  "reason": "Falha mecânica constatada no galpão"
}
```

**Requisitos:** `operationId` único por intenção; mesmo ID com payload divergente retorna conflito; UTC para auditoria, relógio do servidor autoritativo; horário local exibido apenas como apresentação; identificação de dispositivo como metadado, nunca substituindo autenticação.

## 13.2 Exemplo de resposta de sucesso

```json
{
  "operationId": "uuid-gerado-pelo-app",
  "status": "APPLIED",
  "sessionId": "id-da-bateria",
  "sessionRevision": 149,
  "appliedAt": "2026-10-31T23:05:00Z",
  "result": {
    "eventType": "kart-swap",
    "participantId": "piloto-123",
    "oldKartId": "kart-12",
    "newKartId": "kart-21"
  }
}
```

## 13.3 Semântica de erros

| HTTP | Código da aplicação | O que o app deve fazer |
|---|---|---|
| 400 | `INVALID_REQUEST` | Corrigir campos sem gravar |
| 401 | `UNAUTHENTICATED` | Renovar sessão de modo seguro ou pedir login |
| 403 | `FORBIDDEN` | Não oferecer execução alternativa |
| 404 | `NOT_FOUND` | Atualizar navegação, não inventar entidade |
| 409 | `REVISION_CONFLICT`/`STATE_CONFLICT`/`STALE_ASSIGNMENT` | Buscar snapshot e solicitar nova revisão humana |
| 409 | `IDEMPOTENCY_PAYLOAD_MISMATCH` | Bloquear reuso indevido do ID |
| 422 | `INELIGIBLE`/`KART_UNAVAILABLE`/`UNSUPPORTED_TRANSITION` | Exibir motivo e passos permitidos |
| 423 | `SESSION_LOCKED` | Mostrar bloqueio de operação em curso |
| 429 | `RATE_LIMITED` | Respeitar retry-after; evitar repetição de comando |
| 500/503 | `SERVER_ERROR`/`UNAVAILABLE` | Consultar operação antes de enviar de novo |
| Timeout | `UNKNOWN_OUTCOME` no cliente | Consultar operação pelo ID; não afirmar que falhou |

## 13.4 Garantia de idempotência

- A API mantém `operationId`, hash canônico do payload, status, resposta e identidade do emissor em armazenamento durável pelo período de retenção operacional definido.
- Repetir a mesma operação retorna o mesmo resultado lógico, sem aplicar novamente o efeito.
- Duplicidade de toques é bloqueada no app, mas **o servidor deve garantir idempotência sozinho**.
- Para comandos existentes que não suportam idempotência, o adaptador deve estabelecer mecanismo seguro de deduplicação **antes** de exposição ao app.

---

# 14. Atualização em tempo real e operação offline

## 14.1 Tempo real

- Preferir consumir o SSE existente se o dispositivo e a infraestrutura confirmarem compatibilidade; adotar cliente nativo compatível ou WebSocket **somente se necessário**.
- Evento inclui `eventId`, `sessionId`, `revision`, `kind`, `occurredAt` e mudanças relevantes.
- Na reconexão, usar cursor/revisão para recuperar eventos; se houver lacuna, obter snapshot integral.
- Priorizar a consistência acima da fluidez visual: qualquer diferença de revisão ou checksum faz recarregar.
- Não confiar em recebimento “exactly once” por SSE; UI deve tolerar duplicatas e eventos fora de ordem.
- Heartbeat e supervisão de conexão; fallback para consulta temporária quando stream indisponível, com intervalo definido por risco e capacidade do servidor.

## 14.2 Estados de conectividade

- `LOCAL_SEGURO`: gateway local em TLS e sessão autenticada.
- `INTERNET_SEGURA`: gateway remoto autenticado.
- `RECONECTANDO`: stream caiu, comandos críticos bloqueados até sincronizar.
- `SOMENTE_LEITURA_DESATUALIZADA`: snapshot antigo visível com aviso; não operar a prova.
- `SEM_CONEXÃO`: somente consulta a dados explicitamente marcados como cache e edição de rascunho local.

## 14.3 Dados offline admitidos

- Permitir anotação de pesos e rascunho de escala **sem aplicar** nada no sistema oficial.
- Rascunho contém carimbo da revisão de origem, usuário, instante e prazo de validade; dados sensíveis ficam protegidos no aparelho.
- Quando recuperar a rede: recalcular diferenças, revalidar elegibilidade, frota e estado; exibir tela de revisão para **reenvio manual**.
- Se a largada ocorreu enquanto offline, proibir gravar sorteio antigo ou ajuste que não seja permitido em corrida.
- Nunca enfileirar automaticamente punição, bandeira, relargada, troca, passagem ou comando que possa influenciar prova.

## 14.4 Conexão cai durante envio

1. Manter operação com status **“Confirmação pendente”**, não “Não aplicado”.
2. Consultar pelo `operationId` quando possível.
3. Se o servidor reportar `APPLIED`, atualizar o estado.
4. Se reportar `REJECTED`, mostrar motivo.
5. Se reportar `PENDING`, bloquear nova emissão da mesma intenção e acompanhar.
6. Se não houver prova do resultado, mostrar **“Resultado desconhecido; confira a cronometragem”** e restringir ações concorrentes, com procedimento de reconciliação operacional.

---

# 15. Identidade, autorização, auditoria e proteção de dados

## 15.1 Autenticação

- Login individual; senha armazenada no servidor com hash apropriado, nunca texto claro.
- Access token de curta duração, refresh token com rotação e revogação; durações exatas configuráveis após avaliação da infraestrutura.
- Armazenar credenciais de sessão apenas em armazenamento seguro nativo compatível com o projeto Expo; não colocar segredos em `AsyncStorage`, URLs, analytics ou logs.
- Encerramento forçado e bloqueio de usuário devem impedir novos comandos rapidamente em todos os caminhos.
- Rate limiting por identidade, IP/dispositivo e anomalias, sem bloquear toda a pista por abuso de uma única conta.
- Sessões em aparelho compartilhado encerram ou expiram automaticamente em inatividade conforme política definida.

## 15.2 Autorização e rede

- Autorização **na API de origem** por identidade, perfil, sessão e comando; o Worker acrescenta proteção de perímetro e observabilidade.
- Nunca embutir service token Cloudflare, chave do túnel, senha de banco ou segredo do servidor no app distribuído.
- Bloquear acesso direto da internet às rotas legadas de escrita.
- Local seguro também exige HTTPS e login; se não houver gateway TLS pronto, usar o gateway HTTPS remoto como caminho único temporário.
- Aplicar escopo mínimo de rede: hosts internos não devem aceitar escrita de dispositivos não confiáveis fora de rotas aprovadas.
- Admin de usuários exige proteção adicional, rastreamento e possibilidade de revogação.

## 15.3 Auditoria imutável para uso operacional

Campos recomendados: `auditId`, `operationId`, `actorUserId`, `actorRole`, `deviceId`, `sessionId`, `timestampServerUTC`, `routeMode`, `action`, `reason`, `before`, `after`, `status`, `requestHash`, `sourceSystem`, `legacyEventId` e `correlationId`.

- Não registrar senhas, tokens, identificadores de pagamento sensíveis nem dados desnecessários.
- Vincular ações do app à trilha da cronometragem; registrar alterações originadas do Windows pelo identificador disponível, sem inventar pessoa quando o sistema legado não fornece.
- Garantir retenção, exportação e revisão periódica da auditoria conforme política interna e obrigações legais aplicáveis.
- Revisões/correções precisam gerar eventos novos; não apagar eventos antigos para “corrigir o histórico”.

---

# 16. Requisitos não funcionais e SLOs

| Tema | Critério proposto para homologação | Como medir |
|---|---|---|
| Consistência | 0 sucessos falsos em ações críticas | Testes de timeout e reconciliação |
| Elegibilidade | 0 gravações de não aptos via app em bateria vinculada | Testes negativos automatizados |
| Duplicidade | 0 reaplicações da mesma operação idempotente | Repetição/conexão intermitente |
| Paridade | 100% dos cenários homologados com resultado Windows igual | Comparação de snapshots e eventos |
| Latência local | Alvo p95 ≤ 200 ms **sob rede controlada** para propagação após commit | Telemetria em tablets reais |
| Latência 4G | Alvo p95 ≤ 1 s **sob cobertura medida**, sem garantia universal | Telemetria em operadoras/aparelhos reais |
| Leitura após reconexão | Snapshot atualizado antes de liberar comandos | Falha/reentrada em rede |
| Usabilidade | Operação comum em poucos passos sem digitar IDs longos | Teste com galpão/diretor |
| Acessibilidade | Alvos de toque grandes, contraste, texto de status e redução de movimento | Inspeção + dispositivos reais |
| Integridade | Nenhuma publicação com migração destrutiva sem rollback | Teste de implantação |
| Segurança | 100% das rotas sensíveis exigem autenticação/autorização | Testes de API e perímetro |

**Importante:** alvos de 200 ms/1 s são **metas propostas** e não dados medidos. Definir escopo exato do cronômetro (commit → tela, sem incluir a decisão humana), p50/p95/p99, quantidade de dispositivos e condições da rede antes de aceitar SLO.

## 16.1 Observabilidade

Monitorar falhas de API, autorizações negadas, conflitos 409, operações em estado desconhecido, atraso de evento por sessão, dispositivos sem sincronização, latência por caminho, saúde do túnel, banco e origem, além de divergências entre snapshots.

Alarmes devem apontar ao operador **ações concretas**, não inundar o galpão com mensagens técnicas. Não expor informações de pilotos em logs públicos ou ferramentas externas sem necessidade.

---

# 17. Casos de teste obrigatórios

| ID | Cenário | Resultado esperado |
|---|---|---|
| T01 | Inscrito não aprovado tenta sortear | Impedido pelo servidor |
| T02 | Aprovado mas sem pagamento/termo satisfeitos conforme regra oficial | Impedido; motivo compreensível |
| T03 | Elegibilidade alterada entre abrir e confirmar | Conflito; não grava |
| T04 | Bateria sem vínculo de recepção criada no Windows | Mantém semântica atual, identificada na UI |
| T05 | Sorteio inicial com karts em manutenção | Não aloca esses karts |
| T06 | Dois operadores sorteiam simultaneamente | Um resultado consistente, sem dupla alocação |
| T07 | Um atrasado é aprovado depois de sorteio fechado | Aloca apenas atrasado, sem mudar demais |
| T08 | Dois atrasados competem pelo último kart | Um recebe kart, outro conflito explícito |
| T09 | Atrasado após largada com backend sem suporte | Bloqueia, sem mexer nas voltas |
| T10 | Atrasado após largada com backend homologado | Entrada registrada sem voltas fictícias |
| T11 | Piloto com voltas é removido | Exclusão destrutiva bloqueada; procedimento formal |
| T12 | Revogação da aprovação após gravação | Alerta; nenhuma exclusão silenciosa |
| T13 | Peso inválido/lastro impossível | Erro claro; não grava |
| T14 | Sorteio offline reaparece após largada | Não faz envio automático; bloqueia ação obsoleta |
| T15 | Troca para kart ocupado | Bloqueia antes de mutar |
| T16 | Troca com `expectedKartId` desatualizado | Conflito e atualização do snapshot |
| T17 | Troca exige preservar/ignorar voltas | Mesmo efeito e padrão do Windows |
| T18 | Troca com passagens em kart genérico | Mesmo efeito comprovado no Windows |
| T19 | Mesmo comando enviado três vezes com mesma chave | Uma única aplicação |
| T20 | Timeout após commit, antes da resposta | Status desconhecido → consulta → aplicado, sem duplicar |
| T21 | Mesmo `operationId` com payload diferente | Conflito de idempotência |
| T22 | Usuário Recepção tenta rota de punição via HTTP direto | 403 na origem |
| T23 | Operação usa 4G para aplicar punição | Autorização e confirmação equivalentes ao local |
| T24 | Usuário bloqueado mantém sessão aberta | Novos comandos recusados |
| T25 | Tentar comando de app sem token pelo túnel | 401/403; nenhuma alteração |
| T26 | Queda do Wi-Fi durante bandeira | Não reexecuta automaticamente |
| T27 | Evento SSE duplicado/fora de ordem | Snapshot consistente, sem efeito duplo |
| T28 | Reiniciar bateria duas vezes por toque duplo | No máximo uma execução |
| T29 | Manipulação de passagem após encerramento | Bloqueia ou segue procedimento formal do legado |
| T30 | Windows modifica mesma bateria durante edição do app | Conflito ou reconciliação; sem sobrescrever silenciosamente |
| T31 | SorteioKarts 1.6 e novo app na mesma bateria | Trava de migração ou bloqueio/alerta da convivência |
| T32 | Origem fora do ar com Cloudflare disponível | Degrada sem afirmar que salvou |
| T33 | Worker indisponível mas local TLS funciona | Caminho local seguro sujeito a sessão/revisão |
| T34 | Tentativa de acessar o servidor local por HTTP inseguro | Não enviar token; conexão rejeitada no app |
| T35 | Comando crítico enviado com snapshot antigo | 409 e exigência de nova confirmação |
| T36 | Igualar resultados, classificações e passagens no app/Windows/telão | Paridade dos dados de origem |
| T37 | Regressão de rotas legadas | Contratos/semântica iguais à baseline de produção |
| T38 | Rollback do novo app/gateway | Windows/recepção/telão continuam operacionais |
| T39 | Animação reduzida / baixa iluminação / tablet com luva | Interface legível e usável |
| T40 | Cancelamento e relargada com conflito de estado | Operação bloqueada sem duplicação |

### Pirâmide de testes

- **Unitários**: elegibilidade, regras de estado, permissão, validações, idempotência e algoritmos de apresentação.
- **Contrato**: snapshot, comandos, erros, eventos, payloads e compatibilidade de versões.
- **Integração em `SIMULATE`**: troca, punição, passagens, atrasados, reinício e fluxos de falha.
- **E2E em dispositivos**: tablet Android e iPhone, Wi-Fi, 4G, troca de rede, app em background e recuperação.
- **Homologação presencial**: bateria real assistida, com plano de reversão e responsáveis definidos.

---

# 18. Estratégia de migração, implantação e rollback

## 18.1 Fases

**F0 — Descoberta e baseline:** inventário read-only, rotas reais, diferenças produção/repo, requisitos oficiais de recepção, equivalência de comandos e testes do legado. Sem deploy.

**F1 — Segurança e infraestrutura:** autenticação, RBAC, API v1, idempotência, auditoria, snapshots/revisões, publicação HTTPS, telemetria, eventos e controle de dispositivos. Não habilitar comandos críticos antes de endurecer a origem.

**F2 — Sorteio seguro:** agenda, elegibilidade, sorteio original, peso/lastro, confirmação, atraso antes da largada, conflito concorrente e testes comparativos com SorteioKarts 1.6.

**F3 — Galpão e direção:** troca de kart, manutenção, bandeiras, penalidades, resultados em tempo real e entrada tardia em prova **somente se tecnicamente homologada**.

**F4 — Cronometragem avançada e equalização:** edição de passagens, correções, reinício/relargada, histórico amplo, equalização, gestão completa do dono e hardening adicional. Fazer habilitação por capacidade validada, não por tela pronta.

**F5 — Pilotagem e transição:** distribuir internamente, treinamento, operação assistida, comparar com Windows e descontinuar progressivamente o 1.6.

## 18.2 Convivência

- O 1.6 permanece disponível como contingência, **não como segundo editor simultâneo** da mesma bateria.
- Identificar no servidor ou painel de migração qual cliente assumiu a bateria e impedir escritas conflitantes. Se não houver como bloquear versões legadas, a migração de uma bateria deve ser controlada pelo líder de pista e seu risco residual documentado.
- Migração por aparelho e bateria, em janela com baixo risco operacional.
- Rollback significa retornar o uso ao cliente anterior e desabilitar as novas escritas, **não apagar comandos já confirmados**.

## 18.3 Gates de aprovação

- **G0:** inventário assinado e baseline congelada.
- **G1:** autenticação/autorização testadas nos dois caminhos e rotas legadas protegidas da internet.
- **G2:** teste de elegibilidade, concorrência e sorteio sem regressões.
- **G3:** troca e direção com paridade validada frente ao Windows.
- **G4:** testes de internet/offline/timeout/idempotência, dispositivo real e operação assistida.
- **G5:** checklist de rollback executado, responsáveis treinados e aceite formal da gerência.

## 18.4 Runbook em falha de produção

1. Identificar se o problema é aparelho, rede, gateway, origem, banco ou comando incorreto.
2. Registrar `operationId` e horário; não repetir ação crítica sem resolver situação do comando anterior.
3. Conferir estado na cronometragem autoritativa.
4. Se necessário, ativar modo somente leitura no app e executar procedimento oficial Windows.
5. Desabilitar função/versão problemática por configuração no servidor, sem atualizar todos os celulares.
6. Registrar incidente, auditoria e correção antes de reativar.
7. Testar recuperação e reconciliação do app.

---

# 19. Backlog priorizado com critérios de aceite

Formato: `ID | prioridade | história / entrega | dependência | critério de aceite`.

## Epic E0 — Descoberta e compatibilidade

| ID | Pri. | Entrega | Dep. | Aceite |
|---|---|---|---|---|
| E0-01 | P0 | Inventariar produção, APK, código e contratos | Nenhuma | Relatório com evidências e versões |
| E0-02 | P0 | Mapear motor Windows → rota → efeito | E0-01 | Matriz de paridade por comando |
| E0-03 | P0 | Mapear aprovação/pagamento/termo | E0-01 | Predicado de elegibilidade demonstrado |
| E0-04 | P0 | Documentar máquina de estados real | E0-01 | Transições confirmadas por testes |
| E0-05 | P0 | Criar suíte de regressão baseline | E0-01 | Contratos legados verificáveis |

## Epic E1 — Plataforma e autenticação

| ID | Pri. | Entrega | Dep. | Aceite |
|---|---|---|---|---|
| E1-01 | P0 | App Expo / roteamento / design tokens | E0-01 | Android/iOS iniciam e navegam |
| E1-02 | P0 | Login individual e sessão segura | E0-01 | Login/logout/revogação testados |
| E1-03 | P0 | RBAC server-side e por sessão | E1-02 | Requisições ilegais retornam 403 |
| E1-04 | P0 | API v1 + gateway HTTPS | E1-03 | Local/remoto protegidos |
| E1-05 | P0 | Idempotência + operação consultável | E1-04 | Timeout não reaplica comando |
| E1-06 | P0 | Snapshot revisionado / concorrência | E1-04 | Conflito rejeita escrita desatualizada |
| E1-07 | P0 | Auditoria transacional/outbox | E1-05 | Toda ação confirmada rastreável |
| E1-08 | P1 | Stream e recuperação por snapshot | E1-06 | Eventos duplicados tolerados |
| E1-09 | P1 | Telemetria e monitoramento | E1-04 | Erros/latência por operação visíveis |

## Epic E2 — Sorteio e recepção

| ID | Pri. | Entrega | Dep. | Aceite |
|---|---|---|---|---|
| E2-01 | P0 | Agenda e pilotos liberados | E0-03, E1-06 | Não aprovado não chega à gravação |
| E2-02 | P0 | Sorteio inicial equivalente ao 1.6 | E0-02 | Mesmas escolhas, lastro e regras |
| E2-03 | P0 | Conferência e confirmação | E2-02 | Sem falso sucesso |
| E2-04 | P0 | Atrasado antes da largada | E2-03 | Outros pilotos intactos |
| E2-05 | P0 | Concorrência de karts/pilotos | E1-06 | Sem dupla alocação |
| E2-06 | P1 | Peso, lastro, conferência física | E0-02 | Cálculo igual ao legado |
| E2-07 | P1 | Recepção somente leitura | E2-01 | Nenhuma rota de aprovação no app |
| E2-08 | P1 | Rascunho offline e revalidação | E2-03 | Sem autoenvio obsoleto |
| E2-09 | P1 | Atrasado após largada (condicional) | E0-02, E0-04 | Nunca cria voltas fictícias |

## Epic E3 — Pista, frota e diretor

| ID | Pri. | Entrega | Dep. | Aceite |
|---|---|---|---|---|
| E3-01 | P0 | Troca de kart | E0-02, E1-05 | Mesmos efeitos do Windows |
| E3-02 | P0 | Bandeiras/penalidades | E0-02, E1-05 | Paridade e auditoria |
| E3-03 | P1 | Grade e manutenção | E1-06 | Indisponíveis bloqueados |
| E3-04 | P1 | Ao vivo e status das sessões | E1-08 | Convergência após reconexão |
| E3-05 | P1 | Largada/quadriculada/encerramento | E0-04, E1-05 | Estado seguro, confirmação |
| E3-06 | P1 | Reinício/relargada/cancelamento | E3-05 | Sem execução duplicada |
| E3-07 | P2 | Passagens e correções avançadas | E0-02, E3-05 | Diário e classificação equivalentes |
| E3-08 | P2 | Resultados e envio de e-mail | E0-02 | Usa infraestrutura oficial |

## Epic E4 — Equalização, gerência e implantação

| ID | Pri. | Entrega | Dep. | Aceite |
|---|---|---|---|---|
| E4-01 | P2 | Equalização completa | E0-02 | Sem alteração indevida de prova |
| E4-02 | P1 | Dashboard operacional | E1-08 | Dados consistentes com servidor |
| E4-03 | P1 | Gestão de usuários / revogação | E1-02 | Bloqueio imediato efetivo |
| E4-04 | P1 | Auditoria filtrável | E1-07 | Encontrar comando por ator/sessão |
| E4-05 | P0 | Testes integrados e paridade | E2, E3 | Casos T01–T40 aplicáveis aprovados |
| E4-06 | P0 | TestFlight / Android interno | E1, E2 | Builds assinados e instaláveis |
| E4-07 | P0 | Treinamento e runbook | E4-05 | Equipe executa cenários críticos |
| E4-08 | P0 | Rollout gradual e rollback | E4-07 | Sem parada das operações legadas |

**Definição de pronto de qualquer história:** especificação de fluxo + testes automatizados relevantes + autorização server-side + estados de erro + trilha de auditoria quando escreve + QA em dispositivo real quando aplicável + documentação + revisão de regressão. Interface “bonita” sem backend validado não conta como conclusão.

---

# 20. Estrutura sugerida do repositório (não é estrutura existente)

```text
kartodromo-operacional/
  app/                         # Expo Router e agrupamento por perfil
  src/
    features/
      auth/
      dashboard/
      sessions/
      draw/
      late-entries/
      ballast/
      kart-swaps/
      race-director/
      timing/
      fleet/
      equalization/
      reception-readonly/
      users/
      audit/
    core/
      api/                     # cliente HTTP e contratos gerados
      realtime/                # SSE e reconciliação
      security/                # armazenamento seguro, políticas locais
      offline-drafts/          # somente rascunhos não críticos
      design-system/           # tokens, componentes e animações
      telemetry/
  tests/
    unit/
    contract/
    e2e/
  docs/
    architecture/
    operations/
    qa/
```

No servidor, acrescentar módulos de `/api/app/v1`, autorização, idempotência, auditoria, adaptadores de domínio, eventos e testes junto ao padrão real do repositório existente. **Não reestruturar `services/timing-server.ts` ou o Windows apenas para combinar com esta sugestão.**

---

# 21. Distribuição e versionamento

- Produto interno independente do app público de clientes, com identificadores Android/iOS próprios.
- Distribuição inicial via canais internos/testes privados; restringir acesso a funcionários autorizados.
- TestFlight e Google Play Internal Testing são opções, assim como soluções corporativas quando elegíveis.
- A exigência Google de **12 testadores inscritos por 14 dias** não vale para toda distribuição: aplica-se ao acesso à produção no Google Play em determinadas **contas pessoais criadas após 13/11/2023**. Não é pré-requisito universal de teste interno.
- Expo SDK 57 foi citado pelo documento-base. Confirmar `package.json`/lockfile do projeto e compatibilidade de dependências antes de fixar versão; não migrar major automaticamente.
- Definir estratégia de build, assinatura, certificados, atualização OTA com controle de versão e rollback. Atualização OTA não pode alterar contratos de forma incompatível com a API de produção.

---

# 22. Questões técnicas que devem ser respondidas por evidência, não por suposição

1. `aprovada=1` é de fato a condição **final** de entrada, incluindo pagamento e termo? Quais exceções oficiais existem?
2. O servidor dispõe de inclusão de participante **após largada**, com preservação correta do diário? Em quais estados?
3. A operação de swap preserva/ignora voltas exatamente como descrito? Como diferenciar o modo Tabajara?
4. O que são as revisões/IDs e limites transacionais reais no servidor?
5. Existem outros clientes que escrevem o mesmo sorteio e podem ultrapassar a trava do app?
6. Quais alterações de passagem realmente existem e são seguras via endpoint sem interação direta no Windows?
7. O estado de manutenção do kart já existe? Qual cadastro é sua fonte de verdade?
8. SSE atual informa revisão/cursor? É possível retomar eventos sem perder mudanças?
9. Qual o modelo real de autenticação atual e quais caminhos são alcançáveis publicamente?
10. A produção tem a mesma versão do repositório? Que diferenças devem ser mantidas por compatibilidade?

Esses itens são **pendências de verificação técnica**, não pedidos para o dono decidir detalhes de código. A equipe deve investigá-los e registrar evidências.

---

# 23. Registro de decisões para aprovação do responsável

| Decisão | Padrão especificado nesta revisão | Status |
|---|---|---|
| D01 | Antes da largada, edição controlada; após, troca oficial e entrada tardia excepcional somente se suportada; preservar voltas | **Aceita pelo dono em 31/10/2026** |
| D02 | Operação pode agir por Wi-Fi e dados móveis, inclusive comandos críticos, sob autenticação e confirmações | **Aceita pelo dono em 31/10/2026** |
| D03 | Recepção v1 somente consulta; aprovação/pagamento/termo ficam no sistema oficial | **Aceita pelo dono em 31/10/2026** |
| DT01 | Backend de cronometragem como fonte única de prova | Requisito preservado |
| DT02 | Nova API autenticada com idempotência e auditoria | Recomendação técnica |
| DT03 | HTTPS em todos os caminhos usados pelo app | Recomendação de segurança |
| DT04 | Nenhuma ação crítica em fila offline | Recomendação técnica |
| DT05 | Publicação gradual sem editar simultaneamente no app 1.6 | Recomendação operacional |
| DT06 | Entrada tardia após largada só com suporte existente comprovado | Bloqueio técnico |

**Condição para aprovação final:** aceite explícito das decisões D01–D03, conclusão de E0-01 a E0-05 e revisão dos pontos que afetem comportamento da cronometragem. A documentação pode orientar a engenharia antes disso; a publicação de comandos em produção não.

---

# 24. Fontes e delimitação da revisão

## Fonte interna

- Documento entregue: `Markdown colado(2).md`, título **App Operacional do Kartódromo — Design**, data 31/10/2026. Foi a única especificação de código recebida nesta revisão.

## Referências oficiais externas consultadas

- Expo, referência de versões e compatibilidade: https://docs.expo.dev/versions/latest/
- Cloudflare Tunnel, publicação de aplicações: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/
- Cloudflare Access, service tokens e limites de uso: https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/
- Cloudflare Workers, Streams API: https://developers.cloudflare.com/workers/runtime-apis/streams/
- Google Play, requisitos de testes para contas pessoais elegíveis: https://support.google.com/googleplay/android-developer/answer/14151465?hl=pt-BR

As referências externas validam capacidades e políticas gerais das plataformas; **não comprovam** como o servidor do kartódromo está configurado. A revisão não realizou SSH, inspeção de APK, leitura do repositório, testes automatizados nem publicação. Portanto, o produto de entrega é uma **especificação técnica revisada**, não um aplicativo corrigido.
