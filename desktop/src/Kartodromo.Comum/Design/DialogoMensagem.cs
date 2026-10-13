using System.Drawing.Drawing2D;

namespace Kartodromo.Comum;

/// <summary>
/// Mensagem/pergunta no visual do sistema (substitui a caixa cinza do Windows): cartão de 480–560 px, ícone do estado,
/// título, texto e botões à direita. Enter aciona o botão em foco; Esc responde o "cancelar"; Ctrl+C copia o texto
/// (como a caixa do Windows fazia — útil para mandar o erro ao suporte).
/// docs/design-system/03-componentes/modal-e-dialogo.md e confirmacao-destrutiva.md
/// </summary>
public sealed class DialogoMensagem : CartaoModal
{
    public bool Confirmado { get; private set; }
    readonly string _copia;

    internal DialogoMensagem(string titulo, string texto, Estado estado, string principal, string secundario, bool perigo, bool focoNoSecundario)
        : base(560, 400)
    {
        Text = titulo;
        AccessibleDescription = texto;
        BackColor = Tokens.Claro.CorSuperficiePadrao;
        Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo);
        _copia = titulo + Environment.NewLine + Environment.NewLine + texto;
        var m = Tokens.Claro.Espaco3;
        const int ladoIcone = 40;
        var largura = 520;
        var larguraTexto = largura - m * 2 - ladoIcone - Tokens.Claro.Espaco2;

        var icone = new Panel { Location = new Point(m, m), Size = new Size(ladoIcone, ladoIcone), BackColor = Color.Transparent };
        icone.Paint += (_, e) =>
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using (var b = new SolidBrush(CoresEstado.Fundo(estado))) e.Graphics.FillEllipse(b, 0, 0, ladoIcone - 1, ladoIcone - 1);
            Forma.DesenharSvg(e.Graphics, estado == Estado.Neutro ? IconesLucide.Pergunta : CoresEstado.Icone(estado), new RectangleF(10, 10, 20, 20), CoresEstado.Texto(estado == Estado.Neutro ? Estado.Info : estado));
        };
        var x = m + ladoIcone + Tokens.Claro.Espaco2;
        var t = TextoMedido(titulo, Tokens.Fonte(Tokens.Claro.FonteTamanhoTitulo, FontStyle.Bold), Tokens.Claro.CorTextoPrincipal, larguraTexto);
        t.Location = new Point(x, m + 2);
        var c = TextoMedido(texto, Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo), Tokens.Claro.CorTextoSecundario, larguraTexto);
        Controls.Add(icone); Controls.Add(t); Controls.Add(c);
        c.Location = new Point(x, t.Bottom + Tokens.Claro.Espaco1);
        // texto muito longo (erro com detalhes): rola dentro da janela em vez de crescer além da tela
        var area = Screen.FromPoint(Cursor.Position).WorkingArea;
        var alturaMaxTexto = Math.Max(120, area.Height - 260);
        if (c.Height > alturaMaxTexto)
        {
            Controls.Remove(c);
            var rolagem = new Panel { Location = c.Location, Size = new Size(larguraTexto + SystemInformation.VerticalScrollBarWidth, alturaMaxTexto), AutoScroll = true };
            c.Location = Point.Empty; rolagem.Controls.Add(c); Controls.Add(rolagem);
        }
        var fimTexto = Controls.Cast<Control>().Max(k => k.Bottom);

        var botoes = new FlowLayoutPanel { FlowDirection = FlowDirection.RightToLeft, AutoSize = true, WrapContents = false, BackColor = Color.Transparent, Margin = Padding.Empty };
        var bPrincipal = new Botao(principal, perigo ? VarianteBotao.Perigo : VarianteBotao.Primario) { Margin = new Padding(Tokens.Claro.Espaco1, 0, 0, 0) };
        bPrincipal.Click += (_, _) => { Confirmado = true; DialogResult = DialogResult.OK; Close(); };
        botoes.Controls.Add(bPrincipal);
        Botao bSecundario = null;
        if (secundario != null)
        {
            bSecundario = new Botao(secundario, VarianteBotao.Secundario) { Margin = Padding.Empty };
            bSecundario.Click += (_, _) => { Confirmado = false; DialogResult = DialogResult.Cancel; Close(); };
            botoes.Controls.Add(bSecundario);
        }
        Controls.Add(botoes);
        var topoBotoes = Math.Max(fimTexto, ladoIcone + m) + m;
        var pref = botoes.GetPreferredSize(Size.Empty);
        largura = Math.Max(largura, pref.Width + m * 2);
        botoes.AutoSize = false; botoes.Size = pref; // sem isso o painel ficava 200x100 até a janela existir
        botoes.Location = new Point(largura - m - pref.Width, topoBotoes);
        ClientSize = new Size(largura, topoBotoes + pref.Height + m);
        Arredondar();

        AcceptButton = null; // Enter aciona o botão que está com o foco (como na caixa do Windows)
        CancelButton = bSecundario ?? bPrincipal;
        ActiveControl = focoNoSecundario && bSecundario != null ? bSecundario : bPrincipal;
        KeyDown += (_, e) =>
        {
            if (e.Control && e.KeyCode == Keys.C) { try { Clipboard.SetText(_copia); } catch { /* área de transferência ocupada */ } e.Handled = true; }
        };
    }

    /// <summary>Rótulo com a altura exata do texto quebrado na largura dada.</summary>
    internal static Label TextoMedido(string texto, Font fonte, Color cor, int largura)
    {
        var tam = TextRenderer.MeasureText(texto ?? "", fonte, new Size(largura, int.MaxValue), TextFormatFlags.WordBreak | TextFormatFlags.NoPrefix);
        return new Label { Text = texto, AutoSize = false, Font = fonte, ForeColor = cor, UseMnemonic = false, BackColor = Color.Transparent, Size = new Size(largura, tam.Height + 2) };
    }

    protected override void OnLoad(EventArgs e)
    {
        // escurece a janela de trás, como os outros diálogos
        if (Owner is Form dono && dono.Visible && dono.WindowState != FormWindowState.Minimized && dono is not Escurecer)
        {
            var fundo = new Escurecer(dono);
            fundo.Show();
            FormClosed += (_, _) => fundo.Close();
        }
        if (Owner == null) StartPosition = FormStartPosition.CenterScreen;
        base.OnLoad(e);
    }

    /// <summary>Mostra e devolve true se o botão principal foi escolhido.</summary>
    public static bool Mostrar(IWin32Window dono, string titulo, string texto, Estado estado, string principal, string secundario = null, bool perigo = false, bool focoNoSecundario = false)
    {
        var donoForm = (dono as Control)?.FindForm() ?? dono as Form;
        if (donoForm is { IsDisposed: false, IsHandleCreated: true, InvokeRequired: true })
            return (bool)donoForm.Invoke(() => Mostrar(donoForm, titulo, texto, estado, principal, secundario, perigo, focoNoSecundario));
        using var d = new DialogoMensagem(titulo, texto, estado, principal, secundario, perigo, focoNoSecundario);
        if (donoForm is { IsDisposed: false, Visible: true }) d.ShowDialog(donoForm); else d.ShowDialog();
        return d.Confirmado;
    }
}
