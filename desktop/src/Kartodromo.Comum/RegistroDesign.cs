using System.Drawing.Drawing2D;
using System.Net;
using System.Text;
using System.Text.Json.Nodes;

namespace Kartodromo.Comum;

/// <summary>Campo do formulário do cadastro. Tipos: text, int, money, bool, select, lista, date, time, password.
/// Em "select" as opções podem ser "valor=Texto" (grava o valor, mostra o texto).</summary>
public record CampoReg(string Chave, string Rotulo, int Span = 2, string Tipo = "text", string[] Opcoes = null, Func<IEnumerable<Campos.Item>> Itens = null);

/// <summary>Coluna da lista. Largura 0 = ocupa o que sobra (minmax(0, 1fr) do design). Alinha: 'E' esquerda, 'C' centro, 'D' direita.</summary>
public record ColunaReg(string Titulo, int Largura, Func<JsonObject, string> Texto, char Alinha = 'E');

/// <summary>De onde vêm e para onde vão os registros.</summary>
public class FonteReg
{
    public Func<Task<List<JsonObject>>> Listar { get; init; }
    public Func<JsonObject, Task<JsonNode>> Incluir { get; init; }
    public Func<JsonObject, JsonObject, Task<JsonNode>> Alterar { get; init; }
    public Func<JsonObject, Task<JsonNode>> Excluir { get; init; }

    /// <summary>API REST padrão: GET base, POST base, PUT base/id, DELETE base/id.</summary>
    public static FonteReg Rest(Api api, string url) => new()
    {
        Listar = () => api.Lista(url),
        Incluir = b => api.Post(url, b),
        Alterar = (r, b) => api.Put($"{url}/{r.S("id")}", b),
        Excluir = r => api.Delete($"{url}/{r.S("id")}"),
    };
}

/// <summary>
/// Janela de cadastro do design aprovado (Cadastro.dc.html, 1060×680): cabeçalho com ícone, título, estado
/// (Editando/Incluindo), pesquisa e ✕; faixa branca com os campos (6 colunas); a lista em cartão com
/// "Registro X de Y"; rodapé com « ‹ › », + Novo, Editar, Excluir, Cancelar, Imprimir, Importar, Exportar,
/// Fechar e Gravar e fechar. Clicar numa linha carrega o registro nos campos para alterar.
/// </summary>
public class RegistroDesign : CartaoModal
{
    public static readonly Color Fundo = Color.FromArgb(245, 245, 247);
    static readonly Color Cinza = Color.FromArgb(110, 110, 115);
    static readonly Color BotaoCinza = Color.FromArgb(239, 239, 240); // rgba(118,118,128,0.12) sobre branco
    static readonly Color Vermelho = Color.FromArgb(196, 40, 28);
    const int L = 1060, A = 680, M = 18;

    readonly string _titulo;
    readonly CampoReg[] _campos;
    readonly ColunaReg[] _cols;
    readonly FonteReg _fonte;
    readonly Dictionary<string, Control> _c = [];
    readonly Label _estado = new() { AutoSize = false, Font = new Font("Segoe UI Semibold", 9F), TextAlign = ContentAlignment.MiddleCenter };
    readonly TextBox _busca = new() { BorderStyle = BorderStyle.None, Font = new Font("Segoe UI", 9.8F), PlaceholderText = "Pesquisar", BackColor = BotaoCinza };
    readonly ListaReg _lista;
    readonly Panel _faixa = new() { BackColor = Color.White };
    readonly FlowLayoutPanel _acoes = new() { FlowDirection = FlowDirection.LeftToRight, WrapContents = false, BackColor = Fundo, Margin = Padding.Empty };
    List<JsonObject> _todos = [];
    JsonObject _atual;
    bool _incluindo, _sujo, _carregando;

    /// <summary>Valores de um registro novo (além dos vazios); ex.: ativo = true.</summary>
    public Func<JsonObject> Padrao { get; set; } = () => new JsonObject { ["ativo"] = true };
    /// <summary>Confere o que vai ser gravado; devolve a mensagem de erro ou null.</summary>
    public Func<JsonObject, string> Validar { get; set; }
    /// <summary>Chamado depois de gravar ou excluir (ex.: recarregar dados de apoio).</summary>
    public Func<Task> Depois { get; set; }
    /// <summary>Texto do total embaixo da lista (padrão "Registro X de Y").</summary>
    public string Nome { get; set; } = "registro";

    public RegistroDesign(string titulo, string sub, string svg, string corCss, CampoReg[] campos, ColunaReg[] colunas, FonteReg fonte, params (string texto, Action<JsonObject> acao)[] extras)
        : base(L, A)
    {
        _titulo = titulo; _campos = campos; _cols = colunas; _fonte = fonte;
        Text = titulo; BackColor = Fundo;
        _lista = new ListaReg(colunas);

        // ---------- cabeçalho: padding 14 18, ícone 34, título 16/sub 12, estado, pesquisa 240×32, ✕ 32
        var cab = new Panel { Dock = DockStyle.Top, Height = 63, BackColor = Color.White };
        cab.Paint += (_, e) => { using var p = new Pen(Color.FromArgb(235, 235, 235)); e.Graphics.DrawLine(p, 0, cab.Height - 1, cab.Width, cab.Height - 1); };
        var ic = new PictureBox { Image = Forma.Tile(svg, corCss), SizeMode = PictureBoxSizeMode.Zoom, Size = new Size(34, 34), Location = new Point(M, 14), BackColor = Color.Transparent };
        var fT = new Font("Segoe UI", 12F, FontStyle.Bold); var fS = new Font("Segoe UI", 9F);
        var t = new Label { Text = titulo, AutoSize = true, Font = fT, ForeColor = PecasDesign.CorTexto, Location = new Point(M + 46, 11), BackColor = Color.Transparent };
        var s = new Label { Text = sub, AutoSize = true, Font = fS, ForeColor = Cinza, Location = new Point(M + 47, 32), BackColor = Color.Transparent };
        var largTexto = Math.Max(TextRenderer.MeasureText(titulo, fT).Width, TextRenderer.MeasureText(sub, fS).Width);
        _estado.Location = new Point(M + 46 + largTexto + 8, 20); _estado.Size = new Size(80, 23);
        _estado.Resize += (_, _) => Forma.AplicarRaio(_estado, 7);
        var fechar = Botao("✕", BotaoCinza, PecasDesign.CorTexto); fechar.Font = new Font("Segoe UI", 9.5F); fechar.Size = new Size(32, 32); fechar.Location = new Point(L - M - 32, 15);
        fechar.Resize += (_, _) => Forma.AplicarRaio(fechar, 9); Forma.AplicarRaio(fechar, 9);
        fechar.Click += (_, _) => Close();
        var busca = new Panel { Size = new Size(240, 32), Location = new Point(fechar.Left - 12 - 240, 15), BackColor = BotaoCinza };
        busca.Resize += (_, _) => Forma.AplicarRaio(busca, 9); Forma.AplicarRaio(busca, 9);
        busca.Paint += (_, e) => Forma.DesenharSvg(e.Graphics, "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5", new RectangleF(10, 9, 14, 14), Cinza, 2.2f);
        _busca.SetBounds(32, 8, 200, 18); busca.Controls.Add(_busca);
        _busca.TextChanged += (_, _) => Filtrar();
        cab.Controls.AddRange([ic, t, s, _estado, busca, fechar]);
        Point? origem = null;
        foreach (Control c in new Control[] { cab, t, s, ic })
        {
            c.MouseDown += (_, e) => { if (e.Button == MouseButtons.Left) origem = e.Location; };
            c.MouseMove += (_, e) => { if (origem is Point o && e.Button == MouseButtons.Left) Location = new Point(Location.X + e.X - o.X, Location.Y + e.Y - o.Y); };
            c.MouseUp += (_, _) => origem = null;
        }

        // ---------- faixa dos campos: padding 16 18 12, 6 colunas, espaço 12 (linhas) × 14 (colunas)
        _faixa.Paint += (_, e) => { using var p = new Pen(Color.FromArgb(237, 237, 237)); e.Graphics.DrawLine(p, 0, _faixa.Height - 1, _faixa.Width, _faixa.Height - 1); };
        MontarCampos();

        // ---------- rodapé: padding 12 18
        var rod = new Panel { Dock = DockStyle.Bottom, Height = 58, BackColor = Fundo };
        var nav = new Panel { Size = new Size(4 + 4 * 32, 32), Location = new Point(M, 13), BackColor = BotaoCinza };
        nav.Resize += (_, _) => Forma.AplicarRaio(nav, 9); Forma.AplicarRaio(nav, 9);
        var setas = new (string t, string dica, Action a)[] { ("«", "Primeiro", () => Ir(0)), ("‹", "Anterior", () => Ir(_lista.Selecionada - 1)), ("›", "Próximo", () => Ir(_lista.Selecionada + 1)), ("»", "Último", () => Ir(_lista.Linhas.Count - 1)) };
        for (var i = 0; i < setas.Length; i++)
        {
            var (tx, dica, a) = setas[i];
            var b = Botao(tx, BotaoCinza, PecasDesign.CorTexto); b.Font = new Font("Segoe UI", 10F); b.SetBounds(2 + i * 32, 2, 32, 28); b.AccessibleName = dica;
            b.FlatAppearance.MouseOverBackColor = Color.White; b.Resize += (_, _) => Forma.AplicarRaio(b, 7); Forma.AplicarRaio(b, 7);
            b.Click += (_, _) => a(); nav.Controls.Add(b);
        }
        _acoes.Location = new Point(nav.Right + 8, 13); _acoes.Size = new Size(700, 34);
        Acao("+ Novo", Forma.Verde, Color.White, true, Novo);
        Acao("Editar", BotaoCinza, PecasDesign.CorTexto, false, Editar);
        Acao("Excluir", BotaoCinza, Vermelho, false, Excluir);
        Acao("Cancelar", BotaoCinza, PecasDesign.CorTexto, false, Cancelar);
        Acao("Imprimir", BotaoCinza, PecasDesign.CorTexto, false, Imprimir);
        Acao("Importar", BotaoCinza, PecasDesign.CorTexto, false, Importar);
        Acao("Exportar", BotaoCinza, PecasDesign.CorTexto, false, Exportar);
        foreach (var (texto, acao) in extras) Acao(texto, BotaoCinza, PecasDesign.CorTexto, false, () => { if (_atual != null) acao(_atual); });
        var gravar = Botao("Gravar e fechar", Forma.Verde, Color.White, true); gravar.Font = new Font("Segoe UI", 9.8F, FontStyle.Bold);
        gravar.Size = new Size(TextRenderer.MeasureText(gravar.Text, gravar.Font).Width + 36, 34); gravar.Location = new Point(L - M - gravar.Width, 12);
        var fecharRod = Botao("Fechar", BotaoCinza, PecasDesign.CorTexto); fecharRod.Font = new Font("Segoe UI", 9.8F);
        fecharRod.Size = new Size(TextRenderer.MeasureText("Fechar", fecharRod.Font).Width + 32, 34); fecharRod.Location = new Point(gravar.Left - 8 - fecharRod.Width, 12);
        foreach (var b in new[] { gravar, fecharRod }) { b.Resize += (_, _) => Forma.AplicarRaio(b, 9); Forma.AplicarRaio(b, 9); }
        gravar.Click += (_, _) => Gravar(true);
        fecharRod.Click += (_, _) => Close();
        _acoes.Width = fecharRod.Left - 8 - _acoes.Left;
        // com botões extras (ex.: "Permissões") a fileira não pode passar por baixo do "Fechar": aperta o espaço de cada botão
        var botoes = _acoes.Controls.OfType<Button>().ToList();
        for (var folga = 24; folga > 10 && botoes.Sum(b => b.Width + b.Margin.Right) > _acoes.Width; folga -= 2)
            foreach (var b in botoes) { b.Width = TextRenderer.MeasureText(b.Text, b.Font).Width + folga; b.Margin = new Padding(0, 1, folga >= 20 ? 8 : 5, 0); }
        rod.Controls.AddRange([nav, _acoes, fecharRod, gravar]);

        // ---------- lista em cartão: margem 12 18 0
        var meio = new Panel { Dock = DockStyle.Fill, BackColor = Fundo, Padding = new Padding(M, 12, M, 0) };
        _lista.Dock = DockStyle.Fill;
        meio.Controls.Add(_lista);
        _lista.SelecaoMudou += () => { if (!_carregando && _lista.Atual is JsonObject r) Mostrar(r); };
        _lista.DuploClique += Editar;

        Controls.Add(meio); Controls.Add(rod); Controls.Add(_faixa); Controls.Add(cab);
        _faixa.Dock = DockStyle.Top; cab.SendToBack(); meio.BringToFront();
        KeyDown += (_, e) =>
        {
            if (e.Control && e.KeyCode == Keys.S) { e.SuppressKeyPress = true; Gravar(false); }
            else if (e.Control && e.KeyCode == Keys.N) { e.SuppressKeyPress = true; Novo(); }
            else if (e.Control && e.KeyCode == Keys.F) { e.SuppressKeyPress = true; _busca.Focus(); }
        };
        Load += async (_, _) => await Carregar(null);
        FormClosing += (_, e) =>
        {
            if (!_sujo || DialogResult == DialogResult.OK) return;
            var r = Perguntar("Gravar as alterações antes de fechar?", MessageBoxButtons.YesNoCancel);
            if (r == DialogResult.Cancel) e.Cancel = true;
            else if (r == DialogResult.Yes) { e.Cancel = true; Gravar(true); }
        };
    }

    protected override void OnLoad(EventArgs e)
    {
        if (Owner is Form dono && dono.Visible && dono.WindowState != FormWindowState.Minimized)
        {
            var fundo = new Escurecer(dono);
            fundo.Show();
            FormClosed += (_, _) => fundo.Close();
        }
        base.OnLoad(e);
    }

    /// <summary>Pergunta ao operador; no teste automático (Msg.Registro) só registra e responde Sim sem abrir caixa.</summary>
    DialogResult Perguntar(string texto, MessageBoxButtons botoes)
    {
        if (Msg.Registro != null) { Msg.Registro("PERGUNTA: " + texto); return botoes == MessageBoxButtons.YesNoCancel ? DialogResult.No : DialogResult.Yes; }
        return MessageBox.Show(this, texto, _titulo, botoes, MessageBoxIcon.Question);
    }

    void Acao(string texto, Color fundo, Color frente, bool negrito, Action a)
    {
        var b = Botao(texto, fundo, frente, negrito);
        b.Font = new Font("Segoe UI", 9.4F, negrito ? FontStyle.Bold : FontStyle.Regular);
        b.Size = new Size(TextRenderer.MeasureText(texto, b.Font).Width + 24, 32); b.Margin = new Padding(0, 1, 8, 0);
        b.Resize += (_, _) => Forma.AplicarRaio(b, 8); Forma.AplicarRaio(b, 8);
        b.Click += (_, _) => a();
        _acoes.Controls.Add(b);
    }

    // ---------- campos
    void MontarCampos()
    {
        const int pad = M, gapC = 14, gapL = 12, alt = 54;
        var colW = (L - 2 * pad - 5 * gapC) / 6f;
        int col = 0, lin = 0;
        foreach (var c in _campos)
        {
            var span = Math.Clamp(c.Span, 1, 6);
            if (col + span > 6) { col = 0; lin++; }
            var x = pad + (int)Math.Round(col * (colW + gapC));
            var w = (int)Math.Round(span * colW + (span - 1) * gapC);
            var y = 16 + lin * (alt + gapL);
            Control ctl;
            if (c.Tipo == "bool")
            {
                var ck = new CheckBox { Text = c.Rotulo, AutoSize = true, Font = new Font("Segoe UI", 9.8F), ForeColor = PecasDesign.CorTexto, BackColor = Color.White, Location = new Point(x, y + 20 + 7), Cursor = Cursors.Hand, Padding = new Padding(4, 0, 0, 0) };
                Forma.CheckVerde(ck);
                ck.CheckedChanged += (_, _) => Mexeu();
                _faixa.Controls.Add(ck); ctl = ck;
            }
            else
            {
                var rot = new Label { Text = c.Rotulo, AutoSize = false, Font = PecasDesign.FonteRotulo, ForeColor = Cinza, Location = new Point(x, y), Size = new Size(w, 16), BackColor = Color.White, AutoEllipsis = true };
                var caixa = new Panel { Location = new Point(x, y + 20), Size = new Size(w, 34), BackColor = Color.White };
                ctl = Criar(c);
                var foco = ctl;
                caixa.Paint += (_, e) =>
                {
                    e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                    using var path = Forma.Redondo(new Rectangle(0, 0, caixa.Width - 1, caixa.Height - 1), 8);
                    using var pen = new Pen(foco.ContainsFocus ? Forma.Verde : Color.FromArgb(219, 219, 219));
                    e.Graphics.DrawPath(pen, path);
                };
                foreach (var f in new[] { ctl }.Concat(ctl.Controls.Cast<Control>())) { f.GotFocus += (_, _) => caixa.Invalidate(); f.LostFocus += (_, _) => caixa.Invalidate(); }
                var h = ctl is TextBox ? ctl.Font.Height : ctl.Height;
                ctl.SetBounds(10, Math.Max(2, (34 - h) / 2), w - 16, h);
                if (ctl is ComboBox) { ctl.SetBounds(8, (34 - ctl.Height) / 2, w - 12, ctl.Height); }
                caixa.Controls.Add(ctl);
                caixa.Click += (_, _) => ctl.Focus();
                _faixa.Controls.Add(rot); _faixa.Controls.Add(caixa);
            }
            _c[c.Chave] = ctl;
            col += span;
        }
        _faixa.Height = 16 + (lin + 1) * alt + lin * gapL + 12 + 1;
    }

    Control Criar(CampoReg c)
    {
        Control ctl;
        switch (c.Tipo)
        {
            case "select":
            {
                var l = new ListaDesign { Font = new Font("Segoe UI", 10.1F) };
                foreach (var o in c.Opcoes ?? []) { var p = o.Split('=', 2); l.Items.Add(new Campos.Item(0, p.Length == 2 ? p[1] : p[0], new JsonObject { ["v"] = p[0] })); }
                l.SelectedIndexChanged += (_, _) => Mexeu(); ctl = l; break;
            }
            case "lista":
            {
                var l = new ListaDesign { Font = new Font("Segoe UI", 10.1F) };
                l.Items.Add(new Campos.Item(0, ""));
                foreach (var it in c.Itens?.Invoke() ?? []) l.Items.Add(it);
                l.SelectedIndexChanged += (_, _) => Mexeu(); ctl = l; break;
            }
            case "date":
            {
                var d = new DataDesign(DateTime.Today);
                foreach (Control x in d.Controls) if (x is TextBox tb) { tb.Font = new Font("Segoe UI", 10.1F); tb.TextChanged += (_, _) => Mexeu(); }
                ctl = d; break;
            }
            case "time":
            {
                var t = PecasDesign.Hora(DateTime.Today.AddHours(17)); t.Text = ""; t.Font = new Font("Segoe UI", 10.1F);
                t.TextChanged += (_, _) => Mexeu(); ctl = t; break;
            }
            case "int":
            {
                var t = PecasDesign.Numero(0, 9); t.Text = ""; t.Font = new Font("Segoe UI", 10.1F);
                t.TextChanged += (_, _) => Mexeu(); ctl = t; break;
            }
            default:
            {
                var t = PecasDesign.Texto(); t.Font = new Font("Segoe UI", 10.1F);
                if (c.Tipo == "password") t.UseSystemPasswordChar = true;
                t.TextChanged += (_, _) => Mexeu(); ctl = t; break;
            }
        }
        ctl.AccessibleName = c.Rotulo;
        return ctl;
    }

    void Mexeu() { if (!_carregando) _sujo = true; }

    void Estado()
    {
        _estado.Text = _incluindo ? "Incluindo" : "Editando";
        _estado.BackColor = _incluindo ? Color.FromArgb(225, 238, 255) : Color.FromArgb(255, 240, 219);
        _estado.ForeColor = _incluindo ? Color.FromArgb(10, 79, 160) : Color.FromArgb(138, 75, 0);
        _estado.Width = TextRenderer.MeasureText(_estado.Text, _estado.Font).Width + 18;
        _estado.Visible = _incluindo || _atual != null;
    }

    // ---------- dados
    async Task Carregar(string idSel)
    {
        try
        {
            _todos = await _fonte.Listar();
            if (IsDisposed) return;
            Filtrar(idSel ?? _atual?.S("id"));
            if (_lista.Atual == null) Novo();
        }
        catch (Exception e) { Msg.Erro(this, e.Message); }
    }

    void Filtrar(string idSel = null)
    {
        var q = _busca.Text.Trim();
        var linhas = q.Length == 0 ? _todos : _todos.Where(r => _cols.Any(c => (c.Texto(r) ?? "").Contains(q, StringComparison.OrdinalIgnoreCase)) || _campos.Any(c => r.S(c.Chave).Contains(q, StringComparison.OrdinalIgnoreCase))).ToList();
        _carregando = true;
        _lista.Carregar(linhas);
        var i = idSel == null ? -1 : linhas.FindIndex(r => r.S("id") == idSel);
        if (i < 0 && linhas.Count > 0) i = 0;
        _carregando = false;
        if (i >= 0) { _lista.Selecionar(i); }
        else _lista.Total = $"{linhas.Count} {(linhas.Count == 1 ? Nome : Nome + "s")}";
    }

    void Ir(int i)
    {
        if (_lista.Linhas.Count == 0) return;
        _lista.Selecionar(Math.Clamp(i, 0, _lista.Linhas.Count - 1));
    }

    void Mostrar(JsonObject r)
    {
        if (_sujo && _atual != r && !_carregando)
        {
            // mudou de linha com alterações não gravadas
            if (Perguntar("Descartar as alterações do registro atual?", MessageBoxButtons.YesNo) != DialogResult.Yes)
            { var volta = _lista.Linhas.IndexOf(_atual); _carregando = true; if (volta >= 0) _lista.Selecionar(volta); _carregando = false; return; }
        }
        _carregando = true;
        _atual = r; _incluindo = false;
        foreach (var c in _campos) Por(c, r);
        _carregando = false; _sujo = false;
        _lista.Total = $"Registro {_lista.Selecionada + 1} de {_lista.Linhas.Count}";
        Estado();
    }

    void Por(CampoReg c, JsonObject r)
    {
        var ctl = _c[c.Chave];
        switch (ctl)
        {
            // "ativo" que não existe no registro vale como ativo (a lista já mostra "Sim"; salvar não pode desativar sem querer)
            case CheckBox ck: ck.Checked = r[c.Chave] is null && c.Chave is "active" or "ativo" ? true : r.B(c.Chave); break;
            case ListaDesign l when c.Tipo == "select":
                l.SelectedIndex = -1;
                for (var i = 0; i < l.Items.Count; i++) if (((Campos.Item)l.Items[i]).Dados.S("v").Equals(r.S(c.Chave), StringComparison.OrdinalIgnoreCase)) { l.SelectedIndex = i; break; }
                if (l.SelectedIndex < 0 && r[c.Chave] == null && l.Items.Count > 0 && _incluindo) l.SelectedIndex = 0;
                break;
            case ListaDesign l: Campos.Selecionar(l, r.L(c.Chave) ?? 0); if (l.SelectedIndex < 0) l.SelectedIndex = 0; break;
            case DataDesign d: if (r.D(c.Chave) is DateTime dt) d.Value = dt; else foreach (Control x in d.Controls) if (x is TextBox tb) tb.Text = ""; break;
            default:
                ctl.Text = c.Tipo switch
                {
                    "money" => r[c.Chave] == null ? "" : Fmt.Dinheiro(r.L(c.Chave)),
                    "password" => "",
                    _ => r.S(c.Chave),
                };
                break;
        }
    }

    JsonObject Ler(out string erro)
    {
        erro = null;
        var b = new JsonObject();
        foreach (var c in _campos)
        {
            var ctl = _c[c.Chave];
            switch (c.Tipo)
            {
                case "bool": b[c.Chave] = ((CheckBox)ctl).Checked; break;
                case "select": b[c.Chave] = (((ListaDesign)ctl).SelectedItem as Campos.Item)?.Dados.S("v"); break;
                case "lista": b[c.Chave] = Campos.IdDe((ListaDesign)ctl) is long id && id > 0 ? id : null; break;
                case "money":
                    if (ctl.Text.Trim().Length == 0) b[c.Chave] = null;
                    else if (Fmt.Centavos(ctl.Text) is long v) b[c.Chave] = v;
                    else { erro = $"Valor inválido em \"{c.Rotulo}\"."; return null; }
                    break;
                case "int": b[c.Chave] = int.TryParse(ctl.Text, out var n) ? n : null; break;
                case "date":
                    var d = (DataDesign)ctl;
                    b[c.Chave] = d.Valida ? Fmt.Iso(d.Value) : null; break;
                case "time":
                    if (ctl.Text.Trim().Length == 0) b[c.Chave] = null;
                    else if (PecasDesign.LerHora((TextBox)ctl, out var h)) b[c.Chave] = h.ToString(@"hh\:mm");
                    else { erro = $"Hora inválida em \"{c.Rotulo}\" (use hh:mm)."; return null; }
                    break;
                case "password": if (ctl.Text.Length > 0) b[c.Chave] = ctl.Text; break;
                default: b[c.Chave] = ctl.Text.Trim(); break;
            }
        }
        erro = Validar?.Invoke(b);
        return erro == null ? b : null;
    }

    // ---------- ações
    void Novo()
    {
        if (_sujo && Perguntar("Descartar as alterações do registro atual?", MessageBoxButtons.YesNo) != DialogResult.Yes) return;
        _carregando = true;
        _atual = null; _incluindo = true;
        _lista.Selecionar(-1);
        var p = Padrao?.Invoke() ?? [];
        foreach (var c in _campos) Por(c, p);
        _carregando = false; _sujo = false;
        _lista.Total = $"Novo {Nome} · {_todos.Count} no total";
        Estado();
        _c.Values.FirstOrDefault(x => x is not CheckBox)?.Focus();
    }

    void Editar()
    {
        if (_atual == null) { Msg.Aviso(this, "Selecione um registro na lista."); return; }
        var primeiro = _c.Values.FirstOrDefault(x => x is not CheckBox);
        primeiro?.Focus(); if (primeiro is TextBox tb) tb.SelectAll();
    }

    void Cancelar()
    {
        if (_atual != null) { _sujo = false; Mostrar(_atual); }
        else { _sujo = false; Novo(); }
    }

    async void Gravar(bool fechar)
    {
        var b = Ler(out var erro);
        if (b == null) { Msg.Aviso(this, erro); return; }
        try
        {
            UseWaitCursor = true;
            var r = _incluindo || _atual == null ? await _fonte.Incluir(b) : await _fonte.Alterar(_atual, b);
            _sujo = false;
            if (Depois != null) await Depois();
            if (fechar) { DialogResult = DialogResult.OK; Close(); return; }
            await Carregar(r?["id"]?.ToString() ?? _atual?.S("id"));
        }
        catch (Exception e) { Msg.Erro(this, e.Message); }
        finally { UseWaitCursor = false; }
    }

    async void Excluir()
    {
        if (_atual == null) { Msg.Aviso(this, "Selecione o registro que quer excluir."); return; }
        if (!Msg.Pergunta(this, "Excluir definitivamente o registro selecionado?")) return;
        try
        {
            var r = await _fonte.Excluir(_atual);
            if (r is JsonObject o && o.B("desativado")) Msg.Info(this, "O registro está em uso: foi desativado em vez de excluído.");
            _sujo = false; _atual = null;
            if (Depois != null) await Depois();
            await Carregar(null);
        }
        catch (Exception e) { Msg.Erro(this, e.Message); }
    }

    string TextoCampo(CampoReg c, JsonObject r) => c.Tipo switch
    {
        "bool" => r.B(c.Chave) ? "Sim" : "Não",
        "money" => r[c.Chave] == null ? "" : Fmt.Dinheiro(r.L(c.Chave)),
        "date" => Fmt.Dmy(r.S(c.Chave)),
        "password" => "",
        "select" => (c.Opcoes ?? []).Select(o => o.Split('=', 2)).FirstOrDefault(p => p[0].Equals(r.S(c.Chave), StringComparison.OrdinalIgnoreCase)) is { } p ? p[^1] : r.S(c.Chave),
        "lista" => (c.Itens?.Invoke() ?? []).FirstOrDefault(i => i.Id == (r.L(c.Chave) ?? -1))?.Texto ?? "",
        _ => r.S(c.Chave),
    };

    void Imprimir()
    {
        var sb = new StringBuilder();
        sb.Append("<!doctype html><html lang=pt-BR><meta charset=utf-8><title>").Append(WebUtility.HtmlEncode(_titulo)).Append("</title><style>")
          .Append("body{font-family:'Segoe UI',sans-serif;font-size:12px;color:#1D1D1F;margin:24px}h1{font-size:18px;margin:0 0 4px}p{color:#6E6E73;margin:0 0 14px}")
          .Append("table{border-collapse:collapse;width:100%}th{text-align:left;font-size:11px;color:#6E6E73;background:#FBFBFD;border-bottom:1px solid #ddd;padding:6px 8px}td{border-bottom:1px solid #eee;padding:6px 8px}")
          .Append("</style><h1>").Append(WebUtility.HtmlEncode(_titulo)).Append("</h1><p>").Append(_lista.Linhas.Count).Append(" registro(s) · impresso em ").Append(DateTime.Now.ToString("dd/MM/yyyy HH:mm")).Append("</p><table><tr>");
        foreach (var c in _cols) sb.Append("<th style=\"text-align:").Append(c.Alinha == 'D' ? "right" : c.Alinha == 'C' ? "center" : "left").Append("\">").Append(WebUtility.HtmlEncode(c.Titulo)).Append("</th>");
        sb.Append("</tr>");
        foreach (var r in _lista.Linhas)
        {
            sb.Append("<tr>");
            foreach (var c in _cols) sb.Append("<td style=\"text-align:").Append(c.Alinha == 'D' ? "right" : c.Alinha == 'C' ? "center" : "left").Append("\">").Append(WebUtility.HtmlEncode(c.Texto(r) ?? "")).Append("</td>");
            sb.Append("</tr>");
        }
        sb.Append("</table><script>setTimeout(()=>print(),300)</script></html>");
        var arq = Path.Combine(Path.GetTempPath(), $"kartodromo-{Guid.NewGuid():N}.html");
        File.WriteAllText(arq, sb.ToString(), new UTF8Encoding(false));
        Relatorio.Abrir(this, new Uri(arq).AbsoluteUri, _titulo);
    }

    void Exportar()
    {
        using var d = new SaveFileDialog { FileName = $"{Nome}s-{DateTime.Now:yyyyMMdd-HHmm}.csv", Filter = "Planilha (*.csv)|*.csv" };
        if (d.ShowDialog(this) != DialogResult.OK) return;
        var campos = _campos.Where(c => c.Tipo != "password").ToArray();
        static string Q(string v) => "\"" + (v ?? "").Replace("\"", "\"\"") + "\"";
        var sb = new StringBuilder();
        sb.AppendLine(string.Join(";", campos.Select(c => Q(c.Rotulo))));
        foreach (var r in _lista.Linhas) sb.AppendLine(string.Join(";", campos.Select(c => Q(TextoCampo(c, r)))));
        File.WriteAllText(d.FileName, sb.ToString(), new UTF8Encoding(true));
        Msg.Info(this, $"{_lista.Linhas.Count} registro(s) exportado(s) para {Path.GetFileName(d.FileName)}.");
    }

    async void Importar()
    {
        using var d = new OpenFileDialog { Filter = "Planilha (*.csv)|*.csv|Todos os arquivos|*.*", Title = "Importar " + Nome + "s (mesmas colunas do Exportar)" };
        if (d.ShowDialog(this) != DialogResult.OK) return;
        try
        {
            var linhas = File.ReadAllLines(d.FileName, Encoding.UTF8).Where(l => l.Trim().Length > 0).Select(Csv).ToList();
            if (linhas.Count < 2) { Msg.Aviso(this, "O arquivo não tem registros (a 1ª linha é o cabeçalho)."); return; }
            var cab = linhas[0];
            var mapa = cab.Select(h => _campos.FirstOrDefault(c => c.Rotulo.Equals(h.Trim(), StringComparison.OrdinalIgnoreCase) || c.Chave.Equals(h.Trim(), StringComparison.OrdinalIgnoreCase))).ToArray();
            if (mapa.All(m => m == null)) { Msg.Aviso(this, "Nenhuma coluna do arquivo corresponde aos campos deste cadastro. Use o Exportar como modelo."); return; }
            if (!Msg.Pergunta(this, $"Importar {linhas.Count - 1} registro(s) de {Path.GetFileName(d.FileName)}?")) return;
            int ok = 0; var erros = new List<string>();
            for (var i = 1; i < linhas.Count; i++)
            {
                var b = Padrao?.Invoke() ?? [];
                for (var j = 0; j < mapa.Length && j < linhas[i].Length; j++)
                {
                    var c = mapa[j]; if (c == null) continue; var v = linhas[i][j].Trim();
                    b[c.Chave] = c.Tipo switch
                    {
                        "bool" => v.Equals("Sim", StringComparison.OrdinalIgnoreCase) || v == "1" || v.Equals("true", StringComparison.OrdinalIgnoreCase),
                        "int" => int.TryParse(v, out var n) ? n : null,
                        "money" => Fmt.Centavos(v) is long cent ? cent : null,
                        "date" => DateTime.TryParseExact(v, "dd/MM/yyyy", Fmt.Br, System.Globalization.DateTimeStyles.None, out var dt) ? Fmt.Iso(dt) : null,
                        "select" => (c.Opcoes ?? []).Select(o => o.Split('=', 2)).FirstOrDefault(p => p[^1].Equals(v, StringComparison.OrdinalIgnoreCase) || p[0].Equals(v, StringComparison.OrdinalIgnoreCase))?[0] ?? v,
                        "lista" => (c.Itens?.Invoke() ?? []).FirstOrDefault(it => it.Texto.Equals(v, StringComparison.OrdinalIgnoreCase))?.Id,
                        _ => v,
                    };
                }
                try { await _fonte.Incluir(b); ok++; }
                catch (Exception e) { erros.Add($"linha {i + 1}: {e.Message}"); }
            }
            if (Depois != null) await Depois();
            await Carregar(null);
            Msg.Info(this, $"{ok} registro(s) importado(s)." + (erros.Count > 0 ? $"\n\nNão importados ({erros.Count}):\n" + string.Join("\n", erros.Take(10)) : ""));
        }
        catch (Exception e) { Msg.Erro(this, e.Message); }
    }

    static string[] Csv(string linha)
    {
        var sep = linha.Count(ch => ch == ';') >= linha.Count(ch => ch == ',') ? ';' : ',';
        var r = new List<string>(); var sb = new StringBuilder(); var aspas = false;
        for (var i = 0; i < linha.Length; i++)
        {
            var ch = linha[i];
            if (aspas) { if (ch == '"' && i + 1 < linha.Length && linha[i + 1] == '"') { sb.Append('"'); i++; } else if (ch == '"') aspas = false; else sb.Append(ch); }
            else if (ch == '"') aspas = true;
            else if (ch == sep) { r.Add(sb.ToString()); sb.Clear(); }
            else sb.Append(ch);
        }
        r.Add(sb.ToString());
        return r.ToArray();
    }

    /// <summary>Para testes/automação: seleciona a linha i.</summary>
    public void SelecionarLinha(int i) => Ir(i);
}

/// <summary>A lista do cadastro no cartão branco: cabeçalho 32 px #FBFBFD, linhas de 34 px, selecionada em verde claro
/// com a 1ª coluna em negrito, "Registro X de Y" embaixo à direita. Rola com a roda do mouse; ↑/↓ navegam.</summary>
public class ListaReg : Control
{
    readonly ColunaReg[] _cols;
    public List<JsonObject> Linhas { get; private set; } = [];
    public int Selecionada { get; private set; } = -1;
    public JsonObject Atual => Selecionada >= 0 && Selecionada < Linhas.Count ? Linhas[Selecionada] : null;
    public event Action SelecaoMudou;
    public event Action DuploClique;
    string _total = "";
    public string Total { get => _total; set { _total = value; Invalidate(); } }
    int _topo;
    const int Cab = 32, Lin = 34, Rod = 33;
    static readonly Font FonteLinha = new("Segoe UI", 9.8F);
    static readonly Font FonteNegrito = new("Segoe UI Semibold", 9.8F);
    static readonly Font FonteCab = new("Segoe UI Semibold", 9F);

    public ListaReg(ColunaReg[] cols)
    {
        _cols = cols;
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.Selectable, true);
        BackColor = RegistroDesign.Fundo; TabStop = true;
    }

    int Cabem => Math.Max(1, (Height - Cab - Rod) / Lin);

    public void Carregar(List<JsonObject> linhas) { Linhas = linhas; Selecionada = -1; _topo = 0; Invalidate(); }

    public void Selecionar(int i)
    {
        Selecionada = i < Linhas.Count ? i : -1;
        if (Selecionada >= 0)
        {
            if (Selecionada < _topo) _topo = Selecionada;
            else if (Selecionada >= _topo + Cabem) _topo = Selecionada - Cabem + 1;
        }
        Invalidate();
        SelecaoMudou?.Invoke();
    }

    protected override bool IsInputKey(Keys k) => k is Keys.Up or Keys.Down or Keys.PageUp or Keys.PageDown or Keys.Home or Keys.End || base.IsInputKey(k);

    protected override void OnKeyDown(KeyEventArgs e)
    {
        base.OnKeyDown(e);
        if (Linhas.Count == 0) return;
        var i = e.KeyCode switch { Keys.Up => Selecionada - 1, Keys.Down => Selecionada + 1, Keys.PageUp => Selecionada - Cabem, Keys.PageDown => Selecionada + Cabem, Keys.Home => 0, Keys.End => Linhas.Count - 1, _ => int.MinValue };
        if (i != int.MinValue) Selecionar(Math.Clamp(i, 0, Linhas.Count - 1));
        if (e.KeyCode == Keys.Enter) DuploClique?.Invoke();
    }

    protected override void OnMouseWheel(MouseEventArgs e)
    {
        base.OnMouseWheel(e);
        _topo = Math.Clamp(_topo - Math.Sign(e.Delta) * 3, 0, Math.Max(0, Linhas.Count - Cabem));
        Invalidate();
    }

    int LinhaEm(Point p) => p.Y < Cab || p.Y > Height - Rod ? -1 : (p.Y - Cab) / Lin + _topo;

    protected override void OnMouseDown(MouseEventArgs e)
    {
        base.OnMouseDown(e); Focus();
        // barra de rolagem à direita
        if (e.X > Width - 12 && Linhas.Count > Cabem) { Rolar(e.Y); _arrastando = true; return; }
        var i = LinhaEm(e.Location);
        if (i >= 0 && i < Linhas.Count && i != Selecionada) Selecionar(i);
    }
    bool _arrastando;
    protected override void OnMouseMove(MouseEventArgs e) { base.OnMouseMove(e); if (_arrastando) Rolar(e.Y); }
    protected override void OnMouseUp(MouseEventArgs e) { base.OnMouseUp(e); _arrastando = false; }
    void Rolar(int y)
    {
        var area = Height - Cab - Rod;
        var frac = Math.Clamp((y - Cab) / (float)Math.Max(1, area), 0, 1);
        _topo = (int)Math.Round(frac * Math.Max(0, Linhas.Count - Cabem));
        Invalidate();
    }

    protected override void OnMouseDoubleClick(MouseEventArgs e)
    {
        base.OnMouseDoubleClick(e);
        if (LinhaEm(e.Location) is var i && i >= 0 && i < Linhas.Count) DuploClique?.Invoke();
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(RegistroDesign.Fundo);
        var r = new Rectangle(0, 0, Width - 1, Height - 1);
        using var card = Forma.Redondo(r, 12);
        g.FillPath(Brushes.White, card);
        g.SetClip(card);
        using (var cab = new SolidBrush(Color.FromArgb(251, 251, 253))) g.FillRectangle(cab, 0, 0, Width, Cab);
        using var lin = new Pen(Color.FromArgb(237, 237, 237));
        using var linFina = new Pen(Color.FromArgb(242, 242, 242));
        g.DrawLine(lin, 0, Cab - 1, Width, Cab - 1);

        // colunas: larguras fixas, a de largura 0 ocupa o resto; padding 0 14, espaço 12
        var fixas = _cols.Sum(c => c.Largura);
        var flex = Math.Max(40, Width - 28 - fixas - 12 * (_cols.Length - 1));
        var nFlex = Math.Max(1, _cols.Count(c => c.Largura == 0));
        var xs = new List<(int x, int w)>(); var x = 14;
        foreach (var c in _cols) { var w = c.Largura == 0 ? flex / nFlex : c.Largura; xs.Add((x, w)); x += w + 12; }
        TextFormatFlags Al(char a) => TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix | TextFormatFlags.NoPadding | (a == 'D' ? TextFormatFlags.Right : a == 'C' ? TextFormatFlags.HorizontalCenter : TextFormatFlags.Left);
        for (var i = 0; i < _cols.Length; i++)
            TextRenderer.DrawText(g, _cols[i].Titulo, FonteCab, new Rectangle(xs[i].x, 0, xs[i].w, Cab), Color.FromArgb(110, 110, 115), Al(_cols[i].Alinha));

        var fim = Math.Min(Linhas.Count, _topo + Cabem);
        for (var l = _topo; l < fim; l++)
        {
            var y = Cab + (l - _topo) * Lin;
            if (l == Selecionada) using (var sel = new SolidBrush(Color.FromArgb(226, 239, 234))) g.FillRectangle(sel, 0, y, Width, Lin - 1);
            g.DrawLine(linFina, 0, y + Lin - 1, Width, y + Lin - 1);
            for (var i = 0; i < _cols.Length; i++)
            {
                var txt = _cols[i].Texto(Linhas[l]) ?? "";
                TextRenderer.DrawText(g, txt, i == 0 && l == Selecionada ? FonteNegrito : FonteLinha, new Rectangle(xs[i].x, y, xs[i].w, Lin - 1), PecasDesign.CorTexto, Al(_cols[i].Alinha));
            }
        }
        if (Linhas.Count == 0)
            TextRenderer.DrawText(g, "Nenhum registro.", FonteLinha, new Rectangle(0, Cab + 10, Width, 30), Color.FromArgb(110, 110, 115), TextFormatFlags.HorizontalCenter);
        // rolagem
        if (Linhas.Count > Cabem)
        {
            var area = Height - Cab - Rod - 8;
            var h = Math.Max(24, area * Cabem / Linhas.Count);
            var yb = Cab + 4 + (area - h) * _topo / Math.Max(1, Linhas.Count - Cabem);
            using var p = Forma.Redondo(new Rectangle(Width - 9, yb, 5, h), 3);
            using var b = new SolidBrush(Color.FromArgb(200, 200, 204)); g.FillPath(b, p);
        }
        // total
        g.DrawLine(linFina, 0, Height - Rod, Width, Height - Rod);
        TextRenderer.DrawText(g, _total, new Font("Segoe UI", 9F), new Rectangle(14, Height - Rod, Width - 28, Rod), Color.FromArgb(110, 110, 115), TextFormatFlags.Right | TextFormatFlags.VerticalCenter);
        g.ResetClip();
        using var borda = new Pen(Color.FromArgb(237, 237, 237));
        g.DrawPath(borda, card);
    }
}
