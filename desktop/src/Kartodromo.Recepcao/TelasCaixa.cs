using System.Drawing.Drawing2D;
using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

/// <summary>Abrir o caixa — TerminalAbrir.dc.html: cartão central com ícone, lista Usuário/Turno/Terminal/Suprimento e 2 botões.</summary>
public sealed class FormTerminalAbrir : CartaoModal
{
    readonly ComboBox _turno = new() { DropDownStyle = ComboBoxStyle.DropDownList, FlatStyle = FlatStyle.Flat, BackColor = Color.White, Font = new Font("Segoe UI", 10F, FontStyle.Bold), Width = 230 };
    readonly ComboBox _terminal = new() { DropDownStyle = ComboBoxStyle.DropDownList, FlatStyle = FlatStyle.Flat, BackColor = Color.White, ForeColor = KitVisual.Verde, Font = new Font("Segoe UI", 10F, FontStyle.Bold), Width = 230 };
    readonly TextBox _inicial = new() { BorderStyle = BorderStyle.None, TextAlign = HorizontalAlignment.Right, Font = new Font("Segoe UI", 11F, FontStyle.Bold), Width = 140, Text = "0,00" };
    public bool Concluido { get; private set; }

    public FormTerminalAbrir(JsonObject caixa) : base(500, 462)
    {
        Text = "Abrir o caixa";
        if (caixa["turnos"] is JsonArray turnos)
            _turno.Items.AddRange(turnos.OfType<JsonObject>().Select(t => new Campos.Item(t.L("id") ?? 0, string.IsNullOrEmpty(t.S("inicio")) ? t.S("descricao") : $"{t.S("descricao")} ({t.S("inicio")} – {t.S("fim")})")).ToArray());
        if (caixa["terminais"] is JsonArray terminais) _terminal.Items.AddRange(terminais.OfType<JsonObject>().Select(t => new Campos.Item(t.L("id") ?? 0, t.S("nome"))).ToArray());
        if (_turno.Items.Count >= 1) _turno.SelectedIndex = SugerirTurno(caixa);
        if (_terminal.Items.Count == 1) _terminal.SelectedIndex = 0;

        var icone = Icone("terminal", 76); icone.Location = new Point((500 - 76) / 2, 18);
        var titulo = new Label { Text = "Abrir o caixa", Font = new Font("Segoe UI", 16F, FontStyle.Bold), AutoSize = false, Size = new Size(500, 34), Location = new Point(0, 94), TextAlign = ContentAlignment.MiddleCenter };
        var desc = new Label { Text = "O terminal ainda não foi aberto. Escolha o turno, o seu terminal e quanto dinheiro tem na gaveta agora.", Font = new Font("Segoe UI", 9.8F), ForeColor = KitVisual.Secundario, AutoSize = false, Size = new Size(440, 44), Location = new Point(30, 130), TextAlign = ContentAlignment.TopCenter };
        var lista = Lista(); lista.SetBounds(20, 184, 460, 196);
        void Linha(int i, string rotulo, Control valor)
        {
            var y = i * 49;
            lista.Controls.Add(new Label { Text = rotulo, AutoSize = false, Size = new Size(170, 48), Location = new Point(16, y), TextAlign = ContentAlignment.MiddleLeft, ForeColor = KitVisual.Secundario, Font = new Font("Segoe UI", 10F) });
            valor.Location = new Point(460 - 16 - valor.Width, y + (48 - valor.Height) / 2);
            lista.Controls.Add(valor);
            if (i > 0) lista.Controls.Add(new Panel { BackColor = Color.FromArgb(236, 236, 239), Bounds = new Rectangle(1, y, 458, 1) });
        }
        var usuario = new Label { Text = Sessao.Nome, AutoSize = false, Size = new Size(230, 24), TextAlign = ContentAlignment.MiddleRight, Font = new Font("Segoe UI", 10F, FontStyle.Bold) };
        var suprimento = new Panel { Size = new Size(190, 30), BackColor = Color.White };
        var rs = new Label { Text = "R$", AutoSize = true, ForeColor = KitVisual.Secundario, Location = new Point(0, 6) };
        _inicial.Location = new Point(40, 4); suprimento.Controls.Add(rs); suprimento.Controls.Add(_inicial);
        Linha(0, "Usuário", usuario);
        Linha(1, "Turno", _turno);
        Linha(2, "Terminal", _terminal);
        Linha(3, "Suprimento inicial", suprimento);

        var agora = Botao("Agora não", CinzaBotao, KitVisual.Texto); agora.SetBounds(20, 398, 190, 44); agora.Click += (_, _) => Close();
        var abrir = Botao("Abrir terminal", KitVisual.Verde, Color.White, true); abrir.SetBounds(222, 398, 258, 44);
        abrir.Click += (_, _) => Seguro.Rodar(this, async () =>
        {
            if (Campos.IdDe(_turno) is not long turnoId) { Msg.Aviso(this, "Selecione o turno que será aberto."); return; }
            if (Campos.IdDe(_terminal) is not long terminalId) { Msg.Aviso(this, "Selecione o seu terminal."); return; }
            var texto = string.IsNullOrWhiteSpace(_inicial.Text) ? "0" : _inicial.Text;
            if (Fmt.Centavos(texto) is not long inicial) { Msg.Aviso(this, "Valor de suprimento inicial inválido."); return; }
            var r = await Sessao.Api.Post("/api/office/caixa/abrir", new { turnoId, terminalId, inicialCentavos = inicial });
            Msg.Info(this, r.S("mensagem"));
            Concluido = true; DialogResult = DialogResult.OK; Close();
        });
        AcceptButton = abrir;
        Controls.AddRange([icone, titulo, desc, lista, agora, abrir]);
        Shown += (_, _) => ActiveControl = _terminal.SelectedIndex < 0 ? _terminal : _inicial;
        _inicial.Enter += (_, _) => BeginInvoke(_inicial.SelectAll);
    }

    /// <summary>Escolhe o turno cujo horário contém a hora atual (ou o primeiro).</summary>
    static int SugerirTurno(JsonObject caixa)
    {
        var agora = DateTime.Now.TimeOfDay;
        var lista = (caixa["turnos"] as JsonArray)?.OfType<JsonObject>().ToList() ?? [];
        for (var i = 0; i < lista.Count; i++)
            if (TimeSpan.TryParse(lista[i].S("inicio"), out var a) && TimeSpan.TryParse(lista[i].S("fim"), out var b) && agora >= a && agora <= b) return i;
        return 0;
    }
}

/// <summary>Fechar o caixa — TerminalFechar.dc.html: 3 cartões, lista colorida do movimento, valor do próximo turno.</summary>
public sealed class FormTerminalFechar : CartaoModal
{
    readonly JsonObject _aberto;
    readonly TextBox _proximo = new() { BorderStyle = BorderStyle.None, TextAlign = HorizontalAlignment.Right, Font = new Font("Segoe UI", 14F, FontStyle.Bold), Width = 96, Text = "0,00" };
    public bool Concluido { get; private set; }
    public string MovimentoId { get; private set; }

    public FormTerminalFechar(JsonObject aberto, JsonObject sumario) : base(640, 762)
    {
        _aberto = aberto;
        Text = "Fechar terminal";
        const int L = 640;
        // cabeçalho branco
        var icone = Icone("terminal", 58); icone.Location = new Point(14, 10);
        var titulo = new Label { Text = $"Fechar terminal {aberto.S("terminal")}", AutoSize = true, Font = new Font("Segoe UI", 13.5F, FontStyle.Bold), Location = new Point(72, 16) };
        var aberturaTxt = DateTime.TryParse(aberto.S("abertoEm"), out var ab) ? $"aberto em {ab:dd/MM/yyyy} às {ab:HH:mm}" : "aberto";
        var sub = new Label { Text = $"{Sessao.Nome} · {aberturaTxt} · Turno {aberto.S("turno")}", AutoSize = true, ForeColor = KitVisual.Secundario, Font = new Font("Segoe UI", 9.3F), Location = new Point(73, 44) };
        var fechar = Botao("✕", Color.FromArgb(242, 242, 245), KitVisual.Secundario); fechar.SetBounds(L - 56, 22, 34, 34); fechar.Font = new Font("Segoe UI", 10F); fechar.Click += (_, _) => Close();
        var corpo = new Panel { BackColor = KitVisual.Fundo, Bounds = new Rectangle(1, 78, L - 2, 612) };
        var linhaTopo = new Panel { BackColor = Color.FromArgb(229, 229, 234), Bounds = new Rectangle(0, 77, L, 1) };

        // 3 cartões
        long V(string k) => sumario?.L(k) ?? 0;
        Panel Cartao(string rotulo, long valor, int x, bool destaque)
        {
            var p = new Panel { Bounds = new Rectangle(x, 14, 192, 64), BackColor = destaque ? Color.FromArgb(232, 247, 237) : Color.White };
            p.Paint += (_, e) => { e.Graphics.SmoothingMode = SmoothingMode.AntiAlias; using var path = VisualPrincipal.Redondo(new Rectangle(0, 0, p.Width - 1, p.Height - 1), 12); using var pen = new Pen(destaque ? Color.FromArgb(180, 225, 196) : Color.FromArgb(229, 229, 234)); e.Graphics.DrawPath(pen, path); };
            p.Resize += (_, _) => KitVisual.AplicarRaio(p, 12);
            p.Controls.Add(new Label { Text = rotulo, AutoSize = true, Location = new Point(14, 9), ForeColor = destaque ? KitVisual.Verde : KitVisual.Secundario, Font = new Font("Segoe UI", 8.8F) });
            p.Controls.Add(new Label { Text = Fmt.Brl(valor), AutoSize = true, Location = new Point(12, 27), ForeColor = destaque ? KitVisual.Verde : KitVisual.Texto, Font = new Font("Segoe UI", 15F, FontStyle.Bold) });
            return p;
        }
        corpo.Controls.Add(Cartao("Vendas", V("vendas") + V("vendasProdutos"), 20, false));
        corpo.Controls.Add(Cartao("Recebido", V("recebido"), 224, false));
        corpo.Controls.Add(Cartao("Total final na gaveta", V("final"), 428, true));

        // lista do movimento
        var lista = Lista(); lista.SetBounds(20, 92, 600, 430);
        var linhas = new (string rotulo, Color ponto, long valor, bool negativo, bool final)[]
        {
            ("Início do turno", Color.FromArgb(142, 142, 147), V("inicial"), false, false),
            ("Suprimento", Color.FromArgb(14, 156, 156), V("suprimento"), false, false),
            ("Sangria", Color.FromArgb(255, 59, 48), V("sangria"), true, false),
            ("Vendas de produtos", Color.FromArgb(255, 149, 0), V("vendasProdutos"), false, false),
            ("Vendas (baterias)", Color.FromArgb(52, 199, 89), V("vendas"), false, false),
            ("Desconto fornecido", Color.FromArgb(255, 159, 10), V("desconto"), true, false),
            ("Acréscimos", Color.FromArgb(142, 142, 147), V("acrescimos"), false, false),
            ("Total recebido", Color.FromArgb(10, 132, 255), V("recebido"), false, false),
            ("Troco fornecido", Color.FromArgb(142, 142, 147), V("troco"), true, false),
            ("Cancelado", Color.FromArgb(255, 59, 48), V("cancelado"), false, false),
            ("Total final", Color.FromArgb(52, 199, 89), V("final"), false, true),
        };
        for (var i = 0; i < linhas.Length; i++)
        {
            var (rotulo, ponto, valor, negativo, final) = linhas[i];
            var y = i * 39;
            var cor = ponto;
            var dot = new Panel { Bounds = new Rectangle(16, y + 16, 8, 8), BackColor = cor };
            dot.Resize += (_, _) => KitVisual.AplicarRaio(dot, 4); KitVisual.AplicarRaio(dot, 4);
            lista.Controls.Add(dot);
            lista.Controls.Add(new Label { Text = rotulo, AutoSize = false, Bounds = new Rectangle(34, y, 300, 39), TextAlign = ContentAlignment.MiddleLeft, Font = new Font("Segoe UI", 9.8F), ForeColor = KitVisual.Texto });
            var neg = negativo && valor != 0;
            var txt = (neg ? "– " : "") + Fmt.Brl(Math.Abs(valor));
            lista.Controls.Add(new Label
            {
                Text = txt, AutoSize = false, Bounds = new Rectangle(340, y, 244, 39), TextAlign = ContentAlignment.MiddleRight,
                Font = new Font("Segoe UI", final ? 11.5F : 10F, FontStyle.Bold), ForeColor = final ? KitVisual.Verde : neg ? Color.FromArgb(196, 40, 28) : KitVisual.Texto,
            });
            if (i > 0) lista.Controls.Add(new Panel { BackColor = Color.FromArgb(238, 238, 241), Bounds = new Rectangle(1, y, 598, 1) });
        }

        // próximo turno
        var prox = Lista(); prox.SetBounds(20, 534, 600, 64);
        prox.Controls.Add(new Label { Text = "Valor para o próximo turno", AutoSize = true, Location = new Point(16, 13), Font = new Font("Segoe UI", 10F, FontStyle.Bold) });
        prox.Controls.Add(new Label { Text = "Fica na gaveta como suprimento inicial de quem abrir depois", AutoSize = true, Location = new Point(16, 34), ForeColor = KitVisual.Secundario, Font = new Font("Segoe UI", 8.8F) });
        var caixaValor = new Panel { Bounds = new Rectangle(440, 11, 140, 42), BackColor = Color.White };
        caixaValor.Paint += (_, e) => { e.Graphics.SmoothingMode = SmoothingMode.AntiAlias; using var path = VisualPrincipal.Redondo(new Rectangle(1, 1, caixaValor.Width - 3, caixaValor.Height - 3), 10); using var pen = new Pen(KitVisual.Verde, 2F); e.Graphics.DrawPath(pen, path); };
        caixaValor.Controls.Add(new Label { Text = "R$", AutoSize = true, Location = new Point(12, 13), ForeColor = KitVisual.Secundario });
        _proximo.Location = new Point(36, 9); caixaValor.Controls.Add(_proximo);
        prox.Controls.Add(caixaValor);
        corpo.Controls.Add(lista); corpo.Controls.Add(prox);

        // rodapé
        var relatorio = Botao("   Gerar relatório", Color.FromArgb(242, 242, 245), KitVisual.Texto); relatorio.SetBounds(22, 704, 150, 40); relatorio.Font = new Font("Segoe UI", 9.8F);
        relatorio.Text = "Gerar relatório";
        relatorio.Click += (_, _) => Relatorio.Abrir(this, Sessao.Api.UrlComToken("/relatorio/fechamento?mov=" + _aberto.S("id")), "Fechamento de Caixa");
        var cancelar = Botao("Cancelar", Color.FromArgb(242, 242, 245), KitVisual.Texto); cancelar.SetBounds(L - 22 - 136 - 10 - 90, 704, 90, 40); cancelar.Click += (_, _) => Close();
        var fecharTerm = Botao("Fechar terminal", Color.FromArgb(29, 29, 31), Color.White, true); fecharTerm.SetBounds(L - 22 - 136, 704, 136, 40);
        fecharTerm.Click += (_, _) => Seguro.Rodar(this, async () =>
        {
            if (Fmt.Centavos(string.IsNullOrWhiteSpace(_proximo.Text) ? "0" : _proximo.Text) is not long valor) { Msg.Aviso(this, "Valor para o próximo turno inválido."); return; }
            if (!Msg.Pergunta(this, "Deseja fechar o terminal?")) return;
            var r = await Sessao.Api.Post("/api/office/caixa/fechar", new { proximoTurnoCentavos = valor });
            Concluido = true; MovimentoId = r.S("id"); DialogResult = DialogResult.OK; Close();
        });
        var linhaRodape = new Panel { BackColor = Color.FromArgb(229, 229, 234), Bounds = new Rectangle(0, 690, L, 1) };
        Controls.AddRange([icone, titulo, sub, fechar, linhaTopo, corpo, linhaRodape, relatorio, cancelar, fecharTerm]);
    }
}

public sealed class FormCaixaTransacao : Janela
{
    readonly string _tipo;
    readonly TextBox _valor = new();
    readonly TextBox _obs = new() { Multiline = true, Height = 74, ScrollBars = ScrollBars.Vertical };
    public FormCaixaTransacao(string tipo, JsonObject caixa) : base(tipo == "sangria" ? "Registrar sangria" : "Registrar suprimento", 500, 380)
    {
        _tipo = tipo == "sangria" ? "sangria" : "suprimento";
        var aberto = caixa["aberto"]?.AsObject();
        var resumo = new TableLayoutPanel { Dock = DockStyle.Top, Height = 84, ColumnCount = 3, Padding = new Padding(2, 4, 2, 8) };
        for (var i = 0; i < 3; i++) resumo.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 33.333F));
        resumo.Controls.Add(KitVisual.CartaoResumo("Atendente", Sessao.Nome), 0, 0);
        resumo.Controls.Add(KitVisual.CartaoResumo("Terminal", aberto?.S("terminal") ?? "—"), 1, 0);
        resumo.Controls.Add(KitVisual.CartaoResumo("Dinheiro em caixa", Fmt.Brl(caixa["sumario"]?.L("dinheiroEmCaixa") ?? 0)), 2, 0);
        var campos = Campos.Grade(1);
        Campos.Add(campos, "Valor (R$)", _valor);
        Campos.Add(campos, "Justificativa", _obs);
        var body = new Panel { Dock = DockStyle.Fill, Padding = new Padding(4, 6, 4, 0) };
        body.Controls.Add(campos); body.Controls.Add(resumo);
        Controls.Add(body);
        Rodape(("Cancelar", (_, _) => Close(), false), ("Registrar transação", (_, _) => Seguro.Rodar(this, async () =>
        {
            if (Fmt.Centavos(_valor.Text) is not long valor || valor <= 0) { Msg.Aviso(this, "Informe um valor maior que zero."); return; }
            if (string.IsNullOrWhiteSpace(_obs.Text)) { Msg.Aviso(this, "Informe a justificativa desta transação."); return; }
            var r = await Sessao.Api.Post("/api/office/caixa/transacao", new { tipo = _tipo, valorCentavos = valor, observacao = _obs.Text.Trim() });
            Msg.Info(this, r.S("mensagem")); DialogResult = DialogResult.OK; Close();
        }), true));
        Shown += (_, _) => _valor.Focus();
    }
}
