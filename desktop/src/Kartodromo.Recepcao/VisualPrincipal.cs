using System.Drawing.Drawing2D;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

/// <summary>Peças visuais da tela principal copiadas do design aprovado (Main.dc.html).</summary>
static class VisualPrincipal
{
    public static readonly Color Lateral = Color.FromArgb(240, 240, 243);
    public static readonly Color Selecao = Color.FromArgb(214, 230, 222);   // rgba(11,122,83,0.14) sobre a lateral
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

    /// <summary>Botão da barra de ferramentas: bloco colorido 36px com o ícone + nome embaixo.</summary>
    public static Control BotaoBarra(string icone, string texto, string dica, Action clique)
    {
        var largura = Math.Max(60, TextRenderer.MeasureText(texto, new Font("Segoe UI", 8.4F)).Width + 12);
        var b = new Panel { Size = new Size(largura, 70), Margin = new Padding(1, 4, 1, 4), Cursor = Cursors.Hand, BackColor = Color.White };
        var dentro = false;
        b.Paint += (_, e) =>
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias; g.InterpolationMode = InterpolationMode.HighQualityBicubic; g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            if (dentro) { using var f = new SolidBrush(Color.FromArgb(242, 242, 245)); using var p = Redondo(new Rectangle(0, 0, b.Width - 1, b.Height - 1), 10); g.FillPath(f, p); }
            g.DrawImage(Icone(icone), new Rectangle((b.Width - 48) / 2, 0, 48, 48));
            TextRenderer.DrawText(g, texto, new Font("Segoe UI", 8.4F), new Rectangle(0, 47, b.Width, 20), KitVisual.Texto, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
        };
        b.MouseEnter += (_, _) => { dentro = true; b.Invalidate(); };
        b.MouseLeave += (_, _) => { dentro = false; b.Invalidate(); };
        b.Click += (_, _) => clique();
        new ToolTip().SetToolTip(b, dica);
        return b;
    }

    public static Control Separador() => new Panel { Size = new Size(1, 44), Margin = new Padding(8, 16, 8, 0), BackColor = Color.FromArgb(229, 229, 234) };

    /// <summary>Selo do caixa no fim da barra (verde quando há terminal aberto).</summary>
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
                using var f = new SolidBrush(Aberto ? Color.FromArgb(232, 247, 237) : Color.FromArgb(242, 242, 245)); g.FillPath(f, p);
                using var dot = new SolidBrush(Aberto ? Color.FromArgb(52, 199, 89) : Color.FromArgb(174, 174, 178));
                g.FillEllipse(dot, 14, Height / 2 - 5, 10, 10);
                TextRenderer.DrawText(g, Titulo, new Font("Segoe UI", 9F, FontStyle.Bold), new Rectangle(32, 5, Width - 38, 18), Aberto ? Color.FromArgb(28, 107, 53) : KitVisual.Texto, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPadding);
                TextRenderer.DrawText(g, Sub, new Font("Segoe UI", 8F), new Rectangle(32, 23, Width - 38, 16), KitVisual.Secundario, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPadding);
            };
        }
        public void Definir(bool aberto, string titulo, string sub)
        {
            Aberto = aberto; Titulo = titulo; Sub = sub;
            Width = Math.Max(180, Math.Max(TextRenderer.MeasureText(titulo, new Font("Segoe UI", 9F, FontStyle.Bold)).Width, TextRenderer.MeasureText(sub, new Font("Segoe UI", 8F)).Width) + 46);
            Invalidate();
        }
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
                e.PaintBackground(e.CellBounds, true);
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
            else if (col.Name == "categoria" && e.Value is string cat && cat.Length > 0)
            {
                e.PaintBackground(e.CellBounds, true);
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
            if (c is DataGridViewCheckBoxColumn && c.Name != "__sel") c.Width = Math.Max(64, TextRenderer.MeasureText(c.HeaderText, grade.ColumnHeadersDefaultCellStyle.Font).Width + 26);
            c.MinimumWidth = 40;
        }
    }
}
