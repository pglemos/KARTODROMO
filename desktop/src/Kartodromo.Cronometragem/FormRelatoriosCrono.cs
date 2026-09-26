using System.Drawing.Drawing2D;
using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

/// <summary>
/// Diálogo modal oficial "Relatórios de cronometragem" (Resultados, mapas de volta e grids de largada).
/// Alinhado pixel a pixel com RelatoriosCrono.dc.html e Dialogo.dc.html.
/// </summary>
public sealed class FormRelatoriosCrono : Form
{
    readonly JsonObject _state;
    readonly JsonObject _sessaoInicial;

    readonly ComboBox _cbData = Campos.Combo();
    readonly ComboBox _cbEvento = Campos.Combo();
    readonly ComboBox _cbGrupo = Campos.Combo();
    readonly ComboBox _cbProva = Campos.Combo();

    readonly RadioButton _rbOficiais = new() { Text = "Resultados oficiais", Checked = true, AutoSize = true };
    readonly RadioButton _rbSemVelocidade = new() { Text = "Resultados oficiais (sem velocidade média)", AutoSize = true };
    readonly RadioButton _rbComTempoMedio = new() { Text = "Resultados oficiais (com tempo médio)", AutoSize = true };
    readonly RadioButton _rbOrdemChegada = new() { Text = "Resultados oficiais (ordem de chegada)", AutoSize = true };
    readonly RadioButton _rbOrdemChegadaCat = new() { Text = "Resultados oficiais (ordem de chegada com categoria)", AutoSize = true };
    readonly RadioButton _rbPassagens = new() { Text = "Relatório de passagens", AutoSize = true };
    readonly RadioButton _rbVoltaAVolta = new() { Text = "Volta a volta (todos)", AutoSize = true };
    readonly RadioButton _rbMapaVoltas = new() { Text = "Mapa de voltas (todos)", AutoSize = true };
    readonly RadioButton _rbMapaProva = new() { Text = "Mapa de prova", AutoSize = true };
    readonly RadioButton _rbGrid2Esq = new() { Text = "Grid de largada · 2 colunas (líder à esquerda)", AutoSize = true };
    readonly RadioButton _rbGrid2Dir = new() { Text = "Grid de largada · 2 colunas (líder à direita)", AutoSize = true };
    readonly RadioButton _rbGrid3Esq = new() { Text = "Grid de largada · 3 colunas (líder à esquerda)", AutoSize = true };
    readonly RadioButton _rbGrid3Dir = new() { Text = "Grid de largada · 3 colunas (líder à direita)", AutoSize = true };

    List<JsonObject> _sessoes = [];

    public FormRelatoriosCrono(JsonObject state, JsonObject sessaoAtual = null)
    {
        _state = state;
        _sessaoInicial = sessaoAtual ?? (state?["focus"] as JsonObject);

        Text = "Relatórios de cronometragem";
        ClientSize = new Size(960, 600);
        MinimumSize = new Size(880, 560);
        StartPosition = FormStartPosition.CenterParent;
        FormBorderStyle = FormBorderStyle.None;
        MaximizeBox = false;
        MinimizeBox = false;
        ShowInTaskbar = false;
        BackColor = Color.FromArgb(245, 245, 247);
        Font = new Font("Segoe UI", 9.5F);
        KeyPreview = true;
        KeyDown += (_, e) => { if (e.KeyCode == Keys.Escape) Close(); };

        Paint += (_, e) =>
        {
            using var pen = new Pen(Color.FromArgb(200, 200, 205), 1f);
            e.Graphics.DrawRectangle(pen, 0, 0, Width - 1, Height - 1);
        };

        ConstruirInterface();
        CarregarDados();
    }

    void ConstruirInterface()
    {
        // 1. Cabeçalho (64px)
        var pnlHeader = new Panel
        {
            Dock = DockStyle.Top,
            Height = 64,
            BackColor = Color.FromArgb(255, 255, 255),
            Padding = new Padding(18, 12, 18, 12)
        };
        pnlHeader.Paint += (_, e) =>
        {
            using var pen = new Pen(Color.FromArgb(235, 235, 238), 1f);
            e.Graphics.DrawLine(pen, 0, pnlHeader.Height - 1, pnlHeader.Width, pnlHeader.Height - 1);
        };

        // Arrastar janela pelo cabeçalho
        Point arrasto = Point.Empty;
        pnlHeader.MouseDown += (_, e) => { if (e.Button == MouseButtons.Left) arrasto = e.Location; };
        pnlHeader.MouseMove += (_, e) => { if (e.Button == MouseButtons.Left && arrasto != Point.Empty) { Left += e.X - arrasto.X; Top += e.Y - arrasto.Y; } };

        // Ícone gradiente metálico (#9A9AA0 -> #4A4A4F)
        var pnlIcone = new Panel
        {
            Size = new Size(34, 34),
            Location = new Point(18, 15),
            BackColor = Color.Transparent
        };
        pnlIcone.Paint += (_, e) =>
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var path = Arredondado(new Rectangle(0, 0, 34, 34), 9);
            using var brush = new LinearGradientBrush(new Point(0, 0), new Point(0, 34), Color.FromArgb(154, 154, 160), Color.FromArgb(74, 74, 79));
            e.Graphics.FillPath(brush, path);

            // Símbolo de documento
            using var pen = new Pen(Color.White, 2f) { StartCap = LineCap.Round, EndCap = LineCap.Round };
            e.Graphics.DrawRectangle(pen, 9, 8, 16, 18);
            e.Graphics.DrawLine(pen, 13, 14, 21, 14);
            e.Graphics.DrawLine(pen, 13, 18, 21, 18);
        };

        var lTitulo = new Label
        {
            Text = "Relatórios de cronometragem",
            Font = new Font("Segoe UI", 12.5F, FontStyle.Bold),
            ForeColor = Color.FromArgb(29, 29, 31),
            AutoSize = true,
            Location = new Point(62, 13)
        };
        var lSub = new Label
        {
            Text = "Resultados, mapas de volta e grids de largada",
            Font = new Font("Segoe UI", 8.5F),
            ForeColor = Color.FromArgb(110, 110, 115),
            AutoSize = true,
            Location = new Point(63, 36)
        };

        var btnFechar = new Button
        {
            Text = "✕",
            Size = new Size(32, 32),
            Anchor = AnchorStyles.Top | AnchorStyles.Right,
            Location = new Point(pnlHeader.Width - 50, 16),
            FlatStyle = FlatStyle.Flat,
            Font = new Font("Segoe UI", 9F, FontStyle.Bold),
            ForeColor = Color.FromArgb(110, 110, 115),
            BackColor = Color.FromArgb(240, 240, 243),
            Cursor = Cursors.Hand
        };
        btnFechar.FlatAppearance.BorderSize = 0;
        btnFechar.Click += (_, _) => Close();
        pnlHeader.Resize += (_, _) => btnFechar.Left = pnlHeader.ClientSize.Width - 46;

        pnlHeader.Controls.AddRange([pnlIcone, lTitulo, lSub, btnFechar]);
        Controls.Add(pnlHeader);

        // 2. Rodapé (58px)
        var pnlFooter = new Panel
        {
            Dock = DockStyle.Bottom,
            Height = 58,
            BackColor = Color.FromArgb(255, 255, 255),
            Padding = new Padding(18, 12, 18, 12)
        };
        pnlFooter.Paint += (_, e) =>
        {
            using var pen = new Pen(Color.FromArgb(235, 235, 238), 1f);
            e.Graphics.DrawLine(pen, 0, 0, pnlFooter.Width, 0);
        };

        var flowBotoes = new FlowLayoutPanel
        {
            Dock = DockStyle.Right,
            AutoSize = true,
            FlowDirection = FlowDirection.LeftToRight,
            WrapContents = false,
            Padding = new Padding(0)
        };

        var btnCancelar = new Button
        {
            Text = "Cancelar",
            Size = new Size(96, 34),
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(240, 240, 243),
            ForeColor = Color.FromArgb(29, 29, 31),
            Font = new Font("Segoe UI", 9F, FontStyle.Bold),
            Cursor = Cursors.Hand,
            Margin = new Padding(0, 0, 10, 0)
        };
        btnCancelar.FlatAppearance.BorderSize = 0;
        btnCancelar.Click += (_, _) => Close();

        var btnGerar = new Button
        {
            Text = "Gerar relatório",
            Size = new Size(130, 34),
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(11, 122, 83),
            ForeColor = Color.White,
            Font = new Font("Segoe UI", 9.5F, FontStyle.Bold),
            Cursor = Cursors.Hand,
            Margin = new Padding(0)
        };
        btnGerar.FlatAppearance.BorderSize = 0;
        btnGerar.Click += (_, _) => GerarRelatorio();

        flowBotoes.Controls.AddRange([btnCancelar, btnGerar]);
        pnlFooter.Controls.Add(flowBotoes);
        Controls.Add(pnlFooter);

        // 3. Corpo (Scroll)
        var pnlCorpo = new Panel
        {
            Dock = DockStyle.Fill,
            AutoScroll = true,
            Padding = new Padding(18, 14, 18, 14)
        };

        // --- Card 1: Filtros ---
        var tableFiltros = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 4,
            RowCount = 1,
            Padding = new Padding(0, 2, 0, 0)
        };
        tableFiltros.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 17f)); // Data
        tableFiltros.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 33f)); // Evento
        tableFiltros.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 17f)); // Grupo
        tableFiltros.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 33f)); // Prova

        tableFiltros.Controls.Add(CriarCampoFiltro("Data do evento", _cbData), 0, 0);
        tableFiltros.Controls.Add(CriarCampoFiltro("Evento", _cbEvento), 1, 0);
        tableFiltros.Controls.Add(CriarCampoFiltro("Grupo", _cbGrupo), 2, 0);
        tableFiltros.Controls.Add(CriarCampoFiltro("Corrida / prova", _cbProva), 3, 0);

        var cardFiltros = CriarCard("Filtros", tableFiltros);
        cardFiltros.Dock = DockStyle.Top;
        cardFiltros.Height = 112;
        pnlCorpo.Controls.Add(cardFiltros);

        // Espaçador entre cards
        var espacador = new Panel { Dock = DockStyle.Top, Height = 14 };
        pnlCorpo.Controls.Add(espacador);

        // --- Card 2: Tipo de relatório ---
        var tableTipos = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 2,
            RowCount = 7,
            Padding = new Padding(4, 4, 4, 2)
        };
        tableTipos.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50f));
        tableTipos.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50f));
        for (var i = 0; i < 7; i++)
            tableTipos.RowStyles.Add(new RowStyle(SizeType.Absolute, 33f));

        var radios = new[]
        {
            _rbOficiais,
            _rbSemVelocidade,
            _rbComTempoMedio,
            _rbOrdemChegada,
            _rbOrdemChegadaCat,
            _rbPassagens,
            _rbVoltaAVolta,
            _rbMapaVoltas,
            _rbMapaProva,
            _rbGrid2Esq,
            _rbGrid2Dir,
            _rbGrid3Esq,
            _rbGrid3Dir
        };

        var row = 0;
        var col = 0;
        foreach (var r in radios)
        {
            r.Font = new Font("Segoe UI", 9.25F);
            r.ForeColor = Color.FromArgb(29, 29, 31);
            r.Cursor = Cursors.Hand;
            r.Dock = DockStyle.Fill;
            r.Margin = new Padding(4, 1, 4, 1);
            tableTipos.Controls.Add(r, col, row);

            col++;
            if (col >= 2)
            {
                col = 0;
                row++;
            }
        }

        var cardTipos = CriarCard("Tipo de relatório", tableTipos);
        cardTipos.Dock = DockStyle.Top;
        cardTipos.Height = 295;
        pnlCorpo.Controls.Add(cardTipos);

        Controls.Add(pnlCorpo);

        // Z-order: Corpo Fill index 0
        Controls.SetChildIndex(pnlCorpo, 0);
        pnlCorpo.Controls.SetChildIndex(cardTipos, 0);
        pnlCorpo.Controls.SetChildIndex(espacador, 1);
        pnlCorpo.Controls.SetChildIndex(cardFiltros, 2);

        AcceptButton = btnGerar;
    }

    static Panel CriarCard(string titulo, Control conteudo)
    {
        var card = new Panel
        {
            BackColor = Color.White,
            Padding = new Padding(16, 10, 16, 10)
        };
        card.Paint += (_, e) =>
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var pen = new Pen(Color.FromArgb(226, 232, 240), 1f);
            using var path = Arredondado(new Rectangle(0, 0, card.Width - 1, card.Height - 1), 12);
            e.Graphics.DrawPath(pen, path);
        };

        var layout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 2,
            Padding = new Padding(0),
            Margin = new Padding(0)
        };
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 28f));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));

        var lTitulo = new Label
        {
            Text = titulo,
            Font = new Font("Segoe UI", 10.5F, FontStyle.Bold),
            ForeColor = Color.FromArgb(29, 29, 31),
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleLeft,
            Margin = new Padding(0)
        };

        conteudo.Dock = DockStyle.Fill;
        conteudo.Margin = new Padding(0);

        layout.Controls.Add(lTitulo, 0, 0);
        layout.Controls.Add(conteudo, 0, 1);

        card.Controls.Add(layout);
        return card;
    }

    static Control CriarCampoFiltro(string rotulo, Control controle)
    {
        var pnl = new Panel { Dock = DockStyle.Fill, Padding = new Padding(4, 1, 4, 1) };
        var lbl = new Label
        {
            Text = rotulo,
            Dock = DockStyle.Top,
            Height = 18,
            Font = new Font("Segoe UI", 8.5F, FontStyle.Bold),
            ForeColor = Color.FromArgb(110, 110, 115)
        };
        controle.Dock = DockStyle.Top;
        controle.Font = new Font("Segoe UI", 9.5F);
        pnl.Controls.Add(controle);
        pnl.Controls.Add(lbl);
        return pnl;
    }

    static GraphicsPath Arredondado(Rectangle r, int raio)
    {
        var path = new GraphicsPath();
        var d = raio * 2;
        path.AddArc(r.X, r.Y, d, d, 180, 90);
        path.AddArc(r.Right - d, r.Y, d, d, 270, 90);
        path.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
        path.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
        path.CloseFigure();
        return path;
    }

    void CarregarDados()
    {
        _sessoes = Crono.Arr(_state, "sessions");
        if (_sessoes.Count == 0 && _sessaoInicial != null) _sessoes.Add(_sessaoInicial);

        // Preenche datas distintas
        var datas = _sessoes
            .Select(s => s.L("createdAt") is long ms && ms > 0 ? DateTimeOffset.FromUnixTimeMilliseconds(ms).LocalDateTime.ToString("dd/MM/yyyy") : DateTime.Today.ToString("dd/MM/yyyy"))
            .Distinct()
            .ToList();
        if (datas.Count == 0) datas.Add(DateTime.Today.ToString("dd/MM/yyyy"));

        _cbData.Items.Clear();
        foreach (var d in datas) _cbData.Items.Add(d);
        _cbData.SelectedIndex = 0;

        // Preenche eventos
        _cbEvento.Items.Clear();
        _cbEvento.Items.Add("Baterias " + _cbData.SelectedItem);
        _cbEvento.SelectedIndex = 0;

        // Preenche grupos
        AtualizarGrupos();

        _cbData.SelectedIndexChanged += (_, _) => { AtualizarGrupos(); };
        _cbGrupo.SelectedIndexChanged += (_, _) => { AtualizarProvas(); };
    }

    void AtualizarGrupos()
    {
        var grupos = _sessoes.Select(s => ExtrairGrupo(s.S("name"))).Distinct().ToList();
        if (grupos.Count == 0) grupos.Add("BATERIA " + DateTime.Now.ToString("HH:mm"));

        _cbGrupo.Items.Clear();
        foreach (var g in grupos) _cbGrupo.Items.Add(g);

        if (_sessaoInicial != null)
        {
            var grupoInicial = ExtrairGrupo(_sessaoInicial.S("name"));
            var idx = grupos.IndexOf(grupoInicial);
            _cbGrupo.SelectedIndex = idx >= 0 ? idx : 0;
        }
        else _cbGrupo.SelectedIndex = 0;

        AtualizarProvas();
    }

    void AtualizarProvas()
    {
        var grupoSel = _cbGrupo.SelectedItem?.ToString() ?? "";
        var candidatas = _sessoes.Where(s => ExtrairGrupo(s.S("name")) == grupoSel).ToList();
        if (candidatas.Count == 0) candidatas = _sessoes;

        _cbProva.Items.Clear();
        foreach (var s in candidatas)
        {
            var tipo = Crono.Tipo(s.S("type")).ToUpperInvariant();
            var nome = s.S("name");
            _cbProva.Items.Add(new Campos.Item(0, $"{tipo} · {nome}", s));
        }

        if (_cbProva.Items.Count == 0 && _sessaoInicial != null)
        {
            var tipo = Crono.Tipo(_sessaoInicial.S("type")).ToUpperInvariant();
            _cbProva.Items.Add(new Campos.Item(0, $"{tipo} · {_sessaoInicial.S("name")}", _sessaoInicial));
        }

        if (_cbProva.Items.Count > 0)
        {
            var idx = -1;
            if (_sessaoInicial != null)
            {
                var idInit = _sessaoInicial.S("id");
                idx = _cbProva.Items.Cast<Campos.Item>().ToList().FindIndex(i => i.Dados.S("id") == idInit);
            }
            _cbProva.SelectedIndex = idx >= 0 ? idx : 0;
        }
    }

    static string ExtrairGrupo(string nomeCompleto)
    {
        if (string.IsNullOrWhiteSpace(nomeCompleto)) return "BATERIA";
        var partes = nomeCompleto.Split(['·', '-'], StringSplitOptions.TrimEntries);
        return partes.Length > 0 ? partes[0] : nomeCompleto;
    }

    string ObterSlugTipo()
    {
        if (_rbSemVelocidade.Checked) return "sem_velocidade";
        if (_rbComTempoMedio.Checked) return "com_tempo_medio";
        if (_rbOrdemChegada.Checked) return "ordem_chegada";
        if (_rbOrdemChegadaCat.Checked) return "ordem_chegada_categoria";
        if (_rbPassagens.Checked) return "passagens";
        if (_rbVoltaAVolta.Checked) return "volta_a_volta";
        if (_rbMapaVoltas.Checked) return "mapa_voltas";
        if (_rbMapaProva.Checked) return "mapa_prova";
        if (_rbGrid2Esq.Checked) return "grid_2col_esq";
        if (_rbGrid2Dir.Checked) return "grid_2col_dir";
        if (_rbGrid3Esq.Checked) return "grid_3col_esq";
        if (_rbGrid3Dir.Checked) return "grid_3col_dir";
        return "resultados_oficiais";
    }

    string ObterTituloRelatorio()
    {
        if (_rbSemVelocidade.Checked) return "Resultados Oficiais (Sem Vel. Média)";
        if (_rbComTempoMedio.Checked) return "Resultados Oficiais (Com Tempo Médio)";
        if (_rbOrdemChegada.Checked) return "Resultados Oficiais (Ordem de Chegada)";
        if (_rbOrdemChegadaCat.Checked) return "Resultados Oficiais (Ordem de Chegada por Categoria)";
        if (_rbPassagens.Checked) return "Relatório de Passagens";
        if (_rbVoltaAVolta.Checked) return "Relatório Volta a Volta";
        if (_rbMapaVoltas.Checked) return "Mapa de Voltas";
        if (_rbMapaProva.Checked) return "Mapa de Prova";
        if (_rbGrid2Esq.Checked) return "Grid de Largada (2 Colunas - Esq)";
        if (_rbGrid2Dir.Checked) return "Grid de Largada (2 Colunas - Dir)";
        if (_rbGrid3Esq.Checked) return "Grid de Largada (3 Colunas - Esq)";
        if (_rbGrid3Dir.Checked) return "Grid de Largada (3 Colunas - Dir)";
        return "Resultados Oficiais";
    }

    void GerarRelatorio()
    {
        var item = _cbProva.SelectedItem as Campos.Item;
        var sess = item?.Dados ?? _sessaoInicial;
        if (sess == null)
        {
            Msg.Aviso(this, "Selecione uma corrida/prova para gerar o relatório.");
            return;
        }

        var sessId = sess.S("id");
        var nomeSessao = sess.S("name");
        var slug = ObterSlugTipo();
        var titulo = ObterTituloRelatorio();

        var url = $"{Config.CronoUrl}/resultado/{sessId}?tipo={slug}";
        DialogResult = DialogResult.OK;
        Close();

        Relatorio.Abrir(Owner ?? this, url, $"{titulo} · {nomeSessao}");
    }
}
