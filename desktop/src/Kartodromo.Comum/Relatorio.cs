using System.Drawing.Printing;
using System.Globalization;
using System.Linq;
using System.Runtime.InteropServices;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Kartodromo.Comum;

/// <summary>Visualizador de relatorios (no lugar do ReportViewer/RDLC do LapTime), com WebView2.
/// Cartão do canvas (RelatorioFechamento.dc.html): título · Exportar PDF · Exportar Excel · Imprimir · ✕,
/// folha sobre fundo cinza. Duplo clique na barra maximiza/restaura.</summary>
public class Relatorio : CartaoModal
{
    static CoreWebView2Environment _env;
    static readonly Color FundoFolha = Tokens.FundoCampo;
    readonly WebView2 _web = new() { Dock = DockStyle.Fill };
    readonly string _titulo;
    /// <summary>Autoteste fora da tela: false antes de abrir (trocar ShowInTaskbar depois de aberto recria a janela e o WebView2 aborta).</summary>
    public static bool MostrarNaBarra = true;

    /// <summary>WebView2 grava perfil numa pasta do usuario (Program Files nao e gravavel).</summary>
    public static async Task<CoreWebView2Environment> Ambiente()
    {
        if (_env != null) return _env;
        var pasta = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Kartodromo", "WebView2");
        Directory.CreateDirectory(pasta);
        _env = await CoreWebView2Environment.CreateAsync(null, pasta);
        return _env;
    }

    Relatorio(string titulo, string url, int largura = 1000) : base(largura, 760)
    {
        Text = titulo;
        _titulo = titulo;
        Icon = Kartodromo.Comum.Icone.App;
        ShowInTaskbar = MostrarNaBarra;
        StartPosition = FormStartPosition.Manual;
        BackColor = FundoFolha;
        Padding = new Padding(1);
        // branco: o fundo padrão do WebView2 aparece nas margens do papel ao imprimir/exportar (antes saía cinza)
        _web.DefaultBackgroundColor = Tokens.Primitivo.Branco;
        // barra própria (o kit visual da Recepção não mexe nesta janela: mover o WebView2 depois de aberto quebra a página)
        var barra = new Panel { Dock = DockStyle.Top, Height = 60, BackColor = Tokens.Primitivo.Branco };
        barra.Controls.Add(new Panel { Dock = DockStyle.Bottom, Height = 1, BackColor = Tokens.Linha });
        var titulo_ = new Label { Text = titulo, AutoSize = true, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoSubtitulo, FontStyle.Bold), ForeColor = PecasDesign.CorTexto, Location = new Point(16, 18) };
        var pdf = BotaoBarra("Exportar PDF", Tokens.BotaoSecundario, PecasDesign.CorTexto);
        var excel = BotaoBarra("Exportar Excel", Tokens.BotaoSecundario, PecasDesign.CorTexto);
        var imprimir = BotaoBarra("Imprimir", Tokens.Verde, Tokens.Primitivo.Branco);
        var fechar = BotaoBarra("✕", Tokens.BotaoSecundario, PecasDesign.CorTexto);
        fechar.Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo); fechar.AutoSize = false; fechar.MinimumSize = Size.Empty; fechar.Padding = Padding.Empty; fechar.Size = new Size(34, 34);
        // termo com impressora de termos configurada (Recepção): vai direto na TM-T20, sem a janela do Chrome
        // (que lembra a última impressora usada e podia mandar o termo pra jato de tinta/laser)
        var impressoraTermo = url.Contains("/termo") ? Config.Get("ImpressoraTermos", "") : "";
        _aviso = new Label { AutoSize = true, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno), ForeColor = Tokens.Verde, BackColor = Tokens.Primitivo.Branco };
        barra.Controls.Add(_aviso);
        imprimir.Click += async (_, _) =>
        {
            if (impressoraTermo.Length > 0) { await ImprimirDireto(impressoraTermo); return; }
            try { await _web.CoreWebView2.ExecuteScriptAsync("window.print()"); } catch { /* ainda carregando */ }
        };
        pdf.Click += async (_, _) => await ExportarPdf();
        excel.Click += async (_, _) => await ExportarExcel();
        fechar.Click += (_, _) => Close();
        barra.Controls.AddRange([titulo_, pdf, excel, imprimir, fechar]);
        void Posicionar()
        {
            fechar.Location = new Point(barra.ClientSize.Width - fechar.Width - 16, 13);
            imprimir.Location = new Point(fechar.Left - imprimir.Width - 10, 12);
            excel.Location = new Point(imprimir.Left - excel.Width - 8, 12);
            pdf.Location = new Point(excel.Left - pdf.Width - 8, 12);
            _aviso.Location = new Point(Math.Max(titulo_.Right + 16, pdf.Left - _aviso.Width - 14), 21);
        }
        barra.Resize += (_, _) => Posicionar();
        _aviso.SizeChanged += (_, _) => Posicionar();
        // arrasta pela barra; duplo clique maximiza (relatório comprido)
        Point? origem = null;
        foreach (Control c in new Control[] { barra, titulo_ })
        {
            c.MouseDown += (_, e) => { if (e.Button == MouseButtons.Left && WindowState == FormWindowState.Normal) origem = c.PointToScreen(e.Location); };
            c.MouseMove += (_, e) => { if (origem is Point o && e.Button == MouseButtons.Left) { var p = c.PointToScreen(e.Location); Location = new Point(Location.X + p.X - o.X, Location.Y + p.Y - o.Y); origem = p; } };
            c.MouseUp += (_, _) => origem = null;
            c.DoubleClick += (_, _) => { MaximizedBounds = Screen.FromControl(this).WorkingArea; WindowState = WindowState == FormWindowState.Maximized ? FormWindowState.Normal : FormWindowState.Maximized; };
        }
        Controls.Add(_web);
        Controls.Add(barra);
        Load += async (_, _) =>
        {
            // tamanho do canvas, cabendo na tela de quem abriu (1366×768 até 1920×1080)
            var area = Owner != null ? Screen.FromControl(Owner).WorkingArea : Screen.FromPoint(Cursor.Position).WorkingArea;
            Size = new Size(Math.Min(1000, area.Width - 40), Math.Min(area.Height - 40, 900));
            Location = new Point(area.Left + (area.Width - Width) / 2, area.Top + (area.Height - Height) / 2);
            Posicionar();
            try
            {
                await _web.EnsureCoreWebView2Async(await Ambiente());
                _web.CoreWebView2.Settings.AreDevToolsEnabled = false;
                // título do canvas vem da página (ex.: "Fechamento de caixa · 25/09/2026")
                _web.CoreWebView2.DocumentTitleChanged += (_, _) =>
                {
                    var t = _web.CoreWebView2.DocumentTitle;
                    if (!string.IsNullOrWhiteSpace(t) && !t.StartsWith("http") && !t.Contains("/relatorio")) { titulo_.Text = t; Posicionar(); }
                };
                if (impressoraTermo.Length > 0)
                {
                    // a página do termo chama window.print() sozinha ao abrir: manda direto pra TM-T20
                    await _web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync("window.print = function(){ window.chrome.webview.postMessage('imprimir'); };");
                    _web.CoreWebView2.WebMessageReceived += async (_, e) => { if (e.TryGetWebMessageAsString() == "imprimir") await ImprimirDireto(impressoraTermo); };
                }
                _web.Source = new Uri(url);
            }
            catch (Exception e)
            {
                Diagnostico.Registrar("relatório/WebView2", e);
                // Sem fallback para o navegador: a URL do relatório leva o token da sessão (?t=...) e ficaria no
                // histórico/barra de endereço da máquina do balcão. Mostra o erro SEM a URL.
                Msg.Aviso(this, $"Não foi possível abrir o visualizador de relatórios (WebView2): {e.Message}\nFeche e abra o relatório de novo. Se continuar, avise o suporte.");
            }
        };
    }

    readonly Label _aviso;
    bool _imprimindo;

    async Task ImprimirDireto(string impressora)
    {
        if (_imprimindo || _web.CoreWebView2 == null) return;
        _imprimindo = true;
        _aviso.ForeColor = Tokens.TextoSecundario;
        _aviso.Text = "Imprimindo na " + impressora + "…";
        try
        {
            var cfg = _web.CoreWebView2.Environment.CreatePrintSettings();
            cfg.ShouldPrintBackgrounds = true;
            cfg.ShouldPrintHeaderAndFooter = false;
            cfg.MarginTop = cfg.MarginBottom = cfg.MarginLeft = cfg.MarginRight = 0;
            cfg.PrinterName = impressora;
            var st = await _web.CoreWebView2.PrintAsync(cfg);
            if (st != CoreWebView2PrintStatus.Succeeded) throw new Exception(st == CoreWebView2PrintStatus.PrinterUnavailable ? "impressora desligada ou desconectada" : st.ToString());
            _aviso.ForeColor = Tokens.Verde;
            _aviso.Text = $"Enviado para a {impressora} às {DateTime.Now:HH:mm}";
        }
        catch (Exception e)
        {
            Diagnostico.Registrar("relatório/impressão", e);
            _aviso.ForeColor = Tokens.Vermelho;
            _aviso.Text = $"Não foi possível imprimir na {impressora}. Verifique se ela está ligada e tente novamente.";
        }
        finally { _imprimindo = false; }
    }

    static Button BotaoBarra(string texto, Color fundo, Color letra)
    {
        var principal = letra.ToArgb() == Tokens.Primitivo.Branco.ToArgb(); // compara o valor (Color.White ≠ FromArgb(255,255,255) no ==)
        var b = new BotaoPlano { Text = texto, AutoSize = true, AutoSizeMode = AutoSizeMode.GrowOnly, MinimumSize = new Size(0, 36), Height = 36, Padding = new Padding(10, 0, 10, 0), FlatStyle = FlatStyle.Flat, BackColor = fundo, ForeColor = letra,
            Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo, principal ? FontStyle.Bold : FontStyle.Regular), Cursor = Cursors.Hand };
        b.AccessibleRole = AccessibleRole.PushButton;
        b.AccessibleName = texto == "✕" ? "Fechar relatório" : texto;
        b.FlatAppearance.BorderSize = 0;
        b.FlatAppearance.MouseOverBackColor = ControlPaint.Light(fundo, 0.12f);
        b.Resize += (_, _) => Forma.AplicarRaio(b, 8);
        return b;
    }

    /// <summary>Nome sugerido: o relatório da cronometragem informa o próprio (window.nomeArquivoRelatorio, com a
    /// data da prova); os demais usam o título da janela com " - " no lugar de "·" e a data de emissão.</summary>
    async Task<string> NomeArquivo(string ext)
    {
        string daPagina = null;
        try
        {
            var json = await _web.CoreWebView2.ExecuteScriptAsync("window.nomeArquivoRelatorio || ''");
            daPagina = System.Text.Json.JsonSerializer.Deserialize<string>(json);
        }
        catch { /* página sem o nome */ }
        var nome = !string.IsNullOrWhiteSpace(daPagina) ? daPagina : $"{_titulo} {DateTime.Now:yyyy-MM-dd HH-mm}";
        nome = string.Concat(nome.Replace("·", "-").Split(Path.GetInvalidFileNameChars()));
        nome = System.Text.RegularExpressions.Regex.Replace(nome, @"\s+", " ").Trim();
        return $"{nome}.{ext}";
    }

    async Task<string> EscolherArquivo(string ext, string filtro)
    {
        using var d = new SaveFileDialog { FileName = await NomeArquivo(ext), Filter = filtro, InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), OverwritePrompt = true };
        return d.ShowDialog(this) == DialogResult.OK ? d.FileName : null;
    }

    void Avisar(string texto, bool erro = false)
    {
        _aviso.ForeColor = erro ? Tokens.Vermelho : Tokens.Verde;
        _aviso.Text = texto;
    }

    static void AbrirArquivo(string caminho)
    {
        try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(caminho) { UseShellExecute = true }); } catch { /* sem programa associado */ }
    }

    async Task ExportarPdf()
    {
        if (_web.CoreWebView2 == null) return;
        var arq = await EscolherArquivo("pdf", "PDF (*.pdf)|*.pdf");
        if (arq == null) return;
        try
        {
            // Folha A4 (o padrão do WebView2 é Carta, 8,5 × 11 pol.)
            string orientacao = "p";
            try { orientacao = System.Text.Json.JsonSerializer.Deserialize<string>(await _web.CoreWebView2.ExecuteScriptAsync("document.querySelector('.sheet-page.landscape') ? 'l' : 'p'")); } catch { }
            var paisagem = orientacao == "l";
            var cfg = _web.CoreWebView2.Environment.CreatePrintSettings();
            cfg.ShouldPrintBackgrounds = true;
            cfg.ShouldPrintHeaderAndFooter = false;
            cfg.Orientation = paisagem ? CoreWebView2PrintOrientation.Landscape : CoreWebView2PrintOrientation.Portrait;
            cfg.PageWidth = paisagem ? 11.69 : 8.27;
            cfg.PageHeight = paisagem ? 8.27 : 11.69;
            // mesmas margens do @page do relatório (10 mm em cima, 14 mm embaixo para o "Página X de Y", 12 mm dos lados)
            cfg.MarginTop = 10 / 25.4;
            cfg.MarginBottom = 14 / 25.4;
            cfg.MarginLeft = cfg.MarginRight = 12 / 25.4;
            if (!await _web.CoreWebView2.PrintToPdfAsync(arq, cfg)) throw new Exception("o navegador não gerou o arquivo");
            Avisar("PDF salvo: " + Path.GetFileName(arq));
            AbrirArquivo(arq);
        }
        catch (Exception e) { Avisar("Não salvou o PDF: " + e.Message, true); }
    }

    /// <summary>Tabelas da página viram planilha (CSV com ";" que o Excel em português abre direto);
    /// valores "R$ 1.234,56" viram número.</summary>
    async Task ExportarExcel()
    {
        if (_web.CoreWebView2 == null) return;
        const string js = """
            (() => { const out = [];
              document.querySelectorAll('h1, h2, table').forEach(el => {
                if (el.tagName === 'TABLE') { el.querySelectorAll('tr').forEach(tr => out.push([...tr.children].map(td => td.innerText.replace(/\s+/g, ' ').trim()))); out.push([]); }
                else out.push([el.innerText.trim()]);
              });
              return out; })()
            """;
        try
        {
            var json = await _web.CoreWebView2.ExecuteScriptAsync(js);
            var linhas = System.Text.Json.JsonSerializer.Deserialize<List<List<string>>>(json) ?? [];
            if (!linhas.Any(l => l.Count > 1)) { Avisar("Este relatório não tem tabela para exportar.", true); return; }
            var arq = await EscolherArquivo("csv", "Planilha do Excel (*.csv)|*.csv");
            if (arq == null) return;
            var dinheiro = new System.Text.RegularExpressions.Regex(@"^([–-])?\s*R\$\s*([\d.]+,\d{2})$");
            var tempo = new System.Text.RegularExpressions.Regex(@"^\+?(\d+:)?\d{1,2}(:\d{2})?\.\d{3}$");
            string Celula(string v)
            {
                var m = dinheiro.Match(v.Replace(' ', ' '));
                if (m.Success) return (m.Groups[1].Success ? "-" : "") + m.Groups[2].Value.Replace(".", "");
                // tempo de volta/diferença ("53.550", "1:01.166", "+0.002"): o Excel em português leria "53.550" como 53550
                if (tempo.IsMatch(v)) return "\"=\"\"" + v + "\"\"\"";
                return v.IndexOfAny([';', '"', '\n', '\r']) >= 0 ? "\"" + v.Replace("\"", "\"\"") + "\"" : v;
            }
            var texto = string.Join("\r\n", linhas.Select(l => string.Join(";", l.Select(Celula))));
            File.WriteAllText(arq, texto, new System.Text.UTF8Encoding(true));
            Avisar("Planilha salva: " + Path.GetFileName(arq));
            AbrirArquivo(arq);
        }
        catch (Exception e) { Avisar("Não salvou a planilha: " + e.Message, true); }
    }

    public static void Abrir(IWin32Window dono, string url, string titulo = "Relatório", int largura = 1000)
    {
        var f = new Relatorio(titulo, url, largura);
        f.Show(dono);
    }

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

    [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool SetPrinter(IntPtr hPrinter, int Level, IntPtr pPrinter, int Command);

    [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern bool GetPrinter(IntPtr hPrinter, int dwLevel, IntPtr pPrinter, int cbBuf, out int pcbNeeded);

    private const int PRINTER_CONTROL_PURGE = 3;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    private struct PRINTER_INFO_2
    {
        public string pServerName;
        public string pPrinterName;
        public string pShareName;
        public string pPortName;
        public string pDriverName;
        public string pComment;
        public string pLocation;
        public IntPtr pDevMode;
        public string pSepFile;
        public string pPrintProcessor;
        public string pDatatype;
        public string pParameters;
        public IntPtr pSecurityDescriptor;
        public uint Attributes;
        public uint Priority;
        public uint DefaultPriority;
        public uint StartTime;
        public uint UntilTime;
        public uint Status;
        public uint cJobs;
        public uint AveragePPM;
    }

    private const uint PRINTER_STATUS_PAUSED = 0x00000001;
    private const uint PRINTER_STATUS_ERROR = 0x00000002;
    private const uint PRINTER_STATUS_PENDING_DELETION = 0x00000004;
    private const uint PRINTER_STATUS_PAPER_JAM = 0x00000008;
    private const uint PRINTER_STATUS_PAPER_OUT = 0x00000010;
    private const uint PRINTER_STATUS_MANUAL_FEED = 0x00000020;
    private const uint PRINTER_STATUS_PAPER_PROBLEM = 0x00000040;
    private const uint PRINTER_STATUS_OFFLINE = 0x00000080;
    private const uint PRINTER_STATUS_IO_ACTIVE = 0x00000100;
    private const uint PRINTER_STATUS_BUSY = 0x00000200;
    private const uint PRINTER_STATUS_PRINTING = 0x00000400;
    private const uint PRINTER_STATUS_OUTPUT_BIN_FULL = 0x00000800;
    private const uint PRINTER_STATUS_NOT_AVAILABLE = 0x00001000;
    private const uint PRINTER_STATUS_DOOR_OPEN = 0x00400000;

    /// <summary>
    /// Verifica o status operacional do spooler da impressora (offline, sem papel, tampa aberta, erro).
    /// </summary>
    public static (bool ok, string motivo) VerificarSpooler(string impressora)
    {
        if (string.IsNullOrWhiteSpace(impressora))
            return (false, "Impressora não configurada");

        if (!ImpressoraExiste(impressora))
            return (false, "Impressora não encontrada no sistema");

        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return (true, null);

        try
        {
            if (!OpenPrinter(impressora.Trim(), out var hPrinter, IntPtr.Zero))
                return (false, "Não foi possível abrir o canal com o spooler da impressora");

            try
            {
                GetPrinter(hPrinter, 2, IntPtr.Zero, 0, out var needed);
                if (needed <= 0) return (true, null);

                var buffer = Marshal.AllocHGlobal(needed);
                try
                {
                    if (GetPrinter(hPrinter, 2, buffer, needed, out _))
                    {
                        var info = Marshal.PtrToStructure<PRINTER_INFO_2>(buffer);
                        var status = info.Status;

                        if ((status & PRINTER_STATUS_OFFLINE) != 0)
                            return (false, "Impressora offline ou desconectada");
                        if ((status & PRINTER_STATUS_PAPER_OUT) != 0)
                            return (false, "Impressora sem papel");
                        if ((status & PRINTER_STATUS_PAPER_JAM) != 0)
                            return (false, "Papel atolado na impressora");
                        if ((status & PRINTER_STATUS_DOOR_OPEN) != 0)
                            return (false, "Tampa da impressora aberta");
                        if ((status & PRINTER_STATUS_ERROR) != 0)
                            return (false, "Erro no spooler da impressora");
                        if ((status & PRINTER_STATUS_PAUSED) != 0)
                            return (false, "Impressora pausada no Windows");
                        if ((status & PRINTER_STATUS_NOT_AVAILABLE) != 0)
                            return (false, "Impressora indisponível");
                    }
                }
                finally
                {
                    Marshal.FreeHGlobal(buffer);
                }
            }
            finally
            {
                ClosePrinter(hPrinter);
            }
            return (true, null);
        }
        catch (Exception ex)
        {
            return (false, "Falha ao consultar spooler: " + ex.Message);
        }
    }

    /// <summary>
    /// Saneamento de filas fantasmas: cancela todos os trabalhos retidos ou órfãos no spooler sem reiniciar o serviço.
    /// </summary>
    public static bool LimparFilaSpooler(string impressora)
    {
        if (string.IsNullOrWhiteSpace(impressora) || !ImpressoraExiste(impressora))
            return false;

        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return false;

        try
        {
            if (!OpenPrinter(impressora.Trim(), out var hPrinter, IntPtr.Zero))
                return false;

            try
            {
                return SetPrinter(hPrinter, 0, IntPtr.Zero, PRINTER_CONTROL_PURGE);
            }
            finally
            {
                ClosePrinter(hPrinter);
            }
        }
        catch
        {
            return false;
        }
    }

    static readonly SemaphoreSlim _semImpressaoSilenciosa = new(1, 1);

    /// <summary>Imprime uma pagina direto na impressora (sem dialogo), ex.: termo no totem.</summary>
    public static async Task ImprimirSilencioso(string url, string impressora = null)
    {
        if (string.IsNullOrWhiteSpace(url))
            throw new ArgumentException("A URL para impressão não pode ser vazia.", nameof(url));

        if (string.IsNullOrWhiteSpace(impressora))
            throw new InvalidOperationException("Nenhuma impressora informada para impressão silenciosa. A impressão cega na impressora padrão foi desabilitada.");

        if (!ImpressoraExiste(impressora))
            throw new InvalidOperationException($"A impressora '{impressora}' não está instalada ou acessível no sistema.");

        var (spoolerOk, motivoSpooler) = VerificarSpooler(impressora);
        if (!spoolerOk && motivoSpooler != null && (motivoSpooler.Contains("offline") || motivoSpooler.Contains("papel")))
            throw new InvalidOperationException($"A impressora '{impressora}' não está pronta para impressão: {motivoSpooler}");

        await _semImpressaoSilenciosa.WaitAsync();
        try
        {
            using var host = new Form { ShowInTaskbar = false, FormBorderStyle = FormBorderStyle.None, Size = new Size(10, 10), StartPosition = FormStartPosition.Manual, Location = new Point(-2000, -2000) };
            using var web = new WebView2 { Dock = DockStyle.Fill };
            host.Controls.Add(web);
            host.Show();
            try
            {
                await web.EnsureCoreWebView2Async(await Ambiente());
                await web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync("window.print = function(){};");

                var carregou = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
                void OnNavCompleted(object sender, CoreWebView2NavigationCompletedEventArgs e) => carregou.TrySetResult(e.IsSuccess);
                web.CoreWebView2.NavigationCompleted += OnNavCompleted;
                web.CoreWebView2.Navigate(url);

                var timeoutTask = Task.Delay(TimeSpan.FromSeconds(15));
                var completou = await Task.WhenAny(carregou.Task, timeoutTask);
                web.CoreWebView2.NavigationCompleted -= OnNavCompleted;

                if (completou == timeoutTask)
                    throw new TimeoutException($"Tempo limite de 15 segundos excedido ao carregar o termo para impressão silenciosa. URL: {url}");

                if (!await carregou.Task)
                    throw new InvalidOperationException($"Falha ao carregar o termo para impressão silenciosa. URL: {url}");

                try
                {
                    await web.CoreWebView2.ExecuteScriptAsync(
                        "new Promise(resolve => { if (document.readyState === 'complete') resolve(); else window.addEventListener('load', () => resolve()); })");
                }
                catch { }

                var cfg = web.CoreWebView2.Environment.CreatePrintSettings();
                cfg.ShouldPrintBackgrounds = true;
                cfg.ShouldPrintHeaderAndFooter = false;
                cfg.MarginTop = cfg.MarginBottom = cfg.MarginLeft = cfg.MarginRight = 0;
                cfg.PrinterName = impressora.Trim();

                // Altura dinâmica para bobina térmica de 80mm (TM-T20X)
                // Evita que o driver assuma folha A4 fixa (297mm) e acione corte prematuro ou desperdício de bobina
                try
                {
                    var alturaPxStr = await web.CoreWebView2.ExecuteScriptAsync(
                        "Math.max(document.body ? document.body.scrollHeight : 0, document.documentElement ? document.documentElement.scrollHeight : 0)");
                    if (double.TryParse(alturaPxStr, NumberStyles.Float, CultureInfo.InvariantCulture, out var alturaPx) && alturaPx > 0)
                    {
                        cfg.PageWidth = 80.0 / 25.4; // 80mm em polegadas (~3.15 in)
                        cfg.PageHeight = Math.Max(2.5, (alturaPx / 96.0) + 0.25);
                    }
                    else
                    {
                        cfg.PageWidth = 80.0 / 25.4;
                    }
                }
                catch
                {
                    cfg.PageWidth = 80.0 / 25.4;
                }

                var st = await web.CoreWebView2.PrintAsync(cfg);
                if (st != CoreWebView2PrintStatus.Succeeded)
                    throw new Exception($"Impressora '{impressora}' falhou ao imprimir: " + st);
            }
            finally
            {
                host.Close();
            }
        }
        finally
        {
            _semImpressaoSilenciosa.Release();
        }
    }
}
