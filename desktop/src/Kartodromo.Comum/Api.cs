using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Kartodromo.Comum;

/// <summary>Configuracao lida do appsettings.json ao lado do .exe.</summary>
public static class Config
{
    static JsonObject _cfg;
    static JsonObject Cfg
    {
        get
        {
            if (_cfg != null) return _cfg;
            var arq = Path.Combine(AppContext.BaseDirectory, "appsettings.json");
            try { _cfg = File.Exists(arq) ? JsonNode.Parse(File.ReadAllText(arq))?.AsObject() : null; } catch { _cfg = null; }
            return _cfg ??= new JsonObject();
        }
    }
    public static string Get(string chave, string padrao) => Cfg[chave]?.GetValue<string>() is { Length: > 0 } v ? v : padrao;
    public static string ServidorUrl => Get("ServidorUrl", "http://192.168.20.13:4060").TrimEnd('/');
    public static string CronoUrl => Get("CronometragemUrl", "http://192.168.20.249:4050").TrimEnd('/');
    public static string ChaveCrono => Get("ChaveCronometragem", "");
    public static string Impressora => Get("Impressora", "");
}

public class ApiException(string msg, int status) : Exception(msg)
{
    public int Status { get; } = status;
}

/// <summary>Cliente HTTP/JSON do servidor da operacao (SRVKART) e da cronometragem.</summary>
public class Api
{
    readonly HttpClient _http;
    public string BaseUrl { get; }
    public string Token { get; set; }
    public string Chave { get; set; }
    public string ChaveTiming { get; set; }

    public Api(string baseUrl, TimeSpan? timeout = null)
    {
        BaseUrl = baseUrl.TrimEnd('/');
        _http = new HttpClient { Timeout = timeout ?? TimeSpan.FromSeconds(30) };
    }

    public static Api Servidor { get; } = new(Config.ServidorUrl);

    public async Task<JsonNode> Enviar(HttpMethod metodo, string caminho, object corpo = null)
    {
        using var req = new HttpRequestMessage(metodo, BaseUrl + caminho);
        if (!string.IsNullOrEmpty(Token)) req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Token);
        if (!string.IsNullOrEmpty(Chave)) req.Headers.Add("x-ops-key", Chave);
        if (!string.IsNullOrEmpty(ChaveTiming)) req.Headers.Add("x-timing-key", ChaveTiming);
        if (corpo != null)
        {
            var json = corpo is JsonNode n ? n.ToJsonString() : JsonSerializer.Serialize(corpo);
            req.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }
        HttpResponseMessage resp;
        try { resp = await _http.SendAsync(req); }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException)
        {
            throw new ApiException("Não foi possível falar com o servidor. Verifique a rede e se o servidor está ligado.", 0);
        }
        // o servidor manda um login novo antes do atual vencer (a Recepção fica aberta dias seguidos)
        if (resp.Headers.TryGetValues("X-Novo-Token", out var novos) && novos.FirstOrDefault() is { Length: > 0 } novo) Token = novo;
        var texto = await resp.Content.ReadAsStringAsync();
        JsonNode dados = null;
        try { dados = string.IsNullOrWhiteSpace(texto) ? null : JsonNode.Parse(texto); } catch { /* html / vazio */ }
        if (!resp.IsSuccessStatusCode)
        {
            var msg = dados?["error"]?.GetValue<string>() ?? $"Erro {(int)resp.StatusCode} no servidor.";
            throw new ApiException(msg, (int)resp.StatusCode);
        }
        return dados;
    }

    public Task<JsonNode> Get(string c) => Enviar(HttpMethod.Get, c);
    public Task<JsonNode> Post(string c, object corpo = null) => Enviar(HttpMethod.Post, c, corpo ?? new { });
    public Task<JsonNode> Put(string c, object corpo) => Enviar(HttpMethod.Put, c, corpo);
    public Task<JsonNode> Patch(string c, object corpo) => Enviar(HttpMethod.Patch, c, corpo);
    public Task<JsonNode> Delete(string c) => Enviar(HttpMethod.Delete, c);

    public async Task<List<JsonObject>> Lista(string c)
    {
        var n = await Get(c);
        return n is JsonArray a ? a.Where(x => x is JsonObject).Cast<JsonObject>().ToList() : [];
    }

    /// <summary>Monta a URL de um relatorio/termo com o token na query (abre no visualizador).</summary>
    public string UrlComToken(string caminho) => BaseUrl + caminho + (caminho.Contains('?') ? "&" : "?") + "t=" + Uri.EscapeDataString(Token ?? "");
}

/// <summary>Leitura confortavel de JsonObject.</summary>
public static class J
{
    public static string S(this JsonNode o, string k)
    {
        var v = o?[k];
        if (v == null) return "";
        return v.GetValueKind() switch
        {
            JsonValueKind.String => v.GetValue<string>(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            JsonValueKind.Null => "",
            _ => v.ToJsonString(),
        };
    }
    public static long? L(this JsonNode o, string k)
    {
        var v = o?[k];
        if (v == null || v.GetValueKind() == JsonValueKind.Null) return null;
        if (v.GetValueKind() == JsonValueKind.Number) return (long)Num(v);
        return long.TryParse(v.ToString(), out var x) ? x : null;
    }
    public static int I(this JsonNode o, string k) => (int)(o.L(k) ?? 0);
    public static bool B(this JsonNode o, string k)
    {
        var v = o?[k];
        if (v == null) return false;
        return v.GetValueKind() switch
        {
            JsonValueKind.True => true,
            JsonValueKind.Number => Num(v) != 0,
            JsonValueKind.String => v.GetValue<string>() is "true" or "1",
            _ => false,
        };
    }
    public static DateTime? D(this JsonNode o, string k) => Fmt.ParseData(o.S(k));
    /// <summary>Numero de um JsonNode vindo do parse ou criado no codigo (int/long/decimal).</summary>
    static decimal Num(JsonNode v) => decimal.Parse(v.ToJsonString(), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture);
}
