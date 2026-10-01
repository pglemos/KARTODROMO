using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

/// <summary>Aba Ranking dos karts: todo o histórico de tempo de cada kart (não do piloto) por dia, semana, mês
/// ou período personalizado; ao escolher um kart, as baterias em que ele andou.</summary>
public partial class FormCrono
{
    readonly LiveGrid _gRankKarts = new(), _gHistKart = new();
    readonly Label _subRanking = new(), _subHistorico = new(), _tituloHistorico = new() { Text = "Histórico do kart" };
    SegmentoDesign _segPeriodo;
    DataDesign _rankDe, _rankAte;
    ListaDesign _rankTracado, _rankTipo;
    bool _rankCarregando;

    TabPage AbaRankingKarts()
    {
        var page = new TabPage("Ranking dos karts") { BackColor = TemaCrono.Fundo, Padding = Padding.Empty };

        // filtros: período (segmento) + datas + traçado + tipo de prova
        _segPeriodo = new SegmentoDesign { BackColor = Color.White };
        _segPeriodo.Itens = ["Hoje", "Esta semana", "Este mês", "Personalizado"];
        _rankDe = new DataDesign(DateTime.Today) { Width = 118 };
        _rankAte = new DataDesign(DateTime.Today) { Width = 118 };
        _rankTracado = new ListaDesign { Width = 210, Font = new Font("Segoe UI", 9.4F) };
        _rankTipo = new ListaDesign { Width = 150, Font = new Font("Segoe UI", 9.4F) };
        foreach (var (t, v) in new[] { ("Todas as provas", ""), ("Tomada de tempo", "classificacao"), ("Corrida", "corrida"), ("Treino", "treino") }) _rankTipo.Items.Add(new Campos.Item(0, t, new JsonObject { ["v"] = v }));
        _rankTipo.SelectedIndex = 0;
        void Periodo(int i)
        {
            var hoje = DateTime.Today;
            if (i == 0) { _rankDe.Value = hoje; _rankAte.Value = hoje; }
            else if (i == 1) { var seg = hoje.AddDays(-(((int)hoje.DayOfWeek + 6) % 7)); _rankDe.Value = seg; _rankAte.Value = seg.AddDays(6); }
            else if (i == 2) { _rankDe.Value = new DateTime(hoje.Year, hoje.Month, 1); _rankAte.Value = new DateTime(hoje.Year, hoje.Month, DateTime.DaysInMonth(hoje.Year, hoje.Month)); }
            _rankDe.Enabled = _rankAte.Enabled = i == 3;
            if (i != 3 && _abas.SelectedIndex == 3) _ = CarregarRankingKarts();
        }
        _segPeriodo.Selecionado = 2;
        _rankDe.Value = new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1);
        _rankAte.Value = new DateTime(DateTime.Today.Year, DateTime.Today.Month, DateTime.DaysInMonth(DateTime.Today.Year, DateTime.Today.Month));
        _rankDe.Enabled = _rankAte.Enabled = false;
        _segPeriodo.Mudou += Periodo;

        Label Rot(string t) => new() { Text = t, AutoSize = true, Font = new Font("Segoe UI Semibold", 8.8F), ForeColor = TemaCrono.Secundario, Margin = new Padding(14, 9, 6, 0), BackColor = Color.White };
        Panel Caixa(Control c)
        {
            var p = new Panel { Size = new Size(c.Width + 16, 32), BackColor = Color.White, Margin = new Padding(0, 1, 0, 0), Padding = new Padding(8, 6, 6, 3) };
            p.Paint += (_, e) => { e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias; using var pp = Forma.Redondo(new Rectangle(0, 0, p.Width - 1, p.Height - 1), 8); using var pen = new Pen(Color.FromArgb(219, 219, 222)); e.Graphics.DrawPath(pen, pp); };
            c.Dock = DockStyle.Fill; p.Controls.Add(c);
            return p;
        }
        var filtros = new FlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = true, BackColor = Color.White, Padding = new Padding(16, 12, 16, 6) };
        _segPeriodo.Margin = new Padding(0, 1, 0, 0);
        filtros.Controls.AddRange([_segPeriodo, Rot("De"), Caixa(_rankDe), Rot("Até"), Caixa(_rankAte), Rot("Traçado"), Caixa(_rankTracado), Rot("Provas"), Caixa(_rankTipo)]);
        var atualizar = BotaoPeq("Atualizar", 1, () => _ = CarregarRankingKarts());
        atualizar.Margin = new Padding(14, 1, 0, 0);
        filtros.Controls.Add(atualizar);
        _rankTracado.SelectedIndexChanged += (_, _) => { if (!_rankCarregando) _ = CarregarRankingKarts(); };
        _rankTipo.SelectedIndexChanged += (_, _) => { if (!_rankCarregando) _ = CarregarRankingKarts(); };
        var cartaoFiltros = new TemaCrono.PainelArredondado { Dock = DockStyle.Top, Height = 58, BackColor = Color.White, Raio = 16, Margin = new Padding(0, 0, 0, 14) };
        cartaoFiltros.Controls.Add(filtros);

        // ranking
        TemaCrono.EstilizarGrade(_gRankKarts);
        _gRankKarts.Col("Pos", 48).Col("Kart", 58).Col("Melhor volta", 96, DataGridViewContentAlignment.MiddleRight).Col("Piloto da melhor", 150, DataGridViewContentAlignment.MiddleLeft, true)
            .Col("Dia", 82).Col("Média 10 melhores", 120, DataGridViewContentAlignment.MiddleRight).Col("Mediana", 82, DataGridViewContentAlignment.MiddleRight)
            .Col("Voltas", 64, DataGridViewContentAlignment.MiddleRight).Col("Baterias", 70, DataGridViewContentAlignment.MiddleRight).Col("Pilotos", 64, DataGridViewContentAlignment.MiddleRight).Col("Última vez", 86);
        foreach (var c in new[] { 2, 5, 6 }) _gRankKarts.Columns[c].DefaultCellStyle.Font = new Font("Cascadia Mono", 9F);
        _gRankKarts.Columns[1].DefaultCellStyle.Font = new Font("Cascadia Mono", 9.4F, FontStyle.Bold);
        _gRankKarts.SelectionChanged += (_, _) => { if (_gRankKarts.ChaveAtual is JsonObject k) _ = CarregarHistoricoKart(k.S("kart")); };
        _subRanking.Text = "Melhor volta de cada kart no período";
        var cartaoRank = CartaoPasso(-1, "Ranking dos karts", _subRanking, _gRankKarts,
            [BotaoPeq("Exportar (planilha)", 0, () => ExportarGrade(_gRankKarts, "ranking-karts")), BotaoPeq("Imprimir", 0, ImprimirRankingKarts)]);

        // histórico do kart escolhido
        TemaCrono.EstilizarGrade(_gHistKart);
        _gHistKart.Col("Dia", 82).Col("Hora", 56).Col("Bateria", 170, DataGridViewContentAlignment.MiddleLeft, true).Col("Prova", 104, DataGridViewContentAlignment.MiddleLeft)
            .Col("Piloto", 150, DataGridViewContentAlignment.MiddleLeft).Col("Voltas", 58, DataGridViewContentAlignment.MiddleRight)
            .Col("Melhor", 82, DataGridViewContentAlignment.MiddleRight).Col("Mediana", 82, DataGridViewContentAlignment.MiddleRight);
        foreach (var c in new[] { 6, 7 }) _gHistKart.Columns[c].DefaultCellStyle.Font = new Font("Cascadia Mono", 9F);
        _subHistorico.Text = "Escolha um kart no ranking";
        var cartaoHist = CartaoPasso(-1, null, _subHistorico, _gHistKart, [BotaoPeq("Exportar (planilha)", 0, () => ExportarGrade(_gHistKart, "historico-kart"))], tituloVivo: _tituloHistorico);

        var grade = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 3, Padding = new Padding(18, 16, 18, 16), BackColor = TemaCrono.Fundo };
        grade.RowStyles.Add(new RowStyle(SizeType.Absolute, 72)); grade.RowStyles.Add(new RowStyle(SizeType.Percent, 58)); grade.RowStyles.Add(new RowStyle(SizeType.Percent, 42));
        cartaoFiltros.Dock = DockStyle.Fill; cartaoRank.Margin = new Padding(0, 0, 0, 14); cartaoHist.Margin = Padding.Empty;
        grade.Controls.Add(cartaoFiltros, 0, 0); grade.Controls.Add(cartaoRank, 0, 1); grade.Controls.Add(cartaoHist, 0, 2);
        page.Controls.Add(grade);
        return page;
    }

    string FiltroRanking()
    {
        var q = new List<string>();
        if (_rankDe.Valida) q.Add("de=" + _rankDe.Value.ToString("yyyy-MM-dd"));
        if (_rankAte.Valida) q.Add("ate=" + _rankAte.Value.ToString("yyyy-MM-dd"));
        if ((_rankTracado.SelectedItem as Campos.Item)?.Dados?.S("id") is { Length: > 0 } t) q.Add("trackId=" + Uri.EscapeDataString(t));
        if ((_rankTipo.SelectedItem as Campos.Item)?.Dados?.S("v") is { Length: > 0 } tp) q.Add("tipos=" + tp);
        return string.Join("&", q);
    }

    string DescricaoPeriodo() => _rankDe.Valida && _rankAte.Valida
        ? (_rankDe.Value == _rankAte.Value ? _rankDe.Value.ToString("dd/MM/yyyy") : $"{_rankDe.Value:dd/MM/yyyy} a {_rankAte.Value:dd/MM/yyyy}")
        : "todo o período";

    static string DiaBr(string iso) => DateTime.TryParse(iso, out var d) ? d.ToString("dd/MM/yyyy") : iso;

    async Task CarregarRankingKarts()
    {
        if (_rankDe == null) return;
        if (_rankDe.Valida && _rankAte.Valida && _rankDe.Value > _rankAte.Value) { Msg.Aviso(this, "A data inicial é depois da final."); return; }
        try
        {
            // traçados do cadastro (carrega uma vez; mantém a escolha)
            _rankCarregando = true;
            var trilhas = Crono.Arr(_catalog, "tracks");
            if (_rankTracado.Items.Count != trilhas.Count + 1)
            {
                var antes = (_rankTracado.SelectedItem as Campos.Item)?.Dados?.S("id");
                _rankTracado.Items.Clear(); _rankTracado.Items.Add(new Campos.Item(0, "Todos os traçados"));
                foreach (var t in trilhas) _rankTracado.Items.Add(new Campos.Item(0, $"{t.S("name")} · {t.I("lengthMeters")} m", t));
                _rankTracado.SelectedIndex = Math.Max(0, trilhas.FindIndex(t => t.S("id") == antes) + 1);
            }
            _rankCarregando = false;
            var lista = await Crono.Api.Lista("/api/ranking-karts?" + FiltroRanking());
            var kartAntes = (_gRankKarts.ChaveAtual as JsonObject)?.S("kart");
            _gRankKarts.Preencher(lista.Select(r => new object[] {
                r.I("posicao"), r.S("kart").PadLeft(2, '0'), Crono.Volta(r.L("melhorMs")), r.S("melhorPiloto"), DiaBr(r.S("melhorData")),
                Crono.Volta(r.L("media10Ms")), Crono.Volta(r.L("medianaMs")), r.I("voltas"), r.I("baterias"), r.I("pilotos"), DiaBr(r.S("ultimaVez")) }).ToList(), lista.Cast<object>().ToList());
            _subRanking.Text = lista.Count == 0
                ? $"Nenhuma bateria finalizada em {DescricaoPeriodo()}"
                : $"{lista.Count} karts · {lista.Sum(r => r.I("voltas"))} voltas · {DescricaoPeriodo()} · ordenado pela melhor volta (voltas impossíveis, acima de 120 km/h de média, ficam de fora)";
            var i = lista.FindIndex(r => r.S("kart") == kartAntes);
            // mantém o kart escolhido; sem escolha, abre o histórico do 1º do ranking
            if (_gRankKarts.Rows.Count > 0)
            {
                var linha = i >= 0 && i < _gRankKarts.Rows.Count ? i : 0;
                _gRankKarts.CurrentCell = _gRankKarts.Rows[linha].Cells[0];
                _gRankKarts.Rows[linha].Selected = true;
            }
            if (lista.Count == 0) { _gHistKart.Preencher([]); _tituloHistorico.Text = "Histórico do kart"; _subHistorico.Text = "Escolha um kart no ranking"; }
            else if (_gRankKarts.ChaveAtual is JsonObject k) await CarregarHistoricoKart(k.S("kart"));
        }
        catch (Exception e) { _subRanking.Text = "Não foi possível carregar o ranking: " + e.Message; }
        finally { _rankCarregando = false; }
    }

    async Task CarregarHistoricoKart(string kart)
    {
        try
        {
            var lista = await Crono.Api.Lista($"/api/ranking-karts?kart={Uri.EscapeDataString(kart)}&{FiltroRanking()}");
            _tituloHistorico.Text = $"Histórico do kart {kart.PadLeft(2, '0')}";
            _subHistorico.Text = $"{lista.Count} bateria(s) em {DescricaoPeriodo()} · da mais recente para a mais antiga";
            _gHistKart.Preencher(lista.Select(h => new object[] { DiaBr(h.S("data")), h.S("hora"), h.S("bateria"), Crono.Tipo(h.S("tipo")), h.S("piloto"), h.I("voltas"), Crono.Volta(h.L("melhorMs")), Crono.Volta(h.L("medianaMs")) }).ToList(), lista.Cast<object>().ToList());
        }
        catch (Exception e) { _subHistorico.Text = "Não foi possível carregar o histórico: " + e.Message; }
    }

    void ExportarGrade(DataGridView grade, string nome)
    {
        if (grade.Rows.Count == 0) { Msg.Aviso(this, "Não há linhas para exportar."); return; }
        using var d = new SaveFileDialog { FileName = $"{nome}-{DateTime.Now:yyyyMMdd-HHmm}.csv", Filter = "Planilha (*.csv)|*.csv" };
        if (d.ShowDialog(this) != DialogResult.OK) return;
        // tempo "53.550" vira texto (="53.550"): o Excel em português leria como 53550
        static string Q(object v)
        {
            var s = v?.ToString() ?? "";
            if (System.Text.RegularExpressions.Regex.IsMatch(s, @"^(\d+:)?\d{1,2}\.\d{3}$")) return "\"=\"\"" + s + "\"\"\"";
            return "\"" + s.Replace("\"", "\"\"") + "\"";
        }
        var sb = new System.Text.StringBuilder();
        sb.AppendLine(string.Join(";", grade.Columns.Cast<DataGridViewColumn>().Select(c => Q(c.HeaderText))));
        foreach (DataGridViewRow r in grade.Rows) sb.AppendLine(string.Join(";", r.Cells.Cast<DataGridViewCell>().Select(c => Q(c.FormattedValue))));
        File.WriteAllText(d.FileName, sb.ToString(), new System.Text.UTF8Encoding(true));
        Msg.Info(this, $"Planilha salva em {Path.GetFileName(d.FileName)}.");
    }

    void ImprimirRankingKarts()
    {
        if (_gRankKarts.Rows.Count == 0) { Msg.Aviso(this, "Não há karts no período para imprimir."); return; }
        static string H(object v) => System.Net.WebUtility.HtmlEncode(v?.ToString() ?? "");
        var cab = string.Concat(_gRankKarts.Columns.Cast<DataGridViewColumn>().Select(c => $"<th>{H(c.HeaderText)}</th>"));
        var linhas = string.Concat(_gRankKarts.Rows.Cast<DataGridViewRow>().Select(r => "<tr>" + string.Concat(r.Cells.Cast<DataGridViewCell>().Select((c, i) => $"<td class=\"{(i is 2 or 5 or 6 ? "t" : i == 3 ? "n" : "")}\">{H(c.FormattedValue)}</td>")) + "</tr>"));
        var tracado = (_rankTracado.SelectedItem as Campos.Item)?.Texto ?? "Todos os traçados";
        var tipo = (_rankTipo.SelectedItem as Campos.Item)?.Texto ?? "Todas as provas";
        var html = "<!doctype html><meta charset=utf-8><title>Ranking dos karts</title><style>@page{size:A4;margin:12mm}body{font:12px 'Segoe UI',Arial;margin:0;color:#1d1d1f}h1{margin:0 0 2px;font-size:20px}.v{color:#555;margin-bottom:10px}table{border-collapse:collapse;width:100%}th,td{padding:5px 6px;border-bottom:1px solid #e5e5ea;text-align:right;white-space:nowrap}th{font-size:10px;color:#333;background:#f1f5f2;text-transform:uppercase;border-bottom:1.5px solid #000}td.n,th:nth-child(4){text-align:left;white-space:normal}.t{font-family:Consolas,monospace}</style>"
            + $"<h1>Ranking dos karts</h1><div class=v>Kartódromo Internacional de Betim · {H(DescricaoPeriodo())} · {H(tracado)} · {H(tipo)} · emitido em {DateTime.Now:dd/MM/yyyy HH:mm}</div><table><thead><tr>{cab}</tr></thead><tbody>{linhas}</tbody></table>";
        var arq = Path.Combine(Path.GetTempPath(), $"ranking-karts-{DateTime.Now:yyyyMMddHHmmss}.html");
        File.WriteAllText(arq, html, new System.Text.UTF8Encoding(false));
        Relatorio.Abrir(this, new Uri(arq).AbsoluteUri, "Ranking dos karts");
    }
}
