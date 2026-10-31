# Plano de Execução — Autoatendimento (Totem Kartódromo de Betim)

## 1. Visão Geral e Arquitetura do Sistema
O sistema de autoatendimento é composto por:
- **Cliente Kiosk Desktop (.NET 8 WinForms)**: Localizado em `desktop/src/Kartodromo.Autoatendimento/` e `desktop/src/Kartodromo.Comum/`, operando em modo Kiosk em totens touch sem teclado virtual, com teclado físico USB e monitor nas resoluções 1366x768 e 1920x1080.
- **Servidor Operacional de Backend (Node.js/TypeScript)**: `services/ops-server.ts`, `lib/ops/`, provendo endpoints REST/Socket para identificação, cadastro, baterias, pré-reservas e fila de impressão.
- **Banco de Dados Relacional**: SQL Server (tabelas de clientes, baterias, termos, fila de impressão).
- **Scripts de Infraestrutura e Implantação**: Localizados em `scripts/apps/`.

## 2. Estratégia em Fases

### Fase 0: Survey Exploratório e Feature Inventory (3 Explorers / Spec Miners Paralelos)
Objetivo: Mapear o estado atual do código, arquivos afetados, causas-raiz dos 39 itens e documentar em `PROJECT_TOTEM.md`.
- **Explorer 1 (Backend & DB)**: Investigar `services/ops-server.ts`, rotas de totem, persistência da fila de impressão no banco, mascaramento PII LGPD, parâmetros SQL, concorrência de vagas, integração com ViaCep e socket.
- **Explorer 2 (Desktop WinForms & Kiosk UX)**: Investigar `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`, regras de foco/teclado USB, bloqueio de escape de teclas do sistema (Win/Alt+Tab), layout dinâmico de impressão, máscaras de telefone/cursor, Instagram opcional, seleção de dependentes e tratamento de diálogos/timer de inatividade.
- **Explorer 3 (Infraestrutura, Hardware, Autoteste & Scripts)**: Investigar scripts PowerShell (`scripts/apps/`), spooler de impressão de totens, rotinas de inicialização assíncrona, autoteste visual (1366x768 / 1920x1080), vazamentos de memória GDI e sincronização NTP.

### Fase 1: Decomposição e Execução em Milestones
Após consolidação do Survey em `PROJECT_TOTEM.md`:
- **Milestone M1 (R1 - Impressão e Gestão de Termos de Responsabilidade - Itens 1 a 6)**
  - Tabela/persistência de trabalhos de impressão em banco de dados; desacoplamento da RAM.
  - Contingência quando recepção estiver fechada; status sem descarte silencioso.
  - Bloqueio de impressão local sem impressora configurada + aviso em tela.
  - Altura dinâmica na TM-T20 para evitar desperdício de bobina.
  - Script de limpeza de filas fantasmas do spooler.
- **Milestone M2 (R2 - Segurança, Privacidade e LGPD - Itens 7 a 11)**
  - Mascaramento rigoroso de PII em `/api/totem/identificar` e telas públicas.
  - Token de sessão ou identificador configurável do totem (substituindo IPs hardcoded / socket IP).
  - Bloqueio de escape Kiosk (Win, Alt+Tab, Ctrl+Esc) via hook de teclado.
  - Termos explícitos e consentimento no cadastro de menores.
- **Milestone M3 (R3 - Validação de Dados e Cadastro no Totem - Itens 12 a 19)**
  - Instagram opcional / botão "Não possuo Instagram".
  - Validação internacional de celular/passaporte.
  - Harmonização de faixas de peso (Desktop vs Backend).
  - Preservação de Numero e Complemento no update de endereço.
  - Edição assistida de dados e tratamento de HTTP 409 sem perda de dados.
  - Correção de cursor na função Mascarar.
  - Parametrização SQL segura na rota de baterias.
- **Milestone M4 (R4 - Usabilidade, Hardware e Fluxo de Atendimento - Itens 20 a 27)**
  - Preservação da seleção de participantes entre telas.
  - Validação estrita de responsável por menor.
  - Timer de inatividade inteligente (90s): pausa em modais, suporte a toque/scroll.
  - Correção de foco pós-modal.
  - Foco contínuo para teclado USB físico, sem teclado virtual padrão, aviso se teclado desconectado.
- **Milestone M5 (R5 - Regras de Baterias, Agendamento e Concorrência - Itens 28 a 33)**
  - Bloqueio de pré-reserva de baterias com horário passado (remover tolerância indevida).
  - Mensagens claras de vagas insuficientes para grupos.
  - Exibição de horários/categorias na tela de sucesso.
  - Exibição clara de valores e categorias (Light vs Super).
  - Suporte a pagamento autônomo (QR Code Pix dinâmico).
  - Resolução de race condition da última vaga com reatualização amigável da grade.
- **Milestone M6 (R6 - Infraestrutura, Deploy, Rede e Ciclo de Vida - Itens 34 a 39)**
  - Correção de sintaxe em `habilitar-admin-remoto-totem1.ps1` e sincronização NTP.
  - Timeout HTTP resiliente (8-10s) para evitar congelamentos de UI.
  - `TratarInicioAsync` não bloqueante para eliminar tela preta.
  - Correção de vazamentos de GDI (ContextMenuStrip, bitmaps de logo).
  - Pool de conexões e cancelamento de requisições sobrepostas no ViaCep.
  - Persistência de atalho de inicialização em `implantar-remoto.ps1`.
- **Milestone M7 (E2E Test Suite & Adversarial Hardening)**
  - Testes vitest, typecheck tsc, build Release dotnet, autoteste visual de telas em 1366x768 e 1920x1080.
  - Verificação por Forensic Auditor para validação anti-cheat e conformidade total com AGENTS.md.

## 3. Protocolo de Cada Milestone (Loop Rigoroso)
Para cada milestone:
1. 3 Explorers mapeiam estratégia de correção técnica.
2. 1 Worker implementa as correções e roda build/testes.
3. 2 Reviewers revisam estritamente o código e testes.
4. 2 Challengers realizam testes adversariais e casos de borda.
5. 1 Forensic Auditor audita a integridade (veto binário se houver bypass ou mock indevido).
6. Gate check avalia e aprova a transição para a próxima milestone.
