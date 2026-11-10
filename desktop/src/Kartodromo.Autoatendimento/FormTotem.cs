using System.Diagnostics;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Autoatendimento;

/// <summary>
/// Totem de autoatendimento em tela cheia: identificação -> cadastro/atualização -> menores ->
/// baterias -> sucesso (imprime o termo na impressora do totem).
/// </summary>
public class FormTotem : Form, IMessageFilter
{
    record Pessoa(long Id, string Nome, string Nascimento, string Token);

    // Totem 1 (.161) e Totem 2 (.69)
    static readonly bool TotemTravado = Environment.MachineName.ToUpperInvariant() is "TOTEN1" or "DESKTOP-4OR2GFI";

    // estado do atendimento em curso
    string _ident = "";
    bool _menor;
    JsonObject _cliente;
    string _token;
    List<Pessoa> _dependentes = [];
    List<Pessoa> _participantes = [];
    bool _eu = true;
    HashSet<long> _sel = [];
    string _tela = "ident";
    bool _cadastroExistente;

    JsonObject _cfg = new() { ["empresa"] = "Kartódromo", ["mensagem"] = "Seja bem-vindo(a)!", ["imprimirTermo"] = true, ["consultarCep"] = true };
    readonly Api _api;
    readonly string _autoteste;
    readonly System.Windows.Forms.Timer _ocioso = new() { Interval = 90_000 };
    readonly System.Windows.Forms.Timer _fim = new() { Interval = 90_000 };
    readonly Image _logo = Estilo.Logo();
    readonly string _versao = "v" + (typeof(FormTotem).Assembly.GetName().Version?.ToString(3) ?? "1.0.0");
    readonly CabecalhoTotem _cabecalho;
    Panel _cartao;
    Cartao _aguarde;
    float _k = 1f;
    bool _liberadoFechar;
    int _alertasNoAutoteste;

    public FormTotem(string autoteste, Api api = null)
    {
        _autoteste = autoteste;
        _api = api ?? Api.Servidor;
        _cabecalho = new CabecalhoTotem(_logo, 1);
        Text = "Autoatendimento";
        Icon = Icone.App;
        BackColor = Estilo.Fundo;
        DoubleBuffered = true;
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        KeyPreview = true;
        FormBorderStyle = FormBorderStyle.None;
        Controls.Add(_cabecalho);
        if (autoteste == null)
        {
            // só os totens de verdade ficam travados; nos outros PCs é uma janela comum, com o X
            if (!TotemTravado) FormBorderStyle = FormBorderStyle.Sizable;
            WindowState = FormWindowState.Maximized;
            TopMost = TotemTravado;
            Application.AddMessageFilter(this);
        }
        else
        {
            StartPosition = FormStartPosition.Manual;
            // KARTODROMO_FORA_DA_TELA=1: autoteste num PC em uso (ex.: o ORBITS durante a corrida) sem cobrir a tela de ninguém
            var foraDaTela = Environment.GetEnvironmentVariable("KARTODROMO_FORA_DA_TELA") == "1";
            Location = foraDaTela ? new Point(-4000, 0) : new Point(0, 0);
            ClientSize = new Size(1366, 768);
            TopMost = !foraDaTela;
            ShowInTaskbar = !foraDaTela;
        }
        Resize += (_, _) =>
        {
            var k = Math.Min(ClientSize.Width / 1366f, ClientSize.Height / 768f);
            if (Math.Abs(k - _k) > .01f && _cartao != null) { _k = k; Redesenhar(); }
            else Centralizar();
            AtualizarCabecalho();
            Invalidate();
        };
        _ocioso.Tick += (_, _) =>
        {
            if (_tela != "ident" || _ident.Length > 0 || (_cartao?.Controls.OfType<CampoTexto>().Any(c => c.Text.Length > 0) ?? false))
                Reiniciar();
            else
                _ = VerificarAtualizacaoOciosoAsync();
        };
        _fim.Tick += (_, _) => Reiniciar();
        KeyDown += (_, e) =>
        {
            // saida da equipe: Ctrl+Shift+Alt+S
            if (e.Control && e.Shift && e.Alt && e.KeyCode == Keys.S) { _liberadoFechar = true; Close(); }
        };
        FormClosing += (_, e) =>
        {
            if (_autoteste == null && TotemTravado && e.CloseReason == CloseReason.UserClosing && !_liberadoFechar) e.Cancel = true;
            else if (TotemTravado) ServidorImpressaoRaw.Parar();
        };
        Shown += async (_, _) =>
        {
            _k = Math.Min(ClientSize.Width / 1366f, ClientSize.Height / 768f);
            Reiniciar();
            if (TotemTravado) ServidorImpressaoRaw.Iniciar(ObterImpressoraTotem());
            if (_autoteste == null) _ocioso.Start();
            await CarregarConfig();
            if (_autoteste != null) { await AutoTeste(); return; }
            if (_tela == "ident" && _ident.Length == 0) TelaIdent();
        };
    }

    protected override void OnPaintBackground(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.Clear(Color.Black);
        g.SmoothingMode = SmoothingMode.AntiAlias;
        var sx = ClientSize.Width / 1366f;
        var sy = ClientSize.Height / 768f;
        var scale = Math.Min(sx, sy);
        var w = 1366f * scale;
        var h = 768f * scale;
        var ox = (ClientSize.Width - w) / 2f;
        var oy = (ClientSize.Height - h) / 2f;

        using (var glow = new System.Drawing.Drawing2D.PathGradientBrush(new[]
        {
            new PointF(ox + w * .17f, oy - h * .12f), new PointF(ox + w * .83f, oy - h * .12f),
            new PointF(ox + w * .83f, oy + h * .48f), new PointF(ox + w * .17f, oy + h * .48f),
        }))
        {
            glow.CenterPoint = new PointF(ox + w * .5f, oy + h * .06f);
            glow.CenterColor = Color.FromArgb(38, Estilo.Verde.R, Estilo.Verde.G, Estilo.Verde.B);
            glow.SurroundColors = [Color.Transparent, Color.Transparent, Color.Transparent, Color.Transparent];
            g.FillRectangle(glow, ox, oy, w, h * .55f);
        }

        // Grade de perspectiva discreta inspirada no fundo do design aprovado.
        using var gridPen = new Pen(Tokens.Escuro.ComponenteTotemGrade, Math.Max(1, scale));
        var horizon = oy + h * .69f;
        for (var i = -8; i <= 8; i++)
        {
            var bottomX = ox + w / 2f + i * 150 * scale;
            g.DrawLine(gridPen, ox + w / 2f + i * 25 * scale, horizon, bottomX, oy + h + 30 * scale);
        }
        for (var row = 1; row <= 5; row++)
        {
            var t = row / 5f;
            var y = horizon + (oy + h - horizon) * t * t;
            g.DrawLine(gridPen, ox - 120 * scale, y, ox + w + 120 * scale, y);
        }
    }

    // ------------------------------------------------------------------ infra

    public bool PreFilterMessage(ref Message m)
    {
        // qualquer toque/tecla reinicia a contagem de inatividade
        if (m.Msg is 0x100 or 0x201 or 0x204 or 0x240 /*WM_TOUCH*/ or 0x0246 /*WM_POINTERDOWN*/)
        {
            _ocioso.Stop(); _ocioso.Start();
            if (_tela == "fim") { _fim.Stop(); _fim.Start(); }
        }
        return false;
    }

    async Task CarregarConfig(CancellationToken ct = default)
    {
        try { if (await _api.GetAsync("/api/totem/config", ct).ConfigureAwait(true) is JsonObject c) _cfg = c; }
        catch (Exception e) { Program.Log("config: " + e.Message); }
    }

    int P(float v) => (int)Math.Round(v * _k);
    Font F(float px, bool leve = false, FontStyle estilo = FontStyle.Regular) => Estilo.F(px * _k, leve, estilo);

    Action _redesenhar;
    void Redesenhar() => _redesenhar?.Invoke();

    TelaCanvas NovaTela(bool etapas = true, int etapa = 1, string rotuloDireita = null)
    {
        var c = new TelaCanvas { Size = new Size(P(1366), P(768)), Etapa = etapas ? etapa : 0 };
        if (!etapas && rotuloDireita != null)
            c.Controls.Add(new Label { Text = rotuloDireita, Font = F(14), ForeColor = Estilo.MuitoSuave, BackColor = Color.Transparent, AutoSize = true, Location = new Point(P(1190), P(48)) });
        return c;
    }

    void Mostrar(string tela, Panel c, Action redesenhar)
    {
        _tela = tela;
        _redesenhar = redesenhar;
        SuspendLayout();
        var velho = _cartao;
        _cartao = c;
        _cabecalho.Parent?.Controls.Remove(_cabecalho);
        c.Controls.Add(_cabecalho);
        Controls.Add(c);
        Centralizar();
        AtualizarCabecalho();
        foreach (var botao in c.Controls.OfType<Pilula>().ToArray()) botao.BringToFront();
        if (velho != null) { Controls.Remove(velho); velho.Dispose(); }
        ResumeLayout();
        GarantirCabecalhoNoTopo();
        // procura também dentro dos cartões (os campos do cadastro ficam num cartão; antes o foco caía no 1º campo da tela)
        static IEnumerable<Control> Todos(Control raiz) => raiz.Controls.Cast<Control>().SelectMany(x => new[] { x }.Concat(Todos(x)));
        Todos(c).OfType<CampoTexto>().FirstOrDefault(x => x.Enabled && x.Tag as string == "foco")?.Caixa.Focus();
    }

    void GarantirCabecalhoNoTopo()
    {
        if (_cabecalho == null || _cabecalho.IsDisposed || _cabecalho.Parent == null || !_cabecalho.Parent.Controls.Contains(_cabecalho)) return;
        _cabecalho.BringToFront();
        _cabecalho.Parent.Controls.SetChildIndex(_cabecalho, 0);
        _cabecalho.Invalidate();
    }

    void AtualizarCabecalho()
    {
        if (_cabecalho == null || _cabecalho.IsDisposed) return;
        Control dono = _cartao is Control panel ? panel : this;
        _cabecalho.Bounds = new Rectangle(0, 0, dono.ClientSize.Width, P(88));
        _cabecalho.Atualizar((_cartao as TelaCanvas)?.Etapa ?? 1, _k);
        _cabecalho.BringToFront();
    }

    void Centralizar()
    {
        if (_cartao == null) return;
        _cartao.Location = new Point((ClientSize.Width - _cartao.Width) / 2, (ClientSize.Height - _cartao.Height) / 2);
    }

    Cartao CartaoEm(Control dono, float x, float y, float w, float h)
    {
        var c = new Cartao { Bounds = new Rectangle(P(x), P(y), P(w), P(h)), BackColor = Color.Transparent, Padding = new Padding(P(24)) };
        dono.Controls.Add(c);
        return c;
    }

    Label Rot(string texto, float x, float y, Font f, Color cor, float largura = 0, float altura = 0, ContentAlignment alinhamento = ContentAlignment.TopLeft)
    {
        var l = new Label { Text = texto, Font = f, ForeColor = cor, BackColor = Color.Transparent, Location = new Point(P(x), P(y)), UseMnemonic = false, TextAlign = alinhamento };
        if (largura > 0) { l.AutoSize = false; l.Size = new Size(P(largura), P(altura > 0 ? altura : TextRenderer.MeasureText(texto, f, new Size(P(largura), 999), TextFormatFlags.WordBreak).Height + 2)); }
        else l.AutoSize = true;
        return l;
    }

    CampoTexto Campo(Control dono, string rotulo, float x, float y, float w, string valor = "", bool foco = false, float altura = 58)
    {
        dono.Controls.Add(Rot(rotulo, x + 4, y - 23, F(14, false, FontStyle.Bold), Estilo.Suave));
        var c = new CampoTexto { Bounds = new Rectangle(P(x), P(y), P(w), P(altura)), Tag = foco ? "foco" : null };
        c.AccessibleName = rotulo;
        c.Caixa.AccessibleName = rotulo;
        c.Caixa.Font = F(19);
        c.Text = valor ?? "";
        dono.Controls.Add(c);
        return c;
    }

    CampoLista Lista(Control dono, string rotulo, float x, float y, float w, params string[] itens)
    {
        dono.Controls.Add(Rot(rotulo, x + 4, y - 23, F(14, false, FontStyle.Bold), Estilo.Suave));
        var c = new CampoLista(itens) { Bounds = new Rectangle(P(x), P(y), P(w), P(58)) };
        c.AccessibleName = rotulo;
        c.Font = F(19);
        dono.Controls.Add(c);
        return c;
    }

    Pilula Botao(Control dono, string texto, float x, float y, float w, bool principal, Func<Task> clique, float altura = 64, float tamanhoFonte = 19)
    {
        var b = new Pilula(texto, principal) { Bounds = new Rectangle(P(x), P(y), P(w), P(altura)), Font = F(tamanhoFonte, false, principal ? FontStyle.Bold : FontStyle.Regular) };
        b.Click += async (_, _) => { if (b.Enabled) await ExecutarAcaoBotao(clique); };
        dono.Controls.Add(b);
        return b;
    }

    async Task<bool> ExecutarAcaoBotao(Func<Task> clique)
    {
        var telaAnterior = _cartao;
        if (telaAnterior == null || telaAnterior.IsDisposed) return false;
        telaAnterior.Enabled = false;
        Cursor = Cursors.WaitCursor;
        MostrarAguarde();
        try { await clique(); return true; }
        catch (Exception e)
        {
            Alertar(e is ApiException ? e.Message : "Ocorreu um erro. Por favor, procure a recepção.");
            Program.Log("erro: " + e);
            return false;
        }
        finally
        {
            if (!telaAnterior.IsDisposed) telaAnterior.Enabled = true;
            if (_cartao != null && !_cartao.IsDisposed) _cartao.Enabled = true;
            OcultarAguarde();
            Cursor = Cursors.Default;
        }
    }

    void MostrarAguarde()
    {
        if (_autoteste != null || _aguarde != null) return;
        _aguarde = new Cartao
        {
            Bounds = new Rectangle((ClientSize.Width - P(420)) / 2, (ClientSize.Height - P(92)) / 2, P(420), P(92)),
            Padding = new Padding(P(24)),
            AccessibleRole = AccessibleRole.StatusBar,
            AccessibleName = "Aguarde. Processando sua solicitação.",
        };
        _aguarde.Controls.Add(new Label
        {
            Text = "Aguarde…",
            Dock = DockStyle.Fill,
            AutoSize = false,
            TextAlign = ContentAlignment.MiddleCenter,
            Font = F(21, false, FontStyle.Bold),
            ForeColor = Estilo.Texto,
            BackColor = Color.Transparent,
        });
        Controls.Add(_aguarde);
        _aguarde.BringToFront();
    }

    void OcultarAguarde()
    {
        if (_aguarde == null) return;
        Controls.Remove(_aguarde);
        _aguarde.Dispose();
        _aguarde = null;
    }

    Marcador Marca(Control dono, string texto, float x, float y, bool marcado, float altura = 34)
    {
        var m = new Marcador(texto, marcado) { Font = F(18), Location = new Point(P(x), P(y)) };
        m.Height = P(altura);
        m.Width = P(30) + TextRenderer.MeasureText(texto, m.Font).Width + P(8);
        dono.Controls.Add(m);
        return m;
    }

    void Alertar(string msg)
    {
        if (_autoteste != null) { _alertasNoAutoteste++; Program.Log("alerta: " + msg); return; }
        var etapa = _tela == "baterias" ? 3 : _tela == "ident" ? 1 : 2;
        Alerta.Mostrar(this, msg, etapa);
    }

    static void Mascarar(TextBox t, Func<string, string> f)
    {
        var mexendo = false;
        t.TextChanged += (_, _) =>
        {
            if (mexendo) return;
            mexendo = true;
            var novo = f(t.Text);
            if (novo != t.Text) { t.Text = novo; t.SelectionStart = novo.Length; }
            mexendo = false;
        };
    }

    // ------------------------------------------------------------------ 1. identificacao

    void Reiniciar()
    {
        _fim.Stop();
        foreach (var f in OwnedForms) f.Close();
        _ident = ""; _menor = false; _cliente = null; _token = null; _dependentes = []; _participantes = []; _eu = true; _sel = [];
        TelaIdent();
    }

    void TelaIdent()
    {
        var c = NovaTela(etapa: 1);
        c.Controls.Add(Rot("Seja bem-vindo(a)!", 190, 172, F(56, false, FontStyle.Bold), Estilo.Texto, 986, 66));
        // a mensagem padrão do servidor já é "Seja bem-vindo(a) ao ..."; só mostra se for um texto personalizado
        var mensagem = _cfg.S("mensagem").Trim();
        if (mensagem.StartsWith("Seja bem-vindo", StringComparison.OrdinalIgnoreCase)) mensagem = "";
        if (mensagem.Length > 0) mensagem += " ";
        c.Controls.Add(Rot(mensagem + "Digite seu CPF, RG, passaporte ou e-mail para reservar a bateria. Se já correu aqui, seus dados aparecem sozinhos.", 190, 245, F(21), Estilo.Suave, 986, 62));
        c.Controls.Add(Rot("CPF, RG, passaporte ou e-mail", 190, 340, F(16, false, FontStyle.Bold), Estilo.Suave));
        Pilula go = null;
        var campo = new CampoTexto { Bounds = new Rectangle(P(190), P(368), P(986), P(82)), Tag = "foco", Padding = new Padding(P(24), 0, P(20), 0) };
        campo.Caixa.Font = Estilo.Mono(P(32), FontStyle.Bold);
        campo.Caixa.PlaceholderText = "Digite seu documento ou e-mail pelo teclado USB";
        campo.Text = _ident;
        System.Windows.Forms.Timer tAutoGo = null;
        campo.Caixa.TextChanged += (_, _) =>
        {
            _ident = campo.Text;
            var d = Fmt.Digitos(_ident);
            if (d.Length == 11 && Fmt.CpfValido(d))
            {
                tAutoGo?.Stop();
                tAutoGo?.Dispose();
                tAutoGo = new System.Windows.Forms.Timer { Interval = 200 };
                tAutoGo.Tick += (_, _) =>
                {
                    tAutoGo.Stop();
                    tAutoGo.Dispose();
                    tAutoGo = null;
                    if (!IsDisposed && campo.Text.Trim().Length >= 11)
                    {
                        go?.Clicar();
                    }
                };
                tAutoGo.Start();
            }
        };
        c.Controls.Add(campo);
        c.Controls.Add(Rot("Use o teclado USB do totem e pressione Enter para continuar.", 194, 458, F(15), Estilo.MuitoSuave, 980, 24));

        var aviso = CartaoEm(c, 190, 498, 986, 78);
        var menor = Marca(aviso, "Sou responsável por menor de idade", 20, 12, _menor, 32);
        aviso.Controls.Add(Rot("Você se identifica e escolhe quem vai correr.", 58, 45, F(15), Estilo.Suave));

        async Task Ir()
        {
            _ident = campo.Text.Trim(); _menor = menor.Marcado;
            if (_ident.Length < 5) { Alertar("Informe o CPF, RG, passaporte ou e-mail."); return; }
            var r = await _api.PostAsync("/api/totem/identificar", new { identificador = _ident });
            if (r?["cliente"] is not JsonObject cli) { TelaCadastro(false); return; }
            if (cli.B("bloqueado")) { Alertar("Seu cadastro precisa de atenção. Por favor, procure a recepção."); return; }
            _cliente = cli; _token = r.S("token");
            _dependentes = r["dependentes"] is JsonArray a ? a.OfType<JsonObject>().Select(d => new Pessoa(d.L("id") ?? 0, d.S("nome"), d.S("nascimento"), d.S("token"))).ToList() : [];
            TelaCadastro(true);
        }
        go = Botao(c, "Próximo", 190, 608, 220, true, Ir, 68, 21);
        campo.Caixa.KeyDown += (_, e) => { if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; go.Clicar(); } };
        Mostrar("ident", c, TelaIdent);
    }

    async Task PosClienteAsync()
    {
        if (_menor) { TelaMenores(); return; }
        _participantes = [new Pessoa(_cliente.L("id") ?? 0, _cliente.S("nome"), "", _token)];
        await TelaGrupos();
    }

    // ------------------------------------------------------------------ 2. cadastro novo / atualizacao

    void TelaCadastro(bool existente)
    {
        _cadastroExistente = existente;
        var email = _cliente.S("email").Length > 0 ? _cliente.S("email") : (_ident.Contains('@') ? _ident : "");
        var doc = _cliente.S("documento").Length > 0 ? _cliente.S("documento") : (_ident.Contains('@') ? "" : _ident);
        var tipoCliente = _cliente.S("tipoDocumento").ToUpperInvariant();
        var tipoIni = tipoCliente switch
        {
            "RG" => "RG",
            "PASSAPORTE" => "Passaporte",
            _ => (doc.Length == 0 || Fmt.Digitos(doc).Length == 11 && Fmt.Digitos(doc) == doc.Replace(".", "").Replace("-", "") ? "CPF" : "RG")
        };
        var sub = existente
            ? $"Olá, {_cliente.S("nome").Split(' ')[0]}! Confira seus dados e suba na balança ao lado para atualizar seu peso."
            : "Primeira vez aqui. Preencha todos os campos com * (suba na balança ao lado para o peso).";
        var c = NovaTela(etapa: 2);
        c.Controls.Add(Rot(existente ? "Confira seus dados" : "Registre-se para continuar", 90, 108, F(44, false, FontStyle.Bold), Estilo.Texto));
        var lSub = Rot(sub, 90, 163, F(19), Estilo.Suave);
        c.Controls.Add(lSub);
        var campos = CartaoEm(c, 90, 204, 1186, 414);
        float[] xs = [24, 312, 600, 888];
        const float cw = 274;
        var reg = Lista(campos, "Tipo de Registro", xs[0], 36, cw, "Pessoa Física", "Pessoa Jurídica");
        var tipo = Lista(campos, "Tipo de Documento", xs[1], 36, cw, "CPF", "RG", "Passaporte");
        tipo.SelectedIndex = tipoIni switch { "Passaporte" => 2, "RG" => 1, _ => 0 };
        var docVal = tipo.SelectedIndex == 0 ? Fmt.MascaraCpf(doc) : doc;
        var fDoc = Campo(campos, "CPF", xs[2], 36, cw, docVal, !existente && doc.Length == 0);
        var lDoc = campos.Controls.OfType<Label>().Last(l => l.Text == "CPF");
        lDoc.Text = tipo.Text;
        var fNome = Campo(campos, "Nome completo", xs[3], 36, cw, _cliente.S("nome"), !existente && doc.Length > 0);
        var fEmail = Campo(campos, "E-mail", xs[0], 132, cw, email);
        var fFone = Campo(campos, "Celular (WhatsApp)", xs[1], 132, cw, Fmt.MascaraFone(_cliente.S("telefone")));
        var nascIni = _cliente.S("nascimento").Length >= 10 ? Fmt.Dmy(_cliente.S("nascimento")) : "";
        var fNasc = Campo(campos, "Data de nascimento", xs[2], 132, cw, nascIni);
        var fPeso = Campo(campos, "Peso (kg)", xs[3], 132, cw, _cliente.S("peso"), existente);
        var fCep = Campo(campos, "CEP", xs[0], 228, cw, Fmt.MascaraCep(_cliente.S("cep")));
        var fEnd = Campo(campos, "Endereço", xs[1], 228, cw, _cliente.S("endereco"));
        var fBairro = Campo(campos, "Bairro", xs[2], 228, cw, _cliente.S("bairro"));
        var fCidade = Campo(campos, "Cidade", xs[3], 228, cw, _cliente.S("cidade"));
        var fInstagram = Campo(campos, "Instagram do piloto (@usuário)", xs[0], 324, cw * 2 + 16, _cliente.S("instagram"));
        fInstagram.Caixa.PlaceholderText = "@andre.silva";
        // obrigatórios (pedido do dono em 10/10/2026): cliente NOVO preenche tudo — documento, nome, e-mail, celular,
        // nascimento, peso e endereço (endereço, bairro, cidade); o CEP é opcional (só ajuda a preencher o endereço).
        // Cliente que JÁ tem cadastro pode atualizar o que quiser, mas tem que completar o que estiver faltando.
        var obrigatorios = new List<(CampoTexto Campo, string Rotulo)>();
        void Obrigatorio(CampoTexto campo, string rotulo, bool exigir)
        {
            if (!exigir) return;
            obrigatorios.Add((campo, rotulo));
            var l = campos.Controls.OfType<Label>().FirstOrDefault(x => x.Text == rotulo);
            if (l != null) l.Text += " *";
        }
        bool Falta(string chave) => !existente || _cliente.S(chave).Trim().Length == 0;
        if (!existente) lDoc.Text += " *";
        Obrigatorio(fNome, "Nome completo", !existente);
        Obrigatorio(fEmail, "E-mail", true);
        Obrigatorio(fFone, "Celular (WhatsApp)", Falta("telefone"));
        Obrigatorio(fNasc, "Data de nascimento", !existente || !_cliente.B("temNascimento"));
        Obrigatorio(fPeso, "Peso (kg)", true);
        Obrigatorio(fInstagram, "Instagram do piloto (@usuário)", true);
        Obrigatorio(fEnd, "Endereço", Falta("endereco"));
        Obrigatorio(fBairro, "Bairro", Falta("bairro"));
        Obrigatorio(fCidade, "Cidade", Falta("cidade"));
        c.Controls.Add(Rot("* Campos obrigatórios · Instagram será usado no resultado e no pódio", 90, 624, F(14), Estilo.MuitoSuave));
        if (existente)
        {
            reg.Enabled = tipo.Enabled = fDoc.Enabled = fNome.Enabled = false;
            if (fDoc.Text.Length == 0) fDoc.Text = "(já cadastrado)";
        }
        fNasc.Caixa.PlaceholderText = "DD/MM/AAAA";
        string uf = _cliente.S("estado");
        tipo.SelectedIndexChanged += (_, _) => { lDoc.Text = tipo.Text + (!existente ? " *" : ""); if (tipo.SelectedIndex == 0) fDoc.Text = Fmt.MascaraCpf(fDoc.Text); };
        Mascarar(fDoc.Caixa, v => !existente && tipo.SelectedIndex == 0 ? Fmt.MascaraCpf(v) : v);
        Mascarar(fFone.Caixa, Fmt.MascaraFone);
        Mascarar(fNasc.Caixa, Fmt.MascaraData);
        Mascarar(fCep.Caixa, Fmt.MascaraCep);
        Mascarar(fPeso.Caixa, v => new string(v.Where(ch => char.IsDigit(ch) || ch is ',' or '.').Take(5).ToArray()));
        fCep.Caixa.TextChanged += async (_, _) =>
        {
            var cep = Fmt.Digitos(fCep.Text);
            if (cep.Length != 8 || !_cfg.B("consultarCep")) return;
            var r = await ViaCep(cep);
            if (r == null) return;
            if (fEnd.Text.Length == 0) fEnd.Text = r.S("logradouro");
            if (fBairro.Text.Length == 0) fBairro.Text = r.S("bairro");
            if (fCidade.Text.Length == 0) fCidade.Text = r.S("localidade");
            uf = r.S("uf");
        };

        var lgpd = Marca(c, "Li e concordo com o *", 90, 659, existente && _cliente.B("lgpd"), 34);
        var link = new LinkLabel
        {
            Text = "Termo de Consentimento para Tratamento de Dados Pessoais", Font = F(16), AutoSize = true, BackColor = Color.Transparent,
            LinkColor = Estilo.Texto, ActiveLinkColor = Estilo.Suave, VisitedLinkColor = Estilo.Texto, LinkBehavior = LinkBehavior.AlwaysUnderline,
        };
        link.Location = new Point(lgpd.Right + P(8), lgpd.Top + (lgpd.Height - link.PreferredHeight) / 2);
        link.LinkClicked += (_, _) => TermoLgpd();
        c.Controls.Add(link);

        bool identificandoAuto = false;
        async Task TentarIdentificarAutoAsync(string termo)
        {
            if (existente || identificandoAuto || string.IsNullOrWhiteSpace(termo)) return;
            var t = termo.Trim();
            if (t.Length < 5) return;
            identificandoAuto = true;
            try
            {
                var r = await _api.PostAsync("/api/totem/identificar", new { identificador = t });
                if (r?["cliente"] is JsonObject cli && cli.L("id") is long id && id > 0)
                {
                    if (cli.B("bloqueado"))
                    {
                        Alertar("Seu cadastro precisa de atenção. Por favor, procure a recepção.");
                        return;
                    }
                    _cliente = cli;
                    _token = r.S("token") is { Length: > 0 } tok ? tok : _token;
                    _dependentes = r["dependentes"] is JsonArray a
                        ? a.OfType<JsonObject>().Select(d => new Pessoa(d.L("id") ?? 0, d.S("nome"), d.S("nascimento"), d.S("token"))).ToList()
                        : [];
                    existente = true;
                    _cadastroExistente = true;

                    var cliDoc = cli.S("documento");
                    if (!string.IsNullOrEmpty(cliDoc))
                        fDoc.Text = tipo.SelectedIndex == 0 ? Fmt.MascaraCpf(cliDoc) : cliDoc;
                    fNome.Text = cli.S("nome");
                    fEmail.Text = cli.S("email");
                    fFone.Text = Fmt.MascaraFone(cli.S("telefone"));
                    if (cli.S("nascimento").Length >= 10) fNasc.Text = Fmt.Dmy(cli.S("nascimento"));
                    if (cli.S("peso").Length > 0) fPeso.Text = cli.S("peso");
                    if (cli.S("cep").Length > 0) fCep.Text = Fmt.MascaraCep(cli.S("cep"));
                    if (cli.S("endereco").Length > 0) fEnd.Text = cli.S("endereco");
                    if (cli.S("bairro").Length > 0) fBairro.Text = cli.S("bairro");
                    if (cli.S("cidade").Length > 0) fCidade.Text = cli.S("cidade");
                    if (cli.S("instagram").Length > 0) fInstagram.Text = cli.S("instagram");
                    if (cli.S("estado").Length > 0) uf = cli.S("estado");
                    if (cli.B("lgpd")) lgpd.Marcado = true;

                    reg.Enabled = tipo.Enabled = fDoc.Enabled = fNome.Enabled = false;
                    var primeiroNome = cli.S("nome").Split(' ')[0];
                    lSub.Text = $"Cadastro localizado! Olá, {primeiroNome}! Confira seus dados e suba na balança ao lado para atualizar seu peso.";
                    lSub.ForeColor = Estilo.Verde;
                    fPeso.Caixa.Focus();
                }
            }
            catch (Exception ex)
            {
                Program.Log("auto-identificar: " + ex.Message);
            }
            finally
            {
                identificandoAuto = false;
            }
        }

        fDoc.Caixa.TextChanged += (_, _) =>
        {
            if (existente) return;
            var d = Fmt.Digitos(fDoc.Text);
            if (tipo.SelectedIndex == 0 && d.Length == 11 && Fmt.CpfValido(d))
            {
                _ = TentarIdentificarAutoAsync(d);
            }
        };
        fDoc.Caixa.Leave += (_, _) =>
        {
            if (existente) return;
            var d = Fmt.Digitos(fDoc.Text);
            var t = (tipo.SelectedIndex == 0 && d.Length == 11) ? d : fDoc.Text.Trim();
            if (t.Length >= 5) _ = TentarIdentificarAutoAsync(t);
        };
        fEmail.Caixa.Leave += (_, _) =>
        {
            if (existente) return;
            var em = fEmail.Text.Trim();
            if (em.Contains('@') && em.Contains('.')) _ = TentarIdentificarAutoAsync(em);
        };
        fFone.Caixa.Leave += (_, _) =>
        {
            if (existente) return;
            var fn = Fmt.Digitos(fFone.Text);
            if (fn.Length >= 10) _ = TentarIdentificarAutoAsync(fn);
        };

        Botao(c, "Voltar", 958, 644, 140, false, () => { Reiniciar(); return Task.CompletedTask; });
        Botao(c, "Próximo", 1112, 644, 164, true, async () =>
        {
            var nascTxt = fNasc.Text.Trim();
            var nasc = nascTxt.Length > 0 ? Fmt.DataBrParaIso(nascTxt) : "";
            if (nasc != "" && Fmt.ParseData(nasc) is { } dn && (dn > DateTime.Today || dn.Year < 1900)) nasc = null;
            var dados = new JsonObject
            {
                ["email"] = fEmail.Text.Trim(), ["instagram"] = ValidacaoCliente.NormalizarInstagram(fInstagram.Text), ["telefone"] = fFone.Text.Trim(), ["nascimento"] = nasc ?? "",
                ["peso"] = fPeso.Text.Trim(), ["cep"] = fCep.Text.Trim(), ["endereco"] = fEnd.Text.Trim(),
                ["bairro"] = fBairro.Text.Trim(), ["cidade"] = fCidade.Text.Trim(), ["estado"] = uf,
            };
            if (!existente)
            {
                var tipoDoc = tipo.SelectedIndex switch { 0 => "CPF", 1 => "RG", _ => "PASSAPORTE" };
                var nome = string.Join(' ', fNome.Text.Split(' ', StringSplitOptions.RemoveEmptyEntries));
                if (fDoc.Text.Trim().Length == 0) { Alertar("O documento é obrigatório."); return; }
                if (tipoDoc == "CPF" && !Fmt.CpfValido(fDoc.Text)) { Alertar("CPF inválido."); return; }
                if (nome.Split(' ').Length < 2) { Alertar("Informe o nome completo."); return; }
                if (Fmt.Digitos(fFone.Text).Length < 10) { Alertar("O número de telefone é obrigatório."); return; }
                dados["tipoDocumento"] = tipoDoc; dados["documento"] = fDoc.Text.Trim(); dados["nome"] = nome;
            }
            foreach (var (campoObrig, rotuloObrig) in obrigatorios)
                if (campoObrig.Text.Trim().Length == 0 && campoObrig != fNasc) { Alertar($"Preencha o campo {rotuloObrig}."); campoObrig.Caixa.Focus(); return; }
            if (ValidacaoCliente.ErroInstagram(fInstagram.Text) is string erroInstagram) { Alertar(erroInstagram); fInstagram.Caixa.Focus(); return; }
            var pesoTxt = fPeso.Text.Trim().Replace(',', '.');
            if (pesoTxt.Length > 0 && (!double.TryParse(pesoTxt, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var kg) || kg < 20 || kg > 250))
            { Alertar("Peso inválido. Suba na balança ao lado e digite o peso em kg (ex.: 78,5)."); fPeso.Caixa.Focus(); return; }
            if (nasc == null) { Alertar("Data de nascimento inválida."); return; }
            if (nasc == "" && (!existente || !_cliente.B("temNascimento"))) { Alertar("A data de nascimento é obrigatória."); return; }
            var em = fEmail.Text.Trim();
            if (ValidacaoCliente.ErroEmail(em) is string erroEmail) { Alertar(erroEmail); fEmail.Caixa.Focus(); return; }
            if (fFone.Text.Trim().Length > 0 && Fmt.Digitos(fFone.Text).Length < 10) { Alertar("Número de telefone inválido."); return; }
            if (!lgpd.Marcado) { Alertar("É necessário aceitar o Termo de Consentimento para Tratamento de Dados Pessoais."); return; }
            if (existente)
            {
                var r = await _api.PostAsync("/api/totem/cadastro", new JsonObject { ["id"] = _cliente.L("id"), ["token"] = _token, ["dados"] = dados, ["lgpd"] = true });
                _token = r.S("token") is { Length: > 0 } t ? t : _token;
                _cliente["lgpd"] = true;
                if (nasc != "") _cliente["temNascimento"] = true;
                MesclarDadosCliente(dados);
            }
            else
            {
                var r = await _api.PostAsync("/api/totem/cadastro", new JsonObject { ["dados"] = dados, ["lgpd"] = true });
                _cliente = new JsonObject { ["id"] = r.L("id"), ["nome"] = dados.S("nome"), ["lgpd"] = true, ["temNascimento"] = true };
                MesclarDadosCliente(dados);
                _token = r.S("token"); _dependentes = [];
            }
            await PosClienteAsync();
        });
        Mostrar("cadastro", c, () => TelaCadastro(existente));
    }

    void MesclarDadosCliente(JsonObject dados)
    {
        foreach (var item in dados)
            _cliente[item.Key] = item.Value?.DeepClone();
    }

    static readonly HttpClient _httpCep = new() { Timeout = TimeSpan.FromSeconds(4) };

    static async Task<JsonObject> ViaCep(string cep, CancellationToken ct = default)
    {
        try
        {
            var json = await _httpCep.GetStringAsync($"https://viacep.com.br/ws/{cep}/json/", ct).ConfigureAwait(false);
            var r = JsonNode.Parse(json) as JsonObject;
            return r == null || r.B("erro") ? null : r;
        }
        catch { return null; } // sem internet: segue manual
    }

    Form CriarTermoLgpd()
    {
        var f = new Form { FormBorderStyle = FormBorderStyle.None, StartPosition = FormStartPosition.CenterParent, ShowInTaskbar = false, TopMost = true, BackColor = Estilo.Fundo, ClientSize = new Size(P(1366), P(768)), KeyPreview = true };
        var tela = NovaTela(etapa: 2);
        f.Controls.Add(tela);
        var cabecalho = new CabecalhoTotem(Estilo.Logo(), 2, _k, donoDaLogo: true)
        {
            Bounds = new Rectangle(0, 0, f.ClientSize.Width, P(88))
        };
        tela.Controls.Add(cabecalho);
        cabecalho.BringToFront();
        var c = CartaoEm(tela, 253, 172, 860, 494);
        c.Controls.Add(Rot("Termo de Consentimento para Tratamento de Dados Pessoais", 36, 34, F(30, false, FontStyle.Bold), Estilo.Texto, 760, 74));
        var empresa = _cfg.S("empresa");
        c.Controls.Add(Rot($"Ao se cadastrar, você autoriza o {empresa} a tratar seus dados pessoais (nome, documento, contato, data de nascimento, peso e endereço) para identificar você nas baterias e corridas, emitir o termo de responsabilidade, registrar tempos e resultados, cumprir obrigações legais e entrar em contato sobre suas reservas.", 36, 126, F(18), Estilo.Texto, 760, 125));
        c.Controls.Add(Rot("Os dados ficam armazenados nos sistemas do kartódromo e não são vendidos a terceiros. Você pode pedir a qualquer momento, na recepção, acesso, correção ou exclusão dos seus dados, nos termos da Lei nº 13.709/2018 (LGPD).", 36, 274, F(18), Estilo.Suave, 760, 112));
        var ok = new Pilula("Fechar", true) { Bounds = new Rectangle(P(860 - 36 - 160), P(494 - 36 - 58), P(160), P(58)), Font = F(18, false, FontStyle.Bold) };
        ok.Click += (_, _) => f.Close();
        c.Controls.Add(ok);
        f.KeyDown += (_, e) => { if (e.KeyCode == Keys.Escape) f.Close(); };
        return f;
    }

    void TermoLgpd()
    {
        using var f = CriarTermoLgpd();
        f.ShowDialog(this);
    }

    // ------------------------------------------------------------------ 3. menores

    void TelaMenores()
    {
        var c = NovaTela(etapa: 2);
        c.Controls.Add(Rot("Quem vai participar?", 150, 110, F(44, false, FontStyle.Bold), Estilo.Texto));
        c.Controls.Add(Rot("Selecione os menores de idade que irão participar.", 150, 165, F(19), Estilo.Suave));
        var painel = CartaoEm(c, 150, 212, 1066, 365);
        var idCli = _cliente.L("id") ?? 0;
        var marcados = _participantes.Where(p => p.Id != idCli).Select(p => p.Id).ToHashSet();
        var lista = new ListaOpcoes(_k) { Bounds = new Rectangle(P(24), P(22), P(1018), P(265)) };
        foreach (var d in _dependentes)
            lista.Adicionar(new OpcaoLinha(_k) { Height = P(72), Id = d.Id, Linha1 = d.Nome, Linha2 = d.Nascimento.Length >= 10 ? "Nascimento: " + Fmt.Dmy(d.Nascimento) : "", Direita = Fmt.Idade(d.Nascimento) is int i ? $"{i} anos" : "", Marcado = marcados.Contains(d.Id) });
        if (_dependentes.Count == 0) lista.Vazio("Nenhum menor cadastrado no seu nome. Toque em \"Cadastrar menor\".");
        painel.Controls.Add(lista);
        var eu = Marca(c, "Eu também vou participar", 150, 600, _eu && (_participantes.Count == 0 || _participantes.Any(p => p.Id == idCli)), 36);
        Botao(c, "Cadastrar menor", 150, 660, 205, false, () => { TelaCadastroMenor(); return Task.CompletedTask; });
        Botao(c, "Voltar", 914, 660, 140, false, () => { TelaCadastro(_cadastroExistente); return Task.CompletedTask; });
        Botao(c, "Próximo", 1070, 660, 146, true, () =>
        {
            _eu = eu.Marcado;
            var ids = lista.Marcados().ToHashSet();
            _participantes = [.. _eu ? [new Pessoa(idCli, _cliente.S("nome"), "", _token)] : Array.Empty<Pessoa>(), .. _dependentes.Where(d => ids.Contains(d.Id))];
            if (_participantes.Count == 0) { Alertar("Selecione pelo menos um participante."); return Task.CompletedTask; }
            return TelaBaterias();
        });
        Mostrar("menores", c, TelaMenores);
    }

    void TelaCadastroMenor()
    {
        // 13/10/2026 (dono): o menor tem os MESMOS campos e obrigatórios do cadastro novo de adulto — documento, nome,
        // e-mail, celular, nascimento, peso, endereço, bairro, cidade e Instagram (CEP opcional). Contato e endereço
        // já vêm do responsável (pode trocar); o peso é sempre o do menor, na balança.
        var c = NovaTela(etapa: 2);
        c.Controls.Add(Rot("Cadastre quem vai correr", 90, 108, F(44, false, FontStyle.Bold), Estilo.Texto));
        c.Controls.Add(Rot("Dados do menor de idade. Preencha todos os campos com * (suba com ele na balança ao lado para o peso).", 90, 163, F(19), Estilo.Suave));
        var campos = CartaoEm(c, 90, 204, 1186, 414);
        float[] xs = [24, 312, 600, 888];
        const float cw = 274;
        var tipo = Lista(campos, "Tipo de Documento", xs[0], 36, cw, "CPF", "RG", "Passaporte");
        var doc = Campo(campos, "CPF *", xs[1], 36, cw);
        var lDoc = campos.Controls.OfType<Label>().Last(l => l.Text == "CPF *");
        var nome = Campo(campos, "Nome completo do menor *", xs[2], 36, cw * 2 + 14, "", true);
        var email = Campo(campos, "E-mail *", xs[0], 132, cw, _cliente.S("email"));
        var fone = Campo(campos, "Celular (WhatsApp) *", xs[1], 132, cw, Fmt.MascaraFone(_cliente.S("telefone")));
        var nasc = Campo(campos, "Data de nascimento *", xs[2], 132, cw);
        nasc.Caixa.PlaceholderText = "DD/MM/AAAA";
        var peso = Campo(campos, "Peso (kg) *", xs[3], 132, cw);   // obrigatório (10/10/2026): o peso equilibra os karts (lastro)
        var cep = Campo(campos, "CEP", xs[0], 228, cw, Fmt.MascaraCep(_cliente.S("cep")));
        var end = Campo(campos, "Endereço *", xs[1], 228, cw, _cliente.S("endereco"));
        var bairro = Campo(campos, "Bairro *", xs[2], 228, cw, _cliente.S("bairro"));
        var cidade = Campo(campos, "Cidade *", xs[3], 228, cw, _cliente.S("cidade"));
        var instagram = Campo(campos, "Instagram do piloto (@usuário) *", xs[0], 324, cw * 2 + 16);
        instagram.Caixa.PlaceholderText = "@usuario";
        c.Controls.Add(Rot("* Campos obrigatórios · contato e endereço do responsável já vêm preenchidos", 90, 624, F(14), Estilo.MuitoSuave));
        string uf = _cliente.S("estado");
        tipo.SelectedIndexChanged += (_, _) => { lDoc.Text = tipo.Text + " *"; if (tipo.SelectedIndex == 0) doc.Text = Fmt.MascaraCpf(doc.Text); };
        Mascarar(doc.Caixa, v => tipo.SelectedIndex == 0 ? Fmt.MascaraCpf(v) : v);
        Mascarar(fone.Caixa, Fmt.MascaraFone);
        Mascarar(nasc.Caixa, Fmt.MascaraData);
        Mascarar(cep.Caixa, Fmt.MascaraCep);
        Mascarar(peso.Caixa, v => new string(v.Where(ch => char.IsDigit(ch) || ch is ',' or '.').Take(5).ToArray()));
        cep.Caixa.TextChanged += async (_, _) =>
        {
            var digitos = Fmt.Digitos(cep.Text);
            if (digitos.Length != 8 || !_cfg.B("consultarCep")) return;
            var r = await ViaCep(digitos);
            if (r == null) return;
            if (end.Text.Length == 0) end.Text = r.S("logradouro");
            if (bairro.Text.Length == 0) bairro.Text = r.S("bairro");
            if (cidade.Text.Length == 0) cidade.Text = r.S("localidade");
            uf = r.S("uf");
        };
        var voltar = Botao(c, "Voltar", 958, 644, 140, false, () => { TelaMenores(); return Task.CompletedTask; });
        var salvar = Botao(c, "Salvar", 1112, 644, 164, true, async () =>
        {
            var n = string.Join(' ', nome.Text.Split(' ', StringSplitOptions.RemoveEmptyEntries));
            var iso = Fmt.DataBrParaIso(nasc.Text.Trim());
            var tipoDoc = tipo.SelectedIndex switch { 0 => "CPF", 1 => "RG", _ => "PASSAPORTE" };
            if (doc.Text.Trim().Length == 0) { Alertar("O documento do menor é obrigatório."); doc.Caixa.Focus(); return; }
            if (tipoDoc == "CPF" && !Fmt.CpfValido(doc.Text)) { Alertar("CPF inválido."); doc.Caixa.Focus(); return; }
            if (n.Split(' ').Length < 2) { Alertar("Informe o nome completo do menor."); nome.Caixa.Focus(); return; }
            foreach (var (campo, rotulo) in new[] { (email, "E-mail"), (fone, "Celular (WhatsApp)"), (nasc, "Data de nascimento"), (peso, "Peso (kg)"), (end, "Endereço"), (bairro, "Bairro"), (cidade, "Cidade"), (instagram, "Instagram do piloto (@usuário)") })
                if (campo.Text.Trim().Length == 0) { Alertar($"Preencha o campo {rotulo}."); campo.Caixa.Focus(); return; }
            if (ValidacaoCliente.ErroEmail(email.Text) is string erroEmail) { Alertar(erroEmail); email.Caixa.Focus(); return; }
            if (Fmt.Digitos(fone.Text).Length < 10) { Alertar("Número de telefone inválido."); fone.Caixa.Focus(); return; }
            if (string.IsNullOrEmpty(iso) || Fmt.ParseData(iso) is not { } dn || dn > DateTime.Today || dn.Year < 1900) { Alertar("Informe a data de nascimento (DD/MM/AAAA)."); nasc.Caixa.Focus(); return; }
            var pesoTxt = peso.Text.Trim().Replace(',', '.');
            if (!double.TryParse(pesoTxt, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var kg) || kg < 10 || kg > 250)
            { Alertar("Peso inválido. Digite o peso em kg (ex.: 38,5)."); peso.Caixa.Focus(); return; }
            if (ValidacaoCliente.ErroInstagram(instagram.Text) is string erroInstagram) { Alertar(erroInstagram); instagram.Caixa.Focus(); return; }
            var r = await _api.PostAsync("/api/totem/cadastro", new JsonObject
            {
                ["dados"] = new JsonObject
                {
                    ["nome"] = n, ["nascimento"] = iso, ["tipoDocumento"] = tipoDoc, ["documento"] = doc.Text.Trim(), ["peso"] = peso.Text.Trim(),
                    ["email"] = email.Text.Trim(), ["telefone"] = fone.Text.Trim(), ["instagram"] = ValidacaoCliente.NormalizarInstagram(instagram.Text),
                    ["cep"] = cep.Text.Trim(), ["endereco"] = end.Text.Trim(), ["bairro"] = bairro.Text.Trim(), ["cidade"] = cidade.Text.Trim(), ["estado"] = uf,
                },
                ["lgpd"] = true, ["responsavelId"] = _cliente.L("id"), ["responsavelToken"] = _token,
            });
            var p = new Pessoa(r.L("id") ?? 0, n, iso, r.S("token"));
            _dependentes.Add(p);
            _participantes = [.. _participantes.Where(x => x.Id != p.Id), p];
            TelaMenores();
        });
        voltar.BringToFront(); salvar.BringToFront();
        Mostrar("menor", c, TelaCadastroMenor);
    }

    // ------------------------------------------------------------------ 3b. "Vim com um grupo" (antes das baterias)

    async Task TelaGrupos()
    {
        // grupos de hoje com vaga aguardando: o amigo se reconhece pelo nome de quem reservou. Sem grupo (ou falha), segue direto para as baterias.
        List<JsonObject> grupos;
        try { grupos = await _api.ListaAsync("/api/totem/grupos"); }
        catch (Exception ex) { Program.Log("grupos do dia indisponíveis: " + ex.Message); grupos = []; }
        if (grupos.Count == 0) { await TelaBaterias(); return; }
        MontarGrupos(grupos);
    }

    void MontarGrupos(List<JsonObject> grupos)
    {
        var c = NovaTela(etapa: 3);
        c.Controls.Add(Rot("Você veio com um grupo de amigos?", 150, 108, F(44, false, FontStyle.Bold), Estilo.Texto));
        c.Controls.Add(Rot("Toque no grupo dos seus amigos. Quem reservou já pagou a corrida de todos. Se veio sozinho, toque em \"Vim sozinho\".", 150, 164, F(19), Estilo.Suave, 1066, 56));
        var painel = CartaoEm(c, 150, 230, 1066, 411);
        var lista = new ListaOpcoes(_k) { Bounds = new Rectangle(0, 0, P(1066), P(411)) };
        var itens = new List<OpcaoLinha>();
        foreach (var g in grupos)
        {
            var aguardando = g.I("aguardando");
            var item = new OpcaoLinha(_k)
            {
                Height = P(84), Id = g.L("id") ?? 0,
                Linha1 = "GRUPO DO(A) " + g.S("responsavel").ToUpperInvariant(),
                Linha2 = $"Corrida às {Fmt.Hm(g.S("inicio"))} · {g.I("total")} amigos no total",
                Direita = aguardando + (aguardando == 1 ? " vaga esperando" : " vagas esperando"),
            };
            item.Mudou += () => { if (item.Marcado) foreach (var o in itens) if (o != item && o.Marcado) o.Marcado = false; };
            itens.Add(item);
            lista.Adicionar(item);
        }
        painel.Controls.Add(lista);
        var sozinho = Botao(c, "Vim sozinho", 150, 660, 205, false, TelaBaterias);
        var voltar = Botao(c, "Voltar", 914, 660, 140, false, () => { if (_menor) TelaMenores(); else TelaCadastro(_cadastroExistente); return Task.CompletedTask; });
        var entrar = Botao(c, "Entrar no grupo", 1070, 660, 200, true, async () =>
        {
            var escolhido = lista.Marcados().FirstOrDefault();
            if (escolhido == 0) { Alertar("Toque no grupo dos seus amigos ou em \"Vim sozinho\"."); return; }
            JsonNode r;
            try { r = await _api.PostAsync("/api/totem/grupo/entrar", new JsonObject { ["grupoId"] = escolhido, ["clienteId"] = _cliente.L("id"), ["token"] = _token }); }
            catch (Exception ex) { Alertar(ex.Message.Length > 0 ? ex.Message : "Não foi possível entrar no grupo. Procure a recepção."); return; }
            if (r is not JsonObject ok) { Alertar("Não foi possível entrar no grupo. Procure a recepção."); return; }
            _sel = new HashSet<long> { ok.L("bateriaId") ?? 0 };
            TelaBoasVindasGrupo(ok);
        });
        sozinho.BringToFront(); voltar.BringToFront(); entrar.BringToFront();
        Mostrar("grupos", c, () => MontarGrupos(grupos));
    }

    // quem reservou para todos é valorizado: o amigo vê o nome dele(a) antes de continuar
    void TelaBoasVindasGrupo(JsonObject g)
    {
        var c = NovaTela(etapa: 3);
        c.Controls.Add(Rot("Você está no grupo do(a) " + g.S("responsavel") + "!", 150, 130, F(44, false, FontStyle.Bold), Estilo.Texto, 1066, 70));
        var cartao = CartaoEm(c, 150, 250, 1066, 280);
        cartao.Controls.Add(Rot(g.S("mensagem"), 40, 40, F(26, false, FontStyle.Bold), Estilo.VerdeSuave, 986, 110));
        cartao.Controls.Add(Rot($"Sua vaga já está paga · corrida às {Fmt.Hm(g.S("inicio"))}. Que tal agradecer {g.S("responsavel")} pelo convite?", 40, 120, F(20), Estilo.Suave, 986, 80));
        var seguir = Botao(c, "Continuar", 1030, 660, 186, true, async () => { await Inscrever(null); });
        seguir.BringToFront();
        Mostrar("boasvindasgrupo", c, () => TelaBoasVindasGrupo(g));
    }

    // ------------------------------------------------------------------ 4. baterias

    async Task TelaBaterias()
    {
        var grupo = string.Join(",", _participantes.Select(p => $"{p.Id}.{p.Token}"));
        var todas = await _api.ListaAsync("/api/totem/baterias?grupo=" + Uri.EscapeDataString(grupo));
        var n = _participantes.Count;
        var lista = todas.Where(b => b.I("livres") >= n).ToList();
        MontarBaterias(lista, n);
    }

    void MontarBaterias(List<JsonObject> baterias, int n)
    {
        var c = NovaTela(etapa: 3);
        c.Controls.Add(Rot("Escolha sua bateria", 150, 108, F(44, false, FontStyle.Bold), Estilo.Texto));
        c.Controls.Add(Rot("Selecione uma ou mais. A lista mostra as baterias abertas de hoje com vaga." + (n > 1 ? $" ({n} participantes)" : ""), 150, 164, F(19), Estilo.Suave));
        var selecionadas = Rot("Nenhuma selecionada", 1000, 164, F(17, false, FontStyle.Bold), Estilo.VerdeSuave, 216, 28, ContentAlignment.MiddleRight);
        c.Controls.Add(selecionadas);
        Botao(c, "Atualizar", 820, 154, 150, false, TelaBaterias, 42, 16);
        var painel = CartaoEm(c, 150, 215, 1066, 426);
        var lista = new ListaOpcoes(_k) { Bounds = new Rectangle(0, 0, P(1066), P(426)) };
        var totalMarcadas = 0;
        Pilula proximo = null;
        foreach (var b in baterias)
        {
            var inicio = Fmt.Hm(b.S("inicio"));
            var tipoSuper = b.S("tipoKart") == "super";
            var iniciou = DateTime.TryParse(b.S("inicio"), out var horario) && horario <= DateTime.Now;
            var item = new OpcaoLinha(_k)
            {
                Height = P(84), Id = b.L("id") ?? 0, Linha1 = b.S("nome").ToUpperInvariant(),
                Linha2 = iniciou ? $"Horário iniciado às {inicio} · confirme na recepção" : $"Começa às {inicio} · chegue 10 min antes",
                Direita = b.I("livres") + (b.I("livres") == 1 ? " vaga" : " vagas"),
                Tipo = tipoSuper ? "Super Kart" : "Kart Light", Livres = b.I("livres"), Total = b.I("vagas"),
                Marcado = _sel.Contains(b.L("id") ?? 0),
            };
            if (item.Marcado) totalMarcadas++;
            item.Mudou += () =>
            {
                totalMarcadas = lista.Marcados().Count();
                selecionadas.Text = totalMarcadas == 0 ? "Nenhuma selecionada" : totalMarcadas + (totalMarcadas == 1 ? " selecionada" : " selecionadas");
                if (proximo != null) proximo.Enabled = totalMarcadas > 0;
            };
            lista.Adicionar(item);
        }
        selecionadas.Text = totalMarcadas == 0 ? "Nenhuma selecionada" : totalMarcadas + (totalMarcadas == 1 ? " selecionada" : " selecionadas");
        if (baterias.Count == 0) lista.Vazio("Nenhuma bateria com vaga disponível agora.\r\nToque em Atualizar ou procure a recepção.");
        painel.Controls.Add(lista);
        var voltar = Botao(c, "Voltar", 914, 660, 140, false, () => { if (_menor) TelaMenores(); else TelaCadastro(_cadastroExistente); return Task.CompletedTask; });
        proximo = Botao(c, "Próximo", 1070, 660, 146, true, async () =>
        {
            _sel = lista.Marcados().ToHashSet();
            if (_sel.Count == 0) { Alertar("Selecione pelo menos uma bateria."); return; }
            var campeonato = baterias.Where(b => _sel.Contains(b.L("id") ?? 0) && b["endurance"] is JsonObject).ToList();
            if (campeonato.Count > 1) { Alertar("Escolha só uma bateria de campeonato por vez."); return; }
            if (campeonato.Count == 1) await TelaEquipe(campeonato[0], baterias, n);
            else await Inscrever(null);
        });
        proximo.Enabled = totalMarcadas > 0;
        voltar.BringToFront(); proximo.BringToFront();
        Mostrar("baterias", c, () => MontarBaterias(baterias, n));
    }

    string ObterImpressoraTotem() => Relatorio.ObterImpressoraTermoTotem(Config.Impressora);

    DateTime _ultimaChecagemUpdate = DateTime.MinValue;
    async Task VerificarAtualizacaoOciosoAsync()
    {
        if (DateTime.UtcNow - _ultimaChecagemUpdate < TimeSpan.FromMinutes(3)) return;
        _ultimaChecagemUpdate = DateTime.UtcNow;
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
            var json = await http.GetStringAsync($"{Config.ServidorUrl}/updates/Autoatendimento/manifest.json");
            var manifesto = System.Text.Json.JsonSerializer.Deserialize<ManifestoDesktop>(json);
            if (Atualizacao.DeveAtualizar(Application.ProductVersion.Split('+')[0], "Autoatendimento", manifesto))
            {
                Program.Log($"Nova versão {manifesto.Version} encontrada para Autoatendimento. Reiniciando para atualizar...");
                var exe = Environment.ProcessPath;
                if (!string.IsNullOrEmpty(exe) && File.Exists(exe))
                {
                    _liberadoFechar = true;
                    Process.Start(new ProcessStartInfo(exe) { UseShellExecute = true, WorkingDirectory = AppContext.BaseDirectory });
                    Application.Exit();
                }
            }
        }
        catch { }
    }

    async Task Inscrever(JsonObject endurance)
    {
        var impressora = ObterImpressoraTotem();
        var corpo = new JsonObject
        {
            ["impressaoLocal"] = !string.IsNullOrWhiteSpace(impressora),
            ["bateriaIds"] = new JsonArray(_sel.Select(x => (JsonNode)x).ToArray()),
            ["participantes"] = new JsonArray(_participantes.Select(p => (JsonNode)new JsonObject { ["id"] = p.Id, ["token"] = p.Token }).ToArray()),
        };
        if (endurance != null) corpo["endurance"] = endurance;
        var r = await _api.PostAsync("/api/totem/inscrever", corpo);
        var qtd = r?["inscricoes"] is JsonArray ins ? ins.Count : 1;
        var pulseiras = r?["pulseiras"] is JsonArray pul ? pul.OfType<JsonObject>().ToList() : [];
        TelaSucesso(Fmt.Hm(r.S("inicio")), qtd, pulseiras);
        // A impressora configurada nesta máquina recebe um trabalho por participante.
        if (r["termoNaRecepcao"]?.GetValue<bool>() == true) Program.Log("termo enviado para a impressora da recepção");
        else
        {
            var termos = r["termoUrls"] is JsonArray urls
                ? urls.Select(u => u.GetValue<string>()).ToArray()
                : r.S("termoUrl") is { Length: > 0 } termo ? new[] { termo } : Array.Empty<string>();
            if (termos.Length > 0) _ = Task.Run(() => Imprimir(termos));
        }
    }

    async Task TelaEquipe(JsonObject bateria, List<JsonObject> baterias, int n)
    {
        var info = await _api.GetAsync("/api/totem/endurance?bateria=" + (bateria.L("id") ?? 0));
        var equipes = info?["equipes"] is JsonArray eqs ? eqs.OfType<JsonObject>().ToList() : [];
        var c = NovaTela(etapa: 3);
        c.Controls.Add(Rot("Escolha onde vai correr", 150, 108, F(44, false, FontStyle.Bold), Estilo.Texto));
        c.Controls.Add(Rot($"Marque uma ou mais inscrições da mesma família. Até {info.I("maxPilotos")} pilotos por inscrição. Kart pelo sorteio.", 150, 164, F(18), Estilo.Suave));
        var painel = CartaoEm(c, 150, 215, 1066, 426);
        var lista = new ListaOpcoes(_k) { Bounds = new Rectangle(0, 0, P(1066), P(426)) };
        foreach (var q in equipes)
        {
            var vagas = q.I("vagas");
            lista.Adicionar(new OpcaoLinha(_k)
            {
                Height = P(84), Id = q.L("id") ?? 0, Linha1 = q.S("nome").ToUpperInvariant(),
                Linha2 = $"{q.I("pilotos")} piloto(s) inscrito(s)",
                Direita = vagas == 0 ? "completa" : vagas + (vagas == 1 ? " vaga" : " vagas"),
                Livres = vagas, Total = info.I("maxPilotos"),
            });
        }
        if (equipes.Count == 0) lista.Vazio("Nenhuma equipe cadastrada para este campeonato.\r\nProcure a recepção.");
        painel.Controls.Add(lista);
        var voltar = Botao(c, "Voltar", 914, 660, 140, false, () => { MontarBaterias(baterias, n); return Task.CompletedTask; });
        var confirmar = Botao(c, "Confirmar", 1070, 660, 146, true, async () =>
        {
            var marcadas = lista.Marcados().ToList();
            if (marcadas.Count == 0) { Alertar("Marque pelo menos uma inscrição da equipe."); return; }
            var familias = equipes.Where(q => marcadas.Contains(q.L("id") ?? 0))
                .Select(q => q.L("grupoId") is { } g ? $"familia:{g}" : $"inscricao:{q.L("id")}").Distinct().Count();
            if (familias > 1) { Alertar("Escolha somente inscrições da mesma família de equipes."); return; }
            await Inscrever(new JsonObject
            {
                ["eventoId"] = info.L("eventoId"),
                ["equipeIds"] = new JsonArray(marcadas.Select(id => (JsonNode)JsonValue.Create(id)).ToArray()),
            });
        });
        voltar.BringToFront(); confirmar.BringToFront();
        Mostrar("equipe", c, () => _ = TelaEquipe(bateria, baterias, n));
    }

    async Task Imprimir(IEnumerable<string> termos)
    {
        try
        {
            var impressora = ObterImpressoraTotem();
            foreach (var termo in termos)
                await Relatorio.ImprimirSilencioso(termo.StartsWith("http") ? termo : _api.BaseUrl + termo, impressora);
            Program.Log("termos enviados para a impressora local: " + impressora);
        }
        catch (Exception e)
        {
            Program.Log("falha ao imprimir termo: " + e.Message);
            Alertar("Não foi possível enviar o termo para a impressora deste totem. Procure a equipe para imprimir seu termo.");
        }
    }

    // ------------------------------------------------------------------ 5. sucesso

    void TelaSucesso(string hora, int n, List<JsonObject> pulseiras = null)
    {
        if (pulseiras is { Count: > 0 }) { TelaPulseira(pulseiras); return; }
        var c = NovaTela(etapa: 3);
        var icone = new IconeSucesso { Bounds = new Rectangle(P(631), P(130), P(104), P(104)) };
        c.Controls.Add(icone);
        c.Controls.Add(Rot("Inscrição na bateria confirmada", 100, 292, F(54, false, FontStyle.Bold), Estilo.Texto, 1166, 72, ContentAlignment.MiddleCenter));
        c.Controls.Add(Rot($"Dirija-se até a recepção para concluir o atendimento e assinar {(n > 1 ? "os termos" : "seu termo")} de responsabilidade.", 120, 384, F(22), Estilo.Suave, 1126, 40, ContentAlignment.MiddleCenter));
        c.Controls.Add(Rot("Sua bateria começa às", 440, 438, F(22), Estilo.Suave, 340, 36, ContentAlignment.MiddleRight));
        c.Controls.Add(Rot(hora, 786, 434, Estilo.Mono(P(28), FontStyle.Bold), Estilo.Texto, 140, 40, ContentAlignment.MiddleLeft));
        c.Controls.Add(Rot("Atenção às informações passadas no briefing e divirta-se!", 170, 494, F(19), Estilo.Suave, 1026, 34, ContentAlignment.MiddleCenter));
        Botao(c, "Concluir", 500, 560, 180, true, () => { Reiniciar(); return Task.CompletedTask; }, 64, 19);
        c.Controls.Add(Rot("Volta para o início após 90 segundos sem interação", 700, 560, F(16), Estilo.MuitoSuave, 380, 64, ContentAlignment.MiddleLeft));
        Mostrar("fim", c, () => TelaSucesso(hora, n));
        _fim.Stop(); _fim.Start();
    }

    void TelaPulseira(List<JsonObject> pulseiras)
    {
        var c = NovaTela(etapa: 3);
        var equipe = pulseiras[0].S("equipe");
        c.Controls.Add(Rot("Equipes: " + equipe, 80, 100, F(equipe.Length > 55 ? 23 : 32, false, FontStyle.Bold), Estilo.Texto, 1206, 72, ContentAlignment.MiddleCenter));
        c.Controls.Add(Rot("Pegue sua pulseira na recepção com o número abaixo. Na pesagem e no box, fale só esse número.", 120, 172, F(21), Estilo.Suave, 1126, 36, ContentAlignment.MiddleCenter));
        var largura = Math.Min(360, 1100 / pulseiras.Count);
        var inicio = 683 - largura * pulseiras.Count / 2;
        for (var i = 0; i < pulseiras.Count; i++)
        {
            var p = pulseiras[i];
            var x = inicio + i * largura;
            c.Controls.Add(Rot(p.S("pulseira"), x, 236, Estilo.Mono(P(pulseiras.Count > 2 ? 96 : 140), FontStyle.Bold), Estilo.Texto, largura, 190, ContentAlignment.MiddleCenter));
            c.Controls.Add(Rot(p.S("nome"), x, 430, F(20, false, FontStyle.Bold), Estilo.Suave, largura, 64, ContentAlignment.TopCenter));
        }
        c.Controls.Add(Rot("Assine o termo de responsabilidade na recepção antes da corrida.", 170, 510, F(19), Estilo.Suave, 1026, 34, ContentAlignment.MiddleCenter));
        Botao(c, "Concluir", 593, 566, 180, true, () => { Reiniciar(); return Task.CompletedTask; });
        Mostrar("fim", c, () => TelaPulseira(pulseiras));
        _fim.Stop(); _fim.Start();
    }

    // ------------------------------------------------------------------ autoteste (screenshots sem gravar nada)

    async Task AutoTeste()
    {
        Directory.CreateDirectory(_autoteste);
        var arqErro = Path.Combine(_autoteste, "erro.txt");
        if (File.Exists(arqErro)) File.Delete(arqErro);
        var pastaCaptura = _autoteste;
        async Task Foto(string nome, Control alvo = null)
        {
            await Task.Delay(120);
            Application.DoEvents();
            var controle = alvo ?? this;
            using var bmp = new Bitmap(controle.ClientSize.Width, controle.ClientSize.Height);
            controle.Refresh();
            Application.DoEvents();
            controle.DrawToBitmap(bmp, new Rectangle(Point.Empty, controle.ClientSize));
            bmp.Save(Path.Combine(pastaCaptura, nome + ".png"));
        }

        async Task RenderizarTelas(string variante, Size tamanho, float escala)
        {
            pastaCaptura = variante == "1366x768" ? _autoteste : Path.Combine(_autoteste, variante);
            Directory.CreateDirectory(pastaCaptura);
            ClientSize = tamanho;
            _k = escala;
            Redesenhar();
            Application.DoEvents();

            Reiniciar(); await Foto("1-identificacao");
            _ident = "529.982.247-25"; TelaCadastro(false); await Foto("2-cadastro-novo");
            _cliente = new JsonObject { ["id"] = 1, ["nome"] = "Maria da Silva", ["email"] = "ma***@gmail.com", ["telefone"] = "(31) *****-1234", ["lgpd"] = true, ["temNascimento"] = true };
            TelaCadastro(true); await Foto("3-cadastro-atualizar");
            _dependentes = [new(2, "João da Silva", "2014-03-02", ""), new(3, "Ana da Silva", "2016-11-20", "")];
            TelaMenores(); await Foto("4-menores");
            TelaCadastroMenor(); await Foto("5-cadastro-menor");
            _participantes = [new(1, "Maria", "", "")];
            (string Hora, string Tipo, int Total, int Ocupadas)[] amostras =
            [
                (Hora: "19:20", Tipo: "light", Total: 12, Ocupadas: 9),
                (Hora: "19:55", Tipo: "light", Total: 12, Ocupadas: 4),
                (Hora: "20:30", Tipo: "light", Total: 12, Ocupadas: 10),
                (Hora: "21:05", Tipo: "super", Total: 10, Ocupadas: 4),
                (Hora: "21:40", Tipo: "light", Total: 12, Ocupadas: 6)
            ];
            var bats = amostras.Select((a, i) => new JsonObject
            {
                ["id"] = 900 + i, ["nome"] = "BATERIA " + a.Hora,
                ["inicio"] = DateTime.Today.ToString("yyyy-MM-dd") + "T" + a.Hora,
                ["vagas"] = a.Total, ["ocupadas"] = a.Ocupadas, ["livres"] = a.Total - a.Ocupadas, ["tipoKart"] = a.Tipo,
            }).ToList();
            _sel = [900];
            MontarBaterias(bats, 1);
            await Foto("6-baterias");
            List<JsonObject> gruposAmostra =
            [
                new() { ["id"] = 1, ["responsavel"] = "Edmael", ["inicio"] = DateTime.Today.ToString("yyyy-MM-dd") + "T21:40", ["total"] = 11, ["aguardando"] = 3 },
                new() { ["id"] = 2, ["responsavel"] = "Julia", ["inicio"] = DateTime.Today.ToString("yyyy-MM-dd") + "T19:20", ["total"] = 12, ["aguardando"] = 1 }
            ];
            _cliente = new JsonObject { ["id"] = 1, ["nome"] = "Maria da Silva" };
            MontarGrupos(gruposAmostra); await Foto("6a-grupos");
            TelaBoasVindasGrupo(new JsonObject { ["responsavel"] = "Edmael", ["inicio"] = DateTime.Today.ToString("yyyy-MM-dd") + "T21:40", ["mensagem"] = "Edmael reservou e pagou a corrida de todos os 11 amigos. Você é convidado(a) dele(a)!" }); await Foto("6b-boas-vindas-grupo");
            TelaSucesso("19:20", 1); await Foto("7-sucesso");
            if (SystemInformation.UserInteractive)
            {
                using var termo = CriarTermoLgpd();
                termo.Show(this);
                await Foto("8-termo-lgpd", termo);
                termo.Close();

                using var alerta = new Alerta("Selecione pelo menos uma bateria para continuar.", 3, ClientSize);
                alerta.Show(this);
                await Foto("9-alerta", alerta);
                alerta.Close();
            }
        }

        try
        {
            await RenderizarTelas("1366x768", new Size(1366, 768), 1f);
            await RenderizarTelas("1920x1080", new Size(1920, 1080), Math.Min(1920 / 1366f, 1080 / 768f));
            await RenderizarTelas("escala-125pct", new Size(1708, 960), 1.25f);
            await RenderizarTelas("escala-150pct", new Size(2049, 1152), 1.5f);

            var funcional = false;
            if (_api.BaseUrl.StartsWith("http://127.0.0.1", StringComparison.OrdinalIgnoreCase))
            {
                _cliente = new JsonObject { ["id"] = 1, ["nome"] = "Maria Teste", ["temNascimento"] = true };
                _participantes = [new(1, "Maria Teste", "", "token-teste")];
                TelaCadastro(false);
                var alertasAntes = _alertasNoAutoteste;
                var falha = await ExecutarAcaoBotao(TelaBaterias);
                if (falha || _tela != "cadastro" || _alertasNoAutoteste != alertasAntes + 1) throw new InvalidOperationException("Falha de rede não exibiu alerta nem preservou o cadastro para permitir nova tentativa.");
                var repeticao = await ExecutarAcaoBotao(TelaBaterias);
                if (!repeticao || _tela != "baterias") throw new InvalidOperationException("Nova tentativa não avançou para a seleção de baterias.");
                funcional = true;
            }
            File.WriteAllText(Path.Combine(_autoteste, "ok.txt"), "ok");
            File.WriteAllText(Path.Combine(_autoteste, "cobertura-resolucao.txt"),
                "1366x768; 1920x1080; escalas de layout 125% (1708x960) e 150% (2049x1152). As duas escalas são emulação geométrica do fator de DPI no autoteste; não alteram as configurações de vídeo/DPI do Windows." + Environment.NewLine);
            File.WriteAllText(Path.Combine(_autoteste, "fluxo-falha-rede.txt"), funcional
                ? "OK: GET /api/totem/baterias retornou erro na primeira tentativa; alerta foi tratado pelo fluxo do botão, o cadastro permaneceu ativo e a segunda tentativa abriu a seleção de baterias." + Environment.NewLine
                : "PENDENTE: execute o autoteste com appsettings apontando para o mock HTTP local para exercitar falha e repetição do GET de baterias." + Environment.NewLine);
        }
        catch (Exception e) { File.WriteAllText(Path.Combine(_autoteste, "erro.txt"), e.ToString()); }
        Close();
    }
}

/// <summary>Lista preta arredondada com linhas marcaveis (baterias / menores).</summary>
public class ListaOpcoes : Panel
{
    readonly float _k;
    public ListaOpcoes(float k)
    {
        _k = k;
        SetStyle(ControlStyles.SupportsTransparentBackColor | ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint, true);
        BackColor = Color.Transparent;
        AutoScroll = true;
        Padding = Padding.Empty;
        DoubleBuffered = true;
    }
    protected override void OnPaintBackground(PaintEventArgs e)
    {
        base.OnPaintBackground(e);
        using var wash = new SolidBrush(Tokens.Escuro.ComponenteTotemVeuLeve);
        e.Graphics.FillRectangle(wash, ClientRectangle);
    }
    public void Adicionar(OpcaoLinha l)
    {
        l.Dock = DockStyle.Top;
        Controls.Add(l);
        l.BringToFront(); // Dock=Top empilha na ordem inversa; traz pra frente para manter a ordem
    }
    public void Vazio(string msg) => Controls.Add(new Label
    {
        Text = msg, Dock = DockStyle.Top, AutoSize = false, Height = (int)(96 * _k), ForeColor = Estilo.Suave,
        Font = Estilo.F(17 * _k), BackColor = Color.Transparent, TextAlign = ContentAlignment.MiddleCenter,
        Padding = new Padding((int)(24 * _k), 0, (int)(24 * _k), 0), AccessibleRole = AccessibleRole.StaticText, AccessibleName = msg,
    });
    public IEnumerable<long> Marcados() => Controls.OfType<OpcaoLinha>().Where(o => o.Marcado).Select(o => o.Id);
    protected override void OnResize(EventArgs e)
    {
        base.OnResize(e);
        using var p = Estilo.Arredondado(new Rectangle(0, 0, Width, Height), (int)(16 * _k));
        Region = new Region(p);
    }
}

public class OpcaoLinha : Control
{
    readonly float _k;
    bool _marcado;
    bool _sobre;
    bool _foco;
    public long Id { get; set; }
    public string Linha1 { get; set; } = "";
    public string Linha2 { get; set; } = "";
    public string Direita { get; set; } = "";
    public string Tipo { get; set; } = "";
    public int Livres { get; set; }
    public int Total { get; set; }
    public event Action Mudou;
    public bool Marcado
    {
        get => _marcado;
        set
        {
            if (_marcado == value) return;
            _marcado = value;
            AtualizarAcessibilidade();
            Invalidate();
            Mudou?.Invoke();
        }
    }
    public OpcaoLinha(float k)
    {
        _k = k;
        Height = (int)(84 * k);
        Cursor = Cursors.Hand;
        TabStop = true;
        AccessibleRole = AccessibleRole.CheckButton;
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.SupportsTransparentBackColor | ControlStyles.Selectable, true);
        BackColor = Color.Transparent;
        Click += (_, _) => Marcado = !Marcado;
        MouseEnter += (_, _) => { _sobre = true; Invalidate(); };
        MouseLeave += (_, _) => { _sobre = false; Invalidate(); };
        GotFocus += (_, _) => { _foco = true; Invalidate(); };
        LostFocus += (_, _) => { _foco = false; Invalidate(); };
    }
    protected override void OnCreateControl()
    {
        base.OnCreateControl();
        AtualizarAcessibilidade();
    }
    void AtualizarAcessibilidade() => AccessibleName = $"{Linha1}. {Direita}. {(Marcado ? "Selecionada" : "Não selecionada")}";
    protected override void OnKeyDown(KeyEventArgs e)
    {
        base.OnKeyDown(e);
        if (e.KeyCode is Keys.Enter or Keys.Space)
        {
            e.Handled = true;
            e.SuppressKeyPress = true;
            Marcado = !Marcado;
        }
    }
    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        var bounds = new Rectangle(0, 0, Width, Height);
        if (_marcado || _sobre)
        {
            using var row = new SolidBrush(_marcado ? Color.FromArgb(30, Estilo.Verde.R, Estilo.Verde.G, Estilo.Verde.B) : Tokens.Escuro.ComponenteTotemLinhaLista);
            g.FillRectangle(row, bounds);
        }
        var s = (int)(30 * _k);
        var box = new Rectangle((int)(26 * _k), (Height - s) / 2, s, s);
        using (var p = Estilo.Arredondado(box, (int)(4 * _k)))
        {
            if (_marcado)
            {
                using var b = new SolidBrush(Estilo.Verde); g.FillPath(b, p);
                using var pen = new Pen(Tokens.Escuro.ComponenteTotemMarcaCheck, 2.8f * _k) { StartCap = LineCap.Round, EndCap = LineCap.Round };
                g.DrawLines(pen, [new PointF(box.X + s * .22f, box.Y + s * .52f), new PointF(box.X + s * .42f, box.Y + s * .72f), new PointF(box.X + s * .78f, box.Y + s * .28f)]);
            }
            else { using var pen = new Pen(Tokens.Escuro.ComponenteTotemContornoCaixa, 1.5f * _k); g.DrawPath(pen, p); }
        }
        var x = (int)(76 * _k);
        using var titulo = Estilo.F((Tipo.Length > 0 ? 22 : 20) * _k, false, FontStyle.Bold);
        using var subtitulo = Estilo.F(16 * _k);
        var centro = Height / 2;
        TextRenderer.DrawText(g, Linha1, titulo, new Rectangle(x, centro - (int)(25 * _k), Math.Max(0, Width - x - (int)(330 * _k)), (int)(30 * _k)), Estilo.Texto, TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
        TextRenderer.DrawText(g, Linha2, subtitulo, new Rectangle(x, centro + (int)(5 * _k), Math.Max(0, Width - x - (int)(330 * _k)), (int)(26 * _k)), Estilo.Suave, TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);

        if (Tipo.Length > 0)
        {
            var tipoRect = new Rectangle(Width - (int)(292 * _k), centro - (int)(16 * _k), (int)(132 * _k), (int)(32 * _k));
            var super = Tipo.Contains("Super", StringComparison.OrdinalIgnoreCase);
            var cor = super ? Estilo.SuperFundo : Estilo.InformativoFundo;
            var texto = super ? Estilo.SuperTexto : Estilo.InformativoTexto;
            using var badge = Estilo.Arredondado(tipoRect, (int)(16 * _k));
            using (var fill = new SolidBrush(cor)) g.FillPath(fill, badge);
            using var badgeFont = Estilo.F(14 * _k, false, FontStyle.Bold);
            TextRenderer.DrawText(g, Tipo, badgeFont, tipoRect, texto, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPrefix);

            var vagas = new Rectangle(Width - (int)(154 * _k), centro - (int)(23 * _k), (int)(132 * _k), (int)(26 * _k));
            using var vagasFont = Estilo.F(18 * _k, false, FontStyle.Bold);
        TextRenderer.DrawText(g, Direita, vagasFont, vagas, Livres <= 3 ? Estilo.Amarelo : Estilo.Texto, TextFormatFlags.Right | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
            var trilho = new Rectangle(Width - (int)(142 * _k), centro + (int)(12 * _k), (int)(120 * _k), (int)(5 * _k));
            using var fundo = new SolidBrush(Tokens.Escuro.ComponenteTotemTrilho); g.FillRectangle(fundo, trilho);
            if (Total > 0)
            {
                var ocupadas = Math.Clamp(Total - Livres, 0, Total);
                var barra = new Rectangle(trilho.X, trilho.Y, (int)Math.Round(trilho.Width * (double)ocupadas / Total), trilho.Height);
                using var ocupacao = new SolidBrush(Livres <= 3 ? Estilo.Amarelo : Estilo.Verde);
                g.FillRectangle(ocupacao, barra);
            }
        }
        else
        {
            using var idade = Estilo.F(16 * _k, false, FontStyle.Bold);
            TextRenderer.DrawText(g, Direita, idade, new Rectangle(Width - (int)(180 * _k), 0, (int)(150 * _k), Height), Estilo.Suave, TextFormatFlags.Right | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPrefix);
        }
        using var linha = new Pen(Tokens.Escuro.ComponenteTotemLinhaFina);
        g.DrawLine(linha, 0, Height - 1, Width, Height - 1);
        if (_foco)
        {
            using var foco = new Pen(Estilo.Foco, 2);
            g.DrawRectangle(foco, new Rectangle(1, 1, Width - 3, Height - 3));
        }
    }
}

