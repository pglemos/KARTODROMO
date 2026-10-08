using System.Drawing.Drawing2D;

namespace Kartodromo.Comum;

/// <summary>Botão chato (flat) sem a moldura preta que o Windows desenha no botão com foco ou "padrão"
/// (aparecia no primeiro botão de cada janela e depois de qualquer clique; o canvas não tem).</summary>
public class BotaoPlano : Button
{
    protected override bool ShowFocusCues => false;
    public override void NotifyDefault(bool value) => base.NotifyDefault(false);
}

/// <summary>Janela em forma de cartão: sem moldura do Windows, cantos arredondados, sombra, arrasta pelo fundo, Esc fecha.</summary>
public class CartaoModal : Form, ISemKit
{
    protected const int Raio = 18;

    public static Size CalcularTamanhoUtil(int larguraDesejada, int alturaDesejada, Rectangle? areaTrabalho = null)
    {
        var area = areaTrabalho ?? (Screen.PrimaryScreen?.WorkingArea ?? new Rectangle(0, 0, 1366, 768));
        var margemX = 32;
        var margemY = 32;
        var maxW = Math.Max(400, area.Width - margemX);
        var maxH = Math.Max(300, area.Height - margemY);
        return new Size(Math.Min(larguraDesejada, maxW), Math.Min(alturaDesejada, maxH));
    }

    public CartaoModal(int largura, int altura)
    {
        var tam = CalcularTamanhoUtil(largura, altura);
        largura = tam.Width;
        altura = tam.Height;

        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.CenterParent;
        ShowInTaskbar = false;
        KeyPreview = true;
        BackColor = Color.White;
        Font = new Font("Segoe UI", 9.5F);
        ForeColor = PecasDesign.CorTexto;
        ClientSize = new Size(largura, altura);
        DoubleBuffered = true;
        KeyDown += (_, e) => { if (e.KeyCode == Keys.Escape) Close(); };
        Resize += (_, _) => { using var p = Forma.Redondo(new Rectangle(0, 0, Width, Height), Raio); Region = new Region(p); };
        Point? origem = null;
        MouseDown += (_, e) => { if (e.Button == MouseButtons.Left) origem = e.Location; };
        MouseMove += (_, e) => { if (origem is Point o && e.Button == MouseButtons.Left) Location = new Point(Location.X + e.X - o.X, Location.Y + e.Y - o.Y); };
        MouseUp += (_, _) => origem = null;
    }

    protected override CreateParams CreateParams
    {
        get { var cp = base.CreateParams; cp.ClassStyle |= 0x20000; return cp; } // CS_DROPSHADOW
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        using var p = Forma.Redondo(new Rectangle(0, 0, Width - 1, Height - 1), Raio);
        using var pen = new Pen(Color.FromArgb(220, 220, 225));
        e.Graphics.DrawPath(pen, p);
    }

    // ---------- peças do design
    public static Button Botao(string texto, Color fundo, Color frente, bool negrito = false)
    {
        var b = new BotaoPlano { Text = texto, FlatStyle = FlatStyle.Flat, BackColor = fundo, ForeColor = frente, Font = new Font("Segoe UI", 10F, negrito ? FontStyle.Bold : FontStyle.Regular), Cursor = Cursors.Hand, Height = 42 };
        b.FlatAppearance.BorderSize = 0;
        b.FlatAppearance.MouseOverBackColor = ControlPaint.Light(fundo, 0.12f);
        b.Resize += (_, _) => Forma.AplicarRaio(b, 12);
        return b;
    }

    public static readonly Color CinzaBotao = Tokens.BotaoSecundario;

    /// <summary>Cartão branco arredondado com borda fina, para listas de linhas.</summary>
    public static Panel Lista()
    {
        var p = new Panel { BackColor = Color.White };
        p.Paint += (_, e) =>
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var path = Forma.Redondo(new Rectangle(0, 0, p.Width - 1, p.Height - 1), 14);
            using var pen = new Pen(Tokens.Linha);
            e.Graphics.DrawPath(pen, path);
        };
        return p;
    }

    /// <summary>Ícone do design (bloco com gradiente) desenhado grande.</summary>
    public static PictureBox Icone(string nome, int tamanho) => new() { Image = Forma.Icone(nome), SizeMode = PictureBoxSizeMode.Zoom, Size = new Size(tamanho, tamanho), BackColor = Color.Transparent };
}
