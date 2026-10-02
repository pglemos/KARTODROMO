using System.Drawing.Drawing2D;
using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

/// <summary>Visual do design aprovado (AoVivo.dc.html, Eventos.dc.html, Competidores.dc.html): cabeçalho com o menu e
/// os passos, faixa de informações com o cronômetro, bandeiras, cartões e rodapé com as pílulas de estado.</summary>
public partial class FormCrono
{
    PassosSegmento _passos;
    readonly Label _lEvNome = Info(), _lGrupoNome = Info(), _lProvaNome = Info(), _lMinimo = Info();
    BotaoBandeira _fVerde, _fAmarela, _fVermelha, _fBranca, _fQuad, _fParar, _fReiniciar;
    FaixaPlacar _faixa;
    readonly Label _rodTexto = new() { AutoSize = true, Font = new Font("Segoe UI", 8.6F), ForeColor = TemaCrono.Secundario, BackColor = Color.Transparent };
    PilulaStatus _pPlacar, _pDecoder, _pTv, _pTransp;
    readonly Dictionary<string, int> _posUltimo = [];
    readonly Dictionary<string, int> _setas = [];
    string _chavePosicoes = "";
    Dictionary<string, string> _bandeiraPiloto = [];

    // ------------------------------------------------------------------ cabeçalho (52 px)
    Control CabecalhoDesign()
    {
        var cab = new Panel { Dock = DockStyle.Top, Height = 52, BackColor = Color.FromArgb(251, 251, 252) };
        cab.Paint += (_, e) => { using var p = new Pen(Color.FromArgb(234, 234, 234)); e.Graphics.DrawLine(p, 0, cab.Height - 1, cab.Width, cab.Height - 1); };
        var logo = new Panel { Size = new Size(34, 34), Location = new Point(18, 9), BackColor = Color.Transparent };
        var imagem = Icone.Logo();
        logo.Paint += (_, e) =>
        {
            var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias; g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            using var p = Forma.Redondo(new Rectangle(0, 0, 33, 33), 9);
            using var b = new LinearGradientBrush(new Rectangle(0, 0, 34, 34), Color.FromArgb(44, 44, 46), Color.FromArgb(11, 11, 12), 90f);
            g.FillPath(b, p);
            if (imagem != null) { var h = 28f * imagem.Height / Math.Max(1, imagem.Width); g.DrawImage(imagem, new RectangleF(3, (34 - h) / 2, 28, h)); }
        };
        var t = new Label { Text = "Cronometragem", AutoSize = true, Font = new Font("Segoe UI", 10.5F, FontStyle.Bold), ForeColor = TemaCrono.Texto, Location = new Point(64, 8), BackColor = Color.Transparent };
        var s = new Label { Text = "Kartódromo Internacional de Betim", AutoSize = true, Font = new Font("Segoe UI", 9F), ForeColor = TemaCrono.Secundario, Location = new Point(64, 26), BackColor = Color.Transparent };
        var menu = MainMenuStrip;
        menu.Dock = DockStyle.None; menu.AutoSize = true; menu.BackColor = Color.FromArgb(251, 251, 252);
        menu.Renderer = new MenuDesignRenderer(Color.FromArgb(251, 251, 252));
        menu.Padding = new Padding(0); menu.Font = new Font("Segoe UI", 9.8F);
        foreach (ToolStripMenuItem it in menu.Items) { it.Padding = new Padding(8, 4, 8, 4); it.Margin = new Padding(1, 0, 1, 0); }
        _passos = new PassosSegmento(["1–3 · Configuração de eventos", "4–5 · Registro de competidores", "Cronometragem", "Ranking dos karts", "Equalização"],
            ["1–3 · Eventos", "4–5 · Competidores", "Cronometragem", "Ranking", "Equalização"],
            ["1–3", "4–5", "Cronometragem", "Ranking", "Equalização"]) { Anchor = AnchorStyles.Top | AnchorStyles.Right, IndiceAoVivo = 2 };
        _passos.Mudou += i => { if (_abas.SelectedIndex != i) _abas.SelectedIndex = i; };
        _abas.SelectedIndexChanged += (_, _) => _passos.Selecionado = _abas.SelectedIndex;
        cab.Controls.AddRange([logo, t, s, menu, _passos]);
        void Posicionar()
        {
            menu.Location = new Point(Math.Max(t.Right, s.Right) + 18, (52 - menu.Height) / 2);
            // tela estreita (1366): nomes curtos nos passos para não cobrir o menu
            _passos.Nivel = 0;
            while (_passos.Nivel < 2 && cab.Width - 18 - _passos.Width < menu.Right + 12) _passos.Nivel++;
            _passos.Location = new Point(cab.Width - 18 - _passos.Width, (52 - _passos.Height) / 2);
        }
        cab.Resize += (_, _) => Posicionar(); menu.SizeChanged += (_, _) => Posicionar();
        return cab;
    }

    // ------------------------------------------------------------------ rodapé (28 px)
    Control RodapeDesign()
    {
        var rod = new Panel { Dock = DockStyle.Bottom, Height = 28, BackColor = Color.FromArgb(251, 251, 252) };
        rod.Paint += (_, e) => { using var p = new Pen(Color.FromArgb(234, 234, 234)); e.Graphics.DrawLine(p, 0, 0, rod.Width, 0); };
        _rodTexto.Location = new Point(16, 7);
        _pTransp = new PilulaStatus { Visible = false, Cursor = Cursors.Hand };
        _pPlacar = new PilulaStatus { Texto = "PLACAR", Cursor = Cursors.Hand };
        _pDecoder = new PilulaStatus { Texto = "DECODER", Cursor = Cursors.Hand };
        _pTv = new PilulaStatus { Texto = "TV", Cursor = Cursors.Hand };
        _pTransp.Click += (_, _) => Transponders();
        _pPlacar.Click += (_, _) => ConfigurarPainel();
        _pDecoder.Click += (_, _) => JanelaCadastro("CadDecoder");
        _pTv.Click += (_, _) => AbrirTV();
        rod.Controls.AddRange([_rodTexto, _pTransp, _pPlacar, _pDecoder, _pTv]);
        void Posicionar()
        {
            var x = rod.Width - 16;
            foreach (var p in new[] { _pTv, _pDecoder, _pPlacar, _pTransp })
            {
                if (!p.Visible) continue;
                x -= p.Width; p.Location = new Point(x, 5); x -= 8;
            }
        }
        rod.Resize += (_, _) => Posicionar();
        foreach (var p in new[] { _pTv, _pDecoder, _pPlacar, _pTransp }) { p.SizeChanged += (_, _) => Posicionar(); p.VisibleChanged += (_, _) => Posicionar(); }
        return rod;
    }

    // ------------------------------------------------------------------ faixa de informações (evento · cronômetro · tempos)
    Control InfoAoVivo()
    {
        var faixa = new Panel { Dock = DockStyle.Top, Height = 94, BackColor = Color.White };
        faixa.Paint += (_, e) => { using var p = new Pen(Color.FromArgb(237, 237, 237)); e.Graphics.DrawLine(p, 0, faixa.Height - 1, faixa.Width, faixa.Height - 1); };
        var fonteV = new Font("Segoe UI Semibold", 9.8F);
        Label R(string t) => new() { Text = t, AutoSize = true, Font = new Font("Segoe UI", 9.8F), ForeColor = TemaCrono.Secundario, BackColor = Color.White };
        // esquerda: Evento / Grupo / Prova
        var esq = new TableLayoutPanel { ColumnCount = 2, RowCount = 3, AutoSize = true, BackColor = Color.White, Location = new Point(20, 17) };
        esq.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 62)); esq.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        foreach (var (rot, val) in new[] { ("Evento", _lEvNome), ("Grupo", _lGrupoNome), ("Prova", _lProvaNome) })
        {
            var r = R(rot); r.Margin = new Padding(0, 1, 0, 1); val.Margin = new Padding(0, 1, 0, 1); val.Font = fonteV; val.ForeColor = TemaCrono.Texto; val.BackColor = Color.White; val.AutoEllipsis = true;
            esq.Controls.Add(r); esq.Controls.Add(val);
        }
        _lProvaNome.Font = new Font("Segoe UI", 9.8F, FontStyle.Bold); _lProvaNome.ForeColor = TemaCrono.Vermelho;
        // centro: cronômetro preto
        var relogio = new TemaCrono.PainelArredondado { Size = new Size(300, 70), BackColor = Color.FromArgb(29, 29, 31), Raio = 14 };
        var rotulo = new Label { Text = "CRONÔMETRO", Dock = DockStyle.Top, Height = 22, TextAlign = ContentAlignment.BottomCenter, Font = new Font("Segoe UI Semibold", 8.3F), ForeColor = Color.FromArgb(174, 174, 178), BackColor = Color.FromArgb(29, 29, 31) };
        _lCrono.Dock = DockStyle.Fill; _lCrono.BackColor = Color.FromArgb(29, 29, 31); _lCrono.ForeColor = Color.FromArgb(29, 29, 31);
        _lCrono.Paint += (_, e) =>
        {
            // "00:08:17" branco + ".685" cinza, como no design
            var g = e.Graphics; g.Clear(_lCrono.BackColor);
            var txt = _lCrono.Text; var i = txt.LastIndexOf('.');
            var a = i > 0 ? txt[..i] : txt; var b = i > 0 ? txt[i..] : "";
            using var f = new Font("Cascadia Mono", 24F, FontStyle.Bold);
            var fl = TextFormatFlags.NoPadding | TextFormatFlags.SingleLine;
            var wa = TextRenderer.MeasureText(g, a, f, Size.Empty, fl).Width; var wb = TextRenderer.MeasureText(g, b, f, Size.Empty, fl).Width;
            var x0 = (_lCrono.Width - wa - wb) / 2; var y0 = (_lCrono.Height - f.Height) / 2 - 3;
            TextRenderer.DrawText(g, a, f, new Point(x0, y0), Color.White, fl);
            TextRenderer.DrawText(g, b, f, new Point(x0 + wa, y0), Color.FromArgb(142, 142, 147), fl);
        };
        relogio.Controls.Add(_lCrono); relogio.Controls.Add(rotulo);
        // direita: tempos
        var dir = new TableLayoutPanel { ColumnCount = 4, RowCount = 3, AutoSize = true, BackColor = Color.White };
        dir.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize)); dir.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 150));
        dir.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize)); dir.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 120));
        var mono = new Font("Cascadia Mono", 9.8F, FontStyle.Bold);
        _lRestante.Font = mono; _lRestante.ForeColor = TemaCrono.Vermelho;
        _lMinimo.Font = new Font("Cascadia Mono", 9.8F); _lMinimo.ForeColor = TemaCrono.Texto;
        _lVoltasRest.Font = fonteV; _lVoltasRest.ForeColor = TemaCrono.Texto;
        _lRuido.Font = new Font("Segoe UI", 9.8F, FontStyle.Bold); _lRuido.ForeColor = Color.FromArgb(28, 107, 53);
        _lMelhor.Font = new Font("Segoe UI", 9.8F, FontStyle.Bold); _lMelhor.ForeColor = Color.FromArgb(122, 47, 194); _lMelhor.AutoEllipsis = true; _lMelhor.AutoSize = true;
        void Cel(Control c, int col, int lin, int span = 1) { c.Margin = new Padding(0, 1, 12, 1); c.BackColor = Color.White; dir.Controls.Add(c, col, lin); if (span > 1) dir.SetColumnSpan(c, span); }
        Cel(R("Tempo restante"), 0, 0); Cel(_lRestante, 1, 0); Cel(R("Voltas restantes"), 2, 0); Cel(_lVoltasRest, 3, 0);
        Cel(R("Tempo mínimo"), 0, 1); Cel(_lMinimo, 1, 1); Cel(R("Ruído"), 2, 1); Cel(_lRuido, 3, 1);
        Cel(R("Melhor volta"), 0, 2); Cel(_lMelhor, 1, 2, 3);
        faixa.Controls.AddRange([esq, relogio, dir]);
        faixa.Resize += (_, _) =>
        {
            var util = faixa.Width - 40 - relogio.Width - 40;
            relogio.Location = new Point(20 + (int)(util * (1 / 2.1)) + 20, 12);
            dir.Location = new Point(relogio.Right + 20, (faixa.Height - dir.Height) / 2);
            foreach (var l in new[] { _lEvNome, _lGrupoNome, _lProvaNome }) l.MaximumSize = new Size(Math.Max(120, relogio.Left - 20 - 62 - 24), 0);
            _lMelhor.MaximumSize = new Size(Math.Max(160, faixa.Width - dir.Left - 130), 0);
        };
        return faixa;
    }

    // ------------------------------------------------------------------ barra de bandeiras e saídas
    Control BarraAoVivo()
    {
        var barra = new Panel { Dock = DockStyle.Top, Height = 78, BackColor = Color.FromArgb(251, 251, 253) };
        barra.Paint += (_, e) => { using var p = new Pen(Color.FromArgb(237, 237, 237)); e.Graphics.DrawLine(p, 0, barra.Height - 1, barra.Width, barra.Height - 1); };
        _fVerde = new BotaoBandeira("Verde", Color.FromArgb(52, 199, 89)) { Dica = "Largada (F1): o cronômetro começa no 1º kart que passar na linha" };
        _fAmarela = new BotaoBandeira("Amarela", Color.FromArgb(255, 204, 0)) { Dica = "Atenção na pista (F2)" };
        _fVermelha = new BotaoBandeira("Vermelha", Color.FromArgb(255, 59, 48)) { Dica = "Prova interrompida (F3)" };
        _fBranca = new BotaoBandeira("Branca", Color.White) { Dica = "Última volta (F7)" };
        _fQuad = new BotaoBandeira("Quadriculada", Color.Black) { Xadrez = true, Dica = "Fim: cada kart termina ao cruzar a linha (F4)" };
        _fParar = new BotaoBandeira("Parar", TemaCrono.Vermelho) { Parar = true, Dica = "Finalizar a prova agora (F5)" };
        _fReiniciar = new BotaoBandeira("Reiniciar", Color.FromArgb(255, 149, 0)) { Reiniciar = true, Dica = "Reiniciar a bateria: zera passagens, bandeiras e penalidades (os pilotos continuam)" };
        _fVerde.Click += (_, _) => Bandeira("verde"); _fAmarela.Click += (_, _) => Bandeira("amarela"); _fVermelha.Click += (_, _) => Bandeira("vermelha");
        _fBranca.Click += (_, _) => Bandeira("branca"); _fQuad.Click += (_, _) => Bandeira("quadriculada"); _fParar.Click += (_, _) => Acao("close");
        _fReiniciar.Click += (_, _) => ReiniciarBateria();
        var x = 20;
        foreach (var b in new[] { _fVerde, _fAmarela, _fVermelha, _fBranca, _fQuad, _fParar, _fReiniciar }) { b.Location = new Point(x, 10); x += b.Width + 6; barra.Controls.Add(b); }
        var sep = new Panel { Location = new Point(x + 8, 19), Size = new Size(1, 40), BackColor = Color.FromArgb(225, 225, 225) };
        barra.Controls.Add(sep); x += 8 + 1 + 14;
        var pilotos = new (string flag, string dica, Action<Graphics, RectangleF> pano)[]
        {
            ("black", "Preta · desclassificado, vai para o último lugar", (g, r) => { using var b = new SolidBrush(Color.FromArgb(29, 29, 31)); g.FillRectangle(b, r); }),
            ("mechanical", "Preta com círculo laranja · problema mecânico", (g, r) => { using var b = new SolidBrush(Color.FromArgb(29, 29, 31)); g.FillRectangle(b, r); using var o = new SolidBrush(Color.FromArgb(255, 149, 0)); var d = r.Height * 0.7f; g.FillEllipse(o, r.X + (r.Width - d) / 2, r.Y + (r.Height - d) / 2, d, d); }),
            ("warning", "Preta e branca · advertência", (g, r) => { g.FillRectangle(Brushes.White, r); using var b = new SolidBrush(Color.FromArgb(29, 29, 31)); g.FillPolygon(b, [new PointF(r.Left, r.Top), new PointF(r.Right, r.Top), new PointF(r.Left, r.Bottom)]); }),
            ("blue", "Azul · deixe passar", (g, r) => { using var b = new SolidBrush(Color.FromArgb(10, 132, 255)); g.FillRectangle(b, r); }),
            ("penalty", "Penalidade de tempo", (g, r) => { g.FillRectangle(Brushes.White, r); using var b = new SolidBrush(Color.FromArgb(255, 59, 48)); g.FillRectangle(b, r.X, r.Y, r.Width, r.Height / 2); }),
        };
        foreach (var (flag, dica, pano) in pilotos)
        {
            // advertência e penalidade: cada clique é uma nova (o piloto pode receber várias); preta pede confirmação
            var b = new BotaoQuadrado
            {
                Location = new Point(x, 16), Pano = pano,
                Dica = flag is "warning" or "penalty" ? dica + " — para o piloto selecionado (pode dar mais de uma; a janela mostra as que ele já tem)" : dica + " — para o piloto selecionado (clique de novo para tirar)",
            };
            b.Click += (_, _) =>
            {
                if (flag == "warning") AplicarPenalidade("advertencia");
                else if (flag == "penalty") AplicarPenalidade("tempo");
                else if (flag == "black") BandeiraPreta();
                else BandeiraPilotoAoVivo(flag);
            };
            barra.Controls.Add(b); x += 46 + 6;
        }
        // bateria em foco (troca rápida)
        var cbCaixa = new TemaCrono.PainelArredondado { Size = new Size(260, 34), BackColor = Color.White, Raio = 9, Location = new Point(x + 14, 22) };
        cbCaixa.Paint += (_, e) => { e.Graphics.SmoothingMode = SmoothingMode.AntiAlias; using var p = Forma.Redondo(new Rectangle(0, 0, cbCaixa.Width - 1, cbCaixa.Height - 1), 9); using var pen = new Pen(Color.FromArgb(219, 219, 219)); e.Graphics.DrawPath(pen, p); };
        _cbSessao.FlatStyle = FlatStyle.Flat; _cbSessao.Font = new Font("Segoe UI", 9.4F); _cbSessao.SetBounds(8, 5, 244, 24);
        if (_cbSessao.Parent != null) _cbSessao.Parent.Controls.Remove(_cbSessao);
        cbCaixa.Controls.Add(_cbSessao);
        barra.Controls.Add(cbCaixa);
        // saídas à direita
        var saidas = new (string dica, string cor, string svg, Action clique)[]
        {
            ("Enviar resultado no WhatsApp", "linear-gradient(180deg, #5EDB7A, #1E9E4A)", "M21 12a9 9 0 0 1-13.5 7.8L3 21l1.2-4.5A9 9 0 1 1 21 12z", EnviarWhatsApp),
            ("Exportar o resultado (planilha)", "linear-gradient(180deg, #FFB547, #F07A00)", "M12 3v12M7 8l5-5 5 5M4 17v4h16v-4", ExportarResultado),
            ("Imprimir resultado", "linear-gradient(180deg, #9A9AA0, #4A4A4F)", "M6 9V3h12v6M6 18H4v-7h16v7h-2M6 14h12v7H6z", AbrirRelatoriosCrono),
            ("Placar (painel de LED)", "linear-gradient(180deg, #6CB8FF, #1E6FE8)", "M3 4h18v12H3zM7 20h10M9 8h2v4M13 8h2v4", ConfigurarPainel),
            ("Telão / TV ao vivo (F11)", "linear-gradient(180deg, #FF7A6B, #E0342A)", "M3 5h18v12H3zM8 21h8M10 9l5 2.5-5 2.5z", AbrirTV),
        };
        var botoesSaida = new List<Control>();
        foreach (var (dica, cor, svg, clique) in saidas)
        {
            var b = new BotaoQuadrado { Cor = cor, Svg = svg, Dica = dica, Anchor = AnchorStyles.Top | AnchorStyles.Right };
            b.Click += (_, _) => clique();
            barra.Controls.Add(b); botoesSaida.Add(b);
        }
        var passTitulo = new Label { Text = "Passagens", AutoSize = true, Font = new Font("Segoe UI Semibold", 8.6F), ForeColor = TemaCrono.Secundario, BackColor = barra.BackColor };
        _lPassagens.AutoSize = true; _lPassagens.Font = new Font("Cascadia Mono", 17F, FontStyle.Bold); _lPassagens.ForeColor = TemaCrono.Texto; _lPassagens.BackColor = barra.BackColor;
        if (_lPassagens.Parent != null) _lPassagens.Parent.Controls.Remove(_lPassagens);
        barra.Controls.Add(passTitulo); barra.Controls.Add(_lPassagens);
        void Posicionar()
        {
            var xr = barra.Width - 20;
            for (var i = botoesSaida.Count - 1; i >= 0; i--) { xr -= 46; botoesSaida[i].Location = new Point(xr, 16); xr -= 6; }
            xr -= 14;
            var w = Math.Max(passTitulo.Width, _lPassagens.Width);
            passTitulo.Location = new Point(xr - w + (w - passTitulo.Width) / 2, 13);
            _lPassagens.Location = new Point(xr - w + (w - _lPassagens.Width) / 2, 29);
            cbCaixa.Width = Math.Clamp(xr - w - 20 - cbCaixa.Left, 120, 330); _cbSessao.Width = cbCaixa.Width - 16;
        }
        barra.Resize += (_, _) => Posicionar(); _lPassagens.SizeChanged += (_, _) => Posicionar();
        return barra;
    }

    void BandeiraPilotoAoVivo(string flag)
    {
        if (_sess == null) { Msg.Aviso(this, "Selecione uma bateria."); return; }
        var kart = (_gRes.ChaveAtual as JsonObject)?.S("kart");
        if (string.IsNullOrEmpty(kart)) kart = (_gPass.ChaveAtual as JsonObject)?.S("kart");
        if (string.IsNullOrEmpty(kart)) { Msg.Aviso(this, "Clique no piloto (no resultado ou nas passagens) e depois na bandeira."); return; }
        var atual = _bandeiraPiloto.GetValueOrDefault(kart, "none");
        var nova = atual == flag ? "none" : flag;
        Seguro.Rodar(this, async () => { await Crono.Api.Post($"/api/sessions/{_sess.S("id")}/flag/{Uri.EscapeDataString(kart)}", new JsonObject { ["flag"] = nova }); await Atualizar(); });
    }

    void ExportarResultado()
    {
        if (_sess == null) { Msg.Aviso(this, "Selecione uma bateria."); return; }
        using var d = new SaveFileDialog { FileName = $"resultado-{string.Concat(_sess.S("name").Where(char.IsLetterOrDigit))}-{DateTime.Now:yyyyMMdd-HHmm}.csv", Filter = "Planilha (*.csv)|*.csv" };
        if (d.ShowDialog(this) != DialogResult.OK) return;
        var sb = new System.Text.StringBuilder();
        static string Q(object v) => "\"" + (v?.ToString() ?? "").Replace("\"", "\"\"") + "\"";
        sb.AppendLine(string.Join(";", _gRes.Columns.Cast<DataGridViewColumn>().Select(c => Q(c.HeaderText))));
        foreach (DataGridViewRow r in _gRes.Rows) sb.AppendLine(string.Join(";", r.Cells.Cast<DataGridViewCell>().Select(c => Q(c.FormattedValue))));
        File.WriteAllText(d.FileName, sb.ToString(), new System.Text.UTF8Encoding(true));
        Msg.Info(this, $"Resultado salvo em {Path.GetFileName(d.FileName)}.");
    }

    // ------------------------------------------------------------------ estilos das grades do resultado (bolinha, seta, nº em tecla)
    void EstilizarResultado(LiveGrid g)
    {
        g.RowTemplate.Height = 36;
        g.CellPainting += (_, e) =>
        {
            if (e.RowIndex < 0 || e.ColumnIndex > 2 || e.RowIndex >= g.Chaves.Count || g.Chaves[e.RowIndex] is not JsonObject r) return;
            var gr = e.Graphics; gr.SmoothingMode = SmoothingMode.None;
            var sel = (e.State & DataGridViewElementStates.Selected) != 0;
            using (var fundo = new SolidBrush(sel ? e.CellStyle.SelectionBackColor : e.CellStyle.BackColor)) gr.FillRectangle(fundo, e.CellBounds);
            using (var linha = new Pen(g.GridColor)) gr.DrawLine(linha, e.CellBounds.Left, e.CellBounds.Bottom - 1, e.CellBounds.Right, e.CellBounds.Bottom - 1);
            var cb = e.CellBounds;
            gr.SmoothingMode = SmoothingMode.AntiAlias;
            if (e.ColumnIndex == 0)
            {
                var atras = r.I("gapLaps");
                var cor = atras <= 0 ? Color.FromArgb(52, 199, 89) : atras <= 2 ? Color.FromArgb(255, 204, 0) : atras <= 5 ? Color.FromArgb(255, 59, 48) : Color.FromArgb(29, 29, 31);
                using (var b = new SolidBrush(cor)) gr.FillEllipse(b, cb.X + 8, cb.Y + (cb.Height - 8) / 2f, 8, 8);
                using var f = new Font("Segoe UI", 9.6F, FontStyle.Bold);
                var pos = r.B("desclassificado") ? "DC" : r.I("position").ToString();
                var w = TextRenderer.MeasureText(pos, f, Size.Empty, TextFormatFlags.NoPadding).Width;
                TextRenderer.DrawText(gr, pos, f, new Rectangle(cb.X + 21, cb.Y, w + 2, cb.Height), TemaCrono.Texto, TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
                if (_setas.TryGetValue(r.S("kart"), out var d) && d != 0)
                    TextRenderer.DrawText(gr, d > 0 ? "▲" : "▼", new Font("Segoe UI", 7F), new Rectangle(cb.X + 24 + w, cb.Y, 14, cb.Height), d > 0 ? Color.FromArgb(28, 107, 53) : TemaCrono.Vermelho, TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
            }
            else if (e.ColumnIndex == 1)
            {
                var kart = r.S("kart");
                var q = new RectangleF(cb.X + (cb.Width - 32) / 2f, cb.Y + (cb.Height - 22) / 2f, 32, 22);
                using (var sombra = Forma.Redondo(new RectangleF(q.X, q.Y + 1, q.Width, q.Height), 6)) using (var bs = new SolidBrush(Color.FromArgb(174, 174, 178))) gr.FillPath(bs, sombra);
                using (var p = Forma.Redondo(q, 6)) using (var lg = new LinearGradientBrush(q, Color.White, Color.FromArgb(229, 229, 234), 90f)) gr.FillPath(lg, p);
                using var f = new Font("Cascadia Mono", 8.8F, FontStyle.Bold);
                TextRenderer.DrawText(gr, kart.Length == 0 ? "—" : kart.PadLeft(2, '0'), f, Rectangle.Round(q), TemaCrono.Texto, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
            }
            else
            {
                var x0 = cb.X + 4;
                if (_bandeiraPiloto.TryGetValue(r.S("kart"), out var bp) && bp is "black" or "mechanical" or "warning" or "blue" or "penalty")
                {
                    var pr = new RectangleF(x0, cb.Y + (cb.Height - 12) / 2f, 18, 12);
                    PanoPiloto(gr, bp, pr); x0 += 24;
                }
                // selos à direita do nome: advertências, penalidade de tempo e desclassificado (bandeira preta)
                var selos = new List<(string texto, Color fundo, Color letra)>();
                if (r.I("advertencias") > 0) selos.Add(($"ADV {r.I("advertencias")}", Color.FromArgb(232, 232, 235), TemaCrono.Texto));
                if (r.L("penaltyMs") is long pm && pm > 0) selos.Add(($"+{(pm / 1000.0).ToString("0.###", Fmt.Br)} s", Color.FromArgb(255, 229, 227), TemaCrono.Vermelho));
                if (r.B("desclassificado")) selos.Add(("DESCLASSIFICADO", Color.FromArgb(29, 29, 31), Color.White));
                var xr = cb.Right - 6;
                using (var fs = new Font("Segoe UI", 7.8F, FontStyle.Bold))
                    for (var i = selos.Count - 1; i >= 0; i--)
                    {
                        var w = TextRenderer.MeasureText(selos[i].texto, fs, Size.Empty, TextFormatFlags.NoPadding).Width + 10;
                        if (xr - w < x0 + 60) break;
                        var pr = new Rectangle(xr - w, cb.Y + (cb.Height - 18) / 2, w, 18);
                        using (var pp = Forma.Redondo(pr, 6)) using (var pb = new SolidBrush(selos[i].fundo)) gr.FillPath(pb, pp);
                        TextRenderer.DrawText(gr, selos[i].texto, fs, pr, selos[i].letra, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
                        xr -= w + 4;
                    }
                using var f = new Font("Segoe UI Semibold", 9.8F);
                TextRenderer.DrawText(gr, e.FormattedValue?.ToString(), f, new Rectangle(x0, cb.Y, xr - x0 - 2, cb.Height), sel ? e.CellStyle.SelectionForeColor : TemaCrono.Texto, TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
            }
            gr.SmoothingMode = SmoothingMode.None; // a próxima célula é pintada pelo Windows: sem anti-serrilhado ela não ganha contorno cinza
            e.Handled = true;
        };
    }

    static void PanoPiloto(Graphics g, string flag, RectangleF r)
    {
        switch (flag)
        {
            case "black": { using var b = new SolidBrush(Color.FromArgb(29, 29, 31)); g.FillRectangle(b, r); break; }
            case "mechanical": { using var b = new SolidBrush(Color.FromArgb(29, 29, 31)); g.FillRectangle(b, r); using var o = new SolidBrush(Color.FromArgb(255, 149, 0)); var d = r.Height * 0.7f; g.FillEllipse(o, r.X + (r.Width - d) / 2, r.Y + (r.Height - d) / 2, d, d); break; }
            case "warning": { g.FillRectangle(Brushes.White, r); using var b = new SolidBrush(Color.FromArgb(29, 29, 31)); g.FillPolygon(b, [new PointF(r.Left, r.Top), new PointF(r.Right, r.Top), new PointF(r.Left, r.Bottom)]); break; }
            case "blue": { using var b = new SolidBrush(Color.FromArgb(10, 132, 255)); g.FillRectangle(b, r); break; }
            case "penalty": { g.FillRectangle(Brushes.White, r); using var b = new SolidBrush(Color.FromArgb(255, 59, 48)); g.FillRectangle(b, r.X, r.Y, r.Width, r.Height / 2); break; }
        }
        using var borda = new Pen(Color.FromArgb(60, 0, 0, 0)); g.DrawRectangle(borda, r.X, r.Y, r.Width, r.Height);
    }

    Control Legenda()
    {
        var l = new Panel { Dock = DockStyle.Bottom, Height = 34, BackColor = Color.FromArgb(251, 251, 253) };
        l.Paint += (_, e) =>
        {
            var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
            using (var p = new Pen(Color.FromArgb(237, 237, 237))) g.DrawLine(p, 0, 0, l.Width, 0);
            using var f = new Font("Segoe UI", 8.6F); using var fb = new Font("Segoe UI Semibold", 8.6F);
            var x = 12;
            void Bola(Color c, string t)
            {
                using (var b = new SolidBrush(c)) g.FillEllipse(b, x, 13, 8, 8);
                x += 14; TextRenderer.DrawText(g, t, f, new Point(x, 9), Color.FromArgb(58, 58, 60)); x += TextRenderer.MeasureText(t, f).Width + 10;
            }
            void Txt(string t, Color c, Font fo) { TextRenderer.DrawText(g, t, fo, new Point(x, 9), c); x += TextRenderer.MeasureText(t, fo).Width + 10; }
            Bola(Color.FromArgb(52, 199, 89), "Mesma volta do líder"); Bola(Color.FromArgb(255, 204, 0), "Até 2 voltas atrás"); Bola(Color.FromArgb(255, 59, 48), "Até 5 voltas atrás"); Bola(Color.FromArgb(29, 29, 31), "Mais de 5 voltas");
            Txt("▲ ganhou posição", Color.FromArgb(28, 107, 53), f); Txt("▼ perdeu posição", TemaCrono.Vermelho, f); Txt("■ melhor volta da prova", Color.FromArgb(122, 47, 194), fb);
        };
        return l;
    }

    // ------------------------------------------------------------------ atualização do visual (chamada no fim do Desenhar)
    void AtualizarDesign()
    {
        var s0 = _sess;
        var estado = s0?.S("state") ?? "";
        var evento = _events.FirstOrDefault(e => e.S("id") == s0?.S("eventId"));
        var grupo = _groups.FirstOrDefault(g => g.S("id") == s0?.S("groupId"));
        _lEvNome.Text = s0 == null ? "—" : evento?.S("name") ?? "Bateria avulsa";
        _lGrupoNome.Text = s0 == null ? "—" : grupo?.S("name") ?? (s0.S("name").Split('·')[0].Trim() is { Length: > 0 } gn ? gn : "—");
        _lProvaNome.Text = s0 == null ? "Selecione uma bateria" : $"{Crono.Tipo(s0.S("type")).ToUpperInvariant()} · {_lTipo.Text}";
        _lMinimo.Text = s0?.L("minLapMs") is long mm ? Crono.Relogio(mm)[..8] : "00:00:00";
        var ruido = (_state?["decoder"] as JsonObject)?.S("noise");
        _lRuido.Text = string.IsNullOrEmpty(ruido) ? "—" : int.TryParse(ruido, out var rn) ? $"{rn} · {(rn < 50 ? "bom" : rn < 80 ? "médio" : "alto")}" : ruido;

        // bandeiras da prova
        var flag = s0?.S("currentFlag") ?? "none";
        var correndo = estado == "em_andamento";
        // com a prova correndo a verde continua clicável: relargada ou pista liberada depois da amarela/vermelha
        _fVerde.Estado = estado == "preparando" ? EstadoBotao.Normal : estado is "em_andamento" or "bandeira_final" ? (correndo && flag == "green" ? EstadoBotao.Ativo : EstadoBotao.Normal) : EstadoBotao.Apagado;
        if (s0?.B("aguardandoLargada") == true) _fVerde.Estado = EstadoBotao.Ativo;
        _fReiniciar.Estado = s0 != null && (estado != "preparando" || _laps.Any(p => !p.B("deleted") && !p.B("rejected"))) ? EstadoBotao.Normal : EstadoBotao.Apagado;
        foreach (var (b, f) in new[] { (_fAmarela, "yellow"), (_fVermelha, "red"), (_fBranca, "white"), (_fQuad, "checkered") })
            b.Estado = !correndo ? EstadoBotao.Apagado : flag == f ? EstadoBotao.Ativo : EstadoBotao.Normal;
        _fParar.Estado = estado is "em_andamento" or "bandeira_final" ? EstadoBotao.Normal : EstadoBotao.Apagado;
        if (estado == "bandeira_final") _fQuad.Estado = EstadoBotao.Ativo;

        // bandeiras por piloto
        _bandeiraPiloto = Crono.Arr(s0, "competitors").Where(c => c.S("flag") is { Length: > 0 } f && f != "none").ToDictionary(c => c.S("kart"), c => c.S("flag"));

        // setas de posição: compara com a classificação da passagem anterior
        var standings = Crono.Arr(s0, "standings");
        var chave = $"{s0?.S("id")}|{_laps.Count}";
        if (chave != _chavePosicoes)
        {
            var mesmaProva = _chavePosicoes.Split('|')[0] == (s0?.S("id") ?? "");
            _setas.Clear();
            if (mesmaProva) foreach (var r in standings) if (_posUltimo.TryGetValue(r.S("kart"), out var antes) && antes != r.I("position")) _setas[r.S("kart")] = antes - r.I("position");
            _posUltimo.Clear(); foreach (var r in standings) _posUltimo[r.S("kart")] = r.I("position");
            _chavePosicoes = chave;
        }

        // faixa do placar (mesmas páginas do painel de LED)
        var ultima = _laps.Where(p => !p.B("deleted") && !p.B("rejected") && p.L("lapMs") != null).OrderByDescending(p => p.L("wallMs")).FirstOrDefault();
        _faixa.Volta = standings.FirstOrDefault()?.I("laps") is int lv && lv > 0 ? lv.ToString() : ultima?.I("lap").ToString() ?? "—";
        _faixa.Situacao = s0 == null ? "SEM PROVA" : s0.B("aguardandoLargada") ? "AGUARDANDO" : estado switch { "em_andamento" => flag == "red" ? "PARADA" : s0.B("tempoEsgotado") ? "ESGOTADO" : s0.B("voltasCompletas") ? "COMPLETO" : "EM PROVA", "bandeira_final" => "FINAL", "encerrada" => "ENCERRADA", "preparando" => "AGUARDANDO", _ => Crono.Estado(estado).ToUpperInvariant() };
        var pag = Math.Max(0, _painel.Pagina);
        _faixa.Karts = standings.Skip(pag * 10).Take(12).Select(r => (r.S("kart").Length == 0 ? "—" : r.S("kart").PadLeft(2, '0'), r.I("gapLaps"))).ToList();
        _faixa.Paginas = Math.Max(1, (int)Math.Ceiling(standings.Count / 10.0));
        _faixa.Pagina = pag;
        _faixa.PaginaTelao = ((_state?["tb50"] as JsonObject)?.I("offset") ?? 0) / 20;
        _faixa.PaginasTelao = Math.Max(1, (int)Math.Ceiling(standings.Count / 20.0));
        _faixa.Auto = _chkPainelAuto.Checked;
        _faixa.Invalidate();

        // rodapé
        var dec = _state?["decoder"] as JsonObject;
        var decOk = dec?.B("healthy") ?? false;
        _rodTexto.Text = $"{DateTime.Now:HH:mm} · {DateTime.Now:dd/MM/yyyy}      {Environment.MachineName}      Decoder {dec?.S("protocol")?.ToUpperInvariant() switch { "TRX" => "TranX", "P3" => "P3", var p => p }} {dec?.S("host")}:{dec?.S("port")}      {Environment.UserName}      Versão {Application.ProductVersion.Split('+')[0]}" + (_servidorOk ? "" : "      SEM CONEXÃO COM A CRONOMETRAGEM");
        _pDecoder.Ok = decOk && _servidorOk; _pDecoder.Dica = _sDecoder.Text;
        _pPlacar.Desligado = !_painel.Ativo; _pPlacar.Ok = _painel.Ativo && _painel.Ok; _pPlacar.Dica = _painel.Ativo ? _sPainel.Text : "Painel de LED desligado neste computador (clique para configurar)";
        _pTv.Ok = _tv is { IsDisposed: false }; _pTv.Dica = _pTv.Ok ? "Telão aberto" : "Telão fechado (clique para abrir)";
        _pTransp.Visible = _sTransp.Text.Length > 0; _pTransp.Texto = "TRANSPONDER SEM KART"; _pTransp.Ok = false; _pTransp.Dica = _sTransp.Text;
        _passos.AoVivo = s0 != null && estado is "em_andamento" or "bandeira_final";
        // passos 4–5: título e subtítulo do design
        if (s0 != null)
        {
            _lPilotosTitulo.Text = s0.S("name");
            _subPilotos.Text = $"{(evento?.S("name") ?? "Bateria avulsa")} · {Crono.Arr(s0, "competitors").Count} competidores · {Crono.Estado(estado)}";
        }
        _subArvore.Text = _events.FirstOrDefault(e => e.S("id") == _eventoArvore)?.S("name") ?? evento?.S("name") ?? "Selecione uma prova";
        AtualizarExtrasPilotos();
        // aba Equalização aberta: acompanha as voltas ao vivo
        if (_abas.SelectedIndex == 4) _ = CarregarEqualizacao();
    }
}

/// <summary>TabControl sem as abas: quem troca de página é o segmento do design.</summary>
public class AbasSemCabecalho : TabControl
{
    protected override void WndProc(ref Message m)
    {
        if (m.Msg == 0x1328 && !DesignMode) { m.Result = (IntPtr)1; return; } // TCM_ADJUSTRECT: sem espaço para as abas
        base.WndProc(ref m);
    }
}

/// <summary>Passos do cabeçalho (1–3 · 4–5 · Cronometragem) com a bolinha vermelha quando há prova correndo.</summary>
public class PassosSegmento : Control
{
    readonly string[][] _niveis;
    string[] _itens;
    int _nivel;
    /// <summary>Passo que ganha a bolinha vermelha quando há prova correndo (Cronometragem).</summary>
    public int IndiceAoVivo { get; init; } = -1;
    /// <summary>0 = nomes completos; 1 e 2 = nomes cada vez mais curtos (tela estreita).</summary>
    public int Nivel { get => _nivel; set { var v = Math.Clamp(value, 0, _niveis.Length - 1); if (_nivel == v) return; _nivel = v; _itens = _niveis[v]; Width = Larguras().Sum() + 6; Invalidate(); } }
    int _sel;
    bool _aoVivo;
    public event Action<int> Mudou;
    static readonly Font FonteN = new("Segoe UI", 9.8F), FonteS = new("Segoe UI Semibold", 9.8F);
    public int Selecionado { get => _sel; set { if (_sel == value) return; _sel = value; Invalidate(); } }
    public bool AoVivo { get => _aoVivo; set { if (_aoVivo == value) return; _aoVivo = value; Invalidate(); } }

    public PassosSegmento(string[] itens, params string[][] curtos)
    {
        _niveis = [itens, .. curtos]; _itens = itens;
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        Cursor = Cursors.Hand; Height = 36; Width = Larguras().Sum() + 6;
    }

    int AoVivoIdx => IndiceAoVivo >= 0 ? IndiceAoVivo : _itens.Length - 1;
    int[] Larguras() => _itens.Select((t, i) => TextRenderer.MeasureText(t, FonteS).Width + 28 + (i == AoVivoIdx ? 13 : 0)).ToArray();

    protected override void OnMouseClick(MouseEventArgs e)
    {
        base.OnMouseClick(e);
        var x = 3; var l = Larguras();
        for (var i = 0; i < l.Length; i++) { if (e.X >= x && e.X < x + l[i]) { Selecionado = i; Mudou?.Invoke(i); return; } x += l[i]; }
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(Parent?.BackColor ?? Color.White);
        using (var p = Forma.Redondo(new Rectangle(0, 0, Width - 1, Height - 1), 10)) using (var b = new SolidBrush(Color.FromArgb(232, 232, 235))) g.FillPath(b, p);
        var x = 3; var l = Larguras();
        for (var i = 0; i < _itens.Length; i++)
        {
            var r = new Rectangle(x, 3, l[i], 30);
            if (i == _sel)
            {
                using (var s = Forma.Redondo(new Rectangle(r.X, r.Y + 1, r.Width, r.Height), 8)) using (var bs = new SolidBrush(Color.FromArgb(30, 0, 0, 0))) g.FillPath(bs, s);
                using var p = Forma.Redondo(r, 8); g.FillPath(Brushes.White, p);
            }
            var tr = r;
            if (i == AoVivoIdx)
            {
                var cor = _aoVivo ? Color.FromArgb(255, 59, 48) : Color.FromArgb(174, 174, 178);
                var cx = r.X + 14; var cy = r.Y + r.Height / 2;
                if (_aoVivo) using (var halo = new SolidBrush(Color.FromArgb(51, 255, 59, 48))) g.FillEllipse(halo, cx - 6.5f, cy - 6.5f, 13, 13);
                using (var b = new SolidBrush(cor)) g.FillEllipse(b, cx - 3.5f, cy - 3.5f, 7, 7);
                tr = new Rectangle(r.X + 13, r.Y, r.Width - 13, r.Height);
            }
            TextRenderer.DrawText(g, _itens[i], i == _sel ? FonteS : FonteN, tr, i == _sel ? TemaCrono.Texto : Color.FromArgb(58, 58, 60), TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPrefix);
            x += l[i];
        }
    }
}

public enum EstadoBotao { Normal, Ativo, Apagado }

/// <summary>Botão de bandeira da prova (72×58, raio 12): pano colorido na haste + nome embaixo.</summary>
public class BotaoBandeira : Control
{
    readonly Color _pano;
    EstadoBotao _estado = EstadoBotao.Normal;
    bool _sobre;
    public bool Xadrez { get; init; }
    public bool Parar { get; init; }
    /// <summary>Seta circular laranja (reiniciar a bateria) no lugar do pano.</summary>
    public bool Reiniciar { get; init; }
    public string Dica { set => new ToolTip().SetToolTip(this, value); }
    public EstadoBotao Estado { get => _estado; set { if (_estado == value) return; _estado = value; Cursor = value == EstadoBotao.Apagado ? Cursors.Default : Cursors.Hand; Invalidate(); } }

    public BotaoBandeira(string texto, Color pano)
    {
        Text = texto; _pano = pano;
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        Size = new Size(72, 58); Cursor = Cursors.Hand;
    }

    protected override void OnClick(EventArgs e) { if (_estado != EstadoBotao.Apagado) base.OnClick(e); }
    protected override void OnMouseEnter(EventArgs e) { base.OnMouseEnter(e); _sobre = true; Invalidate(); }
    protected override void OnMouseLeave(EventArgs e) { base.OnMouseLeave(e); _sobre = false; Invalidate(); }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(Parent?.BackColor ?? Color.White);
        var r = new Rectangle(1, 1, Width - 3, Height - 4);
        var apagado = _estado == EstadoBotao.Apagado;
        using (var p = Forma.Redondo(r, 12))
        {
            if (_estado == EstadoBotao.Ativo)
            {
                using var bg = new SolidBrush(Color.FromArgb(225, 247, 231)); g.FillPath(bg, p);
                using var pen = new Pen(Color.FromArgb(52, 199, 89), 2f); g.DrawPath(pen, p);
            }
            else
            {
                if (!apagado) using (var s = Forma.Redondo(new Rectangle(r.X, r.Y + 2, r.Width, r.Height), 12)) using (var bs = new SolidBrush(Color.FromArgb(18, 0, 0, 0))) g.FillPath(bs, s);
                using var bg = new SolidBrush(apagado ? Color.FromArgb(246, 246, 247) : _sobre ? Color.FromArgb(248, 248, 250) : Color.White); g.FillPath(bg, p);
                using var pen = new Pen(Color.FromArgb(apagado ? 12 : 22, 0, 0, 0)); g.DrawPath(pen, p);
            }
        }
        var alfa = apagado ? 110 : 255;
        if (Parar)
        {
            var q = new RectangleF((Width - 24) / 2f, 9, 24, 24);
            using var pq = Forma.Redondo(q, 7);
            using var lg = new LinearGradientBrush(q, Color.FromArgb(alfa, 255, 107, 94), Color.FromArgb(alfa, 216, 54, 43), 90f); g.FillPath(lg, pq);
        }
        else if (Reiniciar)
        {
            Forma.DesenharSvg(g, "M4 12a8 8 0 1 0 2.3-5.7M4 4v4.5h4.5", new RectangleF((Width - 24) / 2f, 9, 24, 24), Color.FromArgb(alfa, _pano), 2.4f);
        }
        else
        {
            var x0 = (Width - 30) / 2f; var y0 = 10f;
            using (var haste = new SolidBrush(Color.FromArgb(alfa, 99, 99, 102))) g.FillRectangle(haste, x0 + 2, y0, 2, 24);
            var pano = new RectangleF(x0 + 4, y0 + 1, 24, 14);
            if (Xadrez)
            {
                for (var yy = 0; yy < 2; yy++) for (var xx = 0; xx < 6; xx++)
                    using (var b = new SolidBrush((xx + yy) % 2 == 0 ? Color.FromArgb(alfa, 29, 29, 31) : Color.FromArgb(alfa, 255, 255, 255))) g.FillRectangle(b, pano.X + xx * 4, pano.Y + yy * 7, 4, 7);
            }
            else using (var b = new SolidBrush(Color.FromArgb(alfa, _pano))) using (var pp = Forma.Redondo(pano, 2)) g.FillPath(b, pp);
            using var borda = new Pen(Color.FromArgb(apagado ? 20 : 38, 0, 0, 0)); g.DrawRectangle(borda, pano.X, pano.Y, pano.Width, pano.Height);
        }
        var cor = apagado ? Color.FromArgb(142, 142, 147) : _estado == EstadoBotao.Ativo ? Color.FromArgb(28, 107, 53) : Parar ? TemaCrono.Vermelho : Reiniciar ? Color.FromArgb(176, 92, 0) : TemaCrono.Texto;
        using var f = new Font("Segoe UI Semibold", 8.3F);
        TextRenderer.DrawText(g, Text, f, new Rectangle(0, 36, Width, 16), cor, TextFormatFlags.HorizontalCenter | TextFormatFlags.NoPadding);
    }
}

/// <summary>Botão quadrado de 46 px (raio 11): branco com o pano da bandeira do piloto, ou colorido com ícone (saídas).</summary>
public class BotaoQuadrado : Control
{
    bool _sobre;
    public Action<Graphics, RectangleF> Pano { get; init; }
    public string Cor { get; init; }
    public string Svg { get; init; }
    public string Dica { set => new ToolTip().SetToolTip(this, value); }

    public BotaoQuadrado()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        Size = new Size(46, 46); Cursor = Cursors.Hand;
    }
    protected override void OnMouseEnter(EventArgs e) { base.OnMouseEnter(e); _sobre = true; Invalidate(); }
    protected override void OnMouseLeave(EventArgs e) { base.OnMouseLeave(e); _sobre = false; Invalidate(); }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(Parent?.BackColor ?? Color.White);
        var r = new RectangleF(1, 1, Width - 3, Height - 4);
        using var p = Forma.Redondo(r, 11);
        if (Cor != null)
        {
            var (c1, c2) = Forma.Gradiente(Cor);
            if (_sobre) { c1 = ControlPaint.Light(c1, .1f); c2 = ControlPaint.Light(c2, .1f); }
            using (var s = Forma.Redondo(new RectangleF(r.X, r.Y + 1.5f, r.Width, r.Height), 11)) using (var bs = new SolidBrush(Color.FromArgb(50, 0, 0, 0))) g.FillPath(bs, s);
            using var lg = new LinearGradientBrush(r, c1, c2, 90f); g.FillPath(lg, p);
            if (Svg != null) Forma.DesenharSvg(g, Svg, new RectangleF((Width - 21) / 2f, (Height - 22) / 2f, 21, 21), Color.White, 2f);
        }
        else
        {
            using (var s = Forma.Redondo(new RectangleF(r.X, r.Y + 2, r.Width, r.Height), 11)) using (var bs = new SolidBrush(Color.FromArgb(18, 0, 0, 0))) g.FillPath(bs, s);
            using var bg = new SolidBrush(_sobre ? Color.FromArgb(248, 248, 250) : Color.White); g.FillPath(bg, p);
            using var pen = new Pen(Color.FromArgb(22, 0, 0, 0)); g.DrawPath(pen, p);
            var q = new RectangleF((Width - 24) / 2f, (Height - 18) / 2f, 24, 16);
            g.SmoothingMode = SmoothingMode.None;
            Pano?.Invoke(g, q);
            using var borda = new Pen(Color.FromArgb(50, 0, 0, 0)); g.DrawRectangle(borda, q.X, q.Y, q.Width, q.Height);
        }
    }
}

/// <summary>Faixa preta da direita (84 px): VOLTA, número em amarelo, situação e os karts na ordem do placar
/// (preto = mesma volta, amarelo = até 2 voltas, vermelho = mais), com as páginas do telão de LED da TB50 (1–20 / 21–40 / 41–60,
/// valem para o ORBITS e o CRONO1) e as páginas 1–10 / 11–20 / 21–30 do painel de números da COM3.</summary>
public class FaixaPlacar : Control
{
    public string Volta { get; set; } = "—";
    public string Situacao { get; set; } = "AGUARDANDO";
    public List<(string kart, int atras)> Karts { get; set; } = [];
    public int Paginas { get; set; } = 1;
    public int Pagina { get; set; }
    public bool Auto { get; set; }
    public int PaginasTelao { get; set; } = 1;
    public int PaginaTelao { get; set; }
    public event Action<int> EscolheuPagina;
    public event Action<int> EscolheuPaginaTelao;
    public event Action AlternouAuto;

    public FaixaPlacar()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        BackColor = Color.FromArgb(29, 29, 31); Cursor = Cursors.Default;
        new ToolTip().SetToolTip(this, "TELÃO (TB50): 1–20, 21–40, 41–60 (Shift+F8/F9/F10), igual no ORBITS e no CRONO1; volta para 1–20 na bandeira verde.\nPAINEL (COM3): 1–10 (F8), 11–20 (F9), 21–30 (F10). Auto alterna a cada 5 s.");
    }

    Rectangle Botao(int i) => new(6, Height - 34 - (3 - i) * 28, Width - 12, 24);
    int TopoPainel => Height - 34 - 3 * 28 - 16;
    Rectangle BotaoTelao(int i) => new(6, TopoPainel - 4 - (3 - i) * 28, Width - 12, 24);
    int TopoTelao => BotaoTelao(0).Y - 16;

    protected override void OnMouseClick(MouseEventArgs e)
    {
        base.OnMouseClick(e);
        for (var i = 0; i < 3; i++) if (BotaoTelao(i).Contains(e.Location) && i < PaginasTelao) { EscolheuPaginaTelao?.Invoke(i); return; }
        for (var i = 0; i < 3; i++) if (Botao(i).Contains(e.Location) && i < Paginas) { EscolheuPagina?.Invoke(i); return; }
        if (new Rectangle(6, Height - 30, Width - 12, 24).Contains(e.Location) && Paginas > 1) AlternouAuto?.Invoke();
    }

    protected override void OnMouseMove(MouseEventArgs e)
    {
        base.OnMouseMove(e);
        Cursor = e.Y > TopoTelao ? Cursors.Hand : Cursors.Default;
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(Parent?.BackColor ?? Color.White);
        using var p = Forma.Redondo(new Rectangle(0, 0, Width - 1, Height - 1), 14);
        using (var b = new SolidBrush(Color.FromArgb(29, 29, 31))) g.FillPath(b, p);
        g.SetClip(p);
        using var fMini = new Font("Segoe UI", 7.8F, FontStyle.Bold);
        using var fVolta = new Font("Cascadia Mono", 19F, FontStyle.Bold);
        using var fKart = new Font("Cascadia Mono", 9.8F, FontStyle.Bold);
        var cinza = Color.FromArgb(174, 174, 178);
        TextRenderer.DrawText(g, "VOLTA", fMini, new Rectangle(0, 10, Width, 14), cinza, TextFormatFlags.HorizontalCenter);
        TextRenderer.DrawText(g, Volta, fVolta, new Rectangle(0, 23, Width, 30), Color.FromArgb(255, 214, 10), TextFormatFlags.HorizontalCenter);
        TextRenderer.DrawText(g, Situacao, new Font("Segoe UI", 7.2F, FontStyle.Bold), new Rectangle(0, 53, Width, 14), cinza, TextFormatFlags.HorizontalCenter);
        using (var sep = new Pen(Color.FromArgb(26, 255, 255, 255))) g.DrawLine(sep, 0, 73, Width, 73);
        var y = 74; var limite = TopoTelao - 6;
        foreach (var (kart, atras) in Karts)
        {
            if (y + 32 > limite) break;
            var (fundo, texto) = atras <= 0 ? (Color.FromArgb(29, 29, 31), Color.White) : atras <= 2 ? (Color.FromArgb(255, 214, 10), Color.FromArgb(29, 29, 31)) : (Color.FromArgb(255, 59, 48), Color.White);
            using (var bf = new SolidBrush(fundo)) g.FillRectangle(bf, 0, y, Width, 32);
            TextRenderer.DrawText(g, kart, fKart, new Rectangle(0, y, Width, 32), texto, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
            using (var sep = new Pen(Color.FromArgb(15, 255, 255, 255))) g.DrawLine(sep, 0, y + 31, Width, y + 31);
            y += 32;
        }
        // páginas do telão da TB50 (azul) e do painel da COM3 (verde)
        TextRenderer.DrawText(g, "TELÃO", fMini, new Rectangle(0, TopoTelao, Width, 14), cinza, TextFormatFlags.HorizontalCenter);
        string[] nomesTelao = ["1–20", "21–40", "41–60"];
        for (var i = 0; i < 3; i++)
        {
            var r = BotaoTelao(i); var ok = i < PaginasTelao; var sel = i == PaginaTelao;
            using var pb = Forma.Redondo(r, 7);
            using (var bb = new SolidBrush(sel ? Color.FromArgb(10, 132, 255) : Color.FromArgb(ok ? 40 : 18, 255, 255, 255))) g.FillPath(bb, pb);
            TextRenderer.DrawText(g, nomesTelao[i], new Font("Segoe UI Semibold", 8F), r, sel ? Color.White : Color.FromArgb(ok ? 230 : 90, 255, 255, 255), TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }
        TextRenderer.DrawText(g, "PAINEL", fMini, new Rectangle(0, TopoPainel, Width, 14), cinza, TextFormatFlags.HorizontalCenter);
        string[] nomes = ["1–10", "11–20", "21–30"];
        for (var i = 0; i < 3; i++)
        {
            var r = Botao(i); var ok = i < Paginas; var sel = i == Pagina;
            using var pb = Forma.Redondo(r, 7);
            using (var bb = new SolidBrush(sel ? Color.FromArgb(52, 199, 89) : Color.FromArgb(ok ? 40 : 18, 255, 255, 255))) g.FillPath(bb, pb);
            TextRenderer.DrawText(g, nomes[i], new Font("Segoe UI Semibold", 8F), r, sel ? Color.White : Color.FromArgb(ok ? 230 : 90, 255, 255, 255), TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }
        var ra = new Rectangle(6, Height - 30, Width - 12, 24);
        TextRenderer.DrawText(g, (Auto ? "● " : "○ ") + "Auto", new Font("Segoe UI", 8F), ra, Auto ? Color.FromArgb(52, 199, 89) : Color.FromArgb(Paginas > 1 ? 200 : 80, 255, 255, 255), TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        g.ResetClip();
    }
}

/// <summary>Pílula do rodapé (PLACAR · DECODER · TV): verde quando está ok, vermelha quando não.</summary>
public class PilulaStatus : Control
{
    bool _ok = true, _desligado;
    public bool Desligado { get => _desligado; set { if (_desligado == value) return; _desligado = value; Invalidate(); } }
    readonly ToolTip _dica = new();
    public string Texto { get => Text; set { Text = value; Width = TextRenderer.MeasureText(value, Fonte).Width + 30; Invalidate(); } }
    public bool Ok { get => _ok; set { if (_ok == value) return; _ok = value; Invalidate(); } }
    public string Dica { set => _dica.SetToolTip(this, value); }
    static readonly Font Fonte = new("Segoe UI", 8.3F, FontStyle.Bold);

    public PilulaStatus()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        Height = 19;
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(Parent?.BackColor ?? Color.White);
        var (fundo, texto, bola) = _desligado ? (Color.FromArgb(236, 236, 239), Color.FromArgb(110, 110, 115), Color.FromArgb(174, 174, 178)) : _ok ? (Color.FromArgb(222, 246, 229), Color.FromArgb(28, 107, 53), Color.FromArgb(52, 199, 89)) : (Color.FromArgb(255, 226, 224), Color.FromArgb(161, 29, 20), Color.FromArgb(255, 59, 48));
        using (var p = Forma.Redondo(new Rectangle(0, 0, Width - 1, Height - 1), 6)) using (var b = new SolidBrush(fundo)) g.FillPath(b, p);
        using (var b = new SolidBrush(bola)) g.FillEllipse(b, 8, (Height - 6) / 2f, 6, 6);
        TextRenderer.DrawText(g, Text, Fonte, new Rectangle(20, 0, Width - 22, Height), texto, TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
    }
}

/// <summary>Menu do cabeçalho e dos submenus no visual do design: itens com hover arredondado, fundo claro.</summary>
public class MenuDesignRenderer : ToolStripProfessionalRenderer
{
    readonly Color _fundo;
    public MenuDesignRenderer(Color fundo) { _fundo = fundo; RoundedEdges = false; }

    protected override void OnRenderToolStripBackground(ToolStripRenderEventArgs e)
    {
        if (e.ToolStrip is MenuStrip) { using var b = new SolidBrush(_fundo); e.Graphics.FillRectangle(b, e.AffectedBounds); }
        else { e.Graphics.Clear(Color.FromArgb(250, 250, 252)); }
    }

    protected override void OnRenderToolStripBorder(ToolStripRenderEventArgs e)
    {
        if (e.ToolStrip is MenuStrip) return;
        using var p = new Pen(Color.FromArgb(222, 222, 226));
        e.Graphics.DrawRectangle(p, 0, 0, e.ToolStrip.Width - 1, e.ToolStrip.Height - 1);
    }

    protected override void OnRenderImageMargin(ToolStripRenderEventArgs e) { }

    protected override void OnRenderMenuItemBackground(ToolStripItemRenderEventArgs e)
    {
        if (!e.Item.Selected && !(e.Item is ToolStripMenuItem { DropDown.Visible: true })) return;
        var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
        var topo = e.Item.Owner is MenuStrip;
        var r = topo ? new Rectangle(0, 0, e.Item.Width - 1, e.Item.Height - 1) : new Rectangle(4, 1, e.Item.Width - 9, e.Item.Height - 3);
        using var p = Forma.Redondo(r, 7);
        using var b = new SolidBrush(topo ? Color.FromArgb(232, 232, 235) : Color.FromArgb(226, 239, 234));
        g.FillPath(b, p);
    }

    protected override void OnRenderSeparator(ToolStripSeparatorRenderEventArgs e)
    {
        using var p = new Pen(Color.FromArgb(230, 230, 234));
        var y = e.Item.Height / 2;
        e.Graphics.DrawLine(p, 10, y, e.Item.Width - 10, y);
    }

    protected override void OnRenderItemText(ToolStripItemTextRenderEventArgs e)
    {
        e.TextColor = e.Item.Enabled ? TemaCrono.Texto : Color.FromArgb(160, 160, 165);
        base.OnRenderItemText(e);
    }
}
