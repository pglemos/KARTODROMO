## 2026-10-27T02:59:57Z
Você é o subagente Explorer (teamwork_preview_explorer) para a Milestone M3 (R3: Validação de Dados e Cadastro no Totem - Itens 12 a 19).
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_totem_m3_2/
Leia obrigatoriamente:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (seção 2026-10-26T19:04:37Z, requisitos R3)
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/PROJECT_TOTEM.md (Itens 12 a 19)

Sua missão de exploração técnica focada no Backend e Banco de Dados:
1. Inspecionar services/ops-server.ts, lib/ops/cadastro-obrigatorio.ts, lib/ops/instagram.ts, lib/ops/totem-baterias.ts e lib/ops/db.ts.
2. Verificar como estão implementados no backend para o Totem:
   - Item 12: Aceitação de Instagram opcional (semInstagram ou campo vazio) no POST /api/totem/cadastro.
   - Item 13: Validação de telefone internacional no backend.
   - Item 14: Harmonização de peso no backend (erroPesoCliente em cadastro-obrigatorio.ts).
   - Item 15: Preservação de Numero e Complemento em POST /api/totem/cadastro (garantir que não haja sobrescrita destrutiva).
   - Item 17: Resposta de HTTP 409 em /api/totem/cadastro (retornar identificador/token para permitir reaproveitamento sem limpar).
   - Item 19: Parametrização SQL estrita de consultas em /api/totem/baterias (eliminar interpolação de strings).
3. Mapear testes existentes em tests/ops/ e quais novos testes o Worker precisará escrever para cobrir a Milestone M3 do Totem.
4. NÃO modifique arquivos de código-fonte.
5. Escreva seu relatório em /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_totem_m3_2/handoff.md e envie uma notificação via send_message com o resumo de suas conclusões.
