using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

/// <summary>E-mail do resultado para os pilotos (como o LapTime): o servidor da cronometragem manda sozinho ao
/// finalizar cada tomada de tempo e corrida; aqui ficam a conta de e-mail do kartódromo e o reenvio manual.</summary>
public partial class FormCrono
{
    const string SvgEmail = "M3 6h18v12H3zM3 7l9 6 9-6";
    const string CorEmail = "linear-gradient(180deg, #6CB8FF, #1E6FE8)";

    /// <summary>Ferramentas › E-mail dos resultados: caixa do domínio do kartódromo (HostGator), senha fica só no servidor.</summary>
    void ConfigurarEmail() => Seguro.Rodar(this, async () =>
    {
        var cfg = (await Crono.Api.Get("/api/email-config"))?.AsObject() ?? new JsonObject();
        using var d = NovoDialogo("E-mail dos resultados", "O resultado vai sozinho para cada piloto ao finalizar a tomada de tempo e a corrida", SvgEmail, CorEmail);
        var usuario = Txt(cfg.S("usuario"), 160); usuario.PlaceholderText = "resultados@kartodromodebetim.com.br";
        var senha = Txt("", 200); senha.UseSystemPasswordChar = true;
        senha.PlaceholderText = cfg.B("senhaDefinida") ? "(deixe em branco para manter a senha atual)" : "senha da caixa de e-mail";
        var host = Txt(cfg.S("host") is { Length: > 0 } h ? h : "mail.kartodromodebetim.com.br", 120);
        var porta = Txt(cfg.S("porta") is { Length: > 0 } p ? p : "465", 5);
        var nome = Txt(cfg.S("remetenteNome") is { Length: > 0 } n ? n : "Kartódromo Internacional de Betim", 80);
        var copia = Txt(cfg.S("copiaOculta"), 160); copia.PlaceholderText = "opcional: recebe uma cópia de cada envio";
        var auto = new CheckBox { Text = "Enviar sozinho ao finalizar cada tomada de tempo e cada corrida", Checked = cfg["automatico"] == null || cfg.B("automatico"), AutoSize = true };
        var pdf = new CheckBox { Text = "Anexar os PDFs (resultado oficial e volta a volta do piloto)", Checked = cfg["anexarPdf"] == null || cfg.B("anexarPdf"), AutoSize = true };

        var g = d.Secao("Conta de e-mail do kartódromo");
        d.Campo(g, "E-mail (usuário)", usuario, 3); d.Campo(g, "Senha", senha, 3);
        d.Campo(g, "Servidor de saída (SMTP)", host, 4); d.Campo(g, "Porta", porta, 2);
        var e = d.Secao("Envio");
        d.Campo(e, "Nome que aparece para o piloto", nome, 3); d.Campo(e, "Cópia oculta", copia, 3);
        d.Marca(e, auto, 6); d.Marca(e, pdf, 6);
        d.Nota("Use uma caixa do próprio domínio (criada no painel da HostGator, ex.: resultados@kartodromodebetim.com.br). " +
               "A senha fica guardada só no servidor da cronometragem e não aparece de novo. Porta 465 (SSL) ou 587.");

        JsonObject Corpo() => new()
        {
            ["usuario"] = usuario.Text.Trim(), ["senha"] = senha.Text, ["host"] = host.Text.Trim(), ["porta"] = int.TryParse(porta.Text.Trim(), out var pt) ? pt : 465,
            ["remetenteNome"] = nome.Text.Trim(), ["copiaOculta"] = copia.Text.Trim(), ["automatico"] = auto.Checked, ["anexarPdf"] = pdf.Checked,
        };
        d.BotaoRodape("Salvar", true, () => Seguro.Rodar(d, async () =>
        {
            var r = (await Crono.Api.Put("/api/email-config", Corpo()))?.AsObject();
            Msg.Info(d, r?.B("pronto") == true ? "E-mail dos resultados configurado." : "Salvo. Falta preencher usuário e senha para o envio funcionar.");
            d.DialogResult = DialogResult.OK; d.Close();
        }));
        d.BotaoRodape("Cancelar", false, d.Close);
        d.BotaoRodape("Enviar teste…", false, () => Seguro.Rodar(d, async () =>
        {
            var para = Prompt.Pedir(d, "Mandar um e-mail de teste para qual endereço?", usuario.Text.Trim(), "E-mail de teste");
            if (string.IsNullOrWhiteSpace(para)) return;
            await Crono.Api.Post("/api/email-config/teste", new { config = Corpo(), para = para.Trim() });
            Msg.Info(d, $"E-mail de teste enviado para {para.Trim()}. Confira a caixa de entrada (e o spam).");
        }));
        d.ShowDialog(this);
    });

    /// <summary>Relatórios › E-mail / botão E-mail: situação do envio desta prova e reenvio (todos, um piloto, outro endereço).</summary>
    void EnviarEmail()
    {
        if (_sess == null) { Msg.Aviso(this, "Selecione uma bateria."); return; }
        var id = _sess.S("id");
        var nomeBateria = _sess.S("name");
        var encerrada = _sess.S("state") is "encerrada" or "bandeira_final";
        var kartSel = _gRes.CurrentRow is { IsNewRow: false } row ? row.Cells[1].Value?.ToString() : null;
        var pilotoSel = _gRes.CurrentRow is { IsNewRow: false } row2 ? row2.Cells[2].Value?.ToString() : null;

        using var d = NovoDialogo("Enviar resultado por e-mail", nomeBateria, SvgEmail, CorEmail);
        var situacao = d.SecaoTabelaDesign("Situação do envio desta prova");
        situacao.Colunas(new("Kart", 0.8f), new("Piloto", 3f), new("E-mail", 3.2f), new("Situação", 2.4f));
        situacao.MaxLinhas = 9;
        situacao.Vazio = "Carregando…";
        situacao.Linhas([]);
        var info = d.TextoRodape("");

        async Task Carregar()
        {
            var e = (await Crono.Api.Get($"/api/sessions/{id}/emails")) as JsonObject;
            if (d.IsDisposed) return;
            if (e == null)
            {
                situacao.Vazio = encerrada ? "Nenhum envio registrado para esta prova (o envio automático começou a valer agora)." : "A prova ainda não foi finalizada: o resultado vai sozinho ao finalizar.";
                situacao.Linhas([]); info.Text = ""; return;
            }
            var linhas = new List<string[]>();
            foreach (var x in e["enviados"]?.AsArray() ?? []) { var p = x!.ToString().Split('|', 2); linhas.Add([p[0], NomeDoKart(p[0]), p.ElementAtOrDefault(1) ?? "", "Enviado"]); }
            foreach (var f in (e["falhas"]?.AsArray() ?? []).OfType<JsonObject>()) linhas.Add([f.S("kart"), f.S("nome"), f.S("email"), "Falhou: " + f.S("erro")]);
            foreach (var s in (e["semEmail"]?.AsArray() ?? []).OfType<JsonObject>()) linhas.Add([s.S("kart"), s.S("nome"), "—", "Sem e-mail no cadastro"]);
            situacao.Vazio = "Nenhum piloto nesta prova.";
            situacao.Linhas(linhas);
            var quando = e.L("atualizadoEm") is long ms ? DateTimeOffset.FromUnixTimeMilliseconds(ms).ToLocalTime().ToString("dd/MM HH:mm") : "";
            info.Text = e.S("status") switch
            {
                "enviado" => $"Enviado em {quando}",
                "parcial" => $"Parte não foi ({quando}) — o servidor tenta de novo a cada 5 min",
                "falhou" => $"Não foi enviado ({quando}) — o servidor tenta de novo a cada 5 min",
                "sem-destinatarios" => "Nenhum piloto desta prova tem e-mail no cadastro",
                "desligado" => "Envio automático estava desligado quando a prova foi finalizada",
                "enviando" => "Enviando e-mails...",
                _ => "",
            };
        }
        string NomeDoKart(string kart) => _sess?["competitors"]?.AsArray().OfType<JsonObject>().FirstOrDefault(c => c.S("kart") == kart)?.S("name") ?? "";

        var reenviando = false;
        d.BotaoRodape("Reenviar para todos", true, () => Seguro.Rodar(d, async () =>
        {
            if (reenviando) return;
            if (!encerrada) { Msg.Aviso(d, "Finalize a prova antes de enviar o resultado."); return; }
            if (!Msg.Pergunta(d, $"Mandar o resultado de novo para todos os pilotos de {nomeBateria} que têm e-mail?")) return;
            reenviando = true;
            try
            {
                var antes = ((await Crono.Api.Get($"/api/sessions/{id}/emails")) as JsonObject)?.L("atualizadoEm") ?? 0;
                await Crono.Api.Post($"/api/sessions/{id}/emails", new { });
                info.Text = "Enviando… (um e-mail com PDF por piloto)";
                for (var i = 0; i < 90 && !d.IsDisposed; i++)
                {
                    await Task.Delay(2000);
                    var e = (await Crono.Api.Get($"/api/sessions/{id}/emails")) as JsonObject;
                    if ((e?.L("atualizadoEm") ?? 0) > antes && e?.S("status") != "enviando") break;
                }
                await Carregar();
            }
            finally
            {
                reenviando = false;
            }
        }));
        if (kartSel != null)
            d.BotaoRodape($"Só o kart {kartSel}", false, () => Seguro.Rodar(d, async () =>
            {
                if (!encerrada) { Msg.Aviso(d, "Finalize a prova antes de enviar o resultado."); return; }
                await Crono.Api.Post($"/api/sessions/{id}/emails", new { kart = kartSel });
                Msg.Info(d, $"Resultado enviado para {pilotoSel} (kart {kartSel}).");
                await Carregar();
            }));
        d.BotaoRodape("Para outro e-mail…", false, () => Seguro.Rodar(d, async () =>
        {
            if (!encerrada) { Msg.Aviso(d, "Finalize a prova antes de enviar o resultado."); return; }
            var para = Prompt.Pedir(d, "Mandar o resultado oficial desta prova para qual e-mail?", "", "Enviar resultado");
            if (string.IsNullOrWhiteSpace(para)) return;
            await Crono.Api.Post($"/api/sessions/{id}/emails", new { para = para.Trim() });
            Msg.Info(d, $"Resultado enviado para {para.Trim()}.");
        }));
        d.BotaoRodape("Configurar…", false, () => { d.Close(); ConfigurarEmail(); });
        d.Load += (_, _) => Seguro.Rodar(d, Carregar);
        d.ShowDialog(this);
    }
}
