using System.Drawing.Drawing2D;
using System.Globalization;
using System.Text.RegularExpressions;

namespace Kartodromo.Comum;

/// <summary>Janelas desenhadas à mão (design aprovado): o kit visual genérico da recepção não mexe nelas.</summary>
public interface ISemKit { }

/// <summary>Formas e ícones do design aprovado (canvas), usados pela recepção e pela cronometragem.</summary>
public static partial class Forma
{
    /// <summary>Ícones PNG do programa (a recepção registra os dela na partida). Nome que começa com M/m é caminho SVG.</summary>
    public static Func<string, Image> Icones { get; set; }

    public static Image Icone(string nome) => Icones?.Invoke(nome) ?? new Bitmap(1, 1);

    public static GraphicsPath Redondo(Rectangle r, int raio) => Redondo((RectangleF)r, raio);

    public static GraphicsPath Redondo(RectangleF r, float raio)
    {
        var d = Math.Max(2f, Math.Min(raio * 2, Math.Min(r.Width, r.Height)));
        var p = new GraphicsPath();
        p.AddArc(r.Left, r.Top, d, d, 180, 90); p.AddArc(r.Right - d, r.Top, d, d, 270, 90);
        p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90); p.AddArc(r.Left, r.Bottom - d, d, d, 90, 90);
        p.CloseFigure();
        return p;
    }

    public static void AplicarRaio(Control c, int raio)
    {
        if (c.Width < 2 || c.Height < 2) return;
        using var path = Redondo(new Rectangle(0, 0, c.Width, c.Height), Math.Min(raio, Math.Min(c.Width, c.Height) / 2));
        c.Region = new Region(path);
    }

    public static readonly Color Verde = Color.FromArgb(11, 122, 83);

    /// <summary>Caixa de marcar verde arredondada do design (accent-color #0B7A53).</summary>
    public static void CheckVerde(CheckBox ck)
    {
        if (ck.Tag as string == "check-verde") return;
        ck.Tag ??= "check-verde";
        ck.Paint += (_, e) =>
        {
            var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
            var lado = (int)Math.Round(16 * ck.DeviceDpi / 96.0);
            var y = ck.CheckAlign switch { ContentAlignment.TopLeft => 1, _ => (ck.Height - lado) / 2 };
            var r = new Rectangle(0, y, lado, lado);
            using (var fundo = new SolidBrush(ck.BackColor.A == 255 ? ck.BackColor : ck.Parent?.BackColor ?? Color.White)) g.FillRectangle(fundo, new Rectangle(0, 0, lado + 2, ck.Height));
            using var p = Redondo(r, 4);
            if (ck.Checked)
            {
                using var b = new SolidBrush(ck.Enabled ? Verde : Color.FromArgb(160, 196, 180)); g.FillPath(b, p);
                using var pen = new Pen(Color.White, 2F) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round };
                g.DrawLines(pen, [new PointF(r.X + lado * 0.26F, r.Y + lado * 0.52F), new PointF(r.X + lado * 0.44F, r.Y + lado * 0.70F), new PointF(r.X + lado * 0.76F, r.Y + lado * 0.32F)]);
            }
            else
            {
                using var b = new SolidBrush(Color.White); g.FillPath(b, p);
                using var pen = new Pen(Color.FromArgb(199, 199, 204), 1.4F); g.DrawPath(pen, p);
            }
        };
    }

    /// <summary>"linear-gradient(180deg, #6CB8FF, #1E6FE8)" → as duas cores.</summary>
    public static (Color cima, Color baixo) Gradiente(string css)
    {
        var hex = Regex.Matches(css ?? "", "#([0-9A-Fa-f]{6})").Select(m => ColorTranslator.FromHtml(m.Value)).ToArray();
        return hex.Length >= 2 ? (hex[0], hex[1]) : hex.Length == 1 ? (hex[0], hex[0]) : (Color.FromArgb(154, 154, 160), Color.FromArgb(74, 74, 79));
    }

    static readonly Dictionary<string, Image> _tiles = [];

    /// <summary>Bloco do ícone do design: quadrado arredondado com degradê e o desenho SVG branco (traço 2 em 24).
    /// <paramref name="lado"/> é o tamanho na tela (34 nas janelas, 26 nos menus); a imagem sai em 3x para ficar nítida.</summary>
    public static Image Tile(string svg, string corCss, int lado = 34, float icone = 18)
    {
        var chave = $"{svg}|{corCss}|{lado}|{icone}";
        if (_tiles.TryGetValue(chave, out var pronto)) return pronto;
        const int k = 3;
        var L = lado * k;
        var bmp = new Bitmap(L, L);
        using (var g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias; g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            var (c1, c2) = Gradiente(corCss);
            var raio = lado * 9f / 34 * k;
            using (var path = Redondo(new RectangleF(0, 0, L - 1, L - 1), raio))
            using (var b = new LinearGradientBrush(new Rectangle(0, 0, L, L), c1, c2, 90f)) g.FillPath(b, path);
            using (var brilho = new Pen(Color.FromArgb(90, 255, 255, 255), k))
                g.DrawLine(brilho, raio * 0.8f, k / 2f + 1, L - raio * 0.8f, k / 2f + 1);
            var escala = icone * k / 24f;
            var off = (L - icone * k) / 2f;
            using var caminho = Svg(svg);
            using var m = new Matrix(); m.Translate(off, off); m.Scale(escala, escala);
            caminho.Transform(m);
            using var pen = new Pen(Color.White, 2f * escala) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round };
            g.DrawPath(pen, caminho);
        }
        _tiles[chave] = bmp;
        return bmp;
    }

    /// <summary>Desenho SVG solto (sem bloco), na cor e tamanho pedidos — ex.: ícones dos botões.</summary>
    public static void DesenharSvg(Graphics g, string svg, RectangleF area, Color cor, float traco = 2f)
    {
        using var caminho = Svg(svg);
        var escala = Math.Min(area.Width, area.Height) / 24f;
        using var m = new Matrix(); m.Translate(area.X, area.Y); m.Scale(escala, escala);
        caminho.Transform(m);
        g.SmoothingMode = SmoothingMode.AntiAlias;
        using var pen = new Pen(cor, traco * escala) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round };
        g.DrawPath(pen, caminho);
    }

    /// <summary>Interpreta o atributo d de um &lt;path&gt; SVG (M L H V C S Q T A Z, absolutos e relativos).</summary>
    public static GraphicsPath Svg(string d)
    {
        var p = new GraphicsPath();
        var tokens = Regex.Matches(d ?? "", @"[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?").Select(m => m.Value).ToList();
        var i = 0; char cmd = 'M';
        PointF cur = default, ini = default, ctrl = default; char ult = ' ';
        float N() => float.Parse(tokens[i++], CultureInfo.InvariantCulture);
        bool TemNumero() => i < tokens.Count && !char.IsLetter(tokens[i][0]);
        while (i < tokens.Count)
        {
            if (char.IsLetter(tokens[i][0])) cmd = tokens[i++][0];
            var rel = char.IsLower(cmd);
            var o = rel ? cur : PointF.Empty;
            switch (char.ToUpperInvariant(cmd))
            {
                case 'M':
                    cur = new PointF(o.X + N(), o.Y + N()); ini = cur; p.StartFigure();
                    cmd = rel ? 'l' : 'L'; // pares seguintes são linhas
                    ult = 'M'; continue;
                case 'L': { var n = new PointF(o.X + N(), o.Y + N()); p.AddLine(cur, n); cur = n; break; }
                case 'H': { var n = new PointF((rel ? cur.X : 0) + N(), cur.Y); p.AddLine(cur, n); cur = n; break; }
                case 'V': { var n = new PointF(cur.X, (rel ? cur.Y : 0) + N()); p.AddLine(cur, n); cur = n; break; }
                case 'C':
                {
                    var c1 = new PointF(o.X + N(), o.Y + N()); var c2 = new PointF(o.X + N(), o.Y + N()); var n = new PointF(o.X + N(), o.Y + N());
                    p.AddBezier(cur, c1, c2, n); ctrl = c2; cur = n; ult = 'C'; continue;
                }
                case 'S':
                {
                    var c1 = ult == 'C' ? new PointF(2 * cur.X - ctrl.X, 2 * cur.Y - ctrl.Y) : cur;
                    var c2 = new PointF(o.X + N(), o.Y + N()); var n = new PointF(o.X + N(), o.Y + N());
                    p.AddBezier(cur, c1, c2, n); ctrl = c2; cur = n; ult = 'C'; continue;
                }
                case 'Q':
                {
                    var q = new PointF(o.X + N(), o.Y + N()); var n = new PointF(o.X + N(), o.Y + N());
                    Quad(p, cur, q, n); ctrl = q; cur = n; ult = 'Q'; continue;
                }
                case 'T':
                {
                    var q = ult == 'Q' ? new PointF(2 * cur.X - ctrl.X, 2 * cur.Y - ctrl.Y) : cur; var n = new PointF(o.X + N(), o.Y + N());
                    Quad(p, cur, q, n); ctrl = q; cur = n; ult = 'Q'; continue;
                }
                case 'A':
                {
                    float rx = N(), ry = N(), rot = N(); var grande = N() != 0; var horario = N() != 0; var n = new PointF(o.X + N(), o.Y + N());
                    Arco(p, cur, n, rx, ry, rot, grande, horario); cur = n; break;
                }
                case 'Z':
                    p.CloseFigure(); cur = ini; ult = 'Z';
                    if (TemNumero()) cmd = 'L';
                    continue;
                default: i++; break;
            }
            ult = char.ToUpperInvariant(cmd);
        }
        return p;
    }

    static void Quad(GraphicsPath p, PointF a, PointF q, PointF b) =>
        p.AddBezier(a, new PointF(a.X + 2f / 3 * (q.X - a.X), a.Y + 2f / 3 * (q.Y - a.Y)), new PointF(b.X + 2f / 3 * (q.X - b.X), b.Y + 2f / 3 * (q.Y - b.Y)), b);

    /// <summary>Arco elíptico SVG (pontas + raios + flags) convertido em curvas de Bézier.</summary>
    static void Arco(GraphicsPath p, PointF a, PointF b, float rx, float ry, float rotGraus, bool grande, bool horario)
    {
        if (rx == 0 || ry == 0 || (a.X == b.X && a.Y == b.Y)) { p.AddLine(a, b); return; }
        double phi = rotGraus * Math.PI / 180, cos = Math.Cos(phi), sin = Math.Sin(phi);
        double dx = (a.X - b.X) / 2.0, dy = (a.Y - b.Y) / 2.0;
        double x1 = cos * dx + sin * dy, y1 = -sin * dx + cos * dy;
        double Rx = Math.Abs(rx), Ry = Math.Abs(ry);
        var lam = x1 * x1 / (Rx * Rx) + y1 * y1 / (Ry * Ry);
        if (lam > 1) { Rx *= Math.Sqrt(lam); Ry *= Math.Sqrt(lam); }
        var num = Rx * Rx * Ry * Ry - Rx * Rx * y1 * y1 - Ry * Ry * x1 * x1;
        var den = Rx * Rx * y1 * y1 + Ry * Ry * x1 * x1;
        var co = Math.Sqrt(Math.Max(0, num / den)) * (grande == horario ? -1 : 1);
        double cx1 = co * Rx * y1 / Ry, cy1 = -co * Ry * x1 / Rx;
        double cx = cos * cx1 - sin * cy1 + (a.X + b.X) / 2.0, cy = sin * cx1 + cos * cy1 + (a.Y + b.Y) / 2.0;
        static double Ang(double ux, double uy, double vx, double vy) => Math.Atan2(ux * vy - uy * vx, ux * vx + uy * vy);
        var t1 = Ang(1, 0, (x1 - cx1) / Rx, (y1 - cy1) / Ry);
        var dt = Ang((x1 - cx1) / Rx, (y1 - cy1) / Ry, (-x1 - cx1) / Rx, (-y1 - cy1) / Ry);
        if (!horario && dt > 0) dt -= 2 * Math.PI; else if (horario && dt < 0) dt += 2 * Math.PI;
        var partes = (int)Math.Ceiling(Math.Abs(dt) / (Math.PI / 2));
        var passo = dt / partes;
        var kk = 4.0 / 3 * Math.Tan(passo / 4);
        var ini = a;
        for (var s = 0; s < partes; s++)
        {
            var ta = t1 + s * passo; var tb = ta + passo;
            var p1 = Rot(Rx * Math.Cos(ta) - kk * Rx * Math.Sin(ta), Ry * Math.Sin(ta) + kk * Ry * Math.Cos(ta), cos, sin, cx, cy);
            var p2 = Rot(Rx * Math.Cos(tb) + kk * Rx * Math.Sin(tb), Ry * Math.Sin(tb) - kk * Ry * Math.Cos(tb), cos, sin, cx, cy);
            var fim = s == partes - 1 ? b : Rot(Rx * Math.Cos(tb), Ry * Math.Sin(tb), cos, sin, cx, cy);
            p.AddBezier(ini, p1, p2, fim);
            ini = fim;
        }
    }

    static PointF Rot(double x, double y, double cos, double sin, double cx, double cy) =>
        new((float)(cos * x - sin * y + cx), (float)(sin * x + cos * y + cy));
}

public static partial class Forma
{
    /// <summary>Botão de opção verde do design (accent-color #0B7A53): círculo de 16 px.</summary>
    public static void RadioVerde(RadioButton rb)
    {
        if (rb.Tag as string == "radio-verde") return;
        rb.Tag ??= "radio-verde";
        rb.Paint += (_, e) =>
        {
            var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
            var lado = (int)Math.Round(16 * rb.DeviceDpi / 96.0);
            var r = new Rectangle(0, (rb.Height - lado) / 2, lado, lado);
            using (var fundo = new SolidBrush(rb.BackColor.A == 255 ? rb.BackColor : rb.Parent?.BackColor ?? Color.White)) g.FillRectangle(fundo, new Rectangle(0, 0, lado + 2, rb.Height));
            if (rb.Checked)
            {
                using var b = new SolidBrush(rb.Enabled ? Verde : Color.FromArgb(160, 196, 180)); g.FillEllipse(b, r);
                var m = lado * 0.32f;
                g.FillEllipse(Brushes.White, r.X + m, r.Y + m, lado - 2 * m, lado - 2 * m);
            }
            else
            {
                g.FillEllipse(Brushes.White, r);
                using var pen = new Pen(Color.FromArgb(199, 199, 204), 1.4F); g.DrawEllipse(pen, r);
            }
        };
    }
}
