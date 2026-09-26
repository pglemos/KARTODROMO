using System.Drawing.Drawing2D;
using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

public record CampoCad(string Chave, string Rotulo, string Tipo = "text", int Span = 1, string[] Opcoes = null);
public record DefCad(string Titulo, CampoCad[] Campos, Col[] Colunas, bool ComProvas = false, string Url = null);

/// <summary>Cadastros "Registro de X" (formulario + lista + navegacao), como o Registro de Produto do LapTime.</summary>
public static class Cadastros
{
    static readonly string[] Cat = ["Indoor", "Super Kart"];
    public static readonly Dictionary<string, DefCad> Defs = new()
    {
        ["produtos"] = new("Registro de Produto",
            [new("classeContabil", "Classe contábil", "text", 3), new("ativo", "Ativo", "bool"), new("codigo", "Código"), new("nome", "Nome", "text", 2), new("preco", "Preço (R$)", "money"),
             new("categoria", "Categoria (padrão)", "select", 1, Cat), new("servicoLocacao", "Serviço de locação", "bool"), new("publicarNuvem", "Publicar em nuvem", "bool"), new("requerDevolucao", "Requer devolução", "bool")],
            [new("classeContabil", "Classe Contábil", Largura: 110), new("categoria", "Categoria (padrão)", Largura: 120), new("codigo", "Código", Largura: 70), new("nome", "Nome", Largura: 300), new("preco", "Preço (R$)", TipoCol.Dinheiro), new("ativo", "Ativo", TipoCol.Bool)], true),
        ["tracados"] = new("Registro de Traçado", [new("nome", "Nome", "text", 2), new("comprimento", "Comprimento (m)", "int"), new("ativo", "Ativo", "bool")],
            [new("nome", "Nome", Largura: 300), new("comprimento", "Comprimento", TipoCol.Inteiro), new("ativo", "Ativo", TipoCol.Bool)]),
        ["feriados"] = new("Registro de Feriado", [new("data", "Data", "date"), new("descricao", "Descrição", "text", 2), new("recorrente", "Repete todo ano", "bool")],
            [new("data", "Data", TipoCol.Data), new("descricao", "Descrição", Largura: 300), new("recorrente", "Recorrente", TipoCol.Bool)]),
        ["turnos"] = new("Registro de Turno", [new("descricao", "Descrição", "text", 2), new("inicio", "Início (hh:mm)", "time"), new("fim", "Término (hh:mm)", "time"), new("ativo", "Ativo", "bool")],
            [new("descricao", "Descrição", Largura: 220), new("inicio", "Início", Largura: 70), new("fim", "Término", Largura: 70), new("ativo", "Ativo", TipoCol.Bool)]),
        ["terminais"] = new("Registro de Terminal", [new("codigo", "Código"), new("nome", "Descrição", "text", 2), new("ativo", "Ativo", "bool")],
            [new("codigo", "Código", Largura: 70), new("nome", "Descrição", Largura: 220), new("ativo", "Ativo", TipoCol.Bool)]),
        ["formas"] = new("Métodos de Pagamento", [new("codigo", "Código"), new("nome", "Nome", "text", 2), new("tipo", "Tipo", "select", 1, ["dinheiro", "credito", "debito", "pix", "voucher", "outro"]), new("ativo", "Ativo", "bool")],
            [new("codigo", "Código", Largura: 70), new("nome", "Nome", Largura: 220), new("tipo", "Tipo", Largura: 90), new("ativo", "Ativo", TipoCol.Bool)]),
        ["itensManutencao"] = new("Itens de Manutenção", [new("codigo", "Código"), new("nome", "Nome", "text", 2), new("controlaPorTempo", "Controla por tempo de uso", "bool"), new("tempoHoras", "A cada (horas)", "int"), new("ativo", "Ativo", "bool")],
            [new("codigo", "Código", Largura: 70), new("nome", "Nome", Largura: 240), new("tempoHoras", "A cada (h)", TipoCol.Inteiro), new("ativo", "Ativo", TipoCol.Bool)]),
        ["padroes"] = new("Ferramenta de Configuração de Reservas",
            [new("nome", "Nome", "text", 2), new("produtoId", "Produto (padrão)", "produto", 2), new("tracadoId", "Traçado (padrão)", "tracado"), new("categoria", "Categoria (padrão)", "select", 1, Cat),
             new("quantidade", "Quantidade", "int"), new("primeiraHora", "1ª reserva (hh:mm)", "time"), new("vagas", "Vagas (máx)", "int"), new("intervaloMin", "Intervalo entre inícios (min)", "int"),
             new("voltaMinimaSeg", "Volta mínima (seg)", "int"), new("numerarNome", "Nomear reservas com nº sequencial", "bool"), new("online", "Publicar no totem", "bool"), new("ativo", "Ativo", "bool")],
            [new("nome", "Nome", Largura: 220), new("quantidade", "Qtde", TipoCol.Inteiro, 60), new("primeiraHora", "1ª reserva", Largura: 80), new("intervaloMin", "Intervalo", TipoCol.Inteiro, 70), new("vagas", "Vagas", TipoCol.Inteiro, 60), new("ativo", "Ativo", TipoCol.Bool)]),
        ["parceiros"] = new("Registro de Parceiro",
            [new("nome", "Nome", "text", 3), new("documento", "CNPJ / CPF", "text", 2), new("ativo", "Ativo", "bool"), new("comissaoPercentual", "Comissão (%)"),
             new("telefone", "Telefone", "text", 2), new("email", "E-mail", "text", 3), new("contato", "Pessoa de contato", "text", 3)],
            [new("nome", "Nome", Largura: 260), new("documento", "CNPJ / CPF", Largura: 160), new("comissaoPercentual", "Comissão (%)", Largura: 100), new("voucher", "Voucher", Largura: 110), new("ativo", "Ativo", TipoCol.Bool)],
            Url: "/api/office/parceiros"),
        ["usuarios"] = new("Registro de Usuário", [new("login", "Login"), new("nome", "Nome", "text", 2), new("senha", "Nova senha (em branco = manter)", "password", 2), new("admin", "Administrador", "bool"), new("ativo", "Ativo", "bool")],
            [new("login", "Login", Largura: 100), new("nome", "Nome", Largura: 220), new("admin", "Admin", TipoCol.Bool), new("ativo", "Ativo", TipoCol.Bool)]),
    };

    public static void Abrir(Form dono, string ent)
    {
        if (CadastrosDesign.Tem(ent))
        {
            var d = CadastrosDesign.Criar(ent);
            d.FormClosed += (_, _) => { if (!dono.IsDisposed) dono.Activate(); };
            d.ShowDialog(dono);
            return;
        }
        var f = new FormCadastro(ent, Defs[ent]);
        f.FormClosed += (_, _) => Seguro.Rodar(dono, Sessao.CarregarApoio);
        f.Show(dono);
    }

    public static void Empresa(Form dono) { using var f = new FormEmpresa(); f.ShowDialog(dono); Seguro.Rodar(dono, Sessao.CarregarApoio); }

    public static void Parametros(Form dono) { using var f = new FormParametros(); f.ShowDialog(dono); }
}

/// <summary>Parâmetros do sistema (OfficeParametros.dc.html): abas e a tabela Descrição / Valor; toque no valor para alterar.</summary>
public class FormParametros : DialogoDesign
{
    static readonly string[] Abas_ = ["Cronometragem", "Office", "Autoatendimento", "Ranking/TV", "Lista de participantes", "Placar eletrônico", "API"];
    static readonly HashSet<string> DaLista = ["office.exibirEmailLista", "office.exibirPesoLista"];
    readonly Dictionary<string, string> _alterados = [];
    List<JsonObject> _todos = [];
    readonly TabelaDesign _tabela;
    readonly Label _vazio;
    int _aba = 1;

    public FormParametros() : base("Parâmetros do sistema", "Ajustes da recepção · toque no valor para alterar",
        "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1", "linear-gradient(180deg, #9A9AA0, #4A4A4F)")
    {
        var g = Secao(null);
        _vazio = new Label { AutoSize = true, MaximumSize = new Size(860, 0), Font = new Font("Segoe UI", 9.6F), ForeColor = Color.FromArgb(58, 58, 60), BackColor = Color.White, Visible = false, Margin = new Padding(0, 0, 0, 8) };
        g.Controls.Add(_vazio); g.SetColumnSpan(_vazio, 6);
        _tabela = new TabelaDesign { Dock = DockStyle.Fill, Height = 100, Margin = new Padding(0, 0, 14, 0), MaxLinhas = 11 };
        _tabela.Colunas(new("Descrição", 700), new("Valor", 180, Direita: true, Editavel: true));
        g.Controls.Add(_tabela); g.SetColumnSpan(_tabela, 6);
        _tabela.CelulaMudou += (l, _, v) => { var p = Visiveis()[l]; _alterados[p.S("chave")] = v is "Sim" ? "true" : v is "Não" ? "false" : v; };
        Abas(Abas_, i => { _aba = i; Mostrar(); }, 1);
        BotaoRodape("Salvar", true, () => Seguro.Rodar(this, async () =>
        {
            if (_alterados.Count == 0) { Close(); return; }
            var body = new JsonObject(); foreach (var (k, v) in _alterados) body[k] = v;
            await Sessao.Api.Put("/api/office/parametros", body);
            await Sessao.CarregarApoio();
            Msg.Info(this, _alterados.Count == 1 ? "Parâmetro salvo." : $"{_alterados.Count} parâmetros salvos.");
            DialogResult = DialogResult.OK; Close();
        }));
        BotaoRodape("Cancelar", false, Close);
        Load += (_, _) => Seguro.Rodar(this, async () => { _todos = await Sessao.Api.Lista("/api/office/parametros"); Mostrar(); });
    }

    List<JsonObject> Visiveis() => _todos.Where(p =>
    {
        var k = p.S("chave");
        return _aba switch
        {
            1 => k.StartsWith("office.") && !DaLista.Contains(k),
            2 => k.StartsWith("totem."),
            4 => DaLista.Contains(k),
            _ => false,
        };
    }).ToList();

    void Mostrar()
    {
        var itens = Visiveis();
        string Valor(JsonObject p) { var v = _alterados.GetValueOrDefault(p.S("chave"), p.S("valor")); return v == "true" ? "Sim" : v == "false" ? "Não" : v; }
        _tabela.Linhas(itens.Select(p => new[] { p.S("descricao"), Valor(p) }));
        _tabela.Visible = itens.Count > 0;
        _vazio.Visible = itens.Count == 0;
        _vazio.Text = _aba switch
        {
            0 or 5 => "Os ajustes da cronometragem e do placar ficam no programa da Cronometragem (Ferramentas › Parâmetros da cronometragem).",
            3 => "O ranking e o telão são configurados no programa da Cronometragem (Relatórios › Ranking e Placar).",
            6 => "A API do servidor não tem ajustes pela recepção: o endereço e o acesso ficam na configuração do servidor.",
            _ => "Nenhum parâmetro nesta aba.",
        };
    }
}

/// <summary>Registro de empresa (Empresa.dc.html): dados gerais, informações adicionais e política de reembolso.</summary>
public class FormEmpresa : DialogoDesign
{
    static readonly string[] Dias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    readonly Dictionary<string, TextBox> _t = [];
    readonly TextBox[] _horas = new TextBox[7];
    readonly ListaDesign _uf = new(), _pais = new();
    readonly TextBox _politica = new() { Multiline = true, ScrollBars = ScrollBars.Vertical, BorderStyle = BorderStyle.None, Font = PecasDesign.FonteValor, Height = 330, AcceptsReturn = true };
    string _logoNome = "", _logoBase64;

    TextBox T(string k, int max = 200) { var t = PecasDesign.Texto("", max); _t[k] = t; return t; }

    public FormEmpresa() : base("Registro de empresa", "Aparece no cabeçalho dos resultados, termos e site",
        "M4 21V5l8-2v18M12 7l8 2v12M8 9h.01M8 13h.01M8 17h.01M16 13h.01M16 17h.01", "linear-gradient(180deg, #5EDB7A, #1E9E4A)")
    {
        _uf.Items.AddRange("AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".Split(' '));
        _pais.Items.AddRange(["Brasil", "Argentina", "Paraguai", "Uruguai", "Outro"]);
        // ---------- aba 1
        var logo = PecasDesign.Texto("", 200); logo.ReadOnly = true; logo.BackColor = Color.White;
        var trocar = AcaoCampo("Trocar");
        trocar.Click += (_, _) =>
        {
            using var d = new OpenFileDialog { Filter = "Imagem (*.png;*.jpg)|*.png;*.jpg;*.jpeg", Title = "Logomarca da empresa" };
            if (d.ShowDialog(this) != DialogResult.OK) return;
            var bytes = File.ReadAllBytes(d.FileName);
            if (bytes.Length > 1_500_000) { Msg.Aviso(this, "Use uma imagem de até 1,5 MB."); return; }
            _logoBase64 = Convert.ToBase64String(bytes); _logoNome = Path.GetFileName(d.FileName); logo.Text = _logoNome;
        };
        var e1 = Secao("Empresa");
        Campo(e1, "Nome", T("nome"), 3); Campo(e1, "CNPJ", T("cnpj", 20), 1); Campo(e1, "Telefone", T("telefone", 40), 1); Campo(e1, "Logomarca", logo, 1, trocar);
        var cep = T("cep", 12);
        var buscar = AcaoCampo("Buscar");
        buscar.Click += (_, _) => Seguro.Rodar(this, BuscarCep);
        var e2 = Secao("Endereço");
        Campo(e2, "CEP", cep, 1, buscar); Campo(e2, "Endereço", T("endereco"), 3); Campo(e2, "Nº", T("numero", 20), 1); Campo(e2, "Bairro", T("bairro", 100), 1);
        Campo(e2, "Cidade", T("cidade", 100), 2); Campo(e2, "Estado", _uf, 1); Campo(e2, "IBGE", T("ibge", 10), 1); Campo(e2, "País", _pais, 2);
        var e3 = Secao("Horário de funcionamento");
        for (var i = 0; i < 7; i++) { _horas[i] = PecasDesign.Texto("", 30); Campo(e3, Dias[i], _horas[i], i == 6 ? 1 : 1); }
        Control[] aba1 = [e1.Parent, e2.Parent, e3.Parent];
        // ---------- aba 2
        var i1 = Secao("Informações adicionais");
        Campo(i1, "Razão social", T("razaoSocial"), 4); Campo(i1, "Complemento", T("complemento", 100), 2);
        Campo(i1, "E-mail", T("email"), 3); Campo(i1, "Site", T("site"), 3);
        Control[] aba2 = [i1.Parent];
        // ---------- aba 3
        var p1 = Secao("Política de reembolso");
        var caixa = new Panel { Dock = DockStyle.Fill, Height = 350, Margin = new Padding(0, 0, 14, 0), Padding = new Padding(10, 8, 6, 8), BackColor = Color.White };
        caixa.Paint += (_, e) =>
        {
            e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            using var path = Forma.Redondo(new Rectangle(0, 0, caixa.Width - 1, caixa.Height - 1), 8);
            using var pen = new Pen(Color.FromArgb(219, 219, 219)); e.Graphics.DrawPath(pen, path);
        };
        _politica.Dock = DockStyle.Fill; caixa.Controls.Add(_politica);
        p1.Controls.Add(caixa); p1.SetColumnSpan(caixa, 6);
        var nota = Nota("A política aparece no termo de responsabilidade e no site.");
        Control[] aba3 = [p1.Parent, nota];
        foreach (var c in aba2.Concat(aba3)) c.Visible = false;
        Abas(["Dados gerais", "Informações adicionais", "Política de reembolso"], i =>
        {
            foreach (var c in aba1) c.Visible = i == 0;
            foreach (var c in aba2) c.Visible = i == 1;
            foreach (var c in aba3) c.Visible = i == 2;
        });
        BotaoRodape("Salvar e fechar", true, () => Seguro.Rodar(this, Salvar));
        BotaoRodape("Cancelar", false, Close);
        Load += (_, _) => Seguro.Rodar(this, async () =>
        {
            var e = await Sessao.Api.Get("/api/office/empresa");
            foreach (var (k, t) in _t) t.Text = e.S(k);
            _uf.SelectedItem = _uf.Items.Contains(e.S("estado")) ? e.S("estado") : "MG";
            _pais.SelectedItem = _pais.Items.Contains(e.S("pais")) ? e.S("pais") : "Brasil";
            _politica.Text = e.S("politicaReembolso").Replace("\r\n", "\n").Replace("\n", "\r\n");
            _logoNome = e.S("logoNome"); logo.Text = _logoNome.Length > 0 ? _logoNome : "(sem logomarca)";
            var horas = e.S("horarios").Split('|');
            for (var i = 0; i < 7; i++) _horas[i].Text = i < horas.Length ? horas[i] : "";
        });
    }

    async Task BuscarCep()
    {
        var cep = new string(_t["cep"].Text.Where(char.IsDigit).ToArray());
        if (cep.Length != 8) { Msg.Aviso(this, "Informe o CEP com 8 números."); return; }
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(6) };
        var r = System.Text.Json.Nodes.JsonNode.Parse(await http.GetStringAsync($"https://viacep.com.br/ws/{cep}/json/")) as JsonObject;
        if (r == null || r.B("erro")) { Msg.Aviso(this, "CEP não encontrado."); return; }
        _t["cep"].Text = $"{cep[..5]}-{cep[5..]}";
        _t["endereco"].Text = r.S("logradouro"); _t["bairro"].Text = r.S("bairro"); _t["cidade"].Text = r.S("localidade"); _t["ibge"].Text = r.S("ibge");
        _uf.SelectedItem = r.S("uf"); _pais.SelectedItem = "Brasil";
        _t["numero"].Focus();
    }

    async Task Salvar()
    {
        if (string.IsNullOrWhiteSpace(_t["nome"].Text)) { Msg.Aviso(this, "Informe o nome da empresa."); return; }
        var body = new JsonObject();
        foreach (var (k, t) in _t) body[k] = t.Text.Trim();
        body["estado"] = _uf.SelectedItem?.ToString(); body["pais"] = _pais.SelectedItem?.ToString();
        body["politicaReembolso"] = _politica.Text;
        body["horarios"] = string.Join("|", _horas.Select(h => h.Text.Trim()));
        await Sessao.Api.Put("/api/office/empresa", body);
        if (_logoBase64 != null) await Sessao.Api.Post("/api/office/empresa/logo", new { nome = _logoNome, base64 = _logoBase64 });
        Msg.Info(this, "Dados da empresa salvos.");
        DialogResult = DialogResult.OK; Close();
    }
}

public class FormCadastro : Janela
{
    readonly string _ent;
    readonly DefCad _def;
    readonly Dictionary<string, Control> _c = [];
    string Base => _def.Url ?? $"/api/office/cad/{_ent}";
    readonly Grade _g = new();
    readonly Label _pos = new() { Dock = DockStyle.Bottom, Height = 20, TextAlign = ContentAlignment.MiddleRight };
    readonly Dictionary<string, Button> _b = [];
    readonly Panel _extra = new() { Dock = DockStyle.Top, AutoSize = true };
    readonly ListBox _produtoLista = new() { Dock = DockStyle.Fill, DrawMode = DrawMode.OwnerDrawFixed, ItemHeight = 56, BorderStyle = BorderStyle.None, IntegralHeight = false };
    readonly TextBox _produtoBusca = new() { Dock = DockStyle.Fill, PlaceholderText = "Pesquisar por código ou nome", BorderStyle = BorderStyle.None };
    readonly ComboBox _produtoFiltro = new() { Dock = DockStyle.Fill, DropDownStyle = ComboBoxStyle.DropDownList };
    readonly Label _produtoTitulo = new() { AutoEllipsis = true, Font = new Font("Segoe UI", 12F, FontStyle.Bold), ForeColor = Color.FromArgb(29, 29, 31) };
    readonly Label _produtoSubtitulo = new() { AutoEllipsis = true, ForeColor = Color.FromArgb(110, 110, 115) };
    readonly Label _produtoAtivo = new() { AutoSize = true, Padding = new Padding(8, 4, 8, 4), BackColor = Color.FromArgb(231, 245, 238), ForeColor = Color.FromArgb(10, 94, 64) };
    readonly Label _estado = new() { AutoSize = true, Padding = new Padding(8, 3, 8, 3), Font = new Font("Segoe UI", 8.8F, FontStyle.Bold) };
    List<JsonObject> _lista = [];
    JsonObject _atual;
    string _modo = "ver";
    bool Produto => _ent == "produtos";
    /// <summary>O Produto tem layout próprio do design (lista à esquerda), sem o cabeçalho genérico das janelas.</summary>
    internal bool EhProduto => Produto;
    bool _suprimeSelecaoProduto;

    public FormCadastro(string ent, DefCad def) : base(def.Titulo, ent == "produtos" ? 1140 : 900, ent == "produtos" ? 772 : def.ComProvas ? 680 : 560, true)
    {
        _ent = ent; _def = def;
        ShowInTaskbar = true;
        var g = Campos.Grade(ent == "produtos" ? 6 : 4);
        foreach (var c in def.Campos)
        {
            Control ctl = c.Tipo switch
            {
                "bool" => Campos.Check(c.Rotulo),
                "select" => Campos.Combo(c.Opcoes),
                "produto" => Campos.Combo().Also(x => { x.Items.Add(new Campos.Item(0, "")); x.Items.AddRange(Sessao.Produtos(false)); }),
                "tracado" => Campos.Combo().Also(x => { x.Items.Add(new Campos.Item(0, "")); x.Items.AddRange(Sessao.Tracados()); }),
                "date" => new MaskedTextBox { Mask = "00/00/0000" },
                "time" => new MaskedTextBox { Mask = "00:00" },
                "password" => new TextBox { UseSystemPasswordChar = true },
                _ => new TextBox(),
            };
            _c[c.Chave] = ctl;
            if (!Produto || c.Tipo != "bool")
                Campos.Add(g, c.Tipo == "bool" ? null : c.Rotulo, ctl, Produto ? c.Chave switch { "classeContabil" or "categoria" => 3, "codigo" => 1, "nome" => 3, "preco" => 2, _ => c.Span } : c.Span);
        }
        _g.Colunas(def.Colunas);
        _g.SelectionChanged += (_, _) => { if (_modo == "ver" && _g.Atual != null && _g.Atual != _atual) Mostrar(_g.Atual); };
        _produtoLista.DrawItem += DesenharProduto;
        _produtoLista.SelectedIndexChanged += (_, _) =>
        {
            if (Produto && !_suprimeSelecaoProduto && _modo == "ver" && _produtoLista.SelectedItem is JsonObject r && r != _atual) Mostrar(r);
        };
        _produtoBusca.TextChanged += (_, _) => FiltrarProdutos();
        _produtoFiltro.Items.AddRange(["Todos", "Ativos", "Inativos"]);
        _produtoFiltro.SelectedIndex = 0;
        _produtoFiltro.SelectedIndexChanged += (_, _) => FiltrarProdutos();

        var nav = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 52, Padding = new Padding(4) };
        Button B(string k, string t, string gl, Color cor, Action a)
        {
            var b = new Button { Text = t, Image = Icone.Tile(gl, cor, 18), TextImageRelation = TextImageRelation.ImageAboveText, Size = new Size(t.Length > 2 ? 66 : 38, 44) };
            b.Click += (_, _) => a(); _b[k] = b; return b;
        }
        nav.Controls.AddRange([B("first", "", "", Color.DimGray, () => Ir(0)), B("prev", "", "", Color.DimGray, () => Ir(Indice() - 1)), B("next", "", "", Color.DimGray, () => Ir(Indice() + 1)),
            B("last", "", "", Color.DimGray, () => Ir(_lista.Count - 1)), B("novo", "Novo", "", Tema.Azul, Novo), B("edit", "Editar", "", Tema.Azul, () => SetModo("edit")),
            B("del", "Excluir", "", Tema.Vermelho, Excluir), B("canc", "Cancelar", "", Color.DimGray, () => { if (_atual != null) Mostrar(_atual); else SetModo("ver"); }),
            B("pesq", "Pesquisar", "", Color.DimGray, Pesquisar), new Label { Width = 180 }, B("fechar", "Fechar", "", Tema.Vermelho, Close), B("gravar", "Gravar", "", Tema.Verde, Gravar)]);
        var gradeBox = new Panel { Dock = DockStyle.Fill, BorderStyle = BorderStyle.FixedSingle, Controls = { _g } };
        Controls.Add(new Panel { Dock = DockStyle.Fill, Padding = new Padding(8), Controls = { gradeBox, _pos, _extra, g } });
        Controls.Add(nav);
        if (Produto) MontarLayoutProduto(g); else MontarLayoutGenerico(g);
        Load += (_, _) => Carregar(null);
    }

    // Cadastro.dc.html: barra de ações no topo, cartão do formulário, lista em cartão e rodapé com navegação + Gravar
    void MontarLayoutGenerico(TableLayoutPanel campos)
    {
        var fundo = Color.FromArgb(245, 245, 247);
        var cinza = Color.FromArgb(232, 232, 236);
        var oldRoots = Controls.Cast<Control>().ToArray();
        Controls.Clear();
        BackColor = fundo;
        Button Estilo(string k, string texto, Color fundoBt, Color frente, int largura, bool negrito = false)
        {
            var b = _b[k]; b.Text = texto; b.Image = null; b.TextImageRelation = TextImageRelation.Overlay; b.FlatStyle = FlatStyle.Flat; b.FlatAppearance.BorderSize = 0;
            b.BackColor = fundoBt; b.ForeColor = frente; b.Size = new Size(largura, 34); b.Margin = new Padding(0, 0, 6, 0); b.Cursor = Cursors.Hand;
            b.Font = new Font("Segoe UI", 9.3F, negrito ? FontStyle.Bold : FontStyle.Regular); b.AccessibleDescription = "kit:ignorar";
            b.Resize += (_, _) => KitVisual.AplicarRaio(b, 8); KitVisual.AplicarRaio(b, 8);
            return b;
        }
        var acoes = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 46, WrapContents = false, BackColor = fundo, Padding = new Padding(0, 4, 0, 6) };
        acoes.Controls.AddRange([
            Estilo("novo", "+ Novo", KitVisual.Verde, Color.White, 92, true), Estilo("edit", "Editar", cinza, KitVisual.Texto, 84),
            Estilo("del", "Excluir", cinza, Color.FromArgb(196, 40, 28), 84), Estilo("canc", "Cancelar", cinza, KitVisual.Texto, 90),
            Estilo("pesq", "Pesquisar", cinza, KitVisual.Texto, 94)]);
        _estado.Margin = new Padding(8, 8, 0, 0);
        acoes.Controls.Add(_estado);

        var cartao = new Panel { Dock = DockStyle.Top, BackColor = Color.White, Padding = new Padding(14, 10, 14, 8), Height = 140 };
        cartao.Resize += (_, _) => KitVisual.AplicarRaio(cartao, 14);
        campos.Dock = DockStyle.Top; campos.AutoSize = true; campos.BackColor = Color.White;
        foreach (Control c in campos.Controls) if (c.Controls.OfType<CheckBox>().Any() || c is CheckBox) c.Margin = new Padding(6, 22, 3, 3);
        _extra.BackColor = Color.White;
        cartao.Controls.Add(_extra); cartao.Controls.Add(campos);
        void Altura() { var h = campos.Height + _extra.Height + cartao.Padding.Vertical + 4; if (Math.Abs(cartao.Height - h) > 1) cartao.Height = h; }
        campos.SizeChanged += (_, _) => Altura(); Shown += (_, _) => Altura();

        var espaco = new Panel { Dock = DockStyle.Top, Height = 12, BackColor = fundo };
        var lista = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(10, 10, 10, 4) };
        lista.Resize += (_, _) => KitVisual.AplicarRaio(lista, 14);
        _g.Dock = DockStyle.Fill; KitVisual.EstilizarGrade(_g);
        _pos.Dock = DockStyle.Bottom; _pos.Height = 26; _pos.TextAlign = ContentAlignment.MiddleLeft; _pos.ForeColor = KitVisual.Secundario; _pos.BackColor = Color.White;
        lista.Controls.Add(_g); lista.Controls.Add(_pos);

        var rodape = new Panel { Dock = DockStyle.Bottom, Height = 54, BackColor = fundo, Padding = new Padding(0, 10, 0, 0) };
        var nav = new FlowLayoutPanel { Dock = DockStyle.Left, Width = 180, WrapContents = false, BackColor = fundo };
        foreach (var (k, t) in new[] { ("first", "«"), ("prev", "‹"), ("next", "›"), ("last", "»") }) nav.Controls.Add(Estilo(k, t, cinza, KitVisual.Texto, 38));
        var fim = new FlowLayoutPanel { Dock = DockStyle.Right, Width = 290, WrapContents = false, FlowDirection = FlowDirection.RightToLeft, BackColor = fundo };
        fim.Controls.AddRange([Estilo("gravar", "Gravar", KitVisual.Verde, Color.White, 120, true), Estilo("fechar", "Fechar", cinza, KitVisual.Texto, 90)]);
        rodape.Controls.Add(nav); rodape.Controls.Add(fim);

        var corpo = new Panel { Dock = DockStyle.Fill, BackColor = fundo };
        corpo.Controls.Add(lista); corpo.Controls.Add(espaco); corpo.Controls.Add(cartao); corpo.Controls.Add(acoes);
        lista.BringToFront();
        Controls.Add(corpo); Controls.Add(rodape);
        corpo.BringToFront();
        foreach (var old in oldRoots) if (!old.Contains(campos) && old != campos) old.Dispose();
    }

    void MontarLayoutProduto(TableLayoutPanel campos)
    {
        var fundo = Color.FromArgb(245, 245, 247);
        var linha = Color.FromArgb(229, 229, 234);
        var oldRoots = Controls.Cast<Control>().ToArray();
        Controls.Clear();
        BackColor = fundo;
        var lateral = new Panel { Dock = DockStyle.Left, Width = 380, BackColor = Color.FromArgb(238, 238, 242), Padding = new Padding(10, 8, 10, 8) };
        var topoLista = new TableLayoutPanel { Dock = DockStyle.Top, Height = 48, ColumnCount = 2, RowCount = 1 };
        topoLista.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); topoLista.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        var tituloLista = new Panel { Dock = DockStyle.Fill, BackColor = Color.Transparent };
        tituloLista.Controls.Add(new Label { Text = "Produtos", AutoSize = true, Font = new Font("Segoe UI", 12F, FontStyle.Bold), Location = new Point(40, 12), BackColor = Color.Transparent });
        tituloLista.Controls.Add(new PictureBox { Image = VisualPrincipal.Icone("produtos"), SizeMode = PictureBoxSizeMode.Zoom, Size = new Size(44, 44), Location = new Point(-4, 2), BackColor = Color.Transparent });
        topoLista.Controls.Add(tituloLista, 0, 0);
        var novo = _b["novo"]; novo.Text = "+ Novo"; novo.Image = null; novo.TextImageRelation = TextImageRelation.Overlay; novo.Size = new Size(82, 32); novo.FlatStyle = FlatStyle.Flat; novo.BackColor = Color.FromArgb(11, 122, 83); novo.ForeColor = Color.White; novo.Font = new Font("Segoe UI", 9F, FontStyle.Bold); novo.Margin = new Padding(0, 7, 0, 7); novo.FlatAppearance.BorderSize = 0;
        topoLista.Controls.Add(novo, 1, 0);
        var busca = new Panel { Dock = DockStyle.Top, Height = 38, BackColor = Color.White, Padding = new Padding(9, 8, 8, 5), Margin = new Padding(0, 2, 0, 6) };
        Arredondar(busca, 8);
        busca.Controls.Add(_produtoBusca);
        busca.Controls.Add(new Label { Text = "\uE721", Dock = DockStyle.Left, Width = 22, Font = new Font("Segoe MDL2 Assets", 9F), ForeColor = Color.FromArgb(110, 110, 115), TextAlign = ContentAlignment.MiddleLeft });
        _produtoBusca.BringToFront();
        var filtros = new Panel { Dock = DockStyle.Top, Height = 38, BackColor = Color.White, Padding = new Padding(8, 4, 8, 4), Margin = new Padding(0, 0, 0, 8) };
        Arredondar(filtros, 8);
        _produtoFiltro.FlatStyle = FlatStyle.Flat; filtros.Controls.Add(_produtoFiltro);
        var listaBox = new Panel { Dock = DockStyle.Fill, BackColor = Color.Transparent, Padding = new Padding(0, 0, 0, 2) };
        listaBox.Controls.Add(_produtoLista);
        _pos.Dock = DockStyle.Bottom; _pos.Height = 28; _pos.TextAlign = ContentAlignment.MiddleLeft; _pos.ForeColor = Color.FromArgb(110, 110, 115);
        filtros.Visible = false; // o design não tem esse filtro: a busca já acha por código ou nome
        var respiro = new Panel { Dock = DockStyle.Top, Height = 8, BackColor = Color.Transparent };
        lateral.Controls.Add(listaBox); lateral.Controls.Add(_pos); lateral.Controls.Add(filtros); lateral.Controls.Add(respiro); lateral.Controls.Add(busca); lateral.Controls.Add(topoLista);

        var direito = new Panel { Dock = DockStyle.Fill, BackColor = fundo };
        var cab = new Panel { Dock = DockStyle.Top, Height = 68, BackColor = Color.White, Padding = new Padding(16, 8, 14, 8) };
        _produtoTitulo.SetBounds(0, 4, 355, 28);
        _produtoSubtitulo.SetBounds(0, 31, 355, 22);
        _produtoAtivo.SetBounds(365, 18, 76, 27);
        var editar = _b["edit"]; editar.Text = "Editar"; editar.Image = null; editar.TextImageRelation = TextImageRelation.Overlay; editar.Size = new Size(82, 34); editar.FlatStyle = FlatStyle.Flat; editar.BackColor = Color.FromArgb(238, 238, 241); editar.ForeColor = Color.FromArgb(29, 29, 31); editar.Anchor = AnchorStyles.Top | AnchorStyles.Right; editar.SetBounds(cab.Width - 194, 17, 82, 34); editar.FlatAppearance.BorderSize = 0;
        var excluir = _b["del"]; excluir.Text = "Excluir"; excluir.Image = null; excluir.TextImageRelation = TextImageRelation.Overlay; excluir.Size = new Size(86, 34); excluir.FlatStyle = FlatStyle.Flat; excluir.BackColor = Color.FromArgb(238, 238, 241); excluir.ForeColor = Color.FromArgb(196, 40, 28); excluir.Anchor = AnchorStyles.Top | AnchorStyles.Right; excluir.SetBounds(cab.Width - 104, 17, 86, 34); excluir.FlatAppearance.BorderSize = 0;
        var fecharX = new Button { Text = "\uE711", Font = new Font("Segoe MDL2 Assets", 9F), Size = new Size(34, 34), FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(238, 238, 241), ForeColor = Color.FromArgb(29, 29, 31), Anchor = AnchorStyles.Top | AnchorStyles.Right, Cursor = Cursors.Hand, AccessibleDescription = "kit:ignorar" };
        fecharX.FlatAppearance.BorderSize = 0; fecharX.Click += (_, _) => Close(); fecharX.Resize += (_, _) => KitVisual.AplicarRaio(fecharX, 9); KitVisual.AplicarRaio(fecharX, 9);
        cab.Controls.AddRange([_produtoTitulo, _produtoSubtitulo, _produtoAtivo, editar, excluir, fecharX]);
        cab.Resize += (_, _) => { fecharX.Location = new Point(cab.ClientSize.Width - fecharX.Width - 2, 17); excluir.Left = fecharX.Left - excluir.Width - 8; editar.Left = excluir.Left - editar.Width - 8; };
        cab.Controls.Add(new Panel { Dock = DockStyle.Bottom, Height = 1, BackColor = linha });

        var centro = new Panel { Dock = DockStyle.Fill, Padding = new Padding(16, 12, 16, 10), BackColor = fundo };
        var corpo = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 2, BackColor = fundo, Padding = new Padding(0) };
        corpo.RowStyles.Add(new RowStyle(SizeType.Absolute, 204)); corpo.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        var cartao = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(12), Margin = new Padding(0, 0, 0, 12) };
        Arredondar(cartao, 14);
        campos.Dock = DockStyle.Top; campos.AutoSize = false; campos.Height = 116; campos.RowCount = 2; campos.RowStyles.Clear();
        campos.RowStyles.Add(new RowStyle(SizeType.Absolute, 58)); campos.RowStyles.Add(new RowStyle(SizeType.Absolute, 58));
        var wrappers = campos.Controls.Cast<Control>().ToArray();
        Control Wrapper(string chave) => wrappers.First(p => p.Controls.Cast<Control>().Any(c => ReferenceEquals(c, _c[chave])));
        campos.Controls.Clear();
        void Campo(string chave, int coluna, int linha, int span)
        {
            var w = Wrapper(chave); campos.Controls.Add(w, coluna, linha); if (span > 1) campos.SetColumnSpan(w, span);
        }
        Campo("classeContabil", 0, 0, 3); Campo("categoria", 3, 0, 3);
        Campo("codigo", 0, 1, 1); Campo("nome", 1, 1, 3); Campo("preco", 4, 1, 2);
        cartao.Controls.Add(campos);
        var opcoes = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 42, WrapContents = false, FlowDirection = FlowDirection.LeftToRight, Padding = new Padding(2, 8, 0, 0), Margin = new Padding(0) };
        foreach (var chave in new[] { "ativo", "servicoLocacao", "publicarNuvem", "requerDevolucao" })
        {
            if (_c.TryGetValue(chave, out var c) && c is CheckBox cb) { cb.Margin = new Padding(0, 0, 15, 0); cb.ForeColor = Color.FromArgb(58, 58, 60); opcoes.Controls.Add(cb); }
        }
        cartao.Controls.Add(opcoes);
        var provas = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(12) };
        Arredondar(provas, 14);
        var tituloProvas = new Label { Text = "Provas desta locação", Dock = DockStyle.Top, Height = 27, Font = new Font("Segoe UI", 10F, FontStyle.Bold), ForeColor = Color.FromArgb(29, 29, 31) };
        var subtituloProvas = new Label { Text = "As provas da bateria são enviadas à cronometragem na ordem configurada.", Dock = DockStyle.Top, Height = 22, ForeColor = Color.FromArgb(110, 110, 115) };
        _extra.Dock = DockStyle.Fill; _extra.AutoSize = false; _extra.Padding = new Padding(0, 8, 0, 0);
        provas.Controls.Add(_extra); provas.Controls.Add(subtituloProvas); provas.Controls.Add(tituloProvas);
        corpo.Controls.Add(cartao, 0, 0); corpo.Controls.Add(provas, 0, 1); centro.Controls.Add(corpo);

        var rodape = new Panel { Dock = DockStyle.Bottom, Height = 56, BackColor = Color.White, Padding = new Padding(10, 8, 10, 8) };
        var nav = new FlowLayoutPanel { Dock = DockStyle.Left, Width = 178, WrapContents = false, Padding = new Padding(0), FlowDirection = FlowDirection.LeftToRight };
        foreach (var key in new[] { "first", "prev", "next", "last" })
        {
            var b = _b[key]; b.Text = key switch { "first" => "«", "prev" => "‹", "next" => "›", _ => "»" }; b.Image = null; b.Size = new Size(36, 34); b.FlatStyle = FlatStyle.Flat; b.BackColor = Color.FromArgb(238, 238, 241); b.FlatAppearance.BorderSize = 0; nav.Controls.Add(b);
        }
        var acoes = new FlowLayoutPanel { Dock = DockStyle.Right, Width = 250, WrapContents = false, FlowDirection = FlowDirection.RightToLeft, Padding = new Padding(0) };
        var gravar = _b["gravar"]; gravar.Text = "Gravar produto"; gravar.Image = null; gravar.Size = new Size(142, 36); gravar.FlatStyle = FlatStyle.Flat; gravar.BackColor = Color.FromArgb(11, 122, 83); gravar.ForeColor = Color.White; gravar.Font = new Font("Segoe UI", 9F, FontStyle.Bold); gravar.FlatAppearance.BorderSize = 0;
        var cancelar = _b["canc"]; cancelar.Image = null; cancelar.Size = new Size(96, 36); cancelar.FlatStyle = FlatStyle.Flat; cancelar.BackColor = Color.FromArgb(238, 238, 241); cancelar.ForeColor = Color.FromArgb(29, 29, 31); cancelar.FlatAppearance.BorderSize = 0;
        acoes.Controls.AddRange([gravar, cancelar]); rodape.Controls.Add(acoes); rodape.Controls.Add(nav);
        direito.Controls.Add(centro); direito.Controls.Add(rodape); direito.Controls.Add(cab);
        Controls.Add(direito); Controls.Add(lateral);
        _b.Remove("pesq"); _b.Remove("fechar");
        foreach (var old in oldRoots) old.Dispose();
    }

    int Indice() => _atual == null ? -1 : _lista.FindIndex(x => x.S("id") == _atual.S("id"));
    void Ir(int i)
    {
        if (_lista.Count == 0) return;
        i = Math.Clamp(i, 0, _lista.Count - 1);
        if (Produto)
        {
            _produtoBusca.Clear(); _produtoFiltro.SelectedIndex = 0; FiltrarProdutos();
            var id = _lista[i].S("id");
            _produtoLista.SelectedIndex = Enumerable.Range(0, _produtoLista.Items.Count).FirstOrDefault(n => ((JsonObject)_produtoLista.Items[n]).S("id") == id, -1);
            if (_produtoLista.SelectedItem is JsonObject item && item != _atual) Mostrar(item);
        }
        else { _g.Selecionar(x => x.S("id") == _lista[i].S("id")); Mostrar(_lista[i]); }
    }

    void Carregar(string idSel) => Seguro.Rodar(this, async () =>
    {
        _lista = await Sessao.Api.Lista(Base);
        if (IsDisposed) return; // janela fechada antes da resposta
        if (Produto) FiltrarProdutos(); else _g.Carregar(_lista);
        var r = _lista.FirstOrDefault(x => x.S("id") == idSel) ?? _lista.FirstOrDefault();
        if (r != null)
        {
            if (Produto) { _suprimeSelecaoProduto = true; SelecionarProduto(r.S("id")); _suprimeSelecaoProduto = false; }
            else _g.Selecionar(x => x.S("id") == r.S("id"));
            Mostrar(r);
        }
        else { if (Produto) AtualizarCabecalhoProduto(null); SetModo("ver"); }
    });

    void Mostrar(JsonObject r)
    {
        _atual = r;
        foreach (var c in _def.Campos)
        {
            var ctl = _c[c.Chave];
            switch (c.Tipo)
            {
                case "bool": ((CheckBox)ctl).Checked = r.B(c.Chave); break;
                case "select": ((ComboBox)ctl).SelectedItem = ((ComboBox)ctl).Items.Contains(r.S(c.Chave)) ? r.S(c.Chave) : null; break;
                case "produto": case "tracado": Campos.Selecionar((ComboBox)ctl, r.L(c.Chave) ?? 0); break;
                case "money": ctl.Text = Fmt.Dinheiro(r.L(c.Chave)); break;
                case "date": ctl.Text = Fmt.Dmy(r.S(c.Chave)); break;
                case "password": ctl.Text = ""; break;
                default: ctl.Text = r.S(c.Chave); break;
            }
        }
        _pos.Text = $"Registro {Indice() + 1} de {_lista.Count}";
        if (Produto) AtualizarCabecalhoProduto(r);
        SetModo("ver");
        if (_def.ComProvas) Provas(r);
    }

    void SelecionarProduto(string id)
    {
        for (var i = 0; i < _produtoLista.Items.Count; i++)
            if (_produtoLista.Items[i] is JsonObject r && r.S("id") == id) { _produtoLista.SelectedIndex = i; return; }
    }

    void FiltrarProdutos()
    {
        if (!Produto || _produtoLista.IsDisposed) return;
        var busca = _produtoBusca.Text.Trim();
        var status = _produtoFiltro.SelectedItem?.ToString() ?? "Todos";
        var filtrados = _lista.Where(p =>
        {
            var ativo = p.B("ativo");
            return (status == "Todos" || status == "Ativos" && ativo || status == "Inativos" && !ativo)
                && (busca.Length == 0 || p.S("codigo").Contains(busca, StringComparison.OrdinalIgnoreCase) || p.S("nome").Contains(busca, StringComparison.OrdinalIgnoreCase));
        }).ToList();
        var idAtual = _atual?.S("id"); _suprimeSelecaoProduto = true;
        _produtoLista.BeginUpdate(); _produtoLista.Items.Clear();
        foreach (var item in filtrados) _produtoLista.Items.Add(item);
        if (idAtual != null) SelecionarProduto(idAtual);
        _produtoLista.EndUpdate(); _produtoLista.Invalidate(); _suprimeSelecaoProduto = false;
        _produtoLista.AccessibleName = $"Produtos, {filtrados.Count} registros";
        if (_atual != null) _pos.Text = $"Registro {Indice() + 1} de {_lista.Count}";
        else _pos.Text = $"{filtrados.Count} produtos";
    }

    void DesenharProduto(object sender, DrawItemEventArgs e)
    {
        if (!Produto || e.Index < 0 || e.Index >= _produtoLista.Items.Count) return;
        var p = (JsonObject)_produtoLista.Items[e.Index];
        var selecionado = (e.State & DrawItemState.Selected) != 0;
        var fundo = selecionado ? Color.FromArgb(11, 122, 83) : Color.Transparent;
        var fg = selecionado ? Color.White : Color.FromArgb(29, 29, 31);
        var sec = selecionado ? Color.FromArgb(220, 244, 232) : Color.FromArgb(110, 110, 115);
        using (var b = new SolidBrush(fundo)) e.Graphics.FillRectangle(b, e.Bounds);
        var r = e.Bounds; r.Inflate(-10, -4);
        var codeRect = new Rectangle(r.Left, r.Top + 8, 48, 20);
        var textRect = new Rectangle(r.Left + 50, r.Top + 2, Math.Max(30, r.Width - 150), 23);
        var subRect = new Rectangle(r.Left + 50, r.Top + 25, Math.Max(30, r.Width - 150), 19);
        var priceRect = new Rectangle(r.Right - 92, r.Top + 8, 88, 22);
        TextRenderer.DrawText(e.Graphics, p.S("codigo"), new Font("Consolas", 8.5F), codeRect, sec, TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
        TextRenderer.DrawText(e.Graphics, p.S("nome"), new Font("Segoe UI", 9F, FontStyle.Bold), textRect, fg, TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
        TextRenderer.DrawText(e.Graphics, p.S("categoria"), new Font("Segoe UI", 8F), subRect, sec, TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
        TextRenderer.DrawText(e.Graphics, Fmt.Dinheiro(p.L("preco")), new Font("Segoe UI", 8.5F, FontStyle.Bold), priceRect, fg, TextFormatFlags.Right | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
        if (e.Index < _produtoLista.Items.Count - 1 && !selecionado)
            using (var pen = new Pen(Color.FromArgb(232, 232, 236))) e.Graphics.DrawLine(pen, r.Left, e.Bounds.Bottom - 1, r.Right, e.Bounds.Bottom - 1);
        e.DrawFocusRectangle();
    }

    void AtualizarCabecalhoProduto(JsonObject p)
    {
        _produtoTitulo.Text = p?.S("nome") ?? "Novo produto";
        _produtoSubtitulo.Text = p == null ? "Informe os dados para cadastrar um produto." : $"Código {p.S("codigo")} · {p.S("categoria")}";
        _produtoAtivo.Text = p?.B("ativo") == true ? "Ativo" : "Inativo";
        _produtoAtivo.Visible = p != null;
    }

    void SetModo(string m)
    {
        _modo = m;
        foreach (var ctl in _c.Values) ctl.Enabled = m != "ver";
        _b["gravar"].Enabled = _b["canc"].Enabled = m != "ver";
        foreach (var k in new[] { "novo", "edit", "del", "first", "prev", "next", "last", "pesq" })
            if (_b.TryGetValue(k, out var b)) b.Enabled = m == "ver";
        if (Produto)
        {
            _produtoLista.Enabled = m == "ver";
            _produtoBusca.Enabled = m == "ver";
            _produtoFiltro.Enabled = m == "ver";
            _produtoAtivo.Text = _atual?.B("ativo") == true ? "Ativo" : _atual == null ? "Novo" : "Inativo";
        }
        _estado.Text = m == "novo" ? "Incluindo" : m == "edit" ? "Editando" : "";
        _estado.Visible = m != "ver";
        _estado.BackColor = m == "novo" ? Color.FromArgb(225, 238, 255) : Color.FromArgb(255, 240, 214);
        _estado.ForeColor = m == "novo" ? Color.FromArgb(10, 79, 160) : Color.FromArgb(138, 75, 0);
        // botões verdes apagados quando desabilitados
        foreach (var k in new[] { "gravar", "novo" }) if (_b.TryGetValue(k, out var bv) && bv.AccessibleDescription == "kit:ignorar") bv.BackColor = bv.Enabled ? KitVisual.Verde : Color.FromArgb(196, 222, 210);
    }

    void Novo()
    {
        _atual = null;
        foreach (var c in _def.Campos)
        {
            var ctl = _c[c.Chave];
            if (ctl is CheckBox cb) cb.Checked = c.Chave == "ativo"; else if (ctl is ComboBox co) co.SelectedIndex = co.Items.Count > 0 ? 0 : -1; else ctl.Text = "";
        }
        if (Produto)
        {
            _produtoLista.ClearSelected();
            AtualizarCabecalhoProduto(null);
            _extra.Controls.Clear();
            _extra.Controls.Add(new Label { Text = "Grave o produto para configurar suas provas de bateria.", Dock = DockStyle.Top, ForeColor = Color.FromArgb(110, 110, 115), Padding = new Padding(4, 8, 4, 4) });
        }
        SetModo("novo");
        _c.Values.First().Focus();
    }

    void Pesquisar()
    {
        var q = Prompt.Pedir(this, "Pesquisar (contém):", "", "Pesquisar");
        if (string.IsNullOrWhiteSpace(q)) return;
        var r = _lista.FirstOrDefault(x => x.Select(kv => kv.Value?.ToString() ?? "").Any(v => v.Contains(q, StringComparison.OrdinalIgnoreCase)));
        if (r == null) { Msg.Info(this, "Nada encontrado."); return; }
        if (Produto) { _produtoBusca.Text = q; FiltrarProdutos(); SelecionarProduto(r.S("id")); if (_produtoLista.SelectedItem != r) Mostrar(r); }
        else { _g.Selecionar(x => x.S("id") == r.S("id")); Mostrar(r); }
    }

    void Excluir() => Seguro.Rodar(this, async () =>
    {
        if (_atual == null || !Msg.Pergunta(this, "Deseja excluir definitivamente o registro atual?")) return;
        var r = await Sessao.Api.Delete($"{Base}/{_atual.S("id")}");
        if (r?.B("desativado") == true) Msg.Info(this, "Registro em uso: foi desativado em vez de excluído.");
        Carregar(null);
    });

    void Gravar() => Seguro.Rodar(this, async () =>
    {
        var body = new JsonObject();
        foreach (var c in _def.Campos)
        {
            var ctl = _c[c.Chave];
            switch (c.Tipo)
            {
                case "bool": body[c.Chave] = ((CheckBox)ctl).Checked; break;
                case "select": body[c.Chave] = ((ComboBox)ctl).SelectedItem?.ToString(); break;
                case "produto": case "tracado": body[c.Chave] = Campos.IdDe((ComboBox)ctl) is long id && id > 0 ? id : null; break;
                case "money": if (Fmt.Centavos(ctl.Text) is not long v) { Msg.Aviso(this, $"Valor inválido em {c.Rotulo}."); return; } body[c.Chave] = v; break;
                case "int": body[c.Chave] = int.TryParse(ctl.Text, out var n) ? n : null; break;
                case "date": body[c.Chave] = ((MaskedTextBox)ctl).MaskCompleted ? Fmt.Iso(DateTime.ParseExact(ctl.Text, "dd/MM/yyyy", Fmt.Br)) : null; break;
                case "time": body[c.Chave] = ((MaskedTextBox)ctl).MaskCompleted ? ctl.Text : null; break;
                case "password": if (ctl.Text.Length > 0) body[c.Chave] = ctl.Text; break;
                default: body[c.Chave] = ctl.Text.Trim(); break;
            }
        }
        var r = _modo == "novo" ? await Sessao.Api.Post(Base, body) : await Sessao.Api.Put($"{Base}/{_atual.S("id")}", body);
        Msg.Info(this, "Operação concluída com sucesso.");
        Carregar(r.S("id"));
    });

    /// <summary>Secao "Item" do Registro de Produto: provas da bateria (Tomada de Tempo 5 min + Corrida 20 min...).</summary>
    void Provas(JsonObject produto) => Seguro.Rodar(this, async () =>
    {
        var lista = await Sessao.Api.Lista($"/api/office/cad/provas?produtoId={produto.S("id")}");
        _extra.Controls.Clear();
        var ordem = Campos.Num(lista.Count + 1, 1, 20); var nome = new TextBox(); var tipo = Campos.Combo("classificacao", "corrida", "treino");
        var fin = Campos.Combo("tempo", "voltas"); var tempo = Campos.Num(0, 0, 600); var voltas = Campos.Num(0, 0, 999);
        var linhaCampos = new TableLayoutPanel { Dock = DockStyle.Top, Height = 72, ColumnCount = 7, RowCount = 1, Padding = new Padding(0), Margin = new Padding(0) };
        foreach (var peso in new[] { 8f, 24f, 17f, 17f, 11f, 11f, 12f }) linhaCampos.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, peso));
        linhaCampos.Controls.Add(CampoProva("Ordem", ordem), 0, 0); linhaCampos.Controls.Add(CampoProva("Nome", nome), 1, 0);
        linhaCampos.Controls.Add(CampoProva("Tipo", tipo), 2, 0); linhaCampos.Controls.Add(CampoProva("Finaliza por", fin), 3, 0);
        linhaCampos.Controls.Add(CampoProva("Tempo (min)", tempo), 4, 0); linhaCampos.Controls.Add(CampoProva("Voltas (máx)", voltas), 5, 0);
        var bIns = new Button { Text = "+", Height = 34, Width = 34, Dock = DockStyle.Bottom, FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(11, 122, 83), ForeColor = Color.White, Font = new Font("Segoe UI", 11F, FontStyle.Bold), Margin = new Padding(2, 20, 2, 0), AccessibleName = "Inserir prova" };
        var bDel = new Button { Text = "×", Height = 34, Width = 34, Dock = DockStyle.Bottom, FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(238, 238, 241), ForeColor = Color.FromArgb(196, 40, 28), Font = new Font("Segoe UI", 11F, FontStyle.Bold), Margin = new Padding(2, 20, 2, 0), AccessibleName = "Excluir prova selecionada" };
        bIns.FlatAppearance.BorderSize = bDel.FlatAppearance.BorderSize = 0;
        var acoes = new FlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false, FlowDirection = FlowDirection.LeftToRight, Padding = new Padding(0), Margin = new Padding(0) };
        acoes.Controls.AddRange([bIns, bDel]); linhaCampos.Controls.Add(acoes, 6, 0);
        var gp = new Grade();
        gp.Colunas(new("ordem", "Ordem", TipoCol.Inteiro, 65), new("nome", "Nome", Largura: 150), new("tipo", "Tipo", Largura: 120, Valor: r => r.S("tipo") switch { "classificacao" => "Classificatório", "corrida" => "Corrida", "treino" => "Treino", var t => t }),
            new("finalizacao", "Finaliza por", Largura: 105, Valor: r => r.S("finalizacao") switch { "tempo" => "Por tempo", "voltas" => "Por voltas", var t => t }), new("tempoMin", "Tempo (min)", TipoCol.Inteiro, 92), new("voltasMax", "Voltas (máx)", TipoCol.Inteiro, 92));
        gp.CellPainting += (_, e) =>
        {
            if (e.RowIndex < 0 || gp.Columns[e.ColumnIndex].Name != "tipo" || e.Value is not string t || t.Length == 0) return;
            VisualPrincipal.Fundo(e);
            var (fundo, texto) = t switch { "Corrida" => (Color.FromArgb(255, 226, 224), Color.FromArgb(161, 29, 20)), "Classificatório" => (Color.FromArgb(225, 238, 255), Color.FromArgb(10, 79, 160)), _ => (Color.FromArgb(234, 234, 238), Color.FromArgb(58, 58, 60)) };
            var fonte = new Font("Segoe UI", 8.2F, FontStyle.Bold);
            var w = TextRenderer.MeasureText(t, fonte).Width + 12;
            var r = new Rectangle(e.CellBounds.X + 6, e.CellBounds.Y + (e.CellBounds.Height - 20) / 2, Math.Min(w, e.CellBounds.Width - 10), 20);
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var p = VisualPrincipal.Redondo(r, 6); using var b = new SolidBrush(fundo); e.Graphics.FillPath(b, p);
            TextRenderer.DrawText(e.Graphics, t, fonte, r, texto, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
            e.Handled = true;
        };
        gp.Carregar(lista);
        var listaCard = new Panel { Dock = DockStyle.Fill, Padding = new Padding(0), BackColor = Color.White };
        listaCard.Controls.Add(gp);
        _extra.Controls.Clear();
        var provasLayout = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 2, Padding = new Padding(0), BackColor = Color.White };
        provasLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 82)); provasLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        provasLayout.Controls.Add(linhaCampos, 0, 0); provasLayout.Controls.Add(listaCard, 0, 1); _extra.Controls.Add(provasLayout);
        bIns.Click += (_, _) => Seguro.Rodar(this, async () =>
        {
            if (string.IsNullOrWhiteSpace(nome.Text)) { Msg.Aviso(this, "Informe o nome da prova."); return; }
            await Sessao.Api.Post("/api/office/cad/provas", new { produtoId = produto.L("id"), ordem = (int)ordem.Value, nome = nome.Text.Trim(), tipo = tipo.Text, finalizacao = fin.Text, tempoMin = (int)tempo.Value, voltasMax = (int)voltas.Value });
            Provas(produto);
        });
        bDel.Click += (_, _) => Seguro.Rodar(this, async () =>
        {
            if (gp.Atual == null) { Msg.Aviso(this, "Selecione a prova."); return; }
            await Sessao.Api.Delete($"/api/office/cad/provas/{gp.Atual.S("id")}");
            Provas(produto);
        });
    });

    static Panel CampoProva(string rotulo, Control campo)
    {
        var p = new Panel { Dock = DockStyle.Fill, Padding = new Padding(3, 0, 5, 0), Margin = new Padding(0) };
        var label = new Label { Text = rotulo, Dock = DockStyle.Top, Height = 18, ForeColor = Color.FromArgb(110, 110, 115), Font = new Font("Segoe UI", 8F, FontStyle.Bold) };
        campo.Dock = DockStyle.Fill;
        if (campo is TextBox t) { t.BorderStyle = BorderStyle.None; t.BackColor = Color.White; }
        if (campo is ComboBox c) { c.FlatStyle = FlatStyle.Flat; c.BackColor = Color.White; }
        var input = new Panel { Dock = DockStyle.Fill, Margin = new Padding(0, 2, 0, 0), BackColor = Color.White, Padding = new Padding(6, 2, 5, 2) };
        input.Controls.Add(campo);
        input.Paint += (_, e) =>
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var path = new GraphicsPath(); var r = 7; var w = input.Width - 1; var h = input.Height - 1;
            path.AddArc(0, 0, r, r, 180, 90); path.AddArc(w - r, 0, r, r, 270, 90); path.AddArc(w - r, h - r, r, r, 0, 90); path.AddArc(0, h - r, r, r, 90, 90); path.CloseFigure();
            using var pen = new Pen(Color.FromArgb(218, 218, 224)); e.Graphics.DrawPath(pen, path);
        };
        input.Resize += (_, _) => input.Invalidate(); p.Controls.Add(input); p.Controls.Add(label); return p;
    }

    static void Arredondar(Panel painel, int raio)
    {
        void Ajustar()
        {
            if (painel.Width < raio * 2 || painel.Height < raio * 2) return;
            using var path = new GraphicsPath(); var w = painel.Width - 1; var h = painel.Height - 1;
            path.AddArc(0, 0, raio, raio, 180, 90); path.AddArc(w - raio, 0, raio, raio, 270, 90); path.AddArc(w - raio, h - raio, raio, raio, 0, 90); path.AddArc(0, h - raio, raio, raio, 90, 90); path.CloseFigure();
            painel.Region = new Region(path);
        }
        painel.Resize += (_, _) => Ajustar(); painel.Paint += (_, e) =>
        {
            if (painel.Width < raio * 2 || painel.Height < raio * 2) return;
            using var path = new GraphicsPath(); var w = painel.Width - 1; var h = painel.Height - 1;
            path.AddArc(0, 0, raio, raio, 180, 90); path.AddArc(w - raio, 0, raio, raio, 270, 90); path.AddArc(w - raio, h - raio, raio, raio, 0, 90); path.AddArc(0, h - raio, raio, raio, 90, 90); path.CloseFigure();
            using var pen = new Pen(Color.FromArgb(232, 232, 236)); e.Graphics.SmoothingMode = SmoothingMode.AntiAlias; e.Graphics.DrawPath(pen, path);
        };
        Ajustar();
    }
}

/// <summary>Regras comuns dos vouchers (fidelidade, parceiro e avulso): lê os campos e grava.</summary>
static class VoucherRegras
{
    public static string NovoCodigo() => "KB" + Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();

    public static async Task<bool> Salvar(Form dono, string origem, long? vinculoId, string referencia, string codigo, bool percentual, string valor,
        DateTime ini, DateTime fim, long? produtoId, string usoMax, bool unico, string minimo, string maximo)
    {
        if (origem is "fidelidade" or "parceiro" && (vinculoId is not long vid || vid <= 0)) { Msg.Aviso(dono, origem == "fidelidade" ? "Escolha a conta de fidelidade." : "Escolha o parceiro."); return false; }
        if (string.IsNullOrWhiteSpace(codigo)) { Msg.Aviso(dono, "Informe o código do voucher (ou toque em Gerar)."); return false; }
        long v;
        var txt = valor.Replace("%", "").Trim();
        if (percentual) { if (!decimal.TryParse(txt, System.Globalization.NumberStyles.Number, Fmt.Br, out var p) || p <= 0 || p > 100 || p != Math.Floor(p)) { Msg.Aviso(dono, "Informe o percentual (1 a 100)."); return false; } v = (long)p; }
        else { if (Fmt.Centavos(txt) is not long c || c <= 0) { Msg.Aviso(dono, "Informe o valor do desconto."); return false; } v = c; }
        if (fim.Date < ini.Date) { Msg.Aviso(dono, "A data final deve ser igual ou depois da inicial."); return false; }
        var uso = int.TryParse(usoMax, out var u) && u > 0 ? u : 1;
        await Sessao.Api.Post("/api/office/vouchers", new
        {
            origem, referencia = origem is "fidelidade" or "parceiro" ? null : referencia?.Trim(),
            fidelidadeContaId = origem == "fidelidade" ? vinculoId : null, parceiroId = origem == "parceiro" ? vinculoId : null,
            codigo = codigo.Trim().ToUpperInvariant(), tipo = percentual ? "percentual" : "valor", valor = v, inicio = Fmt.Iso(ini), fim = Fmt.Iso(fim),
            produtoId = produtoId is long pid && pid > 0 ? pid : (long?)null, usoMaxCliente = uso, usoUnico = unico,
            pedidoMinimo = Fmt.Centavos(minimo) is long mn && mn > 0 ? mn : (long?)null, descontoMaximo = Fmt.Centavos(maximo) is long mx && mx > 0 ? mx : (long?)null,
        });
        Msg.Info(dono, "Voucher criado com sucesso.");
        return true;
    }

    public static async Task CarregarVinculos(ListaDesign lista, string origem, JsonObject vinculo)
    {
        var rows = await Sessao.Api.Lista(origem == "fidelidade" ? "/api/office/fidelidade/contas" : "/api/office/parceiros");
        var itens = rows.Where(r => r.B("ativo")).Select(r => new Campos.Item(r.L("id") ?? 0, origem == "fidelidade" ? $"{r.S("nome")} · {r.I("saldo"):N0} pontos" : r.S("nome"), r)).ToArray();
        lista.Items.Clear();
        if (itens.Length == 0) { lista.Items.Add(new Campos.Item(0, origem == "fidelidade" ? "Nenhuma conta ativa — abra em Fidelidade › Contas" : "Nenhum parceiro ativo — cadastre em Parceiros")); lista.SelectedIndex = 0; return; }
        lista.Items.AddRange(itens);
        if (vinculo != null) Campos.Selecionar(lista, vinculo.L("id") ?? 0);
        if (lista.SelectedIndex < 0) lista.SelectedIndex = 0;
    }

    public static ListaDesign Produtos()
    {
        var prod = new ListaDesign();
        prod.Items.Add(new Campos.Item(0, "Todos os produtos"));
        prod.Items.AddRange(Sessao.Lista("produtos").Where(p => p.B("ativo")).Select(p => new Campos.Item(p.L("id") ?? 0, p.S("nome"), p)).ToArray());
        prod.SelectedIndex = 0;
        return prod;
    }
}

/// <summary>Criar voucher por fidelidade / avulso (Voucher.dc.html, 820×660): prévia do cartão dourado à esquerda
/// e o formulário em duas colunas à direita. O de parceiro abre FormVoucherParceiro (VoucherParceiro.dc.html).</summary>
public class FormVoucher : CartaoModal
{
    public static Form Criar(string origem, JsonObject vinculo = null) => origem == "parceiro" ? new FormVoucherParceiro(vinculo) : new FormVoucher(origem, vinculo);

    readonly Panel _cartao;
    string _valorCartao = "10% OFF", _codigoCartao = "";
    readonly string _selo;

    public FormVoucher(string origem, JsonObject vinculo = null) : base(820, 660)
    {
        var fidelidade = origem == "fidelidade";
        Text = fidelidade ? "Criar voucher por fidelidade" : "Criar voucher";
        _selo = fidelidade ? "FIDELIDADE" : "AVULSO";
        BackColor = DialogoDesign.Fundo;

        // ---------- lateral escura (300 px) com o cartão dourado inclinado
        var lado = new Panel { Dock = DockStyle.Left, Width = 300 };
        lado.Paint += (_, e) =>
        {
            var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
            using (var b = new LinearGradientBrush(lado.ClientRectangle, Color.FromArgb(28, 28, 30), Color.FromArgb(11, 11, 12), 90f)) g.FillRectangle(b, lado.ClientRectangle);
            using var brilho = new GraphicsPath(); brilho.AddEllipse(-30, -10, 360, 300);
            using var pb = new PathGradientBrush(brilho) { CenterColor = Color.FromArgb(90, 255, 216, 74), SurroundColors = [Color.FromArgb(0, 255, 216, 74)] };
            g.FillPath(pb, brilho);
        };
        _cartao = new Panel { Size = new Size(300, 195), Location = new Point(0, 187), BackColor = Color.Transparent };
        _cartao.Paint += (_, e) => DesenharCartao(e.Graphics);
        lado.Paint += (_, e) => { }; // o cartão desenha por cima do degradê (fundo transparente)
        var prev = new Label { Text = "Prévia do voucher. O cliente usa o código no caixa (Receita avulsa → Aplicar voucher).", Location = new Point(28, 386), Size = new Size(244, 60), ForeColor = Color.FromArgb(174, 174, 178), Font = new Font("Segoe UI", 9.8F), TextAlign = ContentAlignment.TopCenter, BackColor = Color.Transparent };
        lado.Controls.Add(_cartao); lado.Controls.Add(prev);

        // ---------- cabeçalho (padding 16 20, título 17 px, ✕ 30 px)
        var cab = new Panel { Dock = DockStyle.Top, Height = 63, BackColor = Color.White };
        cab.Paint += (_, e) => { using var p = new Pen(Color.FromArgb(235, 235, 235)); e.Graphics.DrawLine(p, 0, cab.Height - 1, cab.Width, cab.Height - 1); };
        cab.Controls.Add(new Label { Text = Text, AutoSize = true, Font = new Font("Segoe UI", 12.8F, FontStyle.Bold), ForeColor = PecasDesign.CorTexto, Location = new Point(20, 18), BackColor = Color.Transparent });
        var x = Botao("✕", CinzaBotao, PecasDesign.CorTexto); x.Font = new Font("Segoe UI", 9.5F); x.Size = new Size(30, 30); x.Location = new Point(520 - 20 - 30, 16);
        x.Resize += (_, _) => Forma.AplicarRaio(x, 8); Forma.AplicarRaio(x, 8); x.Click += (_, _) => Close();
        cab.Controls.Add(x);

        // ---------- formulário: 2 colunas, espaço 12 × 14
        var form = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, BackColor = DialogoDesign.Fundo, Padding = new Padding(20, 16, 6, 0), AutoScroll = false };
        form.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50)); form.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        void Campo(string rotulo, Control ctl, int span, Button acao = null)
        {
            var cel = new Panel { Height = 58, Dock = DockStyle.Fill, Margin = new Padding(0, 0, 14, 12), BackColor = DialogoDesign.Fundo };
            cel.Controls.Add(new Label { Text = rotulo, Font = PecasDesign.FonteRotulo, ForeColor = PecasDesign.Cinza, Location = new Point(0, 0), AutoSize = true, BackColor = DialogoDesign.Fundo });
            var caixa = new Panel { Location = new Point(0, 20), Height = 36, BackColor = DialogoDesign.Fundo, Anchor = AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Top };
            caixa.Paint += (_, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using var p = Forma.Redondo(new Rectangle(0, 0, caixa.Width - 1, caixa.Height - 1), 9);
                e.Graphics.FillPath(Brushes.White, p);
                using var pen = new Pen(ctl.ContainsFocus ? DialogoDesign.VerdePrincipal : Color.FromArgb(219, 219, 219)); e.Graphics.DrawPath(pen, p);
            };
            ctl.GotFocus += (_, _) => caixa.Invalidate(); ctl.LostFocus += (_, _) => caixa.Invalidate();
            if (ctl is TextBox tb) tb.BackColor = Color.White;
            caixa.Controls.Add(ctl);
            if (acao != null) { acao.Height = 26; caixa.Controls.Add(acao); }
            void Ajustar()
            {
                var direita = acao != null ? acao.PreferredSize.Width + 16 : 10;
                var h = ctl is TextBox ? ctl.Font.Height : ctl.Height;
                ctl.SetBounds(10, (36 - h) / 2, caixa.Width - 10 - direita, h);
                if (acao != null) acao.SetBounds(caixa.Width - acao.PreferredSize.Width - 6, 5, acao.PreferredSize.Width, 26);
            }
            caixa.Resize += (_, _) => Ajustar();
            cel.Resize += (_, _) => caixa.Width = cel.Width;
            cel.Controls.Add(caixa);
            form.Controls.Add(cel); form.SetColumnSpan(cel, span);
        }

        var lista = new ListaDesign();
        var refe = PecasDesign.Texto("", 150);
        var cod = PecasDesign.Texto(VoucherRegras.NovoCodigo(), 30); cod.CharacterCasing = CharacterCasing.Upper;
        var gerar = DialogoDesign.AcaoCampo("Gerar"); gerar.Click += (_, _) => cod.Text = VoucherRegras.NovoCodigo();
        var tipo = new ListaDesign(); tipo.Items.AddRange(["Percentual", "Valor (R$)"]); tipo.SelectedIndex = 0;
        var valor = PecasDesign.Texto("10 %", 12);
        var ini = new DataDesign(DateTime.Today); var fim = new DataDesign(DateTime.Today.AddDays(30));
        var prod = VoucherRegras.Produtos();
        var uso = PecasDesign.Numero(1, 4);
        var min = PecasDesign.Texto("", 14); min.PlaceholderText = "Sem mínimo";
        var max = PecasDesign.Texto("", 14); max.PlaceholderText = "Sem limite";
        var unico = new CheckBox { Text = "Uso único (vale uma vez só)", Checked = true, AutoSize = true, Font = new Font("Segoe UI", 10.1F), BackColor = DialogoDesign.Fundo, Padding = new Padding(4, 0, 0, 0), Cursor = Cursors.Hand, Margin = new Padding(0, 0, 0, 0) };
        Forma.CheckVerde(unico);

        if (fidelidade)
        {
            var sel = DialogoDesign.AcaoCampo("Selecionar…"); sel.Click += (_, _) => { lista.Focus(); lista.DroppedDown = true; };
            Campo("Conta fidelidade", lista, 2, sel);
            Load += (_, _) => Seguro.Rodar(this, () => VoucherRegras.CarregarVinculos(lista, origem, vinculo));
        }
        else Campo("Referência (opcional)", refe, 2);
        Campo("Código", cod, 2, gerar);
        Campo("Tipo de desconto", tipo, 1); Campo("Valor", valor, 1);
        Campo("Válido de", ini, 1); Campo("Válido até", fim, 1);
        Campo("Produto", prod, 2);
        Campo("Uso máximo por cliente", uso, 1); Campo("Pedido mínimo (R$)", min, 1);
        Campo("Desconto máximo (R$)", max, 2);
        form.Controls.Add(unico); form.SetColumnSpan(unico, 2);

        void Previa()
        {
            var t = valor.Text.Replace("%", "").Replace("R$", "").Trim();
            _valorCartao = tipo.SelectedIndex == 0 ? $"{(t.Length == 0 ? "0" : t)}% OFF" : $"R$ {(t.Length == 0 ? "0" : t)} OFF";
            _codigoCartao = cod.Text.Trim().ToUpperInvariant();
            _cartao.Invalidate();
        }
        valor.TextChanged += (_, _) => Previa(); tipo.SelectedIndexChanged += (_, _) => { valor.Text = tipo.SelectedIndex == 0 ? "10 %" : "20,00"; Previa(); }; cod.TextChanged += (_, _) => Previa();
        Previa();

        // ---------- rodapé (padding 14 20, botões 38 px)
        var rod = new Panel { Dock = DockStyle.Bottom, Height = 67, BackColor = Color.White };
        rod.Paint += (_, e) => { using var p = new Pen(Color.FromArgb(235, 235, 235)); e.Graphics.DrawLine(p, 0, 0, rod.Width, 0); };
        var salvar = Botao("Salvar e fechar", DialogoDesign.VerdePrincipal, Color.White, true); salvar.Font = new Font("Segoe UI", 10.1F, FontStyle.Bold);
        salvar.Size = new Size(TextRenderer.MeasureText(salvar.Text, salvar.Font).Width + 36, 38); salvar.Location = new Point(520 - 20 - salvar.Width, 14);
        var cancelar = Botao("Cancelar", CinzaBotao, PecasDesign.CorTexto); cancelar.Font = new Font("Segoe UI", 10.1F);
        cancelar.Size = new Size(TextRenderer.MeasureText("Cancelar", cancelar.Font).Width + 32, 38); cancelar.Location = new Point(salvar.Left - 10 - cancelar.Width, 14);
        foreach (var b in new[] { salvar, cancelar }) { b.Resize += (_, _) => Forma.AplicarRaio(b, 10); Forma.AplicarRaio(b, 10); }
        cancelar.Click += (_, _) => Close();
        salvar.Click += (_, _) => Seguro.Rodar(this, async () =>
        {
            if (await VoucherRegras.Salvar(this, origem, fidelidade ? Campos.IdDe(lista) : null, refe.Text, cod.Text, tipo.SelectedIndex == 0, valor.Text,
                ini.Value, fim.Value, Campos.IdDe(prod), uso.Text, unico.Checked, min.Text, max.Text)) { DialogResult = DialogResult.OK; Close(); }
        });
        rod.Controls.AddRange([cancelar, salvar]);

        var direita = new Panel { Dock = DockStyle.Fill, BackColor = DialogoDesign.Fundo };
        direita.Controls.Add(form); direita.Controls.Add(rod); direita.Controls.Add(cab);
        form.BringToFront();
        Controls.Add(direita); Controls.Add(lado);
        direita.BringToFront();
    }

    protected override void OnLoad(EventArgs e)
    {
        if (Owner is Form dono && dono.Visible && dono.WindowState != FormWindowState.Minimized)
        {
            var fundo = new Escurecer(dono);
            fundo.Show();
            FormClosed += (_, _) => fundo.Close();
        }
        base.OnLoad(e);
    }

    /// <summary>Cartão 240×150 dourado, raio 18, levemente girado (perspective rotateY(-14°) rotateX(8°) do design).</summary>
    void DesenharCartao(Graphics g)
    {
        g.SmoothingMode = SmoothingMode.AntiAlias; g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;
        var st = g.Save();
        // 240×150 centrado em (150, 95) do painel; a inclinação imita a perspectiva
        g.TranslateTransform(150, 102);
        using (var m = new Matrix(0.96f, -0.05f, -0.06f, 0.97f, 0, 0)) g.MultiplyTransform(m);
        var r = new RectangleF(-120, -75, 240, 150);
        using (var sombra = Forma.Redondo(new RectangleF(r.X + 6, r.Y + 22, r.Width - 12, r.Height), 18))
        using (var bs = new SolidBrush(Color.FromArgb(120, 0, 0, 0))) g.FillPath(bs, sombra);
        using (var p = Forma.Redondo(r, 18))
        {
            using var lg = new LinearGradientBrush(r, Color.FromArgb(255, 226, 122), Color.FromArgb(201, 133, 0), 45f)
            { InterpolationColors = new ColorBlend { Colors = [Color.FromArgb(255, 226, 122), Color.FromArgb(242, 169, 0), Color.FromArgb(201, 133, 0)], Positions = [0f, 0.6f, 1f] } };
            g.FillPath(lg, p);
            using var borda = new Pen(Color.FromArgb(150, 255, 255, 255), 1.2f); g.DrawLine(borda, r.X + 16, r.Y + 1, r.Right - 16, r.Y + 1);
        }
        var cor = Color.FromArgb(58, 39, 0);
        using var br = new SolidBrush(cor);
        using var f12 = new Font("Segoe UI", 9F, FontStyle.Bold);
        g.DrawString("VOUCHER", f12, br, r.X + 18, r.Y + 14);
        var sz = g.MeasureString(_selo, f12); g.DrawString(_selo, f12, br, r.Right - 18 - sz.Width, r.Y + 14);
        using var f34 = new Font("Segoe UI", 25F, FontStyle.Bold);
        g.DrawString(_valorCartao, f34, br, r.X + 14, r.Y + 44);
        using var fm = new Font("Consolas", 10.5F, FontStyle.Bold);
        g.DrawString(_codigoCartao.Length == 0 ? "—" : _codigoCartao, fm, br, r.X + 18, r.Bottom - 34);
        g.Restore(st);
    }
}

/// <summary>Criar voucher por parceiro (VoucherParceiro.dc.html).</summary>
public class FormVoucherParceiro : DialogoDesign
{
    public FormVoucherParceiro(JsonObject vinculo = null) : base("Criar voucher por parceiro", "O parceiro divulga o código e ganha comissão nas vendas",
        "M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4zM10 6v12", "linear-gradient(180deg, #8C89FF, #4B47D6)")
    {
        var lista = new ListaDesign();
        var sel = AcaoCampo("Selecionar…"); sel.Click += (_, _) => { lista.Focus(); lista.DroppedDown = true; };
        var cod = PecasDesign.Texto(VoucherRegras.NovoCodigo(), 30); cod.CharacterCasing = CharacterCasing.Upper;
        var gerar = AcaoCampo("Gerar");
        gerar.Click += (_, _) => cod.Text = (lista.SelectedItem is Campos.Item { Id: > 0 } it ? new string(it.Texto.ToUpperInvariant().Where(char.IsLetterOrDigit).Take(8).ToArray()) + Random.Shared.Next(10, 99) : VoucherRegras.NovoCodigo());
        var g = Secao("Parceiro");
        Campo(g, "Parceiro", lista, 4, sel);
        Campo(g, "Código", cod, 2, gerar);

        var tipo = new ListaDesign(); tipo.Items.AddRange(["Percentual", "Valor (R$)"]); tipo.SelectedIndex = 0;
        var valor = PecasDesign.Texto("10 %", 12);
        tipo.SelectedIndexChanged += (_, _) => valor.Text = tipo.SelectedIndex == 0 ? "10 %" : "20,00";
        var prod = VoucherRegras.Produtos();
        var ini = new DataDesign(DateTime.Today); var fim = new DataDesign(DateTime.Today.AddMonths(3));
        var uso = PecasDesign.Numero(1, 4);
        var unico = new CheckBox { Text = "Uso único", Checked = true };
        var min = PecasDesign.Texto("0,00", 14); var max = PecasDesign.Texto("0,00", 14);
        var d = Secao("Desconto");
        Campo(d, "Tipo de desconto", tipo, 2); Campo(d, "Valor do desconto", valor, 2); Campo(d, "Produto", prod, 2);
        Campo(d, "Data inicial", ini, 2); Campo(d, "Data final", fim, 2); Campo(d, "Uso máx/cliente", uso, 1); Marca(d, unico, 1);
        Campo(d, "Pedido mínimo (R$)", min, 3); Campo(d, "Desconto máximo (R$)", max, 3);

        BotaoRodape("Salvar e fechar", true, () => Seguro.Rodar(this, async () =>
        {
            if (await VoucherRegras.Salvar(this, "parceiro", Campos.IdDe(lista), null, cod.Text, tipo.SelectedIndex == 0, valor.Text,
                ini.Value, fim.Value, Campos.IdDe(prod), uso.Text, unico.Checked, min.Text, max.Text)) { DialogResult = DialogResult.OK; Close(); }
        }));
        BotaoRodape("Cancelar", false, Close);
        Load += (_, _) => Seguro.Rodar(this, () => VoucherRegras.CarregarVinculos(lista, "parceiro", vinculo));
    }
}
