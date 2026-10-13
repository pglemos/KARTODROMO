using System.Drawing.Drawing2D;

namespace Kartodromo.Comum;

public enum VarianteBotao { Primario, Secundario, Fantasma, Perigo, SoIcone }
public enum TamanhoBotao { P, M, G }

/// <summary>
/// Botão canônico do design system (docs/design-system/03-componentes/botao.md): variantes primário, secundário,
/// fantasma, perigo e só-ícone; tamanhos P 32 · M 40 · G 48. A largura acompanha o rótulo (o texto nunca corta),
/// foco do teclado sempre visível e, com <see cref="AoClicar"/>, mostra "…" enquanto trabalha e ignora o clique duplo.
/// </summary>
public class Botao : BotaoPlano
{
    VarianteBotao _variante;
    TamanhoBotao _tamanho = TamanhoBotao.M;
    bool _sobre, _pressionado, _carregando;
    string _svg;
    readonly ToolTip _dica = new();

    public Botao() : this("", VarianteBotao.Secundario) { }

    public Botao(string texto, VarianteBotao variante = VarianteBotao.Secundario, TamanhoBotao tamanho = TamanhoBotao.M)
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.SupportsTransparentBackColor | ControlStyles.ResizeRedraw, true);
        FlatStyle = FlatStyle.Flat;
        FlatAppearance.BorderSize = 0;
        BackColor = Color.Transparent;
        Cursor = Cursors.Hand;
        AccessibleRole = AccessibleRole.PushButton;
        Margin = new Padding(Tokens.Claro.EspacoMeio);
        _variante = variante;
        _tamanho = tamanho;
        Text = texto;
        AjustarTamanho();
    }

    public VarianteBotao Variante { get => _variante; set { _variante = value; AjustarTamanho(); Invalidate(); } }
    public TamanhoBotao Tamanho { get => _tamanho; set { _tamanho = value; AjustarTamanho(); Invalidate(); } }

    /// <summary>Desenho de traço (caminho SVG Lucide, ex.: <see cref="IconesLucide.Mais"/>) à esquerda do rótulo.</summary>
    public string Svg { get => _svg; set { _svg = value; AjustarTamanho(); Invalidate(); } }

    /// <summary>Dica (obrigatória no só-ícone; nos outros explica, por exemplo, por que está desabilitado).</summary>
    public string Dica { get => _dica.GetToolTip(this); set { _dica.SetToolTip(this, value); if (_variante == VarianteBotao.SoIcone) AccessibleName = value; } }

    /// <summary>Texto mostrado enquanto <see cref="Carregando"/> (padrão: o rótulo com "…").</summary>
    public string TextoCarregando { get; set; }

    public bool Carregando
    {
        get => _carregando;
        set { _carregando = value; Cursor = value ? Cursors.WaitCursor : Cursors.Hand; AjustarTamanho(); Invalidate(); }
    }

    /// <summary>Ação assíncrona: o botão fica "carregando" até terminar e não roda duas vezes ao mesmo tempo.
    /// Erros seguem o padrão do sistema (<see cref="Seguro.Rodar"/>: registra no erros.log e oferece tentar de novo).</summary>
    public Func<Task> AoClicar { get; set; }

    public override string Text
    {
        get => base.Text;
        set { base.Text = value; if (_variante != VarianteBotao.SoIcone) AccessibleName = (value ?? "").Replace("&", ""); AjustarTamanho(); Invalidate(); }
    }

    protected override void OnClick(EventArgs e)
    {
        if (_carregando) return;
        base.OnClick(e);
        if (AoClicar == null) return;
        Carregando = true;
        Seguro.Rodar(this, async () => { try { await AoClicar(); } finally { if (!IsDisposed) Carregando = false; } });
    }

    int Altura => _tamanho switch { TamanhoBotao.P => Tokens.Claro.ComponenteControleAlturaP, TamanhoBotao.G => Tokens.Claro.ComponenteControleAlturaG, _ => Tokens.Claro.ComponenteControleAlturaM };
    int Lateral => _tamanho switch { TamanhoBotao.P => Tokens.Claro.EspacoDenso12, TamanhoBotao.G => Tokens.Claro.Espaco3, _ => Tokens.Claro.Espaco2 };
    int LadoIcone => _tamanho == TamanhoBotao.G ? 20 : 16;
    int LarguraMinima => _variante == VarianteBotao.SoIcone ? Altura : _tamanho switch { TamanhoBotao.P => 64, TamanhoBotao.G => 120, _ => 88 };
    string Rotulo => _carregando ? (TextoCarregando ?? Text.TrimEnd('.', '…') + "…") : Text;

    Font FonteRotulo => Tokens.Fonte(_tamanho == TamanhoBotao.G ? Tokens.Claro.FonteTamanhoSubtitulo : Tokens.Claro.FonteTamanhoCorpo,
        _variante is VarianteBotao.Primario or VarianteBotao.Perigo ? FontStyle.Bold : FontStyle.Regular);

    void AjustarTamanho()
    {
        if (_variante == VarianteBotao.SoIcone) { Size = new Size(Altura, Altura); return; }
        Size = new Size(Math.Max(LarguraMinima, LarguraPreferida()), Altura);
    }

    int LarguraPreferida()
    {
        using var f = FonteRotulo;
        var texto = TextRenderer.MeasureText(Rotulo ?? "", f, Size.Empty, TextFormatFlags.SingleLine).Width;
        var icone = _svg != null ? LadoIcone + Tokens.Claro.EspacoMeio * 2 : 0;
        return texto + icone + Lateral * 2;
    }

    public override Size GetPreferredSize(Size proposedSize) =>
        _variante == VarianteBotao.SoIcone ? new Size(Altura, Altura) : new Size(Math.Max(LarguraMinima, LarguraPreferida()), Altura);

    (Color fundo, Color frente) Cores()
    {
        var ativo = _pressionado || _sobre;
        if (!Enabled) return (_variante is VarianteBotao.Fantasma or VarianteBotao.SoIcone ? Color.Transparent : Tokens.Claro.CorSuperficieCampo, Tokens.Claro.CorTextoDesabilitado);
        return _variante switch
        {
            VarianteBotao.Primario => (ativo ? Tokens.Claro.CorAcaoPrincipalPressionado : Tokens.Claro.CorAcaoPrincipal, Tokens.Claro.CorAcaoSobrePrincipal),
            VarianteBotao.Perigo => (ativo ? ControlPaint.Dark(Tokens.Claro.CorEstadoPerigoSolido, 0.08f) : Tokens.Claro.CorEstadoPerigoSolido, Tokens.Claro.CorAcaoSobrePrincipal),
            VarianteBotao.Secundario => (ativo ? ControlPaint.Dark(Tokens.Claro.CorAcaoSecundaria, 0.04f) : Tokens.Claro.CorAcaoSecundaria, Tokens.Claro.CorAcaoSobreSecundaria),
            _ => (ativo ? Tokens.Claro.CorSuperficieCampo : Color.Transparent, _variante == VarianteBotao.SoIcone && !_sobre ? Tokens.Claro.CorTextoSecundario : Tokens.Claro.CorTextoPrincipal),
        };
    }

    /// <summary>Primeira cor opaca subindo pelos pais (painel transparente deixava os cantos pretos).</summary>
    internal static Color FundoEfetivo(Control c)
    {
        for (; c != null; c = c.Parent) if (c.BackColor.A == 255) return c.BackColor;
        return Tokens.Claro.CorSuperficiePadrao;
    }

    protected override void OnMouseEnter(EventArgs e) { _sobre = true; Invalidate(); base.OnMouseEnter(e); }
    protected override void OnMouseLeave(EventArgs e) { _sobre = false; _pressionado = false; Invalidate(); base.OnMouseLeave(e); }
    protected override void OnMouseDown(MouseEventArgs e) { if (e.Button == MouseButtons.Left) { _pressionado = true; Invalidate(); } base.OnMouseDown(e); }
    protected override void OnMouseUp(MouseEventArgs e) { _pressionado = false; Invalidate(); base.OnMouseUp(e); }
    protected override void OnEnabledChanged(EventArgs e) { Invalidate(); base.OnEnabledChanged(e); }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(FundoEfetivo(Parent));
        var (fundo, frente) = Cores();
        var r = new Rectangle(0, 0, Width - 1, Height - 1);
        if (fundo.A > 0) { using var b = new SolidBrush(fundo); using var p = Forma.Redondo(r, Tokens.Claro.RaioBotao); g.FillPath(b, p); }

        var conteudo = ClientRectangle;
        if (_svg != null)
        {
            using var f = FonteRotulo;
            var largTexto = _variante == VarianteBotao.SoIcone ? 0 : TextRenderer.MeasureText(Rotulo ?? "", f, Size.Empty, TextFormatFlags.SingleLine).Width + Tokens.Claro.EspacoMeio * 2;
            var x = (Width - LadoIcone - largTexto) / 2;
            Forma.DesenharSvg(g, _svg, new RectangleF(x, (Height - LadoIcone) / 2f, LadoIcone, LadoIcone), frente);
            conteudo = new Rectangle(x + LadoIcone + Tokens.Claro.EspacoMeio * 2, 0, largTexto, Height);
        }
        if (_variante != VarianteBotao.SoIcone)
        {
            using var f = FonteRotulo;
            var flags = TextFormatFlags.SingleLine | TextFormatFlags.VerticalCenter | (_svg == null ? TextFormatFlags.HorizontalCenter : TextFormatFlags.Left);
            if (!ShowKeyboardCues) flags |= TextFormatFlags.HidePrefix;
            TextRenderer.DrawText(g, Rotulo, f, conteudo, frente, flags);
        }
        if (Focused && ShowFocusCues && Enabled)
        {
            using var pen = new Pen(Tokens.Claro.CorBordaFoco, Tokens.Claro.FocoLargura);
            using var p = Forma.Redondo(new Rectangle(1, 1, Width - 3, Height - 3), Math.Max(2, Tokens.Claro.RaioBotao - 1));
            g.DrawPath(pen, p);
        }
    }
}
