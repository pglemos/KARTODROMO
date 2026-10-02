using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

/// <summary>Advertências e penalidades de tempo (várias por piloto), bandeira preta, reiniciar a bateria,
/// relargada na bandeira verde e copiar/colar só a célula na lista de competidores.</summary>
public partial class FormCrono
{
    const string SvgPenalidade = "M12 3l9 16H3zM12 9v4M12 16v.5";
    const string CorPenalidade = "linear-gradient(180deg, #FF7A6B, #E0342A)";
    /// <summary>Amarelo da lista de competidores: o kart ainda não passou na linha nesta bateria.</summary>
    static readonly Color AmareloNaoPassou = Color.FromArgb(255, 241, 168);

    /// <summary>Kart do piloto escolhido: resultado ao vivo, passagens ou lista de competidores.</summary>
    string KartSelecionado()
    {
        var kart = _abas.SelectedIndex == 1 ? _gPilotos.CurrentRow?.Cells["kart"].Value?.ToString() : null;
        if (string.IsNullOrEmpty(kart)) kart = (_gRes.ChaveAtual as JsonObject)?.S("kart");
        if (string.IsNullOrEmpty(kart)) kart = (_gPass.ChaveAtual as JsonObject)?.S("kart");
        if (string.IsNullOrEmpty(kart)) kart = (_gResultComp.ChaveAtual as JsonObject)?.S("kart");
        return kart;
    }

    /// <summary>Advertência (preta e branca) ou penalidade de tempo. Cada clique é uma nova: o piloto pode receber várias.
    /// A janela também lista as que ele já tem, para retirar uma dada por engano.</summary>
    void AplicarPenalidade(string tipo, string kart = null)
    {
        if (_sess == null) { Msg.Aviso(this, "Selecione uma bateria."); return; }
        kart ??= KartSelecionado();
        if (string.IsNullOrEmpty(kart)) { Msg.Aviso(this, "Clique no piloto (no resultado, nas passagens ou na lista de competidores) e depois na advertência ou na penalidade."); return; }
        var comp = Crono.Arr(_sess, "competitors").FirstOrDefault(c => c.S("kart") == kart);
        if (comp == null) { Msg.Aviso(this, $"O kart {kart} não está nesta bateria."); return; }
        var tempo = tipo == "tempo";
        using var d = NovoDialogo(tempo ? "Penalidade de tempo" : "Advertência", $"{comp.S("name")} · kart {kart} · {_sess.S("name")}", SvgPenalidade, CorPenalidade, 900, 660);
        var g = d.Secao(tempo ? "Nova penalidade" : "Nova advertência", tempo
            ? "Os segundos somam no tempo oficial: na corrida, no tempo de chegada; na tomada de tempo e no treino, na melhor volta. A posição muda na hora."
            : "Bandeira preta e branca. Fica registrada no resultado e no relatório; não muda a posição.");
        // texto padrão: só o kart atingido e a curva são digitados; o kart penalizado e a volta já vêm prontos
        var segundos = Txt("5", 6);
        var atingido = Txt("", 6);
        var curva = Txt("", 20);
        var voltaAgora = comp.I("voltaAtual");
        var volta = Txt(voltaAgora > 0 ? voltaAgora.ToString() : "", 4);
        var motivo = Txt("", 160);
        if (tempo) d.Campo(g, "Segundos", segundos, 1);
        d.Campo(g, "Kart atingido (quebrou ou rodou)", atingido, 2); d.Campo(g, "Curva do incidente", curva, tempo ? 2 : 3); d.Campo(g, "Volta", volta, 1);
        d.Campo(g, "Complemento (opcional)", motivo, 6);
        var previa = new Label { AutoSize = true, MaximumSize = new Size(820, 0), Font = new Font("Segoe UI Semibold", 10.4F), ForeColor = PecasDesign.CorTexto, BackColor = Color.White, Margin = new Padding(0, 4, 14, 2) };
        g.Controls.Add(new Label { Text = "Texto que fica gravado no resultado e no relatório", AutoSize = true, Font = PecasDesign.FonteRotulo, ForeColor = Tokens.TextoSecundario, BackColor = Color.White, Margin = new Padding(0, 6, 0, 0) });
        g.SetColumnSpan(g.Controls[^1], 6);
        g.Controls.Add(previa); g.SetColumnSpan(previa, 6);
        string TextoPadrao()
        {
            // mesma frase que o serviço grava (lib/timing/race-engine.ts › textoPadraoPenalidade)
            var a = System.Text.RegularExpressions.Regex.Replace(atingido.Text.Trim(), @"^karts?\s*(n[ºo°.]?\s*)?", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase).TrimStart('0').Trim();
            var c = System.Text.RegularExpressions.Regex.Replace(curva.Text.Trim(), @"^(na\s+)?curva\s*", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase).Trim();
            var prefixo = tempo ? $"PEN +{segundos.Text.Trim().Replace('.', ',')} s" : "ADV";
            var partes = new List<string>();
            if (a.Length > 0 || c.Length > 0)
            {
                partes.Add($"Kart {kart} causou o incidente" + (a.Length > 0 ? $" frente ao kart {a}" : ""));
                if (c.Length > 0) partes.Add($"na curva {c}");
            }
            else partes.Add($"Kart {kart}");
            if (int.TryParse(volta.Text.Trim(), out var v) && v > 0) partes.Add($"volta {v}");
            return $"{prefixo}: {string.Join(", ", partes)}." + (motivo.Text.Trim().Length > 0 ? " " + motivo.Text.Trim() : "");
        }
        void AtualizarPrevia() => previa.Text = TextoPadrao();
        foreach (var caixa in new[] { segundos, atingido, curva, volta, motivo }) caixa.TextChanged += (_, _) => AtualizarPrevia();
        AtualizarPrevia();
        d.Shown += (_, _) => atingido.Focus();

        // as que o piloto já tem (pode retirar uma)
        var lista = new ListBox { Height = 110, BorderStyle = BorderStyle.None, IntegralHeight = false };
        var tem = new List<JsonObject>();
        void Recarregar()
        {
            var atual = Crono.Arr(_sess, "competitors").FirstOrDefault(c => c.S("kart") == kart);
            tem = Crono.Arr(atual, "penalidades");
            lista.Items.Clear();
            foreach (var p in tem)
                lista.Items.Add($"{DateTimeOffset.FromUnixTimeMilliseconds(p.L("wallMs") ?? 0).LocalDateTime:HH:mm}  ·  " +
                    (p.S("texto").Length > 0 ? p.S("texto") : $"{(p.S("tipo") == "tempo" ? $"+{p.S("segundos").Replace('.', ',')} s" : "Advertência")}{(p.S("motivo").Length > 0 ? "  ·  " + p.S("motivo") : "")}"));
            if (tem.Count == 0) lista.Items.Add("Nenhuma até agora.");
        }
        Recarregar();
        var retirar = DialogoDesign.AcaoCampo("Retirar a selecionada");
        retirar.Click += (_, _) => Seguro.Rodar(d, async () =>
        {
            if (lista.SelectedIndex < 0 || lista.SelectedIndex >= tem.Count) { Msg.Aviso(d, "Escolha na lista a advertência ou penalidade a retirar."); return; }
            var p = tem[lista.SelectedIndex];
            if (!Msg.Pergunta(d, $"Retirar \"{lista.SelectedItem}\" de {comp.S("name")}?")) return;
            await Crono.Api.Delete($"/api/sessions/{_sess.S("id")}/penalties/{Uri.EscapeDataString(kart)}/{p.S("id")}");
            await Atualizar(); Recarregar();
        });
        var g2 = d.Secao("Já recebeu nesta bateria");
        lista.Font = PecasDesign.FonteValor; lista.Anchor = AnchorStyles.Left | AnchorStyles.Right; lista.Margin = new Padding(0, 0, 14, 8);
        g2.Controls.Add(lista); g2.SetColumnSpan(lista, 6);
        retirar.Anchor = AnchorStyles.Left; retirar.Margin = new Padding(0, 0, 0, 4);
        g2.Controls.Add(retirar); g2.SetColumnSpan(retirar, 3);

        d.BotaoRodape(tempo ? "Aplicar penalidade" : "Dar advertência", true, () => Seguro.Rodar(d, async () =>
        {
            var corpo = new JsonObject
            {
                ["tipo"] = tipo, ["motivo"] = motivo.Text.Trim(), ["autor"] = Environment.UserName,
                ["kartAtingido"] = atingido.Text.Trim(), ["curva"] = curva.Text.Trim(), ["volta"] = int.TryParse(volta.Text.Trim(), out var vv) && vv > 0 ? vv : null,
            };
            if (atingido.Text.Trim().TrimStart('0') == kart.TrimStart('0') && atingido.Text.Trim().Length > 0) { Msg.Aviso(d, "O kart atingido não pode ser o mesmo que recebe a advertência."); atingido.Focus(); return; }
            if (tempo)
            {
                if (!decimal.TryParse(segundos.Text.Trim().Replace('.', ','), System.Globalization.NumberStyles.Number, Fmt.Br, out var seg) || seg <= 0 || seg > 3600)
                { Msg.Aviso(d, "Digite os segundos da penalidade (ex.: 5 ou 2,5)."); segundos.Focus(); return; }
                corpo["segundos"] = seg;
            }
            await Crono.Api.Post($"/api/sessions/{_sess.S("id")}/penalties/{Uri.EscapeDataString(kart)}", corpo);
            d.DialogResult = DialogResult.OK; d.Close();
            await Atualizar();
        }));
        d.BotaoRodape("Cancelar", false, d.Close);
        d.ShowDialog(this);
    }

    /// <summary>Bandeira preta: o piloto é desclassificado e vai para o último lugar (clique de novo para tirar).</summary>
    void BandeiraPreta(string kart = null)
    {
        if (_sess == null) { Msg.Aviso(this, "Selecione uma bateria."); return; }
        kart ??= KartSelecionado();
        if (string.IsNullOrEmpty(kart)) { Msg.Aviso(this, "Clique no piloto e depois na bandeira preta."); return; }
        var comp = Crono.Arr(_sess, "competitors").FirstOrDefault(c => c.S("kart") == kart);
        if (comp == null) { Msg.Aviso(this, $"O kart {kart} não está nesta bateria."); return; }
        var tem = comp.S("flag") == "black";
        if (!Msg.Pergunta(this, tem
            ? $"Tirar a bandeira preta de {comp.S("name")} (kart {kart})?\n\nEle volta para a posição pelos tempos."
            : $"Bandeira preta para {comp.S("name")} (kart {kart})?\n\nEle fica DESCLASSIFICADO e vai para o último lugar no resultado e no relatório.")) return;
        Seguro.Rodar(this, async () =>
        {
            await Crono.Api.Post($"/api/sessions/{_sess.S("id")}/flag/{Uri.EscapeDataString(kart)}", new JsonObject { ["flag"] = tem ? "none" : "black", ["autor"] = Environment.UserName });
            await Atualizar();
        });
    }

    /// <summary>Reiniciar a bateria: zera passagens, bandeiras e penalidades (as passagens ficam no diário). Pode já armar a verde.</summary>
    void ReiniciarBateria()
    {
        if (_sess == null) { Msg.Aviso(this, "Selecione uma bateria."); return; }
        var passagens = _laps.Count(p => !p.B("deleted") && !p.B("rejected"));
        using var d = NovoDialogo("Reiniciar bateria", _sess.S("name"), "M4 12a8 8 0 1 0 2.3-5.7M4 4v4.5h4.5", "linear-gradient(180deg, #FFB547, #F07A00)", 720, 420);
        d.Secao(null, $"A bateria volta ao começo, como se não tivesse largado: {passagens} passagem(ns), as bandeiras dos pilotos, as advertências e as penalidades são zeradas. Os pilotos e os números dos karts continuam.");
        d.Nota("As passagens não se perdem: continuam no diário e podem ser restauradas. Fica registrado nas observações da bateria.");
        async Task Rodar(bool largar)
        {
            if (largar)
            {
                var aberta = _state?.S("runningId");
                if (!string.IsNullOrEmpty(aberta) && aberta != _sess.S("id")) { Msg.Aviso(d, "Outra bateria está aberta. Finalize ela antes de largar esta."); return; }
            }
            await Crono.Api.Post($"/api/sessions/{_sess.S("id")}/restart", new JsonObject { ["largar"] = largar, ["autor"] = Environment.UserName });
            d.DialogResult = DialogResult.OK; d.Close();
            if (largar) _fixado = false;
            await Atualizar();
        }
        d.BotaoRodape("Reiniciar e dar a verde", true, () => Seguro.Rodar(d, () => Rodar(true)));
        d.BotaoRodape("Só reiniciar", false, () => Seguro.Rodar(d, () => Rodar(false)));
        d.BotaoRodape("Cancelar", false, d.Close);
        d.ShowDialog(this);
    }

    /// <summary>Verde com a prova já correndo: relargar (o tempo recomeça no 1º kart que passar) ou só pista liberada.</summary>
    void VerdeComProvaCorrendo()
    {
        using var d = NovoDialogo("Bandeira verde", _sess.S("name"), "M5 21V4h11l-2 4 2 4H5", "linear-gradient(180deg, #5EDB7A, #1E9E4A)", 720, 420);
        d.Secao("Relargada", "Zera o tempo e as voltas desta bateria. O cronômetro recomeça quando o 1º kart passar na linha de chegada (as passagens de antes ficam no diário).");
        d.Secao("Só bandeira verde", "Pista liberada depois da amarela ou da vermelha: o tempo e as voltas continuam.");
        async Task Enviar(bool relargar)
        {
            await Crono.Api.Post($"/api/sessions/{_sess.S("id")}/flag", new JsonObject { ["flag"] = "verde", ["relargar"] = relargar, ["autor"] = Environment.UserName });
            d.DialogResult = DialogResult.OK; d.Close();
            await Atualizar();
        }
        d.BotaoRodape("Relargar (zerar o tempo)", true, () => Seguro.Rodar(d, () => Enviar(true)));
        d.BotaoRodape("Só bandeira verde", false, () => Seguro.Rodar(d, () => Enviar(false)));
        d.BotaoRodape("Cancelar", false, d.Close);
        d.ShowDialog(this);
    }

    /// <summary>Ctrl+C copia só a coluna da célula escolhida (das linhas selecionadas) e Ctrl+V cola na coluna da célula
    /// (antes copiava a linha inteira e colava tudo numa caixa só).</summary>
    void ConfigurarCopiarColar(DataGridView grade)
    {
        grade.MultiSelect = true;
        grade.ClipboardCopyMode = DataGridViewClipboardCopyMode.Disable;
        grade.KeyDown += (_, e) =>
        {
            if (!e.Control || grade.CurrentCell == null || grade.IsCurrentCellInEditMode) return;
            if (e.KeyCode == Keys.C) { CopiarColuna(grade); e.Handled = e.SuppressKeyPress = true; }
            else if (e.KeyCode == Keys.V) { ColarNaColuna(grade); e.Handled = e.SuppressKeyPress = true; }
        };
        // colando dentro da caixa de edição: só o primeiro valor (texto vindo do Excel com várias colunas/linhas)
        grade.EditingControlShowing += (_, e) =>
        {
            if (e.Control is not TextBox tb || tb.Tag as string == "colar") return;
            tb.Tag = "colar";
            tb.KeyDown += (_, k) =>
            {
                if (!k.Control || k.KeyCode != Keys.V || !Clipboard.ContainsText()) return;
                var texto = Clipboard.GetText();
                if (!texto.Contains('\t') && !texto.Contains('\n')) return;
                tb.SelectedText = texto.Replace("\r", "").Split('\n')[0].Split('\t')[0].Trim();
                k.Handled = k.SuppressKeyPress = true;
            };
        };
    }

    static void CopiarColuna(DataGridView grade)
    {
        var col = grade.CurrentCell.ColumnIndex;
        var linhas = grade.SelectedRows.Cast<DataGridViewRow>().Where(r => !r.IsNewRow).OrderBy(r => r.Index).ToList();
        if (linhas.Count == 0) linhas = [grade.CurrentRow];
        var texto = string.Join("\r\n", linhas.Select(r => r.Cells[col].Value?.ToString() ?? ""));
        try { if (texto.Length == 0) Clipboard.Clear(); else Clipboard.SetText(texto); } catch { /* área de transferência ocupada por outro programa */ }
    }

    static void ColarNaColuna(DataGridView grade)
    {
        string texto;
        try { texto = Clipboard.ContainsText() ? Clipboard.GetText() : null; } catch { return; }
        if (texto == null) return;
        var col = grade.CurrentCell.ColumnIndex;
        if (grade.Columns[col].ReadOnly) { System.Media.SystemSounds.Beep.Play(); return; }
        var valores = texto.Replace("\r", "").TrimEnd('\n').Split('\n').Select(l => l.Split('\t')[0].Trim()).ToList();
        var selecionadas = grade.SelectedRows.Cast<DataGridViewRow>().Where(r => !r.IsNewRow).OrderBy(r => r.Index).ToList();
        // um valor e várias linhas selecionadas: o mesmo valor em todas (ex.: a categoria de vários pilotos)
        var alvo = valores.Count == 1 && selecionadas.Count > 1
            ? selecionadas.Select(r => (r, valores[0])).ToList()
            : valores.Select((v, i) => (grade.CurrentCell.RowIndex + i, v)).Where(x => x.Item1 < grade.Rows.Count && !grade.Rows[x.Item1].IsNewRow).Select(x => (grade.Rows[x.Item1], x.v)).ToList();
        foreach (var (linha, valor) in alvo) linha.Cells[col].Value = valor;
    }

    /// <summary>Lista de competidores: amarelo até o kart passar na linha nesta bateria; depois fica branco.</summary>
    void PintarPassagemPilotos()
    {
        if (_sess == null) return;
        var passou = Crono.Arr(_sess, "competitors").Where(c => c.B("passou")).Select(c => c.S("kart")).ToHashSet();
        foreach (DataGridViewRow r in _gPilotos.Rows)
        {
            if (r.IsNewRow) continue;
            var cor = passou.Contains(r.Cells["kart"].Value?.ToString() ?? "") ? Color.White : AmareloNaoPassou;
            if (r.DefaultCellStyle.BackColor != cor) r.DefaultCellStyle.BackColor = cor;
        }
    }
}
