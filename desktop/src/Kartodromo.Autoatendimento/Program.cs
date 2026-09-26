using Kartodromo.Comum;

namespace Kartodromo.Autoatendimento;

static class Program
{
    [STAThread]
    static void Main()
    {
        using var unico = new Mutex(true, "Kartodromo.Autoatendimento", out var primeiro);
        var args = Environment.GetCommandLineArgs();
        var autoteste = args.Length >= 3 && args[1] == "--autoteste";
        if (!primeiro && !autoteste) return;
        ApplicationConfiguration.Initialize();
        Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
        Application.ThreadException += (_, e) => Log("erro: " + e.Exception);
        Thread.CurrentThread.CurrentCulture = Fmt.Br;
        Thread.CurrentThread.CurrentUICulture = Fmt.Br;
        var urlTeste = autoteste ? Environment.GetEnvironmentVariable("KARTODROMO_AUTOATENDIMENTO_TEST_URL") : null;
        var apiTeste = string.IsNullOrWhiteSpace(urlTeste) ? null : new Api(urlTeste);
        var form = new FormTotem(autoteste ? args[2] : null, apiTeste);
        Application.Run(form);
    }

    public static void Log(string msg)
    {
        try
        {
            var pasta = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Kartodromo");
            Directory.CreateDirectory(pasta);
            File.AppendAllText(Path.Combine(pasta, "autoatendimento.log"), $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} {msg}{Environment.NewLine}");
        }
        catch { /* log nunca derruba o totem */ }
    }
}
