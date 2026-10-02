using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

/// <summary>Remontar a bateria pelo diário: quando a prova correu sem a bateria estar aberta, as passagens ficam no
/// diário como "sem bateria". Esta janela mostra as do horário e reconstrói o resultado como se tivesse sido
/// cronometrado ao vivo (a quadriculada entra quando o líder cruza a linha depois do tempo da prova).</summary>
public partial class FormCrono
{
    void RemontarPeloDiario()
    {
        if (_sess == null) { Msg.Aviso(this, "Selecione a bateria que correu sem estar aberta."); return; }
        if (_sess.S("state") is "em_andamento" or "bandeira_final") { Msg.Aviso(this, "Esta bateria está aberta: as passagens já estão sendo contadas."); return; }
        if (Crono.Arr(_sess, "standings").Any(s => s.I("laps") > 0)) { Msg.Aviso(this, "Esta bateria já tem voltas. Para remontar pelo diário, use antes Reiniciar bateria."); return; }
        var id = _sess.S("id");
        using var d = NovoDialogo("Remontar pelo diário", $"{_sess.S("name")} · a prova correu sem a bateria aberta", "M4 12a8 8 0 1 0 2.3-5.7M4 4v4.5h4.5M12 8v4l3 2", "linear-gradient(180deg, #6CB8FF, #1E6FE8)", 860, 640);
        var inicio = Txt("", 8); var fim = Txt("", 8);
        var outros = new CheckBox { Text = "Incluir karts que não estão na lista desta bateria" };
        var lista = new ListBox { Height = 190, BorderStyle = BorderStyle.None, IntegralHeight = false, Font = PecasDesign.FonteValor, Anchor = AnchorStyles.Left | AnchorStyles.Right, Margin = new Padding(0, 0, 14, 8) };
        var resumo = new Label { AutoSize = true, MaximumSize = new Size(780, 0), Font = new Font("Segoe UI Semibold", 10F), ForeColor = PecasDesign.CorTexto, BackColor = Color.White, Margin = new Padding(0, 0, 14, 6) };
        var dia = DateTime.Today;
        long de = 0, ate = 0;
        var g = d.Secao("Horário da prova", "As passagens deste horário que ficaram sem bateria viram as voltas desta prova. Ajuste o início e o fim se precisar e clique em Conferir.");
        var conferir = DialogoDesign.AcaoCampo("Conferir");
        d.Campo(g, "Início (hh:mm:ss)", inicio, 2); d.Campo(g, "Fim (hh:mm:ss)", fim, 2, conferir);
        d.Marca(g, outros, 6, false);
        var g2 = d.Secao("Passagens encontradas");
        g2.Controls.Add(resumo); g2.SetColumnSpan(resumo, 6);
        g2.Controls.Add(lista); g2.SetColumnSpan(lista, 6);
        d.Nota("A bandeira quadriculada entra quando o líder cruza a linha depois do tempo da prova (na tomada de tempo, quando o tempo acaba). As passagens continuam no diário: se o resultado não ficar certo, use Reiniciar bateria e remonte de novo.");

        static string Hora(long ms) => DateTimeOffset.FromUnixTimeMilliseconds(ms).LocalDateTime.ToString("HH:mm:ss");
        long ParaMs(string texto, long padrao)
        {
            if (!TimeSpan.TryParse(texto.Trim(), out var t)) return padrao;
            return new DateTimeOffset(dia.Add(t)).ToUnixTimeMilliseconds();
        }
        async Task Carregar(bool usarDigitado)
        {
            var q = usarDigitado ? $"?de={ParaMs(inicio.Text, de)}&ate={ParaMs(fim.Text, ate)}" : "";
            var r = (await Crono.Api.Get($"/api/sessions/{id}/diario{q}"))?.AsObject();
            de = r?.L("de") ?? 0; ate = r?.L("ate") ?? 0;
            if (!usarDigitado)
            {
                // sugestão: da primeira à última passagem dos karts da lista
                var daLista = Crono.Arr(r, "karts").Where(k => k.B("naLista")).ToList();
                if (daLista.Count > 0) { de = daLista.Min(k => k.L("primeira") ?? de) - 1000; ate = daLista.Max(k => k.L("ultima") ?? ate) + 1000; }
                dia = DateTimeOffset.FromUnixTimeMilliseconds(de).LocalDateTime.Date;
                inicio.Text = Hora(de); fim.Text = Hora(ate);
            }
            lista.Items.Clear();
            var karts = Crono.Arr(r, "karts");
            foreach (var k in karts)
                lista.Items.Add($"Kart {k.S("kart").PadLeft(2, '0')}  ·  {(k.B("naLista") ? k.S("piloto") : "fora da lista")}  ·  {k.I("passagens")} passagens  ·  {Hora(k.L("primeira") ?? 0)} a {Hora(k.L("ultima") ?? 0)}");
            var naLista = karts.Where(k => k.B("naLista")).ToList();
            resumo.Text = karts.Count == 0 ? "Nenhuma passagem sem bateria nesse horário."
                : $"{naLista.Sum(k => k.I("passagens"))} passagens de {naLista.Count} kart(s) da lista" + (karts.Count > naLista.Count ? $" · {karts.Count - naLista.Count} kart(s) fora da lista" : "");
        }
        conferir.Click += (_, _) => Seguro.Rodar(d, () => Carregar(true));
        d.Shown += (_, _) => Seguro.Rodar(d, () => Carregar(false));
        d.BotaoRodape("Remontar resultado", true, () => Seguro.Rodar(d, async () =>
        {
            var a = ParaMs(inicio.Text, de); var b = ParaMs(fim.Text, ate);
            if (b <= a) { Msg.Aviso(d, "O fim precisa ser depois do início."); fim.Focus(); return; }
            if (!Msg.Pergunta(d, $"Remontar \"{_sess.S("name")}\" com as passagens de {Hora(a)} a {Hora(b)}?\n\nO resultado passa a valer como oficial (fica registrado nas observações).")) return;
            await Crono.Api.Post($"/api/sessions/{id}/remontar", new JsonObject { ["de"] = a, ["ate"] = b, ["incluirOutros"] = outros.Checked, ["autor"] = Environment.UserName });
            d.DialogResult = DialogResult.OK; d.Close();
            await Atualizar();
            Msg.Info(this, "Resultado remontado. Confira a classificação; o e-mail dos pilotos não é enviado sozinho (use Relatórios › Enviar resultado por e-mail).");
        }));
        d.BotaoRodape("Cancelar", false, d.Close);
        d.ShowDialog(this);
    }
}
