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
        var f = new FormCadastro(ent, Defs[ent]);
        f.FormClosed += (_, _) => Seguro.Rodar(dono, Sessao.CarregarApoio);
        f.Show(dono);
    }

    public static void Empresa(Form dono) => Seguro.Rodar(dono, async () =>
    {
        var e = await Sessao.Api.Get("/api/office/empresa");
        using var j = new Janela("Registro de Empresa", 760, 420);
        (string k, string r, int span)[] campos = [("nome", "Nome fantasia", 2), ("razaoSocial", "Razão social", 2), ("cnpj", "CNPJ", 1), ("telefone", "Telefone", 1), ("email", "E-mail", 2), ("cep", "CEP", 1),
            ("endereco", "Endereço", 2), ("numero", "Nº", 1), ("complemento", "Complemento", 1), ("bairro", "Bairro", 1), ("cidade", "Cidade", 1), ("estado", "UF", 1)];
        var g = Campos.Grade(4);
        var tb = new Dictionary<string, TextBox>();
        foreach (var (k, r, s) in campos) { var t = new TextBox { Text = e.S(k) }; tb[k] = t; Campos.Add(g, r, t, s); }
        var pol = new TextBox { Multiline = true, Height = 90, Text = e.S("politicaReembolso"), ScrollBars = ScrollBars.Vertical };
        Campos.Add(g, "Política de reembolso", pol, 4);
        j.Controls.Add(new Panel { Dock = DockStyle.Fill, Padding = new Padding(10), Controls = { g } });
        j.Rodape(("Cancelar", (_, _) => j.Close(), false), ("Salvar", (_, _) => Seguro.Rodar(j, async () =>
        {
            var body = new JsonObject(); foreach (var (k, t) in tb) body[k] = t.Text.Trim(); body["politicaReembolso"] = pol.Text;
            await Sessao.Api.Put("/api/office/empresa", body);
            Msg.Info(j, "Operação concluída com sucesso."); j.Close();
            await Sessao.CarregarApoio();
        }), true));
        j.ShowDialog(dono);
    });

    public static void Parametros(Form dono) => Seguro.Rodar(dono, async () =>
    {
        var lista = await Sessao.Api.Lista("/api/office/parametros");
        using var j = new Janela("Parâmetros do sistema", 960, 680);
        j.Tag = "Ajustes da recepção · toque no valor para alterar";

        var grade = new DataGridView
        {
            Dock = DockStyle.Fill,
            AllowUserToAddRows = false,
            AllowUserToDeleteRows = false,
            RowHeadersVisible = false,
            SelectionMode = DataGridViewSelectionMode.CellSelect
        };
        KitVisual.EstilizarGrade(grade);
        grade.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Descrição", AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill, ReadOnly = true });
        grade.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Valor", Width = 220, DefaultCellStyle = { Alignment = DataGridViewContentAlignment.MiddleRight } });

        var cartao = KitVisual.CartaoSecao(null);
        cartao.Height = 490;
        var pGrid = new Panel { Dock = DockStyle.Fill, Padding = new Padding(0, 4, 0, 0) };
        pGrid.Controls.Add(grade);
        cartao.Controls.Add(pGrid);

        var abasNomes = new[] { "Cronometragem", "Office", "Autoatendimento", "Ranking/TV", "Lista de participantes", "Placar eletrônico", "API" };
        var dictValores = new Dictionary<string, string>();
        foreach (var p in lista) dictValores[p.S("chave")] = p.S("valor");

        void CarregarAba(int idx)
        {
            grade.Rows.Clear();
            var prefixo = idx switch
            {
                0 => "crono",
                1 => "office",
                2 => "totem",
                3 => "ranking",
                4 => "participantes",
                5 => "placar",
                6 => "api",
                _ => ""
            };
            var filtrados = lista.Where(p => string.IsNullOrEmpty(prefixo) || p.S("chave").StartsWith(prefixo, StringComparison.OrdinalIgnoreCase)).ToList();
            if (filtrados.Count == 0) filtrados = lista;
            foreach (var p in filtrados)
            {
                var rowIdx = grade.Rows.Add(p.S("descricao"), dictValores.GetValueOrDefault(p.S("chave"), p.S("valor")));
                grade.Rows[rowIdx].Tag = p.S("chave");
            }
        }

        grade.CellEndEdit += (_, e) =>
        {
            if (e.RowIndex >= 0 && grade.Rows[e.RowIndex].Tag is string chave)
            {
                dictValores[chave] = grade.Rows[e.RowIndex].Cells[1].Value?.ToString() ?? "";
            }
        };

        var abas = KitVisual.AbaSegmentada(abasNomes, 1, CarregarAba);

        j.Controls.Add(cartao);
        j.Controls.Add(abas);

        j.Rodape(
            ("Cancelar", (_, _) => j.Close(), false),
            ("Salvar", (_, _) => Seguro.Rodar(j, async () =>
            {
                var body = new JsonObject();
                foreach (var (k, v) in dictValores) body[k] = v;
                await Sessao.Api.Put("/api/office/parametros", body);
                await Sessao.CarregarApoio();
                Msg.Info(j, "Parâmetros salvos.");
                j.Close();
            }), true)
        );

        CarregarAba(1);
        j.ShowDialog(dono);
    });
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
            e.PaintBackground(e.CellBounds, true);
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

/// <summary>"Criar Voucher por Fidelidade / Parceiro" — Voucher.dc.html (820x660, prévia de cartão dourado metálico à esquerda).</summary>
public class FormVoucher : Janela
{
    public FormVoucher(string origem, JsonObject vinculo = null) : base(origem == "fidelidade" ? "Criar Voucher por Fidelidade" : origem == "parceiro" ? "Criar Voucher por Parceiro" : "Criar Voucher", 840, 660)
    {
        var nomeOrigem = origem == "fidelidade" ? "Criar voucher por fidelidade" : origem == "parceiro" ? "Criar voucher por parceiro" : "Criar voucher";
        Tag = new KitVisual.ModalMeta
        {
            Titulo = nomeOrigem,
            Sub = "Prévia do voucher. O cliente usa o código no caixa (Receita avulsa → Aplicar voucher).",
            Cor1 = Color.FromArgb(255, 181, 71),
            Cor2 = Color.FromArgb(240, 122, 0),
            Glifo = "\uE7C1",
            Estado = "Voucher"
        };

        var refe = new TextBox();
        var lista = Campos.Combo(); lista.DropDownStyle = ComboBoxStyle.DropDownList;
        var vinculado = origem is "fidelidade" or "parceiro";
        var cod = new TextBox { CharacterCasing = CharacterCasing.Upper, Text = "KB" + Guid.NewGuid().ToString("N")[..6].ToUpperInvariant() };
        var bG = new Button { Text = "Gerar", Height = 28, AutoSize = true, FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(242, 242, 245) };
        bG.FlatAppearance.BorderSize = 0;
        bG.Click += (_, _) => cod.Text = "KB" + Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();

        var tipo = Campos.Combo("Percentual", "Valor (R$)");
        var valor = new TextBox { Text = "10" };
        var ini = Campos.Data(); var fim = Campos.Data(DateTime.Today.AddDays(30));
        var prod = Campos.Combo(); prod.Items.Add(new Campos.Item(0, "(qualquer produto)")); prod.Items.AddRange(Sessao.Produtos()); prod.SelectedIndex = 0;
        var uso = Campos.Num(1, 1, 999); var unico = Campos.Check("Uso único (vale uma vez só)", true);
        var min = new TextBox(); var max = new TextBox();

        // ---- Painel Esquerdo: Cartão Dourado 3D (Voucher.dc.html)
        var esq = new Panel { Dock = DockStyle.Left, Width = 290, BackColor = Color.FromArgb(24, 24, 26), Padding = new Padding(20, 36, 20, 20) };
        esq.Paint += (_, e) =>
        {
            using var b = new LinearGradientBrush(esq.ClientRectangle, Color.FromArgb(32, 32, 36), Color.FromArgb(12, 12, 14), 90f);
            e.Graphics.FillRectangle(b, esq.ClientRectangle);
        };

        var cardBox = new Panel { Size = new Size(250, 156), Location = new Point(20, 48), BackColor = Color.Transparent };
        var lblCardTipo = new Label { Text = "VOUCHER · " + (origem == "fidelidade" ? "FIDELIDADE" : origem == "parceiro" ? "PARCEIRO" : "AVULSO"), AutoSize = false, Size = new Size(220, 20), Location = new Point(16, 14), ForeColor = Color.FromArgb(58, 39, 0), Font = new Font("Segoe UI", 8.5F, FontStyle.Bold) };
        var lblCardValor = new Label { Text = "10% OFF", AutoSize = false, Size = new Size(220, 46), Location = new Point(14, 44), ForeColor = Color.FromArgb(58, 39, 0), Font = new Font("Segoe UI", 26F, FontStyle.Bold) };
        var lblCardCodigo = new Label { Text = cod.Text, AutoSize = false, Size = new Size(220, 26), Location = new Point(16, 114), ForeColor = Color.FromArgb(58, 39, 0), Font = new Font("Consolas", 12.5F, FontStyle.Bold) };

        cardBox.Paint += (_, e) =>
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var path = VisualPrincipal.Redondo(cardBox.ClientRectangle, 16);
            using var bGold = new LinearGradientBrush(cardBox.ClientRectangle, Color.FromArgb(255, 226, 122), Color.FromArgb(201, 133, 0), 135f);
            e.Graphics.FillPath(bGold, path);
            using var pen = new Pen(Color.FromArgb(255, 245, 180), 1.5f);
            e.Graphics.DrawPath(pen, path);
        };
        cardBox.Controls.AddRange([lblCardTipo, lblCardValor, lblCardCodigo]);

        var lblExplicacao = new Label
        {
            Text = "Prévia do voucher.\nO cliente usa o código no caixa\n(Receita avulsa → Aplicar voucher).",
            AutoSize = false,
            Size = new Size(250, 80),
            Location = new Point(20, 230),
            ForeColor = Color.FromArgb(174, 174, 178),
            Font = new Font("Segoe UI", 9.2F),
            TextAlign = ContentAlignment.TopCenter
        };
        esq.Controls.AddRange([cardBox, lblExplicacao]);

        void AtualizarPrevia()
        {
            lblCardTipo.Text = "VOUCHER · " + (origem == "fidelidade" ? "FIDELIDADE" : origem == "parceiro" ? "PARCEIRO" : "AVULSO");
            var vTxt = valor.Text.Trim();
            if (tipo.SelectedIndex == 0)
                lblCardValor.Text = string.IsNullOrEmpty(vTxt) ? "0% OFF" : $"{vTxt}% OFF";
            else
                lblCardValor.Text = string.IsNullOrEmpty(vTxt) ? "R$ 0 OFF" : $"R$ {vTxt} OFF";
            lblCardCodigo.Text = string.IsNullOrWhiteSpace(cod.Text) ? "—" : cod.Text.Trim().ToUpperInvariant();
        }

        valor.TextChanged += (_, _) => AtualizarPrevia();
        tipo.SelectedIndexChanged += (_, _) => AtualizarPrevia();
        cod.TextChanged += (_, _) => AtualizarPrevia();

        // ---- Painel Direito: Formulário
        var g = Campos.Grade(4);
        Campos.Add(g, origem == "fidelidade" ? "Conta fidelidade" : origem == "parceiro" ? "Parceiro" : "Referência (opcional)", vinculado ? lista : refe, 4);
        if (vinculado)
            Load += (_, _) => Seguro.Rodar(this, async () =>
            {
                var rows = await Sessao.Api.Lista(origem == "fidelidade" ? "/api/office/fidelidade/contas" : "/api/office/parceiros");
                var itens = rows.Where(r => r.B("ativo")).Select(r => new Campos.Item(r.L("id") ?? 0, origem == "fidelidade" ? $"{r.S("nome")} · {r.S("saldo")} pontos" : r.S("nome"), r)).ToArray();
                lista.Items.AddRange(itens);
                if (itens.Length == 0) { lista.Items.Add(new Campos.Item(0, origem == "fidelidade" ? "Nenhuma conta ativa — abra a conta em Fidelidade › Contas" : "Nenhum parceiro ativo — cadastre em Parceiros")); lista.SelectedIndex = 0; return; }
                if (vinculo != null) Campos.Selecionar(lista, vinculo.L("id") ?? 0);
                if (lista.SelectedIndex < 0) lista.SelectedIndex = 0;
            });

        var pCod = new Panel { Size = new Size(220, 32) };
        cod.SetBounds(0, 2, 140, 26);
        bG.SetBounds(146, 0, 70, 28);
        pCod.Controls.AddRange([cod, bG]);

        Campos.Add(g, "Código", pCod, 2);
        Campos.Add(g, "Tipo de desconto", tipo, 2);
        Campos.Add(g, "Valor", valor, 2);
        Campos.Add(g, "Uso único", unico, 2);
        Campos.Add(g, "Válido de", ini, 2);
        Campos.Add(g, "Válido até", fim, 2);
        Campos.Add(g, "Produto", prod, 4);
        Campos.Add(g, "Uso máx por cliente", uso, 2);
        Campos.Add(g, "Pedido mínimo (R$)", min, 2);
        Campos.Add(g, "Desconto máximo (R$)", max, 2);

        var cForm = KitVisual.CartaoSecao("Regras de desconto e validade");
        cForm.Controls.Add(g);

        var pDireito = new Panel { Dock = DockStyle.Fill, Padding = new Padding(12, 10, 12, 10) };
        pDireito.Controls.Add(cForm);

        Controls.Add(pDireito);
        Controls.Add(esq);

        Rodape("O cliente apresenta o código no caixa",
            ("Cancelar", (_, _) => Close(), false),
            ("Salvar e fechar", (_, _) => Seguro.Rodar(this, async () =>
            {
                if (vinculado && (Campos.IdDe(lista) is not long vid || vid <= 0)) { Msg.Aviso(this, origem == "fidelidade" ? "Escolha a conta de fidelidade." : "Escolha o parceiro."); return; }
                var pct = tipo.SelectedIndex == 0;
                long v;
                if (pct) { if (!int.TryParse(valor.Text.Trim().TrimEnd('%'), out var p) || p <= 0 || p > 100) { Msg.Aviso(this, "Informe o percentual (1 a 100)."); return; } v = p; }
                else { if (Fmt.Centavos(valor.Text) is not long c || c <= 0) { Msg.Aviso(this, "Informe o valor."); return; } v = c; }
                await Sessao.Api.Post("/api/office/vouchers", new
                {
                    origem, referencia = vinculado ? null : refe.Text.Trim(),
                    fidelidadeContaId = origem == "fidelidade" ? Campos.IdDe(lista) : null, parceiroId = origem == "parceiro" ? Campos.IdDe(lista) : null, codigo = cod.Text.Trim(), tipo = pct ? "percentual" : "valor", valor = v, inicio = Fmt.Iso(ini.Value), fim = Fmt.Iso(fim.Value),
                    produtoId = Campos.IdDe(prod) is long pid && pid > 0 ? pid : (long?)null, usoMaxCliente = (int)uso.Value, usoUnico = unico.Checked,
                    pedidoMinimo = Fmt.Centavos(min.Text) is long mn && mn > 0 ? mn : (long?)null, descontoMaximo = Fmt.Centavos(max.Text) is long mx && mx > 0 ? mx : (long?)null,
                });
                Msg.Info(this, "Voucher criado com sucesso.");
                Close();
            }), true)
        );
    }
}
