using System.Drawing.Printing;
using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

public partial class FormCrono
{
    /// <summary>Evento mostrado na árvore dos passos 4–5 (o escolhido no passo 1; hoje, por padrão).</summary>
    string _eventoArvore;
    bool _carregandoCatalogo;
    string _ultimoEventoId;
    string _ultimoGrupoId;

    async Task CarregarCatalogo()
    {
        if (_carregandoCatalogo) return;
        _carregandoCatalogo = true;
        try
        {
            _catalog = (await Crono.Api.Get("/api/catalog"))?.AsObject() ?? new JsonObject();
            _events = Crono.Arr(_catalog, "events");
            _groups = Crono.Arr(_catalog, "groups");
            _proofs = Crono.Arr(_catalog, "provas");
            var selectedEventId = (_gEventos.ChaveAtual as JsonObject)?.S("id");
            // sem escolha: o evento de hoje (as baterias da recepção), senão o mais recente
            var hojeIso = DateTime.Today.ToString("yyyy-MM-dd");
            var selectedEvent = _events.FirstOrDefault(e => e.S("id") == selectedEventId) ?? _events.FirstOrDefault(e => e.S("date") == hojeIso && e.S("id").StartsWith("agenda-")) ?? _events.FirstOrDefault(e => e.S("date") == hojeIso) ?? _events.OrderByDescending(e => e.S("date")).FirstOrDefault();
            var busca = _buscaEvento.Text.Trim();
            var eventosVisiveis = _events.Where(e => busca.Length == 0 || e.S("name").Contains(busca, StringComparison.CurrentCultureIgnoreCase)).OrderByDescending(e => e.S("date")).ToList();
            if (busca.Length > 0 && !eventosVisiveis.Contains(selectedEvent)) selectedEvent = eventosVisiveis.FirstOrDefault();
            _gEventos.Preencher(eventosVisiveis.Select(e => new object[] { "Karting", e.S("name"), DataLegivel(e.S("date")) }).ToList(), eventosVisiveis.Cast<object>().ToList());
            if (selectedEvent != null && _gEventos.Rows.Count > 0 && _gEventos.ChaveAtual == null) SelecionarLinha(_gEventos, eventosVisiveis.IndexOf(selectedEvent));
            _eventoArvore = selectedEvent?.S("id");
            _ultimoEventoId = selectedEvent?.S("id");
            _subGrupos.Text = selectedEvent?.S("name") ?? "Selecione um evento";
            // evento sem traçado (o do dia, vindo da agenda) usa o comprimento padrão — antes mostrava o 1º da lista ("Traçado 11 Invertido")
            var tracado = Crono.Arr(_catalog, "tracks").FirstOrDefault(t => t.S("id") == selectedEvent?.S("trackId"))?.S("name") ?? "Padrão (1.110 m)";
            var eventId = selectedEvent?.S("id") ?? "";
            var eventGroups = _groups.Where(g => g.S("eventId") == eventId).ToList();
            var selectedGroupId = (_gGrupos.ChaveAtual as JsonObject)?.S("id");
            // no evento de hoje, sem escolha: já marca a bateria da hora (a mais recente que já começou com inscritos, senão a próxima)
            JsonObject GrupoDaHora()
            {
                var agora = DateTime.Now.AddMinutes(10).ToString("yyyy-MM-ddTHH:mm");
                var com = _agenda.Where(b => b.I("inscritos") > 0).ToList();
                var alvo = com.LastOrDefault(b => string.CompareOrdinal(b.S("inicio"), agora) <= 0) ?? com.FirstOrDefault();
                return alvo == null ? null : eventGroups.FirstOrDefault(g => g.S("id") == $"agenda-b{alvo.L("id")}");
            }
            eventGroups = eventGroups.OrderBy(g => g.I("order")).ToList();
            var selectedGroup = eventGroups.FirstOrDefault(g => g.S("id") == selectedGroupId) ?? GrupoDaHora() ?? eventGroups.FirstOrDefault();
            _gGrupos.Preencher(eventGroups.Select(g => new object[] { g.S("name"), tracado }).ToList(), eventGroups.Cast<object>().ToList());
            if (selectedGroup != null && _gGrupos.Rows.Count > 0 && _gGrupos.ChaveAtual == null) SelecionarLinha(_gGrupos, eventGroups.IndexOf(selectedGroup));
            var groupId = selectedGroup?.S("id") ?? "";
            _ultimoGrupoId = groupId;
            var groupProofs = _proofs.Where(p => p.S("groupId") == groupId).OrderBy(p => p.I("order")).ToList();
            _tituloProvas.Text = selectedGroup == null ? "Provas" : $"Provas da {selectedGroup.S("name")}";
            string Previsao(JsonObject p) { var d = DateTime.TryParse(selectedEvent?.S("date"), out var dd) ? dd : DateTime.Today; var h = p.S("startAt") is { Length: >= 4 } sa ? sa : (selectedGroup?.S("name") is { } gn && System.Text.RegularExpressions.Regex.Match(gn, @"\d{1,2}:\d{2}") is { Success: true } m ? m.Value : ""); return $"{d:dd/MM} {h}".Trim(); }
            _gProvas.Preencher(groupProofs.Select(p => new object[] { Previsao(p), Crono.Tipo(p.S("type")), p.S("name"), tracado, p.I("durationMin") > 0 ? "Por tempo" : "Por voltas", p.I("durationMin") > 0 ? TimeSpan.FromMinutes(p.I("durationMin")).ToString(@"hh\:mm\:ss") : "—", p.L("maxLaps") is long laps && laps > 0 ? laps.ToString() : "—" }).ToList(), groupProofs.Cast<object>().ToList());
            if (groupProofs.Count > 0 && _gProvas.ChaveAtual == null) SelecionarLinha(_gProvas, 0);
            MontarArvore();
        }
        catch (ApiException e) { _servidorOk = false; _gEventos.Preencher([new object[] { "Cadastros indisponíveis", e.Message, "" }]); }
        finally { _carregandoCatalogo = false; }
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
        var sessoes = Crono.Arr(_state, "sessions");
        var assinatura = $"sel:{_eventoArvore}|" + string.Join("|", _events.Select(e => $"e:{e.S("id")}:{e.S("name")}:{e.S("date")}")) +
            string.Join("|", _groups.Select(g => $"g:{g.S("id")}:{g.S("eventId")}:{g.S("name")}")) +
            string.Join("|", _proofs.Select(p => $"p:{p.S("id")}:{p.S("groupId")}:{p.S("name")}:{p.I("order")}")) +
            string.Join("|", sessoes.Select(s => $"s:{s.S("id")}:{s.S("proofId")}:{s.S("name")}:{s.S("state")}"));
        if (assinatura == _arvoreAssinatura) return;
        var tagSelecionada = _arvore.SelectedNode?.Tag as JsonObject;
        var selecionado = tagSelecionada?.S(tagSelecionada.S("kind") == "session" ? "sessionId" : "proofId");
        _montandoArvore = true;
        _arvore.BeginUpdate();
        try
        {
            _arvore.Nodes.Clear();
            foreach (var ev in _events.Where(e => _eventoArvore == null || e.S("id") == _eventoArvore))
            {
                var eventNode = new TreeNode($"▣  {ev.S("name")}  ·  {DataLegivel(ev.S("date"))}") { Tag = new JsonObject { ["kind"] = "event", ["name"] = $"{ev.S("name")}" } };
                foreach (var group in _groups.Where(g => g.S("eventId") == ev.S("id")))
                {
                    var groupNode = new TreeNode($"▾  {group.S("name")}") { Tag = new JsonObject { ["kind"] = "group", ["name"] = group.S("name"), ["pilotos"] = sessoes.Where(s => s.S("groupId") == group.S("id")).Select(s => s.I("competitors")).DefaultIfEmpty(0).Max() } };
                    foreach (var proof in _proofs.Where(p => p.S("groupId") == group.S("id")).OrderBy(p => p.I("order")))
                    {
                        var proofNode = new TreeNode($"●  {proof.S("name")} · {Crono.Tipo(proof.S("type"))}");
                        proofNode.Tag = new JsonObject { ["kind"] = "proof", ["proofId"] = proof.S("id"), ["type"] = proof.S("type"), ["label"] = proof.S("name") is { Length: > 0 } pn ? pn : Crono.Tipo(proof.S("type")) };
                        var session = sessoes.FirstOrDefault(s => s.S("proofId") == proof.S("id"));
                        if (session != null)
                        {
                            proofNode.Text += $" · {Crono.Estado(session.S("state"))}";
                            proofNode.Tag = new JsonObject { ["kind"] = "session", ["sessionId"] = session.S("id"), ["proofId"] = proof.S("id"), ["type"] = proof.S("type"), ["label"] = proof.S("name") is { Length: > 0 } pn2 ? pn2 : Crono.Tipo(proof.S("type")), ["state"] = session.S("state") };
                        }
                        groupNode.Nodes.Add(proofNode);
                    }
                    eventNode.Nodes.Add(groupNode);
                }
                _arvore.Nodes.Add(eventNode);
            }
            var inicioHoje = new DateTimeOffset(DateTime.Today).ToUnixTimeMilliseconds();
            var avulsas = sessoes.Where(s => string.IsNullOrEmpty(s.S("proofId")) && ((s.L("createdAt") ?? 0) >= inicioHoje || s.S("state") is "preparando" or "em_andamento" or "bandeira_final")).ToList();
            if (avulsas.Count > 0)
            {
                var loose = new TreeNode("Baterias avulsas") { Tag = new JsonObject { ["kind"] = "event", ["name"] = "Baterias avulsas" } };
                foreach (var s in avulsas)
                {
                    var node = new TreeNode($"{s.S("name")} · {Crono.Estado(s.S("state"))}") { Tag = new JsonObject { ["kind"] = "session", ["sessionId"] = s.S("id"), ["type"] = s.S("type"), ["label"] = s.S("name"), ["state"] = s.S("state") } };
                    loose.Nodes.Add(node);
                }
                _arvore.Nodes.Add(loose);
            }
            _arvore.ExpandAll();
            if (!string.IsNullOrEmpty(selecionado))
            {
                TreeNode Achar(TreeNodeCollection nos)
                {
                    foreach (TreeNode no in nos)
                    {
                        var tag = no.Tag as JsonObject;
                        if (tag?.S("sessionId") == selecionado || tag?.S("proofId") == selecionado) return no;
                        var filho = Achar(no.Nodes);
                        if (filho != null) return filho;
                    }
                    return null;
                }
                _arvore.SelectedNode = Achar(_arvore.Nodes);
            }
        }
        finally { _arvore.EndUpdate(); _montandoArvore = false; }
        _arvoreAssinatura = assinatura;
    }

    void EditarCatalogo(string entity, bool editar = false, string tituloJanela = null)
    {
        if (entity == "events") { EditarEventoDesign(editar); return; }
        if (entity == "groups") { EditarGrupoDesign(editar); return; }
        if (entity == "provas") { EditarProvaDesign(editar); return; }
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
        DistribuirProvaDesign();
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
        // telas no visual do design
        if (CadastroDesign(nome)) return;
        if (nome is "Empresa" or "ParamCrono" or "ParamSistema" or "Backup" or "ConfigInicial" or "Banner") { Seguro.Rodar(this, () => DialogoConfiguracao(nome)); return; }
        if (nome == "IncluirPassagem") { IncluirPassagemDesign(); return; }
        if (nome == "MudarCorrida") { MudarCorridaDesign(); return; }
        if (nome == "Prova") { _abas.SelectedIndex = 0; EditarProvaDesign(false); return; }
        if (nome == "RelatoriosCrono") { AbrirRelatoriosCrono(); return; }
        // telas do canvas que faltavam (FormCrono.Seguranca.cs)
        if (nome == "Competidor")
        {
            if (_sess == null || Crono.Arr(_sess, "competitors").Count == 0) { Msg.Aviso(this, "Escolha a bateria e clique no competidor (passos 4–5 · Registro de competidores)."); return; }
            if (_gPilotos.CurrentRow is { IsNewRow: false }) RegistroCompetidorSelecionado("pilotos"); else RegistroCompetidor(0);
            return;
        }
        if (nome == "RankingPeso") { RankingPesoDesign(); return; }
        if (nome == "SegUsuario") { Seguro.Rodar(this, SegUsuario); return; }
        if (nome == "SegPerfil") { Seguro.Rodar(this, SegPerfil); return; }
        if (nome == "Permissoes") { Seguro.Rodar(this, Permissoes); return; }
        if (nome == "CadDecoder") { Seguro.Rodar(this, ConfigurarDecoder); return; }
        if (nome is "ParamCrono" or "ParamSistema" or "ConfigInicial") { Seguro.Rodar(this, () => ConfigurarParametros(nome)); return; }
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
        var fields = nome switch
        {
            "Empresa" => new[] { ("Razão social", "company", "Kartódromo Internacional de Betim"), ("CNPJ", "cnpj", ""), ("Telefone", "phone", ""), ("E-mail", "email", "") },
            "PlacarConfig" => new[] { ("Placar padrão", "scoreboard", "Placar CalXPro"), ("Atualizar a cada (s)", "scoreboardInterval", "1") },
            "MudarCorrida" => new[] { ("Nome", "name", _sess?.S("name") ?? ""), ("Duração em minutos", "durationMin", ((_sess?.I("durationMs") ?? 0) / 60000).ToString()), ("Voltas máximas", "maxLaps", _sess?.L("maxLaps")?.ToString() ?? "") },
            "IncluirPassagem" => new[] { ("Kart", "kart", ""), ("Competidor", "name", ""), ("Tempo da volta (segundos)", "lapSeconds", "60,000") },
            _ => null,
        };
        if (fields == null) { Msg.Aviso(this, $"Tela \"{nome}\" não encontrada."); return; }
        using var dialog = new DialogoDados(nome, "Cadastro da cronometragem", fields, new Size(760, 420));
        if (dialog.ShowDialog(this) != DialogResult.OK || !dialog.Confirmado) return;
        if (nome == "MudarCorrida")
        {
            if (_sess == null) return;
            Seguro.Rodar(this, async () => {
                var l = int.TryParse(dialog.Valor("maxLaps"), out var vl) ? vl : 0;
                var d = int.TryParse(dialog.Valor("durationMin"), out var vd) ? vd : (l > 0 ? 0 : 20);
                await Crono.Api.Patch($"/api/sessions/{_sess.S("id")}", new JsonObject { ["name"] = dialog.Valor("name"), ["durationMin"] = d, ["maxLaps"] = l });
                await Atualizar();
            });
        }
        else if (nome == "IncluirPassagem")
        {
            if (_sess == null) { Msg.Aviso(this, "Selecione uma bateria primeiro."); return; }
            if (!TentarSegundos(dialog.Valor("lapSeconds"), out var seconds)) { Msg.Aviso(this, "Informe um tempo positivo em segundos."); return; }
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

    static bool TentarSegundos(string texto, out decimal segundos)
    {
        var cultura = texto.Contains(',') ? Fmt.Br : System.Globalization.CultureInfo.InvariantCulture;
        return decimal.TryParse(texto, System.Globalization.NumberStyles.Number, cultura, out segundos) && segundos > 0;
    }

    async Task ConfigurarDecoder()
    {
        var settings = (await Crono.Api.Get("/api/settings"))?.AsObject() ?? new JsonObject();
        var atual = settings["decoder"] as JsonObject ?? (await Crono.Api.Get("/api/state"))?["decoder"] as JsonObject ?? new JsonObject();
        using var dialog = new DialogoDados("Registro de decoder", "Leitor de transponders da pista", new[] {
            ("Nome", "name", atual.S("name") is { Length: > 0 } n ? n : "TranX (pista)"),
            ("Modelo", "model", atual.S("model") is { Length: > 0 } m ? m : "TranX"),
            ("Protocolo (p3 ou trx)", "protocol", atual.S("protocol") is { Length: > 0 } p ? p : "p3"),
            ("Endereço IP", "host", atual.S("host")),
            ("Porta IP", "port", atual.S("port")),
        }, new Size(760, 430));
        if (dialog.ShowDialog(this) != DialogResult.OK || !dialog.Confirmado) return;
        if (!int.TryParse(dialog.Valor("port"), out var port) || port is < 1 or > 65535) { Msg.Aviso(this, "Informe uma porta entre 1 e 65535."); return; }
        var protocol = dialog.Valor("protocol").Trim().ToLowerInvariant();
        if (protocol is not ("p3" or "trx")) { Msg.Aviso(this, "Informe o protocolo p3 ou trx."); return; }
        var body = new JsonObject { ["name"] = dialog.Valor("name").Trim(), ["model"] = dialog.Valor("model").Trim(),
            ["protocol"] = protocol, ["host"] = dialog.Valor("host").Trim(), ["port"] = port };
        await Crono.Api.Patch("/api/settings/decoder", body);
        Msg.Info(this, "Conexão do decoder validada e salva.");
    }

    async Task ConfigurarParametros(string nome)
    {
        var settings = (await Crono.Api.Get("/api/settings"))?.AsObject() ?? new JsonObject();
        var crono = nome == "ParamCrono";
        var chave = crono ? "timing" : "system";
        var secao = settings[chave]?.DeepClone().AsObject() ?? new JsonObject();
        var campos = crono
            ? new[] { ("Volta mínima (s)", "minimumLapSeconds", secao.S("minimumLapSeconds") is { Length: > 0 } v ? v : "5"),
                ("Duração padrão (min)", "defaultDurationMin", secao.S("defaultDurationMin") is { Length: > 0 } d ? d : "20") }
            : new[] { ("Nome da pista", "trackName", secao.S("trackName") is { Length: > 0 } n ? n : "Kartódromo Internacional de Betim"),
                ("Extensão padrão do traçado (m)", "defaultTrackLengthMeters", secao.S("defaultTrackLengthMeters") is { Length: > 0 } l ? l : "1000") };
        using var dialog = new DialogoDados(crono ? "Parâmetros da cronometragem" : "Parâmetros do sistema", "Configuração usada ao criar novas provas", campos, new Size(760, 350));
        if (dialog.ShowDialog(this) != DialogResult.OK || !dialog.Confirmado) return;
        if (crono)
        {
            if (!double.TryParse(dialog.Valor("minimumLapSeconds"), System.Globalization.NumberStyles.Number, Fmt.Br, out var minimo) || minimo is < 0.1 or > 60)
            { Msg.Aviso(this, "A volta mínima deve ficar entre 0,1 e 60 segundos."); return; }
            if (!int.TryParse(dialog.Valor("defaultDurationMin"), out var duracao) || duracao is < 1 or > 600)
            { Msg.Aviso(this, "A duração deve ficar entre 1 e 600 minutos."); return; }
            secao["minimumLapSeconds"] = minimo;
            secao["defaultDurationMin"] = duracao;
        }
        else
        {
            if (!double.TryParse(dialog.Valor("defaultTrackLengthMeters"), System.Globalization.NumberStyles.Number, Fmt.Br, out var metros) || metros <= 0)
            { Msg.Aviso(this, "Informe uma extensão de traçado maior que zero."); return; }
            secao["trackName"] = dialog.Valor("trackName").Trim();
            secao["defaultTrackLengthMeters"] = metros;
        }
        await Crono.Api.Patch("/api/settings", new JsonObject { [chave] = secao });
        Msg.Info(this, "Parâmetros salvos.");
    }
}

sealed class FormCatalogoAux : Form
{
    readonly string _entity;
    readonly LiveGrid _grid = new();
    List<JsonObject> _records = [];
    List<JsonObject> _categories = [];

    public FormCatalogoAux(string entity)
    {
        _entity = entity;
        Text = entity switch { "categories" => "Cadastro de categorias", "competitors" => "Cadastro de competidores", _ => "Cadastro de traçados" };
        Icon = Icone.App;
        Font = TemaCrono.Normal;
        BackColor = TemaCrono.Fundo;
        StartPosition = FormStartPosition.CenterParent;
        ClientSize = new Size(entity == "competitors" ? 1000 : 800, 560);
        MinimizeBox = false;
        MaximizeBox = false;
        ShowInTaskbar = false;
        TemaCrono.EstilizarGrade(_grid);
        if (entity == "categories") _grid.Col("Categoria", 250, DataGridViewContentAlignment.MiddleLeft, true).Col("Cor", 120);
        else if (entity == "competitors") _grid.Col("Competidor", 280, DataGridViewContentAlignment.MiddleLeft, true).Col("Kart", 80).Col("Transponder", 135).Col("Categoria", 180).Col("Peso (kg)", 100);
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
        Shown += (_, _) => Seguro.Rodar(this, Carregar);
    }

    async Task Carregar()
    {
        _records = await Crono.Api.Lista($"/api/catalog/{_entity}");
        if (_entity == "competitors") _categories = await Crono.Api.Lista("/api/catalog/categories");
        var rows = _entity == "categories"
            ? _records.Select(x => new object[] { x.S("name"), x.S("color") }).ToList()
            : _entity == "competitors"
                ? _records.Select(x => new object[] { x.S("name"), x.S("kart"), x.S("transponder"), _categories.FirstOrDefault(c => c.S("id") == x.S("categoryId"))?.S("name") ?? "", x.S("weightKg") }).ToList()
                : _records.Select(x => new object[] { x.S("name"), x.I("lengthMeters") }).ToList();
        _grid.Preencher(rows, _records.Cast<object>().ToList());
    }

    void Editar(bool editar = false)
    {
        var selected = _grid.ChaveAtual as JsonObject;
        if (editar && selected == null) { Msg.Aviso(this, "Selecione um cadastro."); return; }
        var fields = _entity == "categories"
            ? new[] { ("Nome", "name", selected?.S("name") ?? "Indoor"), ("Cor hexadecimal", "color", selected?.S("color") ?? "#0B7A53") }
            : _entity == "competitors"
                ? new[] { ("Nome", "name", selected?.S("name") ?? ""), ("Kart", "kart", selected?.S("kart") ?? ""),
                    ("Transponder", "transponder", selected?.S("transponder") ?? ""),
                    ("Categoria", "categoryId", _categories.FirstOrDefault(c => c.S("id") == selected?.S("categoryId"))?.S("name") ?? ""),
                    ("Peso (kg)", "weightKg", selected?.S("weightKg") ?? "") }
                : new[] { ("Nome", "name", selected?.S("name") ?? "Traçado principal"), ("Extensão em metros", "lengthMeters", (selected?.I("lengthMeters") ?? 1000).ToString()) };
        using var form = new DialogoDados(Text, "Cadastro", fields, new Size(680, _entity == "competitors" ? 420 : 330));
        if (form.ShowDialog(this) != DialogResult.OK || !form.Confirmado) return;
        Seguro.Rodar(this, async () =>
        {
            var body = new JsonObject { ["name"] = form.Valor("name") };
            if (_entity == "categories") body["color"] = form.Valor("color");
            else if (_entity == "competitors")
            {
                body["kart"] = form.Valor("kart").Trim();
                body["transponder"] = form.Valor("transponder").Trim();
                var categoria = form.Valor("categoryId").Trim();
                body["categoryId"] = _categories.FirstOrDefault(c => c.S("id") == categoria || c.S("name").Equals(categoria, StringComparison.OrdinalIgnoreCase))?.S("id") ?? categoria;
                var peso = form.Valor("weightKg").Trim();
                if (peso.Length > 0)
                {
                    if (!double.TryParse(peso, System.Globalization.NumberStyles.Number, Fmt.Br, out var kg) || kg <= 0) { Msg.Aviso(this, "Informe um peso maior que zero."); return; }
                    body["weightKg"] = kg;
                }
                else body["weightKg"] = null;
            }
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
