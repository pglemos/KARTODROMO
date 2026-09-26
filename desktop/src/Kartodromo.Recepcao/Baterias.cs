using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

/// <summary>Campos de uma bateria (EditarBateria.dc.html / FormCreateBooking do LapTime).</summary>
public class CamposBateria : Panel
{
    public readonly TextBox Nome = Campos.Texto(100), CodReserva = Campos.Texto(20), Resp = new() { ReadOnly = true }, Obs = Campos.Texto(400);
    public readonly DateTimePicker Data = Campos.Data(), Hora = Campos.Hora();
    public readonly NumericUpDown Vagas = Campos.Num(12, 1, 500), VoltaMin = Campos.Num(40, 0, 600);
    public readonly ComboBox Produto = Campos.Combo(), Tracado = Campos.Combo(), Categoria = Campos.Combo("Indoor", "Outdoor", "Pro");
    public readonly CheckBox Aberta = Campos.Check("Aberta para reservas", true), Totem = Campos.Check("Aparece no totem", true);
    public long? RespId;
    public event Action ProdutoMudou;

    public CamposBateria(JsonObject b = null)
    {
        Dock = DockStyle.Top; AutoSize = true;
        Produto.Items.AddRange(Sessao.Produtos(false));
        Tracado.Items.AddRange(Sessao.Tracados());
        if (Tracado.Items.Count > 0) Tracado.SelectedIndex = 0;
        if (Produto.Items.Count > 0) Produto.SelectedIndex = 0;
        Produto.SelectedIndexChanged += (_, _) => ProdutoMudou?.Invoke();

        var g = Campos.Grade(6);
        Campos.Add(g, "Nome", Nome, 2);
        Campos.Add(g, "Data", Data, 1);
        Campos.Add(g, "Hora", Hora, 1);
        Campos.Add(g, "Vagas (máx)", Vagas, 1);
        Campos.Add(g, "Volta mínima (s)", VoltaMin, 1);

        Campos.Add(g, "Produto", Produto, 3);
        Campos.Add(g, "Traçado", Tracado, 2);
        Campos.Add(g, "Categoria", Categoria, 1);

        var pResp = new Panel { Dock = DockStyle.Fill, Height = 34 };
        var bP = new Button { Text = "Pesquisar", Dock = DockStyle.Right, Width = 84, FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(238, 238, 241), Cursor = Cursors.Hand };
        bP.FlatAppearance.BorderSize = 0;
        Resp.Dock = DockStyle.Fill;
        bP.Click += (_, _) => { var c = FormPesquisarCliente.Escolher(FindForm(), "Responsável pela reserva"); if (c != null) { RespId = c.L("id"); Resp.Text = c.S("nome"); } };
        pResp.Controls.Add(Resp); pResp.Controls.Add(bP);

        Campos.Add(g, "Responsável", pResp, 2);
        Campos.Add(g, " ", Aberta, 2);
        Campos.Add(g, "  ", Totem, 2);

        Campos.Add(g, "Observações", Obs, 6);
        Controls.Add(g);

        if (b != null)
        {
            Nome.Text = b.S("nome");
            var d = b.D("dataHora") ?? DateTime.Today.AddHours(17);
            Data.Value = d.Date; Hora.Value = d;
            Vagas.Value = Math.Max(1, b.I("vagas"));
            Campos.Selecionar(Produto, b.L("produtoId"));
            Campos.Selecionar(Tracado, b.L("tracadoId"));
            VoltaMin.Value = Math.Clamp(b.I("voltaMinimaSeg"), 0, 600);
            RespId = b.L("responsavelId"); Resp.Text = b.S("responsavel");
            CodReserva.Text = b.S("codigoReserva");
            Aberta.Checked = !b.B("reservaFechada");
            Totem.Checked = b.B("autoAtendimento");
            Obs.Text = b.S("observacao");
            if (!string.IsNullOrEmpty(b.S("categoria"))) Categoria.Text = b.S("categoria");
        }
    }

    public object Corpo() => new
    {
        nome = Nome.Text.Trim(), inicio = $"{Fmt.Iso(Data.Value)}T{Hora.Value:HH:mm}", vagas = (int)Vagas.Value, produtoId = Campos.IdDe(Produto), tracadoId = Campos.IdDe(Tracado),
        voltaMinimaSeg = (int)VoltaMin.Value, responsavelId = RespId, codigoReserva = CodReserva.Text.Trim(), reservaFechada = !Aberta.Checked, autoAtendimento = Totem.Checked, observacao = Obs.Text.Trim(),
        categoria = Categoria.Text
    };
}

/// <summary>Toolbar "Reservas": gerar pela configuracao padrao ou reserva avulsa (CriarReservas.dc.html).</summary>
public class FormCriarReservas : Janela
{
    public FormCriarReservas() : base("Criar Reservas", 960, 680)
    {
        Tag = "Gere as baterias do mês pelo padrão, ou uma reserva avulsa";

        var painelPadrao = new Panel { Dock = DockStyle.Fill, AutoSize = true, BackColor = Color.Transparent };
        var painelAvulsa = new Panel { Dock = DockStyle.Fill, AutoSize = true, BackColor = Color.Transparent, Visible = false };

        // --- Aba 1: Pelo padrão ---
        var pad = Campos.Combo(); pad.Items.AddRange(Sessao.Padroes()); if (pad.Items.Count > 0) pad.SelectedIndex = 0;
        var de = Campos.Data();
        var ate = Campos.Data(new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1).AddMonths(1).AddDays(-1));
        var ckAtivo = Campos.Check("Ativo", true);

        var gConfig = Campos.Grade(6);
        Campos.Add(gConfig, "Configuração padrão", pad, 3);
        Campos.Add(gConfig, "De", de, 1);
        Campos.Add(gConfig, "Até", ate, 1);
        Campos.Add(gConfig, " ", ckAtivo, 1);

        var cartaoConfig = KitVisual.CartaoSecao("Usar configuração do sistema");
        cartaoConfig.Controls.Add(gConfig);

        string[] nomes = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        var cks = nomes.Select((n, i) => new CheckBox { Text = n, Tag = i, AutoSize = true, Checked = i is >= 2 and <= 6 }).ToArray();
        var gDias = Campos.Grade(7);
        for (var i = 0; i < 7; i++) Campos.Add(gDias, null, cks[i]);

        var gFlags = Campos.Grade(6);
        var ckFeriados = Campos.Check("Pular feriados cadastrados", true);
        var ckExistentes = Campos.Check("Pular horários que já existem", true);
        Campos.Add(gFlags, null, ckFeriados, 3);
        Campos.Add(gFlags, null, ckExistentes, 3);

        var cartaoDias = KitVisual.CartaoSecao("Dias da semana");
        cartaoDias.Controls.Add(gFlags);
        cartaoDias.Controls.Add(gDias);

        var cartaoPrevia = KitVisual.CartaoSecao("Prévia");
        cartaoPrevia.BackColor = Color.FromArgb(245, 245, 247);
        var lPrevia = new Label { Text = "Baterias geradas conforme a configuração selecionada. Feriados cadastrados e horários já existentes são pulados automaticamente.", Dock = DockStyle.Fill, ForeColor = Color.FromArgb(58, 58, 60), Font = new Font("Segoe UI", 9.2F), Padding = new Padding(4) };
        cartaoPrevia.Controls.Add(lPrevia);

        painelPadrao.Controls.Add(cartaoPrevia);
        painelPadrao.Controls.Add(cartaoDias);
        painelPadrao.Controls.Add(cartaoConfig);

        // --- Aba 2: Reserva avulsa ---
        var campos = new CamposBateria();
        var cartaoAvulsa = KitVisual.CartaoSecao("Reserva avulsa");
        cartaoAvulsa.Controls.Add(campos);
        painelAvulsa.Controls.Add(cartaoAvulsa);

        Button btnAcao = null;
        var botoesRodape = Rodape(
            ("Cancelar", (_, _) => Close(), false),
            ("Gerar Reservas do Mês", (_, _) => Seguro.Rodar(this, async () =>
            {
                if (painelAvulsa.Visible)
                {
                    if (string.IsNullOrWhiteSpace(campos.Nome.Text)) { Msg.Aviso(this, "Insira um nome para a reserva."); return; }
                    await Sessao.Api.Post("/api/office/baterias", campos.Corpo());
                    Msg.Info(this, "Reserva gerada com sucesso.");
                    DialogResult = DialogResult.OK; Close();
                    return;
                }
                var sel = cks.Where(c => c.Checked).Select(c => (int)c.Tag).ToArray();
                if (sel.Length == 0) { Msg.Aviso(this, "Selecione pelo menos um dia da semana antes de criar as reservas."); return; }
                if (Campos.IdDe(pad) is not long pid) { Msg.Aviso(this, "Selecione uma configuração padrão antes de criar as reservas."); return; }
                var r = await Sessao.Api.Post("/api/office/baterias/gerar", new { padraoId = pid, de = Fmt.Iso(de.Value), ate = Fmt.Iso(ate.Value), diasSemana = sel });
                Msg.Info(this, r.I("criadas") > 0 ? $"{r.I("criadas")} reservas geradas com sucesso." : "Nenhuma reserva gerada.");
                DialogResult = DialogResult.OK; Close();
            }), true)
        );

        if (botoesRodape is Panel pnl)
        {
            var flw = pnl.Controls.OfType<FlowLayoutPanel>().FirstOrDefault();
            btnAcao = flw?.Controls.OfType<Button>().FirstOrDefault(b => b.Text.StartsWith("Gerar"));
        }

        var abas = KitVisual.AbaSegmentada(["Pelo padrão (mês inteiro)", "Reserva avulsa"], 0, idx =>
        {
            painelPadrao.Visible = idx == 0;
            painelAvulsa.Visible = idx == 1;
            if (btnAcao != null) btnAcao.Text = idx == 0 ? "Gerar Reservas do Mês" : "Gerar Reserva";
        });

        Controls.Add(painelAvulsa);
        Controls.Add(painelPadrao);
        Controls.Add(abas);
    }
}

/// <summary>Editar bateria — igual ao design aprovado (EditarBateria.dc.html): Nome, Data, Hora, Vagas (máx),
/// Volta mínima (s) · Produto, Traçado, Categoria · Responsável, Aberta para reservas, Aparece no totem · Provas.</summary>
public class FormBateria : DialogoDesign
{
    public FormBateria(JsonObject b) : base("Editar bateria", $"{b.S("nome")} · {Fmt.Dmy(b.S("dataHora"))}", "g-baterias")
    {
        var inicio = b.D("dataHora") ?? DateTime.Today.AddHours(17);
        var nome = PecasDesign.Texto(b.S("nome"), 100);
        var data = new DataDesign(inicio.Date);
        var hora = PecasDesign.Hora(inicio);
        var vagas = PecasDesign.Numero(Math.Max(1, b.I("vagas")), 3);
        var volta = PecasDesign.Numero(Math.Max(0, b.I("voltaMinimaSeg")), 3);
        var produto = new ListaDesign();
        produto.Items.AddRange(Sessao.Lista("produtos").Select(p => (object)new Campos.Item(p.L("id") ?? 0, p.S("nome"), p)).ToArray());
        Campos.Selecionar(produto, b.L("produtoId"));
        if (produto.SelectedIndex < 0 && produto.Items.Count > 0) produto.SelectedIndex = 0;
        var tracado = new ListaDesign();
        tracado.Items.AddRange(Sessao.Tracados());
        Campos.Selecionar(tracado, b.L("tracadoId"));
        if (tracado.SelectedIndex < 0 && tracado.Items.Count > 0) tracado.SelectedIndex = 0;
        var categoria = new ListaDesign();
        void CategoriaDoProduto()
        {
            // a categoria vem do produto escolhido
            var cat = (produto.SelectedItem as Campos.Item)?.Dados?.S("categoria") is { Length: > 0 } c ? c : b.S("categoria");
            categoria.Items.Clear(); categoria.Items.Add(cat.Length > 0 ? cat : "—"); categoria.SelectedIndex = 0;
        }
        CategoriaDoProduto();

        long? respId = b.L("responsavelId");
        var resp = new Label { Text = b.S("responsavel"), AutoSize = false, Height = 22, Font = PecasDesign.FonteValor, ForeColor = PecasDesign.CorTexto, BackColor = Color.White, TextAlign = ContentAlignment.MiddleLeft, Cursor = Cursors.Hand };
        var setaResp = new Panel { Width = 20, Height = 22, BackColor = Color.White, Cursor = Cursors.Hand };
        setaResp.Paint += (_, e) => PecasDesign.DesenharSeta(e.Graphics, setaResp.ClientRectangle);
        void EscolherResponsavel()
        {
            var cli = FormPesquisarCliente.Escolher(this, "Responsável pela reserva");
            if (cli != null) { respId = cli.L("id"); resp.Text = cli.S("nome"); }
        }
        resp.Click += (_, _) => EscolherResponsavel(); setaResp.Click += (_, _) => EscolherResponsavel();
        var menuResp = new ContextMenuStrip();
        menuResp.Items.Add("Tirar o responsável", null, (_, _) => { respId = null; resp.Text = ""; });
        resp.ContextMenuStrip = menuResp;

        var aberta = new CheckBox { Text = "Aberta para reservas", Checked = !b.B("reservaFechada") };
        var totem = new CheckBox { Text = "Aparece no totem", Checked = b.B("autoAtendimento") };

        var g = Secao("Bateria");
        Campo(g, "Nome", nome, 2);
        Campo(g, "Data", data, 1);
        Campo(g, "Hora", hora, 1);
        Campo(g, "Vagas (máx)", vagas, 1);
        Campo(g, "Volta mínima (s)", volta, 1);
        Campo(g, "Produto", produto, 3);
        Campo(g, "Traçado", tracado, 2);
        Campo(g, "Categoria", categoria, 1);
        Campo(g, "Responsável", resp, 2, setaResp);
        Marca(g, aberta, 2);
        Marca(g, totem, 2);

        var provas = SecaoTabelaDesign("Provas (vêm do produto)");
        provas.Colunas(new("Ordem", 0.9f), new("Prova", 5.2f), new("Tipo", 2.6f), new("Tempo", 1.1f, Direita: true));
        async Task CarregarProvas()
        {
            if (Campos.IdDe(produto) is not long pid) { provas.Linhas([]); return; }
            var lista = await Sessao.Api.Lista($"/api/office/cad/provas?produtoId={pid}");
            provas.Linhas(lista.OrderBy(p => p.I("ordem")).Select(p => new[]
            {
                p.I("ordem").ToString(), p.S("nome"),
                p.S("tipo") switch { "classificacao" => "Classificatório", "corrida" => "Corrida", "treino" => "Treino", var t => t },
                p.I("tempoMin") > 0 ? $"{p.I("tempoMin")} min" : p.I("voltasMax") > 0 ? $"{p.I("voltasMax")} voltas" : "—",
            }));
        }
        produto.SelectedIndexChanged += (_, _) => { CategoriaDoProduto(); Seguro.Rodar(this, CarregarProvas); };

        BotaoRodape("Salvar", true, () => Seguro.Rodar(this, async () =>
        {
            if (string.IsNullOrWhiteSpace(nome.Text)) { Msg.Aviso(this, "Insira um nome."); return; }
            if (!data.Valida) { Msg.Aviso(this, "Data inválida. Use dd/mm/aaaa."); return; }
            if (!PecasDesign.LerHora(hora, out var h)) { Msg.Aviso(this, "Hora inválida. Use hh:mm."); return; }
            if (!int.TryParse(vagas.Text, out var nVagas) || nVagas < 1) { Msg.Aviso(this, "Informe as vagas (máximo de pilotos)."); return; }
            if (nVagas < b.I("inscritos")) { Msg.Aviso(this, $"A bateria já tem {b.I("inscritos")} inscrito(s). As vagas não podem ficar abaixo disso."); return; }
            int.TryParse(volta.Text, out var nVolta);
            await Sessao.Api.Put($"/api/office/baterias/{b.S("id")}", new
            {
                nome = nome.Text.Trim(), inicio = $"{Fmt.Iso(data.Value)}T{h.Hours:00}:{h.Minutes:00}", vagas = nVagas, produtoId = Campos.IdDe(produto), tracadoId = Campos.IdDe(tracado),
                voltaMinimaSeg = nVolta, responsavelId = respId, codigoReserva = b.S("codigoReserva"), reservaFechada = !aberta.Checked, autoAtendimento = totem.Checked,
                observacao = b.S("observacao"), categoria = categoria.Text,
            });
            Msg.Info(this, "Bateria editada com sucesso!");
            DialogResult = DialogResult.OK; Close();
        }));
        BotaoRodape("Cancelar", false, Close);

        Load += (_, _) => Seguro.Rodar(this, CarregarProvas);
    }
}

/// <summary>Registrar reserva por cliente — igual ao design (IncluirCliente.dc.html).</summary>
public class FormIncluirCliente : DialogoDesign
{
    /// <summary>desligado só no autoteste (a pesquisa abriria na tela)</summary>
    public static bool AbrirPesquisaAoMostrar = true;
    JsonObject _cli;
    public FormIncluirCliente(JsonObject b) : base("Registrar reserva por cliente", $"{b.S("nome")} · {Fmt.DmyHm(b.S("dataHora"))} · {b.I("disponiveis")} vagas disponíveis", PecasDesign.Tile(Color.FromArgb(108, 184, 255), Color.FromArgb(30, 111, 232), "pessoa"))
    {
        var cli = new Label { AutoSize = false, Height = 22, Font = PecasDesign.FonteValor, ForeColor = PecasDesign.CorTexto, BackColor = Color.White, TextAlign = ContentAlignment.MiddleLeft, AutoEllipsis = true };
        var pesquisar = AcaoCampo("Pesquisar");
        var n = PecasDesign.Numero(1, 3);
        var novo = new CheckBox { Text = "Novo cliente" };
        void Mostrar(JsonObject c) { _cli = c; cli.Text = c == null ? "" : $"{c.S("nome")} · {c.S("documento")}"; }

        var gCli = Secao("Cliente");
        Campo(gCli, "Cliente", cli, 4, pesquisar);
        Campo(gCli, "Participantes", n, 1);
        Marca(gCli, novo, 1);

        var prod = new ListaDesign();
        prod.Items.AddRange(Sessao.Lista("produtos").Where(p => p.B("ativo")).Select(p => (object)new Campos.Item(p.L("id") ?? 0, $"{p.S("nome")} · {Fmt.Brl(p.L("preco"))}", p)).ToArray());
        Campos.Selecionar(prod, b.L("produtoId"));
        if (prod.SelectedIndex < 0 && prod.Items.Count > 0) prod.SelectedIndex = 0;
        var pago = new CheckBox { Text = "Pago antecipado (site/WhatsApp)" };
        var obs = PecasDesign.Texto("", 400); obs.PlaceholderText = "Opcional";

        var gRes = Secao("Reserva");
        Campo(gRes, "Produto", prod, 3);
        Marca(gRes, pago, 3);
        Campo(gRes, "Observação", obs, 6);

        Nota("Com mais de 1 participante, as vagas ficam no nome do cliente; depois use \"Alterar cliente\" em cada reserva para colocar quem vai correr.");

        pesquisar.Click += (_, _) => { var c = FormPesquisarCliente.Escolher(this); if (c != null) { Mostrar(c); novo.Checked = false; } };
        novo.Click += (_, _) => Seguro.Rodar(this, async () =>
        {
            if (!novo.Checked) return;
            var id = FormCliente.Novo(this);
            if (id == null) { novo.Checked = false; return; }
            Mostrar((await Sessao.Api.Get($"/api/office/clientes/{id}")).AsObject());
        });

        BotaoRodape("Reservar", true, () => Seguro.Rodar(this, async () =>
        {
            if (_cli == null) { Msg.Aviso(this, "Selecione um cliente."); return; }
            if (!int.TryParse(n.Text, out var qtd) || qtd < 1) { Msg.Aviso(this, "Informe quantos participantes."); return; }
            var r = await Sessao.Api.Post($"/api/office/baterias/{b.S("id")}/incluir", new { clienteId = _cli.L("id"), participantes = qtd, observacao = obs.Text.Trim(), produtoId = Campos.IdDe(prod), pagoAntecipado = pago.Checked });
            Msg.Info(this, r.S("mensagem"));
            DialogResult = DialogResult.OK; Close();
        }));
        BotaoRodape("Cancelar", false, Close);
        Shown += (_, _) => { if (AbrirPesquisaAoMostrar) pesquisar.PerformClick(); };
    }
}

/// <summary>"Agenda de Reservas de Bateria": calendario mensal + baterias do dia + reservar para cliente (Agenda.dc.html).</summary>
public class FormAgenda : Janela
{
    static Api Api => Sessao.Api;
    readonly MonthCalendar _cal = new() { MaxSelectionCount = 1, Dock = DockStyle.Top };
    readonly ComboBox _bats = Campos.Combo();
    readonly Button _bStatus = new() { Text = "Abrir Bateria", Height = 32, Enabled = false };
    readonly Label _info = new() { Dock = DockStyle.Fill, Padding = new Padding(4) };
    readonly TextBox _q = new(), _obs = Campos.Texto(400);
    readonly RadioButton _rCpf = new() { Text = "CPF", Checked = true, AutoSize = true }, _rEmail = new() { Text = "E-mail", AutoSize = true }, _rNome = new() { Text = "Nome", AutoSize = true };
    readonly Label _cli = new() { AutoSize = true, ForeColor = KitVisual.Verde, Font = new Font("Segoe UI", 9.5F, FontStyle.Bold) };
    readonly NumericUpDown _n = Campos.Num(1, 1, 100);
    readonly Grade _g = new();
    readonly Label _resumo = new() { Dock = DockStyle.Top, Height = 34, ForeColor = KitVisual.Secundario, Font = new Font("Segoe UI", 9.5F) };
    List<JsonObject> _lista = [];
    JsonObject _bat, _cliente;

    public FormAgenda() : base("Agenda de Reservas de Bateria", 1340, 820)
    {
        var esq = KitVisual.CartaoSecao("Calendário do Mês");
        esq.Dock = DockStyle.Left; esq.Width = 290;
        var bImprimir = KitVisual.Botao("Imprimir agenda mensal");
        bImprimir.Dock = DockStyle.Bottom;
        bImprimir.Click += (_, _) => Relatorio.Abrir(this, Api.UrlComToken("/relatorio/agenda?mes=" + _cal.SelectionStart.ToString("yyyy-MM")), "Agenda Mensal");
        var gbInfo = new GroupBox { Text = "Informações da Bateria", Dock = DockStyle.Fill, Font = new Font("Segoe UI", 9F) };
        gbInfo.Controls.Add(_info);
        esq.Controls.Add(gbInfo); esq.Controls.Add(_resumo); esq.Controls.Add(_cal); esq.Controls.Add(bImprimir);

        var dir = new Panel { Dock = DockStyle.Fill, Padding = new Padding(10, 0, 0, 0), BackColor = Color.Transparent };
        var cBat = KitVisual.CartaoSecao("Baterias do Dia");
        var linhaBat = Campos.Grade(3, 60, 20, 20);
        var bEd = new Button { Text = "Editar Bateria", Height = 32 };
        bEd.Click += (_, _) => { if (_bat != null && new FormBateria(_bat).ShowDialog(this) == DialogResult.OK) CarregaDia(); };
        _bStatus.Click += (_, _) => Seguro.Rodar(this, async () =>
        {
            if (_bat == null) return;
            var novo = _bat.S("status") == "aberta" ? "fechada" : "aberta";
            await Api.Post($"/api/office/baterias/{_bat.S("id")}/status", new { status = novo });
            Msg.Info(this, novo == "aberta" ? "Bateria aberta com sucesso!" : "Bateria fechada com sucesso!");
            var manter = _bat.S("id");
            await CarregaDiaAsync();
            foreach (var o in _bats.Items) if (o is Campos.Item it && it.Id.ToString() == manter) _bats.SelectedItem = o;
        });
        Campos.Add(linhaBat, "Baterias disponíveis", _bats); Campos.Add(linhaBat, " ", bEd); Campos.Add(linhaBat, "  ", _bStatus);
        cBat.Controls.Add(linhaBat);

        var cCli = KitVisual.CartaoSecao("Pesquisar Cliente & Reservar");
        var radios = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 28 };
        radios.Controls.AddRange([_rCpf, _rEmail, _rNome]);
        var busca = new TableLayoutPanel { Dock = DockStyle.Top, Height = 34, ColumnCount = 3 };
        busca.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); busca.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize)); busca.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        var bS = new Button { Text = "Pesquisar", AutoSize = true, Height = 32 }; var bN = new Button { Text = "Novo cliente", AutoSize = true, Height = 32 };
        _q.Dock = DockStyle.Fill;
        busca.Controls.AddRange([_q, bS, bN]);
        var linhaCli = new Panel { Dock = DockStyle.Top, Height = 24 }; linhaCli.Controls.Add(_cli);
        var linhaRes = Campos.Grade(3, 18, 62, 20);
        var bR = KitVisual.Botao("Reservar", true);
        Campos.Add(linhaRes, "Participantes", _n); Campos.Add(linhaRes, "Observações", _obs); Campos.Add(linhaRes, " ", bR);
        cCli.Controls.Add(linhaRes); cCli.Controls.Add(linhaCli); cCli.Controls.Add(busca); cCli.Controls.Add(radios);

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

        var cGrid = KitVisual.CartaoSecao("Reservas da Bateria");
        cGrid.Height = 240;
        _g.Dock = DockStyle.Fill;
        var pGrid = new Panel { Dock = DockStyle.Fill, Padding = new Padding(0, 8, 0, 0) };
        pGrid.Controls.Add(_g);
        cGrid.Controls.Add(pGrid);

        dir.Controls.Add(cGrid); dir.Controls.Add(cCli); dir.Controls.Add(cBat);

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
        if (prox != null) _bats.SelectedItem = prox; else { _bat = null; _info.Text = "Nenhuma bateria neste dia."; _g.Carregar([]); _bStatus.Enabled = false; }
    }

    void EscolheBateria()
    {
        _bat = (_bats.SelectedItem as Campos.Item)?.Dados;
        if (_bat == null) { _bStatus.Enabled = false; return; }
        _bStatus.Text = _bat.S("status") == "aberta" ? "Fechar Bateria" : "Abrir Bateria";
        _bStatus.Enabled = true;
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
