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
/// <summary>Criar reservas (CriarReservas.dc.html): pelo padrão (mês inteiro) com prévia, ou uma reserva avulsa.</summary>
public class FormCriarReservas : DialogoDesign
{
    public FormCriarReservas() : base("Criar reservas", "Gere as baterias do mês pelo padrão, ou uma reserva avulsa", "M5 21V4M5 4h12l-2 4 2 4H5", "linear-gradient(180deg, #FF7A6B, #E0342A)")
    {
        var br = Fmt.Br.TextInfo;
        // ---------- aba 1: pelo padrão
        var pad = new ListaDesign(); pad.Items.AddRange(Sessao.Padroes().Where(p => p.Dados?["ativo"] is null || p.Dados.B("ativo")).ToArray()); if (pad.Items.Count > 0) pad.SelectedIndex = 0;
        var mes = new ListaDesign();
        var hoje = DateTime.Today;
        for (var i = 0; i < 13; i++)
        {
            var m = new DateTime(hoje.Year, hoje.Month, 1).AddMonths(i);
            mes.Items.Add(new Campos.Item(m.Year * 100 + m.Month, br.ToTitleCase(m.ToString("MMMM yyyy", Fmt.Br))));
        }
        mes.SelectedIndex = hoje.Day > 20 ? 1 : 0;
        var ativo = new CheckBox { Text = "Ativo", Checked = true };
        var g1 = Secao("Usar configuração do sistema");
        Campo(g1, "Configuração padrão", pad, 3);
        Campo(g1, "Mês", mes, 2);
        Marca(g1, ativo, 1);
        string[] nomes = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        var dias = nomes.Select((n, i) => new CheckBox { Text = n, Checked = i is >= 2 and <= 6 }).ToArray();
        var g2 = Secao("Dias da semana");
        foreach (var d in dias) Marca(g2, d, 1, false);
        var feriadosCk = new CheckBox { Text = "Pular feriados cadastrados", Checked = true };
        var existentesCk = new CheckBox { Text = "Pular horários que já existem", Checked = true };
        Marca(g2, feriadosCk, 3, false); Marca(g2, existentesCk, 3, false);
        var g3 = Secao("Prévia");
        var sec3 = (TableLayoutPanel)g3.Parent; sec3.BackColor = Fundo; g3.BackColor = Fundo; foreach (Control c in sec3.Controls) c.BackColor = Fundo;
        var previa = new Label { AutoSize = true, MaximumSize = new Size(880, 0), Font = new Font("Segoe UI", 9.6F), ForeColor = Color.FromArgb(58, 58, 60), BackColor = Fundo, Margin = new Padding(0, 0, 0, 4) };
        g3.Controls.Add(previa); g3.SetColumnSpan(previa, 6);
        Control[] abaPadrao = [g1.Parent, g2.Parent, sec3];

        // ---------- aba 2: reserva avulsa
        var nome = PecasDesign.Texto("", 100);
        var data = new DataDesign(hoje); var hora = PecasDesign.Hora(hoje.AddHours(17));
        var vagas = PecasDesign.Numero(12, 3); var volta = PecasDesign.Numero(40, 3);
        var produto = new ListaDesign(); produto.Items.AddRange(Sessao.Lista("produtos").Where(p => p.B("ativo")).Select(p => (object)new Campos.Item(p.L("id") ?? 0, p.S("nome"), p)).ToArray()); if (produto.Items.Count > 0) produto.SelectedIndex = 0;
        var tracado = new ListaDesign(); tracado.Items.AddRange(Sessao.Tracados()); if (tracado.Items.Count > 0) tracado.SelectedIndex = 0;
        var categoria = FormCaixaTransacao.Leitura("");
        void Cat() => categoria.Text = (produto.SelectedItem as Campos.Item)?.Dados?.S("categoria") ?? "";
        produto.SelectedIndexChanged += (_, _) => Cat(); Cat();
        long? respId = null;
        var resp = FormCaixaTransacao.Leitura(""); resp.Cursor = Cursors.Hand;
        var pesq = AcaoCampo("Pesquisar");
        void Responsavel() { var c = FormPesquisarCliente.Escolher(this, "Responsável pela reserva"); if (c != null) { respId = c.L("id"); resp.Text = c.S("nome"); } }
        pesq.Click += (_, _) => Responsavel(); resp.Click += (_, _) => Responsavel();
        var aberta = new CheckBox { Text = "Aberta para reservas", Checked = true };
        var totem = new CheckBox { Text = "Aparece no totem", Checked = true };
        var obs = PecasDesign.Texto("", 400);
        var a1 = Secao("Reserva avulsa");
        Campo(a1, "Nome", nome, 2); Campo(a1, "Data", data, 1); Campo(a1, "Hora", hora, 1); Campo(a1, "Vagas (máx)", vagas, 1); Campo(a1, "Volta mínima (s)", volta, 1);
        Campo(a1, "Produto", produto, 3); Campo(a1, "Traçado", tracado, 2); Campo(a1, "Categoria", categoria, 1);
        Campo(a1, "Responsável", resp, 2, pesq); Marca(a1, aberta, 2); Marca(a1, totem, 2);
        Campo(a1, "Observações", obs, 6);
        Control[] abaAvulsa = [a1.Parent];
        foreach (var c in abaAvulsa) c.Visible = false;

        List<JsonObject> feriados = [];
        (DateTime de, DateTime ate) Periodo()
        {
            var id = (int)(Campos.IdDe(mes) ?? hoje.Year * 100 + hoje.Month);
            var ini = new DateTime(id / 100, id % 100, 1);
            var fim = ini.AddMonths(1).AddDays(-1);
            return (ini < hoje ? hoje : ini, fim);
        }
        void Previa()
        {
            if ((pad.SelectedItem as Campos.Item)?.Dados is not JsonObject p) { previa.Text = "Cadastre um padrão em Ferramentas › Padrões de reservas."; return; }
            var (de, ate) = Periodo();
            var sel = dias.Select((d, i) => (d, i)).Where(x => x.d.Checked).Select(x => x.i).ToHashSet();
            var pulados = new List<DateTime>(); var nDias = 0;
            for (var d = de; d <= ate; d = d.AddDays(1))
            {
                if (!sel.Contains((int)d.DayOfWeek)) continue;
                var feriado = feriados.Any(f => f.D("data") is DateTime fd && (fd.Date == d || f.B("recorrente") && fd.Month == d.Month && fd.Day == d.Day));
                if (feriado && feriadosCk.Checked) { pulados.Add(d); continue; }
                nDias++;
            }
            var q = Math.Max(1, p.I("quantidade"));
            TimeSpan.TryParse(p.S("primeiraHora"), out var h0);
            var ult = h0 + TimeSpan.FromMinutes((q - 1) * p.I("intervaloMin"));
            var nomeMes = de.ToString("MMMM", Fmt.Br);
            var txt = $"{q} {(q == 1 ? "bateria" : "baterias")} por dia · {h0:hh\\:mm}{(q > 1 ? $" às {ult:hh\\:mm}" : "")} · {p.I("vagas")} vagas cada · {nDias} dias em {nomeMes} → {q * nDias} baterias.";
            if (pulados.Count > 0) txt += $" {(pulados.Count == 1 ? "Feriado de" : "Feriados de")} {string.Join(", ", pulados.Select(x => x.ToString("dd/MM")))} {(pulados.Count == 1 ? "será pulado" : "serão pulados")}.";
            if (existentesCk.Checked) txt += " Horários que já existem não são duplicados.";
            previa.Text = txt;
        }
        pad.SelectedIndexChanged += (_, _) => Previa(); mes.SelectedIndexChanged += (_, _) => Previa();
        foreach (var d in dias) d.CheckedChanged += (_, _) => Previa();
        feriadosCk.CheckedChanged += (_, _) => Previa(); existentesCk.CheckedChanged += (_, _) => Previa();

        var aba = 0;
        Button acao = null;
        acao = BotaoRodape("Gerar reservas do mês", true, () => Seguro.Rodar(this, async () =>
        {
            if (aba == 1)
            {
                if (string.IsNullOrWhiteSpace(nome.Text)) { Msg.Aviso(this, "Informe o nome da reserva."); nome.Focus(); return; }
                if (!data.Valida) { Msg.Aviso(this, "Data inválida."); return; }
                if (!PecasDesign.LerHora(hora, out var hh)) { Msg.Aviso(this, "Hora inválida (use hh:mm)."); hora.Focus(); return; }
                await Sessao.Api.Post("/api/office/baterias", new
                {
                    nome = nome.Text.Trim(), inicio = $"{Fmt.Iso(data.Value)}T{hh:hh\\:mm}", vagas = int.TryParse(vagas.Text, out var v) ? v : 12, produtoId = Campos.IdDe(produto), tracadoId = Campos.IdDe(tracado),
                    voltaMinimaSeg = int.TryParse(volta.Text, out var vm) ? vm : 0, responsavelId = respId, reservaFechada = !aberta.Checked, autoAtendimento = totem.Checked, observacao = obs.Text.Trim(), categoria = categoria.Text,
                });
                Msg.Info(this, "Reserva criada com sucesso.");
                DialogResult = DialogResult.OK; Close();
                return;
            }
            var sel = dias.Select((d, i) => (d, i)).Where(x => x.d.Checked).Select(x => x.i).ToArray();
            if (sel.Length == 0) { Msg.Aviso(this, "Marque pelo menos um dia da semana."); return; }
            if (Campos.IdDe(pad) is not long pid) { Msg.Aviso(this, "Escolha a configuração padrão."); return; }
            var (de, ate) = Periodo();
            var r = await Sessao.Api.Post("/api/office/baterias/gerar", new { padraoId = pid, de = Fmt.Iso(de), ate = Fmt.Iso(ate), diasSemana = sel, pularFeriados = feriadosCk.Checked, pularExistentes = existentesCk.Checked, ativo = ativo.Checked });
            Msg.Info(this, r.I("criadas") > 0 ? $"{r.I("criadas")} baterias criadas." : "Nenhuma bateria nova: os horários já existem ou os dias foram pulados.");
            DialogResult = DialogResult.OK; Close();
        }));
        BotaoRodape("Cancelar", false, Close);
        Abas(["Pelo padrão (mês inteiro)", "Reserva avulsa"], i =>
        {
            aba = i;
            foreach (var c in abaPadrao) c.Visible = i == 0;
            foreach (var c in abaAvulsa) c.Visible = i == 1;
            acao.Text = i == 0 ? "Gerar reservas do mês" : "Criar reserva";
        });
        Load += (_, _) => Seguro.Rodar(this, async () => { feriados = await Sessao.Api.Lista("/api/office/cad/feriados"); Previa(); });
        Previa();
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

/// <summary>Agenda (Agenda.dc.html, 1340×820): o mês em blocos (baterias e pilotos de cada dia, barra de ocupação,
/// feriado/fechado) e, à direita, as baterias do dia escolhido. Duplo clique na bateria edita; botão direito mostra as ações
/// (incluir cliente, lista de participantes, abrir/fechar para reservas, termos).</summary>
public class FormAgenda : CartaoModal
{
    static Api Api => Sessao.Api;
    DateTime _mes, _dia;
    Dictionary<DateTime, JsonObject> _resumo = [];
    List<JsonObject> _feriados = [];
    List<JsonObject> _baterias = [];
    readonly Label _titulo = new() { AutoSize = true, Font = new Font("Segoe UI", 19F, FontStyle.Bold), ForeColor = PecasDesign.CorTexto, BackColor = DialogoDesign.Fundo };
    readonly Label _ano = new() { AutoSize = true, Font = new Font("Segoe UI Semibold", 19F), ForeColor = PecasDesign.Cinza, BackColor = DialogoDesign.Fundo };
    readonly CheckBox _soComReservas = new() { Text = "Só com reservas", Checked = true, AutoSize = true, Font = new Font("Segoe UI", 9.8F), BackColor = DialogoDesign.Fundo, Padding = new Padding(4, 0, 0, 0), Cursor = Cursors.Hand };
    readonly CalendarioMes _cal = new();
    readonly Label _semana = new() { AutoSize = true, Font = new Font("Segoe UI Semibold", 9F), ForeColor = DialogoDesign.VerdePrincipal, BackColor = Color.White };
    readonly Label _data = new() { AutoSize = true, Font = new Font("Segoe UI", 16.5F, FontStyle.Bold), ForeColor = PecasDesign.CorTexto, BackColor = Color.White };
    readonly Label _resumoDia = new() { AutoSize = true, Font = new Font("Segoe UI", 9.4F), ForeColor = PecasDesign.Cinza, BackColor = Color.White };
    readonly BateriasDia _lista = new();

    public FormAgenda() : base(1340, 820)
    {
        Text = "Agenda";
        BackColor = DialogoDesign.Fundo;
        var area = Screen.PrimaryScreen?.WorkingArea ?? new Rectangle(0, 0, 1920, 1080);
        ClientSize = new Size(Math.Min(1340, area.Width - 24), Math.Min(820, area.Height - 24));
        _mes = new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1); _dia = DateTime.Today;
        Forma.CheckVerde(_soComReservas);

        // ---------- lado direito (380, branco)
        var lado = new Panel { Dock = DockStyle.Right, Width = 380, BackColor = Color.White };
        lado.Paint += (_, e) => { using var p = new Pen(Color.FromArgb(237, 237, 237)); e.Graphics.DrawLine(p, 0, 0, 0, lado.Height); };
        var topo = new Panel { Dock = DockStyle.Top, Height = 92, BackColor = Color.White };
        _semana.Location = new Point(18, 18); _data.Location = new Point(15, 33); _resumoDia.Location = new Point(18, 66);
        var x = Botao("✕", CinzaBotao, PecasDesign.CorTexto); x.Font = new Font("Segoe UI", 9.5F); x.Size = new Size(30, 30); x.Location = new Point(380 - 18 - 30, 18);
        x.Resize += (_, _) => Forma.AplicarRaio(x, 8); Forma.AplicarRaio(x, 8); x.Click += (_, _) => Close();
        topo.Controls.AddRange([_semana, _data, _resumoDia, x]);
        var rod = new Panel { Dock = DockStyle.Bottom, Height = 67, BackColor = Color.White };
        rod.Paint += (_, e) => { using var p = new Pen(Color.FromArgb(237, 237, 237)); e.Graphics.DrawLine(p, 0, 0, rod.Width, 0); };
        var bLista = Botao("Lista de participantes", CinzaBotao, PecasDesign.CorTexto); bLista.Font = new Font("Segoe UI", 9.8F);
        var bCriar = Botao("+ Criar reservas", DialogoDesign.VerdePrincipal, Color.White, true); bCriar.Font = new Font("Segoe UI", 9.8F, FontStyle.Bold);
        bLista.SetBounds(16, 14, 170, 38); bCriar.SetBounds(194, 14, 170, 38);
        foreach (var b in new[] { bLista, bCriar }) { b.Resize += (_, _) => Forma.AplicarRaio(b, 10); Forma.AplicarRaio(b, 10); }
        bLista.Click += (_, _) => { if (_lista.Atual is { } bat) new FormListaParticipantes(bat).ShowDialog(this); else Msg.Aviso(this, "Escolha a bateria na lista."); };
        bCriar.Click += (_, _) => { using var f = new FormCriarReservas(); if (f.ShowDialog(this) == DialogResult.OK) Recarregar(); };
        rod.Controls.AddRange([bLista, bCriar]);
        _lista.Dock = DockStyle.Fill;
        _lista.Duplo += b => { using var f = new FormBateria(b); if (f.ShowDialog(this) == DialogResult.OK) Recarregar(); };
        _lista.Menu += (b, onde) => MenuBateria(b, onde);
        var meioLista = new Panel { Dock = DockStyle.Fill, Padding = new Padding(12, 0, 12, 6), BackColor = Color.White };
        meioLista.Controls.Add(_lista);
        lado.Controls.Add(meioLista); lado.Controls.Add(rod); lado.Controls.Add(topo);
        meioLista.BringToFront();

        // ---------- lado esquerdo: cabeçalho do mês + dias da semana + blocos
        var esq = new Panel { Dock = DockStyle.Fill, BackColor = DialogoDesign.Fundo, Padding = new Padding(20, 18, 20, 18) };
        var cab = new Panel { Dock = DockStyle.Top, Height = 40, BackColor = DialogoDesign.Fundo };
        var ic = new PictureBox { Image = Forma.Tile("M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z", "linear-gradient(180deg, #C08BFF, #8645D6)", 36, 19), SizeMode = PictureBoxSizeMode.Zoom, Size = new Size(36, 36), Location = new Point(0, 2), BackColor = Color.Transparent };
        _titulo.Location = new Point(46, 0);
        var nav = new SegmentoMes { Location = new Point(0, 6) };
        nav.Anterior += () => Ir(_mes.AddMonths(-1)); nav.Proximo += () => Ir(_mes.AddMonths(1)); nav.Hoje += () => { _dia = DateTime.Today; Ir(new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1)); };
        void Posicionar() { _ano.Location = new Point(_titulo.Right - 6, 0); nav.Left = _ano.Right + 6; }
        _titulo.SizeChanged += (_, _) => Posicionar(); _ano.SizeChanged += (_, _) => Posicionar();
        var imprimir = Botao("Imprimir agenda mensal", CinzaBotao, PecasDesign.CorTexto); imprimir.Font = new Font("Segoe UI", 9.8F);
        imprimir.Size = new Size(TextRenderer.MeasureText(imprimir.Text, imprimir.Font).Width + 26, 32); imprimir.Anchor = AnchorStyles.Top | AnchorStyles.Right;
        imprimir.Resize += (_, _) => Forma.AplicarRaio(imprimir, 8); Forma.AplicarRaio(imprimir, 8);
        imprimir.Click += (_, _) => Relatorio.Abrir(this, Api.UrlComToken("/relatorio/agenda?mes=" + _mes.ToString("yyyy-MM")), "Agenda Mensal");
        _soComReservas.Anchor = AnchorStyles.Top | AnchorStyles.Right;
        _soComReservas.CheckedChanged += (_, _) => MostrarDia();
        cab.Controls.AddRange([ic, _titulo, _ano, nav, _soComReservas, imprimir]);
        cab.Resize += (_, _) => { imprimir.Location = new Point(cab.Width - imprimir.Width, 4); _soComReservas.Location = new Point(imprimir.Left - 10 - _soComReservas.Width, 10); };
        var semana = new Panel { Dock = DockStyle.Top, Height = 34, BackColor = DialogoDesign.Fundo };
        semana.Paint += (_, e) =>
        {
            var w = (semana.Width - 6 * 6) / 7f;
            string[] n = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
            using var f = new Font("Segoe UI Semibold", 9F);
            for (var i = 0; i < 7; i++) TextRenderer.DrawText(e.Graphics, n[i], f, new Rectangle((int)(i * (w + 6)) + 4, 14, (int)w, 18), PecasDesign.Cinza, TextFormatFlags.Left);
        };
        _cal.Dock = DockStyle.Fill;
        _cal.Escolheu += d => { _dia = d; if (d.Month != _mes.Month || d.Year != _mes.Year) Ir(new DateTime(d.Year, d.Month, 1)); else { _cal.Dia = d; CarregarDia(); } };
        esq.Controls.Add(_cal); esq.Controls.Add(semana); esq.Controls.Add(cab);
        _cal.BringToFront();

        Controls.Add(esq); Controls.Add(lado);
        esq.BringToFront();
        Load += (_, _) => Ir(_mes);
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

    void Recarregar() => Ir(_mes);

    void Ir(DateTime mes) => Seguro.Rodar(this, async () =>
    {
        _mes = mes;
        if (_dia.Month != mes.Month || _dia.Year != mes.Year) _dia = mes.Year == DateTime.Today.Year && mes.Month == DateTime.Today.Month ? DateTime.Today : mes;
        _titulo.Text = Fmt.Br.TextInfo.ToTitleCase(mes.ToString("MMMM", Fmt.Br)); _ano.Text = mes.Year.ToString();
        var r = await Api.Lista("/api/office/agenda?mes=" + mes.ToString("yyyy-MM"));
        if (_feriados.Count == 0) try { _feriados = await Api.Lista("/api/office/cad/feriados"); } catch { }
        _resumo = r.Where(x => x.D("dia") != null).ToDictionary(x => x.D("dia")!.Value.Date, x => x);
        _cal.Mostrar(mes, _dia, _resumo, d => _feriados.Any(f => f.D("data") is DateTime fd && (fd.Date == d || f.B("recorrente") && fd.Month == d.Month && fd.Day == d.Day)));
        await CarregarDiaAsync();
    });

    void CarregarDia() => Seguro.Rodar(this, CarregarDiaAsync);

    async Task CarregarDiaAsync()
    {
        _baterias = (await Api.Lista($"/api/office/baterias?status=todas&filtro=dia&data={Fmt.Iso(_dia)}")).Where(b => b.S("status") != "cancelada").OrderBy(b => b.S("dataHora")).ToList();
        if (IsDisposed) return;
        MostrarDia();
    }

    void MostrarDia()
    {
        _semana.Text = _dia.ToString("dddd", Fmt.Br).ToUpperInvariant();
        _data.Text = _dia.ToString("d 'de' MMMM", Fmt.Br);
        var visiveis = _soComReservas.Checked ? _baterias.Where(b => b.I("inscritos") > 0 || b.D("dataHora") >= DateTime.Now.AddMinutes(-40)).ToList() : _baterias;
        var pil = _baterias.Sum(b => b.I("inscritos")); var pre = _baterias.Sum(b => b.I("preReservas"));
        _resumoDia.Text = _baterias.Count == 0 ? "Nenhuma bateria neste dia" : $"{_baterias.Count} {(_baterias.Count == 1 ? "bateria" : "baterias")} · {pil} pilotos" + (pre > 0 ? $" · {pre} {(pre == 1 ? "pré-reserva" : "pré-reservas")}" : "");
        _lista.Mostrar(visiveis);
    }

    void MenuBateria(JsonObject b, Point onde)
    {
        var m = new ContextMenuStrip { Font = new Font("Segoe UI", 9.5F) };
        m.Items.Add("Incluir cliente", null, (_, _) => { using var f = new FormIncluirCliente(b); f.ShowDialog(this); CarregarDia(); });
        m.Items.Add("Editar bateria", null, (_, _) => { using var f = new FormBateria(b); if (f.ShowDialog(this) == DialogResult.OK) Recarregar(); });
        m.Items.Add("Lista de participantes", null, (_, _) => new FormListaParticipantes(b).ShowDialog(this));
        m.Items.Add(new ToolStripSeparator());
        var fechada = b.S("status") == "fechada";
        m.Items.Add(fechada ? "Abrir bateria" : "Fechar bateria", null, (_, _) => Seguro.Rodar(this, async () =>
        {
            await Api.Post($"/api/office/baterias/{b.S("id")}/status", new { status = fechada ? "aberta" : "fechada" });
            CarregarDia();
        }));
        m.Items.Add("Imprimir termos da bateria", null, (_, _) => Seguro.Rodar(this, async () =>
        {
            var res = (await Api.Lista($"/api/office/reservas?bateriaId={b.S("id")}")).Where(r => r.S("status") != "cancelada").Select(r => r.S("id")).ToList();
            if (res.Count == 0) { Msg.Aviso(this, "A bateria não tem reservas."); return; }
            Acoes.ImprimirTermo(this, res);
        }));
        m.Closed += (_, _) => BeginInvoke(() => m.Dispose());
        m.Show(_lista, onde);
    }
}

/// <summary>‹ Hoje › (segmentado cinza, "Hoje" branco).</summary>
class SegmentoMes : Control
{
    public event Action Anterior, Proximo, Hoje;
    public SegmentoMes()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer, true);
        Size = new Size(32 + 60 + 32 + 4, 32); Cursor = Cursors.Hand; BackColor = DialogoDesign.Fundo;
    }
    protected override void OnMouseClick(MouseEventArgs e)
    {
        base.OnMouseClick(e);
        if (e.X < 34) Anterior?.Invoke(); else if (e.X > Width - 34) Proximo?.Invoke(); else Hoje?.Invoke();
    }
    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics; g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        g.Clear(BackColor);
        using (var p = Forma.Redondo(new Rectangle(0, 0, Width - 1, Height - 1), 9)) using (var b = new SolidBrush(Color.FromArgb(232, 232, 235))) g.FillPath(b, p);
        var hoje = new Rectangle(34, 2, 60, 28);
        using (var s = Forma.Redondo(new Rectangle(hoje.X, hoje.Y + 1, hoje.Width, hoje.Height), 7)) using (var bs = new SolidBrush(Color.FromArgb(30, 0, 0, 0))) g.FillPath(bs, s);
        using (var p = Forma.Redondo(hoje, 7)) g.FillPath(Brushes.White, p);
        using var f = new Font("Segoe UI", 11F); using var fb = new Font("Segoe UI Semibold", 9.6F);
        TextRenderer.DrawText(g, "‹", f, new Rectangle(2, 0, 32, 30), PecasDesign.CorTexto, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        TextRenderer.DrawText(g, "Hoje", fb, hoje, PecasDesign.CorTexto, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        TextRenderer.DrawText(g, "›", f, new Rectangle(Width - 34, 0, 32, 30), PecasDesign.CorTexto, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
    }
}

/// <summary>Os blocos do mês: 7 colunas, espaço 6, raio 12. Hoje com anel verde; dia sem bateria = "Fechado"; feriado em vermelho.</summary>
class CalendarioMes : Control
{
    DateTime _mes;
    public DateTime Dia { get; set; }
    Dictionary<DateTime, JsonObject> _resumo = [];
    Func<DateTime, bool> _feriado = _ => false;
    public event Action<DateTime> Escolheu;
    DateTime _inicio;
    int Semanas => (int)Math.Ceiling(((int)_mes.DayOfWeek + DateTime.DaysInMonth(_mes.Year, _mes.Month)) / 7.0);

    public CalendarioMes()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        BackColor = DialogoDesign.Fundo; Cursor = Cursors.Hand;
    }

    public void Mostrar(DateTime mes, DateTime dia, Dictionary<DateTime, JsonObject> resumo, Func<DateTime, bool> feriado)
    {
        _mes = mes; Dia = dia; _resumo = resumo; _feriado = feriado;
        _inicio = mes.AddDays(-(int)mes.DayOfWeek);
        Invalidate();
    }

    RectangleF Celula(int i)
    {
        var sem = Math.Max(5, Semanas);
        var w = (Width - 6 * 6) / 7f; var h = (Height - (sem - 1) * 6) / (float)sem;
        return new RectangleF(i % 7 * (w + 6), i / 7 * (h + 6), w, h);
    }

    protected override void OnMouseClick(MouseEventArgs e)
    {
        base.OnMouseClick(e);
        for (var i = 0; i < Math.Max(5, Semanas) * 7; i++) if (Celula(i).Contains(e.Location)) { Escolheu?.Invoke(_inicio.AddDays(i)); return; }
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics; g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias; g.Clear(BackColor);
        if (_mes == default) return;
        using var fNum = new Font("Segoe UI", 9.8F, FontStyle.Bold); using var fTag = new Font("Segoe UI Semibold", 8.3F); using var fTxt = new Font("Segoe UI", 9F);
        for (var i = 0; i < Math.Max(5, Semanas) * 7; i++)
        {
            var d = _inicio.AddDays(i); var r = Celula(i);
            var doMes = d.Month == _mes.Month;
            var hoje = d == DateTime.Today; var escolhido = d == Dia.Date;
            _resumo.TryGetValue(d, out var res);
            var bat = res?.I("baterias") ?? 0; var pil = res?.I("reservas") ?? 0; var vagas = res?.I("vagas") ?? 0;
            var feriado = doMes && _feriado(d); var fechado = doMes && bat == 0;
            using var p = Forma.Redondo(r, 12);
            if (doMes)
            {
                if (fechado) { using var b = new SolidBrush(Color.FromArgb(239, 239, 241)); g.FillPath(b, p); }
                else
                {
                    if (escolhido) { using var sombra = Forma.Redondo(new RectangleF(r.X + 4, r.Y + 8, r.Width - 8, r.Height - 4), 12); using var bs = new SolidBrush(Color.FromArgb(40, 11, 122, 83)); g.FillPath(bs, sombra); }
                    g.FillPath(Brushes.White, p);
                    using var borda = new Pen(escolhido ? DialogoDesign.VerdePrincipal : Color.FromArgb(232, 232, 234), escolhido ? 2f : 1f); g.DrawPath(borda, p);
                }
            }
            // número (hoje em círculo verde)
            var num = new RectangleF(r.X + 8, r.Y + 8, 26, 26);
            if (hoje && doMes) { using var bv = new SolidBrush(DialogoDesign.VerdePrincipal); g.FillEllipse(bv, num); }
            var corNum = !doMes ? Color.FromArgb(174, 174, 178) : hoje ? Color.White : d < DateTime.Today || fechado ? Color.FromArgb(142, 142, 147) : PecasDesign.CorTexto;
            TextRenderer.DrawText(g, d.Day.ToString(), fNum, Rectangle.Round(num), corNum, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
            if (!doMes) continue;
            var tag = feriado ? "Feriado" : fechado ? "Fechado" : "";
            if (tag.Length > 0) TextRenderer.DrawText(g, tag, fTag, Rectangle.Round(new RectangleF(r.X, r.Y + 8, r.Width - 9, 26)), feriado ? Color.FromArgb(196, 40, 28) : Color.FromArgb(142, 142, 147), TextFormatFlags.Right | TextFormatFlags.VerticalCenter);
            if (bat == 0) continue;
            TextRenderer.DrawText(g, $"{bat} {(bat == 1 ? "bateria" : "baterias")} · {pil} pilotos", fTxt, Rectangle.Round(new RectangleF(r.X + 9, r.Y + 40, r.Width - 14, 34)), Color.FromArgb(58, 58, 60), TextFormatFlags.Left | TextFormatFlags.WordBreak);
            var pct = vagas > 0 ? Math.Min(1f, pil / (float)vagas) : 0;
            var barra = new RectangleF(r.X + 9, Math.Min(r.Bottom - 12, r.Y + 76), r.Width - 18, 5);
            using (var fundo = Forma.Redondo(barra, 3)) using (var bf = new SolidBrush(Color.FromArgb(237, 237, 237))) g.FillPath(bf, fundo);
            if (pct > 0) { using var cheio = Forma.Redondo(new RectangleF(barra.X, barra.Y, Math.Max(6, barra.Width * pct), barra.Height), 3); using var bc = new SolidBrush(pct > 0.8f ? Color.FromArgb(255, 159, 10) : Color.FromArgb(52, 199, 89)); g.FillPath(bc, cheio); }
        }
    }
}

/// <summary>As baterias do dia: hora (mono), nome, barra de ocupação, n/vagas e a situação (Encerrada / Na pista / Aberta / Fechada).</summary>
class BateriasDia : Control
{
    List<JsonObject> _itens = [];
    int _sel = -1, _topo;
    public JsonObject Atual => _sel >= 0 && _sel < _itens.Count ? _itens[_sel] : null;
    public event Action<JsonObject> Duplo;
    public event Action<JsonObject, Point> Menu;
    const int Alt = 56, Esp = 6;

    public BateriasDia()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.Selectable, true);
        BackColor = Color.White;
    }

    public void Mostrar(List<JsonObject> itens)
    {
        _itens = itens; _topo = 0;
        var agora = DateTime.Now;
        _sel = itens.FindIndex(b => b.D("dataHora") is DateTime d && d.AddMinutes(35) >= agora);
        Invalidate();
    }

    int Em(Point p) { var i = (p.Y + _topo) / (Alt + Esp); return i >= 0 && i < _itens.Count && (p.Y + _topo) % (Alt + Esp) < Alt ? i : -1; }
    protected override void OnMouseDown(MouseEventArgs e) { base.OnMouseDown(e); Focus(); var i = Em(e.Location); if (i >= 0) { _sel = i; Invalidate(); if (e.Button == MouseButtons.Right) Menu?.Invoke(_itens[i], e.Location); } }
    protected override void OnMouseDoubleClick(MouseEventArgs e) { base.OnMouseDoubleClick(e); var i = Em(e.Location); if (i >= 0 && e.Button == MouseButtons.Left) Duplo?.Invoke(_itens[i]); }
    protected override void OnMouseWheel(MouseEventArgs e) { base.OnMouseWheel(e); _topo = Math.Clamp(_topo - Math.Sign(e.Delta) * 60, 0, Math.Max(0, _itens.Count * (Alt + Esp) - Height)); Invalidate(); }
    protected override void OnMouseEnter(EventArgs e) { base.OnMouseEnter(e); Focus(); }

    static (string texto, Color cor, bool pista, bool fim) Situacao(JsonObject b)
    {
        var ini = b.D("dataHora") ?? DateTime.MinValue; var agora = DateTime.Now;
        if (ini <= agora && agora < ini.AddMinutes(35)) return ("Na pista", Color.FromArgb(10, 79, 160), true, false);
        if (ini.AddMinutes(35) <= agora) return ("Encerrada", Color.FromArgb(142, 142, 147), false, true);
        if (b.S("status") == "fechada" || b.B("reservaFechada")) return ("Fechada", Color.FromArgb(196, 40, 28), false, false);
        return ("Aberta", Color.FromArgb(28, 107, 53), false, false);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics; g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias; g.Clear(BackColor);
        using var fHora = new Font("Consolas", 10.5F, FontStyle.Bold); using var fNome = new Font("Segoe UI Semibold", 9.8F); using var fOc = new Font("Segoe UI Semibold", 9.4F); using var fEst = new Font("Segoe UI Semibold", 8.3F);
        if (_itens.Count == 0) { TextRenderer.DrawText(g, "Nenhuma bateria.", new Font("Segoe UI", 9.8F), new Rectangle(0, 20, Width, 30), PecasDesign.Cinza, TextFormatFlags.HorizontalCenter); return; }
        for (var i = 0; i < _itens.Count; i++)
        {
            var y = i * (Alt + Esp) - _topo;
            if (y > Height || y + Alt < 0) continue;
            var b = _itens[i]; var r = new Rectangle(0, y, Width - 1, Alt);
            var (texto, cor, pista, fim) = Situacao(b);
            using var p = Forma.Redondo(r, 11);
            using (var bg = new SolidBrush(pista ? Color.FromArgb(235, 244, 255) : Color.FromArgb(245, 245, 247))) g.FillPath(bg, p);
            if (pista) { using var pe = new Pen(Color.FromArgb(191, 222, 255)); g.DrawPath(pe, p); }
            if (i == _sel) { using var ps = new Pen(DialogoDesign.VerdePrincipal, 2f); g.DrawPath(ps, p); }
            TextRenderer.DrawText(g, b.D("dataHora")?.ToString("HH:mm") ?? "", fHora, new Rectangle(10, y, 54, Alt), PecasDesign.CorTexto, TextFormatFlags.VerticalCenter | TextFormatFlags.Left);
            var ins = b.I("inscritos"); var vagas = Math.Max(1, b.I("vagas"));
            var oc = $"{ins}/{b.I("vagas")}";
            var wDir = Math.Max(TextRenderer.MeasureText(oc, fOc).Width, TextRenderer.MeasureText(texto, fEst).Width) + 4;
            var nomeW = Width - 74 - wDir - 20;
            var nome = b.S("nome") + (b.S("categoria") == "Super Kart" && !b.S("nome").Contains("Super", StringComparison.OrdinalIgnoreCase) ? " · Super Kart" : "");
            TextRenderer.DrawText(g, nome, fNome, new Rectangle(74, y + 9, nomeW, 20), PecasDesign.CorTexto, TextFormatFlags.Left | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
            var barra = new RectangleF(74, y + 34, nomeW, 4);
            using (var bf = Forma.Redondo(barra, 2)) using (var bb = new SolidBrush(Color.FromArgb(237, 237, 237))) g.FillPath(bb, bf);
            var pct = Math.Min(1f, ins / (float)vagas);
            if (pct > 0) { using var bc = Forma.Redondo(new RectangleF(barra.X, barra.Y, Math.Max(4, barra.Width * pct), 4), 2); using var cb = new SolidBrush(fim ? Color.FromArgb(199, 199, 204) : ins >= vagas ? Color.FromArgb(255, 159, 10) : Color.FromArgb(52, 199, 89)); g.FillPath(cb, bc); }
            TextRenderer.DrawText(g, oc, fOc, new Rectangle(Width - wDir - 10, y + 9, wDir, 18), PecasDesign.CorTexto, TextFormatFlags.Right);
            TextRenderer.DrawText(g, texto, fEst, new Rectangle(Width - wDir - 10, y + 29, wDir, 16), cor, TextFormatFlags.Right);
        }
    }
}
