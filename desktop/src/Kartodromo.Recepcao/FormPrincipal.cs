using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

/// <summary>Janela principal — replica do "LapTime - Módulo Office".</summary>
public class FormPrincipal : Form
{
    readonly TreeView _arvore = new() { Dock = DockStyle.Fill, HideSelection = false, BorderStyle = BorderStyle.FixedSingle, ItemHeight = 20, FullRowSelect = false, ShowLines = true };
    readonly ComboBox _filtro = Campos.Combo("nesta data", "nesta semana", "neste mês", "a partir desta data", "todos os registros");
    readonly DateTimePicker _data = Campos.Data();
    readonly Label _total = new() { Dock = DockStyle.Top, Height = 24, Font = Tema.Negrito, BackColor = Color.FromArgb(231, 231, 231), TextAlign = ContentAlignment.MiddleLeft, Padding = new Padding(3, 0, 0, 0) };
    readonly Panel _filtroBar = new() { Dock = DockStyle.Top, Height = 34, BackColor = Tema.Fundo };
    readonly Grade _grade = new();
    readonly ToolStripStatusLabel _sbHora = new(), _sbData = new(), _sbSrv = new() { Font = Tema.Negrito };
    string _grupo = "reservas", _status = "todas";
    JsonObject _filtroBateria;

    public FormPrincipal()
    {
        Text = "Kartódromo - Módulo Office";
        Font = Tema.Normal;
        BackColor = Tema.Fundo;
        Icon = Icone.App;
        WindowState = FormWindowState.Maximized;
        MinimumSize = new Size(1024, 640);
        KeyPreview = true;

        // grade + filtro (lado direito)
        var direita = new Panel { Dock = DockStyle.Fill, BorderStyle = BorderStyle.FixedSingle, BackColor = Color.White };
        _filtroBar.Controls.Add(new Label { Text = "Exibir dados:", Left = 8, Top = 9, AutoSize = true });
        _filtro.SetBounds(86, 5, 226, 23);
        _data.SetBounds(318, 5, 110, 23);
        _filtroBar.Controls.AddRange([_filtro, _data]);
        _filtro.SelectedIndexChanged += (_, _) => Recarregar();
        _data.ValueChanged += (_, _) => Recarregar();
        direita.Controls.Add(_grade);
        direita.Controls.Add(_total);
        direita.Controls.Add(_filtroBar);
        _grade.FiltroMudou += Totais;

        var split = new SplitContainer { Dock = DockStyle.Fill, FixedPanel = FixedPanel.Panel1, BackColor = Tema.Fundo };
        Load += (_, _) => { split.Panel1MinSize = 240; split.SplitterDistance = 300; };
        split.Panel1.Padding = new Padding(3, 2, 0, 2);
        split.Panel2.Padding = new Padding(0, 2, 3, 2);
        split.Panel1.Controls.Add(_arvore);
        split.Panel2.Controls.Add(direita);

        var status = new StatusStrip { Font = Tema.Normal, SizingGrip = false };
        status.Items.AddRange([_sbHora, Sep(), _sbData, Sep(), new ToolStripStatusLabel(new Uri(Config.ServidorUrl).Host + "\\KartodromoOps"), Sep(),
            new ToolStripStatusLabel(Sessao.Nome), Sep(), new ToolStripStatusLabel("Ver. " + Application.ProductVersion.Split('+')[0]), Sep(), _sbSrv]);

        var licenca = new Label { Dock = DockStyle.Top, Height = 26, Font = new Font("Segoe UI", 10F, FontStyle.Bold), Padding = new Padding(4, 6, 0, 0),
            Text = "EMPRESA LICENCIADA: " + (Sessao.Apoio?["empresa"]?.S("razaoSocial") is { Length: > 0 } rz ? rz : Sessao.Apoio?["empresa"]?.S("nome")).ToUpperInvariant() };

        Controls.Add(split);
        Controls.Add(MontarToolbar());
        Controls.Add(licenca);
        Controls.Add(MontarMenu());
        Controls.Add(status);
        MontarArvore();

        var t = new System.Windows.Forms.Timer { Interval = 15000 };
        t.Tick += (_, _) => { Relogio(); };
        t.Start();
        var ping = new System.Windows.Forms.Timer { Interval = 30000 };
        ping.Tick += async (_, _) => await Ping();
        ping.Start();
        Load += async (_, _) => { Relogio(); await Ping(); Selecionar("reservas:todas"); };
        FormClosing += (_, e) => { if (!Msg.Pergunta(this, "Deseja sair do sistema?")) e.Cancel = true; };
    }

    static ToolStripSeparator Sep() => new();
    void Relogio() { _sbHora.Text = DateTime.Now.ToString("HH:mm"); _sbData.Text = DateTime.Now.ToString("dd/MM/yyyy"); }
    async Task Ping()
    {
        try { await Sessao.Api.Get("/healthz"); _sbSrv.Text = "Servidor: On-line"; _sbSrv.ForeColor = Tema.Verde; }
        catch { _sbSrv.Text = "Servidor: Off-line"; _sbSrv.ForeColor = Tema.Vermelho; }
    }

    // ------------------------------------------------------------------ menu
    MenuStrip MontarMenu()
    {
        var m = new MenuStrip { Font = Tema.Normal, BackColor = Color.White };
        var adm = Sessao.Admin;
        ToolStripMenuItem I(string t, Action a, bool hab = true) { var it = new ToolStripMenuItem(t, null, (_, _) => a()) { Enabled = hab }; return it; }
        ToolStripMenuItem S(string t, params ToolStripItem[] filhos) { var it = new ToolStripMenuItem(t); it.DropDownItems.AddRange(filhos); return it; }

        m.Items.Add(S("&Início",
            I("&Config Inicial (Empresa)", () => Cadastros.Empresa(this), adm),
            S("&Segurança", I("&Usuário", () => Cadastros.Abrir(this, "usuarios"), adm), I("Trocar minha senha", TrocarSenha)),
            new ToolStripSeparator(),
            I("&Fechar", Close)));
        m.Items.Add(S("&Cadastros",
            I("&Empresa", () => Cadastros.Empresa(this), adm), I("&Feriados", () => Cadastros.Abrir(this, "feriados")), new ToolStripSeparator(),
            I("C&liente", () => new FormCliente(null).Show(this)), I("Traçados", () => Cadastros.Abrir(this, "tracados")), new ToolStripSeparator(),
            S("POS", I("Turno", () => Cadastros.Abrir(this, "turnos")), I("Terminal", () => Cadastros.Abrir(this, "terminais"))), new ToolStripSeparator(),
            S("Oficina", I("Itens de Manutenção", () => Cadastros.Abrir(this, "itensManutencao")), I("Registro de Manutenções", () => Selecionar("oficina:arealizar")))));
        m.Items.Add(S("&Financeiro",
            I("Plano de Contas", () => { }, false), I("Conta Financeira", () => { }, false), I("Métodos de Pagamento", () => Cadastros.Abrir(this, "formas")), new ToolStripSeparator(),
            S("Programa de Fidelidade", I("Contas", () => Selecionar("fidelidade:contas")), I("Transações", () => Selecionar("fidelidade:transacoes"))),
            S("Vouchers", I("Cadastro de Vouchers", () => Selecionar("vouchers:lista")), I("Histórico de Consumo", () => Selecionar("vouchers:uso")), I("Criar Voucher", () => new FormVoucher("manual").ShowDialog(this))),
            S("Parceiros", I("Cadastro de Parceiros", () => Selecionar("parceiros:lista")))));
        m.Items.Add(S("F&erramentas", I("&Parâmetros do Sistema", () => Cadastros.Parametros(this), adm), I("Cadastro de Padrões de Reservas", () => Cadastros.Abrir(this, "padroes"))));
        m.Items.Add(S("&Relatórios",
            S("Cronometragem", I("Abrir resultados da Cronometragem", () => Relatorio.Abrir(this, Config.CronoUrl + "/", "Cronometragem")), I("Classificação ao vivo (TV)", () => Relatorio.Abrir(this, Config.CronoUrl + "/tv", "TV"))),
            S("Financeiro", I("Receitas por Forma de Pagamento", () => Relatorios.Periodo(this, "receitas", "forma")), I("Receitas por Clientes", () => Relatorios.Periodo(this, "receitas", "cliente")),
                I("Receitas por Produto", () => Relatorios.Periodo(this, "receitas", "produto")), I("Fluxo de Caixa", () => Relatorios.Periodo(this, "receitas", "dia"))),
            new ToolStripSeparator(),
            I("Fechamento de Caixa", () => Relatorios.Fechamento(this)), I("Reservas Diária", () => Relatorios.ReservasDiaria(this, _data.Value)),
            I("Clientes por Período", () => Relatorios.Periodo(this, "clientes", null)), I("Lista de Participantes", () => Relatorios.Participantes(this, _grupo == "baterias" ? _grade.Atual : null, _data.Value)),
            I("Agenda Mensal", () => Relatorios.AgendaMensal(this)), I("Imprimir Termo de Responsabilidade (em Branco)", () => Relatorio.Abrir(this, Sessao.Api.UrlComToken("/termo?branco=1"), "Termo de Responsabilidade"))));
        m.Items.Add(S("&Ajuda", I("Sobre", () => Msg.Info(this, $"Kartódromo — Módulo Office\nVersão {Application.ProductVersion.Split('+')[0]}\nServidor: {Config.ServidorUrl}\nSistema próprio do Kartódromo Internacional de Betim (substitui o LapTime Office)."))));
        return m;
    }

    async void TrocarSenha()
    {
        var nova = Prompt.Pedir(this, "Nova senha (mínimo 6 caracteres):", "", "Trocar minha senha", true);
        if (string.IsNullOrEmpty(nova)) return;
        if (Prompt.Pedir(this, "Repita a nova senha:", "", "Trocar minha senha", true) != nova) { Msg.Aviso(this, "As senhas não conferem."); return; }
        try { var r = await Sessao.Api.Post("/api/office/senha", new { nova }); Msg.Info(this, r.S("mensagem")); }
        catch (ApiException e) { Msg.Erro(this, e.Message); }
    }

    // ------------------------------------------------------------------ toolbar
    ToolStrip MontarToolbar()
    {
        var tb = new ToolStrip { GripStyle = ToolStripGripStyle.Hidden, ImageScalingSize = new Size(32, 32), Font = Tema.Normal, Padding = new Padding(6, 2, 6, 2), BackColor = Tema.Fundo, RenderMode = ToolStripRenderMode.System };
        ToolStripButton B(string glifo, Color cor, string texto, Action a) => new(texto, Icone.Tile(glifo, cor), (_, _) => a()) { TextImageRelation = TextImageRelation.ImageAboveText, AutoSize = true, Margin = new Padding(2, 1, 2, 1) };
        tb.Items.AddRange([
            B("", Color.FromArgb(52, 120, 200), "Clientes", () => new FormCliente(null).Show(this)),
            B("", Color.FromArgb(222, 140, 30), "Produtos", () => Cadastros.Abrir(this, "produtos")),
            new ToolStripSeparator(),
            B("", Color.FromArgb(200, 50, 45), "Reservas", () => { new FormCriarReservas().ShowDialog(this); Recarregar(); }),
            B("", Color.FromArgb(110, 80, 190), "Agenda", () => { new FormAgenda().ShowDialog(this); Recarregar(); }),
            new ToolStripSeparator(),
            B("", Color.FromArgb(0, 140, 150), "Terminal", () => Caixa.Terminal(this)),
            B("", Color.FromArgb(30, 150, 70), "Receita Avulsa", () => Caixa.Checkout(this, null, null, null)),
            B("", Color.FromArgb(40, 130, 60), "Suprimento", () => Caixa.Transacao(this, "suprimento")),
            B("", Color.FromArgb(200, 60, 50), "Sangria", () => Caixa.Transacao(this, "sangria")),
            new ToolStripSeparator(),
            B("", Color.FromArgb(210, 60, 120), "Voucher (Fidelidade)", () => new FormVoucher("fidelidade").ShowDialog(this)),
            B("", Color.FromArgb(230, 120, 40), "Voucher (Parceiro)", () => new FormVoucher("parceiro").ShowDialog(this)),
            new ToolStripSeparator(),
        ]);
        var online = new ToolStripDropDownButton("Serviços Online", Icone.Tile("", Color.FromArgb(60, 60, 60))) { TextImageRelation = TextImageRelation.ImageAboveText };
        online.DropDownItems.Add("QrCode - Cadastro Online", null, (_, _) => Msg.Info(this, "O cadastro on-line era um serviço da MyLapTime (desativada).\nPor enquanto o cadastro é feito no totem ou aqui na recepção."));
        online.DropDownItems.Add("QrCode - Agenda Online", null, (_, _) => Msg.Info(this, "A agenda e o pagamento on-line próprios ainda serão implementados no site (a MyLapTime foi desativada)."));
        tb.Items.Add(online);
        return tb;
    }

    // ------------------------------------------------------------------ arvore
    void MontarArvore()
    {
        var il = new ImageList { ImageSize = new Size(16, 16), ColorDepth = ColorDepth.Depth32Bit };
        il.Images.Add("y", Icone.Bola(Color.FromArgb(240, 190, 0)));
        il.Images.Add("g", Icone.Bola(Color.FromArgb(50, 180, 30)));
        il.Images.Add("r", Icone.Bola(Color.FromArgb(220, 50, 40)));
        il.Images.Add("b", Icone.Bola(Color.FromArgb(50, 110, 220)));
        void G(string k, string gl, Color c) => il.Images.Add(k, Icone.Tile(gl, c, 16));
        G("res", "", Color.FromArgb(120, 120, 120)); G("bat", "", Color.FromArgb(60, 110, 200)); G("fin", "", Color.FromArgb(200, 150, 20));
        G("ven", "", Color.FromArgb(50, 160, 60)); G("ofi", "", Color.FromArgb(200, 50, 50)); G("fid", "", Color.FromArgb(230, 170, 0));
        G("vou", "", Color.FromArgb(210, 60, 120)); G("par", "", Color.FromArgb(120, 90, 60));
        _arvore.ImageList = il;
        TreeNode N(string texto, string img, string chave, params TreeNode[] filhos)
        {
            var n = new TreeNode(texto, filhos) { ImageKey = img, SelectedImageKey = img, Tag = chave };
            return n;
        }
        _arvore.Nodes.AddRange([
            N("Reservas", "res", "reservas:todas", N("Aprovar", "y", "reservas:aprovar"), N("Aprovadas", "g", "reservas:aprovadas"), N("Pagamento Pendente", "y", "reservas:pendentes"), N("Canceladas", "r", "reservas:canceladas"), N("Todas", "b", "reservas:todas")),
            N("Baterias", "bat", "baterias:todas", N("Abertas", "g", "baterias:abertas"), N("Fechadas", "r", "baterias:fechadas"), N("Todas", "b", "baterias:todas")),
            N("Financeiro", "fin", null, N("Vendas", "ven", "vendas:todas", N("Liquidadas", "g", "vendas:liquidadas"), N("Canceladas", "r", "vendas:canceladas"), N("Todas", "b", "vendas:todas"))),
            N("Oficina", "ofi", null, N("Manutenções", "ofi", "oficina:todas", N("A Realizar", "y", "oficina:arealizar"), N("Realizadas", "g", "oficina:realizadas"), N("Todas", "b", "oficina:todas"))),
            N("Fidelidade", "fid", null, N("Contas", "fid", "fidelidade:contas"), N("Transações", "fin", "fidelidade:transacoes")),
            N("Vouchers", "vou", null, N("Vouchers", "vou", "vouchers:lista"), N("Histórico de Uso", "bat", "vouchers:uso")),
            N("Parceiros", "par", null, N("Parceiros", "par", "parceiros:lista"), N("Histórico de Comissões", "par", "parceiros:comissoes"), N("Comissões Pagas", "par", "parceiros:pagas")),
        ]);
        _arvore.ExpandAll();
        _arvore.AfterSelect += (_, e) => { if (e.Node.Tag is string k) { _filtroBateria = null; Aplicar(k); } };
    }

    public void Selecionar(string chave, JsonObject bateria = null)
    {
        TreeNode Achar(TreeNodeCollection ns) { foreach (TreeNode n in ns) { if (n.Tag as string == chave && (n.Nodes.Count == 0 || chave.EndsWith("todas") && n.Text != "Todas")) return n; var f = Achar(n.Nodes); if (f != null) return f; } return null; }
        var no = Achar(_arvore.Nodes);
        _filtroBateria = bateria;
        if (no != null && _arvore.SelectedNode != no) { _arvore.SelectedNode = no; _filtroBateria = bateria; }
        Aplicar(chave);
    }

    void Aplicar(string chave)
    {
        var p = chave.Split(':');
        _grupo = p[0]; _status = p[1];
        _filtroBar.Visible = _grupo is "reservas" or "baterias" or "vendas";
        Recarregar();
    }

    // ------------------------------------------------------------------ visoes
    string Periodo()
    {
        var f = _filtro.SelectedIndex switch { 1 => "semana", 2 => "mes", 3 => "apartir", 4 => "todas", _ => "dia" };
        return $"filtro={f}&data={Fmt.Iso(_data.Value)}";
    }

    public void Recarregar() => Seguro.Rodar(this, CarregarAsync);

    async Task CarregarAsync()
    {
        List<JsonObject> rows = [];
        _grade.CorLinha = null;
        _grade.MenuDe = null;
        switch (_grupo)
        {
            case "reservas":
                _grade.Colunas([
                    new("pago", "Pago", TipoCol.Bool), new("dataHora", "Data/Hora", TipoCol.DataHora), new("reserva", "Reserva", Largura: 150), new("cliente", "Cliente", Largura: 240),
                    .. (Sessao.ParamSim("office.exibirColunaResponsavel", false) ? new Col[] { new("responsavel", "Responsável") } : []),
                    new("produto", "Produto", Largura: 220), new("categoria", "Categoria", Largura: 90), new("preco", "Preço (R$)", TipoCol.Dinheiro), new("desconto", "Desconto (R$)", TipoCol.Dinheiro),
                    new("total", "Total (R$)", TipoCol.Dinheiro), new("observacao", "Observação")]);
                _grade.CorLinha = r => r.S("status") == "cancelada" ? Color.Silver : !r.B("aprovada") ? Color.FromArgb(150, 90, 0) : null;
                _grade.MenuDe = MenuReservas;
                rows = await Sessao.Api.Lista($"/api/office/reservas?status={_status}&" + (_filtroBateria != null ? $"bateriaId={_filtroBateria.S("id")}" : Periodo()));
                break;
            case "baterias":
                _grade.Colunas([
                    new("dataHora", "Data/Hora", TipoCol.DataHora), new("nome", "Nome", Largura: 190), new("produto", "Produto", Largura: 220), new("vagas", "Vagas (máx)", TipoCol.Inteiro),
                    new("disponiveis", "Vagas (disponíveis)", TipoCol.Inteiro, 120), new("pagos", "Pagos", TipoCol.Inteiro, 60), new("preReservas", "Pré-reservas", TipoCol.Inteiro, 90),
                    new("responsavel", "Responsável", Largura: 170), new("status", "Situação", Largura: 80, Valor: r => r.S("status") == "aberta" ? "Aberta" : "Fechada"), new("autoAtendimento", "Totem", TipoCol.Bool)]);
                _grade.CorLinha = r => r.S("status") == "fechada" ? Color.Gray : null;
                _grade.MenuDe = MenuBaterias;
                rows = await Sessao.Api.Lista($"/api/office/baterias?status={_status}&{Periodo()}");
                break;
            case "vendas":
                _grade.Colunas([
                    new("dataHora", "Data/Hora", TipoCol.DataHora), new("codigo", "Código", Largura: 70), new("cliente", "Cliente", Largura: 200), new("documento", "Nº Documento", Largura: 110),
                    new("usuario", "Usuário", Largura: 110), new("terminal", "Terminal", Largura: 100), new("bruto", "Vendas (R$)", TipoCol.Dinheiro), new("desconto", "Descontos (R$)", TipoCol.Dinheiro),
                    new("acrescimo", "Acréscimos (R$)", TipoCol.Dinheiro), new("recebido", "Recebido (R$)", TipoCol.Dinheiro), new("troco", "Troco (R$)", TipoCol.Dinheiro),
                    new("estorno", "Estornos (R$)", TipoCol.Dinheiro), new("final", "Final (R$)", TipoCol.Dinheiro), new("cancelada", "Cancelado", TipoCol.Bool),
                    new("motivo", "Motivo do Cancelamento"), new("observacao", "Observação")]);
                _grade.CorLinha = r => r.B("cancelada") ? Color.Silver : null;
                _grade.MenuDe = MenuVendas;
                rows = await Sessao.Api.Lista($"/api/office/vendas?status={_status}&{Periodo()}");
                break;
            case "oficina":
                _grade.Colunas([
                    new("kart", "Kart", Largura: 60), new("categoria", "Categoria", Largura: 100), new("item", "Item de Manutenção", Largura: 200),
                    new("minutosUso", "Tempo de Uso", Largura: 100, Valor: r => $"{r.I("minutosUso") / 60}h{r.I("minutosUso") % 60:00}"), new("limiteHoras", "Limite (h)", TipoCol.Inteiro),
                    new("ultimaManutencao", "Última Manutenção", TipoCol.DataHora, 130), new("data", "Atualizado em", TipoCol.DataHora), new("realizada", "Realizada", TipoCol.Bool)]);
                _grade.MenuDe = MenuOficina;
                rows = await Sessao.Api.Lista($"/api/office/manutencoes?status={_status}");
                break;
            case "vouchers":
                if (_status == "uso")
                    _grade.Colunas([new("dataHora", "Data/Hora", TipoCol.DataHora), new("voucher", "Voucher"), new("cliente", "Cliente", Largura: 220), new("desconto", "Desconto (R$)", TipoCol.Dinheiro), new("vendaId", "Venda", TipoCol.Inteiro), new("estornado", "Estornado", TipoCol.Bool)]);
                else
                    _grade.Colunas([new("codigo", "Código"), new("origem", "Origem", Largura: 90), new("referencia", "Conta/Parceiro"), new("tipo", "Tipo desconto", Largura: 100),
                        new("valor", "Valor", Largura: 90, Valor: r => r.S("tipo") == "percentual" ? r.S("valor") + "%" : Fmt.Brl(r.L("valor"))), new("inicio", "Data inicial", TipoCol.Data), new("fim", "Data final", TipoCol.Data),
                        new("produto", "Produto"), new("usoMaxCliente", "Uso máx/cliente", TipoCol.Inteiro, 100), new("usoUnico", "Uso único", TipoCol.Bool), new("usos", "Usos", TipoCol.Inteiro, 60)]);
                _grade.MenuDe = _ => [new ToolStripMenuItem("Criar Voucher", null, (_, _) => { new FormVoucher("manual").ShowDialog(this); Recarregar(); }), new ToolStripSeparator(), Exportar("vouchers")];
                rows = await Sessao.Api.Lista(_status == "uso" ? "/api/office/vouchers/uso" : "/api/office/vouchers");
                break;
            case "fidelidade":
                _grade.Colunas([new("nome", "Conta"), new("saldo", "Saldo", TipoCol.Dinheiro)]);
                break;
            case "parceiros":
                _grade.Colunas([new("nome", "Parceiro"), new("comissao", "Comissão", TipoCol.Dinheiro)]);
                break;
        }
        _grade.Carregar(rows);
        Totais();
    }

    void Totais()
    {
        var v = _grade.Visiveis;
        var extra = _grupo switch
        {
            "reservas" => $"     Pagos: {v.Count(r => r.B("pago"))} · Pré-reservas: {v.Count(r => !r.B("aprovada") && r.S("status") != "cancelada")} · Total pago: {Fmt.Brl(v.Where(r => r.B("pago")).Sum(r => r.L("total") ?? 0))}",
            "baterias" => $"     Vagas: {v.Sum(r => r.I("vagas"))} · Reservas: {v.Sum(r => r.I("inscritos"))} · Pagos: {v.Sum(r => r.I("pagos"))}",
            "vendas" => $"     Total final: {Fmt.Brl(v.Where(r => !r.B("cancelada")).Sum(r => r.L("final") ?? 0))}",
            "fidelidade" => "     O programa de fidelidade não era usado no LapTime (nenhuma conta cadastrada).",
            "parceiros" => "     Nenhum parceiro cadastrado (o LapTime não tinha parceiros nem comissões).",
            _ => "",
        };
        var bat = _filtroBateria != null ? $"     Bateria: {_filtroBateria.S("nome")} {Fmt.DmyHm(_filtroBateria.S("dataHora"))} (clique na árvore para ver todas)" : "";
        _total.Text = $"Total de registros: {v.Count}{extra}{bat}";
    }

    ToolStripMenuItem Item(string t, Action a, bool hab = true) => new(t, null, (_, _) => a()) { Enabled = hab };
    ToolStripMenuItem Exportar(string nome) => Item("Exportar para Excel", () => _grade.ExportarExcel(nome));

    ToolStripItem[] MenuReservas(List<JsonObject> sel)
    {
        var umaSo = sel.Count == 1;
        var algumPago = sel.Any(r => r.B("pago"));
        var algumCanc = sel.Any(r => r.S("status") == "cancelada");
        return [
            Item("Aprovar", () => Caixa.CheckoutDeReservas(this, sel), sel.Count > 0 && !algumPago && !algumCanc),
            Item("Aprovar Pré-reserva (sem pagamento)", () => Acoes.AprovarPre(this, sel), sel.Any(r => !r.B("aprovada") && r.S("status") != "cancelada")),
            Item("Editar Reserva", () => Acoes.EditarReserva(this, sel[0]), umaSo),
            Item("Alterar Cliente", () => Acoes.AlterarCliente(this, sel[0]), umaSo && !algumCanc),
            Item("Mover Cliente", () => Acoes.MoverCliente(this, sel[0]), umaSo && !algumCanc),
            new ToolStripSeparator(),
            Item("Imprimir Termo", () => Acoes.ImprimirTermo(this, sel.Select(r => r.S("id")))),
            Item("Imprimir Ticket", () => Relatorio.Abrir(this, Sessao.Api.UrlComToken("/relatorio/ticket?ids=" + string.Join(",", sel.Select(r => r.S("id")))), "Ticket")),
            new ToolStripSeparator(),
            Item("Excluir", () => Acoes.ExcluirReservas(this, sel), sel.Count > 0),
            new ToolStripSeparator(),
            Exportar("reservas"),
        ];
    }

    ToolStripItem[] MenuBaterias(List<JsonObject> sel)
    {
        var umaSo = sel.Count == 1;
        return [
            Item("Abrir Bateria", () => Acoes.StatusBateria(this, sel, "aberta"), sel.Any(b => b.S("status") != "aberta")),
            Item("Fechar Bateria", () => Acoes.StatusBateria(this, sel, "fechada"), sel.Any(b => b.S("status") == "aberta")),
            Item("Editar Bateria", () => { if (new FormBateria(sel[0]).ShowDialog(this) == DialogResult.OK) Recarregar(); }, umaSo),
            Item("Incluir Cliente", () => { if (new FormIncluirCliente(sel[0]).ShowDialog(this) == DialogResult.OK) Recarregar(); }, umaSo),
            Item("Ver Reservas", () => Selecionar("reservas:todas", sel[0]), umaSo),
            Item("Lista de Participantes", () => Relatorio.Abrir(this, Sessao.Api.UrlComToken("/relatorio/participantes?bateria=" + sel[0].S("id")), "Lista de Participantes"), umaSo),
            new ToolStripSeparator(),
            Item("Excluir", () => Acoes.ExcluirBaterias(this, sel, false), sel.Count > 0),
            Item("Excluir Todas as Baterias Listadas", () => Acoes.ExcluirBaterias(this, _grade.Visiveis, true)),
            new ToolStripSeparator(),
            Exportar("baterias"),
        ];
    }

    ToolStripItem[] MenuVendas(List<JsonObject> sel)
    {
        var umaSo = sel.Count == 1;
        return [
            Item("Estornar Pagamento", () => { if (new FormEstorno(sel[0].L("id") ?? 0).ShowDialog(this) == DialogResult.OK) Recarregar(); }, umaSo && !sel[0].B("cancelada")),
            Item("Visualizar Métodos de Pagamento", () => new FormVenda(sel[0].L("id") ?? 0).ShowDialog(this), umaSo),
            Item("Imprimir Comprovante", () => Relatorio.Abrir(this, Sessao.Api.UrlComToken("/relatorio/venda?id=" + sel[0].S("id")), "Comprovante"), umaSo),
            new ToolStripSeparator(),
            Exportar("vendas"),
        ];
    }

    ToolStripItem[] MenuOficina(List<JsonObject> sel) => [
        Item("Marcar como Manutenção Realizada", () => Acoes.Manutencao(this, sel, true), sel.Count > 0),
        Item("Marcar Todos como Manutenção Realizada", () => Acoes.Manutencao(this, _grade.Visiveis, true)),
        Item("Desmarcar como Manutenção Realizada", () => Acoes.Manutencao(this, sel, false), sel.Count > 0),
        Item("Desmarcar Todos como Manutenção Realizada", () => Acoes.Manutencao(this, _grade.Visiveis, false)),
        new ToolStripSeparator(),
        Exportar("manutencoes"),
    ];

    protected override void OnShown(EventArgs e)
    {
        base.OnShown(e);
        _grade.Duplo += r =>
        {
            switch (_grupo)
            {
                case "reservas": if (r.B("pago") || r.S("status") == "cancelada") Acoes.EditarReserva(this, r); else Caixa.CheckoutDeReservas(this, [r]); break;
                case "baterias": Selecionar("reservas:todas", r); break;
                case "vendas": new FormVenda(r.L("id") ?? 0).ShowDialog(this); break;
            }
        };
    }
}
