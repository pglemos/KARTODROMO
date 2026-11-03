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
    public static readonly Color Fundo = Tokens.Fundo;
    public static readonly Color Janela = Color.FromArgb(240, 240, 240);
    public static readonly Color Linha = Tokens.Linha;
    public static readonly Color Selecao = Color.FromArgb(204, 228, 247);
    public static readonly Color Azul = Color.FromArgb(0, 99, 177);
    public static readonly Color Verde = Tokens.Verde;
    public static readonly Color Vermelho = Color.FromArgb(196, 43, 28);
    public static readonly Color Cinza = Tokens.TextoSecundario;
}

public static class Msg
{
    public const string App = "Kartódromo - Módulo Office";
    /// <summary>Só para autoteste: quando definido, as mensagens são registradas em vez de abrir caixa modal.</summary>
    public static Action<string> Registro;
    /// <summary>No autoteste toda confirmação responde "Não" (nada é gravado) e fica registrada.</summary>
    static bool Nao(string texto)
    {
        var sim = Responder?.Invoke(texto) == true;
        Registro($"PERGUNTA (respondido {(sim ? "Sim" : "Não")}): " + texto);
        return sim;
    }
    /// <summary>Só para roteiros do autoteste que gravam de propósito: decide a resposta de cada confirmação.</summary>
    public static Func<string, bool> Responder;
    public static void Info(IWin32Window dono, string texto, string titulo = App) { if (Registro != null) { Registro("INFO: " + texto); return; } Mostrar(dono, titulo == App ? "Informação" : titulo, texto, Estado.Info, MessageBoxIcon.Information); }
    public static void Sucesso(IWin32Window dono, string texto, string titulo = "Concluído") { if (Registro != null) { Registro("INFO: " + texto); return; } Mostrar(dono, titulo, texto, Estado.Sucesso, MessageBoxIcon.Information); }
    public static void Aviso(IWin32Window dono, string texto, string titulo = "Atenção!") { if (Registro != null) { Registro("AVISO: " + texto); return; } Mostrar(dono, titulo, texto, Estado.Aviso, MessageBoxIcon.Warning); }
    public static void Erro(IWin32Window dono, string texto, string titulo = "Atenção!") { if (Registro != null) { Registro("ERRO: " + texto); return; } Mostrar(dono, titulo, texto, Estado.Perigo, MessageBoxIcon.Error); }
    public static bool ErroComRetry(IWin32Window dono, string texto, string titulo = "Não foi possível concluir")
    {
        if (Registro != null) { Registro("ERRO: " + texto); return false; }
        texto += "\n\nTente novamente. Se o problema persistir, verifique a conexão ou acione o suporte.";
        return Desenhado(() => DialogoMensagem.Mostrar(dono, titulo, texto, Estado.Perigo, "&Tentar de novo", "&Fechar"),
            () => MessageBox.Show(dono, texto, titulo, MessageBoxButtons.RetryCancel, MessageBoxIcon.Error, MessageBoxDefaultButton.Button1) == DialogResult.Retry);
    }
    public static bool Pergunta(IWin32Window dono, string texto, string titulo = "Atenção!") =>
        Registro != null ? Nao(texto) : Desenhado(() => DialogoMensagem.Mostrar(dono, titulo, texto, Estado.Neutro, "&Sim", "&Não"),
            () => MessageBox.Show(dono, texto, titulo, MessageBoxButtons.YesNo, MessageBoxIcon.Question, MessageBoxDefaultButton.Button1) == DialogResult.Yes);

    /// <summary>Confirmação de ação destrutiva (docs/design-system/03-componentes/confirmacao-destrutiva.md): título com o
    /// objeto ("Excluir a observação?"), texto com o item e a consequência, botão vermelho com o verbo ("Excluir observação")
    /// e foco inicial em Cancelar — Enter sem pensar não apaga nada.</summary>
    public static bool Confirmar(IWin32Window dono, string titulo, string texto, string rotuloAcao)
    {
        if (Registro != null) return Nao(titulo + " " + texto);
        return Desenhado(() => DialogoMensagem.Mostrar(dono, titulo, texto, Estado.Perigo, rotuloAcao, "Cancelar", perigo: true, focoNoSecundario: true),
            () => MessageBox.Show(dono, texto, titulo, MessageBoxButtons.YesNo, MessageBoxIcon.Warning, MessageBoxDefaultButton.Button2) == DialogResult.Yes);
    }

    static void Mostrar(IWin32Window dono, string titulo, string texto, Estado estado, MessageBoxIcon icone) =>
        Desenhado(() => DialogoMensagem.Mostrar(dono, titulo, texto, estado, "OK"), () => { MessageBox.Show(dono, texto, titulo, MessageBoxButtons.OK, icone); return true; });

    /// <summary>A mensagem desenhada nunca pode impedir o aviso: se falhar, usa a caixa do Windows.</summary>
    static bool Desenhado(Func<bool> desenhado, Func<bool> windows)
    {
        try { return desenhado(); }
        catch (Exception e) { Diagnostico.Registrar("Msg", e); return windows(); }
    }
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
    /// <summary>Roda uma ação async sem derrubar o app e oferece recuperação no próprio erro.
    /// <paramref name="silencioso"/>: atualização automática (timer) — não mexe no ponteiro nem abre janela de erro.</summary>
    public static async void Rodar(Control dono, Func<Task> acao, bool silencioso = false)
    {
        var form = dono?.FindForm();
        var espera = form != null && !silencioso;
        while (true)
        {
            Exception erro;
            if (espera) Ocupar(form!, +1);
            try
            {
                await acao();
                return;
            }
            catch (Exception e) { erro = e; }
            finally { if (espera) Ocupar(form!, -1); }
            Diagnostico.Registrar(form, erro);
            if (silencioso) return;
            if (!Msg.ErroComRetry(form, ApiException.Motivo(erro, erro is ApiException ? "Não foi possível concluir a operação." : "O sistema encontrou um erro inesperado."))) return;
        }
    }

    // Ponteiro de espera por contagem: com duas operações ao mesmo tempo, a que termina por último volta a seta.
    // (Antes cada uma guardava "o cursor de antes" — a segunda guardava o de espera e deixava o ponteiro girando para sempre.)
    sealed class Contador { public int N; }
    static readonly System.Runtime.CompilerServices.ConditionalWeakTable<Form, Contador> Ocupados = new();

    static void Ocupar(Form form, int delta)
    {
        if (form.IsDisposed) return;
        var c = Ocupados.GetOrCreateValue(form);
        c.N = Math.Max(0, c.N + delta);
        form.Cursor = c.N > 0 ? Cursors.WaitCursor : Cursors.Default;
    }
}

/// <summary>Janela antiga (Form do LapTime). NÃO USE em tela nova: use <see cref="DialogoDesign"/> (design system, fase 1).
/// Desde 10/10/2026 nenhuma tela usa mais esta classe; fica só para não quebrar código de fora.</summary>
[Obsolete("Use DialogoDesign (docs/design-system/03-componentes/modal-e-dialogo.md).")]
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
        AccessibleRole = AccessibleRole.Window;
        AccessibleName = titulo;
        Icon = Icone.App;
        KeyDown += (_, e) => { if (e.KeyCode == Keys.Escape && !e.Handled) { Close(); } };
    }

    /// <summary>Barra de botoes no rodape (alinhada a direita), com suporte a texto informativo à esquerda (Dialogo.dc.html).</summary>
    public Control Rodape(string textoEsquerda, params (string texto, EventHandler clique, bool principal)[] botoes)
    {
        var p = new Panel { Dock = DockStyle.Bottom, Height = 58, BackColor = Tokens.Primitivo.Branco };
        if (!string.IsNullOrEmpty(textoEsquerda))
        {
            var l = new Label { Name = "rodapeInfo", Text = textoEsquerda, Dock = DockStyle.Left, AutoSize = false, Width = 480, TextAlign = ContentAlignment.MiddleLeft, Padding = new Padding(18, 0, 0, 0), Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno), ForeColor = Tokens.TextoSecundario };
            p.Controls.Add(l);
        }
        var flow = new FlowLayoutPanel { Dock = DockStyle.Right, AutoSize = true, FlowDirection = FlowDirection.RightToLeft, WrapContents = false, Padding = new Padding(0, 12, 18, 12) };
        foreach (var (t, c, principal) in botoes.Reverse())
        {
            var b = new BotaoPlano { Text = t, AutoSize = true, MinimumSize = new Size(92, 34), Height = 34, Margin = new Padding(4, 0, 0, 0), TabStop = true, AccessibleRole = AccessibleRole.PushButton, AccessibleName = t };
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
            var pos = t.SelectionStart;
            var textoAntes = t.Text;
            var textoNovo = fn(textoAntes);
            if (textoNovo != textoAntes)
            {
                var fim = pos >= textoAntes.Length;
                var rawAntes = 0;
                for (int i = 0; i < Math.Min(pos, textoAntes.Length); i++)
                {
                    if (char.IsLetterOrDigit(textoAntes[i])) rawAntes++;
                }
                t.Text = textoNovo;
                if (fim)
                {
                    t.SelectionStart = t.TextLength;
                }
                else
                {
                    var novoPos = 0;
                    var rawCont = 0;
                    while (novoPos < textoNovo.Length && rawCont < rawAntes)
                    {
                        if (char.IsLetterOrDigit(textoNovo[novoPos])) rawCont++;
                        novoPos++;
                    }
                    t.SelectionStart = Math.Min(novoPos, t.TextLength);
                }
            }
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

/// <summary>Célula de cabeçalho usada pela coluna de marcação em <see cref="Grade"/>.</summary>
public sealed class GradeSelectionHeaderCell : DataGridViewColumnHeaderCell { }

/// <summary>Grade no estilo SfDataGrid do LapTime: ordena, filtra por coluna, menu de contexto, exporta pro Excel.</summary>
public class Grade : DataGridView
{
    Col[] _cols = [];
    List<JsonObject> _todos = [];
    readonly Dictionary<string, string> _filtros = [];
    /// <summary>filtro por lista de valores (funil do cabeçalho, como no LapTime)</summary>
    readonly Dictionary<string, HashSet<string>> _valores = [];
    public Func<JsonObject, Color?> CorLinha { get; set; }
    /// <summary>Mensagem no meio da lista quando não há linhas (antes: área branca que parecia travada).</summary>
    public string Vazio { get; set; } = "Não há registros para este filtro.";
    bool _carregando;
    public bool Carregando { get => _carregando; set { _carregando = value; Invalidate(); } }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        if (Carregando)
        {
            var topoCarregando = ColumnHeadersVisible ? ColumnHeadersHeight : 0;
            var areaCarregando = new Rectangle(12, topoCarregando + 24, ClientSize.Width - 24, 44);
            using var fonteCarregando = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo, FontStyle.Italic);
            TextRenderer.DrawText(e.Graphics, "Carregando…", fonteCarregando, areaCarregando, Tokens.TextoSecundario,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.Top | TextFormatFlags.WordBreak);
            return;
        }
        if (Rows.Count > 0 || string.IsNullOrEmpty(Vazio)) return;
        var topo = ColumnHeadersVisible ? ColumnHeadersHeight : 0;
        var area = new Rectangle(0, topo + 24, ClientSize.Width, 44);
        using var f = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo);
        TextRenderer.DrawText(e.Graphics, Vazio, f, area, Tokens.TextoSecundario, TextFormatFlags.HorizontalCenter | TextFormatFlags.Top | TextFormatFlags.WordBreak);
    }
    public Func<List<JsonObject>, ToolStripItem[]> MenuDe { get; set; }
    public event Action<JsonObject> Duplo;
    public event Action FiltroMudou;
    public event Action ItemMarcadoMudou;
    public bool ComMarcacao { get; }

    public Grade(bool comMarcacao = false)
    {
        ComMarcacao = comMarcacao;
        AccessibleRole = AccessibleRole.Table;
        AccessibleName = "Tabela de registros";
        AccessibleDescription = comMarcacao ? "Use a caixa no cabeçalho para selecionar todas as linhas visíveis." : "Tabela de registros navegável por teclado.";
        Dock = DockStyle.Fill;
        BackgroundColor = Tokens.Primitivo.Branco;
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
        GridColor = Tokens.Linha;
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
            {
                ItemMarcadoMudou?.Invoke();
                AtualizarCabecalhoMarcacao();
            }
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
            using (var linha = new Pen(Tokens.Linha)) g.DrawLine(linha, r.Left, r.Bottom - 1, r.Right, r.Bottom - 1);
            var col = Columns[e.ColumnIndex];
            if (ComMarcacao && col.Name == "__sel")
            {
                e.PaintBackground(e.CellBounds, true);
                var tamanho = 14;
                var caixa = new Rectangle(r.X + (r.Width - tamanho) / 2, r.Y + (r.Height - tamanho) / 2, tamanho, tamanho);
                if (EstadoMarcacao == CheckState.Checked)
                    ControlPaint.DrawCheckBox(g, caixa, ButtonState.Checked);
                else
                {
                    ControlPaint.DrawCheckBox(g, caixa, ButtonState.Normal);
                    if (EstadoMarcacao == CheckState.Indeterminate)
                    {
                        using var pincel = new SolidBrush(Tokens.Verde);
                        g.FillRectangle(pincel, caixa.X + 3, caixa.Y + caixa.Height / 2 - 1, caixa.Width - 6, 3);
                    }
                }
                using (var linha = new Pen(Tokens.Linha)) g.DrawLine(linha, r.Left, r.Bottom - 1, r.Right, r.Bottom - 1);
                e.Handled = true;
                return;
            }
            var ordenada = SortedColumn == col && SortOrder != SortOrder.None;
            var texto = col.HeaderText + (ordenada ? (SortOrder == SortOrder.Ascending ? " ↑" : " ↓") : "");
            var cor = ordenada ? Tokens.Verde : estilo.ForeColor;
            var (txt, funil) = AreasCabecalho(e.ColumnIndex, r, texto, estilo);
            TextRenderer.DrawText(g, texto, estilo.Font, txt, cor, TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix | TextFormatFlags.NoPadding |
                (estilo.Alignment is DataGridViewContentAlignment.MiddleRight ? TextFormatFlags.Right : estilo.Alignment is DataGridViewContentAlignment.MiddleCenter ? TextFormatFlags.HorizontalCenter : TextFormatFlags.Left));
            if (ColDe(e.ColumnIndex) is Col c && !funil.IsEmpty) FiltroColuna.Desenhar(g, funil, Filtrada(c.Chave), pequeno: true);
            e.Handled = true;
        };
        ColumnHeaderMouseClick += (_, e) =>
        {
            if (e.Button != MouseButtons.Left) return;
            if (ComMarcacao && e.ColumnIndex >= 0 && e.ColumnIndex < Columns.Count && Columns[e.ColumnIndex].Name == "__sel")
            {
                MarcarTodos(EstadoMarcacao != CheckState.Checked);
                return;
            }
            if (ColDe(e.ColumnIndex) is not Col c) return;
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
        if (_filtros.Count == 0 && _valores.Count == 0) return;   // nada a limpar (ex.: ao abrir, a grade nem tem colunas ainda)
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

    /// <summary>Muda a cada vez que as colunas são refeitas (quem ajusta o visual das colunas só precisa refazer nessa hora).</summary>
    public int VersaoColunas { get; private set; }
    string _assinaturaColunas;

    public void Colunas(params Col[] cols)
    {
        // mesmas colunas (recarga da mesma lista, ex.: a sincronização de 10 s da Recepção): não refaz nada — refazer
        // apagava os filtros, a ordenação e as larguras ajustadas e deixava a lista vazia até os dados chegarem
        var assinatura = string.Join("|", cols.Select(c => $"{c.Chave}:{c.Titulo}:{c.Tipo}:{c.Largura}"));
        if (assinatura == _assinaturaColunas && Columns.Count > 0) { _cols = cols; return; }
        _assinaturaColunas = assinatura;
        VersaoColunas++;
        _assinaturaDados = null;
        // trocou de lista: filtros da lista anterior não valem mais
        _filtros.Clear(); _valores.Clear();
        _cols = cols;
        AccessibleName = $"Tabela de registros com {cols.Length} colunas";
        Columns.Clear();
        if (ComMarcacao)
        {
            var selecao = new DataGridViewCheckBoxColumn
            {
                Name = "__sel",
                HeaderText = "",
                Width = 28,
                ReadOnly = false,
                HeaderCell = new GradeSelectionHeaderCell { ToolTipText = "Selecionar todas as linhas visíveis" },
            };
            selecao.DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleCenter;
            Columns.Add(selecao);
        }
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

    string _assinaturaDados;

    public void Carregar(IEnumerable<JsonObject> linhas)
    {
        var lista = linhas.ToList();
        // recarga sem mudança nenhuma (o mais comum na sincronização automática): não redesenha, nada pisca nem rola
        var assinatura = string.Join("\n", lista.Select(o => o.ToJsonString()));
        if (assinatura == _assinaturaDados && Rows.Count == Visiveis.Count) { _todos = lista; return; }
        _assinaturaDados = assinatura;
        var selIds = Selecionados.Select(x => x.S("id")).ToHashSet();
        _todos = lista;
        Redesenhar(selIds);
    }

    void Redesenhar(HashSet<string> selIds = null)
    {
        var sortCol = SortedColumn;
        var sortDir = SortOrder;
        // guarda onde a pessoa estava: a lista se atualiza sozinha e não pode voltar para o topo nem perder a linha atual
        var primeira = FirstDisplayedScrollingRowIndex;
        var atualId = Atual?.S("id");
        var colunaAtual = CurrentCell?.ColumnIndex ?? -1;
        var rolagemLateral = HorizontalScrollingOffset;
        SuspendLayout();
        Rows.Clear();
        var novas = new List<DataGridViewRow>();
        foreach (var o in Visiveis)
        {
            var vals = new List<object>();
            if (ComMarcacao) vals.Add(false);
            vals.AddRange(_cols.Select(c => Valor(o, c)));
            var r = (DataGridViewRow)RowTemplate.Clone();   // molde da tela (altura da linha etc.), como o Rows.Add fazia
            r.CreateCells(this, vals.ToArray());
            r.Tag = o;
            var cor = CorLinha?.Invoke(o);
            if (cor != null) r.DefaultCellStyle.ForeColor = cor.Value;
            novas.Add(r);
        }
        // de uma vez (linha a linha refazia o layout a cada Add); AddRange vazio numa grade ainda sem colunas dá exceção
        if (novas.Count > 0 && Columns.Count > 0) Rows.AddRange(novas.ToArray());
        if (sortCol != null && sortDir != SortOrder.None) Sort(sortCol, sortDir == SortOrder.Ascending ? ListSortDirection.Ascending : ListSortDirection.Descending);
        if (atualId != null && colunaAtual >= 0 && colunaAtual < Columns.Count)
            foreach (DataGridViewRow r in Rows)
                if (((JsonObject)r.Tag).S("id") == atualId && Columns[colunaAtual].Visible) { CurrentCell = r.Cells[colunaAtual]; break; }
        ClearSelection();
        if (selIds != null) foreach (DataGridViewRow r in Rows) if (selIds.Contains(((JsonObject)r.Tag).S("id"))) r.Selected = true;
        if (primeira >= 0 && Rows.Count > 0) FirstDisplayedScrollingRowIndex = Math.Min(primeira, Rows.Count - 1);
        if (rolagemLateral > 0) HorizontalScrollingOffset = rolagemLateral;
        ResumeLayout();
        AtualizarCabecalhoMarcacao();
        Invalidate();
    }

    static string Norm(string s) => new string((s ?? "").Normalize(NormalizationForm.FormD).Where(ch => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(ch) != System.Globalization.UnicodeCategory.NonSpacingMark).ToArray()).ToLowerInvariant();

    public List<JsonObject> Visiveis => _todos.Where(o => Passa(o)).ToList();

    public List<JsonObject> Todos => _todos;
    public JsonObject Atual => CurrentRow?.Tag as JsonObject ?? (SelectedRows.Count > 0 ? SelectedRows[0].Tag as JsonObject : null);
    public List<JsonObject> Selecionados => SelectedRows.Cast<DataGridViewRow>().OrderBy(r => r.Index).Select(r => r.Tag as JsonObject).Where(x => x != null).ToList();
    public List<JsonObject> Marcados => ComMarcacao ? Rows.Cast<DataGridViewRow>().Where(Marcada).Select(r => r.Tag as JsonObject).Where(x => x != null).ToList() : Selecionados;
    CheckState EstadoMarcacao => !ComMarcacao || Rows.Count == 0
        ? CheckState.Unchecked
        : Rows.Cast<DataGridViewRow>().Where(r => !r.IsNewRow).All(Marcada)
            ? CheckState.Checked
            : Rows.Cast<DataGridViewRow>().Where(r => !r.IsNewRow).Any(Marcada) ? CheckState.Indeterminate : CheckState.Unchecked;

    static bool Marcada(DataGridViewRow r)
    {
        try { return Convert.ToBoolean(r.Cells["__sel"].Value ?? false); }
        catch { return false; }
    }

    void AtualizarCabecalhoMarcacao()
    {
        if (ComMarcacao && Columns.Count > 0 && IsHandleCreated) InvalidateColumn(0);
    }

    public void MarcarTodos(bool v)
    {
        if (!ComMarcacao) return;
        foreach (DataGridViewRow r in Rows)
            if (!r.IsNewRow) r.Cells["__sel"].Value = v;
        AtualizarCabecalhoMarcacao();
        Invalidate();
    }

    /// <summary>Alterna todas as linhas atualmente visíveis, inclusive a primeira.</summary>
    public void AlternarMarcacaoTodos() => MarcarTodos(EstadoMarcacao != CheckState.Checked);

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
    /// <summary>Pede um texto numa janela no visual padrão (DialogoDesign: ícone, campo com rótulo, OK à direita).
    /// Enter confirma, Esc cancela (devolve null).</summary>
    public static string Pedir(IWin32Window dono, string texto, string valor = "", string titulo = "Kartódromo", bool senha = false)
    {
        using var f = new DialogoDesign(titulo, texto, "M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z",
            "linear-gradient(180deg, #34C759, #0B7A53)", 560, 300); // design-lint-ignore: degradê do ícone (Forma.Tile lê CSS)
        var t = new TextBox { Text = valor, UseSystemPasswordChar = senha, BorderStyle = BorderStyle.None, AccessibleName = texto };
        f.Campo(f.Secao(null), texto, t, 6);
        string r = null;
        var ok = f.BotaoRodape("OK", true, () => { r = t.Text; f.Close(); });
        f.BotaoRodape("Cancelar", false, f.Close);
        f.AcceptButton = ok;
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
