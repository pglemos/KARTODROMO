using System.Globalization;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
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
        await Task.WhenAll(pre.Select(r => Api.PostAsync($"/api/office/reservas/{r.S("id")}/aprovar")));
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
        var x = await Api.PostAsync($"/api/office/reservas/{r.S("id")}/alterar-cliente", new { clienteId = c.L("id") });
        Msg.Info(f, x.S("mensagem"));
        f.Recarregar();
    });

    public static void MoverCliente(FormPrincipal f, JsonObject r)
    {
        using var j = new FormMoverCliente(r);
        if (j.ShowDialog(f) == DialogResult.OK) f.Recarregar();
    }

    public static void MoverClientes(FormPrincipal f, IReadOnlyList<JsonObject> sel)
    {
        if (sel == null || sel.Count == 0) return;
        using var j = new FormMoverCliente(sel);
        if (j.ShowDialog(f) == DialogResult.OK) f.Recarregar();
    }

    public static void MovimentarGrupoErrado(FormPrincipal f, JsonObject r) => Seguro.Rodar(f, async () =>
    {
        var batId = r.S("bateriaId");
        var resId = r.L("id");
        if (string.IsNullOrEmpty(batId) || resId is null) return;

        var grupos = await Api.ListaAsync($"/api/office/grupos?bateriaId={batId}");
        JsonObject grupo = null;
        JsonObject piloto = null;

        foreach (var gr in grupos)
        {
            if (gr["pilotos"] is JsonArray pilotos)
            {
                foreach (var item in pilotos)
                {
                    if (item is JsonObject p && p.L("inscricaoId") == resId)
                    {
                        grupo = gr;
                        piloto = p;
                        break;
                    }
                }
            }
            if (grupo != null) break;
        }

        if (grupo == null || piloto == null)
        {
            Msg.Info(f, $"O cliente {r.S("cliente")} não faz parte de nenhum grupo nesta bateria (já é uma reserva individual).");
            return;
        }

        if (piloto.B("responsavel"))
        {
            Msg.Aviso(f, $"O cliente {r.S("cliente")} é o responsável principal do grupo {grupo.S("codigo")}. Para desvinculá-lo, altere o responsável ou cancele o grupo.");
            return;
        }

        var resp = MessageBox.Show(f,
            $"O cliente {r.S("cliente")} está cadastrado no grupo {grupo.S("codigo")} (Responsável: {grupo.S("responsavel")}).\n\n" +
            $"Deseja desvinculá-lo do grupo para colocá-lo SOZINHO nesta bateria?\n\n" +
            $"• Sim: Colocar SOZINHO nesta bateria (libera a vaga no grupo para o verdadeiro amigo)\n" +
            $"• Não: Transferir para outro grupo ativo da data\n" +
            $"• Cancelar: Desistir",
            "Movimentar cliente de grupo errado", MessageBoxButtons.YesNoCancel, MessageBoxIcon.Question);

        if (resp == DialogResult.Cancel) return;

        if (resp == DialogResult.Yes)
        {
            var x = await Api.PostAsync($"/api/office/grupos/{grupo.S("id")}/pilotos/{piloto.S("id")}/desvincular", new { destino = "sozinho" });
            Msg.Info(f, x.S("mensagem") is { Length: > 0 } msg ? msg : "Participante desvinculado com sucesso!");
            f.Recarregar();
            return;
        }

        if (resp == DialogResult.No)
        {
            var dataBase = r.D("dataHora")?.Date ?? DateTime.Today;
            var dataStr = Fmt.Iso(dataBase);
            var outrosGrupos = (await Api.ListaAsync($"/api/office/grupos?de={dataStr}&ate={dataStr}"))
                .Where(gr => gr.S("id") != grupo.S("id") && gr.S("status") == "ativa").ToList();

            if (outrosGrupos.Count == 0)
            {
                Msg.Aviso(f, "Não foram encontrados outros grupos ativos nesta data para transferência.");
                return;
            }

            using var fEsc = new FormEscolherGrupo(outrosGrupos);
            if (fEsc.ShowDialog(f) == DialogResult.OK && fEsc.GrupoSelecionado is { } novoGrupo)
            {
                var x = await Api.PostAsync($"/api/office/grupos/{grupo.S("id")}/pilotos/{piloto.S("id")}/desvincular", new { destino = "outro_grupo", novoGrupoId = novoGrupo.L("id") });
                Msg.Info(f, x.S("mensagem") is { Length: > 0 } msg ? msg : "Participante transferido para o novo grupo com sucesso!");
                f.Recarregar();
            }
        }
    });

    public static void ImprimirTermo(IWin32Window dono, IEnumerable<string> ids) => Seguro.Rodar(dono as Control, async () =>
    {
        var lista = ids.ToList();
        if (lista.Count == 0) return;

        var destino = FormEscolherImpressoraTermo.Pedir(dono, lista.Count);
        if (destino == null || destino.Modo == ModoDestinoTermo.Cancelar) return;

        if (destino.Modo == ModoDestinoTermo.Visualizar)
        {
            var r = await Api.GetAsync("/api/office/termo-link?ids=" + string.Join(",", lista));
            Relatorio.Abrir(dono, Api.BaseUrl + r.S("url"), "Termo de Responsabilidade");
            (dono as FormPrincipal)?.Recarregar();
            return;
        }

        // na impressora térmica cada termo vai em um trabalho de impressão para cortar o papel entre eles
        var feitos = 0;
        foreach (var id in lista)
        {
            var link = await Api.GetAsync("/api/office/termo-link?ids=" + id);
            await Relatorio.ImprimirSilencioso(Api.BaseUrl + link.S("url"), destino.NomeImpressora);
            feitos++;
        }
        Msg.Info(dono, $"{feitos} termo(s) enviado(s) para a impressora '{destino.NomeImpressora}'.");
        (dono as FormPrincipal)?.Recarregar();
    });

    public static void ExcluirReservas(FormPrincipal f, List<JsonObject> sel) => Seguro.Rodar(f, async () =>
    {
        if (!Msg.Pergunta(f, sel.Count > 1 ? "Excluir as reservas e liberar as vagas? Pagamentos serão mantidos no histórico, sem reembolso automático." : "Excluir a reserva e liberar a vaga? O pagamento será mantido no histórico, sem reembolso automático.")) return;
        await Task.WhenAll(sel.Select(r => Api.DeleteAsync($"/api/office/reservas/{r.S("id")}")));
        f.Recarregar();
    });

    public static void StatusBateria(FormPrincipal f, List<JsonObject> sel, string status) => Seguro.Rodar(f, async () =>
    {
        await Task.WhenAll(sel.Select(b => Api.PostAsync($"/api/office/baterias/{b.S("id")}/status", new { status })));
        f.Recarregar();
    });

    public static void TotemBateria(FormPrincipal f, List<JsonObject> sel, bool mostrar) => Seguro.Rodar(f, async () =>
    {
        await Task.WhenAll(sel.Select(b => Api.PostAsync($"/api/office/baterias/{b.S("id")}/totem", new { autoAtendimento = mostrar })));
        f.Recarregar();
    });

    public static void ExcluirBaterias(FormPrincipal f, List<JsonObject> sel, bool todas) => Seguro.Rodar(f, async () =>
    {
        if (sel.Count == 0) return;
        var txt = todas ? "Deseja excluir definitivamente *** TODAS *** as baterias listadas?"
            : sel.Count == 1 ? $"Deseja excluir definitivamente a bateria atual?\n{sel[0].S("nome")} {Fmt.DmyHm(sel[0].S("dataHora"))}" : $"Deseja excluir as {sel.Count} baterias selecionadas?";
        if (!Msg.Pergunta(f, txt)) return;
        var falhas = new List<string>();
        var tarefas = sel.Select(async b =>
        {
            try { await Api.DeleteAsync($"/api/office/baterias/{b.S("id")}"); return (bateria: b, erro: (string)null); }
            catch (ApiException e) { return (bateria: b, erro: $"{b.S("nome")} ({Fmt.DmyHm(b.S("dataHora"))}) — {e.Message}"); }
        });
        foreach (var (bateria, erro) in await Task.WhenAll(tarefas))
            if (erro is { Length: > 0 }) falhas.Add(erro);
        if (falhas.Count > 0)
        {
            var msg = $"{falhas.Count} bateria(s) não puderam ser excluídas:\n\n" + string.Join("\n", falhas.Take(8));
            if (falhas.Count > 8) msg += $"\n... e mais {falhas.Count - 8} bateria(s).";
            Msg.Aviso(f, msg);
        }
        f.Recarregar();
    });

    public static void Manutencao(FormPrincipal f, List<JsonObject> sel, bool realizada) => Seguro.Rodar(f, async () =>
    {
        if (sel.Count == 0) return;
        await Api.PostAsync("/api/office/manutencoes/marcar", new { ids = sel.Select(r => r.L("id")).ToArray(), realizada });
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
        if (bateriaSelecionada != null && bateriaSelecionada["id"] != null)
        {
            using var f = new FormListaParticipantes(bateriaSelecionada);
            if (f.ShowDialog(dono) == DialogResult.OK && dono is FormPrincipal principal) principal.Recarregar();
            return;
        }
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
            var terms = await Sessao.Api.ListaAsync("/api/office/cad/terminais");
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
    Task<string> Url() => UrlAsync();

    async Task<string> UrlAsync()
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
                var movs = await api.ListaAsync("/api/office/movimentos");
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
                var bats = await api.ListaAsync($"/api/office/baterias?status=todas&filtro=dia&data={Fmt.Iso(_de.Value)}");
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
                var js = await Sessao.Api.ListaAsync($"/api/office/crono/sessoes?de={Fmt.Iso(_de.Value)}&ate={Fmt.Iso(_ate.Value)}");
                if (js.Count == 0) { Msg.Aviso(this, "Nenhuma corrida cronometrada nesse período."); return null; }
                MostrarEscolha("Escolha a prova", [new("Início", 120), new("Prova", 460), new("Situação", 120), new("Pilotos", 80, Direita: true)], js,
                    x => [DataCrono(x).ToString("dd/MM HH:mm"), x.S("name"), x.S("state") switch { "encerrada" => "Encerrada", "em_andamento" => "Em andamento", var st => st }, x.S("competitors")],
                    x => api.UrlComToken("/relatorio/crono/" + Uri.EscapeDataString(x.S("id"))));
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
            using var f = new FormListaParticipantes(bat);
            if (f.ShowDialog(dono) == DialogResult.OK && dono is FormPrincipal principal) principal.Recarregar();
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

        var cliente = new Label { Text = r.S("cliente"), AutoSize = false, Height = 22, Font = PecasDesign.FonteValor, ForeColor = PecasDesign.CorTexto, BackColor = Tokens.Primitivo.Branco, TextAlign = ContentAlignment.MiddleLeft, AutoEllipsis = true };
        var alterar = AcaoCampo("Alterar");
        alterar.Click += (_, _) => Seguro.Rodar(this, async () =>
        {
            var c = FormPesquisarCliente.Escolher(this, $"Alterar cliente — {r.S("cliente")}");
            if (c == null) return;
            await Sessao.Api.PostAsync($"/api/office/reservas/{r.S("id")}/alterar-cliente", new { clienteId = c.L("id") });
            cliente.Text = c.S("nome");
            termo.Checked = false;
            Msg.Info(this, "Cliente alterado.");
        });
        var bateria = new Label { Text = $"{r.S("reserva")} · {PecasDesign.DiaMes(r.S("dataHora"))}", AutoSize = false, Height = 22, Font = PecasDesign.FonteValor, ForeColor = PecasDesign.CorTexto, BackColor = Tokens.Primitivo.Branco, TextAlign = ContentAlignment.MiddleLeft, AutoEllipsis = true };
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
        TextBox SoLeitura(string v) { var t = PecasDesign.Texto(v); t.ReadOnly = true; t.BackColor = Tokens.Primitivo.Branco; t.TabStop = false; return t; }
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
            await Sessao.Api.PutAsync($"/api/office/reservas/{r.S("id")}", body);
            if (aprovada.Checked && !r.B("aprovada")) await Sessao.Api.PostAsync($"/api/office/reservas/{r.S("id")}/aprovar");
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

    public FormMoverCliente(JsonObject r, JsonObject grupo = null) : this([r], grupo) { }

    public FormMoverCliente(IReadOnlyList<JsonObject> reservas, JsonObject grupo = null) : base(
        grupo is not null ? "Mover grupo para outra bateria" : reservas.Count > 1 ? $"Mover {reservas.Count} participantes para outra bateria" : "Mover cliente para outra bateria",
        grupo is not null ? $"Grupo {grupo.S("codigo")} · {grupo.I("n")} participantes · {Fmt.DmyHm(reservas[0].S("dataHora"))}"
            : reservas.Count > 1 ? $"{reservas.Count} clientes selecionados · {PecasDesign.DiaMes(reservas[0].S("dataHora"))}"
            : $"{reservas[0].S("cliente")} · " + (reservas[0].D("dataHora")?.Date == DateTime.Today ? $"hoje na {reservas[0].S("reserva")}" : $"na {reservas[0].S("reserva")} · {PecasDesign.DiaMes(reservas[0].S("dataHora"))}"),
        PecasDesign.Tile(Color.FromArgb(255, 179, 64), Color.FromArgb(245, 124, 0), "seta"))
    {
        _t = SecaoTabelaDesign("Escolha a nova bateria");
        _t.Selecionavel = true; _t.MaxLinhas = 8;
        _t.Colunas(new("", 0.45f), new("Bateria", 4.2f), new("Produto", 3.6f), new("Vagas livres", 1.2f, Direita: true));
        var vagasNecessarias = grupo?.I("n") ?? reservas.Count;
        Nota(grupo is not null
            ? $"O grupo inteiro ({vagasNecessarias} participantes) será movido. O servidor confere vagas, serviço, tipo de kart e pagamentos."
            : reservas.Any(r => r.B("pago"))
                ? "O pagamento segue junto. O servidor confere se a bateria oferece o mesmo serviço e tipo de kart. O termo será invalidado e precisa ser impresso/assinado novamente."
                : "Produto e preço seguem a bateria escolhida. O termo será invalidado; se o produto mudar, o desconto atual será removido.");

        BotaoRodape(grupo is null ? (reservas.Count > 1 ? $"Mover {reservas.Count} clientes" : "Mover") : "Mover grupo", true, () => Seguro.Rodar(this, async () =>
        {
            if (_t.Selecionada < 0 || _t.Selecionada >= _baterias.Count) { Msg.Aviso(this, "Selecione a nova bateria."); return; }
            var novaBateriaId = _baterias[_t.Selecionada].L("id");
            if (grupo is not null)
            {
                var x = await Sessao.Api.PostAsync($"/api/office/grupos/{grupo.S("id")}/mover", new { bateriaId = novaBateriaId });
                Msg.Info(this, x.S("mensagem") is { Length: > 0 } msg ? msg : "Grupo movido com sucesso.");
            }
            else
            {
                var sucessos = 0;
                List<string> erros = [];
                foreach (var r in reservas)
                {
                    try
                    {
                        await Sessao.Api.PostAsync($"/api/office/reservas/{r.S("id")}/mover", new { bateriaId = novaBateriaId });
                        sucessos++;
                    }
                    catch (Exception ex)
                    {
                        erros.Add($"{r.S("cliente")}: {ex.Message}");
                    }
                }
                if (erros.Count > 0)
                {
                    Msg.Aviso(this, $"Movidos: {sucessos} de {reservas.Count}.\n\nFalhas:\n" + string.Join("\n", erros));
                }
                else
                {
                    Msg.Info(this, sucessos > 1 ? $"{sucessos} participantes movidos com sucesso." : "Cliente movido com sucesso.");
                }
            }
            DialogResult = DialogResult.OK; Close();
        }));
        BotaoRodape("Cancelar", false, Close);

        Load += (_, _) => Seguro.Rodar(this, async () =>
        {
            var dataBase = reservas[0].D("dataHora")?.Date ?? DateTime.Today;
            var dataFiltro = Fmt.Iso(dataBase < DateTime.Today ? dataBase : DateTime.Today);
            var lista = await Sessao.Api.ListaAsync($"/api/office/baterias?status=todas&filtro=apartir&data={dataFiltro}");
            var atualId = reservas[0].S("bateriaId");
            _baterias = lista.Where(b => b.S("id") != atualId && b.S("status") != "cancelada" && b.I("disponiveis") >= vagasNecessarias)
                .OrderBy(b => b.S("dataHora")).ToList();
            _t.Linhas(_baterias.Select(b => new[] { "", $"{b.S("nome")} · {PecasDesign.DiaMes(b.S("dataHora"))}{(b.S("status") == "fechada" ? " (Fechada)" : "")}", b.S("produto"), b.I("disponiveis").ToString() }));
            _t.Selecionar(-1); // sem escolha pronta: "Mover" com a 1ª já marcada levava o cliente para a bateria errada
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
        tabela.Selecionavel = true;
        tabela.AccessibleDescription = "Selecione uma pessoa para mover a reserva ou excluir a vaga da bateria.";
        tabela.Colunas(new("Kart", 60), new("Participante", 520), new("Idade", 60, Direita: true), new("Peso", 70, Direita: true), new("Pago", 60, Marca: true), new("Termo", 60, Marca: true));
        tabela.MaxLinhas = 13;
        tabela.Vazio = "Nenhum participante nesta bateria ainda.";
        tabela.Linhas([]);
        var info = TextoRodape("Carregando…");
        List<JsonObject> participantes = [];
        var gruposPorReserva = new Dictionary<long, (JsonObject Grupo, JsonObject Piloto)>();
        var gruposCarregados = false;
        Button mover = null, excluir = null, desvincular = null;

        JsonObject ReservaSelecionada() => tabela.Selecionada >= 0 && tabela.Selecionada < participantes.Count ? participantes[tabela.Selecionada] : null;
        (JsonObject Grupo, JsonObject Piloto)? GrupoDaReserva(JsonObject reserva) => reserva?.L("id") is long id && gruposPorReserva.TryGetValue(id, out var grupo) ? grupo : null;
        void AtualizarAcoes()
        {
            var reserva = ReservaSelecionada();
            mover.Enabled = excluir.Enabled = gruposCarregados && reserva != null;
            mover.Text = "Mover participante";
            var grupo = GrupoDaReserva(reserva);
            var ehMembroGrupo = gruposCarregados && grupo is { } g && !g.Piloto.B("responsavel");
            if (desvincular != null)
            {
                desvincular.Visible = ehMembroGrupo;
                desvincular.Enabled = ehMembroGrupo;
            }
        }
        void DesvincularGrupo()
        {
            var reserva = ReservaSelecionada();
            if (reserva is null || !gruposCarregados) return;
            var grupo = GrupoDaReserva(reserva);
            if (grupo is not { } g) return;

            Seguro.Rodar(this, async () =>
            {
                var resp = MessageBox.Show(this,
                    $"O participante {reserva.S("cliente")} faz parte do grupo {g.Grupo.S("codigo")}.\n\n" +
                    $"Deseja desvinculá-lo do grupo para colocá-lo SOZINHO nesta mesma bateria?\n\n" +
                    $"• Sim: Colocar SOZINHO nesta bateria (libera a vaga no grupo {g.Grupo.S("codigo")} para outro amigo)\n" +
                    $"• Não: Transferir para outro grupo\n" +
                    $"• Cancelar: Voltar",
                    "Movimentar cliente de grupo", MessageBoxButtons.YesNoCancel, MessageBoxIcon.Question);

                if (resp == DialogResult.Cancel) return;

                if (resp == DialogResult.Yes)
                {
                    var x = await Sessao.Api.PostAsync($"/api/office/grupos/{g.Grupo.S("id")}/pilotos/{g.Piloto.S("id")}/desvincular", new { destino = "sozinho" });
                    Msg.Info(this, x.S("mensagem") is { Length: > 0 } msg ? msg : "Participante desvinculado com sucesso!");
                    DialogResult = DialogResult.OK;
                    Close();
                    return;
                }

                if (resp == DialogResult.No)
                {
                    var dataBase = bateria.D("dataHora")?.Date ?? DateTime.Today;
                    var dataStr = Fmt.Iso(dataBase);
                    var outrosGrupos = (await Sessao.Api.ListaAsync($"/api/office/grupos?de={dataStr}&ate={dataStr}"))
                        .Where(gr => gr.S("id") != g.Grupo.S("id") && gr.S("status") == "ativa").ToList();

                    if (outrosGrupos.Count == 0)
                    {
                        Msg.Aviso(this, "Não foram encontrados outros grupos ativos nesta data para transferência.");
                        return;
                    }

                    using var fEsc = new FormEscolherGrupo(outrosGrupos);
                    if (fEsc.ShowDialog(this) == DialogResult.OK && fEsc.GrupoSelecionado is { } novoGrupo)
                    {
                        var x = await Sessao.Api.PostAsync($"/api/office/grupos/{g.Grupo.S("id")}/pilotos/{g.Piloto.S("id")}/desvincular", new { destino = "outro_grupo", novoGrupoId = novoGrupo.L("id") });
                        Msg.Info(this, x.S("mensagem") is { Length: > 0 } msg ? msg : "Participante transferido para o novo grupo com sucesso!");
                        DialogResult = DialogResult.OK;
                        Close();
                    }
                }
            });
        }
        void MoverReserva()
        {
            var reserva = ReservaSelecionada();
            if (reserva is null || !gruposCarregados) return;
            var grupo = GrupoDaReserva(reserva);
            JsonObject grupoParaMover = null;
            if (grupo is { } g)
            {
                var resp = MessageBox.Show(this,
                    $"O participante {reserva.S("cliente")} faz parte do grupo {g.Grupo.S("codigo")}.\n\n" +
                    $"• Sim: mover APENAS {reserva.S("cliente")} (ele será desvinculado do grupo)\n" +
                    $"• Não: mover o grupo INTEIRO ({g.Grupo.I("n")} participantes)\n" +
                    $"• Cancelar: desistir",
                    "Mover participante de grupo", MessageBoxButtons.YesNoCancel, MessageBoxIcon.Question);
                if (resp == DialogResult.Cancel) return;
                if (resp == DialogResult.No) grupoParaMover = g.Grupo;
                else if (!g.Piloto.B("responsavel"))
                {
                    var mesmabat = MessageBox.Show(this,
                        $"Deseja manter {reserva.S("cliente")} SOZINHO nesta mesma bateria?\n\n" +
                        $"• Sim: Manter nesta mesma bateria como reserva avulsa\n" +
                        $"• Não: Escolher outra bateria",
                        "Manter na bateria atual?", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
                    if (mesmabat == DialogResult.Yes)
                    {
                        Seguro.Rodar(this, async () =>
                        {
                            var x = await Sessao.Api.PostAsync($"/api/office/grupos/{g.Grupo.S("id")}/pilotos/{g.Piloto.S("id")}/desvincular", new { destino = "sozinho" });
                            Msg.Info(this, x.S("mensagem") is { Length: > 0 } msg ? msg : "Participante desvinculado com sucesso!");
                            DialogResult = DialogResult.OK;
                            Close();
                        });
                        return;
                    }
                }
            }
            using var f = new FormMoverCliente(reserva, grupoParaMover);
            if (f.ShowDialog(this) == DialogResult.OK) { DialogResult = DialogResult.OK; Close(); }
        }
        void ExcluirReserva()
        {
            var reserva = ReservaSelecionada();
            if (reserva is null || !gruposCarregados) return;
            var grupo = GrupoDaReserva(reserva);
            Seguro.Rodar(this, async () =>
            {
                string caminho;
                string confirmacao;
                if (grupo is { } vinculo)
                {
                    caminho = $"/api/office/grupos/{vinculo.Grupo.S("id")}/pilotos/{vinculo.Piloto.S("id")}";
                    confirmacao = $"Excluir a vaga de {reserva.S("cliente")} do grupo {vinculo.Grupo.S("codigo")}? A vaga será liberada. Cadastro e pagamentos serão mantidos no histórico, sem reembolso automático.";
                }
                else
                {
                    caminho = $"/api/office/reservas/{reserva.S("id")}";
                    confirmacao = $"Excluir a reserva de {reserva.S("cliente")}? A vaga será liberada. Cadastro e pagamentos serão mantidos no histórico, sem reembolso automático.";
                }
                if (!Msg.Pergunta(this, confirmacao)) return;
                await Sessao.Api.DeleteAsync(caminho);
                Msg.Info(this, "Reserva excluída com sucesso.");
                DialogResult = DialogResult.OK; Close();
            });
        }

        BotaoRodape("Imprimir lista", true, () => Relatorio.Abrir(this, Sessao.Api.UrlComToken("/relatorio/participantes?bateria=" + batId), "Lista de Participantes"));
        BotaoRodape("Fechar", false, Close);
        BotaoRodape("Imprimir termos pendentes", false, () =>
        {
            var pendentes = participantes.Where(p => !p.B("termo")).Select(p => p.S("id")).ToList();
            if (pendentes.Count == 0) { Msg.Info(this, "Todos os termos já foram assinados."); return; }
            Acoes.ImprimirTermo(this, pendentes);
        });
        mover = BotaoRodape("Mover reserva", false, MoverReserva);
        desvincular = BotaoRodape("Grupo errado / Colocar sozinho", false, DesvincularGrupo);
        excluir = BotaoRodape("Excluir reserva", false, ExcluirReserva);
        mover.Enabled = excluir.Enabled = desvincular.Enabled = false;
        desvincular.Visible = false;
        tabela.SelecaoMudou += AtualizarAcoes;

        Load += (_, _) => Seguro.Rodar(this, async () =>
        {
            var tRes = Sessao.Api.ListaAsync($"/api/office/reservas?bateriaId={batId}");
            var tGrupos = Sessao.Api.ListaAsync($"/api/office/grupos?bateriaId={batId}");
            await Task.WhenAll(tRes, tGrupos);

            var res = await tRes;
            participantes = res.Where(r => r.S("status") != "cancelada").OrderBy(r => int.TryParse(r.S("kart"), out var k) ? k : 999).ThenBy(r => r.S("cliente")).ToList();
            try
            {
                var grupos = await tGrupos;
                foreach (var grupo in grupos)
                    if (grupo["pilotos"] is JsonArray pilotos)
                        foreach (var item in pilotos)
                            if (item is JsonObject piloto && piloto.L("inscricaoId") is long inscricaoId)
                                gruposPorReserva[inscricaoId] = (grupo, piloto);
                gruposCarregados = true;
            }
            catch { info.Text = "Vínculos de grupo indisponíveis; mover e excluir estão desativados."; }
            static string Peso(JsonObject p) => decimal.TryParse(p.S("peso"), NumberStyles.Number, CultureInfo.InvariantCulture, out var kg) && kg > 0 ? kg.ToString("0.#", Fmt.Br) : "—";
            tabela.Linhas(participantes.Select(p => new[]
            {
                p.S("kart") is { Length: > 0 } k ? k.PadLeft(2, '0') : "—", p.S("cliente") + (p.S("responsavel") is { Length: > 0 } rsp && p.I("idade") is > 0 and < 18 ? $" (menor · resp. {rsp.Split(' ')[0]})" : ""),
                p.I("idade") > 0 ? p.I("idade").ToString() : "—", Peso(p), p.B("pago") ? "1" : "0", p.B("termo") ? "1" : "0",
            }));
            info.Text = $"{participantes.Count} participantes · {participantes.Count(p => p.B("pago"))} pagos · {participantes.Count(p => p.B("termo"))} termos assinados"
                + (gruposCarregados ? "" : " · vínculos de grupo indisponíveis; ações desativadas");
            AtualizarAcoes();
        });
    }
}

/// <summary>Escolha do grupo de destino para transferir cliente cadastrado por engano.</summary>
public class FormEscolherGrupo : DialogoDesign
{
    readonly TabelaDesign _t;
    readonly List<JsonObject> _grupos;
    public JsonObject GrupoSelecionado { get; private set; }

    public FormEscolherGrupo(List<JsonObject> grupos) : base(
        "Transferir para outro grupo",
        "Escolha o grupo de destino da data",
        PecasDesign.Tile(Color.FromArgb(108, 184, 255), Color.FromArgb(30, 111, 232), "grupo"))
    {
        _grupos = grupos;
        _t = SecaoTabelaDesign("Grupos ativos");
        _t.Selecionavel = true;
        _t.MaxLinhas = 8;
        _t.Colunas(new("Código", 1.8f), new("Responsável", 4.2f), new("Horário", 2.0f), new("Pilotos", 1.5f, Direita: true));
        _t.Linhas(_grupos.Select(g => new[]
        {
            g.S("codigo"),
            g.S("responsavel"),
            Fmt.Hm(g.S("inicio")),
            $"{g.I("cadastrados")}/{g.I("n")}"
        }));
        _t.Selecionar(0);

        BotaoRodape("Transferir", true, () =>
        {
            if (_t.Selecionada < 0 || _t.Selecionada >= _grupos.Count)
            {
                Msg.Aviso(this, "Selecione o grupo de destino.");
                return;
            }
            GrupoSelecionado = _grupos[_t.Selecionada];
            DialogResult = DialogResult.OK;
            Close();
        });
        BotaoRodape("Cancelar", false, Close);
    }
}
