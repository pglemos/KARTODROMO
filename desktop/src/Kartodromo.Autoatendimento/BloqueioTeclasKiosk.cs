using System.Diagnostics;
using System.Runtime.InteropServices;

namespace Kartodromo.Autoatendimento;

/// <summary>
/// Hook de teclado de baixo nível (WH_KEYBOARD_LL = 13) para proteção de quiosque.
/// Intercepta e suprime teclas de escape do sistema Windows (WinKey, Alt+Tab, Alt+Esc,
/// Ctrl+Esc, Ctrl+Shift+Esc, Alt+F4, Alt+Espaço, Tecla Apps/Menu), preservando integralmente
/// a digitação normal, navegação de formulário e o atalho de emergência da equipe (Ctrl+Shift+Alt+S).
/// </summary>
public sealed class BloqueioTeclasKiosk : IDisposable
{
    private const int WH_KEYBOARD_LL = 13;
    private const int HC_ACTION = 0;

    private const int WM_KEYDOWN = 0x0100;
    private const int WM_KEYUP = 0x0101;
    private const int WM_SYSKEYDOWN = 0x0104;
    private const int WM_SYSKEYUP = 0x0105;

    private const int VK_TAB = 0x09;
    private const int VK_SHIFT = 0x10;
    private const int VK_CONTROL = 0x11;
    private const int VK_MENU = 0x12; // Alt
    private const int VK_ESCAPE = 0x1B;
    private const int VK_SPACE = 0x20;
    private const int VK_LWIN = 0x5B;
    private const int VK_RWIN = 0x5C;
    private const int VK_APPS = 0x5D;
    private const int VK_F4 = 0x73;
    private const int VK_F10 = 0x79;

    private const uint LLKHF_ALTDOWN = 0x20;

    [StructLayout(LayoutKind.Sequential)]
    private struct KBDLLHOOKSTRUCT
    {
        public uint vkCode;
        public uint scanCode;
        public uint flags;
        public uint time;
        public UIntPtr dwExtraInfo;
    }

    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string lpModuleName);

    [DllImport("user32.dll")]
    private static extern short GetKeyState(int nVirtKey);

    private static readonly IntPtr DescartarTecla = (IntPtr)1;

    // Retém referência forte do delegate para impedir coleta de lixo prematura (GC) pelo .NET
    private readonly LowLevelKeyboardProc _hookCallback;
    private IntPtr _hookId = IntPtr.Zero;
    private bool _disposed;
    private readonly Action _aoAcionarSaidaEmergencia;

    public static BloqueioTeclasKiosk Instalar(Action aoAcionarSaidaEmergencia = null)
    {
        var instancia = new BloqueioTeclasKiosk(aoAcionarSaidaEmergencia);
        instancia.Iniciar();
        return instancia;
    }

    private BloqueioTeclasKiosk(Action aoAcionarSaidaEmergencia)
    {
        _aoAcionarSaidaEmergencia = aoAcionarSaidaEmergencia;
        _hookCallback = ProcedimentoHook;
    }

    private void Iniciar()
    {
        try
        {
            using var processoAtual = Process.GetCurrentProcess();
            using var moduloAtual = processoAtual.MainModule;
            var hModulo = GetModuleHandle(moduloAtual?.ModuleName);

            _hookId = SetWindowsHookEx(WH_KEYBOARD_LL, _hookCallback, hModulo, 0);

            if (_hookId == IntPtr.Zero)
            {
                var erro = Marshal.GetLastWin32Error();
                Program.Log($"Aviso: Falha ao instalar hook de teclado do quiosque (erro Win32: {erro}).");
            }
            else
            {
                Program.Log("Bloqueio de teclas do quiosque (WH_KEYBOARD_LL) ativado com sucesso.");
            }
        }
        catch (Exception ex)
        {
            Program.Log($"Aviso: Exceção ao iniciar hook de teclado Kiosk: {ex.Message}");
        }
    }

    private IntPtr ProcedimentoHook(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= HC_ACTION)
        {
            var msg = wParam.ToInt32();
            if (msg is WM_KEYDOWN or WM_KEYUP or WM_SYSKEYDOWN or WM_SYSKEYUP)
            {
                var info = Marshal.PtrToStructure<KBDLLHOOKSTRUCT>(lParam);
                var vk = (int)info.vkCode;
                var altPressionado = (info.flags & LLKHF_ALTDOWN) != 0;
                var ctrlPressionado = (GetKeyState(VK_CONTROL) & 0x8000) != 0;
                var shiftPressionado = (GetKeyState(VK_SHIFT) & 0x8000) != 0;

                // 1. Manutenção / Saída da equipe física: Ctrl+Shift+Alt+S
                if (ctrlPressionado && shiftPressionado && altPressionado && vk == (int)Keys.S)
                {
                    if (msg == WM_KEYDOWN && _aoAcionarSaidaEmergencia != null)
                    {
                        try { _aoAcionarSaidaEmergencia(); } catch { }
                    }
                    // Permite a propagação para que FormTotem.KeyDown também trate
                    return CallNextHookEx(_hookId, nCode, wParam, lParam);
                }

                // 2. Tecla Windows (LWin ou RWin) — isolada ou combinada (Win+D, Win+R, Win+E, Win+X, etc.)
                if (vk is VK_LWIN or VK_RWIN)
                {
                    return DescartarTecla;
                }

                // 3. Alt + Tab (Alternador de Tarefas do Windows)
                if (altPressionado && vk == VK_TAB)
                {
                    return DescartarTecla;
                }

                // 4. Alt + Esc (Ciclagem de Janelas do Windows)
                if (altPressionado && vk == VK_ESCAPE)
                {
                    return DescartarTecla;
                }

                // 5. Ctrl + Esc (Menu Iniciar) ou Ctrl + Shift + Esc (Gerenciador de Tarefas)
                if (ctrlPressionado && vk == VK_ESCAPE)
                {
                    return DescartarTecla;
                }

                // 6. Alt + F4 (Fechamento forçado de janelas/modais)
                if (altPressionado && vk == VK_F4)
                {
                    return DescartarTecla;
                }

                // 7. Alt + Espaço (Menu de Controle da Janela do Windows)
                if (altPressionado && vk == VK_SPACE)
                {
                    return DescartarTecla;
                }

                // 8. Tecla de Menu/Contexto (VK_APPS) ou Shift + F10
                if (vk == VK_APPS || (shiftPressionado && vk == VK_F10))
                {
                    return DescartarTecla;
                }
            }
        }

        return CallNextHookEx(_hookId, nCode, wParam, lParam);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        var hhk = Interlocked.Exchange(ref _hookId, IntPtr.Zero);
        if (hhk != IntPtr.Zero)
        {
            try
            {
                UnhookWindowsHookEx(hhk);
                Program.Log("Bloqueio de teclas do quiosque desinstalado.");
            }
            catch { /* nunca estoura em dispose */ }
        }
        GC.SuppressFinalize(this);
    }

    ~BloqueioTeclasKiosk()
    {
        Dispose();
    }
}
