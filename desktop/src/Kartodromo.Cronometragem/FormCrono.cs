using System.Diagnostics;
using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

/// <summary>
/// Cronometragem (substitui o LapTime Timing): baterias do dia, competidores, bandeiras,
/// registro de passagens e resultado ao vivo, lidos do servico de cronometragem (ORBITS :4050).
/// </summary>
public class FormCrono : Form
{
    readonly string _autoteste;
    readonly System.Windows.Forms.Timer _leitura = new() { Interval = 1000 };
    readonly System.Windows.Forms.Timer _relogio = new() { Interval = 100 };
    JsonObject _state;
    JsonObject _sess;
    List<JsonObject> _laps = [];
    List<JsonObject> _agenda = [];
    DateTime _lidoEm = DateTime.Now;
    string _sel;
    bool _fixado, _ocupado, _servidorOk, _pilotosSujos;
    string _pilotosDe;
    FormTV _tv;

    // cabecalho da cronometragem
    readonly Label _lEvento = Info(), _lTipo = Info(), _lEstado = Info(), _lCrono = new(), _lRestante = Info(), _lVoltasRest = Info(), _lMelhor = Info(), _lRuido = Info(), _lPassagens = new();
    readonly ComboBox _cbSessao = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 420, Font = new Font("Segoe UI", 9.5F) };
    readonly ToolStrip _bandeiras = new() { GripStyle = ToolStripGripStyle.Hidden, ImageScalingSize = new Size(34, 34), BackColor = Color.White, Padding = new Padding(4, 2, 4, 2) };
    ToolStripButton _bVerde, _bQuad, _bEncerrar, _bCancelar;
    readonly LiveGrid _gPass = new(), _gRes = new(), _gSessoes = new(), _gAgenda = new();
    readonly DataGridView _gPilotos = new();
    readonly Label _lPilotosTitulo = new() { Dock = DockStyle.Top, Height = 34, Font = new Font("Segoe UI", 13F, FontStyle.Bold), ForeColor = Color.FromArgb(200, 16, 46), TextAlign = ContentAlignment.MiddleLeft, Padding = new Padding(4, 0, 0, 0) };
    readonly TabControl _abas = new() { Dock = DockStyle.Fill, Font = new Font("Segoe UI", 9F) };
    readonly StatusStrip _status = new() { SizingGrip = false };
    readonly ToolStripStatusLabel _sHora = new(), _sData = new(), _sServidor = new(), _sDecoder = new(), _sTransp = new() { IsLink = true, ForeColor = Color.Red }, _sTv = new() { IsLink = true };

    static Label Info() => new() { AutoSize = true, Font = new Font("Segoe UI", 9F, FontStyle.Bold) };

    public FormCrono(string autoteste)
    {
        _autoteste = autoteste;
        Text = "Kartódromo - Cronometragem";
        Icon = Icone.App;
        Font = new Font("Segoe UI", 9F);
        BackColor = Color.FromArgb(244, 244, 244);
        KeyPreview = true;
        if (autoteste == null) WindowState = FormWindowState.Maximized;
        else { StartPosition = FormStartPosition.Manual; Location = new Point(0, 0); Size = new Size(1600, 900); }
        MinimumSize = new Size(1100, 700);

        MainMenuStrip = Menu();
        var empresa = new Label { Text = "KARTÓDROMO INTERNACIONAL DE BETIM — CRONOMETRAGEM", Dock = DockStyle.Top, Height = 30, Font = new Font("Segoe UI", 10.5F, FontStyle.Bold), TextAlign = ContentAlignment.MiddleLeft, Padding = new Padding(4, 0, 0, 0) };
        _abas.TabPages.Add(AbaBaterias());
        _abas.TabPages.Add(AbaCronometragem());
        _abas.SelectedIndex = 1;
        _abas.SelectedIndexChanged += (_, _) => { if (_abas.SelectedIndex == 0) _ = CarregarAgenda(); };

        _status.Items.AddRange([_sHora, Sep(), _sData, Sep(), _sServidor, Sep(), _sDecoder, Sep(), _sTv, Sep(), _sTransp]);
        _sTv.Text = "TV";
        _sTv.Click += (_, _) => AbrirTV();
        _sTransp.Click += (_, _) => Transponders();
        Controls.Add(_abas);
        Controls.Add(empresa);
        Controls.Add(MainMenuStrip);
        Controls.Add(_status);

        _leitura.Tick += async (_, _) => await Atualizar();
        _relogio.Tick += (_, _) => Relogio();
        KeyDown += (_, e) =>
        {
            if (e.KeyCode == Keys.F2) { e.Handled = true; NovaBateria(null); }
            else if (e.KeyCode == Keys.F5) { e.Handled = true; Acao("start"); }
            else if (e.KeyCode == Keys.F6) { e.Handled = true; Acao("checkered"); }
            else if (e.KeyCode == Keys.F7) { e.Handled = true; Acao("close"); }
            else if (e.KeyCode == Keys.F11) { e.Handled = true; AbrirTV(); }
        };
        Shown += async (_, _) =>
        {
            await Atualizar();
            await CarregarAgenda();
            if (_autoteste != null) { await AutoTeste(); return; }
            _leitura.Start();
            _relogio.Start();
        };
        FormClosed += (_, _) => { _tv?.Close(); };
    }

    static ToolStripSeparator Sep() => new();

    MenuStrip Menu()
    {
        var m = new MenuStrip { BackColor = Color.White, Padding = new Padding(6, 3, 0, 3) };
        var inicio = new ToolStripMenuItem("Início");
        inicio.DropDownItems.Add("Sair", null, (_, _) => Close());
        var crono = new ToolStripMenuItem("Cronometragem");
        crono.DropDownItems.Add(new ToolStripMenuItem("Nova bateria...", null, (_, _) => NovaBateria(null), Keys.F2));
        crono.DropDownItems.Add(new ToolStripSeparator());
        crono.DropDownItems.Add(new ToolStripMenuItem("Bandeira verde (largada)", null, (_, _) => Acao("start")) { ShortcutKeyDisplayString = "F5" });
        crono.DropDownItems.Add(new ToolStripMenuItem("Bandeira quadriculada", null, (_, _) => Acao("checkered")) { ShortcutKeyDisplayString = "F6" });
        crono.DropDownItems.Add(new ToolStripMenuItem("Encerrar bateria", null, (_, _) => Acao("close")) { ShortcutKeyDisplayString = "F7" });
        crono.DropDownItems.Add(new ToolStripMenuItem("Cancelar bateria", null, (_, _) => Acao("cancel")));
        crono.DropDownItems.Add(new ToolStripSeparator());
        crono.DropDownItems.Add("Seguir a bateria em andamento", null, (_, _) => { _fixado = false; _ = Atualizar(); });
        var ferr = new ToolStripMenuItem("Ferramentas");
        ferr.DropDownItems.Add("Transponders (kart ↔ transponder)...", null, (_, _) => Transponders());
        ferr.DropDownItems.Add(new ToolStripMenuItem("Telão / TV", null, (_, _) => AbrirTV()) { ShortcutKeyDisplayString = "F11" });
        ferr.DropDownItems.Add("Abrir operador no navegador", null, (_, _) => Process.Start(new ProcessStartInfo(Config.CronoUrl + "/operador") { UseShellExecute = true }));
        var rel = new ToolStripMenuItem("Relatórios");
        rel.DropDownItems.Add("Resultado da bateria selecionada", null, (_, _) => Resultado());
        var ajuda = new ToolStripMenuItem("Ajuda");
        ajuda.DropDownItems.Add("Sobre", null, (_, _) => Msg.Info(this, $"Kartódromo - Cronometragem\nVersão {Application.ProductVersion.Split('+')[0]}\n\nServiço de cronometragem: {Config.CronoUrl}\nServidor da operação: {Config.ServidorUrl}\n\nAtalhos: F2 nova bateria · F5 bandeira verde · F6 quadriculada · F7 encerrar · F11 telão", "Sobre"));
        m.Items.AddRange([inicio, crono, ferr, rel, ajuda]);
        return m;
    }

    // ------------------------------------------------------------------ aba 1: baterias e competidores

    TabPage AbaBaterias()
    {
        var aba = new TabPage("Baterias e Competidores") { BackColor = Color.White, Padding = new Padding(4) };
        var split = new SplitContainer { Dock = DockStyle.Fill, SplitterWidth = 6, FixedPanel = FixedPanel.Panel1 };

        // esquerda: agenda do SRVKART + baterias da cronometragem
        var esq = new SplitContainer { Dock = DockStyle.Fill, Orientation = Orientation.Horizontal, SplitterWidth = 6 };
        _gAgenda.Col("Hora", 60).Col("Bateria", 150, DataGridViewContentAlignment.MiddleLeft, true).Col("Kart", 60).Col("Inscritos", 70).Col("Pagos", 60);
        _gAgenda.CellDoubleClick += (_, e) => { if (e.RowIndex >= 0) NovaBateria(_gAgenda.Chaves[e.RowIndex] as JsonObject); };
        var barraAg = new ToolStrip { GripStyle = ToolStripGripStyle.Hidden, BackColor = Color.White, Dock = DockStyle.Bottom };
        barraAg.Items.Add(new ToolStripButton("Criar bateria da agenda", Icone.Tile("", Color.FromArgb(16, 124, 16), 16), (_, _) => NovaBateria(_gAgenda.ChaveAtual as JsonObject)));
        barraAg.Items.Add(new ToolStripButton("Atualizar", Icone.Tile("", Color.FromArgb(0, 99, 177), 16), async (_, _) => await CarregarAgenda()));
        esq.Panel1.Controls.Add(_gAgenda);
        esq.Panel1.Controls.Add(barraAg);
        esq.Panel1.Controls.Add(new Faixa("PASSO 1: AGENDA DO DIA (RECEPÇÃO)", Color.FromArgb(200, 16, 46)));

        _gSessoes.Col("Criada", 60).Col("Bateria", 200, DataGridViewContentAlignment.MiddleLeft, true).Col("Tipo", 100).Col("Estado", 100).Col("Pilotos", 55);
        _gSessoes.CorTexto = (r, c) => c == 3 && r < _gSessoes.Chaves.Count && _gSessoes.Chaves[r] is JsonObject s ? Crono.CorEstado(s.S("state")) : null;
        _gSessoes.CellClick += (_, e) => { if (e.RowIndex >= 0 && _gSessoes.Chaves[e.RowIndex] is JsonObject s) Selecionar(s.S("id")); };
        var barraS = new ToolStrip { GripStyle = ToolStripGripStyle.Hidden, BackColor = Color.White, Dock = DockStyle.Bottom };
        barraS.Items.Add(new ToolStripButton("Nova bateria", Icone.Tile("", Color.FromArgb(16, 124, 16), 16), (_, _) => NovaBateria(null)));
        barraS.Items.Add(new ToolStripButton("Cronometrar esta", Icone.Tile("", Color.FromArgb(0, 99, 177), 16), (_, _) => { if (_gSessoes.ChaveAtual is JsonObject s) { Selecionar(s.S("id")); _abas.SelectedIndex = 1; } }));
        barraS.Items.Add(new ToolStripButton("Cancelar bateria", Icone.Tile("", Color.FromArgb(196, 43, 28), 16), (_, _) => Acao("cancel")));
        esq.Panel2.Controls.Add(_gSessoes);
        esq.Panel2.Controls.Add(barraS);
        esq.Panel2.Controls.Add(new Faixa("PASSO 2: BATERIAS DA CRONOMETRAGEM", Color.FromArgb(200, 16, 46)));
        split.Panel1.Controls.Add(esq);

        // direita: competidores da bateria selecionada (editavel)
        _gPilotos.Dock = DockStyle.Fill;
        _gPilotos.BackgroundColor = Color.White;
        _gPilotos.BorderStyle = BorderStyle.None;
        _gPilotos.RowHeadersWidth = 28;
        _gPilotos.AllowUserToAddRows = true;
        _gPilotos.AllowUserToResizeRows = false;
        _gPilotos.EnableHeadersVisualStyles = false;
        _gPilotos.ColumnHeadersDefaultCellStyle.BackColor = Color.FromArgb(249, 249, 249);
        _gPilotos.ColumnHeadersHeight = 28;
        _gPilotos.RowTemplate.Height = 25;
        _gPilotos.Font = new Font("Segoe UI", 9.5F);
        _gPilotos.Columns.Add(new DataGridViewTextBoxColumn { Name = "kart", HeaderText = "Nº (kart)", Width = 90 });
        _gPilotos.Columns.Add(new DataGridViewTextBoxColumn { Name = "name", HeaderText = "Competidor", AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill });
        _gPilotos.Columns.Add(new DataGridViewTextBoxColumn { Name = "customerId", HeaderText = "Cliente", Width = 90, ReadOnly = true });
        _gPilotos.CellValueChanged += (_, _) => _pilotosSujos = true;
        _gPilotos.UserDeletedRow += (_, _) => _pilotosSujos = true;
        var barraP = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 62, Padding = new Padding(4, 8, 4, 4), BackColor = Color.White };
        barraP.Controls.Add(BotaoGrande("Salvar\nCompetidores", "", Color.FromArgb(16, 124, 16), async () => await SalvarPilotos()));
        barraP.Controls.Add(BotaoGrande("Puxar da\nAgenda", "", Color.FromArgb(0, 99, 177), async () => await PuxarAgenda()));
        barraP.Controls.Add(BotaoGrande("Excluir\nCompetidor", "", Color.FromArgb(196, 43, 28), () => { foreach (DataGridViewRow r in _gPilotos.SelectedRows) if (!r.IsNewRow) _gPilotos.Rows.Remove(r); _pilotosSujos = true; return Task.CompletedTask; }));
        barraP.Controls.Add(BotaoGrande("Transponders", "", Color.FromArgb(90, 90, 90), () => { Transponders(); return Task.CompletedTask; }));
        split.Panel2.Controls.Add(_gPilotos);
        split.Panel2.Controls.Add(_lPilotosTitulo);
        split.Panel2.Controls.Add(barraP);
        split.Panel2.Controls.Add(new Faixa("PASSO 3: LISTA DE COMPETIDORES", Color.FromArgb(200, 16, 46)));
        aba.Controls.Add(split);
        aba.Layout += (_, _) => { if (split.Width > 900 && split.SplitterDistance < 300) { split.Panel1MinSize = 300; split.SplitterDistance = Math.Min(560, split.Width / 2 - 100); esq.SplitterDistance = esq.Height / 2 - 20; } };
        return aba;
    }

    Button BotaoGrande(string texto, string glifo, Color cor, Func<Task> clique)
    {
        var b = new Button { Text = texto, Image = Icone.Tile(glifo, cor, 18), TextImageRelation = TextImageRelation.ImageAboveText, Size = new Size(92, 48), FlatStyle = FlatStyle.System, Font = new Font("Segoe UI", 8F), Margin = new Padding(0, 0, 8, 0) };
        b.FlatStyle = FlatStyle.Standard;
        b.Click += (_, _) => Seguro.Rodar(this, clique);
        return b;
    }

    // ------------------------------------------------------------------ aba 2: cronometragem

    TabPage AbaCronometragem()
    {
        var aba = new TabPage("Cronometragem") { BackColor = Color.FromArgb(244, 244, 244) };

        // cabecalho: evento/prova | cronometro | tempos
        var cab = new TableLayoutPanel { Dock = DockStyle.Top, Height = 64, ColumnCount = 3, BackColor = Color.FromArgb(244, 244, 244), Padding = new Padding(4, 2, 4, 0) };
        cab.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 42));
        cab.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 20));
        cab.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 38));
        var esq = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 3, AutoSize = false };
        esq.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 60));
        void Linha(TableLayoutPanel t, string rot, Control c) { t.Controls.Add(new Label { Text = rot, AutoSize = true, Margin = new Padding(0, 2, 0, 0) }); c.Margin = new Padding(0, 2, 0, 0); t.Controls.Add(c); }
        Linha(esq, "Bateria:", _lEvento);
        Linha(esq, "Tipo:", _lTipo);
        Linha(esq, "Estado:", _lEstado);
        var meio = new Panel { Dock = DockStyle.Fill };
        var rotCrono = new Label { Text = "Cronômetro:", Dock = DockStyle.Top, Height = 20, Font = new Font("Segoe UI", 9.5F, FontStyle.Bold), TextAlign = ContentAlignment.BottomCenter };
        _lCrono.Dock = DockStyle.Fill; _lCrono.Font = new Font("Segoe UI", 17F, FontStyle.Bold); _lCrono.TextAlign = ContentAlignment.TopCenter; _lCrono.Text = "00:00:00.000";
        meio.Controls.Add(_lCrono); meio.Controls.Add(rotCrono);
        var dir = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 4, RowCount = 3 };
        dir.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 125));
        dir.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 40));
        dir.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 135));
        dir.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 60));
        _lRestante.ForeColor = Color.Red; _lVoltasRest.ForeColor = Color.Red; _lRuido.ForeColor = Color.Red; _lMelhor.ForeColor = Color.FromArgb(16, 124, 16);
        dir.Controls.Add(new Label { Text = "Tempo Restante:", AutoSize = true }); dir.Controls.Add(_lRestante);
        dir.Controls.Add(new Label { Text = "Volta(s) Restante(s):", AutoSize = true }); dir.Controls.Add(_lVoltasRest);
        dir.Controls.Add(new Label { Text = "Ruído (decoder):", AutoSize = true }); dir.Controls.Add(_lRuido);
        dir.Controls.Add(new Label { Text = "", AutoSize = true }); dir.Controls.Add(new Label());
        var lmv = new Label { Text = "Melhor Volta:", AutoSize = true };
        dir.Controls.Add(lmv); dir.Controls.Add(_lMelhor);
        dir.SetColumnSpan(_lMelhor, 3);
        cab.Controls.Add(esq); cab.Controls.Add(meio); cab.Controls.Add(dir);

        // bandeiras
        _bVerde = Band("Largada", Bandeira(Color.FromArgb(40, 180, 40)), "Bandeira verde: inicia a bateria (F5)", () => Acao("start"));
        _bQuad = Band("Quadriculada", Quadriculada(), "Bandeira quadriculada: cada kart termina ao passar (F6)", () => Acao("checkered"));
        _bEncerrar = Band("Encerrar", Icone.Tile("", Color.FromArgb(220, 30, 30), 34), "Encerrar a bateria agora (F7)", () => Acao("close"));
        _bCancelar = Band("Cancelar", Icone.Tile("", Color.FromArgb(120, 120, 120), 34), "Cancelar a bateria (descarta)", () => Acao("cancel"));
        _bandeiras.Items.AddRange([_bVerde, _bQuad, _bEncerrar, _bCancelar, new ToolStripSeparator()]);
        _bandeiras.Items.Add(Band("Nova", Icone.Tile("", Color.FromArgb(16, 124, 16), 34), "Nova bateria (F2)", () => NovaBateria(null)));
        _bandeiras.Items.Add(Band("Telão", Icone.Tile("", Color.FromArgb(0, 99, 177), 34), "Abrir o telão / TV (F11)", AbrirTV));
        _bandeiras.Items.Add(Band("Imprimir", Icone.Tile("", Color.FromArgb(70, 70, 70), 34), "Resultado da bateria", Resultado));
        _bandeiras.Items.Add(Band("Transp.", Icone.Tile("", Color.FromArgb(90, 90, 90), 34), "Transponders", Transponders));
        _bandeiras.Items.Add(new ToolStripSeparator());
        _bandeiras.Items.Add(new ToolStripLabel("Bateria:"));
        _bandeiras.Items.Add(new ToolStripControlHost(_cbSessao) { AutoSize = false, Width = 420 });
        _cbSessao.SelectionChangeCommitted += (_, _) => { if (_cbSessao.SelectedItem is Campos.Item it) Selecionar(it.Dados.S("id")); };
        _lPassagens.Text = "0";
        _lPassagens.Font = new Font("Segoe UI", 16F, FontStyle.Bold);
        _bandeiras.Items.Add(new ToolStripLabel("Passagens:") { Alignment = ToolStripItemAlignment.Right, Font = new Font("Segoe UI", 9.5F, FontStyle.Bold) });
        var hostPass = new ToolStripControlHost(_lPassagens) { Alignment = ToolStripItemAlignment.Right, AutoSize = false, Width = 70 };
        _bandeiras.Items.Insert(_bandeiras.Items.Count - 1, hostPass);

        // grades
        var split = new SplitContainer { Dock = DockStyle.Fill, SplitterWidth = 6, BackColor = Color.FromArgb(244, 244, 244) };
        _gPass.Col("#", 44).Col("Nº", 46).Col("Competidor", 150, DataGridViewContentAlignment.MiddleCenter, true).Col("Tempo", 90).Col("Volta", 50).Col("Hora", 96);
        _gPass.CorFundo = r => r < _gPass.Chaves.Count && _gPass.Chaves[r] is JsonObject p && p.B("invalid") ? Color.FromArgb(230, 20, 20) : null;
        _gPass.CorFonteLinha = r => r < _gPass.Chaves.Count && _gPass.Chaves[r] is JsonObject p && p.B("invalid") ? Color.White : null;
        _gPass.CellDoubleClick += (_, e) => { if (e.RowIndex >= 0 && _gPass.Chaves[e.RowIndex] is JsonObject p) Voltas(p.S("kart")); };
        var menuPass = new ContextMenuStrip();
        menuPass.Items.Add("Invalidar / validar esta volta", null, async (_, _) => { if (_gPass.ChaveAtual is JsonObject p) await Invalidar(p.S("kart"), p.I("lap")); });
        menuPass.Items.Add("Ver voltas deste kart", null, (_, _) => { if (_gPass.ChaveAtual is JsonObject p) Voltas(p.S("kart")); });
        _gPass.ContextMenuStrip = menuPass;
        split.Panel1.Controls.Add(_gPass);
        split.Panel1.Controls.Add(new Faixa("REGISTRO DE PASSAGENS", Color.FromArgb(16, 150, 40)));

        _gRes.Col("", 22).Col("Pos", 44).Col("Nº", 46).Col("Competidor", 170, DataGridViewContentAlignment.MiddleCenter, true).Col("Voltas", 56).Col("T.U.V", 86).Col("T.M.V", 86).Col("M.V", 44).Col("D.L", 90).Col("D.A", 86).Col("Situação", 90);
        _gRes.Font = new Font("Segoe UI", 10F, FontStyle.Bold);
        _gRes.CorTexto = (r, c) => c == 0 && r < _gRes.Chaves.Count && _gRes.Chaves[r] is JsonObject s ? CorAtraso(s) : null;
        _gRes.CellDoubleClick += (_, e) => { if (e.RowIndex >= 0 && _gRes.Chaves[e.RowIndex] is JsonObject s) Voltas(s.S("kart")); };
        var legenda = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 26, BackColor = Color.White, Padding = new Padding(6, 4, 0, 0) };
        foreach (var (cor, txt) in new[] { (Color.FromArgb(0, 190, 0), "NA MESMA VOLTA DO LÍDER"), (Color.Gold, "ATÉ 2 VOLTAS ATRÁS"), (Color.Red, "ATÉ 5 VOLTAS ATRÁS"), (Color.Black, "+ DE 5 VOLTAS ATRÁS") })
        {
            legenda.Controls.Add(new Label { Text = "●", ForeColor = cor, AutoSize = true, Font = new Font("Segoe UI", 10F, FontStyle.Bold), Margin = new Padding(8, 0, 0, 0) });
            legenda.Controls.Add(new Label { Text = txt, AutoSize = true, Font = new Font("Segoe UI", 8.5F, FontStyle.Bold), Margin = new Padding(0, 2, 14, 0) });
        }
        legenda.Controls.Add(new Label { Text = "(duplo clique: voltas do kart)", AutoSize = true, ForeColor = Color.Gray, Margin = new Padding(10, 2, 0, 0) });
        split.Panel2.Controls.Add(_gRes);
        split.Panel2.Controls.Add(legenda);
        split.Panel2.Controls.Add(new Faixa("RESULTADO OFICIAL", Color.FromArgb(40, 40, 40)));
        aba.Controls.Add(split);
        aba.Controls.Add(_bandeiras);
        aba.Controls.Add(cab);
        aba.Layout += (_, _) => { if (split.Width > 900 && split.SplitterDistance != (int)(split.Width * .36)) { split.Panel1MinSize = 300; split.SplitterDistance = (int)(split.Width * .36); } };
        return aba;
    }

    ToolStripButton Band(string texto, Image img, string dica, Action clique)
    {
        var b = new ToolStripButton(texto, img, (_, _) => clique()) { TextImageRelation = TextImageRelation.ImageAboveText, ToolTipText = dica, Font = new Font("Segoe UI", 8F), AutoSize = true, Padding = new Padding(4, 0, 4, 0) };
        return b;
    }

    static Bitmap Bandeira(Color cor)
    {
        var bmp = new Bitmap(34, 34);
        using var g = Graphics.FromImage(bmp);
        g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        using var haste = new Pen(Color.FromArgb(90, 90, 90), 2.5f);
        g.DrawLine(haste, 6, 3, 6, 32);
        using var b = new SolidBrush(cor);
        g.FillPolygon(b, new PointF[] { new(7, 4), new(20, 2), new(31, 6), new(31, 20), new(20, 17), new(7, 19) });
        using var borda = new Pen(ControlPaint.Dark(cor, .2f));
        g.DrawPolygon(borda, new PointF[] { new(7, 4), new(20, 2), new(31, 6), new(31, 20), new(20, 17), new(7, 19) });
        return bmp;
    }

    static Bitmap Quadriculada()
    {
        var bmp = new Bitmap(34, 34);
        using var g = Graphics.FromImage(bmp);
        using var haste = new Pen(Color.FromArgb(90, 90, 90), 2.5f);
        g.DrawLine(haste, 6, 3, 6, 32);
        for (var y = 0; y < 4; y++)
            for (var x = 0; x < 6; x++)
                g.FillRectangle((x + y) % 2 == 0 ? Brushes.Black : Brushes.White, 7 + x * 4, 3 + y * 4, 4, 4);
        g.DrawRectangle(Pens.Black, 7, 3, 24, 16);
        return bmp;
    }

    static Color? CorAtraso(JsonObject s)
    {
        var atras = s.I("gapLaps");
        return atras <= 0 ? Color.FromArgb(0, 190, 0) : atras <= 2 ? Color.Gold : atras <= 5 ? Color.Red : Color.Black;
    }

    // ------------------------------------------------------------------ leitura

    void Selecionar(string id)
    {
        if (string.IsNullOrEmpty(id)) return;
        _sel = id; _fixado = true;
        _ = Atualizar();
    }

    async Task Atualizar()
    {
        if (_ocupado) return;
        _ocupado = true;
        try
        {
            _state = (await Crono.Api.Get("/api/state"))?.AsObject();
            var focus = _state?["focus"] as JsonObject;
            var correndo = _state.S("runningId");
            if (!_fixado || _sel == null) _sel = correndo.Length > 0 ? correndo : focus?.S("id") ?? _sel;
            if (_sel != null)
            {
                _sess = focus != null && focus.S("id") == _sel ? focus : (await Crono.Api.Get("/api/sessions/" + _sel))?.AsObject();
                _laps = await Crono.Api.Lista($"/api/sessions/{_sel}/laps");
            }
            else { _sess = null; _laps = []; }
            _servidorOk = true;
        }
        catch (ApiException e) when (e.Status == 404) { _fixado = false; _sel = null; }
        catch (ApiException) { _servidorOk = false; }
        finally { _ocupado = false; }
        _lidoEm = DateTime.Now;
        Desenhar();
    }

    async Task CarregarAgenda()
    {
        try { _agenda = await Crono.Api.Lista("/api/agenda"); }
        catch (ApiException e) { _agenda = []; _gAgenda.Preencher([new object[] { "", "Agenda indisponível: " + e.Message, "", "", "" }]); return; }
        _gAgenda.Preencher(_agenda.Select(b => new object[] { Fmt.Hm(b.S("inicio")), b.S("nome"), b.S("tipoKart") == "super" ? "Super" : "Light", b.I("inscritos"), b.I("pagos") }).ToList(), _agenda.Cast<object>().ToList());
    }

    void Desenhar()
    {
        var dec = _state?["decoder"] as JsonObject;
        _sServidor.Text = _servidorOk ? "CRONOMETRAGEM: ON-LINE" : "CRONOMETRAGEM: SEM CONEXÃO (" + Config.CronoUrl + ")";
        _sServidor.ForeColor = _servidorOk ? Color.FromArgb(16, 124, 16) : Color.Red;
        var decOk = dec?.B("healthy") ?? false;
        _sDecoder.Text = "DECODER " + (dec == null ? "?" : decOk ? $"OK ({dec.S("host")})" : dec.B("connected") ? "SEM DADOS" : "DESCONECTADO");
        _sDecoder.ForeColor = decOk ? Color.FromArgb(16, 124, 16) : Color.Red;
        _sDecoder.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
        _sServidor.Font = _sDecoder.Font;
        _lRuido.Text = dec?.S("noise") ?? "---";
        _sTv.ForeColor = _tv is { IsDisposed: false } ? Color.FromArgb(16, 124, 16) : Color.Red;
        _sTv.Font = _sDecoder.Font;

        // transponder sem kart nos ultimos 2 minutos
        var agora = DateTimeOffset.Now.ToUnixTimeMilliseconds();
        var desconhecidos = Crono.Arr(_state, "recentPassings").Where(p => p.S("result") == "transponder-desconhecido" && agora - (p.L("wallMs") ?? 0) < 120_000).Select(p => p.S("transponder")).Distinct().ToList();
        _sTransp.Text = desconhecidos.Count > 0 ? "TRANSPONDER SEM KART: " + string.Join(", ", desconhecidos) + " (clique para associar)" : "";

        // lista de baterias (aba 1 e combo)
        var sessoes = Crono.Arr(_state, "sessions");
        _gSessoes.Preencher(sessoes.Select(s => new object[] { Crono.Hora(s.L("createdAt"))[..5], s.S("name"), Crono.Tipo(s.S("type")), Crono.Estado(s.S("state")), s.I("competitors") }).ToList(), sessoes.Cast<object>().ToList());
        var itens = sessoes.Select(s => new Campos.Item(0, $"{Crono.Hora(s.L("createdAt"))[..5]}  {s.S("name")}  ·  {Crono.Tipo(s.S("type"))}  ·  {Crono.Estado(s.S("state"))}", s)).ToArray();
        if (!_cbSessao.DroppedDown)
        {
            var textos = itens.Select(i => i.Texto).ToList();
            if (!_cbSessao.Items.Cast<Campos.Item>().Select(i => i.Texto).SequenceEqual(textos)) { _cbSessao.Items.Clear(); _cbSessao.Items.AddRange(itens); }
            var idx = itens.ToList().FindIndex(i => i.Dados.S("id") == _sel);
            if (_cbSessao.SelectedIndex != idx) _cbSessao.SelectedIndex = idx;
        }

        var s0 = _sess;
        var estado = s0?.S("state") ?? "";
        _lEvento.Text = s0?.S("name") ?? "(nenhuma bateria — F2 cria uma nova)";
        _lTipo.Text = s0 == null ? "" : Crono.Tipo(s0.S("type")) + (s0.L("maxLaps") is long ml && ml > 0 ? $" · {ml} voltas" : s0.L("durationMs") is long dm && dm > 0 ? $" · {dm / 60000} min" : "");
        _lEstado.Text = Crono.Estado(estado);
        _lEstado.ForeColor = Crono.CorEstado(estado);
        _bVerde.Enabled = estado == "preparando";
        _bQuad.Enabled = estado == "em_andamento";
        _bEncerrar.Enabled = estado is "em_andamento" or "bandeira_final";
        _bCancelar.Enabled = estado is "preparando" or "em_andamento";

        var standings = Crono.Arr(s0, "standings");
        var lider = standings.FirstOrDefault();
        _lVoltasRest.Text = s0?.L("maxLaps") is long mx && mx > 0 ? Math.Max(0, mx - (lider?.I("laps") ?? 0)).ToString() : "---";
        var melhor = standings.Where(x => x.L("bestLapMs") != null).OrderBy(x => x.L("bestLapMs")).FirstOrDefault();
        _lMelhor.Text = melhor == null ? "---" : $"{(melhor.S("name").Length > 0 ? melhor.S("name") : "KART " + melhor.S("kart")).ToUpperInvariant()} - {Crono.Volta(melhor.L("bestLapMs"))} NA VOLTA Nº {melhor.S("bestLapNumber")}";

        // resultado
        var linhas = new List<object[]>();
        long? gapAnterior = null; var voltasAnterior = -1;
        foreach (var r in standings)
        {
            var gapL = r.I("gapLaps");
            var dl = r.I("position") == 1 ? "" : gapL > 0 ? $"+{gapL} volta{(gapL > 1 ? "s" : "")}" : Crono.Volta(r.L("gapMs"));
            var da = "";
            if (r.I("position") > 1)
            {
                if (s0.S("type") == "corrida" && r.I("laps") != voltasAnterior) da = $"+{voltasAnterior - r.I("laps")} v";
                else if (r.L("gapMs") is long g && gapAnterior is long ga) da = Crono.Volta(g - ga);
            }
            gapAnterior = r.L("gapMs") ?? (r.I("position") == 1 ? 0 : null);
            voltasAnterior = r.I("laps");
            linhas.Add([
                "●", r.I("position"), r.S("kart"), r.S("name").Length > 0 ? r.S("name") : "Kart " + r.S("kart"), r.I("laps"),
                Crono.Volta(r.L("lastLapMs")), Crono.Volta(r.L("bestLapMs")), r.S("bestLapNumber"), dl, da,
                r.B("finished") ? "🏁 Terminou" : r.B("autoAdded") ? "Sem inscrição" : "",
            ]);
        }
        _gRes.Preencher(linhas, standings.Cast<object>().ToList());

        // passagens
        var pass = _laps.SelectMany(c => Crono.Arr(c, "laps").Select(l => new JsonObject
        {
            ["kart"] = c.S("kart"), ["name"] = c.S("name"), ["lap"] = l.I("lap"), ["lapMs"] = l.L("lapMs"), ["wallMs"] = l.L("wallMs"), ["invalid"] = l.B("invalid"),
        })).OrderByDescending(p => p.L("wallMs")).ToList();
        _lPassagens.Text = pass.Count.ToString();
        _gPass.Preencher(pass.Select((p, i) => new object[] { pass.Count - i, p.S("kart"), p.S("name"), Crono.Volta(p.L("lapMs")), p.I("lap"), Crono.Hora(p.L("wallMs")) }).ToList(), pass.Cast<object>().ToList());

        // competidores (aba 1): so recarrega se o operador nao estiver editando
        if (s0 != null && (_pilotosDe != s0.S("id") || !_pilotosSujos) && !_gPilotos.IsCurrentCellInEditMode)
        {
            var comps = Crono.Arr(s0, "competitors");
            var atual = _gPilotos.Rows.Cast<DataGridViewRow>().Where(r => !r.IsNewRow).Select(r => $"{r.Cells[0].Value}|{r.Cells[1].Value}").ToList();
            var novo = comps.Select(c => $"{c.S("kart")}|{c.S("name")}").ToList();
            if (_pilotosDe != s0.S("id") || !atual.SequenceEqual(novo))
            {
                _gPilotos.Rows.Clear();
                foreach (var c in comps) _gPilotos.Rows.Add(c.S("kart"), c.S("name"), c.S("customerId"));
                _pilotosSujos = false;
            }
            _pilotosDe = s0.S("id");
            _lPilotosTitulo.Text = $"{s0.S("name")} — {Crono.Tipo(s0.S("type")).ToUpperInvariant()} ({Crono.Estado(estado)})";
        }
        else if (s0 == null) _lPilotosTitulo.Text = "Selecione ou crie uma bateria";
        Relogio();
    }

    void Relogio()
    {
        _sHora.Text = DateTime.Now.ToString("HH:mm:ss");
        _sData.Text = DateTime.Now.ToString("dd/MM/yyyy");
        if (_sess == null) { _lCrono.Text = "00:00:00.000"; _lRestante.Text = "---"; return; }
        var andando = _sess.S("state") is "em_andamento" or "bandeira_final";
        var delta = andando ? (long)(DateTime.Now - _lidoEm).TotalMilliseconds : 0;
        _lCrono.Text = Crono.Relogio((_sess.L("elapsedMs") ?? 0) + delta);
        _lRestante.Text = _sess.L("remainingMs") is long rest ? Crono.Relogio(Math.Max(0, rest - delta))[..8] : "---";
    }

    // ------------------------------------------------------------------ acoes

    void Acao(string acao)
    {
        if (_sess == null) { Msg.Aviso(this, "Selecione uma bateria."); return; }
        var nome = _sess.S("name");
        var pergunta = acao switch
        {
            "start" => $"Dar a BANDEIRA VERDE na bateria \"{nome}\"?\n\nO cronômetro começa agora e as passagens passam a contar.",
            "checkered" => $"Dar a BANDEIRA QUADRICULADA em \"{nome}\"?\n\nCada kart termina ao cruzar a linha.",
            "close" => $"ENCERRAR a bateria \"{nome}\" agora?\n\nPassagens depois disso não contam mais.",
            "cancel" => $"CANCELAR a bateria \"{nome}\"?\n\nEla sai da cronometragem (o diário de passagens continua guardado).",
            _ => null,
        };
        if (pergunta == null || !Msg.Pergunta(this, pergunta)) return;
        Seguro.Rodar(this, async () =>
        {
            await Crono.Api.Post($"/api/sessions/{_sess.S("id")}/{acao}");
            if (acao == "start") { _fixado = false; }
            await Atualizar();
        });
    }

    void NovaBateria(JsonObject agenda)
    {
        using var f = new FormNovaBateria(_agenda, agenda);
        if (f.ShowDialog(this) == DialogResult.OK && f.CriadaId != null) { Selecionar(f.CriadaId); _abas.SelectedIndex = 1; }
    }

    async Task SalvarPilotos()
    {
        if (_sess == null) { Msg.Aviso(this, "Selecione uma bateria."); return; }
        _gPilotos.EndEdit();
        var comps = new JsonArray();
        var karts = new HashSet<string>();
        foreach (DataGridViewRow r in _gPilotos.Rows)
        {
            if (r.IsNewRow) continue;
            var kart = r.Cells[0].Value?.ToString()?.Trim() ?? "";
            var nome = r.Cells[1].Value?.ToString()?.Trim() ?? "";
            if (kart.Length == 0 && nome.Length == 0) continue;
            if (kart.Length > 0 && !karts.Add(kart)) { Msg.Aviso(this, $"O kart {kart} está repetido."); return; }
            var cid = r.Cells[2].Value?.ToString();
            comps.Add(new JsonObject { ["kart"] = kart, ["name"] = nome, ["customerId"] = string.IsNullOrEmpty(cid) ? null : cid });
        }
        await Crono.Api.Patch("/api/sessions/" + _sess.S("id"), new JsonObject { ["competitors"] = comps });
        _pilotosSujos = false;
        await Atualizar();
        Msg.Info(this, "Competidores salvos.");
    }

    async Task PuxarAgenda()
    {
        if (_sess == null) { Msg.Aviso(this, "Selecione uma bateria."); return; }
        var ag = _gAgenda.ChaveAtual as JsonObject;
        if (ag == null) { Msg.Aviso(this, "Selecione a bateria da agenda (à esquerda, em cima)."); return; }
        var grid = await Crono.Api.Lista($"/api/agenda/{ag.S("id")}/grid");
        if (grid.Count == 0) { Msg.Aviso(this, "Essa bateria da agenda não tem inscritos."); return; }
        var existentes = _gPilotos.Rows.Cast<DataGridViewRow>().Where(r => !r.IsNewRow).Select(r => r.Cells[2].Value?.ToString()).ToHashSet();
        foreach (var g in grid.Where(g => !existentes.Contains(g.S("clienteId")))) _gPilotos.Rows.Add(g.S("kart"), g.S("nome"), g.S("clienteId"));
        _pilotosSujos = true;
        Msg.Info(this, $"{grid.Count} inscrito(s) da agenda. Confira os números dos karts e clique em Salvar Competidores.");
    }

    async Task Invalidar(string kart, int lap)
    {
        if (_sess == null) return;
        await Crono.Api.Post($"/api/sessions/{_sess.S("id")}/laps/invalidate", new JsonObject { ["kart"] = kart, ["lap"] = lap });
        await Atualizar();
    }

    void Voltas(string kart)
    {
        if (_sess == null) return;
        using var f = new FormVoltas(_sess.S("id"), kart);
        f.ShowDialog(this);
        _ = Atualizar();
    }

    void Transponders()
    {
        var agora = DateTimeOffset.Now.ToUnixTimeMilliseconds();
        var desconhecidos = Crono.Arr(_state, "recentPassings").Where(p => p.S("result") == "transponder-desconhecido" && agora - (p.L("wallMs") ?? 0) < 600_000).Select(p => p.S("transponder")).Distinct().ToList();
        using var f = new FormTransponders(desconhecidos);
        f.ShowDialog(this);
    }

    void AbrirTV()
    {
        if (_tv is { IsDisposed: false }) { _tv.Activate(); return; }
        _tv = new FormTV();
        _tv.Show();
    }

    void Resultado()
    {
        if (_sess == null) { Msg.Aviso(this, "Selecione uma bateria."); return; }
        Relatorio.Abrir(this, $"{Config.CronoUrl}/resultado/{_sess.S("id")}", "Resultado - " + _sess.S("name"));
    }

    // ------------------------------------------------------------------ autoteste

    async Task AutoTeste()
    {
        Directory.CreateDirectory(_autoteste);
        void Foto(Control c, string nome)
        {
            Application.DoEvents();
            using var bmp = new Bitmap(c.Width, c.Height);
            c.DrawToBitmap(bmp, new Rectangle(Point.Empty, c.Size));
            bmp.Save(Path.Combine(_autoteste, nome + ".png"));
        }
        try
        {
            await Task.Delay(300);
            Foto(this, "1-cronometragem");
            _abas.SelectedIndex = 0; await CarregarAgenda(); await Task.Delay(300);
            Foto(this, "2-baterias-competidores");
            using (var f = new FormNovaBateria(_agenda, _agenda.FirstOrDefault())) { f.Show(this); await Task.Delay(300); Foto(f, "3-nova-bateria"); f.Close(); }
            using (var f = new FormTransponders(["9912345"])) { f.Show(this); await Task.Delay(1200); Foto(f, "4-transponders"); f.Close(); }
            var tv = new FormTV(true) { StartPosition = FormStartPosition.Manual, Location = new Point(0, 0), Size = new Size(1280, 720) };
            tv.Show(); await Task.Delay(1500); Foto(tv, "5-telao"); tv.Close();
            File.WriteAllText(Path.Combine(_autoteste, "ok.txt"), "ok");
        }
        catch (Exception e) { File.WriteAllText(Path.Combine(_autoteste, "erro.txt"), e.ToString()); }
        Close();
    }
}
