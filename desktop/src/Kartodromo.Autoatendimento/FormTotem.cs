using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Autoatendimento;

/// <summary>
/// Totem de autoatendimento em tela cheia: identificacao -> cadastro/atualizacao -> menores ->
/// baterias -> sucesso (imprime o termo na impressora do totem). Mesmo fluxo e visual do LapTime AA.
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
    readonly Api _api = Api.Servidor;
    readonly string _autoteste;
    readonly System.Windows.Forms.Timer _ocioso = new() { Interval = 90_000 };
    readonly System.Windows.Forms.Timer _fim = new() { Interval = 15_000 };
    readonly Image _logo = Icone.Logo();
    readonly string _versao = "v" + (typeof(FormTotem).Assembly.GetName().Version?.ToString(3) ?? "1.0.0");
    Cartao _cartao;
    float _k = 1f;
    bool _liberadoFechar;

    public FormTotem(string autoteste)
    {
        _autoteste = autoteste;
        Text = "Autoatendimento";
        Icon = Icone.App;
        BackColor = Estilo.Fundo;
        BackgroundImage = Estilo.Couro();
        BackgroundImageLayout = ImageLayout.Tile;
        DoubleBuffered = true;
        KeyPreview = true;
        FormBorderStyle = FormBorderStyle.None;
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
        }
        Resize += (_, _) => { var k = Math.Min(ClientSize.Width / 1366f, ClientSize.Height / 768f); if (Math.Abs(k - _k) > .01f && _cartao != null) { _k = k; Redesenhar(); } else Centralizar(); };
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

    // ------------------------------------------------------------------ infra

    public bool PreFilterMessage(ref Message m)
    {
        // qualquer toque/tecla reinicia a contagem de inatividade
        if (m.Msg is 0x100 or 0x201 or 0x204 or 0x240 /*WM_TOUCH*/ or 0x0246 /*WM_POINTERDOWN*/) { _ocioso.Stop(); _ocioso.Start(); }
        return false;
    }

    async Task CarregarConfig()
    {
        try { if (await _api.Get("/api/totem/config") is JsonObject c) _cfg = c; }
        catch (Exception e) { Program.Log("config: " + e.Message); }
    }

    int P(float v) => (int)Math.Round(v * _k);
    Font F(float px, bool leve = false) => Estilo.F(px * _k, leve);

    Action _redesenhar;
    void Redesenhar() => _redesenhar?.Invoke();

    void Mostrar(string tela, Cartao c, Action redesenhar)
    {
        _tela = tela;
        _redesenhar = redesenhar;
        SuspendLayout();
        var velho = _cartao;
        _cartao = c;
        Controls.Add(c);
        Centralizar();
        if (velho != null) { Controls.Remove(velho); velho.Dispose(); }
        ResumeLayout();
        c.Controls.OfType<CampoTexto>().FirstOrDefault(x => x.Enabled && x.Tag as string == "foco")?.Caixa.Focus();
    }

    void Centralizar()
    {
        if (_cartao == null) return;
        _cartao.Location = new Point((ClientSize.Width - _cartao.Width) / 2, (ClientSize.Height - _cartao.Height) / 2);
    }

    /// <summary>Cartao padrao: titulo, subtitulo, logo e versao no canto.</summary>
    Cartao NovoCartao(int w, int h, string titulo, string sub, bool tituloGrande = false)
    {
        var c = new Cartao { Size = new Size(P(w), P(h)) };
        c.Controls.Add(Rot(titulo, 42, tituloGrande ? 30 : 32, F(tituloGrande ? 42 : 42, true), Estilo.Texto));
        if (!string.IsNullOrEmpty(sub)) c.Controls.Add(Rot(sub, 42, 82, F(16), Estilo.Texto, w - 290));
        if (_logo != null)
        {
            var lw = 190f; var lh = lw * _logo.Height / _logo.Width;
            if (lh > 64) { lh = 64; lw = lh * _logo.Width / _logo.Height; }
            c.Controls.Add(new PictureBox { Image = _logo, SizeMode = PictureBoxSizeMode.Zoom, BackColor = Estilo.Cartao, Bounds = new Rectangle(P(w - 42 - lw), P(26), P(lw), P(lh)) });
            var v = new Label { Text = _versao, Font = F(12), ForeColor = Estilo.Suave, BackColor = Estilo.Cartao, TextAlign = ContentAlignment.TopRight, Bounds = new Rectangle(P(w - 42 - 120), P(28 + lh), P(120), P(18)) };
            c.Controls.Add(v);
        }
        return c;
    }

    Label Rot(string texto, float x, float y, Font f, Color cor, float largura = 0)
    {
        var l = new Label { Text = texto, Font = f, ForeColor = cor, BackColor = Estilo.Cartao, Location = new Point(P(x), P(y)), UseMnemonic = false };
        if (largura > 0) { l.AutoSize = false; l.Size = new Size(P(largura), TextRenderer.MeasureText(texto, f, new Size(P(largura), 999), TextFormatFlags.WordBreak).Height + 2); }
        else l.AutoSize = true;
        return l;
    }

    CampoTexto Campo(Control dono, string rotulo, float x, float y, float w, string valor = "", bool foco = false)
    {
        dono.Controls.Add(Rot(rotulo, x + 16, y - 21, F(16), Estilo.Suave));
        var c = new CampoTexto { Bounds = new Rectangle(P(x), P(y), P(w), P(44)), Tag = foco ? "foco" : null };
        c.Caixa.Font = F(17);
        c.Text = valor ?? "";
        dono.Controls.Add(c);
        return c;
    }

    CampoLista Lista(Control dono, string rotulo, float x, float y, float w, params string[] itens)
    {
        dono.Controls.Add(Rot(rotulo, x + 16, y - 21, F(16), Estilo.Suave));
        var c = new CampoLista(itens) { Bounds = new Rectangle(P(x), P(y), P(w), P(44)) };
        c.Font = F(17);
        dono.Controls.Add(c);
        return c;
    }

    Pilula Botao(Control dono, string texto, float x, float y, float w, bool principal, Func<Task> clique)
    {
        var b = new Pilula(texto, principal) { Bounds = new Rectangle(P(x), P(y), P(w), P(45)), Font = F(17) };
        b.Click += async (_, _) =>
        {
            if (!b.Enabled) return;
            _cartao.Enabled = false; Cursor = Cursors.WaitCursor;
            try { await clique(); }
            catch (Exception e) { Alertar(e is ApiException ? e.Message : "Ocorreu um erro. Por favor, procure a recepção."); Program.Log("erro: " + e); }
            finally { if (!_cartao.IsDisposed) _cartao.Enabled = true; Cursor = Cursors.Default; }
        };
        dono.Controls.Add(b);
        return b;
    }

    Marcador Marca(Control dono, string texto, float x, float y, bool marcado)
    {
        var m = new Marcador(texto, marcado) { Font = F(16), Location = new Point(P(x), P(y)) };
        m.Height = P(30);
        m.Width = P(30) + TextRenderer.MeasureText(texto, m.Font).Width + 8;
        dono.Controls.Add(m);
        return m;
    }

    void Alertar(string msg) { if (_autoteste == null) Alerta.Mostrar(this, msg); else Program.Log("alerta: " + msg); }

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
        const int w = 748;
        var c = NovoCartao(w, 338, "Autoatendimento", _cfg.S("mensagem"));
        var campo = Campo(c, "CPF, RG, passaporte, ou e-mail", 42, 150, w - 84, _ident, true);
        var menor = Marca(c, "Responsável pelo menor de idade", 46, 208, _menor);
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
        var go = Botao(c, "Próximo", w - 42 - 155, 260, 155, true, Ir);
        campo.Caixa.KeyDown += (_, e) => { if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; go.Clicar(); } };
        Mostrar("ident", c, TelaIdent);
    }

    void PosCliente()
    {
        if (_menor) { TelaMenores(); return; }
        _participantes = [new Pessoa(_cliente.L("id") ?? 0, _cliente.S("nome"), "", _token)];
        _ = TelaBaterias();
    }

    // ------------------------------------------------------------------ 2. cadastro novo / atualizacao

    void TelaCadastro(bool existente)
    {
        const int w = 998;
        var email = _ident.Contains('@') ? _ident : "";
        var doc = _ident.Contains('@') ? "" : _ident;
        var tipoIni = doc.Length == 0 || Fmt.Digitos(doc).Length == 11 && Fmt.Digitos(doc) == doc.Replace(".", "").Replace("-", "") ? "CPF" : "RG";
        var sub = existente
            ? $"Olá, {_cliente.S("nome").Split(' ')[0]}! Confira e atualize seus dados. Campos em branco continuam como estão."
            : "Registre-se para continuar.";
        var c = NovoCartao(w, 390, "Autoatendimento", sub);
        float[] xs = [42, 242, 442, 642];
        const float cw = 190;
        var reg = Lista(c, "Tipo de Registro", xs[0], 124, cw, "Pessoa Física", "Pessoa Jurídica");
        var tipo = Lista(c, "Tipo de Documento", xs[1], 124, cw, "CPF", "RG", "Passaporte");
        tipo.SelectedIndex = tipoIni == "CPF" ? 0 : 1;
        var fDoc = Campo(c, tipoIni, xs[2], 124, cw, existente ? "" : tipoIni == "CPF" ? Fmt.MascaraCpf(doc) : doc, !existente && doc.Length == 0);
        var lDoc = c.Controls.OfType<Label>().Last(l => l.Text == tipoIni);
        var fNome = Campo(c, "Nome Completo", xs[3], 124, cw, existente ? _cliente.S("nome") : "", !existente && doc.Length > 0);
        var fEmail = Campo(c, "E-mail", xs[0], 191, cw, existente ? "" : email, existente);
        var fFone = Campo(c, "Número de Telefone", xs[1], 191, cw);
        var fNasc = Campo(c, "Data de Nascimento", xs[2], 191, cw);
        var fPeso = Campo(c, "Peso", xs[3], 191, cw);
        var fCep = Campo(c, "CEP", xs[0], 258, cw);
        var fEnd = Campo(c, "Endereço", xs[1], 258, cw);
        var fBairro = Campo(c, "Bairro", xs[2], 258, cw);
        var fCidade = Campo(c, "Cidade", xs[3], 258, cw);
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

        var lgpd = Marca(c, "Eu li e concordo com o", 46, 326, existente && _cliente.B("lgpd"));
        var link = new LinkLabel
        {
            Text = "Termo de Consentimento para Tratamento de Dados Pessoais", Font = F(15), AutoSize = true, BackColor = Estilo.Cartao,
            LinkColor = Estilo.Amarelo, ActiveLinkColor = Estilo.Amarelo, VisitedLinkColor = Estilo.Amarelo, LinkBehavior = LinkBehavior.NeverUnderline,
        };
        link.Location = new Point(lgpd.Right - P(4), lgpd.Top + (lgpd.Height - link.PreferredHeight) / 2);
        link.LinkClicked += (_, _) => TermoLgpd();
        c.Controls.Add(link);

        Botao(c, "Voltar", 619, 318, 110, false, () => { Reiniciar(); return Task.CompletedTask; });
        Botao(c, "Próximo", 744, 318, 110, true, async () =>
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
            PosCliente();
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

    void TermoLgpd()
    {
        using var f = new Form { FormBorderStyle = FormBorderStyle.None, StartPosition = FormStartPosition.CenterParent, ShowInTaskbar = false, TopMost = true, BackColor = Estilo.Fundo, Size = new Size(P(760), P(420)) };
        var c = new Cartao { Dock = DockStyle.Fill };
        f.Controls.Add(c);
        c.Controls.Add(Rot("Termo de Consentimento para Tratamento de Dados Pessoais", 36, 28, F(28, true), Estilo.Texto, 690));
        var empresa = _cfg.S("empresa");
        c.Controls.Add(Rot($"Ao se cadastrar, você autoriza o {empresa} a tratar seus dados pessoais (nome, documento, contato, data de nascimento, peso e endereço) para identificar você nas baterias e corridas, emitir o termo de responsabilidade, registrar tempos e resultados, cumprir obrigações legais e entrar em contato sobre suas reservas.", 36, 110, F(16), Estilo.Texto, 690));
        c.Controls.Add(Rot("Os dados ficam armazenados nos sistemas do kartódromo e não são vendidos a terceiros. Você pode pedir a qualquer momento, na recepção, acesso, correção ou exclusão dos seus dados, nos termos da Lei nº 13.709/2018 (LGPD).", 36, 220, F(16), Estilo.Texto, 690));
        var ok = new Pilula("Fechar", true) { Bounds = new Rectangle(P(760 - 36 - 150), P(420 - 36 - 45), P(150), P(45)), Font = F(17) };
        ok.Click += (_, _) => f.Close();
        c.Controls.Add(ok);
        f.ShowDialog(this);
    }

    // ------------------------------------------------------------------ 3. menores

    void TelaMenores()
    {
        const int w = 798;
        var c = NovoCartao(w, 530, "Autoatendimento", "Selecione os menores de idade que irão participar.");
        var idCli = _cliente.L("id") ?? 0;
        var marcados = _participantes.Where(p => p.Id != idCli).Select(p => p.Id).ToHashSet();
        var lista = new ListaOpcoes(_k) { Bounds = new Rectangle(P(42), P(102), P(w - 84), P(300)) };
        foreach (var d in _dependentes)
            lista.Adicionar(new OpcaoLinha(_k) { Id = d.Id, Linha1 = d.Nome, Linha2 = d.Nascimento.Length >= 10 ? "Nascimento: " + Fmt.Dmy(d.Nascimento) : "", Direita = Fmt.Idade(d.Nascimento) is int i ? $"{i} anos" : "", Marcado = marcados.Contains(d.Id) });
        if (_dependentes.Count == 0) lista.Vazio("Nenhum menor cadastrado no seu nome. Toque em \"Cadastrar menor\".");
        c.Controls.Add(lista);
        var eu = Marca(c, "Eu também vou participar", 46, 418, _eu && (_participantes.Count == 0 || _participantes.Any(p => p.Id == idCli)));
        Botao(c, "Cadastrar menor", 42, 466, 190, false, () => { TelaCadastroMenor(); return Task.CompletedTask; });
        Botao(c, "Voltar", 436, 466, 140, false, () => { Reiniciar(); return Task.CompletedTask; });
        Botao(c, "Próximo", 600, 466, 155, true, () =>
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
        const int w = 798;
        var c = NovoCartao(w, 330, "Autoatendimento", "Cadastro do menor de idade.");
        var nome = Campo(c, "Nome Completo", 42, 124, 390, "", true);
        var nasc = Campo(c, "Data de Nascimento", 442, 124, 190);
        nasc.Caixa.PlaceholderText = "DD/MM/AAAA";
        var tipo = Lista(c, "Tipo de Documento", 42, 191, 190, "CPF", "RG", "Passaporte");
        var doc = Campo(c, "Documento (opcional)", 242, 191, 190);
        Mascarar(nasc.Caixa, Fmt.MascaraData);
        Mascarar(doc.Caixa, v => tipo.SelectedIndex == 0 ? Fmt.MascaraCpf(v) : v);
        Botao(c, "Voltar", 436, 258, 140, false, () => { TelaMenores(); return Task.CompletedTask; });
        Botao(c, "Salvar", 600, 258, 155, true, async () =>
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
        const int w = 798;
        var c = NovoCartao(w, 530, "Autoatendimento", "Selecione pelo menos uma das baterias listadas abaixo." + (n > 1 ? $" ({n} participantes)" : ""));
        var lista = new ListaOpcoes(_k) { Bounds = new Rectangle(P(42), P(102), P(w - 84), P(348)) };
        foreach (var b in baterias)
            lista.Adicionar(new OpcaoLinha(_k)
            {
                Id = b.L("id") ?? 0, Linha1 = b.S("nome").ToUpperInvariant(),
                Linha2 = "Inicia às " + Fmt.Hm(b.S("inicio")) + (b.S("tipoKart") == "super" ? " · Super kart" : ""),
                Direita = "Vagas: " + b.I("livres"), Marcado = _sel.Contains(b.L("id") ?? 0),
            });
        if (baterias.Count == 0) lista.Vazio("Não há baterias com vagas disponíveis hoje. Por favor, procure a recepção.");
        c.Controls.Add(lista);
        Botao(c, "Voltar", 436, 466, 140, false, () => { if (_menor) TelaMenores(); else Reiniciar(); return Task.CompletedTask; });
        Botao(c, "Próximo", 600, 466, 155, true, async () =>
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
            if (r.S("termoUrl") is { Length: > 0 } termo) _ = Imprimir(_api.BaseUrl + termo);
        });
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
        const int w = 748;
        var c = NovoCartao(w, 234, "Reserva realizada com sucesso!", null, true);
        c.Controls.Add(Rot($"Dirija-se até a recepção para concluir a reserva e assinar {(n > 1 ? "os termos" : "seu termo")} de responsabilidade", 42, 108, F(16), Estilo.Texto));
        var l = Rot("Sua bateria começa às", 42, 145, F(16), Estilo.Texto);
        c.Controls.Add(l);
        var h = Rot(hora, 0, 145, F(16), Estilo.Amarelo);
        h.Left = l.Right - P(4);
        c.Controls.Add(h);
        c.Controls.Add(Rot("Atenção às informações passadas no briefing e divirta-se!", 42, 182, F(16), Estilo.Texto));
        foreach (Control x in c.Controls) x.Click += (_, _) => Reiniciar();
        c.Click += (_, _) => Reiniciar();
        Mostrar("fim", c, () => TelaSucesso(hora, n));
        _fim.Stop(); _fim.Start();
    }

    // ------------------------------------------------------------------ autoteste (screenshots sem gravar nada)

    async Task AutoTeste()
    {
        Directory.CreateDirectory(_autoteste);
        async Task Foto(string nome)
        {
            await Task.Delay(250);
            Application.DoEvents();
            using var bmp = new Bitmap(ClientSize.Width, ClientSize.Height);
            DrawToBitmap(bmp, new Rectangle(Point.Empty, ClientSize));
            bmp.Save(Path.Combine(_autoteste, nome + ".png"));
        }
        try
        {
            Reiniciar(); await Foto("1-identificacao");
            _ident = "529.982.247-25"; TelaCadastro(false); await Foto("2-cadastro-novo");
            _cliente = new JsonObject { ["id"] = 1, ["nome"] = "Maria da Silva", ["email"] = "ma***@gmail.com", ["telefone"] = "(31) *****-1234", ["lgpd"] = true, ["temNascimento"] = true };
            TelaCadastro(true); await Foto("3-cadastro-atualizar");
            _dependentes = [new(2, "João da Silva", "2014-03-02", ""), new(3, "Ana da Silva", "2016-11-20", "")];
            TelaMenores(); await Foto("4-menores");
            TelaCadastroMenor(); await Foto("5-cadastro-menor");
            _participantes = [new(1, "Maria", "", "")];
            List<JsonObject> bats;
            try { bats = (await _api.Lista("/api/totem/baterias")).ToList(); } catch { bats = []; }
            if (bats.Count == 0)
                bats = [.. new[] { "17:00", "17:35", "18:10", "18:45", "19:20" }.Select((hm, i) => new JsonObject { ["id"] = 900 + i, ["nome"] = "Bateria " + hm, ["inicio"] = DateTime.Today.ToString("yyyy-MM-dd") + "T" + hm, ["livres"] = 10, ["tipoKart"] = i == 4 ? "super" : "light" })];
            MontarBaterias(bats, 1); await Foto("6-baterias");
            TelaSucesso("19:20", 1); await Foto("7-sucesso");
            File.WriteAllText(Path.Combine(_autoteste, "ok.txt"), "ok");
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
        BackColor = Color.Black;
        AutoScroll = true;
        Padding = new Padding((int)(15 * k), (int)(4 * k), (int)(15 * k), (int)(4 * k));
        DoubleBuffered = true;
    }
    public void Adicionar(OpcaoLinha l)
    {
        l.Dock = DockStyle.Top;
        Controls.Add(l);
        l.BringToFront(); // Dock=Top empilha na ordem inversa; traz pra frente para manter a ordem
    }
    public void Vazio(string msg) => Controls.Add(new Label { Text = msg, Dock = DockStyle.Top, Height = (int)(70 * _k), ForeColor = Estilo.Suave, Font = Estilo.F(17 * _k), TextAlign = ContentAlignment.MiddleLeft, Padding = new Padding((int)(10 * _k), 0, 0, 0) });
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
    public long Id { get; set; }
    public string Linha1 { get; set; } = "";
    public string Linha2 { get; set; } = "";
    public string Direita { get; set; } = "";
    public bool Marcado { get => _marcado; set { _marcado = value; Invalidate(); } }
    public OpcaoLinha(float k)
    {
        _k = k;
        Height = (int)(61 * k);
        BackColor = Color.Black;
        Cursor = Cursors.Hand;
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        Click += (_, _) => Marcado = !Marcado;
    }
    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        var s = (int)(20 * _k);
        var box = new Rectangle((int)(6 * _k), (Height - s) / 2 - 1, s, s);
        using (var p = Estilo.Arredondado(box, (int)(4 * _k)))
        {
            if (_marcado)
            {
                using var b = new SolidBrush(Estilo.Vermelho); g.FillPath(b, p);
                using var pen = new Pen(Color.White, 2.2f * _k) { StartCap = LineCap.Round, EndCap = LineCap.Round };
                g.DrawLines(pen, new PointF[] { new PointF(box.X + s * .22f, box.Y + s * .52f), new PointF(box.X + s * .42f, box.Y + s * .72f), new PointF(box.X + s * .78f, box.Y + s * .28f) });
            }
            else { using var pen = new Pen(Color.FromArgb(208, 208, 208), 1.6f * _k); g.DrawPath(pen, p); }
        }
        using var f = Estilo.F(16 * _k);
        var x = (int)(50 * _k);
        var lh = f.Height;
        TextRenderer.DrawText(g, Linha1, f, new Point(x, Height / 2 - lh - 1), Estilo.Suave, TextFormatFlags.NoPrefix);
        TextRenderer.DrawText(g, Linha2, f, new Point(x, Height / 2 + 1), Estilo.Texto, TextFormatFlags.NoPrefix);
        TextRenderer.DrawText(g, Direita, f, new Rectangle(0, 0, Width, Height), Estilo.Suave, TextFormatFlags.Right | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPrefix);
        using var linha = new Pen(Color.FromArgb(96, 96, 96));
        g.DrawLine(linha, 0, Height - 1, Width, Height - 1);
    }
}
