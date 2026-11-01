# BRIEFING — 2026-10-26T22:12:00Z

## Mission
Investigar e desenhar a arquitetura técnica para mascaramento de PII em `/api/totem/identificar`, proteção de dados de menores, eliminação do acoplamento com IP de socket (`identificadoNoTotem`) e introdução de tokens seguros de sessão de totem (Itens 7, 8 e 9 da Milestone M2).

## 🔒 My Identity
- Archetype: explorer
- Roles: investigator, synthesizer
- Working directory: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_1
- Original parent: 42a5e4fc-3e76-480a-9095-8d141e42fba1
- Milestone: M2 (R2: Segurança, Privacidade e LGPD)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement in production/source code directly
- Responder sempre em pt-BR
- Totem sem teclado na tela
- Não mexer no telão (`FormTV` / `--tv`)
- Testes apenas sem afetar produção
- Saídas e relatórios no diretório `.agents/teamwork/explorer_m2_1/`

## Current Parent
- Conversation ID: 42a5e4fc-3e76-480a-9095-8d141e42fba1
- Updated: 2026-10-26T22:21:00Z

## Investigation State
- **Explored paths**:
  - `services/ops-server.ts`: Rotas `/api/totem/identificar`, `/api/totem/cadastro`, `/api/totem/baterias`, `/api/totem/inscrever`, helpers `mascarar*`, `donoNoTotem`, `origemDe`, `identificadoNoTotem`.
  - `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`: Fluxos `Ir()`, `TelaIdent()`, `TelaCadastro()`, `TelaMenores()`, `TelaBaterias()`, `Reiniciar()`.
  - `desktop/src/Kartodromo.Comum/Api.cs`, `ValidacaoCliente.cs`, `Fmt.cs`: Cliente HTTP, validações e manipulação de máscaras.
  - `lib/ops/db.ts` e `lib/ops/reserva-online.ts`: `vagaOnlineDoGrupo()`, `updateCliente()` e persistência.
  - `tests/ops/m2-backend.test.ts`: Suíte de 21 testes Vitest para M2 (100% passando).
- **Key findings**:
  1. CPF expunha 3 dígitos iniciais e finais (`123.***.***-00`) em vez do padrão solicitado `***.456.789-**`.
  2. E-mail e telefone estavam com formatos que ocultavam DDD (`(**) *****-1234`) ou não atendiam ao formato `p***o@g***.com` e `(31) 9****-1234`.
  3. `nascimento` em `cliente` vazava data completa (`YYYY-MM-DD`) em quiosque público sem autenticação.
  4. Dependentes menores (`dependentes`) tinham nome completo e data de nascimento vazados sem restrição, violando o Art. 14 da LGPD.
  5. Acoplamento frágil com IP de socket (`identificadoNoTotem`) sofria de colisões por NAT/proxy e vazamento de vagas para o próximo cliente (TTL de 15 min no IP).
  6. Desenvolvida arquitetura completa com token de sessão HMAC `totemToken` / `X-Totem-Session`, eliminação de IPs hardcoded via `X-Client-Machine` / `X-Totem-Id` e fallback retrocompatível.
- **Unexplored areas**: Nenhuma pendente dentro do escopo dos Itens 7, 8 e 9.

## Key Decisions Made
- [Item 7] Padronizar máscaras para `***.456.789-**`, `p***o@g***.com`, `(31) 9****-1234`, endereço com logradouro mascarado e número/complemento vazios. Descartar campos com `*` em `POST /api/totem/cadastro` para não sobrescrever dados reais no banco.
- [Item 8] Condicionar envio de `dependentes` à marcação de responsável por menor (`body.menor`); mascarar nomes de dependentes (`Lucas H.***`) e ocultar dia/mês de nascimento (`YYYY-01-01` ou apenas idade/ano).
- [Item 9] Implementar `totemToken` assinado via HMAC (`${cid}:${totemId}:${agora}:${exp}:${nonce}:${sig}`) com TTL de 15 min, desacoplando `donoNoTotem` de `req.socket.remoteAddress`, e usando `X-Client-Machine` / `X-Totem-Id` em `origemDe`.

## Artifact Index
- DISPATCH.md — Diretrizes e missões recebidas
- BRIEFING.md — Memória de trabalho persistente
- progress.md — Heartbeat de execução
- handoff.md — Relatório técnico final de entrega (Itens 7, 8 e 9 da M2)

