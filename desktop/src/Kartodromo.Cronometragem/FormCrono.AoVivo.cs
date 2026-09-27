using System.Diagnostics;
using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

public partial class FormCrono
{
    string BandeiraNome(string flag) => flag switch { "green" => "verde", "yellow" => "amarela", "red" => "vermelha", "white" => "branca", "checkered" => "quadriculada", _ => "sem bandeira" };

    void Bandeira(string cor)
    {
        if (_sess == null) { Msg.Aviso(this, "Selecione uma bateria."); return; }
        if (cor == "verde" && _sess.S("state") == "preparando") { Acao("start"); return; }
        var flag = cor switch { "verde" => "verde", "amarela" => "amarela", "vermelha" => "vermelha", "branca" => "branca", "quadriculada" => "quadriculada", _ => "" };
        if (flag.Length == 0) return;
        if (_sess.S("state") is not ("em_andamento" or "bandeira_final")) { Msg.Aviso(this, "A prova precisa estar em andamento para receber uma bandeira."); return; }
        var confirm = cor is "vermelha" or "quadriculada";
        if (confirm && !Msg.Pergunta(this, cor == "vermelha" ? "Dar bandeira vermelha e pausar o cronômetro?" : "Dar bandeira quadriculada e encerrar cada kart na próxima passagem?")) return;
        Seguro.Rodar(this, async () => { await Crono.Api.Post($"/api/sessions/{_sess.S("id")}/flag", new JsonObject { ["flag"] = flag }); await Atualizar(); });
    }

    void LimparPassagens()
    {
        if (_sess == null) { Msg.Aviso(this, "Selecione uma bateria."); return; }
        if (!_laps.Any(p => !p.B("deleted"))) { Msg.Info(this, "Não há passagens para limpar."); return; }
        if (!Msg.Pergunta(this, $"Limpar as passagens da bateria “{_sess.S("name")}”? Elas ficarão no diário e poderão ser restauradas.")) return;
        Seguro.Rodar(this, async () => { await Crono.Api.Post($"/api/sessions/{_sess.S("id")}/passings/clear"); await Atualizar(); });
    }

    void CorrigirPassagem(string acao, bool acima = false)
    {
        if (_sess == null || _gPass.ChaveAtual is not JsonObject passagem) { Msg.Aviso(this, "Selecione uma passagem para corrigir."); return; }
        var frase = acao switch { "delete" => "excluir", "restore" => "restaurar", "invalidate" => "invalidar", _ => "validar" };
        if (!Msg.Pergunta(this, acima ? $"{frase.ToUpperInvariant()} esta passagem e todas as passagens acima dela?" : $"{frase.ToUpperInvariant()} a passagem selecionada?")) return;
        Seguro.Rodar(this, async () =>
        {
            await Crono.Api.Post($"/api/sessions/{_sess.S("id")}/passings/actions", new JsonObject {
                ["action"] = acao,
                ["ids"] = new JsonArray(JsonValue.Create(passagem.S("id"))),
                ["aboveId"] = acima ? passagem.S("id") : null,
            });
            await Atualizar();
        });
    }

    void IncluirPassagem()
    {
        IncluirPassagemDesign();
    }

    void AtribuirPassagem()
    {
        if (_sess == null || _gPass.ChaveAtual is not JsonObject passagem) { Msg.Aviso(this, "Selecione uma passagem para atribuir."); return; }
        using var dialog = new DialogoDados("Atribuir passagem", "Escolha o número e o nome do competidor", new[] { ("Número do kart", "kart", passagem.S("kart")), ("Competidor", "name", passagem.S("name")) }, new Size(680, 300));
        if (dialog.ShowDialog(this) != DialogResult.OK || !dialog.Confirmado) return;
        Seguro.Rodar(this, async () =>
        {
            await Crono.Api.Post($"/api/sessions/{_sess.S("id")}/passings/{passagem.S("id")}/assign", new JsonObject { ["kart"] = dialog.Valor("kart"), ["name"] = dialog.Valor("name") });
            await Atualizar();
        });
    }

    void CancelarAtribuicao()
    {
        if (_sess == null || _gPass.ChaveAtual is not JsonObject passagem) { Msg.Aviso(this, "Selecione uma passagem."); return; }
        if (!passagem.B("assigned")) { Msg.Aviso(this, "Esta passagem não tem atribuição para cancelar."); return; }
        Seguro.Rodar(this, async () => { await Crono.Api.Post($"/api/sessions/{_sess.S("id")}/passings/{passagem.S("id")}/unassign"); await Atualizar(); });
    }

    void BandeiraPiloto(string flag)
    {
        if (_sess == null) { Msg.Aviso(this, "Selecione uma bateria."); return; }
        var row = _gPilotos.CurrentRow;
        var kart = row?.Cells[0].Value?.ToString();
        if (string.IsNullOrWhiteSpace(kart)) { Msg.Aviso(this, "Selecione um competidor."); return; }
        Seguro.Rodar(this, async () => { await Crono.Api.Post($"/api/sessions/{_sess.S("id")}/flag/{Uri.EscapeDataString(kart)}", new JsonObject { ["flag"] = flag }); await Atualizar(); });
    }

    async Task AdicionarObservacao()
    {
        if (_sess == null) { Msg.Aviso(this, "Selecione uma bateria."); return; }
        var text = !string.IsNullOrWhiteSpace(_txtObservacaoAoVivo.Text) ? _txtObservacaoAoVivo.Text.Trim() : _txtObservacao.Text.Trim();
        if (text.Length == 0) { Msg.Aviso(this, "Escreva a observação da prova."); return; }
        await Crono.Api.Post($"/api/sessions/{_sess.S("id")}/observations", new JsonObject { ["text"] = text, ["author"] = Environment.UserName });
        _txtObservacao.Text = ""; _txtObservacaoAoVivo.Text = "";
        await Atualizar();
    }

    void AtualizarResultadoCompetidores()
    {
        if (_sess == null) { _gResultComp.Preencher([]); _gCategoriaComp.Preencher([]); return; }
        var rows = Crono.Arr(_sess, "standings");
        var ordered = rows.OrderBy(r => r.I("position")).ToList();
        var values = ordered.Select(r => ResultadoLinha(r)).ToList();
        _gResultComp.Preencher(values, ordered.Cast<object>().ToList());
        var category = ordered.OrderBy(r => NomeCategoria(r.S("category"))).ThenBy(r => r.I("position")).ToList();
        _gCategoriaComp.Preencher(category.Select(r =>
        {
            var row = ResultadoLinha(r);
            if (!string.IsNullOrWhiteSpace(r.S("category"))) row[2] = NomeCategoria(r.S("category")) + " · " + row[2];
            return row;
        }).ToList(), category.Cast<object>().ToList());
    }

    static object[] ResultadoLinha(JsonObject r)
    {
        var dl = r.I("position") == 1 ? "" : r.I("gapLaps") > 0 ? $"+{r.I("gapLaps")} volta{(r.I("gapLaps") == 1 ? "" : "s")}" : Crono.Volta(r.L("gapMs"));
        var speed = double.TryParse(r["averageSpeedKmh"]?.ToString(), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var kmh) ? kmh.ToString("0.0", Fmt.Br) : "—";
        return [r.I("position"), r.S("kart"), r.S("name"), r.S("bestLapNumber"), Crono.Volta(r.L("bestLapMs")), r.I("laps"), Crono.Volta(r.L("lastLapMs")), Crono.Volta(r.L("totalMs")), dl, "", speed];
    }

    void EnviarWhatsApp()
    {
        if (_sess == null) { Msg.Aviso(this, "Selecione uma bateria."); return; }
        var text = Uri.EscapeDataString($"Resultado: {_sess.S("name")} · {DateTime.Now:dd/MM/yyyy HH:mm}\n{_gRes.Rows.Cast<DataGridViewRow>().Where(r => !r.IsNewRow).Take(10).Select(r => $"{r.Cells[0].Value}. {r.Cells[2].Value} · kart {r.Cells[1].Value}").Aggregate("", (a, b) => a + "\n" + b)}");
        Process.Start(new ProcessStartInfo("https://wa.me/?text=" + text) { UseShellExecute = true });
    }

    void EnviarEmail()
    {
        if (_sess == null) { Msg.Aviso(this, "Selecione uma bateria."); return; }
        var subject = Uri.EscapeDataString("Resultado da prova · " + _sess.S("name"));
        var body = Uri.EscapeDataString(string.Join("\r\n", _gRes.Rows.Cast<DataGridViewRow>().Where(r => !r.IsNewRow).Select(r => $"{r.Cells[0].Value}. {r.Cells[2].Value} · kart {r.Cells[1].Value}")));
        Process.Start(new ProcessStartInfo($"mailto:?subject={subject}&body={body}") { UseShellExecute = true });
    }
}
