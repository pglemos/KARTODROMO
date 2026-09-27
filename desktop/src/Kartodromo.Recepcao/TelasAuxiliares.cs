using System.Text.Json.Nodes;
using System.Diagnostics;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

/// <summary>Trocar minha senha (TrocarSenha.dc.html).</summary>
public sealed class FormTrocarSenha : DialogoDesign
{
    public FormTrocarSenha() : base("Trocar minha senha", Sessao.Nome, "M14 7a4 4 0 1 1-3.9 5H4v3h3v3h3v-3.1", "linear-gradient(180deg, #9A9AA0, #4A4A4F)")
    {
        TextBox Senha() { var t = PecasDesign.Texto("", 100); t.UseSystemPasswordChar = true; return t; }
        var atual = Senha(); var nova = Senha(); var confirmar = Senha();
        var g = Secao(null);
        Campo(g, "Senha atual", atual, 6);
        Campo(g, "Nova senha", nova, 3);
        Campo(g, "Repetir a nova senha", confirmar, 3);
        Nota("Use pelo menos 8 caracteres. A senha é só sua: o que você fizer no caixa fica registrado no seu nome.");
        BotaoRodape("Trocar senha", true, () => Seguro.Rodar(this, async () =>
        {
            if (string.IsNullOrEmpty(atual.Text)) { Msg.Aviso(this, "Informe sua senha atual."); atual.Focus(); return; }
            if (nova.Text.Length < 8) { Msg.Aviso(this, "A senha precisa ter pelo menos 8 caracteres."); nova.Focus(); return; }
            if (nova.Text != confirmar.Text) { Msg.Aviso(this, "As senhas não conferem."); confirmar.SelectAll(); confirmar.Focus(); return; }
            var r = await Sessao.Api.Post("/api/office/senha", new { senhaAtual = atual.Text, nova = nova.Text });
            Msg.Info(this, r.S("mensagem"));
            DialogResult = DialogResult.OK;
            Close();
        }));
        BotaoRodape("Cancelar", false, Close);
        Shown += (_, _) => atual.Focus();
    }
}

/// <summary>Serviços online (ServicosOnline.dc.html): situação de cada serviço, ações e o QR code do check-in.
/// A situação vem do servidor (/servicos-online) e das verificações feitas daqui (site e telão).</summary>
public sealed class FormServicosOnline : DialogoDesign
{
    readonly TabelaDesign _tabela;
    readonly CheckBox _agenda = new() { Text = "Publicar agenda no site" };
    readonly CheckBox _lembrete = new() { Text = "Enviar lembrete 2 h antes pelo WhatsApp" };
    const string UrlCheckin = "kartodromodebetim.com.br/checkin";

    public FormServicosOnline() : base("Serviços online", "Site, reservas online, WhatsApp e telão", "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2z", "linear-gradient(180deg, #6FD6FF, #0A84FF)")
    {
        _tabela = SecaoTabelaDesign("Situação");
        _tabela.Colunas(new("Serviço", 5f), new("Situação", 1.6f), new("Última sincronização", 2f));
        _tabela.Linhas([["Verificando…", "", ""]]);
        var g = Secao("Ações");
        Marca(g, _agenda, 3, false);
        Marca(g, _lembrete, 3, false);
        var qr = AcaoCampo("Imprimir QR");
        qr.Click += (_, _) => ImprimirQr();
        var url = PecasDesign.Texto(UrlCheckin); url.ReadOnly = true; url.BackColor = Color.White;
        Campo(g, "QR code do check-in", url, 6, qr);
        var dica = new ToolTip();
        foreach (var ck in new[] { _agenda, _lembrete }) ck.Enabled = false;
        BotaoRodape("Sincronizar agora", true, () => Seguro.Rodar(this, Atualizar));
        BotaoRodape("Fechar", false, Close);
        Shown += (_, _) => Seguro.Rodar(this, Atualizar);
        Load += (_, _) => { dica.SetToolTip(_agenda, "Aguardando a situação do servidor"); };
    }

    async Task Atualizar()
    {
        var agora = DateTime.Now.ToString("dd/MM HH:mm");
        var linhas = new List<string[]>();
        JsonObject resp = null;
        try { resp = (await Sessao.Api.Get("/api/office/servicos-online")).AsObject(); } catch { }
        string Sit(bool? on) => on == true ? "On-line" : on == false ? "Fora do ar" : "Não configurado";
        var site = await Testar("https://www.kartodromodebetim.com.br");
        linhas.Add(["Site kartodromodebetim.com.br", Sit(site), site != null ? agora : "—"]);
        var reservas = resp?["servicos"]?.AsArray().OfType<JsonObject>().FirstOrDefault(x => x.S("id") == "reservas-online");
        linhas.Add(["Reservas online (totem e site)", reservas == null ? "Fora do ar" : Sit(reservas["online"]?.GetValue<bool?>()), reservas?.D("verificadoEm") is DateTime dr ? dr.ToString("dd/MM HH:mm") : agora]);
        var wpp = resp?["servicos"]?.AsArray().OfType<JsonObject>().FirstOrDefault(x => x.S("id") == "whatsapp");
        linhas.Add(["WhatsApp (resultados e lembretes)", Sit(wpp?["online"]?.GetValue<bool?>()), wpp?.D("verificadoEm") is DateTime dw ? dw.ToString("dd/MM HH:mm") : "—"]);
        var tv = await Testar(Config.CronoUrl.TrimEnd('/') + "/healthz");
        linhas.Add(["Classificação ao vivo / telão", Sit(tv), tv != null ? "agora" : "—"]);
        if (IsDisposed) return;
        _tabela.Linhas(linhas);
        var acoes = resp?["acoes"] as JsonObject;
        var dica = new ToolTip();
        void Acao(CheckBox ck, string chave)
        {
            var a = acoes?[chave] as JsonObject;
            ck.Enabled = a?.B("disponivel") == true;
            dica.SetToolTip(ck, ck.Enabled ? "" : a?.S("motivo") ?? "Indisponível");
        }
        Acao(_agenda, "publicarAgenda");
        Acao(_lembrete, "enviarLembreteWhatsApp");
    }

    static async Task<bool?> Testar(string url)
    {
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(4) };
            using var r = await http.GetAsync(url);
            return r.IsSuccessStatusCode;
        }
        catch { return false; }
    }

    void ImprimirQr()
    {
        var html = "<!doctype html><html lang=pt-BR><meta charset=utf-8><title>QR code do check-in</title>" +
            "<style>body{font-family:'Segoe UI',sans-serif;text-align:center;margin:40px;color:#1D1D1F}h1{font-size:26px;margin:0 0 6px}p{color:#6E6E73;font-size:16px}#qr{margin:28px auto;width:320px;height:320px}</style>" +
            "<h1>Check-in do Kartódromo</h1><p>Aponte a câmera do celular para o código</p><div id=qr></div><p><b>https://" + UrlCheckin + "</b></p>" +
            "<script src='https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js'></script>" +
            "<script>try{var q=qrcode(0,'M');q.addData('https://" + UrlCheckin + "');q.make();document.getElementById('qr').innerHTML=q.createSvgTag({cellSize:8,margin:0,scalable:true});}catch(e){document.getElementById('qr').outerHTML='<p>Sem internet para gerar o QR code: use o endereço abaixo.</p>'}setTimeout(function(){print()},500)</script></html>";
        var arq = Path.Combine(Path.GetTempPath(), "kartodromo-qr-checkin.html");
        File.WriteAllText(arq, html, new System.Text.UTF8Encoding(false));
        Relatorio.Abrir(this, new Uri(arq).AbsoluteUri, "QR code do check-in");
    }
}

/// <summary>Ajuda local para operação e atalhos da recepção.</summary>
public sealed class FormAjuda : Janela
{
    public FormAjuda(string secao) : base(secao, 560, 320)
    {
        var texto = secao switch
        {
            "Atalhos do teclado" => "F1  ·  Abrir esta ajuda\nF2  ·  Cadastro rápido de cliente\nF3  ·  Buscar cliente\nF9  ·  Cobrar reserva selecionada\nCtrl+A  ·  Aprovar pré-reserva\nEnter  ·  Abrir ou editar o registro selecionado\nIns  ·  Incluir cliente na bateria\nCtrl+P  ·  Imprimir o relatório da tela atual\nDel  ·  Excluir o registro selecionado\nEsc  ·  Fechar a janela atual",
            "Suporte remoto" => "Para suporte, informe ao responsável de TI o nome do computador, o usuário conectado e o horário do problema. Não compartilhe sua senha.",
            _ => "Use a árvore lateral para alternar entre reservas, baterias, vendas e listas.\nClique com o botão direito numa linha para ver as ações disponíveis.\nO caixa é individual por usuário, terminal e turno. Confira o nome do terminal antes de iniciar uma venda."
        };
        Controls.Add(new Label { Text = texto, Dock = DockStyle.Fill, Font = new Font("Segoe UI", 10F), Padding = new Padding(12), ForeColor = KitVisual.Texto });
        Rodape(("Fechar", (_, _) => Close(), true));
    }
}
