using System.Drawing.Drawing2D;

namespace Kartodromo.Comum;

/// <summary>
/// Janela de formulário do design aprovado (Dialogo.dc.html): cabeçalho com ícone, título, subtítulo e ✕;
/// corpo cinza com seções brancas arredondadas; cada campo com o nome em cima de uma caixa branca de 34 px,
/// numa grade de 6 colunas; rodapé branco com os botões à direita (o último é o principal, verde).
/// O layout é próprio (ISemKit): o kit visual genérico não reorganiza os controles.
/// </summary>
public class DialogoDesign : CartaoModal
{
    public static readonly Color Fundo = Color.FromArgb(245, 245, 247);
    public static readonly Color VerdePrincipal = Color.FromArgb(11, 122, 83);
    static readonly Color Rotulo = Color.FromArgb(110, 110, 115);
    static readonly Color Borda = Color.FromArgb(219, 219, 222); // rgba(0,0,0,0.14) sobre branco

    readonly TableLayoutPanel _secoes;
    /// <summary>largura útil das seções (a janela menos as margens e a barra de rolagem)</summary>
    readonly int _larguraSecao;
    readonly FlowLayoutPanel _botoes;
    readonly Panel _cab, _rod, _corpo;
    public readonly Label Subtitulo;

    public DialogoDesign(string titulo, string sub, string icone, int largura = 960, int altura = 680) : this(titulo, sub, Forma.Icone(icone), largura, altura) { }

    /// <summary>Com o ícone do canvas: caminho SVG + degradê CSS (ex.: "linear-gradient(180deg, #9A9AA0, #4A4A4F)").</summary>
    public DialogoDesign(string titulo, string sub, string svg, string corCss, int largura = 960, int altura = 680) : this(titulo, sub, Forma.Tile(svg, corCss), largura, altura) { }

    public DialogoDesign(string titulo, string sub, Image icone, int largura = 960, int altura = 680) : base(largura, altura)
    {
        Text = titulo;
        BackColor = Fundo;

        // cabeçalho
        var cab = _cab = new Panel { Dock = DockStyle.Top, Height = 62, BackColor = Color.White };
        cab.Paint += (_, e) => { using var pen = new Pen(Color.FromArgb(230, 230, 234)); e.Graphics.DrawLine(pen, 0, cab.Height - 1, cab.Width, cab.Height - 1); };
        var ic = new PictureBox { Image = icone, SizeMode = PictureBoxSizeMode.Zoom, Size = new Size(36, 36), BackColor = Color.Transparent, Location = new Point(18, 13) };
        var t = new Label { Text = titulo, AutoSize = true, Font = new Font("Segoe UI", 12F, FontStyle.Bold), ForeColor = PecasDesign.CorTexto, Location = new Point(62, 11), BackColor = Color.Transparent };
        Subtitulo = new Label { Text = sub, AutoSize = true, Font = new Font("Segoe UI", 9F), ForeColor = Rotulo, Location = new Point(63, 33), BackColor = Color.Transparent };
        var fechar = Botao("✕", Color.FromArgb(235, 235, 239), PecasDesign.CorTexto);
        fechar.Size = new Size(34, 32); fechar.Font = new Font("Segoe UI", 9.5F); fechar.Anchor = AnchorStyles.Top | AnchorStyles.Right;
        fechar.Location = new Point(largura - 52, 15);
        fechar.Click += (_, _) => Close();
        cab.Controls.AddRange([ic, t, Subtitulo, fechar]);
        // arrasta a janela pelo cabeçalho
        Point? origem = null;
        foreach (Control c in new Control[] { cab, t, Subtitulo, ic })
        {
            c.MouseDown += (_, e) => { if (e.Button == MouseButtons.Left) origem = e.Location; };
            c.MouseMove += (_, e) => { if (origem is Point o && e.Button == MouseButtons.Left) Location = new Point(Location.X + e.X - o.X, Location.Y + e.Y - o.Y); };
            c.MouseUp += (_, _) => origem = null;
        }

        // rodapé
        var rod = _rod = new Panel { Dock = DockStyle.Bottom, Height = 60, BackColor = Color.White };
        rod.Paint += (_, e) => { using var pen = new Pen(Color.FromArgb(230, 230, 234)); e.Graphics.DrawLine(pen, 0, 0, rod.Width, 0); };
        _botoes = new FlowLayoutPanel { Dock = DockStyle.Right, FlowDirection = FlowDirection.RightToLeft, AutoSize = true, WrapContents = false, Padding = new Padding(0, 12, 14, 0), BackColor = Color.White };
        rod.Controls.Add(_botoes);

        // corpo: seções empilhadas, com rolagem se não couber
        var corpo = _corpo = new Panel { Dock = DockStyle.Fill, BackColor = Fundo, AutoScroll = true, Padding = new Padding(18, 14, 18, 14) };
        _larguraSecao = largura - 36 - SystemInformation.VerticalScrollBarWidth;
        _secoes = new TableLayoutPanel { MinimumSize = new Size(_larguraSecao, 0), MaximumSize = new Size(_larguraSecao, 0), Dock = DockStyle.Top, ColumnCount = 1, AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink, BackColor = Fundo };
        _secoes.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        corpo.Controls.Add(_secoes);

        Controls.Add(corpo); Controls.Add(rod); Controls.Add(cab);
        corpo.BringToFront(); // o Fill por último no encaixe: não fica por baixo do cabeçalho/rodapé
    }

    protected override void OnShown(EventArgs e)
    {
        base.OnShown(e);
        foreach (Control c in Controls) if (c is Panel { AutoScroll: true } p) p.AutoScrollPosition = Point.Empty; // abre mostrando o topo
    }

    protected override void OnLoad(EventArgs e)
    {
        // escurece a tela principal por trás (design: rgba(28,28,30,0.30)); aparece antes da janela para ficar embaixo dela
        if (Owner is Form dono && dono.Visible && dono.WindowState != FormWindowState.Minimized)
        {
            var fundo = new Escurecer(dono);
            fundo.Show();
            FormClosed += (_, _) => fundo.Close();
        }
        base.OnLoad(e);
    }

    /// <summary>Abas segmentadas logo abaixo do cabeçalho (margem 12 18 0).</summary>
    public SegmentoDesign Abas(string[] nomes, Action<int> mudou, int sel = 0)
    {
        var faixa = new Panel { Dock = DockStyle.Top, Height = 44, BackColor = Fundo };
        var seg = new SegmentoDesign { Location = new Point(18, 12), BackColor = Fundo };
        seg.Itens = nomes; seg.Selecionado = sel;
        seg.Mudou += i => mudou(i);
        faixa.Controls.Add(seg);
        Controls.Add(faixa);
        faixa.SendToBack(); _cab.SendToBack(); _corpo.BringToFront();
        return seg;
    }

    /// <summary>Texto cinza à esquerda do rodapé.</summary>
    public Label TextoRodape(string texto)
    {
        var l = new Label { Text = texto, AutoSize = false, Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft, Padding = new Padding(18, 0, 0, 0), Font = new Font("Segoe UI", 9F), ForeColor = Rotulo, BackColor = Color.White };
        _rod.Controls.Add(l); l.BringToFront();
        return l;
    }

    /// <summary>Remove todas as seções (para trocar o conteúdo ao mudar de aba).</summary>
    public void LimparSecoes() { foreach (Control c in _secoes.Controls.Cast<Control>().ToArray()) c.Dispose(); _secoes.Controls.Clear(); }

    /// <summary>Seção branca com título (opcional) e grade de 6 colunas; devolve a grade para receber os campos.</summary>
    /// <summary>Nota (seção cinza só com texto), como o aviso no fim de alguns diálogos do design.</summary>
    public Control Nota(string texto)
    {
        var g = Secao(null, texto);
        var s = (TableLayoutPanel)g.Parent;
        s.BackColor = Fundo; g.BackColor = Fundo;
        foreach (Control c in s.Controls) c.BackColor = Fundo;
        s.Padding = new Padding(16, 14, 16, 8);
        return s;
    }

    public TableLayoutPanel Secao(string titulo, string texto = null)
    {
        var s = new TableLayoutPanel { MinimumSize = new Size(_larguraSecao, 0), MaximumSize = new Size(_larguraSecao, 0), Dock = DockStyle.Fill, ColumnCount = 1, AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink, BackColor = Color.White, Padding = new Padding(16, 12, 2, 14), Margin = new Padding(0, 0, 0, 12) }; // à direita a margem de 14 da última coluna completa os 16
        s.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        s.Paint += (_, e) =>
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var path = Forma.Redondo(new Rectangle(0, 0, s.Width - 1, s.Height - 1), 14);
            using var pen = new Pen(Color.FromArgb(226, 226, 230));
            e.Graphics.DrawPath(pen, path);
        };
        s.Resize += (_, _) => Forma.AplicarRaio(s, 14);
        if (!string.IsNullOrEmpty(titulo)) s.Controls.Add(new Label { Text = titulo, AutoSize = true, Font = new Font("Segoe UI", 10.5F, FontStyle.Bold), ForeColor = PecasDesign.CorTexto, Margin = new Padding(0, 0, 0, 8) });
        if (!string.IsNullOrEmpty(texto)) s.Controls.Add(new Label { Text = texto, AutoSize = true, MaximumSize = new Size(_larguraSecao - 40, 0), Font = new Font("Segoe UI", 9.6F), ForeColor = Color.FromArgb(58, 58, 60), Margin = new Padding(0, 0, 0, 6) });
        var grade = new TableLayoutPanel { MinimumSize = new Size(_larguraSecao - 18, 0), MaximumSize = new Size(_larguraSecao - 18, 0), Dock = DockStyle.Fill, ColumnCount = 6, AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink, BackColor = Color.White, Margin = Padding.Empty };
        for (var i = 0; i < 6; i++) grade.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f / 6));
        s.Controls.Add(grade);
        _secoes.Controls.Add(s);
        return grade;
    }

    /// <summary>Seção com a tabela simples do design (cabeçalho claro, linhas finas).</summary>
    public TabelaDesign SecaoTabelaDesign(string titulo)
    {
        var grade = Secao(titulo);
        var t = new TabelaDesign { Dock = DockStyle.Fill, Height = 100, Margin = new Padding(0, 0, 14, 0) };
        grade.Controls.Add(t);
        grade.SetColumnSpan(t, 6);
        return t;
    }

    /// <summary>Seção só com uma tabela (ex.: provas do produto).</summary>
    public Grade SecaoTabela(string titulo, int altura)
    {
        var grade = Secao(titulo);
        var g = new Grade { Dock = DockStyle.Fill, Height = altura, Margin = Padding.Empty, BackgroundColor = Color.White, BorderStyle = BorderStyle.None };
        grade.Controls.Add(g);
        grade.SetColumnSpan(g, 6);
        return g;
    }

    /// <summary>Campo: nome em cima e a caixa branca arredondada com o controle dentro (e um botão de ação opcional).</summary>
    public void Campo(TableLayoutPanel grade, string rotulo, Control controle, int span, params Control[] acoes)
    {
        var cel = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 2, Height = 58, Margin = new Padding(0, 0, 14, 6), BackColor = Color.White };
        cel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); // largura = a da coluna da grade (automática estourava)
        cel.RowStyles.Add(new RowStyle(SizeType.Absolute, 20)); cel.RowStyles.Add(new RowStyle(SizeType.Absolute, 36));
        cel.Controls.Add(new Label { Text = rotulo, Dock = DockStyle.Fill, Font = PecasDesign.FonteRotulo, ForeColor = Rotulo, Margin = Padding.Empty, TextAlign = ContentAlignment.BottomLeft }, 0, 0);
        // o conteúdo fica 2 px para dentro para não cobrir a linha da borda
        var caixa = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Margin = new Padding(0, 2, 0, 0), Padding = controle is DateTimePicker ? new Padding(0, 2, 0, 2) : new Padding(9, 2, 6, 2) };
        caixa.Paint += (_, e) =>
        {
            if (controle is DateTimePicker) return; // o campo de data já tem a própria borda
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var path = Forma.Redondo(new Rectangle(0, 0, caixa.Width - 1, caixa.Height - 1), 8);
            using var pen = new Pen(controle.Focused ? VerdePrincipal : Borda);
            e.Graphics.DrawPath(pen, path);
        };
        controle.GotFocus += (_, _) => caixa.Invalidate(); controle.LostFocus += (_, _) => caixa.Invalidate();
        if (controle is not DataDesign) controle.Font = PecasDesign.FonteValor;
        switch (controle)
        {
            case TextBox tb: tb.BorderStyle = BorderStyle.None; break;
            case NumericUpDown nu: nu.BorderStyle = BorderStyle.None; break;
            case ComboBox cb: cb.FlatStyle = FlatStyle.Flat; break;
        }
        controle.MinimumSize = Size.Empty;
        if (acoes.Length == 0)
        {
            // sem botão: o controle ocupa a largura da caixa, centralizado na vertical
            var h = controle is TextBox ? controle.Font.Height : controle is DataDesign or Label ? controle.Height : controle.PreferredSize.Height;
            var sobra = Math.Max(0, (34 - 4 - h) / 2);
            caixa.Padding = new Padding(caixa.Padding.Left, 2 + sobra, caixa.Padding.Right, 2);
            controle.Dock = DockStyle.Top; controle.Margin = Padding.Empty;
            caixa.Controls.Add(controle);
            cel.Controls.Add(caixa, 0, 1);
            grade.Controls.Add(cel);
            grade.SetColumnSpan(cel, span);
            return;
        }
        // com botão: controle à esquerda e os botões à direita
        var meio = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1 + acoes.Length, RowCount = 1, Margin = Padding.Empty, BackColor = Color.White };
        meio.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        // largura pequena de partida: quem manda é a coluna (senão numérico/lista estouram a caixa)
        controle.MinimumSize = Size.Empty; controle.Width = 24;
        controle.Anchor = AnchorStyles.Left | AnchorStyles.Right; controle.Margin = new Padding(0, 1, 0, 0);
        meio.Controls.Add(controle, 0, 0);
        for (var i = 0; i < acoes.Length; i++)
        {
            meio.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            acoes[i].Anchor = AnchorStyles.Right; acoes[i].Margin = new Padding(4, 0, 0, 0);
            meio.Controls.Add(acoes[i], 1 + i, 0);
        }
        caixa.Controls.Add(meio);
        cel.Controls.Add(caixa, 0, 1);
        grade.Controls.Add(cel);
        grade.SetColumnSpan(cel, span);
    }

    /// <summary>Caixa de marcar verde ocupando <paramref name="span"/> colunas.</summary>
    public void Marca(TableLayoutPanel grade, CheckBox c, int span, bool alinharComCampo = true)
    {
        c.AutoSize = true; c.Font = PecasDesign.FonteValor; c.Anchor = AnchorStyles.Left; c.Margin = new Padding(0, alinharComCampo ? 26 : 4, 14, 6); c.BackColor = Color.White; c.Padding = new Padding(4, 0, 0, 0); c.Cursor = Cursors.Hand;
        Forma.CheckVerde(c);
        grade.Controls.Add(c);
        grade.SetColumnSpan(c, span);
    }

    /// <summary>Botão de opção verde ocupando <paramref name="span"/> colunas (linha só de opções: sem o espaço do rótulo).</summary>
    public void Opcao(TableLayoutPanel grade, RadioButton r, int span, bool alinharComCampo = false)
    {
        r.AutoSize = true; r.Font = PecasDesign.FonteValor; r.Anchor = AnchorStyles.Left; r.Margin = new Padding(0, alinharComCampo ? 26 : 6, 14, 8); r.BackColor = Color.White; r.Padding = new Padding(4, 0, 0, 0); r.Cursor = Cursors.Hand;
        Forma.RadioVerde(r);
        grade.Controls.Add(r);
        grade.SetColumnSpan(r, span);
    }

    /// <summary>Botão pequeno dentro de uma caixa (ex.: "Pesquisar").</summary>
    public static Button AcaoCampo(string texto)
    {
        var b = new Button { Text = texto, AutoSize = true, Height = 26, FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(226, 241, 235), ForeColor = Color.FromArgb(10, 94, 64), Font = new Font("Segoe UI", 8.8F, FontStyle.Bold), Cursor = Cursors.Hand, Padding = new Padding(4, 0, 4, 0) };
        b.FlatAppearance.BorderSize = 0;
        return b;
    }

    /// <summary>Botão do rodapé (da direita para a esquerda: chame o principal primeiro).</summary>
    public Button BotaoRodape(string texto, bool principal, Action clique)
    {
        var b = Botao(texto, principal ? VerdePrincipal : Color.FromArgb(235, 235, 239), principal ? Color.White : PecasDesign.CorTexto, principal);
        b.Height = 36; b.AutoSize = true; b.MinimumSize = new Size(96, 36); b.Padding = new Padding(10, 0, 10, 0); b.Margin = new Padding(8, 0, 0, 0);
        b.Click += (_, _) => clique();
        _botoes.Controls.Add(b);
        return b;
    }
}
