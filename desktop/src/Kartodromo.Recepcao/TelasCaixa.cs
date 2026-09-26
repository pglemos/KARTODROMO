using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

public sealed class FormTerminalAbrir : Janela
{
    readonly ComboBox _turno = Campos.Combo();
    readonly ComboBox _terminal = Campos.Combo();
    readonly TextBox _inicial = new() { Text = "0" };
    public bool Concluido { get; private set; }

    public FormTerminalAbrir(JsonObject caixa) : base("Abrir terminal", 520, 320)
    {
        if (caixa["turnos"] is JsonArray turnos) _turno.Items.AddRange(turnos.OfType<JsonObject>().Select(t => new Campos.Item(t.L("id") ?? 0, t.S("descricao"))).ToArray());
        if (caixa["terminais"] is JsonArray terminais) _terminal.Items.AddRange(terminais.OfType<JsonObject>().Select(t => new Campos.Item(t.L("id") ?? 0, t.S("nome"))).ToArray());
        if (_turno.Items.Count == 1) _turno.SelectedIndex = 0;
        if (_terminal.Items.Count == 1) _terminal.SelectedIndex = 0;
        var resumo = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 56, FlowDirection = FlowDirection.LeftToRight, WrapContents = false, Padding = new Padding(4, 2, 4, 5) };
        resumo.Controls.Add(KitVisual.CartaoResumo("Atendente", Sessao.Nome));
        resumo.Controls.Add(KitVisual.CartaoResumo("Abertura", DateTime.Now.ToString("dd/MM/yyyy HH:mm")));
        var campos = Campos.Grade(2, 50, 50);
        Campos.Add(campos, "Turno", _turno);
        Campos.Add(campos, "Terminal", _terminal);
        Campos.Add(campos, "Suprimento inicial (R$)", _inicial, 2);
        var body = new Panel { Dock = DockStyle.Fill, Padding = new Padding(4, 6, 4, 0) };
        body.Controls.Add(campos);
        body.Controls.Add(resumo);
        Controls.Add(body);
        Rodape(("Cancelar", (_, _) => Close(), false), ("Abrir terminal", (_, _) => Seguro.Rodar(this, async () =>
        {
            if (Campos.IdDe(_turno) is not long turnoId) { Msg.Aviso(this, "Selecione o turno que será aberto."); return; }
            if (Campos.IdDe(_terminal) is not long terminalId) { Msg.Aviso(this, "Selecione um terminal para abrir."); return; }
            if (Fmt.Centavos(_inicial.Text) is not long inicial) { Msg.Aviso(this, "Valor de suprimento inicial inválido."); return; }
            var r = await Sessao.Api.Post("/api/office/caixa/abrir", new { turnoId, terminalId, inicialCentavos = inicial });
            Msg.Info(this, r.S("mensagem"));
            Concluido = true; DialogResult = DialogResult.OK; Close();
        }), true));
    }
}

public sealed class FormTerminalFechar : Janela
{
    readonly JsonObject _aberto;
    readonly TextBox _proximo = new() { Text = "0", Width = 130 };
    public bool Concluido { get; private set; }
    public string MovimentoId { get; private set; }

    public FormTerminalFechar(JsonObject aberto, JsonObject sumario) : base("Fechar terminal", 660, 700, true)
    {
        _aberto = aberto;
        var inicio = new TableLayoutPanel { Dock = DockStyle.Top, Height = 78, ColumnCount = 2, Padding = new Padding(4, 4, 4, 8) };
        inicio.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50)); inicio.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        inicio.Controls.Add(KitVisual.CartaoResumo("Atendente", Sessao.Nome), 0, 0);
        inicio.Controls.Add(KitVisual.CartaoResumo("Terminal · turno", $"{aberto.S("terminal")} · {aberto.S("turno")}"), 1, 0);
        var linhas = new TableLayoutPanel { Dock = DockStyle.Top, ColumnCount = 2, AutoSize = true, Padding = new Padding(12, 4, 12, 8), BackColor = Color.White };
        linhas.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 62)); linhas.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 38));
        foreach (var (rotulo, chave) in new[]
        {
            ("Total de início do turno", "inicial"), ("Suprimentos", "suprimento"), ("Sangrias", "sangria"), ("Vendas de produtos", "vendasProdutos"),
            ("Vendas", "vendas"), ("Descontos", "desconto"), ("Acréscimos", "acrescimos"), ("Valor recebido", "recebido"), ("Troco", "troco"), ("Total cancelado", "cancelado"),
        }) Linha(rotulo, Fmt.Brl(sumario.L(chave)));
        Linha("Total final", Fmt.Brl(sumario.L("final")), true);
        Linha("Dinheiro em caixa", Fmt.Brl(sumario.L("dinheiroEmCaixa")), true);
        var relatorio = KitVisual.Botao("Gerar relatório", false);
        relatorio.Click += (_, _) => Relatorio.Abrir(this, Sessao.Api.UrlComToken("/relatorio/fechamento?mov=" + _aberto.S("id")), "Fechamento de Caixa");
        var proximo = Campos.Grade(2, 62, 38);
        Campos.Add(proximo, "Valor para o próximo turno (R$)", _proximo, 2);
        var body = new Panel { Dock = DockStyle.Fill, Padding = new Padding(4, 6, 4, 0), AutoScroll = true };
        body.Controls.Add(proximo); body.Controls.Add(relatorio); body.Controls.Add(linhas); body.Controls.Add(inicio);
        Controls.Add(body);
        Rodape(("Cancelar", (_, _) => Close(), false), ("Fechar terminal", (_, _) => Seguro.Rodar(this, async () =>
        {
            if (Fmt.Centavos(_proximo.Text) is not long valor) { Msg.Aviso(this, "Valor para o próximo turno inválido."); return; }
            if (!Msg.Pergunta(this, "Deseja fechar o terminal?")) return;
            var r = await Sessao.Api.Post("/api/office/caixa/fechar", new { proximoTurnoCentavos = valor });
            Concluido = true; MovimentoId = r.S("id"); DialogResult = DialogResult.OK; Close();
        }), false));

        void Linha(string rotulo, string valor, bool destaque = false)
        {
            var nome = new Label { Text = rotulo, Dock = DockStyle.Fill, Height = 28, ForeColor = destaque ? KitVisual.Texto : KitVisual.Secundario, TextAlign = ContentAlignment.MiddleLeft, Font = new Font("Segoe UI", 9F, destaque ? FontStyle.Bold : FontStyle.Regular) };
            var quantia = new Label { Text = valor, Dock = DockStyle.Fill, Height = 28, ForeColor = destaque ? KitVisual.Verde : KitVisual.Texto, TextAlign = ContentAlignment.MiddleRight, Font = new Font("Segoe UI", 9F, FontStyle.Bold) };
            linhas.RowStyles.Add(new RowStyle(SizeType.Absolute, 30)); linhas.Controls.Add(nome); linhas.Controls.Add(quantia); linhas.SetCellPosition(nome, new TableLayoutPanelCellPosition(0, linhas.RowCount)); linhas.SetCellPosition(quantia, new TableLayoutPanelCellPosition(1, linhas.RowCount)); linhas.RowCount++;
        }
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
