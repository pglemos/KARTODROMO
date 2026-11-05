# BRIEFING — 2026-11-02T20:13:00Z

## Mission
Investigar a arquitetura do codebase em /Users/pedroguilherme/PROJETOS/kartodromo-operacional, cobrindo Falhas R1 (01 a 07 e 39 a 45), dependências e infraestrutura de testes.

## 🔒 My Identity
- Archetype: explorer
- Roles: Codebase Architecture Explorer
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_survey_app_arch_1
- Original parent: 88cadb65-7d49-4f0d-a278-9c17ee4251ab
- Milestone: survey_app_arch

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Responder sempre em pt-BR
- Não modificar código em kartodromo-operacional nem outros projetos

## Current Parent
- Conversation ID: 88cadb65-7d49-4f0d-a278-9c17ee4251ab
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `package.json`, `jest.config.js`, `tsconfig.json`
  - `src/core/api/cliente.ts`
  - `src/core/realtime/stream.ts`
  - `src/core/realtime/estado.ts`
  - `src/core/security/cofre.ts`
  - `src/features/auth/sessao.tsx`
  - `src/app/_layout.tsx`, `src/app/index.tsx`
  - `src/app/usuarios.tsx`, `src/app/conta.tsx`, `src/app/historico.tsx`, `src/app/dono.tsx`
  - `src/features/operacao/formato.ts`, `src/features/operacao/baterias.ts`
  - `tests/tempo-real.test.ts`, `tests/cliente.test.ts`, `tests/baterias.test.ts`, `tests/sorteio.test.ts`
- **Key findings**:
  - Falha 01: `baseSegura` rejeita IPs privados RFC 1918 em release mode; `sessao.tsx` lança exceção em nível de módulo quando `BASE` é vazia ou insegura, derrubando o app antes do render.
  - Falha 02: `get` renova token em 401, mas `postar` e `enviarOperacao` lançam erro direto sem chamar `renovar()`.
  - Falha 03: Strings fixas `'app-operacional'` e `'ipad-sim'` são usadas no login; inexiste geração e persistência de UUID por dispositivo em SecureStore.
  - Falha 04: `LeitorEventos` e `conectarFluxo` tratam `ping` e `heartbeat` como eventos desconhecidos, disparando `else return 'repetir'` e derrubando a conexão SSE em loop.
  - Falha 05: Regex `/^data: (.*)$/m` só extrai a primeira linha; múltiplos `data:` quebram `JSON.parse` gerando evento `'invalido'` e desconexão.
  - Falha 06: `f(...)` inicial de handshake do SSE não possui timeout de 5 segundos, podendo travar indefinidamente.
  - Falha 39: `/usuarios` e `/dono` não implementam RBAC nem guardas de rota no componente; apenas links no `index.tsx` são ocultados.
  - Falha 40: `/usuarios` exibe botão de bloqueio inclusive para o usuário logado (`u.usuario === eu?.usuario`).
  - Falha 41: `/usuarios` e `/conta` possuem campo único de senha, sem campo de confirmação.
  - Falha 42: `FILTROS` em `/historico` não inclui `'weight-check'` (Lastro) nem `'fleet'` (Frota).
  - Falha 43: `/historico` usa `ScrollView` com `.map()` não virtualizado e sem paginação.
  - Falha 44: `/conta` não desloga nem redireciona ao login após trocar a própria senha.
  - Falha 45: `formato.ts`, `historico.tsx`, `dono.tsx` e `index.tsx` não especificam `timeZone: 'America/Sao_Paulo'`, gerando desvios de horário conforme o fuso do SO.
  - Suíte de testes: Jest + `jest-expo` com 4 suítes e 29 testes passando em ~0.25s; typecheck limpo.
- **Unexplored areas**: Nenhuma pendente dentro do escopo designado.

## Key Decisions Made
- Estruturar o relatório handoff.md rigorosamente no padrão de 5 componentes (Observation, Logic Chain, Caveats, Conclusion, Verification Method).

## Artifact Index
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_survey_app_arch_1/DISPATCH.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_survey_app_arch_1/BRIEFING.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_survey_app_arch_1/progress.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_survey_app_arch_1/handoff.md
