using System.Drawing.Drawing2D;
using System.Drawing.Text;

namespace Kartodromo.Autoatendimento;

/// <summary>Visual do LapTime Autoatendimento: couro preto, cartao com borda vermelha, fonte condensada.</summary>
public static class Estilo
{
    public static readonly Color Fundo = Color.FromArgb(11, 11, 11);
    public static readonly Color Cartao = Color.FromArgb(23, 25, 28);
    public static readonly Color Vermelho = Color.FromArgb(226, 57, 63);
    public static readonly Color Campo = Color.FromArgb(43, 46, 51);
    public static readonly Color BordaCampo = Color.FromArgb(75, 79, 85);
    public static readonly Color Texto = Color.FromArgb(228, 228, 228);
    public static readonly Color Suave = Color.FromArgb(201, 201, 201);
    public static readonly Color Amarelo = Color.FromArgb(240, 230, 140);

    static readonly string Familia = new[] { "Bahnschrift SemiLight SemiConde", "Bahnschrift SemiLight SemiCondensed", "Bahnschrift SemiCondensed", "Segoe UI" }
        .First(f => { using var t = new Font(f, 10); return t.Name.Equals(f, StringComparison.OrdinalIgnoreCase); });
    static readonly string FamiliaLeve = new[] { "Bahnschrift Light Condensed", "Bahnschrift Light SemiCondensed", "Bahnschrift SemiCondensed", "Segoe UI Light" }
        .First(f => { using var t = new Font(f, 10); return t.Name.Equals(f, StringComparison.OrdinalIgnoreCase); });

    public static Font F(float tam, bool leve = false, FontStyle st = FontStyle.Regular) => new(leve ? FamiliaLeve : Familia, tam, st, GraphicsUnit.Pixel);

    public static GraphicsPath Arredondado(Rectangle r, int raio)
    {
        var p = new GraphicsPath();
        var d = raio * 2;
        p.AddArc(r.X, r.Y, d, d, 180, 90); p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
        p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90); p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
        p.CloseFigure();
        return p;
    }

    /// <summary>Textura de couro escuro gerada (ruido fino sobre preto), sem arquivo externo.</summary>
    public static Bitmap Couro(int w = 256, int h = 256)
    {
        var bmp = new Bitmap(w, h);
        var rnd = new Random(7);
        for (var y = 0; y < h; y++)
            for (var x = 0; x < w; x++)
            {
                var n = 14 + rnd.Next(0, 14) + (int)(6 * Math.Sin(x * 0.21 + y * 0.13) * Math.Cos(y * 0.17));
                n = Math.Clamp(n, 6, 34);
                bmp.SetPixel(x, y, Color.FromArgb(n, n, n + 1));
            }
        return bmp;
    }
}

/// <summary>Cartao com borda vermelha arredondada (onde ficam os campos de cada tela).</summary>
public class Cartao : Panel
{
    public Cartao()
    {
        DoubleBuffered = true;
        BackColor = Estilo.Cartao;
        Padding = new Padding(42, 32, 42, 30);
        SetStyle(ControlStyles.SupportsTransparentBackColor | ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint | ControlStyles.ResizeRedraw, true);
    }
    protected override void OnPaintBackground(PaintEventArgs e)
    {
        e.Graphics.Clear(Parent?.BackColor ?? Estilo.Fundo);
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        var r = new Rectangle(2, 2, Width - 5, Height - 5);
        using var p = Estilo.Arredondado(r, 22);
        using var fundo = new SolidBrush(Estilo.Cartao);
        e.Graphics.FillPath(fundo, p);
        using var borda = new Pen(Estilo.Vermelho, 3);
        e.Graphics.DrawPath(borda, p);
    }
    protected override void OnResize(EventArgs e)
    {
        base.OnResize(e);
        using var p = Estilo.Arredondado(new Rectangle(0, 0, Width, Height), 24);
        Region = new Region(p);
    }
}

/// <summary>Botao em pilula (vermelho cheio ou contorno vermelho).</summary>
public class Pilula : Control
{
    public bool Principal { get; set; }
    bool _sobre;
    public Pilula(string texto, bool principal = false)
    {
        Text = texto; Principal = principal;
        Size = new Size(154, 48);
        Font = Estilo.F(20);
        Cursor = Cursors.Hand;
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.SupportsTransparentBackColor, true);
        BackColor = Color.Transparent;
        MouseEnter += (_, _) => { _sobre = true; Invalidate(); };
        MouseLeave += (_, _) => { _sobre = false; Invalidate(); };
    }
    public void Clicar() => OnClick(EventArgs.Empty);
    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
        var r = new Rectangle(1, 1, Width - 3, Height - 3);
        using var p = Estilo.Arredondado(r, (Height - 3) / 2);
        var cor = Enabled ? Estilo.Vermelho : Color.FromArgb(120, 40, 44);
        if (Principal) { using var b = new SolidBrush(_sobre ? ControlPaint.Light(cor, .1f) : cor); g.FillPath(b, p); }
        using (var pen = new Pen(cor, 2)) g.DrawPath(pen, p);
        TextRenderer.DrawText(g, Text, Font, r, Principal ? Color.White : Estilo.Texto, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
    }
}

/// <summary>Caixa de marcar quadrada que fica vermelha quando marcada.</summary>
public class Marcador : Control
{
    bool _marcado;
    public bool Marcado { get => _marcado; set { _marcado = value; Invalidate(); Mudou?.Invoke(); } }
    public event Action Mudou;
    public Marcador(string texto = "", bool marcado = false)
    {
        Text = texto; _marcado = marcado;
        Font = Estilo.F(18);
        ForeColor = Estilo.Texto;
        Cursor = Cursors.Hand;
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.SupportsTransparentBackColor, true);
        BackColor = Color.Transparent;
        Height = 34;
        Width = 30 + TextRenderer.MeasureText(texto, Font).Width + 8;
        Click += (_, _) => Marcado = !Marcado;
    }
    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        var box = new Rectangle(2, (Height - 22) / 2, 22, 22);
        using var p = Estilo.Arredondado(box, 5);
        if (_marcado)
        {
            using var b = new SolidBrush(Estilo.Vermelho); g.FillPath(b, p);
            using var pen = new Pen(Color.White, 2.4f) { StartCap = LineCap.Round, EndCap = LineCap.Round };
            g.DrawLines(pen, new Point[] { new Point(box.X + 5, box.Y + 11), new Point(box.X + 9, box.Y + 16), new Point(box.X + 17, box.Y + 6) });
        }
        else { using var pen = new Pen(Color.FromArgb(208, 208, 208), 2); g.DrawPath(pen, p); }
        if (Text.Length > 0) TextRenderer.DrawText(g, Text, Font, new Point(32, (Height - Font.Height) / 2), ForeColor);
    }
}

/// <summary>Campo de texto escuro com borda arredondada (TextBox sem borda dentro de um painel).</summary>
public class CampoTexto : Panel
{
    public readonly TextBox Caixa = new() { BorderStyle = BorderStyle.None, BackColor = Estilo.Campo, ForeColor = Estilo.Texto };
    bool _foco;
    public CampoTexto()
    {
        DoubleBuffered = true;
        Height = 48;
        Caixa.Font = Estilo.F(20);
        Controls.Add(Caixa);
        Padding = new Padding(14, 0, 12, 0);
        Caixa.GotFocus += (_, _) => { _foco = true; Invalidate(); };
        Caixa.LostFocus += (_, _) => { _foco = false; Invalidate(); };
        Click += (_, _) => Caixa.Focus();
        Resize += (_, _) => Caixa.SetBounds(14, (Height - Caixa.Height) / 2, Width - 28, Caixa.Height);
    }
    public override string Text { get => Caixa.Text; set => Caixa.Text = value; }
    protected override void OnPaintBackground(PaintEventArgs e)
    {
        e.Graphics.Clear(Parent?.BackColor ?? Estilo.Cartao);
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        using var p = Estilo.Arredondado(new Rectangle(1, 1, Width - 3, Height - 3), 9);
        using var b = new SolidBrush(Enabled ? Estilo.Campo : Color.FromArgb(34, 36, 40)); e.Graphics.FillPath(b, p);
        using var pen = new Pen(_foco ? Color.FromArgb(150, 154, 160) : Estilo.BordaCampo, 2); e.Graphics.DrawPath(pen, p);
    }
    protected override void OnEnabledChanged(EventArgs e) { base.OnEnabledChanged(e); Caixa.BackColor = Enabled ? Estilo.Campo : Color.FromArgb(34, 36, 40); Invalidate(); }
}

/// <summary>Lista suspensa escura no mesmo formato dos campos (desenhada, abre um menu ao tocar).</summary>
public class CampoLista : Control
{
    readonly string[] _itens;
    int _sel;
    public event EventHandler SelectedIndexChanged;
    public CampoLista(params string[] itens)
    {
        _itens = itens;
        Height = 48;
        ForeColor = Estilo.Texto;
        Cursor = Cursors.Hand;
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        Click += (_, _) => Abrir();
    }
    public int SelectedIndex { get => _sel; set { if (value == _sel) return; _sel = value; Invalidate(); SelectedIndexChanged?.Invoke(this, EventArgs.Empty); } }
    public override string Text { get => _sel >= 0 && _sel < _itens.Length ? _itens[_sel] : ""; set { } }
    void Abrir()
    {
        var m = new ContextMenuStrip { Font = Font, ShowImageMargin = false, BackColor = Estilo.Campo, ForeColor = Estilo.Texto, Renderer = new ToolStripProfessionalRenderer(new CoresMenu()) };
        for (var n = 0; n < _itens.Length; n++)
        {
            var idx = n;
            var it = new ToolStripMenuItem(_itens[n]) { AutoSize = false, Size = new Size(Width - 4, Height - 6), ForeColor = Estilo.Texto, Checked = n == _sel };
            it.Click += (_, _) => SelectedIndex = idx;
            m.Items.Add(it);
        }
        m.Show(this, new Point(0, Height));
    }
    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.Clear(Parent?.BackColor ?? Estilo.Cartao);
        g.SmoothingMode = SmoothingMode.AntiAlias;
        using var p = Estilo.Arredondado(new Rectangle(1, 1, Width - 3, Height - 3), 9);
        using (var b = new SolidBrush(Enabled ? Estilo.Campo : Color.FromArgb(34, 36, 40))) g.FillPath(b, p);
        using (var pen = new Pen(Estilo.BordaCampo, 2)) g.DrawPath(pen, p);
        TextRenderer.DrawText(g, Text, Font, new Rectangle(12, 0, Width - 40, Height), Enabled ? ForeColor : Estilo.Suave, TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
        var cx = Width - 22; var cy = Height / 2;
        using var seta = new Pen(Estilo.Suave, 1.6f);
        g.DrawLines(seta, new PointF[] { new(cx - 5, cy - 2), new(cx, cy + 3), new(cx + 5, cy - 2) });
    }
    protected override void OnEnabledChanged(EventArgs e) { base.OnEnabledChanged(e); Invalidate(); }

    class CoresMenu : ProfessionalColorTable
    {
        public override Color ToolStripDropDownBackground => Estilo.Campo;
        public override Color MenuItemSelected => Color.FromArgb(70, 74, 80);
        public override Color MenuItemBorder => Color.FromArgb(70, 74, 80);
        public override Color MenuBorder => Estilo.BordaCampo;
        public override Color CheckBackground => Estilo.Campo;
        public override Color CheckSelectedBackground => Color.FromArgb(70, 74, 80);
    }
}
/// <summary>Caixa "Alerta" branca com OK (igual ao WinUI do LapTime AA).</summary>
public class Alerta : Form
{
    public Alerta(string msg)
    {
        FormBorderStyle = FormBorderStyle.None; StartPosition = FormStartPosition.CenterParent; ShowInTaskbar = false; TopMost = true;
        BackColor = Color.White; Size = new Size(360, 200); KeyPreview = true;
        var titulo = new Label { Text = "Alerta", Font = new Font("Segoe UI Semibold", 15F), Location = new Point(24, 22), AutoSize = true, ForeColor = Color.FromArgb(27, 27, 27) };
        var texto = new Label { Text = msg, Font = new Font("Segoe UI", 10.5F), Location = new Point(24, 62), Size = new Size(312, 56), ForeColor = Color.FromArgb(27, 27, 27) };
        var rod = new Panel { Dock = DockStyle.Bottom, Height = 72, BackColor = Color.FromArgb(243, 243, 243) };
        var ok = new Button { Text = "OK", Size = new Size(130, 34), Location = new Point(206, 20), FlatStyle = FlatStyle.System, Font = new Font("Segoe UI", 10F) };
        ok.Click += (_, _) => Close();
        rod.Controls.Add(ok);
        Controls.AddRange([titulo, texto, rod]);
        AcceptButton = ok;
        Paint += (_, e) => { using var pen = new Pen(Color.FromArgb(200, 200, 200)); e.Graphics.DrawRectangle(pen, 0, 0, Width - 1, Height - 1); };
        KeyDown += (_, e) => { if (e.KeyCode == Keys.Escape) Close(); };
    }
    public static void Mostrar(IWin32Window dono, string msg) { using var a = new Alerta(msg); a.ShowDialog(dono); }
}
