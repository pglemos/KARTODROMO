using System.IO.Ports;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

/// <summary>
/// Painel de LED antigo (posições 1 a 10) ligado na serial — o mesmo que o LapTime alimentava como
/// "ScoreBoard CalXPro, modelo CalProducts (protocolo 1)": COM3, 9600 8N1, 10 linhas, nº do kart "000".
/// Formato copiado do LapTime.Server (StartMenu.RegisterScoreBoardLinesAsync / WriteOnScoreBoardAsync):
///   ao abrir:            $I,"HH:mm:ss.fff","ddMMyy"
///   treino/classificação $SP,pos,"kkk",voltas,"melhor"  ·  $J,"kkk","melhor","total"  ·  $H,pos,"kkk",voltas,"última"
///   corrida              $SR,pos,"kkk",voltas,"última"  ·  $J,"kkk","última","total"   ·  $G,pos,"kkk",voltas,"última"
///   depois das linhas    $F,voltas restantes,"tempo restante","hora","tempo de prova"
/// Configuração da máquina em C:\ProgramData\Kartodromo\painel-led.json ({"porta":"COM3"}); sem o arquivo fica desligado.
/// </summary>
sealed class PainelLed : IDisposable
{
    public static readonly string ArquivoConfig = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Kartodromo", "painel-led.json");

    public string Porta { get; private set; } = "";
    public int Baud { get; private set; } = 9600;
    public int Linhas { get; private set; } = 10;
    public bool Ativo => Porta.Length > 0;
    public string Situacao { get; private set; } = "desligado";
    public bool Ok { get; private set; }
    /// <summary>Página do placar: 0 = 1º a 10º, 1 = 11º a 20º, 2 = 21º a 30º (para montar o grid depois da tomada de tempo).</summary>
    public int Pagina { get; private set; }
    /// <summary>Quantas páginas a bateria atual tem (1 a 3), pelo número de karts com volta.</summary>
    public int Paginas { get; private set; } = 1;
    public const int MaxPaginas = 3;
    bool _limparAntes;

    public void MudarPagina(int pagina)
    {
        var nova = Math.Clamp(pagina, 0, MaxPaginas - 1);
        if (nova == Pagina) return;
        Pagina = nova;
        _assinatura = null; _limparAntes = true; // limpa o painel e manda a página nova já
    }

    /// <summary>Karts que aparecem no placar (os que já têm volta), na ordem da classificação.</summary>
    public static List<JsonObject> Classificados(JsonObject sessao) => (sessao?["standings"] as JsonArray ?? [])
        .OfType<JsonObject>()
        .Where(r => r.I("position") > 0 && r["lastLapMs"] is not null)
        .OrderBy(r => r.I("position"))
        .ToList();

    SerialPort _serial;
    string _sessao, _assinatura;
    DateTime _ultimoEnvio = DateTime.MinValue, _proximaTentativa = DateTime.MinValue;

    public PainelLed() => LerConfig();

    public void LerConfig()
    {
        try
        {
            if (!File.Exists(ArquivoConfig)) { Porta = ""; return; }
            var j = JsonNode.Parse(File.ReadAllText(ArquivoConfig))?.AsObject();
            Porta = j?["porta"]?.GetValue<string>()?.Trim().ToUpperInvariant() ?? "";
            Baud = j?["baud"]?.GetValue<int>() ?? 9600;
            Linhas = j?["linhas"]?.GetValue<int>() ?? 10;
        }
        catch (Exception e) { Porta = ""; Situacao = "configuração inválida: " + e.Message; }
    }

    public static void SalvarConfig(string porta)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(ArquivoConfig)!);
        File.WriteAllText(ArquivoConfig, JsonSerializer.Serialize(new { porta, baud = 9600, linhas = 10 }));
    }

    bool Abrir()
    {
        if (_serial is { IsOpen: true }) return true;
        if (DateTime.Now < _proximaTentativa) return false;
        try
        {
            _serial?.Dispose();
            // igual ao LapTime: 8N1, RTS ligado, DTR desligado
            _serial = new SerialPort(Porta, Baud, Parity.None, 8, StopBits.One) { RtsEnable = true, DtrEnable = false, WriteTimeout = 1000, Encoding = Encoding.ASCII, NewLine = "\r\n" };
            _serial.Open();
            var agora = DateTime.Now;
            Escrever($"$I,\"{agora:HH:mm:ss.fff}\",\"{agora:ddMMyy}\"\r\n");
            _sessao = null; _assinatura = null;
            Ok = true; Situacao = $"{Porta} conectado";
            return true;
        }
        catch (Exception e)
        {
            Ok = false; Situacao = $"{Porta}: {e.Message}";
            _proximaTentativa = DateTime.Now.AddSeconds(10);
            return false;
        }
    }

    void Escrever(string pacote)
    {
        // o LapTime mandava o pacote + NewLine
        _serial.Write(pacote + "\r\n");
    }

    /// <summary>Chamado a cada atualização da tela (≈1 s). Manda o quadro quando a classificação muda e a cada 5 s.</summary>
    public void Atualizar(JsonObject sessao)
    {
        if (!Ativo) { Situacao = "desligado"; Ok = false; return; }
        if (!Abrir()) return;
        try
        {
            var id = sessao?.S("id");
            if (id != _sessao)
            {
                var agora = DateTime.Now;
                Escrever($"$I,\"{agora:HH:mm:ss.fff}\",\"{agora:ddMMyy}\"\r\n"); // nova bateria: limpa o painel
                _sessao = id; _assinatura = null;
                Pagina = 0; _limparAntes = false; // bateria nova volta para 1º a 10º
            }
            if (sessao == null) return;
            Paginas = Math.Clamp((Classificados(sessao).Count + Linhas - 1) / Linhas, 1, MaxPaginas);
            if (Pagina >= Paginas) MudarPagina(Paginas - 1);
            if (_limparAntes)
            {
                // troca de página: apaga as linhas da página anterior antes de mandar a nova
                var agora = DateTime.Now;
                Escrever($"$I,\"{agora:HH:mm:ss.fff}\",\"{agora:ddMMyy}\"\r\n");
                _limparAntes = false;
            }
            var pacote = Montar(sessao, Linhas, DateTime.Now, out var assinatura, Pagina);
            if (pacote.Length == 0) return;
            if (assinatura == _assinatura && DateTime.Now - _ultimoEnvio < TimeSpan.FromSeconds(5)) return;
            Escrever(pacote);
            _assinatura = assinatura; _ultimoEnvio = DateTime.Now;
            Ok = true; Situacao = $"{Porta} ok";
        }
        catch (Exception e)
        {
            Ok = false; Situacao = $"{Porta}: {e.Message}";
            try { _serial?.Dispose(); } catch { }
            _serial = null;
        }
    }

    static string Hora(long? ms) { var t = TimeSpan.FromMilliseconds(Math.Max(0, ms ?? 0)); return $"{(int)t.TotalHours % 24:00}:{t.Minutes:00}:{t.Seconds:00}.{t.Milliseconds:000}"; }

    /// <summary>Monta o quadro do LapTime (protocolo 1). Público para teste.</summary>
    public static string Montar(JsonObject sessao, int linhas, DateTime agora, out string assinatura, int pagina = 0)
    {
        var corrida = sessao.S("type") == "corrida";
        // o painel tem 10 linhas: a página 2 mostra o 11º ao 20º nas linhas 1 a 10, e assim por diante
        var standings = Classificados(sessao).Skip(pagina * linhas).Take(linhas).ToList();
        var sb = new StringBuilder();
        var pos = 0;
        foreach (var r in standings)
        {
            pos++;
            var kart = int.TryParse(r.S("kart"), out var k) ? k.ToString("000") : r.S("kart");
            var voltas = r.I("laps");
            var ultima = Hora(r.L("lastLapMs"));
            var melhor = r["bestLapMs"] is null ? null : Hora(r.L("bestLapMs"));
            var total = Hora(r.L("totalMs"));
            if (corrida)
            {
                sb.Append($"$SR,{pos},\"{kart}\",{voltas},\"{ultima}\"\r\n");
                sb.Append($"$J,\"{kart}\",\"{ultima}\",\"{total}\"\r\n");
                sb.Append($"$G,{pos},\"{kart}\",{voltas},\"{ultima}\"\r\n");
            }
            else
            {
                var tempo = melhor ?? ultima;
                sb.Append($"$SP,{pos},\"{kart}\",{voltas},\"{tempo}\"\r\n");
                sb.Append($"$J,\"{kart}\",\"{tempo}\",\"{total}\"\r\n");
                sb.Append($"$H,{pos},\"{kart}\",{voltas},\"{ultima}\"\r\n");
            }
        }
        assinatura = $"p{pagina}|" + sb;
        if (sb.Length == 0) return "";
        var lider = Classificados(sessao).FirstOrDefault()?.I("laps") ?? 0; // líder de verdade, não o 1º da página
        var voltasRestantes = sessao["maxLaps"] is JsonValue && sessao.I("maxLaps") > 0 ? Math.Max(0, sessao.I("maxLaps") - lider) : 0;
        sb.Append($"$F,{voltasRestantes},\"{Hora(sessao.L("remainingMs"))}\",\"{agora:HH:mm:ss.fff}\",\"{Hora(sessao.L("elapsedMs"))}\"\r\n");
        return sb.ToString();
    }

    public void Dispose()
    {
        try { _serial?.Dispose(); } catch { }
        _serial = null;
    }
}
