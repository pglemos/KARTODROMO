using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

/// <summary>Acoes dos menus de contexto das grades (reservas, baterias, oficina).</summary>
public static class Acoes
{
    static Api Api => Sessao.Api;

    public static void AprovarPre(FormPrincipal f, List<JsonObject> sel) => Seguro.Rodar(f, async () =>
    {
        var pre = sel.Where(r => !r.B("aprovada") && r.S("status") != "cancelada").ToList();
        if (!Msg.Pergunta(f, $"Deseja aprovar a pré-reserva? ({pre.Count})")) return;
        foreach (var r in pre) await Api.Post($"/api/office/reservas/{r.S("id")}/aprovar");
        f.Recarregar();
    });

    public static void EditarReserva(FormPrincipal f, JsonObject r)
    {
        using var j = new Janela("Editar Reserva", 560, 170);
        var pago = r.B("pago");
        var g = Campos.Grade(3, 60, 25, 15);
        var prod = Campos.Combo(); prod.Items.AddRange(Sessao.Produtos(false)); Campos.Selecionar(prod, r.L("produtoId")); prod.Enabled = !pago;
        var kart = Campos.Texto(10); kart.Text = r.S("kart");
        var obs = Campos.Texto(400); obs.Text = r.S("observacao");
        var cab = new Label { Text = $"{r.S("cliente")} · {r.S("reserva")} {Fmt.DmyHm(r.S("dataHora"))}", Font = Tema.Negrito, Dock = DockStyle.Top, Height = 22 };
        Campos.Add(g, "Produto", prod); Campos.Add(g, "Categoria", new TextBox { Text = r.S("categoria"), ReadOnly = true }); Campos.Add(g, "Kart", kart);
        Campos.Add(g, "Observação", obs, 3);
        var corpo = new Panel { Dock = DockStyle.Fill, Padding = new Padding(10) };
        corpo.Controls.Add(g); corpo.Controls.Add(cab);
        j.Controls.Add(corpo);
        j.Rodape(("Cancelar", (_, _) => j.Close(), false), ("Salvar", (_, _) => Seguro.Rodar(j, async () =>
        {
            var body = new JsonObject { ["observacao"] = obs.Text, ["kart"] = kart.Text };
            if (!pago && Campos.IdDe(prod) is long pid) body["produtoId"] = pid;
            await Api.Put($"/api/office/reservas/{r.S("id")}", body);
            j.DialogResult = DialogResult.OK; j.Close();
        }), true));
        if (j.ShowDialog(f) == DialogResult.OK) f.Recarregar();
    }

    public static void AlterarCliente(FormPrincipal f, JsonObject r) => Seguro.Rodar(f, async () =>
    {
        var c = FormPesquisarCliente.Escolher(f, $"Alterar Cliente — {r.S("cliente")}");
        if (c == null) return;
        var x = await Api.Post($"/api/office/reservas/{r.S("id")}/alterar-cliente", new { clienteId = c.L("id") });
        Msg.Info(f, x.S("mensagem"));
        f.Recarregar();
    });

    public static void MoverCliente(FormPrincipal f, JsonObject r) => Seguro.Rodar(f, async () =>
    {
        var lista = await Api.Lista($"/api/office/baterias?status=abertas&filtro=apartir&data={Fmt.Iso(DateTime.Today)}");
        using var j = new Janela("Mover Cliente para Reserva", 600, 120);
        var cb = Campos.Combo();
        cb.Items.AddRange(lista.Where(b => b.S("id") != r.S("bateriaId")).Select(b => new Campos.Item(b.L("id") ?? 0, $"{Fmt.DmyHm(b.S("dataHora"))} · {b.S("nome")} · {b.S("produto")} · {b.I("disponiveis")} vagas", b)).ToArray());
        if (cb.Items.Count > 0) cb.SelectedIndex = 0;
        var g = Campos.Grade(1);
        Campos.Add(g, $"Mover {r.S("cliente")} de {r.S("reserva")} {Fmt.DmyHm(r.S("dataHora"))} para:", cb);
        j.Controls.Add(new Panel { Dock = DockStyle.Fill, Padding = new Padding(10), Controls = { g } });
        j.Rodape(("Cancelar", (_, _) => j.Close(), false), ("Mover", (_, _) => Seguro.Rodar(j, async () =>
        {
            if (Campos.IdDe(cb) is not long destino) return;
            var x = await Api.Post($"/api/office/reservas/{r.S("id")}/mover", new { bateriaId = destino });
            Msg.Info(j, x.S("mensagem"));
            j.DialogResult = DialogResult.OK; j.Close();
        }), true));
        if (j.ShowDialog(f) == DialogResult.OK) f.Recarregar();
    });

    public static void ImprimirTermo(IWin32Window dono, IEnumerable<string> ids) => Seguro.Rodar(dono as Control, async () =>
    {
        var lista = ids.ToList();
        if (lista.Count == 0) return;
        var r = await Api.Get("/api/office/termo-link?ids=" + string.Join(",", lista));
        Relatorio.Abrir(dono, Api.BaseUrl + r.S("url"), "Termo de Responsabilidade");
        (dono as FormPrincipal)?.Recarregar();
    });

    public static void ExcluirReservas(FormPrincipal f, List<JsonObject> sel) => Seguro.Rodar(f, async () =>
    {
        if (sel.Any(r => r.B("pago"))) { Msg.Aviso(f, "Não é permitido excluir reservas pagas!"); return; }
        if (!Msg.Pergunta(f, sel.Count > 1 ? "Deseja realmente excluir as reservas agendadas?" : "Deseja realmente excluir a reserva agendada?")) return;
        foreach (var r in sel) await Api.Delete($"/api/office/reservas/{r.S("id")}");
        f.Recarregar();
    });

    public static void StatusBateria(FormPrincipal f, List<JsonObject> sel, string status) => Seguro.Rodar(f, async () =>
    {
        foreach (var b in sel) await Api.Post($"/api/office/baterias/{b.S("id")}/status", new { status });
        f.Recarregar();
    });

    public static void ExcluirBaterias(FormPrincipal f, List<JsonObject> sel, bool todas) => Seguro.Rodar(f, async () =>
    {
        if (sel.Count == 0) return;
        var txt = todas ? "Deseja excluir definitivamente *** TODAS *** as baterias listadas?"
            : sel.Count == 1 ? $"Deseja excluir definitivamente a bateria atual?\n{sel[0].S("nome")} {Fmt.DmyHm(sel[0].S("dataHora"))}" : $"Deseja excluir as {sel.Count} baterias selecionadas?";
        if (!Msg.Pergunta(f, txt)) return;
        var erros = 0;
        foreach (var b in sel)
        {
            try { await Api.Delete($"/api/office/baterias/{b.S("id")}"); }
            catch (ApiException) { erros++; }
        }
        if (erros > 0) Msg.Aviso(f, $"{erros} bateria(s) não foram excluídas porque têm reservas pagas.");
        f.Recarregar();
    });

    public static void Manutencao(FormPrincipal f, List<JsonObject> sel, bool realizada) => Seguro.Rodar(f, async () =>
    {
        if (sel.Count == 0) return;
        await Api.Post("/api/office/manutencoes/marcar", new { ids = sel.Select(r => r.L("id")).ToArray(), realizada });
        f.Recarregar();
    });
}

/// <summary>Dialogos de parametros dos relatorios (Relatorios &gt; ...).</summary>
public static class Relatorios
{
    static Api Api => Sessao.Api;

    public static void Periodo(Form dono, string tipo, string agrupar)
    {
        using var j = new Janela(tipo == "clientes" ? "Clientes por Período" : "Relatório Financeiro", 360, 90);
        var de = Campos.Data(new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1));
        var ate = Campos.Data();
        var g = Campos.Grade(2);
        Campos.Add(g, "De", de); Campos.Add(g, "Até", ate);
        j.Controls.Add(new Panel { Dock = DockStyle.Fill, Padding = new Padding(10), Controls = { g } });
        j.Rodape(("Cancelar", (_, _) => j.Close(), false), ("Gerar Relatório", (_, _) =>
        {
            Relatorio.Abrir(dono, Api.UrlComToken($"/relatorio/{tipo}?de={Fmt.Iso(de.Value)}&ate={Fmt.Iso(ate.Value)}" + (agrupar != null ? "&agrupar=" + agrupar : "")), j.Text);
            j.Close();
        }, true));
        j.ShowDialog(dono);
    }

    public static void ReservasDiaria(Form dono, DateTime data)
    {
        using var j = new Janela("Reservas Diária", 260, 90);
        var d = Campos.Data(data);
        var g = Campos.Grade(1); Campos.Add(g, "Data", d);
        j.Controls.Add(new Panel { Dock = DockStyle.Fill, Padding = new Padding(10), Controls = { g } });
        j.Rodape(("Cancelar", (_, _) => j.Close(), false), ("Gerar Relatório", (_, _) => { Relatorio.Abrir(dono, Api.UrlComToken("/relatorio/reservas-diaria?data=" + Fmt.Iso(d.Value)), "Reservas Diária"); j.Close(); }, true));
        j.ShowDialog(dono);
    }

    public static void AgendaMensal(Form dono)
    {
        using var j = new Janela("Agenda Mensal", 260, 90);
        var d = new DateTimePicker { Format = DateTimePickerFormat.Custom, CustomFormat = "MMMM 'de' yyyy", ShowUpDown = true };
        var g = Campos.Grade(1); Campos.Add(g, "Mês", d);
        j.Controls.Add(new Panel { Dock = DockStyle.Fill, Padding = new Padding(10), Controls = { g } });
        j.Rodape(("Cancelar", (_, _) => j.Close(), false), ("Gerar Relatório", (_, _) => { Relatorio.Abrir(dono, Api.UrlComToken("/relatorio/agenda?mes=" + d.Value.ToString("yyyy-MM")), "Agenda Mensal"); j.Close(); }, true));
        j.ShowDialog(dono);
    }

    public static void Participantes(Form dono, JsonObject bateriaSelecionada, DateTime data) => Seguro.Rodar(dono, async () =>
    {
        if (bateriaSelecionada != null && bateriaSelecionada["vagas"] != null)
        {
            Relatorio.Abrir(dono, Api.UrlComToken("/relatorio/participantes?bateria=" + bateriaSelecionada.S("id")), "Lista de Participantes");
            return;
        }
        var lista = await Api.Lista($"/api/office/baterias?status=todas&filtro=dia&data={Fmt.Iso(data)}");
        using var j = new Janela("Lista de Participantes", 480, 90);
        var cb = Campos.Combo();
        cb.Items.AddRange(lista.Select(b => new Campos.Item(b.L("id") ?? 0, $"{Fmt.DmyHm(b.S("dataHora"))} · {b.S("nome")} ({b.I("inscritos")})")).ToArray());
        if (cb.Items.Count > 0) cb.SelectedIndex = 0;
        var g = Campos.Grade(1); Campos.Add(g, "Bateria", cb);
        j.Controls.Add(new Panel { Dock = DockStyle.Fill, Padding = new Padding(10), Controls = { g } });
        j.Rodape(("Cancelar", (_, _) => j.Close(), false), ("Gerar Relatório", (_, _) =>
        {
            if (Campos.IdDe(cb) is long id) Relatorio.Abrir(dono, Api.UrlComToken("/relatorio/participantes?bateria=" + id), "Lista de Participantes");
            j.Close();
        }, true));
        j.ShowDialog(dono);
    });

    public static void Fechamento(Form dono) => Seguro.Rodar(dono, async () =>
    {
        var cx = await Api.Get("/api/office/caixa");
        var lista = await Api.Lista("/api/office/movimentos");
        using var j = new Janela("Fechamento de Caixa", 760, 380);
        var g = new Grade();
        g.Colunas(new("terminal", "Terminal", Largura: 130), new("turno", "Turno", Largura: 120), new("usuario", "Usuário", Largura: 120), new("abertoEm", "Abertura", TipoCol.DataHora),
            new("fechadoEm", "Fechamento", TipoCol.DataHora), new("recebido", "Recebido", TipoCol.Dinheiro));
        g.Carregar(lista);
        var aberto = cx["aberto"]?.S("id");
        if (!string.IsNullOrEmpty(aberto)) g.Selecionar(r => r.S("id") == aberto);
        void Gerar() { if (g.Atual is { } r) Relatorio.Abrir(dono, Api.UrlComToken("/relatorio/fechamento?mov=" + r.S("id")), "Fechamento de Caixa"); }
        g.Duplo += _ => Gerar();
        j.Controls.Add(new Panel { Dock = DockStyle.Fill, Padding = new Padding(8), Controls = { g } });
        j.Rodape(("Cancelar", (_, _) => j.Close(), false), ("Gerar Relatório", (_, _) => Gerar(), true));
        j.ShowDialog(dono);
    });
}
