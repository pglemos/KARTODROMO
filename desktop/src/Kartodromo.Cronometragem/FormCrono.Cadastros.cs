using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

/// <summary>Cadastros e diálogos da cronometragem no visual do design (componentes Cadastro e Dialogo do canvas),
/// ligados ao serviço de cronometragem (catálogo, transponders, decoder, configurações).</summary>
public partial class FormCrono
{
    static FonteReg Catalogo(string entidade, Func<List<JsonObject>, List<JsonObject>> filtro = null, Action<JsonObject> completar = null) => new()
    {
        Listar = async () => { var l = await Crono.Api.Lista($"/api/catalog/{entidade}"); return filtro?.Invoke(l) ?? l; },
        Incluir = b => { completar?.Invoke(b); return Crono.Api.Post($"/api/catalog/{entidade}", b); },
        Alterar = (r, b) => Crono.Api.Patch($"/api/catalog/{entidade}/{r.S("id")}", b),
        Excluir = r => Crono.Api.Delete($"/api/catalog/{entidade}/{r.S("id")}"),
    };

    static string SimNao(JsonObject r, string k) => r[k] is null || r.B(k) ? "Sim" : "Não";

    /// <summary>Abre o cadastro do design (true) ou devolve false para cair no antigo.</summary>
    /// <summary>Transponders lidos sem kart (alerta do rodapé): aparecem na lista do De/Para.</summary>
    List<string> _transpNovos = [];

    bool CadastroDesign(string nome)
    {
        RegistroDesign f = nome switch
        {
            "CadCategoria" => new("Registro de categoria", "Separa os resultados (ex.: Indoor, Super Kart)", "M4 6h16M4 12h16M4 18h10", "linear-gradient(180deg, #6CB8FF, #1E6FE8)",
                [new("sport", "Esporte", 2, "select", ["Karting=Karting"]), new("name", "Nome", 3), new("active", "Ativo", 1, "bool")],
                [new("Esporte", 200, r => r.S("sport") is { Length: > 0 } sp ? sp : "Karting"), new("Nome", 0, r => r.S("name")), new("Ativo", 80, r => SimNao(r, "active"), 'C')],
                Catalogo("categories")) { Nome = "categoria", Padrao = () => new JsonObject { ["sport"] = "Karting", ["active"] = true } },

            "CadTracado" => new("Registro de traçado", "Desenhos da pista · o comprimento calcula a velocidade média", "M4 18c0-6 4-12 8-12s4 6 8 6M4 18h4", "linear-gradient(180deg, #5EDB7A, #1E9E4A)",
                [new("name", "Nome", 3), new("lengthMeters", "Comprimento (m)", 2, "int"), new("active", "Ativo", 1, "bool")],
                [new("Nome", 0, r => r.S("name")), new("Comprimento (m)", 180, r => r.S("lengthMeters"), 'D'), new("Ativo", 80, r => SimNao(r, "active"), 'C')],
                Catalogo("tracks")) { Nome = "traçado", Padrao = () => new JsonObject { ["active"] = true, ["lengthMeters"] = 1100 } },

            "CadGrupo" => CadastroGrupo(),

            "CadTranspDePara" => new("Registro de transponder (De/Para)", "Número gravado no transponder → número do kart", "M7 7h10v10H7zM4 10h3M4 14h3M17 10h3M17 14h3M10 4v3M14 4v3M10 17v3M14 17v3", "linear-gradient(180deg, #48D6CC, #0E9C9C)",
                [new("decoder", "Decoder", 2, "select", [$"{NomeDecoder()}={NomeDecoder()}"]), new("raw", "Nº original (transponder)", 2, "int"), new("kart", "Nº novo (kart)", 2)],
                [new("Decoder", 0, r => r.S("decoder")), new("Nº original", 180, r => r.S("raw"), 'D'), new("Nº novo (kart)", 160, r => r.S("kart"), 'D')],
                new FonteReg
                {
                    Listar = async () =>
                    {
                        var mapa = (await Crono.Api.Get("/api/transponders"))?.AsObject() ?? [];
                        var lista = mapa.Select(kv => new JsonObject { ["id"] = kv.Key, ["raw"] = kv.Key, ["kart"] = kv.Value?.ToString(), ["decoder"] = NomeDecoder() })
                            .OrderBy(r => int.TryParse(r.S("kart"), out var k) ? k : 9999).ToList();
                        // lidos na pista sem kart: aparecem primeiro, sem número, para digitar o kart
                        foreach (var t in _transpNovos.Where(t => !mapa.ContainsKey(t)).Reverse()) lista.Insert(0, new JsonObject { ["id"] = t, ["raw"] = t, ["kart"] = "", ["decoder"] = NomeDecoder() });
                        return lista;
                    },
                    Incluir = b => Crono.Api.Put("/api/transponders", new JsonObject { ["raw"] = b.S("raw"), ["kart"] = b.S("kart") }),
                    Alterar = async (r, b) =>
                    {
                        if (r.S("raw") != b.S("raw")) await Crono.Api.Put("/api/transponders", new JsonObject { ["raw"] = r.S("raw"), ["kart"] = "" });
                        return await Crono.Api.Put("/api/transponders", new JsonObject { ["raw"] = b.S("raw"), ["kart"] = b.S("kart") });
                    },
                    Excluir = r => Crono.Api.Put("/api/transponders", new JsonObject { ["raw"] = r.S("raw"), ["kart"] = "" }),
                }) { Nome = "transponder", Padrao = () => new JsonObject { ["decoder"] = NomeDecoder() } },

            "CadTranspCompetidor" => new("Registro de transponder X competidor", "Qual número de competidor cada transponder representa, por categoria", "M7 7h10v10H7zM4 10h3M4 14h3M17 10h3M17 14h3M10 4v3M14 4v3M10 17v3M14 17v3", "linear-gradient(180deg, #48D6CC, #0E9C9C)",
                [new("categoryId", "Categoria", 2, "lista", Itens: () => Crono.Arr(_catalog, "categories").Select((c, i) => new Campos.Item(i + 1, c.S("name"), c))), new("transponder", "Transponder", 2, "int"), new("kart", "Competidor (nº)", 2)],
                [new("Categoria", 0, r => NomeCategoria(r.S("categoryId"))), new("Transponder", 160, r => r.S("transponder"), 'D'), new("Competidor", 160, r => r.S("kart"), 'D')],
                CatalogoCompetidores()) { Nome = "transponder" },

            "CadDecoder" => CadastroDecoder(),
            "PlacarConfig" => CadastroPlacar(),
            _ => null,
        };
        if (f == null) return false;
        f.Depois = async () => { await CarregarCatalogo(); };
        f.ShowDialog(this);
        return true;
    }

    string NomeDecoder() => (_state?["decoder"] as JsonObject)?.S("name") is { Length: > 0 } n ? n : "TranX (pista)";

    /// <summary>Transponder × competidor: guarda no cadastro de competidores do catálogo (categoria em id).</summary>
    FonteReg CatalogoCompetidores()
    {
        var cats = Crono.Arr(_catalog, "categories");
        long IdLista(string catId) => cats.FindIndex(c => c.S("id") == catId) + 1;
        string CatDe(JsonObject b) => b["categoryId"] is JsonNode n && long.TryParse(n.ToString(), out var i) && i > 0 && i <= cats.Count ? cats[(int)i - 1].S("id") : null;
        return new FonteReg
        {
            Listar = async () => (await Crono.Api.Lista("/api/catalog/competitors")).Select(r => { var c = (JsonObject)r.DeepClone(); c["categoryId"] = IdLista(r.S("categoryId")); c["_cat"] = r.S("categoryId"); return c; }).ToList(),
            Incluir = b => Crono.Api.Post("/api/catalog/competitors", new JsonObject { ["name"] = $"Kart {b.S("kart")}", ["kart"] = b.S("kart"), ["transponder"] = b.S("transponder"), ["categoryId"] = CatDe(b) }),
            Alterar = (r, b) => Crono.Api.Patch($"/api/catalog/competitors/{r.S("id")}", new JsonObject { ["kart"] = b.S("kart"), ["transponder"] = b.S("transponder"), ["categoryId"] = CatDe(b) }),
            Excluir = r => Crono.Api.Delete($"/api/catalog/competitors/{r.S("id")}"),
        };
    }

    RegistroDesign CadastroGrupo()
    {
        var ev = (_gEventos.ChaveAtual as JsonObject) ?? _events.FirstOrDefault();
        var f = new RegistroDesign("Registro de grupos", ev == null ? "Baterias, campeonatos e eventos reutilizáveis" : $"Grupos de {ev.S("name")}", "M4 6h16v5H4zM4 13h16v5H4z", "linear-gradient(180deg, #8C89FF, #4B47D6)",
            [new("name", "Nome", 5), new("active", "Ativo", 1, "bool")],
            [new("Nome", 0, r => r.S("name")), new("Ativo", 80, r => SimNao(r, "active"), 'C')],
            Catalogo("groups", l => ev == null ? l : l.Where(g => g.S("eventId") == ev.S("id")).ToList(), b => b["eventId"] = ev?.S("id")))
        { Nome = "grupo", Padrao = () => new JsonObject { ["active"] = true } };
        if (ev == null) f.Validar = _ => "Cadastre um evento primeiro (passo 1).";
        return f;
    }

    RegistroDesign CadastroDecoder()
    {
        return new RegistroDesign("Registro de decoder", "Leitor dos transponders na linha de chegada", "M4 12a8 8 0 0 1 16 0M7 12a5 5 0 0 1 10 0M12 12h.01M12 12v8", "linear-gradient(180deg, #FF7A6B, #E0342A)",
            [new("name", "Nome", 2), new("model", "Modelo", 2, "select", ["TranX=TranX", "P3=MyLaps P3", "Simulador=Simulador"]), new("protocol", "Protocolo", 2, "select", ["trx=TranX (TCP/IP)", "p3=P3 (TCP/IP)"]),
             new("host", "Endereço IP", 2), new("port", "Porta IP", 1, "int")],
            [new("Nome", 0, r => r.S("name")), new("Modelo", 140, r => r.S("model")), new("Conexão", 120, r => r.S("protocol").ToUpperInvariant() + " · TCP/IP"), new("Endereço", 200, r => $"{r.S("host")}:{r.S("port")}"),
             new("Situação", 130, r => r.B("healthy") ? "Recebendo" : r.B("connected") ? "Sem dados" : "Desconectado")],
            new FonteReg
            {
                Listar = async () =>
                {
                    var st = (await Crono.Api.Get("/api/settings"))?.AsObject();
                    var d = (st?["decoder"] as JsonObject)?.DeepClone().AsObject() ?? new JsonObject();
                    var vivo = (await Crono.Api.Get("/api/state"))?["decoder"] as JsonObject;
                    d["id"] = "decoder"; d["name"] ??= "TranX (pista)"; d["model"] ??= "TranX"; d["protocol"] ??= vivo?.S("protocol") ?? "trx"; d["host"] ??= vivo?.S("host"); d["port"] ??= vivo?.S("port");
                    d["healthy"] = vivo?.B("healthy") ?? false; d["connected"] = vivo?.B("connected") ?? false;
                    return [d];
                },
                Incluir = b => throw new ApiException("A pista tem um decoder só: altere os dados do decoder da lista.", 400),
                Alterar = async (_, b) =>
                {
                    var r = await Crono.Api.Patch("/api/settings/decoder", new JsonObject { ["name"] = b.S("name"), ["model"] = b.S("model"), ["protocol"] = b.S("protocol"), ["host"] = b.S("host"), ["port"] = b.I("port") });
                    Msg.Info(this, "Conexão do decoder testada e salva.");
                    return r;
                },
                Excluir = _ => throw new ApiException("O decoder da pista não pode ser excluído.", 400),
            }) { Nome = "decoder" };
    }

    RegistroDesign CadastroPlacar()
    {
        var portas = System.IO.Ports.SerialPort.GetPortNames().OrderBy(p => p).Select(p => $"{p}={p}").Prepend("DESLIGADO=Desligado").ToArray();
        return new RegistroDesign("Registro de placar", "Placar de LED da pista (posições e tempos)", "M3 4h18v12H3zM7 20h10M9 8h2v4M13 8h2v4", "linear-gradient(180deg, #6CB8FF, #1E6FE8)",
            [new("name", "Nome", 2), new("porta", "Porta serial", 2, "select", portas), new("baud", "Baud rate", 1, "int"), new("linhas", "Linhas", 1, "int")],
            [new("Nome", 0, r => r.S("name")), new("Porta serial", 140, r => r.S("porta")), new("Baud", 90, r => r.S("baud"), 'D'), new("Linhas", 80, r => r.S("linhas"), 'D'), new("Situação", 200, r => r.S("situacao"))],
            new FonteReg
            {
                Listar = () => Task.FromResult(new List<JsonObject> { new() { ["id"] = "placar", ["name"] = "Placar de LED (pista)", ["porta"] = _painel.Porta.Length > 0 ? _painel.Porta : "DESLIGADO", ["baud"] = _painel.Baud, ["linhas"] = _painel.Linhas, ["situacao"] = _painel.Ativo ? _painel.Situacao : "desligado" } }),
                Incluir = b => throw new ApiException("A pista tem um placar só: altere os dados da lista.", 400),
                Alterar = (_, b) =>
                {
                    var porta = b.S("porta").ToUpperInvariant();
                    if (porta is "" or "DESLIGADO") { if (File.Exists(PainelLed.ArquivoConfig)) File.Delete(PainelLed.ArquivoConfig); }
                    else PainelLed.SalvarConfig(porta, b.I("baud") > 0 ? b.I("baud") : 9600, b.I("linhas") > 0 ? b.I("linhas") : 10);
                    _painel.Dispose(); _painel.LerConfig(); AtualizarBotoesPainel();
                    return Task.FromResult<JsonNode>(new JsonObject { ["id"] = "placar" });
                },
                Excluir = _ => throw new ApiException("Para desligar o placar escolha a porta \"Desligado\".", 400),
            }) { Nome = "placar" };
    }

    // ------------------------------------------------------------------ diálogos (componente Dialogo do canvas)

    DialogoDesign NovoDialogo(string titulo, string sub, string svg, string cor) => new(titulo, sub, svg, cor);

    static TextBox Txt(string v, int max = 200) => PecasDesign.Texto(v ?? "", max);
    static TextBox Leitura(string v) { var t = PecasDesign.Texto(v ?? ""); t.ReadOnly = true; t.BackColor = Color.White; t.TabStop = false; return t; }

    void EditarEventoDesign(bool editar)
    {
        var sel = editar ? _gEventos.ChaveAtual as JsonObject : null;
        if (editar && sel == null) { Msg.Aviso(this, "Selecione o evento."); return; }
        using var d = NovoDialogo(editar ? "Editar evento" : "Novo evento", "Passo 1 · o dia ou o campeonato", "M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z", "linear-gradient(180deg, #34C759, #0B7A53)");
        var nome = Txt(sel?.S("name") ?? $"Baterias {DateTime.Today:dd/MM/yyyy}");
        var data = new DataDesign(DateTime.TryParse(sel?.S("date"), out var dt) ? dt : DateTime.Today);
        var local = Txt(sel?.S("venue") ?? "Kartódromo Internacional de Betim");
        var tracado = new ListaDesign(); tracado.Items.Add(new Campos.Item(0, "(padrão)"));
        var trks = Crono.Arr(_catalog, "tracks"); for (var i = 0; i < trks.Count; i++) tracado.Items.Add(new Campos.Item(i + 1, trks[i].S("name"), trks[i]));
        tracado.SelectedIndex = Math.Max(0, trks.FindIndex(t => t.S("id") == sel?.S("trackId")) + 1);
        var g = d.Secao("Evento");
        d.Campo(g, "Nome", nome, 3); d.Campo(g, "Data", data, 1); d.Campo(g, "Traçado", tracado, 2); d.Campo(g, "Local", local, 6);
        d.BotaoRodape("Salvar", true, () => Seguro.Rodar(d, async () =>
        {
            if (nome.Text.Trim().Length == 0) { Msg.Aviso(d, "Informe o nome do evento."); return; }
            var body = new JsonObject { ["name"] = nome.Text.Trim(), ["date"] = data.Valida ? data.Value.ToString("yyyy-MM-dd") : "", ["venue"] = local.Text.Trim(), ["trackId"] = (tracado.SelectedItem as Campos.Item)?.Dados?.S("id") };
            if (sel != null) await Crono.Api.Patch($"/api/catalog/events/{sel.S("id")}", body); else await Crono.Api.Post("/api/catalog/events", body);
            d.DialogResult = DialogResult.OK; d.Close(); await CarregarCatalogo();
        }));
        d.BotaoRodape("Cancelar", false, d.Close);
        d.ShowDialog(this);
    }

    void EditarGrupoDesign(bool editar)
    {
        var sel = editar ? _gGrupos.ChaveAtual as JsonObject : null;
        if (editar && sel == null) { Msg.Aviso(this, "Selecione o grupo."); return; }
        var ev = _gEventos.ChaveAtual as JsonObject ?? _events.FirstOrDefault();
        if (ev == null) { Msg.Aviso(this, "Cadastre ou selecione um evento primeiro."); return; }
        using var d = NovoDialogo(editar ? "Editar grupo" : "Novo grupo", $"Passo 2 · {ev.S("name")}", "M4 6h16v5H4zM4 13h16v5H4z", "linear-gradient(180deg, #8C89FF, #4B47D6)");
        var nome = Txt(sel?.S("name") ?? "BATERIA 17:00");
        var cat = new ListaDesign(); cat.Items.Add(new Campos.Item(0, "(sem categoria)"));
        var cats = Crono.Arr(_catalog, "categories"); for (var i = 0; i < cats.Count; i++) cat.Items.Add(new Campos.Item(i + 1, cats[i].S("name"), cats[i]));
        cat.SelectedIndex = Math.Max(0, cats.FindIndex(c => c.S("id") == sel?.S("categoryId")) + 1);
        var g = d.Secao("Grupo");
        d.Campo(g, "Nome", nome, 4); d.Campo(g, "Categoria", cat, 2);
        d.BotaoRodape("Salvar", true, () => Seguro.Rodar(d, async () =>
        {
            var body = new JsonObject { ["name"] = nome.Text.Trim(), ["eventId"] = sel?.S("eventId") ?? ev.S("id"), ["categoryId"] = (cat.SelectedItem as Campos.Item)?.Dados?.S("id") };
            if (sel != null) await Crono.Api.Patch($"/api/catalog/groups/{sel.S("id")}", body); else await Crono.Api.Post("/api/catalog/groups", body);
            d.DialogResult = DialogResult.OK; d.Close(); await CarregarCatalogo();
        }));
        d.BotaoRodape("Cancelar", false, d.Close);
        d.ShowDialog(this);
    }

    /// <summary>Registro de prova (Prova.dc.html).</summary>
    void EditarProvaDesign(bool editar)
    {
        var sel = editar ? _gProvas.ChaveAtual as JsonObject : null;
        if (editar && sel == null) { Msg.Aviso(this, "Selecione a prova."); return; }
        var grupo = _groups.FirstOrDefault(x => x.S("id") == sel?.S("groupId")) ?? _gGrupos.ChaveAtual as JsonObject;
        if (grupo == null) { Msg.Aviso(this, "Cadastre ou selecione um grupo primeiro."); return; }
        var ev = _events.FirstOrDefault(e => e.S("id") == grupo.S("eventId"));
        using var d = NovoDialogo("Registro de prova", "Cada prova do grupo: tomada de tempo, corrida…", "M5 21V4M5 4h12l-2 4 2 4H5", "linear-gradient(180deg, #FF7A6B, #E0342A)");
        var hora = PecasDesign.Hora(DateTime.Today.Add(TimeSpan.TryParse(sel?.S("startAt"), out var hs) ? hs : TimeSpan.FromHours(17))); if (sel?.S("startAt") is not { Length: > 0 }) hora.Text = "";
        var nome = Txt(sel?.S("name") ?? "CORRIDA");
        var tipo = new ListaDesign(); tipo.Items.AddRange(["Treino livre", "Tomada de tempo", "Corrida"]);
        tipo.SelectedIndex = (sel?.S("type") ?? "corrida") switch { "treino" => 0, "classificacao" => 1, _ => 2 };
        var tracado = new ListaDesign(); tracado.Items.Add(new Campos.Item(0, "(do evento)"));
        var trks = Crono.Arr(_catalog, "tracks"); for (var i = 0; i < trks.Count; i++) tracado.Items.Add(new Campos.Item(i + 1, trks[i].S("name"), trks[i]));
        tracado.SelectedIndex = Math.Max(0, trks.FindIndex(t => t.S("id") == sel?.S("trackId")) + 1);
        var minimo = Txt(sel?.L("minLapSec") is long ml ? TimeSpan.FromSeconds(ml).ToString(@"mm\:ss") : "00:40", 5);
        var fim = new ListaDesign(); fim.Items.AddRange(["Por tempo", "Por voltas"]);
        fim.SelectedIndex = (sel?.I("durationMin") ?? 20) > 0 ? 0 : 1;
        var tempo = Txt(TimeSpan.FromMinutes(sel?.I("durationMin") is int dm && dm > 0 ? dm : 20).ToString(@"hh\:mm"), 5);
        var voltas = PecasDesign.Numero(sel?.I("maxLaps") ?? 0, 3); if ((sel?.I("maxLaps") ?? 0) == 0) voltas.Text = "";
        var g = d.Secao("Prova");
        d.Campo(g, "Data/hora (previsão)", hora, 2); d.Campo(g, "Nome", nome, 2); d.Campo(g, "Tipo", tipo, 2);
        d.Campo(g, "Traçado", tracado, 3); d.Campo(g, "Tempo mínimo por volta (mm:ss)", minimo, 3);
        var a = d.Secao("Autofinalizar", "Por tempo: ao acabar o tempo a cronometragem avisa (ESGOTADO); a quadriculada e o encerramento são sempre do cronometrista. Por voltas: a quadriculada sai quando o líder completa as voltas.");
        d.Campo(a, "Tipo de finalização", fim, 2); d.Campo(a, "Finalizar por tempo (hh:mm)", tempo, 2); d.Campo(a, "Finalizar por nº de voltas", voltas, 2);
        d.Nota("Treino livre: sem classificação · Treino classificatório (tomada de tempo): classifica pela melhor volta · Corrida: classifica por voltas e tempo total.");
        d.Subtitulo.Text = $"{ev?.S("name")} · {grupo.S("name")}";
        d.BotaoRodape("Salvar e fechar", true, () => Seguro.Rodar(d, async () =>
        {
            if (nome.Text.Trim().Length == 0) { Msg.Aviso(d, "Informe o nome da prova."); return; }
            if (!TimeSpan.TryParseExact(tempo.Text.Trim(), [@"hh\:mm", @"h\:mm"], null, out var dur) && fim.SelectedIndex == 0) { Msg.Aviso(d, "Tempo inválido (use hh:mm)."); return; }
            if (!TimeSpan.TryParseExact(minimo.Text.Trim(), [@"mm\:ss", @"m\:ss"], null, out var min)) { Msg.Aviso(d, "Tempo mínimo inválido (use mm:ss)."); return; }
            var body = new JsonObject
            {
                ["name"] = nome.Text.Trim(), ["groupId"] = grupo.S("id"), ["type"] = tipo.SelectedIndex switch { 0 => "treino", 1 => "classificacao", _ => "corrida" },
                ["durationMin"] = fim.SelectedIndex == 0 ? (int)dur.TotalMinutes : 0, ["maxLaps"] = int.TryParse(voltas.Text, out var v) ? v : 0,
                ["startAt"] = hora.Text.Trim(), ["trackId"] = (tracado.SelectedItem as Campos.Item)?.Dados?.S("id"), ["minLapSec"] = (int)min.TotalSeconds,
            };
            if (fim.SelectedIndex == 1 && body.I("maxLaps") <= 0) { Msg.Aviso(d, "Informe o número de voltas."); return; }
            if (sel != null) await Crono.Api.Patch($"/api/catalog/provas/{sel.S("id")}", body); else await Crono.Api.Post("/api/catalog/provas", body);
            d.DialogResult = DialogResult.OK; d.Close(); await CarregarCatalogo();
        }));
        d.BotaoRodape("Cancelar", false, d.Close);
        d.ShowDialog(this);
    }

    void DistribuirProvaDesign()
    {
        if (_gProvas.ChaveAtual is not JsonObject proof) { Msg.Aviso(this, "Selecione uma prova para distribuir."); return; }
        using var d = NovoDialogo("Distribuir prova", proof.S("name"), "M4 6h7M4 12h10M4 18h16", "linear-gradient(180deg, #FFB547, #F07A00)");
        var heats = PecasDesign.Numero(Math.Max(1, proof.I("heats")), 2); var ini = Txt(proof.S("startAt"), 5); var inter = PecasDesign.Numero(proof.I("intervalMin"), 3);
        var g = d.Secao("Baterias");
        d.Campo(g, "Número de baterias", heats, 2); d.Campo(g, "Horário inicial (hh:mm)", ini, 2); d.Campo(g, "Intervalo entre baterias (min)", inter, 2);
        d.Nota("Distribuir leva os competidores da tomada de tempo para a corrida, no grid pela ordem de tempo.");
        d.BotaoRodape("Distribuir", true, () => Seguro.Rodar(d, async () =>
        {
            await Crono.Api.Post($"/api/catalog/provas/{proof.S("id")}/distribute", new JsonObject { ["heats"] = int.TryParse(heats.Text, out var h) ? h : 1, ["startAt"] = ini.Text.Trim(), ["intervalMin"] = int.TryParse(inter.Text, out var i) ? i : 0 });
            d.DialogResult = DialogResult.OK; d.Close(); await CarregarCatalogo();
        }));
        d.BotaoRodape("Cancelar", false, d.Close);
        d.ShowDialog(this);
    }

    /// <summary>Incluir passagem manualmente (IncluirPassagem.dc.html).</summary>
    void IncluirPassagemDesign()
    {
        if (_sess == null) { Msg.Aviso(this, "Selecione uma bateria primeiro."); return; }
        using var d = NovoDialogo("Incluir passagem manualmente", "Para quando o decoder não leu o kart (Insert)", "M12 5v14M5 12h14", "linear-gradient(180deg, #5EDB7A, #1E9E4A)");
        var atribuir = new RadioButton { Text = "Atribuir a um competidor", Checked = true };
        var avulsa = new RadioButton { Text = "Passagem avulsa (sem competidor)" };
        var comp = new ListaDesign();
        foreach (var c in Crono.Arr(_sess, "competitors").OrderBy(c => int.TryParse(c.S("kart"), out var k) ? k : 999)) comp.Items.Add(new Campos.Item(0, $"{c.S("kart").PadLeft(2, '0')} · {c.S("name")}", c));
        var selKart = (_gRes.ChaveAtual as JsonObject)?.S("kart") ?? (_gPass.ChaveAtual as JsonObject)?.S("kart");
        comp.SelectedIndex = Math.Max(0, comp.Items.Cast<Campos.Item>().ToList().FindIndex(i => i.Dados.S("kart") == selKart));
        var transp = Leitura(""); var hora = Leitura(DateTime.Now.ToString("HH:mm:ss.fff")); var volta = Leitura(""); var tempo = Txt("", 10); var motivo = Txt("", 200);
        void Preencher()
        {
            var c = (comp.SelectedItem as Campos.Item)?.Dados;
            var kart = c?.S("kart") ?? "";
            transp.Text = AtualizarTransp(kart);
            var st = Crono.Arr(_sess, "standings").FirstOrDefault(s => s.S("kart") == kart);
            volta.Text = st == null ? "1" : (st.I("laps") + 1).ToString();
            if (tempo.Text.Length == 0 && st?.L("lastLapMs") is long ul) tempo.Text = (ul / 1000.0).ToString("0.000", System.Globalization.CultureInfo.InvariantCulture);
        }
        comp.SelectedIndexChanged += (_, _) => { tempo.Text = ""; Preencher(); };
        avulsa.CheckedChanged += (_, _) => comp.Enabled = !avulsa.Checked;
        var g = d.Secao("Passagem");
        d.Opcao(g, atribuir, 3); d.Opcao(g, avulsa, 3);
        d.Campo(g, "Competidor", comp, 3); d.Campo(g, "Transponder", transp, 3);
        d.Campo(g, "Hora da passagem", hora, 2); d.Campo(g, "Volta (calculada)", volta, 2); d.Campo(g, "Tempo da volta (s)", tempo, 2);
        d.Campo(g, "Motivo", motivo, 6);
        d.Nota("A volta, as posições e o placar são recalculados na hora. Fica registrado quem incluiu, e dá para desfazer em \"Excluir passagem manualmente\".");
        Preencher();
        d.BotaoRodape("Incluir passagem", true, () => Seguro.Rodar(d, async () =>
        {
            if (!TentarSegundos(tempo.Text, out var s)) { Msg.Aviso(d, "Informe o tempo da volta em segundos (ex.: 57.402)."); tempo.Focus(); return; }
            var c = avulsa.Checked ? null : (comp.SelectedItem as Campos.Item)?.Dados;
            if (!avulsa.Checked && c == null) { Msg.Aviso(d, "Escolha o competidor."); return; }
            await Crono.Api.Post($"/api/sessions/{_sess.S("id")}/passings/manual", new JsonObject { ["kart"] = c?.S("kart") ?? "", ["name"] = c?.S("name") ?? "", ["lapMs"] = (long)(s * 1000) });
            var texto = $"Passagem manual · kart {c?.S("kart") ?? "(avulsa)"} · {tempo.Text.Trim()} s" + (motivo.Text.Trim().Length > 0 ? " · " + motivo.Text.Trim() : "");
            await Crono.Api.Post($"/api/sessions/{_sess.S("id")}/observations", new JsonObject { ["text"] = texto, ["author"] = Environment.UserName });
            d.DialogResult = DialogResult.OK; d.Close(); await Atualizar();
        }));
        d.BotaoRodape("Cancelar", false, d.Close);
        d.ShowDialog(this);
    }

    string AtualizarTransp(string kart) => _transpPorKart.GetValueOrDefault(kart, "—");

    /// <summary>Mudar corrida em andamento (MudarCorrida.dc.html): mostra a prova de agora e ajusta nome, tempo e voltas.</summary>
    void MudarCorridaDesign()
    {
        if (_sess == null) { Msg.Aviso(this, "Selecione uma bateria."); return; }
        using var d = NovoDialogo("Mudar corrida em andamento", "Ajusta a prova que está sendo cronometrada", "M4 8h13l-3-3M20 16H7l3 3", "linear-gradient(180deg, #FFB547, #F07A00)");
        var ev = _events.FirstOrDefault(e => e.S("id") == _sess.S("eventId"));
        var inicio = _sess.L("startedAt") is long st ? DateTimeOffset.FromUnixTimeMilliseconds(st).LocalDateTime : (DateTime?)null;
        var agora = d.Secao("Agora", $"{ev?.S("name") ?? "Bateria avulsa"} · {_sess.S("name")} — {Crono.Estado(_sess.S("state")).ToLowerInvariant()}{(inicio is DateTime i ? $" há {(int)(DateTime.Now - i).TotalMinutes} min" : "")}, {_laps.Count(p => !p.B("deleted"))} passagens.");
        var secAgora = (TableLayoutPanel)agora.Parent; secAgora.BackColor = Color.FromArgb(255, 245, 230); foreach (Control c in secAgora.Controls) c.BackColor = secAgora.BackColor;
        var nome = Txt(_sess.S("name"));
        var dur = PecasDesign.Numero((int)((_sess.L("durationMs") ?? 0) / 60000), 3);
        var voltas = PecasDesign.Numero(_sess.I("maxLaps"), 3); if (_sess.I("maxLaps") == 0) voltas.Text = "";
        var g = d.Secao("Mudar para");
        d.Campo(g, "Nome da prova", nome, 3); d.Campo(g, "Tempo (min)", dur, 1); d.Campo(g, "Voltas (máx)", voltas, 2);
        d.Nota("As passagens já registradas continuam na prova. Para cronometrar outra bateria, escolha-a no seletor da barra (ao lado das bandeiras).");
        d.BotaoRodape("Mudar corrida", true, () => Seguro.Rodar(d, async () =>
        {
            await Crono.Api.Patch($"/api/sessions/{_sess.S("id")}", new JsonObject { ["name"] = nome.Text.Trim(), ["durationMin"] = int.TryParse(dur.Text, out var x) ? x : 20, ["maxLaps"] = int.TryParse(voltas.Text, out var l) ? l : 0 });
            d.DialogResult = DialogResult.OK; d.Close(); await Atualizar();
        }));
        d.BotaoRodape("Cancelar", false, d.Close);
        d.ShowDialog(this);
    }

    /// <summary>Empresa, Parâmetros, Backup, Configurações iniciais e Banner (guardados nas configurações do serviço).</summary>
    async Task DialogoConfiguracao(string nome)
    {
        var settings = (await Crono.Api.Get("/api/settings"))?.AsObject() ?? new JsonObject();
        JsonObject Sec(string k) => settings[k]?.DeepClone() as JsonObject ?? new JsonObject();
        switch (nome)
        {
            case "Empresa":
            {
                var e = Sec("company");
                using var d = NovoDialogo("Registro de empresa", "Aparece no cabeçalho dos resultados, termos e site", "M4 21V5l8-2v18M12 7l8 2v12M8 9h.01M8 13h.01M8 17h.01M16 13h.01M16 17h.01", "linear-gradient(180deg, #5EDB7A, #1E9E4A)");
                var t = new Dictionary<string, TextBox>();
                TextBox C(string k, string padrao = "") { var x = Txt(e.S(k) is { Length: > 0 } v ? v : padrao); t[k] = x; return x; }
                var g = d.Secao("Empresa");
                d.Campo(g, "Nome", C("name", "KARTODROMO INTERNACIONAL DE BETIM"), 3); d.Campo(g, "CNPJ", C("cnpj"), 1); d.Campo(g, "Telefone", C("phone"), 1); d.Campo(g, "E-mail", C("email"), 1);
                var en = d.Secao("Endereço");
                d.Campo(en, "Endereço", C("address"), 3); d.Campo(en, "Cidade", C("city", "Betim"), 2); d.Campo(en, "Estado", C("state", "MG"), 1);
                d.BotaoRodape("Salvar", true, () => Seguro.Rodar(d, async () =>
                {
                    var c = new JsonObject(); foreach (var (k, x) in t) c[k] = x.Text.Trim();
                    await Crono.Api.Patch("/api/settings", new JsonObject { ["company"] = c });
                    d.DialogResult = DialogResult.OK; d.Close();
                }));
                d.BotaoRodape("Cancelar", false, d.Close);
                d.ShowDialog(this);
                break;
            }
            case "ParamCrono":
            {
                var tm = Sec("timing");
                using var d = NovoDialogo("Parâmetros da cronometragem", "Equipamentos padrão e regras de contagem", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1", "linear-gradient(180deg, #9A9AA0, #4A4A4F)");
                var dec = Leitura(NomeDecoder()); var novoDec = DialogoDesign.AcaoCampo("Configurar"); novoDec.Click += (_, _) => { d.Close(); CadastroDesign("CadDecoder"); };
                var placar = Leitura(_painel.Ativo ? $"Placar de LED · {_painel.Porta}" : "Placar de LED · desligado"); var novoPl = DialogoDesign.AcaoCampo("Configurar"); novoPl.Click += (_, _) => { d.Close(); CadastroDesign("PlacarConfig"); };
                var g = d.Secao("Equipamentos");
                d.Campo(g, "Decoder padrão", dec, 3, novoDec); d.Campo(g, "Placar padrão", placar, 3, novoPl);
                var minimo = Txt(tm.S("minimumLapSeconds") is { Length: > 0 } m ? m : "5", 6);
                var duracao = PecasDesign.Numero(tm.I("defaultDurationMin") > 0 ? tm.I("defaultDurationMin") : 20, 3);
                var completa = PecasDesign.Numero(tm.I("completePercent") > 0 ? tm.I("completePercent") : 75, 3);
                var auto = new CheckBox { Text = "Criar competidor automaticamente (transponder de kart que não está na lista vira competidor)", Checked = true, Enabled = false };
                var reinicia = new CheckBox { Text = "Reiniciar o cronômetro na primeira passagem (bandeira verde espera o 1º kart cruzar a linha)", Checked = true, Enabled = false };
                var r = d.Secao("Regras");
                d.Campo(r, "Volta mínima (s)", minimo, 2); d.Campo(r, "Duração padrão (min)", duracao, 2); d.Campo(r, "% para considerar a prova completa", completa, 2);
                d.Marca(r, auto, 6, false); d.Marca(r, reinicia, 6, false);
                d.BotaoRodape("Salvar", true, () => Seguro.Rodar(d, async () =>
                {
                    if (!double.TryParse(minimo.Text.Replace(',', '.'), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var mn) || mn is < 0.1 or > 60) { Msg.Aviso(d, "A volta mínima deve ficar entre 0,1 e 60 segundos."); return; }
                    tm["minimumLapSeconds"] = mn; tm["defaultDurationMin"] = int.TryParse(duracao.Text, out var du) && du > 0 ? du : 20; tm["completePercent"] = int.TryParse(completa.Text, out var cp) ? Math.Clamp(cp, 1, 100) : 75;
                    await Crono.Api.Patch("/api/settings", new JsonObject { ["timing"] = tm });
                    d.DialogResult = DialogResult.OK; d.Close();
                }));
                d.BotaoRodape("Cancelar", false, d.Close);
                d.ShowDialog(this);
                break;
            }
            case "ParamSistema":
            {
                var sy = Sec("system"); var tm = Sec("timing");
                using var d = NovoDialogo("Parâmetros do sistema", "Ajustes gerais · toque no valor para alterar", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1", "linear-gradient(180deg, #9A9AA0, #4A4A4F)");
                var linhas = new List<(string sec, string chave, string desc, string valor)>
                {
                    ("system", "trackName", "Nome da pista (sai nos resultados)", sy.S("trackName") is { Length: > 0 } tn ? tn : "Kartódromo Internacional de Betim"),
                    ("system", "defaultTrackLengthMeters", "Extensão padrão do traçado (m)", sy.S("defaultTrackLengthMeters") is { Length: > 0 } dl ? dl : "1000"),
                    ("timing", "minimumLapSeconds", "Volta mínima (s)", tm.S("minimumLapSeconds") is { Length: > 0 } mn ? mn : "5"),
                    ("timing", "defaultDurationMin", "Duração padrão das provas (min)", tm.S("defaultDurationMin") is { Length: > 0 } du ? du : "20"),
                };
                var g = d.Secao(null);
                var tab = new TabelaDesign { Dock = DockStyle.Fill, Height = 100, Margin = new Padding(0, 0, 14, 0), MaxLinhas = 10 };
                tab.Colunas(new("Descrição", 700), new("Valor", 200, Direita: true, Editavel: true));
                tab.Linhas(linhas.Select(l => new[] { l.desc, l.valor }));
                g.Controls.Add(tab); g.SetColumnSpan(tab, 6);
                var nota = new Label { AutoSize = true, MaximumSize = new Size(860, 0), Font = new Font("Segoe UI", 9.6F), ForeColor = Color.FromArgb(58, 58, 60), BackColor = Color.White, Visible = false };
                g.Controls.Add(nota); g.SetColumnSpan(nota, 6);
                d.Abas(["Cronometragem", "Office", "Autoatendimento", "Ranking/TV", "Lista de participantes", "Placar eletrônico", "API"], i =>
                {
                    tab.Visible = i == 0; nota.Visible = i != 0;
                    nota.Text = i switch { 1 or 2 or 4 => "Estes ajustes ficam no programa da Recepção (Ferramentas › Parâmetros do sistema).", 3 => "O telão usa os resultados da cronometragem ao vivo; não há ajuste aqui.", 5 => "O placar de LED é configurado em Cadastros › Placar.", _ => "A API do serviço não tem ajustes pela tela." };
                });
                d.BotaoRodape("Salvar", true, () => Seguro.Rodar(d, async () =>
                {
                    for (var i = 0; i < linhas.Count; i++)
                    {
                        var v = tab.Dados[i][1].Trim(); var alvo = linhas[i].sec == "system" ? sy : tm;
                        if (linhas[i].chave == "trackName") alvo[linhas[i].chave] = v;
                        else if (double.TryParse(v.Replace(',', '.'), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var n) && n > 0) alvo[linhas[i].chave] = n;
                        else { Msg.Aviso(d, $"Valor inválido em \"{linhas[i].desc}\"."); return; }
                    }
                    await Crono.Api.Patch("/api/settings", new JsonObject { ["system"] = sy, ["timing"] = tm });
                    d.DialogResult = DialogResult.OK; d.Close();
                }));
                d.BotaoRodape("Cancelar", false, d.Close);
                d.ShowDialog(this);
                break;
            }
            case "Backup":
            {
                using var d = NovoDialogo("Backup de eventos", "Guarda os eventos e resultados num arquivo", "M4 17v3h16v-3M12 3v12M7 10l5 5 5-5", "linear-gradient(180deg, #9A9AA0, #4A4A4F)");
                var ev = _gEventos.ChaveAtual as JsonObject ?? _events.FirstOrDefault();
                var atual = new RadioButton { Text = $"Guardar o evento atual ({ev?.S("name") ?? "nenhum"})", Checked = true };
                var porData = new RadioButton { Text = "Guardar por data" };
                var de = new DataDesign(new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1)); var ate = new DataDesign(DateTime.Today);
                var pasta = Txt(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments) + "\\Backups Cronometragem", 300);
                var escolher = DialogoDesign.AcaoCampo("Escolher…");
                escolher.Click += (_, _) => { using var f = new FolderBrowserDialog { SelectedPath = pasta.Text }; if (f.ShowDialog(d) == DialogResult.OK) pasta.Text = f.SelectedPath; };
                var g = d.Secao("O que guardar");
                d.Opcao(g, atual, 3); d.Opcao(g, porData, 3); d.Campo(g, "De", de, 2); d.Campo(g, "Até", ate, 2);
                var p = d.Secao("Destino"); d.Campo(p, "Pasta", pasta, 6, escolher);
                d.Nota("Os dados também ficam no servidor do kartódromo; este backup é uma cópia extra para guardar num pendrive ou HD.");
                d.BotaoRodape("Fazer backup", true, () => Seguro.Rodar(d, async () =>
                {
                    Directory.CreateDirectory(pasta.Text);
                    var servidor = await Crono.Api.Post("/api/backup");
                    var cat = (await Crono.Api.Get("/api/catalog/export"))?.AsObject() ?? new JsonObject();
                    var sessoes = await Crono.Api.Lista("/api/sessions");
                    var ini = de.Valida ? de.Value : DateTime.MinValue; var fimD = ate.Valida ? ate.Value.AddDays(1) : DateTime.MaxValue;
                    var escolhidas = porData.Checked
                        ? sessoes.Where(s => s.L("createdAt") is long c && DateTimeOffset.FromUnixTimeMilliseconds(c).LocalDateTime is var dt && dt >= ini && dt < fimD).ToList()
                        : sessoes.Where(s => ev != null && s.S("eventId") == ev.S("id")).ToList();
                    var completas = new JsonArray();
                    foreach (var s in escolhidas) { var full = await Crono.Api.Get($"/api/sessions/{s.S("id")}"); var pass = await Crono.Api.Get($"/api/sessions/{s.S("id")}/passings"); completas.Add(new JsonObject { ["session"] = full?.DeepClone(), ["passings"] = pass?.DeepClone() }); }
                    var arq = Path.Combine(pasta.Text, $"cronometragem-{(porData.Checked ? $"{ini:yyyyMMdd}-{fimD.AddDays(-1):yyyyMMdd}" : string.Concat((ev?.S("name") ?? "evento").Where(char.IsLetterOrDigit)))}-{DateTime.Now:yyyyMMdd-HHmm}.json");
                    await File.WriteAllTextAsync(arq, new JsonObject { ["geradoEm"] = DateTime.Now.ToString("o"), ["catalogo"] = cat, ["baterias"] = completas }.ToJsonString(new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
                    Msg.Info(d, $"Backup salvo:\n{arq}\n\n{escolhidas.Count} bateria(s). Cópia também no servidor: {servidor?["path"]}");
                    d.DialogResult = DialogResult.OK; d.Close();
                }));
                d.BotaoRodape("Cancelar", false, d.Close);
                d.ShowDialog(this);
                break;
            }
            case "ConfigInicial":
            {
                using var d = NovoDialogo("Configurações do sistema", "Onde ficam os dados e os serviços · feito uma vez na instalação", "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3", "linear-gradient(180deg, #8C89FF, #4B47D6)");
                var srv = new Uri(Config.ServidorUrl); var cr = new Uri(Config.CronoUrl);
                var g = d.Secao("Base de dados (servidor da operação)");
                d.Campo(g, "Servidor", Leitura(srv.Host), 2); d.Campo(g, "Porta", Leitura(srv.Port.ToString()), 1); d.Campo(g, "Banco de dados", Leitura("KartodromoOps"), 3);
                var testar = DialogoDesign.AcaoCampo("Testar");
                var ipCrono = Leitura(cr.Host + ":" + cr.Port);
                testar.Click += (_, _) => Seguro.Rodar(d, async () => { var h = await Crono.Api.Get("/healthz"); Msg.Info(d, h?["ok"]?.GetValue<bool>() == true ? "Cronometragem respondendo. Decoder: " + ((h["decoder"] as JsonObject)?.B("healthy") == true ? "recebendo." : "sem dados.") : "Sem resposta."); });
                var c = d.Secao("Servidor de cronometragem");
                d.Campo(c, "IP / hostname", ipCrono, 4, testar); d.Marca(c, new CheckBox { Text = "Servidor local nesta máquina", Checked = cr.Host is "127.0.0.1" or "localhost" || cr.Host == Environment.MachineName, Enabled = false }, 2);
                var n = d.Secao("Nuvem e telão");
                d.Campo(n, "Servidor na nuvem (site)", Leitura("kartodromodebetim.com.br"), 3); d.Campo(n, "Servidor do placar / telão", Leitura(cr.Host), 3);
                d.Nota("Esses endereços vêm do arquivo appsettings.json da instalação (o instalador grava). Para trocar, reinstale com os endereços novos.");
                d.BotaoRodape("Fechar", true, d.Close);
                d.ShowDialog(this);
                break;
            }
            case "Banner":
            {
                var b = Sec("banner");
                using var d = NovoDialogo("Registro de banner", "Imagem que aparece no topo dos resultados impressos", "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15 9h.01", "linear-gradient(180deg, #C08BFF, #8645D6)");
                var arquivo = Leitura(b.S("fileName") is { Length: > 0 } fn ? fn : "(sem banner)");
                string base64 = null, nomeArq = b.S("fileName");
                var sel = DialogoDesign.AcaoCampo("Selecionar imagem");
                sel.Click += (_, _) =>
                {
                    using var o = new OpenFileDialog { Filter = "Imagem (*.png;*.jpg)|*.png;*.jpg;*.jpeg" };
                    if (o.ShowDialog(d) != DialogResult.OK) return;
                    var bytes = File.ReadAllBytes(o.FileName);
                    if (bytes.Length > 1_500_000) { Msg.Aviso(d, "Use uma imagem de até 1,5 MB."); return; }
                    base64 = Convert.ToBase64String(bytes); nomeArq = Path.GetFileName(o.FileName); arquivo.Text = nomeArq;
                };
                var g = d.Secao("Imagem");
                d.Campo(g, "Arquivo", arquivo, 4, sel); d.Campo(g, "Tamanho recomendado", Leitura("1920 × 400"), 2);
                var usar = new CheckBox { Text = "No topo dos resultados impressos", Checked = b["useOnReports"] is null || b.B("useOnReports") };
                var u = d.Secao("Uso"); d.Marca(u, usar, 6, false);
                d.Nota("O telão não muda: ele continua com o placar de sempre.");
                d.BotaoRodape("Gravar e fechar", true, () => Seguro.Rodar(d, async () =>
                {
                    b["useOnReports"] = usar.Checked; b["fileName"] = nomeArq; if (base64 != null) b["image"] = base64;
                    await Crono.Api.Patch("/api/settings", new JsonObject { ["banner"] = b });
                    d.DialogResult = DialogResult.OK; d.Close();
                }));
                d.BotaoRodape("Cancelar", false, d.Close);
                d.BotaoRodape("Excluir", false, () => Seguro.Rodar(d, async () => { await Crono.Api.Patch("/api/settings", new JsonObject { ["banner"] = new JsonObject() }); d.Close(); }));
                d.ShowDialog(this);
                break;
            }
        }
    }
}
