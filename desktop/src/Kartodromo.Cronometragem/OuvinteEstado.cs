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

    volatile bool _conectado;
    /// <summary>Item 27: leitura segura entre a task de fundo e a thread da tela.</summary>
    public bool Conectado => _conectado;
    public event Action<bool> ConexaoAlterada;

    void DefinirConectado(bool valor)
    {
        if (_conectado == valor) return;
        _conectado = valor;
        try { ConexaoAlterada?.Invoke(valor); } catch { /* assinante não derruba o ouvinte */ }
    }

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
                // Item 28: o fluxo SSE não tem fim (Timeout infinito no HttpClient), mas a conexão inicial precisa responder em 10 s
                using var limite = CancellationTokenSource.CreateLinkedTokenSource(_parar.Token);
                limite.CancelAfter(TimeSpan.FromSeconds(10));
                using var resposta = await _http.GetAsync(_url, HttpCompletionOption.ResponseHeadersRead, limite.Token);
                resposta.EnsureSuccessStatusCode();
                using var fluxo = await resposta.Content.ReadAsStreamAsync(_parar.Token);
                using var leitor = new StreamReader(fluxo, Encoding.UTF8);
                DefinirConectado(true);
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
            DefinirConectado(false);
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
