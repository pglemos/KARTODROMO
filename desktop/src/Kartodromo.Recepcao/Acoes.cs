using System.Globalization;
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
        // na recepção (TM-T20 configurada) vários termos vão um por trabalho de impressão:
        // a térmica corta o papel no fim de cada trabalho, então juntos saíam emendados
        if (lista.Count > 1 && Config.Get("ImpressoraTermos", "") is { Length: > 0 } impressora)
        {
            var feitos = 0;
            foreach (var id in lista)
            {
                var link = await Api.Get("/api/office/termo-link?ids=" + id);
                await Relatorio.ImprimirSilencioso(Api.BaseUrl + link.S("url"), impressora);
                feitos++;
            }
            Msg.Info(dono, $"{feitos} termos enviados para a {impressora}, um de cada vez (a impressora corta entre eles).");
            (dono as FormPrincipal)?.Recarregar();
            return;
        }
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

/// <summary>Editar reserva — igual ao design (EditarReserva.dc.html).</summary>
public class FormEditarReserva : DialogoDesign
{
    public FormEditarReserva(JsonObject r) : base("Editar reserva",
        $"{r.S("reserva")} · {r.S("cliente")}" + (r.B("aprovada") ? "" : " · pré-reserva") + (r.S("origem") is { Length: > 0 } o && o != "recepcao" ? $" do {(o == "totem" ? "totem" : o)}" : ""), PecasDesign.Tile(Color.FromArgb(255, 122, 107), Color.FromArgb(224, 52, 42), "bandeira"))
    {
        var pago = r.B("pago");
        var termo = new CheckBox { Text = "Termo assinado", Checked = r.B("termo") };

        var cliente = new Label { Text = r.S("cliente"), AutoSize = false, Height = 22, Font = PecasDesign.FonteValor, ForeColor = PecasDesign.CorTexto, BackColor = Color.White, TextAlign = ContentAlignment.MiddleLeft, AutoEllipsis = true };
        var alterar = AcaoCampo("Alterar");
        alterar.Click += (_, _) => Seguro.Rodar(this, async () =>
        {
            var c = FormPesquisarCliente.Escolher(this, $"Alterar cliente — {r.S("cliente")}");
            if (c == null) return;
            await Sessao.Api.Post($"/api/office/reservas/{r.S("id")}/alterar-cliente", new { clienteId = c.L("id") });
            cliente.Text = c.S("nome");
            termo.Checked = false;
            Msg.Info(this, "Cliente alterado.");
        });
        var bateria = new Label { Text = $"{r.S("reserva")} · {PecasDesign.DiaMes(r.S("dataHora"))}", AutoSize = false, Height = 22, Font = PecasDesign.FonteValor, ForeColor = PecasDesign.CorTexto, BackColor = Color.White, TextAlign = ContentAlignment.MiddleLeft, AutoEllipsis = true };
        var mover = AcaoCampo("Mover");
        mover.Click += (_, _) => { using var f = new FormMoverCliente(r); if (f.ShowDialog(this) == DialogResult.OK) { DialogResult = DialogResult.OK; Close(); } };

        var prod = new ListaDesign { Enabled = !pago };
        prod.Items.AddRange(Sessao.Lista("produtos").Select(p => (object)new Campos.Item(p.L("id") ?? 0, p.S("nome"), p)).ToArray());
        Campos.Selecionar(prod, r.L("produtoId"));
        var cat = new ListaDesign();
        cat.Items.Add(r.S("categoria") is { Length: > 0 } c0 ? c0 : "Indoor"); cat.SelectedIndex = 0;
        prod.SelectedIndexChanged += (_, _) => { if ((prod.SelectedItem as Campos.Item)?.Dados?.S("categoria") is { Length: > 0 } c) { cat.Items.Clear(); cat.Items.Add(c); cat.SelectedIndex = 0; } };
        var produtoOriginalId = r.L("produtoId");
        var kart = PecasDesign.Texto(r.S("kart"), 10);
        var pesoInicial = decimal.TryParse(r.S("peso"), NumberStyles.Number, CultureInfo.InvariantCulture, out var kg) ? kg.ToString("0.#", Fmt.Br) : "";
        var peso = PecasDesign.Texto(pesoInicial, 6);
        peso.KeyPress += (_, e) => { if (!char.IsControl(e.KeyChar) && !char.IsDigit(e.KeyChar) && e.KeyChar is not (',' or '.')) e.Handled = true; };
        peso.Leave += (_, _) =>
        {
            var valor = peso.Text.Trim().Replace(',', '.');
            if (decimal.TryParse(valor, NumberStyles.Number, CultureInfo.InvariantCulture, out var n) && n > 0 && n < 500)
                peso.Text = n.ToString("0.#", Fmt.Br);
        };
        TextBox SoLeitura(string v) { var t = PecasDesign.Texto(v); t.ReadOnly = true; t.BackColor = Color.White; t.TabStop = false; return t; }
        var preco = SoLeitura(Fmt.Brl(r.L("preco") ?? 0).Replace("R$", "").Trim());
        var desc = SoLeitura(Fmt.Brl(r.L("desconto") ?? 0).Replace("R$", "").Trim());
        var total = SoLeitura(Fmt.Brl(r.L("total") ?? 0).Replace("R$", "").Trim());
        prod.SelectedIndexChanged += (_, _) =>
        {
            if (prod.SelectedItem is not Campos.Item item || item.Dados == null) return;
            var produtoSelecionado = item.Dados;
            var mesmoProduto = item.Id == produtoOriginalId;
            var precoCentavos = mesmoProduto ? r.L("preco") ?? produtoSelecionado.L("preco") ?? 0 : produtoSelecionado.L("preco") ?? 0;
            var descontoCentavos = mesmoProduto ? Math.Min(r.L("desconto") ?? 0, precoCentavos) : 0;
            preco.Text = Fmt.Brl(precoCentavos).Replace("R$", "").Trim();
            desc.Text = Fmt.Brl(descontoCentavos).Replace("R$", "").Trim();
            total.Text = Fmt.Brl(Math.Max(0, precoCentavos - descontoCentavos)).Replace("R$", "").Trim();
            termo.Checked = false;
        };
        var obs = PecasDesign.Texto(r.S("observacao"), 400);

        var g = Secao("Reserva");
        Campo(g, "Cliente", cliente, 3, alterar);
        Campo(g, "Bateria", bateria, 3, mover);
        Campo(g, "Produto", prod, 3);
        Campo(g, "Categoria", cat, 1);
        Campo(g, "Kart", kart, 1);
        Campo(g, "Peso (kg)", peso, 1);
        Campo(g, "Preço (R$)", preco, 2);
        Campo(g, "Desconto (R$)", desc, 2);
        Campo(g, "Total (R$)", total, 2);
        Campo(g, "Observação", obs, 6);

        var aprovada = new CheckBox { Text = "Aprovada", Checked = r.B("aprovada"), Enabled = !r.B("aprovada") };
        var paga = new CheckBox { Text = "Paga", Checked = pago, AutoCheck = false };
        var s = Secao("Situação");
        Marca(s, aprovada, 2); Marca(s, paga, 2); Marca(s, termo, 2);
        foreach (var ck in new[] { aprovada, paga, termo }) ck.Margin = new Padding(0, 4, 14, 4);

        BotaoRodape("Salvar", true, () => Seguro.Rodar(this, async () =>
        {
            var pesoTexto = peso.Text.Trim();
            if (pesoTexto.Length > 0 && (!decimal.TryParse(pesoTexto.Replace(',', '.'), NumberStyles.Number, CultureInfo.InvariantCulture, out var kgAtual) || kgAtual <= 0 || kgAtual >= 500))
            { Msg.Aviso(this, "Peso inválido. Informe um valor entre 0 e 500 kg."); return; }
            var body = new JsonObject { ["observacao"] = obs.Text.Trim(), ["kart"] = kart.Text.Trim(), ["peso"] = pesoTexto };
            if (!pago && Campos.IdDe(prod) is long pid) body["produtoId"] = pid;
            body["termo"] = termo.Checked;
            await Sessao.Api.Put($"/api/office/reservas/{r.S("id")}", body);
            if (aprovada.Checked && !r.B("aprovada")) await Sessao.Api.Post($"/api/office/reservas/{r.S("id")}/aprovar");
            DialogResult = DialogResult.OK; Close();
        }));
        BotaoRodape("Cancelar", false, Close);
        BotaoRodape("Imprimir termo", false, () => Acoes.ImprimirTermo(this, [r.S("id")]));
    }
}

/// <summary>Mover cliente para outra bateria — igual ao design (MoverCliente.dc.html).</summary>
public class FormMoverCliente : DialogoDesign
{
    readonly TabelaDesign _t;
    List<JsonObject> _baterias = [];

    public FormMoverCliente(JsonObject r) : base("Mover cliente para outra bateria", $"{r.S("cliente")} · hoje na {r.S("reserva")}",
        PecasDesign.Tile(Color.FromArgb(255, 179, 64), Color.FromArgb(245, 124, 0), "seta"))
    {
        _t = SecaoTabelaDesign("Escolha a nova bateria");
        _t.Selecionavel = true; _t.MaxLinhas = 8;
        _t.Colunas(new("", 0.45f), new("Bateria", 4.2f), new("Produto", 3.6f), new("Vagas livres", 1.2f, Direita: true));
        var paga = r.B("pago");
        Nota(paga
            ? "O pagamento segue junto. O termo será invalidado e precisa ser impresso/assinado novamente. Só baterias com o mesmo produto e preço."
            : "Produto e preço seguem a bateria escolhida. O termo será invalidado; se o produto mudar, o desconto atual será removido.");

        BotaoRodape("Mover", true, () => Seguro.Rodar(this, async () =>
        {
            if (_t.Selecionada < 0 || _t.Selecionada >= _baterias.Count) { Msg.Aviso(this, "Selecione a nova bateria."); return; }
            var x = await Sessao.Api.Post($"/api/office/reservas/{r.S("id")}/mover", new { bateriaId = _baterias[_t.Selecionada].L("id") });
            Msg.Info(this, x.S("mensagem"));
            DialogResult = DialogResult.OK; Close();
        }));
        BotaoRodape("Cancelar", false, Close);

        Load += (_, _) => Seguro.Rodar(this, async () =>
        {
            var lista = await Sessao.Api.Lista($"/api/office/baterias?status=abertas&filtro=apartir&data={Fmt.Iso(DateTime.Today)}");
            _baterias = lista.Where(b => b.S("id") != r.S("bateriaId") && b.I("disponiveis") > 0
                    && (!paga || (b.L("produtoId") == r.L("produtoId") && b.L("preco") == r.L("preco"))))
                .OrderBy(b => b.S("dataHora")).ToList();
            _t.Linhas(_baterias.Select(b => new[] { "", $"{b.S("nome")} · {PecasDesign.DiaMes(b.S("dataHora"))}", b.S("produto"), b.I("disponiveis").ToString() }));
            if (_baterias.Count > 0) _t.Selecionar(0);
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
        cartao.AutoSize = false;
        cartao.Dock = DockStyle.Fill;
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
            string Peso(JsonObject p) => decimal.TryParse(p.S("peso"), NumberStyles.Number, CultureInfo.InvariantCulture, out var kg) && kg > 0
                ? kg.ToString("0.#", Fmt.Br)
                : "—";
            var linhas = participantes.Select(p => new JsonObject
            {
                ["id"] = p.S("id"),
                ["kart"] = p.S("kart") ?? "—",
                ["cliente"] = p.S("cliente"),
                ["idade"] = p.I("idade") > 0 ? p.I("idade").ToString() : "—",
                ["peso"] = Peso(p),
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
