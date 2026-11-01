using System.Text;
using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

/// <summary>
/// Escuta o fluxo /api/events do serviço de cronometragem e entrega cada "state" na thread da tela, no instante em que
/// o serviço manda (passagem de kart sai em ~20 ms). Antes a tela e o placar de LED da COM3 só viam a passagem no
/// próximo ciclo de 1 s. Se a conexão cair, tenta de novo em 2 s; o ciclo de 1 s continua como reserva.
/// </summary>
sealed class OuvinteEstado : IDisposable
{
    readonly string _url;
    readonly SynchronizationContext _tela;
    readonly Action<JsonObject> _aoReceber;
    readonly CancellationTokenSource _parar = new();
    readonly HttpClient _http = new() { Timeout = Timeout.InfiniteTimeSpan };

    public bool Conectado { get; private set; }

    public OuvinteEstado(string url, Action<JsonObject> aoReceber)
    {
        _url = url;
        _aoReceber = aoReceber;
        _tela = SynchronizationContext.Current ?? new WindowsFormsSynchronizationContext();
        _http.DefaultRequestHeaders.TryAddWithoutValidation("X-Client-Machine", Environment.MachineName);
        if (Config.Get("ChaveCronometragem", "") is { Length: > 0 } chaveCrono)
            _http.DefaultRequestHeaders.TryAddWithoutValidation("X-Timing-Key", chaveCrono);
    }

    public void Iniciar() => _ = Task.Run(Loop);

    async Task Loop()
    {
        while (!_parar.IsCancellationRequested)
        {
            try
            {
                using var resposta = await _http.GetAsync(_url, HttpCompletionOption.ResponseHeadersRead, _parar.Token);
                resposta.EnsureSuccessStatusCode();
                using var fluxo = await resposta.Content.ReadAsStreamAsync(_parar.Token);
                using var leitor = new StreamReader(fluxo, Encoding.UTF8);
                Conectado = true;
                string evento = null;
                var dados = new StringBuilder();
                // sem nada por 40 s (o serviço manda ": ping" a cada 15 s) = conexão morta: reconecta
                while (!_parar.IsCancellationRequested)
                {
                    var leitura = leitor.ReadLineAsync(_parar.Token).AsTask();
                    if (await Task.WhenAny(leitura, Task.Delay(40_000, _parar.Token)) != leitura) break;
                    var linha = await leitura;
                    if (linha == null) break;
                    if (linha.Length == 0)
                    {
                        if (evento == "state" && dados.Length > 0) Entregar(dados.ToString());
                        evento = null; dados.Clear();
                    }
                    else if (linha.StartsWith("event:")) evento = linha[6..].Trim();
                    else if (linha.StartsWith("data:")) { if (dados.Length > 0) dados.Append('\n'); dados.Append(linha.AsSpan(5).TrimStart()); }
                }
            }
            catch (OperationCanceledException) when (_parar.IsCancellationRequested) { return; }
            catch (Exception) { /* serviço fora ou rede caiu: o ciclo de 1 s segue; tenta de novo abaixo */ }
            Conectado = false;
            try { await Task.Delay(2_000, _parar.Token); } catch (OperationCanceledException) { return; }
        }
    }

    void Entregar(string json)
    {
        JsonObject estado;
        try { estado = JsonNode.Parse(json)?.AsObject(); } catch { return; }
        if (estado == null) return;
        _tela.Post(_ => { if (!_parar.IsCancellationRequested) _aoReceber(estado); }, null);
    }

    public void Dispose()
    {
        _parar.Cancel();
        _http.Dispose();
    }
}
