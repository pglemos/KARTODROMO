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

    // Paginação para montagem de grid (1 a 10, 11 a 20, 21 a 30)
    public int Pagina { get; private set; } = 0;
    public int TotalPaginas { get; private set; } = 1;
    public int TotalPilotos { get; private set; } = 0;
    public bool AutoAvanco { get; set; } = false;
    public int IntervaloAutoAvancoSegundos { get; set; } = 5;
    public event Action<int> PaginaAlterada;

    public string SessaoExibidaNome { get; private set; } = "";
    public string SessaoExibidaId { get; private set; } = "";
    public bool EmModoGrid { get; private set; } = false;
    public JsonObject SessaoClassificacao => _sessaoClassificacao;

    SerialPort _serial;
    string _sessaoId;
    int _paginaAnterior = -1;
    JsonObject _sessaoClassificacao;
    DateTime _ultimoEnvio = DateTime.MinValue, _proximaTentativa = DateTime.MinValue, _ultimoAvanco = DateTime.MinValue;
    readonly SemaphoreSlim _semaforoEnvio = new(1, 1);
    readonly object _travaFila = new();
    string _pacotePendente;
    bool _limpezaPendente, _envioEmAndamento, _disposed;
    internal Action<string> EscritorSerial { get; set; }

    public PainelLed() => LerConfig();

    public void LerConfig()
    {
        lock (_travaFila) { _disposed = false; }
        _proximaTentativa = DateTime.MinValue;
        _falhasConsecutivas = 0;
        try
        {
            // testes automáticos nunca abrem a porta serial do placar (a COM3 é da pista)
            if (Environment.GetEnvironmentVariable("KARTODROMO_SEM_PAINEL") == "1") { Porta = ""; return; }
            if (!File.Exists(ArquivoConfig)) { Porta = ""; return; }
            var j = JsonNode.Parse(File.ReadAllText(ArquivoConfig))?.AsObject();
            Porta = j?["porta"]?.GetValue<string>()?.Trim().ToUpperInvariant() ?? "";
            Baud = j?["baud"]?.GetValue<int>() ?? 9600;
            Linhas = j?["linhas"]?.GetValue<int>() ?? 10;
        }
        catch (Exception e) { Porta = ""; Situacao = "configuração inválida: " + e.Message; }
    }

    public static void SalvarConfig(string porta, int baud = 9600, int linhas = 10)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(ArquivoConfig)!);
        File.WriteAllText(ArquivoConfig, JsonSerializer.Serialize(new { porta, baud, linhas }));
    }

    public void DefinirPagina(int pagina)
    {
        DefinirPaginaInterno(pagina, true);
    }

    /// <summary>Aplica uma página recebida do outro computador sem publicá-la de volta.</summary>
    public void DefinirPaginaRemota(int pagina)
    {
        DefinirPaginaInterno(pagina, false);
    }

    void DefinirPaginaInterno(int pagina, bool notificar)
    {
        var clamped = Math.Clamp(pagina, 0, Math.Max(0, TotalPaginas - 1));
        if (clamped != Pagina)
        {
            Pagina = clamped;
            _paginaAnterior = -1; // força reenvio com $I na serial
            if (notificar) PaginaAlterada?.Invoke(Pagina);
        }
    }

    public void ProximaPagina()
    {
        if (TotalPaginas > 1)
        {
            DefinirPagina((Pagina + 1) % TotalPaginas);
        }
    }

    public void DefinirSessaoClassificacao(JsonObject sessao)
    {
        if (sessao == null) return;
        var st = sessao["standings"] as JsonArray;
        if (st != null && st.Count > 0)
        {
            var criado = sessao.L("createdAt") ?? 0;
            var atualCriado = _sessaoClassificacao?.L("createdAt") ?? 0;
            if (_sessaoClassificacao == null || criado >= atualCriado)
                _sessaoClassificacao = sessao;
        }
    }

    int _falhasConsecutivas = 0;

    bool Abrir()
    {
        if (_serial is { IsOpen: true }) return true;
        if (DateTime.Now < _proximaTentativa) return false;
        try
        {
            _serial?.Dispose();
            // igual ao LapTime: 8N1, RTS ligado, DTR desligado, DiscardNull
            _serial = new SerialPort(Porta, Baud, Parity.None, 8, StopBits.One) { RtsEnable = true, DtrEnable = false, DiscardNull = true, WriteTimeout = 1000, Encoding = Encoding.ASCII, NewLine = "\r\n" };
            _serial.Open();
            var agora = DateTime.Now;
            _serial.Write($"$I,\"{agora:HH:mm:ss.fff}\",\"{agora:ddMMyy}\"\r\n");
            Ok = true; Situacao = $"{Porta} conectado";
            _falhasConsecutivas = 0;
            return true;
        }
        catch (Exception e)
        {
            _falhasConsecutivas++;
            var backoffSegundos = Math.Min(15, 2 * _falhasConsecutivas);
            _proximaTentativa = DateTime.Now.AddSeconds(backoffSegundos);
            Ok = false;
            string motivo = e is UnauthorizedAccessException
                ? $"porta {Porta} ocupada por outro programa (verifique se outra tela/Orbits está aberta)"
                : e is FileNotFoundException or IOException
                    ? $"porta {Porta} não encontrada ou desconectada (cabo serial/USB)"
                    : e.Message;
            Situacao = $"{Porta}: {motivo}";
            Diagnostico.Registrar("PainelLed.Abrir", e);
            return false;
        }
    }

    void Escrever(string pacote, bool limparAntes = false)
    {
        if (string.IsNullOrEmpty(pacote) && !limparAntes) return;
        lock (_travaFila)
        {
            if (_disposed) return;
            if (limparAntes) _limpezaPendente = true;
            if (!string.IsNullOrEmpty(pacote)) _pacotePendente = pacote;
            if (_envioEmAndamento) return;
            _envioEmAndamento = true;
        }
        _ = Task.Run(ProcessarFilaAsync);
    }

    async Task ProcessarFilaAsync()
    {
        while (!_disposed)
        {
            await _semaforoEnvio.WaitAsync().ConfigureAwait(false);
            try
            {
                while (!_disposed)
                {
                    string pacote;
                    bool limpar;
                    lock (_travaFila)
                    {
                        if (_pacotePendente == null && !_limpezaPendente)
                        {
                            _envioEmAndamento = false;
                            return;
                        }
                        pacote = _pacotePendente;
                        limpar = _limpezaPendente;
                        _pacotePendente = null;
                        _limpezaPendente = false;
                    }

                    if (DateTime.Now < _proximaTentativa) continue;

                    try
                    {
                        var payload = "";
                        if (limpar)
                        {
                            var agora = DateTime.Now;
                            payload = $"$I,\"{agora:HH:mm:ss.fff}\",\"{agora:ddMMyy}\"\r\n";
                        }
                        if (!string.IsNullOrEmpty(pacote))
                        {
                            payload += pacote.EndsWith("\r\n") ? pacote : pacote + "\r\n";
                        }
                        if (payload.Length == 0) continue;

                        if (EscritorSerial != null)
                        {
                            EscritorSerial(payload);
                            Ok = true;
                            Situacao = $"{(Porta.Length > 0 ? Porta : "COM3")} ok";
                            _falhasConsecutivas = 0;
                        }
                        else if (Abrir())
                        {
                            _serial.Write(payload);
                            Ok = true;
                            Situacao = $"{Porta} ok";
                            _falhasConsecutivas = 0;
                        }
                    }
                    catch (Exception e)
                    {
                        _falhasConsecutivas++;
                        var backoffSegundos = Math.Min(15, 2 * _falhasConsecutivas);
                        _proximaTentativa = DateTime.Now.AddSeconds(backoffSegundos);
                        Ok = false;
                        Situacao = $"{Porta}: {e.Message}";
                        Diagnostico.Registrar("PainelLed.Atualizar", e);
                        try { _serial?.Dispose(); } catch { }
                        _serial = null;
                    }
                }
            }
            finally
            {
                if (_disposed)
                {
                    lock (_travaFila) { _envioEmAndamento = false; }
                }
                _semaforoEnvio.Release();
            }
        }
    }

    /// <summary>
    /// Chamado a cada atualização da tela (≈1 s).
    /// Mantém a classificação da tomada de tempo no painel para montagem do grid até a largada da corrida.
    /// Quando a corrida recebe bandeira verde, zera todos os karts do placar e mostra karts que passaram na linha.
    /// </summary>
    public void Atualizar(JsonObject sessaoFoco, JsonObject sessaoAlternativa = null, int? kartPassou = null)
    {
        try
        {
            if (sessaoAlternativa != null) DefinirSessaoClassificacao(sessaoAlternativa);

            var corridaEmAndamento = sessaoFoco != null && sessaoFoco.S("type") == "corrida" && sessaoFoco.S("state") is "em_andamento" or "bandeira_final";
            var treinoEmAndamento = sessaoFoco != null && sessaoFoco.S("type") != "corrida" && sessaoFoco.S("state") is "em_andamento" or "bandeira_final";

            JsonObject sessaoExibir;
            if (corridaEmAndamento)
            {
                // Corrida em andamento com bandeira verde: desativa modo grid, limpa classificação salva
                _sessaoClassificacao = null;
                EmModoGrid = false;
                sessaoExibir = sessaoFoco;
            }
            else if (treinoEmAndamento)
            {
                EmModoGrid = false;
                sessaoExibir = sessaoFoco;
                DefinirSessaoClassificacao(sessaoFoco);
            }
            else if (sessaoFoco != null && sessaoFoco.S("type") != "corrida" && sessaoFoco.S("state") == "encerrada")
            {
                // Tomada de tempo/treino encerrada: salva classificação para montagem do grid no painel de LED
                DefinirSessaoClassificacao(sessaoFoco);
                sessaoExibir = _sessaoClassificacao ?? sessaoFoco;
                EmModoGrid = true;
            }
            else if (sessaoFoco != null && sessaoFoco.S("type") == "corrida" && sessaoFoco.S("state") == "encerrada")
            {
                // Corrida encerrada: o painel segue com o resultado da corrida (o pódio sai no TB50) até a próxima largada
                EmModoGrid = false;
                sessaoExibir = sessaoFoco;
            }
            else
            {
                // Bateria em preparação (ou nula): mantém a classificação da tomada de tempo para montagem do grid
                if (_sessaoClassificacao != null)
                {
                    sessaoExibir = _sessaoClassificacao;
                    EmModoGrid = true;
                }
                else
                {
                    sessaoExibir = sessaoFoco;
                    EmModoGrid = false;
                }
            }

            if (sessaoExibir == null) return;

            var id = sessaoExibir.S("id");
            var nome = sessaoExibir.S("name");
            SessaoExibidaId = id;
            SessaoExibidaNome = nome;

            // Total de pilotos e páginas
            var rawStandings = (sessaoExibir["standings"] as JsonArray ?? []).OfType<JsonObject>();
            var corrida = sessaoExibir.S("type") == "corrida";
            TotalPilotos = corrida
                ? rawStandings.Count(r => r.I("position") > 0 && (r["lastLapMs"] is not null || r.I("laps") > 0 || r["lastCrossingWallMs"] is not null))
                : rawStandings.Count(r => r.I("position") > 0);
            TotalPaginas = Math.Max(1, (int)Math.Ceiling(TotalPilotos / (double)Linhas));

            // Auto-avanço de páginas a cada N segundos se ativado
            if (AutoAvanco && TotalPaginas > 1 && DateTime.Now - _ultimoAvanco >= TimeSpan.FromSeconds(IntervaloAutoAvancoSegundos))
            {
                DefinirPagina((Pagina + 1) % TotalPaginas);
                _ultimoAvanco = DateTime.Now;
            }

            if (Pagina >= TotalPaginas) DefinirPagina(Math.Max(0, TotalPaginas - 1));

            // kart que acabou de cruzar a linha: com o Auto marcado, o painel vai direto para a página dele
            if (AutoAvanco && kartPassou is int kp)
            {
                var linha = rawStandings.FirstOrDefault(r => r.S("kart") is { } k && int.TryParse(k, out var n) && n == kp);
                var posicao = linha?.I("position") ?? 0;
                if (posicao > 0)
                {
                    var paginaDoKart = Math.Min((posicao - 1) / Linhas, TotalPaginas - 1);
                    if (paginaDoKart != Pagina) DefinirPagina(paginaDoKart);
                    // Item 19: Trava temporária na página do piloto que acabou de cruzar a linha
                    _ultimoAvanco = DateTime.Now;
                }
            }

            // Se mudou a sessão ou mudou a página selecionada, manda $I para limpar o painel físico de LED
            var mudouSessao = id != _sessaoId;
            if (mudouSessao) DefinirPagina(0);
            var mudouPagina = Pagina != _paginaAnterior;

            if (!Ativo && EscritorSerial == null) { Situacao = "desligado"; Ok = false; return; }
            if (DateTime.Now < _proximaTentativa) return;

            var limparAntes = false;
            if (mudouSessao || mudouPagina)
            {
                limparAntes = true;
                _sessaoId = id;
                _paginaAnterior = Pagina;
            }

            // A 9600 baud (~960 bytes/s), o quadro inteiro (10 posições × $SR/$J/$G + $F) tem ~1.150 bytes e leva ~1,2 s para transmitir na UART.
            // Para não sobrecarregar o buffer serial, limitamos o envio a no mínimo 800 ms (a menos que tenha mudado sessão, página ou passado kart)
            var agoraEnvio = DateTime.Now;
            if (agoraEnvio - _ultimoEnvio < TimeSpan.FromMilliseconds(800) && kartPassou == null && !mudouSessao && !mudouPagina)
            {
                return;
            }

            var (posicoes, rodape) = MontarQuadro(sessaoExibir, Pagina, Linhas, agoraEnvio);
            var pacote = string.Concat(posicoes) + rodape;
            if (pacote.Length == 0 && !limparAntes) return;
            _ultimoEnvio = agoraEnvio;
            Escrever(pacote, limparAntes);
        }
        catch (Exception e)
        {
            _falhasConsecutivas++;
            var backoffSegundos = Math.Min(15, 2 * _falhasConsecutivas);
            _proximaTentativa = DateTime.Now.AddSeconds(backoffSegundos);
            Ok = false;
            Situacao = $"{Porta}: {e.Message}";
            Diagnostico.Registrar("PainelLed.Atualizar", e);
            try { _serial?.Dispose(); } catch { }
            _serial = null;
        }
    }

    internal string MontarAlteracoes(JsonObject sessao, DateTime agora)
    {
        var (posicoes, rodape) = MontarQuadro(sessao, Pagina, Linhas, agora);
        return string.Concat(posicoes) + rodape;
    }

    /// <summary>Uma linha de texto por posição da página ($SR/$J/$G na corrida, $SP/$J/$H no treino) e o rodapé $F.
    /// Público para teste.</summary>
    public static (List<string> posicoes, string rodape) MontarQuadro(JsonObject sessao, int pagina, int linhas, DateTime agora)
    {
        var posicoes = new List<string>();
        if (sessao == null) return (posicoes, "");
        Montar(sessao, pagina, linhas, agora, out _, posicoes, out var rodape);
        return (posicoes, rodape);
    }

    static string Hora(long? ms) { var t = TimeSpan.FromMilliseconds(Math.Max(0, ms ?? 0)); return $"{(int)t.TotalHours % 24:00}:{t.Minutes:00}:{t.Seconds:00}.{t.Milliseconds:000}"; }

    /// <summary>Monta o quadro do LapTime (protocolo 1) com suporte a paginação. Público para teste.</summary>
    public static string Montar(JsonObject sessao, int pagina, int linhas, DateTime agora, out string assinatura) =>
        Montar(sessao, pagina, linhas, agora, out assinatura, null, out _);

    static string Montar(JsonObject sessao, int pagina, int linhas, DateTime agora, out string assinatura, List<string> porPosicao, out string rodape)
    {
        rodape = "";
        if (sessao == null) { assinatura = ""; return ""; }
        var corrida = sessao.S("type") == "corrida";

        var rawStandings = (sessao["standings"] as JsonArray ?? [])
            .OfType<JsonObject>();

        List<JsonObject> standings;
        if (corrida)
        {
            // Corrida: mostra os karts que já passaram na linha (mesmo na largada / com 0 voltas) ou já completaram volta
            standings = rawStandings
                .Where(r => r.I("position") > 0 && (r["lastLapMs"] is not null || r.I("laps") > 0 || r["lastCrossingWallMs"] is not null))
                .OrderBy(r => r.I("position"))
                .ToList();
        }
        else
        {
            // Treino / tomada de tempo / montagem de grid: todos os pilotos classificados por posição
            standings = rawStandings
                .Where(r => r.I("position") > 0)
                .OrderBy(r => r.I("position"))
                .ToList();
        }

        var pageRows = standings.Skip(pagina * linhas).Take(linhas).ToList();
        var sb = new StringBuilder();
        var pos = 0;
        foreach (var r in pageRows)
        {
            pos++;
            var kart = int.TryParse(r.S("kart"), out var k) ? k.ToString("000") : r.S("kart");
            var voltas = r.I("laps");
            var ultima = r["lastLapMs"] is null ? "00:00:00.000" : Hora(r.L("lastLapMs"));
            var melhor = r["bestLapMs"] is null ? null : Hora(r.L("bestLapMs"));
            var total = r["totalMs"] is null ? "00:00:00.000" : Hora(r.L("totalMs"));

            string linha;
            if (corrida)
            {
                linha = $"$SR,{pos},\"{kart}\",{voltas},\"{ultima}\"\r\n"
                      + $"$J,\"{kart}\",\"{ultima}\",\"{total}\"\r\n"
                      + $"$G,{pos},\"{kart}\",{voltas},\"{ultima}\"\r\n";
            }
            else
            {
                var tempo = melhor ?? ultima;
                linha = $"$SP,{pos},\"{kart}\",{voltas},\"{tempo}\"\r\n"
                      + $"$J,\"{kart}\",\"{tempo}\",\"{total}\"\r\n"
                      + $"$H,{pos},\"{kart}\",{voltas},\"{tempo}\"\r\n";
            }
            sb.Append(linha);
            porPosicao?.Add(linha);
        }

        assinatura = sb.ToString();
        var lider = standings.FirstOrDefault()?.I("laps") ?? 0;
        var voltasRestantes = sessao["maxLaps"] is JsonValue && sessao.I("maxLaps") > 0 ? Math.Max(0, sessao.I("maxLaps") - lider) : 0;
        rodape = $"$F,{voltasRestantes},\"{Hora(sessao.L("remainingMs"))}\",\"{agora:HH:mm:ss.fff}\",\"{Hora(sessao.L("elapsedMs"))}\"\r\n";
        sb.Append(rodape);
        return sb.ToString();
    }

    public static string Montar(JsonObject sessao, int linhas, DateTime agora, out string assinatura) =>
        Montar(sessao, 0, linhas, agora, out assinatura);

    public void Dispose()
    {
        lock (_travaFila)
        {
            _disposed = true;
            _pacotePendente = null;
            _limpezaPendente = false;
        }
        try { _serial?.Dispose(); } catch { }
        _serial = null;
    }
}
