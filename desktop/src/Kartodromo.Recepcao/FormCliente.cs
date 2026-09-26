using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

/// <summary>"Registro de Cliente" (REC-003): navegacao, incluir/editar/excluir, abas Principal e Financeiro.</summary>
public class FormCliente : Janela, ISemKit
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
    readonly CheckBox _bloq = new ChaveLiga(), _lgpd = new ChaveLiga();
    readonly ComboBox _tipoSang = Campos.Combo("Não informado", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-");
    readonly ComboBox _pais = Campos.Combo("Brasil", "Argentina", "Paraguai", "Uruguai", "Chile", "Portugal", "Estados Unidos", "Outro");
    readonly TextBox _ibge = Campos.Texto(10);
    readonly Label _sub = new() { AutoSize = true, Font = new Font("Segoe UI", 8.8F), ForeColor = KitVisual.Secundario, BackColor = Color.White, Text = "Os campos com * são obrigatórios" };
    readonly Label _dicaDoc = new() { Height = 22, Dock = DockStyle.Fill, Font = new Font("Segoe UI", 8.3F), ForeColor = KitVisual.Secundario, BackColor = KitVisual.Cartao, Margin = new Padding(2, 0, 10, 0) };
    readonly Label _dicaPeso = new() { Height = 22, Dock = DockStyle.Fill, Font = new Font("Segoe UI", 8.3F), ForeColor = KitVisual.Secundario, BackColor = KitVisual.Cartao, Margin = new Padding(2, 0, 10, 0) };
    readonly ToolTip _dica = new();
    long? _respId;
    readonly Label _id = new() { Text = "0", AutoSize = true, Font = Tema.Negrito };
    readonly Label _pos = new() { AutoSize = true, ForeColor = Tema.Cinza, Anchor = AnchorStyles.Right };
    readonly Label _status = new() { AutoSize = true, ForeColor = Tema.Cinza, Font = Tema.Negrito };
    readonly Grade _hist = new();
    readonly Label _fin = new() { Dock = DockStyle.Top, Height = 44, Padding = new Padding(4) };
    readonly Dictionary<string, Control> _bt = [];
    readonly Panel _principal = new() { Dock = DockStyle.Fill, BackColor = KitVisual.Fundo };
    readonly Panel _financeiro = new() { Dock = DockStyle.Fill, BackColor = KitVisual.Fundo, Visible = false };

    public FormCliente(long? id, bool soNovo = false, string preenche = null) : base("Registro de cliente", 1080, 726)
    {
        _soNovo = soNovo;
        ShowInTaskbar = !soNovo;
        // janela-cartão do design: sem moldura do Windows, cantos arredondados, sombra
        FormBorderStyle = FormBorderStyle.None;
        BackColor = KitVisual.Fundo;
        Font = new Font("Segoe UI", 9.5F);
        ClientSize = new Size(1080, 726);
        Resize += (_, _) => { using var p = VisualPrincipal.Redondo(new Rectangle(0, 0, Width, Height), 18); Region = new Region(p); };
        Campos.Mascara(_fone, Fmt.MascaraFone);
        // combos ficam brancos mesmo só consultando; a troca de valor é que fica bloqueada
        foreach (var cb in new[] { _tipoPessoa, _tipoDoc, _tipoCli, _sexo, _tipoSang, _pais })
        {
            var anterior = -1;
            cb.DropDown += (_, _) => { if (_modo == "ver") BeginInvoke(() => cb.DroppedDown = false); };
            cb.Enter += (_, _) => anterior = cb.SelectedIndex;
            cb.SelectedIndexChanged += (_, _) => { if (_modo == "ver" && cb.Focused && anterior >= 0 && cb.SelectedIndex != anterior) cb.SelectedIndex = anterior; };
            cb.BackColor = Color.White;
        }
        Campos.Mascara(_cep, Fmt.MascaraCep);
        Campos.Mascara(_doc, s => _tipoDoc.Text == "CPF" ? Fmt.MascaraCpf(s) : s);

        // ---- cabeçalho único: ícone · título · selo · ações em ícones (Cliente.dc.html)
        var cab = new Panel { Dock = DockStyle.Top, Height = 66, BackColor = Color.White };
        cab.Paint += (_, e) => { using var pen = new Pen(KitVisual.Linha); e.Graphics.DrawLine(pen, 0, cab.Height - 1, cab.Width, cab.Height - 1); };
        var ico = CartaoModal.Icone("clientes", 54); ico.Location = new Point(10, 6);
        var tit = new Label { Text = "Registro de cliente", AutoSize = true, Font = new Font("Segoe UI", 13F, FontStyle.Bold), Location = new Point(64, 12), BackColor = Color.White };
        _sub.Location = new Point(65, 37);
        _status.Font = new Font("Segoe UI", 8.6F, FontStyle.Bold); _status.Padding = new Padding(8, 3, 8, 3); _status.AutoSize = true;
        tit.SizeChanged += (_, _) => _status.Location = new Point(Math.Max(tit.Right, _sub.Right) + 12, 20);
        _sub.SizeChanged += (_, _) => _status.Location = new Point(Math.Max(tit.Right, _sub.Right) + 12, 20);
        _status.Resize += (_, _) => KitVisual.AplicarRaio(_status, 7);
        var acoes = new FlowLayoutPanel { AutoSize = true, WrapContents = false, FlowDirection = FlowDirection.LeftToRight, BackColor = Color.White, Anchor = AnchorStyles.Top | AnchorStyles.Right };
        FlowLayoutPanel Grupo()
        {
            var g = new FlowLayoutPanel { AutoSize = true, WrapContents = false, Padding = new Padding(2), Margin = new Padding(6, 0, 0, 0), BackColor = Color.FromArgb(242, 242, 245) };
            g.Resize += (_, _) => KitVisual.AplicarRaio(g, 10);
            acoes.Controls.Add(g);
            return g;
        }
        Button Icone(FlowLayoutPanel g, string k, string glifo, string dica, Action a, bool perigo = false)
        {
            var b = new Button { Text = glifo, Size = new Size(34, 32), FlatStyle = FlatStyle.Flat, BackColor = g.BackColor, ForeColor = perigo ? Color.FromArgb(196, 40, 28) : KitVisual.Texto, Font = new Font(glifo.Length == 1 && glifo[0] >= '' ? "Segoe MDL2 Assets" : "Segoe UI", glifo[0] >= '' ? 10F : 11F), Margin = new Padding(0), Cursor = Cursors.Hand, TabStop = false };
            b.FlatAppearance.BorderSize = 0; b.FlatAppearance.MouseOverBackColor = Color.White;
            b.Click += (_, _) => a(); _dica.SetToolTip(b, dica); b.Resize += (_, _) => KitVisual.AplicarRaio(b, 8);
            g.Controls.Add(b); _bt[k] = b; return b;
        }
        var gPesq = Grupo();
        var pesq = new Button { Text = "Pesquisar", Image = Glifo('', KitVisual.Texto), ImageAlign = ContentAlignment.MiddleLeft, TextImageRelation = TextImageRelation.ImageBeforeText, AutoSize = true, Height = 32, MinimumSize = new Size(0, 32), FlatStyle = FlatStyle.Flat, BackColor = gPesq.BackColor, Font = new Font("Segoe UI", 9.5F), Padding = new Padding(8, 0, 10, 0), Margin = new Padding(0), Cursor = Cursors.Hand, TabStop = false };
        pesq.FlatAppearance.BorderSize = 0; pesq.FlatAppearance.MouseOverBackColor = Color.White; pesq.Click += (_, _) => Pesquisar(); _dica.SetToolTip(pesq, "Pesquisar cliente (F3)");
        gPesq.Controls.Add(pesq); _bt["pesq"] = pesq;
        var gCrud = Grupo();
        Icone(gCrud, "novo", "", "Incluir cliente", Novo);
        Icone(gCrud, "edit", "", "Editar cliente", () => SetModo("edit"));
        Icone(gCrud, "del", "", "Excluir cliente", Excluir, perigo: true);
        var gSalvar = Grupo();
        var salvarTopo = new Button { Text = "Salvar", Image = Glifo('', Color.White), TextImageRelation = TextImageRelation.ImageBeforeText, AutoSize = true, Height = 32, MinimumSize = new Size(0, 32), FlatStyle = FlatStyle.Flat, BackColor = KitVisual.Verde, ForeColor = Color.White, Font = new Font("Segoe UI", 9.5F, FontStyle.Bold), Padding = new Padding(8, 0, 10, 0), Margin = new Padding(0), Cursor = Cursors.Hand, TabStop = false };
        salvarTopo.FlatAppearance.BorderSize = 0; salvarTopo.Click += (_, _) => Salvar(); salvarTopo.Resize += (_, _) => KitVisual.AplicarRaio(salvarTopo, 8);
        gSalvar.Controls.Add(salvarTopo); _bt["save"] = salvarTopo;
        Icone(gSalvar, "canc", "", "Cancelar alterações (Esc)", Cancelar);
        var gNav = Grupo();
        Icone(gNav, "first", "«", "Primeiro", () => Navegar("first")); Icone(gNav, "prev", "‹", "Anterior", () => Navegar("prev"));
        Icone(gNav, "next", "›", "Próximo", () => Navegar("next")); Icone(gNav, "last", "»", "Último", () => Navegar("last"));
        var gExtra = Grupo();
        Icone(gExtra, "termo", "", "Imprimir o termo de responsabilidade deste cliente", ImprimirTermo);
        Icone(gExtra, "fechar", "", "Fechar", Close);
        cab.Controls.AddRange([ico, tit, _sub, _status, acoes]);
        cab.Resize += (_, _) => acoes.Location = new Point(cab.ClientSize.Width - acoes.Width - 14, 17);
        acoes.SizeChanged += (_, _) => acoes.Location = new Point(cab.ClientSize.Width - acoes.Width - 14, 17);
        Point? arrasto = null;
        cab.MouseDown += (_, e) => { if (e.Button == MouseButtons.Left) arrasto = e.Location; };
        cab.MouseMove += (_, e) => { if (arrasto is Point o && e.Button == MouseButtons.Left) Location = new Point(Location.X + e.X - o.X, Location.Y + e.Y - o.Y); };
        cab.MouseUp += (_, _) => arrasto = null;

        // ---- abas segmentadas + id
        var abasBar = new Panel { Dock = DockStyle.Top, Height = 44, BackColor = KitVisual.Fundo };
        var seg = new FlowLayoutPanel { AutoSize = true, WrapContents = false, Padding = new Padding(2), BackColor = Color.FromArgb(232, 232, 236), Location = new Point(0, 6) };
        seg.Resize += (_, _) => KitVisual.AplicarRaio(seg, 9);
        Button Aba(string t)
        {
            var b = new Button { Text = t, AutoSize = true, MinimumSize = new Size(86, 28), Height = 28, FlatStyle = FlatStyle.Flat, Margin = new Padding(1), Font = new Font("Segoe UI", 9.3F), Cursor = Cursors.Hand, TabStop = false };
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
        var idTxt = new Label { AutoSize = true, Font = new Font("Cascadia Mono", 8.8F), ForeColor = KitVisual.Secundario, Location = new Point(206, 13) };
        _id.TextChanged += (_, _) => idTxt.Text = _id.Text == "0" ? "Id 0 · será gerado ao salvar" : "Id " + _id.Text;
        _pos.AutoSize = true; _pos.ForeColor = KitVisual.Secundario; _pos.Font = new Font("Segoe UI", 8.8F);
        abasBar.Controls.AddRange([seg, idTxt, _pos]);
        abasBar.Resize += (_, _) => _pos.Location = new Point(abasBar.Width - _pos.Width - 4, 13);

        // ---- Principal: 2 colunas de cartões
        var consultar = BotaoCampo("Consultar", ConsultarDocumento);
        var buscarCep = BotaoCampo("Buscar", BuscarCep);
        _dicaDoc.Text = "";
        var docCampo = F("Nº do documento *", _doc, consultar);
        var ident = Grade6(
            (F("Tipo de pessoa", _tipoPessoa), 2), (F("Tipo de documento", _tipoDoc), 2), (F("Tipo de cliente", _tipoCli), 2),
            (docCampo, 3), (F("Sexo", _sexo), 3),
            (_dicaDoc, 3), (new Panel { BackColor = KitVisual.Cartao, Height = 20 }, 3),
            (F("Nome completo *", _nome), 6),
            (F("E-mail", _email), 3), (F("Telefone (WhatsApp) *", _fone), 3),
            (F("Aniversário", _nasc), 2), (F("Peso (kg)", _peso), 2), (F("Tipo sanguíneo", _tipoSang), 2),
            (new Panel { BackColor = KitVisual.Cartao, Height = 22 }, 2), (_dicaPeso, 2), (new Panel { BackColor = KitVisual.Cartao, Height = 22 }, 2));
        _dicaPeso.Text = "Equilibra os karts";
        var bResp = CartaoModal.Botao("Pesquisar", Color.FromArgb(238, 238, 242), KitVisual.Texto); bResp.Font = new Font("Segoe UI", 9.5F); bResp.Height = 34; bResp.Width = 96; bResp.Margin = new Padding(8, 5, 0, 5);
        bResp.Click += (_, _) => { if (_modo == "ver") return; var c = FormPesquisarCliente.Escolher(this, "Selecionar responsável"); if (c != null) { _respId = c.L("id"); _resp.Text = c.S("nome"); } };
        var bRespNovo = CartaoModal.Botao("+ Novo", Color.FromArgb(238, 238, 242), KitVisual.Texto); bRespNovo.Font = new Font("Segoe UI", 9.5F); bRespNovo.Height = 34; bRespNovo.Width = 80; bRespNovo.Margin = new Padding(8, 5, 0, 5);
        bRespNovo.Click += (_, _) => Seguro.Rodar(this, async () =>
        {
            if (_modo == "ver") return;
            var nid = Novo(this);
            if (nid != null) { var c = (await Api.Get($"/api/office/clientes/{nid}")).AsObject(); _respId = nid; _resp.Text = c.S("nome"); }
        });
        _resp.PlaceholderText = "Só para menores de idade — o responsável assina o termo";
        _resp.ReadOnly = true;
        var tirar = BotaoCampo("✕", () => { if (_modo == "ver") return; _respId = null; _resp.Text = ""; });
        _dica.SetToolTip(tirar, "Remover o responsável");
        var respLinha = new TableLayoutPanel { Dock = DockStyle.Top, Height = 46, ColumnCount = 3, BackColor = KitVisual.Cartao };
        respLinha.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); respLinha.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize)); respLinha.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        respLinha.Controls.Add(Caixa(_resp, tirar), 0, 0); respLinha.Controls.Add(bResp, 1, 0); respLinha.Controls.Add(bRespNovo, 2, 0);
        var ender = Grade6(
            (F("CEP", _cep, buscarCep), 3), (F("País", _pais), 3),
            (F("Endereço", _end), 4), (F("Nº", _num), 2),
            (F("Complemento", _compl), 3), (F("Bairro", _bairro), 3),
            (F("Cidade", _cidade), 3), (F("Estado", _uf), 1), (F("IBGE", _ibge), 2));
        var dica = new Label { Text = "Digite o CEP que o endereço, bairro, cidade e estado se preenchem sozinhos.", Dock = DockStyle.Top, Height = 22, ForeColor = KitVisual.Secundario, Font = new Font("Segoe UI", 8.5F), BackColor = KitVisual.Cartao };
        _cep.TextChanged += (_, _) => { if (_modo != "ver" && Fmt.Digitos(_cep.Text).Length == 8 && _cep.Focused) BuscarCep(); };
        var situacao = new Panel { Dock = DockStyle.Top, Height = 110, BackColor = KitVisual.Cartao };
        var lgpdLinha = LinhaChave("Concorda com o uso dos dados (LGPD)", "Obrigatório para correr. O cliente aceita no totem ou aqui.", _lgpd);
        var bloqLinha = LinhaChave("Cliente bloqueado", "Impede novas reservas e aparece como alerta no totem.", _bloq);
        bloqLinha.Top = 55;
        situacao.Controls.Add(bloqLinha); situacao.Controls.Add(lgpdLinha);
        situacao.Controls.Add(new Panel { BackColor = Color.FromArgb(238, 238, 241), Bounds = new Rectangle(0, 54, 2000, 1) });
        var obsCaixa = Caixa(_obs); obsCaixa.Dock = DockStyle.Top; obsCaixa.Height = 38;

        var cols = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1, BackColor = KitVisual.Fundo, Padding = new Padding(0, 6, 0, 0) };
        cols.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 54)); cols.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 46));
        var esq = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoScroll = true, BackColor = KitVisual.Fundo, Margin = new Padding(0, 0, 8, 0) };
        var dir = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoScroll = true, BackColor = KitVisual.Fundo, Margin = new Padding(8, 0, 0, 0) };
        esq.Controls.Add(Secao("Identificação", ident)); esq.Controls.Add(Secao("Responsável", respLinha));
        dir.Controls.Add(Secao("Endereço", ender, dica)); dir.Controls.Add(Secao(null, situacao)); dir.Controls.Add(Secao("Observação", obsCaixa));
        void Largura(FlowLayoutPanel f) { var w = f.ClientSize.Width - (f.VerticalScroll.Visible ? SystemInformation.VerticalScrollBarWidth : 0) - 2; foreach (Control c in f.Controls) if (w > 100 && c.Width != w) c.Width = w; }
        esq.SizeChanged += (_, _) => Largura(esq); dir.SizeChanged += (_, _) => Largura(dir);
        Shown += (_, _) => { Largura(esq); Largura(dir); };
        cols.Controls.Add(esq, 0, 0); cols.Controls.Add(dir, 1, 0);
        _principal.Controls.Add(cols);

        // ---- Financeiro
        _hist.Colunas(new("dataHora", "Data/Hora", TipoCol.DataHora), new("bateria", "Bateria", Largura: 140), new("produto", "Produto", Largura: 220), new("valor", "Valor", TipoCol.Dinheiro), new("pago", "Pago", TipoCol.Bool), new("status", "Situação"));
        KitVisual.EstilizarGrade(_hist);
        VisualPrincipal.PintarCelulas(_hist);
        _fin.Font = new Font("Segoe UI", 10F, FontStyle.Bold); _fin.ForeColor = KitVisual.Texto; _fin.Height = 52;
        var cartFin = new Panel { Dock = DockStyle.Fill, BackColor = KitVisual.Cartao, Padding = new Padding(16, 12, 16, 12) };
        _hist.Dock = DockStyle.Fill;
        cartFin.Controls.Add(_hist); cartFin.Controls.Add(_fin);
        cartFin.Resize += (_, _) => KitVisual.AplicarRaio(cartFin, 13);
        _financeiro.Padding = new Padding(0, 6, 0, 0);
        _financeiro.Controls.Add(cartFin);

        // ---- rodapé branco (Enter salva · Esc cancela · F3 pesquisa | Cancelar | Salvar cliente)
        var rodape = new Panel { Dock = DockStyle.Bottom, Height = 60, BackColor = Color.White };
        rodape.Paint += (_, e) => { using var pen = new Pen(KitVisual.Linha); e.Graphics.DrawLine(pen, 0, 0, rodape.Width, 0); };
        var salvar = CartaoModal.Botao("Salvar cliente", KitVisual.Verde, Color.White, true); salvar.Size = new Size(140, 38); salvar.Click += (_, _) => Salvar();
        var cancelar = CartaoModal.Botao("Cancelar", Color.FromArgb(238, 238, 242), KitVisual.Texto); cancelar.Size = new Size(96, 38); cancelar.Click += (_, _) => Cancelar();
        var atalhos = new Label { Text = "Enter salva · Esc cancela · F3 pesquisa", AutoSize = true, ForeColor = KitVisual.Secundario, Location = new Point(18, 21) };
        rodape.Controls.AddRange([atalhos, cancelar, salvar]);
        rodape.Resize += (_, _) => { salvar.Location = new Point(rodape.Width - salvar.Width - 18, 11); cancelar.Location = new Point(salvar.Left - cancelar.Width - 10, 11); };
        _bt["save2"] = salvar;

        var corpo = new Panel { Dock = DockStyle.Fill, BackColor = KitVisual.Fundo, Padding = new Padding(16, 8, 16, 10) };
        var meio = new Panel { Dock = DockStyle.Fill, BackColor = KitVisual.Fundo };
        meio.Controls.Add(_principal); meio.Controls.Add(_financeiro);
        corpo.Controls.Add(meio);
        corpo.Controls.Add(abasBar);
        meio.BringToFront();
        Controls.Add(corpo);
        Controls.Add(rodape);
        Controls.Add(cab);
        corpo.BringToFront();
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

    protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
    {
        // Esc: em edição cancela as alterações; só consultando, fecha a janela
        if (keyData == Keys.Escape) { if (_modo == "ver" || _soNovo) Close(); else Cancelar(); return true; }
        return base.ProcessCmdKey(ref msg, keyData);
    }

    protected override CreateParams CreateParams
    {
        get { var cp = base.CreateParams; cp.ClassStyle |= 0x20000; return cp; } // sombra da janela-cartão
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        using var p = VisualPrincipal.Redondo(new Rectangle(0, 0, Width - 1, Height - 1), 18);
        using var pen = new Pen(Color.FromArgb(215, 215, 220));
        e.Graphics.DrawPath(pen, p);
    }

    /// <summary>Glifo MDL2 como imagem pequena (para botões com texto).</summary>
    static Bitmap Glifo(char g, Color cor)
    {
        var bmp = new Bitmap(18, 18);
        using var gr = Graphics.FromImage(bmp);
        gr.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;
        TextRenderer.DrawText(gr, g.ToString(), new Font("Segoe MDL2 Assets", 9.5F), new Rectangle(0, 0, 18, 18), cor, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
        return bmp;
    }

    /// <summary>Botão verde claro dentro do campo (Consultar / Buscar / ✕).</summary>
    static Button BotaoCampo(string texto, Action a)
    {
        var b = new Button { Text = texto, AutoSize = true, MinimumSize = new Size(26, 22), Height = 22, Dock = DockStyle.Right, FlatStyle = FlatStyle.Flat, BackColor = KitVisual.VerdeClaro, ForeColor = KitVisual.Verde, Font = new Font("Segoe UI", 8.4F, FontStyle.Bold), Padding = new Padding(4, 0, 4, 0), Cursor = Cursors.Hand, TabStop = false, Margin = new Padding(0) };
        b.FlatAppearance.BorderSize = 0;
        b.Click += (_, _) => a();
        b.Resize += (_, _) => KitVisual.AplicarRaio(b, 6);
        return b;
    }

    /// <summary>Linha "título + explicação | chave liga/desliga" do cartão Situação.</summary>
    static Panel LinhaChave(string titulo, string texto, CheckBox chave)
    {
        var p = new Panel { Height = 54, Dock = DockStyle.Top, BackColor = KitVisual.Cartao };
        p.Controls.Add(new Label { Text = titulo, AutoSize = true, Location = new Point(0, 7), Font = new Font("Segoe UI", 10F, FontStyle.Bold), ForeColor = KitVisual.Texto });
        p.Controls.Add(new Label { Text = texto, AutoSize = true, Location = new Point(0, 29), Font = new Font("Segoe UI", 8.8F), ForeColor = KitVisual.Secundario });
        chave.Anchor = AnchorStyles.Top | AnchorStyles.Right;
        p.Controls.Add(chave);
        p.Resize += (_, _) => chave.Location = new Point(p.Width - chave.Width - 4, 12);
        return p;
    }

    void ConsultarDocumento() => Seguro.Rodar(this, async () =>
    {
        var doc = Fmt.Digitos(_doc.Text);
        if (doc.Length == 0) { _dicaDoc.Text = "Digite o documento para consultar."; return; }
        var cpfOk = _tipoDoc.Text != "CPF" || Fmt.CpfValido(doc);
        var achados = await Api.Lista($"/api/office/clientes?q={Uri.EscapeDataString(doc)}&campo=documento");
        var outro = achados.FirstOrDefault(c => c.S("id") != _atual?.S("id"));
        _dicaDoc.ForeColor = !cpfOk || outro != null ? Color.FromArgb(196, 40, 28) : KitVisual.Secundario;
        _dicaDoc.Text = !cpfOk ? "CPF inválido. Confira os números."
            : outro != null ? $"Já existe: {outro.S("nome")} (cliente {outro.S("id")})."
            : (_tipoDoc.Text == "CPF" ? "CPF válido. " : "") + "Nenhum cliente com esse documento.";
    });

    void ImprimirTermo() => Seguro.Rodar(this, async () =>
    {
        // o termo sai por reserva: usa a reserva mais recente do cliente
        var ultima = (_atual?["historico"] as JsonArray)?.OfType<JsonObject>().FirstOrDefault(h => h.L("id") is long);
        if (ultima == null) { Msg.Aviso(this, "Este cliente ainda não tem reserva. O termo é impresso junto com a reserva."); return; }
        var link = await Api.Get("/api/office/termo-link?ids=" + ultima.S("id"));
        Relatorio.Abrir(this, Config.ServidorUrl.TrimEnd('/') + link.S("url"), "Termo de Responsabilidade");
    });

    // ---------- blocos visuais do design (Cliente.dc.html)
    static System.Drawing.Drawing2D.GraphicsPath Arredondado(Rectangle r, int raio)
    {
        var d = raio * 2;
        var gp = new System.Drawing.Drawing2D.GraphicsPath();
        gp.AddArc(r.Left, r.Top, d, d, 180, 90); gp.AddArc(r.Right - d, r.Top, d, d, 270, 90); gp.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90); gp.AddArc(r.Left, r.Bottom - d, d, d, 90, 90);
        gp.CloseFigure();
        return gp;
    }

    internal static Panel Caixa(Control c, Button dentro)
    {
        var box = Caixa(c);
        box.Padding = new Padding(box.Padding.Left, 5, 5, 5);
        dentro.Dock = DockStyle.Right;
        box.Controls.Add(dentro);
        c.BringToFront();
        return box;
    }

    internal static Panel Caixa(Control c)
    {
        var box = new Panel { Dock = DockStyle.Fill, Height = 34, BackColor = KitVisual.Cartao, Padding = new Padding(9, 8, 9, 4), Margin = new Padding(0, 4, 6, 4) };
        if (c is TextBoxBase t) { t.BorderStyle = BorderStyle.None; t.Font = new Font("Segoe UI", 10F); t.BackColor = Color.White; }
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

    static Panel F(string rotulo, Control c, Button dentro = null)
    {
        var p = new Panel { Height = 58, BackColor = KitVisual.Cartao, Margin = new Padding(0, 0, 10, 6), Dock = DockStyle.Fill };
        p.Controls.Add(dentro == null ? Caixa(c) : Caixa(c, dentro));
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
        var alturas = new int[row + 1];
        foreach (Control c in t.Controls) { var r = t.GetRow(c); alturas[r] = Math.Max(alturas[r], c.Height + c.Margin.Vertical); }
        foreach (var h in alturas) t.RowStyles.Add(new RowStyle(SizeType.Absolute, h));
        t.Height = alturas.Sum();
        return t;
    }

    static Panel Secao(string titulo, Control conteudo, Control extra = null)
    {
        var p = new Panel { BackColor = KitVisual.Cartao, Padding = new Padding(16, 8, 6, 8), Margin = new Padding(0, 0, 0, 10), Width = 400 };
        p.Height = 8 + (titulo == null ? 0 : 28) + conteudo.Height + (extra?.Height ?? 0) + 10;
        conteudo.Dock = DockStyle.Top;
        if (extra != null) { extra.Dock = DockStyle.Top; p.Controls.Add(extra); }
        p.Controls.Add(conteudo);
        if (titulo != null) p.Controls.Add(new Label { Text = titulo, Dock = DockStyle.Top, Height = 28, Font = new Font("Segoe UI", 10.5F, FontStyle.Bold), ForeColor = KitVisual.Texto });
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
        _status.Visible = m != "ver";
        if (m == "novo") _sub.Text = "Novo cadastro · os campos com * são obrigatórios";
        var ro = m == "ver";
        foreach (var c in new Control[] { _tipoPessoa, _tipoDoc, _doc, _cep, _end, _tipoCli, _nome, _num, _compl, _bairro, _sexo, _email, _cidade, _uf, _peso, _nasc, _fone, _bloq, _lgpd, _obs, _tipoSang, _pais, _ibge })
        {
            if (c is TextBoxBase t) t.ReadOnly = ro; else if (c is ComboBox) c.Enabled = true; else c.Enabled = !ro;
        }
        _bt["save"].Enabled = _bt["canc"].Enabled = _bt["save2"].Enabled = !ro;
        // botão verde desabilitado fica apagado (só consultando não há o que salvar)
        foreach (var k in new[] { "save", "save2" }) { _bt[k].BackColor = ro ? Color.FromArgb(196, 222, 210) : KitVisual.Verde; _bt[k].ForeColor = Color.White; }
        _status.BackColor = m == "novo" ? Color.FromArgb(225, 238, 255) : m == "edit" ? Color.FromArgb(255, 240, 214) : KitVisual.Fundo;
        _status.ForeColor = m == "novo" ? Color.FromArgb(10, 79, 160) : Color.FromArgb(138, 75, 0);
        foreach (var k in new[] { "pesq", "novo", "edit", "del", "first", "prev", "next", "last", "termo" }) _bt[k].Enabled = ro && (!_soNovo);
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
        _tipoSang.SelectedItem = _tipoSang.Items.Contains(c.S("tipoSanguineo")) ? c.S("tipoSanguineo") : "Não informado";
        _pais.SelectedItem = _pais.Items.Contains(c.S("pais")) ? c.S("pais") : "Brasil";
        _ibge.Text = c.S("ibge");
        _sub.Text = $"Cliente desde {Fmt.Dmy(c.S("criadoEm"))} · origem {c.S("origem")}";
        _dicaDoc.Text = "";
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
        _tipoSang.SelectedIndex = 0; _pais.SelectedIndex = 0; _ibge.Text = ""; _dicaDoc.Text = "";
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
            ["tipoSanguineo"] = _tipoSang.SelectedIndex > 0 ? _tipoSang.Text : null, ["pais"] = _pais.Text, ["ibge"] = _ibge.Text.Trim(),
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
            _end.Text = r.S("logradouro"); _bairro.Text = r.S("bairro"); _cidade.Text = r.S("localidade"); _uf.Text = r.S("uf"); _ibge.Text = r.S("ibge");
            if (string.IsNullOrEmpty(_num.Text)) _num.Focus();
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

/// <summary>Chave liga/desliga (verde) no lugar da caixa de seleção.</summary>
public sealed class ChaveLiga : CheckBox
{
    public ChaveLiga()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.SupportsTransparentBackColor, true);
        Size = new Size(44, 26); AutoSize = false; Cursor = Cursors.Hand; Text = ""; BackColor = Color.Transparent;
    }
    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.Clear(Parent?.BackColor ?? Color.White);
        g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        var trilho = new Rectangle(0, 1, Width - 1, Height - 3);
        using (var p = VisualPrincipal.Redondo(trilho, trilho.Height / 2))
        using (var b = new SolidBrush(Checked ? Color.FromArgb(52, 199, 89) : Color.FromArgb(225, 225, 230))) g.FillPath(b, p);
        var d = trilho.Height - 4;
        var x = Checked ? trilho.Right - d - 2 : trilho.X + 2;
        using (var sombra = new SolidBrush(Color.FromArgb(40, 0, 0, 0))) g.FillEllipse(sombra, x, trilho.Y + 3, d, d);
        using (var bola = new SolidBrush(Enabled ? Color.White : Color.FromArgb(245, 245, 245))) g.FillEllipse(bola, x, trilho.Y + 2, d, d);
    }
    protected override void OnCheckedChanged(EventArgs e) { base.OnCheckedChanged(e); Invalidate(); }
}

public static class Extensoes
{
    public static T Also<T>(this T o, Action<T> a) { a(o); return o; }
}

/// <summary>"Pesquisar Cliente": busca por nome/CPF/telefone/e-mail, devolve o escolhido.</summary>
public class FormPesquisarCliente : Janela
{
    readonly TextBox _q = new();
    readonly CheckBox _soAtivos = Campos.Check("Só clientes ativos", true);
    readonly Grade _g = new();
    readonly Label _vazio;
    public JsonObject Escolhido { get; private set; }
    readonly Label _lTotal = new() { Dock = DockStyle.Left, AutoSize = false, Width = 300, TextAlign = ContentAlignment.MiddleLeft, Padding = new Padding(18, 0, 0, 0), Font = new Font("Segoe UI", 9F), ForeColor = KitVisual.Secundario };

    FormPesquisarCliente(string titulo, string inicial) : base("Pesquisar cliente", 1060, 680, true)
    {
        Tag = new KitVisual.ModalMeta
        {
            Titulo = "Pesquisar cliente",
            Sub = "137.539 clientes · pesquise por nome, CPF, celular ou e-mail",
            Cor1 = Color.FromArgb(108, 184, 255),
            Cor2 = Color.FromArgb(30, 111, 232),
            Glifo = "\uE721",
            Estado = "Pesquisa"
        };

        _q.Text = inicial ?? "";
        _q.PlaceholderText = "Nome, CPF, celular ou e-mail";

        var gBusca = Campos.Grade(6);
        Campos.Add(gBusca, "Pesquisar", _q, 4);
        Campos.Add(gBusca, " ", _soAtivos, 2);

        var cBusca = KitVisual.CartaoSecao(null);
        cBusca.Controls.Add(gBusca);

        _q.KeyDown += (_, e) => { if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; Buscar(); } };
        _soAtivos.CheckedChanged += (_, _) => Buscar();

        _g.Colunas(
            new("nome", "Nome", Largura: 280),
            new("documento", "CPF", Largura: 150),
            new("telefone", "Celular", Largura: 150),
            new("nascimento", "Nascimento", TipoCol.Data, Largura: 110),
            new("cidade", "Cidade/UF", Largura: 120),
            new("ativo", "Ativo", TipoCol.Bool, Largura: 70)
        );
        _g.Duplo += r => { Escolhido = r; DialogResult = DialogResult.OK; Close(); };
        _g.Dock = DockStyle.Fill;

        var vazio = new Label { Text = "Digite pelo menos 2 letras ou números e tecle Enter.\nDois cliques no cliente para selecionar.", Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleCenter, ForeColor = KitVisual.Secundario, Font = new Font("Segoe UI", 10F), BackColor = Color.White };
        _vazio = vazio;

        var cartaoGrade = KitVisual.CartaoSecao(null);
        cartaoGrade.AutoSize = false;
        cartaoGrade.Dock = DockStyle.Fill;
        var pGrid = new Panel { Dock = DockStyle.Fill, Padding = new Padding(0, 4, 0, 0) };
        pGrid.Controls.Add(_g);
        pGrid.Controls.Add(vazio);
        cartaoGrade.Controls.Add(pGrid);

        Controls.Add(cartaoGrade);
        Controls.Add(cBusca);

        EventHandler fechar = (_, _) => Close();
        EventHandler novo = (_, _) => Seguro.Rodar(this, async () =>
        {
            var id = FormCliente.Novo(this, _q.Text);
            if (id != null) { Escolhido = (await Sessao.Api.Get($"/api/office/clientes/{id}")).AsObject(); DialogResult = DialogResult.OK; Close(); }
        });
        EventHandler selecionar = (_, _) => { if (_g.Atual != null) { Escolhido = _g.Atual; DialogResult = DialogResult.OK; Close(); } };

        var rodapeCtrl = Rodape("0 clientes encontrados",
            ("Cancelar", fechar, false),
            ("+ Novo cliente", novo, false),
            ("Selecionar", selecionar, true)
        );

        Shown += (_, _) => { _q.Focus(); if (!string.IsNullOrWhiteSpace(inicial)) Buscar(); };
    }

    void Buscar() => Seguro.Rodar(this, async () =>
    {
        var q = _q.Text.Trim();
        if (q.Length < 2) return;
        var r = await Sessao.Api.Lista($"/api/office/clientes?q={Uri.EscapeDataString(q)}&campo=auto");
        if (_soAtivos.Checked) r = r.Where(c => !c.B("bloqueado")).ToList();
        var linhas = r.Select(c => new JsonObject
        {
            ["id"] = c.L("id"),
            ["nome"] = c.S("nome"),
            ["documento"] = c.S("documento"),
            ["telefone"] = c.S("telefone"),
            ["nascimento"] = c.S("nascimento"),
            ["cidade"] = string.IsNullOrEmpty(c.S("uf")) ? c.S("cidade") : $"{c.S("cidade")}/{c.S("uf")}",
            ["ativo"] = !c.B("bloqueado")
        }).ToList();
        _g.Carregar(linhas);
        _vazio.Text = r.Count == 0 ? $"Nenhum cliente encontrado para \"{q}\".\nConfira a grafia ou toque em + Novo cliente para cadastrar." : "";
        _vazio.Visible = r.Count == 0;
        _g.Visible = r.Count > 0;

        var lbl = Controls.Find("rodapeInfo", true).FirstOrDefault() as Label;
        if (lbl != null) lbl.Text = $"{r.Count} {(r.Count == 1 ? "cliente encontrado" : "clientes encontrados")}";
    });

    public static JsonObject Escolher(IWin32Window dono, string titulo = "Pesquisar Cliente", string inicial = null)
    {
        using var f = new FormPesquisarCliente(titulo, inicial);
        return f.ShowDialog(dono) == DialogResult.OK ? f.Escolhido : null;
    }
}
