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
        esq.AutoSize = false;
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
        cGrid.AutoSize = false;
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
