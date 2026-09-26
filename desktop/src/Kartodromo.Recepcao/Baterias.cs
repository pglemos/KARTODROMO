using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

/// <summary>Campos de uma bateria (FormCreateBooking / FormEditBooking do LapTime).</summary>
public class CamposBateria : Panel
{
    public readonly TextBox Nome = Campos.Texto(100), CodReserva = Campos.Texto(20), Resp = new() { ReadOnly = true }, Obs = Campos.Texto(400);
    public readonly DateTimePicker Data = Campos.Data(), Hora = Campos.Hora();
    public readonly NumericUpDown Vagas = Campos.Num(30, 1, 500), VoltaMin = Campos.Num(5, 0, 600);
    public readonly ComboBox Produto = Campos.Combo(), Tracado = Campos.Combo();
    public readonly CheckBox Fechada = Campos.Check("Reserva fechada (grupo/evento, não aparece no totem)"), Totem = Campos.Check("Aparece no autoatendimento", true);
    public long? RespId;

    public CamposBateria(JsonObject b = null)
    {
        Dock = DockStyle.Top; AutoSize = true;
        Produto.Items.AddRange(Sessao.Produtos(false));
        Tracado.Items.AddRange(Sessao.Tracados());
        if (Tracado.Items.Count > 0) Tracado.SelectedIndex = 0;
        if (Produto.Items.Count > 0) Produto.SelectedIndex = 0;
        var g1 = Campos.Grade(4, 46, 22, 14, 18);
        Campos.Add(g1, "Nome da reserva *", Nome); Campos.Add(g1, "Data", Data); Campos.Add(g1, "Hora", Hora); Campos.Add(g1, "Competidores (máx) *", Vagas);
        Campos.Add(g1, "PRODUTO *", Produto, 2); Campos.Add(g1, "TRAÇADO *", Tracado); Campos.Add(g1, "TEMPO MÍNIMO POR VOLTA (seg)", VoltaMin);
        var fs = new GroupBox { Text = "RESPONSÁVEL PELA RESERVA", Dock = DockStyle.Top, Height = 62, Padding = new Padding(6, 2, 6, 4) };
        var linha = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 5 };
        linha.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); for (var i = 0; i < 4; i++) linha.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        var bP = new Button { Text = "Pesquisar cliente", AutoSize = true }; var bX = new Button { Text = "✕", Width = 30 }; var bG = new Button { Text = "Gerar", AutoSize = true };
        bP.Click += (_, _) => { var c = FormPesquisarCliente.Escolher(FindForm(), "Responsável pela reserva"); if (c != null) { RespId = c.L("id"); Resp.Text = c.S("nome"); } };
        bX.Click += (_, _) => { RespId = null; Resp.Text = ""; };
        bG.Click += (_, _) => CodReserva.Text = Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();
        Resp.Dock = DockStyle.Fill; CodReserva.Width = 110;
        linha.Controls.AddRange([Resp, bP, bX, new Label { Text = "Código de reserva", AutoSize = true, Margin = new Padding(8, 6, 2, 0) }, CodReserva]);
        linha.Controls.Add(bG);
        linha.ColumnCount = 6;
        fs.Controls.Add(linha);
        var g2 = Campos.Grade(2);
        Campos.Add(g2, null, Fechada); Campos.Add(g2, null, Totem);
        Campos.Add(g2, "Observações", Obs, 2);
        Controls.Add(g2); Controls.Add(fs); Controls.Add(g1);
        if (b != null)
        {
            Nome.Text = b.S("nome");
            var d = b.D("dataHora") ?? DateTime.Today.AddHours(17);
            Data.Value = d.Date; Hora.Value = d;
            Vagas.Value = Math.Max(1, b.I("vagas"));
            Campos.Selecionar(Produto, b.L("produtoId")); Campos.Selecionar(Tracado, b.L("tracadoId"));
            VoltaMin.Value = Math.Clamp(b.I("voltaMinimaSeg"), 0, 600);
            RespId = b.L("responsavelId"); Resp.Text = b.S("responsavel");
            CodReserva.Text = b.S("codigoReserva"); Fechada.Checked = b.B("reservaFechada"); Totem.Checked = b.B("autoAtendimento"); Obs.Text = b.S("observacao");
        }
    }

    public object Corpo() => new
    {
        nome = Nome.Text.Trim(), inicio = $"{Fmt.Iso(Data.Value)}T{Hora.Value:HH:mm}", vagas = (int)Vagas.Value, produtoId = Campos.IdDe(Produto), tracadoId = Campos.IdDe(Tracado),
        voltaMinimaSeg = (int)VoltaMin.Value, responsavelId = RespId, codigoReserva = CodReserva.Text.Trim(), reservaFechada = Fechada.Checked, autoAtendimento = Totem.Checked, observacao = Obs.Text.Trim(),
    };
}

/// <summary>Toolbar "Reservas": gerar pela configuracao padrao (dias da semana) ou criar uma bateria avulsa.</summary>
public class FormCriarReservas : Janela
{
    public FormCriarReservas() : base("Criar Reservas", 820, 540)
    {
        var rbPad = new RadioButton { Text = "USAR CONFIGURAÇÕES DO SISTEMA:", Checked = true, AutoSize = true, Font = Tema.Negrito, Dock = DockStyle.Top };
        var rbAv = new RadioButton { Text = "USAR CONFIGURAÇÕES ABAIXO:", AutoSize = true, Font = Tema.Negrito, Dock = DockStyle.Top };
        var pad = Campos.Combo(); pad.Items.AddRange(Sessao.Padroes()); if (pad.Items.Count > 0) pad.SelectedIndex = 0;
        var de = Campos.Data();
        var ate = Campos.Data(new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1).AddMonths(1).AddDays(-1));
        var gp = Campos.Grade(3, 50, 25, 25);
        Campos.Add(gp, "Configuração padrão", pad); Campos.Add(gp, "De", de); Campos.Add(gp, "Até", ate);
        var dias = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 28 };
        string[] nomes = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        var cks = nomes.Select((n, i) => new CheckBox { Text = n, Tag = i, AutoSize = true }).ToArray();
        dias.Controls.AddRange(cks);
        var dica = new Label { Text = "Feriados cadastrados e horários que já existem são pulados.", Dock = DockStyle.Top, Height = 20, ForeColor = Tema.Cinza };
        var boxPad = new GroupBox { Dock = DockStyle.Top, Height = 132, Padding = new Padding(8, 4, 8, 4) };
        boxPad.Controls.Add(dica); boxPad.Controls.Add(dias); boxPad.Controls.Add(gp);
        var campos = new CamposBateria();
        var boxAv = new GroupBox { Dock = DockStyle.Fill, Padding = new Padding(8, 4, 8, 4), Enabled = false };
        boxAv.Controls.Add(campos);
        void Modo() { boxPad.Enabled = rbPad.Checked; boxAv.Enabled = rbAv.Checked; }
        rbPad.CheckedChanged += (_, _) => Modo();
        var corpo = new Panel { Dock = DockStyle.Fill, Padding = new Padding(10) };
        corpo.Controls.Add(boxAv); corpo.Controls.Add(rbAv); corpo.Controls.Add(boxPad); corpo.Controls.Add(rbPad);
        Controls.Add(corpo);
        Rodape(("Cancelar", (_, _) => Close(), false),
            ("Gerar Reservas do Mês", (_, _) => Seguro.Rodar(this, async () =>
            {
                if (!rbPad.Checked) { Msg.Aviso(this, "Marque \"USAR CONFIGURAÇÕES DO SISTEMA\" para gerar pelo padrão."); return; }
                var sel = cks.Where(c => c.Checked).Select(c => (int)c.Tag).ToArray();
                if (sel.Length == 0) { Msg.Aviso(this, "Selecione pelo menos um dia da semana antes de criar as reservas."); return; }
                if (Campos.IdDe(pad) is not long pid) { Msg.Aviso(this, "Selecione uma configuração padrão antes de criar as reservas."); return; }
                var r = await Sessao.Api.Post("/api/office/baterias/gerar", new { padraoId = pid, de = Fmt.Iso(de.Value), ate = Fmt.Iso(ate.Value), diasSemana = sel });
                Msg.Info(this, r.I("criadas") > 0 ? $"{r.I("criadas")} reservas geradas com sucesso." : "Nenhuma reserva gerada.");
                DialogResult = DialogResult.OK; Close();
            }), false),
            ("Gerar Reserva", (_, _) => Seguro.Rodar(this, async () =>
            {
                if (!rbAv.Checked) { Msg.Aviso(this, "Marque \"USAR CONFIGURAÇÕES ABAIXO\" para criar uma reserva avulsa."); return; }
                if (string.IsNullOrWhiteSpace(campos.Nome.Text)) { Msg.Aviso(this, "Insira um nome para a reserva."); return; }
                await Sessao.Api.Post("/api/office/baterias", campos.Corpo());
                Msg.Info(this, "Reserva gerada com sucesso.");
                DialogResult = DialogResult.OK; Close();
            }), false));
    }
}

public class FormBateria : Janela
{
    public FormBateria(JsonObject b) : base("Editar Bateria", 820, 300)
    {
        var campos = new CamposBateria(b);
        Controls.Add(new Panel { Dock = DockStyle.Fill, Padding = new Padding(10), Controls = { campos } });
        Rodape(("Cancelar", (_, _) => Close(), false), ("Salvar", (_, _) => Seguro.Rodar(this, async () =>
        {
            if (string.IsNullOrWhiteSpace(campos.Nome.Text)) { Msg.Aviso(this, "Insira um nome."); return; }
            await Sessao.Api.Put($"/api/office/baterias/{b.S("id")}", campos.Corpo());
            Msg.Info(this, "Bateria editada com sucesso!");
            DialogResult = DialogResult.OK; Close();
        }), true));
    }
}

/// <summary>"Registra Reserva por Cliente": cliente + numero de participantes.</summary>
public class FormIncluirCliente : Janela
{
    JsonObject _cli;
    public FormIncluirCliente(JsonObject b) : base("Registra Reserva por Cliente", 640, 190)
    {
        var info = new Label { Text = $"{b.S("nome")} · {Fmt.DmyHm(b.S("dataHora"))} · vagas disponíveis: {b.I("disponiveis")}", Dock = DockStyle.Top, Height = 22, Font = Tema.Negrito };
        var cli = new TextBox { ReadOnly = true };
        var bp = new Button { Text = "Pesquisar Cliente", Height = 24 };
        var n = Campos.Num(1, 1, 100);
        var obs = Campos.Texto(400);
        var g = Campos.Grade(3, 60, 22, 18);
        Campos.Add(g, "Cliente", cli); Campos.Add(g, " ", bp); Campos.Add(g, "PARTICIPANTES", n);
        Campos.Add(g, "Observação", obs, 3);
        var nota = new Label { Text = "Com mais de 1 participante, as vagas ficam no nome do cliente; depois use \"Alterar Cliente\" em cada reserva para colocar quem vai correr.", Dock = DockStyle.Top, Height = 34, ForeColor = Tema.Cinza };
        bp.Click += (_, _) => { var c = FormPesquisarCliente.Escolher(this); if (c != null) { _cli = c; cli.Text = $"{c.S("nome")} — {c.S("documento")}"; } };
        var corpo = new Panel { Dock = DockStyle.Fill, Padding = new Padding(10) };
        corpo.Controls.Add(nota); corpo.Controls.Add(g); corpo.Controls.Add(info);
        Controls.Add(corpo);
        Rodape(("Cancelar", (_, _) => Close(), false), ("Reservar", (_, _) => Seguro.Rodar(this, async () =>
        {
            if (_cli == null) { Msg.Aviso(this, "Selecione um cliente."); return; }
            var r = await Sessao.Api.Post($"/api/office/baterias/{b.S("id")}/incluir", new { clienteId = _cli.L("id"), participantes = (int)n.Value, observacao = obs.Text });
            Msg.Info(this, r.S("mensagem"));
            DialogResult = DialogResult.OK; Close();
        }), true));
        Shown += (_, _) => bp.PerformClick();
    }
}

/// <summary>"Agenda de Reservas de Bateria": calendario mensal + baterias do dia + reservar para cliente.</summary>
public class FormAgenda : Janela
{
    static Api Api => Sessao.Api;
    readonly MonthCalendar _cal = new() { MaxSelectionCount = 1, Dock = DockStyle.Top };
    readonly ComboBox _bats = Campos.Combo();
    readonly Label _info = new() { Dock = DockStyle.Fill, Padding = new Padding(4) };
    readonly TextBox _q = new(), _obs = Campos.Texto(400);
    readonly RadioButton _rCpf = new() { Text = "CPF", Checked = true, AutoSize = true }, _rEmail = new() { Text = "E-mail", AutoSize = true }, _rNome = new() { Text = "Nome", AutoSize = true };
    readonly Label _cli = new() { AutoSize = true, ForeColor = Tema.Azul, Font = Tema.Negrito };
    readonly NumericUpDown _n = Campos.Num(1, 1, 100);
    readonly Grade _g = new();
    readonly Label _resumo = new() { Dock = DockStyle.Top, Height = 34, ForeColor = Tema.Cinza };
    List<JsonObject> _lista = [];
    JsonObject _bat, _cliente;

    public FormAgenda() : base("Agenda de Reservas de Bateria", 1100, 600)
    {
        var esq = new Panel { Dock = DockStyle.Left, Width = 250, Padding = new Padding(8) };
        var gbInfo = new GroupBox { Text = "INFORMAÇÕES DA BATERIA", Dock = DockStyle.Fill };
        gbInfo.Controls.Add(_info);
        esq.Controls.Add(gbInfo); esq.Controls.Add(_resumo); esq.Controls.Add(_cal);

        var dir = new Panel { Dock = DockStyle.Fill, Padding = new Padding(8) };
        var linhaBat = Campos.Grade(2, 80, 20);
        var bEd = new Button { Text = "Editar Bateria", Height = 24 };
        bEd.Click += (_, _) => { if (_bat != null && new FormBateria(_bat).ShowDialog(this) == DialogResult.OK) CarregaDia(); };
        Campos.Add(linhaBat, "Baterias disponíveis", _bats); Campos.Add(linhaBat, " ", bEd);
        var gbCli = new GroupBox { Text = "Pesquisar Cliente", Dock = DockStyle.Top, Height = 104, Padding = new Padding(8, 4, 8, 4) };
        var radios = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 26 };
        radios.Controls.AddRange([_rCpf, _rEmail, _rNome]);
        var busca = new TableLayoutPanel { Dock = DockStyle.Top, Height = 30, ColumnCount = 3 };
        busca.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); busca.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize)); busca.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        var bS = new Button { Text = "Pesquisar", AutoSize = true }; var bN = new Button { Text = "Novo cliente", AutoSize = true };
        _q.Dock = DockStyle.Fill;
        busca.Controls.AddRange([_q, bS, bN]);
        var linhaCli = new Panel { Dock = DockStyle.Top, Height = 22 }; linhaCli.Controls.Add(_cli);
        gbCli.Controls.Add(linhaCli); gbCli.Controls.Add(busca); gbCli.Controls.Add(radios);
        var linhaRes = Campos.Grade(3, 18, 62, 20);
        var bR = new Button { Text = "Reservar", Height = 24 };
        Campos.Add(linhaRes, "PARTICIPANTES", _n); Campos.Add(linhaRes, "OBSERVAÇÕES", _obs); Campos.Add(linhaRes, " ", bR);
        _g.Colunas(new("cliente", "Cliente", Largura: 230), new("pago", "Pago", TipoCol.Bool), new("aprovada", "Aprovada", TipoCol.Bool), new("produto", "Produto", Largura: 200), new("total", "Total", TipoCol.Dinheiro));
        _g.MenuDe = sel => [
            new ToolStripMenuItem("Aprovar / Receber", null, (_, _) => { Caixa.CheckoutDeReservas(this, sel); CarregaReservas(); }) { Enabled = sel.Count > 0 && !sel.Any(r => r.B("pago")) },
            new ToolStripMenuItem("Imprimir Termo", null, (_, _) => Acoes.ImprimirTermo(this, sel.Select(r => r.S("id")))),
            new ToolStripMenuItem("Excluir", null, (_, _) => Seguro.Rodar(this, async () =>
            {
                if (sel.Any(r => r.B("pago"))) { Msg.Aviso(this, "Não é permitido excluir reservas pagas!"); return; }
                if (!Msg.Pergunta(this, "Deseja realmente excluir a reserva agendada?")) return;
                foreach (var r in sel) await Api.Delete($"/api/office/reservas/{r.S("id")}");
                CarregaDia();
            })),
        ];
        var gGrid = new Panel { Dock = DockStyle.Fill, Padding = new Padding(0, 6, 0, 0) };
        gGrid.Controls.Add(_g); gGrid.Controls.Add(new Label { Text = "Reservas da bateria", Dock = DockStyle.Top, Height = 20, Font = Tema.Negrito });
        dir.Controls.Add(gGrid); dir.Controls.Add(linhaRes); dir.Controls.Add(gbCli); dir.Controls.Add(linhaBat);

        Controls.Add(dir); Controls.Add(esq);
        Rodape(("Agenda Mensal", (_, _) => Relatorio.Abrir(this, Api.UrlComToken("/relatorio/agenda?mes=" + _cal.SelectionStart.ToString("yyyy-MM")), "Agenda Mensal"), false), ("Fechar", (_, _) => Close(), false));

        _cal.DateSelected += (_, _) => CarregaDia();
        _cal.DateChanged += (_, _) => CarregaMes();
        _bats.SelectedIndexChanged += (_, _) => EscolheBateria();
        void Pesquisa() { var c = FormPesquisarCliente.Escolher(this, "Pesquisar Cliente", _q.Text); if (c != null) { _cliente = c; _cli.Text = $"{c.S("nome")} · {c.S("documento")}"; } }
        bS.Click += (_, _) => Pesquisa();
        _q.KeyDown += (_, e) => { if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; Pesquisa(); } };
        bN.Click += (_, _) => Seguro.Rodar(this, async () => { var id = FormCliente.Novo(this, _q.Text); if (id != null) { _cliente = (await Api.Get($"/api/office/clientes/{id}")).AsObject(); _cli.Text = $"{_cliente.S("nome")} · {_cliente.S("documento")}"; } });
        bR.Click += (_, _) => Seguro.Rodar(this, async () =>
        {
            if (_bat == null) { Msg.Aviso(this, "Selecione uma bateria."); return; }
            if (_cliente == null) { Msg.Aviso(this, "Selecione um cliente."); return; }
            var r = await Api.Post($"/api/office/baterias/{_bat.S("id")}/incluir", new { clienteId = _cliente.L("id"), participantes = (int)_n.Value, observacao = _obs.Text });
            Msg.Info(this, r.S("mensagem"));
            _cliente = null; _cli.Text = ""; _q.Text = ""; _n.Value = 1; _obs.Text = "";
            var manter = _bat.S("id");
            await CarregaDiaAsync();
            foreach (var o in _bats.Items) if (o is Campos.Item it && it.Id.ToString() == manter) _bats.SelectedItem = o;
        });
        Load += (_, _) => { CarregaMes(); CarregaDia(); };
    }

    void CarregaMes() => Seguro.Rodar(this, async () =>
    {
        var mes = _cal.SelectionStart.ToString("yyyy-MM");
        var r = await Api.Lista("/api/office/agenda?mes=" + mes);
        _cal.BoldedDates = r.Select(x => Fmt.ParseData(x.S("dia")) ?? DateTime.MinValue).Where(d => d != DateTime.MinValue).ToArray();
        _resumo.Text = $"{r.Sum(x => x.I("baterias"))} baterias no mês · {r.Sum(x => x.I("reservas"))} reservas";
    });

    void CarregaDia() => Seguro.Rodar(this, CarregaDiaAsync);

    async Task CarregaDiaAsync()
    {
        _lista = await Api.Lista($"/api/office/baterias?status=todas&filtro=dia&data={Fmt.Iso(_cal.SelectionStart)}");
        _bats.Items.Clear();
        _bats.Items.AddRange(_lista.Select(b => new Campos.Item(b.L("id") ?? 0, $"{Fmt.Hm(b.S("dataHora"))} · {b.S("nome")} · {b.I("disponiveis")} vagas{(b.S("status") != "aberta" ? " (fechada)" : "")}", b)).ToArray());
        var agora = DateTime.Now;
        var prox = _bats.Items.Cast<Campos.Item>().FirstOrDefault(i => (i.Dados.D("dataHora") ?? DateTime.MinValue) >= agora) ?? _bats.Items.Cast<Campos.Item>().FirstOrDefault();
        if (prox != null) _bats.SelectedItem = prox; else { _bat = null; _info.Text = "Nenhuma bateria neste dia."; _g.Carregar([]); }
    }

    void EscolheBateria()
    {
        _bat = (_bats.SelectedItem as Campos.Item)?.Dados;
        if (_bat == null) return;
        _info.Text = $"{_bat.S("nome")} — {Fmt.DmyHm(_bat.S("dataHora"))}\n\nPRODUTO: {_bat.S("produto")}\nTRAÇADO: {_bat.S("tracado")}\nTEMPO MÍNIMO POR VOLTA (segundos): {_bat.S("voltaMinimaSeg")}\n" +
            $"COMPETIDORES: {_bat.I("inscritos")}/{_bat.I("vagas")} (disponíveis {_bat.I("disponiveis")})\nPAGOS: {_bat.I("pagos")}" + (_bat.S("observacao") is { Length: > 0 } o ? $"\n\nOBSERVAÇÕES: {o}" : "");
        CarregaReservas();
    }

    void CarregaReservas() => Seguro.Rodar(this, async () =>
    {
        if (_bat == null) return;
        _g.Carregar((await Api.Lista($"/api/office/reservas?status=todas&bateriaId={_bat.S("id")}")).Where(r => r.S("status") != "cancelada"));
    });
}
