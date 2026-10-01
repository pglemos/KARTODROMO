using System.Diagnostics;
using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

/// <summary>
/// Cronometragem (substitui o LapTime Timing): baterias do dia, competidores, bandeiras,
/// registro de passagens e resultado ao vivo, lidos do servico de cronometragem (ORBITS :4050).
/// </summary>
public partial class FormCrono : Form
{
    readonly string _autoteste;
    readonly System.Windows.Forms.Timer _leitura = new() { Interval = 1000 };
    readonly System.Windows.Forms.Timer _relogio = new() { Interval = 100 };
    JsonObject _state;
    JsonObject _sess;
    List<JsonObject> _laps = [];
    List<JsonObject> _agenda = [];
    JsonObject _catalog;
    JsonObject _selectedProof;
    List<JsonObject> _events = [], _groups = [], _proofs = [];
    DateTime _lidoEm = DateTime.Now;
    string _sel;
    bool _fixado, _ocupado, _servidorOk, _pilotosSujos;
    string _pilotosDe;
    FormTV _tv;

    // cabecalho da cronometragem
    readonly Label _lEvento = Info(), _lTipo = Info(), _lEstado = Info(), _lCrono = new(), _lRestante = Info(), _lVoltasRest = Info(), _lMelhor = Info(), _lRuido = Info(), _lPassagens = new();
    readonly ComboBox _cbSessao = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 420, Font = new Font("Segoe UI", 9.5F) };
    readonly ToolStrip _bandeiras = new() { GripStyle = ToolStripGripStyle.Hidden, ImageScalingSize = new Size(34, 34), BackColor = Color.White, Padding = new Padding(4, 2, 4, 2) };
    ToolStripButton _bVerde, _bQuad, _bCancelar;
    readonly LiveGrid _gPass = new(), _gRes = new(), _gSessoes = new(), _gAgenda = new();
    readonly LiveGrid _gEventos = new(), _gGrupos = new(), _gProvas = new(), _gObs = new(), _gResCategoria = new(), _gTransponderResultado = new();
    readonly LiveGrid _gResultComp = new(), _gCategoriaComp = new(), _gObsAoVivo = new();
    readonly DataGridView _gPilotos = new();
    readonly TreeView _arvore = new() { Dock = DockStyle.Fill, BorderStyle = BorderStyle.None, HideSelection = false, FullRowSelect = true, Font = new Font("Segoe UI", 9.5F) };
    string _arvoreAssinatura = "";
    bool _montandoArvore;
    readonly TextBox _txtObservacao = new() { Width = 380, Height = 32, Font = new Font("Segoe UI", 9.5F), PlaceholderText = "Observação desta prova (sai no rodapé do resultado)" };
    readonly TextBox _txtObservacaoAoVivo = new() { Width = 280, Height = 30, Font = new Font("Segoe UI", 9F), PlaceholderText = "Nova observação da prova" };
    readonly Label _lVoltaFaixa = new() { Text = "VOLTA\nAGUARDANDO", Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleCenter, BackColor = Color.FromArgb(29, 29, 31), ForeColor = Color.FromArgb(255, 214, 10), Font = new Font("Segoe UI", 9F, FontStyle.Bold) };
    readonly TabControl _tabsResultado = new AbasSemCabecalho { Dock = DockStyle.Fill, Font = new Font("Segoe UI", 8.5F) };
    readonly TabControl _tabsCompetidor = new AbasSemCabecalho { Dock = DockStyle.Fill, Font = new Font("Segoe UI", 9F) };
    ToolStripButton _bAmarela, _bVermelha, _bBranca, _bFinalizar, _bLimpar;
    readonly Label _lPilotosTitulo = new() { Dock = DockStyle.Top, Height = 34, Font = new Font("Segoe UI", 13F, FontStyle.Bold), ForeColor = Color.FromArgb(200, 16, 46), TextAlign = ContentAlignment.MiddleLeft, Padding = new Padding(4, 0, 0, 0) };
    readonly TabControl _abas = new AbasSemCabecalho { Dock = DockStyle.Fill, Font = new Font("Segoe UI", 9F) };
    readonly StatusStrip _status = new() { SizingGrip = false };
    readonly ToolStripStatusLabel _sHora = new(), _sData = new(), _sServidor = new(), _sDecoder = new(), _sTransp = new() { IsLink = true, ForeColor = Color.Red }, _sTv = new() { IsLink = true }, _sPainel = new() { IsLink = true };
    readonly PainelLed _painel = new();
    readonly Panel _pnlPainelLed = new();
    readonly Label _lPainelBadge = new();
    readonly Label _lPainelStatus = new();
    readonly Button _btnPag1 = new();
    readonly Button _btnPag2 = new();
    readonly Button _btnPag3 = new();
    readonly CheckBox _chkPainelAuto = new();
    readonly Button _btnPainelConfig = new();

    static Label Info() => new() { AutoSize = true, Font = new Font("Segoe UI", 9F, FontStyle.Bold) };

    public FormCrono(string autoteste)
    {
        _autoteste = autoteste;
        Text = "Kartódromo - Cronometragem";
        Icon = Icone.App;
        Font = TemaCrono.Normal;
        BackColor = TemaCrono.Fundo;
        KeyPreview = true;
        if (autoteste == null) WindowState = FormWindowState.Maximized;
        else { StartPosition = FormStartPosition.Manual; Location = Environment.GetEnvironmentVariable("KARTODROMO_TESTE") is "ordenacao" or "placar" or "telas" ? new Point(-4000, 0) : new Point(0, 0); ShowInTaskbar = Environment.GetEnvironmentVariable("KARTODROMO_TESTE") is not ("ordenacao" or "placar" or "telas"); Size = Environment.GetEnvironmentVariable("KARTODROMO_AUTOTESTE_TAMANHO") is string t && t.Split('x') is [var w, var h] ? new Size(int.Parse(w), int.Parse(h)) : new Size(1600, 960); }
        MinimumSize = new Size(1100, 700);

        MainMenuStrip = Menu();
        _abas.TabPages.Add(AbaEventosDesign());
        _abas.TabPages.Add(AbaBateriasDesign());
        _abas.TabPages.Add(AbaCronometragem());
        _abas.SelectedIndex = 2;
        _abas.SelectedIndexChanged += (_, _) =>
        {
            if (_abas.SelectedIndex == 0) { _ = CarregarAgenda(); _ = CarregarCatalogo(); }
            else if (_abas.SelectedIndex == 1) { MontarArvore(); }
        };

        _status.Items.AddRange([_sHora, Sep(), _sData, Sep(), _sServidor, Sep(), _sDecoder, Sep(), _sTv, Sep(), _sPainel, Sep(), _sTransp]);
        _sPainel.Click += (_, _) => ConfigurarPainel();
        _sTv.Text = "TV";
        _sTv.Click += (_, _) => AbrirTV();
        _sTransp.Click += (_, _) => Transponders();
        // design: cabeçalho com o menu e os passos, as páginas sem abas, rodapé com as pílulas
        Controls.Add(_abas);
        Controls.Add(CabecalhoDesign());
        Controls.Add(RodapeDesign());
        _abas.BringToFront();
        _passos.Selecionado = _abas.SelectedIndex;

        _leitura.Tick += async (_, _) => await Atualizar();
        _relogio.Tick += (_, _) => Relogio();
        KeyDown += (_, e) =>
        {
            if (e.KeyCode == Keys.F1) { e.Handled = true; Bandeira("verde"); }
            else if (e.KeyCode == Keys.F2) { e.Handled = true; Bandeira("amarela"); }
            else if (e.KeyCode == Keys.F3) { e.Handled = true; Bandeira("vermelha"); }
            else if (e.KeyCode == Keys.F4) { e.Handled = true; Bandeira("quadriculada"); }
            else if (e.KeyCode == Keys.F5) { e.Handled = true; Acao("close"); }
            else if (e.KeyCode == Keys.F6) { e.Handled = true; LimparPassagens(); }
            else if (e.KeyCode == Keys.F7) { e.Handled = true; Bandeira("branca"); }
            else if (e.Shift && e.KeyCode is Keys.F8 or Keys.F9 or Keys.F10) { e.Handled = true; PaginaTelao(e.KeyCode - Keys.F8); }
            else if (e.KeyCode == Keys.F8) { e.Handled = true; _chkPainelAuto.Checked = false; _painel.AutoAvanco = false; _painel.DefinirPagina(0); AtualizarBotoesPainel(); }
            else if (e.KeyCode == Keys.F9) { e.Handled = true; if (_painel.TotalPaginas >= 2) { _chkPainelAuto.Checked = false; _painel.AutoAvanco = false; _painel.DefinirPagina(1); AtualizarBotoesPainel(); } }
            else if (e.KeyCode == Keys.F10) { e.Handled = true; if (_painel.TotalPaginas >= 3) { _chkPainelAuto.Checked = false; _painel.AutoAvanco = false; _painel.DefinirPagina(2); AtualizarBotoesPainel(); } }
            else if (e.KeyCode == Keys.Insert) { e.Handled = true; IncluirPassagem(); }
            else if (e.KeyCode == Keys.Delete) { e.Handled = true; CorrigirPassagem("delete"); }
            else if (e.KeyCode == Keys.F11) { e.Handled = true; AbrirTV(); }
        };
        Shown += async (_, _) =>
        {
            await Atualizar();
            await CarregarAgenda();
            await CarregarCatalogo();
            if (_autoteste != null) { await AutoTeste(); return; }
            // sem bateria na pista, abre na agenda da recepção (é de lá que se cria a próxima bateria com os pilotos)
            if (string.IsNullOrEmpty(_state?.S("runningId"))) _abas.SelectedIndex = 0;
            _leitura.Start();
            _relogio.Start();
        };
        FormClosed += (_, _) => { _tv?.Close(); _painel.Dispose(); };
    }

    void DesenharAba(DrawItemEventArgs e)
    {
        var page = _abas.TabPages[e.Index];
        var selected = e.Index == _abas.SelectedIndex;
        using var brush = new SolidBrush(selected ? Color.White : TemaCrono.Fundo);
        e.Graphics.FillRectangle(brush, e.Bounds);
        TextRenderer.DrawText(e.Graphics, page.Text, new Font("Segoe UI", 9F, selected ? FontStyle.Bold : FontStyle.Regular), e.Bounds, selected ? TemaCrono.Texto : TemaCrono.Secundario, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
    }

    static ToolStripSeparator Sep() => new();

    MenuStrip Menu()
    {
        var m = new MenuStrip { BackColor = Color.White, Padding = new Padding(6, 3, 0, 3) };
        var inicio = new ToolStripMenuItem("Início");
        inicio.DropDownItems.Add("Configurações iniciais", null, (_, _) => JanelaCadastro("ConfigInicial"));
        inicio.DropDownItems.Add(new ToolStripSeparator());
        var seguranca = new ToolStripMenuItem("Segurança");
        seguranca.DropDownItems.Add("Usuário", null, (_, _) => JanelaCadastro("SegUsuario"));
        seguranca.DropDownItems.Add("Perfil de acesso", null, (_, _) => JanelaCadastro("SegPerfil"));
        seguranca.DropDownItems.Add("Permissões de acesso", null, (_, _) => JanelaCadastro("Permissoes"));
        inicio.DropDownItems.Add(seguranca);
        inicio.DropDownItems.Add(new ToolStripSeparator());
        inicio.DropDownItems.Add(new ToolStripMenuItem("Fechar", null, (_, _) => Close()) { ShortcutKeyDisplayString = "Alt+F4" });
        var cad = new ToolStripMenuItem("Cadastros");
        cad.DropDownItems.Add("Empresa", null, (_, _) => JanelaCadastro("Empresa"));
        cad.DropDownItems.Add(new ToolStripSeparator());
        cad.DropDownItems.Add("Categoria", null, (_, _) => JanelaCadastro("CadCategoria"));
        cad.DropDownItems.Add("Traçado", null, (_, _) => JanelaCadastro("CadTracado"));
        cad.DropDownItems.Add("Grupo", null, (_, _) => JanelaCadastro("CadGrupo"));
        cad.DropDownItems.Add("Corridas (provas)", null, (_, _) => JanelaCadastro("Prova"));
        cad.DropDownItems.Add("Competidor", null, (_, _) => JanelaCadastro("Competidor"));
        cad.DropDownItems.Add(new ToolStripSeparator());
        cad.DropDownItems.Add("Decoder", null, (_, _) => JanelaCadastro("CadDecoder"));
        cad.DropDownItems.Add("Placar", null, (_, _) => JanelaCadastro("PlacarConfig"));
        cad.DropDownItems.Add("Transponder (De/Para)", null, (_, _) => Transponders());
        cad.DropDownItems.Add("Transponder × Competidor", null, (_, _) => JanelaCadastro("CadTranspCompetidor"));
        var ferr = new ToolStripMenuItem("Ferramentas");
        ferr.DropDownItems.Add("Parâmetros do sistema", null, (_, _) => JanelaCadastro("ParamSistema"));
        ferr.DropDownItems.Add("Parâmetros da cronometragem", null, (_, _) => JanelaCadastro("ParamCrono"));
        ferr.DropDownItems.Add("Painel de LED (porta serial)", null, (_, _) => ConfigurarPainel());
        ferr.DropDownItems.Add("E-mail dos resultados (pilotos)", null, (_, _) => ConfigurarEmail());
        ferr.DropDownItems.Add(new ToolStripSeparator());
        var backup = new ToolStripMenuItem("Backup de eventos");
        backup.DropDownItems.Add("Guardar o atual", null, (_, _) => JanelaCadastro("Backup"));
        backup.DropDownItems.Add("Guardar por data", null, (_, _) => JanelaCadastro("Backup"));
        ferr.DropDownItems.Add(backup);
        var rel = new ToolStripMenuItem("Relatórios");
        rel.DropDownItems.Add("Banner", null, (_, _) => JanelaCadastro("Banner"));
        rel.DropDownItems.Add("Ranking por peso", null, (_, _) => JanelaCadastro("RankingPeso"));
        rel.DropDownItems.Add("Diversos (resultados, mapas, grids)", null, (_, _) => AbrirRelatoriosCrono());
        var crono = new ToolStripMenuItem("Cronometragem");
        crono.DropDownItems.Add(new ToolStripMenuItem("Bandeira verde", null, (_, _) => Bandeira("verde")) { ShortcutKeyDisplayString = "F1" });
        crono.DropDownItems.Add(new ToolStripMenuItem("Bandeira amarela", null, (_, _) => Bandeira("amarela")) { ShortcutKeyDisplayString = "F2" });
        crono.DropDownItems.Add(new ToolStripMenuItem("Bandeira vermelha", null, (_, _) => Bandeira("vermelha")) { ShortcutKeyDisplayString = "F3" });
        crono.DropDownItems.Add(new ToolStripMenuItem("Bandeira quadriculada", null, (_, _) => Bandeira("quadriculada")) { ShortcutKeyDisplayString = "F4" });
        crono.DropDownItems.Add(new ToolStripMenuItem("Bandeira branca", null, (_, _) => Bandeira("branca")) { ShortcutKeyDisplayString = "F7" });
        crono.DropDownItems.Add(new ToolStripSeparator());
        var vermelho = Color.FromArgb(196, 40, 28);
        crono.DropDownItems.Add(new ToolStripMenuItem("Finalizar prova", null, (_, _) => Acao("close")) { ShortcutKeyDisplayString = "F5", ForeColor = vermelho });
        crono.DropDownItems.Add(new ToolStripMenuItem("Limpar passagens", null, (_, _) => LimparPassagens()) { ShortcutKeyDisplayString = "F6", ForeColor = vermelho });
        crono.DropDownItems.Add(new ToolStripMenuItem("Cancelar bateria", null, (_, _) => Acao("cancel")) { ForeColor = vermelho });
        crono.DropDownItems.Add(new ToolStripSeparator());
        crono.DropDownItems.Add(new ToolStripMenuItem("Nova bateria da agenda da recepção…", null, (_, _) => NovaBateria(null)));
        crono.DropDownItems.Add(new ToolStripMenuItem("Criar bateria da prova selecionada", null, (_, _) => CriarBateriaDaProva()));
        crono.DropDownItems.Add(new ToolStripMenuItem("Mudar corrida em andamento", null, (_, _) => MudarCorrida()));
        crono.DropDownItems.Add(new ToolStripMenuItem("Incluir passagem manual", null, (_, _) => IncluirPassagem()) { ShortcutKeyDisplayString = "Insert" });
        crono.DropDownItems.Add(new ToolStripSeparator());
        crono.DropDownItems.Add("Seguir a bateria em andamento", null, (_, _) => { _fixado = false; _ = Atualizar(); });
        rel.DropDownItems.Add("Resultado da bateria selecionada", null, (_, _) => Resultado());
        rel.DropDownItems.Add("WhatsApp", null, (_, _) => EnviarWhatsApp());
        rel.DropDownItems.Add("Enviar resultado por e-mail", null, (_, _) => EnviarEmail());
        var ajuda = new ToolStripMenuItem("Ajuda");
        ajuda.DropDownItems.Add("Suporte remoto (AnyDesk)", null, (_, _) =>
        {
            var anydesk = new[] { @"C:Program Files (x86)AnyDeskAnyDesk.exe", @"C:Program FilesAnyDeskAnyDesk.exe" }.FirstOrDefault(File.Exists);
            if (anydesk != null) System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(anydesk) { UseShellExecute = true });
            else Msg.Aviso(this, "O AnyDesk não está instalado neste computador.");
        });
        ajuda.DropDownItems.Add(new ToolStripSeparator());
        ajuda.DropDownItems.Add("Sobre", null, (_, _) => Msg.Info(this, $"Kartódromo - Cronometragem\nVersão {Application.ProductVersion.Split('+')[0]}\n\nServiço de cronometragem: {Config.CronoUrl}\nServidor da operação: {Config.ServidorUrl}\n\nAtalhos: F1 verde · F2 amarela · F3 vermelha · F4 quadriculada · F5 finalizar · F6 limpar passagens · F7 branca · F11 telão", "Sobre"));
        m.Items.AddRange([inicio, cad, ferr, rel, crono, ajuda]);
        return m;
    }

    TabPage AbaEventos()
    {
        var page = new TabPage("1–3 · Eventos") { BackColor = TemaCrono.Fundo, Padding = new Padding(8) };
        var root = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 3, Padding = new Padding(10) };
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 58));
        root.RowStyles.Add(new RowStyle(SizeType.Percent, 58));
        root.RowStyles.Add(new RowStyle(SizeType.Percent, 42));
        var intro = new Panel { Dock = DockStyle.Fill, BackColor = TemaCrono.Fundo };
        intro.Controls.Add(new Label { Text = "Eventos e provas", Dock = DockStyle.Top, Height = 32, Font = TemaCrono.Titulo, ForeColor = TemaCrono.Texto });
        intro.Controls.Add(new Label { Text = "Passos 1–3 · cadastre o evento, organize os grupos e configure cada prova.", Dock = DockStyle.Bottom, Height = 22, Font = TemaCrono.Pequena, ForeColor = TemaCrono.Secundario });
        var iniciarAgenda = TemaCrono.Botao("Criar bateria da agenda", true);
        iniciarAgenda.Anchor = AnchorStyles.Top | AnchorStyles.Right;
        iniciarAgenda.Location = new Point(Width - 270, 4);
        iniciarAgenda.Click += (_, _) => NovaBateria(_gAgenda.ChaveAtual as JsonObject);
        intro.Controls.Add(iniciarAgenda);

        TemaCrono.EstilizarGrade(_gEventos);
        _gEventos.Col("Evento", 220, DataGridViewContentAlignment.MiddleLeft, true).Col("Data", 92).Col("Local", 135, DataGridViewContentAlignment.MiddleLeft);
        TemaCrono.EstilizarGrade(_gGrupos);
        _gGrupos.Col("Grupo", 180, DataGridViewContentAlignment.MiddleLeft, true).Col("Categoria", 105).Col("Provas", 62);
        TemaCrono.EstilizarGrade(_gProvas);
        _gProvas.Col("Prova", 180, DataGridViewContentAlignment.MiddleLeft, true).Col("Tipo", 90).Col("Duração", 72).Col("Voltas", 62);
        TemaCrono.EstilizarGrade(_gAgenda);
        if (_gAgenda.Columns.Count == 0) _gAgenda.Col("Hora", 64).Col("Bateria", 160, DataGridViewContentAlignment.MiddleLeft, true).Col("Kart", 70).Col("Inscritos", 72).Col("Pagos", 62);
        TemaCrono.EstilizarGrade(_gSessoes);
        if (_gSessoes.Columns.Count == 0) _gSessoes.Col("Hora", 64).Col("Bateria", 180, DataGridViewContentAlignment.MiddleLeft, true).Col("Tipo", 100).Col("Estado", 100).Col("Pilotos", 58);

        _gEventos.CellClick += (_, e) => { if (e.RowIndex >= 0) _ = CarregarCatalogo(); };
        _gGrupos.CellClick += (_, e) => { if (e.RowIndex >= 0) _ = CarregarCatalogo(); };
        _gProvas.CellDoubleClick += (_, e) => { if (e.RowIndex >= 0) CriarBateriaDaProva(); };
        _gAgenda.CellDoubleClick += (_, e) => { if (e.RowIndex >= 0) NovaBateria(_gAgenda.Chaves[e.RowIndex] as JsonObject); };
        _gSessoes.CellClick += (_, e) => { if (e.RowIndex >= 0 && _gSessoes.Chaves[e.RowIndex] is JsonObject s) { Selecionar(s.S("id")); _abas.SelectedIndex = 1; } };

        var top = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 3, RowCount = 1, Margin = new Padding(0, 6, 0, 8) };
        top.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 33));
        top.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 31));
        top.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 36));
        var evCard = TemaCrono.Card("1 · Eventos", "Eventos e etapas do calendário");
        var evActions = BarraAcoes(("+ Novo", () => EditarCatalogo("events")), ("Editar", () => EditarCatalogo("events", true)), ("Excluir", () => ExcluirCatalogo("events")), ("Imprimir", () => ImprimirResumo("Eventos", _events.Select(x => x.S("name")).ToList())), ("Importar", () => ImportarCatalogo()), ("Exportar", () => ExportarCatalogo()), ("Duplicar", () => DuplicarEvento()));
        evCard.Controls.Add(_gEventos); evCard.Controls.Add(evActions);
        var grCard = TemaCrono.Card("2 · Grupos", "Organize as baterias por categoria");
        var grActions = BarraAcoes(("+ Novo", () => EditarCatalogo("groups")), ("Editar", () => EditarCatalogo("groups", true)), ("Excluir", () => ExcluirCatalogo("groups")), ("Imprimir", () => ImprimirResumo("Grupos", _groups.Select(x => x.S("name")).ToList())));
        grCard.Controls.Add(_gGrupos); grCard.Controls.Add(grActions);
        var provaCard = TemaCrono.Card("3 · Provas", "Tomada de tempo, treinos e corridas");
        var provaActions = BarraAcoes(("+ Nova prova", () => EditarCatalogo("provas")), ("Editar", () => EditarCatalogo("provas", true)), ("Excluir", () => ExcluirCatalogo("provas")), ("Distribuir", () => DistribuirProva()), ("Imprimir", () => ImprimirResumo("Provas", _proofs.Select(x => x.S("name")).ToList())), ("Criar bateria", () => CriarBateriaDaProva()));
        provaCard.Controls.Add(_gProvas); provaCard.Controls.Add(provaActions);
        top.Controls.Add(evCard, 0, 0); top.Controls.Add(grCard, 1, 0); top.Controls.Add(provaCard, 2, 0);

        var bottom = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1, Margin = new Padding(0, 4, 0, 0) };
        bottom.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 58)); bottom.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 42));
        var agCard = TemaCrono.Card("Agenda da recepção", "Baterias e provas cadastradas no produto da recepção");
        var agActions = BarraAcoes(("Atualizar", () => Seguro.Rodar(this, CarregarAgenda)), ("Criar bateria", () => NovaBateria(_gAgenda.ChaveAtual as JsonObject)));
        agCard.Controls.Add(_gAgenda); agCard.Controls.Add(agActions);
        var sessCard = TemaCrono.Card("Baterias da cronometragem", "Selecione para abrir competidores ou acompanhar ao vivo");
        var sessActions = BarraAcoes(("Nova bateria", () => NovaBateria(null)), ("Cronometrar", () => { if (_gSessoes.ChaveAtual is JsonObject s) { Selecionar(s.S("id")); _abas.SelectedIndex = 2; } }));
        sessCard.Controls.Add(_gSessoes); sessCard.Controls.Add(sessActions);
        bottom.Controls.Add(agCard, 0, 0); bottom.Controls.Add(sessCard, 1, 0);

        root.Controls.Add(intro, 0, 0); root.Controls.Add(top, 0, 1); root.Controls.Add(bottom, 0, 2);
        page.Controls.Add(root);
        page.Layout += (_, _) => { iniciarAgenda.Location = new Point(Math.Max(400, intro.ClientSize.Width - iniciarAgenda.Width - 12), 7); };
        return page;
    }

    FlowLayoutPanel BarraAcoes(params (string Texto, Action Acao)[] acoes)
    {
        var quebrar = acoes.Length >= 6;
        var bar = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = quebrar ? 78 : 43, WrapContents = quebrar, AutoScroll = !quebrar, Padding = new Padding(2, 4, 2, 2), BackColor = Color.White };
        foreach (var item in acoes)
        {
            var button = TemaCrono.Botao(item.Texto, item.Texto.StartsWith('+'));
            button.Click += (_, _) => item.Acao();
            bar.Controls.Add(button);
        }
        return bar;
    }

    // ------------------------------------------------------------------ passos 4–5: árvore, competidores e resultado

    TabPage AbaBaterias()
    {
        var page = new TabPage("4–5 · Competidores") { BackColor = TemaCrono.Fundo, Padding = new Padding(8) };
        var split = new SplitContainer { Size = new Size(1200, 680), Dock = DockStyle.Fill, SplitterWidth = 10, FixedPanel = FixedPanel.Panel1, Panel1MinSize = 250, Panel2MinSize = 600 };
        split.SplitterDistance = 330;
        var arvoreCard = TemaCrono.Card("4 · Grupos e provas", "Selecione uma prova para abrir sua bateria");
        _arvore.AfterSelect += (_, e) =>
        {
            if (_montandoArvore) return;
            if (e.Node?.Tag is not JsonObject tag) return;
            if (tag.S("kind") == "session") Selecionar(tag.S("sessionId"));
            else if (tag.S("kind") == "proof")
            {
                _selectedProof = _proofs.FirstOrDefault(p => p.S("id") == tag.S("proofId"));
                var session = Crono.Arr(_state, "sessions").FirstOrDefault(s => s.S("proofId") == tag.S("proofId"));
                if (session != null) Selecionar(session.S("id"));
                else _lPilotosTitulo.Text = _selectedProof?.S("name") ?? "Selecione uma prova";
            }
        };
        arvoreCard.Controls.Add(_arvore);
        split.Panel1.Controls.Add(arvoreCard);

        _gPilotos.Dock = DockStyle.Fill;
        TemaCrono.EstilizarGrade(_gPilotos, editavel: true);
        _gPilotos.Columns.Clear();
        _gPilotos.Columns.Add(new DataGridViewTextBoxColumn { Name = "kart", HeaderText = "Nº", Width = 70 });
        _gPilotos.Columns.Add(new DataGridViewTextBoxColumn { Name = "name", HeaderText = "Competidor", AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill, MinimumWidth = 150 });
        _gPilotos.Columns.Add(new DataGridViewTextBoxColumn { Name = "customerId", HeaderText = "Cliente", Width = 92, ReadOnly = true });
        _gPilotos.Columns.Add(new DataGridViewTextBoxColumn { Name = "category", HeaderText = "Categoria", Width = 125 });
        foreach (DataGridViewColumn col in _gPilotos.Columns) col.SortMode = DataGridViewColumnSortMode.Automatic;
        // Nº em ordem numérica (5 antes de 10); nomes em ordem alfabética sem diferenciar maiúscula/acento
        _gPilotos.SortCompare += (_, e) =>
        {
            var a = e.CellValue1?.ToString()?.Trim() ?? "";
            var b = e.CellValue2?.ToString()?.Trim() ?? "";
            if (e.Column.Name is "kart" or "customerId")
            {
                var na = long.TryParse(a, out var x); var nb = long.TryParse(b, out var y);
                e.SortResult = na && nb ? x.CompareTo(y) : na ? -1 : nb ? 1 : string.Compare(a, b, StringComparison.CurrentCultureIgnoreCase);
            }
            else
            {
                // vazio vai para o fim
                e.SortResult = a.Length == 0 && b.Length > 0 ? 1 : b.Length == 0 && a.Length > 0 ? -1
                    : string.Compare(a, b, Fmt.Br, System.Globalization.CompareOptions.IgnoreCase | System.Globalization.CompareOptions.IgnoreNonSpace);
            }
            if (e.SortResult == 0) e.SortResult = e.RowIndex1.CompareTo(e.RowIndex2);
            e.Handled = true;
        };
        _gPilotos.CellValueChanged += (_, _) => _pilotosSujos = true;
        _gPilotos.UserDeletedRow += (_, _) => _pilotosSujos = true;
        var flagsPiloto = new ContextMenuStrip();
        flagsPiloto.Items.Add("Trocar kart do piloto… (leva as voltas)", null, (_, _) => TrocarKart());
        flagsPiloto.Items.Add(new ToolStripSeparator());
        flagsPiloto.Items.Add("Bandeira verde para o piloto", null, (_, _) => BandeiraPiloto("green"));
        flagsPiloto.Items.Add("Bandeira amarela para o piloto", null, (_, _) => BandeiraPiloto("yellow"));
        flagsPiloto.Items.Add("Bandeira vermelha para o piloto", null, (_, _) => BandeiraPiloto("red"));
        flagsPiloto.Items.Add("Bandeira branca para o piloto", null, (_, _) => BandeiraPiloto("white"));
        _gPilotos.ContextMenuStrip = flagsPiloto;

        SetupResultado(_gResultComp);
        SetupResultado(_gCategoriaComp);
        _gResultComp.CellDoubleClick += (_, e) => { if (e.RowIndex >= 0 && _gResultComp.Chaves[e.RowIndex] is JsonObject s) Voltas(s.S("kart")); };
        _gCategoriaComp.CellDoubleClick += (_, e) => { if (e.RowIndex >= 0 && _gCategoriaComp.Chaves[e.RowIndex] is JsonObject s) Voltas(s.S("kart")); };
        _gObs.Dock = DockStyle.Fill;
        TemaCrono.EstilizarGrade(_gObs);
        _gObs.Col("Hora", 94).Col("Observação", 440, DataGridViewContentAlignment.MiddleLeft, true).Col("Responsável", 130);

        var details = _tabsCompetidor;
        details.TabPages.Clear();
        var tabComp = new TabPage("Competidores") { BackColor = Color.White };
        var banner = new Panel { Dock = DockStyle.Top, Height = 42, BackColor = Color.FromArgb(239, 246, 255), Padding = new Padding(10, 5, 10, 5) };
        banner.Controls.Add(new Label { Text = "Puxe os inscritos da recepção e revise categoria e kart antes da largada.", Dock = DockStyle.Fill, ForeColor = Color.FromArgb(10, 79, 160), Font = TemaCrono.Pequena, TextAlign = ContentAlignment.MiddleLeft });
        var barraP = BarraAcoes(
            ("+ Novo participante", () => { _gPilotos.Rows.Add("", "", "", ""); _pilotosSujos = true; }),
            ("Salvar", () => Seguro.Rodar(this, SalvarPilotos)),
            ("Puxar da recepção", () => Seguro.Rodar(this, PuxarAgenda)),
            ("Excluir", () => { foreach (DataGridViewRow row in _gPilotos.SelectedRows) if (!row.IsNewRow) _gPilotos.Rows.Remove(row); _pilotosSujos = true; }),
            ("Transponders", Transponders),
            ("Imprimir", () => ImprimirResumo("Competidores", Crono.Arr(_sess, "competitors").Select(c => $"{c.S("kart")} · {c.S("name")}").ToList())));
        tabComp.Controls.Add(_gPilotos); tabComp.Controls.Add(barraP); tabComp.Controls.Add(banner);

        var tabOficial = new TabPage("Resultado oficial") { BackColor = Color.White }; tabOficial.Controls.Add(_gResultComp);
        var tabCategoria = new TabPage("Por categoria") { BackColor = Color.White }; tabCategoria.Controls.Add(_gCategoriaComp);
        var tabObs = new TabPage("Observações") { BackColor = Color.White };
        _gObs.Dock = DockStyle.Fill;
        var obsInput = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 48, WrapContents = false, Padding = new Padding(8, 6, 8, 4), BackColor = Color.White };
        _txtObservacao.Width = 550;
        var addObs = TemaCrono.Botao("Adicionar", true); addObs.Click += (_, _) => Seguro.Rodar(this, AdicionarObservacao);
        obsInput.Controls.Add(_txtObservacao); obsInput.Controls.Add(addObs);
        tabObs.Controls.Add(_gObs); tabObs.Controls.Add(obsInput);
        details.TabPages.AddRange([tabComp, tabOficial, tabCategoria, tabObs]);
        details.SelectedIndexChanged += (_, _) => { _abaCompetidores = details.SelectedTab?.Text ?? "Competidores"; AtualizarResultadoCompetidores(); };

        var right = new Panel { Dock = DockStyle.Fill, BackColor = Color.White };
        var header = new Panel { Dock = DockStyle.Top, Height = 68, Padding = new Padding(12, 8, 12, 8), BackColor = Color.White };
        _lPilotosTitulo.Dock = DockStyle.Top; _lPilotosTitulo.Height = 31; _lPilotosTitulo.Font = new Font("Segoe UI", 14F, FontStyle.Bold); _lPilotosTitulo.ForeColor = TemaCrono.Texto;
        var resumo = new Label { Text = "Passo 5 · competidores, resultados e observações da prova", Dock = DockStyle.Bottom, Height = 22, Font = TemaCrono.Pequena, ForeColor = TemaCrono.Secundario };
        header.Controls.Add(_lPilotosTitulo); header.Controls.Add(resumo);
        right.Controls.Add(details); right.Controls.Add(header);
        split.Panel2.Controls.Add(right);
        page.Controls.Add(split);
        page.Layout += (_, _) => { if (split.Width > 1000 && split.SplitterDistance < 260) split.SplitterDistance = 330; };
        return page;
    }

    string _abaCompetidores = "Competidores";

    void SetupResultado(LiveGrid grid)
    {
        TemaCrono.EstilizarGrade(grid);
        if (grid.Columns.Count == 0)
            grid.Col("Pos", 60, DataGridViewContentAlignment.MiddleLeft).Col("Nº", 46).Col("Competidor", 160, DataGridViewContentAlignment.MiddleLeft, true).Col("M.V", 38).Col("T.M.V", 74, DataGridViewContentAlignment.MiddleRight).Col("Volta", 44, DataGridViewContentAlignment.MiddleRight).Col("T.U.V", 74, DataGridViewContentAlignment.MiddleRight).Col("T.T", 94, DataGridViewContentAlignment.MiddleRight).Col("D.L", 72, DataGridViewContentAlignment.MiddleRight).Col("D.A", 66, DataGridViewContentAlignment.MiddleRight).Col("V.Méd", 58, DataGridViewContentAlignment.MiddleRight);
        foreach (var c in new[] { 4, 6, 7, 8, 9 }) grid.Columns[c].DefaultCellStyle.Font = new Font("Cascadia Mono", 9F);
        grid.Columns[3].DefaultCellStyle.ForeColor = TemaCrono.Secundario;
    }

    string SituacaoPassagem(JsonObject p)
    {
        if (p.B("deleted")) return "Excluída";
        if (p.B("invalid")) return "Volta invalidada";
        if (!p.B("rejected")) return p.L("lapMs") == null ? "Abriu a volta" : p.S("source") == "manual" ? "Manual" : "Volta";
        var minimo = (_sess?.L("minLapMs") ?? 0) / 1000;
        return p.S("reason") switch
        {
            "ignored-min-lap" => $"Ignorada · mín. {minimo}s",
            "transponder-desconhecido" => "Transponder desconhecido",
            "ignored-finished" => "Kart já encerrou",
            "ignored-red-flag" => "Bandeira vermelha",
            "ignored-state" => "Prova não está correndo",
            _ => "Ignorada",
        };
    }

    static string Velocidade(JsonObject r) => double.TryParse(r["averageSpeedKmh"]?.ToString(), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var speed) ? speed.ToString("0.0", Fmt.Br) : "—";

    Button BotaoGrande(string texto, string glifo, Color cor, Func<Task> clique)
    {
        var b = new BotaoPlano { Text = texto, Image = Icone.Tile(glifo, cor, 18), TextImageRelation = TextImageRelation.ImageAboveText, Size = new Size(92, 48), FlatStyle = FlatStyle.System, Font = new Font("Segoe UI", 8F), Margin = new Padding(0, 0, 8, 0) };
        b.FlatStyle = FlatStyle.Standard;
        b.Click += (_, _) => Seguro.Rodar(this, clique);
        return b;
    }

    // ------------------------------------------------------------------ cronômetro e operações ao vivo

    TabPage AbaCronometragem()
    {
        var page = new TabPage("Cronometragem") { BackColor = TemaCrono.Fundo, Padding = new Padding(8) };
        _lEvento.Text = "Selecione uma bateria";
        _lCrono.Dock = DockStyle.Fill; _lCrono.Text = "00:00:00.000"; _lCrono.Font = new Font("Cascadia Mono", 25F, FontStyle.Bold); _lCrono.ForeColor = Color.White; _lCrono.TextAlign = ContentAlignment.MiddleCenter;
        _lRestante.ForeColor = TemaCrono.Vermelho; _lVoltasRest.ForeColor = TemaCrono.Texto; _lRuido.ForeColor = TemaCrono.Verde; _lMelhor.ForeColor = Color.FromArgb(122, 47, 194);
        _lEvento.Font = new Font("Segoe UI", 11F, FontStyle.Bold); _lTipo.Font = new Font("Segoe UI", 9F, FontStyle.Bold); _lEstado.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
        _lPassagens.Text = "0"; _lPassagens.Font = new Font("Cascadia Mono", 16F, FontStyle.Bold); _lPassagens.TextAlign = ContentAlignment.MiddleLeft; _lMelhor.AutoEllipsis = true; _lPassagens.ForeColor = TemaCrono.Texto;

        var metrics = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 3, Padding = new Padding(4, 4, 4, 8) };
        metrics.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 31)); metrics.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 28)); metrics.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 41));
        var metaCard = TemaCrono.Card("Prova selecionada");
        var meta = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 3, Padding = new Padding(3) };
        meta.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 82)); meta.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        void MetaLinha(string label, Control value) { meta.Controls.Add(TemaCrono.Rotulo(label, 9)); value.Margin = new Padding(2); meta.Controls.Add(value); }
        MetaLinha("Bateria", _lEvento); MetaLinha("Tipo", _lTipo); MetaLinha("Estado", _lEstado); metaCard.Controls.Add(meta);
        var clockCard = TemaCrono.Card(); clockCard.BackColor = Color.FromArgb(29, 29, 31); _lCrono.BackColor = Color.FromArgb(29, 29, 31); clockCard.Controls.Add(_lCrono);
        clockCard.Controls.Add(new Label { Text = "CRONÔMETRO", Dock = DockStyle.Top, Height = 22, Font = new Font("Segoe UI", 8.5F, FontStyle.Bold), ForeColor = Color.FromArgb(174, 174, 178), TextAlign = ContentAlignment.MiddleCenter, BackColor = Color.FromArgb(29, 29, 31) });
        var timesCard = TemaCrono.Card("Ao vivo");
        var times = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 4, RowCount = 2, Padding = new Padding(5, 2, 2, 2) };
        times.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize)); times.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 38)); times.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize)); times.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 62));
        times.Controls.Add(TemaCrono.Rotulo("Tempo restante")); times.Controls.Add(_lRestante);
        times.Controls.Add(TemaCrono.Rotulo("Voltas restantes")); times.Controls.Add(_lVoltasRest);
        times.Controls.Add(TemaCrono.Rotulo("Ruído / decoder")); times.Controls.Add(_lRuido);
        times.Controls.Add(TemaCrono.Rotulo("Melhor volta")); times.Controls.Add(_lMelhor);
        timesCard.Controls.Add(times);
        metrics.Controls.Add(metaCard, 0, 0); metrics.Controls.Add(clockCard, 1, 0); metrics.Controls.Add(timesCard, 2, 0);

        _bandeiras.Items.Clear(); _bandeiras.BackColor = Color.FromArgb(251, 251, 253); _bandeiras.Dock = DockStyle.Top; _bandeiras.GripStyle = ToolStripGripStyle.Hidden; _bandeiras.ImageScalingSize = new Size(26, 26); _bandeiras.Padding = new Padding(8, 3, 8, 3);
        _bVerde = Band("Verde · F1", Bandeira(Color.FromArgb(52, 199, 89)), "Largada (F1)", () => Bandeira("verde"));
        _bAmarela = Band("Amarela · F2", Bandeira(Color.FromArgb(255, 204, 0)), "Atenção (F2)", () => Bandeira("amarela"));
        _bVermelha = Band("Vermelha · F3", Bandeira(Color.FromArgb(255, 59, 48)), "Prova interrompida (F3)", () => Bandeira("vermelha"));
        _bQuad = Band("Quadriculada · F4", Quadriculada(), "Cada kart encerra na próxima passagem (F4)", () => Bandeira("quadriculada"));
        _bFinalizar = Band("Finalizar · F5", Icone.Tile("■", TemaCrono.Vermelho, 26), "Finalizar a prova agora (F5)", () => Acao("close"));
        _bLimpar = Band("Limpar · F6", Icone.Tile("↻", TemaCrono.Verde, 26), "Limpar passagens (F6)", LimparPassagens);
        _bBranca = Band("Branca · F7", Bandeira(Color.White), "Última volta (F7)", () => Bandeira("branca"));
        _bCancelar = Band("Cancelar", Icone.Tile("×", Color.FromArgb(120, 120, 120), 26), "Cancelar a bateria", () => Acao("cancel"));
        _bandeiras.Items.AddRange([_bVerde, _bAmarela, _bVermelha, _bQuad, _bFinalizar, _bLimpar, _bBranca, _bCancelar, new ToolStripSeparator()]);
        _bandeiras.Items.Add(Band("Nova bateria", Icone.Tile("+", TemaCrono.Verde, 26), "Criar bateria", () => NovaBateria(null)));
        _bandeiras.Items.Add(Band("Resultado", Icone.Tile("▤", Color.FromArgb(70, 70, 70), 26), "Relatórios de cronometragem (resultados, mapas, grids)", AbrirRelatoriosCrono));
        _bandeiras.Items.Add(Band("WhatsApp", Icone.Tile("W", Color.FromArgb(37, 211, 102), 26), "Enviar resultado", EnviarWhatsApp));
        _bandeiras.Items.Add(Band("E-mail", Icone.Tile("✉", Color.FromArgb(10, 132, 255), 26), "Enviar resultado por e-mail", EnviarEmail));
        _bandeiras.Items.Add(Band("Placar / TV", Icone.Tile("▣", Color.FromArgb(0, 99, 177), 26), "Abrir placar / telão (F11)", AbrirTV));
        _bandeiras.Items.Add(new ToolStripSeparator());
        _cbSessao.Width = 310;
        _cbSessao.SelectionChangeCommitted += (_, _) => { if (_cbSessao.SelectedItem is Campos.Item it) Selecionar(it.Dados.S("id")); };

        if (_gPass.Columns.Count == 0) _gPass.Col("#", 36).Col("Nº", 42, filtro: true).Col("Competidor", 130, DataGridViewContentAlignment.MiddleLeft, true, filtro: true).Col("Transp.", 72, filtro: true).Col("Tempo", 76).Col("Volta", 44, filtro: true).Col("Hora", 84).Col("Situação", 150, DataGridViewContentAlignment.MiddleLeft, filtro: true);
        TemaCrono.EstilizarGrade(_gPass);
        _gPass.CorFundo = r =>
        {
            if (r >= 0 && r < _gPass.Chaves.Count && _gPass.Chaves[r] is JsonObject p)
            {
                if (p.B("invalid")) return Color.FromArgb(255, 59, 48);
                if (p.B("deleted")) return Color.FromArgb(238, 238, 242);
                if (p.B("rejected")) return p.S("reason") == "transponder-desconhecido" ? Color.FromArgb(255, 236, 234) : Color.FromArgb(255, 248, 225);
            }
            return null;
        };
        _gPass.CorFonteLinha = r => r < _gPass.Chaves.Count && _gPass.Chaves[r] is JsonObject p && p.B("invalid") ? Color.White : null;
        var menuPass = new ContextMenuStrip();
        menuPass.Items.Add("Contar esta leitura como volta (ignorada)", null, (_, _) => CorrigirPassagem("restore"));
        menuPass.Items.Add(new ToolStripSeparator());
        menuPass.Items.Add("Excluir passagem manualmente", null, (_, _) => CorrigirPassagem("delete"));
        menuPass.Items.Add("Excluir passagens acima", null, (_, _) => CorrigirPassagem("delete", true));
        menuPass.Items.Add(new ToolStripSeparator());
        menuPass.Items.Add("Restaurar passagem manualmente", null, (_, _) => CorrigirPassagem("restore"));
        menuPass.Items.Add("Restaurar passagens acima", null, (_, _) => CorrigirPassagem("restore", true));
        menuPass.Items.Add(new ToolStripSeparator());
        menuPass.Items.Add("Invalidar passagem manualmente", null, (_, _) => CorrigirPassagem("invalidate"));
        menuPass.Items.Add("Invalidar passagens acima", null, (_, _) => CorrigirPassagem("invalidate", true));
        menuPass.Items.Add("Validar passagem manualmente", null, (_, _) => CorrigirPassagem("validate"));
        menuPass.Items.Add("Validar passagens acima", null, (_, _) => CorrigirPassagem("validate", true));
        menuPass.Items.Add(new ToolStripSeparator());
        menuPass.Items.Add("Incluir passagem manualmente · Insert", null, (_, _) => IncluirPassagem());
        menuPass.Items.Add("Atribuir passagem a um competidor", null, (_, _) => AtribuirPassagem());
        menuPass.Items.Add("Cancelar atribuição ao competidor", null, (_, _) => CancelarAtribuicao());
        _gPass.ContextMenuStrip = menuPass;

        SetupResultado(_gRes); SetupResultado(_gResCategoria);
        var menuRes = new ContextMenuStrip();
        menuRes.Items.Add("Trocar kart do piloto… (leva as voltas)", null, (_, _) => TrocarKart());
        menuRes.Items.Add("Registro do competidor…", null, (_, _) => RegistroCompetidorSelecionado());
        _gRes.ContextMenuStrip = menuRes;
        _gRes.CellMouseDown += (_, e) => { if (e.Button == MouseButtons.Right && e.RowIndex >= 0 && e.RowIndex < _gRes.Rows.Count) { _gRes.ClearSelection(); _gRes.Rows[e.RowIndex].Selected = true; _gRes.CurrentCell = _gRes.Rows[e.RowIndex].Cells[0]; } };
        _gRes.CorTexto = (row, col) => col == 0 && row < _gRes.Chaves.Count && _gRes.Chaves[row] is JsonObject standing ? CorAtraso(standing) : null;
        _gRes.CellDoubleClick += (_, e) => { if (e.RowIndex >= 0 && _gRes.Chaves[e.RowIndex] is JsonObject s) Voltas(s.S("kart")); };
        _gResCategoria.CellDoubleClick += (_, e) => { if (e.RowIndex >= 0 && _gResCategoria.Chaves[e.RowIndex] is JsonObject s) Voltas(s.S("kart")); };
        _gTransponderResultado.Col("Transponder", 110).Col("Última volta", 110).Col("Tempo decorrido", 130).Col("Hora cronológica", 150).Col("Nº passagens", 110);
        TemaCrono.EstilizarGrade(_gTransponderResultado);
        _gObsAoVivo.Col("Hora", 95).Col("Observação", 400, DataGridViewContentAlignment.MiddleLeft, true).Col("Responsável", 140);
        TemaCrono.EstilizarGrade(_gObsAoVivo);

        // ---- design (AoVivo.dc.html): passagens 470 px · resultado · faixa do placar 84 px
        _gPass.Columns[3].Visible = false; // transponder: fica no filtro/diálogo, fora da vista
        _gPass.Columns[7].Visible = false; // situação: vira cor da linha + dica ao parar o mouse
        _gPass.Columns[0].Width = 36; _gPass.Columns[1].Width = 44; _gPass.Columns[4].Width = 70; _gPass.Columns[5].Width = 50; _gPass.Columns[6].Width = 90;
        _gPass.Columns[2].MinimumWidth = 100; // o nome ocupa o que sobra, sem barra de rolagem lateral
        _gPass.Columns[6].HeaderText = "Hora";
        foreach (var c in new[] { 4, 6 }) _gPass.Columns[c].DefaultCellStyle.Font = new Font("Cascadia Mono", 8.4F);
        _gPass.Columns[1].DefaultCellStyle.Font = new Font("Cascadia Mono", 9.4F, FontStyle.Bold);
        foreach (var c in new[] { 4, 5, 6 }) _gPass.Columns[c].DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleRight;
        _gPass.RowTemplate.Height = 33;
        _gPass.ShowCellToolTips = true;
        _gPass.CellToolTipTextNeeded += (_, e) => { if (e.RowIndex >= 0 && e.RowIndex < _gPass.Rows.Count) e.ToolTipText = _gPass.Rows[e.RowIndex].Cells[7].Value?.ToString(); };
        var passCard = new TemaCrono.PainelArredondado { Dock = DockStyle.Fill, BackColor = Color.White, Raio = 14, Margin = new Padding(0, 0, 12, 0) };
        var passTopo = new Panel { Dock = DockStyle.Top, Height = 38 };
        passTopo.Paint += (_, e) =>
        {
            using var lg = new System.Drawing.Drawing2D.LinearGradientBrush(passTopo.ClientRectangle, Color.FromArgb(52, 199, 89), Color.FromArgb(30, 158, 74), 90f);
            e.Graphics.FillRectangle(lg, passTopo.ClientRectangle);
            TextRenderer.DrawText(e.Graphics, "REGISTRO DE PASSAGENS", new Font("Segoe UI", 9.4F, FontStyle.Bold), new Rectangle(14, 0, 300, 38), Color.White, TextFormatFlags.VerticalCenter);
            TextRenderer.DrawText(e.Graphics, "Botão direito: corrigir", new Font("Segoe UI", 9F), new Rectangle(0, 0, passTopo.Width - 14, 38), Color.FromArgb(235, 255, 255, 255), TextFormatFlags.VerticalCenter | TextFormatFlags.Right);
        };
        passCard.Controls.Add(_gPass); passCard.Controls.Add(passTopo); _gPass.BringToFront();

        SetupResultado(_gRes); SetupResultado(_gResCategoria);
        _gRes.CorTexto = (row, col) => col == 4 && row < _gRes.Chaves.Count && _gRes.Chaves[row] is JsonObject st && st.L("bestLapMs") is long bl && bl == MelhorDaProva() ? Color.FromArgb(122, 47, 194) : null;
        EstilizarResultado(_gRes); EstilizarResultado(_gResCategoria);
        _tabsResultado.TabPages.Clear();
        var tabOficial = new TabPage("Oficial") { BackColor = Color.White }; tabOficial.Controls.Add(_gRes);
        var tabCategoria = new TabPage("Categoria") { BackColor = Color.White }; tabCategoria.Controls.Add(_gResCategoria);
        var tabTransponder = new TabPage("Transponder") { BackColor = Color.White }; tabTransponder.Controls.Add(_gTransponderResultado);
        var tabObservacoes = new TabPage("Observações") { BackColor = Color.White };
        var obsBar = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 44, WrapContents = false, Padding = new Padding(10, 6, 10, 0), BackColor = Color.White };
        var addObsLive = TemaCrono.Botao("Adicionar", true); addObsLive.Click += (_, _) => Seguro.Rodar(this, AdicionarObservacao);
        obsBar.Controls.Add(_txtObservacaoAoVivo); obsBar.Controls.Add(addObsLive);
        tabObservacoes.Controls.Add(_gObsAoVivo); tabObservacoes.Controls.Add(obsBar); _gObsAoVivo.BringToFront();
        _tabsResultado.TabPages.AddRange([tabOficial, tabCategoria, tabTransponder, tabObservacoes]);
        var resultCard = new TemaCrono.PainelArredondado { Dock = DockStyle.Fill, BackColor = Color.White, Raio = 14, Margin = new Padding(0, 0, 12, 0) };
        var resTopo = new Panel { Dock = DockStyle.Top, Height = 38, BackColor = Color.White };
        resTopo.Paint += (_, e) => { using var p = new Pen(Color.FromArgb(237, 237, 237)); e.Graphics.DrawLine(p, 0, 37, resTopo.Width, 37); };
        var segRes = new SegmentoDesign { Location = new Point(10, 3), BackColor = Color.White };
        segRes.Itens = ["Resultado oficial", "Por categoria", "Por transponder", "Observações"];
        segRes.Mudou += i => _tabsResultado.SelectedIndex = i;
        _tabsResultado.SelectedIndexChanged += (_, _) => segRes.Selecionado = _tabsResultado.SelectedIndex;
        resTopo.Controls.Add(segRes);
        resultCard.Controls.Add(_tabsResultado); resultCard.Controls.Add(Legenda()); resultCard.Controls.Add(resTopo); _tabsResultado.BringToFront();

        _faixa = new FaixaPlacar { Dock = DockStyle.Fill, Margin = Padding.Empty };
        _faixa.EscolheuPagina += p => { _chkPainelAuto.Checked = false; _painel.AutoAvanco = false; _painel.DefinirPagina(p); AtualizarBotoesPainel(); AtualizarDesign(); };
        _faixa.EscolheuPaginaTelao += PaginaTelao;
        _faixa.AlternouAuto += () => { _chkPainelAuto.Checked = !_chkPainelAuto.Checked; AtualizarDesign(); };

        var main = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 3, RowCount = 1, Padding = new Padding(18, 12, 18, 12), BackColor = TemaCrono.Fundo };
        main.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 482)); main.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); main.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 84)); // passagens 442 → 482: cortava nome e hora
        main.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        main.Controls.Add(passCard, 0, 0); main.Controls.Add(resultCard, 1, 0); main.Controls.Add(_faixa, 2, 0);
        page.Padding = Padding.Empty;
        page.Controls.Add(main); page.Controls.Add(BarraAoVivo()); page.Controls.Add(InfoAoVivo());
        main.BringToFront();
        CriarBarraPainelLed(); // os botões de página continuam valendo nos atalhos F8/F9/F10
        return page;
    }

    /// <summary>Diferença como no design: 1.906 (segundos) até 1 min, depois 1:02.470.</summary>
    static string Gap(long? ms) => ms is not long v ? "" : v < 60_000 ? (v / 1000.0).ToString("0.000", System.Globalization.CultureInfo.InvariantCulture) : Crono.Volta(v).TrimStart('0');

    long? MelhorDaProva() => Crono.Arr(_sess, "standings").Select(x => x.L("bestLapMs")).Where(x => x != null).DefaultIfEmpty(null).Min();



    ToolStripButton Band(string texto, Image img, string dica, Action clique)
    {
        var b = new ToolStripButton(texto, img, (_, _) => clique()) { TextImageRelation = TextImageRelation.ImageAboveText, ToolTipText = dica, Font = new Font("Segoe UI", 8F), AutoSize = true, Padding = new Padding(4, 0, 4, 0) };
        return b;
    }

    static Bitmap Bandeira(Color cor)
    {
        var bmp = new Bitmap(34, 34);
        using var g = Graphics.FromImage(bmp);
        g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        using var haste = new Pen(Color.FromArgb(90, 90, 90), 2.5f);
        g.DrawLine(haste, 6, 3, 6, 32);
        using var b = new SolidBrush(cor);
        g.FillPolygon(b, new PointF[] { new(7, 4), new(20, 2), new(31, 6), new(31, 20), new(20, 17), new(7, 19) });
        using var borda = new Pen(ControlPaint.Dark(cor, .2f));
        g.DrawPolygon(borda, new PointF[] { new(7, 4), new(20, 2), new(31, 6), new(31, 20), new(20, 17), new(7, 19) });
        return bmp;
    }

    static Bitmap Quadriculada()
    {
        var bmp = new Bitmap(34, 34);
        using var g = Graphics.FromImage(bmp);
        using var haste = new Pen(Color.FromArgb(90, 90, 90), 2.5f);
        g.DrawLine(haste, 6, 3, 6, 32);
        for (var y = 0; y < 4; y++)
            for (var x = 0; x < 6; x++)
                g.FillRectangle((x + y) % 2 == 0 ? Brushes.Black : Brushes.White, 7 + x * 4, 3 + y * 4, 4, 4);
        g.DrawRectangle(Pens.Black, 7, 3, 24, 16);
        return bmp;
    }

    static Color? CorAtraso(JsonObject s)
    {
        var atras = s.I("gapLaps");
        return atras <= 0 ? Color.FromArgb(0, 190, 0) : atras <= 2 ? Color.Gold : atras <= 5 ? Color.Red : Color.Black;
    }

    // ------------------------------------------------------------------ leitura

    void Selecionar(string id)
    {
        if (string.IsNullOrEmpty(id)) return;
        _sel = id; _fixado = true;
        _ = Atualizar();
    }


    void ConfigurarPainel()
    {
        var portas = System.IO.Ports.SerialPort.GetPortNames().OrderBy(p => p).ToArray();
        var atual = _painel.Porta.Length > 0 ? _painel.Porta : "desligado";
        using var d = new DialogoDados("Painel de LED", $"Painel antigo de posições 1 a 10 (9600 8N1, protocolo do LapTime). Portas neste computador: {(portas.Length == 0 ? "nenhuma" : string.Join(", ", portas))}. Escreva \"desligado\" para não usar.",
            new[] { ("Porta serial (ex.: COM3)", "porta", atual) }, new Size(640, 300));
        if (d.ShowDialog(this) != DialogResult.OK || !d.Confirmado) return;
        var porta = d.Valor("porta").ToUpperInvariant();
        try
        {
            if (porta is "" or "DESLIGADO") { if (File.Exists(PainelLed.ArquivoConfig)) File.Delete(PainelLed.ArquivoConfig); }
            else PainelLed.SalvarConfig(porta);
            _painel.Dispose();
            _painel.LerConfig();
            AtualizarBotoesPainel();
        }
        catch (Exception e) { Msg.Erro(this, "Não foi possível salvar a configuração do painel: " + e.Message); }
    }

    Control CriarBarraPainelLed()
    {
        _pnlPainelLed.Dock = DockStyle.Fill;
        _pnlPainelLed.Height = 44;
        _pnlPainelLed.BackColor = Color.FromArgb(248, 249, 252);
        _pnlPainelLed.Padding = new Padding(8, 5, 8, 5);

        // Badge [ PLACAR LED COM3 ]
        _lPainelBadge.Text = "PLACAR LED";
        _lPainelBadge.AutoSize = true;
        _lPainelBadge.Font = new Font("Segoe UI", 8F, FontStyle.Bold);
        _lPainelBadge.BackColor = Color.FromArgb(30, 41, 59);
        _lPainelBadge.ForeColor = Color.White;
        _lPainelBadge.Padding = new Padding(6, 4, 6, 4);
        _lPainelBadge.TextAlign = ContentAlignment.MiddleCenter;

        // Status
        _lPainelStatus.AutoSize = true;
        _lPainelStatus.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
        _lPainelStatus.ForeColor = TemaCrono.Texto;
        _lPainelStatus.Text = "Aguardando bateria...";
        _lPainelStatus.TextAlign = ContentAlignment.MiddleLeft;
        _lPainelStatus.Margin = new Padding(6, 4, 0, 0);

        var flowLeft = new FlowLayoutPanel
        {
            Dock = DockStyle.Left,
            AutoSize = true,
            AutoSizeMode = AutoSizeMode.GrowAndShrink,
            WrapContents = false,
            FlowDirection = FlowDirection.LeftToRight,
            Padding = new Padding(0, 1, 0, 0)
        };
        flowLeft.Controls.Add(_lPainelBadge);
        flowLeft.Controls.Add(_lPainelStatus);

        ConfigurarBotaoPagina(_btnPag1, "1º ao 10º (F8)", 0);
        ConfigurarBotaoPagina(_btnPag2, "11º ao 20º (F9)", 1);
        ConfigurarBotaoPagina(_btnPag3, "21º ao 30º (F10)", 2);

        _chkPainelAuto.Text = "Alternar auto (5s)";
        _chkPainelAuto.AutoSize = true;
        _chkPainelAuto.Font = new Font("Segoe UI", 8.5F);
        _chkPainelAuto.ForeColor = TemaCrono.Texto;
        _chkPainelAuto.Margin = new Padding(8, 7, 4, 0);
        _chkPainelAuto.CheckedChanged += (_, _) =>
        {
            _painel.AutoAvanco = _chkPainelAuto.Checked;
            AtualizarBotoesPainel();
        };

        _btnPainelConfig.Text = "⚙ Config";
        _btnPainelConfig.Size = new Size(68, 30);
        _btnPainelConfig.Font = new Font("Segoe UI", 8F);
        _btnPainelConfig.FlatStyle = FlatStyle.Flat;
        _btnPainelConfig.FlatAppearance.BorderColor = Color.FromArgb(203, 213, 225);
        _btnPainelConfig.BackColor = Color.White;
        _btnPainelConfig.ForeColor = TemaCrono.Texto;
        _btnPainelConfig.Margin = new Padding(6, 1, 0, 0);
        _btnPainelConfig.Click += (_, _) => ConfigurarPainel();

        var flowRight = new FlowLayoutPanel
        {
            Dock = DockStyle.Right,
            AutoSize = true,
            AutoSizeMode = AutoSizeMode.GrowAndShrink,
            WrapContents = false,
            FlowDirection = FlowDirection.LeftToRight,
            Padding = new Padding(0, 0, 0, 0)
        };
        var rotuloPag = new Label
        {
            Text = "Painel LED:",
            AutoSize = true,
            Font = new Font("Segoe UI", 8.5F, FontStyle.Bold),
            ForeColor = TemaCrono.Secundario,
            Margin = new Padding(0, 7, 4, 0)
        };
        flowRight.Controls.Add(rotuloPag);
        flowRight.Controls.Add(_btnPag1);
        flowRight.Controls.Add(_btnPag2);
        flowRight.Controls.Add(_btnPag3);
        flowRight.Controls.Add(_chkPainelAuto);
        flowRight.Controls.Add(_btnPainelConfig);

        var pnlBarra = new Panel { Dock = DockStyle.Fill, Height = 36 };
        pnlBarra.Controls.Add(flowLeft);
        pnlBarra.Controls.Add(flowRight);
        _pnlPainelLed.Controls.Add(pnlBarra);

        _pnlPainelLed.Paint += (_, e) =>
        {
            using var pen = new Pen(Color.FromArgb(226, 232, 240), 1f);
            e.Graphics.DrawLine(pen, 0, _pnlPainelLed.Height - 1, _pnlPainelLed.Width, _pnlPainelLed.Height - 1);
        };

        return _pnlPainelLed;
    }

    void ConfigurarBotaoPagina(Button btn, string texto, int pagina)
    {
        btn.Text = texto;
        btn.Size = new Size(114, 30);
        btn.Font = new Font("Segoe UI", 8.5F, FontStyle.Bold);
        btn.FlatStyle = FlatStyle.Flat;
        btn.Cursor = Cursors.Hand;
        btn.Margin = new Padding(2, 1, 2, 0);
        btn.Click += (_, _) =>
        {
            _chkPainelAuto.Checked = false;
            _painel.AutoAvanco = false;
            _painel.DefinirPagina(pagina);
            AtualizarBotoesPainel();
        };
    }

    void AtualizarBotoesPainel()
    {
        if (!_painel.Ativo)
        {
            _lPainelBadge.BackColor = Color.FromArgb(100, 116, 139);
            _lPainelBadge.Text = "PAINEL LED DESLIGADO";
            _lPainelStatus.Text = "Clique em \"Config\" para selecionar a porta serial (ex.: COM3)";
            _lPainelStatus.ForeColor = TemaCrono.Secundario;
            _btnPag1.Enabled = _btnPag2.Enabled = _btnPag3.Enabled = false;
            _chkPainelAuto.Enabled = false;
            EstilizarBotaoPag(_btnPag1, false);
            EstilizarBotaoPag(_btnPag2, false);
            EstilizarBotaoPag(_btnPag3, false);
            return;
        }

        _lPainelBadge.BackColor = _painel.Ok ? (_painel.EmModoGrid ? Color.FromArgb(15, 118, 110) : Color.FromArgb(30, 41, 59)) : Color.FromArgb(185, 28, 28);
        _lPainelBadge.Text = _painel.Porta + (_painel.EmModoGrid ? " · GRID" : "");

        var totalPilotos = _painel.TotalPilotos;
        var totalPaginas = _painel.TotalPaginas;
        var paginaAtual = _painel.Pagina;

        if (_painel.EmModoGrid)
        {
            _lPainelStatus.Text = $"{_painel.SessaoExibidaNome} (Finalizada) · {totalPilotos} pilotos · Montagem do Grid no Painel (Pág. {paginaAtual + 1} de {totalPaginas})";
            _lPainelStatus.ForeColor = Color.FromArgb(15, 118, 110);
        }
        else if (_painel.SessaoExibidaNome.Length > 0)
        {
            _lPainelStatus.Text = $"{_painel.SessaoExibidaNome} · {totalPilotos} karts na pista · Pág. {paginaAtual + 1} de {totalPaginas}";
            _lPainelStatus.ForeColor = TemaCrono.Texto;
        }
        else
        {
            _lPainelStatus.Text = "Painel conectado na porta " + _painel.Porta;
            _lPainelStatus.ForeColor = TemaCrono.Secundario;
        }

        _btnPag1.Enabled = true;
        _btnPag2.Enabled = totalPaginas >= 2;
        _btnPag3.Enabled = totalPaginas >= 3;
        _chkPainelAuto.Enabled = totalPaginas > 1;

        EstilizarBotaoPag(_btnPag1, paginaAtual == 0);
        EstilizarBotaoPag(_btnPag2, paginaAtual == 1 && _btnPag2.Enabled);
        EstilizarBotaoPag(_btnPag3, paginaAtual == 2 && _btnPag3.Enabled);
    }

    static void EstilizarBotaoPag(Button btn, bool ativo)
    {
        if (!btn.Enabled)
        {
            btn.BackColor = Color.FromArgb(241, 245, 249);
            btn.ForeColor = Color.FromArgb(148, 163, 184);
            btn.FlatAppearance.BorderColor = Color.FromArgb(226, 232, 240);
        }
        else if (ativo)
        {
            btn.BackColor = Color.FromArgb(16, 185, 129); // Verde ativo
            btn.ForeColor = Color.White;
            btn.FlatAppearance.BorderColor = Color.FromArgb(5, 150, 105);
        }
        else
        {
            btn.BackColor = Color.White;
            btn.ForeColor = Color.FromArgb(30, 41, 59);
            btn.FlatAppearance.BorderColor = Color.FromArgb(203, 213, 225);
        }
    }

    async Task Atualizar()
    {
        if (_ocupado) return;
        _ocupado = true;
        try
        {
            _state = (await Crono.Api.Get("/api/state"))?.AsObject();
            var focus = _state?["focus"] as JsonObject;
            var correndo = _state.S("runningId");
            if (!_fixado || _sel == null) _sel = correndo.Length > 0 ? correndo : focus?.S("id") ?? _sel;
            if (_sel != null)
            {
                _sess = focus != null && focus.S("id") == _sel ? focus : (await Crono.Api.Get("/api/sessions/" + _sel))?.AsObject();
                _laps = await Crono.Api.Lista($"/api/sessions/{_sel}/passings");
            }
            else { _sess = null; _laps = []; }
            _servidorOk = true;
        }
        catch (ApiException e) when (e.Status == 404) { _fixado = false; _sel = null; }
        catch (ApiException) { _servidorOk = false; }
        finally { _ocupado = false; }
        _lidoEm = DateTime.Now;
        Desenhar();
    }

    async Task CarregarAgenda()
    {
        try { _agenda = await Crono.Api.Lista("/api/agenda"); }
        catch (ApiException e) { _agenda = []; _gAgenda.Preencher([new object[] { "", "Agenda indisponível: " + e.Message, "", "", "" }]); return; }
        _gAgenda.Preencher(_agenda.Select(b => new object[] { Fmt.Hm(b.S("inicio")), b.S("nome"), b.S("tipoKart") == "super" ? "Super" : "Light", b.I("inscritos"), b.I("pagos") }).ToList(), _agenda.Cast<object>().ToList());
        // sem nada escolhido: já deixa marcada a bateria da hora (a mais recente que já começou com inscritos, senão a próxima)
        if (_gAgenda.ChaveAtual == null && _agenda.Count > 0)
        {
            var agora = DateTime.Now.AddMinutes(10).ToString("yyyy-MM-ddTHH:mm");
            var com = _agenda.Select((b, i) => (b, i)).Where(x => x.b.I("inscritos") > 0).ToList();
            var alvo = com.LastOrDefault(x => string.CompareOrdinal(x.b.S("inicio"), agora) <= 0);
            if (alvo.b == null) alvo = com.FirstOrDefault();
            if (alvo.b != null && alvo.i < _gAgenda.Rows.Count)
            {
                _gAgenda.ClearSelection();
                _gAgenda.CurrentCell = _gAgenda.Rows[alvo.i].Cells[1];
                _gAgenda.Rows[alvo.i].Selected = true;
            }
        }
    }

    void Desenhar()
    {
        var dec = _state?["decoder"] as JsonObject;
        _sServidor.Text = _servidorOk ? "CRONOMETRAGEM: ON-LINE" : "CRONOMETRAGEM: SEM CONEXÃO (" + Config.CronoUrl + ")";
        _sServidor.ForeColor = _servidorOk ? TemaCrono.Verde : Color.Red;
        var decOk = dec?.B("healthy") ?? false;
        _sDecoder.Text = "DECODER " + (dec == null ? "?" : decOk ? $"OK ({dec.S("host")})" : dec.B("connected") ? "SEM DADOS" : "DESCONECTADO");
        _sDecoder.ForeColor = decOk ? TemaCrono.Verde : Color.Red;
        _sDecoder.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
        _sServidor.Font = _sDecoder.Font;
        _lRuido.Text = dec?.S("noise") ?? "---";
        _sTv.ForeColor = _tv is { IsDisposed: false } ? Color.FromArgb(16, 124, 16) : Color.Red;
        _sTv.Font = _sDecoder.Font;
        // painel de LED antigo (serial) segue a bateria em andamento ou montagem do grid
        if (_autoteste == null)
        {
            var foco = _state?["focus"] as JsonObject;
            var qualif = _state?["lastQualifying"] as JsonObject ?? (_sess != null && _sess.S("type") != "corrida" && _sess.S("state") == "encerrada" ? _sess : null);
            _painel.Atualizar(foco, qualif);
        }
        _sPainel.Text = "PAINEL LED: " + (_painel.Ativo ? _painel.Situacao.ToUpperInvariant() : "DESLIGADO");
        _sPainel.ForeColor = !_painel.Ativo ? TemaCrono.Secundario : _painel.Ok ? TemaCrono.Verde : Color.Red;
        _sPainel.Font = _sDecoder.Font;
        AtualizarBotoesPainel();

        // transponder sem kart nos ultimos 2 minutos
        var agora = DateTimeOffset.Now.ToUnixTimeMilliseconds();
        var desconhecidos = Crono.Arr(_state, "recentPassings").Where(p => p.S("result") == "transponder-desconhecido" && agora - (p.L("wallMs") ?? 0) < 120_000).Select(p => p.S("transponder")).Distinct().ToList();
        _sTransp.Text = desconhecidos.Count > 0 ? "TRANSPONDER SEM KART: " + string.Join(", ", desconhecidos) + " (clique para associar)" : "";

        // lista de baterias (aba 1 e combo)
        var sessoes = Crono.Arr(_state, "sessions");
        _gSessoes.Preencher(sessoes.Select(s => new object[] { Crono.Hora(s.L("createdAt"))[..5], s.S("name"), Crono.Tipo(s.S("type")), Crono.Estado(s.S("state")), s.I("competitors") }).ToList(), sessoes.Cast<object>().ToList());
        var itens = sessoes.Select(s => new Campos.Item(0, $"{Crono.Hora(s.L("createdAt"))[..5]}  {s.S("name")}  ·  {Crono.Tipo(s.S("type"))}  ·  {Crono.Estado(s.S("state"))}", s)).ToArray();
        if (!_cbSessao.DroppedDown)
        {
            var textos = itens.Select(i => i.Texto).ToList();
            if (!_cbSessao.Items.Cast<Campos.Item>().Select(i => i.Texto).SequenceEqual(textos)) { _cbSessao.Items.Clear(); _cbSessao.Items.AddRange(itens); }
            var idx = itens.ToList().FindIndex(i => i.Dados.S("id") == _sel);
            if (_cbSessao.SelectedIndex != idx) _cbSessao.SelectedIndex = idx;
        }

        var s0 = _sess;
        var estado = s0?.S("state") ?? "";
        _lEvento.Text = s0 == null ? "Selecione uma bateria" : s0.S("name");
        _lTipo.Text = s0 == null ? "" : Crono.Tipo(s0.S("type")) + (s0.L("maxLaps") is long ml && ml > 0 ? $" · {ml} voltas" : s0.L("durationMs") is long dm && dm > 0 ? $" · {dm / 60000} min" : "");
        _lEstado.Text = s0?.B("aguardandoLargada") == true
            ? "Bandeira verde · aguardando o 1º kart passar na linha"
            : Crono.Estado(estado) + (s0?.S("currentFlag") is { Length: > 0 } flag && flag != "none" ? " · " + BandeiraNome(flag) : "");
        _lEstado.ForeColor = Crono.CorEstado(estado);
        _bVerde.Enabled = estado == "preparando";
        _bAmarela.Enabled = _bVermelha.Enabled = _bBranca.Enabled = _bQuad.Enabled = estado == "em_andamento";
        _bFinalizar.Enabled = estado is "em_andamento" or "bandeira_final";
        _bLimpar.Enabled = _laps.Any(p => !p.B("deleted"));
        _bCancelar.Enabled = estado is "preparando" or "em_andamento";

        var standings = Crono.Arr(s0, "standings");
        var lider = standings.FirstOrDefault();
        _lVoltasRest.Text = s0?.L("maxLaps") is long mx && mx > 0 ? Math.Max(0, mx - (lider?.I("laps") ?? 0)).ToString() : "---";
        var melhor = standings.Where(x => x.L("bestLapMs") != null).OrderBy(x => x.L("bestLapMs")).FirstOrDefault();
        _lMelhor.Text = melhor == null ? "---" : $"{(melhor.S("name").Length > 0 ? melhor.S("name") : "KART " + melhor.S("kart")).ToUpperInvariant()} - {Crono.Volta(melhor.L("bestLapMs"))} NA VOLTA Nº {melhor.S("bestLapNumber")}";

        // resultado
        var linhas = new List<object[]>();
        long? gapAnterior = null; var voltasAnterior = -1;
        foreach (var r in standings)
        {
            var gapL = r.I("gapLaps");
            var dl = r.I("position") == 1 ? "–" : gapL > 0 ? $"{gapL} volta{(gapL > 1 ? "s" : "")}" : Gap(r.L("gapMs"));
            var da = "";
            if (r.I("position") > 1)
            {
                if (s0.S("type") == "corrida" && r.I("laps") != voltasAnterior) da = $"{voltasAnterior - r.I("laps")} volta{(voltasAnterior - r.I("laps") > 1 ? "s" : "")}";
                else if (r.L("gapMs") is long g && gapAnterior is long ga) da = Gap(g - ga);
            }
            gapAnterior = r.L("gapMs") ?? (r.I("position") == 1 ? 0 : null);
            voltasAnterior = r.I("laps");
            linhas.Add([
                r.I("position"), r.S("kart"), r.S("name").Length > 0 ? r.S("name") : "Kart " + r.S("kart"), r.S("bestLapNumber"),
                Crono.Volta(r.L("bestLapMs")), r.I("laps"), Crono.Volta(r.L("lastLapMs")), Crono.Volta(r.L("totalMs")), dl, da,
                Velocidade(r),
            ]);
        }
        _gRes.Preencher(linhas, standings.Cast<object>().ToList());
        var categorized = standings.OrderBy(r => NomeCategoria(r.S("category"))).ThenBy(r => r.I("position")).ToList();
        _gResCategoria.Preencher(categorized.Select(r => new object[] {
            r.I("position"), r.S("kart"), string.IsNullOrEmpty(r.S("category")) ? r.S("name") : $"{NomeCategoria(r.S("category"))} · {r.S("name")}",
            r.S("bestLapNumber"), Crono.Volta(r.L("bestLapMs")), r.I("laps"), Crono.Volta(r.L("lastLapMs")), Crono.Volta(r.L("totalMs")),
            r.I("position") == 1 ? "" : r.I("gapLaps") > 0 ? $"+{r.I("gapLaps")} voltas" : Crono.Volta(r.L("gapMs")), "", Velocidade(r),
        }).ToList(), categorized.Cast<object>().ToList());
        AtualizarResultadoCompetidores();

        // passagens — coluna "Hora" como no canvas (AoVivo.dc.html): hora do relógio da passagem, 18:55:19.4
        var pass = _laps.OrderByDescending(p => p.L("wallMs")).ToList();
        // toda leitura do decoder aparece; as que não viraram volta ficam amarelas com o motivo
        _lPassagens.Text = pass.Count(p => !p.B("deleted")).ToString();
        _gPass.Preencher(pass.Select((p, i) => new object[] {
            pass.Count - i, p.S("kart"), p.S("name"), p.S("transponder"),
            p.B("rejected") ? (p.L("sinceLastMs") is long gap ? "+" + Crono.Volta(gap) : "—") : Crono.Volta(p.L("lapMs")),
            p.B("rejected") || p.L("lapMs") == null ? "—" : p.I("lap"), Crono.HoraCurta(p.L("wallMs")), SituacaoPassagem(p) }).ToList(), pass.Cast<object>().ToList());
        var passagemVisivel = pass.FirstOrDefault(p => !p.B("deleted") && !p.B("rejected"));
        _lVoltaFaixa.Text = passagemVisivel == null ? "VOLTA\nAGUARDANDO" : $"VOLTA\n{passagemVisivel.I("lap")}\nAGUARDANDO";

        // competidores (aba 1): so recarrega se o operador nao estiver editando
        if (s0 != null && (_pilotosDe != s0.S("id") || !_pilotosSujos) && !_gPilotos.IsCurrentCellInEditMode)
        {
            var comps = Crono.Arr(s0, "competitors");
            var atual = _gPilotos.Rows.Cast<DataGridViewRow>().Where(r => !r.IsNewRow).Select(r => $"{r.Cells[0].Value}|{r.Cells[1].Value}|{r.Cells[2].Value}|{r.Cells[3].Value}").ToList();
            var novo = comps.Select(c => $"{c.S("kart")}|{c.S("name")}|{c.S("customerId")}|{NomeCategoria(c.S("category"))}").ToList();
            // compara o conteúdo, não a ordem: se o operador ordenou por Competidor/Nº, a ordem da tela fica
            if (_pilotosDe != s0.S("id") || !atual.OrderBy(x => x, StringComparer.Ordinal).SequenceEqual(novo.OrderBy(x => x, StringComparer.Ordinal)))
            {
                var ordenada = _gPilotos.SortedColumn;
                var sentido = _gPilotos.SortOrder;
                _gPilotos.Rows.Clear();
                foreach (var c in comps) _gPilotos.Rows.Add(c.S("kart"), c.S("name"), c.S("customerId"), NomeCategoria(c.S("category")));
                if (ordenada != null && sentido != SortOrder.None)
                    _gPilotos.Sort(ordenada, sentido == SortOrder.Descending ? System.ComponentModel.ListSortDirection.Descending : System.ComponentModel.ListSortDirection.Ascending);
                _pilotosSujos = false;
            }
            _pilotosDe = s0.S("id");
            _lPilotosTitulo.Text = $"{s0.S("name")} — {Crono.Tipo(s0.S("type")).ToUpperInvariant()} ({Crono.Estado(estado)})";
        }
        else if (s0 == null) _lPilotosTitulo.Text = "Selecione ou crie uma bateria";
        var observations = Crono.Arr(s0, "observations");
        var obsRows = observations.Select(o => new object[] { Crono.Hora(o.L("wallMs")), o.S("text"), o.S("author") }).ToList();
        _gObs.Preencher(obsRows, observations.Cast<object>().ToList());
        _gObsAoVivo.Preencher(obsRows, observations.Cast<object>().ToList());
        var transponders = Crono.Arr(_state, "recentPassings").GroupBy(p => p.S("transponder")).Where(g => g.Key.Length > 0).Select(g => g.OrderByDescending(p => p.L("wallMs")).First()).OrderBy(p => p.L("wallMs")).ToList();
        _gTransponderResultado.Preencher(transponders.Select(p => new object[] { p.S("transponder"), Crono.Volta(p.L("lapMs")), Crono.Relogio(p.L("lapMs")), Crono.Hora(p.L("wallMs")), Crono.Arr(_state, "recentPassings").Count(x => x.S("transponder") == p.S("transponder")) }).ToList(), transponders.Cast<object>().ToList());
        if (_abas.SelectedIndex == 1) MontarArvore();
        AtualizarDesign();
        Relogio();
    }

    void Relogio()
    {
        _sHora.Text = DateTime.Now.ToString("HH:mm:ss");
        _sData.Text = DateTime.Now.ToString("dd/MM/yyyy");
        if (_sess == null) { _lCrono.Text = "00:00:00.000"; _lRestante.Text = "---"; return; }
        // com a verde dada mas nenhum kart na linha ainda, o cronômetro fica parado em zero
        var andando = _sess.S("state") is "em_andamento" or "bandeira_final" && !_sess.B("aguardandoLargada");
        var delta = andando && _sess.S("currentFlag") != "red" ? (long)(DateTime.Now - _lidoEm).TotalMilliseconds : 0;
        _lCrono.Text = Crono.Relogio((_sess.L("elapsedMs") ?? 0) + delta);
        // o tempo acabou: a prova continua até o cronometrista dar a quadriculada (nunca encerra sozinha)
        var esgotado = _sess.S("state") == "em_andamento" && _sess.L("durationMs") > 0 && (_sess.B("tempoEsgotado") || _sess.L("remainingMs") is long r0 && r0 - delta <= 0);
        _lRestante.Text = esgotado ? "ESGOTADO" : _sess.L("remainingMs") is long rest ? Crono.Relogio(Math.Max(0, rest - delta))[..8] : "---";
    }

    // ------------------------------------------------------------------ acoes

    void Acao(string acao)
    {
        if (_sess == null) { Msg.Aviso(this, "Selecione uma bateria."); return; }
        var nome = _sess.S("name");
        var pergunta = acao switch
        {
            "start" => $"Dar a BANDEIRA VERDE na bateria \"{nome}\"?\n\nO cronômetro começa quando o primeiro kart passar na linha de largada.",
            "checkered" => $"Dar a BANDEIRA QUADRICULADA em \"{nome}\"?\n\nCada kart termina ao cruzar a linha.",
            "close" => $"ENCERRAR a bateria \"{nome}\" agora?\n\nPassagens depois disso não contam mais.",
            "cancel" => $"CANCELAR a bateria \"{nome}\"?\n\nEla sai da cronometragem (o diário de passagens continua guardado).",
            _ => null,
        };
        // a bateria anterior só encerra pelo cronometrista: se ficou aberta, oferece encerrar antes da verde
        var aberta = acao == "start" ? _state?.S("runningId") : null;
        if (!string.IsNullOrEmpty(aberta) && aberta != _sess.S("id"))
        {
            var nomeAberta = Crono.Arr(_state, "sessions").FirstOrDefault(x => x.S("id") == aberta)?.S("name") ?? "anterior";
            pergunta = $"A bateria \"{nomeAberta}\" ainda está aberta.\n\nENCERRAR \"{nomeAberta}\" e dar a BANDEIRA VERDE em \"{nome}\"?";
        }
        else aberta = null;
        if (pergunta == null || !Msg.Pergunta(this, pergunta)) return;
        Seguro.Rodar(this, async () =>
        {
            if (aberta != null) await Crono.Api.Post($"/api/sessions/{aberta}/close");
            await Crono.Api.Post($"/api/sessions/{_sess.S("id")}/{acao}");
            if (acao == "start") { _fixado = false; }
            await Atualizar();
        });
    }

    /// <summary>Página do telão de LED da TB50 (PC .250): fica no servidor da cronometragem, então vale igual no ORBITS e no CRONO1.</summary>
    void PaginaTelao(int pagina)
    {
        Seguro.Rodar(this, async () =>
        {
            await Crono.Api.Post("/api/tb50-page", new JsonObject { ["pagina"] = pagina, ["origem"] = Environment.MachineName });
            _faixa.PaginaTelao = pagina; _faixa.Invalidate();
            await Atualizar();
        });
    }

    void NovaBateria(JsonObject agenda)
    {
        using var f = new FormNovaBateria(_agenda, agenda);
        if (f.ShowDialog(this) == DialogResult.OK && f.CriadaId != null) { Selecionar(f.CriadaId); _abas.SelectedIndex = 1; }
    }

    async Task SalvarPilotos()
    {
        if (_sess == null) { Msg.Aviso(this, "Selecione uma bateria."); return; }
        _gPilotos.EndEdit();
        var comps = new JsonArray();
        var karts = new HashSet<string>();
        // troca de kart: o kart novo costuma já estar na lista como "Kart 12" (passou na linha antes da troca).
        // Essa linha sem piloto não conta como repetida; o servidor passa as voltas dela para o piloto.
        static bool SemPiloto(string k, string n) => n.Length == 0 || string.Equals(n, $"Kart {k}", StringComparison.OrdinalIgnoreCase);
        var comPiloto = new HashSet<string>();
        foreach (DataGridViewRow r in _gPilotos.Rows)
        {
            if (r.IsNewRow) continue;
            var k = r.Cells[0].Value?.ToString()?.Trim() ?? ""; var n = r.Cells[1].Value?.ToString()?.Trim() ?? "";
            if (k.Length > 0 && !SemPiloto(k, n) && !comPiloto.Add(k)) { Msg.Aviso(this, $"O kart {k} está com dois pilotos na lista."); return; }
        }
        foreach (DataGridViewRow r in _gPilotos.Rows)
        {
            if (r.IsNewRow) continue;
            var kart = r.Cells[0].Value?.ToString()?.Trim() ?? "";
            var nome = r.Cells[1].Value?.ToString()?.Trim() ?? "";
            if (kart.Length == 0 && nome.Length == 0) continue;
            if (kart.Length > 0 && SemPiloto(kart, nome) && comPiloto.Contains(kart)) continue;
            if (kart.Length > 0 && !karts.Add(kart)) { Msg.Aviso(this, $"O kart {kart} está repetido."); return; }
            var cid = r.Cells[2].Value?.ToString();
            var category = r.Cells.Count > 3 ? r.Cells[3].Value?.ToString() : null;
            if (!string.IsNullOrWhiteSpace(category)) category = IdCategoria(category);
            comps.Add(new JsonObject { ["kart"] = kart, ["name"] = nome, ["customerId"] = string.IsNullOrEmpty(cid) ? null : cid, ["category"] = string.IsNullOrEmpty(category) ? null : category });
        }
        await Crono.Api.Patch("/api/sessions/" + _sess.S("id"), new JsonObject { ["competitors"] = comps });
        _pilotosSujos = false;
        await Atualizar();
        Msg.Info(this, "Competidores salvos.");
    }

    async Task PuxarAgenda()
    {
        if (_sess == null) { Msg.Aviso(this, "Selecione uma bateria."); return; }
        var ag = AgendaDaBateria(_sess);
        if (ag == null) { Msg.Aviso(this, "Não achei a bateria da recepção com o mesmo horário desta prova. Crie a bateria pela agenda (passos 1–3 › Da agenda…)."); return; }
        var grid = await Crono.Api.Lista($"/api/agenda/{ag.S("id")}/grid");
        if (grid.Count == 0) { Msg.Aviso(this, "Essa bateria da agenda não tem inscritos."); return; }
        var existentes = _gPilotos.Rows.Cast<DataGridViewRow>().Where(r => !r.IsNewRow).Select(r => r.Cells[2].Value?.ToString()).ToHashSet();
        foreach (var g in grid.Where(g => !existentes.Contains(g.S("clienteId")))) _gPilotos.Rows.Add(g.S("kart"), g.S("nome"), g.S("clienteId"), g.S("categoria"));
        _pilotosSujos = true;
        Msg.Info(this, $"{grid.Count} inscrito(s) da agenda. Confira os números dos karts e clique em Salvar Competidores.");
    }

    /// <summary>Bateria da agenda da recepção que corresponde à prova: mesmo horário no nome ("BATERIA 18:45") ou a do grupo.</summary>
    JsonObject AgendaDaBateria(JsonObject sessao)
    {
        if (sessao == null || _agenda.Count == 0) return _gAgenda.ChaveAtual as JsonObject;
        var grupo = _groups.FirstOrDefault(g => g.S("id") == sessao.S("groupId"))?.S("name") ?? "";
        foreach (var texto in new[] { sessao.S("name"), grupo })
        {
            var m = System.Text.RegularExpressions.Regex.Match(texto, @"(\d{1,2}):(\d{2})");
            if (!m.Success) continue;
            var hora = $"{int.Parse(m.Groups[1].Value):00}:{m.Groups[2].Value}";
            var achou = _agenda.FirstOrDefault(a => Fmt.Hm(a.S("inicio")) == hora);
            if (achou != null) return achou;
        }
        return _agenda.FirstOrDefault(a => a.S("nome").Equals(sessao.S("name").Split('·')[0].Trim(), StringComparison.OrdinalIgnoreCase)) ?? _gAgenda.ChaveAtual as JsonObject;
    }

    async Task Invalidar(string kart, int lap)
    {
        if (_sess == null) return;
        await Crono.Api.Post($"/api/sessions/{_sess.S("id")}/laps/invalidate", new JsonObject { ["kart"] = kart, ["lap"] = lap });
        await Atualizar();
    }

    void Voltas(string kart)
    {
        if (_sess == null) return;
        using var f = new FormVoltas(_sess.S("id"), kart);
        f.ShowDialog(this);
        _ = Atualizar();
    }

    void Transponders()
    {
        var agora = DateTimeOffset.Now.ToUnixTimeMilliseconds();
        // transponders lidos nos últimos 10 min sem kart: entram na lista do cadastro De/Para (canvas) sem número de kart
        _transpNovos = Crono.Arr(_state, "recentPassings").Where(p => p.S("result") == "transponder-desconhecido" && agora - (p.L("wallMs") ?? 0) < 600_000).Select(p => p.S("transponder")).Where(t => t.Length > 0).Distinct().ToList();
        try { CadastroDesign("CadTranspDePara"); } finally { _transpNovos = []; }
    }

    void AbrirTV()
    {
        if (_tv is { IsDisposed: false }) { _tv.Activate(); return; }
        _tv = new FormTV();
        _tv.Show();
    }

    void AbrirRelatoriosCrono()
    {
        using var f = new FormRelatoriosCrono(_state, _sess);
        f.ShowDialog(this);
    }

    void Resultado() => AbrirRelatoriosCrono();

    // ------------------------------------------------------------------ autoteste

    /// <summary>Confere que a ordenação da aba 4–5 (Competidor e Nº) não é desfeita pelas atualizações ao vivo. Só lê do servidor.</summary>
    async Task TesteOrdenacao()
    {
        var log = new List<string>();
        try
        {
            await Atualizar();
            var sessao = Crono.Arr(_state, "sessions").OrderByDescending(x => x.I("competitors")).FirstOrDefault();
            if (sessao == null) { log.Add("pendente: nenhuma bateria"); return; }
            Selecionar(sessao.S("id"));
            _abas.SelectedIndex = 1; _tabsCompetidor.SelectedIndex = 0;
            for (var i = 0; i < 10 && _gPilotos.Rows.Cast<DataGridViewRow>().Count(r => !r.IsNewRow) < 2; i++) { await Atualizar(); await Task.Delay(300); }
            List<string> Coluna(int c) => _gPilotos.Rows.Cast<DataGridViewRow>().Where(r => !r.IsNewRow).Select(r => r.Cells[c].Value?.ToString() ?? "").ToList();
            log.Add($"bateria {sessao.S("name")}: {Coluna(1).Count} competidores; ordem do servidor: {string.Join(" | ", Coluna(1).Take(6))}");
            var cmp = StringComparer.Create(Fmt.Br, System.Globalization.CompareOptions.IgnoreCase | System.Globalization.CompareOptions.IgnoreNonSpace);
            _gPilotos.Sort(_gPilotos.Columns["name"], System.ComponentModel.ListSortDirection.Ascending);
            for (var i = 0; i < 5; i++) { await Atualizar(); await Task.Delay(700); }
            var nomes = Coluna(1);
            var esperado = nomes.Where(n => n.Length > 0).OrderBy(n => n, cmp).Concat(nomes.Where(n => n.Length == 0)).ToList();
            log.Add((nomes.SequenceEqual(esperado) ? "OK" : "ERRO") + $" Competidor A-Z continua depois de 5 atualizações: {string.Join(" | ", nomes.Take(6))}");
            _gPilotos.Sort(_gPilotos.Columns["name"], System.ComponentModel.ListSortDirection.Descending);
            for (var i = 0; i < 3; i++) { await Atualizar(); await Task.Delay(700); }
            nomes = Coluna(1);
            log.Add((nomes.Where(n => n.Length > 0).SequenceEqual(nomes.Where(n => n.Length > 0).OrderByDescending(n => n, cmp)) ? "OK" : "ERRO") + $" Competidor Z-A: {string.Join(" | ", nomes.Take(4))}");
            _gPilotos.Sort(_gPilotos.Columns["kart"], System.ComponentModel.ListSortDirection.Ascending);
            for (var i = 0; i < 3; i++) { await Atualizar(); await Task.Delay(700); }
            var karts = Coluna(0).Where(k => long.TryParse(k, out _)).Select(long.Parse).ToList();
            log.Add((karts.SequenceEqual(karts.OrderBy(k => k)) ? "OK" : "ERRO") + $" Nº em ordem numérica: {string.Join(" ", karts.Take(12))}");
        }
        catch (Exception e) { log.Add("ERRO " + e); }
        finally { File.WriteAllLines(Path.Combine(_autoteste, "log.txt"), log); Close(); }
    }

    async Task AutoTeste()
    {
        Directory.CreateDirectory(_autoteste);
        if (Environment.GetEnvironmentVariable("KARTODROMO_TESTE") == "ordenacao") { await TesteOrdenacao(); return; }
        var foraDaTela = Environment.GetEnvironmentVariable("KARTODROMO_TESTE") == "telas";
        if (foraDaTela) Msg.Registro = m => File.AppendAllText(Path.Combine(_autoteste, "log.txt"), m + Environment.NewLine); // avisos no log, nenhuma caixa na tela
        var focoAntes = GetForegroundWindow();
        System.Windows.Forms.Timer vigia = null;
        if (foraDaTela)
        {
            // qualquer janela que abrir vai para x=-4000 e o foco volta para quem estava usando o PC
            vigia = new System.Windows.Forms.Timer { Interval = 15 };
            vigia.Tick += (_, _) => { foreach (Form f in Application.OpenForms) if (f.Visible && f.Left > -3000) { f.ShowInTaskbar = false; f.Location = new Point(-4000 + Math.Max(0, f.Left), Math.Max(0, f.Top)); SetForegroundWindow(focoAntes); } };
            vigia.Start();
        }
        void Foto(Control c, string nome)
        {
            Application.DoEvents();
            using var bmp = new Bitmap(c.Width, c.Height);
            if (foraDaTela && c is Form)
            {
                using var g = Graphics.FromImage(bmp); var hdc = g.GetHdc(); PrintWindow(c.Handle, hdc, 2); g.ReleaseHdc(hdc);
                // fora da tela o PrintWindow devolve preto em botões/rótulos com região arredondada: redesenha cada um no lugar
                IEnumerable<Control> Todos(Control r) { foreach (Control x in r.Controls) { yield return x; foreach (var y in Todos(x)) yield return y; } }
                foreach (var filho in Todos(c).Where(x => x.Visible && x.Width > 0 && x.Height > 0 && x is ButtonBase or Label))
                {
                    try
                    {
                        var p = filho.PointToScreen(Point.Empty);
                        using var parte = new Bitmap(filho.Width, filho.Height);
                        filho.DrawToBitmap(parte, new Rectangle(0, 0, filho.Width, filho.Height));
                        if (filho.Region != null) { g.SetClip(filho.Region, System.Drawing.Drawing2D.CombineMode.Replace); g.TranslateClip(p.X - c.Left, p.Y - c.Top); }
                        g.DrawImage(parte, p.X - c.Left, p.Y - c.Top);
                        g.ResetClip();
                    }
                    catch { }
                }
            }
            else c.DrawToBitmap(bmp, new Rectangle(Point.Empty, c.Size));
            bmp.Save(Path.Combine(_autoteste, nome + ".png"));
        }
        try
        {
            await Task.Delay(600);
            _abas.SelectedIndex = 0; await CarregarCatalogo(); await CarregarAgenda(); await Atualizar(); await Task.Delay(250); Foto(this, "01-eventos");
            _abas.SelectedIndex = 1; MontarArvore(); await Task.Delay(250); Foto(this, "02-competidores");
            for (var i = 0; i < _tabsCompetidor.TabPages.Count; i++)
            {
                _tabsCompetidor.SelectedIndex = i; await Task.Delay(160);
                Foto(this, $"02-{i + 1}-{NomeArquivo(_tabsCompetidor.TabPages[i].Text)}");
            }
            _abas.SelectedIndex = 2;
            for (var i = 0; i < _tabsResultado.TabPages.Count; i++)
            {
                _tabsResultado.SelectedIndex = i; await Task.Delay(160);
                Foto(this, $"03-ao-vivo-{NomeArquivo(_tabsResultado.TabPages[i].Text)}");
            }
            var cronoMenu = MainMenuStrip.Items.OfType<ToolStripMenuItem>().FirstOrDefault(item => item.Text == "Cronometragem");
            cronoMenu?.ShowDropDown(); await Task.Delay(180); Foto(this, "04-menus-cronometragem"); cronoMenu?.HideDropDown();
            using (var f = new FormNovaBateria(_agenda, _agenda.FirstOrDefault())) { f.Show(this); await Task.Delay(240); Foto(f, "05-NovaBateria"); f.Close(); }
            // "06-Transponders" agora é o cadastro De/Para do canvas (foto CadTranspDePara)
            // categoria e traçado abrem pelo mesmo caminho do menu (tela do canvas), não pela janela antiga
            var janelas = new (string Nome, (string, string, string)[] Campos)[]
            {
                ("CadCategoria", []), ("CadTracado", []),
                ("IncluirPassagem", [("Número do kart", "kart", "07"), ("Competidor", "name", "Carlos Henrique Lima"), ("Tempo da volta (segundos)", "lapSeconds", "54.873")]),
                ("MudarCorrida", [("Nome", "name", _sess?.S("name") ?? "CORRIDA"), ("Duração em minutos", "durationMin", "20"), ("Voltas máximas", "maxLaps", "")]),
                ("Empresa", [("Razão social", "company", "Kartódromo Internacional de Betim"), ("CNPJ", "cnpj", ""), ("Telefone", "phone", ""), ("E-mail", "email", "")]),
                ("CadGrupo", [("Nome do grupo", "name", "BATERIA 19:20"), ("Categoria", "categoryId", "Indoor")]),
                ("Prova", [("Nome da prova", "name", "Corrida"), ("Tipo", "type", "corrida"), ("Duração em minutos", "durationMin", "20"), ("Voltas máximas", "maxLaps", "")]),
                ("Competidor", [("Kart", "kart", "07"), ("Competidor", "name", "Carlos Henrique Lima"), ("Categoria", "category", "Indoor")]),
                ("CadDecoder", [("Decoder", "decoder", "TranX"), ("Endereço", "decoderHost", "192.168.20.171"), ("Porta", "decoderPort", "5100")]),
                ("PlacarConfig", [("Placar padrão", "scoreboard", "Placar CalXPro"), ("Atualizar a cada (s)", "scoreboardInterval", "1")]),
                ("CadTranspDePara", [("Transponder", "raw", "4521873"), ("Kart", "kart", "07")]),
                ("CadTranspCompetidor", [("Transponder", "raw", "4521873"), ("Competidor", "name", "Carlos Henrique Lima")]),
                ("ParamSistema", [("Nome da pista", "trackName", "Kartódromo Internacional de Betim"), ("Serviço de cronometragem", "timingUrl", Config.CronoUrl)]),
                ("ParamCrono", [("Extensão do traçado (m)", "defaultTrackLengthMeters", "1000"), ("Volta mínima (s)", "minLapSeconds", "5"), ("Bip de passagem", "beep", "ligado")]),
                ("Backup", [("Destino", "destination", "Pasta de dados do serviço"), ("Diário", "journal", "Preservar passagens")]),
                ("ConfigInicial", [("Empresa", "company", "Kartódromo Internacional de Betim"), ("Pista", "trackName", "Kartódromo Internacional de Betim"), ("Decoder", "decoder", "TranX")]),
                ("SegUsuario", [("Usuário", "user", "cronometrista"), ("Nome", "name", "Cronometrista")]),
                ("SegPerfil", [("Perfil", "name", "Cronometragem"), ("Descrição", "description", "Operação de pista")]),
                ("Permissoes", [("Perfil", "profile", "Cronometragem"), ("Permissões", "permissions", "Bandeiras · resultados · passagens")]),
                ("Banner", [("Título", "title", "Kartódromo Internacional de Betim"), ("Texto", "body", "Resultado ao vivo")]),
                ("RankingPeso", [("Evento", "event", "Campeonato KAC"), ("Peso mínimo", "minWeight", "50"), ("Peso máximo", "maxWeight", "100")]),
                ("RelatoriosCrono", [("Relatório", "report", "Resultado oficial"), ("Período", "period", DateTime.Today.ToString("dd/MM/yyyy"))]),
            };
            foreach (var (nome, campos) in janelas)
            {
                if (nome == "RelatoriosCrono")
                {
                    using var fRel = new FormRelatoriosCrono(_state, _sess);
                    fRel.Show(this); await Task.Delay(200); Foto(fRel, nome); fRel.Close();
                }
                else
                {
                    // as telas do design abrem como diálogo (modal): um temporizador fotografa e fecha
                    var feito = new TaskCompletionSource<bool>();
                    var t = new System.Windows.Forms.Timer { Interval = 150 };
                    var achou = false;
                    t.Tick += async (_, _) =>
                    {
                        if (achou) return;
                        var alvo = Application.OpenForms.Cast<Form>().FirstOrDefault(f => f != this && f.Visible && f is not Escurecer && f is not FormTV);
                        if (alvo == null) return;
                        achou = true; t.Stop();
                        await Task.Delay(1000);
                        try { Foto(alvo, nome); } catch { }
                        alvo.Close(); feito.TrySetResult(true);
                    };
                    t.Start();
                    File.AppendAllText(Path.Combine(_autoteste, "log.txt"), $"abrindo {nome}{Environment.NewLine}");
                    try
                    {
                        switch (nome)
                        {
                            case "CadGrupo": CadastroDesign("CadGrupo"); break;
                            case "Empresa" or "ParamCrono" or "ParamSistema" or "Backup" or "ConfigInicial" or "Banner": await DialogoConfiguracao(nome); break;
                            case "Prova": EditarProvaDesign(true); break;
                            case "Competidor": JanelaCadastro("Competidor"); break;
                            case "SegUsuario": await SegUsuario(); break;
                            case "SegPerfil": await SegPerfil(); break;
                            case "Permissoes": await Permissoes(); break;
                            case "RankingPeso": RankingPesoDesign(); break;
                            default: JanelaCadastro(nome); break;
                        }
                    }
                    catch (Exception ex) { File.AppendAllText(Path.Combine(_autoteste, "log.txt"), $"ERRO {nome}: {ex.Message}\r\n"); }
                    await Task.WhenAny(feito.Task, Task.Delay(8000));
                    t.Stop(); t.Dispose();
                    if (!achou) File.AppendAllText(Path.Combine(_autoteste, "log.txt"), $"sem janela: {nome}\r\n");
                }
            }
            // título esperado: a configuração do e-mail abre depois de buscar os dados (assíncrona) e não pode ser
            // confundida com a janela do passo seguinte
            foreach (var (nome, acao, titulo) in new (string, Action, string)[] { ("Evento", () => EditarEventoDesign(true), null), ("GrupoEditar", () => EditarGrupoDesign(true), null), ("Distribuir", DistribuirProvaDesign, null), ("EmailConfig", ConfigurarEmail, "E-mail dos resultados"), ("EmailEnviar", EnviarEmail, "Enviar resultado") })
            {
                var t = new System.Windows.Forms.Timer { Interval = 150 }; var achou = false; var feito = new TaskCompletionSource<bool>();
                t.Tick += async (_, _) => { if (achou) return; var alvo = Application.OpenForms.Cast<Form>().FirstOrDefault(f => f != this && f.Visible && f is not Escurecer && f is not FormTV && (titulo == null || f.Text.Contains(titulo))); if (alvo == null) return; achou = true; t.Stop(); await Task.Delay(900); try { Foto(alvo, nome); } catch { } alvo.Close(); feito.TrySetResult(true); };
                t.Start(); acao(); File.AppendAllText(Path.Combine(_autoteste, "log.txt"), $"voltou de {nome}\r\n");
                await Task.WhenAny(feito.Task, Task.Delay(8000)); t.Stop(); t.Dispose();
                File.AppendAllText(Path.Combine(_autoteste, "log.txt"), $"fim de {nome}\r\n");
            }
            if (_state?["focus"] is JsonObject foco) File.WriteAllText(Path.Combine(_autoteste, "painel-led.txt"), PainelLed.Montar(foco, 10, DateTime.Now, out _));
            File.WriteAllText(Path.Combine(_autoteste, "ok.txt"), "ok");
        }
        catch (Exception e) { File.WriteAllText(Path.Combine(_autoteste, "erro.txt"), e.ToString()); }
        Close();
    }

    [System.Runtime.InteropServices.DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [System.Runtime.InteropServices.DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [System.Runtime.InteropServices.DllImport("user32.dll")] static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);

    static string NomeArquivo(string nome) => string.Concat(nome.ToLowerInvariant().Select(c => char.IsLetterOrDigit(c) ? c : '-')).Trim('-');
}
