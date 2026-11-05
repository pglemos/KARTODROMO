## 2026-10-27T02:59:57Z
Você é o subagente Explorer (teamwork_preview_explorer) para a Milestone M3 (R3: Validação de Dados e Cadastro no Totem - Itens 12 a 19).
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_totem_m3_1/
Leia obrigatoriamente:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (seção 2026-10-26T19:04:37Z, requisitos R3)
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/PROJECT_TOTEM.md (Itens 12 a 19)

Sua missão de exploração técnica focada no Desktop WinForms C# do Totem:
1. Inspecionar desktop/src/Kartodromo.Autoatendimento/FormTotem.cs, Controles.cs, desktop/src/Kartodromo.Comum/ValidacaoCliente.cs e Ui.cs.
2. Verificar como estão implementados ou se faltam ajustes no Totem para:
   - Item 12: Instagram opcional / opção explícita no Totem.
   - Item 13: Telefone internacional / turistas com passaporte (validação e máscara).
   - Item 14: Faixa de peso no Totem (verificar se valida 10–250 kg).
   - Item 16: Edição assistida de cadastro (ajuste seguro de nome e documento de cliente pré-existente).
   - Item 17: Tratamento elegante de HTTP 409 (preservar campos já preenchidos caso documento já exista).
   - Item 18: Correção do cursor em máscaras (garantir preservação de posição durante digitação).
3. Identificar exatamente quais linhas/métodos precisam ser modificados pelo Worker.
4. NÃO modifique arquivos de código-fonte.
5. Escreva seu relatório em /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_totem_m3_1/handoff.md e envie uma notificação via send_message com o resumo de suas conclusões.
