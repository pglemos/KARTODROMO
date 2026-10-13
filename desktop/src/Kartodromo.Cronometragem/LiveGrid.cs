using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

/// <summary>Grade somente-leitura atualizada "no lugar" (sem piscar nem perder rolagem/selecao) a cada leitura do servidor.</summary>
public class LiveGrid : DataGridView
{
    public Func<int, int, Color?> CorTexto { get; set; }
    /// <summary>Célula destacada (ex.: melhor volta da prova): ganha o marcador ■ na cor do texto, porque o destaque
    /// nunca pode ser só a cor (docs/design-system/01-fundamentos/acessibilidade.md).</summary>
    public Func<int, int, bool> Destaque { get; set; }
    public Func<int, Color?> CorFundo { get; set; }
    public Func<int, Color?> CorGrupo { get; set; }
    public Func<int, Color?> CorFonteLinha { get; set; }
    public Func<int, bool> SeparadorAntes { get; set; }
    public List<object> Chaves { get; } = [];
    /// <summary>Lista longa (passagens da corrida): a acessibilidade do Windows vê a grade como uma tabela com resumo,
    /// sem expor célula por célula. Um leitor de tela/controle de tela que percorre a árvore inteira fazia o app gastar
    /// um núcleo inteiro com 2.000+ passagens (medido em 09/10/2026 com dotnet-stack).</summary>
    public bool AcessibilidadeResumida { get; set; }
    /// <summary>Colunas com funil de filtro (como o Nº e o Transponder no LapTime) e os valores escolhidos.</summary>
    readonly HashSet<int> _filtraveis = [];
    readonly Dictionary<int, HashSet<string>> _filtros = [];
    IList<object[]> _linhas = [];
    IList<object> _chavesTodas;
    /// <summary>O que está na tela agora (já filtrado), para reconhecer "só chegaram linhas novas no topo".</summary>
    IList<object[]> _mostradas = [];
    int _hoverRow = -1;
    static readonly Color SelecaoPadrao = Color.FromArgb(204, 228, 247);

    public LiveGrid()
    {
        Dock = DockStyle.Fill;
        BackgroundColor = Tokens.Primitivo.Branco;
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
        ColumnHeadersDefaultCellStyle.Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno);
        DefaultCellStyle.SelectionBackColor = SelecaoPadrao;
        DefaultCellStyle.SelectionForeColor = Color.Black;
        DefaultCellStyle.BackColor = Tokens.Primitivo.Branco;
        AlternatingRowsDefaultCellStyle.BackColor = Color.FromArgb(248, 248, 250);
        DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleCenter;
        GridColor = Color.FromArgb(225, 225, 225);
        RowTemplate.Height = 25;
        Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo);
        DoubleBuffered = true;
        CellFormatting += (_, e) =>
        {
            if (e.RowIndex < 0) return;
            var fundo = CorFundo?.Invoke(e.RowIndex);
            var grupo = CorGrupo?.Invoke(e.RowIndex);
            var baseFundo = fundo ?? grupo ?? (e.RowIndex % 2 == 0 ? Tokens.Primitivo.Branco : Color.FromArgb(248, 248, 250));
            if (fundo is null && grupo is null && e.RowIndex == _hoverRow) baseFundo = Color.FromArgb(232, 244, 238);
            // cor própria da célula (selo de status, bloco dentro da meta na equalização) vale mais que a zebra da linha:
            // sem isso o "EQUALIZADO"/"REVISAR" ficava letra branca em fundo branco
            if (fundo is null && e.ColumnIndex >= 0 && Rows[e.RowIndex].Cells[e.ColumnIndex].HasStyle && Rows[e.RowIndex].Cells[e.ColumnIndex].Style.BackColor is { IsEmpty: false } propria) baseFundo = propria;
            e.CellStyle.BackColor = baseFundo;
            // a tela escolheu a cor da seleção (Eventos: verde com letra branca; TemaCrono: verde-claro, como no canvas):
            // vale ela. Antes toda seleção virava "fundo 5% mais escuro" = cinza, diferente das pranchas.
            if (fundo is null && DefaultCellStyle.SelectionBackColor != SelecaoPadrao)
            {
                e.CellStyle.SelectionBackColor = DefaultCellStyle.SelectionBackColor;
                e.CellStyle.SelectionForeColor = DefaultCellStyle.SelectionForeColor;
            }
            else e.CellStyle.SelectionBackColor = ControlPaint.Dark(baseFundo, .05f);
            var fonte = CorFonteLinha?.Invoke(e.RowIndex);
            var txt = CorTexto?.Invoke(e.RowIndex, e.ColumnIndex) ?? fonte;
            if (txt is Color t) { e.CellStyle.ForeColor = t; e.CellStyle.SelectionForeColor = t; }
        };
        CellPainting += (_, e) =>
        {
            var separador = e.RowIndex >= 0 && e.ColumnIndex >= 0 && SeparadorAntes?.Invoke(e.RowIndex) == true;
            var destaque = e.RowIndex >= 0 && e.ColumnIndex >= 0 && Destaque?.Invoke(e.RowIndex, e.ColumnIndex) == true;
            if (separador || destaque)
            {
                e.Paint(e.ClipBounds, DataGridViewPaintParts.All);
                if (separador)
                {
                    using var linha = new Pen(Color.FromArgb(170, 170, 175), 2);
                    var y = e.CellBounds.Top + 1;
                    e.Graphics.DrawLine(linha, e.CellBounds.Left, y, e.CellBounds.Right, y);
                }
                if (destaque)
                {
                    using var marca = new SolidBrush(e.CellStyle.ForeColor);
                    e.Graphics.FillRectangle(marca, e.CellBounds.Left + 5, e.CellBounds.Top + (e.CellBounds.Height - 6) / 2, 6, 6);
                }
                e.Handled = true;
                return;
            }
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
            var novoHover = hit.RowIndex >= 0 && hit.RowIndex < Rows.Count ? hit.RowIndex : -1;
            if (novoHover != _hoverRow)
            {
                var anterior = _hoverRow;
                _hoverRow = novoHover;
                if (anterior >= 0 && anterior < Rows.Count) InvalidateRow(anterior);
                if (_hoverRow >= 0) InvalidateRow(_hoverRow);
            }
            Cursor = hit.Type == DataGridViewHitTestType.ColumnHeader && _filtraveis.Contains(hit.ColumnIndex) ? Cursors.Hand : Cursors.Default;
        };
        MouseLeave += (_, _) =>
        {
            var anterior = _hoverRow;
            _hoverRow = -1;
            if (anterior >= 0 && anterior < Rows.Count) InvalidateRow(anterior);
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
        // coluna de texto à esquerda: o título também (centralizado ele ficava solto no meio, longe do texto)
        // (com filtro fica centralizado: o funil vai na ponta direita e, com o título à esquerda, parecia ser da coluna seguinte)
        if (alinhamento == DataGridViewContentAlignment.MiddleLeft && !filtro) c.HeaderCell.Style.Alignment = DataGridViewContentAlignment.MiddleLeft;
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
        // passagem nova chega no TOPO: antes cada linha antiga "descia" uma posição e TODAS as células eram reescritas
        // (com 400+ passagens e o Windows avisando a acessibilidade a cada célula, a tela travava). Agora só as linhas
        // novas entram no topo; as antigas ficam como estão.
        var novasNoTopo = Rows.Count == _mostradas.Count ? LinhasNovasNoTopo(_mostradas, linhas) : 0;
        if (novasNoTopo > 0)
        {
            Rows.Insert(0, novasNoTopo);
            for (var r = 0; r < novasNoTopo; r++) Escrever(Rows[r], linhas[r]);
        }
        else
        {
            if (Rows.Count > linhas.Count) { while (Rows.Count > linhas.Count) Rows.RemoveAt(Rows.Count - 1); }
            if (Rows.Count < linhas.Count) Rows.Add(linhas.Count - Rows.Count);
            for (var r = 0; r < linhas.Count; r++) Escrever(Rows[r], linhas[r]);
        }
        _mostradas = linhas;
        Chaves.Clear();
        if (chaves != null) Chaves.AddRange(chaves);
        if (sel != null)
        {
            var idx = Chaves.FindIndex(chave => ReferenceEquals(chave, sel) || identidade != null && Identidade(chave) == identidade);
            // a mesma linha já está marcada: não desmarca e remarca (cada troca de seleção também vira aviso de acessibilidade)
            var jaMarcada = idx >= 0 && idx < Rows.Count && CurrentRow?.Index == idx && Rows[idx].Selected && SelectedRows.Count == 1;
            if (!jaMarcada)
            {
                ClearSelection();
                if (idx >= 0 && idx < Rows.Count)
                {
                    try { CurrentCell = Rows[idx].Cells[0]; Rows[idx].Selected = true; } catch { /* linha invisivel */ }
                }
            }
        }
        else if (SelectedRows.Count > 0) ClearSelection();
        if (topo >= 0 && topo < Rows.Count) { try { FirstDisplayedScrollingRowIndex = topo; } catch { /* sem rolagem */ } }
        ResumeLayout();
        Invalidate();
    }

    protected override AccessibleObject CreateAccessibilityInstance() =>
        AcessibilidadeResumida ? new ResumoAcessivel(this) : base.CreateAccessibilityInstance();

    sealed class ResumoAcessivel(LiveGrid grade) : ControlAccessibleObject(grade)
    {
        public override AccessibleRole Role => AccessibleRole.Table;
        public override string Name => string.IsNullOrEmpty(grade.AccessibleName) ? "Lista" : grade.AccessibleName;
        public override string Value => $"{grade.Rows.Count} linhas" + (grade.Rows.Count > 0 ? ": " + string.Join(" · ", grade.Rows[0].Cells.Cast<DataGridViewCell>().Where(c => c.Visible).Select(c => c.Value)) : "");
        public override int GetChildCount() => 0;
        public override AccessibleObject GetChild(int index) => null;
    }

    void Escrever(DataGridViewRow row, object[] linha)
    {
        for (var c = 0; c < Columns.Count && c < linha.Length; c++)
        {
            var v = linha[c]?.ToString() ?? "";
            if (!Equals(row.Cells[c].Value, v)) row.Cells[c].Value = v;
        }
    }

    /// <summary>Quantas linhas novas entraram no topo, com todas as antigas iguais logo abaixo (0 = mudou outra coisa).</summary>
    internal static int LinhasNovasNoTopo(IList<object[]> antes, IList<object[]> agora)
    {
        var k = agora.Count - antes.Count;
        if (antes.Count == 0 || k <= 0 || k > 50) return 0;
        for (var i = 0; i < antes.Count; i++)
        {
            var a = antes[i]; var b = agora[i + k];
            if (a.Length != b.Length) return 0;
            for (var c = 0; c < a.Length; c++)
                if ((a[c]?.ToString() ?? "") != (b[c]?.ToString() ?? "")) return 0;
        }
        return k;
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
        ForeColor = Tokens.Primitivo.Branco;
        Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno, FontStyle.Bold);
        TextAlign = ContentAlignment.MiddleCenter;
    }
}
