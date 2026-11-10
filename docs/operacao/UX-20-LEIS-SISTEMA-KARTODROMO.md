# 20 Leis de UX Aplicadas ao Sistema do Kartódromo de Betim

> **Diretrizes Operacionais Pétreas (Regras do Dono e AGENTS.md):**
> 1. Os apps da operação (**Recepção**, **Totem** e **Cronometragem**) são **programas Windows nativos** (`desktop/`), **nunca** apps web/Chrome.
> 2. **Totem sem teclado virtual:** opera em monitor convencional com **teclado físico USB** (sem touchscreen e sem teclado virtual na tela).
> 3. **Não mexer no telão** (`FormTV` / `--tv` / placar).
> 4. **Sem impressora nos totens:** os termos de responsabilidade do totem caem na fila do SRVKART (`:4060`) e são impressos exclusivamente na Epson TM-T20 da Recepção.
> 5. **Site e Reservas Web:** manter obrigatoriamente a política de cancelamento/reembolso com aceite (`2026-10-09`), a regra de "uma vaga por pessoa" (nomes e CPFs para acompanhantes ≥ 14 anos) e o acento verde neon `#00ff7a`.
> 6. Testes em produção apenas com **"TESTE CODEX"**, desfeitos imediatamente após o teste. Cronometragem apenas no simulador `:4150`.

---

## Mapeamento dos Ambientes do Sistema

| Ambiente | Plataforma | Dispositivo & Entrada | Função Primária |
| :--- | :--- | :--- | :--- |
| **Totem de Autoatendimento** | Windows Nativo (`Kartodromo.Autoatendimento` / `FormTotem.cs`) | Monitor padrão + Teclado Físico USB (Tela cheia travada, saída `Ctrl+Shift+Alt+S`) | Identificação rápida por CPF, conferência de cadastro e pré-reserva de bateria para o dia. |
| **Recepção** | Windows Nativo (`Kartodromo.Recepcao` / `FormPrincipal.cs`) | PC Desktop + Teclado + Mouse + Impressora Térmica TM-T20 | Venda balcão, caixa, aprovação de pré-reservas do totem, impressão de termos e cadastro completo. |
| **Cronometragem Operador** | Windows Nativo (`Kartodromo.Cronometragem` / `FormCrono.cs`) | PC Operador ORBITS (`:4050` / simulador `:4150`) | Controle de baterias, grid, bandeiramento, lastro, penalidades e recuperação de pilotos. *(Telão FormTV é intocado)*. |
| **Site & Reservas Web** | Next.js 16 + Tailwind CSS | Desktop & Mobile Web | Divulgação institucional, consulta de agenda em tempo real (polling 5s) e checkout de vagas com Pix/Cartão. |
| **App Mobile do Piloto** | Expo 57 / React Native 0.86 | Smartphones (iOS e Android - Touchscreen) | Acompanhamento ao vivo, ranking histórico, telemetria individual, carteira de baterias e GPS. |

---

## As 20 Leis de UX Aplicadas

### 1. Lei de Hick (Hick's Law)
> *O tempo para tomar uma decisão aumenta logaritmicamente com o número e a complexidade das escolhas.*

- **Totem:** Fluxo linear e estrito em 3 passos: [1] Digitar CPF no teclado USB ➔ [2] Selecionar a bateria desejada com setas/Enter ➔ [3] Confirmar. Se o cliente já tiver cadastro (90% dos casos), pula direto para a escolha da bateria.
- **Reservas Web:** Estrutura progressiva em funil (*Wizard* em 4 etapas): Data ➔ Turno e Horário ➔ Quem vai pilotar (dados dos pilotos) ➔ Pagamento e aceite de política. Nunca exibir dezenas de horários desordenados de uma vez.
- **Recepção:** Telas com filtros predefinidos por padrão (data atual selecionada, turno vigente em foco) para a recepcionista não precisar configurar filtros em filas de atendimento.

---

### 2. Lei de Fitts
> *O tempo para alcançar um alvo depende da distância até o alvo e do seu tamanho.*

- **Totem (Teclado Físico USB + Monitor):**
  - Foco inicial automático sempre posicionado no campo ativo (`CampoTexto`).
  - Navegação fluida por teclas: `Tab` avança campo, `Shift+Tab` retrocede, `Enter` aciona o botão padrão e `Esc` volta à tela anterior.
  - Indicador visual de foco nítido (borda de 2px contrastante `#00ff7a` ou dourada) para facilitar a visualização a 60 cm do monitor do quiosque.
- **Mobile (Touchscreen):**
  - Alvos de toque com área mínima de **48×48 dp** (padrão WCAG).
  - Botões primários de ação ("Confirmar Inscrição", "Copiar Código Pix") fixos no rodapé inferior (*Sticky Footer*), na zona natural do polegar.
- **Recepção Desktop:** Botões de atalho frequente (F2 Cliente, F3 Bateria, F4 Caixa) mapeados no topo do teclado, reduzindo deslocamento contínuo do mouse.

---

### 3. Lei de Jakob
> *Os usuários passam a maior parte do tempo em outros produtos e esperam que o seu funcione da mesma forma.*

- **Site & Mobile:** Usar ícones e padrões canônicos da web: lupa para pesquisa, calendário para seleção de data, engrenagem para ajustes, avatar para o piloto e sacola/ingresso para reservas.
- **Apps Desktop Windows:** Seguir rigorosamente o padrão Windows Forms: `Enter` submete diálogo, `Esc` cancela/fecha, `Tab` percorre campos em ordem lógica e grids com ordenação por clique no cabeçalho da coluna.
- **Prevenção de Ambiguidade:** Não inventar termos próprios quando existem termos consolidados no automobilismo (*Pole Position*, *Melhor Volta*, *Grid*, *Lastro*, *Transponder*).

---

### 4. Lei da Proximidade (Gestalt)
> *Elementos próximos espacialmente são percebidos como membros do mesmo grupo funcional.*

- **Recepção:** Agrupamento estrito de dados por cartões com bordas e títulos claros:
  - *Identificação:* Nome, CPF, Nascimento, Telefone, E-mail, Instagram.
  - *Segurança & Operação:* Status do Termo, Responsável Legal (se < 18 anos), Observações Médicas/Sanguíneas.
  - *Bateria & Vaga:* Número do Kart, Categoria, Lastro Adicional calculado.
- **Cronometragem Operador:** LiveGrid mantém linha compacta unindo Posição + Número do Kart + Nome do Piloto + Tempo da Última Volta + Melhor Volta. Botões de ação da prova (Bandeira Amarela, Vermelha, Xadrez) ficam separados visualmente da tabela de tempos.

---

### 5. Lei de Miller (Chunking)
> *A capacidade média da memória de trabalho humana é de 7 (± 2) blocos de informação.*

- **Reservas & Totem:** Não exibir 30 horários soltos em lista corrida. Agrupar em blocos temáticos:
  - *Manhã (09:00 às 12:00)*
  - *Tarde (14:00 às 18:00)*
  - *Noite (18:00 às 22:00)*
- **Formulários:** Quebrar formulários longos em blocos de no máximo 4 a 5 campos visíveis por seção.
- **Resultados no Mobile:** Exibir o top 5 destacado no pódio e o restante paginado ou agrupado em blocos expansíveis.

---

### 6. Limiar de Doherty (Doherty Threshold)
> *A produtividade do usuário aumenta drasticamente quando o tempo de resposta do sistema é inferior a 400 milissegundos.*

- **Busca no SRVKART (`:4060`):** Debounce de 250ms na digitação de busca por CPF/Nome no banco SQL Server `KartodromoOps` (utilizando os índices otimizados da migration `0017`).
- **Feedback Imediato:** Estado de clique (*pressed/active state*) imediato no mouse e teclado, prevenindo a sensação de app "travado".
- **Totem:** Transição instantânea de tela ao digitar o 11º dígito do CPF válido, sem exigir que o cliente procure o botão "Buscar".
- **Reservas Web:** Polling da agenda a cada 5 segundos feito em background **sem piscar a tela** (esqueleto animado apenas no carregamento inicial da página).

---

### 7. Efeito Von Restorff (Efeito de Isolamento)
> *Quando múltiplos itens homogêneos estão presentes, aquele que difere visualmente atrai mais atenção e é lembrado com mais facilidade.*

- **Melhor Volta da Bateria:** Destaque exclusivo em todo o sistema (texto em verde neon `#00ff7a` ou roxo brilhante com ícone de cronômetro).
- **Reservas Web:** A bateria com menor número de vagas disponíveis recebe selo visual de urgência (*"Últimas 2 vagas"*).
- **Recepção:** Piloto com pendência de termo ou menor de idade sem responsável cadastrado recebe destaque em laranja/vermelho com ícone de alerta no grid de conferência.

---

### 8. Lei de Fitts (Distância e Trajetória)
> *Minimizar o percurso físico que a mão, cursor ou olhar deve percorrer para concluir uma ação.*

- **Mobile:** Manter o fluxo de compra e navegação primária (Tabs: Agenda, Reservas, Ao Vivo, Ranking) nos 30% inferiores da tela (*Thumb Zone*).
- **Recepção:** No fechamento de caixa ou venda de bateria, o cursor salta automaticamente para o campo de valor/forma de pagamento após a seleção do cliente.
- **Totem:** O botão [AVANÇAR / CONFIRMAR] fica centralizado abaixo dos campos de digitação, permitindo conferência visual e confirmação sem desvio de olhar.

---

### 9. Efeito de Posição Serial (Primacy & Recency)
> *Usuários memorizam com maior facilidade o primeiro item (primazia) e o último item (recência) de uma série.*

- **Resultados de Corrida (Mobile e Recepção):** Destaque máximo para o P1 (primeiro lugar) no topo da visualização e para a posição individual do piloto logado no cartão fixo na base.
- **Menu da Recepção:** Manter as rotas mais críticas nos extremos da barra de ferramentas (Clientes/Vendas no início; Fechamento de Caixa/Sair no final).

---

### 10. Regra do Pico-Fim (Peak-End Rule)
> *O julgamento global de uma experiência depende do momento mais intenso (pico) e do momento final (desfecho).*

- **Totem (Desfecho Claro):** Ao concluir a pré-reserva, exibir tela de sucesso amigável:
  > *"Pré-reserva confirmada! Seu termo de responsabilidade está sendo impresso na Recepção. Por favor, dirija-se ao balcão para assinar e garantir seu kart."*
- **Mobile (Pico da Experiência):** Após o encerramento da corrida, o app exibe uma tela comemorativa com a bandeira quadriculada, tempo da sua melhor volta, ganho de posições e botão de compartilhamento com imagem formatada para Instagram Stories.

---

### 11. Efeito Zeigarnik
> *Tarefas incompletas retêm a atenção e geram motivação para serem finalizadas.*

- **Reservas Web:** Indicador de etapas numerado no topo da página (*Passo 2 de 4: Quem vai pilotar*).
- **Pré-Cadastro Online:** Barra de progresso visível com salvamento automático de rascunho: *"Seu cadastro está 75% concluído. Falta apenas preencher seus dados de contato."*.

---

### 12. Navalha de Occam
> *A simplicidade deve prevalecer; elimine qualquer elemento visual ou estrutural que não seja estritamente necessário.*

- **Totem:** Sem links externos, sem rodapés corporativos, sem banners publicitários giratórios. Apenas o logo oficial do kartódromo, mensagem de boas-vindas e o fluxo de identificação.
- **Recepção:** Grids com colunas focadas no que a recepcionista precisa no momento da fila (Nome, Categoria, Kart, Status do Termo, Pagamento). Detalhes avançados abrem em janela modal auxiliar quando solicitados.

---

### 13. Lei de Tesler (Conservação da Complexidade)
> *Todo sistema possui um nível inerente de complexidade que não pode ser eliminado; ele deve ser absorvido pelo software para aliviar o usuário.*

- **Cálculo de Lastro e Equalização:** O operador da cronometragem ou recepcionista não calcula peso manualmente. O sistema cruza o peso cadastrado do piloto com o peso mínimo da categoria (ex: 85 kg ou 95 kg) e indica exatamente quantas barras de lastro colocar no kart.
- **Impressão de Termos em Rede:** O totem não tem impressora local; o backend Node.js (`services/ops-server.ts`) recebe o pedido, valida a assinatura HMAC, enfileira e o agente local da Recepção imprime sem intervenção manual do cliente.

---

### 14. Lei de Postel (Princípio da Robustez)
> *Seja liberal no que aceita e conservador no que produz.*

- **Entrada de CPF:** Aceitar digitação com máscara (`123.456.789-00`) ou números puros (`12345678900`), limpando caracteres não numéricos automaticamente via `onlyDigits()`.
- **Telefone:** Aceitar formatos com código de país, DDD, com ou sem parênteses e hifens.
- **Nomes Próprios:** Normalização automática de caixa alta/baixa e espaços duplicados através da função `nomeProprio()`.
- **E-mails:** Aplicação do corretor de domínios comuns (ex: corrigir `@gmai.com` para `@gmail.com` via `corrigeEmail()`).

---

### 15. Lei de Murphy (Prevenção e Tratamento Ativo de Falhas)
> *Se algo puder dar errado, dará.*

- **Prevenção de Duplo Clique / Cobrança Duplicada:** Botões de checkout Pix e confirmação de reserva desabilitam-se imediatamente no primeiro clique (*isSubmitting* / debounce estrito).
- **Ações Destrutivas com Confirmação:** No app de Cronometragem, ações irreversíveis (desclassificar piloto, cancelar bateria, reiniciar telemetria) exigem confirmação explícita com tecla de atalho dedicada ou diálogo modal com foco padrão em "Cancelar".
- **Resiliência a Falhas de Rede:** Se a conexão entre o app Desktop e o SRVKART (`192.168.20.13:4060`) oscilar, o app exibe badge de alerta discreto na barra de status e tenta reconectar com backoff exponencial sem congelar a interface do operador.

---

### 16. Lei da Semelhança (Gestalt)
> *Elementos com características visuais semelhantes (cor, formato, tipografia) são interpretados como tendo o mesmo significado funcional.*

- **Design System Coerente nos Apps e Web:**
  - **Botão Primário de Ação:** Fundo verde neon Betim `#00ff7a` (no site) ou Dourado/Amarelo Racing (nos apps desktop), texto escuro em alto contraste, cantos arredondados padronizados.
  - **Botão de Atenção / Parada:** Fundo vermelho `#ff3b30`, reservado exclusivamente para cancelamentos, exclusões ou bandeiramento de interrupção.
  - **Botão Secundário:** Fundo transparente com borda discreta para ações de "Voltar" ou "Limpar".

---

### 17. Conectividade Uniforme (Gestalt)
> *Elementos visualmente conectados por linhas, fundos contínuos ou caixas delimitadoras são percebidos como uma unidade mais coesa do que elementos isolados.*

- **Cards de Baterias Disponíveis:** O horário de largada, quantidade de vagas restantes, categoria de kart e botão de inscrição são delimitados por um único container com fundo escuro elevado e borda sutil.
- **Linha do Tempo de Sessões:** No painel da cronometragem, as baterias em fila são dispostas visualmente sobre uma linha de conexão cronológica indicando o status atual (*Encerrada*, *Em Andamento*, *Próxima*).

---

### 18. Lei de Parkinson
> *O tempo necessário para concluir uma tarefa tende a se expandir até preencher todo o tempo disponível.*

- **Reserva de Vagas Online:** Temporizador de expiração visível na tela de checkout (*"Sua vaga está reservada por 10:00 minutos para conclusão do pagamento"*). Isso evita retenção indevida de vagas e acelera a taxa de conversão.
- **Timeout de Ociosidade no Totem:** O app `Kartodromo.Autoatendimento` possui timer estrito de **90 segundos sem atividade** (`_ocioso.Interval = 90_000`). Se o cliente abandonar a tela no meio do processo, o sistema limpa os dados da memória e retorna à tela inicial de identificação, garantindo a privacidade (LGPD) e liberando o totem para o próximo piloto da fila.

---

### 19. Redução da Carga Cognitiva (Cognitive Load)
> *Reduzir o esforço mental exigido para processar informações e executar rotinas críticas.*

- **Recepção em Horário de Pico (Sábados/Domingos):** Operadoras atendem sob pressão de fila física. As telas priorizam contraste máximo, fontes legíveis (14px+), feedback por cores universais (verde para liberado, amarelo para pendente, vermelho para bloqueado) e atalhos rápidos de teclado.
- **Totem:** Como não há teclado virtual nem toque em tela, a interface apresenta instruções simples e diretas: *"Digite seu CPF no teclado abaixo"*.

---

### 20. Efeito Gradiente de Meta (Goal Gradient Effect)
> *A motivação e o esforço do usuário aumentam conforme ele percebe que está próximo de atingir seu objetivo.*

- **Pré-Cadastro com CPF Reconhecido:** Quando o cliente digita o CPF no totem ou site e o banco SQL Server já localiza o cadastro prévio, a tela exibe: *"Bem-vindo de volta, [Nome]! Quase pronto para correr."*, iniciando a barra de progresso em 75%.
- **Programa de Fidelidade no App Mobile:** Exibição visual da meta de corridas: *"Você completou 8 baterias nesta temporada. Faltam apenas 2 corridas para atingir a Categoria Graduados!"*.
