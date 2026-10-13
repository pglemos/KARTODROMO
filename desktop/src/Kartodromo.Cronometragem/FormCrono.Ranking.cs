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
    ListaDesign _rankTracado, _rankTipo, _rankCategoria;
    bool _rankCarregando;

    TabPage AbaRankingKarts()
    {
        var page = new TabPage("Ranking dos karts") { BackColor = TemaCrono.Fundo, Padding = Padding.Empty };

        // filtros: período (segmento) + datas + traçado + tipo de prova
        _segPeriodo = new SegmentoDesign { BackColor = Tokens.Primitivo.Branco };
        _segPeriodo.Itens = ["Hoje", "Esta semana", "Este mês", "Personalizado"];
        _rankDe = new DataDesign(DateTime.Today) { Width = 118 };
        _rankAte = new DataDesign(DateTime.Today) { Width = 118 };
        _rankTracado = new ListaDesign { Width = 210, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo) };
        _rankTipo = new ListaDesign { Width = 150, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo) };
        _rankCategoria = new ListaDesign { Width = 148, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo) };
        foreach (var (t, v) in new[] { ("Todas as categorias", ""), ("Light", "Light"), ("Super Kart", "Super Kart") }) _rankCategoria.Items.Add(new Campos.Item(0, t, new JsonObject { ["v"] = v }));
        _rankCategoria.SelectedIndex = 0;
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

        Label Rot(string t) => new() { Text = t, AutoSize = true, Font = Tokens.FonteSemibold(Tokens.Claro.FonteTamanhoPequeno), ForeColor = TemaCrono.Secundario, Margin = new Padding(14, 9, 6, 0), BackColor = Tokens.Primitivo.Branco };
        Panel Caixa(Control c)
        {
            var p = new Panel { Size = new Size(c.Width + 16, 32), BackColor = Tokens.Primitivo.Branco, Margin = new Padding(0, 1, 0, 0), Padding = new Padding(8, 6, 6, 3) };
            p.Paint += (_, e) => { e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias; using var pp = Forma.Redondo(new Rectangle(0, 0, p.Width - 1, p.Height - 1), 8); using var pen = new Pen(Color.FromArgb(219, 219, 222)); e.Graphics.DrawPath(pen, pp); };
            c.Dock = DockStyle.Fill; p.Controls.Add(c);
            return p;
        }
        var filtros = new FlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = true, BackColor = Tokens.Primitivo.Branco, Padding = new Padding(16, 12, 16, 6) };
        _segPeriodo.Margin = new Padding(0, 1, 0, 6);
        // rótulo e campo andam juntos quando a linha quebra (o "Categoria" ficava numa linha e o campo na outra)
        Control Par(string rotulo, Control campo)
        {
            var p = new FlowLayoutPanel { AutoSize = true, WrapContents = false, BackColor = Tokens.Primitivo.Branco, Margin = new Padding(0, 0, 0, 6), Padding = Padding.Empty };
            p.Controls.Add(Rot(rotulo)); p.Controls.Add(Caixa(campo));
            return p;
        }
        filtros.Controls.AddRange([_segPeriodo, Par("De", _rankDe), Par("Até", _rankAte), Par("Traçado", _rankTracado), Par("Provas", _rankTipo), Par("Categoria", _rankCategoria)]);
        var atualizar = BotaoPeq("Atualizar", 1, () => _ = CarregarRankingKarts());
        atualizar.Margin = new Padding(14, 1, 0, 6);
        filtros.Controls.Add(atualizar);
        _rankTracado.SelectedIndexChanged += (_, _) => { if (!_rankCarregando) _ = CarregarRankingKarts(); };
        _rankTipo.SelectedIndexChanged += (_, _) => { if (!_rankCarregando) _ = CarregarRankingKarts(); };
        _rankCategoria.SelectedIndexChanged += (_, _) => { if (!_rankCarregando) _ = CarregarRankingKarts(); };
        var cartaoFiltros = new TemaCrono.PainelArredondado { Dock = DockStyle.Top, Height = 58, BackColor = Tokens.Primitivo.Branco, Raio = 16, Margin = new Padding(0, 0, 0, 14) };
        cartaoFiltros.Controls.Add(filtros);

        // ranking
        TemaCrono.EstilizarGrade(_gRankKarts);
        // cada cabeçalho filtra os valores exibidos sem alterar o período ou os dados do servidor
        _gRankKarts.Col("Pos", 48, filtro: true).Col("Kart", 58, filtro: true).Col("Piloto da melhor", 150, DataGridViewContentAlignment.MiddleLeft, true, filtro: true)
            .Col("Dia", 82, filtro: true).Col("Traçado", 170, DataGridViewContentAlignment.MiddleLeft, filtro: true).Col("Condição", 78, DataGridViewContentAlignment.MiddleLeft, filtro: true)
            .Col("Melhor volta", 96, DataGridViewContentAlignment.MiddleRight, filtro: true).Col("Média 10 melhores", 120, DataGridViewContentAlignment.MiddleRight, filtro: true).Col("Mediana", 82, DataGridViewContentAlignment.MiddleRight, filtro: true)
            .Col("Voltas", 64, DataGridViewContentAlignment.MiddleRight, filtro: true).Col("Baterias", 70, DataGridViewContentAlignment.MiddleRight, filtro: true).Col("Pilotos", 64, DataGridViewContentAlignment.MiddleRight, filtro: true).Col("Última vez", 86, filtro: true);
        foreach (var c in new[] { 6, 7, 8 }) _gRankKarts.Columns[c].DefaultCellStyle.Font = Tokens.FonteNumero(Tokens.Claro.FonteTamanhoPequeno);
        _gRankKarts.Columns[1].DefaultCellStyle.Font = Tokens.FonteNumero(Tokens.Claro.FonteTamanhoCorpo, FontStyle.Bold);
        _gRankKarts.SelectionChanged += (_, _) => { if (_gRankKarts.ChaveAtual is JsonObject k) _ = CarregarHistoricoKart(k.S("kart")); };
        // dois cliques no traçado: troca o traçado da bateria daquela volta (pedido 06/10 — bateria corrida no Invertido
        // aparecia como Normal); os tempos ficam, só passam a contar no traçado certo
        _gRankKarts.CellDoubleClick += (_, e) => { if (e.RowIndex >= 0 && e.ColumnIndex == 4) TrocarTracadoNoRanking(_gRankKarts.ChaveAtual as JsonObject, "melhorSessionId", "melhorBateria", "melhorTracado"); };
        _gRankKarts.Columns[4].ToolTipText = "Clique duas vezes para trocar o traçado desta bateria";
        _subRanking.Text = "Melhor volta de cada kart no período · Chuva = pista molhada";
        var cartaoRank = CartaoPasso(-1, "Ranking dos karts", _subRanking, _gRankKarts,
            [BotaoPeq("Exportar (planilha)", 0, () => ExportarGrade(_gRankKarts, "ranking-karts")), BotaoPeq("Imprimir", 0, ImprimirRankingKarts),
             BotaoPeq("Trocar traçado da bateria…", 0, () => TrocarTracadoNoRanking(_gRankKarts.ChaveAtual as JsonObject, "melhorSessionId", "melhorBateria", "melhorTracado"))]);

        // histórico do kart escolhido
        TemaCrono.EstilizarGrade(_gHistKart);
        _gHistKart.Col("Dia", 82, filtro: true).Col("Hora", 56, filtro: true).Col("Bateria", 170, DataGridViewContentAlignment.MiddleLeft, true, filtro: true).Col("Prova", 104, DataGridViewContentAlignment.MiddleLeft, filtro: true)
            .Col("Traçado", 170, DataGridViewContentAlignment.MiddleLeft, filtro: true).Col("Condição", 78, DataGridViewContentAlignment.MiddleLeft, filtro: true).Col("Piloto", 150, DataGridViewContentAlignment.MiddleLeft, filtro: true).Col("Voltas", 58, DataGridViewContentAlignment.MiddleRight, filtro: true)
            .Col("Melhor", 82, DataGridViewContentAlignment.MiddleRight, filtro: true).Col("Mediana", 82, DataGridViewContentAlignment.MiddleRight, filtro: true);
        foreach (var c in new[] { 8, 9 }) _gHistKart.Columns[c].DefaultCellStyle.Font = Tokens.FonteNumero(Tokens.Claro.FonteTamanhoPequeno);
        _subHistorico.Text = "Escolha um kart no ranking";
        _gHistKart.CellDoubleClick += (_, e) => { if (e.RowIndex >= 0 && e.ColumnIndex == 4) TrocarTracadoNoRanking(_gHistKart.ChaveAtual as JsonObject, "sessionId", "bateria", "tracado"); };
        _gHistKart.Columns[4].ToolTipText = "Clique duas vezes para trocar o traçado desta bateria";
        var cartaoHist = CartaoPasso(-1, null, _subHistorico, _gHistKart,
            [BotaoPeq("Exportar (planilha)", 0, () => ExportarGrade(_gHistKart, "historico-kart")),
             BotaoPeq("Trocar traçado da bateria…", 0, () => TrocarTracadoNoRanking(_gHistKart.ChaveAtual as JsonObject, "sessionId", "bateria", "tracado"))], tituloVivo: _tituloHistorico);

        var grade = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 3, Padding = new Padding(18, 16, 18, 16), BackColor = TemaCrono.Fundo };
        grade.RowStyles.Add(new RowStyle(SizeType.Absolute, 72)); grade.RowStyles.Add(new RowStyle(SizeType.Percent, 58)); grade.RowStyles.Add(new RowStyle(SizeType.Percent, 42));
        cartaoFiltros.Dock = DockStyle.Fill; cartaoRank.Margin = new Padding(0, 0, 0, 14); cartaoHist.Margin = Padding.Empty;
        grade.Controls.Add(cartaoFiltros, 0, 0); grade.Controls.Add(cartaoRank, 0, 1); grade.Controls.Add(cartaoHist, 0, 2);
        // em tela estreita os filtros ocupam 2 linhas: a linha do cartão cresce junto (antes a 2ª linha saía cortada)
        grade.Resize += (_, _) =>
        {
            var w = grade.ClientSize.Width - grade.Padding.Horizontal;
            var alvo = Math.Max(58, filtros.GetPreferredSize(new Size(w, 0)).Height) + 14;
            if (Math.Abs(grade.RowStyles[0].Height - alvo) > 0.5f) grade.RowStyles[0].Height = alvo;
        };
        page.Controls.Add(grade);
        return page;
    }

    /// <summary>Troca o traçado da bateria de uma linha do ranking/histórico (e da outra prova da mesma bateria).</summary>
    void TrocarTracadoNoRanking(JsonObject linha, string campoSessao, string campoBateria, string campoTracado)
    {
        if (linha == null || linha.S(campoSessao) is not { Length: > 0 } sessaoId) { Msg.Aviso(this, "Escolha uma linha do ranking."); return; }
        Seguro.Rodar(this, async () =>
        {
            var todas = await Crono.Api.Lista("/api/sessions");
            var bateria = todas.FirstOrDefault(x => x.S("id") == sessaoId);
            if (bateria == null) { Msg.Aviso(this, "Bateria não encontrada."); return; }
            // tomada de tempo e corrida da mesma bateria correm no mesmo traçado
            var irmas = todas.Where(x => x.S("id") != sessaoId && x.S("state") != "cancelada" && x.S("programaId") is { Length: > 0 } p && p == bateria.S("programaId")).ToList();
            using var d = NovoDialogo("Trocar traçado da bateria", linha.S(campoBateria), "M4 8h13l-3-3M20 16H7l3 3", "linear-gradient(180deg, #FFB547, #F07A00)", 720, 420);
            var tracado = new ListaDesign();
            var trilhas = Crono.Arr(_catalog, "tracks").Where(t => !t.ContainsKey("active") || t.B("active")).ToList();
            foreach (var t in trilhas) tracado.Items.Add(new Campos.Item(0, $"{t.S("name")} · {t.I("lengthMeters")} m", t));
            tracado.SelectedIndex = Math.Max(0, trilhas.FindIndex(t => t.S("name") == linha.S(campoTracado)));
            var juntas = new CheckBox { Text = irmas.Count > 0 ? $"Trocar também em: {string.Join(", ", irmas.Select(x => x.S("name")))}" : "", Checked = true, AutoSize = true, Visible = irmas.Count > 0 };
            var g = d.Secao("Traçado em que a bateria foi corrida", $"Agora: {linha.S(campoTracado)}");
            d.Campo(g, "Traçado", tracado, 6);
            if (irmas.Count > 0) d.Marca(g, juntas, 6);
            d.Nota("Os tempos continuam os mesmos: só passam a contar no traçado escolhido (ranking, velocidade média e relatórios).");
            d.BotaoRodape("Trocar traçado", true, () => Seguro.Rodar(d, async () =>
            {
                var id = (tracado.SelectedItem as Campos.Item)?.Dados?.S("id");
                if (string.IsNullOrEmpty(id)) { Msg.Aviso(d, "Escolha o traçado."); return; }
                foreach (var s in juntas.Checked ? irmas.Prepend(bateria) : [bateria])
                    await Crono.Api.Patch($"/api/sessions/{s.S("id")}", new JsonObject { ["trackId"] = id });
                d.DialogResult = DialogResult.OK; d.Close();
                await CarregarRankingKarts();
            }));
            d.BotaoRodape("Cancelar", false, d.Close);
            d.ShowDialog(this);
        });
    }

    string FiltroRanking()
    {
        var q = new List<string>();
        if (_rankDe.Valida) q.Add("de=" + _rankDe.Value.ToString("yyyy-MM-dd"));
        if (_rankAte.Valida) q.Add("ate=" + _rankAte.Value.ToString("yyyy-MM-dd"));
        if ((_rankTracado.SelectedItem as Campos.Item)?.Dados?.S("id") is { Length: > 0 } t) q.Add("trackId=" + Uri.EscapeDataString(t));
        if ((_rankTipo.SelectedItem as Campos.Item)?.Dados?.S("v") is { Length: > 0 } tp) q.Add("tipos=" + tp);
        if ((_rankCategoria.SelectedItem as Campos.Item)?.Dados?.S("v") is { Length: > 0 } cat) q.Add("categoria=" + Uri.EscapeDataString(cat));
        return string.Join("&", q);
    }

    string CategoriaRanking() => (_rankCategoria.SelectedItem as Campos.Item)?.Texto ?? "Todas as categorias";

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
                r.I("posicao"), r.S("kart").PadLeft(2, '0'), r.S("melhorPiloto"), DiaBr(r.S("melhorData")), r.S("melhorTracado"), r.B("chuva") ? "Chuva" : "Seca", Crono.Volta(r.L("melhorMs")),
                Crono.Volta(r.L("media10Ms")), Crono.Volta(r.L("medianaMs")), r.I("voltas"), r.I("baterias"), r.I("pilotos"), DiaBr(r.S("ultimaVez")) }).ToList(), lista.Cast<object>().ToList());
            _subRanking.Text = lista.Count == 0
                ? (_rankCategoria.SelectedIndex > 0 ? $"Nenhum kart da categoria {CategoriaRanking()} em {DescricaoPeriodo()}" : $"Nenhuma bateria finalizada em {DescricaoPeriodo()}")
                : $"{lista.Count} karts · {lista.Sum(r => r.I("voltas"))} voltas · {DescricaoPeriodo()} · {CategoriaRanking()} · Chuva = pista molhada · ordenado pela melhor volta (voltas impossíveis, acima de 120 km/h de média, ficam de fora)";
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
            _subHistorico.Text = $"{lista.Count} bateria(s) em {DescricaoPeriodo()} · {CategoriaRanking()} · da mais recente para a mais antiga";
            _gHistKart.Preencher(lista.Select(h => new object[] { DiaBr(h.S("data")), h.S("hora"), h.S("bateria"), Crono.Tipo(h.S("tipo")), h.S("tracado"), h.B("chuva") ? "Chuva" : "Seca", h.S("piloto"), h.I("voltas"), Crono.Volta(h.L("melhorMs")), Crono.Volta(h.L("medianaMs")) }).ToList(), lista.Cast<object>().ToList());
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
        var linhas = string.Concat(_gRankKarts.Rows.Cast<DataGridViewRow>().Select(r => "<tr>" + string.Concat(r.Cells.Cast<DataGridViewCell>().Select((c, i) => $"<td class=\"{(i is 6 or 7 or 8 ? "t" : i is 2 or 4 or 5 ? "n" : "")}\">{H(c.FormattedValue)}</td>")) + "</tr>"));
        var tracado = (_rankTracado.SelectedItem as Campos.Item)?.Texto ?? "Todos os traçados";
        var tipo = (_rankTipo.SelectedItem as Campos.Item)?.Texto ?? "Todas as provas";
        var categoria = CategoriaRanking();
        var html = "<!doctype html><meta charset=utf-8><title>Ranking dos karts</title><style>@page{size:A4;margin:12mm}body{font:12px 'Segoe UI',Arial;margin:0;color:#1d1d1f}h1{margin:0 0 2px;font-size:20px}.v{color:#555;margin-bottom:10px}table{border-collapse:collapse;width:100%}th,td{padding:5px 6px;border-bottom:1px solid #e5e5ea;text-align:right;white-space:nowrap}th{font-size:10px;color:#333;background:#f1f5f2;text-transform:uppercase;border-bottom:1.5px solid #000}td.n,th:nth-child(3),th:nth-child(4),th:nth-child(5),th:nth-child(6){text-align:left;white-space:normal}.t{font-family:Consolas,monospace}</style>"
            + $"<h1>Ranking dos karts</h1><div class=v>Kartódromo Internacional de Betim · {H(DescricaoPeriodo())} · {H(tracado)} · {H(tipo)} · {H(categoria)} · Chuva = pista molhada · emitido em {DateTime.Now:dd/MM/yyyy HH:mm}</div><table><thead><tr>{cab}</tr></thead><tbody>{linhas}</tbody></table>";
        var arq = Path.Combine(Path.GetTempPath(), $"ranking-karts-{DateTime.Now:yyyyMMddHHmmss}.html");
        File.WriteAllText(arq, html, new System.Text.UTF8Encoding(false));
        Relatorio.Abrir(this, new Uri(arq).AbsoluteUri, "Ranking dos karts");
    }
}
