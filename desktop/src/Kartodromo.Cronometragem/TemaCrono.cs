using System.Drawing.Drawing2D;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

static class TemaCrono
{
    public static readonly Color Fundo = Tokens.Claro.CorFundoApp;
    public static readonly Color Cartao = Tokens.Claro.CorSuperficiePadrao;
    public static readonly Color Texto = Tokens.Claro.CorTextoPrincipal;
    public static readonly Color Secundario = Tokens.Claro.CorTextoSecundario;
    public static readonly Color Verde = Tokens.Claro.CorAcaoPrincipal;
    public static readonly Color Azul = Tokens.Claro.CorDominioBandeiraAzul;
    public static readonly Color Vermelho = Tokens.Claro.CorEstadoPerigoSolido;
    public static readonly Color Borda = Tokens.Claro.CorBordaSutil;
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
            cab.Controls.Add(new Label { Text = titulo, Dock = subtitulo == null ? DockStyle.Fill : DockStyle.Top, Height = 24, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo, FontStyle.Bold), ForeColor = Texto, TextAlign = ContentAlignment.MiddleLeft });
            if (subtitulo != null) cab.Controls.Add(new Label { Text = subtitulo, Dock = DockStyle.Bottom, Height = 20, Font = Pequena, ForeColor = Secundario, TextAlign = ContentAlignment.MiddleLeft });
            card.Controls.Add(cab);
        }
        return card;
    }

    public static Button Botao(string texto, bool primario = false, Color? cor = null)
    {
        var color = cor ?? (primario ? Verde : Color.FromArgb(242, 242, 247));
        var b = new Kartodromo.Comum.BotaoPlano
        {
            Text = texto,
            AutoSize = true,
            MinimumSize = new Size(72, 32),
            FlatStyle = FlatStyle.Flat,
            BackColor = color,
            ForeColor = primario || cor != null ? Tokens.Primitivo.Branco : Texto,
            Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno, primario ? FontStyle.Bold : FontStyle.Regular),
            Padding = new Padding(8, 1, 8, 1),
            Margin = new Padding(3),
            Cursor = Cursors.Hand,
        };
        b.FlatAppearance.BorderSize = 0;
        b.FlatAppearance.MouseOverBackColor = ControlPaint.Light(color, .08f);
        return b;
    }

    /// <summary>Rótulo de operação: o tamanho (pt, como antes) vai para o degrau mais próximo da escala oficial.</summary>
    public static Label Rotulo(string texto, int tamanho = 10, bool forte = false) => new()
    {
        Text = texto,
        AutoSize = true,
        Font = Tokens.Fonte(tamanho <= 9 ? Tokens.Claro.FonteTamanhoPequeno : Tokens.Claro.FonteTamanhoCorpo, forte ? FontStyle.Bold : FontStyle.Regular),
        ForeColor = forte ? Texto : Secundario,
        Margin = new Padding(3, 4, 3, 4),
    };

    public static void EstilizarGrade(DataGridView grid, bool editavel = false)
    {
        grid.Dock = DockStyle.Fill;
        grid.BackgroundColor = Cartao;
        grid.BorderStyle = BorderStyle.None;
        grid.GridColor = Color.FromArgb(240, 240, 242);
        grid.CellBorderStyle = DataGridViewCellBorderStyle.SingleHorizontal;
        grid.EnableHeadersVisualStyles = false;
        grid.ColumnHeadersBorderStyle = DataGridViewHeaderBorderStyle.None;
        grid.ColumnHeadersDefaultCellStyle.BackColor = Color.FromArgb(251, 251, 253);
        grid.ColumnHeadersDefaultCellStyle.ForeColor = Secundario;
        grid.ColumnHeadersDefaultCellStyle.Font = Tokens.FonteSemibold(Tokens.Claro.FonteTamanhoPequeno);
        grid.ColumnHeadersDefaultCellStyle.SelectionBackColor = Color.FromArgb(251, 251, 253);
        grid.ColumnHeadersHeight = 30;
        grid.DefaultCellStyle.Font = Normal;
        grid.DefaultCellStyle.ForeColor = Texto;
        grid.DefaultCellStyle.SelectionBackColor = Color.FromArgb(226, 239, 234);
        grid.DefaultCellStyle.SelectionForeColor = Texto;
        grid.RowHeadersVisible = false;
        grid.RowTemplate.Height = 33;
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

    public sealed class PainelArredondado : Panel
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
/// <summary>Janela de campos (ex.: penalidade, editar bateria) no visual padrão do sistema — é um <see cref="DialogoDesign"/>
/// (cabeçalho com ícone, seção branca arredondada, campos com rótulo, Gravar/Cancelar no rodapé). Mesma API de antes
/// (<see cref="Valor"/>, <see cref="Confirmado"/>), então as chamadas não mudam. Enter grava, Esc fecha.</summary>
sealed class DialogoDados : DialogoDesign
{
    const string IconeEditar = "M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z";
    const string CorIcone = "linear-gradient(180deg, #34C759, #0B7A53)"; // design-lint-ignore: o mesmo degradê dos outros diálogos (Forma.Tile lê CSS)
    readonly Dictionary<string, TextBox> _campos = new(StringComparer.OrdinalIgnoreCase);
    public string Valor(string nome) => _campos.TryGetValue(nome, out var campo) ? campo.Text.Trim() : "";
    public bool Confirmado { get; private set; }

    public DialogoDados(string titulo, string subtitulo, IEnumerable<(string Rotulo, string Nome, string Valor)> campos, Size? tamanho = null)
        : base(titulo, subtitulo, IconeEditar, CorIcone, Math.Max(600, (tamanho ?? new Size(760, 450)).Width), Math.Max(360, (tamanho ?? new Size(760, 450)).Height + 60))
    {
        var lista = campos.ToList();
        var grade = Secao(null);
        // 2 colunas (como antes); um campo só ocupa a linha inteira
        foreach (var field in lista)
        {
            var box = new TextBox { Text = field.Valor ?? "", BorderStyle = BorderStyle.None, AccessibleName = field.Rotulo };
            _campos[field.Nome] = box;
            Campo(grade, field.Rotulo, box, lista.Count == 1 ? 6 : 3);
        }
        // rodapé da direita para a esquerda: o principal primeiro fica na ponta direita, como nas outras janelas
        var gravar = BotaoRodape("Gravar e fechar", true, () => { Confirmado = true; DialogResult = DialogResult.OK; Close(); });
        BotaoRodape("Cancelar", false, Close);
        AcceptButton = gravar;
        Shown += (_, _) => { if (_campos.Values.FirstOrDefault() is { } primeiro) { primeiro.Focus(); primeiro.SelectAll(); } };
    }
}
