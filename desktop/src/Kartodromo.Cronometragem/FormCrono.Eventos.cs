using System.Drawing.Drawing2D;
using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

/// <summary>Passos 1–3 no visual do design (Eventos.dc.html): três cartões numerados — Eventos (500 px), Grupos (300 px)
/// e Provas do grupo — com as ações de cada um no rodapé do cartão.</summary>
public partial class FormCrono
{
    readonly Label _subGrupos = new(), _tituloProvas = new();
    readonly TextBox _buscaEvento = new() { BorderStyle = BorderStyle.None, PlaceholderText = "Buscar evento", Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo), BackColor = Color.FromArgb(239, 239, 240) };

    TabPage AbaEventosDesign()
    {
        var page = new TabPage("1–3 · Eventos") { BackColor = TemaCrono.Fundo, Padding = Padding.Empty };
        TemaCrono.EstilizarGrade(_gEventos);
        _gEventos.Col("Esporte", 80, DataGridViewContentAlignment.MiddleLeft).Col("Nome", 220, DataGridViewContentAlignment.MiddleLeft, true).Col("Início", 104, DataGridViewContentAlignment.MiddleLeft);
        _gEventos.Columns[2].DefaultCellStyle.Font = Tokens.FonteNumero(Tokens.Claro.FonteTamanhoPequeno);
        _gEventos.Columns[1].DefaultCellStyle.Font = Tokens.FonteSemibold(Tokens.Claro.FonteTamanhoCorpo);
        TemaCrono.EstilizarGrade(_gGrupos);
        _gGrupos.Col("Grupo", 150, DataGridViewContentAlignment.MiddleLeft, true).Col("Traçado", 96, DataGridViewContentAlignment.MiddleLeft);
        _gGrupos.Columns[0].DefaultCellStyle.Font = Tokens.FonteSemibold(Tokens.Claro.FonteTamanhoCorpo);
        _gGrupos.Columns[1].DefaultCellStyle.ForeColor = TemaCrono.Secundario;
        TemaCrono.EstilizarGrade(_gProvas);
        _gProvas.Col("Previsão", 96, DataGridViewContentAlignment.MiddleLeft).Col("Tipo", 118, DataGridViewContentAlignment.MiddleLeft).Col("Nome", 110, DataGridViewContentAlignment.MiddleLeft, true)
            .Col("Traçado", 84, DataGridViewContentAlignment.MiddleLeft).Col("Finaliza por", 88, DataGridViewContentAlignment.MiddleLeft).Col("Tempo", 74, DataGridViewContentAlignment.MiddleLeft).Col("Voltas", 56, DataGridViewContentAlignment.MiddleLeft);
        // em tela estreita as colunas menos usadas saem (a coluna "Voltas" ficava cortada na borda); se ainda faltar, rola
        _gProvas.ScrollBars = ScrollBars.Both;
        _gProvas.Resize += (_, _) =>
        {
            var w = _gProvas.ClientSize.Width;
            _gProvas.Columns[3].Visible = w >= 720; // Traçado
            _gProvas.Columns[4].Visible = w >= 640; // Finaliza por
        };
        _gProvas.Columns[0].DefaultCellStyle.Font = _gProvas.Columns[5].DefaultCellStyle.Font = Tokens.FonteNumero(Tokens.Claro.FonteTamanhoPequeno);
        _gProvas.Columns[2].DefaultCellStyle.Font = Tokens.FonteSemibold(Tokens.Claro.FonteTamanhoCorpo);
        _gProvas.RowTemplate.Height = 44;
        foreach (var g in new[] { _gEventos, _gGrupos, _gProvas }) { g.RowTemplate.Height = g == _gProvas ? 44 : 34; g.DefaultCellStyle.SelectionBackColor = Tokens.Claro.CorAcaoPrincipal; g.DefaultCellStyle.SelectionForeColor = Tokens.Primitivo.Branco; }
        _gProvas.DefaultCellStyle.SelectionBackColor = Color.FromArgb(226, 239, 234); _gProvas.DefaultCellStyle.SelectionForeColor = TemaCrono.Texto;
        Etiqueta(_gEventos, 0, _ => (Tokens.Claro.CorEstadoInfoFundo, Tokens.Claro.CorEstadoInfoTexto));
        Etiqueta(_gProvas, 1, t => t switch { "Corrida" => (Color.FromArgb(255, 226, 224), Color.FromArgb(161, 29, 20)), "Tomada de tempo" or "Classificatório" => (Tokens.Claro.CorEstadoInfoFundo, Tokens.Claro.CorEstadoInfoTexto), _ => (Color.FromArgb(234, 234, 238), Tokens.Primitivo.Cinza700) });

        _gEventos.CellClick += (_, e) => { if (e.RowIndex >= 0) _ = CarregarCatalogo(); };
        _gGrupos.CellClick += (_, e) => { if (e.RowIndex >= 0) _ = CarregarCatalogo(); };
        _gEventos.SelectionChanged += (_, _) =>
        {
            if (_carregandoCatalogo) return;
            var id = (_gEventos.ChaveAtual as JsonObject)?.S("id");
            if (!string.IsNullOrEmpty(id) && id != _ultimoEventoId) _ = CarregarCatalogo();
        };
        _gGrupos.SelectionChanged += (_, _) =>
        {
            if (_carregandoCatalogo) return;
            var id = (_gGrupos.ChaveAtual as JsonObject)?.S("id");
            if (!string.IsNullOrEmpty(id) && id != _ultimoGrupoId) _ = CarregarCatalogo();
        };
        _gProvas.CellDoubleClick += (_, e) => { if (e.RowIndex >= 0) CriarBateriaDaProva(); };
        _buscaEvento.TextChanged += (_, _) => _ = CarregarCatalogo();

        var busca = new TemaCrono.PainelArredondado { Size = new Size(180, 30), BackColor = Color.FromArgb(239, 239, 240), Raio = 8, Anchor = AnchorStyles.Top | AnchorStyles.Right };
        busca.Paint += (_, e) => Forma.DesenharSvg(e.Graphics, "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5", new RectangleF(9, 8.5f, 13, 13), TemaCrono.Secundario, 2.2f);
        _buscaEvento.SetBounds(28, 7, 146, 18); busca.Controls.Add(_buscaEvento);

        // 7 botões não cabem na largura do cartão (o "Duplicar" passava por cima do cartão Grupos): os menos usados vão no "Mais"
        var menuEventos = new ContextMenuStrip();
        menuEventos.Items.Add("Duplicar evento", null, (_, _) => DuplicarEvento());
        menuEventos.Items.Add("Imprimir lista de eventos", null, (_, _) => ImprimirResumo("Eventos", _events.Select(x => x.S("name")).ToList()));
        menuEventos.Items.Add(new ToolStripSeparator());
        menuEventos.Items.Add("Importar eventos…", null, (_, _) => ImportarCatalogo());
        menuEventos.Items.Add("Exportar eventos…", null, (_, _) => ExportarCatalogo());
        Button maisEventos = null;
        maisEventos = BotaoPeq("Mais ▾", 0, () => menuEventos.Show(maisEventos, new Point(0, maisEventos.Height)));
        var ev = CartaoPasso(1, "Eventos", new Label { Text = "Escolha o dia ou o campeonato" }, _gEventos,
            [BotaoPeq("+ Novo", 1, () => EditarCatalogo("events")), BotaoPeq("Editar", 0, () => EditarCatalogo("events", true)), BotaoPeq("Excluir", 2, () => ExcluirCatalogo("events")), maisEventos], busca);
        _subGrupos.Text = "Selecione um evento";
        var gr = CartaoPasso(2, "Grupos", _subGrupos, _gGrupos,
            [BotaoPeq("+ Novo", 1, () => EditarCatalogo("groups")), BotaoPeq("Editar", 0, () => EditarCatalogo("groups", true)), BotaoPeq("Excluir", 2, () => ExcluirCatalogo("groups"))]);
        // provas: tabela + "Como funciona"
        var provas = new Panel { Dock = DockStyle.Fill, BackColor = Tokens.Primitivo.Branco };
        var como = new Panel { Dock = DockStyle.Bottom, Height = 132, BackColor = Tokens.Primitivo.Branco, Padding = new Padding(16, 12, 16, 16) };
        var caixa = new TemaCrono.PainelArredondado { Dock = DockStyle.Fill, BackColor = TemaCrono.Fundo, Raio = 14 };
        const string textoComo = "As baterias do dia chegam da recepção já com as provas do produto (ex.: Tomada de tempo 5 min + Corrida 20 min). Distribuir leva os competidores da tomada de tempo para a corrida, no grid pela ordem de tempo. Depois é só ir para a aba Cronometragem.";
        var fonteComo = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo);
        caixa.Paint += (_, e) =>
        {
            var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
            g.DrawImage(Forma.Tile("M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "linear-gradient(180deg, #6CB8FF, #1E6FE8)", 32, 17), new Rectangle(16, 16, 32, 32));
            TextRenderer.DrawText(g, "Como funciona", Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo, FontStyle.Bold), new Point(62, 15), TemaCrono.Texto);
            TextRenderer.DrawText(g, textoComo, fonteComo, new Rectangle(62, 36, caixa.Width - 78, caixa.Height - 40), Tokens.Primitivo.Cinza700, TextFormatFlags.WordBreak);
        };
        caixa.Resize += (_, _) => caixa.Invalidate();
        // a altura acompanha o texto (em tela estreita ele quebra em mais linhas e a última era cortada)
        como.Resize += (_, _) =>
        {
            var larguraTexto = Math.Max(120, como.Width - 32 - 78);
            var alturaTexto = TextRenderer.MeasureText(textoComo, fonteComo, new Size(larguraTexto, 0), TextFormatFlags.WordBreak).Height;
            var nova = Math.Max(110, alturaTexto + 36 + 14 + 28);
            if (como.Height != nova) como.Height = nova;
        };
        como.Controls.Add(caixa);
        provas.Controls.Add(_gProvas); provas.Controls.Add(como); _gProvas.BringToFront();
        _tituloProvas.Text = "Provas";
        // como no canvas: "Próximo" leva aos competidores da prova escolhida (cria a bateria com os inscritos da recepção,
        // ou abre a que já existe)
        var proximo = BotaoPeq("Próximo: competidores →", 3, () => { if (_gProvas.ChaveAtual is JsonObject) CriarBateriaDaProva(); else _abas.SelectedIndex = 1; });
        var pr = CartaoPasso(3, null, new Label { Text = "Vêm do produto vendido · podem ser ajustadas aqui" }, provas,
            [BotaoPeq("+ Nova prova", 1, () => EditarCatalogo("provas")), BotaoPeq("Editar", 0, () => EditarCatalogo("provas", true)), BotaoPeq("Excluir", 2, () => ExcluirCatalogo("provas")),
             BotaoPeq("Distribuir", 0, DistribuirProva), BotaoPeq("Imprimir", 0, () => ImprimirResumo("Provas", _proofs.Select(x => x.S("name")).ToList()))], null, _tituloProvas, proximo);

        var grade = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 3, RowCount = 1, Padding = new Padding(18, 16, 18, 16), BackColor = TemaCrono.Fundo };
        // proporcional (cabe em 1366); as Provas ficam com a maior parte porque o rodapé delas tem 5 botões + "Próximo"
        grade.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 30f));
        grade.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 22f));
        grade.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 48f));
        grade.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        ev.Margin = new Padding(0, 0, 14, 0); gr.Margin = new Padding(0, 0, 14, 0); pr.Margin = Padding.Empty;
        // agenda da recepção (baterias de hoje com os pilotos inscritos) em cima dos eventos: é daqui que o
        // cronometrista cria a bateria já com os pilotos
        TemaCrono.EstilizarGrade(_gAgenda);
        if (_gAgenda.Columns.Count == 0) _gAgenda.Col("Hora", 64).Col("Bateria", 160, DataGridViewContentAlignment.MiddleLeft, true).Col("Kart", 70).Col("Inscritos", 72).Col("Pagos", 62);
        _gAgenda.RowTemplate.Height = 34;
        _gAgenda.DefaultCellStyle.SelectionBackColor = Tokens.Claro.CorAcaoPrincipal; _gAgenda.DefaultCellStyle.SelectionForeColor = Tokens.Primitivo.Branco;
        _gAgenda.Columns[1].DefaultCellStyle.Font = Tokens.FonteSemibold(Tokens.Claro.FonteTamanhoCorpo);
        var ag = CartaoPasso(0, "Baterias de hoje · recepção", new Label { Text = "Os pilotos inscritos entram sozinhos · dois cliques cria a bateria" }, _gAgenda,
            [BotaoPeq("Criar bateria com os inscritos", 1, () => NovaBateria(_gAgenda.ChaveAtual as JsonObject)), BotaoPeq("Atualizar", 0, () => Seguro.Rodar(this, CarregarAgenda))]);
        // Eventos.dc.html: a coluna 1 é só Eventos. As baterias do dia chegam da recepção como o evento "Baterias dd/mm/aaaa"
        // (grupos = baterias, provas = do produto), montado pelo servidor da cronometragem; o cartão da agenda saiu.
        _ = ag;
        var col1 = ev; ev.Margin = new Padding(0, 0, 14, 0);
        // a recepção vende o tempo todo: a lista se atualiza sozinha a cada 30 s enquanto a aba está aberta
        var relogioAgenda = new System.Windows.Forms.Timer { Interval = 30_000 };
        relogioAgenda.Tick += (_, _) => { if (_abas.SelectedIndex == 0 && Visible && WindowState != FormWindowState.Minimized) { _ = CarregarAgenda(); _ = CarregarCatalogo(); } };
        relogioAgenda.Start();
        page.Disposed += (_, _) => relogioAgenda.Dispose();
        grade.Controls.Add(col1, 0, 0); grade.Controls.Add(gr, 1, 0); grade.Controls.Add(pr, 2, 0);
        page.Controls.Add(grade);
        TemaCrono.EstilizarGrade(_gSessoes);
        if (_gSessoes.Columns.Count == 0) _gSessoes.Col("Hora", 64).Col("Bateria", 180, DataGridViewContentAlignment.MiddleLeft, true).Col("Tipo", 100).Col("Estado", 100).Col("Pilotos", 58);
        return page;
    }

    /// <summary>Etiqueta colorida (chip) no texto da coluna.</summary>
    static void Etiqueta(LiveGrid g, int coluna, Func<string, (Color fundo, Color texto)> cores)
    {
        g.CellPainting += (_, e) =>
        {
            if (e.RowIndex < 0 || e.ColumnIndex != coluna || e.FormattedValue is not string t || t.Length == 0) return;
            var gr = e.Graphics; gr.SmoothingMode = SmoothingMode.None;
            var sel = (e.State & DataGridViewElementStates.Selected) != 0;
            using (var b = new SolidBrush(sel ? e.CellStyle.SelectionBackColor : e.CellStyle.BackColor)) gr.FillRectangle(b, e.CellBounds);
            using (var p = new Pen(g.GridColor)) gr.DrawLine(p, e.CellBounds.Left, e.CellBounds.Bottom - 1, e.CellBounds.Right, e.CellBounds.Bottom - 1);
            var (fundo, texto) = cores(t);
            using var f = Tokens.FonteSemibold(Tokens.Claro.FonteTamanhoLegenda);
            var w = TextRenderer.MeasureText(t, f).Width + 8;
            var r = new Rectangle(e.CellBounds.X + 6, e.CellBounds.Y + (e.CellBounds.Height - 20) / 2, Math.Min(w, e.CellBounds.Width - 10), 20);
            gr.SmoothingMode = SmoothingMode.AntiAlias;
            using (var p = Forma.Redondo(r, 6)) using (var b = new SolidBrush(sel && fundo.R == 225 && coluna == 0 ? Color.FromArgb(40, 255, 255, 255) : fundo)) gr.FillPath(b, p);
            TextRenderer.DrawText(gr, t, f, r, sel && coluna == 0 ? Tokens.Primitivo.Branco : texto, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
            gr.SmoothingMode = SmoothingMode.None;
            e.Handled = true;
        };
    }

    /// <summary>Botão pequeno dos rodapés de cartão (30 px, raio 8). Tipo: 0 cinza, 1 verde, 2 vermelho (Excluir), 3 escuro (Próximo).</summary>
    static Button BotaoPeq(string texto, int tipo, Action clique)
    {
        var (fundo, frente) = tipo switch { 1 => (Tokens.Claro.CorAcaoPrincipal, Tokens.Primitivo.Branco), 2 => (Color.FromArgb(232, 232, 235), TemaCrono.Vermelho), 3 => (Tokens.Claro.CorTextoPrincipal, Tokens.Primitivo.Branco), _ => (Color.FromArgb(232, 232, 235), TemaCrono.Texto) };
        var b = new BotaoPlano { Text = texto, FlatStyle = FlatStyle.Flat, BackColor = fundo, ForeColor = frente, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo, tipo is 1 or 3 ? FontStyle.Bold : FontStyle.Regular), Cursor = Cursors.Hand, Height = 30, Margin = new Padding(0, 0, 6, 0) };
        b.Width = TextRenderer.MeasureText(texto, b.Font).Width + 22;
        b.FlatAppearance.BorderSize = 0; b.FlatAppearance.MouseOverBackColor = ControlPaint.Light(fundo, .1f);
        b.Resize += (_, _) => Forma.AplicarRaio(b, 8); Forma.AplicarRaio(b, 8);
        b.Click += (_, _) => clique();
        return b;
    }

    /// <summary>Cartão de passo: bolinha verde com o número, título e subtítulo, conteúdo, rodapé com os botões.</summary>
    static Panel CartaoPasso(int numero, string titulo, Label sub, Control conteudo, Button[] acoes, Control direitaTopo = null, Label tituloVivo = null, Control direitaRodape = null)
    {
        var card = new TemaCrono.PainelArredondado { Dock = DockStyle.Fill, BackColor = Tokens.Primitivo.Branco, Raio = 16 };
        var topo = new Panel { Dock = DockStyle.Top, Height = 58, BackColor = Tokens.Primitivo.Branco };
        topo.Paint += (_, e) =>
        {
            var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
            if (numero < 0) return; // -1 = cartão sem bolinha (ex.: ranking dos karts)
            using (var b = new SolidBrush(Tokens.Claro.CorAcaoPrincipal)) g.FillEllipse(b, 16, 16, 24, 24);
            // 0 = agenda da recepção (seta "chegando"), 1–3 = passos do design
            TextRenderer.DrawText(g, numero > 0 ? numero.ToString() : "↓", Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno, FontStyle.Bold), new Rectangle(16, 16, 24, 24), Tokens.Primitivo.Branco, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        };
        var t = tituloVivo ?? new Label { Text = titulo };
        t.Dock = DockStyle.None; t.AutoSize = true; t.Padding = Padding.Empty; t.Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoSubtitulo, FontStyle.Bold); t.ForeColor = TemaCrono.Texto; t.Location = new Point(numero < 0 ? 18 : 50, 11); t.BackColor = Tokens.Primitivo.Branco;
        sub.AutoSize = true; sub.Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno); sub.ForeColor = TemaCrono.Secundario; sub.Location = new Point(numero < 0 ? 19 : 51, 31); sub.BackColor = Tokens.Primitivo.Branco;
        topo.Controls.Add(t); topo.Controls.Add(sub);
        if (direitaTopo != null)
        {
            topo.Controls.Add(direitaTopo);
            var larguraBusca = direitaTopo.Width;
            topo.Resize += (_, _) =>
            {
                // cartão estreito: a busca encolhe (até 120) antes de cobrir o subtítulo; se ainda faltar, o subtítulo é que corta
                var livre = topo.Width - 16 - 12 - Math.Max(t.Left + t.PreferredWidth, sub.Left + sub.PreferredWidth);
                direitaTopo.Width = Math.Clamp(livre, 120, larguraBusca);
                foreach (Control c in direitaTopo.Controls) if (c is TextBox tb) tb.Width = direitaTopo.Width - tb.Left - 6;
                direitaTopo.Location = new Point(topo.Width - 16 - direitaTopo.Width, 14);
                // o subtítulo ocupa todo o espaço até a busca (o texto muda depois, ex.: "Bateria avulsa · 4 competidores")
                sub.AutoSize = false; sub.AutoEllipsis = true;
                sub.Size = new Size(Math.Max(60, direitaTopo.Left - 8 - sub.Left), sub.PreferredHeight);
            };
        }
        var rod = new Panel { Dock = DockStyle.Bottom, Height = 50, BackColor = Color.FromArgb(251, 251, 253) };
        rod.Paint += (_, e) => { using var p = new Pen(Color.FromArgb(237, 237, 237)); e.Graphics.DrawLine(p, 0, 0, rod.Width, 0); };
        Panel dir = null;
        if (direitaRodape != null)
        {
            dir = new Panel { Dock = DockStyle.Right, Width = direitaRodape.Width + 24, BackColor = Color.FromArgb(251, 251, 253) };
            direitaRodape.Location = new Point(12, 10); dir.Controls.Add(direitaRodape); rod.Controls.Add(dir);
            // o "Total: 4" cresce depois de montado: o painel acompanha (antes o último botão saía cortado na borda)
            var painelDir = dir;
            direitaRodape.SizeChanged += (_, _) => painelDir.Width = direitaRodape.Width + 24;
        }
        var fluxo = new FlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false, Padding = new Padding(12, 10, 0, 0), BackColor = Color.FromArgb(251, 251, 253) };
        fluxo.Controls.AddRange(acoes);
        rod.Controls.Add(fluxo);
        fluxo.BringToFront();
        // botões que não cabem numa linha descem para a segunda (antes ficavam escondidos atrás do "Próximo" ou cortados)
        void Reorganizar()
        {
            var precisa = 12 + acoes.Sum(b => b.Width + b.Margin.Horizontal) + (dir?.Width ?? 0);
            var quebra = precisa > rod.Width;
            fluxo.WrapContents = quebra;
            var altura = quebra ? Math.Max(88, fluxo.GetPreferredSize(new Size(Math.Max(100, rod.Width - (dir?.Width ?? 0)), 0)).Height + 10) : 50;
            if (rod.Height != altura) rod.Height = altura;
        }
        rod.Resize += (_, _) => Reorganizar();
        if (dir != null) dir.Resize += (_, _) => Reorganizar();
        conteudo.Dock = DockStyle.Fill;
        card.Controls.Add(conteudo); card.Controls.Add(rod); card.Controls.Add(topo);
        conteudo.BringToFront();
        return card;
    }
}
