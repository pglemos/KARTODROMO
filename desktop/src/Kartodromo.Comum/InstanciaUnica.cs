using System.ComponentModel;
using System.Diagnostics;
using System.IO.MemoryMappedFiles;
using System.Runtime.InteropServices;

namespace Kartodromo.Comum;

/// <summary>Uma cópia aberta de cada programa por sessão do Windows. Em 15/10/2026 a Recepção do PC .12 estava aberta
/// duas vezes (uma escondida atrás da outra desde a tarde) e a atualização falhou: o instalador só espera fechar a cópia
/// que o chamou e a outra continuava segurando o .exe. Agora a segunda abertura traz a janela da primeira para a frente
/// e sai. O instalador da atualização segura o mesmo bloqueio enquanto troca os arquivos e o solta antes de reabrir.</summary>
public static class InstanciaUnica
{
    static Mutex _mutex;
    static MemoryMappedFile _pid;

    static string Nome(string app) => $"Local\\Kartodromo.Instancia.{new string(app.Where(char.IsLetterOrDigit).ToArray())}";

    /// <summary>Pega o bloqueio do programa, esperando até <paramref name="espera"/>. Fica com a thread que chamou (a da
    /// interface) até <see cref="Liberar"/> ou até o processo fechar.</summary>
    public static bool Adquirir(string app, TimeSpan espera)
    {
        if (_mutex != null) return true;
        var mutex = new Mutex(false, Nome(app));
        bool dono;
        try { dono = mutex.WaitOne(espera); }
        catch (AbandonedMutexException) { dono = true; } // a cópia anterior fechou sem soltar: o bloqueio é nosso
        if (!dono) { mutex.Dispose(); return false; }
        _mutex = mutex;
        // quem chegar depois lê aqui qual processo trazer para a frente
        try
        {
            _pid = MemoryMappedFile.CreateOrOpen(Nome(app) + ".Pid", sizeof(int));
            using var v = _pid.CreateViewAccessor();
            v.Write(0, Environment.ProcessId);
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException) { _pid?.Dispose(); _pid = null; }
        return true;
    }

    /// <summary>Solta o bloqueio (da mesma thread que o pegou) antes de abrir o programa de novo.</summary>
    public static void Liberar()
    {
        _pid?.Dispose();
        _pid = null;
        if (_mutex == null) return;
        try { _mutex.ReleaseMutex(); } catch (ApplicationException) { /* já não era desta thread */ }
        _mutex.Dispose();
        _mutex = null;
    }

    /// <summary>Chamado na abertura normal. true: é a única cópia e segue abrindo. false: já havia uma aberta nesta sessão,
    /// que foi trazida para a frente (ou fechada a pedido, se travada, e aí esta segue abrindo).</summary>
    public static bool Garantir(string app)
    {
        if (Adquirir(app, TimeSpan.Zero)) return true;
        using var outra = ProcessoComBloqueio(app);
        if (outra == null) return false; // a outra ainda está abrindo: a janela dela aparece sozinha
        // Quem segura pode ser o instalador da atualização (outro nome de processo), que fica ocupado copiando e não está
        // travado. Esta cópia viva prende o .exe que ele está trocando: sai na hora, sem perguntar nada.
        using var esta = Process.GetCurrentProcess();
        if (outra.ProcessName == esta.ProcessName && !outra.Responding)
        {
            var nome = Atualizacao.Nome(app);
            if (MessageBox.Show($"O {nome} já está aberto neste computador, mas não está respondendo.\n\nDeseja fechá-lo e abrir de novo?\n" +
                "O que não foi gravado nele será perdido.", nome, MessageBoxButtons.YesNo, MessageBoxIcon.Warning, MessageBoxDefaultButton.Button2) != DialogResult.Yes)
                return false;
            try { outra.Kill(); outra.WaitForExit(10_000); }
            catch (Exception e) when (e is Win32Exception or InvalidOperationException) { }
            if (Adquirir(app, TimeSpan.FromSeconds(10))) return true;
            MessageBox.Show($"Não foi possível fechar o {nome} travado. Feche-o pelo Gerenciador de Tarefas e abra de novo.", nome, MessageBoxButtons.OK, MessageBoxIcon.Error);
            return false;
        }
        TrazerParaFrente(outra);
        return false;
    }

    /// <summary>Fecha o programa e abre de novo (trocar de usuário, reabrir para atualizar). Se a janela principal cancelar
    /// o fechamento ("Deseja sair do sistema?" → Não), nada acontece e continua uma cópia só. Fecha pela janela principal
    /// e não por Application.Exit(e): este percorre as janelas abertas e a pergunta, que abre outra janela no meio, quebra
    /// a volta ("Collection was modified").</summary>
    public static void FecharEReabrir(Form principal)
    {
        principal.Close();
        if (!principal.IsDisposed) return; // fechamento cancelado
        Application.Exit(); // o que sobrou aberto (telão da cronometragem)
        Liberar();
        var exe = Environment.ProcessPath;
        if (string.IsNullOrEmpty(exe) || !File.Exists(exe)) return;
        Process.Start(new ProcessStartInfo(exe) { UseShellExecute = true, WorkingDirectory = AppContext.BaseDirectory });
    }

    static Process ProcessoComBloqueio(string app)
    {
        // quem acabou de pegar o bloqueio pode ainda não ter anotado o número: espera um pouco
        for (var i = 0; i < 20; i++)
        {
            try
            {
                using var mmf = MemoryMappedFile.OpenExisting(Nome(app) + ".Pid", MemoryMappedFileRights.Read);
                using var v = mmf.CreateViewAccessor(0, sizeof(int), MemoryMappedFileAccess.Read);
                var pid = v.ReadInt32(0);
                if (pid > 0 && pid != Environment.ProcessId) return Process.GetProcessById(pid);
            }
            catch (Exception e) when (e is FileNotFoundException or IOException or UnauthorizedAccessException or ArgumentException) { }
            Thread.Sleep(100);
        }
        return null;
    }

    static void TrazerParaFrente(Process outra)
    {
        var janela = outra.MainWindowHandle;
        if (janela == IntPtr.Zero) return;
        if (IsIconic(janela)) ShowWindow(janela, SwRestaurar);
        // com uma janela de diálogo aberta por cima, é ela que precisa vir para a frente
        var popup = GetLastActivePopup(janela);
        SetForegroundWindow(popup != IntPtr.Zero && IsWindowVisible(popup) ? popup : janela);
    }

    const int SwRestaurar = 9;
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr janela);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr janela, int comando);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr janela);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr janela);
    [DllImport("user32.dll")] static extern IntPtr GetLastActivePopup(IntPtr janela);
}
