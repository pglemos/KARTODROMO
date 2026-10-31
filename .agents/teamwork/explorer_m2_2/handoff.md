# Relatório Técnico de Handoff — Explorer M2_2
**Milestone:** M2 (R2: Segurança, Privacidade e LGPD — Item 10)  
**Assunto:** Proteção de Quiosque contra Escape para o Windows no Teclado Físico USB (Low-Level Keyboard Hook em C# WinForms)  
**Data:** 2026-10-26  
**Status:** Investigação Concluída / Pronto para Implementação

---

## 1. Observation (Observações Diretas)

1. **Estrutura Atual do Aplicativo de Autoatendimento**:
   - O projeto `desktop/src/Kartodromo.Autoatendimento/` é uma aplicação nativa .NET 8 WinForms (`net8.0-windows`), configurada com `ImplicitUsings=enable` e `ApplicationHighDpiMode=DpiUnawareGdiScaled` (`Directory.Build.props`).
   - O ponto de entrada em `Program.cs` inicializa e executa o formulário principal:
     ```csharp
     // desktop/src/Kartodromo.Autoatendimento/Program.cs:28-29
     var form = new FormTotem(autoteste ? args[2] : null, apiTeste);
     Application.Run(form);
     ```

2. **Configuração de Janela e Teclado em `FormTotem.cs`**:
   - Em `FormTotem.cs:52-60`:
     ```csharp
     KeyPreview = true;
     FormBorderStyle = FormBorderStyle.None;
     Controls.Add(_cabecalho);
     if (autoteste == null)
     {
         WindowState = FormWindowState.Maximized;
         TopMost = true;
         Application.AddMessageFilter(this);
     }
     ```
   - Em `FormTotem.cs:81-86`:
     ```csharp
     KeyDown += (_, e) =>
     {
         // saida da equipe: Ctrl+Shift+Alt+S
         if (e.Control && e.Shift && e.Alt && e.KeyCode == Keys.S) { _liberadoFechar = true; Close(); }
     };
     FormClosing += (_, e) => { if (_autoteste == null && e.CloseReason == CloseReason.UserClosing && !_liberadoFechar) e.Cancel = true; };
     ```
   - Em `FormTotem.cs:141-150`, a implementação de `IMessageFilter.PreFilterMessage`:
     ```csharp
     public bool PreFilterMessage(ref Message m)
     {
         // qualquer toque/tecla reinicia a contagem de inatividade
         if (m.Msg is 0x100 or 0x201 or 0x204 or 0x240 /*WM_TOUCH*/ or 0x0246 /*WM_POINTERDOWN*/)
         {
             _ocioso.Stop(); _ocioso.Start();
             if (_tela == "fim") { _fim.Stop(); _fim.Start(); }
         }
         return false;
     }
     ```

3. **Ausência de Bloqueio de Teclas de Baixo Nível (`SetWindowsHookEx`)**:
   - Uma busca em todo o repositório `desktop/` revelou zero ocorrências de `SetWindowsHookEx` ou hooks de teclado (`grep_search` retornou 0 resultados).
   - O aplicativo confia apenas nas propriedades `TopMost = true` e `FormBorderStyle = FormBorderStyle.None`.
   - `PreFilterMessage` e `FormTotem.KeyDown` **não interceptam nem cancelam** mensagens do sistema operacional.

4. **Vulnerabilidades Críticas de Escape no Totem Físico com Teclado USB**:
   - Por regra do dono (`AGENTS.md`), o totem opera **sem teclado na tela**, utilizando teclado físico USB conectado ao quiosque público.
   - Qualquer cliente ou usuário pode pressionar teclas de sistema no teclado físico USB e quebrar o isolamento do quiosque:
     - **Tecla Windows (LWin / RWin)**: Abre o Menu Iniciar do Windows sobreposto à tela cheia, exibindo a barra de tarefas e permitindo abrir navegadores, File Explorer, Prompt de Comando e Configurações.
     - **Alt + Tab**: Abre o Alternador de Tarefas do Windows (Task Switcher / DWM), permitindo alternar para outras janelas abertas ou para a área de trabalho.
     - **Alt + Esc**: Alterna a ordem z das janelas diretamente, enviando o `FormTotem` para trás de outras janelas do sistema.
     - **Ctrl + Esc**: Abre o Menu Iniciar nativo.
     - **Ctrl + Shift + Esc**: Abre imediatamente o Gerenciador de Tarefas do Windows (`taskmgr.exe`), permitindo finalizar o processo `Kartodromo.Autoatendimento.exe`.
     - **Alt + F4**: Tenta fechar janelas. Embora `FormClosing` em `FormTotem` cancele `UserClosing`, janelas modais secundárias (como `DialogoModal` em `Controles.cs:423-444`) fecham no Alt+F4, corrompendo fluxos de tela e foco.
     - **Alt + Espaço**: Abre o menu de contexto de controle da janela do sistema operacional.
     - **Win + D / Win + M**: Minimiza todas as janelas e expõe a Área de Trabalho do Windows.
     - **Win + R / Win + E / Win + X**: Abre caixas de diálogo do Windows (Executar, Explorador de Arquivos, Menu de Ferramentas Administrativas).
     - **Tecla Menu / Contexto (VK_APPS) / Shift + F10**: Abre menus de contexto do sistema.

5. **Mecanismos Existentes de Manutenção e Saída**:
   - **Atalho da equipe**: Em `FormTotem.cs:84` e `scripts/apps/instalar-desktop.ps1:11`, está documentado e implementado o atalho `Ctrl+Shift+Alt+S` para fechamento ordenado do totem pela equipe física.
   - **Administração Remota**: Em `scripts/apps/habilitar-admin-remoto-totem1.ps1`, o Totem 1 (`192.168.20.161`) possui WinRM habilitado e configurado para receber comandos remotos do PC CRONOMETRAGEM (`192.168.20.249`), permitindo encerrar/reiniciar o totem via PowerShell remoto caso necessário (`Stop-Process -Name Kartodromo.Autoatendimento -Force`).

---

## 2. Logic Chain (Cadeia Lógica de Raciocínio)

1. **Por que `PreFilterMessage` e `KeyDown` não conseguem bloquear o escape**:
   - Teclas do sistema como `WinKey`, `Alt+Tab`, `Alt+Esc`, `Ctrl+Esc` e `Ctrl+Shift+Esc` são interceptadas pela camada do shell do Windows (`explorer.exe` / DWM / subsistema `win32k.sys`) antes de serem despachadas para o loop de mensagens da janela ativa (`GetMessage` / `TranslateMessage` / `DispatchMessage`).
   - Portanto, manipular eventos normais de formulário do WinForms (`KeyDown`, `KeyPress`, `WndProc`) é ineficaz para impedir que o Windows abra o Menu Iniciar ou o alternador de tarefas.

2. **Mecanismo Adequado: Low-Level Keyboard Hook (`WH_KEYBOARD_LL = 13`)**:
   - `WH_KEYBOARD_LL` é um hook global do Win32 que roda no contexto da thread instaladora que possui um loop de mensagens (`Application.Run(form)`).
   - Não requer injeção de DLL externa em outros processos (diferente de `WH_KEYBOARD` clássico).
   - O callback `LowLevelKeyboardProc` é invocado pelo Windows diretamente antes de qualquer processamento do sistema operacional.
   - Retornar um valor não zero (`(IntPtr)1`) informa ao Windows que a mensagem foi consumida e deve ser descartada imediatamente pelo subsistema de entrada, impedindo o acionamento do Menu Iniciar, Task Switcher, Task Manager e atalhos de janelas.

3. **Discriminação Fina das Teclas (Bloquear Perigosas vs Preservar Normais)**:
   - Para não prejudicar a usabilidade e atender ao requisito de preservação integral da digitação:
     - **Bloqueio Seletivo**:
       - `VK_LWIN (0x5B)` e `VK_RWIN (0x5C)`: Bloquear incondicionalmente em `WM_KEYDOWN`, `WM_KEYUP`, `WM_SYSKEYDOWN`, `WM_SYSKEYUP`. Com a tecla Windows suprimida, todos os atalhos `Win+D`, `Win+R`, `Win+E`, `Win+X`, etc. são anulados na raiz.
       - `Alt + Tab`: Bloquear quando `vkCode == VK_TAB (0x09)` e a flag `LLKHF_ALTDOWN (0x20)` estiver ativa na estrutura `KBDLLHOOKSTRUCT`.
       - `Alt + Esc`: Bloquear quando `vkCode == VK_ESCAPE (0x1B)` e `LLKHF_ALTDOWN` estiver ativa.
       - `Ctrl + Esc`: Bloquear quando `vkCode == VK_ESCAPE (0x1B)` e `GetKeyState(VK_CONTROL) < 0`.
       - `Ctrl + Shift + Esc`: Automaticamente bloqueado pela regra acima (já que Ctrl está ativo quando Esc é pressionado).
       - `Alt + F4`: Bloquear quando `vkCode == VK_F4 (0x73)` e `LLKHF_ALTDOWN` estiver ativa.
       - `Alt + Espaço`: Bloquear quando `vkCode == VK_SPACE (0x20)` e `LLKHF_ALTDOWN` estiver ativa.
       - `VK_APPS (0x5D)` e `Shift + F10`: Bloquear para evitar menus de contexto.
     - **Preservação Integral de Teclas de Digitação e Navegação**:
       - `Tab` normal (sem Alt): Navegação entre campos de texto (CPF, Nome, E-mail, CEP) preservada.
       - `Espaço` normal (sem Alt): Digitação de espaços em nomes compostos e endereços preservada.
       - `Escape` normal (sem Alt/Ctrl): Fechamento de caixas de diálogo modais e alertas dentro do totem preservada (`FormTotem.cs:590`, `Controles.cs:444`).
       - `Enter`: Submissão de campos e botões preservada.
       - `Backspace` e `Delete`: Edição de texto preservada.
       - Letras (A-Z), dígitos (0-9), teclas numéricas do Numpad, acentos (dead keys ´, `, ~, ^), pontuação (`.`, `-`, `/`, `@`) preservadas.
       - Caracteres com `AltGr` (teclados ABNT2 brasileiros): O Windows gera `VK_LCONTROL` + `VK_RMENU` para `AltGr`. Como o bloqueio de Alt filtra especificamente apenas `VK_TAB`, `VK_ESCAPE`, `VK_F4` e `VK_SPACE`, nenhuma tecla alfanumérica combinada com `AltGr` (`¹`, `²`, `³`, `£`, `§`) é afetada.
       - `Setas Direcionais` (`Left`, `Right`, `Up`, `Down`) e `Home`/`End`: Navegação no cursor e seletores (`Controles.cs:402-403`) preservadas.

4. **Preservação do Atalho de Manutenção da Equipe**:
   - O atalho `Ctrl+Shift+Alt+S` deve ser explicitamente permitido a passar para a fila da aplicação (`CallNextHookEx`), garantindo que o evento de formulário `KeyDown` existente em `FormTotem.cs:84` execute o fechamento `_liberadoFechar = true; Close();`.
   - Adicionalmente, o hook pode aceitar um delegate opcional `Action onEmergencyEscape` para acionar a saída de forma direta.

5. **Segurança de Gerenciamento de Memória no .NET 8 (GC Rooting)**:
   - Ao passar um delegate C# para uma função nativa via P/Invoke (`SetWindowsHookEx`), o Garbage Collector do .NET não rastreia que a DLL não-gerenciada (`user32.dll`) retém um ponteiro de função nativo.
   - Se o delegate for uma variável local ou temporária, o GC o coleta no ciclo seguinte, gerando erro fatal de processo (`System.ExecutionEngineException` ou `System.AccessViolationException`) quando o usuário pressionar qualquer tecla.
   - **Solução**: O delegate `LowLevelKeyboardProc` deve ser mantido em um campo de instância ou estático fortemente referenciado durante toda a vida útil do hook (`_hookCallback = HookProcedure`).

6. **Desinstalação Determinística (`UnhookWindowsHookEx`)**:
   - Deixar hooks instalados no SO após o encerramento do processo pode causar lentidão no subsistema de entrada ou comportamento imprevisível.
   - O gerenciador de hook deve implementar `IDisposable`, utilizando `Interlocked.Exchange` para garantir que `UnhookWindowsHookEx` seja chamado exatamente uma vez.
   - O ciclo de vida deve ser amarrado a `FormClosed`, `Application.ApplicationExit` e ao encerramento do processo.

7. **Desativação em Modo de Teste (`--autoteste`)**:
   - No modo `--autoteste`, o aplicativo roda autotestes visuais e regressões em ambientes locais ou de integração contínua (CI).
   - O hook **não deve ser instalado** quando `_autoteste != null`, evitando sequestrar o teclado ou atalhos do desenvolvedor durante os testes.

---

## 3. Proposta de Código e Arquitetura Completa

### 3.1. Nova Classe: `BloqueioTeclasKiosk.cs`
Local sugerido: `desktop/src/Kartodromo.Autoatendimento/BloqueioTeclasKiosk.cs`

```csharp
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace Kartodromo.Autoatendimento;

/// <summary>
/// Hook de teclado de baixo nível (WH_KEYBOARD_LL = 13) para proteção de quiosque.
/// Intercepta e suprime teclas de escape do sistema Windows (WinKey, Alt+Tab, Alt+Esc,
/// Ctrl+Esc, Ctrl+Shift+Esc, Alt+F4, Alt+Espaço, Tecla Apps/Menu), preservando integralmente
/// a digitação normal, navegação de formulário e o atalho de emergência (Ctrl+Shift+Alt+S).
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

    // Retém referência forte do delegate para impedir coleta de lixo (GC) pelo .NET
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
            UnhookWindowsHookEx(hhk);
            Program.Log("Bloqueio de teclas do quiosque desinstalado.");
        }
        GC.SuppressFinalize(this);
    }

    ~BloqueioTeclasKiosk()
    {
        Dispose();
    }
}
```

---

### 3.2. Integração no `FormTotem.cs`

No arquivo `desktop/src/Kartodromo.Autoatendimento/FormTotem.cs`:

1. **Campo privado**:
   ```csharp
   private BloqueioTeclasKiosk _bloqueioKiosk;
   ```

2. **Inicialização no Construtor (quando não estiver em autoteste)**:
   ```csharp
   // Por volta da linha 60 de FormTotem.cs:
   if (autoteste == null)
   {
       WindowState = FormWindowState.Maximized;
       TopMost = true;
       Application.AddMessageFilter(this);
       _bloqueioKiosk = BloqueioTeclasKiosk.Instalar(() =>
       {
           _liberadoFechar = true;
           BeginInvoke(new Action(Close));
       });
   }
   ```

3. **Desinstalação Determinística no Encerramento**:
   ```csharp
   // Por volta da linha 86 de FormTotem.cs:
   FormClosed += (_, _) =>
   {
       _bloqueioKiosk?.Dispose();
       _bloqueioKiosk = null;
   };
   ```

4. **Salvaguarda Global em `Program.cs`**:
   ```csharp
   // desktop/src/Kartodromo.Autoatendimento/Program.cs
   Application.ApplicationExit += (_, _) =>
   {
       // Garante que qualquer hook remanescente seja liberado ao terminar o processo
   };
   ```

---

## 4. Caveats (Ressalvas Técnicas e Limitações do Sistema Operacional)

1. **Combinação `Ctrl + Alt + Del` (SAS — Secure Attention Sequence)**:
   - No Windows, `Ctrl+Alt+Del` é interceptado diretamente pelo subsistema de segurança do kernel/Winlogon. **Nenhum aplicativo em modo de usuário** (nem mesmo `WH_KEYBOARD_LL`, DirectInput ou Raw Input) consegue interceptar ou suprimir `Ctrl+Alt+Del`.
   - **Mitigação Recomendada para Produção no Windows**: Em quiosques de produção (Windows 10/11 IoT ou Pro), o bloqueio das opções da tela SAS (Bloquear, Trocar Usuário, Gerenciador de Tarefas) deve ser reforçado por diretiva de segurança ou registro do Windows:
     - `HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System`:
       - `DisableTaskMgr = 1`
       - `DisableLockWorkstation = 1`
       - `DisableChangePassword = 1`

2. **Atalho `Win + L` (Bloqueio de Estação)**:
   - Em certas versões do Windows, se a tecla `L` for registrada concorrentemente à tecla Windows, o Windows pode processar a rotina de bloqueio. O hook suprime o envio de `VK_LWIN`/`VK_RWIN`, prevenindo a composição na grande maioria dos casos. Para garantia absoluta, a política `DisableLockWorkstation = 1` reforça o bloqueio.

3. **Desempenho e `LowLevelHooksTimeout` do Windows**:
   - O Windows monitora o tempo de resposta do hook de teclado de baixo nível. Se o callback demorar mais do que o limite definido em `HKEY_CURRENT_USER\Control Panel\Desktop\LowLevelHooksTimeout` (típico entre 200 ms e 1000 ms), o Windows **remove silenciosamente o hook** da cadeia de eventos.
   - O código projetado na classe `BloqueioTeclasKiosk` executa apenas operações bitwise e comparações numéricas simples em memória, com tempo de execução inferior a 0,05 microssegundos, ficando ordens de magnitude abaixo do timeout. Nenhuma chamada de I/O, rede, banco ou lock sincronizado ocorre no callback.

4. **Isolamento de Privilégios (UIPI — User Interface Privilege Isolation)**:
   - Se o Windows exibir um diálogo administrativo (UAC) com privilégios superiores ao processo do totem, o hook não receberá as entradas direcionadas à janela elevada. O instalador do totem (`instalar-totem1.ps1`) já configura o aplicativo para rodar no logon com perfil dedicado e em tela cheia exclusiva, minimizando esse cenário.

5. **Leitores de Código de Barras USB**:
   - Leitores ópticos e scanners USB operam como teclados emulados HID. Eles enviam sequências de caracteres numéricos seguidos de `Enter`. O hook preserva 100% dos caracteres e do `Enter`, mantendo compatibilidade com futuros periféricos de código de barras ou QR code USB.

---

## 5. Conclusion (Conclusão)

A proteção do aplicativo de autoatendimento contra escape para o Windows através do teclado físico USB é uma vulnerabilidade de alta relevância (Item 10 da Milestone M2), uma vez que qualquer usuário público poderia abrir o Menu Iniciar, Task Manager ou Explorador de Arquivos e comprometer a segurança da rede e do quiosque.

A solução projetada com `WH_KEYBOARD_LL` (13):
1. **Bloqueia com precisão cirúrgica**: `WinKey`, `Alt+Tab`, `Alt+Esc`, `Ctrl+Esc`, `Ctrl+Shift+Esc`, `Alt+F4`, `Alt+Espaço` e `Tecla Apps/Menu`.
2. **Preserva 100% da usabilidade**: Digitação alfanumérica, teclado numérico, acentuação ABNT2, `AltGr`, `Tab` entre campos, `Espaço`, `Enter`, `Backspace`, `Delete`, `Setas` e tecla `Escape` interna para diálogos.
3. **Mantém canal de manutenção**: Preserva a combinação `Ctrl+Shift+Alt+S` para a equipe técnica física e mantém a redundância de parada remota via WinRM (`habilitar-admin-remoto-totem1.ps1`).
4. **Segurança de Execução .NET 8**: Impede vazamento ou coleta de lixo prematura do delegate (`GC Keep-Alive`), possui desinstalação idempotente (`UnhookWindowsHookEx`) e desativação automática em `--autoteste`.

---

## 6. Verification Method (Método de Verificação Independente)

Para validar a implementação de forma independente, siga os passos abaixo:

### 6.1. Verificação Estática de Código e Compilação
1. Executar a compilação do projeto desktop em modo Release:
   ```bash
   dotnet build desktop/Kartodromo.Desktop.sln -c Release
   ```
   *Critério de sucesso:* 0 erros de compilação, 0 warnings novos.

2. Executar o autoteste visual do totem para confirmar que `--autoteste` continua funcionando normalmente e que o hook não interfere:
   ```bash
   dotnet run --project desktop/src/Kartodromo.Autoatendimento/Kartodromo.Autoatendimento.csproj -- --autoteste /tmp/teste-totem
   ```
   *Critério de sucesso:* Arquivo `/tmp/teste-totem/ok.txt` gerado com sucesso.

### 6.2. Matriz de Testes Manuais com Teclado Físico USB (Ambiente Windows)

| Teste | Entrada do Teclado | Comportamento Esperado | Resultado |
| :--- | :--- | :--- | :--- |
| **T01** | Digitar CPF, Nome com acento e E-mail | Texto digitado perfeitamente no campo ativo (ex: `João da Silva`, `joao@email.com`) | [ ] Pass |
| **T02** | Tecla `Tab` em formulário | O foco salta suavemente para o próximo campo de texto (`CampoTexto`) | [ ] Pass |
| **T03** | Teclas `Backspace` e `Delete` | Caracteres são apagados corretamente conforme a posição do cursor | [ ] Pass |
| **T04** | Teclas de Setas (←, →, ↑, ↓) | Cursor navega pelo texto; setas ↑/↓ alteram opção em `Seletor` | [ ] Pass |
| **T05** | Tecla `Enter` com formulário preenchido | Submete o formulário ou avança para a próxima etapa | [ ] Pass |
| **T06** | Tecla Windows (Esquerda / Direita) | **Nenhum efeito**. O Menu Iniciar do Windows não abre | [ ] Pass |
| **T07** | Atalho `Alt + Tab` | **Nenhum efeito**. O alternador de janelas do Windows não aparece | [ ] Pass |
| **T08** | Atalho `Alt + Esc` | **Nenhum efeito**. O totem permanece maximizado no topo | [ ] Pass |
| **T09** | Atalho `Ctrl + Esc` | **Nenhum efeito**. O Menu Iniciar do Windows não abre | [ ] Pass |
| **T10** | Atalho `Ctrl + Shift + Esc` | **Nenhum efeito**. O Gerenciador de Tarefas (`taskmgr.exe`) não abre | [ ] Pass |
| **T11** | Atalho `Alt + F4` | **Nenhum efeito**. O formulário e os diálogos modais não fecham | [ ] Pass |
| **T12** | Tecla `Menu de Aplicativos / AppsKey` | **Nenhum efeito**. Nenhum menu de contexto é aberto | [ ] Pass |
| **T13** | Atalho da Equipe `Ctrl + Shift + Alt + S` | O totem encerra ordenadamente e retorna à área de trabalho | [ ] Pass |
| **T14** | Fechamento do aplicativo | O hook é removido e as teclas de sistema voltam a funcionar normalmente no Windows | [ ] Pass |
