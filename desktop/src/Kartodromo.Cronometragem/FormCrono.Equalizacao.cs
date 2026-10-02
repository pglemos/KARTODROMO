using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

/// <summary>Aba Equalização (Planilha de Gestão de Frota, Oficina e Equalização): traçado e meta por traçado,
/// karts referência, tempos de 2 em 2 voltas por redutor, apontamentos da oficina, histórico e PDF para a oficina.
/// A equalização é uma bateria do tipo "equalizacao": as voltas vêm do decoder e ficam separadas das baterias normais.
/// Regra do redutor (por tipo de kart, editável): a diferença para a referência diz quanto abrir ou fechar, em mm.</summary>
public partial class FormCrono
{
    const string SvgEqualizacao = "M4 6h16M4 12h10M4 18h16M17 9v6";
    const string CorEqualizacao = "linear-gradient(180deg, #6CB8FF, #1E6FE8)";
    const int BlocosNaTela = 4;
    readonly LiveGrid _gEq = new();
    readonly Label _subEq = new(), _tituloEq = new() { Text = "Equalização dos karts" }, _eqSituacao = new();
    ListaDesign _eqLista;
    JsonObject _eq;
    List<JsonObject> _eqRegras;
    DateTime _eqLidaEm = DateTime.MinValue;
    bool _eqCarregando, _eqMontandoLista;

    TabPage AbaEqualizacao()
    {
        var page = new TabPage("Equalização") { BackColor = TemaCrono.Fundo, Padding = Padding.Empty };

        // ---- barra: qual equalização + ações gerais
        _eqLista = new ListaDesign { Width = 380, Font = new Font("Segoe UI", 9.4F) };
        _eqLista.SelectedIndexChanged += (_, _) => { if (!_eqMontandoLista) _ = CarregarEqualizacao(true); };
        var caixa = new Panel { Size = new Size(396, 32), BackColor = Color.White, Margin = new Padding(0, 1, 10, 0), Padding = new Padding(8, 6, 6, 3) };
        caixa.Paint += (_, e) => { e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias; using var pp = Forma.Redondo(new Rectangle(0, 0, caixa.Width - 1, caixa.Height - 1), 8); using var pen = new Pen(Color.FromArgb(219, 219, 222)); e.Graphics.DrawPath(pen, pp); };
        _eqLista.Dock = DockStyle.Fill; caixa.Controls.Add(_eqLista);
        var barra = new FlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = true, BackColor = Color.White, Padding = new Padding(16, 12, 16, 6) };
        barra.Controls.Add(caixa);
        barra.Controls.Add(BotaoPeq("+ Nova equalização", 1, () => ConfigurarEqualizacao(true)));
        barra.Controls.Add(BotaoPeq("Meta do traçado…", 0, MetaDoTracado));
        barra.Controls.Add(BotaoPeq("Regra do redutor…", 0, RegraDoRedutor));
        barra.Controls.Add(BotaoPeq("Histórico e metas", 0, () => Relatorio.Abrir(this, $"{Config.CronoUrl.TrimEnd('/')}/equalizacao", "Equalização · histórico e metas por traçado")));
        var cartaoBarra = new TemaCrono.PainelArredondado { Dock = DockStyle.Fill, BackColor = Color.White, Raio = 16, Margin = new Padding(0, 0, 0, 14) };
        cartaoBarra.Controls.Add(barra);

        // ---- matriz: kart × blocos de 2 voltas (um redutor por bloco)
        TemaCrono.EstilizarGrade(_gEq);
        _gEq.RowTemplate.Height = 44;
        _gEq.AutoSizeRowsMode = DataGridViewAutoSizeRowsMode.AllCells; // a ação recomendada pode ocupar 2 ou 3 linhas
        _gEq.Col("Kart", 58).Col("Mecânico / piloto", 150, DataGridViewContentAlignment.MiddleLeft, true);
        for (var i = 0; i < BlocosNaTela; i++) _gEq.Col(i == 0 ? "Bloco 1 · redutor inicial" : $"Bloco {i + 1} · redutor trocado", 178, DataGridViewContentAlignment.MiddleRight);
        _gEq.Col("Redutor sugerido", 112).Col("Status", 104).Col("Ação recomendada", 250, DataGridViewContentAlignment.MiddleLeft, true).Col("Voltas desde a última", 118, DataGridViewContentAlignment.MiddleRight);
        _gEq.Columns[0].DefaultCellStyle.Font = new Font("Cascadia Mono", 9.6F, FontStyle.Bold);
        for (var i = 2; i < 2 + BlocosNaTela; i++) _gEq.Columns[i].DefaultCellStyle.Font = new Font("Cascadia Mono", 8.8F);
        _gEq.DefaultCellStyle.WrapMode = DataGridViewTriState.True;
        _gEq.CellDoubleClick += (_, e) => { if (e.RowIndex >= 0) ApontamentosDoKart(); };
        _subEq.Text = "Crie uma equalização ou escolha uma na lista";
        _eqSituacao.AutoSize = true; _eqSituacao.Font = new Font("Segoe UI", 9.4F); _eqSituacao.ForeColor = TemaCrono.Secundario; _eqSituacao.BackColor = Color.FromArgb(251, 251, 253); _eqSituacao.Margin = new Padding(0, 7, 0, 0);
        var direita = new FlowLayoutPanel { AutoSize = true, WrapContents = false, BackColor = Color.FromArgb(251, 251, 253), Margin = Padding.Empty };
        direita.Controls.Add(_eqSituacao);
        direita.PerformLayout(); direita.Size = new Size(260, 30);
        var cartao = CartaoPasso(-1, null, _subEq, _gEq,
            [BotaoPeq("Dar a verde", 1, VerdeNaEqualizacao),
             BotaoPeq("Configurar…", 0, () => ConfigurarEqualizacao(false)),
             BotaoPeq("Apontamentos do kart…", 0, ApontamentosDoKart),
             BotaoPeq("Finalizar equalização", 3, FinalizarEqualizacao),
             BotaoPeq("Relatório para a oficina (PDF)", 0, RelatorioEqualizacao),
             BotaoPeq("Ver na cronometragem →", 0, () => { if (_eq != null) { Selecionar(_eq.S("id")); _abas.SelectedIndex = 2; } })],
            tituloVivo: _tituloEq, direitaRodape: direita);

        var grade = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 2, Padding = new Padding(18, 16, 18, 16), BackColor = TemaCrono.Fundo };
        grade.RowStyles.Add(new RowStyle(SizeType.Absolute, 72)); grade.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        cartao.Margin = Padding.Empty;
        grade.Controls.Add(cartaoBarra, 0, 0); grade.Controls.Add(cartao, 0, 1);
        page.Controls.Add(grade);
        return page;
    }

    // tempos com ponto, como no resto da cronometragem (53.550)
    static readonly System.Globalization.CultureInfo Ponto = System.Globalization.CultureInfo.InvariantCulture;
    static string Seg(long? ms) => ms is long v && v > 0 ? (v / 1000.0).ToString("0.000", Ponto) : "";
    static string Delta(long? ms) => ms is not long v ? "" : (v > 0 ? "+" : v < 0 ? "−" : "±") + (Math.Abs(v) / 1000.0).ToString("0.000", Ponto);
    static double? Dec(JsonNode o, string k) => o?[k] is JsonValue v && v.GetValueKind() == System.Text.Json.JsonValueKind.Number ? v.GetValue<double>() : null;
    // milímetros do redutor com vírgula (0,1 · 0,25 · 17,0), sem sinal
    static string Mm(double mm) => Math.Abs(mm).ToString("0.0#", Fmt.Br);
    /// <summary>O que a regra manda fazer com o redutor: "abrir 0,2 mm", "fechar 0,1 mm" ou "equalizado".</summary>
    static string Ajuste(double? mm) => mm is not double v ? "" : v == 0 ? "equalizado" : $"{(v > 0 ? "abrir" : "fechar")} {Mm(v)} mm";
    /// <summary>Abertura em relação ao redutor inicial, como se digita: +0,3 · -0,1 · 0.</summary>
    static string Abertura(double mm) => mm == 0 ? "0" : (mm > 0 ? "+" : "-") + Mm(mm);
    static bool TentarMm(string texto, out double mm) => double.TryParse(texto.Trim().Replace('−', '-').Replace(',', '.'), System.Globalization.NumberStyles.Float, Ponto, out mm);
    static string TextoRegra(long tolMs, long faixaMs, double passoMm) => $"equalizado até ±{Seg(tolMs)} s · a cada {Seg(faixaMs)} s, {Mm(passoMm)} mm";
    static string DiaHora(long? ms) => ms is long w ? DateTimeOffset.FromUnixTimeMilliseconds(w).ToLocalTime().ToString("dd/MM/yyyy HH:mm") : "";

    /// <summary>Lista de equalizações (mais recente primeiro) e a escolhida. forcar = recarrega mesmo sem ter passado o intervalo.</summary>
    async Task CarregarEqualizacao(bool forcar = false)
    {
        if (_eqLista == null || _eqCarregando) return;
        if (!forcar && DateTime.Now - _eqLidaEm < TimeSpan.FromSeconds(2)) return;
        _eqCarregando = true;
        try
        {
            if (_eqRegras == null || forcar) await CarregarRegrasDoRedutor();
            var resposta = (await Crono.Api.Get("/api/equalizacao"))?.AsObject();
            var lista = Crono.Arr(resposta, "equalizacoes");
            var escolhida = (_eqLista.SelectedItem as Campos.Item)?.Dados?.S("id") ?? _eq?.S("id");
            var textos = lista.Select(e => $"{DiaHora(e.L("startedAt") ?? e.L("createdAt"))}  ·  {e.S("name")}  ·  {(e.L("finalizadaEm") != null ? "finalizada" : Crono.Estado(e.S("state")).ToLowerInvariant())}").ToList();
            if (!_eqLista.DroppedDown && !_eqLista.Items.Cast<Campos.Item>().Select(i => i.Texto).SequenceEqual(textos))
            {
                _eqMontandoLista = true;
                _eqLista.Items.Clear();
                for (var i = 0; i < lista.Count; i++) _eqLista.Items.Add(new Campos.Item(0, textos[i], lista[i]));
                var idx = lista.FindIndex(e => e.S("id") == escolhida);
                _eqLista.SelectedIndex = lista.Count == 0 ? -1 : Math.Max(0, idx);
                _eqMontandoLista = false;
            }
            var id = (_eqLista.SelectedItem as Campos.Item)?.Dados?.S("id");
            _eq = string.IsNullOrEmpty(id) ? null : (await Crono.Api.Get($"/api/equalizacao/{id}"))?.AsObject();
            _eqLidaEm = DateTime.Now;
            DesenharEqualizacao();
        }
        catch (Exception e) { _subEq.Text = "Não foi possível carregar a equalização: " + e.Message; }
        finally { _eqCarregando = false; _eqMontandoLista = false; }
    }

    void DesenharEqualizacao()
    {
        if (_eq == null)
        {
            _tituloEq.Text = "Equalização dos karts";
            _subEq.Text = "Nenhuma equalização ainda: clique em + Nova equalização, escolha o traçado e os karts referência";
            _eqSituacao.Text = "";
            _gEq.Preencher([]);
            return;
        }
        var r = _eq["resultado"] as JsonObject;
        var trilha = _eq["track"] as JsonObject;
        var meta = _eq.L("metaMs");
        var tol = _eq.L("toleranciaMs") ?? 200;
        var regra = _eq["regra"] as JsonObject;
        var origem = _eq.S("metaOrigem") switch { "fixa" => "meta fixa do traçado", "referencia" => "média das referências", _ => "defina as referências ou a meta" };
        var refs = Crono.Arr(r, "referencias");
        _tituloEq.Text = _eq.S("name");
        _subEq.Text = $"{trilha?.S("name")} · {trilha?.I("lengthMeters")} m  ·  Meta {(meta is long m ? Seg(m) : "—")} ± {Seg(tol)} s ({origem})" +
            (refs.Count > 0 ? "  ·  Referências: " + string.Join(", ", refs.Select(x => $"#{x.S("kart")} {(x.L("melhorMs") is long b ? Seg(b) : "sem volta")}")) : "  ·  Sem karts referência") +
            (regra == null ? "" : $"  ·  {regra.S("nome")}: a cada {Seg(regra.L("faixaMs"))} s, {Mm(Dec(regra, "passoMm") ?? 0.1)} mm");
        var karts = Crono.Arr(r, "karts");
        var voltas = _eq["voltasDesdeUltima"] as JsonObject;
        var linhas = new List<object[]>();
        foreach (var k in karts)
        {
            var linha = new object[2 + BlocosNaTela + 4];
            linha[0] = k.S("kart").PadLeft(2, '0'); linha[1] = k.S("piloto");
            var blocos = Crono.Arr(k, "blocos");
            if (k.B("referencia")) linha[2] = $"Melhor {Seg(k.L("melhorMs"))}\nmédia {Seg(k.L("mediaMs"))} · {k.I("voltas")} voltas";
            for (var i = 0; i < BlocosNaTela && !k.B("referencia"); i++)
            {
                // quando há mais blocos que colunas, mostram-se os últimos (o redutor que está no kart agora)
                var b = blocos.Count > BlocosNaTela ? blocos[blocos.Count - BlocosNaTela + i] : i < blocos.Count ? blocos[i] : null;
                if (b == null) { linha[2 + i] = ""; continue; }
                var tempos = string.Join(" / ", (b["voltasMs"] as JsonArray ?? []).Select(v => Seg(v?.GetValue<long>())));
                // 3ª linha: o redutor deste bloco e o que a regra manda fazer depois dele; com mais blocos que colunas, a 1ª diz qual é
                var qual = b.S("rotulo");
                var sugestao = Ajuste(Dec(b, "ajusteMm"));
                linha[2 + i] = (blocos.Count > BlocosNaTela ? $"bloco {b.I("bloco")}: " : "") + tempos + (b.B("completo")
                    ? $"\nmédia {Seg(b.L("mediaMs"))}{(b.L("deltaMs") is long dl ? $" ({Delta(dl)})" : "")}\n{qual}{(sugestao.Length > 0 ? " → " + sugestao : "")}"
                    : $" / …\nfalta 1 volta\n{qual}");
            }
            var v0 = voltas?[k.S("kart")] as JsonObject;
            linha[2 + BlocosNaTela] = k.B("referencia") ? "referência" : k.S("redutorSugerido") is { Length: > 0 } sug ? sug : "—";
            linha[3 + BlocosNaTela] = k.S("status");
            linha[4 + BlocosNaTela] = k.S("acao");
            linha[5 + BlocosNaTela] = v0 == null ? "" : $"{v0.I("voltas")} voltas\n{v0.I("baterias")} bateria(s)";
            linhas.Add(linha);
        }
        var kartAntes = (_gEq.ChaveAtual as JsonObject)?.S("kart");
        _gEq.Preencher(linhas, karts.Cast<object>().ToList());
        // cores: bloco dentro da tolerância em verde; status com a cor da planilha
        for (var i = 0; i < karts.Count && i < _gEq.Rows.Count; i++)
        {
            var blocos = Crono.Arr(karts[i], "blocos");
            for (var c = 0; c < BlocosNaTela; c++)
            {
                var b = blocos.Count > BlocosNaTela ? blocos[blocos.Count - BlocosNaTela + c] : c < blocos.Count ? blocos[c] : null;
                var dentro = b != null && b.B("dentro") && b.B("completo");
                _gEq.Rows[i].Cells[2 + c].Style.BackColor = dentro ? Color.FromArgb(225, 247, 231) : Color.Empty;
                _gEq.Rows[i].Cells[2 + c].Style.ForeColor = dentro ? Color.FromArgb(28, 107, 53) : Color.Empty;
            }
            var (fundo, letra) = karts[i].S("status") switch
            {
                "REF" => (Color.FromArgb(230, 240, 251), Color.FromArgb(10, 79, 160)),
                "EQUALIZADO" => (Color.FromArgb(11, 122, 83), Color.White),
                "AJUSTANDO" => (Color.FromArgb(255, 245, 217), Color.FromArgb(138, 82, 0)),
                "REVISAR" => (Color.FromArgb(196, 40, 28), Color.White),
                _ => (Color.Empty, TemaCrono.Secundario),
            };
            var st = _gEq.Rows[i].Cells[3 + BlocosNaTela].Style;
            st.BackColor = fundo; st.ForeColor = letra; st.SelectionBackColor = fundo; st.SelectionForeColor = letra; st.Font = new Font("Segoe UI", 8.6F, FontStyle.Bold);
        }
        var idx = karts.FindIndex(k => k.S("kart") == kartAntes);
        if (idx >= 0 && idx < _gEq.Rows.Count) { _gEq.CurrentCell = _gEq.Rows[idx].Cells[0]; _gEq.Rows[idx].Selected = true; }
        var testados = karts.Where(k => !k.B("referencia")).ToList();
        _eqSituacao.Text = _eq.L("finalizadaEm") != null ? $"Finalizada · {_eq.I("equalizados")} de {testados.Count} equalizados"
            : $"{Crono.Estado(_eq.S("state"))} · {_eq.I("equalizados")} de {testados.Count} equalizados";
    }

    /// <summary>Nova equalização ou os dados da escolhida: traçado, karts referência, meta (referências ou fixa), tolerância.</summary>
    void ConfigurarEqualizacao(bool nova)
    {
        if (!nova && _eq == null) { Msg.Aviso(this, "Escolha uma equalização na lista ou crie uma nova."); return; }
        var cfg = nova ? null : _eq["config"] as JsonObject;
        using var d = NovoDialogo(nova ? "Nova equalização" : "Configurar equalização", nova ? "Traçado, karts referência, meta de tempo e regra do redutor" : _eq.S("name"), SvgEqualizacao, CorEqualizacao, 900, 840);
        var nome = Txt(nova ? "" : _eq.S("name"));
        var tracado = new ListaDesign();
        var trilhas = Crono.Arr(_catalog, "tracks").Where(t => !t.ContainsKey("active") || t.B("active")).ToList();
        tracado.Items.Add(new Campos.Item(0, "Traçado principal (padrão)"));
        foreach (var t in trilhas) tracado.Items.Add(new Campos.Item(0, $"{t.S("name")} · {t.I("lengthMeters")} m", t));
        tracado.SelectedIndex = Math.Max(0, trilhas.FindIndex(t => t.S("id") == (cfg?.S("trackId") ?? "")) + 1);
        var refs = Txt(cfg == null ? "" : string.Join(", ", (cfg["referencias"] as JsonArray ?? []).Select(x => x?.ToString())), 40);
        var mecanico = Txt(cfg?.S("mecanico") ?? "", 80);
        var modoRef = new RadioButton { Text = "Média das melhores voltas dos karts referência", Checked = cfg == null || cfg.S("metaModo") != "fixa" };
        var modoFixa = new RadioButton { Text = "Meta fixa do traçado (digitada ou a última registrada)", Checked = cfg?.S("metaModo") == "fixa" };
        var metaFixa = Txt(Seg(cfg?.L("metaFixaMs")), 10);
        // regra do redutor: a do tipo de kart escolhido, que pode ser ajustada só para esta equalização
        var regras = RegrasDoRedutor();
        var atual = cfg != null ? cfg : regras[0];
        var tipo = new ListaDesign();
        foreach (var x in regras) tipo.Items.Add(new Campos.Item(0, $"{x.S("nome")}  ·  {TextoRegra(x.L("toleranciaMs") ?? 200, x.L("faixaMs") ?? 200, Dec(x, "passoMm") ?? 0.1)}", x));
        tipo.SelectedIndex = Math.Max(0, regras.FindIndex(x => string.Equals(x.S("nome"), cfg?.S("regraNome"), StringComparison.OrdinalIgnoreCase)));
        var tolerancia = Txt(Seg(atual.L("toleranciaMs") ?? 200), 8);
        var faixa = Txt(Seg(atual.L("faixaMs") ?? 200), 8);
        var passo = Txt(Mm(Dec(atual, "passoMm") ?? 0.1), 6);
        tipo.SelectedIndexChanged += (_, _) =>
        {
            if ((tipo.SelectedItem as Campos.Item)?.Dados is not JsonObject x) return;
            tolerancia.Text = Seg(x.L("toleranciaMs") ?? 200); faixa.Text = Seg(x.L("faixaMs") ?? 200); passo.Text = Mm(Dec(x, "passoMm") ?? 0.1);
        };
        var g = d.Secao("Sessão");
        d.Campo(g, "Nome (opcional)", nome, 3); d.Campo(g, "Traçado", tracado, 3);
        d.Campo(g, "Karts referência (2 ou 3, separados por vírgula)", refs, 3); d.Campo(g, "Mecânico / responsável", mecanico, 3);
        var m = d.Secao("Meta de tempo", "A meta não é fixa: vale para o traçado escolhido e fica no histórico por data.");
        d.Opcao(m, modoRef, 3); d.Opcao(m, modoFixa, 3);
        d.Campo(m, "Meta fixa (segundos, ex.: 52,395)", metaFixa, 3);
        var rg = d.Secao("Regra do redutor", "A diferença para o kart referência sugere o redutor: mais lento = abrir, mais rápido = fechar. Os valores vêm do tipo de kart e podem ser mudados só para esta equalização.");
        d.Campo(rg, "Tipo de kart", tipo, 6);
        d.Campo(rg, "Equalizado até ± (segundos)", tolerancia, 2); d.Campo(rg, "Depois, a cada (segundos)", faixa, 2); d.Campo(rg, "Abrir ou fechar (mm)", passo, 2);
        d.Nota("Karts referência passam várias vezes e servem de comparação: todas as voltas valem. Os outros karts guardam os tempos de 2 em 2 voltas, um redutor por bloco.");
        d.BotaoRodape(nova ? "Criar equalização" : "Salvar", true, () => Seguro.Rodar(d, async () =>
        {
            var lista = refs.Text.Split([',', ';', ' '], StringSplitOptions.RemoveEmptyEntries).Select(x => x.Trim()).Distinct().ToList();
            if (lista.Count > 3) { Msg.Aviso(d, "Use 2 ou 3 karts referência."); refs.Focus(); return; }
            if (modoRef.Checked && lista.Count == 0 && !Msg.Pergunta(d, "Nenhum kart referência foi informado: a meta fica sem valor até você definir.\n\nContinuar assim?")) return;
            if (!TentarSegundos(tolerancia.Text.Trim(), out _)) { Msg.Aviso(d, "Digite até quantos segundos de diferença o kart está equalizado (ex.: 0,200)."); tolerancia.Focus(); return; }
            if (!TentarSegundos(faixa.Text.Trim(), out _)) { Msg.Aviso(d, "Digite de quantos em quantos segundos muda o redutor (ex.: 0,200)."); faixa.Focus(); return; }
            if (!TentarMm(passo.Text, out var passoMm) || passoMm <= 0) { Msg.Aviso(d, "Digite quantos milímetros abrir ou fechar a cada faixa (ex.: 0,1)."); passo.Focus(); return; }
            var corpo = new JsonObject
            {
                ["nome"] = nome.Text.Trim(), ["trackId"] = (tracado.SelectedItem as Campos.Item)?.Dados?.S("id"),
                ["referencias"] = new JsonArray(lista.Select(x => (JsonNode)JsonValue.Create(x)).ToArray()), ["mecanico"] = mecanico.Text.Trim(),
                ["metaModo"] = modoFixa.Checked ? "fixa" : "referencia", ["metaSeg"] = metaFixa.Text.Trim(),
                ["regra"] = (tipo.SelectedItem as Campos.Item)?.Dados?.S("nome"), ["toleranciaSeg"] = tolerancia.Text.Trim(), ["faixaSeg"] = faixa.Text.Trim(), ["passoMm"] = passo.Text.Trim(),
            };
            var salvo = nova ? await Crono.Api.Post("/api/equalizacao", corpo) : await Crono.Api.Patch($"/api/equalizacao/{_eq.S("id")}", corpo);
            _eq = salvo?.AsObject();
            d.DialogResult = DialogResult.OK; d.Close();
            if (nova) { _eqMontandoLista = true; _eqLista.Items.Clear(); _eqMontandoLista = false; }
            await CarregarEqualizacao(true);
            await Atualizar();
        }));
        d.BotaoRodape("Cancelar", false, d.Close);
        d.ShowDialog(this);
    }

    /// <summary>Meta fixa de um traçado (vale para as próximas equalizações no modo "meta fixa"); fica no histórico.</summary>
    void MetaDoTracado()
    {
        using var d = NovoDialogo("Meta do traçado", "Meta de tempo por traçado · fica no histórico por data", SvgEqualizacao, CorEqualizacao, 760, 440);
        var tracado = new ListaDesign();
        var trilhas = Crono.Arr(_catalog, "tracks").Where(t => !t.ContainsKey("active") || t.B("active")).ToList();
        tracado.Items.Add(new Campos.Item(0, "Traçado principal (padrão)"));
        foreach (var t in trilhas) tracado.Items.Add(new Campos.Item(0, $"{t.S("name")} · {t.I("lengthMeters")} m", t));
        tracado.SelectedIndex = Math.Max(0, trilhas.FindIndex(t => t.S("id") == (_eq?["config"] as JsonObject)?.S("trackId")) + 1);
        var meta = Txt("", 10); var tol = Txt(Seg(RegrasDoRedutor()[0].L("toleranciaMs") ?? 200), 8);
        var g = d.Secao("Nova meta");
        d.Campo(g, "Traçado", tracado, 6);
        d.Campo(g, "Meta (segundos, ex.: 52,395)", meta, 3); d.Campo(g, "Tolerância ± (segundos)", tol, 3);
        d.Nota("As metas anteriores não se apagam: veja em Histórico e metas, filtrando pelo traçado.");
        d.BotaoRodape("Salvar meta", true, () => Seguro.Rodar(d, async () =>
        {
            if (!TentarSegundos(meta.Text.Trim(), out _)) { Msg.Aviso(d, "Digite a meta em segundos (ex.: 52,395)."); meta.Focus(); return; }
            await Crono.Api.Post("/api/equalizacao/metas", new JsonObject { ["trackId"] = (tracado.SelectedItem as Campos.Item)?.Dados?.S("id"), ["metaSeg"] = meta.Text.Trim(), ["toleranciaSeg"] = tol.Text.Trim(), ["autor"] = Environment.UserName });
            d.DialogResult = DialogResult.OK; d.Close();
            await CarregarEqualizacao(true);
        }));
        d.BotaoRodape("Cancelar", false, d.Close);
        d.ShowDialog(this);
    }

    /// <summary>Regras do redutor por tipo de kart (a primeira é a padrão); sem resposta do serviço vale a do Kart Indoor.</summary>
    List<JsonObject> RegrasDoRedutor() => _eqRegras is { Count: > 0 } ? _eqRegras
        : [new JsonObject { ["id"] = "kart-indoor", ["nome"] = "Kart Indoor", ["toleranciaMs"] = 200, ["faixaMs"] = 200, ["passoMm"] = 0.1 }];

    async Task CarregarRegrasDoRedutor()
    {
        try { _eqRegras = Crono.Arr((await Crono.Api.Get("/api/equalizacao/regras"))?.AsObject(), "regras"); }
        catch { /* serviço antigo ou fora do ar: segue com a regra padrão */ }
    }

    /// <summary>Regra do redutor por tipo de kart: até quanto de diferença para a referência o kart está equalizado e,
    /// depois disso, de quantos em quantos segundos se abre (mais lento) ou fecha (mais rápido) o redutor, e quanto.</summary>
    void RegraDoRedutor()
    {
        using var d = NovoDialogo("Regra do redutor", "A diferença para o kart referência sugere quanto abrir ou fechar", SvgEqualizacao, CorEqualizacao, 860, 680);
        var regras = RegrasDoRedutor();
        var tipo = new ListaDesign();
        foreach (var x in regras) tipo.Items.Add(new Campos.Item(0, x.S("nome"), x));
        tipo.Items.Add(new Campos.Item(0, "+ Novo tipo de kart"));
        var nome = Txt("", 60); var tol = Txt("", 8); var faixa = Txt("", 8); var passo = Txt("", 6);
        var previa = new Label { AutoSize = true, MaximumSize = new Size(780, 0), Font = new Font("Cascadia Mono", 9.4F), ForeColor = PecasDesign.CorTexto, BackColor = Color.White, Margin = new Padding(0, 0, 14, 8) };
        var g = d.Secao("Tipo de kart", "Cada tipo de kart tem a sua regra. Escolha um para alterar ou crie um novo.");
        d.Campo(g, "Regra", tipo, 3); d.Campo(g, "Nome do tipo de kart", nome, 3);
        var g2 = d.Secao("Faixas de tempo e redutor");
        d.Campo(g2, "Equalizado até ± (segundos)", tol, 2); d.Campo(g2, "Depois, a cada (segundos)", faixa, 2); d.Campo(g2, "Abrir ou fechar (mm)", passo, 2);
        var g3 = d.Secao("Como fica");
        g3.Controls.Add(previa); g3.SetColumnSpan(previa, 6);
        d.Nota("Kart mais lento que a referência: abrir o redutor. Mais rápido: fechar. A regra vale para as próximas equalizações; numa que já existe, mude em Configurar.");

        JsonObject Escolhida() => (tipo.SelectedItem as Campos.Item)?.Dados as JsonObject;
        void Previa()
        {
            if (!TentarSegundos(tol.Text.Trim(), out var t) || !TentarSegundos(faixa.Text.Trim(), out var f) || !TentarMm(passo.Text, out var p) || p <= 0) { previa.Text = "Preencha os três valores para ver as faixas."; return; }
            static string S(decimal s) => s.ToString("0.000", Ponto);
            var linhas = new List<string> { $"diferença de 0.000 a {S(t)} s   equalizado" };
            for (var i = 1; i <= 4; i++) linhas.Add($"diferença de {S(t + (i - 1) * f)} a {S(t + i * f)} s   abrir (ou fechar) {Mm(i * p)} mm");
            linhas.Add($"e assim por diante: a cada {S(f)} s, mais {Mm(p)} mm");
            previa.Text = string.Join("\n", linhas);
        }
        void Preencher()
        {
            var x = Escolhida();
            nome.Text = x?.S("nome") ?? "";
            var b = x ?? regras[0];
            tol.Text = Seg(b.L("toleranciaMs") ?? 200); faixa.Text = Seg(b.L("faixaMs") ?? 200); passo.Text = Mm(Dec(b, "passoMm") ?? 0.1);
            Previa();
            if (x == null) nome.Focus();
        }
        tipo.SelectedIndexChanged += (_, _) => Preencher();
        foreach (var c in new[] { tol, faixa, passo }) c.TextChanged += (_, _) => Previa();
        tipo.SelectedIndex = Math.Max(0, regras.FindIndex(x => string.Equals(x.S("nome"), (_eq?["regra"] as JsonObject)?.S("nome"), StringComparison.OrdinalIgnoreCase)));
        Preencher();

        d.BotaoRodape("Salvar regra", true, () => Seguro.Rodar(d, async () =>
        {
            if (nome.Text.Trim().Length == 0) { Msg.Aviso(d, "Digite o tipo de kart (ex.: Kart Indoor)."); nome.Focus(); return; }
            if (!TentarSegundos(tol.Text.Trim(), out _)) { Msg.Aviso(d, "Digite até quantos segundos de diferença o kart está equalizado (ex.: 0,200)."); tol.Focus(); return; }
            if (!TentarSegundos(faixa.Text.Trim(), out _)) { Msg.Aviso(d, "Digite de quantos em quantos segundos muda o redutor (ex.: 0,200)."); faixa.Focus(); return; }
            if (!TentarMm(passo.Text, out var p) || p <= 0) { Msg.Aviso(d, "Digite quantos milímetros abrir ou fechar a cada faixa (ex.: 0,1)."); passo.Focus(); return; }
            await Crono.Api.Post("/api/equalizacao/regras", new JsonObject { ["id"] = Escolhida()?.S("id"), ["nome"] = nome.Text.Trim(), ["toleranciaSeg"] = tol.Text.Trim(), ["faixaSeg"] = faixa.Text.Trim(), ["passoMm"] = passo.Text.Trim(), ["autor"] = Environment.UserName });
            await CarregarRegrasDoRedutor();
            // a equalização que está na tela e ainda não foi finalizada pode passar a usar a regra nova
            if (_eq != null && _eq.L("finalizadaEm") == null && Msg.Pergunta(d, $"Regra salva.\n\nUsar também na equalização \"{_eq.S("name")}\", que está na tela?"))
                await Crono.Api.Patch($"/api/equalizacao/{_eq.S("id")}", new JsonObject { ["regra"] = nome.Text.Trim() });
            d.DialogResult = DialogResult.OK; d.Close();
            await CarregarEqualizacao(true);
        }));
        d.BotaoRodape("Excluir", false, () => Seguro.Rodar(d, async () =>
        {
            if (Escolhida() is not JsonObject x) { Msg.Aviso(d, "Escolha a regra que vai ser excluída."); return; }
            if (!Msg.Pergunta(d, $"Excluir a regra \"{x.S("nome")}\"?\n\nAs equalizações que já usaram continuam com os valores gravados.")) return;
            await Crono.Api.Delete($"/api/equalizacao/regras/{Uri.EscapeDataString(x.S("id"))}");
            await CarregarRegrasDoRedutor();
            d.DialogResult = DialogResult.OK; d.Close();
        }));
        d.BotaoRodape("Fechar", false, d.Close);
        d.ShowDialog(this);
    }

    /// <summary>Apontamentos da oficina para o kart: chassi, pneu, motor, embreagem, freio, observações, ação e o redutor de cada bloco.</summary>
    void ApontamentosDoKart()
    {
        if (_eq == null || _gEq.ChaveAtual is not JsonObject k) { Msg.Aviso(this, "Escolha um kart na lista da equalização."); return; }
        var kart = k.S("kart");
        var ck = k["checklist"] as JsonObject;
        var sis = ck?["sistemas"] as JsonObject;
        using var d = NovoDialogo($"Apontamentos do kart {kart.PadLeft(2, '0')}", $"{_eq.S("name")} · pontos de melhoria para a oficina", SvgEqualizacao, CorEqualizacao, 940, 700);
        var piloto = Txt(k.S("piloto"), 80);
        var g0 = d.Secao("Kart");
        d.Campo(g0, "Mecânico / piloto", piloto, 3); d.Campo(g0, "Situação na equalização", Leitura($"{k.S("status")} · {(k.S("redutorSugerido") is { Length: > 0 } sug ? "redutor " + sug : "sem redutor definido")}"), 3);
        // redutor: a medida do inicial (opcional) e, em cada bloco seguinte, quanto estava aberto ou fechado em relação a ele
        var blocos = Crono.Arr(k, "blocos");
        var redutores = new List<(int bloco, string antes, TextBox caixa)>();
        var inicialAntes = Dec((_eq["config"] as JsonObject)?["redutorInicialMm"], kart) is double mi ? Mm(mi) : "";
        var inicial = Txt(inicialAntes, 6);
        var g3 = d.Secao("Redutor", "O programa presume que a oficina fez o ajuste sugerido depois de cada bloco. Corrija só se a troca foi outra: mm em relação ao redutor inicial (+0,3 = aberto 0,3 mm; -0,1 = fechado 0,1 mm). Em branco volta para o sugerido.");
        d.Campo(g3, "Medida do redutor inicial (mm, opcional)", inicial, 2);
        foreach (var b in blocos.Where(b => b.I("bloco") >= 2))
        {
            var texto = Abertura(Dec(b, "aberturaMm") ?? 0);
            var caixa = Txt(texto, 6);
            d.Campo(g3, $"Bloco {b.I("bloco")} · {string.Join(" / ", (b["voltasMs"] as JsonArray ?? []).Select(v => Seg(v?.GetValue<long>())))}", caixa, 2);
            redutores.Add((b.I("bloco"), texto, caixa));
        }
        var nomes = new (string id, string titulo)[] { ("chassi", "Chassi / direção"), ("pneu", "Pneus / calibragem"), ("motor", "Motor / carburação"), ("embreagem", "Transmissão / embreagem"), ("freio", "Freios") };
        var campos = new Dictionary<string, (ListaDesign st, TextBox nota)>();
        var g = d.Secao("Possíveis pontos de melhoria");
        foreach (var (id, titulo) in nomes)
        {
            var st = new ListaDesign();
            foreach (var (t, v) in new[] { ("Não avaliado", ""), ("OK", "ok"), ("Atenção", "atencao"), ("Crítico", "critico") }) st.Items.Add(new Campos.Item(0, t, new JsonObject { ["v"] = v }));
            var atual = (sis?[id] as JsonObject)?.S("status") ?? "";
            st.SelectedIndex = atual switch { "ok" => 1, "atencao" => 2, "critico" => 3, _ => 0 };
            var nota = Txt((sis?[id] as JsonObject)?.S("nota") ?? "", 160);
            d.Campo(g, titulo, st, 2); d.Campo(g, "O que foi visto", nota, 4);
            campos[id] = (st, nota);
        }
        var obs = Txt(ck?.S("observacoes") ?? "", 500);
        var acao = Txt(ck?.S("acaoOficina") ?? "", 200);
        var g2 = d.Secao("Observações e ação");
        d.Campo(g2, "Observações", obs, 6);
        d.Campo(g2, "Ação da oficina / peças (substitui a ação recomendada)", acao, 6);
        d.BotaoRodape("Salvar apontamentos", true, () => Seguro.Rodar(d, async () =>
        {
            var sistemas = new JsonObject();
            foreach (var (id, (st, nota)) in campos)
            {
                var v = (st.SelectedItem as Campos.Item)?.Dados?.S("v") ?? "";
                if (v.Length > 0 || nota.Text.Trim().Length > 0) sistemas[id] = new JsonObject { ["status"] = v.Length > 0 ? v : "atencao", ["nota"] = nota.Text.Trim() };
            }
            var id0 = _eq.S("id");
            if (inicial.Text.Trim().Length > 0 && (!TentarMm(inicial.Text, out var medida) || medida <= 0)) { Msg.Aviso(d, "Digite a medida do redutor inicial em milímetros (ex.: 17,2) ou deixe em branco."); inicial.Focus(); return; }
            foreach (var (bloco, _, caixa) in redutores)
                if (caixa.Text.Trim().Length > 0 && !TentarMm(caixa.Text, out _)) { Msg.Aviso(d, $"Bloco {bloco}: digite os milímetros em relação ao redutor inicial (ex.: 0,3 ou -0,1) ou deixe em branco."); caixa.Focus(); return; }
            if (inicial.Text.Trim() != inicialAntes)
                await Crono.Api.Patch($"/api/equalizacao/{id0}", new JsonObject { ["redutorInicial"] = new JsonObject { ["kart"] = kart, ["mm"] = inicial.Text.Trim() } });
            foreach (var (bloco, antes, caixa) in redutores)
                if (caixa.Text.Trim() != antes)
                    await Crono.Api.Patch($"/api/equalizacao/{id0}", new JsonObject { ["abertura"] = new JsonObject { ["kart"] = kart, ["bloco"] = bloco, ["mm"] = caixa.Text.Trim() } });
            await Crono.Api.Put($"/api/equalizacao/{id0}/karts/{Uri.EscapeDataString(kart)}", new JsonObject
            { ["sistemas"] = sistemas, ["observacoes"] = obs.Text.Trim(), ["acaoOficina"] = acao.Text.Trim(), ["piloto"] = piloto.Text.Trim(), ["autor"] = Environment.UserName });
            d.DialogResult = DialogResult.OK; d.Close();
            await CarregarEqualizacao(true);
        }));
        d.BotaoRodape("Cancelar", false, d.Close);
        d.ShowDialog(this);
    }

    void VerdeNaEqualizacao()
    {
        if (_eq == null) { Msg.Aviso(this, "Crie ou escolha uma equalização."); return; }
        if (_eq.S("state") != "preparando") { Msg.Info(this, _eq.S("state") == "encerrada" ? "Esta equalização já foi encerrada. Crie uma nova." : "A equalização já está aberta: as voltas estão sendo contadas."); return; }
        Selecionar(_eq.S("id"));
        _fixado = true;
        // usa a mesma largada da cronometragem (pergunta e fecha a bateria anterior se ficou aberta)
        BeginInvoke(async () => { await Atualizar(); Bandeira("verde"); await Task.Delay(600); await CarregarEqualizacao(true); });
    }

    void FinalizarEqualizacao()
    {
        if (_eq == null) { Msg.Aviso(this, "Escolha uma equalização."); return; }
        if (_eq.S("state") == "preparando") { Msg.Aviso(this, "Esta equalização ainda não largou."); return; }
        var r = _eq["resultado"] as JsonObject;
        var fora = Crono.Arr(r, "karts").Count(k => k.S("status") == "AJUSTANDO");
        if (!Msg.Pergunta(this, $"Finalizar a equalização \"{_eq.S("name")}\"?\n\nA sessão é encerrada, a meta entra no histórico do traçado" + (fora > 0 ? $" e {fora} kart(s) ainda fora da meta vão para REVISAR (oficina)." : "."))) return;
        Seguro.Rodar(this, async () =>
        {
            await Crono.Api.Post($"/api/equalizacao/{_eq.S("id")}/finalizar");
            await CarregarEqualizacao(true);
            await Atualizar();
            RelatorioEqualizacao();
        });
    }

    void RelatorioEqualizacao()
    {
        if (_eq == null) { Msg.Aviso(this, "Escolha uma equalização."); return; }
        Relatorio.Abrir(this, $"{Config.CronoUrl.TrimEnd('/')}/equalizacao/{Uri.EscapeDataString(_eq.S("id"))}", $"Equalização · {_eq.S("name")}");
    }

    /// <summary>Imprimir o volta a volta só do piloto selecionado (resultado, passagens ou lista de competidores).</summary>
    void ImprimirVoltaAVoltaDoPiloto(string kart = null)
    {
        if (_sess == null) { Msg.Aviso(this, "Selecione uma bateria."); return; }
        kart ??= KartSelecionado();
        if (string.IsNullOrEmpty(kart)) { Msg.Aviso(this, "Clique no piloto (no resultado, nas passagens ou na lista de competidores) e depois em Imprimir volta a volta."); return; }
        var nome = Crono.Arr(_sess, "competitors").FirstOrDefault(c => c.S("kart") == kart)?.S("name") ?? $"Kart {kart}";
        Relatorio.Abrir(this, $"{Config.CronoUrl.TrimEnd('/')}/resultado/{Uri.EscapeDataString(_sess.S("id"))}?tipo=volta_a_volta&kart={Uri.EscapeDataString(kart)}", $"Volta a volta · {nome} · {_sess.S("name")}");
    }
}
