using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

/// <summary>Nova bateria: avulsa ou a partir da agenda da recepcao (puxa inscritos e as provas do produto).</summary>
public class FormNovaBateria : Janela
{
    public string CriadaId { get; private set; }
    readonly ComboBox _agenda = Campos.Combo();
    readonly TextBox _nome = Campos.Texto(80);
    readonly ComboBox _tipo = Campos.Combo("Treino", "Tomada de tempo", "Corrida");
    readonly NumericUpDown _dur = Campos.Num(10, 0, 600), _voltas = Campos.Num(0, 0, 999), _min = Campos.Num(5, 1, 600); // padrão do LapTime: 5 s
    readonly TextBox _karts = Campos.Texto(400);
    readonly CheckBox _programa = Campos.Check("Montar as provas do produto (ex.: Tomada de tempo + Corrida)", true);
    readonly Label _info = new() { AutoSize = false, Height = 60, Dock = DockStyle.Top, ForeColor = Color.FromArgb(90, 90, 90), Padding = new Padding(3, 4, 3, 0) };
    List<JsonObject> _prog = [];

    public FormNovaBateria(List<JsonObject> agenda, JsonObject pre) : base("Nova Bateria", 620, 400)
    {
        _agenda.Items.Add(new Campos.Item(0, "(bateria avulsa, sem agenda)"));
        foreach (var b in agenda) _agenda.Items.Add(new Campos.Item(b.L("id") ?? 0, $"{Fmt.Hm(b.S("inicio"))}  {b.S("nome")}  ({b.I("inscritos")} inscritos, {b.I("pagos")} pagos)", b));
        _agenda.SelectedIndex = 0;
        if (pre != null) Campos.Selecionar(_agenda, pre.L("id"));
        _tipo.SelectedIndex = 0;
        _karts.PlaceholderText = "Números dos karts separados por espaço (opcional; os inscritos da agenda entram sozinhos)";
        var g = Campos.Grade(4, 40, 20, 20, 20);
        g.Padding = new Padding(8, 8, 8, 0);
        Campos.Add(g, "Bateria da agenda (recepção)", _agenda, 4);
        Campos.Add(g, "Nome", _nome, 4);
        Campos.Add(g, "Tipo", _tipo);
        Campos.Add(g, "Duração (min)", _dur);
        Campos.Add(g, "Voltas (0 = por tempo)", _voltas);
        Campos.Add(g, "Volta mínima (s)", _min);
        Campos.Add(g, "Karts", _karts, 4);
        Campos.Add(g, null, _programa, 4);
        var corpo = new Panel { Dock = DockStyle.Fill };
        corpo.Controls.Add(_info);
        corpo.Controls.Add(g);
        Controls.Add(corpo);
        Rodape(("Criar", async (_, _) => await Criar(), true), ("Cancelar", (_, _) => Close(), false));
        _tipo.SelectedIndexChanged += (_, _) => _dur.Value = _tipo.SelectedIndex switch { 1 => 5, 2 => 20, _ => 10 };
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
            _dur.Value = Math.Clamp(p.I("tempoMin"), 0, 600);
            _voltas.Value = p.S("finalizacao") == "voltas" ? Math.Clamp(p.I("voltasMax"), 0, 999) : 0;
            if (p.L("voltaMinimaSeg") is long vm && vm > 0) _min.Value = Math.Clamp(vm, 1, 600);
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
            if (_programa.Visible && _programa.Checked && _prog.Count > 1)
            {
                foreach (var p in _prog)
                {
                    var porVoltas = p.S("finalizacao") == "voltas";
                    var s = await Crono.Api.Post("/api/sessions", new JsonObject
                    {
                        ["type"] = Tipo(p.S("tipo")), ["name"] = $"{nome} · {p.S("nome")}", ["durationMin"] = porVoltas ? 0 : p.I("tempoMin"),
                        ["maxLaps"] = porVoltas && p.I("voltasMax") > 0 ? p.I("voltasMax") : null, ["minLapSec"] = (int)_min.Value, ["competitors"] = comps.DeepClone(),
                    });
                    CriadaId ??= s.S("id");
                }
            }
            else
            {
                var tipo = _tipo.SelectedIndex switch { 1 => "classificacao", 2 => "corrida", _ => "treino" };
                var s = await Crono.Api.Post("/api/sessions", new JsonObject
                {
                    ["type"] = tipo, ["name"] = nome, ["durationMin"] = (int)_dur.Value, ["maxLaps"] = _voltas.Value > 0 ? (int)_voltas.Value : null,
                    ["minLapSec"] = (int)_min.Value, ["competitors"] = comps,
                });
                CriadaId = s.S("id");
            }
            DialogResult = DialogResult.OK;
        }
        catch (ApiException e) { Msg.Erro(this, e.Message); }
        finally { UseWaitCursor = false; }
    }
}

/// <summary>Voltas de um kart, com invalidar/validar (corte de pista, passagem dupla...).</summary>
public class FormVoltas : Janela
{
    readonly string _sessao, _kart;
    readonly ListView _lista = new() { Dock = DockStyle.Fill, View = View.Details, FullRowSelect = true, GridLines = true, Font = new Font("Segoe UI", 10F) };

    public FormVoltas(string sessao, string kart) : base("Voltas do kart " + kart, 460, 520, true)
    {
        _sessao = sessao; _kart = kart;
        _lista.Columns.Add("Volta", 70, HorizontalAlignment.Center);
        _lista.Columns.Add("Tempo", 120, HorizontalAlignment.Center);
        _lista.Columns.Add("Hora", 130, HorizontalAlignment.Center);
        _lista.Columns.Add("Situação", 100, HorizontalAlignment.Center);
        Controls.Add(_lista);
        Rodape(("Invalidar / Validar volta", async (_, _) => await Alternar(), false), ("Fechar", (_, _) => Close(), true));
        _lista.DoubleClick += async (_, _) => await Alternar();
        Load += async (_, _) => await Carregar();
    }

    async Task Carregar()
    {
        try
        {
            var todos = await Crono.Api.Lista($"/api/sessions/{_sessao}/laps");
            var c = todos.FirstOrDefault(x => x.S("kart") == _kart);
            Text = $"Voltas do kart {_kart}" + (c?.S("name") is { Length: > 0 } n ? " · " + n : "");
            _lista.Items.Clear();
            var melhor = Crono.Arr(c, "laps").Where(l => !l.B("invalid")).Select(l => l.L("lapMs")).Min();
            foreach (var l in Crono.Arr(c, "laps"))
            {
                var it = new ListViewItem([l.S("lap"), Crono.Volta(l.L("lapMs")), Crono.Hora(l.L("wallMs")), l.B("invalid") ? "INVÁLIDA" : l.L("lapMs") == melhor ? "Melhor" : ""]) { Tag = l.I("lap") };
                if (l.B("invalid")) { it.BackColor = Color.FromArgb(230, 20, 20); it.ForeColor = Color.White; }
                else if (l.L("lapMs") == melhor) it.ForeColor = Color.FromArgb(128, 0, 160);
                _lista.Items.Add(it);
            }
        }
        catch (ApiException e) { Msg.Erro(this, e.Message); }
    }

    async Task Alternar()
    {
        if (_lista.SelectedItems.Count == 0) { Msg.Aviso(this, "Selecione a volta."); return; }
        try
        {
            await Crono.Api.Post($"/api/sessions/{_sessao}/laps/invalidate", new JsonObject { ["kart"] = _kart, ["lap"] = (int)_lista.SelectedItems[0].Tag });
            await Carregar();
        }
        catch (ApiException e) { Msg.Erro(this, e.Message); }
    }
}

/// <summary>Tabela transponder (numero lido pelo decoder) -> numero do kart.</summary>
public class FormTransponders : Janela
{
    readonly DataGridView _g = new() { Dock = DockStyle.Fill, BackgroundColor = Color.White, BorderStyle = BorderStyle.None, AllowUserToAddRows = true, RowHeadersWidth = 28, Font = new Font("Segoe UI", 10F) };
    readonly List<string> _desconhecidos;
    Dictionary<string, string> _original = [];

    public FormTransponders(List<string> desconhecidos, string titulo = "Transponders") : base(titulo, 520, 600, true)
    {
        _desconhecidos = desconhecidos;
        _g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Transponder", Width = 200 });
        _g.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Nº do kart", AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill });
        _g.EnableHeadersVisualStyles = false;
        _g.ColumnHeadersDefaultCellStyle.BackColor = Color.FromArgb(249, 249, 249);
        var dica = new Label
        {
            Dock = DockStyle.Top, Height = 46, Padding = new Padding(8, 6, 8, 0), ForeColor = Color.FromArgb(70, 70, 70),
            Text = "Cada kart tem um transponder. Para trocar, altere o número do kart; para liberar um transponder, apague o kart. Transponders lidos recentemente sem kart aparecem em vermelho.",
        };
        Controls.Add(_g);
        Controls.Add(dica);
        Rodape(("Salvar", async (_, _) => await Salvar(), true), ("Fechar", (_, _) => Close(), false));
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
                _g.Rows[i].DefaultCellStyle.BackColor = Color.FromArgb(255, 220, 220);
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
