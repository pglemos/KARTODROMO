using System.Text.Json.Nodes;
using Kartodromo.Comum;

namespace Kartodromo.Recepcao;

/// <summary>"Login do Sistema" (REC-001): Login/Senha no alto a esquerda, aceite dos termos, cadeado, Ok/Cancelar.</summary>
public class FormLogin : Form
{
    readonly TextBox _login = new() { Width = 116 };
    readonly TextBox _senha = new() { Width = 116, UseSystemPasswordChar = true };
    readonly CheckBox _termos = new() { Text = "Li e concordo com os", AutoSize = true };
    readonly Label _msg = new() { AutoSize = true, ForeColor = Tema.Vermelho };

    public FormLogin()
    {
        Text = "Login do Sistema";
        Font = Tema.Normal;
        BackColor = Tema.Fundo;
        Icon = Icone.App;
        StartPosition = FormStartPosition.CenterScreen;
        WindowState = FormWindowState.Maximized;
        MinimizeBox = MaximizeBox = false;
        KeyPreview = true;

        Controls.Add(new Label { Text = "Login", Left = 78, Top = 14, AutoSize = true });
        Controls.Add(new Label { Text = "Senha", Left = 202, Top = 14, AutoSize = true });
        _login.Location = new Point(78, 32);
        _senha.Location = new Point(202, 32);
        _termos.Location = new Point(78, 66);
        _msg.Location = new Point(78, 92);
        Controls.AddRange([_login, _senha, _termos, _msg]);

        var link = new LinkLabel { Text = "Termos de uso", AutoSize = true, Anchor = AnchorStyles.Top | AnchorStyles.Right };
        link.LinkClicked += (_, _) => Msg.Info(this, "Uso restrito aos colaboradores do Kartódromo Internacional de Betim.\nOs dados dos clientes são tratados conforme a LGPD (Lei 13.709/2018) e só podem ser usados na operação do kartódromo.", "Termos de uso");
        var logo = new PictureBox { Image = Icone.Logo(), SizeMode = PictureBoxSizeMode.Zoom, Size = new Size(200, 56), Anchor = AnchorStyles.Top | AnchorStyles.Right };
        var cadeado = new Label { Text = "", Font = new Font("Segoe MDL2 Assets", 40), ForeColor = Color.FromArgb(196, 150, 30), AutoSize = true, Anchor = AnchorStyles.Left };
        var ok = new Button { Text = "Ok", Size = new Size(72, 24), Anchor = AnchorStyles.Bottom | AnchorStyles.Right };
        var cancelar = new Button { Text = "Cancelar", Size = new Size(72, 24), Anchor = AnchorStyles.Bottom | AnchorStyles.Right };
        Controls.AddRange([link, logo, cadeado, ok, cancelar]);
        Layout += (_, _) =>
        {
            link.Location = new Point(ClientSize.Width - link.Width - 46, 66);
            logo.Location = new Point(ClientSize.Width - logo.Width - 40, 8);
            cadeado.Location = new Point(10, ClientSize.Height / 2 - 30);
            cancelar.Location = new Point(ClientSize.Width - 80, ClientSize.Height - 30);
            ok.Location = new Point(ClientSize.Width - 160, ClientSize.Height - 30);
        };
        ok.Click += (_, _) => Entrar();
        cancelar.Click += (_, _) => { DialogResult = DialogResult.Cancel; Close(); };
        AcceptButton = ok;
        Load += (_, _) =>
        {
            var ultimo = Registro.Ler("UltimoLogin");
            _login.Text = ultimo;
            (string.IsNullOrEmpty(ultimo) ? _login : _senha).Select();
        };
    }

    async void Entrar()
    {
        _msg.Text = "";
        if (!_termos.Checked) { _msg.Text = "É necessário concordar com os termos de uso."; return; }
        try
        {
            UseWaitCursor = true;
            var r = await Sessao.Api.Post("/api/login", new { login = _login.Text.Trim(), senha = _senha.Text, termos = true });
            Sessao.Api.Token = r.S("token");
            Sessao.Usuario = r["usuario"]?.AsObject();
            await Sessao.CarregarApoio();
            Registro.Gravar("UltimoLogin", _login.Text.Trim());
            DialogResult = DialogResult.OK;
            Close();
        }
        catch (ApiException e) { _msg.Text = e.Message; _senha.SelectAll(); _senha.Focus(); }
        finally { UseWaitCursor = false; }
    }
}

/// <summary>Preferencias simples do usuario no registro (HKCU\Software\Kartodromo).</summary>
public static class Registro
{
    public static string Ler(string k)
    {
        try { using var ch = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\Kartodromo\Recepcao"); return ch?.GetValue(k) as string ?? ""; } catch { return ""; }
    }
    public static void Gravar(string k, string v)
    {
        try { using var ch = Microsoft.Win32.Registry.CurrentUser.CreateSubKey(@"Software\Kartodromo\Recepcao"); ch.SetValue(k, v); } catch { /* sem permissao */ }
    }
}
