# BRIEFING — 2026-11-02T20:25:00Z

## Mission
Investigação detalhada de código e desenho exato de patch para M1 Parte 1 (Falhas 01 a 07): baseSegura, fallback de tela, auto JWT refresh, UUID persistente em SecureStore e correções do SSE stream.

## 🔒 My Identity
- Archetype: explorer
- Roles: Architecture, Connection, Auth Explorer
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_1
- Original parent: 88cadb65-7d49-4f0d-a278-9c17ee4251ab
- Milestone: M1 Part 1 (Falhas 01 a 07)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement in source code directly
- Responder sempre em pt-BR
- Produzir especificações linha a linha e patch design para o Worker em handoff.md
- Comunicação via send_message para o parent (88cadb65-7d49-4f0d-a278-9c17ee4251ab)

## Current Parent
- Conversation ID: 88cadb65-7d49-4f0d-a278-9c17ee4251ab
- Updated: 2026-11-02T20:19:38Z

## Investigation State
- **Explored paths**:
  - `src/core/api/cliente.ts`: Validação de `baseSegura`, auto-refresh em `postar` e `enviarOperacao`.
  - `src/features/auth/sessao.tsx`: Fallback de tela quando `EXPO_PUBLIC_API_URL` omitida, remoção de throw no escopo de módulo, injeção de deviceId persistente.
  - `src/core/security/cofre.ts`: Criação de `obterOuCriarDeviceId()` com geração UUID v4 e persistência em SecureStore.
  - `src/core/realtime/stream.ts`: Suporte a payloads W3C multiline `data:`, ignorar `ping`/`heartbeat`/comentários, timeout de 5s no handshake HTTP.
  - Suíte de testes: `tests/cliente.test.ts`, `tests/tempo-real.test.ts`.
- **Key findings**:
  - Falha 01: `baseSegura` rejeitava qualquer IP de rede local RFC 1918 em Release mode; `sessao.tsx` lançava `Error` no top-level antes do React montar se URL omitida.
  - Falha 02: Apenas `get` retentava com `renovar()`; `postar` e `enviarOperacao` falhavam imediatamente com 401.
  - Falha 03: `deviceId` estava fixado como `'app-operacional'` ou `'ipad-sim'`.
  - Falhas 04/05/06: SSE desconectava a cada ping recebido do backend; payloads multiline falhavam no JSON.parse; handshake não tinha timeout de 5s.
- **Unexplored areas**: Nenhuma no escopo de M1 Parte 1 (todas as 4 áreas foram mapeadas e especificadas com precisão de linha).

## Key Decisions Made
- `baseSegura` adotará regex rigorosa para faixas RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) e `localhost`/`127.0.0.1`, rejeitando domínios maliciosos.
- Fallback em `sessao.tsx` não lançará exceção no import, renderizando tela elegante e informativa de "Servidor Não Configurado".
- Auto-refresh em `postar` e `enviarOperacao` reutilizará `renovar()`, mantendo idempotência de `operationId`.
- `obterOuCriarDeviceId` em `cofre.ts` gerará UUID v4 compatível RFC 4122 e persistirá em chave separada no `SecureStore`.
- `LeitorEventos` acumulará todas as linhas `data:` de um bloco SSE com `\n` e ignorará `ping`/`heartbeat`, e `umaConexao` usará `setTimeout(5000)` com `AbortController` durante o handshake HTTP.

## Artifact Index
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_1/DISPATCH.md — Registro de despachos
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_1/progress.md — Heartbeat de progresso
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_1/BRIEFING.md — Memória de trabalho
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_1/handoff.md — Relatório de entrega com especificações linha a linha
