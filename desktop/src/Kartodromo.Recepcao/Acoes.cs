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
    public static void Periodo(Form dono, string tipo, string agrupar) => Abrir(dono, tipo == "clientes" ? "clientes" : "receitas-" + (agrupar ?? "forma"));
    public static void ReservasDiaria(Form dono, DateTime data) => Abrir(dono, "reservas-diaria", data);
    public static void AgendaMensal(Form dono) => Abrir(dono, "agenda");
    public static void Fechamento(Form dono) => Abrir(dono, "fechamento");

    public static void Participantes(Form dono, JsonObject bateriaSelecionada, DateTime data)
    {
        if (bateriaSelecionada != null && bateriaSelecionada["id"] != null) { new FormListaParticipantes(bateriaSelecionada).ShowDialog(dono); return; }
        Abrir(dono, "participantes", data);
    }

    /// <summary>Abre a lista rápida de baterias da Cronometragem, inclusive encerradas.</summary>
    public static void Cronometragem(Form dono, JsonObject bateria = null, string tipo = "resultados_oficiais", bool abrirAutomaticamente = false)
    {
        using var f = new FormRelatoriosCronometragem(bateria, tipo, abrirAutomaticamente);
        f.ShowDialog(dono);
    }

    public static void Abrir(Form dono, string relatorio = "fechamento", DateTime? data = null)
    {
        if (relatorio == "crono-resultados") { Cronometragem(dono); return; }
        using var f = new FormRelatoriosOffice(relatorio, data);
        f.ShowDialog(dono);
    }
}

/// <summary>Relatórios da recepção (RelatoriosOffice.dc.html): período, terminal e o relatório escolhido.
/// Os que dependem de uma escolha (caixa, bateria, sessão) mostram a lista para escolher no próprio diálogo.</summary>
public class FormRelatoriosOffice : DialogoDesign
{
    static readonly (string chave, string nome)[] Tipos =
    [
        ("fechamento", "Fechamento de caixa"), ("reservas-diaria", "Reservas diária"),
        ("clientes", "Clientes por período"), ("participantes", "Lista de participantes"),
        ("agenda", "Agenda mensal"), ("termo", "Termo de responsabilidade (em branco)"),
        ("receitas-forma", "Financeiro · Receitas por forma de pagamento"), ("receitas-cliente", "Financeiro · Receitas por clientes"),
        ("receitas-produto", "Financeiro · Receitas por produto"), ("receitas-dia", "Financeiro · Fluxo de caixa"),
        ("crono-resultados", "Cronometragem · Resultados"), ("crono-tv", "Cronometragem · Classificação ao vivo (TV)"),
    ];

    readonly DataDesign _de, _ate;
    readonly ListaDesign _terminal = new();
    readonly RadioButton[] _opcoes;
    readonly TabelaDesign _escolha;
    readonly Label _tituloEscolha;
    readonly Control _secaoEscolha;
    List<JsonObject> _itensEscolha = [];
    Func<JsonObject, string> _urlEscolha;
    string _tituloJanela;

    string Tipo => Tipos[Array.FindIndex(_opcoes, o => o.Checked) is var i and >= 0 ? i : 0].chave;

    public FormRelatoriosOffice(string relatorio = "fechamento", DateTime? data = null) : base("Relatórios da recepção", "Escolha o relatório e o período",
        "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7", "linear-gradient(180deg, #FFB547, #F07A00)")
    {
        var hoje = data ?? DateTime.Today;
        _de = new DataDesign(relatorio is "reservas-diaria" or "participantes" ? hoje : new DateTime(hoje.Year, hoje.Month, 1));
        _ate = new DataDesign(hoje);
        _terminal.Items.Add(new Campos.Item(0, "Todos"));
        _terminal.SelectedIndex = 0;
        var p = Secao("Período");
        Campo(p, "De", _de, 2); Campo(p, "Até", _ate, 2); Campo(p, "Terminal", _terminal, 2);

        var r = Secao("Relatório");
        _opcoes = Tipos.Select(t => new RadioButton { Text = t.nome, Tag = t.chave, Checked = t.chave == relatorio }).ToArray();
        if (!_opcoes.Any(o => o.Checked)) _opcoes[0].Checked = true;
        foreach (var o in _opcoes) { Opcao(r, o, 3); o.CheckedChanged += (_, _) => { if (((RadioButton)o).Checked) EsconderEscolha(); }; }

        var e = Secao("Escolha");
        _secaoEscolha = e.Parent;
        _tituloEscolha = _secaoEscolha.Controls.OfType<Label>().First();
        _escolha = new TabelaDesign { Dock = DockStyle.Fill, Height = 100, Margin = new Padding(0, 0, 14, 0), Selecionavel = true, MaxLinhas = 6 };
        e.Controls.Add(_escolha); e.SetColumnSpan(_escolha, 6);
        _secaoEscolha.Visible = false;
        _escolha.DoubleClick += (_, _) => Gerar();

        BotaoRodape("Gerar relatório", true, Gerar);
        BotaoRodape("Exportar Excel", false, Exportar);
        BotaoRodape("Cancelar", false, Close);
        Load += (_, _) => Seguro.Rodar(this, async () =>
        {
            var terms = await Sessao.Api.Lista("/api/office/cad/terminais");
            _terminal.Items.AddRange(terms.Where(t => t.B("ativo")).Select(t => (object)new Campos.Item(t.L("id") ?? 0, t.S("nome"), t)).ToArray());
        });
    }

    void EsconderEscolha() { _secaoEscolha.Visible = false; _itensEscolha = []; _urlEscolha = null; }

    void MostrarEscolha(string titulo, TabelaDesign.Coluna[] cols, List<JsonObject> itens, Func<JsonObject, string[]> linha, Func<JsonObject, string> url, int selecionar = 0)
    {
        _tituloEscolha.Text = titulo;
        _escolha.Colunas([new("", 30), .. cols]);
        _itensEscolha = itens; _urlEscolha = url;
        _escolha.Linhas(itens.Select(i => new[] { "" }.Concat(linha(i)).ToArray()));
        _escolha.Selecionar(Math.Clamp(selecionar, 0, Math.Max(0, itens.Count - 1)));
        _secaoEscolha.Visible = true;
        foreach (Control c in Controls) if (c is Panel { AutoScroll: true } pn) pn.ScrollControlIntoView(_secaoEscolha);
    }

    string Q => $"de={Fmt.Iso(_de.Value)}&ate={Fmt.Iso(_ate.Value)}" + (Campos.IdDe(_terminal) is long t && t > 0 ? $"&terminal={t}" : "");

    /// <summary>Endereço do relatório escolhido (null quando ainda falta escolher na lista).</summary>
    async Task<string> Url()
    {
        if (!_de.Valida || !_ate.Valida) { Msg.Aviso(this, "Informe as datas do período (dd/mm/aaaa)."); return null; }
        if (_ate.Value < _de.Value) { Msg.Aviso(this, "A data final deve ser igual ou depois da inicial."); return null; }
        if (_secaoEscolha.Visible && _urlEscolha != null)
        {
            if (_escolha.Selecionada < 0 || _escolha.Selecionada >= _itensEscolha.Count) { Msg.Aviso(this, "Escolha um item da lista."); return null; }
            return _urlEscolha(_itensEscolha[_escolha.Selecionada]);
        }
        var api = Sessao.Api;
        switch (Tipo)
        {
            case "reservas-diaria": _tituloJanela = "Reservas diária"; return api.UrlComToken("/relatorio/reservas-diaria?data=" + Fmt.Iso(_de.Value));
            case "clientes": _tituloJanela = "Clientes por período"; return api.UrlComToken("/relatorio/clientes?" + Q);
            case "agenda": _tituloJanela = "Agenda mensal"; return api.UrlComToken("/relatorio/agenda?mes=" + _de.Value.ToString("yyyy-MM"));
            case "termo": _tituloJanela = "Termo de Responsabilidade"; return api.UrlComToken("/termo?branco=1");
            case "receitas-forma" or "receitas-cliente" or "receitas-produto" or "receitas-dia":
                _tituloJanela = Tipos.First(x => x.chave == Tipo).nome.Replace("Financeiro · ", "");
                return api.UrlComToken($"/relatorio/receitas?{Q}&agrupar={Tipo[9..]}");
            case "crono-tv": _tituloJanela = "Classificação ao vivo"; return Config.CronoUrl.TrimEnd('/') + "/tv";
            case "fechamento":
            {
                _tituloJanela = "Fechamento de Caixa";
                var movs = await api.Lista("/api/office/movimentos");
                var term = (_terminal.SelectedItem as Campos.Item) is { Id: > 0 } ti ? ti.Texto : null;
                var lista = movs.Where(m => m.D("abertoEm") is DateTime a && a.Date >= _de.Value.Date && a.Date <= _ate.Value.Date && (term == null || m.S("terminal") == term)).ToList();
                if (lista.Count == 0) { Msg.Aviso(this, "Nenhum caixa aberto nesse período" + (term != null ? $" no terminal {term}." : ".")); return null; }
                if (lista.Count == 1) return api.UrlComToken("/relatorio/fechamento?mov=" + lista[0].S("id"));
                MostrarEscolha("Escolha o caixa", [new("Terminal", 130), new("Turno", 110), new("Usuário", 130), new("Abertura", 120), new("Fechamento", 120), new("Recebido", 110, Direita: true)], lista,
                    m => [m.S("terminal"), m.S("turno"), m.S("usuario"), Fmt.DmyHm(m.S("abertoEm")), m.S("fechadoEm") is { Length: > 0 } fe ? Fmt.DmyHm(fe) : "aberto", Fmt.Dinheiro(m.L("recebido"))],
                    m => api.UrlComToken("/relatorio/fechamento?mov=" + m.S("id")), Math.Max(0, lista.FindIndex(m => string.IsNullOrEmpty(m.S("fechadoEm")))));
                return null;
            }
            case "participantes":
            {
                _tituloJanela = "Lista de Participantes";
                var bats = await api.Lista($"/api/office/baterias?status=todas&filtro=dia&data={Fmt.Iso(_de.Value)}");
                if (bats.Count == 0) { Msg.Aviso(this, $"Nenhuma bateria em {_de.Value:dd/MM/yyyy}."); return null; }
                var agora = DateTime.Now;
                MostrarEscolha($"Baterias de {_de.Value:dd/MM/yyyy}", [new("Hora", 80), new("Bateria", 360), new("Produto", 280), new("Inscritos", 90, Direita: true)], bats,
                    b => [b.D("dataHora")?.ToString("HH:mm") ?? "", b.S("nome"), b.S("produto"), b.I("inscritos").ToString()],
                    b => "participantes:" + b.S("id"), Math.Max(0, bats.FindIndex(b => b.D("dataHora") >= agora.AddMinutes(-20))));
                return null;
            }
            case "crono-resultados":
            {
                _tituloJanela = "Resultado";
                var js = await Sessao.Api.Lista($"/api/office/crono/sessoes?de={Fmt.Iso(_de.Value)}&ate={Fmt.Iso(_ate.Value)}");
                if (js.Count == 0) { Msg.Aviso(this, "Nenhuma corrida cronometrada nesse período."); return null; }
                MostrarEscolha("Escolha a prova", [new("Início", 120), new("Prova", 460), new("Situação", 120), new("Pilotos", 80, Direita: true)], js,
                    x => [DataCrono(x).ToString("dd/MM HH:mm"), x.S("name"), x.S("state") switch { "encerrada" => "Encerrada", "em_andamento" => "Em andamento", var st => st }, x.S("competitors")],
                    x => Config.CronoUrl.TrimEnd('/') + "/resultado/" + Uri.EscapeDataString(x.S("id")));
                return null;
            }
        }
        return null;
    }

    static DateTime DataCrono(JsonObject sessao)
    {
        var ms = sessao.L("startedAt") ?? sessao.L("finishedAt") ?? sessao.L("createdAt");
        return ms is long n && n > 0 ? DateTimeOffset.FromUnixTimeMilliseconds(n).LocalDateTime : DateTime.MinValue;
    }

    void Gerar() => Seguro.Rodar(this, async () =>
    {
        var url = await Url();
        if (url == null) return;
        if (url.StartsWith("participantes:"))
        {
            var bat = _itensEscolha.First(b => b.S("id") == url[14..]);
            var dono = Owner; Close();
            new FormListaParticipantes(bat).ShowDialog(dono);
            return;
        }
        var janela = Owner ?? this; var titulo = _tituloJanela ?? "Relatório";
        Close();
        Relatorio.Abrir(janela, url, titulo);
    });

    /// <summary>Exportar Excel: baixa o relatório e transforma as tabelas dele numa planilha (CSV com ; e BOM).</summary>
    void Exportar() => Seguro.Rodar(this, async () =>
    {
        var url = await Url();
        if (url == null) return;
        if (url.StartsWith("participantes:")) url = Sessao.Api.UrlComToken("/relatorio/participantes?bateria=" + url[14..]);
        if (!url.StartsWith("http") || url.EndsWith("/tv")) { Msg.Aviso(this, "Este relatório não tem tabela para exportar."); return; }
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        var html = await http.GetStringAsync(url);
        var csv = new System.Text.StringBuilder();
        foreach (System.Text.RegularExpressions.Match tr in System.Text.RegularExpressions.Regex.Matches(html, "<tr[^>]*>(.*?)</tr>", System.Text.RegularExpressions.RegexOptions.Singleline | System.Text.RegularExpressions.RegexOptions.IgnoreCase))
        {
            var cels = System.Text.RegularExpressions.Regex.Matches(tr.Groups[1].Value, "<t[hd][^>]*>(.*?)</t[hd]>", System.Text.RegularExpressions.RegexOptions.Singleline | System.Text.RegularExpressions.RegexOptions.IgnoreCase)
                .Select(c => System.Net.WebUtility.HtmlDecode(System.Text.RegularExpressions.Regex.Replace(c.Groups[1].Value, "<[^>]+>", " ")).Trim());
            csv.AppendLine(string.Join(";", cels.Select(c => "\"" + System.Text.RegularExpressions.Regex.Replace(c, "\\s+", " ").Replace("\"", "\"\"") + "\"")));
        }
        if (csv.Length == 0) { Msg.Aviso(this, "O relatório não tem linhas para exportar."); return; }
        using var d = new SaveFileDialog { FileName = $"{Tipo}-{DateTime.Now:yyyyMMdd-HHmm}.csv", Filter = "Planilha (*.csv)|*.csv" };
        if (d.ShowDialog(this) != DialogResult.OK) return;
        File.WriteAllText(d.FileName, csv.ToString(), new System.Text.UTF8Encoding(true));
        Msg.Info(this, $"Planilha {Path.GetFileName(d.FileName)} salva.");
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

    public FormMoverCliente(JsonObject r) : base("Mover cliente para outra bateria", $"{r.S("cliente")} · " + (r.D("dataHora")?.Date == DateTime.Today ? $"hoje na {r.S("reserva")}" : $"na {r.S("reserva")} · {PecasDesign.DiaMes(r.S("dataHora"))}"),
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
/// <summary>Lista de participantes da bateria (ListaParticipantes.dc.html): kart, participante, idade, peso, pago e termo.</summary>
public class FormListaParticipantes : DialogoDesign
{
    public FormListaParticipantes(JsonObject bateria) : base("Lista de participantes", $"{bateria.S("nome")} · {Fmt.Dmy(bateria.S("dataHora"))} · para o briefing e a pista",
        "M4 6h16M4 12h16M4 18h10", "linear-gradient(180deg, #6CB8FF, #1E6FE8)")
    {
        var batId = bateria.S("id");
        var tabela = SecaoTabelaDesign(null);
        tabela.Colunas(new("Kart", 60), new("Participante", 520), new("Idade", 60, Direita: true), new("Peso", 70, Direita: true), new("Pago", 60, Marca: true), new("Termo", 60, Marca: true));
        tabela.MaxLinhas = 13;
        tabela.Vazio = "Nenhum participante nesta bateria ainda.";
        tabela.Linhas([]);
        var info = TextoRodape("Carregando…");
        List<JsonObject> participantes = [];
        BotaoRodape("Imprimir lista", true, () => Relatorio.Abrir(this, Sessao.Api.UrlComToken("/relatorio/participantes?bateria=" + batId), "Lista de Participantes"));
        BotaoRodape("Fechar", false, Close);
        BotaoRodape("Imprimir termos pendentes", false, () =>
        {
            var pendentes = participantes.Where(p => !p.B("termo")).Select(p => p.S("id")).ToList();
            if (pendentes.Count == 0) { Msg.Info(this, "Todos os termos já foram assinados."); return; }
            Acoes.ImprimirTermo(this, pendentes);
        });

        Load += (_, _) => Seguro.Rodar(this, async () =>
        {
            var res = await Sessao.Api.Lista($"/api/office/reservas?bateriaId={batId}");
            participantes = res.Where(r => r.S("status") != "cancelada").OrderBy(r => int.TryParse(r.S("kart"), out var k) ? k : 999).ThenBy(r => r.S("cliente")).ToList();
            static string Peso(JsonObject p) => decimal.TryParse(p.S("peso"), NumberStyles.Number, CultureInfo.InvariantCulture, out var kg) && kg > 0 ? kg.ToString("0.#", Fmt.Br) : "—";
            tabela.Linhas(participantes.Select(p => new[]
            {
                p.S("kart") is { Length: > 0 } k ? k.PadLeft(2, '0') : "—", p.S("cliente") + (p.S("responsavel") is { Length: > 0 } rsp && p.I("idade") is > 0 and < 18 ? $" (menor · resp. {rsp.Split(' ')[0]})" : ""),
                p.I("idade") > 0 ? p.I("idade").ToString() : "—", Peso(p), p.B("pago") ? "1" : "0", p.B("termo") ? "1" : "0",
            }));
            info.Text = $"{participantes.Count} participantes · {participantes.Count(p => p.B("pago"))} pagos · {participantes.Count(p => p.B("termo"))} termos assinados";
        });
    }
}
