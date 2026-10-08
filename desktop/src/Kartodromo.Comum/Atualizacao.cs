using System.Diagnostics;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Kartodromo.Comum;

public sealed class ManifestoDesktop
{
    [JsonPropertyName("app")] public string App { get; set; }
    [JsonPropertyName("version")] public string Version { get; set; }
    [JsonPropertyName("package")] public string Pacote { get; set; }
    [JsonPropertyName("sha256")] public string Sha256 { get; set; }
    [JsonPropertyName("publishedAt")] public string PublicadoEm { get; set; }
}

/// <summary>Atualizador comum dos tr«¶s programas desktop, executado na pr«¸xima abertura.</summary>
public static class Atualizacao
{
    const string ArgumentoInstalador = "--kartodromo-instalar";
    /// <summary>Posto na reabertura depois de uma atualiza«ı«úo que falhou: sem ele o programa reaberto tentava de novo,
    /// falhava de novo e ficava nesse ciclo (PC da ger«¶ncia em 02/10/2026, pasta sem permiss«úo de grava«ı«úo).</summary>
    public const string ArgumentoSemAtualizar = "--sem-atualizar";
    static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };
    static readonly HttpClient Manifestos = new() { Timeout = TimeSpan.FromSeconds(4) };
    static readonly HttpClient Pacotes = new() { Timeout = Timeout.InfiniteTimeSpan };
    const int TamanhoBlocoDownload = 128 * 1024;
    static readonly TimeSpan LimiteDownload = TimeSpan.FromMinutes(10);
    static readonly TimeSpan LimiteLeituraDownload = TimeSpan.FromSeconds(30);

    public static bool DeveAtualizar(string atual, string app, ManifestoDesktop remoto)
    {
        if (remoto == null || !string.Equals(remoto.App, app, StringComparison.OrdinalIgnoreCase)) return false;
        if (!Version.TryParse(atual, out var versaoAtual) || !Version.TryParse(remoto.Version, out var versaoRemota)) return false;
        if (versaoRemota <= versaoAtual || string.IsNullOrWhiteSpace(remoto.Pacote)) return false;
        return HashValido(remoto.Sha256);
    }

    public static bool PodeSubstituirArquivo(string relativo) =>
        !string.Equals(Path.GetFileName(relativo), "appsettings.json", StringComparison.OrdinalIgnoreCase);

    public static int PercentualDownload(long recebido, long? total)
    {
        if (total is not > 0) return -1;
        return (int)Math.Clamp(recebido * 100d / total.Value, 0d, 100d);
    }

    public static Mutex AdquirirBloqueio(string app, TimeSpan espera)
    {
        var nome = $"Local\\Kartodromo.Atualizacao.{new string(app.Where(char.IsLetterOrDigit).ToArray())}";
        var mutex = new Mutex(false, nome);
        try
        {
            if (mutex.WaitOne(espera)) return mutex;
        }
        catch (AbandonedMutexException)
        {
            return mutex;
        }
        mutex.Dispose();
        return null;
    }

    public static async Task<bool> TratarInicioAsync(string app, string[] args)
    {
        if (args.Length > 1 && args[1] == ArgumentoInstalador)
        {
            await ExecutarInstaladorAsync(app, args);
            return true;
        }
        if (EhModoTeste(args)) return false;
        LimparSobras(app);
        if (args.Skip(1).Contains(ArgumentoSemAtualizar)) return false;
        return await VerificarEIniciarAsync(app, args);
    }

    /// <summary>Apaga as c«¸pias tempor«≠rias do instalador de atualiza«ı«Êes anteriores (cada uma tem o tamanho do programa).
    /// A que estiver em uso n«úo sai e fica para a pr«¸xima abertura.</summary>
    static void LimparSobras(string app)
    {
        try
        {
            var limite = DateTime.UtcNow - TimeSpan.FromMinutes(15);
            foreach (var sobra in Directory.EnumerateFileSystemEntries(Path.GetTempPath(), "Kartodromo.Atualizacao.*"))
            {
                try
                {
                    if (File.GetLastWriteTimeUtc(sobra) > limite) continue;
                    if (Directory.Exists(sobra)) Directory.Delete(sobra, true);
                    else File.Delete(sobra);
                }
                catch (Exception e) when (e is IOException or UnauthorizedAccessException) { }
            }
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException) { }
    }

    static bool EhModoTeste(string[] args) => args.Skip(1).Any(a =>
        a is "--test-painel" or "--autoteste" || a.StartsWith("--teste-", StringComparison.OrdinalIgnoreCase) || a == "--roteiro-agenda");

    static async Task<bool> VerificarEIniciarAsync(string app, string[] args)
    {
        var executavel = Environment.ProcessPath;
        if (string.IsNullOrWhiteSpace(executavel) || !File.Exists(executavel)) return false;
        using var bloqueio = AdquirirBloqueio(app, TimeSpan.Zero);
        if (bloqueio == null) return false;
        var url = $"{Config.ServidorUrl}/updates/{Uri.EscapeDataString(app)}/manifest.json";
        try
        {
            using var resposta = await Manifestos.GetAsync(url);
            if (!resposta.IsSuccessStatusCode) return false;
            var manifesto = JsonSerializer.Deserialize<ManifestoDesktop>(await resposta.Content.ReadAsStringAsync(), Json);
            if (!DeveAtualizar(VersaoAtual(executavel), app, manifesto)) return false;

            var temporario = Path.Combine(Path.GetTempPath(), $"Kartodromo.Atualizacao.{app}.{Guid.NewGuid():N}.exe");
            File.Copy(executavel, temporario, true);
            var psi = new ProcessStartInfo(temporario)
            {
                UseShellExecute = false,
                CreateNoWindow = true,
                WorkingDirectory = AppContext.BaseDirectory,
            };
            psi.ArgumentList.Add(ArgumentoInstalador);
            psi.ArgumentList.Add(Environment.ProcessId.ToString());
            psi.ArgumentList.Add(url);
            psi.ArgumentList.Add(Codificar(AppContext.BaseDirectory));
            psi.ArgumentList.Add(Codificar(executavel));
            psi.ArgumentList.Add(Codificar(JsonSerializer.Serialize(args.Skip(1).ToArray())));
            Process.Start(psi);
            return true;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or IOException or JsonException)
        {
            // Atualiza«ı«úo «∏ oportunista: sem rede, o programa instalado continua abrindo normalmente.
            Debug.WriteLine("Atualiza«ı«úo n«úo consultada: " + ex.Message);
            return false;
        }
    }

    static Task ExecutarInstaladorAsync(string app, string[] args)
    {
        if (args.Length < 7 || !int.TryParse(args[2], out var pid)) return Task.CompletedTask;
        using var bloqueio = AdquirirBloqueio(app, TimeSpan.FromSeconds(5));
        if (bloqueio == null) return Task.CompletedTask;
        var manifestoUrl = args[3];
        var diretorio = Decodificar(args[4]);
        var executavel = Decodificar(args[5]);
        var argumentos = JsonSerializer.Deserialize<string[]>(Decodificar(args[6]), Json) ?? [];
        var tela = new FormAtualizacao(Nome(app), "Preparando atualiza«ı«úo...");
        Exception erro = null;
        var contexto = new ApplicationContext(tela);
        tela.Shown += async (_, _) =>
        {
            try
            {
                await InstalarPacoteAsync(app, pid, manifestoUrl, diretorio, tela);
            }
            catch (Exception ex)
            {
                erro = ex;
                RegistrarFalha(app, ex);
                tela.MostrarErro("N«úo foi poss«vel atualizar agora. A vers«úo instalada ser«≠ aberta.");
                await Task.Delay(2200);
            }
            finally { contexto.ExitThread(); }
        };
        Application.Run(contexto);
        tela.Dispose();
        // falhou: abre a vers«úo instalada SEM consultar a atualiza«ı«úo de novo nesta abertura (sen«úo vira ciclo)
        if (erro != null && !argumentos.Contains(ArgumentoSemAtualizar)) argumentos = [.. argumentos, ArgumentoSemAtualizar];
        else if (erro == null) argumentos = argumentos.Where(a => a != ArgumentoSemAtualizar).ToArray();
        Iniciar(executavel, diretorio, argumentos);
        if (erro != null) Debug.WriteLine("Atualiza«ı«úo falhou: " + erro);
        return Task.CompletedTask;
    }

    static async Task InstalarPacoteAsync(string app, int pid, string manifestoUrl, string diretorio, FormAtualizacao tela)
    {
        tela.Status("Consultando a vers«úo publicada...");
        using var manifestResponse = await Pacotes.GetAsync(manifestoUrl);
        manifestResponse.EnsureSuccessStatusCode();
        var manifesto = JsonSerializer.Deserialize<ManifestoDesktop>(await manifestResponse.Content.ReadAsStringAsync(), Json)
            ?? throw new InvalidDataException("Manifesto vazio.");
        if (!string.Equals(manifesto.App, app, StringComparison.OrdinalIgnoreCase) || !HashValido(manifesto.Sha256))
            throw new InvalidDataException("Manifesto de atualiza«ı«úo inv«≠lido.");
        if (manifesto.Pacote.Contains('/') || manifesto.Pacote.Contains('\\') || Path.GetFileName(manifesto.Pacote) != manifesto.Pacote)
            throw new InvalidDataException("Nome de pacote inv«≠lido.");

        var pacoteUrl = new Uri(new Uri(manifestoUrl), Uri.EscapeDataString(manifesto.Pacote)).ToString();
        var zip = Path.Combine(Path.GetTempPath(), $"Kartodromo.Atualizacao.{Guid.NewGuid():N}.zip");
        var staging = Path.Combine(Path.GetTempPath(), $"Kartodromo.Atualizacao.{Guid.NewGuid():N}");
        try
        {
            tela.Status($"Atualizando para a vers«úo {manifesto.Version}...\r\nBaixando pacote...");
            await BaixarPacoteAsync(pacoteUrl, zip, manifesto.Version, tela);
            tela.Status($"Atualizando para a vers«úo {manifesto.Version}...\r\nValidando pacote...");
            await using (var stream = File.OpenRead(zip))
            {
                var hash = Convert.ToHexString(await SHA256.HashDataAsync(stream));
                if (!hash.Equals(manifesto.Sha256, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("SHA-256 do pacote n«úo confere.");
            }

            tela.Status($"Atualizando para a vers«úo {manifesto.Version}...\r\nAguardando o programa fechar...");
            await AguardarProcessoAsync(pid);
            Directory.CreateDirectory(staging);
            ValidarZip(zip, staging);
            ZipFile.ExtractToDirectory(zip, staging);
            var raiz = EncontrarRaiz(staging, app) ?? throw new InvalidDataException("Pacote sem execut«≠vel do aplicativo.");

            tela.Status($"Atualizando para a vers«úo {manifesto.Version}...\r\nInstalando arquivos...");
            foreach (var origem in Directory.EnumerateFiles(raiz, "*", SearchOption.AllDirectories))
            {
                var relativo = Path.GetRelativePath(raiz, origem);
                if (!PodeSubstituirArquivo(relativo)) continue;
                var destino = Path.Combine(diretorio, relativo);
                Directory.CreateDirectory(Path.GetDirectoryName(destino)!);
                CopiarComRetry(origem, destino);
            }
        }
        finally
        {
            try { File.Delete(zip); } catch { }
            try { Directory.Delete(staging, true); } catch { }
        }
    }

    static void ValidarZip(string zip, string destino)
    {
        var raiz = Path.GetFullPath(destino) + Path.DirectorySeparatorChar;
        using var arquivo = ZipFile.OpenRead(zip);
        foreach (var entrada in arquivo.Entries)
        {
            var caminho = Path.GetFullPath(Path.Combine(destino, entrada.FullName));
            if (!caminho.StartsWith(raiz, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Pacote cont«∏m caminho inv«≠lido.");
        }
    }

    static string EncontrarRaiz(string staging, string app)
    {
        var exe = $"Kartodromo.{app}.exe";
        if (File.Exists(Path.Combine(staging, exe))) return staging;
        return Directory.EnumerateDirectories(staging).FirstOrDefault(d => File.Exists(Path.Combine(d, exe)));
    }

    static async Task AguardarProcessoAsync(int pid)
    {
        for (var i = 0; i < 120; i++)
        {
            try { using var p = Process.GetProcessById(pid); if (p.HasExited) return; }
            catch (ArgumentException) { return; }
            await Task.Delay(250);
        }
        throw new TimeoutException("O programa anterior n«úo encerrou.");
    }

    static async Task BaixarPacoteAsync(string url, string destino, string versao, FormAtualizacao tela)
    {
        using var limite = new CancellationTokenSource(LimiteDownload);
        using var resposta = await Pacotes.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, limite.Token);
        resposta.EnsureSuccessStatusCode();
        var total = resposta.Content.Headers.ContentLength;
        await using var entrada = await resposta.Content.ReadAsStreamAsync(limite.Token);
        await using var saida = new FileStream(destino, FileMode.Create, FileAccess.Write, FileShare.None, TamanhoBlocoDownload, useAsync: true);
        var buffer = new byte[TamanhoBlocoDownload];
        long recebido = 0;
        while (true)
        {
            using var leitura = CancellationTokenSource.CreateLinkedTokenSource(limite.Token);
            leitura.CancelAfter(LimiteLeituraDownload);
            int lidos;
            try { lidos = await entrada.ReadAsync(buffer.AsMemory(), leitura.Token); }
            catch (OperationCanceledException) when (!limite.IsCancellationRequested)
            {
                throw new TimeoutException("A transfer«¶ncia do pacote ficou sem dados por 30 segundos.");
            }
            if (lidos == 0) break;
            await saida.WriteAsync(buffer.AsMemory(0, lidos), limite.Token);
            recebido += lidos;
            var percentual = PercentualDownload(recebido, total);
            tela.Status(percentual >= 0
                ? $"Atualizando para a vers«úo {versao}...\r\nBaixando pacote... {percentual}%"
                : $"Atualizando para a vers«úo {versao}...\r\nBaixando pacote...");
        }
        await saida.FlushAsync(limite.Token);
        if (total is > 0 && recebido != total.Value)
            throw new InvalidDataException("O pacote foi baixado de forma incompleta.");
    }

    static void RegistrarFalha(string app, Exception erro)
    {
        try
        {
            var pasta = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Kartodromo");
            Directory.CreateDirectory(pasta);
            var arquivo = Path.Combine(pasta, $"atualizacao-{app}.log");
            File.AppendAllText(arquivo, $"{DateTime.Now:O} {erro}{Environment.NewLine}");
        }
        catch { }
    }

    static void CopiarComRetry(string origem, string destino)
    {
        for (var tentativa = 0; ; tentativa++)
        {
            try
            {
                if (File.Exists(destino)) File.SetAttributes(destino, FileAttributes.Normal);
                File.Copy(origem, destino, true);
                return;
            }
            catch when (tentativa < 8) { Thread.Sleep(250 * (tentativa + 1)); }
        }
    }

    static void Iniciar(string executavel, string diretorio, IEnumerable<string> args)
    {
        if (!File.Exists(executavel)) return;
        var psi = new ProcessStartInfo(executavel) { UseShellExecute = true, WorkingDirectory = diretorio };
        foreach (var arg in args) psi.ArgumentList.Add(arg);
        Process.Start(psi);
    }

    static string VersaoAtual(string executavel) =>
        (FileVersionInfo.GetVersionInfo(executavel).ProductVersion ?? "0.0.0").Split('+')[0];

    static bool HashValido(string hash) => !string.IsNullOrWhiteSpace(hash) && hash.Length == 64 && hash.All(Uri.IsHexDigit);
    static string Codificar(string texto) => Convert.ToBase64String(Encoding.UTF8.GetBytes(texto ?? ""));
    static string Decodificar(string texto) => Encoding.UTF8.GetString(Convert.FromBase64String(texto));
    static string Nome(string app) => app switch { "Recepcao" => "Kart«¸dromo Recep«ı«úo", "Autoatendimento" => "Kart«¸dromo Autoatendimento", _ => "Kart«¸dromo Cronometragem" };
}

