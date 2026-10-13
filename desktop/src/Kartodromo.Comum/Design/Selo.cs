using System.Drawing.Drawing2D;

namespace Kartodromo.Comum;

/// <summary>Estado semântico único do sistema (docs/design-system/01-fundamentos/cor.md).</summary>
public enum Estado { Neutro, Sucesso, Aviso, Perigo, Info }

/// <summary>Cores de cada estado no tema claro (operação).</summary>
public static class CoresEstado
{
    public static Color Fundo(Estado e) => e switch
    {
        Estado.Sucesso => Tokens.Claro.CorEstadoSucessoFundo,
        Estado.Aviso => Tokens.Claro.CorEstadoAvisoFundo,
        Estado.Perigo => Tokens.Claro.CorEstadoPerigoFundo,
        Estado.Info => Tokens.Claro.CorEstadoInfoFundo,
        _ => Tokens.Claro.CorSuperficieCampo,
    };

    public static Color Texto(Estado e) => e switch
    {
        Estado.Sucesso => Tokens.Claro.CorEstadoSucessoTexto,
        Estado.Aviso => Tokens.Claro.CorEstadoAvisoTexto,
        Estado.Perigo => Tokens.Claro.CorEstadoPerigoTexto,
        Estado.Info => Tokens.Claro.CorEstadoInfoTexto,
        _ => Tokens.Claro.CorTextoSecundario,
    };

    public static Color Solido(Estado e) => e switch
    {
        Estado.Sucesso => Tokens.Claro.CorEstadoSucessoSolido,
        Estado.Aviso => Tokens.Claro.CorEstadoAvisoSolido,
        Estado.Perigo => Tokens.Claro.CorEstadoPerigoSolido,
        Estado.Info => Tokens.Claro.CorEstadoInfoSolido,
        _ => Tokens.Claro.CorTextoSecundario,
    };

    public static string Icone(Estado e) => e switch
    {
        Estado.Sucesso => IconesLucide.Sucesso,
        Estado.Aviso => IconesLucide.Aviso,
        Estado.Perigo => IconesLucide.Erro,
        _ => IconesLucide.Info,
    };
}

/// <summary>Selo de status (Pago, A pagar, Cancelado…) — o TEXTO carrega o significado, a cor reforça.
/// <see cref="ComPonto"/> vira a pílula de status (● Pista). docs/design-system/03-componentes/selo-e-pilula.md</summary>
public class Selo : Control
{
    Estado _estado;
    bool _ponto;

    public Selo() : this("", Estado.Neutro) { }

    public Selo(string texto, Estado estado, bool comPonto = false)
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.SupportsTransparentBackColor, true);
        SetStyle(ControlStyles.Selectable, false);
        TabStop = false;
        BackColor = Color.Transparent;
        AccessibleRole = AccessibleRole.StaticText;
        Margin = new Padding(0, Tokens.Claro.EspacoMeio, Tokens.Claro.Espaco1, Tokens.Claro.EspacoMeio);
        _estado = estado; _ponto = comPonto;
        Text = texto;
    }

    public Estado Estado { get => _estado; set { _estado = value; Invalidate(); } }
    public bool ComPonto { get => _ponto; set { _ponto = value; Ajustar(); } }

    const int Altura = 22;
    const int LadoPonto = 6;

    protected override void OnTextChanged(EventArgs e) { AccessibleName = Text; Ajustar(); base.OnTextChanged(e); }

    static Font NovaFonte() => Tokens.Fonte(Tokens.Claro.FonteTamanhoLegenda, FontStyle.Bold);

    void Ajustar() { Size = GetPreferredSize(Size.Empty); Invalidate(); }

    public override Size GetPreferredSize(Size proposedSize)
    {
        using var f = NovaFonte();
        var w = TextRenderer.MeasureText(Text ?? "", f, Size.Empty, TextFormatFlags.SingleLine | TextFormatFlags.NoPadding).Width;
        return new Size(w + Tokens.Claro.Espaco1 * 2 + (_ponto ? LadoPonto + Tokens.Claro.EspacoMeio + 2 : 0), Altura);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        using (var b = new SolidBrush(CoresEstado.Fundo(_estado)))
        using (var p = Forma.Redondo(new Rectangle(0, 0, Width - 1, Height - 1), Tokens.Claro.RaioChip)) g.FillPath(b, p);
        var x = Tokens.Claro.Espaco1;
        if (_ponto)
        {
            using var b = new SolidBrush(CoresEstado.Solido(_estado));
            g.FillEllipse(b, x, (Height - LadoPonto) / 2f, LadoPonto, LadoPonto);
            x += LadoPonto + Tokens.Claro.EspacoMeio + 2;
        }
        using var f = NovaFonte();
        TextRenderer.DrawText(g, Text, f, new Rectangle(x, 0, Width - x, Height), CoresEstado.Texto(_estado), TextFormatFlags.SingleLine | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding | TextFormatFlags.NoPrefix);
    }
}
