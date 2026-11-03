using System.Drawing.Printing;
using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

/// <summary>
/// Imprime na TM-T20 da recepção os termos que chegam do totem (fila do servidor), como o
/// LapTime fazia pelo servidor dele. Só liga no computador cujo appsettings.json tem
/// "ImpressoraTermos" (nome da impressora do Windows, ex.: "TMT20").
/// </summary>
public static class AgenteImpressao
{
    static bool _ocupado;
    static DateTime _pausaAte;
    static string _impressora, _ultimoErro;
    public static string Situacao { get; private set; } = "";

    public static void Iniciar(Form dono)
    {
        _impressora = Config.Get("ImpressoraTermos", "");
        if (string.IsNullOrWhiteSpace(_impressora)) return;

        bool existe;
        try
        {
            existe = PrinterSettings.InstalledPrinters.Cast<string>()
                .Any(p => string.Equals(p, _impressora, StringComparison.OrdinalIgnoreCase));
        }
        catch (Exception ex)
        {
            existe = false;
            Log($"ATENÇÃO: erro ao listar impressoras para '{_impressora}': {ex.Message}");
        }

        if (!existe)
        {
            Situacao = "Impressora dos termos não encontrada";
            Log($"ATENÇÃO: impressora '{_impressora}' não existe neste computador. Polling de impressão não iniciado.");
            return;
        }

        Situacao = "Termos do totem: " + _impressora;
        Log($"agente ligado, impressora {_impressora}");
        var t = new System.Windows.Forms.Timer { Interval = 3000 };
        t.Tick += async (_, _) => await Rodada(dono);
        dono.FormClosed += (_, _) => { t.Stop(); t.Dispose(); };
        t.Start();
    }

    static async Task Rodada(Form dono)
    {
        if (_ocupado || dono.IsDisposed || DateTime.Now < _pausaAte) return;
        _ocupado = true;
        try
        {
            var (spoolerOk, motivoSpooler) = Relatorio.VerificarSpooler(_impressora);
            if (!spoolerOk && motivoSpooler != null && (motivoSpooler.Contains("offline") || motivoSpooler.Contains("papel") || motivoSpooler.Contains("Tampa") || motivoSpooler.Contains("Erro")))
            {
                Situacao = $"Impressora {_impressora}: {motivoSpooler}";
                Log($"Alerta no spooler da impressora '{_impressora}': {motivoSpooler}");
                _pausaAte = DateTime.Now.AddSeconds(15);
                return;
            }

            var job = await Sessao.Api.Get("/api/office/impressao/proxima") as JsonObject;
            if (_ultimoErro != null) { Situacao = "Termos do totem: " + _impressora; Log("agente voltou a falar com o servidor"); }
            _ultimoErro = null;
            if (job?.L("id") is not long id) return;
            try
            {
                await Relatorio.ImprimirSilencioso(Sessao.Api.BaseUrl + job.S("url"), _impressora);
                await Sessao.Api.Post($"/api/office/impressao/{id}/feita");
                Situacao = $"Último termo do {job.S("origem")} impresso às {DateTime.Now:HH:mm}";
                Log($"#{id} impresso ({job.S("origem")})");
            }
            catch (Exception e)
            {
                Situacao = "Falha ao imprimir termo: " + e.Message;
                Log($"#{id} FALHOU: {e.Message}");
                _pausaAte = DateTime.Now.AddSeconds(20); // impressora sem papel/desligada: tenta de novo daqui a pouco
                try { Relatorio.LimparFilaSpooler(_impressora); } catch { }
                try { await Sessao.Api.Post($"/api/office/impressao/{id}/falhou"); } catch { }
            }
        }
        catch (Exception e)
        {
            if (e is ApiException { Status: 401 })
            {
                Situacao = "Sessão expirada (401) - faça login novamente";
                Log("Sessão expirada (401) ao buscar impressões. Operador precisa reautenticar.");
                _pausaAte = DateTime.Now.AddSeconds(30);
            }
            else
            {
                if (e.Message != _ultimoErro)
                {
                    Log("sem contato com o servidor: " + e.Message);
                    Situacao = "Termos do totem PARADOS: " + e.Message;
                }
            }
            _ultimoErro = e.Message;
        }
        finally { _ocupado = false; }
    }

    static void Log(string msg)
    {
        try
        {
            var pasta = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Kartodromo");
            Directory.CreateDirectory(pasta);
            File.AppendAllText(Path.Combine(pasta, "recepcao-impressao.log"), $"{DateTime.Now:dd/MM HH:mm:ss} {msg}{Environment.NewLine}");
        }
        catch { }
    }
}
