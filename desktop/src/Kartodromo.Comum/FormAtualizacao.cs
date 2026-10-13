namespace Kartodromo.Comum;

sealed class FormAtualizacao : Form
{
    readonly Label _status;

    public FormAtualizacao(string app, string status)
    {
        Text = app;
        Width = 480;
        Height = 155;
        MinimumSize = Size;
        MaximumSize = Size;
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        ControlBox = false;
        ShowInTaskbar = true;
        TopMost = true;
        BackColor = Tokens.Primitivo.Branco;

        var titulo = new Label { Dock = DockStyle.Top, Height = 42, Text = app, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoTitulo, FontStyle.Bold), Padding = new Padding(20, 14, 20, 0) };
        _status = new Label { Dock = DockStyle.Fill, Text = status, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo), Padding = new Padding(20, 2, 20, 14), AutoEllipsis = true };
        Controls.Add(_status);
        Controls.Add(titulo);
    }

    public void Status(string texto)
    {
        if (!IsDisposed) _status.Text = texto;
    }

    public void MostrarErro(string texto)
    {
        if (!IsDisposed) { _status.ForeColor = Color.DarkRed; _status.Text = texto; }
    }
}
