# DISPATCH — Worker M2 (Implementação R2: Segurança, Privacidade e LGPD - Itens 7 a 11)
Você é o Worker de Implementação da Milestone M2.
Seu diretório de trabalho: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m2
Seu orquestrador: 42a5e4fc-3e76-480a-9095-8d141e42fba1

## Entradas Obrigatórias
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/PROJECT_TOTEM.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_1/handoff.md (Backend PII, Sessão e Tokens)
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_2/handoff.md (Desktop Kiosk Keyboard Hook)
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_3/handoff.md (LGPD Menores e Art. 14)

## Escopo da Implementação (Itens 7 a 11)

### 1. Mascaramento de PII e Proteção de Menores (Itens 7 e 8) em `services/ops-server.ts`
- Implementar mascaramento seguro em `/api/totem/identificar`:
  - CPF: `***.456.789-**`
  - E-mail: `p***o@g***.com` (ou `u***@***.com` se muito curto)
  - Telefone: `(31) 9****-1234`
  - Endereço: apenas logradouro abreviado, sem expor número e complemento
  - Nascimento: não retornar a data em texto claro para clientes na tela pública do totem
  - Dependentes: retornar lista de dependentes com nome mascarado ou primeiro nome + idade em anos, sem expor data completa de nascimento para a fila pública.

### 2. Token Seguro de Sessão de Totem (Item 9) em `services/ops-server.ts` e `desktop/src/Kartodromo.Comum/Api.cs`
- Eliminar o acoplamento frágil com IP de socket (`req.socket.remoteAddress`, `identificadoNoTotem`, IPs hardcoded 192.168.20.161/.69).
- Gerar token de sessão assinado HMAC (`totemToken`) em `/api/totem/identificar` e `/api/totem/cadastro`.
- O cliente desktop WinForms (`Api.cs` e `FormTotem.cs`) envia o header `X-Totem-Session` nas requisições subsequentes (`/api/totem/inscrever`, `/api/totem/cadastro`).
- Suportar identificador de máquina via header `X-Totem-Id` / `X-Client-Machine` configurável no `appsettings.json`, mantendo fallback gracioso.

### 3. Bloqueio de Teclas Kiosk no Teclado USB (Item 10) em C# WinForms
- Criar `desktop/src/Kartodromo.Autoatendimento/BloqueioTeclasKiosk.cs`:
  - Implementar Low-Level Keyboard Hook (`WH_KEYBOARD_LL = 13`).
  - Suprimir: WinKey (esquerda e direita), Alt+Tab, Alt+Esc, Ctrl+Esc, Ctrl+Shift+Esc, Alt+F4, teclas de contexto/menu.
  - Preservar: digitação alfanumérica normal, acentuação ABNT2 (AltGr), espaço, backspace, delete, tab, enter, setas e escape para diálogos.
  - Preservar atalho de equipe `Ctrl+Shift+Alt+S`.
  - Desativar automaticamente se argumento `--autoteste` for passado.
  - Instalar em `Program.cs` / `FormTotem` e desinstalar com segurança (`UnhookWindowsHookEx`) no fechamento do aplicativo.

### 4. Consentimento de Menores LGPD Art. 14 (Item 11)
- Criar migração SQL `migrations/ops/0012_lgpd_menor.sql` adicionando colunas de auditoria em `dbo.Cliente` (`LgpdMenorAceitoEm`, `LgpdMenorResponsavelId`) e tabela `dbo.TermoAceite` (idempotente com `IF NOT EXISTS`).
- No Backend (`services/ops-server.ts`):
  - No cadastro de menor (`responsavelId` presente), exigir obrigatoriamente `body.consentimentoMenor === true` e validar que a idade calculada é menor de 18 anos e >= 6 anos.
  - Bloquear cadastro de titular menor de 18 anos desacompanhado na tela de adultos.
- No Totem WinForms (`FormTotem.cs`):
  - Em `TelaCadastroMenor()`, adicionar checkbox com texto explícito de consentimento e link/botão para leitura do Termo de Consentimento de Menores.
  - Exigir marcação obrigatória do checkbox antes de permitir o envio ao backend.

### 5. Testes e Verificação
- Criar suíte de testes em `tests/ops/totem-seguranca.test.ts` validando PII mascarada, tokens HMAC de sessão, bloqueio de menor sem consentimento e migração 0012.
- Executar testes vitest: `npx vitest run tests/ops/`
- Executar verificação de tipos: `npx tsc --noEmit`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Ao concluir, documente tudo em `handoff.md` (Observation, Logic Chain, Caveats, Conclusion, Verification Method) e envie mensagem ao orquestrador.


## 2026-10-26T22:24:57Z
Você é o Worker de Implementação da Milestone M2 (R2: Segurança, Privacidade e LGPD - Itens 7 a 11).
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m2.
Leia atentamente seu DISPATCH em: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m2/DISPATCH.md
Consulte também:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/PROJECT_TOTEM.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_1/handoff.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_2/handoff.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m2_3/handoff.md

Implemente com rigor os Itens 7 a 11:
1. Mascaramento de PII e proteção de dados de menores em services/ops-server.ts.
2. Token seguro de sessão HMAC de totem e cabeçalhos em services/ops-server.ts e Api.cs, eliminando amarração por IP de socket.
3. Bloqueio de teclas Kiosk no WinForms USB com Low-Level Keyboard Hook (desktop/src/Kartodromo.Autoatendimento/BloqueioTeclasKiosk.cs e Program.cs).
4. Consentimento explícito de menores (LGPD Art. 14) com migration 0012, validação no backend e checkbox/termo no FormTotem.cs.
5. Crie a suíte de testes tests/ops/totem-seguranca.test.ts e valide com vitest.
