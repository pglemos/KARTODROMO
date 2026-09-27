using System.ComponentModel;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Text;
using System.Text.Json.Nodes;

namespace Kartodromo.Comum;

/// <summary>Cores e fontes no padrao do LapTime Office (WinForms/Syncfusion claro).</summary>
public static class Tema
{
    public static readonly Font Normal = new("Segoe UI", 9F);
    public static readonly Font Negrito = new("Segoe UI", 9F, FontStyle.Bold);
    public static readonly Font Grande = new("Segoe UI", 12F, FontStyle.Bold);
    public static readonly Font Titulo = new("Segoe UI", 16F, FontStyle.Bold);
    public static readonly Color Fundo = Color.FromArgb(244, 244, 244);
    public static readonly Color Janela = Color.FromArgb(240, 240, 240);
    public static readonly Color Linha = Color.FromArgb(201, 201, 201);
    public static readonly Color Selecao = Color.FromArgb(204, 228, 247);
    public static readonly Color Azul = Color.FromArgb(0, 99, 177);
    public static readonly Color Verde = Color.FromArgb(16, 124, 16);
    public static readonly Color Vermelho = Color.FromArgb(196, 43, 28);
    public static readonly Color Cinza = Color.FromArgb(110, 110, 110);
}

public static class Msg
{
    public const string App = "Kartódromo - Módulo Office";
    /// <summary>Só para autoteste: quando definido, as mensagens são registradas em vez de abrir caixa modal.</summary>
    public static Action<string> Registro;
    public static void Info(IWin32Window dono, string texto, string titulo = App) { if (Registro != null) { Registro("INFO: " + texto); return; } MessageBox.Show(dono, texto, titulo, MessageBoxButtons.OK, MessageBoxIcon.Information); }
    public static void Aviso(IWin32Window dono, string texto, string titulo = "Atenção!") { if (Registro != null) { Registro("AVISO: " + texto); return; } MessageBox.Show(dono, texto, titulo, MessageBoxButtons.OK, MessageBoxIcon.Warning); }
    public static void Erro(IWin32Window dono, string texto, string titulo = "Atenção!") { if (Registro != null) { Registro("ERRO: " + texto); return; } MessageBox.Show(dono, texto, titulo, MessageBoxButtons.OK, MessageBoxIcon.Error); }
    public static bool Pergunta(IWin32Window dono, string texto, string titulo = "Atenção!") =>
        MessageBox.Show(dono, texto, titulo, MessageBoxButtons.YesNo, MessageBoxIcon.Question, MessageBoxDefaultButton.Button1) == DialogResult.Yes;
}

/// <summary>
/// Guarda os erros em %LOCALAPPDATA%Kartodromoerros.log (hora, programa, janela, mensagem e pilha).
/// Antes os erros só apareciam na caixa de mensagem e sumiam: ninguém sabia depois o que tinha acontecido no balcão.
/// </summary>
public static class Diagnostico
{
    static readonly object Trava = new();
    public static string Arquivo => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Kartodromo", "erros.log");

    public static void Registrar(Control onde, Exception e) => Registrar(onde?.FindForm()?.Text ?? onde?.Name ?? "", e);

    public static void Registrar(string onde, Exception e)
    {
        try
        {
            var linha = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} [{AppDomain.CurrentDomain.FriendlyName}] {onde}: {e.GetType().Name}: {e.Message}{Environment.NewLine}{e.StackTrace}{Environment.NewLine}";
            lock (Trava)
            {
                Directory.CreateDirectory(Path.GetDirectoryName(Arquivo)!);
                var info = new FileInfo(Arquivo);
                if (info.Exists && info.Length > 5_000_000) File.Move(Arquivo, Arquivo + ".antigo", true);
                File.AppendAllText(Arquivo, linha);
            }
        }
        catch { /* registrar erro nunca pode derrubar o programa */ }
    }
}

public static class Seguro
{
    /// <summary>Roda uma acao async mostrando erro da API numa MessageBox (sem derrubar o app).</summary>
    public static async void Rodar(Control dono, Func<Task> acao)
    {
        var form = dono?.FindForm();
        var cursor = form?.Cursor;
        try
        {
            if (form != null) form.Cursor = Cursors.WaitCursor;
            await acao();
        }
        catch (ApiException e) { Diagnostico.Registrar(form, e); Msg.Erro(form, e.Message); }
        catch (Exception e) { Diagnostico.Registrar(form, e); Msg.Erro(form, "Erro inesperado: " + e.Message); }
        finally { if (form != null && !form.IsDisposed) form.Cursor = cursor ?? Cursors.Default; }
    }
}

/// <summary>Janela padrao (Form do LapTime): fonte, cor, centralizada, Esc fecha.</summary>
public class Janela : Form
{
    public Janela(string titulo, int largura, int altura, bool redimensiona = false)
    {
        Text = titulo;
        Font = Tema.Normal;
        BackColor = Tema.Janela;
        StartPosition = FormStartPosition.CenterParent;
        ClientSize = new Size(largura, altura);
        FormBorderStyle = redimensiona ? FormBorderStyle.Sizable : FormBorderStyle.FixedDialog;
        MaximizeBox = redimensiona;
        MinimizeBox = false;
        ShowInTaskbar = false;
        KeyPreview = true;
        AutoScaleMode = AutoScaleMode.Dpi;
        Icon = Icone.App;
        KeyDown += (_, e) => { if (e.KeyCode == Keys.Escape && !e.Handled) { Close(); } };
    }

    /// <summary>Barra de botoes no rodape (alinhada a direita), com suporte a texto informativo à esquerda (Dialogo.dc.html).</summary>
    public Control Rodape(string textoEsquerda, params (string texto, EventHandler clique, bool principal)[] botoes)
    {
        var p = new Panel { Dock = DockStyle.Bottom, Height = 58, BackColor = Color.White };
        if (!string.IsNullOrEmpty(textoEsquerda))
        {
            var l = new Label { Name = "rodapeInfo", Text = textoEsquerda, Dock = DockStyle.Left, AutoSize = false, Width = 480, TextAlign = ContentAlignment.MiddleLeft, Padding = new Padding(18, 0, 0, 0), Font = new Font("Segoe UI", 9F), ForeColor = Color.FromArgb(110, 110, 115) };
            p.Controls.Add(l);
        }
        var flow = new FlowLayoutPanel { Dock = DockStyle.Right, AutoSize = true, FlowDirection = FlowDirection.RightToLeft, WrapContents = false, Padding = new Padding(0, 12, 18, 12) };
        foreach (var (t, c, principal) in botoes.Reverse())
        {
            var b = new Button { Text = t, AutoSize = true, MinimumSize = new Size(92, 34), Height = 34, Margin = new Padding(4, 0, 0, 0) };
            b.Click += c;
            if (principal) AcceptButton = b;
            flow.Controls.Add(b);
        }
        p.Controls.Add(flow);
        Controls.Add(p);
        return p;
    }

    public Control Rodape(params (string texto, EventHandler clique, bool principal)[] botoes) => Rodape(null, botoes);
}

/// <summary>Ajudantes pra montar formularios com rotulo em cima do campo.</summary>
public static class Campos
{
    public static TableLayoutPanel Grade(int colunas, params float[] pesos)
    {
        var t = new TableLayoutPanel { ColumnCount = colunas, AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink, Dock = DockStyle.Top, Padding = new Padding(0) };
        for (var i = 0; i < colunas; i++) t.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, pesos.Length > i ? pesos[i] : 100f / colunas));
        return t;
    }

    public static Panel Rotulo(string rotulo, Control campo)
    {
        var p = new Panel { Height = rotulo == null ? campo.Height + 4 : campo.Height + 20, Dock = DockStyle.Fill, Margin = new Padding(3, 2, 3, 2) };
        campo.Dock = DockStyle.Bottom;
        p.Controls.Add(campo);
        if (rotulo != null) p.Controls.Add(new Label { Text = rotulo, Dock = DockStyle.Top, Height = 17, ForeColor = Color.FromArgb(60, 60, 60) });
        return p;
    }

    public static void Add(TableLayoutPanel t, string rotulo, Control campo, int span = 1)
    {
        var p = Rotulo(rotulo, campo);
        t.Controls.Add(p);
        if (span > 1) t.SetColumnSpan(p, span);
    }

    public static TextBox Texto(int max = 200) => new() { MaxLength = max };
    public static ComboBox Combo(params string[] itens)
    {
        // lista com a cara do design (fundo branco, seta fina, sem o botão cinza do Windows)
        var c = new ListaDesign();
        c.Items.AddRange(itens);
        if (itens.Length > 0) c.SelectedIndex = 0;
        return c;
    }
    public static CheckBox Check(string texto, bool marcado = false) => new() { Text = texto, Checked = marcado, AutoSize = true, Height = 23 };
    public static DateTimePicker Data(DateTime? valor = null) => new() { Format = DateTimePickerFormat.Short, Value = valor ?? DateTime.Today };
    public static DateTimePicker Hora(DateTime? valor = null) => new() { Format = DateTimePickerFormat.Custom, CustomFormat = "HH:mm", ShowUpDown = true, Value = valor ?? DateTime.Today.AddHours(17) };
    public static NumericUpDown Num(int valor = 0, int min = 0, int max = 100000) => new() { Minimum = min, Maximum = max, Value = Math.Clamp(valor, min, max) };

    public static void Mascara(TextBox t, Func<string, string> fn)
    {
        var ocupado = false;
        t.TextChanged += (_, _) =>
        {
            if (ocupado) return;
            ocupado = true;
            var fim = t.SelectionStart == t.TextLength;
            t.Text = fn(t.Text);
            if (fim) t.SelectionStart = t.TextLength;
            ocupado = false;
        };
    }

    /// <summary>Item de combo com valor (id) e texto.</summary>
    public record Item(long Id, string Texto, JsonObject Dados = null)
    {
        public override string ToString() => Texto;
    }
    public static void Selecionar(ComboBox c, long? id)
    {
        foreach (var o in c.Items) if (o is Item it && it.Id == id) { c.SelectedItem = o; return; }
    }
    public static long? IdDe(ComboBox c) => c.SelectedItem is Item it ? it.Id : null;
}

public enum TipoCol { Texto, Dinheiro, DataHora, Data, Hora, Bool, Inteiro }

public record Col(string Chave, string Titulo, TipoCol Tipo = TipoCol.Texto, int Largura = 0, Func<JsonObject, object> Valor = null);

/// <summary>Grade no estilo SfDataGrid do LapTime: ordena, filtra por coluna, menu de contexto, exporta pro Excel.</summary>
public class Grade : DataGridView
{
    Col[] _cols = [];
    List<JsonObject> _todos = [];
    readonly Dictionary<string, string> _filtros = [];
    /// <summary>filtro por lista de valores (funil do cabeçalho, como no LapTime)</summary>
    readonly Dictionary<string, HashSet<string>> _valores = [];
    public Func<JsonObject, Color?> CorLinha { get; set; }
    public Func<List<JsonObject>, ToolStripItem[]> MenuDe { get; set; }
    public event Action<JsonObject> Duplo;
    public event Action FiltroMudou;
    public event Action ItemMarcadoMudou;
    public bool ComMarcacao { get; }

    public Grade(bool comMarcacao = false)
    {
        ComMarcacao = comMarcacao;
        Dock = DockStyle.Fill;
        BackgroundColor = Color.White;
        BorderStyle = BorderStyle.None;
        AllowUserToAddRows = false;
        AllowUserToDeleteRows = false;
        AllowUserToResizeRows = false;
        ReadOnly = !comMarcacao;
        RowHeadersVisible = false;
        SelectionMode = DataGridViewSelectionMode.FullRowSelect;
        MultiSelect = true;
        AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.None;
        ColumnHeadersHeightSizeMode = DataGridViewColumnHeadersHeightSizeMode.DisableResizing;
        ColumnHeadersHeight = 30;
        EnableHeadersVisualStyles = false;
        ColumnHeadersDefaultCellStyle.BackColor = Color.FromArgb(249, 249, 249);
        ColumnHeadersDefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleCenter;
        ColumnHeadersDefaultCellStyle.SelectionBackColor = Color.FromArgb(249, 249, 249);
        DefaultCellStyle.SelectionBackColor = Tema.Selecao;
        DefaultCellStyle.SelectionForeColor = Color.Black;
        AlternatingRowsDefaultCellStyle.BackColor = Color.FromArgb(251, 251, 251);
        GridColor = Color.FromArgb(237, 237, 237);
        RowTemplate.Height = 23;
        Font = Tema.Normal;
        DoubleBuffered = true;
        CellDoubleClick += (_, e) => { if (e.RowIndex >= 0 && Atual != null) Duplo?.Invoke(Atual); };
        CellMouseDown += (_, e) =>
        {
            if (e.Button != MouseButtons.Right) return;
            if (e.RowIndex < 0 && e.ColumnIndex >= 0) { MenuColuna(e.ColumnIndex); return; }
            if (e.RowIndex >= 0 && !Rows[e.RowIndex].Selected) { ClearSelection(); Rows[e.RowIndex].Selected = true; CurrentCell = Rows[e.RowIndex].Cells[Math.Max(0, e.ColumnIndex)]; }
        };
        MouseUp += (_, e) =>
        {
            if (e.Button != MouseButtons.Right || MenuDe == null) return;
            var hit = HitTest(e.X, e.Y);
            if (hit.RowIndex < 0 && hit.Type == DataGridViewHitTestType.ColumnHeader) return;
            var m = new ContextMenuStrip { Font = Tema.Normal };
            m.Items.AddRange(MenuDe(Selecionados));
            m.Show(this, e.Location);
        };
        DataError += (_, e) => e.ThrowException = false;
        CurrentCellDirtyStateChanged += (_, _) =>
        {
            if (IsCurrentCellDirty) CommitEdit(DataGridViewDataErrorContexts.Commit);
        };
        CellValueChanged += (_, e) =>
        {
            if (ComMarcacao && e.RowIndex >= 0 && e.ColumnIndex >= 0 && Columns[e.ColumnIndex].Name == "__sel")
                ItemMarcadoMudou?.Invoke();
        };

        // cabeçalho do design: sem divisórias, nome + seta da ordenação (verde) + funil logo depois do nome
        CellBorderStyle = DataGridViewCellBorderStyle.SingleHorizontal;
        ColumnHeadersBorderStyle = DataGridViewHeaderBorderStyle.None;
        CellPainting += (_, e) =>
        {
            if (e.RowIndex >= 0 && e.ColumnIndex >= 0)
            {
                // linhas do design: sem contorno nas células, só a linha fina embaixo
                // outro desenho (círculo do Pago, etiquetas) pode ter deixado o anti-serrilhado ligado: o fundo sairia com bordas cinza
                e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.None;
                var sel = (e.State & DataGridViewElementStates.Selected) != 0;
                using (var fundo = new SolidBrush(sel ? e.CellStyle.SelectionBackColor : e.CellStyle.BackColor)) e.Graphics.FillRectangle(fundo, e.CellBounds);
                e.PaintContent(e.CellBounds);
                using (var fina = new Pen(GridColor)) e.Graphics.DrawLine(fina, e.CellBounds.Left, e.CellBounds.Bottom - 1, e.CellBounds.Right, e.CellBounds.Bottom - 1);
                e.Handled = true;
                return;
            }
            if (e.RowIndex != -1 || e.ColumnIndex < 0) return;
            var g = e.Graphics; var r = e.CellBounds;
            g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.None;
            var estilo = Columns[e.ColumnIndex].HeaderCell.InheritedStyle;
            using (var fundo = new SolidBrush(estilo.BackColor)) g.FillRectangle(fundo, r);
            using (var linha = new Pen(Color.FromArgb(235, 235, 235))) g.DrawLine(linha, r.Left, r.Bottom - 1, r.Right, r.Bottom - 1);
            var col = Columns[e.ColumnIndex];
            var ordenada = SortedColumn == col && SortOrder != SortOrder.None;
            var texto = col.HeaderText + (ordenada ? (SortOrder == SortOrder.Ascending ? " ↑" : " ↓") : "");
            var cor = ordenada ? Color.FromArgb(11, 122, 83) : estilo.ForeColor;
            var (txt, funil) = AreasCabecalho(e.ColumnIndex, r, texto, estilo);
            TextRenderer.DrawText(g, texto, estilo.Font, txt, cor, TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix | TextFormatFlags.NoPadding |
                (estilo.Alignment is DataGridViewContentAlignment.MiddleRight ? TextFormatFlags.Right : estilo.Alignment is DataGridViewContentAlignment.MiddleCenter ? TextFormatFlags.HorizontalCenter : TextFormatFlags.Left));
            if (ColDe(e.ColumnIndex) is Col c && !funil.IsEmpty) FiltroColuna.Desenhar(g, funil, Filtrada(c.Chave), pequeno: true);
            e.Handled = true;
        };
        ColumnHeaderMouseClick += (_, e) =>
        {
            if (e.Button != MouseButtons.Left || ColDe(e.ColumnIndex) is not Col c) return;
            var col = Columns[e.ColumnIndex];
            var cel = GetCellDisplayRectangle(e.ColumnIndex, -1, false);
            if (NoFunil(e.ColumnIndex, new Point(cel.X + e.X, cel.Y + e.Y))) { AbrirFiltro(e.ColumnIndex); return; }
            var dir = SortedColumn == col && SortOrder == SortOrder.Ascending ? ListSortDirection.Descending : ListSortDirection.Ascending;
            Sort(col, dir);
        };
        MouseMove += (_, e) =>
        {
            var hit = HitTest(e.X, e.Y);
            var noFunil = hit.Type == DataGridViewHitTestType.ColumnHeader && ColDe(hit.ColumnIndex) != null && NoFunil(hit.ColumnIndex, e.Location);
            Cursor = noFunil ? Cursors.Hand : Cursors.Default;
        };
    }

    /// <summary>Onde fica o texto e o funil no cabeçalho: o funil logo depois do nome (ou antes, se a coluna é alinhada à direita).</summary>
    (Rectangle texto, Rectangle funil) AreasCabecalho(int colIndex, Rectangle r, string titulo, DataGridViewCellStyle estilo)
    {
        var pad = estilo.Padding;
        var util = new Rectangle(r.X + Math.Max(8, pad.Left), r.Y, Math.Max(0, r.Width - Math.Max(8, pad.Left) - Math.Max(8, pad.Right)), r.Height);
        if (ColDe(colIndex) is not Col cc || !ComFunil(cc) || util.Width < 30) return (util, Rectangle.Empty);
        var w = Math.Min(util.Width - 16, TextRenderer.MeasureText(titulo, estilo.Font, Size.Empty, TextFormatFlags.NoPadding | TextFormatFlags.NoPrefix).Width + 4);
        const int f = 16;
        if (estilo.Alignment == DataGridViewContentAlignment.MiddleRight)
            return (new Rectangle(util.Right - w, util.Y, w, util.Height), new Rectangle(util.Right - w - f, util.Y, f, util.Height));
        if (estilo.Alignment == DataGridViewContentAlignment.MiddleCenter)
        {
            var x0 = util.X + (util.Width - w - f) / 2;
            return (new Rectangle(x0, util.Y, w, util.Height), new Rectangle(x0 + w, util.Y, f, util.Height));
        }
        return (new Rectangle(util.X, util.Y, w, util.Height), new Rectangle(util.X + w, util.Y, f, util.Height));
    }

    bool NoFunil(int colIndex, Point p)
    {
        if (colIndex < 0 || ColDe(colIndex) == null) return false;
        var col = Columns[colIndex];
        var r = GetCellDisplayRectangle(colIndex, -1, false);
        var ordenada = SortedColumn == col && SortOrder != SortOrder.None;
        var texto = col.HeaderText + (ordenada ? (SortOrder == SortOrder.Ascending ? " ↑" : " ↓") : "");
        var (_, funil) = AreasCabecalho(colIndex, r, texto, col.HeaderCell.InheritedStyle);
        return !funil.IsEmpty && Rectangle.Inflate(funil, 3, 0).Contains(p);
    }

    /// <summary>No design o funil só aparece nas colunas de texto e de data (Pago, valores e quantidades não têm).</summary>
    static bool ComFunil(Col c) => c.Tipo is TipoCol.Texto or TipoCol.DataHora or TipoCol.Data or TipoCol.Hora;

    Col ColDe(int colIndex) => colIndex >= 0 && colIndex < Columns.Count ? _cols.FirstOrDefault(x => x.Chave == Columns[colIndex].Name) : null;
    bool Filtrada(string chave) => _filtros.ContainsKey(chave) || _valores.ContainsKey(chave);
    public bool TemFiltro => _filtros.Count > 0 || _valores.Count > 0;

    /// <summary>Texto da célula como aparece na tela (é o que a lista do filtro mostra).</summary>
    string TextoFiltro(JsonObject o, Col c) => Valor(o, c) switch
    {
        null => "",
        DateTime d => d.ToString(c.Tipo == TipoCol.Data ? "dd/MM/yyyy" : c.Tipo == TipoCol.Hora ? "HH:mm" : "dd/MM/yyyy HH:mm"),
        decimal m => m.ToString("N2", Fmt.Br),
        bool b => b ? "Sim" : "Não",
        var v => v.ToString()?.Trim() ?? "",
    };

    void AbrirFiltro(int colIndex)
    {
        if (ColDe(colIndex) is not Col c) return;
        // valores das linhas que passam nos OUTROS filtros (como no Excel)
        var valores = _todos.Where(o => Passa(o, c.Chave)).Select(o => TextoFiltro(o, c));
        var celula = GetCellDisplayRectangle(colIndex, -1, false);
        FiltroColuna.Abrir(this, celula, c.Titulo, valores, _valores.GetValueOrDefault(c.Chave), escolha =>
        {
            if (escolha == null) _valores.Remove(c.Chave); else _valores[c.Chave] = escolha;
            Redesenhar(); FiltroMudou?.Invoke();
        });
    }

    /// <summary>Filtra a coluna pelos valores (texto como aparece na tela); null limpa.</summary>
    public void Filtrar(string chave, IEnumerable<string> valores)
    {
        if (valores == null) _valores.Remove(chave); else _valores[chave] = valores.ToHashSet();
        Redesenhar(); FiltroMudou?.Invoke();
    }

    public void AbrirFiltro(string chave) { for (var i = 0; i < Columns.Count; i++) if (Columns[i].Name == chave) { AbrirFiltro(i); return; } }

    public void LimparFiltros()
    {
        _filtros.Clear(); _valores.Clear();
        Redesenhar(); FiltroMudou?.Invoke();
    }

    bool Passa(JsonObject o, string exceto = null) =>
        _valores.All(f => f.Key == exceto || _cols.FirstOrDefault(x => x.Chave == f.Key) is not Col c || f.Value.Contains(TextoFiltro(o, c)))
        && _filtros.All(f =>
        {
            if (f.Key == exceto || _cols.FirstOrDefault(x => x.Chave == f.Key) is not Col c) return true;
            var v = Valor(o, c);
            var txt = v switch { DateTime d => d.ToString("dd/MM/yyyy HH:mm"), decimal m => m.ToString("N2", Fmt.Br), bool b => b ? "sim" : "nao", _ => v?.ToString() };
            return Norm(txt).Contains(f.Value);
        });

    public void Colunas(params Col[] cols)
    {
        // trocou de lista: filtros da lista anterior não valem mais
        _filtros.Clear(); _valores.Clear();
        _cols = cols;
        Columns.Clear();
        if (ComMarcacao) Columns.Add(new DataGridViewCheckBoxColumn { Name = "__sel", HeaderText = "", Width = 28, ReadOnly = false });
        foreach (var c in cols)
        {
            DataGridViewColumn dc = c.Tipo == TipoCol.Bool ? new DataGridViewCheckBoxColumn() : new DataGridViewTextBoxColumn();
            dc.Name = c.Chave;
            dc.HeaderText = c.Titulo;
            dc.HeaderCell.Style.Padding = new Padding(4, 0, ComFunil(c) ? FiltroColuna.LarguraFunil : 4, 0);
            dc.ReadOnly = true;
            dc.SortMode = DataGridViewColumnSortMode.Programmatic;
            dc.Width = c.Largura > 0 ? c.Largura : c.Tipo switch { TipoCol.Bool => 55, TipoCol.Dinheiro => 100, TipoCol.DataHora => 118, TipoCol.Data => 90, TipoCol.Hora => 60, TipoCol.Inteiro => 80, _ => 150 };
            switch (c.Tipo)
            {
                case TipoCol.Dinheiro: dc.DefaultCellStyle.Format = "#,##0.00;-#,##0.00;—"; dc.DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleRight; dc.ValueType = typeof(decimal); break;
                case TipoCol.DataHora: dc.DefaultCellStyle.Format = "dd/MM/yyyy HH:mm"; dc.ValueType = typeof(DateTime); break;
                case TipoCol.Data: dc.DefaultCellStyle.Format = "dd/MM/yyyy"; dc.ValueType = typeof(DateTime); break;
                case TipoCol.Hora: dc.DefaultCellStyle.Format = "HH:mm"; dc.ValueType = typeof(DateTime); break;
                case TipoCol.Inteiro: dc.DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleRight; dc.ValueType = typeof(long); break;
                case TipoCol.Bool: dc.DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleCenter; break;
            }
            Columns.Add(dc);
        }
        if (Columns.Count > 0) Columns[^1].AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill;
    }

    object Valor(JsonObject o, Col c)
    {
        if (c.Valor != null) return c.Valor(o);
        return c.Tipo switch
        {
            TipoCol.Dinheiro => o.L(c.Chave) is long v ? v / 100m : null,
            TipoCol.DataHora or TipoCol.Data or TipoCol.Hora => o.D(c.Chave),
            TipoCol.Bool => o.B(c.Chave),
            TipoCol.Inteiro => o.L(c.Chave),
            _ => o.S(c.Chave),
        };
    }

    public void Carregar(IEnumerable<JsonObject> linhas)
    {
        var selIds = Selecionados.Select(x => x.S("id")).ToHashSet();
        _todos = linhas.ToList();
        Redesenhar(selIds);
    }

    void Redesenhar(HashSet<string> selIds = null)
    {
        var sortCol = SortedColumn;
        var sortDir = SortOrder;
        SuspendLayout();
        Rows.Clear();
        foreach (var o in Visiveis)
        {
            var vals = new List<object>();
            if (ComMarcacao) vals.Add(false);
            vals.AddRange(_cols.Select(c => Valor(o, c)));
            var i = Rows.Add(vals.ToArray());
            var r = Rows[i];
            r.Tag = o;
            var cor = CorLinha?.Invoke(o);
            if (cor != null) r.DefaultCellStyle.ForeColor = cor.Value;
        }
        if (sortCol != null && sortDir != SortOrder.None) Sort(sortCol, sortDir == SortOrder.Ascending ? ListSortDirection.Ascending : ListSortDirection.Descending);
        ClearSelection();
        if (selIds != null) foreach (DataGridViewRow r in Rows) if (selIds.Contains(((JsonObject)r.Tag).S("id"))) r.Selected = true;
        ResumeLayout();
        Invalidate();
    }

    static string Norm(string s) => new string((s ?? "").Normalize(NormalizationForm.FormD).Where(ch => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(ch) != System.Globalization.UnicodeCategory.NonSpacingMark).ToArray()).ToLowerInvariant();

    public List<JsonObject> Visiveis => _todos.Where(o => Passa(o)).ToList();

    public List<JsonObject> Todos => _todos;
    public JsonObject Atual => CurrentRow?.Tag as JsonObject ?? (SelectedRows.Count > 0 ? SelectedRows[0].Tag as JsonObject : null);
    public List<JsonObject> Selecionados => SelectedRows.Cast<DataGridViewRow>().OrderBy(r => r.Index).Select(r => r.Tag as JsonObject).Where(x => x != null).ToList();
    public List<JsonObject> Marcados => ComMarcacao ? Rows.Cast<DataGridViewRow>().Where(r => r.Cells["__sel"].Value is true).Select(r => (JsonObject)r.Tag).ToList() : Selecionados;
    public void MarcarTodos(bool v) { foreach (DataGridViewRow r in Rows) r.Cells["__sel"].Value = v; }

    public void Selecionar(Func<JsonObject, bool> fn)
    {
        ClearSelection();
        foreach (DataGridViewRow r in Rows)
            if (fn((JsonObject)r.Tag)) { r.Selected = true; CurrentCell = r.Cells[ComMarcacao ? 1 : 0]; break; }
    }

    void MenuColuna(int colIndex)
    {
        var nome = Columns[colIndex].Name;
        var c = _cols.FirstOrDefault(x => x.Chave == nome);
        if (c == null) return;
        var m = new ContextMenuStrip { Font = Tema.Normal };
        m.Items.Add("Filtrar esta coluna...", null, (_, _) => BeginInvoke(() => AbrirFiltro(colIndex)));
        m.Items.Add("Filtrar por texto (contém)...", null, (_, _) =>
        {
            var v = Prompt.Pedir(FindForm(), $"Mostrar só as linhas em que \"{c.Titulo}\" contém:", _filtros.GetValueOrDefault(c.Chave, ""), "Filtrar");
            if (v == null) return;
            if (string.IsNullOrWhiteSpace(v)) _filtros.Remove(c.Chave); else _filtros[c.Chave] = Norm(v.Trim());
            Redesenhar(); FiltroMudou?.Invoke();
        });
        m.Items.Add("Limpar filtro desta coluna", null, (_, _) => { _filtros.Remove(c.Chave); _valores.Remove(c.Chave); Redesenhar(); FiltroMudou?.Invoke(); }).Enabled = Filtrada(c.Chave);
        m.Items.Add("Limpar todos os filtros", null, (_, _) => LimparFiltros()).Enabled = TemFiltro;
        m.Show(this, PointToClient(Cursor.Position));
    }

    /// <summary>Exportar para Excel: CSV com ; e BOM (abre direto no Excel pt-BR).</summary>
    public void ExportarExcel(string nome)
    {
        using var d = new SaveFileDialog { FileName = $"{nome}-{DateTime.Now:yyyyMMdd-HHmm}.csv", Filter = "Planilha (*.csv)|*.csv" };
        if (d.ShowDialog(FindForm()) != DialogResult.OK) return;
        var sb = new StringBuilder();
        string Q(object v) => "\"" + (v switch { DateTime dt => dt.ToString("dd/MM/yyyy HH:mm"), decimal m => m.ToString("N2", Fmt.Br), bool b => b ? "Sim" : "Não", _ => v?.ToString() ?? "" }).Replace("\"", "\"\"") + "\"";
        sb.AppendLine(string.Join(";", _cols.Select(c => Q(c.Titulo))));
        foreach (var o in Visiveis) sb.AppendLine(string.Join(";", _cols.Select(c => Q(Valor(o, c)))));
        File.WriteAllText(d.FileName, sb.ToString(), new UTF8Encoding(true));
        Msg.Info(FindForm(), $"Arquivo {Path.GetFileName(d.FileName)} exportado com sucesso.");
    }
}

public static class Prompt
{
    public static string Pedir(IWin32Window dono, string texto, string valor = "", string titulo = "Kartódromo", bool senha = false)
    {
        using var f = new Janela(titulo, 420, 110);
        var l = new Label { Text = texto, Left = 12, Top = 12, Width = 396, Height = 18 };
        var t = new TextBox { Left = 12, Top = 34, Width = 396, Text = valor, UseSystemPasswordChar = senha };
        f.Controls.Add(l); f.Controls.Add(t);
        string r = null;
        f.Rodape(("Cancelar", (_, _) => f.Close(), false), ("OK", (_, _) => { r = t.Text; f.Close(); }, true));
        f.Shown += (_, _) => { t.Focus(); t.SelectAll(); };
        f.ShowDialog(dono);
        return r;
    }
}

/// <summary>Icones da barra: glifo da fonte de icones do Windows (Segoe MDL2) sobre quadrado colorido.</summary>
public static class Icone
{
    static Icon _app;
    public static Icon App
    {
        get
        {
            if (_app != null) return _app;
            try { _app = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { _app = SystemIcons.Application; }
            return _app;
        }
    }

    public static Bitmap Tile(string glifo, Color cor, int tam = 32, string fonte = "Segoe MDL2 Assets")
    {
        var bmp = new Bitmap(tam, tam);
        using var g = Graphics.FromImage(bmp);
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
        using var path = new GraphicsPath();
        var r = tam / 5;
        path.AddArc(0, 0, r, r, 180, 90); path.AddArc(tam - r - 1, 0, r, r, 270, 90); path.AddArc(tam - r - 1, tam - r - 1, r, r, 0, 90); path.AddArc(0, tam - r - 1, r, r, 90, 90); path.CloseFigure();
        using (var lg = new LinearGradientBrush(new Rectangle(0, 0, tam, tam), ControlPaint.Light(cor, .25f), ControlPaint.Dark(cor, .05f), 90f)) g.FillPath(lg, path);
        // MDL2 só tem os ícones da área privada (U+E000–U+F8FF); letras e símbolos comuns (■ ↻ ✉ W) viravam quadradinho
        if (fonte == "Segoe MDL2 Assets" && !string.IsNullOrEmpty(glifo) && (glifo[0] < 0xE000 || glifo[0] > 0xF8FF)) fonte = char.IsLetterOrDigit(glifo[0]) ? "Segoe UI Semibold" : "Segoe UI Symbol";
        using var f = new Font(fonte, tam * 0.5f, GraphicsUnit.Pixel);
        using var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
        g.DrawString(glifo, f, Brushes.White, new RectangleF(0, 1, tam, tam), sf);
        return bmp;
    }

    /// <summary>Bolinha colorida das arvores do LapTime (amarela/verde/vermelha/azul).</summary>
    public static Bitmap Bola(Color cor, int tam = 16)
    {
        var bmp = new Bitmap(tam, tam);
        using var g = Graphics.FromImage(bmp);
        g.SmoothingMode = SmoothingMode.AntiAlias;
        using var path = new GraphicsPath();
        path.AddEllipse(1, 1, tam - 3, tam - 3);
        using var pg = new PathGradientBrush(path) { CenterColor = ControlPaint.LightLight(cor), SurroundColors = [ControlPaint.Dark(cor, .1f)], CenterPoint = new PointF(tam * .38f, tam * .32f) };
        g.FillPath(pg, path);
        return bmp;
    }

    public static Image Logo()
    {
        var s = typeof(Icone).Assembly.GetManifestResourceStream("Kartodromo.Comum.Recursos.logo.png");
        return s == null ? null : Image.FromStream(s);
    }
}
