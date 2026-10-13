using System.Drawing.Drawing2D;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

/// <summary>Peças visuais da tela principal copiadas do design aprovado (Main.dc.html).</summary>
static class VisualPrincipal
{
    public static readonly Color Lateral = Tokens.Claro.CorSuperficieLateral;
    public static readonly Color Selecao = Tokens.Claro.CorSelecaoFundo;   // rgba(11,122,83,0.14) sobre a lateral
    public static readonly Color TextoSel = Tokens.Claro.CorAcaoPrincipalPressionado;
    public static readonly Dictionary<string, Color> Pontos = new()
    {
        ["y"] = Tokens.Claro.CorEstadoAvisoSolido, ["g"] = Tokens.Claro.CorStatusOnline, ["r"] = Tokens.Claro.CorDominioBandeiraVermelha, ["b"] = Tokens.Claro.CorTextoLink,
    };

    static readonly Dictionary<string, Image> _cache = [];

    /// <summary>Ícone gerado do SVG aprovado (PNG em 2x, embutido em Icones\).</summary>
    public static Image Icone(string nome)
    {
        if (_cache.TryGetValue(nome, out var img)) return img;
        using var s = typeof(VisualPrincipal).Assembly.GetManifestResourceStream($"Kartodromo.Recepcao.Icones.{nome}.png");
        img = s == null ? new Bitmap(1, 1) : Image.FromStream(s);
        _cache[nome] = img;
        return img;
    }

    public static GraphicsPath Redondo(Rectangle r, int raio) => Forma.Redondo(r, raio);

    /// <summary>Botão da barra de ferramentas: bloco 36px com o ícone + nome embaixo (Main.dc.html).</summary>
    public static Control BotaoBarra(string icone, string texto, string dica, Action clique)
    {
        var largura = Math.Max(74, TextRenderer.MeasureText(texto, Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno)).Width + 16);
        var b = new Panel
        {
            Size = new Size(largura, 72),
            Margin = new Padding(1, 4, 1, 4),
            Cursor = Cursors.Hand,
            BackColor = Tokens.Primitivo.Branco,
            TabStop = true,
            AccessibleRole = AccessibleRole.PushButton,
            AccessibleName = texto,
            AccessibleDescription = dica,
        };
        var dentro = false;
        b.Paint += (_, e) =>
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias; g.InterpolationMode = InterpolationMode.HighQualityBicubic; g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            if (dentro)
            {
                using var f = new SolidBrush(Tokens.Claro.CorSuperficieCampo);
                using var p = Redondo(new Rectangle(0, 0, b.Width - 1, b.Height - 1), 12);
                g.FillPath(f, p);
            }
            var iconRect = new Rectangle((b.Width - 36) / 2, 7, 36, 36);
            if (string.IsNullOrWhiteSpace(icone))
                TextRenderer.DrawText(g, "⋯", Tokens.Fonte(Tokens.Claro.FonteTamanhoDisplayP, FontStyle.Bold), iconRect, Tokens.Claro.CorAcaoPrincipal, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
            else
                g.DrawImage(Icone(icone), iconRect);
            TextRenderer.DrawText(g, texto, Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno), new Rectangle(0, 48, b.Width, 18), KitVisual.Texto, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
            if (b.Focused)
                using (var pen = new Pen(Tokens.Claro.CorAcaoPrincipal, 2F))
                    g.DrawRectangle(pen, 1, 1, b.Width - 3, b.Height - 3);
        };
        b.MouseEnter += (_, _) => { dentro = true; b.Invalidate(); };
        b.MouseLeave += (_, _) => { dentro = false; b.Invalidate(); };
        b.GotFocus += (_, _) => b.Invalidate();
        b.LostFocus += (_, _) => b.Invalidate();
        b.Click += (_, _) => clique();
        b.KeyDown += (_, e) => { if (e.KeyCode is Keys.Enter or Keys.Space) { e.SuppressKeyPress = true; clique(); } };
        new ToolTip().SetToolTip(b, dica);
        return b;
    }

    public static Control Separador() => new Panel { Size = new Size(1, 44), Margin = new Padding(6, 14, 6, 0), BackColor = Tokens.Claro.CorBordaSutil };

    /// <summary>Selo do caixa no fim da barra (verde quando há terminal aberto, com halo e cores exatas do design).</summary>
    public sealed class SeloTerminal : Panel
    {
        public string Titulo = "Nenhum terminal aberto", Sub = "Clique para abrir o caixa";
        public bool Aberto;
        public SeloTerminal()
        {
            Size = new Size(210, 44); Cursor = Cursors.Hand; DoubleBuffered = true; BackColor = Tokens.Primitivo.Branco;
            Paint += (_, e) =>
            {
                var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
                using var p = Redondo(new Rectangle(0, 0, Width - 1, Height - 1), 12);
                using var f = new SolidBrush(Aberto ? Tokens.Claro.CorEstadoSucessoFundo : Tokens.Claro.CorSuperficieCampo);
                g.FillPath(f, p);
                
                var cy = Height / 2;
                if (Aberto)
                {
                    // Outer ring glow: rgba(52, 199, 89, 0.25)
                    using var glow = new SolidBrush(Color.FromArgb(64, 52, 199, 89));
                    g.FillEllipse(glow, 11, cy - 7, 14, 14);
                    // Core dot
                    using var dot = new SolidBrush(Tokens.Claro.CorStatusOnline);
                    g.FillEllipse(dot, 14, cy - 4, 8, 8);
                }
                else
                {
                    using var dot = new SolidBrush(Color.FromArgb(174, 174, 178));
                    g.FillEllipse(dot, 14, cy - 4, 8, 8);
                }
                
                TextRenderer.DrawText(g, Titulo, Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno, FontStyle.Bold), new Rectangle(32, 5, Width - 38, 18), Aberto ? Tokens.Claro.CorEstadoSucessoTexto : KitVisual.Texto, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPadding);
                TextRenderer.DrawText(g, Sub, Tokens.Fonte(Tokens.Claro.FonteTamanhoLegenda), new Rectangle(32, 23, Width - 38, 16), Aberto ? Color.FromArgb(58, 94, 69) : KitVisual.Secundario, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPadding);
            };
        }
        public void Definir(bool aberto, string titulo, string sub)
        {
            Aberto = aberto; Titulo = titulo; Sub = sub;
            Width = Math.Max(190, Math.Max(TextRenderer.MeasureText(titulo, Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno, FontStyle.Bold)).Width, TextRenderer.MeasureText(sub, Tokens.Fonte(Tokens.Claro.FonteTamanhoLegenda)).Width) + 48);
            Invalidate();
        }
    }

    /// <summary>Fundo da célula sem as bordas do Windows (PaintBackground desenhava contornos cinza nas linhas).</summary>
    internal static void Fundo(DataGridViewCellPaintingEventArgs e)
    {
        e.Graphics.SmoothingMode = SmoothingMode.None;
        var sel = (e.State & DataGridViewElementStates.Selected) != 0;
        using (var b = new SolidBrush(sel ? e.CellStyle.SelectionBackColor : e.CellStyle.BackColor)) e.Graphics.FillRectangle(b, e.CellBounds);
        using (var p = new Pen(Tokens.Claro.CorSuperficieCampo)) e.Graphics.DrawLine(p, e.CellBounds.Left, e.CellBounds.Bottom - 1, e.CellBounds.Right, e.CellBounds.Bottom - 1);
    }

    /// <summary>Desenha "pago" como círculo (verde com check / contorno) e categoria como etiqueta colorida.</summary>
    public static void PintarCelulas(DataGridView grade)
    {
        grade.CellPainting += (_, e) =>
        {
            if (e.RowIndex < 0 || e.ColumnIndex < 0) return;
            var col = grade.Columns[e.ColumnIndex];
            if (col is DataGridViewCheckBoxColumn && col.Name != "__sel")
            {
                Fundo(e);
                var ok = e.Value is true;
                var r = new Rectangle(e.CellBounds.X + (e.CellBounds.Width - 18) / 2, e.CellBounds.Y + (e.CellBounds.Height - 18) / 2, 18, 18);
                var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
                if (ok)
                {
                    using var f = new SolidBrush(Tokens.Claro.CorStatusOnline); g.FillEllipse(f, r);
                    using var pen = new Pen(Tokens.Primitivo.Branco, 2F) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round };
                    g.DrawLines(pen, [new PointF(r.X + 5, r.Y + 9.5F), new PointF(r.X + 8, r.Y + 12.5F), new PointF(r.X + 13, r.Y + 6.5F)]);
                }
                else { using var pen = new Pen(Tokens.Claro.CorTextoDesabilitado, 1.5F); g.DrawEllipse(pen, r); }
                e.Handled = true;
            }
            else if (col.Name == "cliente" && grade.Rows[e.RowIndex].Tag is System.Text.Json.Nodes.JsonObject o && o["aprovada"] != null && !o.B("aprovada") && o.S("status") != "cancelada")
            {
                // pré-reserva (ainda não aprovada): selo laranja antes do nome, como no design
                Fundo(e);
                var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
                var origem = o.S("origem") is { Length: > 0 } og ? " · " + char.ToUpper(og[0]) + og[1..] : "";
                var selo = "Pré-reserva" + origem;
                var fonte = Tokens.Fonte(Tokens.Claro.FonteTamanhoLegenda, FontStyle.Bold);
                var w = Math.Min(TextRenderer.MeasureText(selo, fonte).Width + 12, e.CellBounds.Width - 8);
                var r = new Rectangle(e.CellBounds.X + 6, e.CellBounds.Y + (e.CellBounds.Height - 20) / 2, w, 20);
                using (var p = Redondo(r, 6)) using (var f = new SolidBrush(Tokens.Claro.CorEstadoAvisoFundo)) g.FillPath(f, p);
                TextRenderer.DrawText(g, selo, fonte, r, Tokens.Claro.CorEstadoAvisoTexto, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding | TextFormatFlags.EndEllipsis);
                var resto = new Rectangle(r.Right + 6, e.CellBounds.Y, e.CellBounds.Right - r.Right - 8, e.CellBounds.Height);
                if (resto.Width > 20) TextRenderer.DrawText(g, e.FormattedValue?.ToString(), e.CellStyle.Font, resto, e.CellStyle.ForeColor, TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
                e.Handled = true;
            }
            else if (col.Name == "situacao" && e.Value is string sit && sit.Length > 0)
            {
                // situação da reserva como etiqueta: verde paga, laranja a pagar/pré-reserva, vermelho cancelada
                Fundo(e);
                var (fundo, texto) = sit switch
                {
                    "Paga" => (Tokens.Claro.CorEstadoSucessoFundo, Tokens.Claro.CorEstadoSucessoTexto),
                    "Cancelada" => (Tokens.Claro.CorEstadoPerigoFundo, Tokens.Claro.CorEstadoPerigoTexto),
                    _ => (Tokens.Claro.CorEstadoAvisoFundo, Tokens.Claro.CorEstadoAvisoTexto),
                };
                var fonte = Tokens.Fonte(Tokens.Claro.FonteTamanhoLegenda, FontStyle.Bold);
                var w = TextRenderer.MeasureText(sit, fonte).Width + 14;
                var r = new Rectangle(e.CellBounds.X + 6, e.CellBounds.Y + (e.CellBounds.Height - 20) / 2, Math.Min(w, e.CellBounds.Width - 10), 20);
                var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
                using var p = Redondo(r, 6); using var f = new SolidBrush(fundo); g.FillPath(f, p);
                TextRenderer.DrawText(g, sit, fonte, r, texto, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding | TextFormatFlags.EndEllipsis);
                e.Handled = true;
            }
            else if (col.Name == "categoria" && e.Value is string cat && cat.Length > 0)
            {
                Fundo(e);
                var superKart = cat.Contains("super", StringComparison.OrdinalIgnoreCase);
                var fundo = superKart ? Color.FromArgb(255, 236, 204) : Tokens.Claro.CorEstadoInfoFundo;
                var texto = superKart ? Tokens.Claro.CorEstadoAvisoTexto : Tokens.Claro.CorEstadoInfoTexto;
                var fonte = Tokens.Fonte(Tokens.Claro.FonteTamanhoLegenda, FontStyle.Bold);
                var w = TextRenderer.MeasureText(cat, fonte).Width + 12;
                var r = new Rectangle(e.CellBounds.X + 6, e.CellBounds.Y + (e.CellBounds.Height - 20) / 2, Math.Min(w, e.CellBounds.Width - 10), 20);
                var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
                using var p = Redondo(r, 6); using var f = new SolidBrush(fundo); g.FillPath(f, p);
                TextRenderer.DrawText(g, cat, fonte, r, texto, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding | TextFormatFlags.EndEllipsis);
                e.Handled = true;
            }
        };
    }

    /// <summary>Acerto das colunas depois de cada troca de lista: cabeçalho numa linha, números à direita, datas curtas.</summary>
    public static void AjustarColunas(DataGridView grade)
    {
        grade.ColumnHeadersDefaultCellStyle.WrapMode = DataGridViewTriState.False;
        grade.ColumnHeadersDefaultCellStyle.Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno, FontStyle.Bold);
        grade.ColumnHeadersDefaultCellStyle.ForeColor = KitVisual.Secundario;
        grade.ColumnHeadersDefaultCellStyle.BackColor = Tokens.Claro.CorSuperficieSuave;
        grade.ColumnHeadersDefaultCellStyle.Padding = new Padding(6, 0, 6, 0);
        grade.ColumnHeadersHeight = 38;
        grade.CellBorderStyle = DataGridViewCellBorderStyle.SingleHorizontal;
        grade.GridColor = Tokens.Claro.CorSuperficieCampo;
        if (ComAnoForaDoAtual.Add(grade)) grade.CellFormatting += DataComAno;
        foreach (DataGridViewColumn c in grade.Columns)
        {
            var dir = c.DefaultCellStyle.Alignment == DataGridViewContentAlignment.MiddleRight;
            c.HeaderCell.Style.Alignment = dir ? DataGridViewContentAlignment.MiddleRight : c is DataGridViewCheckBoxColumn ? DataGridViewContentAlignment.MiddleCenter : DataGridViewContentAlignment.MiddleLeft;
            if (c.DefaultCellStyle.Format == "dd/MM/yyyy HH:mm") { c.DefaultCellStyle.Format = "dd/MM HH:mm"; c.DefaultCellStyle.Font = Tokens.FonteNumero(Tokens.Claro.FonteTamanhoPequeno); c.Width = Math.Min(c.Width, 126); }
            if (c.Name is "reserva" or "total" or "final" or "nome") c.DefaultCellStyle.Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno, FontStyle.Bold);
            if (c is DataGridViewCheckBoxColumn && c.Name != "__sel") c.Width = Math.Max(64, TextRenderer.MeasureText(c.HeaderText, grade.ColumnHeadersDefaultCellStyle.Font).Width + 26 + FiltroColuna.LarguraFunil);
            // como no design: as colunas ocupam a largura da lista, na proporção das larguras pensadas,
            // e nenhuma fica menor que o próprio título (sem "Categ…", "Situ…" nem rolagem lateral à toa)
            var funil = c.HeaderCell.Style.Padding.Right > 4 ? 18 : 0;
            c.MinimumWidth = Math.Max(40, TextRenderer.MeasureText(c.HeaderText, grade.ColumnHeadersDefaultCellStyle.Font).Width + 22 + funil);
            c.FillWeight = Math.Max(1, c.Width);
            c.AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill;
        }
    }

    static readonly HashSet<DataGridView> ComAnoForaDoAtual = [];

    /// <summary>Data curta (dd/MM) só no ano corrente: "17/10" de 2025 parecia uma data futura na Oficina.</summary>
    static void DataComAno(object sender, DataGridViewCellFormattingEventArgs e)
    {
        if (sender is not DataGridView g || e.ColumnIndex < 0 || e.Value is not DateTime d || d.Year == DateTime.Today.Year) return;
        if (g.Columns[e.ColumnIndex].DefaultCellStyle.Format != "dd/MM HH:mm") return;
        e.Value = d.ToString("dd/MM/yy HH:mm");
        e.FormattingApplied = true;
    }
}
