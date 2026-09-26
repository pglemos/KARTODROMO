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

    JsonObject _cfg = new() { ["empresa"] = "Kartódromo", ["mensagem"] = "Seja bem-vindo(a)!", ["imprimirTermo"] = true, ["consultarCep"] = true };
    readonly Api _api;
    readonly string _autoteste;
    readonly System.Windows.Forms.Timer _ocioso = new() { Interval = 90_000 };
    readonly System.Windows.Forms.Timer _fim = new() { Interval = 90_000 };
    readonly Image _logo = Estilo.Logo();
    readonly string _versao = "v" + (typeof(FormTotem).Assembly.GetName().Version?.ToString(3) ?? "1.0.0");
    readonly CabecalhoTotem _cabecalho;
    Panel _cartao;
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
            WindowState = FormWindowState.Maximized;
            TopMost = true;
            Application.AddMessageFilter(this);
        }
        else
        {
            StartPosition = FormStartPosition.Manual;
            Location = new Point(0, 0);
            ClientSize = new Size(1366, 768);
            TopMost = true;
        }
        Resize += (_, _) =>
        {
            var k = Math.Min(ClientSize.Width / 1366f, ClientSize.Height / 768f);
            if (Math.Abs(k - _k) > .01f && _cartao != null) { _k = k; Redesenhar(); }
            else Centralizar();
            AtualizarCabecalho();
            Invalidate();
        };
        _ocioso.Tick += (_, _) => { if (_tela != "ident" || _ident.Length > 0 || (_cartao?.Controls.OfType<CampoTexto>().Any(c => c.Text.Length > 0) ?? false)) Reiniciar(); };
        _fim.Tick += (_, _) => Reiniciar();
        KeyDown += (_, e) =>
        {
            // saida da equipe: Ctrl+Shift+Alt+S
            if (e.Control && e.Shift && e.Alt && e.KeyCode == Keys.S) { _liberadoFechar = true; Close(); }
        };
        FormClosing += (_, e) => { if (_autoteste == null && e.CloseReason == CloseReason.UserClosing && !_liberadoFechar) e.Cancel = true; };
        Shown += async (_, _) =>
        {
            _k = Math.Min(ClientSize.Width / 1366f, ClientSize.Height / 768f);
            await CarregarConfig();
            if (_autoteste != null) { await AutoTeste(); return; }
            Reiniciar();
            _ocioso.Start();
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
            glow.CenterColor = Color.FromArgb(38, 48, 209, 88);
            glow.SurroundColors = [Color.Transparent, Color.Transparent, Color.Transparent, Color.Transparent];
            g.FillRectangle(glow, ox, oy, w, h * .55f);
        }

        // Grade de perspectiva discreta inspirada no fundo do design aprovado.
        using var gridPen = new Pen(Color.FromArgb(9, 255, 255, 255), Math.Max(1, scale));
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

    async Task CarregarConfig()
    {
        try { if (await _api.Get("/api/totem/config") is JsonObject c) _cfg = c; }
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
        Controls.Add(c);
        Centralizar();
        AtualizarCabecalho();
        foreach (var botao in c.Controls.OfType<Pilula>().ToArray()) botao.BringToFront();
        if (velho != null) { Controls.Remove(velho); velho.Dispose(); }
        ResumeLayout();
        c.Controls.OfType<CampoTexto>().FirstOrDefault(x => x.Enabled && x.Tag as string == "foco")?.Caixa.Focus();
    }

    void AtualizarCabecalho()
    {
        if (_cabecalho == null || _cabecalho.IsDisposed) return;
        _cabecalho.Bounds = new Rectangle(0, 0, ClientSize.Width, P(88));
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
        c.Caixa.Font = F(19);
        c.Text = valor ?? "";
        dono.Controls.Add(c);
        return c;
    }

    CampoLista Lista(Control dono, string rotulo, float x, float y, float w, params string[] itens)
    {
        dono.Controls.Add(Rot(rotulo, x + 4, y - 23, F(14, false, FontStyle.Bold), Estilo.Suave));
        var c = new CampoLista(itens) { Bounds = new Rectangle(P(x), P(y), P(w), P(58)) };
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
            Cursor = Cursors.Default;
        }
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
        var campo = new CampoTexto { Bounds = new Rectangle(P(190), P(368), P(986), P(82)), Tag = "foco", Padding = new Padding(P(24), 0, P(20), 0) };
        campo.Caixa.Font = Estilo.Mono(P(32), FontStyle.Bold);
        campo.Caixa.PlaceholderText = "Digite seu documento ou e-mail pelo teclado USB";
        campo.Text = _ident;
        campo.Caixa.TextChanged += (_, _) => _ident = campo.Text;
        c.Controls.Add(campo);
        c.Controls.Add(Rot("Use o teclado USB do totem e pressione Enter para continuar.", 194, 458, F(15), Estilo.MuitoSuave, 980, 24));

        var aviso = CartaoEm(c, 190, 498, 986, 78);
        var menor = Marca(aviso, "Sou responsável por menor de idade", 20, 12, _menor, 32);
        aviso.Controls.Add(Rot("Você se identifica e escolhe quem vai correr.", 58, 45, F(15), Estilo.Suave));

        async Task Ir()
        {
            _ident = campo.Text.Trim(); _menor = menor.Marcado;
            if (_ident.Length < 5) { Alertar("Informe o CPF, RG, passaporte ou e-mail."); return; }
            var r = await _api.Post("/api/totem/identificar", new { identificador = _ident });
            if (r?["cliente"] is not JsonObject cli) { TelaCadastro(false); return; }
            if (cli.B("bloqueado")) { Alertar("Seu cadastro precisa de atenção. Por favor, procure a recepção."); return; }
            _cliente = cli; _token = r.S("token");
            _dependentes = r["dependentes"] is JsonArray a ? a.OfType<JsonObject>().Select(d => new Pessoa(d.L("id") ?? 0, d.S("nome"), d.S("nascimento"), d.S("token"))).ToList() : [];
            TelaCadastro(true);
        }
        var go = Botao(c, "Próximo", 190, 608, 220, true, Ir, 68, 21);
        campo.Caixa.KeyDown += (_, e) => { if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; go.Clicar(); } };
        Mostrar("ident", c, TelaIdent);
    }

    async Task PosClienteAsync()
    {
        if (_menor) { TelaMenores(); return; }
        _participantes = [new Pessoa(_cliente.L("id") ?? 0, _cliente.S("nome"), "", _token)];
        await TelaBaterias();
    }

    // ------------------------------------------------------------------ 2. cadastro novo / atualizacao

    void TelaCadastro(bool existente)
    {
        var email = _ident.Contains('@') ? _ident : "";
        var doc = _ident.Contains('@') ? "" : _ident;
        var tipoIni = doc.Length == 0 || Fmt.Digitos(doc).Length == 11 && Fmt.Digitos(doc) == doc.Replace(".", "").Replace("-", "") ? "CPF" : "RG";
        var sub = existente
            ? $"Olá, {_cliente.S("nome").Split(' ')[0]}! Confira e atualize seus dados. Campos em branco continuam como estão."
            : "Primeira vez aqui. Leva menos de um minuto.";
        var c = NovaTela(etapa: 2);
        c.Controls.Add(Rot("Registre-se para continuar", 90, 108, F(44, false, FontStyle.Bold), Estilo.Texto));
        c.Controls.Add(Rot(sub, 90, 163, F(19), Estilo.Suave));
        var campos = CartaoEm(c, 90, 204, 1186, 338);
        float[] xs = [24, 312, 600, 888];
        const float cw = 274;
        var reg = Lista(campos, "Tipo de Registro", xs[0], 36, cw, "Pessoa Física", "Pessoa Jurídica");
        var tipo = Lista(campos, "Tipo de Documento", xs[1], 36, cw, "CPF", "RG", "Passaporte");
        tipo.SelectedIndex = tipoIni == "CPF" ? 0 : 1;
        var fDoc = Campo(campos, "CPF", xs[2], 36, cw, existente ? "" : tipoIni == "CPF" ? Fmt.MascaraCpf(doc) : doc, !existente && doc.Length == 0);
        var lDoc = campos.Controls.OfType<Label>().Last(l => l.Text == "CPF");
        var fNome = Campo(campos, "Nome completo", xs[3], 36, cw, existente ? _cliente.S("nome") : "", !existente && doc.Length > 0);
        var fEmail = Campo(campos, "E-mail", xs[0], 132, cw, existente ? "" : email, existente);
        var fFone = Campo(campos, "Celular (WhatsApp)", xs[1], 132, cw);
        var fNasc = Campo(campos, "Data de nascimento", xs[2], 132, cw);
        var fPeso = Campo(campos, "Peso (kg)", xs[3], 132, cw);
        var fCep = Campo(campos, "CEP", xs[0], 228, cw);
        var fEnd = Campo(campos, "Endereço", xs[1], 228, cw);
        var fBairro = Campo(campos, "Bairro", xs[2], 228, cw);
        var fCidade = Campo(campos, "Cidade", xs[3], 228, cw);
        if (existente)
        {
            reg.Enabled = tipo.Enabled = fDoc.Enabled = fNome.Enabled = false;
            fDoc.Text = "(já cadastrado)";
            if (_cliente.S("email").Length > 0) fEmail.Caixa.PlaceholderText = _cliente.S("email");
            if (_cliente.S("telefone").Length > 0) fFone.Caixa.PlaceholderText = _cliente.S("telefone");
            if (_cliente.B("temNascimento")) fNasc.Caixa.PlaceholderText = "(já informada)";
        }
        else fNasc.Caixa.PlaceholderText = "DD/MM/AAAA";
        string uf = "";
        tipo.SelectedIndexChanged += (_, _) => { lDoc.Text = tipo.Text; if (tipo.SelectedIndex == 0) fDoc.Text = Fmt.MascaraCpf(fDoc.Text); };
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

        var lgpd = Marca(c, "Li e concordo com o", 90, 659, existente && _cliente.B("lgpd"), 34);
        var link = new LinkLabel
        {
            Text = "Termo de Consentimento para Tratamento de Dados Pessoais", Font = F(16), AutoSize = true, BackColor = Color.Transparent,
            LinkColor = Color.White, ActiveLinkColor = Estilo.Suave, VisitedLinkColor = Color.White, LinkBehavior = LinkBehavior.AlwaysUnderline,
        };
        link.Location = new Point(lgpd.Right + P(8), lgpd.Top + (lgpd.Height - link.PreferredHeight) / 2);
        link.LinkClicked += (_, _) => TermoLgpd();
        c.Controls.Add(link);

        Botao(c, "Voltar", 958, 644, 140, false, () => { Reiniciar(); return Task.CompletedTask; });
        Botao(c, "Próximo", 1112, 644, 164, true, async () =>
        {
            var nascTxt = fNasc.Text.Trim();
            var nasc = nascTxt.Length > 0 ? Fmt.DataBrParaIso(nascTxt) : "";
            if (nasc != "" && Fmt.ParseData(nasc) is { } dn && (dn > DateTime.Today || dn.Year < 1900)) nasc = null;
            var dados = new JsonObject
            {
                ["email"] = fEmail.Text.Trim(), ["telefone"] = fFone.Text.Trim(), ["nascimento"] = nasc ?? "",
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
            if (nasc == null) { Alertar("Data de nascimento inválida."); return; }
            if (nasc == "" && (!existente || !_cliente.B("temNascimento"))) { Alertar("A data de nascimento é obrigatória."); return; }
            var em = fEmail.Text.Trim();
            if (em.Length > 0 && !System.Text.RegularExpressions.Regex.IsMatch(em, @"^[^@\s]+@[^@\s]+\.[^@\s]+$")) { Alertar("E-mail inválido."); return; }
            if (fFone.Text.Trim().Length > 0 && Fmt.Digitos(fFone.Text).Length < 10) { Alertar("Número de telefone inválido."); return; }
            if (!lgpd.Marcado) { Alertar("É necessário aceitar o Termo de Consentimento para Tratamento de Dados Pessoais."); return; }
            if (existente)
            {
                var r = await _api.Post("/api/totem/cadastro", new JsonObject { ["id"] = _cliente.L("id"), ["token"] = _token, ["dados"] = dados, ["lgpd"] = true });
                _token = r.S("token") is { Length: > 0 } t ? t : _token;
                _cliente["lgpd"] = true;
                if (nasc != "") _cliente["temNascimento"] = true;
            }
            else
            {
                var r = await _api.Post("/api/totem/cadastro", new JsonObject { ["dados"] = dados, ["lgpd"] = true });
                _cliente = new JsonObject { ["id"] = r.L("id"), ["nome"] = dados.S("nome"), ["lgpd"] = true, ["temNascimento"] = true };
                _token = r.S("token"); _dependentes = [];
            }
            await PosClienteAsync();
        });
        Mostrar("cadastro", c, () => TelaCadastro(existente));
    }

    static async Task<JsonObject> ViaCep(string cep)
    {
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(4) };
            var r = JsonNode.Parse(await http.GetStringAsync($"https://viacep.com.br/ws/{cep}/json/")) as JsonObject;
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
        f.Controls.Add(cabecalho);
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
        Botao(c, "Voltar", 914, 660, 140, false, () => { Reiniciar(); return Task.CompletedTask; });
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
        var c = NovaTela(etapa: 2);
        c.Controls.Add(Rot("Cadastre quem vai correr", 150, 110, F(44, false, FontStyle.Bold), Estilo.Texto));
        c.Controls.Add(Rot("Informe os dados do menor de idade.", 150, 165, F(19), Estilo.Suave));
        var painel = CartaoEm(c, 260, 220, 846, 340);
        var nome = Campo(painel, "Nome completo", 34, 70, 470, "", true);
        var nasc = Campo(painel, "Data de nascimento", 528, 70, 282);
        nasc.Caixa.PlaceholderText = "DD/MM/AAAA";
        var tipo = Lista(painel, "Tipo de documento", 34, 166, 282, "CPF", "RG", "Passaporte");
        var doc = Campo(painel, "Documento (opcional)", 340, 166, 470);
        Mascarar(nasc.Caixa, Fmt.MascaraData);
        Mascarar(doc.Caixa, v => tipo.SelectedIndex == 0 ? Fmt.MascaraCpf(v) : v);
        var voltar = Botao(c, "Voltar", 914, 660, 140, false, () => { TelaMenores(); return Task.CompletedTask; });
        var salvar = Botao(c, "Salvar", 1070, 660, 146, true, async () =>
        {
            var n = string.Join(' ', nome.Text.Split(' ', StringSplitOptions.RemoveEmptyEntries));
            var iso = Fmt.DataBrParaIso(nasc.Text.Trim());
            if (n.Split(' ').Length < 2) { Alertar("Informe o nome completo do menor."); return; }
            if (string.IsNullOrEmpty(iso) || Fmt.ParseData(iso) is not { } dn || dn > DateTime.Today || dn.Year < 1900) { Alertar("Informe a data de nascimento (DD/MM/AAAA)."); return; }
            var tipoDoc = tipo.SelectedIndex switch { 0 => "CPF", 1 => "RG", _ => "PASSAPORTE" };
            if (doc.Text.Trim().Length > 0 && tipoDoc == "CPF" && !Fmt.CpfValido(doc.Text)) { Alertar("CPF inválido."); return; }
            var r = await _api.Post("/api/totem/cadastro", new JsonObject
            {
                ["dados"] = new JsonObject { ["nome"] = n, ["nascimento"] = iso, ["tipoDocumento"] = tipoDoc, ["documento"] = doc.Text.Trim() },
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

    // ------------------------------------------------------------------ 4. baterias

    async Task TelaBaterias()
    {
        var todas = await _api.Lista("/api/totem/baterias");
        var n = _participantes.Count;
        var lista = todas.Where(b => b.I("livres") >= n).ToList();
        MontarBaterias(lista, n);
    }

    void MontarBaterias(List<JsonObject> baterias, int n)
    {
        var c = NovaTela(etapa: 3);
        c.Controls.Add(Rot("Escolha sua bateria", 150, 108, F(44, false, FontStyle.Bold), Estilo.Texto));
        c.Controls.Add(Rot("Selecione pelo menos uma. Só aparecem baterias de hoje com vaga." + (n > 1 ? $" ({n} participantes)" : ""), 150, 164, F(19), Estilo.Suave));
        var selecionadas = Rot("0 selecionadas", 1000, 164, F(17, false, FontStyle.Bold), Color.FromArgb(126, 227, 154), 216, 28, ContentAlignment.MiddleRight);
        c.Controls.Add(selecionadas);
        var painel = CartaoEm(c, 150, 215, 1066, 426);
        var lista = new ListaOpcoes(_k) { Bounds = new Rectangle(0, 0, P(1066), P(426)) };
        var totalMarcadas = 0;
        foreach (var b in baterias)
        {
            var inicio = Fmt.Hm(b.S("inicio"));
            var tipoSuper = b.S("tipoKart") == "super";
            var item = new OpcaoLinha(_k)
            {
                Height = P(84), Id = b.L("id") ?? 0, Linha1 = b.S("nome").ToUpperInvariant(),
                Linha2 = $"Inicia às {inicio} · chegue 10 min antes",
                Direita = b.I("livres") + (b.I("livres") == 1 ? " vaga" : " vagas"),
                Tipo = tipoSuper ? "Super Kart" : "Kart Light", Livres = b.I("livres"), Total = b.I("vagas"),
                Marcado = _sel.Contains(b.L("id") ?? 0),
            };
            if (item.Marcado) totalMarcadas++;
            item.Mudou += () =>
            {
                totalMarcadas = lista.Marcados().Count();
                selecionadas.Text = totalMarcadas + (totalMarcadas == 1 ? " selecionada" : " selecionadas");
            };
            lista.Adicionar(item);
        }
        selecionadas.Text = totalMarcadas + (totalMarcadas == 1 ? " selecionada" : " selecionadas");
        if (baterias.Count == 0) lista.Vazio("Não há baterias com vagas disponíveis hoje. Por favor, procure a recepção.");
        painel.Controls.Add(lista);
        var voltar = Botao(c, "Voltar", 914, 660, 140, false, () => { if (_menor) TelaMenores(); else Reiniciar(); return Task.CompletedTask; });
        var proximo = Botao(c, "Próximo", 1070, 660, 146, true, async () =>
        {
            _sel = lista.Marcados().ToHashSet();
            if (_sel.Count == 0) { Alertar("Selecione pelo menos uma bateria."); return; }
            var r = await _api.Post("/api/totem/inscrever", new JsonObject
            {
                ["bateriaIds"] = new JsonArray(_sel.Select(x => (JsonNode)x).ToArray()),
                ["participantes"] = new JsonArray(_participantes.Select(p => (JsonNode)new JsonObject { ["id"] = p.Id, ["token"] = p.Token }).ToArray()),
            });
            var qtd = r?["inscricoes"] is JsonArray ins ? ins.Count : 1;
            TelaSucesso(Fmt.Hm(r.S("inicio")), qtd);
            // o termo sai na TM-T20 da recepção (fila do servidor); só imprime aqui se o servidor não enfileirou
            if (r["termoNaRecepcao"]?.GetValue<bool>() == true) Program.Log("termo enviado para a impressora da recepção");
            else if (r.S("termoUrl") is { Length: > 0 } termo) _ = Imprimir(_api.BaseUrl + termo);
        });
        voltar.BringToFront(); proximo.BringToFront();
        Mostrar("baterias", c, () => MontarBaterias(baterias, n));
    }

    async Task Imprimir(string url)
    {
        try { await Relatorio.ImprimirSilencioso(url, Config.Impressora); Program.Log("termo impresso: " + url.Split('?')[0]); }
        catch (Exception e) { Program.Log("falha ao imprimir termo: " + e.Message); }
    }

    // ------------------------------------------------------------------ 5. sucesso

    void TelaSucesso(string hora, int n)
    {
        var c = NovaTela(etapa: 3);
        var icone = new IconeSucesso { Bounds = new Rectangle(P(631), P(130), P(104), P(104)) };
        c.Controls.Add(icone);
        c.Controls.Add(Rot("Reserva realizada com sucesso!", 100, 292, F(58, false, FontStyle.Bold), Estilo.Texto, 1166, 72, ContentAlignment.MiddleCenter));
        c.Controls.Add(Rot($"Dirija-se até a recepção para concluir a reserva e assinar {(n > 1 ? "os termos" : "seu termo")} de responsabilidade.", 120, 384, F(22), Color.FromArgb(209, 209, 214), 1126, 40, ContentAlignment.MiddleCenter));
        c.Controls.Add(Rot("Sua bateria começa às", 440, 438, F(22), Color.FromArgb(209, 209, 214), 340, 36, ContentAlignment.MiddleRight));
        c.Controls.Add(Rot(hora, 786, 434, Estilo.Mono(P(28), FontStyle.Bold), Color.White, 140, 40, ContentAlignment.MiddleLeft));
        c.Controls.Add(Rot("Atenção às informações passadas no briefing e divirta-se!", 170, 494, F(19), Estilo.Suave, 1026, 34, ContentAlignment.MiddleCenter));
        Botao(c, "Concluir", 500, 560, 180, true, () => { Reiniciar(); return Task.CompletedTask; }, 64, 19);
        c.Controls.Add(Rot("Volta para o início após 90 segundos sem interação", 700, 560, F(16), Estilo.MuitoSuave, 380, 64, ContentAlignment.MiddleLeft));
        Mostrar("fim", c, () => TelaSucesso(hora, n));
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
            var amostras = new[] { (Hora: "19:20", Tipo: "light", Total: 12, Ocupadas: 9), (Hora: "19:55", Tipo: "light", Total: 12, Ocupadas: 4), (Hora: "20:30", Tipo: "light", Total: 12, Ocupadas: 10), (Hora: "21:05", Tipo: "super", Total: 10, Ocupadas: 4), (Hora: "21:40", Tipo: "light", Total: 12, Ocupadas: 6) };
            var bats = amostras.Select((a, i) => new JsonObject
            {
                ["id"] = 900 + i, ["nome"] = "BATERIA " + a.Hora,
                ["inicio"] = DateTime.Today.ToString("yyyy-MM-dd") + "T" + a.Hora,
                ["vagas"] = a.Total, ["ocupadas"] = a.Ocupadas, ["livres"] = a.Total - a.Ocupadas, ["tipoKart"] = a.Tipo,
            }).ToList();
            _sel = [900];
            MontarBaterias(bats, 1);
            await Foto("6-baterias");
            TelaSucesso("19:20", 1); await Foto("7-sucesso");
            using (var termo = CriarTermoLgpd())
            {
                termo.Show(this);
                await Foto("8-termo-lgpd", termo);
                termo.Close();
            }
            using (var alerta = new Alerta("Selecione pelo menos uma bateria para continuar.", 3, ClientSize))
            {
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
        using var wash = new SolidBrush(Color.FromArgb(10, 255, 255, 255));
        e.Graphics.FillRectangle(wash, ClientRectangle);
    }
    public void Adicionar(OpcaoLinha l)
    {
        l.Dock = DockStyle.Top;
        Controls.Add(l);
        l.BringToFront(); // Dock=Top empilha na ordem inversa; traz pra frente para manter a ordem
    }
    public void Vazio(string msg) => Controls.Add(new Label { Text = msg, Dock = DockStyle.Top, Height = (int)(70 * _k), ForeColor = Estilo.Suave, Font = Estilo.F(17 * _k), BackColor = Color.Transparent, TextAlign = ContentAlignment.MiddleLeft, Padding = new Padding((int)(10 * _k), 0, 0, 0) });
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
    public long Id { get; set; }
    public string Linha1 { get; set; } = "";
    public string Linha2 { get; set; } = "";
    public string Direita { get; set; } = "";
    public string Tipo { get; set; } = "";
    public int Livres { get; set; }
    public int Total { get; set; }
    public event Action Mudou;
    public bool Marcado { get => _marcado; set { if (_marcado == value) return; _marcado = value; Invalidate(); Mudou?.Invoke(); } }
    public OpcaoLinha(float k)
    {
        _k = k;
        Height = (int)(84 * k);
        Cursor = Cursors.Hand;
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.SupportsTransparentBackColor, true);
        BackColor = Color.Transparent;
        Click += (_, _) => Marcado = !Marcado;
        MouseEnter += (_, _) => { _sobre = true; Invalidate(); };
        MouseLeave += (_, _) => { _sobre = false; Invalidate(); };
    }
    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        var bounds = new Rectangle(0, 0, Width, Height);
        if (_marcado || _sobre)
        {
            using var row = new SolidBrush(_marcado ? Color.FromArgb(25, 48, 209, 88) : Color.FromArgb(12, 255, 255, 255));
            g.FillRectangle(row, bounds);
        }
        var s = (int)(30 * _k);
        var box = new Rectangle((int)(26 * _k), (Height - s) / 2, s, s);
        using (var p = Estilo.Arredondado(box, (int)(4 * _k)))
        {
            if (_marcado)
            {
                using var b = new SolidBrush(Estilo.Verde); g.FillPath(b, p);
                using var pen = new Pen(Color.FromArgb(0, 33, 10), 2.8f * _k) { StartCap = LineCap.Round, EndCap = LineCap.Round };
                g.DrawLines(pen, [new PointF(box.X + s * .22f, box.Y + s * .52f), new PointF(box.X + s * .42f, box.Y + s * .72f), new PointF(box.X + s * .78f, box.Y + s * .28f)]);
            }
            else { using var pen = new Pen(Color.FromArgb(180, 255, 255, 255), 1.5f * _k); g.DrawPath(pen, p); }
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
            var cor = super ? Color.FromArgb(42, 255, 159, 10) : Color.FromArgb(42, 10, 132, 255);
            var texto = super ? Color.FromArgb(255, 179, 64) : Color.FromArgb(100, 181, 255);
            using var badge = Estilo.Arredondado(tipoRect, (int)(16 * _k));
            using (var fill = new SolidBrush(cor)) g.FillPath(fill, badge);
            using var badgeFont = Estilo.F(14 * _k, false, FontStyle.Bold);
            TextRenderer.DrawText(g, Tipo, badgeFont, tipoRect, texto, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPrefix);

            var vagas = new Rectangle(Width - (int)(154 * _k), centro - (int)(23 * _k), (int)(132 * _k), (int)(26 * _k));
            using var vagasFont = Estilo.F(18 * _k, false, FontStyle.Bold);
            TextRenderer.DrawText(g, Direita, vagasFont, vagas, Livres <= 3 ? Estilo.Amarelo : Color.White, TextFormatFlags.Right | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
            var trilho = new Rectangle(Width - (int)(142 * _k), centro + (int)(12 * _k), (int)(120 * _k), (int)(5 * _k));
            using var fundo = new SolidBrush(Color.FromArgb(45, 255, 255, 255)); g.FillRectangle(fundo, trilho);
            if (Total > 0)
            {
                var ocupadas = Math.Clamp(Total - Livres, 0, Total);
                var barra = new Rectangle(trilho.X, trilho.Y, (int)Math.Round(trilho.Width * (double)ocupadas / Total), trilho.Height);
                using var ocupacao = new SolidBrush(Livres <= 3 ? Color.FromArgb(255, 159, 10) : Estilo.Verde);
                g.FillRectangle(ocupacao, barra);
            }
        }
        else
        {
            using var idade = Estilo.F(16 * _k, false, FontStyle.Bold);
            TextRenderer.DrawText(g, Direita, idade, new Rectangle(Width - (int)(180 * _k), 0, (int)(150 * _k), Height), Estilo.Suave, TextFormatFlags.Right | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPrefix);
        }
        using var linha = new Pen(Color.FromArgb(20, 255, 255, 255));
        g.DrawLine(linha, 0, Height - 1, Width, Height - 1);
    }
}

