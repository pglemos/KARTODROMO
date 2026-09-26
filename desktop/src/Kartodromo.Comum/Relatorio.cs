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
        var barra = new ToolStrip { GripStyle = ToolStripGripStyle.Hidden, Font = Tema.Normal, Padding = new Padding(6, 2, 6, 2) };
        barra.Items.Add(new ToolStripButton("🖨  Imprimir", null, async (_, _) => { try { await _web.CoreWebView2.ExecuteScriptAsync("window.print()"); } catch { /* ainda carregando */ } }));
        barra.Items.Add(new ToolStripSeparator());
        barra.Items.Add(new ToolStripButton("Fechar", null, (_, _) => Close()));
        Controls.Add(_web);
        Controls.Add(barra);
        Load += async (_, _) =>
        {
            try
            {
                await _web.EnsureCoreWebView2Async(await Ambiente());
                _web.CoreWebView2.Settings.AreDevToolsEnabled = false;
                _web.Source = new Uri(url);
            }
            catch (Exception e) { Msg.Erro(this, "Não foi possível abrir o relatório (WebView2): " + e.Message); }
        };
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
