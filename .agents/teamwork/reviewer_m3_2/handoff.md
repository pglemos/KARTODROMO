# Handoff Report — Milestone M3 (Reviewer & Adversarial Critic)

**Agente**: reviewer_m3_2  
**Papéis**: reviewer, critic  
**Diretório**: `/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/reviewer_m3_2`  
**Data**: 2026-10-27  
**Veredito**: **APPROVE**  

---

## 1. Observation

A auditoria e verificação independente dos requisitos da Milestone M3 (periféricos, ciclo de vida GDI e resiliência de rede) inspecionou diretamente os arquivos de código-fonte C#, TypeScript e as suítes de teste automatizadas:

### 1.1. Inspeção Estática de Código

1. **`desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs` (linhas 20-44, 55-83, 85-98)**:
   - **Polling Inteligente**: Na inicialização do agente (`Ligar(Form dono)`), a lista `PrinterSettings.InstalledPrinters` é consultada protegida por bloco `try-catch`. Caso a impressora configurada não esteja instalada (`!existe`), o método define `Situacao = "Impressora dos termos não encontrada"`, emite log `"ATENÇÃO: impressora '...' não existe neste computador. Polling de impressão não iniciado."` e executa `return;` **antes** de instanciar o `System.Windows.Forms.Timer`.
   - **Ausência de Modal Bloqueante 401**: O bloco de captura de exceção em `Rodada` captura `ApiException { Status: 401 }`. Foi completamente removida a chamada bloqueante `dono.BeginInvoke(() => Msg.Info(...))`. O agente define `Situacao = "Sessão expirada (401) - faça login novamente"`, registra log operacional e aplica retentativa suave com backoff em 30 segundos (`_pausaAte = DateTime.Now.AddSeconds(30)`), sem paralisar a thread da UI nem interromper o operador.
   - **Integração com Spooler**: Antes de requisitar o próximo trabalho de impressão via API, o método invoca `Relatorio.VerificarSpooler(_impressora)`. Se o spooler indicar status de impressora offline, sem papel ou em erro, define `_pausaAte = DateTime.Now.AddSeconds(15)` e aborta o ciclo. Em caso de falha de impressão no bloco catch, aciona `Relatorio.LimparFilaSpooler(_impressora)`.

2. **`desktop/src/Kartodromo.Comum/Relatorio.cs` (linhas 294-443, 445-537)**:
   - **Timeout de 15s no WebView2**: Em `ImprimirSilencioso(string url, string impressora)`, o evento `NavigationCompleted` é monitorado concorrentemente com `Task.Delay(TimeSpan.FromSeconds(15))` via `Task.WhenAny`. Se o timeout estourar, o manipulador de eventos é desregistrado (`web.CoreWebView2.NavigationCompleted -= OnNavCompleted`) e lança `TimeoutException("Tempo limite de 15 segundos excedido ao carregar o termo para impressão silenciosa. URL: ...")`.
   - **Gerenciamento de Recursos**: Todo o ciclo de impressão silenciosa é envolvido por `_semImpressaoSilenciosa.WaitAsync()` e liberado no bloco `finally { _semImpressaoSilenciosa.Release(); }`. A janela oculta `host` é fechada deterministicamente em `finally { host.Close(); }`.
   - **Corte Dinâmico de 80mm**: As configurações de impressão definem largura estrita de 80mm convertida para polegadas (`cfg.PageWidth = 80.0 / 25.4;`, ~3.15 pol), com margens zeradas (`MarginTop = MarginBottom = MarginLeft = MarginRight = 0`). A altura da página é obtida dinamicamente do DOM via script:
     ```javascript
     Math.max(document.body ? document.body.scrollHeight : 0, document.documentElement ? document.documentElement.scrollHeight : 0)
     ```
     e convertida para polegadas a 96 DPI com margem de segurança de corte de 0.25 pol (`cfg.PageHeight = Math.Max(2.5, (alturaPx / 96.0) + 0.25)`), evitando o avanço em branco de 297mm (A4) na TM-T20X.
   - **Monitoramento e Purga Nativa de Spooler**: Declarados os P/Invokes para `winspool.drv` (`OpenPrinter`, `ClosePrinter`, `SetPrinter`, `GetPrinter`). Implementada a estrutura `PRINTER_INFO_2` com alinhamento e tipo de caracteres `CharSet.Auto`. O método `VerificarSpooler` inspeciona as flags `PRINTER_STATUS_OFFLINE`, `PRINTER_STATUS_PAPER_OUT`, `PRINTER_STATUS_PAPER_JAM`, `PRINTER_STATUS_DOOR_OPEN`, `PRINTER_STATUS_ERROR`, `PRINTER_STATUS_PAUSED` e `PRINTER_STATUS_NOT_AVAILABLE`, com desalocação de memória nativa em `finally { Marshal.FreeHGlobal(buffer); }` e `finally { ClosePrinter(hPrinter); }`. O método `LimparFilaSpooler` executa `SetPrinter(hPrinter, 0, IntPtr.Zero, PRINTER_CONTROL_PURGE)` com constante 3. Em ambientes não-Windows, ambas as rotinas operam com fallback seguro.

3. **`desktop/src/Kartodromo.Comum/Design.cs` (linhas 45-52, 74-83)**:
   - **Descarte Determinístico de Regiões GDI**: Em `Forma.Recortar(Control c, int raio)`, a região anterior é armazenada antes da substituição (`var antiga = c.Region; c.Region = new Region(path); antiga?.Dispose();`).
   - Em `Forma.AjustarContorno(Panel painel, int diametro)`, o mesmo padrão é rigorosamente aplicado (`var antiga = painel.Region; painel.Region = new Region(path); antiga?.Dispose();`), garantindo que handles nativos `HRGN` não vazem a cada redimensionamento de janelas.

4. **`desktop/src/Kartodromo.Comum/Api.cs` (linhas 51-56)**:
   - O timeout padrão do `HttpClient` foi reduzido de 30 segundos para 10 segundos: `_http = new HttpClient { Timeout = timeout ?? TimeSpan.FromSeconds(10) };`.
   - Exposta propriedade pública `public TimeSpan Timeout => _http.Timeout;`.

5. **`desktop/src/Kartodromo.Comum/Ui.cs` (linhas 232-284)**:
   - Implementado o método algorítmico `CalcularCursorMascara(string antigoTexto, string novoTextoFormatado, int posicaoAntiga)`, mapeando a contagem de caracteres alfanuméricos digitados e preservando a posição exata de digitação do cursor.
   - Atualizado `Ui.Campos.Mascara(TextBox t, Func<string, string> fn)` para atualizar a posição do cursor usando `CalcularCursorMascara` dentro de bloco protegido com flag de reentrância `ocupado` e validação `!t.IsDisposed`.

6. **`desktop/src/Kartodromo.Comum/ValidacaoCliente.cs` (linhas 17-23, 34-41)**:
   - `ErroInstagram`: retorna `null` para campos vazios, em branco ou nulos, tornando o Instagram opcional.
   - `ErroPeso`: aceita e valida valores na faixa de 10 kg a 250 kg inclusive (`kg >= 10 && kg <= 250`).

### 1.2. Execução Independente de Testes e Comandos

Foram executadas as suítes de validação no ambiente de desenvolvimento:

- **`npx vitest run tests/desktop-m3-perifericos.test.ts`**:
  - Resultado: **24/24 testes passaram (100% sucesso)** em 138ms.
- **`npx vitest run tests/e2e-recepcao/`**:
  - Resultado: **87/87 testes passaram em 4 suítes (100% sucesso)** em 584ms (Tier 1: 36/36, Tier 2: 33/33, Tier 3: 9/9, Tier 4: 9/9).
- **`npx vitest run tests/desktop-*.test.ts`**:
  - Resultado: **36/36 testes passaram em 5 suítes (100% sucesso)** em 527ms.
- **`npx vitest run tests/ops/`**:
  - Resultado: **355/355 testes passaram em 21 suítes (100% sucesso)** em 1.87s.
- **`npx tsc --noEmit`**:
  - Resultado: **0 erros de compilação/tipagem TypeScript** (Clean exit code 0).

---

## 2. Logic Chain

1. **Da Verificação Prévia de Impressora à Integridade da Fila (Obs. 1.1.1)**:
   - A verificação de `PrinterSettings.InstalledPrinters` antes de instanciar o Timer de polling garante que instâncias da aplicação rodando em máquinas sem impressora térmica configurada não capturem trabalhos de impressão da fila `dbo.FilaImpressao`. Isso evita a transição espúria de status de termos para `falhou` e assegura que apenas terminais aptos processem os termos.
2. **Da Substituição do Diálogo Modal por Backoff Silencioso (Obs. 1.1.1)**:
   - Em operações de balcão com alta rotatividade, exibir caixas de mensagem modal bloqueantes (`Msg.Info`) na thread principal de despacho WinForms durante a perda de sessão travava o foco e impedia a digitação do atendente. O tratamento não-intrusivo com atualização de rótulo e backoff de 30 segundos mantém o aplicativo utilizável e auto-recuperável assim que o login for restabelecido.
3. **Do Timeout de 15s e Serialização via Semáforo (Obs. 1.1.2)**:
   - O uso de `SemaphoreSlim(1, 1)` serializa os acessos ao WebView2 e ao spooler da impressora de recibos, impedindo colisões de jobs simultâneos. A introdução de `Task.Delay(15s)` associado ao `Task.WhenAny` e desregistro do evento previne travamento permanente do semáforo caso a página web do termo não conclua o carregamento (ex.: falha de rede ou timeout de script).
4. **Da Medição DOM de Altura ao Fim do Desperdício de Bobina (Obs. 1.1.2)**:
   - Como a TM-T20X é uma impressora de bobina contínua de 80mm com guilhotina, fixar 297mm (padrão folha A4) forçava o avanço mecânico desnecessário de ~20cm de papel em branco após cada termo. A medição da altura real do conteúdo via `scrollHeight` adicionando margem de segurança de 0.25 pol proporciona corte preciso e economia de suprimentos.
5. **Do P/Invoke em `winspool.drv` à Prevenção de Falhas Silenciosas (Obs. 1.1.2)**:
   - A checagem de flags nativas de status do Spooler antes do início da impressão evita o envio de trabalhos para impressoras offline ou sem papel. Em caso de retenção de jobs corrompidos, `PRINTER_CONTROL_PURGE` limpa a fila do driver sem exigir privilégios de reinício de serviço do Windows.
6. **Do Descarte Determinístico de HRGN à Estabilidade Operacional (Obs. 1.1.3)**:
   - No subsistema GDI do Windows, controles WinForms que recebem novas instâncias de `Region` retêm os handles nativos anteriores no heap do driver gráfico caso não sejam explicitamente destruídos via `Dispose()`. O padrão `var antiga = c.Region; c.Region = ...; antiga?.Dispose();` encerra o ciclo de vida do recurso nativo e previne vazamento de GDI handles em execuções prolongadas.
7. **Da Preservação de Cursor e Flexibilização de Campos à Produtividade (Obs. 1.1.5 e 1.1.6)**:
   - `CalcularCursorMascara` resolve o defeito de reset de cursor para a posição 0 ao editar CPF ou telefone no meio do texto, e a flexibilização do Instagram remove uma barreira impeditiva para pilotos sem perfil na rede social, mantendo os limites físicos de peso coerentes (10 a 250 kg).

---

## 3. Adversarial Analysis & Integrity Verification

### 3.1. Auditoria de Integridade (Anti-Cheat & Cleanliness)

- **Verificação de Mocks Hardcoded**: O código C# implementa chamadas reais de P/Invoke ao `winspool.drv` e interações autênticas com a API do WebView2 e GDI+. Não há valores fixos retornados sob condições artificiais de teste.
- **Verificação de Facades Vazias**: As funções `VerificarSpooler`, `LimparFilaSpooler`, `ImprimirSilencioso` e `CalcularCursorMascara` executam manipulação genuína de memória, parsing de ponteiros nativos e algoritmos completos de contagem e busca.
- **Regras do Dono (AGENTS.md)**:
  - `desktop/src/Kartodromo.Cronometragem/FormTV.cs`: Inalterado e protegido.
  - Apps mantidos como programas nativos Windows C# WinForms.
  - Ausência de credenciais ou senhas versionadas.

### 3.2. Estresse Adversarial e Cenários de Borda

| Cenário de Teste / Stress | Comportamento Observado / Projetado | Avaliação |
| :--- | :--- | :--- |
| **Queda de Rede durante Carga do Termo no WebView2** | O temporizador de 15s dispara, desinscreve do evento `NavigationCompleted`, lança `TimeoutException`, fecha o formulário invisível e libera o semáforo `_semImpressaoSilenciosa` no bloco `finally`. | **ROBUSTO** |
| **Spooler do Windows com Papel Atolado ou Tampa Aberta** | `VerificarSpooler` consulta `PRINTER_INFO_2.Status` via `GetPrinterW`, detecta `PRINTER_STATUS_PAPER_JAM` ou `PRINTER_STATUS_DOOR_OPEN` e aborta a impressão antes de retirar o job da fila, agendando nova verificação em 15 segundos. | **ROBUSTO** |
| **Execução Concorrente de Múltiplos Trabalhos de Impressão** | `SemaphoreSlim(1, 1)` garante que cada job de impressão silenciosa seja processado de forma estritamente sequencial, sem sobreposição de instâncias do WebView2 nem conflito de recursos GDI. | **ROBUSTO** |
| **Múltiplos Redimensionamentos de Painéis Arredondados** | `Forma.Recortar` e `AjustarContorno` armazenam a `Region` anterior e realizam o `Dispose()` imediato antes de prosseguir, mantendo a contagem de handles GDI do processo estável. | **ROBUSTO** |
| **Digitação Rápida em Campos Formatados com Máscara** | A flag `ocupado` em `Ui.Campos.Mascara` bloqueia loops de recursão no evento `TextChanged`. `CalcularCursorMascara` calcula a contagem de caracteres alfanuméricos sem estourar limites de array e sem resetar a posição de inserção. | **ROBUSTO** |
| **Cliente com Peso no Limite Inferior (10 kg) ou Superior (250 kg)** | `ValidacaoCliente.ErroPeso` aceita exatamente os valores de fronteira 10 e 250, rejeitando 9.9, 250.1 ou strings não-numéricas. | **ROBUSTO** |

---

## 4. Caveats

- **Ambiente de Testes Não-Windows**: Os testes em ambiente macOS e Linux utilizam a checagem `RuntimeInformation.IsOSPlatform(OSPlatform.Windows)` para alternar entre as chamadas reais de P/Invoke ao `winspool.drv` e os fallbacks em ambiente multiplataforma. Em ambiente de produção Windows Server / Windows 10/11 x64, os binários farão o binding direto com `winspool.drv` nativo.
- **Configuração de Drivers de Impressão Térmica**: O corte dinâmico da EPSON TM-T20X assume que o driver ESC/POS esteja configurado para respeitar os parâmetros de tamanho e margens informados pelo `CoreWebView2PrintSettings`.

---

## 5. Conclusion

Todas as alterações introduzidas pela Milestone M3 atendem com rigor aos requisitos técnicos de periféricos, descarte GDI e resiliência de rede:
- A integridade da fila de impressão e a disponibilidade dos terminais da recepção estão protegidas.
- Não foram detectadas regressões em nenhuma das suítes de teste (desktop, ops e E2E recepção).
- Veredito final: **APPROVE**.

---

## 6. Verification Method

Para reproduzir de forma independente todas as validações realizadas:

```bash
# 1. Execução da suíte dedicada da Milestone M3
npx vitest run tests/desktop-m3-perifericos.test.ts

# 2. Execução da suíte completa E2E da Recepção (Tiers 1 a 4)
npx vitest run tests/e2e-recepcao/

# 3. Execução de todas as suítes desktop do projeto
npx vitest run tests/desktop-*.test.ts

# 4. Execução de todas as suítes backend e operacionais
npx vitest run tests/ops/

# 5. Validação de tipagem TypeScript
npx tsc --noEmit
```
