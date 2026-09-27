using System.Drawing.Drawing2D;
using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

/// <summary>Janela principal — replica do "LapTime - Módulo Office".</summary>
public class FormPrincipal : Form
{
    public bool ConfirmarSaida { get; set; } = true;
    readonly TreeView _arvore = new() { Dock = DockStyle.Fill, HideSelection = false, BorderStyle = BorderStyle.None, ItemHeight = 26, FullRowSelect = true, ShowLines = false, ShowPlusMinus = false, ShowRootLines = false, Indent = 8, BackColor = VisualPrincipal.Lateral, ForeColor = KitVisual.Texto, DrawMode = TreeViewDrawMode.OwnerDrawText, Font = new Font("Segoe UI", 9.5F) };
    readonly DateTimePicker _data = Campos.Data();
    readonly Label _total = new() { Dock = DockStyle.Fill, Font = new Font("Segoe UI", 8.8F), BackColor = Color.White, ForeColor = KitVisual.Secundario, TextAlign = ContentAlignment.MiddleLeft, Padding = new Padding(14, 0, 0, 0), AutoEllipsis = true };
    readonly Panel _filtroBar = new() { Width = 540, Height = 38, BackColor = KitVisual.Fundo };
    readonly Label _titulo = new() { AutoSize = true, Font = new Font("Segoe UI", 18F, FontStyle.Bold), ForeColor = KitVisual.Texto };
    readonly Label _subtitulo = new() { AutoSize = true, Font = new Font("Segoe UI", 9.5F), ForeColor = KitVisual.Secundario };
    readonly TableLayoutPanel _resumo = new() { Dock = DockStyle.Top, Height = 82, ColumnCount = 4, RowCount = 1, BackColor = KitVisual.Fundo, Padding = new Padding(0, 0, 0, 4) };
    readonly VisualPrincipal.SeloTerminal _selo = new();
    readonly Label _dataTexto = new() { AutoSize = false, Size = new Size(96, 30), TextAlign = ContentAlignment.MiddleCenter, Font = new Font("Cascadia Mono", 9F, FontStyle.Bold), ForeColor = KitVisual.Texto, Cursor = Cursors.Hand };
    readonly Panel _dataCaixa = new() { Size = new Size(152, 34), BackColor = Color.White };
    readonly Button _acaoTopo = KitVisual.Botao("", true);
    readonly TextBox _buscaGlobal = new() { BorderStyle = BorderStyle.None, Font = new Font("Segoe UI", 9F), PlaceholderText = "Buscar cliente, CPF, reserva…" };
    readonly Grade _grade = new();
    readonly ToolStripStatusLabel _sbHora = new(), _sbData = new(), _sbSrv = new() { Font = new Font("Segoe UI", 8.5F, FontStyle.Bold) }, _sbCrono = new(), _sbSite = new();
    string _grupo = "reservas", _status = "todas";
    string _periodo = "dia";
    JsonObject _filtroBateria, _filtroContaFidelidade;
    Func<List<JsonObject>, ToolStripItem[]> _menuAtual;

    public FormPrincipal()
    {
        Text = "Kartódromo - Módulo Office";
        Font = new Font("Segoe UI", 9F);
        BackColor = KitVisual.Fundo;
        Icon = Icone.App;
        WindowState = FormWindowState.Maximized;
        MinimumSize = new Size(1024, 640);
        KeyPreview = true;

        // O menu de contexto que a Grade cria internamente usa o renderer global.
        // A barra principal conserva o renderer próprio definido em MontarMenu().
        ToolStripManager.Renderer = new MenuRecepcaoRenderer();

        PrepararResumo();
        PrepararPeriodos();
        _grade.BorderStyle = BorderStyle.None;
        KitVisual.EstilizarGrade(_grade);
        _grade.RowTemplate.Height = 38;
        _grade.ColumnHeadersHeight = 38;
        VisualPrincipal.PintarCelulas(_grade);
        _grade.MultiSelect = true;
        _grade.DefaultCellStyle.Padding = new Padding(5, 0, 5, 0);
        _data.ValueChanged += (_, _) => { AtualizarTitulo(); Recarregar(); };
        // A Grade da biblioteca compartilhada também ouve MouseUp, mas MenuDe
        // fica nulo: a janela monta o menu aqui para poder aplicar o kit visual.
        _grade.MenuDe = null;
        _grade.MouseUp += (_, e) => AbrirMenuContexto(e);
        var direita = MontarAreaDados();
        _grade.FiltroMudou += Totais;

        var split = new SplitContainer { Dock = DockStyle.Fill, FixedPanel = FixedPanel.Panel1, BackColor = Color.FromArgb(229, 229, 234), BorderStyle = BorderStyle.None, SplitterWidth = 1 };
        Load += (_, _) => { split.Panel1MinSize = 220; split.SplitterDistance = 256; };
        // a busca não começa com o cursor (o design mostra o texto de ajuda "Buscar cliente, CPF, reserva…")
        Shown += (_, _) => ActiveControl = _grade;
        split.Panel1.BackColor = VisualPrincipal.Lateral;
        split.Panel2.BackColor = KitVisual.Fundo;
        split.Panel1.Padding = new Padding(8, 10, 8, 8);
        split.Panel2.Padding = new Padding(22, 14, 22, 12);
        _selo.Click += (_, _) => Caixa.Terminal(this);
        var sidebar = new Panel { Dock = DockStyle.Fill, BackColor = VisualPrincipal.Lateral };
        sidebar.Controls.Add(_arvore);
        split.Panel1.Controls.Add(sidebar);
        split.Panel2.Controls.Add(direita);

        var status = MontarStatus();
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 4, BackColor = KitVisual.Fundo, Margin = new Padding(0), Padding = new Padding(0) };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 52));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 84));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 28));
        layout.Controls.Add(MontarCabecalho(), 0, 0);
        layout.Controls.Add(MontarToolbar(), 0, 1);
        layout.Controls.Add(split, 0, 2);
        layout.Controls.Add(status, 0, 3);
        Controls.Add(layout);
        MontarArvore();

        var t = new System.Windows.Forms.Timer { Interval = 15000 };
        t.Tick += (_, _) => { Relogio(); };
        t.Start();
        var ping = new System.Windows.Forms.Timer { Interval = 30000 };
        ping.Tick += async (_, _) => await Ping();
        ping.Start();
        Load += async (_, _) =>
        {
            Relogio();
            await Ping();
            Selecionar("reservas:todas");
            AgenteImpressao.Iniciar(this);
        };
        FormClosing += (_, e) => { if (ConfirmarSaida && !Msg.Pergunta(this, "Deseja sair do sistema?")) e.Cancel = true; };
    }

    protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
    {
        var key = keyData & Keys.KeyCode;
        var modifiers = keyData & Keys.Modifiers;

        // A busca conserva os atalhos padrão de edição e Enter para pesquisar.
        if (_buscaGlobal.Focused && (key == Keys.Enter || modifiers == Keys.Control && key == Keys.A))
            return base.ProcessCmdKey(ref msg, keyData);

        if (modifiers == Keys.None && key == Keys.F1)
        {
            new FormAjuda("Atalhos do teclado").ShowDialog(this);
            return true;
        }

        if (modifiers == Keys.None && key == Keys.F2)
        {
            new FormCliente(null).Show(this);
            return true;
        }
        if (modifiers == Keys.None && key == Keys.F3)
        {
            _buscaGlobal.Focus();
            return true;
        }
        if (modifiers == Keys.None && key == Keys.F9 && _grupo == "reservas" && _grade.ContainsFocus)
        {
            ExecutarAtalhoDeMenu("F9");
            return true;
        }
        if (modifiers == Keys.None && key == Keys.Escape)
        {
            Close();
            return true;
        }
        if (modifiers == Keys.Control && key == Keys.A && _grupo == "reservas" && _grade.ContainsFocus)
        {
            ExecutarAtalhoDeMenu("Ctrl+A");
            return true;
        }
        if (modifiers == Keys.None && key == Keys.Enter && _grade.ContainsFocus)
        {
            if (ExecutarAtalhoDeMenu("Enter")) return true;
        }
        if (modifiers == Keys.None && key == Keys.Insert && _grupo == "baterias" && _grade.ContainsFocus)
        {
            ExecutarAtalhoDeMenu("Ins");
            return true;
        }
        if (modifiers == Keys.Control && key == Keys.P && _grade.ContainsFocus)
        {
            if (ExecutarAtalhoDeMenu("Ctrl+P")) return true;
        }
        if (modifiers == Keys.None && key == Keys.Delete && _grade.ContainsFocus)
        {
            if (ExecutarAtalhoDeMenu("Del")) return true;
        }

        return base.ProcessCmdKey(ref msg, keyData);
    }

    List<JsonObject> SelecaoAtiva()
    {
        var selecionados = _grade.Selecionados;
        if (selecionados.Count > 0) return selecionados;
        return _grade.Atual is JsonObject atual ? [atual] : [];
    }

    bool ExecutarAtalhoDeMenu(string atalho)
    {
        if (_menuAtual == null) return false;
        var itens = _menuAtual(SelecaoAtiva());
        try
        {
            var item = itens.OfType<ToolStripMenuItem>()
                .FirstOrDefault(i => string.Equals(i.ShortcutKeyDisplayString, atalho, StringComparison.OrdinalIgnoreCase));
            if (item is not { Enabled: true }) return false;
            item.PerformClick();
            return true;
        }
        finally
        {
            foreach (var item in itens) item.Dispose();
        }
    }

    ContextMenuStrip _menuAberto;

    void AbrirMenuContexto(MouseEventArgs e)
    {
        if (e.Button != MouseButtons.Right || _menuAtual == null) return;
        var hit = _grade.HitTest(e.X, e.Y);
        if (hit.RowIndex < 0) return;
        if (!_grade.Rows[hit.RowIndex].Selected)
        {
            _grade.ClearSelection();
            _grade.Rows[hit.RowIndex].Selected = true;
        }
        MostrarMenuContexto(e.Location);
    }

    /// <summary>Abre o menu da seleção. O menu anterior só é descartado quando outro abre:
    /// o Closed dispara no meio do clique do item e descartar ali dava
    /// "Cannot access a disposed object (ContextMenuStrip)" em toda ação do menu.</summary>
    internal ContextMenuStrip MostrarMenuContexto(Point onde, ToolStripItem extra = null)
    {
        _menuAberto?.Dispose();
        var menu = CriarMenuContextual(_grade.Selecionados);
        if (extra != null) menu.Items.Add(extra);
        _menuAberto = menu;
        menu.Show(_grade, onde);
        return menu;
    }

    /// <summary>Cria o menu da seleção atual para as capturas de contexto do autoteste.</summary>
    internal ContextMenuStrip CriarMenuContextoParaAutoteste()
        => _menuAtual == null ? null : CriarMenuContextual(_grade.Selecionados);

    ContextMenuStrip CriarMenuContextual(List<JsonObject> selecionados)
    {
        var menu = new ContextMenuStrip
        {
            AutoSize = false,
            Size = new Size(290, 20),
            Padding = new Padding(6),
            BackColor = Color.FromArgb(250, 250, 252),
            ForeColor = KitVisual.Texto,
            Font = new Font("Segoe UI", 9F),
            Renderer = new MenuRecepcaoRenderer(),
            ShowImageMargin = false,
            ShowCheckMargin = false,
            DropShadowEnabled = true,
        };
        menu.Items.AddRange(_menuAtual(selecionados ?? []));
        var altura = menu.Padding.Vertical;
        foreach (ToolStripItem item in menu.Items)
        {
            item.Margin = Padding.Empty;
            if (item is ToolStripSeparator)
            {
                item.AutoSize = false;
                item.Size = new Size(276, 9);
                altura += item.Height;
                continue;
            }
            if (item is ToolStripMenuItem mi)
            {
                mi.AutoSize = false;
                mi.Size = new Size(276, 30);
                mi.Padding = new Padding(10, 0, 10, 0);
                mi.TextAlign = ContentAlignment.MiddleLeft;
                if (AcaoPrincipalDoMenu(mi.Text))
                {
                    mi.Tag = "principal";
                    mi.Font = new Font(menu.Font, FontStyle.Bold);
                    mi.ForeColor = Color.White;
                }
                else if (mi.Text.Equals("Excluir", StringComparison.OrdinalIgnoreCase)
                    || mi.Text.StartsWith("Estornar", StringComparison.OrdinalIgnoreCase))
                    mi.ForeColor = Color.FromArgb(196, 40, 28);
            }
            altura += item.Height;
        }
        menu.Height = Math.Max(18, altura);
        return menu;
    }

    bool AcaoPrincipalDoMenu(string texto) => (_grupo, _status, texto) switch
    {
        ("reservas", _, "Aprovar (cobrar)") => true,
        ("baterias", "fechadas", "Abrir bateria") => true,
        ("baterias", _, "Incluir cliente") => true,
        ("vendas", _, "Estornar pagamento") => true,
        ("fidelidade", _, "Criar voucher para a conta") => true,
        ("vouchers", _, "Criar voucher") => true,
        ("parceiros", "lista", "Criar voucher do parceiro") => true,
        ("parceiros", _, "Registrar pagamento da comissão") => true,
        _ => false
    };

    static ToolStripSeparator Sep() => new();

    void PrepararResumo()
    {
        _resumo.ColumnStyles.Clear();
        for (var i = 0; i < 4; i++) _resumo.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 25));
        for (var i = 0; i < 4; i++) { var c = KitVisual.CartaoResumo("—", "—"); c.Dock = DockStyle.Fill; c.Margin = new Padding(i == 0 ? 0 : 6, 0, i == 3 ? 0 : 6, 0); _resumo.Controls.Add(c, i, 0); }
    }

    void PrepararPeriodos()
    {
        var bar = new FlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false, FlowDirection = FlowDirection.LeftToRight, Padding = new Padding(0), Margin = new Padding(0), BackColor = KitVisual.Fundo };
        bar.Controls.Add(new Label { Text = "Exibir dados", AutoSize = true, ForeColor = KitVisual.Secundario, Font = new Font("Segoe UI", 8.5F), Margin = new Padding(0, 9, 7, 0) });
        var segmento = new Panel { Name = "periodos", Size = new Size(300, 32), BackColor = Color.FromArgb(232, 232, 237), Margin = new Padding(0, 2, 8, 0), Padding = new Padding(2) };
        KitVisual.AplicarRaio(segmento, 8);
        var defs = new[] { ("dia", "Nesta data", 78), ("mes", "Neste mês", 78), ("apartir", "A partir de", 82), ("todas", "Todas", 58) };
        var x = 2;
        foreach (var (chave, texto, largura) in defs)
        {
            var b = new Button { Name = "periodo-" + chave, Text = texto, Size = new Size(largura, 28), Location = new Point(x, 2), FlatStyle = FlatStyle.Flat, BackColor = chave == _periodo ? Color.White : segmento.BackColor,
                ForeColor = chave == _periodo ? KitVisual.Texto : Color.FromArgb(58, 58, 60), Font = new Font("Segoe UI", 8.2F, chave == _periodo ? FontStyle.Bold : FontStyle.Regular), Cursor = Cursors.Hand };
            b.FlatAppearance.BorderSize = 0;
            KitVisual.AplicarRaio(b, 6);
            b.Click += (_, _) => { _periodo = chave; AtualizaPeriodos(); Recarregar(); };
            segmento.Controls.Add(b);
            x += largura;
        }
        bar.Controls.Add(segmento);
        // data: "‹ 25/09/2026 ›" como no design; clicar no texto abre o calendário
        Button Seta(string t, int dias)
        {
            var b = new Button { Text = t, Size = new Size(26, 30), FlatStyle = FlatStyle.Flat, BackColor = Color.White, ForeColor = KitVisual.Secundario, Font = new Font("Segoe UI", 11F), Cursor = Cursors.Hand, TabStop = false, AccessibleDescription = "kit:ignorar" };
            b.FlatAppearance.BorderSize = 0; b.FlatAppearance.MouseOverBackColor = Color.FromArgb(242, 242, 245);
            b.Click += (_, _) => _data.Value = _data.Value.AddDays(dias);
            return b;
        }
        var ant = Seta("‹", -1); var prox = Seta("›", 1);
        ant.Location = new Point(2, 2); _dataTexto.Location = new Point(28, 2); prox.Location = new Point(124, 2);
        _dataCaixa.Controls.AddRange([ant, _dataTexto, prox]);
        _dataCaixa.Margin = new Padding(0, 1, 0, 0);
        _dataCaixa.Paint += (_, e) => { e.Graphics.SmoothingMode = SmoothingMode.AntiAlias; using var p = VisualPrincipal.Redondo(new Rectangle(0, 0, _dataCaixa.Width - 1, _dataCaixa.Height - 1), 9); using var pen = new Pen(Color.FromArgb(222, 222, 227)); e.Graphics.DrawPath(pen, p); };
        _dataTexto.Text = _data.Value.ToString("dd/MM/yyyy");
        _data.ValueChanged += (_, _) => _dataTexto.Text = _data.Value.ToString("dd/MM/yyyy");
        _dataTexto.Click += (_, _) =>
        {
            var cal = new MonthCalendar { MaxSelectionCount = 1, SelectionStart = _data.Value };
            var host = new ToolStripControlHost(cal) { Padding = Padding.Empty, Margin = Padding.Empty };
            var drop = new ToolStripDropDown { Padding = Padding.Empty };
            drop.Items.Add(host);
            cal.DateSelected += (_, ev) => { _data.Value = ev.Start; drop.Close(); };
            drop.Show(_dataCaixa, new Point(0, _dataCaixa.Height + 2));
        };
        bar.Controls.Add(_dataCaixa);
        _filtroBar.Controls.Add(bar);
    }

    void AtualizaPeriodos()
    {
        foreach (Control c in _filtroBar.Controls)
        foreach (Control child in c.Controls)
        {
            if (child is not Panel p || !p.Name.StartsWith("periodo", StringComparison.Ordinal)) continue;
            foreach (Control b in p.Controls)
            {
                var ativo = b.Name == "periodo-" + _periodo;
                b.BackColor = ativo ? Color.White : p.BackColor;
                b.ForeColor = ativo ? KitVisual.Texto : Color.FromArgb(58, 58, 60);
                b.Font = new Font("Segoe UI", 8.2F, ativo ? FontStyle.Bold : FontStyle.Regular);
            }
        }
        _dataCaixa.Visible = _periodo != "todas";
    }

    Control MontarAreaDados()
    {
        var area = new Panel { Dock = DockStyle.Fill, BackColor = KitVisual.Fundo };
        var cab = new Panel { Dock = DockStyle.Top, Height = 64, BackColor = KitVisual.Fundo };
        _titulo.Location = new Point(0, 0);
        _subtitulo.Location = new Point(2, 36);
        cab.Controls.Add(_titulo);
        cab.Controls.Add(_subtitulo);
        _acaoTopo.Anchor = AnchorStyles.Top | AnchorStyles.Right;
        _acaoTopo.Click += (_, _) => AcaoPrincipal();
        cab.Controls.Add(_acaoTopo);
        _filtroBar.Anchor = AnchorStyles.Top | AnchorStyles.Right;
        cab.Controls.Add(_filtroBar);
        void Posicionar()
        {
            _acaoTopo.Location = new Point(cab.ClientSize.Width - _acaoTopo.Width, 6);
            var x = _acaoTopo.Left - _filtroBar.Width - 10;
            var cabe = x > Math.Max(_titulo.Right, _subtitulo.Right) + 24;
            // tela estreita: filtros vão pra uma segunda linha, alinhados à direita
            _filtroBar.Location = cabe ? new Point(x, 6) : new Point(Math.Max(0, cab.ClientSize.Width - _filtroBar.Width), 62);
            var h = cabe ? 64 : 104;
            if (cab.Height != h) cab.Height = h;
        }
        _titulo.SizeChanged += (_, _) => Posicionar(); _subtitulo.SizeChanged += (_, _) => Posicionar();
        cab.Resize += (_, _) => Posicionar();
        _acaoTopo.SizeChanged += (_, _) => Posicionar();

        var lista = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(0) };
        lista.Resize += (_, _) => KitVisual.AplicarRaio(lista, 14);
        var rodape = new Panel { Dock = DockStyle.Bottom, Height = 36, BackColor = Color.White };
        rodape.Paint += (_, e) => { using var pen = new Pen(Color.FromArgb(236, 236, 239)); e.Graphics.DrawLine(pen, 0, 0, rodape.Width, 0); };
        var exportar = new LinkLabel { Text = "Exportar para Excel", AutoSize = true, Dock = DockStyle.Right, LinkColor = KitVisual.Verde, ActiveLinkColor = KitVisual.Verde, LinkBehavior = LinkBehavior.HoverUnderline, Font = new Font("Segoe UI", 8.8F, FontStyle.Bold), Padding = new Padding(0, 10, 16, 0), BackColor = Color.White };
        exportar.LinkClicked += (_, _) => _grade.ExportarExcel(_grupo);
        rodape.Controls.Add(_total); rodape.Controls.Add(exportar);
        lista.Controls.Add(_grade);
        lista.Controls.Add(rodape);
        _grade.BringToFront();
        var espaco = new Panel { Dock = DockStyle.Top, Height = 12, BackColor = KitVisual.Fundo };
        _resumo.Dock = DockStyle.Top;
        area.Controls.Add(lista);
        area.Controls.Add(espaco);
        area.Controls.Add(_resumo);
        area.Controls.Add(cab);
        lista.BringToFront();
        return area;
    }

    void AcaoPrincipal()
    {
        switch (_grupo)
        {
            case "reservas": case "baterias": using (var f = new FormCriarReservas()) f.ShowDialog(this); Recarregar(); break;
            case "vendas": Caixa.Checkout(this, null, null, null); break;
            case "oficina": Cadastros.Abrir(this, "itensManutencao"); break;
            case "vouchers": FormVoucher.Criar("manual").ShowDialog(this); Recarregar(); break;
            case "parceiros": Cadastros.Abrir(this, "parceiros"); break;
            case "fidelidade": if (_status == "contas") AbrirContaFidelidade(); else { FormVoucher.Criar("fidelidade").ShowDialog(this); Recarregar(); } break;
        }
    }

    Control MontarCabecalho()
    {
        var barra = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 4, RowCount = 1, BackColor = Color.FromArgb(255, 255, 255), Padding = new Padding(14, 0, 14, 0), Margin = new Padding(0) };
        barra.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 292));
        barra.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        barra.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 310));
        barra.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 155));
        barra.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        var marca = new Panel { Dock = DockStyle.Fill };
        var logo = new PictureBox { Image = Icone.Logo(), SizeMode = PictureBoxSizeMode.Zoom, Size = new Size(36, 36), Location = new Point(0, 8), BackColor = Color.FromArgb(28, 28, 30), Padding = new Padding(3) };
        logo.Resize += (_, _) => KitVisual.AplicarRaio(logo, 9); KitVisual.AplicarRaio(logo, 9);
        var marcaNome = new Label { Text = "Kartódromo Internacional de Betim", AutoSize = false, Width = 246, Height = 18, AutoEllipsis = true, Font = new Font("Segoe UI", 9.3F, FontStyle.Bold), ForeColor = KitVisual.Texto, Location = new Point(44, 9) };
        var marcaSub = new Label { Text = "Módulo Office", AutoSize = true, Font = new Font("Segoe UI", 8F), ForeColor = KitVisual.Secundario, Location = new Point(45, 27) };
        marca.Controls.AddRange([logo, marcaNome, marcaSub]);
        var menus = MontarMenu();
        menus.Dock = DockStyle.Fill;
        menus.BackColor = Color.White;
        menus.Padding = new Padding(0, 8, 0, 0);
        var busca = new Panel { Dock = DockStyle.Fill, BackColor = Color.FromArgb(242, 242, 245), Margin = new Padding(0, 10, 10, 10), Padding = new Padding(9, 3, 8, 0) };
        KitVisual.AplicarRaio(busca, 9);
        busca.SizeChanged += (_, _) => KitVisual.AplicarRaio(busca, 9);
        var q = _buscaGlobal;
        q.Dock = DockStyle.Fill;
        q.BackColor = busca.BackColor;
        var atalho = new Label { Text = "F3", AutoSize = true, Dock = DockStyle.Right, ForeColor = KitVisual.Secundario, Font = new Font("Segoe UI", 8F), Padding = new Padding(4, 7, 0, 0) };
        var lupa = new Label { Text = "\uE721", AutoSize = false, Width = 22, Dock = DockStyle.Left, ForeColor = KitVisual.Secundario, Font = new Font("Segoe MDL2 Assets", 9F), TextAlign = ContentAlignment.MiddleLeft };
        q.Margin = Padding.Empty;
        var qBox = new Panel { Dock = DockStyle.Fill, Padding = new Padding(0, 7, 0, 0), BackColor = busca.BackColor };
        qBox.Controls.Add(q);
        busca.Controls.Add(qBox); busca.Controls.Add(lupa); busca.Controls.Add(atalho);
        qBox.BringToFront();
        void Buscar()
        {
            if (string.IsNullOrWhiteSpace(q.Text)) { q.Focus(); return; }
            var cliente = FormPesquisarCliente.Escolher(this, "Pesquisar cliente", q.Text);
            if (cliente != null) _subtitulo.Text = $"Cliente selecionado: {cliente.S("nome")} · {cliente.S("documento")}";
        }
        q.KeyDown += (_, e) => { if (e.KeyCode == Keys.Enter) { Buscar(); e.Handled = true; e.SuppressKeyPress = true; } };
        var usuario = new Panel { Dock = DockStyle.Fill };
        var circulo = new Panel { Size = new Size(30, 30), Location = new Point(0, 11) };
        var letra = string.IsNullOrWhiteSpace(Sessao.Nome) ? "?" : Sessao.Nome[..1].ToUpperInvariant();
        circulo.Paint += (_, e) =>
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var b = new LinearGradientBrush(circulo.ClientRectangle, Color.FromArgb(127, 184, 255), Color.FromArgb(30, 111, 232), 90f);
            e.Graphics.FillEllipse(b, circulo.ClientRectangle);
            TextRenderer.DrawText(e.Graphics, letra, new Font("Segoe UI", 10F, FontStyle.Bold), circulo.ClientRectangle, Color.White, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        };
        usuario.Controls.Add(circulo);
        usuario.Controls.Add(new Label { Text = Sessao.Nome, AutoSize = false, Width = 116, Height = 18, Font = new Font("Segoe UI", 8.8F, FontStyle.Bold), ForeColor = KitVisual.Texto, Location = new Point(38, 17), AutoEllipsis = true });
        barra.Controls.Add(marca, 0, 0); barra.Controls.Add(menus, 1, 0); barra.Controls.Add(busca, 2, 0); barra.Controls.Add(usuario, 3, 0);
        barra.Paint += (_, e) => { using var pen = new Pen(KitVisual.Linha); e.Graphics.DrawLine(pen, 0, barra.Height - 1, barra.Width, barra.Height - 1); };
        return barra;
    }

    StatusStrip MontarStatus()
    {
        var s = new StatusStrip { Font = new Font("Segoe UI", 8.3F), SizingGrip = false, BackColor = Color.White, ForeColor = KitVisual.Secundario, Dock = DockStyle.Fill };
        var host = new Uri(Config.ServidorUrl).Host;
        _sbCrono.Text = "● Cronometragem · verificando"; _sbCrono.ForeColor = KitVisual.Secundario;
        _sbSite.Text = "● Site · verificando"; _sbSite.ForeColor = KitVisual.Secundario;
        var servidor = host == "192.168.20.13" ? "SRVKART" : host;
        var perfil = Sessao.Admin ? " (Administrador)" : "";
        var versao = Application.ProductVersion.Split('+')[0];
        if (versao.EndsWith(".0") && versao.Count(ch => ch == '.') == 2) versao = versao[..^2];
        foreach (var item in new[] { _sbHora, _sbSrv, _sbCrono, _sbSite }) item.Margin = new Padding(0, 3, 14, 2);
        _sbData.Visible = false;
        s.Items.AddRange([_sbHora, _sbData, new ToolStripStatusLabel(servidor + " · KartodromoOps") { Margin = new Padding(0, 3, 14, 2) }, new ToolStripStatusLabel(Sessao.Nome + perfil) { Margin = new Padding(0, 3, 14, 2) },
            new ToolStripStatusLabel("Versão " + versao) { Margin = new Padding(0, 3, 14, 2) }, new ToolStripStatusLabel { Spring = true }, _sbSrv, _sbCrono, _sbSite]);
        return s;
    }

    void Relogio() { _sbHora.Text = DateTime.Now.ToString("HH:mm · dd/MM/yyyy"); _sbData.Text = ""; }
    async Task Ping()
    {
        try
        {
            await Sessao.Api.Get("/healthz");
            _sbSrv.Text = "● Servidor on-line"; _sbSrv.ForeColor = Color.FromArgb(28, 107, 53);
            var c = (await Sessao.Api.Get("/api/office/caixa")).AsObject();
            if (c["aberto"] is JsonObject ab)
            {
                var dinheiro = c["sumario"]?.L("dinheiroEmCaixa") ?? 0;
                var turno = ab.S("turno").Trim();
                if (!turno.StartsWith("Turno", StringComparison.OrdinalIgnoreCase)) turno = "Turno " + turno;
                var desde = ab.S("abertoEm") is { Length: >= 16 } ae ? " · desde " + ae.Substring(11, 5) : "";
                _selo.Definir(true, $"Terminal {ab.S("terminal")} aberto", turno + desde);
            }
            else
            {
                _selo.Definir(false, "Nenhum terminal aberto", "Clique para abrir o caixa");
            }
        }
        catch
        {
            _sbSrv.Text = "● Servidor off-line"; _sbSrv.ForeColor = Color.FromArgb(196, 40, 28);
            _selo.Definir(false, "Terminal indisponível", "Não foi possível consultar o caixa");
        }
        await PingServico("crono", Config.CronoUrl, _sbCrono);
        await PingSite(_sbSite);
    }

    static async Task PingServico(string nome, string baseUrl, ToolStripStatusLabel label)
    {
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
            using var r = await http.GetAsync(baseUrl.TrimEnd('/') + "/healthz");
            var online = r.IsSuccessStatusCode;
            label.Text = $"● Cronometragem {(online ? "on-line" : "off-line")}";
            label.ForeColor = online ? Color.FromArgb(28, 107, 53) : Color.FromArgb(196, 40, 28);
        }
        catch { label.Text = "● Cronometragem · off-line"; label.ForeColor = Color.FromArgb(196, 40, 28); }
    }

    static async Task PingSite(ToolStripStatusLabel label)
    {
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(4) };
            using var r = await http.GetAsync("https://www.kartodromodebetim.com.br");
            var online = r.IsSuccessStatusCode;
            label.Text = $"● Site {(online ? "on-line" : "off-line")}";
            label.Visible = !online;
            label.ForeColor = online ? Color.FromArgb(28, 107, 53) : Color.FromArgb(196, 40, 28);
        }
        catch { label.Text = "● Site · off-line"; label.ForeColor = Color.FromArgb(196, 40, 28); }
    }

    // ------------------------------------------------------------------ menu
    MenuStrip MontarMenu()
    {
        var m = new MenuStrip { Font = new Font("Segoe UI", 9F), BackColor = Color.White, Renderer = KitVisual.RenderizadorMenu(), Padding = new Padding(0, 5, 0, 0), GripStyle = ToolStripGripStyle.Hidden };
        var adm = Sessao.Admin;
        ToolStripMenuItem I(string t, Action a, bool hab = true) { var it = new ToolStripMenuItem(t, null, (_, _) => a()) { Enabled = hab }; return it; }
        ToolStripMenuItem S(string t, params object[] filhos)
        {
            var it = new ToolStripMenuItem(t);
            foreach (var f in filhos) if (f is ToolStripItem[] grupo) it.DropDownItems.AddRange(grupo); else it.DropDownItems.Add((ToolStripItem)f);
            return it;
        }
        // grupo do design (MenusOffice): título pequeno em negrito e os itens recuados logo abaixo, sem submenu
        ToolStripItem[] G(string titulo, params ToolStripMenuItem[] itens)
        {
            var cab = new ToolStripLabel(titulo) { Font = new Font("Segoe UI", 8F, FontStyle.Bold), ForeColor = KitVisual.Secundario, Margin = new Padding(0, 4, 0, 0) };
            foreach (var i in itens) i.Text = "    " + i.Text;
            return [cab, .. itens];
        }
        ToolStripMenuItem A(ToolStripMenuItem it, string atalho) { it.ShortcutKeyDisplayString = atalho; return it; }

        m.Items.Add(S("&Início",
            I("Config inicial (empresa)", () => Cadastros.Empresa(this), adm),
            new ToolStripSeparator(), G("Segurança", I("Usuário", () => Cadastros.Abrir(this, "usuarios"), adm), I("Trocar minha senha", TrocarSenha)),
            new ToolStripSeparator(), I("Sair / trocar de usuário", () => Application.Restart()), A(I("Fechar", Close), "Alt+F4")));
        m.Items.Add(S("&Cadastros",
            I("Empresa", () => Cadastros.Empresa(this), adm), I("Feriados", () => Cadastros.Abrir(this, "feriados")), new ToolStripSeparator(),
            A(I("Cliente", () => new FormCliente(null).Show(this)), "F2"), I("Produto", () => Cadastros.Abrir(this, "produtos")), I("Traçados", () => Cadastros.Abrir(this, "tracados")), new ToolStripSeparator(),
            G("POS", I("Turno", () => Cadastros.Abrir(this, "turnos")), I("Terminal", () => Cadastros.Abrir(this, "terminais"))), new ToolStripSeparator(),
            G("Oficina", I("Itens de manutenção", () => Cadastros.Abrir(this, "itensManutencao")), I("Registro de manutenções", () => Selecionar("oficina:arealizar")))));
        m.Items.Add(S("&Financeiro",
            I("Métodos de pagamento", () => Cadastros.Abrir(this, "formas")), I("Terminal (abrir / fechar caixa)", () => Caixa.Terminal(this)),
            I("Suprimento", () => Caixa.Transacao(this, "suprimento")), I("Sangria", () => Caixa.Transacao(this, "sangria")), new ToolStripSeparator(),
            G("Programa de fidelidade", I("Contas", () => Selecionar("fidelidade:contas")), I("Transações", () => Selecionar("fidelidade:transacoes"))), new ToolStripSeparator(),
            G("Vouchers", I("Cadastro de vouchers", () => Selecionar("vouchers:lista")), I("Histórico de consumo", () => Selecionar("vouchers:uso")), I("Criar voucher", () => FormVoucher.Criar("manual").ShowDialog(this))), new ToolStripSeparator(),
            G("Parceiros", I("Cadastro de parceiros", () => Cadastros.Abrir(this, "parceiros")), I("Comissões", () => Selecionar("parceiros:comissoes")))));
        m.Items.Add(S("F&erramentas", I("Parâmetros do sistema", () => Cadastros.Parametros(this), adm), I("Padrões de reservas", () => Cadastros.Abrir(this, "padroes")),
            I("Criar reservas do mês", () => { new FormCriarReservas().ShowDialog(this); Recarregar(); }), new ToolStripSeparator(), I("Serviços online", () => new FormServicosOnline().ShowDialog(this))));
        m.Items.Add(S("&Relatórios",
            G("Cronometragem", I("Resultados da cronometragem", () => Relatorio.Abrir(this, Config.CronoUrl + "/", "Cronometragem")), I("Classificação ao vivo (TV)", () => Relatorio.Abrir(this, Config.CronoUrl + "/tv", "TV"))), new ToolStripSeparator(),
            G("Financeiro", I("Receitas por forma de pagamento", () => Relatorios.Periodo(this, "receitas", "forma")), I("Receitas por clientes", () => Relatorios.Periodo(this, "receitas", "cliente")),
                I("Receitas por produto", () => Relatorios.Periodo(this, "receitas", "produto")), I("Fluxo de caixa", () => Relatorios.Periodo(this, "receitas", "dia"))),
            new ToolStripSeparator(),
            I("Fechamento de caixa", () => Relatorios.Fechamento(this)), I("Reservas diária", () => Relatorios.ReservasDiaria(this, _data.Value)),
            I("Clientes por período", () => Relatorios.Periodo(this, "clientes", null)), I("Lista de participantes", () => Relatorios.Participantes(this, _grupo == "baterias" ? _grade.Atual : null, _data.Value)),
            I("Agenda mensal", () => Relatorios.AgendaMensal(this)), I("Termo de responsabilidade (em branco)", () => Relatorio.Abrir(this, Sessao.Api.UrlComToken("/termo?branco=1"), "Termo de Responsabilidade"))));
        m.Items.Add(S("&Ajuda", I("Manual da recepção", () => new FormAjuda("Manual da recepção").ShowDialog(this)), A(I("Atalhos do teclado", () => new FormAjuda("Atalhos do teclado").ShowDialog(this)), "F1"),
            I("Suporte remoto", () => new FormAjuda("Suporte remoto").ShowDialog(this)), new ToolStripSeparator(), I("Sobre o sistema", () => Msg.Info(this, $"Kartódromo — Módulo Office\nVersão {Application.ProductVersion.Split('+')[0]}\nServidor: {Config.ServidorUrl}\nSistema próprio do Kartódromo Internacional de Betim."))));
        return m;
    }

    void TrocarSenha() { using var f = new FormTrocarSenha(); f.ShowDialog(this); }

    // ------------------------------------------------------------------ toolbar
    Control MontarToolbar()
    {
        var barra = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1, BackColor = Color.White, Padding = new Padding(12, 0, 16, 0), Margin = new Padding(0) };
        barra.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); barra.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        var fluxo = new FlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false, AutoScroll = true, BackColor = Color.White, Margin = new Padding(0) };
        Control B(string icone, string texto, string dica, Action a) => VisualPrincipal.BotaoBarra(icone, texto, dica, a);
        fluxo.Controls.AddRange([
            B("clientes", "Clientes", "Cadastro de clientes (F2)", () => new FormCliente(null).Show(this)),
            B("produtos", "Produtos", "Produtos e provas de cada locação", () => Cadastros.Abrir(this, "produtos")),
            VisualPrincipal.Separador(),
            B("reservas", "Reservas", "Criar reservas avulsas ou pelo padrão", () => { new FormCriarReservas().ShowDialog(this); Recarregar(); }),
            B("agenda", "Agenda", "Agenda mensal de baterias", () => { using (var f = new FormAgenda()) f.ShowDialog(this); Recarregar(); }),
            VisualPrincipal.Separador(),
            B("terminal", "Terminal", "Abrir ou fechar o caixa", () => Caixa.Terminal(this)),
            B("receita", "Receita Avulsa", "Cobrar reservas e produtos (checkout)", () => Caixa.Checkout(this, null, null, null)),
            B("suprimento", "Suprimento", "Colocar dinheiro no caixa", () => Caixa.Transacao(this, "suprimento")),
            B("sangria", "Sangria", "Retirar dinheiro do caixa", () => Caixa.Transacao(this, "sangria")),
            VisualPrincipal.Separador(),
            B("vfidelidade", "Voucher (Fidelidade)", "Criar voucher para conta fidelidade", () => FormVoucher.Criar("fidelidade").ShowDialog(this)),
            B("vparceiro", "Voucher (Parceiro)", "Criar voucher para parceiro", () => FormVoucher.Criar("parceiro").ShowDialog(this)),
            VisualPrincipal.Separador(),
            B("online", "Serviços Online", "Site, WhatsApp e reservas online", () => new FormServicosOnline().ShowDialog(this)),
        ]);
        _selo.Anchor = AnchorStyles.Right; _selo.Margin = new Padding(8, 20, 0, 20);
        barra.Controls.Add(fluxo, 0, 0); barra.Controls.Add(_selo, 1, 0);
        barra.Paint += (_, e) => { using var pen = new Pen(KitVisual.Linha); e.Graphics.DrawLine(pen, 0, barra.Height - 1, barra.Width, barra.Height - 1); };
        return barra;
    }

    // ------------------------------------------------------------------ arvore
    void MontarArvore()
    {
        TreeNode N(string texto, string img, string chave, params TreeNode[] filhos) => new(texto, filhos) { ImageKey = img, SelectedImageKey = img, Tag = chave };
        _arvore.Nodes.AddRange([
            N("Reservas", "g-reservas", "reservas:todas", N("Aprovar", "y", "reservas:aprovar"), N("Aprovadas", "g", "reservas:aprovadas"), N("Pagamento pendente", "y", "reservas:pendentes"), N("Canceladas", "r", "reservas:canceladas"), N("Todas", "b", "reservas:todas")),
            N("Baterias", "g-baterias", "baterias:todas", N("Abertas", "g", "baterias:abertas"), N("Fechadas", "r", "baterias:fechadas"), N("Todas", "b", "baterias:todas")),
            N("Financeiro · Vendas", "g-vendas", "vendas:todas", N("Liquidadas", "g", "vendas:liquidadas"), N("Canceladas", "r", "vendas:canceladas"), N("Todas", "b", "vendas:todas")),
            N("Oficina · Manutenções", "g-oficina", "oficina:todas", N("A realizar", "y", "oficina:arealizar"), N("Realizadas", "g", "oficina:realizadas"), N("Todas", "b", "oficina:todas")),
            N("Fidelidade", "g-fidelidade", "fidelidade:contas", N("Contas", "b", "fidelidade:contas"), N("Transações", "b", "fidelidade:transacoes")),
            N("Vouchers", "g-vouchers", "vouchers:lista", N("Vouchers", "b", "vouchers:lista"), N("Histórico de uso", "b", "vouchers:uso")),
            N("Parceiros", "g-parceiros", "parceiros:lista", N("Parceiros", "b", "parceiros:lista"), N("Histórico de comissões", "b", "parceiros:comissoes"), N("Comissões pagas", "b", "parceiros:pagas")),
        ]);
        _arvore.ExpandAll();
        _arvore.BeforeCollapse += (_, e) => e.Cancel = true;
        var fonteGrupo = new Font("Segoe UI", 8.6F, FontStyle.Bold);
        var fonteItem = new Font("Segoe UI", 9.6F);
        var fonteItemSel = new Font("Segoe UI", 9.6F, FontStyle.Bold);
        var fonteConta = new Font("Segoe UI", 8.4F, FontStyle.Bold);
        _arvore.DrawNode += (_, e) =>
        {
            e.DrawDefault = false;
            var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias; g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            var y = e.Bounds.Y;
            var largura = _arvore.ClientSize.Width;
            using (var fundo = new SolidBrush(VisualPrincipal.Lateral)) g.FillRectangle(fundo, 0, y, largura, e.Bounds.Height);
            var partes = e.Node.Text.Split('\t');
            if (e.Node.Level == 0)
            {
                g.DrawImage(VisualPrincipal.Icone(e.Node.ImageKey), new Rectangle(8, y + 6, 18, 18));
                TextRenderer.DrawText(g, partes[0], fonteGrupo, new Point(32, y + 8), KitVisual.Secundario, TextFormatFlags.NoPadding);
                return;
            }
            var sel = e.Node == _arvore.SelectedNode;
            if (sel) { using var p = VisualPrincipal.Redondo(new Rectangle(2, y + 1, largura - 6, e.Bounds.Height - 2), 7); using var b = new SolidBrush(VisualPrincipal.Selecao); g.FillPath(b, p); }
            using (var ponto = new SolidBrush(VisualPrincipal.Pontos.GetValueOrDefault(e.Node.ImageKey, KitVisual.Secundario))) g.FillEllipse(ponto, 14, y + 9, 8, 8);
            TextRenderer.DrawText(g, partes[0], sel ? fonteItemSel : fonteItem, new Rectangle(30, y, largura - 76, e.Bounds.Height), sel ? VisualPrincipal.TextoSel : KitVisual.Texto, TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding | TextFormatFlags.EndEllipsis);
            if (partes.Length > 1 && int.TryParse(partes[1], out var n))
            {
                var num = n.ToString();
                if (e.Node.ImageKey == "y" && n > 0)
                {
                    var w = TextRenderer.MeasureText(num, fonteConta).Width + 12;
                    var r = new Rectangle(largura - w - 10, y + 5, w, 17);
                    using var p = VisualPrincipal.Redondo(r, 8); using var b = new SolidBrush(Color.FromArgb(255, 159, 10)); g.FillPath(b, p);
                    TextRenderer.DrawText(g, num, fonteConta, r, Color.White, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
                }
                else TextRenderer.DrawText(g, num, new Font("Segoe UI", 8.8F), new Rectangle(largura - 60, y, 50, e.Bounds.Height), KitVisual.Secundario, TextFormatFlags.Right | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
            }
        };
        _arvore.AfterSelect += (_, e) =>
        {
            if (e.Action is not (TreeViewAction.ByMouse or TreeViewAction.ByKeyboard)) return;
            _filtroBateria = _filtroContaFidelidade = null;
            if (e.Node.Tag is string k) Aplicar(k);
        };
    }

    public void Selecionar(string chave, JsonObject bateria = null, JsonObject contaFidelidade = null)
    {
        TreeNode Achar(TreeNodeCollection ns) { foreach (TreeNode n in ns) { if (n.Tag as string == chave && (n.Nodes.Count == 0 || chave.EndsWith("todas") && n.Text != "Todas")) return n; var f = Achar(n.Nodes); if (f != null) return f; } return null; }
        var no = Achar(_arvore.Nodes);
        _filtroBateria = bateria;
        _filtroContaFidelidade = chave == "fidelidade:transacoes" ? contaFidelidade : null;
        if (no != null && _arvore.SelectedNode != no) { _arvore.SelectedNode = no; _filtroBateria = bateria; }
        Aplicar(chave);
    }

    void Aplicar(string chave)
    {
        var p = chave.Split(':');
        _grupo = p[0]; _status = p[1];
        AtualizarTitulo();
        _filtroBar.Visible = _grupo is "reservas" or "baterias" or "vendas" || _grupo == "fidelidade" && _status == "transacoes" || _grupo == "vouchers" && _status == "uso" || _grupo == "parceiros" && _status != "lista";
        Recarregar();
    }

    void AtualizarTitulo()
    {
        var titulo = _grupo switch
        {
            "reservas" => _status switch { "aprovar" => "Reservas · Aprovar", "aprovadas" => "Reservas · Aprovadas", "pendentes" => "Reservas · Pagamento pendente", "canceladas" => "Reservas · Canceladas", _ => "Reservas" },
            "baterias" => _status == "abertas" ? "Baterias · Abertas" : _status == "fechadas" ? "Baterias · Fechadas" : "Baterias",
            "vendas" => _status == "liquidadas" ? "Vendas · Liquidadas" : _status == "canceladas" ? "Vendas · Canceladas" : "Vendas",
            "oficina" => _status == "arealizar" ? "Manutenções · A realizar" : _status == "realizadas" ? "Manutenções · Realizadas" : "Manutenções",
            "fidelidade" => _status == "contas" ? "Fidelidade · Contas" : "Fidelidade · Transações",
            "vouchers" => _status == "uso" ? "Vouchers · Histórico de uso" : "Vouchers",
            "parceiros" => _status == "comissoes" ? "Parceiros · Histórico de comissões" : _status == "pagas" ? "Parceiros · Comissões pagas" : "Parceiros",
            _ => "Recepção"
        };
        _titulo.Text = titulo;
        _subtitulo.Text = _grupo switch
        {
            "reservas" or "baterias" or "vendas" => (_arvore.SelectedNode is { Level: > 0 } ns ? ns.Text.Split('\t')[0] + " · " : "") + (_periodo == "todas" ? "todas as datas" : _data.Value.ToString("dddd, d 'de' MMMM 'de' yyyy", Fmt.Br)),
            "oficina" => "Controle de manutenção por horas de uso de cada kart",
            "fidelidade" => "Programa de fidelidade · dados fornecidos pelo servidor da operação",
            "vouchers" => "Descontos por código · fidelidade, parceiros e vouchers manuais",
            "parceiros" => "Empresas que indicam clientes e recebem comissão",
            _ => "Módulo Office"
        };
        _acaoTopo.Text = _grupo switch { "reservas" or "baterias" => "+ Criar reservas", "vendas" => "Receita avulsa", "oficina" => "Itens de manutenção", "vouchers" => "+ Criar voucher", "parceiros" => "+ Novo parceiro", "fidelidade" => _status == "contas" ? "+ Abrir conta" : "Criar voucher", _ => "" };
        _acaoTopo.Visible = _grupo is "reservas" or "baterias" or "vendas" or "oficina" or "vouchers" or "parceiros" or "fidelidade";
        AtualizaPeriodos();
    }

    // ------------------------------------------------------------------ visoes
    void AbrirContaFidelidade()
    {
        var cliente = FormPesquisarCliente.Escolher(this, "Cliente da nova conta de fidelidade");
        if (cliente == null) return;
        Seguro.Rodar(this, async () =>
        {
            var r = await Sessao.Api.Post("/api/office/fidelidade/contas", new { clienteId = cliente.L("id") });
            if (r?["existente"]?.GetValue<bool>() == true) Msg.Info(this, $"{cliente.S("nome")} já tem conta de fidelidade.");
            Recarregar();
        });
    }

    void AjustarPontos(JsonObject conta)
    {
        var txt = Prompt.Pedir(this, $"Pontos a ajustar na conta de {conta.S("nome")} (saldo atual {conta.S("saldo")}).\nUse número negativo para retirar pontos:", "", "Ajustar pontos");
        if (string.IsNullOrWhiteSpace(txt)) return;
        if (!int.TryParse(txt.Trim(), out var pontos) || pontos == 0) { Msg.Aviso(this, "Informe um número inteiro diferente de zero."); return; }
        var motivo = Prompt.Pedir(this, "Motivo do ajuste (fica registrado no seu usuário):", "", "Ajustar pontos");
        if (string.IsNullOrWhiteSpace(motivo)) return;
        Seguro.Rodar(this, async () =>
        {
            await Sessao.Api.Post($"/api/office/fidelidade/contas/{conta.S("id")}/ajustes", new { pontos, motivo = motivo.Trim(), idempotencyKey = "aj-" + Guid.NewGuid().ToString("N") });
            Recarregar();
        });
    }

    void AtivarConta(JsonObject conta)
    {
        var ativar = !conta.B("ativo");
        if (!Msg.Pergunta(this, ativar ? $"Reativar a conta de fidelidade de {conta.S("nome")}?" : $"Desativar a conta de fidelidade de {conta.S("nome")}?\nOs vouchers de fidelidade dela também serão desativados.")) return;
        Seguro.Rodar(this, async () => { await Sessao.Api.Put($"/api/office/fidelidade/contas/{conta.S("id")}", new { ativo = ativar }); Recarregar(); });
    }

    void Comissao(JsonObject c, string acao)
    {
        var formas = Sessao.Formas();
        if (formas.Length == 0) { Msg.Aviso(this, "Cadastre um método de pagamento antes."); return; }
        using var j = new Janela(acao == "pagar" ? "Pagar comissão" : "Estornar pagamento da comissão", 520, 300);
        var forma = Campos.Combo(); forma.Items.AddRange(formas); forma.SelectedIndex = 0;
        var motivo = new TextBox();
        var g = Campos.Grade(2);
        var resumo = new Label { Text = $"{c.S("parceiro")} · venda {c.S("vendaId")} · comissão {Fmt.Brl(c.L("comissaoCentavos"))}", AutoSize = true, Font = new Font("Segoe UI", 10F, FontStyle.Bold), Margin = new Padding(3, 3, 3, 12) };
        g.Controls.Add(resumo); g.SetColumnSpan(resumo, 2);
        Campos.Add(g, acao == "pagar" ? "Pago com" : "Devolvido para", forma, 2);
        if (acao == "estornar") Campos.Add(g, "Motivo do estorno", motivo, 2);
        j.Controls.Add(new Panel { Dock = DockStyle.Fill, Padding = new Padding(10), Controls = { g } });
        var chave = acao + "-" + Guid.NewGuid().ToString("N");
        j.Rodape(("Cancelar", (_, _) => j.Close(), false), (acao == "pagar" ? "Confirmar pagamento" : "Confirmar estorno", (_, _) => Seguro.Rodar(j, async () =>
        {
            if (acao == "estornar" && string.IsNullOrWhiteSpace(motivo.Text)) { Msg.Aviso(j, "Informe o motivo do estorno."); return; }
            await Sessao.Api.Post($"/api/office/parceiros/comissoes/{c.S("id")}/{acao}", new { idempotencyKey = chave, formaPagamentoId = Campos.IdDe(forma), motivo = motivo.Text.Trim() });
            j.Close();
            Recarregar();
        }), true));
        j.ShowDialog(this);
    }

    string Periodo()
    {
        return $"filtro={_periodo}&data={Fmt.Iso(_data.Value)}";
    }

    public void Recarregar() => Seguro.Rodar(this, CarregarAsync);

    int _seqCarga;

    async Task CarregarAsync()
    {
        // várias cargas podem se sobrepor quando o usuário troca de lista rápido: só a última vale
        var seq = ++_seqCarga;
        List<JsonObject> rows = [];
        _grade.CorLinha = null;
        _grade.MenuDe = null;
        _menuAtual = null;
        switch (_grupo)
        {
            case "reservas":
                _grade.Colunas([
                    new("pago", "Pago", TipoCol.Bool), new("dataHora", "Data/Hora", TipoCol.DataHora), new("reserva", "Reserva", Largura: 150), new("cliente", "Cliente", Largura: 240),
                    .. (Sessao.ParamSim("office.exibirColunaResponsavel", false) ? new Col[] { new("responsavel", "Responsável") } : []),
                    new("produto", "Produto", Largura: 220), new("categoria", "Categoria", Largura: 110), new("preco", "Preço", TipoCol.Dinheiro, 90), new("desconto", "Desconto", TipoCol.Dinheiro, 90),
                    new("total", "Total", TipoCol.Dinheiro, 90), new("observacao", "Observação")]);
                _grade.CorLinha = r => r.S("status") == "cancelada" ? Color.Silver : null; // pré-reserva: selo laranja no cliente (VisualPrincipal)
                _menuAtual = MenuReservas;
                if (_status == "pendentes" && _filtroBateria == null)
                {
                    var pre = await Sessao.Api.Lista("/api/office/reservas?status=aprovar&" + Periodo());
                    var aguardando = await Sessao.Api.Lista("/api/office/reservas?status=pendentes&" + Periodo());
                    rows = pre.Concat(aguardando).DistinctBy(r => r.S("id")).ToList();
                }
                else rows = await Sessao.Api.Lista($"/api/office/reservas?status={_status}&" + (_filtroBateria != null ? $"bateriaId={_filtroBateria.S("id")}" : Periodo()));
                break;
            case "baterias":
                _grade.Colunas([
                    new("dataHora", "Data/Hora", TipoCol.DataHora), new("nome", "Nome", Largura: 190), new("produto", "Produto", Largura: 220), new("vagas", "Vagas (máx)", TipoCol.Inteiro),
                    new("disponiveis", "Vagas (disponíveis)", TipoCol.Inteiro, 120), new("pagos", "Pagos", TipoCol.Inteiro, 60), new("preReservas", "Pré-reservas", TipoCol.Inteiro, 90),
                    new("responsavel", "Responsável", Largura: 170), new("status", "Situação", Largura: 80, Valor: r => r.S("status") == "aberta" ? "Aberta" : "Fechada"), new("autoAtendimento", "Totem", TipoCol.Bool)]);
                _grade.CorLinha = r => r.S("status") == "fechada" ? Color.Gray : null;
                _menuAtual = MenuBaterias;
                rows = await Sessao.Api.Lista($"/api/office/baterias?status={_status}&{Periodo()}");
                break;
            case "vendas":
                _grade.Colunas([
                    new("dataHora", "Data/Hora", TipoCol.DataHora), new("codigo", "Código", Largura: 70), new("cliente", "Cliente", Largura: 200), new("documento", "Nº Documento", Largura: 110),
                    new("usuario", "Usuário", Largura: 110), new("terminal", "Terminal", Largura: 100), new("bruto", "Vendas (R$)", TipoCol.Dinheiro), new("desconto", "Descontos (R$)", TipoCol.Dinheiro),
                    new("acrescimo", "Acréscimos (R$)", TipoCol.Dinheiro), new("recebido", "Recebido (R$)", TipoCol.Dinheiro), new("troco", "Troco (R$)", TipoCol.Dinheiro),
                    new("estorno", "Estornos (R$)", TipoCol.Dinheiro), new("final", "Final (R$)", TipoCol.Dinheiro), new("cancelada", "Cancelado", TipoCol.Bool),
                    new("motivo", "Motivo do Cancelamento"), new("observacao", "Observação")]);
                _grade.CorLinha = r => r.B("cancelada") ? Color.Silver : null;
                _menuAtual = MenuVendas;
                rows = await Sessao.Api.Lista($"/api/office/vendas?status={_status}&{Periodo()}");
                break;
            case "oficina":
                _grade.Colunas([
                    new("kart", "Kart", Largura: 60), new("categoria", "Categoria", Largura: 100), new("item", "Item de Manutenção", Largura: 200),
                    new("minutosUso", "Tempo de Uso", Largura: 100, Valor: r => $"{r.I("minutosUso") / 60}h{r.I("minutosUso") % 60:00}"), new("limiteHoras", "Limite (h)", TipoCol.Inteiro),
                    new("ultimaManutencao", "Última Manutenção", TipoCol.DataHora, 130), new("data", "Atualizado em", TipoCol.DataHora), new("realizada", "Realizada", TipoCol.Bool)]);
                _menuAtual = MenuOficina;
                rows = await Sessao.Api.Lista($"/api/office/manutencoes?status={_status}");
                break;
            case "vouchers":
                if (_status == "uso")
                    _grade.Colunas([new("dataHora", "Data/Hora", TipoCol.DataHora), new("voucher", "Voucher"), new("cliente", "Cliente", Largura: 220), new("desconto", "Desconto (R$)", TipoCol.Dinheiro), new("vendaId", "Venda", TipoCol.Inteiro), new("estornado", "Estornado", TipoCol.Bool)]);
                else
                    _grade.Colunas([new("codigo", "Código"), new("origem", "Origem", Largura: 90), new("referencia", "Conta/Parceiro"), new("tipo", "Tipo desconto", Largura: 100),
                        new("valor", "Valor", Largura: 90, Valor: r => r.S("tipo") == "percentual" ? r.S("valor") + "%" : Fmt.Brl(r.L("valor"))), new("inicio", "Data inicial", TipoCol.Data), new("fim", "Data final", TipoCol.Data),
                        new("produto", "Produto"), new("usoMaxCliente", "Uso máx/cliente", TipoCol.Inteiro, 100), new("usoUnico", "Uso único", TipoCol.Bool), new("usos", "Usos", TipoCol.Inteiro, 60)]);
                _menuAtual = sel => [
                    Item("Criar voucher", () => { FormVoucher.Criar("manual").ShowDialog(this); Recarregar(); }),
                    Item("Editar voucher", () => Msg.Aviso(this, "A API do servidor ainda não permite editar vouchers."), false, "Enter"),
                    Item("Desativar voucher", () => Msg.Aviso(this, "A API do servidor ainda não permite desativar vouchers."), false),
                    new ToolStripSeparator(), Exportar("vouchers")];
                rows = await Sessao.Api.Lista(_status == "uso" ? "/api/office/vouchers/uso" : "/api/office/vouchers");
                break;
            case "fidelidade":
                if (_status == "contas")
                {
                    _grade.Colunas(new("nome", "Conta", Largura: 260), new("documento", "Documento", Largura: 150), new("baterias", "Baterias", TipoCol.Inteiro), new("saldo", "Pontos", TipoCol.Inteiro),
                        new("transacoes", "Transações", TipoCol.Inteiro), new("criadaEm", "Desde", TipoCol.Data), new("ativo", "Ativa", TipoCol.Bool));
                    _grade.CorLinha = r => r.B("ativo") ? null : Color.Gray;
                    rows = await Sessao.Api.Lista("/api/office/fidelidade/contas");
                }
                else
                {
                    _grade.Colunas(new("dataHora", "Data/Hora", TipoCol.DataHora), new("conta", "Conta", Largura: 240), new("tipo", "Tipo", Largura: 90), new("motivo", "Descrição", Largura: 300),
                        new("pontos", "Pontos", TipoCol.Inteiro), new("saldoApos", "Saldo após", TipoCol.Inteiro), new("usuario", "Usuário", Largura: 120));
                    _grade.CorLinha = r => (r.L("pontos") ?? 0) < 0 ? Color.FromArgb(196, 40, 28) : null;
                    rows = await Sessao.Api.Lista(_filtroContaFidelidade != null
                        ? $"/api/office/fidelidade/contas/{_filtroContaFidelidade.S("id")}/transacoes?{Periodo()}"
                        : $"/api/office/fidelidade/transacoes?{Periodo()}");
                }
                _menuAtual = sel => _status == "contas" ? [
                    Item("+ Abrir conta para um cliente", AbrirContaFidelidade),
                    Item("Criar voucher para a conta", () => { FormVoucher.Criar("fidelidade", sel[0]).ShowDialog(this); Recarregar(); }, sel.Count == 1 && sel[0].B("ativo")),
                    Item("Ver transações da conta", () => Selecionar("fidelidade:transacoes", contaFidelidade: sel[0]), sel.Count == 1, "Enter"),
                    Item("Ajustar pontos manualmente", () => AjustarPontos(sel[0]), sel.Count == 1 && Sessao.Admin),
                    Item(sel.Count == 1 && !sel[0].B("ativo") ? "Reativar conta" : "Desativar conta", () => AtivarConta(sel[0]), sel.Count == 1 && Sessao.Admin),
                    new ToolStripSeparator(), Exportar("fidelidade")]
                    : [Item("Ver todas as transações", () => Selecionar("fidelidade:transacoes")), new ToolStripSeparator(), Exportar("fidelidade-transacoes")];
                break;
            case "parceiros":
                if (_status == "lista")
                {
                    _grade.Colunas(new("nome", "Parceiro", Largura: 220), new("documento", "CNPJ / CPF", Largura: 150), new("voucher", "Voucher", Largura: 110),
                        new("comissaoPercentual", "Comissão (%)", Largura: 95), new("vendasIndicadas", "Vendas indicadas", TipoCol.Inteiro, 110),
                        new("comissaoPendenteCentavos", "A pagar (R$)", TipoCol.Dinheiro), new("comissaoPagaCentavos", "Pago (R$)", TipoCol.Dinheiro),
                        new("contato", "Contato", Largura: 160), new("ativo", "Ativo", TipoCol.Bool));
                    _grade.CorLinha = r => r.B("ativo") ? null : Color.Gray;
                    rows = await Sessao.Api.Lista("/api/office/parceiros");
                }
                else
                {
                    _grade.Colunas(new("data", "Data", TipoCol.DataHora), new("parceiro", "Parceiro", Largura: 200), new("vendaId", "Venda", TipoCol.Inteiro, 70), new("cliente", "Cliente", Largura: 200),
                        new("valorVendaCentavos", "Valor venda (R$)", TipoCol.Dinheiro), new("percentual", "%", Largura: 55), new("comissaoCentavos", "Comissão (R$)", TipoCol.Dinheiro),
                        new("situacao", "Situação", Largura: 90, Valor: r => r.S("situacao") switch { "paga" => "Paga", "estornada" => "Estornada", _ => "Pendente" }),
                        new("metodoPagamento", "Pago com", Largura: 110), new("pagoEm", "Pago em", TipoCol.DataHora));
                    _grade.CorLinha = r => r.S("situacao") == "estornada" ? Color.Gray : r.S("situacao") == "pendente" ? Color.FromArgb(178, 106, 0) : null;
                    rows = await Sessao.Api.Lista($"/api/office/parceiros/comissoes?status={(_status == "pagas" ? "pagas" : "todas")}&{Periodo()}");
                }
                _menuAtual = _status == "lista" ? sel => [
                    Item("+ Novo parceiro", () => Cadastros.Abrir(this, "parceiros")),
                    Item("Editar parceiro", () => Cadastros.Abrir(this, "parceiros"), sel.Count == 1, "Enter"),
                    Item("Criar voucher do parceiro", () => { FormVoucher.Criar("parceiro", sel[0]).ShowDialog(this); Recarregar(); }, sel.Count == 1 && sel[0].B("ativo")),
                    Item("Ver comissões", () => Selecionar("parceiros:comissoes"), sel.Count == 1),
                    new ToolStripSeparator(), Exportar("parceiros")]
                    : sel => [
                        Item("Registrar pagamento da comissão", () => Comissao(sel[0], "pagar"), sel.Count == 1 && sel[0].S("situacao") == "pendente" && Sessao.Admin),
                        Item("Estornar pagamento", () => Comissao(sel[0], "estornar"), sel.Count == 1 && sel[0].S("situacao") == "paga" && Sessao.Admin),
                        new ToolStripSeparator(), Exportar("comissoes")];
                break;
        }
        if (seq != _seqCarga || IsDisposed) return;
        VisualPrincipal.AjustarColunas(_grade);
        _grade.Carregar(rows);
        AtualizarResumo(rows);
        Totais();
        try { await AtualizarContadores(); } catch { }
    }

    async Task AtualizarContadores()
    {
        var queryData = Periodo();
        {
            var all = await Sessao.Api.Lista("/api/office/reservas?status=todas&" + queryData);
            var ativas = all.Where(r => r.S("status") != "cancelada").ToList();
            SetarContagem("reservas:aprovar", ativas.Count(r => !r.B("aprovada")));
            SetarContagem("reservas:aprovadas", ativas.Count(r => r.B("aprovada")));
            SetarContagem("reservas:pendentes", ativas.Count(r => !r.B("pago")));
            SetarContagem("reservas:canceladas", all.Count(r => r.S("status") == "cancelada"));
            SetarContagem("reservas:todas", all.Count);
        }
        {
            var all = await Sessao.Api.Lista("/api/office/baterias?status=todas&" + queryData);
            SetarContagem("baterias:abertas", all.Count(r => r.S("status") == "aberta"));
            SetarContagem("baterias:fechadas", all.Count(r => r.S("status") == "fechada"));
            SetarContagem("baterias:todas", all.Count);
        }
        {
            var man = await Sessao.Api.Lista("/api/office/manutencoes?status=todas");
            SetarContagem("oficina:arealizar", man.Count(r => !r.B("realizada")));
            SetarContagem("oficina:realizadas", man.Count(r => r.B("realizada")));
            SetarContagem("oficina:todas", man.Count);
        }
        if (_grupo == "vendas")
        {
            var all = await Sessao.Api.Lista("/api/office/vendas?status=todas&" + queryData);
            SetarContagem("vendas:liquidadas", all.Count(r => !r.B("cancelada") && (r.L("estorno") ?? 0) == 0));
            SetarContagem("vendas:canceladas", all.Count(r => r.B("cancelada") || (r.L("estorno") ?? 0) > 0));
            SetarContagem("vendas:todas", all.Count);
        }
        else if (_grupo == "oficina")
        {
            var all = await Sessao.Api.Lista("/api/office/manutencoes?status=todas");
            SetarContagem("oficina:arealizar", all.Count(r => !r.B("realizada")));
            SetarContagem("oficina:realizadas", all.Count(r => r.B("realizada")));
            SetarContagem("oficina:todas", all.Count);
        }
        else if (_grupo == "vouchers")
        {
            var all = await Sessao.Api.Lista(_status == "uso" ? "/api/office/vouchers/uso" : "/api/office/vouchers");
            SetarContagem("vouchers:lista", all.Count);
            SetarContagem("vouchers:uso", all.Count);
        }
    }

    void SetarContagem(string chave, int valor)
    {
        void Percorrer(TreeNodeCollection ns)
        {
            foreach (TreeNode n in ns)
            {
                if (n.Tag as string == chave)
                {
                    var nome = n.Text.Split('\t')[0];
                    n.Text = $"{nome}\t{valor}";
                    return;
                }
                Percorrer(n.Nodes);
            }
        }
        Percorrer(_arvore.Nodes);
        _arvore.Invalidate();
    }

    void AtualizarResumo(List<JsonObject> rows)
    {
        (string nome, string valor, Color? cor)[] cards = _grupo switch
        {
            "reservas" => [
                ("Reservas", rows.Count.ToString(), null),
                ("Pré-reservas para aprovar", rows.Count(r => !r.B("aprovada") && r.S("status") != "cancelada").ToString(), Color.FromArgb(178, 106, 0)),
                ("Recebido", Fmt.Brl(rows.Where(r => r.B("pago")).Sum(r => r.L("total") ?? 0)), Color.FromArgb(28, 107, 53)),
                ("A receber", Fmt.Brl(rows.Where(r => !r.B("pago") && r.S("status") != "cancelada").Sum(r => r.L("total") ?? 0)), null)],
            "baterias" => [
                ("Baterias", rows.Count.ToString(), null), ("Vagas", rows.Sum(r => r.I("vagas")).ToString(), null),
                ("Reservas", rows.Sum(r => r.I("inscritos")).ToString(), null), ("Pagos", rows.Sum(r => r.I("pagos")).ToString(), Color.FromArgb(28, 107, 53))],
            "vendas" => [
                ("Vendas", rows.Count.ToString(), null), ("Descontos", Fmt.Brl(rows.Sum(r => r.L("desconto") ?? 0)), Color.FromArgb(196, 40, 28)),
                ("Estornos", Fmt.Brl(rows.Sum(r => r.L("estorno") ?? 0)), Color.FromArgb(196, 40, 28)),
                ("Total final", Fmt.Brl(rows.Where(r => !r.B("cancelada")).Sum(r => r.L("final") ?? 0)), Color.FromArgb(28, 107, 53))],
            "oficina" => [
                ("A realizar", rows.Count(r => !r.B("realizada")).ToString(), Color.FromArgb(178, 106, 0)),
                ("Realizadas", rows.Count(r => r.B("realizada")).ToString(), Color.FromArgb(28, 107, 53)),
                ("Próximas do limite", rows.Count(r => !r.B("realizada") && r.I("limiteHoras") > 0 && r.I("minutosUso") >= r.I("limiteHoras") * 50).ToString(), Color.FromArgb(178, 106, 0)),
                ("Registros", rows.Count.ToString(), null)],
            "vouchers" => [
                ("Vouchers", rows.Count.ToString(), null), ("Ativos", rows.Count(r => r.B("ativo")).ToString(), Color.FromArgb(28, 107, 53)),
                ("Usos", rows.Sum(r => r.I("usos")).ToString(), null), ("Vencem em 7 dias", rows.Count(r => r.D("fim") is DateTime d && d >= DateTime.Today && d <= DateTime.Today.AddDays(7)).ToString(), Color.FromArgb(178, 106, 0))],
            "fidelidade" when _status == "contas" => [("Contas", rows.Count.ToString(), null), ("Ativas", rows.Count(r => r.B("ativo")).ToString(), Color.FromArgb(28, 107, 53)),
                ("Pontos em aberto", rows.Sum(r => r.L("saldo") ?? 0).ToString("N0", Fmt.Br), Color.FromArgb(178, 106, 0)), ("Baterias pagas", rows.Sum(r => r.I("baterias")).ToString(), null)],
            "fidelidade" => [("Transações", rows.Count.ToString(), null), ("Pontos creditados", rows.Where(r => (r.L("pontos") ?? 0) > 0).Sum(r => r.L("pontos") ?? 0).ToString("N0", Fmt.Br), Color.FromArgb(28, 107, 53)),
                ("Pontos debitados", (-rows.Where(r => (r.L("pontos") ?? 0) < 0).Sum(r => r.L("pontos") ?? 0)).ToString("N0", Fmt.Br), Color.FromArgb(196, 40, 28)), ("Contas", rows.Select(r => r.S("conta")).Distinct().Count().ToString(), null)],
            "parceiros" when _status == "lista" => [("Parceiros", rows.Count(r => r.B("ativo")).ToString(), null), ("Vendas indicadas", rows.Sum(r => r.I("vendasIndicadas")).ToString(), null),
                ("Comissão a pagar", Fmt.Brl(rows.Sum(r => r.L("comissaoPendenteCentavos") ?? 0)), Color.FromArgb(178, 106, 0)), ("Comissão paga", Fmt.Brl(rows.Sum(r => r.L("comissaoPagaCentavos") ?? 0)), Color.FromArgb(28, 107, 53))],
            "parceiros" => [("Comissões", rows.Count.ToString(), null), ("Vendas indicadas", Fmt.Brl(rows.Sum(r => r.L("valorVendaCentavos") ?? 0)), null),
                ("A pagar", Fmt.Brl(rows.Where(r => r.S("situacao") == "pendente").Sum(r => r.L("comissaoCentavos") ?? 0)), Color.FromArgb(178, 106, 0)), ("Pagas", Fmt.Brl(rows.Where(r => r.S("situacao") == "paga").Sum(r => r.L("comissaoCentavos") ?? 0)), Color.FromArgb(28, 107, 53))],
            _ => [("Registros", rows.Count.ToString(), null), ("—", "—", null), ("—", "—", null), ("—", "—", null)]
        };
        for (var i = 0; i < Math.Min(cards.Length, _resumo.Controls.Count); i++)
        {
            var p = (Panel)_resumo.Controls[i];
            var label = p.Controls.Find("rotulo", false).FirstOrDefault() as Label;
            if (label != null) label.Text = cards[i].nome;
            KitVisual.ValorCartao(p, cards[i].valor, cards[i].cor);
        }
    }

    void Totais()
    {
        var v = _grade.Visiveis;
        var extra = _grupo switch
        {
            "reservas" => $"Pagos: {v.Count(r => r.B("pago"))} · Pré-reservas: {v.Count(r => !r.B("aprovada") && r.S("status") != "cancelada")} · Total pago: {Fmt.Brl(v.Where(r => r.B("pago")).Sum(r => r.L("total") ?? 0))}",
            "baterias" => $"Vagas: {v.Sum(r => r.I("vagas"))} · Reservas: {v.Sum(r => r.I("inscritos"))} · Pagos: {v.Sum(r => r.I("pagos"))}",
            "vendas" => $"Total final: {Fmt.Brl(v.Where(r => !r.B("cancelada")).Sum(r => r.L("final") ?? 0))}",
            "fidelidade" => _filtroContaFidelidade != null ? $"Conta: {_filtroContaFidelidade.S("nome")} (use a árvore para ver todas)" : "",
            "parceiros" => _status == "lista" ? $"Ativos: {v.Count(r => r.B("ativo"))}" : $"Comissão no filtro: {Fmt.Brl(v.Sum(r => r.L("comissaoCentavos") ?? 0))}",
            _ => "",
        };
        var bat = _filtroBateria != null ? $" · Bateria: {_filtroBateria.S("nome")} {Fmt.DmyHm(_filtroBateria.S("dataHora"))} (use a árvore para ver todas)" : "";
        _total.Text = $"Total de registros: {v.Count}  ·  {extra}{bat}";
    }

    ToolStripMenuItem Item(string t, Action a, bool hab = true, string atalho = null) => new(t, null, (_, _) => a())
    {
        Enabled = hab,
        ShortcutKeyDisplayString = atalho ?? ""
    };
    ToolStripMenuItem Exportar(string nome) => Item("Exportar para Excel", () => _grade.ExportarExcel(nome));

    ToolStripItem[] MenuReservas(List<JsonObject> sel)
    {
        var umaSo = sel.Count == 1;
        var algumPago = sel.Any(r => r.B("pago"));
        var algumCanc = sel.Any(r => r.S("status") == "cancelada");
        return [
            Item("Aprovar (cobrar)", () => Caixa.CheckoutDeReservas(this, sel), sel.Count > 0 && !algumPago && !algumCanc, "F9"),
            Item("Aprovar pré-reserva (sem pagamento)", () => Acoes.AprovarPre(this, sel), sel.Any(r => !r.B("aprovada") && r.S("status") != "cancelada"), "Ctrl+A"),
            Item("Editar reserva", () => Acoes.EditarReserva(this, sel[0]), umaSo, "Enter"),
            Item("Alterar cliente", () => Acoes.AlterarCliente(this, sel[0]), umaSo && !algumCanc),
            Item("Mover cliente", () => Acoes.MoverCliente(this, sel[0]), umaSo && !algumCanc),
            new ToolStripSeparator(),
            Item("Imprimir termo", () => Acoes.ImprimirTermo(this, sel.Select(r => r.S("id"))), sel.Count > 0, "Ctrl+P"),
            Item("Imprimir ticket", () => Relatorio.Abrir(this, Sessao.Api.UrlComToken("/relatorio/ticket?ids=" + string.Join(",", sel.Select(r => r.S("id")))), "Ticket")),
            new ToolStripSeparator(),
            Exportar("reservas"),
            new ToolStripSeparator(),
            Item("Excluir", () => Acoes.ExcluirReservas(this, sel), sel.Count > 0, "Del"),
        ];
    }

    ToolStripItem[] MenuBaterias(List<JsonObject> sel)
    {
        var umaSo = sel.Count == 1;
        return [
            Item("Abrir bateria", () => Acoes.StatusBateria(this, sel, "aberta"), sel.Any(b => b.S("status") == "fechada")),
            Item("Fechar bateria", () => Acoes.StatusBateria(this, sel, "fechada"), sel.Any(b => b.S("status") == "aberta")),
            new ToolStripSeparator(),
            Item("Editar bateria", () => { if (new FormBateria(sel[0]).ShowDialog(this) == DialogResult.OK) Recarregar(); }, umaSo, "Enter"),
            Item("Incluir cliente", () => { if (new FormIncluirCliente(sel[0]).ShowDialog(this) == DialogResult.OK) Recarregar(); }, umaSo, "Ins"),
            Item("Ver reservas", () => Selecionar("reservas:todas", sel[0]), umaSo),
            new ToolStripSeparator(),
            Item("Lista de participantes", () => new FormListaParticipantes(sel[0]).ShowDialog(this), umaSo, "Ctrl+P"),
            new ToolStripSeparator(),
            Exportar("baterias"),
            new ToolStripSeparator(),
            Item("Excluir", () => Acoes.ExcluirBaterias(this, sel, false), sel.Count > 0, "Del"),
            Item("Excluir todas as baterias listadas", () => Acoes.ExcluirBaterias(this, _grade.Visiveis, true)),
        ];
    }

    ToolStripItem[] MenuVendas(List<JsonObject> sel)
    {
        var umaSo = sel.Count == 1;
        return [
            Item("Estornar pagamento", () => { if (new FormEstorno(sel[0].L("id") ?? 0).ShowDialog(this) == DialogResult.OK) Recarregar(); }, umaSo && !sel[0].B("cancelada")),
            Item("Visualizar métodos de pagamento", () => new FormVenda(sel[0].L("id") ?? 0).ShowDialog(this), umaSo, "Enter"),
            Item("Imprimir comprovante", () => Relatorio.Abrir(this, Sessao.Api.UrlComToken("/relatorio/venda?id=" + sel[0].S("id")), "Comprovante"), umaSo, "Ctrl+P"),
            new ToolStripSeparator(),
            Exportar("vendas"),
        ];
    }

    ToolStripItem[] MenuOficina(List<JsonObject> sel) => [
        Item("Marcar como Manutenção Realizada", () => Acoes.Manutencao(this, sel, true), sel.Count > 0),
        Item("Marcar Todos como Manutenção Realizada", () => Acoes.Manutencao(this, _grade.Visiveis, true)),
        Item("Desmarcar como Manutenção Realizada", () => Acoes.Manutencao(this, sel, false), sel.Count > 0),
        Item("Desmarcar Todos como Manutenção Realizada", () => Acoes.Manutencao(this, _grade.Visiveis, false)),
        new ToolStripSeparator(),
        Exportar("manutencoes"),
    ];

    protected override void OnShown(EventArgs e)
    {
        base.OnShown(e);
        _grade.Duplo += r =>
        {
            switch (_grupo)
            {
                case "reservas": if (r.B("pago") || r.S("status") == "cancelada") Acoes.EditarReserva(this, r); else Caixa.CheckoutDeReservas(this, [r]); break;
                case "baterias": Selecionar("reservas:todas", r); break;
                case "vendas": new FormVenda(r.L("id") ?? 0).ShowDialog(this); break;
            }
        };
    }
}

sealed class MenuRecepcaoRenderer : ToolStripProfessionalRenderer
{
    sealed class Cores : ProfessionalColorTable
    {
        public override Color ToolStripDropDownBackground => Color.FromArgb(250, 250, 252);
        public override Color MenuBorder => Color.FromArgb(225, 225, 230);
        public override Color MenuItemSelected => Color.FromArgb(232, 245, 238);
        public override Color MenuItemSelectedGradientBegin => Color.FromArgb(232, 245, 238);
        public override Color MenuItemSelectedGradientEnd => Color.FromArgb(232, 245, 238);
        public override Color MenuItemPressedGradientBegin => Color.FromArgb(220, 238, 228);
        public override Color MenuItemPressedGradientEnd => Color.FromArgb(220, 238, 228);
        public override Color SeparatorDark => Color.FromArgb(228, 228, 233);
        public override Color SeparatorLight => Color.FromArgb(228, 228, 233);
    }

    public MenuRecepcaoRenderer() : base(new Cores()) { }

    protected override void OnRenderToolStripBackground(ToolStripRenderEventArgs e)
    {
        if (e.ToolStrip is not ToolStripDropDown)
        {
            base.OnRenderToolStripBackground(e);
            return;
        }

        var bounds = e.ToolStrip.ClientRectangle;
        if (bounds.Width < 4 || bounds.Height < 4) return;
        bounds.Inflate(-1, -1);
        using var path = RetanguloArredondado(bounds, 12);
        using var brush = new SolidBrush(Color.FromArgb(250, 250, 252));
        var smoothing = e.Graphics.SmoothingMode;
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        e.Graphics.FillPath(brush, path);
        e.Graphics.SmoothingMode = smoothing;

        var region = new Region(path);
        var anterior = e.ToolStrip.Region;
        e.ToolStrip.Region = region;
        anterior?.Dispose();
    }

    protected override void OnRenderToolStripBorder(ToolStripRenderEventArgs e)
    {
        if (e.ToolStrip is not ToolStripDropDown)
        {
            base.OnRenderToolStripBorder(e);
            return;
        }

        var bounds = e.ToolStrip.ClientRectangle;
        bounds.Inflate(-1, -1);
        using var path = RetanguloArredondado(bounds, 12);
        using var pen = new Pen(Color.FromArgb(225, 225, 230));
        var smoothing = e.Graphics.SmoothingMode;
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        e.Graphics.DrawPath(pen, path);
        e.Graphics.SmoothingMode = smoothing;
    }

    protected override void OnRenderMenuItemBackground(ToolStripItemRenderEventArgs e)
    {
        var principal = e.Item.Tag as string == "principal";
        if (principal || e.Item.Selected && e.Item.Enabled)
        {
            var bounds = e.Item.Bounds;
            bounds.Inflate(-3, -1);
            using var path = RetanguloArredondado(bounds, 7);
            var cor = principal
                ? e.Item.Selected ? Color.FromArgb(8, 85, 58) : Color.FromArgb(11, 122, 83)
                : Color.FromArgb(232, 245, 238);
            using var brush = new SolidBrush(cor);
            var smoothing = e.Graphics.SmoothingMode;
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            e.Graphics.FillPath(brush, path);
            e.Graphics.SmoothingMode = smoothing;
        }
    }

    protected override void OnRenderSeparator(ToolStripSeparatorRenderEventArgs e)
    {
        var y = e.Item.Height / 2;
        using var pen = new Pen(Color.FromArgb(228, 228, 233));
        e.Graphics.DrawLine(pen, 9, y, e.Item.Width - 9, y);
    }

    static GraphicsPath RetanguloArredondado(Rectangle bounds, int raio)
    {
        var d = Math.Max(2, raio * 2);
        var path = new GraphicsPath();
        path.AddArc(bounds.Left, bounds.Top, d, d, 180, 90);
        path.AddArc(bounds.Right - d, bounds.Top, d, d, 270, 90);
        path.AddArc(bounds.Right - d, bounds.Bottom - d, d, d, 0, 90);
        path.AddArc(bounds.Left, bounds.Bottom - d, d, d, 90, 90);
        path.CloseFigure();
        return path;
    }
}
