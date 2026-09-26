using System.Drawing.Printing;
using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

public partial class FormCrono
{
    async Task CarregarCatalogo()
    {
        try
        {
            _catalog = (await Crono.Api.Get("/api/catalog"))?.AsObject() ?? new JsonObject();
            _events = Crono.Arr(_catalog, "events");
            _groups = Crono.Arr(_catalog, "groups");
            _proofs = Crono.Arr(_catalog, "provas");
            var selectedEventId = (_gEventos.ChaveAtual as JsonObject)?.S("id");
            var selectedEvent = _events.FirstOrDefault(e => e.S("id") == selectedEventId) ?? _events.FirstOrDefault();
            _gEventos.Preencher(_events.Select(e => new object[] { e.S("name"), DataLegivel(e.S("date")), e.S("venue") }).ToList(), _events.Cast<object>().ToList());
            if (selectedEvent != null && _gEventos.Rows.Count > 0 && _gEventos.ChaveAtual == null) SelecionarLinha(_gEventos, _events.IndexOf(selectedEvent));
            var eventId = selectedEvent?.S("id") ?? "";
            var eventGroups = _groups.Where(g => g.S("eventId") == eventId).ToList();
            var selectedGroupId = (_gGrupos.ChaveAtual as JsonObject)?.S("id");
            var selectedGroup = eventGroups.FirstOrDefault(g => g.S("id") == selectedGroupId) ?? eventGroups.FirstOrDefault();
            _gGrupos.Preencher(eventGroups.Select(g => new object[] { g.S("name"), NomeCategoria(g.S("categoryId")), _proofs.Count(p => p.S("groupId") == g.S("id")) }).ToList(), eventGroups.Cast<object>().ToList());
            if (selectedGroup != null && _gGrupos.Rows.Count > 0 && _gGrupos.ChaveAtual == null) SelecionarLinha(_gGrupos, eventGroups.IndexOf(selectedGroup));
            var groupId = selectedGroup?.S("id") ?? "";
            var groupProofs = _proofs.Where(p => p.S("groupId") == groupId).OrderBy(p => p.I("order")).ToList();
            _gProvas.Preencher(groupProofs.Select(p => new object[] { p.S("name"), Crono.Tipo(p.S("type")), p.I("durationMin") > 0 ? $"{p.I("durationMin")} min" : "Por voltas", p.L("maxLaps") is long laps ? laps.ToString() : "—" }).ToList(), groupProofs.Cast<object>().ToList());
            MontarArvore();
        }
        catch (ApiException e) { _servidorOk = false; _gEventos.Preencher([new object[] { "Cadastros indisponíveis", e.Message, "" }]); }
    }

    static string DataLegivel(string data)
    {
        return DateTime.TryParse(data, out var d) ? d.ToString("dd/MM/yyyy") : data;
    }

    string NomeCategoria(string id)
    {
        var category = Crono.Arr(_catalog, "categories").FirstOrDefault(c => c.S("id") == id || string.Equals(c.S("name"), id, StringComparison.OrdinalIgnoreCase));
        return category?.S("name") ?? id;
    }

    string IdCategoria(string nomeOuId)
    {
        var category = Crono.Arr(_catalog, "categories").FirstOrDefault(c => c.S("id") == nomeOuId || string.Equals(c.S("name"), nomeOuId, StringComparison.OrdinalIgnoreCase));
        return category?.S("id") ?? nomeOuId;
    }

    static void SelecionarLinha(LiveGrid grid, int index)
    {
        if (index < 0 || index >= grid.Rows.Count) return;
        grid.ClearSelection();
        grid.Rows[index].Selected = true;
        if (grid.Columns.Count > 0) grid.CurrentCell = grid.Rows[index].Cells[0];
    }

    void MontarArvore()
    {
        if (_arvore.IsDisposed || _arvore.IsHandleCreated == false) return;
        _arvore.BeginUpdate();
        _arvore.Nodes.Clear();
        foreach (var ev in _events)
        {
            var eventNode = new TreeNode($"▣  {ev.S("name")}  ·  {DataLegivel(ev.S("date"))}");
            foreach (var group in _groups.Where(g => g.S("eventId") == ev.S("id")))
            {
                var groupNode = new TreeNode($"▾  {group.S("name")}");
                foreach (var proof in _proofs.Where(p => p.S("groupId") == group.S("id")).OrderBy(p => p.I("order")))
                {
                    var proofNode = new TreeNode($"●  {proof.S("name")} · {Crono.Tipo(proof.S("type"))}");
                    proofNode.Tag = new JsonObject { ["kind"] = "proof", ["proofId"] = proof.S("id") };
                    var session = Crono.Arr(_state, "sessions").FirstOrDefault(s => s.S("proofId") == proof.S("id"));
                    if (session != null)
                    {
                        proofNode.Text += $" · {Crono.Estado(session.S("state"))}";
                        proofNode.Tag = new JsonObject { ["kind"] = "session", ["sessionId"] = session.S("id") };
                    }
                    groupNode.Nodes.Add(proofNode);
                }
                eventNode.Nodes.Add(groupNode);
            }
            _arvore.Nodes.Add(eventNode);
        }
        var avulsas = Crono.Arr(_state, "sessions").Where(s => string.IsNullOrEmpty(s.S("proofId"))).ToList();
        if (avulsas.Count > 0)
        {
            var loose = new TreeNode("Baterias avulsas");
            foreach (var s in avulsas)
            {
                var node = new TreeNode($"{s.S("name")} · {Crono.Estado(s.S("state"))}") { Tag = new JsonObject { ["kind"] = "session", ["sessionId"] = s.S("id") } };
                loose.Nodes.Add(node);
            }
            _arvore.Nodes.Add(loose);
        }
        _arvore.ExpandAll();
        _arvore.EndUpdate();
    }

    void EditarCatalogo(string entity, bool editar = false, string tituloJanela = null)
    {
        var selected = entity switch { "events" => _gEventos.ChaveAtual as JsonObject, "groups" => _gGrupos.ChaveAtual as JsonObject, "provas" => _gProvas.ChaveAtual as JsonObject, _ => null };
        if (editar && selected == null) { Msg.Aviso(this, "Selecione um registro para editar."); return; }
        var eventRow = _gEventos.ChaveAtual as JsonObject ?? _events.FirstOrDefault();
        var groupRow = _gGrupos.ChaveAtual as JsonObject ?? _groups.FirstOrDefault(g => g.S("eventId") == eventRow?.S("id"));
        if (entity is "groups" or "provas" && eventRow == null) { Msg.Aviso(this, "Cadastre ou selecione um evento primeiro."); return; }
        if (entity == "provas" && groupRow == null) { Msg.Aviso(this, "Cadastre ou selecione um grupo primeiro."); return; }

        var fields = entity switch
        {
            "events" => new[] { ("Nome do evento", "name", selected?.S("name") ?? "Evento de karting"), ("Data", "date", selected?.S("date") ?? DateTime.Today.ToString("yyyy-MM-dd")), ("Local", "venue", selected?.S("venue") ?? "Kartódromo Internacional de Betim") },
            "groups" => new[] { ("Nome do grupo", "name", selected?.S("name") ?? "BATERIA 17:00"), ("Categoria", "categoryId", NomeCategoria(selected?.S("categoryId") ?? "")) },
            _ => new[] { ("Nome da prova", "name", selected?.S("name") ?? "Corrida"), ("Tipo (treino/classificacao/corrida)", "type", selected?.S("type") ?? "corrida"), ("Duração em minutos", "durationMin", (selected?.I("durationMin") ?? 20).ToString()), ("Voltas máximas (vazio = por tempo)", "maxLaps", selected?.L("maxLaps")?.ToString() ?? ""), ("Ordem", "order", (selected?.I("order") ?? _proofs.Count + 1).ToString()) },
        };
        using var dialog = new DialogoDados(editar ? "Editar registro" : tituloJanela ?? "Novo registro", entity switch { "events" => "Passo 1 · Eventos", "groups" => "Passo 2 · Grupos", _ => "Passo 3 · Provas" }, fields, new Size(820, 440));
        if (dialog.ShowDialog(this) != DialogResult.OK || !dialog.Confirmado) return;
        Seguro.Rodar(this, async () =>
        {
            var body = new JsonObject { ["name"] = dialog.Valor("name") };
            if (entity == "events") { body["date"] = dialog.Valor("date"); body["venue"] = dialog.Valor("venue"); }
            if (entity == "groups") { body["eventId"] = selected?.S("eventId") ?? eventRow?.S("id"); body["categoryId"] = IdCategoria(dialog.Valor("categoryId")); }
            if (entity == "provas")
            {
                var type = dialog.Valor("type").Trim().ToLowerInvariant();
                if (!new[] { "treino", "classificacao", "corrida" }.Contains(type)) throw new InvalidOperationException("Tipo deve ser treino, classificacao ou corrida.");
                body["groupId"] = selected?.S("groupId") ?? groupRow?.S("id"); body["type"] = type;
                body["durationMin"] = int.TryParse(dialog.Valor("durationMin"), out var duration) ? duration : 20;
                body["maxLaps"] = int.TryParse(dialog.Valor("maxLaps"), out var laps) ? laps : 0;
                body["order"] = int.TryParse(dialog.Valor("order"), out var order) ? order : _proofs.Count + 1;
            }
            if (editar) await Crono.Api.Patch($"/api/catalog/{entity}/{selected.S("id")}", body);
            else await Crono.Api.Post($"/api/catalog/{entity}", body);
            await CarregarCatalogo();
        });
    }

    void ExcluirCatalogo(string entity)
    {
        var selected = entity switch { "events" => _gEventos.ChaveAtual as JsonObject, "groups" => _gGrupos.ChaveAtual as JsonObject, "provas" => _gProvas.ChaveAtual as JsonObject, _ => null };
        if (selected == null) { Msg.Aviso(this, "Selecione um registro para excluir."); return; }
        if (!Msg.Pergunta(this, $"Excluir “{selected.S("name")}” e os registros vinculados?")) return;
        Seguro.Rodar(this, async () => { await Crono.Api.Delete($"/api/catalog/{entity}/{selected.S("id")}"); await CarregarCatalogo(); });
    }

    void DuplicarEvento()
    {
        if (_gEventos.ChaveAtual is not JsonObject selected) { Msg.Aviso(this, "Selecione um evento para duplicar."); return; }
        Seguro.Rodar(this, async () => { await Crono.Api.Post($"/api/catalog/events/{selected.S("id")}/duplicate"); await CarregarCatalogo(); });
    }

    void DistribuirProva()
    {
        if (_gProvas.ChaveAtual is not JsonObject proof) { Msg.Aviso(this, "Selecione uma prova para distribuir."); return; }
        using var dialog = new DialogoDados("Distribuir prova", proof.S("name"), new[] { ("Número de baterias", "heats", proof.I("heats").ToString()), ("Horário inicial (HH:mm)", "startAt", proof.S("startAt")), ("Intervalo entre baterias (min)", "intervalMin", proof.I("intervalMin").ToString()) }, new Size(700, 320));
        if (dialog.ShowDialog(this) != DialogResult.OK) return;
        Seguro.Rodar(this, async () =>
        {
            await Crono.Api.Post($"/api/catalog/provas/{proof.S("id")}/distribute", new JsonObject {
                ["heats"] = int.TryParse(dialog.Valor("heats"), out var heats) ? heats : 1,
                ["startAt"] = dialog.Valor("startAt"),
                ["intervalMin"] = int.TryParse(dialog.Valor("intervalMin"), out var interval) ? interval : 0,
            });
            await CarregarCatalogo();
        });
    }

    void ImportarCatalogo()
    {
        using var open = new OpenFileDialog { Title = "Importar eventos e provas", Filter = "Arquivo JSON (*.json)|*.json|Todos os arquivos (*.*)|*.*" };
        if (open.ShowDialog(this) != DialogResult.OK) return;
        Seguro.Rodar(this, async () =>
        {
            var data = JsonNode.Parse(await File.ReadAllTextAsync(open.FileName)) ?? throw new InvalidOperationException("O arquivo está vazio.");
            await Crono.Api.Post("/api/catalog/import", data);
            await CarregarCatalogo();
        });
    }

    void ExportarCatalogo()
    {
        using var save = new SaveFileDialog { Title = "Exportar eventos e provas", FileName = "kartodromo-eventos.json", Filter = "Arquivo JSON (*.json)|*.json" };
        if (save.ShowDialog(this) != DialogResult.OK) return;
        Seguro.Rodar(this, async () => { var data = await Crono.Api.Get("/api/catalog/export"); await File.WriteAllTextAsync(save.FileName, data?.ToJsonString(new System.Text.Json.JsonSerializerOptions { WriteIndented = true }) ?? "{}"); });
    }

    void CriarBateriaDaProva()
    {
        var proof = _gProvas.ChaveAtual as JsonObject ?? _selectedProof;
        if (proof == null) { Msg.Aviso(this, "Selecione uma prova no passo 3 ou na árvore."); return; }
        var agenda = _gAgenda.ChaveAtual as JsonObject;
        var agendaId = proof.S("agendaId");
        if (agendaId.Length == 0 && agenda != null) agendaId = agenda.L("id")?.ToString() ?? "";
        Seguro.Rodar(this, async () =>
        {
            var competitors = new JsonArray();
            if (long.TryParse(agendaId, out var aid) && aid > 0)
            {
                var grid = await Crono.Api.Lista($"/api/agenda/{aid}/grid");
                var group = _groups.FirstOrDefault(g => g.S("id") == proof.S("groupId"));
                foreach (var row in grid) competitors.Add(new JsonObject {
                    ["kart"] = row.S("kart"), ["name"] = row.S("nome"), ["customerId"] = row.S("clienteId"),
                    ["category"] = group?.S("categoryId") ?? "",
                });
            }
            var created = (await Crono.Api.Post("/api/sessions", new JsonObject {
                ["name"] = proof.S("name"), ["type"] = proof.S("type"),
                ["durationMin"] = proof.I("durationMin") > 0 ? proof.I("durationMin") : 20,
                ["maxLaps"] = proof.L("maxLaps") ?? 0, ["competitors"] = competitors,
                ["eventId"] = proof.S("eventId"), ["groupId"] = proof.S("groupId"), ["proofId"] = proof.S("id"),
            }))?.AsObject();
            var id = created?.S("id");
            if (!string.IsNullOrEmpty(id)) { Selecionar(id); _abas.SelectedIndex = 1; await CarregarCatalogo(); }
        });
    }

    void FazerBackup()
    {
        Seguro.Rodar(this, async () =>
        {
            var data = await Crono.Api.Post("/api/backup");
            Msg.Info(this, "Cópia criada no serviço de cronometragem:\n" + data?["path"]?.ToString(), "Backup de eventos");
        });
    }

    void ImprimirResumo(string titulo, List<string> linhas)
    {
        using var print = new PrintDocument();
        print.DocumentName = titulo;
        var lineIndex = 0;
        print.PrintPage += (_, e) =>
        {
            var fontTitle = new Font("Segoe UI", 16, FontStyle.Bold);
            var fontText = new Font("Segoe UI", 10);
            var y = e.MarginBounds.Top;
            e.Graphics.DrawString(titulo, fontTitle, Brushes.Black, e.MarginBounds.Left, y);
            y += 38;
            e.Graphics.DrawString(DateTime.Now.ToString("dd/MM/yyyy HH:mm"), fontText, Brushes.Gray, e.MarginBounds.Left, y);
            y += 28;
            while (lineIndex < linhas.Count && y < e.MarginBounds.Bottom)
            {
                e.Graphics.DrawString(linhas[lineIndex++], fontText, Brushes.Black, e.MarginBounds.Left, y);
                y += 22;
            }
            e.HasMorePages = lineIndex < linhas.Count;
        };
        using var dialog = new PrintDialog { Document = print, UseEXDialog = true };
        if (dialog.ShowDialog(this) == DialogResult.OK) print.Print();
    }

    void JanelaCadastro(string nome)
    {
        if (nome == "CadCategoria") { using var f = new FormCatalogoAux("categories"); f.ShowDialog(this); return; }
        if (nome == "CadTracado") { using var f = new FormCatalogoAux("tracks"); f.ShowDialog(this); return; }
        if (nome == "CadGrupo") { _abas.SelectedIndex = 0; EditarCatalogo("groups", false, nome); return; }
        if (nome == "Prova") { _abas.SelectedIndex = 0; EditarCatalogo("provas", false, nome); return; }
        if (nome == "Backup")
        {
            using var backup = new DialogoDados("Backup", "Cópia de segurança dos eventos, baterias e diário", new[] { ("Escopo", "scope", "Eventos e dados atuais"), ("Diário de passagens", "journal", "Preservado na cópia") }, new Size(720, 320));
            if (backup.ShowDialog(this) == DialogResult.OK && backup.Confirmado) FazerBackup();
            return;
        }
        if (nome == "CadTranspDePara") { using var f = new FormTransponders([], "CadTranspDePara"); f.ShowDialog(this); return; }
        if (nome == "CadTranspCompetidor") { using var f = new FormTransponders([], "CadTranspCompetidor"); f.ShowDialog(this); return; }
        if (nome == "Competidor")
        {
            using var competitor = new DialogoDados("Competidor", "Passo 5 · registro de competidores", new[] { ("Kart", "kart", ""), ("Competidor", "name", ""), ("Categoria", "category", "") }, new Size(720, 320));
            if (competitor.ShowDialog(this) == DialogResult.OK && competitor.Confirmado && _sess != null)
            {
                _gPilotos.Rows.Add(competitor.Valor("kart"), competitor.Valor("name"), "", competitor.Valor("category"));
                Seguro.Rodar(this, SalvarPilotos);
            }
            _abas.SelectedIndex = 1;
            return;
        }
        var fields = nome switch
        {
            "Empresa" => new[] { ("Razão social", "company", "Kartódromo Internacional de Betim"), ("CNPJ", "cnpj", ""), ("Telefone", "phone", ""), ("E-mail", "email", "") },
            "CadDecoder" => new[] { ("Decoder", "decoder", "TranX"), ("Endereço", "decoderHost", "192.168.20.171"), ("Porta", "decoderPort", "5100") },
            "ParamCrono" => new[] { ("Extensão do traçado (m)", "defaultTrackLengthMeters", "1000"), ("Volta mínima (s)", "minLapSeconds", "5"), ("Bip de passagem (ligado/desligado)", "beep", "ligado") },
            "ParamSistema" => new[] { ("Nome da pista", "trackName", "Kartódromo Internacional de Betim"), ("Serviço de cronometragem", "timingUrl", Config.CronoUrl), ("Servidor da recepção", "opsUrl", Config.ServidorUrl) },
            "PlacarConfig" => new[] { ("Placar padrão", "scoreboard", "Placar CalXPro"), ("Atualizar a cada (s)", "scoreboardInterval", "1") },
            "ConfigInicial" => new[] { ("Empresa", "company", "Kartódromo Internacional de Betim"), ("Pista", "trackName", "Kartódromo Internacional de Betim"), ("Decoder", "decoder", "TranX") },
            "MudarCorrida" => new[] { ("Nome", "name", _sess?.S("name") ?? ""), ("Duração em minutos", "durationMin", ((_sess?.I("durationMs") ?? 0) / 60000).ToString()), ("Voltas máximas", "maxLaps", _sess?.L("maxLaps")?.ToString() ?? "") },
            "IncluirPassagem" => new[] { ("Kart", "kart", ""), ("Competidor", "name", ""), ("Tempo da volta (segundos)", "lapSeconds", "60.000") },
            _ => new[] { ("Nome", "name", ""), ("Observação", "notes", "") },
        };
        using var dialog = new DialogoDados(nome, "Cadastro da cronometragem", fields, new Size(760, 420));
        if (dialog.ShowDialog(this) != DialogResult.OK || !dialog.Confirmado) return;
        if (nome == "MudarCorrida")
        {
            if (_sess == null) return;
            Seguro.Rodar(this, async () => { await Crono.Api.Patch($"/api/sessions/{_sess.S("id")}", new JsonObject { ["name"] = dialog.Valor("name"), ["durationMin"] = int.TryParse(dialog.Valor("durationMin"), out var d) ? d : 20, ["maxLaps"] = int.TryParse(dialog.Valor("maxLaps"), out var l) ? l : 0 }); await Atualizar(); });
        }
        else if (nome == "IncluirPassagem")
        {
            if (_sess == null) { Msg.Aviso(this, "Selecione uma bateria primeiro."); return; }
            if (decimal.TryParse(dialog.Valor("lapSeconds"), System.Globalization.NumberStyles.Number, Fmt.Br, out var seconds))
                Seguro.Rodar(this, async () => { await Crono.Api.Post($"/api/sessions/{_sess.S("id")}/passings/manual", new JsonObject { ["kart"] = dialog.Valor("kart"), ["name"] = dialog.Valor("name"), ["lapMs"] = (long)(seconds * 1000) }); await Atualizar(); });
        }
        else
        {
            var body = new JsonObject();
            foreach (var item in fields) body[item.Item2] = dialog.Valor(item.Item2);
            Seguro.Rodar(this, async () => await Crono.Api.Patch("/api/settings", body));
        }
    }

    void MudarCorrida() => JanelaCadastro("MudarCorrida");
}

sealed class FormCatalogoAux : Form
{
    readonly string _entity;
    readonly LiveGrid _grid = new();
    List<JsonObject> _records = [];

    public FormCatalogoAux(string entity)
    {
        _entity = entity;
        Text = entity == "categories" ? "Cadastro de categorias" : "Cadastro de traçados";
        Icon = Icone.App;
        Font = TemaCrono.Normal;
        BackColor = TemaCrono.Fundo;
        StartPosition = FormStartPosition.CenterParent;
        ClientSize = new Size(800, 560);
        MinimizeBox = false;
        MaximizeBox = false;
        ShowInTaskbar = false;
        TemaCrono.EstilizarGrade(_grid);
        if (entity == "categories") _grid.Col("Categoria", 250, DataGridViewContentAlignment.MiddleLeft, true).Col("Cor", 120);
        else _grid.Col("Traçado", 300, DataGridViewContentAlignment.MiddleLeft, true).Col("Extensão (m)", 130);
        var header = new Panel { Dock = DockStyle.Top, Height = 66, Padding = new Padding(18, 8, 18, 8), BackColor = Color.White };
        header.Controls.Add(new Label { Text = Text, Dock = DockStyle.Top, Height = 28, Font = TemaCrono.Titulo, ForeColor = TemaCrono.Texto });
        header.Controls.Add(new Label { Text = "Cadastros usados para organizar provas e resultados", Dock = DockStyle.Bottom, Height = 20, ForeColor = TemaCrono.Secundario, Font = TemaCrono.Pequena });
        var actions = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 48, WrapContents = false, Padding = new Padding(10, 6, 10, 6), BackColor = Color.White };
        foreach (var (label, action, primary) in new (string, Action, bool)[] { ("+ Novo", () => Editar(), true), ("Editar", () => Editar(true), false), ("Excluir", Excluir, false), ("Fechar", Close, false) })
        {
            var b = TemaCrono.Botao(label, primary); b.Click += (_, _) => action(); actions.Controls.Add(b);
        }
        Controls.Add(_grid); Controls.Add(actions); Controls.Add(header);
        Shown += async (_, _) => await Carregar();
    }

    async Task Carregar()
    {
        _records = await Crono.Api.Lista($"/api/catalog/{_entity}");
        var rows = _entity == "categories"
            ? _records.Select(x => new object[] { x.S("name"), x.S("color") }).ToList()
            : _records.Select(x => new object[] { x.S("name"), x.I("lengthMeters") }).ToList();
        _grid.Preencher(rows, _records.Cast<object>().ToList());
    }

    void Editar(bool editar = false)
    {
        var selected = _grid.ChaveAtual as JsonObject;
        if (editar && selected == null) { Msg.Aviso(this, "Selecione um cadastro."); return; }
        var fields = _entity == "categories"
            ? new[] { ("Nome", "name", selected?.S("name") ?? "Indoor"), ("Cor hexadecimal", "color", selected?.S("color") ?? "#0B7A53") }
            : new[] { ("Nome", "name", selected?.S("name") ?? "Traçado principal"), ("Extensão em metros", "lengthMeters", (selected?.I("lengthMeters") ?? 1000).ToString()) };
        using var form = new DialogoDados(Text, "Cadastro", fields, new Size(680, 330));
        if (form.ShowDialog(this) != DialogResult.OK || !form.Confirmado) return;
        Seguro.Rodar(this, async () =>
        {
            var body = new JsonObject { ["name"] = form.Valor("name") };
            if (_entity == "categories") body["color"] = form.Valor("color");
            else body["lengthMeters"] = int.TryParse(form.Valor("lengthMeters"), out var meters) ? meters : 0;
            if (editar) await Crono.Api.Patch($"/api/catalog/{_entity}/{selected!.S("id")}", body);
            else await Crono.Api.Post($"/api/catalog/{_entity}", body);
            await Carregar();
        });
    }

    void Excluir()
    {
        if (_grid.ChaveAtual is not JsonObject selected) { Msg.Aviso(this, "Selecione um cadastro."); return; }
        if (!Msg.Pergunta(this, $"Excluir “{selected.S("name")}”?")) return;
        Seguro.Rodar(this, async () => { await Crono.Api.Delete($"/api/catalog/{_entity}/{selected.S("id")}"); await Carregar(); });
    }
}
