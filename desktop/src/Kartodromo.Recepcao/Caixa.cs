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
        if (!Abrir(dono, c)) return null;
        return (await Api.Get("/api/office/caixa")).AsObject();
    }

    static bool Abrir(IWin32Window dono, JsonObject c)
    {
        using var j = new FormTerminalAbrir(c);
        j.ShowDialog(dono);
        return j.Concluido;
    }

    public static void Terminal(FormPrincipal f) => Seguro.Rodar(f, async () =>
    {
        var c = (await Api.Get("/api/office/caixa")).AsObject();
        if (c["aberto"] is not JsonObject ab) { if (Abrir(f, c)) f.Recarregar(); return; }
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
public class FormCheckout : Janela, ISemKit
{
    protected override CreateParams CreateParams
    {
        get { var cp = base.CreateParams; cp.ClassStyle |= 0x20000; return cp; } // sombra da janela-cartão
    }

    static Button BotaoIcone(string texto, Color fundo, Color frente, int tam, float fonte, string fonteNome = "Segoe UI")
    {
        var b = new Button { Text = texto, Size = new Size(tam, tam), FlatStyle = FlatStyle.Flat, BackColor = fundo, ForeColor = frente, Font = new Font(fonteNome, fonte, FontStyle.Bold), Cursor = Cursors.Hand, Margin = new Padding(0, 0, 0, 10), TabStop = false };
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
    readonly Label _falta = new() { AutoSize = true, ForeColor = Color.FromArgb(110, 110, 115) };

    public FormCheckout(JsonObject terminal, long? bateriaId, List<long> reservaIds, long? clienteId)
        : base(reservaIds.Count > 0 ? "Aprovar Reserva" : "Receita Avulsa", 1320, 812, true)
    {
        // ---------- direita: totais
        var dir = new Panel { Dock = DockStyle.Right, Width = 240, Padding = new Padding(8) };
        var totais = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false };
        foreach (var (k, t, cor) in new[] { ("tot", "TOTAL", Color.Black), ("des", "DESCONTO (R$)", Tema.Vermelho), ("acr", "ACRÉSCIMO (R$)", Tema.Vermelho), ("sub", "SUBTOTAL", Tema.Verde), ("rec", "VALOR RECEBIDO", Color.Black), ("tro", "TROCO", Color.Black) })
        {
            var box = new Panel { Width = 218, Height = 72, BackColor = Color.White, BorderStyle = BorderStyle.FixedSingle, Margin = new Padding(0, 0, 0, 12) };
            var v = new Label { Text = "0,00", Dock = DockStyle.Fill, TextAlign = ContentAlignment.TopCenter, Font = new Font("Segoe UI", 16F, FontStyle.Bold), ForeColor = cor };
            box.Controls.Add(v);
            box.Controls.Add(new Label { Text = t, Dock = DockStyle.Top, Height = 32, TextAlign = ContentAlignment.BottomCenter, Font = new Font("Segoe UI", 15F, FontStyle.Bold) });
            _tot[k] = v;
            totais.Controls.Add(box);
        }
        var aprovar = new Button { Text = "Aprovar", Width = 218, Height = 64, Font = new Font("Segoe UI", 15F, FontStyle.Bold), BackColor = Color.White, FlatStyle = FlatStyle.Flat };
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
        var bPesq = new Button { Text = "🔍 Pesquisar Cliente", AutoSize = true };
        bPesq.Click += (_, _) => { var cl = FormPesquisarCliente.Escolher(this); if (cl != null) { _cliente = cl; Atualizar(); } };
        linha1.Controls.AddRange([Lbl("Bateria"), _bat, Lbl("   Cliente:"), _cli, Lbl("   Documento:"), _doc, bPesq]);
        esq.Controls.Add(linha1, 0, 0); esq.SetColumnSpan(linha1, 3);
        var pObs = new Panel { Dock = DockStyle.Fill }; pObs.Controls.Add(_obs); pObs.Controls.Add(new Label { Text = "Observações", Dock = DockStyle.Top, Height = 18 });
        esq.Controls.Add(pObs, 0, 1); esq.SetColumnSpan(pObs, 3);

        _gDisp.Colunas(new("reserva", "Reserva", Largura: 110), new("cliente", "Cliente", Largura: 170), new("produto", "Produto", Largura: 160), new("categoria", "Categoria", Largura: 90), new("aprovada", "Aprov.", TipoCol.Bool));
        _gDisp.Duplo += r => Adicionar([r]);
        esq.Controls.Add(Caixinha("Reservas disponíveis", _gDisp, ContentAlignment.MiddleRight), 0, 2);
        var setas = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, Padding = new Padding(2, 80, 0, 0) };
        var bAdd = new Button { Text = "→", Width = 36, Height = 30 }; var bRem = new Button { Text = "←", Width = 36, Height = 30 }; var bDel = new Button { Text = "🗑", Width = 36, Height = 30 };
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
        var bPA = new Button { Text = "Adicionar", AutoSize = true }; var bPR = new Button { Text = "Remover", AutoSize = true };
        bPA.Click += (_, _) => AdicionarPagamento(); bPR.Click += (_, _) => { foreach (var r in _gPag.Selecionados) _pags.RemoveAt(r.I("i")); Atualizar(); };
        var fb = new FlowLayoutPanel { Dock = DockStyle.Top, FlowDirection = FlowDirection.RightToLeft, Height = 32 }; fb.Controls.AddRange([bPA, bPR]);
        ck.Controls.Add(fb); ck.Controls.Add(gck); ck.Controls.Add(new Label { Text = "Checkout", Font = Tema.Negrito, Dock = DockStyle.Top, Height = 40, TextAlign = ContentAlignment.TopLeft });
        esq.Controls.Add(ck, 0, 3); esq.SetColumnSpan(ck, 2);
        _gPag.Colunas(new("forma", "Método de Pagamento", Largura: 260), new("valor", "Valor (R$)", TipoCol.Dinheiro));
        esq.Controls.Add(new Panel { Dock = DockStyle.Fill, BorderStyle = BorderStyle.FixedSingle, Controls = { _gPag } }, 2, 3);

        var rod = new FlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false };
        var bProd = new Button { Text = "Adicionar Produtos", AutoSize = true }; var bDesc = new Button { Text = "Aplicar Desconto", AutoSize = true };
        var bAcr = new Button { Text = "Aplicar Acréscimo", AutoSize = true }; var bVou = new Button { Text = "Aplicar Voucher", AutoSize = true };
        bProd.Click += (_, _) => AdicionarProduto(); bDesc.Click += (_, _) => Ajuste(true); bAcr.Click += (_, _) => Ajuste(false); bVou.Click += (_, _) => AplicarVoucher();
        rod.Controls.AddRange([bProd, new Label { Width = 200 }, bDesc, bAcr, _codVoucher, bVou]);
        esq.Controls.Add(rod, 0, 4); esq.SetColumnSpan(rod, 3);

        Controls.Add(esq);
        Controls.Add(dir);
        MontarLayoutCartoes(terminal);
        // janela-cartão (Checkout.dc.html): sem moldura, cantos arredondados, cabe na tela
        FormBorderStyle = FormBorderStyle.None;
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
        var fundo = Color.FromArgb(245, 245, 247);
        var texto = Color.FromArgb(29, 29, 31);
        var secundario = Color.FromArgb(110, 110, 115);
        var oldRoots = Controls.Cast<Control>().ToArray();
        Controls.Clear(); BackColor = fundo;

        var resumo = new Panel { Dock = DockStyle.Right, Width = 300, BackColor = Color.FromArgb(25, 25, 27), Padding = new Padding(18, 12, 18, 16) };
        resumo.Paint += (_, e) =>
        {
            using var b = new LinearGradientBrush(resumo.ClientRectangle, Color.FromArgb(28, 28, 30), Color.FromArgb(11, 11, 12), 90f);
            e.Graphics.FillRectangle(b, resumo.ClientRectangle);
        };
        var resumoLayout = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 4, BackColor = Color.Transparent, Padding = new Padding(0) };
        resumoLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 36)); resumoLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        resumoLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 110)); resumoLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 112));
        var fechar = new Panel { Dock = DockStyle.Fill, BackColor = Color.Transparent };
        var botaoX = BotaoIcone("✕", Color.FromArgb(58, 58, 62), Color.White, 32, 10F); botaoX.Margin = Padding.Empty; botaoX.Anchor = AnchorStyles.Top | AnchorStyles.Right;
        botaoX.Click += (_, _) => Close();
        fechar.Controls.Add(botaoX); fechar.Resize += (_, _) => botaoX.Location = new Point(fechar.Width - botaoX.Width, 2);
        var rodapeResumo = new Panel { Dock = DockStyle.Fill, BackColor = Color.Transparent };
        var aprovar = new Button { Text = "Aprovar pagamento", Dock = DockStyle.Top, Height = 56, FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(52, 199, 89), ForeColor = Color.White, Font = new Font("Segoe UI", 13.5F, FontStyle.Bold), Cursor = Cursors.Hand };
        aprovar.FlatAppearance.BorderSize = 0; aprovar.FlatAppearance.MouseOverBackColor = Color.FromArgb(76, 217, 100); aprovar.Click += (_, _) => Aprovar();
        aprovar.Paint += (_, e) =>
        {
            // gradiente do design (verde claro em cima, verde escuro embaixo)
            using var gb = new LinearGradientBrush(aprovar.ClientRectangle, Color.FromArgb(76, 217, 100), Color.FromArgb(31, 158, 74), 90f);
            e.Graphics.FillRectangle(gb, aprovar.ClientRectangle);
            TextRenderer.DrawText(e.Graphics, aprovar.Text, aprovar.Font, aprovar.ClientRectangle, Color.White, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        };
        aprovar.Resize += (_, _) => KitVisual.AplicarRaio(aprovar, 16);
        rodapeResumo.Controls.Add(aprovar);
        rodapeResumo.Controls.Add(new Label { Text = "F12 aprova e imprime o recibo se configurado", Dock = DockStyle.Bottom, Height = 42, ForeColor = Color.FromArgb(150, 150, 155), TextAlign = ContentAlignment.MiddleCenter, Font = new Font("Segoe UI", 8F) });
        var trocoCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.FromArgb(31, 68, 45), Padding = new Padding(14, 12, 12, 10), Margin = new Padding(0, 0, 0, 10) };
        Arredondar(trocoCard, 16);
        trocoCard.Controls.Add(new Label { Text = "Troco", Dock = DockStyle.Top, Height = 22, ForeColor = Color.FromArgb(167, 240, 186), Font = new Font("Segoe UI", 9F) });
        _tot["tro"].Dock = DockStyle.Fill; _tot["tro"].TextAlign = ContentAlignment.MiddleLeft; _tot["tro"].Font = new Font("Segoe UI", 28F, FontStyle.Bold); _tot["tro"].ForeColor = Color.White; _tot["tro"].BackColor = Color.Transparent;
        trocoCard.Controls.Add(_tot["tro"]); _tot["tro"].BringToFront();
        var linhasResumo = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 5, BackColor = Color.Transparent, Padding = new Padding(0, 12, 0, 10) };
        for (var i = 0; i < 5; i++) linhasResumo.RowStyles.Add(new RowStyle(SizeType.Percent, 20));
        var descricoes = new[] { ("tot", "Total"), ("des", "Desconto"), ("acr", "Acréscimo"), ("sub", "Subtotal"), ("rec", "Valor recebido") };
        foreach (var (key, label) in descricoes)
        {
            var row = new Panel { Dock = DockStyle.Fill, BackColor = Color.Transparent };
            var l = new Label { Text = label, Dock = DockStyle.Left, Width = 120, ForeColor = Color.FromArgb(174, 174, 180), TextAlign = ContentAlignment.MiddleLeft, Font = new Font("Segoe UI", 10.5F) };
            var value = _tot[key]; value.Dock = DockStyle.Fill; value.TextAlign = ContentAlignment.MiddleRight; value.Font = new Font("Segoe UI", 16F, FontStyle.Bold);
            value.ForeColor = key == "sub" ? Color.FromArgb(124, 234, 150) : key is "des" or "acr" ? Color.FromArgb(255, 105, 97) : Color.White; value.BackColor = Color.Transparent;
            row.Controls.Add(value); row.Controls.Add(l); row.Paint += (_, e) => { using var p = new Pen(Color.FromArgb(45, 255, 255, 255)); e.Graphics.DrawLine(p, 0, row.Height - 1, row.Width, row.Height - 1); };
            linhasResumo.Controls.Add(row);
        }
        resumoLayout.Controls.Add(fechar, 0, 0); resumoLayout.Controls.Add(linhasResumo, 0, 1); resumoLayout.Controls.Add(trocoCard, 0, 2); resumoLayout.Controls.Add(rodapeResumo, 0, 3);
        resumo.Controls.Clear(); resumo.Controls.Add(resumoLayout);

        var principal = new Panel { Dock = DockStyle.Fill, BackColor = fundo };
        var cab = new Panel { Dock = DockStyle.Top, Height = 70, BackColor = Color.White, Padding = new Padding(18, 9, 200, 8) };
        var linhaCab = new FlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false, FlowDirection = FlowDirection.LeftToRight, Padding = new Padding(0, 0, 0, 0), AutoScroll = false, BackColor = Color.White };
        var bloco = new Panel { Size = new Size(270, 52), Margin = new Padding(0, 0, 12, 0), BackColor = Color.White };
        var icoRec = new PictureBox { Image = VisualPrincipal.Icone("receita"), SizeMode = PictureBoxSizeMode.Zoom, Size = new Size(52, 52), Location = new Point(-6, -2) };
        bloco.Controls.Add(icoRec);
        bloco.Controls.Add(new Label { Text = Text.Contains("Aprovar") ? "Aprovar reserva" : "Receita avulsa", AutoSize = true, Font = new Font("Segoe UI", 12.5F, FontStyle.Bold), Location = new Point(48, 6), ForeColor = texto });
        bloco.Controls.Add(new Label { Text = $"Terminal {terminal.S("terminal")} · {Sessao.Nome}", AutoSize = true, Font = new Font("Segoe UI", 8.8F), ForeColor = secundario, Location = new Point(49, 30) });
        linhaCab.Controls.Add(bloco);
        linhaCab.Controls.Add(InfoCheckout("Bateria", _bat, 250));
        linhaCab.Controls.Add(InfoCheckout("Cliente", _cli, 190));
        linhaCab.Controls.Add(InfoCheckout("Documento", _doc, 150));
        var pesquisar = new Button { Text = "  Pesquisar cliente", Image = LupaBmp(), ImageAlign = ContentAlignment.MiddleLeft, TextImageRelation = TextImageRelation.ImageBeforeText, AutoSize = true, Height = 36, MinimumSize = new Size(0, 36), Padding = new Padding(8, 0, 10, 0), FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(238, 238, 241), ForeColor = texto, Font = new Font("Segoe UI", 9.5F), Cursor = Cursors.Hand, Anchor = AnchorStyles.Top | AnchorStyles.Right };
        pesquisar.FlatAppearance.BorderSize = 0; pesquisar.Click += (_, _) => { var cl = FormPesquisarCliente.Escolher(this); if (cl != null) { _cliente = cl; Atualizar(); } };
        pesquisar.Resize += (_, _) => KitVisual.AplicarRaio(pesquisar, 10);
        cab.Controls.Add(linhaCab); cab.Controls.Add(pesquisar); pesquisar.BringToFront();
        void PosPesquisar() => pesquisar.Location = new Point(cab.ClientSize.Width - pesquisar.Width - 18, 17);
        cab.Resize += (_, _) => PosPesquisar(); cab.Layout += (_, _) => PosPesquisar(); pesquisar.SizeChanged += (_, _) => PosPesquisar();
        cab.Paint += (_, e) => { using var pen = new Pen(Color.FromArgb(229, 229, 234)); e.Graphics.DrawLine(pen, 0, cab.Height - 1, cab.Width, cab.Height - 1); };
        Point? arrasto = null;
        foreach (var alvo in new Control[] { cab, linhaCab, bloco })
        {
            alvo.MouseDown += (_, e) => { if (e.Button == MouseButtons.Left) arrasto = Cursor.Position; };
            alvo.MouseMove += (_, e) => { if (arrasto is Point o && e.Button == MouseButtons.Left) { var agora = Cursor.Position; Location = new Point(Location.X + agora.X - o.X, Location.Y + agora.Y - o.Y); arrasto = agora; } };
            alvo.MouseUp += (_, _) => arrasto = null;
        }

        var conteudo = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 3, BackColor = fundo, Padding = new Padding(14, 12, 14, 14) };
        conteudo.RowStyles.Add(new RowStyle(SizeType.Absolute, 52)); conteudo.RowStyles.Add(new RowStyle(SizeType.Percent, 100)); conteudo.RowStyles.Add(new RowStyle(SizeType.Absolute, 222));
        var obsCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(12, 3, 12, 3), Margin = new Padding(0, 0, 0, 10) };
        Arredondar(obsCard, 10);
        var obsTitulo = new Label { Text = "Observações", Dock = DockStyle.Left, Width = 98, ForeColor = secundario, Font = new Font("Segoe UI", 8.5F, FontStyle.Bold), TextAlign = ContentAlignment.MiddleLeft };
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
        _gDisp.Columns["reserva"].DefaultCellStyle.Font = new Font("Cascadia Mono", 9F, FontStyle.Bold);
        _gCar.Columns["total"].DefaultCellStyle.Font = new Font("Segoe UI", 9.2F, FontStyle.Bold);
        _gDisp.CellPainting += (_, e) =>
        {
            if (e.RowIndex < 0 || _gDisp.Columns[e.ColumnIndex].Name != "cliente" || e.RowIndex >= _gDisp.Rows.Count || _gDisp.Rows[e.RowIndex].Tag is not JsonObject r) return;
            e.PaintBackground(e.CellBounds, true);
            var cor = (e.State & DataGridViewElementStates.Selected) != 0 ? KitVisual.Texto : KitVisual.Texto;
            TextRenderer.DrawText(e.Graphics, r.S("cliente"), new Font("Segoe UI", 9.2F, FontStyle.Bold), new Rectangle(e.CellBounds.X + 4, e.CellBounds.Y + 3, e.CellBounds.Width - 8, 17), cor, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPadding);
            TextRenderer.DrawText(e.Graphics, r.S("produto"), new Font("Segoe UI", 8F), new Rectangle(e.CellBounds.X + 4, e.CellBounds.Y + 20, e.CellBounds.Width - 8, 15), KitVisual.Secundario, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPadding);
            e.Handled = true;
        };
        _gPag.ColumnHeadersVisible = false;
        var meio = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 3, RowCount = 1, BackColor = fundo, Margin = new Padding(0, 0, 0, 10) };
        meio.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 43)); meio.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 70)); meio.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 57));
        meio.Controls.Add(Caixinha("Reservas disponíveis", "Não pagas desta bateria", _gDisp), 0, 0);
        var setas = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, Padding = new Padding(6, 150, 0, 0) };
        var bAdd = BotaoIcone("→", Color.FromArgb(11, 122, 83), Color.White, 50, 15F); bAdd.AccessibleName = "Adicionar ao carrinho";
        var bBack = BotaoIcone("←", Color.White, texto, 50, 15F); bBack.AccessibleName = "Voltar às reservas disponíveis";
        var bClear = BotaoIcone("\uE74D", Color.White, Color.FromArgb(196, 40, 28), 50, 12F, "Segoe MDL2 Assets"); bClear.AccessibleName = "Tirar do carrinho";
        foreach (var b in new[] { bBack, bClear }) b.Paint += (_, e) => { e.Graphics.SmoothingMode = SmoothingMode.AntiAlias; using var p = VisualPrincipal.Redondo(new Rectangle(0, 0, b.Width - 1, b.Height - 1), 14); using var pen = new Pen(Color.FromArgb(222, 222, 227)); e.Graphics.DrawPath(pen, p); };
        bAdd.Click += (_, _) => Adicionar(_gDisp.Marcados.Count > 0 ? _gDisp.Marcados : _gDisp.Selecionados); bBack.Click += (_, _) => Remover(); bClear.Click += (_, _) => Remover();
        _gDisp.Duplo += r => Adicionar([r]); setas.Controls.AddRange([bAdd, bBack, bClear]); meio.Controls.Add(setas, 1, 0);
        var carrinho = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(0) };
        Arredondar(carrinho, 14);
        var titCarrinho = new Panel { Dock = DockStyle.Top, Height = 44, Padding = new Padding(12, 5, 12, 3), BackColor = Color.White };
        titCarrinho.Controls.Add(new Label { Text = "Toque num item para dar desconto ou acréscimo", Dock = DockStyle.Fill, ForeColor = secundario, TextAlign = ContentAlignment.MiddleRight, Font = new Font("Segoe UI", 8.5F) });
        titCarrinho.Controls.Add(new Label { Text = "Carrinho", Dock = DockStyle.Left, Width = 110, Font = new Font("Segoe UI", 10.5F, FontStyle.Bold), TextAlign = ContentAlignment.MiddleLeft });
        var barraCarrinho = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 92, WrapContents = true, Padding = new Padding(12, 8, 12, 4), FlowDirection = FlowDirection.LeftToRight, BackColor = Color.FromArgb(251, 251, 253) };
        Button Acao(string caption, Action action, int width)
        {
            var b = new Button { Text = caption, AutoSize = true, MinimumSize = new Size(width, 34), Height = 34, Padding = new Padding(8, 0, 8, 0), FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(238, 238, 241), ForeColor = texto, Font = new Font("Segoe UI", 9.3F), Margin = new Padding(0, 0, 8, 6), Cursor = Cursors.Hand, AccessibleName = caption };
            b.FlatAppearance.BorderSize = 0; b.Click += (_, _) => action(); b.Resize += (_, _) => KitVisual.AplicarRaio(b, 9); return b;
        }
        barraCarrinho.Controls.Add(Acao("+ Adicionar produtos", AdicionarProduto, 120));
        barraCarrinho.Controls.Add(Acao("Aplicar desconto", () => Ajuste(true), 100));
        barraCarrinho.Controls.Add(Acao("Aplicar acréscimo", () => Ajuste(false), 100));
        barraCarrinho.SetFlowBreak(barraCarrinho.Controls[^1], true);
        _codVoucher.PlaceholderText = "Código do voucher"; _codVoucher.AccessibleName = "Código do voucher";
        _codVoucher.Font = new Font("Cascadia Mono", 9.5F);
        var aplicarVoucher = new Button { Text = "Aplicar", AutoSize = true, Dock = DockStyle.Right, FlatStyle = FlatStyle.Flat, BackColor = KitVisual.VerdeClaro, ForeColor = KitVisual.Verde, Font = new Font("Segoe UI", 9F, FontStyle.Bold), Cursor = Cursors.Hand, TabStop = false };
        aplicarVoucher.FlatAppearance.BorderSize = 0; aplicarVoucher.Click += (_, _) => AplicarVoucher();
        var caixaVoucher = FormCliente.Caixa(_codVoucher, aplicarVoucher); caixaVoucher.Dock = DockStyle.None; caixaVoucher.Size = new Size(200, 34); caixaVoucher.Margin = new Padding(0, 0, 0, 0);
        barraCarrinho.Controls.Add(caixaVoucher);
        barraCarrinho.Resize += (_, _) => caixaVoucher.Margin = new Padding(Math.Max(0, barraCarrinho.ClientSize.Width - 24 - caixaVoucher.Width), 0, 0, 0);
        var gradeCarrinho = new Panel { Dock = DockStyle.Fill, Padding = new Padding(0, 0, 0, 0), BackColor = Color.White }; gradeCarrinho.Controls.Add(_gCar);
        carrinho.Controls.Add(gradeCarrinho); carrinho.Controls.Add(barraCarrinho); carrinho.Controls.Add(titCarrinho); meio.Controls.Add(carrinho, 2, 0);

        var pagamentos = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1, BackColor = fundo };
        pagamentos.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 60)); pagamentos.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 40));
        var formasCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(12), Margin = new Padding(0, 0, 8, 0) };
        var pagamentosCard = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(12), Margin = new Padding(8, 0, 0, 0) };
        Arredondar(formasCard, 14); Arredondar(pagamentosCard, 14);
        var tituloFormas = new Label { Text = "Forma de pagamento", Dock = DockStyle.Top, Height = 28, Font = new Font("Segoe UI", 10.5F, FontStyle.Bold), ForeColor = texto };
        var formas = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 70, WrapContents = false, AutoScroll = true, Padding = new Padding(0, 3, 0, 0), FlowDirection = FlowDirection.LeftToRight };
        var paymentItems = _forma.Items.OfType<Campos.Item>().ToArray();
        foreach (var method in paymentItems)
        {
            var type = method.Dados?.S("tipo") ?? "outro";
            var chave = type is "dinheiro" or "credito" or "debito" or "pix" or "voucher" ? "pg-" + type : "pg-outro";
            var nomeForma = System.Globalization.CultureInfo.GetCultureInfo("pt-BR").TextInfo.ToTitleCase(method.Texto.ToLowerInvariant());
            var button = new Button { Text = nomeForma, Image = new Bitmap(VisualPrincipal.Icone(chave), 20, 20), TextImageRelation = TextImageRelation.ImageAboveText, ImageAlign = ContentAlignment.BottomCenter, TextAlign = ContentAlignment.TopCenter, AutoSize = false, Size = new Size(98, 58), Margin = new Padding(0, 0, 8, 8), Padding = new Padding(0, 6, 0, 4), FlatStyle = FlatStyle.Flat, Font = new Font("Segoe UI", 9F, FontStyle.Bold), Cursor = Cursors.Hand, Tag = (method, chave), AccessibleName = method.Texto, AccessibleDescription = "kit:ignorar" };
            button.Resize += (_, _) => KitVisual.AplicarRaio(button, 10);
            button.FlatAppearance.BorderSize = 0;
            button.Click += (_, _) => { _forma.SelectedItem = method; MarcarForma(formas); };
            button.Paint += (_, e) =>
            {
                if (button.BackColor == Color.FromArgb(11, 122, 83)) return;
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using var p = VisualPrincipal.Redondo(new Rectangle(0, 0, button.Width - 1, button.Height - 1), 10); using var pen = new Pen(Color.FromArgb(222, 222, 227)); e.Graphics.DrawPath(pen, p);
            };
            formas.Controls.Add(button);
        }
        if (_forma.SelectedIndex >= 0) MarcarForma(formas);
        // todas as formas cabem numa linha, como no design
        formas.Resize += (_, _) =>
        {
            var bs = formas.Controls.OfType<Button>().ToList(); if (bs.Count == 0) return;
            var w = Math.Max(72, (formas.ClientSize.Width - 8 * bs.Count - 2) / bs.Count);
            foreach (var b in bs) b.Width = w;
        };
        formas.AutoScroll = false;
        var linhaValor = new FlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false, Padding = new Padding(0, 5, 0, 0), FlowDirection = FlowDirection.LeftToRight };
        var recebido = new Panel { Width = 330, Height = 42, Padding = new Padding(12, 9, 12, 4), BackColor = Color.White, Margin = new Padding(0, 0, 8, 0) };
        recebido.Paint += (_, e) => { e.Graphics.SmoothingMode = SmoothingMode.AntiAlias; using var p = VisualPrincipal.Redondo(new Rectangle(1, 1, recebido.Width - 3, recebido.Height - 3), 10); using var pen = new Pen(Color.FromArgb(29, 29, 31), 1.6F); e.Graphics.DrawPath(pen, p); };
        var recebidoLabel = new Label { Text = "Valor recebido", Dock = DockStyle.Left, Width = 70, ForeColor = secundario, Font = new Font("Segoe UI", 8F), TextAlign = ContentAlignment.MiddleLeft };
        _valor.Width = 140; _valor.BorderStyle = BorderStyle.None; _valor.TextAlign = HorizontalAlignment.Right; _valor.Font = new Font("Segoe UI", 13.5F, FontStyle.Bold);
        _valor.Dock = DockStyle.Fill; _valor.PlaceholderText = "0,00";
        recebido.Controls.Add(_valor); recebido.Controls.Add(recebidoLabel); _valor.BringToFront();
        var bPagamento = AcaoPagamento("Adicionar", AdicionarPagamento, true);
        var bRemoverPagamento = AcaoPagamento("Remover", () => { foreach (var r in _gPag.Selecionados) _pags.RemoveAt(r.I("i")); Atualizar(); }, false);
        linhaValor.Controls.AddRange([recebido, bPagamento, bRemoverPagamento]);
        formasCard.Controls.Add(linhaValor); formasCard.Controls.Add(formas); formasCard.Controls.Add(tituloFormas);
        var tituloPagamentos = new Label { Text = "Pagamentos lançados", Dock = DockStyle.Top, Height = 28, Font = new Font("Segoe UI", 10.5F, FontStyle.Bold), ForeColor = texto };
        var pagamentosGrid = new Panel { Dock = DockStyle.Fill, BackColor = Color.White }; pagamentosGrid.Controls.Add(_gPag);
        _falta.Dock = DockStyle.Bottom; _falta.Height = 22; _falta.TextAlign = ContentAlignment.MiddleLeft;
        pagamentosCard.Controls.Add(pagamentosGrid); pagamentosCard.Controls.Add(_falta); pagamentosCard.Controls.Add(tituloPagamentos);
        pagamentos.Controls.Add(formasCard, 0, 0); pagamentos.Controls.Add(pagamentosCard, 1, 0);

        conteudo.Controls.Add(obsCard, 0, 0); conteudo.Controls.Add(meio, 0, 1); conteudo.Controls.Add(pagamentos, 0, 2);
        _forma.Visible = false; _forma.SetBounds(-10, -10, 1, 1); principal.Controls.Add(_forma);
        principal.Controls.Add(conteudo); principal.Controls.Add(cab); Controls.Add(principal); Controls.Add(resumo);
        foreach (var old in oldRoots) old.Dispose();

        Button AcaoPagamento(string caption, Action action, bool principal)
        {
            var b = new Button { Text = caption, AutoSize = true, Height = 42, MinimumSize = new Size(88, 42), FlatStyle = FlatStyle.Flat, BackColor = principal ? Color.FromArgb(11, 122, 83) : Color.FromArgb(238, 238, 241), ForeColor = principal ? Color.White : texto, Font = new Font("Segoe UI", 9.5F, principal ? FontStyle.Bold : FontStyle.Regular), Margin = new Padding(0, 0, 8, 0), Cursor = Cursors.Hand };
            b.FlatAppearance.BorderSize = 0; b.Click += (_, _) => action(); b.Resize += (_, _) => KitVisual.AplicarRaio(b, 10); return b;
        }
    }

    static Bitmap LupaBmp()
    {
        var bmp = new Bitmap(16, 16);
        using var g = Graphics.FromImage(bmp);
        TextRenderer.DrawText(g, "\uE721", new Font("Segoe MDL2 Assets", 9F), new Rectangle(0, 0, 16, 16), Color.FromArgb(29, 29, 31), TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
        return bmp;
    }

    static Panel InfoCheckout(string titulo, Control valor, int largura)
    {
        var p = new Panel { Width = largura, Height = 44, BackColor = Color.White, Padding = new Padding(11, 4, 8, 3), Margin = new Padding(4, 4, 4, 0) };
        p.Paint += (_, e) => { e.Graphics.SmoothingMode = SmoothingMode.AntiAlias; using var path = VisualPrincipal.Redondo(new Rectangle(0, 0, p.Width - 1, p.Height - 1), 9); using var pen = new Pen(Color.FromArgb(222, 222, 227)); e.Graphics.DrawPath(pen, path); };
        Arredondar(p, 9);
        p.Controls.Add(valor); p.Controls.Add(new Label { Text = titulo, Dock = DockStyle.Top, Height = 16, ForeColor = Color.FromArgb(110, 110, 115), Font = new Font("Segoe UI", 7.5F, FontStyle.Bold) });
        if (valor is ComboBox cb) { cb.Dock = DockStyle.Fill; cb.Margin = new Padding(0); cb.FlatStyle = FlatStyle.Flat; }
        if (valor is Label l) { l.Dock = DockStyle.Fill; l.AutoSize = false; l.TextAlign = ContentAlignment.MiddleLeft; l.Font = new Font("Segoe UI", 8.5F, FontStyle.Bold); l.ForeColor = Color.FromArgb(29, 29, 31); l.AutoEllipsis = true; }
        return p;
    }

    void MarcarForma(FlowLayoutPanel host)
    {
        foreach (var b in host.Controls.OfType<Button>())
        {
            var selecionado = b.Tag is (Campos.Item it, string chaveIco) && _forma.SelectedItem is Campos.Item atual && atual.Id == it.Id;
            if (b.Tag is (Campos.Item, string k)) b.Image = new Bitmap(VisualPrincipal.Icone(selecionado ? k + "-b" : k), 20, 20);
            b.BackColor = selecionado ? Color.FromArgb(11, 122, 83) : Color.FromArgb(245, 245, 247);
            b.ForeColor = selecionado ? Color.White : Color.FromArgb(29, 29, 31);
        }
    }

    static Panel Caixinha(string titulo, string subtitulo, Control c)
    {
        var p = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(0) };
        Arredondar(p, 14);
        var header = new Panel { Dock = DockStyle.Top, Height = 42, Padding = new Padding(14, 4, 14, 2), BackColor = Color.White };
        header.Controls.Add(new Label { Text = subtitulo, Dock = DockStyle.Fill, Font = new Font("Segoe UI", 8.5F), ForeColor = Color.FromArgb(110, 110, 115), TextAlign = ContentAlignment.MiddleRight });
        header.Controls.Add(new Label { Text = titulo, Dock = DockStyle.Left, AutoSize = false, Width = 170, Font = new Font("Segoe UI", 10.5F, FontStyle.Bold), ForeColor = Color.FromArgb(29, 29, 31), TextAlign = ContentAlignment.MiddleLeft });
        var box = new Panel { Dock = DockStyle.Fill, Padding = new Padding(6, 0, 6, 6), BackColor = Color.White }; box.Controls.Add(c);
        p.Controls.Add(box); p.Controls.Add(header); return p;
    }

    static void Arredondar(Panel painel, int raio)
    {
        void Ajustar()
        {
            if (painel.Width < raio * 2 || painel.Height < raio * 2) return;
            using var path = new GraphicsPath(); var w = painel.Width - 1; var h = painel.Height - 1;
            path.AddArc(0, 0, raio, raio, 180, 90); path.AddArc(w - raio, 0, raio, raio, 270, 90); path.AddArc(w - raio, h - raio, raio, raio, 0, 90); path.AddArc(0, h - raio, raio, raio, 90, 90); path.CloseFigure();
            painel.Region = new Region(path);
        }
        painel.Resize += (_, _) => Ajustar(); painel.Paint += (_, e) =>
        {
            if (painel.Width < raio * 2 || painel.Height < raio * 2) return;
            using var path = new GraphicsPath(); var w = painel.Width - 1; var h = painel.Height - 1;
            path.AddArc(0, 0, raio, raio, 180, 90); path.AddArc(w - raio, 0, raio, raio, 270, 90); path.AddArc(w - raio, h - raio, raio, raio, 0, 90); path.AddArc(0, h - raio, raio, raio, 90, 90); path.CloseFigure();
            using var pen = new Pen(Color.FromArgb(232, 232, 236)); e.Graphics.SmoothingMode = SmoothingMode.AntiAlias; e.Graphics.DrawPath(pen, path);
        };
        Ajustar();
    }

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
        _gDisp.Carregar(_disp.Where(r => !_car.Any(c => c.InscricaoId == r.L("id"))));
        _gCar.Carregar(_car.Select(c => new JsonObject { ["id"] = c.K, ["k"] = c.K, ["cliente"] = c.Cliente, ["produto"] = c.Produto, ["qtd"] = c.Qtd, ["unit"] = c.Unit, ["descPct"] = c.DescPct.ToString("0.##"), ["desc"] = c.Desc, ["acrPct"] = c.AcrPct.ToString("0.##"), ["acr"] = c.Acr, ["total"] = c.Unit * c.Qtd - c.Desc + c.Acr }));
        _gPag.Carregar(_pags.Select((p, i) => new JsonObject { ["id"] = i, ["i"] = i, ["forma"] = p.nome, ["valor"] = p.valor }));
        var t = Totais();
        _tot["tot"].Text = Fmt.Brl(t.tot); _tot["des"].Text = Fmt.Brl(t.des); _tot["acr"].Text = Fmt.Brl(t.acr);
        _tot["sub"].Text = Fmt.Brl(t.sub); _tot["rec"].Text = Fmt.Brl(t.rec); _tot["tro"].Text = Fmt.Brl(t.troco);
        _falta.Text = t.falta > 0 ? $"Falta lançar {Fmt.Brl(t.falta)}" : "Pagamento completo";
        _valor.Text = t.falta > 0 ? Fmt.Dinheiro(t.falta) : "";
        _cli.Text = _cliente?.S("nome") ?? ""; _doc.Text = _cliente?.S("documento") ?? "";
    }

    void AdicionarPagamento()
    {
        if (Fmt.Centavos(_valor.Text) is not long v || v <= 0) { Msg.Aviso(this, "Informe o valor."); return; }
        if (_forma.SelectedItem is not Campos.Item f) return;
        _pags.Add((f.Id, f.Texto, v));
        Atualizar();
    }

    void AdicionarProduto()
    {
        using var j = new Janela("Adicionar Produtos ao Carrinho", 560, 110);
        var p = Campos.Combo(); p.Items.AddRange(Sessao.Produtos()); if (p.Items.Count > 0) p.SelectedIndex = 0;
        var q = Campos.Num(1, 1, 999); var v = new TextBox();
        void Preco() { if (p.SelectedItem is Campos.Item it) v.Text = Fmt.Dinheiro(it.Dados.L("preco")); }
        p.SelectedIndexChanged += (_, _) => Preco(); Preco();
        var g = Campos.Grade(3, 60, 18, 22); Campos.Add(g, "Produto", p); Campos.Add(g, "Quantidade", q); Campos.Add(g, "Preço", v);
        j.Controls.Add(new Panel { Dock = DockStyle.Fill, Padding = new Padding(10), Controls = { g } });
        j.Rodape(("Cancelar", (_, _) => j.Close(), false), ("Adicionar", (_, _) =>
        {
            if (p.SelectedItem is not Campos.Item it || Fmt.Centavos(v.Text) is not long preco) { Msg.Aviso(j, "Produto ou preço inválido."); return; }
            if (Sessao.ParamSim("office.bloquearProdutosRepetidos", false) && _car.Any(c => c.InscricaoId == null && c.ProdutoId == it.Id)) { Msg.Aviso(j, "Produto já está no carrinho."); return; }
            _car.Add(new ItemCarrinho { K = _seq++, ProdutoId = it.Id, Produto = it.Dados.S("nome"), Cliente = _cliente?.S("nome") ?? "", Qtd = (int)q.Value, Unit = preco });
            j.Close(); Atualizar();
        }, true));
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
        var t = Totais();
        if (_pags.Count == 0 && t.sub > 0 && _forma.SelectedItem is Campos.Item f) { _pags.Add((f.Id, f.Texto, Fmt.Centavos(_valor.Text) is long vv && vv > 0 ? vv : t.sub)); Atualizar(); t = Totais(); }
        if (t.falta > 0 && Sessao.ParamSim("office.validarTotalPago", true)) { Msg.Aviso(this, $"Ainda faltam ser pagos {Fmt.Brl(t.falta)} para poder concluir a compra."); return; }
        var itens = new JsonArray();
        foreach (var c in _car) itens.Add(new JsonObject { ["inscricaoId"] = c.InscricaoId, ["produtoId"] = c.ProdutoId, ["quantidade"] = c.Qtd, ["unitarioCentavos"] = c.Unit, ["descontoCentavos"] = c.Voucher ? 0 : c.Desc, ["acrescimoCentavos"] = c.Acr });
        var pags = new JsonArray();
        foreach (var p in _pags) pags.Add(new JsonObject { ["formaPagamentoId"] = p.forma, ["valorCentavos"] = p.valor });
        var r = await Api.Post("/api/office/vendas", new JsonObject { ["clienteId"] = _cliente?.L("id"), ["observacao"] = _obs.Text, ["voucherCodigo"] = _voucher, ["itens"] = itens, ["pagamentos"] = pags });
        Concluido = true;
        Msg.Info(this, $"Venda nº {r.S("id")} aprovada." + (r.L("troco") is long tr && tr > 0 ? $"\nTroco: {Fmt.Brl(tr)}" : ""));
        var inscr = r["inscricoes"] is JsonArray a ? a.Select(x => x?.ToString()).Where(x => x != null).ToList() : [];
        Close();
        if (Sessao.ParamSim("office.imprimirTicketAposVenda", false)) Relatorio.Abrir(Owner, Api.UrlComToken("/relatorio/venda?id=" + r.S("id")), "Comprovante");
        if (inscr.Count > 0 && (Sessao.ParamSim("office.gerarTermoAposPagamento", false) || (Sessao.ParamSim("office.perguntarImprimirTermo", true) && Msg.Pergunta(Owner, "Deseja imprimir o Termo de Responsabilidade?", "Pergunta!"))))
            Acoes.ImprimirTermo(Owner, inscr);
    });
}

public class FormVenda : Janela
{
    public FormVenda(long id) : base("Visualizar métodos de pagamento", 960, 680)
    {
        var gi = new Grade();
        gi.Colunas(
            new("item", "Item", TipoCol.Inteiro, 60),
            new("descricao", "Descrição", Largura: 320),
            new("quantidade", "Qtde", TipoCol.Inteiro, 60),
            new("unitario", "Unitário", TipoCol.Dinheiro, 90),
            new("desconto", "Desconto", TipoCol.Dinheiro, 90),
            new("liquido", "Líquido", TipoCol.Dinheiro, 100),
            new("estornado", "Estornado", TipoCol.Bool, 80)
        );
        gi.Dock = DockStyle.Fill;

        var cartaoItens = KitVisual.CartaoSecao("Itens");
        cartaoItens.AutoSize = false;
        cartaoItens.Height = 220;
        var pItens = new Panel { Dock = DockStyle.Fill, Padding = new Padding(0, 8, 0, 0) };
        pItens.Controls.Add(gi);
        cartaoItens.Controls.Add(pItens);

        var gp = new Grade();
        gp.Colunas(
            new("forma", "Método de pagamento", Largura: 400),
            new("valor", "Valor (R$)", TipoCol.Dinheiro, 140)
        );
        gp.Dock = DockStyle.Fill;

        var cartaoPags = KitVisual.CartaoSecao("Pagamentos");
        cartaoPags.AutoSize = false;
        cartaoPags.Height = 160;
        var pPags = new Panel { Dock = DockStyle.Fill, Padding = new Padding(0, 8, 0, 0) };
        pPags.Controls.Add(gp);
        cartaoPags.Controls.Add(pPags);

        var nota = new Panel { Dock = DockStyle.Top, Height = 48, BackColor = Color.FromArgb(245, 245, 247), Padding = new Padding(14, 10, 14, 10), Margin = new Padding(0, 0, 0, 12) };
        nota.Paint += (_, e) =>
        {
            using var pen = new Pen(Color.FromArgb(232, 232, 236));
            e.Graphics.DrawRectangle(pen, 0, 0, nota.Width - 1, nota.Height - 1);
        };
        var lblTotais = new Label { Dock = DockStyle.Fill, ForeColor = Color.FromArgb(58, 58, 60), Font = new Font("Segoe UI", 9.2F) };
        nota.Controls.Add(lblTotais);

        Controls.Add(nota);
        Controls.Add(cartaoPags);
        Controls.Add(cartaoItens);

        Rodape(
            ("Imprimir comprovante", (_, _) => Relatorio.Abrir(this, Sessao.Api.UrlComToken("/relatorio/venda?id=" + id), "Comprovante"), false),
            ("Fechar", (_, _) => Close(), true)
        );

        Load += (_, _) => Seguro.Rodar(this, async () =>
        {
            var v = await Sessao.Api.Get($"/api/office/vendas/{id}");
            Tag = $"Venda nº {v.S("codigo")} · {v.S("cliente")} · {Fmt.DmyHm(v.S("dataHora"))} · {v.S("usuario")} · {v.S("terminal")}";
            gi.Carregar(((JsonArray)v["itens"]).OfType<JsonObject>());
            gp.Carregar(((JsonArray)v["pagamentos"]).OfType<JsonObject>());
            lblTotais.Text = $"Total {Fmt.Brl(v.L("final"))} · Desconto {Fmt.Brl(v.L("desconto"))} · Recebido {Fmt.Brl(v.L("recebido"))} · Troco {Fmt.Brl(v.L("troco"))} · Estornos {Fmt.Brl(v.L("estorno"))}";
        });
    }
}

public class FormEstorno : Janela
{
    public FormEstorno(long id) : base("Estornar pagamento", 960, 680)
    {
        var txtRecebido = new TextBox { ReadOnly = true };
        var txtDesconto = new TextBox { ReadOnly = true };
        var txtTroco = new TextBox { ReadOnly = true };

        var gResumo = Campos.Grade(6);
        Campos.Add(gResumo, "Total recebido", txtRecebido, 2);
        Campos.Add(gResumo, "Descontos", txtDesconto, 2);
        Campos.Add(gResumo, "Troco", txtTroco, 2);

        var cResumo = KitVisual.CartaoSecao("Resumo");
        cResumo.Controls.Add(gResumo);

        var g = new Grade(true);
        g.Colunas(
            new("descricao", "Item", Largura: 420),
            new("quantidade", "Qtde", TipoCol.Inteiro, 70),
            new("liquido", "Total líquido", TipoCol.Dinheiro, 130)
        );
        g.Dock = DockStyle.Fill;

        var cItens = KitVisual.CartaoSecao("Marque os itens a estornar");
        cItens.AutoSize = false;
        cItens.Height = 220;
        var pGrid = new Panel { Dock = DockStyle.Fill, Padding = new Padding(0, 8, 0, 0) };
        pGrid.Controls.Add(g);
        cItens.Controls.Add(pGrid);

        var motivo = Campos.Texto(400);
        var gMotivo = Campos.Grade(6);
        Campos.Add(gMotivo, "Motivo do estorno", motivo, 6);

        var cMotivo = KitVisual.CartaoSecao("Motivo (obrigatório)");
        cMotivo.Controls.Add(gMotivo);

        Controls.Add(cMotivo);
        Controls.Add(cItens);
        Controls.Add(cResumo);

        Button btnEstornar = null;
        void AtualizarBotao()
        {
            var sel = g.Marcados;
            var soma = sel.Sum(i => i.L("liquido") ?? 0);
            if (btnEstornar != null) btnEstornar.Text = soma > 0 ? $"Estornar {Fmt.Brl(soma)}" : "Estornar";
        }
        g.ItemMarcadoMudou += () => AtualizarBotao();

        var rodapeCtrl = Rodape("Devolva o valor pela mesma forma de pagamento.",
            ("Cancelar", (_, _) => Close(), false),
            ("Estornar", (_, _) => Seguro.Rodar(this, async () =>
            {
                var sel = g.Marcados;
                if (sel.Count == 0) { Msg.Aviso(this, "Selecione os itens a estornar."); return; }
                if (string.IsNullOrWhiteSpace(motivo.Text)) { Msg.Aviso(this, "Informe o motivo do estorno."); return; }
                if (!Msg.Pergunta(this, "Tem certeza que deseja estornar os produtos selecionados?")) return;
                var r = await Sessao.Api.Post($"/api/office/vendas/{id}/estorno", new { itemIds = sel.Select(i => i.L("id")).ToArray(), motivo = motivo.Text.Trim() });
                Msg.Info(this, $"Estorno de {Fmt.Brl(r.L("estornado"))} registrado. Devolva o valor ao cliente pela mesma forma de pagamento.");
                DialogResult = DialogResult.OK; Close();
            }), true)
        );

        if (rodapeCtrl is Panel pnl)
        {
            var flw = pnl.Controls.OfType<FlowLayoutPanel>().FirstOrDefault();
            btnEstornar = flw?.Controls.OfType<Button>().FirstOrDefault(b => b.Text.StartsWith("Estornar"));
            if (btnEstornar != null)
            {
                btnEstornar.BackColor = Color.FromArgb(224, 52, 42);
                btnEstornar.ForeColor = Color.White;
            }
        }

        Load += (_, _) => Seguro.Rodar(this, async () =>
        {
            var v = await Sessao.Api.Get($"/api/office/vendas/{id}");
            Tag = $"Venda nº {v.S("codigo")} · {v.S("cliente")} · {Fmt.DmyHm(v.S("dataHora"))} · terminal {v.S("terminal")}";
            txtRecebido.Text = Fmt.Brl(v.L("recebido"));
            txtDesconto.Text = Fmt.Brl(v.L("desconto"));
            txtTroco.Text = Fmt.Brl(v.L("troco"));
            g.Carregar(((JsonArray)v["itens"]).OfType<JsonObject>().Where(i => !i.B("estornado")));
            AtualizarBotao();
        });
    }
}
