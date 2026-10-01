using System.Drawing.Drawing2D;
using System.Drawing.Text;
using Kartodromo.Comum;

namespace Kartodromo.Autoatendimento;

/// <summary>Paleta operacional do totem: Pit Lane Noturno.</summary>
public static class Estilo
{
    public static readonly Color Fundo = Color.FromArgb(3, 5, 4);
    public static readonly Color Cartao = Color.FromArgb(18, 255, 255, 255);
    public static readonly Color Verde = Color.FromArgb(0, 230, 118);
    public static readonly Color VerdeEscuro = Color.FromArgb(0, 122, 61);
    public static readonly Color VerdeSuave = Color.FromArgb(191, 239, 210);
    public static readonly Color Texto = Color.FromArgb(247, 250, 246);
    public static readonly Color Suave = Color.FromArgb(183, 194, 186);
    public static readonly Color MuitoSuave = Color.FromArgb(130, 147, 136);
    public static readonly Color Campo = Color.FromArgb(11, 16, 12);
    public static readonly Color BordaCampo = Color.FromArgb(65, 80, 68);
    public static readonly Color Amarelo = Color.FromArgb(250, 204, 21);
    public static readonly Color InformativoFundo = Color.FromArgb(24, 64, 48);
    public static readonly Color InformativoTexto = Color.FromArgb(151, 247, 194);
    public static readonly Color SuperFundo = Color.FromArgb(76, 57, 12);
    public static readonly Color SuperTexto = Color.FromArgb(255, 210, 74);
    public static readonly Color Foco = Color.FromArgb(0, 230, 118);

    static readonly string Familia = new[] { "Rajdhani", "Bahnschrift SemiCondensed", "Segoe UI Variable Text", "Segoe UI" }
        .First(f => { using var t = new Font(f, 10); return t.Name.Equals(f, StringComparison.OrdinalIgnoreCase); });
    static readonly string FamiliaMono = new[] { "Cascadia Mono", "Consolas" }
        .First(f => { using var t = new Font(f, 10); return t.Name.Equals(f, StringComparison.OrdinalIgnoreCase); });

    public static Font F(float tam, bool leve = false, FontStyle st = FontStyle.Regular) => new(Familia, tam, st, GraphicsUnit.Pixel);
    public static Font Mono(float tam, FontStyle st = FontStyle.Regular) => new(FamiliaMono, tam, st, GraphicsUnit.Pixel);

    public static Image Logo()
    {
        using var original = Icone.Logo();
        return original == null ? null : new Bitmap(original);
    }

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

/// <summary>Superfície transparente dimensionada no quadro lógico do totem.</summary>
public class TelaCanvas : Panel
{
    public int Etapa { get; set; }
    public TelaCanvas()
    {
        SetStyle(ControlStyles.SupportsTransparentBackColor | ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint | ControlStyles.ResizeRedraw, true);
        BackColor = Color.Transparent;
    }
}

/// <summary>Cabeçalho do totem desenhado em uma camada superior estável.</summary>
public class CabecalhoTotem : Control
{
    readonly Image _logo;
    readonly bool _donoDaLogo;
    float _escala;
    int _etapa;
    public CabecalhoTotem(Image logo, int etapa, float escala = 1f, bool donoDaLogo = false)
    {
        _logo = logo;
        _etapa = etapa;
        _escala = escala;
        _donoDaLogo = donoDaLogo;
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.Opaque, true);
        BackColor = Estilo.Fundo;
        TabStop = false;
        AccessibleRole = AccessibleRole.StatusBar;
        AccessibleName = "Progresso do autoatendimento";
    }
    public void Atualizar(int etapa, float escala)
    {
        _etapa = etapa;
        _escala = escala;
        Invalidate();
    }
    protected override void OnPaintBackground(PaintEventArgs e)
    {
        e.Graphics.Clear(Estilo.Fundo);
        if (ClientSize.Width <= 0 || ClientSize.Height <= 0) return;
        using var glow = new LinearGradientBrush(ClientRectangle, Color.FromArgb(30, Estilo.Verde.R, Estilo.Verde.G, Estilo.Verde.B), Color.Transparent, 90f);
        e.Graphics.FillRectangle(glow, ClientRectangle);
    }
    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
        if (_logo != null)
        {
            var altura = Math.Max(1, (int)Math.Round(40 * _escala));
            var largura = Math.Max(1, (int)Math.Round(altura * _logo.Width / (float)_logo.Height));
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.DrawImage(_logo, new Rectangle((int)Math.Round(56 * _escala), (int)Math.Round(36 * _escala), largura, altura));
        }
        if (_etapa <= 0) return;
        string[] nomes = ["1 Identificação", "2 Cadastro", "3 Baterias"];
        var x = (int)Math.Round(760 * _escala);
        var y = (int)Math.Round(36 * _escala);
        var w = (int)Math.Round(164 * _escala);
        var h = (int)Math.Round(34 * _escala);
        for (var i = 0; i < nomes.Length; i++)
        {
            var concluida = i + 1 < _etapa;
            var atual = i + 1 == _etapa;
            var r = new Rectangle(x, y, w, h);
            using var path = Estilo.Arredondado(new Rectangle(r.X, r.Y, r.Width - 1, r.Height - 1), h / 2);
            var fundo = atual ? Estilo.Texto : concluida ? Color.FromArgb(48, Estilo.Verde.R, Estilo.Verde.G, Estilo.Verde.B) : Color.FromArgb(20, 255, 255, 255);
            using (var brush = new SolidBrush(fundo)) g.FillPath(brush, path);
            var cor = atual ? Estilo.Fundo : concluida ? Estilo.VerdeSuave : Estilo.Suave;
            using var font = Estilo.F(14 * _escala, false, atual ? FontStyle.Bold : FontStyle.Regular);
            TextRenderer.DrawText(g, nomes[i] + (concluida ? "  ✓" : ""), font, r, cor,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPrefix);
            x += (int)Math.Round(174 * _escala);
        }
        using var divisor = new Pen(Color.FromArgb(24, 255, 255, 255), Math.Max(1, _escala));
        g.DrawLine(divisor, 56 * _escala, Height - Math.Max(1, _escala), Width - 56 * _escala, Height - Math.Max(1, _escala));
    }
    protected override void Dispose(bool disposing)
    {
        if (disposing && _donoDaLogo) _logo?.Dispose();
        base.Dispose(disposing);
    }
}

/// <summary>Cartao translúcido arredondado para formulários e diálogos.</summary>
public class Cartao : Panel
{
    public Cartao()
    {
        DoubleBuffered = true;
        BackColor = Estilo.Cartao;
        Padding = new Padding(24);
        SetStyle(ControlStyles.SupportsTransparentBackColor | ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint | ControlStyles.ResizeRedraw, true);
    }
    protected override void OnPaintBackground(PaintEventArgs e)
    {
        base.OnPaintBackground(e);
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        var r = new Rectangle(2, 2, Width - 5, Height - 5);
        using var p = Estilo.Arredondado(r, 28);
        using var fundo = new SolidBrush(Estilo.Cartao);
        e.Graphics.FillPath(fundo, p);
        using var borda = new Pen(Color.FromArgb(26, 255, 255, 255), 1);
        e.Graphics.DrawPath(borda, p);
    }
    protected override void OnResize(EventArgs e)
    {
        base.OnResize(e);
        using var p = Estilo.Arredondado(new Rectangle(0, 0, Width, Height), 24);
        Region = new Region(p);
    }
}

/// <summary>Botão em pílula branco ou translúcido.</summary>
public class Pilula : Control
{
    public bool Principal { get; set; }
    bool _sobre;
    bool _foco;
    public Pilula(string texto, bool principal = false)
    {
        Text = texto; Principal = principal;
        Size = new Size(154, 48);
        Font = Estilo.F(19, false, principal ? FontStyle.Bold : FontStyle.Regular);
        Cursor = Cursors.Hand;
        TabStop = true;
        AccessibleRole = AccessibleRole.PushButton;
        AccessibleName = texto;
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.SupportsTransparentBackColor | ControlStyles.Selectable, true);
        BackColor = Color.Transparent;
        MouseEnter += (_, _) => { _sobre = true; Invalidate(); };
        MouseLeave += (_, _) => { _sobre = false; Invalidate(); };
        GotFocus += (_, _) => { _foco = true; Invalidate(); };
        LostFocus += (_, _) => { _foco = false; Invalidate(); };
    }
    public void Clicar() => OnClick(EventArgs.Empty);
    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
        var r = new Rectangle(1, 1, Width - 3, Height - 3);
        using var p = Estilo.Arredondado(r, (Height - 3) / 2);
        if (Principal)
        {
            using var b = new SolidBrush(Enabled ? (_sobre ? Color.FromArgb(232, 236, 232) : Estilo.Texto) : Color.FromArgb(130, 147, 136));
            g.FillPath(b, p);
        }
        else
        {
            using var b = new SolidBrush(_sobre ? Color.FromArgb(42, 255, 255, 255) : Color.FromArgb(26, 255, 255, 255));
            g.FillPath(b, p);
            using var pen = new Pen(Color.FromArgb(38, 255, 255, 255), 1);
            g.DrawPath(pen, p);
        }
        TextRenderer.DrawText(g, Text, Font, r, Principal ? Estilo.Fundo : Estilo.Texto, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPrefix);
        if (_foco && Enabled)
        {
            using var foco = new Pen(Estilo.Foco, 2);
            using var anel = Estilo.Arredondado(new Rectangle(0, 0, Width - 1, Height - 1), Math.Max(1, (Height - 1) / 2));
            g.DrawPath(foco, anel);
        }
    }
    protected override void OnKeyDown(KeyEventArgs e)
    {
        base.OnKeyDown(e);
        if (e.KeyCode is Keys.Enter or Keys.Space)
        {
            e.Handled = true;
            e.SuppressKeyPress = true;
            Clicar();
        }
    }
    protected override void OnEnabledChanged(EventArgs e) { base.OnEnabledChanged(e); Invalidate(); }
}

/// <summary>Ícone de confirmação verde com halo.</summary>
public class IconeSucesso : Control
{
    public IconeSucesso()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.SupportsTransparentBackColor, true);
        BackColor = Color.Transparent;
    }
    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        var halo = new Rectangle(1, 1, Width - 3, Height - 3);
        using (var b = new SolidBrush(Color.FromArgb(35, Estilo.Verde.R, Estilo.Verde.G, Estilo.Verde.B))) g.FillEllipse(b, halo);
        var circ = new Rectangle(14, 14, Width - 29, Height - 29);
        using (var grad = new LinearGradientBrush(circ, Color.FromArgb(76, 224, 122), Color.FromArgb(31, 166, 74), LinearGradientMode.Vertical)) g.FillEllipse(grad, circ);
        using var check = new Pen(Estilo.Texto, Math.Max(3, Width * .027f)) { StartCap = LineCap.Round, EndCap = LineCap.Round };
        g.DrawLines(check, [new PointF(Width * .31f, Height * .51f), new PointF(Width * .45f, Height * .65f), new PointF(Width * .72f, Height * .37f)]);
    }
}

/// <summary>Marcador verde do tema.</summary>
public class Marcador : Control
{
    bool _marcado;
    bool _foco;
    public bool Marcado { get => _marcado; set { _marcado = value; Invalidate(); Mudou?.Invoke(); } }
    public event Action Mudou;
    public Marcador(string texto = "", bool marcado = false)
    {
        Text = texto; _marcado = marcado;
        Font = Estilo.F(18);
        ForeColor = Estilo.Texto;
        Cursor = Cursors.Hand;
        TabStop = true;
        AccessibleRole = AccessibleRole.CheckButton;
        AccessibleName = texto;
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.SupportsTransparentBackColor | ControlStyles.Selectable, true);
        BackColor = Color.Transparent;
        Height = 34;
        Width = 30 + TextRenderer.MeasureText(texto, Font).Width + 8;
        Click += (_, _) => Marcado = !Marcado;
        GotFocus += (_, _) => { _foco = true; Invalidate(); };
        LostFocus += (_, _) => { _foco = false; Invalidate(); };
    }
    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        var box = new Rectangle(2, (Height - 22) / 2, 22, 22);
        using var p = Estilo.Arredondado(box, 5);
        if (_marcado)
        {
            using var b = new SolidBrush(Estilo.Verde); g.FillPath(b, p);
            using var pen = new Pen(Estilo.Texto, 2.4f) { StartCap = LineCap.Round, EndCap = LineCap.Round };
            g.DrawLines(pen, new Point[] { new Point(box.X + 5, box.Y + 11), new Point(box.X + 9, box.Y + 16), new Point(box.X + 17, box.Y + 6) });
        }
        else { using var pen = new Pen(Color.FromArgb(208, 208, 208), 2); g.DrawPath(pen, p); }
        if (Text.Length > 0) TextRenderer.DrawText(g, Text, Font, new Point(32, (Height - Font.Height) / 2), ForeColor);
        if (_foco)
        {
            using var foco = new Pen(Estilo.Foco, 2);
            g.DrawRectangle(foco, new Rectangle(0, 0, Width - 1, Height - 1));
        }
    }
    protected override void OnKeyDown(KeyEventArgs e)
    {
        base.OnKeyDown(e);
        if (e.KeyCode is Keys.Enter or Keys.Space)
        {
            e.Handled = true;
            e.SuppressKeyPress = true;
            Marcado = !Marcado;
        }
    }
}

/// <summary>Campo de texto escuro arredondado (TextBox sem borda dentro de um painel).</summary>
public class CampoTexto : Panel
{
    public readonly TextBox Caixa = new() { BorderStyle = BorderStyle.None, BackColor = Estilo.Campo, ForeColor = Estilo.Texto };
    bool _foco;
    public CampoTexto()
    {
        DoubleBuffered = true;
        SetStyle(ControlStyles.SupportsTransparentBackColor | ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint | ControlStyles.ResizeRedraw, true);
        BackColor = Color.Transparent;
        Height = 58;
        Caixa.Font = Estilo.F(19);
        Controls.Add(Caixa);
        Padding = new Padding(16, 0, 14, 0);
        Caixa.GotFocus += (_, _) => { _foco = true; Invalidate(); };
        Caixa.LostFocus += (_, _) => { _foco = false; Invalidate(); };
        Click += (_, _) => Caixa.Focus();
        Resize += (_, _) => Caixa.SetBounds(Padding.Left, (Height - Caixa.Height) / 2, Width - Padding.Horizontal, Caixa.Height);
    }
    public override string Text { get => Caixa.Text; set => Caixa.Text = value; }
    protected override void OnPaintBackground(PaintEventArgs e)
    {
        base.OnPaintBackground(e);
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        using var p = Estilo.Arredondado(new Rectangle(1, 1, Width - 3, Height - 3), 16);
        using var b = new SolidBrush(Enabled ? Estilo.Campo : Color.FromArgb(34, 36, 40)); e.Graphics.FillPath(b, p);
        using var pen = new Pen(_foco ? Estilo.Foco : Color.FromArgb(26, 255, 255, 255), _foco ? 2 : 1); e.Graphics.DrawPath(pen, p);
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
        TabStop = true;
        AccessibleRole = AccessibleRole.ComboBox;
        AccessibleName = "Lista de opções";
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.SupportsTransparentBackColor | ControlStyles.Selectable, true);
        BackColor = Color.Transparent;
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
        base.OnPaintBackground(e);
        g.SmoothingMode = SmoothingMode.AntiAlias;
        using var p = Estilo.Arredondado(new Rectangle(1, 1, Width - 3, Height - 3), 16);
        using (var b = new SolidBrush(Enabled ? Estilo.Campo : Color.FromArgb(34, 36, 40))) g.FillPath(b, p);
        using (var pen = new Pen(Focused ? Estilo.Foco : Color.FromArgb(26, 255, 255, 255), Focused ? 2 : 1)) g.DrawPath(pen, p);
        TextRenderer.DrawText(g, Text, Font, new Rectangle(12, 0, Width - 40, Height), Enabled ? ForeColor : Estilo.Suave, TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
        var cx = Width - 22; var cy = Height / 2;
        using var seta = new Pen(Estilo.Suave, 1.6f);
        g.DrawLines(seta, new PointF[] { new(cx - 5, cy - 2), new(cx, cy + 3), new(cx + 5, cy - 2) });
    }
    protected override void OnEnabledChanged(EventArgs e) { base.OnEnabledChanged(e); Invalidate(); }
    protected override void OnKeyDown(KeyEventArgs e)
    {
        base.OnKeyDown(e);
        if (e.KeyCode is Keys.Down or Keys.Right) { SelectedIndex = Math.Min(_itens.Length - 1, _sel + 1); e.Handled = true; e.SuppressKeyPress = true; }
        else if (e.KeyCode is Keys.Up or Keys.Left) { SelectedIndex = Math.Max(0, _sel - 1); e.Handled = true; e.SuppressKeyPress = true; }
        else if (e.KeyCode is Keys.Enter or Keys.Space) { Abrir(); e.Handled = true; e.SuppressKeyPress = true; }
    }

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
/// <summary>Alerta escuro compatível com as telas do totem.</summary>
public class Alerta : Form
{
    public Alerta(string msg, int etapa = 1, Size? area = null)
    {
        FormBorderStyle = FormBorderStyle.None; StartPosition = FormStartPosition.CenterParent; ShowInTaskbar = false; TopMost = true;
        BackColor = Estilo.Fundo; ClientSize = area ?? new Size(1366, 768); KeyPreview = true;
        var escala = Math.Min(ClientSize.Width / 1366f, ClientSize.Height / 768f);
        int P(float valor) => (int)Math.Round(valor * escala);
        Font F(float pixels, FontStyle estilo = FontStyle.Regular) => Estilo.F(pixels * escala, false, estilo);
        var tela = new TelaCanvas { Size = ClientSize, Etapa = etapa };
        Controls.Add(tela);
        var cabecalho = new CabecalhoTotem(Estilo.Logo(), etapa, escala, donoDaLogo: true)
        {
            Bounds = new Rectangle(0, 0, ClientSize.Width, P(88))
        };
        tela.Controls.Add(cabecalho);
        var wCard = Math.Min(P(600), ClientSize.Width - P(80));
        var hCard = P(300);
        var cartao = new Cartao { Bounds = new Rectangle((ClientSize.Width - wCard) / 2, (ClientSize.Height - hCard) / 2, wCard, hCard), Padding = new Padding(P(36)), BackColor = Color.Transparent };
        var titulo = new Label { Text = "Atenção", Font = F(28, FontStyle.Bold), Location = new Point(P(36), P(34)), AutoSize = true, ForeColor = Estilo.Texto, BackColor = Color.Transparent };
        var texto = new Label { Text = msg, Font = F(18), Location = new Point(P(36), P(92)), Size = new Size(wCard - P(72), P(104)), ForeColor = Estilo.Suave, BackColor = Color.Transparent };
        var ok = new Pilula("OK", true) { Size = new Size(P(160), P(56)), Location = new Point(wCard - P(36) - P(160), hCard - P(36) - P(56)), Font = F(18, FontStyle.Bold) };
        ok.Click += (_, _) => Close();
        cartao.Controls.AddRange([titulo, texto, ok]);
        tela.Controls.Add(cartao);
        cabecalho.BringToFront();
        KeyDown += (_, e) => { if (e.KeyCode == Keys.Escape) Close(); else if (e.KeyCode == Keys.Enter) ok.Clicar(); };
    }
    public static void Mostrar(IWin32Window dono, string msg, int etapa = 1)
    {
        var area = dono is Form f ? f.ClientSize : new Size(1366, 768);
        using var a = new Alerta(msg, etapa, area);
        a.ShowDialog(dono);
    }
}

