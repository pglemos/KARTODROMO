using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

/// <summary>Nova bateria (visual do canvas): avulsa ou a partir da agenda da recepção (puxa inscritos e as provas do produto).</summary>
public class FormNovaBateria : DialogoDesign
{
    public string CriadaId { get; private set; }
    readonly ComboBox _agenda = Campos.Combo();
    readonly TextBox _nome = PecasDesign.Texto("", 80);
    readonly ComboBox _tipo = Campos.Combo("Treino", "Tomada de tempo", "Corrida");
    readonly TextBox _durTxt = PecasDesign.Numero(10, 3), _voltasTxt = PecasDesign.Numero(0, 3), _minTxt = PecasDesign.Numero(5, 3); // volta mínima padrão do LapTime: 5 s
    readonly TextBox _karts = PecasDesign.Texto("", 400);
    readonly CheckBox _programa = new() { Text = "Montar as provas do produto (ex.: Tomada de tempo + Corrida)", Checked = true, AutoSize = true };
    readonly Label _info;
    List<JsonObject> _prog = [];
    int Dur { get => int.TryParse(_durTxt.Text, out var v) ? Math.Clamp(v, 0, 600) : 0; set => _durTxt.Text = value.ToString(); }
    int Voltas { get => int.TryParse(_voltasTxt.Text, out var v) ? Math.Clamp(v, 0, 999) : 0; set => _voltasTxt.Text = value.ToString(); }
    int Min { get => int.TryParse(_minTxt.Text, out var v) ? Math.Clamp(v, 1, 600) : 5; set => _minTxt.Text = value.ToString(); }

    public FormNovaBateria(List<JsonObject> agenda, JsonObject pre)
        : base("Nova bateria", "Os inscritos da recepção entram sozinhos como competidores", "M12 5v14M5 12h14", "linear-gradient(180deg, #34C759, #0B7A53)", 760, 560)
    {
        _agenda.Items.Add(new Campos.Item(0, "(bateria avulsa, sem agenda)"));
        foreach (var b in agenda) _agenda.Items.Add(new Campos.Item(b.L("id") ?? 0, $"{Fmt.Hm(b.S("inicio"))}  {b.S("nome")}  ({b.I("inscritos")} inscritos, {b.I("pagos")} pagos)", b));
        _agenda.SelectedIndex = 0;
        if (pre != null) Campos.Selecionar(_agenda, pre.L("id"));
        _tipo.SelectedIndex = 0;
        _karts.PlaceholderText = "Opcional · números separados por espaço";
        var g = Secao("Bateria");
        Campo(g, "Bateria da agenda (recepção)", _agenda, 6);
        Campo(g, "Nome", _nome, 6);
        Campo(g, "Tipo", _tipo, 2); Campo(g, "Duração (min)", _durTxt, 1); Campo(g, "Voltas (0 = por tempo)", _voltasTxt, 2); Campo(g, "Volta mínima (s)", _minTxt, 1);
        Campo(g, "Karts", _karts, 6);
        Marca(g, _programa, 6, false);
        // a nota do design (texto cinza no rodapé do conteúdo) mostra as provas do produto
        static IEnumerable<Control> Todos(Control r) { foreach (Control x in r.Controls) { yield return x; foreach (var y in Todos(x)) yield return y; } }
        _info = Todos(Nota(" ")).OfType<Label>().LastOrDefault() ?? new Label();
        BotaoRodape("Criar", true, async () => await Criar());
        BotaoRodape("Cancelar", false, Close);
        _tipo.SelectedIndexChanged += (_, _) => Dur = _tipo.SelectedIndex switch { 1 => 5, 2 => 20, _ => 10 };
        _agenda.SelectedIndexChanged += async (_, _) => await Escolheu();
        Load += async (_, _) => await Escolheu();
    }

    async Task Escolheu()
    {
        var id = Campos.IdDe(_agenda) ?? 0;
        _prog = [];
        _programa.Visible = false;
        if (id == 0) { _info.Text = "Bateria avulsa: informe os karts ou adicione os competidores depois (aba Baterias e Competidores)."; return; }
        var b = (_agenda.SelectedItem as Campos.Item)?.Dados;
        _nome.Text = b?.S("nome") ?? "";
        try { _prog = await Crono.Api.Lista($"/api/agenda/{id}/programa"); } catch { _prog = []; }
        _programa.Visible = _prog.Count > 1;
        _info.Text = _prog.Count > 0
            ? "Provas do produto: " + string.Join(" + ", _prog.Select(p => $"{p.S("nome")} ({(p.S("finalizacao") == "voltas" ? p.S("voltasMax") + " voltas" : p.S("tempoMin") + " min")})"))
            : "Os inscritos dessa bateria na recepção entram como competidores.";
        if (_prog.Count > 0)
        {
            var p = _prog[0];
            _tipo.SelectedIndex = p.S("tipo") switch { "classificacao" => 1, "corrida" => 2, _ => 0 };
            Dur = Math.Clamp(p.I("tempoMin"), 0, 600);
            Voltas = p.S("finalizacao") == "voltas" ? Math.Clamp(p.I("voltasMax"), 0, 999) : 0;
            if (p.L("voltaMinimaSeg") is long vm && vm > 0) Min = (int)Math.Clamp(vm, 1, 600);
        }
    }

    async Task Criar()
    {
        try
        {
            UseWaitCursor = true;
            var id = Campos.IdDe(_agenda) ?? 0;
            var karts = _karts.Text.Split([' ', ',', ';', '\t'], StringSplitOptions.RemoveEmptyEntries);
            var grade = id > 0 ? await Crono.Api.Lista($"/api/agenda/{id}/grid") : [];
            var comps = new JsonArray();
            for (var i = 0; i < grade.Count; i++)
            {
                var kart = grade[i].S("kart");
                if (kart.Length == 0 && i < karts.Length) kart = karts[i];
                comps.Add(new JsonObject { ["kart"] = kart, ["name"] = grade[i].S("nome"), ["customerId"] = grade[i].S("clienteId") });
            }
            foreach (var k in karts.Skip(grade.Count)) comps.Add(new JsonObject { ["kart"] = k, ["name"] = "" });
            var nome = _nome.Text.Trim().Length > 0 ? _nome.Text.Trim() : "Bateria " + DateTime.Now.ToString("HH:mm");
            string Tipo(string t) => t is "treino" or "classificacao" or "corrida" ? t : "corrida";
            // a mesma bateria da agenda já foi criada? (acontecia de criar duas vezes e ficar TOMADA/CORRIDA repetidas)
            if (id > 0)
            {
                var hoje = DateTimeOffset.Now.ToUnixTimeMilliseconds() - (long)DateTime.Now.TimeOfDay.TotalMilliseconds;
                var jaTem = (await Crono.Api.Lista("/api/sessions")).Where(x => x.S("state") != "cancelada" &&
                    (x.L("agendaId") == id || ((x.L("createdAt") ?? 0) >= hoje && (x.S("name") == nome || x.S("name").StartsWith(nome + " · "))))).ToList();
                if (jaTem.Count > 0)
                {
                    var lista = string.Join("\n", jaTem.OrderBy(x => x.L("createdAt")).Select(x => $"• {x.S("name")} ({Crono.Estado(x.S("state"))})"));
                    if (Msg.Pergunta(this, $"Essa bateria da agenda já foi criada:\n\n{lista}\n\nAbrir a que já existe?\n(Não = criar outra mesmo assim)"))
                    {
                        CriadaId = (jaTem.Where(x => x.S("state") is "preparando" or "em_andamento").OrderBy(x => x.L("createdAt")).FirstOrDefault() ?? jaTem[0]).S("id");
                        DialogResult = DialogResult.OK;
                        return;
                    }
                }
            }
            if (_programa.Visible && _programa.Checked && _prog.Count > 1)
            {
                // liga as provas da mesma bateria: o número do kart digitado numa vale para as outras
                var programaId = Guid.NewGuid().ToString("N");
                foreach (var p in _prog)
                {
                    var porVoltas = p.S("finalizacao") == "voltas";
                    var s = await Crono.Api.Post("/api/sessions", new JsonObject
                    {
                        ["type"] = Tipo(p.S("tipo")), ["name"] = $"{nome} · {p.S("nome")}", ["durationMin"] = porVoltas ? 0 : p.I("tempoMin"),
                        ["maxLaps"] = porVoltas && p.I("voltasMax") > 0 ? p.I("voltasMax") : null, ["minLapSec"] = Min, ["competitors"] = comps.DeepClone(),
                        ["programaId"] = programaId, ["agendaId"] = id > 0 ? id : null,
                    });
                    CriadaId ??= s.S("id");
                }
            }
            else
            {
                var tipo = _tipo.SelectedIndex switch { 1 => "classificacao", 2 => "corrida", _ => "treino" };
                var s = await Crono.Api.Post("/api/sessions", new JsonObject
                {
                    ["type"] = tipo, ["name"] = nome, ["durationMin"] = Dur, ["maxLaps"] = Voltas > 0 ? Voltas : null,
                    ["minLapSec"] = Min, ["competitors"] = comps, ["agendaId"] = id > 0 ? id : null,
                });
                CriadaId = s.S("id");
            }
            DialogResult = DialogResult.OK;
        }
        catch (ApiException e) { Msg.Erro(this, e.Message); }
        finally { UseWaitCursor = false; }
    }
}

/// <summary>Voltas de um kart, com invalidar/validar (corte de pista, passagem dupla...). Visual padrão (DialogoDesign + Grade):
/// volta inválida em vermelho e melhor volta em roxo, sempre com a Situação escrita (nunca só a cor).</summary>
public class FormVoltas : DialogoDesign
{
    const string IconeLista = "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01";
    const string CorIcone = "linear-gradient(180deg, #5EB6FF, #0A63D6)"; // design-lint-ignore: degradê do ícone (Forma.Tile lê CSS)
    readonly string _sessao, _kart;
    readonly Grade _lista;

    public FormVoltas(string sessao, string kart) : base("Voltas do kart " + kart, "Duplo clique (ou o botão) invalida ou valida a volta", IconeLista, CorIcone, 620, 640)
    {
        _sessao = sessao; _kart = kart;
        _lista = SecaoTabela(null, 420);
        _lista.Colunas(new Col("lap", "Volta", TipoCol.Inteiro, 70), new Col("tempo", "Tempo", Largura: 120), new Col("hora", "Hora", Largura: 130), new Col("situacao", "Situação"));
        _lista.CorLinha = r => r.B("invalid") ? Tokens.Claro.CorEstadoPerigoTexto : r.B("melhor") ? Tokens.Claro.CorDominioMelhorVolta : null;
        _lista.Duplo += async _ => await Alternar();
        BotaoRodape("Fechar", true, Close);
        BotaoRodape("Invalidar / validar volta", false, async () => await Alternar());
        Load += async (_, _) => await Carregar();
    }

    async Task Carregar()
    {
        try
        {
            var todos = await Crono.Api.Lista($"/api/sessions/{_sessao}/laps");
            var c = todos.FirstOrDefault(x => x.S("kart") == _kart);
            if (c?.S("name") is { Length: > 0 } n) Subtitulo.Text = n + " · duplo clique invalida ou valida a volta";
            var melhor = Crono.Arr(c, "laps").Where(l => !l.B("invalid")).Select(l => l.L("lapMs")).Min();
            _lista.Carregar(Crono.Arr(c, "laps").Select(l => new JsonObject
            {
                ["id"] = l.S("lap"), ["lap"] = l.L("lap"), ["tempo"] = Crono.Volta(l.L("lapMs")), ["hora"] = Crono.Hora(l.L("wallMs")),
                ["invalid"] = l.B("invalid"), ["melhor"] = !l.B("invalid") && l.L("lapMs") == melhor,
                ["situacao"] = l.B("invalid") ? "INVÁLIDA" : l.L("lapMs") == melhor ? "Melhor volta" : "",
            }));
        }
        catch (ApiException e) { Msg.Erro(this, e.Message); }
    }

    async Task Alternar()
    {
        if (_lista.Atual is not { } volta) { Msg.Aviso(this, "Selecione a volta."); return; }
        try
        {
            await Crono.Api.Post($"/api/sessions/{_sessao}/laps/invalidate", new JsonObject { ["kart"] = _kart, ["lap"] = (int)(volta.L("lap") ?? 0) });
            await Carregar();
        }
        catch (ApiException e) { Msg.Erro(this, e.Message); }
    }
}

/// <summary>Tabela transponder (número lido pelo decoder) → número do kart, no visual padrão. A grade é editável
/// (digita o kart na célula; linha nova no fim); transponder lido sem kart aparece em vermelho.</summary>
public class FormTransponders : DialogoDesign
{
    const string IconeSinal = "M4.9 19.1C1 15.2 1 8.8 4.9 4.9M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5M19.1 4.9C23 8.8 23 15.1 19.1 19M12 12h.01";
    const string CorIcone = "linear-gradient(180deg, #FF7A6B, #E0342A)"; // design-lint-ignore: degradê do ícone (Forma.Tile lê CSS)
    readonly DataGridView _g = new() { Dock = DockStyle.Fill, Height = 400, BackgroundColor = Tokens.Claro.CorSuperficiePadrao, BorderStyle = BorderStyle.None, AllowUserToAddRows = true, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo), Margin = Padding.Empty, GridColor = Tokens.Claro.CorSuperficieCampo, CellBorderStyle = DataGridViewCellBorderStyle.SingleHorizontal };
    readonly List<string> _desconhecidos;
    Dictionary<string, string> _original = [];

    public FormTransponders(List<string> desconhecidos, string titulo = "Transponders") : base(titulo, "Cada kart tem um transponder", IconeSinal, CorIcone, 640, 680)
    {
        _desconhecidos = desconhecidos;
        _g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Transponder", Width = 200 });
        _g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Nº do kart", AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill });
        _g.EnableHeadersVisualStyles = false;
        _g.ColumnHeadersDefaultCellStyle.BackColor = Tokens.Claro.CorSuperficieSuave;
        _g.ColumnHeadersDefaultCellStyle.Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno, FontStyle.Bold);
        _g.ColumnHeadersHeight = 32;
        _g.RowTemplate.Height = 28;
        _g.RowHeadersVisible = false;                                   // sem a coluna cinza de marcador do Windows
        _g.DefaultCellStyle.SelectionBackColor = Tokens.VerdeSelecao;   // seleção na cor do sistema (não o azul do Windows)
        _g.DefaultCellStyle.SelectionForeColor = Tokens.Claro.CorTextoPrincipal;
        var grade = Secao(null, "Para trocar, altere o número do kart; para liberar um transponder, apague o kart. Transponders lidos recentemente sem kart aparecem em vermelho no topo.");
        grade.Controls.Add(_g);
        grade.SetColumnSpan(_g, 6);
        BotaoRodape("Salvar", true, async () => await Salvar());
        BotaoRodape("Fechar", false, Close);
        Load += async (_, _) => await Carregar();
    }

    async Task Carregar()
    {
        try
        {
            var mapa = (await Crono.Api.Get("/api/transponders")) as JsonObject ?? [];
            _original = mapa.ToDictionary(kv => kv.Key, kv => kv.Value?.ToString() ?? "");
            _g.Rows.Clear();
            foreach (var d in _desconhecidos.Where(d => !_original.ContainsKey(d)))
            {
                var i = _g.Rows.Add(d, "");
                _g.Rows[i].DefaultCellStyle.BackColor = Tokens.Claro.CorEstadoPerigoFundo;
                _g.Rows[i].DefaultCellStyle.ForeColor = Tokens.Claro.CorEstadoPerigoTexto;
            }
            foreach (var kv in _original.OrderBy(kv => int.TryParse(kv.Value, out var n) ? n : int.MaxValue).ThenBy(kv => kv.Value)) _g.Rows.Add(kv.Key, kv.Value);
        }
        catch (ApiException e) { Msg.Erro(this, e.Message); }
    }

    async Task Salvar()
    {
        _g.EndEdit();
        try
        {
            var mudou = 0;
            foreach (DataGridViewRow r in _g.Rows)
            {
                if (r.IsNewRow) continue;
                var raw = r.Cells[0].Value?.ToString()?.Trim() ?? "";
                var kart = r.Cells[1].Value?.ToString()?.Trim() ?? "";
                if (raw.Length == 0) continue;
                _original.TryGetValue(raw, out var antes);
                if ((antes ?? "") == kart) continue;
                await Crono.Api.Put("/api/transponders", new JsonObject { ["raw"] = raw, ["kart"] = kart });
                mudou++;
            }
            await Carregar();
            Msg.Info(this, mudou == 0 ? "Nada mudou." : $"{mudou} transponder(s) atualizado(s).");
        }
        catch (ApiException e) { Msg.Erro(this, e.Message); }
    }
}
