using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Kartodromo.Comum;

/// <summary>Visualizador de relatorios (no lugar do ReportViewer/RDLC do LapTime), com WebView2.</summary>
public class Relatorio : Janela
{
    static CoreWebView2Environment _env;
    readonly WebView2 _web = new() { Dock = DockStyle.Fill };

    /// <summary>WebView2 grava perfil numa pasta do usuario (Program Files nao e gravavel).</summary>
    public static async Task<CoreWebView2Environment> Ambiente()
    {
        if (_env != null) return _env;
        var pasta = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Kartodromo", "WebView2");
        Directory.CreateDirectory(pasta);
        _env = await CoreWebView2Environment.CreateAsync(null, pasta);
        return _env;
    }

    Relatorio(string titulo, string url) : base(titulo, 1000, 740, true)
    {
        ShowInTaskbar = true;
        BackColor = Color.White;
        _web.DefaultBackgroundColor = Color.White;
        // barra própria (o kit visual da Recepção não mexe nesta janela: mover o WebView2 depois de aberto quebra a página)
        var barra = new Panel { Dock = DockStyle.Top, Height = 56, BackColor = Color.White, Padding = new Padding(14, 10, 14, 10) };
        barra.Controls.Add(new Panel { Dock = DockStyle.Bottom, Height = 1, BackColor = Color.FromArgb(229, 229, 234) });
        var titulo_ = new Label { Text = titulo, AutoSize = true, Font = new Font("Segoe UI", 11F, FontStyle.Bold), ForeColor = Color.FromArgb(29, 29, 31), Location = new Point(14, 8) };
        var imprimir = BotaoBarra("Imprimir", Color.FromArgb(21, 128, 61), Color.White);
        var fechar = BotaoBarra("Fechar", Color.FromArgb(238, 238, 241), Color.FromArgb(29, 29, 31));
        // termo com impressora de termos configurada (Recepção): vai direto na TM-T20, sem a janela do Chrome
        // (que lembra a última impressora usada e podia mandar o termo pra jato de tinta/laser)
        var impressoraTermo = url.Contains("/termo") ? Config.Get("ImpressoraTermos", "") : "";
        _aviso = new Label { AutoSize = true, Font = new Font("Segoe UI", 9F), ForeColor = Color.FromArgb(21, 128, 61), BackColor = Color.White, Location = new Point(14, 32) };
        barra.Controls.Add(_aviso);
        imprimir.Click += async (_, _) =>
        {
            if (impressoraTermo.Length > 0) { await ImprimirDireto(impressoraTermo); return; }
            try { await _web.CoreWebView2.ExecuteScriptAsync("window.print()"); } catch { /* ainda carregando */ }
        };
        fechar.Click += (_, _) => Close();
        barra.Controls.AddRange([titulo_, imprimir, fechar]);
        void Posicionar() { fechar.Location = new Point(barra.ClientSize.Width - fechar.Width - 14, 10); imprimir.Location = new Point(fechar.Left - imprimir.Width - 8, 10); }
        barra.Resize += (_, _) => Posicionar();
        Posicionar();
        Controls.Add(_web);
        Controls.Add(barra);
        Load += async (_, _) =>
        {
            try
            {
                await _web.EnsureCoreWebView2Async(await Ambiente());
                _web.CoreWebView2.Settings.AreDevToolsEnabled = false;
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
        var b = new Button { Text = texto, Size = new Size(116, 34), FlatStyle = FlatStyle.Flat, BackColor = fundo, ForeColor = letra, Font = new Font("Segoe UI", 9.5F, FontStyle.Bold), Cursor = Cursors.Hand, Anchor = AnchorStyles.Top | AnchorStyles.Right };
        b.FlatAppearance.BorderSize = 0;
        return b;
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
