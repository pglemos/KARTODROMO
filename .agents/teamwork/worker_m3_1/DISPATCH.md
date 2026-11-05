## 2026-10-26T22:41:19Z
Você é worker_m3_1.
Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m3_1

Você DEVE ler obrigatoriamente antes de iniciar qualquer trabalho:
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (leia primeiro!)
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_recepcao_gen2/PROJECT.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_desktop_survey_1/handoff.md
- /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/worker_m2_gen2/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Posse exclusiva de escrita (Write ownership):
- `desktop/src/Kartodromo.Comum/Relatorio.cs`
- `desktop/src/Kartodromo.Comum/Ui.cs`
- `desktop/src/Kartodromo.Comum/ValidacaoCliente.cs`
- `desktop/src/Kartodromo.Comum/Api.cs`
- `desktop/src/Kartodromo.Comum/Design.cs`
- `desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs`
- Testes em `tests/` relacionados ao desktop e periféricos

Missão:
Implementar a Milestone M3 (Desktop Comum & Periféricos) cobrindo todos os itens do inventário de recursos para M3:
1. Item 4: Polling Inteligente do Agente de Impressão (`AgenteImpressao.cs:21-30`):
   - Se a impressora configurada não existir localmente (`!existe`), NÃO iniciar o timer de polling nem consumir jobs da fila. Registrar log de aviso claro e definir `Situacao = "Impressora dos termos não encontrada"`.
2. Item 5: Timeout no WebView2 em Impressão Silenciosa (`Relatorio.cs:284-287`):
   - Adicionar timeout de segurança (ex: 15 segundos via `Task.WhenAny(carregou.Task, Task.Delay(15000))` ou CancellationToken) no carregamento de termos em `Relatorio.ImprimirSilencioso`. Se estourar timeout, lançar exceção informativa para não travar `_ocupado = true` para sempre.
3. Item 6: Tratamento de expiração de sessão (401) no Agente de Impressão (`AgenteImpressao.cs:64-66`):
   - Não exibir caixa de diálogo modal bloqueante (`Msg.Info`) na thread da UI. Em vez disso, atualizar o status visual `Situacao = "Sessão expirada (401) - faça login novamente"`, registrar log e permitir que o operador continue utilizando o sistema ou reautentique sem modal travando a tela.
4. Item 7: Guilhotinamento e corte de bobina na TM-T20X (`Relatorio.cs:289-294`):
   - Configurar `CoreWebView2PrintSettings` para não forçar tamanho A4 fixo e permitir corte dinâmico do papel.
5. Item 8 & 9: Monitoramento de spooler e saneamento de filas fantasma:
   - Adicionar rotina ou verificação para detectar impressora offline / sem papel e tratamento de erros no spooler.
6. Item 23: Correção de Cursor Jumping em Máscaras (`Ui.cs:232-244`):
   - No `TextChanged` de `Ui.Campos.Mascara`, calcular corretamente a nova posição do cursor (`SelectionStart`) preservando a contagem de dígitos ou a posição relativa antes e depois da formatação, evitando que o cursor seja resetado para a posição 0 durante a digitação.
7. Item 26: Flexibilização de Instagram (`ValidacaoCliente.cs:17-23`):
   - Tornar o Instagram opcional. Se a string for nula, vazia ou apenas espaços, retornar `null` (sem erro de validação). Validar apenas se preenchido.
8. Item 27: Harmonização de faixas de peso (`ValidacaoCliente.cs:42-50`):
   - Harmonizar a validação de peso para aceitar valores entre 10 kg e 250 kg (alinhado com o backend e totem).
9. Item 28: Redução de Timeout HTTP Resiliente (`Api.cs:53`):
   - Reduzir o timeout padrão do `HttpClient` de 30 segundos para 8 a 10 segundos, tornando o app muito mais ágil e resiliente em caso de instabilidade de rede no balcão.
10. Item 33: Eliminação de Vazamento Massivo de Regiões GDI (`Design.cs:45-50`):
    - Em `Forma.Recortar(Control c, int raio)`, antes de atribuir a nova região, armazenar a região anterior (`var antiga = c.Region;`) e fazer `antiga?.Dispose();` após a atribuição de `c.Region = new Region(path);`, eliminando o vazamento de handles HRGN no Windows.
11. Verificação:
    - Executar os testes automatizados existentes e criar testes unitários para as funções alteradas (`ValidacaoCliente`, `Ui.Campos.Mascara`, etc.).
    - Garantir que a compilação do projeto C# esteja sem erros de sintaxe ou referências.
    - Elaborar relatório handoff.md completo e notificar o orquestrador via send_message.
