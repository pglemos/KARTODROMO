using System.Drawing.Drawing2D;
using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

/// <summary>Entrada nativa do Módulo Office, mantendo autenticação por token do servidor.</summary>
public class FormLogin : Form
{
    readonly TextBox _login = new() { BorderStyle = BorderStyle.None, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoSubtitulo), PlaceholderText = "Seu usuário", AccessibleName = "Usuário" };
    readonly TextBox _senha = new() { BorderStyle = BorderStyle.None, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoSubtitulo), UseSystemPasswordChar = true, PlaceholderText = "Sua senha", AccessibleName = "Senha" };
    readonly CheckBox _termos = new() { Text = "Li e concordo com os", AutoSize = true, ForeColor = KitVisual.Texto, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo), AccessibleName = "Concordo com os termos de uso" };
    readonly CheckBox _lembrar = new() { Text = "Lembrar meu usuário neste computador", AutoSize = true, ForeColor = KitVisual.Texto, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo), AccessibleName = "Lembrar meu usuário neste computador" };
    readonly Label _msg = new() { AutoSize = true, ForeColor = Tokens.Claro.CorEstadoPerigoTexto, MaximumSize = new Size(380, 40) };
    readonly Label _status = new() { AutoSize = true, ForeColor = KitVisual.Secundario, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno) };
    readonly Button _entrar = KitVisual.Botao("Entrar", true, 250);
    readonly Button _cancelar = KitVisual.Botao("Cancelar", false, 120);

    public FormLogin()
    {
        Text = "Entrar · Kartódromo Internacional de Betim";
        Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo);
        BackColor = KitVisual.Fundo;
        ForeColor = KitVisual.Texto;
        Icon = Icone.App;
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.None;
        // O processo já usa DpiUnawareGdiScaled no manifesto: aplicar Dpi novamente nesta janela
        // fazia a Recepção 2 (1536×864, 125%) ultrapassar a tela e cortar os botões da direita.
        AutoScaleMode = AutoScaleMode.None;
        AccessibleRole = AccessibleRole.Window;
        AccessibleName = "Entrada do Módulo Office";
        var areaTela = Screen.PrimaryScreen?.WorkingArea ?? new Rectangle(0, 0, 1440, 900);
        var escalaTela = Math.Min(1f, Math.Min(areaTela.Width / 1440f, areaTela.Height / 900f));
        var modoCompacto = areaTela.Width <= 1600 || areaTela.Height <= 900;
        var larguraCard = modoCompacto ? 360 : 400;
        ClientSize = new Size(Math.Max(900, (int)(1440 * escalaTela)), Math.Max(600, (int)(900 * escalaTela)));
        // A entrada ocupa toda a área útil: em monitores menores ou com DPI ampliado,
        // uma janela centralizada pode ultrapassar a tela e cortar Cancelar/Versão.
        WindowState = FormWindowState.Maximized;
        KeyPreview = true;

        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1, Margin = new Padding(0) };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 43.0556F));
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 56.9444F));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        var esquerda = new Panel { Dock = DockStyle.Fill, Padding = new Padding(56), BackColor = Color.FromArgb(18, 18, 20) };
        esquerda.Paint += PintarPista;
        var direita = new Panel { Dock = DockStyle.Fill, BackColor = KitVisual.Fundo };
        layout.Controls.Add(esquerda, 0, 0);
        layout.Controls.Add(direita, 1, 0);
        Controls.Add(layout);

        var logo = new PictureBox { Image = Icone.Logo(), SizeMode = PictureBoxSizeMode.Zoom, Size = new Size(300, 76), Location = new Point(56, 46), Anchor = AnchorStyles.Top | AnchorStyles.Left };
        var titular = new Label { Text = "Recepção,\ncaixa e reservas.", AutoSize = true, Font = new Font("Segoe UI", 29F, FontStyle.Bold), ForeColor = Tokens.Claro.CorFundoApp, Location = new Point(52, 0), Anchor = AnchorStyles.Left | AnchorStyles.Bottom };
        var detalhe = new Label { Text = "Cada atendente entra com o próprio usuário. Tudo o que você fizer fica registrado no seu nome e no seu terminal.", AutoSize = false, Width = 400, Height = 82, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoSubtitulo), ForeColor = Color.FromArgb(174, 174, 178), Location = new Point(56, 0), Anchor = AnchorStyles.Left | AnchorStyles.Bottom };
        titular.BackColor = detalhe.BackColor = logo.BackColor = Color.Transparent;
        esquerda.Controls.AddRange([logo, titular, detalhe]);
        esquerda.Resize += (_, _) =>
        {
            titular.Location = new Point(56, Math.Max(210, esquerda.ClientSize.Height - 244));
            detalhe.Location = new Point(58, Math.Max(300, esquerda.ClientSize.Height - 128));
            detalhe.Width = Math.Min(410, esquerda.ClientSize.Width - 112);
        };

        var card = new Panel { Size = new Size(larguraCard, 464), BackColor = Color.Transparent, Anchor = AnchorStyles.None };
        direita.Controls.Add(card);
        void PosicionarCard() => card.Location = new Point(modoCompacto ? 24 : Math.Max(20, (direita.ClientSize.Width - card.Width) / 2), Math.Max(20, (direita.ClientSize.Height - card.Height) / 2));
        direita.Resize += (_, _) => PosicionarCard();
        PosicionarCard();

        card.Controls.Add(new Label { Text = "Entrar", AutoSize = true, Font = new Font("Segoe UI", 30F, FontStyle.Bold), ForeColor = KitVisual.Texto, Location = new Point(0, 0) });
        card.Controls.Add(new Label { Text = "Módulo Office · Kartódromo Internacional de Betim", AutoSize = false, Width = larguraCard, Height = 24, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo), ForeColor = KitVisual.Secundario, Location = new Point(2, 56) });

        var campoLogin = Campo("Usuário", _login, new Point(0, 0), new Size(larguraCard, 56));
        var campoSenha = Campo("Senha", _senha, new Point(0, 56), new Size(larguraCard, 56));
        campoLogin.Padding = new Padding(16, 5, 16, 4);
        campoSenha.Padding = new Padding(16, 5, 56, 4); // espaço do botão do olho à direita
        campoLogin.Controls.Add(new Panel { Dock = DockStyle.Bottom, Height = 1, BackColor = Tokens.Claro.CorAcaoSecundaria });
        var credenciais = new Panel { Location = new Point(0, 94), Size = new Size(larguraCard, 112), BackColor = Tokens.Primitivo.Branco, Padding = new Padding(0) };
        credenciais.Paint += (_, e) =>
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var path = Arredondado(new Rectangle(0, 0, credenciais.Width - 1, credenciais.Height - 1), 14);
            using var pen = new Pen(Tokens.Claro.CorBordaSutil);
            e.Graphics.DrawPath(pen, path);
        };
        KitVisual.AplicarRaio(credenciais, 14);
        campoLogin.Dock = DockStyle.Top;
        campoSenha.Dock = DockStyle.Fill;
        credenciais.Controls.Add(campoSenha);
        credenciais.Controls.Add(campoLogin);
        var olho = new BotaoPlano { Text = "", Font = new Font("Segoe MDL2 Assets", 10F), FlatStyle = FlatStyle.Flat, Size = new Size(32, 32), BackColor = Tokens.Claro.CorAcaoSecundaria, ForeColor = Tokens.Primitivo.Cinza700, Cursor = Cursors.Hand, Anchor = AnchorStyles.Top | AnchorStyles.Right, AccessibleRole = AccessibleRole.PushButton, AccessibleName = "Mostrar ou ocultar senha" };
        olho.FlatAppearance.BorderSize = 0;
        olho.Click += (_, _) => _senha.UseSystemPasswordChar = !_senha.UseSystemPasswordChar;
        campoSenha.Controls.Add(olho);
        void PosOlho() { olho.Location = new Point(campoSenha.ClientSize.Width - olho.Width - 12, (campoSenha.ClientSize.Height - olho.Height) / 2); olho.BringToFront(); }
        campoSenha.Resize += (_, _) => PosOlho();
        PosOlho();
        KitVisual.AplicarRaio(olho, 8);
        card.Controls.Add(credenciais);

        _termos.Location = new Point(0, 228);
        var termosLink = new LinkLabel { Text = "termos de uso", AutoSize = true, LinkColor = KitVisual.Verde, ActiveLinkColor = Color.FromArgb(8, 85, 58), Location = new Point(128, 228), Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo) };
        void PosicionarLink() { termosLink.Location = new Point(_termos.Right - 2, _termos.Top + (_termos.Height - termosLink.Height) / 2 + 1); }
        _termos.SizeChanged += (_, _) => PosicionarLink(); Shown += (_, _) => PosicionarLink();
        termosLink.LinkClicked += (_, _) => Msg.Info(this, "Uso restrito aos colaboradores do Kartódromo Internacional de Betim.\nOs dados dos clientes são tratados conforme a LGPD (Lei 13.709/2018) e só podem ser usados na operação do kartódromo.", "Termos de uso");
        _lembrar.Location = new Point(0, 259);
        card.Controls.AddRange([_termos, termosLink, _lembrar]);
        KitVisual.CheckVerde(_termos); KitVisual.CheckVerde(_lembrar);
        _termos.Padding = new Padding(4, 0, 0, 0); _lembrar.Padding = new Padding(4, 0, 0, 0);

        _msg.Location = new Point(0, 291);
        _msg.Height = 34;
        _msg.MaximumSize = new Size(larguraCard - 8, 40);
        card.Controls.Add(_msg);
        _entrar.Size = new Size(modoCompacto ? 220 : 270, 46);
        _entrar.Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoSubtitulo, FontStyle.Bold);
        _cancelar.Size = new Size(modoCompacto ? 112 : 120, 46);
        _cancelar.Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo);
        _entrar.Location = new Point(0, 340);
        _cancelar.Location = new Point(larguraCard - _cancelar.Width, 340);
        KitVisual.AplicarRaio(_entrar, 12);
        KitVisual.AplicarRaio(_cancelar, 12);
        _entrar.Click += (_, _) => Entrar();
        _cancelar.Click += (_, _) => { DialogResult = DialogResult.Cancel; Close(); };
        card.Controls.AddRange([_entrar, _cancelar]);

        var bolinha = new Panel { Size = new Size(8, 8), BackColor = Tokens.Claro.CorStatusOnline, Location = new Point(2, 424) };
        KitVisual.AplicarRaio(bolinha, 4);
        _status.Location = new Point(18, 418);
        var versao = new Label { Text = "Versão " + Application.ProductVersion.Split('+')[0], AutoSize = true, ForeColor = KitVisual.Secundario, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno), Anchor = AnchorStyles.Bottom | AnchorStyles.Right };
        card.Controls.AddRange([bolinha, _status, versao]);
        card.Resize += (_, _) => { versao.Location = new Point(card.ClientSize.Width - versao.Width, 418); KitVisual.AplicarRaio(credenciais, 14); };
        versao.Location = new Point(card.ClientSize.Width - versao.Width, 418);

        AcceptButton = _entrar;
        CancelButton = _cancelar;
        Load += async (_, _) =>
        {
            var lembrar = Registro.Ler("LembrarUsuario") == "true";
            _lembrar.Checked = lembrar;
            _login.Text = lembrar ? Registro.Ler("UltimoLogin") : "";
            (string.IsNullOrEmpty(_login.Text) ? _login : _senha).Select();
            await AtualizarStatus();
        };
    }

    static Panel Campo(string rotulo, TextBox campo, Point posicao, Size tamanho)
    {
        var p = new Panel { Location = posicao, Size = tamanho, BackColor = Tokens.Primitivo.Branco, Padding = new Padding(16, 3, 44, 3) };
        campo.Dock = DockStyle.Fill;
        p.Controls.Add(campo);
        p.Controls.Add(new Label { Text = rotulo, Dock = DockStyle.Top, Height = 18, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoPequeno, FontStyle.Bold), ForeColor = KitVisual.Secundario });
        return p;
    }

    static void PintarPista(object sender, PaintEventArgs e)
    {
        var p = (Panel)sender;
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        using (var b = new LinearGradientBrush(p.ClientRectangle, Tokens.Claro.CorSuperficieInversa, Color.FromArgb(10, 10, 11), 90f)) g.FillRectangle(b, p.ClientRectangle);
        var y0 = (int)(p.Height * .72);
        using var linha = new Pen(Color.FromArgb(16, 255, 255, 255), 1);
        for (var i = -p.Width; i < p.Width * 2; i += 70)
        {
            g.DrawLine(linha, i, p.Height, i + p.Width / 3, y0);
            g.DrawLine(linha, i, p.Height, i + p.Width / 3, y0 - 34);
        }
        using var brilho = new SolidBrush(Color.FromArgb(13, 52, 199, 89));
        g.FillEllipse(brilho, -190, p.Height - 120, p.Width + 280, 260);
    }

    static GraphicsPath Arredondado(Rectangle r, int raio)
    {
        var d = raio * 2; var p = new GraphicsPath();
        p.AddArc(r.Left, r.Top, d, d, 180, 90); p.AddArc(r.Right - d, r.Top, d, d, 270, 90);
        p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90); p.AddArc(r.Left, r.Bottom - d, d, d, 90, 90); p.CloseFigure(); return p;
    }

    async Task AtualizarStatus()
    {
        try
        {
            await Sessao.Api.Get("/healthz");
            _status.Text = "Servidor SRVKART conectado";
            _status.ForeColor = Tokens.Claro.CorEstadoSucessoTexto;
        }
        catch
        {
            _status.Text = "Servidor SRVKART indisponível";
            _status.ForeColor = Tokens.Claro.CorEstadoPerigoTexto;
        }
    }

    async void Entrar()
    {
        _msg.Text = "";
        if (!_termos.Checked) { _msg.Text = "É necessário concordar com os termos de uso."; return; }
        if (string.IsNullOrWhiteSpace(_login.Text) || string.IsNullOrEmpty(_senha.Text)) { _msg.Text = "Informe usuário e senha."; return; }
        try
        {
            UseWaitCursor = true;
            _entrar.Enabled = false;
            var r = await Sessao.Api.Post("/api/login", new { login = _login.Text.Trim(), senha = _senha.Text, termos = true });
            Sessao.Api.Token = r.S("token");
            Sessao.Usuario = r["usuario"]?.AsObject();
            await Sessao.CarregarApoio();
            Registro.Gravar("LembrarUsuario", _lembrar.Checked ? "true" : "false");
            Registro.Gravar("UltimoLogin", _lembrar.Checked ? _login.Text.Trim() : "");
            DialogResult = DialogResult.OK;
            Close();
        }
        catch (ApiException e) { _msg.Text = e.Message; _senha.SelectAll(); _senha.Focus(); }
        finally { UseWaitCursor = false; _entrar.Enabled = true; }
    }
}

/// <summary>Preferências simples do usuário no registro (HKCU\Software\Kartodromo).</summary>
public static class Registro
{
    public static string Ler(string k)
    {
        try { using var ch = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\Kartodromo\Recepcao"); return ch?.GetValue(k) as string ?? ""; } catch { return ""; }
    }
    public static void Gravar(string k, string v)
    {
        try { using var ch = Microsoft.Win32.Registry.CurrentUser.CreateSubKey(@"Software\Kartodromo\Recepcao"); ch.SetValue(k, v); } catch { /* sem permissão */ }
    }
}
