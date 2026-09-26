using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

/// <summary>Grade somente-leitura atualizada "no lugar" (sem piscar nem perder rolagem/selecao) a cada leitura do servidor.</summary>
public class LiveGrid : DataGridView
{
    public Func<int, int, Color?> CorTexto { get; set; }
    public Func<int, Color?> CorFundo { get; set; }
    public Func<int, Color?> CorFonteLinha { get; set; }
    public List<object> Chaves { get; } = [];
    /// <summary>Colunas com funil de filtro (como o Nº e o Transponder no LapTime) e os valores escolhidos.</summary>
    readonly HashSet<int> _filtraveis = [];
    readonly Dictionary<int, HashSet<string>> _filtros = [];
    IList<object[]> _linhas = [];
    IList<object> _chavesTodas;

    public LiveGrid()
    {
        Dock = DockStyle.Fill;
        BackgroundColor = Color.White;
        BorderStyle = BorderStyle.None;
        AllowUserToAddRows = AllowUserToDeleteRows = AllowUserToResizeRows = false;
        AllowUserToOrderColumns = false;
        ReadOnly = true;
        RowHeadersVisible = false;
        SelectionMode = DataGridViewSelectionMode.FullRowSelect;
        MultiSelect = false;
        EnableHeadersVisualStyles = false;
        ColumnHeadersHeightSizeMode = DataGridViewColumnHeadersHeightSizeMode.DisableResizing;
        ColumnHeadersHeight = 28;
        ColumnHeadersDefaultCellStyle.BackColor = Color.FromArgb(249, 249, 249);
        ColumnHeadersDefaultCellStyle.SelectionBackColor = Color.FromArgb(249, 249, 249);
        ColumnHeadersDefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleCenter;
        ColumnHeadersDefaultCellStyle.Font = new Font("Segoe UI", 9F);
        DefaultCellStyle.SelectionBackColor = Color.FromArgb(204, 228, 247);
        DefaultCellStyle.SelectionForeColor = Color.Black;
        DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleCenter;
        GridColor = Color.FromArgb(225, 225, 225);
        RowTemplate.Height = 25;
        Font = new Font("Segoe UI", 9.5F);
        DoubleBuffered = true;
        CellFormatting += (_, e) =>
        {
            if (e.RowIndex < 0) return;
            var fundo = CorFundo?.Invoke(e.RowIndex);
            if (fundo is Color f) { e.CellStyle.BackColor = f; e.CellStyle.SelectionBackColor = ControlPaint.Dark(f, .05f); }
            var fonte = CorFonteLinha?.Invoke(e.RowIndex);
            var txt = CorTexto?.Invoke(e.RowIndex, e.ColumnIndex) ?? fonte;
            if (txt is Color t) { e.CellStyle.ForeColor = t; e.CellStyle.SelectionForeColor = t; }
        };
        CellPainting += (_, e) =>
        {
            if (e.RowIndex != -1 || !_filtraveis.Contains(e.ColumnIndex)) return;
            e.Paint(e.ClipBounds, DataGridViewPaintParts.All);
            FiltroColuna.Desenhar(e.Graphics, e.CellBounds, _filtros.ContainsKey(e.ColumnIndex));
            e.Handled = true;
        };
        ColumnHeaderMouseClick += (_, e) =>
        {
            if (e.Button == MouseButtons.Left && _filtraveis.Contains(e.ColumnIndex)) AbrirFiltro(e.ColumnIndex);
        };
        MouseMove += (_, e) =>
        {
            var hit = HitTest(e.X, e.Y);
            Cursor = hit.Type == DataGridViewHitTestType.ColumnHeader && _filtraveis.Contains(hit.ColumnIndex) ? Cursors.Hand : Cursors.Default;
        };
    }

    public bool TemFiltro => _filtros.Count > 0;

    void AbrirFiltro(int col)
    {
        var valores = Enumerable.Range(0, _linhas.Count).Where(i => Passa(_linhas[i], col)).Select(i => Texto(_linhas[i], col));
        FiltroColuna.Abrir(this, GetCellDisplayRectangle(col, -1, false), Columns[col].HeaderText, valores, _filtros.GetValueOrDefault(col), escolha =>
        {
            if (escolha == null) _filtros.Remove(col); else _filtros[col] = escolha;
            Preencher(_linhas, _chavesTodas);
            Invalidate();
        });
    }

    static string Texto(object[] linha, int col) => col < linha.Length ? linha[col]?.ToString()?.Trim() ?? "" : "";
    bool Passa(object[] linha, int exceto = -1) => _filtros.All(f => f.Key == exceto || f.Value.Contains(Texto(linha, f.Key)));

    public LiveGrid Col(string titulo, int largura, DataGridViewContentAlignment alinhamento = DataGridViewContentAlignment.MiddleCenter, bool preenche = false, bool filtro = false)
    {
        var c = new DataGridViewTextBoxColumn { HeaderText = titulo, SortMode = DataGridViewColumnSortMode.NotSortable, Width = largura };
        c.DefaultCellStyle.Alignment = alinhamento;
        if (filtro)
        {
            _filtraveis.Add(Columns.Count);
            c.HeaderCell.Style.Padding = new Padding(0, 0, FiltroColuna.LarguraFunil, 0);
            c.Width += 14;
        }
        if (preenche) { c.AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill; c.MinimumWidth = largura; }
        Columns.Add(c);
        return this;
    }

    /// <summary>Troca o conteudo mantendo a rolagem; so escreve celulas que mudaram.</summary>
    public void Preencher(IList<object[]> linhas, IList<object> chaves = null)
    {
        _linhas = linhas; _chavesTodas = chaves;
        if (_filtros.Count > 0)
        {
            var manter = Enumerable.Range(0, linhas.Count).Where(i => Passa(linhas[i])).ToList();
            linhas = manter.Select(i => linhas[i]).ToList();
            if (chaves != null) chaves = manter.Where(i => i < chaves.Count).Select(i => chaves[i]).ToList();
        }
        var sel = ChaveAtual;
        var identidade = Identidade(sel);
        var topo = FirstDisplayedScrollingRowIndex;
        SuspendLayout();
        if (Rows.Count > linhas.Count) { while (Rows.Count > linhas.Count) Rows.RemoveAt(Rows.Count - 1); }
        if (Rows.Count < linhas.Count) Rows.Add(linhas.Count - Rows.Count);
        for (var r = 0; r < linhas.Count; r++)
        {
            var row = Rows[r];
            for (var c = 0; c < Columns.Count && c < linhas[r].Length; c++)
            {
                var v = linhas[r][c]?.ToString() ?? "";
                if (!Equals(row.Cells[c].Value, v)) row.Cells[c].Value = v;
            }
        }
        Chaves.Clear();
        if (chaves != null) Chaves.AddRange(chaves);
        if (sel != null)
        {
            var idx = Chaves.FindIndex(chave => ReferenceEquals(chave, sel) || identidade != null && Identidade(chave) == identidade);
            ClearSelection();
            if (idx >= 0 && idx < Rows.Count)
            {
                try { CurrentCell = Rows[idx].Cells[0]; Rows[idx].Selected = true; } catch { /* linha invisivel */ }
            }
        }
        else ClearSelection();
        if (topo >= 0 && topo < Rows.Count) { try { FirstDisplayedScrollingRowIndex = topo; } catch { /* sem rolagem */ } }
        ResumeLayout();
        Invalidate();
    }

    public object ChaveAtual => CurrentRow?.Index is int i && i < Chaves.Count && CurrentRow.Selected ? Chaves[i] : null;

    static string Identidade(object chave)
    {
        if (chave is not JsonObject registro) return null;
        foreach (var campo in new[] { "id", "kart", "transponder" })
            if (registro[campo]?.ToString() is { Length: > 0 } valor) return campo + ":" + valor;
        return null;
    }
}

/// <summary>Faixa colorida de titulo (ex.: "REGISTRO DE PASSAGENS" em verde, como no LapTime).</summary>
public class Faixa : Label
{
    public Faixa(string texto, Color cor)
    {
        Text = texto;
        Dock = DockStyle.Top;
        Height = 24;
        BackColor = cor;
        ForeColor = Color.White;
        Font = new Font("Segoe UI", 9F, FontStyle.Bold);
        TextAlign = ContentAlignment.MiddleCenter;
    }
}
