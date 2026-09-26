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
        using var j = new FormEditarReserva(r);
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

    public static void MoverCliente(FormPrincipal f, JsonObject r)
    {
        using var j = new FormMoverCliente(r);
        if (j.ShowDialog(f) == DialogResult.OK) f.Recarregar();
    }

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
        if (bateriaSelecionada != null && bateriaSelecionada["id"] != null)
        {
            new FormListaParticipantes(bateriaSelecionada).ShowDialog(dono);
            return;
        }
        var lista = await Api.Lista($"/api/office/baterias?status=todas&filtro=dia&data={Fmt.Iso(data)}");
        if (lista.Count == 0) { Msg.Aviso(dono, "Nenhuma bateria nesta data."); return; }
        if (lista.Count == 1) { new FormListaParticipantes(lista[0]).ShowDialog(dono); return; }
        using var j = new Janela("Lista de Participantes", 480, 90);
        var cb = Campos.Combo();
        cb.Items.AddRange(lista.Select(b => new Campos.Item(b.L("id") ?? 0, $"{Fmt.DmyHm(b.S("dataHora"))} · {b.S("nome")} ({b.I("inscritos")})", b)).ToArray());
        if (cb.Items.Count > 0) cb.SelectedIndex = 0;
        var g = Campos.Grade(1); Campos.Add(g, "Bateria", cb);
        j.Controls.Add(new Panel { Dock = DockStyle.Fill, Padding = new Padding(10), Controls = { g } });
        j.Rodape(("Cancelar", (_, _) => j.Close(), false), ("Abrir Lista", (_, _) =>
        {
            if (cb.SelectedItem is Campos.Item it && it.Dados != null)
            {
                j.Close();
                new FormListaParticipantes(it.Dados).ShowDialog(dono);
            }
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

/// <summary>Editar reserva (EditarReserva.dc.html).</summary>
public class FormEditarReserva : Janela
{
    public FormEditarReserva(JsonObject r) : base("Editar reserva", 960, 680)
    {
        Tag = $"{r.S("reserva")} · {r.S("cliente")} · pré-reserva";
        var pago = r.B("pago");

        var txtCliente = new TextBox { Text = r.S("cliente"), ReadOnly = true };
        var bAltCli = new Button { Text = "Alterar", Dock = DockStyle.Right, Width = 84, FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(238, 238, 241), Cursor = Cursors.Hand };
        bAltCli.FlatAppearance.BorderSize = 0;
        bAltCli.Click += (_, _) => Seguro.Rodar(this, async () =>
        {
            var c = FormPesquisarCliente.Escolher(this, $"Alterar Cliente — {r.S("cliente")}");
            if (c == null) return;
            await Sessao.Api.Post($"/api/office/reservas/{r.S("id")}/alterar-cliente", new { clienteId = c.L("id") });
            txtCliente.Text = c.S("nome");
            Msg.Info(this, "Cliente alterado.");
        });
        var pCli = new Panel { Dock = DockStyle.Fill, Height = 34 };
        pCli.Controls.Add(txtCliente); pCli.Controls.Add(bAltCli);

        var txtBat = new TextBox { Text = $"{r.S("reserva")} {Fmt.DmyHm(r.S("dataHora"))}", ReadOnly = true };
        var bMover = new Button { Text = "Mover", Dock = DockStyle.Right, Width = 84, FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(238, 238, 241), Cursor = Cursors.Hand };
        bMover.FlatAppearance.BorderSize = 0;
        bMover.Click += (_, _) =>
        {
            if (new FormMoverCliente(r).ShowDialog(this) == DialogResult.OK)
            {
                DialogResult = DialogResult.OK; Close();
            }
        };
        var pBat = new Panel { Dock = DockStyle.Fill, Height = 34 };
        pBat.Controls.Add(txtBat); pBat.Controls.Add(bMover);

        var prod = Campos.Combo(); prod.Items.AddRange(Sessao.Produtos(false)); Campos.Selecionar(prod, r.L("produtoId")); prod.Enabled = !pago;
        var cat = new TextBox { Text = r.S("categoria") ?? "Indoor", ReadOnly = true };
        var kart = Campos.Texto(10); kart.Text = r.S("kart");
        var peso = Campos.Num(r.I("peso") > 0 ? r.I("peso") : 75, 0, 300);

        var preco = new TextBox { Text = Fmt.Brl(r.L("preco") ?? 17500), ReadOnly = true };
        var desc = new TextBox { Text = Fmt.Brl(r.L("desconto") ?? 0), ReadOnly = true };
        var total = new TextBox { Text = Fmt.Brl(r.L("total") ?? 17500), ReadOnly = true };
        var obs = Campos.Texto(400); obs.Text = r.S("observacao");

        var gRes = Campos.Grade(6);
        Campos.Add(gRes, "Cliente", pCli, 3);
        Campos.Add(gRes, "Bateria", pBat, 3);
        Campos.Add(gRes, "Produto", prod, 3);
        Campos.Add(gRes, "Categoria", cat, 1);
        Campos.Add(gRes, "Kart", kart, 1);
        Campos.Add(gRes, "Peso (kg)", peso, 1);
        Campos.Add(gRes, "Preço (R$)", preco, 2);
        Campos.Add(gRes, "Desconto (R$)", desc, 2);
        Campos.Add(gRes, "Total (R$)", total, 2);
        Campos.Add(gRes, "Observação", obs, 6);

        var cartaoRes = KitVisual.CartaoSecao("Reserva");
        cartaoRes.Controls.Add(gRes);

        var ckAprov = Campos.Check("Aprovada", r.B("aprovada"));
        var ckPago = Campos.Check("Paga", r.B("pago"));
        var ckTermo = Campos.Check("Termo assinado", r.B("termo"));
        var gSit = Campos.Grade(6);
        Campos.Add(gSit, null, ckAprov, 2);
        Campos.Add(gSit, null, ckPago, 2);
        Campos.Add(gSit, null, ckTermo, 2);

        var cartaoSit = KitVisual.CartaoSecao("Situação");
        cartaoSit.Controls.Add(gSit);

        Controls.Add(cartaoSit);
        Controls.Add(cartaoRes);

        Rodape(
            ("Imprimir termo", (_, _) => Acoes.ImprimirTermo(this, [r.S("id")]), false),
            ("Cancelar", (_, _) => Close(), false),
            ("Salvar", (_, _) => Seguro.Rodar(this, async () =>
            {
                var body = new JsonObject { ["observacao"] = obs.Text, ["kart"] = kart.Text, ["peso"] = (int)peso.Value };
                if (!pago && Campos.IdDe(prod) is long pid) body["produtoId"] = pid;
                await Sessao.Api.Put($"/api/office/reservas/{r.S("id")}", body);
                DialogResult = DialogResult.OK; Close();
            }), true)
        );
    }
}

/// <summary>Mover cliente para outra bateria (MoverCliente.dc.html).</summary>
public class FormMoverCliente : Janela
{
    readonly Grade _g = new();
    public FormMoverCliente(JsonObject r) : base("Mover cliente para outra bateria", 960, 680)
    {
        Tag = $"{r.S("cliente")} · hoje na {r.S("reserva")}";

        var cartaoTabela = KitVisual.CartaoSecao("Escolha a nova bateria");
        cartaoTabela.Height = 360;

        _g.Colunas(
            new("sel", "", TipoCol.Bool, 40),
            new("bateria", "Bateria", Largura: 320),
            new("produto", "Produto", Largura: 240),
            new("vagas", "Vagas livres", TipoCol.Inteiro, 110)
        );
        _g.Dock = DockStyle.Fill;
        var pGrid = new Panel { Dock = DockStyle.Fill, Padding = new Padding(0, 8, 0, 0) };
        pGrid.Controls.Add(_g);
        cartaoTabela.Controls.Add(pGrid);

        var nota = new Panel { Dock = DockStyle.Top, Height = 56, BackColor = Color.FromArgb(245, 245, 247), Padding = new Padding(14, 10, 14, 10), Margin = new Padding(0, 0, 0, 12) };
        nota.Paint += (_, e) =>
        {
            using var pen = new Pen(Color.FromArgb(232, 232, 236));
            e.Graphics.DrawRectangle(pen, 0, 0, nota.Width - 1, nota.Height - 1);
        };
        nota.Controls.Add(new Label { Text = "O pagamento e o termo vão junto. Se a nova bateria tiver outro preço, a diferença aparece para cobrar ou devolver.", Dock = DockStyle.Fill, ForeColor = Color.FromArgb(58, 58, 60), Font = new Font("Segoe UI", 9.2F) });

        Controls.Add(nota);
        Controls.Add(cartaoTabela);

        Rodape(
            ("Cancelar", (_, _) => Close(), false),
            ("Mover", (_, _) => Seguro.Rodar(this, async () =>
            {
                if (_g.Atual == null) { Msg.Aviso(this, "Selecione a nova bateria."); return; }
                var destino = _g.Atual.L("id");
                var x = await Sessao.Api.Post($"/api/office/reservas/{r.S("id")}/mover", new { bateriaId = destino });
                Msg.Info(this, x.S("mensagem"));
                DialogResult = DialogResult.OK; Close();
            }), true)
        );

        Load += (_, _) => Seguro.Rodar(this, async () =>
        {
            var lista = await Sessao.Api.Lista($"/api/office/baterias?status=abertas&filtro=apartir&data={Fmt.Iso(DateTime.Today)}");
            var linhas = lista.Where(b => b.S("id") != r.S("bateriaId")).Select(b => new JsonObject
            {
                ["id"] = b.L("id"),
                ["sel"] = false,
                ["bateria"] = $"{b.S("nome")} · {Fmt.DmyHm(b.S("dataHora"))}",
                ["produto"] = b.S("produto"),
                ["vagas"] = b.I("disponiveis")
            }).ToList();
            if (linhas.Count > 0) linhas[0]["sel"] = true;
            _g.Carregar(linhas);
        });
    }
}

/// <summary>Lista de participantes (ListaParticipantes.dc.html).</summary>
public class FormListaParticipantes : Janela
{
    readonly Grade _g = new();
    public FormListaParticipantes(JsonObject bateria) : base("Lista de participantes", 960, 680)
    {
        var batId = bateria.S("id");
        var nomeBat = bateria.S("nome");
        var dataHora = bateria.S("dataHora");
        Tag = $"{nomeBat} · {Fmt.Dmy(dataHora)} · para o briefing e a pista";

        var cartao = KitVisual.CartaoSecao(null);
        cartao.Height = 480;

        _g.Colunas(
            new("kart", "Kart", Largura: 60),
            new("cliente", "Participante", Largura: 340),
            new("idade", "Idade", TipoCol.Inteiro, 60),
            new("peso", "Peso", TipoCol.Inteiro, 70),
            new("pago", "Pago", TipoCol.Bool, 60),
            new("termo", "Termo", TipoCol.Bool, 60)
        );
        _g.Dock = DockStyle.Fill;
        var pGrid = new Panel { Dock = DockStyle.Fill, Padding = new Padding(0, 4, 0, 0) };
        pGrid.Controls.Add(_g);
        cartao.Controls.Add(pGrid);
        Controls.Add(cartao);

        List<JsonObject> participantes = [];
        var rodapeCtrl = Rodape("0 participantes · 0 pagos · 0 termos assinados",
            ("Imprimir termos pendentes", (_, _) =>
            {
                var pendentes = participantes.Where(p => !p.B("termo")).Select(p => p.S("id")).ToList();
                if (pendentes.Count == 0) { Msg.Info(this, "Todos os termos já foram assinados!"); return; }
                Acoes.ImprimirTermo(this, pendentes);
            }, false),
            ("Fechar", (_, _) => Close(), false),
            ("Imprimir lista", (_, _) => Relatorio.Abrir(this, Sessao.Api.UrlComToken("/relatorio/participantes?bateria=" + batId), "Lista de Participantes"), true)
        );

        Load += (_, _) => Seguro.Rodar(this, async () =>
        {
            var res = await Sessao.Api.Lista($"/api/office/reservas?bateriaId={batId}");
            participantes = res.Where(r => r.S("status") != "cancelada").ToList();
            var linhas = participantes.Select(p => new JsonObject
            {
                ["id"] = p.S("id"),
                ["kart"] = p.S("kart") ?? "—",
                ["cliente"] = p.S("cliente"),
                ["idade"] = p.I("idade") > 0 ? p.I("idade") : (object)"—",
                ["peso"] = p.I("peso") > 0 ? p.I("peso") : (object)"—",
                ["pago"] = p.B("pago"),
                ["termo"] = p.B("termo")
            }).ToList();
            _g.Carregar(linhas);

            var total = participantes.Count;
            var pagos = participantes.Count(p => p.B("pago"));
            var termos = participantes.Count(p => p.B("termo"));
            var txt = $"{total} participantes · {pagos} pagos · {termos} termos assinados";
            if (rodapeCtrl is Panel pnl)
            {
                var lbl = pnl.Controls.Find("rodapeInfo", false).FirstOrDefault() as Label;
                if (lbl != null) lbl.Text = txt;
            }
        });
    }
}
