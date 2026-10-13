using System.Drawing.Drawing2D;
using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

/// <summary>Terminal (abrir/fechar), suprimento/sangria e checkout ("Aprovar" / "Receita Avulsa").</summary>
public static class Caixa
{
    static Api Api => Sessao.Api;

    /// <summary>Garante terminal aberto (pergunta como o LapTime: "O terminal ainda não foi aberto, deseja abrir agora?").</summary>
    public static async Task<JsonObject> Garantir(IWin32Window dono)
    {
        var c = (await Api.Get("/api/office/caixa")).AsObject();
        if (c["aberto"] is JsonObject) return c;
        if (!Msg.Pergunta(dono, "O terminal ainda não foi aberto, deseja abrir agora?")) return null;
        if (!await Abrir(dono, c)) return null;
        return (await Api.Get("/api/office/caixa")).AsObject();
    }

    static async Task<bool> Abrir(IWin32Window dono, JsonObject c)
    {
        using var j = new FormTerminalAbrir(c, await TerminaisEmUso());
        j.ShowDialog(dono);
        return j.Concluido;
    }

    /// <summary>Terminais com caixa ainda aberto: o servidor não os manda na lista de "Abrir o caixa", e a operadora
    /// precisa saber por que o dela sumiu (alguém abriu nele, ou ficou aberto de ontem).</summary>
    static async Task<List<(string Terminal, string Usuario, string Desde)>> TerminaisEmUso()
    {
        var lista = new List<(string, string, string)>();
        try
        {
            foreach (var m in (await Api.Get("/api/office/movimentos") as JsonArray ?? []).OfType<JsonObject>().Where(m => string.IsNullOrEmpty(m.S("fechadoEm"))))
            {
                var desde = DateTime.TryParse(m.S("abertoEm"), out var d) ? (d.Date == DateTime.Today ? $"hoje às {d:HH:mm}" : $"desde {d:dd/MM} às {d:HH:mm}") : "sem data";
                lista.Add((m.S("terminal"), string.IsNullOrEmpty(m.S("usuario")) ? "usuário removido" : m.S("usuario"), desde));
            }
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException or ApiException) { /* sem a lista, o diálogo abre como antes */ }
        return lista;
    }

    public static void Terminal(FormPrincipal f) => Seguro.Rodar(f, async () =>
    {
        var c = (await Api.Get("/api/office/caixa")).AsObject();
        if (c["aberto"] is not JsonObject ab) { if (await Abrir(f, c)) f.Recarregar(); return; }
        var s = c["sumario"]?.AsObject() ?? new JsonObject();
        using var j = new FormTerminalFechar(ab, s);
        j.ShowDialog(f);
        if (j.Concluido) Relatorio.Abrir(f, Api.UrlComToken("/relatorio/fechamento?mov=" + j.MovimentoId), "Fechamento de Caixa");
    });

    public static void Transacao(Form f, string tipo) => Seguro.Rodar(f, async () =>
    {
        var c = await Garantir(f);
        if (c == null) return;
        using var j = new FormCaixaTransacao(tipo, c);
        j.ShowDialog(f);
    });

    public static void CheckoutDeReservas(Form f, List<JsonObject> reservas)
    {
        if (reservas.Count == 0) return;
        var bat = reservas[0].S("bateriaId");
        Checkout(f, long.Parse(bat), reservas.Where(r => r.S("bateriaId") == bat).Select(r => r.L("id") ?? 0).ToList(), reservas[0].L("clienteId"));
    }

    public static void Checkout(Form f, long? bateriaId, List<long> reservaIds, long? clienteId) => Seguro.Rodar(f, async () =>
    {
        var c = await Garantir(f);
        if (c == null) return;
        using var j = new FormCheckout(c["aberto"].AsObject(), bateriaId, reservaIds ?? [], clienteId);
        j.ShowDialog(f);
        if (j.Concluido && f is FormPrincipal p) p.Recarregar();
    });
}

/// <summary>"Receita Avulsa" / "Aprovar Reserva" (REC-024): reservas disponiveis, carrinho, checkout e totais.</summary>
public class FormCheckout : CartaoModal
{
    protected override CreateParams CreateParams
    {
        get { var cp = base.CreateParams; cp.ClassStyle |= 0x20000; return cp; } // sombra da janela-cartão
    }

    static Button BotaoIcone(string texto, Color fundo, Color frente, int tam, float fonte, string fonteNome = "Segoe UI")
    {
        var b = new BotaoPlano { Text = texto, Size = new Size(tam, tam), FlatStyle = FlatStyle.Flat, BackColor = fundo, ForeColor = frente, Font = new Font(fonteNome, fonte, FontStyle.Bold), Cursor = Cursors.Hand, Margin = new Padding(0, 0, 0, 10), TabStop = true, AccessibleRole = AccessibleRole.PushButton, AccessibleName = texto == "✕" ? "Fechar janela" : texto };
        b.FlatAppearance.BorderSize = 0; b.FlatAppearance.MouseOverBackColor = ControlPaint.Light(fundo, 0.1f);
        b.Resize += (_, _) => KitVisual.AplicarRaio(b, 14);
        return b;
    }

    static Api Api => Sessao.Api;
    class ItemCarrinho
    {
        public long K; public long? InscricaoId; public long? ProdutoId; public string Cliente, Produto; public int Qtd = 1; public long Unit, Desc, Acr; public decimal DescPct, AcrPct; public bool Voucher;
    }
    readonly List<ItemCarrinho> _car = [];
    readonly List<(long forma, string nome, long valor)> _pags = [];
    List<JsonObject> _disp = [];
    JsonObject _cliente;
    string _voucher;
    long _seq = 1;
    public bool Concluido { get; private set; }

    readonly ComboBox _bat = Campos.Combo(), _forma = Campos.Combo();
    readonly Label _cli = new() { AutoSize = true, Font = Tema.Negrito }, _doc = new() { AutoSize = true, Font = Tema.Negrito };
    readonly TextBox _obs = new() { Multiline = true, Height = 44, Dock = DockStyle.Fill }, _valor = new() { Width = 110 }, _codVoucher = new() { Width = 140, PlaceholderText = "Codigo do Voucher" };
    readonly Grade _gDisp = new(true), _gCar = new(), _gPag = new();
    readonly Dictionary<string, Label> _tot = [];
    readonly Label _falta = new() { AutoSize = true, ForeColor = Tokens.Claro.CorTextoSecundario };
    readonly Label _etapaAtual = new() { Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno, FontStyle.Bold), ForeColor = Tokens.Claro.CorAcaoPrincipalPressionado };
    Label _avisoPagamento;
    Panel _formasCard, _pagamentosCard, _bloqueioPagamento;
    TableLayoutPanel _pagamentos;
    Button _btnAdicionarSelecionadas, _btnConcluir, _btnContinuarPagamento;
    bool _pagamentoAtivo;

    public FormCheckout(JsonObject terminal, long? bateriaId, List<long> reservaIds, long? clienteId)
        : base(1320, 812)
    {
        Text = reservaIds.Count > 0 ? "Cobrar reservas" : "Receita avulsa";
        // ---------- direita: totais
        var dir = new Panel { Dock = DockStyle.Right, Width = 240, Padding = new Padding(8) };
        var totais = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false };
        foreach (var (k, t, cor) in new[] { ("tot", "TOTAL", Color.Black), ("des", "DESCONTO (R$)", Tema.Vermelho), ("acr", "ACRÉSCIMO (R$)", Tema.Vermelho), ("sub", "SUBTOTAL", Tema.Verde), ("rec", "VALOR RECEBIDO", Color.Black), ("tro", "TROCO", Color.Black) })
        {
            var box = new Panel { Width = 218, Height = 72, BackColor = Tokens.Primitivo.Branco, BorderStyle = BorderStyle.FixedSingle, Margin = new Padding(0, 0, 0, 12) };
            var v = new Label { Text = "0,00", Dock = DockStyle.Fill, TextAlign = ContentAlignment.TopCenter, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoTituloGrande, FontStyle.Bold), ForeColor = cor };
            box.Controls.Add(v);
            box.Controls.Add(new Label { Text = t, Dock = DockStyle.Top, Height = 32, TextAlign = ContentAlignment.BottomCenter, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoTituloGrande, FontStyle.Bold) });
            _tot[k] = v;
            totais.Controls.Add(box);
        }
        var aprovar = new BotaoPlano { Text = "Aprovar", Width = 218, Height = 64, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoTituloGrande, FontStyle.Bold), BackColor = Tokens.Primitivo.Branco, FlatStyle = FlatStyle.Flat };
        aprovar.FlatAppearance.BorderColor = Tema.Azul;
        aprovar.Click += (_, _) => Aprovar();
        totais.Controls.Add(aprovar);
        totais.Controls.Add(new Label { Text = "Terminal " + terminal.S("terminal"), AutoSize = true, ForeColor = Tema.Cinza });
        dir.Controls.Add(totais);

        // ---------- esquerda
        var esq = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 3, RowCount = 5, Padding = new Padding(8) };
        esq.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 42)); esq.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 44)); esq.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 58));
        esq.RowStyles.Add(new RowStyle(SizeType.Absolute, 34)); esq.RowStyles.Add(new RowStyle(SizeType.Absolute, 70)); esq.RowStyles.Add(new RowStyle(SizeType.Percent, 60));
        esq.RowStyles.Add(new RowStyle(SizeType.Percent, 40)); esq.RowStyles.Add(new RowStyle(SizeType.Absolute, 38));
        var linha1 = new FlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false };
        _bat.Width = 260;
        var bPesq = new BotaoPlano { Text = "🔍 Pesquisar Cliente", AutoSize = true };
        bPesq.Click += (_, _) => { var cl = FormPesquisarCliente.Escolher(this); if (cl != null) { _cliente = cl; Atualizar(); } };
        linha1.Controls.AddRange([Lbl("Bateria"), _bat, Lbl("   Cliente:"), _cli, Lbl("   Documento:"), _doc, bPesq]);
        esq.Controls.Add(linha1, 0, 0); esq.SetColumnSpan(linha1, 3);
        var pObs = new Panel { Dock = DockStyle.Fill }; pObs.Controls.Add(_obs); pObs.Controls.Add(new Label { Text = "Observações", Dock = DockStyle.Top, Height = 18 });
        esq.Controls.Add(pObs, 0, 1); esq.SetColumnSpan(pObs, 3);

        _gDisp.Colunas(new("reserva", "Reserva", Largura: 110), new("cliente", "Cliente", Largura: 170), new("produto", "Produto", Largura: 160), new("categoria", "Categoria", Largura: 90), new("aprovada", "Aprov.", TipoCol.Bool));
        _gDisp.Duplo += r => Adicionar([r]);
        esq.Controls.Add(Caixinha("Reservas disponíveis", _gDisp, ContentAlignment.MiddleRight), 0, 2);
        var setas = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, Padding = new Padding(2, 80, 0, 0) };
        var bAdd = new BotaoPlano { Text = "Adicionar →", Width = 92, Height = 30, AccessibleName = "Adicionar ao carrinho" };
        var bRem = new BotaoPlano { Text = "← Remover", Width = 92, Height = 30, AccessibleName = "Remover do carrinho" };
        var bDel = new BotaoPlano { Text = "Limpar", Width = 92, Height = 30, AccessibleName = "Limpar carrinho" };
        bAdd.Click += (_, _) => Adicionar(_gDisp.Marcados.Count > 0 ? _gDisp.Marcados : _gDisp.Selecionados);
        bRem.Click += (_, _) => Remover(); bDel.Click += (_, _) => Remover();
        setas.Controls.AddRange([bAdd, bRem, bDel]);
        esq.Controls.Add(setas, 1, 2);
        _gCar.Colunas(new("cliente", "Cliente", Largura: 150), new("produto", "Produto", Largura: 170), new("qtd", "Quantidade", TipoCol.Inteiro, 80), new("unit", "Preço", TipoCol.Dinheiro, 80),
            new("descPct", "Desconto (%)", Largura: 90), new("desc", "Desconto (R$)", TipoCol.Dinheiro), new("acrPct", "Acréscimo (%)", Largura: 90), new("acr", "Acréscimo (R$)", TipoCol.Dinheiro));
        esq.Controls.Add(Caixinha("Carrinho", _gCar, ContentAlignment.MiddleLeft), 2, 2);

        // checkout
        var ck = new Panel { Dock = DockStyle.Fill };
        _forma.Items.AddRange(Sessao.Formas()); if (_forma.Items.Count > 0) _forma.SelectedIndex = 0;
        var gck = Campos.Grade(2, 65, 35);
        Campos.Add(gck, "Forma de pagamento", _forma); Campos.Add(gck, "Valor", _valor);
        var bPA = new BotaoPlano { Text = "Adicionar", AutoSize = true }; var bPR = new BotaoPlano { Text = "Remover", AutoSize = true };
        bPA.Click += (_, _) => AdicionarPagamento(); bPR.Click += (_, _) => { foreach (var r in _gPag.Selecionados) _pags.RemoveAt(r.I("i")); Atualizar(); };
        var fb = new FlowLayoutPanel { Dock = DockStyle.Top, FlowDirection = FlowDirection.RightToLeft, Height = 32 }; fb.Controls.AddRange([bPA, bPR]);
        ck.Controls.Add(fb); ck.Controls.Add(gck); ck.Controls.Add(new Label { Text = "Checkout", Font = Tema.Negrito, Dock = DockStyle.Top, Height = 40, TextAlign = ContentAlignment.TopLeft });
        esq.Controls.Add(ck, 0, 3); esq.SetColumnSpan(ck, 2);
        _gPag.Colunas(new("forma", "Método de Pagamento", Largura: 260), new("valor", "Valor (R$)", TipoCol.Dinheiro));
        esq.Controls.Add(new Panel { Dock = DockStyle.Fill, BorderStyle = BorderStyle.FixedSingle, Controls = { _gPag } }, 2, 3);

        var rod = new FlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false };
        var bProd = new BotaoPlano { Text = "Adicionar Produtos", AutoSize = true }; var bDesc = new BotaoPlano { Text = "Aplicar Desconto", AutoSize = true };
        var bAcr = new BotaoPlano { Text = "Aplicar Acréscimo", AutoSize = true }; var bVou = new BotaoPlano { Text = "Aplicar Voucher", AutoSize = true };
        bProd.Click += (_, _) => AdicionarProduto(); bDesc.Click += (_, _) => Ajuste(true); bAcr.Click += (_, _) => Ajuste(false); bVou.Click += (_, _) => AplicarVoucher();
        rod.Controls.AddRange([bProd, new Label { Width = 200 }, bDesc, bAcr, _codVoucher, bVou]);
        esq.Controls.Add(rod, 0, 4); esq.SetColumnSpan(rod, 3);

        Controls.Add(esq);
        Controls.Add(dir);
        MontarLayoutCartoes(terminal);
        _pagamentoAtivo = reservaIds.Count > 0;
        // janela-cartão (Checkout.dc.html): sem moldura, cantos arredondados, cabe na tela
        var area = Screen.FromPoint(Cursor.Position).WorkingArea;
        ClientSize = new Size(Math.Min(1320, area.Width - 16), Math.Min(812, area.Height - 16));
        MinimumSize = new Size(1000, 640);
        Resize += (_, _) => { using var p = VisualPrincipal.Redondo(new Rectangle(0, 0, Width, Height), 18); Region = new Region(p); };
        _bat.SelectedIndexChanged += (_, _) => CarregarDisponiveis();
        Load += (_, _) => Seguro.Rodar(this, async () =>
        {
            var hoje = await Api.Lista($"/api/office/baterias?status=todas&filtro=dia&data={Fmt.Iso(DateTime.Today)}");
            if (bateriaId != null && !hoje.Any(b => b.L("id") == bateriaId))
            {
                var todas = await Api.Lista($"/api/office/reservas?status=todas&bateriaId={bateriaId}");
                if (todas.Count > 0) hoje.Insert(0, new JsonObject { ["id"] = bateriaId, ["nome"] = todas[0].S("reserva"), ["dataHora"] = todas[0].S("dataHora") });
            }
            _bat.Items.Add(new Campos.Item(0, "— sem bateria —"));
            _bat.Items.AddRange(hoje.Select(b => new Campos.Item(b.L("id") ?? 0, $"{Fmt.Hm(b.S("dataHora"))} {b.S("nome")}", b)).ToArray());
            if (clienteId != null) _cliente = (await Api.Get($"/api/office/clientes/{clienteId}")).AsObject();
            if (bateriaId != null) { Campos.Selecionar(_bat, bateriaId); await CarregarDisponiveisAsync(); Adicionar(_disp.Where(r => reservaIds.Contains(r.L("id") ?? -1)).ToList()); }
            else _bat.SelectedIndex = 0;
            Atualizar();
        });
    }

    void MontarLayoutCartoes(JsonObject terminal)
    {
        var fundo = Tokens.Claro.CorFundoApp;
        var texto = Tokens.Claro.CorTextoPrincipal;
        var secundario = Tokens.Claro.CorTextoSecundario;
        var oldRoots = Controls.Cast<Control>().ToArray();
        Controls.Clear(); BackColor = fundo;

        var resumo = new Panel { Dock = DockStyle.Right, Width = 300, BackColor = Tokens.Claro.CorSuperficieInversa, Padding = new Padding(18, 12, 18, 16) };
        resumo.Paint += (_, e) =>
        {
            using var b = new LinearGradientBrush(resumo.ClientRectangle, Tokens.Claro.CorSuperficieInversa, Color.FromArgb(11, 11, 12), 90f);
            e.Graphics.FillRectangle(b, resumo.ClientRectangle);
        };
        var resumoLayout = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 5, BackColor = Color.Transparent, Padding = new Padding(0) };
        resumoLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 36)); resumoLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 5 * 40 + 18));
        resumoLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 104)); resumoLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 100)); resumoLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 112));
        var fechar = new Panel { Dock = DockStyle.Fill, BackColor = Color.Transparent };
        var botaoX = BotaoIcone("✕", Color.FromArgb(58, 58, 62), Tokens.Primitivo.Branco, 32, 10F); botaoX.Margin = Padding.Empty; botaoX.Anchor = AnchorStyles.Top | AnchorStyles.Right;
        botaoX.Click += (_, _) => Close();
        fechar.Controls.Add(botaoX); fechar.Resize += (_, _) => botaoX.Location = new Point(fechar.Width - botaoX.Width, 2);
        var rodapeResumo = new Panel { Dock = DockStyle.Fill, BackColor = Color.Transparent };
        var aprovar = new BotaoPlano { Text = "Concluir cobrança", Dock = DockStyle.Top, Height = 56, FlatStyle = FlatStyle.Flat, BackColor = Tokens.Claro.CorStatusOnline, ForeColor = Tokens.Primitivo.Branco, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoTitulo, FontStyle.Bold), Cursor = Cursors.Hand, AccessibleRole = AccessibleRole.PushButton, AccessibleName = "Concluir cobrança" };
        _btnConcluir = aprovar;
        aprovar.FlatAppearance.BorderSize = 0; aprovar.FlatAppearance.MouseOverBackColor = Color.FromArgb(76, 217, 100); aprovar.Click += (_, _) => Aprovar();
        aprovar.Paint += (_, e) =>
        {
            // gradiente do design (verde claro em cima, verde escuro embaixo)
            var inicio = aprovar.Enabled ? Color.FromArgb(76, 217, 100) : Color.FromArgb(155, 178, 161);
            var fim = aprovar.Enabled ? Color.FromArgb(31, 158, 74) : Color.FromArgb(121, 139, 128);
            using var gb = new LinearGradientBrush(aprovar.ClientRectangle, inicio, fim, 90f);
            e.Graphics.FillRectangle(gb, aprovar.ClientRectangle);
            TextRenderer.DrawText(e.Graphics, aprovar.Text, aprovar.Font, aprovar.ClientRectangle, aprovar.Enabled ? Tokens.Primitivo.Branco : Tokens.Claro.CorSelecaoFundo, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        };
        aprovar.Resize += (_, _) => KitVisual.AplicarRaio(aprovar, 16);
        rodapeResumo.Controls.Add(aprovar);
        rodapeResumo.Controls.Add(new Label { Text = "F12 aprova e imprime o recibo se configurado", Dock = DockStyle.Bottom, Height = 42, ForeColor = Color.FromArgb(150, 150, 155), TextAlign = ContentAlignment.MiddleCenter, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoLegenda) });
        var trocoCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.FromArgb(31, 68, 45), Padding = new Padding(14, 12, 12, 10), Margin = new Padding(0, 0, 0, 10) };
        Arredondar(trocoCard, 16);
        trocoCard.Controls.Add(new Label { Text = "Troco", Dock = DockStyle.Top, Height = 22, ForeColor = Color.FromArgb(167, 240, 186), Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno) });
        _tot["tro"].Dock = DockStyle.Fill; _tot["tro"].TextAlign = ContentAlignment.MiddleLeft; _tot["tro"].Font = new Font("Segoe UI", 28F, FontStyle.Bold); _tot["tro"].ForeColor = Tokens.Primitivo.Branco; _tot["tro"].BackColor = Color.Transparent;
        trocoCard.Controls.Add(_tot["tro"]); _tot["tro"].BringToFront();
        var linhasResumo = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 5, BackColor = Color.Transparent, Padding = new Padding(0, 12, 0, 10) };
        for (var i = 0; i < 5; i++) linhasResumo.RowStyles.Add(new RowStyle(SizeType.Absolute, 40));
        var descricoes = new[] { ("tot", "Total"), ("des", "Desconto"), ("acr", "Acréscimo"), ("sub", "Subtotal"), ("rec", "Valor recebido") };
        foreach (var (key, label) in descricoes)
        {
            var row = new Panel { Dock = DockStyle.Fill, BackColor = Color.Transparent };
            var l = new Label { Text = label, Dock = DockStyle.Left, Width = 120, ForeColor = Color.FromArgb(174, 174, 180), TextAlign = ContentAlignment.MiddleLeft, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoSubtitulo) };
            var value = _tot[key]; value.Dock = DockStyle.Fill; value.TextAlign = ContentAlignment.MiddleRight; value.Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoTitulo, FontStyle.Bold);
            value.ForeColor = key == "sub" ? Color.FromArgb(124, 234, 150) : key is "des" or "acr" ? Color.FromArgb(255, 105, 97) : Tokens.Primitivo.Branco; value.BackColor = Color.Transparent;
            row.Controls.Add(value); row.Controls.Add(l); row.Paint += (_, e) => { using var p = new Pen(Color.FromArgb(45, 255, 255, 255)); e.Graphics.DrawLine(p, 0, row.Height - 1, row.Width, row.Height - 1); };
            linhasResumo.Controls.Add(row);
        }
        resumoLayout.Controls.Add(fechar, 0, 0); resumoLayout.Controls.Add(linhasResumo, 0, 1); resumoLayout.Controls.Add(trocoCard, 0, 2); resumoLayout.Controls.Add(rodapeResumo, 0, 4);
        resumo.Controls.Clear(); resumo.Controls.Add(resumoLayout);

        var principal = new Panel { Dock = DockStyle.Fill, BackColor = fundo };
        var cab = new Panel { Dock = DockStyle.Top, Height = 70, BackColor = Tokens.Primitivo.Branco, Padding = new Padding(18, 9, 200, 8) };
        var linhaCab = new FlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false, FlowDirection = FlowDirection.LeftToRight, Padding = new Padding(0, 0, 0, 0), AutoScroll = false, BackColor = Tokens.Primitivo.Branco };
        var bloco = new Panel { Size = new Size(270, 52), Margin = new Padding(0, 0, 12, 0), BackColor = Tokens.Primitivo.Branco };
        var icoRec = new PictureBox { Image = VisualPrincipal.Icone("receita"), SizeMode = PictureBoxSizeMode.Zoom, Size = new Size(52, 52), Location = new Point(-6, -2) };
        bloco.Controls.Add(icoRec);
            bloco.Controls.Add(new Label { Text = Text.Contains("Cobrar") ? "Cobrar reservas" : "Receita avulsa", AutoSize = true, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoTitulo, FontStyle.Bold), Location = new Point(48, 6), ForeColor = texto });
        bloco.Controls.Add(new Label { Text = $"Terminal {terminal.S("terminal")} · {Sessao.Nome}", AutoSize = true, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno), ForeColor = secundario, Location = new Point(49, 30) });
        linhaCab.Controls.Add(bloco);
        var blocoBat = InfoCheckout("Bateria", _bat, 250);
        var blocoCli = InfoCheckout("Cliente", _cli, 190);
        var blocoDoc = InfoCheckout("Documento", _doc, 150);
        linhaCab.Controls.Add(blocoBat); linhaCab.Controls.Add(blocoCli); linhaCab.Controls.Add(blocoDoc);
        var pesquisar = new BotaoPlano { Text = "  Pesquisar cliente", Image = LupaBmp(), ImageAlign = ContentAlignment.MiddleLeft, TextImageRelation = TextImageRelation.ImageBeforeText, AutoSize = true, Height = 36, MinimumSize = new Size(0, 36), Padding = new Padding(8, 0, 10, 0), FlatStyle = FlatStyle.Flat, BackColor = Tokens.Claro.CorAcaoSecundaria, ForeColor = texto, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo), Cursor = Cursors.Hand, Anchor = AnchorStyles.Top | AnchorStyles.Right };
        pesquisar.FlatAppearance.BorderSize = 0; pesquisar.Click += (_, _) => { var cl = FormPesquisarCliente.Escolher(this); if (cl != null) { _cliente = cl; Atualizar(); } };
        pesquisar.Resize += (_, _) => KitVisual.AplicarRaio(pesquisar, 10);
        cab.Controls.Add(linhaCab); cab.Controls.Add(pesquisar); pesquisar.BringToFront();
        void PosPesquisar()
        {
            pesquisar.Location = new Point(cab.ClientSize.Width - pesquisar.Width - 18, 17);
            // o botão fica à direita por cima da faixa: os campos encolhem para não passarem por baixo dele
            var livre = pesquisar.Left - 18 - 12 - bloco.Width - bloco.Margin.Horizontal;
            var bat = Math.Clamp(livre * 38 / 100, 160, 250);
            var doc = Math.Clamp(livre * 24 / 100, 120, 150);
            var cli = Math.Max(120, livre - bat - doc - blocoBat.Margin.Horizontal - blocoCli.Margin.Horizontal - blocoDoc.Margin.Horizontal);
            if (blocoBat.Width != bat) blocoBat.Width = bat;
            if (blocoCli.Width != cli) blocoCli.Width = cli;
            if (blocoDoc.Width != doc) blocoDoc.Width = doc;
        }
        cab.Padding = new Padding(18, 9, 18, 8);
        cab.Resize += (_, _) => PosPesquisar(); cab.Layout += (_, _) => PosPesquisar(); pesquisar.SizeChanged += (_, _) => PosPesquisar();
        cab.Paint += (_, e) => { using var pen = new Pen(Tokens.Claro.CorBordaSutil); e.Graphics.DrawLine(pen, 0, cab.Height - 1, cab.Width, cab.Height - 1); };
        Point? arrasto = null;
        foreach (var alvo in new Control[] { cab, linhaCab, bloco })
        {
            alvo.MouseDown += (_, e) => { if (e.Button == MouseButtons.Left) arrasto = Cursor.Position; };
            alvo.MouseMove += (_, e) => { if (arrasto is Point o && e.Button == MouseButtons.Left) { var agora = Cursor.Position; Location = new Point(Location.X + agora.X - o.X, Location.Y + agora.Y - o.Y); arrasto = agora; } };
            alvo.MouseUp += (_, _) => arrasto = null;
        }

        var conteudo = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 4, BackColor = fundo, Padding = new Padding(14, 10, 14, 14) };
        conteudo.RowStyles.Add(new RowStyle(SizeType.Absolute, 42)); conteudo.RowStyles.Add(new RowStyle(SizeType.Absolute, 52));
        conteudo.RowStyles.Add(new RowStyle(SizeType.Percent, 100)); conteudo.RowStyles.Add(new RowStyle(SizeType.Absolute, 222));
        var etapas = new Panel { Dock = DockStyle.Fill, BackColor = Tokens.Claro.CorEstadoSucessoFundo, Margin = new Padding(0, 0, 0, 6), Padding = new Padding(14, 0, 14, 0), AccessibleRole = AccessibleRole.StaticText, AccessibleName = "Etapas do checkout" };
        etapas.Resize += (_, _) => Arredondar(etapas, 9);
        Arredondar(etapas, 9);
        _etapaAtual.Text = "1 · Selecione uma reserva ou adicione um produto";
        etapas.Controls.Add(_etapaAtual);
        var obsCard = new Panel { Dock = DockStyle.Fill, BackColor = Tokens.Primitivo.Branco, Padding = new Padding(12, 3, 12, 3), Margin = new Padding(0, 0, 0, 10) };
        Arredondar(obsCard, 10);
        var obsTitulo = new Label { Text = "Observações", Dock = DockStyle.Left, Width = 98, ForeColor = secundario, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno, FontStyle.Bold), TextAlign = ContentAlignment.MiddleLeft };
        _obs.BorderStyle = BorderStyle.None; _obs.Multiline = false; _obs.PlaceholderText = "Opcional · aparece no fechamento de caixa"; _obs.Dock = DockStyle.Fill;
        obsCard.Controls.Add(_obs); obsCard.Controls.Add(obsTitulo);

        _gDisp.Colunas(new("reserva", "Reserva", Largura: 62, Valor: r => Fmt.Hm(r.S("dataHora")) is { Length: > 0 } h ? h : r.S("reserva")), new("cliente", "Cliente", Largura: 170), new("categoria", "Categoria", Largura: 90));
        _gCar.Colunas(new("cliente", "Cliente", Largura: 112), new("produto", "Produto", Largura: 130), new("qtd", "Qtd.", TipoCol.Inteiro, 42), new("desc", "Desc.", TipoCol.Dinheiro, 60), new("acr", "Acrés.", TipoCol.Dinheiro, 60), new("unit", "Preço", TipoCol.Dinheiro, 66), new("total", "Total", TipoCol.Dinheiro, 72));
        _gPag.Colunas(new("forma", "Método de pagamento", Largura: 180), new("valor", "Valor (R$)", TipoCol.Dinheiro, 100));
        foreach (var g in new[] { _gDisp, _gCar, _gPag })
        {
            KitVisual.EstilizarGrade(g); VisualPrincipal.AjustarColunas(g); g.RowTemplate.Height = 38;
            foreach (DataGridViewColumn c in g.Columns) c.MinimumWidth = Math.Max(c.MinimumWidth, TextRenderer.MeasureText(c.HeaderText, g.ColumnHeadersDefaultCellStyle.Font).Width + 16);
        }
        _gDisp.Columns["reserva"].DefaultCellStyle.Font = Tokens.FonteNumero(Tokens.Claro.FonteTamanhoPequeno, FontStyle.Bold);
        _gCar.Columns["total"].DefaultCellStyle.Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno, FontStyle.Bold);
        _gDisp.CellPainting += (_, e) =>
        {
            if (e.RowIndex < 0 || _gDisp.Columns[e.ColumnIndex].Name != "cliente" || e.RowIndex >= _gDisp.Rows.Count || _gDisp.Rows[e.RowIndex].Tag is not JsonObject r) return;
            VisualPrincipal.Fundo(e);
            var cor = (e.State & DataGridViewElementStates.Selected) != 0 ? KitVisual.Texto : KitVisual.Texto;
            TextRenderer.DrawText(e.Graphics, r.S("cliente"), Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno, FontStyle.Bold), new Rectangle(e.CellBounds.X + 4, e.CellBounds.Y + 3, e.CellBounds.Width - 8, 17), cor, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPadding);
            TextRenderer.DrawText(e.Graphics, r.S("produto"), Tokens.Fonte(Tokens.Claro.FonteTamanhoLegenda), new Rectangle(e.CellBounds.X + 4, e.CellBounds.Y + 20, e.CellBounds.Width - 8, 15), KitVisual.Secundario, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPadding);
            e.Handled = true;
        };
        _gPag.ColumnHeadersVisible = false;
        var meio = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 3, RowCount = 1, BackColor = fundo, Margin = new Padding(0, 0, 0, 10) };
        meio.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 40)); meio.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 110)); meio.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 60));
        meio.Controls.Add(Caixinha("1 · Selecionar reservas", "Use o cabeçalho", _gDisp, _gDisp.AlternarMarcacaoTodos), 0, 0);
        var setas = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, Padding = new Padding(6, 124, 4, 0) };
        Button BotaoFluxo(string caption, string descricao, Color back, Color front)
        {
            var b = new BotaoPlano { Text = caption, Width = 98, Height = 38, FlatStyle = FlatStyle.Flat, BackColor = back, ForeColor = front, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno, FontStyle.Bold), Cursor = Cursors.Hand, AccessibleRole = AccessibleRole.PushButton, AccessibleName = descricao, AccessibleDescription = descricao, Margin = new Padding(0, 0, 0, 6) };
            b.FlatAppearance.BorderSize = 0; b.Resize += (_, _) => KitVisual.AplicarRaio(b, 10); KitVisual.AplicarRaio(b, 10);
            return b;
        }
        var bAdd = BotaoFluxo("Adicionar selecionadas", "Adicionar somente as reservas marcadas ou selecionadas ao carrinho", Tokens.Claro.CorAcaoPrincipal, Tokens.Primitivo.Branco);
        _btnAdicionarSelecionadas = bAdd;
        var bBack = BotaoFluxo("Remover seleção", "Remover os itens selecionados do carrinho", Tokens.Primitivo.Branco, texto);
        var bClear = BotaoFluxo("Limpar carrinho", "Remover todos os itens do carrinho", Tokens.Primitivo.Branco, Tokens.Claro.CorEstadoPerigoTexto);
        foreach (var b in new[] { bBack, bClear }) b.Paint += (_, e) => { e.Graphics.SmoothingMode = SmoothingMode.AntiAlias; using var p = VisualPrincipal.Redondo(new Rectangle(0, 0, b.Width - 1, b.Height - 1), 14); using var pen = new Pen(Tokens.Claro.CorBordaSutil); e.Graphics.DrawPath(pen, p); };
        bAdd.Click += (_, _) => AdicionarSelecionadas(); bBack.Click += (_, _) => Remover(); bClear.Click += (_, _) => LimparCarrinho();
        _gDisp.Duplo += r => Adicionar([r]); setas.Controls.AddRange([bAdd, bBack, bClear]); meio.Controls.Add(setas, 1, 0);
        var carrinho = new Panel { Dock = DockStyle.Fill, BackColor = Tokens.Primitivo.Branco, Padding = new Padding(0) };
        Arredondar(carrinho, 14);
        var titCarrinho = new Panel { Dock = DockStyle.Top, Height = 44, Padding = new Padding(12, 5, 12, 3), BackColor = Tokens.Primitivo.Branco };
        titCarrinho.Controls.Add(new Label { Text = "Selecione um item para aplicar desconto ou acréscimo", Dock = DockStyle.Fill, ForeColor = secundario, TextAlign = ContentAlignment.MiddleRight, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno) });
        titCarrinho.Controls.Add(new Label { Text = "2 · Revisar carrinho", Dock = DockStyle.Left, Width = 150, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoSubtitulo, FontStyle.Bold), TextAlign = ContentAlignment.MiddleLeft });
        var barraCarrinho = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 92, WrapContents = true, Padding = new Padding(12, 8, 12, 4), FlowDirection = FlowDirection.LeftToRight, BackColor = Tokens.Claro.CorSuperficieSuave };
        Button Acao(string caption, Action action, int width)
        {
            var b = new BotaoPlano { Text = caption, AutoSize = true, MinimumSize = new Size(width, 34), Height = 34, Padding = new Padding(8, 0, 8, 0), FlatStyle = FlatStyle.Flat, BackColor = Tokens.Claro.CorAcaoSecundaria, ForeColor = texto, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo), Margin = new Padding(0, 0, 8, 6), Cursor = Cursors.Hand, AccessibleName = caption };
            b.FlatAppearance.BorderSize = 0; b.Click += (_, _) => action(); b.Resize += (_, _) => KitVisual.AplicarRaio(b, 9); return b;
        }
        barraCarrinho.Controls.Add(Acao("+ Adicionar produtos", AdicionarProduto, 120));
        barraCarrinho.Controls.Add(Acao("Aplicar desconto", () => Ajuste(true), 100));
        barraCarrinho.Controls.Add(Acao("Aplicar acréscimo", () => Ajuste(false), 100));
        var continuarPagamento = Acao("Continuar para pagamento", () => { _pagamentoAtivo = true; Atualizar(); _valor.Focus(); }, 150);
        _btnContinuarPagamento = continuarPagamento;
        continuarPagamento.BackColor = Tokens.Claro.CorAcaoPrincipal; continuarPagamento.ForeColor = Tokens.Primitivo.Branco; continuarPagamento.Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo, FontStyle.Bold);
        barraCarrinho.Controls.Add(continuarPagamento);
        barraCarrinho.SetFlowBreak(barraCarrinho.Controls[^1], true);
        _codVoucher.PlaceholderText = "Código do voucher"; _codVoucher.AccessibleName = "Código do voucher";
        _codVoucher.Font = Tokens.FonteNumero(Tokens.Claro.FonteTamanhoCorpo);
        var aplicarVoucher = new BotaoPlano { Text = "Aplicar", AutoSize = true, Dock = DockStyle.Right, FlatStyle = FlatStyle.Flat, BackColor = KitVisual.VerdeClaro, ForeColor = KitVisual.Verde, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno, FontStyle.Bold), Cursor = Cursors.Hand, AccessibleRole = AccessibleRole.PushButton, AccessibleName = "Aplicar voucher" };
        aplicarVoucher.FlatAppearance.BorderSize = 0; aplicarVoucher.Click += (_, _) => AplicarVoucher();
        var caixaVoucher = FormCliente.Caixa(_codVoucher, aplicarVoucher); caixaVoucher.Dock = DockStyle.None; caixaVoucher.Size = new Size(236, 34); caixaVoucher.Margin = new Padding(0, 0, 0, 0);
        barraCarrinho.Controls.Add(caixaVoucher);
        barraCarrinho.Resize += (_, _) => caixaVoucher.Margin = new Padding(Math.Max(0, barraCarrinho.ClientSize.Width - 24 - caixaVoucher.Width), 0, 0, 0);
        // altura acompanha as linhas: com o caixa estreito os botões quebram em 2 linhas e o campo do voucher ia para uma 3ª,
        // fora da barra (só a ponta do "Aplicar" aparecia, solta no meio da tela)
        barraCarrinho.Layout += (_, _) =>
        {
            var fundoBarra = barraCarrinho.Controls.Cast<Control>().Where(c => c.Visible).Select(c => c.Bottom + c.Margin.Bottom).DefaultIfEmpty(0).Max() + barraCarrinho.Padding.Bottom;
            var altura = Math.Max(92, fundoBarra);
            if (barraCarrinho.Height != altura) barraCarrinho.Height = altura;
        };
        var gradeCarrinho = new Panel { Dock = DockStyle.Fill, Padding = new Padding(0, 0, 0, 0), BackColor = Tokens.Primitivo.Branco }; gradeCarrinho.Controls.Add(_gCar);
        carrinho.Controls.Add(gradeCarrinho); carrinho.Controls.Add(barraCarrinho); carrinho.Controls.Add(titCarrinho); meio.Controls.Add(carrinho, 2, 0);

        var pagamentos = _pagamentos = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1, BackColor = fundo, AccessibleRole = AccessibleRole.Grouping, AccessibleName = "Etapa 3: receber e concluir" };
        pagamentos.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 64)); pagamentos.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 36));
        var formasCard = _formasCard = new Panel { Dock = DockStyle.Fill, BackColor = Tokens.Primitivo.Branco, Padding = new Padding(12), Margin = new Padding(0, 0, 8, 0) };
        var pagamentosCard = _pagamentosCard = new Panel { Dock = DockStyle.Fill, BackColor = Tokens.Primitivo.Branco, Padding = new Padding(12), Margin = new Padding(8, 0, 0, 0) };
        Arredondar(formasCard, 14); Arredondar(pagamentosCard, 14);
        var tituloFormas = new Label { Text = "3 · Receber e concluir · Forma de pagamento", Dock = DockStyle.Top, Height = 28, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoSubtitulo, FontStyle.Bold), ForeColor = texto };
        var formas = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 70, WrapContents = false, AutoScroll = true, Padding = new Padding(0, 3, 0, 0), FlowDirection = FlowDirection.LeftToRight };
        var paymentItems = _forma.Items.OfType<Campos.Item>().ToArray();
        foreach (var method in paymentItems)
        {
            var type = method.Dados?.S("tipo") ?? "outro";
            var chave = type is "dinheiro" or "credito" or "debito" or "pix" or "voucher" ? "pg-" + type : "pg-outro";
            var nomeForma = System.Globalization.CultureInfo.GetCultureInfo("pt-BR").TextInfo.ToTitleCase(method.Texto.ToLowerInvariant());
            var button = new BotaoPlano { Text = nomeForma, Image = new Bitmap(VisualPrincipal.Icone(chave), 20, 20), TextImageRelation = TextImageRelation.ImageAboveText, ImageAlign = ContentAlignment.BottomCenter, TextAlign = ContentAlignment.TopCenter, AutoSize = false, Size = new Size(98, 58), Margin = new Padding(0, 0, 8, 8), Padding = new Padding(0, 6, 0, 4), FlatStyle = FlatStyle.Flat, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno, FontStyle.Bold), Cursor = Cursors.Hand, Tag = (method, chave), AccessibleName = method.Texto, AccessibleDescription = "kit:ignorar" };
            button.Resize += (_, _) => KitVisual.AplicarRaio(button, 10);
            button.FlatAppearance.BorderSize = 0;
            button.Click += (_, _) => { _forma.SelectedItem = method; MarcarForma(formas); };
            button.Paint += (_, e) =>
            {
                if (button.BackColor == Tokens.Claro.CorAcaoPrincipal) return;
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using var p = VisualPrincipal.Redondo(new Rectangle(0, 0, button.Width - 1, button.Height - 1), 10); using var pen = new Pen(Tokens.Claro.CorBordaSutil); e.Graphics.DrawPath(pen, p);
            };
            formas.Controls.Add(button);
        }
        if (_forma.SelectedIndex >= 0) MarcarForma(formas);
        // todas as formas cabem numa linha, como no design
        formas.Resize += (_, _) =>
        {
            var bs = formas.Controls.OfType<Button>().ToList(); if (bs.Count == 0) return;
            var w = Math.Max(72, (formas.ClientSize.Width - 8 * bs.Count - 2) / bs.Count);
            // uma letra só para todas (antes "Aniversariante" saía menor que as outras)
            var tam = 9F;
            while (tam > 7.5F && bs.Any(b => TextRenderer.MeasureText(b.Text, new Font("Segoe UI", tam, FontStyle.Bold)).Width > w - 8)) tam -= 0.5F;
            foreach (var b in bs) { b.Width = w; b.Font = new Font("Segoe UI", tam, FontStyle.Bold); }
        };
        formas.AutoScroll = false;
        var linhaValor = new FlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false, Padding = new Padding(0, 5, 0, 0), FlowDirection = FlowDirection.LeftToRight };
        var recebido = new Panel { Width = 330, Height = 42, Padding = new Padding(12, 9, 12, 4), BackColor = Tokens.Primitivo.Branco, Margin = new Padding(0, 0, 8, 0) };
        recebido.Paint += (_, e) => { e.Graphics.SmoothingMode = SmoothingMode.AntiAlias; using var p = VisualPrincipal.Redondo(new Rectangle(1, 1, recebido.Width - 3, recebido.Height - 3), 10); using var pen = new Pen(Tokens.Claro.CorTextoPrincipal, 1.6F); e.Graphics.DrawPath(pen, p); };
        var recebidoLabel = new Label { Text = "Valor recebido", Dock = DockStyle.Left, Width = 104, ForeColor = secundario, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno), TextAlign = ContentAlignment.MiddleLeft };
        _valor.Width = 140; _valor.BorderStyle = BorderStyle.None; _valor.TextAlign = HorizontalAlignment.Right; _valor.Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoTitulo, FontStyle.Bold);
        _valor.Dock = DockStyle.Fill; _valor.PlaceholderText = "0,00";
        recebido.Controls.Add(_valor); recebido.Controls.Add(recebidoLabel); _valor.BringToFront();
        var bPagamento = AcaoPagamento("Adicionar", AdicionarPagamento, true);
        var bRemoverPagamento = AcaoPagamento("Remover", () => { foreach (var r in _gPag.Selecionados) _pags.RemoveAt(r.I("i")); Atualizar(); }, false);
        linhaValor.Controls.AddRange([recebido, bPagamento, bRemoverPagamento]);
        formasCard.Controls.Add(linhaValor); formasCard.Controls.Add(formas); formasCard.Controls.Add(tituloFormas);
        var tituloPagamentos = new Label { Text = "Pagamentos lançados", Dock = DockStyle.Top, Height = 28, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoSubtitulo, FontStyle.Bold), ForeColor = texto };
        var pagamentosGrid = new Panel { Dock = DockStyle.Fill, BackColor = Tokens.Primitivo.Branco }; pagamentosGrid.Controls.Add(_gPag);
        _falta.Dock = DockStyle.Bottom; _falta.Height = 22; _falta.TextAlign = ContentAlignment.MiddleLeft;
        pagamentosCard.Controls.Add(pagamentosGrid); pagamentosCard.Controls.Add(_falta); pagamentosCard.Controls.Add(tituloPagamentos);
        pagamentos.Controls.Add(formasCard, 0, 0); pagamentos.Controls.Add(pagamentosCard, 1, 0);
        var pagamentoArea = new Panel { Dock = DockStyle.Fill, BackColor = fundo };
        pagamentoArea.Controls.Add(pagamentos);
        var bloqueioPagamento = _bloqueioPagamento = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = Tokens.Claro.CorSuperficieSuave,
            Padding = new Padding(24),
            AccessibleRole = AccessibleRole.StaticText,
            AccessibleName = "Pagamento bloqueado"
        };
        Arredondar(bloqueioPagamento, 14);
        _avisoPagamento = new Label
        {
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleCenter,
            Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo, FontStyle.Bold),
            ForeColor = Tokens.Claro.CorTextoSecundario,
            Text = "3 · Receber e concluir\r\n\r\nAdicione uma reserva ou produto\r\npara liberar o recebimento."
        };
        bloqueioPagamento.Controls.Add(_avisoPagamento);
        pagamentoArea.Controls.Add(bloqueioPagamento);
        bloqueioPagamento.BringToFront();

        conteudo.Controls.Add(etapas, 0, 0); conteudo.Controls.Add(obsCard, 0, 1); conteudo.Controls.Add(meio, 0, 2); conteudo.Controls.Add(pagamentoArea, 0, 3);
        _forma.Visible = false; _forma.SetBounds(-10, -10, 1, 1); principal.Controls.Add(_forma);
        principal.Controls.Add(conteudo); principal.Controls.Add(cab); Controls.Add(principal); Controls.Add(resumo);
        foreach (var old in oldRoots) old.Dispose();

        Button AcaoPagamento(string caption, Action action, bool principal)
        {
            var b = new BotaoPlano { Text = caption, AutoSize = true, Height = 42, MinimumSize = new Size(88, 42), FlatStyle = FlatStyle.Flat, BackColor = principal ? Tokens.Claro.CorAcaoPrincipal : Tokens.Claro.CorAcaoSecundaria, ForeColor = principal ? Tokens.Primitivo.Branco : texto, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo, principal ? FontStyle.Bold : FontStyle.Regular), Margin = new Padding(0, 0, 8, 0), Cursor = Cursors.Hand, AccessibleRole = AccessibleRole.PushButton, AccessibleName = caption };
            b.FlatAppearance.BorderSize = 0; b.Click += (_, _) => action(); b.Resize += (_, _) => KitVisual.AplicarRaio(b, 10); return b;
        }
    }

    static Bitmap LupaBmp()
    {
        var bmp = new Bitmap(16, 16);
        using var g = Graphics.FromImage(bmp);
        TextRenderer.DrawText(g, "\uE721", new Font("Segoe MDL2 Assets", 9F), new Rectangle(0, 0, 16, 16), Tokens.Claro.CorTextoPrincipal, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
        return bmp;
    }

    static Panel InfoCheckout(string titulo, Control valor, int largura)
    {
        var p = new Panel { Width = largura, Height = 44, BackColor = Tokens.Primitivo.Branco, Padding = new Padding(11, 4, 8, 3), Margin = new Padding(4, 4, 4, 0) };
        p.Paint += (_, e) => { e.Graphics.SmoothingMode = SmoothingMode.AntiAlias; using var path = VisualPrincipal.Redondo(new Rectangle(0, 0, p.Width - 1, p.Height - 1), 9); using var pen = new Pen(Tokens.Claro.CorBordaSutil); e.Graphics.DrawPath(pen, path); };
        Arredondar(p, 9);
        p.Resize += (_, _) => p.Invalidate();
        p.Controls.Add(valor); p.Controls.Add(new Label { Text = titulo, Dock = DockStyle.Top, Height = 16, ForeColor = Tokens.Claro.CorTextoSecundario, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoLegenda, FontStyle.Bold) });
        if (valor is ComboBox cb) { cb.Dock = DockStyle.Fill; cb.Margin = new Padding(0); cb.FlatStyle = FlatStyle.Flat; }
        if (valor is Label l) { l.Dock = DockStyle.Fill; l.AutoSize = false; l.TextAlign = ContentAlignment.MiddleLeft; l.Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno, FontStyle.Bold); l.ForeColor = Tokens.Claro.CorTextoPrincipal; l.AutoEllipsis = true; }
        return p;
    }

    void MarcarForma(FlowLayoutPanel host)
    {
        foreach (var b in host.Controls.OfType<Button>())
        {
            var selecionado = b.Tag is (Campos.Item it, string chaveIco) && _forma.SelectedItem is Campos.Item atual && atual.Id == it.Id;
            if (b.Tag is (Campos.Item, string k)) b.Image = new Bitmap(VisualPrincipal.Icone(selecionado ? k + "-b" : k), 20, 20);
            b.BackColor = selecionado ? Tokens.Claro.CorAcaoPrincipal : Tokens.Claro.CorFundoApp;
            b.ForeColor = selecionado ? Tokens.Primitivo.Branco : Tokens.Claro.CorTextoPrincipal;
        }
    }

    static Panel Caixinha(string titulo, string subtitulo, Control c, Action selecionarTodas = null)
    {
        var p = new Panel { Dock = DockStyle.Fill, BackColor = Tokens.Primitivo.Branco, Padding = new Padding(0) };
        Arredondar(p, 14);
        var header = new Panel { Dock = DockStyle.Top, Height = 42, Padding = new Padding(14, 4, 14, 2), BackColor = Tokens.Primitivo.Branco };
        var dica = new Label { Text = subtitulo, Dock = DockStyle.Right, AutoSize = false, Width = selecionarTodas == null ? 92 : 100, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoLegenda), ForeColor = Tokens.Claro.CorTextoSecundario, TextAlign = ContentAlignment.MiddleRight, AutoEllipsis = true };
        var tit = new Label { Text = titulo, Dock = DockStyle.Fill, AutoSize = false, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoSubtitulo, FontStyle.Bold), ForeColor = Tokens.Claro.CorTextoPrincipal, TextAlign = ContentAlignment.MiddleLeft, AutoEllipsis = true };
        new ToolTip().SetToolTip(dica, "Clique na caixa do cabeçalho para selecionar todas as linhas visíveis.");
        if (selecionarTodas != null)
        {
            var todas = new BotaoPlano { Text = "Selecionar todas", Dock = DockStyle.Right, Width = 118, Height = 30, FlatStyle = FlatStyle.Flat, BackColor = Tokens.Claro.CorEstadoSucessoFundo, ForeColor = Tokens.Claro.CorAcaoPrincipalPressionado, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoLegenda, FontStyle.Bold), Cursor = Cursors.Hand, AccessibleName = "Selecionar todas as reservas visíveis" };
            todas.FlatAppearance.BorderSize = 0;
            todas.Click += (_, _) => selecionarTodas();
            new ToolTip().SetToolTip(todas, "Marca ou desmarca todas as reservas visíveis, inclusive a primeira linha.");
            header.Controls.Add(todas);
        }
        header.Controls.Add(dica);
        header.Controls.Add(tit);
        var box = new Panel { Dock = DockStyle.Fill, Padding = new Padding(6, 0, 6, 6), BackColor = Tokens.Primitivo.Branco }; box.Controls.Add(c);
        p.Controls.Add(box); p.Controls.Add(header); return p;
    }

    /// <summary>Contorno arredondado do design (peça única em <see cref="Forma.ArredondarComContorno"/>).</summary>
    static void Arredondar(Panel painel, int raio) => Forma.ArredondarComContorno(painel, raio);

    static Label Lbl(string t) => new() { Text = t, AutoSize = true, Margin = new Padding(3, 7, 3, 3) };
    static Panel Caixinha(string titulo, Control c, ContentAlignment al)
    {
        var p = new Panel { Dock = DockStyle.Fill };
        var borda = new Panel { Dock = DockStyle.Fill, BorderStyle = BorderStyle.FixedSingle }; borda.Controls.Add(c);
        p.Controls.Add(borda); p.Controls.Add(new Label { Text = titulo, Dock = DockStyle.Top, Height = 20, Font = Tema.Negrito, TextAlign = al });
        return p;
    }

    void CarregarDisponiveis() => Seguro.Rodar(this, CarregarDisponiveisAsync);
    async Task CarregarDisponiveisAsync()
    {
        var id = Campos.IdDe(_bat);
        _disp = id is long b && b > 0 ? (await Api.Lista($"/api/office/reservas?status=todas&bateriaId={b}")).Where(r => !r.B("pago") && r.S("status") != "cancelada").ToList() : [];
        Atualizar();
    }

    void Adicionar(List<JsonObject> rs)
    {
        foreach (var r in rs)
            if (!_car.Any(c => c.InscricaoId == r.L("id")))
                _car.Add(new ItemCarrinho { K = _seq++, InscricaoId = r.L("id"), ProdutoId = r.L("produtoId"), Cliente = r.S("cliente"), Produto = r.S("produto"), Unit = r.L("preco") ?? 0, Desc = r.L("desconto") ?? 0 });
        if (_cliente == null && rs.Count > 0) Seguro.Rodar(this, async () => { _cliente = (await Api.Get($"/api/office/clientes/{rs[0].S("clienteId")}")).AsObject(); Atualizar(); });
        Atualizar();
    }

    void AdicionarSelecionadas()
    {
        var marcados = _gDisp.Marcados;
        var selecionadas = marcados.Count > 0 ? marcados : _gDisp.Selecionados;
        if (selecionadas.Count == 0)
        {
            Msg.Aviso(this, "Marque uma ou mais reservas. A caixa no cabeçalho seleciona todas as linhas visíveis.");
            return;
        }
        Adicionar(selecionadas);
    }

    void Remover()
    {
        foreach (var s in _gCar.Selecionados) _car.RemoveAll(c => c.K == s.L("k"));
        if (!_car.Any(c => c.Voucher)) _voucher = null;
        Atualizar();
    }

    (long tot, long des, long acr, long sub, long rec, long troco, long falta) Totais()
    {
        var tot = _car.Sum(i => i.Unit * i.Qtd); var des = _car.Sum(i => i.Desc); var acr = _car.Sum(i => i.Acr);
        var sub = tot - des + acr; var rec = _pags.Sum(p => p.valor);
        return (tot, des, acr, sub, rec, Math.Max(0, rec - sub), Math.Max(0, sub - rec));
    }

    void Atualizar()
    {
        var temBateria = Campos.IdDe(_bat) is long b && b > 0;
        _gDisp.Vazio = temBateria ? "Nenhuma reserva disponível nesta bateria." : "Selecione uma bateria para carregar as reservas.";
        _gCar.Vazio = "Selecione uma reserva ou adicione um produto.";
        _gPag.Vazio = "Adicione um pagamento para concluir.";
        _gDisp.Carregar(_disp.Where(r => !_car.Any(c => c.InscricaoId == r.L("id"))));
        _gCar.Carregar(_car.Select(c => new JsonObject { ["id"] = c.K, ["k"] = c.K, ["cliente"] = c.Cliente, ["produto"] = c.Produto, ["qtd"] = c.Qtd, ["unit"] = c.Unit, ["descPct"] = c.DescPct.ToString("0.##"), ["desc"] = c.Desc, ["acrPct"] = c.AcrPct.ToString("0.##"), ["acr"] = c.Acr, ["total"] = c.Unit * c.Qtd - c.Desc + c.Acr }));
        _gPag.Carregar(_pags.Select((p, i) => new JsonObject { ["id"] = i, ["i"] = i, ["forma"] = p.nome, ["valor"] = p.valor }));
        var t = Totais();
        _tot["tot"].Text = Fmt.Brl(t.tot); _tot["des"].Text = Fmt.Brl(t.des); _tot["acr"].Text = Fmt.Brl(t.acr);
        // desconto/acréscimo zerados ficam neutros: vermelho só quando há valor
        foreach (var (k, v) in new[] { ("des", t.des), ("acr", t.acr) })
            _tot[k].ForeColor = v != 0 ? Color.FromArgb(255, 105, 97) : Color.FromArgb(174, 174, 178);
        _tot["sub"].Text = Fmt.Brl(t.sub); _tot["rec"].Text = Fmt.Brl(t.rec); _tot["tro"].Text = Fmt.Brl(t.troco);
        _falta.Text = _car.Count == 0 ? "Adicione itens para começar" : t.falta > 0 ? $"Falta lançar {Fmt.Brl(t.falta)}" : "Pagamento completo";
        _valor.Text = t.falta > 0 ? Fmt.Dinheiro(t.falta) : "";
        if (_car.Count == 0) _pagamentoAtivo = false;
        var pagamentoLiberado = _car.Count > 0 && _pagamentoAtivo;
        _etapaAtual.Text = _car.Count == 0
            ? "1 · Selecione uma reserva ou adicione um produto"
            : !pagamentoLiberado
                ? "2 · Revise o carrinho e continue para pagamento"
                : t.falta > 0
                ? "3 · Receber e concluir · lance o valor recebido"
                : "3 · Receber e concluir · pagamento completo";
        if (_formasCard != null) { _formasCard.Enabled = pagamentoLiberado; _formasCard.Visible = pagamentoLiberado; }
        if (_pagamentosCard != null) { _pagamentosCard.Enabled = pagamentoLiberado; _pagamentosCard.Visible = pagamentoLiberado; }
        if (_bloqueioPagamento != null)
        {
            _bloqueioPagamento.Visible = !pagamentoLiberado;
            _avisoPagamento.Text = _car.Count == 0
                ? "3 · Receber e concluir\r\n\r\nAdicione uma reserva ou produto\r\npara liberar o recebimento."
                : "3 · Receber e concluir\r\n\r\nRevise o carrinho e clique em\r\n‘Continuar para pagamento’.";
        }
        if (_btnConcluir != null)
        {
            _btnConcluir.Enabled = pagamentoLiberado && (!Sessao.ParamSim("office.validarTotalPago", true) || t.falta <= 0);
            _btnConcluir.AccessibleDescription = _btnConcluir.Enabled ? "Finaliza a cobrança e registra o pagamento." : "Adicione itens e lance o valor total antes de concluir.";
        }
        if (_btnAdicionarSelecionadas != null) _btnAdicionarSelecionadas.Enabled = _gDisp.Rows.Count > 0;
        if (_btnContinuarPagamento != null) _btnContinuarPagamento.Enabled = _car.Count > 0;
        _cli.Text = _cliente?.S("nome") ?? ""; _doc.Text = _cliente?.S("documento") ?? "";
    }

    void LimparCarrinho()
    {
        if (_car.Count == 0) return;
        if (!Msg.Pergunta(this, "Remover todos os itens e pagamentos do carrinho?")) return;
        _car.Clear(); _pags.Clear(); _voucher = null; _codVoucher.Clear(); _pagamentoAtivo = false; Atualizar();
    }

    void AdicionarPagamento()
    {
        if (!_pagamentoAtivo || _car.Count == 0) { Msg.Aviso(this, "Adicione itens e avance para a etapa de pagamento."); return; }
        if (Fmt.Centavos(_valor.Text) is not long v || v <= 0) { Msg.Aviso(this, "Informe o valor."); return; }
        if (_forma.SelectedItem is not Campos.Item f) return;
        _pags.Add((f.Id, f.Texto, v));
        Atualizar();
    }

    void AdicionarProduto()
    {
        // visual padrão (DialogoDesign: ícone, seção arredondada, campos com rótulo, botão principal à direita)
        using var j = new DialogoDesign("Adicionar produtos ao carrinho", "Escolha o produto, a quantidade e confira o preço", "produtos", 680, 330);
        var p = Campos.Combo(); p.Items.AddRange(Sessao.Produtos()); if (p.Items.Count > 0) p.SelectedIndex = 0;
        var q = Campos.Num(1, 1, 999); var v = new TextBox { BorderStyle = BorderStyle.None };
        void Preco() { if (p.SelectedItem is Campos.Item it) v.Text = Fmt.Dinheiro(it.Dados.L("preco")); }
        p.SelectedIndexChanged += (_, _) => Preco(); Preco();
        var g = j.Secao(null); j.Campo(g, "Produto", p, 4); j.Campo(g, "Quantidade", q, 1); j.Campo(g, "Preço", v, 1);
        j.AcceptButton = j.BotaoRodape("Adicionar", true, () =>
        {
            if (p.SelectedItem is not Campos.Item it || Fmt.Centavos(v.Text) is not long preco) { Msg.Aviso(j, "Produto ou preço inválido."); return; }
            if (Sessao.ParamSim("office.bloquearProdutosRepetidos", false) && _car.Any(c => c.InscricaoId == null && c.ProdutoId == it.Id)) { Msg.Aviso(j, "Produto já está no carrinho."); return; }
            _car.Add(new ItemCarrinho { K = _seq++, ProdutoId = it.Id, Produto = it.Dados.S("nome"), Cliente = _cliente?.S("nome") ?? "", Qtd = (int)q.Value, Unit = preco });
            j.Close(); Atualizar();
        });
        j.BotaoRodape("Cancelar", false, j.Close);
        j.ShowDialog(this);
    }

    void Ajuste(bool desconto)
    {
        var sel = _gCar.Selecionados.Select(s => s.L("k")).ToHashSet();
        var alvo = sel.Count > 0 ? _car.Where(c => sel.Contains(c.K)).ToList() : _car;
        if (alvo.Count == 0) { Msg.Aviso(this, "Carrinho vazio."); return; }
        var t = Prompt.Pedir(this, $"{(desconto ? "Desconto" : "Acréscimo")} para {(alvo.Count == _car.Count ? "todos os itens" : "os itens selecionados")} (ex.: 10% ou 15,00):", "", desconto ? "Aplicar Desconto" : "Aplicar Acréscimo");
        if (string.IsNullOrWhiteSpace(t)) return;
        var pct = t.Contains('%');
        decimal n;
        if (pct) { if (!decimal.TryParse(t.Replace("%", "").Trim(), System.Globalization.NumberStyles.Number, Fmt.Br, out n)) { Msg.Aviso(this, "Valor inválido."); return; } }
        else { if (Fmt.Centavos(t) is not long c) { Msg.Aviso(this, "Valor inválido."); return; } n = c; }
        foreach (var i in alvo)
        {
            if (desconto && i.Voucher) { Msg.Aviso(this, "Este item já possui desconto aplicado pelo voucher e não pode receber outro desconto."); continue; }
            var baseV = i.Unit * i.Qtd;
            var v = pct ? (long)Math.Round(baseV * n / 100) : (long)Math.Round(n / alvo.Count);
            if (desconto) { i.Desc = Math.Min(baseV, v); i.DescPct = baseV > 0 ? Math.Round(i.Desc * 100m / baseV, 2) : 0; }
            else { i.Acr = v; i.AcrPct = baseV > 0 ? Math.Round(v * 100m / baseV, 2) : 0; }
        }
        Atualizar();
    }

    void AplicarVoucher() => Seguro.Rodar(this, async () =>
    {
        var cod = _codVoucher.Text.Trim();
        if (cod.Length == 0) { Msg.Aviso(this, "Informe o codigo do voucher."); return; }
        if (_voucher != null) { Msg.Aviso(this, "Já existe um voucher aplicado nesta venda. Remova-o primeiro."); return; }
        var v = await Api.Get("/api/office/vouchers/validar?codigo=" + Uri.EscapeDataString(cod));
        var alvo = _car.FirstOrDefault(c => (v.L("produtoId") == null || c.ProdutoId == v.L("produtoId")) && c.Desc == 0);
        if (alvo == null) { Msg.Aviso(this, v.L("produtoId") != null ? "O produto do voucher não está na venda." : "Nenhum produto na venda para aplicar o voucher."); return; }
        if (v.L("pedidoMinimo") is long min && Totais().sub < min) { Msg.Aviso(this, $"Valor do pedido insuficiente. Mínimo exigido: {Fmt.Brl(min)}."); return; }
        var baseV = alvo.Unit * alvo.Qtd;
        var d = v.S("tipo") == "percentual" ? (long)Math.Round(baseV * (v.L("valor") ?? 0) / 100m) : v.L("valor") ?? 0;
        if (v.L("descontoMaximo") is long max) d = Math.Min(d, max);
        alvo.Desc = Math.Min(baseV, d); alvo.Voucher = true; alvo.DescPct = baseV > 0 ? Math.Round(alvo.Desc * 100m / baseV, 2) : 0;
        _voucher = v.S("codigo");
        Atualizar();
        Msg.Info(this, $"Voucher aplicado! Desconto de {Fmt.Brl(alvo.Desc)} em {alvo.Produto}.");
    });

    void Aprovar() => Seguro.Rodar(this, async () =>
    {
        if (_car.Count == 0) { Msg.Aviso(this, "Carrinho vazio."); return; }
        if (!_pagamentoAtivo) { Msg.Aviso(this, "Revise o carrinho e clique em ‘Continuar para pagamento’ antes de concluir."); return; }
        var t = Totais();
        if (_pags.Count == 0 && t.sub > 0 && _forma.SelectedItem is Campos.Item f) { _pags.Add((f.Id, f.Texto, Fmt.Centavos(_valor.Text) is long vv && vv > 0 ? vv : t.sub)); Atualizar(); t = Totais(); }
        if (t.falta > 0 && Sessao.ParamSim("office.validarTotalPago", true)) { Msg.Aviso(this, $"Ainda faltam ser pagos {Fmt.Brl(t.falta)} para poder concluir a compra."); return; }
        var itens = new JsonArray();
        foreach (var c in _car) itens.Add(new JsonObject { ["inscricaoId"] = c.InscricaoId, ["produtoId"] = c.ProdutoId, ["quantidade"] = c.Qtd, ["unitarioCentavos"] = c.Unit, ["descontoCentavos"] = c.Voucher ? 0 : c.Desc, ["acrescimoCentavos"] = c.Acr });
        var pags = new JsonArray();
        foreach (var p in _pags) pags.Add(new JsonObject { ["formaPagamentoId"] = p.forma, ["valorCentavos"] = p.valor });
        var r = await Api.Post("/api/office/vendas", new JsonObject { ["clienteId"] = _cliente?.L("id"), ["observacao"] = _obs.Text, ["voucherCodigo"] = _voucher, ["itens"] = itens, ["pagamentos"] = pags });
        Concluido = true;
        Msg.Sucesso(this, $"Venda nº {r.S("id")} aprovada." + (r.L("troco") is long tr && tr > 0 ? $"\nTroco: {Fmt.Brl(tr)}" : ""));
        var inscr = r["inscricoes"] is JsonArray a ? a.Select(x => x?.ToString()).Where(x => x != null).ToList() : [];
        Close();
        if (Sessao.ParamSim("office.imprimirTicketAposVenda", false)) Relatorio.Abrir(Owner, Api.UrlComToken("/relatorio/venda?id=" + r.S("id")), "Comprovante");
        if (inscr.Count > 0 && (Sessao.ParamSim("office.gerarTermoAposPagamento", false) || (Sessao.ParamSim("office.perguntarImprimirTermo", true) && Msg.Pergunta(Owner, "Deseja imprimir o Termo de Responsabilidade?", "Pergunta!"))))
            Acoes.ImprimirTermo(Owner, inscr);
    });
}

/// <summary>Visualizar métodos de pagamento da venda (MetodosPagamento.dc.html): itens, pagamentos e totais.</summary>
public class FormVenda : DialogoDesign
{
    public FormVenda(long id) : base("Visualizar métodos de pagamento", "Carregando a venda…", "M2 5h20v14H2zM2 10h20M6 15h4", "linear-gradient(180deg, #5EDB7A, #1E9E4A)")
    {
        var itens = SecaoTabelaDesign("Itens");
        itens.Colunas(new("Item", 60), new("Descrição", 330), new("Qtde", 60, Direita: true), new("Unitário", 90, Direita: true), new("Desconto", 90, Direita: true), new("Líquido", 100, Direita: true), new("Estornado", 80, Marca: true));
        itens.MaxLinhas = 6;
        var pags = SecaoTabelaDesign("Pagamentos");
        pags.Colunas(new("Método de pagamento", 600), new("Valor (R$)", 140, Direita: true));
        pags.MaxLinhas = 4;
        var totais = new Label { AutoSize = true, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo), ForeColor = Tokens.Primitivo.Cinza700 };
        var gNota = Secao(null);
        var nota = (TableLayoutPanel)gNota.Parent;
        nota.BackColor = Fundo; gNota.BackColor = Fundo;
        totais.BackColor = Fundo; totais.Margin = new Padding(0, 2, 0, 2);
        gNota.Controls.Add(totais); gNota.SetColumnSpan(totais, 6);

        BotaoRodape("Fechar", true, Close);
        BotaoRodape("Imprimir comprovante", false, () => Relatorio.Abrir(this, Sessao.Api.UrlComToken("/relatorio/venda?id=" + id), "Comprovante"));

        Load += (_, _) => Seguro.Rodar(this, async () =>
        {
            var v = await Sessao.Api.Get($"/api/office/vendas/{id}");
            Subtitulo.Text = $"Venda {v.S("codigo")} · {v.S("cliente")} · {Fmt.DmyHm(v.S("dataHora"))} · {v.S("usuario")} · {v.S("terminal")}";
            var lista = ((JsonArray)v["itens"]).OfType<JsonObject>().ToList();
            itens.Linhas(lista.Select((i, n) => new[] { i.S("item") is { Length: > 0 } it ? it : (n + 1).ToString(), i.S("descricao"), i.S("quantidade"), Fmt.Dinheiro(i.L("unitario")), Fmt.Dinheiro(i.L("desconto")), Fmt.Dinheiro(i.L("liquido")), i.B("estornado") ? "1" : "0" }));
            pags.Linhas(((JsonArray)v["pagamentos"]).OfType<JsonObject>().Select(p => new[] { p.S("forma"), Fmt.Dinheiro(p.L("valor")) }));
            var voucher = v.S("voucher") is { Length: > 0 } cod ? $" (voucher {cod})" : "";
            totais.Text = $"Total {Fmt.Brl(v.L("bruto"))} · Desconto {Fmt.Brl(v.L("desconto"))}{voucher} · Recebido {Fmt.Brl(v.L("recebido"))} · Troco {Fmt.Brl(v.L("troco"))} · Estornos {Fmt.Brl(v.L("estorno"))}";
        });
    }
}

/// <summary>Estornar pagamento (Estorno.dc.html): resumo, itens a estornar (marca) e o motivo obrigatório.</summary>
public class FormEstorno : DialogoDesign
{
    public FormEstorno(long id) : base("Estornar pagamento", "Carregando a venda…", "M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4", "linear-gradient(180deg, #FF7A6B, #E0342A)")
    {
        var recebido = FormCaixaTransacao.Leitura("—"); var desconto = FormCaixaTransacao.Leitura("—"); var troco = FormCaixaTransacao.Leitura("—");
        var g = Secao("Resumo");
        Campo(g, "Total recebido", recebido, 2);
        Campo(g, "Descontos", desconto, 2);
        Campo(g, "Troco", troco, 2);
        var tabela = SecaoTabelaDesign("Marque os itens a estornar");
        tabela.Colunas(new("", 40, Marca: true), new("Item", 600), new("Qtde", 70, Direita: true), new("Total líquido", 130, Direita: true));
        tabela.MarcasEditaveis = true; tabela.MaxLinhas = 6;
        var motivo = PecasDesign.Texto("", 400);
        var gm = Secao("Motivo (obrigatório)");
        Campo(gm, "Motivo do estorno", motivo, 6);
        List<JsonObject> itens = [];

        Button estornar = null;
        List<JsonObject> Marcados() => itens.Where((_, i) => i < tabela.Dados.Count && tabela.Dados[i][0] == "1").ToList();
        void Atualizar()
        {
            var soma = Marcados().Sum(i => i.L("liquido") ?? 0);
            estornar.Text = soma > 0 ? $"Estornar {Fmt.Brl(soma)}" : "Estornar";
        }
        estornar = BotaoRodape("Estornar", true, () => Seguro.Rodar(this, async () =>
        {
            var sel = Marcados();
            if (sel.Count == 0) { Msg.Aviso(this, "Marque os itens a estornar."); return; }
            if (string.IsNullOrWhiteSpace(motivo.Text)) { Msg.Aviso(this, "Informe o motivo do estorno."); motivo.Focus(); return; }
            if (!Msg.Pergunta(this, $"Estornar {Fmt.Brl(sel.Sum(i => i.L("liquido") ?? 0))} dos itens marcados?")) return;
            var r = await Sessao.Api.Post($"/api/office/vendas/{id}/estorno", new { itemIds = sel.Select(i => i.L("id")).ToArray(), motivo = motivo.Text.Trim() });
            Msg.Info(this, $"Estorno de {Fmt.Brl(r.L("estornado"))} registrado. Devolva o valor ao cliente pela mesma forma de pagamento.");
            DialogResult = DialogResult.OK; Close();
        }));
        BotaoRodape("Cancelar", false, Close);
        TextoRodape("Devolva o valor pela mesma forma de pagamento.");
        tabela.MarcaMudou += (_, _) => Atualizar();

        Load += (_, _) => Seguro.Rodar(this, async () =>
        {
            var v = await Sessao.Api.Get($"/api/office/vendas/{id}");
            Subtitulo.Text = $"Venda {v.S("codigo")} · {v.S("cliente")} · {Fmt.DmyHm(v.S("dataHora"))} · terminal {v.S("terminal")}";
            recebido.Text = Fmt.Brl(v.L("recebido")); desconto.Text = Fmt.Brl(v.L("desconto")); troco.Text = Fmt.Brl(v.L("troco"));
            itens = ((JsonArray)v["itens"]).OfType<JsonObject>().Where(i => !i.B("estornado")).ToList();
            tabela.Linhas(itens.Select(i => new[] { itens.Count == 1 ? "1" : "0", i.S("descricao"), i.S("quantidade"), Fmt.Dinheiro(i.L("liquido")) }));
            Atualizar();
        });
    }
}
