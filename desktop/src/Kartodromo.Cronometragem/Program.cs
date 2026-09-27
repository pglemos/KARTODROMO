using System.Globalization;
using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

static class Program
{
    [STAThread]
    static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
        Application.ThreadException += (_, e) =>
        {
            // em teste automático nenhuma caixa pode aparecer na tela de quem está usando o PC
            if (Environment.GetEnvironmentVariable("KARTODROMO_TESTE") is { Length: > 0 }) { File.AppendAllText(Path.Combine(Path.GetTempPath(), "crono-teste-erro.txt"), DateTime.Now + " " + e.Exception + Environment.NewLine); Environment.Exit(3); }
            Diagnostico.Registrar(Form.ActiveForm?.Text ?? "", e.Exception);
            MessageBox.Show(e.Exception.Message, "Kartódromo - Cronometragem", MessageBoxButtons.OK, MessageBoxIcon.Error);
        };
        Thread.CurrentThread.CurrentCulture = Fmt.Br;
        Thread.CurrentThread.CurrentUICulture = Fmt.Br;
        var args = Environment.GetCommandLineArgs();
        if (args.Length >= 2 && args[1] == "--test-painel") { TestesPainel.Executar(); return; }
        if (args.Length >= 3 && args[1] == "--autoteste") { Application.Run(new FormCrono(args[2])); return; }
        if (args.Length >= 2 && args[1] == "--tv") { Application.Run(FormTV.Sozinha()); return; }
        Application.Run(new FormCrono(null));
    }
}

/// <summary>Acesso ao servico de cronometragem (ORBITS :4050) e formatos de tempo.</summary>
public static class Crono
{
    public static readonly Api Api = new(Config.CronoUrl, TimeSpan.FromSeconds(8));

    public static string Volta(long? ms)
    {
        if (ms is not long v) return "";
        // formato do canvas (AoVivo.dc.html): 55.214 · 1:02.470 · 12:57.041 · 1:02:03.456
        var t = TimeSpan.FromMilliseconds(v);
        return t.TotalHours >= 1 ? t.ToString(@"h\:mm\:ss\.fff", CultureInfo.InvariantCulture)
            : t.TotalMinutes >= 1 ? $"{(int)t.TotalMinutes}:{t.Seconds:00}.{t.Milliseconds:000}"
            : $"{t.Seconds}.{t.Milliseconds:000}";
    }

    /// <summary>Formato antigo (mm:ss.fff), só para o telão --tv, que não muda.</summary>
    public static string VoltaTv(long? ms)
    {
        if (ms is not long v) return "";
        var t = TimeSpan.FromMilliseconds(v);
        return t.TotalHours >= 1 ? t.ToString(@"h\:mm\:ss\.fff", CultureInfo.InvariantCulture) : t.ToString(@"mm\:ss\.fff", CultureInfo.InvariantCulture);
    }

    /// <summary>Hora da passagem como no canvas: 18:55:19.4 (décimo de segundo).</summary>
    public static string HoraCurta(long? wallMs) => Hora(wallMs) is { Length: >= 10 } h ? h[..10] : Hora(wallMs);

    public static string Relogio(long? ms)
    {
        if (ms is not long v) return "--:--:--.---";
        if (v < 0) v = 0;
        var t = TimeSpan.FromMilliseconds(v);
        return $"{(int)t.TotalHours:00}:{t.Minutes:00}:{t.Seconds:00}.{t.Milliseconds:000}";
    }

    public static string Hora(long? wallMs) => wallMs is long w ? DateTimeOffset.FromUnixTimeMilliseconds(w).ToLocalTime().ToString("HH:mm:ss.fff") : "";

    public static string Estado(string s) => s switch
    {
        "preparando" => "Preparando",
        "em_andamento" => "Em andamento",
        "bandeira_final" => "Bandeira final",
        "encerrada" => "Encerrada",
        "cancelada" => "Cancelada",
        _ => s,
    };

    public static string Tipo(string s) => s switch { "treino" => "Treino", "classificacao" => "Tomada de tempo", "corrida" => "Corrida", _ => s };

    public static Color CorEstado(string s) => s switch
    {
        "em_andamento" => Color.FromArgb(16, 124, 16),
        "bandeira_final" => Color.FromArgb(40, 40, 40),
        "preparando" => Color.FromArgb(0, 99, 177),
        "cancelada" => Color.FromArgb(160, 160, 160),
        _ => Color.FromArgb(90, 90, 90),
    };

    public static List<JsonObject> Arr(JsonNode n, string k) => n?[k] is JsonArray a ? a.OfType<JsonObject>().ToList() : [];
}
