# BRIEFING — 2026-11-02T20:25:00Z

## Mission
Investigação detalhada de código e desenho exato de patches para M1 Parte 2 (Falhas 39 a 45) do app operacional.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_2
- Original parent: 88cadb65-7d49-4f0d-a278-9c17ee4251ab
- Milestone: M1 Part 2 (Falhas 39 a 45)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Responder sempre em pt-BR
- Regras operacionais do kartódromo em docs/operacao/HANDOFF-SISTEMA-PROPRIO.md
- Especificar patches exatos, no nível de linha, para o Worker

## Current Parent
- Conversation ID: 88cadb65-7d49-4f0d-a278-9c17ee4251ab
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `src/features/operacao/formato.ts`: análise de formatação e ausência de timezone America/Sao_Paulo
  - `src/app/usuarios.tsx`: análise de ausência de RBAC, auto-bloqueio e confirmação de senha
  - `src/app/dono.tsx`: análise de ausência de RBAC, polling indevido, filtros e fuso horário
  - `src/app/conta.tsx`: análise de confirmação de senha, fluxo de logout com aviso e redirecionamento
  - `src/app/historico.tsx`: análise de ausência de filtros (weight-check, fleet), virtualização FlatList e paginação
  - `src/app/index.tsx`: análise de slice(11, 16) em horários de agenda
  - `src/features/auth/sessao.tsx`: verificação dos tipos Eu, useSessao, sair()
  - `src/core/api/cliente.ts`: verificação de cliente.encerrar()
  - `tests/`: análise dos testes existentes e criação planejada de `tests/formato.test.ts`
- **Key findings**:
  - Falha 39: `/usuarios` e `/dono` não validam perfil `GERENCIA`, executando chamadas de API e polling sem restrição.
  - Falha 40: Em `/usuarios`, o usuário conectado pode clicar em "Bloquear" na sua própria linha.
  - Falha 41: Nem `/usuarios` (criação) nem `/conta` (alteração) possuem campo para confirmação de senha.
  - Falha 42: `FILTROS` em `/historico` omite `weight-check` e `fleet`, embora estejam presentes no mapa de nomes.
  - Falha 43: `/historico` usa `ScrollView` com renderização total em `.map()`, sem virtualização ou paginação.
  - Falha 44: Em `/conta`, a troca de senha bem-sucedida apenas mostra um banner sem encerrar a sessão local nem redirecionar ao login.
  - Falha 45: `minutos`, `hora`, `toLocaleString` e `slice(11, 16)` não usam `timeZone: 'America/Sao_Paulo'`, gerando desvios de até 3 horas em dispositivos configurados em UTC.
- **Unexplored areas**: Nenhuma pendente no escopo de M1 Parte 2.

## Key Decisions Made
- Centralizar todo o tratamento de fuso horário em `src/features/operacao/formato.ts` com `FUSO_HORARIO = 'America/Sao_Paulo'`.
- Na guarda RBAC em `/usuarios` e `/dono`, renderizar tela explicativa amigável "Apenas Gerência" e botão de retorno, além de abortar chamadas e timers da API caso o perfil não seja `GERENCIA`.
- No auto-bloqueio, substituir o botão de ação por badge `<Selo texto="SUA CONTA" tom="neutro" />` e adicionar tag visual `<Selo texto="VOCÊ" tom="verde" />`.
- Na troca de senha em `/conta`, fornecer feedback visual imediato ("Senha alterada"), desativar botão, e após 2 segundos chamar `sair()` e `router.replace('/')`.
- No `/historico`, migrar para `FlatList` com `numColumns={tablet ? 2 : 1}`, paginação por lotes de 25 itens (`onEndReached`), e inclusão dos filtros `'weight-check'` e `'fleet'`.

## Artifact Index
- DISPATCH.md — Mensagem recebida do orchestrator
- BRIEFING.md — Memória de trabalho
- progress.md — Heartbeat de progresso
- handoff.md — Relatório completo de handoff (5 componentes) com patches exatos
