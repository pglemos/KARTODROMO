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
    public static void Info(IWin32Window dono, string texto, string titulo = App) => MessageBox.Show(dono, texto, titulo, MessageBoxButtons.OK, MessageBoxIcon.Information);
    public static void Aviso(IWin32Window dono, string texto, string titulo = "Atenção!") => MessageBox.Show(dono, texto, titulo, MessageBoxButtons.OK, MessageBoxIcon.Warning);
    public static void Erro(IWin32Window dono, string texto, string titulo = "Atenção!") => MessageBox.Show(dono, texto, titulo, MessageBoxButtons.OK, MessageBoxIcon.Error);
    public static bool Pergunta(IWin32Window dono, string texto, string titulo = "Atenção!") =>
        MessageBox.Show(dono, texto, titulo, MessageBoxButtons.YesNo, MessageBoxIcon.Question, MessageBoxDefaultButton.Button1) == DialogResult.Yes;
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
        catch (ApiException e) { Msg.Erro(form, e.Message); }
        catch (Exception e) { Msg.Erro(form, "Erro inesperado: " + e.Message); }
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

    /// <summary>Barra de botoes no rodape (alinhada a direita), como os dialogos do LapTime.</summary>
    public FlowLayoutPanel Rodape(params (string texto, EventHandler clique, bool principal)[] botoes)
    {
        var p = new FlowLayoutPanel { Dock = DockStyle.Bottom, FlowDirection = FlowDirection.RightToLeft, Height = 42, Padding = new Padding(8, 7, 8, 7) };
        foreach (var (t, c, principal) in botoes.Reverse())
        {
            var b = new Button { Text = t, AutoSize = true, MinimumSize = new Size(96, 27), Margin = new Padding(4, 0, 0, 0) };
            b.Click += c;
            if (principal) AcceptButton = b;
            p.Controls.Add(b);
        }
        Controls.Add(p);
        return p;
    }
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
        var c = new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList };
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
    public Func<JsonObject, Color?> CorLinha { get; set; }
    public Func<List<JsonObject>, ToolStripItem[]> MenuDe { get; set; }
    public event Action<JsonObject> Duplo;
    public event Action FiltroMudou;
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
    }

    public void Colunas(params Col[] cols)
    {
        _cols = cols;
        Columns.Clear();
        if (ComMarcacao) Columns.Add(new DataGridViewCheckBoxColumn { Name = "__sel", HeaderText = "", Width = 28, ReadOnly = false });
        foreach (var c in cols)
        {
            DataGridViewColumn dc = c.Tipo == TipoCol.Bool ? new DataGridViewCheckBoxColumn() : new DataGridViewTextBoxColumn();
            dc.Name = c.Chave;
            dc.HeaderText = c.Titulo + "  ▽";
            dc.ReadOnly = true;
            dc.SortMode = DataGridViewColumnSortMode.Automatic;
            dc.Width = c.Largura > 0 ? c.Largura : c.Tipo switch { TipoCol.Bool => 55, TipoCol.Dinheiro => 100, TipoCol.DataHora => 118, TipoCol.Data => 90, TipoCol.Hora => 60, TipoCol.Inteiro => 80, _ => 150 };
            switch (c.Tipo)
            {
                case TipoCol.Dinheiro: dc.DefaultCellStyle.Format = "N2"; dc.DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleRight; dc.ValueType = typeof(decimal); break;
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
        foreach (DataGridViewColumn dc in Columns)
        {
            var c = _cols.FirstOrDefault(x => x.Chave == dc.Name);
            if (c != null) dc.HeaderText = c.Titulo + (_filtros.ContainsKey(c.Chave) ? "  ▼" : "  ▽");
        }
        ResumeLayout();
    }

    static string Norm(string s) => new string((s ?? "").Normalize(NormalizationForm.FormD).Where(ch => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(ch) != System.Globalization.UnicodeCategory.NonSpacingMark).ToArray()).ToLowerInvariant();

    public List<JsonObject> Visiveis => _todos.Where(o => _filtros.All(f =>
    {
        var c = _cols.First(x => x.Chave == f.Key);
        var v = Valor(o, c);
        var txt = v switch { DateTime d => d.ToString("dd/MM/yyyy HH:mm"), decimal m => m.ToString("N2", Fmt.Br), bool b => b ? "sim" : "nao", _ => v?.ToString() };
        return Norm(txt).Contains(f.Value);
    })).ToList();

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
        m.Items.Add("Filtrar esta coluna...", null, (_, _) =>
        {
            var v = Prompt.Pedir(FindForm(), $"Mostrar só as linhas em que \"{c.Titulo}\" contém:", _filtros.GetValueOrDefault(c.Chave, ""), "Filtrar");
            if (v == null) return;
            if (string.IsNullOrWhiteSpace(v)) _filtros.Remove(c.Chave); else _filtros[c.Chave] = Norm(v.Trim());
            Redesenhar(); FiltroMudou?.Invoke();
        });
        m.Items.Add("Limpar filtros", null, (_, _) => { _filtros.Clear(); Redesenhar(); FiltroMudou?.Invoke(); }).Enabled = _filtros.Count > 0;
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
