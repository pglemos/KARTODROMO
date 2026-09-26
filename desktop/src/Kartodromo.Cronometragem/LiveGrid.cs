namespace Kartodromo.Cronometragem;

/// <summary>Grade somente-leitura atualizada "no lugar" (sem piscar nem perder rolagem/selecao) a cada leitura do servidor.</summary>
public class LiveGrid : DataGridView
{
    public Func<int, int, Color?> CorTexto { get; set; }
    public Func<int, Color?> CorFundo { get; set; }
    public Func<int, Color?> CorFonteLinha { get; set; }
    public List<object> Chaves { get; } = [];

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
    }

    public LiveGrid Col(string titulo, int largura, DataGridViewContentAlignment alinhamento = DataGridViewContentAlignment.MiddleCenter, bool preenche = false)
    {
        var c = new DataGridViewTextBoxColumn { HeaderText = titulo, SortMode = DataGridViewColumnSortMode.NotSortable, Width = largura };
        c.DefaultCellStyle.Alignment = alinhamento;
        if (preenche) { c.AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill; c.MinimumWidth = largura; }
        Columns.Add(c);
        return this;
    }

    /// <summary>Troca o conteudo mantendo a rolagem; so escreve celulas que mudaram.</summary>
    public void Preencher(IList<object[]> linhas, IList<object> chaves = null)
    {
        var sel = CurrentRow?.Index is int i && i < Chaves.Count ? Chaves[i] : null;
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
            var idx = Chaves.IndexOf(sel);
            if (idx >= 0 && idx < Rows.Count && (CurrentRow == null || CurrentRow.Index != idx)) { try { CurrentCell = Rows[idx].Cells[0]; } catch { /* linha invisivel */ } }
        }
        else ClearSelection();
        if (topo >= 0 && topo < Rows.Count) { try { FirstDisplayedScrollingRowIndex = topo; } catch { /* sem rolagem */ } }
        ResumeLayout();
        Invalidate();
    }

    public object ChaveAtual => CurrentRow?.Index is int i && i < Chaves.Count && CurrentRow.Selected ? Chaves[i] : null;
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
