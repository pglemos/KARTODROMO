using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

/// <summary>"Registro de Cliente" (REC-003): navegacao, incluir/editar/excluir, abas Principal e Financeiro.</summary>
public class FormCliente : Janela
{
    static Api Api => Sessao.Api;
    JsonObject _atual;
    string _modo = "ver";
    readonly bool _soNovo;
    public long? CriadoId { get; private set; }

    readonly ComboBox _tipoPessoa = Campos.Combo("Pessoa Física", "Pessoa Jurídica");
    readonly ComboBox _tipoDoc = Campos.Combo("CPF", "RG", "PASSAPORTE", "OUTRO");
    readonly TextBox _doc = Campos.Texto(40), _cep = Campos.Texto(10), _end = Campos.Texto(200), _nome = Campos.Texto(200), _num = Campos.Texto(20),
        _compl = Campos.Texto(100), _bairro = Campos.Texto(100), _email = Campos.Texto(200), _cidade = Campos.Texto(100), _uf = Campos.Texto(2),
        _peso = Campos.Texto(6), _fone = Campos.Texto(40), _resp = new() { ReadOnly = true }, _obs = Campos.Texto(400);
    readonly ComboBox _tipoCli = Campos.Combo("Consumidor Final");
    readonly ComboBox _sexo = Campos.Combo("Não Informado", "Masculino", "Feminino");
    readonly MaskedTextBox _nasc = new() { Mask = "00/00/0000", ValidatingType = typeof(DateTime) };
    readonly CheckBox _bloq = Campos.Check("Bloqueado"), _lgpd = Campos.Check("Concordo com os termos de uso dos meus dados");
    long? _respId;
    readonly Label _id = new() { Text = "0", AutoSize = true, Font = Tema.Negrito };
    readonly Label _pos = new() { AutoSize = true, ForeColor = Tema.Cinza, Anchor = AnchorStyles.Right };
    readonly Label _status = new() { AutoSize = true, ForeColor = Tema.Cinza, Font = Tema.Negrito };
    readonly Grade _hist = new();
    readonly Label _fin = new() { Dock = DockStyle.Top, Height = 44, Padding = new Padding(4) };
    readonly Dictionary<string, Control> _bt = [];
    readonly Panel _principal = new() { Dock = DockStyle.Fill, BackColor = KitVisual.Fundo };
    readonly Panel _financeiro = new() { Dock = DockStyle.Fill, BackColor = KitVisual.Fundo, Visible = false };

    public FormCliente(long? id, bool soNovo = false, string preenche = null) : base("Registro de Cliente", 1080, 720)
    {
        _soNovo = soNovo;
        ShowInTaskbar = !soNovo;
        Campos.Mascara(_fone, Fmt.MascaraFone);
        Campos.Mascara(_cep, Fmt.MascaraCep);
        Campos.Mascara(_doc, s => _tipoDoc.Text == "CPF" ? Fmt.MascaraCpf(s) : s);

        // ---- barra de ações em grupos (Pesquisar | Incluir Editar Excluir | Salvar Cancelar | « ‹ › »)
        var barra = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 46, Padding = new Padding(0, 4, 0, 4), WrapContents = false, BackColor = KitVisual.Fundo };
        FlowLayoutPanel Grupo()
        {
            var g = new FlowLayoutPanel { AutoSize = true, WrapContents = false, Padding = new Padding(2), Margin = new Padding(0, 0, 8, 0), BackColor = Color.FromArgb(232, 232, 236) };
            g.Resize += (_, _) => KitVisual.AplicarRaio(g, 9);
            barra.Controls.Add(g);
            return g;
        }
        Button B(FlowLayoutPanel g, string k, string t, Action a, bool principal = false, bool perigo = false)
        {
            var b = new Button
            {
                Text = t, AutoSize = true, MinimumSize = new Size(0, 30), Height = 30, FlatStyle = FlatStyle.Flat, Margin = new Padding(1), Padding = new Padding(8, 0, 8, 0),
                BackColor = principal ? KitVisual.Verde : Color.FromArgb(232, 232, 236), ForeColor = principal ? Color.White : perigo ? Color.FromArgb(196, 40, 28) : KitVisual.Texto,
                Font = new Font("Segoe UI", 9.3F, principal ? FontStyle.Bold : FontStyle.Regular), Cursor = Cursors.Hand, TabStop = false,
            };
            b.FlatAppearance.BorderSize = 0;
            b.FlatAppearance.MouseOverBackColor = principal ? Color.FromArgb(9, 104, 71) : Color.White;
            b.Click += (_, _) => a();
            b.Resize += (_, _) => KitVisual.AplicarRaio(b, 7);
            g.Controls.Add(b); _bt[k] = b;
            return b;
        }
        var g1 = Grupo(); B(g1, "pesq", "Pesquisar  F3", Pesquisar);
        var g2 = Grupo(); B(g2, "novo", "+ Incluir", Novo); B(g2, "edit", "Editar", () => SetModo("edit")); B(g2, "del", "Excluir", Excluir, perigo: true);
        var g3 = Grupo(); B(g3, "save", "Salvar", Salvar, principal: true); B(g3, "canc", "Cancelar", Cancelar);
        var g4 = Grupo(); B(g4, "first", "«", () => Navegar("first")); B(g4, "prev", "‹", () => Navegar("prev")); B(g4, "next", "›", () => Navegar("next")); B(g4, "last", "»", () => Navegar("last"));
        _status.Font = new Font("Segoe UI", 8.8F, FontStyle.Bold);
        _status.Margin = new Padding(6, 9, 0, 0);
        _status.Padding = new Padding(8, 3, 8, 3);
        barra.Controls.Add(_status);

        // ---- abas segmentadas + id
        var abasBar = new Panel { Dock = DockStyle.Top, Height = 40, BackColor = KitVisual.Fundo };
        var seg = new FlowLayoutPanel { AutoSize = true, WrapContents = false, Padding = new Padding(2), BackColor = Color.FromArgb(232, 232, 236), Location = new Point(0, 4) };
        seg.Resize += (_, _) => KitVisual.AplicarRaio(seg, 9);
        Button Aba(string t)
        {
            var b = new Button { Text = t, AutoSize = true, MinimumSize = new Size(96, 28), Height = 28, FlatStyle = FlatStyle.Flat, Margin = new Padding(1), Font = new Font("Segoe UI", 9.3F), Cursor = Cursors.Hand, TabStop = false };
            b.FlatAppearance.BorderSize = 0;
            b.Resize += (_, _) => KitVisual.AplicarRaio(b, 7);
            seg.Controls.Add(b);
            return b;
        }
        var aP = Aba("Principal"); var aF = Aba("Financeiro");
        void Selecionar(bool principal)
        {
            _principal.Visible = principal; _financeiro.Visible = !principal;
            foreach (var (b, sel) in new[] { (aP, principal), (aF, !principal) })
            { b.BackColor = sel ? Color.White : Color.FromArgb(232, 232, 236); b.Font = new Font("Segoe UI", 9.3F, sel ? FontStyle.Bold : FontStyle.Regular); }
        }
        aP.Click += (_, _) => Selecionar(true); aF.Click += (_, _) => Selecionar(false);
        Selecionar(true);
        var idTxt = new Label { AutoSize = true, Font = new Font("Cascadia Mono", 8.8F), ForeColor = KitVisual.Secundario, Location = new Point(230, 11) };
        _id.TextChanged += (_, _) => idTxt.Text = _id.Text == "0" ? "Id será gerado ao salvar" : "Id " + _id.Text;
        _pos.AutoSize = true; _pos.ForeColor = KitVisual.Secundario; _pos.Font = new Font("Segoe UI", 8.8F);
        abasBar.Controls.AddRange([seg, idTxt, _pos]);
        abasBar.Resize += (_, _) => _pos.Location = new Point(abasBar.Width - _pos.Width - 4, 11);

        // ---- Principal: 2 colunas de cartões
        var bCep = KitVisual.Botao("Buscar CEP"); bCep.Font = new Font("Segoe UI", 8.8F, FontStyle.Bold);
        bCep.BackColor = KitVisual.VerdeClaro; bCep.ForeColor = KitVisual.Verde; bCep.Click += (_, _) => BuscarCep();
        var ident = Grade6(
            (F("Tipo de pessoa", _tipoPessoa), 2), (F("Tipo de documento", _tipoDoc), 2), (F("Tipo de cliente", _tipoCli), 2),
            (F("Nº do documento *", _doc), 3), (F("Sexo", _sexo), 3),
            (F("Nome completo *", _nome), 6),
            (F("E-mail", _email), 3), (F("Telefone (WhatsApp)", _fone), 3),
            (F("Aniversário", _nasc), 2), (F("Peso (kg)", _peso), 2), (F("País", new TextBox { Text = "Brasil", ReadOnly = true }), 2));
        var bResp = KitVisual.Botao("Pesquisar"); bResp.Click += (_, _) => { if (_modo == "ver") return; var c = FormPesquisarCliente.Escolher(this, "Selecionar responsável"); if (c != null) { _respId = c.L("id"); _resp.Text = c.S("nome"); } };
        var bRespX = KitVisual.Botao("Remover"); bRespX.Click += (_, _) => { if (_modo == "ver") return; _respId = null; _resp.Text = ""; };
        _resp.PlaceholderText = "Só para menores de idade — o responsável assina o termo";
        var respLinha = new TableLayoutPanel { Dock = DockStyle.Top, Height = 46, ColumnCount = 3, BackColor = KitVisual.Cartao };
        respLinha.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); respLinha.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize)); respLinha.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        respLinha.Controls.Add(Caixa(_resp), 0, 0); respLinha.Controls.Add(bResp, 1, 0); respLinha.Controls.Add(bRespX, 2, 0);
        var ender = Grade6(
            (F("CEP", _cep), 2), (Envolver(bCep), 2), (F("Estado", _uf), 2),
            (F("Endereço", _end), 4), (F("Nº", _num), 2),
            (F("Complemento", _compl), 3), (F("Bairro", _bairro), 3),
            (F("Cidade", _cidade), 6));
        var dica = new Label { Text = "Digite o CEP e toque em Buscar CEP para preencher o endereço.", Dock = DockStyle.Top, Height = 20, ForeColor = KitVisual.Secundario, Font = new Font("Segoe UI", 8.5F) };
        _lgpd.Text = "Concorda com o uso dos dados (LGPD) — obrigatório para correr";
        _bloq.Text = "Cliente bloqueado — impede novas reservas e alerta no totem";
        foreach (var ck in new[] { _lgpd, _bloq }) { ck.Font = new Font("Segoe UI", 9.3F); ck.Dock = DockStyle.Top; ck.Height = 30; ck.AutoSize = false; }
        var situacao = new Panel { Dock = DockStyle.Top, Height = 122, BackColor = KitVisual.Cartao };
        var obs = F("Observação", _obs); obs.Dock = DockStyle.Top;
        situacao.Controls.Add(obs); situacao.Controls.Add(_bloq); situacao.Controls.Add(_lgpd);

        var cols = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1, BackColor = KitVisual.Fundo, Padding = new Padding(0, 6, 0, 0) };
        cols.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 54)); cols.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 46));
        var esq = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoScroll = true, BackColor = KitVisual.Fundo, Margin = new Padding(0, 0, 8, 0) };
        var dir = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoScroll = true, BackColor = KitVisual.Fundo, Margin = new Padding(8, 0, 0, 0) };
        esq.Controls.Add(Secao("Identificação", ident)); esq.Controls.Add(Secao("Responsável", respLinha));
        dir.Controls.Add(Secao("Endereço", ender, dica)); dir.Controls.Add(Secao("Situação", situacao));
        void Largura(FlowLayoutPanel f) { var w = f.ClientSize.Width - (f.VerticalScroll.Visible ? SystemInformation.VerticalScrollBarWidth : 0) - 2; foreach (Control c in f.Controls) if (w > 100 && c.Width != w) c.Width = w; }
        esq.SizeChanged += (_, _) => Largura(esq); dir.SizeChanged += (_, _) => Largura(dir);
        Shown += (_, _) => { Largura(esq); Largura(dir); };
        cols.Controls.Add(esq, 0, 0); cols.Controls.Add(dir, 1, 0);
        _principal.Controls.Add(cols);

        // ---- Financeiro
        _hist.Colunas(new("dataHora", "Data/Hora", TipoCol.DataHora), new("bateria", "Bateria", Largura: 140), new("produto", "Produto", Largura: 220), new("valor", "Valor", TipoCol.Dinheiro), new("pago", "Pago", TipoCol.Bool), new("status", "Situação"));
        KitVisual.EstilizarGrade(_hist);
        _fin.Font = new Font("Segoe UI", 10F, FontStyle.Bold); _fin.ForeColor = KitVisual.Texto; _fin.Height = 52;
        var cartFin = new Panel { Dock = DockStyle.Fill, BackColor = KitVisual.Cartao, Padding = new Padding(16, 12, 16, 12) };
        _hist.Dock = DockStyle.Fill;
        cartFin.Controls.Add(_hist); cartFin.Controls.Add(_fin);
        cartFin.Resize += (_, _) => KitVisual.AplicarRaio(cartFin, 13);
        _financeiro.Padding = new Padding(0, 6, 0, 0);
        _financeiro.Controls.Add(cartFin);

        // ---- rodapé
        var rodape = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 52, FlowDirection = FlowDirection.RightToLeft, Padding = new Padding(0, 10, 0, 0), BackColor = KitVisual.Fundo };
        var salvar = KitVisual.Botao("Salvar cliente", true, 140); salvar.Click += (_, _) => Salvar();
        var cancelar = KitVisual.Botao("Cancelar", false, 100); cancelar.Click += (_, _) => Cancelar();
        var atalhos = new Label { Text = "Enter salva · Esc cancela · F3 pesquisa", AutoSize = true, ForeColor = KitVisual.Secundario, Margin = new Padding(0, 10, 16, 0) };
        rodape.Controls.Add(salvar); rodape.Controls.Add(cancelar); rodape.Controls.Add(atalhos);
        _bt["save2"] = salvar;

        var meio = new Panel { Dock = DockStyle.Fill, BackColor = KitVisual.Fundo };
        meio.Controls.Add(_principal); meio.Controls.Add(_financeiro);
        Controls.Add(meio);
        Controls.Add(rodape);
        Controls.Add(abasBar);
        Controls.Add(barra);
        KeyDown += (_, e) =>
        {
            if (e.KeyCode == Keys.F3) { e.Handled = true; Pesquisar(); }
            else if (e.KeyCode == Keys.Enter && _modo != "ver" && ActiveControl is not TextBox { Multiline: true }) { e.Handled = true; e.SuppressKeyPress = true; Salvar(); }
        };

        Load += async (_, _) =>
        {
            if (soNovo) { Novo(); Preencher(preenche); return; }
            SetModo("ver");
            if (id != null) await Mostrar(id.Value); else Navegar("last");
        };
    }

    // ---------- blocos visuais do design (Cliente.dc.html)
    static System.Drawing.Drawing2D.GraphicsPath Arredondado(Rectangle r, int raio)
    {
        var d = raio * 2;
        var gp = new System.Drawing.Drawing2D.GraphicsPath();
        gp.AddArc(r.Left, r.Top, d, d, 180, 90); gp.AddArc(r.Right - d, r.Top, d, d, 270, 90); gp.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90); gp.AddArc(r.Left, r.Bottom - d, d, d, 90, 90);
        gp.CloseFigure();
        return gp;
    }

    internal static Panel Caixa(Control c)
    {
        var box = new Panel { Dock = DockStyle.Fill, Height = 34, BackColor = KitVisual.Cartao, Padding = new Padding(9, 8, 9, 4), Margin = new Padding(0, 4, 6, 4) };
        if (c is TextBoxBase t) { t.BorderStyle = BorderStyle.None; t.Font = new Font("Segoe UI", 10F); }
        if (c is ComboBox cb) { cb.FlatStyle = FlatStyle.Flat; cb.Font = new Font("Segoe UI", 9.5F); box.Padding = new Padding(4, 4, 4, 2); }
        c.Dock = DockStyle.Fill;
        box.Controls.Add(c);
        box.Paint += (_, e) =>
        {
            e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            using var gp = Arredondado(new Rectangle(0, 0, box.Width - 1, box.Height - 1), 7);
            var foco = box.ContainsFocus;
            using var pen = new Pen(foco ? KitVisual.Verde : Color.FromArgb(205, 205, 211), foco ? 2 : 1);
            e.Graphics.DrawPath(pen, gp);
        };
        c.GotFocus += (_, _) => box.Invalidate(); c.LostFocus += (_, _) => box.Invalidate();
        return box;
    }

    static Panel F(string rotulo, Control c)
    {
        var p = new Panel { Height = 58, BackColor = KitVisual.Cartao, Margin = new Padding(0, 0, 10, 6), Dock = DockStyle.Fill };
        p.Controls.Add(Caixa(c));
        p.Controls.Add(new Label { Text = rotulo, Dock = DockStyle.Top, Height = 18, ForeColor = KitVisual.Secundario, Font = new Font("Segoe UI", 8.4F, FontStyle.Bold), BackColor = KitVisual.Cartao });
        return p;
    }

    static Panel Envolver(Control c)
    {
        var p = new Panel { Height = 58, BackColor = KitVisual.Cartao, Margin = new Padding(0, 0, 10, 6), Dock = DockStyle.Fill, Padding = new Padding(0, 20, 0, 4) };
        c.Dock = DockStyle.Fill; p.Controls.Add(c);
        return p;
    }

    static TableLayoutPanel Grade6(params (Control c, int span)[] itens)
    {
        var t = new TableLayoutPanel { ColumnCount = 6, Dock = DockStyle.Top, BackColor = KitVisual.Cartao };
        for (var i = 0; i < 6; i++) t.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f / 6));
        int col = 0, row = 0;
        foreach (var (c, span) in itens)
        {
            if (col + span > 6) { col = 0; row++; }
            t.Controls.Add(c, col, row);
            t.SetColumnSpan(c, span);
            col += span;
        }
        t.RowCount = row + 1;
        for (var i = 0; i <= row; i++) t.RowStyles.Add(new RowStyle(SizeType.Absolute, 64));
        t.Height = (row + 1) * 64;
        return t;
    }

    static Panel Secao(string titulo, Control conteudo, Control extra = null)
    {
        var p = new Panel { BackColor = KitVisual.Cartao, Padding = new Padding(16, 8, 6, 8), Margin = new Padding(0, 0, 0, 10), Width = 400 };
        p.Height = 8 + 28 + conteudo.Height + (extra?.Height ?? 0) + 10;
        conteudo.Dock = DockStyle.Top;
        if (extra != null) { extra.Dock = DockStyle.Top; p.Controls.Add(extra); }
        p.Controls.Add(conteudo);
        p.Controls.Add(new Label { Text = titulo, Dock = DockStyle.Top, Height = 28, Font = new Font("Segoe UI", 10.5F, FontStyle.Bold), ForeColor = KitVisual.Texto });
        p.Paint += (_, e) =>
        {
            e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            using var gp = Arredondado(new Rectangle(0, 0, p.Width - 1, p.Height - 1), 13);
            using var pen = new Pen(Color.FromArgb(232, 232, 236));
            e.Graphics.DrawPath(pen, gp);
        };
        p.Resize += (_, _) => KitVisual.AplicarRaio(p, 13);
        return p;
    }

    void Preencher(string q)
    {
        if (string.IsNullOrWhiteSpace(q)) return;
        if (Fmt.Digitos(q).Length >= 5 && !q.Any(char.IsLetter)) _doc.Text = q;
        else if (q.Contains('@')) _email.Text = q;
        else _nome.Text = q;
    }

    void SetModo(string m)
    {
        _modo = m;
        _status.Text = m == "novo" ? "Incluindo" : m == "edit" ? "Editando" : "";
        var ro = m == "ver";
        foreach (var c in new Control[] { _tipoPessoa, _tipoDoc, _doc, _cep, _end, _tipoCli, _nome, _num, _compl, _bairro, _sexo, _email, _cidade, _uf, _peso, _nasc, _fone, _bloq, _lgpd, _obs })
        {
            if (c is TextBoxBase t) t.ReadOnly = ro; else c.Enabled = !ro;
        }
        _bt["save"].Enabled = _bt["canc"].Enabled = _bt["save2"].Enabled = !ro;
        // botão verde desabilitado fica apagado (só consultando não há o que salvar)
        foreach (var k in new[] { "save", "save2" }) { _bt[k].BackColor = ro ? Color.FromArgb(196, 222, 210) : KitVisual.Verde; _bt[k].ForeColor = Color.White; }
        _status.BackColor = m == "novo" ? Color.FromArgb(225, 238, 255) : m == "edit" ? Color.FromArgb(255, 240, 214) : KitVisual.Fundo;
        _status.ForeColor = m == "novo" ? Color.FromArgb(10, 79, 160) : Color.FromArgb(138, 75, 0);
        foreach (var k in new[] { "pesq", "novo", "edit", "del", "first", "prev", "next", "last" }) _bt[k].Enabled = ro && (!_soNovo);
    }

    async Task Mostrar(long id)
    {
        var c = await Api.Get($"/api/office/clientes/{id}");
        _atual = c.AsObject();
        _tipoPessoa.SelectedIndex = 0;
        _tipoDoc.SelectedItem = _tipoDoc.Items.Contains(c.S("tipoDocumento")) ? c.S("tipoDocumento") : "CPF";
        _doc.Text = c.S("documento"); _cep.Text = c.S("cep"); _end.Text = c.S("endereco"); _nome.Text = c.S("nome"); _num.Text = c.S("numero");
        _compl.Text = c.S("complemento"); _bairro.Text = c.S("bairro"); _email.Text = c.S("email"); _cidade.Text = c.S("cidade"); _uf.Text = c.S("estado");
        _peso.Text = c.S("peso"); _fone.Text = c.S("telefone"); _obs.Text = c.S("observacao");
        _sexo.SelectedIndex = c.S("sexo") == "M" ? 1 : c.S("sexo") == "F" ? 2 : 0;
        _nasc.Text = Fmt.Dmy(c.S("nascimento"));
        _bloq.Checked = c.B("bloqueado"); _lgpd.Checked = !string.IsNullOrEmpty(c.S("lgpdAceiteEm"));
        _respId = c.L("responsavelId"); _resp.Text = c.S("responsavelNome");
        _id.Text = c.S("id");
        _pos.Text = $"Registro {c.S("posicao")} de {c.S("totalRegistros")} · origem {c.S("origem")} · desde {Fmt.Dmy(c.S("criadoEm"))}";
        var f = c["financeiro"];
        var deps = c["dependentes"] is JsonArray d && d.Count > 0 ? "\nDependentes: " + string.Join(", ", d.Select(x => x.S("nome"))) : "";
        _fin.Text = $"Compras: {f.S("vendas")} · Total: {Fmt.Brl(f.L("total"))} · Última: {Fmt.DmyHm(f.S("ultima"))}{deps}";
        _hist.Carregar(c["historico"] is JsonArray h ? h.OfType<JsonObject>() : []);
        SetModo("ver");
    }

    void Navegar(string dir) => Seguro.Rodar(this, async () =>
    {
        var r = await Api.Get($"/api/office/clientes/nav?dir={dir}&id={_atual?.S("id") ?? "0"}");
        if (r?.L("id") is long id) await Mostrar(id);
    });

    void Pesquisar()
    {
        var c = FormPesquisarCliente.Escolher(this);
        if (c != null) Seguro.Rodar(this, () => Mostrar(c.L("id") ?? 0));
    }

    void Novo()
    {
        _atual = null;
        foreach (var t in new[] { _doc, _cep, _end, _nome, _num, _compl, _bairro, _email, _cidade, _uf, _peso, _fone, _resp, _obs }) t.Text = "";
        _nasc.Text = ""; _sexo.SelectedIndex = 0; _tipoDoc.SelectedIndex = 0; _bloq.Checked = false; _lgpd.Checked = true; _respId = null;
        _id.Text = "0"; _pos.Text = "";
        SetModo("novo");
        _doc.Focus();
    }

    void Cancelar()
    {
        if (_soNovo) { Close(); return; }
        if (_atual != null) Seguro.Rodar(this, () => Mostrar(_atual.L("id") ?? 0)); else SetModo("ver");
    }

    JsonObject Corpo()
    {
        string nascIso = null;
        if (_nasc.MaskCompleted) { nascIso = Fmt.DataBrParaIso(_nasc.Text); if (nascIso == null) throw new ApiException("Data de aniversário inválida.", 400); }
        return new JsonObject
        {
            ["tipoDocumento"] = _tipoDoc.Text, ["documento"] = _doc.Text.Trim(), ["nome"] = _nome.Text.Trim(), ["email"] = _email.Text.Trim(), ["telefone"] = _fone.Text.Trim(),
            ["nascimento"] = nascIso, ["sexo"] = _sexo.SelectedIndex == 1 ? "M" : _sexo.SelectedIndex == 2 ? "F" : null, ["peso"] = _peso.Text.Trim(), ["cep"] = _cep.Text.Trim(),
            ["endereco"] = _end.Text.Trim(), ["numero"] = _num.Text.Trim(), ["complemento"] = _compl.Text.Trim(), ["bairro"] = _bairro.Text.Trim(), ["cidade"] = _cidade.Text.Trim(),
            ["estado"] = _uf.Text.Trim().ToUpperInvariant(), ["responsavelId"] = _respId, ["lgpd"] = _lgpd.Checked, ["bloqueado"] = _bloq.Checked, ["observacao"] = _obs.Text.Trim(),
        };
    }

    void Salvar() => Seguro.Rodar(this, async () =>
    {
        if (string.IsNullOrWhiteSpace(_nome.Text)) { Msg.Aviso(this, "Informe o nome."); return; }
        var body = Corpo();
        if (_modo == "novo")
        {
            var r = await Api.Post("/api/office/clientes", body);
            CriadoId = r.L("id");
            Msg.Info(this, "Operação concluída com sucesso.");
            if (_soNovo) { DialogResult = DialogResult.OK; Close(); return; }
            await Mostrar(CriadoId.Value);
        }
        else
        {
            await Api.Put($"/api/office/clientes/{_atual.S("id")}", body);
            Msg.Info(this, "Operação concluída com sucesso.");
            await Mostrar(_atual.L("id") ?? 0);
        }
    });

    void Excluir() => Seguro.Rodar(this, async () =>
    {
        if (_atual == null || !Msg.Pergunta(this, "Deseja excluir definitivamente o registro atual?")) return;
        await Api.Delete($"/api/office/clientes/{_atual.S("id")}");
        _atual = null;
        Navegar("last");
    });

    async void BuscarCep()
    {
        var cep = Fmt.Digitos(_cep.Text);
        if (cep.Length != 8) { Msg.Aviso(this, "Informe o CEP com 8 dígitos."); return; }
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(8) };
            var r = JsonNode.Parse(await http.GetStringAsync($"https://viacep.com.br/ws/{cep}/json/"));
            if (r?["erro"] != null) { Msg.Aviso(this, "CEP não encontrado."); return; }
            _end.Text = r.S("logradouro"); _bairro.Text = r.S("bairro"); _cidade.Text = r.S("localidade"); _uf.Text = r.S("uf");
        }
        catch { Msg.Aviso(this, "Não foi possível consultar o CEP (sem internet?)."); }
    }

    /// <summary>Cadastro rapido a partir da pesquisa: abre em modo inclusao e devolve o id.</summary>
    public static long? Novo(IWin32Window dono, string preenche = null)
    {
        using var f = new FormCliente(null, true, preenche);
        return f.ShowDialog(dono) == DialogResult.OK ? f.CriadoId : null;
    }
}

public static class Extensoes
{
    public static T Also<T>(this T o, Action<T> a) { a(o); return o; }
}

/// <summary>"Pesquisar Cliente": busca por nome/CPF/telefone/e-mail, devolve o escolhido.</summary>
public class FormPesquisarCliente : Janela
{
    readonly TextBox _q = new();
    readonly RadioButton _auto = new() { Text = "Auto", Checked = true, AutoSize = true }, _nome = new() { Text = "Nome", AutoSize = true },
        _doc = new() { Text = "CPF/Telefone", AutoSize = true }, _email = new() { Text = "E-mail", AutoSize = true };
    readonly Grade _g = new();
    Label _vazio;
    public JsonObject Escolhido { get; private set; }

    FormPesquisarCliente(string titulo, string inicial) : base(titulo, 900, 440, true)
    {
        // busca no topo: caixa grande + "buscar por" em pílulas + botão verde
        var topo = new Panel { Dock = DockStyle.Top, Height = 92, BackColor = KitVisual.Fundo };
        _q.Text = inicial ?? "";
        _q.PlaceholderText = "Nome, CPF, telefone ou e-mail do cliente";
        var busca = FormCliente.Caixa(_q);
        busca.Dock = DockStyle.None; busca.Height = 40; busca.Location = new Point(0, 4);
        var b = KitVisual.Botao("Pesquisar", true, 120);
        b.Click += (_, _) => Buscar();
        _q.KeyDown += (_, e) => { if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; Buscar(); } };
        var filtros = new FlowLayoutPanel { AutoSize = true, WrapContents = false, BackColor = KitVisual.Fundo, Location = new Point(0, 54) };
        filtros.Controls.Add(new Label { Text = "Buscar por", AutoSize = true, ForeColor = KitVisual.Secundario, Font = new Font("Segoe UI", 8.8F, FontStyle.Bold), Margin = new Padding(2, 6, 10, 0) });
        foreach (var r in new[] { _auto, _nome, _doc, _email })
        {
            r.Appearance = Appearance.Button; r.FlatStyle = FlatStyle.Flat; r.FlatAppearance.BorderSize = 0; r.AutoSize = true;
            r.MinimumSize = new Size(70, 28); r.TextAlign = ContentAlignment.MiddleCenter; r.Margin = new Padding(0, 0, 6, 0); r.Padding = new Padding(8, 0, 8, 0);
            r.Font = new Font("Segoe UI", 9F); r.Cursor = Cursors.Hand;
            r.FlatAppearance.CheckedBackColor = KitVisual.Verde;
            void Cor() { r.BackColor = r.Checked ? KitVisual.Verde : Color.FromArgb(232, 232, 236); r.ForeColor = r.Checked ? Color.White : KitVisual.Texto; }
            r.CheckedChanged += (_, _) => Cor(); Cor();
            r.Resize += (_, _) => KitVisual.AplicarRaio(r, 14);
            filtros.Controls.Add(r);
        }
        topo.Controls.AddRange([busca, b, filtros]);
        AcceptButton = b;
        topo.Resize += (_, _) => { b.Location = new Point(topo.ClientSize.Width - b.Width, 7); busca.Width = b.Left - 10; };
        _g.Colunas(new("nome", "Nome", Largura: 250), new("documento", "Documento", Largura: 120), new("telefone", "Telefone", Largura: 120), new("email", "E-mail", Largura: 200),
            new("nascimento", "Nascimento", TipoCol.Data), new("cidade", "Cidade", Largura: 120), new("responsavelNome", "Responsável", Largura: 160), new("bloqueado", "Bloq.", TipoCol.Bool));
        _g.Duplo += r => { Escolhido = r; DialogResult = DialogResult.OK; Close(); };
        var vazio = new Label { Text = "Digite pelo menos 2 letras ou números e tecle Enter.\nDois cliques no cliente para selecionar.", Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleCenter, ForeColor = KitVisual.Secundario, Font = new Font("Segoe UI", 10F), BackColor = KitVisual.Cartao };
        _vazio = vazio;
        var cartao = new Panel { Dock = DockStyle.Fill, Padding = new Padding(12), BackColor = KitVisual.Cartao };
        cartao.Resize += (_, _) => KitVisual.AplicarRaio(cartao, 13);
        _g.Dock = DockStyle.Fill;
        cartao.Controls.Add(_g);
        vazio.Dock = DockStyle.None; vazio.AutoSize = false; vazio.Size = new Size(520, 60); vazio.BackColor = Color.White;
        _g.Controls.Add(vazio);
        _g.Resize += (_, _) => vazio.Location = new Point((_g.ClientSize.Width - vazio.Width) / 2, (_g.ClientSize.Height - vazio.Height) / 2);
        Controls.Add(cartao);
        Controls.Add(topo);
        Rodape(("Novo cliente", (_, _) => Seguro.Rodar(this, async () =>
            {
                var id = FormCliente.Novo(this, _q.Text);
                if (id != null) { Escolhido = (await Sessao.Api.Get($"/api/office/clientes/{id}")).AsObject(); DialogResult = DialogResult.OK; Close(); }
            }), false),
            ("Cancelar", (_, _) => Close(), false),
            ("Selecionar", (_, _) => { if (_g.Atual != null) { Escolhido = _g.Atual; DialogResult = DialogResult.OK; Close(); } }, false));
        Shown += (_, _) => { _q.Focus(); if (!string.IsNullOrWhiteSpace(inicial)) Buscar(); };
    }

    void Buscar() => Seguro.Rodar(this, async () =>
    {
        var q = _q.Text.Trim();
        if (q.Length < 2) return;
        var campo = _nome.Checked ? "nome" : _doc.Checked ? "documento" : _email.Checked ? "email" : "auto";
        var r = await Sessao.Api.Lista($"/api/office/clientes?q={Uri.EscapeDataString(q)}&campo={campo}");
        _g.Carregar(r);
        _vazio.Text = r.Count == 0 ? $"Nenhum cliente encontrado para \"{q}\".\nConfira a grafia ou toque em Novo cliente para cadastrar." : "";
        _vazio.Visible = r.Count == 0;
    });

    public static JsonObject Escolher(IWin32Window dono, string titulo = "Pesquisar Cliente", string inicial = null)
    {
        using var f = new FormPesquisarCliente(titulo, inicial);
        return f.ShowDialog(dono) == DialogResult.OK ? f.Escolhido : null;
    }
}
