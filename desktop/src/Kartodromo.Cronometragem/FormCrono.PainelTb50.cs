using System.Drawing.Drawing2D;
using System.Globalization;
using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Cronometragem;

/// <summary>
/// Aba completa "Painel de LED" (NovaStar TB50 · 2048×512 · ViPlex/VNNOX):
/// estúdio ao vivo, biblioteca de conteúdo, templates 2048×512 em milésimos de segundo,
/// camadas, playlist/programação, patrocinadores, agenda automática e controle direto ViPlex.
/// Segue integralmente o Design System claro de Cronometragem (Tokens.Claro / TemaCrono).
/// </summary>
public partial class FormCrono
{
    JsonObject _tb50Cfg;
    JsonObject _tb50Status;
    List<JsonObject> _tb50ViplexProgramas = [];
    readonly List<(string hora, string acao, string detalhe)> _tb50Historico = [];

    bool _tb50Construida;
    bool _tb50Carregando;
    bool _tb50AplicandoUi;
    int _tb50SubModo; // 0=Estúdio, 1=Conteúdo, 2=Templates, 3=Playlist, 4=Agenda, 5=Patrocinadores, 6=Hardware, 7=Monitoramento
    string _tb50FerramentaAtiva = "Selecionar";
    string _tb50CamadaSel = "placar";
    DateTime _tb50UltimoSync = DateTime.MinValue;
    DateTime _tb50UltimoGridTelas = DateTime.MinValue;

    // Cabeçalho da aba e hosts de sub-visões
    SegmentoDesign _tb50SubSeg, _tb50DirSeg;
    Label _tb50StatusBadge, _tb50PingEditor, _tb50TotalPlaylist, _tb50LayoutResumoNome, _tb50LayoutResumoMeta;
    Button _btnTb50ModoAoVivo, _btnTb50ModoPlaylist, _btnTb50ModoManual, _btnTb50Play, _btnTb50Pause, _btnTb50Stop, _btnTb50Loop;
    Button _btnTb50Pag1, _btnTb50Pag2, _btnTb50PagAuto;
    Panel _tb50CorpoEstudio, _tb50CorpoSubpagina, _tb50DirLayoutHost, _tb50DirPropsHost, _tb50MiniPreview;
    FlowLayoutPanel _tb50BibliotecaFlow, _tb50TemplatesFlow, _tb50CamadasFlow;
    PreviewTb50Canvas _tb50Canvas, _tb50TemplateCanvas;
    ListaDesign _tb50CatLista;
    TextBox _tb50BuscaTxt;

    // Propriedades editáveis
    TextBox _tb50PropTitulo, _tb50PropSubtitulo, _tb50PropRodape, _tb50PropClima, _tb50PropQr, _tb50PropCorPri, _tb50PropCorDest, _tb50PropAutoPagSeg;
    CheckBox _tb50ChkMilesimos, _tb50ChkPodioAuto, _tb50ChkAutoPag, _tb50ChkClima, _tb50ChkHora, _tb50ChkQr;

    // Hardware & ViPlex
    TextBox _tb50HwHost, _tb50HwPort, _tb50HwSerial, _tb50HwUser, _tb50HwProgPadrao, _tb50HwBrilho, _tb50HwVolume, _tb50HwSenha;

    // Monitoramento / KPI labels
    Label _tb50KpiEstado, _tb50KpiPing, _tb50KpiModo, _tb50KpiPrograma;

    // Grades (studio e sub-páginas dedicadas)
    readonly LiveGrid _gTb50Playlist = new();
    LiveGrid _gTb50PlaylistSub, _gTb50Conteudo, _gTb50Agenda, _gTb50Patrocinadores, _gTb50Viplex, _gTb50Telas, _gTb50Historico;

    static readonly (string id, string nome, string sub, string cor)[] TemplatesTb50 =
    [
        ("top3-live", "Top 3 (Horizontal)", "P1-P3 destaque + ms + rodapé", "#0B7A53"),
        ("lista-laptime", "Tempo Real (Lista LapTime)", "Cronômetro + Pos + Kart + Piloto + ms", "#1565C0"),
        ("grid-14-ms", "Placar 14 Karts (ms)", "Grade 7x2 grande · Kart + Tempo ms", "#059669"),
        ("grid-20-pos", "Placar 20 Karts (Pos)", "Grade 10x2 clássico · Posição + Kart", "#2563EB"),
        ("podio-final", "Resultado (Final / Pódio)", "Top 5 final + campeão em destaque", "#D97706"),
        ("patrocinadores", "Patrocinadores (Rotativo)", "Marcas, mídia e chamada de evento", "#7C3AED"),
    ];

    static readonly string[] WidgetsTb50 =
    [
        "Selecionar", "Texto", "Imagem", "Vídeo", "Patrocinador", "Placar",
        "Cronômetro", "Temporizador", "Ranking", "Clima", "QR Code", "Hora/Data", "Forma", "Animação"
    ];

    TabPage AbaPainelTb50()
    {
        GarantirConfigTb50Local();
        var page = new TabPage("Painel de LED") { BackColor = TemaCrono.Fundo, Padding = Padding.Empty };

        // 1. Barra superior fixa de sub-navegação e publicação imediata
        var topo = new Panel { Dock = DockStyle.Top, Height = 46, BackColor = Tokens.Primitivo.Branco, Padding = new Padding(14, 6, 14, 6) };
        topo.Paint += (_, e) => { using var p = new Pen(Color.FromArgb(234, 234, 234)); e.Graphics.DrawLine(p, 0, topo.Height - 1, topo.Width, topo.Height - 1); };

        _tb50SubSeg = new SegmentoDesign
        {
            BackColor = Tokens.Primitivo.Branco,
            Itens = ["Painel de LED", "Conteúdo", "Templates", "Playlist", "Agenda", "Patrocinadores", "Config. TB50", "Monitoramento"],
            Location = new Point(14, 7),
        };
        _tb50SubSeg.Mudou += idx => { _tb50SubModo = idx; AlternarSubModoTb50(); };

        _tb50StatusBadge = new Label
        {
            AutoSize = true,
            Text = "● TB50 · 2048×512",
            Font = Tokens.FonteSemibold(Tokens.Claro.FonteTamanhoPequeno),
            ForeColor = TemaCrono.Secundario,
            BackColor = Color.FromArgb(242, 242, 247),
            Padding = new Padding(10, 5, 10, 5),
        };
        Forma.AplicarRaio(_tb50StatusBadge, 8);

        var btnAbrirWeb = BotaoPeq("Abrir /tb50", 0, () => Relatorio.Abrir(this, $"{Config.CronoUrl.TrimEnd('/')}/tb50", "Prévia Web · NovaStar TB50 (2048×512)"));
        var btnSync = BotaoPeq("Sincronizar", 0, () => Seguro.Rodar(this, SincronizarTudoTb50Async));
        var btnTransmitir = BotaoPeq("Transmitir Agora", 1, () => Seguro.Rodar(this, TransmitirAgoraTb50Async));

        topo.Controls.AddRange([_tb50SubSeg, _tb50StatusBadge, btnAbrirWeb, btnSync, btnTransmitir]);
        void PosicionarTopo()
        {
            _tb50SubSeg.Location = new Point(14, (topo.Height - _tb50SubSeg.Height) / 2);
            var minX = _tb50SubSeg.Right + 10;
            var x = topo.Width - 14;
            foreach (var b in new Control[] { btnTransmitir, btnSync, btnAbrirWeb, _tb50StatusBadge })
            {
                var cabe = x - b.Width >= minX;
                b.Visible = cabe || b == btnTransmitir;
                if (!b.Visible) continue;
                x = Math.Max(minX, x - b.Width);
                b.Location = new Point(x, (topo.Height - b.Height) / 2);
                x -= 8;
            }
        }
        topo.Resize += (_, _) => PosicionarTopo();
        _tb50StatusBadge.SizeChanged += (_, _) => PosicionarTopo();

        // 2. Host principal (alterna entre Estúdio 3 colunas e Sub-páginas expandidas)
        var host = new Panel { Dock = DockStyle.Fill, BackColor = TemaCrono.Fundo, Padding = new Padding(14, 12, 14, 12) };
        _tb50CorpoEstudio = ConstruirEstudioTb50();
        _tb50CorpoSubpagina = new Panel { Dock = DockStyle.Fill, BackColor = TemaCrono.Fundo, Visible = false };
        host.Controls.Add(_tb50CorpoEstudio);
        host.Controls.Add(_tb50CorpoSubpagina);

        page.Controls.Add(host);
        page.Controls.Add(topo);
        host.BringToFront();

        _tb50Construida = true;
        AtualizarTodasVistasTb50();
        return page;
    }

    Panel ConstruirEstudioTb50()
    {
        var grade = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 3, RowCount = 1, BackColor = TemaCrono.Fundo };
        grade.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 272));
        grade.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        grade.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 320));
        grade.RowStyles.Add(new RowStyle(SizeType.Percent, 100));

        var colEsq = CardBibliotecaTb50();
        var colCentro = ConstruirColunaCentralTb50();
        var colDir = CardDireitaTb50();

        colEsq.Margin = new Padding(0, 0, 12, 0);
        colCentro.Margin = new Padding(0, 0, 12, 0);
        colDir.Margin = Padding.Empty;

        grade.Controls.Add(colEsq, 0, 0);
        grade.Controls.Add(colCentro, 1, 0);
        grade.Controls.Add(colDir, 2, 0);
        return grade;
    }

    Panel CardBibliotecaTb50()
    {
        var card = new TemaCrono.PainelArredondado { Dock = DockStyle.Fill, BackColor = Tokens.Primitivo.Branco, Raio = 16, Padding = new Padding(12) };

        var cab = new Panel { Dock = DockStyle.Top, Height = 36, BackColor = Tokens.Primitivo.Branco };
        var tit = new Label { Text = "Biblioteca de Conteúdo", AutoSize = true, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoSubtitulo, FontStyle.Bold), ForeColor = TemaCrono.Texto, Location = new Point(2, 6) };
        var add = BotaoPeq("+ Adicionar", 1, () => AbrirDialogoAdicionarMidia());
        add.Anchor = AnchorStyles.Top | AnchorStyles.Right;
        cab.Resize += (_, _) => add.Location = new Point(cab.Width - add.Width, 2);
        cab.Controls.AddRange([tit, add]);

        var filtros = new Panel { Dock = DockStyle.Top, Height = 76, BackColor = Tokens.Primitivo.Branco, Padding = new Padding(0, 4, 0, 4) };
        _tb50CatLista = new ListaDesign { Dock = DockStyle.Top, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno) };
        _tb50CatLista.Items.AddRange(["Todos", "Layouts", "Imagens", "Vídeos", "Patrocinadores", "Animações", "Starts/Transições", "Informativos", "Programas ViPlex"]);
        _tb50CatLista.SelectedIndex = 0;
        _tb50CatLista.SelectedIndexChanged += (_, _) => PopularBibliotecaTb50();

        var caixaBusca = new TemaCrono.PainelArredondado { Dock = DockStyle.Bottom, Height = 32, BackColor = Color.FromArgb(245, 245, 247), Raio = 8, Padding = new Padding(10, 6, 10, 4) };
        _tb50BuscaTxt = PecasDesign.Texto("", 80);
        _tb50BuscaTxt.Dock = DockStyle.Fill;
        _tb50BuscaTxt.BackColor = Color.FromArgb(245, 245, 247);
        _tb50BuscaTxt.PlaceholderText = "Buscar conteúdo...";
        _tb50BuscaTxt.TextChanged += (_, _) => PopularBibliotecaTb50();
        caixaBusca.Controls.Add(_tb50BuscaTxt);
        filtros.Controls.AddRange([_tb50CatLista, caixaBusca]);

        _tb50BibliotecaFlow = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            AutoScroll = true,
            WrapContents = true,
            FlowDirection = FlowDirection.LeftToRight,
            BackColor = Tokens.Primitivo.Branco,
            Padding = new Padding(0, 6, 0, 0),
        };
        _tb50BibliotecaFlow.Resize += (_, _) =>
        {
            var larguraCard = Math.Max(105, (_tb50BibliotecaFlow.ClientSize.Width - 18) / 2);
            foreach (Control c in _tb50BibliotecaFlow.Controls) c.Width = larguraCard;
        };

        card.Controls.Add(_tb50BibliotecaFlow);
        card.Controls.Add(filtros);
        card.Controls.Add(cab);
        _tb50BibliotecaFlow.BringToFront();
        return card;
    }

    Panel ConstruirColunaCentralTb50()
    {
        var col = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 2, BackColor = TemaCrono.Fundo };
        col.RowStyles.Add(new RowStyle(SizeType.Percent, 58));
        col.RowStyles.Add(new RowStyle(SizeType.Percent, 42));

        var editor = CardEditorTb50();
        var playlist = CardPlaylistControlesTb50();
        editor.Margin = new Padding(0, 0, 0, 12);
        playlist.Margin = Padding.Empty;

        col.Controls.Add(editor, 0, 0);
        col.Controls.Add(playlist, 0, 1);
        return col;
    }

    Panel CardEditorTb50()
    {
        var card = new TemaCrono.PainelArredondado { Dock = DockStyle.Fill, BackColor = Tokens.Primitivo.Branco, Raio = 16, Padding = new Padding(12) };

        var topo = new Panel { Dock = DockStyle.Top, Height = 38, BackColor = Tokens.Primitivo.Branco };
        var tit = new Label
        {
            Text = "Editor do Painel de LED (NovaStar TB50)",
            AutoSize = false,
            AutoEllipsis = true,
            Height = 24,
            Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoSubtitulo, FontStyle.Bold),
            ForeColor = TemaCrono.Texto,
            Location = new Point(2, 7),
        };
        var resPill = new Label
        {
            Text = "TB50 (2048 × 512)",
            AutoSize = true,
            Font = Tokens.FonteSemibold(Tokens.Claro.FonteTamanhoLegenda),
            ForeColor = TemaCrono.Secundario,
            BackColor = Color.FromArgb(242, 242, 247),
            Padding = new Padding(8, 4, 8, 4),
        };
        Forma.AplicarRaio(resPill, 7);

        _tb50PingEditor = new Label
        {
            Text = "● Verificando",
            AutoSize = true,
            Font = Tokens.FonteSemibold(Tokens.Claro.FonteTamanhoLegenda),
            ForeColor = TemaCrono.Verde,
            BackColor = Tokens.VerdeSuave,
            Padding = new Padding(8, 4, 8, 4),
        };
        Forma.AplicarRaio(_tb50PingEditor, 7);

        var btnViPlexCrono = BotaoPeq("Ativar ViPlex", 0, () => Seguro.Rodar(this, () => ExecutarAcaoViplexAsync("ativar_cronometragem", "CRONOMETRAGEM")));
        var btnRecarregar = BotaoPeq("Recarregar", 0, () => Seguro.Rodar(this, () => ExecutarAcaoViplexAsync("reiniciar_webview", null)));
        var btnAplicar = BotaoPeq("Transmitir Agora", 1, () => Seguro.Rodar(this, TransmitirAgoraTb50Async));

        topo.Controls.AddRange([tit, resPill, _tb50PingEditor, btnViPlexCrono, btnRecarregar, btnAplicar]);
        void PosicionarTopoEditor()
        {
            const int minTituloW = 100;
            var limiteEsq = 2 + minTituloW + 8;
            var x = topo.Width;

            void TentarPosicionar(Control c, bool obrigatorio = false)
            {
                var cabe = x - c.Width >= limiteEsq;
                c.Visible = obrigatorio || cabe;
                if (!c.Visible) return;
                x = Math.Max(2, x - c.Width);
                c.Location = new Point(x, (topo.Height - c.Height) / 2);
                x -= 6;
            }

            TentarPosicionar(btnAplicar, obrigatorio: true);
            TentarPosicionar(_tb50PingEditor);
            TentarPosicionar(btnViPlexCrono);
            TentarPosicionar(btnRecarregar);
            if (x - resPill.Width - 10 > 240)
                TentarPosicionar(resPill);
            else
                resPill.Visible = false;

            tit.Location = new Point(2, (topo.Height - tit.Height) / 2);
            tit.Width = Math.Max(40, x - tit.Left - 2);
        }
        topo.Resize += (_, _) => PosicionarTopoEditor();
        _tb50PingEditor.SizeChanged += (_, _) => PosicionarTopoEditor();

        // Stage central mantendo 4:1 exacto (2048 x 512)
        var palco = new Panel { Dock = DockStyle.Fill, BackColor = Color.FromArgb(245, 245, 247), Padding = new Padding(10) };
        _tb50Canvas = new PreviewTb50Canvas(this);
        _tb50Canvas.CamadaClicada += camada =>
        {
            _tb50CamadaSel = camada;
            _tb50Canvas.Invalidate();
            PopularCamadasTb50();
        };
        palco.Controls.Add(_tb50Canvas);
        palco.Resize += (_, _) => ReposicionarCanvas4x1(palco, _tb50Canvas);

        // Barra de 14 Widgets
        var widgets = new FlowLayoutPanel
        {
            Dock = DockStyle.Bottom,
            Height = 42,
            WrapContents = true,
            AutoSize = false,
            BackColor = Tokens.Primitivo.Branco,
            Padding = new Padding(0, 6, 0, 0),
        };
        var botoesWidget = new List<Button>();
        foreach (var w in WidgetsTb50)
        {
            var nomeW = w;
            var b = new BotaoPlano
            {
                Text = nomeW,
                AutoSize = true,
                Height = 28,
                FlatStyle = FlatStyle.Flat,
                Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoLegenda, FontStyle.Bold),
                BackColor = nomeW == _tb50FerramentaAtiva ? Tokens.Claro.CorAcaoPrincipal : Color.FromArgb(242, 242, 247),
                ForeColor = nomeW == _tb50FerramentaAtiva ? Tokens.Primitivo.Branco : TemaCrono.Texto,
                Margin = new Padding(0, 2, 5, 2),
                Padding = new Padding(8, 2, 8, 2),
                Cursor = Cursors.Hand,
            };
            b.FlatAppearance.BorderSize = 0;
            Forma.AplicarRaio(b, 7);
            b.Click += (_, _) =>
            {
                _tb50FerramentaAtiva = nomeW;
                foreach (var bw in botoesWidget)
                {
                    var ativo = bw.Text == _tb50FerramentaAtiva;
                    bw.BackColor = ativo ? Tokens.Claro.CorAcaoPrincipal : Color.FromArgb(242, 242, 247);
                    bw.ForeColor = ativo ? Tokens.Primitivo.Branco : TemaCrono.Texto;
                }
                ExecutarWidgetToolbarTb50(nomeW);
            };
            botoesWidget.Add(b);
            widgets.Controls.Add(b);
        }
        card.Resize += (_, _) =>
        {
            var prefH = widgets.GetPreferredSize(new Size(Math.Max(200, card.Width - 24), 0)).Height;
            widgets.Height = Math.Clamp(prefH, 36, 74);
        };

        card.Controls.Add(palco);
        card.Controls.Add(widgets);
        card.Controls.Add(topo);
        palco.BringToFront();
        return card;
    }

    Panel CardPlaylistControlesTb50()
    {
        var card = new TemaCrono.PainelArredondado { Dock = DockStyle.Fill, BackColor = Tokens.Primitivo.Branco, Raio = 16, Padding = new Padding(12) };

        var split = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1, BackColor = Tokens.Primitivo.Branco };
        split.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        split.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 276));
        split.RowStyles.Add(new RowStyle(SizeType.Percent, 100));

        // Esquerda: Playlist Grid + ações
        var esq = new Panel { Dock = DockStyle.Fill, BackColor = Tokens.Primitivo.Branco, Padding = new Padding(0, 0, 12, 0) };
        var cabPl = new Panel { Dock = DockStyle.Top, Height = 34, BackColor = Tokens.Primitivo.Branco };
        var titPl = new Label { Text = "Playlist / Programação", AutoSize = true, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoSubtitulo, FontStyle.Bold), ForeColor = TemaCrono.Texto, Location = new Point(0, 5) };
        _tb50TotalPlaylist = new Label { Text = "Duração total: 00:00", AutoSize = true, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno), ForeColor = TemaCrono.Secundario, Location = new Point(195, 7) };

        var bPlAdd = BotaoPeq("+ Adicionar", 1, () => EditarItemPlaylistDialogo(null));
        var bPlEdit = BotaoPeq("Editar", 0, () => EditarItemPlaylistDialogo(_gTb50Playlist.ChaveAtual as JsonObject));
        var bPlDup = BotaoPeq("Duplicar", 0, DuplicarItemPlaylist);
        var bPlRem = BotaoPeq("Remover", 2, () => RemoverItemPlaylist(null));
        var plBotoes = new FlowLayoutPanel { Dock = DockStyle.Right, AutoSize = true, WrapContents = false, BackColor = Tokens.Primitivo.Branco };
        plBotoes.Controls.AddRange([bPlAdd, bPlEdit, bPlDup, bPlRem]);
        cabPl.Controls.AddRange([plBotoes, titPl, _tb50TotalPlaylist]);

        TemaCrono.EstilizarGrade(_gTb50Playlist);
        _gTb50Playlist.Col("#", 38).Col("Item (Layout / Conteúdo)", 180, DataGridViewContentAlignment.MiddleLeft, true)
            .Col("Tipo", 110).Col("Duração", 74).Col("Transição", 76).Col("Status", 72);
        _gTb50Playlist.CellDoubleClick += (_, e) => { if (e.RowIndex >= 0) AtivarItemPlaylistSelecionado(); };

        esq.Controls.Add(_gTb50Playlist);
        esq.Controls.Add(cabPl);
        _gTb50Playlist.BringToFront();

        // Direita: Controles de Exibição + Modo de Exibição + Paginação
        var dir = new Panel { Dock = DockStyle.Fill, BackColor = Color.FromArgb(250, 250, 252), Padding = new Padding(10) };
        dir.Paint += (_, e) =>
        {
            using var p = Forma.Redondo(new Rectangle(0, 0, dir.Width - 1, dir.Height - 1), 12);
            using var pen = new Pen(TemaCrono.Borda);
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            e.Graphics.DrawPath(pen, p);
        };

        var lCtrl = new Label { Text = "Controle de Exibição", AutoSize = true, Font = Tokens.FonteSemibold(Tokens.Claro.FonteTamanhoPequeno), ForeColor = TemaCrono.Texto, Location = new Point(10, 8) };
        _btnTb50Play = BotaoGradeCtrl("▶ Reproduzir", true, () => DefinirPlaybackTb50("reproduzindo"));
        _btnTb50Pause = BotaoGradeCtrl("⏸ Pausar", false, () => DefinirPlaybackTb50("pausado"));
        _btnTb50Stop = BotaoGradeCtrl("⏹ Parar", false, () => DefinirPlaybackTb50("parado"));
        var bAnt = BotaoGradeCtrl("⏮ Anterior", false, () => NavegarPlaylistTb50(-1));
        var bProx = BotaoGradeCtrl("⏭ Próximo", false, () => NavegarPlaylistTb50(1));
        _btnTb50Loop = BotaoGradeCtrl("🔁 Loop", false, AlternarLoopTb50);

        var gridCtrl = new TableLayoutPanel { Location = new Point(8, 28), Size = new Size(256, 66), ColumnCount = 3, RowCount = 2, BackColor = Color.Transparent };
        gridCtrl.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 36));
        gridCtrl.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 32));
        gridCtrl.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 32));
        gridCtrl.RowStyles.Add(new RowStyle(SizeType.Percent, 50));
        gridCtrl.RowStyles.Add(new RowStyle(SizeType.Percent, 50));
        gridCtrl.Controls.Add(_btnTb50Play, 0, 0);
        gridCtrl.Controls.Add(_btnTb50Pause, 1, 0);
        gridCtrl.Controls.Add(_btnTb50Stop, 2, 0);
        gridCtrl.Controls.Add(bAnt, 0, 1);
        gridCtrl.Controls.Add(bProx, 1, 1);
        gridCtrl.Controls.Add(_btnTb50Loop, 2, 1);

        var lModo = new Label { Text = "Modo de Exibição", AutoSize = true, Font = Tokens.FonteSemibold(Tokens.Claro.FonteTamanhoPequeno), ForeColor = TemaCrono.Texto, Location = new Point(10, 102) };
        _btnTb50ModoAoVivo = BotaoGradeCtrl("● Ao Vivo", true, () => DefinirModoTb50("ao_vivo"));
        _btnTb50ModoPlaylist = BotaoGradeCtrl("Playlist", false, () => DefinirModoTb50("playlist"));
        _btnTb50ModoManual = BotaoGradeCtrl("Manual", false, () => DefinirModoTb50("manual"));

        var gridModo = new TableLayoutPanel { Location = new Point(8, 122), Size = new Size(256, 32), ColumnCount = 3, RowCount = 1, BackColor = Color.Transparent };
        gridModo.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 34));
        gridModo.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 33));
        gridModo.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 33));
        gridModo.Controls.Add(_btnTb50ModoAoVivo, 0, 0);
        gridModo.Controls.Add(_btnTb50ModoPlaylist, 1, 0);
        gridModo.Controls.Add(_btnTb50ModoManual, 2, 0);

        var lPag = new Label { Text = "Paginação TB50 (Karts)", AutoSize = true, Font = Tokens.FonteSemibold(Tokens.Claro.FonteTamanhoPequeno), ForeColor = TemaCrono.Texto, Location = new Point(10, 162) };
        _btnTb50Pag1 = BotaoGradeCtrl("1–14 / 1–20", true, () => DefinirPaginacaoTb50(0, false));
        _btnTb50Pag2 = BotaoGradeCtrl("15–28 / 21+", false, () => DefinirPaginacaoTb50(14, false));
        _btnTb50PagAuto = BotaoGradeCtrl("Auto", false, () => DefinirPaginacaoTb50(0, true));

        var gridPag = new TableLayoutPanel { Location = new Point(8, 182), Size = new Size(256, 32), ColumnCount = 3, RowCount = 1, BackColor = Color.Transparent };
        gridPag.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 36));
        gridPag.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 36));
        gridPag.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 28));
        gridPag.Controls.Add(_btnTb50Pag1, 0, 0);
        gridPag.Controls.Add(_btnTb50Pag2, 1, 0);
        gridPag.Controls.Add(_btnTb50PagAuto, 2, 0);

        dir.Controls.AddRange([lCtrl, gridCtrl, lModo, gridModo, lPag, gridPag]);
        dir.Resize += (_, _) =>
        {
            var w = Math.Max(180, dir.Width - 16);
            gridCtrl.Width = w;
            gridModo.Width = w;
            gridPag.Width = w;
        };

        split.Controls.Add(esq, 0, 0);
        split.Controls.Add(dir, 1, 0);
        card.Controls.Add(split);
        return card;
    }

    Panel CardDireitaTb50()
    {
        var card = new TemaCrono.PainelArredondado { Dock = DockStyle.Fill, BackColor = Tokens.Primitivo.Branco, Raio = 16, Padding = new Padding(12) };

        _tb50DirSeg = new SegmentoDesign
        {
            BackColor = Tokens.Primitivo.Branco,
            Itens = ["Layout Atual", "Propriedades"],
            Dock = DockStyle.Top,
        };
        _tb50DirSeg.Mudou += idx =>
        {
            _tb50DirLayoutHost.Visible = idx == 0;
            _tb50DirPropsHost.Visible = idx == 1;
        };

        // View 0: Layout Atual + Camadas + Templates
        _tb50DirLayoutHost = new Panel { Dock = DockStyle.Fill, BackColor = Tokens.Primitivo.Branco, Padding = new Padding(0, 8, 0, 0) };

        var resumoCard = new Panel { Dock = DockStyle.Top, Height = 88, BackColor = Color.FromArgb(248, 249, 251), Padding = new Padding(8) };
        resumoCard.Paint += (_, e) =>
        {
            using var p = Forma.Redondo(new Rectangle(0, 0, resumoCard.Width - 1, resumoCard.Height - 1), 10);
            using var pen = new Pen(TemaCrono.Borda);
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            e.Graphics.DrawPath(pen, p);
        };
        _tb50MiniPreview = new Panel { Size = new Size(104, 34), Location = new Point(8, 10), BackColor = Tokens.Preto };
        _tb50MiniPreview.Paint += (_, e) => DesenharMiniTemplate(e.Graphics, _tb50MiniPreview.ClientRectangle, _tb50Cfg.S("layout"), true);
        _tb50LayoutResumoNome = new Label { Text = "Placar 14 Karts (ms)", Font = Tokens.FonteSemibold(Tokens.Claro.FonteTamanhoCorpo), ForeColor = TemaCrono.Texto, Location = new Point(120, 8), Size = new Size(165, 20), AutoEllipsis = true };
        _tb50LayoutResumoMeta = new Label { Text = "2048 × 512 · Ao Vivo (ms)", Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoLegenda), ForeColor = TemaCrono.Secundario, Location = new Point(120, 28), Size = new Size(165, 18), AutoEllipsis = true };
        var btnSalvarLayout = BotaoPeq("Salvar Config", 3, () => Seguro.Rodar(this, TransmitirAgoraTb50Async));
        btnSalvarLayout.Height = 26;
        btnSalvarLayout.Location = new Point(8, 52);
        var btnResetLayout = BotaoPeq("Padrão", 0, () =>
        {
            _tb50Cfg["layout"] = "grid-14-ms";
            _tb50Cfg["mode"] = "ao_vivo";
            AtualizarTodasVistasTb50();
            _ = SalvarConfigTb50Async();
        });
        btnResetLayout.Height = 26;
        btnResetLayout.Location = new Point(128, 52);
        resumoCard.Controls.AddRange([_tb50MiniPreview, _tb50LayoutResumoNome, _tb50LayoutResumoMeta, btnSalvarLayout, btnResetLayout]);

        var lCam = new Label { Text = "Camadas do Layout", Dock = DockStyle.Top, Height = 26, Font = Tokens.FonteSemibold(Tokens.Claro.FonteTamanhoPequeno), ForeColor = TemaCrono.Texto, TextAlign = ContentAlignment.BottomLeft };
        _tb50CamadasFlow = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 152, FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoScroll = true, BackColor = Tokens.Primitivo.Branco, Padding = new Padding(0, 4, 0, 4) };

        var lTpl = new Label { Text = "Templates de Layout", Dock = DockStyle.Top, Height = 26, Font = Tokens.FonteSemibold(Tokens.Claro.FonteTamanhoPequeno), ForeColor = TemaCrono.Texto, TextAlign = ContentAlignment.BottomLeft };
        _tb50TemplatesFlow = new FlowLayoutPanel { Dock = DockStyle.Fill, AutoScroll = true, WrapContents = true, BackColor = Tokens.Primitivo.Branco, Padding = new Padding(0, 6, 0, 0) };
        _tb50TemplatesFlow.Resize += (_, _) =>
        {
            var w = Math.Max(120, (_tb50TemplatesFlow.ClientSize.Width - 16) / 2);
            foreach (Control c in _tb50TemplatesFlow.Controls) c.Width = w;
        };

        _tb50DirLayoutHost.Controls.Add(_tb50TemplatesFlow);
        _tb50DirLayoutHost.Controls.Add(lTpl);
        _tb50DirLayoutHost.Controls.Add(_tb50CamadasFlow);
        _tb50DirLayoutHost.Controls.Add(lCam);
        _tb50DirLayoutHost.Controls.Add(resumoCard);
        _tb50TemplatesFlow.BringToFront();

        // View 1: Propriedades
        _tb50DirPropsHost = ConstruirPainelPropriedadesTb50();

        card.Controls.Add(_tb50DirPropsHost);
        card.Controls.Add(_tb50DirLayoutHost);
        card.Controls.Add(_tb50DirSeg);
        _tb50DirLayoutHost.BringToFront();
        return card;
    }

    Panel ConstruirPainelPropriedadesTb50()
    {
        var panel = new Panel { Dock = DockStyle.Fill, AutoScroll = true, BackColor = Tokens.Primitivo.Branco, Visible = false, Padding = new Padding(0, 8, 4, 8) };
        var stack = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, FlowDirection = FlowDirection.TopDown, WrapContents = false, BackColor = Tokens.Primitivo.Branco };

        void CampoTxt(string rotulo, out TextBox tb, string placeholder = "")
        {
            var lbl = new Label { Text = rotulo, AutoSize = true, Font = Tokens.FonteSemibold(Tokens.Claro.FonteTamanhoLegenda), ForeColor = TemaCrono.Secundario, Margin = new Padding(0, 6, 0, 2) };
            var box = new TemaCrono.PainelArredondado { Size = new Size(276, 30), BackColor = Color.FromArgb(245, 245, 247), Raio = 8, Padding = new Padding(8, 5, 8, 4) };
            tb = PecasDesign.Texto("", 120);
            tb.Dock = DockStyle.Fill;
            tb.BackColor = Color.FromArgb(245, 245, 247);
            tb.PlaceholderText = placeholder;
            box.Controls.Add(tb);
            stack.Controls.Add(lbl);
            stack.Controls.Add(box);
        }

        CheckBox MarcaProp(string texto)
        {
            var c = new CheckBox { Text = texto, AutoSize = true, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno), ForeColor = TemaCrono.Texto, Margin = new Padding(2, 5, 0, 2) };
            Forma.CheckVerde(c);
            c.CheckedChanged += (_, _) =>
            {
                if (_tb50AplicandoUi) return;
                LerPropriedadesDaUi();
                _tb50Canvas?.Invalidate();
            };
            stack.Controls.Add(c);
            return c;
        }

        CampoTxt("Título Customizado (vazio = automático)", out _tb50PropTitulo, "Ex.: TOP 3 AO VIVO");
        CampoTxt("Subtítulo / Traçado", out _tb50PropSubtitulo, "Ex.: 500 MILHAS 2026");
        CampoTxt("Rodapé / Mensagem", out _tb50PropRodape, "Ex.: Cronometragem ao vivo");
        CampoTxt("Clima na Pista", out _tb50PropClima, "Ex.: 26°C · Pista Seca");
        CampoTxt("URL QR Code", out _tb50PropQr, "https://kartodromodebetim.com.br");
        CampoTxt("Cor Primária (#hex)", out _tb50PropCorPri, "#00E676");
        CampoTxt("Cor Destaque (#hex)", out _tb50PropCorDest, "#FFB300");
        CampoTxt("Paginação Automática (seg)", out _tb50PropAutoPagSeg, "8");

        _tb50ChkMilesimos = MarcaProp("Exibir milésimos (.000)");
        _tb50ChkPodioAuto = MarcaProp("Pódio automático ao encerrar");
        _tb50ChkAutoPag = MarcaProp("Alternar páginas automaticamente");
        _tb50ChkClima = MarcaProp("Mostrar Clima no rodapé");
        _tb50ChkHora = MarcaProp("Mostrar Hora / Data");
        _tb50ChkQr = MarcaProp("Mostrar QR Code no painel");

        var btnSalvarProps = BotaoPeq("Aplicar e Transmitir Agora", 1, () => Seguro.Rodar(this, async () =>
        {
            LerPropriedadesDaUi();
            await TransmitirAgoraTb50Async();
        }));
        btnSalvarProps.Margin = new Padding(0, 12, 0, 6);
        stack.Controls.Add(btnSalvarProps);

        panel.Resize += (_, _) =>
        {
            var w = Math.Max(200, panel.ClientSize.Width - 10);
            foreach (Control c in stack.Controls) if (c is TemaCrono.PainelArredondado p) p.Width = w;
        };
        panel.Controls.Add(stack);
        return panel;
    }

    // =========================================================================
    // Sub-páginas expandidas (Conteúdo, Templates, Playlist, Agenda, Patrocinadores, Hardware TB50, Monitoramento)
    // =========================================================================

    void AlternarSubModoTb50()
    {
        var studio = _tb50SubModo == 0;
        _tb50CorpoEstudio.Visible = studio;
        _tb50CorpoSubpagina.Visible = !studio;

        // Zera referências temporárias das sub-páginas antes de recriar
        _tb50TemplateCanvas = null;
        _tb50KpiEstado = null; _tb50KpiPing = null; _tb50KpiModo = null; _tb50KpiPrograma = null;
        _gTb50PlaylistSub = null; _gTb50Conteudo = null; _gTb50Agenda = null;
        _gTb50Patrocinadores = null; _gTb50Viplex = null; _gTb50Telas = null; _gTb50Historico = null;
        foreach (Control old in _tb50CorpoSubpagina.Controls) old.Dispose();
        _tb50CorpoSubpagina.Controls.Clear();

        if (studio)
        {
            AtualizarTodasVistasTb50();
            return;
        }

        _tb50CorpoSubpagina.SuspendLayout();
        Control view = _tb50SubModo switch
        {
            1 => SubpaginaConteudo(),
            2 => SubpaginaTemplates(),
            3 => SubpaginaPlaylist(),
            4 => SubpaginaAgenda(),
            5 => SubpaginaPatrocinadores(),
            6 => SubpaginaHardware(),
            _ => SubpaginaMonitoramento(),
        };
        view.Dock = DockStyle.Fill;
        _tb50CorpoSubpagina.Controls.Add(view);
        _tb50CorpoSubpagina.ResumeLayout();
        AtualizarTodasVistasTb50();
    }

    Control SubpaginaConteudo()
    {
        _gTb50Conteudo = new LiveGrid();
        TemaCrono.EstilizarGrade(_gTb50Conteudo);
        _gTb50Conteudo.Col("Nome", 210, DataGridViewContentAlignment.MiddleLeft, true)
            .Col("Categoria", 140).Col("Descrição", 240, DataGridViewContentAlignment.MiddleLeft, true)
            .Col("Resolução", 96).Col("Duração", 76);
        _gTb50Conteudo.CellDoubleClick += (_, e) => { if (e.RowIndex >= 0 && _gTb50Conteudo.ChaveAtual is JsonObject item) UsarItemBiblioteca(item); };

        return CartaoPasso(-1, "Gerenciar Conteúdo (TB50)",
            new Label { Text = "Imagens PNG/JPG, vídeos, informativos, patrocinadores e programas ViPlex da NovaStar TB50" },
            _gTb50Conteudo,
            [
                BotaoPeq("+ Enviar Imagem / Mídia", 1, AbrirDialogoAdicionarMidia),
                BotaoPeq("Exibir Agora na TB50", 3, () => { if (_gTb50Conteudo.ChaveAtual is JsonObject it) UsarItemBiblioteca(it); }),
                BotaoPeq("+ Adicionar à Playlist", 0, () => { if (_gTb50Conteudo.ChaveAtual is JsonObject it) AdicionarBibliotecaNaPlaylist(it); }),
                BotaoPeq("Excluir", 2, () => Seguro.Rodar(this, ExcluirMidiaSelecionadaAsync)),
            ]);
    }

    Control SubpaginaTemplates()
    {
        var split = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 2, BackColor = TemaCrono.Fundo };
        split.RowStyles.Add(new RowStyle(SizeType.Percent, 52));
        split.RowStyles.Add(new RowStyle(SizeType.Percent, 48));

        var topCard = new TemaCrono.PainelArredondado { Dock = DockStyle.Fill, BackColor = Tokens.Primitivo.Branco, Raio = 16, Padding = new Padding(14), Margin = new Padding(0, 0, 0, 12) };
        var palco = new Panel { Dock = DockStyle.Fill, BackColor = Color.FromArgb(245, 245, 247), Padding = new Padding(12) };
        _tb50TemplateCanvas = new PreviewTb50Canvas(this);
        palco.Controls.Add(_tb50TemplateCanvas);
        palco.Resize += (_, _) => ReposicionarCanvas4x1(palco, _tb50TemplateCanvas);
        ReposicionarCanvas4x1(palco, _tb50TemplateCanvas);
        topCard.Controls.Add(palco);

        var galeriaCard = new TemaCrono.PainelArredondado { Dock = DockStyle.Fill, BackColor = Tokens.Primitivo.Branco, Raio = 16, Padding = new Padding(14) };
        var lTit = new Label { Text = "Selecione o Template de Exibição (2048 × 512)", Dock = DockStyle.Top, Height = 30, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoSubtitulo, FontStyle.Bold), ForeColor = TemaCrono.Texto };
        var flow = new FlowLayoutPanel { Dock = DockStyle.Fill, AutoScroll = true, BackColor = Tokens.Primitivo.Branco, Padding = new Padding(0, 8, 0, 0) };
        foreach (var tpl in TemplatesTb50)
        {
            var tCard = CriarMiniCardTemplate(tpl.id, tpl.nome, tpl.sub, tpl.cor, 260, 118, () =>
            {
                _tb50Cfg["layout"] = tpl.id;
                _tb50Cfg["mode"] = "ao_vivo";
                _tb50TemplateCanvas?.Invalidate();
                AtualizarTodasVistasTb50();
                _ = SalvarConfigTb50Async();
            });
            flow.Controls.Add(tCard);
        }
        galeriaCard.Controls.Add(flow);
        galeriaCard.Controls.Add(lTit);
        flow.BringToFront();

        split.Controls.Add(topCard, 0, 0);
        split.Controls.Add(galeriaCard, 0, 1);
        return split;
    }

    Control SubpaginaPlaylist()
    {
        _gTb50PlaylistSub = new LiveGrid();
        TemaCrono.EstilizarGrade(_gTb50PlaylistSub);
        _gTb50PlaylistSub.Col("#", 44).Col("Item (Layout / Conteúdo)", 240, DataGridViewContentAlignment.MiddleLeft, true)
            .Col("Tipo", 130).Col("Duração", 90).Col("Transição", 90).Col("Status", 90);
        _gTb50PlaylistSub.CellDoubleClick += (_, e) =>
        {
            if (e.RowIndex >= 0 && _gTb50PlaylistSub?.ChaveAtual is JsonObject it)
            {
                _tb50Cfg["layout"] = it.S("layoutOuMidia") is { Length: > 0 } lm ? lm : "grid-14-ms";
                _tb50Cfg["mediaAtivaUrl"] = it.S("mediaUrl");
                _tb50Cfg["mode"] = "manual";
                AtualizarTodasVistasTb50();
                _ = SalvarConfigTb50Async();
            }
        };
        return CartaoPasso(-1, "Playlist / Programação TB50",
            new Label { Text = "Sequência automática de layouts, patrocinadores e resultados com duração individual" },
            _gTb50PlaylistSub,
            [
                BotaoPeq("+ Adicionar Item", 1, () => EditarItemPlaylistDialogo(null)),
                BotaoPeq("Editar", 0, () => EditarItemPlaylistDialogo((_gTb50PlaylistSub?.ChaveAtual ?? _gTb50Playlist.ChaveAtual) as JsonObject)),
                BotaoPeq("Duplicar", 0, () => { var it = _gTb50PlaylistSub?.ChaveAtual as JsonObject; if (it != null) { var cl = it.DeepClone().AsObject(); cl["id"] = $"pl-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}"; cl["nome"] = it.S("nome") + " (Cópia)"; (_tb50Cfg["playlist"] as JsonArray)?.Add(cl); AtualizarTodasVistasTb50(); _ = SalvarConfigTb50Async(); } else DuplicarItemPlaylist(); }),
                BotaoPeq("Subir", 0, () => MoverItemPlaylist(-1, _gTb50PlaylistSub?.ChaveAtual as JsonObject)),
                BotaoPeq("Descer", 0, () => MoverItemPlaylist(1, _gTb50PlaylistSub?.ChaveAtual as JsonObject)),
                BotaoPeq("Ativar Modo Playlist Agora", 3, () => DefinirModoTb50("playlist")),
                BotaoPeq("Remover", 2, () => RemoverItemPlaylist(_gTb50PlaylistSub?.ChaveAtual as JsonObject)),
            ]);
    }

    Control SubpaginaAgenda()
    {
        _gTb50Agenda = new LiveGrid();
        TemaCrono.EstilizarGrade(_gTb50Agenda);
        _gTb50Agenda.Col("Horário", 90).Col("Dias", 110).Col("Nome", 220, DataGridViewContentAlignment.MiddleLeft, true)
            .Col("Ação", 100).Col("Destino", 160).Col("Ativo", 80);

        return CartaoPasso(-1, "Agendamento Automático da TB50",
            new Label { Text = "Troque layouts, playlist ou programas ViPlex automaticamente por horário" },
            _gTb50Agenda,
            [
                BotaoPeq("+ Novo Agendamento", 1, AbrirDialogoNovoAgendamento),
                BotaoPeq("Ativar / Desativar", 0, AlternarAtivoAgendamento),
                BotaoPeq("Excluir", 2, ExcluirAgendamento),
            ]);
    }

    Control SubpaginaPatrocinadores()
    {
        _gTb50Patrocinadores = new LiveGrid();
        TemaCrono.EstilizarGrade(_gTb50Patrocinadores);
        _gTb50Patrocinadores.Col("Patrocinador / Marca", 220, DataGridViewContentAlignment.MiddleLeft, true)
            .Col("Slogan / Chamada", 260, DataGridViewContentAlignment.MiddleLeft, true)
            .Col("Cor", 96).Col("Status", 90);

        return CartaoPasso(-1, "Patrocinadores no Painel de LED",
            new Label { Text = "Exibidos no rodapé dos layouts Ao Vivo e em tela cheia no modo Patrocinadores" },
            _gTb50Patrocinadores,
            [
                BotaoPeq("+ Novo Patrocinador", 1, () => AbrirDialogoPatrocinador(null)),
                BotaoPeq("Editar", 0, () => AbrirDialogoPatrocinador(_gTb50Patrocinadores.ChaveAtual as JsonObject)),
                BotaoPeq("Ativar / Desativar", 0, AlternarAtivoPatrocinador),
                BotaoPeq("Exibir na TB50 Agora", 3, () =>
                {
                    _tb50Cfg["layout"] = "patrocinadores";
                    _tb50Cfg["mode"] = "manual";
                    _ = TransmitirAgoraTb50Async();
                }),
                BotaoPeq("Excluir", 2, ExcluirPatrocinador),
            ]);
    }

    Control SubpaginaHardware()
    {
        var card = new TemaCrono.PainelArredondado { Dock = DockStyle.Fill, BackColor = Tokens.Primitivo.Branco, Raio = 16, Padding = new Padding(20), AutoScroll = true };
        var hw = (_tb50Cfg?["hardware"] as JsonObject) ?? new JsonObject();

        var titulo = new Label { Text = "Configurações de Hardware — NovaStar TB50 & ViPlex Express API", Dock = DockStyle.Top, Height = 32, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoTitulo, FontStyle.Bold), ForeColor = TemaCrono.Texto };
        var sub = new Label { Text = "Controladora Taurus interna da pista (192.168.20.253:16674) · Resolução nativa 2048 × 512", Dock = DockStyle.Top, Height = 24, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno), ForeColor = TemaCrono.Secundario };

        var grade = new TableLayoutPanel { Dock = DockStyle.Top, AutoSize = true, ColumnCount = 4, Padding = new Padding(0, 12, 0, 12), BackColor = Tokens.Primitivo.Branco };
        grade.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 190));
        grade.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 260));
        grade.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 190));
        grade.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 260));

        TextBox CampoHw(string rot, string val, int col, int row, bool senha = false)
        {
            var lbl = new Label { Text = rot, AutoSize = true, Font = Tokens.FonteSemibold(Tokens.Claro.FonteTamanhoPequeno), ForeColor = TemaCrono.Secundario, Margin = new Padding(4, 10, 8, 6) };
            var caixa = new TemaCrono.PainelArredondado { Size = new Size(240, 32), BackColor = Color.FromArgb(245, 245, 247), Raio = 8, Padding = new Padding(8, 6, 8, 4), Margin = new Padding(0, 4, 16, 4) };
            var tb = PecasDesign.Texto(val, 100);
            tb.Dock = DockStyle.Fill;
            tb.BackColor = Color.FromArgb(245, 245, 247);
            if (senha) tb.UseSystemPasswordChar = true;
            caixa.Controls.Add(tb);
            grade.Controls.Add(lbl, col, row);
            grade.Controls.Add(caixa, col + 1, row);
            return tb;
        }

        _tb50HwHost = CampoHw("IP da TB50", hw.S("host") is { Length: > 0 } h ? h : "192.168.20.253", 0, 0);
        _tb50HwPort = CampoHw("Porta API ViPlex", (hw.I("port") > 0 ? hw.I("port") : 16674).ToString(), 2, 0);
        _tb50HwSerial = CampoHw("Número de Série (SN)", hw.S("serial") is { Length: > 0 } sn ? sn : "25212A000010665", 0, 1);
        _tb50HwUser = CampoHw("Usuário ViPlex", hw.S("username") is { Length: > 0 } us ? us : "admin", 2, 1);
        _tb50HwProgPadrao = CampoHw("Programa Padrão", hw.S("programaPadrao") is { Length: > 0 } pr ? pr : "CRONOMETRAGEM", 0, 2);
        _tb50HwBrilho = CampoHw("Brilho Alvo (%)", (hw.I("brilho") > 0 ? hw.I("brilho") : 85).ToString(), 2, 2);
        _tb50HwVolume = CampoHw("Volume (%)", hw.I("volume").ToString(), 0, 3);
        _tb50HwSenha = CampoHw("Senha ViPlex (opcional)", "", 2, 3, true);

        var acoes = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 50, BackColor = Tokens.Primitivo.Branco, Padding = new Padding(0, 8, 0, 0) };
        acoes.Controls.AddRange([
            BotaoPeq("Salvar Hardware TB50", 1, () => Seguro.Rodar(this, SalvarHardwareTb50Async)),
            BotaoPeq("Testar Conexão & Listar Programas", 3, () => Seguro.Rodar(this, ListarProgramasViplexAsync)),
            BotaoPeq("Ativar CRONOMETRAGEM", 0, () => Seguro.Rodar(this, () => ExecutarAcaoViplexAsync("ativar_cronometragem", "CRONOMETRAGEM"))),
            BotaoPeq("Ativar VIDEOS", 0, () => Seguro.Rodar(this, () => ExecutarAcaoViplexAsync("ativar_programa", "VIDEOS"))),
            BotaoPeq("Recarregar WebView /tb50", 0, () => Seguro.Rodar(this, () => ExecutarAcaoViplexAsync("reiniciar_webview", null))),
            BotaoPeq("Parar Player TB50", 2, () => Seguro.Rodar(this, () => ExecutarAcaoViplexAsync("parar", _tb50HwProgPadrao?.Text ?? "CRONOMETRAGEM"))),
        ]);

        card.Controls.Add(acoes);
        card.Controls.Add(grade);
        card.Controls.Add(sub);
        card.Controls.Add(titulo);
        return card;
    }

    Control SubpaginaMonitoramento()
    {
        var split = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 3, BackColor = TemaCrono.Fundo };
        split.RowStyles.Add(new RowStyle(SizeType.Absolute, 84));
        split.RowStyles.Add(new RowStyle(SizeType.Percent, 50));
        split.RowStyles.Add(new RowStyle(SizeType.Percent, 50));

        // Linha 1: KPI Cards
        var kpis = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 4, RowCount = 1, Margin = new Padding(0, 0, 0, 12) };
        for (var i = 0; i < 4; i++) kpis.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 25));

        Panel Kpi(string tit, out Label valLbl, int colIdx)
        {
            var c = new TemaCrono.PainelArredondado { Dock = DockStyle.Fill, BackColor = Tokens.Primitivo.Branco, Raio = 14, Padding = new Padding(14, 10, 14, 10), Margin = new Padding(0, 0, colIdx < 3 ? 12 : 0, 0) };
            var lT = new Label { Text = tit, Dock = DockStyle.Top, Height = 18, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoLegenda), ForeColor = TemaCrono.Secundario };
            valLbl = new Label { Text = "—", Dock = DockStyle.Fill, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoTitulo, FontStyle.Bold), ForeColor = TemaCrono.Texto, TextAlign = ContentAlignment.MiddleLeft };
            c.Controls.Add(valLbl);
            c.Controls.Add(lT);
            return c;
        }
        kpis.Controls.Add(Kpi("Estado /TB50", out _tb50KpiEstado, 0), 0, 0);
        kpis.Controls.Add(Kpi("Último Sinal (Ping)", out _tb50KpiPing, 1), 1, 0);
        kpis.Controls.Add(Kpi("Layout / Modo Ativo", out _tb50KpiModo, 2), 2, 0);
        kpis.Controls.Add(Kpi("Hardware NovaStar TB50", out _tb50KpiPrograma, 3), 3, 0);

        // Linha 2: Programas ViPlex na TB50 + Telas conectadas
        var mid = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1, Margin = new Padding(0, 0, 0, 12) };
        mid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 55));
        mid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 45));

        _gTb50Viplex = new LiveGrid();
        TemaCrono.EstilizarGrade(_gTb50Viplex);
        _gTb50Viplex.Col("Programa TB50", 160, DataGridViewContentAlignment.MiddleLeft, true).Col("Resolução", 90).Col("Status", 86).Col("ID", 120);
        _gTb50Viplex.CellDoubleClick += (_, e) =>
        {
            if (e.RowIndex >= 0 && _gTb50Viplex.ChaveAtual is JsonObject p)
                Seguro.Rodar(this, () => ExecutarAcaoViplexAsync("ativar_programa", p.S("name"), p.S("identifier")));
        };
        var cProg = CartaoPasso(-1, "Programas ViPlex na TB50 (192.168.20.253)",
            new Label { Text = "Clique duas vezes em um programa para iniciá-lo na processadora" },
            _gTb50Viplex,
            [
                BotaoPeq("Atualizar Lista ViPlex", 1, () => Seguro.Rodar(this, ListarProgramasViplexAsync)),
                BotaoPeq("Iniciar Selecionado", 3, () =>
                {
                    if (_gTb50Viplex.ChaveAtual is JsonObject p)
                        Seguro.Rodar(this, () => ExecutarAcaoViplexAsync("ativar_programa", p.S("name"), p.S("identifier")));
                }),
            ]);
        cProg.Margin = new Padding(0, 0, 12, 0);

        _gTb50Telas = new LiveGrid();
        TemaCrono.EstilizarGrade(_gTb50Telas);
        _gTb50Telas.Col("IP Conectado", 120).Col("Último Sinal", 90).Col("Navegador / WebView", 180, DataGridViewContentAlignment.MiddleLeft, true);
        var cTelas = CartaoPasso(-1, "Instâncias /tb50 Conectadas",
            new Label { Text = "Pings SSE/HTTP recebidos em :4050/api/tb50-ping" },
            _gTb50Telas,
            [BotaoPeq("Recarregar /tb50", 0, () => Seguro.Rodar(this, () => ExecutarAcaoViplexAsync("reiniciar_webview", null)))]);

        mid.Controls.Add(cProg, 0, 0);
        mid.Controls.Add(cTelas, 1, 0);

        // Linha 3: Histórico de ações
        _gTb50Historico = new LiveGrid();
        TemaCrono.EstilizarGrade(_gTb50Historico);
        _gTb50Historico.Col("Hora", 84).Col("Ação", 180, DataGridViewContentAlignment.MiddleLeft).Col("Detalhes", 320, DataGridViewContentAlignment.MiddleLeft, true);
        var cHist = CartaoPasso(-1, "Registro de Operações TB50",
            new Label { Text = "Últimos comandos enviados pelo operador" },
            _gTb50Historico,
            [BotaoPeq("Sincronizar Agora", 0, () => Seguro.Rodar(this, SincronizarTudoTb50Async))]);

        split.Controls.Add(kpis, 0, 0);
        split.Controls.Add(mid, 0, 1);
        split.Controls.Add(cHist, 0, 2);
        return split;
    }

    // =========================================================================
    // Atualização de dados, Estado e API HTTP (:4050)
    // =========================================================================

    void GarantirConfigTb50Local()
    {
        if (_tb50Cfg != null) return;
        _tb50Cfg = new JsonObject
        {
            ["layout"] = "grid-20-pos",
            ["mode"] = "ao_vivo",
            ["playbackState"] = "reproduzindo",
            ["loopPlaylist"] = true,
            ["activePlaylistIndex"] = 0,
            ["offset"] = 0,
            ["autoPage"] = false,
            ["autoPageSec"] = 8,
            ["autoPodioAoEncerrar"] = true,
            ["mostrarMilesimos"] = true,
            ["corPrimaria"] = "#00E676",
            ["corDestaque"] = "#FFB300",
            ["tituloCustom"] = "",
            ["subtituloCustom"] = "",
            ["rodapeTexto"] = "Cronometragem ao vivo · Kartódromo Internacional de Betim",
            ["climaTexto"] = "26°C · Pista Seca",
            ["qrCodeUrl"] = "https://kartodromodebetim.com.br",
            ["mostrarClima"] = false,
            ["mostrarHora"] = true,
            ["mostrarQrCode"] = false,
            ["camadas"] = new JsonObject
            {
                ["cabecalho"] = true,
                ["placar"] = true,
                ["cronometro"] = true,
                ["patrocinadores"] = true,
                ["fundo"] = true,
            },
            ["patrocinadores"] = new JsonArray
            {
                new JsonObject { ["id"] = "pat-kib", ["nome"] = "Kartódromo de Betim", ["slogan"] = "Tradição e Velocidade", ["cor"] = "#00E676", ["ativo"] = true },
                new JsonObject { ["id"] = "pat-500m", ["nome"] = "500 Milhas KIB 2026", ["slogan"] = "Endurance Oficial", ["cor"] = "#FFB300", ["ativo"] = true },
            },
            ["playlist"] = new JsonArray
            {
                new JsonObject { ["id"] = "pl-1", ["ordem"] = 1, ["nome"] = "Placar 14 Karts (Kart + Tempo ms)", ["tipo"] = "Layout Ao Vivo", ["layoutOuMidia"] = "grid-14-ms", ["duracaoSeg"] = 120, ["transicao"] = "Corte", ["ativo"] = true },
                new JsonObject { ["id"] = "pl-2", ["ordem"] = 2, ["nome"] = "Top 3 AO VIVO Horizontal", ["tipo"] = "Layout Ao Vivo", ["layoutOuMidia"] = "top3-live", ["duracaoSeg"] = 45, ["transicao"] = "Fade", ["ativo"] = true },
                new JsonObject { ["id"] = "pl-3", ["ordem"] = 3, ["nome"] = "Lista Completa LapTime", ["tipo"] = "Layout Ao Vivo", ["layoutOuMidia"] = "lista-laptime", ["duracaoSeg"] = 60, ["transicao"] = "Fade", ["ativo"] = true },
                new JsonObject { ["id"] = "pl-4", ["ordem"] = 4, ["nome"] = "Patrocinadores – Rotativo", ["tipo"] = "Patrocinadores", ["layoutOuMidia"] = "patrocinadores", ["duracaoSeg"] = 20, ["transicao"] = "Slide", ["ativo"] = true },
            },
            ["biblioteca"] = new JsonArray
            {
                new JsonObject { ["id"] = "lib-top3", ["nome"] = "Top 3 AO VIVO (Horizontal)", ["categoria"] = "Layouts", ["subtitulo"] = "P1-P3 destaque + ms", ["layoutOuMidia"] = "top3-live", ["duracaoSeg"] = 0, ["resolucao"] = "2048x512", ["cor"] = "#0B7A53", ["protegido"] = true },
                new JsonObject { ["id"] = "lib-lista", ["nome"] = "Lista Completa LapTime", ["categoria"] = "Layouts", ["subtitulo"] = "Cronômetro + Pos + Kart + ms", ["layoutOuMidia"] = "lista-laptime", ["duracaoSeg"] = 0, ["resolucao"] = "2048x512", ["cor"] = "#1565C0", ["protegido"] = true },
                new JsonObject { ["id"] = "lib-14", ["nome"] = "Placar 14 Karts (ms)", ["categoria"] = "Layouts", ["subtitulo"] = "Grade 7x2 em milésimos", ["layoutOuMidia"] = "grid-14-ms", ["duracaoSeg"] = 0, ["resolucao"] = "2048x512", ["cor"] = "#059669", ["protegido"] = true },
                new JsonObject { ["id"] = "lib-20", ["nome"] = "Placar 20 Karts (Pos)", ["categoria"] = "Layouts", ["subtitulo"] = "Grade 10x2 Posição + Kart", ["layoutOuMidia"] = "grid-20-pos", ["duracaoSeg"] = 0, ["resolucao"] = "2048x512", ["cor"] = "#2563EB", ["protegido"] = true },
                new JsonObject { ["id"] = "lib-podio", ["nome"] = "Resultado / Pódio Top 5", ["categoria"] = "Layouts", ["subtitulo"] = "Campeão + Top 5", ["layoutOuMidia"] = "podio-final", ["duracaoSeg"] = 0, ["resolucao"] = "2048x512", ["cor"] = "#D97706", ["protegido"] = true },
                new JsonObject { ["id"] = "lib-pat", ["nome"] = "Patrocinadores & Banner", ["categoria"] = "Patrocinadores", ["subtitulo"] = "Marcas em destaque", ["layoutOuMidia"] = "patrocinadores", ["duracaoSeg"] = 20, ["resolucao"] = "2048x512", ["cor"] = "#7C3AED", ["protegido"] = true },
                new JsonObject { ["id"] = "lib-vp-crono", ["nome"] = "ViPlex: CRONOMETRAGEM", ["categoria"] = "Programas ViPlex", ["subtitulo"] = "Programa HTML /tb50", ["layoutOuMidia"] = "viplex:CRONOMETRAGEM", ["duracaoSeg"] = 0, ["resolucao"] = "2048x512", ["cor"] = "#0B7A53", ["protegido"] = true },
            },
            ["agendamentos"] = new JsonArray(),
            ["hardware"] = new JsonObject
            {
                ["host"] = "192.168.20.253",
                ["port"] = 16674,
                ["serial"] = "25212A000010665",
                ["username"] = "admin",
                ["brilho"] = 85,
                ["volume"] = 70,
                ["programaPadrao"] = "CRONOMETRAGEM",
            },
        };
    }

    internal void AoEntrarAbaPainelTb50()
    {
        if (!_tb50Construida) return;
        AtualizarStatusPingTb50DoState();
        AtualizarTodasVistasTb50();
        if ((DateTime.Now - _tb50UltimoSync).TotalSeconds > 3)
            _ = CarregarConfigTb50Async();
    }

    internal void AtualizarPreviewTb50AoVivo()
    {
        if (!_tb50Construida || _abas.SelectedIndex != 5) return;
        AtualizarStatusPingTb50DoState();
        _tb50Canvas?.Invalidate();
        if (_tb50TemplateCanvas is { IsDisposed: false, Visible: true })
            _tb50TemplateCanvas.Invalidate();
    }

    void AtualizarStatusPingTb50DoState()
    {
        if (_state?["tb50"] is not JsonObject tb) return;
        var telas = Crono.Arr(tb, "telas");
        var online = telas.Any(t => t.L("ultimoSinalMs") is long ms && ms < 75000);
        var minMs = telas.Select(t => t.L("ultimoSinalMs")).Where(m => m.HasValue).Select(m => m.Value).DefaultIfEmpty(-1).Min();
        var ip = (_tb50Cfg?["hardware"] as JsonObject)?.S("host");
        if (string.IsNullOrEmpty(ip)) ip = "192.168.20.253";

        var txtBadge = online ? $"● TB50 Online · {ip} · 2048×512" : $"● Aguardando TB50 · {ip}";
        if (_tb50StatusBadge != null && _tb50StatusBadge.Text != txtBadge)
        {
            _tb50StatusBadge.Text = txtBadge;
            _tb50StatusBadge.BackColor = online ? Tokens.VerdeSuave : Color.FromArgb(255, 244, 229);
            _tb50StatusBadge.ForeColor = online ? TemaCrono.Verde : Tokens.Claro.CorEstadoAvisoTexto;
        }
        var txtPing = online && minMs >= 0 ? $"● Conectado ({minMs / 1000.0:0.0}s)" : "● Offline / Sem Ping";
        if (_tb50PingEditor != null && _tb50PingEditor.Text != txtPing)
        {
            _tb50PingEditor.Text = txtPing;
            _tb50PingEditor.BackColor = online ? Tokens.VerdeSuave : Color.FromArgb(255, 232, 230);
            _tb50PingEditor.ForeColor = online ? TemaCrono.Verde : TemaCrono.Vermelho;
        }
        if (_tb50KpiEstado != null)
        {
            _tb50KpiEstado.Text = online ? "Online (SSE Ativo)" : "Sem sinal recente";
            _tb50KpiEstado.ForeColor = online ? TemaCrono.Verde : TemaCrono.Vermelho;
            _tb50KpiPing.Text = minMs >= 0 ? $"{minMs} ms" : "—";
            _tb50KpiModo.Text = $"{_tb50Cfg.S("layout")} · {_tb50Cfg.S("mode")}";
            _tb50KpiPrograma.Text = $"{ip}:{((_tb50Cfg?["hardware"] as JsonObject)?.I("port") is int p && p > 0 ? p : 16674)}";
        }
        if (_gTb50Telas is { IsDisposed: false } && _gTb50Telas.Columns.Count > 0 &&
            (_gTb50Telas.Rows.Count == 0 || (DateTime.Now - _tb50UltimoGridTelas).TotalSeconds >= 2))
        {
            _tb50UltimoGridTelas = DateTime.Now;
            _gTb50Telas.Preencher(
                telas.Select(t => new object[] { t.S("ip"), $"{t.L("ultimoSinalMs") ?? 0} ms", t.S("navegador") }).ToList(),
                telas.Cast<object>().ToList());
        }
    }

    async Task ListarProgramasViplexAsync()
    {
        var resp = await Crono.Api.PostAsync("/api/tb50-viplex", new JsonObject { ["acao"] = "listar_programas" });
        if (resp is JsonObject obj)
        {
            _tb50ViplexProgramas = Crono.Arr(obj, "programas");
            if (_gTb50Viplex is { IsDisposed: false } && _gTb50Viplex.Columns.Count > 0)
            {
                _gTb50Viplex.Preencher(
                    _tb50ViplexProgramas.Select(p => new object[]
                    {
                        p.S("name"),
                        $"{p.I("width")}×{p.I("height")}",
                        p.I("statusCode") == 1 ? "Em execução" : "Disponível",
                        p.S("identifier"),
                    }).ToList(),
                    _tb50ViplexProgramas.Cast<object>().ToList());
            }
            RegistrarHistoricoTb50("Listar ViPlex", $"{_tb50ViplexProgramas.Count} programa(s) lido(s) da TB50.");
        }
    }

    async Task CarregarConfigTb50Async()
    {
        if (_tb50Carregando) return;
        _tb50Carregando = true;
        try
        {
            var resp = await Crono.Api.GetAsync("/api/tb50-config");
            if (resp is JsonObject obj && obj["config"] is JsonObject cfg)
            {
                _tb50Cfg = cfg;
                _tb50Status = obj["status"] as JsonObject;
                _tb50UltimoSync = DateTime.Now;
                AtualizarTodasVistasTb50();
            }
        }
        catch
        {
            // Mantém estado local se servidor offline momentaneamente
        }
        finally
        {
            _tb50Carregando = false;
        }
    }

    async Task SincronizarTudoTb50Async()
    {
        await CarregarConfigTb50Async();
        try
        {
            await ListarProgramasViplexAsync();
        }
        catch (Exception ex)
        {
            RegistrarHistoricoTb50("Aviso ViPlex", ex.Message);
        }
        AtualizarTodasVistasTb50();
        RegistrarHistoricoTb50("Sincronização", "Configuração e telemetria carregadas do servidor.");
    }

    async Task SalvarConfigTb50Async()
    {
        GarantirConfigTb50Local();
        var payload = _tb50Cfg.DeepClone().AsObject();
        payload["origem"] = $"crono-ui:{Environment.MachineName}";
        var resp = await Crono.Api.PutAsync("/api/tb50-config", payload);
        if (resp is JsonObject obj && obj["config"] is JsonObject salvo)
            _tb50Cfg = salvo;
        _tb50UltimoSync = DateTime.Now;
        AtualizarTodasVistasTb50();
    }

    async Task TransmitirAgoraTb50Async()
    {
        LerPropriedadesDaUi();
        await SalvarConfigTb50Async();
        RegistrarHistoricoTb50("Transmitir Agora", $"Layout '{_tb50Cfg.S("layout")}' ({_tb50Cfg.S("mode")}) publicado na TB50.");
        Msg.Info(this, $"Painel de LED atualizado em tempo real!\nLayout: {NomeTemplate(_tb50Cfg.S("layout"))} · Modo: {_tb50Cfg.S("mode")}.", "Painel TB50");
    }

    async Task ExecutarAcaoViplexAsync(string acao, string nome = null, string identifier = null)
    {
        var payload = new JsonObject { ["acao"] = acao };
        if (!string.IsNullOrWhiteSpace(nome)) payload["nome"] = nome;
        if (!string.IsNullOrWhiteSpace(identifier)) payload["identifier"] = identifier;
        if (!string.IsNullOrWhiteSpace(_tb50HwSenha?.Text)) payload["password"] = _tb50HwSenha.Text;

        var resp = await Crono.Api.PostAsync("/api/tb50-viplex", payload);
        var alvo = !string.IsNullOrWhiteSpace(nome) ? nome : (!string.IsNullOrWhiteSpace(identifier) ? identifier : acao);
        RegistrarHistoricoTb50("ViPlex TB50", $"{acao}: {alvo}");
        if (resp is JsonObject obj && obj.B("ok"))
        {
            if (acao != "reiniciar_webview")
            {
                try { await ListarProgramasViplexAsync(); } catch { }
            }
            var resumo = acao switch
            {
                "reiniciar_webview" => "Sinal de recarga instantânea enviado para /tb50 na controladora.",
                "parar" => $"Execução interrompida na TB50 ({alvo}).",
                _ => $"Comando ViPlex '{acao}' executado para '{alvo}'.",
            };
            Msg.Info(this, resumo, "NovaStar TB50");
        }
    }

    async Task SalvarHardwareTb50Async()
    {
        GarantirConfigTb50Local();
        var hw = (_tb50Cfg["hardware"] as JsonObject) ?? new JsonObject();
        hw["host"] = (_tb50HwHost?.Text ?? "").Trim() is { Length: > 0 } h ? h : "192.168.20.253";
        hw["port"] = int.TryParse(_tb50HwPort?.Text, out var pt) && pt > 0 && pt <= 65535 ? pt : 16674;
        hw["serial"] = (_tb50HwSerial?.Text ?? "").Trim();
        hw["username"] = (_tb50HwUser?.Text ?? "").Trim() is { Length: > 0 } u ? u : "admin";
        hw["programaPadrao"] = (_tb50HwProgPadrao?.Text ?? "").Trim() is { Length: > 0 } pr ? pr : "CRONOMETRAGEM";
        hw["brilho"] = int.TryParse(_tb50HwBrilho?.Text, out var br) ? Math.Clamp(br, 5, 100) : 85;
        hw["volume"] = int.TryParse(_tb50HwVolume?.Text, out var vl) ? Math.Clamp(vl, 0, 100) : 0;
        if (!string.IsNullOrEmpty(_tb50HwSenha?.Text))
        {
            hw["viplexPassword"] = _tb50HwSenha.Text;
            _tb50HwSenha.Text = "";
        }
        _tb50Cfg["hardware"] = hw;
        await SalvarConfigTb50Async();
        RegistrarHistoricoTb50("Hardware TB50", $"Parâmetros salvos ({hw.S("host")}:{hw.I("port")} · Brilho {hw.I("brilho")}%).");
        Msg.Info(this, "Parâmetros de hardware da NovaStar TB50 salvos com sucesso.", "Hardware TB50");
    }

    void RegistrarHistoricoTb50(string acao, string detalhe)
    {
        _tb50Historico.Insert(0, (DateTime.Now.ToString("HH:mm:ss"), acao, detalhe));
        if (_tb50Historico.Count > 50) _tb50Historico.RemoveAt(_tb50Historico.Count - 1);
        if (_gTb50Historico is { IsDisposed: false } && _gTb50Historico.Columns.Count > 0)
            _gTb50Historico.Preencher(_tb50Historico.Select(x => new object[] { x.hora, x.acao, x.detalhe }).ToList());
    }

    // =========================================================================
    // Sincronização dos Controles Visuais C# com _tb50Cfg
    // =========================================================================

    void AtualizarTodasVistasTb50()
    {
        if (!_tb50Construida || _tb50Cfg == null) return;
        _tb50AplicandoUi = true;
        try
        {
            PopularBibliotecaTb50();
            PopularCamadasTb50();
            PopularTemplatesTb50();
            PopularPlaylistTb50();
            PopularAgendaPatrocinadoresTb50();
            PreencherPropriedadesNaUi();
            AtualizarBotoesEstadoTb50();
            AtualizarStatusPingTb50DoState();
            if (_tb50LayoutResumoNome != null)
            {
                _tb50LayoutResumoNome.Text = NomeTemplate(_tb50Cfg.S("layout"));
                _tb50LayoutResumoMeta.Text = $"2048 × 512 · {_tb50Cfg.S("mode")} {(_tb50Cfg.B("mostrarMilesimos") ? "(.000)" : "")}";
                _tb50MiniPreview?.Invalidate();
            }
            _tb50Canvas?.Invalidate();
        }
        finally
        {
            _tb50AplicandoUi = false;
        }
    }

    void AtualizarBotoesEstadoTb50()
    {
        var modo = _tb50Cfg.S("mode");
        var pb = _tb50Cfg.S("playbackState");
        var loop = _tb50Cfg.B("loopPlaylist");
        var off = _tb50Cfg.I("offset");
        var autoPag = _tb50Cfg.B("autoPage");

        void EstiloBtn(Button b, bool ativo, Color corAtivo)
        {
            if (b == null) return;
            b.BackColor = ativo ? corAtivo : Color.FromArgb(232, 232, 237);
            b.ForeColor = ativo ? Tokens.Primitivo.Branco : TemaCrono.Texto;
            b.Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoLegenda, ativo ? FontStyle.Bold : FontStyle.Regular);
        }

        EstiloBtn(_btnTb50Play, pb == "reproduzindo", TemaCrono.Verde);
        EstiloBtn(_btnTb50Pause, pb == "pausado", Tokens.Claro.CorEstadoAvisoSolido);
        EstiloBtn(_btnTb50Stop, pb == "parado", TemaCrono.Vermelho);
        EstiloBtn(_btnTb50Loop, loop, Tokens.Claro.CorTextoPrincipal);

        EstiloBtn(_btnTb50ModoAoVivo, modo == "ao_vivo", TemaCrono.Verde);
        EstiloBtn(_btnTb50ModoPlaylist, modo == "playlist", TemaCrono.Verde);
        EstiloBtn(_btnTb50ModoManual, modo == "manual", TemaCrono.Verde);

        EstiloBtn(_btnTb50Pag1, !autoPag && off == 0, TemaCrono.Azul);
        EstiloBtn(_btnTb50Pag2, !autoPag && off > 0, TemaCrono.Azul);
        EstiloBtn(_btnTb50PagAuto, autoPag, TemaCrono.Azul);
    }

    void PreencherPropriedadesNaUi()
    {
        if (_tb50PropTitulo == null) return;
        _tb50PropTitulo.Text = _tb50Cfg.S("tituloCustom");
        _tb50PropSubtitulo.Text = _tb50Cfg.S("subtituloCustom");
        _tb50PropRodape.Text = _tb50Cfg.S("rodapeTexto");
        _tb50PropClima.Text = _tb50Cfg.S("climaTexto");
        _tb50PropQr.Text = _tb50Cfg.S("qrCodeUrl");
        _tb50PropCorPri.Text = _tb50Cfg.S("corPrimaria") is { Length: > 0 } cp ? cp : "#00E676";
        _tb50PropCorDest.Text = _tb50Cfg.S("corDestaque") is { Length: > 0 } cd ? cd : "#FFB300";
        _tb50PropAutoPagSeg.Text = (_tb50Cfg.I("autoPageSec") > 0 ? _tb50Cfg.I("autoPageSec") : 8).ToString();

        _tb50ChkMilesimos.Checked = _tb50Cfg["mostrarMilesimos"] == null || _tb50Cfg.B("mostrarMilesimos");
        _tb50ChkPodioAuto.Checked = _tb50Cfg["autoPodioAoEncerrar"] == null || _tb50Cfg.B("autoPodioAoEncerrar");
        _tb50ChkAutoPag.Checked = _tb50Cfg.B("autoPage");
        _tb50ChkClima.Checked = _tb50Cfg.B("mostrarClima");
        _tb50ChkHora.Checked = _tb50Cfg["mostrarHora"] == null || _tb50Cfg.B("mostrarHora");
        _tb50ChkQr.Checked = _tb50Cfg.B("mostrarQrCode");
    }

    void LerPropriedadesDaUi()
    {
        if (_tb50PropTitulo == null || _tb50Cfg == null) return;
        _tb50Cfg["tituloCustom"] = _tb50PropTitulo.Text.Trim();
        _tb50Cfg["subtituloCustom"] = _tb50PropSubtitulo.Text.Trim();
        _tb50Cfg["rodapeTexto"] = _tb50PropRodape.Text.Trim();
        _tb50Cfg["climaTexto"] = _tb50PropClima.Text.Trim();
        _tb50Cfg["qrCodeUrl"] = _tb50PropQr.Text.Trim();
        if (_tb50PropCorPri.Text.Trim() is { Length: 7 } cp && cp.StartsWith('#')) _tb50Cfg["corPrimaria"] = cp;
        if (_tb50PropCorDest.Text.Trim() is { Length: 7 } cd && cd.StartsWith('#')) _tb50Cfg["corDestaque"] = cd;
        _tb50Cfg["autoPageSec"] = int.TryParse(_tb50PropAutoPagSeg.Text, out var seg) ? Math.Clamp(seg, 3, 60) : 8;
        _tb50Cfg["mostrarMilesimos"] = _tb50ChkMilesimos.Checked;
        _tb50Cfg["autoPodioAoEncerrar"] = _tb50ChkPodioAuto.Checked;
        _tb50Cfg["autoPage"] = _tb50ChkAutoPag.Checked;
        _tb50Cfg["mostrarClima"] = _tb50ChkClima.Checked;
        _tb50Cfg["mostrarHora"] = _tb50ChkHora.Checked;
        _tb50Cfg["mostrarQrCode"] = _tb50ChkQr.Checked;
    }

    void PopularBibliotecaTb50()
    {
        var itens = Crono.Arr(_tb50Cfg, "biblioteca");
        if (_gTb50Conteudo?.Columns.Count > 0)
        {
            _gTb50Conteudo.Preencher(
                itens.Select(i => new object[] { i.S("nome"), i.S("categoria"), i.S("subtitulo"), i.S("resolucao"), i.I("duracaoSeg") > 0 ? $"{i.I("duracaoSeg")}s" : "Ao Vivo" }).ToList(),
                itens.Cast<object>().ToList());
        }
        if (_tb50BibliotecaFlow == null) return;
        var cat = _tb50CatLista?.SelectedItem?.ToString() ?? "Todos";
        var q = (_tb50BuscaTxt?.Text ?? "").Trim().ToLowerInvariant();
        var filtrados = itens.Where(i =>
            (cat == "Todos" || i.S("categoria") == cat) &&
            (q.Length == 0 || i.S("nome").ToLowerInvariant().Contains(q) || i.S("subtitulo").ToLowerInvariant().Contains(q))).ToList();

        _tb50BibliotecaFlow.SuspendLayout();
        _tb50BibliotecaFlow.Controls.Clear();
        var larguraCard = Math.Max(105, (_tb50BibliotecaFlow.ClientSize.Width - 18) / 2);
        foreach (var item in filtrados)
        {
            var obj = item;
            var card = new Panel
            {
                Size = new Size(larguraCard, 92),
                Margin = new Padding(0, 0, 6, 6),
                BackColor = Color.FromArgb(248, 249, 251),
                Cursor = Cursors.Hand,
            };
            card.Paint += (_, e) =>
            {
                var g = e.Graphics;
                g.SmoothingMode = SmoothingMode.AntiAlias;
                var cor = ParseCorHex(obj.S("cor"), TemaCrono.Verde);
                var topoR = new Rectangle(6, 6, card.Width - 12, 42);
                using (var br = new LinearGradientBrush(topoR, Color.FromArgb(24, 30, 34), Color.FromArgb(12, 16, 18), 45f))
                using (var p = Forma.Redondo(topoR, 6))
                    g.FillPath(br, p);
                using (var bar = new SolidBrush(cor))
                    g.FillRectangle(bar, 12, 14, 4, 26);
                TextRenderer.DrawText(g, obj.S("categoria").ToUpperInvariant(), Tokens.Fonte(8.5f, FontStyle.Bold), new Rectangle(22, 12, topoR.Width - 20, 16), cor, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
                TextRenderer.DrawText(g, obj.I("duracaoSeg") > 0 ? $"{obj.I("duracaoSeg")}s" : "2048×512", Tokens.Fonte(8.5f), new Rectangle(22, 28, topoR.Width - 20, 16), Tokens.Primitivo.Cinza300, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);

                TextRenderer.DrawText(g, obj.S("nome"), Tokens.FonteSemibold(Tokens.Claro.FonteTamanhoLegenda), new Rectangle(6, 52, card.Width - 12, 20), TemaCrono.Texto, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
                TextRenderer.DrawText(g, obj.S("subtitulo"), Tokens.Fonte(9.5f), new Rectangle(6, 70, card.Width - 12, 16), TemaCrono.Secundario, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);

                using var borda = new Pen(Color.FromArgb(228, 228, 232));
                using var pr = Forma.Redondo(new Rectangle(0, 0, card.Width - 1, card.Height - 1), 8);
                g.DrawPath(borda, pr);
            };
            card.Click += (_, _) => UsarItemBiblioteca(obj);
            card.DoubleClick += (_, _) => AdicionarBibliotecaNaPlaylist(obj);
            _tb50BibliotecaFlow.Controls.Add(card);
        }
        _tb50BibliotecaFlow.ResumeLayout();
    }

    void PopularCamadasTb50()
    {
        if (_tb50CamadasFlow == null) return;
        var camadas = (_tb50Cfg?["camadas"] as JsonObject) ?? new JsonObject();
        var lista = new (string chave, string rotulo)[]
        {
            ("cabecalho", "Cabeçalho (Logo + Título)"),
            ("placar", "Placar Principal / Karts"),
            ("cronometro", "Cronômetro Oficial"),
            ("patrocinadores", "Faixa de Patrocinadores"),
            ("fundo", "Fundo (Gradiente / Mídia)"),
        };

        _tb50CamadasFlow.SuspendLayout();
        _tb50CamadasFlow.Controls.Clear();
        foreach (var (chave, rotulo) in lista)
        {
            var sel = _tb50CamadaSel == chave;
            var row = new Panel
            {
                Size = new Size(Math.Max(240, _tb50CamadasFlow.ClientSize.Width - 6), 26),
                Margin = new Padding(0, 0, 0, 3),
                BackColor = sel ? Tokens.VerdeSuave : Color.FromArgb(248, 248, 250),
                Cursor = Cursors.Hand,
            };
            Forma.AplicarRaio(row, 6);
            var ck = new CheckBox
            {
                Text = rotulo,
                Checked = camadas[chave] == null || camadas.B(chave),
                Location = new Point(6, 3),
                AutoSize = true,
                Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoLegenda, sel ? FontStyle.Bold : FontStyle.Regular),
                ForeColor = TemaCrono.Texto,
                BackColor = row.BackColor,
            };
            Forma.CheckVerde(ck);
            ck.CheckedChanged += (_, _) =>
            {
                if (_tb50AplicandoUi) return;
                camadas[chave] = ck.Checked;
                _tb50Cfg["camadas"] = camadas;
                _tb50Canvas?.Invalidate();
                _ = SalvarConfigTb50Async();
            };
            row.Click += (_, _) => { _tb50CamadaSel = chave; PopularCamadasTb50(); _tb50Canvas?.Invalidate(); };
            row.Controls.Add(ck);
            _tb50CamadasFlow.Controls.Add(row);
        }
        _tb50CamadasFlow.ResumeLayout();
    }

    void PopularTemplatesTb50()
    {
        if (_tb50TemplatesFlow == null) return;
        _tb50TemplatesFlow.SuspendLayout();
        _tb50TemplatesFlow.Controls.Clear();
        var w = Math.Max(120, (_tb50TemplatesFlow.ClientSize.Width - 16) / 2);
        foreach (var tpl in TemplatesTb50)
        {
            var id = tpl.id;
            var card = CriarMiniCardTemplate(id, tpl.nome, tpl.sub, tpl.cor, w, 74, () =>
            {
                _tb50Cfg["layout"] = id;
                _tb50Cfg["mode"] = id == "patrocinadores" ? "manual" : "ao_vivo";
                AtualizarTodasVistasTb50();
                _ = SalvarConfigTb50Async();
                RegistrarHistoricoTb50("Template aplicado", tpl.nome);
            });
            _tb50TemplatesFlow.Controls.Add(card);
        }
        _tb50TemplatesFlow.ResumeLayout();
    }

    Panel CriarMiniCardTemplate(string id, string nome, string sub, string corHex, int largura, int altura, Action onClick)
    {
        var ativo = _tb50Cfg.S("layout") == id;
        var card = new Panel
        {
            Size = new Size(largura, altura),
            Margin = new Padding(0, 0, 6, 6),
            BackColor = ativo ? Tokens.VerdeSuave : Color.FromArgb(248, 249, 251),
            Cursor = Cursors.Hand,
        };
        card.Paint += (_, e) =>
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            var rMini = new Rectangle(6, 6, card.Width - 12, Math.Max(32, altura - 34));
            DesenharMiniTemplate(g, rMini, id, ativo);
            TextRenderer.DrawText(g, nome, Tokens.FonteSemibold(Tokens.Claro.FonteTamanhoLegenda), new Rectangle(6, rMini.Bottom + 3, card.Width - 12, 18), ativo ? TemaCrono.Verde : TemaCrono.Texto, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
            if (altura > 95)
                TextRenderer.DrawText(g, sub, Tokens.Fonte(9.5f), new Rectangle(6, rMini.Bottom + 20, card.Width - 12, 16), TemaCrono.Secundario, TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
            using var pen = new Pen(ativo ? TemaCrono.Verde : Color.FromArgb(224, 224, 229), ativo ? 2f : 1f);
            using var pr = Forma.Redondo(new Rectangle(1, 1, card.Width - 3, card.Height - 3), 8);
            g.DrawPath(pen, pr);
        };
        card.Click += (_, _) => onClick();
        return card;
    }

    void DesenharMiniTemplate(Graphics g, Rectangle r, string layoutId, bool destaque)
    {
        g.SmoothingMode = SmoothingMode.AntiAlias;
        using (var bg = new SolidBrush(Color.FromArgb(14, 18, 20)))
        using (var p = Forma.Redondo(r, 5))
            g.FillPath(bg, p);

        using var fMini = Tokens.Fonte(8f, FontStyle.Bold);
        using var bVerde = new SolidBrush(Color.FromArgb(0, 230, 118));
        using var bOuro = new SolidBrush(Color.FromArgb(255, 179, 0));
        using var bAzul = new SolidBrush(Color.FromArgb(37, 99, 235));

        if (layoutId == "top3-live")
        {
            var cw = (r.Width - 16) / 3;
            for (var i = 0; i < 3; i++)
            {
                var cr = new Rectangle(r.X + 4 + i * (cw + 4), r.Y + 6, cw, r.Height - 12);
                g.FillRectangle(i == 0 ? bOuro : bVerde, cr.X, cr.Y, 6, cr.Height);
                TextRenderer.DrawText(g, $"P{i + 1}", fMini, cr, Tokens.Primitivo.Branco, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
            }
        }
        else if (layoutId == "lista-laptime")
        {
            g.FillRectangle(bVerde, r.X + 4, r.Y + 4, 26, r.Height - 8);
            for (var y = 0; y < 4; y++)
            {
                g.FillRectangle(bAzul, r.X + 34, r.Y + 5 + y * 7, 10, 5);
                g.FillRectangle(Brushes.Gray, r.X + 46, r.Y + 5 + y * 7, r.Width - 52, 4);
            }
        }
        else if (layoutId == "grid-20-pos")
        {
            var cw = (r.Width - 12) / 10f;
            var ch = (r.Height - 8) / 2f;
            for (var lin = 0; lin < 2; lin++)
                for (var col = 0; col < 10; col++)
                    g.DrawRectangle(Pens.DimGray, r.X + 4 + col * cw, r.Y + 4 + lin * ch, cw - 1, ch - 1);
        }
        else if (layoutId == "podio-final")
        {
            TextRenderer.DrawText(g, "★ RESULTADO PÓDIO ★", fMini, r, Color.FromArgb(255, 196, 0), TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }
        else if (layoutId == "patrocinadores")
        {
            TextRenderer.DrawText(g, "PATROCINADORES", fMini, r, Color.FromArgb(192, 132, 252), TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }
        else // grid-14-ms
        {
            var cw = (r.Width - 10) / 7f;
            var ch = (r.Height - 8) / 2f;
            for (var lin = 0; lin < 2; lin++)
                for (var col = 0; col < 7; col++)
                {
                    var rx = r.X + 4 + col * cw;
                    var ry = r.Y + 4 + lin * ch;
                    g.DrawRectangle(Pens.DimGray, rx, ry, cw - 1, ch - 1);
                    g.FillRectangle(lin == 0 && col == 0 ? bOuro : bVerde, rx + 2, ry + 3, cw - 5, 4);
                }
        }
    }

    void PopularPlaylistTb50()
    {
        var itens = Crono.Arr(_tb50Cfg, "playlist");
        var totalSeg = itens.Where(i => i.B("ativo")).Sum(i => Math.Max(0, i.I("duracaoSeg")));
        if (_tb50TotalPlaylist != null)
            _tb50TotalPlaylist.Text = $"Duração total: {TimeSpan.FromSeconds(totalSeg):mm\\:ss}";

        var rows = itens.Select((it, idx) => new object[]
        {
            (idx + 1).ToString(),
            it.S("nome"),
            it.S("tipo"),
            TimeSpan.FromSeconds(Math.Max(1, it.I("duracaoSeg"))).ToString(@"mm\:ss"),
            it.S("transicao"),
            it.B("ativo") ? "Ativo" : "Oculto",
        }).ToList();
        var keys = itens.Cast<object>().ToList();
        if (_gTb50Playlist is { IsDisposed: false } && _gTb50Playlist.Columns.Count > 0) _gTb50Playlist.Preencher(rows, keys);
        if (_gTb50PlaylistSub is { IsDisposed: false } && _gTb50PlaylistSub.Columns.Count > 0) _gTb50PlaylistSub.Preencher(rows, keys);
    }

    void PopularAgendaPatrocinadoresTb50()
    {
        if (_gTb50Agenda is { IsDisposed: false } && _gTb50Agenda.Columns.Count > 0)
        {
            var ag = Crono.Arr(_tb50Cfg, "agendamentos");
            _gTb50Agenda.Preencher(
                ag.Select(a => new object[] { a.S("horario"), a.S("diasSemana"), a.S("nome"), a.S("acao"), a.S("destino"), a.B("ativo") ? "Ativo" : "Inativo" }).ToList(),
                ag.Cast<object>().ToList());
        }
        if (_gTb50Patrocinadores is { IsDisposed: false } && _gTb50Patrocinadores.Columns.Count > 0)
        {
            var pats = Crono.Arr(_tb50Cfg, "patrocinadores");
            _gTb50Patrocinadores.Preencher(
                pats.Select(p => new object[] { p.S("nome"), p.S("slogan"), p.S("cor"), p.B("ativo") ? "Ativo" : "Oculto" }).ToList(),
                pats.Cast<object>().ToList());
        }
        if (_gTb50Viplex is { IsDisposed: false } && _gTb50Viplex.Columns.Count > 0 && _tb50ViplexProgramas.Count > 0)
        {
            _gTb50Viplex.Preencher(
                _tb50ViplexProgramas.Select(p => new object[] { p.S("name"), $"{p.I("width")}×{p.I("height")}", p.I("statusCode") == 1 ? "Em execução" : "Disponível", p.S("identifier") }).ToList(),
                _tb50ViplexProgramas.Cast<object>().ToList());
        }
        if (_gTb50Historico is { IsDisposed: false } && _gTb50Historico.Columns.Count > 0)
        {
            _gTb50Historico.Preencher(_tb50Historico.Select(x => new object[] { x.hora, x.acao, x.detalhe }).ToList());
        }
    }

    // =========================================================================
    // Ações do Usuário: Mídia, Widgets, Playlist, Playback, Agenda, Patrocinadores
    // =========================================================================

    void UsarItemBiblioteca(JsonObject item)
    {
        var dest = item.S("layoutOuMidia");
        var mediaUrl = item.S("mediaUrl");
        if (dest.StartsWith("viplex:", StringComparison.OrdinalIgnoreCase))
        {
            var prog = dest[7..];
            Seguro.Rodar(this, () => ExecutarAcaoViplexAsync("ativar_programa", prog));
            return;
        }
        if (!string.IsNullOrEmpty(mediaUrl))
        {
            _tb50Cfg["layout"] = "patrocinadores";
            _tb50Cfg["mediaAtivaUrl"] = mediaUrl;
            _tb50Cfg["mediaAtivaNome"] = item.S("nome");
            _tb50Cfg["mode"] = "manual";
        }
        else if (!string.IsNullOrEmpty(dest))
        {
            _tb50Cfg["layout"] = dest;
            _tb50Cfg["mediaAtivaUrl"] = "";
            _tb50Cfg["mode"] = dest == "patrocinadores" ? "manual" : "ao_vivo";
        }
        AtualizarTodasVistasTb50();
        _ = SalvarConfigTb50Async();
        RegistrarHistoricoTb50("Aplicado", item.S("nome"));
    }

    void AdicionarBibliotecaNaPlaylist(JsonObject item)
    {
        var arr = (_tb50Cfg?["playlist"] as JsonArray) ?? new JsonArray();
        arr.Add(new JsonObject
        {
            ["id"] = $"pl-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
            ["ordem"] = arr.Count + 1,
            ["nome"] = item.S("nome"),
            ["tipo"] = item.S("categoria"),
            ["layoutOuMidia"] = item.S("layoutOuMidia") is { Length: > 0 } lm ? lm : "patrocinadores",
            ["mediaUrl"] = item.S("mediaUrl"),
            ["duracaoSeg"] = item.I("duracaoSeg") > 0 ? item.I("duracaoSeg") : 20,
            ["transicao"] = "Fade",
            ["ativo"] = true,
        });
        _tb50Cfg["playlist"] = arr;
        AtualizarTodasVistasTb50();
        _ = SalvarConfigTb50Async();
        RegistrarHistoricoTb50("+ Playlist", item.S("nome"));
    }

    void ExecutarWidgetToolbarTb50(string widget)
    {
        switch (widget)
        {
            case "Texto":
                _tb50DirSeg.Selecionado = 1;
                _tb50PropTitulo?.Focus();
                break;
            case "Imagem":
            case "Vídeo":
                AbrirDialogoAdicionarMidia();
                break;
            case "Patrocinador":
                _tb50SubSeg.Selecionado = 5;
                break;
            case "Placar":
            case "Ranking":
                _tb50Cfg["layout"] = _tb50Cfg.S("layout") == "grid-14-ms" ? "top3-live" : "grid-14-ms";
                _tb50Cfg["mode"] = "ao_vivo";
                AtualizarTodasVistasTb50();
                _ = SalvarConfigTb50Async();
                break;
            case "Cronômetro":
                var camadas = (_tb50Cfg?["camadas"] as JsonObject) ?? new JsonObject();
                camadas["cronometro"] = !(camadas.B("cronometro"));
                _tb50Cfg["camadas"] = camadas;
                if (camadas.B("cronometro") && _tb50Cfg.S("layout") is "grid-14-ms" or "grid-20-pos")
                    _tb50Cfg["layout"] = "lista-laptime";
                AtualizarTodasVistasTb50();
                _ = SalvarConfigTb50Async();
                break;
            case "Temporizador":
                _tb50SubSeg.Selecionado = 3;
                break;
            case "Clima":
                _tb50Cfg["mostrarClima"] = !_tb50Cfg.B("mostrarClima");
                AtualizarTodasVistasTb50();
                _ = SalvarConfigTb50Async();
                break;
            case "QR Code":
                _tb50Cfg["mostrarQrCode"] = !_tb50Cfg.B("mostrarQrCode");
                AtualizarTodasVistasTb50();
                _ = SalvarConfigTb50Async();
                break;
            case "Hora/Data":
                _tb50Cfg["mostrarHora"] = !_tb50Cfg.B("mostrarHora");
                AtualizarTodasVistasTb50();
                _ = SalvarConfigTb50Async();
                break;
            case "Forma":
            case "Animação":
                var cores = new[] { "#00E676", "#38BDF8", "#F97316", "#A855F7" };
                var idx = Array.IndexOf(cores, _tb50Cfg.S("corPrimaria"));
                _tb50Cfg["corPrimaria"] = cores[(idx + 1) % cores.Length];
                AtualizarTodasVistasTb50();
                _ = SalvarConfigTb50Async();
                break;
        }
    }

    void DefinirPlaybackTb50(string estado)
    {
        _tb50Cfg["playbackState"] = estado;
        if (estado == "reproduzindo" && _tb50Cfg.S("mode") == "manual")
            _tb50Cfg["mode"] = "playlist";
        AtualizarTodasVistasTb50();
        _ = SalvarConfigTb50Async();
        RegistrarHistoricoTb50("Exibição", estado);
    }

    void DefinirModoTb50(string modo)
    {
        _tb50Cfg["mode"] = modo;
        AtualizarTodasVistasTb50();
        _ = SalvarConfigTb50Async();
        RegistrarHistoricoTb50("Modo", modo);
    }

    void DefinirPaginacaoTb50(int offset, bool auto)
    {
        _tb50Cfg["autoPage"] = auto;
        _tb50Cfg["offset"] = offset;
        AtualizarTodasVistasTb50();
        _ = SalvarConfigTb50Async();
        _ = Crono.Api.PostAsync("/api/tb50-page", new JsonObject { ["offset"] = offset, ["origem"] = "painel-tb50" });
    }

    void AlternarLoopTb50()
    {
        _tb50Cfg["loopPlaylist"] = !_tb50Cfg.B("loopPlaylist");
        AtualizarTodasVistasTb50();
        _ = SalvarConfigTb50Async();
    }

    void NavegarPlaylistTb50(int delta)
    {
        var itens = Crono.Arr(_tb50Cfg, "playlist").Where(i => i.B("ativo")).ToList();
        if (itens.Count == 0) return;
        var idx = (_tb50Cfg.I("activePlaylistIndex") + delta + itens.Count) % itens.Count;
        _tb50Cfg["activePlaylistIndex"] = idx;
        var alvo = itens[idx];
        _tb50Cfg["layout"] = alvo.S("layoutOuMidia");
        _tb50Cfg["mediaAtivaUrl"] = alvo.S("mediaUrl");
        AtualizarTodasVistasTb50();
        _ = SalvarConfigTb50Async();
    }

    void AtivarItemPlaylistSelecionado()
    {
        if (_gTb50Playlist.ChaveAtual is not JsonObject item) return;
        _tb50Cfg["layout"] = item.S("layoutOuMidia") is { Length: > 0 } lm ? lm : "grid-14-ms";
        _tb50Cfg["mediaAtivaUrl"] = item.S("mediaUrl");
        _tb50Cfg["mode"] = "manual";
        AtualizarTodasVistasTb50();
        _ = SalvarConfigTb50Async();
    }

    // =========================================================================
    // Diálogos: + Adicionar Mídia, Playlist Item, Agendamento, Patrocinador
    // =========================================================================

    void AbrirDialogoAdicionarMidia()
    {
        using var d = NovoDialogo("Adicionar Conteúdo na Biblioteca (TB50)", "Imagens PNG/JPG/SVG (2048×512) ou cards informativos", "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6", "linear-gradient(180deg, #34C759, #0B7A53)", 680, 440);
        var titulo = PecasDesign.Texto("", 80);
        var categoria = new ListaDesign();
        categoria.Items.AddRange(["Imagens", "Vídeos", "Patrocinadores", "Informativos", "Starts/Transições", "Animações"]);
        categoria.SelectedIndex = 0;
        var duracao = PecasDesign.Numero(15, 3);
        var subtitulo = PecasDesign.Texto("Mídia para Painel de LED 2048×512", 100);
        var caminhoArq = PecasDesign.Texto("", 260); caminhoArq.ReadOnly = true;
        var btnProcurar = BotaoPeq("Escolher arquivo…", 0, () =>
        {
            using var ofd = new OpenFileDialog
            {
                Filter = "Mídia TB50 (*.png;*.jpg;*.jpeg;*.webp;*.gif;*.svg;*.mp4)|*.png;*.jpg;*.jpeg;*.webp;*.gif;*.svg;*.mp4|Todos (*.*)|*.*",
                Title = "Selecionar mídia para TB50 (2048×512)",
            };
            if (ofd.ShowDialog(d) == DialogResult.OK)
            {
                caminhoArq.Text = ofd.FileName;
                if (string.IsNullOrWhiteSpace(titulo.Text))
                    titulo.Text = Path.GetFileNameWithoutExtension(ofd.FileName);
            }
        });

        var g = d.Secao("Novo item da biblioteca TB50");
        d.Campo(g, "Título", titulo, 6);
        d.Campo(g, "Categoria", categoria, 3);
        d.Campo(g, "Duração (s)", duracao, 3);
        d.Campo(g, "Descrição", subtitulo, 6);
        d.Campo(g, "Arquivo local (opcional)", caminhoArq, 6, btnProcurar);

        d.BotaoRodape("Salvar e Enviar", true, () => Seguro.Rodar(d, async () =>
        {
            var tit = titulo.Text.Trim();
            if (string.IsNullOrEmpty(tit)) { Msg.Aviso(d, "Informe um título para o item."); return; }
            var body = new JsonObject
            {
                ["titulo"] = tit,
                ["categoria"] = categoria.SelectedItem?.ToString() ?? "Imagens",
                ["duracaoSeg"] = int.TryParse(duracao.Text, out var ds) ? Math.Clamp(ds, 3, 600) : 15,
                ["subtitulo"] = subtitulo.Text.Trim(),
            };
            if (!string.IsNullOrWhiteSpace(caminhoArq.Text) && File.Exists(caminhoArq.Text))
            {
                var bytes = await File.ReadAllBytesAsync(caminhoArq.Text);
                body["fileName"] = Path.GetFileName(caminhoArq.Text);
                body["dataBase64"] = Convert.ToBase64String(bytes);
            }
            var resp = await Crono.Api.PostAsync("/api/tb50-media", body);
            if (resp is JsonObject obj && obj["config"] is JsonObject cfg) _tb50Cfg = cfg;
            d.Close();
            AtualizarTodasVistasTb50();
            RegistrarHistoricoTb50("Mídia adicionada", tit);
        }));
        d.BotaoRodape("Cancelar", false, d.Close);
        d.ShowDialog(this);
    }

    async Task ExcluirMidiaSelecionadaAsync()
    {
        if (_gTb50Conteudo.ChaveAtual is not JsonObject item) { Msg.Aviso(this, "Selecione um item."); return; }
        if (item.B("protegido")) { Msg.Aviso(this, "Itens nativos do sistema não podem ser removidos."); return; }
        if (!Msg.Pergunta(this, $"Excluir \"{item.S("nome")}\" da biblioteca?")) return;
        var resp = await Crono.Api.DeleteAsync($"/api/tb50-media/{Uri.EscapeDataString(item.S("id"))}");
        if (resp is JsonObject obj && obj["config"] is JsonObject cfg) _tb50Cfg = cfg;
        AtualizarTodasVistasTb50();
    }

    void EditarItemPlaylistDialogo(JsonObject existente)
    {
        using var d = NovoDialogo(existente == null ? "Adicionar à Playlist" : "Editar Item da Playlist", "Item de exibição programada na TB50", "M4 6h16v5H4zM4 13h16v5H4z", "linear-gradient(180deg, #34C759, #0B7A53)", 640, 420);
        var nome = PecasDesign.Texto(existente?.S("nome") ?? "", 80);
        var layoutLista = new ListaDesign();
        foreach (var t in TemplatesTb50) layoutLista.Items.Add(new Campos.Item(0, $"{t.nome} ({t.id})", new JsonObject { ["id"] = t.id, ["nome"] = t.nome }));
        layoutLista.SelectedIndex = Math.Max(0, Array.FindIndex(TemplatesTb50, t => t.id == (existente?.S("layoutOuMidia") ?? "grid-14-ms")));
        var dur = PecasDesign.Numero(existente != null && existente.I("duracaoSeg") > 0 ? existente.I("duracaoSeg") : 30, 4);
        var trans = new ListaDesign();
        trans.Items.AddRange(["Corte", "Fade", "Slide"]);
        trans.SelectedIndex = Math.Max(0, trans.Items.IndexOf(existente?.S("transicao") ?? "Fade"));
        var ativo = new CheckBox { Text = "Item ativo na rotação", Checked = existente == null || existente.B("ativo"), AutoSize = true };

        var g = d.Secao("Programação do Item");
        d.Campo(g, "Layout / Template", layoutLista, 6);
        d.Campo(g, "Nome exibido", nome, 6);
        d.Campo(g, "Duração (segundos)", dur, 3);
        d.Campo(g, "Transição", trans, 3);
        d.Marca(g, ativo, 6, false);

        d.BotaoRodape("Salvar", true, () =>
        {
            var sel = (layoutLista.SelectedItem as Campos.Item)?.Dados;
            var lm = sel?.S("id") ?? "grid-14-ms";
            var nm = string.IsNullOrWhiteSpace(nome.Text) ? (sel?.S("nome") ?? lm) : nome.Text.Trim();
            var arr = (_tb50Cfg["playlist"] as JsonArray) ?? new JsonArray();
            if (existente != null)
            {
                existente["nome"] = nm;
                existente["layoutOuMidia"] = lm;
                existente["duracaoSeg"] = int.TryParse(dur.Text, out var ds) ? Math.Clamp(ds, 5, 3600) : 30;
                existente["transicao"] = trans.SelectedItem?.ToString() ?? "Fade";
                existente["ativo"] = ativo.Checked;
            }
            else
            {
                arr.Add(new JsonObject
                {
                    ["id"] = $"pl-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
                    ["ordem"] = arr.Count + 1,
                    ["nome"] = nm,
                    ["tipo"] = lm == "patrocinadores" ? "Patrocinadores" : "Layout Ao Vivo",
                    ["layoutOuMidia"] = lm,
                    ["duracaoSeg"] = int.TryParse(dur.Text, out var ds) ? Math.Clamp(ds, 5, 3600) : 30,
                    ["transicao"] = trans.SelectedItem?.ToString() ?? "Fade",
                    ["ativo"] = ativo.Checked,
                });
            }
            _tb50Cfg["playlist"] = arr;
            d.Close();
            AtualizarTodasVistasTb50();
            _ = SalvarConfigTb50Async();
        });
        d.BotaoRodape("Cancelar", false, d.Close);
        d.ShowDialog(this);
    }

    void DuplicarItemPlaylist()
    {
        if (_gTb50Playlist.ChaveAtual is not JsonObject item) return;
        var clone = item.DeepClone().AsObject();
        clone["id"] = $"pl-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        clone["nome"] = item.S("nome") + " (Cópia)";
        (_tb50Cfg["playlist"] as JsonArray)?.Add(clone);
        AtualizarTodasVistasTb50();
        _ = SalvarConfigTb50Async();
    }

    void RemoverItemPlaylist(JsonObject alvo = null)
    {
        var item = alvo ?? _gTb50Playlist.ChaveAtual as JsonObject;
        if (item == null) return;
        var arr = (_tb50Cfg["playlist"] as JsonArray) ?? new JsonArray();
        var novo = new JsonArray();
        foreach (var node in arr)
            if (node is JsonObject o && o.S("id") != item.S("id")) novo.Add(o.DeepClone());
        _tb50Cfg["playlist"] = novo;
        AtualizarTodasVistasTb50();
        _ = SalvarConfigTb50Async();
    }

    void MoverItemPlaylist(int delta, JsonObject alvo = null)
    {
        var item = alvo ?? _gTb50Playlist.ChaveAtual as JsonObject;
        if (item == null) return;
        var list = Crono.Arr(_tb50Cfg, "playlist");
        var idx = list.FindIndex(x => x.S("id") == item.S("id"));
        var dest = idx + delta;
        if (idx < 0 || dest < 0 || dest >= list.Count) return;
        (list[idx], list[dest]) = (list[dest], list[idx]);
        var novo = new JsonArray();
        foreach (var o in list) novo.Add(o.DeepClone());
        _tb50Cfg["playlist"] = novo;
        AtualizarTodasVistasTb50();
        _ = SalvarConfigTb50Async();
    }

    void AbrirDialogoNovoAgendamento()
    {
        using var d = NovoDialogo("Novo Agendamento TB50", "Troca automática por horário", "M12 7v5l3 3M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "linear-gradient(180deg, #5EDB7A, #1E9E4A)", 620, 400);
        var nome = PecasDesign.Texto("Troca de Layout Programada", 80);
        var hora = PecasDesign.Texto("18:00", 5);
        var dias = PecasDesign.Texto("Ter-Dom", 30);
        var acao = new ListaDesign();
        acao.Items.AddRange(["layout", "playlist", "viplex"]);
        acao.SelectedIndex = 0;
        var destino = PecasDesign.Texto("lista-laptime", 60);

        var g = d.Secao("Regra de Horário");
        d.Campo(g, "Nome", nome, 6);
        d.Campo(g, "Horário (HH:mm)", hora, 3);
        d.Campo(g, "Dias da semana", dias, 3);
        d.Campo(g, "Ação (layout / playlist / viplex)", acao, 3);
        d.Campo(g, "Destino (id do template / programa)", destino, 3);

        d.BotaoRodape("Salvar Agendamento", true, () =>
        {
            var arr = (_tb50Cfg["agendamentos"] as JsonArray) ?? new JsonArray();
            arr.Add(new JsonObject
            {
                ["id"] = $"ag-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
                ["nome"] = nome.Text.Trim(),
                ["horario"] = hora.Text.Trim(),
                ["diasSemana"] = dias.Text.Trim(),
                ["acao"] = acao.SelectedItem?.ToString() ?? "layout",
                ["destino"] = destino.Text.Trim(),
                ["ativo"] = true,
            });
            _tb50Cfg["agendamentos"] = arr;
            d.Close();
            AtualizarTodasVistasTb50();
            _ = SalvarConfigTb50Async();
        });
        d.BotaoRodape("Cancelar", false, d.Close);
        d.ShowDialog(this);
    }

    void AlternarAtivoAgendamento()
    {
        if (_gTb50Agenda.ChaveAtual is not JsonObject ag) return;
        ag["ativo"] = !ag.B("ativo");
        AtualizarTodasVistasTb50();
        _ = SalvarConfigTb50Async();
    }

    void ExcluirAgendamento()
    {
        if (_gTb50Agenda.ChaveAtual is not JsonObject ag) return;
        var arr = (_tb50Cfg["agendamentos"] as JsonArray) ?? new JsonArray();
        var novo = new JsonArray();
        foreach (var n in arr) if (n is JsonObject o && o.S("id") != ag.S("id")) novo.Add(o.DeepClone());
        _tb50Cfg["agendamentos"] = novo;
        AtualizarTodasVistasTb50();
        _ = SalvarConfigTb50Async();
    }

    void AbrirDialogoPatrocinador(JsonObject existente)
    {
        using var d = NovoDialogo(existente == null ? "Novo Patrocinador" : "Editar Patrocinador", "Exibido no rodapé do painel Ao Vivo e no modo Patrocinadores", "M12 5v14M5 12h14", "linear-gradient(180deg, #FFB547, #F07A00)", 580, 360);
        var nome = PecasDesign.Texto(existente?.S("nome") ?? "", 60);
        var slogan = PecasDesign.Texto(existente?.S("slogan") ?? "Parceiro Oficial", 100);
        var cor = PecasDesign.Texto(existente?.S("cor") ?? "#00E676", 12);
        var ativo = new CheckBox { Text = "Ativo na exibição da TB50", Checked = existente == null || existente.B("ativo"), AutoSize = true };

        var g = d.Secao("Dados do Patrocinador");
        d.Campo(g, "Nome da Marca", nome, 6);
        d.Campo(g, "Slogan / Subtítulo", slogan, 4);
        d.Campo(g, "Cor (#hex)", cor, 2);
        d.Marca(g, ativo, 6, false);

        d.BotaoRodape("Salvar", true, () =>
        {
            if (string.IsNullOrWhiteSpace(nome.Text)) { Msg.Aviso(d, "Informe o nome do patrocinador."); return; }
            var arr = (_tb50Cfg["patrocinadores"] as JsonArray) ?? new JsonArray();
            if (existente != null)
            {
                existente["nome"] = nome.Text.Trim();
                existente["slogan"] = slogan.Text.Trim();
                existente["cor"] = cor.Text.Trim();
                existente["ativo"] = ativo.Checked;
            }
            else
            {
                arr.Add(new JsonObject
                {
                    ["id"] = $"pat-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
                    ["nome"] = nome.Text.Trim(),
                    ["slogan"] = slogan.Text.Trim(),
                    ["cor"] = cor.Text.Trim(),
                    ["ativo"] = ativo.Checked,
                });
            }
            _tb50Cfg["patrocinadores"] = arr;
            d.Close();
            AtualizarTodasVistasTb50();
            _ = SalvarConfigTb50Async();
        });
        d.BotaoRodape("Cancelar", false, d.Close);
        d.ShowDialog(this);
    }

    void AlternarAtivoPatrocinador()
    {
        if (_gTb50Patrocinadores.ChaveAtual is not JsonObject p) return;
        p["ativo"] = !p.B("ativo");
        AtualizarTodasVistasTb50();
        _ = SalvarConfigTb50Async();
    }

    void ExcluirPatrocinador()
    {
        if (_gTb50Patrocinadores.ChaveAtual is not JsonObject p) return;
        var arr = (_tb50Cfg["patrocinadores"] as JsonArray) ?? new JsonArray();
        var novo = new JsonArray();
        foreach (var n in arr) if (n is JsonObject o && o.S("id") != p.S("id")) novo.Add(o.DeepClone());
        _tb50Cfg["patrocinadores"] = novo;
        AtualizarTodasVistasTb50();
        _ = SalvarConfigTb50Async();
    }

    // =========================================================================
    // Helpers de UI e Renderização 4:1 (2048×512) em Tempo Real
    // =========================================================================

    static void ReposicionarCanvas4x1(Panel palco, Control canvas)
    {
        var mw = Math.Max(120, palco.ClientSize.Width - palco.Padding.Horizontal);
        var mh = Math.Max(30, palco.ClientSize.Height - palco.Padding.Vertical);
        var w = mw;
        var h = (int)Math.Round(w / 4.0);
        if (h > mh) { h = mh; w = (int)Math.Round(h * 4.0); }
        canvas.Size = new Size(Math.Max(120, w), Math.Max(30, h));
        canvas.Location = new Point((palco.ClientSize.Width - canvas.Width) / 2, (palco.ClientSize.Height - canvas.Height) / 2);
    }

    static Button BotaoGradeCtrl(string texto, bool inicialAtivo, Action clique)
    {
        var b = new BotaoPlano
        {
            Text = texto,
            Dock = DockStyle.Fill,
            Margin = new Padding(2),
            FlatStyle = FlatStyle.Flat,
            BackColor = inicialAtivo ? TemaCrono.Verde : Color.FromArgb(232, 232, 237),
            ForeColor = inicialAtivo ? Tokens.Primitivo.Branco : TemaCrono.Texto,
            Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoLegenda, inicialAtivo ? FontStyle.Bold : FontStyle.Regular),
            Cursor = Cursors.Hand,
        };
        b.FlatAppearance.BorderSize = 0;
        b.Resize += (_, _) => Forma.AplicarRaio(b, 6);
        b.Click += (_, _) => clique();
        return b;
    }

    static string NomeTemplate(string id) => TemplatesTb50.FirstOrDefault(t => t.id == id).nome ?? "Placar 20 Karts (Pos)";

    static Color ParseCorHex(string hex, Color padrao)
    {
        try { return !string.IsNullOrWhiteSpace(hex) ? ColorTranslator.FromHtml(hex.Trim()) : padrao; }
        catch { return padrao; }
    }

    sealed class PreviewTb50Canvas : Control
    {
        readonly FormCrono _dono;
        public event Action<string> CamadaClicada;

        public PreviewTb50Canvas(FormCrono dono)
        {
            _dono = dono;
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            Cursor = Cursors.Hand;
        }

        protected override void OnMouseClick(MouseEventArgs e)
        {
            base.OnMouseClick(e);
            if (e.Y < Height * 0.20) CamadaClicada?.Invoke("cabecalho");
            else if (e.Y > Height * 0.85) CamadaClicada?.Invoke("patrocinadores");
            else if (e.X < Width * 0.20 && _dono._tb50Cfg?.S("layout") == "lista-laptime") CamadaClicada?.Invoke("cronometro");
            else CamadaClicada?.Invoke("placar");
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
            g.Clear(Color.FromArgb(6, 9, 10));

            var cfg = _dono._tb50Cfg;
            if (cfg == null) return;

            var layout = cfg.S("layout");
            var corPri = ParseCorHex(cfg.S("corPrimaria"), Color.FromArgb(0, 230, 118));
            var corDest = ParseCorHex(cfg.S("corDestaque"), Color.FromArgb(255, 179, 0));
            var showMs = cfg["mostrarMilesimos"] == null || cfg.B("mostrarMilesimos");
            var camadas = (cfg["camadas"] as JsonObject) ?? new JsonObject();
            bool Vis(string k) => camadas[k] == null || camadas.B(k);

            // Monta lista ao vivo dos standings reais ou amostra realista para preview
            var standings = Crono.Arr(_dono._sess, "standings");
            var drivers = new List<(int pos, string kart, string nome, string best, string last, int laps)>();
            foreach (var r in standings)
            {
                var pos = r.I("position");
                var laps = r.I("laps");
                var best = r.L("bestLapMs") is long bl && bl > 0 ? Crono.Volta(bl) : "--";
                var last = r.L("lastLapMs") is long ll && ll > 0 ? Crono.Volta(ll) : best;
                if (!showMs) { best = best.Split('.')[0]; last = last.Split('.')[0]; }
                drivers.Add((pos, r.S("kart"), r.S("name"), best, last, laps));
            }
            var demo = drivers.Count == 0 || drivers.All(d => d.laps == 0);
            if (drivers.Count == 0)
            {
                drivers =
                [
                    (1, "132", "RK MINEIRO", "1:05.570", "1:05.812", 12),
                    (2, "130", "ZERO27 / ÁGUIA", "1:05.899", "1:06.104", 12),
                    (3, "107", "FIREPIT / APEX", "1:06.087", "1:06.210", 12),
                    (4, "48", "GABRIEL GOMES", "1:06.340", "1:06.491", 12),
                    (5, "64", "RODRIGO ABREU", "1:06.715", "1:06.902", 11),
                    (6, "68", "LUCAS NAVES", "1:07.018", "1:07.255", 11),
                    (7, "34", "LUISA LIMA", "1:07.490", "1:07.880", 11),
                ];
            }

            // Escala uniforme a partir da coordenada 2048 x 512
            var s = Math.Min(Width / 2048f, Height / 512f);
            var st = g.Save();
            g.ScaleTransform(s, s);

            if (layout == "top3-live")
                DesenharTop3(g, drivers, cfg, corPri, corDest, Vis("cabecalho"), Vis("patrocinadores"), Vis("fundo"));
            else if (layout == "lista-laptime")
                DesenharListaLapTime(g, drivers, cfg, Vis("cronometro"), Vis("cabecalho"));
            else if (layout == "grid-20-pos")
                DesenharGrid(g, drivers, 10, false, corPri, corDest);
            else if (layout == "podio-final")
                DesenharPodio(g, drivers, cfg);
            else if (layout == "patrocinadores")
                DesenharPatrocinadores(g, cfg, corPri, corDest);
            else
                DesenharGrid(g, drivers, 7, true, corPri, corDest);

            g.Restore(st);

            if (demo)
            {
                using var fp = Tokens.Fonte(9.5f, FontStyle.Bold);
                using var pb = new SolidBrush(Color.FromArgb(160, 0, 0, 0));
                var rt = new Rectangle(Width - 152, 6, 146, 20);
                g.FillRectangle(pb, rt);
                TextRenderer.DrawText(g, "PRÉVIA COM DADOS DEMO", fp, rt, Color.FromArgb(220, 220, 220), TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
            }
        }

        void DesenharGrid(Graphics g, List<(int pos, string kart, string nome, string best, string last, int laps)> drivers, int cols, bool showTime, Color corPri, Color corDest)
        {
            using var pen = new Pen(Color.White, 6f);
            g.DrawRectangle(pen, 10, 10, 2028, 492);
            var cw = 2022f / cols;
            var ch = 486f / 2f;
            var off = _dono._tb50Cfg.I("offset");
            var fPos = new Font("Segoe UI", showTime ? 22f : 56f, FontStyle.Bold);
            var fKart = new Font("Segoe UI", showTime ? 84f : 66f, FontStyle.Bold);
            var fTime = new Font("Cascadia Mono", 34f, FontStyle.Bold);
            try
            {
                for (var i = 0; i < cols * 2; i++)
                {
                    var lin = i / cols;
                    var col = i % cols;
                    var pos = off + i + 1;
                    var rx = 13 + col * cw;
                    var ry = 13 + lin * ch;
                    using (var bg = new SolidBrush(pos == 1 && showTime ? Color.FromArgb(10, 32, 18) : (lin == 1 ? Color.FromArgb(16, 16, 18) : Color.FromArgb(6, 6, 8))))
                        g.FillRectangle(bg, rx, ry, cw, ch);
                    g.DrawRectangle(pen, rx, ry, cw, ch);

                    var idx = drivers.FindIndex(d => d.pos == pos);
                    var has = idx >= 0;
                    var kart = has ? (drivers[idx].kart.Length > 0 ? drivers[idx].kart : "-") : "-";
                    var tm = has ? drivers[idx].best : "";
                    var cr = new RectangleF(rx, ry, cw, ch);

                    if (showTime)
                    {
                        using var bp = new SolidBrush(has ? (pos == 1 ? corDest : Color.FromArgb(180, 255, 255, 255)) : Color.FromArgb(70, 255, 255, 255));
                        using var bk = new SolidBrush(has ? corPri : Color.FromArgb(70, 255, 255, 255));
                        using var bt = new SolidBrush(pos == 1 ? corPri : corDest);
                        using var sf = new StringFormat { Alignment = StringAlignment.Center };
                        g.DrawString(has ? $"P{pos}" : pos.ToString(), fPos, bp, new RectangleF(cr.X, cr.Y + 12, cr.Width, 34), sf);
                        g.DrawString(kart, fKart, bk, new RectangleF(cr.X, cr.Y + 42, cr.Width, 120), sf);
                        if (has && tm.Length > 0)
                            g.DrawString(tm, fTime, bt, new RectangleF(cr.X, cr.Y + 168, cr.Width, 56), sf);
                    }
                    else
                    {
                        using var bp = new SolidBrush(has ? Color.White : Color.FromArgb(80, 255, 255, 255));
                        using var bk = new SolidBrush(has ? Color.FromArgb(0, 255, 17) : Color.FromArgb(80, 255, 255, 255));
                        using var sf = new StringFormat { Alignment = StringAlignment.Center };
                        g.DrawString(pos.ToString(), fPos, bp, new RectangleF(cr.X, cr.Y + 26, cr.Width, 84), sf);
                        g.DrawString(kart, fKart, bk, new RectangleF(cr.X, cr.Y + 114, cr.Width, 96), sf);
                    }
                }
            }
            finally { fPos.Dispose(); fKart.Dispose(); fTime.Dispose(); }
        }

        void DesenharTop3(Graphics g, List<(int pos, string kart, string nome, string best, string last, int laps)> drivers, JsonObject cfg, Color corPri, Color corDest, bool showHead, bool showFoot, bool showBg)
        {
            if (showBg)
            {
                using var bg = new LinearGradientBrush(new Rectangle(0, 0, 2048, 512), Color.FromArgb(8, 36, 22), Color.FromArgb(4, 6, 7), 90f);
                g.FillRectangle(bg, 0, 0, 2048, 512);
            }
            using var fTit = new Font("Segoe UI", 32f, FontStyle.Bold);
            using var fSub = new Font("Segoe UI", 17f, FontStyle.Bold);
            using var fBigPos = new Font("Segoe UI", 72f, FontStyle.Bold | FontStyle.Italic);
            using var fName = new Font("Segoe UI", 32f, FontStyle.Bold);
            using var fTime = new Font("Cascadia Mono", 58f, FontStyle.Bold);
            using var sfC = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };

            if (showHead)
            {
                using var hb = new SolidBrush(Color.FromArgb(140, 0, 0, 0));
                g.FillRectangle(hb, 0, 0, 2048, 92);
                var tit = cfg.S("tituloCustom") is { Length: > 0 } tc ? tc : "TOP 3 AO VIVO";
                var sub = cfg.S("subtituloCustom") is { Length: > 0 } sc ? sc : (_dono._sess?.S("name") is { Length: > 0 } sn ? sn : "KARTÓDROMO DE BETIM");
                using var bDest = new SolidBrush(corDest);
                g.DrawString(tit, fTit, bDest, new RectangleF(320, 4, 1408, 48), sfC);
                g.DrawString(sub.ToUpperInvariant(), fSub, Brushes.White, new RectangleF(320, 50, 1408, 30), sfC);
                using var bPri = new SolidBrush(Color.FromArgb(11, 122, 83));
                using var pBadge = Forma.Redondo(new Rectangle(1700, 16, 310, 58), 10);
                g.FillPath(bPri, pBadge);
                g.DrawString("● AO VIVO", fSub, Brushes.White, new RectangleF(1700, 16, 310, 58), sfC);
            }

            for (var i = 0; i < 3; i++)
            {
                var cx = 28 + i * 676;
                var cr = new Rectangle(cx, 112, 640, 330);
                using (var cbg = new SolidBrush(Color.FromArgb(14, 20, 18)))
                using (var cp = Forma.Redondo(cr, 16))
                    g.FillPath(cbg, cp);
                using (var cpen = new Pen(i == 0 ? corDest : corPri, 3f))
                using (var cp = Forma.Redondo(cr, 16))
                    g.DrawPath(cpen, cp);

                using (var fb = new SolidBrush(corPri))
                using (var fp = Forma.Redondo(new Rectangle(cx + 18, 130, 138, 294), 12))
                    g.FillPath(fb, fp);
                g.DrawString($"P{i + 1}", fBigPos, Brushes.Black, new RectangleF(cx + 18, 130, 138, 294), sfC);

                var has = i < drivers.Count;
                var nome = has ? drivers[i].nome : "AGUARDANDO";
                var kart = has ? $"KART {drivers[i].kart}" : "---";
                var tempo = has ? drivers[i].best : "--:--.---";
                g.DrawString(nome.ToUpperInvariant(), fName, Brushes.White, new RectangleF(cx + 174, 136, 446, 52));
                using (var bPri = new SolidBrush(corPri)) g.DrawString(kart, fTit, bPri, new RectangleF(cx + 174, 206, 446, 48));
                using (var bDest = new SolidBrush(corDest)) g.DrawString(tempo, fTime, bDest, new RectangleF(cx + 174, 286, 446, 84));
            }

            if (showFoot)
            {
                using var fb = new SolidBrush(Color.FromArgb(200, 0, 0, 0));
                g.FillRectangle(fb, 0, 460, 2048, 52);
                var pats = string.Join("  •  ", Crono.Arr(cfg, "patrocinadores").Where(p => p.B("ativo")).Select(p => p.S("nome")));
                using var bPri = new SolidBrush(corPri);
                using var bDest = new SolidBrush(corDest);
                g.DrawString(cfg.S("rodapeTexto"), fSub, Brushes.LightGray, 28, 472);
                g.DrawString(pats, fSub, bPri, new RectangleF(520, 462, 1020, 48), sfC);
                g.DrawString("ATUALIZADO AGORA", fSub, bDest, 1740, 472);
            }
        }

        void DesenharListaLapTime(Graphics g, List<(int pos, string kart, string nome, string best, string last, int laps)> drivers, JsonObject cfg, bool showCrono, bool showHead)
        {
            g.Clear(Color.FromArgb(34, 38, 43));
            using var penOr = new Pen(Color.FromArgb(234, 88, 12), 4f);
            g.DrawRectangle(penOr, 2, 2, 2044, 508);
            using (var esqBg = new SolidBrush(Color.FromArgb(24, 27, 31))) g.FillRectangle(esqBg, 4, 4, 356, 504);
            g.DrawLine(penOr, 360, 0, 360, 512);

            using var fRel = new Font("Cascadia Mono", 48f, FontStyle.Bold);
            using var fRow = new Font("Segoe UI", 24f, FontStyle.Bold);
            using var fTime = new Font("Cascadia Mono", 25f, FontStyle.Bold);
            using var sfC = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };

            if (showCrono)
            {
                var relTxt = _dono._lCrono.Text is { Length: >= 8 } ct ? ct[..8] : "00:00:00";
                g.DrawString(relTxt, fRel, Brushes.White, new RectangleF(10, 170, 340, 84), sfC);
            }
            using var fMeta = new Font("Segoe UI", 18f, FontStyle.Bold);
            g.DrawString((_dono._sess?.S("name") ?? "CRONOMETRAGEM").ToUpperInvariant(), fMeta, Brushes.LightGray, new RectangleF(16, 290, 328, 90), sfC);

            if (showHead)
            {
                using var hBg = new SolidBrush(Color.FromArgb(45, 50, 57));
                g.FillRectangle(hBg, 362, 4, 1680, 48);
                g.DrawLine(penOr, 360, 52, 2046, 52);
                g.DrawString("POS", fMeta, Brushes.LightGray, 386, 12);
                g.DrawString("KART", fMeta, Brushes.LightGray, 476, 12);
                g.DrawString("PILOTO", fMeta, Brushes.LightGray, 586, 12);
                g.DrawString("TIME", fMeta, Brushes.LightGray, 1380, 12);
                g.DrawString("LAP", fMeta, Brushes.LightGray, 1554, 12);
                g.DrawString("B.TIME", fMeta, Brushes.LightGray, 1874, 12);
            }

            using var bBlue = new SolidBrush(Color.FromArgb(21, 101, 192));
            for (var i = 0; i < 7 && i < drivers.Count; i++)
            {
                var y = 56 + i * 64;
                var d = drivers[i];
                if (i % 2 == 1)
                {
                    using var z = new SolidBrush(Color.FromArgb(40, 0, 0, 0));
                    g.FillRectangle(z, 362, y, 1680, 62);
                }
                g.DrawString(d.pos.ToString(), fRow, Brushes.White, new RectangleF(378, y, 70, 60), sfC);
                using (var pk = Forma.Redondo(new Rectangle(468, y + 10, 96, 42), 8)) g.FillPath(bBlue, pk);
                g.DrawString(d.kart, fRow, Brushes.White, new RectangleF(468, y + 10, 96, 42), sfC);
                g.DrawString(d.nome.ToUpperInvariant(), fRow, Brushes.White, new RectangleF(584, y + 10, 620, 44));
                g.DrawString(d.last, fTime, Brushes.White, new RectangleF(1220, y + 10, 290, 44));
                g.DrawString(d.laps.ToString(), fRow, Brushes.LightGray, new RectangleF(1534, y, 110, 60), sfC);
                using var bt = new SolidBrush(d.pos == 1 ? Color.FromArgb(0, 230, 118) : Color.FromArgb(255, 213, 79));
                g.DrawString(d.best, fTime, bt, new RectangleF(1720, y + 10, 300, 44));
            }
        }

        void DesenharPodio(Graphics g, List<(int pos, string kart, string nome, string best, string last, int laps)> drivers, JsonObject cfg)
        {
            using var bg = new LinearGradientBrush(new Rectangle(0, 0, 2048, 512), Color.FromArgb(36, 28, 6), Color.Black, 90f);
            g.FillRectangle(bg, 0, 0, 2048, 512);
            using var fTit = new Font("Segoe UI", 42f, FontStyle.Bold | FontStyle.Italic);
            using var fRow = new Font("Segoe UI", 28f, FontStyle.Bold);
            using var sfC = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
            g.DrawString("RESULTADO FINAL · PÓDIO", fTit, Brushes.Gold, new RectangleF(0, 30, 2048, 72), sfC);
            for (var i = 0; i < 5 && i < drivers.Count; i++)
            {
                var col = i % 2;
                var lin = i / 2;
                var x = 72 + col * 942;
                var y = 162 + lin * 110;
                using (var rb = new SolidBrush(Color.FromArgb(20, 20, 22))) g.FillRectangle(rb, x, y, 914, 92);
                g.FillRectangle(Brushes.Gold, x, y, 92, 92);
                g.DrawString(drivers[i].pos.ToString(), fTit, Brushes.Black, new RectangleF(x, y, 92, 92), sfC);
                g.DrawString(drivers[i].nome.ToUpperInvariant(), fRow, Brushes.White, x + 114, y + 22);
                g.DrawString($"#{drivers[i].kart}  {drivers[i].best}", fRow, Brushes.Gold, x + 610, y + 22);
            }
        }

        void DesenharPatrocinadores(Graphics g, JsonObject cfg, Color corPri, Color corDest)
        {
            using var bg = new LinearGradientBrush(new Rectangle(0, 0, 2048, 512), Color.FromArgb(10, 44, 28), Color.Black, 90f);
            g.FillRectangle(bg, 0, 0, 2048, 512);
            using var fBig = new Font("Segoe UI", 54f, FontStyle.Bold);
            using var fSub = new Font("Segoe UI", 24f, FontStyle.Bold);
            using var sfC = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
            var pats = Crono.Arr(cfg, "patrocinadores").Where(p => p.B("ativo")).ToList();
            var nome = cfg.S("mediaAtivaNome") is { Length: > 0 } mn ? mn : (pats.FirstOrDefault()?.S("nome") ?? "KARTÓDROMO INTERNACIONAL DE BETIM");
            using var bPri = new SolidBrush(corPri);
            using var bDest = new SolidBrush(corDest);
            g.DrawString("KARTÓDROMO DE BETIM · 2048×512", fSub, bPri, new RectangleF(0, 44, 2048, 44), sfC);
            g.DrawString(nome.ToUpperInvariant(), fBig, Brushes.White, new RectangleF(80, 120, 1888, 120), sfC);
            var listaTxt = string.Join("   |   ", pats.Select(p => p.S("nome")));
            g.DrawString(listaTxt, fSub, bDest, new RectangleF(80, 310, 1888, 80), sfC);
        }
    }
}
