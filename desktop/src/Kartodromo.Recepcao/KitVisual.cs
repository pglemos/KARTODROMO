using System.Drawing.Drawing2D;
using System.Runtime.CompilerServices;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

/// <summary>Kit visual local da Recepção: paleta, cartões, campos, botões e cabeçalho das janelas.</summary>
public static class KitVisual
{
    public static readonly Color Fundo = Color.FromArgb(245, 245, 247);
    public static readonly Color Cartao = Color.White;
    public static readonly Color Texto = Color.FromArgb(29, 29, 31);
    public static readonly Color Secundario = Color.FromArgb(110, 110, 115);
    public static readonly Color Verde = Color.FromArgb(11, 122, 83);
    public static readonly Color VerdeClaro = Color.FromArgb(231, 245, 238);
    public static readonly Color Linha = Color.FromArgb(229, 229, 234);
    public static readonly Color CabecalhoGrade = Color.FromArgb(251, 251, 253);

    sealed class PaletaMenu : ProfessionalColorTable
    {
        public override Color MenuStripGradientBegin => Color.White;
        public override Color MenuStripGradientEnd => Color.White;
        public override Color ToolStripDropDownBackground => Color.FromArgb(250, 250, 252);
        public override Color MenuBorder => Color.FromArgb(225, 225, 230);
        public override Color MenuItemSelected => Color.FromArgb(232, 245, 238);
        public override Color MenuItemSelectedGradientBegin => Color.FromArgb(232, 245, 238);
        public override Color MenuItemSelectedGradientEnd => Color.FromArgb(232, 245, 238);
        public override Color MenuItemPressedGradientBegin => Color.FromArgb(220, 238, 228);
        public override Color MenuItemPressedGradientEnd => Color.FromArgb(220, 238, 228);
        public override Color SeparatorDark => Color.FromArgb(228, 228, 233);
        public override Color SeparatorLight => Color.FromArgb(228, 228, 233);
    }

    public static ToolStripRenderer RenderizadorMenu() => new ToolStripProfessionalRenderer(new PaletaMenu());

    static readonly ConditionalWeakTable<Form, object> Aplicadas = new();
    static bool _instalado;

    public static void Instalar()
    {
        if (_instalado) return;
        _instalado = true;
        Application.Idle += (_, _) =>
        {
            foreach (Form f in Application.OpenForms)
                if (f.Visible && !Aplicadas.TryGetValue(f, out _)) Aplicar(f);
        };
    }

    static void Aplicar(Form f)
    {
        Aplicadas.Add(f, new object());
        if (f is FormPrincipal or FormLogin or ISemKit) return;

        f.SuspendLayout();
        f.BackColor = Fundo;
        f.ForeColor = Texto;
        f.Font = new Font("Segoe UI", 9.5F);

        if (f is Janela)
        {
            var originais = f.Controls.Cast<Control>().ToArray();
            f.Controls.Clear();
            var tamanho = TamanhoDaJanela(f);
            var area = Screen.FromControl(f).WorkingArea;
            var escala = Math.Min(1f, Math.Min(area.Width / (float)tamanho.Width, area.Height / (float)tamanho.Height));
            f.WindowState = FormWindowState.Normal;
            f.FormBorderStyle = FormBorderStyle.None;
            f.ControlBox = false;
            f.MinimizeBox = false;
            f.MaximizeBox = false;
            f.ClientSize = new Size(Math.Max(760, (int)(tamanho.Width * escala)), Math.Max(520, (int)(tamanho.Height * escala)));
            f.MinimumSize = new Size(760, 520);
            f.StartPosition = FormStartPosition.CenterParent;

            var corpo = new Panel { Dock = DockStyle.Fill, BackColor = Fundo, Padding = new Padding(12, 10, 12, 12) };
            corpo.Controls.AddRange(originais);
            f.Controls.Add(corpo);
            // o Produto tem o próprio cabeçalho (design aprovado): sem a barra genérica
            if (f is not FormCadastro { EhProduto: true }) f.Controls.Add(Cabecalho(f, f.Text));
            else corpo.Padding = new Padding(0);
            AplicarRaio(corpo, 18);
            f.Resize += (_, _) => AplicarRaio(f, 18);
            AplicarRaio(f, 18);
        }

        EstilizarArvore(f, f);
        f.PerformLayout();
        f.ResumeLayout(true);
    }

    static Size TamanhoDaJanela(Form f)
    {
        if (f is FormCheckout) return new Size(1320, 812);
        if (f is FormCliente) return new Size(1100, 740);
        if (f is FormCadastro && f.Text.Contains("Produto", StringComparison.OrdinalIgnoreCase)) return new Size(1140, 772);
        if (f is FormCadastro) return new Size(1060, 680);
        if (f.Text.Contains("Agenda", StringComparison.OrdinalIgnoreCase)) return new Size(1120, 780);
        return new Size(960, 680);
    }

    static Control Cabecalho(Form janela, string titulo)
    {
        var p = new Panel { Dock = DockStyle.Top, Height = 56, BackColor = Cartao, Padding = new Padding(16, 6, 10, 6), Cursor = Cursors.SizeAll };
        p.Controls.Add(new Panel { Dock = DockStyle.Bottom, Height = 1, BackColor = Linha });
        var ic = new PictureBox { Image = Icone.Tile("", Verde, 28), Size = new Size(28, 28), SizeMode = PictureBoxSizeMode.Zoom, Left = 12, Top = 8 };
        var t = new Label { Text = titulo, AutoSize = true, Font = new Font("Segoe UI", 10.5F, FontStyle.Bold), ForeColor = Texto, Left = 50, Top = 8, Cursor = Cursors.SizeAll };
        var sub = new Label { Text = "Kartódromo Internacional de Betim · Módulo Office", AutoSize = true, Font = new Font("Segoe UI", 8.3F), ForeColor = Secundario, Left = 50, Top = 28, Cursor = Cursors.SizeAll };
        var x = Botao("×", false);
        x.Size = new Size(34, 32); x.Anchor = AnchorStyles.Top | AnchorStyles.Right; x.Left = p.Width - 44; x.Top = 9;
        x.AccessibleName = "Fechar janela";
        x.Click += (_, _) => janela.Close();
        p.Controls.AddRange([ic, t, sub, x]);
        p.Resize += (_, _) => x.Left = p.ClientSize.Width - x.Width - 8;

        Point? origemMouse = null;
        Point origemJanela = Point.Empty;
        void LigarArraste(Control c)
        {
            c.MouseDown += (_, e) =>
            {
                if (e.Button != MouseButtons.Left || janela.WindowState == FormWindowState.Maximized) return;
                origemMouse = Cursor.Position;
                origemJanela = janela.Location;
            };
            c.MouseMove += (_, e) =>
            {
                if (origemMouse is not Point origem || e.Button != MouseButtons.Left) return;
                var agora = Cursor.Position;
                janela.Location = new Point(origemJanela.X + agora.X - origem.X, origemJanela.Y + agora.Y - origem.Y);
            };
            c.MouseUp += (_, _) => origemMouse = null;
        }
        LigarArraste(p); LigarArraste(ic); LigarArraste(t); LigarArraste(sub);
        return p;
    }

    static void EstilizarArvore(Control root, Form form)
    {
        foreach (Control c in root.Controls)
        {
            if (c.AccessibleDescription == "kit:ignorar") continue;
            if (c is Button b)
            {
                var principal = ReferenceEquals(form.AcceptButton, b) || b.Text.Contains("Salvar", StringComparison.OrdinalIgnoreCase)
                    || b.Text.Contains("Concluir", StringComparison.OrdinalIgnoreCase) || b.Text.StartsWith("Gravar", StringComparison.OrdinalIgnoreCase) || b.Text is "OK" or "Ok" || b.Text.StartsWith("Aprovar", StringComparison.OrdinalIgnoreCase);
                PrepararBotao(b, principal);
            }
            else if (c is TextBox t)
            {
                t.Font = new Font("Segoe UI", 9.5F);
                t.BackColor = Cartao;
                t.ForeColor = Texto;
                t.BorderStyle = BorderStyle.None;
            }
            else if (c is ComboBox cb)
            {
                cb.Font = new Font("Segoe UI", 9.5F);
                cb.BackColor = Cartao;
                cb.ForeColor = Texto;
                cb.FlatStyle = FlatStyle.Flat;
            }
            else if (c is DateTimePicker dt)
            {
                dt.Font = new Font("Segoe UI", 9.5F);
                dt.CalendarTitleBackColor = Verde;
                dt.CalendarTitleForeColor = Color.White;
            }
            else if (c is CheckBox ck && c is not ChaveLiga && ck.Appearance == Appearance.Normal)
            {
                CheckVerde(ck);
            }
            else if (c is DataGridView g)
            {
                EstilizarGrade(g);
            }
            else if (c is Panel p && EhPainelDeCampo(p))
            {
                EstilizarCampo(p);
            }
            else if (c is Label l && l.ForeColor == Color.Black)
            {
                l.ForeColor = Texto;
            }
            EstilizarArvore(c, form);
        }
    }

    /// <summary>Caixa de seleção do design: quadradinho arredondado verde com ✓ branco.</summary>
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
            using (var fundo = new SolidBrush(ck.Parent?.BackColor ?? Color.White)) g.FillRectangle(fundo, new Rectangle(0, 0, lado + 2, ck.Height));
            using var p = CaminhoArredondado(r, 4);
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

    static bool EhPainelDeCampo(Panel p) => p.Controls.OfType<Label>().Any() &&
        p.Controls.Cast<Control>().Any(c => c is TextBox or ComboBox or DateTimePicker or NumericUpDown or MaskedTextBox);

    static void EstilizarCampo(Panel p)
    {
        p.BackColor = Cartao;
        p.Padding = new Padding(10, 4, 9, 4);
        p.Height = Math.Max(p.Height, 56);
        foreach (Control c in p.Controls)
        {
            if (c is Label l)
            {
                l.ForeColor = Secundario;
                l.Font = new Font("Segoe UI", 8.2F, FontStyle.Bold);
            }
            else if (c is TextBox tb) { tb.BorderStyle = BorderStyle.None; tb.BackColor = Cartao; }
            else if (c is ComboBox cb) { cb.FlatStyle = FlatStyle.Flat; cb.BackColor = Cartao; }
            else if (c is DateTimePicker dt) { dt.CalendarTitleBackColor = Verde; dt.CalendarTitleForeColor = Color.White; }
        }
        p.Paint += (_, e) =>
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var path = CaminhoArredondado(new Rectangle(0, 0, p.Width - 1, p.Height - 1), 8);
            using var pen = new Pen(Color.FromArgb(218, 218, 224));
            e.Graphics.DrawPath(pen, path);
        };
        p.Resize += (_, _) => AplicarRaio(p, 8);
        AplicarRaio(p, 8);
    }

    public static void EstilizarGrade(DataGridView g)
    {
        g.BackgroundColor = Cartao;
        g.BorderStyle = BorderStyle.None;
        g.GridColor = Color.FromArgb(241, 241, 244);
        g.EnableHeadersVisualStyles = false;
        g.ColumnHeadersDefaultCellStyle.BackColor = CabecalhoGrade;
        g.ColumnHeadersDefaultCellStyle.ForeColor = Secundario;
        g.ColumnHeadersDefaultCellStyle.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
        g.ColumnHeadersDefaultCellStyle.SelectionBackColor = CabecalhoGrade;
        g.ColumnHeadersHeight = 36;
        g.DefaultCellStyle.BackColor = Cartao;
        g.DefaultCellStyle.ForeColor = Texto;
        g.DefaultCellStyle.SelectionBackColor = VerdeClaro;
        g.DefaultCellStyle.SelectionForeColor = Texto;
        g.AlternatingRowsDefaultCellStyle.BackColor = Color.FromArgb(253, 253, 254);
        g.RowTemplate.Height = 30;
        g.Font = new Font("Segoe UI", 9.2F);
    }

    public static Button Botao(string texto, bool principal = false, int largura = 0)
    {
        var b = new Button
        {
            Text = texto,
            AutoSize = largura <= 0,
            MinimumSize = new Size(largura > 0 ? largura : 92, 34),
            Height = 34,
            FlatStyle = FlatStyle.Flat,
            BackColor = principal ? Verde : Color.FromArgb(238, 238, 241),
            ForeColor = principal ? Color.White : Texto,
            Font = new Font("Segoe UI", 9.5F, principal ? FontStyle.Bold : FontStyle.Regular),
            Cursor = Cursors.Hand,
            Margin = new Padding(4),
            Padding = new Padding(10, 0, 10, 0),
        };
        b.FlatAppearance.BorderSize = 0;
        AplicarRaio(b, 9);
        return b;
    }

    public static Panel CartaoResumo(string rotulo, string valor, Color? corValor = null)
    {
        var p = new Panel { Height = 72, BackColor = Cartao, Padding = new Padding(14, 9, 12, 8), Margin = new Padding(0, 0, 10, 0) };
        p.Controls.Add(new Label { Name = "valor", Text = valor, Dock = DockStyle.Bottom, Height = 29, Font = new Font("Segoe UI", 15F, FontStyle.Bold), ForeColor = corValor ?? Texto, AutoEllipsis = true });
        p.Controls.Add(new Label { Name = "rotulo", Text = rotulo, Dock = DockStyle.Top, Height = 20, Font = new Font("Segoe UI", 8.7F), ForeColor = Secundario, AutoEllipsis = true });
        p.Paint += (_, e) =>
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var path = CaminhoArredondado(p.ClientRectangle, 12);
            using var b = new SolidBrush(Cartao);
            using var pen = new Pen(Color.FromArgb(235, 235, 239));
            e.Graphics.FillPath(b, path); e.Graphics.DrawPath(pen, path);
        };
        p.Resize += (_, _) => AplicarRaio(p, 12);
        AplicarRaio(p, 12);
        return p;
    }

    public static void ValorCartao(Panel cartao, string valor, Color? cor = null)
    {
        var l = cartao.Controls.Find("valor", false).FirstOrDefault() as Label;
        if (l != null) { l.Text = valor; l.ForeColor = cor ?? Texto; }
    }

    public static Panel Campo(string rotulo, Control campo, int altura = 58)
    {
        var p = new Panel { Height = altura, BackColor = Cartao, Padding = new Padding(11, 6, 10, 5), Margin = new Padding(4) };
        p.Controls.Add(new Label { Text = rotulo, Dock = DockStyle.Top, Height = 17, Font = new Font("Segoe UI", 8.2F, FontStyle.Bold), ForeColor = Secundario });
        campo.Dock = DockStyle.Fill;
        campo.Margin = new Padding(0);
        if (campo is TextBox tb) { tb.BorderStyle = BorderStyle.None; tb.Font = new Font("Segoe UI", 11F); }
        p.Controls.Add(campo);
        p.Resize += (_, _) => AplicarRaio(p, 9);
        AplicarRaio(p, 9);
        return p;
    }

    public static void AplicarRaio(Control c, int raio)
    {
        if (c.Width < 2 || c.Height < 2) return;
        using var path = CaminhoArredondado(new Rectangle(0, 0, c.Width, c.Height), Math.Min(raio, Math.Min(c.Width, c.Height) / 2));
        c.Region = new Region(path);
    }

    static GraphicsPath CaminhoArredondado(Rectangle r, int raio)
    {
        var d = Math.Clamp(raio * 2, 2, Math.Max(2, Math.Min(r.Width, r.Height)));
        var p = new GraphicsPath();
        p.AddArc(r.Left, r.Top, d, d, 180, 90); p.AddArc(r.Right - d, r.Top, d, d, 270, 90);
        p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90); p.AddArc(r.Left, r.Bottom - d, d, d, 90, 90);
        p.CloseFigure();
        return p;
    }

    static void PrepararBotao(Button b, bool principal)
    {
        b.FlatStyle = FlatStyle.Flat;
        b.FlatAppearance.BorderSize = 0;
        b.Font = new Font("Segoe UI", 9.3F, principal ? FontStyle.Bold : FontStyle.Regular);
        b.BackColor = principal ? Verde : Color.FromArgb(238, 238, 241);
        b.ForeColor = principal ? Color.White : Texto;
        b.Cursor = Cursors.Hand;
        b.Resize += (_, _) => AplicarRaio(b, 8);
        AplicarRaio(b, 8);
    }
}
