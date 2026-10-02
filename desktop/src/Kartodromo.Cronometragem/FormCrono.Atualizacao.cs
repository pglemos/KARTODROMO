using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

/// <summary>Atualização com o programa aberto. A troca de versão acontece na abertura (Comum/Atualizacao.cs), mas a
/// cronometragem fica aberta por dias: aqui o programa consulta de tempos em tempos a versão publicada, avisa no rodapé
/// e, com a pista parada e o PC sem uso, fecha e abre de novo sozinho para atualizar. O telão que estava aberto volta.</summary>
public partial class FormCrono
{
    const int MinutosParado = 5;
    static readonly HttpClient HttpAtualizacao = new() { Timeout = TimeSpan.FromSeconds(5) };
    static readonly JsonSerializerOptions JsonAtualizacao = new() { PropertyNameCaseInsensitive = true };
    readonly System.Windows.Forms.Timer _verAtualizacao = new() { Interval = 3 * 60_000 };
    PilulaStatus _pAtualizar;
    string _versaoNova;
    bool _fechandoPrograma, _consultandoVersao;

    [StructLayout(LayoutKind.Sequential)] struct UltimaEntrada { public uint Tamanho; public uint Tick; }
    [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref UltimaEntrada info);

    /// <summary>Minutos sem teclado nem mouse neste PC.</summary>
    static double MinutosSemUso()
    {
        var info = new UltimaEntrada { Tamanho = (uint)Marshal.SizeOf<UltimaEntrada>() };
        return GetLastInputInfo(ref info) ? unchecked((uint)Environment.TickCount - info.Tick) / 60000.0 : 0;
    }

    // o telão aberto fica anotado aqui para voltar sozinho quando o programa reabre (atualização, queda de energia)
    static string MarcaTv => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Kartodromo", "Cronometragem", "tv-aberta");
    static void MarcarTv(bool aberta)
    {
        try
        {
            if (aberta) { Directory.CreateDirectory(Path.GetDirectoryName(MarcaTv)!); File.WriteAllText(MarcaTv, DateTime.Now.ToString("s")); }
            else File.Delete(MarcaTv);
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException) { /* sem a anotação o telão só não reabre sozinho */ }
    }

    /// <summary>Chamado quando a janela abre: reabre o telão que estava aberto e passa a vigiar a versão publicada.</summary>
    void IniciarAtualizacaoAoVivo()
    {
        FormClosing += (_, _) => _fechandoPrograma = true;
        if (File.Exists(MarcaTv)) AbrirTV();
        _verAtualizacao.Tick += async (_, _) => await VerificarAtualizacao();
        _verAtualizacao.Start();
    }

    async Task VerificarAtualizacao()
    {
        if (_consultandoVersao || _fechandoPrograma) return;
        _consultandoVersao = true;
        try
        {
            var texto = await HttpAtualizacao.GetStringAsync($"{Config.ServidorUrl}/updates/Cronometragem/manifest.json");
            var manifesto = JsonSerializer.Deserialize<ManifestoDesktop>(texto, JsonAtualizacao);
            _versaoNova = Atualizacao.DeveAtualizar(Application.ProductVersion.Split('+')[0], "Cronometragem", manifesto) ? manifesto.Version : null;
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException) { return; } // sem rede: tenta de novo depois
        finally { _consultandoVersao = false; }
        _pAtualizar.Visible = _versaoNova != null;
        if (_versaoNova == null) return;
        _pAtualizar.Texto = $"ATUALIZAR PARA {_versaoNova}";
        _pAtualizar.Dica = $"A versão {_versaoNova} foi publicada. Clique para atualizar agora; com a pista parada e o PC sem uso por {MinutosParado} minutos o programa se atualiza sozinho.";
        if (PodeAtualizarSozinho()) ReiniciarParaAtualizar();
    }

    // se a troca sozinha não deu certo (rede, pacote), não fica reabrindo o programa a cada consulta: só de 6 em 6 horas
    static string MarcaTentativa => Path.Combine(Path.GetDirectoryName(MarcaTv)!, "atualizacao-tentada");
    bool JaTentou(string versao)
    {
        try { return File.Exists(MarcaTentativa) && File.ReadAllText(MarcaTentativa).Trim() == versao && DateTime.Now - File.GetLastWriteTime(MarcaTentativa) < TimeSpan.FromHours(6); }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException) { return false; }
    }

    /// <summary>Só troca de versão sozinho sem bateria aberta, sem janela aberta, sem lista por salvar e com o PC parado.</summary>
    bool PodeAtualizarSozinho() =>
        _servidorOk && string.IsNullOrEmpty(_state?.S("runningId")) && !_pilotosSujos
        && Application.OpenForms.Cast<Form>().All(f => f == this || f is FormTV)
        && MinutosSemUso() >= MinutosParado && !JaTentou(_versaoNova);

    void AtualizarAgora()
    {
        if (_versaoNova == null) return;
        var aberta = !string.IsNullOrEmpty(_state?.S("runningId"));
        if (!Msg.Pergunta(this, $"Atualizar a Cronometragem para a versão {_versaoNova}?\n\nO programa fecha e abre de novo em alguns segundos." +
            (aberta ? "\n\nHá uma bateria aberta: as voltas continuam sendo contadas pelo serviço, mas esta tela e o telão ficam fora durante a troca." : ""))) return;
        ReiniciarParaAtualizar();
    }

    /// <summary>Abre o programa de novo (é na abertura que a versão nova é instalada) e fecha este.</summary>
    void ReiniciarParaAtualizar()
    {
        var exe = Environment.ProcessPath;
        if (string.IsNullOrEmpty(exe) || !File.Exists(exe)) return;
        _fechandoPrograma = true;
        _verAtualizacao.Stop();
        try { Directory.CreateDirectory(Path.GetDirectoryName(MarcaTentativa)!); File.WriteAllText(MarcaTentativa, _versaoNova ?? ""); }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException) { /* sem a anotação só pode tentar de novo mais cedo */ }
        Process.Start(new ProcessStartInfo(exe) { UseShellExecute = true, WorkingDirectory = AppContext.BaseDirectory });
        Application.Exit();
    }
}
