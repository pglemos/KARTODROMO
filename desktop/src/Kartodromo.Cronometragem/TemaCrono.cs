using System.Drawing.Drawing2D;

namespace Kartodromo.Cronometragem;

static class TemaCrono
{
    public static readonly Color Fundo = Color.FromArgb(245, 245, 247);
    public static readonly Color Cartao = Color.White;
    public static readonly Color Texto = Color.FromArgb(29, 29, 31);
    public static readonly Color Secundario = Color.FromArgb(110, 110, 115);
    public static readonly Color Verde = Color.FromArgb(11, 122, 83);
    public static readonly Color Azul = Color.FromArgb(10, 132, 255);
    public static readonly Color Vermelho = Color.FromArgb(196, 40, 28);
    public static readonly Color Borda = Color.FromArgb(229, 229, 234);
    public static readonly Font Normal = new("Segoe UI", 9.5F);
    public static readonly Font Pequena = new("Segoe UI", 8.5F);
    public static readonly Font Titulo = new("Segoe UI", 14F, FontStyle.Bold);
    public static readonly Font Mono = new("Cascadia Mono", 10F);

    public static Panel Card(string titulo = null, string subtitulo = null)
    {
        var card = new PainelArredondado { Dock = DockStyle.Fill, BackColor = Cartao, Padding = new Padding(12, 8, 12, 8), Raio = 14 };
        // o conteúdo "Fill" precisa ficar na frente da ordem de encaixe; senão ele ocupa o cartão inteiro
        // e o cabeçalho do cartão fica por cima dos títulos das colunas (bug visto no CRONO1 em 1920x1080)
        card.ControlAdded += (_, e) => { if (e.Control.Dock == DockStyle.Fill) e.Control.BringToFront(); };
        if (titulo != null)
        {
            var cab = new Panel { Dock = DockStyle.Top, Height = subtitulo == null ? 28 : 46, Padding = new Padding(4, 1, 4, 4), BackColor = Cartao };
            cab.Controls.Add(new Label { Text = titulo, Dock = subtitulo == null ? DockStyle.Fill : DockStyle.Top, Height = 24, Font = new Font("Segoe UI", 10F, FontStyle.Bold), ForeColor = Texto, TextAlign = ContentAlignment.MiddleLeft });
            if (subtitulo != null) cab.Controls.Add(new Label { Text = subtitulo, Dock = DockStyle.Bottom, Height = 20, Font = Pequena, ForeColor = Secundario, TextAlign = ContentAlignment.MiddleLeft });
            card.Controls.Add(cab);
        }
        return card;
    }

    public static Button Botao(string texto, bool primario = false, Color? cor = null)
    {
        var color = cor ?? (primario ? Verde : Color.FromArgb(242, 242, 247));
        var b = new Button
        {
            Text = texto,
            AutoSize = true,
            MinimumSize = new Size(72, 32),
            FlatStyle = FlatStyle.Flat,
            BackColor = color,
            ForeColor = primario || cor != null ? Color.White : Texto,
            Font = new Font("Segoe UI", 9F, primario ? FontStyle.Bold : FontStyle.Regular),
            Padding = new Padding(8, 1, 8, 1),
            Margin = new Padding(3),
            Cursor = Cursors.Hand,
        };
        b.FlatAppearance.BorderSize = 0;
        b.FlatAppearance.MouseOverBackColor = ControlPaint.Light(color, .08f);
        return b;
    }

    public static Label Rotulo(string texto, int tamanho = 10, bool forte = false) => new()
    {
        Text = texto,
        AutoSize = true,
        Font = new Font("Segoe UI", tamanho, forte ? FontStyle.Bold : FontStyle.Regular),
        ForeColor = forte ? Texto : Secundario,
        Margin = new Padding(3, 4, 3, 4),
    };

    public static void EstilizarGrade(DataGridView grid, bool editavel = false)
    {
        grid.Dock = DockStyle.Fill;
        grid.BackgroundColor = Cartao;
        grid.BorderStyle = BorderStyle.None;
        grid.GridColor = Borda;
        grid.EnableHeadersVisualStyles = false;
        grid.ColumnHeadersBorderStyle = DataGridViewHeaderBorderStyle.None;
        grid.ColumnHeadersDefaultCellStyle.BackColor = Color.FromArgb(251, 251, 253);
        grid.ColumnHeadersDefaultCellStyle.ForeColor = Secundario;
        grid.ColumnHeadersDefaultCellStyle.Font = new Font("Segoe UI", 8.5F, FontStyle.Bold);
        grid.ColumnHeadersDefaultCellStyle.SelectionBackColor = Color.FromArgb(251, 251, 253);
        grid.ColumnHeadersHeight = 32;
        grid.DefaultCellStyle.Font = Normal;
        grid.DefaultCellStyle.ForeColor = Texto;
        grid.DefaultCellStyle.SelectionBackColor = Color.FromArgb(231, 245, 239);
        grid.DefaultCellStyle.SelectionForeColor = Texto;
        grid.RowHeadersVisible = false;
        grid.RowTemplate.Height = 30;
        grid.AllowUserToAddRows = editavel;
        grid.AllowUserToDeleteRows = editavel;
        grid.AllowUserToResizeRows = false;
        grid.AllowUserToOrderColumns = false;
        grid.ReadOnly = !editavel;
        grid.MultiSelect = false;
        grid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
        grid.AutoGenerateColumns = false;
    }

    public static void Cabecalho(DataGridView grid, string titulo, int largura = 100, bool preencher = false)
    {
        grid.Columns.Add(new DataGridViewTextBoxColumn
        {
            HeaderText = titulo,
            Width = largura,
            SortMode = DataGridViewColumnSortMode.NotSortable,
            AutoSizeMode = preencher ? DataGridViewAutoSizeColumnMode.Fill : DataGridViewAutoSizeColumnMode.None,
        });
    }

    sealed class PainelArredondado : Panel
    {
        public int Raio { get; set; } = 14;
        protected override void OnResize(EventArgs eventargs)
        {
            base.OnResize(eventargs);
            if (Width < 1 || Height < 1) return;
            using var path = new GraphicsPath();
            var d = Raio * 2;
            path.AddArc(0, 0, d, d, 180, 90);
            path.AddArc(Width - d - 1, 0, d, d, 270, 90);
            path.AddArc(Width - d - 1, Height - d - 1, d, d, 0, 90);
            path.AddArc(0, Height - d - 1, d, d, 90, 90);
            path.CloseFigure();
            Region = new Region(path);
        }
    }
}

/// <summary>Formulário nativo reutilizável com o cabeçalho e os campos do diálogo aprovado.</summary>
sealed class DialogoDados : Form
{
    readonly Dictionary<string, TextBox> _campos = new(StringComparer.OrdinalIgnoreCase);
    public string Valor(string nome) => _campos.TryGetValue(nome, out var campo) ? campo.Text.Trim() : "";
    public bool Confirmado { get; private set; }

    public DialogoDados(string titulo, string subtitulo, IEnumerable<(string Rotulo, string Nome, string Valor)> campos, Size? tamanho = null)
    {
        Text = titulo;
        Font = TemaCrono.Normal;
        BackColor = TemaCrono.Fundo;
        StartPosition = FormStartPosition.CenterParent;
        FormBorderStyle = FormBorderStyle.Sizable;
        MinimizeBox = false;
        MaximizeBox = false;
        ShowInTaskbar = false;
        KeyPreview = true;
        ClientSize = tamanho ?? new Size(760, 450);
        MinimumSize = new Size(600, 360);
        KeyDown += (_, e) => { if (e.KeyCode == Keys.Escape) Close(); };

        var header = new Panel { Dock = DockStyle.Top, Height = 74, BackColor = Color.White, Padding = new Padding(20, 10, 20, 8) };
        header.Controls.Add(new Label { Text = titulo, Dock = DockStyle.Top, Height = 30, Font = new Font("Segoe UI", 15F, FontStyle.Bold), ForeColor = TemaCrono.Texto });
        header.Controls.Add(new Label { Text = subtitulo, Dock = DockStyle.Bottom, Height = 22, Font = TemaCrono.Pequena, ForeColor = TemaCrono.Secundario });
        Controls.Add(header);

        var body = new Panel { Dock = DockStyle.Fill, AutoScroll = true, Padding = new Padding(18) };
        var table = new TableLayoutPanel { Dock = DockStyle.Top, AutoSize = true, ColumnCount = 2, Padding = new Padding(12), BackColor = Color.White, Margin = new Padding(0) };
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        foreach (var field in campos)
        {
            var box = new TextBox { Dock = DockStyle.Bottom, Height = 32, Text = field.Valor ?? "", BorderStyle = BorderStyle.FixedSingle, Font = TemaCrono.Normal };
            _campos[field.Nome] = box;
            var cell = new Panel { Dock = DockStyle.Fill, Height = 64, Padding = new Padding(6, 5, 10, 3) };
            cell.Controls.Add(box);
            cell.Controls.Add(new Label { Text = field.Rotulo, Dock = DockStyle.Top, Height = 20, ForeColor = TemaCrono.Secundario, Font = new Font("Segoe UI", 8.5F, FontStyle.Bold) });
            table.Controls.Add(cell);
        }
        body.Controls.Add(table);
        Controls.Add(body);

        var footer = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 58, FlowDirection = FlowDirection.RightToLeft, Padding = new Padding(12, 10, 12, 8), BackColor = Color.White };
        var save = TemaCrono.Botao("Gravar e fechar", true); save.Click += (_, _) => { Confirmado = true; DialogResult = DialogResult.OK; Close(); };
        var cancel = TemaCrono.Botao("Cancelar"); cancel.Click += (_, _) => Close();
        footer.Controls.Add(save);
        footer.Controls.Add(cancel);
        Controls.Add(footer);
        AcceptButton = save;
    }
}
