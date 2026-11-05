# Relatório Técnico de Implementação: Milestone M1 (Desktop & Scripts)
**Gestão de Termos de Responsabilidade, Bloqueio de Impressão Cega e Limpeza Segura de Spooler**

- **Data**: 2026-10-26T19:35:00Z
- **Autor**: Explorer Especialista em Desktop WinForms e Scripts de Infraestrutura (`explorer_m1_desktop_2`)
- **Destinatário**: Orquestrador (`cc947e12-4c7c-48ad-93cf-a3cced581f33`)
- **Escopo**:
  1. `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`: Bloqueio de `ImprimirSilencioso` cego e aviso amigável na tela de sucesso.
  2. `desktop/src/Kartodromo.Comum/Relatorio.cs`: Validação rigorosa de existência de impressora antes da inicialização do WebView2 e disparo de impressão.
  3. `scripts/apps/limpar-spooler-totem.ps1`: Script PowerShell para purga atômica de filas e trabalhos órfãos da TM-T20 sem interrupção do serviço Spooler do Windows.

---

## 1. Observação

### 1.1 Invocação Cega de `ImprimirSilencioso` no Totem
No arquivo `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs` (linhas 768-783):
```csharp
            var qtd = r?["inscricoes"] is JsonArray ins ? ins.Count : 1;
            TelaSucesso(Fmt.Hm(r.S("inicio")), qtd);
            // o termo sai na TM-T20 da recepção (fila do servidor); só imprime aqui se o servidor não enfileirou
            if (r["termoNaRecepcao"]?.GetValue<bool>() == true) Program.Log("termo enviado para a impressora da recepção");
            else if (r.S("termoUrl") is { Length: > 0 } termo) _ = Imprimir(_api.BaseUrl + termo);
        });
        ...
    async Task Imprimir(string url)
    {
        try { await Relatorio.ImprimirSilencioso(url, Config.Impressora); Program.Log("termo impresso: " + url.Split('?')[0]); }
        catch (Exception e) { Program.Log("falha ao imprimir termo: " + e.Message); }
    }
```
- Em `appsettings.json` padrão do Autoatendimento: `"Impressora": ""`.
- Em totens físicos (como observado em `docs/operacao/HANDOFF-SISTEMA-PROPRIO.md`, linha 293):
  > "Os totens não têm impressora. O Windows deles não vê uma TM-T20 desde jan/fev de 2025, e a COM1 está vazia."
- Quando `r["termoNaRecepcao"]` é `false` (ou ausente) e `r.S("termoUrl")` existe, `FormTotem` dispara `Imprimir(...)` em modo fire-and-forget (`_ = Imprimir(...)`) passando `Config.Impressora` (string vazia `""` ou nome legado).

### 1.2 Comportamento em `Relatorio.ImprimirSilencioso`
No arquivo `desktop/src/Kartodromo.Comum/Relatorio.cs` (linhas 275-297):
```csharp
    /// <summary>Imprime uma pagina direto na impressora (sem dialogo), ex.: termo no totem.</summary>
    public static async Task ImprimirSilencioso(string url, string impressora = null)
    {
        using var host = new Form { ShowInTaskbar = false, FormBorderStyle = FormBorderStyle.None, Size = new Size(10, 10), StartPosition = FormStartPosition.Manual, Location = new Point(-2000, -2000) };
        using var web = new WebView2 { Dock = DockStyle.Fill };
        host.Controls.Add(web);
        host.Show();
        await web.EnsureCoreWebView2Async(await Ambiente());
        await web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync("window.print = function(){};");
        var carregou = new TaskCompletionSource<bool>();
        web.CoreWebView2.NavigationCompleted += (_, e) => carregou.TrySetResult(e.IsSuccess);
        web.CoreWebView2.Navigate(url);
        if (!await carregou.Task) throw new Exception("Falha ao carregar o termo para impressão.");
        await Task.Delay(600); // imagens (logo) terminarem de desenhar
        var cfg = web.CoreWebView2.Environment.CreatePrintSettings();
        cfg.ShouldPrintBackgrounds = true;
        cfg.ShouldPrintHeaderAndFooter = false;
        cfg.MarginTop = cfg.MarginBottom = cfg.MarginLeft = cfg.MarginRight = 0;
        if (!string.IsNullOrWhiteSpace(impressora)) cfg.PrinterName = impressora;
        var st = await web.CoreWebView2.PrintAsync(cfg);
        if (st != CoreWebView2PrintStatus.Succeeded) throw new Exception("Impressora indisponível: " + st);
        host.Close();
    }
```
1. **Fallback perigoso**: Se `impressora` for nula ou vazia, `cfg.PrinterName` não é atribuído. O WebView2 direciona a impressão silenciosa para a **impressora padrão do Windows**. No totem, isso dispara contra impressoras virtuais (ex.: `Microsoft Print to PDF`, `OneNote`) ou filas fantasmas legadas (`EPSON TM-T20 Receipt`).
2. **Criação de recursos pesados desnecessária**: O formulário invisível (`host`), o controle `WebView2`, a inicialização do runtime e a navegação pela rede acontecem mesmo se a impressora não existir ou estiver em branco.
3. **Ausência de verificação no subsistema de spooler**: Não há validação prévia se `impressora` consta na coleção `System.Drawing.Printing.PrinterSettings.InstalledPrinters`.
4. **Vazamento potencial de janela em caso de exceção**: Se `carregou.Task` falhar ou `PrintAsync` lançar exceção, `host.Close()` na linha 296 não é alcançado, mantendo a janela na memória até o GC coletar.
5. **Hanging infinito sem timeout**: `await carregou.Task` não possui timeout; se o servidor web cair durante a requisição do termo, a rotina trava indefinidamente.

### 1.3 Tela de Sucesso no Totem (`TelaSucesso`)
No arquivo `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs` (linhas 787-801):
```csharp
    void TelaSucesso(string hora, int n)
    {
        var c = NovaTela(etapa: 3);
        var icone = new IconeSucesso { Bounds = new Rectangle(P(631), P(130), P(104), P(104)) };
        c.Controls.Add(icone);
        c.Controls.Add(Rot("Inscrição na bateria confirmada", 100, 292, F(54, false, FontStyle.Bold), Estilo.Texto, 1166, 72, ContentAlignment.MiddleCenter));
        c.Controls.Add(Rot($"Dirija-se até a recepção para concluir o atendimento e assinar {(n > 1 ? "os termos" : "seu termo")} de responsabilidade.", 120, 384, F(22), Estilo.Suave, 1126, 40, ContentAlignment.MiddleCenter));
        c.Controls.Add(Rot("Sua bateria começa às", 440, 438, F(22), Estilo.Suave, 340, 36, ContentAlignment.MiddleRight));
        c.Controls.Add(Rot(hora, 786, 434, Estilo.Mono(P(28), FontStyle.Bold), Estilo.Texto, 140, 40, ContentAlignment.MiddleLeft));
        c.Controls.Add(Rot("Atenção às informações passadas no briefing e divirta-se!", 170, 494, F(19), Estilo.Suave, 1026, 34, ContentAlignment.MiddleCenter));
        Botao(c, "Concluir", 500, 560, 180, true, () => { Reiniciar(); return Task.CompletedTask; }, 64, 19);
        c.Controls.Add(Rot("Volta para o início após 90 segundos sem interação", 700, 560, F(16), Estilo.MuitoSuave, 380, 64, ContentAlignment.MiddleLeft));
        Mostrar("fim", c, () => TelaSucesso(hora, n));
        _fim.Stop(); _fim.Start();
    }
```
- A tela informa genericamente para "assinar seu termo de responsabilidade", mas não explicita onde o documento está ou se deve ser retirado no balcão caso a impressão local não exista ou tenha falhado.
- `AutoTeste()` no mesmo arquivo (linha 850) chama:
  `TelaSucesso("19:20", 1); await Foto("7-sucesso");`
  Qualquer alteração na assinatura de `TelaSucesso` deve manter parâmetros opcionais ou compatíveis para preservar a execução dos screenshots de autoteste visual.

### 1.4 Estado dos Scripts de Infraestrutura e Spooler
- O script `scripts/apps/limpar-spooler-totem.ps1` **não existe** no repositório.
- O script `scripts/apps/instalar-totem1.ps1` (linhas 15-20) forçava a busca por uma impressora `TM-T20`, abortando caso não existisse. Isso gerava instalações artificiais ou drivers órfãos `EPSON TM-T20 Receipt` nos totens.
- A máquina CRONOMETRAGEM (`192.168.20.249`) gerencia os totens (`192.168.20.161` e `.69`) via PowerShell / WinRM.

---

## 2. Cadeia Lógica

1. **Da premissa de hardware**: Como os totens físicos não possuem impressoras térmicas locais conectadas fisicamente nem drivers operacionais, qualquer tentativa de enviar impressões para a impressora padrão do Windows ou para um driver fantasma offline gera trabalhos retidos em disco (`C:\Windows\System32\spool\PRINTERS\*.SPL`), provocando acúmulo de arquivos, alertas no spooler do Windows e possíveis travamentos no subsistema gráfico de impressão.
2. **Da proteção na camada comum (`Relatorio.cs`)**: A função `ImprimirSilencioso` é compartilhada entre o Autoatendimento e a Recepção (`AgenteImpressao.cs` e `Acoes.cs`). Ao tornar obrigatória a validação de que a impressora informada existe no Windows (`PrinterSettings.InstalledPrinters`), bloqueia-se preventivamente qualquer tentativa cega em nível de biblioteca, abortando antes mesmo de instanciar o WebView2.
3. **Da experiência do usuário no Kiosk (`FormTotem.cs`)**:
   - Se o servidor devolver `termoNaRecepcao: true`, o termo já foi enfileirado no banco/servidor para a TM-T20 da recepção. Nenhuma impressão local deve ser tentada.
   - Se `termoNaRecepcao` não for verdadeiro, o totem verifica se possui uma impressora local válida configurada em `Config.Impressora`. Caso negativo, **não** chama `ImprimirSilencioso` e aciona `TelaSucesso` com aviso amigável explícito indicando que o termo deve ser retirado e assinado no balcão da Recepção.
   - Caso possua impressora válida, tenta a impressão local; se esta falhar (ex.: sem papel), registra log e orienta o cliente a retirar o termo na Recepção.
4. **Da estabilidade do serviço Spooler do Windows (`limpar-spooler-totem.ps1`)**:
   - Derrubar o serviço `Spooler` (`Stop-Service Spooler` ou `net stop spooler`) durante horário de funcionamento ou em quiosques pode falhar caso haja arquivos bloqueados por antivírus, e viola a exigência expressa do projeto de não paralisar serviços.
   - O método WMI/CIM `CancelAllJobs` da classe `Win32_Printer` envia o comando nativo `PRINTER_CONTROL_PURGE` ao driver/spooler sem desligar o daemon `spoolsv.exe`.
   - Adicionalmente, as chamadas `Get-PrintJob | Remove-PrintJob` do módulo `PrintManagement` atuam de forma não disruptiva.
   - Como complemento de integridade, o script deve oferecer a opção de desinstalar a fila fantasma (`Remove-Printer`) e zerar a configuração `"Impressora": ""` no arquivo `appsettings.json` do totem.

---

## 3. Ressalvas

- **Ambiente de Análise em macOS**: A presente especificação foi desenhada sob análise estática de código e tipos em ambiente macOS. A compilação final da solução C# (`dotnet build Kartodromo.Desktop.sln`) e a execução do PowerShell devem ser realizadas no runner de homologação ou máquinas alvo com Windows.
- **Não interferência em outros chamadores**: Em `Kartodromo.Recepcao/AgenteImpressao.cs` e `Acoes.cs`, a impressora utilizada é `Config.Get("ImpressoraTermos", "")`. A validação em `Relatorio.cs` não impacta a recepção, pois lá a impressora TM-T20 física está presente e registrada no Windows.
- **Autoteste visual preservado**: A assinatura estendida de `TelaSucesso` utiliza parâmetros default para que `TelaSucesso("19:20", 1)` no `AutoTeste()` continue executando sem alterações e gerando os screenshots intactos.

---

## 4. Conclusão e Proposta Técnica Detalhada

A solução para a Milestone M1 no escopo Desktop & Scripts compreende exatamente 3 ações cirúrgicas:

### 4.1 Proposta para `desktop/src/Kartodromo.Comum/Relatorio.cs`

#### Alterações:
1. Adicionar `using System.Drawing.Printing;` no topo do arquivo.
2. Criar método público estático `ImpressoraExiste(string impressora)`.
3. Reformular `ImprimirSilencioso(string url, string impressora)` para validar parâmetros, fail-fast, timeout e fechamento garantido em `finally`.

#### Código Proposto (Patch de Substituição):

```csharp
// Adicionar ao topo de Relatorio.cs:
using System.Drawing.Printing;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Kartodromo.Comum;

public class Relatorio : CartaoModal
{
    // ... membros existentes preservados ...

    /// <summary>Verifica se uma impressora está instalada e acessível no Windows.</summary>
    public static bool ImpressoraExiste(string impressora)
    {
        if (string.IsNullOrWhiteSpace(impressora)) return false;
        try
        {
            return PrinterSettings.InstalledPrinters.Cast<string>()
                .Any(p => string.Equals(p, impressora.Trim(), StringComparison.OrdinalIgnoreCase));
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Imprime uma pagina direto na impressora (sem dialogo), ex.: termo no totem.</summary>
    public static async Task ImprimirSilencioso(string url, string impressora)
    {
        if (string.IsNullOrWhiteSpace(url))
            throw new ArgumentException("A URL para impressão não pode ser vazia.", nameof(url));

        if (string.IsNullOrWhiteSpace(impressora))
            throw new InvalidOperationException("Nenhuma impressora informada para impressão silenciosa. A impressão cega na impressora padrão foi desabilitada.");

        if (!ImpressoraExiste(impressora))
            throw new InvalidOperationException($"A impressora '{impressora}' não está instalada ou acessível no sistema.");

        using var host = new Form { ShowInTaskbar = false, FormBorderStyle = FormBorderStyle.None, Size = new Size(10, 10), StartPosition = FormStartPosition.Manual, Location = new Point(-2000, -2000) };
        using var web = new WebView2 { Dock = DockStyle.Fill };
        host.Controls.Add(web);
        host.Show();
        try
        {
            await web.EnsureCoreWebView2Async(await Ambiente());
            await web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync("window.print = function(){};");
            var carregou = new TaskCompletionSource<bool>();
            web.CoreWebView2.NavigationCompleted += (_, e) => carregou.TrySetResult(e.IsSuccess);
            web.CoreWebView2.Navigate(url);

            var timeout = Task.Delay(10000);
            var completou = await Task.WhenAny(carregou.Task, timeout);
            if (completou == timeout || !await carregou.Task)
                throw new Exception("Tempo limite ou falha ao carregar o termo para impressão.");

            await Task.Delay(600); // imagens (logo) terminarem de desenhar
            var cfg = web.CoreWebView2.Environment.CreatePrintSettings();
            cfg.ShouldPrintBackgrounds = true;
            cfg.ShouldPrintHeaderAndFooter = false;
            cfg.MarginTop = cfg.MarginBottom = cfg.MarginLeft = cfg.MarginRight = 0;
            cfg.PrinterName = impressora.Trim();
            var st = await web.CoreWebView2.PrintAsync(cfg);
            if (st != CoreWebView2PrintStatus.Succeeded)
                throw new Exception($"Impressora '{impressora}' falhou ao imprimir: " + st);
        }
        finally
        {
            host.Close();
        }
    }
```

---

### 4.2 Proposta para `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`

#### Alterações:
1. No método `Imprimir(string url)`:
   - Validar se `Config.Impressora` é preenchida e se existe via `Relatorio.ImpressoraExiste(...)`.
   - Se inválida ou vazia, registrar em log e retornar sem chamar `Relatorio.ImprimirSilencioso`.
2. No handler do botão `Próximo` da tela de baterias:
   - Identificar se o servidor confirmou `termoNaRecepcao: true`.
   - Se não, verificar se há impressora local válida.
   - Chamar `TelaSucesso(horaInicio, qtd, termoNaRecepcao, avisoRetiradaRecepcao: !termoNaRecepcao && !impressoraValida)`.
3. No método `TelaSucesso`:
   - Adicionar parâmetros opcionais `bool termoNaRecepcao = true, bool avisoRetiradaRecepcao = false`.
   - Renderizar mensagem amigável, clara e visualmente harmoniosa orientando o cliente a retirar o termo impresso na Recepção quando não impresso no totem.

#### Código Proposto (Patch de Substituição):

```csharp
// Em FormTotem.cs, substituir linhas 768-801 pelo bloco abaixo:

            var qtd = r?["inscricoes"] is JsonArray ins ? ins.Count : 1;
            var horaInicio = Fmt.Hm(r.S("inicio"));
            var termoNaRecepcao = r["termoNaRecepcao"]?.GetValue<bool>() == true;
            var termoUrl = r.S("termoUrl");

            bool impressoraLocalValida = !string.IsNullOrWhiteSpace(Config.Impressora) && Relatorio.ImpressoraExiste(Config.Impressora);

            if (termoNaRecepcao)
            {
                Program.Log("termo enviado para a impressora da recepção");
                TelaSucesso(horaInicio, qtd, termoNaRecepcao: true);
            }
            else if (impressoraLocalValida && !string.IsNullOrWhiteSpace(termoUrl))
            {
                _ = Imprimir(_api.BaseUrl + termoUrl);
                TelaSucesso(horaInicio, qtd, termoNaRecepcao: false);
            }
            else
            {
                Program.Log($"totem sem impressora local válida configurada ('{Config.Impressora}'). Termo disponível na recepção.");
                TelaSucesso(horaInicio, qtd, termoNaRecepcao: true, avisoRetiradaRecepcao: true);
            }
        });
        proximo.Enabled = totalMarcadas > 0;
        voltar.BringToFront(); proximo.BringToFront();
        Mostrar("baterias", c, () => MontarBaterias(baterias, n));
    }

    async Task<bool> Imprimir(string url)
    {
        var impressora = Config.Impressora;
        if (string.IsNullOrWhiteSpace(impressora) || !Relatorio.ImpressoraExiste(impressora))
        {
            Program.Log($"impressão local ignorada: nenhuma impressora válida configurada ('{impressora}')");
            return false;
        }
        try
        {
            await Relatorio.ImprimirSilencioso(url, impressora);
            Program.Log("termo impresso localmente: " + url.Split('?')[0]);
            return true;
        }
        catch (Exception e)
        {
            Program.Log("falha ao imprimir termo localmente: " + e.Message);
            return false;
        }
    }

    // ------------------------------------------------------------------ 5. sucesso

    void TelaSucesso(string hora, int n, bool termoNaRecepcao = true, bool avisoRetiradaRecepcao = false)
    {
        var c = NovaTela(etapa: 3);
        var icone = new IconeSucesso { Bounds = new Rectangle(P(631), P(130), P(104), P(104)) };
        c.Controls.Add(icone);
        c.Controls.Add(Rot("Inscrição na bateria confirmada", 100, 272, F(50, false, FontStyle.Bold), Estilo.Texto, 1166, 68, ContentAlignment.MiddleCenter));

        string orientacaoTermo;
        if (avisoRetiradaRecepcao)
        {
            orientacaoTermo = n > 1
                ? "Retire e assine os termos de responsabilidade diretamente no balcão da Recepção."
                : "Retire e assine seu termo de responsabilidade diretamente no balcão da Recepção.";
        }
        else if (termoNaRecepcao)
        {
            orientacaoTermo = n > 1
                ? "Dirija-se até a recepção para concluir o atendimento e assinar os termos de responsabilidade."
                : "Dirija-se até a recepção para concluir o atendimento e assinar seu termo de responsabilidade.";
        }
        else
        {
            orientacaoTermo = n > 1
                ? "Retire os termos impressos abaixo e dirija-se à recepção para concluir o atendimento."
                : "Retire seu termo impresso abaixo e dirija-se à recepção para concluir o atendimento.";
        }

        c.Controls.Add(Rot(orientacaoTermo, 120, 360, F(22, false, FontStyle.Bold), Estilo.Texto, 1126, 44, ContentAlignment.MiddleCenter));
        c.Controls.Add(Rot("Sua bateria começa às", 440, 424, F(22), Estilo.Suave, 340, 36, ContentAlignment.MiddleRight));
        c.Controls.Add(Rot(hora, 786, 420, Estilo.Mono(P(28), FontStyle.Bold), Estilo.Texto, 140, 40, ContentAlignment.MiddleLeft));
        c.Controls.Add(Rot("Atenção às informações passadas no briefing e divirta-se!", 170, 484, F(19), Estilo.Suave, 1026, 34, ContentAlignment.MiddleCenter));
        Botao(c, "Concluir", 500, 550, 180, true, () => { Reiniciar(); return Task.CompletedTask; }, 64, 19);
        c.Controls.Add(Rot("Volta para o início após 90 segundos sem interação", 700, 550, F(16), Estilo.MuitoSuave, 380, 64, ContentAlignment.MiddleLeft));
        Mostrar("fim", c, () => TelaSucesso(hora, n, termoNaRecepcao, avisoRetiradaRecepcao));
        _fim.Stop(); _fim.Start();
    }
```

---

### 4.3 Proposta para `scripts/apps/limpar-spooler-totem.ps1`

#### Conteúdo Completo do Script:

```powershell
<#
.SYNOPSIS
  Limpeza segura de filas fantasmas e trabalhos retidos de spooler nos totens.

.DESCRIPTION
  Remove com segurança todos os trabalhos de impressão presos na fila de spooler
  da impressora TM-T20 ('EPSON TM-T20 Receipt' ou similar) nos totens de autoatendimento,
  SEM paralisar nem reiniciar o serviço Spooler do Windows.
  Utiliza o método nativo WMI/CIM CancelAllJobs (PRINTER_CONTROL_PURGE) e o módulo PrintManagement.
  Permite desinstalar a fila fantasma e zerar a configuração de impressora no appsettings.json.

.PARAMETER PadraoNome
  Expressão regular com os nomes das impressoras a verificar. Padrão: '(?i)TM.?T20|EPSON.*Receipt'

.PARAMETER RemoverFila
  Remove também o objeto da impressora fantasma do Windows se ela não possuir dispositivo físico conectado.

.PARAMETER ZerarAppsettings
  Garante que a chave "Impressora" no appsettings.json do Autoatendimento seja gravada como "".

.EXAMPLE
  .\limpar-spooler-totem.ps1
  Limpa todos os trabalhos pendentes/travados na fila TM-T20 sem derrubar o Spooler.

.EXAMPLE
  .\limpar-spooler-totem.ps1 -RemoverFila -ZerarAppsettings
  Limpa a fila, remove a impressora fantasma e garante o appsettings.json em branco.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [string]$PadraoNome = '(?i)TM.?T20|EPSON.*Receipt',
  [switch]$RemoverFila,
  [switch]$ZerarAppsettings
)

$ErrorActionPreference = 'Stop'

# 1. Validação de privilégios de Administrador
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Abra o PowerShell como Administrador para executar a limpeza de spooler.'
}

# 2. Assegurar que o Spooler do Windows esteja em execução
$spoolerService = Get-Service -Name Spooler -ErrorAction Stop
if ($spoolerService.Status -ne [ServiceProcess.ServiceControllerStatus]::Running) {
  Write-Warning "O serviço Spooler estava parado ($($spoolerService.Status)). Iniciando serviço para permitir purga via API..."
  Start-Service -Name Spooler
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Kartódromo de Betim — Limpeza de Spooler do Totem" -ForegroundColor Cyan
Write-Host "  Padrão de busca: $PadraoNome" -ForegroundColor Cyan
Write-Host "  Serviço Spooler: $($spoolerService.Status) (sem paralisação)" -ForegroundColor Green
Write-Host "=========================================================="

# 3. Localizar impressoras que casam com o padrão
$printers = @()
try {
  $printers = @(Get-Printer -ErrorAction SilentlyContinue | Where-Object { $_.Name -match $PadraoNome })
} catch {
  $printers = @(Get-CimInstance Win32_Printer -ErrorAction SilentlyContinue | Where-Object { $_.Name -match $PadraoNome })
}

if ($printers.Count -eq 0) {
  Write-Host "Nenhuma fila de impressora TM-T20 ou Receipt encontrada neste computador." -ForegroundColor Yellow
} else {
  foreach ($p in $printers) {
    $nomeImpressora = $p.Name
    Write-Host "`nProcessando fila: '$nomeImpressora'..." -ForegroundColor White

    # Contagem de trabalhos antes da limpeza
    $jobsAntes = 0
    try {
      $jobs = @(Get-PrintJob -PrinterName $nomeImpressora -ErrorAction SilentlyContinue)
      $jobsAntes = $jobs.Count
    } catch {
      $jobsCim = @(Get-CimInstance Win32_PrintJob -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*$nomeImpressora*" })
      $jobsAntes = $jobsCim.Count
    }

    Write-Host "  Trabalhos pendentes encontrados: $jobsAntes" -ForegroundColor ($jobsAntes -gt 0 ? 'Yellow' : 'Green')

    if ($jobsAntes -gt 0) {
      if ($PSCmdlet.ShouldProcess($nomeImpressora, "Cancelar todos os $jobsAntes trabalhos de impressão")) {
        # Método 1: CIM CancelAllJobs (envia PRINTER_CONTROL_PURGE direto ao Spooler)
        try {
          $escapedName = $nomeImpressora.Replace("'", "''")
          $cimPrinter = Get-CimInstance Win32_Printer -Filter "Name = '$escapedName'" -ErrorAction SilentlyContinue
          if ($cimPrinter) {
            $null = Invoke-CimMethod -InputObject $cimPrinter -MethodName CancelAllJobs
            Write-Host "  [OK] Método Win32_Printer.CancelAllJobs executado com sucesso." -ForegroundColor Green
          }
        } catch {
          Write-Warning "  Falha ao executar CancelAllJobs via CIM: $($_.Exception.Message)"
        }

        # Método 2: Remoção direta via PrintManagement
        try {
          Get-PrintJob -PrinterName $nomeImpressora -ErrorAction SilentlyContinue | ForEach-Object {
            Remove-PrintJob -PrinterName $nomeImpressora -ID $_.Id -ErrorAction SilentlyContinue
          }
        } catch {}

        Start-Sleep -Milliseconds 500

        # Verificação pós-limpeza
        $jobsDepois = 0
        try {
          $jobsDepois = @(Get-PrintJob -PrinterName $nomeImpressora -ErrorAction SilentlyContinue).Count
        } catch {
          $jobsDepois = @(Get-CimInstance Win32_PrintJob -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*$nomeImpressora*" }).Count
        }

        if ($jobsDepois -eq 0) {
          Write-Host "  [OK] Fila '$nomeImpressora' completamente esvaziada ($jobsAntes trabalhos eliminados)." -ForegroundColor Green
        } else {
          Write-Warning "  Ainda restam $jobsDepois trabalho(s) em processo de exclusão pelo Windows."
        }
      }
    } else {
      Write-Host "  Fila já estava limpa." -ForegroundColor Green
    }

    # 4. Remoção do dispositivo fantasma, se solicitado
    if ($RemoverFila) {
      if ($PSCmdlet.ShouldProcess($nomeImpressora, "Remover impressora fantasma do Windows")) {
        try {
          Remove-Printer -Name $nomeImpressora -ErrorAction Stop
          Write-Host "  [OK] Impressora fantasma '$nomeImpressora' removida do Windows." -ForegroundColor Green
        } catch {
          Write-Warning "  Não foi possível remover o dispositivo '$nomeImpressora': $($_.Exception.Message)"
        }
      }
    }
  }
}

# 5. Higienização do appsettings.json do Autoatendimento
if ($ZerarAppsettings) {
  $caminhosAppsettings = @(
    "$env:ProgramFiles\Kartodromo\Autoatendimento\appsettings.json",
    (Join-Path $PSScriptRoot 'Autoatendimento\appsettings.json'),
    (Join-Path $PSScriptRoot '..\..\desktop\src\Kartodromo.Autoatendimento\appsettings.json')
  )

  foreach ($caminho in $caminhosAppsettings) {
    if (Test-Path -LiteralPath $caminho) {
      try {
        $json = Get-Content -LiteralPath $caminho -Raw -ErrorAction Stop | ConvertFrom-Json
        if ($json.Impressora -ne "") {
          Write-Host "`nAtualizando configuração em: $caminho" -ForegroundColor White
          Write-Host "  'Impressora' anterior: '$($json.Impressora)' -> Nova: ''" -ForegroundColor Yellow
          $json.Impressora = ""
          $utf8SemBom = New-Object System.Text.UTF8Encoding $false
          [System.IO.File]::WriteAllText($caminho, ($json | ConvertTo-Json -Depth 5), $utf8SemBom)
          Write-Host "  [OK] appsettings.json atualizado." -ForegroundColor Green
        } else {
          Write-Host "`nConfiguração em $caminho já está com 'Impressora' vazia." -ForegroundColor Green
        }
      } catch {
        Write-Warning "Falha ao processar $caminho: $($_.Exception.Message)"
      }
    }
  }
}

Write-Host "`nOperação concluída com sucesso. O Spooler permaneceu 100% ativo.`n" -ForegroundColor Cyan
```

---

## 5. Método de Verificação Independente

Para verificar independentemente a exatidão e eficácia das modificações propostas:

### 5.1 Verificação de Código C#
1. **Inspeção Estática**:
   - `desktop/src/Kartodromo.Comum/Relatorio.cs`: Verificar a presença de `ImpressoraExiste` e a validação prévia em `ImprimirSilencioso`.
   - `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`: Verificar a chamada condicional com base em `termoNaRecepcao` e `Relatorio.ImpressoraExiste(Config.Impressora)`, garantindo que `ImprimirSilencioso` nunca seja invocado com impressora inexistente.
2. **Compilação**:
   No ambiente Windows com SDK .NET 8 instalado:
   ```bash
   dotnet build desktop/Kartodromo.Desktop.sln -c Release
   ```
   *Condição de aceitação*: 0 erros de compilação.
3. **Autoteste Visual do Totem**:
   Executar o autoteste visual para confirmar que as 9 telas (em especial a tela 7-sucesso) continuam renderizando perfeitamente nas resoluções 1366x768 e 1920x1080:
   ```bash
   desktop/src/Kartodromo.Autoatendimento/bin/Release/net8.0-windows/Kartodromo.Autoatendimento.exe --autoteste "temp/screenshots"
   ```

### 5.2 Verificação do Script PowerShell
1. **Validação Sintática**:
   ```powershell
   $errors = $null
   [System.Management.Automation.Language.Parser]::ParseFile("scripts/apps/limpar-spooler-totem.ps1", [ref]$null, [ref]$errors)
   if ($errors.Count -eq 0) { Write-Host "Sintaxe PowerShell 100% válida" } else { $errors }
   ```
2. **Execução em Modo Seguro (-WhatIf)**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/apps/limpar-spooler-totem.ps1 -WhatIf
   ```
3. **Teste de Purga no Spooler**:
   Em máquina de teste Windows com uma impressora virtual/teste criada:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/apps/limpar-spooler-totem.ps1
   ```
   *Condição de aceitação*: Fila limpa sem alteração no status do serviço Spooler (`Get-Service Spooler` permanece `Running`).
