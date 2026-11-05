# DISPATCH — Spec Miner Totem Survey 1

## Tarefa
Realizar o levantamento aprofundado das especificações, regras de negócio, documentação e requisitos autoritativos para os 39 itens do sistema de autoatendimento do Kartódromo de Betim.

## Documentos Autorizativos a Inspecionar
- `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md` (seção de 2026-10-26T19:04:37Z)
- `/Users/pedroguilherme/PROJETOS/KARTODROMO/AGENTS.md`
- `/Users/pedroguilherme/PROJETOS/KARTODROMO/docs/operacao/HANDOFF-SISTEMA-PROPRIO.md`
- `/Users/pedroguilherme/PROJETOS/KARTODROMO/docs/operacao/patches-producao/README.md`
- Qualquer documentação em `docs/` e especificações de endpoints em `services/` e `lib/ops/`.

## Foco de Análise
1. Requisitos R1 (Impressão e Termos: persistência, contingência, spooler, altura dinâmica TM-T20).
2. Requisitos R2 (Segurança e LGPD: PII, tokens/sessão totem em vez de IP socket, termos de menores).
3. Requisitos R5 (Regras de Baterias: bloqueio de horário passado, concorrência, precificação, QR Code Pix).
4. Restrições do dono e compatibilidade com operação real do Kartódromo.

## Saída Esperada
Escreva seu relatório detalhado em `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_totem_survey_1/handoff.md`.
Registre seu progresso e batimentos em `progress.md`.
Ao concluir, envie mensagem para o orquestrador (parent).

## 2026-10-26T19:09:19Z
Você é o Spec Miner de Survey para o sistema de autoatendimento (totem) do Kartódromo de Betim.
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_totem_survey_1
Você DEVE ler o arquivo da solicitação original do usuário:
/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (consulte a seção sob o timestamp 2026-10-26T19:04:37Z).

Consulte também os seguintes arquivos autoritativos:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_totem_survey_1/DISPATCH.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/AGENTS.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/docs/operacao/HANDOFF-SISTEMA-PROPRIO.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/docs/operacao/patches-producao/README.md

Sua missão:
1. Mapear integralmente as regras operacionais, especificações de negócio e exigências da operação para os 39 itens do totem de autoatendimento (R1 a R6).
2. Detalhar as especificações críticas:
   - R1: Fila de impressão persistida em banco, modelo de contingência quando recepção estiver inativa, regras do spooler térmico TM-T20 e layout dinâmico.
   - R2: LGPD e PII no totem público, requisitos de consentimento de menores, substituição de amarração por IP socket por identificador/token seguro de totem.
   - R5: Regras de agendamento de baterias, corte estrito de horário passado, concorrência e race condition, especificação do Pix dinâmico e transparência de preços/categorias.
3. Garantir conformidade com as restrições inegociáveis do dono (AGENTS.md): responder em pt-BR, totem sem teclado virtual, não mexer em FormTV/--tv, app nativo Windows, simulação :4150 para cronometragem.

Gere seu relatório completo e estruturado em:
/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/spec_miner_totem_survey_1/handoff.md

Ao concluir, envie uma mensagem para o orquestrador (parent) com um resumo dos achados e confirmação da conclusão.
