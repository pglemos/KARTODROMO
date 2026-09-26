using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

static class Program
{
    [STAThread]
    static void Main()
    {
        ApplicationConfiguration.Initialize();
        KitVisual.Instalar();
        Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
        Application.ThreadException += (_, e) => MessageBox.Show(e.Exception.Message, "Kartódromo - Módulo Office", MessageBoxButtons.OK, MessageBoxIcon.Error);
        Thread.CurrentThread.CurrentCulture = Fmt.Br;
        Thread.CurrentThread.CurrentUICulture = Fmt.Br;
        var args = Environment.GetCommandLineArgs();
        if (args.Length >= 5 && args[1] is "--autoteste" or "--teste-relatorio")
        {
            var ctx = new ApplicationContext();
            Application.Idle += Inicio;
            async void Inicio(object s, EventArgs e)
            {
                Application.Idle -= Inicio;
                try
                {
                    long.TryParse(args.ElementAtOrDefault(5), out var reservaIdTeste);
                    long.TryParse(args.ElementAtOrDefault(6), out var vendaIdTeste);
                    long.TryParse(args.ElementAtOrDefault(7), out var movimentoIdTeste);
                    if (args[1] == "--teste-relatorio") await AutoTeste.RodarRelatorios(args[2], args[3], args[4]);
                    else
                        await AutoTeste.Rodar(args[2], args[3], args[4], reservaIdTeste, vendaIdTeste, movimentoIdTeste);
                }
                catch (Exception ex) { File.WriteAllText(Path.Combine(args[2], "erro.txt"), ex.ToString()); }
                ctx.ExitThread();
            }
            Application.Run(ctx);
            return;
        }
        using var login = new FormLogin();
        if (login.ShowDialog() != DialogResult.OK) return;
        Application.Run(new FormPrincipal());
    }
}

/// <summary>Usuario logado + dados de apoio (produtos, formas, tracados...) + parametros.</summary>
public static class Sessao
{
    public static Api Api => Api.Servidor;
    public static JsonObject Usuario { get; set; }
    public static JsonObject Apoio { get; private set; }
    public static bool Admin => Usuario.B("admin");
    public static string Nome => Usuario.S("nome");

    public static async Task CarregarApoio() => Apoio = (await Api.Get("/api/office/apoio")).AsObject();

    public static List<JsonObject> Lista(string k) => Apoio?[k] is JsonArray a ? a.OfType<JsonObject>().ToList() : [];
    public static string Param(string k) => Apoio?["parametros"]?[k]?.GetValue<string>();
    public static bool ParamSim(string k, bool padrao) => Param(k) is { } v ? v == "true" : padrao;

    public static Campos.Item[] Produtos(bool soAtivos = true) =>
        Lista("produtos").Where(p => !soAtivos || p.B("ativo")).Select(p => new Campos.Item(p.L("id") ?? 0, $"{p.S("nome")} — {Fmt.Brl(p.L("preco"))}", p)).ToArray();
    public static Campos.Item[] Tracados() => Lista("tracados").Select(t => new Campos.Item(t.L("id") ?? 0, t.S("nome"), t)).ToArray();
    public static Campos.Item[] Formas() => Lista("formas").Select(f => new Campos.Item(f.L("id") ?? 0, f.S("nome"), f)).ToArray();
    public static Campos.Item[] Padroes() => Lista("padroes").Select(p => new Campos.Item(p.L("id") ?? 0, p.S("nome"), p)).ToArray();
}
