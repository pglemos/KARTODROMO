using System.Drawing.Drawing2D;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

/// <summary>Peças visuais da tela principal copiadas do design aprovado (Main.dc.html).</summary>
static class VisualPrincipal
{
    public static readonly Color Lateral = Color.FromArgb(236, 236, 240);
    public static readonly Color Selecao = Color.FromArgb(218, 232, 225);   // rgba(11,122,83,0.14) sobre a lateral
    public static readonly Color TextoSel = Color.FromArgb(10, 94, 64);
    public static readonly Dictionary<string, Color> Pontos = new()
    {
        ["y"] = Color.FromArgb(255, 159, 10), ["g"] = Color.FromArgb(52, 199, 89), ["r"] = Color.FromArgb(255, 59, 48), ["b"] = Color.FromArgb(10, 132, 255),
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

    public static GraphicsPath Redondo(Rectangle r, int raio)
    {
        var d = Math.Max(2, Math.Min(raio * 2, Math.Min(r.Width, r.Height)));
        var p = new GraphicsPath();
        p.AddArc(r.Left, r.Top, d, d, 180, 90); p.AddArc(r.Right - d, r.Top, d, d, 270, 90);
        p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90); p.AddArc(r.Left, r.Bottom - d, d, d, 90, 90);
        p.CloseFigure();
        return p;
    }

    /// <summary>Botão da barra de ferramentas: bloco 36px com o ícone + nome embaixo (Main.dc.html).</summary>
    public static Control BotaoBarra(string icone, string texto, string dica, Action clique)
    {
        var largura = Math.Max(74, TextRenderer.MeasureText(texto, new Font("Segoe UI", 8.5F)).Width + 16);
        var b = new Panel { Size = new Size(largura, 72), Margin = new Padding(1, 4, 1, 4), Cursor = Cursors.Hand, BackColor = Color.White };
        var dentro = false;
        b.Paint += (_, e) =>
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias; g.InterpolationMode = InterpolationMode.HighQualityBicubic; g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            if (dentro)
            {
                using var f = new SolidBrush(Color.FromArgb(242, 242, 245));
                using var p = Redondo(new Rectangle(0, 0, b.Width - 1, b.Height - 1), 12);
                g.FillPath(f, p);
            }
            var iconRect = new Rectangle((b.Width - 36) / 2, 7, 36, 36);
            g.DrawImage(Icone(icone), iconRect);
            TextRenderer.DrawText(g, texto, new Font("Segoe UI", 8.5F), new Rectangle(0, 48, b.Width, 18), KitVisual.Texto, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
        };
        b.MouseEnter += (_, _) => { dentro = true; b.Invalidate(); };
        b.MouseLeave += (_, _) => { dentro = false; b.Invalidate(); };
        b.Click += (_, _) => clique();
        new ToolTip().SetToolTip(b, dica);
        return b;
    }

    public static Control Separador() => new Panel { Size = new Size(1, 44), Margin = new Padding(6, 14, 6, 0), BackColor = Color.FromArgb(229, 229, 234) };

    /// <summary>Selo do caixa no fim da barra (verde quando há terminal aberto, com halo e cores exatas do design).</summary>
    public sealed class SeloTerminal : Panel
    {
        public string Titulo = "Nenhum terminal aberto", Sub = "Clique para abrir o caixa";
        public bool Aberto;
        public SeloTerminal()
        {
            Size = new Size(210, 44); Cursor = Cursors.Hand; DoubleBuffered = true; BackColor = Color.White;
            Paint += (_, e) =>
            {
                var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
                using var p = Redondo(new Rectangle(0, 0, Width - 1, Height - 1), 12);
                using var f = new SolidBrush(Aberto ? Color.FromArgb(232, 247, 237) : Color.FromArgb(242, 242, 245));
                g.FillPath(f, p);
                
                var cy = Height / 2;
                if (Aberto)
                {
                    // Outer ring glow: rgba(52, 199, 89, 0.25)
                    using var glow = new SolidBrush(Color.FromArgb(64, 52, 199, 89));
                    g.FillEllipse(glow, 11, cy - 7, 14, 14);
                    // Core dot
                    using var dot = new SolidBrush(Color.FromArgb(52, 199, 89));
                    g.FillEllipse(dot, 14, cy - 4, 8, 8);
                }
                else
                {
                    using var dot = new SolidBrush(Color.FromArgb(174, 174, 178));
                    g.FillEllipse(dot, 14, cy - 4, 8, 8);
                }
                
                TextRenderer.DrawText(g, Titulo, new Font("Segoe UI", 9F, FontStyle.Bold), new Rectangle(32, 5, Width - 38, 18), Aberto ? Color.FromArgb(28, 107, 53) : KitVisual.Texto, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPadding);
                TextRenderer.DrawText(g, Sub, new Font("Segoe UI", 8F), new Rectangle(32, 23, Width - 38, 16), Aberto ? Color.FromArgb(58, 94, 69) : KitVisual.Secundario, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPadding);
            };
        }
        public void Definir(bool aberto, string titulo, string sub)
        {
            Aberto = aberto; Titulo = titulo; Sub = sub;
            Width = Math.Max(190, Math.Max(TextRenderer.MeasureText(titulo, new Font("Segoe UI", 9F, FontStyle.Bold)).Width, TextRenderer.MeasureText(sub, new Font("Segoe UI", 8F)).Width) + 48);
            Invalidate();
        }
    }

    /// <summary>Fundo da célula sem as bordas do Windows (PaintBackground desenhava contornos cinza nas linhas).</summary>
    internal static void Fundo(DataGridViewCellPaintingEventArgs e)
    {
        e.Graphics.SmoothingMode = SmoothingMode.None;
        var sel = (e.State & DataGridViewElementStates.Selected) != 0;
        using (var b = new SolidBrush(sel ? e.CellStyle.SelectionBackColor : e.CellStyle.BackColor)) e.Graphics.FillRectangle(b, e.CellBounds);
        using (var p = new Pen(Color.FromArgb(240, 240, 242))) e.Graphics.DrawLine(p, e.CellBounds.Left, e.CellBounds.Bottom - 1, e.CellBounds.Right, e.CellBounds.Bottom - 1);
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
                    using var f = new SolidBrush(Color.FromArgb(52, 199, 89)); g.FillEllipse(f, r);
                    using var pen = new Pen(Color.White, 2F) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round };
                    g.DrawLines(pen, [new PointF(r.X + 5, r.Y + 9.5F), new PointF(r.X + 8, r.Y + 12.5F), new PointF(r.X + 13, r.Y + 6.5F)]);
                }
                else { using var pen = new Pen(Color.FromArgb(199, 199, 204), 1.5F); g.DrawEllipse(pen, r); }
                e.Handled = true;
            }
            else if (col.Name == "cliente" && grade.Rows[e.RowIndex].Tag is System.Text.Json.Nodes.JsonObject o && o["aprovada"] != null && !o.B("aprovada") && o.S("status") != "cancelada")
            {
                // pré-reserva (ainda não aprovada): selo laranja antes do nome, como no design
                Fundo(e);
                var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
                var origem = o.S("origem") is { Length: > 0 } og ? " · " + char.ToUpper(og[0]) + og[1..] : "";
                var selo = "Pré-reserva" + origem;
                var fonte = new Font("Segoe UI", 8.2F, FontStyle.Bold);
                var w = Math.Min(TextRenderer.MeasureText(selo, fonte).Width + 12, e.CellBounds.Width - 8);
                var r = new Rectangle(e.CellBounds.X + 6, e.CellBounds.Y + (e.CellBounds.Height - 20) / 2, w, 20);
                using (var p = Redondo(r, 6)) using (var f = new SolidBrush(Color.FromArgb(255, 240, 219))) g.FillPath(f, p);
                TextRenderer.DrawText(g, selo, fonte, r, Color.FromArgb(138, 75, 0), TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding | TextFormatFlags.EndEllipsis);
                var resto = new Rectangle(r.Right + 6, e.CellBounds.Y, e.CellBounds.Right - r.Right - 8, e.CellBounds.Height);
                if (resto.Width > 20) TextRenderer.DrawText(g, e.FormattedValue?.ToString(), e.CellStyle.Font, resto, e.CellStyle.ForeColor, TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
                e.Handled = true;
            }
            else if (col.Name == "categoria" && e.Value is string cat && cat.Length > 0)
            {
                Fundo(e);
                var superKart = cat.Contains("super", StringComparison.OrdinalIgnoreCase);
                var fundo = superKart ? Color.FromArgb(255, 236, 204) : Color.FromArgb(225, 238, 255);
                var texto = superKart ? Color.FromArgb(138, 75, 0) : Color.FromArgb(10, 79, 160);
                var fonte = new Font("Segoe UI", 8.2F, FontStyle.Bold);
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
        grade.ColumnHeadersDefaultCellStyle.Font = new Font("Segoe UI", 8.6F, FontStyle.Bold);
        grade.ColumnHeadersDefaultCellStyle.ForeColor = KitVisual.Secundario;
        grade.ColumnHeadersDefaultCellStyle.BackColor = Color.FromArgb(250, 250, 250);
        grade.ColumnHeadersDefaultCellStyle.Padding = new Padding(6, 0, 6, 0);
        grade.ColumnHeadersHeight = 38;
        grade.CellBorderStyle = DataGridViewCellBorderStyle.SingleHorizontal;
        grade.GridColor = Color.FromArgb(240, 240, 242);
        foreach (DataGridViewColumn c in grade.Columns)
        {
            var dir = c.DefaultCellStyle.Alignment == DataGridViewContentAlignment.MiddleRight;
            c.HeaderCell.Style.Alignment = dir ? DataGridViewContentAlignment.MiddleRight : c is DataGridViewCheckBoxColumn ? DataGridViewContentAlignment.MiddleCenter : DataGridViewContentAlignment.MiddleLeft;
            if (c.DefaultCellStyle.Format == "dd/MM/yyyy HH:mm") { c.DefaultCellStyle.Format = "dd/MM HH:mm"; c.DefaultCellStyle.Font = new Font("Cascadia Mono", 8.6F); c.Width = Math.Min(c.Width, 108); }
            if (c.Name is "reserva" or "total" or "final" or "nome") c.DefaultCellStyle.Font = new Font("Segoe UI", 9.2F, FontStyle.Bold);
            if (c is DataGridViewCheckBoxColumn && c.Name != "__sel") c.Width = Math.Max(64, TextRenderer.MeasureText(c.HeaderText, grade.ColumnHeadersDefaultCellStyle.Font).Width + 26 + FiltroColuna.LarguraFunil);
            c.MinimumWidth = 40;
        }
    }
}
