using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Kartodromo.Comum;

/// <summary>Visualizador de relatorios (no lugar do ReportViewer/RDLC do LapTime), com WebView2.
/// Cartão do canvas (RelatorioFechamento.dc.html): título · Exportar PDF · Exportar Excel · Imprimir · ✕,
/// folha sobre fundo cinza. Duplo clique na barra maximiza/restaura.</summary>
public class Relatorio : CartaoModal
{
    static CoreWebView2Environment _env;
    static readonly Color FundoFolha = Color.FromArgb(242, 242, 245);
    readonly WebView2 _web = new() { Dock = DockStyle.Fill };
    readonly string _titulo;

    /// <summary>WebView2 grava perfil numa pasta do usuario (Program Files nao e gravavel).</summary>
    public static async Task<CoreWebView2Environment> Ambiente()
    {
        if (_env != null) return _env;
        var pasta = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Kartodromo", "WebView2");
        Directory.CreateDirectory(pasta);
        _env = await CoreWebView2Environment.CreateAsync(null, pasta);
        return _env;
    }

    Relatorio(string titulo, string url) : base(1000, 760)
    {
        Text = titulo;
        _titulo = titulo;
        Icon = Kartodromo.Comum.Icone.App;
        ShowInTaskbar = true;
        StartPosition = FormStartPosition.Manual;
        BackColor = FundoFolha;
        Padding = new Padding(1);
        _web.DefaultBackgroundColor = FundoFolha;
        // barra própria (o kit visual da Recepção não mexe nesta janela: mover o WebView2 depois de aberto quebra a página)
        var barra = new Panel { Dock = DockStyle.Top, Height = 60, BackColor = Color.White };
        barra.Controls.Add(new Panel { Dock = DockStyle.Bottom, Height = 1, BackColor = Color.FromArgb(229, 229, 234) });
        var titulo_ = new Label { Text = titulo, AutoSize = true, Font = new Font("Segoe UI", 11.5F, FontStyle.Bold), ForeColor = PecasDesign.CorTexto, Location = new Point(16, 18) };
        var pdf = BotaoBarra("Exportar PDF", Color.FromArgb(235, 235, 239), PecasDesign.CorTexto);
        var excel = BotaoBarra("Exportar Excel", Color.FromArgb(235, 235, 239), PecasDesign.CorTexto);
        var imprimir = BotaoBarra("Imprimir", Color.FromArgb(11, 122, 83), Color.White);
        var fechar = BotaoBarra("✕", Color.FromArgb(235, 235, 239), PecasDesign.CorTexto);
        fechar.Font = new Font("Segoe UI", 10F); fechar.AutoSize = false; fechar.MinimumSize = Size.Empty; fechar.Padding = Padding.Empty; fechar.Size = new Size(34, 34);
        // termo com impressora de termos configurada (Recepção): vai direto na TM-T20, sem a janela do Chrome
        // (que lembra a última impressora usada e podia mandar o termo pra jato de tinta/laser)
        var impressoraTermo = url.Contains("/termo") ? Config.Get("ImpressoraTermos", "") : "";
        _aviso = new Label { AutoSize = true, Font = new Font("Segoe UI", 9F), ForeColor = Color.FromArgb(21, 128, 61), BackColor = Color.White };
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
            catch (Exception e) { Msg.Erro(this, "Não foi possível abrir o relatório (WebView2): " + e.Message); }
        };
    }

    readonly Label _aviso;
    bool _imprimindo;

    async Task ImprimirDireto(string impressora)
    {
        if (_imprimindo || _web.CoreWebView2 == null) return;
        _imprimindo = true;
        _aviso.ForeColor = Color.FromArgb(110, 110, 115);
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
            _aviso.ForeColor = Color.FromArgb(21, 128, 61);
            _aviso.Text = $"Enviado para a {impressora} às {DateTime.Now:HH:mm}";
        }
        catch (Exception e)
        {
            _aviso.ForeColor = Color.FromArgb(200, 40, 30);
            _aviso.Text = $"Não imprimiu na {impressora}: {e.Message}";
        }
        finally { _imprimindo = false; }
    }

    static Button BotaoBarra(string texto, Color fundo, Color letra)
    {
        var principal = letra == Color.White;
        var b = new BotaoPlano { Text = texto, AutoSize = true, AutoSizeMode = AutoSizeMode.GrowOnly, MinimumSize = new Size(0, 36), Height = 36, Padding = new Padding(10, 0, 10, 0), FlatStyle = FlatStyle.Flat, BackColor = fundo, ForeColor = letra,
            Font = new Font("Segoe UI", 9.75F, principal ? FontStyle.Bold : FontStyle.Regular), Cursor = Cursors.Hand };
        b.FlatAppearance.BorderSize = 0;
        b.FlatAppearance.MouseOverBackColor = ControlPaint.Light(fundo, 0.12f);
        b.Resize += (_, _) => Forma.AplicarRaio(b, 8);
        return b;
    }

    string NomeArquivo(string ext)
    {
        var nome = string.Concat(_titulo.Split(Path.GetInvalidFileNameChars())).Trim();
        return $"{nome} {DateTime.Now:yyyy-MM-dd HH-mm}.{ext}";
    }

    string EscolherArquivo(string ext, string filtro)
    {
        using var d = new SaveFileDialog { FileName = NomeArquivo(ext), Filter = filtro, InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), OverwritePrompt = true };
        return d.ShowDialog(this) == DialogResult.OK ? d.FileName : null;
    }

    void Avisar(string texto, bool erro = false)
    {
        _aviso.ForeColor = erro ? Color.FromArgb(200, 40, 30) : Color.FromArgb(21, 128, 61);
        _aviso.Text = texto;
    }

    static void AbrirArquivo(string caminho)
    {
        try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(caminho) { UseShellExecute = true }); } catch { /* sem programa associado */ }
    }

    async Task ExportarPdf()
    {
        if (_web.CoreWebView2 == null) return;
        var arq = EscolherArquivo("pdf", "PDF (*.pdf)|*.pdf");
        if (arq == null) return;
        try
        {
            var cfg = _web.CoreWebView2.Environment.CreatePrintSettings();
            cfg.ShouldPrintBackgrounds = true;
            cfg.ShouldPrintHeaderAndFooter = false;
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
                if (el.tagName === 'TABLE') { el.querySelectorAll('tr').forEach(tr => out.push([...tr.children].map(td => td.innerText.trim()))); out.push([]); }
                else out.push([el.innerText.trim()]);
              });
              return out; })()
            """;
        try
        {
            var json = await _web.CoreWebView2.ExecuteScriptAsync(js);
            var linhas = System.Text.Json.JsonSerializer.Deserialize<List<List<string>>>(json) ?? [];
            if (!linhas.Any(l => l.Count > 1)) { Avisar("Este relatório não tem tabela para exportar.", true); return; }
            var arq = EscolherArquivo("csv", "Planilha do Excel (*.csv)|*.csv");
            if (arq == null) return;
            var dinheiro = new System.Text.RegularExpressions.Regex(@"^([–-])?\s*R\$\s*([\d.]+,\d{2})$");
            string Celula(string v)
            {
                var m = dinheiro.Match(v.Replace(' ', ' '));
                if (m.Success) return (m.Groups[1].Success ? "-" : "") + m.Groups[2].Value.Replace(".", "");
                return v.IndexOfAny([';', '"', '\n', '\r']) >= 0 ? "\"" + v.Replace("\"", "\"\"") + "\"" : v;
            }
            var texto = string.Join("\r\n", linhas.Select(l => string.Join(";", l.Select(Celula))));
            File.WriteAllText(arq, texto, new System.Text.UTF8Encoding(true));
            Avisar("Planilha salva: " + Path.GetFileName(arq));
            AbrirArquivo(arq);
        }
        catch (Exception e) { Avisar("Não salvou a planilha: " + e.Message, true); }
    }

    public static void Abrir(IWin32Window dono, string url, string titulo = "Relatório")
    {
        var f = new Relatorio(titulo, url);
        f.Show(dono);
    }

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
}
