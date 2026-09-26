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
        using var j = new Janela("Terminal", 380, 170);
        var turno = Campos.Combo(); turno.Items.AddRange(((JsonArray)c["turnos"]).OfType<JsonObject>().Select(t => new Campos.Item(t.L("id") ?? 0, t.S("descricao"))).ToArray());
        var term = Campos.Combo(); term.Items.AddRange(((JsonArray)c["terminais"]).OfType<JsonObject>().Select(t => new Campos.Item(t.L("id") ?? 0, t.S("nome"))).ToArray());
        if (turno.Items.Count == 1) turno.SelectedIndex = 0;
        var sup = new TextBox { Text = "0" };
        var t = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, Padding = new Padding(10) };
        t.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 150)); t.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        void L(string r, Control ctl) { t.Controls.Add(new Label { Text = r, AutoSize = true, Margin = new Padding(3, 7, 3, 3) }); ctl.Dock = DockStyle.Fill; t.Controls.Add(ctl); }
        L("Usuário:", new Label { Text = Sessao.Nome, Font = new Font("Segoe UI", 13F, FontStyle.Bold), AutoSize = true });
        L("Turnos Disponíveis:", turno); L("Terminais Disponíveis:", term); L("Suprimento Inicial (R$):", sup);
        j.Controls.Add(t);
        var ok = false;
        j.Rodape(("Abrir Terminal", (_, _) => Seguro.Rodar(j, async () =>
        {
            if (Campos.IdDe(turno) is not long tu) { Msg.Aviso(j, "Selecione o turno que será aberto o terminal."); return; }
            if (Campos.IdDe(term) is not long te) { Msg.Aviso(j, "Selecione um terminal para abrir."); return; }
            if (Fmt.Centavos(sup.Text) is not long v) { Msg.Aviso(j, "Valor inválido."); return; }
            var r = await Api.Post("/api/office/caixa/abrir", new { turnoId = tu, terminalId = te, inicialCentavos = v });
            Msg.Info(j, r.S("mensagem"));
            ok = true; j.Close();
        }), true));
        j.ShowDialog(dono);
        return ok;
    }

    public static void Terminal(FormPrincipal f) => Seguro.Rodar(f, async () =>
    {
        var c = (await Api.Get("/api/office/caixa")).AsObject();
        if (c["aberto"] is not JsonObject ab) { if (Abrir(f, c)) f.Recarregar(); return; }
        var s = c["sumario"];
        using var j = new Janela("Terminal", 440, 520);
        var t = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, Padding = new Padding(12), AutoScroll = true };
        t.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 60)); t.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 40));
        void Linha(string r, string v, Color? cor = null, float tam = 12F) { t.Controls.Add(new Label { Text = r, AutoSize = true, Margin = new Padding(3, 6, 3, 2) }); t.Controls.Add(new Label { Text = v, AutoSize = true, Font = new Font("Segoe UI", tam, FontStyle.Bold), ForeColor = cor ?? Color.Black, Anchor = AnchorStyles.Right }); }
        Linha("Usuário:", Sessao.Nome, null, 11F); Linha("Terminal:", ab.S("terminal"), null, 11F); Linha("Abertura:", Fmt.DmyHm(ab.S("abertoEm")), null, 11F);
        t.Controls.Add(new Label { Text = "Sumário", Font = Tema.Negrito, AutoSize = true, Margin = new Padding(3, 12, 3, 2) }); t.Controls.Add(new Label());
        foreach (var (r, k) in new[] { ("Total de Início do Turno:", "inicial"), ("Total de Suprimento:", "suprimento"), ("Total de Sangria:", "sangria"), ("Total de Vendas de Produtos:", "vendasProdutos"),
            ("Total de Vendas:", "vendas"), ("Total de Desconto Fornecido:", "desconto"), ("Total de Acréscimos:", "acrescimos"), ("Total Recebido:", "recebido"), ("Total de Troco Fornecido:", "troco"), ("Total Cancelado:", "cancelado") })
            Linha(r, Fmt.Brl(s.L(k)));
        Linha("Total Final:", Fmt.Brl(s.L("final")), Tema.Verde);
        Linha("Dinheiro em caixa (gaveta):", Fmt.Brl(s.L("dinheiroEmCaixa")), Tema.Cinza, 10F);
        var prox = new TextBox { Text = "0", Width = 120 };
        var gerar = new Button { Text = "Gerar Relatório", AutoSize = true };
        gerar.Click += (_, _) => Relatorio.Abrir(f, Api.UrlComToken("/relatorio/fechamento?mov=" + ab.S("id")), "Fechamento de Caixa");
        t.Controls.Add(new Label()); t.Controls.Add(gerar);
        t.Controls.Add(new Label { Text = "Valor para o Próximo Turno:", AutoSize = true, Margin = new Padding(3, 8, 3, 2) }); t.Controls.Add(prox);
        j.Controls.Add(t);
        j.Rodape(("Cancelar", (_, _) => j.Close(), false), ("Fechar Terminal", (_, _) => Seguro.Rodar(j, async () =>
        {
            if (Fmt.Centavos(prox.Text) is not long v) { Msg.Aviso(j, "Valor inválido."); return; }
            if (!Msg.Pergunta(j, "Deseja fechar o terminal?")) return;
            var r = await Api.Post("/api/office/caixa/fechar", new { proximoTurnoCentavos = v });
            Msg.Info(j, r.S("mensagem"));
            j.Close();
            Relatorio.Abrir(f, Api.UrlComToken("/relatorio/fechamento?mov=" + r.S("id")), "Fechamento de Caixa");
        }), false));
        j.ShowDialog(f);
    });

    public static void Transacao(Form f, string tipo) => Seguro.Rodar(f, async () =>
    {
        var c = await Garantir(f);
        if (c == null) return;
        var ab = c["aberto"];
        using var j = new Janela(tipo == "sangria" ? "Registrar Sangria" : "Registrar Suprimento", 320, 330);
        var t = new TableLayoutPanel { Dock = DockStyle.Top, ColumnCount = 2, Padding = new Padding(10), AutoSize = true };
        t.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 110)); t.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        void L(string r, string v, Color? cor = null) { t.Controls.Add(new Label { Text = r, AutoSize = true, Margin = new Padding(3, 7, 3, 3) }); t.Controls.Add(new Label { Text = v, AutoSize = true, Font = new Font("Segoe UI", 13F, FontStyle.Bold), ForeColor = cor ?? Color.Black }); }
        L("Usuário:", Sessao.Nome); L("Terminal ativo:", ab.S("terminal")); L("Quantia em caixa:", Fmt.Brl(c["sumario"].L("dinheiroEmCaixa")), Tema.Verde);
        var gb = new GroupBox { Text = "Nova Transação", Dock = DockStyle.Fill, Padding = new Padding(8) };
        var valor = new TextBox { Dock = DockStyle.Top };
        var obs = new TextBox { Multiline = true, Dock = DockStyle.Fill };
        gb.Controls.Add(obs); gb.Controls.Add(new Label { Text = "Observações:", Dock = DockStyle.Top, Height = 20 }); gb.Controls.Add(valor); gb.Controls.Add(new Label { Text = "Valor (R$):", Dock = DockStyle.Top, Height = 18 });
        j.Controls.Add(new Panel { Dock = DockStyle.Fill, Padding = new Padding(10, 0, 10, 0), Controls = { gb } });
        j.Controls.Add(t);
        j.Rodape(("Cancelar", (_, _) => j.Close(), false), ("Registrar Transação", (_, _) => Seguro.Rodar(j, async () =>
        {
            if (Fmt.Centavos(valor.Text) is not long v || v <= 0) { Msg.Aviso(j, "Informe o valor."); return; }
            if (string.IsNullOrWhiteSpace(obs.Text)) { Msg.Aviso(j, "Informe a justificativa desta transação.", "Aviso"); return; }
            var r = await Api.Post("/api/office/caixa/transacao", new { tipo, valorCentavos = v, observacao = obs.Text.Trim() });
            Msg.Info(j, r.S("mensagem"));
            j.Close();
        }), true));
        j.Shown += (_, _) => valor.Focus();
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
public class FormCheckout : Janela
{
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

    public FormCheckout(JsonObject terminal, long? bateriaId, List<long> reservaIds, long? clienteId)
        : base(reservaIds.Count > 0 ? "Aprovar Reserva" : "Receita Avulsa", 1340, 700, true)
    {
        WindowState = FormWindowState.Maximized;
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
        _gCar.Carregar(_car.Select(c => new JsonObject { ["id"] = c.K, ["k"] = c.K, ["cliente"] = c.Cliente, ["produto"] = c.Produto, ["qtd"] = c.Qtd, ["unit"] = c.Unit, ["descPct"] = c.DescPct.ToString("0.##"), ["desc"] = c.Desc, ["acrPct"] = c.AcrPct.ToString("0.##"), ["acr"] = c.Acr }));
        _gPag.Carregar(_pags.Select((p, i) => new JsonObject { ["id"] = i, ["i"] = i, ["forma"] = p.nome, ["valor"] = p.valor }));
        var t = Totais();
        _tot["tot"].Text = Fmt.Dinheiro(t.tot); _tot["des"].Text = Fmt.Dinheiro(t.des); _tot["acr"].Text = Fmt.Dinheiro(t.acr);
        _tot["sub"].Text = Fmt.Dinheiro(t.sub); _tot["rec"].Text = Fmt.Dinheiro(t.rec); _tot["tro"].Text = Fmt.Dinheiro(t.troco);
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
    public FormVenda(long id) : base("Visualizar Métodos de Pagamento", 780, 480)
    {
        var info = new Label { Dock = DockStyle.Top, Height = 44, Padding = new Padding(4) };
        var gi = new Grade(); gi.Colunas(new("item", "Item", TipoCol.Inteiro, 50), new("descricao", "Descrição", Largura: 280), new("quantidade", "Qtde", TipoCol.Inteiro, 50), new("unitario", "Unitário", TipoCol.Dinheiro),
            new("desconto", "Desconto", TipoCol.Dinheiro), new("liquido", "Líquido", TipoCol.Dinheiro), new("estornado", "Estornado", TipoCol.Bool));
        var gp = new Grade(); gp.Colunas(new("forma", "Método de Pagamento", Largura: 300), new("valor", "Valor (R$)", TipoCol.Dinheiro));
        var rodapeInfo = new Label { Dock = DockStyle.Bottom, Height = 24, Font = Tema.Negrito };
        var split = new SplitContainer { Dock = DockStyle.Fill, Orientation = Orientation.Horizontal, SplitterDistance = 220 };
        split.Panel1.Controls.Add(gi); split.Panel2.Controls.Add(gp);
        Controls.Add(new Panel { Dock = DockStyle.Fill, Padding = new Padding(8), Controls = { split, rodapeInfo, info } });
        Rodape(("Imprimir Comprovante", (_, _) => Relatorio.Abrir(this, Sessao.Api.UrlComToken("/relatorio/venda?id=" + id), "Comprovante"), false), ("Fechar", (_, _) => Close(), true));
        Load += (_, _) => Seguro.Rodar(this, async () =>
        {
            var v = await Sessao.Api.Get($"/api/office/vendas/{id}");
            info.Text = $"Venda nº {v.S("codigo")} · {Fmt.DmyHm(v.S("dataHora"))} · {v.S("terminal")} · {v.S("usuario")}\nCliente: {v.S("cliente")}";
            gi.Carregar(((JsonArray)v["itens"]).OfType<JsonObject>());
            gp.Carregar(((JsonArray)v["pagamentos"]).OfType<JsonObject>());
            rodapeInfo.Text = $"Total {Fmt.Brl(v.L("final"))} · Recebido {Fmt.Brl(v.L("recebido"))} · Troco {Fmt.Brl(v.L("troco"))} · Estornos {Fmt.Brl(v.L("estorno"))}";
        });
    }
}

public class FormEstorno : Janela
{
    public FormEstorno(long id) : base("Estornar Pagamento", 780, 440)
    {
        var info = new Label { Dock = DockStyle.Top, Height = 58, Padding = new Padding(4) };
        var g = new Grade(true);
        g.Colunas(new("descricao", "Item", Largura: 360), new("quantidade", "Qtde", TipoCol.Inteiro, 60), new("liquido", "Total Líquido", TipoCol.Dinheiro, 110));
        var motivo = Campos.Texto(400);
        var gm = Campos.Grade(1); Campos.Add(gm, "Motivo", motivo);
        gm.Dock = DockStyle.Bottom;
        Controls.Add(new Panel { Dock = DockStyle.Fill, Padding = new Padding(8), Controls = { g, gm, new Label { Text = "Detalhes — marque os itens a estornar", Dock = DockStyle.Top, Height = 20, Font = Tema.Negrito }, info } });
        Rodape(("Cancelar", (_, _) => Close(), false), ("Estornar", (_, _) => Seguro.Rodar(this, async () =>
        {
            var sel = g.Marcados;
            if (sel.Count == 0) { Msg.Aviso(this, "Selecione os itens a estornar."); return; }
            if (string.IsNullOrWhiteSpace(motivo.Text)) { Msg.Aviso(this, "Informe o motivo do estorno."); return; }
            if (!Msg.Pergunta(this, "Tem certeza que deseja estornar os produtos selecionados?")) return;
            var r = await Sessao.Api.Post($"/api/office/vendas/{id}/estorno", new { itemIds = sel.Select(i => i.L("id")).ToArray(), motivo = motivo.Text.Trim() });
            Msg.Info(this, $"Estorno de {Fmt.Brl(r.L("estornado"))} registrado. Devolva o valor ao cliente pela mesma forma de pagamento.");
            DialogResult = DialogResult.OK; Close();
        }), false));
        Load += (_, _) => Seguro.Rodar(this, async () =>
        {
            var v = await Sessao.Api.Get($"/api/office/vendas/{id}");
            info.Text = $"Cliente: {v.S("cliente")}    Data da Venda: {Fmt.DmyHm(v.S("dataHora"))}    Terminal: {v.S("terminal")}\nTotal Recebido: {Fmt.Brl(v.L("recebido"))}    Descontos: {Fmt.Brl(v.L("desconto"))}    Troco: {Fmt.Brl(v.L("troco"))}";
            g.Carregar(((JsonArray)v["itens"]).OfType<JsonObject>().Where(i => !i.B("estornado")));
        });
    }
}
