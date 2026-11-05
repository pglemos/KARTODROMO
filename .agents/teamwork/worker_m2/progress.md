# Progress — Worker M2 (Implementação R2: Segurança, Privacidade e LGPD)

Last visited: 2026-10-26T22:26:00Z

## Status
Iniciando implementação dos 5 blocos da Milestone M2.

## Etapas de Trabalho
- [ ] 1. Investigar arquivos alvo e estado atual do código (`services/ops-server.ts`, `lib/ops/db.ts`, `desktop/src/Kartodromo.Comum/Api.cs`, `desktop/src/Kartodromo.Comum/ValidacaoCliente.cs`, `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`, `desktop/src/Kartodromo.Autoatendimento/Program.cs`)
- [ ] 2. Criar migration `migrations/ops/0012_lgpd_menor.sql` e atualizar tipos/queries em `lib/ops/db.ts`
- [ ] 3. Implementar mascaramento PII refinado, proteção de menores, funções de emissão/validação de `totemToken` (HMAC), e identificação por sessão em `services/ops-server.ts`
- [ ] 4. Atualizar rotas `/api/totem/identificar` e `/api/totem/cadastro` com validação de idade, consentimento LGPD Art. 14 de menor e emissão de `totemToken`
- [ ] 5. Implementar suporte a `X-Totem-Session` e `X-Totem-Id` em `desktop/src/Kartodromo.Comum/Api.cs` e integração em `FormTotem.cs`
- [ ] 6. Implementar `desktop/src/Kartodromo.Autoatendimento/BloqueioTeclasKiosk.cs` e plugar em `Program.cs` / `FormTotem.cs`
- [ ] 7. Adicionar checkbox de consentimento LGPD Art. 14 e modal em `FormTotem.cs` (TelaCadastroMenor e TelaCadastro) e proteger visualização de dependentes
- [ ] 8. Criar suíte de testes `tests/ops/totem-seguranca.test.ts`
- [ ] 9. Executar testes vitest e typecheck (`npx tsc --noEmit`)
- [ ] 10. Atualizar BRIEFING.md, gerar handoff.md e notificar o orquestrador
