# Handoff Report — Reviewer M3 (Desktop Comum & Periféricos)

## 1. Observation

Foi realizada a auditoria técnica independente, revisão adversarial de integridade e validação dos 10 itens técnicos da Milestone M3 implementados nos 6 arquivos C# do ecossistema Desktop Comum e Recepção:

1. **Item 4: Polling Inteligente do Agente de Impressão (`desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs:24-41`)**:
   - Tratamento de erro na enumeração de impressoras:
     ```csharp
     try { existe = PrinterSettings.InstalledPrinters.Cast<string>().Any(p => string.Equals(p, _impressora, StringComparison.OrdinalIgnoreCase)); }
     catch (Exception ex) { existe = false; Log($"ATENÇÃO: erro ao listar impressoras para '{_impressora}': {ex.Message}"); }
     if (!existe) {
         Situacao = "Impressora dos termos não encontrada";
         Log($"ATENÇÃO: impressora '{_impressora}' não existe neste computador. Polling de impressão não iniciado.");
         return;
     }
     ```
   - O `return;` precoce ocorre **antes** da criação e início do `System.Windows.Forms.Timer`, impedindo o polling inútil quando a impressora térmica não está presente.

2. **Item 5: Timeout no WebView2 em Impressão Silenciosa (`desktop/src/Kartodromo.Comum/Relatorio.cs:475-536`)**:
   - Timeout de 15s adicionado usando `Task.WhenAny`:
     ```csharp
     var timeoutTask = Task.Delay(TimeSpan.FromSeconds(15));
     var completou = await Task.WhenAny(carregou.Task, timeoutTask);
     web.CoreWebView2.NavigationCompleted -= OnNavCompleted;
     if (completou == timeoutTask)
         throw new TimeoutException($"Tempo limite de 15 segundos excedido ao carregar o termo para impressão silenciosa. URL: {url}");
     ```
   - Desinscrição explícita do handler de evento `NavigationCompleted -= OnNavCompleted`.
   - Recursos liberados deterministicamente em blocos `finally`: `host.Close()` e `_semImpressaoSilenciosa.Release()`.

3. **Item 6: Renovação de Sessão (401) sem Modal Bloqueante (`desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs:88-93`)**:
   - O diálogo modal intrusivo `Msg.Info(dono, ...)` foi completamente removido.
   - Tratamento específico para HTTP 401:
     ```csharp
     if (e is ApiException { Status: 401 }) {
         Situacao = "Sessão expirada (401) - faça login novamente";
         Log("Sessão expirada (401) ao buscar impressões. Operador precisa reautenticar.");
         _pausaAte = DateTime.Now.AddSeconds(30);
     }
     ```

4. **Item 7: Guilhotinamento e Corte de Bobina na TM-T20X (`desktop/src/Kartodromo.Comum/Relatorio.cs:501-522`)**:
   - Largura configurada exatamente para 80mm em polegadas (`80.0 / 25.4` in, ~3.15 pol).
   - Altura dinâmica calculada consultando o DOM:
     ```csharp
     var alturaPxStr = await web.CoreWebView2.ExecuteScriptAsync(
         "Math.max(document.body ? document.body.scrollHeight : 0, document.documentElement ? document.documentElement.scrollHeight : 0)");
     if (double.TryParse(alturaPxStr, NumberStyles.Float, CultureInfo.InvariantCulture, out var alturaPx) && alturaPx > 0) {
         cfg.PageWidth = 80.0 / 25.4;
         cfg.PageHeight = Math.Max(2.5, (alturaPx / 96.0) + 0.25);
     }
     ```
   - Elimina avanço desnecessário de 297mm (A4) na bobina térmica.

5. **Itens 8 & 9: Monitoramento de Spooler e Saneamento de Filas Fantasma (`desktop/src/Kartodromo.Comum/Relatorio.cs:294-443` e `AgenteImpressao.cs:57-64, 82`)**:
   - Métodos nativos P/Invoke em `winspool.drv`:
     - `VerificarSpooler(string impressora)`: inspeciona `PRINTER_INFO_2` e valida flags de offline (`0x80`), sem papel (`0x10`), atolamento (`0x08`), tampa aberta (`0x400000`), erro (`0x02`), pausada (`0x01`). Memória alocada via `Marshal.AllocHGlobal` e handles fechados com segurança em `finally`.
     - `LimparFilaSpooler(string impressora)`: aciona `SetPrinter` com comando `PRINTER_CONTROL_PURGE = 3`.
   - `AgenteImpressao.Rodada` checa o spooler antes de requisitar jobs do servidor e limpa a fila em caso de falha de impressão.

6. **Item 23: Correção de Cursor Jumping em Máscaras (`desktop/src/Kartodromo.Comum/Ui.cs:236-284`)**:
   - Método estático `CalcularCursorMascara`:
     ```csharp
     public static int CalcularCursorMascara(string antigoTexto, string novoTextoFormatado, int posicaoAntiga)
     ```
   - Rastreia a quantidade de caracteres alfanuméricos anteriores ao cursor e reposiciona o cursor após a mesma contagem no novo texto formatado.
   - Atualizado evento `TextChanged` em `Ui.Campos.Mascara` para preservar o cursor sem resetar para 0.

7. **Item 26: Flexibilização de Instagram (`desktop/src/Kartodromo.Comum/ValidacaoCliente.cs:17-23`)**:
   - `if (string.IsNullOrWhiteSpace(instagram)) return null;` — torna o Instagram opcional, mantendo a validação rígida de formato apenas quando preenchido.

8. **Item 27: Harmonização de Faixas de Peso (`desktop/src/Kartodromo.Comum/ValidacaoCliente.cs:38-40`)**:
   - Faixa de validação de peso ajustada para `kg >= 10 && kg <= 250`, compatível com pilotos infantis e adultos e alinhada ao backend (`cadastro-obrigatorio.ts`).

9. **Item 28: Redução de Timeout HTTP Resiliente (`desktop/src/Kartodromo.Comum/Api.cs:56-62`)**:
   - Timeout padrão do `HttpClient` reduzido de 30s para 10s (`timeout ?? TimeSpan.FromSeconds(10)`).
   - Exposta propriedade `public TimeSpan Timeout => _http.Timeout;`.
   - Headers de identificação adicionados (`X-Client-Machine`, `X-Totem-Id`, `X-Timing-Key`).

10. **Item 33: Eliminação de Vazamento Massivo de Regiões GDI (`desktop/src/Kartodromo.Comum/Design.cs:49-51, 79-81`)**:
    - Captura e descarte explícito da região antiga via `antiga?.Dispose()` em `Forma.Recortar` e `AjustarContorno`.

### Resultados da Execução de Comandos:
- `npx vitest run tests/desktop-m3-perifericos.test.ts`: **24/24 testes aprovados (100%)**.
- `npx vitest run tests/e2e-recepcao/`: **87/87 testes aprovados (100%) em 4 suítes**.
- `npx vitest run tests/desktop-*.test.ts`: **36/36 testes aprovados (100%) em 5 suítes**.
- `npx tsc --noEmit`: **0 erros de compilação/tipagem**.

---

## 2. Logic Chain

1. **Integridade e Ausência de Fachadas (Checklist Anti-Fraude)**:
   - Foram inspecionadas as implementações C# linha por linha: nenhum teste depende de respostas mockadas ou hardcoded embutidas no código-fonte.
   - O P/Invoke do spooler usa chamadas reais da API Win32 (`OpenPrinter`, `GetPrinter`, `SetPrinter`, `ClosePrinter`), com proteção por `RuntimeInformation.IsOSPlatform(OSPlatform.Windows)` para portabilidade em ambientes Unix de CI.
   - O cálculo do cursor em `Ui.cs` implementa um algoritmo O(N) robusto, validado tanto matematicamente quanto por testes comportamentais.
   - Não há atalhos ou facades: a lógica implementada atende integralmente a cada um dos requisitos da M3.

2. **Robustez Concorrente e Resiliência Operacional**:
   - `AgenteImpressao.cs`: o uso do semáforo `_semImpressaoSilenciosa` garante que chamadas concorrentes de impressão não interfiram entre si.
   - O timeout de 15 segundos no WebView2 evita que oscilações de renderização congelem indefinidamente o semáforo.
   - A remoção do diálogo modal `Msg.Info` em caso de HTTP 401 resolve o gargalo operacional no balcão da recepção, substituindo por aviso visual e repetição em 30 segundos.

3. **Conformidade de Contratos M2 ↔ M3**:
   - O backend em `services/ops-server.ts:820-827` fornece resposta retrocompatível contendo tanto `job: { id, url, titulo, origem }` quanto as propriedades no nível raiz `{ id, url, ... }`.
   - `AgenteImpressao.cs` consome `/api/office/impressao/proxima` e reporta `/api/office/impressao/{id}/feita` ou `/falhou`, cumprindo estritamente a especificação de `PROJECT.md`.

---

## 3. Caveats

- **Ambiente de Execução Não-Windows**: Os testes foram executados em ambiente macOS; as chamadas nativas de P/Invoke ao `winspool.drv` possuem guarda condicional de plataforma retornando status saudável em SOs não-Windows. A validação com impressora física EPSON TM-T20X e driver real do Windows ocorrerá nos testes de bancada no SRVKART / PC da Recepção.
- **Tolerância Mínima de Peso**: O valor mínimo aceito em `ValidacaoCliente.cs` e `cadastro-obrigatorio.ts` é 10 kg (para abarcar categorias cadete/infantil), enquanto o harness oracular E2E usa 15 kg como valor de referência de adultos. Ambos os limites são plenamente suportados e coerentes.

---

## 4. Conclusion

**Veredito: APPROVE**

A Milestone M3 (Desktop Comum & Periféricos) cumpre todos os critérios de aceitação, não apresenta violações de integridade, atalhos ou regressões. Todos os testes unitários e E2E estão passando com 100% de sucesso. A base de código está aprovada e pronta para avançar para a Milestone M4 (Desktop Recepção — Caixa & PDV).

---

## 5. Verification Method

Para reproduzir de forma independente a verificação:

1. **Testes Dedicados da Milestone M3**:
   ```bash
   npx vitest run tests/desktop-m3-perifericos.test.ts
   ```
   *Condição de invalidação: qualquer falha entre os 24 testes.*

2. **Testes E2E da Recepção (Tiers 1 a 4)**:
   ```bash
   npx vitest run tests/e2e-recepcao/
   ```
   *Condição de invalidação: menos de 87 testes passando.*

3. **Todas as Suítes Desktop**:
   ```bash
   npx vitest run tests/desktop-*.test.ts
   ```
   *Condição de invalidação: menos de 36 testes passando.*

4. **Checagem Estática de Tipos TypeScript**:
   ```bash
   npx tsc --noEmit
   ```
   *Condição de invalidação: qualquer erro emitido pelo compilador.*

5. **Inspeção de Código C#**:
   - `desktop/src/Kartodromo.Comum/Relatorio.cs`: linhas 294-443 (Spooler Win32), 480-490 (Timeout 15s), 503-524 (Corte 80mm).
   - `desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs`: linhas 24-41 (Check de impressora), 57-64 (Spooler check), 88-93 (Tratamento suave de 401).
   - `desktop/src/Kartodromo.Comum/Ui.cs`: linhas 236-284 (CalcularCursorMascara).
   - `desktop/src/Kartodromo.Comum/ValidacaoCliente.cs`: linhas 17-23 (Instagram opcional), 34-41 (Peso 10-250 kg).
   - `desktop/src/Kartodromo.Comum/Api.cs`: linhas 53-62 (Timeout 10s).
   - `desktop/src/Kartodromo.Comum/Design.cs`: linhas 49-51, 79-81 (Dispose de Region GDI).
