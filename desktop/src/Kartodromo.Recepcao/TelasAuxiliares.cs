using System.Diagnostics;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

/// <summary>Troca de senha da sessão atual.</summary>
public sealed class FormTrocarSenha : Janela
{
    public FormTrocarSenha() : base("Trocar minha senha", 480, 360)
    {
        var atual = new TextBox { UseSystemPasswordChar = true, Width = 360 };
        var nova = new TextBox { UseSystemPasswordChar = true, Width = 360 };
        var confirmar = new TextBox { UseSystemPasswordChar = true, Width = 360 };
        var dica = new Label { Text = "Use pelo menos 8 caracteres. A senha nova passa a valer no próximo acesso.", Dock = DockStyle.Top, Height = 34, ForeColor = KitVisual.Secundario };
        var campos = Campos.Grade(1);
        Campos.Add(campos, "Senha atual", atual);
        Campos.Add(campos, "Nova senha", nova);
        Campos.Add(campos, "Repita a nova senha", confirmar);
        var corpo = new Panel { Dock = DockStyle.Fill, Padding = new Padding(4, 8, 4, 0) };
        corpo.Controls.Add(campos);
        corpo.Controls.Add(dica);
        Controls.Add(corpo);
        Rodape(("Cancelar", (_, _) => Close(), false), ("Salvar senha", (_, _) => Seguro.Rodar(this, async () =>
        {
            if (string.IsNullOrEmpty(atual.Text)) { Msg.Aviso(this, "Informe sua senha atual."); atual.Focus(); return; }
            if (nova.Text.Length < 8) { Msg.Aviso(this, "A senha precisa ter pelo menos 8 caracteres."); return; }
            if (nova.Text != confirmar.Text) { Msg.Aviso(this, "As senhas não conferem."); confirmar.SelectAll(); confirmar.Focus(); return; }
            var r = await Sessao.Api.Post("/api/office/senha", new { senhaAtual = atual.Text, nova = nova.Text });
            Msg.Info(this, r.S("mensagem"));
            DialogResult = DialogResult.OK;
            Close();
        }), true));
        Shown += (_, _) => atual.Focus();
    }
}

/// <summary>Estado de conectividade e atalhos para os serviços publicados do kartódromo.</summary>
public sealed class FormServicosOnline : Janela
{
    readonly Panel[] _cards;
    public FormServicosOnline() : base("Serviços online", 700, 390)
    {
        var titulo = new Label { Text = "Serviços online", Dock = DockStyle.Top, Height = 28, Font = new Font("Segoe UI", 15F, FontStyle.Bold) };
        var sub = new Label { Text = "Conectividade do Módulo Office, cronometragem e site público.", Dock = DockStyle.Top, Height = 24, ForeColor = KitVisual.Secundario };
        var cards = new TableLayoutPanel { Dock = DockStyle.Top, Height = 82, ColumnCount = 3, RowCount = 1, Padding = new Padding(0, 6, 0, 4) };
        for (var i = 0; i < 3; i++) cards.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 33.333F));
        _cards = [KitVisual.CartaoResumo("Servidor da operação", "Verificando"), KitVisual.CartaoResumo("Cronometragem", "Verificando"), KitVisual.CartaoResumo("Site", "Verificando")];
        for (var i = 0; i < _cards.Length; i++) cards.Controls.Add(_cards[i], i, 0);
        var urls = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 96, FlowDirection = FlowDirection.TopDown, WrapContents = false, Padding = new Padding(4, 7, 4, 0) };
        urls.Controls.Add(new Label { Text = "Servidor: " + Config.ServidorUrl, AutoSize = true, Font = new Font("Segoe UI", 9F, FontStyle.Bold) });
        urls.Controls.Add(new Label { Text = "Cronometragem: " + Config.CronoUrl, AutoSize = true, Font = new Font("Segoe UI", 9F, FontStyle.Bold) });
        var site = new LinkLabel { Text = "Abrir site do Kartódromo", AutoSize = true, LinkColor = KitVisual.Verde, Margin = new Padding(0, 4, 0, 0) };
        site.LinkClicked += (_, _) => Process.Start(new ProcessStartInfo("https://www.kartodromodebetim.com.br") { UseShellExecute = true });
        urls.Controls.Add(site);
        var info = new Label { Text = "Cadastro e agenda online são publicados pelo site. O estado de conectividade não indica disponibilidade de pagamentos.", Dock = DockStyle.Fill, ForeColor = KitVisual.Secundario, Padding = new Padding(4, 0, 4, 0) };
        var corpo = new Panel { Dock = DockStyle.Fill, Padding = new Padding(4, 4, 4, 0) };
        corpo.Controls.Add(info); corpo.Controls.Add(urls); corpo.Controls.Add(cards); corpo.Controls.Add(sub); corpo.Controls.Add(titulo);
        Controls.Add(corpo);
        Rodape(("Fechar", (_, _) => Close(), true));
        Shown += async (_, _) => await Atualizar();
    }

    async Task Atualizar()
    {
        await Verificar("/healthz", _cards[0]);
        await VerificarUrl(Config.CronoUrl.TrimEnd('/') + "/healthz", _cards[1]);
        await VerificarUrl("https://www.kartodromodebetim.com.br", _cards[2]);
    }

    static async Task Verificar(string path, Panel card)
    {
        try { await Sessao.Api.Get(path); KitVisual.ValorCartao(card, "On-line", Color.FromArgb(28, 107, 53)); }
        catch { KitVisual.ValorCartao(card, "Off-line", Color.FromArgb(196, 40, 28)); }
    }

    static async Task VerificarUrl(string url, Panel card)
    {
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(4) };
            using var resposta = await http.GetAsync(url);
            var ok = resposta.IsSuccessStatusCode;
            KitVisual.ValorCartao(card, ok ? "On-line" : "Off-line", ok ? Color.FromArgb(28, 107, 53) : Color.FromArgb(196, 40, 28));
        }
        catch { KitVisual.ValorCartao(card, "Off-line", Color.FromArgb(196, 40, 28)); }
    }
}

/// <summary>Ajuda local para operação e atalhos da recepção.</summary>
public sealed class FormAjuda : Janela
{
    public FormAjuda(string secao) : base(secao, 560, 320)
    {
        var texto = secao switch
        {
            "Atalhos do teclado" => "F1  ·  Abrir esta ajuda\nF2  ·  Cadastro rápido de cliente\nF3  ·  Buscar cliente\nF9  ·  Cobrar reserva selecionada\nCtrl+A  ·  Aprovar pré-reserva\nEnter  ·  Abrir ou editar o registro selecionado\nIns  ·  Incluir cliente na bateria\nCtrl+P  ·  Imprimir termo ou lista de participantes\nDel  ·  Excluir o registro selecionado\nEsc  ·  Fechar a janela atual",
            "Suporte remoto" => "Para suporte, informe ao responsável de TI o nome do computador, o usuário conectado e o horário do problema. Não compartilhe sua senha.",
            _ => "Use a árvore lateral para alternar entre reservas, baterias, vendas e listas.\nClique com o botão direito numa linha para ver as ações disponíveis.\nO caixa é individual por usuário, terminal e turno. Confira o nome do terminal antes de iniciar uma venda."
        };
        Controls.Add(new Label { Text = texto, Dock = DockStyle.Fill, Font = new Font("Segoe UI", 10F), Padding = new Padding(12), ForeColor = KitVisual.Texto });
        Rodape(("Fechar", (_, _) => Close(), true));
    }
}
