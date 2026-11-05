using Kartodromo.Comum;
using System.Runtime.InteropServices;

// Testes dos componentes do design system (fase 1). Uso: Kartodromo.Comum.Testes.exe [pasta-da-galeria]
// Com a pasta, salva galeria.png com todos os componentes desenhados para conferência visual.
static class Program
{
    [STAThread]
    static int Main(string[] args)
    {
        Application.SetHighDpiMode(HighDpiMode.DpiUnawareGdiScaled);
        Application.EnableVisualStyles();
        var erros = 0;

        Teste("cadastro: e-mail e peso obrigatórios e válidos", ref erros, () =>
        {
            foreach (var email in new[] { "", " ", "andre", "andre@", "a b@exemplo.com" })
                Exigir(ValidacaoCliente.ErroEmail(email) != null, "aceitou e-mail inválido");
            foreach (var peso in new[] { "", " ", "0", "-1", "500", "NaN", "Infinity", "abc" })
                Exigir(ValidacaoCliente.ErroPeso(peso) != null, "aceitou peso inválido");
            Exigir(ValidacaoCliente.ErroEmail("andre@exemplo.com") == null, "recusou e-mail válido");
            Exigir(ValidacaoCliente.ErroPeso("80,5") == null && ValidacaoCliente.ErroPeso("80.5") == null, "recusou peso válido");
            foreach (var perfil in new[] { "", " ", "@", "nome com espaço", "<script>", new string('a', 31) })
                Exigir(ValidacaoCliente.ErroInstagram(perfil) != null, "aceitou Instagram inválido");
            foreach (var perfil in new[] { "Piloto.Betim", "@Piloto.Betim", "https://www.instagram.com/Piloto.Betim/" })
            {
                Exigir(ValidacaoCliente.ErroInstagram(perfil) == null, "recusou Instagram válido");
                Exigir(ValidacaoCliente.NormalizarInstagram(perfil) == "@piloto.betim", "normalização incorreta");
            }
        });

        Teste("ponteiro: duas operações ao mesmo tempo voltam para a seta; a silenciosa não mexe no ponteiro", ref erros, () =>
        {
            SynchronizationContext.SetSynchronizationContext(new WindowsFormsSynchronizationContext());
            using var f = new Form();
            var a = new TaskCompletionSource(); var b = new TaskCompletionSource();
            Seguro.Rodar(f, () => a.Task);
            Seguro.Rodar(f, () => b.Task);                 // começa com o ponteiro de espera da primeira
            Exigir(f.Cursor == Cursors.WaitCursor, "espera durante as operações");
            static void Esperar(Func<bool> ate) { for (var i = 0; i < 100 && !ate(); i++) { Application.DoEvents(); Thread.Sleep(5); } }
            a.SetResult(); Esperar(() => false);
            Exigir(f.Cursor == Cursors.WaitCursor, "a segunda ainda rodando");
            b.SetResult(); Esperar(() => f.Cursor == Cursors.Default);
            Exigir(f.Cursor == Cursors.Default, "ficou preso no ponteiro de espera");
            var c = new TaskCompletionSource();
            Seguro.Rodar(f, () => c.Task, silencioso: true);
            Exigir(f.Cursor == Cursors.Default, "atualização automática mostrou espera");
            c.SetException(new Exception("rede caiu")); Esperar(() => false);   // silenciosa: sem janela de erro
            Exigir(f.Cursor == Cursors.Default, "erro silencioso mexeu no ponteiro");
        });

        Teste("grade: recarga igual não redesenha; recarga com mudança mantém rolagem, linha atual e colunas", ref erros, () =>
        {
            using var f = new Form { Size = new Size(600, 300) };
            var g = new Grade();
            f.Controls.Add(g);
            f.CreateControl(); g.CreateControl();
            Col[] cols() => [new("id", "Id", TipoCol.Inteiro), new("nome", "Nome")];
            List<System.Text.Json.Nodes.JsonObject> dados(int n, string sufixo = "") => Enumerable.Range(1, n).Select(i => new System.Text.Json.Nodes.JsonObject { ["id"] = i, ["nome"] = "Piloto " + i + sufixo }).ToList();
            g.RowTemplate.Height = 34;
            g.LimparFiltros(); g.Carregar([]);   // ao abrir: sem colunas ainda (1.0.52 dava exceção aqui)
            g.Colunas(cols()); g.Carregar(dados(200));
            var versao = g.VersaoColunas;
            var linha0 = g.Rows[0];
            g.FirstDisplayedScrollingRowIndex = 120;
            g.CurrentCell = g.Rows[130].Cells[1];
            var rolagem = g.FirstDisplayedScrollingRowIndex;
            g.Colunas(cols()); g.Carregar(dados(200));
            Exigir(g.VersaoColunas == versao, "colunas refeitas numa recarga da mesma lista");
            Exigir(ReferenceEquals(g.Rows[0], linha0), "redesenhou sem nada ter mudado");
            g.Colunas(cols()); g.Carregar(dados(201, " *"));
            Exigir(g.Rows.Count == 201, "linhas novas");
            Exigir(g.Rows[0].Height == 34, $"altura da linha {g.Rows[0].Height} (devia seguir o RowTemplate da tela)");
            Exigir(g.FirstDisplayedScrollingRowIndex == rolagem, $"voltou a rolagem para {g.FirstDisplayedScrollingRowIndex}");
            Exigir(g.Atual?.S("id") == "131", $"perdeu a linha atual ({g.Atual?.S("id")})");
        });
        Teste("erro: mostra o motivo que o servidor mandou (validação), e o texto padrão para erro interno", ref erros, () =>
        {
            Exigir(ApiException.Motivo(new ApiException("A senha precisa ter pelo menos 6 caracteres.", 400), "padrão") == "A senha precisa ter pelo menos 6 caracteres.", "400 escondeu o motivo");
            Exigir(ApiException.Motivo(new ApiException("Não foi possível falar com o servidor.", 0), "padrão") == "Não foi possível falar com o servidor.", "rede fora");
            Exigir(ApiException.Motivo(new ApiException("stack trace qualquer", 500), "padrão") == "padrão", "500 mostrou texto interno");
            Exigir(ApiException.Motivo(new ApiException("Erro 404 no servidor.", 404), "padrão") == "padrão", "erro sem motivo");
            Exigir(ApiException.Motivo(new InvalidOperationException("x"), "padrão") == "padrão", "exceção comum");
        });
        Teste("botão: alturas P 32 · M 40 · G 48 e só-ícone quadrado", ref erros, () =>
        {
            Exigir(new Botao("Salvar", VarianteBotao.Primario, TamanhoBotao.P).Height == 32, "P");
            Exigir(new Botao("Salvar", VarianteBotao.Primario).Height == 40, "M");
            Exigir(new Botao("Salvar", VarianteBotao.Primario, TamanhoBotao.G).Height == 48, "G");
            var x = new Botao("", VarianteBotao.SoIcone) { Svg = IconesLucide.Fechar, Dica = "Fechar" };
            Exigir(x.Width == x.Height && x.AccessibleName == "Fechar", "só-ícone quadrado e com nome acessível");
        });
        Teste("botão: o rótulo nunca corta (largura acompanha o texto) e mínimo de 88 no M", ref erros, () =>
        {
            foreach (var texto in new[] { "OK", "Continuar para pagamento", "Concluir cobrança e imprimir comprovante" })
            {
                var b = new Botao(texto, VarianteBotao.Primario);
                using var f = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo, FontStyle.Bold);
                var precisa = TextRenderer.MeasureText(texto, f).Width;
                Exigir(b.Width >= precisa + 2 * Tokens.Claro.Espaco2 && b.Width >= 88, $"'{texto}': {b.Width} < {precisa}");
            }
        });
        Teste("botão: carregando mostra reticências e não muda para menos que o texto", ref erros, () =>
        {
            var b = new Botao("Salvar cliente", VarianteBotao.Primario);
            var antes = b.Width;
            b.Carregando = true;
            Exigir(b.Width >= antes, "largura não encolhe");
            b.TextoCarregando = "Salvando…";
            Exigir(b.Carregando, "estado carregando");
        });
        Teste("selo: largura cabe o texto com folga de 8 de cada lado", ref erros, () =>
        {
            var s = new Selo("A pagar", Estado.Aviso);
            using var f = Tokens.Fonte(Tokens.Claro.FonteTamanhoLegenda, FontStyle.Bold);
            var w = TextRenderer.MeasureText("A pagar", f, Size.Empty, TextFormatFlags.NoPadding).Width;
            Exigir(s.Width >= w + 16 && s.Height == 22, $"selo {s.Size} para texto {w}");
            var p = new Selo("Pista", Estado.Sucesso, comPonto: true);
            Exigir(p.Width > new Selo("Pista", Estado.Sucesso).Width, "com ponto fica mais largo");
        });
        Teste("raio acompanha o redimensionamento (antes cortava o que crescia)", ref erros, () =>
        {
            var p = new Panel { Size = new Size(40, 20) };
            Forma.AplicarRaio(p, 10);
            p.Size = new Size(300, 60);
            using var g = Graphics.FromHwnd(IntPtr.Zero);
            var r = p.Region.GetBounds(g);
            Exigir(r.Width >= 299 && r.Height >= 59, $"recorte {r} não acompanhou 300x60");
            Forma.AplicarRaio(p, 6); // chamar de novo só troca o raio
            p.Size = new Size(120, 40);
            r = p.Region.GetBounds(g);
            Exigir(r.Width >= 119 && r.Height >= 39, $"recorte {r} depois de trocar o raio");
        });
        Teste("contorno arredondado: chamar várias vezes não empilha e acompanha o tamanho", ref erros, () =>
        {
            var p = new Panel { Size = new Size(100, 50) };
            for (var i = 0; i < 5; i++) Forma.ArredondarComContorno(p, 9);
            p.Size = new Size(260, 90);
            using var g = Graphics.FromHwnd(IntPtr.Zero);
            var r = p.Region.GetBounds(g);
            Exigir(r.Width >= 258 && r.Height >= 88, $"recorte {r}"); // contorno usa Width-1 (desenho original)
        });
        Teste("mensagem: cresce com o texto, botões dentro da janela, foco em Cancelar na destrutiva", ref erros, () =>
        {
            using var curta = new DialogoMensagem("Atenção!", "Informe o valor.", Estado.Aviso, "OK", null, false, false);
            var longo = string.Join(" ", Enumerable.Repeat("Texto longo da mensagem que precisa quebrar em várias linhas.", 12));
            using var grande = new DialogoMensagem("Não foi possível concluir", longo, Estado.Perigo, "&Tentar de novo", "&Fechar", false, false);
            Exigir(grande.ClientSize.Height > curta.ClientSize.Height + 60, $"altura {grande.ClientSize.Height} x {curta.ClientSize.Height}");
            foreach (var d in new[] { curta, grande })
                foreach (Control c in d.Controls)
                    Exigir(c.Right <= d.ClientSize.Width && c.Bottom <= d.ClientSize.Height, $"{c.GetType().Name} fora da janela: {c.Bounds} em {d.ClientSize}");
            using var excluir = new DialogoMensagem("Excluir a observação?", "Isso não pode ser desfeito.", Estado.Perigo, "Excluir observação", "Cancelar", true, true);
            Exigir(excluir.ActiveControl is Botao { Text: "Cancelar" }, "foco inicial em Cancelar");
            Exigir(excluir.CancelButton is Botao { Text: "Cancelar" }, "Esc = Cancelar");
        });
        Teste("mensagem modal: diálogo fica acima do fundo e pode ser fechado", ref erros, () =>
        {
            using var dono = new Form { StartPosition = FormStartPosition.Manual, Location = new Point(-3000, -3000), Size = new Size(800, 600) };
            dono.Show();
            using var d = new DialogoMensagem("Atenção!", "O resultado não informa o kart.", Estado.Aviso, "OK", null, false, false)
            {
                StartPosition = FormStartPosition.Manual,
                Location = new Point(-2800, -2800),
            };
            bool acima = false;
            d.Shown += (_, _) =>
            {
                var fundo = Application.OpenForms.OfType<Escurecer>().SingleOrDefault();
                if (fundo != null)
                {
                    var janela = GetTopWindow(IntPtr.Zero);
                    while (janela != IntPtr.Zero && janela != d.Handle && janela != fundo.Handle)
                        janela = GetWindow(janela, 2); // GW_HWNDNEXT
                    acima = janela == d.Handle;
                }
                d.BeginInvoke(() => d.Close());
            };
            d.ShowDialog(dono);
            Exigir(acima, "o fundo escurecido ficou sobre o diálogo");
            dono.Close();
        });
        Teste("autoteste: confirmação destrutiva é registrada e responde Não", ref erros, () =>
        {
            var log = new List<string>();
            Msg.Registro = log.Add;
            try
            {
                Exigir(!Msg.Confirmar(null, "Excluir a observação?", "Some do relatório.", "Excluir observação"), "respondeu Sim");
                Exigir(log.Count == 1 && log[0].StartsWith("PERGUNTA"), "registro: " + string.Join("|", log));
                Toast.Mostrar(null, "Cliente salvo.");
                Exigir(log.Count == 2 && log[1].StartsWith("TOAST"), "toast registrado no autoteste");
            }
            finally { Msg.Registro = null; }
        });
        Teste("estado vazio: textos dentro da área em 320x240", ref erros, () =>
        {
            var v = new EstadoVazio("Nenhuma bateria hoje", "Crie a primeira bateria para começar. As voltas aparecem aqui assim que os karts passarem.", "Nova bateria", () => { }) { Size = new Size(320, 240) };
            v.PerformLayout();
            foreach (Control c in v.Controls) Exigir(c.Left >= 0 && c.Right <= v.Width && c.Bottom <= v.Height, $"{c.GetType().Name} {c.Bounds}");
        });

        Teste("ícone do ranking por peso (arcos fechados) não sai preto", ref erros, () =>
        {
            var img = (Bitmap)Forma.Tile("M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z", "linear-gradient(180deg, #FFB547, #F07A00)");
            var meio = img.GetPixel(img.Width / 4, img.Height / 4);
            Exigir(meio.R > 150, "cor do degradê no canto: " + meio);
        });
        if (args.Length > 0) Galeria(args[0]);
        Console.WriteLine(erros == 0 ? "PASS: componentes do design system" : $"FAIL: {erros} teste(s)");
        return erros == 0 ? 0 : 1;
    }

    static void Galeria(string pasta)
    {
        Directory.CreateDirectory(pasta);
        using var f = new Form { ClientSize = new Size(900, 620), BackColor = Tokens.Claro.CorFundoApp, FormBorderStyle = FormBorderStyle.None, StartPosition = FormStartPosition.Manual, Location = new Point(-3000, -3000), ShowInTaskbar = false };
        var fluxo = new FlowLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(24), BackColor = Tokens.Claro.CorFundoApp, FlowDirection = FlowDirection.TopDown, WrapContents = false };
        FlowLayoutPanel Linha() { var l = new FlowLayoutPanel { AutoSize = true, WrapContents = false, BackColor = Color.Transparent, Margin = new Padding(0, 0, 0, 12) }; fluxo.Controls.Add(l); return l; }
        var a = Linha();
        a.Controls.Add(new Botao("Salvar cliente", VarianteBotao.Primario));
        a.Controls.Add(new Botao("Cancelar", VarianteBotao.Secundario));
        a.Controls.Add(new Botao("Filtros", VarianteBotao.Fantasma) { Svg = IconesLucide.Busca });
        a.Controls.Add(new Botao("Excluir", VarianteBotao.Perigo) { Svg = IconesLucide.Lixeira });
        a.Controls.Add(new Botao("", VarianteBotao.SoIcone) { Svg = IconesLucide.Fechar, Dica = "Fechar" });
        a.Controls.Add(new Botao("Desabilitado", VarianteBotao.Primario) { Enabled = false });
        var b = Linha();
        b.Controls.Add(new Botao("Nova bateria", VarianteBotao.Primario, TamanhoBotao.P) { Svg = IconesLucide.Mais });
        b.Controls.Add(new Botao("Concluir cobrança", VarianteBotao.Primario, TamanhoBotao.G));
        b.Controls.Add(new Botao("Salvar cliente", VarianteBotao.Primario) { Carregando = true, TextoCarregando = "Salvando…" });
        var c = Linha();
        c.Controls.Add(new Selo("Pago", Estado.Sucesso));
        c.Controls.Add(new Selo("A pagar", Estado.Aviso));
        c.Controls.Add(new Selo("Cancelado", Estado.Perigo));
        c.Controls.Add(new Selo("Agendado", Estado.Info));
        c.Controls.Add(new Selo("Encerrada", Estado.Neutro));
        c.Controls.Add(new Selo("Pista", Estado.Sucesso, comPonto: true));
        c.Controls.Add(new Selo("Box", Estado.Aviso, comPonto: true));
        c.Controls.Add(new IndicadorCarregando());
        var banner = new Banner("Sem conexão com o servidor desde 17:40. Tentando de novo…", Estado.Perigo, "Tentar agora", () => { }) { Dock = DockStyle.None, Width = 840 };
        fluxo.Controls.Add(banner);
        var nota = new Banner("Esta bateria já tem resultado enviado por e-mail.", Estado.Info) { Dock = DockStyle.None, Width = 840 };
        fluxo.Controls.Add(nota);
        var vazio = new EstadoVazio("Nenhuma bateria hoje", "Crie a primeira bateria para começar.", "Nova bateria", () => { }) { Size = new Size(840, 240), Margin = new Padding(0, 12, 0, 0) };
        fluxo.Controls.Add(vazio);
        f.Controls.Add(fluxo);
        f.Show(); Application.DoEvents();
        using var bmp = new Bitmap(f.ClientSize.Width, f.ClientSize.Height);
        f.DrawToBitmap(bmp, new Rectangle(Point.Empty, f.ClientSize));
        bmp.Save(Path.Combine(pasta, "galeria.png"));
        f.Close();

        foreach (var (nome, dlg) in new (string, DialogoMensagem)[]
        {
            ("mensagem-pergunta", new DialogoMensagem("Atenção!", "ENCERRAR a bateria \"Bateria 14\" agora?\n\nPassagens depois disso não contam mais.", Estado.Neutro, "&Sim", "&Não", false, false)),
            ("mensagem-excluir", new DialogoMensagem("Excluir a observação?", "\"Kart 12 puxando para a direita\" — 08/10\nEla some do relatório da bateria 14. Isso não pode ser desfeito.", Estado.Perigo, "Excluir observação", "Cancelar", true, true)),
            ("mensagem-erro", new DialogoMensagem("Não foi possível concluir", "Não foi possível concluir a operação.\n\nTente novamente. Se o problema persistir, verifique a conexão ou acione o suporte.", Estado.Perigo, "&Tentar de novo", "&Fechar", false, false)),
        })
        {
            using (dlg)
            {
                dlg.StartPosition = FormStartPosition.Manual; dlg.Location = new Point(-3000, -3000); dlg.ShowInTaskbar = false;
                dlg.Show(); Application.DoEvents();
                using var img = new Bitmap(dlg.Width, dlg.Height);
                dlg.DrawToBitmap(img, new Rectangle(Point.Empty, dlg.Size));
                img.Save(Path.Combine(pasta, nome + ".png"));
                dlg.Close();
            }
        }
    }

    static void Teste(string nome, ref int erros, Action acao)
    {
        try { acao(); Console.WriteLine("OK: " + nome); }
        catch (Exception e) { erros++; Console.Error.WriteLine("FAIL: " + nome + " — " + e.Message); }
    }

    static void Exigir(bool condicao, string motivo)
    {
        if (!condicao) throw new InvalidOperationException(motivo);
    }

    [DllImport("user32.dll")]
    static extern IntPtr GetTopWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern IntPtr GetWindow(IntPtr hWnd, uint command);
}
