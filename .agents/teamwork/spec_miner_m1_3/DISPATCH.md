# DISPATCH — Spec Miner M1 3

## Milestone M1: R1 — Impressão e Gestão de Termos de Responsabilidade (Itens 1 a 6)

### Documentos Autoritativos e Código
- `docs/operacao/HANDOFF-SISTEMA-PROPRIO.md` (seções de impressoras, totens e recepção)
- `lib/ops/termo.ts` e `tests/ops/termo.test.ts`
- `services/ops-server.ts` (rotas `/api/office/impressao/*`)
- `desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs` (como a recepção consome os trabalhos de impressão)

### Escopo e Missão
1. Investigar a integração ponta a ponta entre a geração do termo no totem/backend e o consumo pelo `AgenteImpressao.cs` da Recepção (.53).
2. Mapear o contrato da API (`GET /api/office/impressao/proxima`, `POST /api/office/impressao/:id/feita`, `POST /api/office/impressao/:id/falhou`) para assegurar que a recepção continue funcionando sem qualquer alteração binária ou quebra de protocolo.
3. Especificar os parâmetros exatos do corte térmico na Epson TM-T20 e o teste correspondente.
4. Fornecer os critérios de aceitação e integridade para M1.

Gere seu relatório em: `.agents/teamwork/spec_miner_m1_3/handoff.md`.

## 2026-10-26T19:26:40Z
Você é o Spec Miner de Contratos e Integração para a Milestone M1 (Impressão e Gestão de Termos).
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_m1_3

Você DEVE ler o arquivo da solicitação original do usuário:
/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (consulte a seção sob o timestamp 2026-10-26T19:04:37Z).

Consulte também:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2/PROJECT_TOTEM.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_m1_3/DISPATCH.md
- docs/operacao/HANDOFF-SISTEMA-PROPRIO.md
- desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs
- services/ops-server.ts (endpoints `/api/office/impressao/*`)

Sua tarefa:
1. Mapear o contrato estrito de endpoints de impressão consumidos pelo `AgenteImpressao.cs` da Recepção (.53).
2. Garantir que as alterações em `services/ops-server.ts` preservem 100% da compatibilidade com o formato JSON esperado pelo app da Recepção:
   - `GET /api/office/impressao/proxima`
   - `POST /api/office/impressao/:id/feita`
   - `POST /api/office/impressao/:id/falhou`
   - `GET /api/office/impressao/fila`
3. Definir os critérios de teste e conformidade com as regras do dono (AGENTS.md).

Escreva seu relatório em:
/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_m1_3/handoff.md

Ao concluir, envie uma mensagem para o orquestrador (parent).
