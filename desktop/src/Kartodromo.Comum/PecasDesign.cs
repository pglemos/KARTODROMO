using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;

namespace Kartodromo.Comum;

/// <summary>Peças de formulário desenhadas como no design aprovado (Dialogo.dc.html).</summary>
public static class PecasDesign
{
    public static readonly Color CorTexto = Tokens.Texto;
    public static readonly Color Cinza = Tokens.TextoSecundario;
    public static readonly Font FonteValor = new("Segoe UI", 10.2F);
    public static readonly Font FonteRotulo = new("Segoe UI Semibold", 9F);

    /// <summary>Seta "⌄" do design (fina, cinza), desenhada.</summary>
    public static void DesenharSeta(Graphics g, Rectangle area, Color? cor = null)
    {
        var cx = area.X + area.Width / 2f; var cy = area.Y + area.Height / 2f;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        using var pen = new Pen(cor ?? Cinza, 1.8f) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round };
        g.DrawLines(pen, [new PointF(cx - 4.5f, cy - 2f), new PointF(cx, cy + 2.5f), new PointF(cx + 4.5f, cy - 2f)]);
    }

    /// <summary>Bloco de ícone do design (degradê + desenho branco), para janelas sem PNG próprio.</summary>
    public static Image Tile(Color cima, Color baixo, string caminho)
    {
        var bmp = new Bitmap(72, 72);
        using var g = Graphics.FromImage(bmp);
        g.SmoothingMode = SmoothingMode.AntiAlias;
        using (var path = Forma.Redondo(new Rectangle(1, 1, 69, 69), 18))
        using (var b = new LinearGradientBrush(new Rectangle(0, 0, 72, 72), cima, baixo, 90f)) g.FillPath(b, path);
        using var pen = new Pen(Color.White, 5f) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round };
        if (caminho == "seta") { g.DrawLine(pen, 22, 36, 50, 36); g.DrawLines(pen, [new PointF(39, 25), new PointF(50, 36), new PointF(39, 47)]); }
        else if (caminho == "pessoa") { g.DrawEllipse(pen, 28, 17, 16, 16); g.DrawArc(pen, 20, 39, 32, 30, 200, 140); }
        else if (caminho == "bandeira") { g.DrawLine(pen, 24, 54, 24, 18); g.DrawLines(pen, [new PointF(24, 19), new PointF(48, 19), new PointF(42, 28), new PointF(48, 37), new PointF(24, 37)]); }
        return bmp;
    }

    /// <summary>dd/MM de uma data ISO (vazio se não tiver data).</summary>
    public static string DiaMes(string iso) { var d = Kartodromo.Comum.Fmt.Dmy(iso); return d.Length >= 5 ? d[..5] : d; }

    public static TextBox Texto(string valor = "", int max = 200) => new() { Text = valor, MaxLength = max, BorderStyle = BorderStyle.None, Font = FonteValor, ForeColor = CorTexto, BackColor = Color.White };

    /// <summary>Caixa de texto só com números.</summary>
    public static TextBox Numero(int valor, int max = 5)
    {
        var t = Texto(valor.ToString(), max);
        t.KeyPress += (_, e) => { if (!char.IsControl(e.KeyChar) && !char.IsDigit(e.KeyChar)) e.Handled = true; };
        return t;
    }

    /// <summary>Hora HH:mm (digita 1920 e vira 19:20).</summary>
    public static TextBox Hora(DateTime valor)
    {
        var t = Texto(valor.ToString("HH:mm"), 5);
        t.KeyPress += (_, e) => { if (!char.IsControl(e.KeyChar) && !char.IsDigit(e.KeyChar) && e.KeyChar != ':') e.Handled = true; };
        t.Leave += (_, _) => { var d = new string(t.Text.Where(char.IsDigit).ToArray()); if (d.Length is 3 or 4) t.Text = $"{d[..^2].PadLeft(2, '0')}:{d[^2..]}"; };
        return t;
    }

    public static bool LerHora(TextBox t, out TimeSpan hora) => TimeSpan.TryParseExact(t.Text.Trim(), [@"hh\:mm", @"h\:mm"], null, out hora) && hora < TimeSpan.FromDays(1);
}

/// <summary>Lista (ComboBox) com a cara do design: fundo branco, texto e a seta fina à direita, sem o botão do Windows.</summary>
public class ListaDesign : ComboBox
{
    /// <summary>Valor encostado à direita, antes da seta (linhas "Turno … Noite ⌄" do design).</summary>
    public bool Direita { get; set; }
    /// <summary>Cor do valor escolhido (ex.: terminal em verde).</summary>
    public Color? CorValor { get; set; }
    /// <summary>Texto quando nada foi escolhido.</summary>
    public string Vazio { get; set; } = "";

    public ListaDesign()
    {
        DropDownStyle = ComboBoxStyle.DropDownList;
        DrawMode = DrawMode.OwnerDrawFixed;
        FlatStyle = FlatStyle.Flat;
        Font = PecasDesign.FonteValor;
        ItemHeight = 22;
        BackColor = Color.White;
        ForeColor = PecasDesign.CorTexto;
        Cursor = Cursors.Hand;
    }

    protected override void OnDrawItem(DrawItemEventArgs e)
    {
        if (e.Index < 0) return;
        var sel = (e.State & DrawItemState.Selected) != 0 && (e.State & DrawItemState.ComboBoxEdit) == 0;
        using (var b = new SolidBrush(sel ? Tokens.VerdeSuave : Color.White)) e.Graphics.FillRectangle(b, e.Bounds);
        TextRenderer.DrawText(e.Graphics, GetItemText(Items[e.Index]), Font, new Rectangle(e.Bounds.X + 4, e.Bounds.Y, e.Bounds.Width - 8, e.Bounds.Height), Enabled ? PecasDesign.CorTexto : PecasDesign.Cinza, TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
    }

    protected override void WndProc(ref Message m)
    {
        base.WndProc(ref m);
        if (m.Msg != 0x000F) return; // WM_PAINT: por cima do desenho do Windows, a caixa limpa do design
        using var g = Graphics.FromHwnd(Handle);
        var r = ClientRectangle;
        g.FillRectangle(Brushes.White, r);
        var texto = SelectedIndex >= 0 ? GetItemText(SelectedItem) : (string.IsNullOrEmpty(Text) ? Vazio : Text);
        var cor = !Enabled ? PecasDesign.Cinza : SelectedIndex < 0 ? PecasDesign.Cinza : CorValor ?? PecasDesign.CorTexto;
        TextRenderer.DrawText(g, texto, Font, new Rectangle(0, 0, r.Width - 22, r.Height), cor, TextFormatFlags.VerticalCenter | (Direita ? TextFormatFlags.Right : TextFormatFlags.Left) | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix | TextFormatFlags.NoPadding);
        PecasDesign.DesenharSeta(g, new Rectangle(r.Width - 20, 0, 18, r.Height));
    }
}

/// <summary>Data dd/MM/aaaa com a seta do design: clique abre o calendário.</summary>
public class DataDesign : Panel
{
    readonly TextBox _txt;
    public DateTime Value
    {
        get => DateTime.TryParseExact(_txt.Text.Trim(), "dd/MM/yyyy", Kartodromo.Comum.Fmt.Br, System.Globalization.DateTimeStyles.None, out var d) ? d : DateTime.MinValue;
        set => _txt.Text = value.ToString("dd/MM/yyyy");
    }
    public bool Valida => Value != DateTime.MinValue;

    public DataDesign(DateTime valor)
    {
        Height = PecasDesign.FonteValor.Height + 2; BackColor = Color.White;
        _txt = PecasDesign.Texto(valor.ToString("dd/MM/yyyy"), 10);
        _txt.Dock = DockStyle.Fill;
        _txt.KeyPress += (_, e) => { if (!char.IsControl(e.KeyChar) && !char.IsDigit(e.KeyChar) && e.KeyChar != '/') e.Handled = true; };
        _txt.Leave += (_, _) => { var d = new string(_txt.Text.Where(char.IsDigit).ToArray()); if (d.Length == 8) _txt.Text = $"{d[..2]}/{d[2..4]}/{d[4..]}"; };
        var seta = new Panel { Dock = DockStyle.Right, Width = 20, BackColor = Color.White, Cursor = Cursors.Hand };
        seta.Paint += (_, e) => PecasDesign.DesenharSeta(e.Graphics, seta.ClientRectangle);
        seta.Click += (_, _) => AbrirCalendario();
        Controls.Add(_txt); Controls.Add(seta);
    }

    void AbrirCalendario()
    {
        var cal = new MonthCalendar { MaxSelectionCount = 1 };
        if (Valida) cal.SetDate(Value);
        var host = new ToolStripControlHost(cal) { Margin = Padding.Empty, Padding = Padding.Empty };
        var pop = new ToolStripDropDown { Padding = Padding.Empty };
        pop.Items.Add(host);
        cal.DateSelected += (_, e) => { Value = e.Start; pop.Close(); };
        pop.Closed += (_, _) => BeginInvoke(() => pop.Dispose());
        pop.Show(this, new Point(0, Height + 4));
    }
}

/// <summary>Tabela simples do design: cabeçalho cinza claro, linhas de 32 px com separador fino, sem grade do Windows.</summary>
public class TabelaDesign : Control
{
    public record Coluna(string Titulo, float Peso, bool Direita = false, bool Marca = false, bool Centro = false, bool Editavel = false);
    /// <summary>Coluna Editavel: "Sim"/"Não" alterna no clique; outro valor abre a caixa de edição na célula (Enter grava, Esc desiste).</summary>
    public event Action<int, int, string> CelulaMudou;
    TextBox _editor;
    /// <summary>Colunas de marca (Marca = true) podem ser clicadas: a célula alterna entre "1" e "0".</summary>
    public bool MarcasEditaveis { get; set; }
    public event Action<int, int> MarcaMudou;
    public IReadOnlyList<string[]> Dados => _linhas;
    Coluna[] _cols = [];
    List<string[]> _linhas = [];
    /// <summary>Com seleção: a 1ª coluna vira a caixa de marcar (uma linha só) e o clique escolhe.</summary>
    public bool Selecionavel { get; set; }
    /// <summary>Máximo de linhas à vista (0 = todas); o resto rola com a roda do mouse dentro da tabela.</summary>
    public int MaxLinhas { get; set; }
    int _topo;
    int Visiveis => MaxLinhas > 0 ? Math.Min(MaxLinhas, _linhas.Count) : _linhas.Count;

    protected override void OnMouseWheel(MouseEventArgs e)
    {
        base.OnMouseWheel(e);
        var max = Math.Max(0, _linhas.Count - Visiveis);
        _topo = Math.Clamp(_topo - Math.Sign(e.Delta) * 2, 0, max);
        Invalidate();
    }
    protected override void OnMouseEnter(EventArgs e) { base.OnMouseEnter(e); if (_editor == null && MaxLinhas > 0) Focus(); }
    public int Selecionada { get; private set; } = -1;
    public event Action SelecaoMudou;
    public void Selecionar(int i) { Selecionada = i; Invalidate(); SelecaoMudou?.Invoke(); }

    protected override void OnMouseClick(MouseEventArgs e)
    {
        base.OnMouseClick(e);
        if (e.Y < 32) return;
        var i = (e.Y - 32) / 33 + _topo;
        if (i >= 0 && i < _linhas.Count && _cols.Any(c => c.Editavel))
        {
            var soma0 = _cols.Sum(c => c.Peso); var x0 = 12f; var util0 = Width - 24f;
            for (var c = 0; c < _cols.Length; c++)
            {
                var larg = util0 * _cols[c].Peso / soma0;
                if (_cols[c].Editavel && e.X >= x0 - 6 && e.X < x0 + larg && c < _linhas[i].Length) { Editar(i, c, new Rectangle((int)x0, 32 + (i - _topo) * 33 + 4, (int)larg - 8, 25)); return; }
                x0 += larg;
            }
        }
        if (MarcasEditaveis && i >= 0 && i < _linhas.Count)
        {
            var soma = _cols.Sum(c => c.Peso); var x = 12f; var util = Width - 24f;
            for (var c = 0; c < _cols.Length; c++)
            {
                var larg = util * _cols[c].Peso / soma;
                if (_cols[c].Marca && e.X >= x && e.X < x + larg && c < _linhas[i].Length) { _linhas[i][c] = _linhas[i][c] == "1" ? "0" : "1"; Invalidate(); MarcaMudou?.Invoke(i, c); return; }
                x += larg;
            }
        }
        if (!Selecionavel) return;
        if (i >= 0 && i < _linhas.Count) Selecionar(i);
    }

    public TabelaDesign()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        BackColor = Color.White; Font = new Font("Segoe UI", 10F); Cursor = Cursors.Default;
    }

    void Editar(int linha, int col, Rectangle area)
    {
        var atual = _linhas[linha][col];
        if (atual is "Sim" or "Não") { _linhas[linha][col] = atual == "Sim" ? "Não" : "Sim"; Invalidate(); CelulaMudou?.Invoke(linha, col, _linhas[linha][col]); return; }
        _editor?.Dispose();
        var t = _editor = new TextBox { Text = atual, Font = Font, BorderStyle = BorderStyle.FixedSingle, TextAlign = _cols[col].Direita ? HorizontalAlignment.Right : HorizontalAlignment.Left, Bounds = area };
        var feito = false;
        void Fim(bool gravar)
        {
            if (feito) return; feito = true;
            if (gravar && t.Text != atual) { _linhas[linha][col] = t.Text; CelulaMudou?.Invoke(linha, col, t.Text); }
            BeginInvoke(() => { t.Dispose(); if (_editor == t) _editor = null; Invalidate(); });
        }
        t.KeyDown += (_, k) => { if (k.KeyCode == Keys.Enter) { k.SuppressKeyPress = true; Fim(true); } else if (k.KeyCode == Keys.Escape) { k.SuppressKeyPress = true; Fim(false); } };
        t.Leave += (_, _) => Fim(true);
        Controls.Add(t); t.Focus(); t.SelectAll();
    }

    /// <summary>Marca do design: 18 px, raio 5, verde com ✓ quando marcada; branca com borda #C7C7CC quando não.</summary>
    static void Marcar(Graphics g, RectangleF area, bool marcada)
    {
        var q = new RectangleF(area.X + (area.Width - 18) / 2, area.Y + (area.Height - 18) / 2, 18, 18);
        using var p = Forma.Redondo(q, 5);
        if (marcada)
        {
            using var b = new SolidBrush(Forma.Verde); g.FillPath(b, p);
            using var pen = new Pen(Color.White, 2.2f) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round };
            g.DrawLines(pen, [new PointF(q.X + 4.5f, q.Y + 9.5f), new PointF(q.X + 7.8f, q.Y + 12.8f), new PointF(q.X + 13.5f, q.Y + 5.8f)]);
        }
        else { g.FillPath(Brushes.White, p); using var pen = new Pen(Tokens.TextoDesabilitado, 1.5f); g.DrawPath(pen, p); }
    }

    /// <summary>Mensagem quando a tabela está vazia (antes ficava só a faixa branca, parecendo que não carregou).</summary>
    public string Vazio { get; set; } = "Nenhum registro.";
    public void Colunas(params Coluna[] cols) { _cols = cols; Invalidate(); }
    public void Linhas(IEnumerable<string[]> linhas) { _linhas = linhas.ToList(); _topo = 0; Height = 32 + Math.Max(1, Visiveis) * 33 + 2; Invalidate(); }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
        var r = new Rectangle(0, 0, Width - 1, Height - 1);
        using (var path = Forma.Redondo(r, 10))
        {
            g.SetClip(path);
            using (var cab = new SolidBrush(Tokens.SuperficieSuave)) g.FillRectangle(cab, 0, 0, Width, 31);
            using var linha = new Pen(Tokens.Linha);
            g.DrawLine(linha, 0, 31, Width, 31);
            var soma = _cols.Sum(c => c.Peso);
            var x = 12f; var util = Width - 24f;
            var xs = _cols.Select(c => { var ini = x; x += util * c.Peso / soma; return (ini, larg: util * c.Peso / soma); }).ToArray();
            using var fCab = new Font("Segoe UI Semibold", 9F);
            for (var i = 0; i < _cols.Length; i++)
                TextRenderer.DrawText(g, _cols[i].Titulo, fCab, Rectangle.Round(new RectangleF(xs[i].ini, 0, xs[i].larg - 8, 31)), PecasDesign.Cinza, TextFormatFlags.VerticalCenter | (_cols[i].Direita ? TextFormatFlags.Right : _cols[i].Centro || _cols[i].Marca ? TextFormatFlags.HorizontalCenter : TextFormatFlags.Left));
            for (var l = _topo; l < _topo + Visiveis && l < _linhas.Count; l++)
            {
                var y = 32 + (l - _topo) * 33;
                if (Selecionavel)
                {
                    // escolha ÚNICA da linha: bolinha (opção), não caixa de marcar — a caixa sugeria poder marcar várias
                    var cx = xs[0].ini + 6; var cy = y + 8;
                    if (l == Selecionada)
                    {
                        using var verde = new SolidBrush(Tokens.Verde); g.FillEllipse(verde, cx, cy, 17, 17);
                        using var miolo = new SolidBrush(Color.White); g.FillEllipse(miolo, cx + 5.5f, cy + 5.5f, 6, 6);
                    }
                    else { using var cinza = new Pen(Tokens.TextoDesabilitado, 1.5f); g.DrawEllipse(cinza, cx + .75f, cy + .75f, 15.5f, 15.5f); }
                }
                for (var i = Selecionavel ? 1 : 0; i < _cols.Length && i < _linhas[l].Length; i++)
                    if (_cols[i].Marca) Marcar(g, new RectangleF(xs[i].ini, y, xs[i].larg - 8, 33), _linhas[l][i] == "1");
                    else TextRenderer.DrawText(g, _linhas[l][i], Font, Rectangle.Round(new RectangleF(xs[i].ini, y, xs[i].larg - 8, 33)), PecasDesign.CorTexto, TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix | (_cols[i].Direita ? TextFormatFlags.Right : _cols[i].Centro ? TextFormatFlags.HorizontalCenter : TextFormatFlags.Left));
                if (l < _topo + Visiveis - 1) g.DrawLine(linha, 0, y + 33, Width, y + 33);
            }
            if (_linhas.Count == 0 && !string.IsNullOrEmpty(Vazio))
                TextRenderer.DrawText(g, Vazio, Font, new Rectangle(12, 32, Width - 24, 33), PecasDesign.Cinza, TextFormatFlags.VerticalCenter | TextFormatFlags.HorizontalCenter | TextFormatFlags.EndEllipsis);
            if (Visiveis < _linhas.Count)
            {
                // indicador de rolagem fino à direita
                var area = Height - 36f; var alt = Math.Max(24f, area * Visiveis / _linhas.Count);
                var yb = 33f + (area - alt) * _topo / Math.Max(1, _linhas.Count - Visiveis);
                using var barra = new SolidBrush(Color.FromArgb(120, 142, 142, 147));
                using var pb = Forma.Redondo(Rectangle.Round(new RectangleF(Width - 7, yb, 4, alt)), 2);
                g.FillPath(barra, pb);
            }
            g.ResetClip();
        }
        using var borda = new Pen(Tokens.Linha);
        using var p2 = Forma.Redondo(r, 10);
        g.DrawPath(borda, p2);
    }
}

/// <summary>Escurece a janela principal por trás de um diálogo, como no design (rgba(28,28,30,0.30)).</summary>
public sealed class Escurecer : Form
{
    public Escurecer(Form dono)
    {
        FormBorderStyle = FormBorderStyle.None; ShowInTaskbar = false; StartPosition = FormStartPosition.Manual;
        BackColor = Tokens.Preto; Opacity = 0.30; Bounds = dono.Bounds; Owner = dono;
    }
    protected override bool ShowWithoutActivation => true;
    protected override CreateParams CreateParams { get { var cp = base.CreateParams; cp.ExStyle |= 0x08000000 | 0x80; return cp; } } // NOACTIVATE | TOOLWINDOW
}

/// <summary>Abas segmentadas do design (fundo cinza, aba escolhida branca com sombra leve, 28 px de altura).</summary>
public class SegmentoDesign : Control
{
    string[] _itens = [];
    int _sel;
    public event Action<int> Mudou;
    static readonly Font FonteNormal = new("Segoe UI", 9.4F);
    static readonly Font FonteSel = new("Segoe UI Semibold", 9.4F);
    public int Selecionado { get => _sel; set { if (value == _sel) return; _sel = value; Invalidate(); Mudou?.Invoke(value); } }
    public string[] Itens { get => _itens; set { _itens = value; Height = 32; Width = Larguras().Sum() + 4; Invalidate(); } }

    public SegmentoDesign()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        Cursor = Cursors.Hand; Height = 32;
    }

    int[] Larguras() => _itens.Select(t => TextRenderer.MeasureText(t, FonteSel).Width + 24).ToArray();

    protected override void OnMouseClick(MouseEventArgs e)
    {
        base.OnMouseClick(e);
        var x = 2;
        var l = Larguras();
        for (var i = 0; i < l.Length; i++) { if (e.X >= x && e.X < x + l[i]) { Selecionado = i; return; } x += l[i]; }
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
        using (var fundo = new SolidBrush(Parent?.BackColor ?? Color.White)) g.FillRectangle(fundo, ClientRectangle);
        using (var p = Forma.Redondo(new Rectangle(0, 0, Width - 1, Height - 1), 9))
        using (var b = new SolidBrush(Tokens.Linha)) g.FillPath(b, p);
        var x = 2; var l = Larguras();
        for (var i = 0; i < _itens.Length; i++)
        {
            var r = new Rectangle(x, 2, l[i], 28);
            if (i == _sel)
            {
                using (var sombra = Forma.Redondo(new Rectangle(r.X, r.Y + 1, r.Width, r.Height), 7))
                using (var bs = new SolidBrush(Color.FromArgb(30, 0, 0, 0))) g.FillPath(bs, sombra);
                using var p = Forma.Redondo(r, 7); g.FillPath(Brushes.White, p);
            }
            TextRenderer.DrawText(g, _itens[i], i == _sel ? FonteSel : FonteNormal, r, i == _sel ? PecasDesign.CorTexto : Tokens.Grafite, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPrefix);
            x += l[i];
        }
    }
}
