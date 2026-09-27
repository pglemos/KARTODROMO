using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

/// <summary>
/// Telas do canvas que faltavam: Registro de competidor (Competidor), Ranking por peso (RankingPeso) e
/// Segurança — usuários, perfis de acesso e permissões (SegUsuario, SegPerfil, Permissoes). Os usuários são os
/// mesmos da recepção (servidor da operação); mexer neles pede o login de um administrador.
/// </summary>
public partial class FormCrono
{
    // ------------------------------------------------------------------ registro de competidor

    /// <summary>"Editar" da lista de pilotos: abre o Registro de competidor (salva antes o que foi digitado na lista).</summary>
    void EditarCompetidor()
    {
        if (_gPilotos.CurrentRow == null || _gPilotos.CurrentRow.IsNewRow) { Msg.Aviso(this, "Clique no competidor."); return; }
        if (_pilotosSujos) { Msg.Aviso(this, "Salve a lista de competidores antes de abrir o registro do competidor."); return; }
        RegistroCompetidorSelecionado();
    }

    /// <summary>Competidor selecionado na lista de pilotos (passos 4–5) ou no resultado ao vivo.</summary>
    void RegistroCompetidorSelecionado()
    {
        if (_sess == null) { Msg.Aviso(this, "Selecione uma bateria."); return; }
        var comps = Crono.Arr(_sess, "competitors");
        var kart = _gPilotos.CurrentRow is { Index: >= 0 } r && !r.IsNewRow ? r.Cells[0].Value?.ToString() : _gRes.ChaveAtual is JsonObject st ? st.S("kart") : null;
        var nome = _gPilotos.CurrentRow is { Index: >= 0 } r2 && !r2.IsNewRow ? r2.Cells[1].Value?.ToString() : null;
        var i = comps.FindIndex(c => (kart != null && c.S("kart") == kart && kart.Length > 0) || (nome != null && c.S("name") == nome));
        if (i < 0) { Msg.Aviso(this, "Selecione o competidor na lista."); return; }
        RegistroCompetidor(i);
    }

    void RegistroCompetidor(int indice)
    {
        if (_sess == null) return;
        var comps = Crono.Arr(_sess, "competitors");
        if (indice < 0 || indice >= comps.Count) return;
        var c = comps[indice];
        var det = c["detalhes"] as JsonObject ?? new JsonObject();
        using var d = NovoDialogo("Registro de competidor", $"Piloto dentro da prova · {c.S("name")} (kart {c.S("kart")})", "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0", "linear-gradient(180deg, #6CB8FF, #1E6FE8)");
        string Num(string k) => det[k] is JsonNode n && double.TryParse(n.ToString(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var v) ? v.ToString("0.00", Fmt.Br) : "";
        var categoria = new ListaDesign();
        categoria.Items.Add(new Campos.Item(0, "(sem categoria)"));
        foreach (var cat in Crono.Arr(_catalog, "categories")) categoria.Items.Add(new Campos.Item(categoria.Items.Count, cat.S("name"), cat));
        categoria.SelectedIndex = Math.Max(0, Enumerable.Range(0, categoria.Items.Count).FirstOrDefault(i => (categoria.Items[i] as Campos.Item)?.Dados is JsonObject o && (o.S("id") == c.S("category") || o.S("name") == c.S("category")), 0));
        var kart = Txt(c.S("kart"), 6);
        var transp = Txt(TransponderDoKart(c.S("kart")), 12);
        var sexo = new ListaDesign(); sexo.Items.AddRange(["Não informado", "Masculino", "Feminino"]);
        sexo.SelectedIndex = det.S("sexo") switch { "Masculino" or "M" => 1, "Feminino" or "F" => 2, _ => 0 };
        var iniciais = Txt(det.S("iniciais") is { Length: > 0 } ini ? ini : Iniciais(c.S("name")), 5);
        var nome = Txt(c.S("name"), 120);
        var email = Txt(det.S("email"), 160);
        var patrocinador = Txt(det.S("patrocinador")); var clube = Txt(det.S("clube")); var cidade = Txt(det.S("cidade"));
        var estado = new ListaDesign(); estado.Items.Add("");
        estado.Items.AddRange(["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"]);
        estado.SelectedItem = det.S("estado"); if (estado.SelectedIndex < 0) estado.SelectedIndex = 0;
        var pais = new ListaDesign(); pais.Items.AddRange(["Brasil", "Argentina", "Paraguai", "Uruguai", "Chile", "Portugal", "Estados Unidos", "Outro"]);
        pais.SelectedItem = det.S("pais") is { Length: > 0 } p ? p : "Brasil"; if (pais.SelectedIndex < 0) pais.SelectedIndex = 0;
        var box = Txt(det.S("box"), 20);
        var peso = Txt(Num("peso"), 7); var pesoInd = Txt(Num("pesoIndumentaria"), 7); var pesoLastro = Txt(Num("pesoLastro"), 7);
        var pontuacao = Txt(det["pontuacao"]?.ToString() ?? "0", 6);
        var oculto = new CheckBox { Text = "Ocultar nos resultados", Checked = det.B("oculto"), AutoSize = true };
        var grupo = new CheckBox { Text = "Aplicar alterações nas demais provas do grupo", Checked = true, AutoSize = true };
        var g = d.Secao("Competidor");
        d.Campo(g, "Categoria", categoria, 2); d.Campo(g, "Nº (kart)", kart, 1); d.Campo(g, "Transponder", transp, 1); d.Campo(g, "Sexo", sexo, 1); d.Campo(g, "Iniciais", iniciais, 1);
        d.Campo(g, "Nome", nome, 3); d.Campo(g, "E-mail", email, 3);
        d.Campo(g, "Patrocinador", patrocinador, 2); d.Campo(g, "Clube", clube, 1); d.Campo(g, "Cidade", cidade, 1); d.Campo(g, "Estado", estado, 1); d.Campo(g, "País", pais, 1);
        d.Campo(g, "Box", box, 1); d.Campo(g, "Peso (kg)", peso, 1); d.Campo(g, "Peso indumentária", pesoInd, 1); d.Campo(g, "Peso lastro", pesoLastro, 1); d.Campo(g, "Pontuação", pontuacao, 2);
        d.Marca(g, oculto, 3, false); d.Marca(g, grupo, 3, false);
        var eq = d.Secao("Equipe (provas de revezamento)");
        var tab = new TabelaDesign { Dock = DockStyle.Fill, Height = 100, MaxLinhas = 4 };
        tab.Colunas(new("Piloto", 120), new("Transponder", 200, Editavel: true), new("Competidor", 600, Editavel: true));
        var equipe = det["equipe"] as JsonArray;
        tab.Linhas(Enumerable.Range(2, 2).Select(n => new[] { $"{n}º", "", equipe != null && equipe.Count > n - 2 ? equipe[n - 2]?.ToString() ?? "" : "" }));
        eq.Controls.Add(tab); eq.SetColumnSpan(tab, 6);
        // peso do cadastro da recepção quando a cronometragem ainda não tem
        if (peso.Text.Length == 0 && c.S("customerId") is { Length: > 0 } cid)
            _ = Task.Run(async () =>
            {
                try
                {
                    var r = await Crono.Api.Lista("/api/clientes?ids=" + cid);
                    if (r.FirstOrDefault()?.S("peso") is { Length: > 0 } pk && double.TryParse(pk, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var kg) && kg > 0)
                        d.BeginInvoke(() => { if (peso.Text.Length == 0) peso.Text = kg.ToString("0.00", Fmt.Br); if (email.Text.Length == 0) email.Text = r[0].S("email"); if (cidade.Text.Length == 0) cidade.Text = r[0].S("cidade"); });
                }
                catch { }
            });

        d.BotaoRodape("Gravar", true, () => Seguro.Rodar(d, async () =>
        {
            if (nome.Text.Trim().Length == 0) { Msg.Aviso(d, "Informe o nome do competidor."); return; }
            double? N(TextBox t) => double.TryParse(t.Text.Trim().Replace(".", ","), System.Globalization.NumberStyles.Any, Fmt.Br, out var v) ? v : null;
            var eqArr = new JsonArray(); foreach (var l in tab.Dados) if (l[2].Trim().Length > 0) eqArr.Add(l[2].Trim());
            var body = new JsonObject
            {
                ["kart"] = kart.Text.Trim(), ["name"] = nome.Text.Trim(),
                ["category"] = (categoria.SelectedItem as Campos.Item)?.Dados?.S("id") is { Length: > 0 } cat ? cat : null,
                ["aplicarGrupo"] = grupo.Checked,
                ["detalhes"] = new JsonObject
                {
                    ["sexo"] = sexo.SelectedIndex switch { 1 => "Masculino", 2 => "Feminino", _ => "" }, ["iniciais"] = iniciais.Text.Trim(), ["email"] = email.Text.Trim(),
                    ["patrocinador"] = patrocinador.Text.Trim(), ["clube"] = clube.Text.Trim(), ["cidade"] = cidade.Text.Trim(), ["estado"] = estado.SelectedItem?.ToString() ?? "",
                    ["pais"] = pais.SelectedItem?.ToString() ?? "", ["box"] = box.Text.Trim(), ["peso"] = N(peso), ["pesoIndumentaria"] = N(pesoInd), ["pesoLastro"] = N(pesoLastro),
                    ["pontuacao"] = N(pontuacao), ["oculto"] = oculto.Checked, ["equipe"] = eqArr,
                },
            };
            var r = await Crono.Api.Put($"/api/sessions/{_sess.S("id")}/competitors/{indice}", body);
            // transponder digitado aqui vale para o kart (tabela De/Para)
            var tr = new string(transp.Text.Where(char.IsDigit).ToArray());
            if (tr.Length > 0 && tr != TransponderDoKart(kart.Text.Trim()) && kart.Text.Trim().Length > 0)
                await Crono.Api.Put("/api/transponders", new JsonObject { ["raw"] = tr, ["kart"] = kart.Text.Trim() });
            d.DialogResult = DialogResult.OK; d.Close();
            await Atualizar();
            if (r?.I("outras") is int o && o > 0) Msg.Info(this, $"Gravado também em mais {o} prova(s) do grupo.");
        }));
        d.BotaoRodape("Cancelar", false, d.Close);
        d.BotaoRodape("Excluir", false, () => Seguro.Rodar(d, async () =>
        {
            if (!Msg.Pergunta(d, $"Tirar {c.S("name")} desta bateria?\n\nAs voltas já registradas desse kart deixam de ter piloto.")) return;
            var lista = new JsonArray();
            for (var i = 0; i < comps.Count; i++) if (i != indice) lista.Add(new JsonObject { ["kart"] = comps[i].S("kart"), ["name"] = comps[i].S("name"), ["customerId"] = comps[i]["customerId"]?.DeepClone(), ["category"] = comps[i]["category"]?.DeepClone() });
            await Crono.Api.Patch("/api/sessions/" + _sess.S("id"), new JsonObject { ["competitors"] = lista });
            d.DialogResult = DialogResult.OK; d.Close(); await Atualizar();
        }));
        d.BotaoRodape("Imprimir", false, () => ImprimirResumo($"Competidor · {nome.Text.Trim()}", [
            $"Kart: {kart.Text}   Transponder: {transp.Text}   Categoria: {categoria.SelectedItem}", $"Sexo: {sexo.SelectedItem}   Iniciais: {iniciais.Text}   E-mail: {email.Text}",
            $"Patrocinador: {patrocinador.Text}   Clube: {clube.Text}   Cidade: {cidade.Text}/{estado.SelectedItem} · {pais.SelectedItem}",
            $"Box: {box.Text}   Peso: {peso.Text} kg   Indumentária: {pesoInd.Text} kg   Lastro: {pesoLastro.Text} kg   Pontuação: {pontuacao.Text}"]));
        d.ShowDialog(this);
    }

    string TransponderDoKart(string kart) => _transpPorKart.GetValueOrDefault(kart ?? "") ?? "";
    static string Iniciais(string nome) => string.Concat(nome.Split(' ', StringSplitOptions.RemoveEmptyEntries).Where(p => p.Length > 2 || p.Length == 1).Take(3).Select(p => char.ToUpperInvariant(p[0])));

    // ------------------------------------------------------------------ ranking por peso

    void RankingPesoDesign()
    {
        using var d = NovoDialogo("Ranking por peso", "Melhores tempos separados por faixa de peso", "M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z", "linear-gradient(180deg, #FFB547, #F07A00)");
        var top = PecasDesign.Numero(10, 3);
        var mes = new ListaDesign();
        for (var i = 0; i < 13; i++) { var m = DateTime.Today.AddMonths(-i); mes.Items.Add(new Campos.Item(i, m.ToString("MM/yyyy"), new JsonObject { ["v"] = m.ToString("yyyy-MM") })); }
        mes.SelectedIndex = 0;
        var todos = new CheckBox { Text = "Melhores de todos os tempos", AutoSize = true };
        var omitir = new CheckBox { Text = "Omitir tempos abaixo de 00:00:40.000", Checked = true, AutoSize = true };
        var masc = new RadioButton { Text = "Sexo: masculino", Checked = true, AutoSize = true }; var fem = new RadioButton { Text = "Feminino", AutoSize = true }; var nf = new RadioButton { Text = "Não filtrar", AutoSize = true };
        var faixas = new ListaDesign();
        faixas.Items.AddRange([new Campos.Item(0, "Até 75 kg · de 75 a 90 kg · acima de 90 kg", new JsonObject { ["v"] = "75,90" }), new Campos.Item(1, "Até 70 kg · de 70 a 85 kg · de 85 a 100 kg · acima de 100 kg", new JsonObject { ["v"] = "70,85,100" }),
            new Campos.Item(2, "Até 80 kg · acima de 80 kg", new JsonObject { ["v"] = "80" }), new Campos.Item(3, "Todos os pesos juntos", new JsonObject { ["v"] = "" })]);
        faixas.SelectedIndex = 0;
        var tracado = new ListaDesign(); tracado.Items.Add(new Campos.Item(0, "Todos os traçados"));
        foreach (var t in Crono.Arr(_catalog, "tracks")) tracado.Items.Add(new Campos.Item(tracado.Items.Count, t.S("name"), t));
        tracado.SelectedIndex = tracado.Items.Count > 1 ? 1 : 0;
        var categoria = new ListaDesign(); categoria.Items.Add(new Campos.Item(0, "Todas as categorias"));
        foreach (var c in Crono.Arr(_catalog, "categories")) categoria.Items.Add(new Campos.Item(categoria.Items.Count, c.S("name"), c));
        categoria.SelectedIndex = categoria.Items.Count > 1 ? 1 : 0;
        var g = d.Secao(null);
        d.Campo(g, "Top nº", top, 1); d.Campo(g, "Mês / ano", mes, 1); d.Marca(g, todos, 2, true); d.Marca(g, omitir, 2, true);
        d.Opcao(g, masc, 2); d.Opcao(g, fem, 2); d.Opcao(g, nf, 2);
        d.Campo(g, "Agrupar por pesos", faixas, 6);
        d.Campo(g, "Traçado", tracado, 3); d.Campo(g, "Categoria", categoria, 3);
        var f = d.Secao("Filtros por data");
        var usarPeriodo = new CheckBox { Text = "Usar período", AutoSize = true };
        var de = new DataDesign(new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1)); var ate = new DataDesign(DateTime.Today);
        var segunda = new CheckBox { Text = "Ignorar segunda", Checked = true, AutoSize = true };
        var contato = new CheckBox { Text = "Ocultar dados de contato", Checked = true, AutoSize = true };
        var todasCat = new CheckBox { Text = "Gerar para todas as categorias", AutoSize = true };
        d.Marca(f, usarPeriodo, 2, true); d.Campo(f, "De", de, 2); d.Campo(f, "Até", ate, 2);
        d.Marca(f, segunda, 2, false); d.Marca(f, contato, 2, false); d.Marca(f, todasCat, 2, false);

        string Consulta(string categoriaNome) => string.Join("&", new[]
        {
            "top=" + (int.TryParse(top.Text, out var n) && n > 0 ? n : 10),
            usarPeriodo.Checked || todos.Checked ? "" : "mes=" + (mes.SelectedItem as Campos.Item)?.Dados?.S("v"),
            usarPeriodo.Checked && de.Valida ? "de=" + de.Value.ToString("yyyy-MM-dd") : "", usarPeriodo.Checked && ate.Valida ? "ate=" + ate.Value.ToString("yyyy-MM-dd") : "",
            omitir.Checked ? "minimoMs=40000" : "", masc.Checked ? "sexo=M" : fem.Checked ? "sexo=F" : "",
            "faixas=" + Uri.EscapeDataString((faixas.SelectedItem as Campos.Item)?.Dados?.S("v") ?? ""),
            (tracado.SelectedItem as Campos.Item)?.Dados?.S("id") is { Length: > 0 } tid ? "trackId=" + tid : "",
            categoriaNome.Length > 0 ? "categoria=" + Uri.EscapeDataString(categoriaNome) : "", segunda.Checked ? "ignorarSegunda=1" : "",
        }.Where(x => x.Length > 0));

        async Task<string> Montar()
        {
            var cats = todasCat.Checked ? Crono.Arr(_catalog, "categories").Select(c => c.S("id")).Prepend("").Distinct().ToList() : [(categoria.SelectedItem as Campos.Item)?.Dados?.S("id") ?? ""];
            var html = new System.Text.StringBuilder();
            foreach (var cat in cats)
            {
                var r = (await Crono.Api.Get("/api/ranking-peso?" + Consulta(cat)))?.AsObject();
                var nomeCat = cat.Length == 0 ? "Todas as categorias" : Crono.Arr(_catalog, "categories").FirstOrDefault(c => c.S("id") == cat)?.S("name") ?? cat;
                html.Append($"<h2>{WebUtility(nomeCat)}</h2>");
                foreach (var grp in Crono.Arr(r, "grupos"))
                {
                    html.Append($"<h3>{WebUtility(grp.S("titulo"))}</h3>");
                    var linhas = Crono.Arr(grp, "linhas");
                    if (linhas.Count == 0) { html.Append("<p class=v>Nenhum tempo nesse filtro.</p>"); continue; }
                    html.Append("<table><tr><th>Pos.</th><th>Piloto</th><th>Kart</th><th>Melhor volta</th><th>Peso</th><th>Data</th><th>Bateria</th>" + (contato.Checked ? "" : "<th>Contato</th>") + "</tr>");
                    foreach (var l in linhas)
                        html.Append($"<tr><td>{l.I("posicao")}º</td><td>{WebUtility(l.S("nome"))}</td><td>{WebUtility(l.S("kart"))}</td><td class=t>{Crono.Relogio(l.L("melhorMs") ?? 0)}</td><td>{(l.S("pesoKg") is { Length: > 0 } pk ? pk + " kg" : "—")}</td><td>{Fmt.Dmy(l.S("data"))}</td><td>{WebUtility(l.S("bateria"))}</td>" + (contato.Checked ? "" : $"<td>{WebUtility(l.S("contato"))}</td>") + "</tr>");
                    html.Append("</table>");
                }
            }
            var periodo = usarPeriodo.Checked ? $"{de.Value:dd/MM/yyyy} a {ate.Value:dd/MM/yyyy}" : todos.Checked ? "todos os tempos" : mes.Text;
            return "<!doctype html><meta charset=utf-8><title>Ranking por peso</title><style>body{font:14px 'Segoe UI',Arial;margin:28px;color:#1d1d1f}h1{margin:0 0 4px}h2{margin:26px 0 6px;color:#0b7a53}h3{margin:16px 0 6px}table{border-collapse:collapse;width:100%}th,td{padding:6px 8px;border-bottom:1px solid #e5e5ea;text-align:left}th{font-size:12px;color:#6e6e73}.t{font-family:Consolas,monospace;font-weight:700}.v{color:#6e6e73}</style>"
                + $"<h1>Ranking por peso</h1><div class=v>Kartódromo Internacional de Betim · {WebUtility(periodo)} · {(masc.Checked ? "masculino" : fem.Checked ? "feminino" : "todos os sexos")} · top {top.Text}</div>" + html;
        }
        d.BotaoRodape("Gerar relatório", true, () => Seguro.Rodar(d, async () =>
        {
            var html = await Montar();
            var arq = Path.Combine(Path.GetTempPath(), $"ranking-peso-{DateTime.Now:yyyyMMddHHmmss}.html");
            await File.WriteAllTextAsync(arq, html);
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(arq) { UseShellExecute = true });
        }));
        d.BotaoRodape("Gerar post (Instagram)", false, () => Seguro.Rodar(d, async () =>
        {
            // post quadrado 1080×1080: top 5 de cada faixa, fundo escuro com o verde do kartódromo
            var r = (await Crono.Api.Get("/api/ranking-peso?" + Consulta((categoria.SelectedItem as Campos.Item)?.Dados?.S("id") ?? "")))?.AsObject();
            using var bmp = new Bitmap(1080, 1080);
            using (var gr = Graphics.FromImage(bmp))
            {
                gr.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias; gr.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;
                using (var fundo = new System.Drawing.Drawing2D.LinearGradientBrush(new Rectangle(0, 0, 1080, 1080), Color.FromArgb(15, 26, 21), Color.FromArgb(11, 122, 83), 60f)) gr.FillRectangle(fundo, 0, 0, 1080, 1080);
                gr.DrawString("RANKING POR PESO", new Font("Segoe UI", 44F, FontStyle.Bold), Brushes.White, 60, 50);
                gr.DrawString($"Kartódromo Internacional de Betim · {(usarPeriodo.Checked ? $"{de.Value:dd/MM} a {ate.Value:dd/MM}" : mes.Text)}", new Font("Segoe UI", 20F), new SolidBrush(Color.FromArgb(200, 255, 255, 255)), 64, 125);
                var y = 200f;
                foreach (var grp in Crono.Arr(r, "grupos").Where(x => Crono.Arr(x, "linhas").Count > 0).Take(3))
                {
                    gr.DrawString(grp.S("titulo").ToUpperInvariant(), new Font("Segoe UI", 22F, FontStyle.Bold), new SolidBrush(Color.FromArgb(124, 234, 150)), 60, y); y += 44;
                    foreach (var l in Crono.Arr(grp, "linhas").Take(5))
                    {
                        gr.DrawString($"{l.I("posicao")}º  {l.S("nome")}", new Font("Segoe UI", 20F), Brushes.White, 70, y);
                        gr.DrawString(Crono.Relogio(l.L("melhorMs") ?? 0)[3..], new Font("Consolas", 20F, FontStyle.Bold), Brushes.White, 840, y); y += 38;
                    }
                    y += 18;
                }
            }
            var arq = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyPictures), $"ranking-peso-{DateTime.Now:yyyyMMdd-HHmm}.png");
            bmp.Save(arq);
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(arq) { UseShellExecute = true });
        }));
        d.BotaoRodape("Cancelar", false, d.Close);
        d.ShowDialog(this);
    }

    static string WebUtility(string s) => System.Net.WebUtility.HtmlEncode(s ?? "");

    // ------------------------------------------------------------------ segurança (usuários, perfis, permissões)

    /// <summary>Usuários e perfis ficam no servidor da operação (os mesmos da recepção): pede o login de um administrador uma vez.</summary>
    async Task<bool> EntrarComoAdministrador()
    {
        if (!string.IsNullOrEmpty(Api.Servidor.Token)) return true;
        if (_autoteste != null && Environment.GetEnvironmentVariable("KARTODROMO_TESTE_ADMIN") is { Length: > 3 } ta && ta.IndexOf(':') > 0)
        {
            var r0 = await Api.Servidor.Post("/api/login", new JsonObject { ["login"] = ta[..ta.IndexOf(':')], ["senha"] = ta[(ta.IndexOf(':') + 1)..], ["termos"] = true });
            Api.Servidor.Token = r0.S("token");
            return true;
        }
        using var d = NovoDialogo("Entrar como administrador", "Usuários e permissões são os mesmos da recepção", "M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z", "linear-gradient(180deg, #9A9AA0, #4A4A4F)");
        d.ClientSize = new Size(560, 330);
        var login = Txt("", 40); var senha = Txt("", 60); senha.UseSystemPasswordChar = true;
        var g = d.Secao(null);
        d.Campo(g, "Usuário", login, 3); d.Campo(g, "Senha", senha, 3);
        var ok = false;
        d.BotaoRodape("Entrar", true, () => Seguro.Rodar(d, async () =>
        {
            var r = await Api.Servidor.Post("/api/login", new JsonObject { ["login"] = login.Text.Trim(), ["senha"] = senha.Text, ["termos"] = true });
            if (r?["usuario"] is not JsonObject u || !u.B("admin")) { Msg.Aviso(d, "Esse usuário não é administrador."); return; }
            Api.Servidor.Token = r.S("token"); ok = true; d.Close();
        }));
        d.BotaoRodape("Cancelar", false, d.Close);
        d.Shown += (_, _) => login.Focus();
        d.AcceptButton = null;
        d.ShowDialog(this);
        return ok;
    }

    async Task<List<Campos.Item>> Perfis() => (await Api.Servidor.Lista("/api/office/cad/perfis")).Select(p => new Campos.Item(p.L("id") ?? 0, p.S("descricao"), p)).ToList();

    async Task SegUsuario()
    {
        if (!await EntrarComoAdministrador()) return;
        var perfis = await Perfis();
        using var f = new RegistroDesign("Registro de usuário", "Quem pode entrar na cronometragem", "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0", "linear-gradient(180deg, #9A9AA0, #4A4A4F)",
            [new("id", "Código", 1, "int"), new("nome", "Nome", 2), new("login", "Usuário", 1), new("senha", "Senha", 1, "password"), new("perfilId", "Perfil de acesso", 1, "lista", Itens: () => perfis), new("ativo", "Ativo", 1, "bool")],
            [new("Código", 90, r => r.S("id")), new("Nome", 0, r => r.S("nome")), new("Usuário", 170, r => r.S("login")), new("Perfil de acesso", 214, r => r.S("perfil"))],
            FonteReg.Rest(Api.Servidor, "/api/office/cad/usuarios"), ("Permissões", r => { _ = Permissoes(); }))
        { Nome = "usuário", Padrao = () => new JsonObject { ["ativo"] = true, ["perfilId"] = perfis.FirstOrDefault(p => p.Texto == "Cronometragem")?.Id } };
        f.ShowDialog(this);
    }

    async Task SegPerfil()
    {
        if (!await EntrarComoAdministrador()) return;
        using var f = new RegistroDesign("Registro de perfil de acesso", "Grupos de permissões dados aos usuários", "M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z", "linear-gradient(180deg, #9A9AA0, #4A4A4F)",
            [new("id", "Código", 1, "int"), new("descricao", "Descrição", 5)],
            [new("Código", 90, r => r.S("id")), new("Descrição", 0, r => r.S("descricao"))],
            FonteReg.Rest(Api.Servidor, "/api/office/cad/perfis"), ("Permissões", r => { _ = Permissoes(); }))
        { Nome = "perfil", Padrao = () => new JsonObject { ["ativo"] = true } };
        f.ShowDialog(this);
    }

    /// <summary>Funcionalidades de cada módulo (abas da tela Permissões do canvas).</summary>
    static readonly (string Modulo, string[] Funcoes)[] ModulosPermissao =
    [
        ("Segurança", ["Usuários", "Perfis de acesso", "Permissões", "Trocar a própria senha"]),
        ("Cadastro", ["Clientes", "Produtos e provas", "Traçados", "Feriados", "Turnos e terminais", "Itens de manutenção"]),
        ("Ferramentas", ["Parâmetros do sistema", "Padrões de reservas", "Criar reservas do mês", "Dados da empresa"]),
        ("Serviços", ["Serviços online", "Pré-cadastro online", "Sorteio de karts (tablet)"]),
        ("Relatórios", ["Relatórios financeiros", "Fechamento de caixa", "Lista de participantes", "Agenda mensal", "Relatórios da cronometragem"]),
        ("Financeiro", ["Métodos de pagamento", "Fidelidade", "Vouchers", "Parceiros e comissões"]),
        ("PDV", ["Abrir e fechar terminal", "Receita avulsa (checkout)", "Suprimento e sangria", "Estorno", "Desconto e acréscimo"]),
        ("Cronometragem", ["Bandeiras (largada, quadriculada, finalizar)", "Passagens (incluir, excluir, invalidar)", "Mudar corrida em andamento", "Configuração de eventos", "Registro de competidores", "Enviar resultado (WhatsApp, e-mail)", "Cadastros (decoder, placar, transponder)", "Configurações do sistema"]),
    ];

    async Task Permissoes()
    {
        if (!await EntrarComoAdministrador()) return;
        var perfis = await Perfis();
        if (perfis.Count == 0) { Msg.Aviso(this, "Cadastre um perfil de acesso primeiro."); return; }
        using var d = NovoDialogo("Permissões de acesso", "O que cada perfil pode fazer", "M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z", "linear-gradient(180deg, #9A9AA0, #4A4A4F)");
        var perfil = new ListaDesign(); perfil.Items.AddRange(perfis.ToArray());
        perfil.SelectedIndex = Math.Max(0, perfis.FindIndex(p => p.Texto == "Cronometragem"));
        var total = new CheckBox { Text = "Acesso total", AutoSize = true };
        var cab = d.Secao(null);
        d.Campo(cab, "Perfil", perfil, 3); d.Marca(cab, total, 3, true);
        var sec = d.Secao(null);
        var tab = new TabelaDesign { Dock = DockStyle.Fill, Height = 300, MaxLinhas = 9, MarcasEditaveis = true };
        tab.Colunas(new("Funcionalidade", 420), new("Acessar", 80, Marca: true, Centro: true), new("Incluir", 80, Marca: true, Centro: true), new("Alterar", 80, Marca: true, Centro: true),
            new("Excluir", 80, Marca: true, Centro: true), new("Exportar", 80, Marca: true, Centro: true), new("Importar", 80, Marca: true, Centro: true));
        sec.Controls.Add(tab); sec.SetColumnSpan(tab, 6);
        // estado: perfil → módulo → função → 6 marcas
        var estado = new Dictionary<string, bool[]>();
        var modulo = ModulosPermissao.Length - 1; // abre na aba Cronometragem, como no canvas
        string Chave(string m, string f) => m + "|" + f;
        void Mostrar()
        {
            var (m, funcoes) = ModulosPermissao[modulo];
            tab.Linhas(funcoes.Select(f => { var v = estado.GetValueOrDefault(Chave(m, f)) ?? new bool[6]; return new[] { f }.Concat(v.Select(b => b ? "Sim" : "Não")).ToArray(); }));
        }
        tab.MarcaMudou += (l, c) =>
        {
            var (m, funcoes) = ModulosPermissao[modulo];
            var v = estado.TryGetValue(Chave(m, funcoes[l]), out var a) ? a : estado[Chave(m, funcoes[l])] = new bool[6];
            v[c - 1] = tab.Dados[l][c] == "Sim";
        };
        async Task Carregar()
        {
            estado.Clear();
            var r = (await Api.Servidor.Get($"/api/office/permissoes?perfilId={(perfil.SelectedItem as Campos.Item)?.Id}"))?.AsObject();
            total.Checked = r?["perfil"]?.AsObject().B("acessoTotal") ?? false;
            foreach (var it in Crono.Arr(r, "itens"))
                estado[Chave(it.S("modulo"), it.S("funcao"))] = [it.B("acessar"), it.B("incluir"), it.B("alterar"), it.B("excluir"), it.B("exportar"), it.B("importar")];
            Mostrar();
        }
        d.Abas(ModulosPermissao.Select(x => x.Modulo).ToArray(), i => { modulo = i; Mostrar(); }, modulo);
        perfil.SelectedIndexChanged += (_, _) => Seguro.Rodar(d, Carregar);
        d.Shown += (_, _) => Seguro.Rodar(d, Carregar);
        d.BotaoRodape("Salvar e fechar", true, () => Seguro.Rodar(d, async () =>
        {
            var itens = new JsonArray();
            foreach (var (m, funcoes) in ModulosPermissao)
                foreach (var f in funcoes)
                {
                    var v = estado.GetValueOrDefault(Chave(m, f)) ?? new bool[6];
                    itens.Add(new JsonObject { ["modulo"] = m, ["funcao"] = f, ["acessar"] = v[0], ["incluir"] = v[1], ["alterar"] = v[2], ["excluir"] = v[3], ["exportar"] = v[4], ["importar"] = v[5] });
                }
            await Api.Servidor.Put("/api/office/permissoes", new JsonObject { ["perfilId"] = (perfil.SelectedItem as Campos.Item)?.Id, ["acessoTotal"] = total.Checked, ["itens"] = itens });
            d.Close();
        }));
        d.BotaoRodape("Cancelar", false, d.Close);
        d.ShowDialog(this);
    }
}
