namespace Kartodromo.Comum;

/// <summary>Estado vazio: ícone 48 + título + uma frase + ação opcional, centralizado na área (nunca área em branco).
/// docs/design-system/03-componentes/estado-vazio.md</summary>
public class EstadoVazio : Panel
{
    readonly Label _titulo, _texto;
    readonly Botao _acao;
    string _svg = IconesLucide.Info;

    public EstadoVazio(string titulo, string texto = null, string rotuloAcao = null, Action acao = null, string svg = null)
    {
        DoubleBuffered = true;
        BackColor = Tokens.Claro.CorSuperficiePadrao;
        AccessibleRole = AccessibleRole.Grouping;
        AccessibleName = titulo;
        if (svg != null) _svg = svg;
        _titulo = new Label { Text = titulo, AutoSize = false, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoSubtitulo, FontStyle.Bold), ForeColor = Tokens.Claro.CorTextoPrincipal, BackColor = Color.Transparent, TextAlign = ContentAlignment.TopCenter, UseMnemonic = false };
        _texto = new Label { Text = texto ?? "", AutoSize = false, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo), ForeColor = Tokens.Claro.CorTextoSecundario, BackColor = Color.Transparent, TextAlign = ContentAlignment.TopCenter, UseMnemonic = false, Visible = !string.IsNullOrEmpty(texto) };
        Controls.Add(_titulo); Controls.Add(_texto);
        if (rotuloAcao != null && acao != null)
        {
            _acao = new Botao(rotuloAcao, VarianteBotao.Primario);
            _acao.Click += (_, _) => acao();
            Controls.Add(_acao);
        }
    }

    /// <summary>Troca o conteúdo (ex.: busca sem resultado mostra o termo digitado).</summary>
    public void Definir(string titulo, string texto = null)
    {
        _titulo.Text = titulo; AccessibleName = titulo;
        _texto.Text = texto ?? ""; _texto.Visible = !string.IsNullOrEmpty(texto);
        PerformLayout(); Invalidate();
    }

    const int LadoIcone = 48;

    static void Medir(Label l, int largura)
    {
        var h = TextRenderer.MeasureText(l.Text ?? "", l.Font, new Size(largura, int.MaxValue), TextFormatFlags.WordBreak | TextFormatFlags.NoPrefix | TextFormatFlags.HorizontalCenter).Height;
        l.Size = new Size(largura, h + 2);
    }

    int Topo()
    {
        var altura = LadoIcone + Tokens.Claro.Espaco2 + _titulo.Height
            + (_texto.Visible ? Tokens.Claro.Espaco1 + _texto.Height : 0)
            + (_acao != null ? Tokens.Claro.Espaco2 + _acao.Height : 0);
        return Math.Max(Tokens.Claro.Espaco2, (ClientSize.Height - altura) / 2);
    }

    protected override void OnLayout(LayoutEventArgs levent)
    {
        base.OnLayout(levent);
        var max = Math.Max(120, ClientSize.Width - Tokens.Claro.Espaco3 * 2);
        Medir(_titulo, max); Medir(_texto, Math.Min(max, 480));
        var y = Topo() + LadoIcone + Tokens.Claro.Espaco2;
        _titulo.Location = new Point((ClientSize.Width - _titulo.Width) / 2, y);
        y = _titulo.Bottom;
        if (_texto.Visible) { y += Tokens.Claro.Espaco1; _texto.Location = new Point((ClientSize.Width - _texto.Width) / 2, y); y = _texto.Bottom; }
        if (_acao != null) _acao.Location = new Point((ClientSize.Width - _acao.Width) / 2, y + Tokens.Claro.Espaco2);
    }

    protected override void OnResize(EventArgs eventargs) { base.OnResize(eventargs); PerformLayout(); Invalidate(); }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        Forma.DesenharSvg(e.Graphics, _svg, new RectangleF((ClientSize.Width - LadoIcone) / 2f, Topo(), LadoIcone, LadoIcone), Tokens.Claro.CorTextoTerciario, 1.5f);
    }
}
