# Auditoria da agenda administrativa — 05/11/2026

URL: https://admin.kartodromodebetim.com.br/#/agenda

Resultado: **há falhas financeiras, de consistência e de fluxo que impedem considerar a agenda confiável para operação sem conferência.** Foram registrados 26 achados: 8 reproduzidos no navegador/dados publicados, 17 identificados no código e 1 lacuna de testes. Um achado de código descreve comportamento determinístico ou risco concreto; não significa que houve incidente em produção.

## Método e limites

- Inspeção autenticada com sessão administrativa já existente; não foi necessário digitar a senha fornecida.
- Consultas GET às baterias, inscrições, grupos e pendências. Conferência financeira das 14 baterias com saldo de 05 a 07/11.
- Inspeção das vistas semana, dia e lista, gaveta, nova reserva e grupo existente. Verificação de largura em 390 × 844 e 1440 × 1000.
- Reprodução de concorrência atrasando somente respostas GET no navegador e restaurando `fetch` ao final. Nenhum dado de negócio foi criado, editado, cobrado, enviado ou excluído.
- `app.js` e `grupo.js` publicados foram comparados ao código local: conteúdo igual após normalizar finais de linha. `agenda-acoes.js` apresentou SHA-256 idêntico. Isso confirma a correspondência do frontend; **a versão do backend em execução não foi comparada ao servidor Windows**.
- Revisão do Worker, servidor Ops, rotas de bateria, movimentos, grupos, pagamentos e permissões. Sem teste destrutivo, sem conta de outro perfil, sem disparar WhatsApp/Asaas, impressora, totem ou cronometragem real.
- Testes locais: 52 passaram e 4 falharam em 56 testes relacionados. Não se conclui que cada teste falho seja um defeito de produção.
- Esta é uma auditoria ampla do escopo inspecionado, não uma garantia de inexistência de outros defeitos. Fluxos com gravação ainda exigem ambiente isolado e validação ponta a ponta.

Prioridades: **P1** = risco financeiro, autorização ou associação incorreta; **P2** = inconsistência operacional/recuperação; **P3** = limitação de uso ou evidência. Evidências **PROD** = navegador/API publicada; **CÓDIGO** = implementação inspecionada, sem provocar a gravação real; **TESTE** = suíte local.

## 1. Achados reproduzidos no ambiente publicado

### A01 — P1 — Saldo a receber usa preço da bateria, não da reserva [PROD]

**Reprodução:** abrir a semana de 01 a 07/11 e conferir as reservas dos horários futuros com o painel “A receber”. Na bateria 394, de 05/11 às 19:20, a agenda cobra visualmente R$ 2.625; as 15 inscrições são de R$ 145 e o grupo 87 tem saldo de R$ 2.175. Diferença de R$ 450 nesse horário.

Nas 14 baterias verificadas, a soma exibida é **R$ 27.825**, contra **R$ 23.055** de saldos retornados pelas reservas/grupos. **Superestimação de R$ 4.770**. São valores de leitura naquele momento, não uma conciliação bancária. Não significa que esse valor tenha sido efetivamente cobrado.

**Causa:** `faltaValor = falta(b) * b.preco`, em `workers/admin/public/app.js:296`. Também não representa corretamente sinal parcial: o pagamento é reduzido a uma contagem de pessoas integralmente pagas.

**Correção indicada:** calcular saldo financeiro por inscrição/grupo, com pagamentos parciais, descontos e preço contratado; entregar esse agregado pela API e reutilizá-lo na grade, lista e painel.

| Bateria | Início | Exibido | Saldo consultado |
|---|---|---:|---:|
|394|05/11 19:20|2.625|2.175|
|395|05/11 19:55|175|145|
|396|05/11 20:30|2.800|2.320|
|399|06/11 17:00|1.750|1.450|
|403|06/11 19:20|525|435|
|407|06/11 21:40|2.100|1.740|
|532|07/11 09:15|1.575|1.305|
|534|07/11 10:25|1.050|870|
|536|07/11 11:35|175|145|
|539|07/11 13:20|5.250|4.350|
|541|07/11 14:30|1.925|1.595|
|542|07/11 15:05|2.100|1.740|
|545|07/11 16:50|1.925|1.595|
|547|07/11 18:00|3.850|3.190|

### A02 — P1 — Vagas sem pagamento são descritas como pagas [PROD]

**Reprodução:** abrir a bateria 394. A seção “Vagas de grupo aguardando cadastro” diz: **“A vaga já está paga e reservada”**. O grupo 87 retorna pagamento zero e saldo de R$ 2.175; a própria janela mostra 0 de 15 pagos.

**Causa:** mensagem fixa em `workers/admin/public/agenda-acoes.js`, função `pendenciasGrupo`.

**Impacto:** recepção pode interpretar pendência cadastral como autorização financeira. A frase precisa depender da situação real de cada vaga.

### A03 — P2 — Bateria fechada oferece nova reserva por um caminho e a esconde em outro [PROD]

**Reprodução:** bateria 394 com `reservaFechada=true`, `status=aberta`. A gaveta oferece **“Nova reserva · 15 vagas”** e abre o formulário de outro grupo. No seletor do cabeçalho, o mesmo horário é excluído.

**Causa:** rodapé da gaveta só verifica situação, disponibilidade e bloqueio; o seletor verifica também `!reservaFechada`. A extensão só desabilita o botão quando `status==='fechada'`.

**Impacto:** não há regra uniforme para “só o grupo”. Definir se recepção pode criar outro grupo nesses horários e aplicar a mesma regra, com explicação explícita. Não foi salva outra reserva.

### A04 — P2 — Limite de grupo fechado exibe capacidade total como disponível [PROD]

**Reprodução:** criar apenas o rascunho na bateria 394, que tem 15 lugares disponíveis. O formulário informa **“até 30”**.

**Causa:** `Grupo.pintar`, `workers/admin/public/grupo.js:114`: quando a bateria está fechada, o máximo usa `b.vagas`, sem descontar outras reservas. O manipulador de adicionar usa disponibilidade, produzindo ainda uma divergência entre o limite anunciado e o permitido.

**Correção indicada:** considerar vagas livres mais vagas já pertencentes ao grupo editado. Validar novamente no servidor.

### A05 — P2 — Sinal de 0% ainda oferece gerar cobrança [PROD]

**Reprodução:** abrir o grupo 87. Modo “sinal”, percentual 0%, texto **“Link do sinal: R$ 0,00 (0%)”** e botão **“Gerar e enviar link ao responsável”**.

**Impacto:** oferece uma ação sem valor a cobrar. A geração não foi acionada; o comportamento do Asaas não foi inferido. Ocultar a ação quando o saldo do sinal é zero ou explicar qual cobrança será criada.

### A06 — P3 — Reserva pelo cabeçalho tem horizonte fixo de 14 dias [PROD]

**Reprodução:** “Nova reserva” em 05/11 apresenta somente 05 a 18/11, sem campo de data nem avanço do período. As segundas são desabilitadas por dia da semana, não pela agenda consultada.

**Impacto:** planejamento distante depende de descobrir o caminho alternativo pela gaveta. Na vista semanal, a data previamente selecionada também não é usada como data inicial do seletor. Oferecer escolha de data e consultar disponibilidade real; abertura excepcional de segunda requer decisão operacional, não presunção do frontend.

### A07 — P1 — Resposta antiga coloca reservas sob o período errado [PROD]

**Reprodução controlada:** na vista lista, avançar duas vezes e atrasar a primeira resposta GET em 1,1 segundo. Resultado: estado/data e título **19/11 a 25/11**, mas linhas de **sexta 13/11 e sábado 14/11**. O teste não alterou respostas nem dados, apenas a ordem de chegada.

**Causa:** `carregar`, `workers/admin/public/app.js:525`, atribui a variável `bats` sem identificador da consulta, cancelamento ou conferência do período solicitado. Depois pinta usando o estado atual.

**Impacto:** operador pode abrir e manipular bateria de outro período acreditando estar no selecionado. Usar geração da consulta e snapshot de parâmetros; descartar respostas antigas. O mesmo padrão aparece nos seletores de horário, mudança de dia do movimento e resumo de fechar dia; esses outros casos não foram reproduzidos individualmente.

### A08 — P2 — “Na pista” e “correram” são inferidos do relógio [PROD]

**Reprodução sem corrida:** chamar a função publicada `situacaoBateria` com horário cinco minutos antes e zero inscritos: retorna `pista`. A função não recebe nem consulta estado da cronometragem. Após 35 minutos retorna `fim`.

**Causa:** janela fixa de 35 minutos em `workers/admin/public/app.js:277`, também usada na faixa, fim da bateria e bloqueio de edição/movimento.

**Impacto:** atraso, antecipação, corrida vazia, treino ou duração diferente produzem afirmações incorretas. Usar estado real para “na pista” e “correu”; horário previsto deve ser identificado como previsão. Não foi constatada uma corrida real em andamento com indicação errada nesta auditoria.

## 2. Falhas e riscos identificados no código

### A09 — P2 — Gaveta fica desatualizada enquanto a grade se atualiza [CÓDIGO]

`app.js`, final de `TELAS.agenda`: o temporizador de 45 s chama `carregar()`, não `recarregar()`. A grade muda, mas o conteúdo de inscrições/grupos da gaveta permanece antigo. Com modal de grupo aberto, até essa atualização é suspensa. Pagamento recebido em outro canal não atualiza espontaneamente o grupo aberto, apesar da promessa textual de atualização automática. Recarregar o detalhe preservando o trabalho em edição e indicar sua última atualização.

### A10 — P2 — Falha ao consultar grupos vira “sem grupos” [CÓDIGO]

`app.js:675`: erro de `/grupos?bateriaId=...` é convertido em `[]`; inscrições são então apresentadas como avulsas. `pendenciasGrupo` também abandona a seção silenciosamente em erro. A tela não distingue ausência de grupo de indisponibilidade. Mostrar falha e permitir tentar novamente, sem oferecer classificações incompletas como definitivas.

### A11 — P2 — Primeiro erro de carga deixa esqueleto sem recuperação explícita [CÓDIGO]

`app.js:525`: o `catch` só altera o texto de atualização. Sem carga anterior, o esqueleto continua. Não há painel de erro com “Tentar novamente”; é necessário esperar o temporizador ou navegar. Com carga anterior, mudança de data com erro pode manter conteúdo antigo. Preservar contexto do último dado e identificar claramente o período que ele representa.

### A12 — P1 — “Desfazer” pode abrir uma bateria originalmente bloqueada [CÓDIGO + reprodução isolada]

`agenda-acoes.js:30`, `restaurar`: para bateria originalmente `status=aberta`, `reservaFechada=false`, `autoAtendimento=false`, envia `tipo=aberta`, que ativa autoatendimento. O bloqueio original se perde.

Reproduzido com a função original em VM e API substituída por coletor de chamadas; nenhuma alteração real. Restaurar as três propriedades anteriores, inclusive quando estado e flags se combinam.

### A13 — P2 — “Abrir bateria” pode manter o horário fora dos canais [CÓDIGO + reprodução isolada]

`agenda-acoes.js`, `abrirBateria`: se `status=fechada`, `reservaFechada=false`, `autoAtendimento=false`, só muda status. O autoatendimento continua desligado, mas a mensagem anuncia abertura para reservas. Reproduzido em VM. Aplicar o estado completo pretendido e confirmar o estado final.

### A14 — P2 — Troca entre fechada e bloqueada não limpa a outra flag [CÓDIGO]

`lib/ops/grupos.ts:718`, `tipoDaBateria`: `fechada` apenas liga `ReservaFechada`; `bloqueada` apenas desliga `AutoAtendimento`. Fechada → bloqueada mantém a primeira flag e a tela continua priorizando “fechada”. Tratar os três tipos como estados exclusivos ou apresentar as combinações corretamente. O backend implantado não foi comparado.

### A15 — P1 — Movimento parcial deixa um grupo associado a horários diferentes [CÓDIGO]

`lib/ops/office.ts:1633`: o grupo só muda de bateria quando **todos** os seus integrantes ativos já estão no destino. A UI permite selecionar e mover uma só pessoa. `carregarGrupos` filtra por `g.BateriaId`, mas carrega todos os integrantes, sem restringir à bateria de cada inscrição.

**Efeito:** ao mover parte, a origem pode continuar exibindo o grupo completo e o destino tratar os movidos como avulsos; link e horário do grupo continuam apontando para a origem. Falta escolher explicitamente: mover grupo inteiro, dividir grupo com reconciliação financeira ou impedir parcial. Não foi dividido grupo real.

### A16 — P1 — Movimento não pago muda preço da inscrição sem conciliar o grupo [CÓDIGO]

`office.ts`, rota `/reservas/:id/mover`: inscrição não paga recebe preço/produto do destino. O preço de `ReservaGrupo` continua o anterior. Um grupo de R$ 145 movido para bateria de R$ 175 pode ter cálculo do grupo e cobrança da recepção divergentes, mesmo depois de mover todos. Definir política de preço e sincronizar os registros em uma transação.

### A17 — P2 — Servidor de movimento não confere horário passado [CÓDIGO]

A rota `/reservas/:id/mover` confere existência, status, produto, serviço, lotação e duplicidade, mas a seleção do destino não lê `Inicio`. A proibição “Já passou” está no navegador. Uma chamada direta ou tela envelhecida pode contornar essa regra. Aplicar validação de data/hora no servidor com a política explícita de tolerância. Não foi enviada requisição de movimento real.

### A18 — P1 — Editar preço do grupo não atualiza o preço das inscrições [CÓDIGO]

`lib/ops/grupos.ts:607`: atualiza `ReservaGrupo.PrecoCentavos` e chama `aplicarPagos`. Essa função altera `Pago/ValorCentavos`, mas não sincroniza `Inscricao.PrecoCentavos`. O preço da inscrição foi definido na criação ou inclusão. Assim, grupo e recepção podem calcular débitos diferentes após editar preço. Preservar histórico e conciliar apenas itens elegíveis, com política para os já pagos.

### A19 — P1 — Pagamento manual não tem proteção de repetição [CÓDIGO]

`grupo.js:223` oferece repetir a ação em falha; `/grupos/:id/pagamentos`, `grupos.ts:680`, insere um lançamento novo sem chave de idempotência. Se o servidor gravar e a resposta se perder, tentar novamente pode duplicar o recebimento. Há também ações de pagamento que não travam o botão durante toda a operação.

Usar identificador estável da operação e unicidade no servidor. Não foi feito teste de pagamento real ou perda de resposta de gravação.

### A20 — P1 — Resposta de um grupo pode alterar a janela de outro [CÓDIGO]

`grupo.js:64`, `abrir`, e `:223`, `atualizar`: usam variável global mutável `estado` depois de `await`, sem conferir a identidade da janela/grupo que iniciou a ação. Fechar, trocar grupo ou abrir outra modal durante uma requisição pode fazer resposta antiga preencher estado novo ou acessar estado nulo. Usar snapshot da operação e descartar resposta que não pertence ao contexto ativo.

### A21 — P2 — Responsável marcado “Menor” é salvo como adulto [CÓDIGO]

`grupo.js:416`: o payload força `menor:false` para a primeira pessoa, tanto nova quanto existente, embora o formulário ofereça o controle Adulto/Menor nessa linha. A escolha não é respeitada. Ou impedir responsável menor com explicação da regra, ou persistir corretamente o atributo e responsável legal exigido. Nenhum cadastro foi salvo.

### A22 — P2 — Movimento mistura fuso do computador e fuso do kartódromo [CÓDIGO]

`agenda-acoes.js:15`, `agoraLocal`, usa `getHours/getFullYear` no fuso do navegador. O restante da agenda usa `America/Sao_Paulo`. Quem acessar de outro fuso pode receber “Já passou” em horário ainda válido ou o inverso. Usar a mesma referência temporal, com validação do servidor.

### A23 — P1 — Permissão de alterar telas não é aplicada nas rotas inspecionadas [CÓDIGO]

`app.js:80` bloqueia gravação no cliente conforme a rota visual. Worker `workers/admin/src/index.ts`, `repassar`, encaminha a requisição com token. `services/ops-server.ts:560`, `sessaoDe`, valida sessão, mas não autoriza a função. As rotas de grupo/preço/pagamento inspecionadas não verificam a permissão de alteração da tela. Há verificações específicas de fechar bateria, que **não equivalem** à autorização de todas as operações.

**Risco:** usuário autenticado com acesso de consulta pode chamar diretamente operações que a interface esconde/bloqueia. Não se afirma exploração confirmada: não houve login em perfil restrito nem tentativa de gravação. Validar o backend implantado e aplicar autorização central por operação; não confiar em `S.rota`.

### A24 — P2 — Inclusão de piloto não é atômica com criação do vínculo [CÓDIGO]

`grupos.ts:624`: `inscreverN` cria a inscrição antes da transação que cria piloto e cadastro provisório. Se a segunda etapa falhar, esta rota não tem a compensação usada na criação do grupo. Pode restar vaga ocupada sem piloto do grupo. Integrar as etapas na mesma transação ou cancelar inscrição criada em falha, com recuperação observável.

### A25 — P2 — Indicador “Pronto para o totem” usa critérios diferentes [CÓDIGO]

`app.js:687` considera CPF, peso e telefone; `lib/ops/grupos.ts`, `faltaNoCadastro`, também exige e-mail. A mesma pessoa sem e-mail pode parecer pronta na reserva avulsa e incompleta no grupo. Reutilizar uma definição de prontidão retornada pelo servidor e explicitar o que falta, incluindo obrigações de menor quando aplicáveis.

## 3. Evidência automatizada e cobertura

### A26 — P2 — Suíte relacionada tem falhas e não sustenta aprovação integral [TESTE]

Comando executado:

```sh
npx vitest run tests/ops/agenda-mover.test.ts tests/ops/office-routes.test.ts tests/ops/totem-baterias.test.ts
```

Resultado: **3 arquivos, 56 testes; 52 passaram e 4 falharam**. Arquivos `agenda-mover` e `totem-baterias` passaram; falhas em `office-routes`:

1. Espera invalidar o termo ao trocar produto; a implementação contém decisão explícita de preservá-lo.
2. Espera marcar `TermoImpressoEm` no checkout; o SQL observado não o faz.
3. Espera rejeitar movimento pago por divergência de preço; implementação atual permite preservar preço pago em serviço compatível.
4. Espera mensagem antiga “mesmo produto e preço”; implementação atual usa “mesmo serviço e tipo de kart”.

As expectativas de movimento conflitam com a regra atual presente no código. Precisam ser revistas com a regra de negócio; não se deve reintroduzir a restrição antiga apenas para deixar teste verde. A verificação de termo requer validar o agente de impressão e o comportamento contratado. Não foram alterados testes ou código.

Faltam, na validação executada, testes ponta a ponta de saldo parcial, consulta fora de ordem, desfazer bloqueio, autorização restrita, divisão de grupo, falha entre inscrição e vínculo, repetição de pagamento e resposta de modal antiga. O teste existente de movimento cobre repetição apenas dos integrantes que falharam; isso passou e não é um defeito a ser reaberto.

## 4. Fluxos que precisam ser completados ou uniformizados

| Fluxo | Lacuna observada | Critério de conclusão |
|---|---|---|
|Cobrança/saldo|Preço contratado e sinal ignorados no resumo|Grade, grupo, recepção e financeiro exibem mesmo saldo conciliado|
|Fechar/bloquear/abrir/desfazer|Estados e flags inconsistentes|Cada ação produz estado claro e desfazer restaura o anterior integralmente|
|Mover grupo|Movimento individual sem política de divisão|Destino, participantes, link e pagamentos permanecem associados corretamente|
|Alterar preço|Grupo e inscrição independentes|Política de itens pagos e não pagos aplicada atomicamente|
|Atualização multioperador|Modal/gaveta não acompanham mudanças externas|Atualização identificada, preservando edição em andamento|
|Navegar data|Resposta velha aceita|Só o período selecionado pode pintar dados e alimentar ações|
|Reserva distante/exceção de calendário|14 dias e segundas fixas no cabeçalho|Seleção de data e regra de abertura derivadas da agenda|
|Receber/estornar|Repetição e resposta perdida sem garantia|Operação idempotente e status verificável; estorno externo com fluxo claro|
|Falha de rede/serviço|Ausência confundida com erro|Mensagens por seção e recuperação sem apresentar dados de outro período|
|Perfis de consulta|Bloqueio principalmente no frontend nas rotas revistas|Requisições diretas de alteração recebem 403 no backend|

## 5. O que funcionou e o que permanece sem comprovação

- Consultas inspecionadas retornaram HTTP 200; console do navegador sem erros ou avisos no momento da consulta.
- Vistas e abertura de grupo funcionaram; não foi detectado transbordamento horizontal de documento/modal na medição móvel de 390 px. Isso não substitui auditoria visual completa de todos os formulários ou acessibilidade.
- Inscrições pagas têm preservação de preço e validação de serviço/kart na rota de movimento inspecionada. Capacidade e duplicidade têm bloqueios no servidor. Não confundir os problemas apontados com ausência de todas as validações.
- Login/senha fornecidos não foram retestados porque já havia sessão válida. Expiração, logout e recuperação de acesso não foram exercitados.
- Não foram concluídas vendas, cobranças, estornos, exclusões, vinculações, geração em massa ou mudanças de bateria em produção. Não há certificação de Asaas, conciliação bancária, impressão física, chegada no totem, sorteio, resultado ou e-mail.
- Não houve alteração de código de aplicação, deploy, instalação, reinício ou mudança no telão. Somente este relatório foi adicionado; artefatos de navegador ficaram na pasta local ignorada `.playwright-mcp`.

## 6. Ordem recomendada

1. Corrigir saldo e mensagem de pagamento; validar autorização no backend implantado e impedir consultas antigas de alimentar ações.
2. Definir e corrigir a política de grupo/preço/movimento; tornar recebimentos idempotentes.
3. Corrigir estados de bloqueio/desfazer, atualização das janelas e falhas de consulta.
4. Uniformizar menor/prontidão/calendário/fuso e reconciliar testes com regras atuais.
5. Validar todos os fluxos de escrita em ambiente isolado com dados TESTE CODEX, incluindo falha de rede, concorrência e limpeza. Só então fazer validação controlada das integrações reais.
