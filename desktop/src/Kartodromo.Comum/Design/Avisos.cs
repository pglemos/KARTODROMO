using System.Drawing.Drawing2D;

namespace Kartodromo.Comum;

/// <summary>Banner: condição da tela inteira que persiste (sem conexão, caixa fechado, modo simulador). Fica no topo do
/// conteúdo e só sai quando a condição acaba. docs/design-system/03-componentes/aviso-banner-toast.md</summary>
public class Banner : Panel
{
    readonly Label _texto;
    readonly Botao _acao;
    Estado _estado;

    public Banner(string texto, Estado estado = Estado.Aviso, string rotuloAcao = null, Action acao = null)
    {
        Dock = DockStyle.Top;
        DoubleBuffered = true;
        _estado = estado;
        BackColor = CoresEstado.Fundo(estado);
        Padding = new Padding(Tokens.Claro.Espaco1 * 2 + 20, Tokens.Claro.Espaco1, Tokens.Claro.Espaco2, Tokens.Claro.Espaco1);
        AccessibleRole = estado == Estado.Perigo ? AccessibleRole.Alert : AccessibleRole.StatusBar;
        _texto = new Label { Text = texto, Dock = DockStyle.Fill, AutoSize = false, TextAlign = ContentAlignment.MiddleLeft, Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo), ForeColor = Tokens.Claro.CorTextoPrincipal, BackColor = Color.Transparent, AutoEllipsis = true };
        Controls.Add(_texto);
        if (rotuloAcao != null && acao != null)
        {
            _acao = new Botao(rotuloAcao, VarianteBotao.Secundario, TamanhoBotao.P) { Dock = DockStyle.Right };
            _acao.Click += (_, _) => acao();
            Controls.Add(_acao);
        }
        Height = Tokens.Claro.ComponenteControleAlturaM + Tokens.Claro.Espaco1;
        AccessibleName = texto;
    }

    public void Definir(string texto, Estado estado)
    {
        _texto.Text = texto; AccessibleName = texto; _estado = estado; BackColor = CoresEstado.Fundo(estado); Invalidate(true);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        using (var b = new SolidBrush(CoresEstado.Solido(_estado))) e.Graphics.FillRectangle(b, 0, 0, 3, Height);
        Forma.DesenharSvg(e.Graphics, CoresEstado.Icone(_estado), new RectangleF(Tokens.Claro.Espaco2 - 2, (Height - 20) / 2f, 20, 20), CoresEstado.Texto(_estado));
    }
}

/// <summary>Toast: confirmação de ação concluída ("Cliente salvo."), canto inferior direito da janela.
/// Sucesso/info somem em 5 s (pausa com o mouse em cima); erro só fecha no ✕. Até 3 empilhados.
/// No autoteste é registrado em vez de aparecer (<see cref="Msg.Registro"/>).</summary>
public sealed class Toast : Form
{
    static readonly List<Toast> _abertos = [];
    readonly System.Windows.Forms.Timer _tempo = new();
    readonly Form _dono;
    readonly Estado _estado;

    Toast(Form dono, string texto, Estado estado, string rotuloAcao, Action acao)
    {
        _dono = dono; _estado = estado;
        FormBorderStyle = FormBorderStyle.None; ShowInTaskbar = false; StartPosition = FormStartPosition.Manual; TopMost = false;
        BackColor = Tokens.Claro.CorSuperficiePadrao; DoubleBuffered = true;
        AccessibleRole = estado == Estado.Perigo ? AccessibleRole.Alert : AccessibleRole.StatusBar; AccessibleName = texto;
        Padding = new Padding(Tokens.Claro.Espaco2 + 20 + Tokens.Claro.Espaco1, Tokens.Claro.EspacoDenso12, Tokens.Claro.Espaco1, Tokens.Claro.EspacoDenso12);
        var linha = new FlowLayoutPanel { Dock = DockStyle.Fill, AutoSize = true, WrapContents = false, BackColor = Color.Transparent, Margin = Padding.Empty };
        var rotulo = new Label { Text = texto, AutoSize = true, MaximumSize = new Size(300, 0), Font = Tokens.Fonte(Tokens.Claro.FonteTamanhoCorpo), ForeColor = Tokens.Claro.CorTextoPrincipal, Margin = new Padding(0, 6, Tokens.Claro.Espaco1, 0) };
        linha.Controls.Add(rotulo);
        if (rotuloAcao != null && acao != null)
        {
            var b = new Botao(rotuloAcao, VarianteBotao.Fantasma, TamanhoBotao.P) { Margin = Padding.Empty };
            b.Click += (_, _) => { acao(); Close(); };
            linha.Controls.Add(b);
        }
        var fechar = new Botao("", VarianteBotao.SoIcone, TamanhoBotao.P) { Svg = IconesLucide.Fechar, Dica = "Fechar aviso", Margin = Padding.Empty };
        fechar.Click += (_, _) => Close();
        linha.Controls.Add(fechar);
        Controls.Add(linha);
        var pref = linha.GetPreferredSize(Size.Empty);
        ClientSize = new Size(Math.Min(420, pref.Width + Padding.Horizontal), Math.Max(Tokens.Claro.ComponenteControleAlturaG, pref.Height + Padding.Vertical));

        _tempo.Interval = 5000;
        _tempo.Tick += (_, _) => Close();
        if (estado != Estado.Perigo) _tempo.Start();
        void Pausar(object s, EventArgs e) => _tempo.Stop();
        void Retomar(object s, EventArgs e) { if (_estado != Estado.Perigo && !ClientRectangle.Contains(PointToClient(Cursor.Position))) _tempo.Start(); }
        foreach (Control c in new Control[] { this, linha, rotulo }) { c.MouseEnter += Pausar; c.MouseLeave += Retomar; }
        FormClosed += (_, _) => { _tempo.Dispose(); _abertos.Remove(this); Reposicionar(_dono); };
        Resize += (_, _) => Forma.AplicarRaio(this, Tokens.Claro.RaioCartao);
    }

    protected override bool ShowWithoutActivation => true;

    protected override CreateParams CreateParams
    {
        get { var cp = base.CreateParams; cp.ClassStyle |= 0x20000; cp.ExStyle |= 0x08000000 | 0x80; return cp; } // sombra, NOACTIVATE, TOOLWINDOW
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        using (var p = Forma.Redondo(new Rectangle(0, 0, Width - 1, Height - 1), Tokens.Claro.RaioCartao))
        using (var pen = new Pen(Tokens.Claro.CorBordaSutil)) e.Graphics.DrawPath(pen, p);
        Forma.DesenharSvg(e.Graphics, CoresEstado.Icone(_estado), new RectangleF(Tokens.Claro.Espaco2, (Height - 20) / 2f, 20, 20), CoresEstado.Texto(_estado));
    }

    /// <summary>Mostra o aviso no canto da janela de <paramref name="onde"/>. Sem janela visível, não faz nada.</summary>
    public static void Mostrar(Control onde, string texto, Estado estado = Estado.Sucesso, string rotuloAcao = null, Action acao = null)
    {
        if (Msg.Registro != null) { Msg.Registro($"TOAST ({estado}): {texto}"); return; }
        var dono = onde as Form ?? onde?.FindForm();
        if (dono == null || !dono.Visible || dono.IsDisposed) return;
        while (_abertos.Count(t => t._dono == dono) >= 3) _abertos.First(t => t._dono == dono).Close();
        var t = new Toast(dono, texto, estado, rotuloAcao, acao) { Owner = dono };
        _abertos.Add(t);
        Reposicionar(dono);
        t.Show();
    }

    static void Reposicionar(Form dono)
    {
        if (dono == null || dono.IsDisposed) return;
        var area = dono.RectangleToScreen(dono.ClientRectangle);
        var y = area.Bottom - Tokens.Claro.Espaco3;
        foreach (var t in _abertos.Where(t => t._dono == dono).Reverse())
        {
            y -= t.Height;
            t.Location = new Point(area.Right - Tokens.Claro.Espaco3 - t.Width, y);
            y -= Tokens.Claro.Espaco1;
        }
    }
}

/// <summary>Indicador de carregando (arco girando) — use em área que espera dados por mais de 300 ms.</summary>
public class IndicadorCarregando : Control
{
    readonly System.Windows.Forms.Timer _giro = new() { Interval = 50 };
    float _angulo;

    public IndicadorCarregando(int lado = 24)
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.SupportsTransparentBackColor, true);
        SetStyle(ControlStyles.Selectable, false);
        BackColor = Color.Transparent; Size = new Size(lado, lado);
        AccessibleRole = AccessibleRole.Animation; AccessibleName = "Carregando";
        _giro.Tick += (_, _) => { _angulo = (_angulo + 30) % 360; Invalidate(); };
    }

    protected override void OnVisibleChanged(EventArgs e) { base.OnVisibleChanged(e); if (Visible) _giro.Start(); else _giro.Stop(); }
    protected override void OnHandleCreated(EventArgs e) { base.OnHandleCreated(e); if (Visible) _giro.Start(); }
    protected override void Dispose(bool disposing) { if (disposing) _giro.Dispose(); base.Dispose(disposing); }

    protected override void OnPaint(PaintEventArgs e)
    {
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        var t = Math.Max(2f, Width / 10f);
        var r = new RectangleF(t, t, Width - 2 * t - 1, Height - 2 * t - 1);
        using (var trilho = new Pen(Tokens.Claro.CorSuperficieCampo, t)) e.Graphics.DrawEllipse(trilho, r);
        using var pen = new Pen(Tokens.Claro.CorAcaoPrincipal, t) { StartCap = LineCap.Round, EndCap = LineCap.Round };
        e.Graphics.DrawArc(pen, r, _angulo, 90);
    }
}
