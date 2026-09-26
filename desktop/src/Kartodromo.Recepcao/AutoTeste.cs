using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

/// <summary>
/// Captura as telas do Módulo Office sem confirmar alterações. Para executar:
/// Kartodromo.Recepcao.exe --autoteste &lt;pasta&gt; &lt;login&gt; &lt;senha&gt; [&lt;reservaIdTeste&gt; &lt;vendaIdTeste&gt; &lt;movimentoIdTeste&gt;].
/// </summary>
public static class AutoTeste
{
    static readonly List<string> Log = [];

    public static async Task Rodar(string pasta, string login, string senha, long reservaIdTeste = 0, long vendaIdTeste = 0, long movimentoIdTeste = 0)
    {
        Directory.CreateDirectory(pasta);
        Log.Clear();

        var acesso = await Sessao.Api.Post("/api/login", new { login, senha, termos = true });
        Sessao.Api.Token = acesso.S("token");
        Sessao.Usuario = acesso["usuario"]!.AsObject();
        await Sessao.CarregarApoio();
        Msg.Registro = m => Log.Add(m);

        using (var telaLogin = new FormLogin { WindowState = FormWindowState.Normal, ClientSize = new Size(1440, 900), StartPosition = FormStartPosition.Manual, Location = new Point(0, 0) })
        {
            telaLogin.Show();
            await Foto(telaLogin, pasta, "01-login");
            telaLogin.Close();
        }

        var principal = new FormPrincipal { WindowState = FormWindowState.Normal, ClientSize = new Size(1440, 900), StartPosition = FormStartPosition.Manual, Location = new Point(0, 0), ConfirmarSaida = false };
        principal.Show();
        await Esperar(1200);
        await Foto(principal, pasta, "02-principal-reservas-todas");

        foreach (var (largura, altura, nome) in new[]
        {
            (1366, 768, "02a-principal-1366x768"),
            (1920, 1080, "02b-principal-1920x1080"),
            (1536, 864, "02c-principal-dpi-125"),
            (1280, 720, "02d-principal-dpi-150"),
        })
        {
            principal.ClientSize = new Size(largura, altura);
            await Esperar(250);
            await Foto(principal, pasta, nome);
        }
        principal.ClientSize = new Size(1440, 900);

        var visoes = new[]
        {
            ("reservas:aprovar", "03-reservas-aprovar"), ("reservas:aprovadas", "04-reservas-aprovadas"),
            ("reservas:pendentes", "05-reservas-pagamento-pendente"), ("reservas:canceladas", "06-reservas-canceladas"),
            ("baterias:abertas", "07-baterias-abertas"), ("baterias:fechadas", "08-baterias-fechadas"), ("baterias:todas", "09-baterias-todas"),
            ("vendas:liquidadas", "10-vendas-liquidadas"), ("vendas:canceladas", "11-vendas-canceladas"), ("vendas:todas", "12-vendas-todas"),
            ("oficina:arealizar", "13-oficina-a-realizar"), ("oficina:realizadas", "14-oficina-realizadas"), ("oficina:todas", "15-oficina-todas"),
            ("fidelidade:contas", "16-fidelidade-contas"), ("fidelidade:transacoes", "17-fidelidade-transacoes"),
            ("vouchers:lista", "18-vouchers"), ("vouchers:uso", "19-vouchers-historico"),
            ("parceiros:lista", "20-parceiros"), ("parceiros:comissoes", "21-parceiros-comissoes"), ("parceiros:pagas", "22-parceiros-comissoes-pagas"),
        };
        foreach (var (chave, nome) in visoes)
        {
            principal.Selecionar(chave);
            await Esperar(500);
            await Foto(principal, pasta, nome);
        }

        await CapturarContexto(principal, pasta, "reservas:todas", "contexto-reservas");
        await CapturarContexto(principal, pasta, "baterias:todas", "contexto-baterias");
        await CapturarContexto(principal, pasta, "vendas:todas", "contexto-vendas");

        await CapturarMenus(principal, pasta);

        await CliqueNoMenu(principal, "reservas:todas");

        var caixa = (await Sessao.Api.Get("/api/office/caixa")).AsObject();
        var aberto = caixa["aberto"] as JsonObject;
        var sumario = caixa["sumario"] as JsonObject;
        var baterias = await Sessao.Api.Lista($"/api/office/baterias?status=todas&filtro=dia&data={Fmt.Iso(DateTime.Today)}");
        var reservasApi = await Sessao.Api.Lista("/api/office/reservas?status=todas&filtro=todas");
        var vendasApi = await Sessao.Api.Lista("/api/office/vendas?status=todas&filtro=todas");
        var reservas = reservasApi.Where(r => r.S("cliente").StartsWith("TESTE CODEX", StringComparison.OrdinalIgnoreCase)).ToList();
        var vendas = vendasApi.Where(r => r.S("cliente").StartsWith("TESTE CODEX", StringComparison.OrdinalIgnoreCase)).ToList();
        if (reservaIdTeste > 0) reservas = reservas.Where(r => r.L("id") == reservaIdTeste).ToList();
        if (vendaIdTeste > 0) vendas = vendas.Where(r => r.L("id") == vendaIdTeste).ToList();
        var bateriaId = reservas.FirstOrDefault()?.L("bateriaId");
        var bateria = baterias.FirstOrDefault(b => b.L("id") == bateriaId) ?? baterias.FirstOrDefault();

        await Janela(new FormCliente(null), principal, pasta, "24-cliente");
        await Janela(new FormCadastro("produtos", Cadastros.Defs["produtos"]), principal, pasta, "25-produto");
        await Janela(new FormCadastro("tracados", Cadastros.Defs["tracados"]), principal, pasta, "26-cad-tracado");
        await Janela(new FormCadastro("feriados", Cadastros.Defs["feriados"]), principal, pasta, "27-cad-feriados");
        await Janela(new FormCadastro("turnos", Cadastros.Defs["turnos"]), principal, pasta, "28-cad-turno");
        await Janela(new FormCadastro("terminais", Cadastros.Defs["terminais"]), principal, pasta, "29-cad-terminal");
        await Janela(new FormCadastro("formas", Cadastros.Defs["formas"]), principal, pasta, "30-metodos-pagamento");
        await Janela(new FormCadastro("itensManutencao", Cadastros.Defs["itensManutencao"]), principal, pasta, "31-cad-itens-manutencao");
        await Janela(new FormCadastro("padroes", Cadastros.Defs["padroes"]), principal, pasta, "32-cad-padroes");
        await Janela(new FormCadastro("usuarios", Cadastros.Defs["usuarios"]), principal, pasta, "33-office-usuario");
        await Janela(new FormCriarReservas(), principal, pasta, "34-criar-reservas");
        if (bateria != null)
        {
            await Janela(new FormBateria(bateria), principal, pasta, "35-editar-bateria");
            await Janela(new FormIncluirCliente(bateria), principal, pasta, "36-incluir-cliente");
        }
        else Log.Add("pendente: telas Editar Bateria e Incluir Cliente requerem bateria cadastrada na data.");
        await Janela(new FormAgenda(), principal, pasta, "37-agenda");
        await Janela(new FormVoucher("fidelidade"), principal, pasta, "38-voucher-fidelidade");
        await Janela(new FormVoucher("parceiro"), principal, pasta, "39-voucher-parceiro");
        await Janela(new FormVoucher("manual"), principal, pasta, "40-voucher-manual");
        var caixaTeste = caixa.DeepClone().AsObject();
        if (aberto != null && sumario != null)
        {
            await Janela(new FormCheckout(aberto, null, [], null), principal, pasta, "41-checkout");
            await Janela(new FormTerminalFechar(aberto, sumario), principal, pasta, "43-terminal-fechar");
            await Janela(new FormCaixaTransacao("suprimento", caixaTeste), principal, pasta, "44-suprimento");
            await Janela(new FormCaixaTransacao("sangria", caixaTeste), principal, pasta, "45-sangria");
        }
        else
        {
            // só visual: terminal fictício, nada é gravado (a tela só lê baterias/formas até alguém aprovar)
            var ficticio = new JsonObject { ["id"] = 0, ["terminal"] = "TESTE CODEX", ["caixaId"] = 0 };
            await Janela(new FormCheckout(ficticio, null, [], null), principal, pasta, "41-checkout-visual");
            ficticio["abertoEm"] = "2026-09-25T16:02"; ficticio["turno"] = "Noite"; ficticio["terminal"] = "SUÊNIA";
            var sumarioFicticio = new JsonObject { ["inicial"] = 15000, ["suprimento"] = 10000, ["sangria"] = 100000, ["vendasProdutos"] = 6000, ["vendas"] = 230250, ["desconto"] = 1750, ["acrescimos"] = 0, ["recebido"] = 238750, ["troco"] = 2500, ["cancelado"] = 0, ["final"] = 161250 };
            await Janela(new FormTerminalFechar(ficticio, sumarioFicticio), principal, pasta, "43-terminal-fechar-visual");
            Log.Add("pendente: fechamento, suprimento e sangria requerem terminal aberto (checkout capturado com terminal fictício).");
        }
        await Janela(new FormTerminalAbrir(caixaTeste), principal, pasta, "42-terminal-abrir");
        await Janela(new FormServicosOnline(), principal, pasta, "46-servicos-online");
        await Janela(new FormCadastro("parceiros", Cadastros.Defs["parceiros"]), principal, pasta, "47-cad-parceiro");
        await Janela(new FormTrocarSenha(), principal, pasta, "48-trocar-senha");
        await Janela(new FormAjuda("Atalhos do teclado"), principal, pasta, "49-ajuda-atalhos");

        await CapturarModal(principal, pasta, "50-empresa", () => Cadastros.Empresa(principal));
        await CapturarModal(principal, pasta, "51-office-parametros", () => Cadastros.Parametros(principal));
        await CapturarModal(principal, pasta, "52-pesquisar-cliente", () => FormPesquisarCliente.Escolher(principal, "Pesquisar cliente"));
        await CapturarModal(principal, pasta, "53-lista-participantes", () => Relatorios.Participantes(principal, null, DateTime.Today));
        await CapturarModal(principal, pasta, "54-relatorios-office", () => Relatorios.Periodo(principal, "receitas", "forma"));
        await CapturarModal(principal, pasta, "55-relatorio-fechamento-lista", () => Relatorios.Fechamento(principal));
        await CapturarModal(principal, pasta, "56-agenda-mensal", () => Relatorios.AgendaMensal(principal));
        if (reservas.Count > 0)
        {
            var r = reservas[0];
            await CapturarModal(principal, pasta, "57-editar-reserva", () => Acoes.EditarReserva(principal, r));
            await CapturarModal(principal, pasta, "58-mover-cliente", () => Acoes.MoverCliente(principal, r));
        }
        if (vendas.Count > 0)
        {
            var idVenda = vendas[0].L("id") ?? 0;
            await Janela(new FormVenda(idVenda), principal, pasta, "59-metodos-venda");
            await Janela(new FormEstorno(idVenda), principal, pasta, "60-estorno");
        }
        else Log.Add("pendente: telas MetodosPagamento e Estorno dependem da venda marcada TESTE CODEX informada para o autoteste.");

        await CapturarRelatorio(principal, pasta, "62-termo-em-branco", Sessao.Api.UrlComToken("/termo?branco=1"), "Termo de Responsabilidade");
        await CapturarRelatorio(principal, pasta, "63-relatorio-participantes", Sessao.Api.UrlComToken("/relatorio/participantes?data=" + Fmt.Iso(DateTime.Today)), "Participantes");

        if (movimentoIdTeste > 0)
            await CapturarRelatorio(principal, pasta, "61-relatorio-fechamento", Sessao.Api.UrlComToken("/relatorio/fechamento?mov=" + movimentoIdTeste), "Fechamento de Caixa");
        else Log.Add("pendente: relatório de fechamento requer o movimento de teste informado para o autoteste.");

        principal.Close();
        principal.Dispose();
        File.WriteAllLines(Path.Combine(pasta, "log.txt"), Log);
        File.WriteAllLines(Path.Combine(pasta, "cobertura.txt"), Log.Where(x => x.StartsWith("OK ") || x.StartsWith("ERRO ") || x.StartsWith("pendente:")));
    }

    static async Task CapturarMenus(FormPrincipal principal, string pasta)
    {
        var menu = Descendentes(principal).OfType<MenuStrip>().FirstOrDefault();
        if (menu == null) { Log.Add("ERRO menus-office: MenuStrip não encontrado."); return; }
        var i = 0;
        foreach (ToolStripMenuItem item in menu.Items.OfType<ToolStripMenuItem>())
        {
            item.ShowDropDown();
            await Esperar(180);
            await FotoMenu(item.DropDown, pasta, $"23-menu-{++i:00}-{Slug(item.Text.Replace("&", ""))}");
            item.HideDropDown();
        }
    }

    static async Task CapturarContexto(FormPrincipal principal, string pasta, string visao, string nome)
    {
        principal.Selecionar(visao);
        await Esperar(650);
        var grade = Descendentes(principal).OfType<DataGridView>().FirstOrDefault();
        if (grade == null || grade.Rows.Count == 0)
        {
            Log.Add($"pendente: {nome} requer pelo menos um registro real na lista.");
            return;
        }
        grade.ClearSelection();
        var row = grade.Rows.Cast<DataGridViewRow>().FirstOrDefault(r => r.Visible && !r.IsNewRow);
        if (row == null)
        {
            Log.Add($"pendente: {nome} requer um registro real visível na lista.");
            return;
        }
        row.Selected = true;
        var celula = row.Cells.Cast<DataGridViewCell>().FirstOrDefault(c => c.Visible);
        if (celula != null) grade.CurrentCell = celula;
        var menu = principal.CriarMenuContextoParaAutoteste();
        if (menu == null)
        {
            Log.Add($"pendente: {nome} não possui menu para a seleção atual.");
            return;
        }
        try
        {
            menu.Show(grade, new Point(28, Math.Min(30, Math.Max(0, grade.ClientSize.Height - 8))));
            await Esperar(220);
            await FotoMenu(menu, pasta, nome);
            Log.Add("OK " + nome);
        }
        catch (Exception e) { Log.Add($"ERRO {nome}: {e.Message}"); }
        finally { menu.Close(); menu.Dispose(); }
    }

    /// <summary>Clica de verdade num item do menu do botão direito (duas vezes seguidas),
    /// pelo mesmo caminho do mouse. Pega o "disposed object" que só aparecia no clique.</summary>
    static async Task CliqueNoMenu(FormPrincipal principal, string chave)
    {
        principal.Selecionar(chave);
        await Esperar(700);
        var grade = Descendentes(principal).OfType<DataGridView>().FirstOrDefault();
        if (grade == null || grade.Rows.Count == 0) { Log.Add("pendente: clique no menu sem linhas em " + chave); return; }
        grade.ClearSelection(); grade.Rows[0].Selected = true;
        Exception erro = null;
        ThreadExceptionEventHandler pega = (_, e) => erro ??= e.Exception;
        Application.ThreadException += pega;
        try
        {
            for (var vez = 1; vez <= 2 && erro == null; vez++)
            {
                var clicou = false;
                var item = new ToolStripMenuItem("(teste)", null, (_, _) => clicou = true);
                var menu = principal.MostrarMenuContexto(new Point(40, 30), item);
                await Esperar(250);
                try { item.PerformClick(); } catch (Exception e) { erro ??= e; }
                await Esperar(250);
                if (erro == null && !clicou) erro = new Exception("o clique não chegou na ação");
                if (erro == null && menu.Visible) erro = new Exception("o menu não fechou depois do clique");
            }
        }
        finally { Application.ThreadException -= pega; }
        Log.Add(erro == null ? "OK clique-menu-contexto" : "ERRO clique-menu-contexto: " + erro.Message);
    }

    static async Task Janela(Form form, IWin32Window dono, string pasta, string nome)
    {
        try
        {
            form.StartPosition = FormStartPosition.Manual;
            form.Location = new Point(24, 24);
            form.Show(dono);
            await Esperar(850);
            await Foto(form, pasta, nome);
        }
        catch (Exception e) { Log.Add($"ERRO {nome}: {e.Message}"); }
        finally { if (!form.IsDisposed) form.Close(); }
    }

    static async Task CapturarModal(Form principal, string pasta, string nome, Action abrir)
    {
        var completou = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var timer = new System.Windows.Forms.Timer { Interval = 140 };
        var tentou = false;
        timer.Tick += async (_, _) =>
        {
            if (tentou || completou.Task.IsCompleted) return;
            var alvo = Application.OpenForms.Cast<Form>().FirstOrDefault(f => f != principal && f.Visible && f is not FormLogin);
            if (alvo == null) return;
            tentou = true;
            timer.Stop();
            try { await Foto(alvo, pasta, nome); Log.Add("OK " + nome); }
            catch (Exception e) { Log.Add($"ERRO {nome}: {e.Message}"); }
            finally { try { alvo.Close(); } catch { } completou.TrySetResult(true); }
        };
        timer.Start();
        try { abrir(); }
        catch (Exception e) { Log.Add($"ERRO {nome}: {e.Message}"); completou.TrySetResult(false); }
        await Task.WhenAny(completou.Task, Task.Delay(12000));
        timer.Stop(); timer.Dispose();
        if (!completou.Task.IsCompleted) Log.Add("ERRO " + nome + ": nenhuma janela apareceu no período de captura.");
    }

    [System.Runtime.InteropServices.DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [System.Runtime.InteropServices.DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [System.Runtime.InteropServices.DllImport("user32.dll")] static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);

    /// <summary>Teste só do visualizador de relatório/termo, fora da tela e sem roubar o foco de quem
    /// está usando o computador. A foto é da própria janela (PrintWindow), não da tela.</summary>
    public static async Task RodarRelatorios(string pasta, string login, string senha)
    {
        Directory.CreateDirectory(pasta);
        Log.Clear();
        var acesso = await Sessao.Api.Post("/api/login", new { login, senha, termos = true });
        Sessao.Api.Token = acesso.S("token");
        Sessao.Usuario = acesso["usuario"]!.AsObject();
        using var dono = new Form { ShowInTaskbar = false, StartPosition = FormStartPosition.Manual, Location = new Point(-4000, -4000), Size = new Size(10, 10) };
        foreach (var (nome, url, titulo) in new[]
        {
            ("termo-em-branco", Sessao.Api.UrlComToken("/termo?branco=1"), "Termo de Responsabilidade"),
            ("relatorio-participantes", Sessao.Api.UrlComToken("/relatorio/participantes?data=" + Fmt.Iso(DateTime.Today)), "Participantes"),
        })
        {
            var antes = GetForegroundWindow();
            Relatorio.Abrir(dono, url, titulo);
            var alvo = Application.OpenForms.Cast<Form>().LastOrDefault(f => f is Relatorio);
            SetForegroundWindow(antes);
            if (alvo == null) { Log.Add("ERRO " + nome + ": não abriu"); continue; }
            alvo.Location = new Point(-3000, 0);
            await Esperar(900);
            await Esperar(900);
            await Esperar(900);
            await Esperar(900);
            var web = Descendentes(alvo).FirstOrDefault(c => c.GetType().Name == "WebView2");
            Log.Add(web != null && web.Width >= alvo.ClientSize.Width * 0.9 && web.Height >= alvo.ClientSize.Height * 0.7
                ? $"OK {nome} página {web.Width}x{web.Height} na janela {alvo.ClientSize.Width}x{alvo.ClientSize.Height} (kit: {alvo.FormBorderStyle})"
                : $"ERRO {nome}: página espremida ({web?.Width}x{web?.Height})");
            using (var bmp = new Bitmap(alvo.Width, alvo.Height))
            {
                using (var g = Graphics.FromImage(bmp)) { var hdc = g.GetHdc(); PrintWindow(alvo.Handle, hdc, 2); g.ReleaseHdc(hdc); }
                bmp.Save(Path.Combine(pasta, nome + ".png"));
            }
            alvo.Close();
            await Esperar(300);
        }
        File.WriteAllLines(Path.Combine(pasta, "log.txt"), Log);
    }

    static async Task CapturarRelatorio(Form principal, string pasta, string nome, string url, string titulo)
    {
        try
        {
            Relatorio.Abrir(principal, url, titulo);
            var limite = DateTime.UtcNow.AddSeconds(12);
            Form alvo = null;
            while (DateTime.UtcNow < limite && alvo == null)
            {
                alvo = Application.OpenForms.Cast<Form>().FirstOrDefault(f => f != principal && f.Visible && f.Text.Contains(titulo, StringComparison.OrdinalIgnoreCase));
                if (alvo == null) await Esperar(250);
            }
            if (alvo == null) { Log.Add("ERRO " + nome + ": relatório não abriu."); return; }
            await Esperar(2200);
            await FotoTela(alvo, pasta, nome);
            var web = Descendentes(alvo).FirstOrDefault(c => c.GetType().Name == "WebView2");
            if (web == null || web.Width < alvo.ClientSize.Width * 0.9 || web.Height < alvo.ClientSize.Height * 0.7)
                Log.Add($"ERRO {nome}: página espremida ({web?.Width}x{web?.Height} numa janela {alvo.ClientSize.Width}x{alvo.ClientSize.Height})");
            else Log.Add($"OK {nome}-tamanho {web.Width}x{web.Height}");
            alvo.Close();
        }
        catch (Exception e) { Log.Add($"ERRO {nome}: {e.Message}"); }
    }

    static IEnumerable<Control> Descendentes(Control root)
    {
        foreach (Control child in root.Controls)
        {
            yield return child;
            foreach (var sub in Descendentes(child)) yield return sub;
        }
    }

    static async Task Foto(Control c, string pasta, string nome)
    {
        await Esperar(160);
        Application.DoEvents();
        if (c.Width <= 0 || c.Height <= 0) throw new InvalidOperationException("A tela não tem tamanho visível.");
        using var bmp = new Bitmap(c.Width, c.Height);
        c.DrawToBitmap(bmp, new Rectangle(0, 0, c.Width, c.Height));
        bmp.Save(Path.Combine(pasta, nome + ".png"));
        Log.Add("OK " + nome);
    }

    static async Task FotoMenu(ToolStripDropDown menu, string pasta, string nome)
    {
        await Esperar(160);
        Application.DoEvents();
        var topo = menu.PointToScreen(Point.Empty);
        var tela = Screen.FromControl(menu).Bounds;
        var area = Rectangle.Intersect(new Rectangle(topo, menu.Size), tela);
        if (area.Width < 1 || area.Height < 1) throw new InvalidOperationException("O menu não está na área visível da tela.");
        using var bmp = new Bitmap(area.Width, area.Height);
        using var g = Graphics.FromImage(bmp);
        g.CopyFromScreen(area.Location, Point.Empty, area.Size);
        bmp.Save(Path.Combine(pasta, nome + ".png"));
        Log.Add("OK " + nome);
    }

    static async Task FotoTela(Form f, string pasta, string nome)
    {
        await Esperar(100);
        var tela = Screen.FromControl(f).Bounds;
        var area = Rectangle.Intersect(f.Bounds, tela);
        if (area.Width < 1 || area.Height < 1) throw new InvalidOperationException("O relatório está fora da área visível da tela.");
        using var bmp = new Bitmap(area.Width, area.Height);
        using var g = Graphics.FromImage(bmp);
        g.CopyFromScreen(area.Location, Point.Empty, area.Size);
        bmp.Save(Path.Combine(pasta, nome + ".png"));
        Log.Add("OK " + nome + " (captura de tela)");
    }

    static Task Esperar(int ms) => Task.Delay(ms);
    static string Slug(string valor) => string.Concat(valor.ToLowerInvariant().Select(c => char.IsLetterOrDigit(c) ? c : '-')).Trim('-');
}
